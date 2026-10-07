// daemon/src/flow-reports/report/markdown.ts
//
// The report, as Markdown. This is the canonical artifact.
//
// ── One source, two files ────────────────────────────────────────────────────
//
// The PDF is rendered from this exact string rather than from the run object,
// so the two cannot disagree about a severity count. A pair of documents whose
// numbers differ is worse than either alone, because a reader cannot tell which
// one is current.
//
// ── Absence is written, not omitted ──────────────────────────────────────────
//
// A section with nothing in it still gets its heading and a sentence saying
// why. Dropping the heading would let a reader page past a section that failed
// and take its absence for a clean result — which is the failure this whole
// feature is built to avoid.
//
// ── Repository-relative paths only ───────────────────────────────────────────
//
// Nothing here prints the folder the user chose. The display name appears; the
// path does not. That is enforced upstream by the store's projection and by the
// scanner, and this file simply never asks for it.

import { createHash } from 'node:crypto'
import { describePlainly, isGenericReading, actionSteps } from './plainLanguage.js'
import { metricsFor } from './metrics.js'
import {
  CATEGORY_LABEL, CATEGORY_SCOPE, REPORT_CATEGORIES,
  type Finding, type FlowReportRun, type ReportSectionResult, type Severity,
} from '../types.js'

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Informational',
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High', medium: 'Medium', low: 'Low',
}

/** Exported so the PDF cover prints the same words as the document body —
 *  a cover reading "completed" beside a page reading "Completed" looks like
 *  two different fields. */
export const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  completed_with_warnings: 'Completed with warnings',
  failed: 'Failed',
  cancelled: 'Cancelled',
  not_applicable: 'Not applicable',
  skipped: 'Skipped',
  in_progress: 'In progress',
  pending: 'Pending',
  preparing: 'Preparing',
  queued: 'Queued',
  scanning: 'Scanning',
  analyzing: 'Analyzing',
  generating: 'Generating',
}

/** A GitHub-style anchor, so the contents list actually jumps. */
const anchor = (s: string): string =>
  s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')

const bullets = (lines: string[]): string =>
  lines.length > 0 ? lines.map((l) => `- ${l}`).join('\n') : '*None recorded.*'

const numbered = (lines: string[]): string =>
  lines.length > 0 ? lines.map((l, i) => `${i + 1}. ${l}`).join('\n') : '*None recorded.*'

/**
 * One finding, in six parts, always the same six and always in this order.
 *
 * ── Why a fixed schema ───────────────────────────────────────────────────────
 *
 * A reader who has read one finding should not have to work out the shape of
 * the next. More than that: a heading that is always present makes an empty
 * one visible. "Where it was found — this is an absence, so there is no
 * location" is information. A missing Where section is indistinguishable from
 * a renderer that dropped it.
 *
 * Each part opens in plain words and then gives the precise statement, so the
 * reader who will not be fixing it and the reader who will are both served
 * without either having to skip.
 */
