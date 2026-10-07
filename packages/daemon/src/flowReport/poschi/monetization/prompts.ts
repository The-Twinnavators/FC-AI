// daemon/src/integrations/poschi/monetization/prompts.ts
//
// Claude Code prompts for the monetization findings.
//
// ── The one that deliberately has no prompt ──────────────────────────────────
//
// "A monetization surface exists and nothing collects payment" is the most
// important finding in that report and it gets no prompt at all. The obvious
// prompt would be "integrate a payment processor", and that is a decision about
// how the business takes money — which processor, which country, which fee
// structure, whether payment should move into the product at all when today it
// may be a link sent by hand that works perfectly well.
//
// An agent handed that prompt would pick one and wire it in, and the choice
// would have been made by whoever wrote the prompt rather than by anybody who
// owns the outcome. So the next step stays a conversation, and the report says
// which conversation.

import type { MoneyFinding } from './analyse.js'

export function promptFor(f: MoneyFinding): string | null {
  switch (f.id) {
    case 'placeholder-money':
      return [
        'Inventory every placeholder on this application’s money paths.',
        '',
        `Lines flagged: ${f.files.join(' | ')}`,
        '',
        'Do not implement payments. Establish what is real.',
        '',
        '1. For each flagged line, determine what the code actually does today: what is written to',
        '   the database, with what amount and what status, and what a user is told on screen.',
        '2. Find every other path that writes a transaction, a subscription or an amount, and say',
        '   for each whether a payment is involved.',
        '3. Produce a table of path, what it writes, whether money moves, and what a user is told.',
        '4. Change nothing.',
        '',
        'Acceptance: the table accounts for every write to a transaction or subscription record, and',
        'names every place a record is written as completed when nothing was collected.',
      ].join('\n')

    case 'revenue-from-records':
      return [
        'Make the revenue figures in this application say what they are.',
        '',
        `Aggregations found in: ${f.files.join(', ')}`,
        '',
        'These total transaction amounts into a revenue figure while nothing in the codebase collects',
        'payment, so the number is the sum of rows the application wrote rather than money received.',
        'Somebody will eventually plan against it.',
        '',
        '1. Find every place such a figure is rendered to a person.',
        '2. Label each one for what it is — recorded, not settled — in the UI, not only in a comment.',
        '3. Do not change the arithmetic, and do not hide the figure. A number somebody can see and',
        '   understand beats a number that quietly disappeared.',
        '',
        'Acceptance: no screen presents a total as revenue without saying it is unsettled; the',
        'underlying values are unchanged.',
      ].join('\n')

    case 'no-webhook':
      return [
        'Add webhook handling for the payment processor this application uses.',
        '',
        'Payment is taken and nothing listens for what happens afterwards, so a charge that later',
        'fails, is refunded, or is disputed is invisible to the product.',
        '',
        '1. Add an endpoint that verifies the processor’s signature before reading the body.',
        '   An unverified webhook endpoint is a way for anybody to mark an invoice as paid.',
        '2. Handle at least: payment succeeded, payment failed, refund issued, subscription',
        '   cancelled. Make each handler idempotent — processors retry, and a retry must not create',
        '   a second record.',
        '3. Record what happened. Do not change entitlements from the webhook in this change; report',
        '   first, so the state transitions can be reviewed before they are automated.',
        '',
        'Acceptance: a replayed webhook produces exactly one record; an unsigned request is rejected;',
        'every handled event type has a test.',
      ].join('\n')

    // No prompt. See the note at the top of this file: integrating a processor
    // is a business decision, and the inventory is a list rather than a task.
    case 'surface-without-collection':
    case 'surface-inventory':
    case 'collection':
    case 'no-monetization':
    default:
      return null
  }
}

export function withPrompts(findings: MoneyFinding[]): MoneyFinding[] {
  return findings.map((f) => ({ ...f, prompt: promptFor(f) }))
}
