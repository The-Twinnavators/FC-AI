/** @flowcode-library changelog-releases · Changelog with release filter (Blog)
 * Catalog ID: b.changelog (block)
 * Function: A changelog block (b.changelog): releases on a timeline, newest first, each with a version tag, a date, a title and its changes marked New, Improved or Fixed; a filter shows one kind of change, long releases fold open, each release has Copy link, and Show older loads more. Adapted from Meraki UI (MIT).
 * Use it as: import { ChangelogReleases } from "./changelog-releases"; <ChangelogReleases title eyebrow? lede? pageSize?={3} releases={[{ version, date: "2026-10-14", title, summary?, changes: [{ kind: "new"|"improved"|"fixed", text }] }]} />  // use only releases the PRD names
 * Built from: c.segmented.segmented, c.badge, c.button.secondary, c.button.tertiary, c.empty-state.no-results
 * Look: A heading over a segmented filter, then a vertical timeline: on the left a version pill and the date beside a thin rail with a dot, on the right a card with the release title, a line about it and its changes, each led by a small colored kind tag.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-success --color-warning --color-text --color-text-muted --focus-ring --radius-md --radius-lg --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-lg --duration-fast --duration-base --duration-slow --ease-out --enter-distance --stagger
 * Use cases: changelog; release notes; what's new; product updates; version history; updates page
 * Jobs to be done: see what changed in the product; find when a fix shipped; read only the new features; share a link to one release; catch up on older releases
 * Keywords: changelog, release notes, versions, updates, what's new, timeline, new, improved, fixed
 */
/**
 * Changelog: a timeline of releases. The filter (a radio group) keeps only changes of one kind and hides releases with
 * none; releases with more than four changes show four and fold the rest open (grid rows, the closed part inert).
 * Show older reveals the next page and moves focus to the first new release, so keyboard and screen-reader users land on
 * what just appeared. Copy link writes the release's address with a fallback that shows it when the clipboard is
 * blocked. Releases rise in once, staggered and capped; with motion off everything simply shows.
 * Make it the app's own: replace SAMPLE with the real releases, newest first.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa): its blog list and timeline-style card layouts.
 */
/**
 * How to try it
 * - Pick "Fixed": only fixes stay, and releases without any drop out. The count is announced.
 * - Press "Show all 6 changes" on a long release, then "Show fewer".
 * - Press Show older until it disappears; focus moves to the first release that appeared.
 * - Press Copy link on a release: the status line says it was copied (or shows the link).
 *
 * Dependencies: React (useEffect, useId, useRef, useState) and the library's own pieces and inline icon set. Nothing
 * else — no package to install and nothing fetched at run time. The styles are the fl-clog- classes in
 * templates/library/css/r2m-changelog.css.
 */
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Segmented } from "./segmented-control";

// ── b.changelog: releases on a timeline with a kind filter, folds, links and paging. ──

export type ChangeKind = "new" | "improved" | "fixed";
export type ChangelogRelease = {
  /** "2.4.0"; shown as v2.4.0 and used for the release's link. */
  version: string;
  /** ISO date, "2026-10-14". */
  date: string;
  title: string;
  summary?: string;
  changes: { kind: ChangeKind; text: string }[];
};
export type ChangelogReleasesProps = {
  title: string;
  eyebrow?: string;
  lede?: string;
  releases: ChangelogRelease[];
  /** Releases shown before Show older; 3 when left out. */
  pageSize?: number;
};

const KIND_LABEL: Record<ChangeKind, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
};
const KIND_CLASS: Record<ChangeKind, string> = {
  new: "fl-clog-kind--new",
  improved: "fl-clog-kind--improved",
  fixed: "fl-clog-kind--fixed",
};
const FOLD_AT = 4;

const motionOff = () => document.documentElement.dataset.motion === "off";
const slug = (v: string) => `v${v.replace(/[^a-z0-9]+/gi, "-")}`;
const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

/** Each release rises in once, the first time it scrolls into view. New pages get the same treatment. */
function useEntrance(list: RefObject<HTMLElement | null>, count: number) {
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
          el.classList.add("is-entering", "is-seen");
          el.addEventListener(
            "animationend",
            () => el.classList.remove("is-entering"),
            { once: true },
          );
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    for (const el of Array.from(root.children) as HTMLElement[]) {
      if (el.classList.contains("is-seen")) continue;
      el.classList.add("is-waiting");
      io.observe(el);
    }
    return () => {
      io.disconnect();
      for (const el of Array.from(root.children))
        el.classList.remove("is-waiting");
    };
  }, [list, count]);
}

