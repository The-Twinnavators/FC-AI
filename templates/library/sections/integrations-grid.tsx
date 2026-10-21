/** @flowcode-library integrations-grid · Integrations grid (Features)
 * Catalog ID: b.integrations (block)
 * Function: The integrations block (b.integrations): the apps a product connects to as logo cards, narrowed by search and a category row with a sliding marker, each opening a dialog with what the connection does and a Connect action.
 * Use it as: import { IntegrationsGrid } from "./integrations-grid"; <IntegrationsGrid label="Integrations" categories={[{ id, label }]} apps={[{ id, name, category, text, more?, does?: string[], status?: "live"|"beta"|"soon", popular?, logo?: { src?, initials? }, href? }]} request?={{ label, href }} labels?={{ search, all, results, empty, clear, connect, close, popular, beta, soon }} onOpen?={(id) => ...} />  // use only integrations the PRD names
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.text-field.outlined
 * Look: A search field and a row of quiet category words, the chosen one on an accent pill that slides between them; under it a grid of rounded surface cards, each with a square tinted logo tile, a bold name, a small status pill and a muted line. Details open in a centered rounded dialog with a bigger logo, a ticked list and a primary Connect button.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --color-warning --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-xs --text-sm --text-md --font-display --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: integrations page; app marketplace; connections; partner directory; plugins; saas homepage; works with section
 * Jobs to be done: check it works with the tools I already use; find an integration; see what a connection does; ask for a missing integration
 * Keywords: integrations, apps, connect, marketplace, plugins, partners, works with, filter, search, categories
 */
/**
 * Integrations grid: shows a buyer that the product fits the tools they already use. Search matches the name, the
 * line and the category; the category row works as a group of toggle buttons, with an accent pill that slides to the
 * chosen one. The count of matches is said after each change, and an empty search offers to clear the filters and a
 * link to request one. A card is a button that opens a native modal dialog (focus stays inside, Escape closes it,
 * focus comes back to the card). Cards rise in once as the block comes into view; with reduced motion or animation
 * off they are simply there. Make it the app's own: replace SAMPLE with the real integrations, their logos (logo.src)
 * and where Connect leads.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { Icon, Tick } from "./icons";

export type IntegrationApp = {
  id: string;
  name: string;
  /** A category id. */
  category: string;
  /** One line, always shown. */
  text: string;
  /** A short paragraph in the dialog. */
  more?: string;
  /** What the connection does, as a ticked list in the dialog. */
  does?: string[];
  status?: "live" | "beta" | "soon";
  popular?: boolean;
  /** A logo picture; without one, initials on a tinted tile. */
  logo?: { src?: string; initials?: string };
  /** Where Connect leads. */
  href?: string;
};

export type IntegrationsGridProps = {
  /** Names the block's controls and grid for screen readers. */
  label: string;
  categories: Array<{ id: string; label: string }>;
  apps: IntegrationApp[];
  /** A link for a missing integration, shown under the grid and in the empty state. */
  request?: { label: string; href: string };
  labels?: {
    search?: string;
    all?: string;
    results?: (n: number) => string;
    empty?: string;
    clear?: string;
    connect?: string;
    close?: string;
    popular?: string;
    beta?: string;
    soon?: string;
  };
  onOpen?: (id: string) => void;
};

const TINTS = ["a", "b", "c", "d", "e"] as const;
const TINT: Record<(typeof TINTS)[number], string> = { a: "fl-itg-logo--a", b: "fl-itg-logo--b", c: "fl-itg-logo--c", d: "fl-itg-logo--d", e: "fl-itg-logo--e" };
const tintOf = (id: string) => TINT[TINTS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TINTS.length]!];
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    // Already on screen: play the entrance now, without waiting on an observer.
    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    };
    if (inView()) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.1 });
    // A scroll check backs the observer up, so the block is never left hidden.
    const onScroll = () => inView() && show();
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return [ref, state] as const;
}

function Logo({ app, big }: { app: IntegrationApp; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={["fl-itg-logo", tintOf(app.id), big ? "fl-itg-logo--big" : ""].filter(Boolean).join(" ")} aria-hidden="true">
      {app.logo?.src && !broken ? <img src={app.logo.src} alt="" onError={() => setBroken(true)} /> : (app.logo?.initials ?? initialsOf(app.name))}
    </span>
  );
}

