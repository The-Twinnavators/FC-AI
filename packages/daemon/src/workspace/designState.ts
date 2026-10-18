/**
 * A project's design state: what renders without a chosen direction (the base), the direction being edited (draft),
 * the one chosen (selected) and the one the app actually has (applied), kept apart so that choosing never claims the
 * app changed and a failed update never claims success. One record per project, read by the plan card, the design
 * review and the Design tab alike; changes go through the existing token writers and snapshots.
 *
 * Projects from before this record keep their files and history: their base is read from the evidence they have (a
 * style capture that applied an industry direction is a legacy FlowCode default), never rewritten or credited to the
 * person. The Design tab also compares the app's real tokens with the applied direction and says when they differ.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SURFACES, appearanceChecks, appearanceProblems, appearanceTokens, type Appearance } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import { applyDesign, tokenValues } from "./designStudio.js";
import { setSurfaceStyle } from "./surfaceStyle.js";

/** Where a value came from: the person, a FlowCode theme, the PRD, or a FlowCode suggestion. */
export type DesignSource = "you" | `theme:${string}` | "prd" | "suggested" | "concept";

export interface DesignState {
  base: { source: "none" | "starter" | "legacy-default" | "unknown"; detail: string };
  draft?: { appearance: Appearance; sources: Partial<Record<keyof Appearance, DesignSource>>; updatedAt: string };
  selected?: { appearance: Appearance; sources: Partial<Record<keyof Appearance, DesignSource>>; version: number; selectedAt: string; by: "you" };
  applied?: { appearance: Appearance; version: number; appliedAt: string; snapshotIds: string[]; verification?: ApplyVerification };
  lastFailure?: { version: number; at: string; reason: string };
  /** Surface styles the person asked for in this project (FlowCode otherwise uses Flat or Tactile only). */
  surfaceExceptions: string[];
}

/** One check's outcome after an apply. "not_run" is never a pass. */
export type VerifyStatus = "passed" | "failed" | "not_run";
export interface VerifyCheck {
  kind: string;
  status: string;
  summary: string;
}
/**
 * What applying a direction to an existing app has and hasn't shown, kept apart: the files were updated (that is what
 * "applied" means); technical verification (typecheck, build); browser and functional verification (the preview, its
 * screenshots, the journey through the app); and the person's visual approval, which only they give. A check that
 * couldn't run is "not_run", not passed. A failed check doesn't undo the files: the snapshots in `applied` can.
 */
export interface ApplyVerification {
  version: number;
  at: string;
  file: "applied";
  technical: { status: VerifyStatus; checks: VerifyCheck[]; note?: string };
  browser: { status: VerifyStatus; checks: VerifyCheck[]; note?: string };
  human: "pending";
}

/** A group's status from its checks: failed if any failed or was blocked, passed only if every one passed, else not run. */
export function groupStatus(checks: VerifyCheck[]): VerifyStatus {
  if (checks.some((c) => c.status === "failed" || c.status === "blocked")) return "failed";
  if (checks.length && checks.every((c) => c.status === "passed")) return "passed";
  return "not_run";
}

/** Records what the checks after an apply showed, on the applied direction it belongs to (never on a later one). */
export function recordVerification(store: Store, projectId: string, v: ApplyVerification, jail?: PathJail): DesignState {
  const s = getDesignState(store, projectId, jail);
  if (!s.applied || s.applied.version !== v.version) return s;
  const next: DesignState = { ...s, applied: { ...s.applied, verification: v } };
  save(store, projectId, next);
  return next;
}

export const designStateKey = (projectId: string) => `designState:${projectId}`;
const TOKENS = "src/styles/tokens.css";
const now = () => new Date().toISOString();

/** Whether the project has an app whose styles can be changed (its tokens file). */
export const hasApp = (jail: PathJail) => fs.existsSync(path.join(jail.root, TOKENS));

/** The base, from evidence only (nothing is written): what renders when no direction was chosen. */
function baseOf(store: Store, projectId: string, jail?: PathJail): DesignState["base"] {
  if (!jail || !hasApp(jail)) return { source: "none", detail: "No app yet" };
  const capture = store.getSetting<{ sources?: string[] } | null>(`styleCapture:${projectId}`, null);
  const direction = capture?.sources?.find((s) => /design direction/.test(s));
  if (direction) return { source: "legacy-default", detail: `Legacy FlowCode default (${direction.replace(/^the /, "")})` };
  const choice = store.getSetting<{ id?: string; by?: string } | null>(`designChoice:${projectId}`, null);
  if (choice?.by === "you" || capture?.sources?.length) return { source: "unknown", detail: "Source not recorded" };
  return { source: "starter", detail: "Base styling — no brand direction selected" };
}

export function getDesignState(store: Store, projectId: string, jail?: PathJail): DesignState {
  const saved = store.getSetting<DesignState | null>(designStateKey(projectId), null);
  // The base is re-read each time (an app may have been scaffolded since); everything else is what was recorded.
  return { surfaceExceptions: [], ...(saved ?? {}), base: baseOf(store, projectId, jail) };
}

const save = (store: Store, projectId: string, s: DesignState) => store.setSetting(designStateKey(projectId), s);

export type DesignSources = NonNullable<DesignState["draft"]>["sources"];

