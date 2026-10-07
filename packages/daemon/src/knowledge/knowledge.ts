/**
 * Knowledge, search and retrieval (FR-K3–K5, §12). A single local FTS5 index spans files, knowledge
 * cards, prompts, skills and run history; optional local embeddings add semantic similarity.
 * Every result carries provenance; users can pin/exclude items; speculative agent output is never
 * promoted to durable memory without evidence or user confirmation.
 */
import fs from "node:fs";
import path from "node:path";
import type { CreateKnowledgeInput, KnowledgeItem, PromptSpec, SkillSpec } from "@flowcode/contracts";
import { CreateKnowledgeInput as CreateKnowledgeSchema, PromptSpec as PromptSchema, SkillSpec as SkillSchema } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import type { ModelRouter } from "../models/router.js";
import { flattenFiles } from "../workspace/fileService.js";
import type { PathJail } from "../security/pathJail.js";
import { newId, nowIso, sha256 } from "../util/ids.js";
import { redact } from "../security/redaction.js";

export interface SearchResult {
  kind: "file" | "knowledge" | "prompt" | "skill" | "run" | "event";
  id: string;
  title: string;
  snippet: string;
  score: number;
  provenance: string;
  projectId?: string;
  pinned?: boolean;
}

export class KnowledgeService {
  embedModel = "nomic-embed-text";

  constructor(
    private store: Store,
    private bus: EventBus,
    private router: ModelRouter,
  ) {}

  // ───────────────────────────── Knowledge items ─────────────────────────────

  create(input: CreateKnowledgeInput): KnowledgeItem {
    const v = CreateKnowledgeSchema.parse(input);
    // FR-K5: durable requires evidence (provenance from files/urls/runs) and/or user confirmation.
    const hasEvidence = v.provenance.some((p) => p.kind !== "agent");
    const durability = v.durability === "durable" && !(hasEvidence || v.confirmedByUser) ? "temporary" : v.durability;
    const now = nowIso();
    const item: KnowledgeItem = {
      id: newId("kn"),
      scope: v.scope,
      projectId: v.projectId,
      kind: v.kind,
      title: redact(v.title),
      content: redact(v.content),
      provenance: v.provenance,
      confidence: v.confidence,
      tags: v.tags,
      linkedEntityIds: v.linkedEntityIds,
      durability,
      confirmedByUser: v.confirmedByUser,
      pinned: false,
      excluded: false,
      createdAt: now,
      updatedAt: now,
    };
    this.store.knowledge.upsert(item);
    this.index("knowledge", item.id, item.projectId, item.title, `${item.content}\n${item.tags.join(" ")}`, item.provenance.map((p) => `${p.kind}:${p.ref}`).join(", "));
    this.bus.emit({ type: "knowledge.updated", projectId: item.projectId, message: `Knowledge ${item.kind} saved: ${item.title}${v.durability === "durable" && durability !== "durable" ? " (kept temporary: needs evidence or confirmation)" : ""}`, data: { id: item.id } });
    return item;
  }

  update(id: string, patch: Partial<Pick<KnowledgeItem, "title" | "content" | "tags" | "pinned" | "excluded" | "confirmedByUser" | "durability" | "linkedEntityIds" | "confidence">>): KnowledgeItem {
    const cur = this.store.knowledge.require(id);
    const next: KnowledgeItem = { ...cur, ...patch, updatedAt: nowIso() };
    if (next.durability === "durable" && !next.confirmedByUser && !next.provenance.some((p) => p.kind !== "agent")) next.durability = "temporary";
    this.store.knowledge.upsert(next);
    this.index("knowledge", next.id, next.projectId, next.title, `${next.content}\n${next.tags.join(" ")}`, next.provenance.map((p) => `${p.kind}:${p.ref}`).join(", "));
    return next;
  }

  /** Deletes items and their search entries. Returns how many existed. */
  remove(ids: string[]): { removed: number } {
    let removed = 0;
    for (const id of ids) {
      if (!this.store.knowledge.get(id)) continue;
      this.store.knowledge.delete(id);
      this.store.db.run("DELETE FROM search_index WHERE entity_kind = ? AND entity_id = ?", "knowledge", id);
      this.store.db.run("DELETE FROM embeddings WHERE entity_kind = ? AND entity_id = ?", "knowledge", id);
      removed++;
    }
    return { removed };
  }

