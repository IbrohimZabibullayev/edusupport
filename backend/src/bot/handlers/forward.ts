import { InlineKeyboard } from "grammy";
import { Message } from "grammy/types";
import { prisma } from "../../db";
import { escapeHtml, ticketId } from "../../util";
import { FWD_CANCEL, fwdModuleKeyboard, fwdSchoolKeyboard, fwdSystemKeyboard, fwdTypeKeyboard } from "../keyboards";
import { clientKeyOf, findClientSource, rememberClient } from "../services/clients";
import { draftDescription, extractMedia } from "../services/content";
import { createRequestFromDraft } from "../services/createRequest";
import { guessFromText } from "../services/guess";
import { getActiveModules, moduleLabel } from "../services/modules";
import { deliveryLine, notifyAdmins } from "../services/notify";
import { getActiveRequestTypes, requestTypeLabelByKey } from "../services/requestTypes";
import { createSchool, popularSchools, schoolCandidates } from "../services/schools";
import { getActiveSystems } from "../services/systems";
import { MyContext, RequestDraft, Step } from "../types";
import { requireApprovedOperator } from "./registration";

/** Forward oqimining bosqichlari — shu holatlarda kelgan yangi forward mavjud qoralamaga qo'shiladi */
const FWD_STEPS: Step[] = [
  "fwd_collect",
  "fwd_system",
  "fwd_type",
  "fwd_module",
  "fwd_school",
  "fwd_school_text",
  "fwd_school_confirm",
];

/**
 * Shuncha vaqtdan keyin qoralama "tashlab ketilgan" hisoblanadi va yangi forward
 * unga qo'shilmay, yangi so'rov boshlaydi. Albom/ketma-ket xabarlar soniyalar
 * ichida keladi, shuning uchun bu chegara ularga xalaqit qilmaydi.
 */
const DRAFT_TTL_MS = 5 * 60_000;

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
 *
 * Avval hamma xabar yig'iladi ("Davom etish" bosilgunicha), keyingina savollar
 * beriladi — shunda taxminlar to'liq matn asosida ishlaydi va operator
 * qo'shimcha yozishga ulguradi.
 */
export async function handleForward(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  const msg = ctx.message;
  if (!msg) return;

  // Yig'ish davom etayotgan bo'lsa — o'sha qoralamaga qo'shamiz.
  // TTL yarim tashlab ketilgan eski qoralama yangi murojaatni yutmasligi uchun.
  const current = ctx.session.draft;
  if (inForwardFlow(ctx.session.step) && current && Date.now() - (current.lastAt ?? 0) < DRAFT_TTL_MS) {
    if (!collect(current, msg)) return;
    current.lastAt = Date.now();
    ctx.session.draft = current;
    if (ctx.session.step === "fwd_collect") return askMore(ctx, current);
    return continueFlow(ctx, current);
  }

  const draft: RequestDraft = { lastAt: Date.now() };
  if (!collect(draft, msg)) {
    await ctx.reply("Bu turdagi xabarni qabul qila olmayman. Matn, rasm, video yoki fayl yuboring.");
    return;
  }

  // Mijozni eslab qolamiz — maktab taxmini shundan chiqadi.
  // Forward manbasi yashirin bo'lsa client null bo'ladi, o'shanda taxmin ham bo'lmaydi.
  const client = clientKeyOf(msg);
  if (client) {
    draft.clientKey = client.key;
    draft.clientLabel = client.label;
  }

  ctx.session.draft = draft;
  await askMore(ctx, draft);
}

/** Yig'ish bosqichi: yana forward yoki matn kutamiz, "Davom etish" bosilishi kerak */
async function askMore(ctx: MyContext, draft: RequestDraft): Promise<void> {
  ctx.session.step = "fwd_collect";
  await showPrompt(
    ctx,
    draft,
    [
      promptHeader(draft),
      "",
      "Yana qo'shimcha bormi? Xabar forward qiling yoki shu yerga yozing.",
      "Tugagan bo'lsa — <b>Davom etish</b>.",
    ].join("\n"),
    new InlineKeyboard().text("▶️ Davom etish", "fwd:more").row().text(FWD_CANCEL, "fwd:cancel")
  );
}

