/** @flowcode-library version-history · Version history (Charts and data)
 * Catalog ID: p.version-history (pattern)
 * Function: Version history (p.version-history): every saved version of a piece of writing, newest first, with who saved it and when; read any version, compare it with another as added and removed lines (unified or side by side), name a version, restore an older one after a confirm (the current text is kept as its own version), and edit the current text to save a new version with a note; a Named only filter, checks for an empty or taken name and a save with no changes, loading, a load error with Retry, empty states and every change announced.
 * Use it as: import { VersionHistory } from "./version-history"; <VersionHistory title lede? me="Signed-in name" versions?={[{ id, at: ISO, author, name?, note?, text }]} load?={async () => Version[]} onChange?={(versions) => ...} labels?={{ read, compare, edit, restore, name, ... }} />
 * Built from: p.diff, c.avatar.person, c.badge.status, c.checkbox, c.text-field.outlined, c.select.outlined, c.segmented.segmented, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.confirm
 * Look: A white card: the title with a version count and a Named only checkbox; at the left a timeline list of versions (a dot on a straight rail, the date and time, the author's initials, a name pill, a one-line note, a Current pill on the newest); at the right the chosen version's heading with Read / Compare / Edit, then the text on a sunken sheet, the diff panel with a Compare with picker, or the editor with a note field and Save version.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: version history; document history; page revisions; draft history; policy changes; template versions; content audit
 * Jobs to be done: see who changed the text and when; compare two versions line by line; get back the wording we had last week without losing today's; mark the version we sent to the client; save my edits as a new version with a note
 * Keywords: version history, revisions, compare, diff, restore, rollback, named version, changes, audit, editor
 */
/**
 * Version history: the saved versions of one text. The list is a listbox (arrow keys, Home and End move the choice,
 * which shows at the right). Restoring never throws anything away: the restored words become a new version on top.
 * Compare always puts the older version first, so additions read as additions. The list glides when a version is added
 * or the filter changes (FLIP); the views fade in; with motion off they simply appear.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its list, badge, tabs and alert dialog components, and
 * Meraki UI (MIT, Copyright (c) 2021 Khatab Wedaa): its tables and avatar components.
 */
/**
 * How to try it
 * - Wait for the versions to load. Use the arrow keys in the list: the right side follows.
 * - Pick "Sent to client" and press Compare: the changes since then show as added and removed lines. Pick another
 *   version in Compare with.
 * - Press Restore this version and confirm: a new version tops the list with those words; the old current is kept.
 * - Choose the newest version, press Edit, save without changes: it says nothing changed. Change a line, add a note,
 *   Save version.
 * - Press Name on a version and save an empty or taken name: it says why. Tick Named only.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Diff, Avatar, Badge,
 * Checkbox, TextField, Select, Segmented, Button and Modal ("./data-diff", "./avatars-variants", "./badges-status",
 * "./checkboxes-radios", "./text-fields-states", "./dropdowns-states", "./segmented-control", "./buttons-variants",
 * "./modals-dialogs") and its inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles
 * are the library's own fl- classes in templates/library/css/r5d-version-history.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Diff } from "./data-diff";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.version-history: read, compare, name, restore and save versions of a text. ──

export type Version = { id: string; at: string; author: string; name?: string; note?: string; text: string };

export type VersionHistoryLabels = Partial<{
  count: string;
  namedOnly: string;
  versions: string;
  current: string;
  read: string;
  compare: string;
  edit: string;
  mode: string;
  compareWith: string;
  older: string;
  newer: string;
  restore: string;
  restoreTitle: string;
  restoreText: string;
  restored: string;
  restoredNote: string;
  name: string;
  rename: string;
  nameLabel: string;
  save: string;
  cancel: string;
  named: string;
  text: string;
  note: string;
  notePlaceholder: string;
  saveVersion: string;
  saved: string;
  noChange: string;
  emptyText: string;
  nameRequired: string;
  nameTooLong: string;
  nameTaken: string;
  loading: string;
  loadFailed: string;
  retry: string;
  empty: string;
  emptyHint: string;
  noNamed: string;
  showAll: string;
  onlyOne: string;
  by: string;
}>;

export type VersionHistoryProps = {
  title: string;
  lede?: string;
  /** The signed-in person; saved and restored versions are theirs. */
  me: string;
  /** The versions to start with, newest first. Ignored while `load` is given. */
  versions?: Version[];
  /** Loads the versions; the list shows as loading until it settles, and a failure offers Retry. */
  load?: () => Promise<Version[]>;
  /** Gets every version (newest first) after each change. */
  onChange?: (versions: Version[]) => void;
  labels?: VersionHistoryLabels;
};

