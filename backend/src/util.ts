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
