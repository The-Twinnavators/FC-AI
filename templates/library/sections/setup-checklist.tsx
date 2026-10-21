/** @flowcode-library setup-checklist · Setup checklist (Cards)
 * Catalog ID: p.setup-checklist (pattern)
 * Function: The setup checklist (p.setup-checklist): a getting-started card with a progress bar and a list of first tasks; one task is open at a time with its why and the button that does it; finishing a task ticks it and opens the next, optional ones can be skipped, the card folds down to a slim bar, and a done state closes it out.
 * Use it as: import { SetupChecklist } from "./setup-checklist"; <SetupChecklist title lede? tasks={[{ id, title, text, action: { label, href? }, done?, optional? }]} labels?={{ progress, hide, show, skip, skipped, optional, working, failed, doneTitle, doneText, dismiss, markDone, markTodo }} onTask?={(id) => Promise<void> | void} onChange?={(state) => ...} onDismiss?={() => ...} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary
 * Look: A card with a title, a line of help, "2 of 5 done" over a thin accent bar and a Hide button; below, a list of tasks with round check marks. The open task shows a sentence and a primary button (and Skip when optional); done tasks are ticked in the accent color and muted. Hidden, the card is a single bar with the progress; finished, it shows a check and You're all set.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing
 * Use cases: onboarding checklist; getting started; setup guide; first-run experience; account setup; new workspace; activation tasks; product tour; welcome card
 * Jobs to be done: know what to set up first; see how far along I am; do the next setup step; skip a step I don't need; put the guide away for now; know when setup is finished
 * Keywords: onboarding, checklist, getting started, setup, progress, tasks, first run, welcome, activation
 */
/**
 * Setup checklist: the getting-started card for a new account. The bar and "2 of 5 done" show progress; the tasks are
 * an accordion where one is open at a time (the next unfinished one to begin with). The open task says why it matters
 * and has the button that does it: its action runs (onTask may return a promise; the button shows it's working, and a
 * failure says so), then the task is ticked and the next unfinished one opens. Optional tasks can be skipped. Each check
 * mark is a toggle too, for marking a task done by hand or undoing it. Hide folds the card to one bar; when everything
 * is done or skipped it says so and offers to dismiss the guide. Arrow keys move between the task headers. Make it the
 * app's own: replace SAMPLE with the product's first tasks (three to six), point each action at the real screen, and
 * keep the state in the account through onChange.
 * Built from c.button.primary, c.button.secondary and c.button.tertiary.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its progress steps and accordion.
 */
/**
 * How to try it
 * - Press Add your logo: it works for a moment, ticks, and Invite your team opens.
 * - Press a task's title to open it; use the up and down arrows to move between titles.
 * - Press Skip on an optional task, or the round check to tick or untick a task by hand.
 * - Press Hide: the card folds to a bar; press it to open the card again.
 * - Finish every task: the card says You're all set and offers Dismiss guide.
 *
 * Dependencies: React (useEffect, useId, useRef, useState, type KeyboardEvent), the library's Button ("./buttons-variants") and inline icon
 * set ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the library's own
 * fl- classes in templates/library/css/setupchecklist.css.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── p.setup-checklist: getting-started tasks with progress, one open at a time. ──

export type SetupTask = {
  id: string;
  title: string;
  /** Why it matters, in a sentence. */
  text: string;
  /** The button that does it: { label: "Add your logo" }, with href to go to another screen instead. */
  action: { label: string; href?: string };
  done?: boolean;
  /** Can be skipped; skipped counts toward finishing. */
  optional?: boolean;
};
export type SetupState = Record<string, "done" | "skipped" | "todo">;

export type SetupChecklistProps = {
  title: string;
  lede?: string;
  tasks: SetupTask[];
  labels?: { progress?: string; hide?: string; show?: string; skip?: string; skipped?: string; optional?: string; working?: string; failed?: string; doneTitle?: string; doneText?: string; dismiss?: string; markDone?: string; markTodo?: string };
  /** Runs when a task's button is pressed; resolve when it's done, reject to show it failed. Without it the task is simply ticked. */
  onTask?: (id: string) => Promise<void> | void;
  /** Every change of a task's state, to save it with the account. */
  onChange?: (state: SetupState) => void;
  /** The guide was dismissed after finishing. */
  onDismiss?: () => void;
};

