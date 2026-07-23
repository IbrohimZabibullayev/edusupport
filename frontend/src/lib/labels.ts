import { OperatorStatus, RequestType } from "./types";

export const TYPE_LABELS: Record<RequestType, string> = {
  BUG: "Bug",
  ISSUE: "Muammo-savol",
  SUGGESTION: "Taklif",
};

/* Kategorik palitra — dataviz reference, 1–3 slotlar (validatsiyadan o'tgan tartib) */
export const TYPE_COLORS: Record<RequestType, string> = {
  BUG: "#2a78d6",
  ISSUE: "#eb6834",
  SUGGESTION: "#1baf7a",
};

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
