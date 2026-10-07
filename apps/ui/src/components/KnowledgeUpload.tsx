/**
 * Upload documents into the knowledge hub. PDFs and Word files are turned into text on this machine first; every
 * document is split into sections and stored as user-confirmed sources, so agents retrieve the relevant parts for their
 * tasks (scoped to the selected project, or global). Results show as one short summary, failures grouped by reason.
 */
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { post } from "../api";
import { DOC_ACCEPT, DocumentError, documentText } from "./documentText";

/** Text per request stays well under the backend's 5 MB request limit; longer documents go up in parts. */
const PART = 3_000_000;

interface Result {
  added: Array<{ name: string; sections: number }>;
  failed: Map<string, string[]>;
}

/** `onDone` gets the ids of every section added, so a caller can attach what was just uploaded. */
export function KnowledgeUpload({ projectId, onDone, label = "Upload documents", tags }: { projectId?: string; onDone: (addedIds: string[]) => void; label?: string; tags?: string[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string>();
  const [result, setResult] = useState<Result>();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setResult(undefined);
    const list = Array.from(files);
    const res: Result = { added: [], failed: new Map() };
    const ids: string[] = [];
    const fail = (reason: string, name: string) => res.failed.set(reason, [...(res.failed.get(reason) ?? []), name]);
    for (const [i, f] of list.entries()) {
      const step = `${i + 1} of ${list.length}: ${f.name}`;
      setProgress(`Reading ${step}`);
      try {
        const text = await documentText(f, (note) => setProgress(`Reading ${step} (${note})`));
        setProgress(`Saving ${step}`);
        let sections = 0;
        const parts = Math.ceil(text.length / PART);
        for (let p = 0; p < parts; p++) {
          const name = parts > 1 ? `${f.name} (part ${p + 1} of ${parts})` : f.name;
          const r = await post<{ chunks: number; items?: Array<{ id: string }> }>("/knowledge-uploads", { name, content: text.slice(p * PART, (p + 1) * PART), projectId: projectId || undefined, ...(tags?.length ? { tags } : {}) });
          sections += r.chunks;
          ids.push(...(r.items ?? []).map((x) => x.id));
        }
        res.added.push({ name: f.name, sections });
      } catch (e) {
        fail(e instanceof DocumentError ? e.reason : /fetch/i.test((e as Error).message) ? "Couldn't reach FlowCode (is it running?)" : (e as Error).message, f.name);
      }
    }
    setProgress(undefined);
    setResult(res);
    onDone(ids);
  };

  const failedCount = result ? [...result.failed.values()].reduce((n, l) => n + l.length, 0) : 0;
  const sections = result?.added.reduce((n, a) => n + a.sections, 0) ?? 0;

  return (
    <div className="kup">
      <button type="button" className="btn" disabled={!!progress} onClick={() => ref.current?.click()} title="PDF, Word (.docx), Markdown, text, JSON, CSV, HTML, YAML or source files">
        <Upload size={14} aria-hidden="true" /> {progress ? "Uploading…" : label}
      </button>
      <input ref={ref} type="file" multiple accept={DOC_ACCEPT} hidden onChange={(e) => (void upload(e.target.files), (e.target.value = ""))} />
      {progress ? (
        <p className="kup__progress" role="status">
          {progress}
        </p>
      ) : null}
      {result ? (
        <div className={`kup__result${failedCount ? " has-failures" : ""}`} role={failedCount && !result.added.length ? "alert" : "status"}>
          <div className="kup__summary">
            <span>
              {result.added.length ? (
                <>
                  Added <strong>{result.added.length}</strong> document{result.added.length === 1 ? "" : "s"} ({sections} section{sections === 1 ? "" : "s"}) {tags?.includes("design-playbook") ? "to the design playbook" : projectId ? "to this project in the Knowledge Hub" : "to the Knowledge Hub for every project"}.
                </>
              ) : (
                "Nothing was added."
              )}
              {failedCount ? (
                <>
                  {" "}
                  <strong>{failedCount}</strong> couldn&apos;t be added.
                </>
              ) : null}
            </span>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setResult(undefined)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          {failedCount ? (
            <ul className="kup__reasons">
              {[...result.failed.entries()].map(([reason, names]) => (
                <li key={reason}>
                  <details>
                    <summary>
                      {reason} <span className="kup__count">{names.length}</span>
                    </summary>
                    <ul>
                      {names.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
