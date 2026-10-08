/**
 * Verified starter templates and their golden-path plans (Phase 5). The template itself is verified
 * (typecheck/lint/test/build from a clean copy) by the benchmark; agents build the feature on top.
 * Deterministic steps (scaffold, approved install) are executed by the runtime, not by a model.
 */
import { syncLocalFonts } from "../workspace/localFonts.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { designTemplate, type ImplementationPlan, type PlanTask, type ReferenceFile, type Run, type Task, type VerificationKind } from "@flowcode/contracts";
import { referencePath } from "../quality/spec.js";
import type { AgentOutcome } from "./agentLoop.js";
import type { OrchestratorDeps } from "./orchestrator.js";
import { personalizeStarterFile, starterIdentity, withTemplate, withVibe, type BuildLook } from "./starterIdentity.js";
import type { PathJail } from "../security/pathJail.js";
import { layoutGuidance, layoutsTask, pickLayouts } from "./layoutRecipes.js";
import { brandTrio, designDirection } from "../knowledge/designDirection.js";
import { applyCapturedStyle, captureStyle } from "../workspace/styleCapture.js";
import { BrowserSession } from "../quality/preview.js";

export interface RuntimeStepArgs {
  deps: OrchestratorDeps;
  run: Run;
  task: Task;
  jail: PathJail;
  signal: AbortSignal;
  onChanged: (paths: string[]) => void;
}

export interface TemplateDef {
  id: string;
  title: string;
  dir: string;
  requiredChecks: VerificationKind[];
  runtimeSteps: Record<string, (a: RuntimeStepArgs) => Promise<AgentOutcome>>;
  /** What a build planned on top of this starter needs to know about it. */
  starter: {
    framework: "React" | "Angular";
    /** One paragraph for the planner: what's already there, so it doesn't plan it again. */
    stack: string;
    /** A file that exists once dependencies are installed. */
    installedMarker: string;
    /** Where pages and components get wired together at the end. */
    entry: string;
    /** The app_wiring reachability check understands this starter (React only). */
    wiringCheck: boolean;
  };
}

export function templatesRoot(): string {
  if (process.env.FLOWCODE_TEMPLATES_DIR) return path.resolve(process.env.FLOWCODE_TEMPLATES_DIR);
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const c of [path.resolve(here, "../../../../templates"), path.resolve(here, "../../../templates"), path.resolve(process.cwd(), "templates")]) if (fs.existsSync(c)) return c;
  return path.resolve(here, "../../../../templates");
}

const IGNORE = new Set(["node_modules", "dist", ".vite", "coverage", "test-results"]);

function listTemplateFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, base), { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listTemplateFiles(dir, rel));
    else out.push(rel);
  }
  return out;
}

const SCAFFOLD = "Scaffold from verified starter template";
const INSTALL = "Install dependencies (approved)";

/** Copies a verified starter into the empty workspace through governed, snapshotted writes. */
function scaffoldStep(templateId: string): (a: RuntimeStepArgs) => Promise<AgentOutcome> {
  return async ({ deps, run, task, jail, onChanged }) => {
    const dir = TEMPLATES[templateId].dir;
    if (!fs.existsSync(dir)) return { kind: "blocked", reason: `Starter template not found at templates/${path.basename(dir)}`, nextAction: "Reinstall FlowCode templates" };
    const files = listTemplateFiles(dir);
    const created: string[] = [];
    // The starter becomes this product: name, description, design brief and (when the PRD lists them) colours.
    const look = deps.store.getSetting<BuildLook | undefined>(`runLook:${run.id}`, undefined);
    const refs = deps.store.getSetting<ReferenceFile[]>(`runRefs:${run.id}`, []);
    const prdText = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n");
    const identity = withVibe(withTemplate(starterIdentity(refs, deps.store.projects.require(run.projectId).name, run.objective), designTemplate(look?.template)), look, `${run.objective}\n${prdText}`);
    for (const rel of files) {
      if (fs.existsSync(path.join(jail.root, rel))) continue;
      const content = personalizeStarterFile(rel, fs.readFileSync(path.join(dir, rel), "utf8"), identity);
      // The approved plan explicitly includes scaffolding this verified template (protected configs included).
      const res = deps.ops.create_file({ jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved }, { path: rel, content });
      if (!res.ok) return { kind: "blocked", reason: `Scaffold failed on ${rel}: ${res.message}`, nextAction: "Use an empty workspace for template builds" };
      created.push(rel);
    }
    // The fonts the tokens name, copied in and declared locally (no internet needed to show them).
    created.push(...syncLocalFonts(jail.root));
    onChanged(created);
    deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Runtime scaffolded ${created.length} files from the verified starter template` });
    deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Made the starter into ${identity.name}${identity.vibe && identity.vibe.id !== "flat" ? ` (${identity.vibe.name} surfaces)` : ""}: title, description and design brief${identity.colors.length ? `, plus ${identity.colors.length} colours from the PRD (${Object.keys(identity.roles).length} mapped onto the theme)` : identity.template ? `, in the ${identity.template.name} style` : ""}` });
    deps.projects.preflight(run.projectId, run.id);
    return { kind: "complete", summary: `Scaffolded ${created.length} files`, changedPaths: created };
  };
}

