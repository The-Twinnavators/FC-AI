// Reliability and error visibility, read from the source.
//
// This is the one category with no existing analyser behind it. The Poschi
// version is a live feed from a deployed product's error API, which tells you
// nothing about an arbitrary repository, so this is a static read of how a
// project handles and reports failure.
//
// The discipline that matters: this must never claim an incident happened. It
// can say a catch block discards its error, and it can say nothing in the tree
// reports errors anywhere. It cannot say the product is failing, because
// source code does not know that.

import { describe, it, expect } from 'vitest'
import { analyseErrorHandling } from '../../../src/flowReport/analyzers/errorLog.js'

const f = (path: string, text: string) => ({ path, text, bytes: text.length })
const titles = (files: ReturnType<typeof f>[]) =>
  analyseErrorHandling(files).findings.map((x) => x.title.toLowerCase())

describe('swallowed errors', () => {
  it('finds a catch block that discards what it caught', () => {
    const out = titles([f('src/a.ts', 'try { risky() } catch (e) {}')])
    expect(out.some((t) => /swallow|discard|empty catch/.test(t))).toBe(true)
  })

  it('finds a catch that only logs to the console', () => {
    const out = titles([f('src/a.ts', 'try { risky() } catch (e) { console.log(e) }')])
    expect(out.some((t) => /swallow|console|discard/.test(t))).toBe(true)
  })

  // A catch that rethrows, reports, or sets state is doing its job. Flagging it
  // would bury the real ones.
  it('leaves a catch that actually handles the error alone', () => {
    const files = [f('src/a.ts', [
      'try { risky() } catch (e) { setError(e); reportError(e); throw e }',
    ].join('\n'))]
    const out = analyseErrorHandling(files)
    const swallow = out.findings.filter((x) => /swallow|discard/i.test(x.title))
    expect(swallow).toHaveLength(0)
  })

  // The codebase being analysed may legitimately use an empty catch as a
  // documented fallback. One is a style choice; forty is a pattern.
  it('counts them rather than reporting one finding per occurrence', () => {
    const many = Array.from({ length: 12 }, (_, i) => f(`src/f${i}.ts`, 'try { a() } catch {}'))
    const out = analyseErrorHandling(many)
    const swallow = out.findings.filter((x) => /swallow|discard|empty catch/i.test(x.title))
    expect(swallow).toHaveLength(1)
    expect(swallow[0]?.files.length).toBeGreaterThan(1)
    expect(swallow[0]?.detail).toMatch(/12/)
  })
})

describe('error reporting', () => {
  it('notes when nothing in the tree reports errors anywhere', () => {
    const out = titles([f('src/a.ts', 'export const x = 1')])
    expect(out.some((t) => /error reporting|monitoring/.test(t))).toBe(true)
  })

  it('recognises a reporting integration and stops asking for one', () => {
    for (const lib of ['@sentry/react', 'bugsnag', 'rollbar', '@datadog/browser-logs']) {
      const out = titles([f('src/setup.ts', `import x from '${lib}'`)])
      expect(out.some((t) => /no error reporting/.test(t)), lib).toBe(false)
    }
  })

  it('recognises a structured logger', () => {
    const out = analyseErrorHandling([f('src/log.ts', "import pino from 'pino'")])
    expect(out.facts.hasStructuredLogging).toBe(true)
  })

  it('recognises a dependency in the manifest even with no import in the scanned files', () => {
    const out = analyseErrorHandling([
      f('package.json', '{"dependencies":{"@sentry/node":"^7.0.0"}}'),
      f('src/a.ts', 'export const x = 1'),
    ])
    expect(out.facts.hasErrorReporting).toBe(true)
  })

  // The bug this test exists for: the first version searched the whole tree for
  // these names and, run against FlowAgent's own daemon, reported that the
  // daemon had error reporting. The only match was the analyser's own source.
  // Any repository holding a linter rule, a dependency audit, or a paragraph of
  // documentation mentioning Sentry would get the same answer — and it is a
  // false positive that SUPPRESSES a real absence, so nothing on the page
  // would say why the gap went unreported.
  it('does not count a library merely mentioned in a string or a regex', () => {
    const out = analyseErrorHandling([
      f('src/lint.ts', [
        "const REPORTING = /@sentry\\/|bugsnag|rollbar/i",
        "const msg = 'consider adding @sentry/node to this project'",
        "// winston and pino are both reasonable choices here",
      ].join('\n')),
    ])
    expect(out.facts.hasErrorReporting).toBe(false)
    expect(out.facts.hasStructuredLogging).toBe(false)
  })

  it('does not count an error boundary identifier appearing outside React source', () => {
    const out = analyseErrorHandling([
      f('package.json', '{"dependencies":{"react":"^18.0.0"}}'),
      f('src/App.tsx', 'export default function App() { return <div /> }'),
      // An analyser that searches for the identifier is not a component using it.
      f('src/scan.ts', "const RE = /componentDidCatch|ErrorBoundary/"),
    ])
    expect(out.facts.hasErrorBoundary).toBe(false)
  })
})

