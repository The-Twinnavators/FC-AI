/**
 * Verification service (FR-V1, §13.1, Phase 7). Owns the verification matrix: each check runs a real
 * adapter (scripts, dev server, Playwright, axe, static analyzers) and stores evidence references.
 * Task acceptance criteria are evaluated here — independently of any agent claim.
 */
import { screenBriefKey, screenBriefNote, type ScreenBrief } from "../orchestrator/screenBrief.js";
import fs from "node:fs";
import path from "node:path";
import type { Finding, Run, Task, VerificationCheck, VerificationKind, VerificationStatus } from "@flowcode/contracts";
import { LIBRARY_SECTIONS } from "@flowcode/contracts";
import { pieceFiles, sectionFile } from "../orchestrator/sectionRecipes.js";
import { diagnosticsOf, type Diagnostic } from "../orchestrator/recoveryRouting.js";
import type { Store } from "../db/store.js";
import { renderSkills, selectSkills } from "../knowledge/skills.js";
import type { EventBus } from "../events/bus.js";
import type { ArtifactService } from "../db/artifacts.js";
import type { CommandRunner } from "../commands/runner.js";
import type { ProcessManager } from "../commands/processManager.js";
import type { ProjectService } from "../workspace/projects.js";
import type { ModelRouter } from "../models/router.js";
import { newId, nowIso } from "../util/ids.js";
import { staticAccessibility } from "./a11yStatic.js";
import { designQa } from "./designQa.js";
import { complianceTriage, securityTriage, seoTriage } from "./staticTriage.js";
import { BrowserSession, captureScreenshots, checkHealth, freePort, keyboardWalkthrough, LOOK_RULES, runAxe, schedulerSmokeTest } from "./preview.js";
import { analyzeHtml, compareFidelity, summarizeReference } from "./spec.js";
import type { ReferenceFile } from "@flowcode/contracts";
import { critiqueWithFallback, designCrit, lookReview, visionCritique } from "./critique.js";
import { demoAccount, lookCheck, type LookFinding } from "./lookCheck.js";
import { frameEvidence, frameRendered } from "./frameCheck.js";
import { isFrameSelector, resolveFrame } from "./appFrame.js";
import { dataSourceProblems, readGeneratedData } from "./appData.js";
import { appModelKey, prdNamedRecords, prdSampleSection, type AppModel } from "../orchestrator/appModel.js";
import { declaredScreens } from "../orchestrator/screenPlan.js";
import { journeyPlan, runJourney, type JourneyStep } from "./appJourney.js";
/** Whether the project has test files yet (a baseline runs the tests only once there are some to run). */
export function hasTestFiles(root: string): boolean {
  const walk = (dir: string): boolean => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    return entries.some((e) => (e.isDirectory() ? e.name !== "node_modules" && !e.name.startsWith(".") && walk(path.join(dir, e.name)) : /\.(test|spec)\.[jt]sx?$/.test(e.name)));
  };
  return walk(path.join(root, "src"));
}

/** Set by the step that writes the complete app (orchestrator/appFiles.ts appWrittenKey; not imported, to keep this module free of the app writer). */
const appWrittenKey = (runId: string) => `appWritten:${runId}`;
import { cleanupBlocking, cleanupReport, scanCleanup } from "./cleanupScan.js";
import { cloudCoder } from "../models/cloud.js";
import { directionBrief, type DesignDirection } from "../knowledge/designDirection.js";
import { designResearchBrief, researchKey, type DesignResearch } from "./designResearch.js";

/** Look rules about colour and composition, which the design steps own (not failures for a structure step). */
const VISUAL_RULES = new Set(["low-contrast", "small-targets", "repeated-controls", "repeated-empty-text", "sample-data-hidden", "contradictory-controls", "broken-image"]);
import { ReportService } from "../reports/report.js";
import { analyzeAppWiring } from "./appWiring.js";
import { routeCoverage } from "./routeCoverage.js";
import type { ScreenPlan } from "../orchestrator/screenPlan.js";
import type { GateResult } from "../orchestrator/completionGate.js";
import type { ArtifactRecord } from "../db/store.js";
import type { PreflightRecord } from "@flowcode/contracts";
import { previewArgv, runsWithoutNode, scriptArgv } from "../workspace/preflight.js";
import { squash, testFailureDigest } from "../orchestrator/guards.js";
import { parsePartTests } from "../orchestrator/stepRecovery.js";
import { runtimeOptions } from "../orchestrator/runtimeOptions.js";
import { assertionlessTests, runnableVerdict, seededRecords } from "../orchestrator/taskContract.js";
import type { SnapshotRow } from "../workspace/snapshots.js";

const SCRIPT_FOR: Partial<Record<VerificationKind, string>> = { typecheck: "typecheck", lint: "lint", tests: "test", build: "build" };

/**
 * A planned "contains" check written as a pattern ("pacific-foods.*bowl of clear vegetable broth"): every part, in
 * order, on one line (case aside). The literal text never matched, so a finished step failed 3 attempts in a row.
 */
export function wildcardLine(body: string, text: string): boolean {
  if (!text.includes(".*")) return false;
  const parts = text.split(".*").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length < 2) return false;
  return body.split("\n").some((line) => {
    const l = line.toLowerCase();
    let at = 0;
    for (const p of parts) {
      const i = l.indexOf(p, at);
      if (i < 0) return false;
      at = i + p.length;
    }
    return true;
  });
}

export interface CriteriaVerdict {
  allMet: boolean;
  failures: string[];
  evidenceRefs: string[];
  noProgress: boolean;
}

export class Verifier {
  readonly reports: ReportService;

  constructor(
    private store: Store,
    private bus: EventBus,
    private artifacts: ArtifactService,
    private runner: CommandRunner,
    private processes: ProcessManager,
    private projects: ProjectService,
    private router: ModelRouter,
  ) {
    this.reports = new ReportService(store, artifacts, projects, processes);
  }

  /** The prior content of a snapshot (set by the app), for checks that compare a step's files with how it found them. */
  priorOf?: (snap: SnapshotRow) => string | undefined;