/** Installs the starter's declared dependencies (npm install asks for approval). */
async function installStep({ deps, run, task, jail, signal }: RuntimeStepArgs): Promise<AgentOutcome> {
  const project = deps.store.projects.require(run.projectId);
  const pf = deps.projects.preflight(run.projectId, run.id);
  if (!pf.manifestValid) {
    deps.verifier.record(run.id, "install", "blocked", "Manifest invalid", []);
    return { kind: "blocked", reason: `package.json invalid: ${pf.manifestErrors.join("; ")}`, nextAction: "Repair package.json" };
  }
  deps.verifier.record(run.id, "manifest_validation", "passed", "package.json parsed and validated", [`preflight:${pf.id}`]);
  const res = await deps.runner.run({
    jail,
    projectId: project.id,
    runId: run.id,
    taskId: task.id,
    phase: "dependencies",
    argv: ["npm", "install", "--no-fund", "--no-audit"],
    reason: "Install the starter template's declared dependencies (and any added by the plan)",
    preflight: pf,
    timeoutMs: 900_000,
    outputCapBytes: project.settings.outputCapBytes,
    signal,
  });
  const status = res.record.status;
  deps.verifier.record(run.id, "install", status === "succeeded" ? "passed" : status === "blocked" ? "blocked" : "failed", `npm install ${status}${res.record.approvalId ? " (approved)" : ""}`, [`command:${res.record.id}`, ...(res.record.approvalId ? [`approval:${res.record.approvalId}`] : [])]);
  deps.projects.preflight(run.projectId, run.id);
  if (status === "succeeded") return { kind: "complete", summary: "Dependencies installed", changedPaths: ["package-lock.json"] };
  if (status === "cancelled") return { kind: "cancelled" };
  return { kind: "blocked", reason: `Dependency install ${status}: ${(res.record.outputPreview ?? "").slice(-300)}`, nextAction: status === "blocked" ? "Approve the install to continue" : "Check network/npm and retry" };
}

export const TEMPLATES: Record<string, TemplateDef> = {
  "react-vite-scheduler": {
    id: "react-vite-scheduler",
    title: "React + Vite + TypeScript local-first starter",
    get dir() {
      return path.join(templatesRoot(), "react-vite-starter");
    },
    requiredChecks: ["project_preflight", "manifest_validation", "install", "typecheck", "lint", "tests", "build", "server_start", "preview_health", "screenshots", "accessibility", "design_qa", "final_report"],
    starter: {
      framework: "React",
      stack: "a React 19 + Vite + TypeScript starter (src/App.tsx, src/main.tsx, src/styles/tokens.css design tokens, ready-made building blocks in src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog; styled by src/styles/components.css), src/lib/screens.ts useScreen() and useRoute()/linkTo() for screens, records and searches in the URL (#/orders/42?q=late), src/sim for simulated data kept in local storage (createCollection seeded collections, useCollection, useSavedState for single values, simulate() delays, searchItems(), resetDemoData()), motion from src/styles/components.css (screens animate in by themselves; className ui-stagger on a list, ui-pop on a value that just changed; --duration-* and --ease-* tokens), vitest with a browser page (jsdom, @testing-library/react and user-event) for src/**/*.test.ts and *.test.tsx)",
      installedMarker: "node_modules/react/package.json",
      entry: "src/App.tsx",
      wiringCheck: true,
    },
    runtimeSteps: { [SCAFFOLD]: scaffoldStep("react-vite-scheduler"), [INSTALL]: installStep },
  },
  "angular-starter": {
    id: "angular-starter",
    title: "Angular + TypeScript local-first starter",
    get dir() {
      return path.join(templatesRoot(), "angular-starter");
    },
    // No lint: the Angular starter has no linter set up (ng lint needs angular-eslint).
    requiredChecks: ["project_preflight", "manifest_validation", "install", "typecheck", "tests", "build", "server_start", "preview_health", "screenshots", "accessibility", "design_qa", "final_report"],
    starter: {
      framework: "Angular",
      stack: "an Angular 21 + TypeScript starter with standalone components and signals (src/app/app.ts, app.html and app.css are the root component; src/app/app.config.ts; src/styles/tokens.css design tokens and src/styles/app.css shared classes .shell, .button, .field, .panel; Vitest unit tests in src/**/*.spec.ts run by ng test). New components go in src/app/<name>/<name>.ts with their .html and .css next to them, imported in the parent component's imports array",
      installedMarker: "node_modules/@angular/core/package.json",
      entry: "src/app/app.ts and src/app/app.html",
      wiringCheck: false,
    },
    runtimeSteps: { [SCAFFOLD]: scaffoldStep("angular-starter"), [INSTALL]: installStep },
  },
};

