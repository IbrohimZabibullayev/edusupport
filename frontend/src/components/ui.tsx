import { ReactNode } from "react";
import { FALLBACK_TYPE_COLOR, STATUS_LABELS } from "../lib/labels";
import { useRequestTypes } from "../lib/requestTypes";
import { OperatorStatus, RequestType } from "../lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-grid bg-surface p-5 ${className}`}>{children}</div>;
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-semibold tracking-tight">{children}</h1>
      {right}
    </div>
  );
}

export function StatCard({ label, value, dotColor }: { label: string; value: number | string; dotColor?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        {dotColor && <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: dotColor }} />}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
    </Card>
  );
}

/**
 * Ko'rsatkichlar bitta kartada, hairline bilan ajratilgan ustunlar.
 * Alohida-alohida qutilardan zichroq va tartibliroq ko'rinadi.
 */
export function MetricStrip({ items }: { items: { label: string; value: number | string; dotColor?: string; sub?: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 divide-grid overflow-hidden rounded-lg border border-grid bg-surface sm:grid-cols-4 sm:divide-x">
      {items.map((it, i) => (
        <div key={i} className={`px-4 py-3.5 ${i < 2 ? "border-b border-grid sm:border-b-0" : ""}`}>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
            {it.dotColor && <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: it.dotColor }} />}
            {it.label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-semibold leading-none tabular-nums tracking-tight">{it.value}</span>
            {it.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bo'lim sarlavhasi — hairline chiziq bilan, sahifani bloklarga ajratadi */
export function Section({
  title,
  hint,
  right,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-7 ${className}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-grid pb-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function TypeBadge({ type }: { type: RequestType }) {
  const info = useRequestTypes().find((t) => t.key === type);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: info?.color ?? FALLBACK_TYPE_COLOR }} />
      {info?.name ?? type}
    </span>
  );
}

/* Holat belgilari — to'q fon emas, ingichka kontur va sokin ohang */
const STATUS_STYLES: Record<OperatorStatus, string> = {
  PENDING: "border-[#c9a227]/35 text-[#8a6d14]",
  APPROVED: "border-good/30 text-good",
  REJECTED: "border-grid text-muted",
  BLOCKED: "border-danger/30 text-danger",
};

export function StatusBadge({ status }: { status: OperatorStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <div className="mb-4 rounded-lg border border-danger/25 bg-danger/[0.04] px-4 py-2.5 text-sm text-danger">{message}</div>;
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
          className="rounded-md border border-line px-3 py-1.5 text-ink-2 transition-colors hover:bg-black/[0.03] disabled:opacity-40 disabled:hover:bg-transparent"
        >
          ‹ Oldingi
        </button>
        <span className="tabular-nums text-ink-2">
          {page} / {pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded-md border border-line px-3 py-1.5 text-ink-2 transition-colors hover:bg-black/[0.03] disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Keyingi ›
        </button>
      </div>
    </div>
  );
}
