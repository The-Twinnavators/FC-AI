// daemon/src/flow-reports/report/metrics.ts
//
// The numbers worth putting in large type.
//
// ── Extracted, never computed ────────────────────────────────────────────────
//
// Every figure here is lifted out of a sentence the analyser already wrote. A
// metric derived independently would be a second measurement of the same thing,
// and the moment the two differed the report would be arguing with itself in
// print. If the analyser did not say a number, this finds none, and the layout
// shows none rather than filling the space.
//
// ── A figure without its unit is decoration ──────────────────────────────────
//
// "150" in large type says nothing. "150 catch blocks" says something. So a
// candidate is only kept when the words attached to it survived the extraction
// intact, and anything that arrives as a bare number is dropped.

import type { Finding } from '../types.js'

export interface Metric {
  /** Printed large. Already formatted with separators. */
  value: string
  /** Printed small beneath it. Lower case, no trailing punctuation. */
  label: string
}

/** Words that make a number meaningless on its own, usually because they are
 *  part of a reference rather than a measurement. */
const NOISE = /^(of|and|or|to|in|at|the|a|an|is|are|was|were|per|out|line|lines?\b\s*\d)/i

/**
 * Words that are grammar rather than a unit.
 *
 * Trimmed off the end, because a two-word window lands on one about as often
 * as it does not: "96 files either have an empty body" gave the label "files
 * either", which was set at 20pt beside the number and read as a typing error.
 */
const TRAILING = new Set([
  'either', 'have', 'has', 'had', 'and', 'or', 'that', 'which', 'are', 'is',
  'was', 'were', 'be', 'been', 'with', 'in', 'of', 'on', 'at', 'to', 'for',
  'from', 'across', 'contain', 'contains', 'carry', 'carries', 'write',
  'writes', 'appear', 'appears', 'over', 'under', 'no', 'not', 'but', 'than',
  'as', 'by', 'per', 'its', 'their', 'the', 'a', 'an', 'do', 'does', 'each',
  'still', 'only', 'also', 'both', 'more', 'less',
])

/** Lower case, punctuation off, grammar trimmed. Empty when nothing survives,
 *  which the caller treats as "there is no metric here". */
const tidy = (label: string): string => {
  const words = label.trim().replace(/[.,;:]$/, '').toLowerCase().split(/\s+/)
  while (words.length > 0 && TRAILING.has(words[words.length - 1]!)) words.pop()
  return words.join(' ').slice(0, 28)
}

const fmt = (n: string): string => Number(n.replace(/,/g, '')).toLocaleString('en-GB')

/**
 * Pull `<number> <noun phrase>` pairs out of a sentence.
 *
 * Bounded to two words after the number: "150 catch blocks" is a measurement,
 * "150 catch blocks across 96 files either have" is a sentence fragment, and
 * setting a sentence fragment at 22pt is worse than setting nothing.
 */
function pairs(text: string): Metric[] {
  const out: Metric[] = []
  const re = /(\d[\d,]*)\s+([a-zA-Z][a-zA-Z-]*(?:\s+[a-zA-Z][a-zA-Z-]*)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[1]!
    const label = m[2]!
    if (NOISE.test(label)) continue
    // A year, a port, a status code. None of them is a measurement of this
    // project, and all of them look like one in large type.
    if (/^(19|20)\d\d$/.test(value)) continue
    const clean = tidy(label)
    // A number whose unit did not survive the trim is a bare number, and a bare
    // number at 20pt says nothing.
    if (!clean) continue
    out.push({ value: fmt(value), label: clean })
  }
  return out
}

/**
 * The figures to call out for one finding, most specific first.
 *
 * At most three: a strip of four numbers stops being a callout and becomes a
 * table that has lost its headings.
 */
export function metricsFor(f: Finding): Metric[] {
  const seen = new Set<string>()
  const out: Metric[] = []

  const add = (m: Metric) => {
    const key = `${m.value}|${m.label}`
    if (seen.has(key) || out.length >= 3) return
    seen.add(key)
    out.push(m)
  }

  // The title first — an analyser that led with a number led with it on purpose.
  for (const m of pairs(f.title)) add(m)
  for (const m of pairs(f.summary)) add(m)

  // The count of cited locations, which is a fact about the finding rather than
  // a claim inside it. Only when it adds something the sentences did not.
  const files = new Set(f.evidence.map((e) => e.path).filter(Boolean)).size
  if (files > 1) add({ value: fmt(String(files)), label: files === 1 ? 'file cited' : 'files cited' })

  return out
}

/** The same, for a whole section — the figures a divider page should carry. */
export function sectionMetrics(findings: Finding[]): Metric[] {
  const counted = new Map<string, number>()
  for (const f of findings) {
    for (const m of metricsFor(f)) {
      // Keep the largest instance of each label. Two findings each citing
      // "3 files" are not "6 files", and adding them would invent a number.
      const n = Number(m.value.replace(/,/g, ''))
      counted.set(m.label, Math.max(counted.get(m.label) ?? 0, n))
    }
  }
  return [...counted.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, n]) => ({ value: n.toLocaleString('en-GB'), label }))
}
