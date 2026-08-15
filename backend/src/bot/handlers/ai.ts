import { InlineKeyboard } from "grammy";
import { Message } from "grammy/types";
import { AiTurn, runAgent } from "../../ai/agent";
import { aiEnabled } from "../../ai/client";
import { Pending, PendingUpdate, submitPending, submitPendingMessage, submitPendingUpdate } from "../../ai/tools";
import { isNeutralTurn } from "../../ai/types";
import { prisma } from "../../db";
import { escapeHtml, formatTashkentDate, ticketId } from "../../util";
import { menu } from "../keyboards";
import { clientKeyOf, findClientSource } from "../services/clients";
import {
  formatGroupContext,
  isAssistantMessage,
  recentGroupMessages,
  rememberAssistantMessage,
} from "../services/groupLog";
import { deliveryLine } from "../services/notify";
import { sendCard } from "../services/sendCard";
import { persistSession } from "../session";
import { extractMedia } from "../services/content";
import { MyContext } from "../types";
import { getOperator, requireApprovedOperator } from "./registration";

/**
 * Assistent rejimi: operator oddiy xabar yozadi, bot o'zi tushunib ish qiladi.
 *
 * Forward qilingan xabarlar darhol AI ga berilmaydi — avval yig'iladi, chunki
 * mijoz murojaati bir necha xabar bo'lishi mumkin. Operator o'z gapini yozganda
 * (yoki qisqa tanaffusdan keyin) hammasi birga yuboriladi.
 */

/** Shuncha vaqtdan keyin suhbat tarixi tashlab yuboriladi */
const HISTORY_TTL_MS = 30 * 60_000;
/** Tarix cheksiz o'smasin — oxirgi navbatlar yetarli */
const MAX_HISTORY = 20;

/**
 * Forward yig'ilgandan keyin shuncha kutamiz, keyin o'zi ishga tushadi.
 * Operator ketma-ket bir necha xabar tashlashi mumkin — har yangi xabar
 * hisoblagichni qaytadan boshlaydi, shuning uchun hammasi birga ketadi.
 */
const COLLECT_MS = 4000;

const pending = new Map<number, NodeJS.Timeout>();

export function aiAvailable(): boolean {
  return aiEnabled();
}

function freshHistory(ctx: MyContext): AiTurn[] {
  const ai = ctx.session.ai;
  if (!ai || Date.now() - ai.lastAt > HISTORY_TTL_MS) return [];
  // Provayder almashtirilgan bo'lsa sessiyada eski formatdagi tarix qolishi
  // mumkin — uni modelga yuborsak so'rov 400 bilan yiqiladi. Tanimasak
  // tashlab yuboramiz: suhbat yangidan boshlanadi, bu xatodan yaxshiroq.
  const turns = (ai.history as unknown[]).filter(isNeutralTurn);
  return turns.length === ai.history.length ? turns : [];
}

/**
 * Tarixni qisqartiradi, lekin amal juftliklarini buzmasdan.
 *
 * Oddiy slice xavfli: kesish amal chaqiruvi bilan uning natijasi orasiga
 * tushsa, ikkala provayder ham "yetim" natijani rad etadi. Shuning uchun
 * kesilgandan keyin boshidagi qoldiqlarni tashlab, toza foydalanuvchi
 * xabaridan boshlaymiz.
 */
function trimHistory(history: AiTurn[]): AiTurn[] {
  let out = history.slice(-MAX_HISTORY);
  // Suhbat faqat foydalanuvchi xabaridan boshlanishi mumkin
  while (out.length > 0 && out[0].role !== "user") out = out.slice(1);
  return out;
}

