/**
 * Design proofs (contracts designProof.ts): when the person lets FlowCode decide the design, the designer agent makes
 * three custom concepts of the product's home page while the build is planned. Each is a design specification (the
 * same DesignSpec the build applies) and the page composed from the Component library's own sections (a hero, what it
 * does, proof, a call to action, a footer) with the project's own words in their props, written from the
 * request, the PRD and the person's preferences, with the library's design skills in the prompt. One proof at a time
 * (the GPU gate serializes model calls anyway), each saved as it finishes, so leaving the page loses nothing and a
 * failed proof can be retried without the others.
 *
 * Nothing here starts the build: the plan can't be approved until the person approves one of these (planReview.ts),
 * and the approved proof's specification is what the style step applies (templates.ts captureStyleStep).
 */
import { z } from "zod";
import {
  BUNDLED_FONTS,
  DEFAULT_SURFACES,
  PROOF_BLOCKS,
  PROOF_IMAGE,
  ProofPage,
  appearanceTokens,
  contrastRatio,
  proofById,
  vibeTokens,
  type AgentRole,
  type Appearance,
  type DesignProof,
  type DesignProofs,
  type ProofRound,
  type ReferenceFile,
} from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import type { ModelRouter } from "../models/router.js";
import { expectedTokens, specProblems, type DesignSpec } from "../workspace/designSpec.js";
import { getDesignState } from "../workspace/designState.js";
import { findOpenImage } from "../workspace/openImages.js";
import type { PathJail } from "../security/pathJail.js";
import { designSkillIds, renderSkills, selectSkills } from "../knowledge/skills.js";
import { designSpecKey } from "./homeConceptOffer.js";
import { DESIGN_POLISH, DESIGN_SCREENS } from "./templates.js";
import { sectionsDir } from "./sectionRecipes.js";
import fs from "node:fs";
import path from "node:path";

export const proofsKey = (runId: string) => `runProofs:${runId}`;

interface Deps {
  store: Store;
  bus: EventBus;
  router: ModelRouter;
  /** The project's folder, where a proof's photos are saved (the build reuses them). */
  projects?: { jail(projectId: string): PathJail };
}

/** Three directions, so the proofs differ in composition and hierarchy, not only in color. The model fills them in. */
const DIRECTIONS = [
  "Direction A: a centered hero (hero-centered), features as a grid, a band of numbers, quotes, a closing banner. Light and open, with generous spacing.",
  "Direction B: a split hero with a picture (hero-split), features in alternating rows that show how it works, one large quote, questions people ask, a closing call to action beside a picture. Strong type hierarchy (an expressive scale, a serif or condensed display face).",
  "Direction C: a hero with proof numbers (hero-stats) or an announcement (hero-gradient), a checklist of what's included, prices or passes when the product has them, quote cards, a closing banner. Tactile surfaces; a dark background is welcome.",
];
const LABELS = ["Proof A", "Proof B", "Proof C"];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const FONT_NAMES = BUNDLED_FONTS.filter((f) => f.kind !== "mono").map((f) => f.family) as [string, ...string[]];
/** What the designer writes: a specification and the composed screen. */
const ProofAnswer = z.object({
  name: z.string().trim().min(1).max(60),
  rationale: z.string().trim().min(1).max(600),
  typography: z.object({ display: z.enum(FONT_NAMES), body: z.enum(FONT_NAMES), scale: z.enum(["compact", "regular", "expressive"]), headingWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]), headingCase: z.enum(["normal", "upper"]) }),
  palette: z.object({ bg: hex, surface: hex, surfaceSunken: hex, text: hex, textMuted: hex, border: hex, borderStrong: hex, accent: hex, accentHover: hex, onAccent: hex, secondary: hex }),
  density: z.enum(["compact", "regular", "airy"]),
  surface: z.object({ vibe: z.enum(["flat", "skeuomorphism"]), radii: z.tuple([z.number().int().min(0).max(12), z.number().int().min(0).max(12), z.number().int().min(0).max(12), z.number().int().min(0).max(12)]), borderWidth: z.union([z.literal(0), z.literal(1), z.literal(2)]) }),
  contentWidth: z.enum(["narrow", "regular", "wide"]),
  signature: z.string().trim().max(200),
  page: ProofPage,
});
type ProofAnswer = z.infer<typeof ProofAnswer>;
/**
 * The schema the model is asked to follow: the answer's own, simplified where local model servers refuse a construct
 * (Ollama rejects fixed-length tuples and oneOf). The answer is still checked against the full schema.
 */
