/**
 * "Complete app" builds: the app written from its app model (appModel.ts) without the model writing code. The schema and
 * sample records, the one store every page uses, the routes, a screen per destination built from the library's working
 * patterns (the resource index, record wizard, record detail and app dashboard), and the app frame with the whole
 * navigation. Placeholders are destinations the frame shows as "not in this prototype"; custom pages are left for the
 * build's design and feature steps, as a screen with its purpose.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SURFACES, LIBRARY_SECTIONS, type PlanTask } from "@flowcode/contracts";
import type { AgentOutcome } from "./agentLoop.js";
import type { AppModel, ModelView } from "./appModel.js";
import { appModelKey, appModelNote } from "./appModel.js";
import { ADD_LAYOUTS } from "./layoutRecipes.js";
import { APP_LAYOUT, type ScreenPlan } from "./screenPlan.js";
import { recordUse } from "./libraryUse.js";
import { LOOKUP_PIECES, homePieces, lookupAppSource, lookupData, lookupFile, lookupLinks, lookupScreenSource } from "./lookupFiles.js";
import { pieceFiles, sectionsDir, syncedLibraryCss } from "./sectionRecipes.js";
import { DESIGN_POLISH, DESIGN_SCREENS, type RuntimeStepArgs } from "./templates.js";
import { applyDesignSpec, type DesignSpec } from "../workspace/designSpec.js";
import { getDesignState } from "../workspace/designState.js";
import { conceptTimingsKey, designDirectionKey, designSpecKey, type ConceptTimings, type DesignDirection } from "./homeConceptOffer.js";

/** The library pieces a complete app is built from. */
export const APP_PIECES = ["app-frame", "resource-index", "record-wizard", "record-detail", "app-dashboard"];
/** The pieces this app is built from: the look-up pieces for a look-up app, the working app pieces otherwise. */
export const piecesOf = (m: AppModel) => (m.lookup ? [...LOOKUP_PIECES, ...homePieces(m.home)] : APP_PIECES);

/**
 * The pieces this app needs that the owner hasn't approved yet (still on the approval shelf). Builds never use a piece
 * before it is approved, so an app that needs one isn't written this way: the build designs its screens instead.
 */
export function unapprovedPieces(m: AppModel, library = LIBRARY_SECTIONS): string[] {
  const approved = new Set(library.map((s) => s.id));
  return piecesOf(m).filter((id) => !approved.has(id));
}

