/**
 * Build analysis: a repository-report-style reading of a build. Combines the build's own evidence (checks, tasks,
 * spec adherence via the launch checklist) with static analysers over the workspace. Every finding says what was
 * found, where, why it matters, what to do, and carries a FlowCode prompt to reconcile it. Nothing is executed
 * and nothing leaves the machine. Reports are kept per project (score history) and exported as PDF.
 */
import fs from "node:fs";
import path from "node:path";
import type { Finding, VerificationCheck, VerificationKind } from "@flowcode/contracts";
import type { App } from "../app.js";
import { flattenFiles } from "../workspace/fileService.js";
import { complianceTriage, securityTriage, seoTriage } from "./staticTriage.js";
import { staticAccessibility } from "./a11yStatic.js";
import { designQa } from "./designQa.js";
import { launchReadiness } from "./launchReadiness.js";
import { SEVERITIES, SEVERITY_LABEL, buildReportHtml, saveReportPdf, type ReportMeta } from "./reportPdf/document.js";
import { anchor, mdCell } from "./reportPdf/markdown.js";
import { redact } from "../security/redaction.js";
import { PathJail } from "../security/pathJail.js";
import { detectPreflight } from "../workspace/preflight.js";
import { sha256 } from "../util/ids.js";

export type Severity = "critical" | "high" | "medium" | "low" | "informational";
export const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "informational"];

export interface BaFinding {
  key: string;
  sectionId: string;
  title: string;
  severity: Severity;
  confidence: "high" | "medium" | "low";
  metrics: Array<{ value: number; label: string }>;
  plain: string;
  technical: string;
  files: string[];
  why: string;
  ifNothing: string;
  rationale: string;
  recommendation: string;
  /** True when the finding rests on something NOT being visible (confirm before changing anything). */
  absence?: boolean;
  steps: Array<{ title: string; text: string }>;
  prompt: { title: string; body: string };
  outcome: string;
  resolved?: { at: string };
}

export interface BaSection {
  id: string;
  title: string;
  examines: string;
  notExamined: string;
  /** not_run: the section needs executed checks that this scan did not run (folder scans); never scored. */
  status: "completed" | "not_applicable" | "not_run";
  scored: boolean;
  weight: number;
  score?: number;
  counts: Record<Severity, number>;
  findings: BaFinding[];
}

export interface BaReport {
  id: string;
  /** The FlowCode project, or "" for a folder scan (Repo tools). */
  projectId: string;
  /** Absolute path of the scanned folder (folder scans only; the user chose it). */
  folder?: string;
  projectName: string;
  projectType?: string;
  generatedAt: string;
  filesRead: number;
  filesSkipped: number;
  overall: number;
  verdict: string;
  counts: Record<Severity, number>;
  resolvedCount: number;
  summary: string;
  scoreNote: string;
  sections: BaSection[];
  priority: string[];
  quickWins: string[];
  longerTerm: string[];
  notVerified: string[];
  reconcilePrompt: string;
  history: Array<{ at: string; score: number }>;
}

// ───────────────────────── workspace reading ─────────────────────────

const SKIP = /(^|\/)(node_modules|dist|build|out|coverage|\.git|\.flowcode|\.next|\.vite|spec)\//;
const CODE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte)$/;
interface Src {
  rel: string;
  text: string;
}
function readSources(root: string, files: string[]): { code: Src[]; read: number; skipped: number } {
  const code: Src[] = [];
  let read = 0;
  let skipped = 0;
  for (const rel of files) {
    if (SKIP.test(rel)) {
      skipped++;
      continue;
    }
    if (!CODE.test(rel) && !/\.(html?|css)$/.test(rel)) continue;
    try {
      const st = fs.statSync(path.join(root, rel));
      if (st.size > 600_000) {
        skipped++;
        continue;
      }
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      read++;
      if (CODE.test(rel) || /\.html?$/.test(rel)) code.push({ rel, text });
    } catch {
      skipped++;
    }
  }
  return { code, read, skipped };
}
const isTest = (rel: string) => /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[jt]sx?$/.test(rel);

// ───────────────────────── finding builder ─────────────────────────

const CONSTRAINTS = ["Preserve existing behaviour unless the change is the point.", "Follow the conventions already used in these files.", "Do not log secrets, tokens, or personal data.", "Do not make unrelated refactors."];

interface Spec {
  sectionId: string;
  rule: string;
  title: string;
  severity: Severity;
  confidence?: BaFinding["confidence"];
  metrics?: BaFinding["metrics"];
  plain: string;
  technical: string;
  files?: string[];
  why: string;
  ifNothing: string;
  rationale: string;
  recommendation: string;
  absence?: boolean;
  /** Imperative change description for the FlowCode prompt. */
  task: string;
  promptSteps?: string[];
  acceptance: string[];
  context: string;
}

function urgency(s: Severity): string {
  return s === "critical" ? "This should be fixed before launch." : s === "high" ? "This is worth fixing soon rather than scheduling." : s === "medium" ? "This is worth putting on the list, not worth stopping for." : "This is a small thing to tidy when the area is next touched.";
}

function finding(x: Spec): BaFinding {
  const files = [...new Set(x.files ?? [])].slice(0, 12);
  const steps: BaFinding["steps"] = [];
  if (x.absence) steps.push({ title: "Confirm it first.", text: "This rests on something not being visible in the files that were read, which is not the same as it not existing. Check whether it is handled elsewhere before changing anything." });
  else if (files.length) steps.push({ title: `Open the ${files.length} file${files.length === 1 ? "" : "s"} listed above`, text: "and confirm the finding still describes what is there. The analysis read a copy; the working tree may have moved since." });
  steps.push({ title: "Make the change.", text: x.recommendation });
  if (files.length > 1) steps.push({ title: "Apply it everywhere it applies.", text: "Each location above is a separate instance; fixing one leaves the rest. Search for the same pattern elsewhere before closing this off." });
  steps.push({ title: "Verify.", text: "Run Build analysis again and confirm the finding is gone. If it is still here, the change did not reach every location — not that the report is stale." });
  const body = [
    x.task,
    "",
    ...(files.length ? ["First inspect:", ...files.map((f) => `- ${f}`), "- the existing conventions elsewhere in this project", ""] : []),
    ...(x.promptSteps?.length ? [...x.promptSteps.map((s, i) => `${i + 1}. ${s}`), ""] : []),
    "Context:",
    `- ${x.context}`,
    "- The build must keep adhering to its spec (PRD, reference HTML/CSS/JSON in spec/ and src/content/ when present).",
    "",
    "Constraints:",
    ...CONSTRAINTS.map((c) => `- ${c}`),
    "",
    "Acceptance criteria:",
    ...x.acceptance.map((a) => `- ${a}`),
    "- Type check, lint, tests and the production build still pass.",
  ].join("\n");
  return {
    key: `${x.sectionId}:${x.rule}`,
    sectionId: x.sectionId,
    title: x.title,
    severity: x.severity,
    confidence: x.confidence ?? "high",
    metrics: x.metrics ?? (files.length ? [{ value: files.length, label: "files cited" }] : []),
    plain: x.plain,
    technical: x.technical,
    files,
    why: x.why,
    ifNothing: `${x.ifNothing} ${urgency(x.severity)}`,
    rationale: x.rationale,
    recommendation: x.recommendation,
    absence: x.absence,
    steps,
    prompt: { title: `Implement: ${x.title}`, body: redact(body) },
    outcome: x.recommendation,
  };
}

const mapSev = (s: Finding["severity"]): Severity => (s === "critical" ? "critical" : s === "serious" ? "high" : s === "moderate" ? "medium" : s === "minor" ? "low" : "informational");