function findingBlock(f: Finding, index: number): string {
  const out: string[] = []
  const plain = describePlainly(f)

  // The measured title, always. The model used to rewrite this too and made it
  // worse every time: "Every link previews the same, because the tags are
  // static" became "Static Link Previews for Design System Tooling" — a label
  // where there had been a sentence that says what is wrong.
  out.push(`#### ${index}. ${f.title}`)
  out.push('')
  out.push(`**${SEVERITY_LABEL[f.severity]}** · Confidence: ${CONFIDENCE_LABEL[f.confidence]}`
    + (f.requiresManualValidation ? ' · **Requires manual validation**' : ''))
  out.push('')

  // A resolved finding travels with the reason it was resolved for. Exporting
  // it without one would hand somebody a document in which a finding is closed
  // and nothing says why — which is the state this whole feature exists to stop
  // the product being in.
  if (f.resolution) {
    const r = f.resolution
    const when = new Date(r.resolvedAt).toISOString().slice(0, 16).replace('T', ' ')
    if (r.reason.trim()) {
      out.push(`> **Resolved** ${when}${r.resolvedBy ? ` by ${r.resolvedBy}` : ''}`
        + (r.lastEditedAt
          ? `, reason last edited ${new Date(r.lastEditedAt).toISOString().slice(0, 16).replace('T', ' ')}`
          : '')
        + `. Not counted towards the score.`)
      out.push('>')
      out.push(`> ${r.reason.trim()}`)
      if (r.titleChanged) {
        out.push('>')
        out.push(`> This finding has changed since that was written — it read `
          + `"${r.titleWhenResolved}". Worth checking the reason still holds.`)
      }
    } else {
      out.push(`> **Marked resolved ${when}, with no reason recorded.** It still counts `
        + 'towards the score: a resolution nobody can read is one nobody can check.')
    }
    out.push('')
  }

  // Lifted from the sentences below; adds nothing that is not already stated
  // there. The PDF turns this line into a callout strip.
  const figures = metricsFor(f)
  if (figures.length > 0) {
    out.push(`**Key figures.** ${figures.map((m) => `${m.value} ${m.label}`).join(' · ')}`)
    out.push('')
  }

  // ── 1. What was found ──
  out.push('##### What was found')
  out.push('')
  out.push(f.tailored ? f.tailored.whatItMeans : plain.what)
  out.push('')
  if (f.tailored) {
    out.push(`**Measured as.** ${f.title}`)
    out.push('')
  }
  if (!f.tailored && isGenericReading(f)) {
    out.push('> The paragraph above is the general reading for this section rather than one '
      + 'written for this finding. The precise statement is the technical detail below.')
    out.push('')
  }
  out.push(`**Technical detail.** ${f.summary}`)
  out.push('')
  // Printed only when it is actually a second statement. The analysers carry
  // one descriptive field, so this used to repeat the sentence above it
  // verbatim under a different heading — which reads as two findings agreeing
  // rather than one finding printed twice.
  if (f.impact && f.impact.trim() !== f.summary.trim()) {
    out.push(f.impact)
    out.push('')
  }

  // ── 2. Where it was found ──
  out.push('##### Where it was found')
  out.push('')
  // The named place, above the file list. A reader following a file path still
  // has to search it; a reader following an identifier lands on the thing.
  if (f.located) {
    out.push(`**At.** \`${f.located.identifier}\` in \`${f.located.file}\``
      + (f.located.where ? ` — ${f.located.where}.` : '.'))
  }
  out.push('')
  const located = f.evidence.filter((e) => e.path)
  if (located.length > 0) {
    const where = (e: typeof located[number]) =>
      `\`${e.path}\`${e.lineStart ? `:${e.lineStart}${e.lineEnd ? `-${e.lineEnd}` : ''}` : ''}`

    // ── One shared observation is printed once ──
    //
    // Several analysers attach the same sentence to every path they cite,
    // because the finding is one claim about a set of files rather than a
    // different claim about each. Repeating it made a list of five locations
    // into five copies of a paragraph, and a reader scanning for the file names
    // had to read past the same sentence five times to find them.
    const descriptions = new Set(located.map((e) => e.description.trim()))
    if (descriptions.size === 1 && located.length > 1) {
      out.push(`${[...descriptions][0]} Found in:`)
      out.push('')
      out.push(bullets(located.map(where)))
    } else {
      out.push(bullets(located.map((e) => `${where(e)} — ${e.description}`)))
    }
    out.push('')
  }
  const unlocated = f.evidence.filter((e) => !e.path)
  if (unlocated.length > 0) {
    out.push(located.length > 0 ? '**Also observed**' : '**Observed**')
    out.push('')
    out.push(bullets(unlocated.map((e) => e.description)))
    out.push('')
  }
  if (f.evidence.length === 0) {
    out.push('*No location. This finding is about something that was looked for and not '
      + 'found, so there is no file to point at.*')
    out.push('')
  }
  out.push('All paths are relative to the repository root.')
  out.push('')

  // ── 3. Why it matters ──
  out.push('##### Why it matters')
  out.push('')
  out.push(f.tailored ? f.tailored.whyItMatters : plain.soWhat)
  out.push('')
  out.push(`**If nothing is done.** ${plain.ifIgnored}`)
  out.push('')
  out.push(`**Rationale.** ${f.rationale}`)
  out.push('')

  // ── 4. Recommendations ──
  out.push('##### Recommendations')
  out.push('')
  out.push(f.recommendation)
  out.push('')

  // ── 4b. The brief ──
  //
  // Printed under the one-line recommendation rather than instead of it: the
  // sentence is the answer at a glance, this is the answer somebody builds
  // from, and a reader skimming twelve findings wants the first.
  if (f.brief) {
    const b = f.brief
    out.push(b.intent)
    out.push('')
    out.push('**What it has to include**')
    out.push('')
    out.push(bullets(b.requirements))
    out.push('')
    if (b.flow) {
      out.push(`**${b.flow.title}**`)
      out.push('')
      out.push(numbered(b.flow.steps))
      out.push('')
      if (b.flow.cta) {
        out.push(`The action a user takes: **${b.flow.cta}**`)
        out.push('')
      }
    }
    if (b.copy) {
      out.push(`**${b.copy.title}**`)
      out.push('')
      if (b.copy.moment) {
        out.push(`*When it appears: ${b.copy.moment}*`)
        out.push('')
      }
      // A blockquote, so draft wording is never mistaken for a statement the
      // report is making. Square-bracket placeholders are the model's, kept
      // verbatim so nobody ships one by accident.
      //
      // Blank quote lines between them, because a subject line and a greeting
      // are separate lines of an email and not one sentence that happened to
      // wrap. Without them the PDF renders the whole draft as a single
      // paragraph.
      b.copy.lines.forEach((line, i) => {
        if (i > 0) out.push('>')
        out.push(`> ${line}`)
      })
      out.push('')
    }
    out.push('**Product and security considerations**')
    out.push('')
    out.push(bullets(b.considerations))
    out.push('')
    out.push('> Nothing in this brief was measured. The finding above is the measurement; this '
      + 'is what might be done about it, and every part of it is a proposal to be reviewed '
      + 'rather than a description of the code.')
    out.push('')
  }

  // ── 5. What to do ──
  out.push('##### What to do')
  out.push('')
  out.push(numbered(f.tailored ? f.tailored.whatToDo : actionSteps(f)))
  out.push('')

  if (f.limitations && f.limitations.length > 0) {
    out.push('**Before acting, note**')
    out.push('')
    out.push(bullets(f.limitations))
    out.push('')
  }

  // ── 6. Claude Code prompt ──
  //
  // Plain fenced blocks rather than a <details> disclosure. The PDF is
  // rendered from this same string through a Markdown subset that does not
  // parse raw HTML, so a disclosure would arrive in the PDF as escaped tag
  // text. Collapsibility is a viewer nicety; one source that renders correctly
  // in both places is worth more.
  out.push('##### Claude Code prompt')
  out.push('')
  if (f.claudeCodePrompts.length === 0) {
    // The heading stays. A finding with no prompt among findings that have one
    // would otherwise look like a finding whose prompt went missing.
    out.push('*No prompt was generated for this finding. It needs a decision or a look at '
      + 'something outside the repository before any change is the right one — follow the '
      + 'steps above instead.*')
    out.push('')
  }
  for (const p of f.claudeCodePrompts) {
    out.push(`**${p.title}**`)
    out.push('')
    out.push('```text')
    out.push(p.prompt)
    out.push('```')
    out.push('')
    out.push(`*Intended outcome: ${p.intendedOutcome}*`)
    out.push('')
  }

  return out.join('\n')
}