const DEFAULT_ICON: Record<ModelView["kind"], string> = { list: "folder", create: "plus", detail: "file", dashboard: "chart", queue: "check", custom: "layers", placeholder: "layers", landing: "home", catalog: "search", categories: "layers", entry: "file", places: "pin", lists: "check", mylist: "check", saved: "bookmark" };
const pascal = (id: string) => id.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
export const screenFileOf = (v: ModelView) => `src/screens/${pascal(v.id)}Screen.tsx`;
const q = (s: string) => JSON.stringify(s);
/** A JSX attribute value from the model's words: an expression holding a JS string, so no quote ends it early. */
const attr = (s: string) => `{${JSON.stringify(s)}}`;
/** The model's words inside a comment: nothing that closes it or starts a new line. */
export const commentSafe = (s: string) => s.replace(/\*\//g, "* /").replace(/[\r\n\u2028\u2029]+/g, " ");

/** The views that get a screen file (placeholders are drawn by the frame). */
export const builtViews = (m: AppModel) => m.nav.flatMap((g) => g.items).filter((v) => v.kind !== "placeholder");

/** The destinations an entity's pages link between: its list, its create wizard, its detail page. */
function entityRoutes(m: AppModel, entity: string) {
  const all = m.nav.flatMap((g) => g.items);
  return {
    list: all.find((v) => v.kind === "list" && v.entity === entity)?.id,
    create: all.find((v) => v.kind === "create" && v.entity === entity)?.id,
    detail: all.find((v) => v.kind === "detail" && v.entity === entity)?.id,
  };
}

function screenSource(m: AppModel, v: ModelView): string {
  const e = m.entities.find((x) => x.key === v.entity) ?? m.entities[0]!;
  const r = entityRoutes(m, e.key);
  const name = `${pascal(v.id)}Screen`;
  const head = `/**\n * ${commentSafe(v.label)}${v.purpose ? `: ${commentSafe(v.purpose)}` : ""}\n * Built by FlowCode from the app model; it reads and writes the app's one store (src/app/store.ts).\n */`;
  const nav = `import { go } from "../app/routes";\nimport { store } from "../app/store";`;
  const open = r.detail ? `(id) => go(${q(r.detail)}, id)` : "undefined";
  switch (v.kind) {
    case "list":
      return `${head}\nimport { ResourceIndex } from "../sections/ResourceIndex";\n${nav}\n\nexport default function ${name}() {\n  return <ResourceIndex store={store} entity=${attr(e.key)} title=${attr(v.label)} onOpen={${open}}${r.create ? ` onCreate={() => go(${q(r.create)})}` : ""} />;\n}\n`;
    case "queue": {
      // The status that waits on someone: the first one a transition moves records out of, after the first.
      const waiting = e.transitions?.find((t) => t.from.length && t.from[0] !== e.statuses?.[0]?.key)?.from[0] ?? e.statuses?.[1]?.key;
      return `${head}\nimport { ResourceIndex } from "../sections/ResourceIndex";\n${nav}\n\nexport default function ${name}() {\n  return <ResourceIndex store={store} entity=${attr(e.key)} title=${attr(v.label)}${v.purpose ? ` description=${attr(v.purpose)}` : ""}${waiting ? ` initialStatus=${attr(waiting)}` : ""} onOpen={${open}} />;\n}\n`;
    }
    case "create": {
      const submit = e.transitions?.find((t) => t.from.includes(e.statuses?.[0]?.key ?? ""))?.key;
      return `${head}\nimport { RecordWizard } from "../sections/RecordWizard";\nimport { useHashId } from "../sections/AppData";\n${nav}\n\nexport default function ${name}() {\n  const draftId = useHashId(${q(v.id)});\n  return (\n    <RecordWizard\n      key={draftId ?? "new"}\n      store={store}\n      entity=${attr(e.key)}\n      draftId={draftId}${submit ? `\n      submitTransition=${attr(submit)}` : ""}\n      onDone={${r.detail ? `(id) => go(${q(r.detail)}, id)` : r.list ? `() => go(${q(r.list)})` : "undefined"}}\n      onCancel={${r.list ? `() => go(${q(r.list)})` : "undefined"}}\n    />\n  );\n}\n`;
    }
    case "detail":
      return `${head}\nimport { RecordDetail } from "../sections/RecordDetail";\nimport { useHashId } from "../sections/AppData";\n${nav}\n\nexport default function ${name}() {\n  const id = useHashId(${q(v.id)}) ?? "";\n  return <RecordDetail store={store} entity=${attr(e.key)} id={id}${r.list ? ` onBack={() => go(${q(r.list)})}` : ""}${r.create ? ` onOpenDraft={(draft) => go(${q(r.create)}, draft)}` : ""} />;\n}\n`;
    case "dashboard":
      return `${head}\nimport { AppDashboard } from "../sections/AppDashboard";\n${nav}\n\nexport default function ${name}() {\n  return <AppDashboard store={store} entity=${attr(e.key)} title=${attr(v.label)}${v.purpose ? ` description=${attr(v.purpose)}` : ""} onOpen={${open}}${r.list ? ` onViewAll={() => go(${q(r.list)})}` : ""}${r.create ? ` onCreate={() => go(${q(r.create)})}` : ""} />;\n}\n`;
    default:
      // A custom page: the design and feature steps build it from its purpose, on the same store.
      return `${head}\nimport { PageHeader } from "../components/ui";\n${nav}\n\nexport default function ${name}() {\n  void store;\n  void go;\n  return (\n    <main className="fl-wrap">\n      <PageHeader title=${attr(v.label)}${v.purpose ? ` description=${attr(v.purpose)}` : ""} />\n      {/* 1. ${commentSafe(v.label)}: ${commentSafe(v.purpose ?? "this page's working content")} */}\n    </main>\n  );\n}\n`;
  }
}

/**
 * What a live preview of a look-up app runs on: the same schema, records, look-up config and frame links its files
 * hold (appFiles), so a Home concept is previewed on the app's own data before the app is written.
 */
export function lookupPreview(m: AppModel) {
  if (!m.lookup) return undefined;
  const r = Object.fromEntries(m.nav.flatMap((g) => g.items).map((v) => [v.kind, v.id]));
  return {
    schema: { appKey: m.product.toLowerCase().replace(/[^a-z0-9]+/g, "-"), roles: m.roles, entities: m.entities },
    records: m.seed,
    lookupConfig: lookupData(m).config,
    lookupSeed: lookupData(m).seed,
    links: lookupLinks(m, DEFAULT_ICON),
    product: m.product,
    landing: r.landing,
    saved: r.saved,
  };
}

/** Every file of the app's data, routes, screens and frame. */
export function appFiles(m: AppModel): Array<{ path: string; content: string }> {
  const views = m.nav.flatMap((g) => g.items);
  const built = builtViews(m);
  const parent: Record<string, string> = {};
  for (const v of views) if (v.kind === "detail" && v.entity) {
    const list = entityRoutes(m, v.entity).list;
    if (list) parent[v.id] = list;
  }
  const schema = { appKey: m.product.toLowerCase().replace(/[^a-z0-9]+/g, "-"), roles: m.roles, entities: m.entities };
  const navForFrame = m.nav.map((g) => ({ label: g.label, items: g.items.filter((v) => v.kind !== "detail").map((v) => ({ id: v.id, label: v.label, icon: v.icon ?? DEFAULT_ICON[v.kind], ...(v.kind === "placeholder" ? { available: false } : {}) })) })).filter((g) => g.items.length);
  const first = built.find((v) => v.kind === "landing") ?? built.find((v) => v.kind === "dashboard") ?? built.find((v) => v.kind === "list") ?? built[0];
  const ids = [...(first ? [first.id] : []), ...views.map((v) => v.id).filter((id) => id !== first?.id)];
  return [
    {
      path: "src/app/schema.ts",
      content: `/** The app's records, written by FlowCode from the app model: what each record holds, its statuses and status changes, and the sample data. */\nimport type { AppSchema, RecordData } from "../sections/AppData";\n\nexport const schema: AppSchema = ${JSON.stringify(schema, null, 2)};\n\nexport const seed: Record<string, RecordData[]> = ${JSON.stringify(m.seed, null, 2)};\n`,
    },
    {
      path: "src/app/store.ts",
      content: `/** The one store every page reads and writes (kept in this browser). */\nimport { createStore } from "../sections/AppData";\nimport { schema, seed } from "./schema";\n\nexport const store = createStore(schema, seed, { user: "You", role: ${q(m.roles[0] ?? "")} });\n`,
    },
    {
      path: "src/app/routes.ts",
      content: `/** The app's destinations and how to go to one (#/<id> or #/<id>/<record id>). */\nimport * as screens from "../lib/screens";\n\nconst { linkTo } = screens;\n\nexport const SCREEN_IDS = ${JSON.stringify(ids)};\n\n/** A detail page highlights its list in the navigation. */\nexport const PARENT: Record<string, string> = ${JSON.stringify(parent)};\n\nexport const NAV = ${JSON.stringify(navForFrame, null, 2)};\n\nexport function go(screen: string, id?: string) {\n  window.location.hash = linkTo(screen, id).slice(1);\n}\n\n/** The same screen with another filter or search (#/<id>/<arg>): not a new page, so focus and scrolling stay. */\nexport function update(screen: string, id?: string) {\n  // Apps made before the router knew same-page updates fall back to an ordinary navigation.\n  const updateRoute = (screens as Record<string, unknown>).updateRoute as ((s: string, i?: string) => void) | undefined;\n  if (updateRoute) updateRoute(screen, id);\n  else go(screen, id);\n}\n`,
    },
    ...built.map((v) => ({ path: screenFileOf(v), content: (m.lookup ? lookupScreenSource(m, v) : undefined) ?? screenSource(m, v) })),
    ...(m.lookup ? [lookupFile(m), { path: "src/App.tsx", content: lookupAppSource(m, built, DEFAULT_ICON) }] : []),
    {
      path: "src/App.tsx",
      content: [
        `/** ${commentSafe(m.product)}: the app frame with the whole navigation, and the page for each destination. Written by FlowCode from the app model. */`,
        `import type { ComponentType } from "react";`,
        `import { AppFrame } from "./sections/AppFrame";`,
        `import { useRoute } from "./lib/screens";`,
        `import { store } from "./app/store";`,
        `import { NAV, PARENT, SCREEN_IDS, go } from "./app/routes";`,
        ...built.map((v) => `import ${pascal(v.id)}Screen from "./screens/${pascal(v.id)}Screen";`),
        ``,
        `const VIEWS: Record<string, ComponentType> = {`,
        ...built.map((v) => `  ${q(v.id)}: ${pascal(v.id)}Screen,`),
        `};`,
        ``,
        `export default function App() {`,
        `  const { screen } = useRoute(SCREEN_IDS);`,
        `  const View = VIEWS[screen];`,
        `  return (`,
        `    <AppFrame product=${attr(m.product)} nav={NAV} current={PARENT[screen] ?? screen} onNavigate={(id) => go(id)} store={store} user={{ name: "You" }} env="PROTOTYPE">`,
        `      {View ? <View key={screen} /> : null}`,
        `    </AppFrame>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    },
  ].filter((f, i, all) => !(f.path === "src/App.tsx" && all.findIndex((x) => x.path === "src/App.tsx") !== i));
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The page's title and description named for the app, not the starter. */
export function namedIndexHtml(html: string, m: AppModel): string {
  const purpose = m.nav.flatMap((g) => g.items).find((v) => v.kind === "dashboard" && v.purpose)?.purpose;
  let out = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(m.product)}</title>`);
  out = out.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeHtml(purpose ?? `${m.product}: a working prototype`)}$2`);
  return out;
}

/**
 * The runtime step: the working patterns (and what they're built from) into src/sections/, the library styles synced,
 * then the app's data, routes, screens and frame. Screens a design step has already built are kept.
 */
export async function appStep({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> {
  const model = deps.store.getSetting<AppModel | null>(appModelKey(run.id), null);
  if (!model) return { kind: "blocked", reason: "This build has no app model to write the app from", nextAction: "Re-plan the build" };
  const ctx = { jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved };
  const changed: string[] = [];
  const lib = path.join(sectionsDir(), "sections");
  const seen = new Set<string>();
  const pieces = piecesOf(model);
  for (const f of [{ rel: "src/sections/icons.tsx", content: fs.readFileSync(path.join(lib, "icons.tsx"), "utf8") }, ...pieces.flatMap((id) => pieceFiles(id, seen))]) {
    if (fs.existsSync(path.join(jail.root, f.rel))) continue;
    if (deps.ops.create_file(ctx, { path: f.rel, content: f.content }).ok) changed.push(f.rel);
  }
  for (const id of pieces) recordUse(deps.store, run.id, { id, by: "flowcode", step: task.title, reason: "Complete app: the frame and the working pages" });
  const css = syncedLibraryCss(jail.root);
  if (css !== undefined && deps.ops.replaceContent(ctx, "src/styles/library.css", css).ok) changed.push("src/styles/library.css");
  for (const f of appFiles(model)) {
    const exists = fs.existsSync(path.join(jail.root, f.path));
    if (exists && f.path.startsWith("src/screens/")) continue;
    const res = exists ? deps.ops.replace_file(ctx, { path: f.path, content: f.content, reason: "The complete app from its app model" }) : deps.ops.create_file(ctx, { path: f.path, content: f.content });
    if (!res.ok) return { kind: "blocked", reason: `Couldn't write ${f.path}: ${res.message}`, nextAction: "Retry this step" };
    changed.push(f.path);
  }
  const indexPath = path.join(jail.root, "index.html");
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, "utf8");
    const named = namedIndexHtml(html, model);
    if (named !== html && deps.ops.replaceContent(ctx, "index.html", named).ok) changed.push("index.html");
  }
  // The Home concept picked with the plan: its look through the tokens and surface style, its Home page from the
  // library (already written above from the model's layout), and the rest listed for the design steps.
  const spec = deps.store.getSetting<DesignSpec | null>(designSpecKey(run.id), null);
  if (spec) {
    const t0 = performance.now();
    try {
      // A look the person selected stays: the concept brings its Home layout only (designState.ts).
      const design = getDesignState(deps.store, run.projectId, jail);
      const applied = applyDesignSpec(jail, deps.ops, { projectId: run.projectId, runId: run.id }, spec, { frameCss: "src/styles/components.css", screens: builtViews(model).map((v) => screenFileOf(v)), model, layoutOnly: !!design.selected, allowedSurfaces: [...DEFAULT_SURFACES, ...design.surfaceExceptions] });
      const applyMs = Math.round(performance.now() - t0);
      const coderWork = applied.coderWork.map((w) => `${w.statement} (${w.files.join(", ")})`);
      deps.store.setSetting(conceptTimingsKey(run.id), { ...deps.store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {}), appliedAt: new Date().toISOString(), applyMs, coderWork });
      changed.push("src/styles/tokens.css");
      // The design steps keep the selected direction and still do their scoped work (applying a concept isn't the
      // design being done, nor its visual approval).
      for (const t of designTasks(deps, run.id)) {
        const note = `Selected concept applied (${spec.name}). Preserve its approved direction, complete remaining scoped work, and verify cross-screen consistency. Don't restyle what the concept set (src/styles/tokens.css, the surface style, the Home page's library page); do the design requirements of your step${coderWork.length ? `, including: ${coderWork.join("; ")}` : ""}.`;
        deps.store.setSetting(`taskFindings:${t.id}`, [...deps.store.getSetting<string[]>(`taskFindings:${t.id}`, []), note]);
      }
      deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Applied the chosen Home concept "${spec.name}" in ${applyMs} ms: ${applied.applied.join("; ")}${coderWork.length ? `; left for the design steps: ${coderWork.join("; ")}` : "; nothing left for the coder beyond the checks"}`, data: { designSpec: spec.id, applyMs, requirements: applied.requirements } });
    } catch (err) {
      return { kind: "blocked", reason: `The chosen Home concept couldn't be applied: ${(err as Error).message}`, nextAction: "Retry this step" };
    }
  }
  // No concept applied: the design steps hear what was settled (an explicit default, or no direction at all).
  const direction = deps.store.getSetting<DesignDirection | null>(designDirectionKey(run.id), null);
  if (!spec && direction) {
    const note =
      direction.kind === "default"
        ? "The generic default Home was chosen explicitly with the plan: keep its layout, and complete your step's design requirements across every screen."
        : `No Home direction was selected with the plan (${direction.why}). The design requirement is still open: your step carries it in full.`;
    for (const t of designTasks(deps, run.id)) deps.store.setSetting(`taskFindings:${t.id}`, [...deps.store.getSetting<string[]>(`taskFindings:${t.id}`, []), note]);
  }
  onChanged(changed);
  deps.store.setSetting(appWrittenKey(run.id), true);
  const built = builtViews(model);
  deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Wrote the app from its model: ${model.entities.length} kind${model.entities.length === 1 ? "" : "s"} of record with ${Object.values(model.seed).reduce((n, s) => n + s.length, 0)} sample records, the frame with ${model.nav.flatMap((g) => g.items).length} destinations, and ${built.length} working pages (${built.map((v) => `${v.label} [${v.kind}]`).join(", ")})` });
  return { kind: "complete", summary: `The app's data, store, frame and ${built.length} pages`, changedPaths: changed };
}

