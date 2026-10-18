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

export interface ConceptChoice {
  conceptId: string | null;
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

/** The person's pick (or null for the default Home), only while the plan waits for approval. */
export function chooseConcept(store: Store, bus: EventBus, run: { id: string; projectId: string; planApproved?: boolean }, conceptId: string | null, by: string, approved?: Set<string>): ConceptChoice {
  if (run.planApproved) throw new Error("The plan is already approved; the Home direction was settled with it");
  const offer = conceptOffer(store, run.id, false, approved);
  if (!offer.offered) throw new Error(offer.why ?? "No Home concepts are offered for this build");
  if (conceptId && !offer.concepts.some((c) => c.id === conceptId)) throw new Error(`"${conceptId}" isn't one of this build's Home concepts`);
  const choice: ConceptChoice = { conceptId, at: new Date().toISOString(), by };
  store.setSetting(conceptChoiceKey(run.id), choice);
  store.setSetting(conceptTimingsKey(run.id), { ...store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {}), chosenAt: choice.at });
  const name = HOME_CONCEPTS.find((c) => c.id === conceptId)?.name;
  bus.emit({ type: "plan.proposed", projectId: run.projectId, runId: run.id, message: conceptId ? `Home direction picked: ${name} (applied when the plan is approved)` : "Home direction: the default Home (no concept picked)", data: { concept: choice } });
  return choice;
}

/**
 * At plan approval: the picked concept becomes the run's design spec, and the app model records its Home layout so
 * the app is written with it. Returns the spec, or undefined when nothing was picked.
 */
export function settleConcept(store: Store, bus: EventBus, run: { id: string; projectId: string }): DesignSpec | undefined {
  const choice = store.getSetting<ConceptChoice | null>(conceptChoiceKey(run.id), null);
  const spec = choice?.conceptId ? HOME_CONCEPTS.find((c) => c.id === choice.conceptId) : undefined;
  store.setSetting(conceptTimingsKey(run.id), { ...store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {}), approvedAt: new Date().toISOString() });
  if (!spec) return undefined;
  const model = store.getSetting<AppModel | null>(appModelKey(run.id), null);
  if (model && spec.composition.home) store.setSetting(appModelKey(run.id), { ...model, home: spec.composition.home });
  store.setSetting(designSpecKey(run.id), spec);
  bus.emit({ type: "plan.approved", projectId: run.projectId, runId: run.id, message: `Home direction: ${spec.name} (${spec.composition.home?.design ?? "composed"} page, ${spec.typography.display} / ${spec.typography.body}, ${spec.surface.vibe} surfaces); applied when the app is written`, data: { designSpec: spec.id } });
  return spec;
}
