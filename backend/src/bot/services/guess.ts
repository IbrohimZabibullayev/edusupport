import { prisma } from "../../db";
import { normalizeSchool as normalizeText } from "./schools";
import { getActiveModules } from "./modules";
import { getActiveRequestTypes } from "./requestTypes";

/**
 * Mijoz matnidan so'rov turi va modulni taxmin qiladi.
 *
 * Ikki manba: (1) tur/modul nomlarining o'zi — sozlash shart emas,
 * (2) GuessKeyword jadvalidagi sinonimlar (admin panelda tahrirlanadi).
 * Hashtag (#taklif) eng kuchli signal — u boshqa hammasidan ustun.
 */

const CACHE_MS = 30_000;
let cache: { at: number; rows: { kind: string; target: string; keyword: string }[] } | null = null;

export function invalidateGuessCache(): void {
  cache = null;
}

async function keywords(): Promise<{ kind: string; target: string; keyword: string }[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = await prisma.guessKeyword.findMany();
  const mapped = rows.map((r) => ({ kind: r.kind, target: r.target, keyword: normalizeText(r.keyword) }));
  cache = { at: Date.now(), rows: mapped };
  return mapped;
}

/** Matnda so'z butun holda uchraydimi (qism-satr emas — "bug" "debug" ichida hisoblanmasin) */
function hasWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(haystack);
}

/** Matndagi hashtaglar, normalizatsiya qilingan holda */
function hashtags(text: string): string[] {
  return [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => normalizeText(m[1])).filter(Boolean);
}

export interface Guess {
  typeKey: string | null;
  moduleId: number | null;
}

export async function guessFromText(rawText: string): Promise<Guess> {
  const text = normalizeText(rawText);
  const tags = hashtags(rawText);
  const [types, modules, kw] = await Promise.all([getActiveRequestTypes(), getActiveModules(), keywords()]);

  // --- So'rov turi ---
  let typeKey: string | null = null;
  // 1) hashtag tur nomiga yoki kalit so'ziga mos kelsa
  for (const tag of tags) {
    const byName = types.find((t) => normalizeText(t.name) === tag);
    if (byName) {
      typeKey = byName.key;
      break;
    }
    const byKw = kw.find((k) => k.kind === "TYPE" && k.keyword === tag);
    if (byKw) {
      typeKey = byKw.target;
      break;
    }
  }
  // 2) matn ichidagi kalit so'z (uzunroq — aniqroq)
  if (!typeKey) {
    const typeKw = kw.filter((k) => k.kind === "TYPE").sort((a, b) => b.keyword.length - a.keyword.length);
    const hit = typeKw.find((k) => hasWord(text, k.keyword));
    if (hit) typeKey = hit.target;
  }
  if (typeKey && !types.some((t) => t.key === typeKey)) typeKey = null; // tur o'chirilgan bo'lsa

  // --- Modul ---
  let moduleId: number | null = null;
  const moduleKw = kw.filter((k) => k.kind === "MODULE").sort((a, b) => b.keyword.length - a.keyword.length);
  for (const tag of tags) {
    const hit = moduleKw.find((k) => k.keyword === tag);
    if (hit) {
      moduleId = Number(hit.target);
      break;
    }
  }
  if (moduleId === null) {
    const hit = moduleKw.find((k) => hasWord(text, k.keyword));
    if (hit) moduleId = Number(hit.target);
  }
  // Modul nomining o'zi matnda uchrasa ("dars jadvali", "ombor")
  if (moduleId === null) {
    const byName = modules
      .map((m) => ({ id: m.id, k: normalizeText(m.name.replace(/\(.*?\)/g, "")) }))
      .filter((m) => m.k.length >= 4)
      .sort((a, b) => b.k.length - a.k.length)
      .find((m) => hasWord(text, m.k));
    if (byName) moduleId = byName.id;
  }
  if (moduleId !== null && !modules.some((m) => m.id === moduleId)) moduleId = null;

  return { typeKey, moduleId };
}
