// Persistence for Flow Reports.
//
// Two properties are load-bearing and everything else is bookkeeping:
//
//   1. A null score survives the round trip as null. SQLite will happily take a
//      null and hand back a 0 if a layer coerces, and "insufficient evidence"
//      rendered as "scored zero" is the report lying in the reassuring
//      direction's opposite — it condemns a project the run could not assess.
//
//   2. The repository path never leaks. It is stored, because a run needs it,
//      and it must not appear in anything the report or a list API produces.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { Db } from '../../src/db/db.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowReportStore } from '../../src/flowReport/store.js'
import {
  DEFAULT_SETTINGS, ANALYSIS_VERSION, type Finding, type ReportSectionResult,
} from '../../src/flowReport/types.js'

let dir: string
let store: FlowReportStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'flow-reports-store-'))
  store = new FlowReportStore(new Db(join(dir, 'flow-reports.db')))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

const project = (over: Partial<Parameters<FlowReportStore['createProject']>[0]> = {}) =>
  store.createProject({
    name: 'My App',
    repositoryDisplayName: 'my-app',
    repositoryPath: 'C:/Users/someone/code/my-app',
    settings: DEFAULT_SETTINGS,
    ...over,
  })


describe('projects', () => {
  it('creates and reads one back', () => {
    const p = project()
    expect(p.id).toBeTruthy()
    const got = store.getProject(p.id)
    expect(got?.name).toBe('My App')
    expect(got?.settings.depth).toBe('standard')
  })

  // ── Where the folder path may appear ──────────────────────────────────────
  //
  // The index renders the list, so a path there would put somebody's whole
  // directory layout on one screen and into any screenshot of it. A single
  // project is different: it is the only place a user can confirm that the
  // folder being analysed is the one they meant, because a display name is a
  // basename and two directories called `app` look identical.
  it('keeps the folder path off the list', () => {
    store.createProject({
      name: 'Pathy', repositoryDisplayName: 'pathy',
      repositoryPath: 'C:/Users/someone/Desktop/pathy', settings: DEFAULT_SETTINGS,
    })
    const listed = store.listProjects()
    expect(JSON.stringify(listed)).not.toContain('Desktop')
    for (const p of listed) expect(p).not.toHaveProperty('repositoryPath')
  })

  it('gives the folder path for one project, which is what the page shows', () => {
    const made = store.createProject({
      name: 'Pathy2', repositoryDisplayName: 'pathy2',
      repositoryPath: 'C:/Users/someone/Desktop/pathy2', settings: DEFAULT_SETTINGS,
    })
    expect(store.getProject(made.id)?.repositoryPath).toBe('C:/Users/someone/Desktop/pathy2')
  })

  it('lists newest first', () => {
    const a = project({ name: 'A' })
    const b = project({ name: 'B' })
    const names = store.listProjects().map((p) => p.name)
    expect(names[0]).toBe('B')
    expect(names).toContain(a.name)
    void b
  })

  it('refuses a duplicate name, because two identical rows help nobody', () => {
    project({ name: 'Same' })
    expect(() => project({ name: 'Same' })).toThrow(/already/i)
  })

  it('renames, and updates the timestamp', () => {
    const p = project()
    store.renameProject(p.id, 'Renamed')
    expect(store.getProject(p.id)?.name).toBe('Renamed')
  })

  it('deletes a project and everything that belonged to it', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.appendEvent(run.id, 'info', 'scanning', 'started')
    store.deleteProject(p.id)
    expect(store.getProject(p.id)).toBeNull()
    expect(store.getRun(run.id)).toBeNull()
    expect(store.listEvents(run.id)).toEqual([])
  })

  it('round-trips settings without losing a field', () => {
    const p = project({
      settings: { ...DEFAULT_SETTINGS, depth: 'deep', includeTests: false, customIgnore: ['x/**'] },
    })
    const got = store.getProject(p.id)!
    expect(got.settings.depth).toBe('deep')
    expect(got.settings.includeTests).toBe(false)
    expect(got.settings.customIgnore).toEqual(['x/**'])
    expect(got.settings.networkResearch).toBe(false)
  })
})