const designTasks = (deps: RuntimeStepArgs["deps"], runId: string) => deps.store.tasks.where("run_id = ?", runId).filter((x) => x.title.startsWith(DESIGN_SCREENS) || x.title.startsWith(DESIGN_POLISH));

/** Set once the app is written: from then on every step is held to the app guard. */
export const appWrittenKey = (runId: string) => `appWritten:${runId}`;

const PATTERN: Partial<Record<ModelView["kind"], string>> = { list: "ResourceIndex", queue: "ResourceIndex", create: "RecordWizard", detail: "RecordDetail", dashboard: "AppDashboard", catalog: "LookupCatalog", categories: "CategoryIndex", saved: "LookupCatalog", entry: "LookupEntry", places: "PlaceFinder", lists: "ListIndex", mylist: "ListBuilder" };

/**
 * The app guard: what makes the app work is still there after a step. The frame in App.tsx, the one store, each working
 * page on its pattern and on that store, and no page with its own copy of the data. A design or feature step may
 * restyle, reword and add around them; it may not rebuild them (a feature step rewrote Build test 7's Home down to its
 * list). Each problem names the file and, for a page, the source FlowCode wrote, so the step can put it back.
 */
export function appKept(root: string, m: AppModel): string[] {
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      return undefined;
    }
  };
  const problems: string[] = [];
  const app = read("src/App.tsx");
  const frame = m.lookup ? { tag: "LookupFrame", classes: "fl-lkf-*" } : { tag: "AppFrame", classes: "fl-af-*" };
  if (!app?.includes(`<${frame.tag}`)) problems.push(`src/App.tsx no longer draws the app frame (<${frame.tag}> from ./sections/${frame.tag}) with the whole navigation: put it back; restyle it through its ${frame.classes} classes in src/styles/components.css instead.`);
  if (m.lookup && !read("src/app/lookup.ts")?.includes("createLookup(")) problems.push("src/app/lookup.ts, the look-up layer (places, availability, likes, saves, ratings and lists), is missing or no longer creates it: put it back as FlowCode wrote it.");
  const store = read("src/app/store.ts");
  if (!store?.includes("createStore(")) problems.push("src/app/store.ts, the one store every page reads and writes, is missing or no longer creates the store: put it back as FlowCode wrote it.");
  const pieceFilesOf = m.lookup ? ["LookupFrame", "LookupCatalog", "LookupEntry", "PlaceFinder", "ListBuilder", "LookupData", "AppData"] : ["AppFrame", "ResourceIndex", "RecordWizard", "RecordDetail", "AppDashboard", "AppData"];
  for (const piece of pieceFilesOf) {
    if (read(`src/sections/${piece}.tsx`) === undefined) problems.push(`src/sections/${piece}.tsx, a working pattern the app is built on, was deleted: add it back with add_library_piece.`);
  }
  for (const v of builtViews(m)) {
    const file = screenFileOf(v);
    const src = read(file);
    const pattern = PATTERN[v.kind];
    if (src === undefined) {
      problems.push(`${file} (${v.label}) was deleted. Write it back:\n${screenSource(m, v)}`);
      continue;
    }
    const onData = m.lookup ? /lookup=\{lookup\}/ : /store=\{store\}/;
    if (pattern && !(src.includes(`<${pattern}`) && onData.test(src))) problems.push(`${file} (${v.label}) no longer uses the working ${pattern} on the app's store; it was rebuilt. Put the pattern back (you may keep content you added around it, and change its title and description props):\n${screenSource(m, v)}`);
    if (src.includes("createStore(") || src.includes("createLookup(")) problems.push(`${file} (${v.label}) makes its own store: every page uses the one in src/app/store.ts (import { store } from "../app/store"), so a change on one page shows on all of them.`);
  }
  return problems;
}

