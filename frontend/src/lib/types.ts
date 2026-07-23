export type RequestType = "BUG" | "ISSUE" | "SUGGESTION";
export type OperatorStatus = "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED";

export interface ModuleCount {
  id: number;
  name: string;
  emoji: string;
  count: number;
}

export interface ModuleItem {
  id: number;
  name: string;
  emoji: string;
  isActive: boolean;
  sortOrder: number;
  requestsCount: number;
  createdAt: string;
}

export interface Overview {
  total: number;
  byType: Partial<Record<RequestType, number>>;
  byModule: ModuleCount[];
}

export interface WeekPoint {
  weekStart: string;
  label: string;
  total: number;
  bug: number;
  issue: number;
  suggestion: number;
}

export interface SchoolStat {
  id: number;
  name: string;
  count: number;
}

export interface AttachmentInfo {
  id: number;
  kind: string;
  caption: string | null;
}

export interface RequestItem {
  id: number;
  ticket: string;
  type: RequestType;
  moduleId: number;
  module: string;
  moduleEmoji: string;
  school: string;
  schoolId: number;
  operator: string;
  operatorId: number;
  description: string;
  attachments: AttachmentInfo[];
  createdAt: string;
}

export interface RequestsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: RequestItem[];
}

export interface Operator {
  id: number;
  fullName: string;
  phone: string | null;
  username: string | null;
  status: OperatorStatus;
  isAdmin: boolean;
  requestsCount: number;
  createdAt: string;
}

export interface School {
  id: number;
  name: string;
  requestsCount: number;
  createdAt: string;
}
