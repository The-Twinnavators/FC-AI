// Capability gaps against category expectations.
//
// The Poschi version of this holds a hardcoded catalogue of styling-marketplace
// competitors, which is exactly right for Poschi and meaningless for an
// arbitrary repository. This one infers what kind of product it is looking at
// and compares against what products of that kind usually have.
//
// The honesty constraint is the whole section. With network research off — the
// default — nothing here knows anything about any competitor. It may say "most
// products in this category have X and X was not found here". It may NOT say
// "your competitors have X", because it has not looked, and a reader who
// discovers that once discounts the entire report.

import { describe, it, expect } from 'vitest'
import { analyseCompetitiveGaps } from '../../../src/flowReport/analyzers/competitive.js'

const f = (path: string, text: string) => ({ path, text, bytes: text.length })

const webApp = [
  f('package.json', JSON.stringify({
    name: 'app', dependencies: { react: '^18.0.0', 'react-router-dom': '^6.0.0' },
  })),
  f('src/App.tsx', '<Routes><Route path="/" element={<Home />} /></Routes>'),
  f('src/pages/Home.tsx', 'export default function Home() { return <div /> }'),
]

describe('working out what it is looking at', () => {
  it('recognises a web application', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    expect(out.category).toBe('web application')
  })

  it('recognises a library rather than treating it as a product', () => {
    const out = analyseCompetitiveGaps([
      f('package.json', JSON.stringify({ name: 'lib', main: 'dist/index.js', private: false })),
      f('src/index.ts', 'export function helper() {}'),
    ], { networkResearch: false })
    expect(out.category).toBe('library or package')
  })

  // A section that guesses at a category it cannot identify produces findings
  // about a product that does not exist.
  it('says it cannot tell rather than guessing', () => {
    const out = analyseCompetitiveGaps([f('notes.txt', 'hello')], { networkResearch: false })
    expect(out.category).toBeNull()
    expect(out.findings).toEqual([])
  })
})

describe('a library is not held to product expectations', () => {
  it('does not ask a package for onboarding or billing', () => {
    const out = analyseCompetitiveGaps([
      f('package.json', JSON.stringify({ name: 'lib', main: 'dist/index.js' })),
      f('src/index.ts', 'export function helper() {}'),
    ], { networkResearch: false })
    const text = JSON.stringify(out.findings).toLowerCase()
    expect(text).not.toMatch(/onboarding|billing|checkout/)
  })

  it('does ask it for the things a package is judged on', () => {
    const out = analyseCompetitiveGaps([
      f('package.json', JSON.stringify({ name: 'lib', main: 'dist/index.js' })),
      f('src/index.ts', 'export function helper() {}'),
    ], { networkResearch: false })
    const titles = out.findings.map((x) => x.title.toLowerCase()).join(' ')
    expect(titles).toMatch(/readme|documentation|type|licen/)
  })
})

describe('capabilities it looks for in a web application', () => {
  it('notices there is no authentication', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    expect(out.findings.some((x) => /authentication|sign in|account/i.test(x.title))).toBe(true)
  })

  it('stops asking once the capability is evidenced', () => {
    const withAuth = [...webApp, f('src/auth/login.tsx', 'export function SignIn() { return <form /> }')]
    const out = analyseCompetitiveGaps(withAuth, { networkResearch: false })
    expect(out.findings.some((x) => /authentication/i.test(x.title))).toBe(false)
  })

  it('notices there is no search', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    expect(out.findings.some((x) => /search/i.test(x.title))).toBe(true)
  })
})

describe('the honesty constraint', () => {
  // The single most important test in this file.
  it('never names a competitor when network research is off', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    const prose = JSON.stringify(out.findings).toLowerCase()
    for (const word of ['competitor', 'rival', 'versus', 'compared to ', 'industry leader']) {
      expect(prose, `should not contain "${word}"`).not.toContain(word)
    }
  })

  it('frames every gap as a hypothesis rather than a verified fact', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    expect(out.findings.length).toBeGreaterThan(0)
    for (const finding of out.findings) {
      expect(finding.confidence).not.toBe('verified')
      expect(finding.isAbsence).toBe(true)
    }
  })

  it('says in each finding that it is a category expectation, not a market claim', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    for (const finding of out.findings) {
      expect(`${finding.detail} ${finding.because}`.toLowerCase())
        .toMatch(/category|products of this kind|commonly|typically|usually/)
    }
  })

  it('records that no external research was performed', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    expect(out.researchPerformed).toBe(false)
    expect(out.limitations.join(' ')).toMatch(/no external research|nothing left this machine/i)
  })

  // Enabling the setting must not, on its own, conjure competitor claims. The
  // research itself is a separate piece of work; until it exists, the honest
  // output with the flag on is the same as with it off.
  it('does not fabricate competitor findings when the flag is merely enabled', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: true })
    const prose = JSON.stringify(out.findings).toLowerCase()
    expect(prose).not.toContain('competitor')
    expect(out.limitations.join(' ')).toMatch(/not implemented|no research was performed/i)
  })
})

describe('the shape it returns', () => {
  it('matches the common finding shape the normalizer takes', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    for (const finding of out.findings) {
      expect(['high', 'medium', 'low', 'info']).toContain(finding.severity)
      expect(['verified', 'indicated', 'hypothesis']).toContain(finding.confidence)
      expect(finding.next).toBeTruthy()
      expect(finding.because).toBeTruthy()
      for (const p of finding.files) expect(p).not.toMatch(/^[A-Za-z]:|^\//)
    }
  })

  it('never rates a category expectation above medium', () => {
    const out = analyseCompetitiveGaps(webApp, { networkResearch: false })
    for (const finding of out.findings) {
      expect(['medium', 'low', 'info']).toContain(finding.severity)
    }
  })
})
