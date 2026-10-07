// Turning a recommendation into something somebody can build.
//
// The shape will change. What must not is that a brief is recognisably about
// the finding it sits under, never claims to know what the code already does,
// and is discarded whole rather than printed half-written — a document that
// stops mid-thought is worse than the one-line recommendation it replaced.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { briefFor } from '../../../src/flowReport/comprehend/brief.js'
import type { Finding } from '../../../src/flowReport/types.js'

const chatJson = vi.hoisted(() => vi.fn())
vi.mock('../../../src/flowReport/comprehend/model.js', () => ({
  DEFAULT_MODEL: 'test',
  modelStatus: async () => ({ available: true, models: ['test'] }),
  chooseModel: () => 'test',
  chatJson,
}))

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 'data-rights',
  category: 'compliance',
  title: 'No self-serve data export or account deletion appears in the code',
  summary: 'Nothing lets a person download their data or delete their account.',
  severity: 'medium',
  confidence: 'medium',
  status: 'open',
  impact: 'Deletion requests arrive by email and are handled by hand.',
  recommendation: 'Decide who receives a deletion request today.',
  rationale: 'ra',
  evidence: [],
  claudeCodePrompts: [],
  requiresManualValidation: true,
  ...over,
})

/** The first call: what should happen, and whether anybody sees it. */
const good = {
  intent: 'When a person asks to delete their account, send a confirmation email to the '
    + 'address on the account. It is both a record of the request and a security alert if '
    + 'nobody authorised it.',
  requirements: [
    'The action taken: account disabled, or deletion requested',
    'The exact timestamp and time zone',
    'A recovery path if the account holder did not start it',
  ],
  considerations: [
    'Use a one-time, time-limited link rather than restoring from an email click',
    'Do not include account data beyond the address and the action',
  ],
  userFacing: true,
}

/** The second call: the steps a person moves through. */
const flowReply = {
  title: 'Account recovery flow',
  steps: ['Send a time-limited recovery link', 'Require a password reset', 'Revoke other sessions'],
  cta: 'Secure and restore my account',
}

/** The third call: the words they read. */
const copyReply = {
  moment: 'Immediately after they ask for their account to be deleted.',
  title: 'Confirmation email',
  lines: ['Subject: Your account has been disabled', 'Hi [First Name],'],
}

/** All three, in order. Flow and copy are asked for separately because a 7B
 *  model given two output shapes at once returns the first and drops the
 *  second — which is how `copy` went missing from every brief. */
const both = (first: unknown = good, flow: unknown = flowReply, copy: unknown = copyReply) => {
  chatJson.mockResolvedValueOnce(first).mockResolvedValueOnce(flow).mockResolvedValueOnce(copy)
}

const PRODUCT = { whatItIs: 'A booking product.', domain: 'services', actors: [] } as never

beforeEach(() => { chatJson.mockReset() })

describe('the shape a reader can build from', () => {
  it('keeps the parts the model filled in', async () => {
    both()
    const b = (await briefFor(finding(), PRODUCT))!
    expect(b.intent).toMatch(/^When a person asks to delete/)
    expect(b.requirements).toHaveLength(3)
    expect(b.flow?.cta).toBe('Secure and restore my account')
    expect(b.copy?.lines[1]).toBe('Hi [First Name],')
    expect(b.copy?.moment).toMatch(/^Immediately after/)
    expect(b.considerations).toHaveLength(2)
  })

  // ── Two calls, because five fields in one generation is too big a job ──
  //
  // Asked for everything at once, a 7B model answered the three required
  // fields and dropped flow and copy on every finding — including an
  // account-deletion notification that plainly needs both.
  it('asks for the words and the journey separately', async () => {
    both()
    await briefFor(finding(), PRODUCT)
    expect(chatJson).toHaveBeenCalledTimes(3)
    expect(chatJson.mock.calls[1]![0][0].content).toMatch(/steps a CUSTOMER moves through/)
    expect(chatJson.mock.calls[2]![0][0].content).toMatch(/ONE PERSON receives/)
    // Both are told what the change is for, so the words match the intent.
    expect(chatJson.mock.calls[2]![0][1].content).toContain('confirmation email')
  })

  // ── Decided here, not by the model ──
  //
  // A missing index on a foreign key is not something anybody using the product
  // encounters. Asked as a fourth field whether a person sees a change, the
  // model answered differently between runs of the SAME finding — the
  // account-deletion brief had a flow on one run and neither flow nor copy on
  // the next. The category already knows, and it does not change its mind.
  it('does not ask about the surface for a finding about internals', async () => {
    chatJson.mockResolvedValueOnce(good)
    const b = (await briefFor(
      finding({ category: 'data_architecture', title: '24 foreign keys have no index' }),
      PRODUCT))!
    expect(chatJson).toHaveBeenCalledTimes(1)
    expect(b.flow).toBeUndefined()
    expect(b.copy).toBeUndefined()
    expect(b.requirements.length).toBeGreaterThan(0)
  })

  it('asks about the surface for a finding about behaviour somebody meets', async () => {
    both()
    await briefFor(finding({ category: 'compliance' }), PRODUCT)
    expect(chatJson).toHaveBeenCalledTimes(3)
  })

  it('drops a flow of one step, which is not a flow', async () => {
    both(good, { title: 'A flow', steps: ['Do it'] })
    expect((await briefFor(finding(), PRODUCT))!.flow).toBeUndefined()
  })

  // The brief is worth printing without them; a half-written one is not.
  it('keeps the brief when the later calls fail entirely', async () => {
    both(good, null, null)
    const b = (await briefFor(finding(), PRODUCT))!
    expect(b.intent).toBeTruthy()
    expect(b.flow).toBeUndefined()
  })
})