function sectionBlock(s: ReportSectionResult): string {
  const out: string[] = []
  out.push(`## ${CATEGORY_LABEL[s.category]}`)
  out.push('')
  out.push(`**Status** ${STATUS_LABEL[s.status] ?? s.status} · `
    + `**Score** ${s.score === null ? 'Insufficient evidence' : `${s.score} / 100`}`)
  out.push('')

  // What the section is, before anything it found. A heading with two findings
  // under it reads as a verdict; the reader needs to know what was looked at
  // before the count means anything — and what was NOT, before a small count
  // reads as reassurance.
  const scope = CATEGORY_SCOPE[s.category]
  if (scope) {
    out.push(`**What this section examines.** ${scope.covers}`)
    out.push('')
    out.push(`**What it does not.** ${scope.excludes}`)
    out.push('')
  }

  // A section with no findings still says something. Silence here is the
  // ambiguity the whole report is built to remove.
  if (s.reason) {
    out.push(`> ${s.reason}`)
    out.push('')
  }
  out.push(s.summary || '*No summary was produced for this section.*')
  out.push('')

  if (s.findings.length === 0) {
    out.push('### Findings')
    out.push('')
    out.push(s.status === 'not_applicable'
      ? '*This section does not apply to this repository. See the note above.*'
      : s.status === 'failed'
        ? '*This section failed and produced no findings. Its absence here is not a clean result.*'
        : '*No findings were produced. That is a statement about this analyser and these files, '
          + 'not a guarantee that nothing is wrong.*')
    out.push('')
  } else {
    out.push('### Findings')
    out.push('')
    s.findings.forEach((f, i) => { out.push(findingBlock(f, i + 1)) })
  }

  out.push('### Limitations')
  out.push('')
  out.push(bullets(s.limitations))
  out.push('')
  return out.join('\n')
}

