import { Api, GrammyError, InlineKeyboard } from "grammy";
import { prisma } from "../../db";
import { getBacklogChatId, getDevGroupId } from "../../settings";
import { escapeHtml, formatTashkent, ticketId } from "../../util";
import { moduleLabel } from "./modules";
import { requestTypeLabelByKey } from "./requestTypes";

export interface MediaRef {
  chatId: number;
  messageId: number;
}

/** Barcha adminlarga xabar yuboradi; yuborilganlar sonini qaytaradi */
export async function notifyAdmins(api: Api, text: string, keyboard?: InlineKeyboard): Promise<number> {
  const admins = await prisma.operator.findMany({ where: { isAdmin: true } });
  let sent = 0;
  for (const admin of admins) {
    try {
      await api.sendMessage(admin.telegramId, text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      sent++;
    } catch (err) {
      console.error(`Adminga (${admin.telegramId}) xabar yuborilmadi:`, err);
    }
  }
  if (admins.length === 0) {
    console.warn("Bazada admin yo'q — xabar hech kimga yuborilmadi. /admin orqali admin bo'ling.");
  }
  return sent;
}

/** Guruh + so'rov turi uchun biriktirilgan bo'lim (topic) raqami; biriktirilmagan bo'lsa undefined */
async function getTopicThreadId(chatId: string, type: string): Promise<number | undefined> {
  const row = await prisma.groupTopic.findUnique({ where: { chatId_type: { chatId, type } } });
  return row?.threadId;
}

/** Bo'lim o'chirilgan yoki yopilgan bo'lsa Telegram shunday xato qaytaradi */
function isThreadError(err: unknown): boolean {
  return err instanceof GrammyError && /thread not found|TOPIC_CLOSED|TOPIC_DELETED/i.test(err.description);
}

/** Karta matnini yuboradi, keyin operator yuborgan media xabarlarni nusxalab o'tkazadi */
async function sendCardWithMedia(
  api: Api,
  chatId: string | number,
  text: string,
  refs: MediaRef[],
  threadId?: number
): Promise<void> {
  try {
    await api.sendMessage(chatId, text, { parse_mode: "HTML", message_thread_id: threadId });
  } catch (err) {
    if (threadId !== undefined && isThreadError(err)) {
      console.warn(`Bo'lim (${threadId}) topilmadi/yopiq — ${chatId} guruhida General'ga yuboriladi`);
      return sendCardWithMedia(api, chatId, text, refs);
    }
    throw err;
  }
  for (const ref of refs) {
    try {
      await api.copyMessage(chatId, ref.chatId, ref.messageId, { message_thread_id: threadId });
    } catch (err) {
      console.error(`Media (${ref.messageId}) nusxalanmadi:`, err);
    }
  }
}

async function sendToAllAdmins(api: Api, text: string, refs: MediaRef[]): Promise<void> {
  const admins = await prisma.operator.findMany({ where: { isAdmin: true } });
  if (admins.length === 0) {
    console.warn("Bazada admin yo'q — so'rov hech kimga yuborilmadi.");
    return;
  }
  for (const admin of admins) {
    try {
      await sendCardWithMedia(api, admin.telegramId, text, refs);
    } catch (err) {
      console.error(`Adminga (${admin.telegramId}) yuborilmadi:`, err);
    }
  }
}

function requestCard(
  request: {
    ticketNumber: number;
    description: string;
    createdAt: Date;
    system: { name: string } | null;
    module: { name: string; emoji: string };
    school: { name: string };
    operator: { fullName: string; username: string | null };
  },
  typeLabel: string
): string {
  const op = request.operator;
  const operatorLine = op.username
    ? `${escapeHtml(op.fullName)} (@${escapeHtml(op.username)})`
    : escapeHtml(op.fullName);
  return [
    `${escapeHtml(typeLabel)} — <code>${ticketId(request.ticketNumber)}</code>`,
    ...(request.system ? [`🖥 Tizim: ${escapeHtml(request.system.name)}`] : []),
    `🧩 Modul: ${escapeHtml(moduleLabel(request.module))}`,
    `🏫 Maktab: ${escapeHtml(request.school.name)}`,
    `👤 Operator: ${operatorLine}`,
    `🕒 Vaqt: ${formatTashkent(request.createdAt)}`,
    "",
    "💬 <b>Mijoz murojaati:</b>",
    `<blockquote>${escapeHtml(request.description)}</blockquote>`,
  ].join("\n");
}

/** So'rov saqlangandan keyin avtomatik yo'naltirish (media bilan birga) */
export async function routeRequest(api: Api, requestId: number, mediaRefs: MediaRef[] = []): Promise<void> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { school: true, operator: true, module: true, system: true },
  });
  if (!request) return;

  const text = requestCard(request, await requestTypeLabelByKey(request.type));

  try {
    // Avval tizimning o'z guruhi; taklif uchun backlog chat belgilangan bo'lsa — o'sha yerga;
    // tizim guruhi bo'lmasa umumiy guruh; u ham bo'lmasa adminlarga
    const backlogChatId = await getBacklogChatId();

    let target: string | null = null;
    if (request.type === "SUGGESTION" && backlogChatId) {
      target = backlogChatId;
    } else if (request.system?.groupChatId) {
      target = request.system.groupChatId;
    } else {
      target = (await getDevGroupId()) || null;
    }

    if (target) {
      const threadId = await getTopicThreadId(target, request.type);
      await sendCardWithMedia(api, target, text, mediaRefs, threadId);
    } else {
      console.warn("Guruh belgilanmagan (/setgroup) — so'rov adminlarga yuboriladi");
      await sendToAllAdmins(api, text, mediaRefs);
    }
  } catch (err) {
    console.error(`So'rov ${ticketId(request.ticketNumber)} yo'naltirilmadi:`, err);
  }
}
