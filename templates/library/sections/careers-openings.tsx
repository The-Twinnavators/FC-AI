/** @flowcode-library careers-openings · Careers: open roles with filters (Team)
 * Catalog ID: b.careers (block)
 * Function: A careers block (b.careers): open roles filtered by department chips, a location select and a search, each role a row that folds open to what the job is and who fits, with Apply opening a short validated form; applied roles are marked and a no-results state clears the filters. Adapted from Meraki UI (MIT).
 * Use it as: import { CareersOpenings } from "./careers-openings"; <CareersOpenings title eyebrow? lede? departments={[{ id, label }]} roles={[{ id, title, department, location, type, remote?, pay?, summary, duties: [], needs: [] }]} onApply?={(role, data) => Promise<void>} />  // use only roles the PRD names
 * Built from: c.chip.filter, c.text-field.outlined, c.select.outlined, c.badge, c.button.primary, c.button.secondary, c.modal.form, c.empty-state.no-results
 * Look: A centered heading over a search, a location select and department chips with counts, then a stack of bordered role rows: the title, department, place and type tags, and a chevron; a row folds open to a summary, two short lists and Apply.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-text --color-text-muted --color-danger --color-success --focus-ring --radius-md --radius-lg --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-lg --duration-fast --duration-base --duration-slow --ease-out --enter-distance --stagger
 * Use cases: careers page; jobs page; open positions; join us; hiring; job board; work with us
 * Jobs to be done: find a job that fits me; see which teams are hiring; filter roles by location; read what a role involves; apply for a role
 * Keywords: careers, jobs, hiring, open roles, positions, departments, location, apply, recruiting
 */
/**
 * Careers: department chips, a location select and a search over a list of open roles. Each role is a heading with a
 * disclosure button (WAI-ARIA disclosure pattern); its details fold open with grid rows and stay inert while closed.
 * Filtering glides the rows that stay to their new places (FLIP) and fades new ones in; rows rise in once on first view.
 * Apply opens a form dialog with name, email and an optional link, checked on submit; the first wrong field takes focus
 * and says why. While it sends, the dialog shows a busy button; a failure keeps the dialog open with the reason.
 * Make it the app's own: replace SAMPLE with the real roles the PRD names and pass onApply to send applications.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa): its team and feature list layouts.
 */
/**
 * How to try it
 * - Pick "Engineering", then choose "Lisbon" in the location select: the list narrows and the count is announced.
 * - Type "zzz" in the search for the empty state, then press Clear filters.
 * - Open a role with its title (Enter or Space), press Apply, submit empty to see the errors, then fill it in and send.
 *   The role is then marked Applied. An email ending in "@fail.test" shows the error state.
 *
 * Dependencies: React (useEffect, useId, useRef, useState, flushSync from react-dom) and the library's own pieces and
 * inline icon set. Nothing else — no package to install and nothing fetched at run time. The styles are the
 * fl-car- classes in templates/library/css/r2m-careers.css.
 */
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { Select } from "./dropdowns-states";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── b.careers: open roles with department, location and search filters, a fold per role and an apply form. ──

export type CareersDepartment = { id: string; label: string };
export type CareersRole = {
  id: string;
  title: string;
  /** A department id. */
  department: string;
  location: string;
  /** "Full-time", "Part-time", "Contract"... */
  type: string;
  remote?: boolean;
  /** Pay range as written, such as "$120k–$150k". */
  pay?: string;
  summary: string;
  duties: string[];
  needs: string[];
};
export type CareersApplication = {
  name: string;
  email: string;
  link: string;
  note: string;
};

export type CareersOpeningsProps = {
  title: string;
  eyebrow?: string;
  lede?: string;
  departments: CareersDepartment[];
  roles: CareersRole[];
  /** Sends an application; reject with an Error to show its message. Resolves after a short pause when left out. */
  onApply?: (role: CareersRole, data: CareersApplication) => Promise<void>;
};