const answerSchema = () => ollamaSafe(z.toJSONSchema(ProofAnswer)) as Record<string, unknown>;
function ollamaSafe(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(ollamaSafe);
  if (!node || typeof node !== "object") return node;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) o[k] = ollamaSafe(v);
  // A tuple: an array of its first item's kind, with its length.
  const tuple = (o.prefixItems ?? (Array.isArray(o.items) ? o.items : undefined)) as unknown[] | undefined;
  if (tuple?.length) {
    o.items = tuple[0];
    o.minItems = tuple.length;
    o.maxItems = tuple.length;
    delete o.prefixItems;
  }
  if (o.oneOf) {
    o.anyOf = o.oneOf;
    delete o.oneOf;
  }
  delete o.$schema;
  return o;
}

/** The jobs running in this process: a page asking after one that isn't running (a restart) starts it again. */
const running = new Set<string>();

const now = () => new Date().toISOString();
export const getProofs = (store: Store, runId: string) => store.getSetting<DesignProofs | null>(proofsKey(runId), null);
const save = (store: Store, p: DesignProofs) => store.setSetting(proofsKey(p.runId), p);

/** Whether this build waits for a design approval before its plan can be approved. */
export function designPending(store: Store, runId: string): boolean {
  const p = getProofs(store, runId);
  return !!p && !p.approved;
}

/** Starts a build's proofs (Start Build in agents mode): one round of three, made in the background. */
export function startProofs(d: Deps, runId: string, brief: DesignProofs["brief"]): DesignProofs {
  const existing = getProofs(d.store, runId);
  if (existing) return existing;
  const round: ProofRound = { id: "r1", at: now(), proofs: LABELS.map((label, i) => ({ id: `r1-${i}`, label, status: "queued" })) };
  const p: DesignProofs = { runId, projectId: d.store.runs.require(runId).projectId, rounds: [round], ...(brief ? { brief } : {}) };
  save(d.store, p);
  void work(d, runId);
  return p;
}

/** The page reads the proofs; a job that should be running but isn't (the daemon restarted) picks up where it was. */
export function readProofs(d: Deps, runId: string): DesignProofs | null {
  const p = getProofs(d.store, runId);
  if (p && !p.projectId) p.projectId = d.store.runs.require(runId).projectId;
  if (p && !running.has(runId) && p.rounds.some((r) => r.proofs.some((x) => x.status === "queued" || x.status === "working"))) void work(d, runId);
  return p;
}

/** Retry one failed proof; the others stay as they are. */
export function retryProof(d: Deps, runId: string, proofId: string): DesignProofs {
  const p = need(d.store, runId);
  const x = proofById(p, proofId);
  if (!x) throw new Error("That proof isn't part of this build.");
  if (x.status !== "failed") throw new Error("Only a proof that failed can be retried.");
  Object.assign(x, { status: "queued", error: undefined });
  save(d.store, p);
  void work(d, runId);
  return p;
}

/**
 * "Refine this design" (with the proof) or "None of these fit" (without): a revised proof from the person's feedback,
 * in a new round; every earlier proof stays to compare and go back to.
 */
export function reviseProofs(d: Deps, runId: string, feedback: string, from?: string): DesignProofs {
  const p = need(d.store, runId);
  if (p.approved) throw new Error("The design is approved. Change it on the Design tab.");
  if (!feedback.trim()) throw new Error("Describe what you want to change.");
  if (from && !proofById(p, from)) throw new Error("That proof isn't part of this build.");
  const n = p.rounds.length + 1;
  const proof: DesignProof = { id: `r${n}-0`, label: from ? `${proofById(p, from)!.label}, refined` : `Revised proof ${n - 1}`, status: "queued", feedback: feedback.trim(), ...(from ? { revises: from } : {}) };
  p.rounds.push({ id: `r${n}`, at: now(), feedback: feedback.trim(), proofs: [proof] });
  delete p.chosen;
  save(d.store, p);
  void work(d, runId);
  return p;
}

