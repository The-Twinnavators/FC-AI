/**
 * "The app frame is designed": evidence that the frame changed (rule by rule, so a restyled existing rule counts and an
 * unrelated rule doesn't), then evidence in the browser that it shows and its navigation works (frame code nothing
 * renders doesn't count). The stylesheets are the Clean Cart frame step's real recorded versions.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cssRules, frameCssChanges, frameEvidence, frameRendered, matchable } from "../src/quality/frameCheck.js";
import { BrowserSession } from "../src/quality/preview.js";

const fx = (f: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures/frame", f), "utf8");

describe("frame change evidence", () => {
  it("counts the frame step's real restyles that the line count missed", () => {
    // 12:00: background and the active link's colour changed inside existing ui-shell rules; the old check counted 0.
    const at1200 = frameCssChanges(fx("components-before.css"), fx("components-1200.css"));
    expect(at1200.length).toBeGreaterThan(0);
    expect(at1200.every((s) => /ui-shell/.test(s))).toBe(true);
    expect(frameCssChanges(fx("components-before.css"), fx("components-1835.css")).length).toBeGreaterThan(0);
    expect(frameEvidence([{ file: "src/styles/components.css", before: fx("components-before.css"), now: fx("components-1200.css") }], [])).toMatchObject({ ok: true });
  });

  it("doesn't count unrelated CSS changes, or a frame component nothing renders", () => {
    const before = ".ui-shell { background: white; }\n.card { padding: 8px; }\n";
    const unrelated = ".ui-shell { background: white; }\n.card { padding: 16px; border: 1px solid; }\n";
    expect(frameCssChanges(before, unrelated)).toEqual([]);
    expect(frameEvidence([{ file: "src/styles/components.css", before, now: unrelated }], [])).toEqual({ ok: false, problem: expect.stringMatching(/don't touch the frame/) });
    expect(frameEvidence([], [{ file: "src/components/AppFrame.tsx", rendered: false }])).toEqual({ ok: false, problem: expect.stringMatching(/isn't rendered: App\.tsx doesn't import it/) });
    expect(frameEvidence([], [{ file: "src/components/AppFrame.tsx", rendered: true }])).toMatchObject({ ok: true, component: "src/components/AppFrame.tsx" });
  });

  it("reads rules per selector, including inside media queries, and drops state-only pseudo-classes for matching", () => {
    const rules = cssRules("/* c */ .a { color: red; }\n@media (max-width: 600px) { .ui-shell__nav { display: none; } }");
    expect(rules.get(".a")).toBe("color: red");
    expect(rules.get(".ui-shell__nav")).toBe("display: none");
    expect(matchable('.ui-shell__link:hover, .ui-shell__link[aria-current="page"]::after')).toBe('.ui-shell__link, .ui-shell__link[aria-current="page"]');
  });
});

const app = (frameStyle: string, navWorks = true) => `<!doctype html><html><head><style>.ui-shell__header{${frameStyle}}</style></head><body>
<div class="ui-shell"><header class="ui-shell__header"><span>Clean Cart</span><nav class="ui-shell__nav" aria-label="Main">
<a class="ui-shell__link" href="#/home" aria-current="page">Home</a><a class="ui-shell__link" href="#/search">Search</a></nav></header>
<main id="main"><h1 id="t">Home</h1></main></div>
<script>${navWorks ? "addEventListener('hashchange',()=>{document.getElementById('t').textContent=location.hash.includes('search')?'Search':'Home'})" : "document.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>e.preventDefault()))"}</script></body></html>`;

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1")("frame renders and navigates (browser)", () => {
  const withPage = async (html: string, fn: (p: import("playwright").Page, url: string) => Promise<void>) => {
    const server = http.createServer((_q, r) => r.writeHead(200, { "content-type": "text/html" }).end(html));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    const session = await BrowserSession.launch("test-frame-check");
    try {
      await fn(await session.browser.newPage(), url);
    } finally {
      server.close();
      await session.close();
    }
  };
  const open = (p: import("playwright").Page, url: string) => async (route: string) => void (await p.goto(route ? `${url}#/${route}` : url));

  it("passes a visible frame whose navigation changes the screen", async () => {
    await withPage(app("background: #0b6b3a; color: white;"), async (p, url) => expect(await frameRendered(p, open(p, url), ["home"], [".ui-shell__header"])).toBeUndefined());
  }, 60_000);

  it("skips a disabled control in the navigation (a one-item group's heading) and opens a real destination", async () => {
    // Frameproof: the check clicked the aria-disabled "Gallery" group heading and waited 30 seconds, on every attempt.
    const html = app("background: #0b6b3a; color: white;").replace('<a class="ui-shell__link" href="#/home"', '<button type="button" aria-disabled="true">Gallery</button><button type="button" aria-expanded="true">My Selection</button><a class="ui-shell__link" href="#/home"');
    await withPage(html, async (p, url) => expect(await frameRendered(p, open(p, url), ["home"], [".ui-shell__header"])).toBeUndefined());
  }, 60_000);

  it("fails frame rules that match nothing visible (a hidden frame)", async () => {
    await withPage(app("display: none;"), async (p, url) => expect(await frameRendered(p, open(p, url), ["home"], [".ui-shell__header"])).toMatch(/match nothing visible on any screen/));
  }, 60_000);

  it("fails a frame whose navigation doesn't change the screen", async () => {
    await withPage(app("background: #0b6b3a;", false), async (p, url) => expect(await frameRendered(p, open(p, url), ["home"], [".ui-shell__header"])).toMatch(/didn't change the screen/));
  }, 60_000);
});
