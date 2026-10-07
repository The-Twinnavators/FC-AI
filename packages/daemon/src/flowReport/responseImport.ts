// daemon/src/flow-reports/responseImport.ts
//
// Reading a response document and working out what it says about which finding.
//
// ── It is prose, not a format ────────────────────────────────────────────────
//
// These documents are written by whoever answered the report — often a model
// working in the repository being analysed — and they are not produced by this
// code. The one reviewed while this was built used `### 3.1 <title>` where
// FlowAgent's own export writes `#### 3. <title>`, and the next will differ
// again. So nothing here requires a heading depth, a numbering scheme or a
// section order. The only thing trusted is that a heading contains the
// finding's title somewhere in it.
//
// ── The title matches; the id stores ─────────────────────────────────────────
//
// A document says "No robots.txt". The database keys on the analyser's id,
// `no-robots`. Those are different strings and conflating them was a real
// error in an earlier draft of the design. So matching goes title → finding →
// `finding.id`, through the run being imported against, and a title that
// matches no finding in this run cannot be imported at all: there is no id to
// store it under, and a response to a finding this run did not produce has
// nothing to attach to.
//
// ── The verdict is read from the opening claim only ──────────────────────────
//
// A response three paragraphs long mentions "resolved" somewhere almost every
// time. Reading the whole body would let a passing mention decide a status that
// moves a score, so only the bolded `**Response — …**` lead is read, or failing
// that the first sentence. Every proposal carries the text its verdict was read
// from, so a wrong reading is visible in the preview rather than inferred after
// the fact.

import { CATEGORY_LABEL, type FindingStatus, type FlowReportRun } from './types.js'

/** What the document proposes for one finding, before anybody has agreed to it. */
export interface ProposedResponse {
  category: string
  findingId: string
  findingTitle: string
  /** The response text, verbatim. A summary of somebody's reasoning is not
   *  their reasoning. */
  body: string
  status: FindingStatus
  /** The exact text the status was read from, so the preview can show its work. */
  verdictText: string
  /** Which rule fired, for the same reason. */
  verdictRule: string
  /** The document's section said one category and the title was found in
   *  another. Importable, but it should be looked at. */
  categoryMismatch?: { documentSection: string; actual: string }
}

export interface ImportPreview {
  /** The document's own first heading. The fastest way for somebody to notice
   *  they picked the wrong file. */
  documentTitle: string | null
  proposals: ProposedResponse[]
  /** Headings that looked like findings and matched nothing in this run. */
  unmatched: string[]
  /** Findings in this run that the document says nothing about. */
  unanswered: number
}

/** A heading, reduced to something comparable with a finding title.
 *
 *  Strips the hashes, then leading numbering like `1.1` or `14.2` or `3.`, then
 *  a trailing parenthetical like `(Score 80/100)` or `(14)`. */
export function normaliseHeading(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^\d+(?:\.\d+)*\.?\s+/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase()
}

/** Section headings carry a category label, often numbered and scored:
 *  `## 1. Error log & reports (Score 80/100)`. Returns the category key, or
 *  null when the heading is not one of the fourteen. */
export function categoryFromHeading(line: string): string | null {
  const text = normaliseHeading(line)
  for (const [key, label] of Object.entries(CATEGORY_LABEL)) {
    if (label.toLowerCase() === text) return key
  }
  return null
}

interface Rule { status: FindingStatus; name: string; needles: string[] }

// Order is the substance of this table, not an implementation detail.
//
// "largely resolved, filed as needs_review" has to land on `noted` rather than
// `resolved`: work begun is not work finished, and it is the more common
// phrasing of the two. So the rule that catches unfinished work runs before the
// rule that catches the word "resolved".
const RULES: Rule[] = [
  {
    status: 'not_applicable',
    name: 'not applicable',
    needles: ['not applicable'],
  },
  {
    status: 'noted',
    name: 'open or unfinished',
    needles: ['open', 'partially resolved', 'largely resolved', 'needs_review',
      'needs review', 'not yet', 'unstarted', 'in progress'],
  },
  {
    status: 'resolved',
    name: 'resolved',
    needles: ['resolved', 'fixed', 'done'],
  },
  {
    status: 'accepted_risk',
    name: 'accurate, nothing to do',
    needles: ['no action needed', 'informational', 'confirmed accurate'],
  },
]