/** Golden-path plan for the MVP proof build (§19): scaffold → dependencies → domain → features → views → polish. */
export function templatePlan(templateId: string, objective: string): ImplementationPlan {
  if (templateId !== "react-vite-scheduler") throw new Error(`Unknown template ${templateId}`);
  const tc = { type: "verification" as const, kind: "typecheck" };
  return {
    goal: objective,
    assumptions: [
      "Workspace starts empty; the verified React + Vite + TypeScript starter is scaffolded by the runtime",
      "Persistence uses browser localStorage (local-first, no server)",
      "npm install requires explicit approval",
    ],
    relevantFiles: ["package.json", "src/App.tsx", "src/styles/tokens.css", "src/styles/app.css"],
    expectedChanges: ["src/scheduler/types.ts", "src/scheduler/storage.ts", "src/scheduler/storage.test.ts", "src/scheduler/useSchedule.ts", "src/components/*", "src/App.tsx", "src/styles/app.css"],
    risk: "medium",
    riskNotes: ["Dependency installation (npm install) runs package lifecycle scripts and uses the network"],
    validationPlan: TEMPLATES[templateId].requiredChecks,
    rollbackStrategy: "Every file change is snapshotted; restore the 'Plan approved' checkpoint to return to an empty workspace.",
    tasks: [
      { key: "scaffold", title: SCAFFOLD, objective: "Copy the verified starter template into the workspace.", dependsOn: [], expectedPaths: ["."], acceptanceCriteria: [{ id: "a1", description: "package.json exists", check: { type: "file_exists", path: "package.json" } }, { id: "a2", description: "Design tokens exist", check: { type: "file_exists", path: "src/styles/tokens.css" } }], verification: [], role: "coder" },
      { key: "deps", title: INSTALL, objective: "Install declared dependencies after user approval.", dependsOn: ["scaffold"], expectedPaths: ["package-lock.json"], acceptanceCriteria: [{ id: "b1", description: "node_modules installed", check: { type: "file_exists", path: "node_modules/react/package.json" } }, { id: "b2", description: "Starter typechecks", check: tc }], verification: ["install"], role: "coder" },
      {
        key: "domain",
        title: "Domain model and local persistence",
        objective: [
          "Create src/scheduler/types.ts exporting `export interface ScheduleEvent { id: string; title: string; date: string; time: string; notes: string; createdAt: string; updatedAt: string }` (date is YYYY-MM-DD, time is HH:MM).",
          "Create src/scheduler/storage.ts exporting: `export const STORAGE_KEY = \"flowcode.scheduler.v1\"`; `export function loadEvents(storage: Pick<Storage, \"getItem\">): ScheduleEvent[]` (returns [] for missing or corrupt JSON, never throws); `export function saveEvents(storage: Pick<Storage, \"setItem\">, events: ScheduleEvent[]): void`; `export function sortEvents(events: ScheduleEvent[]): ScheduleEvent[]` (by date then time ascending, returns a new array).",
          "Create src/scheduler/storage.test.ts with vitest tests (import { describe, it, expect } from \"vitest\") using a simple in-memory object implementing getItem/setItem: save→load round trip, corrupt JSON returns [], sortEvents ordering.",
        ].join("\n"),
        dependsOn: ["deps"],
        expectedPaths: ["src/scheduler/"],
        acceptanceCriteria: [
          { id: "c1", description: "types.ts defines ScheduleEvent", check: { type: "file_contains", path: "src/scheduler/types.ts", text: "ScheduleEvent" } },
          { id: "c2", description: "storage.ts exports loadEvents", check: { type: "file_contains", path: "src/scheduler/storage.ts", text: "loadEvents" } },
          { id: "c3", description: "storage tests exist", check: { type: "file_exists", path: "src/scheduler/storage.test.ts" } },
          { id: "c4", description: "Typecheck passes", check: tc },
          { id: "c5", description: "Unit tests pass", check: { type: "verification", kind: "tests" } },
        ],
        verification: ["typecheck", "tests"],
        role: "coder",
      },
      {
        key: "features",
        title: "Schedule state hook (create, edit, delete, list)",
        objective: [
          "Create src/scheduler/useSchedule.ts exporting `export function useSchedule()` (React hook) that returns { events, status, error, addEvent, updateEvent, deleteEvent }.",
          "status is \"loading\" | \"ready\" | \"error\". On mount, load from window.localStorage via loadEvents inside a try/catch (set status \"error\" and an error message if storage is unavailable), then set \"ready\".",
          "addEvent(input: { title; date; time; notes }) creates an id with crypto.randomUUID() and timestamps; updateEvent(id, input) updates fields and updatedAt; deleteEvent(id) removes it.",
          "Persist with saveEvents(window.localStorage, events) whenever events change after loading. Keep events sorted with sortEvents.",
        ].join("\n"),
        dependsOn: ["domain"],
        expectedPaths: ["src/scheduler/"],
        acceptanceCriteria: [
          { id: "d1", description: "useSchedule hook exists", check: { type: "file_contains", path: "src/scheduler/useSchedule.ts", text: "useSchedule" } },
          { id: "d2", description: "Hook persists to storage", check: { type: "file_contains", path: "src/scheduler/useSchedule.ts", text: "saveEvents" } },
          { id: "d3", description: "Typecheck passes", check: tc },
        ],
        verification: ["typecheck"],
        role: "coder",
      },
      {
        key: "views",
        title: "Scheduler views (form and list)",
        objective: [
          "Create src/components/EventForm.tsx: a <form> with labelled inputs — <label htmlFor> \"Title\" (text, required), \"Date\" (type=date, required), \"Time\" (type=time, required), \"Notes\" (textarea) — and a submit button whose text is \"Add event\" when creating or \"Save\" when editing, plus a \"Cancel\" button when editing. Props: { initial?: { title; date; time; notes }; onSubmit(values): void; onCancel?(): void }.",
          "Create src/components/EventList.tsx: renders events in a <ul aria-label=\"Scheduled events\">, each <li> shows title (as <h3>), date and time (<time>), notes, and two buttons with accessible names \"Edit <title>\" and \"Delete <title>\" (use aria-label). Props: { events; onEdit(id); onDelete(id) }.",
          "Use only CSS classes from src/styles/app.css (add classes there using var(--…) design tokens; no inline style attributes, no raw hex colors).",
        ].join("\n"),
        dependsOn: ["features"],
        expectedPaths: ["src/components/", "src/styles/app.css"],
        acceptanceCriteria: [
          { id: "e1", description: "EventForm exists", check: { type: "file_contains", path: "src/components/EventForm.tsx", text: "Add event" } },
          { id: "e2", description: "EventList exists", check: { type: "file_contains", path: "src/components/EventList.tsx", text: "Scheduled events" } },
          { id: "e3", description: "Typecheck passes", check: tc },
        ],
        verification: ["typecheck"],
        role: "coder",
      },
      {
        key: "app",
        title: "Wire the app with empty, loading and error states",
        objective: [
          "Update src/App.tsx (read it first, then apply_patch) to use useSchedule, EventForm and EventList inside the existing <main> layout.",
          "Show: a loading state (role=\"status\", text \"Loading your schedule…\") while status is \"loading\"; an error state (role=\"alert\") with the error message when status is \"error\"; an empty state when there are no events with the heading \"No events yet\" and a short helpful sentence; otherwise the list.",
          "Editing: clicking Edit loads the event into the form (form submit button becomes \"Save\"); saving calls updateEvent; Delete calls deleteEvent.",
          "Keep the page title heading \"Schedule\" as the only <h1>. Responsive layout: form and list side by side at ≥ 900px, stacked below, via app.css classes using design tokens.",
        ].join("\n"),
        dependsOn: ["views"],
        expectedPaths: ["src/App.tsx", "src/styles/app.css", "src/components/"],
        acceptanceCriteria: [
          { id: "f1", description: "App uses useSchedule", check: { type: "file_contains", path: "src/App.tsx", text: "useSchedule" } },
          { id: "f2", description: "Empty state present", check: { type: "file_contains", path: "src/App.tsx", text: "No events yet" } },
          { id: "f3", description: "Typecheck passes", check: tc },
          { id: "f4", description: "Lint passes", check: { type: "verification", kind: "lint" } },
          { id: "f5", description: "Build passes", check: { type: "verification", kind: "build" } },
        ],
        verification: ["typecheck", "lint", "build"],
        role: "coder",
      },
    ],
  };
}

