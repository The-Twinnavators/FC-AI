import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { diffLines } from "diff";
import { statusLabel, friendlyError } from "@flowcode/contracts";
import { Illustration } from "./Illustration";

/** FlowCode mark: the gradient bolt from the brand reference. */
export function Logo({ size = 26, withWordmark = false }: { size?: number; withWordmark?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#c4b5fd" />
            <stop offset="0.45" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <path d="M9.5 2.5h17.2c.9 0 1.4 1 .9 1.7l-3.6 5.1c-.4.5-1 .8-1.6.8h-7.2l-1.9 4.6h8.2c.9 0 1.4 1 .8 1.7L9.6 29.3c-.8.9-2.2.1-1.8-1l2.9-8.4H6.3c-.7 0-1.2-.7-1-1.3L7.6 4c.3-.9 1-1.5 1.9-1.5Z" fill={`url(#g${id})`} />
      </svg>
      {withWordmark ? (
        <span className="logo__wordmark" style={{ display: "grid", lineHeight: 1.1 }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>
            FlowCode <em className="brand-ai">AI</em>
          </span>
          <span style={{ color: "var(--text-2)", fontSize: 12.5 }}>Personal Intelligence</span>
        </span>
      ) : null}
    </span>
  );
}

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  download: "M12 3v12M7 10l5 5 5-5M4 20h16",
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z",
  workspace: "M3 4h18v16H3zM9 4v16M3 9h6",
  knowledge: "M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM18 20h2V6",
  library: "M5 3h4v18H5zM10 3h4v18h-4zM15.5 4.2l3.8-1 4 17.4-3.8 1z",
  quality: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM8.5 12l2.5 2.5 4.5-5",
  reports: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  models: "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  diagnostics: "M3 12h4l3-8 4 16 3-8h4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  folder: "M3 6h6l2 2h10v11H3z",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  play: "M7 4v16l13-8z",
  pause: "M9 5v14M15 5v14",
  stop: "M6 6h12v12H6z",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  check: "M5 12.5 10 17l9-10",
  x: "M6 6l12 12M18 6 6 18",
  chevron: "M9 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  pin: "M9 4h6l-1 6 3 3v2H7v-2l3-3zM12 15v6",
  server: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  network: "M12 5a2 2 0 1 0 0 .01M5 18a2 2 0 1 0 0 .01M19 18a2 2 0 1 0 0 .01M12 7v4M12 11l-6 5M12 11l6 5M7 18h10",
  clip: "M21 11.5 12.5 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  ask: "M4 5h16v11H9l-5 4z",
  a11y: "M12 4a1.5 1.5 0 1 0 0 .01M5 8l7 1.5L19 8M12 9.5V14M12 14l-3 6M12 14l3 6",
  rocket: "M12 3c3 2 5 5.5 5 9.5L15 16H9l-2-3.5C7 8.5 9 5 12 3zM12 9a1.5 1.5 0 1 0 0 .01M9 16l-2 4 3-1.5M15 16l2 4-3-1.5",
  support: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4zM17 14h3v5h-3zM20 19a3 3 0 0 1-3 2h-3",
  checklist: "M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M4 18h3",
  // A robot head (antenna, head, eyes, ears), like the agents' robot heads elsewhere.
  agents: "M12 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM12 3.5V7M7 7h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM9 11.5v2M15 11.5v2M2 11.5v3M22 11.5v3",
};

export function Icon({ name, size = 16, label }: { name: keyof typeof ICONS | string; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={ICONS[name] ?? ICONS.file} />
    </svg>
  );
}

/** A small copy button for a message: copies its text and shows a tick for a moment. */
export function CopyText({ text, label = "Copy message" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDone(false), 1500);
    } catch {
      setDone(false);
    }
  };
  return (
    <button type="button" className={`copy-text${done ? " copy-text--done" : ""}`} onClick={copy} aria-label={done ? "Copied" : label} title={done ? "Copied" : label}>
      <Icon name={done ? "check" : "copy"} size={13} />
    </button>
  );
}

export type Signal = "ok" | "warn" | "bad" | "run" | "off";

