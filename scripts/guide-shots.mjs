// Product screenshots for the Walkthrough and the Feature guide: real FlowCode screens, captured from the running app
// with the control to look out for ringed in purple. They show the sample build "Studio Bookings" (the yoga studio
// booking app the Walkthrough uses), never a person's own projects; counts of your own drafts and PRDs are hidden.
//
// Requires the dev daemon (7457) and UI dev server (5199). Usage:
//   node scripts/guide-shots.mjs [setup|draft|plan|builder|pages|all]      (default: all; draft needs the sample as a draft)
// Writes apps/ui/public/guide/<name>.jpg (served at /guide/<name>.jpg). Re-run after a screen changes.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const UI = process.env.UI_URL ?? "http://127.0.0.1:5199/";
const API = "http://127.0.0.1:7457";
const AUTH = { authorization: "Bearer dev-token-flowcode" };
const qs = "?port=7457&token=dev-token-flowcode";
const OUT = join(import.meta.dirname, "..", "apps", "ui", "public", "guide");
const group = process.argv[2] ?? "all";

const projects = await (await fetch(`${API}/projects`, { headers: AUTH })).json();
const sample = projects.find((p) => p.name === "Studio Bookings");
if (!sample) throw new Error('The sample project "Studio Bookings" is missing. Create it from Home first.');
const id = sample.id;

/** The Walkthrough's sample description, typed into Home's composer (nothing is saved: Next isn't pressed). */
const fillComposer = async (p) => {
  await p.fill('[data-cp="nb-name"]', "Studio Bookings");
  await p.selectOption('[data-cp="nb-type"]', "saas");
  await p.fill('[data-cp="nb-desc"]', "A booking app for a small yoga studio. Members see the week's classes, book a spot and cancel up to two hours before class. Staff see who's coming to each class.");
};

