/**
 * Prompts & Skills → Tools: every action FlowCode's agents can take (read, write, run, control), its execution policy and
 * which agents may use it, with example requests. A reference for what agents are allowed to do (moved here from
 * System Health, where it wasn't a health check).
 */
import { useState } from "react";
import { useResource } from "../api";
import { Icon } from "./ui";

interface Tool {
  name: string;
  access: "read" | "write" | "execute" | "control";
  description: string;
  policy: string;
  roles: string[];
  examples: string[];
}

export function AgentTools() {
  const { data } = useResource<Tool[]>("/system/tools");
  const [selected, setSelected] = useState<string>();
  if (!data) return null;
  const tool = data.find((t) => t.name === selected);
  if (tool)
    return (
      <div style={{ display: "grid", gap: 16, maxWidth: 820 }}>
        <button className="btn btn--ghost btn--sm" style={{ justifySelf: "start" }} onClick={() => setSelected(undefined)}>
          ← Back to all tools
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="mono" style={{ margin: 0, fontSize: 22 }}>
            {tool.name}
          </h2>
          <span className={`chip ${tool.access === "write" || tool.access === "execute" ? "chip--warn" : "chip--ok"}`} style={{ marginLeft: "auto" }}>
            {tool.access}
          </span>
        </div>
        <p className="dim" style={{ margin: 0 }}>
          {tool.description}
        </p>
        <dl className="kv">
          <dt>Execution policy</dt>
          <dd>{tool.policy}</dd>
          <dt>Agents allowed</dt>
          <dd>{tool.roles.join(", ")}</dd>
        </dl>
        <div style={{ display: "grid", gap: 8 }}>
          <span className="label">example requests</span>
          {tool.examples.map((e) => (
            <div key={e} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-2)" }}>
              <Icon name="chevron" size={13} />
              <em style={{ flex: 1 }}>"{e}"</em>
              <button
                className="btn btn--sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(e);
                }}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  const groups: Array<[string, Tool[]]> = [
    ["Read", data.filter((t) => t.access === "read")],
    ["Write", data.filter((t) => t.access === "write")],
    ["Execute", data.filter((t) => t.access === "execute")],
    ["Control", data.filter((t) => t.access === "control")],
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p className="muted" style={{ margin: 0 }}>
        Agents act only through these governed tools. Every call is validated, policy-checked, logged and — for writes — snapshotted first.
      </p>
      {groups.map(([g, tools]) => (
        <section key={g}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="label" style={{ color: g === "Write" || g === "Execute" ? "var(--sig-warn)" : "var(--sig-ok)" }}>
              {g}
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span className="mono muted">{tools.length}</span>
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
            {tools.map((t) => (
              <button key={t.name} onClick={() => setSelected(t.name)} className="tool-row">
                <span className={`chip ${g === "Write" || g === "Execute" ? "chip--warn" : "chip--ok"}`}>{t.access}</span>
                <strong className="mono" style={{ fontSize: 12.5 }}>
                  {t.name}
                </strong>
                <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  — {t.description}
                </span>
                <span className="mono muted" style={{ fontSize: 11 }}>
                  {t.roles.slice(0, 3).map((r) => `#${r}`).join(" ")}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
