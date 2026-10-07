// The pre-launch checklist, and the four ways it was wrong before it shipped.
//
// Every case in "not from a word" is a finding this file actually produced
// against a real repository, at the severity stated, about something the
// project does not do. They are here because the same mistake has now been made
// in four different analysers, and it is always the same shape: a gate matching
// an ordinary English word rather than a thing the code does.

import { describe, it, expect } from 'vitest'
import {
  errorStabilityChecks, telemetryChecks, qualityChecks, monetizationChecks,
  seoChecks, journeyChecks, competitiveChecks, complianceChecks, securityChecks,
} from '../../../src/flowReport/analyzers/launchChecks.js'

const f = (path: string, text: string) => ({ path, text })
const ids = (found: Array<{ id: string }>) => found.map((x) => x.id)

describe('a check fires on what is missing', () => {
  it('reports no llms.txt, and stops once there is one', () => {
    expect(ids(seoChecks([f('index.html', '<html></html>')]))).toContain('LX-SEO-001')
    expect(ids(seoChecks([f('index.html', '<html></html>'), f('llms.txt', '# Thing')])))
      .not.toContain('LX-SEO-001')
  })

  it('reports a canonical that never changes, and accepts one that does', () => {
    const stat = [f('index.html', '<link rel="canonical" href="https://x.com">')]
    expect(ids(seoChecks(stat))).toContain('LX-SEO-005')

    const dyn = [...stat, f('src/seo.ts', "el.setAttribute('href', origin + location.pathname) // canonical")]
    expect(ids(seoChecks(dyn))).not.toContain('LX-SEO-005')
  })

  it('says nothing about a canonical that does not exist — the SEO section already does', () => {
    expect(ids(seoChecks([f('index.html', '<html></html>')]))).not.toContain('LX-SEO-005')
  })

  it('reports network calls with no failure path', () => {
    expect(ids(errorStabilityChecks([f('src/a.ts', 'await fetch("/api/x")')])))
      .toContain('LX-ERR-001')
    expect(ids(errorStabilityChecks([f('src/a.ts', 'try { await fetch("/api/x") } catch (e) { show(e) }')])))
      .not.toContain('LX-ERR-001')
  })

  it('reports a timer with no teardown, and accepts an effect that cleans up', () => {
    expect(ids(errorStabilityChecks([f('src/a.ts', 'setInterval(tick, 1000)')])))
      .toContain('LX-ERR-002')
    expect(ids(errorStabilityChecks([
      f('src/a.ts', 'setInterval(tick, 1000)'),
      f('src/b.ts', 'useEffect(() => { const t = setInterval(tick, 1) ; return () => clearInterval(t) })'),
    ]))).not.toContain('LX-ERR-002')
  })

  it('reports source maps enabled in a production build', () => {
    expect(ids(securityChecks([f('vite.config.ts', 'export default { build: { sourcemap: true } }')])))
      .toContain('LX-SEC-002')
  })

  it('reports a payment integration with no lifecycle webhook', () => {
    const paying = [f('src/pay.ts', "import Stripe from 'stripe'\nconst s = new Stripe(key)")]
    expect(ids(monetizationChecks(paying))).toContain('LX-MON-001')
    expect(ids(monetizationChecks([...paying,
      f('src/hook.ts', "if (event.type === 'customer.subscription.deleted') revoke()")])))
      .not.toContain('LX-MON-001')
  })
})

