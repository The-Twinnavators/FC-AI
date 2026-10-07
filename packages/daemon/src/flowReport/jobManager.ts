// packages/daemon/src/flowReport/jobManager.ts
//
// Running one analysis, and telling the truth about it while it runs.
//
// ── Progress is arithmetic over finished work ────────────────────────────────
//
// The number comes from units that have actually completed: the boundary check,
// the scan, each section, and the aggregation. Nothing here interpolates
// against a clock. A bar that advances on a timer reaches 100% while work
// remains, and a user who believes it closes the window on a half-finished run.
//
// The weights below are a judgement about which parts take the time, not a
// measurement, and they are deliberately coarse. What must hold is that the
// number only ever rises, and only reaches 1 when the last unit is done.
//
// ── One section failing must not lose the other nine ─────────────────────────
//
// Each analyser runs inside its own try/catch. A failure becomes a `failed`
// section carrying the message, plus an entry in the run's errors, and the run
// finishes as `completed_with_warnings`. A failed section is left UNSCORED
// rather than scored zero: a zero would drag the overall score down as though
// the project were bad at something nobody managed to measure.
//
// ── Cancelled is not a kind of complete ──────────────────────────────────────
//
// A cancelled run keeps whatever finished, never reaches full progress, and
// never takes the `completed` status. Somebody downloading a report of a third
// of their repository, believing it covers all of it, is the worst outcome this
// module can produce.

import { openRepository } from './scanner/boundary.js'
import { scanRepository, type ScanResult, type ScanOptions } from './scanner/scan.js'
import { summarizeRun, sectionScore } from './report/summarize.js'
import { classifySection } from './analyzers/classify.js'
import { synthesise } from './analyzers/synthesis.js'
import { buildActionPlan } from './analyzers/actionPlan.js'
import { renderReportMarkdown, STATUS_LABEL } from './report/markdown.js'
import { writeArtifact } from './report/artifacts.js'
import { sectionMetrics } from './report/metrics.js'
import { buildRepoMap } from './report/repoMap.js'
import { understandRepository, type Comprehension } from './comprehend/understand.js'
import { rewriteFinding } from './comprehend/rewrite.js'
import { briefFor } from './comprehend/brief.js'
import { adjudicateSection } from './comprehend/adjudicate.js'
import { verifyAbsences, withdrawnBy } from './comprehend/verifyAbsence.js'
import { insightFor, worthLocating, insightPrompt } from './comprehend/extract.js'
import { termsOf, excerpt } from './comprehend/adjudicate.js'
import { withModel, type ModelGateway } from './comprehend/model.js'
import type { FlowReportStore } from './store.js'
import type { ProcessManager } from '../commands/processManager.js'
import {
  REPORT_CATEGORIES, CATEGORY_LABEL,
  type AnalysisError, type AnalysisSettings, type AnalysisWarning,
  type FlowReportRun, type ReportCategory, type ReportSectionResult, type RunStatus,
} from './types.js'

export interface AnalysisContext {
  /** Repository-relative paths, already bounded and filtered. */
  files: ScanResult['files']
  scan: ScanResult
  settings: AnalysisSettings
  /** The display name, never the path — so no analyser can put a local path
   *  into a finding even by accident. */
  repositoryDisplayName: string
  /** What the product is, read before anything was measured. Null when no
   *  local model was reachable — an analyser must still work without it. */
  comprehension: Comprehension
  signal: AbortSignal
}

export interface SectionAnalyzer {
  category: ReportCategory
  run(ctx: AnalysisContext): Promise<ReportSectionResult>
}

export interface ProgressEvent {
  runId: string
  projectId: string
  status?: RunStatus
  progress?: number
  currentStage?: string
  /** Set when a section changed state, so a UI can update one row rather than
   *  re-rendering the list. */
  section?: { category: ReportCategory; status: ReportSectionResult['status'] }
}

type Subscriber = (e: ProgressEvent) => void

/**
 * Relative cost of each phase.
 *
 * Coarse on purpose. Scanning dominates on a large repository and the sections
 * dominate on a small one, so any fixed split is wrong somewhere; what matters
 * is that the weights are stable, so the bar does not jump backwards when the
 * balance turns out differently.
 */
const WEIGHT = {
  boundary: 1, scan: 6, understand: 3, section: 3, rewrite: 6, aggregate: 1, exports: 2,
}

/**
 * How many findings a run will spend a model call locating.
 *
 * This is the one stage that costs a call per FINDING rather than per section,
 * and a large repository produces forty-odd. At roughly two seconds each that
 * is a minute and a half added to a run somebody is watching, for diminishing
 * returns: the twentieth located finding is read by nobody who did not already
 * act on the first five.
 *
 * Findings are taken in severity order, so the budget is spent where it is
 * worth spending, and running out costs locations rather than findings.
 */
const LOCATE_BUDGET = 14

/** The same bargain for the rewrite, which is now also a call per finding. */
const REWRITE_BUDGET = 30

/**
 * How many findings get a buildable brief.
 *
 * The most expensive thing in the run: up to three model calls each, around
 * twenty seconds a finding, and a brief that comes back incomplete is discarded
 * rather than half-printed. At forty that is roughly ten minutes added to a run
 * on a repository the size of POSCHI — which is a real cost, and the reason
 * this is a number rather than "all of them".
 *
 * Forty covers every finding that asks for work on the reports seen so far;
 * observations are excluded before the budget is counted, so it is not spent on
 * findings nobody can act on.
 *
 * Spent on the gravest first, so running out costs the least consequential
 * briefs rather than the last few sections.
 */