  /** Moves items to another project, or to Global (projectId null). Global items are available to every project. */
  move(ids: string[], projectId: string | null): { moved: number } {
    if (projectId) this.store.projects.require(projectId);
    let moved = 0;
    for (const id of ids) {
      const cur = this.store.knowledge.get(id);
      if (!cur) continue;
      const next: KnowledgeItem = { ...cur, scope: projectId ? "project" : "global", projectId: projectId ?? undefined, updatedAt: nowIso() };
      this.store.knowledge.upsert(next);
      this.index("knowledge", next.id, next.projectId, next.title, `${next.content}\n${next.tags.join(" ")}`, next.provenance.map((p) => `${p.kind}:${p.ref}`).join(", "));
      moved++;
    }
    return { moved };
  }

  list(projectId?: string): KnowledgeItem[] {
    return projectId ? this.store.knowledge.where("(project_id = ? OR scope = 'global') ORDER BY updated_at DESC", projectId) : this.store.knowledge.list("updated_at DESC");
  }

  // ───────────────────────────── Index & search ─────────────────────────────

  index(kind: SearchResult["kind"], id: string, projectId: string | undefined, title: string, body: string, provenance: string) {
    this.store.db.run("DELETE FROM search_index WHERE entity_kind = ? AND entity_id = ?", kind, id);
    this.store.db.run("INSERT INTO search_index (entity_kind, entity_id, project_id, title, body, provenance) VALUES (?, ?, ?, ?, ?, ?)", kind, id, projectId ?? "", title, redact(body).slice(0, 200_000), provenance);
  }

  /** Incremental workspace indexing: only changed files (by mtime+hash) are re-read (§7.4). */
  indexWorkspace(projectId: string, jail: PathJail, maxFiles = 4000): { indexed: number; skipped: number; removed: number } {
    const files = flattenFiles(jail, maxFiles).filter((f) => !jail.isSecretPath(f));
    const known = new Map(this.store.db.all<{ rel_path: string; mtime_ms: number; content_hash: string }>("SELECT rel_path, mtime_ms, content_hash FROM file_index_state WHERE project_id = ?", projectId).map((r) => [r.rel_path, r]));
    let indexed = 0;
    let skipped = 0;
    const seen = new Set<string>();
    for (const rel of files) {
      seen.add(rel);
      const abs = path.join(jail.root, rel);
      let st: fs.Stats;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (st.size > 400_000) continue;
      const prev = known.get(rel);
      if (prev && prev.mtime_ms === st.mtimeMs) {
        skipped++;
        continue;
      }
      const buf = fs.readFileSync(abs);
      if (buf.subarray(0, 8000).includes(0)) continue;
      const hash = sha256(buf);
      if (prev && prev.content_hash === hash) {
        this.store.db.run("UPDATE file_index_state SET mtime_ms = ? WHERE project_id = ? AND rel_path = ?", st.mtimeMs, projectId, rel);
        skipped++;
        continue;
      }
      this.index("file", `${projectId}:${rel}`, projectId, rel, buf.toString("utf8"), `file:${rel}`);
      this.store.db.run("INSERT INTO file_index_state (project_id, rel_path, content_hash, mtime_ms) VALUES (?, ?, ?, ?) ON CONFLICT(project_id, rel_path) DO UPDATE SET content_hash = excluded.content_hash, mtime_ms = excluded.mtime_ms", projectId, rel, hash, st.mtimeMs);
      indexed++;
    }
    let removed = 0;
    for (const rel of known.keys()) {
      if (seen.has(rel)) continue;
      this.store.db.run("DELETE FROM search_index WHERE entity_kind = 'file' AND entity_id = ?", `${projectId}:${rel}`);
      this.store.db.run("DELETE FROM file_index_state WHERE project_id = ? AND rel_path = ?", projectId, rel);
      removed++;
    }
    return { indexed, skipped, removed };
  }

  indexRunHistory(runId: string) {
    const run = this.store.runs.get(runId);
    if (!run) return;
    const tasks = this.store.tasks.where("run_id = ?", runId);
    const body = [run.objective, run.status, ...(run.plan ? [run.plan.goal, ...run.plan.assumptions] : []), ...tasks.map((t) => `${t.title}: ${t.status} ${t.blocker?.reason ?? ""}`)].join("\n");
    this.index("run", runId, run.projectId, `Run: ${run.objective.slice(0, 120)}`, body, `run:${runId}`);
  }