// ── A word is not a thing the code does ─────────────────────────────────────
describe('not from a word', () => {
  // Reported at HIGH severity: "payment is taken and nothing listens for a
  // subscription ending". The project's only `stripe` was a string in an array
  // of package names inside a build script.
  it('does not read a package name in a string array as a payment integration', () => {
    const build = f('script/build.ts', 'const ext = ["multer", "stripe", "passport", "openai"]')
    expect(ids(monetizationChecks([build]))).not.toContain('LX-MON-001')
  })

  // Reported at MEDIUM: "input is sent to an external AI model and no
  // disclosure was found", from the same string array.
  it('does not read a package name in a string array as an AI integration', () => {
    const build = f('script/build.ts', 'const ext = ["multer", "openai", "passport"]')
    expect(ids(complianceChecks([build]))).not.toContain('LX-CMP-102')
  })

  it('does read a real import of one', () => {
    expect(ids(complianceChecks([f('src/ai.ts', "import OpenAI from 'openai'\nconst c = new OpenAI()")])))
      .toContain('LX-CMP-102')
  })

  // Reported at HIGH: "paid features are gated in the interface and no
  // server-side check was found". The matches were "your plan tier" in help
  // text, "Free tier highlighted" in a preview string, and "Sentry offers a
  // generous free tier" in a tutorial.
  it('does not read the word "tier" in prose as a paid feature gate', () => {
    const prose = f('src/help.tsx', 'Project storage depends on your plan tier — Free tier is 5 projects.')
    expect(ids(monetizationChecks([prose]))).not.toContain('LX-MON-002')
  })

  // A release toggle is not something anybody paid for.
  it('does not read a feature flag as a paid entitlement', () => {
    const flags = f('src/admin.ts', "const enabled = await getFlag('feature_flag_new_editor')")
    expect(ids(monetizationChecks([flags]))).not.toContain('LX-MON-002')
  })

  it('does read a real entitlement gated only in the browser', () => {
    const ui = f('src/Page.tsx', 'if (user.isPro) return <Export />')
    expect(ids(monetizationChecks([ui]))).toContain('LX-MON-002')
  })

  it('does not report it when the server checks the same thing', () => {
    expect(ids(monetizationChecks([
      f('src/Page.tsx', 'if (user.isPro) return <Export />'),
      f('server/api/export.ts', 'if (!user.isPro) return forbidden()'),
    ]))).not.toContain('LX-MON-002')
  })

  // Reported: "no product analytics integration was found", on a codebase
  // calling its own trackPlatformEvent() thirteen times.
  it('recognises a tracker the product wrote itself', () => {
    expect(ids(telemetryChecks([f('src/a.ts', "trackPlatformEvent('signed_up', id)")])))
      .not.toContain('LX-TEL-001')
  })

  it('still reports a product with no tracking of any kind', () => {
    expect(ids(telemetryChecks([f('src/a.ts', 'export const a = 1')]))).toContain('LX-TEL-001')
  })
})

describe('what a check says about itself', () => {
  const [one] = seoChecks([f('index.html', '<html></html>')])

  it('names what it looked for, so a reader can check the call', () => {
    expect(one!.because).toMatch(/Looked for/)
    expect(one!.because).toMatch(/llms\.txt/)
  })

  it('is marked as an absence, which a stale checkout invalidates', () => {
    expect(one!.isAbsence).toBe(true)
  })

  it('never claims more confidence than an absence supports', () => {
    for (const c of [...seoChecks([f('a.html', '')]), ...telemetryChecks([f('a.ts', 'x')])]) {
      expect(c.confidence).toBe('indicated')
    }
  })

  it('says nothing at all about an empty repository', () => {
    // No code, so nothing to be missing from. Every check that fires here would
    // be a finding about a product that does not exist.
    const empty = [f('README.md', '# nothing')]
    const all = [
      ...errorStabilityChecks(empty), ...qualityChecks(empty), ...monetizationChecks(empty),
      ...journeyChecks(empty), ...securityChecks(empty), ...complianceChecks(empty),
    ]
    expect(ids(all)).toEqual([])
  })
})

