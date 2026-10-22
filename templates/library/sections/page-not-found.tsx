/** @flowcode-library page-not-found · 404 page (Alerts and states)
 * Catalog ID: b.page-state (block)
 * Function: The full-page state block (b.page-state) in four variants: not found, server error, planned maintenance and offline, each with its own behavior; this sheet shows the 404.
 * Use it as: import { PageState } from "./page-not-found"; <PageState variant="not-found"|"server-error"|"maintenance"|"offline" ...that variant's content: not-found: code title text searchLabel searchPlaceholder pages={[{label,href,text,keywords}]} popular={[label]}; server-error: code title text reference supportHref supportLabel homeHref succeedOnAttempt; maintenance: title text startedMinutesAgo backInMinutes services={[{name,detail,state:"up"|"maintenance"|"down"}]} stateLabels={{up,maintenance,down}} storageKey; offline: title text works={[string]} waits={[string]} queued={[{label,when}]} homeHref />
 * Variants: b.page-state.not-found - a missing page: a big 404, an honest message, a search across the app's pages and popular links; b.page-state.server-error - something broke on our side: server illustration, Try again with progress, a copyable reference code and a support link; b.page-state.maintenance - planned downtime: when it started and ends with a live countdown, a notify-me email form and a filterable service status list; b.page-state.offline - no connection: what still works and what waits, changes saved on the device, and a retry that checks the connection
 * Built from: c.button.primary, c.button.secondary, c.card.surface, c.empty-state.no-results, c.progress.bar, c.text-field.outlined
 * Look: A centered full-page state with a status badge or number, a title and message, and the actions that fit: search, retry, notify me or reconnect.
 * Tokens: --space-3 --space-4 --space-6 --color-accent --color-danger --color-success --color-border --color-surface-sunken --color-text-muted --radius-lg --text-lg
 * Use cases: 404 page; page not found; broken link; missing page; error page
 * Jobs to be done: find the page i was looking for; get back to the home page; search for what i need
 * Keywords: 404, not found, error page
 */
/**
 * Page state (b.page-state): one component for the four full-page states an app needs, picked with `variant`:
 * not-found, server-error, maintenance and offline. This file holds the implementation and the 404 sample; the other
 * three pieces (page-server-error, page-maintenance, page-offline) are thin wrappers that pass their own content.
 *
 * Page not found (404): a big number, a short honest message, a search across the app's main pages and links back to
 * them. Use it as the catch-all route. Make it the app's own: replace SAMPLE with the app's real pages and their
 * addresses; the search only looks through that list, so nothing is sent anywhere.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Progress } from "./progress-indicators";
import { TextField } from "./text-fields-states";

// ── b.page-state: a full-page state (404, 5xx, planned downtime, no connection). One block, four variants. ──

export type PageStateVariant = "not-found" | "server-error" | "maintenance" | "offline";

export type PageLink = { label: string; href: string; text: string; keywords: string };
export type ServiceStatus = { name: string; detail: string; state: string };
export type QueuedChange = { label: string; when: string };

export type NotFoundProps = {
  variant: "not-found";
  code: string;
  title: string;
  text: string;
  searchLabel: string;
  searchPlaceholder: string;
  /** Every page the search looks through. */
  pages: PageLink[];
  /** Labels (from `pages`) shown as the popular links. */
  popular: string[];
};
export type ServerErrorProps = {
  variant: "server-error";
  code: string;
  title: string;
  text: string;
  /** Error reference people can copy for support. */
  reference: string;
  supportHref: string;
  supportLabel: string;
  homeHref: string;
  /** The retry works from this attempt on (simulated, so every state can be seen). */
  succeedOnAttempt: number;
};
export type MaintenanceProps = {
  variant: "maintenance";
  title: string;
  text: string;
  startedMinutesAgo: number;
  backInMinutes: number;
  /** state is "up", "maintenance" or "down" (any key of stateLabels). */
  services: ServiceStatus[];
  stateLabels: Record<string, string>;
  /** localStorage key the "tell me when it's back" emails are kept under. */
  storageKey: string;
};
export type OfflineProps = {
  variant: "offline";
  title: string;
  text: string;
  /** What still works offline. */
  works: string[];
  /** What waits for a connection. */
  waits: string[];
  /** Changes saved on the device, sent when the connection returns. */
  queued: QueuedChange[];
  homeHref: string;
};
export type PageStateProps = NotFoundProps | ServerErrorProps | MaintenanceProps | OfflineProps;

