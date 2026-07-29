import { InlineKeyboard } from "grammy";
import { Message } from "grammy/types";
import { prisma } from "../../db";
import { escapeHtml, ticketId } from "../../util";
import { fwdModuleKeyboard, fwdSchoolKeyboard, fwdSystemKeyboard, fwdTypeKeyboard } from "../keyboards";
import { clientKeyOf, findClientSource, rememberClient } from "../services/clients";
import { draftDescription, extractMedia } from "../services/content";
import { createRequestFromDraft } from "../services/createRequest";
import { guessFromText } from "../services/guess";
import { getActiveModules, moduleLabel } from "../services/modules";
import { notifyAdmins } from "../services/notify";
import { getActiveRequestTypes, requestTypeLabelByKey } from "../services/requestTypes";
import { createSchool, matchSchool } from "../services/schools";
import { getActiveSystems } from "../services/systems";
import { MyContext, RequestDraft, Step } from "../types";
import { requireApprovedOperator } from "./registration";

/** Forward oqimining bosqichlari — shu holatlarda kelgan yangi forward mavjud qoralamaga qo'shiladi */
const FWD_STEPS: Step[] = ["fwd_type", "fwd_module", "fwd_school", "fwd_school_text", "fwd_school_confirm"];

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

/**
 * Operator mijoz xabarini botga forward qilganda ishlaydi.
 * Maktab mijoz chatidan, tur va modul matndan taxmin qilinadi —
 * hammasi ma'lum bo'lsa so'rov hech narsa so'ramasdan yuboriladi.
 */
export async function handleForward(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  const msg = ctx.message;
  if (!msg) return;

  // Ketma-ket kelgan forwardlar (albom yoki bir necha xabar) — bitta qoralamaga
  if (inForwardFlow(ctx.session.step) && ctx.session.draft) {
    const draft = ctx.session.draft;
    if (!collect(draft, msg)) return;
    ctx.session.draft = draft;
    if (ctx.session.step === "fwd_type" && draft.promptMessageId) {
      await editTypePrompt(ctx, draft, msg.chat.id);
    }
    return;
  }

  const draft: RequestDraft = {};
  if (!collect(draft, msg)) {
    await ctx.reply("Bu turdagi xabarni qabul qila olmayman. Matn, rasm, video yoki fayl yuboring.");
    return;
  }

  // Tizim — operatorning oxirgi so'rovidan
  const last = await prisma.request.findFirst({
    where: { operatorId: op.id, NOT: { systemId: null } },
    orderBy: { id: "desc" },
    select: { systemId: true },
  });
  draft.systemId = last?.systemId ?? undefined;

  // Maktab — shu mijozdan avval xabar kelgan bo'lsa o'sha
  const client = clientKeyOf(msg);
  if (client) {
    draft.clientKey = client.key;
    draft.clientLabel = client.label;
    const source = await findClientSource(client.key);
    if (source) {
      draft.schoolId = source.schoolId;
      draft.type = source.lastTypeKey ?? undefined;
      draft.moduleId = source.lastModuleId ?? undefined;
    }
  }

  // Tur va modul — matndan (mijoz xotirasidan ustun)
  const guess = await guessFromText(draftDescription(draft.descTexts ?? [], draft.attachments ?? []));
  if (guess.typeKey) draft.type = guess.typeKey;
  if (guess.moduleId) draft.moduleId = guess.moduleId;

  ctx.session.draft = draft;
  await continueFlow(ctx, draft);
}

/**
 * Yetishmagan birinchi maydonni so'raydi; hammasi to'liq bo'lsa yuboradi.
 * Har javobdan keyin qayta chaqiriladi.
 */
export async function continueFlow(ctx: MyContext, draft: RequestDraft): Promise<void> {
  if (!draft.type) return askType(ctx, draft);
  if (!draft.moduleId) return askModule(ctx, draft);
  if (!draft.schoolId) return askSchool(ctx, draft);
  return submitForward(ctx, draft);
}

/* ---------- So'rov turi ---------- */

