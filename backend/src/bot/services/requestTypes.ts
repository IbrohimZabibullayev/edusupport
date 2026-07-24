import { RequestType } from "@prisma/client";
import { prisma } from "../../db";

/** Botda ko'rsatiladigan faol so'rov turlari (tartib bo'yicha) */
export function getActiveRequestTypes(): Promise<RequestType[]> {
  return prisma.requestType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

/** Tugma/karta matni: "🐞 Bug" yoki emoji yo'q bo'lsa faqat nom */
export function requestTypeLabel(t: Pick<RequestType, "name" | "emoji">): string {
  return t.emoji ? `${t.emoji} ${t.name}` : t.name;
}

/** key → tur (nom/emoji/rang) xaritasi; eski so'rovlar turini ko'rsatish uchun */
export async function getRequestTypeMap(): Promise<Map<string, RequestType>> {
  const all = await prisma.requestType.findMany();
  return new Map(all.map((t) => [t.key, t]));
}

/** Bitta key uchun label; tur o'chirilgan bo'lsa key'ning o'zini qaytaradi */
export async function requestTypeLabelByKey(key: string): Promise<string> {
  const t = await prisma.requestType.findUnique({ where: { key } });
  return t ? requestTypeLabel(t) : key;
}
