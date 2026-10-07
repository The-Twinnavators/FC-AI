// daemon/src/flow-reports/__tests__/responseImport.test.ts
//
// The parser reads documents it did not write. These fixtures are shaped like
// the one this was built against — headings at a depth FlowAgent's own export
// does not use, numbering it does not produce — because that is the case it has
// to survive.

import { describe, it, expect } from 'vitest'
import {
  normaliseHeading, categoryFromHeading, verdictLead, readVerdict,
  previewResponseDocument,
} from '../../src/flowReport/responseImport.js'
import type { FlowReportRun } from '../../src/flowReport/types.js'

describe('reading a heading', () => {
  it('ignores the depth, because documents disagree about it', () => {
    expect(normaliseHeading('### 1.1 No robots.txt')).toBe('no robots.txt')
    expect(normaliseHeading('#### 3. No robots.txt')).toBe('no robots.txt')
    expect(normaliseHeading('## No robots.txt')).toBe('no robots.txt')
  })

  it('drops numbering of any depth and a trailing parenthetical', () => {
    expect(normaliseHeading('## 14.2 Short-term: 25 actions'))
      .toBe('short-term: 25 actions')
    expect(normaliseHeading('## 1. Error log & reports (Score 80/100)'))
      .toBe('error log & reports')
  })

  it('finds the category a section heading names', () => {
    expect(categoryFromHeading('## 1. Error log & reports (Score 80/100)')).toBe('error_log')
    expect(categoryFromHeading('## 10. Security QA')).toBe('security_qa')
    expect(categoryFromHeading('### 1.1 No robots.txt')).toBeNull()
  })
})

describe('reading the verdict', () => {
  const lead = (s: string) => readVerdict(verdictLead(s))

  it('takes the bolded lead when there is one', () => {
    expect(verdictLead('**Response — resolved.** `README.md` added this session.'))
      .toBe('Response — resolved.')
  })

  it('falls back to the first sentence', () => {
    expect(verdictLead('Not applicable at this stage. A single-file app does not yet.'))
      .toBe('Not applicable at this stage.')
  })

  // The rule this table exists for. Work begun is not work finished, and
  // "largely resolved" is the commoner phrasing of the two.
  it('puts largely resolved at noted, not resolved', () => {
    expect(lead('**Response — largely resolved, filed as `needs_review`.** It works.')
      .status).toBe('noted')
    expect(lead('**Response — partially resolved, filed as `needs_review`.** Half.')
      .status).toBe('noted')
  })

  it('reads the four plain verdicts', () => {
    expect(lead('**Response — resolved.** Added.').status).toBe('resolved')
    expect(lead('**Response — not applicable at this stage.** No plans.').status)
      .toBe('not_applicable')
    expect(lead('**Response — open, not yet investigated.** Not audited.').status)
      .toBe('noted')
    expect(lead('**Response — confirmed accurate, no action needed.** Checked.').status)
      .toBe('accepted_risk')
  })

  // "false negative, not applicable" and "false positive, resolved" both carry
  // a second word that the wrong rule order would catch first.
  it('reads a verdict that leads with false positive or false negative', () => {
    expect(lead('**Response — false positive, resolved.** Checked both files.').status)
      .toBe('resolved')
    expect(lead('**Response — false negative, not applicable.** Never read.').status)
      .toBe('not_applicable')
  })

  it('does not let the body decide when the lead says nothing', () => {
    const v = lead('**Response — needs a conversation.** This was resolved in a sense.')
    expect(v.status).toBe('noted')
    expect(v.rule).toBe('no verdict read')
  })
})

// ── Matching against a run ───────────────────────────────────────────────────

const run = (findings: Array<{ category: string; id: string; title: string }>) => ({
  sections: [...new Set(findings.map((f) => f.category))].map((category) => ({
    category,
    findings: findings.filter((f) => f.category === category)
      .map((f) => ({ id: f.id, title: f.title })),
  })),
}) as unknown as FlowReportRun

describe('matching a document to a run', () => {
  const r = run([
    { category: 'seo', id: 'no-robots', title: 'No robots.txt' },
    { category: 'seo', id: 'no-canonical', title: 'No canonical link' },
    { category: 'compliance', id: 'age-gate', title: 'Nothing in signup establishes that a user is an adult' },
  ])

  const doc = `# Response to FlowAgent repo analysis

## 5. SEO & link previews

### 5.2 No robots.txt

**Response — resolved.** \`robots.txt\` present.

### 5.4 No canonical link

**Response — open, pending a decision.** Not built.

## 9. Compliance

### 9.3 Nothing in signup establishes that a user is an adult

**Response — not applicable.** Invite-only admin portal.

### 9.9 A finding this run never produced

**Response — resolved.** Nothing to attach this to.
`

  const out = previewResponseDocument(doc, r)

  it('carries the document title, so a wrong file is obvious', () => {
    expect(out.documentTitle).toBe('Response to FlowAgent repo analysis')
  })

  // The title is what a document says; the id is what the database keys on.
  it('stores against the finding id, not the title it matched on', () => {
    expect(out.proposals.map((p) => p.findingId)).toEqual(
      ['no-robots', 'no-canonical', 'age-gate'])
  })

  it('applies the verdict rules per finding', () => {
    expect(out.proposals.map((p) => p.status))
      .toEqual(['resolved', 'noted', 'not_applicable'])
  })

  it('keeps the body verbatim', () => {
    expect(out.proposals[0]!.body).toBe('**Response — resolved.** `robots.txt` present.')
  })

  it('shows the text each verdict was read from', () => {
    expect(out.proposals[0]!.verdictText).toBe('Response — resolved.')
  })

  it('reports a heading that matches nothing rather than dropping it', () => {
    expect(out.unmatched).toEqual(['9.9 A finding this run never produced'])
  })

  it('counts the findings the document says nothing about', () => {
    const bigger = run([
      { category: 'seo', id: 'no-robots', title: 'No robots.txt' },
      { category: 'seo', id: 'other', title: 'Something else entirely' },
    ])
    expect(previewResponseDocument(doc, bigger).unanswered).toBe(1)
  })
})

describe('a document that is not one', () => {
  const r = run([{ category: 'seo', id: 'no-robots', title: 'No robots.txt' }])

  it('reads a document with no headings as nothing, and does not throw', () => {
    const out = previewResponseDocument('Just prose, no headings at all.\n', r)
    expect(out.proposals).toEqual([])
    expect(out.unmatched).toEqual([])
  })

  it('matches nothing when the document answers another project', () => {
    const out = previewResponseDocument(
      '# Response\n\n### 1.1 A finding from somewhere else\n\n**Response — resolved.** x\n', r)
    expect(out.proposals).toEqual([])
    expect(out.unmatched).toHaveLength(1)
  })
})
