/**
 * Launch Readiness Checklist (LRC): the tool for building the REAL application later. FlowCode builds a clickable
 * prototype (simulated data, no backend); this checklist lists everything the prototype simulates or leaves out, so a
 * person or a coding agent can build the real thing. The PRD's features come first (one category per PRD section,
 * one item per prototype-plan feature, with what the prototype already shows as information only), then backend,
 * data, accounts, security, privacy, accessibility, SEO and deployment. Categories are chosen from the project's
 * type, its spec and its code. Items with code or check evidence tick themselves off; the rest a person ticks.
 * User state (status overrides, flags, notes, edits, custom tasks) persists per project.
 */
import fs from "node:fs";
import path from "node:path";
import type { ReferenceFile, Run, Task, VerificationCheck, VerificationKind } from "@flowcode/contracts";
import type { App } from "../app.js";
import { gitStatus } from "../workspace/fileService.js";
import { extractRequirements, type Requirement } from "./spec.js";
import { planKey, sectionRole, stepOrder, type LrcPlan } from "./lrcPlan.js";
import { SENSITIVE_CATEGORIES, lintAiPrompt, promptConfigFor, taskPromptFor, type PromptConfig, type Priority } from "./taskPrompt.js";
import { starterOf } from "../orchestrator/templates.js";

export type LrcStatus = "completed" | "in_progress" | "needs_review" | "blocked" | "not_started" | "not_applicable";
export type LrcSource = "task" | "check" | "workspace" | "code" | "spec" | "manual" | "custom";
export const LRC_STATUSES: readonly LrcStatus[] = ["completed", "in_progress", "needs_review", "blocked", "not_started", "not_applicable"];

export interface LrcItem {
  id: string;
  title: string;
  detail: string;
  status: LrcStatus;
  source: LrcSource;
  /** Critical: launch is not ready while this is open. */
  gate?: boolean;
  priority: Priority;
  /** The category this item belongs to (set on every item of a report). */
  categoryId?: string;
  /** How it is verified: by code/checks, by a person, by reviewing against the spec, or by a plan task. */
  kind: "code" | "manual" | "review" | "task";
  flagged?: boolean;
  /** The user edited the title or description. */
  edited?: boolean;
  /** What the automatic status was derived from, or (for PRD features) what the prototype already has. */
  evidence?: string;
  /** Present when the user set the status by hand. */
  override?: { status: LrcStatus; at: string };
  /** What proves it automatically: a FlowCode check name (typecheck, accessibility…). */
  autoCheck?: string;
  /** Files that matter for this item. */
  files?: string[];
  /** The prompt an agent follows to do or verify this item; `promptAuthored` is false when generated from the fields. */
  prompt: string;
  promptAuthored: boolean;
  /** Free notes. */
  notes?: string;
  /** PRD requirement ids this item implements or checks. */
  covers?: string[];
}

export interface LrcCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  optional?: boolean;
  /** Why this category is on this project's checklist. */
  reason?: string;
  /** Generated items the user removed from this category (restorable). */
  hidden?: string[];
  items: LrcItem[];
}

export interface LrcReport {
  projectId: string;
  projectName: string;
  projectType?: string;
  runId?: string;
  scannedAt: string;
  checksLastRunAt?: string;
  totals: Record<LrcStatus, number> & { total: number; counted: number; gateOpen: number; flagged: number; done: number; percent: number; criticalOpen: number; gateBlocked: number; gateNeedsReview: number };
  /** red: a launch gate is blocked or more than five critical gates are open; amber: any critical gate open; green: none. */
  level: "red" | "amber" | "green";
  /** The PRD's requirements, counted from the prototype plan when the project has one. */
  requirements?: { total: number; inSteps: number; forPeople: number; later: number; filledIn: number };
  categories: LrcCategory[];
}

/** Done means complete or not applicable; both count toward every percentage. */
export const isDone = (s: LrcStatus) => s === "completed" || s === "not_applicable";

/** Guide §5 rule 3. */
export function launchLevel(t: { gateBlocked: number; criticalOpen: number }): LrcReport["level"] {
  if (t.gateBlocked > 0 || t.criticalOpen > 5) return "red";
  if (t.criticalOpen > 0) return "amber";
  return "green";
}

interface CustomItem {
  id: string;
  categoryId: string;
  title: string;
  detail: string;
  gate: boolean;
  /** Older checklists stored a severity; read as the priority. */
  severity?: "critical" | "high";
  priority?: Priority;
  kind?: LrcItem["kind"];
  aiPrompt?: string;
  createdAt: string;
}
export type ItemEdit = { title?: string; detail?: string; severity?: "critical" | "high" | null; priority?: Priority; gate?: boolean; aiPrompt?: string; kind?: LrcItem["kind"] };
interface LrcState {
  overrides: Record<string, { status: LrcStatus; at: string }>;
  flags: string[];
  custom: CustomItem[];
  edits: Record<string, ItemEdit>;
  hidden: string[];
  notes: Record<string, string>;
}

const stateKey = (projectId: string) => `lrc2:${projectId}`;
function loadState(app: App, projectId: string): LrcState {
  const s = app.store.getSetting<LrcState | null>(stateKey(projectId), null);
  if (s) return { overrides: s.overrides ?? {}, flags: s.flags ?? [], custom: s.custom ?? [], edits: s.edits ?? {}, hidden: s.hidden ?? [], notes: s.notes ?? {} };
  // Migrate the first-version store (overrides only).
  return { overrides: app.store.getSetting<LrcState["overrides"]>(`lrc:${projectId}`, {}), flags: [], custom: [], edits: {}, hidden: [], notes: {} };
}
const saveState = (app: App, projectId: string, s: LrcState) => app.store.setSetting(stateKey(projectId), s);

/** Items as the category library builds them; priority and prompt are filled in for every item afterwards. */
type DraftItem = Omit<LrcItem, "priority" | "prompt" | "promptAuthored"> & { priority?: Priority };
type DraftCategory = Omit<LrcCategory, "items"> & { items: DraftItem[] };

type Verdict = { status: LrcStatus; evidence: string };

function fromCheck(c: VerificationCheck | undefined): Verdict {
  if (!c) return { status: "not_started", evidence: "Not run yet" };
  const s = c.summary ? `: ${c.summary}` : "";
  switch (c.status) {
    case "passed":
      return { status: "completed", evidence: `Passed${s}` };
    case "passed_with_warnings":
      return { status: "needs_review", evidence: `Passed with warnings${s}` };
    case "failed":
      return { status: "blocked", evidence: `Failed${s}` };
    case "blocked":
      return { status: "blocked", evidence: `Blocked${s}` };
    case "running":
    case "pending":
      return { status: "in_progress", evidence: "Running now" };
    default:
      return { status: "not_started", evidence: c.status === "skipped" ? `Skipped${s}` : "Not run yet" };
  }
}

