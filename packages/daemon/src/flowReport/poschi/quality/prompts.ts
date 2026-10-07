// daemon/src/integrations/poschi/quality/prompts.ts
//
// Claude Code prompts for the engineering findings.
//
// ── Not every finding gets one ───────────────────────────────────────────────
//
// A prompt is handed over where code is the right response. Where the next step
// is to read something, decide something, or rotate a credential, there is no
// prompt — handing somebody an implementation prompt for a question they have
// not answered is how the wrong thing gets built quickly, and it is worse here
// than in the product report because these prompts touch security-sensitive
// code.
//
// ── They are written to be run against a STALE checkout ──────────────────────
//
// This analysis reads a folder that is behind the deployed product, so every
// prompt for an absence opens by telling the agent to confirm the absence in
// the current code first. A prompt that says "add an error boundary" to a
// codebase that already has one produces a second one, and two boundaries
// swallow each other's errors.

import type { QualityFinding } from './analyse.js'

const CONFIRM_FIRST = [
  'This was derived from a checkout that is known to be behind the deployed product.',
  'Before changing anything, confirm the absence still holds in the current code.',
  'If it is already there, stop and say so rather than adding a second one.',
  '',
].join('\n')

/**
 * The prompt for a finding, or null.
 *
 * Keyed by id rather than generated from the text: a prompt assembled from a
 * finding's own words reads like a summary, and what an engineer needs is the
 * context, the constraint and the acceptance test.
 */
export function promptFor(f: QualityFinding): string | null {
  switch (f.id) {
    case 'no-tests':
      return [
        CONFIRM_FIRST,
        'Add the first automated tests to this project.',
        '',
        'There is no test runner and no test file. Do not aim for coverage — aim for being able to',
        'change the two flows whose breakage would be worst without opening the app to find out.',
        '',
        '1. Add a test runner appropriate to the build (Vitest suits a Vite project) and a `test`',
        '   script. No CI yet: a green tick with nothing behind it is worse than none.',
        '2. Write tests for exactly two flows, chosen by what failing would cost:',
        '   - the flow that gets somebody in, through to the point they have an account;',
        '   - the flow that completes the thing the product exists to do, through to the',
        '     point the result is recorded.',
        '3. Test behaviour through the public surface of each module. Do not assert on internals,',
        '   or the tests break on every refactor and get deleted.',
        '',
        'Acceptance: `npm test` runs and passes from a clean checkout; each test fails if the flow',
        'it covers is broken deliberately; no test needs a live backend to run.',
        '',
        'Do not deploy, and do not merge into a protected branch.',
      ].join('\n')

    case 'no-ci':
      return [
        CONFIRM_FIRST,
        'Add continuous integration to this repository.',
        '',
        'Add a workflow that runs on every push and every pull request: install, typecheck, build,',
        'and run the test suite if one exists.',
        '',
        'Keep it to one job and one file. Do not add deployment, caching strategies or matrix builds',
        'in this change — a CI config nobody understands is one nobody fixes when it goes red.',
        '',
        'Acceptance: the workflow runs on a pull request and fails when a type error or a failing',
        'test is introduced.',
      ].join('\n')

    case 'no-error-capture':
      return [
        CONFIRM_FIRST,
        'Add a global error boundary to this React application.',
        '',
        'An uncaught render error currently unmounts the tree, so a person sees a blank page and',
        'nothing records that it happened.',
        '',
        '1. Add one error boundary wrapping the whole route tree, not one branch of it.',
        '2. Render something a person can act on: what failed in plain words, and a way back to a',
        '   working screen. Not a stack trace.',
        '3. Report the error to the existing backend. Record the message, the component stack and the',
        '   route PATTERN — never the resolved path, and never anything a person typed.',
        '',
        'Acceptance: a deliberately thrown render error shows the fallback instead of a blank page,',
        'and produces exactly one recorded error carrying no personal data.',
      ].join('\n')

    case 'html-injection-surface':
      return [
        'Audit the places this application writes HTML directly or evaluates strings.',
        '',
        `Sites found: ${f.files.join(', ')}`,
        '',
        'For each one, answer a single question: can text a user supplied reach it?',
        '',
        '1. Trace the value backwards to where it originates — a literal, a translation file, a',
        '   database column, a query parameter, a form field.',
        '2. Produce a table of site, origin of the value, and whether a user can influence it.',
        '3. Change nothing in this pass. Report first.',
        '',
        'Acceptance: every site is accounted for, and any site reachable by user-supplied text is',
        'listed separately at the top with the path the value takes to get there.',
      ].join('\n')

    case 'possible-secrets':
      return [
        'Audit the credential-shaped strings in this repository.',
        '',
        `Files flagged: ${f.files.join(', ')}`,
        '',
        '1. For each, determine whether the value is a real credential, a placeholder, a test fixture,',
        '   or a role NAME being compared against rather than a key.',
        '2. Report what each one is. Do not print any real value in your output, and do not commit',
        '   one anywhere.',
        '3. Change nothing in this pass.',
        '',
        'If any is a real credential, say so at the top of your report and stop — rotating it is a',
        'human decision and has to happen before any code change, because a key in source is a key in',
        'every clone and every backup of this repository.',
        '',
        'Acceptance: every flagged file has a verdict, and the report names no secret values.',
      ].join('\n')

    // Deliberately none. A line count is not a defect, and a dependency
    // manifest cannot say whether a package is outdated — that needs the
    // registry, which is a command to run rather than code to write.
    case 'size-outliers':
    case 'dependencies':
    case 'tests':
    case 'error-capture':
    default:
      return null
  }
}

/** Attach prompts to a set of findings. */
export function withPrompts(findings: QualityFinding[]): QualityFinding[] {
  return findings.map((f) => ({ ...f, prompt: promptFor(f) }))
}
