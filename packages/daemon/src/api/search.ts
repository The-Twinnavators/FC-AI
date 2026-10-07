/**
 * Global search (top bar): files in every project's workspace, knowledge (FTS), prompts, skills and history
 * (requests and tasks). Every hit carries a route the UI can open. Secret files are never searched.
 */
import type { App } from "../app.js";
import { flattenFiles, searchWorkspace } from "../workspace/fileService.js";

export interface GlobalHit {
  kind: "file" | "knowledge" | "skill" | "prompt" | "request" | "task" | "project";
  title: string;
  snippet?: string;
  route: string;
  projectId?: string;
  path?: string;
}

const contains = (text: string | undefined, q: string) => !!text && text.toLowerCase().includes(q);
function snippetAround(text: string, q: string, span = 90): string {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, span * 2);
  const start = Math.max(0, i - span);
  return `${start ? "…" : ""}${text.slice(start, i + q.length + span).replace(/\s+/g, " ").trim()}${i + q.length + span < text.length ? "…" : ""}`;
}

export function globalSearch(app: App, query: string, projectId?: string): { query: string; groups: Record<GlobalHit["kind"], GlobalHit[]> } {
  const q = query.trim().toLowerCase();
  const groups: Record<GlobalHit["kind"], GlobalHit[]> = { project: [], file: [], request: [], task: [], knowledge: [], skill: [], prompt: [] };
  if (q.length < 2) return { query, groups };

  const projects = app.store.projects.list("updated_at DESC").filter((p) => !projectId || p.id === projectId);
  for (const p of projects) if (contains(p.name, q)) groups.project.push({ kind: "project", title: p.name, route: `/projects/${p.id}`, projectId: p.id });

  // Files: name matches first, then content matches (one hit per file).
  for (const p of projects) {
    try {
      const jail = app.projects.jail(p);
      const seen = new Set<string>();
      const skip = /(^|\/)(node_modules|dist|\.git|\.flowcode)\//;
      for (const rel of flattenFiles(jail)) {
        if (seen.size >= 6) break;
        if (skip.test(rel) || jail.isSecretPath(rel) || !rel.toLowerCase().split("/").pop()!.includes(q)) continue;
        seen.add(rel);
        groups.file.push({ kind: "file", title: rel, snippet: "File name match", route: `/projects/${p.id}`, projectId: p.id, path: rel });
      }
      for (const h of searchWorkspace(jail, q, { maxHits: 60 })) {
        if (seen.has(h.path) || /(^|\/)(node_modules|dist|\.git|\.flowcode)\//.test(h.path)) continue;
        seen.add(h.path);
        groups.file.push({ kind: "file", title: h.path, snippet: `${h.line}: ${h.text.trim()}`, route: `/projects/${p.id}`, projectId: p.id, path: h.path });
        if (seen.size >= 12) break;
      }
    } catch {
      /* workspace missing */
    }
  }

  for (const r of app.store.runs.list("created_at DESC", 400).filter((r) => !projectId || r.projectId === projectId)) {
    if (contains(r.objective, q)) groups.request.push({ kind: "request", title: r.objective.replace(/^#+\s*/, "").split(/\r?\n/)[0].slice(0, 120), snippet: snippetAround(r.objective, q), route: `/projects/${r.projectId}/runs/${r.id}`, projectId: r.projectId });
    for (const t of app.store.tasks.where("run_id = ?", r.id)) {
      if (contains(t.title, q) || contains(t.objective, q)) groups.task.push({ kind: "task", title: t.title, snippet: snippetAround(t.objective, q), route: `/projects/${r.projectId}/runs/${r.id}`, projectId: r.projectId });
    }
  }

  for (const k of app.knowledge.search(query, { projectId, limit: 12 })) groups.knowledge.push({ kind: "knowledge", title: k.title, snippet: k.snippet.replace(/\[|\]/g, ""), route: `/knowledge?focus=${k.id}&projectId=${k.projectId ?? ""}`, projectId: k.projectId });

  for (const s of app.store.skills.list("updated_at DESC", 200)) if (contains(`${s.id} ${s.purpose} ${s.instructions}`, q)) groups.skill.push({ kind: "skill", title: s.id, snippet: s.purpose, route: `/library?tab=skills&open=${encodeURIComponent(s.id)}` });
  for (const p of app.store.prompts.list("updated_at DESC", 200)) {
    const text = JSON.stringify(p);
    if (contains(text, q)) groups.prompt.push({ kind: "prompt", title: p.id, snippet: snippetAround(text.replace(/[{}"\\]/g, " "), q, 60), route: `/library?tab=prompts&open=${encodeURIComponent(p.id)}` });
  }
  for (const k of Object.keys(groups) as Array<GlobalHit["kind"]>) groups[k] = groups[k].slice(0, 12);
  return { query, groups };
}
