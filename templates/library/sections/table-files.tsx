/** @flowcode-library table-files · Files table (Tables and lists)
 * Catalog ID: p.files-table (pattern)
 * Function: A files table (p.files-table): upload from the device with progress, Cancel and a too-large error; sortable name, size and date columns (rows glide into order); rename in the row with checks for empty, duplicate and slash names; select to download or delete (asks first); delete one with Undo; an empty state with Upload. Adapted from Meraki UI (MIT).
 * Use it as: Import { FilesTable } from "./table-files"; <FilesTable title files={[{ id, name, size: bytes, uploaded: "2026-10-04", updated?, by }]} me="Signed-in name" maxSize?={25 * 1024 * 1024} onUpload?={(file) => Promise<void>} onRename?={(id, name) => ...} onDelete?={(ids) => ...} onDownload?={(ids) => ...} />  // without onUpload the progress is simulated
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.avatar.person, c.modal.danger, c.empty-state.first-use
 * Look: A title with a file count and Download and Upload buttons over a bordered table: a checkbox, a small colored tile with the file type, the name, size, date uploaded, last updated, the uploader's avatar and name, and quiet Rename and Delete buttons; uploading rows show a thin progress bar with Cancel. On a phone each file is a compact row of tile, name and size.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-success --color-warning --color-danger --color-danger-surface --color-text --color-text-muted --focus-ring --radius-md --radius-lg --space-1 --space-2 --space-3 --space-4 --text-xs --text-sm --duration-fast --duration-base --duration-slow --ease-out --enter-distance
 * Use cases: file manager; uploaded files; shared documents; project files; attachments; client documents; media library list; data room
 * Jobs to be done: upload a file and see it finish; find a file by name, size or date; rename a file; download several files at once; delete files i no longer need
 * Keywords: files, upload, documents, table, attachments, rename, download, delete, progress
 */
/**
 * Files table: what has been uploaded, newest first. Upload opens the device's file picker; each file gets a row that
 * fills a progress bar (simulated here unless onUpload is given) and can be canceled, and a file over the size limit
 * shows why it was refused. Column headers sort (the rows glide to their new order, a FLIP with the Web Animations API).
 * Rename turns the name into a field (Enter saves, Escape cancels; empty, duplicate and slash names are refused).
 * Checkboxes select files for Download or Delete; Delete for several asks first (c.modal.danger), Delete for one
 * removes it with Undo. Make it the app's own: replace SAMPLE with the app's files, give onUpload the real upload, and
 * save renames and deletes through onRename and onDelete.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa), its "Files" table.
 */
/**
 * How to try it
 * - Press Upload and pick a file or two: rows appear with a progress bar; Cancel stops one. A file over 25 MB is refused.
 * - Press the Size header: the rows glide into their new order; press again for the other direction.
 * - Press Rename on a row, change the name and press Enter. Try an empty name or one already used.
 * - Tick two boxes and press Delete selected: a dialog asks first. Delete on one row removes it with Undo.
 *
 * Dependencies: React (useEffect, useId, useRef, useState, flushSync from react-dom), and the library's own inline icon
 * set ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample data
 * is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { EmptyState } from "./empty-states";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── p.files-table: uploaded files, with upload progress, sort, rename, select and delete. ──

export type FileRow = {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** ISO date: "2026-10-04". */
  uploaded: string;
  updated?: string;
  /** Who uploaded it. */
  by: string;
};

export type FilesTableProps = {
  title: string;
  files: FileRow[];
  /** The signed-in person's name, for files they upload. */
  me: string;
  /** The largest file accepted, in bytes; 25 MB when left out. */
  maxSize?: number;
  locale?: string;
  labels?: Partial<typeof LABELS>;
  /** Uploads one file; resolve when done, reject to show it failed. Simulated when left out. */
  onUpload?: (file: File) => Promise<void>;
  onRename?: (id: string, name: string) => void;
  onDelete?: (ids: string[]) => void;
  onDownload?: (ids: string[]) => void;
};

