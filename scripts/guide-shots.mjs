// Product screenshots for the Walkthrough and the Feature guide: real FlowCode screens, captured from the running app
// with the control to look out for ringed in purple. They show the sample build "Studio Bookings" (the yoga studio
// booking app the Walkthrough uses), never a person's own projects; counts of your own drafts and PRDs are hidden.
//
// Requires the dev daemon (7457) and UI dev server (5199). Usage:
//   node scripts/guide-shots.mjs [setup|draft|plan|builder|all]      (default: all; draft needs the sample as a draft)
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
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Dark theme, and a still background so every capture is the same.
await ctx.addInitScript(() => {
  localStorage.setItem("fc.theme", "dark");
  localStorage.setItem("flowcode.home.backdropPaused", "1");
});
const page = await ctx.newPage();
for (const s of SHOTS.filter((x) => (group === "all" && x.group !== "draft") || x.group === group)) {
  await page.goto(`${UI}${qs}#${s.route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(s.wait ?? 2200);
  // A decision waiting opens over the builder; close it (Escape) so the screen behind shows. Nothing is decided.
  if (s.group === "builder") {
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(400);
  }
  if (s.before) {
    await s.before(page);
    await page.waitForTimeout(1500);
  }
  // Hide anything about the person's own work, then ring the control to look out for.
  const found = await page.evaluate((sel) => {
    const style = document.createElement("style");
    style.textContent = ".stop-notice, .toast-region, .app-footer, .home__drafts-btn, .home__pills, .disc-home .home__drafts-btn { display: none !important; } .fl-guide-ring { outline: 2px solid #9b6bff !important; outline-offset: 4px !important; box-shadow: 0 0 0 10px rgba(155, 107, 255, 0.22) !important; }";
    document.head.appendChild(style);
    // One ring per picture: clear the last shot's (the page isn't reloaded between shots of the same screen).
    document.querySelectorAll(".fl-guide-ring").forEach((x) => x.classList.remove("fl-guide-ring"));
    const el = sel.split(",").map((x) => document.querySelector(x.trim())).find(Boolean);
    if (!el) return false;
    el.classList.add("fl-guide-ring");
    el.scrollIntoView({ block: "center" });
    return true;
  }, s.ring);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${s.name}.jpg`), type: "jpeg", quality: 82 });
  console.log(`${s.name}: ${found ? "ringed" : "nothing to ring"}`);
}
await browser.close();