// ── Motion helpers (self-contained, same contract as the app's lib/motion.ts) ──

let moving: Animation[] = [];
const ms = (v: string, fallback: number) =>
  /ms$/.test(v.trim())
    ? parseFloat(v)
    : /s$/.test(v.trim())
      ? parseFloat(v) * 1000
      : fallback;
const motionOff = () =>
  document.documentElement.dataset.motion === "off" ||
  typeof Element.prototype.animate !== "function";
const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Rows glide from where they were to where they are after a filter; new ones fade in. Reduced motion only fades. */
function continuity(list: HTMLElement | null, update: () => void) {
  if (!list || motionOff() || list.children.length > 30) {
    update();
    return;
  }
  const first = new Map<string, DOMRect>();
  for (const el of Array.from(list.children) as HTMLElement[])
    if (el.dataset.key) first.set(el.dataset.key, el.getBoundingClientRect());
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
      moving.push(
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: base,
          easing,
        }),
      );
      continue;
    }
    if (reduced) continue;
    const dy = was.top - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    moving.push(
      el.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], {
        duration: slow,
        easing,
      }),
    );
  }
}

/** Each row rises in once, the first time it scrolls into view, with a stagger the stylesheet caps. */
function useEntrance(list: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = list.current;
    if (!root || motionOff() || typeof IntersectionObserver !== "function")
      return;
    const io = new IntersectionObserver(
      (entries) => {
        let batch = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.setProperty("--i", String(batch++));
          el.classList.remove("is-waiting");
          el.classList.add("is-entering");
          el.addEventListener(
            "animationend",
            () => el.classList.remove("is-entering"),
            { once: true },
          );
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
      for (const el of Array.from(root.children))
        el.classList.remove("is-waiting");
    };
  }, [list]);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const wait = (n: number) => new Promise<void>((r) => setTimeout(r, n));
const defaultApply = async (_role: CareersRole, data: CareersApplication) => {
  await wait(700);
  if (/@fail\.test$/i.test(data.email))
    throw new Error(
      "We couldn't send it. Check your connection and try again.",
    );
};

