import { Message } from "grammy/types";
import { prisma } from "../../db";
import { escapeHtml, ticketId } from "../../util";
import { fwdModuleKeyboard, fwdSchoolKeyboard, fwdSystemKeyboard, fwdTypeKeyboard } from "../keyboards";
import { extractMedia } from "../services/content";
import { createRequestFromDraft } from "../services/createRequest";
import { getActiveModules, moduleLabel } from "../services/modules";
import { notifyAdmins } from "../services/notify";
import { getActiveRequestTypes, requestTypeLabelByKey } from "../services/requestTypes";
import { getActiveSystems } from "../services/systems";
import { MyContext, RequestDraft, Step } from "../types";
import { requireApprovedOperator } from "./registration";

/** Forward oqimining bosqichlari — shu holatlarda kelgan yangi forward mavjud qoralamaga qo'shiladi */
const FWD_STEPS: Step[] = ["fwd_type", "fwd_module", "fwd_school", "fwd_school_text"];

export function isForwarded(msg: Message): boolean {
  return msg.forward_origin !== undefined;
}

export function inForwardFlow(step: Step): boolean {
  return FWD_STEPS.includes(step);
}

/** Forward qilingan xabar mazmunini qoralamaga qo'shadi; qo'shilsa true */
function collect(draft: RequestDraft, msg: Message): boolean {
  const media = extractMedia(msg);
  if (media) {
    draft.attachments = [
      ...(draft.attachments ?? []),
      { ...media, caption: msg.caption, chatId: msg.chat.id, messageId: msg.message_id },
    ];
    return true;
  }
  const text = msg.text?.trim();
  if (text) {
    draft.descTexts = [...(draft.descTexts ?? []), text];
    return true;
  }
  return false;
}

function collectedCount(draft: RequestDraft): number {
  return (draft.descTexts?.length ?? 0) + (draft.attachments?.length ?? 0);
}

/** Birinchi ekran: nechta xabar yig'ilgani, tanlangan tizim va so'rov turi tugmalari */
async function typePrompt(draft: RequestDraft): Promise<{ text: string; systems: { id: number; name: string }[] }> {
  const systems = await getActiveSystems();
  const system = systems.find((s) => s.id === draft.systemId);
  return {
    text: [
      `📥 <b>Mijoz xabari qabul qilindi</b> (${collectedCount(draft)} ta)`,
      `🖥 Tizim: ${system ? escapeHtml(system.name) : "belgilanmagan"}`,
      "",
      "So'rov turini tanlang:",
    ].join("\n"),
    systems,
  };
}

/**
 * Operator mijoz xabarini botga forward qilganda ishlaydi.
 * Yangi oqim boshlanadi yoki davom etayotgan oqimga qo'shiladi.
 */
export async function handleForward(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  const msg = ctx.message;
  if (!msg) return;

  // Oqim allaqachon boshlangan (albom yoki ketma-ket bir nechta xabar) — qoralamaga qo'shamiz
  if (inForwardFlow(ctx.session.step) && ctx.session.draft) {
    const draft = ctx.session.draft;
    if (!collect(draft, msg)) return;
    ctx.session.draft = draft;
    // Faqat birinchi ekranda hisobni yangilab turamiz
    if (ctx.session.step === "fwd_type" && draft.promptMessageId) {
      const { text, systems } = await typePrompt(draft);
      try {
        await ctx.api.editMessageText(msg.chat.id, draft.promptMessageId, text, {
          parse_mode: "HTML",
          reply_markup: fwdTypeKeyboard(await getActiveRequestTypes(), systems.length > 0),
        });
      } catch {
        // xabar o'zgarmagan bo'lishi mumkin — muhim emas
      }
    }
    return;
  }

  const draft: RequestDraft = {};
  if (!collect(draft, msg)) {
    await ctx.reply("Bu turdagi xabarni qabul qila olmayman. Matn, rasm, video yoki fayl yuboring.");
    return;
  }

  // Tizim oxirgi so'rovdan olinadi — operator kerak bo'lsa tugma orqali almashtiradi
  const last = await prisma.request.findFirst({
    where: { operatorId: op.id, NOT: { systemId: null } },
    orderBy: { id: "desc" },
    select: { systemId: true },
  });
  draft.systemId = last?.systemId ?? undefined;

  const { text, systems } = await typePrompt(draft);
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: fwdTypeKeyboard(await getActiveRequestTypes(), systems.length > 0),
  });

  draft.promptMessageId = sent.message_id;
  ctx.session.draft = draft;
  ctx.session.step = "fwd_type";
}

/** Oqimning joriy qoralamasi; yo'q bo'lsa foydalanuvchiga aytadi va null qaytaradi */
async function activeDraft(ctx: MyContext): Promise<RequestDraft | null> {
  const draft = ctx.session.draft;
  if (!draft || !inForwardFlow(ctx.session.step)) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov allaqachon yakunlangan", show_alert: true });
    return null;
  }
  return draft;
}

export async function handleFwdSystemMenu(ctx: MyContext): Promise<void> {
  if (!(await activeDraft(ctx))) return;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Qaysi tizim bo'yicha so'rov?", {
    reply_markup: fwdSystemKeyboard(await getActiveSystems()),
  });
}

