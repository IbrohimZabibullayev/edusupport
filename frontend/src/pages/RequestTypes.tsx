import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyNote, ErrorNote, LoadingNote, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { refreshRequestTypes } from "../lib/requestTypes";
import { RequestTypeInfo } from "../lib/types";

const btnCls = "rounded-lg border border-black/15 px-2.5 py-1.5 text-xs font-medium text-ink-2 disabled:opacity-40";

type PatchBody = Partial<Pick<RequestTypeInfo, "name" | "emoji" | "color" | "isActive" | "sortOrder">>;

export default function RequestTypes() {
  const [types, setTypes] = useState<RequestTypeInfo[] | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [newColor, setNewColor] = useState("#2a78d6");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editColor, setEditColor] = useState("#2a78d6");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<RequestTypeInfo[]>("/api/request-types")
      .then(setTypes)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const reload = () => {
    load();
    refreshRequestTypes(); // bot/dashboard/filtrlar uchun keshni yangilaymiz
  };

  const patch = async (id: number, body: PatchBody) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/request-types/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const addType = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      await api("/api/request-types", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), emoji: newEmoji.trim(), color: newColor }),
      });
      setNewName("");
      setNewEmoji("");
      setNewColor("#2a78d6");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setAdding(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!types) return;
    const a = types[index];
    const b = types[index + dir];
    if (!a || !b) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/request-types/${a.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: b.sortOrder }) });
      await api(`/api/request-types/${b.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: a.sortOrder }) });
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
      await api(`/api/request-types/${id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: number) => {
    await patch(id, { name: editName.trim(), emoji: editEmoji.trim(), color: editColor });
    setEditingId(null);
  };

  return (
    <div>
      <PageTitle>So'rov turlari</PageTitle>
      <ErrorNote message={error} />

      <p className="mb-4 max-w-2xl text-sm text-muted">
        Operator so'rov kiritganda shu turlardan birini tanlaydi (bot tugmalari). Har bir tur guruhdagi
        mos bo'limga (topic) yuboriladi — moslik <b>Bo'lim kalit so'zlari</b> sahifasida belgilanadi.
        O'chirilgan tur botda ko'rinmaydi, lekin eski so'rovlar statistikada qoladi.
      </p>

      <form onSubmit={addType} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={newEmoji}
          onChange={(e) => setNewEmoji(e.target.value)}
          placeholder="🐞"
          maxLength={4}
          className="w-16 rounded-lg border border-black/15 bg-white px-3 py-2 text-center text-sm outline-none focus:border-accent"
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yangi tur nomi…"
          className="w-64 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          Rang
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border border-black/15 bg-white"
          />
        </label>
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
              <th className="px-4 py-3">Tur</th>
              <th className="px-4 py-3">Holati</th>
              <th className="px-4 py-3 text-right">So'rovlar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!types ? (
              <tr><td colSpan={5}><LoadingNote /></td></tr>
            ) : types.length === 0 ? (
              <tr><td colSpan={5}><EmptyNote text="Turlar yo'q" /></td></tr>
            ) : (
              types.map((t, i) => (
                <tr key={t.id} className={`border-b border-black/5 last:border-0 ${t.isActive ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1">
                      <button disabled={busy || i === 0} onClick={() => move(i, -1)} className={btnCls} title="Yuqoriga">↑</button>
                      <button disabled={busy || i === types.length - 1} onClick={() => move(i, 1)} className={btnCls} title="Pastga">↓</button>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
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
                          className="w-48 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-accent"
                        />
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-8 w-9 cursor-pointer rounded border border-black/15 bg-white"
                        />
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 font-medium">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.emoji} {t.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.isActive ? "bg-[#d9f0d9] text-good" : "bg-black/5 text-ink-2"
                    }`}>
                      {t.isActive ? "Faol" : "O'chirilgan"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.requestsCount}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === t.id ? (
                      <span className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(t.id)}
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
                          onClick={() => { setEditingId(t.id); setEditName(t.name); setEditEmoji(t.emoji); setEditColor(t.color); }}
                          className={btnCls}
                        >
                          Tahrirlash
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => patch(t.id, { isActive: !t.isActive })}
                          className={t.isActive ? "rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-medium text-danger disabled:opacity-40" : btnCls}
                        >
                          {t.isActive ? "O'chirish" : "Faollashtirish"}
                        </button>
                        {t.requestsCount === 0 && (
                          <button
                            disabled={busy}
                            onClick={() => remove(t.id)}
                            className="rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-medium text-danger disabled:opacity-40"
                            title="Butunlay o'chirish"
                          >
                            🗑
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
