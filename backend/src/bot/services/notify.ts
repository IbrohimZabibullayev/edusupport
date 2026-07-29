import { Api, GrammyError, InlineKeyboard } from "grammy";
import { prisma } from "../../db";
import { getBacklogChatId, getDevGroupId } from "../../settings";
import { ticketId } from "../../util";
import { cardInclude, cardKeyboard, renderCardText } from "./card";

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

/** Karta matnini yuboradi, keyin operator yuborgan media xabarlarni nusxalab o'tkazadi; yuborilgan karta xabarini qaytaradi */
async function sendCardWithMedia(
  api: Api,
  chatId: string | number,
  text: string,
  refs: MediaRef[],
  threadId?: number,
  keyboard?: InlineKeyboard
): Promise<{ chatId: number; messageId: number }> {
  let card;
  try {
    card = await api.sendMessage(chatId, text, {
      parse_mode: "HTML",
      message_thread_id: threadId,
      reply_markup: keyboard,
    });
  } catch (err) {
    if (threadId !== undefined && isThreadError(err)) {
      console.warn(`Bo'lim (${threadId}) topilmadi/yopiq — ${chatId} guruhida General'ga yuboriladi`);
      return sendCardWithMedia(api, chatId, text, refs, undefined, keyboard);
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
  return { chatId: card.chat.id, messageId: card.message_id };
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

/** So'rov saqlangandan keyin avtomatik yo'naltirish (media bilan birga) */
export type RouteResult = "group" | "admins" | "failed";

/** So'rov haqiqatan qayerga tushganini aytadi — "yuborildi" deb aldamaymiz */
export function deliveryLine(ticketNumber: number, delivery: RouteResult): string {
  const id = `<b>${ticketId(ticketNumber)}</b>`;
  if (delivery === "group") return `✅ ${id} guruhga yuborildi`;
  if (delivery === "admins")
    return `⚠️ ${id} saqlandi, lekin guruhga tushmadi — adminlarga yuborildi.\n<i>Guruh sozlanmagan yoki bot unda yo'q.</i>`;
  return `⚠️ ${id} saqlandi, lekin hech qayerga yuborilmadi.\n<i>Admin bilan bog'laning.</i>`;
}

export async function routeRequest(
  api: Api,
  requestId: number,
  mediaRefs: MediaRef[] = []
): Promise<RouteResult> {
  const request = await prisma.request.findUnique({ where: { id: requestId }, include: cardInclude });
  if (!request) return "failed";

  const text = await renderCardText(request);
  const keyboard = cardKeyboard(request);

  // Avval tizimning o'z guruhi; taklif uchun backlog chat belgilangan bo'lsa — o'sha yerga;
  // tizim guruhi bo'lmasa umumiy guruh; u ham bo'lmasa adminlarga
  let target: string | null = null;
  try {
    const backlogChatId = await getBacklogChatId();
    if (request.type === "SUGGESTION" && backlogChatId) {
      target = backlogChatId;
    } else if (request.system?.groupChatId) {
      target = request.system.groupChatId;
    } else {
      target = (await getDevGroupId()) || null;
    }

    if (target) {
      const threadId = await getTopicThreadId(target, request.type);
      if (threadId === undefined) {
        console.warn(
          `${ticketId(request.ticketNumber)} (${request.type}) uchun ${target} guruhida bo'lim biriktirilmagan — General'ga tushadi. ` +
            `Kerakli bo'lim ichida /settopic yozing.`
        );
      }
      const card = await sendCardWithMedia(api, target, text, mediaRefs, threadId, keyboard);
      // Kartani keyin tahrirlash (bajarildi/mas'ul/muddat) va reply orqali topish uchun saqlaymiz
      await prisma.request.update({
        where: { id: request.id },
        data: { cardChatId: String(card.chatId), cardMessageId: card.messageId },
      });
      return "group";
    }
    console.warn("Guruh belgilanmagan (/setgroup) — so'rov adminlarga yuboriladi");
  } catch (err) {
    console.error(`So'rov ${ticketId(request.ticketNumber)} guruhga (${target}) yuborilmadi:`, err);
    if (err instanceof GrammyError && /chat not found|bot was kicked|not a member|CHAT_WRITE_FORBIDDEN/i.test(err.description)) {
      console.error(
        `Guruh (${target}) topilmadi yoki bot unda yo'q. Guruh superguruhga aylantirilgan bo'lsa ID o'zgargan — ` +
          `guruh ichida qaytadan /setgroup yozing.`
      );
    }
  }

  // Guruhga tushmadi — so'rov yo'qolmasligi uchun adminlarga yuboramiz
  try {
    await sendToAllAdmins(api, text, mediaRefs);
    return "admins";
  } catch (err) {
    console.error(`So'rov ${ticketId(request.ticketNumber)} adminlarga ham yuborilmadi:`, err);
    return "failed";
  }
}