/** One role: a heading whose button folds the details open (closed details are inert). */
function RoleRow({
  r,
  dept,
  applied,
  onApply,
}: {
  r: CareersRole;
  dept: string;
  applied: boolean;
  onApply: (r: CareersRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId().replace(/:/g, "");
  return (
    <article
      className={`fl-car-role${open ? " is-open" : ""}`}
      aria-labelledby={`${id}-t`}
    >
      <h3 className="fl-car-role-h">
        <button
          type="button"
          className="fl-car-role-btn"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="fl-car-role-main">
            <span className="fl-car-role-title" id={`${id}-t`}>
              {r.title}
            </span>
            <span className="fl-car-role-meta">
              <span>{dept}</span>
              <span aria-hidden="true">·</span>
              <span className="fl-car-ico">
                <Icon name="pin" />
                {r.location}
              </span>
              {r.pay ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{r.pay}</span>
                </>
              ) : null}
            </span>
          </span>
          <span className="fl-car-role-tags">
            {applied ? (
              <Badge tone="success" led>
                Applied
              </Badge>
            ) : null}
            <Badge tone="neutral">{r.type}</Badge>
            {r.remote ? <Badge tone="info">Remote</Badge> : null}
          </span>
          <span className="fl-car-chev" aria-hidden="true">
            <Icon name="chevron-down" />
          </span>
        </button>
      </h3>
      <div className="fl-car-body" id={`${id}-body`} inert={!open}>
        <div>
          <div className="fl-car-body-in">
            <p className="fl-car-summary">{r.summary}</p>
            <div className="fl-car-lists">
              <div>
                <h4>What you'll do</h4>
                <ul>
                  {r.duties.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>What you bring</h4>
                <ul>
                  {r.needs.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="fl-car-cta">
              <Button
                variant={applied ? "secondary" : "primary"}
                size={40}
                icon={applied ? "check" : "send"}
                onClick={() => onApply(r)}
                aria-label={`${applied ? "Apply again" : "Apply"}: ${r.title}`}
              >
                {applied ? "Apply again" : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

type Errors = Partial<Record<keyof CareersApplication | "form", string>>;

export function CareersOpenings({
  title,
  eyebrow,
  lede,
  departments,
  roles,
  onApply = defaultApply,
}: CareersOpeningsProps) {
  const uid = useId().replace(/:/g, "");
  const [dept, setDept] = useState("all");
  const [place, setPlace] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [applyFor, setApplyFor] = useState<CareersRole | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);
  const list = useRef<HTMLUListElement>(null);
  useEntrance(list);

  const places = Array.from(new Set(roles.map((r) => r.location))).sort();
  const q = query.trim().toLowerCase();
  const matchOthers = (r: CareersRole) =>
    (place === "all" || r.location === place) &&
    (!q ||
      r.title.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q));
  const countIn = (id: string) =>
    roles.filter((r) => (id === "all" || r.department === id) && matchOthers(r))
      .length;
  const shown = roles.filter(
    (r) => (dept === "all" || r.department === dept) && matchOthers(r),
  );
  const deptLabel = (id: string) =>
    departments.find((d) => d.id === id)?.label ?? id;

  const change = (fn: () => void) => continuity(list.current, fn);
  const clear = () => {
    change(() => {
      setDept("all");
      setPlace("all");
      setQuery("");
    });
    document.getElementById(`${uid}-q`)?.focus();
  };

  const openApply = (r: CareersRole) => {
    setErrors({});
    setApplyFor(r);
  };

  const submit = (data: FormData): false => {
    if (!applyFor || busy) return false;
    const app: CareersApplication = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      link: String(data.get("link") ?? "").trim(),
      note: String(data.get("note") ?? "").trim(),
    };
    const next: Errors = {};
    if (!app.name) next.name = "Enter your name.";
    if (!app.email) next.email = "Enter your email.";
    else if (!EMAIL.test(app.email))
      next.email = "Enter an email like name@example.com.";
    if (app.link && !/^https?:\/\/\S+\.\S+/.test(app.link))
      next.link = "Start the link with https://";
    setErrors(next);
    const firstBad = (["name", "email", "link"] as const).find((k) => next[k]);
    if (firstBad) {
      setTimeout(
        () => document.getElementById(`${uid}-${firstBad}`)?.focus(),
        0,
      );
      return false;
    }
    const role = applyFor;
    setBusy(true);
    onApply(role, app)
      .then(() => {
        setApplied((a) => (a.includes(role.id) ? a : [...a, role.id]));
        setApplyFor(null);
        setStatus(`Application sent for ${role.title}. We'll reply by email.`);
      })
      .catch((err: unknown) => {
        setErrors({
          form:
            err instanceof Error
              ? err.message
              : "Something went wrong. Try again.",
        });
        setTimeout(() => document.getElementById(`${uid}-formerr`)?.focus(), 0);
      })
      .finally(() => setBusy(false));
    return false;
  };

  const fieldErr = (k: keyof CareersApplication) =>
    errors[k] ? (
      <p className="fl-car-err" id={`${uid}-${k}-err`}>
        <Icon name="alert" />
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="fl-car" data-fl="b.careers">
      <header className="fl-car-head">
        {eyebrow ? <p className="fl-eyebrow">{eyebrow}</p> : null}
        <h2 className="fl-title">{title}</h2>
        {lede ? <p className="fl-lede">{lede}</p> : null}
      </header>

      <div className="fl-car-tools" role="search" aria-label="Filter roles">
        <div className="fl-car-row">
          <div className="fl-car-search">
            <label htmlFor={`${uid}-q`} className="fl-sr">
              Search roles
            </label>
            <span className="fl-car-search-icon" aria-hidden="true">
              <Icon name="search" />
            </span>
            <TextField
              id={`${uid}-q`}
              type="search"
              size={44}
              placeholder="Search roles"
              value={query}
              autoComplete="off"
              onChange={(e) => {
                const v = e.target.value;
                change(() => setQuery(v));
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.preventDefault();
                  change(() => setQuery(""));
                }
              }}
            />
          </div>
          <div className="fl-car-place">
            <label htmlFor={`${uid}-loc`} className="fl-sr">
              Location
            </label>
            <Select
              id={`${uid}-loc`}
              value={place}
              options={[
                { value: "all", label: "All locations" },
                ...places.map((p) => ({ value: p, label: p })),
              ]}
              onChange={(e) => {
                const v = e.target.value;
                change(() => setPlace(v));
              }}
            />
          </div>
        </div>
        <ul className="fl-car-chips" aria-label="Department">
          {[{ id: "all", label: "All" }, ...departments].map((d) => (
            <li key={d.id}>
              <Chip
                variant="filter"
                selected={dept === d.id}
                onClick={() => change(() => setDept(d.id))}
              >
                {d.label} <span className="fl-car-n">{countIn(d.id)}</span>
              </Chip>
            </li>
          ))}
        </ul>
      </div>

      <p className="fl-car-count" role="status" aria-live="polite">
        {shown.length} open {shown.length === 1 ? "role" : "roles"}
      </p>
      <ul className="fl-car-list" ref={list}>
        {shown.map((r) => (
          <li key={r.id} data-key={r.id} className="fl-car-item">
            <RoleRow
              r={r}
              dept={deptLabel(r.department)}
              applied={applied.includes(r.id)}
              onApply={openApply}
            />
          </li>
        ))}
      </ul>
      {shown.length === 0 ? (
        <EmptyState
          variant="no-results"
          title="No roles match"
          headingLevel={3}
          action={
            <Button variant="secondary" size={40} onClick={clear}>
              Clear filters
            </Button>
          }
        >
          Try another team or location.
        </EmptyState>
      ) : null}
      <p className="fl-car-status" role="status" aria-live="polite">
        {status}
      </p>

      {applyFor ? (
        <Modal
          variant="form"
          title={`Apply: ${applyFor.title}`}
          description={`${deptLabel(applyFor.department)} · ${applyFor.location}`}
          confirmLabel="Send application"
          busy={busy}
          busyLabel="Sending..."
          onConfirm={submit}
          onClose={() => {
            if (!busy) setApplyFor(null);
          }}
        >
          <div className="fl-car-form">
            {errors.form ? (
              <p
                className="fl-car-formerr"
                role="alert"
                id={`${uid}-formerr`}
                tabIndex={-1}
              >
                <Icon name="alert" />
                {errors.form}
              </p>
            ) : null}
            <div className="fl-field">
              <label htmlFor={`${uid}-name`}>Name</label>
              <TextField
                id={`${uid}-name`}
                name="name"
                onInput={() =>
                  setErrors((e) => (e.name ? { ...e, name: undefined } : e))
                }
                autoComplete="name"
                invalid={!!errors.name}
                aria-describedby={errors.name ? `${uid}-name-err` : undefined}
                data-autofocus
              />
              {fieldErr("name")}
            </div>
            <div className="fl-field">
              <label htmlFor={`${uid}-email`}>Email</label>
              <TextField
                id={`${uid}-email`}
                name="email"
                onInput={() =>
                  setErrors((e) => (e.email ? { ...e, email: undefined } : e))
                }
                type="email"
                autoComplete="email"
                invalid={!!errors.email}
                aria-describedby={errors.email ? `${uid}-email-err` : undefined}
              />
              {fieldErr("email")}
            </div>
            <div className="fl-field">
              <label htmlFor={`${uid}-link`}>
                Portfolio or LinkedIn{" "}
                <span className="fl-car-opt">Optional</span>
              </label>
              <TextField
                id={`${uid}-link`}
                name="link"
                onInput={() =>
                  setErrors((e) => (e.link ? { ...e, link: undefined } : e))
                }
                type="url"
                inputMode="url"
                placeholder="https://"
                invalid={!!errors.link}
                aria-describedby={errors.link ? `${uid}-link-err` : undefined}
              />
              {fieldErr("link")}
            </div>
            <div className="fl-field">
              <label htmlFor={`${uid}-note`}>
                Note <span className="fl-car-opt">Optional</span>
              </label>
              <TextField
                id={`${uid}-note`}
                name="note"
                multiline
                autoGrow
                rows={3}
                maxLength={600}
              />
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE: CareersOpeningsProps = {
  eyebrow: "Careers",
  title: "Build Northlight with us",
  lede: "Small teams, real ownership, and four-day weeks in summer.",
  departments: [
    { id: "eng", label: "Engineering" },
    { id: "design", label: "Design" },
    { id: "sales", label: "Sales" },
    { id: "support", label: "Support" },
  ],
  roles: [
    {
      id: "fe",
      title: "Senior frontend engineer",
      department: "eng",
      location: "Lisbon",
      type: "Full-time",
      remote: true,
      pay: "€70k–€90k",
      summary:
        "Own the editor: its speed, its keyboard shortcuts and how it feels on a slow laptop.",
      duties: [
        "Ship editor features end to end",
        "Keep load time under one second",
        "Review code and pair with designers",
      ],
      needs: [
        "5+ years building web apps",
        "Deep React and TypeScript",
        "Care for accessibility",
      ],
    },
    {
      id: "be",
      title: "Backend engineer, sync",
      department: "eng",
      location: "Toronto",
      type: "Full-time",
      pay: "$140k–$170k CAD",
      summary:
        "Work on the sync engine that keeps every device up to date, even offline.",
      duties: [
        "Design conflict-free data flows",
        "Run and tune Postgres at scale",
        "Join the on-call rotation, one week in six",
      ],
      needs: [
        "Experience with distributed systems",
        "Go or Rust",
        "Calm under incidents",
      ],
    },
    {
      id: "sre",
      title: "Site reliability engineer",
      department: "eng",
      location: "Remote",
      type: "Contract",
      remote: true,
      summary: "Help us move to a second region and make deploys boring.",
      duties: ["Plan the multi-region rollout", "Improve alerts and runbooks"],
      needs: ["Terraform and Kubernetes", "Clear written updates"],
    },
    {
      id: "pd",
      title: "Product designer",
      department: "design",
      location: "Lisbon",
      type: "Full-time",
      pay: "€55k–€70k",
      summary:
        "Design onboarding and billing, from research calls to shipped screens.",
      duties: [
        "Run interviews with new customers",
        "Prototype and test flows",
        "Grow the design system",
      ],
      needs: [
        "A portfolio of shipped product work",
        "Comfort with numbers and pricing",
      ],
    },
    {
      id: "ae",
      title: "Account executive",
      department: "sales",
      location: "Austin",
      type: "Full-time",
      pay: "$90k base + commission",
      summary: "Guide teams of 50 to 500 from first call to signed plan.",
      duties: ["Run demos and trials", "Work with support on handoffs"],
      needs: ["2+ years selling software", "Plain, honest communication"],
    },
    {
      id: "cs",
      title: "Support specialist",
      department: "support",
      location: "Toronto",
      type: "Part-time",
      summary:
        "Answer customers by email and chat, and turn patterns into fixes.",
      duties: ["Reply within four hours", "Write and update help articles"],
      needs: ["Patience and clear writing", "French is a plus"],
    },
  ],
};

export default function CareersOpeningsPreview() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <CareersOpenings {...SAMPLE} />
      </div>
    </section>
  );
}
