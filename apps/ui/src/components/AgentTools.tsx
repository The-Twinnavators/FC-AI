/**
 * Prompts & Skills → Tools: every action FlowCode's agents can take (read, write, run, control), its execution policy and
 * which agents may use it, with example requests. A reference for what agents are allowed to do (moved here from
 * System Health, where it wasn't a health check).
 */
import { useState } from "react";
import { useResource } from "../api";
import { AgentHeads, LibModal } from "./LibModal";
import { SkeletonBlock } from "./motion";

interface Tool {
  name: string;
  access: "read" | "write" | "execute" | "control";
  description: string;
  policy: string;
  roles: string[];
  examples: string[];
}

const RISKY = (a: Tool["access"]) => a === "write" || a === "execute";

export function AgentTools() {
  const { data } = useResource<Tool[]>("/system/tools");
  const [selected, setSelected] = useState<string>();
  if (!data) return <SkeletonBlock rows={4} label="Loading the tools agents can use" />;
  const tool = data.find((t) => t.name === selected);
  const requests = (tool?.examples ?? []).filter((e) => !e.trim().startsWith("("));
  const groups: Array<[string, Tool[]]> = [
    ["Read", data.filter((t) => t.access === "read")],
    ["Write", data.filter((t) => t.access === "write")],
    ["Execute", data.filter((t) => t.access === "execute")],
    ["Control", data.filter((t) => t.access === "control")],
  ];
  return (
    <div className="lib-tools">
      <div className="library-grid__bar">
        <p className="muted">Agents act only through these governed tools. Every call is validated, policy-checked, logged and — for writes — snapshotted first.</p>
      </div>
      {/* The same cards as Skills, one group per kind of access; a card opens the tool in the modal. */}
      {groups.filter(([, tools]) => tools.length).map(([g, tools]) => (
        <section key={g} className="lib-tools__group" aria-label={`${g} tools`}>
          <p className="skill-sort__heading">
            <i className="lib-shelf__spine" style={{ background: RISKY(tools[0]!.access) ? "var(--sig-warn)" : "var(--sig-ok)" }} aria-hidden="true" />
            {g} <span className="skill-browse__n">{tools.length}</span>
          </p>
          <ul className="lib-cards">
            {tools.map((t) => (
              <li key={t.name}>
                <button type="button" className="lib-card" onClick={() => setSelected(t.name)}>
                  <span className="lib-card__top">
                    <strong className="lib-card__title mono">{t.name}</strong>
                    <span className={`chip ${RISKY(t.access) ? "chip--warn" : "chip--ok"}`}>{t.access}</span>
                  </span>
                  <span className="lib-card__purpose">{t.description}</span>
                  <span className="lib-card__meta">
                    <span className="lib-card__used">
                      Used by <AgentHeads roles={t.roles} id={`tool-${t.name}`} max={2} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {tool ? (
        <LibModal label="Built-in tool" onClose={() => setSelected(undefined)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 className="mono" style={{ margin: 0, fontSize: 18 }}>
                  {tool.name}
                </h2>
                <p className="dim" style={{ margin: "4px 0 0" }}>
                  {tool.description}
                </p>
              </div>
              <span className={`chip ${RISKY(tool.access) ? "chip--warn" : "chip--ok"}`} style={{ marginLeft: "auto", flex: "0 0 auto" }}>
                {tool.access}
              </span>
            </div>
            <dl className="kv">
              <dt>Execution policy</dt>
              <dd>{tool.policy}</dd>
              <dt>Agents allowed</dt>
              <dd>
                <AgentHeads roles={tool.roles} id={`toold-${tool.name}`} />
              </dd>
            </dl>
            {/* What you'd ask in a project's chat for an agent to use this tool. Read-only: an explanation, not an action.
                Notes in brackets ("used by agents to claim completion") aren't requests anyone types, so they're left out. */}
            {requests.length ? (
              <div className="tool-asks">
                <span className="label">Agents use it when you ask, for example</span>
                <ul>
                  {requests.map((e) => (
                    <li key={e}>“{e}”</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </LibModal>
      ) : null}
    </div>
  );
}
