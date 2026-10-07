// Running an analysis, and telling the truth while it runs.
//
// The brief for this feature says progress must be derived from actual
// completed work, never faked. That is the property most of these tests are
// about, along with the two failure modes that matter more than any feature:
//
//   - One section failing must not lose the nine that succeeded.
//   - A cancelled or partial run must never be presentable as a complete one.
//
// A progress bar that reaches 100% while a section is still running is a lie
// the user acts on, so the arithmetic is pinned rather than eyeballed.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { Db } from '../../src/db/db.js'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowReportStore } from '../../src/flowReport/store.js'
import { AnalysisJobManager, type SectionAnalyzer, type AnalysisContext } from '../../src/flowReport/jobManager.js'
import {
  DEFAULT_SETTINGS,
  type Finding, type ReportCategory, type ReportSectionResult, type Severity,
} from '../../src/flowReport/types.js'

/**
 * The product description, stubbed.
 *
 * The real one talks to a local Ollama: ten to twenty seconds per run, and not
 * running on every machine. A suite that called it would be slow, would fail on
 * a laptop with the container stopped, and would be testing the model rather
 * than the pipeline.
 *
 * Returns a description rather than an absence: an absent model is a
 * legitimate degraded run that raises a warning, and every test that just
 * wants a clean run would have been asserting the degraded path instead.
 */

/** The per-product rewrite, stubbed. Same reason as the description above: it
 *  talks to the same container, and a suite that called it would spend ninety
 *  seconds proving the model can write English. One call per finding now, so
 *  null is the answer for "nothing to add". */
const noRewrite = async () => null

/** The evidence check, stubbed. Same reason as the two above: it talks to the
 *  same container. Withdrawing nothing is the neutral answer — every finding
 *  the analysers produced reaches the assertions unchanged. */
const withdrawNothing = async () => new Map()

/** The absence check, stubbed. Same reason as the passes above: it talks to
 *  the same container, one call per absence finding. Checking nothing is the
 *  neutral answer — every absence reaches the assertions as measured. */
const checkNoAbsences = async () => new Map()

/** The per-file location pass, stubbed: one model call per finding, and a
 *  suite that made them would spend a minute proving the container is up. */
const locateNothing = async () => null

/** The buildable brief, stubbed: five fields in one generation, and the most
 *  expensive call in a run. Writing none is the neutral answer — the one-line
 *  recommendation every finding already carries is unaffected. */
const noBrief = async () => null

const noComprehension = async () => ({
  producedBy: 'stub',
  filesRead: ['package.json'],
  reason: null,
  model: {
    whatItIs: 'A small example web application.',
    domain: 'example',
    isTwoSidedMarketplace: false,
    actors: [{ name: 'User', goal: 'Use the app' }],
    coreFlows: [{ name: 'Open the app', steps: ['Load the page'] }],
    entities: ['Thing'],
    externalServices: [],
    architecture: 'A single-page React application.',
    unknowns: [],
  },
})


let dir: string
let repo: string
let store: FlowReportStore
let manager: AnalysisJobManager

/** A section that succeeds, optionally after a delay so cancellation has
 *  somewhere to land. */
const ok = (category: ReportCategory, delayMs = 0): SectionAnalyzer => ({
  category,
  async run(): Promise<ReportSectionResult> {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    return {
      category, status: 'completed', score: 70,
      summary: `${category} ok`, findings: [], limitations: [],
    }
  },
})

/** A section with a finding in it, so the write-up loop has something to do.
 *  `ok` returns none, and the loop skips empty sections. */
const withFinding = (category: ReportCategory): SectionAnalyzer => ({
  category,
  async run(): Promise<ReportSectionResult> {
    return {
      category, status: 'completed', score: 70, summary: `${category} ok`, limitations: [],
      findings: [{
        id: `${category}-1`,
        category,
        title: 'Something worth writing up',
        summary: 's',
        severity: 'high',
        confidence: 'indicated',
        status: 'open',
        impact: 'i',
        recommendation: 'r',
        rationale: 'ra',
        evidence: [],
        claudeCodePrompts: [],
      }] as never,
    }
  },
})

const throws = (category: ReportCategory, message = 'boom'): SectionAnalyzer => ({
  category,
  async run(): Promise<ReportSectionResult> { throw new Error(message) },
})