// ─────────────────────────── Build from a spec (PRD + HTML/CSS/JSON) ───────────────────────────

export const IMPORT_REFS = "Import spec references";

/** Runtime step: copies the user's reference files into the workspace through governed, snapshotted writes. */
export async function importReferences({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> {
  const refs = deps.store.getSetting<ReferenceFile[]>(`runRefs:${run.id}`, []);
  const created: string[] = [];
  // Images are only for style capture (the next step); agents read text.
  for (const ref of refs.filter((r) => r.role !== "image")) {
    const rel = referencePath(ref);
    if (fs.existsSync(path.join(jail.root, rel))) {
      created.push(rel);
      continue;
    }
    const res = deps.ops.create_file({ jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved }, { path: rel, content: ref.content });
    if (!res.ok) return { kind: "blocked", reason: `Could not import ${ref.name}: ${res.message}`, nextAction: "Check the reference file name and content" };
    created.push(rel);
  }
  onChanged(created);
  deps.store.runs.upsert({ ...deps.store.runs.require(run.id), referencePaths: created });
  return { kind: "complete", summary: `Imported ${created.length} reference file(s)`, changedPaths: created };
}

for (const t of Object.values(TEMPLATES)) t.runtimeSteps[IMPORT_REFS] = importReferences;

export const CAPTURE_STYLE = "Capture the style";

/** Whether a build has something to capture a style from: a website, or attached images, CSS or HTML. */
export const hasStyleSources = (refs: ReferenceFile[], look?: BuildLook) => !!look?.styleUrl || refs.some((r) => r.role === "image" || r.role === "css" || r.role === "html");

/**
 * Runtime step (CSSVibes style capture): the website and the attached images, CSS and HTML become the app's colours,
 * fonts, corners and surface, written through the Styles page's own functions. The review step that follows is where
 * the person configures it; the build uses what they approve.
 */
export async function captureStyleStep({ deps, run, task, jail, signal, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> {
  const refs = deps.store.getSetting<ReferenceFile[]>(`runRefs:${run.id}`, []);
  const look = deps.store.getSetting<BuildLook | undefined>(`runLook:${run.id}`, undefined);
  const files = refs.filter((r): r is ReferenceFile & { role: "image" | "html" | "css" } => r.role === "image" || r.role === "html" || r.role === "css");
  const vision = run.modelAssignments.critic ?? run.modelAssignments.planner;
  const { style, notes } = await captureStyle({ router: deps.router, launchBrowser: () => BrowserSession.launch(run.id, deps.processes) }, { url: look?.styleUrl, files, vision }, { projectId: run.projectId, runId: run.id, signal });
  if (signal.aborted) return { kind: "cancelled" };
  // The product's design direction, from the PRD and the request: applied when nothing was captured, advice otherwise.
  const prdText = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n").slice(0, 60_000);
  const direction = designDirection(`${run.objective}\n${prdText}`);
  deps.store.setSetting(`designDirection:${run.projectId}`, direction);
  const captured = style.brand.length > 0 || !!style.fonts.display || !!style.fonts.body;
  if (!captured) {
    style.fonts = { display: direction.fonts.heading, body: direction.fonts.body };
    style.sources = [`the ${direction.industry.toLowerCase()} design direction`];
  }
  // Colours captured but no fonts (an image without readable type): the direction's pairing fills in.
  else if (!style.fonts.display && !style.fonts.body) style.fonts = { display: direction.fonts.heading, body: direction.fonts.body };
  // Up to three brand colours: the captured ones, then companions of the main one, or the direction's palette.
  style.brand = brandTrio(style.brand, direction);
  let applied: string[] = [];
  try {
    applied = applyCapturedStyle(jail, deps.ops, { projectId: run.projectId, runId: run.id }, style);
  } catch (err) {
    notes.push(`Couldn't apply the style: ${(err as Error).message}`);
  }
  deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: `Design direction: ${direction.industry} — ${direction.style}; ${direction.colorMood}; ${direction.fonts.heading}${direction.fonts.body !== direction.fonts.heading ? ` + ${direction.fonts.body}` : ""}. Avoid: ${direction.avoid}.` });
  deps.store.setSetting(`styleCapture:${run.projectId}`, { at: new Date().toISOString(), sources: style.sources, applied, notes, style });
  if (applied.length) onChanged(["src/styles/tokens.css"]);
  const from = style.sources.join(", ") || "nothing readable";
  deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: applied.length ? `Captured the style from ${from}: ${applied.join("; ")}. Adjust it on the Styles page before approving.` : `No style captured from ${from}; the look comes from the PRD and the Styles page.` });
  for (const n of notes) deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, level: "warning", message: n });
  return { kind: "complete", summary: applied.length ? `Captured: ${applied.join("; ")}` : "Nothing to apply", changedPaths: applied.length ? ["src/styles/tokens.css"] : [] };
}

