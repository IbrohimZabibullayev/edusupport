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