/** "Choose this design": shows its settings for approval; nothing is approved yet. */
export function chooseProof(store: Store, runId: string, proofId: string): DesignProofs {
  const p = need(store, runId);
  if (p.approved) throw new Error("The design is approved already.");
  const x = proofById(p, proofId);
  if (!x || x.status !== "ready") throw new Error("Choose a proof that is ready.");
  p.chosen = proofId;
  save(store, p);
  return p;
}

/**
 * The person's approval of the chosen proof: its specification becomes the build's design (applied by the style step),
 * and the design steps get its composition and rationale as their brief.
 */
export function approveProof(d: Deps, runId: string): DesignProofs {
  const p = need(d.store, runId);
  const x = proofById(p, p.chosen);
  if (!x?.spec || !x.page) throw new Error("Choose a design first.");
  p.approved = { at: now(), proofId: x.id };
  save(d.store, p);
  d.store.setSetting(designSpecKey(runId), x.spec);
  const brief = `Approved design proof "${x.name}" (${x.label}): ${x.rationale ?? ""} Build the home page from these library sections, in this order, with this content: ${describePage(x.page)}. Its design specification is applied to the app's tokens; keep it, and carry the same direction to the other screens.`;
  for (const t of d.store.tasks.where("run_id = ?", runId).filter((t) => t.title.startsWith(DESIGN_SCREENS) || t.title.startsWith(DESIGN_POLISH)))
    d.store.setSetting(`taskFindings:${t.id}`, [...d.store.getSetting<string[]>(`taskFindings:${t.id}`, []), brief]);
  const run = d.store.runs.require(runId);
  d.bus.emit({ type: "plan.proposed", projectId: run.projectId, runId, message: `Design approved: ${x.label}, ${x.name}. Its specification is the reference for the build.` });
  return p;
}

const need = (store: Store, runId: string) => {
  const p = getProofs(store, runId);
  if (!p) throw new Error("This build has no design proofs.");
  return p;
};

/** The composed page in words, for the coder: each library section and its main text. */
export function describePage(page: ProofPage): string {
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return page.sections
    .map((x) => {
      const t = text(x.props.title) || [text(x.props.before), text(x.props.emphasis), text(x.props.after)].filter(Boolean).join(" ") || text(x.props.quote) || text(x.props.brand);
      return `${x.block}${t ? ` ("${t.slice(0, 80)}")` : ""}`;
    })
    .join("; ");
}

/** A library section's props contract, read from its source: the Props type and the small types it uses. */
const contracts = new Map<string, string>();
function blockContract(id: string): string {
  const hit = contracts.get(id);
  if (hit) return hit;
  const b = PROOF_BLOCKS.find((x) => x.id === id)!;
  let src = "";
  try {
    src = fs.readFileSync(path.join(sectionsDir(), "sections", `${id}.tsx`), "utf8");
  } catch {
    return "";
  }
  const props = new RegExp(`^export type ${b.component}Props = \\{[\\s\\S]*?^\\};`, "m").exec(src)?.[0] ?? "";
  // The named types the props use (Link, Action, PricingPlan…), defined in the same file.
  const used = [...new Set([...props.matchAll(/\b([A-Z][A-Za-z]+)\b/g)].map((m) => m[1]!))].filter((n) => n !== `${b.component}Props` && !/^(ReactNode|Record|Partial)$/.test(n));
  const helpers = used.map((n) => new RegExp(`^(?:export )?type ${n} =[\\s\\S]*?;$`, "m").exec(src)?.[0]).filter(Boolean);
  const out = [...helpers, props].join("\n").replace(/\n\s*\n/g, "\n");
  contracts.set(id, out);
  return out;
}
/** Required top-level props of a section (fields without "?"), from its contract. */
const requiredProps = (id: string) => {
  const b = PROOF_BLOCKS.find((x) => x.id === id)!;
  const body = new RegExp(`type ${b.component}Props = \\{([\\s\\S]*?)^\\};`, "m").exec(blockContract(id))?.[1] ?? "";
  return [...body.matchAll(/^  ([a-zA-Z]+): /gm)].map((m) => m[1]!).filter((k) => !["id", "year", "children", "onSelect", "className"].includes(k));
};

