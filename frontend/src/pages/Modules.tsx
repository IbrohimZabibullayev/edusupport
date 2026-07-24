import { FormEvent, useCallback, useEffect, useState } from "react";
import { IconArrowDown, IconArrowUp } from "../components/icons";
import { EmptyNote, ErrorNote, LoadingNote, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { ModuleItem } from "../lib/types";

const btnCls = "rounded-lg border border-black/15 px-2.5 py-1.5 text-xs font-medium text-ink-2 disabled:opacity-40";

export default function Modules() {
  const [modules, setModules] = useState<ModuleItem[] | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<ModuleItem[]>("/api/modules")
      .then(setModules)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const patch = async (id: number, body: Partial<Pick<ModuleItem, "name" | "emoji" | "isActive" | "sortOrder">>) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/modules/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const addModule = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      await api("/api/modules", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), emoji: newEmoji.trim() }),
      });
      setNewName("");
      setNewEmoji("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setAdding(false);
    }
  };

  // Tartibda qo'shni bilan sortOrder almashtiriladi
  const move = async (index: number, dir: -1 | 1) => {
    if (!modules) return;
    const a = modules[index];
    const b = modules[index + dir];
    if (!a || !b) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/modules/${a.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: b.sortOrder }) });
      await api(`/api/modules/${b.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: a.sortOrder }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: number) => {
    await patch(id, { name: editName.trim(), emoji: editEmoji.trim() });
    setEditingId(null);
  };

  return (
    <div>
      <PageTitle>Modullar</PageTitle>
      <ErrorNote message={error} />

      <p className="mb-4 text-sm text-muted">
        Bot'dagi modul tugmalari shu ro'yxatdan chiqadi. O'chirilgan modul botda ko'rinmaydi, lekin eski
        so'rovlar statistikada qoladi.
      </p>

      <form onSubmit={addModule} className="mb-4 flex gap-2">
        <input
          value={newEmoji}
          onChange={(e) => setNewEmoji(e.target.value)}
          placeholder="🧩"
          maxLength={4}
          className="w-16 rounded-lg border border-black/15 bg-white px-3 py-2 text-center text-sm outline-none focus:border-accent"
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yangi modul nomi…"
          className="w-64 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={adding || newName.trim().length < 2}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Qo'shish
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 w-20">Tartib</th>
              <th className="px-4 py-3">Modul</th>
              <th className="px-4 py-3">Holati</th>
              <th className="px-4 py-3 text-right">So'rovlar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!modules ? (
              <tr><td colSpan={5}><LoadingNote /></td></tr>
            ) : modules.length === 0 ? (
              <tr><td colSpan={5}><EmptyNote text="Modullar yo'q" /></td></tr>
            ) : (
              modules.map((m, i) => (
                <tr key={m.id} className={`border-b border-black/5 last:border-0 ${m.isActive ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1">
                      <button disabled={busy || i === 0} onClick={() => move(i, -1)} className={btnCls} title="Yuqoriga"><IconArrowUp className="h-3.5 w-3.5" /></button>
                      <button disabled={busy || i === modules.length - 1} onClick={() => move(i, 1)} className={btnCls} title="Pastga"><IconArrowDown className="h-3.5 w-3.5" /></button>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === m.id ? (
                      <span className="flex items-center gap-2">
                        <input
                          value={editEmoji}
                          onChange={(e) => setEditEmoji(e.target.value)}
                          maxLength={4}
                          className="w-14 rounded-lg border border-black/15 bg-white px-2 py-1 text-center text-sm outline-none focus:border-accent"
                        />
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          className="w-56 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-accent"
                        />
                      </span>
                    ) : (
                      <span className="font-medium">{m.emoji} {m.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      m.isActive ? "bg-[#d9f0d9] text-good" : "bg-black/5 text-ink-2"
                    }`}>
                      {m.isActive ? "Faol" : "O'chirilgan"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.requestsCount}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === m.id ? (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(m.id)}
                          disabled={busy || editName.trim().length < 2}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Saqlash
                        </button>
                        <button onClick={() => setEditingId(null)} className={btnCls}>Bekor</button>
                      </span>
                    ) : (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={() => { setEditingId(m.id); setEditName(m.name); setEditEmoji(m.emoji); }}
                          className={btnCls}
                        >
                          Tahrirlash
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => patch(m.id, { isActive: !m.isActive })}
                          className={m.isActive ? "rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-medium text-danger disabled:opacity-40" : btnCls}
                        >
                          {m.isActive ? "O'chirish" : "Faollashtirish"}
                        </button>
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
