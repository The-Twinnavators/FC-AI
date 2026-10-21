/** @flowcode-library team-directory · Team directory with filter (Team)
 * Catalog ID: b.team-directory (block)
 * Function: A team directory block (b.team-directory): people cards filtered by department chips and a name or role search (the cards glide to their new places), each with social links, Copy email with a fallback, and an About fold for a longer bio; a no-results state clears the filters. Adapted from Meraki UI (MIT).
 * Use it as: Import { TeamDirectory } from "./team-directory"; <TeamDirectory title eyebrow? lede? departments={[{ id, label }]} people={[{ id, name, role, department, location?, bio, more?, email?, links?: [{ kind: "linkedin"|"github"|"x"|"website", href }] }]} />  // use only people the PRD names
 * Built from: c.avatar.person, c.chip.filter, c.text-field.outlined, c.button.tertiary, c.button.secondary, c.empty-state.no-results
 * Look: A centered heading and line over a search field and department chips with counts, then a grid of centered cards: a large round avatar, a bold name, the role in the accent color, department and place, one line about them, About that folds open a longer bio, small round social links and Copy email.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-secondary --color-text --color-text-muted --focus-ring --radius-md --radius-lg --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-lg --duration-fast --duration-base --duration-slow --ease-out --enter-distance --stagger
 * Use cases: team page; staff directory; meet the team; about us; people directory; company directory; leadership; speakers
 * Jobs to be done: find the right person to contact; see who works in a department; look someone up by name or role; reach someone on their social profiles; copy someone's email
 * Keywords: team, people, staff, directory, filter, search, social links, departments, about
 */
/**
 * Team directory: department chips and a search over a grid of people. Choosing a department or typing a name keeps
 * the cards that stay and glides them to their new places (FLIP with the Web Animations API) while new ones fade in;
 * cards rise in once as they scroll into view. Each card has social links, Copy email (with a fallback that shows the
 * address when the clipboard is blocked), and About, which folds a longer bio open (grid rows, the closed part inert).
 * Make it the app's own: replace SAMPLE with the real people the PRD names, swap the initials for photos with alt text
 * when there are some, and keep only the links each person really has.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa), its team "Filter" component.
 */
/**
 * How to try it
 * - Pick "Engineering": the cards move to their new places. Pick "All" to bring everyone back.
 * - Type "design" in the search: it matches names and roles. Type "zzz" for the empty state, then Clear filters.
 * - Press About on a card to read more; press Copy email and the status says it was copied.
 *
 * Dependencies: React (useEffect, useId, useRef, useState, flushSync from react-dom), and the library's own inline icon
 * set ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample data
 * is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── b.team-directory: department chips and a search over people cards with social links. ──

export type TeamLinkKind = "linkedin" | "github" | "x" | "website";
export type TeamDepartment = { id: string; label: string };
export type TeamPerson = {
  id: string;
  name: string;
  role: string;
  /** A department id. */
  department: string;
  location?: string;
  /** One line about them, always shown. */
  bio: string;
  /** A longer bio, folded under About. */
  more?: string;
  email?: string;
  links?: { kind: TeamLinkKind; href: string }[];
};

export type TeamDirectoryProps = {
  title: string;
  eyebrow?: string;
  lede?: string;
  departments: TeamDepartment[];
  people: TeamPerson[];
  labels?: { search?: string; searchHint?: string; all?: string; filter?: string; about?: string; less?: string; copy?: string; copied?: string; copyFailed?: string; people?: string; person?: string; empty?: string; emptyText?: string; clear?: string };
};

const LINK_NAME: Record<TeamLinkKind, string> = { linkedin: "LinkedIn", github: "GitHub", x: "X", website: "Website" };
/** Line glyphs for the social links, drawn like the library's icons (24 by 24, 1.75 stroke). */
const LINK_PATH: Record<TeamLinkKind, string> = {
  linkedin: "M4 4h16v16H4zM8 10.5V16M8 7.75v.01M11.5 16v-3.25a2 2 0 0 1 4 0V16M11.5 10.5V16",
  github: "M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14",
  x: "M5 4l14 16M19 4 5 20",
  website: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
};

// ── Motion helpers (self-contained, same contract as the app's lib/motion.ts) ──

let moving: Animation[] = [];
const ms = (v: string, fallback: number) => (/ms$/.test(v.trim()) ? parseFloat(v) : /s$/.test(v.trim()) ? parseFloat(v) * 1000 : fallback);
const motionOff = () => document.documentElement.dataset.motion === "off" || typeof Element.prototype.animate !== "function";
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cards glide from where they were to where they are after a filter; new ones fade in. Reduced motion only fades. */
function continuity(list: HTMLElement | null, update: () => void) {
  if (!list || motionOff() || list.children.length > 24) {
    update();
    return;
  }
  const first = new Map<string, DOMRect>();
  for (const el of Array.from(list.children) as HTMLElement[]) if (el.dataset.key) first.set(el.dataset.key, el.getBoundingClientRect());
  for (const m of moving) m.cancel();
  moving = [];
  flushSync(update);
  const css = getComputedStyle(document.documentElement);
  const slow = ms(css.getPropertyValue("--duration-slow"), 320);
  const base = ms(css.getPropertyValue("--duration-base"), 200);
  const easing = css.getPropertyValue("--ease-out").trim() || "ease-out";
  const reduced = reducedMotion();
  for (const el of Array.from(list.children) as HTMLElement[]) {
    const was = el.dataset.key ? first.get(el.dataset.key) : undefined;
    if (!was) {
      moving.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: base, easing }));
      continue;
    }
    if (reduced) continue;
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    moving.push(el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: slow, easing }));
  }
}