/** Yig'ish bosqichida operator qo'shimcha matn yozsa */
export async function handleCollectText(ctx: MyContext, text: string): Promise<void> {
  const draft = ctx.session.draft;
  if (!draft) {
    ctx.session.step = "idle";
    return;
  }
  draft.descTexts = [...(draft.descTexts ?? []), text];
  draft.lastAt = Date.now();
  ctx.session.draft = draft;
  await askMore(ctx, draft);
}

/** "Davom etish" — yig'ish tugadi, endi taxmin qilib savollarga o'tamiz */
export async function handleCollectDone(ctx: MyContext): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  await ctx.answerCallbackQuery();

  // Maktab — shu mijozdan avval xabar kelgan bo'lsa taxmin qilamiz (tasdiqlanmagan)
  if (draft.clientKey && draft.schoolId === undefined) {
    const source = await findClientSource(draft.clientKey);
    if (source) draft.schoolId = source.schoolId;
  }
  // So'rov turi matndan; topilmasa mijozning oxirgi turidan
  if (!draft.type) {
    const guess = await guessFromText(draftDescription(draft.descTexts ?? [], draft.attachments ?? []));
    if (guess.typeKey) draft.type = guess.typeKey;
    else if (draft.clientKey) {
      const source = await findClientSource(draft.clientKey);
      draft.type = source?.lastTypeKey ?? undefined;
    }
  }
  ctx.session.draft = draft;
  await continueFlow(ctx, draft);
}

/**
 * Savollar tartibi: maktab → tizim → modul.
 * So'rov turi matndan taxmin qilinadi va faqat topilmasa so'raladi.
 */
export async function continueFlow(ctx: MyContext, draft: RequestDraft): Promise<void> {
  if (!draft.schoolConfirmed) return askSchool(ctx, draft);
  if (!draft.systemId) return askSystem(ctx, draft);
  if (!draft.moduleId) return askModule(ctx, draft);
  if (!draft.type) return askType(ctx, draft);
  return submitForward(ctx, draft);
}

/* ---------- So'rov turi ---------- */

/** Har savolning tepasida turadigan sarlavha — yangi forward qo'shilgani shundan bilinadi */
function promptHeader(draft: RequestDraft): string {
  return `📥 <b>Mijoz xabari qabul qilindi</b> (${collectedCount(draft)} ta)`;
}

async function askType(ctx: MyContext, draft: RequestDraft): Promise<void> {
  ctx.session.step = "fwd_type";
  await showPrompt(
    ctx,
    draft,
    `${promptHeader(draft)}\n\nSo'rov turini tanlang:`,
    fwdTypeKeyboard(await getActiveRequestTypes())
  );
}

/* ---------- Tizim ---------- */

async function askSystem(ctx: MyContext, draft: RequestDraft): Promise<void> {
  const systems = await getActiveSystems();
  // Tizim bitta bo'lsa so'rashning ma'nosi yo'q
  if (systems.length === 1) {
    draft.systemId = systems[0].id;
    ctx.session.draft = draft;
    return continueFlow(ctx, draft);
  }
  if (systems.length === 0) {
    draft.systemId = -1; // tizim yo'q — savolni o'tkazib yuboramiz
    ctx.session.draft = draft;
    return continueFlow(ctx, draft);
  }
  ctx.session.step = "fwd_system";
  await showPrompt(ctx, draft, `${promptHeader(draft)}\n\nQaysi tizim bo'yicha?`, fwdSystemKeyboard(systems));
}

/* ---------- Modul ---------- */

async function askModule(ctx: MyContext, draft: RequestDraft): Promise<void> {
  ctx.session.step = "fwd_module";
  await showPrompt(
    ctx,
    draft,
    `${promptHeader(draft)}\n\nQaysi modulga tegishli?`,
    fwdModuleKeyboard(await getActiveModules())
  );
}

