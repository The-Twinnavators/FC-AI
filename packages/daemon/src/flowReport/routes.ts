// packages/daemon/src/flowReport/routes.ts
//
// The HTTP surface for FlowReport.
//
// ── Same paths, same shapes, FlowCode's server ───────────────────────────────
//
// FlowAgent served these through Fastify. FlowCode's daemon is plain node http
// with one `add("METHOD /path", handler)` router that has already checked the
// bearer token and the origin by the time a handler runs. The paths and the
// JSON in and out are FlowAgent's exactly, so the UI's api.ts did not have to
// change: errors are `{ error: "<sentence>" }` with a real status, created
// things answer 201 and started runs 202.
//
// ── Where the folder path may and may not go ─────────────────────────────────
//
// It never reaches an export, a finding, a piece of evidence or a run payload.
// Those get repository-relative paths only, which is what makes a report safe
// to send to somebody: an absolute path is both a privacy leak and useless on
// another machine. A test asserts no absolute path appears anywhere in a
// stored run.
//
// It is also kept off the project INDEX, because that page lists every project
// at once — a path there puts the whole of somebody's directory layout into
// every screenshot of it.
//
// It IS returned for a single project, to the page showing that project. A user
// watching a run has no other way to confirm which folder is being read — the
// display name is a basename, and two folders called `app` look identical.
// This endpoint is loopback-only and behind the daemon token, and it tells
// somebody where their own files are.
//
// ── Browsing is listing, not reading ─────────────────────────────────────────
//
// `/browse` returns directory names and nothing else. It never opens a file,
// never reports a file's size or contents, and never descends on its own. It is
// the same listing FlowCode's own folder picker uses (`/system/folders`), so
// the two cannot disagree about what a folder contains.

import type http from 'node:http'
import { basename, parse } from 'node:path'
import { browseFolder, folderRoots } from '../workspace/folderBrowser.js'
import { openRepository } from './scanner/boundary.js'
import { readArtifact, removeArtifact, writeArtifact, type WrittenArtifact } from './report/artifacts.js'
import { sectionMetrics } from './report/metrics.js'
import { previewResponseDocument } from './responseImport.js'
import { allAnalyzers } from './analyzers/adapters.js'
import { describePlainly, isGenericReading, actionSteps } from './report/plainLanguage.js'
import type { AnalysisJobManager } from './jobManager.js'
import type { FlowReportStore } from './store.js'
import type { ProcessManager } from '../commands/processManager.js'
import {
  CATEGORY_LABEL, DEFAULT_SETTINGS, FINDING_STATUSES,
  type AnalysisSettings, type FindingStatus, type FlowReportRun, type ReportCategory,
} from './types.js'

/** What FlowCode's router hands a handler (see `api/server.ts`). */
export interface RouteContext {
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
  req: http.IncomingMessage
  res: http.ServerResponse
}
export type AddRoute = (spec: string, handler: (ctx: RouteContext) => unknown) => void

/** A run in one of these has stopped for good, however it ended. Defined once:
 *  the progress stream and the delete route both have to agree about what
 *  "finished" means, and two copies of a list eventually become two lists. */
const TERMINAL_RUN_STATUSES: ReadonlySet<string> = new Set([
  'completed', 'completed_with_warnings', 'failed', 'cancelled',
])

/**
 * Answer with a status other than 200.
 *
 * FlowCode's router sends whatever a handler returns as a 200. FlowReport's
 * contract has 201s, 202s, 404s and 409s, so those are written here directly;
 * the router sees the headers already sent and leaves the response alone.
 */
function send(res: http.ServerResponse, status: number, body: unknown): undefined {
  if (!res.headersSent) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  return undefined
}

const obj = (body: unknown): Record<string, unknown> =>
  body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}

