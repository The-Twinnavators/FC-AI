/** @flowcode-library content-approval · Content approval (Cards)
 * Catalog ID: p.content-approval (pattern)
 * Function: Content approval (p.content-approval): pieces of content moving from Draft to In review to Approved to Published; a pipeline strip that filters by stage with counts, rows with the stage, reviewer and due date (overdue in red), and a side panel per piece with a stage stepper, reviewer and due date pickers, the next step's buttons (send for review, approve, request changes with a required note, publish and unpublish after a confirm, back to review) and its history; new drafts from a short form; loading, a load error with Retry, empty stages and every change announced.
 * Use it as: import { ContentApproval } from "./content-approval"; <ContentApproval title lede? me="Signed-in name" people={["Ana Ruiz", ...]} kinds?={["Blog post", ...]} items?={[{ id, title, kind, stage: "draft"|"review"|"approved"|"published", assignee?, due?: "2026-10-24", history: [{ id, who, at: ISO, text, kind: "moved"|"changes"|"created" }] }]} load?={async () => ContentItem[]} onChange?={(items) => ...} labels?={{ send, approve, requestChanges, publish, ... }} />
 * Built from: c.avatar.person, c.badge.status, c.text-field.outlined, c.select.outlined, c.date-field, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.form, c.modal.confirm, c.modal.danger
 * Look: A white card: the title with New draft; a strip of four stage buttons joined by chevrons, each with a count, plus All; rows with the piece's title and type, a stage pill with a signal light, the reviewer's initials and the due date; a side panel slides in with a four-step stepper, Reviewer and Due date fields, the next step's buttons, a request-changes note that unfolds, and a history list on a straight rail.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: content approval; editorial workflow; publishing workflow; marketing review; blog approvals; social post sign-off; content pipeline
 * Jobs to be done: send my draft to the right reviewer; approve a piece or send it back with what to fix; see what is waiting on me; publish only what has been approved; know what is overdue
 * Keywords: approval, workflow, review, draft, publish, editorial, sign-off, request changes, assignee, due date, content pipeline, stages
 */
/**
 * Content approval: one place to move content through review. The stage strip is a set of toggle buttons that filter
 * the rows; the rows are one tab stop with arrow keys between them (roving focus), and Enter opens the piece. The side
 * panel slides in beside the rows (below them on a narrow screen) and is inert while closed. Every step that changes
 * what the public sees (Publish, Unpublish) asks first; Request changes needs a note so the writer knows what to fix.
 * Rows glide when their stage or the filter changes (FLIP); with motion off they simply move.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its badge, avatar, progress and dialog components, and
 * Tailblocks (MIT, Copyright (c) 2020 Mert Cukuren): its step blocks.
 */