export function fromTask(t: Task): Verdict {
  switch (t.status) {
    case "verified":
      return { status: "completed", evidence: "Verified by its acceptance criteria" };
    case "running":
    case "attempted":
      return { status: "in_progress", evidence: t.attempts ? `Attempt ${t.attempts}` : "Running" };
    case "awaiting_approval":
      return { status: "in_progress", evidence: "Waiting for an approval" };
    case "blocked":
    case "failed":
      return { status: "blocked", evidence: t.blocker?.reason ?? `Task ${t.status}` };
    case "skipped":
      return { status: "needs_review", evidence: "Skipped" };
    default:
      return { status: "not_started", evidence: t.status === "invalidated" ? "Waiting on a blocked prerequisite" : "Queued" };
  }
}

// ───────────────────────── Workspace code index (bounded, cached briefly) ─────────────────────────

const CODE_EXT = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|css|scss|html?|json)$/i;
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".flowcode", ".next", "out", "coverage", ".vite", "spec"]);
const corpusCache = new Map<string, { at: number; files: Array<{ rel: string; text: string }> }>();

export function codeCorpus(root: string): Array<{ rel: string; text: string }> {
  const hit = corpusCache.get(root);
  if (hit && Date.now() - hit.at < 8000) return hit.files;
  const files: Array<{ rel: string; text: string }> = [];
  let bytes = 0;
  const walk = (dir: string, depth: number) => {
    if (depth > 6 || files.length >= 500 || bytes > 4_000_000) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIR.has(e.name) && !e.name.startsWith(".")) walk(abs, depth + 1);
      } else if (CODE_EXT.test(e.name) && !/lock\.json$|\.min\./.test(e.name)) {
        try {
          const st = fs.statSync(abs);
          if (st.size > 400_000) continue;
          const text = fs.readFileSync(abs, "utf8");
          bytes += text.length;
          files.push({ rel: path.relative(root, abs).replace(/\\/g, "/"), text });
        } catch {
          /* unreadable */
        }
      }
    }
  };
  walk(root, 0);
  corpusCache.set(root, { at: Date.now(), files });
  return files;
}

// ───────────────────────── Context ─────────────────────────

interface Ctx {
  type: string;
  ui: boolean;
  strategy?: string;
  latest?: Run;
  tasks: Task[];
  check: (k: VerificationKind) => VerificationCheck | undefined;
  has: (...names: string[]) => boolean;
  read: (name: string) => string;
  /** First file whose contents match, or undefined. Only searches source files, not the spec. */
  find: (re: RegExp) => string | undefined;
  /** Does the spec (PRD references and request text) mention this? */
  mentions: (re: RegExp) => boolean;
  /** The PRD's features save, sync or share data, so the real app needs a data store and an API. */
  dataFeatures: boolean;
  requirements: Requirement[];
  refs: ReferenceFile[];
  git: { available: boolean; changes: unknown[] };
  pendingApprovals: number;
}

const check = (ctx: Ctx, kind: VerificationKind, id: string, title: string, detail: string, gate = false): DraftItem => ({ id: `check.${kind}${id ? `.${id}` : ""}`, title, detail, source: "check", kind: "code", gate, autoCheck: kind, ...fromCheck(ctx.check(kind)) }) as DraftItem;
const file = (id: string, title: string, detail: string, ok: boolean, evidence: string, gate = false): DraftItem => ({ id: `ws.${id}`, title, detail, source: "workspace", kind: "code", gate, status: ok ? "completed" : "not_started", evidence });
const manual = (id: string, title: string, detail: string, gate = false): DraftItem => ({ id: `manual.${id}`, title, detail, source: "manual", kind: "manual", gate, status: "not_started" });
/** Code evidence: completed when the pattern is found in the source; otherwise not started. */
const code = (ctx: Ctx, id: string, title: string, detail: string, re: RegExp, what: string, gate = false): DraftItem => {
  const f = ctx.find(re);
  return { id: `code.${id}`, title, detail, source: "code", kind: "code", gate, status: f ? "completed" : "not_started", evidence: f ? `Found ${what} in ${f}` : `No ${what} found in the source yet` };
};

// ───────────────────────── Category library ─────────────────────────

function foundation(ctx: Ctx): DraftCategory {
  const gitignore = ctx.read(".gitignore");
  const envSafe = !ctx.has(".env") || /(^|\n)\s*\.env/.test(gitignore);
  const items: DraftItem[] = [];
  if (ctx.has("package.json")) {
    items.push(check(ctx, "install", "", "Dependencies install cleanly", "Lockfile-respecting install with no errors."));
    if (ctx.has("tsconfig.json")) items.push(check(ctx, "typecheck", "", "Type check passes", "No TypeScript errors across the project.", true));
    items.push(check(ctx, "lint", "", "Lint passes", "No lint errors under the project rules."));
    items.push(check(ctx, "tests", "", "Tests pass", "The automated test suite runs green."));
    items.push(check(ctx, "build", "", "Production build succeeds", "The bundler emits a deployable build.", true));
  }
  items.push(file("gitignore", ".gitignore present", "Build output, dependencies and secrets are excluded from version control.", ctx.has(".gitignore"), ctx.has(".gitignore") ? "Found .gitignore" : "Missing .gitignore"));
  items.push(file("env", "Secrets kept out of version control", ".env files are ignored by git; no secrets are committed.", envSafe, envSafe ? (ctx.has(".env") ? ".env is listed in .gitignore" : "No .env file in the workspace") : ".env exists but is not in .gitignore", true));
  return { id: "foundation", title: "Project foundation", description: "Build health, type safety, tests and secrets hygiene", icon: "diagnostics", items };
}

const STEP_WORD: Record<LrcStatus, string> = { completed: "done", in_progress: "in progress", needs_review: "needs review", blocked: "blocked", not_started: "not built yet", not_applicable: "not applicable" };
const cleanSection = (s: string) => s.replace(/^\d+(\.\d+)*[.)]?\s*/, "").trim() || "Requirements";
const shortTitle = (t: string) => (t.length > 110 ? `${t.slice(0, 107)}…` : t);

/**
 * The PRD's features to build for real: one category per PRD section, one item per prototype-plan feature (or per
 * requirement when the project has no plan). What the prototype already has is information only: a feature the
 * prototype simulates still has to be built for real, so every item starts Not started and a person ticks it.
 * The plan's step prompts are not used here; each item gets a real-app prompt (taskPrompt.ts).
 */
