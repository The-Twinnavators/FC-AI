/**
 * Research pipeline (FR-R1–R3, §12.2): question → query plan → consent → search adapters → fetch/extract
 * → claims with citations → knowledge cards. Web content is untrusted data: it is stored with
 * provenance and instruction-like text is flagged, never executed. External calls require approval.
 */
import type { KnowledgeItem, ResearchJob } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import type { ApprovalService } from "../approvals/service.js";
import type { KnowledgeService } from "./knowledge.js";
import type { ModelRouter } from "../models/router.js";
import { newId, nowIso, sha256 } from "../util/ids.js";
import { redact } from "../security/redaction.js";
import { INSTRUCTION_LIKE } from "../orchestrator/prompts.js";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  sourceDate?: string;
  /** Which engine or site the hit came from (for SearXNG: the engine that found it). */
  via?: string;
}

export interface SearchAdapter {
  id: string;
  label: string;
  search(query: string, signal?: AbortSignal): Promise<SearchHit[]>;
}

/** Free, keyless adapter over the public Wikipedia search API. */
export class WikipediaAdapter implements SearchAdapter {
  id = "wikipedia";
  label = "Wikipedia (public API)";
  async search(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal, headers: { "user-agent": "FlowCode-IDE/0.1 (local research adapter)" } });
    const json = (await res.json()) as { query?: { search?: Array<{ title: string; snippet: string; timestamp: string }> } };
    return (json.query?.search ?? []).map((s) => ({
      title: s.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
      snippet: s.snippet.replace(/<[^>]+>/g, ""),
      sourceDate: s.timestamp,
    }));
  }
}

/**
 * Web search through the user's own SearXNG (it asks many engines at once). The search function is FlowCode's web
 * search, so the dark-web filter, the user's blocked sites and safe search all apply. Videos are skipped (no text to
 * cite); reference and documentation sites come first.
 */
export class SearxngAdapter implements SearchAdapter {
  id = "searxng";
  label = "Web search through your SearXNG";
  constructor(private run: (query: string) => Promise<{ results: Array<{ url: string; title: string; snippet: string; source: string; engine?: string; tab: string; publishedAt?: string }> }>) {}
  async search(query: string): Promise<SearchHit[]> {
    const { results } = await this.run(query);
    const rank: Record<string, number> = { reference: 0, general: 1, community: 2, news: 3, pdfs: 4 };
    return results
      .filter((r) => r.tab !== "videos" && r.snippet.trim().length >= 40)
      .sort((a, b) => (rank[a.tab] ?? 5) - (rank[b.tab] ?? 5))
      .slice(0, 6)
      .map((r) => ({ title: r.title, url: r.url, snippet: r.snippet, sourceDate: r.publishedAt, via: r.engine ? `${r.source} via ${r.engine}` : r.source }));
  }
}

const TTL_MS = 7 * 24 * 3600 * 1000;

export class ResearchService {
  adapters: SearchAdapter[] = [new WikipediaAdapter()];

  constructor(
    private store: Store,
    private bus: EventBus,
    private approvals: ApprovalService,
    private knowledge: KnowledgeService,
    private router: ModelRouter,
  ) {}

