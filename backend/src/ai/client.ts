import { config } from "../config";
import { anthropicProvider } from "./providers/anthropic";
import { googleProvider } from "./providers/google";
import { AiProvider } from "./types";

/**
 * Qaysi AI ishlatilishi .env dagi kalitga qarab o'zi aniqlanadi:
 *
 *   GOOGLE_API_KEY=...      → Google AI Studio (Gemini)
 *   ANTHROPIC_API_KEY=...   → Anthropic (Claude)
 *
 * Ikkalasi ham berilsa Google ustun turadi. Hech biri berilmasa assistent
 * o'chadi va bot eski tugmali rejimda ishlayveradi.
 *
 * Modelni AI_MODEL bilan almashtirsa bo'ladi. Sukut bo'yicha:
 *   Google    — gemini-2.5-flash (tez va arzon, kundalik ish uchun yetarli)
 *   Anthropic — claude-sonnet-5
 *
 * Modelni tanlashdan oldin kalitingiz qaysi modellarga ruxsat berishini
 * ko'rish uchun: npm run models
 */
export function aiEnabled(): boolean {
  return config.googleApiKey.length > 0 || config.anthropicApiKey.length > 0;
}

export function aiProvider(): AiProvider {
  if (config.googleApiKey) return googleProvider;
  return anthropicProvider;
}

/** Loglar va diagnostika uchun: "google · gemini-2.5-flash" */
export function aiLabel(): string {
  if (!aiEnabled()) return "o'chirilgan";
  const p = aiProvider();
  return `${p.name} · ${p.model}`;
}