describe('React error boundaries', () => {
  it('notes their absence in a React project', () => {
    const out = titles([
      f('package.json', '{"dependencies":{"react":"^18.0.0"}}'),
      f('src/App.tsx', 'export default function App() { return <div /> }'),
    ])
    expect(out.some((t) => /error boundary/.test(t))).toBe(true)
  })

  it('finds one when it is there', () => {
    const out = titles([
      f('package.json', '{"dependencies":{"react":"^18.0.0"}}'),
      f('src/ErrorBoundary.tsx', 'class ErrorBoundary extends Component { componentDidCatch(e) {} }'),
    ])
    expect(out.some((t) => /no error boundary/.test(t))).toBe(false)
  })

  // Asking a Python or Go project for a React error boundary is noise.
  it('does not ask a non-React project for one', () => {
    const out = titles([f('main.py', 'print("hello")')])
    expect(out.some((t) => /error boundary/.test(t))).toBe(false)
  })
})

describe('console logging left in source', () => {
  it('reports it as a pattern once, with a count', () => {
    const files = Array.from({ length: 30 }, (_, i) =>
      f(`src/f${i}.ts`, 'console.log("debug", value)'))
    const out = analyseErrorHandling(files)
    const hits = out.findings.filter((x) => /console/i.test(x.title))
    expect(hits.length).toBeLessThanOrEqual(2)
  })

  it('ignores console calls in tests, where they are ordinary', () => {
    const out = analyseErrorHandling([
      f('src/__tests__/a.test.ts', 'console.log("x")'),
    ])
    expect(out.facts.consoleCalls).toBe(0)
  })
})

describe('what it must never say', () => {
  // The line between "this code discards errors" and "this product is broken"
  // is the whole credibility of the section.
  it('never claims an incident or an outage occurred', () => {
    const out = analyseErrorHandling([f('src/a.ts', 'try { a() } catch {}')])
    const prose = JSON.stringify(out.findings).toLowerCase()
    expect(prose).not.toMatch(/incident|outage|is failing|users are|downtime/)
  })

  it('grades an absence as needing runtime confirmation rather than as verified fact', () => {
    const out = analyseErrorHandling([f('src/a.ts', 'export const x = 1')])
    const absences = out.findings.filter((x) => x.isAbsence)
    expect(absences.length).toBeGreaterThan(0)
    for (const a of absences) expect(a.confidence).not.toBe('verified')
  })
})

describe('the shape it returns', () => {
  it('matches the common Poschi finding shape, so the normalizer can take it', () => {
    const out = analyseErrorHandling([f('src/a.ts', 'try { a() } catch {}')])
    for (const finding of out.findings) {
      expect(finding).toMatchObject({
        id: expect.any(String),
        area: expect.any(String),
        title: expect.any(String),
        detail: expect.any(String),
        because: expect.any(String),
        next: expect.any(String),
        isAbsence: expect.any(Boolean),
      })
      expect(['high', 'medium', 'low', 'info']).toContain(finding.severity)
      expect(['verified', 'indicated', 'hypothesis']).toContain(finding.confidence)
      for (const p of finding.files) expect(p).not.toMatch(/^[A-Za-z]:|^\//)
    }
  })

  it('produces no findings at all for an empty file list, rather than inventing them', () => {
    const out = analyseErrorHandling([])
    expect(out.findings).toEqual([])
  })
})
