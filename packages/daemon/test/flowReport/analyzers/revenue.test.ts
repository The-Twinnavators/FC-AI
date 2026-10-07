// Revenue opportunities, and the line between one and generic advice.
//
// Most of these cases are text that was measured producing a wrong answer
// against a real repository. An opportunity built on a misreading is worse than
// no opportunity: it sends somebody to look at a capability the product does
// not have.

import { describe, it, expect } from 'vitest'
import { readRevenuePicture, revenueOpportunities } from '../../../src/flowReport/analyzers/revenue.js'
import type { DerivedRole } from '../../../src/flowReport/poschi/sitemap/deriveSitemap.js'

const role = (r: string): DerivedRole => ({ role: r, basis: 'prop', because: `a guard allows ${r}` })

const ROLES: Record<string, DerivedRole> = {
  '/': role('anonymous'),
  '/client': role('client'),
  '/seller': role('seller'),
  '/seller/plan-selection': role('seller'),
  '/admin': role('admin'),
}

const SCHEMA = {
  path: 'db/migrations/001_core.sql',
  text: `create table public.profiles (
    id uuid primary key,
    role text not null default 'client' check (role in ('client','seller'))
  );`,
}

const pic = (...files: Array<{ path: string; text: string }>) =>
  readRevenuePicture([SCHEMA, ...files], ROLES)

describe('what the product pays for per use', () => {
  it('reads a declared dependency', () => {
    const p = pic({ path: 'package.json', text: '{"dependencies":{"twilio":"^4.0.0"}}' })
    expect(p.meteredServices).toEqual(['text messages'])
  })

  it('reads a provider called over REST, with nothing in any manifest', () => {
    // The shape that made package-only detection useless: integrations living
    // in edge functions, imported from a URL and called by endpoint.
    const p = pic({
      path: 'supabase/functions/send-email/index.ts',
      text: "await fetch('https://api.resend.com/emails', { method: 'POST' })",
    })
    expect(p.meteredServices).toEqual(['transactional email'])
  })

  it('ignores a devDependency', () => {
    const p = pic({ path: 'package.json', text: '{"devDependencies":{"twilio":"^4.0.0"}}' })
    expect(p.meteredServices).toEqual([])
  })

  // Every one of these was a real false positive across five repositories.
  it.each([
    ['an icon font', 'src/vendor/icons.css', '.ri-openai-fill:before { content: "\\f34a"; }'],
    ['a GitHub link', 'ATTRIBUTIONS.md', 'MIT licence at https://github.com/x/ui/blob/main/LICENSE.md'],
    ['a property name', 'src/upload.ts', 'upload({ id, blob: file, mimeType: file.type })'],
    ['prose', 'README.md', 'You could send real emails via Edge Functions and Resend.'],
    ['a package list in a script', 'script/build.ts', 'const ext = ["multer", "openai", "passport"]'],
  ])('does not read %s as a paid service', (_what, path, text) => {
    expect(pic({ path, text }).meteredServices).toEqual([])
  })

  it('survives a manifest that does not parse', () => {
    expect(() => pic({ path: 'package.json', text: '{ not json' })).not.toThrow()
  })
})

describe('whether usage is already priced', () => {
  it('counts a field that meters a plan', () => {
    expect(pic({ path: 'src/plan.ts', text: 'const included_messages = 500' }).hasAllowance).toBe(true)
  })

  // A false positive here SUPPRESSES the finding, which is how a product that
  // meters nothing came back as already metering. The first three and the last
  // are text measured doing exactly that; the prompt string is a guard against
  // the same shape rather than a sighting.
  it.each([
    ['a network condition', 'src/useMediaQuery.ts', '// a visitor on a metered connection pays for it'],
    ['a label', 'src/copy.ts', "label: 'Affiliate Under Monthly Quota'"],
    ['a memo proposing it', 'scripts/memo.cjs', 'e.g. 500 messages/month included, $0.05 per message overage'],
    ['a prompt string', 'src/demo.tsx', '`Prompt 3: Usage-based Pricing`'],
    ['a discount code cap', 'src/discounts.ts', 'usage_limit: number | null'],
  ])('does not read %s as a plan allowance', (_what, path, text) => {
    expect(pic({ path, text }).hasAllowance).toBe(false)
  })

  it('reads code only — a document describing a thing is not the thing', () => {
    expect(pic({ path: 'docs/pricing-strategy.md', text: 'Pure usage-based pricing is unpredictable.' })
      .hasAllowance).toBe(false)
  })
})

