/**
 * FlowCode builds clickable prototypes: simulated data, no backend, real navigation and in-app search, and the best
 * UX and visual design it can manage (docs/prototype-builder-plan.md). The PRD describes the real product; the
 * Launch readiness checklist is the hand-off for building it for real, and Build analysis and the Compliance report
 * scan real repos. So a build's checks are about the prototype and its design only.
 */
import type { ExecutionStrategy, VerificationKind } from "@flowcode/contracts";

/** Checks for a real product, not a prototype: the full accessibility audit and the security, privacy and SEO scans. */
export const REAL_APP_CHECKS: VerificationKind[] = ["accessibility", "security_scan", "compliance_triage", "seo"];

/** A build's required checks without the real-app ones (contrast and touch targets stay, in Design QA). */
export function prototypeChecks(strategy: ExecutionStrategy): ExecutionStrategy {
  return { ...strategy, requiredChecks: strategy.requiredChecks.filter((k) => !REAL_APP_CHECKS.includes(k)) };
}

/** What every planner and coder is told: the build is a prototype (planner, coder and step briefs all get it). */
export const PROTOTYPE_RULES = `This build is a clickable PROTOTYPE of the product the PRD describes, not the real application:
- No backend: no server code, database, real sign-in, payments, email or external API calls. Anything that would call
  a server is simulated in the app with src/sim: createCollection keeps each kind of record in local storage (seeded,
  so changes survive a reload), useSavedState keeps single values (settings, preferences, drafts) in local storage,
  simulate() adds a short realistic delay so loading states show, and resetDemoData() starts the demo over. Use
  these instead of raw localStorage calls. AI features return prepared realistic answers.
- Sign-in is a demo, not a login function: if the PRD has accounts, the sign-in screen opens with the demo account's
  email and password already filled in (one realistic demo user in src/sim) and one tap on Sign in goes in. No password
  checks, validation, account creation, reset or session logic; links like "Create account" or "Forgot password" just
  sign in too. Signing out returns to that pre-filled screen.
- Data: use the content the PRD gives (tables, examples, names, numbers) or the attached JSON in src/content/ as the
  seed. Fill gaps with realistic data for this product, never lorem ipsum or "Item 1".
- Real links and search: every screen, record and search has a URL (src/lib/screens.ts: useRoute, linkTo), Back works,
  and search fields really filter the simulated data (searchItems).
- Design first: this prototype is how people judge the product. Follow the Styles page (tokens, palette, surface),
  give every action immediate feedback with micro-animations (press, hover, enter, success), and design the empty,
  loading and error states.`;

/** The same, in one line for each step's constraints. */
export const PROTOTYPE_CONSTRAINT = "This is a prototype: no backend, server code or real external calls; simulate data and services with src/sim, link screens and records with src/lib/screens.ts.";

/**
 * Library skills for real backends, retired for prototype builds: they told agents to set up SQLite, Postgres, Python
 * services, real accounts and AI calls. Prototypes simulate all of that (PROTOTYPE_RULES).
 */
export const BACKEND_SKILLS = new Set(["skill.local-database", "skill.database-backed-feature", "skill.postgres", "skill.python", "skill.ai-assisted-workflow"]);
