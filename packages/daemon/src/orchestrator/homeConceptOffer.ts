/**
 * Home concepts inside the plan approval (no extra stop): while a look-up app's plan waits for approval, FlowCode offers
 * its Home concepts (workspace/homeConcepts.ts), each rendered live in FlowCode from the run's own app model with the
 * library pages a built app uses (the UI's concept preview). The person may pick one before approving; approving the
 * plan records the pick, and the app step applies it when the app is written. No pick keeps the default Home.
 *
 * Timings are kept per phase (offer prepared, picked, applied) as component measurements for the run's report; the
 * whole path, including the coder's remaining work, verification and the wait for approval, is measured on a real run.
 */
import { LIBRARY_SECTIONS } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import { HOME_CONCEPTS } from "../workspace/homeConcepts.js";
import { expectedTokens, specProblems, type DesignSpec } from "../workspace/designSpec.js";
import { appModelKey, type AppModel } from "./appModel.js";
import { homePieces } from "./lookupFiles.js";
import { lookupPreview } from "./appFiles.js";

export const conceptChoiceKey = (runId: string) => `runConcept:${runId}`;
export const designSpecKey = (runId: string) => `runDesignSpec:${runId}`;
export const conceptTimingsKey = (runId: string) => `conceptTimings:${runId}`;
export const designDirectionKey = (runId: string) => `designDirection:${runId}`;

/** The generic default Home, as an explicit, labelled choice (not what an unanswered card means). */
export const DEFAULT_HOME_CHOICE = "default";

/**
 * What the plan approval settled about the Home direction. Three approvals stay separate: library approval (a piece
 * may be offered), the plan's selection (this build uses it), and the person's final visual approval of the generated
 * app, which is always pending here: applying a concept never marks the visual quality approved.
 */
export interface DesignDirection {
  kind: "concept" | "default" | "none" | "not_offered";
  conceptId?: string;
  name?: string;
  /** No custom direction was chosen: the design requirement is still open (the design steps carry it; the report says so). */
  outstanding: boolean;
  why?: string;
  visualApproval: "pending";
  at: string;
  /** The look settled with the plan: the project's selected direction (its version), if one was confirmed. */
  appearance?: { version: number };
  /** Edits on the card that weren't confirmed with "Use this direction" (they aren't used). */
  unconfirmedDraft?: boolean;
}

export interface ConceptChoice {
  /** A concept's id, or DEFAULT_HOME_CHOICE for the generic default Home chosen explicitly. */
  conceptId: string;
  at: string;
  by: string;
}

/** Per-phase times for the run's report (ms), with when each happened. Component measurements, not a build-speed claim. */
export interface ConceptTimings {
  offeredAt?: string;
  prepareMs?: number;
  chosenAt?: string;
  approvedAt?: string;
  appliedAt?: string;
  applyMs?: number;
  coderWork?: string[];
}

export interface ConceptOffer {
  offered: boolean;
  /** Why no concepts are offered (not a look-up app, pieces waiting for approval, plan already approved). */
  why?: string;
  concepts: Array<{ id: string; name: string; thesis: string; design?: string; tokens: Record<string, string>; fonts: string[]; problems: string[] }>;
  chosen?: ConceptChoice;
  /** What the live preview needs to run the app's own frame and Home on its own data (the same as the built app's files). */
  preview?: { product: string; promise?: string; data: NonNullable<ReturnType<typeof lookupPreview>> };
}

const piecesWaiting = (spec: DesignSpec, approved = new Set(LIBRARY_SECTIONS.map((s) => s.id))) => homePieces(spec.composition.home).filter((id) => !approved.has(id));

/** `approved`: the library pieces approved for builds (the catalog's, by default). */
export function conceptOffer(store: Store, runId: string, planApproved: boolean, approved = new Set(LIBRARY_SECTIONS.map((s) => s.id))): ConceptOffer {
  const t0 = performance.now();
  const model = store.getSetting<AppModel | null>(appModelKey(runId), null);
  const chosen = store.getSetting<ConceptChoice | null>(conceptChoiceKey(runId), null) ?? undefined;
  if (!model?.lookup) return { offered: false, why: "Home concepts are offered for look-up apps written from their app model", concepts: [], ...(chosen ? { chosen } : {}) };
  // Pieces still on the approval shelf are never used by a build, so a concept that needs one isn't offered.
  const usable = HOME_CONCEPTS.filter((c) => !piecesWaiting(c, approved).length);
  if (!usable.length) {
    const waiting = [...new Set(HOME_CONCEPTS.flatMap((c) => piecesWaiting(c, approved)))];
    return { offered: false, why: `The Home designs are waiting for your approval in the Component library (${waiting.join(", ")})`, concepts: [], ...(chosen ? { chosen } : {}) };
  }
  const concepts = usable.map((c) => ({ id: c.id, name: c.name, thesis: c.thesis, ...(c.composition.home?.design ? { design: c.composition.home.design } : {}), tokens: expectedTokens(c), fonts: [c.typography.display, c.typography.body], problems: specProblems(c) }));
  const landing = model.nav.flatMap((g) => g.items).find((v) => v.kind === "landing");
  const offer: ConceptOffer = { offered: !planApproved, ...(planApproved ? { why: "The plan is approved; the Home direction was settled with it" } : {}), concepts, ...(chosen ? { chosen } : {}), preview: { product: model.product, ...(landing?.purpose ? { promise: landing.purpose } : {}), data: lookupPreview(model)! } };
  const timings = store.getSetting<ConceptTimings>(conceptTimingsKey(runId), {});
  if (!timings.offeredAt && !planApproved) store.setSetting(conceptTimingsKey(runId), { ...timings, offeredAt: new Date().toISOString(), prepareMs: Math.round((performance.now() - t0) * 10) / 10 });
  return offer;
}

