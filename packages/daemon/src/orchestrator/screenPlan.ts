/**
 * The app's screens, decided once before the build steps are planned, so every step names the same screen files and
 * FlowCode can write the app layout itself.
 *
 * NOBIO build: the plan's parts named the main screen five ways (NonGMOBrandsScreen, BrandListScreen,
 * NonGmoBrandsScreen…), and "App layout and navigation" read the same three files for three attempts without deciding
 * on the screens, then stopped the build. The planner now only names the screens; ids, component names and files are
 * derived here, so they can't drift.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import type { AgentOutcome } from "./agentLoop.js";
import type { RuntimeStepArgs } from "./templates.js";
import { LIBRARY_SECTIONS } from "@flowcode/contracts";
import { recordUse } from "./libraryUse.js";
import { screenPicks, type ScreenPick } from "./screenPicks.js";
import { sectionFile, sectionsDir, syncedLibraryCss } from "./sectionRecipes.js";

/** The library pieces matched to the planned screens (kept by planning, read by the layout step). */
export const screenPicksKey = (runId: string) => `screenPicks:${runId}`;

export const APP_LAYOUT = "App layout and navigation";
export const MAX_SCREENS = 6;

export interface PlannedScreen {
  /** The URL id (#/brands). */
  id: string;
  /** The navigation label and page title. */
  label: string;
  /** The component name, e.g. BrandsScreen. */
  component: string;
  /** src/screens/BrandsScreen.tsx */
  file: string;
  /** What the person does there, one sentence from the spec. */
  purpose: string;
}

export interface ScreenPlan {
  product: string;
  screens: PlannedScreen[];
}

export const screenPlanKey = (runId: string) => `screenPlan:${runId}`;

export const SCREENS_SYSTEM = `You decide which screens a clickable prototype has. You get a product request and its requirements.
Return the product's name and its main screens: the places a person navigates between, each with a short name (one to
three words, as it would appear in the navigation) and, as its purpose, one sentence on the job the person there is
trying to get done, in their words and naming who they are (e.g. "Managers decide on time off requests from their
team", "Customers see where their order is and why it's late").
- A screen is a separate destination in the navigation, about a different thing. Most prototypes have 1 to 4.
- Actions on a list are controls ON that list's screen, never screens: searching, filtering, sorting, adding, editing,
  deleting, and opening one item's details (a detail view of a brand or an order belongs to its list's screen).
  Example: "find brands by name, filter by category, sort by rating, see a brand's details" is ONE screen, "Brands".
- Only screens the requirements name or clearly need. No settings, profile, home, about or sign-in screen unless a
  requirement asks for one.
- A single tool (a calculator, a timer, a converter, a game) is one screen.
- At most ${MAX_SCREENS} screens, the one a new person should start on first.
Answer with JSON only.`;

export const SCREENS_SCHEMA = {
  type: "object",
  properties: {
    product: { type: "string" },
    screens: { type: "array", items: { type: "object", properties: { name: { type: "string" }, purpose: { type: "string" } }, required: ["name", "purpose"] } },
  },
  required: ["product", "screens"],
};

const words = (s: string) => s.replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);

