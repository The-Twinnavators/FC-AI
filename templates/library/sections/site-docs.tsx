/**
 * Page template: documentation site for a developer product, here a small scheduling API. A sticky top bar with the
 * product name, a version picker and a search box that filters the page list as you type; a left nav of collapsible
 * sections with the current page marked (it becomes a slide-in drawer on phones); an article with a callout, an
 * install snippet with npm/pnpm/yarn tabs, code blocks with copy buttons and a parameters table; an "On this page"
 * list that follows your scroll; previous/next links and a "Was this page helpful?" prompt. Suits API docs, SDK
 * guides, help centres and handbooks. Nothing is sent anywhere.
 * Make it the app's own: replace SAMPLE with the product's real page tree, versions and article content, and point
 * each page at its own route.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Cadence",
  productTag: "API docs",
  versions: ["v3.2", "v3.1", "v2.8"],
  topLinks: [
    { label: "Changelog", href: "#changelog" },
    { label: "Status", href: "#status" },
    { label: "Dashboard", href: "#dashboard" },
  ],
  groups: [
    {
      id: "start",
      title: "Getting started",
      pages: [
        { id: "intro", title: "Introduction", summary: "Cadence is a scheduling API: calendars, availability and bookings behind one key. This page explains the main objects and how they fit together." },
        { id: "install", title: "Installation", summary: "Add the official client to a Node, Deno or Bun project, or call the REST endpoints directly from any language." },
        { id: "auth", title: "Authentication", summary: "Every request carries a secret key in the Authorization header. Keys are scoped to one workspace and can be rotated without downtime." },
        { id: "quickstart", title: "Quickstart", summary: "Create a calendar, open some availability and take your first booking in about ten minutes." },
      ],
    },
    {
      id: "concepts",
      title: "Core concepts",
      pages: [
        { id: "calendars", title: "Calendars", summary: "A calendar belongs to one person, room or resource. It holds working hours, buffers and the bookings made against it." },
        { id: "availability", title: "Availability", summary: "Availability is worked out from working hours, existing bookings and buffers. Query it before you show slots to anyone." },
        { id: "timezones", title: "Time zones", summary: "Cadence stores every time in UTC and converts for each attendee. Here is how daylight-saving changes are handled." },
      ],
    },
    {
      id: "reference",
      title: "API reference",
      pages: [
        { id: "create-booking", title: "Create a booking", method: "POST", summary: "" },
        { id: "list-bookings", title: "List bookings", method: "GET", summary: "Page through bookings on a calendar, newest first, with filters for status and date range." },
        { id: "reschedule", title: "Reschedule a booking", method: "PATCH", summary: "Move a booking to a new start time. Cadence checks the new slot and tells every attendee." },
        { id: "cancel", title: "Cancel a booking", method: "DEL", summary: "Cancel a booking and free the slot. You can pass a reason that attendees will see." },
        { id: "errors", title: "Errors", summary: "Every error has an HTTP status, a stable code and a human sentence. This page lists them all." },
      ],
    },
    {
      id: "webhooks",
      title: "Webhooks",
      pages: [
        { id: "events", title: "Event types", summary: "Subscribe to booking.created, booking.rescheduled and booking.cancelled to keep your own records up to date." },
        { id: "signatures", title: "Verify signatures", summary: "Each webhook is signed with your endpoint secret. Check the signature before trusting the body." },
        { id: "retries", title: "Retries", summary: "Failed deliveries are retried with backoff for up to three days. Here is the exact schedule." },
      ],
    },
  ],
  fullPage: "create-booking",
  article: {
    group: "API reference",
    title: "Create a booking",
    lede: "Reserve a slot on a calendar for one or more attendees. Cadence checks the slot is free, holds it and sends the confirmations, all in one call.",
    method: "POST",
    path: "/v3/bookings",
    updated: "Updated 2 October 2026",
    sections: [
      { id: "dd-install", title: "Install the client" },
      { id: "dd-request", title: "Make the request" },
      { id: "dd-params", title: "Parameters" },
      { id: "dd-response", title: "Response" },
      { id: "dd-errors", title: "Errors to handle" },
    ],
    installIntro: "The examples use the official JavaScript client. It wraps the REST endpoint, retries safely and types every response.",
    install: [
      { tab: "npm", cmd: "npm install @cadence/client" },
      { tab: "pnpm", cmd: "pnpm add @cadence/client" },
      { tab: "yarn", cmd: "yarn add @cadence/client" },
    ],
    requestIntro: "Pass the calendar, a start time and how long the booking lasts. Add the people who should get a confirmation.",
    requestFile: "book.ts",
    request: [
      'import { Cadence } from "@cadence/client";',
      "",
      "const cadence = new Cadence({ apiKey: process.env.CADENCE_KEY });",
      "",
      "// Hold 30 minutes on Rowan's calendar",
      "const booking = await cadence.bookings.create({",
      '  calendarId: "cal_8f2k1",',
      '  start: "2026-11-03T14:00:00Z",',
      "  durationMinutes: 30,",
      '  attendees: [{ name: "Ines Moreau", email: "ines@example.com" }],',
      "  notify: true,",
      "});",
    ],
    note: {
      title: "Times are always UTC",
      text: "Send start as ISO 8601 with a Z at the end. Cadence shows each attendee the slot in their own time zone, so never convert it yourself.",
    },
    params: [
      { name: "calendarId", type: "string", required: true, text: "The calendar to book. Starts with cal_." },
      { name: "start", type: "string", required: true, text: "Start time in UTC, ISO 8601. Must fall inside the calendar's working hours." },
      { name: "durationMinutes", type: "integer", required: true, text: "Between 15 and 480, in steps of 5." },
      { name: "attendees", type: "object[]", required: true, text: "1 to 20 people, each with a name and an email." },
      { name: "notify", type: "boolean", required: false, text: "Send confirmation emails. Defaults to true." },
      { name: "metadata", type: "object", required: false, text: "Up to 20 keys of your own, returned on every read." },
    ],
    warn: {
      title: "Retry with the same key",
      text: "Network blips happen. Pass an Idempotency-Key header and a retried request returns the first booking instead of making a second one.",
    },
    responseIntro: "A successful call returns 201 with the booking. Store the id: you need it to reschedule or cancel.",
    response: [
      "{",
      '  "id": "bkg_41c9e7",',
      '  "status": "confirmed",',
      '  "start": "2026-11-03T14:00:00Z",',
      '  "end": "2026-11-03T14:30:00Z",',
      '  "calendarId": "cal_8f2k1",',
      '  "attendees": 1',
      "}",
    ],
    errors: [
      { status: "409", code: "slot_taken", text: "Someone booked the slot first. Fetch availability again and offer the next free time." },
      { status: "422", code: "outside_hours", text: "The start time is outside the calendar's working hours or inside a buffer." },
      { status: "429", code: "rate_limited", text: "More than 100 requests a minute. Wait for the number of seconds in Retry-After." },
    ],
  },
  stubNote: "This sample fills in one page in full. Open “Create a booking” to see the whole layout.",
  helpful: {
    question: "Was this page helpful?",
    askMore: "What was missing or wrong?",
    thanksYes: "Thanks! Glad it helped.",
    thanksNo: "Thanks for telling us. The docs team reads every note.",
  },
  footer: { copy: "© 2026 Cadence Labs", links: ["Support", "Status", "Privacy", "Terms"] },
};

type Page = { id: string; title: string; summary: string; method?: string };

const searchIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const chevron = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const closeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const copyIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a1 1 0 0 1 1-1h10" />
  </svg>
);
const infoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
const warnIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);

/** Colours keywords, strings and comments in one line of sample code. */
function highlight(line: string): ReactNode[] {
  const parts = line.split(/(\/\/.*$|"[^"]*"|\b(?:import|from|const|await|new|true|false)\b)/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("//")) return <span key={i} className="fl-dd-c">{p}</span>;
    if (p.startsWith('"')) return <span key={i} className="fl-dd-s">{p}</span>;
    if (/^(import|from|const|await|new|true|false)$/.test(p)) return <span key={i} className="fl-dd-k">{p}</span>;
    return p;
  });
}

