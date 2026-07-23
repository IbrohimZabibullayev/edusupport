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
