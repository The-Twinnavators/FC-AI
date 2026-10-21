/** @flowcode-library tags-manager · Tags manager (Forms)
 * Catalog ID: p.tags-manager (pattern)
 * Function: Tags manager (p.tags-manager): a workspace's labels with status-tone colors and use counts; create (name checked for empty, too long and taken), search, sort by name or use, rename in place, recolor from a swatch menu, merge one tag into another and delete after a confirm, with Undo for the last delete or merge; loading rows, a load error with Retry, empty and no-match states, rows that glide when they move, and every change announced.
 * Use it as: import { TagsManager } from "./tags-manager"; <TagsManager title lede? tags?={[{ id, name, tone: "neutral"|"accent"|"secondary"|"success"|"warning"|"danger", uses }]} load?={async () => Tag[]} maxLength?={24} onChange?={(tags) => ...} labels?={{ add, search, rename, color, merge, delete, undo, ... }} />
 * Built from: c.text-field.outlined, c.segmented.segmented, c.select.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.form, c.modal.danger, c.empty-state.no-results
 * Look: A white card with the title, a line of help and a count; a sunken create row (name field, six round color swatches, Add tag); a search box beside a Name / Most used switch; rows with a colored dot, the tag as a tinted pill, its item count and small Rename, Color, Merge and Delete buttons; a sunken Undo bar slides in after a delete or merge.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-secondary --color-success --color-warning --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-medium --weight-semibold --focus-ring --surface-shadow-overlay --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: tags settings; labels manager; issue labels; categories; project labels; workspace settings; content tags
 * Jobs to be done: add a label my team can use; rename a tag everywhere at once; give tags colors that mean something; merge two tags that mean the same thing; delete a tag and take it back if that was a mistake
 * Keywords: tags, labels, categories, colors, rename, merge, delete, undo, workspace settings, taxonomy
 */
/**
 * Tags manager: one place to keep a workspace's labels tidy. Every row's actions are plain buttons in tab order;
 * renaming swaps the pill for a field, the color menu is a set of real radios (arrow keys move, Escape closes and
 * puts focus back), and merge and delete open the library's Modal. The last delete or merge can be undone from the
 * bar that appears. Rows glide to their new places when sorted, added or removed (FLIP), and stay put with motion off.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its badge, text field and dialog components, and
 * TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its form elements page.
 */
/**
 * How to try it
 * - Wait for the rows to load. Press Add tag with an empty name: the field says why, shakes and keeps focus. Type
 *   "bug" (already there in another case): it says the name is taken.
 * - Type "Needs design", pick the Warning swatch and press Enter: the row glides in.
 * - Rename "Docs" to "Documentation" with Enter; Escape cancels. Change a color from the Color menu with the arrow keys.
 * - Merge "Defect" into "Bug": Bug's count grows and Defect goes. Press Undo. Delete a tag, confirm, then Undo.
 * - Search "zzz": no matches, with Clear search. Switch the sort to Most used: rows glide into order.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's TextField, Segmented,
 * Select, Button and Modal ("./text-fields-states", "./segmented-control", "./dropdowns-states", "./buttons-variants",
 * "./modals-dialogs") and its inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles
 * are the library's own fl- classes in templates/library/css/r4d-tags-manager.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.tags-manager: create, rename, recolor, merge and delete labels, with undo. ──

export type TagTone = "neutral" | "accent" | "secondary" | "success" | "warning" | "danger";
export type Tag = { id: string; name: string; tone: TagTone; uses: number };

export type TagsManagerLabels = Partial<{
  count: string;
  newName: string;
  color: string;
  add: string;
  search: string;
  sortLabel: string;
  byName: string;
  byUses: string;
  uses: string;
  rename: string;
  save: string;
  cancel: string;
  merge: string;
  mergeTitle: string;
  mergeText: string;
  mergeInto: string;
  mergePick: string;
  mergeDone: string;
  remove: string;
  removeTitle: string;
  removeText: string;
  removed: string;
  added: string;
  renamed: string;
  recolored: string;
  undo: string;
  undone: string;
  loading: string;
  loadFailed: string;
  retry: string;
  empty: string;
  emptyText: string;
  noMatch: string;
  clear: string;
  required: string;
  tooLong: string;
  taken: string;
}>;

export type TagsManagerProps = {
  title: string;
  lede?: string;
  /** The tags to start with. Ignored while `load` is given. */
  tags?: Tag[];
  /** Loads the tags; rows show as loading until it settles, and a failure offers Retry. */
  load?: () => Promise<Tag[]>;
  /** Longest name allowed; 24 when left out. */
  maxLength?: number;
  /** Gets the whole list after every change (and after Undo). */
  onChange?: (tags: Tag[]) => void;
  labels?: TagsManagerLabels;
};

