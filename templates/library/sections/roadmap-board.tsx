/** @flowcode-library roadmap-board · Public roadmap (Features)
 * Catalog ID: b.roadmap (block)
 * Function: The public roadmap block (b.roadmap): Now, Next and Later columns of cards with a status, an area, a rough date, details that open and an upvote, filtered by area chips; on a phone the columns become tabs.
 * Use it as: import { RoadmapBoard } from "./roadmap-board"; <RoadmapBoard label="Roadmap" columns={[{ id: "now", label: "Now", text? }]} areas={[{ id, label }]} items={[{ id, column, area, title, text, more?, status: "shipped"|"building"|"planned"|"exploring", when?, votes? }]} voted?={["id"]} labels?={{ all, details, less, vote, voted, empty, statuses }} onVote?={(id, on) => ...} />  // use only plans the PRD names
 * Built from: c.badge.status, c.chip.filter
 * Look: A row of area filter chips over Now, Next and Later columns on a soft sunken band, each headed by a bold label, a muted line and a count; in each, rounded surface cards with a status pill with a small light, a muted area and date, a bold title, a muted line, a Details link that opens more text and a square upvote button with a count. On a phone a tab row with a straight accent bar under the chosen column replaces the columns.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --text-xs --text-sm --text-md --font-display --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: public roadmap; product roadmap; what's coming; feature requests; saas homepage; community feedback
 * Jobs to be done: see what is being built now; know when a feature is coming; vote for what I need; check a feature is planned before I buy
 * Keywords: roadmap, now next later, coming soon, planned, feature requests, upvote, status, kanban
 */
/**
 * Public roadmap: the classic Now / Next / Later board for a marketing page or a product's public site. The area chips
 * filter every column at once (with counts updating); each card's Details button opens more text in place
 * (aria-expanded, closed content is inert); the upvote is a toggle button whose count and pressed state change at
 * once and are said aloud. When the block is narrow (a phone) the columns become a tablist with a straight bar that
 * slides under the chosen column. Cards rise in once as the block comes into view; with reduced motion or animation
 * off they are simply there. Make it the app's own: replace SAMPLE with the real plan, and save votes through onVote.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge, type BadgeTone } from "./badges-status";
import { Chip } from "./chips-tags";
import { Icon } from "./icons";

export type RoadmapStatus = "shipped" | "building" | "planned" | "exploring";

export type RoadmapItem = {
  id: string;
  /** A column id. */
  column: string;
  /** An area id. */
  area: string;
  title: string;
  text: string;
  more?: string;
  status: RoadmapStatus;
  /** A rough date: "Nov 2026", "Q1 2027". */
  when?: string;
  votes?: number;
};

export type RoadmapBoardProps = {
  label: string;
  columns: Array<{ id: string; label: string; text?: string }>;
  areas: Array<{ id: string; label: string }>;
  items: RoadmapItem[];
  /** Items this visitor already voted for. */
  voted?: string[];
  labels?: {
    all?: string;
    details?: string;
    less?: string;
    vote?: string;
    voted?: string;
    empty?: string;
    statuses?: Partial<Record<RoadmapStatus, string>>;
  };
  onVote?: (id: string, on: boolean) => void;
};

const TONE: Record<RoadmapStatus, BadgeTone> = { shipped: "success", building: "info", planned: "warning", exploring: "neutral" };
const STATUS: Record<RoadmapStatus, string> = { shipped: "Shipped", building: "Building", planned: "Planned", exploring: "Exploring" };

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