/** The step that writes the app from its model, in place of the layout step. */
export const WRITE_APP = "Write the complete app";
export const APP_STEPS: Record<string, (a: RuntimeStepArgs) => Promise<AgentOutcome>> = { [WRITE_APP]: appStep };

/** The app's pages as the screen plan every later step, check and review uses (placeholders aren't pages). */
export function screenPlanOf(m: AppModel): ScreenPlan {
  return {
    product: m.product,
    screens: builtViews(m).map((v) => ({ id: v.id, label: v.label, component: `${pascal(v.id)}Screen`, file: screenFileOf(v), purpose: v.purpose ?? `${v.label}: the ${LOOKUP_PURPOSE[v.kind] ?? (v.kind === "create" ? "step-by-step form for a new record" : v.kind === "detail" ? "one record, its status and history" : v.kind === "queue" ? "records waiting on a decision" : v.kind === "dashboard" ? "how things stand" : "every record, to find and act on")}` })),
  };
}

const LOOKUP_PURPOSE: Partial<Record<ModelView["kind"], string>> = {
  landing: "first page: what it is, search, the ZIP code, categories and the most liked",
  catalog: "entries to search, filter by category and find near you",
  categories: "categories to browse",
  entry: "one entry: why it qualifies, where to find it nearby, likes, saves, sharing, ratings and comments",
  places: "places near a ZIP code, to choose one",
  lists: "the person's lists, each for one place",
  mylist: "one list: its place, what that place carries, quantities and what is done",
  saved: "what the person saved",
};

