/**
 * The current screen, kept in the URL hash (#/goals) so Back and Forward work and a screen can be linked.
 * Records and searches link too: #/orders/42 opens order 42, #/orders?q=late opens the orders screen searched for "late".
 * Use with <AppShell screens={...} current={screen} onNavigate={go} />, or useRoute for the record id and query.
 */
import { useCallback, useEffect, useState } from "react";

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

export function useRoute(ids: readonly string[]): Route & { go: (screen: string, id?: string, query?: Record<string, string | undefined>) => void } {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash, ids));
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash(window.location.hash, ids));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [ids]);
  const go = useCallback((screen: string, id?: string, query?: Record<string, string | undefined>) => {
    const next = linkTo(screen, id, query);
    if (window.location.hash !== next) window.location.hash = next.slice(1);
    // Not in tests: jsdom has no scrolling and logs "Not implemented: window.scrollTo" on every navigation.
    if (!/jsdom/i.test(navigator.userAgent)) window.scrollTo({ top: 0 });
  }, []);
  return { ...route, go };
}

export function useScreen(ids: readonly string[]): [string, (id: string) => void] {
  const { screen, go } = useRoute(ids);
  const goScreen = useCallback((id: string) => go(id), [go]);
  return [screen, goScreen];
}
