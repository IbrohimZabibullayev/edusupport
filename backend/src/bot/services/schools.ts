import { School } from "@prisma/client";
import { prisma } from "../../db";

/**
 * Maktab nomini taqqoslash uchun soddalashtiradi:
 * "Najot Ta'lim" · "najot  talim" · "NAJOT TAʼLIM" → "najot talim"
 *
 * O'zbekchada apostrof bir necha xil belgi bilan yoziladi (' ’ ʻ ʼ `) va ko'pchilik
 * uni umuman tashlab ketadi — shuning uchun apostrof butunlay olib tashlanadi.
 */
export function normalizeSchool(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`´ʻʼ‘’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Levenshtein masofasi (imlo xatosini topish uchun) */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Uzunlikka qarab nechta harf xatosi kechiriladi */
function allowedTypos(len: number): number {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

export type SchoolMatch =
  | { kind: "exact"; school: School }
  | { kind: "similar"; schools: School[] }
  | { kind: "none" };

/**
 * Yozilgan nomga mos maktabni topadi.
 * - "exact": normalizatsiyadan keyin aynan mos keldi — so'ramasdan ishlatiladi
 * - "similar": imlo xatosi yoki qisqartma bo'lishi mumkin — operatordan so'raladi
 *
 * Imlo xatosi prefiksdan ustun: "najot talimm" uchun avval "Najot Ta'lim"
 * (1 harf farq), keyin "Najot" (qisqartma) taklif qilinadi.
 */
export async function matchSchool(name: string): Promise<SchoolMatch> {
  const key = normalizeSchool(name);
  if (!key) return { kind: "none" };

  const all = await prisma.school.findMany();
  const keyed = all.map((s) => ({ s, k: s.nameKey || normalizeSchool(s.name) }));

  const exact = keyed.find((x) => x.k === key);
  if (exact) return { kind: "exact", school: exact.s };

  const PREFIX_PENALTY = 100; // har qanday imlo mosligi prefiksdan yaxshiroq
  const candidates: { s: School; score: number }[] = [];
  for (const { s, k } of keyed) {
    const dist = editDistance(key, k);
    if (dist <= allowedTypos(Math.min(key.length, k.length))) {
      candidates.push({ s, score: dist });
      continue;
    }
    if (k.startsWith(key + " ") || key.startsWith(k + " ")) {
      candidates.push({ s, score: PREFIX_PENALTY + Math.abs(key.length - k.length) });
    }
  }
  if (candidates.length === 0) return { kind: "none" };
  candidates.sort((a, b) => a.score - b.score);
  return { kind: "similar", schools: candidates.slice(0, 3).map((c) => c.s) };
}

/** Ikki nom bir maktabning turli yozilishi bo'lishi mumkinmi */
function looksSame(a: string, b: string): boolean {
  if (a === b) return true;
  if (editDistance(a, b) <= allowedTypos(Math.min(a.length, b.length))) return true;
  return a.startsWith(b + " ") || b.startsWith(a + " ");
}

/**
 * O'xshash nomli maktablarni guruhlarga ajratadi (admin panelda birlashtirish uchun).
 * Bitta guruhda 2 va undan ortiq yozuv bo'lsa — dublikat gumoni.
 */
export function duplicateGroups(schools: School[]): School[][] {
  const keyed = schools.map((s) => ({ s, k: s.nameKey || normalizeSchool(s.name) })).filter((x) => x.k);
  const parent = keyed.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  for (let i = 0; i < keyed.length; i++) {
    for (let j = i + 1; j < keyed.length; j++) {
      if (looksSame(keyed[i].k, keyed[j].k)) parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, School[]>();
  keyed.forEach((x, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), x.s]);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Maktab yaratadi (nameKey bilan) */
export function createSchool(name: string, operatorId: number) {
  return prisma.school.create({
    data: { name, nameKey: normalizeSchool(name), createdByOperatorId: operatorId },
  });
}
