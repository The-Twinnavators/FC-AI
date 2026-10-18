/**
 * Motion for an existing app, written only when a Look with a motion level is applied (designState.applySelected): the
 * motion tokens are added to tokens.css where an older app lacks them (their values are then set by the Look), the
 * starter's motion stylesheet (reduced motion, animation off, page and result transitions, dialogs, collapse, tab
 * indicator) is added with its import, and the old blanket reduced-motion rule (0.01ms !important on everything, which
 * erased the quick fades reduced motion keeps) is taken out of app.css. Every write goes through the governed,
 * snapshotted file operations, so Undo in Changes puts it back. Nothing else in the app changes.
 */
import fs from "node:fs";
import path from "node:path";
import { motionTokens } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import { templatesRoot } from "../orchestrator/templates.js";

const TOKENS = "src/styles/tokens.css";
const MOTION = "src/styles/motion.css";
const APP_CSS = "src/styles/app.css";
const MAIN = "src/main.tsx";

/**
 * Whether the app has FlowCode's motion foundation to apply a level to: a React app (src/main.tsx, where motion.css is
 * imported and lib/motion.ts lives). An Angular app shares the token file's names but not the foundation, so a level
 * isn't applied there (its tokens and its own reduced-motion rule are left as they are).
 */
export const motionSupported = (jail: PathJail) => fs.existsSync(path.join(jail.root, MAIN));
export const MOTION_UNSUPPORTED = "Motion level not applied: this app isn't a React app, and FlowCode's motion foundation is React only (its own motion and reduced-motion rule are unchanged)";

/** The old starter's blanket rule, as every app made before motion levels has it. */
export const LEGACY_REDUCED_MOTION = /\n?@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{\s*transition-duration: 0\.01ms !important;\s*animation-duration: 0\.01ms !important;\s*\}\s*\}\n?/;

const read = (jail: PathJail, rel: string) => {
  try {
    return fs.readFileSync(path.join(jail.root, rel), "utf8");
  } catch {
    return undefined;
  }
};

export const motionStylesheet = () => fs.readFileSync(path.join(templatesRoot(), "react-vite-starter/src/styles/motion.css"), "utf8");

export function setMotionStyle(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }): { snapshotIds: string[]; changed: string[] } {
  if (!motionSupported(jail)) throw new Error(MOTION_UNSUPPORTED);
  const op = { jail, projectId: ctx.projectId, runId: ctx.runId, approved: false };
  const snapshotIds: string[] = [];
  const changed: string[] = [];
  const keep = (r: { ok: boolean; message?: string; snapshotIds?: string[] }, rel: string) => {
    if (!r.ok) throw new Error(r.message ?? `Couldn't update ${rel}`);
    snapshotIds.push(...(r.snapshotIds ?? []));
    changed.push(rel);
  };

  // 1. Tokens an older app doesn't have yet (Balanced values; the Look's level is written right after).
  const tokens = read(jail, TOKENS);
  if (tokens === undefined) throw new Error("This app has no src/styles/tokens.css, so its motion can't be set here.");
  const missing = Object.entries(motionTokens("balanced")).filter(([k]) => !new RegExp(`${k}\\s*:`).test(tokens));
  if (missing.length) {
    const end = tokens.indexOf("}", tokens.indexOf(":root"));
    if (end < 0) throw new Error("Couldn't find the :root block in tokens.css.");
    const section = `\n  /* Motion (the Look's motion level), added by FlowCode */\n${missing.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n`;
    keep(ops.replaceContent(op, TOKENS, `${tokens.slice(0, end).replace(/\s*$/, "\n")}${section}${tokens.slice(end)}`), TOKENS);
  }

  // 2. The motion stylesheet and its import (after the building blocks, so its reduced-motion values win).
  const sheet = motionStylesheet();
  const current = read(jail, MOTION);
  if (current === undefined) keep(ops.create_file(op, { path: MOTION, content: sheet }), MOTION);
  const main = read(jail, MAIN);
  if (main && !main.includes("motion.css")) {
    const anchor = ['import "./styles/surfaces.css";', 'import "./styles/components.css";'].find((a) => main.includes(a));
    const after = anchor ? main.replace(anchor, `${anchor}\nimport "./styles/motion.css";`) : `import "./styles/motion.css";\n${main}`;
    keep(ops.replaceContent(op, MAIN, after), MAIN);
  }

  // 3. The old blanket rule would override the fades reduced motion keeps.
  const appCss = read(jail, APP_CSS);
  if (appCss && LEGACY_REDUCED_MOTION.test(appCss)) {
    keep(ops.replaceContent(op, APP_CSS, appCss.replace(LEGACY_REDUCED_MOTION, "\n/* Reduced motion and \"animation off\" are handled in motion.css. */\n")), APP_CSS);
  }
  return { snapshotIds, changed };
}
