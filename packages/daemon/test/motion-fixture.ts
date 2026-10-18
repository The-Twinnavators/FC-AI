/**
 * A generated look-up app with today's motion foundation, for the motion tests and recordings: the recorded Clean Cart
 * app (its screens as the build wrote them, its installed packages) brought up to today's writers - the starter's
 * router, motion helpers, entry file and motion stylesheet, the library's look-up pieces, the app files from the app
 * model, the synced library styles - with the motion tokens a new app ships and without the old blanket rule.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { motionTokens, type MotionLevel } from "@flowcode/contracts";
import { appFiles } from "../src/orchestrator/appFiles.js";
import { prdSampleSection, resolveScreenAliases, type AppModel } from "../src/orchestrator/appModel.js";
import { declaredScreens } from "../src/orchestrator/screenPlan.js";
import { mergeRecords, prdFixtureRows } from "../src/orchestrator/recordIdentity.js";
import { pieceFiles, syncedLibraryCss } from "../src/orchestrator/sectionRecipes.js";
import { LOOKUP_PIECES } from "../src/orchestrator/lookupFiles.js";
import { LEGACY_REDUCED_MOTION } from "../src/workspace/motionStyle.js";

export const REPO = path.resolve(import.meta.dirname, "../../..");
export const RECORDED = path.join(REPO, ".flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const STARTER = path.join(REPO, "templates/react-vite-starter");
export const hasRecordedApp = () => fs.existsSync(path.join(RECORDED, "node_modules"));

export function fixtureModel(): AppModel {
  const PRD = fs.readFileSync(path.join(REPO, "docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
  const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
  const seed = Object.fromEntries(MODEL.entities.map((e) => [e.key, mergeRecords(e, [], MODEL.seed[e.key] ?? [], { prdRows: prdFixtureRows(e, prdSampleSection(PRD)) }).rows]));
  return resolveScreenAliases({ ...MODEL, seed }, declaredScreens(PRD));
}

/** Writes a motion level's tokens into the app's tokens.css (as applying a Look does). */
export function setLevel(root: string, level: MotionLevel) {
  const file = path.join(root, "src/styles/tokens.css");
  let css = fs.readFileSync(file, "utf8");
  for (const [k, v] of Object.entries(motionTokens(level))) css = css.replace(new RegExp(`(${k}\\s*:\\s*)[^;]+;`), `$1${v};`);
  fs.writeFileSync(file, css);
}

export function motionFixtureApp(level: MotionLevel = "balanced"): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-motionapp-"));
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
  const put = (rel: string, content: string) => (fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }), fs.writeFileSync(path.join(root, rel), content));
  for (const rel of ["src/lib/motion.ts", "src/lib/motion.test.ts", "src/lib/screens.ts", "src/lib/screens.test.ts", "src/main.tsx", "src/styles/motion.css"]) put(rel, fs.readFileSync(path.join(STARTER, rel), "utf8"));
  const seen = new Set<string>();
  for (const f of LOOKUP_PIECES.flatMap((id) => pieceFiles(id, seen))) put(f.rel, f.content);
  // Today's screens too, except the Home page the build's design step composed.
  for (const f of appFiles(fixtureModel()).filter((f) => f.path !== "src/screens/LandingScreen.tsx")) put(f.path, f.content);
  const css = syncedLibraryCss(root);
  if (css !== undefined) put("src/styles/library.css", css);
  const appCss = path.join(root, "src/styles/app.css");
  fs.writeFileSync(appCss, fs.readFileSync(appCss, "utf8").replace(LEGACY_REDUCED_MOTION, "\n"));
  // The motion tokens a new app has (the recorded app predates them).
  const tokens = path.join(root, "src/styles/tokens.css");
  const t = fs.readFileSync(tokens, "utf8");
  const missing = Object.entries(motionTokens("balanced")).filter(([k]) => !new RegExp(`${k}\\s*:`).test(t));
  const end = t.indexOf("}", t.indexOf(":root"));
  fs.writeFileSync(tokens, `${t.slice(0, end)}\n${missing.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n${t.slice(end)}`);
  setLevel(root, level);
  return root;
}