export function statusSignal(status?: string): Signal {
  switch (status) {
    case "passed":
    case "verified":
    case "done":
    case "succeeded":
    case "approved":
    case "completed":
      return "ok";
    case "passed_with_warnings":
    case "done_with_warnings":
    case "done_unverified":
    case "awaiting_approval":
    case "attempted":
    case "pending_approval":
    case "recovering":
    case "skipped":
      return "warn";
    case "failed":
    case "blocked":
    case "invalidated":
    case "timed_out":
    case "denied":
    case "cancelled":
      return "bad";
    case "running":
    case "verifying":
    case "queued":
      return "run";
    default:
      return "off";
  }
}

/**
 * The one status colour scheme, shared by dots, chips and status text:
 * ok = teal (passed), notes = yellow (passed with notes), help = purple (paused, waiting, needs your OK),
 * stopped = magenta (cancelled), bad = red (needs fixing), run = blue (building, checking), warn = attention, off = grey (not yet).
 */
export type StatusTone = "ok" | "notes" | "help" | "stopped" | "bad" | "run" | "warn" | "off";
export function statusTone(status?: string): StatusTone {
  if (status === "blocked" || status === "awaiting_approval" || status === "pending_approval") return "help";
  if (status === "cancelled") return "stopped";
  if (status === "done_with_warnings" || status === "passed_with_warnings" || status === "done_unverified") return "notes";
  return statusSignal(status);
}

export function Led({ status, label }: { status?: string; label?: string }) {
  const t = statusTone(status);
  const cls = t === "help" ? "led--help" : t === "stopped" ? "led--stopped" : t === "notes" ? "led--notes" : t !== "off" ? `led--${t}` : "";
  return <span className={`led ${cls}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

/** Status words in their status colour (the same scheme as the dots and chips). */
export function StatusText({ status, children, className }: { status?: string; children: React.ReactNode; className?: string }) {
  return <span className={`status-text status-text--${statusTone(status)}${className ? ` ${className}` : ""}`}>{children}</span>;
}

export function StatusChip({ status, dot, label }: { status?: string; dot?: boolean; label?: string }) {
  const t = statusTone(status);
  // Waiting on you (an OK or your help) is FlowCode purple, not a warning or an error.
  // Cancelled is magenta: stopped on purpose, so it shouldn't look like a failure.
  const cls = t === "help" ? "chip--approval" : t === "stopped" ? "chip--stopped" : t === "notes" ? "chip--notes" : t !== "off" ? `chip--${t}` : "";
  // Everyday words for the status; the technical name stays in the tooltip.
  return (
    <span className={`chip ${cls}${dot ? " chip--dot" : ""}`} title={status ? status.replace(/_/g, " ") : undefined}>
      {dot ? <Led status={status} /> : null}
      {label ?? (status ? statusLabel(status) : "—")}
    </span>
  );
}

/**
 * Accessible tabs with roving focus (arrow keys, Home/End). When the bar is too narrow, tabs that don't fit move
 * into a "More" menu; the selected tab always stays visible.
 */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<{ id: T; label: string; count?: number }>; value: T; onChange: (t: T) => void; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  /** Ids shown in the bar; null = all fit. */
  const [shown, setShown] = useState<string[] | null>(null);
  const [menu, setMenu] = useState(false);
  const sig = tabs.map((t) => `${t.id}:${t.label}:${t.count ?? ""}`).join("|");

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      el.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((b) => b.dataset.tab && widths.current.set(b.dataset.tab, b.offsetWidth + 2));
      const avail = el.clientWidth - 12;
      const w = (id: string) => widths.current.get(id) ?? 96;
      if (tabs.reduce((s, t) => s + w(t.id), 0) <= avail) return setShown(null);
      // Reserve the More button and the selected tab first, then fill with the others in order.
      let used = 84 + w(value);
      const keep = new Set<string>([value]);
      for (const t of tabs) {
        if (t.id === value) continue;
        if (used + w(t.id) > avail) break;
        used += w(t.id);
        keep.add(t.id);
      }
      setShown(tabs.filter((t) => keep.has(t.id)).map((t) => t.id));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, value]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setMenu(false);
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, [menu]);

  const visible = shown ? tabs.filter((t) => shown.includes(t.id) || t.id === value) : tabs;
  const hidden = tabs.filter((t) => !visible.includes(t));
  const hiddenCount = hidden.reduce((n, t) => n + (t.count ?? 0), 0);

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % visible.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + visible.length) % visible.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = visible.length - 1;
    else return;
    e.preventDefault();
    onChange(visible[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className={`tabs${hidden.length ? " tabs--overflow" : ""}`} ref={wrap}>
      <div className="tabs__list" role="tablist" aria-label={label}>
        {visible.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-tab={t.id}
            className="tab"
            role="tab"
            id={`tab-${label}-${t.id}`}
            aria-selected={value === t.id}
            aria-controls={`panel-${label}-${t.id}`}
            tabIndex={value === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
            {t.count ? <span className="tab__count">{t.count}</span> : null}
          </button>
        ))}
      </div>
      {hidden.length ? (
        <div className="tabs__more">
          <button
            className="tab tabs__more-btn"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`More ${label} tabs: ${hidden.map((t) => t.label).join(", ")}`}
            onClick={() => setMenu((m) => !m)}
            onKeyDown={(e) => e.key === "Escape" && setMenu(false)}
          >
            More
            {hiddenCount ? <span className="tab__count">{hiddenCount}</span> : null}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {menu ? (
            <div className="tabs__menu" role="menu" aria-label={`More ${label} tabs`}>
              {hidden.map((t) => (
                <button
                  key={t.id}
                  role="menuitemradio"
                  aria-checked={value === t.id}
                  className="tabs__menuitem"
                  onClick={() => (onChange(t.id), setMenu(false))}
                  onKeyDown={(e) => e.key === "Escape" && setMenu(false)}
                >
                  {t.label}
                  {t.count ? <span className="tab__count">{t.count}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TabPanel({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${label}-${id}`} aria-labelledby={`tab-${label}-${id}`} className="ws__scroll" tabIndex={0}>
      {children}
    </div>
  );
}

