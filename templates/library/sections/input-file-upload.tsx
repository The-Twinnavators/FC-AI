/** @flowcode-library input-file-upload · File upload (Forms)
 * Use cases: file upload; photo upload; document upload; receipt upload; attachments; id verification upload; resume upload; image upload
 * Jobs to be done: attach photos to my request; upload receipts or documents; remove a file i added by mistake; see my upload finish
 * Keywords: upload, file, drag and drop, dropzone, attachment, progress, validation
 */
/**
 * Input: file upload. A drop zone with a browse button, then a list of the chosen files with a type icon, size, a
 * progress bar and a remove button. Files that are the wrong type or too big are refused with a clear reason. The
 * upload is simulated; nothing leaves the browser. Use it for attaching photos, receipts or documents to a booking or
 * an order. Make it the app's own: replace SAMPLE with the real accepted types and size limit, and swap the timer for
 * the real upload.
 */
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Attach your floor plan",
  lede: "Add photos of the room or a PDF plan so we can quote the job before the visit.",
  drop: "Drag files here",
  or: "or",
  browse: "Browse files",
  hint: "JPG, PNG, WebP or PDF, up to 10 MB each.",
  accept: "image/jpeg,image/png,image/webp,image/gif,application/pdf",
  maxBytes: 10 * 1024 * 1024,
  empty: "No files yet. Anything you add shows up here.",
  errorType: "isn't an image or PDF, so it wasn't added.",
  errorSize: "is larger than 10 MB, so it wasn't added.",
  submit: "Send to the studio",
  needFile: "Add at least one file before sending.",
  waiting: "Wait for the uploads to finish.",
  done: "Thanks. Your files are with the studio and we'll reply within a day.",
};

type Item = { id: string; name: string; size: number; kind: "image" | "pdf"; progress: number };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindOf(file: File): Item["kind"] | null {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name)) return "image";
  return null;
}

function FileIcon({ kind }: { kind: Item["kind"] }) {
  return kind === "pdf" ? (
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

export default function InputFileUpload() {
  const d = SAMPLE;
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState("");

  // Simulated upload: every file still below 100% moves forward a little on each tick.
  const uploading = items.some((i) => i.progress < 100);
  useEffect(() => {
    if (!uploading) return;
    const t = window.setInterval(() => {
      setItems((list) =>
        list.map((i) => {
          if (i.progress >= 100) return i;
          return { ...i, progress: Math.min(100, i.progress + 8 + Math.round(Math.random() * 14)) };
        }),
      );
    }, 220);
    return () => window.clearInterval(t);
  }, [uploading]);

  // Announce once when every file in the list has finished.
  const wasUploading = useRef(false);
  useEffect(() => {
    if (wasUploading.current && !uploading && items.length > 0) setStatus("All files uploaded.");
    wasUploading.current = uploading;
  }, [uploading, items.length]);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const added: Item[] = [];
    const problems: string[] = [];
    Array.from(files).forEach((f, n) => {
      const kind = kindOf(f);
      if (!kind) problems.push(`${f.name} ${d.errorType}`);
      else if (f.size > d.maxBytes) problems.push(`${f.name} ${d.errorSize}`);
      else added.push({ id: `${Date.now()}-${n}-${f.name}`, name: f.name, size: f.size, kind, progress: 0 });
    });
    setErrors(problems);
    setFormError("");
    setSent(false);
    if (added.length) {
      setItems((list) => [...list, ...added]);
      setStatus(`${added.length} file${added.length > 1 ? "s" : ""} added, uploading.`);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    addFiles(e.dataTransfer.files);
  }

  function remove(item: Item) {
    setItems((list) => list.filter((i) => i.id !== item.id));
    setStatus(`${item.name} removed.`);
  }

  function submit() {
    if (items.length === 0) return setFormError(d.needFile);
    if (uploading) return setFormError(d.waiting);
    setFormError("");
    setSent(true);
    setItems([]);
    setErrors([]);
  }

  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-card fl-in-panel">
          <div
            className={`fl-in-drop${over ? " fl-in-drop--over" : ""}${formError && items.length === 0 ? " fl-in-drop--invalid" : ""}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <span className="fl-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </span>
            <strong className="fl-in-drop__title">{d.drop}</strong>
            <span className="fl-meta">{d.or}</span>
            <button type="button" className="fl-btn fl-btn--secondary" aria-describedby={`${uid}-hint`} onClick={() => inputRef.current?.click()}>
              {d.browse}
            </button>
            <span id={`${uid}-hint`} className="fl-note">
              {d.hint}
            </span>
            <input
              ref={inputRef}
              id={`${uid}-file`}
              className="fl-sr"
              type="file"
              multiple
              accept={d.accept}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {errors.length > 0 && (
            <ul className="fl-in-errors" role="alert">
              {errors.map((er) => (
                <li key={er}>{er}</li>
              ))}
            </ul>
          )}

          {items.length === 0 ? (
            !sent && <p className="fl-in-empty">{d.empty}</p>
          ) : (
            <ul className="fl-in-files" aria-label="Chosen files">
              {items.map((i) => (
                <li key={i.id} className="fl-in-file">
                  <span className={`fl-in-file__icon fl-in-file__icon--${i.kind}`}>
                    <FileIcon kind={i.kind} />
                  </span>
                  <div className="fl-in-file__body">
                    <div className="fl-in-file__row">
                      <span className="fl-in-file__name">{i.name}</span>
                      <span className="fl-meta">{i.progress < 100 ? `${i.progress}%` : formatSize(i.size)}</span>
                    </div>
                    <div
                      className="fl-in-progress"
                      role="progressbar"
                      aria-label={`Uploading ${i.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={i.progress}
                    >
                      <span style={{ width: `${i.progress}%` }} className={i.progress === 100 ? "fl-in-progress__bar fl-in-progress__bar--done" : "fl-in-progress__bar"} />
                    </div>
                    {i.progress === 100 && (
                      <span className="fl-in-file__ok">
                        <Icon name="check" /> Uploaded · {formatSize(i.size)}
                      </span>
                    )}
                  </div>
                  <button type="button" className="fl-in-iconbtn" aria-label={`Remove ${i.name}`} onClick={() => remove(i)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {formError && (
            <p className="fl-in-error" role="alert">
              {formError}
            </p>
          )}
          {sent && (
            <p className="fl-done" role="status">
              {d.done}
            </p>
          )}
          <div className="fl-actions">
            <button type="button" className="fl-btn fl-btn--primary" onClick={submit}>
              {d.submit}
            </button>
          </div>
          <p className="fl-sr" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
