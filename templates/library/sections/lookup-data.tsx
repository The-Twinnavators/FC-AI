/**
 * Look-up data: what a look-up app keeps beside its records (app-data.tsx). A look-up app is one people use to find
 * things and where to get them: products and the stores that carry them, books and the libraries that hold them, clinics
 * and their services. On top of the app's store it keeps:
 * - places, each at a ZIP code area with coordinates, and how far each is from the ZIP code the person entered;
 * - which places carry which entries (an entry field holding place ids);
 * - likes, saves, ratings with comments (with "helpful" votes) by the signed-in person;
 * - lists of entries tied to one place, with quantities and checked-off items;
 * - the person's ZIP code, their chosen place and whether they are signed in (a demo sign-in, one tap).
 * Everything follows the app's store's rules: kept in the browser, every page sees a change at once.
 *
 * Not a screen: the look-up pieces bring it with them. Written for FlowCode.
 */
import { useSyncExternalStore } from "react";
import type { AppStore, RecordData } from "./app-data";
import { toast } from "./app-data";

// ── Configuration ──

/** A ZIP code area the prototype knows: its centre, for distances. */
export interface ZipArea {
  zip: string;
  /** "San Francisco, CA" */
  label: string;
  lat: number;
  lng: number;
}

export interface LookupConfig {
  /** The entity people look up (products, books, clinics). */
  entries: string;
  /** The entity of places that carry them (stores, libraries, pharmacies). */
  places: string;
  /** The entries' field that names their category (a select field). */
  categoryField: string;
  /** The entries' field holding the ids of the places that carry them (an array of place ids). */
  placesField: string;
  /** The places' fields: ZIP code and coordinates. */
  placeZipField?: string;
  placeLatField?: string;
  placeLngField?: string;
  /** The ZIP code areas the prototype knows. */
  areas: ZipArea[];
  /** How far counts as near, in miles (10 when left out). */
  nearMiles?: number;
  /** Words for the place ("store", "library") and for carrying it ("carries", "has"). */
  placeWord?: string;
  carryWord?: string;
}

export interface Rating {
  id: string;
  entryId: string;
  who: string;
  stars: number;
  text: string;
  at: string;
  editedAt?: string;
  helpful: number;
  /** Who marked it helpful (so a person can only do it once). */
  helpedBy: string[];
}

export interface ListItem {
  entryId: string;
  qty: number;
  done: boolean;
}

export interface EntryList {
  id: string;
  name: string;
  placeId?: string;
  items: ListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LookupSeed {
  ratings?: Array<Omit<Rating, "id" | "helpedBy"> & { id?: string; helpedBy?: string[] }>;
  lists?: Array<Omit<EntryList, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }>;
  /** Likes and saves other people made, by entry id (counted, never "mine"). */
  likes?: Record<string, number>;
  saves?: Record<string, number>;
}

interface LookupState {
  zip?: string;
  placeId?: string;
  signedIn: boolean;
  liked: string[];
  saved: string[];
  ratings: Rating[];
  lists: EntryList[];
  /** The first-visit ZIP prompt was answered or skipped. */
  zipAsked: boolean;
}

export interface NearbyPlace {
  place: RecordData;
  miles: number;
}