/* ---------- Maktab ---------- */

/**
 * Maktab har safar tasdiqlanadi. Mijoz tanish bo'lsa taxmin ko'rsatiladi
 * ("Bu Najot Ta'limmi?"), aks holda oxirgi ishlatilgan maktablar ro'yxati.
 */
async function askSchool(ctx: MyContext, draft: RequestDraft): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  if (draft.schoolId !== undefined) {
    const guess = await prisma.school.findUnique({ where: { id: draft.schoolId } });
    if (guess) {
      ctx.session.step = "fwd_school";
      await showPrompt(
        ctx,
        draft,
        [
          promptHeader(draft),
          draft.clientLabel ? `👤 Kimdan: ${escapeHtml(draft.clientLabel)}` : "",
          "",
          `Bu <b>${escapeHtml(guess.name)}</b>mi?`,
        ]
          .filter(Boolean)
          .join("\n"),
        new InlineKeyboard()
          .text(`✅ Ha, ${guess.name}`, `fwd:school:${guess.id}`)
          .row()
          .text("🔄 Boshqa maktab", "fwd:otherschool")
          .row()
          .text(FWD_CANCEL, "fwd:cancel")
      );
      return;
    }
    draft.schoolId = undefined;
  }

  const recent = await recentSchools(op.id);
  if (recent.length === 0) {
    ctx.session.step = "fwd_school_text";
    await showPrompt(ctx, draft, `${promptHeader(draft)}\n\nMaktab/muassasa nomini yozing:`);
    return;
  }
  ctx.session.step = "fwd_school";
  await showPrompt(
    ctx,
    draft,
    `${promptHeader(draft)}\n\nQaysi maktab?\n<i>Ro'yxatda bo'lmasa — nomini shunchaki yozing.</i>`,
    fwdSchoolKeyboard(recent)
  );
}

/** "Boshqa maktab" — taxminni rad etib ro'yxatga o'tamiz */
export async function handleOtherSchool(ctx: MyContext): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  draft.schoolId = undefined;
  ctx.session.draft = draft;
  await ctx.answerCallbackQuery();
  await askSchool(ctx, draft);
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

export async function handleFwdSystem(ctx: MyContext, systemId: number): Promise<void> {
  const draft = await activeDraft(ctx);
  if (!draft) return;
  draft.systemId = systemId;
  ctx.session.draft = draft;
  await ctx.answerCallbackQuery();
  await continueFlow(ctx, draft);
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
  draft.schoolConfirmed = true;
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
  draft.schoolConfirmed = true;
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
  draft.schoolConfirmed = true;
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

  // Bot hech qachon o'zi tanlamaydi — aynan mos kelsa ham ro'yxat ko'rsatiladi.
  // Topilmasa esa yangi maktab jimgina ochilmaydi.
  const found = await schoolCandidates(text);
  const own = await recentSchools(op.id);
  const options = found.length > 0 ? found : own.length > 0 ? own : await popularSchools(6);

  draft.pendingSchoolName = text;
  draft.similarSchoolIds = options.map((s) => s.id);
  draft.promptMessageId = undefined; // yangi xabar bilan so'raymiz
  ctx.session.draft = draft;
  ctx.session.step = "fwd_school_confirm";

  const kb = new InlineKeyboard();
  for (const s of options) kb.text(s.name, `fwd:samesch:${s.id}`).row();
  kb.text(`➕ Yangi: ${text}`, "fwd:newsch");

  await ctx.reply(
    found.length > 0
      ? [`Siz yozdingiz: <b>${escapeHtml(text)}</b>`, "", "Shulardan birimi yoki yangimi?"].join("\n")
      : [`<b>${escapeHtml(text)}</b> bazada topilmadi.`, "", "Yangi qilib qo'shaymi yoki quyidagilardan birimi?"].join("\n"),
    { parse_mode: "HTML", reply_markup: kb }
  );
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
    deliveryLine(request.ticketNumber, request.delivery),
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
