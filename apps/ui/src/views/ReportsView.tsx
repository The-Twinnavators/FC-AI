/** Run reports (FR-O1, FR-O3): one project's runs with their normalized reports and Markdown/PDF export. Shown as a tab on a project's page in My Projects. */
import { RunCompare } from "../components/RunCompare";
import { useEffect, useState } from "react";
import type { Run } from "@flowcode/contracts";
import { artifactUrl, get, post, useResource } from "../api";
import { Empty, Led, StatusChip } from "../components/ui";
import { statusLabel } from "@flowcode/contracts";
import { Markdown } from "../components/Markdown";
import { navigate } from "../router";

/** Builds grouped by day, newest first ("Today", "Yesterday", then the date). */
function groups(runs: Run[]): Array<[string, Run[]]> {
  const out = new Map<string, Run[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  for (const r of [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const d = new Date(r.createdAt);
    const key = d.toDateString() === today ? "Today" : d.toDateString() === yesterday ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    (out.get(key) ?? out.set(key, []).get(key)!).push(r);
  }
  return [...out.entries()];
}

export function RunReports({ projectId, runId: routeRunId }: { projectId: string; runId?: string }) {
  const runs = useResource<Run[]>("/runs", [projectId]);
  const mine = (runs.data ?? []).filter((r) => r.projectId === projectId);
  // No build chosen yet: show the newest build's report rather than an empty panel.
  const runId = routeRunId ?? [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
  const report = useResource<{ markdown: string | null }>(runId ? `/runs/${runId}/report` : null, [runId]);
  const [busy, setBusy] = useState<string>();
  const [compareWith, setCompareWith] = useState<string>();
  const [error, setError] = useState<string>();
  const select = (id: string) => navigate(`/quality/${projectId}/reports/${id}`);
  const current = mine.find((r) => r.id === runId);
  const exportAs = async (format: "markdown" | "pdf") => {
    if (!runId) return;
    setBusy(format);
    setError(undefined);
    try {
      const r = await post<{ artifactId: string }>(`/runs/${runId}/report/export`, { format });
      window.open(artifactUrl(r.artifactId), "_blank");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div className="run-reports">
      {error ? <p role="alert" className="notice notice--bad">{error}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 340px) 1fr", gap: 16, alignItems: "start" }} className="run-reports__grid">
        {/* A picker, not a report: each build is a row you open; the report shows on the right. */}
        <nav className="rr-picker" aria-label="Builds in this project">
          <div className="rr-picker__head">
            <h2 className="rr-picker__title">
              Builds <span className="rr-picker__count">{mine.length}</span>
            </h2>
            <p className="rr-picker__hint">Choose a build to read its report.</p>
          </div>
          {mine.length ? (
            groups(mine).map(([day, items]) => (
              <section key={day} className="rr-picker__group" aria-label={day}>
                <h3 className="rr-picker__day">{day}</h3>
                <ul className="rr-picker__list">
                  {items.map((r) => (
                    <li key={r.id}>
                      <button type="button" className={`rr-row${r.id === runId ? " is-current" : ""}`} aria-current={r.id === runId ? "page" : undefined} onClick={() => select(r.id)}>
                        <Led status={r.status} />
                        <span className="rr-row__text">
                          <span className="rr-row__title">{r.objective.replace(/^#+\s*/, "").split("\n")[0].slice(0, 90)}</span>
                          <span className="rr-row__meta">
                            {statusLabel(r.status)} · {new Date(r.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>
                        <span className="rr-row__go" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <div style={{ padding: 16 }}>
              <Empty title={runs.loading ? "Finding your build reports…" : "No build reports yet"} illustration={runs.loading ? undefined : "empty"}>{runs.loading ? null : "Each build writes a report of what it did and checked. Start a prototype from the Dashboard to see one here."}</Empty>
            </div>
          )}
        </nav>
        <section className="section" style={{ minWidth: 0 }}>
          {runId ? (
            <div className="section__head rr-head" style={{ gap: 8 }} data-guide="reports.export">
              <span className="rr-head__title">
                <span className="label">Report</span>
                <strong>{current ? current.objective.replace(/^#+\s*/, "").split("\n")[0].slice(0, 90) : ""}</strong>
              </span>
              {current ? <StatusChip status={current.status} dot /> : null}
              <span style={{ marginLeft: "auto" }} />
              {mine.length > 1 ? (
                <select className="select rr-compare" data-cp="compare-with" aria-label="Compare this build with another" value={compareWith ?? ""} onChange={(e) => setCompareWith(e.target.value || undefined)}>
                  <option value="">Compare with…</option>
                  {mine
                    .filter((x) => x.id !== runId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {new Date(x.createdAt).toLocaleDateString()} · {x.objective.replace(/^#+\s*/, "").split("\n")[0].slice(0, 50)}
                      </option>
                    ))}
                </select>
              ) : null}
              <button className="btn btn--sm" disabled={!!busy || !report.data?.markdown} onClick={() => exportAs("markdown")}>
                Export Markdown
              </button>
              <button className="btn btn--sm btn--primary" disabled={!!busy || !report.data?.markdown} onClick={() => exportAs("pdf")}>
                {busy === "pdf" ? "Rendering PDF…" : "Export PDF"}
              </button>
            </div>
          ) : null}
          <div className="section__body">
            {runId && compareWith ? <RunCompare a={runId} b={compareWith} onClose={() => setCompareWith(undefined)} /> : null}
            {!runId ? (
              <p className="muted">Pick a run to read its report. Reports are built from what actually happened (tasks, commands, approvals, snapshots and checks), not from what the model said.</p>
            ) : report.data?.markdown ? (
              <Markdown source={report.data.markdown} />
            ) : (
              <p className="muted">No report yet. Reports are written when a run finishes its checks.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Old /reports links: open the run's report on its project's page in My Projects. */
export function ReportsRedirect({ runId }: { runId?: string }) {
  useEffect(() => {
    // Replace, not push, so Back skips the old address.
    const go = (path: string) => location.replace(`${location.pathname}${location.search}#${path}`);
    if (!runId) return void go("/quality");
    get<{ run: Run }>(`/runs/${runId}`)
      .then((v) => go(`/quality/${v.run.projectId}/reports/${runId}`))
      .catch(() => go("/quality"));
  }, [runId]);
  return null;
}
