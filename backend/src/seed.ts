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
