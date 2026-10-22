/**
 * The approved design proof as a contract the build follows (designProofs.ts approveProof writes it): the home page's
 * library sections in their approved order with their approved content, the design specification and its tokens, and
 * the person's locked decisions, versioned per approval. Not a sentence in a prompt: the target screen's brief is
 * rewritten from it (so the layout step writes those sections with that content), the composition manifest locks them,
 * replanning re-applies it, and verification checks the rendered page against it (designContractProblems).
 *
 * Scope: the proof governs the target page's visual composition; the PRD stays authoritative for what the app must do.
 * A section the PRD's brief planned for that page that the proof doesn't show is kept (after the hero) and reported as
 * a conflict, never dropped quietly. Other pages keep their own briefs and rules.
 *
 * Not enforced here: whether the result looks like the proof (no visual-fit scoring), and the tokens are checked after a
 * step, not protected from edits during one.
 */
import fs from "node:fs";
import path from "node:path";
import { LIBRARY_SECTIONS, PROOF_BLOCKS, PROOF_IMAGE, type DesignProof, type ProofBlockId } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import { lightFirst, specTokens, type DesignSpec } from "../workspace/designSpec.js";
import { compositionKey, manifestFromBriefs, type CompositionManifest } from "./compositionManifest.js";
import { screenBriefKey, type ScreenBrief, type ScreenBriefSection } from "./screenBrief.js";
import { screenPlanKey, type PlannedScreen, type ScreenPlan } from "./screenPlan.js";
import { sectionFile, sectionsDir } from "./sectionRecipes.js";

export const designContractKey = (runId: string) => `designContract:${runId}`;

export interface ContractSection {
  block: ProofBlockId;
  /** The library piece's catalog ID (b.hero-split). */
  ref: string;
  /** Its named component (HeroSplit) and its file in the app (src/sections/HeroSplit.tsx). */
  component: string;
  appFile: string;
  role: (typeof PROOF_BLOCKS)[number]["role"];
  /** What the section is for on the page (the block's intent). */
  intent: string;
  /** The approved content, as the section's props. Pictures are "fc-image:images/…" (the app's public/images). */
  props: Record<string, unknown>;
}

export interface DesignContract {
  schema: 1;
  /** 1 for the first approval of this build, one more for each later approval (a revised proof). */
  revision: number;
  runId: string;
  proofId: string;
  proofLabel: string;
  proofName: string;
  rationale?: string;
  approvedAt: string;
  /** The page the proof is for: the plan's home (or landing) screen, else its first; resolved once there is a plan. */
  target: { screen?: string; file?: string };
  sections: ContractSection[];
  spec: DesignSpec;
  /** The specification's tokens, as the style step writes them. */
  tokens: Record<string, string>;
  /** What the person locked before the proofs (type, colors, surface, shape). */
  locks: string[];
  /** PRD sections planned for the target page that the proof doesn't show: kept after the hero. */
  kept: Array<{ title: string; purpose: string; part: string }>;
  /** Where the proof and the PRD disagree, in plain words; shown, never resolved quietly. */
  conflicts: string[];
}

export const getContract = (store: Store, runId: string) => store.getSetting<DesignContract | null>(designContractKey(runId), null);

/** A section's prop names, read from its Props type in the library source (only these reach the app's JSX). */
const propNames = new Map<string, string[]>();
export function blockPropNames(block: string): string[] {
  const hit = propNames.get(block);
  if (hit) return hit;
  const b = PROOF_BLOCKS.find((x) => x.id === block);
  let src = "";
  try {
    src = fs.readFileSync(path.join(sectionsDir(), "sections", `${block}.tsx`), "utf8");
  } catch {
    return [];
  }
  const body = b ? new RegExp(`^export type ${b.component}Props = \\{([\\s\\S]*?)^\\};`, "m").exec(src)?.[1] ?? "" : "";
  const names = [...body.matchAll(/^ {2}([a-zA-Z]+)\??: /gm)].map((m) => m[1]!);
  propNames.set(block, names);
  return names;
}

/** The contract for an approved proof (its sections, content, specification and locks). */
export function buildContract(runId: string, proof: DesignProof, locks: string[], previous: DesignContract | null, at: string): DesignContract {
  const spec = lightFirst(proof.spec as DesignSpec);
  const sections: ContractSection[] = (proof.page?.sections ?? []).map((x) => {
    const b = PROOF_BLOCKS.find((p) => p.id === x.block)!;
    const piece = LIBRARY_SECTIONS.find((s) => s.id === x.block);
    return { block: x.block, ref: piece?.ref ?? x.block, component: b.component, appFile: sectionFile(x.block), role: b.role, intent: b.use, props: structuredClone(x.props) };
  });
  return {
    schema: 1,
    revision: (previous?.revision ?? 0) + 1,
    runId,
    proofId: proof.id,
    proofLabel: proof.label,
    proofName: proof.name ?? proof.label,
    ...(proof.rationale ? { rationale: proof.rationale } : {}),
    approvedAt: at,
    target: {},
    sections,
    spec,
    tokens: specTokens(spec),
    locks,
    kept: [],
    conflicts: [],
  };
}