const notApplicable = (category: ReportCategory): SectionAnalyzer => ({
  category,
  async run(): Promise<ReportSectionResult> {
    return {
      category, status: 'not_applicable', score: null,
      summary: '', findings: [], limitations: [],
      reason: 'No marketplace concepts were found.',
    }
  },
})

const makeProject = (over: { settings?: typeof DEFAULT_SETTINGS } = {}) => store.createProject({
  name: 'P', repositoryDisplayName: 'repo', repositoryPath: repo,
  settings: over.settings ?? DEFAULT_SETTINGS,
})

/**
 * Pay the one-off module cost before anything is timed.
 *
 * ── The flake this fixes ─────────────────────────────────────────────────────
 *
 * Every test below asserts on a run that finishes in about 1.3 seconds — except
 * whichever one happened to go first, which took five and timed out. The excess
 * was not the pipeline: `writeExports` reaches the PDF renderer through a lazy
 * `import()`, and that module pulls in ECharts. Measured cold on an idle
 * machine it is 1,266ms, and under a hundred and seventy test files running in
 * parallel it is enough to push the first test past the default timeout.
 *
 * Loading it here puts the cost where there is budget for it, and leaves the
 * 5s default meaning what it should — that a RUN got slow, not that a module
 * did.
 */
beforeAll(async () => {
  await import('../../src/flowReport/report/pdf.js')
}, 60_000)

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'flow-reports-job-'))
  repo = join(dir, 'repo')
  mkdirSync(join(repo, 'src'), { recursive: true })
  writeFileSync(join(repo, 'src', 'index.ts'), 'export const a = 1')
  writeFileSync(join(repo, 'package.json'), '{"name":"repo"}')
  store = new FlowReportStore(new Db(join(dir, 'flow-reports.db')))
  manager = new AnalysisJobManager(store, { adjudicate: withdrawNothing as never, verifyAbsences: checkNoAbsences as never, locate: locateNothing as never, writeBrief: noBrief as never, comprehend: noComprehension, rewrite: noRewrite as never })
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('a successful run', () => {
  it('completes, and records the sections it ran', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('security_qa'), ok('seo')])
    await manager.wait(run.id)
    const got = store.getRun(run.id)!
    expect(got.status).toBe('completed')
    // Synthesis and the action plan are post-passes over the finished sections
    // rather than analysers, so both appear whatever was passed in — reporting
    // that nothing composed, and that nothing asked for work, rather than
    // leaving the headings out.
    expect(got.sections.map((s) => s.category).sort())
      .toEqual(['action_plan', 'cross_domain', 'security_qa', 'seo'])
    expect(got.progress).toBe(1)
  })

  it('records a start and a completion time, and a duration', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('seo')])
    await manager.wait(run.id)
    const got = store.getRun(run.id)!
    expect(got.startedAt).toBeTruthy()
    expect(got.completedAt).toBeTruthy()
    expect(got.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('moves through the stages rather than jumping to completed', async () => {
    const p = makeProject()
    const seen: string[] = []
    manager.subscribe((e) => { if (e.status) seen.push(e.status) })
    const run = await manager.start(p.id, [ok('seo')])
    await manager.wait(run.id)
    expect(seen).toContain('scanning')
    expect(seen).toContain('analyzing')
    expect(seen[seen.length - 1]).toBe('completed')
  })
})

