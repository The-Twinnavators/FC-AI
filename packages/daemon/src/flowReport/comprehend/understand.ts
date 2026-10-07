// daemon/src/flow-reports/comprehend/understand.ts
//
// Working out what the product is, before asking whether it is any good.
//
// ── The step that was missing ────────────────────────────────────────────────
//
// The analysis went straight from "here are the files" to "here are the
// answers", with the questions fixed in advance. They were one product's
// questions — providers, bookings, appointments — so every repository was
// assessed as though it were that product. Gating stopped the false claims but
// could not produce true ones: nothing in the pipeline had ever established
// what the project under analysis actually is.
//
// This is that step. It reads a small, high-signal slice of the repository and
// returns a description of the product: what it is, who uses it, what they can
// do, what it is built on. Everything downstream can then ask questions about
// THIS product instead of about a remembered one.
//
// ── What the model may and may not do ────────────────────────────────────────
//
// It describes. It does not judge, score, or produce findings. Every finding in
// the report continues to come from a deterministic analyser with a file and a
// line behind it, because a model that can invent a finding makes the whole
// report unfalsifiable — and a reader has no way to tell which half to trust.
//
// What it produces is labelled as read rather than measured wherever it is
// printed, and `unknowns` is part of the schema so that "I could not tell" has
// somewhere to go other than into a confident sentence.
//
// ── Nothing leaves the machine ───────────────────────────────────────────────
//
// The model is a container on localhost and the client refuses any other host.
// The files sent are the ones the scanner already read, which means the ignore
// policy has already excluded environment files: the selection below cannot
// reach anything the scan did not.

import { chatJson, chooseModel, modelStatus, DEFAULT_MODEL } from './model.js'
import type { ScannedFile } from '../scanner/scan.js'

export interface Actor {
  /** What this kind of user is called, in the product's own words. */
  name: string
  /** What they come to the product to do. */
  goal: string
}

export interface CoreFlow {
  name: string
  /** The steps, as the code appears to support them. */
  steps: string[]
}

export interface ProductModel {
  /** One sentence. What this product is, for somebody who has never seen it. */
  whatItIs: string
  /** The domain in ordinary words — "appointment booking", "personal finance",
   *  "static marketing site". Used to decide which questions even apply. */
  domain: string
  /** True when the product exists for two distinct sides to transact with each
   *  other. Drives whether marketplace questions are asked at all. */
  isTwoSidedMarketplace: boolean
  actors: Actor[]
  coreFlows: CoreFlow[]
  /** The nouns the product stores — the data model, as far as it can be read. */
  entities: string[]
  /** Third parties it depends on: payments, mail, auth, storage. */
  externalServices: string[]
  /** How it is built, in one line: the stack and the shape. */
  architecture: string
  /** What could not be determined from the files. Printed, never swallowed. */
  unknowns: string[]
}

export interface Comprehension {
  model: ProductModel | null
  /** The model name that produced it, for the methodology section. */
  producedBy: string | null
  /** Why there is no model, when there is none. Always set in that case. */
  reason: string | null
  /** Repository-relative paths that were read. Printed, so a reader can see
   *  what the description was based on and disagree with it. */
  filesRead: string[]
}

// ── Choosing what to show it ─────────────────────────────────────────────────

/**
 * Files that describe a product, in the order they describe it best.
 *
 * A 7B model with an 8k window cannot read 1,859 files, and feeding it a random
 * slice would produce a confident description of whatever happened to be in the
 * slice. These are the files that carry intent: what the project says it is,
 * what it depends on, what it stores, and what a user can reach.
 */
/**
 * ── Each kind of file is capped, not just ranked ─────────────────────────────
 *
 * Ranking alone put eight `docs/` files into Poschi's seventeen slots and left
 * no room for the schema, the routes or the entry point — the model was handed
 * a deployment runbook and asked what the product was. A description needs one
 * of each kind of evidence far more than it needs eight of the best kind, so
 * every category carries its own ceiling.
 */
