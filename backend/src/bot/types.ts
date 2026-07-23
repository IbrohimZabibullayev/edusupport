import { Context, SessionFlavor } from "grammy";
import { RequestType } from "@prisma/client";

export type Step =
  | "idle"
  | "reg_name"
  | "reg_phone"
  | "req_type"
  | "req_module"
  | "req_school"
  | "req_desc"
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
  type?: RequestType;
  moduleId?: number;
  schoolId?: number;
  descTexts?: string[];
  attachments?: DraftAttachment[];
}

export interface SessionData {
  step: Step;
  regName?: string;
  draft?: RequestDraft;
  adminLogin?: string;
}

export type MyContext = Context & SessionFlavor<SessionData>;
