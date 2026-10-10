/**
 * Skills on the Library page: view, create, edit (new version), import from .md, turn on/off, delete (user skills).
 * Agents get the skills that match their role and task; a skill's checks are added to that task for review.
 */
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { AgentRole, TOOL_NAMES, type SkillSpec } from "@flowcode/contracts";
import { ConfirmButton } from "./ConfirmButton";
import { VersionHistory } from "./LibModal";
import { get, post } from "../api";

const ROLES = AgentRole.options;
const today = () => new Date().toISOString().slice(0, 10);
const bump = (v: string) => {
  const [a, b] = v.split(".").map(Number);
  return `${a || 1}.${(b ?? 0) + 1}.0`;
};
const lines = (s: string) => s.split("\n").map((l) => l.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);
const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const slug = (s: string) => s.toLowerCase().replace(/^skill\./, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const blankSkill = (): SkillSpec => ({
  id: "",
  version: "1.0.0",
  purpose: "",
  instructions: "",
  allowedTools: [],
  inputSchema: "Task",
  outputSchema: "ChangedPaths",
  policies: { network: "denied", filesystem: "governed_write" },
  acceptance: [],
  tests: [],
  changelog: [],
  roles: ["coder"],
  triggers: [],
  enabled: true,
  source: "user",
});

/**
 * Reads a skill from Markdown. Optional frontmatter: name, description, roles, triggers, tools (comma lists).
 * The body is the instructions; a "## Acceptance" (or "## Checks") list becomes the acceptance checks.
 */
export function skillFromMarkdown(md: string, fileName: string): SkillSpec {
  const s = blankSkill();
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
  const acc = body.match(/\n##+\s*(acceptance|checks)[^\n]*\n([\s\S]*?)(?=\n##+\s|$)/i);
  if (acc) {
    s.acceptance = lines(acc[2]);
    body = body.replace(acc[0], "\n");
  }
  const title = body.match(/^#\s+(.+)$/m)?.[1];
  s.id = `skill.${slug(meta.name ?? title ?? fileName.replace(/\.md$/i, ""))}`;
  s.purpose = meta.description ?? meta.purpose ?? title ?? "";
  s.instructions = body.replace(/^#\s+.+$/m, "").trim();
  if (meta.roles) s.roles = csv(meta.roles).filter((r) => (ROLES as readonly string[]).includes(r));
  if (meta.triggers) s.triggers = csv(meta.triggers);
  if (meta.tools) s.allowedTools = csv(meta.tools).filter((t) => (TOOL_NAMES as string[]).includes(t));
  return s;
}

export function SkillImportButton({ onImport }: { onImport: (s: SkillSpec) => void }) {
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
          if (f) onImport(skillFromMarkdown(await f.text(), f.name));
        }}
      />
    </>
  );
}

export function SkillDetail({ skill, onChanged, onEdit, onDeleted }: { skill: SkillSpec; onChanged: () => void; onEdit: () => void; onDeleted: () => void }) {
  const [error, setError] = useState<string>();
  const enabled = skill.enabled !== false;
  const act = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18 }} className="mono">
            {skill.id}
          </h2>
          <p className="dim" style={{ margin: "4px 0 0" }}>{skill.purpose}</p>
        </div>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          {/* On or off for every build, the same switch as connected servers. */}
          <label className="mcp-switch" title={enabled ? "On: agents use this skill" : "Off: no agent uses it"}>
            <input type="checkbox" checked={enabled} onChange={() => act(async () => (await post("/skills", { ...skill, enabled: !enabled }), onChanged()))} aria-label={`Use ${skill.id}`} />
            <span aria-hidden="true" />
          </label>
          <span className="chip">{skill.source === "user" ? "yours" : "built-in"}</span>
        </span>
      </div>
      <dl className="kv">
        <dt>Used by</dt>
        <dd>{skill.roles?.length ? skill.roles.map((r) => r.replace(/_/g, " ")).join(", ") : "any agent"}</dd>
        <dt>Applies when</dt>
        <dd>{skill.triggers?.length ? skill.triggers.map((t) => `"${t}"`).join(", ") : "the task matches its purpose"}</dd>
        <dt>Preferred tools</dt>
        <dd className="mono">{skill.allowedTools.join(", ") || "—"}</dd>
        <dt>Network</dt>
        <dd>{skill.policies.network.replace(/_/g, " ")}</dd>
        <dt>Filesystem</dt>
        <dd>{skill.policies.filesystem.replace(/_/g, " ")}</dd>
        <dt>Acceptance</dt>
        <dd>
          {skill.acceptance.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {skill.acceptance.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : (
            "—"
          )}
        </dd>
      </dl>
      <div>
        <span className="label">instructions</span>
        <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{skill.instructions}</p>
      </div>
      {error ? <p role="alert" className="notice notice--bad">{error}</p> : null}
      <VersionHistory path={`/skills/${encodeURIComponent(skill.id)}/versions`} current={skill.version} />
      <div className="detail-actions">
        <button className="btn btn--primary" onClick={onEdit}>
          Edit
        </button>
        {skill.source === "user" ? (
          <span style={{ marginLeft: "auto" }}>
            <ConfirmButton className="btn btn--ghost" question={`Delete ${skill.id}? Agents will stop using it.`} confirmLabel="Delete skill" onConfirm={() => act(async () => (await post(`/skills/${encodeURIComponent(skill.id)}/delete`), onDeleted()))}>
              Delete
            </ConfirmButton>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SkillForm({ initial, isNew, existingIds, onSaved, onCancel }: { initial: SkillSpec; isNew: boolean; existingIds: string[]; onSaved: (id: string) => void; onCancel: () => void }) {
  const [s, setS] = useState<SkillSpec>(initial);
  const [name, setName] = useState(isNew ? initial.id.replace(/^skill\./, "") : initial.id);
  const [triggers, setTriggers] = useState((initial.triggers ?? []).join(", "));
  const [acceptance, setAcceptance] = useState(initial.acceptance.join("\n"));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const set = <K extends keyof SkillSpec>(k: K, v: SkillSpec[K]) => setS((x) => ({ ...x, [k]: v }));
  const toggle = (k: "roles" | "allowedTools", v: string) => set(k, (s[k] ?? []).includes(v) ? (s[k] ?? []).filter((x) => x !== v) : [...(s[k] ?? []), v]);
  const id = isNew ? `skill.${slug(name)}` : initial.id;
  const version = isNew ? "1.0.0" : bump(initial.version);

  const save = async () => {
    setError(undefined);
    if (!slug(name)) return setError("Give the skill a name.");
    if (isNew && existingIds.includes(id)) return setError(`${id} already exists. Pick another name or edit that skill.`);
    if (!s.purpose.trim() || !s.instructions.trim()) return setError("Purpose and instructions are required.");
    const spec: SkillSpec = {
      ...s,
      id,
      version,
      triggers: csv(triggers),
      acceptance: lines(acceptance),
      source: isNew ? "user" : initial.source,
      changelog: [...initial.changelog, { version, date: today(), note: note.trim() || (isNew ? "Created in Prompts & Skills" : "Edited in Prompts & Skills") }],
    };
    try {
      await post("/skills", spec);
      onSaved(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="skill-form" style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{isNew ? "New skill" : <span className="mono">{initial.id}</span>}</h2>
      {isNew ? (
        <div className="field">
          <label className="label" htmlFor="sk-name">
            Name
          </label>
          <input id="sk-name" data-cp="skill-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. responsive-tables" />
          <span className="muted mono" style={{ fontSize: 12 }}>
            {id}
          </span>
        </div>
      ) : null}
      <div className="field">
        <label className="label" htmlFor="sk-purpose">
          Purpose
        </label>
        <input id="sk-purpose" data-cp="skill-purpose" className="input" value={s.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="One line: what this skill achieves" />
      </div>
      <div className="field">
        <label className="label" htmlFor="sk-instr">
          Instructions
        </label>
        <textarea id="sk-instr" data-cp="skill-instructions" className="textarea" style={{ minHeight: 180 }} value={s.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Step by step: what the agent should read, change and check." />
      </div>
      <fieldset className="skill-form__set">
        <legend className="label">Used by</legend>
        <div className="skill-form__opts">
          {ROLES.map((r) => (
            <label key={r} className="skill-opt">
              <input type="checkbox" checked={(s.roles ?? []).includes(r)} onChange={() => toggle("roles", r)} /> {r.replace(/_/g, " ")}
            </label>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          None selected = any agent.
        </span>
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="sk-trig">
          Applies when the task mentions
        </label>
        <input id="sk-trig" data-cp="skill-triggers" className="input" value={triggers} onChange={(e) => setTriggers(e.target.value)} placeholder="Comma separated, e.g. table, data grid, responsive" />
      </div>
      <fieldset className="skill-form__set">
        <legend className="label">Preferred tools</legend>
        <div className="skill-form__opts">
          {TOOL_NAMES.map((t) => (
            <label key={t} className="skill-opt mono">
              <input type="checkbox" checked={s.allowedTools.includes(t)} onChange={() => toggle("allowedTools", t)} /> {t}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="sk-acc">
          Acceptance checks (one per line)
        </label>
        <textarea id="sk-acc" className="textarea" style={{ minHeight: 90 }} value={acceptance} onChange={(e) => setAcceptance(e.target.value)} placeholder={"Typecheck passes\nNo raw color values"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="sk-net">
            Network
          </label>
          <select id="sk-net" className="select" value={s.policies.network} onChange={(e) => set("policies", { ...s.policies, network: e.target.value as SkillSpec["policies"]["network"] })}>
            <option value="denied">Denied</option>
            <option value="approval_required">Approval required</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="sk-fs">
            Filesystem
          </label>
          <select id="sk-fs" className="select" value={s.policies.filesystem} onChange={(e) => set("policies", { ...s.policies, filesystem: e.target.value as SkillSpec["policies"]["filesystem"] })}>
            <option value="governed_write">Governed write</option>
            <option value="read_workspace_only">Read only</option>
          </select>
        </div>
      </div>
      {!isNew ? (
        <div className="field">
          <label className="label" htmlFor="sk-note">
            What changed (v{version})
          </label>
          <input id="sk-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short changelog note" />
        </div>
      ) : null}
      {error ? <p role="alert" className="notice notice--bad">{error}</p> : null}
      <div className="detail-actions">
        <button className="btn btn--primary" data-cp="skill-save" onClick={save}>
          {isNew ? "Create skill" : `Save as v${version}`}
        </button>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