/** Groups existing analyser findings by rule into one report finding each. */
function fromAnalyser(sectionId: string, findings: Finding[], ctx: string, area: { why: string; ifNothing: string; rationale: string; plainPrefix: string }): BaFinding[] {
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
  return [...byRule.values()].map((group) => {
    const f = group[0];
    const files = [...new Set(group.map((g) => g.path).filter(Boolean) as string[])];
    const worst = group.reduce((a, b) => (SEV_ORDER.indexOf(mapSev(b.severity)) < SEV_ORDER.indexOf(mapSev(a.severity)) ? b : a));
    return finding({
      sectionId,
      rule: f.rule,
      title: f.message,
      severity: mapSev(worst.severity),
      confidence: f.confidence,
      metrics: [{ value: group.length, label: group.length === 1 ? "instance" : "instances" }, ...(files.length ? [{ value: files.length, label: "files" }] : [])],
      plain: `${area.plainPrefix} ${f.impact ? `The risk: ${f.impact.charAt(0).toLowerCase()}${f.impact.slice(1)}.` : ""}`.trim(),
      technical: `${group.length} instance${group.length === 1 ? "" : "s"} of "${f.rule}"${files.length ? ` across ${files.length} file${files.length === 1 ? "" : "s"}` : ""}. ${f.evidence ? `Example: ${redact(f.evidence).slice(0, 160)}.` : ""}`.trim(),
      files,
      why: area.why,
      ifNothing: area.ifNothing,
      rationale: area.rationale + (f.manualValidationRequired ? " Every finding here needs a person to confirm it." : ""),
      recommendation: f.recommendation ?? "Address each instance listed.",
      absence: !files.length,
      task: `Fix "${f.message}" (${f.rule}) everywhere it occurs in this project.`,
      promptSteps: f.recommendation ? [f.recommendation] : undefined,
      acceptance: [`No instance of "${f.rule}" remains in the files listed, or each remaining one carries a comment explaining why it is safe.`],
      context: ctx,
    });
  });
}

// ───────────────────────── analysers ─────────────────────────

function buildHealth(app: App, projectId: string, ctx: string): BaFinding[] {
  const runs = app.store.runs.where("project_id = ?", projectId);
  const latest = runs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  const out: BaFinding[] = [];
  if (!latest) return out;
  const checks = new Map<VerificationKind, VerificationCheck>();
  for (const r of runs) for (const c of app.store.checks.where("run_id = ?", r.id)) if (!c.taskId && (!checks.get(c.kind) || c.updatedAt >= checks.get(c.kind)!.updatedAt)) checks.set(c.kind, c);
  const META: Partial<Record<VerificationKind, { title: string; sev: Severity; why: string; fix: string }>> = {
    build: { title: "The production build fails", sev: "critical", why: "Nothing can ship until the bundler produces a build.", fix: "Run the build, read the first error, and fix the cause rather than the symptom." },
    typecheck: { title: "Type checking fails", sev: "high", why: "Type errors usually point at real mismatches between what code expects and what it gets.", fix: "Fix each type error at its source; do not silence it with any or ts-ignore." },
    tests: { title: "Tests fail", sev: "high", why: "A failing suite means behaviour the project promised is broken, or the tests no longer describe the product.", fix: "Make the failing tests pass, or update them where the behaviour change was intended — and say which in the commit." },
    lint: { title: "Lint fails", sev: "medium", why: "Lint rules catch bugs that compile fine: unused results, missing dependencies, unsafe patterns.", fix: "Fix the reported lint errors; disable a rule only with a comment explaining why." },
    preview_health: { title: "The preview does not load", sev: "high", why: "If the app does not start, nothing a user would see has been verified.", fix: "Start the dev server, open the console, and fix the first runtime error." },
    accessibility: { title: "The accessibility audit fails", sev: "high", why: "People using a keyboard or screen reader may be unable to use the product at all.", fix: "Fix each critical and serious axe violation reported by the check." },
    spec_fidelity: { title: "The build does not match the reference spec", sev: "high", why: "The brief was to build to spec; copy, links or fields from the reference are missing.", fix: "Restore every missing word, link and form field listed in the spec fidelity evidence." },
  };
  for (const [kind, meta] of Object.entries(META) as Array<[VerificationKind, NonNullable<(typeof META)[VerificationKind]>]>) {
    const c = checks.get(kind);
    if (!c || !["failed", "blocked"].includes(c.status)) continue;
    out.push(
      finding({
        sectionId: "build",
        rule: `check-${kind}`,
        title: meta.title,
        severity: c.status === "blocked" ? (meta.sev === "critical" ? "high" : "medium") : meta.sev,
        metrics: [{ value: 1, label: c.status === "blocked" ? "check blocked" : "check failed" }],
        plain: c.status === "blocked" ? `The ${kind.replace(/_/g, " ")} check could not run because an earlier step was blocked.` : `FlowCode ran the ${kind.replace(/_/g, " ")} check on this build and it failed.`,
        technical: `Latest ${kind} result: ${c.status}${c.summary ? ` — ${redact(c.summary).slice(0, 300)}` : ""}.`,
        why: meta.why,
        ifNothing: "The build cannot be called done, and Launch readiness keeps this gate open.",
        rationale: "Read from the verification record FlowCode stored for this build.",
        recommendation: meta.fix,
        task: `${meta.title}. ${meta.fix}`,
        promptSteps: [`Run the project's ${kind === "preview_health" ? "dev server" : kind} command and capture the first error.`, "Fix the root cause.", "Re-run the command until it passes."],
        acceptance: [`The ${kind.replace(/_/g, " ")} check passes.`],
        context: ctx,
      }),
    );
  }
  const tasks = latest ? app.store.tasks.where("run_id = ?", latest.id) : [];
  const blocked = tasks.filter((t) => t.status === "blocked" || t.status === "failed");
  if (blocked.length)
    out.push(
      finding({
        sectionId: "build",
        rule: "blocked-tasks",
        title: `${blocked.length} planned task${blocked.length === 1 ? " is" : "s are"} blocked`,
        severity: "high",
        metrics: [{ value: blocked.length, label: "blocked tasks" }, { value: tasks.length, label: "tasks planned" }],
        plain: "Parts of the build plan stopped before they were finished, so the product is missing what they were meant to add.",
        technical: blocked.map((t) => `• ${t.title}: ${t.blocker?.reason ?? t.status}`).join("\n").slice(0, 1200),
        files: blocked.flatMap((t) => t.expectedPaths),
        why: "A blocked task leaves its feature unbuilt and its dependants invalidated.",
        ifNothing: "The build stays incomplete.",
        rationale: "Read from the task records of the latest build.",
        recommendation: "Resolve each blocker (the reason is listed), then retry the task in FlowCode or implement it directly.",
        task: `Complete the blocked tasks from the build plan:\n${blocked.map((t) => `- ${t.title}: ${t.objective}`).join("\n")}`,
        acceptance: blocked.map((t) => `"${t.title}" is implemented and meets its acceptance criteria.`),
        context: ctx,
      }),
    );
  const notRun = [...(latest?.strategy?.requiredChecks ?? [])].filter((k) => !checks.get(k) || checks.get(k)!.status === "not_run");
  if (notRun.length)
    out.push(
      finding({
        sectionId: "build",
        rule: "checks-not-run",
        title: `${notRun.length} required check${notRun.length === 1 ? " has" : "s have"} not run`,
        severity: "informational",
        metrics: [{ value: notRun.length, label: "checks not run" }],
        plain: "Some checks this kind of build needs have no result yet, so their part of the build is unverified rather than passing.",
        technical: `Not run: ${notRun.join(", ")}.`,
        why: "An unrun check and a passing check look the same on a quick read.",
        ifNothing: "Launch decisions rest on less evidence than they appear to.",
        rationale: "Compared the build's required checks against the stored results.",
        recommendation: "Use Run checks on Launch readiness once the build has finished.",
        task: `Run the project's verification commands (${notRun.join(", ")}) and fix anything that fails.`,
        acceptance: notRun.map((k) => `${k} has a passing result.`),
        context: ctx,
      }),
    );
  return out;
}