describe('progress is derived, not invented', () => {
  it('rises monotonically and ends at exactly 1', async () => {
    const p = makeProject()
    const values: number[] = []
    manager.subscribe((e) => { if (typeof e.progress === 'number') values.push(e.progress) })
    const run = await manager.start(p.id, [ok('seo'), ok('security_qa'), ok('compliance')])
    await manager.wait(run.id)
    expect(values.length).toBeGreaterThan(1)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!)
    }
    expect(values[values.length - 1]).toBe(1)
  })

  // The specific lie this guards against: a bar that reads 100% while work
  // remains, which makes a user close the window on a half-finished run.
  it('never reports 1 before the last section has finished', async () => {
    const p = makeProject()
    let sectionsDone = 0
    const counting = (c: ReportCategory): SectionAnalyzer => ({
      category: c,
      async run() {
        await new Promise((r) => setTimeout(r, 5))
        sectionsDone += 1
        return { category: c, status: 'completed', score: 1, summary: '', findings: [], limitations: [] }
      },
    })
    let sawFullBeforeDone = false
    manager.subscribe((e) => {
      if (e.progress === 1 && sectionsDone < 3) sawFullBeforeDone = true
    })
    const run = await manager.start(p.id, [counting('seo'), counting('compliance'), counting('security_qa')])
    await manager.wait(run.id)
    expect(sawFullBeforeDone).toBe(false)
  })

  // The failure this guards against, measured on a real run: the bar reached
  // 84% within seconds and stayed there for ten minutes while the text below it
  // worked through fifteen sections. The rewrite — a model call per finding,
  // the longest phase by far — was one lump of weight awarded at the end, so
  // the phase that takes the most time was the phase where nothing moved.
  // Watched, that is indistinguishable from a hung run, and it was reasonably
  // mistaken for one.
  it('keeps moving while the findings are being written up', async () => {
    const p = makeProject({ settings: { ...DEFAULT_SETTINGS, tailoredWriting: true } })
    const duringWriteUp: number[] = []
    let writingUp = false
    manager.subscribe((e) => {
      if (e.currentStage?.startsWith('Writing up ')) writingUp = true
      if (writingUp && typeof e.progress === 'number') duringWriteUp.push(e.progress)
    })
    const run = await manager.start(p.id, [withFinding('seo'), withFinding('compliance')])
    await manager.wait(run.id)

    // More than one distinct value while writing up: the bar moved rather than
    // repeating the number it arrived with.
    expect(new Set(duringWriteUp).size).toBeGreaterThan(1)
  })

  it('reports a stage a person can read, not an internal name', async () => {
    const p = makeProject()
    const stages: string[] = []
    manager.subscribe((e) => { if (e.currentStage) stages.push(e.currentStage) })
    const run = await manager.start(p.id, [ok('seo')])
    await manager.wait(run.id)
    expect(stages.some((s) => /repository|structure|boundar/i.test(s))).toBe(true)
    expect(stages.every((s) => s === s.trim() && s.length > 3)).toBe(true)
  })
})

describe('one section failing does not lose the others', () => {
  it('keeps the successful sections and completes with warnings', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('seo'), throws('monetization'), ok('security_qa')])
    await manager.wait(run.id)
    const got = store.getRun(run.id)!
    expect(got.status).toBe('completed_with_warnings')
    const byCategory = Object.fromEntries(got.sections.map((s) => [s.category, s]))
    expect(byCategory.seo?.status).toBe('completed')
    expect(byCategory.security_qa?.status).toBe('completed')
    expect(byCategory.monetization?.status).toBe('failed')
  })

  it('records why the section failed, where the report can print it', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [throws('monetization', 'parser exploded')])
    await manager.wait(run.id)
    const got = store.getRun(run.id)!
    expect(got.sections[0]?.reason).toMatch(/parser exploded/)
    expect(got.errors.some((e) => e.category === 'monetization')).toBe(true)
  })

  // A failed section scored zero would drag the overall score down as if the
  // project were bad at something nobody measured.
  it('leaves a failed section unscored rather than scoring it zero', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [throws('monetization')])
    await manager.wait(run.id)
    expect(store.getRun(run.id)!.sections[0]?.score).toBeNull()
  })

  it('treats a not-applicable section as a real answer, not a failure', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('seo'), notApplicable('marketplace_health')])
    await manager.wait(run.id)
    const got = store.getRun(run.id)!
    expect(got.status).toBe('completed')
    const market = got.sections.find((s) => s.category === 'marketplace_health')!
    expect(market.status).toBe('not_applicable')
    expect(market.reason).toMatch(/marketplace concepts/i)
  })
})

describe('cancellation', () => {
  it('stops the run and marks it cancelled', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('seo', 50), ok('compliance', 50), ok('security_qa', 50)])
    await new Promise((r) => setTimeout(r, 10))
    manager.cancel(run.id)
    await manager.wait(run.id)
    expect(store.getRun(run.id)!.status).toBe('cancelled')
  })

  it('keeps whatever finished before the cancellation', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('seo'), ok('compliance', 200), ok('security_qa', 200)])
    await new Promise((r) => setTimeout(r, 60))
    manager.cancel(run.id)
    await manager.wait(run.id)
    const got = store.getRun(run.id)!
    expect(got.sections.some((s) => s.category === 'seo' && s.status === 'completed')).toBe(true)
  })

  // A cancelled run that looks complete is the worst outcome here: somebody
  // downloads it and acts on a report of a third of their repository.
  it('never reaches full progress when cancelled', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('seo', 100), ok('compliance', 100)])
    await new Promise((r) => setTimeout(r, 10))
    manager.cancel(run.id)
    await manager.wait(run.id)
    const got = store.getRun(run.id)!
    expect(got.progress).toBeLessThan(1)
    expect(got.status).not.toBe('completed')
  })

  it('ignores a cancel for a run that already finished', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('seo')])
    await manager.wait(run.id)
    expect(() => manager.cancel(run.id)).not.toThrow()
    expect(store.getRun(run.id)!.status).toBe('completed')
  })
})