/** What's wrong with a composed page: its structure (a hero, information, a call to action, a footer) and each section's required content. */
function pageProblems(page: ProofPage): string[] {
  const roles = page.sections.map((x) => PROOF_BLOCKS.find((b) => b.id === x.block)!.role);
  const out: string[] = [];
  const hero = roles.indexOf("hero");
  if (hero < 0) out.push("the page needs a hero section (hero-split, hero-centered, hero-stats or hero-gradient)");
  else if (roles.slice(0, hero).some((r) => r !== "nav")) out.push("the hero comes first (after the top bar)");
  if (roles.filter((r) => r === "hero").length > 1) out.push("one hero only");
  if (roles.filter((r) => r === "info" || r === "social").length < 2) out.push("add at least two sections about the app: what it does, how it works, who it's for, proof");
  if (!roles.includes("cta")) out.push("add a closing call to action (cta-banner or cta-split)");
  if (roles[roles.length - 1] !== "footer") out.push("end with a footer (footer-columns or footer-simple)");
  for (const x of page.sections) {
    const missing = requiredProps(x.block).filter((k) => x.props[k] === undefined || x.props[k] === "" || (Array.isArray(x.props[k]) && !(x.props[k] as unknown[]).length));
    if (missing.length) out.push(`${x.block} is missing ${missing.join(", ")}`);
  }
  return out;
}

/** Fills what FlowCode knows (ids, the year, the bar's variant) so the agent only writes content. */
function completePage(page: ProofPage): ProofPage {
  return {
    sections: page.sections.map((x, i) => {
      const props: Record<string, unknown> = { ...x.props };
      if (props.id === undefined) props.id = `${x.block}-${i}`;
      if (x.block.startsWith("footer") && typeof props.year !== "number") props.year = new Date().getFullYear();
      if (x.block === "top-nav-variants") props.variant = "marketing";
      return { block: x.block, props };
    }),
  };
}

async function work(d: Deps, runId: string) {
  if (running.has(runId)) return;
  running.add(runId);
  try {
    for (;;) {
      const p = getProofs(d.store, runId);
      const next = p?.rounds.flatMap((r) => r.proofs).find((x) => x.status === "queued" || x.status === "working");
      if (!p || !next) return;
      next.status = "working";
      next.startedAt = now();
      save(d.store, p);
      try {
        Object.assign(next, await makeProof(d, p, next), { status: "ready", finishedAt: now() });
      } catch (err) {
        Object.assign(next, { status: "failed", error: plain((err as Error).message), finishedAt: now() });
      }
      // Re-read: the page may have chosen or revised meanwhile.
      const latest = getProofs(d.store, runId)!;
      const slot = proofById(latest, next.id);
      if (slot) Object.assign(slot, next);
      save(d.store, latest);
      const run = d.store.runs.require(runId);
      const all = latest.rounds.flatMap((r) => r.proofs);
      const ready = all.filter((x) => x.status === "ready").length;
      const done = next as DesignProof;
      d.bus.emit({ type: "plan.proposed", projectId: run.projectId, runId, message: done.status === "ready" ? `Design proof ready: ${done.label}, ${done.name} (${ready} of ${all.length} ready).` : `${done.label} couldn't be made: ${done.error}. Retry it from the design review.`, level: done.status === "ready" ? "info" : "warning" });
    }
  } finally {
    running.delete(runId);
  }
}

const plain = (m: string) => (/abort/i.test(m) ? "it was stopped" : /HTTP \d{3}|ECONNREFUSED|fetch failed/i.test(m) ? `the design model couldn't run (${m.replace(/^Error:\s*/, "").slice(0, 200)})` : m.slice(0, 300));