/**
 * How to try it
 * - Wait for the rows to load. Press In review in the strip: only pieces in review show. Press All.
 * - Focus a row and use the arrow keys; Enter opens it. In the panel, a draft with no reviewer can't be sent: it says
 *   why and focuses the Reviewer field. Pick one and press Send for review.
 * - On a piece in review press Request changes, then Send back with an empty note: it says why. Write a note: the
 *   piece returns to Draft with the note in its history.
 * - Approve a piece, then Publish: it asks first. Unpublish asks too.
 * - Press New draft, leave the title empty: it says why. Fill it in: the panel opens on the new draft.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Avatar, Badge, TextField,
 * Select, Button and Modal ("./avatars-variants", "./badges-status", "./text-fields-states", "./dropdowns-states",
 * "./buttons-variants", "./modals-dialogs") and its inline icon set ("./icons"). Nothing else: no package and nothing
 * fetched. The styles are the library's own fl- classes in templates/library/css/r5d-content-approval.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── p.content-approval: draft → review → approved → published, with reviewers, notes and history. ──

export type ApprovalStage = "draft" | "review" | "approved" | "published";
export type ContentEvent = { id: string; who: string; at: string; text: string; kind: "moved" | "changes" | "created" };
export type ContentItem = { id: string; title: string; kind: string; stage: ApprovalStage; assignee?: string; due?: string; history: ContentEvent[] };

export type ContentApprovalLabels = Partial<{
  newDraft: string;
  stages: string;
  all: string;
  draft: string;
  review: string;
  approved: string;
  published: string;
  pieces: string;
  unassigned: string;
  noDue: string;
  due: string;
  overdue: string;
  dueToday: string;
  close: string;
  progress: string;
  reviewer: string;
  dueDate: string;
  history: string;
  send: string;
  approve: string;
  requestChanges: string;
  note: string;
  notePlaceholder: string;
  sendBack: string;
  cancel: string;
  publish: string;
  publishTitle: string;
  publishText: string;
  unpublish: string;
  unpublishTitle: string;
  unpublishText: string;
  backToReview: string;
  title: string;
  kind: string;
  create: string;
  sentSaid: string;
  approvedSaid: string;
  changesSaid: string;
  publishedSaid: string;
  unpublishedSaid: string;
  backSaid: string;
  assignedSaid: string;
  dueSaid: string;
  createdSaid: string;
  needReviewer: string;
  needNote: string;
  needTitle: string;
  titleTooLong: string;
  loading: string;
  loadFailed: string;
  retry: string;
  empty: string;
  emptyStage: string;
  pickOne: string;
}>;

export type ContentApprovalProps = {
  title: string;
  lede?: string;
  /** The signed-in person; every step they take is recorded as theirs. */
  me: string;
  /** People who can review. */
  people: string[];
  /** Content types offered for a new draft. */
  kinds?: string[];
  /** The pieces to start with. Ignored while `load` is given. */
  items?: ContentItem[];
  /** Loads the pieces; rows show as loading until it settles, and a failure offers Retry. */
  load?: () => Promise<ContentItem[]>;
  /** Gets every piece after each change. */
  onChange?: (items: ContentItem[]) => void;
  labels?: ContentApprovalLabels;
};

const STAGES: ApprovalStage[] = ["draft", "review", "approved", "published"];
const STAGE_TONE: Record<ApprovalStage, BadgeTone> = { draft: "neutral", review: "warning", approved: "info", published: "success" };
const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];
const toneFor = (name: string) => TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const stampFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function dueInfo(due?: string) {
  if (!due) return null;
  const [y, m, d] = due.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(new Date().toDateString());
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  return { days, text: dayFmt.format(date) };
}

