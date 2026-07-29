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
  | "fwd_type"
  | "fwd_module"
  | "fwd_school"
  | "fwd_school_text"
  | "fwd_school_confirm"
  | "fix_school_text"
  | "school_confirm"
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
  /** Maktab nomi yozilib, o'xshashi topilganda tasdiqlash uchun */
  pendingSchoolName?: string;
  similarSchoolIds?: number[];
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

export interface SessionData {
  step: Step;
  regName?: string;
  draft?: RequestDraft;
  logDraft?: SupportLogDraft;
  adminLogin?: string;
  /** "✏️ Tuzatish" oqimida maktab nomi yozilayotgan so'rov */
  fixRequestId?: number;
  /** O'xshash maktab topilib tasdiq so'ralganda — qaysi oqimga qaytish kerakligi */
  schoolAsk?: { flow: SchoolFlow; name: string; ids: number[] };
}

/** Maktab so'raladigan oqim: "req" — /new wizard, "log" — support log */
export type SchoolFlow = "req" | "log";

export type MyContext = Context & SessionFlavor<SessionData>;
