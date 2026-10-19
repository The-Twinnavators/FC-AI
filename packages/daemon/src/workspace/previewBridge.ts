/**
 * The design preview bridge: lets FlowCode's Design direction page show a draft Look on the project's own running app
 * without writing it. The app's preview listener (src/main.tsx, already there for light/dark and animation off) also
 * takes "flowcode:tokens" (custom properties set inline on the page, cleared with null), "flowcode:fonts" (bundled
 * font faces to load for the draft) and answers "flowcode:hello" with "flowcode:ready". Only FlowCode's preview frame
 * sends these; nothing is stored, and a reload shows the app's real styles.
 *
 * New apps get it from the starter template; an app made before it gets it once, when the person turns on the live
 * design preview: one governed, snapshotted edit of src/main.tsx (Undo in Changes takes it out).
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";

const MAIN = "src/main.tsx";
export const BRIDGE_MARK = "flowcode:tokens";

/** The helper the listener calls: kept with the listener in main.tsx (no new file, no dependency). */
export const BRIDGE_HELPER = `// FlowCode's design preview: a draft Look's tokens and fonts, shown live in FlowCode's preview frame only (nothing is
// saved; a reload shows the app's own styles).
let previewed: string[] = [];
const previewTokens = (tokens: Record<string, string> | null) => {
  const s = document.documentElement.style;
  for (const k of previewed) s.removeProperty(k);
  previewed = [];
  for (const [k, v] of Object.entries(tokens ?? {})) if (k.startsWith("--")) (s.setProperty(k, v), previewed.push(k));
};
const previewFonts = (fonts: Array<{ family: string; url: string }>) => {
  for (const f of fonts) if (![...document.fonts].some((x) => x.family.replace(/"/g, "") === f.family)) void new FontFace(f.family, \`url(\${f.url})\`).load().then((face) => document.fonts.add(face)).catch(() => undefined);
};
`;
export const BRIDGE_LINES = `  if (d && d.type === "flowcode:tokens") (previewTokens((d as { tokens?: Record<string, string> | null }).tokens ?? null), requestAnimationFrame(() => window.parent?.postMessage({ type: "flowcode:painted", id: (d as { id?: unknown }).id }, "*")));
  if (d && d.type === "flowcode:fonts") previewFonts((d as { fonts?: Array<{ family: string; url: string }> }).fonts ?? []);
  if (d && d.type === "flowcode:hello") window.parent?.postMessage({ type: "flowcode:ready", tokens: true }, "*");
`;

/** Whether the app's preview listener takes a draft Look. */
export function bridgeInstalled(jail: PathJail): boolean {
  try {
    return fs.readFileSync(path.join(jail.root, MAIN), "utf8").includes(BRIDGE_MARK);
  } catch {
    return false;
  }
}

/** main.tsx with the bridge added to its preview listener, or undefined when it has no listener to extend. */
export function withBridge(main: string): string | undefined {
  if (main.includes(BRIDGE_MARK)) return main;
  const nl = main.includes("\r\n") ? "\r\n" : "\n";
  const listener = /window\.addEventListener\("message", \(e: MessageEvent\) => \{\r?\n[^\n]*\r?\n/;
  const m = listener.exec(main);
  if (!m) return undefined;
  const at = m.index + m[0].length;
  const helperAt = m.index;
  const out = `${main.slice(0, helperAt)}${BRIDGE_HELPER.replace(/\n/g, nl)}${main.slice(helperAt, at)}${BRIDGE_LINES.replace(/\n/g, nl)}${main.slice(at)}`;
  return out;
}

/** Adds the bridge to an existing app (one snapshotted edit of src/main.tsx). */
export function installBridge(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }): { changed: boolean; snapshotIds: string[] } {
  if (bridgeInstalled(jail)) return { changed: false, snapshotIds: [] };
  let main: string;
  try {
    main = fs.readFileSync(path.join(jail.root, MAIN), "utf8");
  } catch {
    throw new Error("This app has no src/main.tsx, so FlowCode's live design preview can't be added (it works with FlowCode's React apps).");
  }
  const next = withBridge(main);
  if (!next) throw new Error("src/main.tsx has no FlowCode preview listener to extend, so the live design preview can't be added safely.");
  const r = ops.replaceContent({ jail, projectId: ctx.projectId, runId: ctx.runId, approved: false }, MAIN, next);
  if (!r.ok) throw new Error(r.message ?? "Couldn't update src/main.tsx");
  return { changed: true, snapshotIds: r.snapshotIds ?? [] };
}
