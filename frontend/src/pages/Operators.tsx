import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconClose } from "../components/icons";
import { Card, EmptyNote, ErrorNote, LoadingNote, PageTitle, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/labels";
import { Operator, OperatorStatus } from "../lib/types";

export default function Operators() {
  const [operators, setOperators] = useState<Operator[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    api<Operator[]>("/api/operators")
      .then(setOperators)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const setStatus = async (op: Operator, status: OperatorStatus, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(op.id);
    setError("");
    try {
      await api(`/api/operators/${op.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  };

  const btn = "rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50";
  const pending = operators?.filter((o) => o.status === "PENDING") ?? [];

  return (
    <div>
      <PageTitle>Operatorlar</PageTitle>
      <ErrorNote message={error} />

      {pending.length > 0 && (
        <Card className="mb-4 border-[#c9a227]/30 bg-[#c9a227]/[0.05]">
          <h2 className="mb-3 text-sm font-semibold">⏳ Tasdiqlash kutilmoqda ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{o.fullName}</div>
                  <div className="text-xs text-muted">
                    {o.phone ?? "—"} {o.username ? `· @${o.username}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busyId === o.id}
                    onClick={() => setStatus(o, "APPROVED")}
                    className={`${btn} inline-flex items-center gap-1.5 bg-accent text-white`}
                  >
                    <IconCheck className="h-4 w-4" />
                    Tasdiqlash
                  </button>
                  <button
                    disabled={busyId === o.id}
                    onClick={() => setStatus(o, "REJECTED")}
                    className={`${btn} inline-flex items-center gap-1.5 border border-line text-ink-2`}
                  >
                    <IconClose className="h-4 w-4" />
                    Rad etish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-grid bg-surface">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-grid text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Ism</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">So'rovlari</th>
              <th className="px-4 py-3">Qo'shilgan</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!operators ? (
              <tr><td colSpan={7}><LoadingNote /></td></tr>
            ) : operators.length === 0 ? (
              <tr><td colSpan={7}><EmptyNote text="Operatorlar hali yo'q" /></td></tr>
            ) : (
              operators.map((o) => (
                <tr key={o.id} className="border-b border-grid last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    {o.fullName} {o.isAdmin && <span className="ml-1 rounded bg-accent-soft/60 px-1.5 py-0.5 text-xs text-accent">admin</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{o.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2">{o.username ? `@${o.username}` : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.requestsCount}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-2">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "APPROVED" && !o.isAdmin && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o, "BLOCKED", `${o.fullName} bloklansinmi?`)}
                        className={`${btn} border border-danger/30 text-danger`}
                      >
                        Bloklash
                      </button>
                    )}
                    {o.status === "BLOCKED" && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o, "APPROVED")}
                        className={`${btn} border border-line text-ink-2`}
                      >
                        Blokdan chiqarish
                      </button>
                    )}
                    {o.status === "REJECTED" && (
                      <button
                        disabled={busyId === o.id}
                        onClick={() => setStatus(o, "APPROVED")}
                        className={`${btn} border border-line text-ink-2`}
                      >
                        Tasdiqlash
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
