/**
 * Provayderdan mustaqil turlar.
 *
 * Bot ikki xil AI bilan ishlay oladi: Google AI Studio (Gemini) va Anthropic
 * (Claude). Ularning xabar formati butunlay boshqacha, shuning uchun suhbat
 * tarixi shu neytral ko'rinishda saqlanadi va har chaqiruvda provayder
 * formatiga o'giriladi.
 *
 * Bu nafaqat kodni soddalashtiradi — provayder almashtirilganda ochiq
 * suhbatlar ham buzilmaydi, chunki sessiyadagi tarix ikkalasiga ham mos.
 */

/** Amal (tool) tavsifi — ikkala provayder uchun ham shu shakldan o'giriladi */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AiToolCall {
  /** Anthropic tool_use_id; Gemini'da id bo'lmasligi mumkin — o'zimiz yasaymiz */
  id: string;
  name: string;
  input: Record<string, unknown>;
  /**
   * Provayderning ichki imzosi — o'zgartirmasdan qaytariladi.
   *
   * Gemini 3.x fikrlaydigan modellari amal chaqiruviga `thoughtSignature`
   * qo'shadi va tarixda o'sha imzo aynan qaytarilishini TALAB qiladi.
   * Tashlab yuborilsa keyingi so'rov 400 bilan yiqiladi.
   */
  signature?: string;
}

export interface AiToolResult {
  id: string;
  name: string;
  output: unknown;
}

/** Suhbatning bir navbati */
export type AiTurn =
  | { role: "user"; text: string }
  | { role: "model"; text?: string; calls?: AiToolCall[]; signature?: string }
  | { role: "tool"; results: AiToolResult[] };

/** Modeldan kelgan bitta javob */
export interface ModelStep {
  text: string;
  calls: AiToolCall[];
  /** Matn qismining imzosi — `AiToolCall.signature` bilan bir maqsadda */
  signature?: string;
  /** Model so'rovni bajarishdan bosh tortdi */
  refused?: boolean;
}

export interface AiProvider {
  name: "google" | "anthropic";
  model: string;
  step(system: string, turns: AiTurn[], tools: ToolSchema[]): Promise<ModelStep>;
}

/** Eski (Anthropic formatidagi) sessiya tarixini ajratish uchun */
export function isNeutralTurn(value: unknown): value is AiTurn {
  if (typeof value !== "object" || value === null) return false;
  const role = (value as { role?: unknown }).role;
  return role === "user" || role === "model" || role === "tool";
}
