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
}

export type MyContext = Context & SessionFlavor<SessionData>;