describe('what it is not allowed to say', () => {
  // It has read a finding and a product description. It has read no code.
  it('refuses a brief that claims to know what the product already does', async () => {
    chatJson.mockResolvedValueOnce({
      ...good,
      intent: 'The product already sends a confirmation email when an account is deleted, so '
        + 'the remaining work is to add a recovery link to it.',
    })
    expect(await briefFor(finding(), PRODUCT)).toBeNull()
  })

  it('refuses a brief that names nothing from the finding', async () => {
    chatJson.mockResolvedValueOnce({
      ...good,
      intent: 'Improve the overall robustness of the system and follow industry best practice.',
      requirements: ['Write good code', 'Add tests'],
      considerations: ['Consider performance'],
    })
    expect(await briefFor(finding(), PRODUCT)).toBeNull()
  })
})

describe('discarded whole, never printed half-written', () => {
  it('returns nothing when the requirements are missing', async () => {
    chatJson.mockResolvedValueOnce({ ...good, requirements: [] })
    expect(await briefFor(finding(), PRODUCT)).toBeNull()
  })

  it('returns nothing when there is no intent', async () => {
    chatJson.mockResolvedValueOnce({ ...good, intent: '   ' })
    expect(await briefFor(finding(), PRODUCT)).toBeNull()
  })

  it('returns nothing when the model could not be reached', async () => {
    chatJson.mockResolvedValueOnce(null)
    expect(await briefFor(finding(), PRODUCT)).toBeNull()
  })

  it('says why it skipped, so a run can report the rate', async () => {
    const reasons: string[] = []
    chatJson.mockResolvedValueOnce({ ...good, requirements: [] })
    await briefFor(finding(), PRODUCT, { onSkip: (r) => reasons.push(r) })
    expect(reasons).toEqual(['incomplete'])
  })
})

describe('what the model is told', () => {
  it('passes on whether the finding reports something missing', async () => {
    both()
    await briefFor(finding(), PRODUCT)
    const sent = JSON.parse(chatJson.mock.calls[0]![0][1].content)
    expect(sent.finding.reportsSomethingMissing).toBe(true)
  })

  it('works without a product description', async () => {
    both()
    expect(await briefFor(finding(), null)).not.toBeNull()
  })
})

describe('the copy is a message, not a release note', () => {
  // ── The pull towards a newsletter ──
  //
  // The finding and the intent both describe building something, so the model
  // writes the email telling customers it was built. Three prompt revisions
  // reduced that and did not remove it, and "We've made some important updates
  // to your account settings" printed under the heading of a confirmation
  // email is worse than no copy at all.
  const announcement = (first: string) => ({
    moment: 'When the feature ships.',
    title: 'Announcement email',
    lines: [first, 'Contact us at [Support Email].'],
  })

  for (const opening of [
    'We are excited to announce self-serve account deletion.',
    "We've made some important updates to your account settings.",
    'You can now export your data and delete your account.',
    'As part of our commitment to privacy, we have added new controls.',
  ]) {
    it(`throws away copy opening "${opening.slice(0, 32)}…"`, async () => {
      both(good, flowReply, announcement(opening))
      const b = (await briefFor(finding(), PRODUCT))!
      expect(b.copy).toBeUndefined()
      // The rest of the brief is unaffected — only the words are dropped.
      expect(b.intent).toBeTruthy()
      expect(b.flow).toBeDefined()
    })
  }

  it('keeps copy that addresses the person it happened to', async () => {
    both(good, flowReply, {
      moment: 'Immediately after they request deletion.',
      title: 'Confirmation email',
      lines: [
        'Subject: Your account is scheduled for deletion',
        'Hi [First Name],',
        'Your account was scheduled for deletion on [Date] at [Time] [Time Zone].',
      ],
    })
    expect((await briefFor(finding(), PRODUCT))!.copy?.lines).toHaveLength(3)
  })
})