/**
 * b.page-state: pick `variant` and pass that variant's content.
 * not-found: code title text searchLabel searchPlaceholder pages={[{label,href,text,keywords}]} popular={[label]}.
 * server-error: code title text reference supportHref supportLabel homeHref succeedOnAttempt.
 * maintenance: title text startedMinutesAgo backInMinutes services={[{name,detail,state}]} stateLabels storageKey.
 * offline: title text works={[string]} waits={[string]} queued={[{label,when}]} homeHref.
 */
export function PageState(props: PageStateProps) {
  switch (props.variant) {
    case "server-error":
      return <ServerError {...props} />;
    case "maintenance":
      return <Maintenance {...props} />;
    case "offline":
      return <Offline {...props} />;
    default:
      return <NotFound {...props} />;
  }
}

// ── Motion helpers (server-error, maintenance, offline) ──

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const ms = (el: Element, name: string, fallback: number) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith("ms") ? n : v.endsWith("s") ? n * 1000 : n) : fallback;
};

/** One quiet entrance when the page opens: "is-entering" for a moment after mount, never with reduced motion or
 * animation off, then gone for good (the timeout also covers a tab that isn't painting), so nothing stays hidden. */
function useEnterOnMount() {
  const [on, setOn] = useState(false);
  useLayoutEffect(() => {
    if (still()) return;
    setOn(true);
    const t = window.setTimeout(() => setOn(false), 1200);
    return () => window.clearTimeout(t);
  }, []);
  return on ? " is-entering" : "";
}

/** Rows that stay glide to their new place when a filter changes (FLIP); new rows fade in by CSS. */
function useGlide<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const box = ref.current;
    const next = new Map<string, number>();
    if (box) {
      const quiet = still();
      const dur = ms(box, "--duration-base", 200);
      for (const el of Array.from(box.children) as HTMLElement[]) {
        const key = el.dataset.key ?? "";
        const top = el.getBoundingClientRect().top;
        next.set(key, top);
        const before = tops.current.get(key);
        if (!quiet && before !== undefined && before !== top && el.animate)
          el.animate([{ translate: `0 ${before - top}px` }, { translate: "0 0" }], { duration: dur, easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    }
    tops.current = next;
  }, [dep]);
  return ref;
}

/** One indicator under a two-way toggle that slides to the pressed button (measured, so labels can differ in width). */
function useToggleIndicator<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const box = ref.current;
    const on = box?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!box || !on) return;
    box.style.setProperty("--ind-x", `${on.offsetLeft}px`);
    box.style.setProperty("--ind-w", `${on.offsetWidth}px`);
    setReady(true);
  }, [dep]);
  return [ref, ready] as const;
}

