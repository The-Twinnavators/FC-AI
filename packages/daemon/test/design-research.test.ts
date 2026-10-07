/** Design research: what to search for, which references to open, the brief the design steps get. */
import { describe, expect, it } from "vitest";
import { designResearchBrief, pickReferences, researchQueries, researchTopic, type DesignResearch } from "../src/quality/designResearch.js";
import { jsonOnly } from "../src/models/anthropic.js";

const web = { searxUrl: "http://127.0.0.1:8888", blockDarkWeb: true as const, blocklist: [], safeSearch: 1 as const };

describe("design research", () => {
  it("searches for the product and its industry on Dribbble, Behance and the web", () => {
    const topic = researchTopic("Build a clickable prototype of the first version described in the attached PRD\n# Non-GMO brand finder for grocery shoppers", { industry: "Food / grocery / restaurant" } as never);
    expect(topic).toMatch(/Non-GMO brand finder/i);
    expect(topic).toMatch(/Food/);
    expect(researchQueries(topic)[0]).toMatch(/^site:dribbble\.com /);
    expect(researchQueries(topic)[1]).toMatch(/^site:behance\.net /);
  });

  it("opens design shots first, one page per site (two for Dribbble and Behance), and skips social and video sites", () => {
    const picked = pickReferences(
      [
        { url: "https://www.youtube.com/watch?v=1", title: "video" },
        { url: "https://shop.example.com/", title: "Grocery shop" },
        { url: "https://shop.example.com/about", title: "Grocery shop about" },
        { url: "https://dribbble.com/shots/1-grocery", title: "Grocery app" },
        { url: "https://dribbble.com/shots/2-food", title: "Food app" },
        { url: "https://dribbble.com/shots/3-more", title: "More" },
        { url: "https://www.behance.net/gallery/9/food", title: "Food UI" },
        { url: "https://dribbble.com/tags/grocery", title: "Tag page" },
      ],
      web,
    );
    expect(picked.map((p) => p.url)).toEqual(["https://dribbble.com/shots/1-grocery", "https://dribbble.com/shots/2-food", "https://www.behance.net/gallery/9/food", "https://shop.example.com/"]);
  });

  it("turns the study into a brief with patterns, recommendations and what to avoid", () => {
    const r: DesignResearch = {
      at: new Date().toISOString(),
      runId: "r",
      topic: "grocery",
      queries: [],
      references: [{ url: "https://dribbble.com/shots/1", title: "x", source: "dribbble.com" }],
      patterns: { layout: "Search first, results grid below", hierarchy: "", imagery: "Full-bleed food photos", colour: "", type: "", components: "" },
      recommendations: ["Put the search field at the top"],
      avoid: ["Cold blue palettes"],
    };
    const b = designResearchBrief(r);
    expect(b).toContain("dribbble.com");
    expect(b).toContain("Layout: Search first");
    expect(b).not.toContain("Hierarchy:");
    expect(b).toContain("- Put the search field at the top");
    expect(b).toContain("Avoid: Cold blue palettes");
  });

  it("reads JSON out of fences or a sentence when JSON was asked for", () => {
    expect(jsonOnly('Here you go:\n```json\n{"level":"good"}\n```', true)).toBe('{"level":"good"}');
    expect(jsonOnly("plain text", false)).toBe("plain text");
  });
});

describe("ready-made home screen", () => {
  it("is added only when the PRD asks for a pitch (landing, welcome, onboarding), not for a tool's home screen", async () => {
    const { pickLayouts } = await import("../src/orchestrator/layoutRecipes.js");
    const kinds = (t: string) => pickLayouts(t).map((p) => p.kind);
    expect(kinds("## Main screens\n- Home screen: search non-GMO brands and filter by category")).not.toContain("home");
    expect(kinds("## Main screens\n- Landing page that welcomes new visitors\n- Brand list")).toContain("home");
    expect(kinds("## Main screens\n- Onboarding for first-time users")).toContain("home");
  });
});

describe("photo check", () => {
  it("skips photos the check rejects and says what to search for instead", async () => {
    const { findOpenImage } = await import("../src/workspace/openImages.js");
    const { makeApp, makeProject } = await import("./helpers.js");
    const { app } = makeApp();
    const { jail } = makeProject(app, { "a.txt": "x" }) as never as { jail: import("../src/security/pathJail.js").PathJail };
    const realFetch = globalThis.fetch;
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"), Buffer.alloc(4000)]);
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes("api.openverse")) return new Response(JSON.stringify({ results: [1, 2, 3].map((n) => ({ url: `https://img.example/${n}.png`, thumbnail: `https://img.example/t${n}.png`, width: 800, height: 600, license: "cc0", title: `photo ${n}` })) }), { status: 200 });
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    }) as typeof fetch;
    try {
      const seen: string[] = [];
      const none = await findOpenImage(jail ?? app.projects.jail(app.store.projects.list()[0]), { query: "glass of milk" }, undefined, async () => (seen.push("x"), { ok: false, reason: "shows a pizza" }));
      expect(none.ok).toBe(false);
      expect(none.message).toMatch(/didn't actually show it|actually showed it/);
      expect(none.message).toContain("shows a pizza");
      const yes = await findOpenImage(jail ?? app.projects.jail(app.store.projects.list()[0]), { query: "glass of milk" }, undefined, async () => ({ ok: true, reason: "" }));
      expect(yes.ok).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
