/**
 * What a recorded check actually tells the user. "Skipped" in the store covers two different things: a check that
 * wasn't needed, and one that couldn't run (no credit, model unreachable, browser missing). Only the first is harmless;
 * the second means that part of the work was never verified, and must never read as a pass.
 */
import { checkCouldNotRun, type VerificationCheck } from "@flowcode/contracts";

export type CheckState = "passed" | "passed_with_warnings" | "failed" | "skipped" | "unavailable" | "not_run";

export function checkState(c: Pick<VerificationCheck, "status" | "summary">): CheckState {
  switch (c.status) {
    case "passed":
      return "passed";
    case "passed_with_warnings":
      return "passed_with_warnings";
    case "failed":
    case "blocked":
      return "failed";
    case "skipped":
      return checkCouldNotRun(c.status, c.summary) ? "unavailable" : "skipped";
    default:
      return "not_run";
  }
}

export const CHECK_STATE_LABEL: Record<CheckState, string> = {
  passed: "Passed",
  passed_with_warnings: "Passed with warnings",
  failed: "Failed",
  skipped: "Skipped (not needed)",
  unavailable: "Couldn't run",
  not_run: "Not run",
};

/** Plain names for check kinds. */
export const CHECK_NAME: Record<string, string> = {
  lint: "code-style check",
  typecheck: "type check",
  tests: "tests",
  build: "build",
  design_qa: "design check (rules)",
  visual_critique: "visual review",
  accessibility: "accessibility check",
  app_wiring: "app wiring check",
  server_start: "dev server start",
  preview_health: "live preview",
  screenshots: "screenshots",
  spec_fidelity: "match to the spec",
  security_scan: "security scan",
};

export const checkName = (kind: string) => CHECK_NAME[kind] ?? kind.replace(/_/g, " ");

/**
 * Whether a finished run's verification is complete. A run can finish ("done") with a check that couldn't run; that is
 * "incomplete", not verified.
 */
export function verificationCompleteness(checks: Array<Pick<VerificationCheck, "status" | "summary" | "kind">>): "complete" | "incomplete" | "not_run" {
  if (!checks.length) return "not_run";
  const states = checks.map(checkState);
  if (states.includes("unavailable") || states.includes("not_run") || states.includes("failed")) return "incomplete";
  return "complete";
}

/** The newest record per check kind (a re-run replaces the earlier result). */
export function latestRunChecks<T extends Pick<VerificationCheck, "kind" | "taskId" | "updatedAt">>(checks: T[]): T[] {
  const by = new Map<string, T>();
  for (const c of checks) {
    if (c.taskId) continue;
    const prev = by.get(c.kind);
    if (!prev || (c.updatedAt ?? "") >= (prev.updatedAt ?? "")) by.set(c.kind, c);
  }
  return [...by.values()];
}
