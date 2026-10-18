/**
 * Motion helpers (FlowCode). Every one keeps the app correct when animation is skipped, cancelled, unsupported,
 * reduced or off: state changes happen at once, and animation only follows them. Amounts come from the motion tokens
 * (styles/tokens.css, set by the Look's level); styles/motion.css has the CSS side.
 *
 *  - motionMode(): "off" (<html data-motion="off">), "reduced" (the system setting, read live) or "full".
 *  - transition(update, opts): for moving between pages. Runs update inside a same-document View Transition where the
 *    browser has one and motion isn't off; otherwise straight away. A newer one skips the running one; update always
 *    runs. (It delays the next paint by one snapshot, which is fine for a page change but not for every filter press.)
 *  - moveItems(list, update): for results that move in place (filter, sort, reorder). The new state paints in the very
 *    next frame, then items glide from where they were (FLIP with the Web Animations API). Interrupted from where the
 *    items are by the next change; reduced motion only fades new items; off and long lists just update.
 *  - useSaveState(save): immediate acknowledgement, a spinner only after 150ms, clicks during a save coalesced into one
 *    more save, timers cleared on unmount.
 *  - useEnterOnce(ref, key): an entrance for content arriving for the first time (scrolled into view), once per key,
 *    never on re-render, never hiding content that is already on screen; capped stagger from the tokens.
 *  - useCollapse(open): props for .fc-collapse with inert closed content.
 *  - useTabIndicator(listRef, selected): the place of one moving .fc-tab-indicator.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type MotionMode = "full" | "reduced" | "off";

/** Live: read on every call, so a change of the system setting while the app is open applies to the next animation. */
export function motionMode(): MotionMode {
  if (typeof document === "undefined") return "off";
  if (document.documentElement.dataset.motion === "off") return "off";
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
  return "full";
}

/** Turns animation off (true) or back to the app's level (false), e.g. from FlowCode's preview or ?motion=off. */
export function setMotionOff(off: boolean) {
  if (off) document.documentElement.dataset.motion = "off";
  else delete document.documentElement.dataset.motion;
}

interface ViewTransitionLike {
  ready: Promise<void>;
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}
type StartViewTransition = (update: () => void) => ViewTransitionLike;

let active: ViewTransitionLike | undefined;

/** Whether this browser can animate between DOM states (same-document View Transitions). */
export const canViewTransition = () => typeof document !== "undefined" && typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === "function";

/** Skips the running transition, if any (its update still runs). For cleanup on unmount and before another change. */
export function skipTransition() {
  active?.skipTransition();
}

/**
 * Applies `update` (synchronously from the caller's view of state: wrap React state changes in flushSync), animating
 * between before and after where the browser can. `kind` labels it for CSS: "forward" or "back" for page navigation
 * (sets <html data-nav>), anything else for in-page changes.
 */
export function transition(update: () => void, opts: { nav?: "forward" | "back" } = {}): void {
  active?.skipTransition();
  const start = (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition;
  if (motionMode() === "off" || typeof start !== "function") {
    update();
    return;
  }
  let ran = false;
  const once = () => {
    if (ran) return;
    ran = true;
    update();
  };
  const root = document.documentElement;
  if (opts.nav) root.dataset.nav = opts.nav;
  else delete root.dataset.nav;
  let vt: ViewTransitionLike;
  try {
    vt = start.call(document, once);
  } catch {
    // A browser that refuses to start one (another document state, a bad name): the change still happens.
    once();
    return;
  }
  active = vt;
  // Skipped or interrupted transitions reject these promises; that's expected, not an error.
  vt.ready.catch(() => undefined);
  vt.updateCallbackDone.catch(() => once());
  vt.finished
    .catch(() => undefined)
    .finally(() => {
      if (active === vt) {
        active = undefined;
        if (opts.nav) delete root.dataset.nav;
      }
    });
}

let movingItems: Animation[] = [];
const toMs = (v: string, fallback: number) => (/ms$/.test(v.trim()) ? parseFloat(v) : /s$/.test(v.trim()) ? parseFloat(v) * 1000 : fallback);

/**
 * Results that move in place keep their identity (items need data-key). `update` must apply synchronously (wrap React
 * state changes in flushSync). Lists over `max` items just update.
 */
export function moveItems(list: HTMLElement | null, update: () => void, max = 24): void {
  const mode = motionMode();
  if (!list || mode === "off" || list.children.length > max || typeof Element.prototype.animate !== "function") {
    for (const m of movingItems) m.cancel();
    movingItems = [];
    update();
    return;
  }
  const first = new Map<string, DOMRect>();
  for (const el of Array.from(list.children) as HTMLElement[]) if (el.dataset.key) first.set(el.dataset.key, el.getBoundingClientRect());
  for (const m of movingItems) m.cancel();
  movingItems = [];
  update();
  const css = getComputedStyle(document.documentElement);
  const slow = toMs(css.getPropertyValue("--duration-slow"), 320);
  const base = toMs(css.getPropertyValue("--duration-base"), 200);
  const easing = css.getPropertyValue("--ease-out").trim() || "ease-out";
  for (const el of Array.from(list.children) as HTMLElement[]) {
    const was = el.dataset.key ? first.get(el.dataset.key) : undefined;
    if (!was) {
      movingItems.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: base, easing }));
      continue;
    }
    if (mode === "reduced") continue;
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) movingItems.push(el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: slow, easing }));
  }
}