const BRIEF_BUDGET = 40

export interface StartOptions extends ScanOptions {
  settings?: AnalysisSettings
  /**
   * How the product gets described. Defaults to reading it through the local
   * model.
   *
   * ── Injectable because a test must not need a container ────────────────────
   *
   * `understandRepository` talks to Ollama, which takes ten to twenty seconds
   * and is not running on every machine. A suite that called it would be slow,
   * would fail on a laptop with the container stopped, and would be testing the
   * model rather than the pipeline. Tests pass a stub; production passes
   * nothing.
   */
  comprehend?: (
    files: ScanResult['files'],
    o: { signal?: AbortSignal },
  ) => Promise<Comprehension>
  /** How findings get rewritten for this product. Injectable for the same
   *  reason as `comprehend`: it talks to the same container, and a suite that
   *  called it spent ninety seconds proving the model can write English. */
  rewrite?: typeof rewriteFinding
  /** Seam for tests: the real one talks to a local model. */
  adjudicate?: typeof adjudicateSection
  /** Seam for tests: searches the repository for every name a missing thing
   *  might go by, one model call per absence. */
  verifyAbsences?: typeof verifyAbsences
  /** Seam for tests: the per-file location pass, one model call per finding. */
  locate?: typeof insightFor
  /** Seam for tests: the buildable brief, one model call per finding. */
  writeBrief?: typeof briefFor
}

export type Comprehend = NonNullable<StartOptions['comprehend']>
export type Rewrite = NonNullable<StartOptions['rewrite']>
export type Adjudicate = NonNullable<StartOptions['adjudicate']>
export type VerifyAbsences = NonNullable<StartOptions['verifyAbsences']>
export type Locate = NonNullable<StartOptions['locate']>
export type WriteBrief = NonNullable<StartOptions['writeBrief']>

export class AnalysisJobManager {
  private readonly store: FlowReportStore
  private readonly comprehend: Comprehend
  private readonly rewrite: Rewrite
  private readonly adjudicate: Adjudicate
  private readonly verifyAbsences: VerifyAbsences
  private readonly locate: Locate
  private readonly writeBrief: WriteBrief
  private readonly model: ((settings: AnalysisSettings) => ModelGateway | null) | undefined
  private readonly processes: ProcessManager | undefined
  private readonly subscribers = new Set<Subscriber>()
  private readonly running = new Map<string, { controller: AbortController; done: Promise<void> }>()

  /** `comprehend` defaults to reading the product through the local model. A
   *  test passes a stub here once rather than at every `start`. */
  constructor(
    store: FlowReportStore,
    o: {
      comprehend?: Comprehend; rewrite?: Rewrite
      adjudicate?: Adjudicate; locate?: Locate; verifyAbsences?: VerifyAbsences
      writeBrief?: WriteBrief
      /**
       * The model a run reads the product through, chosen per run because the
       * run's settings decide whether a hosted one may be used at all. The
       * daemon passes FlowCode's router here (see `comprehend/model.ts`); a
       * manager with none reads nothing and says so, which is what every test
       * that stubs the stages wants anyway.
       */
      model?: (settings: AnalysisSettings) => ModelGateway | null
      /** FlowCode's process manager, so the Chromium a PDF render launches is
       *  registered and reaped like any other browser the daemon starts. */
      processes?: ProcessManager
    } = {},
  ) {
    this.model = o.model
    this.processes = o.processes
    this.store = store
    this.comprehend = o.comprehend ?? understandRepository
    this.rewrite = o.rewrite ?? rewriteFinding
    this.adjudicate = o.adjudicate ?? adjudicateSection
    this.verifyAbsences = o.verifyAbsences ?? verifyAbsences
    this.locate = o.locate ?? insightFor
    this.writeBrief = o.writeBrief ?? briefFor
    this.failRunsThatDidNotSurvive()
  }

