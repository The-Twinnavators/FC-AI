/** Research desk: SearXNG first (text results, reference sites first), Wikipedia only as a fallback. */
import { describe, expect, it } from "vitest";
import { SearxngAdapter, type SearchAdapter } from "../src/knowledge/research.js";
import { makeApp, makeProject } from "./helpers.js";

const LONG = "This page explains the topic in detail with enough words to be cited as a source.";

describe("research desk with SearXNG", () => {
  it("keeps text results, puts reference sites first, skips videos and empty snippets, and records the engine", async () => {
    const a = new SearxngAdapter(async () => ({
      results: [
        { url: "https://news.example/a", title: "News", snippet: LONG, source: "news.example", engine: "bing news", tab: "news" },
        { url: "https://youtube.com/v", title: "Video", snippet: LONG, source: "youtube.com", engine: "youtube", tab: "videos" },
        { url: "https://developer.mozilla.org/x", title: "MDN", snippet: LONG, source: "developer.mozilla.org", engine: "duckduckgo", tab: "reference" },
        { url: "https://blog.example/b", title: "Short", snippet: "too short", source: "blog.example", tab: "general" },
      ],
    }));
    const hits = await a.search("q");
    expect(hits.map((h) => h.title)).toEqual(["MDN", "News"]);
    expect(hits[0].via).toBe("developer.mozilla.org via duckduckgo");
  });

  it("uses Wikipedia only when SearXNG fails, and says so", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    app.router.register({ config: { id: "ollama", kind: "ollama", label: "offline", enabled: true, hosted: false }, chat: async () => { throw new Error("offline"); }, listModels: async () => [], describe: async () => undefined, health: async () => ({ ok: false, detail: "offline" }) });
    let wikiCalls = 0;
    const down: SearchAdapter = { id: "searxng", label: "Web search through your SearXNG", search: async () => { throw new Error("SearXNG is not running"); } };
    const wiki: SearchAdapter = { id: "wikipedia", label: "Wikipedia (public API)", search: async () => (wikiCalls++, [{ title: "Calendar", url: "https://en.wikipedia.org/wiki/Calendar", snippet: LONG }]) };
    app.research.adapters = [down, wiki];
    const job = await app.research.createJob(project.id, "How do calendar apps handle time zones?");
    app.approvals.decide(job.approvalId!, "once");
    const done = await app.research.execute(job.id);
    expect(done.status).toBe("completed");
    expect(wikiCalls).toBeGreaterThan(0);
    expect(done.limitations.join(" ")).toMatch(/Web search through your SearXNG failed/);
    expect(done.limitations.join(" ")).toMatch(/answered from Wikipedia/);

    // When SearXNG works, Wikipedia isn't asked at all.
    wikiCalls = 0;
    const up: SearchAdapter = { id: "searxng", label: "Web search through your SearXNG", search: async () => [{ title: "MDN", url: "https://developer.mozilla.org/x", snippet: LONG, via: "developer.mozilla.org via duckduckgo" }] };
    app.research.adapters = [up, wiki];
    const job2 = await app.research.createJob(project.id, "How do browsers store dates?");
    app.approvals.decide(job2.approvalId!, "once");
    const done2 = await app.research.execute(job2.id);
    expect(done2.status).toBe("completed");
    expect(wikiCalls).toBe(0);
    expect(app.store.approvals.require(job2.approvalId!).detail).toMatch(/SearXNG/);
  });
});
