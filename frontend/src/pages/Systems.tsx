import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyNote, ErrorNote, LoadingNote, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { SystemItem } from "../lib/types";

const btnCls = "rounded-lg border border-black/15 px-2.5 py-1.5 text-xs font-medium text-ink-2 disabled:opacity-40";

export default function Systems() {
  const [systems, setSystems] = useState<SystemItem[] | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<SystemItem[]>("/api/systems")
      .then(setSystems)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const patch = async (id: number, body: Partial<Pick<SystemItem, "name" | "isActive" | "sortOrder">>) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/systems/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const addSystem = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      await api("/api/systems", { method: "POST", body: JSON.stringify({ name: newName.trim() }) });
      setNewName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <PageTitle>Tizimlar</PageTitle>
      <ErrorNote message={error} />

      <p className="mb-4 text-sm text-muted">
        Operator so'rov kiritganda qaysi tizim haqidaligini tanlaydi va so'rov o'sha tizimning Telegram
        guruhiga yuboriladi. Guruhni ulash uchun kerakli guruhda <b>/setgroup</b> yozib, tizimni tanlang.
      </p>

      <form onSubmit={addSystem} className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yangi tizim nomi…"
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
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Tizim</th>
              <th className="px-4 py-3">Holati</th>
              <th className="px-4 py-3">Telegram guruh</th>
              <th className="px-4 py-3 text-right">So'rovlar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!systems ? (
              <tr><td colSpan={5}><LoadingNote /></td></tr>
            ) : systems.length === 0 ? (
              <tr><td colSpan={5}><EmptyNote text="Tizimlar yo'q" /></td></tr>
            ) : (
              systems.map((s) => (
                <tr key={s.id} className={`border-b border-black/5 last:border-0 ${s.isActive ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3">
                    {editingId === s.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="w-56 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.isActive ? "bg-[#d9f0d9] text-good" : "bg-black/5 text-ink-2"
                    }`}>
                      {s.isActive ? "Faol" : "O'chirilgan"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.groupConnected ? (
                      <span className="text-good">Ulangan</span>
                    ) : (
                      <span className="text-muted">Ulanmagan (/setgroup)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.requestsCount}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === s.id ? (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={async () => { await patch(s.id, { name: editName.trim() }); setEditingId(null); }}
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
                          onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                          className={btnCls}
                        >
                          Tahrirlash
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => patch(s.id, { isActive: !s.isActive })}
                          className={s.isActive ? "rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-medium text-danger disabled:opacity-40" : btnCls}
                        >
                          {s.isActive ? "O'chirish" : "Faollashtirish"}
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
