/** @flowcode-library media-library · Media library (Tables and lists)
 * Catalog ID: p.media-library (pattern)
 * Function: Media library (p.media-library): a team's pictures, videos and documents in folders; a grid or list of files you can search, select one or many of (click, Ctrl or Shift click, arrow keys and Space), move to another folder, delete after a confirm with Undo, and open in a details panel to rename and add alt text; new folders; uploads from the device (or dropped on the files) with progress, Cancel and a too-large error; loading tiles, a load error with Retry, empty-folder and no-match states, and every change announced.
 * Use it as: import { MediaLibrary } from "./media-library"; <MediaLibrary title lede? folders={[{ id, name }]} items?={[{ id, name, kind: "image"|"video"|"doc", folder, size: bytes, added: ISO, width?, height?, alt?, art?: "a"|"b"|"c"|"d"|"e", src? }]} load?={async () => MediaItem[]} maxBytes?={20_000_000} onChange?={(items, folders) => ...} labels?={{ upload, search, move, delete, details, ... }} />
 * Built from: c.media-frame, c.text-field.outlined, c.select.outlined, c.segmented.segmented, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.form, c.modal.danger
 * Look: A white card: the title with a file count and Upload; a folder list at the left (All files, each folder with its count, New folder); a search box beside a Grid / List switch; square picture tiles (a gradient stand-in or the uploaded picture, a round check at the corner, a play or page mark for videos and documents) or compact rows; a sunken bar with the selection count, Move, Delete and Clear; a details panel slides in at the right with a large preview, facts and the rename form.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-medium --weight-semibold --focus-ring --surface-shadow-overlay --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: media library; asset manager; image library; file manager; brand assets; content uploads; CMS media
 * Jobs to be done: find the photo I uploaded last week; upload new pictures into the right folder; move a set of files to another folder at once; rename a file and give it alt text; delete files I no longer need and take it back if that was a mistake
 * Keywords: media library, assets, images, files, folders, grid, list, multi-select, upload, move, rename, alt text, details panel, drag and drop
 */
/**
 * Media library: the files of a workspace in folders. The files are one listbox that allows many choices: arrow keys
 * move (up and down by a row in the grid), Space adds or removes the focused file, Shift with an arrow extends the
 * choice, Ctrl+A chooses every file shown, Escape clears, Enter opens the details and Delete asks to delete. With a
 * pointer, a click chooses one file, Ctrl or Cmd click adds one and Shift click a range. Folders are a list of
 * buttons with arrow keys too. Uploads are read locally (pictures show through an object URL) and their progress is
 * simulated, so nothing is sent anywhere. Files glide to their places when the folder, search or view changes (FLIP),
 * and the details panel slides in; with motion off both simply appear.
 * Adapted from Meraki UI (MIT, Copyright (c) 2021 Khatab Wedaa): its files table and portfolio filter components, and
 * Tailblocks (MIT, Copyright (c) 2020 Mert Cukuren): its gallery blocks.
 */
/**
 * How to try it
 * - Wait for the tiles to load. Click a picture: the details panel slides in. Rename it to an empty name: the field
 *   says why. Give it alt text and Save.
 * - Focus the files and use the arrow keys; Space adds files to the choice, Shift+arrow extends it. Press Move, pick
 *   "Campaign" and confirm: the files leave this folder. Choose Delete, confirm, then Undo.
 * - Press Upload (or drop files on the grid): each shows progress with Cancel; a file over 20 MB says it is too large.
 * - Make a New folder (an empty or taken name is refused), open it: it is empty with an Upload button.
 * - Switch to List, search "zzz" for the no-match state.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's MediaFrame, TextField,
 * Select, Segmented, Button and Modal ("./media-frames", "./text-fields-states", "./dropdowns-states",
 * "./segmented-control", "./buttons-variants", "./modals-dialogs") and its inline icon set ("./icons"). URL object
 * URLs from the browser. Nothing else: no package and nothing fetched. The styles are the library's own fl- classes
 * in templates/library/css/r5d-media-library.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.media-library: folders of files in a grid or list, with select, move, rename, delete and upload. ──

export type MediaKind = "image" | "video" | "doc";
export type MediaItem = { id: string; name: string; kind: MediaKind; folder: string; size: number; added: string; width?: number; height?: number; alt?: string; art?: MediaArt; src?: string };
export type MediaFolder = { id: string; name: string };

export type MediaLibraryLabels = Partial<{
  count: string;
  upload: string;
  allFiles: string;
  folders: string;
  newFolder: string;
  folderName: string;
  create: string;
  search: string;
  view: string;
  grid: string;
  list: string;
  selected: string;
  move: string;
  moveTitle: string;
  moveTo: string;
  movePick: string;
  moveSame: string;
  moved: string;
  remove: string;
  removeTitle: string;
  removeText: string;
  removed: string;
  clear: string;
  details: string;
  close: string;
  name: string;
  alt: string;
  save: string;
  saved: string;
  noneChosen: string;
  manyChosen: string;
  undo: string;
  undone: string;
  uploading: string;
  uploaded: string;
  cancel: string;
  canceled: string;
  tooLarge: string;
  dismiss: string;
  drop: string;
  loading: string;
  loadFailed: string;
  retry: string;
  empty: string;
  emptyText: string;
  noMatch: string;
  clearSearch: string;
  required: string;
  slash: string;
  tooLong: string;
  taken: string;
}>;

export type MediaLibraryProps = {
  title: string;
  lede?: string;
  folders: MediaFolder[];
  /** The files to start with. Ignored while `load` is given. */
  items?: MediaItem[];
  /** Loads the files; tiles show as loading until it settles, and a failure offers Retry. */
  load?: () => Promise<MediaItem[]>;
  /** Largest upload allowed, in bytes; 20 MB when left out. */
  maxBytes?: number;
  /** Gets the files and folders after every change (and after Undo). */
  onChange?: (items: MediaItem[], folders: MediaFolder[]) => void;
  labels?: MediaLibraryLabels;
};

