import { prisma } from "../../db";

/**
 * Bo'lim (topic) nomidan so'rov turini aniqlash.
 * Bot API bo'limlar ro'yxatini bermaydi, shuning uchun bot guruhdagi xabarlar
 * bilan birga keladigan bo'lim nomlaridan o'zi o'rganib boradi.
 *
 * Kalit so'zlar bazada (TopicKeyword) saqlanadi va admin panelda tahrirlanadi —
 * kodni o'zgartirish shart emas. Har xabarda bazaga bormaslik uchun qisqa kesh.
 */
const CACHE_MS = 30_000;
let cache: { at: number; rows: { type: string; keyword: string }[] } | null = null;

/** API kalit so'zlarni o'zgartirganda keshni darhol yangilash uchun */
export function invalidateTopicKeywordCache(): void {
  cache = null;
  seen.clear(); // bo'limlar yangi qoidalar bo'yicha qayta baholansin
}

async function loadKeywords(): Promise<{ type: string; keyword: string }[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = await prisma.topicKeyword.findMany();
  const mapped = rows.map((r) => ({ type: r.type, keyword: r.keyword.toLowerCase() }));
  // Uzunroq (aniqroq) kalit so'z avval tekshiriladi
  mapped.sort((a, b) => b.keyword.length - a.keyword.length);
  cache = { at: Date.now(), rows: mapped };
  return mapped;
}

export async function matchTopicType(name: string): Promise<string | null> {
  const lower = name.toLowerCase();
  for (const { type, keyword } of await loadKeywords()) {
    if (keyword && lower.includes(keyword)) return type;
  }
  return null;
}

// Har xabarda bazaga yozmaslik uchun: shu runtime'da ko'rilgan (chat, thread, nom) lar
const seen = new Set<string>();

/**
 * Bo'lim nomini ko'rganda biriktirmani yangilaydi.
 * Admin /settopic bilan qo'lda biriktirgan yozuvlarga tegmaydi.
 */
export async function learnTopic(chatId: string, threadId: number, name: string): Promise<void> {
  const key = `${chatId}:${threadId}:${name}`;
  if (seen.has(key)) return;
  if (seen.size > 500) seen.clear();
  seen.add(key);

  const type = await matchTopicType(name);

  // Bo'lim boshqa nomga o'zgargan bo'lsa — shu threadga eski avto-biriktirmalarni tozalaymiz
  await prisma.groupTopic.deleteMany({
    where: { chatId, threadId, auto: true, ...(type ? { NOT: { type } } : {}) },
  });
  if (!type) return;

  const existing = await prisma.groupTopic.findUnique({ where: { chatId_type: { chatId, type } } });
  if (existing && !existing.auto) return; // qo'lda biriktirilgan — ustidan yozmaymiz
  if (existing && existing.threadId === threadId) return;

  await prisma.groupTopic.upsert({
    where: { chatId_type: { chatId, type } },
    create: { chatId, type, threadId, auto: true },
    update: { threadId, auto: true },
  });
  console.log(`Bo'lim avto-biriktirildi: ${chatId} guruhida "${name}" (#${threadId}) → ${type}`);
}
