/**
 * The direction a design step builds to, from the person and the PRD: the Look the person applied on the Design
 * direction page (its values are the app's tokens), the groups they locked, their notes for the build (layout, section
 * order, what to leave out), and the PRD's own visual direction. Given as requirements, so fitting never cuts them, in
 * order of precedence: the applied Look and its locks, then the person's notes, then the PRD. When either the person or
 * the PRD gives a direction, FlowCode's own guess for the product's industry (and the research made from it) isn't
 * given: it would contradict them.
 *
 * Each instruction is delivered once. A note that repeats the PRD's direction word for word (the person read the PRD's
 * own direction on the Design page) adds nothing and isn't listed again; a note with anything of its own (a new
 * instruction, an override) is kept whole, in the person's words. A screen's part gets the PRD's composition for its
 * own screen, not the others' (each goes to its own part).
 *
 * Frameproof main build: the design parts were told "Habit / productivity / calendar: today's view with quick add,
 * success green, DM Sans" for a photo-selection app whose PRD asks for an editorial contact sheet; reading the PRD's
 * direction on the Design page then made 13 notes that repeated it, which would have sent it twice.
 */
import { LOOK_GROUPS, type ReferenceFile } from "@flowcode/contracts";
import type { DesignState } from "../workspace/designState.js";
import { visualDirection } from "./starterIdentity.js";

const surfaceName = (s: string) => (s === "skeuomorphism" ? "Tactile" : s === "flat" ? "Flat" : s);

