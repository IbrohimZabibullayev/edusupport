import { ReactNode, useEffect, useMemo, useState } from "react";
import { EmptyNote, ErrorNote, LoadingNote, PageTitle, Pagination } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, formatMinutes } from "../lib/labels";
import { useActivePriorities } from "../lib/priorities";
import { ModuleItem, Operator, SupportLogItem, SupportLogsResponse, SystemItem } from "../lib/types";

const PAGE_SIZE = 20;

interface Filters {
  search: string;
  systemId: string;
  moduleId: string;
  operatorId: string;
  priorityId: string;
  recurring: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { search: "", systemId: "", moduleId: "", operatorId: "", priorityId: "", recurring: "", from: "", to: "" };

const selectCls = "rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export default function SupportLog() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SupportLogsResponse | null>(null);
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const priorities = useActivePriorities();
  const [open, setOpen] = useState<SupportLogItem | null>(null);

  useEffect(() => {
    api<SystemItem[]>("/api/systems").then(setSystems).catch(() => {});
    api<Operator[]>("/api/operators").then(setOperators).catch(() => {});
    api<ModuleItem[]>("/api/modules").then(setModules).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filtrlardan (sahifasiz) so'rov parametrlari
  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.search) p.set("search", filters.search);
    if (filters.systemId) p.set("systemId", filters.systemId);
    if (filters.moduleId) p.set("moduleId", filters.moduleId);
    if (filters.operatorId) p.set("operatorId", filters.operatorId);
    if (filters.priorityId) p.set("priorityId", filters.priorityId);
    if (filters.recurring) p.set("recurring", filters.recurring);
    if (filters.from) p.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
    if (filters.to) p.set("to", new Date(`${filters.to}T23:59:59`).toISOString());
    return p.toString();
  }, [filters]);

  useEffect(() => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    setLoading(true);
    setError("");
    api<SupportLogsResponse>(`/api/support-logs?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [baseParams, page]);

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  return (
    <div>
      <PageTitle>Support log</PageTitle>
      <ErrorNote message={error} />

      <p className="mb-4 max-w-3xl text-sm text-muted">
        Operatorlar botda o'zi (dasturchisiz) hal qilgan muammolarni shu yerga yozadi. Guruhga
        yuborilmaydi — faqat hisob-kitob uchun. Yozish: bot menyusidagi «Support log» tugmasi. Umumiy
        ko'rsatkichlar Boshqaruv panelida.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Qidiruv: muammo, maktab, operator…"
          className={`${selectCls} w-56`}
        />
        <select value={filters.systemId} onChange={(e) => update({ systemId: e.target.value })} className={selectCls}>
          <option value="">Barcha tizimlar</option>
          {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.moduleId} onChange={(e) => update({ moduleId: e.target.value })} className={selectCls}>
          <option value="">Barcha modullar</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filters.priorityId} onChange={(e) => update({ priorityId: e.target.value })} className={selectCls}>
          <option value="">Barcha darajalar</option>
          {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.operatorId} onChange={(e) => update({ operatorId: e.target.value })} className={selectCls}>
          <option value="">Barcha operatorlar</option>
          {operators.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}
        </select>
        <select value={filters.recurring} onChange={(e) => update({ recurring: e.target.value })} className={selectCls}>
          <option value="">Takroriy: barchasi</option>
          <option value="true">Takroriy: ha</option>
          <option value="false">Takroriy: yo'q</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} className={selectCls} />
        <span className="text-sm text-muted">—</span>
        <input type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} className={selectCls} />
        {hasFilters && (
          <button
            onClick={() => { setFilters(EMPTY); setSearchInput(""); setPage(1); }}
            className="rounded-lg px-2.5 py-1.5 text-sm text-accent hover:bg-accent-soft/40"
          >
            Tozalash
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-grid bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-grid text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-3">Sana</th>
              <th className="px-3 py-3">Tizim</th>
              <th className="px-3 py-3">Mijoz</th>
              <th className="px-3 py-3">Modul</th>
              <th className="px-3 py-3">Muammo</th>
              <th className="px-3 py-3">Daraja</th>
              <th className="px-3 py-3">Vaqt</th>
              <th className="px-3 py-3">Takroriy</th>
              <th className="px-3 py-3">Kim ishladi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}><LoadingNote /></td></tr>
            ) : !data || data.items.length === 0 ? (
              <tr><td colSpan={9}><EmptyNote text="Loglar topilmadi" /></td></tr>
            ) : (
              data.items.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setOpen(l)}
                  className="cursor-pointer border-b border-grid align-top last:border-0 hover:bg-black/[0.02]"
                >
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-ink-2">{formatDate(l.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{l.system ?? "—"}</td>
                  <td className="px-3 py-3">{l.school}</td>
                  <td className="whitespace-nowrap px-3 py-3">{l.moduleEmoji} {l.module}</td>
                  <td className="max-w-xs px-3 py-3 text-ink-2">
                    <span className="line-clamp-2">{l.problem}</span>
                    {l.problem.length > 90 && (
                      <span className="mt-0.5 block text-xs text-muted">to'liq ko'rish uchun bosing</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {l.priority ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.priorityColor ?? "#898781" }} />
                        {l.priority}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatMinutes(l.resolveMinutes)}</td>
                  <td className="px-3 py-3">
                    {l.recurring ? (
                      <span className="rounded-md border border-[#c9a227]/35 px-2 py-0.5 text-xs font-medium text-[#8a6d14]">Ha</span>
                    ) : (
                      <span className="text-muted">Yo'q</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{l.operator}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}

      {open && <LogDetail log={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/**
 * Jadvalda muammo matni ikki qatorga kesiladi — uzun izohni to'liq o'qish
 * uchun qatorni bosganda shu panel ochiladi.
 */
function LogDetail({ log, onClose }: { log: SupportLogItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: [string, ReactNode][] = [
    ["Sana", formatDate(log.createdAt)],
    ["Mijoz", log.school],
    ["Tizim", log.system ?? "—"],
    ["Modul", `${log.moduleEmoji} ${log.module}`.trim()],
    [
      "Daraja",
      log.priority ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: log.priorityColor ?? "#898781" }} />
          {log.priority}
        </span>
      ) : (
        "—"
      ),
    ],
    ["Ketgan vaqt", formatMinutes(log.resolveMinutes)],
    ["Takroriy", log.recurring ? "Ha" : "Yo'q"],
    ["Kim ishladi", log.operator],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Support log tafsiloti"
      >
        <div className="flex items-start justify-between gap-4 border-b border-grid px-5 py-4">
          <div>
            <div className="text-sm font-medium">{log.school}</div>
            <div className="mt-0.5 text-xs text-muted">
              {formatDate(log.createdAt)} · {log.operator}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
            aria-label="Yopish"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Muammo</div>
          {/* whitespace-pre-wrap — operator yozgan qatorlar saqlanadi */}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{log.problem}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-grid px-5 py-4 text-sm sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-0.5 text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
