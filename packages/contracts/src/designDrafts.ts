/**
 * Design drafts for Look and Feel: proposed designs of the same representative screen, made from FlowCode's own page
 * templates (the composition) and its Looks (the visual treatment). Deterministic and offline: the product type and the
 * PRD's words pick the templates, each draft gets a different treatment (type, colors, surface, corners, spacing), and
 * a person's feedback is read into every draft of the next set. They are proposals, not screenshots of a built app:
 * nothing is built until the person chooses one and approves it.
 */
import { appearanceFromTheme, BASE_APPEARANCE, TYPE_PAIRS, type Appearance } from "./appearance.js";
import { interpretDirection, withLocks } from "./designDirection.js";
import { LIBRARY_SECTIONS } from "./sectionLibrary.js";
import { TEMPLATES_FOR, type ProductType } from "./setup.js";

/** How closely the build follows the chosen design. */
export const DESIGN_FIDELITY = [
  { id: "close", label: "Follow closely", detail: "Keep its visual language and composition; adapt the content and features to this product." },
  { id: "inspiration", label: "Use as inspiration", detail: "A starting point: layout, type, colors, components and imagery may change." },
] as const;
export type DesignFidelity = (typeof DESIGN_FIDELITY)[number]["id"];

export interface DesignDraft {
  id: string;
  /** "Draft A · Clear and calm". */
  label: string;
  /** One line on the direction, in the person's words. */
  why: string;
  /** The page template it starts from (a LIBRARY_SECTIONS id). */
  template: string;
  appearance: Appearance;
}

export interface DraftSet {
  id: string;
  at: string;
  /** What the person asked to change (every set after the first answers some). */
  feedback?: string;
  /** Why these directions, briefly: what FlowCode read from the PRD and the product type. */
  basis: string;
  drafts: DesignDraft[];
  /** Feedback FlowCode couldn't turn into a design change: shown back, never dropped. */
  unread?: string[];
}

interface Treatment {
  name: string;
  /** Words in a person's feedback that ask for this treatment. */
  moods: RegExp;
  why: string;
  theme: string;
  surface: "flat" | "skeuomorphism";
  type: string;
  shape: NonNullable<Appearance["shape"]>;
  ratio: number;
}

/** Visual treatments that differ in type, color, surface, corners and spacing, not color alone. */
const TREATMENTS: Treatment[] = [
  { name: "Clear and calm", moods: /\b(calm(er)?|clean(er)?|simple(r)?|minimal|quiet(er)?|light(er)?|airy|neutral)\b/i, why: "a neutral sans, plenty of white space and fine borders, so the content leads", theme: "clean-minimal", surface: "flat", type: "inter", shape: { radius: 8, density: "comfortable", borders: "fine" }, ratio: 1.2 },
  { name: "Bold and editorial", moods: /\b(bold(er)?|editorial|magazine|elegant|luxur(y|ious)|premium|serif|dramatic|confident)\b/i, why: "high-contrast serif headings, square corners and generous spacing for a confident, magazine-like page", theme: "bold-editorial", surface: "flat", type: "playfair-source", shape: { radius: 2, density: "spacious", borders: "strong" }, ratio: 1.333 },
  { name: "Warm and friendly", moods: /\b(warm(er)?|friendl(y|ier)|soft(er)?|playful|round(ed|er)?|approachable|cosy|cozy|fun)\b/i, why: "a rounded geometric sans, soft tactile surfaces and round corners that feel approachable", theme: "sunset-warm", surface: "skeuomorphism", type: "dm-sans", shape: { radius: 12, density: "comfortable", borders: "fine" }, ratio: 1.25 },
  { name: "Focused dark", moods: /\b(dark(er)?|night|moody|black|focus(ed)?)\b/i, why: "a dark theme with compact spacing for people who spend long sessions in it", theme: "midnight", surface: "flat", type: "inter", shape: { radius: 6, density: "compact", borders: "fine" }, ratio: 1.2 },
  { name: "Quiet serif", moods: /\b(calm(er)?|quiet(er)?|serif|classic|literary|gentle|refined)\b/i, why: "calm serif headings over a sans, tactile panels and an unhurried rhythm", theme: "nordic-calm", surface: "skeuomorphism", type: "source-serif-inter", shape: { radius: 10, density: "spacious", borders: "fine" }, ratio: 1.25 },
  { name: "Punchy and condensed", moods: /\b(punchy|energetic|loud(er)?|vibrant|bright(er)?|sporty|bold(er)?|lively)\b/i, why: "condensed headings and strong borders for a lively, high-energy page", theme: "retro-pop", surface: "flat", type: "oswald-dm", shape: { radius: 4, density: "comfortable", borders: "strong" }, ratio: 1.333 },
];

