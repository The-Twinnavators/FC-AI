/**
 * Applying a look to a generated app (workspace/designState.ts): on the regenerated Clean Cart app, a selected
 * direction applied after the app exists changes only its styles; its data, store, routes and pages are byte-identical
 * and the functional journey still passes. Also renders Bold aisle, now Flat by default, and Bold aisle's layout in the
 * person's own look, for review (screenshots when FLOWCODE_SPEC_SHOTS is set). Needs the recorded workspace and a browser.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { BASE_APPEARANCE, type Appearance } from "@flowcode/contracts";
import { appFiles } from "../src/orchestrator/appFiles.js";
import { prdNamedRecords, prdSampleSection, resolveScreenAliases, type AppModel } from "../src/orchestrator/appModel.js";
import { declaredScreens } from "../src/orchestrator/screenPlan.js";
import { mergeRecords, prdFixtureRows } from "../src/orchestrator/recordIdentity.js";
import { syncedLibraryCss } from "../src/orchestrator/sectionRecipes.js";
import { journeyPlan, runJourney } from "../src/quality/appJourney.js";
import { applyDesignSpec } from "../src/workspace/designSpec.js";
import { applySelected, describeState, saveDraft, selectDraft } from "../src/workspace/designState.js";
import { HOME_CONCEPTS } from "../src/workspace/homeConcepts.js";
import { makeApp } from "./helpers.js";

const REPO = path.resolve(import.meta.dirname, "../../..");
const RECORDED = path.join(REPO, ".flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const PRD = fs.readFileSync(path.join(REPO, "docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
const seed = Object.fromEntries(MODEL.entities.map((e) => [e.key, mergeRecords(e, [], MODEL.seed[e.key] ?? [], { prdRows: prdFixtureRows(e, prdSampleSection(PRD)) }).rows]));
const FIXED = resolveScreenAliases({ ...MODEL, seed }, declaredScreens(PRD));
const SCREENS = declaredScreens(PRD);
const NAMED = prdNamedRecords(prdSampleSection(PRD));
const SHOTS = process.env.FLOWCODE_SPEC_SHOTS;
const LOOK: Appearance = { ...BASE_APPEARANCE, surface: "skeuomorphism", primary: "#1f6f43", neutral: "warm", fonts: { display: "Fraunces", body: "Work Sans" } };

function copyApp(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-look-"));
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
const hashes = (root: string) => {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (["node_modules", "dist", ".git", "public"].includes(e.name)) continue;
      if (e.isDirectory()) walk(rel);
      else out[rel] = createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex");
    }
  };
  walk(".");
  return out;
};
const servers: ChildProcess[] = [];
let browser: Browser | undefined;
async function serve(root: string, port: number) {
  const p = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  servers.push(p);
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 120 && !(await fetch(url).then((r) => r.ok, () => false)); i++) await new Promise((r) => setTimeout(r, 500));
  return url;
}
async function shots(url: string, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  browser ??= await chromium.launch();
  for (const vp of [{ n: "desktop", width: 1440, height: 900 }, { n: "mobile", width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.n}.png`), fullPage: true });
    await page.close();
  }
}
afterAll(async () => {
  await browser?.close();
  for (const p of servers) p.kill();
});

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1" || !fs.existsSync(path.join(RECORDED, "node_modules")))("applying a look to a generated app", () => {
  it("changes only styles: data, store, routes and pages byte-identical; the journey still passes", async () => {
    const root = copyApp();
    const before = hashes(root);
    const { app } = makeApp();
    const project = app.projects.create({ name: "Look", workspacePath: root });
    const jail = app.projects.jail(project);
    saveDraft(app.store, project.id, LOOK, { primary: "you" }, jail);
    selectDraft(app.store, project.id, jail);
    const res = applySelected(app.store, project.id, jail, app.ops, { projectId: project.id, runId: "look" }, (id) => void app.snapshots.restore(id, jail));
    expect(res.ok).toBe(true);
    expect(describeState(app.store, project.id, jail).label).toBe("Applied");
    const after = hashes(root);
    const changed = Object.keys(after).filter((p) => before[p] !== after[p]);
    expect(changed.filter((p) => !/^src\/(styles\/|main\.tsx$)/.test(p) && !p.startsWith("public/"))).toEqual([]);
    for (const p of ["src/app/schema.ts", "src/app/store.ts", "src/app/lookup.ts", "src/app/routes.ts", "src/App.tsx"]) expect(after[p], p).toBe(before[p]);
    const url = await serve(root, 5401);
    browser ??= await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const journey = await runJourney(page, url, journeyPlan(FIXED, SCREENS, NAMED));
    await page.close();
    expect(journey.steps.filter((s) => !s.ok).map((s) => `${s.step}: ${s.detail}`)).toEqual([]);
    const font = await (async () => {
      const p = await browser!.newPage();
      await p.goto(url, { waitUntil: "networkidle" });
      const f = await p.evaluate(() => getComputedStyle(document.querySelector("h1, h2")!).fontFamily);
      await p.close();
      return f;
    })();
    expect(font).toMatch(/Fraunces/);
    await shots(url, "look-applied-default-home");
  }, 300_000);

  it("Bold aisle renders Flat by default, and in the person's look when they chose one (layout kept, branding kept)", async () => {
    const bold = HOME_CONCEPTS.find((c) => c.id === "concept-bold")!;
    expect(bold.surface.vibe).toBe("flat");
    // Its own (Flat) look.
    const a = copyApp();
    const { app } = makeApp();
    const pa = app.projects.create({ name: "Bold flat", workspacePath: a });
    applyDesignSpec(app.projects.jail(pa), app.ops, { projectId: pa.id, runId: "bold" }, bold, { frameCss: "src/styles/components.css", screens: [], model: FIXED });
    const ua = await serve(a, 5402);
    browser ??= await chromium.launch();
    const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pg.goto(ua, { waitUntil: "networkidle" });
    const card = await pg.evaluate(() => {
      const c = document.querySelector("main [class*='card']")!;
      const s = getComputedStyle(c);
      return { border: s.borderTopWidth, shadow: s.boxShadow, radius: s.borderTopLeftRadius, heading: getComputedStyle(document.querySelector("h1")!).fontFamily };
    });
    await pg.close();
    expect(card.border).toBe("1px");
    expect(card.shadow).toBe("none");
    expect(card.heading).toMatch(/Oswald/);
    await shots(ua, "bold-aisle-flat-home");
    // The person's look, with Bold aisle's layout: their tokens stay, the Home page is the listings page.
    const b = copyApp();
    const pb = app.projects.create({ name: "Bold in my look", workspacePath: b });
    const jb = app.projects.jail(pb);
    saveDraft(app.store, pb.id, LOOK, {}, jb);
    selectDraft(app.store, pb.id, jb);
    applySelected(app.store, pb.id, jb, app.ops, { projectId: pb.id, runId: "look" }, (id) => void app.snapshots.restore(id, jb));
    const branded = fs.readFileSync(path.join(b, "src/styles/tokens.css"), "utf8");
    applyDesignSpec(jb, app.ops, { projectId: pb.id, runId: "bold" }, bold, { frameCss: "src/styles/components.css", screens: [], model: FIXED, layoutOnly: true });
    expect(fs.readFileSync(path.join(b, "src/styles/tokens.css"), "utf8")).toBe(branded);
    expect(fs.readFileSync(path.join(b, "src/screens/LandingScreen.tsx"), "utf8")).toContain("<LookupHomeListings");
    const ub = await serve(b, 5403);
    const pg2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pg2.goto(ub, { waitUntil: "networkidle" });
    expect(await pg2.evaluate(() => getComputedStyle(document.querySelector("h1")!).fontFamily)).toMatch(/Fraunces/);
    expect(await pg2.locator("[data-fl='p.lookup-home.listings']").count()).toBe(1);
    await pg2.close();
    await shots(ub, "bold-aisle-in-your-look-home");
  }, 300_000);
});