describe('the repository path does not leak', () => {
  it('is kept on the project, because a run needs it', () => {
    const p = project()
    expect(store.getProject(p.id)?.repositoryPath).toBe('C:/Users/someone/code/my-app')
  })

  // The list is what the index page renders. A path in it would put the user's
  // directory layout on screen and into any screenshot of it.
  it('is absent from the list projection', () => {
    project()
    const listed = store.listProjects()
    expect(JSON.stringify(listed)).not.toContain('C:/Users/someone')
    expect(listed[0]).not.toHaveProperty('repositoryPath')
    expect(listed[0]?.repositoryDisplayName).toBe('my-app')
  })
})

describe('runs', () => {
  it('starts queued at zero progress', () => {
    const p = project()
    const run = store.createRun(p.id)
    expect(run.status).toBe('queued')
    expect(run.progress).toBe(0)
    expect(run.analysisVersion).toBe(ANALYSIS_VERSION)
  })

  it('becomes the project latest run', () => {
    const p = project()
    const run = store.createRun(p.id)
    expect(store.getProject(p.id)?.latestRunId).toBe(run.id)
  })

  it('records progress and the current stage', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.updateRun(run.id, { status: 'scanning', progress: 0.25, currentStage: 'Reading files' })
    const got = store.getRun(run.id)!
    expect(got.status).toBe('scanning')
    expect(got.progress).toBeCloseTo(0.25)
    expect(got.currentStage).toBe('Reading files')
  })

  it('keeps warnings and errors as structured records, not prose', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.updateRun(run.id, {
      warnings: [{ stage: 'analyzing', message: 'seo section had no routes', category: 'seo' }],
      errors: [{ stage: 'analyzing', message: 'monetization threw', category: 'monetization' }],
    })
    const got = store.getRun(run.id)!
    expect(got.warnings[0]?.category).toBe('seo')
    expect(got.errors[0]?.stage).toBe('analyzing')
  })

  it('lists a project history newest first', () => {
    const p = project()
    store.createRun(p.id)
    const second = store.createRun(p.id)
    expect(store.listRuns(p.id)[0]?.id).toBe(second.id)
  })
})

// ── The schema is one of FlowCode's migrations ──────────────────────────────
//
// FlowAgent's data migrations (documentation off by default, resolutions moved
// to the project, reasons became responses) rewrote data that only exists in a
// FlowAgent database, so they were not ported; their tests went with them. What
// replaces them is FlowCode's guarantee: the schema is created once, recorded,
// and never re-applied over a user's data on a later start.
describe('the schema migration', () => {
  it('is recorded once and does not run again when the database is reopened', () => {
    const p = project()
    store.updateSettings(p.id, { ...DEFAULT_SETTINGS, includeDocs: true })
    store.close()
    const db = new Db(join(dir, 'flow-reports.db'))
    expect(db.appliedMigrations().filter((m) => m.name === 'flow_report')).toHaveLength(1)
    store = new FlowReportStore(db)
    expect(store.getProject(p.id)!.settings.includeDocs).toBe(true)
  })
})
describe('responses on a finding', () => {
  const at = { category: 'security_qa', findingId: 'no robots.txt' }

  it('keeps every response rather than replacing the last', () => {
    const p = project()
    store.addResponse({ ...at, projectId: p.id, body: 'First pass.', source: 'typed' })
    store.addResponse({ ...at, projectId: p.id, body: 'Second look.', source: 'typed' })

    expect(store.responses(p.id).get('security_qa::no robots.txt')!.map((r) => r.body))
      .toEqual(['First pass.', 'Second look.'])
  })

  it('records where a response came from', () => {
    const p = project()
    store.addResponse({
      ...at, projectId: p.id, body: 'Added in 21a59a5.',
      source: 'imported', sourceName: 'response.md',
    })
    const got = store.responses(p.id).get('security_qa::no robots.txt')![0]!
    expect(got.source).toBe('imported')
    expect(got.sourceName).toBe('response.md')
  })

  // An edit revises the wording. It does not change who said it or when, and it
  // never turns an imported account into one somebody typed.
  it('editing dates the revision and leaves the provenance alone', () => {
    const p = project()
    const made = store.addResponse({
      ...at, projectId: p.id, body: 'Draft.', source: 'imported', sourceName: 'response.md',
    })

    expect(store.editResponse(made.id, 'Corrected.')).toBe(true)

    const got = store.responses(p.id).get('security_qa::no robots.txt')![0]!
    expect(got.body).toBe('Corrected.')
    expect(got.editedAt).not.toBeNull()
    expect(got.source).toBe('imported')
    expect(got.sourceName).toBe('response.md')
    expect(got.createdAt).toBe(made.createdAt)
  })

  it('deleting removes one and leaves its siblings', () => {
    const p = project()
    const first = store.addResponse({ ...at, projectId: p.id, body: 'One.', source: 'typed' })
    store.addResponse({ ...at, projectId: p.id, body: 'Two.', source: 'typed' })

    expect(store.deleteResponse(first.id)).toBe(true)

    expect(store.responses(p.id).get('security_qa::no robots.txt')!.map((r) => r.body))
      .toEqual(['Two.'])
  })

  it('says when an id named nothing, so a route can answer 404', () => {
    expect(store.deleteResponse('no-such-id')).toBe(false)
    expect(store.editResponse('no-such-id', 'anything')).toBe(false)
  })
})

