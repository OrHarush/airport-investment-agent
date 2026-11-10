import { useEffect, useState } from "react";
import type { ConversationSummary } from "./api";

/** localStorage that never throws (private mode, blocked storage). */
export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

/** Minimal client-side routing for /c/:id (no router dependency). */
const idFromPath = (p: string) => p.match(/^\/c\/([^/]+)\/?$/)?.[1] ?? null;
export function useRouteId(): [string | null, (id: string | null, replace?: boolean) => void] {
  const [id, setId] = useState<string | null>(() => idFromPath(location.pathname));
  useEffect(() => {
    const on = () => setId(idFromPath(location.pathname));
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const go = (next: string | null, replace = false) => {
    const path = next ? `/c/${next}` : "/";
    if (location.pathname !== path) history[replace ? "replaceState" : "pushState"](null, "", path);
    setId(next);
  };
  return [id, go];
}

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}

export type Group = "Today" | "Yesterday" | "Previous 7 days" | "Older";
export function groupConversations(items: ConversationSummary[], now = new Date()): { label: Group; items: ConversationSummary[] }[] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const day = 86_400_000;
  const buckets: Record<Group, ConversationSummary[]> = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  for (const c of items) {
    const t = startOfDay(new Date(c.updatedAt));
    const label: Group = t >= today ? "Today" : t >= today - day ? "Yesterday" : t >= today - 7 * day ? "Previous 7 days" : "Older";
    buckets[label].push(c);
  }
  return (Object.keys(buckets) as Group[]).filter((k) => buckets[k].length).map((label) => ({ label, items: buckets[label] }));
}
