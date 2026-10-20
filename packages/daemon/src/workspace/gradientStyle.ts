/**
 * Look → Colour → Gradient: the uses no token reaches on its own. Main buttons and the page background read tokens the
 * Look sets (--accent-bg, --page-backdrop); page titles and feature panels need rules, so they are written as one
 * managed block at the end of src/styles/components.css, rewritten on each apply and removed when neither is used.
 * Feature panels are the kit's promo panel and anything marked class="fl-gradient-panel". Snapshotted, so Undo puts
 * it back with the rest of the apply.
 */
import fs from "node:fs";
import path from "node:path";
import { gradientOf, type Appearance } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";

const COMPONENTS = "src/styles/components.css";
const START = "/* FlowCode gradient uses (Look → Colour → Gradient). Written over on each apply. */";
const END = "/* End of FlowCode gradient uses */";
/** The kit's feature panels, and the class the builder puts on a hero or highlight panel. */
export const GRADIENT_PANELS = [".fl-gradient-panel", ".fl-as-promo"];

/** The rules for the Look's title and panel uses, or "" when it uses neither. */
export function gradientRules(a: Appearance): string {
  const uses = gradientOf(a)?.uses ?? [];
  const rules: string[] = [];
  if (uses.includes("headline"))
    rules.push("h1 { background-image: var(--gradient); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }");
  if (uses.includes("panels")) rules.push(`${GRADIENT_PANELS.join(", ")} { background: var(--gradient); color: var(--color-on-accent); }`);
  return rules.length ? `${START}\n${rules.join("\n")}\n${END}\n` : "";
}

/** Writes (or removes) the managed block. Apps without components.css are left alone. */
export function setGradientRules(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }, a: Appearance): { snapshotIds: string[]; changed: string[] } {
  const abs = path.join(jail.root, COMPONENTS);
  if (!fs.existsSync(abs)) return { snapshotIds: [], changed: [] };
  const css = fs.readFileSync(abs, "utf8");
  const a0 = css.indexOf(START);
  const b0 = css.indexOf(END);
  const without = a0 >= 0 && b0 > a0 ? css.slice(0, a0).replace(/\s*$/, "\n") + css.slice(b0 + END.length).replace(/^\s*\n/, "") : css;
  const block = gradientRules(a);
  const next = block ? `${without.replace(/\s*$/, "\n")}\n${block}` : without;
  if (next === css) return { snapshotIds: [], changed: [] };
  const r = ops.replaceContent({ jail, projectId: ctx.projectId, runId: ctx.runId, approved: false }, COMPONENTS, next);
  if (!r.ok) throw new Error(r.message ?? `Couldn't update ${COMPONENTS}`);
  return { snapshotIds: r.snapshotIds ?? [], changed: [COMPONENTS] };
}