async function makeProof(d: Deps, p: DesignProofs, proof: DesignProof): Promise<Partial<DesignProof>> {
  const run = d.store.runs.require(p.runId);
  const refs = d.store.getSetting<ReferenceFile[]>(`runRefs:${run.id}`, []);
  const prd = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n\n").slice(0, 6000);
  const all = p.rounds.flatMap((r) => r.proofs);
  const index = all.indexOf(proof);
  const base = proof.revises ? proofById(p, proof.revises) : undefined;
  const others = all.filter((x) => x.status === "ready" && x.id !== proof.id && x.page);
  // Locks the person set on the Look stay: those groups come from their Look, whatever the designer writes.
  const design = getDesignState(d.store, run.projectId);
  const locks = design.locks ?? [];
  const look = design.draft?.appearance ?? design.selected?.appearance ?? design.applied?.appearance;

  const library = d.store.skills.list("updated_at DESC", 200).filter((s) => s.enabled !== false);
  const task = "Design the product's home page: a hero introduction, sections about what the app does and who it is for, layout, visual hierarchy, typography, color palette, accessibility and contrast, responsive behavior and motion.";
  const ids = [...designSkillIds(task), ...selectSkills(library, "designer" as AgentRole, `${task} ${p.brief?.preferences ?? ""}`, 3).map((s) => s.id)];
  const skills = [...new Set(ids)].map((id) => library.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s).slice(0, 4);
  // The library sections it may use, each with its props contract (only these, not the whole library).
  const catalog = PROOF_BLOCKS.map((b) => `### ${b.id} (${b.role}): ${b.use}\n${blockContract(b.id)}`).join("\n\n");
  const system = [
    "You are FlowCode's senior product designer. You propose one design concept for the product's home page before it is built: a design specification (type, palette, density, surface, corners) and the page composed from FlowCode's Component library sections, each with its props written in the product's own words (names, classes, times, prices, places from the request and PRD; never lorem ipsum, never generic placeholders, never \"Feature 1\").",
    "The page, in order: the top bar (top-nav-variants), one hero that introduces the product and its main action, two to four sections about the app (what it does, how it works, who it's for, proof such as numbers or quotes, prices or questions when they matter), a closing call to action, and a footer. Write props exactly as each section's contract describes (field names and shapes); links are {\"label\", \"href\"} with href \"#\". For a picture (a \"media\" with \"alt\"), write alt as a short photo description someone could search for, like \"yoga class in a sunlit studio\"; FlowCode finds an openly licensed photo for it.",
    "Make it production quality and specific to this product and its people. Avoid generic SaaS copy and AI-looking defaults.",
    "Rules: fonts only from the given list; text on background and surfaces at least 4.5:1 contrast, the accent on the background at least 3:1, text on the accent at least 4.5:1; corners at most 12px; surfaces Flat or Tactile (skeuomorphism) only.",
    "\"name\" is the name of this design direction in two or three words (like \"Morning light\" or \"Studio ledger\"), never the screen's or the product's name. \"rationale\" says in two sentences why this direction fits this product and its people.",
    "Answer with JSON only, matching the schema.",
  ].join("\n") + renderSkills(skills);
  const user = [
    `Product request:\n${run.objective.slice(0, 3000)}`,
    prd ? `PRD (excerpt):\n${prd}` : "",
    p.brief?.preferences ? `The person's preferences: ${p.brief.preferences}` : "",
    p.brief?.avoid ? `Avoid: ${p.brief.avoid}` : "",
    p.brief?.inspiration?.length ? `Inspiration they attached: ${p.brief.inspiration.join("; ")}` : "",
    `The Component library sections you can use, with their props contracts:\n\n${catalog}`,
    base?.page ? `Revise this proof: ${base.name}: ${base.rationale}\nIts page: ${describePage(base.page)}\nKeep what works; change what the person asks.` : "",
    proof.feedback ? `The person's feedback: ${proof.feedback}` : "",
    !base ? DIRECTIONS[index % 3] : "",
    others.length ? `Its name must be its own, not any of: ${others.map((x) => `"${x.name}"`).join(", ")}.` : "",
    others.length ? `It must differ meaningfully from these proofs (a different hero, a different mix of sections, different type and color), not only in color:\n${others.map((x) => `- ${x.name}: ${describePage(x.page!).slice(0, 300)}; ${(x.spec as DesignSpec).typography.display}, background ${(x.spec as DesignSpec).palette.bg}`).join("\n")}` : "",
    locks.length && look ? `Locked by the person (keep exactly): ${locks.join(", ")} as in their current Look (${look.fonts.display}/${look.fonts.body}, primary ${look.primary}, ${look.mode}).` : "",
  ].filter(Boolean).join("\n\n");

  const assignment = run.modelAssignments.designer ?? d.router.assignmentFor("designer", run.projectId);
  let note = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await d.router.chat({ role: "designer", projectId: run.projectId, runId: run.id }, { ...assignment, temperature: 0.5 + attempt * 0.1 }, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: note ? `${user}\n\nYour last answer had problems; fix them: ${note}` : user },
      ],
      format: answerSchema(),
      maxOutputTokens: 8000,
      timeoutMs: 8 * 60_000,
    });
    let raw: unknown;
    try {
      raw = JSON.parse(extract(res.content));
    } catch {
      note = "the answer wasn't valid JSON";
      continue;
    }
    const parsed = ProofAnswer.safeParse(raw);
    if (!parsed.success) {
      note = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      continue;
    }
    const a = withLocks(parsed.data, locks, look);
    // Local models get the hue right and the contrast wrong: FlowCode fixes contrast itself (only the failing colors,
    // moved toward black or white until they pass WCAG AA), keeps the design, and says what it changed.
    const fixed = locks.includes("colors") ? [] : fixContrast(a.palette);
    a.page = completePage(a.page);
    const spec = toSpec(a, proof.id);
    const problems = [...pageProblems(a.page), ...specProblems(spec, [...DEFAULT_SURFACES, ...design.surfaceExceptions])];
    if (problems.length) {
      note = problems.join("; ");
      continue;
    }
    const photos = await addPhotos(d, run.projectId, a.page, proof.id);
    return { ...(photos.length ? { photos } : {}), name: a.name, rationale: a.rationale, spec, tokens: expectedTokens(spec), page: a.page, skills: skills.map((s) => s.id.replace(/^skill\./, "")), settings: [...settingsOf(spec), ...(fixed.length ? [{ label: "Contrast", value: `FlowCode adjusted ${fixed.join(", ")} to meet WCAG AA` }] : [])] };
  }
  throw new Error(`the designer's answer didn't pass FlowCode's checks (${note})`);
}