/** Empty state: what belongs here and how to start. An unDraw illustration (by slug) for major moments only. */
export function Empty({ title, children, action, illustration }: { title: string; children?: ReactNode; action?: ReactNode; illustration?: string }) {
  return (
    <div className={`empty${illustration ? " empty--illustrated" : ""}`}>
      {illustration ? (
        <div className="empty__art" aria-hidden="true">
          <Illustration slug={illustration} label="" maxWidth={200} />
        </div>
      ) : null}
      <h3>{title}</h3>
      {children ? <div>{children}</div> : null}
      {action}
    </div>
  );
}

export function DiffView({ before, after }: { before: string; after: string }) {
  const parts = diffLines(before, after);
  return (
    <div className="diff" role="region" aria-label="Diff">
      {parts.flatMap((p, i) =>
        p.value
          .replace(/\n$/, "")
          .split("\n")
          .map((line, j) => (
            <div key={`${i}-${j}`} className={`diff__line ${p.added ? "diff__line--add" : p.removed ? "diff__line--del" : ""}`}>
              <span aria-hidden="true">{p.added ? "+ " : p.removed ? "- " : "  "}</span>
              <span className="sr-only">{p.added ? "added: " : p.removed ? "removed: " : ""}</span>
              {line}
            </div>
          )),
      )}
    </div>
  );
}

export function UnifiedDiff({ text }: { text: string }) {
  return (
    <div className="diff">
      {text.split("\n").map((l, i) => (
        <div key={i} className={`diff__line ${l.startsWith("+") && !l.startsWith("+++") ? "diff__line--add" : l.startsWith("-") && !l.startsWith("---") ? "diff__line--del" : ""}`}>
          {l}
        </div>
      ))}
    </div>
  );
}

export function time(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function ago(iso?: string): string {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * A plain-language error: what happened, why it matters, what to do next, an optional retry, and the original text
 * folded away under "Technical details".
 */
export function ErrorNotice({ error, doing, onRetry, retryLabel = "Try again" }: { error: string | undefined; doing?: string; onRetry?: () => void; retryLabel?: string }) {
  if (!error) return null;
  const e = friendlyError(error, doing);
  return (
    <div className="err-notice" role="alert">
      <strong className="err-notice__title">{e.title}</strong>
      <p className="err-notice__text">{e.explain}</p>
      <p className="err-notice__next">{e.next}</p>
      {onRetry ? (
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
      {e.technical ? (
        <details className="err-notice__tech">
          <summary>Technical details</summary>
          <pre>{e.technical}</pre>
        </details>
      ) : null}
    </div>
  );
}