for (const t of Object.values(TEMPLATES)) t.runtimeSteps[CAPTURE_STYLE] = captureStyleStep;

export const REVIEW = "Review the prototype plan and the design";

/**
 * Runtime step: the build waits here for the person to approve the plan. The prototype plan is the plan (each screen
 * or feature step with the PRD requirements it covers and its acceptance tests) and the look comes from the Styles
 * page, which works now that the starter is in place. Never auto-approved, whatever the autonomy setting.
 */
export async function reviewPlan({ deps, run, task, signal }: RuntimeStepArgs): Promise<AgentOutcome> {
  // What "Capture the style" put on the Styles page, so the person knows where the look came from.
  const captured = deps.store.getSetting<{ sources: string[]; applied: string[] } | null>(`styleCapture:${run.projectId}`, null);
  const look = captured?.applied.length ? ` The look was captured from ${captured.sources.join(", ")} (${captured.applied.join("; ")}); change any of it there first.` : "";
  const approval = deps.approvals.request({
    projectId: run.projectId,
    runId: run.id,
    taskId: task.id,
    kind: "plan",
    action: "Approve the prototype plan and the design to start building",
    reason:
      "Open the Prototype plan to review each screen and feature step, the PRD requirements it covers and its acceptance tests. Set the look on the Styles page (Design, Tokens, Surface); the build uses it as it is when you approve." + look,
    affected: ["Prototype plan", "src/styles/tokens.css"],
    risk: "medium",
    consequencesOfDenial: "Nothing is built; the build stops so you can change the PRD and start again.",
  });
  const decided = approval.status === "pending" ? await deps.approvals.wait(approval.id, signal) : approval;
  if (signal.aborted) return { kind: "cancelled" };
  if (decided.status !== "approved") return { kind: "blocked", reason: "The prototype plan and design weren't approved", nextAction: "Change the PRD, then start the build again" };
  return { kind: "complete", summary: "Prototype plan and design approved", changedPaths: [] };
}

for (const t of Object.values(TEMPLATES)) t.runtimeSteps[REVIEW] = reviewPlan;

/** The starter a spec build scaffolds: the one chosen, or React when none (or an unknown one) was chosen. */
export const starterOf = (templateId?: string): TemplateDef => TEMPLATES[templateId ?? ""] ?? TEMPLATES["react-vite-scheduler"];

