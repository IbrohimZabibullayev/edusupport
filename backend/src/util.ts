import { timingSafeEqual } from "crypto";

export function ticketId(ticketNumber: number): string {
  return `ES-${String(ticketNumber).padStart(4, "0")}`;
}

export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Erkin yozilgan davomiylikni daqiqaga o'giradi.
 * Qabul qiladi: "20", "20 daqiqa", "1 soat", "1 soat 20 daqiqa", "1s 20d", "1:20".
 * Aniqlab bo'lmasa null qaytaradi.
 */
export function parseDurationToMinutes(text: string): number | null {
  const t = text.toLowerCase().trim();
  if (/^\d+$/.test(t)) return Number(t); // faqat raqam — daqiqa deb olamiz
  const colon = t.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);

  let minutes = 0;
  let matched = false;
  const hour = t.match(/(\d+)\s*(soat|saat|s|h|час|ч)\b/);
  if (hour) {
    minutes += Number(hour[1]) * 60;
    matched = true;
  }
  const min = t.match(/(\d+)\s*(daqiqa|daq|min|m|мин|м)\b/);
  if (min) {
    minutes += Number(min[1]);
    matched = true;
  }
  return matched ? minutes : null;
}

/** Daqiqani "X soat Y daqiqa" ko'rinishiga o'giradi */
export function formatMinutes(min: number): string {
  if (!min || min <= 0) return "0 daqiqa";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} soat` : "", m ? `${m} daqiqa` : ""].filter(Boolean).join(" ");
}

/** Ikki payt orasidagi masofa: "2 kun 4 soat", "3 soat", "25 daqiqa" */
export function formatSpan(from: Date, to: Date): string {
  const min = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  if (days > 0) return [`${days} kun`, hours ? `${hours} soat` : ""].filter(Boolean).join(" ");
  if (hours > 0) return `${hours} soat`;
  return `${min} daqiqa`;
}

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Asia/Tashkent bo'yicha sana va soatdan UTC Date yasaydi */
export function tashkentAt(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - TZ_OFFSET_MS);
}

/**
 * Operator yozgan vaqtni tushunadi (Asia/Tashkent bo'yicha).
 *
 * Qabul qiladi: "14:30", "bugun 14:30", "ertaga 9:00", "indinga 10.15",
 * "02.08 15:00", "2.8.2026 15:00", "02/08 15:00".
 * Faqat soat berilsa va u o'tib ketgan bo'lsa — ertangi kun deb olinadi.
 * Tushunib bo'lmasa null.
 */
export function parseWhenTashkent(text: string, now = new Date()): Date | null {
  const t = text.toLowerCase().trim().replace(/\s+/g, " ");

  // Soatni avval ikki nuqta bilan qidiramiz: "05.08 15:00" da nuqta sanaga tegishli,
  // shuning uchun topilgan soat matndan olib tashlanadi va sana qolganidan qidiriladi.
  let rest = t;
  let time = t.match(/(\d{1,2}):(\d{2})/);
  if (time) {
    rest = t.slice(0, time.index) + " " + t.slice(time.index! + time[0].length);
  } else {
    // Ikki nuqta yo'q: "9.30" kabi yozuv soat deb olinadi, lekin yil bilan yozilgan
    // sana ("05.08.2026") bo'lsa avval o'shani ajratamiz
    const dated = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
    if (dated) rest = t.slice(0, dated.index) + " " + t.slice(dated.index! + dated[0].length);
    time = rest.match(/(\d{1,2})\.(\d{2})/);
    if (time) {
      rest = dated ? dated[0] : "";
    }
  }
  if (!time) return null;

  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;

  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  let year = local.getUTCFullYear();
  let month = local.getUTCMonth();
  let day = local.getUTCDate();

  const date = rest.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (date) {
    day = Number(date[1]);
    month = Number(date[2]) - 1;
    if (date[3]) {
      const y = Number(date[3]);
      year = y < 100 ? 2000 + y : y;
    }
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    return tashkentAt(year, month, day, hour, minute);
  }

  if (/\bertaga\b/.test(t)) day += 1;
  else if (/\bindinga\b/.test(t)) day += 2;
  else if (!/\bbugun\b/.test(t)) {
    // Faqat soat yozilgan: o'tib ketgan bo'lsa ertaga
    const todayAt = tashkentAt(year, month, day, hour, minute);
    return todayAt.getTime() <= now.getTime() ? tashkentAt(year, month, day + 1, hour, minute) : todayAt;
  }
  return tashkentAt(year, month, day, hour, minute);
}

/**
 * Hafta kunlari — "juma", "payshanbagacha" kabi muddatlar uchun (0 = yakshanba).
 * Oxirida \b yo'q: o'zbekchada qo'shimcha qo'shiladi ("-gacha", "-da", "-ga").
 * Tartib muhim — "shanba" oxirida turadi, aks holda "payshanba" ni yeb qo'yardi.
 */
const WEEKDAYS: [RegExp, number][] = [
  [/\byakshanba/, 0],
  [/\bdushanba/, 1],
  [/\bseshanba/, 2],
  [/\bchorshanba/, 3],
  [/\bpayshanba/, 4],
  [/\bjuma/, 5],
  [/\bshanba/, 6],
];

/**
 * Muddatni tushunadi — kun darajasida, soatsiz.
 *
 * `parseWhenTashkent` dan farqi: u soat talab qiladi ("ertaga 9:00"), muddat
 * esa odatda soatsiz aytiladi ("ertaga", "3 kun", "jumagacha", "20.08").
 * Natija — o'sha kunning oxiri (23:59), tugmalar orqali qo'yiladigan muddat
 * bilan bir xil.
 *
 * Aniq soat aytilgan bo'lsa (masalan "ertaga 15:00") o'sha soat qaytadi.
 */
export function parseDeadlineTashkent(text: string, now = new Date()): Date | null {
  const t = text.toLowerCase().trim().replace(/\s+/g, " ");
  if (t.length === 0) return null;

  // Soat ham aytilgan bo'lsa — aniqroq, o'shani ishlatamiz
  if (/\d{1,2}:\d{2}/.test(t)) {
    const exact = parseWhenTashkent(t, now);
    if (exact) return exact;
  }

  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  const endOf = (plusDays: number) =>
    new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + plusDays, 23, 59, 0) - TZ_OFFSET_MS
    );

  if (/\bbugun\b|\bshu kun\b/.test(t)) return endOf(0);
  if (/\bertaga\b|\bertagacha\b/.test(t)) return endOf(1);
  if (/\bindinga\b/.test(t)) return endOf(2);

  // "3 kun", "3 kundan keyin", "2 hafta"
  const span = t.match(/(\d{1,2})\s*(kun|hafta|oy)/);
  if (span) {
    const n = Number(span[1]);
    if (n > 0 && n < 100) {
      if (span[2] === "kun") return endOf(n);
      if (span[2] === "hafta") return endOf(n * 7);
      return endOf(n * 30);
    }
  }
  if (/\bhafta\b/.test(t)) return endOf(7);

  // "juma", "dushanbagacha" — shu hafta kelmagan bo'lsa keyingi hafta
  for (const [re, target] of WEEKDAYS) {
    if (!re.test(t)) continue;
    const diff = (target - local.getUTCDay() + 7) % 7;
    return endOf(diff === 0 ? 7 : diff);
  }

  // "20.08", "20.08.2026", "20/08"
  const date = t.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (date) {
    const day = Number(date[1]);
    const month = Number(date[2]) - 1;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    let year = local.getUTCFullYear();
    if (date[3]) {
      const y = Number(date[3]);
      year = y < 100 ? 2000 + y : y;
    }
    return new Date(Date.UTC(year, month, day, 23, 59, 0) - TZ_OFFSET_MS);
  }

  return null;
}

/** Faqat soat: "14:30" (Asia/Tashkent) */
export function formatTashkentTime(date: Date): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Faqat sana: "29.07.2026" */
export function formatTashkentDate(date: Date): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Asia/Tashkent bo'yicha kun oxiri (23:59) — bugundan `plusDays` keyin */
export function tashkentDayEnd(date: Date, plusDays = 0): Date {
  const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  const end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + plusDays, 23, 59, 0);
  return new Date(end - TZ_OFFSET_MS);
}

export function formatTashkent(date: Date): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Asia/Tashkent (UTC+5, DST yo'q) bo'yicha kun boshi (00:00) — UTC Date qaytaradi */
export function tashkentDayStart(date: Date, daysAgo = 0): Date {
  const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysAgo);
  return new Date(midnight - TZ_OFFSET_MS);
}

/** Asia/Tashkent bo'yicha oy boshi (1-sana 00:00) — UTC Date qaytaradi */
export function tashkentMonthStart(date: Date, monthsAgo = 0): Date {
  const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  const first = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsAgo, 1);
  return new Date(first - TZ_OFFSET_MS);
}

/** Asia/Tashkent (UTC+5, DST yo'q) bo'yicha hafta boshi (dushanba 00:00) — UTC Date qaytaradi */
export function tashkentWeekStart(date: Date, weeksAgo = 0): Date {
  const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  const day = local.getUTCDay(); // 0=yakshanba
  const daysFromMonday = (day + 6) % 7;
  const monday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysFromMonday - weeksAgo * 7
  );
  return new Date(monday - TZ_OFFSET_MS);
}
