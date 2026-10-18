/**
 * What the plan says about the Look, as it actually stands when the plan is written: a selected direction, Home
 * directions proposed and awaiting the person's pick, or no direction. The plan never implies a design approval that
 * doesn't exist (Clean Cart planning validation: with nothing selected, the plan's steps read "Apply the direction you
 * selected" and "approve the prototype plan and the design set on the Styles page"). The approval itself binds the Look
 * version shown on the card (planReview.ts); the final visual approval of the built app stays separate.
 */
import { HOME_CONCEPTS } from "../workspace/homeConcepts.js";
import { getDesignState } from "../workspace/designState.js";
import type { Store } from "../db/store.js";
import { appModelKey, type AppModel } from "./appModel.js";
import { conceptChoiceKey, DEFAULT_HOME_CHOICE, type ConceptChoice } from "./homeConceptOffer.js";
import { CAPTURE_STYLE, DESIGN_POLISH, DESIGN_SCREENS, REVIEW } from "./templates.js";
import type { PrdLook } from "./planScope.js";

export interface LookStatus {
  state: "selected" | "proposed" | "none";
  /** One line for the plan (its assumptions and the Look steps). */
  line: string;
}

/** The PRD's own direction in one line (its concept, its words, its motion), never with values it doesn't give. */
export const prdLookLine = (l: PrdLook) => `${l.concept ? `"${l.concept}": ` : ""}${l.lines.filter((x) => x !== `Concept: ${l.concept}`).join("; ")}${l.motion ? `; ${l.motion} motion` : ""}${l.expressiveOff ? ", expressive effects off" : ""}`;

export function lookStatus(store: Store, projectId: string, runId: string, prdLook?: PrdLook): LookStatus {
  const selected = getDesignState(store, projectId).selected;
  const model = store.getSetting<AppModel | null>(appModelKey(runId), null);
  const chosen = store.getSetting<ConceptChoice | null>(conceptChoiceKey(runId), null);
  const home = chosen && chosen.conceptId !== DEFAULT_HOME_CHOICE ? HOME_CONCEPTS.find((c) => c.id === chosen.conceptId)?.name : undefined;
  const homeLine = home ? ` Home direction picked: ${home}, applied when the plan is approved.` : "";
  const notApproval = "Approving the plan binds the Look shown on its card; the final visual approval of the built app stays separate.";
  if (selected) {
    const a = selected.appearance;
    return { state: "selected", line: `Look: version ${selected.version} is selected (${a.surface} surfaces, ${a.motion?.level ?? "default"} motion).${homeLine} ${notApproval}` };
  }
  // The PRD's own visual direction is proposed for review as the PRD writes it (Frameproof planning: "Editorial contact
  // sheet" became "keeps the base styling" and tests of colours the PRD never gave).
  if (prdLook)
    return {
      state: "proposed",
      line: `Look: no direction is selected yet. The PRD's own direction is proposed for your review: ${prdLookLine(prdLook)}. Set it on the Styles page (exact colours and fonts are chosen there; the PRD gives none) and select it before approving to bind it; until then the build keeps the base styling and passes this direction to the design steps. Nothing about the design is approved yet.`,
    };
  if (model?.lookup && HOME_CONCEPTS.length)
    return {
      state: "proposed",
      line: `Look: no direction is selected. Proposed for your choice on the plan card: ${HOME_CONCEPTS.map((c) => c.name).join(", ")} (Home directions), and the Styles page.${homeLine} Until you select one, the build keeps the base styling; nothing about the design is approved yet.`,
    };
  return { state: "none", line: "Look: no direction is selected; the build keeps the base styling, and nothing about the design is approved yet." };
}

/** The Look steps worded as the Look stands: applying a selection only when there is one; the review approves the plan. */
export function withLookStatus<T extends { title: string; objective: string }>(tasks: T[], look: LookStatus, prdLook?: PrdLook): T[] {
  return tasks.map((t) => {
    if (prdLook && (t.title === DESIGN_SCREENS || t.title === DESIGN_POLISH)) return { ...t, objective: `${t.objective}\n\nThe PRD's visual direction (follow it; exact colours, fonts and sizes come only from the selected Look on the Styles page, never invented): ${prdLookLine(prdLook)}.` };
    if (t.title === CAPTURE_STYLE && t.objective.startsWith("Apply the direction you selected"))
      return { ...t, objective: look.state === "selected" ? "Apply the selected Look (the version the plan approval bound) to the Styles page." : `Keep the base styling unless a direction is selected before the plan is approved; then apply that one. ${look.line}` };
    if (t.title === REVIEW) return { ...t, objective: `Wait for the person to approve the prototype plan. ${look.line}` };
    return t;
  });
}
