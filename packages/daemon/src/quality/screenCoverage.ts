/**
 * Screens and their design coverage. Lists an app's screens (from the starter's SCREENS list and src/screens), says which
 * ones a design step has covered, flags pairs of screens similar enough to review (never merges them), and keeps
 * reusable, provider-independent screen specifications that design steps build from.
 *
 * A spec is plain data: the screen's goal, primary action, hierarchy, layout, states, accessibility and acceptance
 * criteria. Any model (local or cloud) can write one; any coder can build from one. Stored per project in settings.
 */
import fs from "node:fs";
import path from "node:path";
import type { App } from "../app.js";

export interface Screen {
  /** The screen id in the app's navigation (SCREENS), or the file's name for a screen reached another way. */
  id: string;
  label?: string;
  file?: string;
  /** In the app's navigation, or reached from another screen (a detail screen, say). */
  inNav: boolean;
}

export interface ScreenCoverage {
  /** designedBy: steps that worked on the screen's design. "dedicated" names this screen; "broad" was a pass over many screens. */
  screens: Array<Screen & { designedBy: Array<{ runId: string; taskId: string; title: string; status: string; focus: "dedicated" | "broad" }>; hasSpec: boolean }>;
  uncovered: string[];
  /** Pairs that look alike enough to review together. A flag, not a verdict. */
  similar: Array<{ a: string; b: string; similarity: number; why: string }>;
}

export interface ScreenSpec {
  screenId: string;
  goal: string;
  primaryAction: string;
  hierarchy: string[];
  layout: string;
  responsive: string;
  components: string[];
  tokens: string[];
  copy: string[];
  data: string;
  states: { loading: string; empty: string; error: string; success?: string };
  accessibility: string[];
  icons: string;
  acceptance: string[];
  /** Who wrote it and when (model or person). */
  source: string;
  updatedAt: string;
}

const SPECS = (projectId: string) => `screenSpecs:${projectId}`;
const DESIGN_STEP = /\b(design|redesign|look|layout|style|styl|polish|visual|hierarchy|typograph)/i;