/** Mijozdan forward qilingan xabarni qoralamaga qo'shadi */
export async function collectForAi(ctx: MyContext): Promise<void> {
  const msg = ctx.message;
  if (!msg) return;
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  const box = ctx.session.aiBox ?? { texts: [], attachments: [] };
  const media = extractMedia(msg);
  if (media) box.attachments.push({ ...media, caption: msg.caption, chatId: msg.chat.id, messageId: msg.message_id });
  const text = msg.text ?? msg.caption;
  if (text) box.texts.push(text.trim());

  // Kimdan forward qilingani — shu mijoz avval qaysi maktabdan yozganini eslaymiz
  const client = clientKeyOf(msg);
  if (client && !box.clientLabel) {
    box.clientLabel = client.label;
    const source = await findClientSource(client.key);
    if (source) box.schoolHint = source.schoolId;
  }
  ctx.session.aiBox = box;

  // Ketma-ket kelayotgan forwardlarni kutamiz
  const chatId = ctx.chat!.id;
  const existing = pending.get(chatId);
  if (existing) clearTimeout(existing);
  pending.set(
    chatId,
    setTimeout(() => {
      pending.delete(chatId);
      // Taymer yangilanish tsiklidan tashqarida ishlaydi — sessiyani o'zimiz yozamiz
      void flushCollected(ctx)
        .then(() => persistSession(ctx))
        .catch((err) => console.error("AI yig'ilgan xabarni yubora olmadi:", err));
    }, COLLECT_MS)
  );
}

/** Yig'ilgan forwardlarni assistentga uzatadi */
async function flushCollected(ctx: MyContext, extra?: string): Promise<void> {
  const box = ctx.session.aiBox;
  if (!box || (box.texts.length === 0 && box.attachments.length === 0)) return;
  ctx.session.aiBox = undefined;

  const many = box.texts.length > 1;
  const parts: string[] = [
    `[FORWARD] Operator mijozdan${box.clientLabel ? ` (${box.clientLabel})` : ""} kelgan ` +
      `${box.texts.length > 0 ? `${box.texts.length} ta xabarni` : "faylni"} forward qildi.`,
    many
      ? "Hammasini o'qib CHIQIB, bitta aniq xulosa yoz — muammoning mohiyati nima. " +
        "Raqam, sana, telefon kabi aniq ma'lumotlarni xulosaga aynan ko'chir."
      : "Xabarni o'qib muammoning mohiyatini qisqa va aniq yoz.",
    "",
    "--- Mijoz xabari ---",
    ...box.texts,
    "--- tugadi ---",
  ];
  if (box.attachments.length > 0) parts.push(`[${box.attachments.length} ta fayl biriktirilgan]`);
  if (extra) parts.push("", `Operator izohi: ${extra}`);

  await askAi(ctx, parts.join("\n"), box.attachments, box.schoolHint);
}

/**
 * Ovozli xabar kelganda.
 *
 * Bot ovozni matnga aylantira olmaydi (Claude audio qabul qilmaydi, alohida
 * xizmat ulanmagan). Jim turgandan ko'ra rostini aytgan yaxshi — aks holda
 * operator xabari yo'qolgandek tuyuladi.
 */
export async function handleVoice(ctx: MyContext): Promise<void> {
  if (ctx.session.step !== "idle") return;
  const op = await getOperator(ctx);
  if (!op || op.status !== "APPROVED") return;

  await ctx.reply(
    "🎤 Ovozli xabarni hozircha tushunmayman — matn qilib yozib yuboring.\n" +
      "Mijozning ovozli xabari bo'lsa, uning mazmunini qisqacha yozsangiz kifoya.",
    { reply_markup: menu() }
  );
}

/** Operator oddiy matn yozganda */
export async function handleAiText(ctx: MyContext, text: string): Promise<void> {
  // Forward yig'ilib turgan bo'lsa — bu matn o'sha murojaatning izohi
  const chatId = ctx.chat!.id;
  const timer = pending.get(chatId);
  if (timer) {
    clearTimeout(timer);
    pending.delete(chatId);
    await flushCollected(ctx, text);
    return;
  }
  await askAi(ctx, text, []);
}

