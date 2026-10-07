/**
 * New prompts on the Library page: create one from scratch or import a .md file, then review and save it (v1.0.0).
 * Saved prompts are versioned and searchable like the built-in role prompts.
 */
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { AgentRole, type PromptSpec } from "@flowcode/contracts";
import { post } from "../api";

const ROLES = AgentRole.options;
const today = () => new Date().toISOString().slice(0, 10);
const lines = (s: string) => s.split("\n").map((l) => l.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);
const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const slug = (s: string) => s.toLowerCase().replace(/^prompt\./, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const blankPrompt = (): PromptSpec => ({
  id: "",
  version: "1.0.0",
  title: "",
  purpose: "",
  owner: "local",
  scope: "global",
  roles: ["coder"],
  tags: [],
  inputs: [],
  constraints: [],
  template: "",
  examples: [],
  evaluations: [],
  changelog: [],
});

/** Markdown → prompt. Optional frontmatter: title/name, description, roles, tags. A "## Constraints" list becomes constraints; the rest is the template. */
export function promptFromMarkdown(md: string, fileName: string): PromptSpec {
  const p = blankPrompt();
  let body = md.replace(/\r\n/g, "\n");
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta: Record<string, string> = {};
  if (fm) {
    for (const l of fm[1].split("\n")) {
      const m = l.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) meta[m[1].toLowerCase()] = m[2].replace(/^\[|\]$/g, "").replace(/^["']|["']$/g, "").trim();
    }
    body = body.slice(fm[0].length);
  }
  const con = body.match(/\n##+\s*constraints[^\n]*\n([\s\S]*?)(?=\n##+\s|$)/i);
  if (con) {
    p.constraints = lines(con[1]);
    body = body.replace(con[0], "\n");
  }
  const heading = body.match(/^#\s+(.+)$/m)?.[1];
  p.title = meta.title ?? meta.name ?? heading ?? fileName.replace(/\.md$/i, "");
  p.purpose = meta.description ?? meta.purpose ?? "";
  p.template = (heading && !meta.title ? body.replace(/^#\s+.+$/m, "") : body).trim();
  if (meta.roles) p.roles = csv(meta.roles).filter((r): r is PromptSpec["roles"][number] => (ROLES as readonly string[]).includes(r));
  if (meta.tags) p.tags = csv(meta.tags);
  return p;
}

export function PromptImportButton({ onImport }: { onImport: (p: PromptSpec) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="btn btn--sm" onClick={() => ref.current?.click()}>
        <Upload size={14} strokeWidth={2.25} aria-hidden="true" />
        Import .md
      </button>
      <input
        ref={ref}
        type="file"
        accept=".md,text/markdown"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onImport(promptFromMarkdown(await f.text(), f.name));
        }}
      />
    </>
  );
}

export function PromptForm({ initial, existingIds, onSaved, onCancel }: { initial: PromptSpec; existingIds: string[]; onSaved: (id: string) => void; onCancel: () => void }) {
  const [p, setP] = useState<PromptSpec>(initial);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [constraints, setConstraints] = useState(initial.constraints.join("\n"));
  const [error, setError] = useState<string>();
  const set = <K extends keyof PromptSpec>(k: K, v: PromptSpec[K]) => setP((x) => ({ ...x, [k]: v }));
  const id = `prompt.${slug(p.title)}`;
  const toggleRole = (r: PromptSpec["roles"][number]) => set("roles", p.roles.includes(r) ? p.roles.filter((x) => x !== r) : [...p.roles, r]);

  const save = async () => {
    setError(undefined);
    if (!slug(p.title)) return setError("Give the prompt a title.");
    if (existingIds.includes(id)) return setError(`${id} already exists. Pick another title or edit that prompt.`);
    if (!p.template.trim()) return setError("The prompt text is required.");
    try {
      await post("/prompts", { ...p, id, version: "1.0.0", tags: csv(tags), constraints: lines(constraints), changelog: [{ version: "1.0.0", date: today(), note: "Created in Prompts & Skills" }] });
      onSaved(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="skill-form" style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>New prompt</h2>
      <div className="field">
        <label className="label" htmlFor="pr-title">
          Title
        </label>
        <input id="pr-title" data-cp="prompt-title" className="input" value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Landing page copywriter" />
        <span className="muted mono" style={{ fontSize: 12 }}>
          {id}
        </span>
      </div>
      <div className="field">
        <label className="label" htmlFor="pr-purpose">
          Purpose
        </label>
        <input id="pr-purpose" data-cp="prompt-purpose" className="input" value={p.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="One line: what this prompt is for" />
      </div>
      <fieldset className="skill-form__set">
        <legend className="label">Roles</legend>
        <div className="skill-form__opts">
          {ROLES.map((r) => (
            <label key={r} className="skill-opt">
              <input type="checkbox" checked={p.roles.includes(r)} onChange={() => toggleRole(r)} /> {r.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="pr-template">
          Prompt
        </label>
        <textarea id="pr-template" data-cp="prompt-template" className="textarea mono" style={{ minHeight: 220, fontSize: 12 }} value={p.template} onChange={(e) => set("template", e.target.value)} placeholder="You are … Do … Never …" />
      </div>
      <div className="field">
        <label className="label" htmlFor="pr-con">
          Constraints (one per line)
        </label>
        <textarea id="pr-con" className="textarea" style={{ minHeight: 80 }} value={constraints} onChange={(e) => setConstraints(e.target.value)} />
      </div>
      <div className="field">
        <label className="label" htmlFor="pr-tags">
          Tags
        </label>
        <input id="pr-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma separated" />
      </div>
      {error ? <p role="alert" className="notice notice--bad">{error}</p> : null}
      <div className="detail-actions">
        <button className="btn btn--primary" data-cp="prompt-save" onClick={save}>
          Create prompt
        </button>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