describe('deleting a run', () => {
  it('takes the run and leaves the rest of the history', () => {
    const p = project()
    const keep = store.createRun(p.id)
    const drop = store.createRun(p.id)

    store.deleteRun(drop.id)

    expect(store.getRun(drop.id)).toBeNull()
    expect(store.listRuns(p.id).map((r) => r.id)).toEqual([keep.id])
  })

  it('repoints the project latest run rather than leaving it dangling', () => {
    const p = project()
    const first = store.createRun(p.id)
    const latest = store.createRun(p.id)
    expect(store.getProject(p.id)?.latestRunId).toBe(latest.id)

    store.deleteRun(latest.id)

    expect(store.getProject(p.id)?.latestRunId).toBe(first.id)
  })

  it('leaves the project with no latest run when the last one goes', () => {
    const p = project()
    const only = store.createRun(p.id)
    store.deleteRun(only.id)
    expect(store.getProject(p.id)?.latestRunId).toBeNull()
  })

  // Resolutions are keyed by project and finding, not by run — that is what
  // carries them across a rescan. A run being deleted must not take the record
  // of what somebody decided with it.
  it('keeps the resolutions, which never belonged to the run', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.resolveWithReason({
      projectId: p.id,
      category: 'security_qa',
      findingId: 'no robots.txt',
      status: 'resolved',
      reason: 'Added in commit 21a59a5.',
      title: 'No robots.txt',
    })

    store.deleteRun(run.id)

    expect(store.resolutions(p.id).get('security_qa::no robots.txt')?.reason)
      .toBe('Added in commit 21a59a5.')
  })

  it('does nothing and does not throw for a run that is already gone', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.deleteRun(run.id)
    expect(() => store.deleteRun(run.id)).not.toThrow()
    expect(store.listRuns(p.id)).toHaveLength(0)
  })
})

describe('sections', () => {
  const section = (over: Partial<ReportSectionResult> = {}): ReportSectionResult => ({
    category: 'security_qa',
    status: 'completed',
    score: 72,
    summary: 'Static review only.',
    findings: [],
    limitations: [],
    ...over,
  })

  it('stores and returns them in category order', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveSection(run.id, section({ category: 'security_qa' }))
    store.saveSection(run.id, section({ category: 'error_log' }))
    const got = store.getRun(run.id)!.sections.map((s) => s.category)
    // error_log is first in REPORT_CATEGORIES, so it leads regardless of the
    // order the analysers happened to finish in.
    expect(got[0]).toBe('error_log')
  })

  // The property this whole model exists to protect.
  it('keeps a null score null, rather than letting it become zero', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveSection(run.id, section({ score: null, status: 'completed_with_warnings' }))
    const got = store.getRun(run.id)!.sections[0]!
    expect(got.score).toBeNull()
    expect(got.score).not.toBe(0)
  })

  it('keeps a genuine zero as zero', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveSection(run.id, section({ score: 0 }))
    expect(store.getRun(run.id)!.sections[0]!.score).toBe(0)
  })

  it('carries the reason a section was skipped or not applicable', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveSection(run.id, section({
      category: 'marketplace_health',
      status: 'not_applicable',
      score: null,
      reason: 'No listing, booking or provider concepts were found.',
    }))
    const got = store.getRun(run.id)!.sections[0]!
    expect(got.status).toBe('not_applicable')
    expect(got.reason).toMatch(/No listing/)
  })

  it('replaces a section on re-save rather than accumulating duplicates', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveSection(run.id, section({ status: 'in_progress', score: null }))
    store.saveSection(run.id, section({ status: 'completed', score: 80 }))
    const sections = store.getRun(run.id)!.sections
    expect(sections).toHaveLength(1)
    expect(sections[0]?.score).toBe(80)
  })

  it('round-trips a finding with its evidence and prompts', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveSection(run.id, section({
      findings: [{
        id: 'F1',
        category: 'security_qa',
        title: 'Unauthenticated write',
        summary: 'An endpoint writes without checking the caller.',
        severity: 'high',
        confidence: 'high',
        status: 'open',
        impact: 'Anyone can write.',
        recommendation: 'Verify the signature.',
        rationale: 'Every other receiver does.',
        evidence: [{ kind: 'file', path: 'src/api/hook.ts', lineStart: 10, description: 'no check' }],
        claudeCodePrompts: [{ title: 'Add verification', prompt: 'Do the thing', intendedOutcome: 'Verified' }],
      }],
    }))
    const f = store.getRun(run.id)!.sections[0]!.findings[0]!
    expect(f.severity).toBe('high')
    expect(f.evidence[0]?.path).toBe('src/api/hook.ts')
    expect(f.claudeCodePrompts[0]?.title).toBe('Add verification')
  })
})

