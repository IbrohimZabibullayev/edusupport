import { Message } from "grammy/types";
import { prisma } from "../../db";
import { normalizeSchool } from "./schools";

/**
 * Forward qilingan xabardan mijozni aniqlaydigan barqaror kalit.
 * Odam akkauntini yashirgan bo'lsa Telegram ID bermaydi — o'shanda nomidan foydalanamiz.
 */
export function clientKeyOf(msg: Message): { key: string; label: string } | null {
  const o = msg.forward_origin;
  if (!o) return null;
  switch (o.type) {
    case "user":
      return {
        key: `u:${o.sender_user.id}`,
        label: [o.sender_user.first_name, o.sender_user.last_name].filter(Boolean).join(" "),
      };
    case "hidden_user": {
      const norm = normalizeSchool(o.sender_user_name);
      return norm ? { key: `h:${norm}`, label: o.sender_user_name } : null;
    }
    case "chat":
      return { key: `c:${o.sender_chat.id}`, label: "title" in o.sender_chat ? (o.sender_chat.title ?? "") : "" };
    case "channel":
      return { key: `c:${o.chat.id}`, label: o.chat.title ?? "" };
    default:
      return null;
  }
}

export function findClientSource(key: string) {
  return prisma.clientSource.findUnique({ where: { key } });
}

/** So'rov yuborilgandan keyin mijoz → maktab/tur/modul xotirasini yangilaydi */
export async function rememberClient(
  key: string,
  label: string,
  schoolId: number,
  typeKey: string,
  moduleId: number
): Promise<void> {
  const existing = await prisma.clientSource.findUnique({ where: { key } });
  await prisma.clientSource.upsert({
    where: { key },
    create: { key, label, schoolId, lastTypeKey: typeKey, lastModuleId: moduleId, useCount: 1 },
    update: {
      label: label || existing?.label || "",
      schoolId,
      lastTypeKey: typeKey,
      lastModuleId: moduleId,
      useCount: { increment: 1 },
    },
  });
}

/**
 * Operator so'rovni tuzatgandan keyin xotirani to'g'rilaydi.
 * useCount oshirilmaydi — bu yangi murojaat emas, o'sha murojaatning tuzatilishi.
 */
export async function correctClientMemory(
  key: string,
  schoolId: number,
  typeKey: string,
  moduleId: number
): Promise<void> {
  await prisma.clientSource.updateMany({
    where: { key },
    data: { schoolId, lastTypeKey: typeKey, lastModuleId: moduleId },
  });
}
