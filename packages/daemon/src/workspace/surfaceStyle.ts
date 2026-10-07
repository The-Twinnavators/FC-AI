/**
 * Styles tab → Surface: change an existing app's surface style (vibe). Rewrites the surface tokens in the app's
 * tokens.css (adding them first to apps made before they existed) and, for apps whose building blocks predate the
 * surface tokens, adds src/styles/surfaces.css with its import in src/main.tsx. Every write goes through the governed,
 * snapshotted file operations, so the change can be undone from the Styles tab.
 */
import fs from "node:fs";
import path from "node:path";
import { SURFACE_DEFAULTS, STYLE_VIBES, styleVibe } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import { applyVibe } from "../orchestrator/starterIdentity.js";
import { templatesRoot } from "../orchestrator/templates.js";

const TOKENS = "src/styles/tokens.css";
const COMPONENTS = "src/styles/components.css";
const SURFACES = "src/styles/surfaces.css";
const MAIN = "src/main.tsx";

const read = (jail: PathJail, rel: string) => {
  try {
    return fs.readFileSync(path.join(jail.root, rel), "utf8");
  } catch {
    return undefined;
  }
};

export interface SurfaceStyleInfo {
  supported: boolean;
  reason?: string;
  current?: string;
  /** Theme colours for the previews (CSS custom property → value). */
  colors: Record<string, string>;
}

/** The app's current surface style and whether it can be changed here. */
export function surfaceStyleOf(jail: PathJail): SurfaceStyleInfo {
  const tokens = read(jail, TOKENS);
  const colors: Record<string, string> = {};
  if (tokens) {
    const root = tokens.slice(0, tokens.indexOf("}", tokens.indexOf(":root")) + 1);
    // Every :root token, so references resolve: the previews render in FlowCode's page, where the app's own
    // --neutral-900 or --brand-primary-600 don't exist (the Surface page showed blank cards and invisible buttons).
    const all = new Map<string, string>();
    for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) if (!all.has(m[1])) all.set(m[1], m[2].trim());
    const resolve = (v: string, depth = 0): string =>
      depth > 8 || !v.includes("var(") ? v : resolve(v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (whole, name: string, fallback?: string) => all.get(name) ?? fallback?.trim() ?? whole), depth + 1);
    for (const [name, value] of all) if (/^--(?:color-[\w-]+|neutral-\d+|brand-[\w-]+|status-[\w-]+|border-width|radius-(?:sm|md|lg|xl))$/.test(name)) colors[name] = resolve(value);
  }
  if (!tokens) return { supported: false, reason: "This app has no src/styles/tokens.css, so its surfaces aren't drawn from tokens.", colors };
  if (!fs.existsSync(path.join(jail.root, "src/components/ui/index.tsx")))
    return { supported: false, reason: "This app doesn't use FlowCode's building blocks yet. Ask FlowCode to rebuild its screens first (it adds them).", colors };
  const named = /\/\* Surface style: ([^(]+?) \(/.exec(tokens)?.[1]?.trim();
  const current = STYLE_VIBES.find((v) => v.name === named)?.id ?? (tokens.includes("--surface-bg") ? "flat" : undefined);
  return { supported: true, current, colors };
}

/** Switches the app to another surface style. Returns the snapshots to restore for undo. */
export function setSurfaceStyle(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }, vibeId: string): { snapshotIds: string[]; changed: string[] } {
  const vibe = styleVibe(vibeId);
  if (!vibe) throw new Error("Unknown surface style.");
  const info = surfaceStyleOf(jail);
  if (!info.supported) throw new Error(info.reason ?? "This app's surface style can't be changed here.");
  const op = { jail, projectId: ctx.projectId, runId: ctx.runId, approved: false };
  const snapshotIds: string[] = [];
  const changed: string[] = [];
  const keep = (r: { ok: boolean; message?: string; snapshotIds?: string[] }, rel: string) => {
    if (!r.ok) throw new Error(r.message ?? `Couldn't update ${rel}`);
    snapshotIds.push(...(r.snapshotIds ?? []));
    changed.push(rel);
  };

  // 1. Tokens: add the surface section to older apps, then write the chosen values.
  let tokens = read(jail, TOKENS)!;
  if (!tokens.includes("--surface-bg")) {
    const end = tokens.indexOf("}", tokens.indexOf(":root"));
    if (end < 0) throw new Error("Couldn't find the :root block in tokens.css.");
    const section = `\n  /* Surface style: Flat (how cards, panels, buttons and inputs are drawn; set by the chosen vibe) */\n${Object.entries(SURFACE_DEFAULTS)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n")}\n`;
    tokens = `${tokens.slice(0, end).replace(/\s*$/, "\n")}${section}${tokens.slice(end)}`;
  }
  const next = applyVibe(tokens, vibe);
  if (next !== read(jail, TOKENS)) keep(ops.replaceContent(op, TOKENS, next), TOKENS);

  // 2. Older building blocks: connect them to the surface tokens.
  const components = read(jail, COMPONENTS) ?? "";
  if (!components.includes("var(--surface-") && !fs.existsSync(path.join(jail.root, SURFACES))) {
    keep(ops.create_file(op, { path: SURFACES, content: fs.readFileSync(path.join(templatesRoot(), "layouts/surfaces.css"), "utf8") }), SURFACES);
    const main = read(jail, MAIN);
    if (main && !main.includes("surfaces.css")) {
      const after = main.includes('import "./styles/components.css";') ? main.replace('import "./styles/components.css";', 'import "./styles/components.css";\nimport "./styles/surfaces.css";') : `import "./styles/surfaces.css";\n${main}`;
      keep(ops.replaceContent(op, MAIN, after), MAIN);
    }
  }
  return { snapshotIds, changed };
}