/**
 * Openly licensed photos for a page's pictures (Openverse via find_image's search: CC0 and public domain first, then
 * CC BY), saved in the project's public/images (the build reuses them) with their credit. A picture with no match
 * keeps its labelled placeholder.
 */
const STOP = new Set(["a", "an", "the", "in", "on", "at", "of", "with", "and", "for", "to", "from", "by", "their", "her", "his", "its", "large", "small", "big", "bright", "sunlit", "warm", "calm", "beautiful", "modern", "person", "people", "someone", "window", "windows"]);
async function addPhotos(d: Deps, projectId: string, page: ProofPage, proofId: string): Promise<NonNullable<DesignProof["photos"]>> {
  if (!d.projects) return [];
  let jail: PathJail;
  try {
    jail = d.projects.jail(projectId);
  } catch {
    return [];
  }
  const credits: NonNullable<DesignProof["photos"]> = [];
  let n = 0;
  // The run's vision model looks at each candidate (the builds' own check): a search for a yoga class found a 1940s
  // group photo by its words alone.
  const run = d.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", projectId)[0];
  const vision = run?.modelAssignments.critic;
  const judge = vision && run
    ? async (image: Buffer, query: string) => {
        const res = await d.router.chat({ role: "critic", projectId, runId: run.id }, { ...vision, temperature: 0 }, {
          messages: [
            { role: "system", content: 'You check stock photos before they go into a modern website. Answer whether the photo clearly shows the thing asked for, as its main subject, as a contemporary color photograph someone would use on that site today. Reject scans, adverts, posters, documents, photos with captions or printed text, old archival or historical photos (black and white, sepia, vintage prints), figurines, logos, screenshots and collages. Reply JSON only: {"ok": true|false, "reason": "a few words"}.' },
            { role: "user", content: `Does this photo clearly show: ${JSON.stringify(query)}?`, images: [image.toString("base64")] },
          ],
          format: { type: "object", properties: { ok: { type: "boolean" }, reason: { type: "string" } }, required: ["ok"] },
          maxOutputTokens: 200,
          timeoutMs: 60_000,
        });
        const j = JSON.parse(res.content.slice(res.content.indexOf("{"), res.content.lastIndexOf("}") + 1) || "{}") as { ok?: boolean; reason?: string };
        return { ok: j.ok !== false, reason: String(j.reason ?? "") };
      }
    : undefined;
  for (const x of page.sections) {
    const media = x.props.media as { alt?: unknown; src?: unknown } | undefined;
    // Only photos FlowCode found count: a path the model made up ("public/images/studio.jpg") points at nothing.
    if (!media || typeof media !== "object" || typeof media.alt !== "string") continue;
    if (typeof media.src === "string" && media.src.startsWith(PROOF_IMAGE)) continue;
    delete media.src;
    const query = media.alt.replace(/^(a |an |the )?(photo|picture|image) of /i, "").split(/[,.;:]/)[0]!.trim().slice(0, 80);
    if (!query) continue;
    // The open catalogue matches few long descriptions: the words that name things, then fewer of them.
    const words = query.toLowerCase().split(/\s+/).filter((w) => !STOP.has(w));
    const queries = [...new Set([query, words.slice(-3).join(" "), words.slice(-2).join(" ")].filter(Boolean))];
    try {
      const name = `proof-${proofId}-${++n}`;
      let r: Awaited<ReturnType<typeof findOpenImage>> = { ok: false, message: "", paths: [] };
      for (const q of queries) {
        r = await findOpenImage(jail, { query: q, name, orientation: "landscape" }, undefined, judge);
        if (r.ok) break;
      }
      const file = r.ok ? r.paths.find((p) => p.startsWith("public/images/")) : undefined;
      if (!file) continue;
      media.src = `${PROOF_IMAGE}${file.replace(/^public\//, "")}`;
      const all = JSON.parse(fs.readFileSync(jail.resolve("src/content/image-credits.json").abs, "utf8")) as Array<{ file: string; title: string; creator: string; license: string; source: string }>;
      const c = all.find((y) => y.file === `/${file.replace(/^public\//, "")}`);
      // Only a web address is kept as the source (the credits file is in the project and can be edited).
      if (c) credits.push({ title: String(c.title).slice(0, 200), creator: String(c.creator).slice(0, 120), license: String(c.license).slice(0, 40), source: /^https?:\/\//i.test(String(c.source)) ? String(c.source) : "" });
    } catch {
      /* offline or no match: the placeholder stays */
    }
  }
  return credits;
}

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, t: number) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i]! - v) * t));
};
const darkOn = (bg: string) => contrastRatio("#000000", bg) >= contrastRatio("#ffffff", bg);
/** The color moved toward black or white (whichever the background contrasts with) until it reaches `min`. */
function towards(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const target = darkOn(bg) ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1.001; t += 0.05) {
    const c = mix(fg, target, t);
    if (contrastRatio(c, bg) >= min) return c;
  }
  return target;
}
/** Fixes the palette's failing contrast pairs in place; returns the roles it changed. */
function fixContrast(p: ProofAnswer["palette"]): string[] {
  const before = { ...p };
  p.text = towards(towards(p.text, p.bg, 4.5), p.surface, 4.5);
  p.textMuted = towards(p.textMuted, p.bg, 4.5);
  p.accent = towards(p.accent, p.bg, 3);
  // Text on the accent: black or white, whichever reads better; if neither reaches 4.5, the accent moves away from it.
  p.onAccent = contrastRatio("#ffffff", p.accent) >= contrastRatio("#111111", p.accent) ? "#ffffff" : "#111111";
  if (contrastRatio(p.onAccent, p.accent) < 4.5) {
    const away = p.onAccent === "#ffffff" ? "#000000" : "#ffffff";
    for (let t = 0.05; t <= 1.001 && contrastRatio(p.onAccent, p.accent) < 4.5; t += 0.05) p.accent = mix(before.accent, away, t);
  }
  if (contrastRatio(p.accentHover, p.bg) < 3) p.accentHover = mix(p.accent, darkOn(p.bg) ? "#000000" : "#ffffff", 0.15);
  const names: Record<string, string> = { text: "the text", textMuted: "the muted text", accent: "the accent", onAccent: "the text on the accent", accentHover: "the accent's hover" };
  return Object.keys(names).filter((k) => before[k as keyof typeof before].toLowerCase() !== p[k as keyof typeof p].toLowerCase()).map((k) => names[k]!);
}

