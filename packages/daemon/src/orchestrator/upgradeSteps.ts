/**
 * Upgrades for apps FlowCode built earlier, run by the runtime (not a model) at the start of a follow-up request about
 * screens, layout or design:
 *  - "Add FlowCode building blocks": an app made from the React starter before the building blocks existed gets them
 *    (src/components/ui, src/lib/screens.ts, src/styles/components.css and its import in src/main.tsx);
 *  - "Apply the spec's look": an app still wearing the starter's sample palette gets the colours, name and design brief
 *    from the PRD in its spec/ folder.
 * Both are deterministic copies or rewrites through the governed, snapshotted file operations.
 */
import fs from "node:fs";
import path from "node:path";
import type { PlanTask, ReferenceFile } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { AgentOutcome } from "./agentLoop.js";
import { personalizeStarterFile, starterIdentity } from "./starterIdentity.js";
import { templatesRoot, type RuntimeStepArgs } from "./templates.js";
import { layoutsTask } from "./layoutRecipes.js";

export const ADD_BLOCKS = "Add FlowCode building blocks";
export const APPLY_LOOK = "Apply the spec's look";
export const REFRESH_BLOCKS = "Refresh FlowCode building blocks";

const exportsOf = (text: string) => new Set([...text.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+(\w+)/g)].map((m) => m[1]));

/**
 * Building blocks an older app has that differ from FlowCode's current ones and can be replaced safely: the current
 * version still exports everything the app's copy does. The Calculator app's AppShell predated "no navigation tab for
 * a one-screen app" and kept showing a "Calculator" tab. A copy the app extended (an export the current one lacks) is
 * left alone. CSS files follow their components.
 */
export function staleBlocks(jail: PathJail): string[] {
  const src = path.join(templatesRoot(), "react-vite-starter");
  const out: string[] = [];
  for (const rel of BLOCK_FILES) {
    if (/\.test\./.test(rel)) continue;
    const mine = read(jail, rel);
    let theirs: string | undefined;
    try {
      theirs = fs.readFileSync(path.join(src, rel), "utf8");
    } catch {
      continue;
    }
    // A building block the app doesn't have yet (src/sim came later) is added.
    if (mine === undefined) {
      if (exportsOf(read(jail, "src/components/ui/index.tsx") ?? "").has("AppShell")) out.push(rel);
      continue;
    }
    if (mine.replace(/\r\n/g, "\n") === theirs.replace(/\r\n/g, "\n")) continue;
    if (/\.tsx?$/.test(rel)) {
      const current = exportsOf(theirs);
      const own = exportsOf(mine);
      // An empty or unrelated file isn't a copy of the building block.
      if (!own.size || ![...own].every((x) => current.has(x))) continue;
    } else {
      // A stylesheet the app added rules to keeps them: refresh only when every selector it has is still there.
      const selectors = (t: string) => new Set([...t.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()));
      const current = selectors(theirs);
      const own = selectors(mine);
      if (!own.size || ![...own].every((x) => current.has(x))) continue;
    }
    out.push(rel);
  }
  return out;
}

const BLOCK_FILES = ["src/components/ui/index.tsx", "src/components/ui/screen-parts.tsx", "src/styles/screen-parts.css", "src/lib/screens.ts", "src/lib/screens.test.ts", "src/styles/components.css", "src/sim/index.ts"];
/** The React starter's sample accent colour: an app still using it was never themed. */
const STARTER_ACCENT = "#24423a";
const ABOUT_SCREENS = /\b(screens?|layout|design|look|style|styles|ui|ux|pages?|redesign|rebuild|navigation|professional|dashboards?|home|settings)\b/i;

const read = (jail: PathJail, rel: string) => {
  try {
    return fs.readFileSync(path.join(jail.root, rel), "utf8");
  } catch {
    return undefined;
  }
};

/** The PRD files in the app's spec/ folder (imported there by the first build). */
function specRefs(jail: PathJail): ReferenceFile[] {
  const dir = path.join(jail.root, "spec");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(md|markdown|txt)$/i.test(f))
    .slice(0, 4)
    .map((f) => ({ name: f, role: "prd", content: fs.readFileSync(path.join(dir, f), "utf8").slice(0, 200_000) }) as ReferenceFile);
}

function fromReactStarter(jail: PathJail): boolean {
  try {
    return (JSON.parse(read(jail, "package.json") ?? "{}") as { name?: string }).name === "flowcode-starter" && fs.existsSync(path.join(jail.root, "src/main.tsx"));
  } catch {
    return false;
  }
}