/** The pages the design steps build themselves (the rest are the library's working patterns). */
export function customPlanOf(m: AppModel): ScreenPlan {
  const custom = new Set(builtViews(m).filter((v) => v.kind === "custom" || v.kind === "landing").map((v) => v.id));
  const all = screenPlanOf(m);
  return { ...all, screens: all.screens.filter((s) => custom.has(s.id)) };
}

function completeDesignObjective(m: AppModel): string {
  const built = builtViews(m);
  const designed = (v: ModelView) => v.kind === "custom" || v.kind === "landing";
  const patterns = built.filter((v) => !designed(v));
  const custom = built.filter(designed);
  const working = m.lookup
    ? "Search and suggestions, categories and filters, where each entry is found near the person's ZIP code, likes, saves, sharing, ratings and comments, and lists tied to a place already work across pages."
    : "Lists, the create wizard, record pages, status changes by role, notifications and the dashboard already work across pages.";
  const data = m.lookup
    ? "on the same data (lookup from src/app/lookup with useLookup from src/sections/LookupData for ZIP code, places, likes, saves, ratings and lists: const state = useLookup(lookup) gives the state (zip, placeId, signedIn, liked, saved, ratings, lists) and the actions are the lookup's own methods (lookup.setZip(zip), lookup.choosePlace(id), lookup.toggleSave(id), lookup.addToList(listId, entryId)), never destructured from useLookup; the parts take just lookup, e.g. <ZipPrompt lookup={lookup} />; store from src/app/store and useRecords from src/sections/AppData for the entries; the look-up pieces as parts, imported exactly so: import { CatalogSearch, CategoryIndex, LookupCatalog } from '../sections/LookupCatalog'; import { ZipPrompt, PlaceBadge, PlaceFinder } from '../sections/PlaceFinder'; import { LookupEntry, RatingsPanel, WhereToFind } from '../sections/LookupEntry'; import { ListIndex, ListBuilder } from '../sections/ListBuilder' (no other files hold them); go() from src/app/routes to open an entry)"
    : "on the same records (store from src/app/store, useRecords, useActivity, StatusChip and formatValue from src/sections/AppData, go() from src/app/routes to open a record)";
  return [
    `Design the complete app like a senior product designer: it is already written and working (step "${WRITE_APP}"): the app frame, one shared store in src/app/, and working pages on the library's patterns: ${patterns.map((v) => `${v.label} [${v.kind}] in ${screenFileOf(v)}`).join(", ")}. ${working} Start your reply with the concept in 5 lines (idea, composition, type, colour, signature moment) and build to it.`,
    "- Keep those pages and the frame: never rebuild, replace or wrap them in new markup, and never give a page its own copy of the data. Give them this product's look through the Styles page (src/styles/tokens.css) and the pieces' fl-* classes in src/styles/components.css, and their words through their props (title, description and the like).",
    custom.length
      ? `- Compose each of these pages as a finished page in its screen file, ${data}: ${custom.map((v) => `${v.label} (${screenFileOf(v)})${v.kind === "landing" ? " [the landing page: FlowCode wrote a working start with the search, the ZIP code, the categories and the most liked; make it the product's own front page, with the PRD's promise and sections, keeping those working parts]" : ""}${v.purpose ? `: ${v.purpose}` : ""}`).join("; ")}.`
      : "- There are no custom pages: every page is a working pattern.",
    "Run the app and look at each page at desktop and phone width before you finish.",
    appModelNote(m),
  ].join("\n");
}