async function askAi(
  ctx: MyContext,
  text: string,
  attachments: { kind: string; fileId: string; caption?: string }[],
  schoolHint?: number
): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  await ctx.api.sendChatAction(ctx.chat!.id, "typing").catch(() => undefined);

  let prompt = text;
  if (schoolHint) {
    const school = await prisma.school.findUnique({ where: { id: schoolHint } });
    if (school) prompt += `\n\n[Eslatma: bu mijoz avval "${school.name}" maktabidan yozgan edi]`;
  }

  try {
    const result = await runAgent({
      api: ctx.api,
      operator: op,
      history: freshHistory(ctx),
      userText: prompt,
      attachments: attachments as never,
    });

    ctx.session.ai = { history: trimHistory(result.history), lastAt: Date.now() };

    // So'rov tayyorlangan bo'lsa — avval ko'rsatib tasdiq so'raymiz.
    // Guruhga faqat operator tugmani bosgandan keyin ketadi.
    if (result.pendings.length > 0) {
      ctx.session.aiPending = result.pendings;
      await showConfirm(ctx, result.text, result.pendings);
      return;
    }

    ctx.session.aiPending = undefined;

    // Shaxsiy chatda ham: javob shart bo'lmasa reaksiya yetarli
    const emoji = result.reaction ?? reactionFromText(result.text);
    if (emoji) {
      await react(ctx, ctx.message?.message_id, emoji);
      return;
    }

    await ctx.reply(escapeHtml(result.text), { parse_mode: "HTML", reply_markup: menu() });
  } catch (err) {
    console.error("Assistent javob bera olmadi:", err);
    await ctx.reply(aiErrorText(err), { reply_markup: menu() });
  }
}

/**
 * AI xatosini operator tushunadigan gapga aylantiradi.
 *
 * «Ishlamayapti» degan umumiy javob eng ko'p vaqt yeydigan holatni yashirib
 * qo'yadi: kunlik limit tugagan. Buni bilsa operator kutadi yoki adminga
 * aytadi — sababini qidirib o'tirmaydi.
 */
function aiErrorText(err: unknown): string {
  const text = String((err as { message?: string })?.message ?? err);
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(text)) {
    return (
      "⏳ AI limiti tugadi — bugungi so'rovlar chegarasiga yetdik.\n" +
      "Biroz kutib qayta urinib ko'ring yoki tugmali rejimdan foydalaning."
    );
  }
  if (/\b503\b|overloaded|high demand/i.test(text)) {
    return "⏳ AI hozir band. 10-15 soniyadan keyin qayta yozing.";
  }
  if (/\b404\b|not found|no longer available/i.test(text)) {
    return "⚙️ Tanlangan AI modeli mavjud emas. Admin .env dagi AI_MODEL ni tekshirsin.";
  }
  return "Hozir yordamchi ishlamayapti. Tugmalardan foydalaning yoki biroz keyin qayta urinib ko'ring.";
}

/** Telegram qabul qiladigan reaksiyalar — boshqasi 400 xato beradi */
const ALLOWED_REACTIONS = new Set(["👍", "👌", "🙏", "🤝", "🫡", "💯", "🔥", "🤔", "👀", "❤", "🎉", "👏"]);