type Mode = "read" | "compare" | "edit";

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
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
export function versionWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  const day = days === 0 ? "Today" : days === 1 ? "Yesterday" : dayFmt.format(d);
  return `${day}, ${timeFmt.format(d)}`;
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

export function VersionHistory({ title, lede, me, versions: initial = [], load, onChange, labels = {} }: VersionHistoryProps) {
  const l = {
    count: "{n} versions",
    namedOnly: "Named only",
    versions: "Versions",
    current: "Current",
    read: "Read",
    compare: "Compare",
    edit: "Edit",
    mode: "Show",
    compareWith: "Compare with",
    older: "older",
    newer: "newer",
    restore: "Restore this version",
    restoreTitle: "Restore {version}?",
    restoreText: "Its words become the current text. Today's text stays in the list, so you can come back to it.",
    restored: "Restored {version}.",
    restoredNote: "Restored from {when}",
    name: "Name",
    rename: "Rename",
    nameLabel: "Version name",
    save: "Save",
    cancel: "Cancel",
    named: "Named it “{name}”.",
    text: "Text",
    note: "What changed",
    notePlaceholder: "e.g. Shorter intro",
    saveVersion: "Save version",
    saved: "Saved a new version.",
    noChange: "Nothing changed since the current version.",
    emptyText: "The text can't be empty.",
    nameRequired: "Give the version a name.",
    nameTooLong: "Keep it to 40 characters.",
    nameTaken: "Another version has that name.",
    loading: "Loading versions…",
    loadFailed: "Couldn't load the versions.",
    retry: "Retry",
    empty: "No versions yet",
    emptyHint: "Versions appear here each time the text is saved.",
    noNamed: "No named versions",
    showAll: "Show all",
    onlyOne: "There's only one version, so there's nothing to compare yet.",
    by: "by {who}",
    ...labels,
  };
  const id = useId();
  const [versions, setVersions] = useState<Version[]>(load ? [] : initial);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(load ? "loading" : "ready");
  const [namedOnly, setNamedOnly] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("read");
  const [other, setOther] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ value: string; error: string } | null>(null);
  const [edit, setEdit] = useState<{ text: string; note: string; error: string }>({ text: "", note: "", error: "" });
  const [restoring, setRestoring] = useState(false);
  const [said, setSaid] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const later = (fn: () => void, ms = 0) => window.setTimeout(fn, ms);

  const fetchVersions = () => {
    if (!load) return;
    setPhase("loading");
    load()
      .then((v) => {
        setVersions(v);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchVersions, []);

  const shown = versions.filter((v) => !namedOnly || v.name);
  const currentId = versions[0]?.id;
  const chosen = shown.find((v) => v.id === sel) ?? shown[0] ?? null;
  const isCurrent = chosen?.id === currentId;
  const label = (v: Version) => v.name || versionWhen(v.at);
  /** “Sent to client”, or "the version from Yesterday, 4:05 PM" for an unnamed one. */
  const spoken = (v: Version) => (v.name ? `“${v.name}”` : `the version from ${versionWhen(v.at)}`);
  useFlip(listRef, `${phase}|${shown.map((v) => v.id).join(",")}`);

  // The editor starts from the current text whenever it opens.
  useEffect(() => {
    if (mode === "edit" && versions[0]) setEdit({ text: versions[0].text, note: "", error: "" });
  }, [mode, currentId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode === "edit" && !isCurrent) setMode("read");
  }, [isCurrent, mode]);

  const commit = (next: Version[], message: string) => {
    setVersions(next);
    onChange?.(next);
    setSaid(message);
  };
  const choose = (vid: string, focus = false) => {
    setSel(vid);
    setNaming(null);
    if (focus) later(() => document.getElementById(`${id}-v-${vid}`)?.focus(), 30);
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!chosen) return;
    const i = shown.findIndex((v) => v.id === chosen.id);
    let n = -1;
    if (e.key === "ArrowDown") n = Math.min(shown.length - 1, i + 1);
    else if (e.key === "ArrowUp") n = Math.max(0, i - 1);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = shown.length - 1;
    if (n < 0) return;
    e.preventDefault();
    choose(shown[n].id, true);
  };

  // Compare: the other version defaults to the one just older (or newer, for the oldest).
  const pool = versions.filter((v) => v.id !== chosen?.id);
  const ci = chosen ? versions.findIndex((v) => v.id === chosen.id) : -1;
  const fallback = versions[ci + 1] ?? versions[ci - 1] ?? null;
  const against = pool.find((v) => v.id === other) ?? fallback;
  const [olderV, newerV] = chosen && against ? (versions.indexOf(chosen) > versions.indexOf(against) ? [chosen, against] : [against, chosen]) : [null, null];

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    if (!naming || !chosen) return;
    const v = naming.value.trim();
    const error = !v ? l.nameRequired : v.length > 40 ? l.nameTooLong : versions.some((x) => x.id !== chosen.id && x.name?.toLowerCase() === v.toLowerCase()) ? l.nameTaken : "";
    if (error) {
      setNaming({ ...naming, error });
      document.getElementById(`${id}-name`)?.focus();
      return;
    }
    commit(
      versions.map((x) => (x.id === chosen.id ? { ...x, name: v } : x)),
      l.named.replace("{name}", v),
    );
    setNaming(null);
    later(() => document.getElementById(`${id}-name-btn`)?.focus(), 30);
  };

  const restore = () => {
    if (!chosen) return;
    const v: Version = { id: `v${Date.now().toString(36)}`, at: new Date().toISOString(), author: me, note: l.restoredNote.replace("{when}", label(chosen)), text: chosen.text };
    commit([v, ...versions], l.restored.replace("{version}", spoken(chosen)));
    setNamedOnly(false);
    setMode("read");
    // After the dialog hands focus back, move it to the new version at the top.
    later(() => choose(v.id, true), 60);
  };

  const saveVersion = (e: FormEvent) => {
    e.preventDefault();
    const cur = versions[0];
    if (!cur) return;
    const error = !edit.text.trim() ? l.emptyText : edit.text.trim() === cur.text.trim() ? l.noChange : "";
    if (error) {
      setEdit({ ...edit, error });
      document.getElementById(`${id}-edit`)?.focus();
      return;
    }
    const v: Version = { id: `v${Date.now().toString(36)}`, at: new Date().toISOString(), author: me, note: edit.note.trim() || undefined, text: edit.text.trim() };
    commit([v, ...versions], l.saved);
    setNamedOnly(false);
    setMode("read");
    choose(v.id, true);
  };

  const paragraphs = (text: string) => text.split(/\n{2,}|\n/).filter((p) => p.trim());

  return (
    <section className="fl-vhis" aria-labelledby={`${id}-title`} data-fl="p.version-history">
      <header className="fl-vhis-head">
        <div className="fl-vhis-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        {phase === "ready" ? <span className="fl-vhis-count">{versions.length === 1 ? "1 version" : l.count.replace("{n}", String(versions.length))}</span> : null}
      </header>

      {phase === "loading" ? (
        <div className="fl-vhis-body" aria-busy="true" role="status" aria-label={l.loading}>
          <div className="fl-vhis-skels">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="fl-vhis-skel" aria-hidden="true" />
            ))}
          </div>
          <span className="fl-vhis-skel fl-vhis-skel--big" aria-hidden="true" />
        </div>
      ) : phase === "error" ? (
        <div className="fl-vhis-empty" role="alert">
          <Icon name="alert" />
          <p className="fl-vhis-empty-title">{l.loadFailed}</p>
          <Button variant="secondary" size={40} icon="refresh" onClick={fetchVersions}>
            {l.retry}
          </Button>
        </div>
      ) : !versions.length ? (
        <div className="fl-vhis-empty">
          <Icon name="clock" />
          <p className="fl-vhis-empty-title">{l.empty}</p>
          <p>{l.emptyHint}</p>
        </div>
      ) : (
        <div className="fl-vhis-body">
          <div className="fl-vhis-side">
            <div className="fl-vhis-sidehead">
              <h3 id={`${id}-list-title`}>{l.versions}</h3>
              <Checkbox label={l.namedOnly} size={16} checked={namedOnly} onChange={(e) => setNamedOnly(e.currentTarget.checked)} />
            </div>
            {!shown.length ? (
              <div className="fl-vhis-empty">
                <Icon name="bookmark" />
                <p className="fl-vhis-empty-title">{l.noNamed}</p>
                <Button variant="tertiary" size={32} onClick={() => setNamedOnly(false)}>
                  {l.showAll}
                </Button>
              </div>
            ) : (
              <ul className="fl-vhis-list" role="listbox" aria-labelledby={`${id}-list-title`} ref={listRef} onKeyDown={onListKey}>
                {shown.map((v) => {
                  const on = chosen?.id === v.id;
                  return (
                    <li
                      key={v.id}
                      id={`${id}-v-${v.id}`}
                      role="option"
                      aria-selected={on}
                      tabIndex={on ? 0 : -1}
                      data-flip={v.id}
                      className="fl-vhis-row"
                      onClick={() => choose(v.id)}
                    >
                      <span className="fl-vhis-dot" aria-hidden="true" />
                      <span className="fl-vhis-when">
                        {versionWhen(v.at)}
                        {v.id === currentId ? <Badge tone="success">{l.current}</Badge> : null}
                      </span>
                      {v.name ? <span className="fl-vhis-name">{v.name}</span> : null}
                      <span className="fl-vhis-by">
                        <Avatar name={v.author} size={20} tone={toneFor(v.author)} decorative />
                        {v.author}
                      </span>
                      {v.note ? <span className="fl-vhis-note">{v.note}</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {chosen ? (
            <div className="fl-vhis-main" aria-labelledby={`${id}-sel-title`} role="region">
              <div className="fl-vhis-mainhead">
                <div className="fl-vhis-heading">
                  <h3 id={`${id}-sel-title`}>
                    {label(chosen)}
                    {isCurrent ? <Badge tone="success">{l.current}</Badge> : null}
                  </h3>
                  <p>
                    {chosen.name ? `${versionWhen(chosen.at)} · ` : ""}
                    {l.by.replace("{who}", chosen.author)}
                  </p>
                </div>
                <Segmented
                  size="sm"
                  label={l.mode}
                  value={mode}
                  onChange={(m) => setMode(m as Mode)}
                  options={[{ value: "read", label: l.read }, { value: "compare", label: l.compare }, ...(isCurrent ? [{ value: "edit", label: l.edit }] : [])]}
                />
              </div>

              {naming ? (
                <form className="fl-vhis-naming" noValidate onSubmit={saveName} onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), setNaming(null), later(() => document.getElementById(`${id}-name-btn`)?.focus(), 30))}>
                  <div className="fl-vhis-field">
                    <label htmlFor={`${id}-name`}>{l.nameLabel}</label>
                    <TextField
                      id={`${id}-name`}
                      size={32}
                      autoFocus
                      value={naming.value}
                      placeholder="e.g. Sent to client"
                      invalid={Boolean(naming.error)}
                      aria-describedby={naming.error ? `${id}-name-err` : undefined}
                      onChange={(e) => setNaming({ value: e.currentTarget.value, error: "" })}
                    />
                    {naming.error ? (
                      <p id={`${id}-name-err`} className="fl-vhis-error" role="alert">
                        <Icon name="alert" />
                        {naming.error}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-vhis-actions">
                    <Button type="submit" size={32}>
                      {l.save}
                    </Button>
                    <Button variant="tertiary" size={32} onClick={() => {
                        setNaming(null);
                        later(() => document.getElementById(`${id}-name-btn`)?.focus(), 30);
                      }}>
                      {l.cancel}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="fl-vhis-actions">
                  <Button id={`${id}-name-btn`} variant="tertiary" size={32} icon="bookmark" onClick={() => setNaming({ value: chosen.name ?? "", error: "" })}>
                    {chosen.name ? l.rename : l.name}
                  </Button>
                  {!isCurrent ? (
                    <Button variant="secondary" size={32} icon="refresh" onClick={() => setRestoring(true)}>
                      {l.restore}
                    </Button>
                  ) : null}
                </div>
              )}

              <div className="fl-vhis-view" key={`${mode}-${chosen.id}`}>
                {mode === "read" ? (
                  <div className="fl-vhis-sheet" tabIndex={0} role="document" aria-label={`${l.text}: ${label(chosen)}`}>
                    {paragraphs(chosen.text).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : mode === "compare" ? (
                  pool.length && olderV && newerV ? (
                    <div className="fl-vhis-compare">
                      <div className="fl-vhis-field fl-vhis-with">
                        <label htmlFor={`${id}-with`}>{l.compareWith}</label>
                        <Select
                          id={`${id}-with`}
                          value={against!.id}
                          onChange={(e) => setOther(e.currentTarget.value)}
                          options={pool.map((v) => ({ value: v.id, label: `${label(v)}${v.id === currentId ? ` (${l.current.toLowerCase()})` : ""} · ${versions.indexOf(v) > ci ? l.older : l.newer}` }))}
                        />
                      </div>
                      <Diff before={olderV.text} after={newerV.text} beforeName={label(olderV)} afterName={label(newerV)} />
                    </div>
                  ) : (
                    <p className="fl-vhis-hint">{l.onlyOne}</p>
                  )
                ) : (
                  <form className="fl-vhis-editor" noValidate onSubmit={saveVersion}>
                    <div className="fl-vhis-field">
                      <label htmlFor={`${id}-edit`}>{l.text}</label>
                      <TextField
                        id={`${id}-edit`}
                        multiline
                        autoGrow
                        rows={6}
                        value={edit.text}
                        invalid={Boolean(edit.error)}
                        aria-describedby={edit.error ? `${id}-edit-err` : undefined}
                        onChange={(e) => setEdit({ ...edit, text: e.currentTarget.value, error: "" })}
                      />
                      {edit.error ? (
                        <p id={`${id}-edit-err`} className="fl-vhis-error" role="alert">
                          <Icon name="alert" />
                          {edit.error}
                        </p>
                      ) : null}
                    </div>
                    <div className="fl-vhis-field">
                      <label htmlFor={`${id}-note`}>{l.note}</label>
                      <TextField id={`${id}-note`} size={40} maxLength={80} placeholder={l.notePlaceholder} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.currentTarget.value })} />
                    </div>
                    <div className="fl-vhis-actions">
                      <Button type="submit" size={40} icon="check">
                        {l.saveVersion}
                      </Button>
                      <Button variant="tertiary" size={40} onClick={() => setMode("read")}>
                        {l.cancel}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {restoring && chosen ? (
        <Modal
          variant="confirm"
          icon="refresh"
          title={l.restoreTitle.replace("{version}", spoken(chosen))}
          description={l.restoreText}
          confirmLabel={l.restore}
          onConfirm={() => restore()}
          onClose={() => setRestoring(false)}
        />
      ) : null}
    </section>
  );
}

const at = (days: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

// flowcode:sample
const SAMPLE = {
  title: "Refund policy",
  lede: "Every saved version of the policy on the help center.",
  me: "Ana Ruiz",
  versions: [
    {
      id: "v5",
      at: at(0, 9, 40),
      author: "Ana Ruiz",
      note: "Clearer wording for gift cards",
      text: "Refunds\n\nReturn any item within 30 days for a full refund.\nItems must be unused and in their original packaging.\nWe refund to the original payment method within 5 business days.\nGift cards can't be refunded or exchanged for cash.\nFor damaged items, contact us within 7 days with a photo.",
    },
    {
      id: "v4",
      at: at(1, 16, 5),
      author: "Sam Okafor",
      name: "Sent to client",
      note: "Legal review changes",
      text: "Refunds\n\nReturn any item within 30 days for a full refund.\nItems must be unused and in their original packaging.\nWe refund to the original payment method within 5 business days.\nGift cards are not refundable.\nFor damaged items, contact us within 7 days with a photo.",
    },
    {
      id: "v3",
      at: at(3, 11, 20),
      author: "Priya Shah",
      note: "Added damaged items",
      text: "Refunds\n\nReturn any item within 14 days for a full refund.\nItems must be unused and in their original packaging.\nWe refund to the original payment method within 10 business days.\nGift cards are not refundable.\nFor damaged items, contact us within 7 days with a photo.",
    },
    {
      id: "v2",
      at: at(8, 14, 0),
      author: "Ana Ruiz",
      name: "First published",
      text: "Refunds\n\nReturn any item within 14 days for a full refund.\nItems must be unused and in their original packaging.\nWe refund to the original payment method within 10 business days.\nGift cards are not refundable.",
    },
    { id: "v1", at: at(9, 10, 15), author: "Ana Ruiz", note: "First draft", text: "Refunds\n\nReturn any item within 14 days.\nWe refund to the original payment method." },
  ] as Version[],
};

export default function VersionHistorySheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <VersionHistory title={SAMPLE.title} lede={SAMPLE.lede} me={SAMPLE.me} load={() => new Promise((r) => window.setTimeout(() => r(SAMPLE.versions), 700))} />
      </div>
    </section>
  );
}
