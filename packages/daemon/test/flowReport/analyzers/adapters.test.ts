// The adapters, run against a real repository on disk.
//
// The mapping is unit-tested next door. What this file answers is different and
// cannot be answered with fixtures: do the existing analysers, given a scan of
// an ordinary project, actually produce findings — and does everything that
// comes out of them survive the trip without a local path attached.
//
// It runs the whole pipeline, so a break anywhere between the scanner and the
// normalizer shows up here rather than in stage 6 when a page renders nothing.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Db } from '../../../src/db/db.js'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowReportStore } from '../../../src/flowReport/store.js'
import { AnalysisJobManager } from '../../../src/flowReport/jobManager.js'
import {
  complianceAnalyzer, engineeringQualityAnalyzer, marketplaceHealthAnalyzer,
  monetizationAnalyzer, roleJourneysAnalyzer, scoreFrom, securityQaAnalyzer, seoAnalyzer,
} from '../../../src/flowReport/analyzers/adapters.js'
import { sectionScore } from '../../../src/flowReport/report/summarize.js'
import { analyseMarketplace } from '../../../src/flowReport/poschi/marketplace/analyse.js'
import { parseRouterSource } from '../../../src/flowReport/poschi/sitemap/routerParse.js'
import { DEFAULT_SETTINGS, type FlowReportRun } from '../../../src/flowReport/types.js'

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
let run: FlowReportRun

const write = (rel: string, text: string) => {
  const full = join(repo, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, text)
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'flow-reports-adapters-'))
  repo = join(dir, 'sample-app')
  mkdirSync(repo, { recursive: true })

  // An ordinary small web project: a manifest, an entry document, a couple of
  // routes, a component that swallows an error, and no tests. Deliberately not
  // a marketplace, so the not-applicable path is exercised for real.
  write('package.json', JSON.stringify({
    name: 'sample-app', version: '1.0.0',
    scripts: { dev: 'vite', build: 'vite build' },
    dependencies: { react: '^18.0.0' },
  }, null, 2))
  write('index.html', '<!doctype html><html lang="en"><head><title>Sample</title></head><body></body></html>')
  write('src/App.tsx', [
    "import { Routes, Route } from 'react-router-dom'",
    "import Home from './pages/Home'",
    'export default function App() {',
    '  return (<Routes><Route path="/" element={<Home />} /></Routes>)',
    '}',
  ].join('\n'))
  write('src/pages/Home.tsx', [
    'export default function Home() {',
    '  const load = async () => {',
    '    try { await fetch("/api/things") } catch (e) { console.log(e) }',
    '  }',
    '  return <button onClick={load}>Load</button>',
    '}',
  ].join('\n'))
  write('README.md', '# Sample App\n\nA small example project.\n')

  store = new FlowReportStore(new Db(join(dir, 'flow-reports.db')))
  manager = new AnalysisJobManager(store, { adjudicate: withdrawNothing as never, verifyAbsences: checkNoAbsences as never, locate: locateNothing as never, writeBrief: noBrief as never, comprehend: noComprehension, rewrite: noRewrite as never })
  const project = store.createProject({
    name: 'Sample', repositoryDisplayName: 'sample-app',
    repositoryPath: repo, settings: DEFAULT_SETTINGS,
  })
  const started = await manager.start(project.id, [
    engineeringQualityAnalyzer(), seoAnalyzer(), monetizationAnalyzer(),
    roleJourneysAnalyzer(), complianceAnalyzer(), marketplaceHealthAnalyzer(),
    securityQaAnalyzer(),
  ])
  await manager.wait(started.id)
  run = store.getRun(started.id)!
}, 60_000)

