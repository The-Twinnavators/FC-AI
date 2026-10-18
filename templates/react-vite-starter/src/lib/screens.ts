/**
 * The current screen, kept in the URL hash (#/goals) so Back and Forward work and a screen can be linked.
 * Records and searches link too: #/orders/42 opens order 42, #/orders?q=late opens the orders screen searched for "late".
 * Use with <AppShell screens={...} current={screen} onNavigate={go} />, or useRoute for the record id and query.
 *
 * One listener serves every useRoute in the app, so each navigation is handled once:
 *  - It's animated as a page transition where the browser can (lib/motion.ts transition); the route changes at once
 *    either way, and a newer navigation skips the running transition and wins.
 *  - Focus and scrolling follow the kind of navigation:
 *      new page (a link, a button, go()): scroll to the top, focus the page's h1 (else <main>);
 *      Back / Forward: return to where that page was scrolled; focus moves only if it was lost (to <main>, no scroll);
 *      same page (only the query changed, or the page said so with updateRoute: a filter, a search, a tab): nothing
 *      moves, nothing animates as a page, and Back / Forward across such steps stay on the page the same way;
 *      another record on the same screen (product A → product B): a new page for focus and scrolling, without a
 *      transition (an intentional instant change: the screen reads its record outside the transition's snapshot);
 *      a navigation to where you already are, or one overtaken by a newer one: no focus or scroll of its own.
 *    The new page's name is announced politely for screen readers on Back / Forward (a new page's heading is focused).
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { skipTransition, transition } from "./motion";

export interface Route {
  /** The screen id (always one of the app's screens). */
  screen: string;
  /** The record id after the screen (#/orders/42 → "42"), if any. */
  id?: string;
  /** Query parameters (#/orders?q=late&status=open). */
  query: URLSearchParams;
}

/** The screen id in a hash like "#/goals", or the first screen when the hash names none of them. */
export function screenFromHash(hash: string, ids: readonly string[]): string {
  const id = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return ids.includes(id) ? id : (ids[0] ?? "");
}

