/** @flowcode-library file-upload-states · File upload: dropzone and the files after it (Forms)
 * Catalog ID: p.file-upload (pattern)
 * Function: The file upload pattern (p.file-upload); the reference sheet shows the dropzone in waiting, dragged-over, uploading and refused states, plus a live one that takes only images and PDFs, with the file list and its retry and remove actions.
 * Use it as: import { FileUpload } from "./file-upload-states"; <FileUpload version?="default"|"classic" limitMb?={10} hint?="PDF, PNG or JPG" accept?="image/*,.pdf" multiple? initialFiles?={[{ id, name, size, state: "done"|"busy"|"error", note, pct, retry }]} onChange?={(rows) => ...} />
 * Built from: c.button.secondary, c.button.tertiary, c.progress.bar
 * Look: A dashed dropzone that tints when a file is dragged over it, with a list under it: name, size and note per file, a thin progress bar while uploading, and Try again or a remove button at the right.
 * Tokens: --color-surface --color-border-strong --color-accent --color-danger --color-text-muted --radius-lg --space-2 --space-4 --space-6
 * Use cases: attach a PRD; upload photos; import a spreadsheet; profile picture; supporting documents; file upload; photo upload; document upload; receipt upload; attachments; id verification upload; resume upload; image upload
 * Jobs to be done: add a file; see it is going up; know when it failed and try again; attach photos to my request; upload receipts or documents; remove a file i added by mistake; see my upload finish
 * Keywords: upload, dropzone, drag and drop, progress, attachment, error, file, validation
 */
/**
 * A dropzone in each state it passes through, and the list of files underneath it, because an upload is never only
 * the moment of dropping: a file goes up, finishes, or fails and has to be retried.
 *
 * The first zone is live. Drop a file on it, or click to pick one, and it appears in the list below and climbs to
 * done; anything over the size limit lands as refused. Only a file that failed on the way up offers Try again, because
 * retrying one that is too big would fail the same way. The other three zones are the first one, frozen mid-state.
 *
 * Make it the app's own: set which file kinds you take and say so in the dropzone. Keep the retry on rows that can
 * succeed on a second try, and only on those.
 */
/**
 * How to try it
 * - Drop a file on the live zone, or press it to pick one: it appears in the list and climbs to done.
 * - Drop something over 10 MB: it lands refused, and offers no retry, because retrying it would fail the same way.
 * - Press "Try again" on the row that lost its connection: that one can succeed.
 * - Press the x on any row to remove it.
 *
 * Dependencies: React (useEffect, useRef, useState), and the library's own inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a
 * built app exactly as it runs here.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Progress } from "./progress-indicators";

// ── p.file-upload: the dropzone and the files after it. Built from c.button and c.progress. ──

export type UploadRow = { id: string; name: string; size: string; state: "done" | "busy" | "error"; note: string; pct: number; retry: boolean };
/** default = the compact dropzone and file list; classic = a roomy drop zone with a Browse button beside "or", a type icon per file and a progress bar on every row. */
export type FileUploadVersion = "default" | "classic";

/** The icon in front of a file in the classic list: a page for a PDF or other document, a picture for an image. */
function FileKindIcon({ pdf }: { pdf: boolean }) {
  return pdf ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m21 16-5-5-9 9" />
    </svg>
  );
}

type UploadProps = {
  /** Look: "default" or "classic" (refused files are listed above the list instead of becoming rows). */
  version?: FileUploadVersion;
  /** classic: the dropzone's heading (default "Drag files here"). */
  dropLabel?: string;
  /** classic: the label on the Browse button (default "Browse files"). */
  browseLabel?: string;
  /** Largest file taken, in MB; bigger ones land as refused with no retry. */
  limitMb?: number;
  /** Said inside the dropzone, for example "PDF, PNG or JPG". The limit is added after it. */
  hint?: string;
  /** Kinds taken, as an input's accept list, for example "image/*,.pdf". Anything else lands as refused with no retry. */
  accept?: string;
  /** More than one file at a time (true when left out). */
  multiple?: boolean;
  /** Rows already in the list. */
  initialFiles?: UploadRow[];
  /** Called with the whole list whenever it changes. */
  onChange?: (rows: UploadRow[]) => void;
  className?: string;
};

function saySize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Does the file match an accept list such as "image/*,.pdf"? An empty list takes everything. */
function accepted(f: File, accept?: string) {
  const want = (accept ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!want.length) return true;
  return want.some((t) => (t.startsWith(".") ? f.name.toLowerCase().endsWith(t) : t.endsWith("/*") ? f.type.toLowerCase().startsWith(t.slice(0, -1)) : f.type.toLowerCase() === t));
}