function Release({
  r,
  latest,
  onCopy,
}: {
  r: ChangelogRelease & { shownChanges: ChangelogRelease["changes"] };
  latest: boolean;
  onCopy: (r: ChangelogRelease) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId().replace(/:/g, "");
  const head = r.shownChanges.slice(0, FOLD_AT);
  const rest = r.shownChanges.slice(FOLD_AT);
  const item = (c: ChangelogRelease["changes"][number], i: number) => (
    <li key={i}>
      <span className={`fl-clog-kind ${KIND_CLASS[c.kind]}`}>
        {KIND_LABEL[c.kind]}
      </span>
      <span>{c.text}</span>
    </li>
  );
  return (
    <article className="fl-clog-rel" aria-labelledby={`${id}-t`}>
      <div className="fl-clog-when">
        <span className="fl-clog-ver">v{r.version}</span>
        <time dateTime={r.date}>{fmtDate(r.date)}</time>
      </div>
      <div className="fl-clog-rail" aria-hidden="true">
        <span className="fl-clog-dot" />
      </div>
      <div className="fl-clog-card">
        <div className="fl-clog-top">
          <h3 id={`${id}-t`} tabIndex={-1} data-release={r.version}>
            {r.title}
            <span className="fl-sr">
              , version {r.version}, {fmtDate(r.date)}
            </span>
          </h3>
          {latest ? (
            <Badge tone="success" led>
              Latest
            </Badge>
          ) : null}
        </div>
        {r.summary ? <p className="fl-clog-sum">{r.summary}</p> : null}
        <ul className="fl-clog-changes">{head.map(item)}</ul>
        {rest.length ? (
          <div className={`fl-clog-more${open ? " is-open" : ""}`}>
            <div className="fl-clog-more-body" id={`${id}-more`} inert={!open}>
              <div>
                <ul className="fl-clog-changes">
                  {rest.map((c, i) => item(c, i + FOLD_AT))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
        <div className="fl-clog-actions">
          {rest.length ? (
            <button
              type="button"
              className="fl-clog-toggle"
              aria-expanded={open}
              aria-controls={`${id}-more`}
              onClick={() => setOpen((v) => !v)}
            >
              {open
                ? "Show fewer"
                : `Show all ${r.shownChanges.length} changes`}
              <Icon name="chevron-down" />
            </button>
          ) : null}
          <Button
            variant="tertiary"
            size={32}
            icon="link"
            onClick={() => onCopy(r)}
            aria-label={`Copy link to v${r.version}`}
          >
            Copy link
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ChangelogReleases({
  title,
  eyebrow,
  lede,
  releases,
  pageSize = 3,
}: ChangelogReleasesProps) {
  const [kind, setKind] = useState<"all" | ChangeKind>("all");
  const [limit, setLimit] = useState(pageSize);
  const [status, setStatus] = useState("");
  const focusNext = useRef<string | null>(null);
  const list = useRef<HTMLOListElement>(null);

  const matching = releases
    .map((r) => ({
      ...r,
      shownChanges:
        kind === "all" ? r.changes : r.changes.filter((c) => c.kind === kind),
    }))
    .filter((r) => r.shownChanges.length > 0);
  const shown = matching.slice(0, limit);
  const left = matching.length - shown.length;
  useEntrance(list, shown.length);

  useEffect(() => {
    const v = focusNext.current;
    if (!v) return;
    focusNext.current = null;
    list.current
      ?.querySelector<HTMLElement>(`[data-release="${CSS.escape(v)}"]`)
      ?.focus();
  }, [limit]);

  const showOlder = () => {
    const first = matching[limit];
    if (first) focusNext.current = first.version;
    setLimit((n) => n + pageSize);
  };

  const copy = async (r: ChangelogRelease) => {
    const url = `${location.origin}${location.pathname}${location.search}#${slug(r.version)}`;
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setStatus(`Link to v${r.version} copied.`);
    } catch {
      setStatus(`Couldn't copy. The link is ${url}`);
    }
  };

  const count = (k: "all" | ChangeKind) =>
    k === "all"
      ? releases.length
      : releases.filter((r) => r.changes.some((c) => c.kind === k)).length;

  return (
    <div className="fl-clog" data-fl="b.changelog">
      <header className="fl-clog-head">
        {eyebrow ? <p className="fl-eyebrow">{eyebrow}</p> : null}
        <h2 className="fl-title">{title}</h2>
        {lede ? <p className="fl-lede">{lede}</p> : null}
      </header>
      <div className="fl-clog-tools">
        <Segmented
          label="Show changes"
          value={kind}
          onChange={(v) => {
            setKind(v as "all" | ChangeKind);
            setLimit(pageSize);
          }}
          options={(["all", "new", "improved", "fixed"] as const).map((k) => ({
            value: k,
            label: k === "all" ? "All" : KIND_LABEL[k],
          }))}
        />
        <p className="fl-clog-count" role="status" aria-live="polite">
          {kind === "all"
            ? `${count("all")} releases`
            : `${count(kind)} ${count(kind) === 1 ? "release" : "releases"} with ${KIND_LABEL[kind].toLowerCase()} changes`}
        </p>
      </div>

      <ol className="fl-clog-list" ref={list}>
        {shown.map((r, i) => (
          <li key={r.version} id={slug(r.version)} className="fl-clog-item">
            <Release
              r={r}
              latest={i === 0 && r.version === releases[0]?.version}
              onCopy={copy}
            />
          </li>
        ))}
      </ol>
      {shown.length === 0 ? (
        <EmptyState
          variant="no-results"
          title="Nothing of that kind yet"
          headingLevel={3}
          action={
            <Button
              variant="secondary"
              size={40}
              onClick={() => {
                setKind("all");
                setTimeout(
                  () =>
                    document
                      .querySelector<HTMLInputElement>(
                        '.fl-clog-tools input[value="all"]',
                      )
                      ?.focus(),
                  0,
                );
              }}
            >
              Show all changes
            </Button>
          }
        >
          Try another filter.
        </EmptyState>
      ) : null}
      {left > 0 ? (
        <div className="fl-clog-older">
          <Button
            variant="secondary"
            size={40}
            icon="chevron-down"
            iconAt="end"
            onClick={showOlder}
          >
            Show older ({left})
          </Button>
        </div>
      ) : shown.length > pageSize ? (
        <p className="fl-clog-end">You're all caught up.</p>
      ) : null}
      <p className="fl-clog-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: ChangelogReleasesProps = {
  eyebrow: "Changelog",
  title: "What's new in Northlight",
  lede: "Every release, newest first.",
  pageSize: 3,
  releases: [
    {
      version: "3.2.0",
      date: "2026-10-14",
      title: "Shared views",
      summary: "Save a filtered view and share it with your team.",
      changes: [
        { kind: "new", text: "Save any filter as a named view." },
        { kind: "new", text: "Share views with a link or with teams." },
        { kind: "improved", text: "Filters load twice as fast on big boards." },
        { kind: "improved", text: "Keyboard shortcuts for switching views." },
        {
          kind: "fixed",
          text: "Dates no longer shift when you change time zone.",
        },
        { kind: "fixed", text: "Exports keep emoji in task titles." },
      ],
    },
    {
      version: "3.1.2",
      date: "2026-09-30",
      title: "Sync fixes",
      changes: [
        { kind: "fixed", text: "Offline edits sync in the right order." },
        { kind: "fixed", text: "The badge count clears after reading." },
      ],
    },
    {
      version: "3.1.0",
      date: "2026-09-16",
      title: "Recurring tasks",
      summary: "Tasks that come back daily, weekly or on custom days.",
      changes: [
        { kind: "new", text: "Repeat a task on any schedule." },
        { kind: "improved", text: "Clearer due-date picker." },
      ],
    },
    {
      version: "3.0.0",
      date: "2026-08-28",
      title: "A faster editor",
      summary: "We rebuilt the editor from the ground up.",
      changes: [
        { kind: "new", text: "Slash commands for blocks." },
        { kind: "improved", text: "Typing latency down 60%." },
        { kind: "improved", text: "Pasting from docs keeps headings." },
        { kind: "fixed", text: "Undo works across blocks." },
        { kind: "fixed", text: "Links in tables open correctly." },
      ],
    },
    {
      version: "2.9.4",
      date: "2026-08-05",
      title: "Calendar polish",
      changes: [
        { kind: "improved", text: "Week view shows all-day tasks on top." },
      ],
    },
    {
      version: "2.9.0",
      date: "2026-07-21",
      title: "Two-step sign-in",
      changes: [
        { kind: "new", text: "Sign in with an authenticator app." },
        { kind: "fixed", text: "Password reset links expire on use." },
      ],
    },
    {
      version: "2.8.1",
      date: "2026-07-02",
      title: "Import fixes",
      changes: [{ kind: "fixed", text: "CSV imports handle quoted commas." }],
    },
  ],
};

export default function ChangelogReleasesPreview() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <ChangelogReleases {...SAMPLE} />
      </div>
    </section>
  );
}