export function specFeatures(requirements: Requirement[], plan: LrcPlan | null, taskOf: (taskId?: string) => Task | undefined): DraftCategory[] {
  const cats = new Map<string, DraftCategory>();
  const catOf = (id: string, title: string) => {
    let c = cats.get(id);
    if (!c) cats.set(id, (c = { id, title: `Spec · ${title}`, description: "", icon: "reports", reason: "From your PRD", items: [] }));
    return c;
  };
  if (plan) {
    const reqText = new Map(plan.requirements.map((r) => [r.id, r.text]));
    const order = stepOrder(plan.items);
    for (const i of plan.items) {
      if (!i.categoryId.startsWith("spec.")) continue;
      const cat = catOf(i.categoryId, i.categoryTitle);
      const base = { id: i.id, title: i.title, source: "spec" as const, priority: i.priority, covers: i.covers, files: i.files.filter((f) => !f.endsWith("/")) };
      if (i.executionType === "code") {
        const n = i.stepKey ? order.get(i.stepKey) : undefined;
        const task = taskOf(i.taskId);
        const word = STEP_WORD[task ? fromTask(task).status : "not_started"];
        const reqs = i.covers.map((id) => `${id}: ${reqText.get(id) ?? ""}`);
        cat.items.push({
          ...base,
          detail: reqs.length ? `${i.description.replace(/ Covers [^.]*\.$/, "")}\n${reqs.join("\n")}` : i.description,
          kind: "code",
          gate: i.launchGate,
          status: "not_started",
          evidence: n ? `The prototype has this (step ${n}, ${word}). Build the real version.` : "Not in the prototype yet.",
        });
      } else if (i.later) {
        // "For the real app" is exactly this checklist's job; a roadmap idea is not for this release.
        const real = /real app|real product/i.test(i.later);
        cat.items.push({ ...base, detail: i.description, kind: i.executionType, status: real ? "not_started" : "not_applicable", evidence: real ? `The prototype leaves this out: ${i.later}` : `Not for this release: ${i.later}` });
      } else cat.items.push({ ...base, detail: i.description, kind: i.executionType, status: "not_started", evidence: i.executionType === "manual" ? "A person does this, then marks it complete" : "A person checks the real app against this" });
    }
  } else {
    const bySection = new Map<string, Requirement[]>();
    for (const r of requirements) {
      const key = r.section || "Requirements";
      if (!bySection.has(key)) bySection.set(key, []);
      bySection.get(key)!.push(r);
    }
    for (const [section, reqs] of [...bySection].slice(0, 10)) {
      const clean = cleanSection(section);
      const feature = sectionRole(section) === "feature";
      const cat = catOf(`spec.${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`, clean);
      for (const r of reqs.slice(0, 14))
        cat.items.push({ id: `spec.${r.id}`, title: shortTitle(r.text), detail: r.text, source: "spec", kind: feature ? "code" : "review", priority: feature ? "high" : undefined, covers: [r.id], status: "not_started" });
    }
  }
  for (const c of cats.values()) c.description = `${c.items.length} item${c.items.length === 1 ? "" : "s"} from the PRD section "${c.title.replace(/^Spec · /, "")}"`;
  return [...cats.values()];
}

/** Words that mean a feature keeps or shares data: the real app then needs a data store and an API. */
const DATA_FEATURE = /\b(sav(e|es|ed|ing)|stor(e|es|ed|ing)|history|sync(s|ed|ing)?|accounts?|sign(s|ed)? ?(in|up)|log ?in|shar(e|es|ed|ing)|upload(s|ed|ing)?|favou?rites?|bookmarks?|persist(s|ed|ence)?|collaborat\w*)\b/i;

/** Do the PRD's features (the plan's feature items, or the feature sections' requirements) save, sync or share data? */
export function featuresStoreData(requirements: Requirement[], plan: LrcPlan | null): boolean {
  const reqText = new Map((plan?.requirements ?? requirements).map((r) => [r.id, r.text]));
  const lines = plan
    ? plan.items.filter((i) => i.executionType === "code" && i.categoryId.startsWith("spec.")).flatMap((i) => [i.title, i.description.replace(/ Covers [^.]*\.$/, ""), ...i.covers.map((id) => reqText.get(id) ?? "")])
    : requirements.filter((r) => sectionRole(r.section) === "feature").map((r) => r.text);
  return DATA_FEATURE.test(affirmedText(lines.join("\n")));
}

function contentFidelity(ctx: Ctx): DraftCategory | null {
  const jsonRefs = ctx.refs.filter((r) => r.role === "json");
  if (!jsonRefs.length && !ctx.mentions(/content\.json|\bjson\b.*content|do not retype/)) return null;
  const items: DraftItem[] = [
    code(ctx, "json-import", "Content imported, not retyped", "UI text comes from the supplied JSON so copy stays in sync with the source.", /import\s+[\w{}\s,*]+\s+from\s+['"][^'"]+\.json['"]|fetch\([^)]*\.json/, "a JSON content import"),
    check(ctx, "spec_fidelity", "", "Copy matches the reference", "Every word, link and form field of the reference survives in the build.", true),
    manual("content-proof", "Content proofread", "Spot-check headings, names and numbers against the source."),
  ];
  return { id: "content", title: "Content & data fidelity", description: "Supplied content is imported and rendered faithfully", icon: "file", reason: jsonRefs.length ? "You attached JSON content" : "Your spec references a content file", items };
}