describe('what counts as documenting the environment', () => {
  const readsEnv = f('src/lib/db.ts', 'export const url = import.meta.env.VITE_SUPABASE_URL')

  it('fires when nothing documents the variables', () => {
    expect(ids(qualityChecks([readsEnv]))).toContain('LX-QUA-001')
  })

  it('accepts the three conventional names', () => {
    for (const name of ['.env.example', '.env.sample', '.env.template']) {
      expect(ids(qualityChecks([readsEnv, f(name, 'VITE_SUPABASE_URL=')])), name)
        .not.toContain('LX-QUA-001')
    }
  })

  // ── The one that was wrong on a real repository ──
  //
  // POSCHI keeps `.env.prod.local.example`, so the exact-name match found
  // nothing and the report said no example file existed. Projects name these
  // per environment all the time.
  it('accepts an example named for an environment', () => {
    expect(ids(qualityChecks([readsEnv, f('.env.prod.local.example', 'VITE_SUPABASE_URL=')])))
      .not.toContain('LX-QUA-001')
  })

  // A typed manifest tells the next person what to set as well as a sample file
  // does, and in a TypeScript project the compiler checks it.
  it('accepts a typed environment declaration', () => {
    const decl = f('src/vite-env.d.ts', 'interface ImportMetaEnv {\n  readonly VITE_SUPABASE_URL: string\n}')
    expect(ids(qualityChecks([readsEnv, decl]))).not.toContain('LX-QUA-001')
  })

  // Not every file with "env" in the name is a manifest of what to set.
  it('is not satisfied by an ordinary file mentioning the environment', () => {
    expect(ids(qualityChecks([readsEnv, f('src/environment.ts', 'export const mode = "dev"')])))
      .toContain('LX-QUA-001')
  })
})

// ── The eleven security checks ───────────────────────────────────────────────
//
// Each has a positive and a negative, and the negative is the one that matters.
// A check that fires on every repository that has ever mentioned its subject is
// worse than no check: it teaches the reader to skim the section, and then the
// one real finding goes past with the rest.
//
// The shape guarded here is the one this file's header describes — a gate
// matching an English word rather than a thing the code does. SHA-1 over a file
// to make a cache key is not weak hashing; `Math.random()` for a shuffle is not
// a guessable token; the word "backup" in a comment is not a backup.

