/**
 * The Copilot showing how it's done, in the app itself: its own cursor glides to each control, clicks to open things,
 * types into fields and walks a journey step by step. It never presses a final button (send, start, approve, delete,
 * apply, save): it points at it and stops, and you click it. "Show me" waits for Next at each step; "Do it for me"
 * runs on. Esc, Stop, or moving your own mouse a fair way takes over at once.
 *
 * Journeys are fixed lists of real steps on real controls (data-cp / data-tab / data-guide), so the Copilot can't
 * point at something that doesn't exist. Start one with startJourney().
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { navigate } from "../router";

/** `auto`: a travel step (going to a page, opening a tab) that moves on by itself even in Show me. */
export type Step = { auto?: boolean; /** Said when the control isn't there (e.g. nothing waiting). */ missing?: string; /** Your turn on this page: waits for Next even in Do it for me. */ pause?: boolean } & (
  | { do: "go"; path: string; say: string }
  | { do: "tab"; tab: string; say: string }
  | { do: "event"; name: string; detail?: unknown; say: string }
  /** Your turn: the Copilot waits (up to a few minutes) until `until` appears, then carries on. */
  | { do: "wait"; target: string; until: string; say: string }
  | { do: "point"; target: string; say: string }
  | { do: "click"; target: string; say: string }
  | { do: "type"; target: string; text: string; say: string }
  /** The final button: pointed at, never clicked. */
  | { do: "confirm"; target: string; say: string });

export interface Journey {
  /** The catalog id, when it came from the catalog (so the follow-up suggestions know what was just done). */
  id?: string;
  title: string;
  steps: Step[];
}
export type DriveMode = "show" | "do";

const EVENT = "fc:copilot-drive";
/** Each step as it happens, for the Copilot chat to narrate: { title, i, n, say, final?, note?, ended? }. */
export const NARRATE = "fc:copilot-narrate";
const narrate = (d: { id?: string; title: string; i: number; n: number; say: string; final?: boolean; note?: string; ended?: "done" | "stopped" }) => window.dispatchEvent(new CustomEvent(NARRATE, { detail: d }));
export function startJourney(journey: Journey, mode: DriveMode) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { journey, mode } }));
}

/** Controls whose click is a decision: the driver refuses to click these even if a journey asks. */
const FINAL = /\b(send|submit|start|build|approve|allow|deny|delete|remove|apply|capture|save|confirm|retry|pay|buy|publish|restart|stop|clear)\b/i;