/** The screen the proof is for: the plan's home, landing or start screen, else its first. */
export function contractTarget(plan: ScreenPlan | null | undefined): PlannedScreen | undefined {
  const screens = plan?.screens ?? [];
  return screens.find((s) => /\b(home|landing|welcome|start|overview)\b/i.test(`${s.label} ${s.id}`)) ?? screens[0];
}

/** A brief's section that is the page's pitch (the proof's hero, call to action, footer or top bar replace these). */
const PITCH = /\b(hero|banner|headline|intro(duction)?|welcome|call to action|cta|sign[- ]?up prompt|footer|top bar|navigation bar|header)\b/i;
const PITCH_PARTS = new Set(["hero", "cta", "footers", "navigation"]);

/**
 * The target page's brief, rebuilt from the contract: the approved sections in order (each with its content), and the
 * PRD's own sections for that page that the proof doesn't cover, after the hero. Other briefs are returned as they are.
 */
export function briefsWithContract(contract: DesignContract, briefs: ScreenBrief[]): { briefs: ScreenBrief[]; kept: DesignContract["kept"]; conflicts: string[] } {
  const screen = contract.target.screen;
  const at = briefs.findIndex((b) => b.screen === screen);
  if (!screen || at < 0) return { briefs, kept: [], conflicts: [] };
  const old = briefs[at]!;
  const category = (part: string) => LIBRARY_SECTIONS.find((s) => s.ref === part || s.id === part)?.category ?? "";
  const kept = old.sections.filter((x) => !x.contract && !PITCH.test(`${x.title} ${x.purpose}`) && !PITCH_PARTS.has(category(x.part))).map((x) => ({ title: x.title, purpose: x.purpose, part: x.part }));
  const approved: ScreenBriefSection[] = contract.sections.map((x, i) => ({
    title: sectionTitle(x, i),
    purpose: `${x.intent} Approved design: keep this section, its order and its content.`,
    part: x.ref,
    contract: { block: x.block, component: x.component, props: x.props },
  }));
  const heroAt = contract.sections.findIndex((x) => x.role === "hero");
  const sections = [...approved.slice(0, heroAt + 1), ...kept.map((k) => ({ ...k, required: true as const })), ...approved.slice(heroAt + 1)];
  const conflicts = kept.map((k) => `The PRD plans "${k.title}" for ${screen}, which the approved design doesn't show: it's kept after the hero, in the approved design's style.`);
  const brief: ScreenBrief = { ...old, pageType: "marketing", sections };
  return { briefs: briefs.map((b, i) => (i === at ? brief : b)), kept, conflicts };
}

const text = (v: unknown) => (typeof v === "string" ? v : "");
function sectionTitle(x: ContractSection, i: number): string {
  const t = text(x.props.title) || [text(x.props.before), text(x.props.emphasis), text(x.props.after)].filter(Boolean).join(" ") || text(x.props.quote) || text(x.props.brand);
  const kind = { nav: "Top bar", hero: "Hero", info: "About the app", social: "What people say", cta: "Call to action", footer: "Footer" }[x.role];
  return t ? `${kind}: ${t.slice(0, 60)}` : `${kind} ${i + 1}`;
}

/**
 * Applies the build's contract to its plan: resolves the target screen, rewrites that screen's brief and the
 * composition manifest from it, and keeps the conflicts on the contract. A no-op without a contract; without briefs
 * yet, only the target is resolved (planning applies it when the briefs are written).
 */
export function applyDesignContract(store: Store, runId: string, screens?: ScreenPlan): DesignContract | null {
  const contract = getContract(store, runId);
  if (!contract) return null;
  const plan = screens ?? store.getSetting<ScreenPlan | null>(screenPlanKey(runId), null);
  const target = contractTarget(plan);
  const next: DesignContract = { ...contract, target: target ? { screen: target.label, file: target.file } : {} };
  const briefs = store.getSetting<ScreenBrief[]>(screenBriefKey(runId), []);
  if (briefs.length && target) {
    const res = briefsWithContract(next, briefs);
    next.kept = res.kept;
    next.conflicts = res.conflicts;
    store.setSetting(screenBriefKey(runId), res.briefs);
    const before = store.getSetting<CompositionManifest | undefined>(compositionKey(runId), undefined);
    const rebuilt = manifestFromBriefs(res.briefs);
    // The gaps and changes recorded for other pages stay; the target page's entries are the contract's.
    store.setSetting(compositionKey(runId), { entries: rebuilt.entries, gaps: (before?.gaps ?? []).filter((g) => g.page !== target.label), changes: (before?.changes ?? []).filter((c) => c.page !== target.label) });
  }
  store.setSetting(designContractKey(runId), next);
  return next;
}

