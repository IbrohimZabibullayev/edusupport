import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyNote, ErrorNote, LoadingNote, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/labels";
import { School } from "../lib/types";

export default function Schools() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(() => {
    api<School[]>("/api/schools")
      .then(setSchools)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const addSchool = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      await api("/api/schools", { method: "POST", body: JSON.stringify({ name: newName.trim() }) });
      setNewName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (id: number) => {
    setError("");
    try {
      await api(`/api/schools/${id}`, { method: "PATCH", body: JSON.stringify({ name: editName.trim() }) });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    }
  };

  return (
    <div>
      <PageTitle>Maktablar</PageTitle>
      <ErrorNote message={error} />

      <form onSubmit={addSchool} className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yangi maktab nomi…"
          className="w-72 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={adding || newName.trim().length < 3}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Qo'shish
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Nomi</th>
              <th className="px-4 py-3 text-right">So'rovlar soni</th>
              <th className="px-4 py-3">Qo'shilgan</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!schools ? (
              <tr><td colSpan={4}><LoadingNote /></td></tr>
            ) : schools.length === 0 ? (
              <tr><td colSpan={4}><EmptyNote text="Maktablar hali qo'shilmagan" /></td></tr>
            ) : (
              schools.map((s) => (
                <tr key={s.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    {editingId === s.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="w-64 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.requestsCount}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-2">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === s.id ? (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(s.id)}
                          disabled={editName.trim().length < 3}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Saqlash
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium text-ink-2"
                        >
                          Bekor
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                        className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium text-ink-2"
                      >
                        Tahrirlash
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
