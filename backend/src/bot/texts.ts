import { RequestType } from "@prisma/client";

export const TYPE_LABELS: Record<RequestType, string> = {
  BUG: "🐞 Bug",
  ISSUE: "❓ Muammo-savol",
  SUGGESTION: "💡 Taklif",
};

export const BTN_NEW_REQUEST = "➕ Yangi so'rov";
export const BTN_BACK = "⬅️ Orqaga";
export const BTN_CANCEL = "❌ Bekor qilish";
export const BTN_SUBMIT = "📤 Jo'natish";

export const LABEL_TO_TYPE: Record<string, RequestType> = Object.fromEntries(
  (Object.entries(TYPE_LABELS) as [RequestType, string][]).map(([k, v]) => [v, k])
);
