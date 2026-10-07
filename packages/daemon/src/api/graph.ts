/**
 * Knowledge network (FR-K3 "links among knowledge items, projects, tasks, files, and decisions") and agent
 * activity. Every node and edge is derived from stored records — nothing is synthesized for display.
 */
import { ROLE_TOOLS, TOOL_NAMES, type ReferenceFile } from "@flowcode/contracts";
import type { App } from "../app.js";
import { extractRequirements, referencePath } from "../quality/spec.js";

export type NodeType =
  | "project"
  | "run"
  | "task"
  | "file"
  | "reference"
  | "requirement"
  | "decision"
  | "source"
  | "claim"
  | "note"
  | "architecture"
  | "knowledge"
  | "agent"
  | "model"
  | "tool"
  | "skill"
  | "prompt";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  detail: string;
  weight: number;
  route?: string;
  status?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: string;
  weight: number;
}

export const NODE_GROUPS: Record<string, NodeType[]> = {
  Structure: ["project", "run", "task"],
  Code: ["file", "reference"],
  Knowledge: ["requirement", "decision", "source", "claim", "note", "architecture", "knowledge"],
  Intelligence: ["agent", "model", "tool", "skill", "prompt"],
};

export function buildGraph(app: App, projectId?: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const node = (n: GraphNode) => {
    const cur = nodes.get(n.id);
    if (cur) cur.weight += n.weight;
    else nodes.set(n.id, n);
    return n.id;
  };
  const edge = (source: string, target: string, kind: string, weight = 1) => {
    if (!nodes.has(source) || !nodes.has(target) || source === target) return;
    const key = `${source}→${target}:${kind}`;
    const cur = edges.get(key);
    if (cur) cur.weight += weight;
    else edges.set(key, { source, target, kind, weight });
  };

  const projects = projectId ? [app.store.projects.require(projectId)] : app.store.projects.list("updated_at DESC", 50);
  const projectIds = new Set(projects.map((p) => p.id));
  for (const p of projects) node({ id: p.id, type: "project", label: p.name, detail: `${p.projectType ?? "not analysed"} · autonomy ${p.settings.autonomy}`, weight: 6, route: `/projects/${p.id}` });

  const runs = app.store.runs.list("created_at DESC", 400).filter((r) => projectIds.has(r.projectId));
  for (const r of runs) {
    node({ id: r.id, type: "run", label: r.objective.slice(0, 60), detail: `${r.status} · ${r.strategy?.kind ?? "unplanned"} · ${r.objective.slice(0, 280)}`, weight: 4, route: `/projects/${r.projectId}/runs/${r.id}`, status: r.status });
    edge(r.id, r.projectId, "belongs to");
    if (r.parentRunId) edge(r.id, r.parentRunId, "iterates on");
    const refs = app.store.getSetting<ReferenceFile[]>(`runRefs:${r.id}`, []);
    for (const ref of refs) {
      const rid = node({ id: `ref:${r.id}:${ref.name}`, type: "reference", label: ref.name, detail: `${ref.role} reference → ${referencePath(ref)}`, weight: 3 });
      edge(rid, r.id, "specifies");
      if (ref.role === "prd") {
        for (const req of extractRequirements(ref.content, 60)) {
          const qid = node({ id: `req:${r.id}:${req.id}`, type: "requirement", label: `${req.id} ${req.text.slice(0, 48)}`, detail: `${req.section ? `${req.section}: ` : ""}${req.text}`, weight: 1 });
          edge(qid, rid, "defined in");
        }
      }
    }
  }
  const runIds = new Set(runs.map((r) => r.id));

  const tasks = runs.flatMap((r) => app.store.tasks.where("run_id = ?", r.id));
  const stop = new Set(["the", "and", "for", "with", "that", "this", "must", "should", "shall", "will", "from", "into", "each", "when", "user", "users", "have"]);
  const terms = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stop.has(w)));
  for (const t of tasks) {
    node({ id: t.id, type: "task", label: t.title, detail: `${t.status} · attempts ${t.attempts} · ${t.objective.slice(0, 300)}`, weight: 2, route: `/projects/${runs.find((r) => r.id === t.runId)?.projectId}/runs/${t.runId}`, status: t.status });
    edge(t.id, t.runId, "part of");
    for (const d of t.dependsOn) edge(t.id, d, "depends on");
  }
  // PRD requirement → task traceability (keyword heuristic, same rule as the report).
  for (const n of [...nodes.values()].filter((x) => x.type === "requirement")) {
    const runId = n.id.split(":")[1];
    const rt = terms(n.detail);
    for (const t of tasks.filter((x) => x.runId === runId)) {
      const tt = terms(`${t.title} ${t.objective}`);
      if ([...rt].filter((w) => tt.has(w)).length >= Math.min(2, rt.size)) edge(n.id, t.id, "implemented by");
    }
  }

  // Files changed by tasks (from snapshots).
  let files = 0;
  for (const s of app.db.all<{ data: string }>(`SELECT data FROM snapshots WHERE project_id IN (${[...projectIds].map(() => "?").join(",") || "''"}) ORDER BY seq DESC LIMIT 4000`, ...projectIds)) {
    const snap = JSON.parse(s.data) as { projectId: string; relativePath: string; taskId?: string; operation: string };
    const fid = `file:${snap.projectId}:${snap.relativePath}`;
    if (!nodes.has(fid)) {
      if (files++ > 500) continue;
      node({ id: fid, type: "file", label: snap.relativePath.split("/").pop() ?? snap.relativePath, detail: snap.relativePath, weight: 1 });
      edge(fid, snap.projectId, "in");
    } else nodes.get(fid)!.weight += 0.2;
    if (snap.taskId) edge(snap.taskId, fid, snap.operation);
  }

  // Agents, models and tools from recorded tool calls.
  for (const tc of app.db.all<{ data: string }>(`SELECT data FROM tool_calls WHERE run_id IN (${[...runIds].map(() => "?").join(",") || "''"})`, ...runIds)) {
    const c = JSON.parse(tc.data) as { agentRole: string; toolName: string; taskId?: string; modelAssignment: { model: string }; status: string };
    const aid = node({ id: `agent:${c.agentRole}`, type: "agent", label: c.agentRole.replace(/_/g, " "), detail: `Agent role ${c.agentRole}`, weight: 0.3 });
    const mid = node({ id: `model:${c.modelAssignment.model}`, type: "model", label: c.modelAssignment.model, detail: `Model ${c.modelAssignment.model}`, weight: 0.2 });
    const tid = node({ id: `tool:${c.toolName}`, type: "tool", label: c.toolName, detail: `Governed tool ${c.toolName}`, weight: 0.2 });
    edge(aid, mid, "runs on");
    edge(aid, tid, c.status === "completed" ? "used" : `${c.status}`);
    if (c.taskId) edge(aid, c.taskId, "worked on");
  }

  // Knowledge items.
  const knowledge = app.knowledge.list(projectId).slice(0, 600);
  const typeOf = (k: string): NodeType => (["decision", "source", "claim", "note", "architecture"].includes(k) ? (k as NodeType) : "knowledge");
  for (const k of knowledge) {
    node({ id: k.id, type: typeOf(k.kind), label: k.title.slice(0, 60), detail: `${k.kind} · ${k.durability}${k.pinned ? " · pinned" : ""} · ${k.content.slice(0, 400)}`, weight: k.pinned ? 3 : 1.5, route: `/knowledge?focus=${k.id}` });
    if (k.projectId) edge(k.id, k.projectId, "about");
    for (const l of k.linkedEntityIds) edge(k.id, l, "linked to");
    for (const p of k.provenance) if (p.kind === "file" && k.projectId) edge(k.id, `file:${k.projectId}:${p.ref}`, "cites");
  }

  // Library: skills → tools, prompts → agent roles.
  for (const s of app.store.skills.list("updated_at DESC", 100)) {
    const sid = node({ id: `skill:${s.id}`, type: "skill", label: s.id.replace(/^skill\./, ""), detail: s.purpose, weight: 1, route: "/library" });
    for (const t of s.allowedTools) {
      if ((TOOL_NAMES as string[]).includes(t)) {
        node({ id: `tool:${t}`, type: "tool", label: t, detail: `Governed tool ${t}`, weight: 0.1 });
        edge(sid, `tool:${t}`, "allows");
      }
    }
  }
  for (const p of app.store.prompts.list("updated_at DESC", 100)) {
    const pid = node({ id: `prompt:${p.id}`, type: "prompt", label: p.title, detail: `${p.purpose} (v${p.version})`, weight: 1, route: "/library" });
    for (const r of p.roles) {
      const aid = node({ id: `agent:${r}`, type: "agent", label: r.replace(/_/g, " "), detail: `Agent role ${r} · tools: ${(ROLE_TOOLS[r] ?? []).join(", ")}`, weight: 0.5 });
      edge(pid, aid, "instructs");
    }
  }
  for (const [role, a] of Object.entries(app.router.roleAssignments())) {
    if (!nodes.has(`agent:${role}`)) continue;
    node({ id: `model:${a.model}`, type: "model", label: a.model, detail: `Model ${a.model} (${a.providerId})`, weight: 0.5 });
    edge(`agent:${role}`, `model:${a.model}`, "assigned");
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

// ─────────────────────────── Agent activity ───────────────────────────

const STAGES = [
  { id: "plan", label: "Plan", sub: "Requests · plans · approvals" },
  { id: "implement", label: "Implement", sub: "Coder tool calls · files" },
  { id: "repair", label: "Repair", sub: "Debugger · bounded retries" },
  { id: "verify", label: "Verify", sub: "Checks · screenshots · reports" },
] as const;

export type ActivityWindow = "24h" | "7d" | "30d" | "all";
export const ACTIVITY_WINDOWS: ActivityWindow[] = ["24h", "7d", "30d", "all"];

export function agentActivity(app: App, window: ActivityWindow) {
  const now = Date.now();
  const DAY = 86_400_000;
  // "all" spans from the first recorded tool call or event (at least one day).
  const first = window === "all" ? app.db.all<{ t: string | null }>("SELECT MIN(t) AS t FROM (SELECT MIN(created_at) AS t FROM tool_calls UNION ALL SELECT MIN(created_at) FROM events)")[0]?.t : null;
  const span = window === "24h" ? DAY : window === "7d" ? 7 * DAY : window === "30d" ? 30 * DAY : Math.max(DAY, now - (first ? new Date(first).getTime() : now) + 60_000);
  const buckets = window === "24h" ? 24 : window === "7d" ? 28 : 30;
  const size = span / buckets;
  const since = new Date(now - span).toISOString();
  const series = Object.fromEntries(STAGES.map((s) => [s.id, new Array<number>(buckets).fill(0)])) as Record<string, number[]>;
  const bucketOf = (iso: string) => Math.min(buckets - 1, Math.max(0, Math.floor((new Date(iso).getTime() - (now - span)) / size)));

  for (const r of app.db.all<{ type: string; created_at: string }>("SELECT type, created_at FROM events WHERE created_at >= ? AND type IN ('plan.proposed','plan.approved','verification.completed','report.ready','screenshot.captured')", since)) {
    series[r.type.startsWith("plan") ? "plan" : "verify"][bucketOf(r.created_at)]++;
  }
  const roles = new Map<string, { calls: number; ok: number; rejected: number; failed: number; tools: Map<string, number>; last?: { at: string; tool: string; status: string; summary?: string }; model?: string }>();
  for (const row of app.db.all<{ data: string; created_at: string }>("SELECT data, created_at FROM tool_calls WHERE created_at >= ? ORDER BY created_at ASC", since)) {
    const c = JSON.parse(row.data) as { agentRole: string; toolName: string; status: string; modelAssignment: { model: string }; resultSummaryRedacted?: string; startedAt: string };
    series[c.agentRole === "debugger" ? "repair" : "implement"][bucketOf(row.created_at)]++;
    const r = roles.get(c.agentRole) ?? { calls: 0, ok: 0, rejected: 0, failed: 0, tools: new Map<string, number>() };
    r.calls++;
    if (c.status === "completed") r.ok++;
    else if (c.status === "rejected") r.rejected++;
    else if (c.status === "failed") r.failed++;
    r.tools.set(c.toolName, (r.tools.get(c.toolName) ?? 0) + 1);
    r.last = { at: c.startedAt, tool: c.toolName, status: c.status, summary: c.resultSummaryRedacted?.split("\n")[0]?.slice(0, 160) };
    r.model = c.modelAssignment.model;
    roles.set(c.agentRole, r);
  }
  // Tokens per role from model.completed events.
  const tokens = new Map<string, number>();
  for (const r of app.db.all<{ data: string }>("SELECT data FROM events WHERE type = 'model.completed' AND created_at >= ?", since)) {
    const d = (JSON.parse(r.data) as { data: { role?: string; usage?: { promptTokens?: number; completionTokens?: number } } }).data;
    if (d.role) tokens.set(d.role, (tokens.get(d.role) ?? 0) + (d.usage?.promptTokens ?? 0) + (d.usage?.completionTokens ?? 0));
  }
  const assignments = app.router.roleAssignments();
  const ROLES = ["planner", "coder", "debugger", "accessibility_qa", "security_qa", "critic", "researcher", "documenter"];
  return {
    window,
    stages: STAGES.map((s) => ({ ...s, total: series[s.id].reduce((a, b) => a + b, 0), series: series[s.id] })),
    agents: ROLES.map((role) => {
      const r = roles.get(role);
      return {
        role,
        model: r?.model ?? assignments[role]?.model ?? "—",
        calls: r?.calls ?? 0,
        ok: r?.ok ?? 0,
        rejected: r?.rejected ?? 0,
        failed: r?.failed ?? 0,
        tokens: tokens.get(role) ?? 0,
        tools: r ? [...r.tools.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })) : [],
        allowedTools: ROLE_TOOLS[role] ?? [],
        last: r?.last,
      };
    }),
    activeRuns: app.orchestrator.activeRunIds().map((id) => {
      const run = app.store.runs.get(id);
      const task = run?.currentTaskId ? app.store.tasks.get(run.currentTaskId) : undefined;
      // A run still in draft with no task yet is being planned: that's the planner's work.
      const planning = !task && run?.status === "draft";
      return { id, objective: run?.objective ?? "", task: task?.title ?? (planning ? "Writing the plan" : undefined), role: task ? (task.attempts > 1 ? "debugger" : task.role) : planning ? "planner" : undefined, projectId: run?.projectId };
    }),
  };
}