describe('when the repository is gone', () => {
  it('fails with a reason the user can act on rather than a stack trace', async () => {
    const p = store.createProject({
      name: 'Missing', repositoryDisplayName: 'gone',
      repositoryPath: join(dir, 'does-not-exist'), settings: DEFAULT_SETTINGS,
    })
    const run = await manager.start(p.id, [ok('seo')])
    await manager.wait(run.id)
    const got = store.getRun(run.id)!
    expect(got.status).toBe('failed')
    expect(got.errors[0]?.message).toMatch(/does not exist|not visible/i)
    expect(got.errors[0]?.message).not.toMatch(/at Object\.|node:internal/)
  })

  it('does not run any section when the boundary refuses', async () => {
    const p = store.createProject({
      name: 'Missing2', repositoryDisplayName: 'gone',
      repositoryPath: join(dir, 'nope'), settings: DEFAULT_SETTINGS,
    })
    const ran = vi.fn()
    const spy: SectionAnalyzer = {
      category: 'seo',
      async run() {
        ran()
        return { category: 'seo', status: 'completed', score: 1, summary: '', findings: [], limitations: [] }
      },
    }
    const run = await manager.start(p.id, [spy])
    await manager.wait(run.id)
    expect(ran).not.toHaveBeenCalled()
  })
})

// ── Withdrawing a finding the evidence does not support ────────────────────
//
// The analysers are pattern matchers and cannot tell what they matched. A site
// that bills nobody was told at high severity that its renewal terms were
// undisclosed, because the gate matched six files — every one of them the word
// UNsubscribe in newsletter code. This stage exists to catch that, and what
// matters is that it removes the finding without removing the trail.
describe('checking findings against the code they cite', () => {
  const withFindings = (category: ReportCategory): SectionAnalyzer => ({
    category,
    async run(): Promise<ReportSectionResult> {
      const f = (id: string, severity: Severity): Finding => ({
        id, category, title: `finding ${id}`, summary: 's', severity,
        confidence: 'high', status: 'open', impact: 'i', recommendation: 'r',
        rationale: 'ra', evidence: [], claudeCodePrompts: [],
      })
      return {
        category, status: 'completed', score: 40,
        summary: 'two findings', limitations: ['an existing limitation'],
        findings: [f('keep-me', 'low'), f('drop-me', 'critical')],
      }
    },
  })

  const withdrawing = (id: string, reason: string) =>
    async () => new Map([[id, { reason }]])

  it('removes a withdrawn finding and keeps the rest', async () => {
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never,
      verifyAbsences: checkNoAbsences as never, writeBrief: noBrief as never,
      adjudicate: withdrawing('drop-me', 'the match was an unrelated word') as never,
    })
    const p = makeProject()
    const run = await m.start(p.id, [withFindings('compliance')])
    await m.wait(run.id)
    const s = store.getRun(run.id)!.sections[0]!
    expect(s.findings.map((f) => f.id)).toEqual(['keep-me'])
  })

  it('says how many went and why, where the report prints limitations', async () => {
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never,
      verifyAbsences: checkNoAbsences as never, writeBrief: noBrief as never,
      adjudicate: withdrawing('drop-me', 'the match was an unrelated word') as never,
    })
    const p = makeProject()
    const run = await m.start(p.id, [withFindings('compliance')])
    await m.wait(run.id)
    const s = store.getRun(run.id)!.sections[0]!
    const note = s.limitations.find((l) => /withdrawn/.test(l))
    expect(note).toBeTruthy()
    expect(note).toMatch(/the match was an unrelated word/)
    // The limitation it already had is not replaced by the new one.
    expect(s.limitations).toContain('an existing limitation')
  })

  // A score is a function of what the section still says. Leaving the old one
  // would price a critical finding that is no longer in the report.
  it('rescores the section without the withdrawn finding', async () => {
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never,
      verifyAbsences: checkNoAbsences as never, writeBrief: noBrief as never,
      adjudicate: withdrawing('drop-me', 'unrelated') as never,
    })
    const p = makeProject()
    const run = await m.start(p.id, [withFindings('compliance')])
    await m.wait(run.id)
    const s = store.getRun(run.id)!.sections[0]!
    expect(s.score).not.toBe(40)
    expect(s.score).toBeGreaterThan(40)
  })

  it('leaves the section alone when the check itself fails', async () => {
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never,
      verifyAbsences: checkNoAbsences as never, writeBrief: noBrief as never,
      adjudicate: (async () => { throw new Error('model unreachable') }) as never,
    })
    const p = makeProject()
    const run = await m.start(p.id, [withFindings('compliance')])
    await m.wait(run.id)
    const persisted = store.getRun(run.id)!
    expect(persisted.sections[0]!.findings).toHaveLength(2)
    // Recorded rather than swallowed: a check that did not run is not a check
    // that passed.
    expect(persisted.warnings.some((w) => /not checked against the code/.test(w.message))).toBe(true)
  })
})