afterAll(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('the run as a whole', () => {
  it('finishes without failing', () => {
    expect(['completed', 'completed_with_warnings']).toContain(run.status)
  })

  // Plus two: the synthesis and the action plan are post-passes over the
  // finished sections rather than analysers, so the run always carries a
  // section for each — with `not_applicable` and a reason where nothing
  // composed or nothing asked for work, rather than no heading at all.
  it('produces a section for every analyser it was given, plus the two post-passes', () => {
    expect(run.sections).toHaveLength(9)
    expect(run.sections.map((s) => s.category)).toContain('cross_domain')
    expect(run.sections.map((s) => s.category)).toContain('action_plan')
    for (const s of run.sections) {
      expect(['completed', 'completed_with_warnings', 'not_applicable']).toContain(s.status)
    }
  })

  it('records no errors', () => {
    expect(run.errors).toEqual([])
  })
})

describe('the analysers actually found things', () => {
  // The point of the whole exercise. A pipeline that runs cleanly and produces
  // nothing is indistinguishable from a broken one on a dashboard.
  it('produces findings across more than one section', () => {
    const withFindings = run.sections.filter((s) => s.findings.length > 0)
    expect(withFindings.length).toBeGreaterThan(1)
  })

  it('gives every finding the fields the report renders', () => {
    for (const s of run.sections) {
      for (const f of s.findings) {
        expect(f.title).toBeTruthy()
        expect(f.summary).toBeTruthy()
        expect(f.recommendation).toBeTruthy()
        expect(f.rationale).toBeTruthy()
        expect(['critical', 'high', 'medium', 'low', 'info']).toContain(f.severity)
        expect(['high', 'medium', 'low']).toContain(f.confidence)
        expect(f.evidence.length).toBeGreaterThan(0)
      }
    }
  })

  it('notices this project has no tests', () => {
    const quality = run.sections.find((s) => s.category === 'engineering_quality')!
    const text = JSON.stringify(quality.findings).toLowerCase()
    expect(text).toMatch(/test/)
  })
})

describe('nothing carries a local path out', () => {
  // The single check that matters most for privacy: the fixture lives under a
  // temp directory, and neither that nor the repo path may appear anywhere in
  // the persisted run.
  it('has no absolute path anywhere in the stored run', () => {
    const serialised = JSON.stringify(run)
    expect(serialised).not.toContain(repo)
    expect(serialised).not.toContain(dir)
  })

  it('has only repository-relative evidence paths', () => {
    for (const s of run.sections) {
      for (const f of s.findings) {
        for (const e of f.evidence) {
          if (e.path) expect(e.path).not.toMatch(/^[A-Za-z]:|^\//)
        }
      }
    }
  })
})

describe('a section that does not apply says so', () => {
  it('marks marketplace health not-applicable for a project with no marketplace', () => {
    const market = run.sections.find((s) => s.category === 'marketplace_health')!
    expect(market.status).toBe('not_applicable')
    expect(market.score).toBeNull()
    expect(market.findings).toEqual([])
    // The reason names what decided it. Two paths reach here: the description
    // saying this is something else, or the structural check finding too few
    // primitives. The fixture has a description, so it is the first.
    expect(market.reason).toMatch(/not a marketplace|not appear to be a marketplace/i)
  })
})

describe('the router is read before anything is called unreachable', () => {
  // ── The bug this pins ──
  //
  // The adapter called the marketplace analyser without routes, so `hasRoute`
  // — `routes.some(...)` over an empty list — was false for every primitive,
  // and every capability found in the code was reported as "built, but no
  // screen reaches it". On POSCHI that was four of the six actions the plan
  // put in Immediate, each about a screen the product has.
  //
  // React Router children are relative, which is the half that makes it hard
  // to spot: POSCHI declares `lookbooks` and `notifications` as children of
  // `/provider`, so searching the source for `/lookbooks` finds nothing.
  // `parseRouterSource` resolves the nesting; the adapter now uses it.
  const marketApp = [
    'export default function App() {',
    '  return (<Routes>',
    '    <Route path="/provider">',
    '      <Route path="lookbooks" element={<Lookbooks />} />',
    '      <Route path="notifications" element={<Notes />} />',
    '    </Route>',
    '  </Routes>)',
    '}',
  ].join('\n')

  const filesWith = (app: string) => ([
    { path: 'src/App.tsx', text: app },
    { path: 'src/api.ts', text: 'fetch("/lookbooks"); fetch("/notifications")' },
  ])

  it('resolves a nested relative route to the path it actually serves', () => {
    const routes = parseRouterSource(marketApp).routes.map((r) => r.route)
    expect(routes).toContain('/provider/lookbooks')
    expect(routes).toContain('/provider/notifications')
  })

  it('does not call a capability unreachable when a nested route reaches it', () => {
    const routes = parseRouterSource(marketApp).routes.map((r) => r.route)
    const withRoutes = analyseMarketplace(filesWith(marketApp) as never, { routes })
    expect(withRoutes.findings.find((f) => f.id === 'unsurfaced-repeat-engagement'))
      .toBeUndefined()
  })

  // The same input with the router unread, which is what the adapter used to
  // pass. If this ever matches the case above, the fix has been undone.
  it('would have called it unreachable with the router unread', () => {
    const blind = analyseMarketplace(filesWith(marketApp) as never)
    expect(blind.findings.find((f) => f.id === 'unsurfaced-repeat-engagement'))
      .toBeDefined()
  })
})

describe('compliance carries its disclaimer', () => {
  it('says it is not legal advice, on the section itself', () => {
    const compliance = run.sections.find((s) => s.category === 'compliance')!
    expect(compliance.limitations.join(' ')).toMatch(/not legal advice/i)
  })
})

describe('scoring', () => {
  it('scores a lightly-damaged section above a badly-damaged one', () => {
    expect(scoreFrom([{ severity: 'critical' }], true)).toBeLessThan(70)
    expect(scoreFrom([{ severity: 'low' }], true))
      .toBeGreaterThan(scoreFrom([{ severity: 'high' }], true)!)
  })

  // An analyser that could not look is not a project that is perfect.
  it('returns null when the section was never actually checked', () => {
    expect(scoreFrom([], false)).toBeNull()
  })

  // The version of this that returned 100 for zero findings gave role journeys
  // a perfect score on a repository with three obvious roles, purely because
  // that analyser reports gaps and found none it recognised. "Insufficient
  // evidence" is the honest answer and the report has a place to print it.
  it('returns null for zero findings rather than reading as a perfect score', () => {
    expect(scoreFrom([], true)).toBeNull()
  })

  // This asserted `toBe(0)` while the section score was a linear penalty, and
  // the assertion was the defect rather than the safeguard: against Poschi,
  // marketplace health landed on 0 with nine findings and compliance on 4, so
  // the number stopped ranking anything exactly where a reader needs it to.
  // The curve is shared with the executive summary now, and the property worth
  // holding is that it keeps distinguishing.
  it('stays in range and keeps ranking, however much is wrong', () => {
    const criticals = (n: number) =>
      Array.from({ length: n }, () => ({ severity: 'critical' as const }))
    const nine = scoreFrom(criticals(9), true)!
    const twenty = scoreFrom(criticals(20), true)!
    expect(twenty).toBeGreaterThanOrEqual(0)
    expect(twenty).toBeLessThan(nine)
    expect(nine).toBeLessThan(scoreFrom(criticals(1), true)!)
  })

  // Two formulas in one document means at least one of the numbers is not what
  // it claims. A section's score and the summary's must come from one place.
  it('uses the same curve the executive summary scores sections with', () => {
    const findings = [
      { severity: 'high' as const }, { severity: 'medium' as const },
      { severity: 'low' as const },
    ]
    expect(scoreFrom(findings, true)).toBe(sectionScore(findings as never))
  })

  it('leaves a not-applicable section unscored rather than at 100', () => {
    const market = run.sections.find((s) => s.category === 'marketplace_health')!
    expect(market.score).toBeNull()
  })
})

// ── The defect: a report that says the same thing about every repository ─────
//
// Several analysers were written for one marketplace and reused against
// whatever folder somebody picks. Measured against three unrelated projects,
// two whole sections asked that marketplace's questions of all of them: a
// digital book produced fourteen marketplace findings, and every project was
// told that "providers are paid for work arranged by the platform" at high
// severity — a claim about a product that does not exist.
describe('nothing claims this project is something it is not', () => {
  it('marks marketplace health not-applicable, with a reason that says why', () => {
    const market = run.sections.find((s) => s.category === 'marketplace_health')!
    expect(market.status).toBe('not_applicable')
    expect(market.findings).toEqual([])
    expect(market.reason).toBeTruthy()
    expect(market.reason).toMatch(/not a marketplace|not appear to be a marketplace/)
    expect(market.reason).toMatch(/not manufactured|was not assessed as one/)
  })

  it('withholds the marketplace-only obligation rather than asserting it', () => {
    const compliance = run.sections.find((s) => s.category === 'compliance')!
    for (const f of compliance.findings) {
      expect(f.title, 'no finding may assert this project pays providers')
        .not.toMatch(/Providers are paid for work arranged by the platform/)
    }
  })

  it('says that an obligation was withheld, rather than dropping it silently', () => {
    const compliance = run.sections.find((s) => s.category === 'compliance')!
    expect(compliance.limitations.join(' '))
      .toMatch(/apply only to a marketplace were not assessed/)
  })

  // The obligations that remain are ternaries over evidence — "a privacy notice
  // exists" or "no privacy notice appears" — and both are true statements about
  // any repository. Those must survive the gate.
  it('keeps the obligations that apply to any project', () => {
    const compliance = run.sections.find((s) => s.category === 'compliance')!
    expect(compliance.findings.length).toBeGreaterThan(0)
  })
})
