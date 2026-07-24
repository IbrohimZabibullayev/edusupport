import { useEffect, useState } from "react";
import { api } from "./api";
import { RequestTypeInfo } from "./types";

/**
 * So'rov turlari bir marta yuklanadi va keshlanadi. Turlar kam o'zgargani uchun
 * oddiy modul-darajali kesh + hook yetarli (kontekst shart emas).
 */
let cache: RequestTypeInfo[] | null = null;
const listeners = new Set<(t: RequestTypeInfo[]) => void>();

export async function loadRequestTypes(force = false): Promise<RequestTypeInfo[]> {
  if (cache && !force) return cache;
  cache = await api<RequestTypeInfo[]>("/api/request-types");
  listeners.forEach((l) => l(cache!));
  return cache;
}

/** Kesh o'zgarganda (yangi tur qo'shilganda) barcha komponentlarni yangilaydi */
export function refreshRequestTypes(): void {
  loadRequestTypes(true).catch(() => {});
}

export function useRequestTypes(): RequestTypeInfo[] {
  const [types, setTypes] = useState<RequestTypeInfo[]>(cache ?? []);
  useEffect(() => {
    const listener = (t: RequestTypeInfo[]) => setTypes(t);
    listeners.add(listener);
    loadRequestTypes().catch(() => {});
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return types;
}

/** Faqat faol turlar (bot/filtrlar uchun) */
export function useActiveRequestTypes(): RequestTypeInfo[] {
  return useRequestTypes().filter((t) => t.isActive);
}
