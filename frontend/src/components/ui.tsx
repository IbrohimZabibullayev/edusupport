import { ReactNode } from "react";
import { STATUS_LABELS, TYPE_COLORS, TYPE_LABELS } from "../lib/labels";
import { OperatorStatus, RequestType } from "../lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-black/10 bg-surface p-5 ${className}`}>{children}</div>;
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight">{children}</h1>
      {right}
    </div>
  );
}

export function StatCard({ label, value, dotColor }: { label: string; value: number | string; dotColor?: string }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-sm text-ink-2">
        {dotColor && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />}
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </Card>
  );
}

export function TypeBadge({ type }: { type: RequestType }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
      {TYPE_LABELS[type]}
    </span>
  );
}

const STATUS_STYLES: Record<OperatorStatus, string> = {
  PENDING: "bg-[#fdf0cc] text-[#6b4d00]",
  APPROVED: "bg-[#d9f0d9] text-good",
  REJECTED: "bg-black/5 text-ink-2",
  BLOCKED: "bg-[#f8dcdc] text-[#8f1f1f]",
};

export function StatusBadge({ status }: { status: OperatorStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">{message}</div>;
}

export function LoadingNote() {
  return <div className="py-10 text-center text-sm text-muted">Yuklanmoqda…</div>;
}

export function EmptyNote({ text = "Ma'lumot topilmadi" }: { text?: string }) {
  return <div className="py-10 text-center text-sm text-muted">{text}</div>;
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">Jami: {total} ta</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40"
        >
          ‹ Oldingi
        </button>
        <span className="tabular-nums text-ink-2">
          {page} / {pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40"
        >
          Keyingi ›
        </button>
      </div>
    </div>
  );
}
