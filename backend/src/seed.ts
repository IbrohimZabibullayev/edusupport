import { prisma } from "./db";
import { normalizeSchool } from "./bot/services/schools";

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

/** Mijoz matnidan so'rov turini taxmin qilish uchun kalit so'zlar */
const DEFAULT_TYPE_GUESSES: Record<string, string[]> = {
  BUG: [
    "bug", "xato", "xatolik", "ishlamayapti", "ishlamadi", "ochilmayapti",
    "chiqmayapti", "yuklanmayapti", "ketmayapti", "error", "баг", "ошибка", "не работает",
  ],
  ISSUE: [
    "savol", "muammo", "qanday", "nima uchun", "tushunmadim", "yordam bering",
    "aniqlash", "савол", "муаммо", "вопрос",
  ],
  SUGGESTION: [
    "taklif", "feature", "goya", "qoshsak", "qoshib bering", "bolsa yaxshi",
    "kerak edi", "iltimos qoshing", "таклиф", "фича", "предложение",
  ],
};

/** Modul nomi → matndan tanib olish uchun kalit so'zlar */
const DEFAULT_MODULE_GUESSES: Record<string, string[]> = {
  "Moliya (to'lovlar)": ["tolov", "tolovlar", "pul", "chek", "kassa", "qarz", "hisob raqam", "toladi", "оплата"],
  "Lidlar (CRM)": ["lid", "lidlar", "crm", "лид"],
  "Dars jadvali": ["jadval", "dars jadvali", "raspisaniya", "расписание"],
  "Jurnal (davomat/baho)": ["davomat", "baho", "jurnal", "yoqlama", "posesheniya", "оценка"],
  Topshiriqlar: ["topshiriq", "vazifa", "uy ishi", "задание"],
  "O'quv bo'limi": ["oquv bolimi", "oquv qismi"],
  "Imtihonlar / Blok Test": ["imtihon", "blok test", "test", "экзамен"],
  "Analitika / Dashboard": ["analitika", "dashboard", "statistika", "hisobot", "отчет"],
  "Gamifikatsiya / Xulq-atvor": ["gamifikatsiya", "ball", "reyting", "xulq", "medal", "рейтинг"],
  Ombor: ["ombor", "shop", "mahsulot", "buyurtma", "sklad", "склад", "магазин"],
  Chat: ["chat", "yozishma", "переписка"],
  "Boshqaruv / Sozlamalar": ["sozlama", "sozlamalar", "boshqaruv", "rol", "huquq", "настройки"],
  "Kirish / akkaunt": ["kirish", "parol", "login", "akkaunt", "kira olmayapti", "пароль", "вход"],
};

/** Taxmin kalit so'zlari bo'sh bo'lsa standart qiymatlarni qo'shadi */
export async function ensureDefaultGuessKeywords(): Promise<void> {
  const count = await prisma.guessKeyword.count();
  if (count > 0) return;

  const rows: { kind: string; target: string; keyword: string }[] = [];
  for (const [type, words] of Object.entries(DEFAULT_TYPE_GUESSES)) {
    if (!(await prisma.requestType.findUnique({ where: { key: type } }))) continue;
    for (const keyword of words) rows.push({ kind: "TYPE", target: type, keyword });
  }
  const modules = await prisma.module.findMany();
  for (const [name, words] of Object.entries(DEFAULT_MODULE_GUESSES)) {
    const mod = modules.find((m) => m.name === name);
    if (!mod) continue;
    for (const keyword of words) rows.push({ kind: "MODULE", target: String(mod.id), keyword });
  }
  if (rows.length === 0) return;
  await prisma.guessKeyword.createMany({ data: rows, skipDuplicates: true });
  console.log(`✅ ${rows.length} ta taxmin kalit so'zi qo'shildi`);
}

/** Mavjud maktablarga normalizatsiya kalitini yozib chiqadi (bir marta) */
export async function backfillSchoolKeys(): Promise<void> {
  const rows = await prisma.school.findMany({ where: { nameKey: null } });
  for (const s of rows) {
    await prisma.school.update({ where: { id: s.id }, data: { nameKey: normalizeSchool(s.name) } });
  }
  if (rows.length > 0) console.log(`✅ ${rows.length} ta maktab nomi normalizatsiya qilindi`);
}

const DEFAULT_PRIORITIES = [
  { key: "P1", name: "P1-Shoshilinch", color: "#d64545", sortOrder: 1 },
  { key: "P2", name: "P2-Yuqori", color: "#eb6834", sortOrder: 2 },
  { key: "P3", name: "P3-O'rta", color: "#2a78d6", sortOrder: 3 },
  { key: "P4", name: "P4-Past", color: "#898781", sortOrder: 4 },
];

/** Prioritetlar jadvali bo'sh bo'lsa standart qiymatlarni qo'shadi */
export async function ensureDefaultPriorities(): Promise<void> {
  const count = await prisma.priority.count();
  if (count > 0) return;
  await prisma.priority.createMany({ data: DEFAULT_PRIORITIES });
  console.log(`✅ ${DEFAULT_PRIORITIES.length} ta standart prioritet qo'shildi`);
}