async function specAdherence(app: App, projectId: string, ctx: string): Promise<BaFinding[]> {
  const lrc = await launchReadiness(app, projectId);
  const specItems = lrc.categories.filter((c) => c.id.startsWith("spec.")).flatMap((c) => c.items.map((i) => ({ ...i, section: c.title.replace(/^Spec · /, "") })));
  const out: BaFinding[] = [];
  if (!specItems.length) return out;
  const missing = specItems.filter((i) => i.status === "not_started" && /Not found yet/.test(i.evidence ?? ""));
  const partial = specItems.filter((i) => i.status === "in_progress");
  if (missing.length || partial.length) {
    const share = (missing.length + partial.length) / specItems.length;
    const list = [...partial, ...missing];
    out.push(
      finding({
        sectionId: "spec",
        rule: "spec-identifiers",
        title: `${list.length} spec requirement${list.length === 1 ? " names" : "s name"} things the code does not contain`,
        severity: share > 0.3 ? "high" : "medium",
        confidence: "medium",
        metrics: [{ value: list.length, label: "requirements" }, { value: specItems.length, label: "in the PRD" }],
        plain: "The PRD names specific keys, routes and files. Some of them do not appear anywhere in the build, which usually means that part of the spec was not built or was built differently.",
        technical: list.slice(0, 14).map((i) => `• [${i.section}] ${i.title} — ${i.evidence}`).join("\n"),
        why: "The brief was to build to spec. Each missing identifier is a place where the build and the PRD disagree.",
        ifNothing: "The build drifts from the spec, and anyone relying on the PRD gets something different.",
        rationale: "Backticked identifiers in the PRD were searched for in the source. A requirement worded without identifiers cannot be checked this way and is not counted.",
        recommendation: "Implement each requirement as the PRD words it, using the exact identifiers it names (storage keys, routes, file names).",
        task: `Bring the build into line with its PRD. These requirements name identifiers that are missing from the code:\n${list
          .slice(0, 20)
          .map((i) => `- ${i.detail}`)
          .join("\n")}`,
        promptSteps: ["Read the PRD in spec/ (or the original request) for each requirement.", "Implement it using the identifiers exactly as written.", "Do not rename identifiers the PRD fixes (keys, routes, file names)."],
        acceptance: ["Every identifier the PRD names appears in the code where the PRD says it belongs.", "Re-running Build analysis shows no spec identifiers missing."],
        context: ctx,
      }),
    );
  }
  const fidelity = lrc.categories.flatMap((c) => c.items).find((i) => i.id === "check.spec_fidelity");
  if (fidelity && (fidelity.status === "blocked" || fidelity.status === "needs_review"))
    out.push(
      finding({
        sectionId: "spec",
        rule: "spec-fidelity",
        title: "Copy or fields from the reference HTML are missing",
        severity: "high",
        plain: "The reference build's words, links or form fields are not all present in the new build.",
        technical: fidelity.evidence ?? "Spec fidelity check did not pass.",
        why: "Missing copy is the most visible kind of drift from a reference.",
        ifNothing: "Users see a different product from the one specified.",
        rationale: "Read from the spec fidelity check, which compares the reference HTML's inventory with the built page.",
        recommendation: "Restore every missing word, link and field listed in the evidence.",
        task: "Restore the copy, links and form fields from the reference HTML that the spec fidelity check reports as missing.",
        acceptance: ["The spec fidelity check passes."],
        context: ctx,
      }),
    );
  const content = lrc.categories.flatMap((c) => c.items).find((i) => i.id === "code.json-import");
  if (content && content.status === "not_started")
    out.push(
      finding({
        sectionId: "spec",
        rule: "content-not-imported",
        title: "Content is not imported from the supplied JSON",
        severity: "medium",
        absence: true,
        plain: "The spec supplies the product's text as a JSON file, but nothing in the code imports it, so the text was probably retyped.",
        technical: content.evidence ?? "No JSON content import found.",
        why: "Retyped content drifts from the source as soon as either changes.",
        ifNothing: "Fixes to the content file never reach the product.",
        rationale: "Searched the source for an import or fetch of a .json content file.",
        recommendation: "Import the supplied content file and render from it instead of hard-coded strings.",
        task: "Replace hard-coded workshop content with an import of the supplied content JSON (src/content/*.json).",
        acceptance: ["UI text that exists in the content file is rendered from it.", "No content from the JSON is duplicated as literals."],
        context: ctx,
      }),
    );
  return out;
}

