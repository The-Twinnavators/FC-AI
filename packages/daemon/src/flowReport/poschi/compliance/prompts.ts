// daemon/src/integrations/poschi/compliance/prompts.ts
//
// Implementation prompts for the compliance findings.
//
// ── Not every finding gets one, deliberately ─────────────────────────────────
//
// Worker classification is answered by a lawyer looking at how the business
// operates, and handing somebody an implementation prompt for it would suggest
// the question is a coding task. The same is true of anything whose first step
// is "decide", "confirm" or "ask counsel". A prompt on those is how the wrong
// thing gets built quickly and confidently.
//
// So a prompt appears where code is genuinely the answer, and the rest carry a
// next step and nothing more.

import type { ComplianceFinding } from './analyse.js'

const PROMPTS: Record<string, string> = {
  'auto-renewal-disclosure': `Record consent to subscription renewal terms in this application.

Federal law on negative-option billing requires the renewal terms, the price and the
cancellation method to be disclosed before payment, with express informed consent. The
exposure is not usually the disclosure — it is being unable to PROVE it later.

1. Put the terms on the purchase screen itself: what recurs, how much, how often, when the
   first charge lands, and how to stop it. Not behind a link.
2. Require an affirmative action separate from the pay button, and store what was consented
   to: the user, the timestamp, the plan, the price, and a version identifier for the exact
   wording shown.
3. Version the wording so a record can be resolved back to the text that was on screen. A
   consent record pointing at today's copy proves nothing about last year.
4. Send a confirmation after purchase restating the same terms.
5. Make the record queryable by user and date — the moment it is needed, it is needed fast.

Acceptance: no subscription can be created without a stored consent row; the row names a
wording version that still resolves; the confirmation restates the terms; a consent record can
be produced for any subscriber.`,

  'cancel-as-easy': `Make subscription cancellation as simple as subscribing in this application.

The rule is symmetry: something bought in two clicks in an app may not take a phone call to
stop.

1. Count the steps from signed-in to cancelled today, and the steps from signed-in to
   subscribed. Write both numbers in your summary before changing anything.
2. Put cancellation where a person will look — the subscription screen itself — and reachable
   in the same number of steps as signing up.
3. One confirmation is acceptable. A retention offer that must be declined before proceeding
   is the pattern being legislated against; if one exists, it must be skippable in a single
   action.
4. Confirm by email, and state the date access actually ends.
5. Record who cancelled and when.

Acceptance: cancelling takes no more steps than subscribing; no screen in the path requires
declining an offer to continue; the confirmation names the end date; the action is logged.`,

  'can-spam-unsubscribe': `Add a compliant unsubscribe path to the email this application sends.

1. Separate transactional mail from commercial mail in code. A message the user's own action
   asked for and a message promoting something are different categories with different rules,
   and mixing them makes the stricter rule apply to both.
2. Put a working unsubscribe link in every commercial message, honoured without requiring a
   login and without asking why.
3. Include a physical postal address in commercial mail. This is required and is the part
   most often missed.
4. Honour an opt-out immediately in the product, and well inside ten business days in any
   downstream system.
5. Suppress at send time by checking the current preference, not by filtering the list when
   it is built — lists go stale between build and send.

Acceptance: a commercial send to an opted-out address is refused at send time; the unsubscribe
link works signed out; every commercial template carries a postal address; transactional mail
is unaffected by a marketing opt-out.`,

  'tcpa-consent': `Record SMS consent in this application.

TCPA damages are statutory and per message, which makes this the most expensive small mistake
available here.

1. Capture consent for SMS separately from email. A single "notify me" checkbox does not
   carry.
2. Store the number, the timestamp, the exact wording shown, and where it was given.
3. Handle STOP, UNSTOP and HELP, and treat STOP as immediate and permanent until the person
   opts in again.
4. Check consent at send time, per number, and refuse the send rather than filtering later.
5. Keep the consent record for as long as the number could be messaged, and make it
   retrievable per number.

Acceptance: no SMS sends to a number with no consent row; STOP suppresses within seconds and
survives a redeploy; the wording shown at opt-in can be produced for any number; email consent
alone never enables SMS.`,

  'data-rights': `Add self-serve data export and account deletion to this application.

Start from the data model: every category it holds about a person is in scope, and the hard
ones are the categories where a record is about one person but was written by another.

1. Export: produce everything associated with the requester in a portable format — every
   category the data model holds for them, not just their account row.
2. Deletion: delete or irreversibly anonymise, and decide explicitly what happens to records
   that are not solely theirs. A note one user wrote about another belongs to a relationship,
   and a transaction is also a business record with retention duties.
3. Do not delete what you are required to keep. Financial records have their own retention;
   anonymise them instead and say so.
4. Confirm both by email, and record the request, who made it and when it completed.
5. Rate-limit and re-authenticate both. An export endpoint is an exfiltration endpoint if it
   is not.

Acceptance: a user can request both without contacting support; export contains every category
the data model holds for them; deletion leaves no personal identifier outside records with a
stated retention reason; both are logged with timestamps.`,

  'age-gate': `Add an age gate to signup in this application.

1. Collect date of birth at signup, not a checkbox claiming adulthood — a checkbox tells you
   nothing and demonstrates nothing later.
2. Refuse signup below the minimum age stated in the terms, and say which age that is.
3. Store the date, not a derived boolean, so the rule can change without re-asking everybody.
4. Do not collect anything else from somebody who fails the check, and do not keep a record
   beyond what is needed to enforce a retry limit.
5. State the minimum age in the terms and the privacy notice, and keep all three consistent.

Acceptance: signup below the minimum is refused; no account or profile row is created for a
refused attempt; the terms, the notice and the code state the same age.`,

  'access-control': `Add route-level access control to this application.

The router applies no guards today, so every screen depends on a check inside its component.
That may be complete now; nothing makes it complete for the next screen somebody adds.

1. Add a guard at the route layer that requires an authenticated session by default, so a new
   route is private unless it is explicitly made public.
2. Declare the required role per route beside the route itself, so the router is the single
   readable answer to "who can reach this".
3. Keep the existing component checks. Two layers is correct here; removing the inner one
   while adding the outer is a net loss.
4. Enforce the same rule server-side per endpoint. A client-side guard is a usability feature,
   never a security control.
5. Add a test that fails when a route is added without a declared audience.

Acceptance: an unauthenticated request to any non-public route is refused by the router and by
the server; adding a route without an audience fails a test; the public routes are a short,
explicit list.`,

  'terms': `Add versioned terms of service acceptance to this application.

1. Serve the terms inside the product, at a stable path.
2. Record acceptance per user: the version, the timestamp and the method. Acceptance nobody
   can produce later did not happen.
3. Version the document. When the terms change materially, require re-acceptance rather than
   assuming the original covers it.
4. Block the first meaningful action until accepted, not the whole account.
5. Make the acceptance record queryable by user and version.

Acceptance: no user can book without an acceptance row; the row names a version that still
resolves to text; publishing a new material version prompts re-acceptance; acceptance can be
produced for any user.`,
}

/** Attach a prompt where code is the answer, and leave the rest without one. */
export function withCompliancePrompts(findings: ComplianceFinding[]): ComplianceFinding[] {
  return findings.map((f) => ({ ...f, prompt: PROMPTS[f.id] ?? null }))
}