describe('security checks', () => {
  const sec = (fs: Array<{ path: string; text: string }>) => ids(securityChecks(fs))

  describe('weak hashing, where the subject is a secret', () => {
    it('fires on MD5 over a password', () => {
      expect(sec([f('src/auth.ts', "const hash = createHash('md5').update(password).digest('hex')")]))
        .toContain('LX-SEC-004')
    })

    // This analyser itself hashes files with SHA-1 to fingerprint them. A check
    // that flagged that would flag most repositories, for nothing.
    it('says nothing about a hash used as a cache key', () => {
      expect(sec([f('src/fingerprint.ts', "createHash('sha1').update(file.text).digest('hex')")]))
        .not.toContain('LX-SEC-004')
    })

    it('says nothing about a modern hash beside a password', () => {
      expect(sec([f('src/auth.ts', "const hash = await bcrypt.hash(password, 12)")]))
        .not.toContain('LX-SEC-004')
    })
  })

  describe('a socket nobody checks', () => {
    it('fires on a server with no handshake check', () => {
      expect(sec([f('src/ws.ts', "import { WebSocketServer } from 'ws'\nconst wss = new WebSocketServer({ port: 8080 })")]))
        .toContain('LX-SEC-005')
    })

    it('accepts one that authenticates during the handshake', () => {
      expect(sec([
        f('src/ws.ts', "import { WebSocketServer } from 'ws'\nconst wss = new WebSocketServer({ verifyClient: check })"),
      ])).not.toContain('LX-SEC-005')
    })

    it('says nothing where there is no socket at all', () => {
      expect(sec([f('src/a.ts', 'const x = 1')])).not.toContain('LX-SEC-005')
    })
  })

  describe('a link built from the Host header', () => {
    it('fires when the header reaches a URL', () => {
      expect(sec([f('src/mail.ts', 'const link = `https://${req.headers.host}/reset/${token}`')]))
        .toContain('LX-SEC-006')
    })

    // Reading the header to log it, or to route on it, is not the finding.
    it('says nothing where the header is read but no link is built', () => {
      expect(sec([f('src/log.ts', 'logger.info({ host: req.headers.host })')]))
        .not.toContain('LX-SEC-006')
    })
  })

  describe('a publicly cacheable response that knows who is asking', () => {
    it('fires when both are in the same file', () => {
      expect(sec([f('src/api/me.ts', "const user = await getUser(req)\nres.setHeader('Cache-Control', 'public, max-age=600')")]))
        .toContain('LX-SEC-007')
    })

    it('says nothing about a public cache on something anonymous', () => {
      expect(sec([f('src/api/pricing.ts', "res.setHeader('Cache-Control', 'public, max-age=600')")]))
        .not.toContain('LX-SEC-007')
    })

    it('says nothing when the response is marked private', () => {
      expect(sec([f('src/api/me.ts', "const user = await getUser(req)\nres.setHeader('Cache-Control', 'private, no-store')")]))
        .not.toContain('LX-SEC-007')
    })
  })

  describe('input in an email header', () => {
    it('fires on a subject built from a template expression', () => {
      expect(sec([f('src/mail.ts', "await sendMail({ to: user.email, subject: `Welcome ${name}` })")]))
        .toContain('LX-SEC-008')
    })

    it('says nothing where the input goes in the body', () => {
      expect(sec([f('src/mail.ts', "await sendMail({ to: 'ops@x.com', subject: 'Welcome', html: `<p>${name}</p>` })")]))
        .not.toContain('LX-SEC-008')
    })
  })

  describe('a token made with Math.random', () => {
    it('fires where the thing being made is an invite', () => {
      expect(sec([f('src/invite.ts', "const inviteToken = Math.random().toString(36).slice(2)")]))
        .toContain('LX-SEC-009')
    })

    // A shuffle, a jitter, a random colour. None of them are secrets.
    it('says nothing about Math.random used for anything else', () => {
      expect(sec([f('src/ui.ts', 'const jitter = Math.random() * 200')]))
        .not.toContain('LX-SEC-009')
    })

    it('accepts a token from the crypto API', () => {
      expect(sec([f('src/invite.ts', 'const inviteToken = crypto.randomUUID()')]))
        .not.toContain('LX-SEC-009')
    })
  })

  describe('discount codes with no ceiling', () => {
    it('fires where a code path has no limit', () => {
      expect(sec([f('src/checkout.ts', 'const discountCode = body.discountCode\napplyDiscount(discountCode)')]))
        .toContain('LX-SEC-010')
    })

    it('accepts a redemption limit', () => {
      expect(sec([
        f('src/checkout.ts', 'const discountCode = body.discountCode'),
        f('src/coupon.ts', 'if (coupon.timesRedeemed >= coupon.maxRedemptions) throw new Error("used up")'),
      ])).not.toContain('LX-SEC-010')
    })
  })

  describe('a seeded account with its password written in', () => {
    it('fires on a seed file', () => {
      expect(sec([f('supabase/seed.sql', "insert into users (email, password) values ('admin@x.com', 'letmein123')")]))
        .toContain('LX-SEC-011')
    })

    it('fires on a fixtures directory', () => {
      expect(sec([f('db/fixtures/users.ts', "export const demo = { email: 'demo@x.com', password: 'demo1234' }")]))
        .toContain('LX-SEC-011')
    })

    // A password in a test is a fake password for a test runner, not an account
    // that exists anywhere.
    it('says nothing about a password inside a test', () => {
      expect(sec([f('src/__tests__/auth.test.ts', "const password = 'hunter2'")]))
        .not.toContain('LX-SEC-011')
    })

    it('says nothing about a seed with no credential in it', () => {
      expect(sec([f('db/seeds/plans.ts', "export const plans = [{ name: 'Pro', price: 20 }]")]))
        .not.toContain('LX-SEC-011')
    })
  })

  describe('a database with nothing that copies it', () => {
    it('fires where migrations exist and no backup does', () => {
      expect(sec([f('supabase/migrations/001_init.sql', 'create table users (id uuid primary key);')]))
        .toContain('LX-SEC-012')
    })

    it('accepts a scheduled dump', () => {
      expect(sec([
        f('supabase/migrations/001_init.sql', 'create table users (id uuid primary key);'),
        f('.github/workflows/backup.yml', 'run: pg_dump "$DATABASE_URL" | gzip > dump.gz'),
      ])).not.toContain('LX-SEC-012')
    })

    // The word on its own proves nothing — this is the failure mode the whole
    // file is written against.
    it('is not satisfied by the word "backup" in application code', () => {
      expect(sec([
        f('supabase/migrations/001_init.sql', 'create table users (id uuid primary key);'),
        f('src/ui/Settings.tsx', 'const label = "Backup your data"'),
      ])).toContain('LX-SEC-012')
    })

    it('says nothing where there is no database', () => {
      expect(sec([f('src/a.ts', 'const x = 1')])).not.toContain('LX-SEC-012')
    })
  })

  describe('files handed out by permanent URL', () => {
    it('fires where nothing signs a URL anywhere', () => {
      expect(sec([f('src/files.ts', 'const { data } = supabase.storage.from("docs").getPublicUrl(path)')]))
        .toContain('LX-SEC-013')
    })

    it('accepts a codebase that signs them', () => {
      expect(sec([
        f('src/files.ts', 'const { data } = supabase.storage.from("docs").getPublicUrl(path)'),
        f('src/secure.ts', 'const { data } = await supabase.storage.from("docs").createSignedUrl(path, 60)'),
      ])).not.toContain('LX-SEC-013')
    })
  })

  describe('a secret baked into an image', () => {
    it('fires on an ENV with a value', () => {
      expect(sec([f('Dockerfile', 'FROM node:20\nENV DATABASE_PASSWORD=hunter2\nCMD ["node", "."]')]))
        .toContain('LX-SEC-014')
    })

    it('fires on a build ARG', () => {
      expect(sec([f('Dockerfile', 'ARG NPM_TOKEN=npm_xxxxxxxx')]))
        .toContain('LX-SEC-014')
    })

    // The name without a value is how a variable is declared for run time,
    // which is the thing being recommended rather than the thing being flagged.
    it('says nothing about an ENV that only names the variable', () => {
      expect(sec([f('Dockerfile', 'FROM node:20\nENV DATABASE_PASSWORD=$DATABASE_PASSWORD')]))
        .not.toContain('LX-SEC-014')
    })
  })

  // ── How a finding describes itself ──
  //
  // Half of these fire on something found rather than on something missing, and
  // an absence and a presence are not the same sentence. Printed as an absence,
  // a match reads "nothing matching this was found in the files that were
  // read" — over a line that was found.
  describe('a presence is not described as an absence', () => {
    const found = securityChecks([
      f('src/auth.ts', "const hash = createHash('md5').update(password).digest('hex')"),
    ])

    it('marks it as a presence', () => {
      const weak = found.find((c) => c.id === 'LX-SEC-004')!
      expect(weak.isAbsence).toBe(false)
      expect(weak.because).toMatch(/Read from the files\. Matched/)
      expect(weak.because).not.toMatch(/An absence/)
    })

    it('still marks a genuine absence as one', () => {
      const missing = securityChecks([f('src/api.ts', 'app.post("/login", handler)')])
        .find((c) => c.id === 'LX-SEC-001')!
      expect(missing.isAbsence).toBe(true)
      expect(missing.because).toMatch(/An absence/)
    })

    it('cites the files it matched, so the call can be checked', () => {
      expect(found.find((c) => c.id === 'LX-SEC-004')!.files).toContain('src/auth.ts')
    })
  })
})