/** Faqat e'tirof bildiradigan, ma'lumot bermaydigan javoblar */
const BARE_ACK = /^(ok|okay|xo'p|xop|mayli|bo'ldi|boldi|tushunarli|rahmat|zo'r|zor|albatta)[\s!.]*$/i;

/**
 * Javob aslida reaksiya bo'lishi kerakmi.
 *
 * Model ba'zan `react` amalini chaqirmasdan shunchaki «👍» deb yozib yuboradi —
 * bu ham guruhga xabar bo'lib tushadi, ya'ni maqsad buziladi. Shuning uchun
 * mazmunsiz javoblarni o'zimiz reaksiyaga aylantiramiz.
 *
 * Ma'lumot beradigan qisqa javoblar («8 ta») tegilmaydi — ularda harf/raqam bor.
 */
export function reactionFromText(text: string): string | undefined {
  const t = text.trim();
  if (t.length === 0) return undefined;
  if (BARE_ACK.test(t)) return "👍";
  // Harf ham, raqam ham yo'q, lekin emoji bor — ya'ni sof reaksiya
  if (/[\p{L}\p{N}]/u.test(t)) return undefined;
  if (!/\p{Extended_Pictographic}/u.test(t)) return undefined;
  const first = [...t].find((ch) => /\p{Extended_Pictographic}/u.test(ch));
  return first && ALLOWED_REACTIONS.has(first) ? first : "👍";
}

/**
 * Xabarga reaksiya qo'yadi.
 *
 * Reaksiya — eng arzon javob: suhbatni to'ldirmaydi, lekin operator botning
 * ko'rganini biladi. Reaksiya qo'yilmasa ham (eski Telegram klienti, huquq
 * yo'q) ish to'xtamasligi kerak, shuning uchun xato yutiladi.
 */
async function react(ctx: MyContext, messageId: number | undefined, emoji: string): Promise<void> {
  if (!ctx.chat || !messageId) return;
  try {
    await ctx.api.setMessageReaction(ctx.chat.id, messageId, [{ type: "emoji", emoji: emoji as never }]);
  } catch (err) {
    console.error("Reaksiya qo'yilmadi:", err);
  }
}

/**
 * Guruhga ketadigan so'rovning ko'rinishi — operator tasdiqlashdan oldin
 * aynan nima yuborilishini ko'rishi kerak.
 */
/** Tasdiq tugmalari — so'rov guruhga, xabar esa odamlarga ketadi */
/**
 * Tasdiq oynasini ko'rsatadi.
 *
 * Fayl biriktirilgan bo'lsa matn bilan birga o'sha fayllar ham qayta yuboriladi —
 * operator guruhga aynan nima ketishini (rasm bilan qo'shib) ko'rib turishi kerak.
 */
async function showConfirm(
  ctx: MyContext,
  aiText: string,
  ps: Pending[],
  threadId?: number
): Promise<number | undefined> {
  const text = previewAll(aiText, ps);
  const keyboard = confirmKeyboard(ps);

  const only = ps.length === 1 ? ps[0] : undefined;
  const media = only?.kind === "request" ? only.attachments : [];

  if (media.length > 0) {
    const card = await sendCard(
      ctx.api,
      ctx.chat!.id,
      text,
      media.map((a) => ({ kind: a.kind, fileId: a.fileId })),
      threadId,
      keyboard
    );
    return card.messageId;
  }

  const sent = await ctx.reply(text, { parse_mode: "HTML", message_thread_id: threadId, reply_markup: keyboard });
  return sent.message_id;
}

function confirmKeyboard(ps: Pending[]): InlineKeyboard {
  const label =
    ps.length > 1
      ? `✅ Hammasini bajarish (${ps.length})`
      : ps[0].kind === "message"
        ? "✅ Yuborish"
        : ps[0].kind === "update"
          ? "✅ Belgilash"
          : "✅ Guruhga yuborish";
  return new InlineKeyboard().text(label, "ai:send").row().text("❌ Bekor qilish", "ai:cancel");
}

/** Ommaviy o'zgartirishning ko'rinishi */
function previewUpdate(aiText: string, p: PendingUpdate): string[] {
  const who = [p.assigneeUsername, ...(p.otherAssignees ?? [])].filter(Boolean) as string[];
  const shown = p.tickets.slice(0, 12).map((t) => ticketId(t)).join(", ");
  const rest = p.tickets.length > 12 ? ` va yana ${p.tickets.length - 12} ta` : "";
  return [
    `📌 <b>${p.tickets.length} ta bajarilmagan so'rov</b>`,
    ...(p.deadline
      ? [`⏰ <b>Muddat:</b> ${formatTashkentDate(new Date(p.deadline))} — bajarilgunicha eslatib turaman`]
      : []),
    ...(who.length > 0 ? [`🙋 <b>Mas'ul:</b> ${who.map((u) => `@${escapeHtml(u)}`).join(", ")}`] : []),
    "",
    `<code>${escapeHtml(shown)}</code>${escapeHtml(rest)}`,
  ];
}

/** Bir necha amal tayyorlangan bo'lsa hammasini bitta ko'rinishda beramiz */
function previewAll(aiText: string, ps: Pending[]): string {
  if (ps.length === 1) return previewText(aiText, ps[0]);

  const blocks = ps.map((p, i) => {
    if (p.kind === "message") {
      const who = p.targets.map((t) => t.label).join(", ");
      return [`<b>${i + 1}.</b> 📨 ${escapeHtml(who)}`, escapeHtml(p.text)].join("\n");
    }
    if (p.kind === "update") {
      return [`<b>${i + 1}.</b>`, ...previewUpdate("", p)].join("\n");
    }
    return [
      `<b>${i + 1}.</b> ${escapeHtml(p.typeLabel)} — ${escapeHtml(p.schoolName)}, ${escapeHtml(p.moduleName)}`,
      escapeHtml(p.description.split("\n")[0].slice(0, 160)),
    ].join("\n");
  });

  return [
    aiText ? escapeHtml(aiText) : `${ps.length} ta amal tayyorlandi.`,
    "",
    "━━━━━━━━━━━━━━━━",
    blocks.join("\n\n"),
    "━━━━━━━━━━━━━━━━",
    "",
    "Hammasini yuboraymi?",
  ].join("\n");
}

function previewText(aiText: string, p: Pending): string {
  if (p.kind === "update") {
    return [
      aiText ? escapeHtml(aiText) : "O'zgartirish tayyorlandi.",
      "",
      "━━━━━━━━━━━━━━━━",
      ...previewUpdate(aiText, p),
      "━━━━━━━━━━━━━━━━",
      "",
      "Belgilaymi?",
    ].join("\n");
  }

  if (p.kind === "message") {
    const many = p.targets.length > 3;
    const who = many
      ? `${p.targets.slice(0, 3).map((t) => t.label).join(", ")} va yana ${p.targets.length - 3} ta`
      : p.targets.map((t) => t.label).join(", ");
    return [
      aiText ? escapeHtml(aiText) : "Xabar tayyorlandi.",
      "",
      "━━━━━━━━━━━━━━━━",
      `📨 <b>Kimga:</b> ${escapeHtml(who)}`,
      "",
      escapeHtml(p.text),
      "━━━━━━━━━━━━━━━━",
      "",
      "Yuboraymi?",
    ].join("\n");
  }

  const lines = [
    aiText ? escapeHtml(aiText) : "So'rov tayyorlandi.",
    "",
    "━━━━━━━━━━━━━━━━",
    `${escapeHtml(p.typeLabel)}`,
    ...(p.systemName ? [`🖥 <b>Tizim:</b> ${escapeHtml(p.systemName)}`] : []),
    `🧩 <b>Modul:</b> ${escapeHtml(p.moduleName)}`,
    `🏫 <b>Maktab:</b> ${escapeHtml(p.schoolName)}`,
    "",
    `💬 ${escapeHtml(p.description)}`,
  ];

  const who = [p.assigneeUsername, ...(p.otherAssignees ?? [])].filter(Boolean) as string[];
  if (who.length > 0) lines.push("", `🙋 <b>Mas'ul:</b> ${who.map((u) => `@${escapeHtml(u)}`).join(", ")}`);
  if (p.deadline) {
    lines.push(`⏰ <b>Muddat:</b> ${formatTashkentDate(new Date(p.deadline))} — bajarilgunicha eslatib turaman`);
  }

  if (p.attachments.length > 0) lines.push("", `📎 ${p.attachments.length} ta fayl`);
  lines.push("━━━━━━━━━━━━━━━━", "", "To'g'rimi? Tasdiqlasangiz guruhga yuboraman.");
  return lines.join("\n");
}

/** "✅ Guruhga yuborish" — endi haqiqiy so'rov yaratiladi */
export async function handleAiSend(ctx: MyContext): Promise<void> {
  const pendings = (ctx.session.aiPending ?? []) as Pending[];
  if (pendings.length === 0) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan", show_alert: true });
    return;
  }
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  ctx.session.aiPending = undefined;
  await ctx.answerCallbackQuery({ text: "Yuborilyapti..." });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);

  // Bittasi yiqilsa qolganlari baribir ketishi kerak — har birini alohida bajaramiz
  const lines: string[] = [];
  let people = 0;
  const undelivered: string[] = [];

  for (const p of pendings) {
    try {
      if (p.kind === "message") {
        const { sent, failed } = await submitPendingMessage(ctx.api, p);
        people += sent;
        undelivered.push(...failed);
      } else if (p.kind === "update") {
        const { updated, refreshed } = await submitPendingUpdate(ctx.api, p);
        lines.push(
          `✅ ${updated} ta so'rovga belgilandi.` +
            (refreshed < updated ? `\n<i>${updated - refreshed} ta kartani yangilay olmadim (xabar o'chirilgan bo'lishi mumkin).</i>` : "")
        );
      } else {
        const { ticketNumber, delivery } = await submitPending(ctx.api, op, p);
        lines.push(deliveryLine(ticketNumber, delivery));
      }
    } catch (err) {
      console.error("Tasdiqlangan amal bajarilmadi:", err);
      lines.push("⚠️ Bitta amal bajarilmadi — texnik xato.");
    }
  }

  if (people > 0) lines.unshift(`✅ ${people} ta manzilga yuborildi.`);
  // Botni bloklagan yoki /start qilmaganlarga yetib bormaydi — rostini aytamiz
  if (undelivered.length > 0) {
    lines.push(
      `⚠️ Yetib bormadi: ${undelivered.join(", ")}`,
      "<i>Ular botni bloklagan yoki botga hech qachon /start yozmagan.</i>"
    );
  }

  await ctx.reply(lines.join("\n") || "Bajarildi.", { parse_mode: "HTML", ...replyTarget(ctx) });
}

