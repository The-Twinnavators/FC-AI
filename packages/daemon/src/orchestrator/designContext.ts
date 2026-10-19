/**
 * The direction a design step builds to, from the person and the PRD: the Look the person applied on the Design
 * direction page (its values are the app's tokens), their notes for the build (layout, section order, what to leave
 * out), and the PRD's own visual direction. Given as requirements, so fitting never cuts them. When either the person
 * or the PRD gives a direction, FlowCode's own guess for the product's industry (and the design research made from it)
 * isn't given: it would contradict them.
 *
 * Frameproof main build: the design parts were told "Habit / productivity / calendar: today's view with quick add,
 * success green, DM Sans" for a photo-selection app whose PRD asks for an editorial contact sheet, and the PRD's own
 * direction reached them only inside a plan-time note that said no Look was chosen yet.
 */
import type { ReferenceFile } from "@flowcode/contracts";
import type { DesignState } from "../workspace/designState.js";
import { visualDirection } from "./starterIdentity.js";

const surfaceName = (s: string) => (s === "skeuomorphism" ? "Tactile" : s === "flat" ? "Flat" : s);

/** The applied Look in a sentence, with the person's notes for the build (none applied: nothing). */
export function lookRequirement(s: DesignState): string[] {
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
  const out = [`The Look the person applied (version ${l.version}): ${values.join("; ")}. These are the app's tokens in src/styles/tokens.css: style with them (var(--…)), never other colours or fonts.`];
  if (l.notes?.length) out.push(`The person's own notes for the design build (their words; follow them):\n${l.notes.map((n) => `- ${n}`).join("\n")}`);
  return out;
}

/** The PRD's visual direction section, shortened to `max` characters ("" when it has none). */
export function prdDirectionRequirement(refs: ReferenceFile[], max: number): string {
  const d = visualDirection(refs);
  return d.length > max ? `${d.slice(0, max)}…` : d;
}

/** Everything a design step gets as its direction, and whether it replaces FlowCode's own guess. */
export function designDirectionContext(s: DesignState, refs: ReferenceFile[], max: number): { requirements: string[]; fromPersonOrPrd: boolean } {
  const look = lookRequirement(s);
  const prd = prdDirectionRequirement(refs, max);
  const requirements = [...look, ...(prd ? [prd] : [])];
  return { requirements, fromPersonOrPrd: requirements.length > 0 };
}
