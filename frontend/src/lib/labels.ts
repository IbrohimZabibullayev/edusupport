import { OperatorStatus } from "./types";

/** Tur o'chirilgan/yuklanmagan bo'lsa grafiklar uchun zaxira rang */
export const FALLBACK_TYPE_COLOR = "#898781";

export const STATUS_LABELS: Record<OperatorStatus, string> = {
  PENDING: "Kutilmoqda",
  APPROVED: "Tasdiqlangan",
  REJECTED: "Rad etilgan",
  BLOCKED: "Bloklangan",
};

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