async function typePromptText(draft: RequestDraft): Promise<string> {
  const systems = await getActiveSystems();
  const system = systems.find((s) => s.id === draft.systemId);
  return [
    `📥 <b>Mijoz xabari qabul qilindi</b> (${collectedCount(draft)} ta)`,
    `🖥 Tizim: ${system ? escapeHtml(system.name) : "belgilanmagan"}`,
    "",
    "So'rov turini tanlang:",
  ].join("\n");
}

async function askType(ctx: MyContext, draft: RequestDraft): Promise<void> {
  ctx.session.step = "fwd_type";
  const kb = fwdTypeKeyboard(await getActiveRequestTypes(), (await getActiveSystems()).length > 0);
  const text = await typePromptText(draft);
  if (draft.promptMessageId && ctx.chat) {
    await ctx.api
      .editMessageText(ctx.chat.id, draft.promptMessageId, text, { parse_mode: "HTML", reply_markup: kb })
      .catch(() => undefined);
    return;
  }
  const sent = await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  draft.promptMessageId = sent.message_id;
  ctx.session.draft = draft;
}

async function editTypePrompt(ctx: MyContext, draft: RequestDraft, chatId: number): Promise<void> {
  try {
    await ctx.api.editMessageText(chatId, draft.promptMessageId!, await typePromptText(draft), {
      parse_mode: "HTML",
      reply_markup: fwdTypeKeyboard(await getActiveRequestTypes(), (await getActiveSystems()).length > 0),
    });
  } catch {
    // xabar o'zgarmagan bo'lishi mumkin
  }
}

/* ---------- Modul ---------- */

async function askModule(ctx: MyContext, draft: RequestDraft): Promise<void> {
  ctx.session.step = "fwd_module";
  await showPrompt(ctx, draft, "Qaysi modulga tegishli?", fwdModuleKeyboard(await getActiveModules()));
}

/* ---------- Maktab ---------- */

async function askSchool(ctx: MyContext, draft: RequestDraft): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  const recent = op ? await recentSchools(op.id) : [];
  if (recent.length === 0) {
    ctx.session.step = "fwd_school_text";
    await showPrompt(ctx, draft, "Maktab/muassasa nomini yozing:");
    return;
  }
  ctx.session.step = "fwd_school";
  await showPrompt(ctx, draft, "Qaysi maktab?\n<i>Ro'yxatda bo'lmasa — nomini shunchaki yozing.</i>", fwdSchoolKeyboard(recent));
}

/**
 * Tugma kutilayotgan bosqichda matn yozilsa — qoralamani yo'qotmaymiz,
 * shunchaki tugmani bosish kerakligini aytamiz.
 */
export async function remindToUseButtons(ctx: MyContext): Promise<void> {
  await ctx.reply("Yuqoridagi xabardagi tugmalardan birini tanlang.");
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

/** Savolni ko'rsatadi: oldingi savol xabari bo'lsa uni tahrirlaydi, bo'lmasa yangisini yuboradi */
async function showPrompt(
  ctx: MyContext,
  draft: RequestDraft,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  if (draft.promptMessageId && ctx.chat) {
    const ok = await ctx.api
      .editMessageText(ctx.chat.id, draft.promptMessageId, text, { parse_mode: "HTML", reply_markup: keyboard })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
  }
  const sent = await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  draft.promptMessageId = sent.message_id;
  ctx.session.draft = draft;
}

/* ---------- Tugma javoblari ---------- */

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
  await askType(ctx, draft);
}

export async function handleFwdType(ctx: MyContext, key: string): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  draft.type = key;
  ctx.session.draft = draft;
  await ctx.answerCallbackQuery();
  await continueFlow(ctx, draft);
}

export async function handleFwdModule(ctx: MyContext, moduleId: number): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  draft.moduleId = moduleId;
  ctx.session.draft = draft;
  await ctx.answerCallbackQuery();
  await continueFlow(ctx, draft);
}

export async function handleFwdSchoolNew(ctx: MyContext): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
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
  await continueFlow(ctx, draft);
}

/** Tasdiq xabarining o'zini keyingi savol/natija uchun ishlatamiz */
function reusePromptMessage(ctx: MyContext, draft: RequestDraft): void {
  const id = ctx.callbackQuery?.message?.message_id;
  if (id) draft.promptMessageId = id;
}