export function FileUpload({ version = "default", dropLabel = "Drag files here", browseLabel = "Browse files", limitMb = 10, hint = "PDF, PNG or JPG", accept, multiple = true, initialFiles = [], onChange, className }: UploadProps) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [rows, setRows] = useState<UploadRow[]>(initialFiles);
  const [over, setOver] = useState(false);
  const [said, setSaid] = useState("");
  const seq = useRef(0);
  const busy = rows.some((r) => r.state === "busy");
  const notify = useRef(onChange);
  notify.current = onChange;
  useEffect(() => notify.current?.(rows), [rows]);

  // Anything mid-upload climbs on its own, then settles as done.
  useEffect(() => {
    if (!busy) return;
    const tick = window.setInterval(() => {
      setRows((rs) =>
        rs.map((r) => {
          if (r.state !== "busy") return r;
          const pct = Math.min(100, r.pct + 9);
          return pct >= 100 ? { ...r, pct: 100, state: "done", note: "Added" } : { ...r, pct, note: `${pct}%` };
        })
      );
    }, 260);
    return () => window.clearInterval(tick);
  }, [busy]);

  const take = (files: FileList | null) => {
    if (!files || !files.length) return;
    const limit = limitMb * 1048576;
    if (version === "classic") {
      // Classic: a refused file is named in an alert above the list and never becomes a row.
      const ok: UploadRow[] = [];
      const refused: string[] = [];
      Array.from(multiple ? files : [files[0]]).forEach((f) => {
        if (!accepted(f, accept)) refused.push(`${f.name} isn't a kind we take (${hint}), so it wasn't added.`);
        else if (f.size > limit) refused.push(`${f.name} is larger than ${limitMb} MB, so it wasn't added.`);
        else {
          seq.current += 1;
          ok.push({ id: `up-${seq.current}`, name: f.name, size: saySize(f.size), state: "busy", note: "0%", pct: 0, retry: false });
        }
      });
      setProblems(refused);
      if (ok.length) setRows((rs) => [...rs, ...ok]);
      setSaid(ok.length ? `${ok.length} file${ok.length > 1 ? "s" : ""} added, uploading.` : refused.length ? `${refused.length} refused` : "");
      return;
    }
    const added: UploadRow[] = Array.from(multiple ? files : [files[0]]).map((f) => {
      seq.current += 1;
      const wrongKind = !accepted(f, accept);
      const tooBig = f.size > limit;
      return {
        id: `up-${seq.current}`,
        name: f.name,
        size: saySize(f.size),
        state: wrongKind || tooBig ? "error" : "busy",
        note: wrongKind ? `Not a kind we take: ${hint}` : tooBig ? `Too big: ${limitMb} MB is the most` : "0%",
        pct: 0,
        retry: false,
      };
    });
    setRows((rs) => [...rs, ...added]);
    const refused = added.filter((r) => r.state === "error").length;
    setSaid(refused ? `${added.length} added, ${refused} refused` : `Adding ${added.length} file${added.length === 1 ? "" : "s"}`);
  };

  const retry = (id: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, state: "busy", pct: 0, note: "0%" } : r)));
    setSaid("Trying that one again");
  };

  const drop = (id: string, name: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setSaid(`Removed ${name}`);
  };

  if (version === "classic") {
    const isPdf = (n: string) => !/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(n);
    return (
      <div className={className} data-fl="p.file-upload@classic">
        <div
          className={`fl-in-drop${over ? " fl-in-drop--over" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files);
          }}
        >
          <span className="fl-icon" aria-hidden="true">
            <Icon name="upload" />
          </span>
          <strong className="fl-in-drop__title">{dropLabel}</strong>
          <span className="fl-meta">or</span>
          <Button variant="secondary" aria-describedby={`${uid}-hint`} onClick={() => inputRef.current?.click()}>
            {browseLabel}
          </Button>
          <span id={`${uid}-hint`} className="fl-note">
            {hint}, up to {limitMb} MB each.
          </span>
          <input
            ref={inputRef}
            className="fl-sr"
            type="file"
            multiple={multiple}
            accept={accept}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              take(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {problems.length > 0 ? (
          <ul className="fl-in-errors" role="alert">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}

        {rows.length === 0 ? (
          <p className="fl-in-empty">No files yet. Anything you add shows up here.</p>
        ) : (
          <ul className="fl-in-files" aria-label="Chosen files">
            {rows.map((f) => (
              <li key={f.id} className="fl-in-file">
                <span className={`fl-in-file__icon ${isPdf(f.name) ? "fl-in-file__icon--pdf" : "fl-in-file__icon--image"}`}>
                  <FileKindIcon pdf={isPdf(f.name)} />
                </span>
                <div className="fl-in-file__body">
                  <div className="fl-in-file__row">
                    <span className="fl-in-file__name">{f.name}</span>
                    <span className="fl-meta">{f.state === "busy" ? `${f.pct}%` : f.size}</span>
                  </div>
                  <div className="fl-in-progress" role="progressbar" aria-label={`Uploading ${f.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.pct}>
                    <span style={{ width: `${f.pct}%` }} className={f.pct === 100 ? "fl-in-progress__bar fl-in-progress__bar--done" : "fl-in-progress__bar"} />
                  </div>
                  {f.state === "done" ? (
                    <span className="fl-in-file__ok">
                      <Icon name="check" /> Uploaded · {f.size}
                    </span>
                  ) : null}
                  {f.state === "error" ? <span className="fl-in-error">{f.note}</span> : null}
                </div>
                {f.state === "error" && f.retry ? (
                  <Button variant="secondary" size={32} onClick={() => retry(f.id)}>
                    Try again
                  </Button>
                ) : (
                  <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => drop(f.id, f.name)}>
                    {`Remove ${f.name}`}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="fl-sr" aria-live="polite">
          {said}
        </p>
      </div>
    );
  }

  return (
    <div className={className} data-fl="p.file-upload">
      <label
        className={`fl-ctl-zone fl-ctl-zone--live${over ? " is-over" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple={multiple}
          accept={accept}
          className="fl-sr"
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
        <Icon name="download" />
        <strong>{over ? "Let go to add them" : multiple ? "Drop files here" : "Drop a file here"}</strong>
        <span className="fl-ctl-matrix-what">
          {hint}, up to {limitMb} MB
        </span>
      </label>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || `${rows.length} file${rows.length === 1 ? "" : "s"} in the list.`}
      </p>

      {rows.length ? (
        <ul className="fl-ctl-file-list">
          {rows.map((f) => (
            <li key={f.id} className={`is-${f.state}`}>
              <span className="fl-ctl-file-main">
                <strong>{f.name}</strong>
                <span className="fl-ctl-matrix-what">
                  {f.size} · {f.note}
                </span>
                {f.state === "busy" ? <Progress thin value={f.pct} label={`Uploading ${f.name}`} /> : null}
              </span>
              {f.state === "error" && f.retry ? (
                <Button variant="secondary" size={32} onClick={() => retry(f.id)}>
                  Try again
                </Button>
              ) : (
                <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => drop(f.id, f.name)}>
                  {`Remove ${f.name}`}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="fl-ctl-matrix-what">Nothing attached yet.</p>
      )}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  zones: [
    { id: "idle", label: "Waiting", what: "Nothing happening yet. The live one is below: drop a file, or click it.", cls: "" },
    { id: "over", label: "File over it", what: "A file is being dragged across", cls: " is-over" },
    { id: "busy", label: "Uploading", what: "On its way up", cls: " is-busy" },
    { id: "error", label: "Refused", what: "Wrong kind, or too big", cls: " is-error" },
  ],
  files: [
    { id: "f1", name: "brief-v3.pdf", size: "240 KB", state: "done", note: "Added", pct: 100, retry: false },
    { id: "f2", name: "moodboard.png", size: "3.1 MB", state: "busy", note: "62%", pct: 62, retry: false },
    { id: "f3", name: "venue-walkthrough.mov", size: "7.4 MB", state: "error", note: "Lost connection partway", pct: 0, retry: true },
    { id: "f4", name: "shot-list.xlsx", size: "18 MB", state: "error", note: "Too big: 10 MB is the most", pct: 0, retry: false },
  ] as UploadRow[],
  limitMb: 10,
};

export default function FileUploadStates() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <ul className="fl-ctl-zone-grid">
          {d.zones.map((z) => (
            <li key={z.id}>
              <p className="fl-ctl-matrix-kind">{z.label}</p>
              <p className="fl-ctl-matrix-what">{z.what}</p>
              <div className={`fl-ctl-zone${z.cls}`}>
                <Icon name={z.id === "error" ? "close" : "download"} />
                {z.id === "idle" ? (
                  <>
                    <strong>Drop files here</strong>
                    <span className="fl-ctl-matrix-what">PDF, PNG or JPG, up to {d.limitMb} MB</span>
                  </>
                ) : null}
                {z.id === "over" ? <strong>Let go to add them</strong> : null}
                {z.id === "busy" ? (
                  <>
                    <strong>Adding 2 files</strong>
                    <Progress thin value={62} label="Adding 2 files" />
                  </>
                ) : null}
                {z.id === "error" ? (
                  <>
                    <strong>That file was not added</strong>
                    <span className="fl-ctl-matrix-what">shot-list.xlsx is 18 MB. The most is {d.limitMb} MB.</span>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>The live one, and the files underneath</h3>
        <p className="fl-ctl-btn-what">One row per file: what it is, how it is going, and what you can do about it. This one takes images and PDFs only; anything else, or anything over the size, is refused with the reason.</p>
        <FileUpload limitMb={d.limitMb} accept="image/*,.pdf" hint="JPG, PNG, WebP or PDF" initialFiles={d.files} />
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Version: classic (p.file-upload@classic)</h3>
        <p className="fl-ctl-btn-what">
          A roomy drop zone with a Browse button beside "or", then a list with a type icon, a progress bar and a remove button
          on every file. A file that is the wrong kind or too big is named in an alert above the list instead of joining it.
        </p>
        <FileUpload version="classic" limitMb={d.limitMb} accept="image/*,.pdf" hint="JPG, PNG, WebP or PDF" />
      </div>
    </section>
  );
}