const LABELS = {
  upload: "Upload",
  download: "Download",
  downloadAll: "Download all",
  remove: "Delete",
  removeSelected: "Delete selected",
  rename: "Rename",
  save: "Save",
  cancel: "Cancel",
  undo: "Undo",
  name: "File name",
  size: "File size",
  uploaded: "Date uploaded",
  updated: "Last updated",
  by: "Uploaded by",
  actions: "Actions",
  selectAll: "Select all files",
  select: "Select",
  uploading: "Uploading",
  tooLarge: "Too large. The limit is",
  failed: "Upload failed.",
  empty: "No files yet",
  emptyText: "Upload a file to share it with your team.",
  nameEmpty: "Enter a name.",
  nameTaken: "Another file has that name.",
  nameSlash: "Names can't contain / or \\.",
  selected: "selected",
  confirmTitle: "Delete these files?",
  confirmText: "They're removed for everyone on the project.",
};

type Upload = { id: string; name: string; size: number; progress: number; error?: string };
type SortKey = "name" | "size" | "uploaded";

// ── Helpers ──

const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE");
/** The tile's tone by kind of file: documents, images, sheets, archives. */
const toneOf = (ext: string) =>
  ["PDF", "DOC", "DOCX", "TXT", "MD"].includes(ext) ? "doc" : ["JPG", "JPEG", "PNG", "GIF", "SVG", "WEBP", "HEIC"].includes(ext) ? "img" : ["XLS", "XLSX", "CSV", "NUM"].includes(ext) ? "sheet" : ["ZIP", "RAR", "7Z", "TAR"].includes(ext) ? "zip" : "other";
const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${Math.round(n / 1024)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(1)} GB`);
const today = () => new Date().toISOString().slice(0, 10);

let moving: Animation[] = [];
const ms = (v: string, fallback: number) => (/ms$/.test(v.trim()) ? parseFloat(v) : /s$/.test(v.trim()) ? parseFloat(v) * 1000 : fallback);
/** Rows glide from their old place to the new one after a sort (a FLIP); reduced motion, animation off and long lists just update. */
function continuity(body: HTMLElement | null, update: () => void) {
  const off = document.documentElement.dataset.motion === "off" || typeof Element.prototype.animate !== "function";
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!body || off || reduced || body.children.length > 40) {
    update();
    return;
  }
  const first = new Map<string, number>();
  for (const el of Array.from(body.children) as HTMLElement[]) if (el.dataset.key) first.set(el.dataset.key, el.getBoundingClientRect().top);
  for (const m of moving) m.cancel();
  moving = [];
  flushSync(update);
  const css = getComputedStyle(document.documentElement);
  const slow = ms(css.getPropertyValue("--duration-slow"), 320);
  const easing = css.getPropertyValue("--ease-out").trim() || "ease-out";
  for (const el of Array.from(body.children) as HTMLElement[]) {
    const was = el.dataset.key ? first.get(el.dataset.key) : undefined;
    if (was === undefined) continue;
    const dy = was - el.getBoundingClientRect().top;
    if (Math.abs(dy) >= 1) moving.push(el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: slow, easing }));
  }
}

/** The small colored tile with the file's type. */
function FileTile({ name }: { name: string }) {
  const ext = extOf(name);
  return (
    <span className={`fl-tfil-tile fl-tfil-tile--${toneOf(ext)}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M6 2h8l5 5v15H6zM14 2v5h5" />
      </svg>
      <span>{ext}</span>
    </span>
  );
}

