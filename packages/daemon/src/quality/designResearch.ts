/**
 * Design research: before the screens are designed, FlowCode looks at how the best products and designers in the
 * category do it. It searches (the local SearXNG) for Dribbble shots, Behance projects and real apps, screenshots a few
 * in a headless browser, and has a vision model study them like a senior product designer: what the strong ones do with
 * layout, hierarchy, imagery, colour and type, and what this product should take from them. The brief goes to the
 * design steps and is the bar the design crit judges against. Needs the project's "allow external research".
 */
import type { ModelAssignment } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import type { ModelRouter } from "../models/router.js";
import type { ProcessManager } from "../commands/processManager.js";
import { BrowserSession } from "./preview.js";
import { blockReason, hostOf, type WebSettings } from "../web/webSearch.js";
import type { DesignDirection } from "../knowledge/designDirection.js";
import { untrusted } from "../orchestrator/prompts.js";

export interface DesignReference {
  url: string;
  title: string;
  source: string;
  whatWorks?: string;
}

export interface DesignResearch {
  at: string;
  runId: string;
  topic: string;
  queries: string[];
  references: DesignReference[];
  patterns: { layout: string; hierarchy: string; imagery: string; colour: string; type: string; components: string };
  recommendations: string[];
  avoid: string[];
  model?: string;
}

export const researchKey = (projectId: string) => `designResearch:${projectId}`;
/** Research older than this is done again for a new build. */
const FRESH_MS = 7 * 24 * 3600 * 1000;
const MAX_REFS = 5;

/** What to search for: the product in a few words, from the request's first line and the design direction. */
export function researchTopic(objective: string, direction?: DesignDirection | null): string {
  const first = (objective.split(/\r?\n/).find((l) => l.trim() && !/^(build|create|make) a clickable prototype/i.test(l.trim())) ?? objective).replace(/^#+\s*/, "");
  const words = first
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^A-Za-z0-9&' -]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(the|and|for|with|that|this|from|into|people|need|way|find|prd|product|requirements|document|version|first|app|application)$/i.test(w))
    .slice(0, 5)
    .join(" ");
  const industry = direction?.industry.split(/[/,]/)[0].trim() ?? "";
  return [words, industry && !new RegExp(industry, "i").test(words) ? industry : ""].filter(Boolean).join(" ").slice(0, 80) || "mobile app";
}

export function researchQueries(topic: string): string[] {
  return [`site:dribbble.com ${topic} app`, `site:behance.net ${topic} app UI`, `${topic} app`];
}

/** The references worth opening: design shots first, then real products; one per site (two for Dribbble/Behance). */
export function pickReferences(results: Array<{ url: string; title: string }>, settings: WebSettings): DesignReference[] {
  const score = (u: string) => (/dribbble\.com\/shots\//.test(u) ? 3 : /behance\.net\/gallery\//.test(u) ? 3 : /dribbble\.com|behance\.net/.test(u) ? 0 : /\b(wikipedia|youtube|reddit|pinterest|facebook|twitter|x\.com|linkedin|amazon|quora|medium)\b/.test(u) ? -1 : 1);
  const perHost = new Map<string, number>();
  const out: DesignReference[] = [];
  for (const r of [...results].sort((a, b) => score(b.url) - score(a.url))) {
    if (out.length >= MAX_REFS || score(r.url) <= 0 || blockReason(r.url, settings)) continue;
    const host = hostOf(r.url);
    const cap = /dribbble|behance/.test(host) ? 2 : 1;
    if ((perHost.get(host) ?? 0) >= cap || out.some((x) => x.url === r.url)) continue;
    perHost.set(host, (perHost.get(host) ?? 0) + 1);
    out.push({ url: r.url, title: r.title.slice(0, 140), source: host });
  }
  return out;
}

/** The brief a design step (and the design crit) gets. */
export function designResearchBrief(r: DesignResearch): string {
  return [
    `Design research (FlowCode studied ${r.references.length} references for "${r.topic}": ${r.references.map((x) => x.source).join(", ")}). Learn from them; don't copy any one:`,
    ...Object.entries(r.patterns)
      .filter(([, v]) => v)
      .map(([k, v]) => `- ${k[0].toUpperCase()}${k.slice(1)}: ${v}`),
    `Recommendations for this product:`,
    ...r.recommendations.slice(0, 8).map((x) => `- ${x}`),
    ...(r.avoid.length ? [`Avoid: ${r.avoid.slice(0, 5).join("; ")}`] : []),
  ].join("\n");
}

/** Dribbble's and Behance's own search for the topic, plus the first shots Dribbble lists (pages that refuse are skipped). */
export function siteSearchUrls(topic: string): DesignReference[] {
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [
    { url: `https://dribbble.com/search/${slug}`, title: `Dribbble: ${topic}`, source: "dribbble.com" },
    { url: `https://www.behance.net/search/projects/${encodeURIComponent(topic)}`, title: `Behance: ${topic}`, source: "behance.net" },
  ];
}

async function siteSearchReferences(topic: string, runId: string, processes?: ProcessManager, signal?: AbortSignal): Promise<DesignReference[]> {
  const out = siteSearchUrls(topic);
  let session: BrowserSession | undefined;
  try {
    session = await BrowserSession.launch(runId, processes);
    const page = await session.browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(out[0].url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForTimeout(2000);
    const shots = await page.$$eval('a[href*="/shots/"]', (as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).href).filter((h) => /\/shots\/\d+/.test(h)))].slice(0, 3));
    for (const url of shots) if (!signal?.aborted) out.push({ url, title: "Dribbble shot", source: "dribbble.com" });
  } catch {
    /* the search pages themselves are still worth a look */
  } finally {
    await session?.close().catch(() => undefined);
  }
  return out.slice(0, MAX_REFS);
}

