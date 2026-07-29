import { escapeHtml, ticketId } from "../../util";
import {
  backCancelKeyboard,
  buildModuleKeyboard,
  buildSystemKeyboard,
  buildTypeKeyboard,
  mainMenu,
} from "../keyboards";
import { extractMedia } from "../services/content";
import { createRequestFromDraft } from "../services/createRequest";
import { getActiveModules, moduleLabel } from "../services/modules";
import { deliveryLine } from "../services/notify";
import { getActiveSystems } from "../services/systems";
import { getActiveRequestTypes, requestTypeLabel, requestTypeLabelByKey } from "../services/requestTypes";
import { BTN_BACK, BTN_CANCEL, BTN_SUBMIT } from "../texts";
import { MyContext } from "../types";

import { requireApprovedOperator } from "./registration";
import { resolveSchoolOrAsk } from "./schoolPick";

const ASK_SYSTEM = "Qaysi tizim bo'yicha so'rov? Tanlang:";
const ASK_TYPE = "So'rov turini tanlang:";
const ASK_MODULE = "Qaysi modulga tegishli?";
const ASK_SCHOOL = "Maktab/muassasa nomini yozing:";

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
    await ctx.reply(ASK_TYPE, { reply_markup: buildTypeKeyboard(await getActiveRequestTypes()) });
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
  await ctx.reply(ASK_TYPE, { reply_markup: buildTypeKeyboard(await getActiveRequestTypes()) });
}

async function cancelWizard(ctx: MyContext): Promise<void> {
  ctx.session.step = "idle";
  ctx.session.draft = undefined;
  await ctx.reply("❌ So'rov kiritish bekor qilindi.", { reply_markup: mainMenu });
}

export async function handleTypeStep(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancelWizard(ctx);
  if (text === BTN_BACK) return startWizard(ctx);
  const types = await getActiveRequestTypes();
  const chosen = types.find((t) => requestTypeLabel(t) === text);
  if (!chosen) {
    await ctx.reply("Iltimos, pastdagi tugmalardan birini tanlang.", { reply_markup: buildTypeKeyboard(types) });
    return;
  }
  ctx.session.draft = { ...ctx.session.draft, type: chosen.key };
  ctx.session.step = "req_module";
  await ctx.reply(ASK_MODULE, { reply_markup: buildModuleKeyboard(await getActiveModules()) });
}

export async function handleModuleStep(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancelWizard(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "req_type";
    await ctx.reply(ASK_TYPE, { reply_markup: buildTypeKeyboard(await getActiveRequestTypes()) });
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
  // Dublikat himoyasi umumiy bosqichda — oqim shu yerdan davom etadi
  await resolveSchoolOrAsk(ctx, text, "req");
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

  const media = extractMedia(msg);
  if (!media) return;

  const draft = ctx.session.draft ?? {};
  draft.attachments = [
    ...(draft.attachments ?? []),
    { ...media, caption: msg.caption, chatId: msg.chat.id, messageId: msg.message_id },
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

  const request = await createRequestFromDraft(ctx.api, op, draft);

  ctx.session.step = "idle";
  ctx.session.draft = undefined;

  const typeLabel = await requestTypeLabelByKey(request.type);
  await ctx.reply(
    [
      deliveryLine(request.ticketNumber, request.delivery),
      "",
      `Turi: ${escapeHtml(typeLabel)}`,
      `Modul: ${escapeHtml(moduleLabel(request.module))}`,
      `Maktab: ${escapeHtml(request.school.name)}`,
      ...(attachments.length > 0 ? [`📎 Biriktirilgan fayllar: ${attachments.length} ta`] : []),
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: mainMenu }
  );
}