/** The contract as the design steps read it. */
export function contractNote(c: DesignContract): string {
  if (!c.target.screen) return "";
  return [
    `Approved design (contract revision ${c.revision}, "${c.proofName}"): ${c.target.file ?? c.target.screen} is composed from these library sections in this order, with this content. FlowCode writes them; keep each section, its order and its words, and style around them. Don't replace them with other components, and don't change the design tokens in src/styles/tokens.css.`,
    ...c.sections.map((x, i) => `${i + 1}. <${x.component}> (${x.ref}) from ${x.appFile}`),
    c.kept.length ? `The PRD also needs these on this page (kept after the hero, in the same style): ${c.kept.map((k) => k.title).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** A picture saved for the proof, as the app's own address (public/images/x.jpg is /images/x.jpg). */
export const appImage = (v: string) => (v.startsWith(PROOF_IMAGE) ? `/${v.slice(PROOF_IMAGE.length).replace(/^\/+/, "")}` : v);
export function appProps(value: unknown): unknown {
  if (typeof value === "string") return appImage(value);
  if (Array.isArray(value)) return value.map(appProps);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, appProps(v)]));
  return value;
}

/** The section as JSX: its approved props, the names its component takes, pictures as the app's addresses. */
export function contractJsx(x: { block: string; component: string; props: Record<string, unknown> }, extra: Record<string, unknown> = {}): string {
  const names = new Set(blockPropNames(x.block));
  const props = { ...x.props, ...extra };
  const attrs = Object.entries(props)
    .filter(([k, v]) => v !== undefined && (!names.size || names.has(k)))
    .map(([k, v]) => `${k}={${JSON.stringify(appProps(v))}}`);
  return `<${x.component} ${attrs.join(" ")} />`;
}

/** The words a section must keep: its main text props, as written in the proof. */
function keyTexts(x: ContractSection): string[] {
  return ["title", "brand", "quote", "lede", "emphasis"].map((k) => text(x.props[k])).filter((t) => t.trim().length >= 4);
}

const norm = (v: string) => v.replace(/\s+/g, " ").replace(/["']/g, "").trim().toLowerCase();

/**
 * The rendered page against the contract: every approved section on the target page, in order, with its main words,
 * and the specification's main tokens in src/styles/tokens.css. Empty when it matches. With page: false (a step that
 * only changed the tokens), a page that isn't written yet doesn't count.
 */
export function designContractProblems(root: string, c: DesignContract, check: { page?: boolean } = {}): string[] {
  if (!c.target.file) return [];
  const out: string[] = [];
  let page = "";
  try {
    page = fs.readFileSync(path.join(root, c.target.file), "utf8");
  } catch {
    if (check.page !== false) out.push(`${c.target.file} is missing: the approved design's page isn't there.`);
  }
  // The code only: the layout step's comments repeat each section's title, which proves nothing.
  const code = page.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  // The words are in the JSX as JSON strings (escaped); compare without quotes and spacing.
  const flat = norm(code.replace(/\\"/g, '"'));
  let last = -1;
  for (const x of page ? c.sections : []) {
    const at = code.indexOf(`<${x.component}`, last + 1);
    if (at < 0) out.push(code.includes(`<${x.component}`) ? `${x.component} (${x.ref}) is out of the approved order on ${c.target.screen}.` : `${x.component} (${x.ref}) from the approved design isn't on ${c.target.screen}.`);
    else last = at;
    for (const t of keyTexts(x)) if (!flat.includes(norm(t))) out.push(`${x.component} lost its approved text "${t.slice(0, 60)}".`);
  }
  let tokens = "";
  try {
    tokens = fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");
  } catch {
    tokens = "";
  }
  // The light theme's :root block, where the style step writes the specification (the starter's dark block follows it).
  const start = tokens.search(/(^|\n):root\s*\{/);
  const base = start < 0 ? tokens : tokens.slice(start, tokens.indexOf("}", start) + 1);
  for (const name of ["--color-bg", "--color-text", "--color-accent", "--font-display", "--font-sans"]) {
    // The light theme as the build writes it (a dark design is made light-first; older contracts kept its dark colors).
    const want = specTokens(lightFirst(c.spec))[name] ?? c.tokens[name];
    if (!want) continue;
    const got = new RegExp(`${name.replace(/-/g, "\\-")}\\s*:\\s*([^;]+);`).exec(base)?.[1]?.trim();
    if (!got || norm(got) !== norm(want)) out.push(`Design token ${name} is ${got ?? "missing"}, the approved design has ${want}.`);
  }
  return out;
}