type Upload = { id: string; name: string; size: number; progress: number; error?: string; file?: File };
type Undo = { before: MediaItem[]; text: string };

const KIND_ICON: Record<MediaKind, string> = { image: "image", video: "play", doc: "layers" };
const KIND_NAME: Record<MediaKind, string> = { image: "Picture", video: "Video", doc: "Document" };
const ARTS: MediaArt[] = ["a", "b", "c", "d", "e"];

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
export function formatBytes(n: number) {
  const one = (v: number) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  if (n < 1000) return `${n} B`;
  if (n < 1e6) return `${one(n / 1e3)} KB`;
  if (n < 1e9) return `${one(n / 1e6)} MB`;
  return `${one(n / 1e9)} GB`;
}
/** Fills {n} in a label, saying "1 file" rather than "1 files". */
const fill = (tpl: string, n: number) => tpl.replace("{n} files", n === 1 ? "1 file" : `${n} files`).replace("{n}", String(n));
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** FLIP: items marked data-flip glide from where they were to where they are whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) {
      last.current = new Map();
      return;
    }
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    const now = new Map(nodes.map((n) => [n.dataset.flip!, n.getBoundingClientRect()]));
    if (!motionOff() && last.current.size) {
      const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
      nodes.forEach((n, i) => {
        const was = last.current.get(n.dataset.flip!);
        const is = now.get(n.dataset.flip!)!;
        if (!was) {
          n.animate([{ opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1 }], { duration: tokenMs("--duration-base", 200), delay: Math.min(i, 6) * tokenMs("--stagger", 30), easing: ease, fill: "backwards" });
        } else if (was.left !== is.left || was.top !== is.top) {
          n.animate([{ translate: `${was.left - is.left}px ${was.top - is.top}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: ease });
        }
      });
    }
    last.current = now;
  }, [key, box]);
}

export function MediaLibrary({ title, lede, folders: initialFolders, items: initial = [], load, maxBytes = 20_000_000, onChange, labels = {} }: MediaLibraryProps) {
  const l = {
    count: "{n} files",
    upload: "Upload",
    allFiles: "All files",
    folders: "Folders",
    newFolder: "New folder",
    folderName: "Folder name",
    create: "Create folder",
    search: "Search files",
    view: "View",
    grid: "Grid",
    list: "List",
    selected: "{n} selected",
    move: "Move",
    moveTitle: "Move {n} files",
    moveTo: "Move to",
    movePick: "Choose a folder",
    moveSame: "They're already in that folder.",
    moved: "Moved {n} files to {folder}.",
    remove: "Delete",
    removeTitle: "Delete {n} files?",
    removeText: "They come out of every page that uses them.",
    removed: "Deleted {n} files.",
    clear: "Clear",
    details: "Details",
    close: "Close details",
    name: "File name",
    alt: "Alt text",
    save: "Save",
    saved: "Saved “{name}”.",
    noneChosen: "Choose a file to see its details.",
    manyChosen: "{n} files chosen",
    undo: "Undo",
    undone: "Undone.",
    uploading: "Uploading {name}",
    uploaded: "Uploaded “{name}”.",
    cancel: "Cancel",
    canceled: "Canceled “{name}”.",
    tooLarge: "Too large. Keep files under {max}.",
    dismiss: "Dismiss",
    drop: "Drop files to upload",
    loading: "Loading files…",
    loadFailed: "Couldn't load the files.",
    retry: "Retry",
    empty: "Nothing here yet",
    emptyText: "Upload files or move some into this folder.",
    noMatch: "No files match “{q}”",
    clearSearch: "Clear search",
    required: "Give it a name.",
    slash: "Names can't contain a slash.",
    tooLong: "Keep it to 60 characters.",
    taken: "That name is already used here.",
    ...labels,
  };
  const id = useId();
  const [items, setItems] = useState<MediaItem[]>(load ? [] : initial);
  const [folders, setFolders] = useState<MediaFolder[]>(initialFolders);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(load ? "loading" : "ready");
  const [folder, setFolder] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [draft, setDraft] = useState({ name: "", alt: "", error: "" });
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveErr, setMoveErr] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [making, setMaking] = useState(false);
  const [folderErr, setFolderErr] = useState("");
  const [undo, setUndo] = useState<Undo | null>(null);
  const [said, setSaid] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timers = useRef(new Map<string, number>());
  const undoTimer = useRef<number | undefined>(undefined);
  const urls = useRef<string[]>([]);
  const prog = useRef(new Map<string, number>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const later = (fn: () => void) => window.setTimeout(fn, 0);

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
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearInterval(t));
      window.clearTimeout(undoTimer.current);
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const commit = (next: MediaItem[], message: string, undoable?: MediaItem[], nextFolders = folders) => {
    setItems(next);
    onChange?.(next, nextFolders);
    setSaid(message);
    window.clearTimeout(undoTimer.current);
    if (undoable) {
      setUndo({ before: undoable, text: message });
      undoTimer.current = window.setTimeout(() => setUndo(null), 10000);
      // After a dialog closes and hands focus back; the row that had focus may be gone, so Undo is the next useful place.
      window.setTimeout(() => document.getElementById(`${id}-undo`)?.focus(), 60);
    } else setUndo(null);
  };

  const q = query.trim().toLowerCase();
  const inFolder = items.filter((i) => folder === "all" || i.folder === folder);
  const shown = inFolder.filter((i) => !q || i.name.toLowerCase().includes(q)).sort((a, b) => b.added.localeCompare(a.added));
  const shownIds = shown.map((i) => i.id);
  const chosen = selected.filter((s) => items.some((i) => i.id === s));
  const one = chosen.length === 1 ? items.find((i) => i.id === chosen[0]) ?? null : null;
  const focusId = active && shownIds.includes(active) ? active : shownIds[0] ?? null;
  useFlip(listRef, `${phase}|${view}|${shownIds.join(",")}`);

  // The rename form follows the one chosen file.
  useEffect(() => {
    setDraft(one ? { name: one.name, alt: one.alt ?? "", error: "" } : { name: "", alt: "", error: "" });
  }, [one?.id, one?.name, one?.alt]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusOption = (fid: string | null) => fid && later(() => document.getElementById(`${id}-o-${fid}`)?.focus());
  const select = (ids: string[], focus?: string) => {
    setSelected(ids);
    if (focus) setActive(focus);
  };

  const columns = () => {
    if (view === "list") return 1;
    const opts = listRef.current?.querySelectorAll<HTMLElement>("[role=option]");
    if (!opts?.length) return 1;
    const top = opts[0].offsetTop;
    let n = 0;
    for (const o of Array.from(opts)) {
      if (o.offsetTop !== top) break;
      n++;
    }
    return Math.max(1, n);
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!focusId) return;
    const i = shownIds.indexOf(focusId);
    const cols = columns();
    let next = -1;
    if (e.key === "ArrowRight") next = Math.min(shownIds.length - 1, i + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, i - 1);
    else if (e.key === "ArrowDown") next = Math.min(shownIds.length - 1, i + cols);
    else if (e.key === "ArrowUp") next = Math.max(0, i - cols);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = shownIds.length - 1;
    if (next >= 0) {
      e.preventDefault();
      const to = shownIds[next];
      if (e.shiftKey) {
        const from = anchor && shownIds.includes(anchor) ? anchor : focusId;
        const [a, b] = [shownIds.indexOf(from), next].sort((x, y) => x - y);
        setAnchor(from);
        select(shownIds.slice(a, b + 1), to);
      } else setActive(to);
      focusOption(to);
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      setAnchor(focusId);
      setSelected((s) => (s.includes(focusId) ? s.filter((x) => x !== focusId) : [...s, focusId]));
    } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      select(shownIds);
      setSaid(fill(l.selected, shownIds.length));
    } else if (e.key === "Escape" && chosen.length) {
      e.preventDefault();
      select([]);
      setSaid(fill(l.selected, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!chosen.includes(focusId)) select([focusId], focusId);
      openPanel();
    } else if ((e.key === "Delete" || e.key === "Backspace") && chosen.length) {
      e.preventDefault();
      setDeleting(true);
    }
  };

  const onOptionClick = (e: MouseEvent, oid: string) => {
    setActive(oid);
    if (e.shiftKey && anchor && shownIds.includes(anchor)) {
      const [a, b] = [shownIds.indexOf(anchor), shownIds.indexOf(oid)].sort((x, y) => x - y);
      select(shownIds.slice(a, b + 1));
    } else if (e.ctrlKey || e.metaKey) {
      setAnchor(oid);
      setSelected((s) => (s.includes(oid) ? s.filter((x) => x !== oid) : [...s, oid]));
    } else {
      setAnchor(oid);
      select([oid]);
      // Wide layouts open the details beside the files; narrow ones keep them a button press away (Details).
      const wide = (listRef.current?.closest(".fl-mlib")?.clientWidth ?? 0) > 832;
      if (e.detail > 0 && wide) setPanel(true);
    }
  };
  const toggleCheck = (e: MouseEvent, oid: string) => {
    e.stopPropagation();
    setActive(oid);
    setAnchor(oid);
    setSelected((s) => (s.includes(oid) ? s.filter((x) => x !== oid) : [...s, oid]));
    focusOption(oid);
  };

  const openPanel = () => {
    setPanel(true);
    later(() => document.getElementById(`${id}-panel-title`)?.focus());
  };
  const closePanel = () => {
    setPanel(false);
    focusOption(focusId);
  };

  const checkName = (value: string, item: MediaItem) => {
    const v = value.trim();
    if (!v) return l.required;
    if (v.includes("/")) return l.slash;
    if (v.length > 60) return l.tooLong;
    if (items.some((i) => i.id !== item.id && i.folder === item.folder && i.name.toLowerCase() === v.toLowerCase())) return l.taken;
    return "";
  };
  const saveDetails = (e: FormEvent) => {
    e.preventDefault();
    if (!one) return;
    const err = checkName(draft.name, one);
    if (err) {
      setDraft({ ...draft, error: err });
      document.getElementById(`${id}-rename`)?.focus();
      return;
    }
    const name = draft.name.trim();
    commit(
      items.map((i) => (i.id === one.id ? { ...i, name, alt: draft.alt.trim() } : i)),
      l.saved.replace("{name}", name),
    );
  };

  const move = (data: FormData) => {
    const to = String(data.get("folder") ?? "");
    const target = folders.find((f) => f.id === to);
    if (!target) {
      setMoveErr(l.movePick);
      later(() => document.getElementById(`${id}-move`)?.focus());
      return false;
    }
    if (chosen.every((c) => items.find((i) => i.id === c)?.folder === to)) {
      setMoveErr(l.moveSame);
      later(() => document.getElementById(`${id}-move`)?.focus());
      return false;
    }
    const n = chosen.length;
    commit(
      items.map((i) => (chosen.includes(i.id) ? { ...i, folder: to } : i)),
      fill(l.moved, n).replace("{folder}", target.name),
      items,
    );
    setMoveErr("");
    if (folder !== "all") select([]);
    return undefined;
  };

  const remove = () => {
    const n = chosen.length;
    commit(
      items.filter((i) => !chosen.includes(i.id)),
      fill(l.removed, n),
      items,
    );
    select([]);
    setPanel(false);
  };

  const doUndo = () => {
    if (!undo) return;
    setItems(undo.before);
    onChange?.(undo.before, folders);
    setUndo(null);
    setSaid(l.undone);
    window.clearTimeout(undoTimer.current);
    later(() => (document.getElementById(`${id}-files`) ?? fileRef.current)?.focus());
  };

  const makeFolder = (data: FormData) => {
    const v = String(data.get("name") ?? "").trim();
    const err = !v ? l.required : v.includes("/") ? l.slash : v.length > 60 ? l.tooLong : folders.some((f) => f.name.toLowerCase() === v.toLowerCase()) ? l.taken : "";
    if (err) {
      setFolderErr(err);
      later(() => document.getElementById(`${id}-fname`)?.focus());
      return false;
    }
    const f = { id: `f${Date.now().toString(36)}`, name: v };
    const next = [...folders, f];
    setFolders(next);
    onChange?.(items, next);
    setFolder(f.id);
    setSaid(`${v}: ${l.empty}`);
    setFolderErr("");
    // After the dialog hands focus back, move it to the new folder.
    window.setTimeout(() => document.getElementById(`${id}-fold-${f.id}`)?.focus(), 60);
    return undefined;
  };

  // Uploads: read locally, progress simulated, then the file joins the open folder.
  const startUploads = (files: FileList | File[]) => {
    const target = folder !== "all" ? folder : folders[0]?.id ?? "";
    const list = Array.from(files);
    if (!list.length) return;
    const fresh: Upload[] = list.map((f, n) => ({ id: `u${Date.now().toString(36)}${n}`, name: f.name, size: f.size, progress: 0, file: f, error: f.size > maxBytes ? l.tooLarge.replace("{max}", formatBytes(maxBytes)) : undefined }));
    setUploads((u) => [...u, ...fresh]);
    setSaid(fresh.map((u) => (u.error ? `${u.name}: ${u.error}` : l.uploading.replace("{name}", u.name))).join(" "));
    for (const u of fresh) {
      if (u.error) continue;
      const file = u.file!;
      prog.current.set(u.id, 0);
      const t = window.setInterval(() => {
        const p = Math.min(100, (prog.current.get(u.id) ?? 0) + 8 + Math.round(Math.random() * 14));
        prog.current.set(u.id, p);
        if (p < 100) {
          setUploads((all) => all.map((x) => (x.id === u.id ? { ...x, progress: p } : x)));
          return;
        }
        window.clearInterval(t);
        timers.current.delete(u.id);
        prog.current.delete(u.id);
        const kind: MediaKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "doc";
        let src: string | undefined;
        if (kind === "image") {
          src = URL.createObjectURL(file);
          urls.current.push(src);
        }
        const item: MediaItem = { id: `m${u.id}`, name: file.name, kind, folder: target, size: file.size, added: new Date().toISOString(), src, art: ARTS[Math.floor(Math.random() * ARTS.length)] };
        const next = [item, ...itemsRef.current];
        itemsRef.current = next;
        setItems(next);
        setUploads((all) => all.filter((x) => x.id !== u.id));
        onChange?.(next, foldersRef.current);
        setSaid(l.uploaded.replace("{name}", file.name));
      }, 180);
      timers.current.set(u.id, t);
    }
  };
  const cancelUpload = (u: Upload) => {
    window.clearInterval(timers.current.get(u.id));
    timers.current.delete(u.id);
    prog.current.delete(u.id);
    setUploads((all) => all.filter((x) => x.id !== u.id));
    setSaid(u.error ? "" : l.canceled.replace("{name}", u.name));
    later(() => document.getElementById(`${id}-upload`)?.focus());
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.currentTarget.files) startUploads(e.currentTarget.files);
    e.currentTarget.value = "";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) startUploads(e.dataTransfer.files);
  };

  const onFolderKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const ids = ["all", ...folders.map((f) => f.id)];
    const i = ids.indexOf((document.activeElement as HTMLElement)?.dataset.folder ?? folder);
    let n = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % ids.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + ids.length) % ids.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = ids.length - 1;
    if (n < 0) return;
    e.preventDefault();
    document.getElementById(`${id}-fold-${ids[n]}`)?.focus();
  };
  const openFolder = (fid: string) => {
    setFolder(fid);
    select([]);
    setActive(null);
  };

  const folderName = (fid: string) => folders.find((f) => f.id === fid)?.name ?? "";
  const totalSize = chosen.reduce((s, c) => s + (items.find((i) => i.id === c)?.size ?? 0), 0);

  return (
    <section className="fl-mlib" aria-labelledby={`${id}-title`} data-fl="p.media-library">
      <header className="fl-mlib-head">
        <div className="fl-mlib-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        {phase === "ready" ? <span className="fl-mlib-count">{fill(l.count, items.length)}</span> : null}
        <Button id={`${id}-upload`} size={40} icon="upload" onClick={() => fileRef.current?.click()}>
          {l.upload}
        </Button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" className="fl-sr" tabIndex={-1} aria-hidden="true" onChange={onPick} />
      </header>

      <div className="fl-mlib-shell">
        <nav className="fl-mlib-folders" aria-label={l.folders}>
          <ul onKeyDown={onFolderKey}>
            {[{ id: "all", name: l.allFiles }, ...folders].map((f) => {
              const n = f.id === "all" ? items.length : items.filter((i) => i.folder === f.id).length;
              const on = folder === f.id;
              return (
                <li key={f.id}>
                  <button id={`${id}-fold-${f.id}`} type="button" data-folder={f.id} aria-label={phase === "ready" ? `${f.name}, ${fill(l.count, n)}` : f.name} className="fl-mlib-folder" aria-current={on ? "true" : undefined} tabIndex={on ? 0 : -1} onClick={() => openFolder(f.id)}>
                    <Icon name={f.id === "all" ? "layers" : "folder"} />
                    <span className="fl-mlib-folder-name">{f.name}</span>
                    <span className="fl-mlib-folder-n">{phase === "ready" ? n : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button variant="tertiary" size={32} icon="plus" className="fl-mlib-newfolder" onClick={() => setMaking(true)}>
            {l.newFolder}
          </Button>
        </nav>

        <div className={["fl-mlib-main", panel ? "has-panel" : ""].filter(Boolean).join(" ")}>
          <div className="fl-mlib-files-col">
            <div className="fl-mlib-tools">
              <span className="fl-mlib-search">
                <Icon name="search" />
                <TextField id={`${id}-search`} type="search" size={40} aria-label={l.search} placeholder={l.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
              </span>
              <Segmented
                size="sm"
                label={l.view}
                value={view}
                onChange={(v) => setView(v as "grid" | "list")}
                options={[
                  { value: "grid", label: l.grid },
                  { value: "list", label: l.list },
                ]}
              />
            </div>

            {uploads.length ? (
              <ul className="fl-mlib-uploads" aria-label={l.upload}>
                {uploads.map((u) => (
                  <li key={u.id} className={u.error ? "is-error" : undefined}>
                    <Icon name={u.error ? "alert" : "upload"} />
                    <div className="fl-mlib-up-main">
                      <span className="fl-mlib-up-name">{u.name}</span>
                      {u.error ? (
                        <span className="fl-mlib-up-err">{u.error}</span>
                      ) : (
                        <span className="fl-mlib-bar" role="progressbar" aria-label={l.uploading.replace("{name}", u.name)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={u.progress}>
                          <span style={{ width: `${u.progress}%` }} />
                        </span>
                      )}
                    </div>
                    <span className="fl-mlib-up-size">{u.error ? formatBytes(u.size) : `${u.progress}%`}</span>
                    <Button variant="tertiary" size={32} onClick={() => cancelUpload(u)}>
                      {u.error ? l.dismiss : l.cancel}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className={["fl-mlib-selbar", chosen.length ? "is-open" : ""].filter(Boolean).join(" ")} inert={!chosen.length || undefined}>
              <div>
                <span className="fl-mlib-selcount">{fill(l.selected, chosen.length)}</span>
                <span className="fl-mlib-selsize">{formatBytes(totalSize)}</span>
                <span className="fl-mlib-selacts">
                  <Button variant="secondary" size={32} icon="folder" onClick={() => setMoving(true)}>
                    {l.move}
                  </Button>
                  <Button variant="secondary" size={32} icon="trash" className="fl-mlib-del" onClick={() => setDeleting(true)}>
                    {l.remove}
                  </Button>
                  <Button variant="tertiary" size={32} icon="eye" onClick={openPanel}>
                    {l.details}
                  </Button>
                  <Button variant="tertiary" size={32} onClick={() => {
                      select([]);
                      focusOption(focusId);
                    }}>
                    {l.clear}
                  </Button>
                </span>
              </div>
            </div>

            <div
              className={["fl-mlib-drop", dragging ? "is-drag" : ""].filter(Boolean).join(" ")}
              onDragOver={(e) => {
                if (Array.from(e.dataTransfer.types).includes("Files")) {
                  e.preventDefault();
                  setDragging(true);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={onDrop}
            >
              {dragging ? (
                <p className="fl-mlib-droptext" aria-hidden="true">
                  <Icon name="upload" />
                  {l.drop}
                </p>
              ) : null}
              {phase === "loading" ? (
                <div className={`fl-mlib-files is-${view}`} aria-busy="true" aria-label={l.loading} role="status">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="fl-mlib-skel" aria-hidden="true" />
                  ))}
                </div>
              ) : phase === "error" ? (
                <div className="fl-mlib-empty" role="alert">
                  <Icon name="alert" />
                  <p className="fl-mlib-empty-title">{l.loadFailed}</p>
                  <Button variant="secondary" size={40} icon="refresh" onClick={fetchItems}>
                    {l.retry}
                  </Button>
                </div>
              ) : !inFolder.length ? (
                <div className="fl-mlib-empty">
                  <Icon name="folder" />
                  <p className="fl-mlib-empty-title">{l.empty}</p>
                  <p>{l.emptyText}</p>
                  <Button variant="secondary" size={40} icon="upload" onClick={() => fileRef.current?.click()}>
                    {l.upload}
                  </Button>
                </div>
              ) : !shown.length ? (
                <div className="fl-mlib-empty">
                  <Icon name="search" />
                  <p className="fl-mlib-empty-title">{l.noMatch.replace("{q}", query.trim())}</p>
                  <Button variant="tertiary" size={32} onClick={() => {
                      setQuery("");
                      document.getElementById(`${id}-search`)?.focus();
                    }}>
                    {l.clearSearch}
                  </Button>
                </div>
              ) : (
                <div
                  id={`${id}-files`}
                  ref={listRef}
                  className={`fl-mlib-files is-${view}`}
                  role="listbox"
                  aria-multiselectable="true"
                  aria-label={`${folder === "all" ? l.allFiles : folderName(folder)}, ${fill(l.count, shown.length)}`}
                  aria-orientation={view === "list" ? "vertical" : undefined}
                  onKeyDown={onListKey}
                  tabIndex={-1}
                  onFocus={(e) => {
                    if (e.target === e.currentTarget) focusOption(focusId);
                  }}
                >
                  {shown.map((it) => {
                    const on = chosen.includes(it.id);
                    return (
                      <div
                        key={it.id}
                        id={`${id}-o-${it.id}`}
                        role="option"
                        aria-selected={on}
                        aria-label={`${it.name}, ${KIND_NAME[it.kind]}, ${formatBytes(it.size)}`}
                        tabIndex={it.id === focusId ? 0 : -1}
                        data-flip={it.id}
                        className="fl-mlib-item"
                        onClick={(e) => onOptionClick(e, it.id)}
                        onFocus={() => setActive(it.id)}
                        onDoubleClick={() => {
                          select([it.id], it.id);
                          openPanel();
                        }}
                      >
                        <span className="fl-mlib-thumb">
                          <MediaFrame ratio={view === "grid" ? "1-1" : "1-1"} src={it.src} alt="" art={it.art ?? "a"} />
                          {it.kind !== "image" ? (
                            <span className="fl-mlib-kind" aria-hidden="true">
                              <Icon name={KIND_ICON[it.kind]} />
                            </span>
                          ) : null}
                        </span>
                        <span className="fl-mlib-check" aria-hidden="true" onClick={(e) => toggleCheck(e, it.id)}>
                          <Icon name="check" />
                        </span>
                        <span className="fl-mlib-name">{it.name}</span>
                        <span className="fl-mlib-meta">
                          {KIND_NAME[it.kind]} · {formatBytes(it.size)}
                          {folder === "all" ? <span className="fl-mlib-meta-folder"> · {folderName(it.folder)}</span> : null}
                        </span>
                        <span className="fl-mlib-date">{dayFmt.format(new Date(it.added))}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className={["fl-mlib-panel", panel ? "is-open" : ""].filter(Boolean).join(" ")} inert={!panel || undefined} aria-labelledby={`${id}-panel-title`}>
            <div className="fl-mlib-panel-in">
              <div className="fl-mlib-panel-head">
                <h3 id={`${id}-panel-title`} tabIndex={-1}>
                  {l.details}
                </h3>
                <Button variant="tertiary" size={32} icon="close" iconOnly onClick={closePanel}>
                  {l.close}
                </Button>
              </div>
              {one ? (
                <>
                  <span className="fl-mlib-preview">
                    <MediaFrame ratio="4-3" src={one.src} alt={one.alt ?? ""} art={one.art ?? "a"} />
                    {one.kind !== "image" ? (
                      <span className="fl-mlib-kind fl-mlib-kind--lg" aria-hidden="true">
                        <Icon name={KIND_ICON[one.kind]} />
                      </span>
                    ) : null}
                  </span>
                  <dl className="fl-mlib-facts">
                    <div>
                      <dt>Type</dt>
                      <dd>{KIND_NAME[one.kind]}</dd>
                    </div>
                    <div>
                      <dt>Size</dt>
                      <dd>{formatBytes(one.size)}</dd>
                    </div>
                    {one.width && one.height ? (
                      <div>
                        <dt>Dimensions</dt>
                        <dd>
                          {one.width} × {one.height}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Added</dt>
                      <dd>{dayFmt.format(new Date(one.added))}</dd>
                    </div>
                    <div>
                      <dt>Folder</dt>
                      <dd>{folderName(one.folder)}</dd>
                    </div>
                  </dl>
                  <form className="fl-mlib-form" noValidate onSubmit={saveDetails}>
                    <div className="fl-mlib-field">
                      <label htmlFor={`${id}-rename`}>{l.name}</label>
                      <TextField
                        id={`${id}-rename`}
                        size={40}
                        value={draft.name}
                        invalid={Boolean(draft.error)}
                        aria-describedby={draft.error ? `${id}-rename-err` : undefined}
                        onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value, error: "" })}
                      />
                      {draft.error ? (
                        <p id={`${id}-rename-err`} className="fl-mlib-error" role="alert">
                          <Icon name="alert" />
                          {draft.error}
                        </p>
                      ) : null}
                    </div>
                    {one.kind === "image" ? (
                      <div className="fl-mlib-field">
                        <label htmlFor={`${id}-alt`}>{l.alt}</label>
                        <TextField id={`${id}-alt`} multiline rows={2} value={draft.alt} placeholder="What the picture shows" onChange={(e) => setDraft({ ...draft, alt: e.currentTarget.value })} />
                      </div>
                    ) : null}
                    <Button type="submit" size={40} disabled={draft.name === one.name && draft.alt === (one.alt ?? "")}>
                      {l.save}
                    </Button>
                  </form>
                </>
              ) : chosen.length > 1 ? (
                <div className="fl-mlib-many">
                  <p className="fl-mlib-empty-title">{fill(l.manyChosen, chosen.length)}</p>
                  <p>{formatBytes(totalSize)}</p>
                  <div className="fl-mlib-stack" aria-hidden="true">
                    {chosen.slice(0, 3).map((c) => {
                      const it = items.find((i) => i.id === c)!;
                      return <MediaFrame key={c} ratio="1-1" src={it.src} art={it.art ?? "a"} />;
                    })}
                  </div>
                </div>
              ) : (
                <p className="fl-mlib-none">{l.noneChosen}</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className={["fl-mlib-undo", undo ? "is-open" : ""].filter(Boolean).join(" ")} inert={!undo || undefined}>
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

      {moving ? (
        <Modal
          variant="form"
          title={fill(l.moveTitle, chosen.length)}
          confirmLabel={l.move}
          onConfirm={move}
          onClose={() => {
            setMoving(false);
            setMoveErr("");
          }}
        >
          <div className="fl-mlib-field">
            <label htmlFor={`${id}-move`}>{l.moveTo}</label>
            <Select
              id={`${id}-move`}
              name="folder"
              placeholder={l.movePick}
              invalid={Boolean(moveErr)}
              aria-describedby={moveErr ? `${id}-move-err` : undefined}
              onChange={() => setMoveErr("")}
              options={folders.map((f) => ({ value: f.id, label: f.name }))}
            />
            {moveErr ? (
              <p id={`${id}-move-err`} className="fl-mlib-error" role="alert">
                <Icon name="alert" />
                {moveErr}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {deleting ? (
        <Modal
          variant="danger"
          icon="trash"
          title={fill(l.removeTitle, chosen.length)}
          description={l.removeText}
          confirmLabel={l.remove}
          onConfirm={() => remove()}
          onClose={() => setDeleting(false)}
        />
      ) : null}

      {making ? (
        <Modal
          variant="form"
          title={l.newFolder}
          confirmLabel={l.create}
          onConfirm={makeFolder}
          onClose={() => {
            setMaking(false);
            setFolderErr("");
          }}
        >
          <div className="fl-mlib-field">
            <label htmlFor={`${id}-fname`}>{l.folderName}</label>
            <TextField
              id={`${id}-fname`}
              name="name"
              size={40}
              placeholder="e.g. Spring campaign"
              invalid={Boolean(folderErr)}
              aria-describedby={folderErr ? `${id}-fname-err` : undefined}
              onChange={() => setFolderErr("")}
            />
            {folderErr ? (
              <p id={`${id}-fname-err`} className="fl-mlib-error" role="alert">
                <Icon name="alert" />
                {folderErr}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();

// flowcode:sample
const SAMPLE = {
  title: "Media",
  lede: "Pictures, videos and documents your pages use.",
  folders: [
    { id: "f1", name: "Brand" },
    { id: "f2", name: "Campaign" },
    { id: "f3", name: "Blog" },
    { id: "f4", name: "Team" },
  ] as MediaFolder[],
  items: [
    { id: "m1", name: "hero-autumn.jpg", kind: "image", folder: "f2", size: 2_480_000, added: ago(0, 3), width: 2400, height: 1600, art: "e", alt: "Orange leaves over a quiet street" },
    { id: "m2", name: "logo-mark.png", kind: "image", folder: "f1", size: 84_000, added: ago(1), width: 1024, height: 1024, art: "a" },
    { id: "m3", name: "launch-teaser.mp4", kind: "video", folder: "f2", size: 18_400_000, added: ago(2), width: 1920, height: 1080, art: "b" },
    { id: "m4", name: "brand-guide.pdf", kind: "doc", folder: "f1", size: 5_200_000, added: ago(4), art: "c" },
    { id: "m5", name: "office-morning.jpg", kind: "image", folder: "f4", size: 1_960_000, added: ago(5), width: 2000, height: 1333, art: "d" },
    { id: "m6", name: "post-cover-pricing.jpg", kind: "image", folder: "f3", size: 1_120_000, added: ago(6), width: 1600, height: 900, art: "b" },
    { id: "m7", name: "team-offsite.jpg", kind: "image", folder: "f4", size: 3_050_000, added: ago(9), width: 2400, height: 1600, art: "e" },
    { id: "m8", name: "press-release.pdf", kind: "doc", folder: "f2", size: 640_000, added: ago(12), art: "a" },
    { id: "m9", name: "post-cover-roadmap.jpg", kind: "image", folder: "f3", size: 980_000, added: ago(15), width: 1600, height: 900, art: "c" },
  ] as MediaItem[],
};

export default function MediaLibrarySheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <MediaLibrary title={SAMPLE.title} lede={SAMPLE.lede} folders={SAMPLE.folders} load={() => new Promise((r) => window.setTimeout(() => r(SAMPLE.items), 700))} />
      </div>
    </section>
  );
}
