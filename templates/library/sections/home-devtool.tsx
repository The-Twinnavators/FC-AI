/**
 * Page template: developer-tool homepage, here an open-source local-first sync library with a paid hosted relay.
 * Navigation with a star count, a split hero with a one-line install command and a terminal that types out a short
 * session (it shows the whole session at once for people who ask for less motion), a code sample that switches
 * between frameworks, a features grid, a "how it works" diagram drawn in SVG, benchmark bars you can switch between
 * measures, open-source numbers, free and team pricing with a seat counter, questions and a footer of docs links.
 * Suits CLIs, SDKs, databases, APIs and other tools sold to developers. Nothing is sent anywhere.
 * Make it the app's own: replace SAMPLE with the tool's real install command, code samples, benchmarks (with how they
 * were measured) and plans, and redraw the diagram around the tool's own architecture.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Tidepool",
  links: [
    { label: "Docs", href: "#dd-hp-docs" },
    { label: "Features", href: "#dd-hp-features" },
    { label: "Benchmarks", href: "#dd-hp-bench" },
    { label: "Pricing", href: "#dd-hp-pricing" },
    { label: "FAQ", href: "#dd-hp-faq" },
  ],
  stars: "18.4k",
  release: { tag: "v2.0", text: "Offline write queues are here", href: "#changelog" },
  title: "Your app's data, on every device, even offline",
  lede: "Tidepool is a local-first sync library. Reads and writes hit a store on the device in under a millisecond, and changes merge across devices the moment a connection comes back.",
  install: "npm i @tidepool/sync",
  primary: "Read the quickstart",
  secondary: "How it works",
  meta: "MIT licensed · 14 kB gzipped · TypeScript first",
  terminal: {
    title: "~/projects/notes",
    lines: [
      { kind: "cmd", text: "npx tidepool init" },
      { kind: "ok", text: "✔ Created tidepool.config.ts" },
      { kind: "ok", text: "✔ Local store ready (IndexedDB, 0 rows)" },
      { kind: "cmd", text: "npx tidepool dev" },
      { kind: "out", text: "→ Relay listening on localhost:4400" },
      { kind: "out", text: "→ 2 devices connected · 0 conflicts" },
      { kind: "cmd", text: "npx tidepool status" },
      { kind: "ok", text: "✔ Synced 1,284 rows in 38 ms · queue empty" },
    ],
  },
  sampleTitle: "Works with the framework you already use",
  sampleText: "Queries are live: when a row changes on any device, every component reading it updates. Writes return before the network is involved.",
  samples: [
    {
      tab: "React",
      file: "Todos.tsx",
      code: [
        'import { useQuery, useMutation } from "@tidepool/react";',
        "",
        "export function Todos() {",
        '  const todos = useQuery("todos", { orderBy: "createdAt" });',
        '  const add = useMutation("todos.insert");',
        "  return <List items={todos} onAdd={(title) => add({ title })} />;",
        "}",
      ],
    },
    {
      tab: "Vue",
      file: "Todos.vue",
      code: [
        "<script setup>",
        'import { useQuery, useMutation } from "@tidepool/vue";',
        'const todos = useQuery("todos", { orderBy: "createdAt" });',
        'const add = useMutation("todos.insert");',
        "</script>",
        "",
        '<template><List :items="todos" @add="(title) => add({ title })" /></template>',
      ],
    },
    {
      tab: "Svelte",
      file: "Todos.svelte",
      code: [
        "<script>",
        '  import { query, mutation } from "@tidepool/svelte";',
        '  const todos = query("todos", { orderBy: "createdAt" });',
        '  const add = mutation("todos.insert");',
        "</script>",
        "",
        "<List items={$todos} on:add={(e) => add({ title: e.detail })} />",
      ],
    },
    {
      tab: "Node",
      file: "worker.ts",
      code: [
        'import { createStore } from "@tidepool/sync";',
        "",
        'const store = createStore({ name: "notes", relay: "ws://localhost:4400" });',
        "",
        '// Runs on the server too: same API, same merge rules',
        'await store.insert("todos", { title: "Ship v2" });',
        'store.on("change", (rows) => console.log(rows.length, "rows"));',
      ],
    },
  ],
  featuresTitle: "Built for apps that can't wait on a spinner",
  features: [
    { icon: "bolt", title: "Instant reads and writes", text: "Every query runs against the local store first. No loading states for data you already have.", code: "p95 write: 4 ms" },
    { icon: "layers", title: "Conflict-free merging", text: "Edits from two devices merge field by field. Lists keep everyone's inserts in a sensible order.", code: "merge: crdt" },
    { icon: "clock", title: "Offline write queue", text: "Changes made on a plane or in a tunnel wait in a queue and send in order when the signal returns.", code: "queue.size → 12" },
    { icon: "shield", title: "Per-row permissions", text: "Rules in one file decide who can read and write each row. They run on the relay, not the client.", code: "rules.ts" },
    { icon: "users", title: "Presence built in", text: "See who else is viewing a document and where their cursor is, without a second service.", code: "usePresence()" },
    { icon: "chart", title: "Inspector in dev", text: "A panel that shows every pending change, merge and sync round trip while you build.", code: "tidepool dev" },
  ],
  howTitle: "How a change travels",
  howText: "The relay only passes changes along and keeps a backup. Your app never waits on it.",
  steps: [
    { title: "Write locally", text: "The change lands in the device's store and the screen updates straight away." },
    { title: "Queue and send", text: "A small diff goes to the relay over one socket, or waits in the queue while offline." },
    { title: "Merge everywhere", text: "Other devices receive the diff and merge it. Nobody's edit is thrown away." },
  ],
  benchTitle: "Benchmarks",
  benchText: "Measured on a mid-range laptop and a three-year-old phone, median of 20 runs. Lower is better.",
  bench: [
    {
      id: "sync",
      label: "First sync",
      caption: "Time to load 10,000 rows on a fresh device",
      unit: "ms",
      rows: [
        { name: "Tidepool", value: 410, ours: true },
        { name: "Sync library A", value: 1240, ours: false },
        { name: "Sync library B", value: 980, ours: false },
        { name: "Hand-rolled REST", value: 2650, ours: false },
      ],
    },
    {
      id: "write",
      label: "Write to screen",
      caption: "From a tap to the list updating, 95th percentile",
      unit: "ms",
      rows: [
        { name: "Tidepool", value: 4, ours: true },
        { name: "Sync library A", value: 38, ours: false },
        { name: "Sync library B", value: 22, ours: false },
        { name: "Hand-rolled REST", value: 180, ours: false },
      ],
    },
    {
      id: "size",
      label: "Bundle size",
      caption: "Added to your app, minified and gzipped",
      unit: "kB",
      rows: [
        { name: "Tidepool", value: 14, ours: true },
        { name: "Sync library A", value: 41, ours: false },
        { name: "Sync library B", value: 27, ours: false },
        { name: "Hand-rolled REST", value: 9, ours: false },
      ],
    },
  ],
  benchFoot: "Plain REST ships fewer bytes, but every read still waits on the network.",
  oss: {
    eyebrow: "Open source",
    title: "Built in the open by 312 people",
    text: "The library, the relay and the inspector are MIT licensed. Self-host the relay anywhere that runs a container.",
    stats: [
      { label: "Stars", value: "18.4k" },
      { label: "Contributors", value: "312" },
      { label: "Weekly installs", value: "96k" },
      { label: "Median time to first reply on issues", value: "9 h" },
    ],
    faces: ["MO", "TK", "AS", "JR", "LW", "PD"],
    more: "+306",
    release: "Latest release v2.0.3, 6 days ago",
  },
  pricingTitle: "Free to use. Pay when you want us to run it.",
  plans: {
    free: {
      name: "Open source",
      price: "$0",
      per: "forever",
      text: "The full library and a relay you host yourself.",
      points: ["Every feature in the library", "Self-hosted relay (one container)", "Community chat and discussions", "MIT licence"],
      cta: "Read the quickstart",
    },
    team: {
      name: "Team",
      perSeat: 12,
      per: "per developer / month",
      text: "We run the relay, back it up and wake up when it breaks.",
      points: ["Hosted relay in 6 regions", "Hourly backups kept for 30 days", "Single sign-on and audit log", "Support reply within one working day"],
      cta: "Start a 14-day trial",
    },
  },
  faq: [
    { q: "Do I need a backend?", a: "For one device, no. To sync across devices you need a relay: run ours with one command, or let the Team plan host it." },
    { q: "What happens when two people edit the same thing?", a: "Each field merges on its own. If two people change the same field, the later edit wins and the earlier one is kept in the history." },
    { q: "Which databases can it sit on?", a: "On the device it uses IndexedDB in browsers and SQLite on mobile and desktop. The relay can mirror into Postgres for reporting." },
    { q: "Can I move off the hosted relay later?", a: "Yes. Export a snapshot, start the open-source relay, change one URL. The data format is the same." },
    { q: "Is there a size limit?", a: "Devices handle a few hundred thousand rows comfortably. For bigger sets, sync a slice per user with partial-sync rules." },
  ],
  footer: {
    blurb: "Local-first sync for web, mobile and desktop apps.",
    cols: [
      { title: "Docs", links: ["Quickstart", "API reference", "React guide", "Migrating from v1"] },
      { title: "Community", links: ["Discussions", "Chat server", "Contributing", "Code of conduct"] },
      { title: "Project", links: ["Changelog", "Roadmap", "Security policy", "Team plan"] },
    ],
    base: "MIT licensed · Made by the Tidepool maintainers",
  },
};

const copyIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a1 1 0 0 1 1-1h10" />
  </svg>
);
const starIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
  </svg>
);

const KEYWORDS = /^(import|from|const|await|export|function|return)$/;
function highlight(line: string): ReactNode[] {
  return line.split(/(\/\/.*$|"[^"]*"|\b(?:import|from|const|await|export|function|return)\b)/g).map((p, i) => {
    if (!p) return null;
    if (p.startsWith("//")) return <span key={i} className="fl-dd-c">{p}</span>;
    if (p.startsWith('"')) return <span key={i} className="fl-dd-s">{p}</span>;
    if (KEYWORDS.test(p)) return <span key={i} className="fl-dd-k">{p}</span>;
    return p;
  });
}

const REDUCE = "(prefers-reduced-motion: reduce)";

export default function HomeDevtool() {
  const d = SAMPLE;
  const lines = d.terminal.lines;

  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(REDUCE).matches);
  const [line, setLine] = useState(() => (typeof window !== "undefined" && window.matchMedia?.(REDUCE).matches ? lines.length : 0));
  const [chars, setChars] = useState(0);
  const [tab, setTab] = useState(0);
  const [metric, setMetric] = useState(0);
  const [seats, setSeats] = useState(5);
  const [trial, setTrial] = useState(false);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const m = window.matchMedia?.(REDUCE);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);

  // Terminal: type each command a character at a time, then print its output line by line.
  useEffect(() => {
    if (reduced) {
      setLine(lines.length);
      return;
    }
    if (line >= lines.length) return;
    const cur = lines[line];
    const typing = cur.kind === "cmd" && chars < cur.text.length;
    const t = window.setTimeout(
      () => {
        if (typing) setChars((c) => c + 1);
        else {
          setLine((l) => l + 1);
          setChars(0);
        }
      },
      typing ? 55 : cur.kind === "cmd" ? 420 : 260,
    );
    return () => window.clearTimeout(t);
  }, [line, chars, reduced, lines]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const replay = () => {
    setChars(0);
    setLine(reduced ? lines.length : 0);
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
    const n = d.samples.length;
    const to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(to);
    tabRefs.current[to]?.focus();
  };

  const setSeatCount = (n: number) => {
    setSeats(Math.min(200, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1)));
    setTrial(false);
  };

  const sample = d.samples[tab];
  const bench = d.bench[metric];
  const benchMax = Math.max(...bench.rows.map((r) => r.value));
  const done = line >= lines.length;
  const team = d.plans.team;

  return (
    <div className="fl-dd-page" id="dd-hp-top">
      <header className="fl-nav">
        <nav className="fl-nav__row" aria-label="Main">
          <a className="fl-nav__brand" href="#dd-hp-top" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span className="fl-dd-brand__mark" aria-hidden="true">
              tp
            </span>
            {d.brand}
          </a>
          <ul className="fl-nav__links">
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="fl-nav__end">
            <a className="fl-dd-star fl-dd-hide-sm" href="#source" aria-label={`Source code, ${d.stars} stars`}>
              {starIcon}
              Star
              <b>{d.stars}</b>
            </a>
            <a className="fl-btn fl-btn--primary fl-dd-hide-sm" href="#dd-hp-docs" style={{ minHeight: "var(--control-md)" }}>
              Get started
            </a>
            <button
              type="button"
              className="fl-btn fl-btn--secondary fl-nav__menu"
              aria-expanded={menu}
              aria-controls="dd-hp-menu"
              aria-label="Menu"
              onClick={() => setMenu((o) => !o)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </nav>
        <ul id="dd-hp-menu" className="fl-dd-menu" data-open={menu}>
          {[...d.links, { label: `Source (${d.stars} stars)`, href: "#source" }].map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setMenu(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <main>
        <section className="fl-dd-hero fl-bg-dots" aria-labelledby="dd-hp-title">
          <div className="fl-wrap fl-dd-hero__grid">
            <div className="fl-dd-hero__copy">
              <a className="fl-dd-release" href={d.release.href}>
                <b>{d.release.tag}</b>
                {d.release.text}
                <Icon name="arrow" />
              </a>
              <h1 id="dd-hp-title" className="fl-title fl-title--xl">
                {d.title}
              </h1>
              <p className="fl-lede">{d.lede}</p>
              <div className="fl-dd-install">
                <code>
                  <span aria-hidden="true">$ </span>
                  {d.install}
                </code>
                {copyButton("install", d.install, "Copy install command")}
              </div>
              <div className="fl-actions">
                <a className="fl-btn fl-btn--primary" href="#dd-hp-docs">
                  {d.primary}
                  <Icon name="arrow" />
                </a>
                <a className="fl-btn fl-btn--secondary" href="#dd-hp-how">
                  {d.secondary}
                </a>
              </div>
              <p className="fl-meta" style={{ margin: 0 }}>
                {d.meta}
              </p>
            </div>

            <figure className="fl-dd-term">
              <div className="fl-dd-term__bar">
                <span className="fl-dd-term__dot" aria-hidden="true" />
                <span className="fl-dd-term__dot" aria-hidden="true" />
                <span className="fl-dd-term__dot" aria-hidden="true" />
                <span>{d.terminal.title}</span>
                <button type="button" className="fl-dd-term__replay" onClick={replay} disabled={!done && !reduced}>
                  Replay
                </button>
              </div>
              <div className="fl-dd-term__body" aria-hidden="true">
                {lines.slice(0, Math.min(line + 1, lines.length)).map((l, i) => {
                  const partial = i === line && l.kind === "cmd";
                  if (i === line && l.kind !== "cmd") return null;
                  return (
                    <p key={i} className={l.kind === "cmd" ? "fl-dd-term__cmd" : l.kind === "ok" ? "fl-dd-term__ok" : "fl-dd-term__out"}>
                      {partial ? l.text.slice(0, chars) : l.text}
                      {partial ? <span className="fl-dd-caret" /> : null}
                    </p>
                  );
                })}
                {done ? (
                  <p className="fl-dd-term__cmd">
                    <span className="fl-dd-caret" />
                  </p>
                ) : null}
              </div>
              <figcaption className="fl-sr">
                A terminal session: {lines.map((l) => (l.kind === "cmd" ? `run ${l.text}` : l.text)).join(". ")}.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="fl-section" id="dd-hp-docs" aria-labelledby="dd-hp-sample-title">
          <div className="fl-wrap fl-dd-sample">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <p className="fl-eyebrow">Quickstart</p>
              <h2 id="dd-hp-sample-title" className="fl-title">
                {d.sampleTitle}
              </h2>
              <p className="fl-text">{d.sampleText}</p>
              <a className="fl-link" href="#quickstart">
                Full quickstart guide →
              </a>
            </div>
            <div className="fl-dd-code">
              <div className="fl-dd-code__bar">
                <div className="fl-dd-tabs" role="tablist" aria-label="Framework">
                  {d.samples.map((s, i) => (
                    <button
                      key={s.tab}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`dd-hp-tab-${i}`}
                      aria-selected={tab === i}
                      aria-controls="dd-hp-tabpanel"
                      tabIndex={tab === i ? 0 : -1}
                      onClick={() => setTab(i)}
                      onKeyDown={(e) => onTabKey(e, i)}
                    >
                      {s.tab}
                    </button>
                  ))}
                </div>
                {copyButton(`sample-${tab}`, sample.code.join("\n"), `Copy ${sample.tab} example`)}
              </div>
              <pre id="dd-hp-tabpanel" role="tabpanel" aria-labelledby={`dd-hp-tab-${tab}`} tabIndex={0}>
                <code>
                  <span className="fl-dd-c">{`// ${sample.file}\n`}</span>
                  {sample.code.map((l, i) => (
                    <span key={i}>
                      {highlight(l)}
                      {"\n"}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="dd-hp-features" aria-labelledby="dd-hp-feat-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <p className="fl-eyebrow">Features</p>
              <h2 id="dd-hp-feat-title" className="fl-title">
                {d.featuresTitle}
              </h2>
            </div>
            <ul className="fl-dd-list fl-dd-feats">
              {d.features.map((f) => (
                <li key={f.title}>
                  <span className="fl-icon">
                    <Icon name={f.icon} />
                  </span>
                  <h3>{f.title}</h3>
                  <p className="fl-text">{f.text}</p>
                  <code>{f.code}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section" id="dd-hp-how" aria-labelledby="dd-hp-how-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <p className="fl-eyebrow">How it works</p>
              <h2 id="dd-hp-how-title" className="fl-title">
                {d.howTitle}
              </h2>
              <p className="fl-lede">{d.howText}</p>
            </div>
            <figure className="fl-dd-diagram" style={{ margin: 0 }} tabIndex={0} aria-labelledby="dd-hp-diagram-cap">
              <svg viewBox="0 0 720 250" role="img" aria-labelledby="dd-hp-diagram-cap">
                <defs>
                  <marker id="dd-hp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path className="head" d="M0 0 10 5 0 10Z" />
                  </marker>
                </defs>
                {/* Device A */}
                <rect className="box" x="10" y="40" width="190" height="170" rx="14" />
                <text className="t" x="30" y="72">Laptop</text>
                <text className="t-sm" x="30" y="92">your app</text>
                <rect className="store" x="30" y="110" width="150" height="80" rx="10" />
                <text className="t-sm" x="45" y="140">local store</text>
                <text className="t-acc" x="45" y="165">write → 4 ms</text>
                {/* Relay */}
                <rect className="box box--hub" x="265" y="60" width="190" height="130" rx="14" />
                <text className="t" x="285" y="92">Relay</text>
                <text className="t-sm" x="285" y="114">passes diffs along</text>
                <text className="t-sm" x="285" y="134">keeps a backup</text>
                <text className="t-acc" x="285" y="164">self-host or Team</text>
                {/* Device B */}
                <rect className="box" x="520" y="40" width="190" height="170" rx="14" />
                <text className="t" x="540" y="72">Phone</text>
                <text className="t-sm" x="540" y="92">offline in a tunnel</text>
                <rect className="store" x="540" y="110" width="150" height="80" rx="10" />
                <text className="t-sm" x="555" y="140">write queue</text>
                <text className="t-acc" x="555" y="165">3 changes waiting</text>
                {/* Wires */}
                <path className="wire" d="M200 110 H262" markerEnd="url(#dd-hp-arrow)" />
                <path className="wire" d="M265 145 H203" markerEnd="url(#dd-hp-arrow)" />
                <path className="wire wire--off" d="M455 110 H517" />
                <path className="wire wire--off" d="M520 145 H458" />
                <text className="t-sm" x="214" y="98">diff</text>
                <text className="t-sm" x="468" y="98">reconnects</text>
                <text className="t-sm" x="478" y="172">merge</text>
              </svg>
              <figcaption id="dd-hp-diagram-cap" className="fl-sr">
                A laptop writes to its local store and sends a small diff to the relay. The relay passes it to a phone, which is offline
                with three changes waiting in its queue; when it reconnects, both sides merge.
              </figcaption>
            </figure>
            <ol className="fl-dd-list fl-dd-steps">
              {d.steps.map((s) => (
                <li key={s.title}>
                  <strong>{s.title}</strong>
                  <span className="fl-text">{s.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="dd-hp-bench" aria-labelledby="dd-hp-bench-title">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-head" style={{ marginBottom: "var(--space-5)" }}>
              <p className="fl-eyebrow">{d.benchTitle}</p>
              <h2 id="dd-hp-bench-title" className="fl-title">
                Fast where your users notice
              </h2>
              <p className="fl-text">{d.benchText}</p>
            </div>
            <div className="fl-toggle" role="group" aria-label="Measure">
              {d.bench.map((b, i) => (
                <button key={b.id} type="button" aria-pressed={metric === i} onClick={() => setMetric(i)}>
                  {b.label}
                </button>
              ))}
            </div>
            <p className="fl-meta" style={{ margin: "var(--space-4) 0 0" }} aria-live="polite">
              {bench.caption} ({bench.unit}, lower is better)
            </p>
            <ul className="fl-dd-bench">
              {bench.rows.map((r) => (
                <li key={r.name} data-ours={r.ours}>
                  <span>{r.name}</span>
                  <span className="fl-dd-bench__track" aria-hidden="true">
                    <span className="fl-dd-bench__bar" style={{ width: `${Math.max(2, (r.value / benchMax) * 100)}%` }} />
                  </span>
                  <span className="fl-dd-bench__val">
                    {r.value.toLocaleString("en-US")} {bench.unit}
                  </span>
                </li>
              ))}
            </ul>
            <p className="fl-note">{d.benchFoot}</p>
          </div>
        </section>

        <section className="fl-dd-oss fl-bg-ink" aria-labelledby="dd-hp-oss-title">
          <div className="fl-wrap fl-dd-oss__grid">
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <p className="fl-eyebrow">{d.oss.eyebrow}</p>
              <h2 id="dd-hp-oss-title" className="fl-title">
                {d.oss.title}
              </h2>
              <p className="fl-text">{d.oss.text}</p>
              <ul className="fl-dd-faces" aria-label="Some of the contributors">
                {d.oss.faces.map((f) => (
                  <li key={f}>{f}</li>
                ))}
                <li>{d.oss.more}</li>
              </ul>
              <p className="fl-text" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
                {d.oss.release}
              </p>
            </div>
            <dl className="fl-dd-oss__stats">
              {d.oss.stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="fl-section" id="dd-hp-pricing" aria-labelledby="dd-hp-price-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <p className="fl-eyebrow">Pricing</p>
              <h2 id="dd-hp-price-title" className="fl-title">
                {d.pricingTitle}
              </h2>
            </div>
            <div className="fl-dd-plans">
              <article className="fl-card" aria-labelledby="dd-hp-plan-free">
                <h3 id="dd-hp-plan-free">{d.plans.free.name}</h3>
                <p className="fl-price">
                  <strong>{d.plans.free.price}</strong>
                  <span className="fl-meta">{d.plans.free.per}</span>
                </p>
                <p className="fl-text">{d.plans.free.text}</p>
                <ul className="fl-checks">
                  {d.plans.free.points.map((p) => (
                    <li key={p}>
                      <span className="fl-tick">
                        <Icon name="check" />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <a className="fl-btn fl-btn--secondary" href="#dd-hp-docs">
                  {d.plans.free.cta}
                </a>
              </article>
              <article className="fl-card fl-card--featured" aria-labelledby="dd-hp-plan-team">
                <span className="fl-badge">Hosted for you</span>
                <h3 id="dd-hp-plan-team">{team.name}</h3>
                <p className="fl-price">
                  <strong>${team.perSeat}</strong>
                  <span className="fl-meta">{team.per}</span>
                </p>
                <p className="fl-text">{team.text}</p>
                <ul className="fl-checks">
                  {team.points.map((p) => (
                    <li key={p}>
                      <span className="fl-tick">
                        <Icon name="check" />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3) var(--space-4)" }}>
                  <label htmlFor="dd-hp-seats" style={{ fontWeight: "var(--weight-semibold)", fontSize: "var(--text-sm)" }}>
                    Developers
                  </label>
                  <div className="fl-dd-stepper">
                    <button type="button" aria-label="One fewer developer" disabled={seats <= 1} onClick={() => setSeatCount(seats - 1)}>
                      −
                    </button>
                    <input
                      id="dd-hp-seats"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={200}
                      value={seats}
                      onChange={(e) => setSeatCount(e.target.valueAsNumber)}
                    />
                    <button type="button" aria-label="One more developer" disabled={seats >= 200} onClick={() => setSeatCount(seats + 1)}>
                      +
                    </button>
                  </div>
                  <span className="fl-meta" aria-live="polite">
                    ${(seats * team.perSeat).toLocaleString("en-US")} a month
                  </span>
                </div>
                <button type="button" className="fl-btn fl-btn--primary" onClick={() => setTrial(true)}>
                  {team.cta}
                </button>
                <div aria-live="polite">
                  {trial ? (
                    <p className="fl-done" style={{ margin: 0 }}>
                      Trial set up for {seats} {seats === 1 ? "developer" : "developers"}. No card needed until day 14.
                    </p>
                  ) : null}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="dd-hp-faq" aria-labelledby="dd-hp-faq-title">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-head">
              <p className="fl-eyebrow">FAQ</p>
              <h2 id="dd-hp-faq-title" className="fl-title">
                Questions developers ask first
              </h2>
            </div>
            <div className="fl-faq">
              {d.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap">
          <div className="fl-footer__cols">
            <div style={{ display: "grid", gap: "var(--space-3)", alignContent: "start" }}>
              <a className="fl-nav__brand" href="#dd-hp-top" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span className="fl-dd-brand__mark" aria-hidden="true">
                  tp
                </span>
                {d.brand}
              </a>
              <p className="fl-text">{d.footer.blurb}</p>
              <code className="fl-meta fl-dd-mono">{d.install}</code>
            </div>
            {d.footer.cols.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <h4>{c.title}</h4>
                <ul>
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href={`#${l.toLowerCase().replace(/\s+/g, "-")}`}>{l}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="fl-footer__base">
            <span>{d.footer.base}</span>
            <span>© 2026 {d.brand}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