/** Runtime tasks that start every spec build; model-planned feature tasks are appended after them. */
export function specRuntimeTasks(refs: ReferenceFile[], templateId?: string, look?: BuildLook): PlanTask[] {
  const t = starterOf(templateId);
  // React builds whose spec asks for a home, dashboard or settings screen start those screens from ready-made layouts.
  const specText = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n");
  const layouts = t.starter.framework === "React" ? layoutsTask(undefined, specText, ["review"]) : undefined;
  const ready = layouts ? ` ${layoutGuidance(pickLayouts(specText))}` : "";
  const tasks: PlanTask[] = [
    {
      key: "scaffold",
      title: SCAFFOLD,
      objective: `Copy the verified ${t.starter.framework} starter template into the workspace.`,
      dependsOn: [],
      expectedPaths: ["."],
      acceptanceCriteria: [{ id: "s1", description: "package.json exists", check: { type: "file_exists", path: "package.json" } }],
      verification: [],
      role: "coder",
    },
    {
      key: "deps",
      title: INSTALL,
      objective: "Install declared dependencies after user approval.",
      dependsOn: ["scaffold"],
      expectedPaths: ["package-lock.json"],
      acceptanceCriteria: [{ id: "d1", description: "node_modules installed", check: { type: "file_exists", path: t.starter.installedMarker } }, { id: "d2", description: "Starter typechecks", check: { type: "verification", kind: "typecheck" } }],
      verification: ["install"],
      role: "coder",
    },
    {
      key: "refs",
      title: IMPORT_REFS,
      objective: "Place the supplied PRD, HTML, CSS and JSON files in the workspace for the agents to read.",
      dependsOn: ["deps"],
      expectedPaths: ["spec/", "src/content/"],
      acceptanceCriteria: refs.some((r) => r.role !== "image")
        ? refs.filter((r) => r.role !== "image").map((r, i) => ({ id: `r${i + 1}`, description: `${r.name} imported`, check: { type: "file_exists" as const, path: referencePath(r) } }))
        : [{ id: "r0", description: "No references supplied", check: { type: "file_exists" as const, path: "package.json" } }],
      verification: [],
      role: "coder",
    },
    // Every spec build sets its look here: from the website and attachments when there are any, otherwise from the
    // product's design direction (its industry's palette and font pairing), so no build starts from the default blue.
    {
      key: "style",
      title: CAPTURE_STYLE,
      objective: hasStyleSources(refs, look)
        ? "Capture the colours, fonts, corners and surface style from the website and the attached images, CSS and HTML, onto the Styles page."
        : "Set the look from the product's design direction (its industry's colour palette and Google font pairing) on the Styles page.",
      dependsOn: ["refs"],
      expectedPaths: ["src/styles/tokens.css", "src/styles/components.css"],
      acceptanceCriteria: [{ id: "c1", description: "The design tokens are in place", check: { type: "file_exists" as const, path: "src/styles/tokens.css" } }],
      verification: [],
      role: "coder" as const,
    },
    {
      key: "review",
      title: REVIEW,
      objective: "Wait for the person to approve the prototype plan and the design set on the Styles page.",
      dependsOn: ["style"],
      expectedPaths: [],
      acceptanceCriteria: [{ id: "v1", description: "The starter is in place for the Styles page", check: { type: "file_exists" as const, path: "package.json" } }],
      verification: [],
      role: "coder",
    },
    {
      key: "layout",
      title: "App layout and navigation",
      objective:
        t.starter.framework === "React"
          ? `Build the app's structure before any feature (follow the app-layout-navigation and ux-design-principles skills): in src/App.tsx use the ready-made <AppShell> from src/components/ui (it renders the header with the product name from the spec, a <nav> to each main screen the spec describes, and a <main> showing ONE screen at a time) with useScreen() from src/lib/screens.ts for the current screen. App takes no props (src/main.tsx renders <App />), and AppShell draws the header and nav itself, so write no header, nav or links of your own. Screens: exactly the screens the spec names, no others (no Settings, Home, Profile or Sign-in screen unless the spec asks for one; a one-screen app has one entry). Follow the spec's own layout for each screen; a layout drawn in the spec is followed exactly (order, grouping, positions). A single-screen tool (a calculator, a timer, a converter, a game) is the tool itself filling the page: no PageHeader, sections or helper text around it, and no navigation tabs (with one screen in SCREENS, AppShell shows none). The shape, with the spec's own screen names in place of the <angle-bracket> parts: const SCREENS = [{ id: "<first-screen-id>", label: "<First screen name>" }]; const SCREEN_IDS = SCREENS.map((s) => s.id); export default function App() { const [current, go] = useScreen(SCREEN_IDS); return <AppShell name="<Product name>" screens={SCREENS} current={current} onNavigate={go}><FirstScreen /></AppShell>; } (with more than one screen, render the one whose id is current). Each screen starts with <PageHeader> (its one h1, a short description and its main action) and uses Section, Card, Button, Field, EmptyState and Skeleton from src/components/ui rather than new one-off markup. Create one component per screen in src/screens/ with its real title and a short, real description of what the user does there (from the spec, no placeholder wording), and a first screen that tells a new user what to do first. Style everything with the design tokens in src/styles/tokens.css.${layouts ? ` Ready-made screens from FlowCode's layouts are already in src/screens/: wire the ones the spec needs into the app shell as they are (the next step, "${DESIGN_SCREENS}", replaces their sample content) and delete the ones it doesn't use.` : ""}`
          : "Build the app's structure before any feature (follow the app-layout-navigation and ux-design-principles skills): in the root component (src/app/app.html and app.ts) an app shell with a header showing the product name from the spec, a <nav> to each main screen the spec describes, and a <main> area that shows ONE screen at a time (a signal for the current screen, or the router if present). One standalone component per screen with its real title and a short, real description of what the user does there (from the spec, no placeholder wording), and a first screen that tells a new user what to do first. Style with the design tokens in src/styles/tokens.css.",
      dependsOn: [layouts ? layouts.key : "review"],
      expectedPaths: t.starter.framework === "React" ? ["src/App.tsx", "src/screens/", "src/styles/"] : ["src/app/", "src/styles/"],
      acceptanceCriteria:
        t.starter.framework === "React"
          ? [
              { id: "l1", description: "The app uses the app shell (header and navigation)", check: { type: "file_contains" as const, path: "src/App.tsx", text: "<AppShell" } },
              { id: "l2", description: "Typecheck passes", check: { type: "verification" as const, kind: "typecheck" } },
            ]
          : [
              { id: "l1", description: "The app has navigation", check: { type: "file_contains" as const, path: "src/app/app.html", text: "<nav" } },
              { id: "l2", description: "Build passes", check: { type: "verification" as const, kind: "build" } },
            ],
      verification: t.starter.framework === "React" ? ["typecheck"] : ["build"],
      role: "coder",
    },
    {
      key: FEATURES_AFTER,
      title: DESIGN_SCREENS,
      objective: `Design each main screen like a senior product designer whose work is good enough for a studio portfolio (the best of Dribbble and Behance), and still easy to use: one finished composition per screen, before any feature is added (follow the art-direction skill, then the design-system and ux skills, and the Styles page in src/styles/tokens.css). Start your reply with the concept in 5 lines (idea, composition, type, colour, signature moment) and build to it. For each screen in ${t.starter.framework === "React" ? "src/screens/" : "src/app/"}, lay out everything the spec says the user sees and does there, the way a good product in its category does it (a calendar like a good calendar app, a store like a good store):
- The app's frame, designed for this product: the kit's AppShell (a white bar with a tab row) is only a temporary frame and is not a design. Choose the navigation pattern the product needs (a sidebar for a tool with several sections, a branded top bar, a bottom tab bar on phones, or no navigation for a one-screen app) and either restyle AppShell through its ui-shell__* classes in src/styles/components.css or replace it with the product's own frame component in src/components/. The frame carries the brand: logo mark, colour and type from the Styles page.
- Real imagery: use find_image for every photo the design calls for (a hero, people, places, products or food), saved into public/images with its credit; show it with real alt text and object-fit: cover. Icons from lucide-react, illustrations as inline SVG. Never a grey box or an empty image frame.
- One page header: the screen's title and its ONE primary action (e.g. "New event").
- One toolbar for the screen's controls: view switches as a segmented control or tabs, never full-width buttons; date or page navigation grouped with the current label; filters and search only when the spec asks for them.
- The main content (list, grid, board, form) filled with realistic sample data: seed src/sim collections with createCollection (8 to 20 records with real-sounding names, dates around today) and read them with useCollection, so the first screen looks like the product in use.
- Each action once, where people expect it: never the same button or label on every item (clicking a day or a row opens it), no helper, status or "0 items" text the user doesn't need, and only the account control that fits (signed in shows the user and "Sign out"; never "Sign in" next to it).
- Accounts (when the spec has them): sign-in is a demo, with the demo account's email and password already filled in and one tap to go in (no login logic). Signed out, the app shows that sign-in screen on its own (no nav to screens that need an account); signed in, the nav lists the app's screens and the header actions hold the account and "Sign out". Sign in is never a nav tab.
- Designed for this product, not a template: no marketing hero, promise or feature checklist on a task screen (sign in, settings, the main tool) unless the spec asks for one.
- Designed empty, loading and error states, used only when there really is no data.
Later steps add behaviour into this design, so give each feature a place (a dialog for editing, a details panel) without building its logic here. Run the app and look at each screen at desktop and phone width before you finish.${ready}`,
      dependsOn: ["layout"],
      expectedPaths: t.starter.framework === "React" ? ["src/screens/", "src/sim/", "src/styles/"] : ["src/app/", "src/styles/"],
      acceptanceCriteria: [{ id: "s1", description: "Typecheck passes", check: { type: "verification" as const, kind: "typecheck" } }],
      verification: ["typecheck"],
      role: "coder",
    },
  ];
  return tasks.flatMap((task) => (task.key === "layout" && layouts ? [layouts, task] : [task]));
}