export function RoadmapBoard({ label, columns, areas, items, voted = [], labels = {}, onVote }: RoadmapBoardProps) {
  const uid = useId();
  const L = {
    all: labels.all ?? "All areas",
    details: labels.details ?? "Details",
    less: labels.less ?? "Less",
    vote: labels.vote ?? "Upvote",
    voted: labels.voted ?? "Voted",
    empty: labels.empty ?? "Nothing here for this area yet.",
  };
  const statusLabel = (s: RoadmapStatus) => labels.statuses?.[s] ?? STATUS[s];
  const [area, setArea] = useState("all");
  const [open, setOpen] = useState<string[]>([]);
  const [mine, setMine] = useState<string[]>(voted);
  const [said, setSaid] = useState("");
  const [tab, setTab] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const [board, enter] = useEnterOnce<HTMLDivElement>();

  // Phone: the columns become tabs. Measured on the block itself, so it works inside any layout.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => setNarrow(el.clientWidth < 640);
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!narrow) return;
    const b = tabs.current[tab];
    if (b) setBar({ x: b.offsetLeft, w: b.offsetWidth });
  }, [tab, narrow, columns.length]);

  const shown = items.filter((i) => area === "all" || i.area === area);
  const areaLabel = (id: string) => areas.find((a) => a.id === id)?.label ?? id;
  const votesOf = (i: RoadmapItem) => (i.votes ?? 0) + (mine.includes(i.id) && !voted.includes(i.id) ? 1 : 0) - (!mine.includes(i.id) && voted.includes(i.id) ? 1 : 0);

  const toggleVote = (i: RoadmapItem) => {
    const on = !mine.includes(i.id);
    setMine((m) => (on ? [...m, i.id] : m.filter((x) => x !== i.id)));
    setSaid(on ? `Voted for ${i.title}.` : `Vote removed from ${i.title}.`);
    onVote?.(i.id, on);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let n: number | null = null;
    if (e.key === "ArrowRight") n = (i + 1) % columns.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + columns.length) % columns.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = columns.length - 1;
    if (n === null) return;
    e.preventDefault();
    setTab(n);
    tabs.current[n]?.focus();
  };

  return (
    <div ref={root} className={narrow ? "fl-rdm is-narrow" : "fl-rdm"} data-fl="b.roadmap">
      <div className="fl-rdm-areas" role="group" aria-label={`${label}: areas`}>
        {[{ id: "all", label: L.all }, ...areas].map((a) => (
          <Chip key={a.id} selected={area === a.id} onClick={() => setArea(a.id)}>
            {a.label}
          </Chip>
        ))}
      </div>

      {narrow ? (
        <div className="fl-rdm-tabs" role="tablist" aria-label={label}>
          {bar ? <span className="fl-rdm-bar" aria-hidden="true" style={{ translate: `${bar.x}px 0`, width: bar.w }} /> : null}
          {columns.map((c, i) => (
            <button
              key={c.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`${uid}-t${i}`}
              type="button"
              role="tab"
              aria-selected={i === tab}
              aria-controls={`${uid}-c${i}`}
              tabIndex={i === tab ? 0 : -1}
              className={i === tab ? "fl-rdm-tab is-on" : "fl-rdm-tab"}
              onClick={() => setTab(i)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {c.label}
              <span className="fl-rdm-count">{shown.filter((x) => x.column === c.id).length}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div ref={board} className={["fl-rdm-board", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ")}>
        {columns.map((c, ci) => {
          const list = shown.filter((x) => x.column === c.id);
          if (narrow && ci !== tab) return null;
          return (
            <section
              key={c.id}
              id={`${uid}-c${ci}`}
              className="fl-rdm-col"
              aria-labelledby={narrow ? `${uid}-t${ci}` : `${uid}-h${ci}`}
              role={narrow ? "tabpanel" : undefined}
            >
              <header className="fl-rdm-colhead">
                <h3 id={`${uid}-h${ci}`} className="fl-rdm-coltitle">
                  {c.label}
                  <span className="fl-rdm-count">{list.length}</span>
                </h3>
                {c.text ? <p className="fl-rdm-coltext">{c.text}</p> : null}
              </header>
              {list.length ? (
                <ul className="fl-rdm-list">
                  {list.map((it, i) => {
                    const isOpen = open.includes(it.id);
                    const on = mine.includes(it.id);
                    return (
                      <li key={it.id} className="fl-rdm-card" style={{ ["--i" as string]: ci * 2 + i }}>
                        <div className="fl-rdm-main">
                          <div className="fl-rdm-meta">
                            <Badge tone={TONE[it.status]} led>
                              {statusLabel(it.status)}
                            </Badge>
                            <span>
                              {areaLabel(it.area)}
                              {it.when ? ` · ${it.when}` : ""}
                            </span>
                          </div>
                          <h4 className="fl-rdm-title">{it.title}</h4>
                          <p className="fl-rdm-text">{it.text}</p>
                          {it.more ? (
                            <>
                              <button
                                type="button"
                                className="fl-rdm-more-btn"
                                aria-expanded={isOpen}
                                aria-controls={`${uid}-m-${it.id}`}
                                onClick={() => setOpen((o) => (isOpen ? o.filter((x) => x !== it.id) : [...o, it.id]))}
                              >
                                {isOpen ? L.less : L.details}
                                <span className="fl-sr">: {it.title}</span>
                                <Icon name="chevron-down" />
                              </button>
                              <div id={`${uid}-m-${it.id}`} className={isOpen ? "fl-rdm-more is-open" : "fl-rdm-more"} inert={!isOpen}>
                                <div>
                                  <p>{it.more}</p>
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className={on ? "fl-rdm-vote is-on" : "fl-rdm-vote"}
                          aria-pressed={on}
                          onClick={() => toggleVote(it)}
                          disabled={it.status === "shipped"}
                        >
                          <Icon name="chevron-down" />
                          <span className="fl-rdm-votes">{votesOf(it)}</span>
                          <span className="fl-sr">
                            {" "}
                            {on ? L.voted : L.vote}: {it.title}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="fl-rdm-empty">{L.empty}</p>
              )}
            </section>
          );
        })}
      </div>
      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Roadmap",
  title: "What we're building",
  lede: "Our plan for the next few months. Vote for what matters to you.",
  columns: [
    { id: "now", label: "Now", text: "In progress this month" },
    { id: "next", label: "Next", text: "Up after that" },
    { id: "later", label: "Later", text: "On our radar" },
  ],
  areas: [
    { id: "booking", label: "Booking" },
    { id: "payments", label: "Payments" },
    { id: "mobile", label: "Mobile app" },
  ],
  items: [
    { id: "waitlist", column: "now", area: "booking", title: "Waitlist for full days", text: "Offer freed-up slots to the next person in line.", more: "When someone cancels, the first person on the waitlist gets a text and has 30 minutes to claim the slot.", status: "building" as const, when: "Nov 2026", votes: 214 },
    { id: "tap", column: "now", area: "payments", title: "Tap to pay at the desk", text: "Take cards on your phone, no reader needed.", status: "building" as const, when: "Nov 2026", votes: 167 },
    { id: "widget", column: "now", area: "booking", title: "Booking widget themes", text: "Match the widget to your site's colors.", status: "shipped" as const, when: "Oct 2026", votes: 98 },
    { id: "packages", column: "next", area: "payments", title: "Visit packages", text: "Sell five or ten visits at once.", more: "Packages count down with each visit and can expire after a set number of months.", status: "planned" as const, when: "Q1 2027", votes: 302 },
    { id: "offline", column: "next", area: "mobile", title: "Offline schedule", text: "See today's visits without a signal.", status: "planned" as const, when: "Q1 2027", votes: 88 },
    { id: "groups", column: "later", area: "booking", title: "Group classes", text: "Let several people book the same slot.", more: "Set a capacity per class and let people join a waitlist when it fills up.", status: "exploring" as const, votes: 141 },
    { id: "watch", column: "later", area: "mobile", title: "Watch reminders", text: "Visit reminders on your wrist.", status: "exploring" as const, votes: 37 },
  ],
};

export default function RoadmapBoardPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="roadmap-board-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="roadmap-board-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <RoadmapBoard label={d.eyebrow} columns={d.columns} areas={d.areas} items={d.items} voted={["packages"]} />
      </div>
    </section>
  );
}