  search(query: string, opts: { projectId?: string; kinds?: SearchResult["kind"][]; limit?: number } = {}): SearchResult[] {
    const q = toFtsQuery(query);
    if (!q) return [];
    const where = ["search_index MATCH ?"];
    const params: unknown[] = [q];
    if (opts.projectId) {
      where.push("(project_id = ? OR project_id = '')");
      params.push(opts.projectId);
    }
    if (opts.kinds?.length) {
      where.push(`entity_kind IN (${opts.kinds.map(() => "?").join(",")})`);
      params.push(...opts.kinds);
    }
    params.push(opts.limit ?? 30);
    const rows = this.store.db.all<{ entity_kind: string; entity_id: string; project_id: string; title: string; provenance: string; snip: string; score: number }>(
      `SELECT entity_kind, entity_id, project_id, title, provenance, snippet(search_index, 4, '[', ']', '…', 18) AS snip, bm25(search_index, 0, 0, 0, 4.0, 1.0) AS score
       FROM search_index WHERE ${where.join(" AND ")} ORDER BY score LIMIT ?`,
      ...params,
    );
    const results = rows.map((r) => {
      const k = r.entity_kind === "knowledge" ? this.store.knowledge.get(r.entity_id) : undefined;
      return {
        kind: r.entity_kind as SearchResult["kind"],
        id: r.entity_id,
        title: r.title,
        snippet: r.snip,
        score: -r.score + (k?.pinned ? 100 : 0),
        provenance: r.provenance,
        projectId: r.project_id || undefined,
        pinned: k?.pinned,
        excluded: k?.excluded,
      };
    });
    return results.filter((r) => !(r as { excluded?: boolean }).excluded).sort((a, b) => b.score - a.score);
  }

  /** Semantic similarity over knowledge items using local embeddings (falls back to FTS-only). */
  async semanticSearch(query: string, projectId?: string, limit = 10): Promise<Array<{ item: KnowledgeItem; similarity: number }>> {
    const items = this.list(projectId).filter((k) => !k.excluded);
    let qv: number[];
    try {
      qv = (await this.router.provider("ollama").embed!(this.embedModel, [query]))[0];
    } catch {
      return [];
    }
    const out: Array<{ item: KnowledgeItem; similarity: number }> = [];
    for (const item of items) {
      const v = await this.embeddingFor(item).catch(() => undefined);
      if (v) out.push({ item, similarity: cosine(qv, v) });
    }
    return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /** Similarity of a text to a given set of items (fix memory uses it over its own notes, across projects). */
  async similarAmong(items: KnowledgeItem[], query: string): Promise<Array<{ item: KnowledgeItem; similarity: number }>> {
    const [qv] = await this.router.provider("ollama").embed!(this.embedModel, [query.slice(0, 4000)]);
    const out: Array<{ item: KnowledgeItem; similarity: number }> = [];
    for (const item of items) {
      const v = await this.embeddingFor(item).catch(() => undefined);
      if (v) out.push({ item, similarity: cosine(qv, v) });
    }
    return out.sort((a, b) => b.similarity - a.similarity);
  }

  private async embeddingFor(item: KnowledgeItem): Promise<number[]> {
    const text = `${item.title}\n${item.content}`.slice(0, 4000);
    const hash = sha256(text).slice(0, 16);
    const row = this.store.db.get<{ vector: Uint8Array; content_hash: string }>("SELECT vector, content_hash FROM embeddings WHERE entity_kind = 'knowledge' AND entity_id = ? AND model = ?", item.id, this.embedModel);
    if (row && row.content_hash === hash) return Array.from(new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4));
    const [v] = await this.router.provider("ollama").embed!(this.embedModel, [text]);
    const buf = Buffer.from(new Float32Array(v).buffer);
    this.store.db.run(
      "INSERT INTO embeddings (entity_kind, entity_id, model, dims, vector, content_hash) VALUES ('knowledge', ?, ?, ?, ?, ?) ON CONFLICT(entity_kind, entity_id, model) DO UPDATE SET vector = excluded.vector, dims = excluded.dims, content_hash = excluded.content_hash",
      item.id,
      this.embedModel,
      v.length,
      buf,
      hash,
    );
    return v;
  }