/** The planner's answer as a screen plan with derived ids and files; undefined when it names no usable screen. */
export function parseScreenPlan(raw: unknown): ScreenPlan | undefined {
  const r = (raw ?? {}) as { product?: unknown; screens?: unknown };
  const list = Array.isArray(r.screens) ? r.screens : [];
  const screens: PlannedScreen[] = [];
  for (const s of list as Array<{ name?: unknown; purpose?: unknown }>) {
    // "Brand list screen" and "Settings page" are named without the word.
    const label = words(String(s?.name ?? "").replace(/\s+(screen|page|view|tab)$/i, "")).slice(0, 4).join(" ");
    if (!label || /^\d/.test(label)) continue;
    const parts = words(label);
    const id = parts.map((w) => w.toLowerCase()).join("-");
    const base = parts.map((w) => w[0]!.toUpperCase() + w.slice(1)).join("").replace(/Screen$/, "");
    if (screens.some((x) => x.id === id || x.component === `${base}Screen`)) continue;
    const purpose = String(s?.purpose ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    screens.push({ id, label: label[0]!.toUpperCase() + label.slice(1), component: `${base}Screen`, file: `src/screens/${base}Screen.tsx`, purpose });
    if (screens.length === MAX_SCREENS) break;
  }
  if (!screens.length) return undefined;
  const product = String(r.product ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "App";
  return { product, screens: foldActionScreens(screens) };
}

const ACTION_WORDS = /^(filter|filtering|search|searching|find|sort|sorting|add|new|create|creation|edit|editing|update|delete|remove|view|details?|info|manage)$/i;
const stem = (w: string) => w.toLowerCase().replace(/(ies)$/, "y").replace(/s$/, "");

/**
 * A screen named for an action on another screen's subject is folded into that screen: "Filter Brands", "Search
 * Brands" and "Brand Detail" next to "Brands List" are controls on the list (NOBIO: the planner named five screens for
 * one list, although told not to). The first screen is never folded.
 */
export function foldActionScreens(screens: PlannedScreen[]): PlannedScreen[] {
  const nouns = (s: PlannedScreen) => words(s.label).filter((w) => !ACTION_WORDS.test(w) && !/^(list|lists|screen|page)$/i.test(w)).map(stem);
  return screens.filter((s, i) => {
    if (i === 0) return true;
    const w = words(s.label);
    if (!w.some((x) => ACTION_WORDS.test(x))) return true;
    const mine = nouns(s);
    return !screens.some((o, j) => j !== i && !words(o.label).some((x) => ACTION_WORDS.test(x)) && mine.length > 0 && mine.every((n) => nouns(o).includes(n)));
  });
}

/** For each part of the plan: the screen files to work in, so every part names the same ones. */
export function screenPlanNote(plan: ScreenPlan): string {
  return `The app's screens are decided (one file each; name these exact files, and add no other screen):\n${plan.screens.map((s) => `- ${s.file}: ${s.label}${s.purpose ? `, ${s.purpose}` : ""}`).join("\n")}`;
}

const q = (s: string) => JSON.stringify(s);

/** src/App.tsx and one starting file per screen (a page header with the screen's real title and purpose). */
/** A library piece FlowCode puts into a screen: the screen starts from it, and the design step fills in the content. */
export interface Placement {
  /** The screen's label. */
  screen: string;
  id: string;
  /** The piece's component (and file) name in src/sections/. */
  component: string;
  /** A whole-screen template (it replaces the page header) rather than a component under it. */
  template: boolean;
}

export const placedKey = (runId: string) => `placedPieces:${runId}`;

export function layoutFiles(plan: ScreenPlan, placements: Placement[] = []): Array<{ path: string; content: string }> {
  const app = [
    `import { AppShell } from "./components/ui";`,
    `import { useScreen } from "./lib/screens";`,
    ...plan.screens.map((s) => `import ${s.component} from "./screens/${s.component}";`),
    ``,
    `const SCREENS = [${plan.screens.map((s) => `{ id: ${q(s.id)}, label: ${q(s.label)} }`).join(", ")}];`,
    `const SCREEN_IDS = SCREENS.map((s) => s.id);`,
    ``,
    `export default function App() {`,
    `  const [current, go] = useScreen(SCREEN_IDS);`,
    `  return (`,
    `    <AppShell name=${q(plan.product)} screens={SCREENS} current={current} onNavigate={go}>`,
    ...(plan.screens.length === 1 ? [`      <${plan.screens[0]!.component} />`] : plan.screens.map((s) => `      {current === ${q(s.id)} ? <${s.component} /> : null}`)),
    `    </AppShell>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
  const screens = plan.screens.map((s) => {
    // Controls (a filter bar, tabs) above the content they act on.
    const controls = (p: Placement) => (["forms", "wayfinding"].includes(LIBRARY_SECTIONS.find((x) => x.id === p.id)?.category ?? "") ? 0 : 1);
    const pieces = placements.filter((p) => p.screen === s.label).sort((a, b) => controls(a) - controls(b));
    const template = pieces.find((p) => p.template);
    const header = `<PageHeader title=${q(s.label)}${s.purpose ? ` description=${q(s.purpose)}` : ""} />`;
    // A whole-screen template is the screen; components sit under the page header. Either way the design step replaces
    // their SAMPLE content with the spec's.
    const used = template ? [template] : pieces;
    const body = template
      ? [`  return <${template.component} />;`]
      : pieces.length
        ? [`  return (`, `    <>`, `      ${header}`, ...pieces.map((p) => `      <${p.component} />`), `    </>`, `  );`]
        : [`  return ${header};`];
    return {
      path: s.file,
      content: [
        ...(template ? [] : [`import { PageHeader } from "../components/ui";`]),
        ...used.map((p) => `import ${p.component} from "../sections/${p.component}";`),
        ``,
        `/** ${s.label}${s.purpose ? `: ${s.purpose.replace(/\*\//g, "")}` : ""} */`,
        `export default function ${s.component}() {`,
        ...body,
        `}`,
        ``,
      ].join("\n"),
    };
  });
  return [{ path: "src/App.tsx", content: app }, ...screens];
}

/**
 * Whether FlowCode writes the layout step for this run: a screen plan exists, the app still has the starter's App (no
 * AppShell) and no screens yet (ready-made layout screens are wired by the coder instead).
 */
export function writesLayout(plan: ScreenPlan | undefined, jail: PathJail): plan is ScreenPlan {
  return !!plan?.screens.length && layoutOpen(jail);
}

/** The app still has the starter's App (no AppShell), the kit FlowCode's layout uses, and no screens yet. */
export function layoutOpen(jail: PathJail): boolean {
  const root = jail.root;
  if (!fs.existsSync(path.join(root, "src/components/ui/index.tsx")) || !fs.existsSync(path.join(root, "src/lib/screens.ts"))) return false;
  let app = "";
  try {
    app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  } catch {
    app = "";
  }
  if (app.includes("<AppShell")) return false;
  const dir = path.join(root, "src/screens");
  return !fs.existsSync(dir) || !fs.readdirSync(dir).some((f) => /\.(tsx|jsx)$/.test(f));
}

/** The layout step done by FlowCode: App.tsx with the app shell and every planned screen, plus each screen's file. */
export function layoutStep(plan: ScreenPlan) {
  return async ({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> => {
    const ctx = { jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved };
    const changed: string[] = [];
    // The library pieces matched to each screen go into it, so the screens start from the library (the design step fills
    // in the content). Only when the app has the library's styles; a piece the library step didn't copy is copied here.
    const placements: Placement[] = [];
    if (fs.existsSync(path.join(jail.root, "src/styles/library.css"))) {
      const picks = deps.store.getSetting<ScreenPick[] | undefined>(screenPicksKey(run.id), undefined) ?? screenPicks(plan.screens);
      const lib = path.join(sectionsDir(), "sections");
      for (const p of picks) {
        if (!plan.screens.some((s) => s.label === p.screen)) continue;
        const rel = sectionFile(p.id);
        const component = path.basename(rel, ".tsx");
        for (const [need, from] of [["src/sections/icons.tsx", "icons.tsx"], [rel, `${p.id}.tsx`]] as const) {
          if (fs.existsSync(path.join(jail.root, need))) continue;
          const res = deps.ops.create_file(ctx, { path: need, content: fs.readFileSync(path.join(lib, from), "utf8") });
          if (res.ok) changed.push(need);
        }
        if (!fs.existsSync(path.join(jail.root, rel))) continue;
        recordUse(deps.store, run.id, { id: p.id, by: "flowcode", step: task.title, reason: p.reason });
        placements.push({ screen: p.screen, id: p.id, component, template: LIBRARY_SECTIONS.find((x) => x.id === p.id)?.category === "apptemplates" });
      }
      const css = syncedLibraryCss(jail.root);
      if (css !== undefined && deps.ops.replaceContent(ctx, "src/styles/library.css", css).ok) changed.push("src/styles/library.css");
    }
    deps.store.setSetting(placedKey(run.id), placements.map((p) => ({ ...p, screenFile: plan.screens.find((s) => s.label === p.screen)!.file })));
    for (const f of layoutFiles(plan, placements)) {
      const exists = fs.existsSync(path.join(jail.root, f.path));
      const res = exists ? deps.ops.replace_file(ctx, { path: f.path, content: f.content, reason: "The app shell with the planned screens" }) : deps.ops.create_file(ctx, { path: f.path, content: f.content });
      if (!res.ok) return { kind: "blocked", reason: `Couldn't write ${f.path}: ${res.message}`, nextAction: "Retry this step" };
      changed.push(f.path);
    }
    onChanged(changed);
    deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Wrote the app layout from the plan's ${plan.screens.length} screen${plan.screens.length === 1 ? "" : "s"}: ${plan.screens.map((s) => s.label).join(", ")}${placements.length ? `. Screens start from library pieces: ${placements.map((p) => `${p.screen} → ${LIBRARY_SECTIONS.find((x) => x.id === p.id)?.name ?? p.id}`).join(", ")}` : ""}` });
    return { kind: "complete", summary: `App shell with ${plan.screens.length} screen(s)`, changedPaths: changed };
  };
}