export async function handleFwdSystem(ctx: MyContext, systemId: number): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  draft.systemId = systemId;
  ctx.session.draft = draft;
  await ctx.answerCallbackQuery();
  const { text, systems } = await typePrompt(draft);
  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: fwdTypeKeyboard(await getActiveRequestTypes(), systems.length > 0),
  });
}

export async function handleFwdType(ctx: MyContext, key: string): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  draft.type = key;
  ctx.session.draft = draft;
  ctx.session.step = "fwd_module";
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Qaysi modulga tegishli?", {
    reply_markup: fwdModuleKeyboard(await getActiveModules()),
  });
}

export async function handleFwdModule(ctx: MyContext, moduleId: number): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  draft.moduleId = moduleId;
  ctx.session.draft = draft;
  ctx.session.step = "fwd_school";
  await ctx.answerCallbackQuery();

  const op = await requireApprovedOperator(ctx);
  const recent = op ? await recentSchools(op.id) : [];
  if (recent.length === 0) {
    ctx.session.step = "fwd_school_text";
    await ctx.editMessageText("Maktab/muassasa nomini yozing:");
    return;
  }
  await ctx.editMessageText("Qaysi maktab?", { reply_markup: fwdSchoolKeyboard(recent) });
}

/** Operator oxirgi so'rovlarida ishlatgan maktablar (takrorlanmas, eng ko'pi 6 ta) */
async function recentSchools(operatorId: number): Promise<{ id: number; name: string }[]> {
  const rows = await prisma.request.findMany({
    where: { operatorId },
    orderBy: { id: "desc" },
    take: 40,
    select: { school: { select: { id: true, name: true } } },
  });
  const seen = new Map<number, string>();
  for (const r of rows) {
    if (!seen.has(r.school.id)) seen.set(r.school.id, r.school.name);
    if (seen.size >= 6) break;
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

export async function handleFwdSchoolNew(ctx: MyContext): Promise<void> {
  if (!(await activeDraft(ctx))) return;
  ctx.session.step = "fwd_school_text";
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Maktab/muassasa nomini yozing:");
}

export async function handleFwdSchool(ctx: MyContext, schoolId: number): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  draft.schoolId = schoolId;
  ctx.session.draft = draft;
  await ctx.answerCallbackQuery();
  await submitForward(ctx, draft);
}

/** Maktab nomi qo'lda yozilganda (fwd_school_text bosqichi) */
export async function handleFwdSchoolText(ctx: MyContext, text: string): Promise<void> {
  const draft = ctx.session.draft;
  if (!draft) {
    ctx.session.step = "idle";
    return;
  }
  if (text.length < 3) {
    await ctx.reply("Maktab nomi juda qisqa — kamida 3 harf yozing.");
    return;
  }
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  let school = await prisma.school.findFirst({ where: { name: { equals: text, mode: "insensitive" } } });
  if (!school) {
    school = await prisma.school.create({ data: { name: text, createdByOperatorId: op.id } });
    await notifyAdmins(
      ctx.api,
      `🏫 <b>Yangi maktab qo'shildi:</b> ${escapeHtml(school.name)}\n👤 Operator: ${escapeHtml(op.fullName)}`
    );
  }
  draft.schoolId = school.id;
  ctx.session.draft = draft;
  await submitForward(ctx, draft);
}

async function submitForward(ctx: MyContext, draft: RequestDraft): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  if (!draft.type || !draft.moduleId || !draft.schoolId) {
    ctx.session.step = "idle";
    ctx.session.draft = undefined;
    await ctx.reply("Nimadir xato ketdi. Xabarni qaytadan forward qiling.");
    return;
  }

  const request = await createRequestFromDraft(ctx.api, op, draft);
  const attachments = draft.attachments ?? [];
  ctx.session.step = "idle";
  ctx.session.draft = undefined;

  const lines = [
    `✅ Yuborildi! Ticket: <code>${ticketId(request.ticketNumber)}</code>`,
    "",
    `Turi: ${escapeHtml(await requestTypeLabelByKey(request.type))}`,
    ...(request.system ? [`Tizim: ${escapeHtml(request.system.name)}`] : []),
    `Modul: ${escapeHtml(moduleLabel(request.module))}`,
    `Maktab: ${escapeHtml(request.school.name)}`,
    ...(attachments.length > 0 ? [`📎 Biriktirilgan fayllar: ${attachments.length} ta`] : []),
  ].join("\n");

  // Tugmali xabarni natijaga almashtiramiz; qo'lda yozilgan bosqichda tahrirlab bo'lmaydi
  if (draft.promptMessageId && ctx.chat) {
    try {
      await ctx.api.editMessageText(ctx.chat.id, draft.promptMessageId, lines, { parse_mode: "HTML" });
      return;
    } catch {
      // eski xabarni tahrirlash imkoni bo'lmasa yangisini yuboramiz
    }
  }
  await ctx.reply(lines, { parse_mode: "HTML" });
}

export async function cancelForward(ctx: MyContext): Promise<void> {
  ctx.session.step = "idle";
  ctx.session.draft = undefined;
  await ctx.answerCallbackQuery();
  try {
    await ctx.editMessageText("❌ Bekor qilindi.");
  } catch {
    // xabar allaqachon o'zgargan bo'lishi mumkin
  }
}
