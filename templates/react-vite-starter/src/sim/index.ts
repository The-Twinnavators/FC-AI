/**
 * Simulated data for prototypes: the app works like the real product (add, edit, delete, search, filter) without a
 * backend. Each collection starts from seed data, keeps changes in this browser, and resets to the seed with
 * resetDemoData(). Content from the PRD or an attached JSON file (src/content/*.json) is the seed when there is one.
 *
 *   export const orders = createCollection("orders", seedOrders);
 *   const list = useCollection(orders);                      // re-renders on change
 *   await simulate(() => orders.add({ title: "New order" })); // with a short, realistic delay
 *   searchItems(list, query, ["title", "customer"]);        // in-app search
 *   const [units, setUnits] = useSavedState("units", "metric"); // a saved setting
 */
import { useCallback, useState, useSyncExternalStore } from "react";

export interface Collection<T extends { id: string }> {
  readonly key: string;
  all(): T[];
  get(id: string): T | undefined;
  add(item: Omit<T, "id"> & { id?: string }): T;
  update(id: string, patch: Partial<T>): T | undefined;
  remove(id: string): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

const PREFIX = "sim:";
const collections = new Map<string, Collection<{ id: string }>>();

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** A stable fingerprint of the seed: a changed seed (a new build) replaces data saved from the old one. */
const fingerprint = (seed: unknown) => {
  const s = JSON.stringify(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
};

let counter = 0;
const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export function createCollection<T extends { id: string }>(key: string, seed: T[]): Collection<T> {
  const store = storage();
  const version = fingerprint(seed);
  const load = (): T[] => {
    try {
      const saved = JSON.parse(store?.getItem(PREFIX + key) ?? "null") as { version: string; items: T[] } | null;
      if (saved && saved.version === version && Array.isArray(saved.items)) return saved.items;
    } catch {
      /* fall back to the seed */
    }
    return structuredClone(seed);
  };
  let items = load();
  const listeners = new Set<() => void>();
  const commit = (next: T[]) => {
    items = next;
    try {
      store?.setItem(PREFIX + key, JSON.stringify({ version, items }));
    } catch {
      /* private mode or full storage: keep it in memory */
    }
    listeners.forEach((l) => l());
  };
  const c: Collection<T> = {
    key,
    all: () => items,
    get: (id) => items.find((i) => i.id === id),
    add: (item) => {
      const created = { ...item, id: item.id ?? newId() } as T;
      commit([created, ...items]);
      return created;
    },
    update: (id, patch) => {
      let updated: T | undefined;
      commit(items.map((i) => (i.id === id ? (updated = { ...i, ...patch, id }) : i)));
      return updated;
    },
    remove: (id) => commit(items.filter((i) => i.id !== id)),
    reset: () => {
      try {
        store?.removeItem(PREFIX + key);
      } catch {
        /* ignore */
      }
      commit(structuredClone(seed));
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  collections.set(key, c as unknown as Collection<{ id: string }>);
  // In development only: how many records each collection holds, so FlowCode's look check can tell when a screen
  // says "No events" while the prototype's sample data has some.
  if (import.meta.env.DEV && typeof window !== "undefined")
    (window as unknown as { __simCounts?: () => Record<string, number> }).__simCounts = () => Object.fromEntries([...collections].map(([k, v]) => [k, v.all().length]));
  return c;
}

/** The collection's items, re-rendering when they change. */
export function useCollection<T extends { id: string }>(c: Collection<T>): T[] {
  return useSyncExternalStore(c.subscribe, c.all, c.all);
}

const savedKeys = new Set<string>();

/**
 * One saved value (settings, preferences, a draft, the last tab), kept in local storage like the collections:
 *   const [units, setUnits] = useSavedState("units", "metric");
 */
export function useSavedState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  savedKeys.add(key);
  const read = (): T => {
    try {
      const raw = storage()?.getItem(`${PREFIX}state:${key}`);
      return raw === null || raw === undefined ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  };
  const [value, setValue] = useState<T>(read);
  const set = useCallback(
    (next: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          storage()?.setItem(`${PREFIX}state:${key}`, JSON.stringify(v));
        } catch {
          /* private mode or full storage: keep it in memory */
        }
        return v;
      }),
    [key],
  );
  return [value, set];
}

/** Puts every collection back to its seed data and clears saved values (the "Reset demo data" action). */
export function resetDemoData() {
  collections.forEach((c) => c.reset());
  for (const k of savedKeys) {
    try {
      storage()?.removeItem(`${PREFIX}state:${k}`);
    } catch {
      /* ignore */
    }
  }
}

/** Runs a simulated request with a short, realistic delay, so loading states and feedback show. */
export async function simulate<T>(work: () => T, ms = 350): Promise<T> {
  await new Promise((r) => setTimeout(r, ms));
  return work();
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * In-app search: every word of the query must appear in one of the fields (case and accents ignored). Matches in
 * earlier fields rank first, then whole-word matches.
 */
export function searchItems<T>(items: readonly T[], query: string, fields: ReadonlyArray<keyof T>): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...items];
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const texts = fields.map((f) => fold(String(item[f] ?? "")));
    let score = 0;
    let all = true;
    for (const w of words) {
      const at = texts.findIndex((t) => t.includes(w));
      if (at < 0) {
        all = false;
        break;
      }
      score += (fields.length - at) * 10 + (new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`).test(texts[at]) ? 5 : 0);
    }
    if (all) scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
}
