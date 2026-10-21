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
import { LIBRARY_SECTIONS, SECTION_CATEGORIES } from "@flowcode/contracts";
import { LAYOUTS } from "./layoutRecipes.js";
import { recordUse } from "./libraryUse.js";
import { screenPicks, type ScreenPick } from "./screenPicks.js";
import { catalogPiece, pieceFiles, sectionFile, sectionsDir, syncedLibraryCss } from "./sectionRecipes.js";
import { screenBriefKey, type ScreenBrief } from "./screenBrief.js";
import { contractJsx } from "./designContract.js";

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
/**
 * The screens a PRD names itself, in a section about its screens or pages (a table of screen and responsibility, or a
 * list of names). A PRD that lists "Home Screen" and "Brand Detail Screen" means two pages; the planner's habit of
 * folding a detail view into its list (right for a vague request) built one page and left the second out (Build test
 * 3). Empty when the PRD has no such section.
 */
export function declaredScreens(prd: string): Array<{ name: string; purpose: string }> {
  const lines = prd.split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{1,4}\s/.test(l) && /\b(screens?|pages?)\b/i.test(l) && !/\b(states?|errors?|empty)\b/i.test(l));
  if (at < 0) return [];
  const level = (/^#+/.exec(lines[at]!)?.[0].length ?? 2);
  const out: Array<{ name: string; purpose: string }> = [];
  const add = (name: string, purpose: string) => {
    const clean = name.replace(/[*_`]/g, "").replace(/\s+(screen|page|view)$/i, "").replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 40 || /^(screen|page|name|responsibilit(y|ies)|purpose|-+)$/i.test(clean)) return;
    if (!out.some((x) => x.name.toLowerCase() === clean.toLowerCase())) out.push({ name: clean, purpose: purpose.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 200) });
  };
  for (const line of lines.slice(at + 1)) {
    const h = /^(#+)\s/.exec(line);
    if (h && h[1]!.length <= level) break;
    const row = /^\s*\|(.+)\|\s*$/.exec(line);
    if (row) {
      const cells = row[1]!.split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      add(cells[0] ?? "", cells.slice(1).join(" "));
      continue;
    }
    const item = /^\s*(?:[-*]|\d+[.)])\s+(.+)$/.exec(line);
    if (item) {
      const [name, ...rest] = item[1]!.split(/\s*(?::|—|–| - )\s*/);
      add(name ?? "", rest.join(" "));
    }
  }
  return out.slice(0, MAX_SCREENS);
}

export function parseScreenPlan(raw: unknown, declared: Array<{ name: string; purpose: string }> = []): ScreenPlan | undefined {
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
  const product = String(r.product ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "App";
  // The PRD's own screens are the plan: its names, in its order, none folded away. Each keeps the planner's sentence
  // for the screen it most resembles (the planner writes who and why); the PRD's own words otherwise.
  if (declared.length) {
    const toks = (x: string) => new Set(words(x.toLowerCase()).filter((w) => w.length > 2).map(stem));
    const used = new Set<PlannedScreen>();
    const own: PlannedScreen[] = [];
    for (const d of declared) {
      const want = toks(`${d.name} ${d.purpose}`);
      let best: PlannedScreen | undefined;
      let score = 0;
      for (const p of screens) {
        if (used.has(p)) continue;
        const n = [...toks(`${p.label} ${p.purpose}`)].filter((w) => want.has(w)).length;
        if (n > score) (best = p), (score = n);
      }
      if (best && score >= 2) used.add(best);
      const parts = words(d.name);
      const base = parts.map((w) => w[0]!.toUpperCase() + w.slice(1)).join("").replace(/Screen$/, "");
      if (!base || own.some((x) => x.component === `${base}Screen`)) continue;
      own.push({ id: parts.map((w) => w.toLowerCase()).join("-"), label: d.name[0]!.toUpperCase() + d.name.slice(1), component: `${base}Screen`, file: `src/screens/${base}Screen.tsx`, purpose: best && score >= 2 ? best.purpose : d.purpose });
    }
    if (own.length) return { product, screens: own };
  }
  if (!screens.length) return undefined;
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

/**
 * A detail screen (one brand, one order) is reached from its list, not from the navigation: it leaves the top bar, and
 * the list's link stays marked while it is open (Build test 5: "Brand Detail" sat in the nav as a page of its own).
 */
export const isDetailScreen = (plan: ScreenPlan, s: PlannedScreen) => plan.screens.indexOf(s) > 0 && /\bdetails?\b/i.test(s.label);

/** A section's catalog part as a line the design step can act on: the component's usage, or how to add it. */
function partSlot(ref: string): string {
  const piece = catalogPiece(ref);
  const use = (piece?.usage ?? "").replace(/^import \{[^}]*\} from "[^"]+";\s*/, "").replace(/\*\//g, "").slice(0, 180);
  return use ? `${ref}: ${use}` : `${ref} (add_library_piece("${ref}"))`;
}

export const placedKey = (runId: string) => `placedPieces:${runId}`;

export function layoutFiles(plan: ScreenPlan, placements: Placement[] = [], briefs: ScreenBrief[] = []): Array<{ path: string; content: string }> {
  // A screen that is a whole website page (a homepage, landing page or industry site template) brings its own header,
  // navigation and footer, so it is drawn outside the app shell instead of under a second header.
  // An approved design with its own top bar or footer (designContract.ts) is such a page too.
  const ownFrame = (s: PlannedScreen) => briefs.some((b) => b.screen === s.label && b.sections.some((x) => x.contract && /^(top-nav|footer)/.test(x.contract.block)));
  const fullPage = plan.screens.filter((s) => ownFrame(s) || placements.some((p) => p.screen === s.label && p.template && LIBRARY_SECTIONS.find((x) => x.id === p.id)?.category !== "apptemplates"));
  const pick = (list: typeof plan.screens, indent: string) => (list.length === 1 && plan.screens.length === 1 ? [`${indent}<${list[0]!.component} />`] : list.map((s) => `${indent}{current === ${q(s.id)} ? <${s.component} /> : null}`));
  const shelled = plan.screens.filter((s) => !fullPage.includes(s));
  const app = [
    `import { AppShell } from "./components/ui";`,
    `import { useScreen } from "./lib/screens";`,
    ...plan.screens.map((s) => `import ${s.component} from "./screens/${s.component}";`),
    ``,
    `const SCREENS = [${plan.screens.map((s) => `{ id: ${q(s.id)}, label: ${q(s.label)}${isDetailScreen(plan, s) ? `, hidden: true, parent: ${q(plan.screens[0]!.id)}` : ""} }`).join(", ")}];`,
    `const SCREEN_IDS = SCREENS.map((s) => s.id);`,
    ...(fullPage.length ? [`/** Whole website pages: drawn on their own, with their own header and footer. */`, `const FULL_PAGE = [${fullPage.map((s) => q(s.id)).join(", ")}];`] : []),
    ``,
    `export default function App() {`,
    `  const [current, go] = useScreen(SCREEN_IDS);`,
    ...(fullPage.length ? [`  if (FULL_PAGE.includes(current)) return (`, `    <>`, ...pick(fullPage, "      "), `    </>`, `  );`] : []),
    `  return (`,
    `    <AppShell name=${q(plan.product)} screens={SCREENS} current={current} onNavigate={go}>`,
    ...pick(shelled, "      "),
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
    // With a brief, the screen is its sections in the brief's order: a catalog piece where the section has one in the
    // app, a marked slot with the part's usage where it is a component the design step puts in, so the screen starts
    // from the person's view (what they must see first) and the catalog, not from a title over a list.
    const brief = briefs.find((b) => b.screen === s.label);
    if (brief && !template) {
      const placedFor = (ref: string) => pieces.find((p) => catalogPiece(ref)?.id === p.id);
      // An approved design's page (designContract.ts) is its sections with their approved content, no page header; its
      // top bar also links to the app's other screens, so none of them is cut off.
      const approved = fullPage.includes(s) || brief.sections.some((x) => x.contract);
      const others = plan.screens.filter((o) => o !== s && !isDetailScreen(plan, o)).map((o) => ({ label: o.label, href: `#/${o.id}` }));
      const named: string[] = [];
      const lines = brief.sections.flatMap((x, i) => {
        const p = x.contract ? pieces.find((y) => y.id === x.contract!.block) : x.part ? placedFor(x.part) : undefined;
        const note = `${i + 1}. ${x.title}: ${x.purpose}`.replace(/\*\//g, "");
        if (p && x.contract) {
          named.push(`import { ${x.contract.component} } from "../sections/${p.component}";`);
          const links = Array.isArray(x.contract.props.links) ? (x.contract.props.links as Array<{ label?: string }>) : undefined;
          const extra = links ? { links: [...links, ...others.filter((o) => !links.some((l) => l.label === o.label))] } : {};
          return [`      {/* ${note} */}`, `      ${contractJsx(x.contract, extra)}`];
        }
        return p ? [`      {/* ${note} */}`, `      <${p.component} />`] : [`      {/* ${note}${x.part ? ` Build it with ${partSlot(x.part)}` : ""} */}`];
      });
      const placedUsed = pieces.filter((p) => brief.sections.some((x) => x.part && !x.contract && placedFor(x.part) === p));
      return {
        path: s.file,
        content: [
          ...(approved ? [] : [`import { PageHeader } from "../components/ui";`]),
          ...[...new Set(named)],
          ...placedUsed.map((p) => `import ${p.component} from "../sections/${p.component}";`),
          ``,
          `/**`,
          ` * ${s.label}${s.purpose ? `: ${s.purpose.replace(/\*\//g, "")}` : ""}`,
          ` * For: ${brief.who.replace(/\*\//g, "")}. First view: ${brief.firstView.replace(/\*\//g, "")} Main action: ${brief.primaryAction.replace(/\*\//g, "")}`,
          ` */`,
          `export default function ${s.component}() {`,
          `  return (`,
          `    <>`,
          ...(approved ? [] : [`      <PageHeader title=${q(s.label)} />`]),
          ...lines,
          `    </>`,
          `  );`,
          `}`,
          ``,
        ].join("\n"),
      };
    }
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

/**
 * The app still has the starter's App (no AppShell), the kit FlowCode's layout uses, and no screens of its own yet. A
 * ready-made screen layout the runtime copied in (ADD_LAYOUTS) doesn't count: it is a starting point for one screen,
 * not a layout. Counting it handed the whole layout to the model, which ignored the planned screens and the matched
 * catalog parts and wrote every screen inline in App.tsx (Build test 2: a ready-made ListScreen, then a hand-built app).
 */
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
  const readyMade = new Set(LAYOUTS.map((l) => path.basename(l.screen)));
  return !fs.existsSync(dir) || !fs.readdirSync(dir).some((f) => /\.(tsx|jsx)$/.test(f) && !readyMade.has(f));
}

/**
 * A whole-page template (an app screen, a homepage, a landing page, an industry site): it becomes the screen instead of
 * sitting under its page header. Only app screens counted before, so a website screen that matched a homepage got the
 * page title on top of a whole homepage.
 */
export const isPageTemplate = (id: string) => {
  const category = LIBRARY_SECTIONS.find((x) => x.id === id)?.category;
  return SECTION_CATEGORIES.find((c) => c.id === category)?.group === "template";
};

/** The layout step done by FlowCode: App.tsx with the app shell and every planned screen, plus each screen's file. */
export function layoutStep(plan: ScreenPlan) {
  return async ({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> => {
    const ctx = { jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved };
    const changed: string[] = [];
    // The library pieces matched to each screen go into it, so the screens start from the library (the design step fills
    // in the content). Only when the app has the library's styles; a piece the library step didn't copy is copied here.
    const placements: Placement[] = [];
    const briefs = deps.store.getSetting<ScreenBrief[]>(screenBriefKey(run.id), []);
    if (fs.existsSync(path.join(jail.root, "src/styles/library.css"))) {
      const matched = deps.store.getSetting<ScreenPick[] | undefined>(screenPicksKey(run.id), undefined) ?? screenPicks(plan.screens);
      // A screen with a brief takes the brief's pieces, in its order; one without keeps its matched starting pieces.
      const fromBriefs: ScreenPick[] = briefs.flatMap((b) =>
        b.sections.flatMap((x) => {
          // An approved design's section is its exact library piece (a catalog ID can name a pattern another piece owns).
          const piece = x.contract ? LIBRARY_SECTIONS.find((l) => l.id === x.contract!.block) : x.part ? catalogPiece(x.part) : undefined;
          return piece && (!piece.specimen || x.contract) ? [{ id: piece.id, screen: b.screen, score: 99, reason: `${b.screen}, section "${x.title}": ${piece.name}` }] : [];
        }),
      );
      const picks = [...fromBriefs.filter((p, i, all) => all.findIndex((x) => x.id === p.id && x.screen === p.screen) === i), ...matched.filter((p) => !briefs.some((b) => b.screen === p.screen))];
      const lib = path.join(sectionsDir(), "sections");
      for (const p of picks) {
        if (!plan.screens.some((s) => s.label === p.screen)) continue;
        const rel = sectionFile(p.id);
        const component = path.basename(rel, ".tsx");
        // The piece, the pieces it's built from, and the icons they share.
        for (const f of [{ rel: "src/sections/icons.tsx", content: fs.readFileSync(path.join(lib, "icons.tsx"), "utf8") }, ...pieceFiles(p.id)]) {
          if (fs.existsSync(path.join(jail.root, f.rel))) continue;
          const res = deps.ops.create_file(ctx, { path: f.rel, content: f.content });
          if (res.ok) changed.push(f.rel);
        }
        if (!fs.existsSync(path.join(jail.root, rel))) continue;
        recordUse(deps.store, run.id, { id: p.id, by: "flowcode", step: task.title, reason: p.reason });
        placements.push({ screen: p.screen, id: p.id, component, template: isPageTemplate(p.id) });
      }
      const css = syncedLibraryCss(jail.root);
      if (css !== undefined && deps.ops.replaceContent(ctx, "src/styles/library.css", css).ok) changed.push("src/styles/library.css");
    }
    deps.store.setSetting(placedKey(run.id), placements.map((p) => ({ ...p, screenFile: plan.screens.find((s) => s.label === p.screen)!.file })));
    for (const f of layoutFiles(plan, placements, briefs)) {
      const exists = fs.existsSync(path.join(jail.root, f.path));
      // A ready-made screen layout already there is that screen's finished starting point: kept, not overwritten.
      if (exists && f.path !== "src/App.tsx" && LAYOUTS.some((l) => l.screen === f.path)) continue;
      const res = exists ? deps.ops.replace_file(ctx, { path: f.path, content: f.content, reason: "The app shell with the planned screens" }) : deps.ops.create_file(ctx, { path: f.path, content: f.content });
      if (!res.ok) return { kind: "blocked", reason: `Couldn't write ${f.path}: ${res.message}`, nextAction: "Retry this step" };
      changed.push(f.path);
    }
    onChanged(changed);
    deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Wrote the app layout from the plan's ${plan.screens.length} screen${plan.screens.length === 1 ? "" : "s"}: ${plan.screens.map((s) => s.label).join(", ")}${placements.length ? `. Screens start from library pieces: ${placements.map((p) => `${p.screen} → ${LIBRARY_SECTIONS.find((x) => x.id === p.id)?.name ?? p.id}`).join(", ")}` : ""}` });
    return { kind: "complete", summary: `App shell with ${plan.screens.length} screen(s)`, changedPaths: changed };
  };
}