describe('work nobody using the product ever sees', () => {
  const inScripts = (paths: string[]) => finding({
    category: 'error_log',
    title: 'Catch blocks that discard the error they caught',
    evidence: paths.map((path) => ({ kind: 'file' as const, path, description: 'd' })),
  })

  // ── The category alone was too coarse ──
  //
  // `error_log` holds both "a component throws and the person sees a blank
  // page" and "catch blocks in build scripts swallow errors". Told the second
  // was user-facing, the model wrote a customer an email opening "We've noticed
  // that an unexpected issue occurred in your account" and explaining that
  // "we're updating our codebase" — a release note about a deploy script, sent
  // to somebody booking an appointment.
  it('asks for no words when every cited file is a build script', async () => {
    chatJson.mockResolvedValueOnce(good)
    const b = (await briefFor(inScripts([
      'scripts/android-prune-assets.mjs',
      'scripts/check-deploy-target.mjs',
      'tools/mint-credential.ts',
    ]), PRODUCT))!
    expect(chatJson).toHaveBeenCalledTimes(1)
    expect(b.copy).toBeUndefined()
  })

  it('still asks when one of the cited files ships to people', async () => {
    both()
    await briefFor(inScripts(['scripts/build.mjs', 'src/pages/Booking.tsx']), PRODUCT)
    expect(chatJson).toHaveBeenCalledTimes(3)
  })

  // No paths is no evidence either way, and the wrong call there costs two
  // calls rather than a page of invention.
  it('still asks when the finding cites nothing at all', async () => {
    both()
    await briefFor(finding({ evidence: [] }), PRODUCT)
    expect(chatJson).toHaveBeenCalledTimes(3)
  })

  it('throws away copy that tells a customer about the source code', async () => {
    both(good, flowReply, {
      moment: 'After an error is caught.',
      title: 'Notice',
      lines: [
        'Dear [First Name],',
        "To serve you better, we're updating our codebase to handle errors more effectively.",
      ],
    })
    expect((await briefFor(finding(), PRODUCT))!.copy).toBeUndefined()
  })
})

describe('a flow is a journey, not a sprint board', () => {
  // ── What the model returned for the catch-block finding ──
  //
  // Told to describe what a CUSTOMER moves through, it returned the work — and
  // put "Save Changes" on the button at the end of it. Every step opens with a
  // verb an engineer uses about code, and none is something anybody booking an
  // appointment does.
  it('throws away steps that are engineering tasks', async () => {
    both(good, {
      title: 'Update Error Handling in Codebase',
      steps: [
        'Review catch blocks throughout the application.',
        'Determine if errors should be handled by the user or logged.',
        'Add appropriate error handling logic and comments as needed.',
        'Test changes to ensure no critical issues arise.',
      ],
      cta: 'Save Changes',
    })
    const b = (await briefFor(finding(), PRODUCT))!
    expect(b.flow).toBeUndefined()
    // The rest of the brief is unaffected — only the journey is dropped.
    expect(b.requirements.length).toBeGreaterThan(0)
  })

  it('throws one away by its title alone', async () => {
    both(good, {
      title: 'Codebase migration plan',
      steps: ['Open the settings page.', 'Confirm the change.'],
      cta: 'Confirm',
    })
    expect((await briefFor(finding(), PRODUCT))!.flow).toBeUndefined()
  })

  it('keeps a journey somebody using the product actually walks', async () => {
    both(good, {
      title: 'Requesting account deletion',
      steps: [
        'Open Settings and choose Delete account.',
        'Confirm the request.',
        'Receive a confirmation email with a link to stop it.',
        'Verify your email if you did not start this.',
      ],
      cta: 'Delete my account',
    })
    const b = (await briefFor(finding(), PRODUCT))!
    expect(b.flow?.cta).toBe('Delete my account')
    // One engineering-sounding step among four does not make it a task list.
    expect(b.flow?.steps).toHaveLength(4)
  })
})
