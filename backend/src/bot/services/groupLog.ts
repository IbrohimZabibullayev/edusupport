import { Message } from "grammy/types";
import { prisma } from "../../db";
import { MyContext } from "../types";
import { extractMedia } from "./content";

/**
 * Guruhdagi so'nggi xabarlar xotirasi.
 *
 * Nima uchun kerak: guruhda muammo ko'pincha bir necha xabarga bo'linadi —
 * biri skrinshot tashlaydi, ikkinchisi mijoz matnini forward qiladi, uchinchisi
 * mas'ullarni tag qiladi. Keyin kimdir «girgitton, shuni so'rov qilib saqla»
 * deydi. Telegram Bot API o'tmishdagi xabarlarni so'rab olishga imkon bermaydi
 * (getChatHistory yo'q) — bot faqat xabar kelgan paytda ko'ra oladi.
 * Shuning uchun ko'rgan narsasini qisqa muddat saqlab turamiz.
 *
 * Faqat guruhlar uchun. Shaxsiy yozishmalar bu yerga tushmaydi.
 */

/** Shu muddatdan eski yozuvlar tozalanadi — arxiv emas, qisqa xotira */
const KEEP_HOURS = 48;
/** Bitta murojaatga shuncha oldingi xabar kontekst sifatida beriladi */
export const CONTEXT_LIMIT = 15;

let lastPrune = 0;

/**
 * Guruhga kelgan har qanday xabarni yozib qo'yadi.
 *
 * MUHIM: bot guruh xabarlarini ko'rishi uchun BotFather'da privacy mode
 * o'chirilgan yoki bot guruhda admin bo'lishi kerak. Aks holda bunga faqat
 * botga qilingan murojaatlar tushadi va «yuqoridagi xabarlar» topilmaydi.
 */
export async function recordGroupMessage(ctx: MyContext): Promise<void> {
  const msg = ctx.message;
  if (!msg || !ctx.chat || ctx.chat.type === "private") return;
  if (msg.from?.is_bot) return;

  const media = extractMedia(msg);
  const text = msg.text ?? msg.caption ?? null;
  // Na matn, na fayl — service xabari (kirdi/chiqdi), saqlashning ma'nosi yo'q
  if (!text && !media) return;

  const from = msg.from;
  const fromName = from ? [from.first_name, from.last_name].filter(Boolean).join(" ") : "Noma'lum";

  try {
    await prisma.groupMessage.upsert({
      where: { chatId_messageId: { chatId: String(ctx.chat.id), messageId: msg.message_id } },
      create: {
        chatId: String(ctx.chat.id),
        threadId: msg.message_thread_id ?? null,
        messageId: msg.message_id,
        fromName,
        fromUsername: from?.username ?? null,
        forwardFrom: forwardLabel(msg),
        text,
        mediaKind: media?.kind ?? null,
        mediaFileId: media?.fileId ?? null,
      },
      update: { text, mediaKind: media?.kind ?? null, mediaFileId: media?.fileId ?? null },
    });
  } catch (err) {
    // Xotira yozilmasa ham guruh ishlashda davom etsin
    console.error("Guruh xabari yozilmadi:", err);
  }

  void prune();
}

/**
 * Botning o'z suhbat javobini belgilab qo'yadi.
 *
 * Faqat shu xabarlarga qilingan reply «suhbat davomi» hisoblanadi. Karta,
 * muddat eslatmasi va «BAJARILDI» bildirishnomasi bu ro'yxatga kirmaydi —
 * ularga reply qilib odamlar hamkasbini tag qiladi, bot esa o'zicha javob
 * yozib suhbatga aralashib ketardi.
 */
export async function rememberAssistantMessage(
  chatId: string | number,
  threadId: number | undefined,
  messageId: number,
  text?: string
): Promise<void> {
  try {
    await prisma.groupMessage.upsert({
      where: { chatId_messageId: { chatId: String(chatId), messageId } },
      create: {
        chatId: String(chatId),
        threadId: threadId ?? null,
        messageId,
        fromName: "bot",
        isAssistant: true,
        text: text?.slice(0, 500) ?? null,
      },
      update: { isAssistant: true },
    });
  } catch (err) {
    console.error("Bot javobi belgilanmadi:", err);
  }
}