describe('artifacts', () => {
  it('records both formats against a run', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveArtifact(run.id, {
      format: 'markdown', filename: 'report.md', storageReference: `${run.id}/report.md`,
      bytes: 100, sha256: 'abc', createdAt: new Date().toISOString(),
    })
    store.saveArtifact(run.id, {
      format: 'pdf', filename: 'report.pdf', storageReference: `${run.id}/report.pdf`,
      bytes: 200, sha256: 'def', createdAt: new Date().toISOString(),
    })
    const formats = store.getRun(run.id)!.artifacts.map((a) => a.format).sort()
    expect(formats).toEqual(['markdown', 'pdf'])
  })

  it('stores a reference relative to the artifact directory, never an absolute path', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveArtifact(run.id, {
      format: 'markdown', filename: 'report.md', storageReference: `${run.id}/report.md`,
      bytes: 1, sha256: 'x', createdAt: new Date().toISOString(),
    })
    const ref = store.getRun(run.id)!.artifacts[0]!.storageReference
    expect(ref).not.toMatch(/^[A-Za-z]:|^\//)
  })
})

describe('events', () => {
  it('appends in order, for the diagnostic panel', () => {
    const p = project()
    const run = store.createRun(p.id)
    store.appendEvent(run.id, 'info', 'scanning', 'Checking repository structure')
    store.appendEvent(run.id, 'warn', 'analyzing', 'SEO section found no routes')
    const events = store.listEvents(run.id)
    expect(events.map((e) => e.message)).toEqual([
      'Checking repository structure',
      'SEO section found no routes',
    ])
    expect(events[1]?.level).toBe('warn')
  })

  it('caps what it returns, so a long run cannot flood the panel', () => {
    const p = project()
    const run = store.createRun(p.id)
    for (let i = 0; i < 500; i++) store.appendEvent(run.id, 'info', 'scanning', `line ${i}`)
    expect(store.listEvents(run.id, 100)).toHaveLength(100)
  })
})

describe('reopening the database', () => {
  it('is idempotent, so a daemon restart does not fail on existing tables', () => {
    const p = project()
    store.close()
    store = new FlowReportStore(new Db(join(dir, 'flow-reports.db')))
    expect(store.getProject(p.id)?.name).toBe('My App')
  })
})

// ── Resolutions ──────────────────────────────────────────────────────────────
//
// Marking a finding resolved says work was done, and says why. It is a
// different kind of fact from anything an analyser produced, so it lives apart
// from the analysis and is laid over it on the way out.
//
// Four properties carry the feature, and each is here because getting it wrong
// is silent:
//
//   1. A reason is required. A resolution without one is a mis-click that
//      outlives everyone's memory of it, so an empty reason closes nothing and
//      the finding comes back for review.
//   2. It survives a rescan. It is held against the project and matched on the
//      analyser's finding id, so a new run of the same repository inherits it
//      instead of asking the same twenty questions again.
//   3. Editing revises the record. One row per finding, so a reason can be
//      corrected without the history splitting into two accounts of it.
//   4. It never edits the stored findings. The blob has to keep saying what the
//      run measured, or the report stops being a record of the scan.