interface Deps {
  store: Store;
  bus: EventBus;
  router: ModelRouter;
  processes?: ProcessManager;
}

/**
 * The project's design research: reused while fresh, otherwise done now. Undefined when research is off for the
 * project, search or the browser isn't available, or no vision model can read the screenshots.
 */
export async function designResearch(
  deps: Deps,
  input: { projectId: string; runId: string; objective: string; prdText?: string; direction?: DesignDirection | null; models: Array<ModelAssignment | undefined>; allowed: boolean; signal?: AbortSignal },
): Promise<DesignResearch | undefined> {
  const cached = deps.store.getSetting<DesignResearch | null>(researchKey(input.projectId), null);
  if (cached && Date.now() - Date.parse(cached.at) < FRESH_MS) return cached;
  if (!input.allowed) return undefined;
  const ev = { projectId: input.projectId, runId: input.runId };
  const settings = { searxUrl: "http://127.0.0.1:8888", blockDarkWeb: true as const, blocklist: [], safeSearch: 1 as const, ...deps.store.getSetting<Partial<WebSettings>>("web:settings", {}) };
  // A model that can see: the first one that reads images (the cloud model when the project allows it).
  let pick: ModelAssignment | undefined;
  for (const a of input.models) {
    if (!a) continue;
    try {
      if ((await deps.router.provider(a.providerId).describe(a.model))?.capabilities?.includes("vision")) {
        pick = a;
        break;
      }
    } catch {
      /* next */
    }
  }
  if (!pick) return undefined;
  // The search phrase, from the model: the request's first line and the PRD title are often boilerplate
  // ("Build a clickable prototype…", "People need a way to: PRD"), which found nothing (No BIO & GMO build).
  let topic = researchTopic(input.objective, input.direction);
  try {
    const t = await deps.router.chat({ role: "researcher", projectId: input.projectId, runId: input.runId }, { ...pick, temperature: 0 }, {
      messages: [
        { role: "system", content: "Name the kind of product described, as a 2 to 5 word web search phrase a designer would use to find similar apps (e.g. \"non-GMO grocery shopping app\", \"habit tracker app\"). Reply with the phrase only." },
        { role: "user", content: untrusted("product", `${input.objective.slice(0, 600)}\n${(input.prdText ?? "").slice(0, 2500)}`) },
      ],
      maxOutputTokens: 40,
      signal: input.signal,
      timeoutMs: 60_000,
    });
    const phrase = t.content.replace(/["'`.]/g, "").replace(/\s+/g, " ").trim();
    if (phrase && phrase.split(" ").length <= 8 && phrase.length <= 70) topic = phrase.replace(/\s+app$/i, "");
  } catch {
    /* keep the rule-based phrase */
  }
  const queries = researchQueries(topic);
  deps.bus.emit({ ...ev, type: "research.started", message: `Design research: looking for inspiration for "${topic}" (Dribbble, Behance and real apps)` });
  const results: Array<{ url: string; title: string }> = [];
  for (const q of queries) {
    try {
      const r = await fetch(`${settings.searxUrl}/search?${new URLSearchParams({ q, format: "json", safesearch: String(settings.safeSearch) })}`, { signal: AbortSignal.timeout(25_000) });
      const data = (await r.json()) as { results?: Array<{ url?: string; title?: string }> };
      for (const x of data.results ?? []) if (x.url) results.push({ url: x.url, title: String(x.title ?? x.url) });
    } catch {
      /* one query failing is fine */
    }
  }
  const references: DesignReference[] = pickReferences(results, settings);
  // Search engines behind SearXNG rate-limit or ask for CAPTCHAs (No BIO & GMO build: every engine suspended). Then go
  // to the design sites' own public search pages, and the first shots listed there.
  if (!references.length) references.push(...(await siteSearchReferences(topic, input.runId, deps.processes, input.signal)));
  if (!references.length) {
    deps.bus.emit({ ...ev, type: "research.completed", level: "warning", message: `Design research found no usable references for "${topic}" (is SearXNG running at ${settings.searxUrl}?). The design steps work from the design direction alone.` });
    return undefined;
  }
  // Screenshots of each reference, as a visitor sees it.
  const shots: Array<{ ref: DesignReference; jpg: Buffer }> = [];
  let session: BrowserSession | undefined;
  try {
    session = await BrowserSession.launch(input.runId, deps.processes);
    for (const ref of references) {
      if (input.signal?.aborted) break;
      const page = await session.browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        await page.goto(ref.url, { waitUntil: "domcontentloaded", timeout: 25_000 });
        await page.waitForTimeout(2500);
        // A page that rendered nothing (Behance shows a blank page to a headless browser) isn't a reference.
        const visibleText = await page.evaluate(() => document.body?.innerText.trim().length ?? 0).catch(() => 0);
        if (visibleText < 80) continue;
        shots.push({ ref, jpg: await page.screenshot({ type: "jpeg", quality: 60 }) });
      } catch {
        /* skip pages that don't load */
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } catch (e) {
    deps.bus.emit({ ...ev, type: "research.completed", level: "warning", message: `Design research couldn't open a browser: ${(e as Error).message.slice(0, 200)}` });
  } finally {
    await session?.close().catch(() => undefined);
  }
  if (!shots.length) return undefined;
  const brief = input.direction ? `Industry: ${input.direction.industry}. Pattern: ${input.direction.pattern}. Style: ${input.direction.style}. Colour mood: ${input.direction.colorMood}. Avoid: ${input.direction.avoid}.` : "";
  const res = await deps.router.chat({ role: "critic", projectId: input.projectId, runId: input.runId }, { ...pick, temperature: 0.2 }, {
    messages: [
      {
        role: "system",
        content:
          "You are a senior product designer doing design research before a redesign. You get screenshots of reference designs (Dribbble shots, Behance projects and real products) for the same kind of product. Study what the strongest ones do, then turn it into direction for this product: specific, visual and actionable (e.g. \"photo-led cards with the product image filling the top half and the name in a bold serif below\", not \"use good imagery\"). Ignore cookie banners and site chrome. Return JSON only: {\"references\":[{\"n\":number,\"whatWorks\":string}],\"patterns\":{\"layout\":string,\"hierarchy\":string,\"imagery\":string,\"colour\":string,\"type\":string,\"components\":string},\"recommendations\":[string],\"avoid\":[string]} with 5 to 8 recommendations and 2 to 5 things to avoid.",
      },
      {
        role: "user",
        content: `The product: ${untrusted("request", input.objective.slice(0, 1200))}\n${brief}\nReferences:\n${shots.map((s, i) => `${i + 1}. ${s.ref.title} (${s.ref.source})`).join("\n")}`,
        images: shots.map((s) => s.jpg.toString("base64")),
      },
    ],
    format: { type: "object", properties: { references: { type: "array" }, patterns: { type: "object" }, recommendations: { type: "array", items: { type: "string" } }, avoid: { type: "array", items: { type: "string" } } }, required: ["patterns", "recommendations"] },
    signal: input.signal,
    timeoutMs: 240_000,
  });
  let j: { references?: Array<{ n?: number; whatWorks?: string }>; patterns?: Partial<DesignResearch["patterns"]>; recommendations?: unknown[]; avoid?: unknown[] };
  try {
    j = JSON.parse(res.content.replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
  } catch {
    deps.bus.emit({ ...ev, type: "research.completed", level: "warning", message: "Design research: the model's answer couldn't be read; the design steps work from the design direction alone." });
    return undefined;
  }
  const text = (v: unknown, n = 400) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const p = j.patterns ?? {};
  const research: DesignResearch = {
    at: new Date().toISOString(),
    runId: input.runId,
    topic,
    queries,
    references: shots.map((s, i) => ({ ...s.ref, whatWorks: text(j.references?.find((r) => r.n === i + 1)?.whatWorks, 300) || undefined })),
    patterns: { layout: text(p.layout), hierarchy: text(p.hierarchy), imagery: text(p.imagery), colour: text(p.colour), type: text(p.type), components: text(p.components) },
    recommendations: (j.recommendations ?? []).map((x) => text(x, 300)).filter(Boolean).slice(0, 8),
    avoid: (j.avoid ?? []).map((x) => text(x, 200)).filter(Boolean).slice(0, 5),
    model: pick.model,
  };
  deps.store.setSetting(researchKey(input.projectId), research);
  deps.bus.emit({ ...ev, type: "research.completed", message: `Design research done (${pick.model}): ${research.references.length} references (${research.references.map((r) => r.source).join(", ")}), ${research.recommendations.length} recommendations`, data: { references: research.references.map((r) => r.url) } });
  return research;
}
