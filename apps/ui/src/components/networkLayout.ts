/**
 * The Network's constellation layout, shared by the Network page and the dashboard card so both draw the same picture:
 * projects at the core, and Structure, Code, Knowledge and Intelligence each a cluster on an orbit around them.
 */
import type { CCluster, CNode } from "./ConstellationGraph";

export interface GNode {
  id: string;
  type: string;
  label: string;
  detail: string;
  weight: number;
  route?: string;
  status?: string;
  x?: number;
  y?: number;
  z?: number;
}
export interface GEdge {
  source: string | GNode;
  target: string | GNode;
  kind: string;
  weight: number;
}

export const COLORS: Record<string, string> = {
  project: "#f0abfc",
  run: "#c084fc",
  task: "#a78bfa",
  file: "#a3c3cf",
  reference: "#8cc7c7",
  requirement: "#f9a8d4",
  decision: "#fbbf24",
  source: "#5eead4",
  claim: "#99f6e4",
  note: "#fde68a",
  architecture: "#fcd34d",
  knowledge: "#d9f99d",
  agent: "#f472b6",
  model: "#9a9fd6",
  tool: "#7fb0c4",
  skill: "#4ade80",
  prompt: "#86efac",
};

export const GROUPS: Array<[string, string[]]> = [
  ["Structure", ["project", "run", "task"]],
  ["Code", ["file", "reference"]],
  ["Knowledge", ["requirement", "decision", "source", "claim", "note", "architecture", "knowledge"]],
  ["Intelligence", ["agent", "model", "tool", "skill", "prompt"]],
];

export const idOf = (v: string | GNode) => (typeof v === "string" ? v : v.id);

/** Always-labelled hubs. */
const HUBS = new Set(["project", "agent", "model"]);
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const seeded = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
};

/** Cluster colors, one per group. */
export const GROUP_COLOR: Record<string, string> = { Structure: "#c084fc", Code: "#7fb0c4", Knowledge: "#f9a8d4", Intelligence: "#4ade80" };
export const ORBIT = 1.3;

/**
 * Constellation layout: projects form a small core; each group is its own cluster on an orbit around it, sized by how
 * much it holds. Inside a cluster, nodes sit evenly on a small sphere with each type together, so types read as caps.
 * The same data always gives the same picture.
 */
export function layoutConstellation(nodes: GNode[], edges: GEdge[]) {
  const placed: CNode[] = [];
  const core = nodes.filter((n) => n.type === "project");
  core.forEach((n, i) => {
    const a = (i / Math.max(1, core.length)) * Math.PI * 2;
    const r = core.length > 1 ? 0.2 : 0;
    placed.push({ id: n.id, type: n.type, label: n.label, group: "Projects", hub: true, bx: Math.cos(a) * r, by: 0.04 * Math.sin(a * 2), bz: Math.sin(a) * r, phase: seeded(n.id) * 6.28 });
  });
  const groups = GROUPS.map(([label, types]) => ({ label, types: types.filter((t) => t !== "project") })).filter((g) => g.types.length);
  const clusters: CCluster[] = [];
  groups.forEach((g, gi) => {
    const members = nodes
      .filter((n) => g.types.includes(n.type))
      .sort((a, b) => g.types.indexOf(a.type) - g.types.indexOf(b.type) || b.weight - a.weight || a.label.localeCompare(b.label));
    const angle = (gi / groups.length) * Math.PI * 2 + Math.PI / 4;
    const cx = Math.cos(angle) * ORBIT;
    const cz = Math.sin(angle) * ORBIT;
    const cy = gi % 2 ? -0.06 : 0.06;
    // Each subcategory (Run, Task, File, Requirement...) is its own small sphere, set in a ring around the group's
    // centre and sized by how much it holds, so the types read as separate clusters rather than one mixed ball.
    const subs = g.types.map((t) => ({ type: t, items: members.filter((n) => n.type === t) })).filter((s) => s.items.length);
    const subR = subs.map((s) => 0.03 + Math.sqrt(s.items.length) * 0.0135);
    const biggest = Math.max(0.04, ...subR);
    const ring = subs.length > 1 ? biggest * 1.4 + subs.length * 0.02 : 0;
    const r = ring + biggest + 0.02;
    clusters.push({ label: g.label, x: cx, y: cy, z: cz, r, count: members.length, color: GROUP_COLOR[g.label] ?? "#a0aac0" });
    subs.forEach((s, si) => {
      const a = (si / subs.length) * Math.PI * 2 + gi * 0.7;
      const sx = cx + Math.cos(a) * ring;
      const sy = cy + Math.sin(a) * ring * 0.85;
      const sz = cz + Math.sin(a * 2) * ring * 0.25;
      const rs = subR[si]!;
      if (subs.length > 1) clusters.push({ label: s.type, x: sx, y: sy, z: sz, r: rs, count: s.items.length, color: COLORS[s.type] ?? "#a0aac0", sub: true });
      s.items.forEach((n, i) => {
        const y = 1 - ((i + 0.5) / Math.max(1, s.items.length)) * 2;
        const rad = Math.sqrt(1 - y * y);
        const th = GOLDEN * i;
        const j = 0.88 + seeded(n.id) * 0.24;
        placed.push({ id: n.id, type: n.type, label: n.label, group: g.label, hub: HUBS.has(n.type), bx: sx + Math.cos(th) * rad * rs * j, by: sy + y * rs * j, bz: sz + Math.sin(th) * rad * rs * j, phase: seeded(n.id) * 6.28 });
      });
    });
  });
  return { nodes: placed, edges: edges.map((e) => ({ from: idOf(e.source), to: idOf(e.target) })), clusters };
}
