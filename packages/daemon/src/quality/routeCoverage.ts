/**
 * Route coverage: every screen the plan promised is in the app's navigation (SCREENS in src/App.tsx), every detail
 * screen kept out of the menu is linked from somewhere, and no screen is still the layout FlowCode laid out with its
 * section slots empty. The app wiring check says what is imported; this says what a person can actually reach and
 * whether the page was built. Deterministic, from the files.
 */
import fs from "node:fs";
import path from "node:path";
import type { ScreenPlan } from "../orchestrator/screenPlan.js";
import { isDetailScreen } from "../orchestrator/screenPlan.js";

export interface RouteCoverage {
  /** Planned screens not in the app's SCREENS list. */
  missing: string[];
  /** Screens kept out of the menu (detail screens) that nothing links to. */
  unlinked: string[];
  /** Screens with section slots the build never filled: "Screen: section". */
  unfilled: string[];
  status: "passed" | "failed";
  summary: string;
}

const read = (root: string, f: string) => {
  try {
    return fs.readFileSync(path.join(root, f), "utf8");
  } catch {
    return "";
  }
};

function srcFiles(root: string, dir = "src"): string[] {
  const out: string[] = [];
  let names: fs.Dirent[] = [];
  try {
    names = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const n of names) {
    const rel = `${dir}/${n.name}`;
    if (n.isDirectory()) {
      if (n.name !== "node_modules" && n.name !== "acceptance") out.push(...srcFiles(root, rel));
    } else if (/\.(tsx|jsx|ts|js)$/.test(n.name) && !/\.test\./.test(n.name)) out.push(rel);
  }
  return out;
}

/** The numbered section slots of a laid-out screen ({/* 2. Title: purpose *\/}) with nothing built under them. */
export function unfilledSlots(source: string): string[] {
  const lines = source.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  lines.forEach((l, i) => {
    const m = /^\{\/\*\s*\d+\.\s*([^:]{1,80}):/.exec(l);
    if (!m) return;
    const next = lines[i + 1] ?? "";
    if (/^\{\/\*\s*\d+\./.test(next) || /^<\//.test(next) || /^\)/.test(next)) out.push(m[1]!.trim());
  });
  return out;
}

export function routeCoverage(root: string, plan: ScreenPlan): RouteCoverage {
  const app = read(root, "src/App.tsx") || read(root, "src/App.jsx");
  const list = app.match(/const SCREENS\s*=\s*\[([\s\S]*?)\];/)?.[1] ?? "";
  const ids = new Set([...list.matchAll(/id:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]!));
  // An app FlowCode wrote from its model keeps its destinations in src/app/routes.ts (SCREEN_IDS), each drawn by
  // App.tsx's VIEWS: Frameproof's three pages were reported "not in the app's navigation" for not being in a SCREENS list.
  const routeIds = read(root, "src/app/routes.ts").match(/SCREEN_IDS\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
  for (const m of routeIds.matchAll(/["'`]([^"'`]+)["'`]/g)) if (new RegExp(`["'\`]${m[1]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]\\s*:`).test(app)) ids.add(m[1]!);
  const missing = plan.screens.filter((s) => !ids.has(s.id)).map((s) => s.label);
  const files = srcFiles(root);
  const unlinked = plan.screens
    .filter((s) => isDetailScreen(plan, s) && ids.has(s.id))
    .filter((s) => {
      const q = s.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const ref = new RegExp(`(["'\`])#?/?${q}(/|\\1)|linkTo\\(\\s*["'\`]${q}["'\`]|go\\(\\s*["'\`]${q}["'\`]`);
      return !files.some((f) => f !== s.file && !/^src\/App\.(t|j)sx$/.test(f) && ref.test(read(root, f)));
    })
    .map((s) => s.label);
  const unfilled = plan.screens.flatMap((s) => unfilledSlots(read(root, s.file)).map((x) => `${s.label}: ${x}`));
  const problems = [
    missing.length ? `not in the app's navigation: ${missing.join(", ")}` : "",
    unlinked.length ? `nothing links to ${unlinked.join(", ")}` : "",
    unfilled.length ? `sections laid out but never built: ${unfilled.slice(0, 8).join("; ")}` : "",
  ].filter(Boolean);
  return {
    missing,
    unlinked,
    unfilled,
    status: problems.length ? "failed" : "passed",
    summary: problems.length ? `Planned pages: ${problems.join("; ")}` : `All ${plan.screens.length} planned page${plan.screens.length === 1 ? "" : "s"} are in the app, reachable and built`,
  };
}
