/**
 * Concept review material, not a regression: each Home concept applied to the regenerated Clean Cart slice app, and the
 * journey's pages (Home, Search/Catalog, Product, Saved) captured at desktop (1440) and mobile (390) width, with what
 * each page actually renders (heading and text fonts, control and card shapes, the page colour, the navigation). Runs
 * only when FLOWCODE_CONCEPT_REVIEW=<dir> is set; writes screenshots and review.json there.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, describe, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { applyDesignSpec } from "../src/workspace/designSpec.js";
import { HOME_CONCEPTS } from "../src/workspace/homeConcepts.js";
import { prdSampleSection, resolveScreenAliases, type AppModel } from "../src/orchestrator/appModel.js";
import { declaredScreens } from "../src/orchestrator/screenPlan.js";
import { mergeRecords, prdFixtureRows } from "../src/orchestrator/recordIdentity.js";
import { appFiles } from "../src/orchestrator/appFiles.js";
import { syncedLibraryCss } from "../src/orchestrator/sectionRecipes.js";
import { makeApp } from "./helpers.js";

const OUT = process.env.FLOWCODE_CONCEPT_REVIEW;
const REPO = path.resolve(import.meta.dirname, "../../..");
const RECORDED = path.join(REPO, ".flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const PRD = fs.readFileSync(path.join(REPO, "docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
const seed = Object.fromEntries(MODEL.entities.map((e) => [e.key, mergeRecords(e, [], MODEL.seed[e.key] ?? [], { prdRows: prdFixtureRows(e, prdSampleSection(PRD)) }).rows]));
const FIXED = resolveScreenAliases({ ...MODEL, seed }, declaredScreens(PRD));

function copyApp(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-review-"));
  const walk = (from: string, to: string) => {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      if (["node_modules", "dist", ".git"].includes(e.name)) continue;
      const s = path.join(from, e.name);
      const d = path.join(to, e.name);
      if (e.isDirectory()) (fs.mkdirSync(d, { recursive: true }), walk(s, d));
      else fs.copyFileSync(s, d);
    }
  };
  walk(RECORDED, root);
  fs.symlinkSync(path.join(RECORDED, "node_modules"), path.join(root, "node_modules"), "junction");
  for (const f of appFiles(FIXED).filter((f) => !f.path.startsWith("src/screens/"))) (fs.mkdirSync(path.dirname(path.join(root, f.path)), { recursive: true }), fs.writeFileSync(path.join(root, f.path), f.content));
  const css = syncedLibraryCss(root);
  if (css !== undefined) fs.writeFileSync(path.join(root, "src/styles/library.css"), css);
  return root;
}

const servers: ChildProcess[] = [];
let browser: Browser | undefined;
async function serve(root: string, port: number): Promise<string> {
  const p = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  servers.push(p);
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 120; i++) {
    if (await fetch(url).then((r) => r.ok, () => false)) return url;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("vite didn't start");
}
afterAll(async () => {
  await browser?.close();
  for (const p of servers) p.kill();
});

/** What a page renders, for comparing pages of one concept: the shared look should be the same on each. */
const look = (page: Page) =>
  page.evaluate(() => {
    const vis = (e: Element) => e.getBoundingClientRect().width > 20 && e.getBoundingClientRect().height > 10 && getComputedStyle(e).visibility !== "hidden";
    const first = (sel: string) => Array.from(document.querySelectorAll(sel)).find(vis);
    const cs = (e?: Element) => (e ? getComputedStyle(e) : undefined);
    const h = first("main h1, main h2");
    const p = first("main p");
    const btn = first("main button.fl-btn--primary, main .fl-btn--primary, main button[class*='primary']");
    const field = first("main input[type=search], main input[type=text], main input:not([type])");
    const card = first("main [class*='card']");
    const bar = first("header, .fl-lkf-bar");
    const bottom = first(".fl-lkf-bottom nav, .fl-lkf-bottom");
    return {
      heading: h ? { tag: h.tagName.toLowerCase(), font: cs(h)!.fontFamily.split(",")[0], size: cs(h)!.fontSize, weight: cs(h)!.fontWeight } : null,
      text: p ? { font: cs(p)!.fontFamily.split(",")[0], size: cs(p)!.fontSize } : null,
      primaryButton: btn ? { radius: cs(btn)!.borderTopLeftRadius, height: Math.round(btn.getBoundingClientRect().height), bg: cs(btn)!.backgroundColor, shadow: cs(btn)!.boxShadow } : null,
      field: field ? { radius: cs(field)!.borderTopLeftRadius, border: cs(field)!.borderTopWidth, height: Math.round(field.getBoundingClientRect().height) } : null,
      card: card ? { cls: (card as HTMLElement).className.toString().split(" ")[0], radius: cs(card)!.borderTopLeftRadius, border: cs(card)!.borderTopWidth, shadow: cs(card)!.boxShadow } : null,
      page: getComputedStyle(document.body).backgroundColor,
      topBar: bar ? { height: Math.round(bar.getBoundingClientRect().height), bg: cs(bar)!.backgroundColor } : null,
      bottomNav: !!bottom,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });

describe.skipIf(!OUT || !fs.existsSync(path.join(RECORDED, "node_modules")))("concept review material", () => {
  it("captures every concept's journey pages at desktop and mobile width", async () => {
    const product = FIXED.seed.product!.find((r) => r.name === "Oat Milk Original")!;
    const pages = [
      { name: "home", hash: "" },
      { name: "catalog", hash: "#/catalog" },
      { name: "product", hash: `#/product/${encodeURIComponent(product.id)}` },
      { name: "saved", hash: "#/saved" },
    ];
    const review: Record<string, Record<string, unknown>> = {};
    for (const [i, spec] of HOME_CONCEPTS.entries()) {
      const root = copyApp();
      const { app } = makeApp();
      const project = app.projects.create({ name: `Review ${spec.id}`, workspacePath: root });
      applyDesignSpec(app.projects.jail(project), app.ops, { projectId: project.id, runId: "concept_review" }, spec, { frameCss: "src/styles/components.css", screens: [], model: FIXED });
      const url = await serve(root, 5381 + i);
      browser ??= await chromium.launch();
      review[spec.id] = {};
      for (const vp of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(url, { waitUntil: "networkidle" });
        await page.evaluate(() => localStorage.clear());
        // Saved has something in it: the product is saved through the app's own control first.
        await page.goto(`${url}${pages[2]!.hash}`, { waitUntil: "networkidle" });
        const save = page.locator("main").getByRole("button", { name: /^save\b/i }).first();
        if ((await save.count()) && (await save.getAttribute("aria-pressed")) !== "true") await save.click();
        for (const pg of pages) {
          await page.goto(`${url}${pg.hash}`, { waitUntil: "networkidle" });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(OUT!, `${spec.id}-${pg.name}-${vp.name}.png`), fullPage: true });
          (review[spec.id] as Record<string, unknown>)[`${pg.name}-${vp.name}`] = await look(page);
        }
        (review[spec.id] as Record<string, unknown>)[`errors-${vp.name}`] = errors;
        await page.close();
      }
    }
    fs.writeFileSync(path.join(OUT!, "review.json"), JSON.stringify(review, null, 2));
  }, 900_000);
});
