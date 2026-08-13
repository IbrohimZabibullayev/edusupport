import { Context, SessionFlavor } from "grammy";

export type Step =
  | "idle"
  | "reg_name"
  | "reg_phone"
  | "req_system"
  | "req_type"
  | "req_module"
  | "req_school"
  | "req_desc"
  | "fwd_collect"
  | "fwd_system"
  | "fwd_type"
  | "fwd_module"
  | "fwd_school"
  | "fwd_school_text"
  | "fwd_school_confirm"
  | "fix_school_text"
  | "school_confirm"
  | "task_title"
  | "task_with"
  | "task_when"
  | "log_system"
  | "log_school"
  | "log_module"
  | "log_problem"
  | "log_priority"
  | "log_time"
  | "log_recurring"
  | "admin_login"
  | "admin_pass";

export interface DraftAttachment {
  kind: string;
  fileId: string;
  caption?: string;
  chatId: number;
  messageId: number;
}

export interface RequestDraft {
  systemId?: number;
  type?: string;
  moduleId?: number;
  schoolId?: number;
  descTexts?: string[];
  attachments?: DraftAttachment[];
  /** Forward oqimi: bot so'ragan xabar — yangi forward kelganda shu xabar tahrirlanadi */
  promptMessageId?: number;
  /** Xabar kimdan forward qilingani — maktabni eslab qolish uchun */
  clientKey?: string;
  clientLabel?: string;
  /** Oxirgi xabar qo'shilgan payt — tashlab ketilgan qoralamani ajratish uchun */
  lastAt?: number;
  /** Maktab nomi yozilib, o'xshashi topilganda tasdiqlash uchun */
  pendingSchoolName?: string;
  similarSchoolIds?: number[];
  /** Maktab operator tomonidan tasdiqlanganmi — xotiradan kelgani ham so'raladi */
  schoolConfirmed?: boolean;
}

export interface TaskDraft {
  title?: string;
  withWhom?: string;
}

export interface SupportLogDraft {
  systemId?: number;
  schoolId?: number;
  moduleId?: number;
  problem?: string;
  priorityId?: number;
  resolveMinutes?: number;
  recurring?: boolean;
}

export interface AiBox {
  texts: string[];
  attachments: DraftAttachment[];
  clientLabel?: string;
  schoolHint?: number;
}

export interface SessionData {
  step: Step;
  regName?: string;
  draft?: RequestDraft;
  logDraft?: SupportLogDraft;
  taskDraft?: TaskDraft;
  /** Assistent suhbati — TTL bilan, eskirsa tashlanadi */
  ai?: { history: unknown[]; lastAt: number };
  /** Forward qilingan xabarlar assistentga berilgunicha shu yerda yig'iladi */
  aiBox?: AiBox;
  /** Tasdiq kutayotgan so'rov qoralamasi */
  aiPending?: unknown;
  adminLogin?: string;
  /** "✏️ Tuzatish" oqimida maktab nomi yozilayotgan so'rov */
  fixRequestId?: number;
  /** O'xshash maktab topilib tasdiq so'ralganda — qaysi oqimga qaytish kerakligi */
  schoolAsk?: { flow: SchoolFlow; name: string; ids: number[] };
}

/** Maktab so'raladigan oqim: "req" — /new wizard, "log" — support log */
export type SchoolFlow = "req" | "log";

export type MyContext = Context & SessionFlavor<SessionData>;