/** Stops items mid-move (for cleanup when a list goes away). */
export function stopMovingItems() {
  for (const m of movingItems) m.cancel();
  movingItems = [];
}

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * A save button's state: "pending" at once (the press is acknowledged), "saving" (show a spinner) only if the save
 * takes longer than 150ms, then "saved" for a moment. Clicks while saving are coalesced into one more save, so the last
 * change is saved and nothing queues up. The returned trigger never throws; an error ends in "error".
 */
export function useSaveState(save: () => Promise<unknown>, opts: { spinnerAfterMs?: number; savedForMs?: number } = {}) {
  const { spinnerAfterMs = 150, savedForMs = 1800 } = opts;
  const [state, setState] = useState<SaveState>("idle");
  const inFlight = useRef(false);
  const again = useRef(false);
  const mounted = useRef(true);
  const timers = useRef<number[]>([]);
  const saveRef = useRef(save);
  saveRef.current = save;
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clear = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clear();
    };
  }, []);
  const run = useCallback(async (): Promise<void> => {
    inFlight.current = true;
    clear();
    setState("pending");
    later(() => mounted.current && inFlight.current && setState("saving"), spinnerAfterMs);
    let ok = true;
    try {
      await saveRef.current();
    } catch {
      ok = false;
    }
    inFlight.current = false;
    if (!mounted.current) return;
    if (again.current) {
      again.current = false;
      return run();
    }
    clear();
    setState(ok ? "saved" : "error");
    if (ok) later(() => mounted.current && setState("idle"), savedForMs);
  }, [spinnerAfterMs, savedForMs]);
  const trigger = useCallback(() => {
    if (inFlight.current) again.current = true;
    else void run();
  }, [run]);
  return { state, trigger, busy: state === "pending" || state === "saving" };
}

const entered = new Set<string>();

/**
 * Gives an element an entrance the first time it scrolls into view: only if it starts off screen, only once per key
 * (re-renders and remounts don't replay it), with its place in the stagger (capped by the tokens). In reduced motion
 * the tokens make it a quick fade; off, nothing. The element is never hidden while waiting: it simply hasn't entered.
 */
export function useEnterOnce(ref: RefObject<HTMLElement | null>, key: string, index = 0) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || entered.has(key) || motionMode() === "off" || typeof IntersectionObserver === "undefined") return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      entered.add(key); // already on screen: no entrance
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (entered.has(key)) return;
      entered.add(key);
      el.style.setProperty("--fc-i", String(index));
      el.classList.add("fc-enter");
      el.addEventListener("animationend", () => el.classList.remove("fc-enter"), { once: true });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, key, index]);
}

/** Props for an expanding region (.fc-collapse): open state on the wrapper, and the inner content inert while closed. */
export function useCollapse(open: boolean) {
  return {
    wrapper: { className: "fc-collapse", "data-open": String(open) },
    inner: { inert: !open || undefined } as { inert?: boolean },
  };
}

/** Places one .fc-tab-indicator under the selected tab (in a position: relative tab list); follows resizes. */
export function useTabIndicator(listRef: RefObject<HTMLElement | null>, selected: string | number) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const place = () => {
      const tab = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!tab) return;
      list.style.setProperty("--fc-tab-x", `${tab.offsetLeft}px`);
      list.style.setProperty("--fc-tab-w", `${tab.offsetWidth}px`);
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [listRef, selected]);
}