/** The app's screens: the navigation list in App.tsx, plus every screen file. */
export function listScreens(root: string): Screen[] {
  const out: Screen[] = [];
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      return "";
    }
  };
  const app = read("src/App.tsx") || read("src/App.jsx");
  const list = app.match(/const SCREENS\s*=\s*\[([\s\S]*?)\];/)?.[1] ?? "";
  for (const m of list.matchAll(/\{\s*id:\s*["']([\w-]+)["']\s*,\s*label:\s*["']([^"']+)["']/g)) {
    const id = m[1];
    const comp = app.match(new RegExp(`current === ["']${id}["'] \\? <(\\w+)`))?.[1];
    const imp = comp ? app.match(new RegExp(`import ${comp} from ["']\\./([^"']+)["']`))?.[1] : undefined;
    out.push({ id, label: m[2], inNav: true, ...(imp ? { file: `src/${imp.replace(/^\.\//, "")}.tsx` } : {}) });
  }
  let files: string[] = [];
  try {
    files = fs.readdirSync(path.join(root, "src/screens")).filter((f) => /\.(t|j)sx$/.test(f) && !/\.test\./.test(f));
  } catch {
    files = [];
  }
  for (const f of files) {
    const rel = `src/screens/${f}`;
    if (out.some((s) => s.file === rel)) continue;
    // A readable name from the file: NonGMOBrandDetailsScreen.tsx → "Non GMO Brand Details".
    const label = f.replace(/(Screen)?\.(t|j)sx$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
    out.push({ id: f.replace(/\.(t|j)sx$/, ""), label, file: rel, inNav: false });
  }
  return out;
}

/** Imports and JSX tags a screen file uses: its building blocks. */
function blocks(src: string): Set<string> {
  const s = new Set<string>();
  for (const m of src.matchAll(/import\s+(?:\{([^}]+)\}|(\w+))\s+from/g)) for (const n of (m[1] ?? m[2] ?? "").split(",")) if (n.trim()) s.add(`i:${n.trim().split(/\s+as\s+/)[0]}`);
  for (const m of src.matchAll(/<([A-Z]\w+)/g)) s.add(`t:${m[1]}`);
  return s;
}
const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
};

export function screenCoverage(app: App, projectId: string): ScreenCoverage {
  const project = app.store.projects.require(projectId);
  const root = app.projects.jail(project).root;
  const screens = listScreens(root);
  const runs = app.store.runs.where("project_id = ?", projectId);
  const tasks = runs.flatMap((r) => app.store.tasks.where("run_id = ?", r.id));
  const specs = app.store.getSetting<Record<string, ScreenSpec>>(SPECS(projectId), {});
  // A step is about this screen when its title names it, or the screen is one of at most two screen files it changes.
  const dedicated = (t: (typeof tasks)[number], s: Screen) => {
    const base = s.file ? path.basename(s.file).replace(/\.(t|j)sx$/, "").replace(/Screen$/, "").toLowerCase() : s.id.toLowerCase();
    const title = t.title.toLowerCase().replace(/\s+/g, "");
    if ((base && title.includes(base)) || (s.label && t.title.toLowerCase().includes(s.label.toLowerCase()))) return true;
    const screenFiles = [...t.expectedPaths, ...t.actualPaths].filter((p) => /src\/screens\//.test(p));
    return new Set(screenFiles).size <= 2 && !!s.file && screenFiles.includes(s.file);
  };
  const mentions = (t: (typeof tasks)[number], s: Screen) => {
    const text = `${t.title} ${t.objective} ${[...t.expectedPaths, ...t.actualPaths].join(" ")}`.toLowerCase();
    const base = s.file ? path.basename(s.file).replace(/\.(t|j)sx$/, "").toLowerCase() : "";
    return (!!base && text.includes(base)) || (!!s.label && text.includes(s.label.toLowerCase())) || text.includes(`"${s.id}"`) || text.includes(`#/${s.id}`);
  };
  const withCover = screens.map((s) => ({
    ...s,
    designedBy: tasks
      .filter((t) => DESIGN_STEP.test(t.title) && mentions(t, s))
      .map((t) => ({ runId: t.runId, taskId: t.id, title: t.title, status: t.status, focus: dedicated(t, s) ? ("dedicated" as const) : ("broad" as const) })),
    hasSpec: !!specs[s.id],
  }));
  // Covered: a verified design step dedicated to this screen, or a saved spec. A broad polish pass alone doesn't count.
  const uncovered = withCover.filter((s) => !s.designedBy.some((d) => d.status === "verified" && d.focus === "dedicated") && !s.hasSpec).map((s) => s.label ?? s.id);

  const similar: ScreenCoverage["similar"] = [];
  const src = new Map(screens.filter((s) => s.file).map((s) => [s.id, blocks((() => { try { return fs.readFileSync(path.join(root, s.file!), "utf8"); } catch { return ""; } })())]));
  const nav = screens.filter((s) => s.inNav && s.file);
  const text = new Map(nav.map((s) => [s.id, (() => { try { return fs.readFileSync(path.join(root, s.file!), "utf8"); } catch { return ""; } })()]));
  // The data collections a screen reads (useCollection(x)), and whether it lists and searches them.
  const data = new Map([...text].map(([id, t]) => [id, new Set([...t.matchAll(/useCollection\((\w+)\)/g)].map((m) => m[1]))]));
  const listy = new Map([...text].map(([id, t]) => [id, /\.map\(/.test(t) && /search|filter/i.test(t)]));
  for (let i = 0; i < nav.length; i++)
    for (let j = i + 1; j < nav.length; j++) {
      const a = src.get(nav[i].id), b = src.get(nav[j].id);
      if (!a?.size || !b?.size) continue;
      const sim = jaccard(a, b);
      // Same data, both searchable lists: the strongest sign two tabs do the same job.
      const da = data.get(nav[i].id) ?? new Set<string>(), db = data.get(nav[j].id) ?? new Set<string>();
      const shared = [...da].filter((x) => db.has(x));
      const bothLists = listy.get(nav[i].id) && listy.get(nav[j].id);
      if (shared.length && bothLists) similar.push({ a: nav[i].label ?? nav[i].id, b: nav[j].label ?? nav[j].id, similarity: Math.round(sim * 100) / 100, why: `Both show and search the same data (${shared.join(", ")}). Check that they do different jobs, or merge them.` });
      else if (sim >= 0.5) similar.push({ a: nav[i].label ?? nav[i].id, b: nav[j].label ?? nav[j].id, similarity: Math.round(sim * 100) / 100, why: `They share ${Math.round(sim * 100)}% of their building blocks (imports and components). Worth checking they do different jobs.` });
    }
  return { screens: withCover, uncovered, similar };
}

export function getScreenSpecs(app: Pick<App, "store">, projectId: string): Record<string, ScreenSpec> {
  return app.store.getSetting<Record<string, ScreenSpec>>(SPECS(projectId), {});
}

export function saveScreenSpec(app: App, projectId: string, spec: ScreenSpec) {
  const all = getScreenSpecs(app, projectId);
  all[spec.screenId] = spec;
  app.store.setSetting(SPECS(projectId), all);
  return spec;
}

/** The specs a design step should build from: those for screens its title, objective or files mention. */
export function screenSpecBrief(app: Pick<App, "store">, projectId: string, taskText: string): string | undefined {
  const specs = Object.values(getScreenSpecs(app, projectId));
  const text = taskText.toLowerCase();
  const hits = specs.filter((s) => text.includes(s.screenId.toLowerCase()) || text.includes(s.goal.slice(0, 30).toLowerCase()));
  const use = hits.length ? hits : [];
  if (!use.length) return undefined;
  return [
    "Screen specifications (approved for this project; build to them, don't restyle beyond them):",
    ...use.map((s) =>
      [
        `## ${s.screenId}`,
        `Goal: ${s.goal}. Primary action: ${s.primaryAction}.`,
        `Hierarchy (most to least important): ${s.hierarchy.join(" → ")}.`,
        `Layout: ${s.layout}. Narrow screens: ${s.responsive}.`,
        `Components: ${s.components.join(", ")}. Tokens: ${s.tokens.join(", ")}.`,
        `Copy: ${s.copy.join(" | ")}. Data: ${s.data}.`,
        `States: loading — ${s.states.loading}; empty — ${s.states.empty}; error — ${s.states.error}${s.states.success ? `; success — ${s.states.success}` : ""}.`,
        `Accessibility: ${s.accessibility.join("; ")}. Icons: ${s.icons}.`,
        `Done when: ${s.acceptance.join("; ")}.`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

/** Writes a spec for one screen with a model already set up for design (local unless the project allows cloud). */
export async function draftScreenSpec(app: App, projectId: string, screenId: string): Promise<ScreenSpec> {
  const project = app.store.projects.require(projectId);
  const root = app.projects.jail(project).root;
  const screen = listScreens(root).find((s) => s.id === screenId);
  if (!screen) throw new Error(`No screen "${screenId}" in this app`);
  const read = (rel?: string, max = 8000) => {
    if (!rel) return "";
    try {
      return fs.readFileSync(path.join(root, rel), "utf8").slice(0, max);
    } catch {
      return "";
    }
  };
  const tokens = read("src/styles/tokens.css", 4000);
  // What the product is: the first build's request (later runs are small change requests), and its PRD when it has one.
  const first = app.store.runs.where("project_id = ? ORDER BY created_at ASC LIMIT 1", projectId)[0];
  const prdPath = first?.referencePaths?.find((p) => /prd|requirements|spec/i.test(p) && /\.(md|txt)$/i.test(p));
  const product = `${(first?.objective ?? "").slice(0, 3000)}${prdPath ? `\n\nPRD (${prdPath}):\n${read(prdPath, 6000)}` : ""}`;
  // A local model only: specs are provider-independent and drafting one must never spend cloud credit.
  const roles = ["planner", "coder", "documenter"] as const;
  const role = roles.find((r) => !app.router.assignmentFor(r).providerId?.startsWith("hosted")) ?? "documenter";
  const base = app.router.assignmentFor(role);
  const assignment = base.providerId?.startsWith("hosted") ? { ...base, providerId: "ollama" } : base;
  const res = await app.router.chat({ role, projectId }, { ...assignment, temperature: 0.3 }, {
    messages: [
      {
        role: "system",
        content:
          "You write a specification for ONE screen of an app: what the person uses this screen for, its main action, what matters most on it, its layout, and its loading, empty and error states. Describe the screen itself, not a change or a fix. Be concrete and specific to this product: real labels, real data fields, real states. Use the project's existing tokens and kit components (src/components/ui) rather than inventing new styles. No marketing hero. Return JSON only.",
      },
      {
        role: "user",
        content: `What the product is:\n${product}\n\nThe screen to specify: ${screen.label ?? screen.id} (${screen.file ?? "no file yet"})\n\nIts current code:\n${read(screen.file)}\n\nDesign tokens:\n${tokens}`,
      },
    ],
    format: {
      type: "object",
      properties: {
        goal: { type: "string" },
        primaryAction: { type: "string" },
        hierarchy: { type: "array", items: { type: "string" } },
        layout: { type: "string" },
        responsive: { type: "string" },
        components: { type: "array", items: { type: "string" } },
        tokens: { type: "array", items: { type: "string" } },
        copy: { type: "array", items: { type: "string" } },
        data: { type: "string" },
        states: { type: "object", properties: { loading: { type: "string" }, empty: { type: "string" }, error: { type: "string" }, success: { type: "string" } }, required: ["loading", "empty", "error"] },
        accessibility: { type: "array", items: { type: "string" } },
        icons: { type: "string" },
        acceptance: { type: "array", items: { type: "string" } },
      },
      required: ["goal", "primaryAction", "hierarchy", "layout", "responsive", "components", "tokens", "copy", "data", "states", "accessibility", "icons", "acceptance"],
    },
    timeoutMs: 300_000,
  });
  const parsed = JSON.parse(res.content) as Omit<ScreenSpec, "screenId" | "source" | "updatedAt">;
  return { ...parsed, screenId, source: assignment.model, updatedAt: new Date().toISOString() };
}