/**
 * The product, described rather than scored.
 *
 * ── Labelled as read, not measured ───────────────────────────────────────────
 *
 * Everything else in this report comes from a deterministic analyser with a
 * file and a line behind it. This section comes from a model reading a slice of
 * the repository, which is a different kind of claim, and a reader has to be
 * able to tell them apart. So it says which model, which files, and what the
 * model could not work out — and it produces no findings and no score.
 *
 * When there is no description the heading stays and explains why. A report
 * that silently omits the part it could not do looks like a report that did not
 * try.
 */
/** The heading the PDF looks for to place this page first. Exported so the
 *  two files cannot disagree about its wording. */
export const PRODUCT_HEADING = 'What this product is'

function productSection(c: FlowReportRun['comprehension']): string {
  const out: string[] = []
  out.push(`## ${PRODUCT_HEADING}`)
  out.push('')

  if (!c || !c.model) {
    out.push('> This section is read from the repository by a local model rather than measured. '
      + `It is missing from this report. ${c?.reason ?? 'The step did not run.'}`)
    out.push('')
    out.push('Everything below is unaffected: the measurements come from analysers that do not '
      + 'use a model.')
    out.push('')
    return out.join('\n')
  }

  const m = c.model
  out.push(`**${m.whatItIs}**`)
  out.push('')
  // A hosted model is only ever used when external research was turned on, and
  // its name says so (see `comprehend/model.ts`); "on this machine" would then
  // be false, so it is only claimed when it is true.
  const where = /\(hosted\b/.test(c.producedBy ?? '') ? '' : ' running on this machine'
  out.push(`> Read from ${c.filesRead.length} file(s) by \`${c.producedBy}\`${where}`
    + '. This is a description, not a measurement — it produced no findings and no score, '
    + 'and nothing in it was verified. Every finding in this report comes from an analyser with a '
    + 'file behind it.')
  out.push('')

  out.push('| | |')
  out.push('| --- | --- |')
  out.push(`| **Domain** | ${m.domain} |`)
  if (m.architecture) out.push(`| **Built as** | ${m.architecture} |`)
  if (m.entities.length > 0) out.push(`| **What it stores** | ${m.entities.join(', ')} |`)
  if (m.externalServices.length > 0) {
    out.push(`| **Depends on** | ${m.externalServices.join(', ')} |`)
  }
  out.push(`| **Two-sided marketplace** | ${m.isTwoSidedMarketplace ? 'Yes' : 'No'} |`)
  out.push('')

  if (m.actors.length > 0) {
    out.push('### Who uses it')
    out.push('')
    out.push(bullets(m.actors.map((a) => `**${a.name}** — ${a.goal}`)))
    out.push('')
  }

  // ── The end-to-end flow ──
  //
  // Named steps in order, which is the thing a developer opening an unfamiliar
  // repository most wants and the thing a list of findings never gives them.
  if (m.coreFlows.length > 0) {
    out.push('### End to end')
    out.push('')
    for (const f of m.coreFlows) {
      out.push(`**${f.name}**`)
      out.push('')
      out.push(f.steps.length > 0
        ? f.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
        : '*No steps were identified for this flow.*')
      out.push('')
    }
  }

  if (m.unknowns.length > 0) {
    out.push('### What the model could not work out')
    out.push('')
    out.push(bullets(m.unknowns))
    out.push('')
  }

  out.push('*Files read for this description: '
    + `${c.filesRead.map((p) => `\`${p}\``).join(', ')}.*`)
  out.push('')
  return out.join('\n')
}

export interface MarkdownMeta {
  projectName: string
  repositoryDisplayName: string
  analysisMode: string
  generatedAt: string
}

export function renderReportMarkdown(run: FlowReportRun, meta: MarkdownMeta): string {
  const out: string[] = []
  const summary = run.summary
  const sections = [...run.sections].sort(
    (a, b) => REPORT_CATEGORIES.indexOf(a.category) - REPORT_CATEGORIES.indexOf(b.category))

  // ── Cover ──
  out.push(`# ${meta.projectName} — FlowReport`)
  out.push('')
  out.push(`- **Generated** ${meta.generatedAt}`)
  out.push(`- **Analysis mode** ${meta.analysisMode}`)
  out.push(`- **Repository** ${meta.repositoryDisplayName}`)
  out.push(`- **Run status** ${STATUS_LABEL[run.status] ?? run.status}`)
  out.push(`- **FlowReport analysis version** ${run.analysisVersion}`)
  out.push('')
  out.push('> This report is produced by reading files. Nothing in the repository was executed, '
    + 'no dependency was installed, and no request was made to any host.')
  out.push('')
  out.push('---')
  out.push('')

  // ── What this product is ──
  //
  // Before any measurement. A reader who does not already know the project
  // cannot judge a finding about it, and for most of this report's life the
  // first thing it said was a score — a number about a thing it had never
  // described. This section is read rather than measured, and says so, so
  // nobody mistakes a description for evidence.
  out.push(productSection(run.comprehension))
  out.push('---')
  out.push('')

  // ── Contents ──
  //
  // Ahead of the summary rather than after it, because a reader who wants one
  // section should not have to read the summary to find out the section exists.
  // The coverage table further down carries the same ten names with their
  // status and score; this is the shorter thing, and it links.
  out.push('## Contents')
  out.push('')
  out.push('1. [Executive Summary](#executive-summary)')
  out.push('2. [Report Coverage and Limitations](#report-coverage-and-limitations)')
  sections.forEach((s, i) => {
    const label = CATEGORY_LABEL[s.category]
    out.push(`${i + 3}. [${label}](#${anchor(label)})`
      + ` — ${STATUS_LABEL[s.status] ?? s.status}`
      + `, ${s.score === null ? 'insufficient evidence' : `${s.score} / 100`}`
      + `, ${s.findings.length} finding${s.findings.length === 1 ? '' : 's'}`)
  })
  out.push(`${sections.length + 3}. [Appendix](#appendix)`)
  out.push('')
  out.push('---')
  out.push('')

  // ── Executive summary ──
  out.push('## Executive Summary')
  out.push('')
  if (!summary) {
    out.push('*This run did not reach the summary stage, so there is no executive summary. '
      + 'The sections below contain whatever was completed before it stopped.*')
    out.push('')
  } else {
    out.push(summary.narrative)
    out.push('')
    out.push('### Overall Health')
    out.push('')
    out.push(summary.overallScore === null
      ? '**Insufficient evidence for an overall score.**'
      : `**${summary.overallScore} / 100**`)
    out.push('')
    out.push(`*How this score was calculated.* ${summary.scoreExplanation}`)
    out.push('')
    // An exported report that showed an adjusted score without saying it was
    // adjusted would be the same number presented as two different facts. The
    // figure the scan produced travels with it.
    if (summary.resolved) {
      const { count, scoreAsMeasured } = summary.resolved
      out.push(`*${count} finding${count === 1 ? ' has' : 's have'} been marked resolved by hand.* `
        + (scoreAsMeasured === null
          ? 'The scan itself produced no overall score. '
          : `This run measured **${scoreAsMeasured} / 100**. `)
        + 'Marking a finding resolved records that work was done; it is not a measurement, and '
        + 'only a new scan can confirm it.')
      out.push('')
    }
    out.push('| Severity | Count |')
    out.push('| --- | --- |')
    for (const s of ['critical', 'high', 'medium', 'low', 'info'] as Severity[]) {
      out.push(`| ${SEVERITY_LABEL[s]} | ${summary.severityCounts[s]} |`)
    }
    out.push('')
    out.push('### Priority Actions')
    out.push('')
    out.push(bullets(summary.priorities))
    out.push('')
    out.push('### Quick Wins')
    out.push('')
    out.push(bullets(summary.quickWins))
    out.push('')
    out.push('### Longer-term')
    out.push('')
    out.push(bullets(summary.longerTerm))
    out.push('')
  }

  // ── Coverage ──
  out.push('## Report Coverage and Limitations')
  out.push('')
  out.push('| Section | Status | Score | Findings |')
  out.push('| --- | --- | --- | --- |')
  for (const s of sections) {
    const label = CATEGORY_LABEL[s.category]
    out.push(`| [${label}](#${anchor(label)}) | ${STATUS_LABEL[s.status] ?? s.status} `
      + `| ${s.score === null ? '—' : s.score} | ${s.findings.length} |`)
  }
  out.push('')
  out.push('### What could not be verified')
  out.push('')
  out.push(bullets(summary?.couldNotVerify ?? [
    'This run produced no summary, so its limitations were not collected.',
  ]))
  out.push('')

  if (run.warnings.length > 0) {
    out.push('### Warnings')
    out.push('')
    out.push(bullets(run.warnings.map((w) => `**${w.stage}** — ${w.message}`)))
    out.push('')
  }
  if (run.errors.length > 0) {
    out.push('### Errors')
    out.push('')
    out.push(bullets(run.errors.map((e) => `**${e.stage}** — ${e.message}`)))
    out.push('')
  }

  out.push('---')
  out.push('')

  // ── The fifteen sections, always all of them ──
  for (const s of sections) out.push(sectionBlock(s))

  // ── Appendix ──
  out.push('---')
  out.push('')
  out.push('## Appendix')
  out.push('')
  out.push('### Methodology')
  out.push('')
  out.push(bullets([
    'Every file was read inside a boundary anchored to the chosen folder. Paths resolving '
    + 'outside it, including through symlinks, were refused.',
    'Environment files were never opened, so their values could not reach this report.',
    'Nothing was executed: no install, no build, no script, no test.',
    `${summary?.filesScanned ?? 0} files were read; ${summary?.filesSkipped ?? 0} were skipped.`,
    'Findings are ordered by severity and then by confidence. A finding marked "requires '
    + 'manual validation" rests on something static analysis cannot settle.',
  ]))
  out.push('')
  out.push('### Finding index')
  out.push('')
  const all = sections.flatMap((s) => s.findings)
  if (all.length === 0) {
    out.push('*No findings were produced.*')
  } else {
    out.push('| Severity | Confidence | Section | Finding |')
    out.push('| --- | --- | --- | --- |')
    for (const f of all) {
      out.push(`| ${SEVERITY_LABEL[f.severity]} | ${CONFIDENCE_LABEL[f.confidence]} `
        + `| ${CATEGORY_LABEL[f.category]} | ${f.title} |`)
    }
  }
  out.push('')

  const body = out.join('\n')
  const digest = createHash('sha256').update(body).digest('hex').slice(0, 16)
  return `${body}\n*Report content hash (sha256, first 16): ${digest}*\n`
}