/**
 * The opening claim of a response: the bolded `**Response — …**` lead if the
 * document uses one, else the first sentence.
 */
export function verdictLead(body: string): string {
  const bold = body.match(/\*\*\s*Response\s*[—–-][^*]*\*\*/)
  if (bold) return bold[0].replace(/\*\*/g, '').trim()
  const firstSentence = body.trim().split(/(?<=[.!?])\s/)[0] ?? ''
  return firstSentence.trim()
}

/** Which status a lead claims, and which rule said so. Unreadable leads are
 *  `noted`: the account is worth keeping and nothing is closed on a guess. */
export function readVerdict(lead: string): { status: FindingStatus; rule: string } {
  const hay = lead.toLowerCase()
  for (const rule of RULES) {
    if (rule.needles.some((n) => hay.includes(n))) {
      return { status: rule.status, rule: rule.name }
    }
  }
  return { status: 'noted', rule: 'no verdict read' }
}

interface Block { heading: string; sectionCategory: string | null; body: string }

/** Split a document into headings and the text under each, carrying whichever
 *  section heading was last seen. */
function blocks(text: string): { title: string | null; blocks: Block[] } {
  const lines = text.split(/\r?\n/)
  const out: Block[] = []
  let title: string | null = null
  let section: string | null = null
  let current: Block | null = null

  for (const line of lines) {
    const isHeading = /^#{1,6}\s+\S/.test(line)
    if (!isHeading) {
      if (current) current.body += `${line}\n`
      continue
    }

    if (title === null) title = line.replace(/^#+\s*/, '').trim()

    const category = categoryFromHeading(line)
    if (category) {
      // A section heading. It scopes what follows and is not itself a finding.
      section = category
      if (current) { out.push(current); current = null }
      continue
    }

    if (current) out.push(current)
    current = { heading: line, sectionCategory: section, body: '' }
  }
  if (current) out.push(current)

  return { title, blocks: out }
}

/**
 * Read a response document against a run.
 *
 * Nothing is written. The result is a proposal to be looked at and corrected,
 * which is the whole point of separating this from applying it.
 */
export function previewResponseDocument(text: string, run: FlowReportRun): ImportPreview {
  const parsed = blocks(text)

  // Every finding in the run, by its normalised title. Built once.
  const byTitle = new Map<string, Array<{ category: string; id: string; title: string }>>()
  for (const section of run.sections) {
    for (const f of section.findings) {
      const key = f.title.trim().toLowerCase()
      const list = byTitle.get(key) ?? []
      list.push({ category: section.category, id: f.id, title: f.title })
      byTitle.set(key, list)
    }
  }

  const proposals: ProposedResponse[] = []
  const unmatched: string[] = []
  const answered = new Set<string>()

  for (const block of parsed.blocks) {
    const body = block.body.trim()
    if (!body) continue

    const candidates = byTitle.get(normaliseHeading(block.heading))
    if (!candidates || candidates.length === 0) {
      unmatched.push(block.heading.replace(/^#+\s*/, '').trim())
      continue
    }

    // With more than one finding of the same title, the document's section is
    // what tells them apart. Without that, guessing between two findings is the
    // one mistake a reader could not detect, so it is left unmatched.
    const chosen = candidates.length === 1
      ? candidates[0]!
      : candidates.find((c) => c.category === block.sectionCategory)
    if (!chosen) {
      unmatched.push(block.heading.replace(/^#+\s*/, '').trim())
      continue
    }

    const lead = verdictLead(body)
    const { status, rule } = readVerdict(lead)

    proposals.push({
      category: chosen.category,
      findingId: chosen.id,
      findingTitle: chosen.title,
      body,
      status,
      verdictText: lead,
      verdictRule: rule,
      ...(block.sectionCategory && block.sectionCategory !== chosen.category
        ? { categoryMismatch: { documentSection: block.sectionCategory, actual: chosen.category } }
        : {}),
    })
    answered.add(`${chosen.category}::${chosen.id}`)
  }

  const total = run.sections.reduce((n, s) => n + s.findings.length, 0)

  return {
    documentTitle: parsed.title,
    proposals,
    unmatched,
    unanswered: total - answered.size,
  }
}
