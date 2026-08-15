import { GoogleGenAI } from "@google/genai";
import { config } from "../config";

/**
 * Kalitingiz qaysi modellarga ruxsat berishini ko'rsatadi: `npm run models`
 *
 * Model nomlari vaqt o'tishi bilan o'zgaradi va har bir kalitga hammasi ham
 * ochiq bo'lmaydi. Taxmin qilib .env ga yozgandan ko'ra ro'yxatni ko'rib
 * tanlagan yaxshi. Tanlaganingizni AI_MODEL ga yozasiz.
 */
async function main(): Promise<void> {
  if (!config.googleApiKey) {
    console.error("GOOGLE_API_KEY .env da yo'q — avval kalitni qo'ying.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: config.googleApiKey });
  const rows: { name: string; label: string; input: number }[] = [];

  for await (const m of await ai.models.list()) {
    const actions = m.supportedActions ?? [];
    // Bizga faqat suhbat modellari kerak (embedding va rasm modellari emas)
    if (actions.length > 0 && !actions.includes("generateContent")) continue;
    const name = (m.name ?? "").replace(/^models\//, "");
    if (!name) continue;
    rows.push({ name, label: m.displayName ?? "", input: m.inputTokenLimit ?? 0 });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`\nKalitingizga ochiq ${rows.length} ta model:\n`);
  for (const r of rows) {
    const limit = r.input > 0 ? `${Math.round(r.input / 1000)}K kontekst` : "";
    console.log(`  ${r.name.padEnd(42)} ${limit.padEnd(16)} ${r.label}`);
  }
  console.log(`\nHozir ishlatilayotgani: ${config.aiModel || "gemini-2.5-flash (sukut)"}`);
  console.log("Almashtirish uchun .env ga:  AI_MODEL=<nom>\n");
}

main().catch((err) => {
  console.error("Ro'yxatni ololmadim:", err?.message ?? err);
  process.exit(1);
});
