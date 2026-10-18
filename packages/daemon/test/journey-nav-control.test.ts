/**
 * The journey's "opens from the top bar" step clicks the screen's navigation control, not a same-named menu group
 * heading (Frameproof main build: group "Gallery" held item "Gallery"; the heading, disabled while it holds the current
 * page, was taken for the link). A screen whose only control really is disabled still fails.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { runJourney, type JourneyPlan } from "../src/quality/appJourney.js";

const page = (nav: string) => `<!doctype html><html><body>
<nav aria-label="App navigation">${nav}</nav>
<main id="main"></main>
<script>
  const show = () => { document.getElementById("main").textContent = location.hash ? "Page " + location.hash : ""; };
  window.addEventListener("hashchange", show); show();
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { location.hash = "#/" + b.dataset.go; }));
</script></body></html>`;

const SAME_NAMED = page(`
  <div><button type="button" aria-expanded="true" aria-disabled="true">Gallery</button>
    <ul><li><button type="button" data-go="gallery" aria-current="page">Gallery</button></li></ul></div>
  <div><button type="button" aria-expanded="true">My Selection</button>
    <ul><li><button type="button" data-go="my-selection">My Selection</button></li></ul></div>`);
const ONLY_DISABLED = page(`<ul><li><button type="button" data-go="gallery" disabled>Gallery</button></li></ul>`);

let browser: Browser | undefined;
let server: http.Server;
let base = "";
beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(req.url?.startsWith("/disabled") ? ONLY_DISABLED : SAME_NAMED);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await browser?.close();
  server?.close();
});

const PLAN: JourneyPlan = {
  screens: [
    { name: "Gallery.", view: "gallery", label: "Gallery", kind: "list" },
    { name: "My Selection.", view: "my-selection", label: "My Selection", kind: "custom" },
  ],
  records: [],
};

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1")("the journey's top-bar step", () => {
  it("opens each screen through its own link when a group heading shares its name", async () => {
    browser ??= await chromium.launch();
    const p = await browser.newPage();
    const res = await runJourney(p, `${base}/`, PLAN);
    await p.close();
    expect(res.steps.map((s) => [s.step, s.ok, s.detail])).toEqual([
      ["Gallery.: opens from the top bar", true, "#/gallery"],
      ["My Selection.: opens from the top bar", true, "#/my-selection"],
    ]);
  }, 60_000);

  it("still fails a screen whose only control is disabled", async () => {
    browser ??= await chromium.launch();
    const p = await browser.newPage();
    const res = await runJourney(p, `${base}/disabled`, { ...PLAN, screens: [PLAN.screens[0]!] });
    await p.close();
    expect(res.steps).toEqual([{ step: "Gallery.: opens from the top bar", ok: false, detail: '"Gallery" in the top bar is disabled' }]);
  }, 60_000);
});