/** Feature steps start after this one: the screens are designed whole first (Calendar prototype: ten feature steps
 * each bolted their own controls onto the month grid, while an older eight-step build that designed the screen in
 * one step looked far better). */
export const FEATURES_AFTER = "screens";
export const DESIGN_SCREENS = "Design the main screens";
export const DESIGN_POLISH = "Design polish";

/** Before assembly: one pass over the whole app's look, against the Styles page. */
export function polishTask(after: string[]): PlanTask {
  return {
    key: "polish",
    title: DESIGN_POLISH,
    objective: `Polish the whole app as one product, to the standard of a studio portfolio, without changing what it does (follow the art-direction skill and the concept the screens were designed to, then the design-system and micro-feedback skills). Open every screen at desktop and phone width and fix:
- Imagery: a screen that would look better with a real photo (a bare hero, item cards with no picture) gets one from find_image; check every image loads and has alt text, and that CC BY photos are credited.
- Template leftovers: generic marketing copy, feature checklists or sections the spec doesn't ask for; every screen should look made for this app.
- Clutter the feature steps added: a control or label repeated on every item, helper or status text the user doesn't need, two controls for the same thing. Merge them into the screen's header action, toolbar or the item itself.
- Hierarchy: one title and one primary action per screen; consistent spacing from the spacing tokens; related controls grouped; secondary settings moved out of the main view.
- Consistency with the Styles page: colours, type, corners and surfaces only from src/styles/tokens.css; the same building block for the same job everywhere.
- Motion and feedback: screens use ui-screen, lists ui-stagger, dialogs and new items ui-pop; every button and row has hover, press and focus states; saving shows brief feedback.
- Sample data shows on every screen that lists something.
Keep every accessible name and role the acceptance tests use (getByRole names), so the tests still pass; run the full test suite before you finish.`,
    role: "coder",
    dependsOn: after,
    expectedPaths: ["src/screens/", "src/styles/", "src/components/"],
    acceptanceCriteria: [
      { id: "p1", description: "Every acceptance test still passes", check: { type: "verification", kind: "tests" } },
      { id: "p2", description: "Typecheck passes", check: { type: "verification", kind: "typecheck" } },
    ],
    verification: ["typecheck", "tests"],
  } as PlanTask;
}

export const CLEAN_UP = "Clean up the code";

/**
 * After Design polish, before assembly: remove what the build left behind. FlowCode scans first (files nothing
 * imports, scratch files in the project root, debug calls, unused CSS classes) and gives the step that list, so it
 * removes exactly those; the code_cleanup check then proves they're gone and the tests prove nothing broke.
 */
export function cleanupTask(after: string[]): PlanTask {
  return {
    key: "cleanup",
    title: CLEAN_UP,
    objective: `Remove what the build left behind, without changing what the app does or how it looks. FlowCode's clean-up scan (below, with the step) lists what nothing uses:
- files under src/ that nothing imports: confirm with search_code that nothing refers to each one, then delete it;
- scratch files in the project root (test results, logs, dumps): delete them;
- debug calls (console.log, console.debug, debugger): remove them;
- CSS classes no source file uses: remove those rules, keeping any class built from parts at run time.
Change nothing else: keep the starter kit's building blocks, every test, the tests' accessible names, and the Styles page's tokens. Run the whole test suite and the type check before you finish.`,
    role: "coder",
    dependsOn: after,
    expectedPaths: ["src/"],
    acceptanceCriteria: [
      { id: "cu1", description: "Nothing unused is left (files, root scratch files, debug calls)", check: { type: "verification", kind: "code_cleanup" } },
      { id: "cu2", description: "Every acceptance test still passes", check: { type: "verification", kind: "tests" } },
      { id: "cu3", description: "Typecheck passes", check: { type: "verification", kind: "typecheck" } },
    ],
    verification: ["typecheck", "tests"],
  } as PlanTask;
}

/**
 * Final task of every spec build: put the pieces together. Without it, each feature task can pass on its own while
 * the root component still shows the starter screen. React builds are verified by the app_wiring check
 * (reachability from the entry point); Angular builds by the type check, tests and build.
 */