  /** FR-R1: concise query plan. Uses the researcher model when available; falls back to keyword extraction. */
  async planQueries(projectId: string, question: string): Promise<ResearchJob["queryPlan"]> {
    try {
      const res = await this.router.chat({ role: "researcher", projectId }, this.router.assignmentFor("researcher", projectId), {
        messages: [
          { role: "system", content: "Produce a concise research query plan as JSON: {\"queries\": [max 3 short search queries], \"sourceCategories\": [...], \"intendedQuestions\": [...]}. No other text." },
          { role: "user", content: question },
        ],
        format: { type: "object", properties: { queries: { type: "array", items: { type: "string" } }, sourceCategories: { type: "array", items: { type: "string" } }, intendedQuestions: { type: "array", items: { type: "string" } } }, required: ["queries", "sourceCategories", "intendedQuestions"] },
        timeoutMs: 120_000,
      });
      const j = JSON.parse(res.content) as ResearchJob["queryPlan"];
      if (Array.isArray(j.queries) && j.queries.length) return { queries: j.queries.slice(0, 3).map(String), sourceCategories: (j.sourceCategories ?? []).map(String), intendedQuestions: (j.intendedQuestions ?? []).map(String) };
    } catch {
      /* fall back */
    }
    const words = question.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3);
    return { queries: [words.slice(0, 6).join(" ")], sourceCategories: ["encyclopedic reference"], intendedQuestions: [question] };
  }

  async createJob(projectId: string, question: string): Promise<ResearchJob> {
    const project = this.store.projects.require(projectId);
    const queryPlan = await this.planQueries(projectId, question);
    const job: ResearchJob = { id: newId("rs"), projectId, question, status: "planned", queryPlan, resultKnowledgeIds: [], limitations: [], createdAt: nowIso() };
    if (!project.settings.allowExternalResearch) {
      const a = this.approvals.request({
        projectId,
        kind: "external_research",
        action: `External research: ${queryPlan.queries.join(" | ")}`,
        reason: `Answer: ${question}`,
        affected: this.adapters.map((x) => x.label),
        risk: "low",
        detail: `Data leaving this machine: only the search queries above are sent to ${this.adapters.map((x) => x.label).join(", ")}. No repository content is sent.`,
        consequencesOfDenial: "No external search is performed; only local knowledge is used.",
        persistKey: "external_research",
      });
      job.status = "awaiting_approval";
      job.approvalId = a.id;
    }
    this.store.research.upsert(job);
    return job;
  }

  async execute(jobId: string, signal?: AbortSignal): Promise<ResearchJob> {
    let job = this.store.research.require(jobId);
    const project = this.store.projects.require(job.projectId);
    if (job.approvalId) {
      const a = this.store.approvals.require(job.approvalId);
      if (a.status === "pending") return job;
      if (a.status !== "approved") {
        job = this.store.research.upsert({ ...job, status: "blocked", limitations: ["External research was not approved"] });
        return job;
      }
    } else if (!project.settings.allowExternalResearch) {
      return this.store.research.upsert({ ...job, status: "blocked", limitations: ["External research requires consent"] });
    }
    job = this.store.research.upsert({ ...job, status: "running" });
    const created: KnowledgeItem[] = [];
    const limitations: string[] = [];
    for (const query of job.queryPlan.queries) {
      for (const adapter of this.adapters) {
        let hits: SearchHit[];
        try {
          hits = await this.cachedSearch(adapter, query, signal);
        } catch (err) {
          limitations.push(`${adapter.label} failed for "${query}": ${(err as Error).message}`);
          continue;
        }
        if (!hits.length) continue;
        if (adapter !== this.adapters[0]) limitations.push(`"${query}" was answered from ${adapter.label} because ${this.adapters[0].label} wasn't available or found nothing.`);
        for (const h of hits.slice(0, adapter.id === "searxng" ? 4 : 3)) {
          const flagged = INSTRUCTION_LIKE.test(h.snippet);
          const retrievedAt = nowIso();
          const source = this.knowledge.create({
            scope: "project",
            projectId: job.projectId,
            kind: "source",
            title: h.title,
            content: redact(h.snippet) + (flagged ? "\n[flagged: contains instruction-like text; treated as data]" : ""),
            provenance: [{ kind: "url", ref: h.url, title: h.title, retrievedAt, quote: h.snippet.slice(0, 280) }],
            confidence: "medium",
            tags: ["research", adapter.id],
            ...(h.via ? { summary: `Found by ${h.via}` } : {}),
            linkedEntityIds: [job.id],
            durability: "temporary",
            confirmedByUser: false,
          });
          created.push(source);
          const claim = this.knowledge.create({
            scope: "project",
            projectId: job.projectId,
            kind: "claim",
            title: `${h.title}: ${firstSentence(h.snippet)}`.slice(0, 200),
            content: firstSentence(h.snippet),
            provenance: [{ kind: "url", ref: h.url, title: h.title, retrievedAt, quote: h.snippet.slice(0, 280) }],
            confidence: "low",
            tags: ["research", "claim"],
            linkedEntityIds: [job.id, source.id],
            durability: "temporary",
            confirmedByUser: false,
          });
          created.push(claim);
        }
        break;
      }
    }
    limitations.push("Claims are extracted from search snippets and require human verification before being treated as durable.");
    job = this.store.research.upsert({ ...job, status: created.length ? "completed" : "failed", resultKnowledgeIds: created.map((c) => c.id), limitations });
    this.bus.emit({ type: "knowledge.updated", projectId: job.projectId, message: `Research complete: ${created.length} cited items for "${job.question.slice(0, 80)}"`, data: { jobId: job.id } });
    return job;
  }

  /** FR-R3: query cache with TTL and source date; refresh bypasses the cache. */
  async cachedSearch(adapter: SearchAdapter, query: string, signal?: AbortSignal, refresh = false): Promise<SearchHit[]> {
    const key = sha256(`${adapter.id}:${query.toLowerCase().trim()}`).slice(0, 32);
    const row = this.store.db.get<{ data: string; expires_at: string }>("SELECT data, expires_at FROM research_cache WHERE key = ?", key);
    if (row && !refresh && row.expires_at > nowIso()) return JSON.parse(row.data) as SearchHit[];
    const hits = await adapter.search(query, signal);
    const prev = row ? (JSON.parse(row.data) as SearchHit[]) : undefined;
    if (prev) {
      const changed = JSON.stringify(prev.map((h) => h.url + h.sourceDate)) !== JSON.stringify(hits.map((h) => h.url + h.sourceDate));
      if (changed) this.bus.emit({ type: "knowledge.updated", message: `Source versions changed for "${query}"`, data: { query } });
    }
    this.store.db.run(
      "INSERT INTO research_cache (key, query, data, source_date, fetched_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, source_date = excluded.source_date, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at",
      key,
      query,
      JSON.stringify(hits),
      hits[0]?.sourceDate ?? null,
      nowIso(),
      new Date(Date.now() + TTL_MS).toISOString(),
    );
    return hits;
  }

  invalidate(query?: string) {
    if (!query) this.store.db.run("DELETE FROM research_cache");
    else this.store.db.run("DELETE FROM research_cache WHERE query = ?", query);
  }
}

function firstSentence(s: string): string {
  const m = /^(.{20,300}?[.!?])(\s|$)/.exec(s.trim());
  return (m ? m[1] : s.trim().slice(0, 240)).trim();
}