/** The person's pick (a concept, or the generic default Home chosen explicitly), only while the plan waits for approval. */
export function chooseConcept(store: Store, bus: EventBus, run: { id: string; projectId: string; planApproved?: boolean }, conceptId: string, by: string, approved?: Set<string>): ConceptChoice {
  if (run.planApproved) throw new Error("The plan is already approved; the Home direction was settled with it");
  const offer = conceptOffer(store, run.id, false, approved);
  if (!offer.offered) throw new Error(offer.why ?? "No Home concepts are offered for this build");
  if (conceptId !== DEFAULT_HOME_CHOICE && !offer.concepts.some((c) => c.id === conceptId)) throw new Error(`"${conceptId}" isn't one of this build's Home concepts`);
  const choice: ConceptChoice = { conceptId, at: new Date().toISOString(), by };
  store.setSetting(conceptChoiceKey(run.id), choice);
  store.setSetting(conceptTimingsKey(run.id), { ...store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {}), chosenAt: choice.at });
  const name = HOME_CONCEPTS.find((c) => c.id === conceptId)?.name;
  bus.emit({ type: "plan.proposed", projectId: run.projectId, runId: run.id, message: conceptId !== DEFAULT_HOME_CHOICE ? `Home direction picked: ${name} (applied when the plan is approved)` : "Home direction picked: the generic default Home (chosen explicitly)", data: { concept: choice } });
  return choice;
}

/**
 * At plan approval: what was settled about the Home direction is recorded (designDirectionKey). A picked concept
 * becomes the run's design spec and the app model records its Home layout, so the app is written with it. The generic
 * default is used only when it was chosen; approving with no choice records that no direction was selected and keeps
 * the design requirement open. Returns the spec, or undefined when no concept was picked.
 */
export function settleConcept(store: Store, bus: EventBus, run: { id: string; projectId: string }, approved?: Set<string>): DesignSpec | undefined {
  const choice = store.getSetting<ConceptChoice | null>(conceptChoiceKey(run.id), null);
  const spec = choice && choice.conceptId !== DEFAULT_HOME_CHOICE ? HOME_CONCEPTS.find((c) => c.id === choice.conceptId) : undefined;
  const at = new Date().toISOString();
  store.setSetting(conceptTimingsKey(run.id), { ...store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {}), approvedAt: at });
  const offer = conceptOffer(store, run.id, true, approved);
  const direction: DesignDirection = spec
    ? { kind: "concept", conceptId: spec.id, name: spec.name, outstanding: false, visualApproval: "pending", at }
    : choice?.conceptId === DEFAULT_HOME_CHOICE
      ? { kind: "default", name: "the generic default Home", outstanding: false, visualApproval: "pending", at }
      : offer.concepts.length
        ? { kind: "none", outstanding: true, why: "The plan was approved without choosing a Home direction", visualApproval: "pending", at }
        : { kind: "not_offered", outstanding: true, why: offer.why ?? "No Home concepts were offered", visualApproval: "pending", at };
  // The look: the project's confirmed direction (the plan card's "Use this direction"); a draft alone isn't used.
  const design = store.getSetting<{ selected?: { version: number }; draft?: unknown } | null>(`designState:${run.projectId}`, null);
  if (design?.selected) direction.appearance = { version: design.selected.version };
  if (design?.draft) direction.unconfirmedDraft = true;
  store.setSetting(designDirectionKey(run.id), direction);
  if (direction.unconfirmedDraft) bus.emit({ type: "plan.approved", projectId: run.projectId, runId: run.id, level: "warning", message: `The plan was approved with unconfirmed look edits: they aren't used${design?.selected ? ` (the confirmed direction, version ${design.selected.version}, is)` : ""}. Confirm them with "Use this direction" on the Design tab or in the review.`, data: { designDirection: direction } });
  if (direction.kind === "none" || direction.kind === "not_offered")
    bus.emit({ type: "plan.approved", projectId: run.projectId, runId: run.id, level: "warning", message: `No custom Home direction was selected (${direction.why}): the design requirement stays open for the design steps, and the report says so`, data: { designDirection: direction } });
  if (direction.kind === "default") bus.emit({ type: "plan.approved", projectId: run.projectId, runId: run.id, message: "Home direction: the generic default Home, chosen explicitly. Final visual approval stays pending until the generated app is reviewed", data: { designDirection: direction } });
  if (!spec) return undefined;
  const model = store.getSetting<AppModel | null>(appModelKey(run.id), null);
  if (model && spec.composition.home) store.setSetting(appModelKey(run.id), { ...model, home: spec.composition.home });
  store.setSetting(designSpecKey(run.id), spec);
  bus.emit({ type: "plan.approved", projectId: run.projectId, runId: run.id, message: `Home direction: ${spec.name} (${spec.composition.home?.design ?? "composed"} page, ${spec.typography.display} / ${spec.typography.body}, ${spec.surface.vibe} surfaces); applied when the app is written. Final visual approval stays pending until the generated app is reviewed`, data: { designSpec: spec.id, designDirection: direction } });
  return spec;
}
