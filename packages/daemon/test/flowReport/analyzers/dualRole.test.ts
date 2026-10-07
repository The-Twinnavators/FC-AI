// One account, two sides of a product.
//
// Every case here is a shape that was measured against a real repository and
// got the wrong answer before the code under test looked the way it does. The
// assertions are written against those specific confusions rather than against
// the happy path, because the happy path never broke.

import { describe, it, expect } from 'vitest'
import { readAccountShape, dualRoleFindings } from '../../../src/flowReport/analyzers/dualRole.js'
import type { DerivedRole } from '../../../src/flowReport/poschi/sitemap/deriveSitemap.js'

const role = (r: string): DerivedRole => ({ role: r, basis: 'prop', because: 'a guard allows ' + r })

/** A two-sided product: a free side, a paid side with the plan screens, and an
 *  account row that holds one role. */
const ROLES: Record<string, DerivedRole> = {
  '/': role('anonymous'),
  '/client': role('client'),
  '/client/orders': role('client'),
  '/seller': role('seller'),
  '/seller/plan-selection': role('seller'),
  '/seller/checkout': role('seller'),
  '/admin': role('admin'),
}

const SCHEMA = {
  path: 'db/migrations/001_core.sql',
  text: `create table public.profiles (
    id uuid primary key references auth.users(id),
    email text not null,
    role text not null default 'client' check (role in ('client','seller','admin'))
  );`,
}

const UPGRADE = {
  path: 'db/migrations/044_become_seller.sql',
  text: `create function claim_seller() returns text as $$
    begin
      UPDATE public.profiles
         SET role = 'seller', onboarding_completed = false
       WHERE id = auth.uid() AND role = 'client';
    end; $$;`,
}

const files = (...extra: Array<{ path: string; text: string }>) => [SCHEMA, UPGRADE, ...extra]

describe('reading the account shape', () => {
  it('names the paid side from where the plan screens live, not from the role name', () => {
    const shape = readAccountShape(files(), ROLES)
    expect(shape.paidRole).toBe('seller')
    expect(shape.freeRoles).toEqual(['client'])
    expect(shape.billingRoutes).toContain('/seller/plan-selection')
  })

  it('leaves internal roles out of the audience', () => {
    const shape = readAccountShape(files(), ROLES)
    // An operator is not a side of the marketplace, and nobody is expected to
    // hold an admin account and a customer account as the same person.
    expect(shape.audienceRoles).toEqual(['client', 'seller'])
  })

  it('finds the statement that overwrites the role', () => {
    expect(readAccountShape(files(), ROLES).upgradeWrites)
      .toEqual(['db/migrations/044_become_seller.sql'])
  })

  // The defect that named four read-only analytics functions as the place a
  // person is upgraded. `WHERE role = 'seller'` is a filter; only an assignment
  // in a SET list is a write.
  it('does not read a WHERE filter as an upgrade', () => {
    const readOnly = {
      path: 'db/migrations/060_counts.sql',
      text: `create function count_sellers() returns int
        SET search_path TO 'public' STABLE AS $fn$
        SELECT count(*)::int FROM public.profiles WHERE role = 'seller' $fn$;`,
    }
    const shape = readAccountShape([SCHEMA, readOnly], ROLES)
    expect(shape.upgradeWrites).toEqual([])
  })

  it('still finds the write when other columns are assigned first', () => {
    const other = {
      path: 'db/migrations/070_upgrade.sql',
      text: "UPDATE profiles SET updated_at = now(), role = 'seller' WHERE id = $1;",
    }
    expect(readAccountShape([SCHEMA, other], ROLES).upgradeWrites)
      .toEqual(['db/migrations/070_upgrade.sql'])
  })

  // `roles text[]` on a push-notification table says who a MESSAGE reaches. Read
  // as the account's roles, it turned the whole finding off on a product that
  // plainly has the defect.
  it('does not read a roles column on another table as the account holding many', () => {
    const broadcast = {
      path: 'db/migrations/090_broadcasts.sql',
      text: `create table public.email_broadcasts (
        id uuid primary key,
        target_roles text[] not null default '{}'
      );`,
    }
    const shape = readAccountShape([SCHEMA, UPGRADE, broadcast], ROLES)
    expect(shape.multiRoleFiles).toEqual([])
    expect(shape.oneRolePerAccount).toBe(true)
  })

  it('says nothing is wrong when the account really does hold several roles', () => {
    const many = {
      path: 'db/migrations/002_roles.sql',
      text: `create table public.user_roles (
        user_id uuid references auth.users(id),
        role text not null
      );`,
    }
    const shape = readAccountShape([SCHEMA, UPGRADE, many], ROLES)
    expect(shape.oneRolePerAccount).toBe(false)
    expect(dualRoleFindings(shape)).toEqual([])
  })

  it('treats an acting-as field as the product already having the shape', () => {
    const acting = { path: 'src/session.ts', text: 'interface Session { activeRole: Role }' }
    // No schema in this project, so the type declarations are the account model.
    const shape = readAccountShape([
      { path: 'src/types.ts', text: 'interface User { role: UserRole }' }, acting,
    ], ROLES)
    expect(shape.modelFromSchema).toBe(false)
    expect(shape.oneRolePerAccount).toBe(false)
  })
})

