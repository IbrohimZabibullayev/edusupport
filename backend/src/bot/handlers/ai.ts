import { InlineKeyboard } from "grammy";
import { Message } from "grammy/types";
import { AiTurn, runAgent } from "../../ai/agent";
import { aiEnabled } from "../../ai/client";
import { Pending, submitPending, submitPendingMessage } from "../../ai/tools";
import { prisma } from "../../db";
import { escapeHtml } from "../../util";
import { menu } from "../keyboards";
import { clientKeyOf, findClientSource } from "../services/clients";
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
  return ai.history as AiTurn[];
}

/**
 * Tarixni qisqartiradi, lekin tool juftliklarini buzmasdan.
 *
 * Oddiy slice xavfli: kesish tool_use bilan tool_result orasiga tushsa,
 * API "yetim" tool_result ni rad etadi. Shuning uchun kesilgandan keyin
 * boshidagi tool natijalarini ham tashlab, toza foydalanuvchi xabaridan
 * boshlaymiz.
 */
function trimHistory(history: AiTurn[]): AiTurn[] {
  let out = history.slice(-MAX_HISTORY);
  while (out.length > 0) {
    const first = out[0];
    const hasToolResult =
      first.role === "user" &&
      Array.isArray(first.content) &&
      first.content.some((b) => typeof b === "object" && b !== null && (b as { type?: string }).type === "tool_result");
    // Assistant bilan boshlanishi ham mumkin emas — javob avval savolni talab qiladi
    if (hasToolResult || first.role === "assistant") out = out.slice(1);
    else break;
  }
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
    await ctx.reply(escapeHtml(result.text), { parse_mode: "HTML", reply_markup: menu() });
  } catch (err) {
    console.error("Assistent javob bera olmadi:", err);
    await ctx.reply(
      "Hozir yordamchi ishlamayapti. Tugmalardan foydalaning yoki biroz keyin qayta urinib ko'ring.",
      { reply_markup: menu() }
    );
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
async function showConfirm(ctx: MyContext, aiText: string, ps: Pending[], threadId?: number): Promise<void> {
  const text = previewAll(aiText, ps);
  const keyboard = confirmKeyboard(ps);

  const only = ps.length === 1 ? ps[0] : undefined;
  const media = only?.kind === "request" ? only.attachments : [];

  if (media.length > 0) {
    await sendCard(ctx.api, ctx.chat!.id, text, media.map((a) => ({ kind: a.kind, fileId: a.fileId })), threadId, keyboard);
    return;
  }

  await ctx.reply(text, { parse_mode: "HTML", message_thread_id: threadId, reply_markup: keyboard });
}

function confirmKeyboard(ps: Pending[]): InlineKeyboard {
  const onlyMessages = ps.every((p) => p.kind === "message");
  const label = ps.length > 1 ? `✅ Hammasini yuborish (${ps.length})` : onlyMessages ? "✅ Yuborish" : "✅ Guruhga yuborish";
  return new InlineKeyboard().text(label, "ai:send").row().text("❌ Bekor qilish", "ai:cancel");
}

/** Bir necha amal tayyorlangan bo'lsa hammasini bitta ko'rinishda beramiz */
function previewAll(aiText: string, ps: Pending[]): string {
  if (ps.length === 1) return previewText(aiText, ps[0]);

  const blocks = ps.map((p, i) => {
    if (p.kind === "message") {
      const who = p.targets.map((t) => t.label).join(", ");
      return [`<b>${i + 1}.</b> 📨 ${escapeHtml(who)}`, escapeHtml(p.text)].join("\n");
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

  await ctx.reply(lines.join("\n") || "Bajarildi.", { parse_mode: "HTML", reply_markup: menu() });
}

/** "❌ Bekor qilish" */
export async function handleAiCancel(ctx: MyContext): Promise<void> {
  ctx.session.aiPending = undefined;
  await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  await ctx.reply("❌ Yuborilmadi. Nimani o'zgartiray?", { reply_markup: menu() });
}

/**
 * Guruhda assistentga murojaat qilinganmi.
 *
 * Uch yo'l bor: nomi bilan chaqirish ("girgitton ..."), bot xabariga reply
 * qilish, yoki @username bilan tag qilish. Boshqa guruh xabarlariga bot
 * aralashmaydi — aks holda har gapga javob berib chiqadi.
 */
const WAKE_WORD = /(^|\s|[",.!?])girgitton\b/i;

export function isGroupMention(ctx: MyContext): boolean {
  const msg = ctx.message;
  if (!msg || !ctx.chat || ctx.chat.type === "private") return false;

  const text = msg.text ?? msg.caption ?? "";
  if (WAKE_WORD.test(text)) return true;

  const me = ctx.me?.username;
  if (me && new RegExp(`@${me}\\b`, "i").test(text)) return true;

  // Botning o'z xabariga reply — suhbat davomi
  return msg.reply_to_message?.from?.id === ctx.me?.id;
}

/**
 * Guruhdagi murojaatga javob beradi.
 *
 * Guruhda suhbat tarixi saqlanmaydi — har murojaat mustaqil. Uzluksizlik
 * reply orqali beriladi: javob berilayotgan xabar matni kontekst sifatida
 * qo'shiladi, shuning uchun "girgitton bu bajarildimi?" kabi savollar ham
 * tushunarli bo'ladi.
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

  await ctx.api.sendChatAction(ctx.chat!.id, "typing").catch(() => undefined);

  try {
    const result = await runAgent({
      api: ctx.api,
      operator: op,
      history: [],
      userText: parts.join("\n"),
    });

    // Guruhda so'rov tayyorlansa ham tasdiq shaxsiy chatdagidek tugma bilan
    if (result.pendings.length > 0) {
      ctx.session.aiPending = result.pendings;
      await showConfirm(ctx, result.text, result.pendings, msg.message_thread_id);
      return;
    }

    await ctx.reply(escapeHtml(result.text), {
      parse_mode: "HTML",
      message_thread_id: msg.message_thread_id,
      reply_parameters: { message_id: msg.message_id },
    });
  } catch (err) {
    console.error("Guruhda assistent javob bera olmadi:", err);
    await ctx.reply("Hozir javob bera olmadim, biroz keyin urinib ko'ring.", {
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