function NotFound(d: NotFoundProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<PageLink[] | null>(null);
  const [searched, setSearched] = useState("");

  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) {
      setError("Type a word to search for.");
      setResults(null);
      return;
    }
    setError("");
    setSearched(query.trim());
    setResults(d.pages.filter((p) => `${p.label} ${p.text} ${p.keywords}`.toLowerCase().includes(q)));
  };

  const popular = d.pages.filter((p) => d.popular.includes(p.label));

  return (
    <section className="fl-section" aria-labelledby={`${id}-title`} data-fl="b.page-state.not-found">
      <div className="fl-wrap fl-wrap--narrow fl-alr-404">
        <p className="fl-alr-404__code" aria-hidden="true">
          {d.code}
        </p>
        <div className="fl-head fl-head--center" style={{ marginBottom: 0 }}>
          <span className="fl-eyebrow">Error {d.code}</span>
          <h1 id={`${id}-title`} className="fl-title">
            {d.title}
          </h1>
          <p className="fl-lede">{d.text}</p>
        </div>

        <form role="search" className="fl-form" onSubmit={search} noValidate>
          <label htmlFor={`${id}-q`} className="fl-sr">
            {d.searchLabel}
          </label>
          <div className="fl-inline-form">
            <TextField
              id={`${id}-q`}
              type="search"
              placeholder={d.searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError("");
              }}
              invalid={!!error}
              aria-describedby={error ? `${id}-err` : undefined}
            />
            <Button type="submit">Search</Button>
          </div>
          {error && (
            <p id={`${id}-err`} className="fl-alr-404__error">
              {error}
            </p>
          )}
        </form>

        <div aria-live="polite" style={{ width: "100%", display: "grid", justifyItems: "center", gap: "var(--space-3)" }}>
          {results &&
            (results.length === 0 ? (
              <EmptyState variant="no-results" title={`Nothing matches “${searched}”`}>
                Try a shorter word, or pick a page below.
              </EmptyState>
            ) : (
              <>
                <p className="fl-meta" style={{ margin: 0 }}>
                  {results.length} {results.length === 1 ? "page matches" : "pages match"} “{searched}”
                </p>
                <ul className="fl-alr-404__results">
                  {results.map((p) => (
                    <li key={p.href}>
                      <a href={p.href}>
                        <span>
                          <strong>{p.label}</strong>
                          <span className="fl-meta" style={{ display: "block" }}>
                            {p.text}
                          </span>
                        </span>
                        <Icon name="arrow" />
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ))}
        </div>

        <nav aria-label="Main pages" style={{ width: "100%" }}>
          <h2 className="fl-meta" style={{ margin: "0 0 var(--space-3)", fontWeight: "var(--weight-semibold)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
            Popular pages
          </h2>
          <ul className="fl-alr-404__links">
            {popular.map((p) => (
              <li key={p.href}>
                <a href={p.href}>
                  <strong>{p.label}</strong>
                  <span>{p.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}

function ServerError(d: ServerErrorProps) {
  const id = useId();
  const [state, setState] = useState<"error" | "busy" | "failed" | "ok">("error");
  const [attempts, setAttempts] = useState(0);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const retry = () => {
    const attempt = attempts + 1;
    setAttempts(attempt);
    setState("busy");
    setProgress(10);
    let p = 10;
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      p += 30;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        window.clearInterval(timer.current);
        setState(attempt >= d.succeedOnAttempt ? "ok" : "failed");
      }
    }, 400);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.reference);
    } catch {
      /* clipboard blocked: the code is still on screen to copy by hand */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const busy = state === "busy";
  const enter = useEnterOnMount();

  return (
    <section className="fl-section" aria-labelledby={`${id}-title`} data-fl="b.page-state.server-error">
      <div className={`fl-wrap fl-wrap--narrow fl-err${enter}`}>
        <div className="fl-err-rack" aria-hidden="true">
          <span />
          <span />
          <span />
          <b className="fl-err-rack__code">{d.code}</b>
        </div>

        {state === "ok" ? (
          <div className="fl-head fl-head--center fl-err-arrive" style={{ marginBottom: 0 }} role="status">
            <span className="fl-err-badge fl-err-badge--info">Back up</span>
            <h1 id={`${id}-title`} className="fl-title">
              That worked
            </h1>
            <p className="fl-lede">The page loaded on the second try. Sorry for the bump.</p>
            <div className="fl-actions">
              <Button href={d.homeHref} icon="arrow" iconAt="end">
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="fl-head fl-head--center" style={{ marginBottom: 0 }}>
              <span className="fl-err-badge">
                <span className="fl-err-dot" aria-hidden="true" />
                Error {d.code} · server
              </span>
              <h1 id={`${id}-title`} className="fl-title">
                {d.title}
              </h1>
              <p className="fl-lede">{d.text}</p>
            </div>

            <div className="fl-actions" style={{ justifyContent: "center" }}>
              <Button icon="refresh" busy={busy} onClick={retry}>
                {busy ? "Trying again…" : "Try again"}
              </Button>
              <Button variant="secondary" href={d.supportHref} icon="mail">
                {d.supportLabel}
              </Button>
            </div>

            {busy && (
              <div style={{ width: "100%", maxWidth: "20rem" }}>
                <Progress variant="bar" thin value={progress} label="Trying again" />
              </div>
            )}

            <div aria-live="polite" style={{ width: "100%", maxWidth: "28rem" }}>
              {state === "failed" && (
                <p className="fl-err-status fl-err-status--bad">
                  Still not working (attempt {attempts}). Give it a moment and try once more, or send us the reference
                  below so we can look into it.
                </p>
              )}
            </div>

            <div className="fl-err-ref">
              <span>Reference</span>
              <code>{d.reference}</code>
              <button type="button" className="fl-err-copy" data-copied={copied || undefined} onClick={copy}>
                <span key={copied ? "y" : "n"} className="fl-err-copy__face">
                  {copied ? "Copied" : "Copy"}
                </span>
                <span className="fl-sr"> reference code</span>
              </button>
              <span className="fl-sr" aria-live="polite">
                {copied ? "Reference code copied." : ""}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const fmtTime = (date: Date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Maintenance(d: MaintenanceProps) {
  const id = useId();
  const [start] = useState(() => new Date(Date.now() - d.startedMinutesAgo * 60000));
  const [end] = useState(() => new Date(Date.now() + d.backInMinutes * 60000));
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<"all" | "affected">("all");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const left = Math.max(0, Math.round((end.getTime() - now) / 60000));
  const leftLabel = left === 0 ? "Any minute" : left >= 60 ? `${Math.floor(left / 60)} h ${left % 60} min` : `${left} min`;
  const shown = d.services.filter((s) => filter === "all" || s.state !== "up");
  const affected = d.services.filter((s) => s.state !== "up").length;
  const enter = useEnterOnMount();
  const list = useGlide<HTMLUListElement>(filter);
  const [toggle, slid] = useToggleIndicator<HTMLDivElement>(filter);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError("Enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("That doesn't look like an email address.");
    try {
      const list = JSON.parse(localStorage.getItem(d.storageKey) ?? "[]") as string[];
      localStorage.setItem(d.storageKey, JSON.stringify([...new Set([...list, value])]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setError("");
    setSaved(true);
  };

  return (
    <section className="fl-section fl-section--tint" aria-labelledby={`${id}-title`} data-fl="b.page-state.maintenance">
      <div className={`fl-wrap fl-err-layout${enter}`}>
        <div style={{ display: "grid", gap: "var(--space-6)" }}>
          <div className="fl-head">
            <span className="fl-err-badge fl-err-badge--info" style={{ justifySelf: "start" }}>
              <span className="fl-err-dot fl-err-dot--pulse" aria-hidden="true" />
              Planned maintenance
            </span>
            <h1 id={`${id}-title`} className="fl-title">
              {d.title}
            </h1>
            <p className="fl-lede">{d.text}</p>
          </div>

          <dl className="fl-err-when">
            <div>
              <dt>Started</dt>
              <dd>{fmtTime(start)}</dd>
            </div>
            <div>
              <dt>Back by</dt>
              <dd>{fmtTime(end)}</dd>
            </div>
            <div>
              <dt>Time left</dt>
              <dd aria-live="polite">
                <span key={leftLabel} className="fl-err-tick">
                  {leftLabel}
                </span>
              </dd>
            </div>
          </dl>

          <Card variant="surface" className="fl-err-subscribe">
            <h2 className="fl-title fl-title--md" style={{ fontSize: "var(--text-lg)" }}>
              Tell me when it's back
            </h2>
            <div aria-live="polite">
              {saved && (
                <p className="fl-done" style={{ margin: 0 }}>
                  Done. We'll email {email.trim()} once bookings reopen.
                </p>
              )}
            </div>
            {!saved && (
              <form className="fl-form" onSubmit={submit} noValidate>
                <div className="fl-field">
                  <label htmlFor={`${id}-email`}>Email</label>
                  <div className="fl-inline-form">
                    <TextField
                      id={`${id}-email`}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      invalid={!!error}
                      aria-describedby={error ? `${id}-err` : `${id}-hint`}
                    />
                    <Button type="submit" icon="mail">
                      Notify me
                    </Button>
                  </div>
                  {error ? (
                    <p id={`${id}-err`} className="fl-err-field-error">
                      {error}
                    </p>
                  ) : (
                    <p id={`${id}-hint`} className="fl-note" style={{ margin: 0 }}>
                      One email, then we forget your address.
                    </p>
                  )}
                </div>
              </form>
            )}
          </Card>
        </div>

        <Card variant="surface" style={{ gap: "var(--space-4)" }}>
          <div className="fl-err-row">
            <h2 className="fl-title fl-title--md" style={{ fontSize: "var(--text-lg)" }} id={`${id}-status`}>
              Service status
            </h2>
            <div ref={toggle} className={slid ? "fl-toggle fl-err-toggle is-sliding" : "fl-toggle fl-err-toggle"} role="group" aria-label="Show services">
              <span className="fl-err-toggle__ind" aria-hidden="true" />
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                All {d.services.length}
              </button>
              <button type="button" aria-pressed={filter === "affected"} onClick={() => setFilter("affected")}>
                Affected {affected}
              </button>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="fl-err-status fl-err-status--good">Everything is working.</p>
          ) : (
            <ul ref={list} className="fl-err-list" aria-labelledby={`${id}-status`}>
              {shown.map((s) => (
                <li key={s.name} data-key={s.name}>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.detail}</small>
                  </span>
                  <span className="fl-err-pill" data-state={s.state}>
                    <span className="fl-err-dot" aria-hidden="true" />
                    {d.stateLabels[s.state] ?? s.state}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="fl-meta fl-err-meta">
            <Icon name="clock" />
            Times are shown in your time zone.
          </p>
        </Card>
      </div>
    </section>
  );
}

function WifiOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.6M2 9.5a15 15 0 0 1 4.2-2.7M22 9.5A15 15 0 0 0 10.5 5.6M12 20h.01" />
    </svg>
  );
}

function Wifi() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9.5a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01" />
    </svg>
  );
}

function Pause() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 9v6M14 9v6" />
    </svg>
  );
}

function Offline(d: OfflineProps) {
  const id = useId();
  const [state, setState] = useState<"offline" | "checking" | "still" | "online">("offline");
  const [checks, setChecks] = useState(0);
  const [queue, setQueue] = useState(d.queued);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const back = () => setState((s) => (s === "online" ? s : "online"));
    const lost = () => setState("offline");
    window.addEventListener("online", back);
    window.addEventListener("offline", lost);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", lost);
    };
  }, []);

  useEffect(() => {
    if (state === "online") {
      const t = window.setTimeout(() => setQueue([]), 1200);
      return () => window.clearTimeout(t);
    }
  }, [state]);

  const retry = () => {
    setChecks((n) => n + 1);
    setState("checking");
    window.setTimeout(() => {
      setState(navigator.onLine ? "online" : "still");
      headingRef.current?.focus();
    }, 1200);
  };

  const online = state === "online";
  const checking = state === "checking";
  const enter = useEnterOnMount();

  return (
    <section className="fl-section" aria-labelledby={`${id}-title`} data-fl="b.page-state.offline">
      <div className={`fl-wrap fl-wrap--narrow fl-err${enter}`}>
        <span className="fl-err-cloud" data-online={online}>
          <span key={online ? "on" : "off"} className="fl-err-cloud__face">
            {online ? <Wifi /> : <WifiOff />}
          </span>
        </span>

        <div className="fl-head fl-head--center" style={{ marginBottom: 0 }}>
          <span className={`fl-err-badge ${online ? "fl-err-badge--info" : "fl-err-badge--muted"}`}>
            <span className={`fl-err-dot${checking ? " fl-err-dot--pulse" : ""}`} aria-hidden="true" />
            {online ? "Connected" : checking ? "Checking connection" : "No connection"}
          </span>
          <h1 id={`${id}-title`} className="fl-title" ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
            {online ? "You're back online" : d.title}
          </h1>
          <p className="fl-lede">{online ? "Everything works again. Anything you saved while offline is being sent now." : d.text}</p>
        </div>

        <div className="fl-actions" style={{ justifyContent: "center" }}>
          {online ? (
            <>
              <Button href={d.homeHref} icon="arrow" iconAt="end">
                Carry on
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setState("offline");
                  setQueue(d.queued);
                }}
              >
                Show the offline page again
              </Button>
            </>
          ) : (
            <Button busy={checking} onClick={retry}>
              {checking ? "Checking…" : "Try again"}
            </Button>
          )}
        </div>

        <div aria-live="polite" style={{ width: "100%", maxWidth: "28rem" }}>
          {state === "still" && (
            <p className="fl-err-status fl-err-status--bad">
              Still no connection{checks > 1 ? ` after ${checks} tries` : ""}. Try moving closer to your router or switching
              to mobile data. We'll also notice by ourselves when it's back.
            </p>
          )}
          {online && (
            <p className="fl-err-status fl-err-status--good">
              {queue.length > 0 ? `Sending ${queue.length} saved ${queue.length === 1 ? "change" : "changes"}…` : "All saved changes sent."}
            </p>
          )}
        </div>

        {!online && (
          <div className="fl-err-works">
            <Card variant="surface">
              <h2>Still works</h2>
              <ul className="fl-err-works__ok">
                {d.works.map((w) => (
                  <li key={w}>
                    <Icon name="check" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card variant="surface">
              <h2>Waits for a connection</h2>
              <ul className="fl-err-works__no">
                {d.waits.map((w) => (
                  <li key={w}>
                    <Pause />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        <Card variant="surface" className="fl-err-queue" style={{ maxWidth: "28rem" }}>
          <h2 className="fl-meta" style={{ margin: 0, fontWeight: "var(--weight-semibold)" }}>
            Saved on this device
          </h2>
          {queue.length === 0 ? (
            <p className="fl-text" style={{ fontSize: "var(--text-sm)" }}>
              Nothing waiting to send.
            </p>
          ) : (
            <ul style={{ display: "grid", gap: "var(--space-2)", margin: 0, padding: 0, listStyle: "none" }}>
              {queue.map((q) => (
                <li key={q.label} className="fl-err-queue__item">
                  <span>{q.label}</span>
                  <span className="fl-meta">{q.when}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  code: "404",
  title: "We couldn't find that page",
  text: "The link may be old, or the page has moved. Search for it, or start again from one of these.",
  searchLabel: "Search the site",
  searchPlaceholder: "Try “timetable” or “gift card”",
  pages: [
    { label: "Home", href: "#home", text: "What's on at the studio this week", keywords: "start welcome" },
    { label: "Class timetable", href: "#timetable", text: "Book pottery, drawing and print classes", keywords: "classes book schedule times" },
    { label: "Gift cards", href: "#gifts", text: "Give a class or a month of open studio", keywords: "present voucher" },
    { label: "Your bookings", href: "#bookings", text: "Change or cancel a class you booked", keywords: "account cancel reschedule" },
    { label: "Visit us", href: "#visit", text: "Opening hours, address and parking", keywords: "contact hours map directions" },
    { label: "Help", href: "#help", text: "Answers about payments, refunds and kit", keywords: "faq refund questions" },
  ],
  popular: ["Home", "Class timetable", "Your bookings", "Help"],
};

export default function PageNotFound() {
  return <PageState variant="not-found" {...SAMPLE} />;
}
