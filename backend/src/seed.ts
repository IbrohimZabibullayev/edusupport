import { prisma } from "./db";

const DEFAULT_MODULES = [
  { name: "Moliya (to'lovlar)", emoji: "💰" },
  { name: "Lidlar (CRM)", emoji: "📋" },
  { name: "Dars jadvali", emoji: "📅" },
  { name: "Jurnal (davomat/baho)", emoji: "📖" },
  { name: "Topshiriqlar", emoji: "✅" },
  { name: "O'quv bo'limi", emoji: "🎓" },
  { name: "Imtihonlar / Blok Test", emoji: "📝" },
  { name: "Analitika / Dashboard", emoji: "📊" },
  { name: "Gamifikatsiya / Xulq-atvor", emoji: "🏆" },
  { name: "Ombor", emoji: "📦" },
  { name: "Chat", emoji: "💬" },
  { name: "Boshqaruv / Sozlamalar", emoji: "⚙️" },
  { name: "Kirish / akkaunt", emoji: "🔑" },
  { name: "Boshqa", emoji: "❓" },
];

/** Modullar jadvali bo'sh bo'lsa standart 14 ta modulni qo'shadi (faqat birinchi ishga tushishda) */
export async function ensureDefaultModules(): Promise<void> {
  const count = await prisma.module.count();
  if (count > 0) return;
  await prisma.module.createMany({
    data: DEFAULT_MODULES.map((m, i) => ({ ...m, sortOrder: i + 1 })),
  });
  console.log(`✅ ${DEFAULT_MODULES.length} ta standart modul bazaga qo'shildi`);
}

const DEFAULT_SYSTEMS = ["Edu Tizim", "EduSchool"];

/** Tizimlar jadvali bo'sh bo'lsa standart tizimlarni qo'shadi */
export async function ensureDefaultSystems(): Promise<void> {
  const count = await prisma.system.count();
  if (count > 0) return;
  await prisma.system.createMany({
    data: DEFAULT_SYSTEMS.map((name, i) => ({ name, sortOrder: i + 1 })),
  });
  console.log(`✅ ${DEFAULT_SYSTEMS.length} ta tizim bazaga qo'shildi`);
}

const DEFAULT_REQUEST_TYPES = [
  { key: "BUG", name: "Bug", emoji: "🐞", color: "#2a78d6", sortOrder: 1 },
  { key: "ISSUE", name: "Muammo-savol", emoji: "❓", color: "#eb6834", sortOrder: 2 },
  { key: "SUGGESTION", name: "Taklif", emoji: "💡", color: "#1baf7a", sortOrder: 3 },
];

/** So'rov turlari jadvali bo'sh bo'lsa standart 3 turni qo'shadi (migratsiya seed'i uchun zaxira) */
export async function ensureDefaultRequestTypes(): Promise<void> {
  const count = await prisma.requestType.count();
  if (count > 0) return;
  await prisma.requestType.createMany({ data: DEFAULT_REQUEST_TYPES });
  console.log(`✅ ${DEFAULT_REQUEST_TYPES.length} ta standart so'rov turi qo'shildi`);
}

const DEFAULT_TOPIC_KEYWORDS: { type: string; keyword: string }[] = [
  { type: "BUG", keyword: "bug" },
  { type: "BUG", keyword: "баг" },
  { type: "ISSUE", keyword: "savol" },
  { type: "ISSUE", keyword: "muammo" },
  { type: "ISSUE", keyword: "aniqlash" },
  { type: "ISSUE", keyword: "савол" },
  { type: "ISSUE", keyword: "муаммо" },
  { type: "SUGGESTION", keyword: "taklif" },
  { type: "SUGGESTION", keyword: "feature" },
  { type: "SUGGESTION", keyword: "g'oya" },
  { type: "SUGGESTION", keyword: "таклиф" },
  { type: "SUGGESTION", keyword: "фича" },
];

/** Kalit so'zlar jadvali bo'sh bo'lsa standart qiymatlarni qo'shadi (migratsiya seed'i uchun zaxira) */
export async function ensureDefaultTopicKeywords(): Promise<void> {
  const count = await prisma.topicKeyword.count();
  if (count > 0) return;
  await prisma.topicKeyword.createMany({ data: DEFAULT_TOPIC_KEYWORDS });
  console.log(`✅ ${DEFAULT_TOPIC_KEYWORDS.length} ta standart bo'lim kalit so'zi qo'shildi`);
}