export function SetupChecklist({ title, lede, tasks, labels = {}, onTask, onChange, onDismiss }: SetupChecklistProps) {
  const l = {
    progress: "done",
    hide: "Hide",
    show: "Show setup guide",
    skip: "Skip",
    skipped: "Skipped",
    optional: "Optional",
    working: "Working...",
    failed: "That didn't work. Try again.",
    doneTitle: "You're all set",
    doneText: "Everything's ready. You can find these settings any time under Settings.",
    dismiss: "Dismiss guide",
    markDone: "Mark as done",
    markTodo: "Mark as not done",
    ...labels,
  };
  const id = useId();
  const [state, setState] = useState<SetupState>(() => Object.fromEntries(tasks.map((t) => [t.id, t.done ? "done" : "todo"])));
  const firstTodo = (s: SetupState, after = -1) => {
    const order = [...tasks.slice(after + 1), ...tasks.slice(0, after + 1)];
    return order.find((t) => s[t.id] === "todo")?.id ?? null;
  };
  const [open, setOpen] = useState<string | null>(() => tasks.find((t) => !t.done)?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [gone, setGone] = useState(false);
  const [status, setStatus] = useState("");
  const focusAfter = useRef<string | null>(null);
  // After the render that folds the pressed button away, focus lands on the next task's header.
  useEffect(() => {
    if (!focusAfter.current) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const finished = tasks.filter((t) => state[t.id] !== "todo").length;
  const all = finished === tasks.length;
  const pct = tasks.length ? Math.round((finished / tasks.length) * 100) : 0;

  const update = (taskId: string, value: SetupState[string], openNext: boolean, moveFocus = openNext) => {
    const next = { ...state, [taskId]: value };
    setState(next);
    onChange?.(next);
    if (openNext) {
      const to = firstTodo(next, tasks.findIndex((t) => t.id === taskId));
      setOpen(to);
      // The pressed button is folding away: focus moves to the header of the task that opens (or the progress).
      const at = tasks.findIndex((t) => t.id === to);
      if (moveFocus) focusAfter.current = at >= 0 ? `${id}-h-${at}` : `${id}-title`;
    }
    const t = tasks.find((x) => x.id === taskId)!;
    const count = tasks.filter((x) => next[x.id] !== "todo").length;
    setStatus(`${t.title}: ${value === "done" ? "done" : value === "skipped" ? l.skipped.toLowerCase() : "not done"}. ${count} of ${tasks.length} ${l.progress}.`);
  };

  const run = async (t: SetupTask) => {
    setFailed(null);
    if (!onTask) return update(t.id, "done", true);
    try {
      setBusy(t.id);
      await onTask(t.id);
      update(t.id, "done", true);
    } catch {
      setFailed(t.id);
    } finally {
      setBusy(null);
    }
  };

  // Up and down move between the task headers; Home and End go to the ends.
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const heads = [...e.currentTarget.querySelectorAll<HTMLElement>(".fl-sc-toggle")];
    const at = heads.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const to = e.key === "Home" ? 0 : e.key === "End" ? heads.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + heads.length) % heads.length;
    heads[to]?.focus();
  };

  if (gone) return null;

  const meter = (
    <span className="fl-sc-meter" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={finished} aria-valuetext={`${finished} of ${tasks.length} ${l.progress}`}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );

  return (
    <section className={`fl-sc${hidden ? " is-hidden" : ""}${all ? " is-finished" : ""}`} aria-labelledby={`${id}-title`} data-fl="p.setup-checklist">
      {/* Folded: one bar that opens the card again. */}
      <div className="fl-sc-fold fl-sc-fold--bar" inert={!hidden || undefined}>
        <div>
          <button
            type="button"
            id={`${id}-bar`}
            className="fl-sc-bar"
            aria-expanded={!hidden}
            aria-controls={`${id}-card`}
            onClick={() => {
              setHidden(false);
              focusAfter.current = `${id}-title`;
            }}
          >
            <Icon name="sparkle" />
            <span>{l.show}</span>
            <span className="fl-sc-bar-count">
              {finished}/{tasks.length}
            </span>
            {meter}
          </button>
        </div>
      </div>

      <div className="fl-sc-fold" inert={hidden || undefined}>
        <div id={`${id}-card`} className="fl-sc-card">
          <div className="fl-sc-head">
            <div className="fl-sc-heading">
              <h2 id={`${id}-title`} tabIndex={-1}>{all ? l.doneTitle : title}</h2>
              <p>{all ? l.doneText : lede}</p>
            </div>
            {all ? null : (
              <Button variant="tertiary" size={32} onClick={() => {
                  setHidden(true);
                  focusAfter.current = `${id}-bar`;
                }}
                aria-expanded={!hidden} aria-controls={`${id}-card`}>
                {l.hide}
              </Button>
            )}
          </div>
          <div className="fl-sc-progress">
            <span className="fl-sc-count">
              <strong>{finished}</strong> of {tasks.length} {l.progress}
            </span>
            {meter}
          </div>

          {all ? (
            <div className="fl-sc-done">
              <span className="fl-sc-done-mark" aria-hidden="true">
                <Icon name="check" />
              </span>
              <Button
                variant="secondary"
                size={40}
                onClick={() => {
                  setGone(true);
                  onDismiss?.();
                }}
              >
                {l.dismiss}
              </Button>
            </div>
          ) : null}

          <ol className="fl-sc-list" onKeyDown={onKey}>
            {tasks.map((t, i) => {
              const s = state[t.id];
              const isOpen = open === t.id;
              return (
                <li key={t.id} className={`fl-sc-task is-${s}${isOpen ? " is-open" : ""}`}>
                  <div className="fl-sc-row">
                    <button
                      type="button"
                      className="fl-sc-check"
                      aria-pressed={s !== "todo"}
                      aria-label={`${t.title}: ${s === "todo" ? l.markDone : l.markTodo}`}
                      title={s === "todo" ? l.markDone : l.markTodo}
                      onClick={() => update(t.id, s === "todo" ? "done" : "todo", s === "todo" && isOpen, false)}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                        <circle cx="10" cy="10" r="9" />
                        <path d="M6 10.4l2.6 2.6L14.2 7.4" />
                      </svg>
                    </button>
                    <button type="button" className="fl-sc-toggle" id={`${id}-h-${i}`} aria-expanded={isOpen} aria-controls={`${id}-p-${i}`} onClick={() => setOpen(isOpen ? null : t.id)}>
                      <span className="fl-sc-name">{t.title}</span>
                      {s === "skipped" ? <span className="fl-sc-tag">{l.skipped}</span> : t.optional && s === "todo" ? <span className="fl-sc-tag">{l.optional}</span> : null}
                      <Icon name="chevron-down" />
                    </button>
                  </div>
                  <div className="fl-sc-panel" id={`${id}-p-${i}`} role="region" aria-labelledby={`${id}-h-${i}`} inert={!isOpen || undefined}>
                    <div>
                      <div className="fl-sc-body">
                        <p>{t.text}</p>
                        {failed === t.id ? (
                          <p className="fl-sc-error" role="alert">
                            <Icon name="alert" />
                            {l.failed}
                          </p>
                        ) : null}
                        <div className="fl-sc-actions">
                          {t.action.href ? (
                            <Button size={40} href={t.action.href} onClick={() => update(t.id, "done", false)}>
                              {t.action.label}
                            </Button>
                          ) : (
                            <Button size={40} busy={busy === t.id} onClick={() => run(t)}>
                              {busy === t.id ? l.working : s === "done" ? `${t.action.label} again` : t.action.label}
                            </Button>
                          )}
                          {t.optional && s === "todo" ? (
                            <Button variant="tertiary" size={40} onClick={() => update(t.id, "skipped", true)}>
                              {l.skip}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Get your studio ready",
  lede: "Five quick steps and clients can start booking you.",
  tasks: [
    { id: "account", title: "Create your account", text: "Your studio name and email are saved.", action: { label: "Edit details" }, done: true },
    { id: "logo", title: "Add your logo", text: "It shows on your booking page, invoices and emails, so clients know it's you.", action: { label: "Add your logo" } },
    { id: "team", title: "Invite your team", text: "Give assistants their own sign-in so they can manage shoots and messages.", action: { label: "Invite people" }, optional: true },
    { id: "calendar", title: "Connect your calendar", text: "Bookings land in your calendar, and busy times are blocked automatically.", action: { label: "Connect calendar" } },
    { id: "payments", title: "Turn on payments", text: "Take deposits when clients book, so fewer sessions get canceled.", action: { label: "Set up payments" } },
  ] as SetupTask[],
};

export default function SetupChecklistSheet() {
  const [shown, setShown] = useState(true);
  // The sample's actions take a moment, as saving would; connecting the calendar fails the first time, to show the error.
  const [tries, setTries] = useState(0);
  const onTask = (taskId: string) =>
    new Promise<void>((resolve, reject) => {
      const n = taskId === "calendar" ? tries + 1 : 0;
      if (taskId === "calendar") setTries(n);
      window.setTimeout(() => (n === 1 ? reject(new Error("timeout")) : resolve()), 700);
    });
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        {shown ? (
          <SetupChecklist {...SAMPLE} onTask={onTask} onDismiss={() => setShown(false)} />
        ) : (
          <Button variant="secondary" onClick={() => setShown(true)}>
            Bring the guide back
          </Button>
        )}
      </div>
    </section>
  );
}