/** Wraps the part of a title that matches the search in <mark>. */
function marked(text: string, q: string): ReactNode {
  if (!q) return text;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

export default function SiteDocs() {
  const d = SAMPLE;
  const a = d.article;
  const allPages: Page[] = useMemo(() => d.groups.flatMap((g) => g.pages as Page[]), [d.groups]);

  const [version, setVersion] = useState(d.versions[0]);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(d.fullPage);
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(d.groups.map((g) => [g.id, g.id !== "webhooks"])));
  const [drawer, setDrawer] = useState(false);
  const [pm, setPm] = useState(0);
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);
  const [activeSec, setActiveSec] = useState(a.sections[0].id);
  const [vote, setVote] = useState<"idle" | "no" | "yes" | "sent">("idle");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");

  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const copyTimer = useRef<number | undefined>(undefined);

  const q = query.trim();
  const filtered = useMemo(
    () =>
      d.groups
        .map((g) => ({ ...g, pages: (g.pages as Page[]).filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || g.title.toLowerCase().includes(q.toLowerCase())) }))
        .filter((g) => g.pages.length > 0),
    [d.groups, q],
  );
  const matchCount = filtered.reduce((n, g) => n + g.pages.length, 0);

  const page = allPages.find((p) => p.id === current) ?? allPages[0];
  const pageGroup = d.groups.find((g) => g.pages.some((p) => p.id === page.id));
  const index = allPages.findIndex((p) => p.id === page.id);
  const prev = index > 0 ? allPages[index - 1] : null;
  const next = index < allPages.length - 1 ? allPages[index + 1] : null;
  const isFull = page.id === d.fullPage;

  // Highlight the section in view in "On this page".
  useEffect(() => {
    if (!isFull || typeof IntersectionObserver === "undefined") return;
    const els = a.sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top);
        if (visible[0]) setActiveSec(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isFull, a.sections]);

  // Drawer: focus inside on open, Escape closes, focus returns to the menu button.
  useEffect(() => {
    if (!drawer) return;
    closeRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        burgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const closeDrawer = () => {
    setDrawer(false);
    burgerRef.current?.focus();
  };

  const trapTab = (e: KeyboardEvent<HTMLElement>) => {
    if (!drawer || e.key !== "Tab" || !drawerRef.current) return;
    const items = drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input");
    const list = Array.from(items).filter((el) => el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const goTo = (id: string) => {
    setCurrent(id);
    setVote("idle");
    setNote("");
    setNoteError("");
    if (drawer) setDrawer(false);
    articleRef.current?.scrollIntoView({ block: "start" });
  };

  const copy = async (key: string, text: string) => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
    }
    setCopied({ key, ok });
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(null), 2000);
  };

  const copyButton = (key: string, text: string, label: string) => {
    const state = copied?.key === key ? (copied.ok ? "copied" : "failed") : "idle";
    return (
      <button type="button" className="fl-dd-copy" data-state={state} onClick={() => copy(key, text)} aria-label={state === "idle" ? label : undefined}>
        {state === "copied" ? <Icon name="check" /> : copyIcon}
        {state === "copied" ? "Copied" : state === "failed" ? "Select to copy" : "Copy"}
      </button>
    );
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = a.install.length;
    let to = -1;
    if (e.key === "ArrowRight") to = (i + 1) % n;
    if (e.key === "ArrowLeft") to = (i - 1 + n) % n;
    if (e.key === "Home") to = 0;
    if (e.key === "End") to = n - 1;
    if (to < 0) return;
    e.preventDefault();
    setPm(to);
    tabRefs.current[to]?.focus();
  };

  const sendNote = (e: FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 5) {
      setNoteError("Add a few words so we know what to fix.");
      return;
    }
    setNoteError("");
    setVote("sent");
  };

  const searchField = (id: string) => (
    <div className="fl-dd-search">
      <label htmlFor={id} className="fl-sr">
        Search the docs
      </label>
      {searchIcon}
      <input
        id={id}
        type="search"
        placeholder="Search pages"
        value={query}
        autoComplete="off"
        aria-controls="dd-nav-list"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.stopPropagation();
            setQuery("");
          }
        }}
      />
      <kbd aria-hidden="true">/</kbd>
    </div>
  );

  // Press "/" to jump to search (desktop).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const el = document.getElementById("dd-search-top") as HTMLInputElement | null;
      if (el && el.offsetParent !== null) {
        e.preventDefault();
        el.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fl-dd-page" id="dd-top">
      <header className="fl-dd-top">
        <div className="fl-dd-top__row">
          <button
            ref={burgerRef}
            type="button"
            className="fl-dd-iconbtn fl-dd-burger"
            aria-label="Open navigation"
            aria-expanded={drawer}
            aria-controls="dd-side"
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" />
          </button>
          <a className="fl-dd-brand" href="#dd-top">
            <span className="fl-dd-brand__mark" aria-hidden="true">
              C/
            </span>
            {d.product}
            <small>{d.productTag}</small>
          </a>
          <label htmlFor="dd-version" className="fl-sr">
            Docs version
          </label>
          <span className="fl-dd-select">
            <select id="dd-version" value={version} onChange={(e) => setVersion(e.target.value)}>
              {d.versions.map((v, i) => (
                <option key={v} value={v}>
                  {v}
                  {i === 0 ? " (latest)" : ""}
                </option>
              ))}
            </select>
            {chevron}
          </span>
          {searchField("dd-search-top")}
          <nav className="fl-dd-top__end" aria-label="Product">
            {d.topLinks.map((l) => (
              <a key={l.href} className="fl-dd-top__link" href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="fl-dd-layout">
        <button type="button" className="fl-dd-backdrop" data-open={drawer} aria-hidden="true" tabIndex={-1} onClick={closeDrawer} />
        <aside
          id="dd-side"
          ref={drawerRef}
          className="fl-dd-side"
          data-open={drawer}
          role={drawer ? "dialog" : undefined}
          aria-modal={drawer ? true : undefined}
          aria-labelledby={drawer ? "dd-side-title" : undefined}
          onKeyDown={trapTab}
        >
          <div className="fl-dd-side__head">
            <strong id="dd-side-title">{d.product} docs</strong>
            <button ref={closeRef} type="button" className="fl-dd-iconbtn" aria-label="Close navigation" onClick={closeDrawer}>
              {closeIcon}
            </button>
          </div>
          <div className="fl-dd-side__search">{searchField("dd-search-drawer")}</div>
          <nav aria-label="Documentation" id="dd-nav-list">
            <p className="fl-dd-count" aria-live="polite">
              {q ? (matchCount ? `${matchCount} ${matchCount === 1 ? "page matches" : "pages match"}` : "") : ""}
            </p>
            {q && matchCount === 0 ? (
              <div className="fl-dd-noresults">
                <span>
                  No pages match “<strong>{q}</strong>”. Try a shorter word, like “book” or “error”.
                </span>
                <button type="button" className="fl-dd-copy" onClick={() => setQuery("")}>
                  Clear search
                </button>
              </div>
            ) : (
              filtered.map((g) => {
                const expanded = q ? true : open[g.id];
                return (
                  <div key={g.id} className="fl-dd-group">
                    <button
                      type="button"
                      className="fl-dd-group__btn"
                      aria-expanded={expanded}
                      aria-controls={`dd-group-${g.id}`}
                      onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}
                      disabled={!!q}
                    >
                      {g.title}
                      {chevron}
                    </button>
                    <ul id={`dd-group-${g.id}`} className="fl-dd-pages" hidden={!expanded}>
                      {g.pages.map((p) => (
                        <li key={p.id}>
                          <a
                            href={`#${p.id}`}
                            aria-current={p.id === page.id ? "page" : undefined}
                            onClick={(e) => {
                              e.preventDefault();
                              goTo(p.id);
                            }}
                          >
                            {marked(p.title, q)}
                            {p.method ? <span className="fl-dd-method">{p.method}</span> : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </nav>
        </aside>

        <main className="fl-dd-article" ref={articleRef} style={{ scrollMarginTop: "4rem" }} aria-labelledby="dd-title">
          {version !== d.versions[0] ? (
            <div className="fl-dd-version-note" role="status">
              <span>
                You are reading the <strong>{version}</strong> docs. Some calls changed in {d.versions[0]}.
              </span>
              <button type="button" onClick={() => setVersion(d.versions[0])}>
                Switch to {d.versions[0]}
              </button>
            </div>
          ) : null}

          <ol className="fl-dd-crumbs" aria-label="Breadcrumb">
            <li>Docs</li>
            <li>{pageGroup?.title}</li>
            <li aria-current="page">{page.title}</li>
          </ol>

          {isFull ? (
            <>
              <h1 id="dd-title">{a.title}</h1>
              <p className="fl-dd-lede">{a.lede}</p>
              <p className="fl-dd-endpoint">
                <b>{a.method}</b>
                {a.path}
              </p>

              <h2 id={a.sections[0].id}>
                <a href={`#${a.sections[0].id}`}>{a.sections[0].title}</a>
              </h2>
              <p>{a.installIntro}</p>
              <div className="fl-dd-code">
                <div className="fl-dd-code__bar">
                  <div className="fl-dd-tabs" role="tablist" aria-label="Package manager">
                    {a.install.map((t, i) => (
                      <button
                        key={t.tab}
                        ref={(el) => {
                          tabRefs.current[i] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`dd-pm-${t.tab}`}
                        aria-selected={pm === i}
                        aria-controls="dd-pm-panel"
                        tabIndex={pm === i ? 0 : -1}
                        onClick={() => setPm(i)}
                        onKeyDown={(e) => onTabKey(e, i)}
                      >
                        {t.tab}
                      </button>
                    ))}
                  </div>
                  {copyButton("install", a.install[pm].cmd, "Copy install command")}
                </div>
                <pre id="dd-pm-panel" role="tabpanel" aria-labelledby={`dd-pm-${a.install[pm].tab}`} tabIndex={0}>
                  <code>
                    <span className="fl-dd-prompt">$ </span>
                    {a.install[pm].cmd}
                  </code>
                </pre>
              </div>

              <h2 id={a.sections[1].id}>
                <a href={`#${a.sections[1].id}`}>{a.sections[1].title}</a>
              </h2>
              <p>{a.requestIntro}</p>
              <div className="fl-dd-code">
                <div className="fl-dd-code__bar">
                  <span>{a.requestFile}</span>
                  {copyButton("request", a.request.join("\n"), "Copy request example")}
                </div>
                <pre tabIndex={0} aria-label="Request example">
                  <code>
                    {a.request.map((line, i) => (
                      <span key={i}>
                        {highlight(line)}
                        {"\n"}
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
              <div className="fl-dd-callout" role="note">
                {infoIcon}
                <div>
                  <strong>{a.note.title}</strong>
                  <p>{a.note.text}</p>
                </div>
              </div>

              <h2 id={a.sections[2].id}>
                <a href={`#${a.sections[2].id}`}>{a.sections[2].title}</a>
              </h2>
              <p>Send these in the JSON body. Unknown fields are rejected so typos never slip through.</p>
              <div className="fl-dd-tablewrap" tabIndex={0} role="region" aria-label="Parameters, scrolls sideways">
                <table className="fl-dd-table">
                  <caption className="fl-sr">Body parameters for creating a booking</caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Type</th>
                      <th scope="col">Required</th>
                      <th scope="col">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.params.map((p) => (
                      <tr key={p.name}>
                        <th scope="row">
                          <code>{p.name}</code>
                        </th>
                        <td className="fl-dd-type">{p.type}</td>
                        <td>{p.required ? <span className="fl-dd-req">Required</span> : <span className="fl-dd-opt">Optional</span>}</td>
                        <td>{p.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fl-dd-callout fl-dd-callout--warn" role="note">
                {warnIcon}
                <div>
                  <strong>{a.warn.title}</strong>
                  <p>{a.warn.text}</p>
                </div>
              </div>

              <h2 id={a.sections[3].id}>
                <a href={`#${a.sections[3].id}`}>{a.sections[3].title}</a>
              </h2>
              <p>{a.responseIntro}</p>
              <div className="fl-dd-code">
                <div className="fl-dd-code__bar">
                  <span>201 Created · application/json</span>
                  {copyButton("response", a.response.join("\n"), "Copy response example")}
                </div>
                <pre tabIndex={0} aria-label="Response example">
                  <code>
                    {a.response.map((line, i) => (
                      <span key={i}>
                        {highlight(line)}
                        {"\n"}
                      </span>
                    ))}
                  </code>
                </pre>
              </div>

              <h2 id={a.sections[4].id}>
                <a href={`#${a.sections[4].id}`}>{a.sections[4].title}</a>
              </h2>
              <dl className="fl-dd-errors">
                {a.errors.map((er) => (
                  <div key={er.code}>
                    <dt>
                      <span>{er.status}</span>
                      <span>{er.code}</span>
                    </dt>
                    <dd>{er.text}</dd>
                  </div>
                ))}
              </dl>
              <p className="fl-meta">{a.updated}</p>
            </>
          ) : (
            <>
              <h1 id="dd-title">{page.title}</h1>
              <p className="fl-dd-lede">{page.summary}</p>
              <div className="fl-dd-callout" role="note">
                {infoIcon}
                <div>
                  <strong>Sample page</strong>
                  <p>
                    {d.stubNote}{" "}
                    <a
                      className="fl-link"
                      href={`#${d.fullPage}`}
                      onClick={(e) => {
                        e.preventDefault();
                        goTo(d.fullPage);
                      }}
                    >
                      Open it
                    </a>
                  </p>
                </div>
              </div>
            </>
          )}

          <nav className="fl-dd-pager" aria-label="Previous and next pages">
            {prev ? (
              <button type="button" onClick={() => goTo(prev.id)}>
                <span>← Previous</span>
                {prev.title}
              </button>
            ) : null}
            {next ? (
              <button type="button" className="fl-dd-pager__next" onClick={() => goTo(next.id)}>
                <span>Next →</span>
                {next.title}
              </button>
            ) : null}
          </nav>

          <section className="fl-dd-helpful" aria-labelledby="dd-helpful-q">
            <div aria-live="polite">
              {vote === "yes" || vote === "sent" ? (
                <p className="fl-done" style={{ margin: 0 }}>
                  {vote === "yes" ? d.helpful.thanksYes : d.helpful.thanksNo}
                </p>
              ) : null}
            </div>
            {vote === "idle" ? (
              <div className="fl-dd-helpful__row">
                <strong id="dd-helpful-q">{d.helpful.question}</strong>
                <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setVote("yes")}>
                  Yes
                </button>
                <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setVote("no")}>
                  No
                </button>
              </div>
            ) : null}
            {vote === "no" ? (
              <form className="fl-form" onSubmit={sendNote} noValidate>
                <div className="fl-field">
                  <label htmlFor="dd-note" id="dd-helpful-q">
                    {d.helpful.askMore}
                  </label>
                  <textarea
                    id="dd-note"
                    className="fl-input"
                    style={{ minHeight: "5rem" }}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    aria-invalid={noteError ? true : undefined}
                    aria-describedby={noteError ? "dd-note-error" : undefined}
                    placeholder="For example: the 409 example doesn't show the response body"
                  />
                  {noteError ? (
                    <p id="dd-note-error" className="fl-dd-error">
                      {noteError}
                    </p>
                  ) : null}
                </div>
                <div className="fl-actions">
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Send note
                  </button>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setVote("idle")}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
            {vote === "yes" || vote === "sent" ? <span id="dd-helpful-q" className="fl-sr">{d.helpful.question}</span> : null}
          </section>
        </main>

        <aside className="fl-dd-toc" aria-labelledby="dd-toc-title">
          <h2 id="dd-toc-title">On this page</h2>
          {isFull ? (
            <ul className="fl-dd-list">
              {a.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} aria-current={activeSec === s.id ? "true" : undefined} onClick={() => setActiveSec(s.id)}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-meta">This page has no sections yet.</p>
          )}
          <div className="fl-dd-toc__extra">
            <a className="fl-link" href="#dd-top">
              Back to top
            </a>
            <a className="fl-link" href="#edit">
              Edit this page
            </a>
          </div>
        </aside>
      </div>

      <footer className="fl-dd-foot">
        <div className="fl-dd-foot__row">
          <span>
            {d.footer.copy} · Docs for {version}
          </span>
          <ul>
            {d.footer.links.map((l) => (
              <li key={l}>
                <a href={`#${l.toLowerCase()}`}>{l}</a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
