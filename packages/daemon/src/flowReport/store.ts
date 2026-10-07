// packages/daemon/src/flowReport/store.ts
//
// The only code that reads or writes the Flow Reports database.
//
// ── The projection is the privacy control ────────────────────────────────────
//
// `listProjects` returns a shape with no `repositoryPath` on it. That is not a
// convenience — it is the control. The index page renders this list, so a path
// here would put the user's directory layout on screen and into every
// screenshot of it. A caller that genuinely needs the path asks `getProject`,
// which is used by the run pipeline and nothing that renders.
//
// ── Null scores survive ──────────────────────────────────────────────────────
//
// Every read of `score` goes through `numberOrNull`. SQLite hands back `null`
// faithfully, but a `?? 0` anywhere in this file would turn "could not be
// assessed" into "scored zero" — a report condemning a project it never
// managed to look at. The tests pin it.

import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { Db } from '../db/db.js'
import type { Comprehension } from './comprehend/understand.js'
import { rescoreAfterDecisions } from './report/summarize.js'
import {
  ANALYSIS_VERSION, REPORT_CATEGORIES, DEFAULT_SETTINGS, isClosedBy,
  type AnalysisSettings, type AnalysisError, type AnalysisWarning,
  type FindingResolution, type FindingResponse, type FindingStatus, type FlowReportProject,
  type FlowReportRun, type ReportArtifact, type ReportSectionResult,
  type ReportSummary, type RunEvent, type RunStatus,
} from './types.js'

/** What the index page is allowed to see. No path, by construction. */
export type ProjectListItem = Omit<FlowReportProject, 'repositoryPath'>

export interface CreateProjectInput {
  name: string
  repositoryDisplayName: string
  repositoryPath: string
  settings?: AnalysisSettings
}

export interface RunPatch {
  status?: RunStatus
  progress?: number
  currentStage?: string | null
  startedAt?: string | null
  completedAt?: string | null
  durationMs?: number | null
  summary?: ReportSummary | null
  comprehension?: Comprehension | null
  warnings?: AnalysisWarning[]
  errors?: AnalysisError[]
}

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString())
const ms = (s: string | null | undefined): number | null => (s ? Date.parse(s) : null)

/** SQLite returns null faithfully; this exists so no call site is tempted to
 *  write `?? 0` and quietly turn an absence into a judgement. */
const numberOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v)

const parse = <T>(text: string | null | undefined, fallback: T): T => {
  if (!text) return fallback
  try { return JSON.parse(text) as T } catch { return fallback }
}

/**
 * Open the store on a database file of its own. The daemon does not use this —
 * it hands the store FlowCode's own database, where migration 4 created the
 * tables — but a script or a test that wants FlowReport alone can.
 *
 * The constructor takes a connection, because a test wants an in-memory one
 * and should not have to invent a path to get it.
 */
export function openFlowReportStore(path: string): FlowReportStore {
  return new FlowReportStore(new Db(path))
}

export class FlowReportStore {
  private readonly db: DatabaseSync
  private readonly owner: Db

  /** FlowCode's database wrapper. Its migrations create FlowReport's tables,
   *  so by the time a store exists the schema does too. */
  constructor(db: Db) {
    this.owner = db
    this.db = db.raw
  }

  /** One transaction, FlowCode's way (BEGIN IMMEDIATE, rolled back on a throw). */
  private tx<T>(fn: () => T): T {
    return this.owner.tx(fn)
  }