// ── Pointing at where in the code a finding is ──────────────────────────────
//
// The analysers know what is wrong and which file it is in; they do not know
// which function. One model call per finding closes that gap, and what matters
// here is that the claim and the path stay deterministic while only the name
// comes from the model.
describe('locating a finding in the code', () => {
  const withFinding = (category: ReportCategory): SectionAnalyzer => ({
    category,
    async run(): Promise<ReportSectionResult> {
      const f: Finding = {
        id: 'catch-swallow', category,
        title: 'Catch blocks that discard the error they caught',
        summary: 's', severity: 'high' as Severity, confidence: 'high', status: 'open',
        impact: 'i', recommendation: 'Surface or report it.', rationale: 'ra',
        evidence: [{ kind: 'file', path: 'src/index.ts', description: 'd' }],
        claudeCodePrompts: [],
      }
      return {
        category, status: 'completed', score: 40,
        summary: 'one finding', findings: [f], limitations: [],
      }
    },
  })

  const locating = async (file: string) => ({ file, identifier: 'a', where: 'the catch block' })

  it('records the name, and builds a prompt that can be run', async () => {
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never, adjudicate: withdrawNothing as never,
      verifyAbsences: checkNoAbsences as never, writeBrief: noBrief as never,
      locate: ((f: string) => locating(f)) as never,
    })
    const p = makeProject()
    const run = await m.start(p.id, [withFinding('error_log')])
    await m.wait(run.id)
    const f = store.getRun(run.id)!.sections[0]!.findings[0]!

    expect(f.located).toEqual({ file: 'src/index.ts', identifier: 'a', where: 'the catch block' })
    const prompt = f.claudeCodePrompts.at(-1)!
    expect(prompt.prompt).toContain('Open src/index.ts and fix a')
    // The claim in the prompt is the analyser's, not the model's.
    expect(prompt.prompt).toContain('Catch blocks that discard the error they caught')
    expect(prompt.affectedPaths).toEqual(['src/index.ts'])
  })

  it('leaves the finding alone when nothing could be located', async () => {
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never, adjudicate: withdrawNothing as never,
      verifyAbsences: checkNoAbsences as never, writeBrief: noBrief as never,
      locate: (async () => null) as never,
    })
    const p = makeProject()
    const run = await m.start(p.id, [withFinding('error_log')])
    await m.wait(run.id)
    const f = store.getRun(run.id)!.sections[0]!.findings[0]!
    expect(f.located).toBeUndefined()
    expect(f.claudeCodePrompts).toEqual([])
  })

  // One finding without a location is not a failed run.
  it('survives the pass throwing', async () => {
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never, adjudicate: withdrawNothing as never,
      verifyAbsences: checkNoAbsences as never, writeBrief: noBrief as never,
      locate: (async () => { throw new Error('model gone') }) as never,
    })
    const p = makeProject()
    const run = await m.start(p.id, [withFinding('error_log')])
    await m.wait(run.id)
    const got = store.getRun(run.id)!
    expect(['completed', 'completed_with_warnings']).toContain(got.status)
    expect(got.sections[0]!.findings).toHaveLength(1)
  })
})

