/**
 * Prompts & skills overview: a four-stage pipeline (Define → Match → Run → Verify) with activity over a window,
 * plus summary cards. Built from the event log and the versioned library; nothing is sampled or estimated.
 */
import type { App } from "../app.js";
import { ACTIVE_ROLES, appliesToRole } from "@flowcode/contracts";

export type LibWindow = "24h" | "7d" | "30d";

const PROMPT_ROLES = new Set(["planner", "coder", "debugger", "critic", "researcher", "documenter"]);
// Only the agents that run: a skill for "designer" counts for the Coder, and so on (agentRoles.ts).
const ALL_ROLES = [...ACTIVE_ROLES];

export function libraryStats(app: App, window: LibWindow) {
  const DAY = 86_400_000;
  const now = Date.now();
  const span = window === "24h" ? DAY : window === "7d" ? 7 * DAY : 30 * DAY;
  const buckets = window === "24h" ? 24 : window === "7d" ? 28 : 30;
  const size = span / buckets;
  const since = new Date(now - span).toISOString();
  const at = (iso: string) => Math.min(buckets - 1, Math.max(0, Math.floor((new Date(iso).getTime() - (now - span)) / size)));
  const series = () => new Array<number>(buckets).fill(0);
  const db = app.store.db;

  // Define: new prompt and skill versions.
  const define = series();
  const versionRows = [
    ...db.all<{ created_at: string }>("SELECT created_at FROM prompt_versions WHERE created_at >= ?", since),
    ...db.all<{ created_at: string }>("SELECT created_at FROM skill_versions WHERE created_at >= ?", since),
  ];
  for (const r of versionRows) define[at(r.created_at)]++;

  // Match: skills given to agents for a task.
  const match = series();
  const skillUse = new Map<string, number>();
  const skilledTasks = new Set<string>();
  for (const r of db.all<{ data: string; created_at: string }>("SELECT data, created_at FROM events WHERE type = 'skill.applied' AND created_at >= ?", since)) {
    const e = JSON.parse(r.data) as { taskId?: string; data?: { skills?: string[] } };
    const skills = e.data?.skills ?? [];
    match[at(r.created_at)] += skills.length || 1;
    for (const s of skills) skillUse.set(s.split("@")[0], (skillUse.get(s.split("@")[0]) ?? 0) + 1);
    if (e.taskId) skilledTasks.add(e.taskId);
  }

  // Run: model requests made with the role prompts.
  const run = series();
  for (const r of db.all<{ data: string; created_at: string }>("SELECT data, created_at FROM events WHERE type = 'model.completed' AND created_at >= ?", since)) {
    const role = (JSON.parse(r.data) as { data?: { role?: string } }).data?.role;
    if (role && PROMPT_ROLES.has(role)) run[at(r.created_at)]++;
  }

  // Verify: tasks that used skills and passed verification.
  const verify = series();
  let verifiedWithSkills = 0;
  for (const r of db.all<{ data: string; created_at: string }>("SELECT data, created_at FROM events WHERE type = 'task.verified' AND created_at >= ?", since)) {
    const id = (JSON.parse(r.data) as { taskId?: string }).taskId;
    if (id && skilledTasks.has(id)) {
      verify[at(r.created_at)]++;
      verifiedWithSkills++;
    }
  }

  const prompts = app.store.prompts.list("updated_at DESC", 500);
  const skills = app.store.skills.list("updated_at DESC", 500);
  const totalVersions = Number((db.get<{ n: number }>("SELECT (SELECT COUNT(*) FROM prompt_versions) + (SELECT COUNT(*) FROM skill_versions) AS n") ?? { n: 0 }).n);
  const enabled = skills.filter((s) => s.enabled !== false);
  const covered = ALL_ROLES.filter((role) => enabled.some((s) => appliesToRole(s.roles, role)));
  const top = [...skillUse.entries()].sort((a, b) => b[1] - a[1])[0];
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

  return {
    window,
    stages: [
      { id: "define", label: "Library", sub: "Prompts & Skills you saved or updated", total: sum(define), series: define },
      { id: "match", label: "Agents pick skills", sub: "Skills matched to a build task", total: sum(match), series: match },
      { id: "run", label: "Agents work", sub: "Planner, coder & debugger turns", total: sum(run), series: run },
      { id: "verify", label: "Checks pass", sub: "Skilled tasks FlowCode verified", total: sum(verify), series: verify },
    ],
    cards: {
      prompts: { total: prompts.length, yours: prompts.filter((p) => !p.id.startsWith("role.") && !p.id.startsWith("coder.")).length, edited: prompts.filter((p) => p.changelog.some((c) => /edited in library/i.test(c.note))).length },
      skills: { total: skills.length, on: enabled.length, yours: skills.filter((s) => s.source === "user").length },
      applied: sum(match),
      tasksWithSkills: skilledTasks.size,
      verifiedRate: skilledTasks.size ? verifiedWithSkills / skilledTasks.size : 0,
      topSkill: top ? { id: top[0], count: top[1] } : null,
      promptRuns: sum(run),
      versions: { total: totalVersions, recent: sum(define) },
      roles: { covered: covered.length, total: ALL_ROLES.length },
    },
  };
}