const SIGNAL: Array<{ match: RegExp; weight: number; cap: number; why: string }> = [
  { match: /^readme(\.md)?$/i, weight: 100, cap: 1, why: 'what the project says it is' },
  { match: /^package\.json$/, weight: 95, cap: 1, why: 'dependencies and scripts' },
  { match: /^(pyproject\.toml|go\.mod|Cargo\.toml|composer\.json|Gemfile)$/, weight: 95, cap: 1,
    why: 'dependencies' },
  { match: /^src\/(App|main|index)\.(tsx?|jsx?)$/, weight: 85, cap: 2, why: 'the entry point' },
  { match: /(routes?|router)\.(tsx?|jsx?)$/i, weight: 80, cap: 2, why: 'what a user can reach' },
  { match: /(schema\.(prisma|sql))$/i, weight: 78, cap: 2, why: 'the data model' },
  { match: /migrations?\/.*\.sql$/i, weight: 60, cap: 3, why: 'the data model' },
  { match: /^src\/(pages|views|screens)\/[^/]+\.(tsx?|jsx?)$/, weight: 55, cap: 5,
    why: 'the screens' },
  { match: /^(index\.html|app\/layout\.tsx)$/, weight: 50, cap: 1, why: 'the shell' },
  { match: /^(supabase\/functions|api|server|functions)\/[^/]+\/index\.(ts|js)$/, weight: 45,
    cap: 3, why: 'the server surface' },
  { match: /^(docs?|documentation)\/[^/]*\.mdx?$/i, weight: 40, cap: 2, why: 'documentation' },
]

/**
 * ── The budget is the context window, minus room to answer ───────────────────
 *
 * `num_ctx` is 8192 and cannot safely go higher on this machine — the app's own
 * config records that raising it forces a reload whose KV cache overflows VRAM
 * and hangs the box. 8192 tokens is roughly 32,000 characters, and the model
 * has to fit the system prompt, the files AND its answer inside it. Overflowing
 * it does not error: the input is silently truncated and the answer is
 * confident nonsense about whatever survived, which is exactly what happened to
 * Poschi and cssv at 42,000.
 */
const MAX_FILES = 14
const MAX_CHARS_PER_FILE = 1_800
const MAX_TOTAL_CHARS = 18_000

interface Chosen { path: string; text: string; why: string }

export function chooseFiles(files: ScannedFile[]): Chosen[] {
  const scored: Array<{ f: ScannedFile; weight: number; cap: number; why: string }> = []
  for (const f of files) {
    for (const s of SIGNAL) {
      if (s.match.test(f.path)) {
        scored.push({ f, weight: s.weight, cap: s.cap, why: s.why })
        break
      }
    }
  }
  scored.sort((a, b) => b.weight - a.weight || a.f.path.localeCompare(b.f.path))

  const out: Chosen[] = []
  const taken = new Map<string, number>()
  let total = 0
  for (const { f, cap, why } of scored) {
    if (out.length >= MAX_FILES || total >= MAX_TOTAL_CHARS) break
    const n = taken.get(why) ?? 0
    if (n >= cap) continue
    // Truncated from the front: the top of a file carries its imports, its
    // exports and its doc comment, which is where intent lives. The middle of a
    // 900-line component says far less per character.
    const text = f.text.slice(0, MAX_CHARS_PER_FILE)
    out.push({ path: f.path, text, why })
    taken.set(why, n + 1)
    total += text.length
  }
  return out
}

// ── Asking ───────────────────────────────────────────────────────────────────