const TEMPLATES = LIBRARY_SECTIONS.filter((x) => x.ref?.startsWith("t.") && x.id !== "nb-landing");
/** Words too general to say which template fits ("app", "page"). */
const GENERIC = new Set(["app", "apps", "page", "pages", "template", "site", "website", "home", "homepage", "the", "and", "for", "with", "web"]);
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []).filter((w) => !GENERIC.has(w)));

/** How well a template matches the product's words (its tags, use cases and jobs). */
function fit(id: string, text: Set<string>): number {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return -1;
  let n = 0;
  for (const phrase of [...t.tags, ...(t.useCases ?? []), ...(t.jobs ?? [])]) {
    const w = [...words(phrase)];
    if (w.length && w.every((x) => text.has(x))) n += w.length > 1 ? 3 : 1;
  }
  return n;
}

/** The templates to draft from, best first: the product type's own, then any that match the PRD's words. */
export function draftTemplates(productType: ProductType | undefined, text: string): string[] {
  const t = words(text);
  const own = (productType ? TEMPLATES_FOR[productType] : []).filter((id) => TEMPLATES.some((x) => x.id === id));
  const ranked = [...own].sort((a, b) => fit(b, t) - fit(a, t));
  const others = TEMPLATES.map((x) => x.id)
    .filter((id) => !own.includes(id))
    .map((id) => [id, fit(id, t)] as const)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const out = [...ranked, ...others];
  if (!out.length) return ["home-saas", "home-startup", "home-devtool"].filter((id) => TEMPLATES.some((x) => x.id === id));
  // The same kind of screen as the best fit first (three homepages, not a homepage and a settings screen).
  const kind = TEMPLATES.find((x) => x.id === out[0])?.category;
  const same = (id: string) => TEMPLATES.find((x) => x.id === id)?.category === kind;
  const sameKind = TEMPLATES.filter((x) => x.category === kind && !out.includes(x.id) && fit(x.id, t) > 0).map((x) => x.id);
  return [...out.filter(same), ...sameKind, ...out.filter((id) => !same(id))];
}

function treatmentLook(tr: Treatment, brand?: string): Appearance {
  const base = appearanceFromTheme(tr.theme, tr.surface) ?? { ...BASE_APPEARANCE, surface: tr.surface };
  const pair = TYPE_PAIRS.find((p) => p.id === tr.type) ?? TYPE_PAIRS[0]!;
  return { ...base, ...(brand ? { primary: brand } : {}), fonts: { display: pair.display, body: pair.body }, shape: { ...tr.shape }, typeScale: { base: 16, ratio: tr.ratio }, motion: base.motion ?? { level: "balanced" } };
}

export interface DraftInput {
  productType?: ProductType;
  /** The description and the PRD: what the templates are matched against. */
  text: string;
  /** The PRD's own brand color, if it names one: the first draft uses it. */
  brand?: string;
  /** "Describe what you want to change": read into every draft of this set. */
  feedback?: string;
  /** Three drafts, or one proposal. */
  count: 1 | 3;
  /** The sets made before (their templates and treatments are skipped where there are others to show). */
  previous?: DraftSet[];
  /** Locked Look groups the drafts keep. */
  locks?: readonly string[];
  keep?: Appearance;
  id: string;
  at: string;
}

