// daemon/src/flow-reports/analyzers/dualRole.ts
//
// One person, two sides of the product, and one account that cannot hold both.
//
// ── The question this answers ────────────────────────────────────────────────
//
// A two-sided product almost always has a free side and a paid side, and the
// people on the free side are the warmest possible source of paying customers:
// they already use the product, they already trust it, and they converted
// themselves. The path from one to the other is a revenue path.
//
// Most of these products store a single `role` on the account. That is the
// right shape for a content system, where one person is an editor or a viewer
// and never both, and it is the wrong shape here, because it makes the upgrade
// an OVERWRITE. A free account that becomes a paid one stops being a free
// account, and the person loses whatever the free side held. Somebody who wants
// to keep both ends up with two logins, and neither the product nor the
// business can see that the two are the same person.
//
// ── Why it is measured rather than assumed ───────────────────────────────────
//
// Plenty of products are right to give one account one role, so this cannot
// fire on "more than one role exists". It fires on a specific, checkable shape:
// the router gates separate areas for two audiences, the account model stores
// one role rather than a set, and there is either an upgrade that overwrites it
// or no upgrade at all.
//
// Which side is the paid one is read from where the billing screens live, not
// from what the roles are called. A role named `provider` on a product with no
// plan screens is not the paid side of anything.
//
// ── Vocabulary ───────────────────────────────────────────────────────────────
//
// Every role name printed here comes out of the repository's own router. This
// module contains no product's nouns, and the findings it writes must keep it
// that way: a report that explains one product in another product's words is
// the defect this whole layer was built to stop.

import type { DerivedRole } from '../poschi/sitemap/deriveSitemap.js'
import type { PoschiCommonFinding } from './normalize.js'

export interface SourceFile { path: string; text: string }

/** Roles that are not a customer of the product. Internal operators are not a
 *  side of the marketplace, and a person is not expected to hold one of these
 *  and a customer account at the same time. */
const INTERNAL = /^(admin|super[-_]?admin|superuser|staff|employee|internal|operator|owner|root|support|moderator)$/i

/** Not roles at all: the router's answers for "anyone", "nobody in
 *  particular", and "signed in, but this could not say as what". */
const NOT_AN_AUDIENCE = /^(anonymous|unknown|system|signed[-_]?in|public|guest|authenticated)$/i

/** Screens where somebody pays the platform. Deliberately not `invoice` or
 *  `payment`: on a two-sided product those are usually one customer billing
 *  another, which is the product working rather than the platform charging. */
const BILLING_ROUTE = /(^|\/)(plans?|pricing|subscri\w*|checkout|billing|upgrade|trial|plan-selection)(\/|$)/i

/**
 * Where an account model is defined.
 *
 * ── Why the search is scoped ─────────────────────────────────────────────────
 *
 * Searched across a whole repository, every one of the patterns below matches
 * something harmless. `role: 'provider'` is a prop on a component. `role` as a
 * declared field appears in a dozen view models. The word "memberships" appears
 * in prose. Measured against a real repository, the unscoped version pointed at
 * four UI components as the definition of the account model, called a sentence
 * in a business document a multi-role table, and read a JSX prop as a database
 * write — every one of which is the opposite of what it claimed.
 *
 * The account model lives in schema and migration files, and where a project
 * has none it lives in its type declarations. Looking there and nowhere else is
 * what makes a match mean what it says.
 */
const SCHEMA_FILE = /\.(sql|prisma)$|(^|\/)(migrations?|schemas?)(\/|\.)/i

/** Server code that may perform the write, where the schema is not SQL. */
const SERVER_FILE = /(^|\/)(api|server|functions|routes|services|actions|handlers|db)(\/|\.)/i

/**
 * The opening of a table that represents a person, up to anywhere inside it.
 *
 * A `role` or `roles` column means what this module thinks it means only when
 * it sits on the account. Measured against a real repository, the version
 * without this read a `roles text[]` on a push-notification table and on an
 * email-broadcast table as proof that accounts hold several roles — both are
 * lists of who a MESSAGE goes to, and both silently turned the finding off.
 *
 * A create-table body carries no semicolon until it ends, so stopping at one
 * keeps the match inside the table it started in.
 */