/** "❌ Bekor qilish" */
export async function handleAiCancel(ctx: MyContext): Promise<void> {
  ctx.session.aiPending = undefined;
  await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  await ctx.reply("❌ Yuborilmadi. Nimani o'zgartiray?", replyTarget(ctx));
}

/**
 * Tugma bosilgan joyga qarab javob sozlamasi.
 *
 * Guruhda javob o'sha bo'limga tushishi kerak, va pastdagi klaviatura
 * guruhga umuman tegishli emas — u faqat shaxsiy chatda ma'noga ega.
 */
function replyTarget(ctx: MyContext): { message_thread_id?: number; reply_markup?: ReturnType<typeof menu> } {
  if (ctx.chat?.type === "private") return { reply_markup: menu() };
  return { message_thread_id: ctx.callbackQuery?.message?.message_thread_id };
}

/**
 * Guruhda assistentga murojaat qilinganmi.
 *
 * Uch yo'l bor: nomi bilan chaqirish ("girgitton ..."), bot xabariga reply
 * qilish, yoki @username bilan tag qilish. Boshqa guruh xabarlariga bot
 * aralashmaydi — aks holda har gapga javob berib chiqadi.
 */
const WAKE_WORD = /(^|\s|[",.!?])girgitton\b/i;

export async function isGroupMention(ctx: MyContext): Promise<boolean> {
  const msg = ctx.message;
  if (!msg || !ctx.chat || ctx.chat.type === "private") return false;

  const text = msg.text ?? msg.caption ?? "";
  if (WAKE_WORD.test(text)) return true;

  const me = ctx.me?.username;
  if (me && new RegExp(`@${me}\\b`, "i").test(text)) return true;

  // Botning xabariga reply — lekin har qanday xabariga emas.
  // Karta, muddat eslatmasi va "BAJARILDI" bildirishnomasi suhbat emas:
  // ularga reply qilib odamlar hamkasbini tag qiladi ("@Iqboljon qara"),
  // bot esa o'zicha "nima kerakligini aniqroq yozing" deb aralashib ketardi.
  const replied = msg.reply_to_message;
  if (!replied || replied.from?.id !== ctx.me?.id) return false;
  return isAssistantMessage(ctx.chat.id, replied.message_id);
}

/**
 * Guruhdagi murojaatga javob beradi.
 *
 * Suhbat tarixi guruhda ham saqlanadi, lekin har bir odam uchun alohida
 * (sessiya kaliti "chat:user"). Busiz aniqlashtiruvchi savol tugab qolardi:
 * bot "qaysi maktab?" deb so'raydi, operator javob yozadi, bot esa nima
 * haqida gaplashayotganini eslay olmaydi.
 */
export async function handleGroupMention(ctx: MyContext): Promise<void> {
  const msg = ctx.message;
  if (!msg) return;

  const op = await getOperator(ctx);
  if (!op || op.status !== "APPROVED") {
    await ctx.reply("Sizni tanimadim. Avval botga shaxsiy yozib /start orqali ro'yxatdan o'ting.", {
      message_thread_id: msg.message_thread_id,
      reply_parameters: { message_id: msg.message_id },
    });
    return;
  }

  const raw = (msg.text ?? msg.caption ?? "").replace(WAKE_WORD, " ").trim();
  if (raw.length === 0) {
    await ctx.reply("Labbay? Nima kerak edi?", {
      message_thread_id: msg.message_thread_id,
      reply_parameters: { message_id: msg.message_id },
    });
    return;
  }

  const parts: string[] = [`[GURUH] ${op.fullName} guruhda yozdi:`, raw];

  // Reply qilingan xabar — kontekst
  const replied = msg.reply_to_message;
  const repliedText = replied ? ((replied as { text?: string; caption?: string }).text ?? (replied as { caption?: string }).caption) : undefined;
  if (repliedText) {
    const who = replied?.from?.id === ctx.me?.id ? "Sen (bot) yozgan eding" : `${replied?.from?.first_name ?? "Kimdir"} yozgan`;
    parts.push("", `--- ${who} ---`, repliedText.slice(0, 1500), "--- tugadi ---");
  }

  // Bir necha xabarga bo'lingan muammoni yig'ish uchun — oxirgi xabarlar raqami
  // bilan beriladi, model keraklisini o'zi tanlaydi
  const recent = await recentGroupMessages(ctx.chat!.id, msg.message_thread_id, msg.message_id);
  const context = formatGroupContext(recent);
  if (context) parts.push(context);

  await ctx.api.sendChatAction(ctx.chat!.id, "typing").catch(() => undefined);

  try {
    const result = await runAgent({
      api: ctx.api,
      operator: op,
      history: freshHistory(ctx),
      userText: parts.join("\n"),
      groupChatId: String(ctx.chat!.id),
      groupThreadId: msg.message_thread_id,
    });

    ctx.session.ai = { history: trimHistory(result.history), lastAt: Date.now() };

    // Guruhda so'rov tayyorlansa ham tasdiq shaxsiy chatdagidek tugma bilan
    if (result.pendings.length > 0) {
      ctx.session.aiPending = result.pendings;
      const sent = await showConfirm(ctx, result.text, result.pendings, msg.message_thread_id);
      if (sent) await rememberAssistantMessage(ctx.chat!.id, msg.message_thread_id, sent, result.text);
      return;
    }

    // Javob shart bo'lmasa — matn emas, reaksiya. Guruhni gapga to'ldirmaymiz.
    const emoji = result.reaction ?? reactionFromText(result.text);
    if (emoji) {
      await react(ctx, msg.message_id, emoji);
      return;
    }

    const sent = await ctx.reply(escapeHtml(result.text), {
      parse_mode: "HTML",
      message_thread_id: msg.message_thread_id,
      reply_parameters: { message_id: msg.message_id },
    });
    // Shu javobga reply kelsa — suhbat davomi deb qabul qilamiz
    await rememberAssistantMessage(ctx.chat!.id, msg.message_thread_id, sent.message_id, result.text);
  } catch (err) {
    console.error("Guruhda assistent javob bera olmadi:", err);
    await ctx.reply(aiErrorText(err), {
      message_thread_id: msg.message_thread_id,
      reply_parameters: { message_id: msg.message_id },
    });
  }
}

/** Suhbatni boshidan boshlash */
export async function resetAi(ctx: MyContext): Promise<void> {
  ctx.session.ai = undefined;
  ctx.session.aiBox = undefined;
  ctx.session.aiPending = undefined;
  await ctx.reply("🔄 Suhbat tozalandi. Nima qilamiz?", { reply_markup: menu() });
}

export function isForwardedMessage(msg: Message): boolean {
  return msg.forward_origin !== undefined;
}
