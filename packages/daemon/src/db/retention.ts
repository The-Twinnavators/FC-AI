/**
 * Retention (§7.2 "retention, deletion … controls"). Prunes event logs and artifacts of finished runs
 * past their retention window, then garbage-collects unreferenced objects. Snapshots of runs that are
 * not terminal are never pruned (they are needed for rollback).
 */
import fs from "node:fs";
import path from "node:path";
import { TERMINAL_RUN_STATUSES } from "@flowcode/contracts";
import type { Store } from "./store.js";
import type { ObjectStore } from "./artifacts.js";
import type { EventBus } from "../events/bus.js";

export interface RetentionPolicy {
  snapshotsDays: number;
  eventsDays: number;
}

export function applyRetention(store: Store, objects: ObjectStore, bus: EventBus, now = Date.now()) {
  const policy = store.getSetting<RetentionPolicy>("retention", { snapshotsDays: 30, eventsDays: 90 });
  const eventsCutoff = new Date(now - policy.eventsDays * 86_400_000).toISOString();
  const snapCutoff = new Date(now - policy.snapshotsDays * 86_400_000).toISOString();
  const finished = new Set(store.runs.list("created_at ASC", 100_000).filter((r) => TERMINAL_RUN_STATUSES.includes(r.status) && (r.completedAt ?? r.createdAt) < snapCutoff).map((r) => r.id));

  const ev = store.db.run("DELETE FROM events WHERE created_at < ? AND (run_id IS NULL OR run_id NOT IN (SELECT id FROM runs WHERE status NOT IN ('done','done_with_warnings','done_unverified','failed','cancelled')))", eventsCutoff);
  let snaps = 0;
  let arts = 0;
  for (const runId of finished) {
    snaps += Number(store.db.run("DELETE FROM snapshots WHERE run_id = ?", runId).changes);
    // Reports are kept (they are the durable record); screenshots and logs are pruned.
    arts += Number(store.db.run("DELETE FROM artifacts WHERE run_id = ? AND kind NOT IN ('report_md','report_json','report_pdf')", runId).changes);
  }
  // Garbage-collect objects no longer referenced by snapshots or artifacts.
  const referenced = new Set<string>();
  for (const r of store.db.all<{ data: string }>("SELECT data FROM snapshots")) {
    const s = JSON.parse(r.data) as { priorContentRef?: string };
    if (s.priorContentRef) referenced.add(s.priorContentRef);
  }
  for (const r of store.db.all<{ data: string }>("SELECT data FROM artifacts")) referenced.add((JSON.parse(r.data) as { contentRef: string }).contentRef);
  let removed = 0;
  if (fs.existsSync(objects.root)) {
    for (const dir of fs.readdirSync(objects.root)) {
      const full = path.join(objects.root, dir);
      if (!fs.statSync(full).isDirectory()) continue;
      for (const f of fs.readdirSync(full)) {
        if (/^[a-f0-9]{64}$/.test(f) && !referenced.has(f) && fs.statSync(path.join(full, f)).mtimeMs < now - 86_400_000) {
          fs.rmSync(path.join(full, f), { force: true });
          removed++;
        }
      }
    }
  }
  const summary = { events: Number(ev.changes), snapshots: snaps, artifacts: arts, objects: removed };
  if (summary.events || snaps || arts || removed) bus.emit({ type: "knowledge.updated", message: `Retention applied: ${summary.events} events, ${snaps} snapshots, ${arts} artifacts, ${removed} objects removed`, data: summary });
  return summary;
}
