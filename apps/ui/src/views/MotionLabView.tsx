/**
 * Motion Lab: FlowCode's motion patterns, running live, as a page of the app (the same patterns as the published review
 * harness, docs/design/motion/motion-lab.html, built here with FlowCode's own controls). Switch the level (Minimal,
 * Balanced, Expressive), the surface (Flat, Tactile), reduced motion and animation off; each pattern lists where it fits
 * and how it's tested, and the behaviour checks exercise rapid input, focus and "animation off" on this page.
 * It demonstrates patterns: it isn't the builder, and its expressive examples aren't in generated apps yet.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "../styles/motion-lab.css";

type Level = "minimal" | "balanced" | "expressive";
type Surface = "flat" | "tactile";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private window: settings just aren't remembered */
  }
};

/** The page's live settings, read by the patterns (the root element carries them for CSS). */
interface Settings {
  root: () => HTMLElement | null;
  reduced: () => boolean;
  off: () => boolean;
  level: () => Level;
}
const msVar = (el: HTMLElement | null, name: string, fallback: number) => {
  if (!el) return fallback;
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v.endsWith("ms") ? parseFloat(v) : v.endsWith("s") ? parseFloat(v) * 1000 : fallback;
};

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; name: string }>; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="ml-ctl">
      <span id={id} className="label">
        {label}
      </span>
      <div className="seg" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pattern({ id, eyebrow, title, why, stage, spec }: { id: string; eyebrow: string; title: string; why: ReactNode; stage: ReactNode; spec: Array<[string, ReactNode]> }) {
  return (
    <section className="ml-pat" id={`ml-${id}`} aria-labelledby={`ml-${id}-h`}>
      <header className="ml-pat__head">
        <span className="label">{eyebrow}</span>
        <h2 id={`ml-${id}-h`} className="ml-pat__title">
          {title}
        </h2>
        <p className="ml-pat__why">{why}</p>
      </header>
      <div className="ml-stage">{stage}</div>
      <dl className="ml-spec">
        {spec.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
const Native = ({ children }: { children: ReactNode }) => <span className="chip chip--ok">{children}</span>;
const Lib = ({ children }: { children: ReactNode }) => <span className="chip chip--warn">{children}</span>;

// ── 1. Controls ──
function Controls() {
  const [on, setOn] = useState(false);
  return (
    <>
      <div className="ml-row">
        <button type="button" className="btn btn--primary ml-press">
          Add to list
        </button>
        <button type="button" className="btn ml-press">
          Compare
        </button>
        <button type="button" className="btn ml-press" disabled>
          Unavailable
        </button>
      </div>
      <div className="ml-row">
        <button type="button" className="ml-switch" role="switch" aria-checked={on} data-ml="switch" onClick={() => setOn((v) => !v)}>
          <span className="ml-switch__track">
            <span className="ml-switch__thumb" />
          </span>
          Price alerts
        </button>
        <label className="ml-check">
          <input type="checkbox" />
          <span className="ml-check__box" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M2.5 7.5l3 3 6-7" />
            </svg>
          </span>
          Only in stock
        </label>
      </div>
      <p className="muted ml-note">Flat presses with a tint and a tiny scale; Tactile also drops its shadow and moves 1px.</p>
    </>
  );
}

// ── 2. Save and selection ──
function SaveAndSelect({ sent }: { sent: React.MutableRefObject<number> }) {
  const [state, setState] = useState<"idle" | "pending" | "saving" | "saved">("idle");
  const [count, setCount] = useState(0);
  const inFlight = useRef(false);
  const again = useRef(false);
  const timers = useRef<number[]>([]);
  const alive = useRef(true);
  // Set on every mount (React mounts twice in development), cleared on unmount.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);
  const run = useCallback(async (): Promise<void> => {
    inFlight.current = true;
    sent.current++;
    setCount(sent.current);
    timers.current.forEach(clearTimeout);
    setState("pending");
    timers.current = [window.setTimeout(() => alive.current && inFlight.current && setState("saving"), 150)];
    await sleep(420);
    inFlight.current = false;
    if (!alive.current) return;
    if (again.current) {
      again.current = false;
      return run();
    }
    setState("saved");
    timers.current = [window.setTimeout(() => alive.current && setState("idle"), 1800)];
  }, [sent]);
  const click = () => {
    if (inFlight.current) again.current = true;
    else void run();
  };
  const [pick, setPick] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const options = ["Standard", "Express", "Pick up in store"];
  const choose = (i: number) => {
    setPick(i);
    list.current?.querySelectorAll<HTMLElement>("li")[i]?.focus();
  };
  return (
    <>
      <div className="ml-row">
        <button type="button" className="btn ml-press ml-save" data-ml="save" data-state={state} onClick={click}>
          {state === "saving" ? <span className="ml-spin" aria-hidden="true" /> : null}
          {state === "saved" ? <span className="ml-tick" aria-hidden="true">✓</span> : null}
          {state === "pending" || state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save changes"}
        </button>
        <span className="muted" role="status">
          {count} save{count === 1 ? "" : "s"} sent{state === "saved" ? " · saved" : ""}
        </span>
      </div>
      <ul ref={list} className="ml-pick" role="listbox" aria-label="Delivery" onKeyDown={(e) => (e.key === "ArrowDown" || e.key === "ArrowUp") && (e.preventDefault(), choose((pick + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length))}>
        {options.map((o, i) => (
          <li key={o} role="option" aria-selected={pick === i} tabIndex={pick === i ? 0 : -1} onClick={() => choose(i)}>
            {o} <span className="ml-pick__mark" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </>
  );
}

// ── 3. Dialogs and drawers (native <dialog>) ──
function Dialogs() {
  const dlg = useRef<HTMLDialogElement>(null);
  const drw = useRef<HTMLDialogElement>(null);
  const closeOn = (e: React.MouseEvent<HTMLDialogElement>) => {
    if ((e.target as HTMLElement).closest("[data-close]") || e.target === e.currentTarget) e.currentTarget.close();
  };
  return (
    <>
      <div className="ml-row">
        <button type="button" className="btn ml-press" data-ml="open-dialog" onClick={() => !dlg.current?.open && dlg.current?.showModal()}>
          Rename list
        </button>
        <button type="button" className="btn ml-press" data-ml="open-drawer" onClick={() => !drw.current?.open && drw.current?.showModal()}>
          Filters
        </button>
      </div>
      <p className="muted ml-note">Open, then press Escape at once, or open and close quickly: the state always follows the last action.</p>
      <dialog ref={dlg} className="ml-dialog" aria-labelledby="ml-dlg-h" onClick={closeOn} data-ml="dialog">
        <h3 id="ml-dlg-h">Rename list</h3>
        <label className="ml-field">
          List name <input className="input" defaultValue="Weekly shop" />
        </label>
        <div className="ml-row ml-row--end">
          <button type="button" className="btn" data-close>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" data-close>
            Save name
          </button>
        </div>
      </dialog>
      <dialog ref={drw} className="ml-dialog ml-drawer" aria-labelledby="ml-drw-h" onClick={closeOn} data-ml="drawer">
        <h3 id="ml-drw-h">Filters</h3>
        <label className="ml-field">
          Max price <input className="input" inputMode="decimal" defaultValue="4.00" data-ml="drawer-field" />
        </label>
        <div className="ml-row ml-row--end">
          <button type="button" className="btn btn--primary" data-close>
            Show 18 products
          </button>
        </div>
      </dialog>
    </>
  );
}

// ── 4. Expand and collapse ──
function Disclosure({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ml-disc${open ? " is-open" : ""}`}>
      <button type="button" aria-expanded={open} aria-controls={id} data-ml={`toggle-${id}`} onClick={() => setOpen((v) => !v)}>
        {title} <span className="ml-disc__chev" aria-hidden="true">▾</span>
      </button>
      <div className="ml-disc__body" id={id}>
        <div>
          <div inert={!open || undefined}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── 5. Tabs ──
function Tabs() {
  const tabs = ["Overview", "Nutrition", "Stores nearby"];
  const panels = ["Oat Milk Original, 1 L. Willow Farms. 4.8 from 212 ratings.", "Per 100 ml: 46 kcal · fat 1.5 g · sugars 4 g · calcium 120 mg.", "3 stores within 3 miles carry it today."];
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const base = useId();
  const focusNext = useRef(false);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const place = () => {
      const t = el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (t) (el.style.setProperty("--x", `${t.offsetLeft}px`), el.style.setProperty("--w", `${t.offsetWidth}px`));
    };
    place();
    if (focusNext.current) (focusNext.current = false, el.querySelectorAll<HTMLElement>('[role="tab"]')[sel]?.focus());
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sel]);
  const key = (e: React.KeyboardEvent) => {
    const next = { ArrowRight: (sel + 1) % tabs.length, ArrowLeft: (sel - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    focusNext.current = true;
    setSel(next);
  };
  return (
    <div>
      <div ref={list} className="ml-tabs" role="tablist" aria-label="Product" onKeyDown={key} data-ml="tablist">
        {tabs.map((t, i) => (
          <button key={t} type="button" role="tab" id={`${base}-t${i}`} aria-selected={sel === i} aria-controls={`${base}-p`} tabIndex={sel === i ? 0 : -1} onClick={() => setSel(i)}>
            {t}
          </button>
        ))}
        <span className="ml-tabs__ind" aria-hidden="true" />
      </div>
      <div role="tabpanel" id={`${base}-p`} aria-labelledby={`${base}-t${sel}`} tabIndex={0} className="ml-tabs__panel" key={sel}>
        {panels[sel]}
      </div>
    </div>
  );
}

// ── 6. Page transitions (a small app inside this page, with its own Back) ──
const PAGES: Record<string, { h: string; p: string }> = {
  home: { h: "Home", p: "12 products on your list · 3 stores nearby have them all." },
  list: { h: "My list", p: "Oat Milk Original · Sourdough loaf · Gala apples (6) · Greek yogurt" },
  stores: { h: "Stores", p: "Northside Market 0.4 mi · Corner Grocer 1.2 mi · Harbor Foods 2.8 mi" },
};
const ORDER = ["home", "list", "stores"];
type VT = { skipTransition(): void; ready: Promise<void>; finished: Promise<void> };
function MiniApp({ settings, api }: { settings: Settings; api: React.MutableRefObject<{ go: (p: string) => void; back: () => void; current: () => string } | null> }) {
  const [page, setPage] = useState("home");
  const stack = useRef<string[]>(["home"]);
  const current = useRef("home");
  const heading = useRef<HTMLHeadingElement>(null);
  const vt = useRef<VT | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const show = useCallback(
    (p: string, dir: "forward" | "back") => {
      if (p === current.current) return;
      current.current = p;
      const update = () => {
        setPage(p);
        queueMicrotask(() => heading.current?.focus({ preventScroll: true }));
      };
      vt.current?.skipTransition();
      const start = (document as unknown as { startViewTransition?: (cb: () => void) => VT }).startViewTransition;
      if (!start || settings.off()) return update();
      box.current?.setAttribute("data-dir", dir);
      const t = start.call(document, () => {
        // Synchronous render inside the transition: the new page is what the browser captures.
        update();
      });
      vt.current = t;
      t.ready.catch(() => undefined);
      t.finished.catch(() => undefined);
    },
    [settings],
  );
  useEffect(() => {
    api.current = {
      go: (p) => {
        if (p === current.current) return;
        stack.current.push(p);
        show(p, ORDER.indexOf(p) < ORDER.indexOf(current.current) ? "back" : "forward");
      },
      back: () => {
        if (stack.current.length < 2) return;
        stack.current.pop();
        show(stack.current[stack.current.length - 1]!, "back");
      },
      current: () => current.current,
    };
  }, [api, show]);
  useEffect(() => () => vt.current?.skipTransition(), []);
  return (
    <div className="ml-mini" ref={box}>
      <nav aria-label="Mini app">
        <button type="button" className="ml-mini__back" onClick={() => api.current?.back()} disabled={stack.current.length < 2} data-ml="mini-back">
          ‹ Back
        </button>
        {ORDER.map((p) => (
          <a key={p} href={`#ml-${p}`} aria-current={page === p ? "page" : undefined} data-ml={`mini-${p}`} onClick={(e) => (e.preventDefault(), api.current?.go(p))}>
            {PAGES[p]!.h}
          </a>
        ))}
      </nav>
      <div className="ml-mini__page">
        <h3 ref={heading} tabIndex={-1}>
          {PAGES[page]!.h}
        </h3>
        <p className="muted">{PAGES[page]!.p}</p>
      </div>
    </div>
  );
}

// ── 7. Cards ──
const PRODUCTS: Array<[string, string, string, boolean?]> = [
  ["Oat Milk Original", "$2.89 · 4.8", "#c9d6f2", true], ["Sourdough loaf", "$4.50 · 4.6", "#ead9c0"], ["Gala apples", "$0.62 ea · 4.5", "#f2c9c4"],
  ["Greek yogurt", "$3.20 · 4.7", "#e6ecef"], ["Cold brew", "$5.10 · 4.4", "#d8cbbd"], ["Baby spinach", "$2.40 · 4.3", "#cfe5c8"],
  ["Almond butter", "$7.90 · 4.8", "#e9d3b0"], ["Rye crackers", "$3.10 · 4.2", "#e3dccb"], ["Blueberries", "$4.20 · 4.6", "#cdd0ef"],
];
function Cards({ settings, rerenders }: { settings: Settings; rerenders: number }) {
  const grid = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<number>());
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>(".ml-card"));
    const waiting: HTMLElement[] = [];
    for (const c of cards) {
      const i = Number(c.dataset.i);
      if (seen.current.has(i) || settings.off()) {
        seen.current.add(i);
        continue;
      }
      const r = c.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) seen.current.add(i); // on screen already: no entrance
      else (c.classList.add("is-waiting"), waiting.push(c));
    }
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const c = en.target as HTMLElement;
        io.unobserve(c);
        seen.current.add(Number(c.dataset.i));
        c.style.setProperty("--i", String(n++));
        c.classList.remove("is-waiting");
        c.classList.add("is-entering");
        c.addEventListener("animationend", () => c.classList.remove("is-entering"), { once: true });
      }
    });
    waiting.forEach((c) => io.observe(c));
    // Nothing stays hidden if the observer never fires.
    const safety = window.setTimeout(() => waiting.forEach((c) => (c.classList.remove("is-waiting"), seen.current.add(Number(c.dataset.i)))), 4000);
    return () => (io.disconnect(), clearTimeout(safety));
  }, [rerenders, settings]);
  return (
    <div ref={grid} className="ml-cards" data-ml="cards">
      {PRODUCTS.map(([n, m, c, f], i) => (
        <a key={`${i}-${rerenders}`} className={`ml-card${f ? " ml-card--featured" : ""}`} href="#ml-cards" data-i={i} style={{ "--c": c } as React.CSSProperties} onClick={(e) => e.preventDefault()}>
          <span className="ml-card__sw" />
          <strong>{n}</strong>
          <span className="muted">{m}</span>
        </a>
      ))}
    </div>
  );
}