function find(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cp="${target}"]`) ?? document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
}
async function waitFor(get: () => HTMLElement | null, ms = 6000): Promise<HTMLElement | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const el = get();
    if (el && el.getClientRects().length) return el;
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** How fast the Copilot moves: about the pace of a person, so you can follow each move. */
const PACE = { glide: 1100, rest: 500, afterClick: 1100, key: 55, betweenSteps: 1200 };

/** Sets a React-controlled field's value as if typed. */
function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function CopilotDriver() {
  const [run, setRun] = useState<{ journey: Journey; mode: DriveMode; i: number } | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const [cursor, setCursor] = useState<{ x: number; y: number; click: number } | null>(null);
  const [note, setNoteState] = useState<string>();
  const noteRef = useRef<string | undefined>(undefined);
  const setNote = (n: string | undefined) => {
    noteRef.current = n;
    setNoteState(n);
  };
  const [waiting, setWaiting] = useState(false);
  /** What the cursor is doing right now while it travels ("Clicking My Projects in the sidebar…"). */
  const [doing, setDoing] = useState<string>();
  /** Your turn in the middle of a journey (e.g. describing the app): your mouse and keyboard don't stop the Copilot. */
  const [yourTurn, setYourTurn] = useState(false);
  const stopped = useRef(false);
  const next = useRef<() => void>(() => {});
  const lastCursor = useRef({ x: window.innerWidth - 120, y: 80 });

  const stop = useCallback(() => {
    setYourTurn(false);
    setDoing(undefined);
    if (!stopped.current && runRef.current) narrate({ id: runRef.current.journey.id, title: runRef.current.journey.title, i: runRef.current.i, n: runRef.current.journey.steps.length, say: "", ended: "stopped" });
    stopped.current = true;
    setRun(null);
    setCursor(null);
    setNote(undefined);
    setWaiting(false);
  }, []);

  useEffect(() => {
    const onStart = (e: Event) => {
      const d = (e as CustomEvent<{ journey: Journey; mode: DriveMode }>).detail;
      stopped.current = false;
      setNote(undefined);
      const from = (document.activeElement as HTMLElement | null)?.getBoundingClientRect();
      if (from && from.width) lastCursor.current = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
      setCursor({ ...lastCursor.current, click: 0 });
      setRun({ ...d, i: 0 });
    };
    window.addEventListener(EVENT, onStart);
    return () => window.removeEventListener(EVENT, onStart);
  }, []);

  // Esc, Stop, or clicking somewhere yourself hands control back. Moving your mouse to watch doesn't.
  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stop();
    const onDown = (e: PointerEvent) => {
      if (!e.isTrusted || yourTurn) return;
      const t = e.target as HTMLElement | null;
      // Clicks on the Copilot's own controls (Next, Stop, the chat) aren't a take-over.
      if (t?.closest(".cpd-say, .cpd-bar, #copilot-panel")) return;
      stop();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [run, yourTurn, stop]);

  const moveTo = async (el: HTMLElement) => {
    const before = el.getBoundingClientRect();
    if (before.top < 60 || before.bottom > window.innerHeight - 100) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      await sleep(600);
    }
    const r = el.getBoundingClientRect();
    const to = { x: r.left + Math.min(r.width / 2, 60), y: r.top + r.height / 2 };
    lastCursor.current = to;
    setCursor((c) => ({ ...to, click: c?.click ?? 0 }));
    await sleep(PACE.glide);
    await sleep(PACE.rest);
  };

  /** Clicks a control with the cursor, as a person would. False when it isn't there. */
  const press = async (get: () => HTMLElement | null, ms = 5000): Promise<boolean> => {
    const el = await waitFor(get, ms);
    if (!el || stopped.current) return false;
    // Say what's being clicked: the control's visible name.
    const name = (el.getAttribute("aria-label") || el.querySelector("strong, .rail__label")?.textContent || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48);
    const where = el.closest(".rail") ? " in the sidebar" : el.getAttribute("role") === "tab" ? " tab" : "";
    setDoing(name ? `Clicking ${name}${where}…` : "Going there…");
    await moveTo(el);
    setCursor((c) => (c ? { ...c, click: c.click + 1 } : c));
    await sleep(220);
    el.click();
    // Let the page change and settle, so you can see where the click went.
    await sleep(PACE.afterClick);
    setDoing(undefined);
    return true;
  };
  const here = () => location.hash.replace(/^#/, "") || "/";
  /**
   * Goes to a page the way you would: the sidebar item, then the project's card, then the tab. Only if one of those
   * isn't on screen does it jump straight there.
   */
  const travel = async (path: string) => {
    const [p, qs] = path.split("?");
    const parts = (p ?? "/").split("/").filter(Boolean);
    const section = parts[0] ?? "";
    const query = new URLSearchParams(qs ?? "");
    const navKey = section === "" ? "projects" : section === "projects" ? "quality" : section;
    const onSection = (s: string) => (here().split("?")[0]!.split("/").filter(Boolean)[0] ?? "") === s;
    const viaSidebar = section === "projects" ? !onSection("quality") : !onSection(section);
    if (viaSidebar) await press(() => document.querySelector<HTMLElement>(`[data-guide="nav.${navKey}"]`));
    if (stopped.current) return;
    if (section === "quality" && parts[1]) {
      if (!here().startsWith(`/quality/${parts[1]}`)) await press(() => document.querySelector<HTMLElement>(`.lrc-card[data-ctx-project="${parts[1]}"]`));
      if (parts[2]) await press(() => document.querySelector<HTMLElement>(`[data-tab="${parts[2]}"]`));
    } else if (section === "projects" && parts[1]) {
      await press(() => document.querySelector(`.lrc-card[data-ctx-project="${parts[1]}"]`)?.closest(".qa-card-wrap")?.querySelector<HTMLElement>(".card-view") ?? null);
    } else if (section === "settings" && parts[1]) {
      await press(() => document.getElementById(`settings-tab-${parts[1]}`));
    } else if (section === "system" && parts[1]) {
      await press(() => document.querySelector<HTMLElement>(`[data-tab="${parts[1]}"]`));
    } else if (section === "library" && query.get("tab")) {
      await press(() => document.querySelector<HTMLElement>(`[data-tab="${query.get("tab")}"]`));
    } else if (section === "discover" && parts[1] === "new") {
      await press(() => find("prd-new"));
    } else if (section === "knowledge" && query.get("projectId")) {
      const sel = (await waitFor(() => find("knowledge-project"))) as HTMLSelectElement | null;
      if (sel && sel.value !== query.get("projectId")) {
        await moveTo(sel);
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(sel, query.get("projectId"));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(500);
      }
    }
    if (stopped.current) return;
    // Didn't get there by clicking (a control was missing): go straight there.
    const target = p ?? "/";
    const now = here().split("?")[0]!;
    const arrived = target === "/" ? now === "/" : now === target || now.startsWith(`${target}/`) || (section === "projects" && now.startsWith(`/projects/${parts[1]}`)) || ((section === "library" || section === "knowledge") && now.startsWith(`/${section}`));
    if (!arrived) {
      navigate(path);
      await sleep(500);
    }
  };

  // Runs one step; then waits for Next (Show me) or goes on (Do it for me).
  useEffect(() => {
    if (!run) return;
    const step = run.journey.steps[run.i];
    if (!step) return;
    let alive = true;
    void (async () => {
      setNote(undefined);
      setCursor((c) => c ?? { ...lastCursor.current, click: 0 });
      if (step.do === "go") {
        await travel(step.path);
      } else if (step.do === "wait") {
        const here = await waitFor(() => find(step.target));
        if (here) await moveTo(here);
        setWaiting(false);
        setYourTurn(true);
        const next = await waitFor(() => (stopped.current ? document.body : find(step.until)), 5 * 60_000);
        setYourTurn(false);
        if (!alive || stopped.current) return;
        if (!next) setNote("I waited a few minutes; carry on yourself, or ask me again.");
        else {
          narrate({ id: run.journey.id, title: run.journey.title, i: run.i, n: run.journey.steps.length, say: step.say });
          setRun((r) => (r ? { ...r, i: r.i + 1 } : r));
          return;
        }
      } else if (step.do === "event") {
        window.dispatchEvent(new CustomEvent(step.name, { detail: step.detail }));
        await sleep(600);
      } else if (step.do === "tab") {
        // The same visible click as everywhere else (caption, glide, rest, ripple), even if the tab is already open.
        const ok = await press(() => document.querySelector<HTMLElement>(`[data-tab="${step.tab}"]`));
        if (!ok) setNote("That tab isn't on this screen.");
      } else {
        const el = await waitFor(() => find(step.target));
        if (!alive || stopped.current) return;
        if (!el) setNote(step.missing ?? "That part isn't on this screen right now, so I've stopped here.");
        else {
          await moveTo(el);
          if (step.do === "click") {
            const label = `${el.textContent ?? ""} ${el.getAttribute("aria-label") ?? ""}`;
            if (!el.hasAttribute("data-cp-safe") && FINAL.test(label)) setNote("That button makes a decision, so it's yours to click.");
            else if (el.getAttribute("aria-expanded") === "true") {
              /* already open */
            } else {
              setCursor((c) => (c ? { ...c, click: c.click + 1 } : c));
              el.click();
              await sleep(PACE.afterClick);
            }
          } else if (step.do === "type") {
            const field = (el.matches("input, textarea") ? el : el.querySelector("input, textarea")) as HTMLInputElement | HTMLTextAreaElement | null;
            if (field) {
              field.focus();
              for (let k = 1; k <= step.text.length && alive && !stopped.current; k++) {
                setValue(field, step.text.slice(0, k));
                await sleep(step.text.length > 80 ? 18 : PACE.key);
              }
            }
          }
        }
      }
      if (!alive || stopped.current) return;
      const last = run.i >= run.journey.steps.length - 1;
      narrate({ id: run.journey.id, title: run.journey.title, i: run.i, n: run.journey.steps.length, say: step.say, final: step.do === "confirm", ...(noteRef.current ? { note: noteRef.current } : {}) });
      if (step.do === "confirm" || last) stopped.current = true; // finished: closing it isn't "stopped"
      if (step.do === "confirm" || last) {
        setWaiting(true);
        next.current = stop;
        return;
      }
      if ((run.mode === "show" && !step.auto) || step.pause) {
        setWaiting(true);
        next.current = () => {
          setWaiting(false);
          setRun((r) => (r ? { ...r, i: r.i + 1 } : r));
        };
      } else {
        await sleep(PACE.betweenSteps);
        if (alive && !stopped.current) setRun((r) => (r ? { ...r, i: r.i + 1 } : r));
      }
    })();
    return () => {
      alive = false;
    };
  }, [run?.i, run?.journey]); // eslint-disable-line react-hooks/exhaustive-deps

  // While a guided session runs, the Copilot panel stays above any modal's scrim so its narration stays readable.
  useEffect(() => {
    document.body.classList.toggle("cp-driving", !!run);
    return () => document.body.classList.remove("cp-driving");
  }, [run]);

  if (!run) return null;
  const step = run.journey.steps[run.i]!;
  const final = step.do === "confirm";
  // On the page body, not inside .app: the app is its own stacking layer (z-index 1), so anything inside it sits under
  // modals (New build's scrim is on the body at z-index 70) and the cursor would vanish behind them.
  return createPortal(
    <>
      <div className="cpd-bar" role="status">
        <span className="cpd-bar__dot" aria-hidden="true" />
        <span className="cpd-bar__title">
          Copilot is showing you how to {run.journey.title.charAt(0).toLowerCase() + run.journey.title.slice(1)}
        </span>
        <span className="cpd-bar__step">
          Step {run.i + 1} of {run.journey.steps.length}
        </span>
        <button type="button" className="btn btn--sm btn--ghost cpd-bar__stop" onClick={stop}>
          Stop (Esc)
        </button>
      </div>
      {cursor ? (
        <div className="cpd-cursor" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }} aria-hidden="true">
          <svg width="26" height="30" viewBox="0 0 26 30">
            <defs>
              <linearGradient id="cpd-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c4b5fd" />
                <stop offset="1" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
            <path d="M2 2 L2 24 L8 18.5 L12 27 L16 25.2 L12 17 L20 17 Z" fill="url(#cpd-g)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span className="cpd-cursor__tag">Copilot</span>
          {cursor.click ? <span key={cursor.click} className="cpd-cursor__ripple" /> : null}
        </div>
      ) : null}
      <div className={`cpd-say${final ? " cpd-say--final" : ""}`} style={cursor ? { left: Math.max(12, Math.min(cursor.x + 28, window.innerWidth - 340)), top: Math.min(cursor.y + 50, window.innerHeight - 160) } : undefined}>
        {doing ? <p className="cpd-say__doing">{doing}</p> : null}
        <p>{step.say}</p>
        {note ? <p className="cpd-say__note">{note}</p> : null}
        {yourTurn ? <p className="cpd-say__turn">Your turn. I&apos;ll carry on when you&apos;re done.</p> : null}
        {final && !note ? <p className="cpd-say__final">Check it, then click the button yourself. I don&apos;t press final buttons.</p> : null}
        {waiting ? (
          <div className="cpd-say__actions">
            {final || run.i >= run.journey.steps.length - 1 ? (
              <button type="button" className="btn btn--sm btn--primary" onClick={stop}>
                Got it
              </button>
            ) : (
              <button type="button" className="btn btn--sm btn--primary" onClick={() => next.current()} autoFocus>
                Next
              </button>
            )}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}