export function FilesTable({ title, files, me, maxSize = 25 * 1024 * 1024, locale = "en-US", labels = {}, onUpload, onRename, onDelete, onDownload }: FilesTableProps) {
  const l = { ...LABELS, ...labels };
  const uid = useId().replace(/:/g, "");
  const [rows, setRows] = useState(files);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "uploaded", dir: -1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; text: string; error?: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [last, setLast] = useState<{ row: FileRow; at: number } | null>(null);
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const timers = useRef(new Map<string, number>());
  const titleRef = useRef<HTMLHeadingElement>(null);

  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });
  const fmtDate = (iso?: string) => (iso ? date.format(new Date(`${iso}T12:00:00`)) : "—");

  const sorted = [...rows].sort((a, b) => {
    const v = sort.key === "name" ? a.name.localeCompare(b.name) : sort.key === "size" ? a.size - b.size : a.uploaded.localeCompare(b.uploaded);
    return v * sort.dir;
  });
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const someOn = !allOn && rows.some((r) => picked.has(r.id));
  const selectAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = someOn;
  }, [someOn]);

  // Stop simulated uploads when the table goes away.
  useEffect(() => () => timers.current.forEach((t) => window.clearInterval(t)), []);

  const sortBy = (key: SortKey) => continuity(body.current, () => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 })));
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none");

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ── Upload ──
  const finish = (u: Upload) => {
    setUploads((xs) => xs.filter((x) => x.id !== u.id));
    setRows((rs) => [{ id: u.id, name: u.name, size: u.size, uploaded: today(), updated: today(), by: me }, ...rs]);
    setStatus(`${u.name} uploaded.`);
  };
  const start = (file: File) => {
    const u: Upload = { id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: file.name, size: file.size, progress: 0 };
    if (file.size > maxSize) {
      setUploads((xs) => [...xs, { ...u, error: `${l.tooLarge} ${bytes(maxSize)}.` }]);
      setStatus(`${file.name}: ${l.tooLarge} ${bytes(maxSize)}.`);
      return;
    }
    setUploads((xs) => [...xs, u]);
    if (onUpload) {
      onUpload(file).then(
        () => finish(u),
        () => setUploads((xs) => xs.map((x) => (x.id === u.id ? { ...x, error: l.failed } : x))),
      );
      return;
    }
    // Simulated: a little further every tick, faster for small files. The progress lives outside the state updater so
    // it runs once per tick (React may call updaters twice).
    const step = Math.max(4, Math.min(30, 4e6 / Math.max(file.size, 1)));
    let progress = 0;
    const t = window.setInterval(() => {
      progress = Math.min(100, progress + step * (0.6 + Math.random() * 0.8));
      if (progress >= 100) {
        window.clearInterval(t);
        timers.current.delete(u.id);
        finish(u);
        return;
      }
      setUploads((xs) => xs.map((x) => (x.id === u.id ? { ...x, progress } : x)));
    }, 180);
    timers.current.set(u.id, t);
  };
  const cancelUpload = (u: Upload) => {
    const t = timers.current.get(u.id);
    if (t) window.clearInterval(t);
    timers.current.delete(u.id);
    setUploads((xs) => xs.filter((x) => x.id !== u.id));
    setStatus(u.error ? `${u.name} cleared.` : `${u.name} upload canceled.`);
    titleRef.current?.focus();
  };

  // ── Rename ──
  const check = (id: string, text: string) => {
    const t = text.trim();
    if (!t) return l.nameEmpty;
    if (/[\\/]/.test(t)) return l.nameSlash;
    if (rows.some((r) => r.id !== id && r.name.toLowerCase() === t.toLowerCase())) return l.nameTaken;
    return undefined;
  };
  const saveName = () => {
    if (!editing) return;
    const error = check(editing.id, editing.text);
    if (error) {
      setEditing({ ...editing, error });
      return;
    }
    const name = editing.text.trim();
    setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, name, updated: today() } : r)));
    onRename?.(editing.id, name);
    setStatus(`Renamed to ${name}.`);
    const id = editing.id;
    setEditing(null);
    requestAnimationFrame(() => document.getElementById(`${uid}-rn-${id}`)?.focus());
  };
  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      const id = editing?.id;
      setEditing(null);
      requestAnimationFrame(() => document.getElementById(`${uid}-rn-${id}`)?.focus());
    }
  };

  // ── Delete and download ──
  const removeOne = (row: FileRow) => {
    setLast({ row, at: rows.indexOf(row) });
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    setPicked((s) => {
      const n = new Set(s);
      n.delete(row.id);
      return n;
    });
    onDelete?.([row.id]);
    setStatus(`${row.name} deleted.`);
    titleRef.current?.focus();
  };
  const undo = () => {
    if (!last) return;
    setRows((rs) => [...rs.slice(0, last.at), last.row, ...rs.slice(last.at)]);
    setStatus(`${last.row.name} restored.`);
    setLast(null);
  };
  const removePicked = () => {
    const ids = [...picked];
    setRows((rs) => rs.filter((r) => !picked.has(r.id)));
    setPicked(new Set());
    setLast(null);
    onDelete?.(ids);
    setStatus(`${ids.length} files deleted.`);
    // The button that opened the dialog is gone with the selection; the title takes focus.
    requestAnimationFrame(() => titleRef.current?.focus());
  };
  const download = () => {
    const ids = picked.size ? [...picked] : rows.map((r) => r.id);
    onDownload?.(ids);
    setStatus(`Preparing ${ids.length} ${ids.length === 1 ? "file" : "files"} to download.`);
  };

  const sortHead = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={ariaSort(key)} className={key === "name" ? "fl-tfil-col-name" : undefined}>
      <button type="button" className="fl-tfil-sort" onClick={() => sortBy(key)}>
        {label}
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={sort.key === key ? `is-on${sort.dir === 1 ? " is-up" : ""}` : undefined}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </th>
  );

  const empty = rows.length === 0 && uploads.length === 0;

  return (
    <section className="fl-tfil" aria-labelledby={`${uid}-title`} data-fl="p.files-table">
      <div className="fl-tfil-head">
        <div className="fl-tfil-heading">
          <h3 id={`${uid}-title`} tabIndex={-1} ref={titleRef}>
            {title}
          </h3>
          <span className="fl-tfil-count">
            {rows.length} {rows.length === 1 ? "file" : "files"}
            {picked.size ? ` · ${picked.size} ${l.selected}` : ""}
          </span>
        </div>
        <div className="fl-tfil-tools">
          {picked.size ? (
            <Button variant="tertiary" size={40} icon="trash" onClick={() => setConfirming(true)}>
              {l.removeSelected}
            </Button>
          ) : null}
          <Button variant="secondary" size={40} icon="download" onClick={download} disabled={rows.length === 0}>
            {picked.size ? l.download : l.downloadAll}
          </Button>
          <Button variant="primary" size={40} icon="upload" onClick={() => input.current?.click()}>
            {l.upload}
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              for (const f of Array.from(e.target.files ?? [])) start(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {empty ? (
        <EmptyState
          variant="first-use"
          icon="upload"
          title={l.empty}
          action={
            <Button variant="primary" size={40} icon="upload" onClick={() => input.current?.click()}>
              {l.upload}
            </Button>
          }
        >
          {l.emptyText}
        </EmptyState>
      ) : (
        <div className="fl-tfil-scroll">
          <table className="fl-tfil-table">
            <caption className="fl-sr">
              {title}, sorted by {sort.key === "name" ? l.name : sort.key === "size" ? l.size : l.uploaded}, {sort.dir === 1 ? "ascending" : "descending"}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="fl-tfil-col-check">
                  <input ref={selectAll} type="checkbox" className="fl-tfil-check" aria-label={l.selectAll} checked={allOn} disabled={rows.length === 0} onChange={() => setPicked(allOn ? new Set() : new Set(rows.map((r) => r.id)))} />
                </th>
                {sortHead("name", l.name)}
                {sortHead("size", l.size)}
                {sortHead("uploaded", l.uploaded)}
                <th scope="col" className="fl-tfil-col-updated">
                  {l.updated}
                </th>
                <th scope="col" className="fl-tfil-col-by">
                  {l.by}
                </th>
                <th scope="col" className="fl-tfil-col-actions">
                  <span className="fl-sr">{l.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody ref={body}>
              {uploads.map((u) => (
                <tr key={u.id} className={`fl-tfil-row fl-tfil-row--up${u.error ? " is-error" : ""}`}>
                  <td className="fl-tfil-col-check" />
                  <td className="fl-tfil-col-name" colSpan={5}>
                    <div className="fl-tfil-file">
                      <FileTile name={u.name} />
                      <div className="fl-tfil-name">
                        <span className="fl-tfil-name-text">{u.name}</span>
                        {u.error ? (
                          <span className="fl-tfil-error" role="alert">
                            {u.error}
                          </span>
                        ) : (
                          <span className="fl-tfil-progress">
                            <span
                              className="fl-tfil-bar"
                              role="progressbar"
                              aria-label={`${l.uploading} ${u.name}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(u.progress)}
                            >
                              <span style={{ transform: `scaleX(${u.progress / 100})` }} />
                            </span>
                            <span className="fl-tfil-sub">
                              {Math.round(u.progress)}% · {bytes(u.size)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="fl-tfil-col-actions">
                    <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => cancelUpload(u)} aria-label={`${u.error ? "Clear" : l.cancel} ${u.name}`}>
                      {u.error ? "Clear" : l.cancel}
                    </Button>
                  </td>
                </tr>
              ))}
              {sorted.map((r) => {
                const isEditing = editing?.id === r.id;
                const on = picked.has(r.id);
                return (
                  <tr key={r.id} data-key={r.id} className={`fl-tfil-row${on ? " is-picked" : ""}`}>
                    <td className="fl-tfil-col-check">
                      <input type="checkbox" className="fl-tfil-check" aria-label={`${l.select} ${r.name}`} checked={on} onChange={() => toggle(r.id)} />
                    </td>
                    <td className="fl-tfil-col-name">
                      <div className="fl-tfil-file">
                        <FileTile name={r.name} />
                        {isEditing ? (
                          <div className="fl-tfil-rename">
                            <TextField
                              size={32}
                              aria-label={`New name for ${r.name}`}
                              value={editing.text}
                              invalid={!!editing.error}
                              aria-describedby={editing.error ? `${uid}-err` : undefined}
                              autoFocus
                              onFocus={(e) => {
                                const dot = e.target.value.lastIndexOf(".");
                                e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
                              }}
                              onChange={(e) => setEditing({ id: r.id, text: e.target.value, error: editing.error ? check(r.id, e.target.value) : undefined })}
                              onKeyDown={onEditKey}
                            />
                            {editing.error ? (
                              <span id={`${uid}-err`} className="fl-tfil-error">
                                {editing.error}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="fl-tfil-name">
                            <span className="fl-tfil-name-text">{r.name}</span>
                            <span className="fl-tfil-sub">{bytes(r.size)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="fl-tfil-col-size">{bytes(r.size)}</td>
                    <td className="fl-tfil-col-date">{fmtDate(r.uploaded)}</td>
                    <td className="fl-tfil-col-updated">{fmtDate(r.updated)}</td>
                    <td className="fl-tfil-col-by">
                      <span className="fl-tfil-by">
                        <Avatar name={r.by} size={24} decorative />
                        {r.by}
                      </span>
                    </td>
                    <td className="fl-tfil-col-actions">
                      <div className="fl-tfil-acts">
                        {isEditing ? (
                          <>
                            <Button variant="tertiary" size={32} icon="check" iconOnly onClick={saveName} aria-label={`${l.save} ${r.name}`}>
                              {l.save}
                            </Button>
                            <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => setEditing(null)} aria-label={`${l.cancel} renaming ${r.name}`}>
                              {l.cancel}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button id={`${uid}-rn-${r.id}`} variant="tertiary" size={32} icon="pencil" iconOnly onClick={() => setEditing({ id: r.id, text: r.name })} aria-label={`${l.rename} ${r.name}`}>
                              {l.rename}
                            </Button>
                            <Button variant="tertiary" size={32} icon="trash" iconOnly onClick={() => removeOne(r)} aria-label={`${l.remove} ${r.name}`}>
                              {l.remove}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="fl-tfil-status" role="status" aria-live="polite">
        {status ? <span>{status}</span> : null}
        {last ? (
          <Button variant="tertiary" size={32} onClick={undo}>
            {l.undo}
          </Button>
        ) : null}
      </div>

      {confirming ? (
        <Modal
          variant="danger"
          icon="trash"
          title={l.confirmTitle}
          description={`${picked.size} ${picked.size === 1 ? "file" : "files"}. ${l.confirmText}`}
          confirmLabel={`${l.remove} ${picked.size} ${picked.size === 1 ? "file" : "files"}`}
          onConfirm={() => removePicked()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE: FilesTableProps = {
  title: "Files uploaded",
  me: "Ana Silva",
  files: [
    { id: "f1", name: "Tech requirements.pdf", size: 204800, uploaded: "2026-10-04", updated: "2026-10-04", by: "Lana Steiner" },
    { id: "f2", name: "Dashboard screenshot.jpg", size: 734003, uploaded: "2026-10-12", updated: "2026-10-14", by: "Demi Wilkinson" },
    { id: "f3", name: "Dashboard prototype recording.mp4", size: 16777216, uploaded: "2026-10-08", updated: "2026-10-09", by: "Candice Wu" },
    { id: "f4", name: "Q4 budget.xlsx", size: 48128, uploaded: "2026-09-28", updated: "2026-10-16", by: "Natali Craig" },
    { id: "f5", name: "Brand assets.zip", size: 9122611, uploaded: "2026-10-18", updated: "2026-10-18", by: "Drew Cano" },
    { id: "f6", name: "Meeting notes.docx", size: 31744, uploaded: "2026-10-20", updated: "2026-10-20", by: "Lana Steiner" },
  ],
};

export default function FilesTablePreview() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <FilesTable {...SAMPLE} />
      </div>
    </section>
  );
}