/** Shu xabar botning suhbat javobimi (ya'ni unga reply qilsa bo'ladimi) */
export async function isAssistantMessage(chatId: string | number, messageId: number): Promise<boolean> {
  const row = await prisma.groupMessage.findUnique({
    where: { chatId_messageId: { chatId: String(chatId), messageId } },
    select: { isAssistant: true },
  });
  return row?.isAssistant === true;
}

/** Xabar kimdandir forward qilingan bo'lsa — kimdan ekanini o'qiydi */
function forwardLabel(msg: Message): string | null {
  const origin = msg.forward_origin;
  if (!origin) return null;
  if (origin.type === "user") {
    return [origin.sender_user.first_name, origin.sender_user.last_name].filter(Boolean).join(" ");
  }
  if (origin.type === "hidden_user") return origin.sender_user_name;
  if (origin.type === "chat") return "title" in origin.sender_chat ? (origin.sender_chat.title ?? "chat") : "chat";
  if (origin.type === "channel") return origin.chat.title ?? "kanal";
  return "noma'lum";
}

/** Kuniga bir marta eskisini tozalaydi */
async function prune(): Promise<void> {
  const now = Date.now();
  if (now - lastPrune < 6 * 3600_000) return;
  lastPrune = now;
  try {
    await prisma.groupMessage.deleteMany({
      where: { createdAt: { lt: new Date(now - KEEP_HOURS * 3600_000) } },
    });
  } catch (err) {
    console.error("Eski guruh xabarlari tozalanmadi:", err);
  }
}

export interface GroupContextRow {
  messageId: number;
  fromName: string;
  fromUsername: string | null;
  forwardFrom: string | null;
  text: string | null;
  mediaKind: string | null;
  mediaFileId: string | null;
}

/**
 * Murojaatdan oldingi xabarlarni oxirgisidan boshlab oladi.
 *
 * Bo'limli (forum) guruhda faqat o'sha bo'lim xabarlari olinadi — boshqa
 * bo'limdagi gaplar bu suhbatga aloqasi yo'q.
 */
export async function recentGroupMessages(
  chatId: string | number,
  threadId: number | undefined,
  beforeMessageId: number,
  limit = CONTEXT_LIMIT
): Promise<GroupContextRow[]> {
  const rows = await prisma.groupMessage.findMany({
    where: {
      chatId: String(chatId),
      threadId: threadId ?? null,
      messageId: { lt: beforeMessageId },
      // Botning o'z javoblari kontekstga kirmaydi — suhbat tarixi alohida beriladi
      isAssistant: false,
    },
    orderBy: { messageId: "desc" },
    take: limit,
    select: {
      messageId: true,
      fromName: true,
      fromUsername: true,
      forwardFrom: true,
      text: true,
      mediaKind: true,
      mediaFileId: true,
    },
  });
  return rows.reverse();
}

/** Bir xabarning kontekstdagi ko'rinishi */
function renderRow(r: GroupContextRow): string {
  const who = r.fromUsername ? `${r.fromName} (@${r.fromUsername})` : r.fromName;
  const head = r.forwardFrom ? `${who} → forward: ${r.forwardFrom}` : who;
  const parts = [`[#${r.messageId}] ${head}`];
  if (r.mediaKind) parts.push(`  <${r.mediaKind} fayl biriktirilgan>`);
  if (r.text) parts.push(`  ${r.text.slice(0, 1200).replace(/\n/g, "\n  ")}`);
  return parts.join("\n");
}

/**
 * Modelga beriladigan kontekst bloki. Xabar raqamlari (#123) ataylab
 * ko'rsatiladi — model «shu xabarlarni so'rov qil» deganda aynan shu
 * raqamlarni `from_message_ids` ga qaytaradi va bot fayllarni topib oladi.
 */
export function formatGroupContext(rows: GroupContextRow[]): string {
  if (rows.length === 0) return "";
  return [
    "",
    `--- Shu bo'limdagi oxirgi ${rows.length} ta xabar (eskisidan yangisiga) ---`,
    rows.map(renderRow).join("\n"),
    "--- tugadi ---",
    "Foydalanuvchi «yuqoridagi», «shu xabarlarni», «buni» desa — aynan shulardan",
    "keraklisini tanla va ularning #raqamlarini from_message_ids ga ber.",
  ].join("\n");
}