const extract = (text: string) => {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fence ? fence[1]! : text;
  const s = body.indexOf("{");
  const e = body.lastIndexOf("}");
  return s >= 0 && e > s ? body.slice(s, e + 1) : body;
};

/** Locked Look groups replace what the designer wrote for them. */
function withLocks(a: ProofAnswer, locks: string[], look?: Appearance): ProofAnswer {
  if (!look || !locks.length) return a;
  const out = structuredClone(a);
  if (locks.includes("type")) out.typography = { ...out.typography, display: look.fonts.display, body: look.fonts.body };
  if (locks.includes("surface")) out.surface = { ...out.surface, vibe: look.surface === "skeuomorphism" ? "skeuomorphism" : "flat" };
  if (locks.includes("shape") && look.shape) {
    const r = Math.min(12, look.shape.radius);
    out.surface = { ...out.surface, radii: [Math.round(r / 3), Math.round(r / 2), r, r] };
    out.density = look.shape.density === "compact" ? "compact" : look.shape.density === "spacious" ? "airy" : "regular";
  }
  if (locks.includes("colors")) {
    const t = appearanceTokens(look);
    const pick = (k: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(t[k] ?? "") ? t[k]! : fallback);
    const p = out.palette;
    out.palette = { bg: pick("--color-bg", p.bg), surface: pick("--color-surface", p.surface), surfaceSunken: pick("--color-surface-sunken", p.surfaceSunken), text: pick("--color-text", p.text), textMuted: pick("--color-text-muted", p.textMuted), border: pick("--color-border", p.border), borderStrong: pick("--color-border-strong", p.borderStrong), accent: pick("--color-accent", p.accent), accentHover: pick("--color-accent-hover", p.accentHover), onAccent: pick("--color-on-accent", p.onAccent), secondary: pick("--color-secondary", p.secondary) };
  }
  return out;
}

