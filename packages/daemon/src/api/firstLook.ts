/**
 * A first look early (D8): every new build designs all its main screens in one step ("Design the main screens")
 * before any feature work. When that step passes, the app already looks like itself with sample data, so FlowCode
 * says so ("First look ready") and the Overview offers Preview, while the build carries on with the features.
 */
import type { App } from "../app.js";
import { DESIGN_SCREENS } from "../orchestrator/templates.js";

const KEY = (runId: string) => `firstLook:${runId}`;

export function firstLookAt(app: Pick<App, "store">, runId: string): string | undefined {
  return app.store.getSetting<string | null>(KEY(runId), null) ?? undefined;
}

export function watchFirstLook(app: App) {
  return app.bus.subscribe((e) => {
    if (e.type !== "task.verified" || !e.runId || !e.taskId || firstLookAt(app, e.runId)) return;
    const task = app.store.tasks.get(e.taskId);
    if (!task) return;
    // The screens step itself, or the last part of it when it was split into smaller steps.
    const parent = app.store.getSetting<string>(`splitParent:${task.id}`, "");
    const isScreens = task.title === DESIGN_SCREENS || (parent && app.store.tasks.get(parent)?.title === DESIGN_SCREENS);
    if (!isScreens) return;
    if (parent) {
      const parts = app.store.tasks.where("run_id = ?", e.runId).filter((t) => app.store.getSetting<string>(`splitParent:${t.id}`, "") === parent);
      if (parts.some((t) => t.status !== "verified")) return;
    }
    app.store.setSetting(KEY(e.runId), new Date().toISOString());
    app.bus.emit({ type: "run.status_changed", projectId: e.projectId, runId: e.runId, level: "info", message: "First look ready: the main screens are designed with sample data. Open Preview to see them; FlowCode carries on with the features.", data: { firstLook: true } });
  });
}
