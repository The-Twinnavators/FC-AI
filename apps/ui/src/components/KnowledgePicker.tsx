/**
 * Knowledge for a request: search the library, or upload a document, and attach it so the AI references it while it
 * plans and builds. Nothing is listed until you search, so a large library never turns into a wall of checkboxes.
 * A document stored in parts ("X (part 2 of 6)") is one result; attaching it attaches every part.
 */
import { useMemo, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import type { KnowledgeItem } from "@flowcode/contracts";
import { KnowledgeUpload } from "./KnowledgeUpload";

interface Doc {
  key: string;
  title: string;
  ids: string[];
  kind: string;
  text: string;
}

const baseTitle = (t: string) => t.replace(/\s*\(part \d+ of \d+\)\s*$/i, "").trim();

function groupDocs(items: KnowledgeItem[]): Doc[] {
  const by = new Map<string, Doc>();
  for (const k of items) {
    if (k.excluded) continue;
    const title = baseTitle(k.title);
    const key = `${k.kind}:${title.toLowerCase()}`;
    const d = by.get(key) ?? { key, title, ids: [], kind: k.kind, text: "" };
    d.ids.push(k.id);
    if (d.text.length < 4000) d.text += ` ${k.content.slice(0, 1200)}`;
    by.set(key, d);
  }
  return [...by.values()];
}

const KIND_LABEL: Record<string, string> = { source: "Document", claim: "Research claim", decision: "Decision", note: "Note", architecture: "Architecture", skill: "Skill", prompt: "Prompt", snippet: "Snippet", glossary: "Glossary", entity: "Entity" };

export function KnowledgePicker({ projectId, items, attached, onChange, onUploaded }: { projectId: string; items: KnowledgeItem[]; attached: string[]; onChange: (ids: string[]) => void; onUploaded: () => void }) {
  const [q, setQ] = useState("");
  const docs = useMemo(() => groupDocs(items), [items]);
  const chosen = docs.filter((d) => d.ids.some((id) => attached.includes(id)));
  const term = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return [];
    const words = term.split(/\s+/).filter(Boolean);
    return docs
      .map((d) => {
        const title = d.title.toLowerCase();
        const body = d.text.toLowerCase();
        if (!words.every((w) => title.includes(w) || body.includes(w))) return undefined;
        return { d, score: words.reduce((n, w) => n + (title.includes(w) ? 3 : 1), 0) };
      })
      .filter((x): x is { d: Doc; score: number } => !!x)
      .sort((a, b) => b.score - a.score || a.d.title.localeCompare(b.d.title))
      .slice(0, 8)
      .map((x) => x.d);
  }, [docs, term]);
  const toggle = (d: Doc, on: boolean) => onChange(on ? [...new Set([...attached, ...d.ids])] : attached.filter((id) => !d.ids.includes(id)));

  return (
    <fieldset className="kpick">
      <legend className="label">Knowledge for the AI to reference</legend>
      {chosen.length ? (
        <ul className="kpick__chosen" aria-label="Attached knowledge">
          {chosen.map((d) => (
            <li key={d.key} className="kpick__chip">
              <FileText size={13} aria-hidden="true" />
              <span>{d.title}</span>
              {d.ids.length > 1 ? <span className="kpick__parts">{d.ids.length} parts</span> : null}
              <button type="button" className="kpick__remove" aria-label={`Remove ${d.title}`} onClick={() => toggle(d, false)}>
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="kpick__row">
        <label className="kpick__search">
          <Search size={14} aria-hidden="true" />
          <span className="sr-only">Search the knowledge library</span>
          <input
            type="search"
            className="input"
            placeholder={docs.length ? `Search ${docs.length} document${docs.length === 1 ? "" : "s"} in the Knowledge Hub` : "The Knowledge Hub is empty: upload a document"}
            value={q}
            disabled={!docs.length}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter picks the first result instead of submitting the request.
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) toggle(results[0], !results[0].ids.some((id) => attached.includes(id)));
              }
            }}
          />
        </label>
        <KnowledgeUpload
          projectId={projectId}
          label="Upload a document"
          onDone={(ids) => {
            if (ids.length) onChange([...new Set([...attached, ...ids])]);
            onUploaded();
          }}
        />
      </div>
      {term ? (
        results.length ? (
          <ul className="kpick__results" aria-label="Search results">
            {results.map((d) => {
              const on = d.ids.some((id) => attached.includes(id));
              return (
                <li key={d.key}>
                  <label className="kpick__result">
                    <input type="checkbox" checked={on} onChange={(e) => toggle(d, e.target.checked)} />
                    <span className="kpick__title">{d.title}</span>
                    <span className="kpick__meta">
                      {KIND_LABEL[d.kind] ?? d.kind}
                      {d.ids.length > 1 ? ` · ${d.ids.length} parts` : ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kpick__none">Nothing in the Knowledge Hub matches “{q.trim()}”. Upload the document instead.</p>
        )
      ) : (
        <p className="kpick__hint">Attached documents travel with the request, with where they came from, and the AI reads the parts that fit each step.</p>
      )}
    </fieldset>
  );
}
