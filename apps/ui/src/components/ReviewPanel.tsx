/**
 * Review: what changed, what was checked, and what needs attention, for the build on screen. A plain summary first,
 * then distinct sections, never one mixed feed: changes made (files by step, with diffs and undo), checks and results,
 * what needs attention, what couldn't run or was skipped, and what to do next. Diffs live in "Changes made";
 * raw runtime events live in Technical output.
 */
import { useDisplayMode } from "../displayMode";
import type { ReactNode } from "react";
import { CHECKS, checkCouldNotRun, type Task, type VerificationCheck } from "@flowcode/contracts";
import { post, useResource } from "../api";

interface Facts {
  blocked: Array<{ taskId: string; title: string; explanation: string; decision?: string; actions: Array<{ kind: string; label: string }> }>;
  runReason?: string;
  finished: boolean;
  verification: "complete" | "incomplete" | "not_run";
}

const name = (kind: string) => CHECKS[kind]?.name ?? kind.replace(/_/g, " ");
const latest = (checks: VerificationCheck[]) => {
  const by = new Map<string, VerificationCheck>();
  for (const c of checks) if (!c.taskId && (!by.get(c.kind) || c.updatedAt >= by.get(c.kind)!.updatedAt)) by.set(c.kind, c);
  return [...by.values()];
};

export function ReviewPanel({ runId, checks, tasks, changes, onChanged }: { runId: string; checks: VerificationCheck[]; tasks: Task[]; changes: ReactNode; onChanged: () => void }) {
  const technical = useDisplayMode() === "technical";
  // Technical mode: full check output instead of its first line.
  const detail = (s: string) => (technical ? s.slice(0, 2000) : s.split("\n")[0].slice(0, 220));
  const facts = useResource<Facts>(`/runs/${runId}/facts`, [runId, tasks.map((t) => t.status).join()]);
  const all = latest(checks);
  const couldNot = all.filter((c) => checkCouldNotRun(c.status, c.summary));
  const skipped = all.filter((c) => c.status === "skipped" && !checkCouldNotRun(c.status, c.summary));
  const failed = all.filter((c) => c.status === "failed" || c.status === "blocked");
  const passed = all.filter((c) => c.status === "passed" || c.status === "passed_with_warnings");
  const notes = all.filter((c) => c.status === "passed_with_warnings");
  const waiting = all.filter((c) => c.status === "not_run" || c.status === "pending" || c.status === "running");
  const changedSteps = tasks.filter((t) => t.actualPaths.length);
  const stopped = facts.data?.blocked ?? [];

  const summary = [
    changedSteps.length ? `${changedSteps.length} step${changedSteps.length === 1 ? "" : "s"} changed ${new Set(changedSteps.flatMap((t) => t.actualPaths)).size} file${new Set(changedSteps.flatMap((t) => t.actualPaths)).size === 1 ? "" : "s"}.` : "No files changed yet.",
    all.length ? `${passed.length} of ${all.length} checks passed${failed.length ? `, ${failed.length} failed` : ""}${couldNot.length ? `, ${couldNot.length} couldn't run` : ""}.` : "No checks have run yet.",
    failed.length || stopped.length ? "Something needs your attention below." : couldNot.length ? "Part of the work isn't verified: see “Couldn't run”." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rerun = async (kind: string) => {
    await post(`/runs/${runId}/checks/${kind}/rerun`, {});
    onChanged();
  };

  return (
    <div className="review">
      <p className="review__summary">{summary}</p>

      {failed.length || stopped.length || facts.data?.runReason ? (
        <section className="review__section" aria-labelledby="rv-attn">
          <h3 className="review__h" id="rv-attn">
            Needs attention
          </h3>
          <ul className="review__list">
            {stopped.map((b) => (
              <li key={b.taskId} className="review__item">
                <strong className="review__item-title">“{b.title}” stopped</strong>
                <span>{b.explanation}</span>
                {b.decision ? <span className="review__decision">You decide: {b.decision}</span> : null}
              </li>
            ))}
            {facts.data?.runReason && !stopped.length ? (
              <li className="review__item">
                <strong className="review__item-title">The build stopped</strong>
                <span>{facts.data.runReason}</span>
              </li>
            ) : null}
            {failed.map((c) => (
              <li key={c.kind} className="review__item">
                <strong className="review__item-title">{name(c.kind)} failed</strong>
                <span className="review__support">{detail(c.summary)}</span>
                <button type="button" className="btn btn--sm review__act" onClick={() => void rerun(c.kind)}>
                  Run it again
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {couldNot.length || skipped.length ? (
        <section className="review__section" aria-labelledby="rv-unv">
          <h3 className="review__h" id="rv-unv">
            Couldn't run or skipped
          </h3>
          <ul className="review__list">
            {couldNot.map((c) => (
              <li key={c.kind} className="review__item">
                <strong className="review__item-title">{name(c.kind)}: couldn't run, so this part isn't verified</strong>
                <span className="review__support">{detail(c.summary)}</span>
                <button type="button" className="btn btn--sm review__act" onClick={() => void rerun(c.kind)}>
                  Try again
                </button>
              </li>
            ))}
            {skipped.map((c) => (
              <li key={c.kind} className="review__item">
                <strong className="review__item-title">{name(c.kind)}: skipped (not needed for this build)</strong>
                <span className="review__support">{detail(c.summary)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="review__section" aria-labelledby="rv-checks">
        <h3 className="review__h" id="rv-checks">
          Checks and results
        </h3>
        {all.length ? (
          <ul className="review__checks">
            {all.map((c) => {
              const state = checkCouldNotRun(c.status, c.summary) ? "Couldn't run" : c.status === "passed" ? "Passed" : c.status === "passed_with_warnings" ? "Passed, with notes" : c.status === "failed" || c.status === "blocked" ? "Failed" : c.status === "skipped" ? "Skipped" : "Not run yet";
              return (
                <li key={c.kind}>
                  <span>{name(c.kind)}</span>
                  <span className={`review__state review__state--${state.split(/[ ,]/)[0].toLowerCase().replace(/'/g, "")}`}>{state}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="review__support">Checks run when a build finishes its steps.</p>
        )}
        {notes.length ? <p className="review__support">Notes on: {notes.map((c) => name(c.kind)).join(", ")}. Open the final report for the details.</p> : null}
        {waiting.length ? <p className="review__support">Not run yet: {waiting.map((c) => name(c.kind)).join(", ")}.</p> : null}
      </section>

      <section className="review__section" aria-labelledby="rv-changes">
        <h3 className="review__h" id="rv-changes">
          Changes made
        </h3>
        {changedSteps.length ? (
          <ul className="review__list">
            {changedSteps.map((t) => (
              <li key={t.id} className="review__item">
                <strong className="review__item-title">{t.title}</strong>
                <span className="review__files mono">{t.actualPaths.slice(0, 6).join("  ")}{t.actualPaths.length > 6 ? ` +${t.actualPaths.length - 6} more` : ""}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <details className="review__more" open={technical}>
          <summary>Every file, with diffs and undo</summary>
          {changes}
        </details>
      </section>
    </div>
  );
}