/** FLIP: rows marked data-flip glide from where they were to where they are whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) {
      last.current = new Map();
      return;
    }
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    const now = new Map(nodes.map((n) => [n.dataset.flip!, n.getBoundingClientRect().top]));
    if (!motionOff() && last.current.size) {
      const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
      for (const n of nodes) {
        const was = last.current.get(n.dataset.flip!);
        if (was === undefined) {
          n.animate([{ opacity: 0, translate: "0 calc(var(--enter-distance, 8px) * -1)" }, { opacity: 1, translate: "0 0" }], { duration: tokenMs("--duration-base", 200), easing: ease });
        } else if (was !== now.get(n.dataset.flip!)) {
          n.animate([{ translate: `0 ${was - now.get(n.dataset.flip!)!}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: ease });
        }
      }
    }
    last.current = now;
  }, [key, box]);
}

export function ContentApproval({ title, lede, me, people, kinds = ["Blog post", "Landing page", "Email", "Social post", "Help article"], items: initial = [], load, onChange, labels = {} }: ContentApprovalProps) {
  const l = {
    newDraft: "New draft",
    stages: "Filter by stage",
    all: "All",
    draft: "Draft",
    review: "In review",
    approved: "Approved",
    published: "Published",
    pieces: "Content",
    unassigned: "No reviewer",
    noDue: "No due date",
    due: "Due {date}",
    overdue: "Overdue · {date}",
    dueToday: "Due today",
    close: "Close",
    progress: "Progress",
    reviewer: "Reviewer",
    dueDate: "Due date",
    history: "History",
    send: "Send for review",
    approve: "Approve",
    requestChanges: "Request changes",
    note: "What needs to change",
    notePlaceholder: "e.g. The pricing line is out of date.",
    sendBack: "Send back",
    cancel: "Cancel",
    publish: "Publish",
    publishTitle: "Publish “{title}”?",
    publishText: "It goes live right away.",
    unpublish: "Unpublish",
    unpublishTitle: "Unpublish “{title}”?",
    unpublishText: "It comes down from the site and goes back to Approved.",
    backToReview: "Back to review",
    title: "Title",
    kind: "Type",
    create: "Create draft",
    sentSaid: "Sent “{title}” to {who} for review.",
    approvedSaid: "Approved “{title}”.",
    changesSaid: "Sent “{title}” back to Draft with a note.",
    publishedSaid: "Published “{title}”.",
    unpublishedSaid: "Unpublished “{title}”.",
    backSaid: "Moved “{title}” back to review.",
    assignedSaid: "Reviewer is now {who}.",
    dueSaid: "Due date set to {date}.",
    createdSaid: "Created “{title}”.",
    needReviewer: "Choose a reviewer first.",
    needNote: "Say what needs to change.",
    needTitle: "Give it a title.",
    titleTooLong: "Keep it to 80 characters.",
    loading: "Loading content…",
    loadFailed: "Couldn't load the content.",
    retry: "Retry",
    empty: "Nothing here yet",
    emptyStage: "Nothing in {stage}.",
    pickOne: "Choose a piece to see its steps.",
    ...labels,
  };
  const stageName = (s: ApprovalStage) => l[s];
  const id = useId();
  const [items, setItems] = useState<ContentItem[]>(load ? [] : initial);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(load ? "loading" : "ready");
  const [filter, setFilter] = useState<ApprovalStage | "all">("all");
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [assignErr, setAssignErr] = useState("");
  const [asking, setAsking] = useState<{ text: string; error: string } | null>(null);
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [said, setSaid] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const later = (fn: () => void, ms = 0) => window.setTimeout(fn, ms);

  const fetchItems = () => {
    if (!load) return;
    setPhase("loading");
    load()
      .then((t) => {
        setItems(t);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchItems, []);

  const shown = items.filter((i) => filter === "all" || i.stage === filter);
  const rowFocus = focusRow && shown.some((i) => i.id === focusRow) ? focusRow : shown[0]?.id ?? null;
  const piece = items.find((i) => i.id === open) ?? null;
  useFlip(listRef, `${phase}|${filter}|${shown.map((i) => `${i.id}${i.stage}`).join(",")}`);

  const event = (text: string, kind: ContentEvent["kind"] = "moved"): ContentEvent => ({ id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, who: me, at: new Date().toISOString(), text, kind });
  const update = (pid: string, change: Partial<ContentItem>, ev: ContentEvent | null, message: string) => {
    const next = items.map((i) => (i.id === pid ? { ...i, ...change, history: ev ? [ev, ...i.history] : i.history } : i));
    setItems(next);
    onChange?.(next);
    setSaid(message);
  };
  // After a step the buttons change; focus goes to the panel's heading (the live region says what happened).
  const focusStage = (ms = 30) => later(() => document.getElementById(`${id}-panel-title`)?.focus(), ms);

  const openPiece = (pid: string) => {
    setOpen(pid);
    setFocusRow(pid);
    setAsking(null);
    setAssignErr("");
    later(() => document.getElementById(`${id}-panel-title`)?.focus(), 30);
  };
  const closePanel = () => {
    const was = open;
    setOpen(null);
    setAsking(null);
    if (was) later(() => (document.getElementById(`${id}-row-${was}`) ?? document.getElementById(`${id}-new`))?.focus(), 30);
  };

  const onRowsKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!rowFocus) return;
    const i = shown.findIndex((x) => x.id === rowFocus);
    let n = -1;
    if (e.key === "ArrowDown") n = Math.min(shown.length - 1, i + 1);
    else if (e.key === "ArrowUp") n = Math.max(0, i - 1);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = shown.length - 1;
    if (n < 0) return;
    e.preventDefault();
    setFocusRow(shown[n].id);
    document.getElementById(`${id}-row-${shown[n].id}`)?.focus();
  };

  const sendForReview = (p: ContentItem) => {
    if (!p.assignee) {
      setAssignErr(l.needReviewer);
      document.getElementById(`${id}-assignee`)?.focus();
      return;
    }
    update(p.id, { stage: "review" }, event(`Sent to ${p.assignee} for review`), l.sentSaid.replace("{title}", p.title).replace("{who}", p.assignee));
    focusStage();
  };
  const approve = (p: ContentItem) => {
    update(p.id, { stage: "approved" }, event("Approved"), l.approvedSaid.replace("{title}", p.title));
    focusStage();
  };
  const sendBack = (p: ContentItem) => {
    if (!asking) return;
    const note = asking.text.trim();
    if (note.length < 3) {
      setAsking({ ...asking, error: l.needNote });
      document.getElementById(`${id}-note`)?.focus();
      return;
    }
    update(p.id, { stage: "draft" }, event(note, "changes"), l.changesSaid.replace("{title}", p.title));
    setAsking(null);
    focusStage();
  };
  const publish = (p: ContentItem) => {
    update(p.id, { stage: "published" }, event("Published"), l.publishedSaid.replace("{title}", p.title));
    focusStage(80);
  };
  const unpublish = (p: ContentItem) => {
    update(p.id, { stage: "approved" }, event("Unpublished"), l.unpublishedSaid.replace("{title}", p.title));
    focusStage(80);
  };
  const backToReview = (p: ContentItem) => {
    update(p.id, { stage: "review" }, event("Moved back to review"), l.backSaid.replace("{title}", p.title));
    focusStage();
  };

  const create = (data: FormData) => {
    const t = String(data.get("title") ?? "").trim();
    const err = !t ? l.needTitle : t.length > 80 ? l.titleTooLong : "";
    if (err) {
      setCreateErr(err);
      later(() => document.getElementById(`${id}-ctitle`)?.focus());
      return false;
    }
    const p: ContentItem = { id: `c${Date.now().toString(36)}`, title: t, kind: String(data.get("kind") || kinds[0]), stage: "draft", history: [event("Created", "created")] };
    const next = [p, ...items];
    setItems(next);
    onChange?.(next);
    setSaid(l.createdSaid.replace("{title}", t));
    setCreateErr("");
    if (filter !== "all" && filter !== "draft") setFilter("all");
    // Opens after the dialog has handed focus back.
    later(() => openPiece(p.id), 60);
    return undefined;
  };

  const counts = Object.fromEntries(STAGES.map((s) => [s, items.filter((i) => i.stage === s).length])) as Record<ApprovalStage, number>;

  return (
    <section className="fl-capr" aria-labelledby={`${id}-title`} data-fl="p.content-approval">
      <header className="fl-capr-head">
        <div className="fl-capr-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <Button id={`${id}-new`} size={40} icon="plus" disabled={phase !== "ready"} onClick={() => setCreating(true)}>
          {l.newDraft}
        </Button>
      </header>

      <div className="fl-capr-strip" role="group" aria-label={l.stages}>
        <button type="button" className="fl-capr-stagebtn fl-capr-stagebtn--all" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          <span>{l.all}</span>
          <span className="fl-capr-n">{phase === "ready" ? items.length : "–"}</span>
        </button>
        {STAGES.map((s, i) => (
          <span key={s} className="fl-capr-stagewrap">
            {i > 0 ? <Icon name="chevron-right" /> : null}
            <button type="button" className="fl-capr-stagebtn" data-stage={s} aria-pressed={filter === s} onClick={() => setFilter(filter === s ? "all" : s)}>
              <span>{stageName(s)}</span>
              <span className="fl-capr-n">{phase === "ready" ? counts[s] : "–"}</span>
            </button>
          </span>
        ))}
      </div>

      <div className={["fl-capr-body", piece ? "has-panel" : ""].filter(Boolean).join(" ")}>
        <div className="fl-capr-listcol">
          {phase === "loading" ? (
            <ul className="fl-capr-list" aria-busy="true" aria-label={l.loading}>
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="fl-capr-skel" aria-hidden="true" />
              ))}
            </ul>
          ) : phase === "error" ? (
            <div className="fl-capr-empty" role="alert">
              <Icon name="alert" />
              <p className="fl-capr-empty-title">{l.loadFailed}</p>
              <Button variant="secondary" size={40} icon="refresh" onClick={fetchItems}>
                {l.retry}
              </Button>
            </div>
          ) : !shown.length ? (
            <div className="fl-capr-empty">
              <Icon name="layers" />
              <p className="fl-capr-empty-title">{filter === "all" ? l.empty : l.emptyStage.replace("{stage}", stageName(filter))}</p>
              {filter !== "all" ? (
                <Button variant="tertiary" size={32} onClick={() => setFilter("all")}>
                  {l.all}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="fl-capr-list" ref={listRef} aria-label={filter === "all" ? l.pieces : `${l.pieces}: ${stageName(filter)}`} onKeyDown={onRowsKey}>
              {shown.map((p) => {
                const due = dueInfo(p.due);
                const late = due && due.days < 0 && p.stage !== "published";
                return (
                  <li key={p.id} data-flip={p.id}>
                    <button
                      id={`${id}-row-${p.id}`}
                      type="button"
                      className="fl-capr-row"
                      aria-current={open === p.id ? "true" : undefined}
                      tabIndex={p.id === rowFocus ? 0 : -1}
                      onFocus={() => setFocusRow(p.id)}
                      onClick={() => openPiece(p.id)}
                    >
                      <span className="fl-capr-rowmain">
                        <span className="fl-capr-rowtitle">{p.title}</span>
                        <span className="fl-capr-rowkind">{p.kind}</span>
                      </span>
                      <Badge tone={STAGE_TONE[p.stage]} led pulse={p.stage === "review"}>
                        {stageName(p.stage)}
                      </Badge>
                      <span className="fl-capr-who">
                        {p.assignee ? <Avatar name={p.assignee} size={24} tone={toneFor(p.assignee)} decorative /> : <span className="fl-capr-nobody" aria-hidden="true" />}
                        <span className="fl-sr">{p.assignee ? `${l.reviewer}: ${p.assignee}` : l.unassigned}</span>
                      </span>
                      <span className={["fl-capr-due", late ? "is-late" : ""].filter(Boolean).join(" ")}>
                        {!due ? l.noDue : late ? l.overdue.replace("{date}", due.text) : due.days === 0 ? l.dueToday : l.due.replace("{date}", due.text)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className={["fl-capr-panel", piece ? "is-open" : ""].filter(Boolean).join(" ")} inert={!piece || undefined} aria-labelledby={`${id}-panel-title`}>
          {piece ? (
            <div className="fl-capr-panel-in">
              <div className="fl-capr-panelhead">
                <div>
                  <h3 id={`${id}-panel-title`} tabIndex={-1}>
                    {piece.title}
                  </h3>
                  <p>{piece.kind}</p>
                </div>
                <Button variant="tertiary" size={32} icon="close" iconOnly onClick={closePanel}>
                  {l.close}
                </Button>
              </div>

              <ol className="fl-capr-steps" aria-label={l.progress}>
                {STAGES.map((s, i) => {
                  const at = STAGES.indexOf(piece.stage);
                  return (
                    <li key={s} className={i < at ? "is-done" : i === at ? "is-now" : undefined} aria-current={i === at ? "step" : undefined}>
                      <span className="fl-capr-stepdot" aria-hidden="true">
                        {i < at ? <Icon name="check" /> : i + 1}
                      </span>
                      <span className="fl-capr-steplabel">{stageName(s)}</span>
                    </li>
                  );
                })}
              </ol>

              <div className="fl-capr-fields">
                <div className="fl-capr-field">
                  <label htmlFor={`${id}-assignee`}>{l.reviewer}</label>
                  <Select
                    id={`${id}-assignee`}
                    value={piece.assignee ?? ""}
                    invalid={Boolean(assignErr)}
                    aria-describedby={assignErr ? `${id}-assignee-err` : undefined}
                    onChange={(e) => {
                      const who = e.currentTarget.value;
                      setAssignErr("");
                      update(piece.id, { assignee: who || undefined }, event(who ? `Reviewer set to ${who}` : "Reviewer removed"), who ? l.assignedSaid.replace("{who}", who) : l.unassigned);
                    }}
                    options={[{ value: "", label: l.unassigned }, ...people.map((p) => ({ value: p, label: p }))]}
                  />
                  {assignErr ? (
                    <p id={`${id}-assignee-err`} className="fl-capr-error" role="alert">
                      <Icon name="alert" />
                      {assignErr}
                    </p>
                  ) : null}
                </div>
                <div className="fl-capr-field">
                  <label htmlFor={`${id}-due`}>{l.dueDate}</label>
                  <input
                    id={`${id}-due`}
                    type="date"
                    className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40"
                    data-fl="c.date-field"
                    value={piece.due ?? ""}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      update(piece.id, { due: v || undefined }, null, v ? l.dueSaid.replace("{date}", dueInfo(v)!.text) : l.noDue);
                    }}
                  />
                </div>
              </div>

              <div className="fl-capr-next">
                {piece.stage === "draft" ? (
                  <Button size={40} icon="send" onClick={() => sendForReview(piece)}>
                    {l.send}
                  </Button>
                ) : piece.stage === "review" ? (
                  <>
                    <Button size={40} icon="check" onClick={() => approve(piece)}>
                      {l.approve}
                    </Button>
                    <Button
                      id={`${id}-ask`}
                      variant="secondary"
                      size={40}
                      icon="pencil"
                      aria-expanded={Boolean(asking)}
                      aria-controls={`${id}-askbox`}
                      onClick={() => {
                        if (asking) setAsking(null);
                        else {
                          setAsking({ text: "", error: "" });
                          later(() => document.getElementById(`${id}-note`)?.focus(), 30);
                        }
                      }}
                    >
                      {l.requestChanges}
                    </Button>
                  </>
                ) : piece.stage === "approved" ? (
                  <>
                    <Button size={40} icon="globe" onClick={() => setConfirm("publish")}>
                      {l.publish}
                    </Button>
                    <Button variant="secondary" size={40} onClick={() => backToReview(piece)}>
                      {l.backToReview}
                    </Button>
                  </>
                ) : (
                  <Button variant="destructive" size={40} icon="eye-off" onClick={() => setConfirm("unpublish")}>
                    {l.unpublish}
                  </Button>
                )}
              </div>

              <div id={`${id}-askbox`} className={["fl-capr-ask", asking && piece.stage === "review" ? "is-open" : ""].filter(Boolean).join(" ")} inert={!asking || piece.stage !== "review" || undefined}>
                <div>
                  <div className="fl-capr-field">
                    <label htmlFor={`${id}-note`}>{l.note}</label>
                    <TextField
                      id={`${id}-note`}
                      multiline
                      autoGrow
                      rows={2}
                      placeholder={l.notePlaceholder}
                      value={asking?.text ?? ""}
                      invalid={Boolean(asking?.error)}
                      aria-describedby={asking?.error ? `${id}-note-err` : undefined}
                      onChange={(e) => setAsking({ text: e.currentTarget.value, error: "" })}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setAsking(null);
                          later(() => document.getElementById(`${id}-ask`)?.focus());
                        }
                      }}
                    />
                    {asking?.error ? (
                      <p id={`${id}-note-err`} className="fl-capr-error" role="alert">
                        <Icon name="alert" />
                        {asking.error}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-capr-next">
                    <Button size={32} onClick={() => sendBack(piece)}>
                      {l.sendBack}
                    </Button>
                    <Button variant="tertiary" size={32} onClick={() => {
                        setAsking(null);
                        later(() => document.getElementById(`${id}-ask`)?.focus());
                      }}>
                      {l.cancel}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="fl-capr-history">
                <h4>{l.history}</h4>
                <ol>
                  {piece.history.map((h) => (
                    <li key={h.id} className={`is-${h.kind}`} data-flip={h.id}>
                      <span className="fl-capr-hwho">
                        <strong>{h.who}</strong>
                        <time dateTime={h.at}>{stampFmt.format(new Date(h.at))}</time>
                      </span>
                      <span className={h.kind === "changes" ? "fl-capr-hnote" : "fl-capr-htext"}>{h.kind === "changes" ? `“${h.text}”` : h.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <p className="fl-capr-none">{l.pickOne}</p>
          )}
        </aside>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {confirm && piece ? (
        <Modal
          variant={confirm === "publish" ? "confirm" : "danger"}
          icon={confirm === "publish" ? "globe" : "eye-off"}
          title={(confirm === "publish" ? l.publishTitle : l.unpublishTitle).replace("{title}", piece.title)}
          description={confirm === "publish" ? l.publishText : l.unpublishText}
          confirmLabel={confirm === "publish" ? l.publish : l.unpublish}
          onConfirm={() => (confirm === "publish" ? publish(piece) : unpublish(piece))}
          onClose={() => setConfirm(null)}
        />
      ) : null}

      {creating ? (
        <Modal
          variant="form"
          title={l.newDraft}
          confirmLabel={l.create}
          onConfirm={create}
          onClose={() => {
            setCreating(false);
            setCreateErr("");
          }}
        >
          <div className="fl-capr-field">
            <label htmlFor={`${id}-ctitle`}>{l.title}</label>
            <TextField
              id={`${id}-ctitle`}
              name="title"
              size={40}
              placeholder="e.g. Winter sale announcement"
              invalid={Boolean(createErr)}
              aria-describedby={createErr ? `${id}-ctitle-err` : undefined}
              onChange={() => setCreateErr("")}
            />
            {createErr ? (
              <p id={`${id}-ctitle-err`} className="fl-capr-error" role="alert">
                <Icon name="alert" />
                {createErr}
              </p>
            ) : null}
          </div>
          <div className="fl-capr-field">
            <label htmlFor={`${id}-ckind`}>{l.kind}</label>
            <Select id={`${id}-ckind`} name="kind" defaultValue={kinds[0]} options={kinds} />
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

const ago = (hours: number) => new Date(Date.now() - hours * 3600000).toISOString();
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

// flowcode:sample
const SAMPLE = {
  title: "Content approvals",
  lede: "Everything on its way to the site, and who it's waiting on.",
  me: "Ana Ruiz",
  people: ["Ana Ruiz", "Sam Okafor", "Priya Shah", "Leo Brandt"],
  items: [
    { id: "c1", title: "Meet the new Planner", kind: "Blog post", stage: "review", assignee: "Priya Shah", due: inDays(2), history: [{ id: "h1", who: "Ana Ruiz", at: ago(5), text: "Sent to Priya Shah for review", kind: "moved" }, { id: "h2", who: "Ana Ruiz", at: ago(30), text: "Created", kind: "created" }] },
    { id: "c2", title: "Autumn sale landing page", kind: "Landing page", stage: "draft", due: inDays(-1), history: [{ id: "h3", who: "Sam Okafor", at: ago(20), text: "Tighten the headline and cut the second offer.", kind: "changes" }, { id: "h4", who: "Leo Brandt", at: ago(70), text: "Created", kind: "created" }] },
    { id: "c3", title: "October product newsletter", kind: "Email", stage: "approved", assignee: "Sam Okafor", due: inDays(0), history: [{ id: "h5", who: "Sam Okafor", at: ago(2), text: "Approved", kind: "moved" }, { id: "h6", who: "Priya Shah", at: ago(26), text: "Created", kind: "created" }] },
    { id: "c4", title: "How to share a list", kind: "Help article", stage: "published", assignee: "Leo Brandt", due: inDays(-6), history: [{ id: "h7", who: "Ana Ruiz", at: ago(140), text: "Published", kind: "moved" }, { id: "h8", who: "Ana Ruiz", at: ago(200), text: "Created", kind: "created" }] },
    { id: "c5", title: "Planner launch thread", kind: "Social post", stage: "review", assignee: "Ana Ruiz", due: inDays(1), history: [{ id: "h9", who: "Leo Brandt", at: ago(8), text: "Sent to Ana Ruiz for review", kind: "moved" }, { id: "h10", who: "Leo Brandt", at: ago(12), text: "Created", kind: "created" }] },
    { id: "c6", title: "Pricing page refresh", kind: "Landing page", stage: "draft", assignee: "Sam Okafor", due: inDays(9), history: [{ id: "h11", who: "Priya Shah", at: ago(3), text: "Created", kind: "created" }] },
  ] as ContentItem[],
};

export default function ContentApprovalSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ContentApproval title={SAMPLE.title} lede={SAMPLE.lede} me={SAMPLE.me} people={SAMPLE.people} load={() => new Promise((r) => window.setTimeout(() => r(SAMPLE.items), 700))} />
      </div>
    </section>
  );
}