  close(): void {
    try { this.owner.close() } catch { /* already closed */ }
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  createProject(input: CreateProjectInput): FlowReportProject {
    const existing = this.db
      .prepare('SELECT id FROM flow_report_projects WHERE name = ?')
      .get(input.name)
    if (existing) {
      throw new Error(`A report project called "${input.name}" already exists.`)
    }

    const now = Date.now()
    const id = randomUUID()
    const settings = input.settings ?? DEFAULT_SETTINGS
    this.db.prepare(`
      INSERT INTO flow_report_projects
        (id, name, repository_display_name, repository_path, settings_json,
         latest_run_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(id, input.name, input.repositoryDisplayName, input.repositoryPath,
      JSON.stringify(settings), now, now)

    return this.getProject(id)!
  }

  getProject(id: string): FlowReportProject | null {
    const row = this.db.prepare('SELECT * FROM flow_report_projects WHERE id = ?').get(id) as any
    return row ? this.toProject(row) : null
  }

  listProjects(): ProjectListItem[] {
    const rows = this.db
      .prepare('SELECT * FROM flow_report_projects ORDER BY created_at DESC, rowid DESC')
      .all() as any[]
    return rows.map((r) => {
      // Destructured off rather than deleted, so a future field cannot be
      // forgotten into the projection by accident.
      const { repositoryPath: _omitted, ...rest } = this.toProject(r)
      void _omitted
      return rest
    })
  }

  renameProject(id: string, name: string): void {
    const clash = this.db
      .prepare('SELECT id FROM flow_report_projects WHERE name = ? AND id <> ?')
      .get(name, id)
    if (clash) throw new Error(`A report project called "${name}" already exists.`)
    this.db.prepare('UPDATE flow_report_projects SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, Date.now(), id)
  }

  updateSettings(id: string, settings: AnalysisSettings): void {
    this.db.prepare('UPDATE flow_report_projects SET settings_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(settings), Date.now(), id)
  }

  /**
   * Every response on this project, grouped by `category::findingId`, oldest
   * first inside each group.
   *
   * One query rather than one per finding: a report asks for all of them at
   * once and a section has dozens.
   */
  responses(projectId: string): Map<string, FindingResponse[]> {
    const rows = this.db.prepare(`SELECT id, category, finding_id, body, source, source_name,
        created_at, created_by, edited_at, edited_by
      FROM flow_report_responses WHERE project_id = ?
      ORDER BY created_at ASC, rowid ASC`).all(projectId) as Array<{
        id: string; category: string; finding_id: string; body: string
        source: string; source_name: string | null
        created_at: number; created_by: string | null
        edited_at: number | null; edited_by: string | null
      }>

    const out = new Map<string, FindingResponse[]>()
    for (const r of rows) {
      const key = `${r.category}::${r.finding_id}`
      const list = out.get(key) ?? []
      list.push({
        id: r.id,
        body: r.body,
        source: r.source === 'imported' ? 'imported' : 'typed',
        sourceName: r.source_name,
        createdAt: new Date(Number(r.created_at)).toISOString(),
        createdBy: r.created_by,
        editedAt: r.edited_at === null ? null : new Date(Number(r.edited_at)).toISOString(),
        editedBy: r.edited_by,
      })
      out.set(key, list)
    }
    return out
  }

  addResponse(input: {
    projectId: string
    category: string
    findingId: string
    body: string
    source: 'typed' | 'imported'
    sourceName?: string | null
    by?: string | null
  }): FindingResponse {
    const id = randomUUID()
    const now = Date.now()
    this.db.prepare(`INSERT INTO flow_report_responses
        (id, project_id, category, finding_id, body, source, source_name,
         created_at, created_by, edited_at, edited_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`)
      .run(id, input.projectId, input.category, input.findingId, input.body,
        input.source, input.sourceName ?? null, now, input.by ?? null)

    return {
      id,
      body: input.body,
      source: input.source,
      sourceName: input.sourceName ?? null,
      createdAt: new Date(now).toISOString(),
      createdBy: input.by ?? null,
      editedAt: null,
      editedBy: null,
    }
  }

  /** Revise the wording. `source`, `source_name` and `created_at` never move:
   *  an edited imported response is still an imported response, and saying
   *  otherwise would launder where it came from. */
  editResponse(id: string, body: string, by?: string | null): boolean {
    return Number(this.db.prepare(
      'UPDATE flow_report_responses SET body = ?, edited_at = ?, edited_by = ? WHERE id = ?',
    ).run(body, Date.now(), by ?? null, id).changes) > 0
  }

  /**
   * Set the status on a finding without touching any reason already written.
   *
   * `saveResolution` takes a reason and writes it on both paths, which is right
   * when somebody typed one and wrong when the text lives in a response. This
   * writes an empty reason on insert and leaves the column alone on update.
   */
  upsertResolutionStatus(input: {
    projectId: string
    category: string
    findingId: string
    status: Exclude<FindingStatus, 'open'>
    title: string
    by?: string | null
  }): void {
    const now = Date.now()
    const existing = this.db.prepare(
      'SELECT 1 FROM flow_report_resolutions WHERE project_id = ? AND category = ? AND finding_id = ?',
    ).get(input.projectId, input.category, input.findingId)

    if (existing) {
      this.db.prepare(`UPDATE flow_report_resolutions
        SET status = ?, title_when_resolved = ?, last_edited_at = ?, last_edited_by = ?
        WHERE project_id = ? AND category = ? AND finding_id = ?`)
        .run(input.status, input.title, now, input.by ?? null,
          input.projectId, input.category, input.findingId)
      return
    }

    this.db.prepare(`INSERT INTO flow_report_resolutions
        (project_id, category, finding_id, status, reason, title_when_resolved,
         resolved_at, resolved_by, last_edited_at, last_edited_by)
      VALUES (?, ?, ?, ?, '', ?, ?, ?, NULL, NULL)`)
      .run(input.projectId, input.category, input.findingId, input.status,
        input.title, now, input.by ?? null)
  }

  /**
   * Write a whole imported document at once.
   *
   * One transaction, because a half-applied import is a state nobody chose:
   * some findings answered, some not, and no way to tell which without reading
   * the document again beside the report.
   *
   * A row whose status closes the finding also writes a resolution. One that
   * does not — `noted`, `accepted_risk` — records the account and leaves the
   * finding where it is, which is what a response to open work is.
   */
  applyImport(input: {
    projectId: string
    sourceName: string
    rows: Array<{
      category: string
      findingId: string
      findingTitle: string
      body: string
      status: FindingStatus
    }>
    by?: string | null
  }): number {
    // One response per finding per document. A document that names the same
    // finding twice — a summary table repeating a heading, a section covered in
    // two places — would otherwise write the same account twice, and the second
    // copy is not a second account of anything.
    const seen = new Set<string>()
    const rows = input.rows.filter((r) => {
      const key = `${r.category}::${r.findingId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return this.tx(() => {
      for (const row of rows) {
        this.addResponse({
          projectId: input.projectId,
          category: row.category,
          findingId: row.findingId,
          body: row.body,
          source: 'imported',
          sourceName: input.sourceName,
          by: input.by ?? null,
        })
        if (row.status !== 'open') {
          // `reason` is only supplied on an insert. Passing an empty string
          // through saveResolution would blank the column on a resolution that
          // already exists, and although nothing reads it any more — the text
          // lives in the responses — overwriting what somebody wrote is not
          // this code's business.
          this.upsertResolutionStatus({
            projectId: input.projectId,
            category: row.category,
            findingId: row.findingId,
            status: row.status as Exclude<FindingStatus, 'open'>,
            title: row.findingTitle,
            by: input.by ?? null,
          })
        }
      }
      return rows.length
    })
  }

  /** Returns whether anything went, so a route can answer 404 rather than
   *  reporting success for an id that names nothing. */
  deleteResponse(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM flow_report_responses WHERE id = ?')
      .run(id).changes) > 0
  }

  /**
   * Remove one run and everything that belongs only to it.
   *
   * Resolutions are not touched. They are keyed by project and finding title,
   * not by run — that is what carries them across a rescan — so a run going
   * away must not take the record of what was decided with it.
   *
   * `latest_run_id` is repointed rather than left dangling. A project whose
   * latest run does not exist reads as a project that has never been run, and
   * the next reader would have no way to tell that from the truth.
   *
   * Returns the artifact files that are now unreferenced, for the caller to
   * remove from disk. They are not deleted here because a file cannot be put
   * back if the transaction rolls back, and rows can.
   */
  deleteRun(id: string): string[] {
    const files = (this.db.prepare(
      'SELECT storage_reference FROM flow_report_artifacts WHERE run_id = ?',
    ).all(id) as Array<{ storage_reference: string }>).map((r) => r.storage_reference)

    this.tx(() => {
      const runId = id
      const row = this.db.prepare('SELECT project_id FROM flow_report_runs WHERE id = ?')
        .get(runId) as { project_id: string } | undefined
      if (!row) return

      this.db.prepare('DELETE FROM flow_report_sections WHERE run_id = ?').run(runId)
      this.db.prepare('DELETE FROM flow_report_artifacts WHERE run_id = ?').run(runId)
      this.db.prepare('DELETE FROM flow_report_events WHERE run_id = ?').run(runId)
      this.db.prepare('DELETE FROM flow_report_runs WHERE id = ?').run(runId)

      const latest = this.db.prepare(
        'SELECT id FROM flow_report_runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
      ).get(row.project_id) as { id: string } | undefined
      this.db.prepare('UPDATE flow_report_projects SET latest_run_id = ? WHERE id = ? AND latest_run_id = ?')
        .run(latest?.id ?? null, row.project_id, runId)
    })

    return files
  }

  /**
   * Removes the project and everything that belonged to it. There is no orphan
   * state worth keeping: a run without its project cannot be read.
   *
   * Responses go too. FlowAgent's version left them behind — accounts of work
   * on a repository nobody can open any more, kept for ever in a table nothing
   * reads. And, like `deleteRun`, it returns the artifact files that are now
   * unreferenced, for the caller to remove once the rows are gone.
   */
  deleteProject(id: string): string[] {
    const files = (this.db.prepare(
      'SELECT a.storage_reference FROM flow_report_artifacts a JOIN flow_report_runs r ON r.id = a.run_id WHERE r.project_id = ?',
    ).all(id) as Array<{ storage_reference: string }>).map((r) => r.storage_reference)
    this.tx(() => {
      const projectId = id
      const runs = this.db.prepare('SELECT id FROM flow_report_runs WHERE project_id = ?')
        .all(projectId) as Array<{ id: string }>
      const delSections = this.db.prepare('DELETE FROM flow_report_sections WHERE run_id = ?')
      const delArtifacts = this.db.prepare('DELETE FROM flow_report_artifacts WHERE run_id = ?')
      const delEvents = this.db.prepare('DELETE FROM flow_report_events WHERE run_id = ?')
      for (const r of runs) {
        delSections.run(r.id)
        delArtifacts.run(r.id)
        delEvents.run(r.id)
      }
      this.db.prepare('DELETE FROM flow_report_resolutions WHERE project_id = ?').run(projectId)
      this.db.prepare('DELETE FROM flow_report_responses WHERE project_id = ?').run(projectId)
      this.db.prepare('DELETE FROM flow_report_runs WHERE project_id = ?').run(projectId)
      this.db.prepare('DELETE FROM flow_report_projects WHERE id = ?').run(projectId)
    })
    return files
  }

  // ── Runs ──────────────────────────────────────────────────────────────────

  createRun(projectId: string): FlowReportRun {
    const now = Date.now()
    const id = randomUUID()
    this.tx(() => {
      this.db.prepare(`
        INSERT INTO flow_report_runs
          (id, project_id, status, progress, current_stage, analysis_version,
           warnings_json, errors_json, created_at, updated_at)
        VALUES (?, ?, 'queued', 0, NULL, ?, '[]', '[]', ?, ?)
      `).run(id, projectId, ANALYSIS_VERSION, now, now)
      this.db.prepare('UPDATE flow_report_projects SET latest_run_id = ?, updated_at = ? WHERE id = ?')
        .run(id, now, projectId)
    })
    return this.getRun(id)!
  }

  getRun(id: string): FlowReportRun | null {
    const row = this.db.prepare('SELECT * FROM flow_report_runs WHERE id = ?').get(id) as any
    if (!row) return null

    const sectionRows = this.db
      .prepare('SELECT * FROM flow_report_sections WHERE run_id = ?')
      .all(id) as any[]
    // Ordered by the canonical category list rather than by insert order, so a
    // report reads the same however the analysers happened to finish.
    // Resolutions made by hand, laid over the analysis as it was stored.
    // Applied on the way out rather than written into the findings blob: the
    // blob is what the run measured, and re-reading it must not be able to lose
    // a decision or to disguise one as something an analyser found.
    //
    // Read against the project, so a rescan inherits what was decided about the
    // last one. A record whose reason is empty is attached but does not close
    // the finding — `isClosedBy` decides that, in one place, so the score, the
    // counts and the page cannot disagree about it.
    const decided = this.resolutions(row.project_id)
    const said = this.responses(row.project_id)
    const sections = sectionRows
      .map((s) => this.toSection(s))
      .map((s) => (decided.size === 0 && said.size === 0 ? s : {
        ...s,
        findings: s.findings.map((f) => {
          const key = `${s.category}::${f.id}`
          const r = decided.get(key)
          const responses = said.get(key)
          if (!r && !responses) return f
          return {
            ...f,
            // Every account of what was done, carried whether or not anything
            // was ever settled: a finding can be written about and still open.
            ...(responses ? { responses } : {}),
            // Marked when the finding now reads differently from when the
            // reason was written. The evidence moving under a resolution is
            // exactly when somebody should reread it.
            ...(r ? { resolution: { ...r, titleChanged: r.titleWhenResolved !== f.title } } : {}),
            status: isClosedBy(r, responses?.length ?? 0) ? r!.status : ('open' as const),
          }
        }),
      }))
      .sort((a, b) =>
        REPORT_CATEGORIES.indexOf(a.category) - REPORT_CATEGORIES.indexOf(b.category))

    const artifacts = (this.db
      .prepare('SELECT * FROM flow_report_artifacts WHERE run_id = ? ORDER BY created_at')
      .all(id) as any[]).map((a) => this.toArtifact(a))

    const stored = parse<ReportSummary | null>(row.summary_json, null)
    // The scores follow the decisions, and like the decisions they are derived
    // here rather than written down. What is in the database stays the number
    // the run measured — which is also what makes withdrawing a decision put
    // the original back, with nothing to remember.
    const adjusted = decided.size === 0
      ? { sections, summary: stored }
      : rescoreAfterDecisions(sections, stored)

    return {
      id: row.id,
      projectId: row.project_id,
      status: row.status as RunStatus,
      progress: Number(row.progress),
      currentStage: row.current_stage ?? null,
      startedAt: iso(numberOrNull(row.started_at)),
      completedAt: iso(numberOrNull(row.completed_at)),
      durationMs: numberOrNull(row.duration_ms),
      analysisVersion: row.analysis_version,
      summary: adjusted.summary,
      comprehension: parse<Comprehension | null>(row.comprehension_json, null),
      sections: adjusted.sections,
      warnings: parse<AnalysisWarning[]>(row.warnings_json, []),
      errors: parse<AnalysisError[]>(row.errors_json, []),
      artifacts,
      createdAt: new Date(Number(row.created_at)).toISOString(),
      updatedAt: new Date(Number(row.updated_at)).toISOString(),
    }
  }

  // ── Resolutions ───────────────────────────────────────────────────────────
  //
  // Held against the project, so a rescan of the same repository finds them.
  // Matched on the analyser's finding id within its section, which survives the
  // wording of a finding changing — a count going from 58 files to 61 is the
  // same finding with a new number, and being asked to re-justify it every scan
  // would make the feature useless.

  /** Every resolution for a project, keyed `category::findingId`. */
  resolutions(projectId: string): Map<string, FindingResolution> {
    const rows = this.db.prepare(`SELECT category, finding_id, status, reason,
        title_when_resolved, resolved_at, resolved_by, last_edited_at, last_edited_by
      FROM flow_report_resolutions WHERE project_id = ?`).all(projectId) as Array<{
      category: string; finding_id: string; status: string; reason: string
      title_when_resolved: string; resolved_at: number; resolved_by: string | null
      last_edited_at: number | null; last_edited_by: string | null
    }>
    return new Map(rows.map((r) => [`${r.category}::${r.finding_id}`, {
      status: r.status as Exclude<FindingStatus, 'open'>,
      reason: r.reason,
      titleWhenResolved: r.title_when_resolved,
      resolvedAt: new Date(Number(r.resolved_at)).toISOString(),
      resolvedBy: r.resolved_by,
      lastEditedAt: r.last_edited_at === null ? null : new Date(Number(r.last_edited_at)).toISOString(),
      lastEditedBy: r.last_edited_by,
    }]))
  }

  /**
   * Record a resolution, or edit the reason on one that exists.
   *
   * One row per finding per project, so editing updates rather than
   * accumulating — `resolved_at` and who made it survive the edit, and only the
   * reason and the "last edited" pair move. A reader needs both dates: when the
   * call was made, and when the account of it was last revised.
   */
  saveResolution(input: {
    projectId: string
    category: string
    findingId: string
    status: Exclude<FindingStatus, 'open'>
    reason: string
    title: string
    by?: string | null
  }): void {
    const now = Date.now()
    const existing = this.db.prepare(
      'SELECT 1 FROM flow_report_resolutions WHERE project_id = ? AND category = ? AND finding_id = ?',
    ).get(input.projectId, input.category, input.findingId)

    if (existing) {
      this.db.prepare(`UPDATE flow_report_resolutions
        SET status = ?, reason = ?, title_when_resolved = ?, last_edited_at = ?, last_edited_by = ?
        WHERE project_id = ? AND category = ? AND finding_id = ?`)
        .run(input.status, input.reason, input.title, now, input.by ?? null,
          input.projectId, input.category, input.findingId)
      return
    }

    this.db.prepare(`
      INSERT INTO flow_report_resolutions
        (project_id, category, finding_id, status, reason, title_when_resolved,
         resolved_at, resolved_by, last_edited_at, last_edited_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `).run(input.projectId, input.category, input.findingId, input.status, input.reason,
      input.title, now, input.by ?? null)
  }

  /**
   * Record a resolution and the reason given for it, where the reason becomes a
   * response.
   *
   * This is what the Resolve button has always called. It stays because a
   * finding is closed by having something said for it, and this is one act for
   * the person doing it: here is what I did, and it is resolved.
   *
   * A reason that repeats the newest response is not stored twice — saving a
   * resolution again without touching the text is not a second account of the
   * work. Anything else is appended, which is how revising a reason now leaves
   * the previous one readable instead of overwriting it.
   */
  resolveWithReason(input: {
    projectId: string
    category: string
    findingId: string
    status: Exclude<FindingStatus, 'open'>
    reason: string
    title: string
    by?: string | null
  }): void {
    this.saveResolution(input)

    const body = input.reason.trim()
    if (!body) return

    const existing = this.responses(input.projectId)
      .get(`${input.category}::${input.findingId}`) ?? []
    if (existing.length > 0 && existing[existing.length - 1]!.body === body) return

    this.addResponse({
      projectId: input.projectId,
      category: input.category,
      findingId: input.findingId,
      body,
      source: 'typed',
      by: input.by ?? null,
    })
  }

  /** Reopen a finding: the record goes, because a withdrawn resolution is not
   *  a resolution with a different status — it is the absence of one. */
  reopenFinding(projectId: string, category: string, findingId: string): void {
    this.db.prepare(`DELETE FROM flow_report_resolutions
      WHERE project_id = ? AND category = ? AND finding_id = ?`)
      .run(projectId, category, findingId)
  }

  /**
   * Runs whose status says they are still going.
   *
   * Asked once at startup, because a run only runs inside a process: if this
   * one is starting, anything still marked in flight belongs to a process that
   * is gone.
   */
  runsInFlight(): FlowReportRun[] {
    const ids = this.db.prepare(
      `SELECT id FROM flow_report_runs
        WHERE status NOT IN ('completed', 'completed_with_warnings', 'failed', 'cancelled')`,
    ).all() as Array<{ id: string }>
    return ids.map((r) => this.getRun(r.id)).filter((r): r is FlowReportRun => r !== null)
  }

  listRuns(projectId: string, limit = 20): FlowReportRun[] {
    const ids = this.db
      .prepare('SELECT id FROM flow_report_runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .all(projectId, limit) as Array<{ id: string }>
    return ids.map((r) => this.getRun(r.id)!).filter(Boolean)
  }

  updateRun(id: string, patch: RunPatch): void {
    const sets: string[] = []
    const args: unknown[] = []
    const put = (col: string, value: unknown): void => { sets.push(`${col} = ?`); args.push(value) }

    if (patch.status !== undefined) put('status', patch.status)
    if (patch.progress !== undefined) put('progress', patch.progress)
    if (patch.currentStage !== undefined) put('current_stage', patch.currentStage)
    if (patch.startedAt !== undefined) put('started_at', ms(patch.startedAt))
    if (patch.completedAt !== undefined) put('completed_at', ms(patch.completedAt))
    if (patch.durationMs !== undefined) put('duration_ms', patch.durationMs)
    if (patch.summary !== undefined) put('summary_json', patch.summary ? JSON.stringify(patch.summary) : null)
    if (patch.comprehension !== undefined) {
      put('comprehension_json',
        patch.comprehension ? JSON.stringify(patch.comprehension) : null)
    }
    if (patch.warnings !== undefined) put('warnings_json', JSON.stringify(patch.warnings))
    if (patch.errors !== undefined) put('errors_json', JSON.stringify(patch.errors))
    if (sets.length === 0) return

    put('updated_at', Date.now())
    args.push(id)
    this.db.prepare(`UPDATE flow_report_runs SET ${sets.join(', ')} WHERE id = ?`).run(...(args as never[]))
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  /** Upserts, so a section can be written when it starts and again when it
   *  finishes without the run accumulating two versions of it. */
  saveSection(runId: string, section: ReportSectionResult): void {
    this.db.prepare(`
      INSERT INTO flow_report_sections
        (run_id, category, status, score, summary, findings_json, limitations_json,
         reason, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id, category) DO UPDATE SET
        status = excluded.status,
        score = excluded.score,
        summary = excluded.summary,
        findings_json = excluded.findings_json,
        limitations_json = excluded.limitations_json,
        reason = excluded.reason,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at
    `).run(
      runId,
      section.category,
      section.status,
      // Passed through untouched. `?? 0` here is the bug this whole module is
      // shaped to avoid.
      section.score === null ? null : section.score,
      section.summary,
      JSON.stringify(section.findings),
      JSON.stringify(section.limitations),
      section.reason ?? null,
      ms(section.startedAt),
      ms(section.completedAt),
    )
  }

  // ── Artifacts ─────────────────────────────────────────────────────────────

  saveArtifact(runId: string, artifact: ReportArtifact): void {
    // One artifact per format per run. A re-render that appended instead of
    // replacing would put two download buttons for the same file on the page,
    // and the reader would have no way to tell which was current.
    this.db.prepare('DELETE FROM flow_report_artifacts WHERE run_id = ? AND format = ?')
      .run(runId, artifact.format)
    this.db.prepare(`
      INSERT INTO flow_report_artifacts
        (id, run_id, format, filename, storage_reference, bytes, sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), runId, artifact.format, artifact.filename,
      artifact.storageReference, artifact.bytes, artifact.sha256,
      Date.parse(artifact.createdAt))
  }

  // ── Events ────────────────────────────────────────────────────────────────

  appendEvent(runId: string, level: RunEvent['level'], stage: string | null, message: string): void {
    this.db.prepare(`
      INSERT INTO flow_report_events (run_id, level, stage, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(runId, level, stage, message, Date.now())
  }

  /** Oldest first, capped. A long run can emit thousands of lines and the
   *  diagnostic panel only ever shows a window of them. */
  listEvents(runId: string, limit = 200): RunEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM flow_report_events WHERE run_id = ? ORDER BY id LIMIT ?')
      .all(runId, limit) as any[]
    return rows.map((r) => ({
      id: Number(r.id),
      runId: r.run_id,
      level: r.level,
      stage: r.stage ?? null,
      message: r.message,
      createdAt: new Date(Number(r.created_at)).toISOString(),
    }))
  }

  // ── Row mapping ───────────────────────────────────────────────────────────

  private toProject(row: any): FlowReportProject {
    return {
      id: row.id,
      name: row.name,
      repositoryDisplayName: row.repository_display_name,
      repositoryPath: row.repository_path,
      settings: parse<AnalysisSettings>(row.settings_json, DEFAULT_SETTINGS),
      latestRunId: row.latest_run_id ?? null,
      createdAt: new Date(Number(row.created_at)).toISOString(),
      updatedAt: new Date(Number(row.updated_at)).toISOString(),
    }
  }

  private toSection(row: any): ReportSectionResult {
    return {
      category: row.category,
      status: row.status,
      score: numberOrNull(row.score),
      summary: row.summary ?? '',
      findings: parse(row.findings_json, []),
      limitations: parse(row.limitations_json, []),
      reason: row.reason ?? undefined,
      startedAt: iso(numberOrNull(row.started_at)) ?? undefined,
      completedAt: iso(numberOrNull(row.completed_at)) ?? undefined,
    }
  }

  private toArtifact(row: any): ReportArtifact {
    return {
      format: row.format,
      filename: row.filename,
      storageReference: row.storage_reference,
      bytes: Number(row.bytes),
      sha256: row.sha256,
      createdAt: new Date(Number(row.created_at)).toISOString(),
    }
  }
}