// ── 8. Filtering and sorting ──
const ITEMS = [
  ["Oat Milk Original", "dairy", 2.89], ["Coconut yogurt", "dairy", 3.6], ["Almond milk", "dairy", 2.49], ["Sourdough loaf", "bakery", 4.5],
  ["Rye bread", "bakery", 3.8], ["Croissants (4)", "bakery", 5.2], ["Gala apples", "produce", 0.62], ["Baby spinach", "produce", 2.4], ["Blueberries", "produce", 4.2],
].map(([n, c, p], id) => ({ id, n: n as string, c: c as string, p: p as number }));
function Filter({ settings }: { settings: Settings }) {
  const [filter, setFilter] = useState("all");
  const [asc, setAsc] = useState(true);
  const list = useRef<HTMLDivElement>(null);
  const first = useRef<Map<string, DOMRect> | null>(null);
  const moving = useRef<Animation[]>([]);
  const visible = useMemo(() => ITEMS.filter((x) => filter === "all" || x.c === filter).sort((a, b) => (asc ? a.p - b.p : b.p - a.p)), [filter, asc]);
  // FLIP: where each item is now (mid-move included), then the new state paints and items glide from there.
  const change = (fn: () => void) => {
    const el = list.current;
    if (el && !settings.off()) first.current = new Map(Array.from(el.children).map((c) => [(c as HTMLElement).dataset.key!, c.getBoundingClientRect()]));
    moving.current.forEach((m) => m.cancel());
    moving.current = [];
    fn();
  };
  useLayoutEffect(() => {
    const el = list.current;
    const was = first.current;
    first.current = null;
    if (!el || !was) return;
    const slow = msVar(settings.root(), "--ml-slow", 320);
    const base = msVar(settings.root(), "--ml-base", 200);
    for (const c of Array.from(el.children) as HTMLElement[]) {
      const f = was.get(c.dataset.key!);
      if (!f) {
        moving.current.push(c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: base, easing: "cubic-bezier(.16,1,.3,1)" }));
        continue;
      }
      if (settings.reduced()) continue;
      const l = c.getBoundingClientRect();
      const dx = f.left - l.left;
      const dy = f.top - l.top;
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) moving.current.push(c.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: slow, easing: "cubic-bezier(.16,1,.3,1)" }));
    }
  }, [visible, settings]);
  useEffect(() => () => moving.current.forEach((m) => m.cancel()), []);
  return (
    <>
      <div className="ml-row">
        <div className="seg" role="radiogroup" aria-label="Category" data-ml="chips">
          {[["all", "All"], ["dairy", "Dairy-free"], ["bakery", "Bakery"], ["produce", "Produce"]].map(([c, label]) => (
            <button key={c} type="button" role="radio" aria-checked={filter === c} data-c={c} onClick={() => change(() => setFilter(c!))}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--sm" onClick={() => change(() => setAsc((v) => !v))}>
          Sort: price {asc ? "↑" : "↓"}
        </button>
        <span className="muted mono" role="status" data-ml="count">
          {visible.length} products
        </span>
      </div>
      <div ref={list} className="ml-list" data-ml="list">
        {visible.map((x) => (
          <div key={x.id} className="ml-item" data-key={x.id}>
            <b>{x.n}</b>
            <span className="muted">${x.p.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── 9. Hero ──
function Hero({ settings, api }: { settings: Settings; api: React.MutableRefObject<{ play: () => void; clicks: () => number } | null> }) {
  const box = useRef<HTMLDivElement>(null);
  const clicks = useRef(0);
  const [log, setLog] = useState("");
  const play = useCallback(() => {
    if (settings.level() === "minimal" || settings.reduced() || settings.off()) return;
    const el = box.current;
    if (!el) return;
    el.classList.remove("is-playing");
    void el.offsetWidth;
    el.classList.add("is-playing");
  }, [settings]);
  useEffect(() => {
    api.current = { play, clicks: () => clicks.current };
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && (play(), io.disconnect()), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [api, play]);
  return (
    <>
      <div ref={box} className="ml-hero">
        <span className="ml-hero__glow" aria-hidden="true" />
        <span className="label">Clean Cart</span>
        <h3>
          {["Find", "it", "near", "you."].map((w, i) => (
            <span key={w} className="ml-hero__w" style={{ "--i": i } as React.CSSProperties}>
              {w}{" "}
            </span>
          ))}
        </h3>
        <p className="ml-hero__lede">Search products, save the ones you like and see which stores nearby carry them today.</p>
        <button type="button" className="btn btn--primary ml-press" data-ml="hero-cta" onClick={() => setLog(`Call to action pressed (${++clicks.current}): usable during the animation.`)}>
          Start searching
        </button>
      </div>
      <div className="ml-row">
        <button type="button" className="btn btn--sm" onClick={play}>
          Replay hero
        </button>
        <span className="muted">{log}</span>
      </div>
    </>
  );
}

// ── 10. Product demonstration ──
const STEPS = ["Step 1 of 3: search for a product", "Step 2 of 3: results from stores nearby", "Step 3 of 3: save it to your list"];
function Demo({ settings, api }: { settings: Settings; api: React.MutableRefObject<{ step: () => number; paused: () => boolean; toggle: () => void } | null> }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [typed, setTyped] = useState("");
  const [onScreen, setOnScreen] = useState(false);
  const loops = useRef(0);
  const scr = useRef<HTMLDivElement>(null);
  const auto = !(settings.reduced() || settings.level() === "minimal" || settings.off());
  useEffect(() => {
    const el = scr.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setOnScreen(!!es[0]?.isIntersecting));
    io.observe(el);
    const vis = () => setOnScreen((v) => v && !document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => (io.disconnect(), document.removeEventListener("visibilitychange", vis));
  }, []);
  useEffect(() => {
    if (step !== 0) return;
    if (!auto) return setTyped("oat milk");
    setTyped("");
    let i = 0;
    const t = window.setInterval(() => (setTyped("oat milk".slice(0, ++i)), i >= 8 && clearInterval(t)), 70);
    return () => clearInterval(t);
  }, [step, auto]);
  useEffect(() => {
    if (!auto || paused || !onScreen || loops.current >= 3) return;
    const t = window.setTimeout(() => {
      setStep((s) => {
        const n = (s + 1) % 3;
        if (n === 0) loops.current++;
        if (loops.current >= 3) setPaused(true);
        return n;
      });
    }, 2200);
    return () => clearTimeout(t);
  }, [step, paused, onScreen, auto]);
  useEffect(() => {
    api.current = { step: () => step, paused: () => paused, toggle: () => (setPaused((p) => !p), (loops.current = 0)) };
  }, [api, step, paused]);
  const cursor = [{ x: 120, y: 22 }, { x: 260, y: 68 }, { x: 330, y: 70 }][step]!;
  return (
    <div className="ml-demo">
      <div className="ml-demo__scr" ref={scr} aria-hidden="true">
        <div className="ml-demo__bar">
          <span className="ml-demo__field">{typed}</span>
          <span className="btn btn--primary btn--sm">Search</span>
        </div>
        <div className={`ml-demo__res${step >= 1 ? " is-shown" : ""}`}>
          <div>
            <span>Oat Milk Original</span>
            <span className={step === 2 ? "ml-demo__saved" : ""}>{step === 2 ? "✓ Saved" : "Save"}</span>
          </div>
          <div>
            <span>Oat Milk Barista</span>
            <span>Save</span>
          </div>
        </div>
        {auto ? <span className="ml-demo__cursor" style={{ translate: `${cursor.x}px ${cursor.y}px` }} /> : null}
      </div>
      <div className="ml-row ml-row--between">
        <span role="status">{paused && loops.current >= 3 ? "Demo finished. Press Play to watch again." : STEPS[step]}</span>
        <span className="ml-row">
          {!auto
            ? STEPS.map((_, i) => (
                <button key={i} type="button" className="btn btn--sm" aria-pressed={step === i} onClick={() => setStep(i)}>
                  {i + 1}
                </button>
              ))
            : null}
          <button type="button" className="btn btn--sm" aria-pressed={paused} data-ml="demo-pause" onClick={() => api.current?.toggle()}>
            {paused ? "Play" : "Pause"}
          </button>
        </span>
      </div>
    </div>
  );
}

// ── 11. Smooth scrolling and ambient background ──
function Ambient({ settings }: { settings: Settings }) {
  const [smooth, setSmooth] = useState(false);
  const [amb, setAmb] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setVisible(!!es[0]?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div className="ml-row">
        <label className="ml-toggle">
          <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} /> Smooth in-page scrolling
        </label>
        <label className="ml-toggle">
          <input type="checkbox" checked={amb} onChange={(e) => setAmb(e.target.checked)} /> Animated background
        </label>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => document.getElementById("ml-controls")?.scrollIntoView({ behavior: smooth && !settings.reduced() && !settings.off() ? "smooth" : "auto", block: "start" })}>
          Jump to the first pattern
        </button>
      </div>
      <div ref={box} className={`ml-ambient${amb ? " is-on" : ""}${visible ? "" : " is-paused"}`}>
        Seasonal produce, picked this week
      </div>
    </>
  );
}

// ── Behaviour checks ──
type Check = [string, () => Promise<true | string>];

export function MotionLabView() {
  const [level, setLevel] = useState<Level>(() => (read("fc.motionLab.level") as Level) || "balanced");
  const [surface, setSurface] = useState<Surface>(() => (read("fc.motionLab.surface") as Surface) || "flat");
  const [rmToggle, setRmToggle] = useState(false);
  const [osReduced, setOsReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [off, setOff] = useState(false);
  const [rerenders, setRerenders] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const sent = useRef(0);
  const mini = useRef<{ go: (p: string) => void; back: () => void; current: () => string } | null>(null);
  const hero = useRef<{ play: () => void; clicks: () => number } | null>(null);
  const demo = useRef<{ step: () => number; paused: () => boolean; toggle: () => void } | null>(null);
  const reduced = rmToggle || osReduced;
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setOsReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => write("fc.motionLab.level", level), [level]);
  useEffect(() => write("fc.motionLab.surface", surface), [surface]);
  // Live values for the patterns' event handlers (they read the page as it is now, not as it was when they rendered).
  const live = useRef({ level, reduced, off });
  live.current = { level, reduced, off };
  const settings = useMemo<Settings>(() => ({ root: () => root.current, reduced: () => live.current.reduced || live.current.off, off: () => live.current.off, level: () => live.current.level }), []);

  const [results, setResults] = useState<Array<{ name: string; ok: boolean; detail: string }>>([]);
  const [running, setRunning] = useState(false);
  const q = <T extends Element = HTMLElement>(sel: string) => root.current?.querySelector<T>(sel) ?? null;
  const settle = async (ms = 600) => (await sleep(ms), await frame());
  const CHECKS: Check[] = [
    ["Rapid toggling (11 presses) ends on the pressed state", async () => {
      const sw = q("[data-ml=switch]")!;
      const start = sw.getAttribute("aria-checked") === "true";
      for (let i = 0; i < 11; i++) sw.click();
      await settle(500);
      const t = q(".ml-switch__thumb")!.getBoundingClientRect();
      const tr = q(".ml-switch__track")!.getBoundingClientRect();
      const right = t.left - tr.left > 10;
      return (sw.getAttribute("aria-checked") === String(!start) && right === !start) || `state ${sw.getAttribute("aria-checked")}; thumb ${right ? "right" : "left"}`;
    }],
    ["5 rapid saves send exactly 2 and end on \"Saved\"", async () => {
      await sleep(500);
      const b = q("[data-ml=save]")!;
      const before = sent.current;
      for (let i = 0; i < 5; i++) b.click();
      await sleep(1100);
      return (sent.current - before === 2 && b.dataset.state === "saved") || `${sent.current - before} sent; ${b.dataset.state}`;
    }],
    ["Dialog: open then close at once → closed, focus back on the opener", async () => {
      const b = q("[data-ml=open-dialog]")!;
      b.focus();
      b.click();
      q<HTMLDialogElement>("[data-ml=dialog]")!.close();
      await settle(400);
      const closed = !q<HTMLDialogElement>("[data-ml=dialog]")!.open;
      const back = document.activeElement === b;
      return (closed && back) || `state ${closed ? "closed" : "STILL OPEN"}; focus ${back ? "back" : "elsewhere"}`;
    }],
    ["Drawer: its field is usable on the first frame", async () => {
      const d = q<HTMLDialogElement>("[data-ml=drawer]")!;
      d.showModal();
      await frame();
      const f = q<HTMLInputElement>("[data-ml=drawer-field]")!;
      f.focus();
      const ok = document.activeElement === f;
      d.close();
      await settle(400);
      return ok || "the field couldn't take focus";
    }],
    ["Collapsed content can't take focus; open content can", async () => {
      const link = q<HTMLAnchorElement>("#ml-d1 a")!;
      link.focus();
      const blocked = document.activeElement !== link;
      const btn = q("[data-ml=toggle-ml-d1]")!;
      btn.click();
      await frame();
      await frame();
      link.focus();
      const reachable = document.activeElement === link;
      btn.click();
      await settle(400);
      return (blocked && reachable) || `closed ${blocked ? "blocked" : "REACHABLE"}; open ${reachable ? "reachable" : "BLOCKED"}`;
    }],
    ["Tabs: arrow keys move selection and focus; the indicator lands on the selected tab", async () => {
      const list = q("[data-ml=tablist]")!;
      const tabs = Array.from(list.querySelectorAll<HTMLElement>("[role=tab]"));
      tabs[0]!.click();
      tabs[0]!.focus();
      await frame();
      for (let i = 0; i < 4; i++) {
        (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        await frame();
      }
      await settle(500);
      const sel = tabs.find((t) => t.getAttribute("aria-selected") === "true")!;
      const ind = q(".ml-tabs__ind")!.getBoundingClientRect();
      const tb = sel.getBoundingClientRect();
      const okInd = Math.abs(ind.left - tb.left) < 2 && Math.abs(ind.width - tb.width) < 2;
      const res = (sel === tabs[1] && document.activeElement === tabs[1] && okInd) || `selected ${tabs.indexOf(sel) + 1}; focus ${document.activeElement === tabs[1] ? "on it" : "elsewhere"}; indicator ${okInd ? "on it" : "OFF"}`;
      tabs[0]!.click();
      return res;
    }],
    ["Page transitions: 3 quick presses end on the last; Back returns; focus on the heading", async () => {
      const m = mini.current!;
      m.go("list");
      m.go("stores");
      m.go("list");
      await settle(700);
      const okLast = m.current() === "list";
      const okFocus = document.activeElement === q(".ml-mini__page h3");
      m.back();
      await settle(700);
      const okBack = m.current() === "stores";
      m.go("home");
      await settle(500);
      return (okLast && okFocus && okBack) || `last ${okLast ? "ok" : "WRONG"}; focus ${okFocus ? "on heading" : "elsewhere"}; Back ${okBack ? "ok" : "WRONG"}`;
    }],
    ["Filter: 3 choices within 100ms → the list matches the last", async () => {
      const chip = (c: string) => q(`[data-ml=chips] [data-c=${c}]`)!;
      chip("dairy").click();
      await sleep(30);
      chip("bakery").click();
      await sleep(30);
      chip("produce").click();
      await settle(700);
      const names = Array.from(root.current!.querySelectorAll("[data-ml=list] b")).map((b) => b.textContent);
      const ok = names.length === 3 && names.every((n) => ["Gala apples", "Baby spinach", "Blueberries"].includes(n ?? "")) && q("[data-ml=count]")!.textContent === "3 products";
      chip("all").click();
      await settle(500);
      return ok || `got ${names.join(", ")}`;
    }],
    ["Re-render replays no card entrance", async () => {
      setRerenders((n) => n + 1);
      await frame();
      await frame();
      const entering = root.current!.querySelectorAll(".ml-card.is-entering").length;
      return entering === 0 || `${entering} cards replayed`;
    }],
    ["Hero call to action is usable during the animation", async () => {
      const before = hero.current!.clicks();
      hero.current!.play();
      await sleep(30);
      q("[data-ml=hero-cta]")!.click();
      return hero.current!.clicks() === before + 1 || "the press didn't register";
    }],
    ["Product demo pauses when paused (no further steps)", async () => {
      const d = demo.current!;
      const was = d.paused();
      if (!was) d.toggle();
      await frame();
      const s = d.step();
      await sleep(2600);
      const still = d.step() === s;
      if (!was) d.toggle();
      return still || "it kept going";
    }],
    ["Animation off: nothing in view is left hidden", async () => {
      const was = live.current.off;
      setOff(true);
      await settle(150);
      const hidden = Array.from(root.current!.querySelectorAll<HTMLElement>("h2, h3, p, .ml-card:not(.is-waiting), .ml-item, .ml-hero__w, .ml-hero__lede")).filter((el) => el.offsetWidth > 0 && getComputedStyle(el).opacity === "0");
      if (!was) setOff(false);
      return hidden.length === 0 || `${hidden.length} hidden`;
    }],
  ];
  const run = async () => {
    setRunning(true);
    setResults([]);
    const out: Array<{ name: string; ok: boolean; detail: string }> = [];
    for (const [name, fn] of CHECKS) {
      let r: true | string = "error";
      try {
        r = await fn();
      } catch (e) {
        r = String(e);
      }
      out.push({ name, ok: r === true, detail: r === true ? "" : r });
      setResults([...out]);
    }
    setRunning(false);
  };
  const passed = results.filter((r) => r.ok).length;

  return (
    <div ref={root} className="page page-enter ml" data-level={level} data-surface={surface} data-rm={reduced ? "" : undefined} data-off={off ? "" : undefined}>
      <header className="page__head">
        <div>
          <span className="label">Intelligence</span>
          <h1 className="page__title">Motion Lab</h1>
          <p className="lrc__meta">
            The motion patterns FlowCode's apps use, running live. Switch the motion level, the surface, reduced motion and animation off, use each pattern with mouse, touch and keyboard, then run the behaviour checks. It demonstrates the patterns; it isn't the builder, and its expressive examples aren't in generated apps yet.
          </p>
        </div>
      </header>

      <div className="ml-bar" role="region" aria-label="Motion Lab settings">
        <Seg label="Motion" value={level} onChange={setLevel} options={[{ id: "minimal", name: "Minimal" }, { id: "balanced", name: "Balanced" }, { id: "expressive", name: "Expressive" }]} />
        <Seg label="Surface" value={surface} onChange={setSurface} options={[{ id: "flat", name: "Flat" }, { id: "tactile", name: "Tactile" }]} />
        <label className="ml-toggle">
          <input type="checkbox" checked={rmToggle} onChange={(e) => setRmToggle(e.target.checked)} /> Reduced motion
        </label>
        <label className="ml-toggle">
          <input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} /> Animation off
        </label>
        {osReduced ? <span className="chip chip--warn">Your system asks for reduced motion: it wins at every level</span> : null}
      </div>

      <Pattern id="controls" eyebrow="Functional · all levels" title="Button and control feedback" why="The press shows the instant the pointer goes down. Toggles move with a short spring that can be interrupted: pressing quickly ends on the right state, never on a finished animation for the wrong one." stage={<Controls />} spec={[["Use for", "Every pressable thing: buttons, switches, checkboxes, chips, rows."], ["Avoid", "Bouncy scale on large surfaces, any delay before the pressed state, hover motion on touch."], ["Native", <><Native>CSS transitions</Native> on scale, translate and colour; <code>linear()</code> for the spring.</>], ["Library", "No real gain."], ["Reduced", "No scale or travel; colour change only."], ["Tests", "Rapid toggling ends on the pressed state; Space/Enter work; focus ring visible; no layout shift."]]} />
      <Pattern id="save" eyebrow="Functional · all levels" title="Save and selection state" why="Saving acknowledges the press at once; the spinner shows only if the save takes more than 150ms, so quick saves don't flash. Presses during a save are combined into one more save, never lost and never queued up. The result is announced." stage={<SaveAndSelect sent={sent} />} spec={[["Use for", "Save, add, favourite, select: anything whose result the person needs confirmed."], ["Avoid", "Disabling the whole form while a tick plays; a success animation longer than the save."], ["Native", <><Native>CSS</Native> + a small state machine (idle → saving → saved, combining presses).</>], ["Library", "No."], ["Reduced", "Same states and words, without the pop or spin."], ["Tests", "5 rapid presses → exactly 2 saves and ends Saved; status announced; arrow keys move the selection."]]} />
      <Pattern id="dialogs" eyebrow="Functional · all levels" title="Dialogs and drawers" why={<>Native <code>&lt;dialog&gt;</code>s: the browser keeps focus inside, closes on Escape and returns focus; CSS animates entry and exit. Every control works from the first frame, and closing never waits for the animation.</>} stage={<Dialogs />} spec={[["Use for", "Confirmations, short forms, side panels for filters or details."], ["Avoid", "Zooming from the pressed element every time; long exits; animating the page behind."], ["Native", <><Native>&lt;dialog&gt;</Native> + <code>@starting-style</code> + <code>allow-discrete</code> for the exit.</>], ["Library", "No."], ["Reduced", "Fade only."], ["Tests", "Open → Escape at once → closed, focus back on the opener; Tab stays inside; the drawer's field works at once."]]} />
      <Pattern id="expand" eyebrow="Functional · all levels" title="Expand and collapse" why={<>Height animates with grid rows (no measuring), and closed content is <code>inert</code>, so it can't be tabbed into while hidden.</>} stage={<><Disclosure id="ml-d1" title="Ingredients">Oats (92%), water, rapeseed oil, calcium carbonate, sea salt. <a href="#ml-expand" onClick={(e) => e.preventDefault()}>Allergy information</a></Disclosure><Disclosure id="ml-d2" title="Where it's sold">Northside Market · 0.4 mi · Corner Grocer · 1.2 mi · Harbor Foods · 2.8 mi</Disclosure></>} spec={[["Use for", "Accordions, show more, detail rows, settings groups."], ["Avoid", "Measuring height with script every frame; scrolling the page while it opens."], ["Native", <><Native>grid-template-rows 0fr → 1fr</Native>; later <code>interpolate-size</code> (Chromium only today).</>], ["Library", "No."], ["Reduced", "Opens at once, no travel."], ["Tests", "Closed links can't take focus; Enter/Space toggle; rapid toggling ends matching aria-expanded."]]} />
      <Pattern id="tabs" eyebrow="Functional · all levels" title="Tabs and navigation indicators" why="One indicator slides between tabs, showing where you came from and where you are. The panel appears at once with a short fade. Arrow keys follow the ARIA tabs pattern." stage={<Tabs />} spec={[["Use for", "Tabs, segmented controls, the active navigation item, step indicators."], ["Avoid", "Sliding whole panels sideways; holding the panel back until the bar arrives."], ["Native", <><Native>CSS transition</Native> on one indicator placed from the tab's box.</>], ["Library", "No."], ["Reduced", "The indicator jumps; the panel fades in quickly."], ["Tests", "Arrow/Home/End move selection and focus; the indicator matches the selected tab after rapid presses and resizes."]]} />
      <Pattern id="pages" eyebrow="Functional · Balanced and Expressive (Minimal: crossfade)" title="Page transitions" why="The page changes at once and the browser animates between snapshots, so nothing waits. Focus moves to the new page's heading. Back reverses the direction, and a second press mid-transition skips to the newest page." stage={<><MiniApp settings={settings} api={mini} /><p className="muted ml-note">{typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === "function" ? "This browser supports View Transitions." : "No View Transitions here: pages change instantly, with the same behaviour."}</p></>} spec={[["Use for", "Moving between an app's screens; list → detail; wizard steps."], ["Avoid", "Animating the whole document; transitions longer than ~350ms; blocking presses until finished."], ["Native", <><Native>startViewTransition</Native> (same-document); instant where unsupported.</>], ["Library", "No."], ["Reduced", "A short crossfade, no slide."], ["Tests", "Back renders the right page; focus on the new heading; 3 quick presses end on the last."]]} />
      <Pattern id="cards" eyebrow="Functional and expressive · amount by level" title="Card entrance and interaction" why="Cards already on screen never animate in. Cards below enter once as they scroll into view, with a capped stagger, and the featured card moves differently. Re-rendering replays nothing. Hover and press follow the surface style." stage={<><div className="ml-row"><button type="button" className="btn btn--sm" onClick={() => setRerenders((n) => n + 1)}>Re-render list</button><span className="muted">Nothing should replay.</span></div><Cards settings={settings} rerenders={rerenders} /></>} spec={[["Use for", "Content arriving for the first time: results, a dashboard's tiles, a homepage section."], ["Avoid", "Animating every card the same; replaying on re-render; hiding cards in view until script runs."], ["Native", <><Native>IntersectionObserver</Native> + CSS keyframes, stagger capped.</>], ["Library", "No."], ["Reduced", "Fade only; Minimal: fade only."], ["Tests", "Cards on screen visible in the first frame; re-render replays nothing; every card visible within 4s even if the observer never fires."]]} />
      <Pattern id="filter" eyebrow="Functional · all levels" title="Filtering and sorting continuity" why="Items keep their identity while they move. The new results paint at once (a screen reader or a test reads them straight away), then items glide from where they were; a quick change interrupts the move from wherever the items are." stage={<Filter settings={settings} />} spec={[["Use for", "Filter chips, sort, reorder, adding or removing from a list."], ["Avoid", "Fading the whole list out and in; moving hundreds of items."], ["Native", <><Native>FLIP with Web Animations</Native>: the new results paint first. (A view transition per press delayed the response on a slow phone: measured.)</>], ["Library", "Small: Motion's layout animations in React; native covers it."], ["Reduced", "Instant reorder with a short fade."], ["Tests", "3 choices within 100ms → the list matches the last; count announced; focus stays on the control."]]} />
      <Pattern id="hero" eyebrow="Expressive · opt-in per project, eligible pages only" title="Hero and section choreography" why="One short, orchestrated moment on a homepage or marketing page: the headline settles word by word in under 0.8s, the call to action works throughout, and the text is readable throughout. Needs the hero opt-in and an eligible page; Minimal has none." stage={<Hero settings={settings} api={hero} />} spec={[["Use for", "Business homepages, launches, portfolios: once per page, at the top."], ["Avoid", "App screens and dashboards; replaying on every visit; text unreadable until it ends."], ["Native", <><Native>CSS keyframes</Native> + scroll-driven animation where supported.</>], ["Library", <><Lib>GSAP</Lib> only for long timelines or pinned scroll scenes, and its licence needs Webflow's confirmation for FlowCode.</>], ["Reduced", "Everything shown at rest."], ["Tests", "The call to action works at once; text visible with animation off; total ≤ 0.8s; plays once."]]} />
      <Pattern id="demo" eyebrow="Expressive · opt-in per project, eligible pages only" title="Product demonstration" why="A short scripted walkthrough using the product's own interface: search, a result, save. It has Pause, stops when off-screen or in a background tab, and ends after 3 loops; with reduced motion or at Minimal it becomes three steps you press through." stage={<Demo settings={settings} api={demo} />} spec={[["Use for", "Homepages and launch pages explaining what the product does."], ["Avoid", "Autoplay without Pause; video for interface that can be drawn; running off-screen."], ["Native", <><Native>CSS transitions</Native> driven by a small step script.</>], ["Library", <><Lib>GSAP</Lib> timelines help for long, precisely timed demos; optional.</>], ["Reduced", "Static steps with captions and step buttons."], ["Tests", "Pause stops it; off-screen it doesn't run; captions announced; stops after 3 loops."]]} />
      <Pattern id="ambient" eyebrow="Expressive · opt-in per project, eligible pages only" title="Smooth scrolling and animated backgrounds" why="The most decorative effects, so they're off unless a project turns them on. Native smooth scrolling covers in-page jumps; the background is one animated gradient angle that pauses off-screen." stage={<Ambient settings={settings} />} spec={[["Use for", "Brand homepages and portfolios that asked for atmosphere."], ["Avoid", "Taking over wheel scrolling in apps; WebGL behind text or forms; anything on by default."], ["Native", <><Native>scrollIntoView smooth</Native>; an animated <code>@property</code> gradient.</>], ["Library", <><Lib>Lenis</Lib> adds inertial wheel smoothing (held for a specific need); <Lib>Vanta</Lib> adds WebGL scenes (not recommended).</>], ["Reduced", "Instant jumps; static background."], ["Tests", "Paused off-screen; keyboard scrolling and anchors unchanged."]]} />

      <section className="ml-pat ml-pat--checks" aria-labelledby="ml-checks-h">
        <header className="ml-pat__head">
          <span className="label">Behaviour</span>
          <h2 id="ml-checks-h" className="ml-pat__title">
            Behaviour checks
          </h2>
          <p className="ml-pat__why">These run against the patterns on this page, at the current settings. Run them at each level, with reduced motion and with animation off. They don't measure frame rate on real phones or visual taste.</p>
        </header>
        <div className="ml-stage">
          <div className="ml-row">
            <button type="button" className="btn btn--primary" disabled={running} onClick={() => void run()}>
              {running ? "Running…" : "Run checks"}
            </button>
            <span className="muted" role="status">
              {results.length && !running ? `${passed} of ${CHECKS.length} passed at ${level}${reduced ? ", reduced motion" : ""}${off ? ", animation off" : ""} · ${surface}` : ""}
            </span>
          </div>
          {results.length ? (
            <ul className="ml-checks">
              {results.map((r) => (
                <li key={r.name} className={r.ok ? "is-ok" : "is-bad"}>
                  <span aria-hidden="true">{r.ok ? "✓" : "✕"}</span>
                  <span>
                    {r.name}
                    {r.ok ? null : <span className="muted"> — failed: {r.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
