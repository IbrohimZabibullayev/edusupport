import { Api, InlineKeyboard } from "grammy";
import { RequestType } from "@prisma/client";
import { prisma } from "../../db";
import { getBacklogChatId, getDevGroupId } from "../../settings";
import { escapeHtml, formatTashkent, ticketId } from "../../util";
import { TYPE_LABELS } from "../texts";
import { moduleLabel } from "./modules";

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

/** Karta matnini yuboradi, keyin operator yuborgan media xabarlarni nusxalab o'tkazadi */
async function sendCardWithMedia(api: Api, chatId: string | number, text: string, refs: MediaRef[]): Promise<void> {
  await api.sendMessage(chatId, text, { parse_mode: "HTML" });
  for (const ref of refs) {
    try {
      await api.copyMessage(chatId, ref.chatId, ref.messageId);
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

function requestCard(request: {
  ticketNumber: number;
  type: RequestType;
  description: string;
  createdAt: Date;
  system: { name: string } | null;
  module: { name: string; emoji: string };
  school: { name: string };
  operator: { fullName: string; username: string | null };
}): string {
  const op = request.operator;
  const operatorLine = op.username
    ? `${escapeHtml(op.fullName)} (@${escapeHtml(op.username)})`
    : escapeHtml(op.fullName);
  return [
    `${TYPE_LABELS[request.type]} — <code>${ticketId(request.ticketNumber)}</code>`,
    ...(request.system ? [`🖥 Tizim: ${escapeHtml(request.system.name)}`] : []),
    `🧩 Modul: ${escapeHtml(moduleLabel(request.module))}`,
    `🏫 Maktab: ${escapeHtml(request.school.name)}`,
    `👤 Operator: ${operatorLine}`,
    `🕒 Vaqt: ${formatTashkent(request.createdAt)}`,
    "",
    `📝 ${escapeHtml(request.description)}`,
  ].join("\n");
}

/** So'rov saqlangandan keyin avtomatik yo'naltirish (media bilan birga) */
export async function routeRequest(api: Api, requestId: number, mediaRefs: MediaRef[] = []): Promise<void> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { school: true, operator: true, module: true, system: true },
  });
  if (!request) return;

  const text = requestCard(request);

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
      await sendCardWithMedia(api, target, text, mediaRefs);
    } else {
      console.warn("Guruh belgilanmagan (/setgroup) — so'rov adminlarga yuboriladi");
      await sendToAllAdmins(api, text, mediaRefs);
    }
  } catch (err) {
    console.error(`So'rov ${ticketId(request.ticketNumber)} yo'naltirilmadi:`, err);
  }
}