const SYSTEM = `You read source code and describe the product it implements.

You describe. You never judge, score, or recommend — something else does that.

Rules you must not break:
- Describe only what the files support. If the files do not say, put it in "unknowns".
- Use the product's own vocabulary. If the code says "listing", do not say "product".
- "isTwoSidedMarketplace" is true ONLY when two distinct kinds of user transact
  with each other through the product. A site with customers and admins is not a
  marketplace. A blog is not a marketplace.
- Never invent an actor, a flow or an entity to make the description fuller. A
  short accurate description beats a complete invented one.

Reply with JSON only, matching exactly this shape:
{
  "whatItIs": "one sentence",
  "domain": "a few words",
  "isTwoSidedMarketplace": false,
  "actors": [{"name": "...", "goal": "..."}],
  "coreFlows": [{"name": "...", "steps": ["...", "..."]}],
  "entities": ["..."],
  "externalServices": ["..."],
  "architecture": "one line",
  "unknowns": ["..."]
}`

/** The shape check. A model that returns JSON is not a model that returned the
 *  right JSON, and a half-filled description printed as fact is worse than
 *  none. */
function validate(raw: unknown): ProductModel | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []

  const whatItIs = str(r['whatItIs'])
  // The one field with no honest default. Without it there is no description,
  // and everything else would be printed under a heading that promised one.
  if (!whatItIs) return null

  const actors = Array.isArray(r['actors'])
    ? (r['actors'] as unknown[])
      .map((a) => (a && typeof a === 'object' ? a as Record<string, unknown> : null))
      .filter((a): a is Record<string, unknown> => a !== null)
      .map((a) => ({ name: str(a['name']), goal: str(a['goal']) }))
      .filter((a) => a.name !== '')
    : []

  const coreFlows = Array.isArray(r['coreFlows'])
    ? (r['coreFlows'] as unknown[])
      .map((f) => (f && typeof f === 'object' ? f as Record<string, unknown> : null))
      .filter((f): f is Record<string, unknown> => f !== null)
      .map((f) => ({ name: str(f['name']), steps: list(f['steps']) }))
      .filter((f) => f.name !== '')
    : []

  return {
    whatItIs,
    domain: str(r['domain']) || 'not stated',
    isTwoSidedMarketplace: r['isTwoSidedMarketplace'] === true,
    actors,
    coreFlows,
    entities: list(r['entities']),
    externalServices: list(r['externalServices']),
    architecture: str(r['architecture']),
    unknowns: list(r['unknowns']),
  }
}

/**
 * Read the repository and describe it.
 *
 * Never throws and never blocks a run: an unreachable model, a timeout or a
 * malformed answer all produce a `Comprehension` with a null model and a reason
 * the report prints. The deterministic analysis runs either way.
 */
export async function understandRepository(
  files: ScannedFile[],
  o: { model?: string; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Comprehension> {
  const chosen = chooseFiles(files)
  if (chosen.length === 0) {
    return {
      model: null,
      producedBy: null,
      reason: 'No manifest, README, schema or entry point was found, so there was nothing to '
        + 'read the product from.',
      filesRead: [],
    }
  }

  const status = await modelStatus()
  const name = chooseModel(status, o.model ?? DEFAULT_MODEL)
  if (!name) {
    return {
      model: null,
      producedBy: null,
      reason: status.reason
        ?? 'No local model was available, so the product was not read — only measured.',
      filesRead: [],
    }
  }

  const corpus = chosen
    .map((c) => `--- ${c.path} (${c.why}) ---\n${c.text}`)
    .join('\n\n')

  const raw = await chatJson<unknown>([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Describe the product these files implement.\n\n${corpus}`,
    },
  ], { model: name, timeoutMs: o.timeoutMs ?? 180_000, signal: o.signal })

  const model = validate(raw)
  if (!model) {
    return {
      model: null,
      producedBy: name,
      reason: `${name} did not return a usable description of the product. The measurements `
        + 'below are unaffected; only the description is missing.',
      filesRead: chosen.map((c) => c.path),
    }
  }

  return { model, producedBy: name, reason: null, filesRead: chosen.map((c) => c.path) }
}
