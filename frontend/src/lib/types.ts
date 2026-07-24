/** So'rov turi kaliti (Request.type da saqlanadi) — endi dinamik, string */
export type RequestType = string;
export type OperatorStatus = "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED";

export interface RequestTypeInfo {
  id: number;
  key: string;
  name: string;
  emoji: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  requestsCount: number;
}

export interface ModuleCount {
  id: number;
  name: string;
  emoji: string;
  count: number;
}

export interface SystemItem {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
  groupConnected: boolean;
  requestsCount: number;
  createdAt: string;
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

export interface TopicKeyword {
  id: number;
  type: RequestType;
  keyword: string;
}

export interface Overview {
  total: number;
  byType: Record<string, number>;
  byModule: ModuleCount[];
}

export interface TrendPoint {
  label: string;
  total: number;
}

export interface TrendResponse {
  granularity: "day" | "week";
  points: TrendPoint[];
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
  systemId: number | null;
  system: string | null;
  moduleId: number;
  module: string;
  moduleEmoji: string;
  school: string;
  schoolId: number;
  operator: string;
  operatorId: number;
  description: string;
  done: boolean;
  doneAt: string | null;
  attachments: AttachmentInfo[];
  createdAt: string;
}

export interface ModuleCombined {
  id: number;
  name: string;
  requests: number;
  logs: number;
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

export interface PriorityInfo {
  id: number;
  key: string;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  logsCount: number;
}

export interface SupportLogItem {
  id: number;
  logNumber: number;
  system: string | null;
  systemId: number | null;
  school: string;
  schoolId: number;
  module: string;
  moduleEmoji: string;
  moduleId: number;
  problem: string;
  priority: string | null;
  priorityColor: string | null;
  priorityId: number | null;
  resolveMinutes: number;
  recurring: boolean;
  operator: string;
  operatorId: number;
  createdAt: string;
}

export interface SupportLogsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: SupportLogItem[];
}

export interface SupportLogStats {
  total: number;
  totalMinutes: number;
  recurringCount: number;
  byModule: { id: number; name: string; emoji: string; count: number; minutes: number }[];
  byOperator: { id: number; name: string; count: number; minutes: number }[];
  byPriority: { id: number | null; name: string; color: string; count: number }[];
}

export interface School {
  id: number;
  name: string;
  requestsCount: number;
  logsCount: number;
  createdAt: string;
}
