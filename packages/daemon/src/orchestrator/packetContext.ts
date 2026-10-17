/**
 * The task-relevant product context a coding step must carry after packet fitting (handoff.ts never drops
 * `requirements` or `contracts`): what the PRD says about the screens it works on, the PRD's navigation when it touches
 * the frame or the screens' wiring, how App.tsx renders each screen (the props it passes: the contract a screen must
 * keep), and the contracts of the library pieces its screens import. Short extracts, not the whole PRD.
 *
 * Clean Cart: the frame step's requests dropped the PRD ("Spec") every time and its words matched no PRD section, so it
 * carried no product requirement; a step that rewrote Home had the contract of one of the four pieces Home imports
 * (contracts came only from section files in its own paths) and invented the others' props; the debugger changed
 * Home's props without knowing App.tsx renders it with none.
 */
import fs from "node:fs";
import path from "node:path";
import { LIBRARY_SECTIONS } from "@flowcode/contracts";
import { parseSections } from "./prd.js";
import { extractRequirements } from "../quality/spec.js";
import { catalogContract, contractText } from "./catalogContract.js";
import { sectionFile } from "./sectionRecipes.js";

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");
const stem = (s: string) => s.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(screen|page|view)$/, "");

/** Whether a step works on the frame or the screens' wiring (navigation, App.tsx, the kit's shell). */
export function touchesNavigation(task: { title: string; objective: string; expectedPaths: string[] }): boolean {
  return task.expectedPaths.some((p) => /(^|\/)App\.(tsx|jsx)$|components\/ui\/|lib\/screens|styles\/components\.css$/.test(norm(p))) || /\b(frame|navigation|nav bar|navbar|app shell|appshell|menu|tab bar|sidebar)\b/i.test(`${task.title} ${task.objective}`);
}

/**
 * The PRD lines about the given screens: their rows in the screens table, and requirements naming them; with the
 * PRD's navigation section when `navigation` is set. Undefined when the PRD says nothing about them.
 */
export function screenRequirements(md: string, screens: string[], navigation: boolean, budget = 2400): string | undefined {
  const parts: string[] = [];
  const names = screens.map((s) => s.toLowerCase()).filter(Boolean);
  const named = (line: string) => names.some((n) => line.toLowerCase().includes(n));
  // Table rows ("| Home (landing page) | What Clean Cart is, … |") and bullets that name a screen.
  const rows = md.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && named(l.split("|")[1] ?? ""));
  if (rows.length) parts.push(`What the PRD says each screen shows:\n${rows.map((r) => r.trim()).join("\n")}`);
  // Navigation before the requirement list: the requirements fill what's left of the budget, never crowd it out.
  if (navigation) {
    const nav = parseSections(md).find((s) => /\bnavigation\b/i.test(s.title));
    if (nav) parts.push(`The PRD's navigation:\n${md.slice(nav.start, nav.end).trim().slice(0, 900)}`);
  }
  const head = parts.join("\n\n");
  const reqs = extractRequirements(md, 600).filter((r) => named(`${r.section} ${r.text}`)).slice(0, 12);
  const room = budget - head.length - 40;
  const reqText = reqs.length && room > 200 ? `Requirements about these screens:\n${reqs.map((r) => `${r.id} [${r.section || "Requirements"}]: ${r.text.slice(0, 260)}`).join("\n")}`.slice(0, room) : "";
  const text = [head, reqText].filter(Boolean).join("\n\n");
  return text || undefined;
}

/**
 * How App.tsx renders each screen: the component and the props it passes, and that screens switch by the URL hash.
 * A screen must accept exactly these props; changing a screen's props means changing App.tsx in the same step.
 */
export function navigationContract(root: string): string | undefined {
  let app = "";
  for (const f of ["src/App.tsx", "src/App.jsx"]) {
    try {
      app = fs.readFileSync(path.join(root, f), "utf8");
      break;
    } catch {
      /* next */
    }
  }
  if (!app) return undefined;
  const uses = new Map<string, Set<string>>();
  for (const m of app.matchAll(/<([A-Z]\w*(?:Screen|Page))\b([^>]*?)\/?>/g)) {
    const props = [...m[2]!.matchAll(/\b([a-zA-Z]\w*)\s*=/g)].map((x) => x[1]!);
    uses.set(m[1]!, new Set([...(uses.get(m[1]!) ?? []), ...props]));
  }
  if (!uses.size) return undefined;
  const hash = /useScreen|location\.hash/.test(app) || fs.existsSync(path.join(root, "src/lib/screens.ts"));
  return [
    "How src/App.tsx renders the screens (FlowCode wrote it; it is the contract each screen keeps):",
    ...[...uses].map(([c, props]) => `- <${c}${props.size ? ` ${[...props].map((p) => `${p}={…}`).join(" ")}` : ""} />${props.size ? "" : " (no props: the screen must not require any)"}`),
    hash ? "Screens switch by the URL hash (#/<screen id>, src/lib/screens.ts): link with href=\"#/<id>\" rather than adding a navigation prop." : "",
    "A screen whose props you change must be updated in App.tsx in the same step, or keep the props App.tsx passes.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The library pieces the given files import from src/sections/, with their catalog contracts. */
export function importedPieceContracts(root: string, files: string[], max = 4): Array<{ name: string; text: string }> {
  const seen = new Set<string>();
  const out: Array<{ name: string; text: string }> = [];
  for (const f of files) {
    let src = "";
    try {
      src = fs.readFileSync(path.join(root, norm(f)), "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(/from\s+["'](?:\.{1,2}\/)+(?:[\w-]+\/)*sections\/([\w-]+)["']/g)) {
      const comp = m[1]!;
      if (seen.has(comp)) continue;
      seen.add(comp);
      const piece = LIBRARY_SECTIONS.find((x) => stem(sectionFile(x.id)) === stem(comp));
      const c = piece ? catalogContract(piece.ref ?? piece.id) : undefined;
      if (piece && c) out.push({ name: `${piece.name} (${piece.ref}, src/sections/${comp}.tsx, imported by ${norm(f)})`, text: contractText(c).slice(0, 2000) });
      if (out.length >= max) return out;
    }
  }
  return out;
}
