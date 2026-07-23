import { prisma } from "../../db";
import { escapeHtml, ticketId } from "../../util";
import {
  backCancelKeyboard,
  buildModuleKeyboard,
  buildSystemKeyboard,
  mainMenu,
  submitKeyboard,
  typeKeyboard,
} from "../keyboards";
import { getActiveModules, moduleLabel } from "../services/modules";
import { getActiveSystems } from "../services/systems";
import { notifyAdmins, routeRequest } from "../services/notify";
import { BTN_BACK, BTN_CANCEL, BTN_SUBMIT, LABEL_TO_TYPE, TYPE_LABELS } from "../texts";
import { MyContext } from "../types";
import { requireApprovedOperator } from "./registration";

const ASK_SYSTEM = "Qaysi tizim bo'yicha so'rov? Tanlang:";
const ASK_TYPE = "So'rov turini tanlang:";
const ASK_MODULE = "Qaysi modulga tegishli?";
const ASK_SCHOOL = "Maktab/muassasa nomini yozing:";
const ASK_DESC = [
  "Endi izoh yuboring.",
  "",
  "Matn, rasm, video, fayl yoki ovozli xabar — bir nechta xabar yuborishingiz mumkin.",
  `Hammasini yuborib bo'lgach, pastdagi "${BTN_SUBMIT}" tugmasini bosing.`,
].join("\n");

export async function startWizard(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  ctx.session.draft = {};
  const systems = await getActiveSystems();
  if (systems.length > 0) {
    ctx.session.step = "req_system";
    await ctx.reply(ASK_SYSTEM, { reply_markup: buildSystemKeyboard(systems) });
  } else {
    ctx.session.step = "req_type";
    await ctx.reply(ASK_TYPE, { reply_markup: typeKeyboard });
  }
}

export async function handleSystemStep(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancelWizard(ctx);
  const systems = await getActiveSystems();
  const chosen = systems.find((s) => s.name === text);
  if (!chosen) {
    await ctx.reply("Iltimos, pastdagi tugmalardan birini tanlang.", {
      reply_markup: buildSystemKeyboard(systems),
    });
    return;
  }
  ctx.session.draft = { ...ctx.session.draft, systemId: chosen.id };
  ctx.session.step = "req_type";
  await ctx.reply(ASK_TYPE, { reply_markup: typeKeyboard });
}

async function cancelWizard(ctx: MyContext): Promise<void> {
  ctx.session.step = "idle";
  ctx.session.draft = undefined;
  await ctx.reply("❌ So'rov kiritish bekor qilindi.", { reply_markup: mainMenu });
}

export async function handleTypeStep(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancelWizard(ctx);
  if (text === BTN_BACK) return startWizard(ctx);
  const type = LABEL_TO_TYPE[text];
  if (!type) {
    await ctx.reply("Iltimos, pastdagi tugmalardan birini tanlang.", { reply_markup: typeKeyboard });
    return;
  }
  ctx.session.draft = { ...ctx.session.draft, type };
  ctx.session.step = "req_module";
  await ctx.reply(ASK_MODULE, { reply_markup: buildModuleKeyboard(await getActiveModules()) });
}

export async function handleModuleStep(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancelWizard(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "req_type";
    await ctx.reply(ASK_TYPE, { reply_markup: typeKeyboard });
    return;
  }
  const modules = await getActiveModules();
  const chosen = modules.find((m) => moduleLabel(m) === text);
  if (!chosen) {
    await ctx.reply("Iltimos, pastdagi tugmalardan birini tanlang.", {
      reply_markup: buildModuleKeyboard(modules),
    });
    return;
  }
  ctx.session.draft = { ...ctx.session.draft, moduleId: chosen.id };
  ctx.session.step = "req_school";
  await ctx.reply(ASK_SCHOOL, { reply_markup: backCancelKeyboard });
}

export async function handleSchoolStep(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancelWizard(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "req_module";
    await ctx.reply(ASK_MODULE, { reply_markup: buildModuleKeyboard(await getActiveModules()) });
    return;
  }
  if (text.length < 3) {
    await ctx.reply("Maktab nomi juda qisqa — kamida 3 harf yozing.");
    return;
  }
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  let school = await prisma.school.findFirst({
    where: { name: { equals: text, mode: "insensitive" } },
  });
  if (!school) {
    school = await prisma.school.create({ data: { name: text, createdByOperatorId: op.id } });
    await notifyAdmins(
      ctx.api,
      `🏫 <b>Yangi maktab qo'shildi:</b> ${escapeHtml(school.name)}\n👤 Operator: ${escapeHtml(op.fullName)}`
    );
  }

  ctx.session.draft = { ...ctx.session.draft, schoolId: school.id, descTexts: [], attachments: [] };
  ctx.session.step = "req_desc";
  await ctx.reply(ASK_DESC, { reply_markup: submitKeyboard });
}

