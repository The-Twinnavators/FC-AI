/**
 * "What would you like to build?": the first step of a project's setup, on Home and again when you come Back to it.
 * A project name, the description, attachments (dropped anywhere on the composer or chosen) and a product type. Next
 * saves it as a draft project (POST /setups) or updates the draft it came from, then opens Look and Feel. Nothing is
 * lost on an error: the fields keep what was typed and attached.
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { PRODUCT_TYPES, suggestName, type ProductType, type ProjectSetup } from "@flowcode/contracts";
import { post } from "../api";
import { navigate } from "../router";
import { Icon } from "./ui";
import { NEW_BUILD_PRD_KEY } from "./PrdTemplates";
import { ACCEPT, MAX_DESC, readAttachments, summarize, type Attachment } from "./attachments";

export function ProductComposer({ projectId, initial }: { projectId?: string; initial?: { name: string; setup: ProjectSetup } }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nameTouched, setNameTouched] = useState(!!initial);
  const [description, setDescription] = useState(initial?.setup.description ?? "");
  const [productType, setProductType] = useState<ProductType | "">(initial?.setup.productType ?? "");
  const [files, setFiles] = useState<Attachment[]>(() => (initial?.setup.references ?? []).map((r) => ({ ...r, size: r.content.length, summary: summarize(r.role, r.content) })));
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const shownName = nameTouched ? name : suggestName(description);

  // A PRD handed over from PRD templates or Create PRD ("Start a prototype with it") arrives attached, once.
  useEffect(() => {
    if (projectId) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(NEW_BUILD_PRD_KEY);
      sessionStorage.removeItem(NEW_BUILD_PRD_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return;
    try {
      const { name: fileName, content, extra, description: ready } = JSON.parse(raw) as { name: string; content: string; extra?: { name: string; content: string }; description?: string };
      setFiles((cur) => [
        { name: fileName, role: "prd", content, size: content.length, summary: summarize("prd", content) },
        ...(extra ? [{ name: extra.name, role: "text" as const, content: extra.content, size: extra.content.length, summary: summarize("text", extra.content) }] : []),
        ...cur.filter((r) => r.role !== "prd" && r.name !== extra?.name),
      ]);
      setDescription((d) => d || ready || "Build what the attached PRD describes.");
    } catch {
      /* a malformed hand-over is ignored */
    }
  }, [projectId]);

  const add = async (list: FileList | File[]) => {
    setError(undefined);
    setReading(true);
    const { next, errors } = await readAttachments(list, files);
    setReading(false);
    if (errors.length) setError(errors.join(" "));
    setFiles(next);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void add(e.dataTransfer.files);
  };

  const described = description.trim().length > 0;
  const next = async () => {
    if (!described || busy) return;
    setBusy(true);
    setError(undefined);
    const body = {
      name: shownName.trim() || undefined,
      description: description.trim(),
      ...(productType ? { productType } : {}),
      references: files.map(({ name: n, role, content }) => ({ name: n, role, content })),
    };
    try {
      const id = projectId ?? (await post<{ project: { id: string } }>("/setups", body)).project.id;
      if (projectId) await post(`/projects/${projectId}/setup`, body);
      navigate(`/new/${id}/look`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form
      className={`composer${drag ? " is-drag" : ""}`}
      aria-labelledby="composer-title"
      onSubmit={(e) => {
        e.preventDefault();
        void next();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false);
      }}
      onDrop={onDrop}
    >
      <label className="composer__name">
        <span className="sr-only">Project name</span>
        <input
          className="composer__name-input"
          value={shownName}
          maxLength={200}
          placeholder="Project name"
          onChange={(e) => {
            setNameTouched(true);
            setName(e.target.value);
          }}
        />
      </label>
      <label className="composer__desc">
        <span className="sr-only">Product description</span>
        <textarea
          className="composer__text"
          value={description}
          maxLength={MAX_DESC}
          rows={4}
          placeholder="Describe your app or website…"
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl or Cmd + Enter goes on, as in a chat composer; Enter alone is a new line.
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void next();
            }
          }}
        />
      </label>
      {files.length ? (
        <ul className="composer__files" aria-label="Attached files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="composer__file">
              <span className="composer__file-role">{f.role === "prd" ? "PRD" : f.role}</span>
              <span className="composer__file-name" title={f.summary}>
                {f.name}
              </span>
              <span className="composer__file-sum">{f.summary}</span>
              <button type="button" className="composer__file-x" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <Icon name="x" size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="composer__bar">
        <button type="button" className="composer__attach" onClick={() => input.current?.click()} aria-describedby="composer-types">
          <Icon name="clip" size={16} /> {reading ? "Reading…" : "Attach"}
        </button>
        <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => e.target.files && void add(e.target.files)} />
        <label className="composer__type">
          <span className="sr-only">Product type</span>
          <select className="select" value={productType} onChange={(e) => setProductType(e.target.value as ProductType | "")}>
            <option value="">Product type</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn--primary composer__next" disabled={!described || busy}>
          {busy ? "Saving…" : "Next: Look and Feel"} <Icon name="chevron" size={13} />
        </button>
      </div>
      <p className="composer__types" id="composer-types">
        {drag ? "Drop to attach" : "PRD, JSON, HTML, CSS or images · up to 1.5 MB each"}
      </p>
      {error ? (
        <p className="composer__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