function navigation(ctx: Ctx): DraftCategory | null {
  if (!ctx.ui || !ctx.mentions(/rout|navigation|navigate|\bpages?\b|deep link|back button|#\//)) return null;
  return {
    id: "nav",
    title: "Navigation & routing",
    description: "Routes, deep links, back behaviour and unknown paths",
    icon: "network",
    reason: "Your spec describes multiple pages or routing",
    items: [
      code(ctx, "router", "Router in place", "Every page in the spec is reachable by URL.", /hashchange|createBrowserRouter|createHashRouter|<Routes|useRouter|router\.(push|navigate)|location\.hash/, "routing code"),
      code(ctx, "back", "Back button behaves", "Browser back returns to the previous view without losing state.", /history\.(back|push|state)|popstate|hashchange/, "history handling"),
      code(ctx, "notfound", "Unknown routes handled", "A friendly not-found view instead of a blank page.", /not\s*found|404|NotFound/, "a not-found view"),
      manual("deeplinks", "Deep links tested", "Paste a few inner URLs into a fresh tab; each opens the right view."),
    ],
  };
}

function persistence(ctx: Ctx): DraftCategory | null {
  // Offline isn't saved data (a calculator works offline and keeps nothing); "import" alone is code talk.
  const asked = ctx.mentions(/localstorage|indexeddb|persist|saved? (state|data|progress)|export (data|history|your)|data export|backup|restore/);
  if (!asked && !ctx.dataFeatures) return null;
  const items: DraftItem[] = [
    manual("realdata", "Simulated data replaced", "Every screen reads and writes real data; nothing the app keeps still comes from the demo store in src/sim.", true),
    code(ctx, "storage", "State persists across reloads", "What users save is kept and restored on load (in a real store, not the prototype's demo data).", /localStorage|indexedDB|sessionStorage/, "browser storage"),
  ];
  if (ctx.mentions(/export|backup|download/)) items.push(code(ctx, "export", "Export / backup works", "Users can download their data.", /new Blob|URL\.createObjectURL|download\s*=|\.download\b/, "an export"));
  if (ctx.mentions(/import|restore|upload/)) items.push(code(ctx, "import", "Import / restore works", "A previous export can be loaded back in.", /FileReader|\.text\(\)|type=["']file["']|JSON\.parse\(/, "an import"));
  if (ctx.mentions(/reset|clear/)) items.push(code(ctx, "reset", "Reset is available and confirmed", "Clearing data asks first and cannot be triggered by accident.", /confirm\(|removeItem|localStorage\.clear/, "a reset"));
  items.push(manual("migration", "Saved data survives an update", "Data saved by the previous version still loads after you ship a change.", true));
  return { id: "data", title: "Data & persistence", description: "Saving, restoring, exporting and resetting user data", icon: "server", reason: asked ? "Your spec stores data" : "Your PRD's features save or share data", items };
}

function forms(ctx: Ctx): DraftCategory | null {
  // "Keyboard input" isn't a form: fields people fill in are.
  if (!ctx.ui || !ctx.mentions(/\bforms?\b|input fields?|text (input|field)|form fields?|submit|sign ?up|contact (form|us)|capture answers|text ?area/)) return null;
  return {
    id: "forms",
    title: "Forms & input",
    description: "Labels, validation, errors and keyboard entry",
    icon: "workspace",
    reason: "Your spec collects input",
    items: [
      code(ctx, "labels", "Every field is labelled", "Inputs have visible labels or aria-labels.", /<label|aria-label=/, "field labels"),
      code(ctx, "validation", "Validation with clear errors", "Required fields and formats are checked with readable messages.", /required|aria-invalid|setCustomValidity|validate/, "validation"),
      manual("input-keyboard", "Forms work by keyboard", "Tab order is logical and Enter submits."),
    ],
  };
}

function auth(ctx: Ctx): DraftCategory | null {
  if (!ctx.mentions(/log ?in|sign ?in|auth|password|account|session token|oauth/)) return null;
  return {
    id: "auth",
    title: "Accounts & authentication",
    description: "Sign-in, sessions, password handling and access control",
    icon: "quality",
    reason: "Your spec has user accounts",
    items: [
      manual("auth-flow", "Sign-in, sign-out and reset tested", "Happy path and wrong-password path both behave.", true),
      manual("auth-storage", "No passwords or tokens in plain storage", "Credentials never land in localStorage or logs.", true),
      manual("auth-access", "Access control checked", "A signed-out user cannot reach private pages or data.", true),
    ],
  };
}

function payments(ctx: Ctx): DraftCategory | null {
  if (!ctx.mentions(/payment|checkout|stripe|subscription|billing|invoice/)) return null;
  return {
    id: "payments",
    title: "Payments",
    description: "Checkout, test mode, receipts and failure handling",
    icon: "quality",
    reason: "Your spec takes payments",
    items: [manual("pay-test", "Full checkout tested in test mode", "Success, decline and cancel paths all handled.", true), manual("pay-keys", "Live keys only in production config", "No secret keys in the client bundle.", true), manual("pay-receipts", "Receipts and refunds", "Customers get a receipt; refunds are possible.")],
  };
}

function api(ctx: Ctx): DraftCategory | null {
  // The prototype simulates every server call; the real app needs a backend whenever its features keep or share data.
  const asked = ctx.mentions(/\bapi\b|endpoint|server|database|backend|webhook/) && !ctx.mentions(/no backend|no server needed/);
  if (!asked && !ctx.dataFeatures) return null;
  return {
    id: "api",
    title: "API & backend",
    description: "Endpoints, errors, configuration and limits",
    icon: "server",
    reason: asked ? "Your spec has a backend" : "Your PRD's features save or share data, so the real app needs a backend",
    items: [
      manual("simcalls", "Simulated calls replaced", "Everything the prototype simulates in src/sim calls a real endpoint, keeping the loading and error states.", true),
      check(ctx, "server_start", "", "Server starts", "The production server boots and serves requests.", true),
      code(ctx, "errors", "Errors are handled", "Failures return useful messages instead of crashing.", /catch\s*\(|\.catch\(|res\.status\(\s*[45]\d\d/, "error handling"),
      code(ctx, "env", "Configuration from environment", "URLs and keys come from env vars, not hard-coded.", /process\.env\.|import\.meta\.env\./, "environment config"),
      manual("limits", "Rate limits and input size limits", "Abuse cannot exhaust the server."),
    ],
  };
}

function accessibility(ctx: Ctx): DraftCategory | null {
  if (!ctx.ui) return null;
  return {
    id: "a11y",
    title: "Accessibility & inclusive design",
    description: "WCAG 2.1 AA checks, contrast, keyboard and screen readers",
    icon: "a11y",
    items: [
      check(ctx, "accessibility", "", "Automated accessibility audit", "axe scan of the running preview: no critical or serious violations.", true),
      check(ctx, "design_qa", "", "Contrast and design tokens", "Text contrast meets AA; colours and spacing come from tokens."),
      code(ctx, "motion", "Respects reduced motion", "Animations calm down when the OS asks for less motion.", /prefers-reduced-motion/, "a reduced-motion rule"),
      manual("keyboard", "Keyboard-only walkthrough", "Every flow can be completed with Tab, Enter and Escape; focus is always visible."),
      manual("screenreader", "Screen reader spot check", "Headings, labels and live regions read sensibly in NVDA or VoiceOver."),
    ],
  };
}

function quality(ctx: Ctx): DraftCategory | null {
  if (!ctx.ui) return null;
  const items: DraftItem[] = [
    check(ctx, "preview_health", "", "Preview loads", "The app starts and the preview answers without errors.", true),
    check(ctx, "screenshots", "", "Desktop and mobile screenshots", "Evidence that layouts hold at both sizes."),
    check(ctx, "visual_critique", "", "Visual critique", "The vision model reviewed screenshots for layout defects."),
    manual("console", "No console errors", "Open DevTools on each page; the console is clean."),
  ];
  if (ctx.mentions(/single ?file|singlefile|one portable|portable \.html/)) items.push(code(ctx, "singlefile", "Builds to one portable file", "The production build is a single self-contained HTML file.", /vite-plugin-singlefile|viteSingleFile/, "the single-file plugin", true));
  if (ctx.mentions(/timer|countdown|clock/)) items.push(manual("timer", "Timer accuracy", "Runs correctly across tab switches and sleep; pause and reset work."));
  items.push(manual("perf", "Performance reviewed", "Lighthouse performance 90+ on mobile; images sized and lazy-loaded."));
  return { id: "quality", title: "Responsive, performance & quality", description: "Breakpoints, console errors, loading and polish", icon: "models", items };
}

function seo(ctx: Ctx): DraftCategory | null {
  if (!ctx.ui) return null;
  const internal = ctx.mentions(/internal|facilitator|intranet|offline|no backend|not public|private tool/);
  return {
    id: "seo",
    title: "SEO & discoverability",
    description: "Title, description, social preview and sitemap",
    icon: "search",
    optional: internal,
    reason: internal ? "Optional: your spec reads as an internal or offline tool" : undefined,
    items: [check(ctx, "seo", "", "Search metadata present", "Title, description, language and social tags."), code(ctx, "og", "Social preview", "Sharing a link shows a title, description and image.", /og:title|twitter:card/, "Open Graph tags"), manual("sitemap", "Sitemap and robots", "Search engines can find the public pages.")],
  };
}

function security(ctx: Ctx): DraftCategory {
  return {
    id: "security",
    title: "Security",
    description: "Unsafe patterns, injection risks and vulnerable dependencies",
    icon: "quality",
    items: [
      check(ctx, "security_scan", "", "Security scan", "Static triage for unsafe patterns, injection risks and vulnerable dependencies.", true),
      (() => {
        // Passes only when NO source file inserts raw HTML (pattern assembled so scanners don't flag this detector).
        const hit = ctx.find(new RegExp(`${"dangerously"}SetInnerHTML|\\.innerHTML\\s*=`));
        return { id: "code.rawhtml", title: "No unsafe HTML injection", detail: "User text is never inserted as raw HTML.", source: "code" as const, kind: "code" as const, status: (hit ? "needs_review" : "completed") as LrcStatus, evidence: hit ? `Raw HTML insertion in ${hit}: confirm it only ever receives trusted text` : "No raw HTML insertion in the source" };
      })(),
    ],
  };
}

/** Privacy and legal: automatic checks can only bring these to Needs review; a person signs them off. */
function privacy(c: Ctx): DraftCategory {
  return {
    id: "privacy",
    title: "Privacy & legal",
    description: "What the app stores, licences and data handling. A person signs these off",
    icon: "quality",
    items: [
      check(c, "compliance_triage", "", "Compliance triage", "Licensing, privacy and data-handling flags reviewed.", true),
      manual("privacy", "Privacy notice accurate", "Says plainly what the product stores and where.", true),
    ],
  };
}

function docs(ctx: Ctx): DraftCategory {
  return {
    id: "docs",
    title: "Docs & support",
    description: "README, license, changelog and help content",
    icon: "support",
    items: [
      file("readme", "README", "How to install, run, test and deploy.", ctx.has("README.md", "readme.md"), ctx.has("README.md", "readme.md") ? "Found README.md" : "Missing README.md"),
      file("license", "License", "The project states its license.", ctx.has("LICENSE", "LICENSE.md", "LICENSE.txt"), ctx.has("LICENSE", "LICENSE.md", "LICENSE.txt") ? "Found LICENSE" : "Missing LICENSE"),
      file("changelog", "Changelog", "Notable changes are recorded for each release.", ctx.has("CHANGELOG.md"), ctx.has("CHANGELOG.md") ? "Found CHANGELOG.md" : "Missing CHANGELOG.md"),
      manual("help", "Help for first-time users", "Someone new can get started without asking you."),
    ],
  };
}

function launchOps(ctx: Ctx): DraftCategory {
  const items: DraftItem[] = [
    check(ctx, "final_report", "", "Final evidence report", "A report with every check's evidence was generated for this build.", true),
    file("git", "Version control initialized", "The workspace is a git repository.", ctx.git.available, ctx.git.available ? "Git repository found" : "Not a git repository"),
    { id: "ws.committed", title: "All changes committed", detail: "The working tree is clean, so the release is reproducible.", source: "workspace", kind: "code", ...(ctx.git.available ? (ctx.git.changes.length ? { status: "needs_review" as const, evidence: `${ctx.git.changes.length} uncommitted change(s)` } : { status: "completed" as const, evidence: "Working tree clean" }) : { status: "not_started" as const, evidence: "No git repository" }) },
    { id: "ws.approvals", title: "No pending approvals", detail: "Nothing is waiting on your decision.", source: "workspace", kind: "manual", gate: true, status: ctx.pendingApprovals ? "blocked" : "completed", evidence: ctx.pendingApprovals ? `${ctx.pendingApprovals} pending` : "None pending" },
    manual("deploy", "Deployment target configured", ctx.mentions(/single ?file|portable|offline/) ? "Decide how the file is distributed (shared drive, email, intranet) and test opening it there." : "Hosting, domain and environment variables are set up."),
    manual("rollback", "Rollback plan", "You know how to restore the previous release quickly."),
  ];
  if (!ctx.mentions(/offline|single ?file|no backend/)) items.splice(5, 0, manual("monitoring", "Monitoring and error tracking", "Uptime checks and error reporting are in place."));
  return { id: "launch", title: "Launch operations & deployment", description: "Evidence, version control, distribution and rollback", icon: "rocket", items };
}

function postLaunch(): DraftCategory {
  return {
    id: "post",
    title: "Post-launch growth",
    description: "Feedback loop, iteration cadence and retrospective",
    icon: "agents",
    optional: true,
    items: [manual("feedback", "Feedback channel", "Users know how to report problems and ideas."), manual("cadence", "Iteration cadence", "A plan for the next round of improvements."), manual("retro", "Retrospective", "What went well, what to change next time.")],
  };
}

// ───────────────────────── Report ─────────────────────────

/** Prototype-only code: the simulated data and the prototype's acceptance tests. */
const PROTOTYPE_ONLY = /^src\/(sim|acceptance)\//;

/** Headings of PRD sections that say what the product won't do (now): their words don't add launch categories. */
const NOT_ASKED = /non-?goals?|out of scope|not in scope|future|later|roadmap|v2|nice to have|won'?t|open questions|risks/i;
/** A clause that says something isn't there: "no login", "requires no account", "without a server". */
const NEGATED = /\b(no|not|without|never|zero|none|nor)\b|n't\b/i;

/**
 * The parts of the spec that ask for something, so keyword-matched categories come from what the PRD wants. The
 * Calculator PRD got "Accounts & authentication" from "requires no account" and "No login", and "API & backend" from
 * a non-goal, which made the checklist list work nobody asked for.
 */
export function affirmedText(prd: string): string {
  const out: string[] = [];
  let skipping = false;
  let level = 0;
  for (const line of prd.split(/\r?\n/)) {
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      if (skipping && h[1].length > level) continue;
      skipping = NOT_ASKED.test(h[2]);
      level = h[1].length;
      if (!skipping) out.push(h[2]);
      continue;
    }
    if (skipping) continue;
    // Sentence by sentence (and table cell): one that opens with a negation ("No login screen, account, or onboarding")
    // goes whole; in the others each comma clause is judged on its own ("works offline, requires no account").
    for (const sentence of line.split(/[.;!?|]\s*|\s[-–—]\s/)) {
      const bare = sentence.replace(/^[\s>*_#-]*(\[[ xX]\]\s*)?[*_]*/, "");
      if (!bare.trim() || /^(no|not|without|never|zero|none|nor)\b/i.test(bare)) continue;
      for (const clause of bare.split(/,\s*/)) if (clause.trim() && !NEGATED.test(clause)) out.push(clause);
    }
  }
  return out.join("\n");
}

export async function launchReadiness(app: App, projectId: string): Promise<LrcReport> {
  const project = app.store.projects.require(projectId);
  const runs = app.store.runs.where("project_id = ?", projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latest = runs.at(-1);

  const checks = new Map<VerificationKind, VerificationCheck>();
  let checksLastRunAt: string | undefined;
  for (const r of runs)
    for (const c of app.store.checks.where("run_id = ?", r.id)) {
      if (c.taskId) continue;
      const prev = checks.get(c.kind);
      if (!prev || c.updatedAt >= prev.updatedAt) checks.set(c.kind, c);
      if (!checksLastRunAt || c.updatedAt > checksLastRunAt) checksLastRunAt = c.updatedAt;
    }

  let root: string | undefined;
  try {
    root = app.projects.workspacePath(project);
  } catch {
    root = undefined;
  }
  const corpus = root ? codeCorpus(root) : [];
  const refs = runs.flatMap((r) => app.store.getSetting<ReferenceFile[]>(`runRefs:${r.id}`, []));
  const prd = [...refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content), ...runs.map((r) => r.objective)].join("\n\n");
  const specText = `${affirmedText(prd)}\n${refs.map((r) => r.name).join(" ")}`.toLowerCase();
  const type = project.projectType ?? "unknown";
  // The prototype plan FlowCode wrote for this project, when it has one: its features are the real app's features.
  const plan = app.store.getSetting<LrcPlan | null>(planKey(projectId), null);
  const requirements = prd.trim() ? extractRequirements(prd, 120) : [];

  const ctx: Ctx = {
    type,
    ui: ["static_html", "vite", "react", "nextjs", "electron", "tauri"].includes(type) || corpus.some((f) => /\.(html|tsx|jsx|vue|svelte)$/.test(f.rel)),
    strategy: latest?.strategy?.kind,
    latest,
    tasks: latest ? app.store.tasks.where("run_id = ?", latest.id).sort((a, b) => a.ordinal - b.ordinal) : [],
    check: (k) => checks.get(k),
    has: (...names) => !!root && names.some((n) => fs.existsSync(path.join(root!, n))),
    read: (n) => {
      try {
        return root ? fs.readFileSync(path.join(root, n), "utf8") : "";
      } catch {
        return "";
      }
    },
    // The prototype's simulation and its acceptance tests are not the real app: they never count as code evidence.
    find: (re) => corpus.find((f) => ((!f.rel.endsWith(".json") || /package\.json$/.test(f.rel)) && !PROTOTYPE_ONLY.test(f.rel) ? re.test(f.text) : false))?.rel,
    mentions: (re) => re.test(specText),
    dataFeatures: featuresStoreData(requirements, plan),
    requirements,
    refs,
    git: root ? await gitStatus(app.projects.jail(project)) : { available: false, changes: [] },
    pendingApprovals: app.store.approvals.where("project_id = ? AND status = ?", projectId, "pending").length,
  };

  // The PRD's features come right after the foundation: one category per section, from the prototype plan when there
  // is one (each item says what the prototype already has), else from the PRD's requirement lines.
  const drafts: DraftCategory[] = [
    foundation(ctx),
    ...specFeatures(requirements, plan, (id) => (id ? app.store.tasks.get(id) : undefined)),
    contentFidelity(ctx),
    navigation(ctx),
    persistence(ctx),
    forms(ctx),
    auth(ctx),
    payments(ctx),
    api(ctx),
    accessibility(ctx),
    quality(ctx),
    security(ctx),
    privacy(ctx),
    seo(ctx),
    docs(ctx),
    launchOps(ctx),
    postLaunch(),
  ].filter((c): c is DraftCategory => !!c);
  const categories = foldBackground(drafts.filter((c) => c.items.length > 0));

  // User state: custom tasks, flags, then status overrides (which win over evidence).
  const state = loadState(app, projectId);
  const customPrompts = new Map<string, string>();
  for (const c of state.custom) {
    let cat = categories.find((x) => x.id === c.categoryId);
    if (!cat) {
      cat = { id: "custom", title: "Your tasks", description: "Tasks you added to this checklist", icon: "checklist", items: [] };
      if (!categories.some((x) => x.id === "custom")) categories.splice(categories.length - 1, 0, cat);
      else cat = categories.find((x) => x.id === "custom")!;
    }
    if (c.aiPrompt) customPrompts.set(c.id, c.aiPrompt);
    cat.items.push({ id: c.id, title: c.title, detail: c.detail, source: "custom", kind: c.kind ?? "manual", gate: c.gate, priority: c.priority ?? c.severity, status: "not_started" });
  }
  const hidden = new Set(state.hidden);
  for (const cat of categories) {
    const gone = cat.items.filter((i) => hidden.has(i.id)).map((i) => i.id);
    if (gone.length) {
      cat.items = cat.items.filter((i) => !hidden.has(i.id));
      cat.hidden = gone;
    }
  }

  const cfg = promptConfigOf(ctx, latest);
  const flags = new Set(state.flags);
  const totals: LrcReport["totals"] = { completed: 0, in_progress: 0, needs_review: 0, blocked: 0, not_started: 0, not_applicable: 0, total: 0, counted: 0, gateOpen: 0, flagged: 0, done: 0, percent: 0, criticalOpen: 0, gateBlocked: 0, gateNeedsReview: 0 };
  const finished: LrcCategory[] = categories.map((cat) => ({
    ...cat,
    items: cat.items.map((d) => {
      const item = { ...d, categoryId: cat.id } as LrcItem;
      const e = state.edits[item.id];
      if (e) {
        if (e.title) item.title = e.title;
        if (e.detail !== undefined) item.detail = e.detail;
        if (e.gate !== undefined) item.gate = e.gate;
        if (e.kind) item.kind = e.kind;
        item.edited = true;
      }
      item.priority = e?.priority ?? e?.severity ?? d.priority ?? (item.gate ? "critical" : item.source === "check" ? "high" : cat.optional ? "low" : "medium");
      // Automatic evidence never signs off privacy, legal, account or payment work on its own.
      if (SENSITIVE_CATEGORIES.has(cat.id) && item.status === "completed") {
        item.status = "needs_review";
        item.evidence = `${item.evidence ?? "Checked"}. A person signs off on privacy, legal, account and payment items.`;
      }
      const o = state.overrides[item.id];
      if (o) {
        item.override = o;
        item.status = o.status;
      }
      if (flags.has(item.id)) item.flagged = true;
      if (state.notes[item.id]) item.notes = state.notes[item.id];
      // Only prompts a person wrote are stored; the prototype plan's step prompts build the prototype, not the real
      // app, so plan items get a generated real-app prompt like every other item.
      const stored = e?.aiPrompt ?? customPrompts.get(item.id);
      const p = taskPromptFor(stored, { title: item.title, detail: item.detail, kind: item.kind, gate: item.gate, categoryId: cat.id, categoryTitle: cat.title, evidence: item.evidence, autoCheck: item.autoCheck, files: item.files }, cfg);
      item.prompt = p.prompt;
      item.promptAuthored = p.authored;
      totals[item.status]++;
      totals.total++;
      if (isDone(item.status)) totals.done++;
      if (item.flagged) totals.flagged++;
      if (item.gate && !isDone(item.status)) {
        totals.gateOpen++;
        if (item.priority === "critical") totals.criticalOpen++;
        if (item.status === "blocked") totals.gateBlocked++;
        if (item.status === "needs_review") totals.gateNeedsReview++;
      }
      return item;
    }),
  }));
  totals.counted = totals.total;
  totals.percent = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  return { projectId, projectName: project.name, projectType: type, runId: latest?.id, scannedAt: new Date().toISOString(), checksLastRunAt, totals, level: launchLevel(totals), requirements: plan ? requirementCounts(plan) : undefined, categories: finished };
}

/** Where the PRD's requirements went in the prototype plan. */
export function requirementCounts(plan: LrcPlan): NonNullable<LrcReport["requirements"]> {
  return {
    total: plan.requirements.length,
    inSteps: new Set(plan.items.filter((i) => i.executionType === "code").flatMap((i) => i.covers)).size,
    forPeople: plan.items.filter((i) => i.executionType !== "code" && !i.later).length,
    later: plan.items.filter((i) => i.later).length,
    filledIn: plan.filledIn.length,
  };
}

/** The stack note and proof lines for generated prompts, from the starter or the project's package.json scripts. */
function promptConfigOf(ctx: Ctx, latest?: Run): PromptConfig {
  let scripts: string[] = [];
  try {
    scripts = Object.keys((JSON.parse(ctx.read("package.json") || "{}") as { scripts?: Record<string, string> }).scripts ?? {});
  } catch {
    scripts = [];
  }
  const templateId = latest?.strategy?.templateId;
  const stack = templateId ? starterOf(templateId).starter.stack : ctx.type !== "unknown" ? ctx.type : undefined;
  return promptConfigFor({ stack, scripts });
}

/** Plan-type sections (when and in what order the work happens), folded with the project context. */
const SCHEDULE = /\b(milestones?|phases?|timeline|sprints?|breakdown|work ?plan|delivery plan|implementation plan|roadmap)\b/i;

/**
 * PRD sections that are context, not build work (goals, users, metrics, risks, timeline, milestones, non-goals, open
 * questions) go into one "PRD background" group after the build sections. The Calculator's checklist had eight of
 * them as categories of their own between the parts that are actually built, which made it hard to read.
 */
export function foldBackground<T extends { id: string; title: string; description: string; items: DraftItem[] }>(cats: T[]): T[] {
  const isBackground = (c: T) => {
    if (!c.id.startsWith("spec.")) return false;
    const section = c.title.replace(/^Spec · /, "");
    const role = sectionRole(section);
    return role === "project" || role === "later" || role === "decision" || SCHEDULE.test(section);
  };
  const folded = cats.filter(isBackground);
  if (folded.length < 2) return cats;
  const group = {
    ...folded[0],
    id: "spec.background",
    title: "PRD background",
    description: `${folded.map((c) => c.title.replace(/^Spec · /, "").replace(/\s*\([^)]*\)/g, "")).join(", ")}: context from your PRD, not build work`,
    reason: "From your PRD",
    items: folded.flatMap((c) => c.items.map((i) => ({ ...i, detail: `${c.title.replace(/^Spec · /, "")}. ${i.detail}` }))),
  } as T;
  const rest = cats.filter((c) => !isBackground(c));
  return [...rest, group];
}

/** Records a manual status; `status: null` clears it so the item follows its evidence again. */
export function setLaunchOverride(app: App, projectId: string, itemId: string, status: LrcStatus | null) {
  app.store.projects.require(projectId);
  const s = loadState(app, projectId);
  if (status) s.overrides[itemId] = { status, at: new Date().toISOString() };
  else delete s.overrides[itemId];
  saveState(app, projectId, s);
}

export function setLaunchFlag(app: App, projectId: string, itemId: string, flagged: boolean) {
  app.store.projects.require(projectId);
  const s = loadState(app, projectId);
  s.flags = flagged ? [...new Set([...s.flags, itemId])] : s.flags.filter((x) => x !== itemId);
  saveState(app, projectId, s);
}

/** Thrown when a stored prompt doesn't meet the prompt standard; the message lists every problem. */
export class PromptLintError extends Error {
  constructor(readonly problems: string[]) {
    super(`AI prompt: ${problems.join("; ")}`);
  }
}
const assertPrompt = (text: string | undefined, categoryId?: string) => {
  const problems = lintAiPrompt(text, { categoryId });
  if (problems.length) throw new PromptLintError(problems);
};

export function addLaunchTask(app: App, projectId: string, input: { categoryId?: string; title: string; detail?: string; gate?: boolean; severity?: "critical" | "high"; priority?: Priority; kind?: LrcItem["kind"]; aiPrompt?: string }) {
  app.store.projects.require(projectId);
  assertPrompt(input.aiPrompt, input.categoryId);
  const s = loadState(app, projectId);
  const id = `custom.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  s.custom.push({ id, categoryId: input.categoryId ?? "custom", title: input.title, detail: input.detail ?? "", gate: !!input.gate, priority: input.priority ?? input.severity, kind: input.kind, aiPrompt: input.aiPrompt?.trim() || undefined, createdAt: new Date().toISOString() });
  saveState(app, projectId, s);
  return id;
}

/** `categoryId` is the item's category, so a privacy, legal, account or payment prompt is held to the sign-off rule. */
export function editLaunchItem(app: App, projectId: string, itemId: string, edit: ItemEdit, categoryId?: string) {
  app.store.projects.require(projectId);
  if (edit.aiPrompt !== undefined) assertPrompt(edit.aiPrompt, categoryId);
  const s = loadState(app, projectId);
  const custom = s.custom.find((c) => c.id === itemId);
  const priority = edit.priority ?? (edit.severity === null ? undefined : edit.severity);
  if (custom) {
    if (edit.title) custom.title = edit.title;
    if (edit.detail !== undefined) custom.detail = edit.detail;
    if (edit.gate !== undefined) custom.gate = edit.gate;
    if (edit.kind) custom.kind = edit.kind;
    if (priority !== undefined || edit.severity === null) (custom.priority = priority), (custom.severity = undefined);
    if (edit.aiPrompt !== undefined) custom.aiPrompt = edit.aiPrompt.trim() || undefined;
  } else {
    const next: ItemEdit = { ...s.edits[itemId], ...edit };
    if (priority !== undefined) next.priority = priority;
    delete next.severity;
    // An empty prompt means "use the generated one".
    if (edit.aiPrompt !== undefined && !edit.aiPrompt.trim()) delete next.aiPrompt;
    s.edits[itemId] = next;
  }
  saveState(app, projectId, s);
}

export function setLaunchNotes(app: App, projectId: string, itemId: string, notes: string) {
  app.store.projects.require(projectId);
  const s = loadState(app, projectId);
  if (notes.trim()) s.notes[itemId] = notes;
  else delete s.notes[itemId];
  saveState(app, projectId, s);
}

/** Custom tasks are deleted; generated items are hidden and can be restored per category. */
export function removeLaunchItem(app: App, projectId: string, itemId: string) {
  app.store.projects.require(projectId);
  const s = loadState(app, projectId);
  if (s.custom.some((c) => c.id === itemId)) {
    s.custom = s.custom.filter((c) => c.id !== itemId);
    delete s.overrides[itemId];
    delete s.edits[itemId];
    s.flags = s.flags.filter((x) => x !== itemId);
  } else s.hidden = [...new Set([...s.hidden, itemId])];
  saveState(app, projectId, s);
}

export function restoreLaunchItems(app: App, projectId: string, itemIds: string[]) {
  app.store.projects.require(projectId);
  const s = loadState(app, projectId);
  const set = new Set(itemIds);
  s.hidden = s.hidden.filter((h) => !set.has(h));
  saveState(app, projectId, s);
}

const MD_STATUS: Record<LrcStatus, string> = { completed: "Complete", in_progress: "In progress", needs_review: "Needs review", blocked: "Blocked", not_started: "Not started", not_applicable: "Not applicable" };

/**
 * The checklist as Markdown, to hand the real-app work to a person or a coding agent: each category is a heading, each
 * item a GitHub task-list line (ticked when complete or not applicable) with its detail, status, notes and prompt.
 */
export function launchMarkdown(r: LrcReport, now = new Date()): { markdown: string; filename: string } {
  const date = now.toISOString().slice(0, 10);
  const slug = r.projectName.trim().toLowerCase().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
  const indent = (text: string) => text.split(/\r?\n/).map((l) => (l.trim() ? `  ${l}` : "")).join("\n");
  const t = r.totals;
  const out: string[] = [
    `# Launch readiness: ${r.projectName}`,
    "",
    "For building the real application: everything the prototype simulates or leaves out. Each item has a prompt you can give to a coding agent.",
    "",
    `- Project: ${r.projectName}${r.projectType && r.projectType !== "unknown" ? ` (${r.projectType})` : ""}`,
    `- Date: ${date}`,
    `- Overall progress: ${t.done} of ${t.total} items done (${t.percent}%)${t.gateOpen ? `; ${t.gateOpen} launch gate${t.gateOpen === 1 ? "" : "s"} open` : ""}`,
  ];
  for (const c of r.categories) {
    const done = c.items.filter((i) => isDone(i.status)).length;
    out.push("", `## ${c.title}${c.optional ? " (optional)" : ""}`, "", `${c.description}${c.reason ? ` · ${c.reason}` : ""}`.trim(), "", `${done} of ${c.items.length} done.`, "");
    for (const i of c.items) {
      const marks = [i.priority === "critical" || i.priority === "high" ? `${i.priority[0].toUpperCase()}${i.priority.slice(1)} priority` : "", i.gate ? "Launch gate" : "", i.flagged ? "Flagged" : ""].filter(Boolean);
      out.push(`- [${isDone(i.status) ? "x" : " "}] **${i.title.replace(/\s+/g, " ")}**${marks.length ? ` · ${marks.join(" · ")}` : ""}`);
      if (i.detail && i.detail !== i.title) out.push(indent(i.detail));
      out.push(`  Status: ${MD_STATUS[i.status]}${i.override ? " (set by you)" : ""}.${i.evidence ? ` ${i.evidence}` : ""}`);
      if (i.notes?.trim()) out.push(`  Notes: ${i.notes.trim().replace(/\s*\n\s*/g, " ")}`);
      // A fence longer than any backtick run in the prompt, so the prompt can't close it.
      const fence = "`".repeat(Math.max(3, ...[...i.prompt.matchAll(/`+/g)].map((m) => m[0].length + 1)));
      out.push("", "  <details><summary>Prompt</summary>", "", `  ${fence}text`, indent(i.prompt.trimEnd()), `  ${fence}`, "", "  </details>", "");
    }
  }
  return { markdown: `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`, filename: `${slug}-launch-readiness-${date}.md` };
}

/** One line per project for the checklist overview: readiness %, open gates and status counts. */
export async function launchSummaries(app: App) {
  const out = [];
  for (const p of app.store.projects.list("updated_at DESC")) {
    try {
      const r = await launchReadiness(app, p.id);
      const latest = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", p.id)[0];
      out.push({
        projectId: p.id,
        name: p.name,
        projectType: r.projectType,
        percent: r.totals.percent,
        level: r.level,
        completed: r.totals.done,
        counted: r.totals.counted,
        gateOpen: r.totals.gateOpen,
        blocked: r.totals.blocked,
        needsReview: r.totals.needs_review,
        flagged: r.totals.flagged,
        categories: r.categories.length,
        latestRunStatus: latest?.status,
        updatedAt: p.updatedAt,
      });
    } catch {
      /* workspace missing: skip */
    }
  }
  return out;
}

/** "Fill from fields": the generated prompt for unsaved editor values (nothing is stored). */
export function previewPrompt(app: App, projectId: string, f: { title: string; detail?: string; kind: LrcItem["kind"]; gate?: boolean; categoryId?: string }): string {
  const project = app.store.projects.require(projectId);
  let scripts: string[] = [];
  try {
    scripts = Object.keys((JSON.parse(fs.readFileSync(path.join(app.projects.workspacePath(project), "package.json"), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {});
  } catch {
    scripts = [];
  }
  const latest = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", projectId)[0];
  const stack = latest?.strategy?.templateId ? starterOf(latest.strategy.templateId).starter.stack : project.projectType && project.projectType !== "unknown" ? project.projectType : undefined;
  const categoryId = f.categoryId ?? "custom";
  return taskPromptFor(undefined, { title: f.title, detail: f.detail ?? "", kind: f.kind, gate: f.gate, categoryId, categoryTitle: categoryId }, promptConfigFor({ stack, scripts })).prompt;
}