/** "Shu maktabmi?" — taklif qilingan maktablardan biri tanlandi */
export async function handleSchoolSame(ctx: MyContext, schoolId: number): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft?.similarSchoolIds?.includes(schoolId)) return;
  reusePromptMessage(ctx, draft);
  draft.schoolId = schoolId;
  draft.similarSchoolIds = undefined;
  draft.pendingSchoolName = undefined;
  ctx.session.draft = draft;
  await ctx.answerCallbackQuery();
  await continueFlow(ctx, draft);
}

/** "Shu maktabmi?" — yo'q, yangi qo'shilsin */
export async function handleSchoolNewAnyway(ctx: MyContext): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft?.pendingSchoolName) return;
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  reusePromptMessage(ctx, draft);
  const school = await createSchool(draft.pendingSchoolName, op.id);
  await notifyAdmins(
    ctx.api,
    `🏫 <b>Yangi maktab qo'shildi:</b> ${escapeHtml(school.name)}\n👤 Operator: ${escapeHtml(op.fullName)}`
  );
  draft.schoolId = school.id;
  draft.similarSchoolIds = undefined;
  draft.pendingSchoolName = undefined;
  ctx.session.draft = draft;
  await ctx.answerCallbackQuery();
  await continueFlow(ctx, draft);
}

/** Maktab nomi qo'lda yozilganda */
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

  const match = await matchSchool(text);
  if (match.kind === "exact") {
    draft.schoolId = match.school.id;
    ctx.session.draft = draft;
    await continueFlow(ctx, draft);
    return;
  }
  if (match.kind === "similar") {
    // Dublikat yaratmaslik uchun avval so'raymiz
    draft.pendingSchoolName = text;
    draft.similarSchoolIds = match.schools.map((s) => s.id);
    draft.promptMessageId = undefined; // yangi xabar bilan so'raymiz
    ctx.session.draft = draft;
    ctx.session.step = "fwd_school_confirm";
    const kb = new InlineKeyboard();
    for (const s of match.schools) kb.text(`✅ ${s.name}`, `fwd:samesch:${s.id}`).row();
    kb.text(`➕ Yangi maktab: ${text}`, "fwd:newsch");
    await ctx.reply(
      [
        `Siz yozdingiz: <b>${escapeHtml(text)}</b>`,
        "",
        match.schools.length > 1
          ? "Bazada shunga o'xshash maktablar bor. Qaysi biri?"
          : "Bazada shunga o'xshash maktab bor. Shumi?",
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
    return;
  }

  const school = await createSchool(text, op.id);
  await notifyAdmins(
    ctx.api,
    `🏫 <b>Yangi maktab qo'shildi:</b> ${escapeHtml(school.name)}\n👤 Operator: ${escapeHtml(op.fullName)}`
  );
  draft.schoolId = school.id;
  ctx.session.draft = draft;
  await continueFlow(ctx, draft);
}

/* ---------- Yuborish ---------- */

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

  if (draft.clientKey) {
    await rememberClient(draft.clientKey, draft.clientLabel ?? "", draft.schoolId, draft.type, draft.moduleId);
  }

  const promptId = draft.promptMessageId;
  ctx.session.step = "idle";
  ctx.session.draft = undefined;

  const lines = [
    `✅ <b>${ticketId(request.ticketNumber)}</b> guruhga yuborildi`,
    "",
    `${escapeHtml(await requestTypeLabelByKey(request.type))} · ${escapeHtml(moduleLabel(request.module))}`,
    `🏫 ${escapeHtml(request.school.name)}`,
    ...(request.system ? [`🖥 ${escapeHtml(request.system.name)}`] : []),
    ...(attachments.length > 0 ? [`📎 ${attachments.length} ta fayl`] : []),
  ].join("\n");
  const kb = new InlineKeyboard().text("✏️ Tuzatish", `fx:menu:${request.id}`);

  if (promptId && ctx.chat) {
    const ok = await ctx.api
      .editMessageText(ctx.chat.id, promptId, lines, { parse_mode: "HTML", reply_markup: kb })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
  }
  await ctx.reply(lines, { parse_mode: "HTML", reply_markup: kb });
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
