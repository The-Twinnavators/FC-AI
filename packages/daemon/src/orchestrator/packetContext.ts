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
  // A route table (const VIEWS = { "landing": LandingScreen, … } rendered as <View … /> from VIEWS[screen]): each
  // screen gets the props the rendered element passes (Clean Cart slice: none).
  const routes: string[] = [];
  for (const t of app.matchAll(/const\s+(\w+)\s*(?::[^=]+)?=\s*\{([^{}]*)\}/g)) {
    const pairs = [...t[2]!.matchAll(/["']?([\w-]+)["']?\s*:\s*([A-Z]\w*)\b/g)];
    if (!pairs.length) continue;
    const viaVar = new RegExp(`const\\s+(\\w+)\\s*=\\s*${t[1]}\\[`).exec(app)?.[1];
    const el = viaVar ? new RegExp(`<${viaVar}\\b([^>]*?)\\/?>`).exec(app) : null;
    if (!el) continue;
    const props = [...el[1]!.matchAll(/\b([a-zA-Z]\w*)\s*=/g)].map((x) => x[1]!).filter((p) => p !== "key");
    for (const [, id, comp] of pairs) {
      uses.set(comp!, new Set([...(uses.get(comp!) ?? []), ...props]));
      routes.push(`#/${id} → ${comp}`);
    }
  }
  if (!uses.size) return undefined;
  // Navigation links the frame shows but that lead to no working page (a link marked "available": false).
  const unavailable = [...app.matchAll(/\{\s*"id":\s*"([\w-]+)",\s*"label":\s*"([^"]+)"[^}]*"available":\s*false/g)].map((m) => `${m[2]} (#/${m[1]})`);
  const hash = /useScreen|location\.hash/.test(app) || fs.existsSync(path.join(root, "src/lib/screens.ts"));
  return [
    "How src/App.tsx renders the screens (FlowCode wrote it; it is the contract each screen keeps):",
    ...[...uses].map(([c, props]) => `- <${c}${props.size ? ` ${[...props].map((p) => `${p}={…}`).join(" ")}` : ""} />${props.size ? "" : " (no props: the screen must not require any)"}`),
    routes.length ? `Routes (App.tsx's route table): ${routes.join(", ")}.` : "",
    unavailable.length ? `Navigation links with no working page yet: ${unavailable.join(", ")}.` : "",
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

/** A step's paths as concrete files, and what couldn't be resolved or attached. */
export interface ConcreteTargets {
  files: string[];
  gaps: string[];
}

const CODE = /\.(tsx?|jsx?|css|scss|json|md|html|vue|svelte)$/i;

/**
 * A step's paths as concrete, bounded files. A file path stays as it is. A folder (src/screens/, src/styles/) becomes
 * the files in it the step is about, in this order: files its title or objective names (by file name or a planned
 * screen's label), the planned screens in that folder, then the files the app imports from it (App.tsx and main.tsx);
 * at most `perFolder` from each folder, never the whole tree. What is left of the relevant ones, or a folder with nothing
 * resolvable, is reported as a gap instead of being dropped without a word.
 *
 * Clean Cart slice eval 1: the design step's paths were src/screens/ and src/styles/, and every attempt was sent with
 * no source file at all; it rebuilt that context by reading until its turns ran out.
 */
export function concreteTargets(root: string, task: { title: string; objective: string; expectedPaths: string[] }, planned: Array<{ label: string; file: string }>, perFolder = 6): ConcreteTargets {
  const files: string[] = [];
  const gaps: string[] = [];
  const text = `${task.title}\n${task.objective}`.toLowerCase();
  let imports = "";
  for (const f of ["src/App.tsx", "src/App.jsx", "src/main.tsx", "src/main.jsx"]) {
    try {
      imports += fs.readFileSync(path.join(root, f), "utf8");
    } catch {
      /* not there */
    }
  }
  for (const raw of task.expectedPaths) {
    const p = norm(raw);
    const abs = path.join(root, p);
    const isDir = p.endsWith("/") || (fs.existsSync(abs) && fs.statSync(abs).isDirectory());
    if (!isDir) {
      files.push(p);
      continue;
    }
    const dir = p.replace(/\/$/, "");
    let names: string[] = [];
    try {
      names = fs
        .readdirSync(path.join(root, dir), { withFileTypes: true })
        .filter((e) => e.isFile() && CODE.test(e.name) && !/\.(test|spec)\./.test(e.name))
        .map((e) => `${dir}/${e.name}`);
    } catch {
      names = [];
    }
    if (!names.length) {
      gaps.push(`${dir}/ has no files to work on yet`);
      continue;
    }
    const base = (f: string) => f.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "");
    // Named files in the order the step's text first mentions them (its first-named screens matter most).
    const at = (f: string) => {
      const hits = [text.indexOf(f.toLowerCase()), text.indexOf(base(f).toLowerCase()), ...planned.filter((s) => s.file === f).map((s) => text.indexOf(s.label.toLowerCase()))].filter((i) => i >= 0);
      return hits.length ? Math.min(...hits) : -1;
    };
    const named = names.filter((f) => at(f) >= 0).sort((a, b) => at(a) - at(b));
    const plannedHere = planned.map((s) => norm(s.file)).filter((f) => names.includes(f));
    const imported = names.filter((f) => new RegExp(`["'][./]*${dir.replace(/^src\//, "")}/${base(f)}(\\.[a-z]+)?["']|/${base(f)}\\.css["']`).test(imports));
    // The component library's stylesheet (and any file too large to have been written by hand) isn't a step's own work:
    // the look changes through the tokens. Frameproof's Design polish took src/styles/library.css (454 KB) as its own,
    // and no turn could read it.
    const kit = names.filter((f) => /(^|\/)library\.css$/.test(f) || (() => {
      try {
        return fs.statSync(path.join(root, f)).size > 60_000;
      } catch {
        return false;
      }
    })());
    if (kit.length) gaps.push(`${kit.join(", ")}: the component library's (or a generated) file, not this step's; change the look through the tokens in src/styles/tokens.css`);
    const ranked = [...new Set([...named, ...plannedHere, ...imported])].filter((f) => !kit.includes(f));
    if (!ranked.length) {
      gaps.push(`${dir}/: none of its ${names.length} files is named by the step, planned as a screen or imported by the app; read the ones you need`);
      continue;
    }
    files.push(...ranked.slice(0, perFolder));
    if (ranked.length > perFolder) gaps.push(`${dir}/: ${ranked.length - perFolder} more relevant file${ranked.length - perFolder === 1 ? "" : "s"} not attached (${ranked.slice(perFolder).join(", ")}); read one when you need it`);
  }
  return { files: [...new Set(files)], gaps };
}
