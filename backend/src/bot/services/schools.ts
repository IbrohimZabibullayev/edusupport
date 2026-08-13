import { School } from "@prisma/client";
import { prisma } from "../../db";

/** Kirillcha yozilgan nom lotinchasi bilan taqqoslanishi uchun */
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/**
 * Maktab nomini taqqoslash uchun soddalashtiradi:
 * "Najot Ta'lim" · "najot  talim" · "NAJOT TAʼLIM" · "Нажот Талим" → "najot talim"
 *
 * O'zbekchada apostrof bir necha xil belgi bilan yoziladi (' ’ ʻ ʼ `) va ko'pchilik
 * uni umuman tashlab ketadi — shuning uchun apostrof butunlay olib tashlanadi.
 * Kirillcha harflar lotinchaga o'giriladi, aks holda bir maktab ikki alifboda
 * ikki xil yozuv bo'lib qoladi.
 */
export function normalizeSchool(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`´ʻʼ‘’]/g, "")
    .replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? ch)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Nomdagi "umumiy" so'zlar — ular maktabni ajratmaydi, shuning uchun
 * taqqoslashda hisobga olinmaydi. "Nur maktab" va "Nur o'quv markazi" —
 * o'zagi bir xil, demak bir joy bo'lishi ehtimoli katta (so'raymiz, o'zimiz qo'shmaymiz).
 */
const NOISE = new Set([
  "maktab", "maktabi", "school", "shkola", "markaz", "markazi", "center", "centre",
  "oquv", "talim", "ta", "lim", "litsey", "lyceum", "akademiya", "academy",
  "gimnaziya", "gymnasium", "mtm", "bogcha", "universitet", "institut", "filial",
  "xususiy", "nodavlat", "ijodiy", "uchebniy",
]);

/** Nomning ajratuvchi o'zagi: umumiy so'zlarsiz, alifbo tartibida */
export function coreKey(name: string): string {
  const tokens = normalizeSchool(name)
    .split(" ")
    .filter((w) => w && !NOISE.has(w));
  return tokens.sort().join(" ");
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
  if (len <= 12) return 2;
  return 3;
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
  const scored = await scoreSchools(name);
  if (scored.length === 0) return { kind: "none" };
  if (scored[0].score === 0) return { kind: "exact", school: scored[0].s };
  return { kind: "similar", schools: scored.slice(0, 3).map((c) => c.s) };
}

/**
 * Yozilgan nomga mos kelishi mumkin bo'lgan maktablar — eng yaqini birinchi.
 *
 * Bot hech qachon o'zi tanlamaydi: operator nomni yozganda ro'yxat chiqadi va u
 * "shulardan biri" yoki "yangi" deb o'zi aytadi. Aynan mos kelgan nom ham
 * ro'yxatning boshida turadi, lekin baribir tasdiqlanadi.
 */
export async function schoolCandidates(name: string, limit = 5): Promise<School[]> {
  return (await scoreSchools(name)).slice(0, limit).map((c) => c.s);
}

/**
 * Nomzodlarni ballaydi: 0 — aynan mos, kichik ball — imlo xatosi,
 * keyin o'zak mosligi, oxirida prefiks/qisqartma.
 */
async function scoreSchools(name: string): Promise<{ s: School; score: number }[]> {
  const key = normalizeSchool(name);
  if (!key) return [];

  const all = await prisma.school.findMany();
  const CORE_PENALTY = 50;
  const PREFIX_PENALTY = 100;
  const core = coreKey(name);
  const out: { s: School; score: number }[] = [];

  for (const s of all) {
    const k = s.nameKey || normalizeSchool(s.name);
    if (k === key) {
      out.push({ s, score: 0 });
      continue;
    }
    const dist = editDistance(key, k);
    if (dist <= allowedTypos(Math.min(key.length, k.length))) {
      out.push({ s, score: dist });
      continue;
    }
    // O'zagi bir xil: "Nur maktab" ↔ "Nur o'quv markazi", "Sodiq School" ↔ "School Sodiq"
    const sCore = coreKey(s.name);
    if (core && sCore && (core === sCore || isSubset(core, sCore) || isSubset(sCore, core))) {
      out.push({ s, score: CORE_PENALTY + editDistance(core, sCore) });
      continue;
    }
    if (k.startsWith(key + " ") || key.startsWith(k + " ")) {
      out.push({ s, score: PREFIX_PENALTY + Math.abs(key.length - k.length) });
    }
  }
  return out.sort((a, b) => a.score - b.score);
}

/** a ning hamma so'zi b da bormi (o'zaklar uchun) */
function isSubset(a: string, b: string): boolean {
  const bw = new Set(b.split(" "));
  const aw = a.split(" ");
  return aw.length > 0 && aw.every((w) => bw.has(w));
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

/** Eng ko'p ishlatilgan maktablar — "ro'yxatdan tanlash" uchun */
export async function popularSchools(limit = 12): Promise<{ id: number; name: string }[]> {
  const rows = await prisma.school.findMany({
    select: { id: true, name: true, _count: { select: { requests: true, supportLogs: true } } },
  });
  return rows
    .sort((a, b) => b._count.requests + b._count.supportLogs - (a._count.requests + a._count.supportLogs))
    .slice(0, limit)
    .map((s) => ({ id: s.id, name: s.name }));
}

/** Maktab yaratadi (nameKey bilan) */
export function createSchool(name: string, operatorId: number) {
  return prisma.school.create({
    data: { name, nameKey: normalizeSchool(name), createdByOperatorId: operatorId },
  });
}