/**
 * Add the derived parts of a finding on the way out.
 *
 * ── Derived here rather than in the browser ──────────────────────────────────
 *
 * The plain-language reading and the ordered steps are not stored: they are
 * functions of the finding, and storing them would mean a run analysed last
 * month keeps last month's wording. Computing them in the browser instead would
 * mean two implementations of "what does this finding mean" — the screen and
 * the PDF would eventually say different things about the same finding, and
 * nothing would flag it. So the functions the Markdown renderer uses run here,
 * once, and both consumers read the result.
 */
function enrich(run: FlowReportRun): FlowReportRun {
  return {
    ...run,
    sections: run.sections.map((s) => ({
      ...s,
      findings: s.findings.map((f) => ({
        ...f,
        plain: describePlainly(f),
        genericReading: isGenericReading(f),
        steps: actionSteps(f),
      })),
    })),
  }
}

function cleanSettings(raw: unknown): AnalysisSettings {
  const s = (raw ?? {}) as Partial<AnalysisSettings>
  return {
    depth: ['quick', 'standard', 'deep'].includes(String(s.depth))
      ? s.depth as AnalysisSettings['depth'] : DEFAULT_SETTINGS.depth,
    includeTests: s.includeTests ?? DEFAULT_SETTINGS.includeTests,
    includeDocs: s.includeDocs ?? DEFAULT_SETTINGS.includeDocs,
    includeDependencyManifests:
      s.includeDependencyManifests ?? DEFAULT_SETTINGS.includeDependencyManifests,
    excludeGenerated: s.excludeGenerated ?? DEFAULT_SETTINGS.excludeGenerated,
    customIgnore: Array.isArray(s.customIgnore)
      ? s.customIgnore.filter((v) => typeof v === 'string').slice(0, 100) : [],
    // Off unless explicitly turned on, every time. A default that survives a
    // round trip through the client is a default that can be flipped by a bug.
    // This is also the switch that lets a hosted model read the code.
    networkResearch: s.networkResearch === true,
    // On unless explicitly turned off, which is the mirror of the rule above:
    // this one costs time rather than privacy, so a client that forgets to
    // send it should get the better report and not the faster one.
    tailoredWriting: s.tailoredWriting !== false,
  }
}

/**
 * Render one section as a PDF, now, and keep it.
 *
 * Rebuilt from the section's own Markdown, which is the same source the
 * combined PDF is built from — so the two cannot disagree about what the
 * section says. `repoMap` is null: the scan that drew it is long finished by
 * the time anybody clicks download, and a diagram redrawn from nothing would be
 * a picture of an empty repository rather than an honest omission.
 *
 * In-flight renders are shared. Two people clicking the same download would
 * otherwise launch two browsers to produce identical bytes.
 */
const rendering = new Map<string, Promise<WrittenArtifact>>()

async function renderSectionPdf(
  store: FlowReportStore,
  run: FlowReportRun,
  section: FlowReportRun['sections'][number],
  source: { storageReference: string },
  processes?: ProcessManager,
): Promise<WrittenArtifact> {
  const key = `${run.id}:${section.category}`
  const existing = rendering.get(key)
  if (existing) return existing

  const task = (async () => {
    const md = readArtifact(source.storageReference)
    if (!md) throw new Error('the Markdown for this section is no longer on disk')

    const project = store.getProject(run.projectId)
    const projectName = project?.name ?? 'Report'
    const label = CATEGORY_LABEL[section.category] ?? section.category

    const counts = (['critical', 'high', 'medium', 'low', 'info'] as const)
      .reduce((acc, sev) => {
        acc[sev] = section.findings.filter((f) => f.severity === sev).length
        return acc
      }, {} as Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>)

    const { renderReportPdf } = await import('./report/pdf.js')
    const pdf = await renderReportPdf(md.toString('utf8'), {
      projectName: `${projectName} — ${label}`,
      repositoryDisplayName: project?.repositoryDisplayName ?? projectName,
      analysisMode: 'Single domain',
      generatedAt: (run.completedAt ?? run.startedAt ?? '').slice(0, 10),
      runStatus: run.status,
      overallScore: section.score == null ? 'Insufficient evidence' : `${section.score} / 100`,
      overallScoreValue: section.score,
      severityCounts: counts,
      sections: [{
        category: section.category,
        status: section.status,
        score: section.score,
        findings: section.findings.length,
        counts,
        metrics: sectionMetrics(section.findings),
        reason: section.reason ?? null,
      }],
      repoMap: null,
    }, { stamp: new Date(run.completedAt ?? Date.now()), runId: run.id, processes })

    const written = writeArtifact(run.id, projectName, 'pdf', pdf.bytes, section.category)
    store.saveArtifact(run.id, written)
    return written
  })()

  rendering.set(key, task)
  try { return await task } finally { rendering.delete(key) }
}

