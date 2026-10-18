/**
 * Two narrow frame corrections from the concept review, approved before eval 4:
 * A. Saved is the bookmark in the frame's navigation (the phone's bottom bar), as Save is everywhere (the heart is Like).
 * B. No frame ZIP banner on a record's page (it has its own "Where to find it" form) or at phone width (it took most
 *    of the first screen); the page's own form and the top bar's ZIP control stay.
 * Checked on the generated source, then in the browser on the regenerated Clean Cart app with Bold aisle applied.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { appFiles } from "../src/orchestrator/appFiles.js";
import { lookupLinks } from "../src/orchestrator/lookupFiles.js";
import { prdSampleSection, resolveScreenAliases, type AppModel } from "../src/orchestrator/appModel.js";
import { declaredScreens } from "../src/orchestrator/screenPlan.js";
import { mergeRecords, prdFixtureRows } from "../src/orchestrator/recordIdentity.js";
import { syncedLibraryCss } from "../src/orchestrator/sectionRecipes.js";
import { applyDesignSpec } from "../src/workspace/designSpec.js";
import { HOME_CONCEPTS } from "../src/workspace/homeConcepts.js";
import { makeApp } from "./helpers.js";

const REPO = path.resolve(import.meta.dirname, "../../..");
const RECORDED = path.join(REPO, ".flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const PRD = fs.readFileSync(path.join(REPO, "docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
const seed = Object.fromEntries(MODEL.entities.map((e) => [e.key, mergeRecords(e, [], MODEL.seed[e.key] ?? [], { prdRows: prdFixtureRows(e, prdSampleSection(PRD)) }).rows]));
const FIXED = resolveScreenAliases({ ...MODEL, seed }, declaredScreens(PRD));
const BOOKMARK = "M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z";

describe("the frame's Saved icon and ZIP banner (source)", () => {
  it("A: Saved is the bookmark, even when the model gave it the heart", () => {
    const withHeart: AppModel = { ...FIXED, nav: FIXED.nav.map((g) => ({ ...g, items: g.items.map((v) => (v.kind === "saved" ? { ...v, icon: "heart" } : v)) })) };
    expect(lookupLinks(withHeart, {}).find((l) => l.id === "saved")?.icon).toBe("bookmark");
    expect(appFiles(FIXED).find((f) => f.path === "src/App.tsx")!.content).toMatch(/"id": "saved",\s*"label": "Saved",\s*"icon": "bookmark"/);
  });

  it("B: the frame's ZIP banner is left out on Home and on the product's page", () => {
    const app = appFiles(FIXED).find((f) => f.path === "src/App.tsx")!.content;
    expect(app).toContain('prompt={screen === "landing" || screen === "product" ? undefined : <ZipPrompt lookup={lookup} />}');
  });
});

const servers: ChildProcess[] = [];
let browser: Browser | undefined;
afterAll(async () => {
  await browser?.close();
  for (const p of servers) p.kill();
});

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1" || !fs.existsSync(path.join(RECORDED, "node_modules")))("the frame's Saved icon and ZIP banner (in the browser)", () => {
  it("phone: Saved shows the bookmark with its label; no banner; the top bar still sets the ZIP code. Product keeps one ZIP form", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-frame-"));
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
    const { app } = makeApp();
    const project = app.projects.create({ name: "Frame", workspacePath: root });
    applyDesignSpec(app.projects.jail(project), app.ops, { projectId: project.id, runId: "frame" }, HOME_CONCEPTS.find((c) => c.id === "concept-bold")!, { frameCss: "src/styles/components.css", screens: [], model: FIXED });
    const p = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--port", "5395", "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    servers.push(p);
    const url = "http://127.0.0.1:5395/";
    for (let i = 0; i < 120 && !(await fetch(url).then((r) => r.ok, () => false)); i++) await new Promise((r) => setTimeout(r, 500));
    browser ??= await chromium.launch();
    const product = FIXED.seed.product!.find((r) => r.name === "Oat Milk Original")!;
    const banner = (page: import("playwright").Page) => page.locator(".fl-lkf-prompt").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0).length);

    // Phone width.
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    phone.on("pageerror", (e) => errors.push(e.message));
    await phone.goto(`${url}#/catalog`, { waitUntil: "networkidle" });
    expect(await banner(phone), "no ZIP banner on a phone").toBe(0);
    // A: the bottom bar's Saved: its accessible name, and the bookmark drawn.
    const saved = phone.locator(".fl-lkf-bottom").getByRole("button", { name: /^Saved/ }).or(phone.locator(".fl-lkf-bottom").getByRole("link", { name: /^Saved/ })).first();
    expect(await saved.count(), "Saved in the phone's bottom bar, named").toBe(1);
    expect(await saved.locator("svg path").first().getAttribute("d")).toBe(BOOKMARK);
    await saved.click();
    await phone.waitForTimeout(300);
    expect(await phone.evaluate(() => location.hash)).toBe("#/saved");
    // B: the top bar still sets the ZIP code on a phone.
    const chip = phone.getByRole("button", { name: /Add your ZIP code/ });
    expect(await chip.isVisible()).toBe(true);
    await chip.click();
    expect(await chip.getAttribute("aria-expanded")).toBe("true");
    const dialog = phone.getByRole("dialog", { name: /ZIP code/ });
    await dialog.locator("input").first().fill("94110");
    await dialog.locator("input").first().press("Enter");
    await phone.waitForTimeout(300);
    expect(await phone.getByRole("button", { name: /Near 94110/ }).count(), "the ZIP code was set from the top bar").toBeGreaterThan(0);
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no sideways scroll").toBe(true);
    expect(errors).toEqual([]);
    await phone.close();

    // Desktop: Product has one ZIP form, its own; other pages keep the banner.
    const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desk.goto(`${url}#/product/${encodeURIComponent(product.id)}`, { waitUntil: "networkidle" });
    expect(await banner(desk), "no frame banner on Product").toBe(0);
    expect(await desk.getByRole("heading", { name: "Where to find it" }).count(), "the page's own ZIP form stays").toBe(1);
    await desk.goto(`${url}#/catalog`, { waitUntil: "networkidle" });
    expect(await banner(desk), "the banner stays on Catalog at desktop width").toBe(1);
    await desk.close();
  }, 180_000);
});
