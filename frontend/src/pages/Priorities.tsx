import { FormEvent, useCallback, useEffect, useState } from "react";
import { IconArrowDown, IconArrowUp, IconTrash } from "../components/icons";
import { EmptyNote, ErrorNote, LoadingNote, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { refreshPriorities } from "../lib/priorities";
import { PriorityInfo } from "../lib/types";

const btnCls = "rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 disabled:opacity-40";

type PatchBody = Partial<Pick<PriorityInfo, "name" | "color" | "isActive" | "sortOrder">>;

export default function Priorities() {
  const [rows, setRows] = useState<PriorityInfo[] | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#eb6834");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#eb6834");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<PriorityInfo[]>("/api/priorities")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const reload = () => {
    load();
    refreshPriorities();
  };

  const patch = async (id: number, body: PatchBody) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/priorities/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const addPriority = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      await api("/api/priorities", { method: "POST", body: JSON.stringify({ name: newName.trim(), color: newColor }) });
      setNewName("");
      setNewColor("#eb6834");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setAdding(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!rows) return;
    const a = rows[index];
    const b = rows[index + dir];
    if (!a || !b) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/priorities/${a.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: b.sortOrder }) });
      await api(`/api/priorities/${b.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: a.sortOrder }) });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/priorities/${id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: number) => {
    await patch(id, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  return (
    <div>
      <PageTitle>Prioritetlar</PageTitle>
      <ErrorNote message={error} />

      <p className="mb-4 max-w-2xl text-sm text-muted">
        Support log yozayotganda operator muammoning darajasini (prioritetini) shu ro'yxatdan tanlaydi.
      </p>

      <form onSubmit={addPriority} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yangi prioritet (masalan P1-Shoshilinch)…"
          className="w-72 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          Rang
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border border-line bg-white"
          />
        </label>
        <button
          type="submit"
          disabled={adding || newName.trim().length < 2}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Qo'shish
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-grid bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-grid text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 w-20">Tartib</th>
              <th className="px-4 py-3">Prioritet</th>
              <th className="px-4 py-3">Holati</th>
              <th className="px-4 py-3 text-right">Loglar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <tr><td colSpan={5}><LoadingNote /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5}><EmptyNote text="Prioritetlar yo'q" /></td></tr>
            ) : (
              rows.map((p, i) => (
                <tr key={p.id} className={`border-b border-grid last:border-0 ${p.isActive ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1">
                      <button disabled={busy || i === 0} onClick={() => move(i, -1)} className={btnCls} title="Yuqoriga"><IconArrowUp className="h-3.5 w-3.5" /></button>
                      <button disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)} className={btnCls} title="Pastga"><IconArrowDown className="h-3.5 w-3.5" /></button>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === p.id ? (
                      <span className="flex items-center gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          className="w-56 rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                        />
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-8 w-9 cursor-pointer rounded border border-line bg-white"
                        />
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 font-medium">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                      p.isActive ? "border border-good/30 text-good" : "border border-grid text-muted"
                    }`}>
                      {p.isActive ? "Faol" : "O'chirilgan"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.logsCount}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === p.id ? (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(p.id)}
                          disabled={busy || editName.trim().length < 2}
                          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Saqlash
                        </button>
                        <button onClick={() => setEditingId(null)} className={btnCls}>Bekor</button>
                      </span>
                    ) : (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={() => { setEditingId(p.id); setEditName(p.name); setEditColor(p.color); }}
                          className={btnCls}
                        >
                          Tahrirlash
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => patch(p.id, { isActive: !p.isActive })}
                          className={p.isActive ? "rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-medium text-danger disabled:opacity-40" : btnCls}
                        >
                          {p.isActive ? "O'chirish" : "Faollashtirish"}
                        </button>
                        {p.logsCount === 0 && (
                          <button
                            disabled={busy}
                            onClick={() => remove(p.id)}
                            className="rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-medium text-danger disabled:opacity-40"
                            title="Butunlay o'chirish"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
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