/**
 * A spec build's steps as a complete app: the layout step becomes the step that writes the app from its model, the
 * ready-made screen layouts aren't needed (the pages are the patterns), and the design step refines the working app
 * and builds the custom pages instead of designing screens from nothing.
 */
export function completeAppTasks(tasks: PlanTask[], m: AppModel): PlanTask[] {
  const drop = tasks.find((t) => t.title === ADD_LAYOUTS);
  return tasks
    .filter((t) => t !== drop)
    .map((t0) => {
      const t = drop ? { ...t0, dependsOn: [...new Set(t0.dependsOn.flatMap((d) => (d === drop.key ? drop.dependsOn : [d])))] } : t0;
      if (t.title === APP_LAYOUT)
        return {
          ...t,
          title: WRITE_APP,
          objective: `FlowCode writes the whole app from its app model: the data and sample records, the one store, the frame with the full navigation, and a working page per destination.\n${appModelNote(m)}`,
          expectedPaths: ["src/App.tsx", "src/app/", "src/screens/", "src/sections/", "index.html"],
          acceptanceCriteria: [
            { id: "l1", description: "The app uses the app frame", check: { type: "file_contains" as const, path: "src/App.tsx", text: m.lookup ? "<LookupFrame" : "<AppFrame" } },
            ...(m.lookup ? [{ id: "l4", description: "The look-up layer is in place", check: { type: "file_exists" as const, path: "src/app/lookup.ts" } }] : []),
            { id: "l2", description: "The pages share one store", check: { type: "file_exists" as const, path: "src/app/store.ts" } },
            { id: "l3", description: "Typecheck passes", check: { type: "verification" as const, kind: "typecheck" } },
          ],
          verification: ["typecheck"],
        };
      if (t.title === DESIGN_SCREENS) return { ...t, objective: completeDesignObjective(m), expectedPaths: ["src/screens/", "src/styles/"] };
      return t;
    });
}