/** Each shot: where to go, what to ring (the thing to look out for), and anything to do first. */
const SHOTS = [
  { group: "setup", name: "home-composer", route: "/", ring: "#composer-form", before: fillComposer },
  { group: "setup", name: "home-attach", route: "/", ring: ".composer__files, [data-cp=\"nb-files\"]", before: async (p) => {
    await fillComposer(p);
    // A sample PRD in the file picker, so the picture shows what an attached PRD looks like (nothing is saved).
    await p.setInputFiles('#composer-form input[type="file"]', join(import.meta.dirname, "guide-assets", "studio-bookings-prd.md"));
  } },
  // Look and Feel and Build only show while the sample is a draft (before Start Build); kept from that capture.
  { group: "draft", name: "look-studio", route: `/new/${id}/look`, ring: '[data-cp="look-panel"]', wait: 4000 },
  { group: "draft", name: "build-levels", route: `/new/${id}/build`, ring: '[data-cp="build-levels"]' },
  { group: "draft", name: "build-coder", route: `/new/${id}/build`, ring: '[data-cp="build-coder"]' },
  { group: "setup", name: "create-prd", route: "/discover/new", ring: ".disc-home__form" },
  // Once the sample's plan is waiting for approval (before you approve it).
  { group: "plan", name: "approvals", route: "/approvals", ring: '[data-cp="approval-allow"], [data-tab="waiting"]' },
  { group: "plan", name: "builder-plan", route: `/projects/${id}`, before: async (p) => p.evaluate(() => window.dispatchEvent(new Event("fc:show-overview"))), ring: ".ws-overview, [data-guide='builder.overview']" },
  { group: "builder", name: "builder-overview", route: `/projects/${id}`, before: async (p) => p.evaluate(() => window.dispatchEvent(new Event("fc:show-overview"))), ring: ".ws-overview, [data-guide='builder.overview']" },
  { group: "builder", name: "builder-chat", route: `/projects/${id}`, before: async (p) => p.click('[data-cp="ws-mode-chat"]').catch(() => undefined), ring: '[data-cp="chat-input"]' },
  { group: "builder", name: "builder-preview", route: `/projects/${id}`, before: async (p) => p.click('[data-tab="preview"]').catch(() => undefined), ring: '[data-tab="preview"]', wait: 5000 },
  { group: "builder", name: "builder-review", route: `/projects/${id}`, before: async (p) => p.click('[data-tab="review"]').catch(() => undefined), ring: '[data-tab="review"]' },
  { group: "builder", name: "builder-design", route: `/projects/${id}`, before: async (p) => p.click('[data-tab="styles"]').catch(() => undefined), ring: '[data-tab="styles"]' },

  // Every other page in the Feature guide. Lists of projects show only the sample; About you isn't captured.
  ...[
    ["nav-rail", "/library", 'nav.rail'],
    ["topbar-search", "/library", '[data-guide="topbar.search"]'],
    ["topbar-models", "/library", '[data-guide="topbar.provider"]'],
    ["nav-approvals", "/library", '[data-guide="nav.approvals"]'],
    ["topbar-theme", "/library", ".theme-toggle"],
    ["home-how", "/", ".home__how"],
    ["dashboard", "/dashboard", null, undefined, 7000],
    ["builder-tasks", `/projects/${id}`, '[data-guide="ws.tasks"]', async (p) => p.evaluate(() => window.dispatchEvent(new Event("fc:show-overview")))],
    ["builder-troubleshoot", `/projects/${id}`, '[data-cp="troubleshoot"]', async (p) => p.evaluate(() => window.dispatchEvent(new Event("fc:show-overview")))],
    ["builder-advice", `/projects/${id}`, '[data-cp="blocker-advice"]', async (p) => p.evaluate(() => window.dispatchEvent(new Event("fc:show-overview")))],
    ["builder-strip", `/projects/${id}`, '[data-guide="ws.strip"]'],
    ["builder-time", `/projects/${id}`, '[data-cp="time-bar"]', async (p) => p.evaluate(() => window.dispatchEvent(new Event("fc:show-overview")))],
    ["builder-files", `/projects/${id}`, '[data-tab="files"]', async (p) => p.click('[data-tab="files"]')],
    ["builder-knowledge", `/projects/${id}`, '[data-tab="knowledge"]', async (p) => p.click('[data-tab="knowledge"]')],
    ["builder-activity", `/projects/${id}`, '[data-tab="activity"]', async (p) => p.click('[data-tab="activity"]')],
    ["builder-terminal", `/projects/${id}`, '[data-tab="terminal"]', async (p) => p.click('[data-tab="terminal"]')],
    ["my-projects", "/quality", ".lrc-cards"],
    ["quality-plan", `/quality/${id}/plan`, null],
    ["quality-launch", `/quality/${id}/launch`, null],
    ["quality-reports", `/quality/${id}/reports`, null],
    ["quality-performance", `/quality/${id}/performance`, null],
    ["quality-intel", `/quality/${id}/intel`, null],
    ["repo-report", "/flowreport", null],
    ["knowledge", "/knowledge", ".lib-shelves"],
    ["knowledge-catalogue", "/knowledge", ".lib-catalogue"],
    ["knowledge-upload", "/knowledge", "#main .page-head button, #main button.btn"],
    ["knowledge-reader", "/knowledge", ".lib-drawer, [role=dialog], aside", async (p) => p.click(".lib-grid .lib-card")],
    ["knowledge-research", "/knowledge", '[data-guide="knowledge.research"]', async (p) => p.getByRole("tab", { name: /Research desk/ }).click()],
    ["topics", "/topics", ".topic-grid"],
    ["web-search", "/search", null],
    // network.jpg is taken by hand in a browser with a GPU: headless software rendering can't draw the 3D graph.
    ["prompts", "/library", "#panel-library-prompts"],
    ["skills", "/library", ".skill-room", async (p) => p.getByRole("tab", { name: /^Skills/ }).click()],
    ["skill-proposals", "/library", "#panel-library-proposals", async (p) => p.getByRole("tab", { name: /Proposed/ }).click().then(() => p.waitForSelector("#panel-library-proposals .lib-card", { timeout: 5000 }))],
    ["agent-tools", "/library", ".lib-tools", async (p) => p.getByRole("tab", { name: /Built-in tools/ }).click()],
    ["components", "/components", ".cl-grid"],
    ["skill-pipeline", "/pipeline", null],
    ["agents", "/agents", '[data-guide="agents.map"]'],
    ["system", "/system", '[data-guide="system.tabs"]'],
    ["mcp-servers", "/system", ".mcp", async (p) => p.getByRole("tab", { name: /Connected servers/ }).click()],
    ["system-models", "/system/models", '[data-guide="models.roles"], [data-guide="models.lab"]'],
    ["feature-guide", "/guide", ".settings-nav"],
    ["about", "/about", null],
    ["branding", "/primitives", ".prim-nav"],
    ["settings-speed", "/settings/speed", ".settings-panel, #main .page"],
    ["settings-prd", "/settings/prd", ".settings-panel, #main .page"],
    ["settings-policy", "/settings/policy", '[data-guide="settings.autonomy"], .settings-panel'],
    ["settings-search", "/settings/search", ".settings-panel, #main .page"],
    ["settings-data", "/settings/data", ".settings-panel, #main .page"],
    ["context-menu", "/library", '[role="menu"]', async (p) => p.click("#panel-library-prompts .lib-card", { button: "right" })],
    ["copilot-panel", "/library", ".copilot, [role=dialog][aria-label*=Copilot], aside[aria-label*=Copilot]", async (p) => p.click('[data-guide="topbar.copilot"]')],
  ].map(([name, route, ring, before, wait]) => ({ group: "pages", name, route, ring, before, wait })),
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Dark theme, and a still background so every capture is the same.
await ctx.addInitScript(() => {
  localStorage.setItem("fc.theme", "dark");
  localStorage.setItem("flowcode.home.backdropPaused", "1");
});
const page = await ctx.newPage();
// ONLY=name,name re-takes just those shots.
const only = process.env.ONLY?.split(",");
for (const s of SHOTS.filter((x) => (only ? only.includes(x.name) : (group === "all" && x.group !== "draft") || x.group === group))) {
  // Close whatever the last shot opened (a drawer, a menu, the Copilot): a hash change doesn't reload the page.
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.goto(`${UI}${qs}#${s.route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(s.wait ?? 2200);
  // A decision waiting opens over the builder; close it (Escape) so the screen behind shows. Nothing is decided.
  if (s.group === "builder" || s.route.startsWith("/projects/")) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(400);
  }
  if (s.before) {
    // A step that can't be done (the control isn't on screen) leaves the screen as it is.
    await Promise.race([s.before(page), page.waitForTimeout(6000)]).catch((e) => console.log(`${s.name}: ${String(e).split("\n")[0]}`));
    await page.waitForTimeout(1500);
  }
  // Hide anything about the person's own work, then ring the control to look out for.
  const found = await page.evaluate((sel) => {
    const style = document.createElement("style");
    style.textContent = ".stop-notice, .toast-region, .home__drafts-btn, .home__pills, .disc-home .home__drafts-btn { display: none !important; } .app-footer { visibility: hidden !important; } .fl-guide-ring { outline: 2px solid #9b6bff !important; outline-offset: 4px !important; box-shadow: 0 0 0 10px rgba(155, 107, 255, 0.22) !important; }";
    document.head.appendChild(style);
    // One ring per picture: clear the last shot's (the page isn't reloaded between shots of the same screen).
    document.querySelectorAll(".fl-guide-ring").forEach((x) => x.classList.remove("fl-guide-ring"));
    // Lists of projects (My Projects, Dashboard): only the sample's card or row shows (CSS, so a re-render keeps it).
    if (/^#\/(quality|dashboard)\/?$/.test(location.hash)) {
      const only = document.createElement("style");
      only.textContent = '.qa-card-wrap:not(:has([data-ctx-label="Studio Bookings"])), #main [data-ctx-label]:not([data-ctx-label="Studio Bookings"]):not(.qa-card) { display: none !important; }';
      document.head.appendChild(only);
    }
    if (!sel) return true;
    const el = sel.split(",").map((x) => document.querySelector(x.trim())).find(Boolean);
    if (!el) return false;
    // A whole panel isn't ringed (the ring would just frame the page); the page stays at its top.
    if (el.getBoundingClientRect().height > innerHeight * 0.55) return true;
    el.classList.add("fl-guide-ring");
    if (el.getBoundingClientRect().left < 8) el.style.setProperty("outline-offset", "-3px", "important");
    el.scrollIntoView({ block: "center" });
    return true;
  }, s.ring);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${s.name}.jpg`), type: "jpeg", quality: 82 });
  console.log(`${s.name}: ${found ? "ringed" : "nothing to ring"}`);
}
await browser.close();