  /**
   * Retrieval packet for planner/coder: pinned + explicitly attached items first, then relevant cited
   * knowledge. Excluded and unconfirmed-speculative items are never included.
   */
  retrievalPacket(projectId: string, query: string, attachedIds: string[] = [], limit = 5): KnowledgeItem[] {
    const chosen = new Map<string, KnowledgeItem>();
    for (const id of attachedIds) {
      const k = this.store.knowledge.get(id);
      if (k && !k.excluded) chosen.set(k.id, k);
    }
    for (const k of this.list(projectId)) if (k.pinned && !k.excluded) chosen.set(k.id, k);
    for (const r of this.search(query, { projectId, kinds: ["knowledge"], limit: 20 })) {
      if (chosen.size >= limit + attachedIds.length) break;
      const k = this.store.knowledge.get(r.id);
      if (!k || k.excluded) continue;
      const speculative = k.provenance.every((p) => p.kind === "agent") && !k.confirmedByUser;
      if (speculative) continue;
      chosen.set(k.id, k);
    }
    return [...chosen.values()];
  }

  // ───────────────────────────── Prompt & skill library ─────────────────────────────

  savePrompt(spec: PromptSpec): PromptSpec {
    const p = PromptSchema.parse(spec);
    const prev = this.store.prompts.get(p.id);
    if (prev && prev.version === p.version && prev.template !== p.template) throw new Error(`Prompt ${p.id}@${p.version} already exists with different content; bump the version`);
    this.store.prompts.upsert(p);
    this.store.db.run(
      "INSERT OR IGNORE INTO prompt_versions (id, prompt_id, version, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      `${p.id}@${p.version}`,
      p.id,
      p.version,
      JSON.stringify(p),
      nowIso(),
      nowIso(),
    );
    this.index("prompt", p.id, p.projectId, p.title, `${p.purpose}\n${p.tags.join(" ")}\n${p.template}`, `prompt:${p.id}@${p.version}`);
    return p;
  }

  promptVersions(id: string): PromptSpec[] {
    return this.store.db.all<{ data: string }>("SELECT data FROM prompt_versions WHERE prompt_id = ? ORDER BY created_at ASC", id).map((r) => JSON.parse(r.data) as PromptSpec);
  }

  saveSkill(spec: SkillSpec): SkillSpec {
    const s = SkillSchema.parse(spec);
    const prev = this.store.skills.get(s.id);
    if (prev && prev.version === s.version && prev.instructions !== s.instructions) throw new Error(`Skill ${s.id}@${s.version} already exists with different content; bump the version`);
    this.store.skills.upsert(s);
    this.store.db.run("INSERT OR IGNORE INTO skill_versions (id, skill_id, version, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", `${s.id}@${s.version}`, s.id, s.version, JSON.stringify(s), nowIso(), nowIso());
    this.index("skill", s.id, undefined, s.id, `${s.purpose}\n${s.instructions}\n${s.acceptance.join("\n")}`, `skill:${s.id}@${s.version}`);
    return s;
  }

  skillVersions(id: string): SkillSpec[] {
    return this.store.db.all<{ data: string }>("SELECT data FROM skill_versions WHERE skill_id = ? ORDER BY created_at ASC", id).map((r) => JSON.parse(r.data) as SkillSpec);
  }

  /** Only skills the user created can be deleted; built-ins can be turned off instead. */
  deleteSkill(id: string) {
    const s = this.store.skills.get(id);
    if (!s) throw new Error(`Skill ${id} not found`);
    if (s.source !== "user") throw new Error("Built-in skills can't be deleted; turn them off instead");
    this.store.db.run("DELETE FROM skills WHERE id = ?", id);
    this.store.db.run("DELETE FROM skill_versions WHERE skill_id = ?", id);
    return { deleted: id };
  }

  /** §11.3 prompt caching: immutable, versioned prompt components are cached by content key. */
  cachedPromptComponent(key: string, build: () => string): string {
    const cacheKey = sha256(key).slice(0, 24);
    const row = this.store.db.get<{ data: string }>("SELECT data FROM prompt_cache WHERE cache_key = ?", cacheKey);
    if (row) return (JSON.parse(row.data) as { text: string }).text;
    const text = build();
    const id = newId("pc");
    this.store.db.run("INSERT INTO prompt_cache (id, cache_key, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", id, cacheKey, JSON.stringify({ id, text }), nowIso(), nowIso());
    return text;
  }
}

export function toFtsQuery(q: string): string {
  const terms = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s.-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1)
    .slice(0, 12);
  return terms.map((t) => `"${t}"*`).join(" OR ");
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