export function IntegrationsGrid({ label, categories, apps, request, labels = {}, onOpen }: IntegrationsGridProps) {
  const uid = useId();
  const L = {
    search: labels.search ?? "Search integrations",
    all: labels.all ?? "All",
    results: labels.results ?? ((n: number) => (n === 1 ? "1 integration" : `${n} integrations`)),
    empty: labels.empty ?? "No integrations match",
    clear: labels.clear ?? "Clear filters",
    connect: labels.connect ?? "Connect",
    close: labels.close ?? "Close",
    popular: labels.popular ?? "Popular",
    beta: labels.beta ?? "Beta",
    soon: labels.soon ?? "Planned",
  };
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const cats = useMemo(() => [{ id: "all", label: L.all }, ...categories], [categories, L.all]);
  const catBtns = useRef<Array<HTMLButtonElement | null>>([]);
  const rail = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<{ x: number; w: number } | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const [grid, enter] = useEnterOnce<HTMLDivElement>();

  const needle = q.trim().toLowerCase();
  const catLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const shown = apps.filter(
    (a) =>
      (cat === "all" || a.category === cat) &&
      (!needle || `${a.name} ${a.text} ${catLabel(a.category)}`.toLowerCase().includes(needle)),
  );
  const countIn = (id: string) => apps.filter((a) => id === "all" || a.category === id).length;
  const app = apps.find((a) => a.id === openId) ?? null;

  // The sliding marker follows the chosen category button.
  useLayoutEffect(() => {
    const place = () => {
      const i = cats.findIndex((c) => c.id === cat);
      const b = catBtns.current[i];
      if (b) setMark({ x: b.offsetLeft, w: b.offsetWidth });
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    if (rail.current) ro?.observe(rail.current);
    return () => ro?.disconnect();
  }, [cat, cats]);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (app && !d.open) d.showModal?.();
    if (!app && d.open) d.close();
  }, [app]);

  const pick = (id: string) => {
    setCat(id);
    setRound((r) => r + 1);
    catBtns.current[cats.findIndex((c) => c.id === id)]?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: still() ? "auto" : "smooth" });
  };

  const onCatKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let n: number | null = null;
    if (e.key === "ArrowRight") n = (i + 1) % cats.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + cats.length) % cats.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = cats.length - 1;
    if (n === null) return;
    e.preventDefault();
    catBtns.current[n]?.focus();
  };

  const open = (a: IntegrationApp, from: HTMLElement) => {
    opener.current = from;
    setOpenId(a.id);
    onOpen?.(a.id);
  };
  const close = () => {
    setOpenId(null);
    const back = opener.current;
    requestAnimationFrame(() => back?.focus());
  };
  const clear = () => {
    setQ("");
    setCat("all");
    setRound((r) => r + 1);
    search.current?.focus();
  };

  const statusBadge = (a: IntegrationApp) =>
    a.status === "beta" ? (
      <Badge tone="info">{L.beta}</Badge>
    ) : a.status === "soon" ? (
      <Badge tone="neutral">{L.soon}</Badge>
    ) : a.popular ? (
      <Badge tone="success">{L.popular}</Badge>
    ) : null;

  return (
    <div className="fl-itg" data-fl="b.integrations">
      <div className="fl-itg-tools" role="search" aria-label={label}>
        <label className="fl-itg-search">
          <span className="fl-sr">{L.search}</span>
          <Icon name="search" />
          <input
            ref={search}
            className="fl-input fl-itg-input"
            type="search"
            value={q}
            placeholder={L.search}
            onChange={(e) => {
              setQ(e.target.value);
              setRound((r) => r + 1);
            }}
          />
        </label>
        <div className="fl-itg-cats" ref={rail} role="group" aria-label={`${label}: categories`}>
          {mark ? <span className="fl-itg-mark" aria-hidden="true" style={{ translate: `${mark.x}px 0`, width: mark.w }} /> : null}
          {cats.map((c, i) => (
            <button
              key={c.id}
              ref={(el) => {
                catBtns.current[i] = el;
              }}
              type="button"
              className={c.id === cat ? "fl-itg-cat is-on" : "fl-itg-cat"}
              aria-pressed={c.id === cat}
              tabIndex={c.id === cat ? 0 : -1}
              onClick={() => pick(c.id)}
              onKeyDown={(e) => onCatKey(e, i)}
            >
              {c.label}
              <span className="fl-itg-count">{countIn(c.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="fl-itg-found" role="status" aria-live="polite">
        {L.results(shown.length)}
      </p>

      <div ref={grid} className={["fl-itg-gridwrap", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ")}>
        {shown.length ? (
          <ul className="fl-itg-grid" aria-label={label} key={round}>
            {shown.map((a, i) => (
              <li key={a.id} className="fl-itg-item" style={{ ["--i" as string]: i }}>
                <button type="button" className="fl-itg-card" aria-haspopup="dialog" onClick={(e) => open(a, e.currentTarget)}>
                  <span className="fl-itg-top">
                    <Logo app={a} />
                    {statusBadge(a)}
                  </span>
                  <span className="fl-itg-name">{a.name}</span>
                  <span className="fl-itg-cat-name">{catLabel(a.category)}</span>
                  <span className="fl-itg-text">{a.text}</span>
                  <span className="fl-itg-go" aria-hidden="true">
                    <Icon name="chevron-right" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="fl-itg-empty">
            <span className="fl-itg-empty-icon" aria-hidden="true">
              <Icon name="search" />
            </span>
            <p className="fl-itg-empty-title">{L.empty}</p>
            <div className="fl-itg-empty-actions">
              <Button variant="secondary" size={40} onClick={clear}>
                {L.clear}
              </Button>
              {request ? (
                <Button variant="tertiary" size={40} href={request.href}>
                  {request.label}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {request && shown.length ? (
        <p className="fl-itg-request">
          <a className="fl-link" href={request.href}>
            {request.label}
          </a>
        </p>
      ) : null}

      <dialog
        ref={dlg}
        className="fl-itg-dialog"
        aria-labelledby={`${uid}-dt`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        {app ? (
          <div className="fl-itg-panel">
            <div className="fl-itg-dhead">
              <Logo app={app} big />
              <div className="fl-itg-dwho">
                <h3 id={`${uid}-dt`} className="fl-itg-dtitle">
                  {app.name}
                </h3>
                <p className="fl-itg-dcat">
                  {catLabel(app.category)} {statusBadge(app)}
                </p>
              </div>
              <Button variant="tertiary" size={40} icon="close" iconOnly onClick={close}>
                {L.close}
              </Button>
            </div>
            <p className="fl-itg-dtext">{app.more ?? app.text}</p>
            {app.does?.length ? (
              <ul className="fl-itg-does">
                {app.does.map((d) => (
                  <li key={d}>
                    <Tick />
                    {d}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="fl-itg-dactions">
              {app.status === "soon" ? (
                <Button variant="secondary" size={44} onClick={close}>
                  {L.close}
                </Button>
              ) : (
                <Button size={44} href={app.href ?? "#"} icon="link">
                  {`${L.connect} ${app.name}`}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Integrations",
  title: "Works with the tools you already use",
  lede: "Connect your calendar, payments and chat in a few clicks. No code needed.",
  categories: [
    { id: "calendar", label: "Calendar" },
    { id: "payments", label: "Payments" },
    { id: "chat", label: "Chat" },
    { id: "crm", label: "CRM" },
    { id: "files", label: "Files" },
  ],
  apps: [
    { id: "gcal", name: "Google Calendar", category: "calendar", text: "Two-way sync for every booking.", more: "New bookings land on your calendar within seconds, and busy times on your calendar block those slots.", does: ["Two-way sync", "Busy times block slots", "One calendar per team member"], popular: true, href: "#connect-gcal" },
    { id: "outlook", name: "Outlook Calendar", category: "calendar", text: "Keep Microsoft calendars in step.", does: ["Two-way sync", "Shared calendars"], href: "#connect-outlook" },
    { id: "ical", name: "Apple Calendar", category: "calendar", text: "Subscribe from any Mac or iPhone.", status: "beta" as const, href: "#connect-ical" },
    { id: "stripe", name: "Stripe", category: "payments", text: "Take deposits when people book.", more: "Ask for a deposit or full payment at booking time. Refunds follow your cancellation policy.", does: ["Deposits and full payments", "Automatic refunds", "Payouts every two days"], popular: true, href: "#connect-stripe" },
    { id: "square", name: "Square", category: "payments", text: "Charge in person and online.", href: "#connect-square" },
    { id: "paypal", name: "PayPal", category: "payments", text: "Let people pay with their PayPal balance.", status: "soon" as const },
    { id: "slack", name: "Slack", category: "chat", text: "Post new bookings to a channel.", does: ["A message per booking", "Daily summary at 8 am"], popular: true, href: "#connect-slack" },
    { id: "teams", name: "Microsoft Teams", category: "chat", text: "Alerts for your front desk.", href: "#connect-teams" },
    { id: "hubspot", name: "HubSpot", category: "crm", text: "Create a contact for every new client.", href: "#connect-hubspot" },
    { id: "salesforce", name: "Salesforce", category: "crm", text: "Log visits on the client record.", status: "beta" as const, href: "#connect-salesforce" },
    { id: "drive", name: "Google Drive", category: "files", text: "Save intake forms as PDFs.", href: "#connect-drive" },
    { id: "dropbox", name: "Dropbox", category: "files", text: "Keep signed forms in one folder.", href: "#connect-dropbox" },
  ],
  request: { label: "Request an integration", href: "#request" },
};

export default function IntegrationsGridPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="integrations-grid-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="integrations-grid-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <IntegrationsGrid label={d.eyebrow} categories={d.categories} apps={d.apps} request={d.request} />
      </div>
    </section>
  );
}