describe('the opportunities', () => {
  it('names an audience that is never charged', () => {
    const [f] = revenueOpportunities(pic())
    expect(f!.id).toBe('REV-001')
    expect(f!.title).toBe('Only seller accounts pay; client accounts are free')
    expect(f!.because).toMatch(/\/seller\/plan-selection/)
  })

  it('reports a per-use cost nobody meters', () => {
    const p = pic({ path: 'package.json', text: '{"dependencies":{"twilio":"^4.0.0"}}' })
    const f = revenueOpportunities(p).find((x) => x.id === 'REV-003')
    // Phrased to stay grammatical for one service or four.
    expect(f!.title).toBe('No plan includes an allowance for text messages')
  })

  it('stays quiet once an allowance exists', () => {
    const p = pic(
      { path: 'package.json', text: '{"dependencies":{"twilio":"^4.0.0"}}' },
      { path: 'src/plan.ts', text: 'const included_messages = 500' },
    )
    expect(revenueOpportunities(p).find((x) => x.id === 'REV-003')).toBeUndefined()
  })

  it('reports money moving out with no cut taken', () => {
    const p = pic({ path: 'src/pay.ts', text: "transfer_data: { destination: acct }" })
    expect(revenueOpportunities(p).find((x) => x.id === 'REV-002')).toBeTruthy()
  })

  it('stays quiet when a fee is already applied', () => {
    const p = pic({ path: 'src/pay.ts', text: "transfer_data: { destination: acct }, application_fee_amount: 200" })
    expect(revenueOpportunities(p).find((x) => x.id === 'REV-002')).toBeUndefined()
  })

  it('offers an annual term only where none exists', () => {
    const monthly = pic({ path: 'src/billing.ts', text: "const plan = { subscription: true, interval: 'month' }" })
    expect(revenueOpportunities(monthly).find((x) => x.id === 'REV-004')).toBeTruthy()

    const yearly = pic({ path: 'src/billing.ts', text: "const plans = [{ subscription: true, interval: 'month' }, { interval: 'year' }]" })
    expect(revenueOpportunities(yearly).find((x) => x.id === 'REV-004')).toBeUndefined()
  })

  it('says nothing at all about a product with none of these', () => {
    const bare = readRevenuePicture([{ path: 'readme.md', text: '# a book' }], {})
    expect(revenueOpportunities(bare)).toEqual([])
  })
})

describe('an opportunity is not a defect', () => {
  it('carries no severity above informational', () => {
    const p = pic(
      { path: 'package.json', text: '{"dependencies":{"twilio":"^4.0.0"}}' },
      { path: 'src/pay.ts', text: "transfer_data: { destination: acct }" },
      { path: 'src/billing.ts', text: "const plan = { subscription: true, interval: 'month' }" },
    )
    const found = revenueOpportunities(p)
    expect(found.length).toBeGreaterThan(2)
    for (const f of found) expect(f.severity).toBe('info')
  })

  it('carries no vocabulary from any other product', () => {
    const text = JSON.stringify(revenueOpportunities(pic(
      { path: 'package.json', text: '{"dependencies":{"twilio":"^4.0.0"}}' },
    )))
    for (const w of ['booking', 'stylist', 'appointment', 'salon', 'lookbook', 'poschi']) {
      expect(text.toLowerCase(), `"${w}" belongs to another product`).not.toContain(w)
    }
  })
})
