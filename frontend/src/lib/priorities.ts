import { useEffect, useState } from "react";
import { api } from "./api";
import { PriorityInfo } from "./types";

let cache: PriorityInfo[] | null = null;
const listeners = new Set<(t: PriorityInfo[]) => void>();

export async function loadPriorities(force = false): Promise<PriorityInfo[]> {
  if (cache && !force) return cache;
  cache = await api<PriorityInfo[]>("/api/priorities");
  listeners.forEach((l) => l(cache!));
  return cache;
}

export function refreshPriorities(): void {
  loadPriorities(true).catch(() => {});
}

export function usePriorities(): PriorityInfo[] {
  const [rows, setRows] = useState<PriorityInfo[]>(cache ?? []);
  useEffect(() => {
    const listener = (t: PriorityInfo[]) => setRows(t);
    listeners.add(listener);
    loadPriorities().catch(() => {});
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return rows;
}

export function useActivePriorities(): PriorityInfo[] {
  return usePriorities().filter((p) => p.isActive);
}