export const TAG_TONES: { value: TagTone; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "accent", label: "Accent" },
  { value: "secondary", label: "Secondary" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];
const toneName = (t: TagTone) => TAG_TONES.find((x) => x.value === t)?.label ?? t;

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}

/** FLIP: rows marked data-flip glide from where they were to where they are whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
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

type Undo = { before: Tag[]; text: string; focus: string };

export function TagsManager({ title, lede, tags: initial = [], load, maxLength = 24, onChange, labels = {} }: TagsManagerProps) {
  const l = {
    count: "{n} tags",
    newName: "New tag name",
    color: "Color",
    add: "Add tag",
    search: "Search tags",
    sortLabel: "Sort tags",
    byName: "Name",
    byUses: "Most used",
    uses: "{n} items",
    rename: "Rename",
    save: "Save",
    cancel: "Cancel",
    merge: "Merge",
    mergeTitle: "Merge “{name}”",
    mergeText: "Its {n} items move to the tag you pick, and “{name}” goes away.",
    mergeInto: "Merge into",
    mergePick: "Choose a tag",
    mergeDone: "Merged “{from}” into “{to}”.",
    remove: "Delete",
    removeTitle: "Delete “{name}”?",
    removeText: "It comes off {n} items. The items themselves stay.",
    removed: "Deleted “{name}”.",
    added: "Added “{name}”.",
    renamed: "Renamed to “{name}”.",
    recolored: "“{name}” is now {tone}.",
    undo: "Undo",
    undone: "Undone.",
    loading: "Loading tags…",
    loadFailed: "Couldn't load the tags.",
    retry: "Retry",
    empty: "No tags yet",
    emptyText: "Add one above to start labeling things.",
    noMatch: "No tags match “{q}”",
    clear: "Clear search",
    required: "Give the tag a name.",
    tooLong: "Keep it to {max} characters.",
    taken: "There's already a tag called that.",
    ...labels,
  };
  const id = useId();
  const [tags, setTags] = useState<Tag[]>(load ? [] : initial);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(load ? "loading" : "ready");
  const [name, setName] = useState("");
  const [tone, setTone] = useState<TagTone>("accent");
  const [addErr, setAddErr] = useState("");
  const [shake, setShake] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "uses">("name");
  const [editing, setEditing] = useState<{ id: string; value: string; error: string } | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [mergeFor, setMergeFor] = useState<Tag | null>(null);
  const [mergeErr, setMergeErr] = useState("");
  const [deleteFor, setDeleteFor] = useState<Tag | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [said, setSaid] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const focusName = () => document.getElementById(`${id}-name`)?.focus();
  const undoTimer = useRef<number | undefined>(undefined);

  const fetchTags = () => {
    if (!load) return;
    setPhase("loading");
    load()
      .then((t) => {
        setTags(t);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchTags, []);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const commit = (next: Tag[], message: string, undoable?: Tag[], focus = "") => {
    setTags(next);
    onChange?.(next);
    setSaid(message);
    window.clearTimeout(undoTimer.current);
    if (undoable) {
      setUndo({ before: undoable, text: message, focus });
      undoTimer.current = window.setTimeout(() => setUndo(null), 10000);
      // The row that had focus is gone; Undo is the next useful place.
      window.setTimeout(() => document.getElementById(`${id}-undo`)?.focus(), 0);
    } else setUndo(null);
  };

  const check = (value: string, self?: string) => {
    const v = value.trim();
    if (!v) return l.required;
    if (v.length > maxLength) return l.tooLong.replace("{max}", String(maxLength));
    if (tags.some((t) => t.id !== self && t.name.toLowerCase() === v.toLowerCase())) return l.taken;
    return "";
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const err = check(name);
    setAddErr(err);
    if (err) {
      setShake((n) => n + 1);
      focusName();
      return;
    }
    const tag: Tag = { id: `t${Date.now().toString(36)}`, name: name.trim(), tone, uses: 0 };
    commit([...tags, tag], l.added.replace("{name}", tag.name));
    setName("");
    focusName();
  };

  const saveRename = () => {
    if (!editing) return;
    const err = check(editing.value, editing.id);
    if (err) {
      setEditing({ ...editing, error: err });
      setShake((n) => n + 1);
      document.getElementById(`${id}-edit`)?.focus();
      return;
    }
    const v = editing.value.trim();
    const was = tags.find((t) => t.id === editing.id);
    setEditing(null);
    if (was && was.name !== v) commit(tags.map((t) => (t.id === editing.id ? { ...t, name: v } : t)), l.renamed.replace("{name}", v));
    window.setTimeout(() => document.getElementById(`${id}-rename-${editing.id}`)?.focus(), 0);
  };
  const cancelRename = () => {
    const was = editing?.id;
    setEditing(null);
    if (was) window.setTimeout(() => document.getElementById(`${id}-rename-${was}`)?.focus(), 0);
  };

  const recolor = (tag: Tag, t: TagTone) => {
    if (tag.tone !== t) commit(tags.map((x) => (x.id === tag.id ? { ...x, tone: t } : x)), l.recolored.replace("{name}", tag.name).replace("{tone}", toneName(t)));
  };
  const closeColor = (focusBack = true) => {
    const was = colorFor;
    setColorFor(null);
    if (focusBack && was) window.setTimeout(() => document.getElementById(`${id}-color-${was}`)?.focus(), 0);
  };

  // The color menu closes when focus or a click goes elsewhere.
  useEffect(() => {
    if (!colorFor) return;
    const onDown = (e: MouseEvent) => {
      const pop = document.getElementById(`${id}-pop-${colorFor}`);
      const btn = document.getElementById(`${id}-color-${colorFor}`);
      if (!pop?.contains(e.target as Node) && !btn?.contains(e.target as Node)) setColorFor(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colorFor, id]);

  const merge = (data: FormData) => {
    if (!mergeFor) return false;
    const target = tags.find((t) => t.id === data.get("target"));
    if (!target) {
      setMergeErr(l.mergePick);
      window.setTimeout(() => document.getElementById(`${id}-merge-target`)?.focus(), 0);
      return false;
    }
    const before = tags;
    commit(
      tags.filter((t) => t.id !== mergeFor.id).map((t) => (t.id === target.id ? { ...t, uses: t.uses + mergeFor.uses } : t)),
      l.mergeDone.replace("{from}", mergeFor.name).replace("{to}", target.name),
      before,
      mergeFor.id,
    );
    setMergeErr("");
    return undefined;
  };

  const remove = () => {
    if (!deleteFor) return;
    commit(
      tags.filter((t) => t.id !== deleteFor.id),
      l.removed.replace("{name}", deleteFor.name),
      tags,
      deleteFor.id,
    );
  };

  const doUndo = () => {
    if (!undo) return;
    setTags(undo.before);
    onChange?.(undo.before);
    setUndo(null);
    setSaid(l.undone);
    window.clearTimeout(undoTimer.current);
    const back = undo.focus;
    window.setTimeout(() => (document.getElementById(`${id}-rename-${back}`) ?? document.getElementById(`${id}-name`))?.focus(), 0);
  };

  const q = query.trim().toLowerCase();
  const shown = tags
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .sort((a, b) => (sort === "uses" ? b.uses - a.uses || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)));
  useFlip(list, `${phase}|${shown.map((t) => t.id).join(",")}`);

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  const shakeAttr = shake ? (shake % 2 ? "a" : "b") : undefined;

  return (
    <section className="fl-tgm" aria-labelledby={`${id}-title`} data-fl="p.tags-manager">
      <header className="fl-tgm-head">
        <div className="fl-tgm-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        {phase === "ready" ? <span className="fl-tgm-count">{l.count.replace("{n}", String(tags.length))}</span> : null}
      </header>

      <form className="fl-tgm-create" noValidate onSubmit={add}>
        <div className="fl-tgm-field">
          <label htmlFor={`${id}-name`}>{l.newName}</label>
          <span data-shake={addErr ? shakeAttr : undefined} className="fl-tgm-shake">
            <TextField
              id={`${id}-name`}
              size={40}
              value={name}
              maxLength={maxLength + 10}
              placeholder="e.g. Needs review"
              invalid={Boolean(addErr)}
              aria-describedby={addErr ? `${id}-name-err` : undefined}
              onChange={(e) => {
                setName(e.currentTarget.value);
                if (addErr) setAddErr("");
              }}
            />
          </span>
          <p id={`${id}-name-err`} className="fl-tgm-error" role={addErr ? "alert" : undefined}>
            {addErr ? (
              <>
                <Icon name="alert" />
                {addErr}
              </>
            ) : null}
          </p>
        </div>
        <fieldset className="fl-tgm-tones">
          <legend>{l.color}</legend>
          <div className="fl-tgm-swatches">
            {TAG_TONES.map((t) => (
              <label key={t.value} className="fl-tgm-swatch" data-tone={t.value} title={t.label}>
                <input type="radio" name={`${id}-tone`} value={t.value} checked={tone === t.value} onChange={() => setTone(t.value)} />
                <span aria-hidden="true" />
                <span className="fl-sr">{t.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" size={40} icon="plus" className="fl-tgm-add">
          {l.add}
        </Button>
      </form>

      <div className="fl-tgm-tools">
        <span className="fl-tgm-search">
          <Icon name="search" />
          <TextField id={`${id}-search`} type="search" size={40} aria-label={l.search} placeholder={l.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        </span>
        <Segmented
          size="sm"
          label={l.sortLabel}
          value={sort}
          onChange={(v) => setSort(v as "name" | "uses")}
          options={[
            { value: "name", label: l.byName },
            { value: "uses", label: l.byUses },
          ]}
        />
      </div>

      {phase === "loading" ? (
        <ul className="fl-tgm-list" aria-busy="true" aria-label={l.loading}>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="fl-tgm-row fl-tgm-skel" aria-hidden="true">
              <span />
              <span />
            </li>
          ))}
        </ul>
      ) : phase === "error" ? (
        <div className="fl-tgm-empty" role="alert">
          <Icon name="alert" />
          <p className="fl-tgm-empty-title">{l.loadFailed}</p>
          <Button variant="secondary" size={40} icon="refresh" onClick={fetchTags}>
            {l.retry}
          </Button>
        </div>
      ) : !tags.length ? (
        <div className="fl-tgm-empty">
          <Icon name="layers" />
          <p className="fl-tgm-empty-title">{l.empty}</p>
          <p>{l.emptyText}</p>
        </div>
      ) : !shown.length ? (
        <div className="fl-tgm-empty">
          <Icon name="search" />
          <p className="fl-tgm-empty-title">{l.noMatch.replace("{q}", query.trim())}</p>
          <Button variant="tertiary" size={32} onClick={() => {
              setQuery("");
              document.getElementById(`${id}-search`)?.focus();
            }}>
            {l.clear}
          </Button>
        </div>
      ) : (
        <ul className="fl-tgm-list" ref={list} aria-label={title}>
          {shown.map((t, i) => {
            const isEditing = editing?.id === t.id;
            return (
              <li key={t.id} className="fl-tgm-row" data-flip={t.id} style={{ ["--i" as string]: Math.min(i, 5) }}>
                {isEditing ? (
                  <div className="fl-tgm-edit">
                    <span className="fl-tgm-dot" data-tone={t.tone} aria-hidden="true" />
                    <div className="fl-tgm-field">
                      <label className="fl-sr" htmlFor={`${id}-edit`}>
                        {l.rename} {t.name}
                      </label>
                      <span data-shake={editing.error ? shakeAttr : undefined} className="fl-tgm-shake">
                        <TextField
                          id={`${id}-edit`}
                          size={32}
                          value={editing.value}
                          autoFocus
                          invalid={Boolean(editing.error)}
                          aria-describedby={editing.error ? `${id}-edit-err` : undefined}
                          onChange={(e) => setEditing({ ...editing, value: e.currentTarget.value, error: "" })}
                          onKeyDown={onEditKey}
                        />
                      </span>
                      {editing.error ? (
                        <p id={`${id}-edit-err`} className="fl-tgm-error" role="alert">
                          <Icon name="alert" />
                          {editing.error}
                        </p>
                      ) : null}
                    </div>
                    <div className="fl-tgm-actions">
                      <Button size={32} onClick={saveRename}>
                        {l.save}
                      </Button>
                      <Button variant="tertiary" size={32} onClick={cancelRename}>
                        {l.cancel}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="fl-tgm-dot" data-tone={t.tone} aria-hidden="true" />
                    <span className="fl-tgm-pill" data-tone={t.tone}>
                      {t.name}
                    </span>
                    <span className="fl-tgm-uses">{l.uses.replace("{n}", String(t.uses))}</span>
                    <div className="fl-tgm-actions">
                      <Button id={`${id}-rename-${t.id}`} variant="tertiary" size={32} icon="pencil" iconOnly aria-label={`${l.rename} ${t.name}`} onClick={() => setEditing({ id: t.id, value: t.name, error: "" })}>
                        {l.rename}
                      </Button>
                      <span className="fl-tgm-colorwrap">
                        <button
                          id={`${id}-color-${t.id}`}
                          type="button"
                          className="fl-tgm-colorbtn"
                          aria-haspopup="true"
                          aria-expanded={colorFor === t.id}
                          aria-controls={colorFor === t.id ? `${id}-pop-${t.id}` : undefined}
                          aria-label={`${l.color} for ${t.name}: ${toneName(t.tone)}`}
                          title={l.color}
                          onClick={() => (colorFor === t.id ? closeColor() : setColorFor(t.id))}
                        >
                          <span className="fl-tgm-dot" data-tone={t.tone} aria-hidden="true" />
                          <Icon name="chevron-down" />
                        </button>
                        {colorFor === t.id ? (
                          <fieldset
                            id={`${id}-pop-${t.id}`}
                            className="fl-tgm-pop"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                closeColor();
                              } else if (e.key === "Enter") {
                                e.preventDefault();
                                closeColor();
                              }
                            }}
                          >
                            <legend className="fl-sr">
                              {l.color} for {t.name}
                            </legend>
                            {TAG_TONES.map((x) => (
                              <label key={x.value} className="fl-tgm-swatch" data-tone={x.value} title={x.label}>
                                <input
                                  type="radio"
                                  name={`${id}-pop-${t.id}`}
                                  value={x.value}
                                  checked={t.tone === x.value}
                                  autoFocus={t.tone === x.value}
                                  onChange={() => recolor(t, x.value)}
                                  onClick={(e) => e.detail > 0 && closeColor()}
                                />
                                <span aria-hidden="true" />
                                <span className="fl-sr">{x.label}</span>
                              </label>
                            ))}
                          </fieldset>
                        ) : null}
                      </span>
                      <Button variant="tertiary" size={32} icon="layers" iconOnly aria-label={`${l.merge} ${t.name}`} disabled={tags.length < 2} onClick={() => setMergeFor(t)}>
                        {l.merge}
                      </Button>
                      <Button variant="tertiary" size={32} icon="trash" iconOnly aria-label={`${l.remove} ${t.name}`} className="fl-tgm-del" onClick={() => setDeleteFor(t)}>
                        {l.remove}
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className={["fl-tgm-undo", undo ? "is-open" : ""].filter(Boolean).join(" ")} inert={!undo || undefined}>
        <div>
          <p>{undo?.text}</p>
          <Button id={`${id}-undo`} variant="secondary" size={32} icon="refresh" onClick={doUndo}>
            {l.undo}
          </Button>
        </div>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {mergeFor ? (
        <Modal
          variant="form"
          title={l.mergeTitle.replace("{name}", mergeFor.name)}
          description={l.mergeText.replace("{n}", String(mergeFor.uses)).replace("{name}", mergeFor.name)}
          confirmLabel={l.merge}
          onConfirm={merge}
          onClose={() => {
            setMergeFor(null);
            setMergeErr("");
          }}
        >
          <div className="fl-tgm-field">
            <label htmlFor={`${id}-merge-target`}>{l.mergeInto}</label>
            <Select
              id={`${id}-merge-target`}
              name="target"
              placeholder={l.mergePick}
              invalid={Boolean(mergeErr)}
              aria-describedby={mergeErr ? `${id}-merge-err` : undefined}
              onChange={() => setMergeErr("")}
              options={tags.filter((t) => t.id !== mergeFor.id).map((t) => ({ value: t.id, label: `${t.name} (${t.uses})` }))}
            />
            {mergeErr ? (
              <p id={`${id}-merge-err`} className="fl-tgm-error" role="alert">
                <Icon name="alert" />
                {mergeErr}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {deleteFor ? (
        <Modal
          variant="danger"
          icon="trash"
          title={l.removeTitle.replace("{name}", deleteFor.name)}
          description={l.removeText.replace("{n}", String(deleteFor.uses))}
          confirmLabel={l.remove}
          onConfirm={() => remove()}
          onClose={() => setDeleteFor(null)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Tags",
  lede: "Labels your team puts on issues and requests.",
  tags: [
    { id: "t1", name: "Bug", tone: "danger", uses: 42 },
    { id: "t2", name: "Defect", tone: "warning", uses: 7 },
    { id: "t3", name: "Feature", tone: "accent", uses: 31 },
    { id: "t4", name: "Docs", tone: "secondary", uses: 12 },
    { id: "t5", name: "Good first issue", tone: "success", uses: 9 },
    { id: "t6", name: "Won't fix", tone: "neutral", uses: 4 },
  ] as Tag[],
};

export default function TagsManagerSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <TagsManager title={SAMPLE.title} lede={SAMPLE.lede} load={() => new Promise((r) => window.setTimeout(() => r(SAMPLE.tags), 700))} />
      </div>
    </section>
  );
}