/** The whole route in a hash: screen, record id and query. */
export function routeFromHash(hash: string, ids: readonly string[]): Route {
  const [path, search = ""] = hash.replace(/^#\/?/, "").split("?");
  const [first, second] = path.split("/");
  const screen = ids.includes(first) ? first : (ids[0] ?? "");
  return { screen, id: screen === first && second ? decodeURIComponent(second) : undefined, query: new URLSearchParams(search) };
}

/** A link to a screen, a record on it, or a search: href={linkTo("orders", order.id)}. Works in <a href>. */
export function linkTo(screen: string, id?: string, query?: Record<string, string | undefined>): string {
  const q = new URLSearchParams(Object.entries(query ?? {}).filter((e): e is [string, string] => !!e[1])).toString();
  return `#/${screen}${id ? `/${encodeURIComponent(id)}` : ""}${q ? `?${q}` : ""}`;
}

// ── Navigation (one per app) ──

export type NavigationKind = "initial" | "new" | "back-forward" | "same-page";
export interface Navigation {
  hash: string;
  kind: NavigationKind;
  direction: "forward" | "back";
  /** Increases with every navigation; a handler compares it to know whether a newer one overtook it. */
  seq: number;
}

const inBrowser = typeof window !== "undefined";
const isJsdom = inBrowser && /jsdom/i.test(navigator.userAgent);
const pathOf = (hash: string) => hash.replace(/^#\/?/, "").split("?")[0];

let current: Navigation = { hash: inBrowser ? window.location.hash : "", kind: "initial", direction: "forward", seq: 0 };
let latest = current;
let entry = 0;
let maxEntry = 0;
const scrollOf = new Map<number, number>();
/** History entries made by a same-page update (Back / Forward across them is a same-page update too). */
const samePageEntries = new Set<number>();
let declaredSamePage: string | undefined;
const listeners = new Set<() => void>();

function readEntry(): number | undefined {
  const s = window.history.state as { fcNav?: unknown } | null;
  return typeof s?.fcNav === "number" ? s.fcNav : undefined;
}
function markEntry(n: number) {
  window.history.replaceState({ ...((window.history.state as object | null) ?? {}), fcNav: n }, "");
}

function announce(text: string) {
  let el = document.getElementById("fc-route-announcer");
  if (!el) {
    el = document.createElement("div");
    el.id = "fc-route-announcer";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
    document.body.appendChild(el);
  }
  el.textContent = "";
  window.setTimeout(() => el && (el.textContent = text), 50);
}

const scrollTo = (top: number) => {
  if (!isJsdom) window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
};

/** Focus and scrolling after a navigation has rendered, by its kind (see the top of this file). */
function settle(nav: Navigation) {
  if (nav.seq !== latest.seq) return; // overtaken by a newer navigation: that one decides
  const main = document.querySelector<HTMLElement>("main");
  if (nav.kind === "new") {
    scrollTo(0);
    const h1 = main?.querySelector<HTMLElement>("h1") ?? null;
    const target = h1 ?? main;
    if (target) {
      if (target === h1 && !h1.hasAttribute("tabindex")) h1.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  } else if (nav.kind === "back-forward") {
    scrollTo(scrollOf.get(entry) ?? 0);
    const active = document.activeElement;
    if ((!active || active === document.body || !active.isConnected) && main) main.focus({ preventScroll: true });
    const name = main?.querySelector("h1")?.textContent?.trim();
    if (name) announce(name);
  }
}

function onHashChange() {
  const hash = window.location.hash;
  if (hash === latest.hash) return; // already there: nothing to do
  const previousEntry = entry;
  const previousHash = latest.hash;
  scrollOf.set(previousEntry, window.scrollY);
  const known = readEntry();
  const declared = declaredSamePage === hash;
  declaredSamePage = undefined;
  let kind: NavigationKind;
  let direction: "forward" | "back" = "forward";
  if (known !== undefined) {
    kind = "back-forward";
    direction = known < previousEntry ? "back" : "forward";
    // Across same-page steps only (a filter's Back): still the same page.
    let same = true;
    for (let i = Math.min(known, previousEntry) + 1; i <= Math.max(known, previousEntry); i++) if (!samePageEntries.has(i)) same = false;
    if (same) kind = "same-page";
    entry = known;
  } else {
    kind = declared || pathOf(hash) === pathOf(latest.hash) ? "same-page" : "new";
    entry = ++maxEntry;
    markEntry(entry);
    if (kind === "same-page") samePageEntries.add(entry);
  }
  const nav: Navigation = { hash, kind, direction, seq: latest.seq + 1 };
  latest = nav;
  // Always renders the newest navigation, whichever transition callback runs, so an overtaken one can't win.
  const render = () => {
    current = latest;
    flushSync(() => listeners.forEach((l) => l()));
    settle(nav);
  };
  // Another record on the same screen (product A → product B) changes at once, without a page transition: screens read
  // their record from the address themselves (useHashId), outside the transition's snapshot, so a slide would show the
  // old record moving. Focus and scrolling still follow a new page.
  const sameScreen = (h: string) => pathOf(h).split("/")[0];
  if (kind === "same-page" || (kind === "new" && sameScreen(hash) === sameScreen(previousHash))) render();
  else transition(render, { nav: direction });
}

function subscribe(listener: () => void) {
  if (!listeners.size && inBrowser) {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const known = readEntry();
    if (known === undefined) markEntry(entry);
    else entry = maxEntry = Math.max(known, maxEntry);
    window.addEventListener("hashchange", onHashChange);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && inBrowser) {
      window.removeEventListener("hashchange", onHashChange);
      skipTransition();
    }
  };
}

/** The last navigation (its kind and direction), for a page that wants to treat Back differently. */
export function useNavigation(): Navigation {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export function useRoute(ids: readonly string[]): Route & { go: (screen: string, id?: string, query?: Record<string, string | undefined>) => void } {
  const nav = useNavigation();
  const route = useMemo(() => routeFromHash(nav.hash, ids), [nav.hash, ids]);
  const go = useCallback((screen: string, id?: string, query?: Record<string, string | undefined>) => {
    const next = linkTo(screen, id, query);
    if (window.location.hash !== next) window.location.hash = next.slice(1);
  }, []);
  return { ...route, go };
}

/**
 * Changes the address without it counting as a new page: a filter, a search or a tab on the screen you're on. No page
 * transition, focus and scrolling stay where they are, and the step is still in history (Back undoes it the same way).
 */
export function updateRoute(screen: string, id?: string, query?: Record<string, string | undefined>) {
  const next = linkTo(screen, id, query);
  if (window.location.hash === next) return;
  declaredSamePage = next;
  window.location.hash = next.slice(1);
}

export function useScreen(ids: readonly string[]): [string, (id: string) => void] {
  const { screen, go } = useRoute(ids);
  const goScreen = useCallback((id: string) => go(id), [go]);
  return [screen, goScreen];
}

/** Test hook: forget navigation history between tests (jsdom keeps one window). */
export function resetNavigationForTests() {
  current = latest = { hash: inBrowser ? window.location.hash : "", kind: "initial", direction: "forward", seq: 0 };
  entry = maxEntry = 0;
  scrollOf.clear();
  samePageEntries.clear();
  declaredSamePage = undefined;
}
