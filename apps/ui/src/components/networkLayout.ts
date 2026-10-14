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
    // One sphere per category, split like an orange: each subcategory (Run, Task, File, Requirement...) is a slice
    // sized by its share, set a little apart from the others, so the four categories stay whole and their types read
    // as separate parts of them.
    const r = 0.1 + Math.sqrt(members.length) * 0.022;
    clusters.push({ label: g.label, x: cx, y: cy, z: cz, r, count: members.length, color: GROUP_COLOR[g.label] ?? "#a0aac0" });
    const subs = g.types.map((t) => ({ type: t, items: members.filter((n) => n.type === t) })).filter((sub) => sub.items.length);
    const total = Math.max(1, members.length);
    // Every slice gets at least a sliver of the sphere, so one item still reads as its own part.
    const minShare = 0.06;
    const raw = subs.map((sub) => Math.max(minShare, sub.items.length / total));
    const sum = raw.reduce((x, y) => x + y, 0);
    const gap = subs.length > 1 ? 0.34 : 0;
    const apart = subs.length > 1 ? 0.05 + r * 0.26 : 0;
    let start = gi * 0.9;
    subs.forEach((sub, si) => {
      const span = (raw[si]! / sum) * Math.PI * 2;
      const mid = start + span / 2;
      const ox = Math.cos(mid) * apart;
      const oz = Math.sin(mid) * apart;
      if (subs.length > 1)
        clusters.push({
          label: sub.type,
          x: cx + ox + Math.cos(mid) * r * 0.55,
          y: cy,
          z: cz + oz + Math.sin(mid) * r * 0.55,
          r: 0.02 + r * 0.42 * Math.sqrt(sub.items.length / total),
          count: sub.items.length,
          color: COLORS[sub.type] ?? "#a0aac0",
          sub: true,
        });
      const n = sub.items.length;
      sub.items.forEach((node, i) => {
        const y = 1 - ((i + 0.5) / Math.max(1, n)) * 2;
        const rad = Math.sqrt(1 - y * y);
        // Spread across the slice's width with the golden ratio, so a slice fills evenly however many it holds.
        const u = (i * 0.6180339887) % 1;
        const th = start + gap / 2 + u * Math.max(0.05, span - gap);
        const j = 0.9 + seeded(node.id) * 0.2;
        placed.push({ id: node.id, type: node.type, label: node.label, group: g.label, hub: HUBS.has(node.type), bx: cx + ox + Math.cos(th) * rad * r * j, by: cy + y * r * j, bz: cz + oz + Math.sin(th) * rad * r * j, phase: seeded(node.id) * 6.28 });
      });
      start += span;
    });
  });
  return { nodes: placed, edges: edges.map((e) => ({ from: idOf(e.source), to: idOf(e.target) })), clusters };
}