/** One set of drafts: different templates (composition) and different treatments (visual language). */
export function proposeDrafts(input: DraftInput): DraftSet {
  const templates = draftTemplates(input.productType, input.text);
  const usedT = new Set((input.previous ?? []).flatMap((s) => s.drafts.map((d) => d.template)));
  const usedN = new Set((input.previous ?? []).flatMap((s) => s.drafts.map((d) => d.label.split(" · ")[1])));
  // New ones first, then the rest again (a thin product type has few templates of its own).
  // The same kind of screen in every set (the best fit's kind), new templates before ones already shown.
  const kind = TEMPLATES.find((x) => x.id === templates[0])?.category;
  const sameKind = templates.filter((id) => TEMPLATES.find((x) => x.id === id)?.category === kind);
  const rest = templates.filter((id) => !sameKind.includes(id));
  const fresh = (ids: string[]) => [...ids.filter((id) => !usedT.has(id)), ...ids.filter((id) => usedT.has(id))];
  const tOrder = sameKind.length >= input.count ? fresh(sameKind) : [...fresh(sameKind), ...fresh(rest)];
  // Feedback picks the treatments it asks for first ("darker and calmer": the dark and the calm ones).
  const fb = input.feedback?.trim() ?? "";
  // How many of the feedback's words ask for a treatment: the most asked-for first.
  const asked = (t: Treatment) => -(fb.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => t.moods.test(w)).length;
  const nOrder = [...TREATMENTS.filter((t) => !usedN.has(t.name)), ...TREATMENTS.filter((t) => usedN.has(t.name))].sort((a, b) => asked(a) - asked(b));
  const wantsDark = /\b(dark(er)?|night|moody|black)\b/i.test(fb);
  const wantsLight = /\b(light(er)?|bright(er)?|airy)\b/i.test(fb) && !wantsDark;
  const unread = new Set<string>();
  const drafts: DesignDraft[] = [];
  for (let i = 0; i < input.count; i++) {
    const template = tOrder[i % tOrder.length]!;
    const tr = nOrder[i % nOrder.length]!;
    let look = treatmentLook(tr, i === 0 && !input.previous?.length ? input.brand : undefined);
    if (fb) {
      const r = interpretDirection(fb, look);
      look = r.appearance;
      // Mood words the treatments answered aren't "unread".
      r.unread.filter((u) => !TREATMENTS.some((t) => t.moods.test(u)) && !/\b(dark(er)?|light(er)?)\b/i.test(u)).forEach((u) => unread.add(u));
      if (wantsDark && look.mode !== "dark") look = { ...(appearanceFromTheme("midnight", look.surface) ?? look), fonts: look.fonts, shape: look.shape, typeScale: look.typeScale, motion: look.motion };
      if (wantsLight && look.mode === "dark") look = { ...(appearanceFromTheme("clean-minimal", look.surface) ?? look), fonts: look.fonts, shape: look.shape, typeScale: look.typeScale, motion: look.motion };
    }
    // Locked groups stay as the person locked them.
    if (input.keep && input.locks?.length) look = withLocks(look, input.keep, input.locks);
    const name = TEMPLATES.find((x) => x.id === template)?.name ?? template;
    drafts.push({ id: `${input.id}-${i}`, label: `Draft ${String.fromCharCode(65 + i)} · ${tr.name}`, why: `${name} as the layout, with ${tr.why}.`, template, appearance: look });
  }
  const typeWord = input.productType && input.productType !== "other" ? `a ${input.productType.replace("-", " ")} product` : "this product";
  const matched = templates.slice(0, 3).map((id) => TEMPLATES.find((x) => x.id === id)?.name ?? id);
  const basis = input.feedback?.trim()
    ? `Revised from your note: "${input.feedback.trim().slice(0, 160)}".`
    : `Picked for ${typeWord}${matched.length ? `: layouts like ${matched.join(", ")}` : ""}${input.brand ? `, starting from your PRD's brand color` : ""}.`;
  return { id: input.id, at: input.at, ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}), basis, drafts, ...(unread.size ? { unread: [...unread] } : {}) };
}
