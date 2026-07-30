/**
 * Grafiklar uchun yagona sokin palitra.
 *
 * Hammasi dataviz validatoridan o'tgan (yorug'lik oralig'i, chroma, rang ko'rmaslikda
 * ajralish, oq fonga kontrast). Yorqin ranglardan ataylab voz kechilgan — panel kun
 * bo'yi ochiq turadi, ko'z toliqmasligi kerak.
 *
 * Qo'lda o'zgartirishdan oldin validatordan o'tkazing: yashil terrakota bilan
 * protanopiyada qo'shilib ketadi, shuning uchun uchinchi slot ko'kish-yashil.
 */
export const CHART = {
  /** Guruhga yuborilgan so'rovlar */
  requests: "#2f6a9e",
  /** Support log — operator o'zi hal qilgan */
  logs: "#b86a3c",
  /** Uchinchi kategoriya */
  third: "#2e9e86",
} as const;

/** Matn va to'r ranglari — grafik ichida hamma joyda bir xil */
export const CHART_INK = {
  axis: "#898781",
  label: "#52514e",
  grid: "#e1e0d9",
  surface: "#fcfcfb",
} as const;

/** O'sish/pasayish belgisi (doim strelka yoki matn bilan birga) */
export const TREND_TONE = {
  good: "#3f7d5a",
  bad: "#a8514c",
} as const;