function toSpec(a: ProofAnswer, id: string): DesignSpec {
  // A surface style that draws its outlines at a fixed width sets the border width (Tactile); Flat takes the designer's.
  const outline = /^(\d+)px\b/.exec(vibeTokens(a.surface.vibe)["--surface-border"] ?? "");
  const borderWidth = (outline ? Math.min(3, Number(outline[1])) : a.surface.borderWidth) as DesignSpec["surface"]["borderWidth"];
  return {
    version: 1,
    id: `proof-${id}`,
    name: a.name,
    thesis: a.rationale,
    typography: a.typography,
    palette: a.palette,
    density: a.density,
    surface: { vibe: a.surface.vibe, radii: a.surface.radii, borderWidth },
    composition: { contentWidth: a.contentWidth, changes: [{ target: "Home page", change: `Compose it from these library sections, in order: ${describePage(a.page)}` }] },
    signature: a.signature,
    responsive: [],
    sources: [{ kind: "internal", ref: "design proof", confidence: "medium" }],
  };
}

function settingsOf(s: DesignSpec): Array<{ label: string; value: string }> {
  const contrast = contrastRatio(s.palette.text, s.palette.bg);
  return [
    { label: "Type", value: s.typography.display === s.typography.body ? s.typography.display : `${s.typography.display} + ${s.typography.body}` },
    { label: "Hierarchy", value: `${s.typography.scale} scale, weight ${s.typography.headingWeight}${s.typography.headingCase === "upper" ? ", capitals" : ""}` },
    { label: "Colors", value: `background ${s.palette.bg}, accent ${s.palette.accent}, text contrast ${contrast.toFixed(1)}:1` },
    { label: "Surface", value: `${s.surface.vibe === "skeuomorphism" ? "Tactile" : "Flat"}, corners ${s.surface.radii[2]}px, ${s.surface.borderWidth}px borders` },
    { label: "Spacing", value: `${s.density}, ${s.composition.contentWidth} content width` },
  ];
}