export function assembleTask(after: string[], templateId?: string): PlanTask {
  const t = starterOf(templateId);
  const react = t.starter.framework === "React";
  return {
    key: "assemble",
    title: react ? "Assemble the app: wire every page and component into App.tsx" : "Assemble the app: wire every page and component into the root component",
    objective: react
      ? "Finish the app in src/App.tsx: every screen that was built is in the app shell's navigation and shown once in its main area (never the same screen twice), each component that was created is used inside its screen so nothing is left unused, and no starter or placeholder text remains. The first screen must be usable with real, keyboard-reachable controls. Keep existing components; compose them rather than rewriting them."
      : "Replace the starter placeholder in src/app/app.html with the real product: use every component that was built by its selector (add each to the imports array in src/app/app.ts), connect navigation between the views (signals for the current view, or the Angular router if the app already uses it), and leave nothing unused. The first screen must be usable with real, keyboard-reachable controls. Keep existing components; compose them rather than rewriting them.",
    role: "coder",
    dependsOn: after,
    expectedPaths: react ? ["src/App.tsx", "src/"] : ["src/app/", "src/styles/app.css"],
    acceptanceCriteria: react
      ? [
          { id: "asm_wire", description: "Every page and component is reachable from the app's entry point and the starter placeholder is gone", check: { type: "verification", kind: "app_wiring" } },
          { id: "asm_tc", description: "Typecheck passes", check: { type: "verification", kind: "typecheck" } },
        ]
      : [
          { id: "asm_gone", description: "The starter placeholder is gone", check: { type: "file_not_contains", path: "src/app/app.html", text: "Start building here." } },
          { id: "asm_tc", description: "Typecheck passes", check: { type: "verification", kind: "typecheck" } },
          { id: "asm_test", description: "Unit tests pass", check: { type: "verification", kind: "tests" } },
          { id: "asm_build", description: "Build passes (templates and bindings are checked here)", check: { type: "verification", kind: "build" } },
        ],
    verification: react ? ["typecheck"] : ["typecheck", "tests", "build"],
  } as PlanTask;
}

/** Deterministic fallback when the Planner cannot produce a valid plan for the spec. */
export function specFallbackTasks(refs: ReferenceFile[], templateId?: string, objective?: string): PlanTask[] {
  const t = starterOf(templateId);
  const react = t.starter.framework === "React";
  const html = refs.filter((r) => r.role === "html");
  const prd = refs.some((r) => r.role === "prd" || r.role === "text");
  const tc = { type: "verification" as const, kind: "typecheck" };
  const tasks: PlanTask[] = [];
  if (html.length) {
    tasks.push({
      key: "port",
      title: `Port the reference page to ${t.starter.framework}`,
      objective: react
        ? `Recreate ${html.map((h) => referencePath(h)).join(", ")} as React components in src/ (App.tsx and src/components/). Keep every word, link (href) and form field (name, type, label) of the reference. Translate the reference CSS to classes in src/styles/app.css using design tokens.`
        : `Recreate ${html.map((h) => referencePath(h)).join(", ")} as Angular components in src/app/ (the root component's app.html plus one component folder per section). Keep every word, link (href) and form field (name, type, label) of the reference. Translate the reference CSS to classes in src/styles/app.css using design tokens.`,
      dependsOn: [FEATURES_AFTER],
      expectedPaths: ["src/"],
      acceptanceCriteria: react
        ? [{ id: "p1", description: "App renders the ported page", check: { type: "file_contains", path: "src/App.tsx", text: "return" } }, { id: "p2", description: "Typecheck passes", check: tc }]
        : [{ id: "p1", description: "The root template no longer shows the starter placeholder", check: { type: "file_not_contains", path: "src/app/app.html", text: "Start building here." } }, { id: "p2", description: "Build passes", check: { type: "verification", kind: "build" } }],
      verification: react ? ["typecheck"] : ["build"],
      role: "coder",
    });
  }
  tasks.push({
    key: "features",
    title: prd ? "Implement the PRD requirements" : "Build the requested features",
    objective: prd
      ? "Read spec/ (the PRD) and implement its functional requirements in src/, using the JSON content in src/content/ where provided."
      : `Build what was asked, in src/: ${(objective ?? "").slice(0, 600)}`,
    dependsOn: [html.length ? "port" : FEATURES_AFTER],
    expectedPaths: ["src/"],
    acceptanceCriteria: [{ id: "f1", description: "Typecheck passes", check: tc }, { id: "f2", description: "Build passes", check: { type: "verification", kind: "build" } }],
    verification: ["typecheck", "build"],
    role: "coder",
  });
  const finalCheck = t.requiredChecks.includes("lint") ? "lint" : "tests";
  tasks.push({
    key: "states",
    title: "Designed states, responsiveness and accessibility",
    objective: "Add empty, loading and error states where data is shown; make layouts responsive at 375/768/1280px; give every input a label, keep one h1 and a clear heading order, and keep visible focus styles.",
    dependsOn: ["features"],
    expectedPaths: ["src/"],
    acceptanceCriteria: [{ id: "a1", description: finalCheck === "lint" ? "Lint passes" : "Unit tests pass", check: { type: "verification", kind: finalCheck } }, { id: "a2", description: "Build passes", check: { type: "verification", kind: "build" } }],
    verification: [finalCheck, "build"],
    role: "coder",
  });
  return tasks;
}

export function specRequiredChecks(refs: ReferenceFile[], templateId?: string): VerificationKind[] {
  const t = starterOf(templateId);
  const base = t.requiredChecks.filter((k) => k !== "final_report");
  return [...base, ...(refs.some((r) => r.role === "html") ? (["spec_fidelity"] as VerificationKind[]) : []), ...(t.starter.wiringCheck ? (["app_wiring"] as VerificationKind[]) : []), "final_report"];
}