/** Each card rises in once, the first time it scrolls into view, with a stagger the stylesheet caps. */
function useEntrance(list: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = list.current;
    if (!root || motionOff() || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      (entries) => {
        let batch = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.setProperty("--i", String(batch++));
          el.classList.remove("is-waiting");
          el.classList.add("is-entering");
          el.addEventListener("animationend", () => el.classList.remove("is-entering"), { once: true });
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of Array.from(root.children)) {
      el.classList.add("is-waiting");
      io.observe(el);
    }
    return () => {
      io.disconnect();
      for (const el of Array.from(root.children)) el.classList.remove("is-waiting");
    };
  }, [list]);
}

/** One person's card: About folds a longer bio open; Copy email reports through the directory's status line. */
function PersonCard({ p, dept, l, onCopy }: { p: TeamPerson; dept: string; l: Required<NonNullable<TeamDirectoryProps["labels"]>>; onCopy: (p: TeamPerson) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId().replace(/:/g, "");
  return (
    <article className="fl-tdir-card" aria-labelledby={`${id}-name`}>
      <Avatar name={p.name} size={72} decorative />
      <div className="fl-tdir-who">
        <h3 id={`${id}-name`}>{p.name}</h3>
        <p className="fl-tdir-role">{p.role}</p>
        <p className="fl-tdir-meta">
          {dept}
          {p.location ? ` · ${p.location}` : ""}
        </p>
      </div>
      <p className="fl-tdir-bio">{p.bio}</p>
      {p.more ? (
        <div className={`fl-tdir-more${open ? " is-open" : ""}`}>
          <div className="fl-tdir-more-body" id={`${id}-more`} inert={!open}>
            <div>
              <p>{p.more}</p>
            </div>
          </div>
          <button type="button" className="fl-tdir-toggle" aria-expanded={open} aria-controls={`${id}-more`} onClick={() => setOpen((v) => !v)}>
            {open ? l.less : l.about}
            <Icon name="chevron-down" />
          </button>
        </div>
      ) : null}
      <div className="fl-tdir-actions">
        {p.links?.length ? (
          <ul className="fl-tdir-links" aria-label={`${p.name}'s profiles`}>
            {p.links.map((k) => (
              <li key={k.kind}>
                <a className="fl-tdir-link" href={k.href} aria-label={`${p.name} on ${LINK_NAME[k.kind]}`} title={LINK_NAME[k.kind]} target="_blank" rel="noreferrer">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d={LINK_PATH[k.kind]} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {p.email ? (
          <Button variant="tertiary" size={32} icon="mail" onClick={() => onCopy(p)} aria-label={`${l.copy}: ${p.name}`}>
            {l.copy}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function TeamDirectory({ title, eyebrow, lede, departments, people, labels = {} }: TeamDirectoryProps) {
  const l = {
    search: "Search people",
    searchHint: "Name or role",
    all: "All",
    filter: "Department",
    about: "About",
    less: "Less",
    copy: "Copy email",
    copied: "Email copied:",
    copyFailed: "Couldn't copy. The address is",
    people: "people",
    person: "person",
    empty: "No one matches",
    emptyText: "Try another name, or look in every department.",
    clear: "Clear filters",
    ...labels,
  };
  const uid = useId().replace(/:/g, "");
  const [dept, setDept] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const grid = useRef<HTMLUListElement>(null);
  useEntrance(grid);

  const q = query.trim().toLowerCase();
  const inDept = (id: string) => (id === "all" ? people : people.filter((p) => p.department === id));
  const shown = inDept(dept).filter((p) => !q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q));
  const deptLabel = (id: string) => departments.find((d) => d.id === id)?.label ?? id;

  const pick = (id: string) => continuity(grid.current, () => setDept(id));
  const type = (text: string) => continuity(grid.current, () => setQuery(text));
  const clear = () => {
    continuity(grid.current, () => {
      setDept("all");
      setQuery("");
    });
    document.getElementById(`${uid}-q`)?.focus();
  };

  const copy = async (p: TeamPerson) => {
    if (!p.email) return;
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(p.email);
      setStatus(`${l.copied} ${p.email}`);
    } catch {
      setStatus(`${l.copyFailed} ${p.email}`);
    }
  };

  return (
    <div className="fl-tdir" data-fl="b.team-directory">
      <header className="fl-tdir-head">
        {eyebrow ? <p className="fl-eyebrow">{eyebrow}</p> : null}
        <h2 className="fl-title">{title}</h2>
        {lede ? <p className="fl-lede">{lede}</p> : null}
      </header>

      <div className="fl-tdir-tools" role="search">
        <div className="fl-tdir-search">
          <label htmlFor={`${uid}-q`} className="fl-sr">
            {l.search}
          </label>
          <span className="fl-tdir-search-icon" aria-hidden="true">
            <Icon name="search" />
          </span>
          <TextField
            id={`${uid}-q`}
            type="search"
            size={44}
            placeholder={`${l.search}: ${l.searchHint.toLowerCase()}`}
            value={query}
            onChange={(e) => type(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                type("");
              }
            }}
            autoComplete="off"
          />
        </div>
        <ul className="fl-tdir-chips" aria-label={l.filter}>
          {[{ id: "all", label: l.all }, ...departments].map((d) => (
            <li key={d.id}>
              <Chip variant="filter" selected={dept === d.id} onClick={() => pick(d.id)}>
                {d.label} <span className="fl-tdir-n">{inDept(d.id).length}</span>
              </Chip>
            </li>
          ))}
        </ul>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {shown.length} {shown.length === 1 ? l.person : l.people}
      </p>
      <ul className="fl-tdir-grid" ref={grid}>
        {shown.map((p) => (
          <li key={p.id} data-key={p.id} className="fl-tdir-item">
            <PersonCard p={p} dept={deptLabel(p.department)} l={l} onCopy={copy} />
          </li>
        ))}
      </ul>
      {shown.length === 0 ? (
        <EmptyState
          variant="no-results"
          title={l.empty}
          action={
            <Button variant="secondary" size={40} onClick={clear}>
              {l.clear}
            </Button>
          }
        >
          {l.emptyText}
        </EmptyState>
      ) : null}
      <p className="fl-tdir-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: TeamDirectoryProps = {
  eyebrow: "Our team",
  title: "The people behind Northlight",
  lede: "Eight of us, across three time zones. Reach out to whoever fits your question.",
  departments: [
    { id: "design", label: "Design" },
    { id: "eng", label: "Engineering" },
    { id: "growth", label: "Marketing" },
  ],
  people: [
    { id: "ana", name: "Ana Silva", role: "Design director", department: "design", location: "Lisbon", bio: "Leads product and brand design.", more: "Ana spent eight years at agencies before joining as our first designer. She runs the weekly critique and owns the design system.", email: "ana@northlight.example", links: [{ kind: "linkedin", href: "#ana-linkedin" }, { kind: "website", href: "#ana-site" }] },
    { id: "marcus", name: "Marcus Lee", role: "Lead developer", department: "eng", location: "Toronto", bio: "Keeps the app fast and the builds green.", more: "Marcus wrote the first version of the sync engine on a long weekend and has been making it boring and reliable ever since.", email: "marcus@northlight.example", links: [{ kind: "github", href: "#marcus-github" }, { kind: "linkedin", href: "#marcus-linkedin" }] },
    { id: "priya", name: "Priya Raman", role: "Product designer", department: "design", location: "Remote", bio: "Designs onboarding and billing.", email: "priya@northlight.example", links: [{ kind: "linkedin", href: "#priya-linkedin" }, { kind: "x", href: "#priya-x" }] },
    { id: "tom", name: "Tom Okafor", role: "Backend engineer", department: "eng", location: "Lagos", bio: "Works on the API and data pipeline.", more: "Before Northlight, Tom built payment systems for a regional bank. He cares about clear error messages more than anyone we know.", email: "tom@northlight.example", links: [{ kind: "github", href: "#tom-github" }] },
    { id: "jane", name: "Jane Doe", role: "Marketing lead", department: "growth", location: "Austin", bio: "Runs launches, the blog and the newsletter.", email: "jane@northlight.example", links: [{ kind: "x", href: "#jane-x" }, { kind: "linkedin", href: "#jane-linkedin" }] },
    { id: "leo", name: "Leo Martins", role: "Frontend engineer", department: "eng", location: "São Paulo", bio: "Builds the editor and its keyboard shortcuts.", email: "leo@northlight.example", links: [{ kind: "github", href: "#leo-github" }, { kind: "website", href: "#leo-site" }] },
    { id: "abigail", name: "Abigail Bennett", role: "Content designer", department: "design", location: "London", bio: "Writes the words in the product.", more: "Abigail turns error messages into sentences people understand, and keeps our help center short.", email: "abigail@northlight.example", links: [{ kind: "linkedin", href: "#abigail-linkedin" }] },
    { id: "sam", name: "Sam Rivera", role: "Growth marketer", department: "growth", location: "Mexico City", bio: "Looks after sign-ups and partnerships.", email: "sam@northlight.example", links: [{ kind: "x", href: "#sam-x" }] },
  ],
};

export default function TeamDirectoryPreview() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <TeamDirectory {...SAMPLE} />
      </div>
    </section>
  );
}
