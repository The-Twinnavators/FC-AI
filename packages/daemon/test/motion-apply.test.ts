/**
 * Motion through the Look on an existing app (workspace/motionStyle.ts via designState.applySelected), on a copy of the
 * recorded Clean Cart app (made before motion levels, with the old blanket reduced-motion rule):
 *  - nothing changes until a Look with a motion level is applied (a direction made before motion leaves motion alone);
 *  - applying adds the motion tokens, the motion stylesheet and its import, and removes the blanket rule; nothing else
 *    outside the Look's own files changes;
 *  - changing only the level afterwards writes only motion tokens: colours, fonts, surface, layout and an advanced token
 *    edit made since all stay.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BASE_APPEARANCE, motionTokens, type Appearance } from "@flowcode/contracts";
import { applySelected, saveDraft, selectDraft } from "../src/workspace/designState.js";
import { LEGACY_REDUCED_MOTION, MOTION_UNSUPPORTED, setMotionStyle } from "../src/workspace/motionStyle.js";
import { describeState } from "../src/workspace/designState.js";
import { makeApp } from "./helpers.js";

const REPO = path.resolve(import.meta.dirname, "../../..");
const RECORDED = path.join(REPO, ".flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const LOOK: Appearance = { ...BASE_APPEARANCE, surface: "skeuomorphism", primary: "#1f6f43", neutral: "warm", fonts: { display: "Fraunces", body: "Work Sans" } };

function copyApp(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-motion-"));
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
  return root;
}
const hashes = (root: string) => {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (["node_modules", "dist", ".git"].includes(e.name)) continue;
      if (e.isDirectory()) walk(rel);
      else out[rel] = createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex");
    }
  };
  walk(".");
  return out;
};
const changedFiles = (a: Record<string, string>, b: Record<string, string>) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
const tokenLines = (css: string) => css.split(/\r?\n/).filter((l) => /^\s*--[\w-]+\s*:/.test(l));

describe.skipIf(!fs.existsSync(RECORDED))("motion on an existing app, through the Look", () => {
  it("an existing app keeps its motion until a Look with a level is applied; a direction made before motion leaves it alone", () => {
    const root = copyApp();
    expect(LEGACY_REDUCED_MOTION.test(fs.readFileSync(path.join(root, "src/styles/app.css"), "utf8"))).toBe(true);
    const { app } = makeApp();
    const p = app.projects.create({ name: "Old look", workspacePath: root });
    const jail = app.projects.jail(p);
    saveDraft(app.store, p.id, { ...LOOK, motion: undefined }, { primary: "you" }, jail);
    selectDraft(app.store, p.id, jail);
    expect(applySelected(app.store, p.id, jail, app.ops, { projectId: p.id, runId: "look" }, (id) => void app.snapshots.restore(id, jail)).ok).toBe(true);
    expect(fs.existsSync(path.join(root, "src/styles/motion.css"))).toBe(false);
    expect(LEGACY_REDUCED_MOTION.test(fs.readFileSync(path.join(root, "src/styles/app.css"), "utf8"))).toBe(true);
    expect(fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8")).not.toContain("--stagger-max");
  });

  it("applying a level adds motion and removes the blanket rule; then a level-only change writes only motion tokens", () => {
    const root = copyApp();
    const { app } = makeApp();
    const p = app.projects.create({ name: "Motion", workspacePath: root });
    const jail = app.projects.jail(p);
    const restore = (id: string) => void app.snapshots.restore(id, jail);
    const before = hashes(root);
    saveDraft(app.store, p.id, { ...LOOK, motion: { level: "balanced" } }, { primary: "you" }, jail);
    selectDraft(app.store, p.id, jail);
    expect(applySelected(app.store, p.id, jail, app.ops, { projectId: p.id, runId: "look" }, restore).ok).toBe(true);
    const applied = hashes(root);
    // Only the Look's own files: tokens, the surface and motion stylesheets, their imports, and app.css's old rule.
    expect(changedFiles(before, applied).filter((f) => !/^src\/(styles\/|main\.tsx$)|^public\//.test(f))).toEqual([]);
    for (const f of ["src/App.tsx", "src/app/schema.ts", "src/app/store.ts", "src/app/routes.ts", "src/app/lookup.ts"]) expect(applied[f], f).toBe(before[f]);
    expect(fs.readFileSync(path.join(root, "src/styles/motion.css"), "utf8")).toContain("prefers-reduced-motion");
    expect(fs.readFileSync(path.join(root, "src/main.tsx"), "utf8")).toContain('import "./styles/motion.css";');
    const appCss = fs.readFileSync(path.join(root, "src/styles/app.css"), "utf8");
    expect(LEGACY_REDUCED_MOTION.test(appCss)).toBe(false);
    expect(appCss).not.toContain("0.01ms !important");
    const tokens = fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");
    for (const [k, v] of Object.entries(motionTokens("balanced"))) expect(tokens, k).toMatch(new RegExp(`${k}:\\s*${v.replace(".", "\\.")};`));

    // An advanced edit since (Tokens tab), then only the level changes.
    const advanced = tokens.replace(/--color-accent:\s*[^;]+;/, "--color-accent: #123456;");
    fs.writeFileSync(path.join(root, "src/styles/tokens.css"), advanced);
    const mid = hashes(root);
    saveDraft(app.store, p.id, { ...LOOK, motion: { level: "expressive" } }, { primary: "you" }, jail);
    selectDraft(app.store, p.id, jail);
    expect(applySelected(app.store, p.id, jail, app.ops, { projectId: p.id, runId: "look" }, restore).ok).toBe(true);
    const after = hashes(root);
    expect(changedFiles(mid, after)).toEqual(["src/styles/tokens.css"]);
    const now = fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");
    const was = tokenLines(advanced);
    const is = tokenLines(now);
    const differ = is.filter((l, i) => l !== was[i]).map((l) => l.trim().split(":")[0]);
    expect(differ.sort()).toEqual(Object.keys(motionTokens("expressive")).filter((k) => motionTokens("expressive")[k] !== motionTokens("balanced")[k]).sort());
    expect(now).toContain("--color-accent: #123456;");
  });
});

describe("motion and Angular apps (the framework boundary)", () => {
  const angularApp = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-ng-"));
    fs.cpSync(path.join(REPO, "templates/angular-starter"), root, { recursive: true });
    return root;
  };
  it("the motion writer refuses an Angular app; the Look says motion isn't supported there", () => {
    const root = angularApp();
    const { app } = makeApp();
    const p = app.projects.create({ name: "ng", workspacePath: root });
    const jail = app.projects.jail(p);
    expect(() => setMotionStyle(jail, app.ops, { projectId: p.id, runId: "x" })).toThrow(MOTION_UNSUPPORTED);
    expect(describeState(app.store, p.id, jail).motionSupported).toBe(false);
  });
  it("applying a Look with a level to an Angular app writes no motion (none of it, even when the apply fails later)", () => {
    const root = angularApp();
    const appCss = fs.readFileSync(path.join(root, "src/styles/app.css"), "utf8");
    const tokens = fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");
    const { app } = makeApp();
    const p = app.projects.create({ name: "ng", workspacePath: root });
    const jail = app.projects.jail(p);
    saveDraft(app.store, p.id, { ...LOOK, motion: { level: "expressive" } }, {}, jail);
    selectDraft(app.store, p.id, jail);
    // A restore that does nothing: what's left on disk is only what was written.
    const res = applySelected(app.store, p.id, jail, app.ops, { projectId: p.id, runId: "x" }, () => undefined);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/building blocks/);
    expect(fs.existsSync(path.join(root, "src/styles/motion.css"))).toBe(false);
    expect(fs.readFileSync(path.join(root, "src/styles/app.css"), "utf8")).toBe(appCss);
    expect(fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8")).toBe(tokens);
  });
});
