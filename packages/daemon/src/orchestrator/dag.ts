/**
 * Implementation dependency graph (FR-V3). Persists task dependencies and exit criteria; a blocked or
 * failed prerequisite invalidates all downstream tasks and their verification.
 */
import type { Task, TaskStatus } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";

const DONE: TaskStatus[] = ["verified", "skipped"];
const DEAD: TaskStatus[] = ["blocked", "failed", "invalidated"];

export class TaskGraph {
  constructor(
    private store: Store,
    private bus: EventBus,
  ) {}

  tasks(runId: string): Task[] {
    return this.store.tasks.where("run_id = ? ORDER BY ordinal ASC", runId);
  }

  save(task: Task): Task {
    const t = this.store.tasks.upsert(task);
    this.store.db.run("DELETE FROM task_edges WHERE task_id = ?", t.id);
    for (const d of t.dependsOn) this.store.db.run("INSERT OR IGNORE INTO task_edges (run_id, task_id, depends_on) VALUES (?, ?, ?)", t.runId, t.id, d);
    return t;
  }

  /** Throws if the dependency graph has a cycle or dangling references. */
  validate(tasks: Pick<Task, "id" | "dependsOn">[]) {
    const ids = new Set(tasks.map((t) => t.id));
    for (const t of tasks) for (const d of t.dependsOn) if (!ids.has(d)) throw new Error(`Task ${t.id} depends on unknown task ${d}`);
    const state = new Map<string, number>();
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const visit = (id: string) => {
      if (state.get(id) === 2) return;
      if (state.get(id) === 1) throw new Error(`Dependency cycle at ${id}`);
      state.set(id, 1);
      for (const d of byId.get(id)!.dependsOn) visit(d);
      state.set(id, 2);
    };
    tasks.forEach((t) => visit(t.id));
  }

  /** Next task whose prerequisites are all verified/skipped. */
  next(runId: string): Task | undefined {
    const tasks = this.tasks(runId);
    const status = new Map(tasks.map((t) => [t.id, t.status]));
    return tasks.find((t) => (t.status === "pending" || t.status === "attempted") && t.dependsOn.every((d) => DONE.includes(status.get(d)!)));
  }

  /** Marks every transitive dependent of a dead task as invalidated. Returns invalidated task ids. */
  propagateInvalidation(runId: string): string[] {
    const tasks = this.tasks(runId);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const invalidated: string[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of byId.values()) {
        if (DEAD.includes(t.status) || t.status === "skipped") continue;
        const deadDep = t.dependsOn.map((d) => byId.get(d)!).find((d) => d && DEAD.includes(d.status));
        if (deadDep) {
          const updated: Task = {
            ...t,
            status: "invalidated",
            blocker: {
              reason: `Prerequisite "${deadDep.title}" is ${deadDep.status}`,
              category: "prerequisite",
              evidenceRefs: [deadDep.id],
              nextAction: `Resolve "${deadDep.title}" first; this task will be re-enabled on retry.`,
            },
          };
          byId.set(t.id, this.store.tasks.upsert(updated));
          invalidated.push(t.id);
          changed = true;
          this.bus.emit({ type: "task.invalidated", runId, taskId: t.id, message: `Invalidated "${t.title}": prerequisite "${deadDep.title}" is ${deadDep.status}`, level: "warning" });
          // Downstream verification evidence is no longer valid.
          for (const c of this.store.checks.where("run_id = ?", runId).filter((c) => c.taskId === t.id)) this.store.checks.upsert({ ...c, status: "blocked", summary: `Invalidated by prerequisite ${deadDep.title}` });
        }
      }
    }
    return invalidated;
  }

  /** Re-enables a task and its invalidated dependents for retry. */
  reopen(runId: string, taskId: string): Task[] {
    const tasks = this.tasks(runId);
    const reopened: Task[] = [];
    const target = tasks.find((t) => t.id === taskId);
    if (!target) throw new Error(`Task ${taskId} not found`);
    const dependents = new Set<string>([taskId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of tasks) if (!dependents.has(t.id) && t.dependsOn.some((d) => dependents.has(d))) (dependents.add(t.id), (grew = true));
    }
    for (const t of tasks) {
      if (!dependents.has(t.id)) continue;
      if (t.id === taskId || t.status === "invalidated") {
        // A reopened step starts with its full tries: its earlier ones were against work that has since changed
        // (Calculator app: a step reopened at attempt 3 got one try and blocked after 45 seconds).
        reopened.push(this.store.tasks.upsert({ ...t, status: "pending", blocker: undefined, attempts: 0 }));
      }
    }
    return reopened;
  }

  summary(runId: string): Record<TaskStatus, number> {
    const out = { pending: 0, running: 0, attempted: 0, awaiting_approval: 0, blocked: 0, failed: 0, verified: 0, invalidated: 0, skipped: 0 } as Record<TaskStatus, number>;
    for (const t of this.tasks(runId)) out[t.status]++;
    return out;
  }
}