/** Text for comparing instructions: case, punctuation, list markers and hyphens don't count; padded for whole words. */
export const normalized = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/^\s*(?:#+|[-*•]|\d+[.)])\s+/gm, " ")
    .replace(/[^a-z0-9#]+/g, " ")
    .trim()} `;

/** What each Look group is about, to tell a note that touches a locked one. */
const GROUP_WORDS: Record<string, RegExp> = {
  colors: /\b(colou?rs?|palette|accent|background|backdrop|#[0-9a-f]{3,6}|white|black|cobalt|blue|red|green|grey|gray|warm|cool|dark|light|tint\w*)\b/i,
  type: /\b(fonts?|typefaces?|typograph\w*|headings?|serif|sans|text size|type scale)\b/i,
  shape: /\b(corners?|round\w*|radius|density|dense|compact|spacious|airy|borders?|spacing)\b/i,
  surface: /\b(flat|tactile|shadows?|depth|skeuomorph\w*)\b/i,
  motion: /\b(motion|animat\w*|transitions?|movement)\b/i,
};
const OVERRIDE = /\b(instead of|rather than|not the prd|ignore the prd|override|replace (the )?prd)\b/i;

const lockLabel = (g: string) => LOOK_GROUPS.find((x) => x.id === g)?.label.toLowerCase() ?? g;

/** The person's notes the PRD's direction doesn't already say word for word, each once; and the ones it does. */
export function distinctNotes(notes: string[], prdDirection: string): { kept: string[]; repeated: string[] } {
  const prd = normalized(prdDirection);
  const seen = new Set<string>();
  const kept: string[] = [];
  const repeated: string[] = [];
  for (const n of notes) {
    const k = normalized(n);
    if (k.trim() === "" || seen.has(k)) continue;
    seen.add(k);
    if (prd.includes(k)) repeated.push(n);
    else kept.push(n);
  }
  return { kept, repeated };
}

/** The applied Look in a sentence, its locks, and the person's own notes (none applied: nothing). */
export function lookRequirement(s: DesignState, prdDirection = ""): string[] {
  const l = s.applied;
  if (!l) return [];
  const a = l.appearance;
  const values = [
    `${a.mode} mode, ${surfaceName(a.surface)} surfaces`,
    `headings in ${a.fonts.display}, text in ${a.fonts.body}`,
    `primary ${a.primary}${a.secondary ? `, secondary ${a.secondary}` : ""}, ${a.neutral} neutrals`,
    a.shape ? `corners up to ${a.shape.radius}px, ${a.shape.density} density, ${a.shape.borders} borders` : "",
    a.typeScale ? `body text ${a.typeScale.base}px, headings growing by ${a.typeScale.ratio}` : "",
  ].filter(Boolean);
  const out = [`The Look the person applied (version ${l.version}): ${values.join("; ")}. These are the app's tokens in src/styles/tokens.css: style with them (var(--…)), never other colours or fonts. Where the PRD's direction names other colours, fonts or shapes, the Look wins.`];
  const locks = (s.locks ?? []).filter((g) => GROUP_WORDS[g]);
  if (locks.length) out.push(`Locked by the person: ${locks.map(lockLabel).join(", ")}. Keep these exactly as the Look sets them, whatever the PRD's direction or a note says about them.`);
  const { kept, repeated } = distinctNotes(l.notes ?? [], prdDirection);
  if (kept.length) {
    const line = (n: string) => {
      const locked = locks.filter((g) => GROUP_WORDS[g]!.test(n));
      return `- ${n}${OVERRIDE.test(n) ? " (overrides the PRD's direction)" : ""}${locked.length ? ` (${locked.map(lockLabel).join(" and ")} locked: keep the Look's values; follow the rest)` : ""}`;
    };
    out.push(`The person's own notes for the design build (their words; where they differ from the PRD's direction, follow the person):\n${kept.map(line).join("\n")}${repeated.length ? `\n(${repeated.length} more of their notes repeat the PRD's direction word for word: given once, below.)` : ""}`);
  } else if (repeated.length) out.push(`The person read the PRD's direction for this Look (${repeated.length} notes, all in the PRD's direction below: given once there).`);
  return out;
}

/**
 * The PRD's visual direction section ("" when it has none), for one screen when `screen` is given: the composition
 * lists of other screens are left to their own steps (their headings and items), everything else is kept. A line the
 * step's own objective already quotes (`said`: its PRD requirements, never cut) isn't given twice, and a heading left
 * with nothing under it goes too. Shortened to `max` characters.
 */
export function prdDirectionRequirement(refs: ReferenceFile[], max: number, screen?: string, said = ""): string {
  const d = visualDirection(refs);
  if (!d) return "";
  const already = normalized(said);
  // Sections by heading (the intro line is its own); another screen's composition section goes whole to its step.
  const sections: Array<{ heading?: string; lines: string[] }> = [];
  for (const [i, l] of d.split("\n").entries()) {
    const h = /^#{1,4}\s+(.+)$/.exec(l);
    if (h || i === 0) sections.push({ heading: l, lines: [] });
    else sections.at(-1)!.lines.push(l);
  }
  const kept = sections
    .filter((s) => {
      const h = /^#{1,4}\s+(.+)$/.exec(s.heading ?? "");
      return !(screen && h && /composition\s*$/i.test(h[1]!) && !h[1]!.toLowerCase().includes(screen.toLowerCase()));
    })
    .map((s) => ({ ...s, lines: s.lines.filter((l) => !(l.trim() && said && already.includes(normalized(l)))) }))
    // A heading whose lines are all quoted elsewhere goes too (the intro line always stays).
    .filter((s, i) => i === 0 || s.lines.some((l) => l.trim()));
  const text = kept.map((s) => [s.heading, ...s.lines].join("\n")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Everything a design step gets as its direction, and whether it replaces FlowCode's own guess. */
export function designDirectionContext(s: DesignState, refs: ReferenceFile[], max: number, screen?: string, said = ""): { requirements: string[]; fromPersonOrPrd: boolean } {
  const prd = prdDirectionRequirement(refs, max, screen, said);
  // Notes are compared with the whole PRD direction: one that repeats another screen's composition is delivered to
  // that screen's step, not repeated here.
  const look = lookRequirement(s, visualDirection(refs));
  const requirements = [...look, ...(prd ? [prd] : [])];
  return { requirements, fromPersonOrPrd: requirements.length > 0 };
}