describe('what the finding says', () => {
  it('reports the upgrade as destructive, in the product\'s own role names', () => {
    const [f] = dualRoleFindings(readAccountShape(files(), ROLES))
    expect(f!.id).toBe('DUAL-001')
    expect(f!.title).toBe('Upgrading a client into a seller replaces the account instead of adding to it')
    expect(f!.confidence).toBe('verified')
    // The two things asked of it: what a merged account is, and what the switch
    // between the two sides has to do.
    expect(f!.next).toMatch(/SET of roles rather than a single value/)
    expect(f!.next).toMatch(/same session, no password, no second email address/)
    expect(f!.prompt).toBeTruthy()
  })

  it('frames it as the free-to-paid conversion it is', () => {
    const [f] = dualRoleFindings(readAccountShape(files(), ROLES))
    expect(f!.detail).toMatch(/how many free client accounts become paying seller accounts/)
  })

  // A prompt that quietly merged two existing accounts would be deciding, on
  // its own, which identity survives and what happens to the other one's
  // records. That is an owner's decision.
  it('tells the prompt not to merge two existing accounts', () => {
    const [f] = dualRoleFindings(readAccountShape(files(), ROLES))
    expect(f!.prompt).toMatch(/Do not build a way to merge two EXISTING accounts/)
  })

  it('reports no upgrade path at all as a different finding', () => {
    const shape = readAccountShape([SCHEMA], ROLES)
    const [f] = dualRoleFindings(shape)
    expect(f!.id).toBe('DUAL-002')
    expect(f!.isAbsence).toBe(true)
    expect(f!.title).toMatch(/Nothing in the product turns a client into a paying seller/)
  })

  it('drops the pricing framing when no side was traced to the plan screens', () => {
    const noBilling = Object.fromEntries(
      Object.entries(ROLES).filter(([r]) => !/plan-selection|checkout/.test(r)),
    )
    const [f] = dualRoleFindings(readAccountShape(files(), noBilling))
    expect(f!.id).toBe('DUAL-003')
    expect(f!.detail).not.toMatch(/paying|free/)
  })

  // One audience is not two sides, and one role per account is the right shape
  // for most software. Saying otherwise would make the section noise.
  it('says nothing about a product with a single audience', () => {
    const oneSide = { '/': role('anonymous'), '/app': role('member'), '/admin': role('admin') }
    expect(dualRoleFindings(readAccountShape(files(), oneSide))).toEqual([])
  })

  it('says nothing when the account model could not be read', () => {
    expect(dualRoleFindings(readAccountShape([{ path: 'readme.md', text: '# hi' }], ROLES)))
      .toEqual([])
  })
})

describe('the words it uses', () => {
  // The whole layer exists so a report describes the project in front of it.
  it('carries no vocabulary from any other product', () => {
    const text = JSON.stringify(dualRoleFindings(readAccountShape(files(), ROLES)))
    for (const word of ['booking', 'stylist', 'appointment', 'salon', 'lookbook', 'poschi']) {
      expect(text.toLowerCase(), `"${word}" belongs to another product`).not.toContain(word)
    }
  })

  it('names the roles the repository named, not a house vocabulary', () => {
    const odd: Record<string, DerivedRole> = {
      '/shopper': role('shopper'),
      '/maker': role('maker'),
      '/maker/pricing': role('maker'),
    }
    const [f] = dualRoleFindings(readAccountShape(files(), odd))
    expect(f!.title).toMatch(/shopper/)
    expect(f!.title).toMatch(/maker/)
    expect(f!.title).not.toMatch(/client|provider|seller/)
  })
})
