import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyNote, ErrorNote, LoadingNote, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/labels";
import { DuplicateSchool, School } from "../lib/types";

/**
 * Bir maktab har xil yozilib ketgan bo'lsa (Najot / Najot Ta'lim / najot talim)
 * ularni bitta yozuvga yig'adi — so'rovlar va loglar ko'chiriladi, tarix yo'qolmaydi.
 */
function DuplicateMerger({ groups, onMerged }: { groups: DuplicateSchool[][]; onMerged: () => void }) {
  const [keepIds, setKeepIds] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  if (groups.length === 0) return null;

  const merge = async (group: DuplicateSchool[], index: number) => {
    const targetId = keepIds[index] ?? group[0].id;
    const target = group.find((s) => s.id === targetId)!;
    const sources = group.filter((s) => s.id !== targetId);
    const moving = sources.reduce((n, s) => n + s.requestsCount + s.logsCount, 0);
    if (
      !confirm(
        `${sources.map((s) => `"${s.name}"`).join(", ")} → "${target.name}" ga birlashtirilsinmi?\n\n` +
          `${moving} ta yozuv ko'chiriladi, ortiqcha maktab(lar) o'chiriladi. Tarix yo'qolmaydi.`
      )
    )
      return;
    setBusy(index);
    setError("");
    try {
      await api("/api/schools/merge", {
        method: "POST",
        body: JSON.stringify({ targetId, sourceIds: sources.map((s) => s.id) }),
      });
      onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-5 rounded-md border border-line bg-accent-soft/30 p-4">
      <h2 className="mb-1 text-sm font-semibold">O'xshash nomli maktablar</h2>
      <p className="mb-3 text-xs text-ink-2">
        Quyidagilar bitta maktabning turli yozilishi bo'lishi mumkin. Qaysi nom qolishini tanlang va birlashtiring —
        so'rovlar va support loglar o'sha nomga ko'chiriladi.
      </p>
      <ErrorNote message={error} />
      <div className="space-y-3">
        {groups.map((group, i) => {
          const keep = keepIds[i] ?? group[0].id;
          return (
            <div key={group.map((s) => s.id).join("-")} className="rounded-lg border border-grid bg-surface p-3">
              <div className="mb-2 space-y-1.5">
                {group.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`keep-${i}`}
                      checked={keep === s.id}
                      onChange={() => setKeepIds((p) => ({ ...p, [i]: s.id }))}
                    />
                    <span className={keep === s.id ? "font-medium" : "text-ink-2"}>{s.name}</span>
                    <span className="text-xs text-muted">
                      {s.requestsCount} so'rov · {s.logsCount} log
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => merge(group, i)}
                disabled={busy === i}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy === i ? "Birlashtirilmoqda…" : "Birlashtirish"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Schools() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateSchool[][]>([]);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(() => {
    api<School[]>("/api/schools")
      .then(setSchools)
      .catch((e) => setError(e.message));
    api<DuplicateSchool[][]>("/api/schools/duplicates")
      .then(setDuplicates)
      .catch(() => setDuplicates([]));
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

  const remove = async (s: School) => {
    const extra =
      s.requestsCount > 0 || s.logsCount > 0
        ? `\n\nDIQQAT: ${s.requestsCount} ta so'rov va ${s.logsCount} ta support log ham butunlay o'chiriladi (tarixdan yo'qoladi).`
        : "";
    if (!confirm(`"${s.name}" maktabini o'chirasizmi?${extra}`)) return;
    setError("");
    try {
      await api(`/api/schools/${s.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    }
  };

  return (
    <div>
      <PageTitle>Maktablar</PageTitle>
      <ErrorNote message={error} />

      <DuplicateMerger groups={duplicates} onMerged={load} />

      <form onSubmit={addSchool} className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yangi maktab nomi…"
          className="w-72 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={adding || newName.trim().length < 3}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Qo'shish
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-grid bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-grid text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Nomi</th>
              <th className="px-4 py-3 text-right">So'rovlar</th>
              <th className="px-4 py-3 text-right">Loglar</th>
              <th className="px-4 py-3">Qo'shilgan</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!schools ? (
              <tr><td colSpan={5}><LoadingNote /></td></tr>
            ) : schools.length === 0 ? (
              <tr><td colSpan={5}><EmptyNote text="Maktablar hali qo'shilmagan" /></td></tr>
            ) : (
              schools.map((s) => (
                <tr key={s.id} className="border-b border-grid last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    {editingId === s.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="w-64 rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.requestsCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.logsCount}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-2">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === s.id ? (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(s.id)}
                          disabled={editName.trim().length < 3}
                          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Saqlash
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2"
                        >
                          Bekor
                        </button>
                      </span>
                    ) : (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2"
                        >
                          Tahrirlash
                        </button>
                        <button
                          onClick={() => remove(s)}
                          className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger"
                          title="O'chirish"
                        >
                          O'chirish
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
