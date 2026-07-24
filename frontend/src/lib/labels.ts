import { OperatorStatus } from "./types";

/** Tur o'chirilgan/yuklanmagan bo'lsa grafiklar uchun zaxira rang */
export const FALLBACK_TYPE_COLOR = "#898781";

export const STATUS_LABELS: Record<OperatorStatus, string> = {
  PENDING: "Kutilmoqda",
  APPROVED: "Tasdiqlangan",
  REJECTED: "Rad etilgan",
  BLOCKED: "Bloklangan",
};

/** Daqiqani "X soat Y daqiqa" ko'rinishiga o'giradi */
export function formatMinutes(min: number): string {
  if (!min || min <= 0) return "0 daqiqa";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} soat` : "", m ? `${m} daqiqa` : ""].filter(Boolean).join(" ");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