export function registerFlowReportRoutes(
  add: AddRoute,
  deps: { store: FlowReportStore; manager: AnalysisJobManager; processes?: ProcessManager },
): void {
  const { store, manager, processes } = deps

  // ── Choosing a folder ──────────────────────────────────────────────────────

  add('GET /flow-reports/browse', ({ query, res }) => {
    try {
      return browseFolder(query.get('path') ?? undefined)
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 403
      return send(res, status, {
        error: status === 403 ? `That folder could not be read: ${err?.message}` : String(err?.message ?? err),
      })
    }
  })

  /** The volumes a person can start from, so the picker is not anchored to one
   *  home directory on a machine with several drives. */
  add('GET /flow-reports/roots', () => ({ roots: folderRoots() }))

  // ── Projects ───────────────────────────────────────────────────────────────

  // No repository path in this payload, by construction.
  add('GET /flow-reports/projects', () => ({ projects: store.listProjects() }))

  add('POST /flow-reports/projects', ({ body, res }) => {
    const b = obj(body)
    const path = String(b.repositoryPath ?? '')
    if (!path) return send(res, 400, { error: 'A repository folder is required.' })

    // Validated before anything is stored, so a project can never exist
    // pointing at something that was never a readable directory.
    const opened = openRepository(path)
    if (!opened.ok) return send(res, 400, { error: opened.reason })

    const displayName = basename(opened.boundary.root) || parse(opened.boundary.root).root
    const name = String(b.name ?? '').trim() || displayName

    let project
    try {
      project = store.createProject({
        name,
        repositoryDisplayName: displayName,
        repositoryPath: opened.boundary.root,
        settings: cleanSettings(b.settings),
      })
    } catch (err: any) {
      // The only throw here is a name already taken, which is the person's to fix.
      return send(res, 409, { error: String(err?.message ?? err) })
    }
    const { repositoryPath: _omit, ...safe } = project
    void _omit
    return send(res, 201, { project: safe })
  })

  /**
   * One project, including where it reads from.
   *
   * Separate from the list on purpose: the index must not carry paths, and the
   * page for a single project must, so somebody can check that the folder being
   * analysed is the one they meant.
   */
  add('GET /flow-reports/projects/:id', ({ params, res }) => {
    const project = store.getProject(params.id)
    if (!project) return send(res, 404, { error: 'not found' })
    return { project }
  })

  add('PATCH /flow-reports/projects/:id', ({ params, body, res }) => {
    const id = params.id
    if (!store.getProject(id)) return send(res, 404, { error: 'not found' })
    const b = obj(body)
    try {
      if (typeof b.name === 'string' && b.name.trim()) store.renameProject(id, b.name.trim())
    } catch (err: any) {
      return send(res, 409, { error: String(err?.message ?? err) })
    }
    if (b.settings !== undefined) store.updateSettings(id, cleanSettings(b.settings))
    return { ok: true }
  })

  add('DELETE /flow-reports/projects/:id', ({ params, res }) => {
    const id = params.id
    if (!store.getProject(id)) return send(res, 404, { error: 'not found' })
    // A project with a run still going is refused, for the reason a running run
    // is: the manager is writing to rows this would pull out from under it.
    const inFlight = store.listRuns(id).find((r) => manager.isRunning(r.id))
    if (inFlight) return send(res, 409, { error: 'A run is still going for this project. Cancel it first.' })
    for (const reference of store.deleteProject(id)) {
      try { removeArtifact(reference) } catch { /* the rows are gone either way */ }
    }
    return { ok: true }
  })

  // ── Runs ───────────────────────────────────────────────────────────────────

  add('GET /flow-reports/projects/:id/runs', ({ params, res }) => {
    if (!store.getProject(params.id)) return send(res, 404, { error: 'not found' })
    return { runs: store.listRuns(params.id) }
  })

  add('POST /flow-reports/projects/:id/runs', async ({ params, body, res }) => {
    const id = params.id
    const project = store.getProject(id)
    if (!project) return send(res, 404, { error: 'not found' })

    // One run at a time per project. Two concurrent runs would write two sets
    // of artifacts into the same project and the newest download would be
    // whichever finished last, not whichever was asked for last.
    const inFlight = store.listRuns(id).find((r) => manager.isRunning(r.id))
    if (inFlight) {
      return send(res, 409, { error: 'A run is already in progress for this project.', runId: inFlight.id })
    }

    const b = obj(body)
    const settings = b.settings === undefined ? project.settings : cleanSettings(b.settings)
    const run = await manager.start(id, allAnalyzers(), { settings })
    return send(res, 202, { run })
  })

  add('GET /flow-reports/runs/:id', ({ params, res }) => {
    const run = store.getRun(params.id)
    if (!run) return send(res, 404, { error: 'not found' })
    return { run: enrich(run), running: manager.isRunning(run.id) }
  })

  /**
   * Resolve a finding, edit the reason on one already resolved, or reopen it.
   *
   * ── What this records, and what it does not claim ──────────────────────────
   *
   * That a person says work was done, and why. It is not a measurement and the
   * report never presents it as one: the score moves, the figure the scan
   * produced is kept beside it, and only a fresh scan can confirm that anything
   * actually changed.
   *
   * The reason is required and is checked here as well as in the browser, so
   * the rule holds for anything that reaches this endpoint. Held against the
   * project, so the next scan of the same repository inherits it.
   */
  add('POST /flow-reports/runs/:id/findings/status', ({ params, body, res }) => {
    const id = params.id
    const run = store.getRun(id)
    if (!run) return send(res, 404, { error: 'not found' })

    const b = obj(body)
    const status = String(b.status ?? '') as FindingStatus
    if (!(FINDING_STATUSES as readonly string[]).includes(status)) {
      return send(res, 400, { error: `status must be one of ${FINDING_STATUSES.join(', ')}` })
    }

    // Checked against the run rather than taken on trust, so an id that matches
    // nothing cannot be stored and then silently do nothing for ever.
    const section = run.sections.find((s) => s.category === b.category)
    const finding = section?.findings.find((f) => f.id === String(b.findingId ?? ''))
    if (!section || !finding) {
      return send(res, 404, { error: 'no finding in this run matches that id' })
    }

    if (status === 'open') {
      store.reopenFinding(run.projectId, section.category, finding.id)
      return { run: enrich(store.getRun(id)!), running: manager.isRunning(id) }
    }

    const reason = String(b.reason ?? '').trim()

    // A finding that already carries a response can change status without
    // being made to say the same thing twice. The rule was ever "nothing is
    // resolved without a stated reason", and a response is that statement.
    if (!reason) {
      if ((finding.responses ?? []).length === 0) {
        return send(res, 400, { error: 'A resolution reason is required.' })
      }
      store.upsertResolutionStatus({
        projectId: run.projectId,
        category: section.category,
        findingId: finding.id,
        status,
        title: finding.title,
        by: null,
      })
      return { run: enrich(store.getRun(id)!), running: manager.isRunning(id) }
    }

    store.resolveWithReason({
      projectId: run.projectId,
      category: section.category,
      findingId: finding.id,
      status,
      reason,
      title: finding.title,
      // Null on a single-user installation, which has nobody to attribute it
      // to. Recorded rather than invented.
      by: null,
    })

    // Nothing else to write. Reading a run applies the resolutions and derives
    // the scores from them, so the database keeps the numbers the run measured
    // and this hands back the adjusted view by the same path the page, the
    // Markdown and the PDF all use.
    return { run: enrich(store.getRun(id)!), running: manager.isRunning(id) }
  })

  /**
   * Add a response to a finding, and settle its status at the same time when
   * one is given.
   *
   * The two travel together because they are one act for the person doing it:
   * here is what I did, and it is resolved. Sending no status records the
   * account and leaves the finding open, which is what a note on work in
   * progress is.
   */
  add('POST /flow-reports/runs/:id/responses', ({ params, body, res }) => {
    const id = params.id
    const run = store.getRun(id)
    if (!run) return send(res, 404, { error: 'not found' })

    const b = obj(body)
    const section = run.sections.find((s) => s.category === b.category)
    const finding = section?.findings.find((f) => f.id === String(b.findingId ?? ''))
    if (!section || !finding) {
      return send(res, 404, { error: 'no finding in this run matches that id' })
    }

    const text = String(b.body ?? '').trim()
    if (!text) return send(res, 400, { error: 'A resolution reason is required.' })

    const status = b.status ? String(b.status) as FindingStatus : undefined
    if (status && !(FINDING_STATUSES as readonly string[]).includes(status)) {
      return send(res, 400, { error: `status must be one of ${FINDING_STATUSES.join(', ')}` })
    }

    store.addResponse({
      projectId: run.projectId,
      category: section.category,
      findingId: finding.id,
      body: text,
      source: 'typed',
    })

    if (status && status !== 'open') {
      store.saveResolution({
        projectId: run.projectId,
        category: section.category,
        findingId: finding.id,
        status: status as Exclude<FindingStatus, 'open'>,
        // The text lives in the response now. This column is left empty rather
        // than holding a second copy that would drift from it.
        reason: '',
        title: finding.title,
      })
    }

    return { run: enrich(store.getRun(id)!), running: manager.isRunning(id) }
  })

  /**
   * Read a response document against this run and say what it would change.
   *
   * Reads nothing from disk and writes nothing. The document arrives as text
   * that the browser read, so the daemon gains no filesystem surface — it reads
   * only inside the selected repository root, and a file somebody picked from
   * anywhere else would be an exception to that for no gain.
   */
  add('POST /flow-reports/runs/:id/responses/preview', ({ params, body, res }) => {
    const run = store.getRun(params.id)
    if (!run) return send(res, 404, { error: 'not found' })

    const text = String(obj(body).text ?? '')
    if (!text.trim()) return send(res, 400, { error: 'The file was empty.' })

    return { preview: previewResponseDocument(text, run) }
  })

  /**
   * Apply the rows somebody accepted in the preview.
   *
   * Every row is re-checked against the run rather than trusted on the way back
   * in. The preview's output has been through a browser and a person since it
   * was produced, and a findingId matching nothing would otherwise be written
   * and then sit there doing nothing for ever.
   */
  add('POST /flow-reports/runs/:id/responses/apply', ({ params, body, res }) => {
    const id = params.id
    const run = store.getRun(id)
    if (!run) return send(res, 404, { error: 'not found' })

    const b = obj(body)
    const incoming = Array.isArray(b.rows)
      ? b.rows as Array<{ category?: string; findingId?: string; body?: string; status?: string }>
      : []
    if (incoming.length === 0) return send(res, 400, { error: 'Nothing was selected.' })

    const rows: Array<{
      category: string; findingId: string; findingTitle: string
      body: string; status: FindingStatus
    }> = []

    for (const row of incoming) {
      const section = run.sections.find((s) => s.category === row?.category)
      const finding = section?.findings.find((f) => f.id === String(row?.findingId ?? ''))
      if (!section || !finding) {
        return send(res, 404, { error: `no finding in this run matches ${row?.category}/${row?.findingId}` })
      }
      const text = String(row.body ?? '').trim()
      if (!text) return send(res, 400, { error: `no response text for ${finding.title}` })
      const status = String(row.status ?? 'noted') as FindingStatus
      if (!(FINDING_STATUSES as readonly string[]).includes(status)) {
        return send(res, 400, { error: `status must be one of ${FINDING_STATUSES.join(', ')}` })
      }
      rows.push({
        category: section.category,
        findingId: finding.id,
        findingTitle: finding.title,
        body: text,
        status,
      })
    }

    const applied = store.applyImport({
      projectId: run.projectId,
      sourceName: String(b.sourceName ?? 'an uploaded document'),
      rows,
    })

    return { run: enrich(store.getRun(id)!), applied }
  })

  /**
   * Revise the wording of one response.
   *
   * Keyed by response id alone: a response belongs to the project, and the one
   * written against last week's run is the same record when this week's run
   * reads it back. `runId` says which run to recompute and hand back.
   */
  add('PATCH /flow-reports/responses/:responseId', ({ params, query, body, res }) => {
    const text = String(obj(body).body ?? '').trim()
    if (!text) return send(res, 400, { error: 'A resolution reason is required.' })
    if (!store.editResponse(params.responseId, text)) {
      return send(res, 404, { error: 'no such response' })
    }
    const run = store.getRun(query.get('runId') ?? '')
    return { run: run ? enrich(run) : null }
  })

  /**
   * Remove one response.
   *
   * If it was the last one on a closed finding, that finding reopens —
   * `isClosedBy` counts responses, so it follows — which moves the score, so
   * the recomputed run goes back rather than an acknowledgement.
   */
  add('DELETE /flow-reports/responses/:responseId', ({ params, query, res }) => {
    if (!store.deleteResponse(params.responseId)) {
      return send(res, 404, { error: 'no such response' })
    }
    const run = store.getRun(query.get('runId') ?? '')
    return { run: run ? enrich(run) : null }
  })

  /**
   * Delete a run that has finished, whether or not it produced a report.
   *
   * It is their history, and a report kept against their wishes is not being
   * kept for them; the warning lives in the confirmation instead.
   *
   * A run still going is still refused. The manager is writing to it, and
   * pulling the rows out from under it would leave the half of the write that
   * had not happened yet with nowhere to land.
   */
  add('DELETE /flow-reports/runs/:id', ({ params, res }) => {
    const id = params.id
    const run = store.getRun(id)
    if (!run) return send(res, 404, { error: 'not found' })

    if (manager.isRunning(id) || !TERMINAL_RUN_STATUSES.has(run.status)) {
      return send(res, 409, { error: 'This run is still going. Cancel it first.' })
    }

    for (const reference of store.deleteRun(id)) {
      try { removeArtifact(reference) } catch { /* the rows are gone either way */ }
    }
    return { ok: true }
  })

  add('POST /flow-reports/runs/:id/cancel', ({ params, res }) => {
    const id = params.id
    const run = store.getRun(id)
    if (!run) return send(res, 404, { error: 'not found' })

    manager.cancel(id)

    // A run this manager is not running cannot be stopped by asking it to stop.
    // That is what left a spinner at 84% with a Cancel button that did nothing:
    // the daemon had restarted, the job was gone, and only the row remained.
    // Pressing Cancel on one of those now closes the row itself.
    if (!manager.isRunning(id) && !TERMINAL_RUN_STATUSES.has(run.status)) {
      store.updateRun(id, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      })
    }
    return { ok: true }
  })

  /** The diagnostic log, for the panel that shows what the run actually did. */
  add('GET /flow-reports/runs/:id/log', ({ params, query, res }) => {
    if (!store.getRun(params.id)) return send(res, 404, { error: 'not found' })
    const limit = query.get('limit')
    return { events: store.listEvents(params.id, limit ? Number(limit) : 200) }
  })

  // ── Live progress ──────────────────────────────────────────────────────────
  //
  // Server-sent events, as in FlowAgent: one `data:` frame per ProgressEvent,
  // the run's current state first, and the stream closed once the run is
  // terminal. The router has already checked the bearer token, so a client
  // reading this with fetch (or EventSource with `?token=`) is authenticated
  // the same way as every other call. CORS is the router's too.

  add('GET /flow-reports/runs/:id/events', ({ params, req, res }) => {
    const id = params.id
    const run = store.getRun(id)
    if (!run) return send(res, 404, { error: 'not found' })

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })

    const write = (payload: unknown): void => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    // Current state first, so a client that connects late is not staring at an
    // empty bar for a run that is already three sections in.
    write({ runId: id, projectId: run.projectId, status: run.status, progress: run.progress, currentStage: run.currentStage })

    if (TERMINAL_RUN_STATUSES.has(run.status) && !manager.isRunning(id)) {
      res.end()
      return undefined
    }

    // A comment line every so often, so a proxy or the browser does not decide
    // a quiet stretch — the model writing one long finding — is a dead stream.
    const ping = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n') }, 15_000)
    let unsub = (): void => {}
    const stop = (): void => { unsub(); clearInterval(ping) }
    unsub = manager.subscribe((e) => {
      if (e.runId !== id) return
      write(e)
      if (e.status && TERMINAL_RUN_STATUSES.has(e.status)) {
        stop()
        res.end()
      }
    })
    req.on('close', stop)
    return undefined
  })

  // ── Downloads ──────────────────────────────────────────────────────────────

  add('GET /flow-reports/runs/:id/download/:format', async ({ params, res }) => {
    const { id, format } = params
    const run = store.getRun(id)
    if (!run) return send(res, 404, { error: 'not found' })

    let artifact = run.artifacts.find((a) => a.format === format)

    // A single-domain PDF is rendered the first time somebody asks for one.
    //
    // Rendering all of them during the run launched a browser apiece: a
    // two-hundred second run went past ten minutes and left thirty-eight
    // Chromium processes behind, to produce documents nobody opened. The
    // Markdown for every domain is written during the run because it is free;
    // the PDF is not, so it waits until it is wanted — and once rendered it is
    // saved, so the second request is a file read.
    const wantsSectionPdf = /^pdf:(.+)$/.exec(format)
    if (!artifact && wantsSectionPdf) {
      const category = wantsSectionPdf[1] as ReportCategory
      const source = run.artifacts.find((a) => a.format === `markdown:${category}`)
      const section = run.sections.find((sc) => sc.category === category)
      if (!source || !section) {
        return send(res, 404, {
          error: `This run has no ${CATEGORY_LABEL[category] ?? category} report to render from.`,
        })
      }
      try {
        artifact = await renderSectionPdf(store, run, section, source, processes)
      } catch (err: any) {
        return send(res, 500, {
          error: `That section could not be rendered as a PDF: ${String(err?.message ?? err)}. `
            + 'The Markdown for it is available and complete.',
        })
      }
    }

    if (!artifact) {
      return send(res, 404, {
        error: `This run has no ${format} report. Its absence is recorded in the run's warnings.`,
      })
    }

    // Re-checked against the boundary rather than trusted, because the value
    // arrived from a database row.
    let bytes: Buffer | null
    try {
      bytes = readArtifact(artifact.storageReference)
    } catch (err: any) {
      return send(res, 400, { error: String(err?.message ?? err) })
    }
    if (!bytes) {
      return send(res, 410, {
        error: 'The file was recorded but is no longer on disk. Re-run the analysis to produce it again.',
      })
    }

    res.writeHead(200, {
      'content-type': format.startsWith('pdf') ? 'application/pdf' : 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${artifact.filename}"`,
      'content-length': String(bytes.length),
      'x-content-sha256': artifact.sha256,
      'cache-control': 'no-store',
    })
    res.end(bytes)
    return undefined
  })
}
