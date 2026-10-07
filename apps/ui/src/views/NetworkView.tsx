/**
 * Network: an interactive 3D knowledge graph of everything FlowCode records — projects, runs, tasks, files,
 * spec requirements, knowledge, agents, models, tools, skills and prompts. The sidebar list is the
 * keyboard/screen-reader alternative to the canvas.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@flowcode/contracts";
import { useResource } from "../api";
import { Icon } from "../components/ui";
import { navigate } from "../router";
import { ConstellationGraph } from "../components/ConstellationGraph";
import { COLORS, GROUPS, ORBIT, idOf, layoutConstellation, type GNode, type GEdge } from "../components/networkLayout";

export function NetworkView({ projects, query }: { projects: Project[]; query: URLSearchParams }) {
  const [projectId, setProjectId] = useState(query.get("projectId") ?? "");
  const { data } = useResource<{ nodes: GNode[]; edges: GEdge[] }>(`/graph${projectId ? `?projectId=${projectId}` : ""}`, [projectId]);
  const [selected, setSelected] = useState<GNode>();
  const [labels, setLabels] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [full, setFull] = useState(false);
  const panel = useRef<HTMLElement>(null);

  const neighbors = useMemo(() => {
    const incoming = new Map<string, Array<{ id: string; kind: string }>>();
    const outgoing = new Map<string, Array<{ id: string; kind: string }>>();
    for (const e of data?.edges ?? []) {
      const s = idOf(e.source);
      const t = idOf(e.target);
      (outgoing.get(s) ?? outgoing.set(s, []).get(s)!).push({ id: t, kind: e.kind });
      (incoming.get(t) ?? incoming.set(t, []).get(t)!).push({ id: s, kind: e.kind });
    }
    return { incoming, outgoing };
  }, [data]);
  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);
  const laid = useMemo(() => (data ? layoutConstellation(data.nodes, data.edges) : undefined), [data]);

  const counts = useMemo(() => {
    const c = new Map<string, GNode[]>();
    for (const n of data?.nodes ?? []) (c.get(n.type) ?? c.set(n.type, []).get(n.type)!).push(n);
    return c;
  }, [data]);
  const matches = search.trim() ? (data?.nodes ?? []).filter((n) => `${n.label} ${n.detail}`.toLowerCase().includes(search.toLowerCase())).slice(0, 40) : [];

  const focusNode = (id: string) => {
    const n = byId.get(id);
    if (n) setSelected(n);
  };

  return (
    <div className={`network ${full ? "network--full" : ""}`}>
      <header className="network__bar">
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>Network Graph</h1>
        <select className="select" style={{ width: 220, height: 30, padding: "0 10px" }} aria-label="Project" value={projectId} onChange={(e) => (setProjectId(e.target.value), setSelected(undefined))}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
          Projects at the centre; Structure, Code, Knowledge and Intelligence orbit around them. Drag to turn, shift-drag to move, scroll to zoom, click a node to inspect
        </span>
        <label className="check" style={{ alignItems: "center" }}>
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Labels
        </label>
        <button className="btn btn--sm btn--ghost" aria-pressed={full} onClick={() => setFull(!full)} aria-label={full ? "Exit full screen" : "Full screen"}>
          <Icon name="external" size={14} />
        </button>
      </header>

      <div className="network__stage">
        <div className="network__canvas" data-guide="network.canvas" aria-hidden="true">
          {laid ? <ConstellationGraph nodes={laid.nodes} edges={laid.edges} clusters={laid.clusters} orbit={ORBIT} colors={COLORS} selectedId={selected?.id ?? null} labels={labels} avoid={panel} onSelect={(id) => setSelected(id ? byId.get(id) : undefined)} /> : null}
        </div>

        <aside ref={panel} data-guide="network.panel" className="network__panel" aria-label={selected ? "Node details" : "Node categories"}>
          {selected ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="label" style={{ color: COLORS[selected.type] }}>
                  {selected.type}
                </span>
                <button className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }} onClick={() => setSelected(undefined)}>
                  close
                </button>
              </div>
              <h2 style={{ margin: 0, fontSize: 16 }}>{selected.label}</h2>
              <p className="dim" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, maxHeight: 160, overflow: "auto" }}>
                {selected.detail}
              </p>
              <NeighborList title="Receives from" items={neighbors.incoming.get(selected.id) ?? []} byId={byId} onPick={focusNode} />
              <NeighborList title="Sends to" items={neighbors.outgoing.get(selected.id) ?? []} byId={byId} onPick={focusNode} />
              {selected.route ? (
                <button className="btn" style={{ justifyContent: "space-between" }} onClick={() => navigate(selected.route!)}>
                  Open {selected.type} <Icon name="chevron" size={14} />
                </button>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <label htmlFor="net-search" className="sr-only">
                  Search nodes
                </label>
                <input id="net-search" className="input" placeholder="Search nodes…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {matches.length ? (
                <ul className="net-list">
                  {matches.map((n) => (
                    <li key={n.id}>
                      <button onClick={() => focusNode(n.id)}>
                        <span className="dot" style={{ background: COLORS[n.type] }} /> {n.label}
                        <span className="muted">{n.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                GROUPS.map(([group, types]) => (
                  <div key={group}>
                    <span className="label" style={{ display: "block", margin: "6px 0 4px" }}>
                      {group}
                    </span>
                    <ul className="net-list">
                      {types
                        .filter((t) => counts.get(t)?.length)
                        .map((t) => (
                          <li key={t}>
                            <button aria-expanded={open === t} onClick={() => setOpen(open === t ? null : t)}>
                              <span className="dot" style={{ background: COLORS[t] }} />
                              <span style={{ textTransform: "uppercase", letterSpacing: ".04em", fontSize: 11.5, fontWeight: 650 }}>{t}</span>
                              <span className="muted" style={{ marginLeft: "auto" }}>
                                {counts.get(t)!.length}
                              </span>
                              <span style={{ transform: open === t ? "rotate(90deg)" : undefined, display: "inline-flex" }}>
                                <Icon name="chevron" size={12} />
                              </span>
                            </button>
                            {open === t ? (
                              <ul className="net-list net-list--nested">
                                {counts
                                  .get(t)!
                                  .slice(0, 60)
                                  .map((n) => (
                                    <li key={n.id}>
                                      <button onClick={() => focusNode(n.id)}>{n.label}</button>
                                    </li>
                                  ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))
              )}
              <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
                {data ? `${data.nodes.length} nodes · ${data.edges.length} links — all from recorded runs, tasks, tool calls and knowledge.` : "Drawing your knowledge network…"}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function NeighborList({ title, items, byId, onPick }: { title: string; items: Array<{ id: string; kind: string }>; byId: Map<string, GNode>; onPick: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div>
      <span className="label">
        {title} ({items.length})
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, maxHeight: 180, overflow: "auto" }}>
        {items.slice(0, 40).map((x, i) => {
          const n = byId.get(x.id);
          if (!n) return null;
          return (
            <button key={`${x.id}-${i}`} className="net-chip" title={x.kind} onClick={() => onPick(x.id)}>
              <span className="dot" style={{ background: COLORS[n.type] }} />
              {n.label.slice(0, 36)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