const ACCOUNT_TABLE = String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?[\w."]*\b(?:users?|accounts?|profiles?|members?|identities)\b[^;]{0,900}?`

/**
 * An account row that holds ONE role.
 *
 * A bare `check (role in (…))` used to be on this list and had to come off: the
 * same shape describes a revenue split's participant — company, owner, partner
 * — and the role an invitation is issued FOR, neither of which is a statement
 * about what a person's account can be. Both were named as the definition of
 * the account model in a real report. Scoping to the account's own table is
 * what makes the column mean the person.
 *
 * The second pattern is the fallback for a project whose schema lives
 * somewhere else, where a type declaration is the only statement available.
 */
const SCALAR_ROLE = [
  new RegExp(`${ACCOUNT_TABLE}\\brole\\s+(?:text|varchar|character\\s+varying|citext|enum)\\b`, 'i'),
  /\brole\s*:\s*[A-Z]\w*Role\b/,
]

/** The file has to be about accounts for a `role` column in it to be the
 *  account's role. A `role` on a permissions grant is a different thing. */
const ABOUT_ACCOUNTS = /\b(users?|accounts?|profiles?|members?|identities)\b/i

/**
 * An account that can hold SEVERAL roles. Any one of these means the product
 * already has the shape and none of the findings below apply.
 *
 * Each pattern requires a DECLARATION rather than a mention: a table being
 * created, a column being typed, a field being declared. The version that
 * matched the bare word `memberships` found it in a paragraph of prose.
 */
const MULTI_ROLE = [
  /create\s+table[\s\S]{0,120}?\b(?:user|account|profile|member)_roles\b/i,
  /\b(?:user|account|profile|member)_roles\s*\(/i,
  /create\s+table[\s\S]{0,120}?\brole_assignments\b/i,
  new RegExp(`${ACCOUNT_TABLE}\\broles\\s+(?:text|varchar|jsonb|json)\\s*\\[\\]`, 'i'),
  new RegExp(`${ACCOUNT_TABLE}\\broles\\s+(?:jsonb|json)\\b`, 'i'),
  /\broles\s*:\s*(?:string|[A-Z]\w*Role)\s*\[\]/,
  /\b(?:active_role|current_role)\s+(?:text|varchar|uuid|enum)\b/i,
  /\b(?:activeRole|currentRole)\s*\??\s*:\s*\w/,
]

/** A half-built switcher. Narrow on purpose — `switchRole` and `activeRole` are
 *  ordinary names in a working implementation, and flagging them would report
 *  the feature as missing in the products that have it. */
const SWITCHER = /\b(dualRole|dual_role|multiRole|multi_role|roleSwitcher|role_switcher|switchAccount|switch_account)\b/

/** Documentation describing a capability of this kind, so the report can say
 *  whether the gap is an oversight or a decision. */
const DOC_PROMISE = /dual[- ]?role|switch(?:ing)? between (?:roles|accounts)|role switch|both .{0,40}accounts? under one/i

export interface AccountShape {
  /** Customer-facing roles the router gates. */
  audienceRoles: string[]
  /** The side that pays the platform, when exactly one area holds the billing
   *  screens. Null when that could not be established either way. */
  paidRole: string | null
  /** Customer-facing roles with no billing screens of their own. */
  freeRoles: string[]
  billingRoutes: string[]
  /** True when an account carries exactly one role and no structure exists for
   *  holding more. */
  oneRolePerAccount: boolean
  /** True when the account model was read from schema or migrations rather than
   *  from type declarations. A table is a stronger statement than an interface,
   *  and the findings say which one they rest on. */
  modelFromSchema: boolean
  scalarRoleFiles: string[]
  multiRoleFiles: string[]
  /** Files that write the paid role onto an existing account. On a scalar
   *  column every one of these is an overwrite. */
  upgradeWrites: string[]
  /** A switching affordance that appears in exactly one file, so nothing in the
   *  product can reach it. */
  strandedSwitcher: string | null
  /** Documentation that describes the capability. */
  documented: string | null
}

const uniq = (xs: string[]): string[] => [...new Set(xs)]

/** Files whose text matches any of the patterns, capped so evidence stays
 *  readable. */
function filesMatching(files: SourceFile[], patterns: RegExp[], cap = 4): string[] {
  const hits: string[] = []
  for (const f of files) {
    if (patterns.some((p) => p.test(f.text))) hits.push(f.path)
    if (hits.length >= cap) break
  }
  return hits
}

/**
 * The files that define the account model.
 *
 * Schema where there is one. Where there is not — a front end talking to a
 * service it does not contain — the type declarations are the only statement of
 * the shape available, and reading them is better than concluding the product
 * has no accounts. Which of the two was used is reported, because a conclusion
 * drawn from a TypeScript interface is weaker than one drawn from a table.
 */
function accountModelFiles(files: SourceFile[]): { files: SourceFile[]; fromSchema: boolean } {
  const schema = files.filter((f) => SCHEMA_FILE.test(f.path))
  if (schema.length > 0) return { files: schema, fromSchema: true }
  return { files: files.filter((f) => /\.(ts|tsx|js|jsx)$/i.test(f.path)), fromSchema: false }
}

/**
 * Statements that put the paid role onto an account that already exists.
 *
 * An UPDATE, or an SDK update call — not `role: 'provider'` on its own, which
 * is how a component receives a prop and how a fixture describes a test user.
 */
function roleWritePatterns(paid: string): RegExp[] {
  const r = paid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    // `role` has to be an ASSIGNMENT in the SET list, reached either directly
    // or across earlier `column = value,` pairs. Anything looser confuses a
    // write with a read: the version that allowed any text between `set` and
    // `role =` matched `SET search_path TO 'public' … WHERE role = 'provider'`
    // in a read-only counting function, and the prose "set their business up"
    // sitting above a `WHERE p.role = 'provider'` filter. Both were reported as
    // the place a person is upgraded.
    new RegExp(`\\bset\\s+(?:[\\w".]+\\s*=\\s*[^;,]{1,80},\\s*)*role\\s*=\\s*'${r}'`, 'i'),
    new RegExp(`\\.update\\(\\s*\\{[^}]{0,200}?\\brole\\s*:\\s*['"\`]${r}['"\`]`, 'i'),
  ]
}

export function readAccountShape(
  files: SourceFile[],
  roles: Record<string, DerivedRole>,
): AccountShape {
  const routesByRole = new Map<string, string[]>()
  for (const [route, r] of Object.entries(roles)) {
    if (NOT_AN_AUDIENCE.test(r.role) || INTERNAL.test(r.role)) continue
    if (!routesByRole.has(r.role)) routesByRole.set(r.role, [])
    routesByRole.get(r.role)!.push(route)
  }

  const audienceRoles = [...routesByRole.keys()].sort()

  const billingRoutes: string[] = []
  const paying: string[] = []
  for (const [role, routes] of routesByRole) {
    const billing = routes.filter((r) => BILLING_ROUTE.test(r))
    if (billing.length === 0) continue
    paying.push(role)
    billingRoutes.push(...billing)
  }
  // One paying side, or none. Where two areas both hold plan screens the
  // free/paid split is not what this thinks it is, and saying so would be a
  // guess dressed as a measurement.
  const paidRole = paying.length === 1 ? paying[0]! : null
  const freeRoles = audienceRoles.filter((r) => r !== paidRole)

  const model = accountModelFiles(files)
  // A `role` column counts only in a file that is about accounts. Postgres
  // grants, CI definitions and IAM policies all declare roles of a different
  // kind, and a migration full of `grant ... to authenticated` is not a
  // statement about what a person's account can be.
  const aboutAccounts = model.files.filter((f) => ABOUT_ACCOUNTS.test(f.text))
  const scalarRoleFiles = filesMatching(aboutAccounts, SCALAR_ROLE)
  const multiRoleFiles = filesMatching(model.files, MULTI_ROLE)

  const upgradeWrites = paidRole
    ? filesMatching(
      files.filter((f) => SCHEMA_FILE.test(f.path) || SERVER_FILE.test(f.path)),
      roleWritePatterns(paidRole),
    )
    : []

  const switcherFiles = files.filter((f) => SWITCHER.test(f.text)).map((f) => f.path)
  // One file and no other reference: the affordance exists and nothing can
  // reach it. Two or more means something passes it, which is a wired feature.
  const strandedSwitcher = switcherFiles.length === 1 ? switcherFiles[0]! : null

  const documented = files.find((f) =>
    /\.mdx?$/i.test(f.path) && DOC_PROMISE.test(f.text))?.path ?? null

  return {
    audienceRoles,
    paidRole,
    freeRoles,
    billingRoutes: uniq(billingRoutes).slice(0, 4),
    oneRolePerAccount: scalarRoleFiles.length > 0 && multiRoleFiles.length === 0,
    modelFromSchema: model.fromSchema,
    scalarRoleFiles,
    multiRoleFiles,
    upgradeWrites,
    strandedSwitcher,
    documented,
  }
}

/** The shared closing paragraph: what a merged account is, and what the toggle
 *  between the two sides has to do. Written once because both findings end in
 *  the same place, and a reader who meets either should get the whole target. */
function theTarget(free: string, paid: string): string {
  return `The shape that solves it is one account holding a SET of roles rather than a `
    + `single value, with a stored "acting as" that decides which side of the product the `
    + `person is currently looking at. Becoming a ${paid} then ADDS ${paid} to an account `
    + `that stays a ${free}, so nothing is lost on the way through, and the switch between `
    + `the two is a change of view rather than a change of login: same session, no password, `
    + `no second email address, one place in the navigation to move between them.`
}

/**
 * The findings, at most one of which fires.
 *
 * They are three readings of the same defect, separated by how much the
 * repository was able to say: an upgrade that overwrites, no upgrade at all, or
 * two audiences with no pricing split this could identify.
 */
export function dualRoleFindings(shape: AccountShape): PoschiCommonFinding[] {
  // Either the account model already holds several roles, or nothing here
  // established that it holds one. Both are reasons to say nothing.
  if (!shape.oneRolePerAccount) return []
  if (shape.audienceRoles.length < 2) return []

  const where = uniq([...shape.scalarRoleFiles, ...shape.upgradeWrites]).slice(0, 5)
  const switcherNote = shape.strandedSwitcher
    ? ` A switching control already exists in ${shape.strandedSwitcher}, and that file is the `
      + 'only one in the repository that mentions it — nothing passes it anything, so no screen '
      + 'in the product can reach it.'
    : ''
  const docNote = shape.documented
    ? ` ${shape.documented} describes this capability as part of the product, which makes the `
      + 'gap an unfinished intention rather than a decision not to build it.'
    : ''

  if (shape.paidRole && shape.freeRoles.length > 0) {
    const paid = shape.paidRole
    const free = shape.freeRoles[0]!
    const billing = shape.billingRoutes.length > 0
      ? ` The plan and checkout screens sit under ${shape.billingRoutes.slice(0, 2).join(' and ')}, `
        + `which is what identifies ${paid} as the side that pays.`
      : ''

    if (shape.upgradeWrites.length > 0) {
      return [{
        id: 'DUAL-001',
        area: 'Becoming a customer',
        title: `Upgrading a ${free} into a ${paid} replaces the account instead of adding to it`,
        severity: 'medium',
        confidence: 'verified',
        detail:
          `An account stores one role, and the upgrade writes the new one over the old one. So a `
          + `${free} who becomes a ${paid} stops being a ${free} at that moment: whatever the `
          + `${free} side of the product held for them is behind a door their account can no `
          + `longer open, and there is no way back.${billing} `
          + `Anyone who genuinely needs both — and on a product with two sides that is a normal `
          + `person, not an edge case — has to sign up a second time with a second email address. `
          + `That costs the business three things at once. The person maintains two logins and two `
          + `histories for one relationship. Support cannot see that the two accounts are the same `
          + `human being. And the conversion itself becomes invisible: the most valuable number `
          + `here is how many free ${free} accounts become paying ${paid} accounts, and once the `
          + `upgrade is an overwrite and the alternative is a fresh signup, nothing in the data `
          + `connects the paying account to the free one it came from.${switcherNote}${docNote}`,
        files: where,
        because:
          `Read from the schema and the code together: the role is stored as a single value, and `
          + `${shape.upgradeWrites.length} place(s) assign '${paid}' to an existing account. A `
          + `single-valued field cannot hold the previous role once the new one is written, so the `
          + `loss follows from the shape rather than from any particular line.`,
        next:
          `Decide first whether one person holding both sides is something the product wants. If it `
          + `is, this is a data-model change rather than a screen. ${theTarget(free, paid)} `
          + `If it is not wanted, the upgrade should at least say plainly what the person is about `
          + `to lose, and keep their ${free} records readable afterwards.`,
        isAbsence: false,
        prompt: [
          `Let one account hold both the ${free} and the ${paid} side of this product, so that`,
          `upgrading adds a capability rather than replacing one.`,
          '',
          'Today the account carries a single role value. Writing the new role over the old one is',
          `what makes the upgrade destructive, and it is why somebody who needs both ends up with`,
          'two separate accounts.',
          '',
          '1. Replace the single role with a set of roles per account. Keep a separate "acting as"',
          '   value for the side the person is currently viewing, defaulting to the one they last',
          '   used. Migrate every existing account to a set holding exactly the role it has now, so',
          '   nobody changes what they can reach on the day this ships.',
          '2. Change the route guards from "is this THE role" to "does this account hold this role",',
          `   and let the redirect for a mismatch send somebody to the side they are acting as`,
          '   rather than to a fixed destination.',
          `3. Turn the upgrade into an addition: grant ${paid} without removing ${free}, and leave`,
          '   any setup flag that belongs to the new side scoped to that side, so completing it',
          `   cannot strand the person on the ${free} side of the product.`,
          '4. Add one control in the account menu that switches the acting-as value. It must not',
          '   sign the person out, ask for a password, or lose what they were doing.',
          '5. Record which account the upgrade came from, so free-to-paid conversion can be counted.',
          '',
          'Do not build a way to merge two EXISTING accounts as part of this. Which identity',
          'survives, and what happens to the records belonging to the other one, is a product',
          'decision that needs an owner rather than a default.',
          '',
          `Acceptance: one account can hold ${free} and ${paid} together; switching between them`,
          'keeps the session; an account that held one role before still reaches exactly what it',
          'reached before; the upgrade leaves earlier records readable.',
        ].join('\n'),
      }]
    }

    return [{
      id: 'DUAL-002',
      area: 'Becoming a customer',
      title: `Nothing in the product turns a ${free} into a paying ${paid}`,
      severity: 'medium',
      confidence: 'indicated',
      detail:
        `An account stores one role, and nothing was found that changes it. A ${free} who decides `
        + `they want the ${paid} side cannot get there from inside the product — the only route is `
        + `to sign up again as somebody else.${billing} `
        + `That is the warmest audience the business has, asked to start from nothing: a new email `
        + `address, a new account, and none of the history that persuaded them. It also means the `
        + `number of ${free} accounts that became paying ${paid} accounts cannot be counted, `
        + `because in the data they are unrelated strangers.${switcherNote}${docNote}`,
      files: where,
      because:
        'An absence. The role is stored as a single value, and nothing in the files that were read '
        + `assigns '${paid}' to an account that already exists. A flow this did not recognise — one `
        + 'that runs outside the repository, or is done by hand — would not appear here.',
      next:
        `Confirm how somebody becomes a ${paid} today; if the answer is "an administrator does it", `
        + `that is a cost and a delay on the one journey that brings in revenue. ${theTarget(free, paid)}`,
      isAbsence: true,
      prompt: null,
    }]
  }

  const [a, b] = shape.audienceRoles
  return [{
    id: 'DUAL-003',
    area: 'Accounts',
    title: 'One person cannot be on both sides of the product',
    severity: 'low',
    confidence: 'indicated',
    detail:
      `The product gates separate areas for ${shape.audienceRoles.join(' and ')}, and an account `
      + `holds one role. Anybody who is both — on a two-sided product, a normal person rather than `
      + `an edge case — needs two accounts with two email addresses, and nothing connects them.`
      + `${switcherNote}${docNote}`,
    files: where,
    because:
      'Read from the router and the account schema: more than one audience is gated, the role is '
      + 'stored as a single value, and no table or column was found that lets an account hold '
      + 'several. No billing screens were traced to one side in particular, so this says nothing '
      + 'about which side pays.',
    next:
      `Decide whether one person holding both is wanted. ${theTarget(a!, b!)}`,
    isAbsence: true,
    prompt: null,
  }]
}