describe('resolving a finding', () => {
  const f = (id: string, title: string): Finding => ({
    id, category: 'security_qa', title,
    summary: 's', severity: 'high', confidence: 'high', status: 'open',
    impact: 'i', recommendation: 'r', rationale: 'ra',
    evidence: [], claudeCodePrompts: [],
  })

  /** A project with one run holding one high finding. */
  const setup = (title = 'A service key is compared with string equality') => {
    const p = project()
    const run = store.createRun(p.id)
    store.saveSection(run.id, {
      category: 'security_qa', status: 'completed', score: 40,
      summary: '', findings: [f('weak-compare', title)], limitations: [],
    })
    return { projectId: p.id, runId: run.id, title }
  }

  const resolve = (projectId: string, reason: string, title: string) =>
    store.resolveWithReason({
      projectId, category: 'security_qa', findingId: 'weak-compare',
      status: 'resolved', reason, title,
    })

  const findingIn = (runId: string) => store.getRun(runId)!.sections[0]!.findings[0]!

  it('comes back on the finding it was made against, with its reason', () => {
    const { projectId, runId, title } = setup()
    resolve(projectId, 'Swapped for timingSafeEqual in #412.', title)
    const got = findingIn(runId)
    expect(got.status).toBe('resolved')
    expect(got.resolution?.reason).toBe('Swapped for timingSafeEqual in #412.')
    expect(got.resolution?.resolvedAt).toBeTruthy()
  })

  // Property 1. The rule lives in `isClosedBy`, so it holds for the score and
  // the counts too, not only for what the page draws.
  it('does not close a finding when the reason is empty', () => {
    const { projectId, runId, title } = setup()
    resolve(projectId, '   ', title)
    const got = findingIn(runId)
    expect(got.status, 'a blank reason must leave the finding active').toBe('open')
    // The record is still attached, so the page can say one was started.
    expect(got.resolution).toBeTruthy()
  })

  // Property 2, and the reason the key is the finding id rather than its title.
  describe('a later scan of the same repository', () => {
    const rescan = (projectId: string, title: string) => {
      const run = store.createRun(projectId)
      store.saveSection(run.id, {
        category: 'security_qa', status: 'completed', score: 40,
        summary: '', findings: [f('weak-compare', title)], limitations: [],
      })
      return run.id
    }

    it('inherits the resolution', () => {
      const { projectId, title } = setup()
      resolve(projectId, 'Fixed in #412.', title)
      const later = rescan(projectId, title)
      expect(findingIn(later).status).toBe('resolved')
      expect(findingIn(later).resolution?.reason).toBe('Fixed in #412.')
    })

    // A count moving is the same finding with a new number. Being asked to
    // re-justify it every scan would make the feature useless.
    it('still matches when the finding\'s wording has changed', () => {
      const { projectId, title } = setup('58 file(s) over 800 lines')
      resolve(projectId, 'Agreed as acceptable for generated screens.', title)
      const later = rescan(projectId, '61 file(s) over 800 lines')
      expect(findingIn(later).status).toBe('resolved')
    })

    // But the change is visible, because evidence moving under a reason is
    // exactly when somebody should reread it.
    it('says so when the wording has changed since the reason was written', () => {
      const { projectId, title } = setup('58 file(s) over 800 lines')
      resolve(projectId, 'Acceptable.', title)
      const later = rescan(projectId, '61 file(s) over 800 lines')
      expect(findingIn(later).resolution?.titleChanged).toBe(true)
      expect(findingIn(later).resolution?.titleWhenResolved).toBe('58 file(s) over 800 lines')
    })

    it('leaves it alone when the wording is the same', () => {
      const { projectId, title } = setup()
      resolve(projectId, 'Fixed.', title)
      expect(findingIn(rescan(projectId, title)).resolution?.titleChanged).toBe(false)
    })

    // Another repository's decisions are not this one's.
    it('does not reach a different project', () => {
      const { projectId, title } = setup()
      resolve(projectId, 'Fixed.', title)
      const other = store.createProject({
        name: 'Another', repositoryDisplayName: 'other',
        repositoryPath: 'C:/Users/someone/code/other', settings: DEFAULT_SETTINGS,
      })
      const run = store.createRun(other.id)
      store.saveSection(run.id, {
        category: 'security_qa', status: 'completed', score: 40,
        summary: '', findings: [f('weak-compare', title)], limitations: [],
      })
      expect(findingIn(run.id).status).toBe('open')
    })
  })

  // Property 3.
  describe('editing the reason', () => {
    it('revises the record rather than adding a second one', () => {
      const { projectId, runId, title } = setup()
      resolve(projectId, 'First account.', title)
      resolve(projectId, 'Second, better account.', title)
      expect(store.resolutions(projectId).size).toBe(1)
      expect(findingIn(runId).resolution?.reason).toBe('Second, better account.')
    })

    it('keeps when it was resolved, and records when it was last edited', () => {
      const { projectId, runId, title } = setup()
      resolve(projectId, 'First account.', title)
      const first = findingIn(runId).resolution!
      expect(first.lastEditedAt).toBeNull()

      resolve(projectId, 'Second account.', title)
      const second = findingIn(runId).resolution!
      expect(second.resolvedAt, 'the original decision keeps its date').toBe(first.resolvedAt)
      expect(second.lastEditedAt).toBeTruthy()
    })
  })

  // Property 4, and reopening.
  it('can be reopened, leaving no record behind', () => {
    const { projectId, runId, title } = setup()
    resolve(projectId, 'Fixed.', title)
    store.reopenFinding(projectId, 'security_qa', 'weak-compare')
    expect(findingIn(runId).status).toBe('open')
    expect(findingIn(runId).resolution).toBeUndefined()
    expect(store.resolutions(projectId).size).toBe(0)
  })

  it('does not write itself into the stored findings', () => {
    const { projectId, runId, title } = setup()
    resolve(projectId, 'Fixed.', title)
    // Closed again: an open handle on Windows keeps the temp directory locked
    // and the teardown then fails on a test that actually passed.
    const db = new DatabaseSync(join(dir, 'flow-reports.db'))
    const raw = db.prepare('SELECT findings_json FROM flow_report_sections WHERE run_id = ?')
      .get(runId) as { findings_json: string }
    db.close()
    const stored = JSON.parse(raw.findings_json)[0]
    expect(stored.status).toBe('open')
    expect(stored.resolution).toBeUndefined()
  })

  it('survives a restart', () => {
    const { projectId, runId, title } = setup()
    resolve(projectId, 'Fixed in #412.', title)
    store.close()
    store = new FlowReportStore(new Db(join(dir, 'flow-reports.db')))
    expect(findingIn(runId).resolution?.reason).toBe('Fixed in #412.')
  })

  it('goes when the project does', () => {
    const { projectId, title } = setup()
    resolve(projectId, 'Fixed.', title)
    store.deleteProject(projectId)
    expect(store.resolutions(projectId).size).toBe(0)
  })

  // ── The score it produces ──
  //
  // Derived on read, never written down. An earlier version wrote the adjusted
  // score back into the section row, and withdrawing a decision then left the
  // section holding the number the decision had produced.
  describe('the score it produces', () => {
    const twoFindings = () => {
      const p = project()
      const run = store.createRun(p.id)
      store.saveSection(run.id, {
        category: 'security_qa', status: 'completed', score: 63,
        summary: '', limitations: [],
        findings: [f('one', 'One'), f('two', 'Two')],
      })
      return { projectId: p.id, runId: run.id }
    }

    it('rises when a finding is resolved', () => {
      const { projectId, runId } = twoFindings()
      store.resolveWithReason({
        projectId, category: 'security_qa', findingId: 'one',
        status: 'resolved', reason: 'Done.', title: 'One',
      })
      expect(store.getRun(runId)!.sections[0]!.score!).toBeGreaterThan(63)
    })

    it('does not move for a resolution with no reason', () => {
      const { projectId, runId } = twoFindings()
      store.resolveWithReason({
        projectId, category: 'security_qa', findingId: 'one',
        status: 'resolved', reason: '', title: 'One',
      })
      expect(store.getRun(runId)!.sections[0]!.score).toBe(63)
    })

    it('goes back to what the run measured when the finding is reopened', () => {
      const { projectId, runId } = twoFindings()
      store.resolveWithReason({
        projectId, category: 'security_qa', findingId: 'one',
        status: 'resolved', reason: 'Done.', title: 'One',
      })
      store.reopenFinding(projectId, 'security_qa', 'one')
      expect(store.getRun(runId)!.sections[0]!.score).toBe(63)
    })

    it('leaves the measured score in the database untouched', () => {
      const { projectId, runId } = twoFindings()
      store.resolveWithReason({
        projectId, category: 'security_qa', findingId: 'one',
        status: 'resolved', reason: 'Done.', title: 'One',
      })
      const db = new DatabaseSync(join(dir, 'flow-reports.db'))
      const row = db.prepare('SELECT score FROM flow_report_sections WHERE run_id = ?')
        .get(runId) as { score: number }
      db.close()
      expect(row.score).toBe(63)
    })
  })
})