function collectedCount(ctx: MyContext): number {
  const d = ctx.session.draft;
  return (d?.descTexts?.length ?? 0) + (d?.attachments?.length ?? 0);
}

const ACK_HINT = `Yana yuborishingiz yoki "${BTN_SUBMIT}" tugmasini bosishingiz mumkin.`;

export async function handleDescStep(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancelWizard(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "req_school";
    await ctx.reply(ASK_SCHOOL, { reply_markup: backCancelKeyboard });
    return;
  }
  if (text === BTN_SUBMIT) return submitRequest(ctx);

  const draft = ctx.session.draft ?? {};
  draft.descTexts = [...(draft.descTexts ?? []), text];
  ctx.session.draft = draft;
  await ctx.reply(`✅ Qabul qilindi (${collectedCount(ctx)}-xabar). ${ACK_HINT}`);
}

/** Izoh bosqichida yuborilgan media (rasm/video/ovoz/fayl) xabarlarini yig'adi */
export async function handleDescMedia(ctx: MyContext): Promise<void> {
  if (ctx.session.step !== "req_desc") return;
  const msg = ctx.message;
  if (!msg) return;

  let kind = "";
  let fileId = "";
  if (msg.photo?.length) {
    kind = "photo";
    fileId = msg.photo[msg.photo.length - 1].file_id;
  } else if (msg.video) {
    kind = "video";
    fileId = msg.video.file_id;
  } else if (msg.voice) {
    kind = "voice";
    fileId = msg.voice.file_id;
  } else if (msg.audio) {
    kind = "audio";
    fileId = msg.audio.file_id;
  } else if (msg.video_note) {
    kind = "video_note";
    fileId = msg.video_note.file_id;
  } else if (msg.animation) {
    kind = "animation";
    fileId = msg.animation.file_id;
  } else if (msg.document) {
    kind = "document";
    fileId = msg.document.file_id;
  } else {
    return;
  }

  const draft = ctx.session.draft ?? {};
  draft.attachments = [
    ...(draft.attachments ?? []),
    { kind, fileId, caption: msg.caption, chatId: msg.chat.id, messageId: msg.message_id },
  ];
  ctx.session.draft = draft;
  await ctx.reply(`✅ Fayl qabul qilindi (${collectedCount(ctx)}-xabar). ${ACK_HINT}`);
}

async function submitRequest(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  const draft = ctx.session.draft;
  if (!draft?.type || !draft.moduleId || !draft.schoolId) {
    ctx.session.step = "idle";
    ctx.session.draft = undefined;
    await ctx.reply("Nimadir xato ketdi. Iltimos, /new bilan qaytadan boshlang.", { reply_markup: mainMenu });
    return;
  }

  const texts = draft.descTexts ?? [];
  const attachments = draft.attachments ?? [];
  if (texts.length === 0 && attachments.length === 0) {
    await ctx.reply("Hali hech narsa yubormadingiz. Avval izoh yozing yoki fayl yuboring.");
    return;
  }

  const captions = attachments.filter((a) => a.caption).map((a) => a.caption as string);
  const description = [...texts, ...captions].join("\n\n") || "(matnsiz — media biriktirilgan)";

  const request = await prisma.request.create({
    data: {
      type: draft.type,
      systemId: draft.systemId ?? null,
      moduleId: draft.moduleId,
      schoolId: draft.schoolId,
      operatorId: op.id,
      description,
      attachments: {
        create: attachments.map((a) => ({ kind: a.kind, fileId: a.fileId, caption: a.caption ?? null })),
      },
    },
    include: { school: true, module: true },
  });

  ctx.session.step = "idle";
  ctx.session.draft = undefined;

  await ctx.reply(
    [
      `✅ So'rov qabul qilindi! Ticket: <code>${ticketId(request.ticketNumber)}</code>`,
      "",
      `Turi: ${TYPE_LABELS[request.type]}`,
      `Modul: ${escapeHtml(moduleLabel(request.module))}`,
      `Maktab: ${escapeHtml(request.school.name)}`,
      ...(attachments.length > 0 ? [`📎 Biriktirilgan fayllar: ${attachments.length} ta`] : []),
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: mainMenu }
  );

  await routeRequest(
    ctx.api,
    request.id,
    attachments.map((a) => ({ chatId: a.chatId, messageId: a.messageId }))
  );
}