/** The upgrade steps a follow-up request needs, if any. */
export function upgradeTasks(jail: PathJail, objective: string): PlanTask[] {
  if (!ABOUT_SCREENS.test(objective) || !fromReactStarter(jail)) return [];
  const tasks: PlanTask[] = [];
  if (!fs.existsSync(path.join(jail.root, "src/components/ui/index.tsx"))) {
    tasks.push({
      key: "fc_blocks",
      title: ADD_BLOCKS,
      objective: "Copy FlowCode's ready-made building blocks (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog, useScreen) into the app.",
      dependsOn: [],
      expectedPaths: BLOCK_FILES,
      acceptanceCriteria: [
        { id: "b1", description: "Building blocks added", check: { type: "file_exists", path: "src/components/ui/index.tsx" } },
        { id: "b2", description: "Their styles are loaded", check: { type: "file_contains", path: "src/main.tsx", text: "components.css" } },
      ],
      verification: [],
      role: "coder",
    });
  }
  else if (staleBlocks(jail).length) {
    tasks.push({
      key: "fc_blocks_refresh",
      title: REFRESH_BLOCKS,
      objective: `Bring FlowCode's building blocks up to date (${staleBlocks(jail).join(", ")}), keeping everything the app uses from them.`,
      dependsOn: [],
      expectedPaths: staleBlocks(jail),
      acceptanceCriteria: [{ id: "r1", description: "The app still type-checks with the updated building blocks", check: { type: "verification", kind: "typecheck" } }],
      verification: ["typecheck"],
      role: "coder",
    });
  }
  const tokens = read(jail, "src/styles/tokens.css") ?? "";
  const refs = specRefs(jail);
  if (tokens.toLowerCase().includes(STARTER_ACCENT) && starterIdentity(refs, "App", objective).colors.length) {
    tasks.push({
      key: "fc_look",
      title: APPLY_LOOK,
      objective: "Replace the starter's sample colours, name and design brief with the ones in the spec.",
      dependsOn: tasks.length ? [tasks[tasks.length - 1].key] : [],
      expectedPaths: ["src/styles/tokens.css", ".flowcode/design-brief.json"],
      acceptanceCriteria: [{ id: "k1", description: "The spec's colours are in the theme", check: { type: "file_contains", path: "src/styles/tokens.css", text: "--brand-" } }],
      verification: [],
      role: "coder",
    });
  }
  // A request for a home, dashboard or settings screen starts it from a ready-made layout (when the app has none yet).
  // Only when the request asks for a new screen in so many words: "registration fails" in a service-worker fix added a
  // sign-in screen step (Calculator app follow-up), and "Make the Calculator screen match the PRD" isn't a new screen either.
  const asksForScreen = /\b(add|create|build)\s+(a|an|another|new|the\s+new)\b[^.]{0,30}\b(screens?|pages?|views?)\b|\bnew\s+(\w+\s+)?(screens?|pages?|views?)\b/i.test(objective);
  const layouts = asksForScreen ? layoutsTask(jail, objective, tasks.length ? [tasks[tasks.length - 1].key] : []) : undefined;
  if (layouts) tasks.push(layouts);
  return tasks;
}

async function addBlocks({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> {
  const src = path.join(templatesRoot(), "react-vite-starter");
  const ctx = { jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved };
  const changed: string[] = [];
  for (const rel of BLOCK_FILES) {
    if (fs.existsSync(path.join(jail.root, rel))) continue;
    const res = deps.ops.create_file(ctx, { path: rel, content: fs.readFileSync(path.join(src, rel), "utf8") });
    if (!res.ok) return { kind: "blocked", reason: `Couldn't add ${rel}: ${res.message}`, nextAction: "Check the workspace, then retry this step" };
    changed.push(rel);
  }
  const main = read(jail, "src/main.tsx") ?? "";
  if (!main.includes("components.css")) {
    const next = main.includes('import "./styles/app.css";') ? main.replace('import "./styles/app.css";', 'import "./styles/app.css";\nimport "./styles/components.css";') : `import "./styles/components.css";\n${main}`;
    const res = deps.ops.replace_file(ctx, { path: "src/main.tsx", content: next, reason: "Load the building blocks' styles" });
    if (!res.ok) return { kind: "blocked", reason: `Couldn't load the building blocks' styles: ${res.message}`, nextAction: "Add import \"./styles/components.css\" to src/main.tsx" };
    changed.push("src/main.tsx");
  }
  onChanged(changed);
  deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Added FlowCode's building blocks (${changed.length} file(s))` });
  return { kind: "complete", summary: `Added ${changed.length} file(s)`, changedPaths: changed };
}

async function refreshBlocks({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> {
  const src = path.join(templatesRoot(), "react-vite-starter");
  const ctx = { jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved };
  const changed: string[] = [];
  for (const rel of staleBlocks(jail)) {
    const content = fs.readFileSync(path.join(src, rel), "utf8");
    const res = fs.existsSync(path.join(jail.root, rel)) ? deps.ops.replace_file(ctx, { path: rel, content, reason: "Update FlowCode's building block to the current version" }) : deps.ops.create_file(ctx, { path: rel, content });
    if (!res.ok) return { kind: "blocked", reason: `Couldn't update ${rel}: ${res.message}`, nextAction: "Retry this step" };
    changed.push(rel);
  }
  onChanged(changed);
  deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Updated FlowCode's building blocks: ${changed.join(", ") || "already current"}` });
  return { kind: "complete", summary: `Updated ${changed.length} file(s)`, changedPaths: changed };
}

async function applyLook({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> {
  const project = deps.store.projects.require(run.projectId);
  const id = starterIdentity(specRefs(jail), project.name, run.objective);
  const ctx = { jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved };
  const changed: string[] = [];
  for (const rel of ["src/styles/tokens.css", ".flowcode/design-brief.json"]) {
    const before = read(jail, rel);
    if (before === undefined) continue;
    const after = personalizeStarterFile(rel, before, id);
    if (after === before) continue;
    const res = deps.ops.replace_file(ctx, { path: rel, content: after, reason: "Use the spec's colours, name and design brief" });
    if (!res.ok) return { kind: "blocked", reason: `Couldn't update ${rel}: ${res.message}`, nextAction: "Retry this step" };
    changed.push(rel);
  }
  onChanged(changed);
  deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Applied the spec's look: ${id.colors.length} colour(s), name "${id.name}"` });
  return { kind: "complete", summary: `Updated ${changed.length} file(s)`, changedPaths: changed };
}

/** Runtime steps available to any run, by task title. */
export const UPGRADE_STEPS: Record<string, (a: RuntimeStepArgs) => Promise<AgentOutcome>> = { [ADD_BLOCKS]: addBlocks, [APPLY_LOOK]: applyLook, [REFRESH_BLOCKS]: refreshBlocks };
