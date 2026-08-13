import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

/**
 * Assistent uchun model tanlovi.
 *
 * Sonnet 5 + effort "low" — 10 ta qiyin holatda o'lchandi:
 *   sonnet-5 low : 10/10, ~7s, oyiga ~$76 (300 xabar/kun)
 *   sonnet-5 med : 10/10, ~8s, oyiga ~$90
 *   haiku-4.5    :  9/10, ~3s, oyiga ~$57 — eng oddiy holatda so'rov yaratmadi
 *
 * Haiku arzonroq va tezroq, lekin asosiy vazifada ishonchsiz. Bundan tashqari
 * uning kesh minimumi 4096 token (bizda prefiks ~2600) — ya'ni prompt keshi
 * umuman ishlamaydi va narx afzalligi yo'qoladi.
 */
export const AI_MODEL = "claude-sonnet-5";
export const AI_EFFORT = "low" as const;
/** Fikrlash ham shu limitga kiradi — javoblar qisqa, lekin joy qoldiramiz */
export const AI_MAX_TOKENS = 8000;

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return config.anthropicApiKey.length > 0;
}

export function aiClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}
