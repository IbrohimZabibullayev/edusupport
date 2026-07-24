import { FormEvent, useCallback, useEffect, useState } from "react";
import { IconClose } from "../components/icons";
import { ErrorNote, LoadingNote, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { useActiveRequestTypes } from "../lib/requestTypes";
import { TopicKeyword } from "../lib/types";

export default function TopicKeywords() {
  const requestTypes = useActiveRequestTypes();
  const [rows, setRows] = useState<TopicKeyword[] | null>(null);
  const [error, setError] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<TopicKeyword[]>("/api/topic-keywords")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const add = async (type: string, e: FormEvent) => {
    e.preventDefault();
    const keyword = (inputs[type] ?? "").trim();
    if (keyword.length < 2) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/topic-keywords", { method: "POST", body: JSON.stringify({ type, keyword }) });
      setInputs((v) => ({ ...v, [type]: "" }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/topic-keywords/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle>Bo'lim kalit so'zlari</PageTitle>
      <ErrorNote message={error} />

      <p className="mb-6 max-w-2xl text-sm text-muted">
        Forum guruhda so'rovlar qaysi bo'limga (topic) tushishi bo'lim <b>nomiga</b> qarab avtomatik
        aniqlanadi. Bu yerdagi kalit so'zlardan biri bo'lim nomida uchrasa (masalan nomida
        «bug» bo'lsa), o'sha turdagi so'rovlar shu bo'limga yuboriladi. Katta-kichik harf farqi yo'q.
      </p>

      {!rows ? (
        <LoadingNote />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requestTypes.map((type) => {
            const items = rows.filter((r) => r.type === type.key);
            return (
              <div key={type.key} className="rounded-xl border border-black/10 bg-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />
                  <h2 className="font-semibold">{type.name}</h2>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {items.length === 0 ? (
                    <span className="text-sm text-muted">Kalit so'z yo'q</span>
                  ) : (
                    items.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] py-1 pl-3 pr-1.5 text-sm"
                      >
                        {r.keyword}
                        <button
                          disabled={busy}
                          onClick={() => remove(r.id)}
                          title="O'chirish"
                          className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                        >
                          <IconClose className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <form onSubmit={(e) => add(type.key, e)} className="flex gap-2">
                  <input
                    value={inputs[type.key] ?? ""}
                    onChange={(e) => setInputs((v) => ({ ...v, [type.key]: e.target.value }))}
                    placeholder="Yangi so'z…"
                    className="w-full rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={busy || (inputs[type.key] ?? "").trim().length < 2}
                    className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    +
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 max-w-2xl text-sm text-muted">
        Qo'lda biriktirish kerak bo'lsa (nomi qolipga tushmaydigan bo'lim uchun), o'sha bo'lim ichida
        botga <b>/settopic</b> yozing — u avtomatikadan ustun turadi.
      </p>
    </div>
  );
}