function errorHandling(code: Src[], ctx: string): BaFinding[] {
  const prod = code.filter((s) => !isTest(s.rel) && CODE.test(s.rel));
  const out: BaFinding[] = [];
  const emptyCatch: string[] = [];
  let emptyCount = 0;
  let consoleCount = 0;
  const consoleFiles: string[] = [];
  const fetchNoCatch: string[] = [];
  const leakyTimers: string[] = [];
  for (const s of prod) {
    const m = s.text.match(/catch\s*(\([^)]*\))?\s*\{\s*(\/\/[^\n]*\n\s*)?(console\.\w+\([^;]*\);?\s*)?\}/g);
    if (m) {
      emptyCount += m.length;
      emptyCatch.push(s.rel);
    }
    const c = s.text.match(/console\.(log|debug|info)\(/g);
    if (c) {
      consoleCount += c.length;
      consoleFiles.push(s.rel);
    }
    if (/\bfetch\(/.test(s.text) && !/\.catch\(|try\s*\{/.test(s.text)) fetchNoCatch.push(s.rel);
    if (/setInterval\(|addEventListener\(/.test(s.text) && !/clearInterval\(|removeEventListener\(|AbortController/.test(s.text)) leakyTimers.push(s.rel);
  }
  if (emptyCount)
    out.push(
      finding({
        sectionId: "errors",
        rule: "empty-catch",
        title: "Catch blocks that discard the error they caught",
        severity: emptyCount > 10 ? "medium" : "low",
        metrics: [{ value: emptyCount, label: "catch blocks" }, { value: emptyCatch.length, label: "files" }],
        plain: "When something goes wrong, the code notices the problem and then throws the details away without writing them down anywhere.",
        technical: `${emptyCount} catch block${emptyCount === 1 ? "" : "s"} across ${emptyCatch.length} file${emptyCatch.length === 1 ? "" : "s"} either have an empty body or only write to the console.`,
        files: emptyCatch,
        why: "If someone reports that something did not work, there is no record to look at.",
        ifNothing: "Faults keep happening and nobody finds out how often.",
        rationale: "The pattern is read directly from the source. What it costs depends on which paths these sit on.",
        recommendation: "Decide, per catch, whether the error should be surfaced to the user, reported, or genuinely ignored — and where it is ignored, say so in a comment.",
        task: "Review the catch blocks that currently discard their error.",
        promptSteps: ["For each one, choose deliberately between surfacing the failure to the user, rethrowing, or ignoring it with a comment saying why."],
        acceptance: ["No catch block is left with an empty body and no comment explaining it."],
        context: ctx,
      }),
    );
  if (consoleCount > 3)
    out.push(
      finding({
        sectionId: "errors",
        rule: "console-logging",
        title: "Console logging left in the production source",
        severity: "low",
        metrics: [{ value: consoleCount, label: "console calls" }],
        plain: "The product writes diagnostic messages to a developer's console rather than somewhere that keeps them.",
        technical: `${consoleCount} console.log/debug/info calls outside test files.`,
        files: consoleFiles,
        why: "Those messages are useful while somebody is watching; in real use nobody is.",
        ifNothing: "Problems in real use leave nothing to read afterwards.",
        rationale: "Counted directly from the source.",
        recommendation: "Remove debugging leftovers; route messages that matter through one small logger.",
        task: "Remove leftover debug console calls and route meaningful diagnostics through a single logger helper.",
        acceptance: ["No console.log/debug calls remain outside the logger and test files."],
        context: ctx,
      }),
    );
  if (fetchNoCatch.length)
    out.push(
      finding({
        sectionId: "errors",
        rule: "fetch-no-failure-path",
        title: "Network calls with no failure path",
        severity: "medium",
        confidence: "medium",
        plain: "Some screens ask the network for data but do nothing sensible if the request fails.",
        technical: `${fetchNoCatch.length} file${fetchNoCatch.length === 1 ? "" : "s"} call fetch() with no .catch or try/catch.`,
        files: fetchNoCatch,
        why: "On a flaky connection the page stays blank or half-loaded with no explanation.",
        ifNothing: "Users on poor connections see broken screens.",
        rationale: "A file that calls fetch with no catch anywhere in it has no failure path.",
        recommendation: "Handle failure for every request: show a retry state and keep the last good data.",
        task: "Add a failure path to every fetch() call: a visible error state with retry.",
        acceptance: ["Every fetch has error handling and a user-visible failure state."],
        context: ctx,
      }),
    );
  if (leakyTimers.length)
    out.push(
      finding({
        sectionId: "errors",
        rule: "listener-leak",
        title: "Timers and listeners that are never torn down",
        severity: "low",
        confidence: "medium",
        plain: "Some code starts timers or listeners and never stops them, so they keep running after the screen that needed them is gone.",
        technical: `${leakyTimers.length} file${leakyTimers.length === 1 ? "" : "s"} call setInterval/addEventListener with no clearInterval/removeEventListener.`,
        files: leakyTimers,
        why: "Leaked timers drain battery and cause duplicate actions (a timer that ticks twice as fast).",
        ifNothing: "Odd behaviour after navigating back and forth.",
        rationale: "Matched registration without any matching teardown in the same file.",
        recommendation: "Clear every interval and remove every listener when its owner unmounts or is replaced.",
        task: "Tear down every interval and event listener when its owner is destroyed.",
        acceptance: ["Each setInterval has a matching clearInterval and each addEventListener a matching removal."],
        context: ctx,
      }),
    );
  return out;
}

function engineering(root: string, files: string[], code: Src[], ctx: string): BaFinding[] {
  const out: BaFinding[] = [];
  const has = (re: RegExp) => files.some((f) => re.test(f));
  const pkg = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    } catch {
      return undefined;
    }
  })();
  if (!has(/^\.github\/workflows\/|^\.gitlab-ci\.yml$|^azure-pipelines|^\.circleci\//))
    out.push(
      finding({
        sectionId: "engineering",
        rule: "no-ci",
        title: "No continuous integration configuration",
        severity: "medium",
        absence: true,
        plain: "Nothing checks the code automatically when it changes, so a broken change is found by a person, later.",
        technical: "No .github/workflows, GitLab CI, Azure Pipelines or CircleCI configuration was found.",
        why: "Without CI, type errors and failing tests can reach the main branch unnoticed.",
        ifNothing: "Regressions are discovered by users.",
        rationale: "Looked for the standard CI configuration paths.",
        recommendation: "Add a CI workflow that installs, type-checks, lints, tests and builds on every push.",
        task: "Add a GitHub Actions workflow (.github/workflows/ci.yml) that runs install, typecheck, lint, test and build on push and pull request.",
        acceptance: ["The workflow runs every verification script in package.json.", "It uses the project's package manager and Node version."],
        context: ctx,
      }),
    );
  const tests = files.filter((f) => isTest(f) && !SKIP.test(f));
  if (!tests.length && code.length > 3)
    out.push(
      finding({
        sectionId: "engineering",
        rule: "no-tests",
        title: "No automated tests",
        severity: "medium",
        absence: true,
        plain: "There are no tests, so nothing proves the main flows still work after a change.",
        technical: `No *.test / *.spec files or tests/ folder among ${code.length} source files.`,
        why: "Each change has to be checked by hand, and some never are.",
        ifNothing: "Breakages ship.",
        rationale: "Searched for conventional test file names and folders.",
        recommendation: "Add tests for the core logic (state, routing, data loading) first, then the main user flows.",
        task: "Add a test suite (using the project's existing tooling, e.g. Vitest for Vite) covering state persistence, routing and content loading.",
        acceptance: ["A test script exists and passes.", "Core modules have at least one test each."],
        context: ctx,
      }),
    );
  if (pkg && !pkg.scripts?.typecheck && files.some((f) => f.endsWith("tsconfig.json")))
    out.push(
      finding({
        sectionId: "engineering",
        rule: "no-typecheck-script",
        title: "TypeScript project without a type-check script",
        severity: "low",
        plain: "The project is written in TypeScript but has no command that checks the types on their own.",
        technical: 'package.json has no "typecheck" script.',
        files: ["package.json"],
        why: "Bundlers often strip types without checking them, so type errors can ship.",
        ifNothing: "Type errors reach the build unnoticed.",
        rationale: "Read package.json scripts.",
        recommendation: 'Add "typecheck": "tsc --noEmit" and run it in CI.',
        task: 'Add a "typecheck" script ("tsc --noEmit") to package.json and fix any errors it reports.',
        acceptance: ["npm run typecheck passes."],
        context: ctx,
      }),
    );
  const big = code.filter((s) => CODE.test(s.rel) && s.text.split("\n").length > 600).map((s) => s.rel);
  if (big.length)
    out.push(
      finding({
        sectionId: "engineering",
        rule: "large-files",
        title: "Very large source files",
        severity: "low",
        plain: "A few files do too many things at once, which makes them hard to change safely.",
        technical: `${big.length} file${big.length === 1 ? " is" : "s are"} over 600 lines.`,
        files: big,
        why: "Large files collect unrelated changes and merge conflicts.",
        ifNothing: "Changes in these files get slower and riskier.",
        rationale: "Counted lines per file.",
        recommendation: "Split each by responsibility into smaller modules with clear names.",
        task: "Split the oversized files by responsibility without changing behaviour.",
        acceptance: ["No source file exceeds ~600 lines.", "Behaviour is unchanged."],
        context: ctx,
      }),
    );
  let anyCount = 0;
  const anyFiles: string[] = [];
  let todo = 0;
  for (const s of code) {
    const a = s.text.match(/:\s*any\b|as any\b/g);
    if (a && /\.tsx?$/.test(s.rel)) {
      anyCount += a.length;
      anyFiles.push(s.rel);
    }
    todo += (s.text.match(/\b(TODO|FIXME|HACK)\b/g) ?? []).length;
  }
  if (anyCount > 5)
    out.push(
      finding({
        sectionId: "engineering",
        rule: "any-types",
        title: "Type safety switched off with any",
        severity: "low",
        metrics: [{ value: anyCount, label: "uses of any" }],
        plain: "In several places the code tells TypeScript to stop checking, which hides mistakes.",
        technical: `${anyCount} uses of ": any" / "as any" across ${anyFiles.length} files.`,
        files: anyFiles,
        why: "Every any is a place where a wrong shape of data goes unnoticed.",
        ifNothing: "Data-shape bugs surface at runtime instead of at build time.",
        rationale: "Counted directly from the source.",
        recommendation: "Replace any with real types (or unknown plus a check).",
        task: "Replace uses of any with precise types or unknown with narrowing.",
        acceptance: ["No new any; the listed files type-check without it."],
        context: ctx,
      }),
    );
  if (todo > 0)
    out.push(
      finding({
        sectionId: "engineering",
        rule: "todo-markers",
        title: "Unfinished work marked in the code",
        severity: "informational",
        metrics: [{ value: todo, label: "TODO/FIXME" }],
        plain: "The code contains notes saying something still needs doing.",
        technical: `${todo} TODO/FIXME/HACK markers.`,
        why: "Each is a known gap someone decided to come back to.",
        ifNothing: "They are forgotten.",
        rationale: "Counted directly from the source.",
        recommendation: "Resolve each marker or move it to Launch readiness as a task.",
        task: "Resolve each TODO/FIXME/HACK marker or replace it with a tracked task.",
        acceptance: ["No unexplained TODO/FIXME markers remain."],
        context: ctx,
      }),
    );
  return out;
}

function dataPersistence(code: Src[], ctx: string): BaFinding[] {
  const out: BaFinding[] = [];
  const users = code.filter((s) => /localStorage\.(get|set)Item/.test(s.text));
  if (!users.length) return out;
  const unguarded = users.filter((s) => /JSON\.parse\(\s*localStorage/.test(s.text) && !/try\s*\{/.test(s.text)).map((s) => s.rel);
  if (unguarded.length)
    out.push(
      finding({
        sectionId: "data",
        rule: "unguarded-parse",
        title: "Saved data is read without protection against corruption",
        severity: "medium",
        plain: "If saved data is ever damaged or from an older version, the app crashes on load instead of recovering.",
        technical: `${unguarded.length} file${unguarded.length === 1 ? "" : "s"} JSON.parse localStorage without a try/catch.`,
        files: unguarded,
        why: "One bad value in storage can make the app unusable until the user clears site data.",
        ifNothing: "Users lose access to their saved work after an update.",
        rationale: "Matched JSON.parse of localStorage with no try block in the same file.",
        recommendation: "Wrap reads in try/catch, validate the shape, and fall back to defaults (keeping a backup of the bad value).",
        task: "Make every read of saved state safe: try/catch around JSON.parse, validate the shape, fall back to defaults.",
        acceptance: ["Corrupting the saved value in DevTools and reloading does not crash the app."],
        context: ctx,
      }),
    );
  const versioned = users.some((s) => /version|schema|v\d|migrat/i.test(s.text));
  if (!versioned)
    out.push(
      finding({
        sectionId: "data",
        rule: "unversioned-state",
        title: "Saved data has no version marker",
        severity: "low",
        absence: true,
        plain: "Nothing records which version of the app saved the data, so a future change to its shape cannot be migrated safely.",
        technical: `${users.length} file${users.length === 1 ? "" : "s"} use localStorage; none reference a version or migration.`,
        files: users.map((s) => s.rel),
        why: "The first change to the saved shape will break existing users' data.",
        ifNothing: "Updates silently discard or corrupt saved progress.",
        rationale: "Searched storage code for a version or migration marker.",
        recommendation: "Store a version with the data and migrate older shapes on load.",
        task: "Add a version field to saved state and a migration step on load.",
        acceptance: ["Saved state includes a version.", "Loading an older shape migrates it."],
        context: ctx,
      }),
    );
  return out;
}

// ───────────────────────── scoring ─────────────────────────

export const PENALTY: Record<Severity, number> = { critical: 35, high: 18, medium: 8, low: 3, informational: 0 };
function sectionScore(fs: BaFinding[]): number {
  const p = fs
    .filter((f) => !f.resolved)
    .map((f) => PENALTY[f.severity])
    .sort((a, b) => b - a)
    .reduce((sum, v, i) => sum + v * Math.pow(0.82, i), 0);
  return Math.max(0, Math.round(100 - p));
}
export const emptyCounts = (): Record<Severity, number> => ({ critical: 0, high: 0, medium: 0, low: 0, informational: 0 });
export const verdictFor = (s: number) => (s >= 85 ? "Strong" : s >= 70 ? "Workable" : s >= 50 ? "Needs work" : "At risk");

// ───────────────────────── run ─────────────────────────

// Reports are stored per scope: a project id, or "path:<hash>" for a folder scanned from Repo tools.
const storeKey = (id: string) => `ba:${id}`;
const resolvedKey = (id: string) => `baResolved:${id}`;

/** The storage scope of a folder scan: a hash of its canonical path (the path itself is kept in the report). */
export function folderScope(abs: string): string {
  return `path:${sha256(path.resolve(abs).toLowerCase()).slice(0, 16)}`;
}

/** What one analysis reads: a FlowCode project (with its runs and PRD) or a plain folder on disk. */
interface Target {
  scope: string;
  projectId: string;
  folder?: string;
  name: string;
  type: string;
  jail: PathJail;
  buildSection: Pick<BaSection, "examines" | "notExamined" | "status" | "scored">;
  buildHealth: (ctx: string, files: string[]) => BaFinding[];
  specSection: Pick<BaSection, "examines" | "status" | "scored">;
  spec: (ctx: string, files: string[], code: Src[]) => BaFinding[] | Promise<BaFinding[]>;
}

export async function runBuildAnalysis(app: App, projectId: string): Promise<BaReport> {
  const project = app.store.projects.require(projectId);
  return analyse(app, {
    scope: projectId,
    projectId,
    name: project.name,
    type: project.projectType ?? "unknown",
    jail: app.projects.jail(project),
    buildSection: { examines: "This build's own verification: type check, lint, tests, production build, preview, accessibility audit, spec fidelity, and blocked plan tasks.", notExamined: "Anything not yet run is reported as not run, never as passing.", status: "completed", scored: true },
    buildHealth: (ctx) => buildHealth(app, projectId, ctx),
    specSection: { examines: "Whether the identifiers, content and reference copy named in the PRD and reference files are present in the build.", status: "completed", scored: true },
    spec: (ctx) => specAdherence(app, projectId, ctx),
  });
}

/**
 * Build analysis of a folder that is not a FlowCode project (Repo tools). Only files are read: the repo's own
 * checks are not run, so Build health says "not run" and is left out of the score rather than counted as passing.
 * The folder must already be validated (see repoTools.validateScanFolder).
 */
export async function runFolderAnalysis(app: App, folder: { path: string; name: string }): Promise<BaReport> {
  const jail = new PathJail(folder.path);
  const prd = findPrd(flattenFiles(jail).filter((f) => !jail.isSecretPath(f)));
  return analyse(app, {
    scope: folderScope(folder.path),
    projectId: "",
    folder: folder.path,
    name: folder.name,
    type: detectPreflight("folder", jail.root).projectType,
    jail,
    buildSection: { examines: "Which verification commands the repo defines (type check, lint, tests, production build).", notExamined: "Their results: this scan reads files only and runs nothing, so every check is reported as not run, never as passing.", status: "not_run", scored: false },
    buildHealth: (ctx) => folderBuildHealth(jail.root, ctx),
    specSection: { examines: prd ? `Whether the identifiers named in ${prd} (keys, routes, file names in backticks) appear in the code.` : "Whether the identifiers named in a PRD appear in the code. No PRD-like file (prd*.md, product-requirements*.md) was found.", status: prd ? "completed" : "not_applicable", scored: !!prd },
    spec: (ctx, _files, code) => (prd ? folderSpec(jail.root, prd, code, ctx) : []),
  });
}

/** Build health for a folder scan: lists the checks the repo defines and says plainly that none were run. */
function folderBuildHealth(root: string, ctx: string): BaFinding[] {
  let scripts: Record<string, string> | undefined;
  try {
    scripts = (JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {};
  } catch {
    scripts = undefined;
  }
  const checks = Object.keys(scripts ?? {}).filter((k) => /^(typecheck|type-check|tsc|lint|test|tests|build)(:|$)/.test(k));
  return [
    finding({
      sectionId: "build",
      rule: "checks-not-run",
      title: "The repo's checks were not run",
      severity: "informational",
      metrics: [{ value: checks.length, label: checks.length === 1 ? "check script found" : "check scripts found" }],
      plain: "This scan only reads files. Type check, lint, tests and the production build were not run, so their results are unknown — not passing.",
      technical: checks.length ? `Check scripts in package.json: ${checks.join(", ")}. None were run by this scan.` : scripts ? "package.json defines no type check, lint, test or build script." : "No package.json was found, so no check commands were detected.",
      files: scripts ? ["package.json"] : [],
      why: "An unrun check and a passing check look the same on a quick read.",
      ifNothing: "Decisions about this repo rest on less evidence than they appear to.",
      rationale: "Read the scripts in package.json; nothing was executed.",
      recommendation: checks.length ? `Run the repo's own checks (${checks.map((c) => `npm run ${c}`).join(", ")}) and fix anything that fails.` : "Add type check, lint, test and build commands to the repo, run them, and fix anything that fails.",
      task: checks.length ? `Run the repo's verification scripts (${checks.join(", ")}) and fix anything that fails.` : "Add verification scripts (typecheck, lint, test, build) to package.json and make them pass.",
      acceptance: ["Type check, lint, tests and the production build each have a passing result."],
      context: ctx,
    }),
  ];
}

const PRD_FILE = /(^|\/)(prd|product[-_ ]?requirements?)([-_ .][^/]*)?\.md$/i;
/** The PRD-like file in a folder, if there is an obvious one (shortest path wins). */
function findPrd(files: string[]): string | undefined {
  return files.filter((f) => PRD_FILE.test(f) && !/(^|\/)node_modules\//.test(f)).sort((a, b) => a.length - b.length)[0];
}

/** Spec adherence for a folder: backticked identifiers in its PRD searched for in the source. */
function folderSpec(root: string, prd: string, code: Src[], ctx: string): BaFinding[] {
  let text = "";
  try {
    text = fs.readFileSync(path.join(root, prd), "utf8").slice(0, 400_000);
  } catch {
    return [];
  }
  // Identifiers worth searching for: keys, file names, routes (not prose words) — the launch checklist's rule.
  const ids = [...new Set([...text.matchAll(/`([^`\n]{3,80})`/g)].map((m) => m[1].trim()))].filter((c) => !/\s/.test(c) && (/[._#/:\-[\]{}()]|^[a-z]+[A-Z]|^\w+\d/.test(c) || c.length >= 5)).slice(0, 200);
  if (!ids.length) return [];
  const missing = ids.filter((c) => !code.some((s) => s.text.includes(c)));
  if (!missing.length) return [];
  return [
    finding({
      sectionId: "spec",
      rule: "spec-identifiers",
      title: `${missing.length} identifier${missing.length === 1 ? "" : "s"} named in the PRD ${missing.length === 1 ? "is" : "are"} not in the code`,
      severity: missing.length / ids.length > 0.3 ? "high" : "medium",
      confidence: "medium",
      metrics: [{ value: missing.length, label: "missing" }, { value: ids.length, label: "named in the PRD" }],
      plain: "The PRD names specific keys, routes and files. Some of them do not appear anywhere in the code, which usually means that part of the spec was not built or was built differently.",
      technical: `Not found in the source: ${missing.slice(0, 30).map((c) => `\`${c}\``).join(", ")}${missing.length > 30 ? ` and ${missing.length - 30} more` : ""}.`,
      files: [prd],
      why: "Each missing identifier is a place where the code and the PRD disagree.",
      ifNothing: "The code drifts from the spec, and anyone relying on the PRD gets something different.",
      rationale: `Backticked identifiers in ${prd} were searched for in the source files. Requirements worded without identifiers cannot be checked this way and are not counted.`,
      recommendation: "Implement each requirement as the PRD words it, using the exact identifiers it names — or update the PRD where the code is right.",
      task: `Bring the code into line with ${prd}. These identifiers it names are missing from the code:\n${missing.slice(0, 30).map((c) => `- ${c}`).join("\n")}`,
      acceptance: ["Every identifier the PRD names appears in the code, or the PRD is updated where it is out of date."],
      context: ctx,
    }),
  ];
}

async function analyse(app: App, t: Target): Promise<BaReport> {
  const { jail, scope } = t;
  const root = jail.root;
  const files = flattenFiles(jail).filter((f) => !jail.isSecretPath(f));
  const { code, read, skipped } = readSources(root, files);
  const type = t.type;
  const ctx = t.folder ? `Repository "${t.name}" (${type}).` : `Project "${t.name}" (${type}).`;
  const resolved = app.store.getSetting<Record<string, string>>(resolvedKey(scope), {});

  const a11y = staticAccessibility(jail);
  const ui = files.some((f) => /\.(html|tsx|jsx|vue|svelte)$/.test(f));
  const SECTIONS: Array<Omit<BaSection, "score" | "counts"> & { build: () => BaFinding[] | Promise<BaFinding[]> }> = [
    { id: "build", title: "Build health", ...t.buildSection, weight: 2, findings: [], build: () => t.buildHealth(ctx, files) },
    { id: "spec", title: "Spec adherence", notExamined: "Requirements worded without concrete identifiers; behaviour that needs the running app.", ...t.specSection, weight: 2, findings: [], build: () => t.spec(ctx, files, code) },
    { id: "errors", title: "Error handling & logs", examines: "Catch blocks that discard errors, console logging, network calls with no failure path, timers and listeners never torn down.", notExamined: "Whether any of it actually fails at runtime.", status: "completed", scored: true, weight: 1, findings: [], build: () => errorHandling(code, ctx) },
    { id: "engineering", title: "Engineering quality", examines: "Continuous integration, tests, type-check script, oversized files, use of any, unfinished-work markers.", notExamined: "Whether tests pass (see Build health for executed checks).", status: "completed", scored: true, weight: 1, findings: [], build: () => engineering(root, files, code, ctx) },
    { id: "security", title: "Security QA", examines: "Injection sinks, unsafe HTML, disabled TLS, wildcard CORS, tokens in storage, sensitive logging.", notExamined: "Deployed configuration, live credentials, dependency advisories.", status: "completed", scored: true, weight: 2, findings: [], build: () => fromAnalyser("security", securityTriage(jail), ctx, { plainPrefix: "A pattern in the code is a known way for an attacker to get in or for data to leak.", why: "Security problems are cheap to fix now and expensive after an incident.", ifNothing: "The weakness stays exploitable.", rationale: "Static pattern match; nothing was exploited or executed." }) },
    { id: "a11y", title: "Accessibility", examines: "Missing names and labels, keyboard reachability, focus visibility, alt text, heading order, landmarks.", notExamined: "Computed colour contrast and real screen-reader behaviour (see the browser audit in Build health).", status: ui ? "completed" : "not_applicable", scored: ui, weight: 1, findings: [], build: () => fromAnalyser("a11y", a11y, ctx, { plainPrefix: "Someone using a keyboard or a screen reader may be unable to use part of the product.", why: "What is at stake is whether a person who cannot use a mouse, or cannot see the screen, is shut out.", ifNothing: "Some people cannot use the product.", rationale: "Read from the markup and components." }) },
    { id: "seo", title: "SEO & link previews", examines: "Titles, descriptions, viewport, canonical, Open Graph and social cards, robots.txt and sitemap.", notExamined: "Ranking, traffic, and anything outside the repository.", status: ui ? "completed" : "not_applicable", scored: ui, weight: 1, findings: [], build: () => fromAnalyser("seo", seoTriage(jail), ctx, { plainPrefix: "Search engines and link previews read this page's metadata, and some of it is missing.", why: "Missing metadata makes shared links look broken and pages harder to find.", ifNothing: "Shared links show no title or image.", rationale: "Read from the HTML head." }) },
    { id: "compliance", title: "Compliance", examines: "Personal-data signals against privacy notice, consent, data deletion and licensing.", notExamined: "Legal advice; this is a product and engineering triage, not a certification.", status: "completed", scored: true, weight: 2, findings: [], build: () => fromAnalyser("compliance", complianceTriage(jail), ctx, { plainPrefix: "The product handles something regulated, and the matching safeguard was not found.", why: "Privacy and consent obligations apply from the first user.", ifNothing: "The product carries avoidable legal and trust risk.", rationale: "Inferred from code signals; confirm with whoever owns compliance." }) },
    { id: "design", title: "Design system", examines: "Raw colours and spacing outside tokens, inline styles, corner radius limits, missing loading/empty/error states.", notExamined: "Visual quality, which needs screenshots and a person's eye.", status: ui ? "completed" : "not_applicable", scored: ui, weight: 1, findings: [], build: () => fromAnalyser("design", designQa(jail), ctx, { plainPrefix: "Parts of the interface bypass the design system, so they will drift from the rest.", why: "Consistency is what makes a product feel finished.", ifNothing: "Every future restyle misses these places.", rationale: "Read from styles and components." }) },
    { id: "data", title: "Data & persistence", examines: "How saved data is read, protected against corruption and versioned for future changes.", notExamined: "Server databases (none are read).", status: code.some((s) => /localStorage/.test(s.text)) ? "completed" : "not_applicable", scored: true, weight: 1, findings: [], build: () => dataPersistence(code, ctx) },
  ];

  const sections: BaSection[] = [];
  for (const s of SECTIONS) {
    const { build, ...rest } = s;
    const found = rest.status !== "not_applicable" ? await build() : [];
    for (const f of found) if (resolved[f.key]) f.resolved = { at: resolved[f.key] };
    found.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
    const counts = emptyCounts();
    for (const f of found) if (!f.resolved) counts[f.severity]++;
    sections.push({ ...rest, findings: found, counts, score: rest.scored && rest.status === "completed" ? sectionScore(found) : undefined });
  }

  const all = sections.flatMap((s) => s.findings);
  const open = all.filter((f) => !f.resolved);
  const counts = emptyCounts();
  for (const f of open) counts[f.severity]++;
  const scoredSections = sections.filter((s) => s.score !== undefined);
  const wsum = scoredSections.reduce((a, s) => a + s.weight, 0);
  let overall = wsum ? Math.round(scoredSections.reduce((a, s) => a + s.score! * s.weight, 0) / wsum) : 100;
  // An average must not hide a build that cannot ship: cap the overall when the build itself is broken.
  const capNotes: string[] = [];
  if (open.some((f) => f.severity === "critical") && overall > 49) {
    overall = 49;
    capNotes.push("capped at 49 because a critical finding is open");
  }
  if (open.some((f) => ["build:check-build", "build:check-typecheck"].includes(f.key)) && overall > 69) {
    overall = 69;
    capNotes.push("capped at 69 because the production build or type check does not pass");
  }
  const label = (f: BaFinding) => `${sections.find((s) => s.id === f.sectionId)!.title}: ${f.title}`;
  const priority = open.filter((f) => f.severity === "critical" || f.severity === "high").slice(0, 6).map(label);
  const quickWins = open.filter((f) => f.sectionId !== "build" && f.sectionId !== "spec" && (f.severity === "medium" || f.severity === "low") && f.files.length <= 3 && !f.absence).slice(0, 5).map(label);
  const longerTerm = open.filter((f) => f.absence || ["no-ci", "no-tests", "large-files", "unversioned-state"].some((r) => f.key.endsWith(r))).slice(0, 5).map(label);
  const notVerified = [
    t.folder ? "Nothing in the folder was executed and nothing was changed or uploaded. The repo's own checks (type check, lint, tests, build) were not run." : "Nothing in the workspace was executed by this analysis; executed results come from the build's own checks (Build health).",
    ...sections.filter((s) => s.status === "completed").map((s) => `${s.title}: ${s.notExamined}`),
    ...sections.filter((s) => s.status === "not_run").map((s) => `${s.title}: not run. ${s.notExamined} It is left out of the score.`),
    ...sections.filter((s) => s.status === "not_applicable").map((s) => `${s.title}: not applicable to this ${t.folder ? "repo" : "project"}, so left out of the score rather than counted as zero.`),
  ];
  const worst = open[0];
  const major = open.filter((f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium");
  const reconcilePrompt = redact(
    [
      `Reconcile the major issues found by FlowCode's build analysis of "${t.name}" (${type}).`,
      "",
      "Work through them in this order, one at a time, re-running the project's checks after each:",
      "",
      ...major.map((f, i) => [`${i + 1}. [${f.severity.toUpperCase()}] ${label(f)}`, `   ${f.recommendation}`, ...(f.files.length ? [`   Files: ${f.files.slice(0, 6).join(", ")}`] : [])].join("\n")),
      "",
      "Constraints:",
      ...CONSTRAINTS.map((c) => `- ${c}`),
      "- The build must keep adhering to its spec (PRD and reference files in spec/ and src/content/).",
      "",
      "Acceptance criteria:",
      "- Each issue above is fixed, or explained in a code comment where it is intentional.",
      "- Type check, lint, tests and the production build pass.",
      "- Re-running Build analysis shows none of these findings.",
    ].join("\n"),
  );

  const prev = app.store.getSetting<BaReport[]>(storeKey(scope), []);
  const generatedAt = new Date().toISOString();
  const history = [...prev.map((r) => ({ at: r.generatedAt, score: r.overall })), { at: generatedAt, score: overall }].slice(-30);
  const resolvedCount = all.length - open.length;
  const report: BaReport = {
    id: `ba_${Date.now().toString(36)}`,
    projectId: t.projectId,
    ...(t.folder ? { folder: t.folder } : {}),
    projectName: t.name,
    projectType: type,
    generatedAt,
    filesRead: read,
    filesSkipped: skipped,
    overall,
    verdict: verdictFor(overall),
    counts,
    resolvedCount,
    summary: `${read.toLocaleString()} files were read and ${skipped.toLocaleString()} skipped. ${open.length} open finding${open.length === 1 ? "" : "s"} across ${sections.filter((s) => s.findings.some((f) => !f.resolved)).length} of ${sections.length} sections${worst ? `, the most severe being ${worst.severity}: ${worst.title}` : ""}. The overall score is ${overall} out of 100.`,
    scoreNote:
      `A weighted average of the sections that produced a score. Build health, spec adherence, security and compliance count double. Each section's score falls steeply over its first findings and more gently after. Sections that do not apply are left out rather than counted as zero, and findings marked resolved by hand are not counted (only a new analysis confirms the fix). An average cannot hide a build that cannot ship: the overall is capped at 49 while a critical finding is open, and at 69 while the production build or type check fails.${capNotes.length ? ` This run was ${capNotes.join(" and ")}.` : ""}`,
    sections,
    priority,
    quickWins,
    longerTerm,
    notVerified,
    reconcilePrompt,
    history,
  };
  // Keep the latest 12 full reports per project (or folder).
  app.store.setSetting(storeKey(scope), [...prev, report].slice(-12));
  return report;
}

/** The latest report for a scope: a project id, or folderScope(path) for a folder scan. */
export function latestBuildAnalysis(app: App, projectId: string): BaReport | undefined {
  const all = app.store.getSetting<BaReport[]>(storeKey(projectId), []);
  const r = all.at(-1);
  if (!r) return undefined;
  // Apply resolution marks made after the run.
  const resolved = app.store.getSetting<Record<string, string>>(resolvedKey(projectId), {});
  for (const s of r.sections) for (const f of s.findings) f.resolved = resolved[f.key] ? { at: resolved[f.key] } : undefined;
  return r;
}

/** Removes one past analysis from the score history (the current one stays: it is the report on screen). */
export function removeHistoryEntry(app: App, projectId: string, at: string) {
  const all = app.store.getSetting<BaReport[]>(storeKey(projectId), []);
  const latest = all.at(-1);
  if (!latest || latest.generatedAt === at) return latestBuildAnalysis(app, projectId);
  const kept = all.filter((r) => r.generatedAt !== at);
  for (const r of kept) r.history = r.history.filter((h) => h.at !== at);
  app.store.setSetting(storeKey(projectId), kept);
  return latestBuildAnalysis(app, projectId);
}

export function markResolved(app: App, projectId: string, key: string, resolvedFlag: boolean) {
  const all = app.store.getSetting<Record<string, string>>(resolvedKey(projectId), {});
  if (resolvedFlag) all[key] = new Date().toISOString();
  else delete all[key];
  app.store.setSetting(resolvedKey(projectId), all);
  return latestBuildAnalysis(app, projectId);
}


// ───────────────────────── Markdown and PDF ─────────────────────────
//
// The Markdown is the report; the PDF is rendered from that exact string (reportPdf/document.ts), with the cover and
// dividers drawn from buildAnalysisMeta, which reads the same report. So the .md and the .pdf cannot disagree.

const statusLabel = (s: BaSection) => (s.status === "completed" ? "Completed" : s.status === "not_run" ? "Not run" : "Not applicable");
/** The `## ` heading of a section. Shared by the Markdown and the meta: it is how the PDF finds the section's body. */
const sectionHeading = (s: BaSection) => `${s.title} — ${s.status === "not_run" ? "not run" : s.status === "not_applicable" ? "not applicable" : s.score !== undefined ? `${s.score}/100` : "no score"}`;
const sectionReason = (s: BaSection, folder: boolean) =>
  s.status === "not_run" ? "Not run: this scan reads files only, so these checks have no result — unknown, not passing. It is left out of the score." : s.status === "not_applicable" ? `Not applicable to this ${folder ? "repo" : "project"}, so it is left out of the score rather than counted as zero.` : undefined;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const bullets = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`) : ["*None.*"]);

function standfirst(r: BaReport): string {
  return r.folder
    ? "A reading of one repository: what was found, where it was found, why it matters, and what to do about it — with a prompt to reconcile each issue. Produced by reading files only; nothing was executed, changed or uploaded, and no request was made to any host."
    : "A reading of one build: what was found, where it was found, why it matters, and what to do about it — with a FlowCode prompt to reconcile each issue. Produced by reading files and the build's own verification records; nothing was executed and no request was made to any host.";
}

function findingMarkdown(f: BaFinding, n: number, folder: boolean): string[] {
  const out = [`#### ${n}. ${f.title}`, "", `**${SEVERITY_LABEL[f.severity]}** · Confidence: ${f.confidence}${f.absence ? " · Confirm before changing anything" : ""}`, ""];
  if (f.resolved) out.push(`> **Resolved by hand** ${f.resolved.at.slice(0, 16).replace("T", " ")}. Not counted towards the score; only a new analysis confirms the fix.`, "");
  if (f.metrics.length) out.push(`**Key figures.** ${f.metrics.map((m) => `${m.value.toLocaleString()} ${m.label}`).join(" · ")}`, "");
  out.push("##### What was found", "", f.plain, "");
  // Multi-line technical detail (blocked tasks, missing spec items) is a list, not one run-on paragraph.
  const tech = f.technical.split("\n").filter((l) => l.trim());
  if (tech.length > 1) out.push("**Technical detail.**", "", ...tech.map((l) => `- ${l.replace(/^•\s*/, "")}`), "");
  else out.push(`**Technical detail.** ${f.technical}`, "");
  out.push("##### Where it was found", "");
  if (f.files.length) out.push(...f.files.map((p) => `- \`${p}\``), "", `*All paths are relative to the ${folder ? "folder" : "project"} root.*`, "");
  else out.push("*Observed across the project rather than in specific files.*", "");
  out.push("##### Why it matters", "", f.why, "", `**If nothing is done.** ${f.ifNothing}`, "", `**Rationale.** ${f.rationale}`, "");
  out.push("##### Recommendations", "", f.recommendation, "");
  out.push("##### What to do", "", ...f.steps.map((s, i) => `${i + 1}. **${s.title}** ${s.text}`), "");
  out.push("##### FlowCode prompt", "", `**${f.prompt.title}**`, "", "```text", f.prompt.body, "```", "", `**Intended outcome.** ${f.outcome}`, "");
  return out;
}

export function buildAnalysisMarkdown(r: BaReport): string {
  const folder = !!r.folder;
  const out: string[] = [];
  out.push(`# ${r.projectName} — Build analysis`, "");
  out.push(
    folder ? `- **Folder** \`${r.folder}\`` : `- **Project** ${r.projectName}`,
    `- **Generated** ${r.generatedAt.slice(0, 16).replace("T", " ")}`,
    `- **Project type** ${r.projectType ?? "unknown"}`,
    `- **Files read** ${r.filesRead.toLocaleString()} read · ${r.filesSkipped.toLocaleString()} skipped`,
    `- **Overall health** ${r.overall} / 100 (${r.verdict})`,
    "",
  );
  out.push(`> ${standfirst(r)}`, "");
  if (folder) out.push(`> ${r.notVerified[0]}`, "");
  out.push("---", "");

  out.push("## Contents", "", "1. [Executive summary](#executive-summary)", "2. [Reconcile everything major](#reconcile-everything-major)", "3. [Report coverage and limitations](#report-coverage-and-limitations)");
  r.sections.forEach((s, i) => out.push(`${i + 4}. [${s.title}](#${anchor(sectionHeading(s))}) — ${statusLabel(s)}, ${s.score !== undefined ? `${s.score} / 100` : "no score"}, ${plural(s.findings.length, "finding")}`));
  out.push(`${r.sections.length + 4}. [Appendix](#appendix)`, "", "---", "");

  out.push("## Executive summary", "", r.summary, "", "### Overall health", "", `**${r.overall} / 100** (${r.verdict})`, "", `**How this score was calculated.** ${r.scoreNote}`, "");
  if (r.resolvedCount) out.push(`*${plural(r.resolvedCount, "finding has", "findings have")} been marked resolved by hand and ${r.resolvedCount === 1 ? "is" : "are"} not counted. Marking a finding resolved records that work was done; only a new analysis confirms it.*`, "");
  out.push("| Severity | Open findings |", "| --- | --- |", ...SEVERITIES.map((s) => `| ${SEVERITY_LABEL[s]} | ${r.counts[s]} |`), "");
  out.push("### Priority actions", "", ...bullets(r.priority), "", "### Quick wins", "", ...bullets(r.quickWins), "", "### Longer-term", "", ...bullets(r.longerTerm), "");

  out.push(
    "## Reconcile everything major",
    "",
    folder
      ? "One prompt covering every critical, high and medium finding, in order. Give it to the coding agent that works on this repository."
      : "One FlowCode prompt covering every critical, high and medium finding, in order. Send it to FlowCode from the project's chat (or the \"Send to FlowCode\" button in My Projects) to run it as a governed, reversible change.",
    "",
    "**Implement: reconcile build analysis findings**",
    "",
    "```text",
    r.reconcilePrompt,
    "```",
    "",
  );

  out.push("## Report coverage and limitations", "", "| Section | Status | Score | Findings |", "| --- | --- | --- | --- |");
  for (const s of r.sections) out.push(`| ${mdCell(s.title)} | ${statusLabel(s)} | ${s.score ?? "—"} | ${s.findings.length} |`);
  out.push("", "### What could not be verified", "", ...bullets(r.notVerified), "", "---", "");

  for (const s of r.sections) {
    const reason = sectionReason(s, folder);
    out.push(`## ${sectionHeading(s)}`, "", `**Status** ${statusLabel(s)} · **Score** ${s.score !== undefined ? `${s.score} / 100` : "no score"} · **Findings** ${s.findings.length}`, "");
    out.push(`**What this section examines.** ${s.examines}`, "", `**What it does not.** ${s.notExamined}`, "");
    if (reason) out.push(`> ${reason}`, "");
    const open = SEVERITIES.filter((v) => s.counts[v]).map((v) => `${s.counts[v]} ${v}`);
    if (s.findings.length) out.push(`${plural(s.findings.length, "finding")}: ${open.join(", ") || "all resolved"}.`, "");
    out.push("### Findings", "");
    if (!s.findings.length)
      out.push(s.status === "completed" ? "*No findings were produced. That is a statement about these checks and these files, not a guarantee that nothing is wrong.*" : "*None: this section was not assessed. Its absence here is not a clean result.*", "");
    s.findings.forEach((f, i) => out.push(...findingMarkdown(f, i + 1, folder)));
  }

  out.push("---", "", "## Appendix", "", "### Finding index", "");
  const all = r.sections.flatMap((s) => s.findings.map((f) => ({ s, f })));
  if (!all.length) out.push("*No findings were produced.*", "");
  else out.push("| Severity | Confidence | Section | Finding |", "| --- | --- | --- | --- |", ...all.map(({ s, f }) => `| ${SEVERITY_LABEL[f.severity]} | ${f.confidence} | ${mdCell(s.title)} | ${mdCell(f.title)}${f.resolved ? " (resolved by hand)" : ""} |`), "");
  out.push(
    "### Method",
    "",
    ...bullets([
      `${folder ? "Files were read inside the chosen folder" : "Files were read inside the project workspace"}; secret-like files (such as .env) were never opened.`,
      folder ? "Nothing was executed: no install, no build, no script, no test." : "Nothing was executed by the analysis; executed results come from the build's own stored verification records.",
      `${plural(r.filesRead, "file")} ${r.filesRead === 1 ? "was" : "were"} read; ${r.filesSkipped.toLocaleString()} ${r.filesSkipped === 1 ? "was" : "were"} skipped (dependencies, build output, very large files).`,
      "Findings are ordered by severity within each section. A finding marked \"Confirm before changing anything\" rests on something not being visible, which is not the same as it not existing.",
    ]),
    "",
  );
  const body = out.join("\n");
  return `${body}\n*Report content hash (sha256, first 16): ${sha256(body).slice(0, 16)}*\n`;
}

/** The cover and divider figures, from the same report the Markdown was written from. */
export function buildAnalysisMeta(r: BaReport): ReportMeta {
  const folder = !!r.folder;
  return {
    kind: "Build analysis",
    title: r.projectName,
    standfirst: standfirst(r),
    notice: folder ? r.notVerified[0] : undefined,
    credit: folder ? "FlowCode AI · Repo tools" : "FlowCode AI · My Projects",
    scoreLabel: "Overall health",
    overallScore: r.overall,
    verdict: r.verdict,
    counts: r.counts,
    facts: [
      { label: folder ? "Folder" : "Project", value: r.folder ?? r.projectName },
      { label: "Generated", value: r.generatedAt.slice(0, 16).replace("T", " ") },
      { label: "Project type", value: r.projectType ?? "unknown" },
      { label: "Files read", value: `${r.filesRead.toLocaleString()} read · ${r.filesSkipped.toLocaleString()} skipped` },
    ],
    generatedAt: r.generatedAt,
    sections: r.sections.map((s) => {
      const files = new Set(s.findings.flatMap((f) => f.files)).size;
      const resolved = s.findings.filter((f) => f.resolved).length;
      return {
        id: s.id,
        heading: sectionHeading(s),
        title: s.title,
        status: statusLabel(s),
        score: s.score ?? null,
        word: s.score !== undefined ? verdictFor(s.score) : statusLabel(s),
        findings: s.findings.length,
        counts: s.counts,
        examines: s.examines,
        limits: s.notExamined,
        metrics: [...(files ? [{ value: files.toLocaleString(), label: files === 1 ? "file cited" : "files cited" }] : []), ...(resolved ? [{ value: String(resolved), label: "resolved by hand" }] : [])],
        reason: sectionReason(s, folder),
      };
    }),
  };
}

/** The PDF's HTML (before printing). Kept for previews and tests. */
export function renderBuildAnalysisHtml(r: BaReport): string {
  return buildReportHtml(buildAnalysisMarkdown(r), buildAnalysisMeta(r)).html;
}

export async function buildAnalysisPdf(app: App, projectId: string): Promise<{ id: string; label: string }> {
  const r = latestBuildAnalysis(app, projectId) ?? (await runBuildAnalysis(app, projectId));
  return buildAnalysisReportPdf(app, `ba_${projectId}`, r);
}

/** PDF of a stored report (project or folder scan), saved as an artifact under runId. */
export function buildAnalysisReportPdf(app: App, runId: string, r: BaReport): Promise<{ id: string; label: string }> {
  return saveReportPdf(app, { runId, markdown: buildAnalysisMarkdown(r), meta: buildAnalysisMeta(r), label: `${r.projectName} build analysis (${r.generatedAt.slice(0, 10)})` });
}