export interface LookupStore {
  app: AppStore;
  config: LookupConfig;
  get(): LookupState;
  subscribe(l: () => void): () => void;
  /** The person's name (the app store's user). */
  me(): string;
  signIn(): void;
  signOut(): void;
  /** Runs `then` when signed in; otherwise says why and offers the one-tap demo sign-in. */
  needsSignIn(why: string): boolean;
  setZip(zip: string): { ok: boolean; message: string };
  clearZip(): void;
  skipZip(): void;
  /** Shows the first-visit ZIP prompt again (keeps the ZIP code until a new one is given). */
  askZipAgain(): void;
  choosePlace(placeId: string | undefined): void;
  area(zip?: string): ZipArea | undefined;
  /** Places near a ZIP code (the person's when left out), nearest first. */
  nearby(zip?: string): NearbyPlace[];
  /** Places near the ZIP that carry this entry, nearest first. */
  carriers(entryId: string, zip?: string): NearbyPlace[];
  /** Whether a place carries an entry. */
  carries(placeId: string, entryId: string): boolean;
  /** The nearest place to the ZIP that carries the entry (any distance). */
  nearestCarrier(entryId: string, zip?: string): NearbyPlace | undefined;
  likes(entryId: string): { count: number; mine: boolean };
  toggleLike(entryId: string): void;
  saves(entryId: string): { count: number; mine: boolean };
  toggleSave(entryId: string): void;
  ratingsFor(entryId: string): Rating[];
  /** Average (0 when none), count and the 5-to-1 breakdown. */
  summary(entryId: string): { average: number; count: number; breakdown: Record<1 | 2 | 3 | 4 | 5, number> };
  rate(entryId: string, stars: number, text: string): { ok: boolean; message: string };
  editRating(id: string, stars: number, text: string): { ok: boolean; message: string };
  deleteRating(id: string): void;
  markHelpful(id: string): void;
  createList(name: string, placeId?: string): EntryList | undefined;
  renameList(id: string, name: string): void;
  deleteList(id: string): void;
  duplicateList(id: string): EntryList | undefined;
  setListPlace(id: string, placeId: string | undefined): void;
  addToList(listId: string, entryId: string, qty?: number): void;
  setQty(listId: string, entryId: string, qty: number): void;
  toggleDone(listId: string, entryId: string): void;
  removeFromList(listId: string, entryId: string, opts?: { silent?: boolean }): void;
  /** Puts an item back where it was (an Undo), without a toast. */
  restoreToList(listId: string, item: ListItem, index: number): void;
  reset(): void;
}

// ── The store ──

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 9);
/** A word's plural: library → libraries, store → stores, branch → branches. */
export const pluralOf = (word: string) => (/[^aeiou]y$/i.test(word) ? `${word.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`);

/** A valid US ZIP code: five digits. */
export const isZip = (s: string) => /^\d{5}$/.test(s.trim());

/** Miles between two points (haversine). */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** "0.4 mi", "12 mi". */
export const formatMiles = (m: number) => (m < 10 ? `${m.toFixed(1)} mi` : `${Math.round(m)} mi`);

/**
 * The look-up layer for an app: make one beside the app's store (createStore) and pass both to the look-up pieces.
 */