export function saveDraft(store: Store, projectId: string, appearance: Appearance, sources: DesignSources, jail?: PathJail): DesignState {
  const s = getDesignState(store, projectId, jail);
  const problems = appearanceProblems(appearance, [...DEFAULT_SURFACES, ...s.surfaceExceptions]);
  if (problems.length) throw new Error(problems.join("; "));
  const next = { ...s, draft: { appearance, sources, updatedAt: now() } };
  save(store, projectId, next);
  return next;
}

export function discardDraft(store: Store, projectId: string, jail?: PathJail): DesignState {
  const { draft: _drop, ...rest } = getDesignState(store, projectId, jail);
  save(store, projectId, rest);
  return rest;
}

/** The person asks for another surface style in this project (recorded; FlowCode never infers one). */
export function allowSurface(store: Store, projectId: string, surface: string, jail?: PathJail): DesignState {
  const s = getDesignState(store, projectId, jail);
  const next = { ...s, surfaceExceptions: [...new Set([...s.surfaceExceptions, surface])] };
  save(store, projectId, next);
  return next;
}

/** The draft becomes the chosen direction (a new version). It is not applied to an app by this. */
export function selectDraft(store: Store, projectId: string, jail?: PathJail): DesignState {
  const s = getDesignState(store, projectId, jail);
  if (!s.draft) throw new Error("There's no draft to use");
  const version = (s.selected?.version ?? s.applied?.version ?? 0) + 1;
  const { draft, ...rest } = s;
  const next: DesignState = { ...rest, selected: { appearance: draft.appearance, sources: draft.sources, version, selectedAt: now(), by: "you" } };
  save(store, projectId, next);
  return next;
}

/**
 * Applies the selected direction to the app through the existing writers: the surface style, then the tokens (one
 * snapshot each). On any failure the snapshots taken are restored, the failure is recorded, and the previous applied
 * direction (and any draft) is kept. Applied is set only after every write succeeded.
 */
export function applySelected(
  store: Store,
  projectId: string,
  jail: PathJail,
  ops: FileOperations,
  ctx: { projectId: string; runId: string },
  restore: (snapshotId: string) => void,
): { state: DesignState; ok: boolean; reason?: string; changed: string[] } {
  const s = getDesignState(store, projectId, jail);
  if (!s.selected) throw new Error("No direction is selected");
  if (!hasApp(jail)) return { state: s, ok: false, reason: "This project has no app yet; the build applies the selected direction", changed: [] };
  const snapshots: string[] = [];
  const changed: string[] = [];
  try {
    const surface = setSurfaceStyle(jail, ops, ctx, s.selected.appearance.surface);
    snapshots.push(...surface.snapshotIds);
    changed.push(...surface.changed);
    // The appearance's own values (a dark appearance's are dark) go on the app's main theme.
    const res = applyDesign(jail, ops, ctx, { theme: "default", values: appearanceTokens(s.selected.appearance) });
    if (res.snapshotId) snapshots.push(res.snapshotId);
    if (res.changed.length) changed.push(TOKENS);
  } catch (err) {
    for (const id of [...snapshots].reverse()) {
      try {
        restore(id);
      } catch {
        // Best effort: the failure below still says the update didn't apply.
      }
    }
    const next: DesignState = { ...s, lastFailure: { version: s.selected.version, at: now(), reason: (err as Error).message } };
    save(store, projectId, next);
    return { state: next, ok: false, reason: (err as Error).message, changed: [] };
  }
  const { lastFailure: _done, ...rest } = s;
  const next: DesignState = { ...rest, applied: { appearance: s.selected.appearance, version: s.selected.version, appliedAt: now(), snapshotIds: snapshots } };
  save(store, projectId, next);
  return { state: next, ok: true, changed: [...new Set(changed)] };
}

/** The app's tokens that no longer match the applied direction (edits after it, or generated code). */
export function divergence(jail: PathJail, s: DesignState): string[] {
  if (!s.applied || !hasApp(jail)) return [];
  const want = appearanceTokens(s.applied.appearance);
  const have = tokenValues(jail, Object.keys(want));
  const flat = (v?: string) => (v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return Object.keys(want).filter((k) => k in have && flat(have[k]) !== flat(want[k]));
}

/** The plain label for the Design tab and the cards. */
export function stateLabel(s: DesignState, differs: string[]): string {
  if (s.applied && differs.length) return "The app's styles differ from the applied direction";
  if (s.applied && s.selected && s.selected.version > s.applied.version) return "A newer direction is selected, not yet applied";
  if (s.applied) {
    const v = s.applied.verification;
    if (!v) return "Applied (files updated; not verified)";
    if (v.technical.status === "failed" || v.browser.status === "failed") return "Applied (files updated); a check after it failed";
    if (v.technical.status === "passed" && v.browser.status === "passed") return "Applied and checked; your visual approval is pending";
    return "Applied (files updated); some checks not run";
  }
  if (s.selected) return s.lastFailure?.version === s.selected.version ? "Selected; the last update failed" : "Selected, not yet applied";
  if (s.base.source === "legacy-default") return s.base.detail;
  if (s.base.source === "unknown") return "No brand direction selected (source of the current styles not recorded)";
  if (s.base.source === "none") return "No brand direction selected";
  return "Base styling — no brand direction selected";
}

export function describeState(store: Store, projectId: string, jail?: PathJail) {
  const s = getDesignState(store, projectId, jail);
  const differs = jail ? divergence(jail, s) : [];
  const current = s.draft?.appearance ?? s.selected?.appearance;
  return { ...s, hasApp: !!jail && hasApp(jail), differs, label: stateLabel(s, differs), checks: current ? appearanceChecks(current) : [] };
}
