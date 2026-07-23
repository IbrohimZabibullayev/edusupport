import { Fragment, useEffect, useState } from "react";
import { AttachmentView } from "../components/AttachmentView";
import { EmptyNote, ErrorNote, LoadingNote, PageTitle, Pagination, TypeBadge } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, TYPE_LABELS } from "../lib/labels";
import { ModuleItem, Operator, RequestsResponse, School, SystemItem } from "../lib/types";

const PAGE_SIZE = 20;

interface Filters {
  search: string;
  type: string;
  systemId: string;
  moduleId: string;
  schoolId: string;
  operatorId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { search: "", type: "", systemId: "", moduleId: "", schoolId: "", operatorId: "", from: "", to: "" };

const selectCls =
  "rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export default function Requests() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RequestsResponse | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [systems, setSystems] = useState<SystemItem[]>([]);

  useEffect(() => {
    api<School[]>("/api/schools").then(setSchools).catch(() => {});
    api<Operator[]>("/api/operators").then(setOperators).catch(() => {});
    api<ModuleItem[]>("/api/modules").then(setModules).catch(() => {});
    api<SystemItem[]>("/api/systems").then(setSystems).catch(() => {});
  }, []);

  // Qidiruv 400ms kechikish bilan qo'llanadi
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (filters.search) params.set("search", filters.search);
    if (filters.type) params.set("type", filters.type);
    if (filters.systemId) params.set("systemId", filters.systemId);
    if (filters.moduleId) params.set("moduleId", filters.moduleId);
    if (filters.schoolId) params.set("schoolId", filters.schoolId);
    if (filters.operatorId) params.set("operatorId", filters.operatorId);
    if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
    if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59`).toISOString());

    setLoading(true);
    setError("");
    api<RequestsResponse>(`/api/requests?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div>
      <PageTitle>So'rovlar</PageTitle>
      <ErrorNote message={error} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Qidiruv: ticket, izoh, maktab…"
          className={`${selectCls} w-56`}
        />
        <select value={filters.type} onChange={(e) => update({ type: e.target.value })} className={selectCls}>
          <option value="">Barcha turlar</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filters.systemId} onChange={(e) => update({ systemId: e.target.value })} className={selectCls}>
          <option value="">Barcha tizimlar</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={filters.moduleId} onChange={(e) => update({ moduleId: e.target.value })} className={selectCls}>
          <option value="">Barcha modullar</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={filters.schoolId} onChange={(e) => update({ schoolId: e.target.value })} className={selectCls}>
          <option value="">Barcha maktablar</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={filters.operatorId} onChange={(e) => update({ operatorId: e.target.value })} className={selectCls}>
          <option value="">Barcha operatorlar</option>
          {operators.map((o) => (
            <option key={o.id} value={o.id}>{o.fullName}</option>
          ))}
        </select>
        <input type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} className={selectCls} />
        <span className="text-sm text-muted">—</span>
        <input type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} className={selectCls} />
        {hasFilters && (
          <button
            onClick={() => { setFilters(EMPTY_FILTERS); setSearchInput(""); setPage(1); }}
            className="rounded-lg px-2.5 py-1.5 text-sm text-accent hover:bg-accent-soft/40"
          >
            Tozalash
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Sana</th>
              <th className="px-4 py-3">Turi</th>
              <th className="px-4 py-3">Tizim</th>
              <th className="px-4 py-3">Modul</th>
              <th className="px-4 py-3">Maktab</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3">Izoh</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><LoadingNote /></td></tr>
            ) : !data || data.items.length === 0 ? (
              <tr><td colSpan={8}><EmptyNote text="So'rovlar topilmadi" /></td></tr>
            ) : (
              data.items.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="cursor-pointer border-b border-black/5 align-top last:border-0 hover:bg-black/[0.02]"
                  >
                    <td className="px-4 py-3 font-medium tabular-nums">
                      <span className="mr-1.5 inline-block text-muted">{expandedId === r.id ? "▾" : "▸"}</span>
                      {r.ticket}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-2">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3"><TypeBadge type={r.type} /></td>
                    <td className="whitespace-nowrap px-4 py-3">{r.system ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{r.module}</td>
                    <td className="px-4 py-3">{r.school}</td>
                    <td className="whitespace-nowrap px-4 py-3">{r.operator}</td>
                    <td className="max-w-xs px-4 py-3 text-ink-2">
                      <span className="line-clamp-2" title={r.description}>{r.description}</span>
                      {r.attachments.length > 0 && (
                        <span className="mt-1 inline-block rounded bg-black/5 px-1.5 py-0.5 text-xs text-ink-2">
                          {r.attachments.length} ta fayl
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="border-b border-black/5 bg-black/[0.015]">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">To'liq izoh</div>
                        <p className="whitespace-pre-wrap text-sm">{r.description}</p>
                        {r.attachments.length > 0 && (
                          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {r.attachments.map((a) => (
                              <AttachmentView key={a.id} attachment={a} />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}
    </div>
  );
}