describe('the diagnostic log', () => {
  it('records what happened, in order, for the developer panel', async () => {
    const p = makeProject()
    const run = await manager.start(p.id, [ok('seo'), throws('monetization')])
    await manager.wait(run.id)
    const events = store.listEvents(run.id)
    expect(events.length).toBeGreaterThan(2)
    expect(events.some((e) => e.level === 'error' && /monetization/.test(e.message))).toBe(true)
  })
})

describe('what the analyser is given', () => {
  it('receives the scanned files and the settings, not a raw path', async () => {
    const p = makeProject()
    let ctx: AnalysisContext | null = null
    const capture: SectionAnalyzer = {
      category: 'seo',
      async run(c) {
        ctx = c
        return { category: 'seo', status: 'completed', score: 1, summary: '', findings: [], limitations: [] }
      },
    }
    const run = await manager.start(p.id, [capture])
    await manager.wait(run.id)
    expect(ctx!.files.some((f) => f.path === 'src/index.ts')).toBe(true)
    expect(ctx!.settings.depth).toBe('standard')
    // Repository-relative only, so a finding cannot carry a local path.
    for (const f of ctx!.files) expect(f.path).not.toMatch(/^[A-Za-z]:|^\//)
  })

  it('can tell the analyser the scan was truncated', async () => {
    const p = makeProject()
    for (let i = 0; i < 30; i++) writeFileSync(join(repo, 'src', `f${i}.ts`), 'x')
    let ctx: AnalysisContext | null = null
    const capture: SectionAnalyzer = {
      category: 'seo',
      async run(c) {
        ctx = c
        return { category: 'seo', status: 'completed', score: 1, summary: '', findings: [], limitations: [] }
      },
    }
    const run = await manager.start(p.id, [capture], { maxFiles: 3 })
    await manager.wait(run.id)
    expect(ctx!.scan.truncated).toBe(true)
  })
})

describe('which findings get a buildable brief', () => {
  const section = (category: ReportCategory, findings: Finding[]): SectionAnalyzer => ({
    category,
    async run(): Promise<ReportSectionResult> {
      return {
        category, status: 'completed', score: 40,
        summary: '', findings, limitations: [],
      }
    },
  })

  const f = (id: string, severity: Severity, over: Partial<Finding> = {}): Finding => ({
    id, category: 'compliance', title: `finding ${id}`, summary: 's', severity,
    confidence: 'high', status: 'open', impact: 'i', recommendation: 'r',
    rationale: 'ra', evidence: [], claudeCodePrompts: [], ...over,
  })

  /** Records which findings the brief pass was asked about. */
  const recording = () => {
    const asked: string[] = []
    return {
      asked,
      writeBrief: (async (finding: Finding) => { asked.push(finding.id); return null }) as never,
    }
  }

  // ── An observation asks for nothing ──
  //
  // "158 tables, 233 references between them" is a fact about the repository.
  // A page describing what to build in response to one is the clearest possible
  // signal that a template is being filled rather than a question answered.
  it('leaves out observations, which ask for nothing', async () => {
    const r = recording()
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never,
      adjudicate: withdrawNothing as never, verifyAbsences: checkNoAbsences as never,
      locate: locateNothing as never, writeBrief: r.writeBrief,
    })
    const p = makeProject()
    const run = await m.start(p.id, [section('compliance', [
      f('real', 'high'),
      f('an-observation', 'info'),
      f('typed-observation', 'low', { type: 'observation' }),
    ])])
    await m.wait(run.id)
    expect(r.asked).toEqual(['real'])
  })

  // It used to ride inside the rewrite's selection, so its own budget could
  // never take it past the rewrite's however high it was set.
  it('is not capped by the rewrite budget', async () => {
    const r = recording()
    const m = new AnalysisJobManager(store, {
      comprehend: noComprehension, rewrite: noRewrite as never,
      adjudicate: withdrawNothing as never, verifyAbsences: checkNoAbsences as never,
      locate: locateNothing as never, writeBrief: r.writeBrief,
    })
    const p = makeProject()
    const many = Array.from({ length: 34 }, (_, i) => f(`n${i}`, 'medium'))
    const run = await m.start(p.id, [section('compliance', many)])
    await m.wait(run.id)
    expect(r.asked.length).toBe(34)
  })
})