export function createLookup(app: AppStore, config: LookupConfig, seed: LookupSeed = {}): LookupStore {
  const key = `fl-lookup:${app.schema.appKey}`;
  const fresh = (): LookupState => ({
    signedIn: true,
    liked: [],
    saved: [],
    zipAsked: false,
    ratings: (seed.ratings ?? []).map((r, i) => ({ ...r, id: r.id ?? `RAT-${1001 + i}`, helpedBy: r.helpedBy ?? [] })),
    lists: (seed.lists ?? []).map((l) => ({ ...l, createdAt: l.createdAt ?? now(), updatedAt: l.updatedAt ?? now() })),
  });
  let state: LookupState = fresh();
  try {
    const saved = localStorage.getItem(key);
    if (saved) state = { ...fresh(), ...(JSON.parse(saved) as LookupState) };
  } catch {
    /* no storage here: the data lives for this visit */
  }
  const listeners = new Set<() => void>();
  const commit = (next: LookupState) => {
    state = next;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* not saved; the change still applies on this page */
    }
    listeners.forEach((l) => l());
  };
  const placeWord = config.placeWord ?? "place";
  const zipF = config.placeZipField ?? "zip";
  const latF = config.placeLatField ?? "lat";
  const lngF = config.placeLngField ?? "lng";
  const near = config.nearMiles ?? 10;
  const places = () => app.get().records[config.places] ?? [];
  const entries = () => app.get().records[config.entries] ?? [];
  const entry = (id: string) => entries().find((e) => e.id === id);
  const entryTitle = (id: string) => {
    const e = entry(id);
    return e ? String(e[app.entity(config.entries).titleField] ?? id) : id;
  };
  const placeIds = (entryId: string) => {
    const v = entry(entryId)?.[config.placesField];
    return Array.isArray(v) ? (v as unknown[]).map(String) : [];
  };
  const areaOf = (zip?: string) => (zip ? config.areas.find((a) => a.zip === zip) : undefined);
  const pointOf = (zip?: string) => {
    const a = areaOf(zip);
    return a ? { lat: a.lat, lng: a.lng } : undefined;
  };
  const distanceTo = (p: RecordData, from: { lat: number; lng: number }) => {
    const lat = Number(p[latF]);
    const lng = Number(p[lngF]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return milesBetween(from, { lat, lng });
    const pa = areaOf(String(p[zipF] ?? ""));
    return pa ? milesBetween(from, pa) : Number.POSITIVE_INFINITY;
  };
  const ranked = (zip?: string) => {
    const from = pointOf(zip ?? state.zip);
    if (!from) return [] as NearbyPlace[];
    return places()
      .map((place) => ({ place, miles: distanceTo(place, from) }))
      .sort((a, b) => a.miles - b.miles);
  };
  const touchList = (id: string, fn: (l: EntryList) => EntryList) => commit({ ...state, lists: state.lists.map((l) => (l.id === id ? { ...fn(l), updatedAt: now() } : l)) });

  const store: LookupStore = {
    app,
    config,
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    me: () => app.get().user,
    signIn() {
      commit({ ...state, signedIn: true });
      toast(`Signed in as ${app.get().user}.`);
    },
    signOut() {
      commit({ ...state, signedIn: false });
      toast("Signed out.", "info");
    },
    needsSignIn(why) {
      if (state.signedIn) return false;
      toast(`Sign in to ${why}. It's one tap in this prototype.`, "info");
      return true;
    },
    setZip(raw) {
      const zip = raw.trim();
      if (!zip) return { ok: false, message: "Enter a ZIP code." };
      if (!isZip(zip)) return { ok: false, message: "A ZIP code is five digits, like 94110." };
      const a = areaOf(zip);
      // A chosen place stays chosen only if it is still near the new ZIP code.
      const keep = state.placeId && a && ranked(zip).some((n) => n.place.id === state.placeId && n.miles <= near) ? state.placeId : undefined;
      commit({ ...state, zip, zipAsked: true, placeId: keep });
      if (!a) return { ok: true, message: `There are no ${pluralOf(placeWord)} near ${zip} in this prototype yet. Try ${config.areas.map((x) => x.zip).join(", ")}.` };
      const count = ranked(zip).filter((n) => n.miles <= near).length;
      return { ok: true, message: `${count} ${count === 1 ? placeWord : pluralOf(placeWord)} near ${zip} (${a.label}).` };
    },
    clearZip() {
      commit({ ...state, zip: undefined, placeId: undefined });
    },
    skipZip() {
      commit({ ...state, zipAsked: true });
    },
    askZipAgain() {
      commit({ ...state, zipAsked: false });
    },
    choosePlace(placeId) {
      commit({ ...state, placeId });
      const p = placeId ? places().find((x) => x.id === placeId) : undefined;
      if (p) toast(`${String(p[app.entity(config.places).titleField] ?? p.id)} chosen.`);
    },
    area: (zip) => areaOf(zip ?? state.zip),
    nearby: (zip) => ranked(zip).filter((n) => n.miles <= near),
    carriers: (entryId, zip) => {
      const ids = placeIds(entryId);
      return ranked(zip).filter((n) => n.miles <= near && ids.includes(n.place.id));
    },
    carries: (placeId, entryId) => placeIds(entryId).includes(placeId),
    nearestCarrier(entryId, zip) {
      const ids = placeIds(entryId);
      return ranked(zip).find((n) => ids.includes(n.place.id));
    },
    likes(entryId) {
      const mine = state.liked.includes(entryId);
      return { count: (seed.likes?.[entryId] ?? 0) + (mine ? 1 : 0), mine };
    },
    toggleLike(entryId) {
      if (store.needsSignIn("like it")) return;
      const mine = state.liked.includes(entryId);
      commit({ ...state, liked: mine ? state.liked.filter((x) => x !== entryId) : [...state.liked, entryId] });
    },
    saves(entryId) {
      const mine = state.saved.includes(entryId);
      return { count: (seed.saves?.[entryId] ?? 0) + (mine ? 1 : 0), mine };
    },
    toggleSave(entryId) {
      if (store.needsSignIn("save it")) return;
      const mine = state.saved.includes(entryId);
      commit({ ...state, saved: mine ? state.saved.filter((x) => x !== entryId) : [entryId, ...state.saved] });
      toast(mine ? `Removed ${entryTitle(entryId)} from Saved.` : `Saved ${entryTitle(entryId)}.`);
    },
    ratingsFor: (entryId) => state.ratings.filter((r) => r.entryId === entryId).sort((a, b) => b.at.localeCompare(a.at)),
    summary(entryId) {
      const rs = state.ratings.filter((r) => r.entryId === entryId);
      const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
      for (const r of rs) breakdown[Math.min(5, Math.max(1, Math.round(r.stars))) as 1 | 2 | 3 | 4 | 5]++;
      return { average: rs.length ? rs.reduce((n, r) => n + r.stars, 0) / rs.length : 0, count: rs.length, breakdown };
    },
    rate(entryId, stars, text) {
      if (store.needsSignIn("rate it")) return { ok: false, message: "Sign in first." };
      if (!(stars >= 1 && stars <= 5)) return { ok: false, message: "Choose 1 to 5 stars." };
      if (text.length > 1000) return { ok: false, message: "A comment can be up to 1,000 characters." };
      const who = app.get().user;
      const existing = state.ratings.find((r) => r.entryId === entryId && r.who === who);
      if (existing) return store.editRating(existing.id, stars, text);
      commit({ ...state, ratings: [{ id: `RAT-${uid()}`, entryId, who, stars, text: text.trim(), at: now(), helpful: 0, helpedBy: [] }, ...state.ratings] });
      return { ok: true, message: "Thanks, your rating is posted." };
    },
    editRating(id, stars, text) {
      const r = state.ratings.find((x) => x.id === id);
      if (!r || r.who !== app.get().user) return { ok: false, message: "You can only change your own rating." };
      if (!(stars >= 1 && stars <= 5)) return { ok: false, message: "Choose 1 to 5 stars." };
      if (text.length > 1000) return { ok: false, message: "A comment can be up to 1,000 characters." };
      commit({ ...state, ratings: state.ratings.map((x) => (x.id === id ? { ...x, stars, text: text.trim(), editedAt: now() } : x)) });
      return { ok: true, message: "Your rating is updated." };
    },
    deleteRating(id) {
      const r = state.ratings.find((x) => x.id === id);
      if (!r || r.who !== app.get().user) return;
      commit({ ...state, ratings: state.ratings.filter((x) => x.id !== id) });
      toast("Your rating is deleted.");
    },
    markHelpful(id) {
      if (store.needsSignIn("mark it helpful")) return;
      const who = app.get().user;
      commit({ ...state, ratings: state.ratings.map((r) => (r.id === id && !r.helpedBy.includes(who) && r.who !== who ? { ...r, helpful: r.helpful + 1, helpedBy: [...r.helpedBy, who] } : r)) });
    },
    createList(name, placeId) {
      if (store.needsSignIn("make a list")) return undefined;
      const clean = name.trim();
      if (!clean) return undefined;
      const list: EntryList = { id: `LST-${uid()}`, name: clean.slice(0, 60), placeId: placeId ?? state.placeId, items: [], createdAt: now(), updatedAt: now() };
      commit({ ...state, lists: [list, ...state.lists] });
      toast(`List "${list.name}" made.`);
      return list;
    },
    renameList(id, name) {
      const clean = name.trim().slice(0, 60);
      if (clean) touchList(id, (l) => ({ ...l, name: clean }));
    },
    deleteList(id) {
      const l = state.lists.find((x) => x.id === id);
      commit({ ...state, lists: state.lists.filter((x) => x.id !== id) });
      if (l) toast(`List "${l.name}" deleted.`);
    },
    duplicateList(id) {
      const l = state.lists.find((x) => x.id === id);
      if (!l) return undefined;
      const copy: EntryList = { ...l, id: `LST-${uid()}`, name: `${l.name} (copy)`.slice(0, 60), items: l.items.map((i) => ({ ...i, done: false })), createdAt: now(), updatedAt: now() };
      commit({ ...state, lists: [copy, ...state.lists] });
      toast(`Made a copy: "${copy.name}".`);
      return copy;
    },
    setListPlace(id, placeId) {
      touchList(id, (l) => ({ ...l, placeId }));
    },
    addToList(listId, entryId, qty = 1) {
      if (store.needsSignIn("add to a list")) return;
      const l = state.lists.find((x) => x.id === listId);
      if (!l) return;
      const has = l.items.find((i) => i.entryId === entryId);
      touchList(listId, (x) => ({ ...x, items: has ? x.items.map((i) => (i.entryId === entryId ? { ...i, qty: i.qty + qty, done: false } : i)) : [...x.items, { entryId, qty, done: false }] }));
      toast(`Added ${entryTitle(entryId)} to "${l.name}".`);
    },
    setQty(listId, entryId, qty) {
      touchList(listId, (l) => ({ ...l, items: l.items.map((i) => (i.entryId === entryId ? { ...i, qty: Math.max(1, Math.min(99, Math.round(qty))) } : i)) }));
    },
    toggleDone(listId, entryId) {
      touchList(listId, (l) => ({ ...l, items: l.items.map((i) => (i.entryId === entryId ? { ...i, done: !i.done } : i)) }));
    },
    removeFromList(listId, entryId, opts = {}) {
      touchList(listId, (l) => ({ ...l, items: l.items.filter((i) => i.entryId !== entryId) }));
      if (!opts.silent) toast(`Removed ${entryTitle(entryId)}.`, "info");
    },
    restoreToList(listId, item, index) {
      touchList(listId, (l) => {
        const items = l.items.filter((i) => i.entryId !== item.entryId);
        items.splice(Math.max(0, Math.min(index, items.length)), 0, item);
        return { ...l, items };
      });
    },
    reset() {
      commit(fresh());
    },
  };
  return store;
}

/** The look-up state, re-rendering when it (or the app's records) change. */
export function useLookup(lookup: LookupStore): LookupState {
  // Records live in the app store; follow both so places and entries update too.
  useSyncExternalStore(lookup.app.subscribe, lookup.app.get, lookup.app.get);
  return useSyncExternalStore(lookup.subscribe, lookup.get, lookup.get);
}

/**
 * Shares a link: the device's share sheet where there is one, otherwise copies the link. Says what happened.
 */
export async function shareLink(title: string, url: string, text?: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function") {
      await navigator.share({ title, text, url });
      return "shared";
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied.");
    return "copied";
  } catch {
    toast("Couldn't copy the link. Select it and copy it instead.", "warning");
    return "failed";
  }
}

/** Where a page's link points, for sharing (#/screen/id on this page's address). */
export const linkFor = (screen: string, id?: string) => `${location.origin}${location.pathname}#/${screen}${id ? `/${encodeURIComponent(id)}` : ""}`;
