/** Time series for dashboards — computed from recorded runs, tasks, tool calls, checks and knowledge. */
import { isFinishedRun } from "@flowcode/contracts";
import type { App } from "../app.js";

export type Range = "7d" | "30d" | "90d" | "all";

export function timeseries(app: App, range: Range) {
  const now = Date.now();
  const first = app.db.get<{ m: string | null }>("SELECT MIN(created_at) AS m FROM events")?.m;
  const startAll = first ? new Date(first).getTime() : now - 7 * 86_400_000;
  const span = range === "7d" ? 7 * 86_400_000 : range === "30d" ? 30 * 86_400_000 : range === "90d" ? 90 * 86_400_000 : Math.max(now - startAll, 86_400_000);
  const start = now - span;
  const buckets = 48;
  const size = span / buckets;
  const idx = (iso: string) => Math.min(buckets - 1, Math.max(0, Math.floor((new Date(iso).getTime() - start) / size)));
  const since = new Date(start).toISOString();
  const series = {
    runs: new Array<number>(buckets).fill(0),
    verified: new Array<number>(buckets).fill(0),
    toolCalls: new Array<number>(buckets).fill(0),
    knowledge: new Array<number>(buckets).fill(0),
  };
  for (const r of app.db.all<{ created_at: string }>("SELECT created_at FROM runs WHERE created_at >= ?", since)) series.runs[idx(r.created_at)]++;
  for (const r of app.db.all<{ created_at: string }>("SELECT created_at FROM events WHERE type = 'task.verified' AND created_at >= ?", since)) series.verified[idx(r.created_at)]++;
  for (const r of app.db.all<{ created_at: string }>("SELECT created_at FROM tool_calls WHERE created_at >= ?", since)) series.toolCalls[idx(r.created_at)]++;
  const byKind: Record<string, number[]> = {};
  for (const r of app.db.all<{ created_at: string; kind: string }>("SELECT created_at, kind FROM knowledge WHERE created_at >= ?", since)) {
    series.knowledge[idx(r.created_at)]++;
    (byKind[r.kind] ??= new Array<number>(buckets).fill(0))[idx(r.created_at)]++;
  }
  const cumulative = (xs: number[], base = 0) => xs.reduce<number[]>((acc, v) => (acc.push((acc.at(-1) ?? base) + v), acc), []);
  const before = (sql: string) => app.db.get<{ n: number }>(sql, since)?.n ?? 0;
  const base = {
    runs: before("SELECT COUNT(*) AS n FROM runs WHERE created_at < ?"),
    verified: before("SELECT COUNT(*) AS n FROM events WHERE type = 'task.verified' AND created_at < ?"),
    toolCalls: before("SELECT COUNT(*) AS n FROM tool_calls WHERE created_at < ?"),
    knowledge: before("SELECT COUNT(*) AS n FROM knowledge WHERE created_at < ?"),
  };
  const checks = app.db.all<{ status: string }>("SELECT json_extract(data, '$.status') AS status FROM verification_checks");
  const passed = checks.filter((c) => c.status === "passed" || c.status === "passed_with_warnings").length;
  const decided = checks.filter((c) => !["pending", "running", "not_run"].includes(c.status)).length;
  const tasks = app.db.all<{ status: string }>("SELECT status FROM tasks");
  const runs = app.db.all<{ status: string }>("SELECT status FROM runs");
  const coder = app.router.roleAssignments().coder;
  const elig = coder ? app.lab.coderEligibility(coder) : undefined;
  return {
    range,
    start: new Date(start).toISOString(),
    end: new Date(now).toISOString(),
    buckets,
    cumulative: {
      runs: cumulative(series.runs, base.runs),
      verified: cumulative(series.verified, base.verified),
      toolCalls: cumulative(series.toolCalls, base.toolCalls),
      knowledge: cumulative(series.knowledge, base.knowledge),
    },
    daily: series,
    knowledgeByKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, cumulative(v)])),
    totals: {
      runs: runs.length,
      runsDone: runs.filter((r) => isFinishedRun(r.status)).length,
      tasks: tasks.length,
      tasksVerified: tasks.filter((t) => t.status === "verified").length,
      checksPassRate: decided ? passed / decided : 0,
      checksDecided: decided,
      toolCalls: app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM tool_calls")?.n ?? 0,
      knowledge: app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM knowledge")?.n ?? 0,
      pendingApprovals: app.approvals.pending().length,
      coderReady: !!elig?.eligible,
      coderModel: coder?.model ?? null,
    },
  };
}
