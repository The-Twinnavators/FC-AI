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
import { DEFAULT_SURFACES, LOOK_GROUP_IDS, appearanceChecks, appearanceProblems, appearanceTokens, motionTokens, sameAppearance, withLocks, type Appearance } from "@flowcode/contracts";

/** The appearance's tokens this app takes: without the motion tokens where the app has no motion foundation. */
function tokensFor(jail: PathJail, a: Appearance): Record<string, string> {
  const t = appearanceTokens(a);
  if (a.motion && !motionSupported(jail)) for (const k of Object.keys(motionTokens(a.motion.level))) delete t[k];
  return t;
}
import type { Store } from "../db/store.js";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import { applyDesign, tokenValues } from "./designStudio.js";
import { setSurfaceStyle } from "./surfaceStyle.js";
import { MOTION_UNSUPPORTED, motionSupported, setMotionStyle } from "./motionStyle.js";

/** Where a value came from: the person, a FlowCode theme, the PRD, or a FlowCode suggestion. */
export type DesignSource = "you" | `theme:${string}` | "prd" | "suggested" | "concept";

export interface DesignState {
  base: { source: "none" | "starter" | "legacy-default" | "unknown"; detail: string };
  /** `notes`: the person's words the tokens can't carry (layout, section order, what to leave out), for the design build. */
  draft?: { appearance: Appearance; sources: Partial<Record<keyof Appearance, DesignSource>>; updatedAt: string; notes?: string[] };
  selected?: { appearance: Appearance; sources: Partial<Record<keyof Appearance, DesignSource>>; version: number; selectedAt: string; by: "you"; notes?: string[] };
  applied?: { appearance: Appearance; version: number; appliedAt: string; snapshotIds: string[]; verification?: ApplyVerification; notes?: string[] };
  lastFailure?: { version: number; at: string; reason: string };
  /** Surface styles the person asked for in this project (FlowCode otherwise uses Flat or Tactile only). */
  surfaceExceptions: string[];
  /** Groups of the Look the person locked (designDirection.LOOK_GROUPS): a draft can't change them. */
  locks?: string[];
  /** Every direction the person chose, newest last (up to 30), to compare and to restore as a draft. */
  versions?: Array<{ version: number; appearance: Appearance; sources: Partial<Record<keyof Appearance, DesignSource>>; selectedAt: string; notes?: string[] }>;
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

export function saveDraft(store: Store, projectId: string, appearance: Appearance, sources: DesignSources, jail?: PathJail, notes?: string[]): DesignState {
  const s = getDesignState(store, projectId, jail);
  const problems = appearanceProblems(appearance, [...DEFAULT_SURFACES, ...s.surfaceExceptions]);
  if (problems.length) throw new Error(problems.join("; "));
  // A locked group keeps what the person saw when they locked it (the current draft, else the chosen direction),
  // whatever a later draft says: the lock holds on the server too.
  const kept = withLocks(appearance, s.draft?.appearance ?? s.selected?.appearance ?? s.applied?.appearance, s.locks ?? []);
  // Notes not given: the draft keeps the ones it has (else the chosen direction's).
  const keptNotes = notes ?? s.draft?.notes ?? s.selected?.notes ?? s.applied?.notes;
  const next = { ...s, draft: { appearance: kept, sources, updatedAt: now(), ...(keptNotes?.length ? { notes: keptNotes } : {}) } };
  save(store, projectId, next);
  return next;
}

export function discardDraft(store: Store, projectId: string, jail?: PathJail): DesignState {
  const { draft: _drop, ...rest } = getDesignState(store, projectId, jail);
  save(store, projectId, rest);
  return rest;
}

/** The groups the person locked; only known groups are kept. */
export function setLocks(store: Store, projectId: string, locks: string[], jail?: PathJail): DesignState {
  const s = getDesignState(store, projectId, jail);
  const next = { ...s, locks: [...new Set(locks)].filter((l) => (LOOK_GROUP_IDS as string[]).includes(l)) };
  save(store, projectId, next);
  return next;
}

/** An earlier chosen direction comes back as the draft (nothing is applied by this); locked groups stay as they are. */
export function restoreVersion(store: Store, projectId: string, version: number, jail?: PathJail): DesignState {
  const s = getDesignState(store, projectId, jail);
  const v =
    (s.versions ?? []).find((x) => x.version === version) ??
    (s.selected?.version === version ? s.selected : s.applied?.version === version ? { appearance: s.applied.appearance, sources: {}, notes: s.applied.notes } : undefined);
  if (!v) throw new Error(`Version ${version} isn't in this project's saved directions`);
  return saveDraft(store, projectId, v.appearance, v.sources, jail, v.notes ?? []);
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
  const selectedAt = now();
  // The directions chosen before the history existed (the selected and the applied one) are kept before the new one.
  const versions = [...(s.versions ?? [])];
  for (const v of [s.applied && { version: s.applied.version, appearance: s.applied.appearance, sources: {}, selectedAt: s.applied.appliedAt, notes: s.applied.notes }, s.selected && { version: s.selected.version, appearance: s.selected.appearance, sources: s.selected.sources, selectedAt: s.selected.selectedAt, notes: s.selected.notes }])
    if (v && !versions.some((x) => x.version === v.version)) versions.push(v);
  versions.sort((x, y) => x.version - y.version);
  const notes = draft.notes?.length ? { notes: draft.notes } : {};
  versions.push({ version, appearance: draft.appearance, sources: draft.sources, selectedAt, ...notes });
  versions.splice(0, Math.max(0, versions.length - 30));
  const next: DesignState = { ...rest, selected: { appearance: draft.appearance, sources: draft.sources, version, selectedAt, by: "you", ...notes }, versions };
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
): { state: DesignState; ok: boolean; reason?: string; changed: string[]; notes?: string[] } {
  const s = getDesignState(store, projectId, jail);
  if (!s.selected) throw new Error("No direction is selected");
  if (!hasApp(jail)) return { state: s, ok: false, reason: "This project has no app yet; the build applies the selected direction", changed: [] };
  const snapshots: string[] = [];
  const changed: string[] = [];
  const want = s.selected.appearance;
  // Only the motion level changed since the last apply: only motion is written, so colours, fonts, surface and layout
  // (and any advanced token edits since) stay exactly as they are.
  const sameExceptMotion = !!s.applied && sameAppearance({ ...s.applied.appearance, motion: undefined }, { ...want, motion: undefined });
  const motionOnly = sameExceptMotion && !sameAppearance(s.applied!.appearance, want);
  // Motion goes only where the app has the foundation (React); elsewhere it's left out and said so, not half-applied.
  const withMotion = !!want.motion && motionSupported(jail);
  const notes = want.motion && !withMotion ? [MOTION_UNSUPPORTED] : [];
  try {
    if (motionOnly) {
      if (withMotion) {
        const motion = setMotionStyle(jail, ops, ctx);
        snapshots.push(...motion.snapshotIds);
        changed.push(...motion.changed);
        const res = applyDesign(jail, ops, ctx, { theme: "default", values: motionTokens(want.motion!.level) });
        if (res.snapshotId) snapshots.push(res.snapshotId);
        if (res.changed.length) changed.push(TOKENS);
      }
    } else {
      // The surface first: it is what refuses an app without FlowCode's building blocks, before anything else is written.
      const surface = setSurfaceStyle(jail, ops, ctx, want.surface);
      snapshots.push(...surface.snapshotIds);
      changed.push(...surface.changed);
      if (withMotion) {
        const motion = setMotionStyle(jail, ops, ctx);
        snapshots.push(...motion.snapshotIds);
        changed.push(...motion.changed);
      }
      // The appearance's own values (a dark appearance's are dark) go on the app's main theme. A direction without a
      // motion level (made before motion existed) leaves the app's motion as it is.
      const res = applyDesign(jail, ops, ctx, { theme: "default", values: tokensFor(jail, want) });
      if (res.snapshotId) snapshots.push(res.snapshotId);
      if (res.changed.length) changed.push(TOKENS);
    }
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
  const next: DesignState = { ...rest, applied: { appearance: s.selected.appearance, version: s.selected.version, appliedAt: now(), snapshotIds: snapshots, ...(s.selected.notes?.length ? { notes: s.selected.notes } : {}) } };
  save(store, projectId, next);
  return { state: next, ok: true, changed: [...new Set(changed)], ...(notes.length ? { notes } : {}) };
}

/** The app's tokens that no longer match the applied direction (edits after it, or generated code). */
export function divergence(jail: PathJail, s: DesignState): string[] {
  if (!s.applied || !hasApp(jail)) return [];
  const want = tokensFor(jail, s.applied.appearance);
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
  // Directions chosen before the history was kept still show: the selected and the applied one.
  const versions = [...(s.versions ?? [])];
  for (const v of [s.applied && { version: s.applied.version, appearance: s.applied.appearance, sources: {}, selectedAt: s.applied.appliedAt, notes: s.applied.notes }, s.selected && { version: s.selected.version, appearance: s.selected.appearance, sources: s.selected.sources, selectedAt: s.selected.selectedAt, notes: s.selected.notes }])
    if (v && !versions.some((x) => x.version === v.version)) versions.push(v);
  versions.sort((x, y) => x.version - y.version);
  return { ...s, versions, locks: s.locks ?? [], hasApp: !!jail && hasApp(jail), motionSupported: !jail || !hasApp(jail) || motionSupported(jail), differs, label: stateLabel(s, differs), checks: current ? appearanceChecks(current) : [] };
}