  /**
   * Why a step's own deliverable isn't there (undefined when it is). Kinds from orchestrator/taskContract.ts:
   * changed:<a|b> (the step changed one of its files), images-used:<a|b|src> (they point at a photo in public/images),
   * data-seeded:<n> (a createCollection seeded with n records), frame-designed (ui-shell__ rules restyled, or a frame
   * component of the app's own).
   */
  deliverableProblem(kind: string, task: Task, root: string): string | undefined {
    const snaps = this.store.snapshots.where("task_id = ? ORDER BY seq ASC", task.id).filter((s) => !s.restoredAt);
    const read = (rel: string) => {
      try {
        return fs.readFileSync(path.join(root, rel), "utf8");
      } catch {
        return "";
      }
    };
    const srcFiles = (dir = "src", out: string[] = []): string[] => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
      } catch {
        return out;
      }
      for (const e of entries) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) srcFiles(rel, out);
        else if (/\.(tsx?|jsx?|css)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(rel);
      }
      return out;
    };
    if (kind.startsWith("changed:")) {
      const files = kind.slice("changed:".length).split("|");
      return snaps.some((s) => files.includes(s.relativePath.replace(/\\/g, "/"))) ? undefined : `this step hasn't changed ${files.join(" or ")}`;
    }
    if (kind.startsWith("images-used:")) {
      const list = kind.slice("images-used:".length);
      // No photos in the app: nothing to show (a calculator). Its only picture was the model's placeholder drawing,
      // and this check demanded the screen show it.
      let photos: string[] = [];
      try {
        photos = fs.readdirSync(path.join(root, "public/images")).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));
      } catch {
        photos = [];
      }
      if (!photos.length) return undefined;
      const files = list === "src" ? srcFiles() : list.split("|");
      const refs = files.flatMap((f) => [...read(f).matchAll(/["'(`]\/?(?:public\/)?(images\/[\w./-]+\.(?:jpe?g|png|webp|avif|svg))/gi)].map((m) => m[1]!));
      const real = refs.filter((r) => fs.existsSync(path.join(root, "public", r)));
      // Pictures that come from the records: the screen renders a record's picture field, and the records point at
      // files that exist (a composed grid shows them without naming any file itself).
      if (!real.length && recordPicturesShown(root, files.map(read).join("\n"))) return undefined;
      return real.length ? undefined : refs.length ? `${files.join(", ")} point at images that don't exist (${refs.slice(0, 3).join(", ")})` : `none of ${files.join(", ")} shows a photo from public/images`;
    }
    if (kind.startsWith("data-seeded:")) {
      const min = Number(kind.slice("data-seeded:".length)) || 8;
      const n = seededRecords(srcFiles().map(read).join("\n"));
      return n >= min ? undefined : `the largest createCollection holds ${n} record${n === 1 ? "" : "s"}, fewer than ${min}`;
    }
    if (kind.startsWith("piece-content:")) {
      // A library piece a screen renders still shows its demo (its SAMPLE block exactly as the library ships it):
      // Clean Cart's Home showed the Neobrutal landing's pottery studio ("Make something lumpy and love it anyway.").
      const sampleOf = (src: string) => /\/\/ flowcode:sample\n(const SAMPLE[\s\S]*?\n\};)/.exec(src)?.[1];
      const demos: string[] = [];
      for (const screen of kind.slice("piece-content:".length).split("|")) {
        for (const m of read(screen).matchAll(/import\s+([^;]*?)\s+from ["']\.\.\/sections\/(\w+)["']/g)) {
          const rel = `src/sections/${m[2]}.tsx`;
          const piece = LIBRARY_SECTIONS.find((x) => sectionFile(x.id) === rel);
          const src = read(rel);
          const mine = sampleOf(src);
          const lib = piece ? sampleOf(pieceFiles(piece.id)[0]?.content ?? "") : undefined;
          // Only what the screen takes from the piece and that shows the SAMPLE (its default export, or a named one
          // whose body uses it): the calculator imported Button from ButtonsVariants, never its demo, and was flagged.
          const names = m[1]!.includes("{") ? [...m[1]!.matchAll(/(\w+)(?:\s+as\s+\w+)?\s*[,}]/g)].map((x) => x[1]!) : [];
          const usesSample = (name: string) => {
            const at = src.search(new RegExp(`export\\s+(?:default\\s+)?(?:function|const)\\s+${name}\\b`));
            if (at < 0) return true;
            const rest = src.slice(at + 1);
            const end = rest.search(/\nexport\s/);
            // A use of SAMPLE, not its own definition (which sits between the exports).
            return /(?<!const\s)\bSAMPLE\b/.test(end < 0 ? rest : rest.slice(0, end));
          };
          const showsDemo = !m[1]!.trim().startsWith("{") || names.some(usesSample);
          if (showsDemo && mine && lib && mine === lib) demos.push(`${rel} (${piece!.name}: "${/title: "([^"]+)"/.exec(mine)?.[1] ?? "its demo"}")`);
        }
      }
      return demos.length ? `these library pieces still show their demo content: ${demos.join(", ")}. Replace each SAMPLE with this product's real content` : undefined;
    }
    // A complete app's records, in the source FlowCode generated (quality/appData.ts).
    if (kind.startsWith("images-complete:")) {
      const [entity, field] = kind.slice("images-complete:".length).split(".");
      const data = readGeneratedData(root);
      if (!data || !entity || !field) return "the app has no generated records (src/app/schema.ts with its schema and seed)";
      return imagesCompleteProblem(root, data.seed[entity] ?? [], entity, field);
    }
    if (kind === "data-source") {
      const data = readGeneratedData(root);
      if (!data) return "the app has no generated records (src/app/schema.ts with its schema and seed)";
      const refs = this.store.getSetting<Array<{ role: string; content: string }>>(`runRefs:${task.runId}`, []);
      const prd = refs.find((r) => r.role === "prd")?.content ?? "";
      const model = this.store.getSetting<{ lookup?: { entries: string; places: string; placesField: string } } | null>(appModelKey(task.runId), null);
      const problems = dataSourceProblems(data, prdNamedRecords(prdSampleSection(prd)), model?.lookup);
      return problems.length ? problems.slice(0, 6).join("; ") : undefined;
    }
    if (kind === "frame-designed") {
      const ev = this.frameEvidenceFor(task, root);
      return ev.ok ? undefined : ev.problem;
    }
    return `unknown check ${kind}`;
  }

  /**
   * The frame evidence this step left (quality/frameCheck.ts, part 1): each stylesheet it changed, before its first edit
   * and now, and the frame components it created with whether App.tsx renders them.
   */
  frameEvidenceFor(task: Task, root: string): ReturnType<typeof frameEvidence> {
    const snaps = this.store.snapshots.where("task_id = ? ORDER BY seq ASC", task.id).filter((s) => !s.restoredAt);
    const read = (rel: string) => {
      try {
        return fs.readFileSync(path.join(root, rel), "utf8");
      } catch {
        return "";
      }
    };
    const firstOf = new Map<string, (typeof snaps)[number]>();
    for (const s of snaps) {
      const rel = s.relativePath.replace(/\\/g, "/");
      if (!firstOf.has(rel)) firstOf.set(rel, s);
    }
    const cssChanges = [...firstOf.entries()].filter(([rel]) => /\.(css|scss)$/.test(rel)).map(([rel, s]) => ({ file: rel, before: s.contentHash === "absent" ? "" : (this.priorOf?.(s) ?? ""), now: read(rel) }));
    const app = read("src/App.tsx") + read("src/App.jsx");
    // The frame App.tsx renders (appFrame.ts), resolved from the app, not assumed to be the starter's AppShell.
    const resolved = resolveFrame(root);
    const frame = resolved ? { ...resolved, isFrame: (sel: string) => isFrameSelector(resolved, sel) } : undefined;
    const frameFileChanged = !!resolved && firstOf.has(resolved.file);
    const components = [...firstOf.entries()]
      .filter(([rel, s]) => /^src\/components\/(?!ui\/)[\w/-]+\.(tsx|jsx)$/.test(rel) && s.contentHash === "absent" && fs.existsSync(path.join(root, rel)))
      .map(([rel]) => {
        const stem = rel.replace(/^src\//, "").replace(/\.(tsx|jsx)$/, "");
        return { file: rel, rendered: new RegExp(`from\\s+["']\\.\\/${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(app) };
      });
    return frameEvidence(cssChanges, components, frame, frameFileChanged);
  }

  /**
   * The frame shows and its navigation works, in the browser (quality/frameCheck.ts, part 2): on the app's preview,
   * over the planned screens. Undefined when it passes; a reason when it doesn't or can't be checked (a check that
   * can't run never counts as passed).
   */
  async frameBrowserCheck(run: Run, task: Task, selectors: string[], signal?: AbortSignal): Promise<string | undefined> {
    const project = this.store.projects.require(run.projectId);
    const jail = this.projects.jail(project);
    const pf = this.projects.preflight(project.id, run.id);
    if (!pf.hasNodeModules) return "it couldn't be checked in the browser: the app's dependencies aren't installed";
    if (pf.previewStrategy === "none") return "it couldn't be checked in the browser: the project has no preview";
    const port = await freePort();
    const server = await this.runner.run({ jail, projectId: project.id, runId: run.id, taskId: task.id, phase: "preview", argv: previewArgv(pf, port), reason: `Start the dev server to check "${task.title}"'s app frame`, preflight: pf, signal, server: { readyPattern: /(Local:\s+https?:\/\/|ready in|started server on|Listening on)/i, readyTimeoutMs: 60_000 } });
    if (server.record.status !== "succeeded" || !server.serverProcId) return "it couldn't be checked in the browser: the dev server didn't start";
    const url = (server.serverUrl ?? `http://127.0.0.1:${port}/`).replace(/#.*$/, "");
    let session: BrowserSession | undefined;
    try {
      session = await BrowserSession.launch(run.id, this.processes);
      const page = await session.browser.newPage({ viewport: { width: 1280, height: 800 } });
      const routes = (this.store.getSetting<ScreenPlan | null>(`screenPlan:${run.id}`, null)?.screens ?? []).map((s) => s.id);
      const why = await frameRendered(page, async (route) => {
        await page.goto(route ? `${url}#/${route}` : url, { waitUntil: "load", timeout: 30_000 });
        await page.waitForTimeout(400);
      }, routes, selectors);
      this.record(run.id, "design_qa", why ? "failed" : "passed", why ? `Frame check on "${task.title}": ${why}` : `Frame check on "${task.title}": the frame shows and its navigation changes the screen`, [], { taskId: task.id });
      return why;
    } catch (err) {
      return `it couldn't be checked in the browser: ${(err as Error).message.slice(0, 160)}`;
    } finally {
      await session?.close().catch(() => undefined);
      if (server.serverProcId) await this.processes.killProcess(server.serverProcId).catch(() => undefined);
    }
  }

  /**
   * The app-model-derived browser journey (appJourney.ts) on the app's preview, recorded as the functional_journey
   * check: on the step that wrote the app when `taskId` is given (the functional baseline, which never counts as the
   * run's final check), else run-level (final verification, after design). Undefined when the run has no complete app.
   */
  async functionalJourney(run: Run, opts: { taskId?: string; signal?: AbortSignal } = {}): Promise<{ ok: boolean; steps: JourneyStep[]; artifactId?: string; summary: string } | undefined> {
    const model = this.store.getSetting<AppModel | null>(appModelKey(run.id), null);
    if (!model || !this.store.getSetting<boolean>(appWrittenKey(run.id), false)) return undefined;
    const project = this.store.projects.require(run.projectId);
    const jail = this.projects.jail(project);
    const pf = this.projects.preflight(project.id, run.id);
    const prd = this.store.getSetting<ReferenceFile[]>(`runRefs:${run.id}`, []).filter((r) => r.role === "prd").map((r) => r.content).join("\n\n");
    const plan = journeyPlan(model, declaredScreens(prd), prdNamedRecords(prdSampleSection(prd)));
    const fail = (why: string) => {
      const summary = `The journey couldn't run: ${why}`;
      this.record(run.id, "functional_journey", "failed", summary, [], { taskId: opts.taskId });
      return { ok: false, steps: [], summary };
    };
    if (!pf.hasNodeModules) return fail("the app's dependencies aren't installed");
    if (pf.previewStrategy === "none") return fail("the project has no preview");
    const port = await freePort();
    const server = await this.runner.run({ jail, projectId: project.id, runId: run.id, taskId: opts.taskId, phase: "preview", argv: previewArgv(pf, port), reason: "Start the dev server for the journey through the app", preflight: pf, signal: opts.signal, server: { readyPattern: /(Local:\s+https?:\/\/|ready in|started server on|Listening on)/i, readyTimeoutMs: 60_000 } });
    if (server.record.status !== "succeeded" || !server.serverProcId) return fail("the dev server didn't start");
    const url = (server.serverUrl ?? `http://127.0.0.1:${port}/`).replace(/#.*$/, "");
    let session: BrowserSession | undefined;
    try {
      session = await BrowserSession.launch(run.id, this.processes);
      const page = await session.browser.newPage({ viewport: { width: 1280, height: 860 } });
      const res = await runJourney(page, url, plan);
      const art = this.artifacts.save({ runId: run.id, kind: "log", label: opts.taskId ? "Functional baseline: journey through the app" : "Journey through the app", mime: "application/json", content: JSON.stringify({ plan, steps: res.steps }, null, 2), meta: { ok: res.ok, taskId: opts.taskId } });
      const failed = res.steps.filter((s) => !s.ok);
      const summary = `${res.steps.length - failed.length}/${res.steps.length} journey steps passed${failed.length ? `; failed: ${failed.slice(0, 3).map((s) => `${s.step} (${s.detail})`).join("; ")}` : ""}`;
      this.record(run.id, "functional_journey", res.ok ? "passed" : "failed", summary, [`artifact:${art.id}`], { taskId: opts.taskId });
      return { ...res, artifactId: art.id, summary };
    } catch (err) {
      return fail((err as Error).message.slice(0, 160));
    } finally {
      await session?.close().catch(() => undefined);
      if (server.serverProcId) await this.processes.killProcess(server.serverProcId).catch(() => undefined);
    }
  }

  /** Upserts the run-level check of a kind (or task-level when taskId is given). */
  record(runId: string, kind: VerificationKind, status: VerificationStatus, summary: string, evidenceRefs: string[], opts: { taskId?: string; required?: boolean } = {}): VerificationCheck {
    const run = this.store.runs.get(runId);
    const existing = this.store.checks.where("run_id = ? AND kind = ?", runId, kind).find((c) => c.taskId === opts.taskId);
    const check: VerificationCheck = {
      id: existing?.id ?? newId("chk"),
      runId,
      taskId: opts.taskId,
      kind,
      required: opts.required ?? !!run?.strategy?.requiredChecks.includes(kind),
      status,
      evidenceRefs,
      summary,
      updatedAt: nowIso(),
    };
    this.store.checks.upsert(check);
    this.bus.emit({
      type: status === "running" ? "verification.started" : "verification.completed",
      projectId: run?.projectId,
      runId: run ? runId : undefined,
      taskId: opts.taskId,
      message: `${kind}: ${status}${summary ? ` — ${summary}` : ""}`,
      data: { checkId: check.id, kind, status },
      level: status === "failed" || status === "blocked" ? "warning" : "info",
    });
    return check;
  }

  /** Output of the latest script check per run and kind (for comparing against the run's starting errors). */
  private lastOutput = new Map<string, string>();

  /**
   * Runs the type check, lint and tests once before a run changes anything, and remembers which already fail and
   * with which errors. A step is then judged on whether it adds errors, not on errors that were there before it.
   */
  async captureBaseline(run: Run, signal?: AbortSignal): Promise<Array<{ kind: string; errors: number }>> {
    const key = `runBaseline:${run.id}`;
    if (this.store.getSetting<Record<string, unknown> | null>(key, null)) return [];
    const base: Record<string, { passed: boolean; errors: string[] }> = {};
    const failing: Array<{ kind: string; errors: number }> = [];
    for (const kind of ["typecheck", "lint", "tests"] as VerificationKind[]) {
      const chk = await this.runScriptCheck(run, kind, signal, `baseline:${run.id}`);
      if (chk.status === "not_run" || chk.status === "blocked") continue;
      const passed = chk.status === "passed" || chk.status === "passed_with_warnings";
      const errors = passed ? [] : errorSignatures(this.lastOutput.get(`${run.id}:${kind}`) ?? "");
      base[kind] = { passed, errors };
      if (!passed) failing.push({ kind, errors: errors.length });
    }
    this.store.setSetting(key, base);
    return failing;
  }

  /**
   * Type errors an edit just added (compared with the start of the run), for the agent to fix in the same turn.
   * Without this, an unused import or a name used before it was declared only surfaced when the agent claimed
   * "done", turns later, and steps ran out of attempts. Not recorded as a verification; returns [] when the project
   * has no type check or it can't run.
   */
  async newTypeErrors(run: Run, signal?: AbortSignal, paths: string[] = [], taskId?: string): Promise<string[]> {
    const project = this.store.projects.require(run.projectId);
    const pf = this.projects.latestPreflight(project.id);
    if (!pf) return [];
    const edited = (re: RegExp) => paths.some((p) => re.test(p));
    let script = pf.scripts.find((s) => s.name === SCRIPT_FOR.typecheck) ?? pf.scripts.find((s) => s.classification === "typecheck");
    // A Python edit is checked with the project's Python type check (mypy), or at least compiled for syntax errors;
    // a TypeScript type check says nothing about a .py file.
    if (edited(/\.py$/i) && !edited(/\.(tsx?|jsx?|mts|cts)$/i) && !(script && runsWithoutNode(script))) {
      const py = paths.filter((p) => /\.py$/i.test(p) && !/[\s"'`$]/.test(p));
      if (!py.length) return [];
      const argv = [process.platform === "win32" ? "python" : "python3", "-m", "py_compile", ...py];
      script = { name: "py_compile", command: argv.join(" "), classification: "typecheck", policy: "auto", reasons: [], argv };
    }
    if (!script || (!runsWithoutNode(script) && (!pf.manifestValid || !pf.hasNodeModules))) return [];
    const res = await this.runner.run({
      jail: this.projects.jail(project),
      projectId: project.id,
      runId: run.id,
      phase: "verification",
      argv: scriptArgv(pf, script),
      reason: "Quick type check after an edit",
      preflight: pf,
      timeoutMs: Math.min(project.settings.commandTimeoutMs, 90_000),
      outputCapBytes: project.settings.outputCapBytes,
      maxSameFingerprint: 1000,
      signal,
    });
    if (res.record.status === "succeeded") return [];
    const step = taskId ? this.store.getSetting<StepBaseline | null>(stepBaselineKey(taskId), null)?.typecheck : undefined;
    if (step) return attributeDiagnostics(step.errors, errorLines(res.output)).introduced;
    const start = this.store.getSetting<Record<string, { passed: boolean; errors: string[] }> | null>(`runBaseline:${run.id}`, null)?.typecheck;
    const known = new Set(start?.errors ?? []);
    return errorLines(res.output).filter((l) => !known.has(signature(l)));
  }

  /**
   * The type check and lint errors as they are now, run directly (no check record, no repeat guard), kept as the step's
   * baseline when it starts: what it is judged against (checkCriteria, newTypeErrors). Re-taken when a step starts
   * over from its first attempt (a reopened step), never between attempts, so an earlier attempt's errors stay its own.
   */
  async captureStepBaseline(run: Run, taskId: string, signal?: AbortSignal): Promise<StepBaseline> {
    const now = await this.captureDiagnostics(run, signal);
    const out: StepBaseline = { at: new Date().toISOString() };
    for (const k of ["typecheck", "lint"] as const) if (now[k]) out[k] = { passed: now[k]!.passed, errors: now[k]!.lines.map(signature), ...(now[k]!.located?.length ? { located: now[k]!.located } : {}) };
    this.store.setSetting(stepBaselineKey(taskId), out);
    return out;
  }

  /** The type check and lint as they are now: whether each passed and its error lines. Nothing is recorded. */
  async captureDiagnostics(run: Run, signal?: AbortSignal): Promise<{ typecheck?: { passed: boolean; lines: string[]; located?: Diagnostic[] }; lint?: { passed: boolean; lines: string[]; located?: Diagnostic[] } }> {
    const project = this.store.projects.require(run.projectId);
    const pf = this.projects.latestPreflight(project.id);
    const out: { typecheck?: { passed: boolean; lines: string[]; located?: Diagnostic[] }; lint?: { passed: boolean; lines: string[]; located?: Diagnostic[] } } = {};
    if (pf && (pf.manifestValid && pf.hasNodeModules)) {
      for (const kind of ["typecheck", "lint"] as const) {
        const cls = kind;
        const script = pf.scripts.find((s) => s.name === SCRIPT_FOR[kind]) ?? pf.scripts.find((s) => s.classification === cls);
        if (!script) continue;
        const res = await this.runner.run({
          jail: this.projects.jail(project),
          projectId: project.id,
          runId: run.id,
          phase: "verification",
          argv: scriptArgv(pf, script),
          reason: `Diagnostics before this step (its baseline): ${kind}`,
          preflight: pf,
          timeoutMs: Math.min(project.settings.commandTimeoutMs, 120_000),
          outputCapBytes: project.settings.outputCapBytes,
          maxSameFingerprint: 1000,
          signal,
        });
        if (res.record.status === "succeeded") out[kind] = { passed: true, lines: [] };
        else if (res.record.status === "failed") out[kind] = { passed: false, lines: errorLines(res.output), located: diagnosticsOf(res.output).filter((d) => d.file) };
      }
    }
    return out;
  }

  /** A script check (type check, lint, build, tests) recorded on a step: the functional baseline's technical checks. */
  async scriptCheck(run: Run, kind: VerificationKind, taskId: string, signal?: AbortSignal): Promise<VerificationCheck> {
    return this.runScriptCheck(run, kind, signal, taskId);
  }

  private async runScriptCheck(run: Run, kind: VerificationKind, signal?: AbortSignal, taskId?: string): Promise<VerificationCheck> {
    const project = this.store.projects.require(run.projectId);
    const pf = this.projects.latestPreflight(project.id) ?? this.projects.preflight(project.id, run.id);
    const cls = kind === "tests" ? "test" : kind;
    const script = pf.scripts.find((s) => s.name === SCRIPT_FOR[kind]) ?? pf.scripts.find((s) => s.classification === cls);
    if (!script) return this.record(run.id, kind, "not_run", `No ${kind} script in package.json`, [], { taskId });
    if (!runsWithoutNode(script) && !pf.manifestValid) return this.record(run.id, kind, "blocked", "Manifest invalid; package-manager commands blocked", [], { taskId });
    if (!runsWithoutNode(script) && !pf.hasNodeModules) return this.record(run.id, kind, "blocked", "Dependencies not installed", [], { taskId });
    const label = script.argv ? script.command : `npm run ${script.name}`;
    this.record(run.id, kind, "running", label, [], { taskId });
    const res = await this.runner.run({
      jail: this.projects.jail(project),
      projectId: project.id,
      runId: run.id,
      taskId,
      phase: "verification",
      argv: scriptArgv(pf, script),
      reason: `Verification: ${kind}`,
      preflight: pf,
      timeoutMs: project.settings.commandTimeoutMs,
      outputCapBytes: project.settings.outputCapBytes,
      maxSameFingerprint: project.settings.maxSameFingerprintAttempts,
      signal,
    });
    const r = res.record;
    this.lastOutput.set(`${run.id}:${kind}`, res.output);
    // A Python tool the project declares but hasn't installed: say so, rather than failing the step for it.
    const missingTool = /No module named (\S+)/.exec(res.output);
    if (r.status !== "succeeded" && runsWithoutNode(script) && missingTool && script.argv?.includes(missingTool[1].replace(/['"]/g, "")))
      return this.record(run.id, kind, "not_run", `${missingTool[1].replace(/['"]/g, "")} isn't installed in this Python environment (install it to get this check)`, [`command:${r.id}`], { taskId });
    const warn = r.status === "succeeded" && /\bwarning\b/i.test(res.output) && kind === "lint";
    const status: VerificationStatus = r.status === "succeeded" ? (warn ? "passed_with_warnings" : "passed") : r.status === "blocked" || r.status === "awaiting_approval" ? "blocked" : "failed";
    // ESLint prints the file on a line of its own, so its first error line alone names no file (Frameproof main build:
    // "635:21 error …" sent the correction step to other files): that file goes first, on its own line, as ESLint has it.
    const rawErr = res.output.split("\n").find((l) => /error|fail|✖|×/i.test(l))?.trim().slice(0, 200);
    const located = r.status === "succeeded" ? undefined : diagnosticsOf(res.output).find((d) => d.file && d.kind === "lint");
    const firstErr = located && rawErr && !rawErr.includes(located.file!) && rawErr.startsWith(`${located.line}:`) ? `${located.file}\n${rawErr}` : rawErr;
    // The other errors too, a few lines' worth: the first alone hid two of the Frameproof Gallery's three type errors
    // (a missing import and props the component doesn't take) from its correction.
    const others = r.status === "succeeded" ? [] : errorLines(res.output).filter((l) => !firstErr?.includes(l.slice(0, 120)));
    const more = others.length ? `\n${others.slice(0, 4).map((l) => l.slice(0, 200)).join("\n")}${others.length > 4 ? `\n(and ${others.length - 4} more)` : ""}` : "";
    return this.record(run.id, kind, status, r.status === "succeeded" ? `${label} exited 0 in ${r.durationMs}ms` : `${label} ${r.status}${firstErr ? `: ${firstErr}` : ""}${more}`, [`command:${r.id}`], { taskId });
  }

  /** Runs the project's test script on one test file (`npm run test -- <file>`), recorded as a tests check. */
  async runTestFileCheck(run: Run, file: string, signal?: AbortSignal, taskId?: string): Promise<VerificationCheck> {
    const project = this.store.projects.require(run.projectId);
    const pf = this.projects.latestPreflight(project.id) ?? this.projects.preflight(project.id, run.id);
    const script = pf.scripts.find((s) => s.name === SCRIPT_FOR.tests) ?? pf.scripts.find((s) => s.classification === "test");
    if (!script) return this.record(run.id, "tests", "not_run", "No test script in package.json", [], { taskId });
    if (!fs.existsSync(path.join(this.projects.jail(project).root, file))) return this.record(run.id, "tests", "failed", `${file} doesn't exist yet: write the acceptance tests first`, [], { taskId });
    if (!pf.hasNodeModules) return this.record(run.id, "tests", "blocked", "Dependencies not installed", [], { taskId });
    const res = await this.runner.run({
      jail: this.projects.jail(project),
      projectId: project.id,
      runId: run.id,
      taskId,
      phase: "verification",
      argv: [...scriptArgv(pf, script), "--", file],
      reason: `Verification: acceptance tests in ${file}`,
      preflight: pf,
      timeoutMs: project.settings.commandTimeoutMs,
      outputCapBytes: project.settings.outputCapBytes,
      maxSameFingerprint: project.settings.maxSameFingerprintAttempts,
      signal,
    });
    const r = res.record;
    // "No test files found" or zero tests is not a pass: the step's tests must exist and run.
    const ran = /Tests?\s+\d+\s+passed/i.test(res.output) && !/no test files found/i.test(res.output);
    const status: VerificationStatus = r.status === "succeeded" && ran ? "passed" : r.status === "blocked" || r.status === "awaiting_approval" ? "blocked" : "failed";
    const failing = res.output.split("\n").filter((l) => /(?:✗|×|FAIL)\s/.test(l)).slice(0, 6).map((l) => l.trim()).join("; ");
    return this.record(run.id, "tests", status, status === "passed" ? `${file}: all acceptance tests pass` : `${file}: ${!ran && r.status === "succeeded" ? "no tests ran" : failing || r.status}`, [`command:${r.id}`], { taskId });
  }

  /** Evaluates a task's acceptance criteria from evidence (FR-V2, §10.3). */
  async checkCriteria(run: Run, task: Task, opts: { signal?: AbortSignal; only?: (c: Task["acceptanceCriteria"][number]) => boolean } = {}): Promise<CriteriaVerdict> {
    const jail = this.projects.jail(run.projectId);
    const failures: string[] = [];
    const evidenceRefs: string[] = [];
    let noProgress = false;
    const criteria = [...task.acceptanceCriteria];
    // Planner-written criteria are often shallow ("file exists"). A code task must also leave the project
    // compiling: once dependencies are installed and a typecheck script exists, require it implicitly.
    if (!opts.only && (task.role === "coder" || task.role === "debugger") && !criteria.some((c) => c.check.type === "verification" && c.check.kind === "typecheck")) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(jail.root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
        if (pkg.scripts?.typecheck && fs.existsSync(path.join(jail.root, "node_modules"))) criteria.push({ id: "auto-typecheck", description: "The project still type-checks after this task", check: { type: "verification", kind: "typecheck" }, evidenceRefs: [] });
      } catch {
        /* no package.json: nothing to add */
      }
    }
    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      // Only some criteria (revalidation checks a step's own deliverable): the rest keep their last result.
      if (opts.only && !opts.only(c)) continue;
      let met = false;
      const refs: string[] = [];
      switch (c.check.type) {
        case "file_exists": {
          try {
            met = fs.existsSync(jail.resolve(c.check.path, { allowSecret: false }).abs);
            // A plan that named "src/…/Thing.js" in a TypeScript project is met by Thing.tsx / Thing.ts.
            if (!met && /^src\/.+\.jsx?$/.test(c.check.path)) {
              const stem = c.check.path.replace(/\.jsx?$/, "");
              met = [".tsx", ".ts"].some((ext) => fs.existsSync(jail.resolve(stem + ext, { allowSecret: false }).abs));
            }
          } catch {
            met = false;
          }
          refs.push(`file:${c.check.path}`);
          if (!met) failures.push(`${c.description}: ${c.check.path} does not exist`);
          break;
        }
        case "file_contains":
        case "file_not_contains": {
          // Planners often write a removal as "file contains X" ("Dark mode block removed: contains @media …").
          // Read the check by what it says: removal wording means the text must be gone.
          const mustNotContain = c.check.type === "file_not_contains" || isRemovalWording(c.description);
          let has = false;
          let where = c.check.path;
          try {
            const p = jail.resolve(c.check.path).abs;
            const text = c.check.text;
            const found = (body: string) => !!body && (body.includes(text) || (squash(text).length >= 3 && squash(body).includes(squash(text))) || wildcardLine(body, text));
            const read = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
            // Spacing isn't knowable in advance ("--x: teal" vs "--x:teal"), so compare with whitespace removed too.
            has = found(read(p));
            // "Contains" checks find the work where it really is (only for adding, never for removals):
            if (!has && !mustNotContain) {
              const other = sameScreenFiles(p).find((f) => found(read(f)) || usesKitClass(read(f), text, jail.root));
              const kit = usesKitClass(read(p), text, jail.root);
              if (kit) has = true;
              else if (other) (has = true), (where = path.relative(jail.root, other).split(path.sep).join("/"));
            }
          } catch {
            has = false;
          }
          met = mustNotContain ? !has : has;
          refs.push(`file:${where}`);
          if (!met) failures.push(mustNotContain ? `${c.description}: ${c.check.path} still contains "${c.check.text}" (it should be removed)` : `${c.description}: ${c.check.path} does not contain "${c.check.text}"`);
          break;
        }
        case "verification": {
          // A step's own deliverable (orchestrator/taskContract.ts deliverableChecks): what it changed, the photos its
          // screens show, its seeded sample data, its app frame. Read from the workspace and the step's own snapshots.
          // "baseline:<check>": one of the functional baseline's technical checks, judged as it is now, with no allowance
          // for errors there when the step started (those are exactly what a baseline correction is there to fix).
          if (c.check.kind.startsWith("baseline:")) {
            const k = c.check.kind.slice("baseline:".length) as VerificationKind;
            if (k === "tests" && !hasTestFiles(jail.root)) {
              met = true;
              break;
            }
            const chk = await this.runScriptCheck(run, k, opts.signal, task.id);
            met = chk.status === "passed" || chk.status === "passed_with_warnings";
            refs.push(...chk.evidenceRefs);
            if (!met) failures.push(`${c.description}: ${chk.summary}`);
            break;
          }
          // "functional-journey": the journey through the app (appJourney.ts), run on this step (a baseline correction).
          if (c.check.kind === "functional-journey") {
            const j = await this.functionalJourney(run, { taskId: task.id, signal: opts.signal });
            met = !!j?.ok;
            if (!met) failures.push(`${c.description}: ${j?.summary ?? "the run has no written app model"}`);
            break;
          }
          if (/^(changed:|images-used:|images-complete:|data-seeded:|data-source$|piece-content:|frame-designed$)/.test(c.check.kind)) {
            let why = this.deliverableProblem(c.check.kind, task, jail.root);
            // The frame: that it changed (above), then that it shows and its navigation works, in the browser.
            if (!why && c.check.kind === "frame-designed") {
              const ev = this.frameEvidenceFor(task, jail.root);
              why = ev.ok ? await this.frameBrowserCheck(run, task, ev.selectors, opts.signal) : ev.problem;
            }
            met = !why;
            if (why) failures.push(`${c.description}: ${why}`);
            break;
          }
          // "tests-run:<file>": a test-writing step's tests load and run, and each one checks the app (orchestrator/
          // taskContract.ts). Failing assertions are expected until later steps build what they check; a test that
          // can't load, is parked, compares a value with itself or checks nothing is not.
          if (c.check.kind.startsWith("tests-run:")) {
            const own = c.check.kind.slice("tests-run:".length);
            const abs = path.join(jail.root, own);
            const src = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
            const parked = parkedTests(abs);
            const fake = selfComparingTests(abs);
            const empty = assertionlessTests(src);
            if (!src) failures.push(`${c.description}: ${own} doesn't exist yet`);
            else if (parked.length) failures.push(`${c.description}: these tests are parked (it.todo or .skip), so they check nothing; write each one out:\n${parked.slice(0, 8).map((t) => `- ${t}`).join("\n")}`);
            else if (fake.length) failures.push(`${c.description}: these tests compare a value with itself and prove nothing; make each one check the app:\n${fake.slice(0, 5).join("\n")}`);
            else if (empty.length) failures.push(`${c.description}: these tests have no expect(…), so they pass whatever the app does:\n${empty.slice(0, 8).map((t) => `- ${t}`).join("\n")}`);
            if (failures.length) {
              met = false;
              break;
            }
            const chk = await this.runTestFileCheck(run, own, opts.signal, task.id);
            refs.push(...chk.evidenceRefs);
            const cmd = chk.evidenceRefs[0] ? this.store.commands.get(chk.evidenceRefs[0].replace("command:", "")) : undefined;
            const v = runnableVerdict(cmd?.outputPreview ?? chk.summary);
            met = v.runs;
            if (met) refs.push(`note:${v.passed + v.failed} tests run; ${v.failed} fail until later steps build what they check`);
            else failures.push(`${c.description}: the file doesn't run (${v.why}). Fix the test file so it loads: import only what the testing packet lists, and use only names you define.${cmd?.outputPreview ? `\n--- test output ---\n${testReport(cmd.outputPreview)}` : ""}`);
            break;
          }
          // "tests:<file>": a step's own acceptance tests, written from the PRD, run on their own.
          if (c.check.kind.startsWith("tests:")) {
            // A test that compares a value with itself proves nothing (Calculator app: expect("standalone display")
            // .toBe("standalone display")): the step isn't done while its tests contain one.
            // "tests:<file>::<title>||<title>" is one part of a split step: only its own tests must pass
            // (orchestrator/stepRecovery.ts partTestsKind); the last part runs the whole file.
            const { file: own, titles } = parsePartTests(c.check.kind);
            // Parked tests (todo/skip) prove nothing: a part checks its own, the whole step checks them all.
            const parked = parkedTests(path.join(jail.root, own)).filter((t) => !titles?.length || titles.includes(t));
            if (parked.length) {
              met = false;
              failures.push(`${c.description}: these acceptance tests are parked (it.todo or .skip), so they check nothing. Write each one out so it drives the screen and checks the result the PRD asks for, then make it pass:\n${parked.slice(0, 8).map((t) => `- ${t}`).join("\n")}`);
              break;
            }
            const fake = selfComparingTests(path.join(jail.root, own));
            if (fake.length) {
              met = false;
              failures.push(`${c.description}: these tests compare a value with itself and prove nothing; make each one check the app instead:\n${fake.slice(0, 5).join("\n")}`);
              break;
            }
            const chk = await this.runTestFileCheck(run, own, opts.signal, task.id);
            met = chk.status === "passed" || chk.status === "passed_with_warnings";
            refs.push(...chk.evidenceRefs);
            if (!met && titles?.length) {
              const cmd = chk.evidenceRefs[0] ? this.store.commands.get(chk.evidenceRefs[0].replace("command:", "")) : undefined;
              const out = (cmd?.outputPreview ?? "").replace(/\x1b\[[0-9;]*m/g, "");
              const ran = /Tests?\s+\d+\s+(passed|failed)/i.test(out);
              const failingLines = out.split(/\r?\n/).filter((l) => /^\s*(?:×|✗|FAIL)\s/.test(l));
              const mineFailing = titles.filter((t) => failingLines.some((l) => l.includes(t)));
              // Only when every failure is visible: the stored output can be shortened, and a part must never pass on a
              // failure that was cut off.
              const failedCount = Number(/Tests?\s+(\d+)\s+failed/i.exec(out)?.[1] ?? NaN);
              const testLines = failingLines.filter((l) => l.includes(" > "));
              const allVisible = Number.isFinite(failedCount) && new Set(testLines.map((l) => l.trim())).size >= failedCount;
              if (ran && chk.status === "failed" && allVisible && !mineFailing.length) {
                met = true;
                break;
              }
              failures.push(`${c.description}: ${mineFailing.length ? `these tests of this part fail:\n${mineFailing.map((t) => `- ${t}`).join("\n")}` : chk.summary}${cmd?.outputPreview ? `\n--- test output ---\n${testReport(cmd.outputPreview)}` : ""}`);
              break;
            }
            if (met && titles?.length) break;
            if (!met) {
              const cmd = chk.evidenceRefs[0] ? this.store.commands.get(chk.evidenceRefs[0].replace("command:", "")) : undefined;
              failures.push(`${c.description}: ${chk.summary}${cmd?.outputPreview ? `\n--- test output ---\n${testReport(cmd.outputPreview)}` : ""}`);
              break;
            }
            // No step may break what earlier steps proved: every acceptance test written so far must still pass
            // (Calculator app: step 12 renamed the keys and 10 of step 1's 15 tests failed, unnoticed).
            const folder = path.posix.dirname(own) + "/";
            const others = fs.existsSync(path.join(jail.root, folder)) ? fs.readdirSync(path.join(jail.root, folder)).filter((f) => /\.test\.tsx?$/.test(f) && `${folder}${f}` !== own) : [];
            // An earlier step's tests left parked would never fail here either: they must be written out too.
            const parkedEarlier = others.flatMap((f) => parkedTests(path.join(jail.root, folder, f)).map((t) => `${f}: ${t}`));
            if (parkedEarlier.length) {
              met = false;
              failures.push(`Earlier steps' acceptance tests in ${folder} are parked (it.todo or .skip), so they check nothing. Write each one out so it drives the screen and checks what the PRD asks for, and make the app pass it:\n${parkedEarlier.slice(0, 10).map((t) => `- ${t}`).join("\n")}`);
              break;
            }
            if (others.length) {
              const all = await this.runTestFileCheck(run, folder, opts.signal, task.id);
              refs.push(...all.evidenceRefs);
              if (all.status !== "passed" && all.status !== "passed_with_warnings") {
                met = false;
                const cmd = all.evidenceRefs[0] ? this.store.commands.get(all.evidenceRefs[0].replace("command:", "")) : undefined;
                failures.push(
                  `This step's tests pass, but earlier steps' acceptance tests in ${folder} now fail: fix the app so they pass again. Change an earlier test only where the PRD requires the new behaviour (for example key names the PRD gives for screen readers), and say why in your summary.${cmd?.outputPreview ? `\n--- test output ---\n${testReport(cmd.outputPreview)}` : ""}`,
                );
              }
            }
            break;
          }
          const kind = c.check.kind as VerificationKind;
          if (failures.some((f) => !f.startsWith("Check"))) {
            failures.push(`${c.description}: not run because earlier criteria failed`);
            break;
          }
          const chk = kind === "app_wiring" ? this.appWiringCheck(run, task.id) : kind === "code_cleanup" ? this.cleanupCheck(run, task.id) : await this.runScriptCheck(run, kind, opts.signal, task.id);
          met = chk.status === "passed" || chk.status === "passed_with_warnings";
          refs.push(...chk.evidenceRefs);
          // Judged against the errors there when this step started (its step baseline; the run's start when there is
          // none): errors already there are inherited, not this step's; every other error is this step's, whichever
          // file it is in (a changed prop or export breaks its untouched callers: Clean Cart's App.tsx onNavigate).
          const start = this.store.getSetting<StepBaseline | null>(stepBaselineKey(task.id), null)?.[kind as "typecheck" | "lint"] ?? this.store.getSetting<Record<string, { passed: boolean; errors: string[] }> | null>(`runBaseline:${run.id}`, null)?.[kind];
          let onlyNew: string[] | undefined;
          // "Not rerun: no file changed since it failed 3× with these errors" carries the same errors, so it's judged
          // like a failure. Calendar test 6: the week view step's own file was clean, but the repeat guard's "blocked"
          // skipped the scoped check below, so the step blocked itself and invalidated five later steps.
          const ran = chk.evidenceRefs[0]?.startsWith("command:") ? this.store.commands.get(chk.evidenceRefs[0].replace("command:", "")) : undefined;
          // The repeat guard's record carries the failure's fingerprint and no output of its own (a policy block has
          // neither): matching only "No progress" in its output never matched, so known errors failed a clean step.
          const failedLike = chk.status === "failed" || (chk.status === "blocked" && (!!ran?.errorFingerprint || /No progress/i.test(ran?.outputPreview ?? "")));
          if (!met && failedLike && start && !start.passed) {
            const now = errorLines(this.lastOutput.get(`${run.id}:${kind}`) ?? "");
            const a = attributeDiagnostics(start.errors, now);
            onlyNew = a.introduced;
            if (now.length && !a.introduced.length) {
              // Not this step's: it passes this check, and the errors stay on record. Excluding them from the step
              // doesn't fix them: the run's own checks still run on the whole project and still fail on them.
              met = true;
              refs.push(`note:no new ${kind} errors since this step started; ${a.inherited.length} inherited (there before it), ${a.resolved} resolved. The app isn't healthy until the inherited ones are fixed.`);
              const inherited = this.store.getSetting<Record<string, string[]> | null>(`inheritedErrors:${run.id}`, null) ?? {};
              inherited[kind] = [...new Set([...(inherited[kind] ?? []), ...a.inherited])].slice(0, 200);
              this.store.setSetting(`inheritedErrors:${run.id}`, inherited);
            }
          }
          if (!met && onlyNew?.length) {
            const elsewhere = [...new Set(onlyNew.map((l) => errorFile(l)).filter((f): f is string => !!f && !this.stepFiles(task).has(f)))];
            failures.push(`Check ${kind} failed with ${onlyNew.length} error${onlyNew.length === 1 ? "" : "s"} that weren't there when this step started${elsewhere.length ? ` (including in ${elsewhere.slice(0, 4).join(", ")}, which use what this step changed: update those uses or keep what they rely on)` : ""}; errors already there before it are not this step's:\n${onlyNew.slice(0, 12).join("\n")}`);
            break;
          }
          if (!met) {
            const cmd = chk.evidenceRefs[0] ? this.store.commands.get(chk.evidenceRefs[0].replace("command:", "")) : undefined;
            if (cmd?.status === "blocked" && /No progress/i.test(cmd.outputPreview ?? "") ) noProgress = true;
            failures.push(`Check ${kind} ${chk.status}: ${chk.summary}${cmd?.outputPreview ? `\n--- output tail ---\n${cmd.outputPreview.slice(-1500)}` : ""}`);
          }
          break;
        }
        case "manual":
          met = true;
          break;
      }
      criteria[i] = { ...c, met, evidenceRefs: refs };
      evidenceRefs.push(...refs);
    }
    this.store.tasks.upsert({ ...this.store.tasks.require(task.id), acceptanceCriteria: criteria });
    return { allMet: failures.length === 0, failures, evidenceRefs, noProgress };
  }

  /** Is everything the agents built reachable from the app's entry point (and the starter placeholder gone)? */
  /** The files a step owns: what it changed (any attempt) and what it planned (a planned .js counts as its .ts/.tsx). */
  stepFiles(task: { id: string; expectedPaths: string[] }): Set<string> {
    const files = new Set<string>();
    // Files the step created (and still has). Editing another step's file doesn't make it this step's: that's how
    // the month view step kept owning, and failing on, older screens it had tried to repair. FlowCode's own
    // housekeeping renames at the step's start (fc_…) and undone changes don't count either.
    for (const s of this.store.snapshots.where("task_id = ?", task.id))
      if (!s.restoredAt && s.contentHash === "absent" && !(s.toolCallId ?? "").startsWith("fc_")) files.add(s.relativePath.replace(/\\/g, "/"));
    for (const p of task.expectedPaths) {
      const rel = p.replace(/\\/g, "/").replace(/^\.\//, "");
      files.add(rel);
      if (/\.jsx?$/.test(rel)) for (const ext of [".tsx", ".ts"]) files.add(rel.replace(/\.jsx?$/, ext));
    }
    return files;
  }

  /** The clean-up step's check: nothing left that nothing uses (files, root scratch files, debug calls). */
  cleanupCheck(run: Run, taskId?: string): VerificationCheck {
    const full = scanCleanup(this.projects.jail(this.store.projects.require(run.projectId)));
    // A part of the clean-up step (split by files) is judged only on what's left in its own files; the other parts,
    // and the run's own final scan, cover the rest. Kids cash app: the CSS part was blocked three times on an unused
    // screen file it wasn't allowed to delete.
    const task = taskId ? this.store.tasks.get(taskId) : undefined;
    const part = !!task && !!this.store.getSetting<string>(`splitParent:${task.id}`, "") && task.expectedPaths.length > 0 && task.expectedPaths.every((p) => /\.[a-z0-9]+$/i.test(p));
    const own = (f: string) => !part || task!.expectedPaths.some((p) => p.replace(/\\/g, "/") === f.replace(/\\/g, "/"));
    const scan: typeof full = part
      ? { unusedFiles: full.unusedFiles.filter(own), strayFiles: full.strayFiles.filter(own), debugCalls: full.debugCalls.filter((d) => own(d.file)), unusedClasses: full.unusedClasses.filter((c) => own(c.file)), unusedImages: full.unusedImages.filter(own), badCredits: full.badCredits.filter((b) => own(b.file)) }
      : full;
    const art = this.artifacts.save({ runId: run.id, kind: "other", label: "Clean-up scan", mime: "application/json", content: JSON.stringify(scan, null, 2) });
    const left = cleanupBlocking(scan);
    const summary = left ? cleanupReport({ ...scan, unusedClasses: [] }).replace(/^FlowCode's clean-up scan found:\n/, "Still to remove: ").slice(0, 900) : scan.unusedClasses.length ? `Clean: nothing unused left; ${scan.unusedClasses.length} CSS class(es) look unused` : "Clean: nothing unused left";
    return this.record(run.id, "code_cleanup", left ? "failed" : scan.unusedClasses.length ? "passed_with_warnings" : "passed", summary, [`artifact:${art.id}`], { taskId });
  }

  appWiringCheck(run: Run, taskId?: string): VerificationCheck {
    const jail = this.projects.jail(this.store.projects.require(run.projectId));
    const w = analyzeAppWiring(jail);
    // The pages this build planned: each in the navigation, reachable, and built (not left as the laid-out slots).
    // Only once the screens are meant to be done: the final checks, or a step that finishes the design.
    const plan = this.store.getSetting<ScreenPlan | null>(`screenPlan:${run.id}`, null);
    const task = taskId ? this.store.tasks.get(taskId) : undefined;
    const routes = plan?.screens.length && (!task || /^(Polish|Assemble)/i.test(task.title)) ? routeCoverage(jail.root, plan) : undefined;
    const status = routes?.status === "failed" ? "failed" : w.status;
    const summary = routes ? `${w.summary}. ${routes.summary}` : w.summary;
    const art = this.artifacts.save({ runId: run.id, kind: "other", label: "App wiring (reachability from the entry point)", mime: "application/json", content: JSON.stringify({ ...w, routes }, null, 2) });
    return this.record(run.id, "app_wiring", status, summary, [`artifact:${art.id}`], { taskId });
  }

  /** Runs the run's required verification matrix (and optional QA checks) with real adapters. */
  async runRequired(run: Run, opts: { signal?: AbortSignal; skipRuntime?: boolean } = {}) {
    const required = new Set(run.strategy?.requiredChecks ?? []);
    const project = this.store.projects.require(run.projectId);
    const jail = this.projects.jail(project);
    const pf = this.projects.preflight(project.id, run.id);
    // Prototypes: no security, privacy or SEO scans and no full accessibility audit (orchestrator/prototype.ts).
    const compliance = false;
    this.record(run.id, "project_preflight", pf.projectType === "incomplete" ? "blocked" : "passed", `${pf.projectType}; ${pf.packageManager}; ${pf.scripts.length} scripts`, [`preflight:${pf.id}`]);
    if (pf.detectedTypes.includes("node_package")) this.record(run.id, "manifest_validation", pf.manifestValid ? "passed" : "failed", pf.manifestValid ? "package.json valid" : pf.manifestErrors.join("; "), [`preflight:${pf.id}`]);
    if (required.has("install") && !this.store.checks.where("run_id = ? AND kind = 'install'", run.id).some((c) => c.status === "passed")) {
      this.record(run.id, "install", pf.hasNodeModules ? "passed_with_warnings" : "not_run", pf.hasNodeModules ? "node_modules present; no install record in this run" : "No approved install record", pf.hasNodeModules ? [`preflight:${pf.id}`] : []);
    }
    if (opts.skipRuntime) {
      for (const k of required) {
        if (["project_preflight", "manifest_validation", "install", "final_report"].includes(k)) continue;
        const existing = this.store.checks.where("run_id = ? AND kind = ?", run.id, k).find((c) => !c.taskId);
        if (!existing || existing.status === "pending" || existing.status === "running") this.record(run.id, k, "blocked", "Blocked prerequisite task; downstream verification invalidated", []);
      }
      this.staticQa(run, jail, compliance);
      return;
    }
    for (const kind of ["typecheck", "lint", "tests", "build"] as VerificationKind[]) {
      if (opts.signal?.aborted) return;
      const pfHas = pf.scripts.some((s) => s.name === SCRIPT_FOR[kind] || s.classification === (kind === "tests" ? "test" : kind));
      if (required.has(kind) || pfHas) await this.runScriptCheck(run, kind, opts.signal);
    }
    if (required.has("app_wiring") || ["src/App.tsx", "src/App.jsx"].some((f) => fs.existsSync(path.join(jail.root, f)))) this.appWiringCheck(run);
    const qa = this.staticQa(run, jail, compliance);
    const needsBrowser = ["server_start", "preview_health", "screenshots", "accessibility", "design_qa", "visual_critique"].some((k) => required.has(k as VerificationKind)) && pf.previewStrategy !== "none";
    // The full accessibility audit (axe and the keyboard walk-through) runs for a Compliance build, and whenever the run's
    // strategy requires the accessibility check: a required check is always recorded (a prototype's strategy leaves it out,
    // prototype.ts). Before, a strategy that required it never got a record (phase7 reference-scheduler test).
    const fullA11y = compliance || required.has("accessibility");
    if (needsBrowser && !opts.signal?.aborted) await this.browserChecks(run, pf.previewStrategy, qa, opts.signal, fullA11y);
    else if (required.has("accessibility")) this.finishAccessibility(run, qa.a11y, undefined, undefined);
    // A complete app: the journey through it again, after design (the baseline on the step that wrote it doesn't count here).
    if (!opts.signal?.aborted && (required.has("functional_journey") || this.store.getSetting<boolean>(appWrittenKey(run.id), false))) {
      const res = await this.functionalJourney(run, { signal: opts.signal });
      if (!res && required.has("functional_journey")) this.record(run.id, "functional_journey", "failed", "The journey couldn't run: the run has no written app model", []);
    }
  }

  /** Static QA. The security, privacy and SEO scans aren't recorded for prototype builds (orchestrator/prototype.ts). */
  private staticQa(run: Run, jail: ReturnType<ProjectService["jail"]>, full = true) {
    const a11y = staticAccessibility(jail);
    const design = designQa(jail, { maxRadiusPx: undefined });
    if (!full) return { a11y, design, security: [] as Finding[], compliance: [] as Finding[], seo: [] as Finding[], artifacts: undefined };
    const security = securityTriage(jail);
    const compliance = complianceTriage(jail);
    const seo = seoTriage(jail);
    const save = (kind: string, findings: Finding[]) =>
      this.artifacts.save({ runId: run.id, kind: "other", label: `${kind} findings`, mime: "application/json", content: JSON.stringify(findings, null, 2), meta: { findings: findings.length, category: kind } });
    const secArt = save("security", security);
    const secSerious = security.filter((f) => f.severity === "critical" || f.severity === "serious");
    this.record(run.id, "security_scan", secSerious.length ? "passed_with_warnings" : "passed", `${security.length} static finding(s) (${secSerious.length} serious+); manual validation required`, [`artifact:${secArt.id}`]);
    const compArt = save("compliance", compliance);
    this.record(run.id, "compliance_triage", compliance.length ? "passed_with_warnings" : "passed", `${compliance.length} signal(s); engineering triage, not legal advice`, [`artifact:${compArt.id}`]);
    const seoArt = save("seo", seo);
    this.record(run.id, "seo", seo.some((f) => f.severity === "serious") ? "passed_with_warnings" : "passed", `${seo.length} metadata note(s)`, [`artifact:${seoArt.id}`]);
    return { a11y, design, security, compliance, seo, artifacts: { security: secArt, compliance: compArt, seo: seoArt } };
  }

  private finishAccessibility(run: Run, staticFindings: Finding[], axe: Awaited<ReturnType<typeof runAxe>> | undefined, walk: Awaited<ReturnType<typeof keyboardWalkthrough>> | undefined) {
    const all = [...staticFindings, ...(axe?.findings ?? [])];
    const art = this.artifacts.save({ runId: run.id, kind: "axe", label: "Accessibility findings", mime: "application/json", content: JSON.stringify({ static: staticFindings, axe: axe?.raw, keyboard: walk }, null, 2), meta: { static: staticFindings.length, axe: axe?.findings.length ?? 0 } });
    const blocking = all.filter((f) => (f.severity === "critical" || f.severity === "serious") && f.confidence !== "low");
    const keyboardIssue = walk && (!walk.allControlsReachable || walk.missingFocusIndicator.length > 0);
    const status: VerificationStatus = blocking.length ? "failed" : all.length || keyboardIssue ? "passed_with_warnings" : "passed";
    this.record(
      run.id,
      "accessibility",
      status,
      `${axe ? `axe: ${axe.findings.length} violation(s) (${Object.entries(axe.counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ") || "none"}), ${axe.passes} passes` : "no browser preview"}; static: ${staticFindings.length}${walk ? `; keyboard: ${walk.stops.length} stops${walk.missingFocusIndicator.length ? `, ${walk.missingFocusIndicator.length} without visible focus` : ""}` : ""}. Automated checks only — not a WCAG conformance claim.`,
      [`artifact:${art.id}`],
    );
  }

  private async browserChecks(run: Run, strategy: string, qa: ReturnType<Verifier["staticQa"]>, signal?: AbortSignal, compliance = true) {
    const project = this.store.projects.require(run.projectId);
    const jail = this.projects.jail(project);
    const pf = this.projects.latestPreflight(project.id)!;
    if (!pf.hasNodeModules) {
      for (const k of ["server_start", "preview_health", "screenshots"] as VerificationKind[]) this.record(run.id, k, "blocked", "Dependencies not installed", []);
      if (compliance) this.finishAccessibility(run, qa.a11y, undefined, undefined);
      return;
    }
    const port = await freePort();
    const argv = previewArgv({ ...pf, previewStrategy: strategy as PreflightRecord["previewStrategy"] }, port);
    this.record(run.id, "server_start", "running", argv.join(" "), []);
    const server = await this.runner.run({
      jail,
      projectId: project.id,
      runId: run.id,
      phase: "preview",
      argv,
      reason: "Start the local dev server for preview verification",
      preflight: pf,
      signal,
      server: { readyPattern: /(Local:\s+https?:\/\/|ready in|started server on|Listening on)/i, readyTimeoutMs: 60_000 },
    });
    const url = server.serverUrl ?? `http://127.0.0.1:${port}/`;
    if (server.record.status !== "succeeded" || !server.serverProcId) {
      this.record(run.id, "server_start", "failed", `Dev server did not become ready (${server.record.status})`, [`command:${server.record.id}`]);
      for (const k of ["preview_health", "screenshots"] as VerificationKind[]) this.record(run.id, k, "blocked", "Server did not start", []);
      if (compliance) this.finishAccessibility(run, qa.a11y, undefined, undefined);
      return;
    }
    this.record(run.id, "server_start", "passed", `Dev server ready at ${url.replace(/\/$/, "")}`, [`command:${server.record.id}`]);
    let session: BrowserSession | undefined;
    try {
      session = await BrowserSession.launch(run.id, this.processes);
      const health = await checkHealth(session, url);
      const healthArt = this.artifacts.save({ runId: run.id, kind: "log", label: "Preview health", mime: "application/json", content: JSON.stringify(health, null, 2) });
      this.record(run.id, "preview_health", health.ok ? (health.consoleErrors.length ? "passed_with_warnings" : "passed") : "failed", health.ok ? `HTTP ${health.status}, rendered "${health.title}" in ${health.loadMs}ms${health.consoleErrors.length ? `, ${health.consoleErrors.length} console error(s)` : ""}` : `Preview unhealthy: ${[...health.pageErrors, ...health.consoleErrors].slice(0, 2).join("; ") || `HTTP ${health.status}`}`, [`artifact:${healthArt.id}`, `command:${server.record.id}`]);
      this.bus.emit({ type: "preview.ready", projectId: project.id, runId: run.id, message: `Preview ${health.ok ? "healthy" : "unhealthy"}`, data: { ok: health.ok } });

      const isScheduler = run.strategy?.templateId === "react-vite-scheduler" && run.strategy.kind === "template_build";
      // Screenshots with one sample event so list layouts are exercised (empty-state screenshot is captured by the smoke test).
      const shots = await captureScreenshots(session, url);
      const shotRefs: string[] = [];
      const overflow: string[] = [];
      for (const s of shots) {
        const art = this.artifacts.save({ runId: run.id, kind: "screenshot", label: `Screenshot ${s.name} (${s.width}px)`, mime: "image/png", content: s.png, meta: { viewport: s.name, width: s.width, overflow: s.horizontalOverflow } });
        shotRefs.push(`artifact:${art.id}`);
        if (s.horizontalOverflow) overflow.push(`${s.name}: ${s.overflowingElements.join(", ")}`);
        this.bus.emit({ type: "screenshot.captured", projectId: project.id, runId: run.id, message: `Screenshot captured: ${s.name} ${s.width}px${s.horizontalOverflow ? " (horizontal overflow)" : ""}`, data: { artifactId: art.id } });
      }
      this.record(run.id, "screenshots", "passed", `${shots.length} viewports (${shots.map((s) => `${s.name} ${s.width}px`).join(", ")})`, shotRefs);

      if (isScheduler) {
        const smoke = await schedulerSmokeTest(session, url);
        const smokeArt = this.artifacts.save({ runId: run.id, kind: "log", label: "Scheduler smoke test (create/edit/delete/persistence)", mime: "application/json", content: JSON.stringify(smoke.steps, null, 2), meta: { ok: smoke.ok } });
        const refs = [`artifact:${smokeArt.id}`];
        for (const s of smoke.screenshots) refs.push(`artifact:${this.artifacts.save({ runId: run.id, kind: "screenshot", label: `Flow: ${s.name}`, mime: "image/png", content: s.png }).id}`);
        const existingTests = this.store.checks.where("run_id = ? AND kind = 'tests'", run.id).find((c) => !c.taskId);
        const unitOk = existingTests && (existingTests.status === "passed" || existingTests.status === "passed_with_warnings");
        this.record(
          run.id,
          "tests",
          smoke.ok && unitOk ? "passed" : smoke.ok || unitOk ? "failed" : "failed",
          `unit tests: ${existingTests?.status ?? "not_run"}; smoke flow: ${smoke.steps.filter((s) => s.ok).length}/${smoke.steps.length} steps passed${smoke.ok ? "" : ` — failed at "${smoke.steps.find((s) => !s.ok)?.step}": ${smoke.steps.find((s) => !s.ok)?.detail}`}`,
          [...(existingTests?.evidenceRefs ?? []), ...refs],
        );
      }

      // Spec fidelity: every word, link and form field of each reference HTML page must survive the build.
      const htmlRefs = this.store.getSetting<ReferenceFile[]>(`runRefs:${run.id}`, []).filter((r) => r.role === "html");
      if (htmlRefs.length) {
        const page = await session.browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
        await page.waitForTimeout(500);
        // Render-time DOM including form values; details/hidden sections count as present.
        const renderedHtml = await page.evaluate(() => {
          document.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
          return document.documentElement.outerHTML;
        });
        await page.close();
        const rendered = analyzeHtml(renderedHtml);
        const results = htmlRefs.map((r) => ({ name: r.name, ...compareFidelity(analyzeHtml(r.content), rendered) }));
        const art = this.artifacts.save({ runId: run.id, kind: "other", label: "Spec fidelity (reference HTML vs built app)", mime: "application/json", content: JSON.stringify(results, null, 2) });
        const worst = Math.min(...results.map((r) => r.wordCoverage));
        const lostLinks = results.reduce((n, r) => n + r.missingLinks.length, 0);
        const lostFields = results.reduce((n, r) => n + r.missingFields.length, 0);
        const status: VerificationStatus = worst === 1 && !lostLinks && !lostFields ? "passed" : worst >= 0.95 && !lostLinks && !lostFields ? "passed_with_warnings" : "failed";
        const sample = results.flatMap((r) => r.missingWords).slice(0, 12).join(", ");
        this.record(
          run.id,
          "spec_fidelity",
          status,
          `${(worst * 100).toFixed(1)}% of reference words present; ${lostLinks} link(s) and ${lostFields} form field(s) missing${sample ? `; missing words include: ${sample}` : ""}. Initial render only — content behind interactions is not counted.`,
          [`artifact:${art.id}`],
        );
      }

      // The Design build checks only the accessibility that is part of the look (contrast, touch targets), as Design QA
      // findings; the full audit and keyboard walk-through are the Compliance build's.
      let lookA11y: Finding[] = [];
      if (compliance) {
        const axe = await runAxe(session, url);
        const walk = await keyboardWalkthrough(session, url);
        this.finishAccessibility(run, qa.a11y, axe, walk);
      } else {
        lookA11y = (await runAxe(session, url, undefined, LOOK_RULES)).findings.map((f) => ({ ...f, category: "design" as const }));
      }

      const design = [...qa.design, ...lookA11y, ...overflow.map((o, i) => ({ id: `overflow_${i}`, category: "design" as const, rule: "layout-overflow", severity: "serious" as const, confidence: "high" as const, message: `Horizontal overflow — ${o}`, manualValidationRequired: false, source: "browser" as const }))];
      const designArt = this.artifacts.save({ runId: run.id, kind: "other", label: "Design QA findings", mime: "application/json", content: JSON.stringify(design, null, 2), meta: { findings: design.length } });
      const designBlocking = design.filter((f) => f.severity === "serious" || f.severity === "critical");
      this.record(run.id, "design_qa", designBlocking.length ? "failed" : design.length ? "passed_with_warnings" : "passed", `${design.length} deterministic finding(s)${designBlocking.length ? `; blocking: ${designBlocking.map((f) => f.rule).join(", ")}` : ""}`, [`artifact:${designArt.id}`, ...shotRefs]);

      // The cloud model when the project allows it: the small local vision model returned nothing and the critique
      // was skipped ("Unexpected end of JSON input", No BIO & GMO build).
      // Screenshots leave this computer only in a build whose coder is the cloud model; a Local build reviews them with
      // the local vision model (VUS-01).
      const cloudBuild = run.modelAssignments.coder?.providerId.startsWith("hosted") ?? false;
      const cloudCritic = cloudBuild && project.settings.allowHostedModels ? cloudCoder(this.router, this.store) : undefined;
      // A Local build's screenshots never leave this computer: a cloud critic on the run (copied from an older build) is
      // swapped for the configured local one.
      const localCritic = run.modelAssignments.critic?.providerId.startsWith("hosted") ? this.router.roleAssignments(project.id).critic : run.modelAssignments.critic;
      const critic = cloudCritic?.ready ? cloudCritic.assignment : cloudBuild ? run.modelAssignments.critic : localCritic;
      // If the cloud critic is out of credit, over quota or unreachable, the local vision model reviews instead.
      // The optional visual critic (runtime option visualCritic): off, the screenshots go to the person's review, not
      // to a vision model.
      if (runtimeOptions(this.store).visualCritic !== "advisory") {
        this.record(run.id, "visual_critique", "skipped", "The AI visual critic is off (optional): the screenshots are for your design review", []);
        return;
      }
      const { crit, ran, fellBack } = await critiqueWithFallback(this.router, critic, cloudCritic?.ready ? localCritic : undefined, shots.map((s) => ({ name: s.name, png: s.png })), run.objective, {
        projectId: project.id,
        runId: run.id,
        signal,
        // Design skills from the library (e.g. avoid-ai-slop) are what the critic reviews against.
        guidance: renderSkills(selectSkills(this.store.skills.list("updated_at DESC", 200), "critic", `${run.objective}\ninterface design review`, 2)),
      });
      if (fellBack) this.bus.emit({ type: "verification.completed", projectId: project.id, runId: run.id, message: `Visual review: ${fellBack}, so the local critic ${ran?.model} reviewed instead.`, level: "warning" });
      const critArt = this.artifacts.save({ runId: run.id, kind: "other", label: "Visual critique (subjective)", mime: "application/json", content: JSON.stringify({ findings: crit.findings, limitation: crit.limitation, critic: ran?.model, fellBack }, null, 2) });
      const ranBy = `${crit.findings.length} subjective finding(s) from ${ran?.model}${fellBack ? ` (fallback: ${fellBack})` : ""}`;
      this.record(run.id, "visual_critique", crit.status === "skipped" ? "skipped" : crit.status, crit.limitation ? `${crit.limitation}${fellBack ? ` (after fallback: ${fellBack})` : ""}` : ranBy, [`artifact:${critArt.id}`]);
    } catch (err) {
      this.bus.emit({ type: "verification.completed", projectId: project.id, runId: run.id, message: `Browser verification error: ${(err as Error).message}`, level: "error" });
      for (const k of ["preview_health", "screenshots", "accessibility"] as VerificationKind[]) {
        const c = this.store.checks.where("run_id = ? AND kind = ?", run.id, k).find((x) => !x.taskId);
        if (!c || c.status === "running" || c.status === "pending") this.record(run.id, k, "failed", `Browser automation error: ${(err as Error).message.slice(0, 200)}`, []);
      }
    } finally {
      await session?.close();
      await this.processes.killProcess(server.serverProcId);
    }
  }

  /**
   * Look check after a coding step that changed screens: starts the dev server, visits each screen from the app's
   * navigation and audits what's on screen (see lookCheck.ts). Returns undefined when it can't run (no dependencies,
   * no preview, server didn't start); the step is then judged on its other checks.
   */
  /** The run's screen briefs, for the reviews: a screen is judged against what its person came to do. */
  private briefFor(runId: string): string {
    const briefs = this.store.getSetting<ScreenBrief[]>(screenBriefKey(runId), []);
    return briefs.length ? `\n\nJudge each screen against its brief (does its top show what the person must see first, in this order?):\n${screenBriefNote(briefs).slice(0, 2500)}` : "";
  }

  async lookCheckTask(run: Run, task: Task, signal?: AbortSignal, opts: { crit?: boolean; structureOnly?: boolean; designStep?: boolean } = {}): Promise<LookFinding[] | undefined> {
    const project = this.store.projects.require(run.projectId);
    const jail = this.projects.jail(project);
    const pf = this.projects.preflight(project.id, run.id);
    // A look check that can't run is recorded as unavailable on the step, never as passed: the report lists it.
    const unavailable = (why: string) => {
      this.record(run.id, "design_qa", "skipped", `Look check unavailable for "${task.title}": ${why}`, [], { taskId: task.id });
      return undefined;
    };
    if (!pf.hasNodeModules) return unavailable("the app's dependencies aren't installed");
    if (pf.previewStrategy === "none") return unavailable("this project has no preview to open");
    const port = await freePort();
    const argv = previewArgv(pf, port);
    const server = await this.runner.run({
      jail,
      projectId: project.id,
      runId: run.id,
      taskId: task.id,
      phase: "preview",
      argv,
      reason: `Start the dev server to look at the screens "${task.title}" changed`,
      preflight: pf,
      signal,
      server: { readyPattern: /(Local:\s+https?:\/\/|ready in|started server on|Listening on)/i, readyTimeoutMs: 60_000 },
    });
    if (server.record.status !== "succeeded" || !server.serverProcId) return unavailable("the dev server didn't start");
    const url = server.serverUrl ?? `http://127.0.0.1:${port}/`;
    let session: BrowserSession | undefined;
    try {
      session = await BrowserSession.launch(run.id, this.processes);
      // Every planned page by its address too, so a detail page kept out of the menu is looked at, at both widths.
      const plan = this.store.getSetting<ScreenPlan | null>(`screenPlan:${run.id}`, null);
      // A record's page is looked at with a record (the first sample one), not its address alone: Frameproof's Photo
      // detail was judged on its "Photo not found" state ("only a title so far") at every step.
      const appModel = this.store.getSetting<AppModel | null>(appModelKey(run.id), null);
      const records = readGeneratedData(jail.root)?.seed ?? {};
      const withRecord = (id: string) => {
        const view = appModel?.nav.flatMap((g) => g.items).find((v) => v.id === id);
        const first = view?.kind === "detail" && view.entity ? records[view.entity]?.[0]?.id : undefined;
        return first ? `${id}/${String(first)}` : id;
      };
      const result = await lookCheck(session, url, { account: demoAccount(jail.root), routes: plan?.screens.map((x) => ({ name: x.label, id: withRecord(x.id) })) });
      // Structure steps (App layout and its parts) wire screens into a temporary frame; the design steps that follow
      // own colour, contrast and composition. No BIO & GMO build: the layout step was blocked three times for the
      // ready-made Home layout's low-contrast eyebrow and avatar initials, which the design step redoes anyway.
      if (opts.structureOnly) {
        for (const f of result.findings) if (VISUAL_RULES.has(f.rule)) f.serious = false;
      }
      // A problem with a screen's content (a missing image, a title-only screen, placeholder text) blocks only a step
      // that may edit that screen. Kids cash app: a polish part limited to GamesScreen.tsx looped for an hour on
      // Learn Coins' broken images, which it wasn't allowed to fix, while the fix waited in the chat for the build to end.
      // A screen that is still only its title is the design steps' to fill: it blocks them, so a build can't finish
      // with placeholder screens, but a feature step working on another screen isn't held up by it.
      if (opts.designStep) for (const f of result.findings) if (f.rule === "title-only" || f.rule === "empty-screen") f.serious = true;
      // A step scoped to a folder (or the whole app) owns every screen; one scoped to files owns the screens they are.
      const ownsAll = task.expectedPaths.some((p) => p === "." || p === "src" || p.endsWith("/") || !/\.[a-z0-9]+$/i.test(p));
      // A screen's stylesheet (src/styles/gallery.css) is that screen's too.
      const screenFiles = task.expectedPaths.filter((p) => /\.(tsx|jsx|vue|svelte)$/i.test(p) || /(^|\/)styles\/[^/]+\.css$/i.test(p));
      const stem = (s: string) => s.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]+$/i, "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(screen|page|view)$/, "");
      const mine = (screen: string) => ownsAll || screenFiles.some((p) => stem(p) === stem(screen));
      for (const f of result.findings) {
        // Any problem on a screen the step may not edit, contrast included (Frameproof: the Gallery's polish part was
        // held to Photo detail's label contrast, which only photo-detail.css could fix).
        if (f.serious && (CONTENT_RULES.has(f.rule) || screenFiles.length > 0) && !mine(f.screen)) {
          f.serious = false;
          f.message = `${f.message} (for the step that owns this screen)`;
        }
      }
      // The AI look review and design crit are optional and advisory (runtime option visualCritic): off, no vision model
      // is asked; on, what they say is recorded for the person and never sends a step back (reliability phase 4).
      const critic = runtimeOptions(this.store).visualCritic === "advisory";
      const review = opts.structureOnly || !critic ? { findings: [], model: undefined, limitation: undefined } : await lookReview(this.router, [run.modelAssignments.coder, run.modelAssignments.coder?.providerId.startsWith("hosted") ? run.modelAssignments.critic : run.modelAssignments.critic?.providerId.startsWith("hosted") ? this.router.roleAssignments(project.id).critic : run.modelAssignments.critic], result.screens, `${run.objective}\nThis step: ${task.title}${this.briefFor(run.id)}`, { projectId: project.id, runId: run.id, signal });
      // The look review's taste ("reads like a landing page") is the design steps' to act on. On a feature step it's advice:
      // with a cloud reviewer it blocked Sort Controls and Responsive three times each on a design they couldn't change.
      result.findings.push(...review.findings.map((f) => ({ ...f, serious: false, message: `${f.message} (look review, ${review.model}; advisory)` })));
      if (review.limitation) this.bus.emit({ type: "verification.completed", projectId: project.id, runId: run.id, taskId: task.id, message: review.limitation, level: "warning" });
      const refs = result.screens.map((s) => `artifact:${this.artifacts.save({ runId: run.id, kind: "screenshot", label: `Look check: ${s.name} (after "${task.title}")`, mime: "image/png", content: s.png, meta: { taskId: task.id, lookCheck: true } }).id}`);
      // Design crit (the design steps, once each): a design lead's review against the art-direction bar. Only a cloud
      // model judges this; a small local vision model's taste isn't worth a revision pass.
      if (opts.crit && critic && !result.findings.some((f) => f.serious)) {
        const cloud = project.settings.allowHostedModels ? cloudCoder(this.router, this.store) : undefined;
        const hosted = [...(cloud?.ready ? [cloud.assignment] : []), run.modelAssignments.coder, run.modelAssignments.planner, run.modelAssignments.critic].filter((a) => a?.providerId.startsWith("hosted"));
        // Judged against the product's design direction too (its industry's anti-patterns are part of the bar).
        const direction = this.store.getSetting<DesignDirection | null>(`designDirection:${project.id}`, null);
        // The bar includes the design research on the best products in the category, when there is some.
        const research = this.store.getSetting<DesignResearch | null>(researchKey(project.id), null);
        const crit = await designCrit(this.router, hosted, result.screens, `${run.objective.slice(0, 800)}\nThis step: ${task.title}${this.briefFor(run.id)}${direction ? `\n${directionBrief(direction)}` : ""}${research ? `\nThe bar, from design research on the best products in this category:\n${designResearchBrief(research)}` : ""}`, { projectId: project.id, runId: run.id, signal }).catch(() => undefined);
        if (crit) {
          this.bus.emit({ type: "verification.completed", projectId: project.id, runId: run.id, taskId: task.id, message: `Design crit on "${task.title}" (${crit.model}): ${crit.level}${crit.improvements.length ? `. To raise it: ${crit.improvements.join(" · ")}` : ""}`.slice(0, 1200), level: crit.level === "portfolio" ? "info" : "warning" });
          for (const imp of crit.improvements) result.findings.push({ screen: "Design crit", rule: "design-crit", serious: false, message: `${imp} (advisory)` });
        } else if (!hosted.length) this.bus.emit({ type: "verification.completed", projectId: project.id, runId: run.id, taskId: task.id, message: `Design crit skipped for "${task.title}": it needs the cloud model, and this build uses local models only`, level: "info" });
      }
      const serious = result.findings.filter((f) => f.serious);
      this.record(run.id, "design_qa", serious.length ? "failed" : result.findings.length ? "passed_with_warnings" : "passed", `Look check on ${result.screens.length} screen(s): ${result.findings.length ? result.findings.map((f) => `${f.screen}: ${f.message}`).join(" · ").slice(0, 900) : "no problems found"}`, refs, { taskId: task.id });
      return result.findings;
    } catch (err) {
      this.bus.emit({ type: "verification.completed", projectId: project.id, runId: run.id, taskId: task.id, message: `Look check couldn't run: ${(err as Error).message.slice(0, 200)}`, level: "warning" });
      return unavailable(`the browser couldn't open the app (${(err as Error).message.slice(0, 160)})`);
    } finally {
      await session?.close();
      await this.processes.killProcess(server.serverProcId);
    }
  }

  /** Stores a user-supplied reference file as a run artifact (evidence of what the build was asked to follow). */
  saveReferenceArtifact(runId: string, ref: ReferenceFile) {
    const mime = ref.role === "html" ? "text/html" : ref.role === "css" ? "text/css" : ref.role === "json" ? "application/json" : "text/markdown";
    return this.artifacts.save({ runId, kind: "other", label: `Reference: ${ref.name} (${ref.role})`, mime: `${mime}; charset=utf-8`, content: ref.content, meta: { reference: true, role: ref.role, summary: summarizeReference(ref) } });
  }

  /**
   * Re-runs one check from the strip. Script checks and app wiring run alone; static scans re-run together;
   * browser checks (server, preview, screenshots, a11y, design, critique, spec match) share one live preview so they
   * re-run as a group. Returns the kinds that were re-run.
   */
  async rerunCheck(run: Run, kind: VerificationKind, signal?: AbortSignal): Promise<VerificationKind[]> {
    const project = this.store.projects.require(run.projectId);
    const jail = this.projects.jail(project);
    const SCRIPT: VerificationKind[] = ["typecheck", "lint", "tests", "build"];
    const STATIC: VerificationKind[] = ["security_scan", "compliance_triage", "seo"];
    const BROWSER: VerificationKind[] = ["server_start", "preview_health", "screenshots", "accessibility", "design_qa", "visual_critique", "spec_fidelity"];
    if (SCRIPT.includes(kind)) {
      this.projects.preflight(project.id, run.id);
      await this.runScriptCheck(run, kind, signal);
      return [kind];
    }
    if (kind === "app_wiring") {
      this.appWiringCheck(run);
      return [kind];
    }
    if (kind === "project_preflight" || kind === "manifest_validation") {
      const pf = this.projects.preflight(project.id, run.id);
      this.record(run.id, "project_preflight", pf.projectType === "incomplete" ? "blocked" : "passed", `${pf.projectType}; ${pf.packageManager}; ${pf.scripts.length} scripts`, [`preflight:${pf.id}`]);
      if (pf.detectedTypes.includes("node_package")) this.record(run.id, "manifest_validation", pf.manifestValid ? "passed" : "failed", pf.manifestValid ? "package.json valid" : pf.manifestErrors.join("; "), [`preflight:${pf.id}`]);
      return ["project_preflight", "manifest_validation"];
    }
    if (STATIC.includes(kind)) {
      this.staticQa(run, jail);
      return STATIC;
    }
    if (BROWSER.includes(kind)) {
      const pf = this.projects.preflight(project.id, run.id);
      const qa = this.staticQa(run, jail);
      if (pf.previewStrategy !== "none") await this.browserChecks(run, pf.previewStrategy, qa, signal);
      else this.finishAccessibility(run, qa.a11y, undefined, undefined);
      return BROWSER;
    }
    if (kind === "final_report") {
      await this.generateReport(this.store.runs.require(run.id), undefined);
      return [kind];
    }
    throw new Error(`${kind} can't be re-run on its own; use Resume to run the whole verification again`);
  }

  hasFinalReport(runId: string): boolean {
    return this.store.artifacts.where("run_id = ? AND kind = 'report_md'", runId).length > 0;
  }

  async generateReport(run: Run, gate: GateResult | undefined): Promise<ArtifactRecord> {
    const art = this.reports.buildRunReport(run, gate);
    this.record(run.id, "final_report", "passed", `Report generated (${art.bytes} bytes)`, [`artifact:${art.id}`]);
    return art;
  }

  /** Standalone quality run for the Quality center (no run required). */
  qualityScan(projectId: string) {
    const jail = this.projects.jail(projectId);
    return {
      accessibility: staticAccessibility(jail),
      design: designQa(jail),
      security: securityTriage(jail),
      compliance: complianceTriage(jail),
      seo: seoTriage(jail),
    };
  }

  artifactPath(_a: ArtifactRecord) {
    return path.basename(_a.contentRef);
  }
}

/** True when a criterion describes taking something away ("removed", "no longer", "without"…). */
export function isRemovalWording(description: string): boolean {
  return /\b(remov(e|ed|es|ing)|delet(e|ed|es|ing)|no longer|not (contain|include|have|use)|without|drop(ped)?|strip(ped)?|eliminat(e|ed)|get rid|gone)\b/i.test(description);
}

/** Error lines from a type checker, linter or test runner (summary lines left out). */
/**
 * Error lines from a check's output. Besides TypeScript-style "error" lines this reads Python tools: ruff and
 * flake8 rule codes (file.py:1:8: F401 …), pytest's FAILED lines, Python exceptions (SyntaxError: …) and
 * sqlfluff's Postgres findings (L:  3 | P:  1 | LT01 …).
 */
/** The workspace-relative file an error line names ("src/App.tsx(3,4): error …" or "src/App.tsx:3:4 error …"). */
export function errorFile(line: string): string | undefined {
  const m = /^(?:[A-Za-z]:[\\/][^(:]*?[\\/])?((?:src|app|lib|components|pages|test|tests)[\\/][^(:\s]+?\.\w+)(?:\(\d+,\d+\)|:\d+:\d+)/.exec(line.trim());
  return m ? m[1].replace(/\\/g, "/") : undefined;
}

/** Whether the source renders a record field that holds pictures existing in public/ (by the field's name). */
function recordPicturesShown(root: string, source: string): boolean {
  const data = readGeneratedData(root);
  if (!data) return false;
  for (const rows of Object.values(data.seed)) {
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => /image|photo|picture|thumbnail/i.test(k) && !/alt/i.test(k));
    for (const key of keys) {
      if (!new RegExp(`["'.]${key}\\b`).test(source)) continue;
      const files = rows.map((r) => String(r[key] ?? "").replace(/^\/+/, "")).filter(Boolean);
      if (files.some((v) => fs.existsSync(path.join(root, "public", v)))) return true;
    }
  }
  return false;
}

/**
 * Every record has a picture of its own: the field names a file that exists under public/ (never a remote address), and
 * no two records share one. Frameproof's pictures step was marked verified with 4 of 12 records left empty: its checks
 * were the data and the type check, not what the step was asked to do.
 */
export function imagesCompleteProblem(root: string, rows: Array<Record<string, unknown>>, entity: string, field: string): string | undefined {
  if (!rows.length) return `no ${entity} records in src/app/schema.ts`;
  const label = (r: Record<string, unknown>) => String(r.id ?? r.title ?? "?");
  const missing: string[] = [];
  const remote: string[] = [];
  const seen = new Map<string, string[]>();
  for (const r of rows) {
    const v = String(r[field] ?? "").trim();
    if (!v) missing.push(label(r));
    else if (/^(https?:)?\/\//i.test(v) || /^data:/i.test(v)) remote.push(label(r));
    else if (!fs.existsSync(path.join(root, "public", v.replace(/^\/+/, "")))) missing.push(`${label(r)} (${v} isn't in public/)`);
    else seen.set(v, [...(seen.get(v) ?? []), label(r)]);
  }
  const shared = [...seen.entries()].filter(([, ids]) => ids.length > 1);
  const out = [
    missing.length ? `${missing.length} of ${rows.length} ${entity} records have no local picture: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? ", …" : ""}. Find one with find_image, or create a simple SVG in public/images showing the record's title, and set ${field} to it` : "",
    remote.length ? `${remote.length} use a remote or inline address (${remote.slice(0, 4).join(", ")}): save the picture under public/images instead` : "",
    shared.length ? `records share a picture (${shared.slice(0, 3).map(([v, ids]) => `${v}: ${ids.join(", ")}`).join("; ")}): each needs its own` : "",
  ].filter(Boolean);
  return out.length ? out.join("; ") : undefined;
}

export function errorLines(output: string): string[] {
  return [...new Set(output.split(/\r?\n/).map((l) => l.trim()).filter((l) => (/\berror\b|✖|×|\bFAIL(ED)?\b|\b[A-Z]\w*Error:|^\S+:\d+:\d+: [A-Z]+\d+\b|^L:\s*\d+\s*\|\s*P:/i.test(l)) && !/^=*\s*\d+ (failed|passed|errors?)\b.* in [\d.]+s/i.test(l) && !/^(found \d+ errors?|npm (err|error)!|\d+ (errors?|problems?)|error: script|errors? in \d+ files?|ELIFECYCLE)/i.test(l)))];
}

/** An error line without its line and column numbers, so a shifted line still counts as the same error. */
export function signature(line: string): string {
  return line.replace(/\(\d+,\d+\)|:\d+:\d+|\b\d+:\d+\b|line \d+|L:\s*\d+\s*\|\s*P:\s*\d+|\.py:\d+:/gi, (m) => (m.toLowerCase().startsWith(".py") ? ".py:" : "")).replace(/\s+/g, " ").trim();
}

/** A step's diagnostics when it started: each error's signature, once per occurrence (no line numbers). */
export interface StepBaseline {
  at: string;
  typecheck?: { passed: boolean; errors: string[]; located?: Diagnostic[] };
  lint?: { passed: boolean; errors: string[]; located?: Diagnostic[] };
}
export const stepBaselineKey = (taskId: string) => `stepBaseline:${taskId}`;

/**
 * Errors now against errors before, by signature (file, code and message, no line or column) and count: the same error
 * on a moved line is inherited; one more of the same error is introduced. Resolved: how many earlier ones are gone.
 */
export function attributeDiagnostics(before: string[], nowLines: string[]): { introduced: string[]; inherited: string[]; resolved: number } {
  const left = new Map<string, number>();
  for (const s of before) left.set(s, (left.get(s) ?? 0) + 1);
  const introduced: string[] = [];
  const inherited: string[] = [];
  for (const line of nowLines) {
    const sig = signature(line);
    const n = left.get(sig) ?? 0;
    if (n > 0) {
      left.set(sig, n - 1);
      inherited.push(line);
    } else introduced.push(line);
  }
  return { introduced, inherited, resolved: [...left.values()].reduce((a, b) => a + b, 0) };
}

export function errorSignatures(output: string): string[] {
  return [...new Set(errorLines(output).map(signature))];
}

/**
 * Lines of a test file that compare a literal with the same literal (`expect("x").toBe("x")`, `expect(4).toEqual(4)`):
 * they always pass and check nothing. Empty when the file is missing.
 */
export function parkedTests(abs: string): string[] {
  let src: string;
  try {
    src = fs.readFileSync(abs, "utf8");
  } catch {
    return [];
  }
  // it.todo / it.skip / test.todo / test.skip / xit / describe.skip: they never fail, so a step could pass without
  // building what they describe (Calendar prototype: five event-creation requirements parked as it.todo).
  const out: string[] = [];
  for (const m of src.matchAll(/\b(?:(?:it|test|describe)\.(?:todo|skip)|xit|xtest|xdescribe)\(\s*(["'`])((?:\\.|(?!\1).)+?)\1/g)) out.push(m[2]);
  return out;
}

export function selfComparingTests(abs: string): string[] {
  let src: string;
  try {
    src = fs.readFileSync(abs, "utf8");
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const [i, line] of src.split(/\r?\n/).entries()) {
    const m = /expect\(\s*(["'`])((?:(?!\1).)*)\1\s*\)\s*\.(?:toBe|toEqual|toStrictEqual)\(\s*(["'`])((?:(?!\3).)*)\3\s*\)/.exec(line) ?? /expect\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*\.(?:toBe|toEqual)\(\s*(-?\d+(?:\.\d+)?)\s*\)/.exec(line);
    if (!m) continue;
    const [a, b] = m.length > 4 ? [m[2], m[4]] : [m[1], m[2]];
    if (a === b) out.push(`line ${i + 1}: ${line.trim().slice(0, 120)}`);
  }
  return out;
}

/**
 * What a failed test check tells the agent: every failing test and why first, then the end of the output, without
 * colour codes. The bare last 2,500 characters were often the middle of a DOM dump (Calendar prototype: the agent was
 * told earlier steps' tests failed and shown a <select> element, not which three tests).
 */
function testReport(output: string): string {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
  return `${testFailureDigest(clean)}${clean.slice(-1500)}`;
}

/** Look-check rules about what a screen shows (fixed in that screen's own files), as opposed to how it's styled. */
const CONTENT_RULES = new Set(["broken-image", "title-only", "empty-screen", "placeholder-text", "sample-data-hidden", "repeated-controls", "repeated-empty-text", "repeated-section", "contradictory-controls", "several-h1"]);

/** Screen files in the same folder that are the same screen under another name (learn-coins.tsx ↔ LearnCoinsScreen.tsx). */
export function sameScreenFiles(abs: string): string[] {
  const norm = (f: string) => f.replace(/\.(tsx?|jsx?)$/i, "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(screen|page|view)$/, "");
  const dir = path.dirname(abs);
  const want = norm(path.basename(abs));
  if (!want || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(tsx?|jsx?)$/i.test(f) && path.join(dir, f) !== abs && norm(f) === want)
    .map((f) => path.join(dir, f));
}

/**
 * A building-block class (`ui-skeleton`) is in a screen when the screen uses the kit component that draws it
 * (`<Skeleton>` renders `ui-skeleton`, or the catalog's `fl-ctl-skel` once the kit takes it from the catalog): the class
 * lives in src/components/ui, never typed into the screen itself. Both generations count, so older apps keep working.
 * Kids cash app: a check for "ui-skeleton" in the coin screen failed for three hours while the screen used <Skeleton>.
 */
const CATALOG_TWIN: Record<string, string[]> = {
  "ui-btn": ["fl-btn"], "ui-card": ["fl-card"], "ui-empty": ["fl-spec-empty"], "ui-skeleton": ["fl-ctl-skel"], "ui-stat": ["fl-crd-kpi"],
  "ui-badge": ["fl-ctl-badge"], "ui-notice": ["fl-ctl-alert"], "ui-dialog": ["fl-ctl-dlg"], "ui-progress": ["fl-ctl-bar"], "ui-table": ["fl-ctl-tbl"],
  "ui-avatar": ["fl-ctl-avatar"], "ui-tabs": ["fl-ctl-tabset"], "ui-switch": ["fl-ctl-switch"],
};
/** The kit component that draws each building block, for the ones whose source no longer names the class (the catalog draws it). */
const KIT_COMPONENT: Record<string, string> = {
  "ui-btn": "Button", "ui-card": "Card", "ui-empty": "EmptyState", "ui-skeleton": "Skeleton", "ui-stat": "Stat", "ui-badge": "Badge", "ui-notice": "Notice",
  "ui-dialog": "Dialog", "ui-progress": "Progress", "ui-table": "DataTable", "ui-avatar": "Avatar", "ui-tabs": "Tabs", "ui-switch": "Switch",
};
/** The class a replaced component renders now, and the one it rendered before the catalog merge: a check for either is met by the component. */
const kitClassNames = (cls: string) => {
  const twins = Object.entries(CATALOG_TWIN).filter(([old, now]) => old === cls || now.includes(cls));
  return [...new Set([cls, ...twins.flatMap(([old, now]) => [old, ...now])])];
};
export function usesKitClass(body: string, text: string, root: string): boolean {
  if (!body || !/^(?:ui|fl)-[a-z0-9-]+$/i.test(text)) return false;
  const names = kitClassNames(text);
  // A replaced component draws the catalog's class from a file in src/sections, so the kit's source no longer spells it out.
  const drawn = Object.entries(KIT_COMPONENT).filter(([old]) => names.includes(old)).map(([, c]) => c);
  if (drawn.some((c) => new RegExp(`<${c}[\\s/>]`).test(body))) return true;
  const kitDir = path.join(root, "src", "components", "ui");
  const files = fs.existsSync(kitDir) ? fs.readdirSync(kitDir).filter((f) => /\.(tsx|jsx)$/.test(f)).map((f) => path.join(kitDir, f)) : [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    // Each exported component, with the source up to the next one.
    const parts = src.split(/(?=export (?:default )?function )/);
    for (const part of parts) {
      const name = /^export (?:default )?function ([A-Z]\w*)/.exec(part)?.[1];
      if (name && names.some((n) => part.includes(n)) && new RegExp(`<${name}[\\s/>]`).test(body)) return true;
    }
  }
  return false;
}