  /**
   * Close off runs left mid-flight by a process that is no longer here.
   *
   * A run lives in this manager's memory. When the daemon stops — a restart, a
   * crash, a machine going to sleep — that memory goes and the work with it,
   * but the row keeps whatever status it had. The page then shows a spinner at
   * 84% for ever, and Cancel does nothing, because `cancel` looks for a job
   * this manager is running and there is no such job. One of these had been
   * sitting at "analyzing" for five days.
   *
   * Nothing here can tell whether the analysis was nearly done or had barely
   * started, and inventing a result would be worse than admitting it stopped.
   * So the run is marked failed, with an error saying exactly what happened.
   */
  private failRunsThatDidNotSurvive(): void {
    for (const run of this.store.runsInFlight()) {
      this.store.updateRun(run.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errors: [
          ...run.errors,
          {
            stage: run.currentStage ?? 'unknown',
            message: 'The daemon stopped while this run was going. Whatever it had '
              + 'not finished is gone, so the run is recorded as failed rather than '
              + 'left appearing to run. Start another when you want one.',
          },
        ],
      })
    }
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn)
    return () => { this.subscribers.delete(fn) }
  }

  private emit(e: ProgressEvent): void {
    for (const fn of this.subscribers) {
      // One bad subscriber must not take the run down with it.
      try { fn(e) } catch { /* ignore */ }
    }
  }

  /** True while a run is in flight. Used by the routes to refuse a second
   *  concurrent run for the same project. */
  isRunning(runId: string): boolean {
    return this.running.has(runId)
  }

  cancel(runId: string): void {
    this.running.get(runId)?.controller.abort()
  }

  /** Resolves when the run has finished, however it finished. Present for
   *  tests and for a graceful daemon shutdown; callers in the request path
   *  should subscribe instead of awaiting. */
  async wait(runId: string): Promise<void> {
    await this.running.get(runId)?.done
  }

  /**
   * Begin a run and return its record immediately.
   *
   * The work continues in the background so the HTTP request that started it
   * can return, which is what lets the user navigate away from the page.
   */
  async start(
    projectId: string,
    analyzers: SectionAnalyzer[],
    options: StartOptions = {},
  ): Promise<FlowReportRun> {
    const project = this.store.getProject(projectId)
    if (!project) throw new Error('That report project no longer exists.')

    const run = this.store.createRun(projectId)
    const controller = new AbortController()
    const settings = options.settings ?? project.settings
    const gateway = this.model ? this.model(settings) : null
    const done = withModel(gateway, () => this.execute(run.id, projectId, analyzers, options, controller.signal))
      .catch((err) => {
        // A throw out of execute is a bug in this module rather than in an
        // analyser, but it must still leave the run in a readable state.
        this.fail(run.id, projectId, 'run', String(err?.message ?? err))
      })
      .finally(() => { this.running.delete(run.id) })

    this.running.set(run.id, { controller, done })
    return run
  }

  private fail(runId: string, projectId: string, stage: string, message: string): void {
    const existing = this.store.getRun(runId)
    const errors: AnalysisError[] = [...(existing?.errors ?? []), { stage, message }]
    this.store.updateRun(runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errors,
    })
    this.store.appendEvent(runId, 'error', stage, message)
    this.emit({ runId, projectId, status: 'failed' })
  }

  private async execute(
    runId: string,
    projectId: string,
    analyzers: SectionAnalyzer[],
    options: StartOptions,
    signal: AbortSignal,
  ): Promise<void> {
    const project = this.store.getProject(projectId)!
    const settings = options.settings ?? project.settings
    const startedAt = Date.now()

    // The rewrite only costs time when it is switched on, so it only takes a
    // share of the bar when it will actually run. Counting it either way would
    // make a quick run stall at 88% and finish in one jump.
    const willRewrite = (options.settings ?? project.settings).tailoredWriting
    const totalWeight = WEIGHT.boundary + WEIGHT.scan + WEIGHT.understand
      + analyzers.length * WEIGHT.section + (willRewrite ? WEIGHT.rewrite : 0)
      + WEIGHT.aggregate + WEIGHT.exports
    let doneWeight = 0
    let lastProgress = 0

    const advance = (by: number, stage: string, status?: RunStatus): void => {
      doneWeight += by
      // Clamped and ratcheted: a rounding error must never make the bar go
      // backwards, which reads as the run restarting.
      const progress = Math.min(1, Math.max(lastProgress, doneWeight / totalWeight))
      lastProgress = progress
      this.store.updateRun(runId, { progress, currentStage: stage, ...(status ? { status } : {}) })
      this.emit({ runId, projectId, progress, currentStage: stage, ...(status ? { status } : {}) })
    }

    const note = (level: 'info' | 'warn' | 'error', stage: string, message: string): void => {
      this.store.appendEvent(runId, level, stage, message)
    }

    const cancelled = (): boolean => signal.aborted

    // ── 1. Boundary ──
    this.store.updateRun(runId, { status: 'preparing', startedAt: new Date(startedAt).toISOString() })
    this.emit({ runId, projectId, status: 'preparing' })
    note('info', 'preparing', 'Checking repository structure and analysis boundaries')

    const opened = openRepository(project.repositoryPath)
    if (!opened.ok) {
      // The reason is written for the person who picked the folder, not for a
      // log: "does not exist, or is not visible to FlowCode" rather than a
      // stack trace, because the fix is to choose the folder again.
      this.fail(runId, projectId, 'preparing', opened.reason)
      return
    }
    advance(WEIGHT.boundary, 'Checking repository structure and analysis boundaries')

    if (cancelled()) return this.finishCancelled(runId, projectId, startedAt)

    // ── 2. Scan ──
    this.store.updateRun(runId, { status: 'scanning' })
    this.emit({ runId, projectId, status: 'scanning' })
    note('info', 'scanning', 'Reading project files within the analysis boundary')

    const scan = await scanRepository(opened.boundary, {
      ...options,
      signal,
      includeTests: settings.includeTests,
      includeDocs: settings.includeDocs,
      excludeGenerated: settings.excludeGenerated,
      customIgnore: settings.customIgnore,
      onProgress: (p) => {
        this.emit({
          runId, projectId,
          currentStage: `Reading project files — ${p.filesRead} read`,
        })
      },
    })
    advance(WEIGHT.scan, `Read ${scan.files.length} files, skipped ${scan.skipped.length}`)
    note('info', 'scanning',
      `Read ${scan.files.length} files, skipped ${scan.skipped.length}, in ${scan.durationMs}ms`)

    const warnings: AnalysisWarning[] = []
    const errors: AnalysisError[] = []
    if (scan.truncated && !scan.cancelled) {
      for (const limit of scan.limitsHit) warnings.push({ stage: 'scanning', message: limit })
    }

    if (cancelled() || scan.cancelled) return this.finishCancelled(runId, projectId, startedAt)

    // ── 3. Understand what the product is ──
    //
    // Before anything is measured. The analysis used to go straight from "here
    // are the files" to "here are the answers", with the questions fixed in
    // advance — and they were one product's questions, so every repository was
    // assessed as though it were that product. Nothing in the pipeline had ever
    // established what the project under analysis actually is.
    //
    // This reads a small, high-signal slice through the local model and returns
    // a description: what it is, who uses it, what they can do. It produces no
    // findings and never can; every finding still comes from a deterministic
    // analyser with a file behind it.
    // The progress goes out with the stage even though it has not moved. An
    // event carrying only a stage leaves a consumer to remember the last
    // number, and one that does not remember renders the bar back at zero.
    const reading = 'Reading what this product is'
    this.store.updateRun(runId, { status: 'analyzing', currentStage: reading })
    this.emit({
      runId, projectId, status: 'analyzing', currentStage: reading, progress: lastProgress,
    })

    const comprehend = options.comprehend ?? this.comprehend
    const comprehension = await comprehend(scan.files, { signal })
    this.store.updateRun(runId, { comprehension })
    if (comprehension.reason) {
      warnings.push({ stage: 'analyzing', message: comprehension.reason })
      note('warn', 'analyzing', comprehension.reason)
    } else {
      note('info', 'analyzing',
        `Read as: ${comprehension.model?.whatItIs} (via ${comprehension.producedBy})`)
    }
    advance(WEIGHT.understand, 'Reading what this product is')

    if (cancelled()) return this.finishCancelled(runId, projectId, startedAt)

    // ── 4. Sections ──
    this.store.updateRun(runId, { status: 'analyzing' })
    this.emit({ runId, projectId, status: 'analyzing' })

    const ctx: AnalysisContext = {
      files: scan.files,
      scan,
      settings,
      repositoryDisplayName: project.repositoryDisplayName,
      comprehension,
      signal,
    }

    for (const analyzer of analyzers) {
      if (cancelled()) return this.finishCancelled(runId, projectId, startedAt)

      const category = analyzer.category
      this.store.saveSection(runId, {
        category, status: 'in_progress', score: null, summary: '',
        findings: [], limitations: [], startedAt: new Date().toISOString(),
      })
      this.emit({ runId, projectId, section: { category, status: 'in_progress' } })

      try {
        const result = await analyzer.run(ctx)
        // Classified here because this is the one point every analyser's output
        // passes through. Doing it inside each analyser would be eleven places
        // for the taxonomy to drift, and a twelfth analyser producing
        // unclassified findings the first time somebody forgets.
        this.store.saveSection(runId, {
          ...classifySection(result),
          completedAt: new Date().toISOString(),
        })
        this.emit({ runId, projectId, section: { category, status: result.status } })
        if (result.status === 'completed_with_warnings') {
          warnings.push({ stage: 'analyzing', message: result.reason ?? `${category} completed with warnings`, category })
        }
        note('info', 'analyzing', `${category}: ${result.status}`)
      } catch (err: any) {
        const message = String(err?.message ?? err)
        // Unscored, not zero. A zero here would be a judgement about a section
        // nobody managed to assess.
        this.store.saveSection(runId, {
          category, status: 'failed', score: null, summary: '',
          findings: [], limitations: [], reason: message,
          completedAt: new Date().toISOString(),
        })
        errors.push({ stage: 'analyzing', message: `${category}: ${message}`, category })
        this.emit({ runId, projectId, section: { category, status: 'failed' } })
        note('error', 'analyzing', `${category} failed: ${message}`)
      }

      advance(WEIGHT.section, `Analysed ${category}`)
    }

    if (cancelled()) return this.finishCancelled(runId, projectId, startedAt)

    // ── 5. Does each finding actually hold here? ──
    //
    // The analysers are pattern matchers and cannot tell what they matched. A
    // site that bills nobody was told at high severity that its renewal terms
    // were undisclosed, because the gate matched six files — all of them the
    // word UNsubscribe in newsletter code. Nothing downstream could notice,
    // because nothing downstream ever looked at the match.
    //
    // This does, before the rewrite rather than after: rewording a finding that
    // is about to be withdrawn spends a model call on a sentence nobody reads.
    //
    // Withdrawals are counted and explained on the section, never silent. A
    // failure of any kind keeps every finding.
    if (comprehension.model) {
      const product = comprehension.model
      const persistedForCheck = this.store.getRun(runId)!
      let withdrawnTotal = 0

      for (const section of persistedForCheck.sections) {
        if (cancelled()) break
        if (section.findings.length === 0) continue
        const label = CATEGORY_LABEL[section.category] ?? section.category
        this.store.updateRun(runId, { currentStage: `Checking ${label} against the code` })
        this.emit({
          runId, projectId, progress: lastProgress,
          currentStage: `Checking ${label} against the code`,
        })

        try {
          const verdicts = await this.adjudicate(label, section.findings, product, scan.files, { signal })

          // ── 5a-ii. The absences, searched for under every name ──
          //
          // The adjudicator exempts these and explains why: it is shown
          // excerpts of the files that matched a finding's words, and an
          // absence matched nothing, so there is nothing to show it. That left
          // the report's largest class of claim unchecked — and it was wrong on
          // POSCHI, which was told a screen it has is a screen it lacks because
          // a pattern searched for "stylist" and the product says "provider".
          //
          // This asks the model what the missing thing would be CALLED, searches
          // for those names here, and lets it read what the search really found.
          // A withdrawal has to cite a file the search returned.
          const checks = await this.verifyAbsences(section.findings, scan.files, {
            signal,
            onChecked: (id, c) => {
              if (c.present) {
                note('info', 'analyzing',
                  `${label}: "${id}" reported missing, found in ${c.citations[0]}`)
              }
            },
          })
          const foundAfterAll = withdrawnBy(checks)
          for (const [id, reason] of foundAfterAll) verdicts.set(id, { reason })

          // Recorded whether or not anything was withdrawn: an absence that
          // survived a search under nine names is a far stronger claim than one
          // nobody checked, and the report should not print them identically.
          const confirmed = [...checks.values()].filter((c) => !c.present)

          if (verdicts.size === 0 && confirmed.length === 0) continue

          const kept = section.findings.filter((f) => !verdicts.has(f.id))
          const dropped = section.findings.filter((f) => verdicts.has(f.id))

          this.store.saveSection(runId, {
            ...section,
            findings: kept,
            // Re-scored, because a section's number is a function of what it
            // still says. Leaving the old score would price findings that are
            // no longer in the report.
            score: kept.length > 0 ? sectionScore(kept) : null,
            limitations: [
              ...section.limitations,
              ...(dropped.length > 0 ? [
                `${dropped.length} finding(s) were withdrawn after checking them against the code `
                + 'they cite, because the evidence did not support them here: '
                + dropped.map((f) => `"${f.title}" — ${verdicts.get(f.id)!.reason}`).join('; '),
              ] : []),
              ...(confirmed.length > 0 ? [
                `${confirmed.length} finding(s) reporting something missing were searched for `
                + 'across every scanned file, under the names a language model proposed for them '
                + 'as well as the one the detector used, and still not found. That is what makes '
                + 'them absences rather than unmatched patterns.',
              ] : []),
            ],
          })
          withdrawnTotal += dropped.length
        } catch (err: any) {
          warnings.push({
            stage: 'analyzing',
            message: `${label} was not checked against the code it cites: `
              + `${String(err?.message ?? err)}. Its findings stand as measured.`,
            category: section.category,
          })
        }
      }
      if (withdrawnTotal > 0) {
        note('info', 'analyzing', `Withdrew ${withdrawnTotal} finding(s) unsupported by their evidence`)
      }
    }

    if (cancelled()) return this.finishCancelled(runId, projectId, startedAt)

    // ── 6. Point at where in the code each finding actually is ──
    //
    // The analysers know WHAT is wrong and which files it is in. They do not
    // know which function, constant or component inside those files — and that
    // is the difference between a reader who has to go looking and one who can
    // open the file and land on it.
    //
    // One model call per finding, on a snippet, asking only for a name. The
    // claim is not up for discussion: it comes from the analyser and the model
    // is told so. The file is injected rather than generated, and the name is
    // kept only when it occurs in that file as a whole word — so of the three
    // parts a reader sees, only one can be wrong, and that one is checked.
    //
    // Budgeted, because this is a call per finding rather than per section. The
    // findings are taken in severity order so the budget is spent on what
    // matters, and a run that hits the cap loses locations rather than findings.
    if (comprehension.model) {
      const persistedForLocate = this.store.getRun(runId)!
      const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
      let budget = LOCATE_BUDGET
      let located = 0

      for (const section of persistedForLocate.sections) {
        if (cancelled() || budget <= 0) break
        // The pre-filter runs before any call: an absence has nothing to point
        // at, and a finding whose title is a count has no single location.
        const candidates = section.findings
          .filter((f) => worthLocating(f))
          .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
        if (candidates.length === 0) continue

        const label = CATEGORY_LABEL[section.category] ?? section.category
        this.store.updateRun(runId, { currentStage: `Locating ${label} findings in the code` })
        this.emit({
          runId, projectId, progress: lastProgress,
          currentStage: `Locating ${label} findings in the code`,
        })

        const found = new Map<string, NonNullable<FlowReportRun['sections'][number]['findings'][number]['located']>>()
        for (const f of candidates) {
          if (cancelled() || budget <= 0) break
          budget -= 1
          const path = f.evidence.find((e) => e.path)?.path
          const file = path ? scan.files.find((x) => x.path === path) : undefined
          if (!path || !file) continue

          // The region of the file the finding is about, rather than its first
          // two thousand characters — which on a large file is the imports.
          const window = excerpt(file.text, termsOf(f), 1_800) ?? file.text.slice(0, 1_800)
          try {
            const insight = await this.locate(path, window, f.title, { signal })
            if (insight) found.set(f.id, {
              file: insight.file, identifier: insight.identifier, where: insight.where,
            })
          } catch { /* one finding without a location is not a failed run */ }
        }

        if (found.size === 0) continue
        this.store.saveSection(runId, {
          ...section,
          findings: section.findings.map((f) => {
            const at = found.get(f.id)
            if (!at) return f
            // The prompt is assembled here, from a path the scan supplied, a
            // name that was verified, and the analyser's own words.
            const prompt = {
              title: `Fix at ${at.identifier}`,
              prompt: insightPrompt(at, f.title, f.recommendation),
              intendedOutcome: f.recommendation,
              affectedPaths: [at.file],
            }
            return { ...f, located: at, claudeCodePrompts: [...f.claudeCodePrompts, prompt] }
          }),
        })
        located += found.size
      }
      if (located > 0) {
        note('info', 'analyzing', `Located ${located} finding(s) at a named place in the code`)
      }
    }

    if (cancelled()) return this.finishCancelled(runId, projectId, startedAt)

    // ── 7. Say it in this product's words ──
    //
    // Everything above measured. This rewrites what was measured so it speaks
    // about this product rather than about software in general — the same
    // claim, the same files, the same severity, different sentences.
    //
    // ── The budget is spent by severity, not from the top of the list ──
    //
    // It used to be spent section by section in order, and on a large report it
    // ran out partway down. Measured on a 1,944-file run: 51 findings, a budget
    // of 30, and the sections that happened to sort last — Compliance with nine
    // findings, Security QA, and the Marketing scan with six — got none at all.
    // Every one of their findings kept catalogue wording while informational
    // SEO findings above them were rewritten, purely because of where they sat
    // in the list.
    //
    // The location pass above already takes findings in severity order for
    // exactly this reason, and says so. This now does the same: a critical
    // compliance finding is written up before an informational one anywhere
    // else, and running out costs the least important prose rather than the
    // last four sections.
    if (settings.tailoredWriting && comprehension.model) {
      const product = comprehension.model
      const persistedForRewrite = this.store.getRun(runId)!
      let rewritten = 0
      let briefed = 0

      // Chosen across the whole run first, then applied section by section, so
      // the order of spending and the order of saving are separate decisions.
      const rewriteRank: Record<string, number> = {
        critical: 0, high: 1, medium: 2, low: 3, info: 4,
      }
      const bySeverity = persistedForRewrite.sections
        .flatMap((sec) => sec.findings)
        .sort((a, b) => (rewriteRank[a.severity] ?? 9) - (rewriteRank[b.severity] ?? 9))

      const chosen = new Set(bySeverity.slice(0, REWRITE_BUDGET).map((f) => f.id))

      // ── The brief chooses for itself ──
      //
      // It used to ride along inside the rewrite's selection, which capped it
      // at the rewrite budget however high its own was set. They want different
      // things: a rewrite is worth having on anything a reader will read, while
      // a brief is only worth having on something somebody might build.
      //
      // So observations are left out. An observation asks for nothing — "158
      // tables, 233 references between them" is a fact about the repository —
      // and a page describing what to build in response to one is the clearest
      // possible signal that a template is being filled rather than a question
      // answered.
      const briefing = new Set(
        bySeverity
          .filter((f) => f.severity !== 'info' && f.type !== 'observation')
          .slice(0, BRIEF_BUDGET)
          .map((f) => f.id),
      )

      // The rewrite's share of the bar, spread across the sections that will
      // actually use it.
      //
      // It used to be one lump awarded at the end, while this loop emitted the
      // stage with progress unchanged. That made the longest phase of the run —
      // a model call per finding, across every section with findings — the one
      // phase where the bar did not move at all. Watched, it is indistinguishable
      // from a hung run: the number sat at 84% for ten minutes while the text
      // underneath it worked through fifteen sections. Somebody reasonably
      // concluded it was stuck and pressed Cancel.
      const toWriteUp = persistedForRewrite.sections.filter((s) => s.findings.length > 0).length
      const perSection = toWriteUp > 0 ? WEIGHT.rewrite / toWriteUp : 0

      for (const section of persistedForRewrite.sections) {
        if (cancelled()) break
        if (section.findings.length === 0) continue
        const label = CATEGORY_LABEL[section.category] ?? section.category
        advance(perSection, `Writing up ${label}`)

        try {
          // One call per finding, not one per section. The batched version
          // handed the model nine findings and asked for three fields each —
          // twenty-seven pieces of prose in one generation — and three of the
          // nine came back usable. The location pass, which asks one question
          // about one file, works. The difference is the size of the job.
          const tailored = new Map<string, Awaited<ReturnType<Rewrite>>>()
          const briefs = new Map<string, Awaited<ReturnType<WriteBrief>>>()
          for (const f of section.findings) {
            if (cancelled()) break
            // Both sets are chosen above, by severity across the whole run.
            if (!chosen.has(f.id) && !briefing.has(f.id)) continue
            if (chosen.has(f.id)) {
              const t = await this.rewrite(f, product, scan.files, { signal })
              if (t) tailored.set(f.id, t)
            }

            // ── The recommendation, as something buildable ──
            //
            // Separate budget and separate selection. "Add an error boundary"
            // is a direction, and the distance between a direction and a piece
            // of work is where a report stops being acted on.
            if (briefing.has(f.id)) {
              const b = await this.writeBrief(f, product, { signal })
              if (b) { briefs.set(f.id, b); briefed++ }
            }
          }
          if (tailored.size === 0 && briefs.size === 0) continue

          this.store.saveSection(runId, {
            ...section,
            findings: section.findings.map((f) => {
              const t = tailored.get(f.id)
              const b = briefs.get(f.id)
              if (!t && !b) return f
              return { ...f, ...(t ? { tailored: t } : {}), ...(b ? { brief: b } : {}) }
            }),
          })
          rewritten += tailored.size
        } catch (err: any) {
          // A rewrite failing costs wording, never a finding. It is recorded
          // and the section keeps what it had.
          warnings.push({
            stage: 'analyzing',
            message: `${label} was not rewritten for this product: `
              + `${String(err?.message ?? err)}. Its findings are unaffected.`,
            category: section.category,
          })
        }
      }
      note('info', 'analyzing', `Rewrote ${rewritten} finding(s) for this product`)
    } else if (settings.tailoredWriting && !comprehension.model) {
      warnings.push({
        stage: 'analyzing',
        message: 'Findings were not rewritten for this product, because there is no description '
          + 'of it to rewrite them against. The wording below is the general one.',
      })
    }

    // Not advanced here any more — the loop above spends this weight section by
    // section as it goes. Awarding it again would push the bar past where the
    // work has actually reached, and `advance` ratchets, so it could never come
    // back down. The stage still goes out so the text does not stall on the last
    // section's name while the aggregate runs.
    if (willRewrite) advance(0, 'Writing up the findings')

    if (cancelled()) return this.finishCancelled(runId, projectId, startedAt)

    // ── 5b. What the sections add up to ──
    //
    // Last, and deliberately after adjudication: a theme is built from findings
    // that survived the check against the code they cite. Composing before that
    // would let a withdrawn finding hold up a conclusion, which is the one way
    // this section could state something the report elsewhere disowns.
    //
    // Reading back from the store rather than from a local list, for the same
    // reason the summary does: the sections as persisted are the sections a
    // reader will see.
    try {
      this.store.updateRun(runId, { currentStage: 'Reading the sections together' })
      const forSynthesis = this.store.getRun(runId)!
      const themes = synthesise(forSynthesis.sections)
      this.store.saveSection(runId, { ...themes, completedAt: new Date().toISOString() })
      note('info', 'analyzing', `Cross-domain synthesis: ${themes.findings.length} theme(s)`)
    } catch (err: any) {
      // A synthesis that fails costs a reading of the findings, never a
      // finding. Everything it would have composed is already in the report.
      warnings.push({
        stage: 'analyzing',
        message: `The sections were not read together: ${String(err?.message ?? err)}. `
          + 'Every finding is unaffected.',
        category: 'cross_domain',
      })
    }

    // ── 5c. The findings, as work ──
    //
    // After synthesis, so a theme can become an action like anything else, and
    // after adjudication for the same reason synthesis is: a plan should not
    // schedule work for a finding the report withdrew.
    try {
      this.store.updateRun(runId, { currentStage: 'Putting the findings in order' })
      const forPlan = this.store.getRun(runId)!
      const plan = buildActionPlan(forPlan.sections)
      this.store.saveSection(runId, { ...plan, completedAt: new Date().toISOString() })
      note('info', 'analyzing', `Action plan: ${plan.summary}`)
    } catch (err: any) {
      // The plan is a view of the findings. Losing it loses the ordering, not
      // the findings, and every one of them is still in the report.
      warnings.push({
        stage: 'analyzing',
        message: `The findings were not put in order: ${String(err?.message ?? err)}. `
          + 'Every finding is unaffected.',
        category: 'action_plan',
      })
    }

    // ── 6. Aggregate ──
    this.store.updateRun(runId, { status: 'generating' })
    this.emit({ runId, projectId, status: 'generating' })
    note('info', 'generating', 'Assembling findings and recommendations')

    // Read back from the store rather than from a local accumulator, so the
    // summary describes exactly what was persisted — including the sections
    // that failed, which a local list would have quietly omitted.
    const persisted = this.store.getRun(runId)!
    const summary = summarizeRun(persisted.sections, {
      filesScanned: scan.files.length,
      filesSkipped: scan.skipped.length,
      truncated: scan.truncated,
      limitsHit: scan.limitsHit,
      skipped: scan.skipped,
    })
    advance(WEIGHT.aggregate, 'Assembling findings and recommendations')

    // ── 5. Write the two files ──
    //
    // The status is decided BEFORE the documents are written, and the run
    // object handed to the renderer carries it, so the cover of the PDF states
    // the status the database is about to hold. Rendering first and stamping
    // afterwards would print "Generating" on a finished report.
    const status: RunStatus = errors.length > 0 || warnings.length > 0
      ? 'completed_with_warnings'
      : 'completed'
    const completedAt = new Date().toISOString()
    const finalRun: FlowReportRun = {
      ...persisted, status, summary, comprehension, warnings, errors, completedAt,
      durationMs: Date.now() - startedAt, progress: 1, currentStage: null,
    }

    // The progress goes out with the stage even though it has not moved. An
    // event carrying only a stage leaves a consumer to remember the last
    // number, and one that does not remember renders the bar back at zero
    // while the report is being written.
    this.store.updateRun(runId, { currentStage: 'Writing the report' })
    this.emit({ runId, projectId, currentStage: 'Writing the report', progress: lastProgress })

    const exported = await this.writeExports(runId, project.name,
      project.repositoryDisplayName, settings.depth, finalRun, scan)
    for (const w of exported.warnings) {
      warnings.push(w)
      note('warn', 'generating', w.message)
    }

    advance(WEIGHT.exports, 'Writing the report')

    this.store.updateRun(runId, {
      status,
      progress: 1,
      currentStage: null,
      completedAt,
      durationMs: Date.now() - startedAt,
      summary,
      warnings,
      errors,
    })
    note('info', status, `Run ${status.replace(/_/g, ' ')}`)
    this.emit({ runId, projectId, status, progress: 1 })
  }

  /**
   * Render and store the Markdown and the PDF.
   *
   * ── Neither failure may take the run down ──────────────────────────────────
   *
   * A Markdown failure is a bug in the renderer; a PDF failure is usually the
   * machine — no Chromium, no memory, a font that will not parse. Both become
   * warnings on a run that still holds every finding, because a user who can
   * read the sections on screen has lost far less than one whose whole analysis
   * disappeared over a missing browser.
   *
   * What is NOT done is recording an artifact that was not written. A download
   * button that errors when clicked is worse than one that is absent, since
   * only the second tells the truth before it is pressed.
   */
  private async writeExports(
    runId: string,
    projectName: string,
    repositoryDisplayName: string,
    depth: AnalysisSettings['depth'],
    run: FlowReportRun,
    scan: ScanResult,
  ): Promise<{ warnings: AnalysisWarning[] }> {
    const warnings: AnalysisWarning[] = []
    const generatedAt = (run.completedAt ?? new Date().toISOString()).slice(0, 10)
    const analysisMode = depth.charAt(0).toUpperCase() + depth.slice(1)

    let markdown: string
    try {
      markdown = renderReportMarkdown(run, {
        projectName, repositoryDisplayName, analysisMode, generatedAt,
      })
      this.store.saveArtifact(runId, writeArtifact(runId, projectName, 'markdown', markdown))
    } catch (err: any) {
      warnings.push({
        stage: 'generating',
        message: `The Markdown report could not be written: ${String(err?.message ?? err)}. `
          + 'The findings below are complete; only the download is missing.',
      })
      return { warnings }
    }

    try {
      // Imported here rather than at the top of the module: it pulls in
      // Playwright, and a daemon that never exports a PDF should not pay for
      // loading a browser driver at startup.
      const { renderReportPdf } = await import('./report/pdf.js')

      // Everything drawn on a cover or a divider is derived here, from the same
      // run object that produced the Markdown a few lines up. The Markdown is
      // still the authority; this exists because a page that is drawn cannot be
      // converted from prose, and deriving it anywhere else would make it a
      // second measurement.
      const counted = (findings: typeof run.sections[number]['findings']) =>
        (['critical', 'high', 'medium', 'low', 'info'] as const).reduce((acc, s) => {
          acc[s] = findings.filter((f) => f.severity === s).length
          return acc
        }, {} as Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>)

      const ordered = REPORT_CATEGORIES
        .map((c) => run.sections.find((s) => s.category === c))
        .filter((s): s is typeof run.sections[number] => s !== undefined)

      const pdf = await renderReportPdf(markdown, {
        projectName,
        repositoryDisplayName,
        analysisMode,
        generatedAt,
        runStatus: STATUS_LABEL[run.status] ?? run.status,
        overallScore: run.summary?.overallScore == null
          ? 'Insufficient evidence'
          : `${run.summary.overallScore} / 100`,
        overallScoreValue: run.summary?.overallScore ?? null,
        severityCounts: run.summary?.severityCounts
          ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        sections: ordered.map((s) => ({
          category: s.category,
          status: STATUS_LABEL[s.status] ?? s.status,
          score: s.score,
          findings: s.findings.length,
          counts: counted(s.findings),
          metrics: sectionMetrics(s.findings),
          reason: s.reason ?? null,
        })),
        repoMap: buildRepoMap(scan.files, run.sections.flatMap((s) => s.findings)),
      }, { stamp: new Date(run.completedAt ?? Date.now()), runId, processes: this.processes })

      this.store.saveArtifact(runId, writeArtifact(runId, projectName, 'pdf', pdf.bytes))

      if (pdf.missingFonts.length > 0) {
        warnings.push({
          stage: 'generating',
          message: `The PDF was set in fallback typefaces: ${pdf.missingFonts.join(', ')} `
            + 'were not found. Its content is unaffected.',
        })
      }

      // ── One report per domain, as well as the whole one ──────────────────
      //
      // The combined report is long, and nobody working through the security
      // findings wants to carry forty pages about SEO to do it. Each section is
      // written again on its own, through the same renderers over a run holding
      // only that section — so a domain report is a complete document with its
      // own cover, its own scope and its own score, not an extract.
      //
      // The score is recomputed from that section alone. Carrying the overall
      // figure onto a single-domain cover would put a number there that is not
      // about the thing the document covers.
      //
      // Failures here are per section and never fatal: the combined report is
      // already written and saved by this point.
      for (const section of ordered) {
        const label = CATEGORY_LABEL[section.category] ?? section.category
        this.store.updateRun(runId, { currentStage: `Writing the ${label} report` })

        try {
          const one: FlowReportRun = {
            ...run,
            sections: [section],
            summary: summarizeRun([section], {
              filesScanned: scan.files.length,
              filesSkipped: scan.skipped.length,
              truncated: scan.truncated,
              limitsHit: scan.limitsHit,
              skipped: scan.skipped,
            }),
          }
          const oneMd = renderReportMarkdown(one, {
            projectName: `${projectName} — ${label}`,
            repositoryDisplayName, analysisMode, generatedAt,
          })
          this.store.saveArtifact(runId,
            writeArtifact(runId, projectName, 'markdown', oneMd, section.category))

          // No PDF here, deliberately. Rendering ten of them launched a browser
          // apiece: a run that took about two hundred seconds went past ten
          // minutes and left thirty-eight Chromium processes behind, to produce
          // nine documents nobody had asked for. The Markdown costs nothing —
          // it is string assembly over a report that already exists — so it is
          // always written, and the PDF for one domain is rendered when
          // somebody actually downloads it. See the download route.
        } catch (err: any) {
          warnings.push({
            stage: 'generating',
            message: `The ${label} report could not be written on its own: `
              + `${String(err?.message ?? err)}. It is present in the full report.`,
            category: section.category,
          })
        }
      }
    } catch (err: any) {
      warnings.push({
        stage: 'generating',
        message: `The PDF could not be rendered: ${String(err?.message ?? err)}. `
          + 'The Markdown report is complete and available.',
      })
    }

    return { warnings }
  }

  /**
   * Close out a cancelled run.
   *
   * Progress is left where it stopped rather than being set to 1, and the
   * status is `cancelled` rather than any flavour of complete, so nothing
   * downstream can render a partial report as a whole one.
   */
  private finishCancelled(runId: string, projectId: string, startedAt: number): void {
    const existing = this.store.getRun(runId)
    this.store.updateRun(runId, {
      status: 'cancelled',
      currentStage: null,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      warnings: [
        ...(existing?.warnings ?? []),
        { stage: 'run', message: 'The run was cancelled. Sections not listed here were never started.' },
      ],
    })
    this.store.appendEvent(runId, 'warn', 'run', 'Run cancelled')
    this.emit({ runId, projectId, status: 'cancelled' })
  }
}
