/**
 * What a build's changes affect, by screen (C2 / VUS-11): "This change affects: Lesson card (3 screens) · Tokens:
 * --space-4". Built from the run's file snapshots and the app's screens: a screen is affected when its own file
 * changed, or a file it imports (two levels deep) changed; shared styles and design tokens affect every screen. Before
 * and after pictures are FlowCode's own screenshots (the app's first screen at each size), from the previous build
 * and this one. Nothing is guessed: a file that can't be traced to a screen is listed as such.
 */
import fs from "node:fs";
import path from "node:path";
import type { App } from "../app.js";
import { listScreens } from "../quality/screenCoverage.js";

export interface ChangeImpact {
  runId: string;
  changedFiles: string[];
  screens: Array<{ id: string; label: string; via: string[] }>;
  /** Shared styles or tokens: they reach every screen. */
  shared: Array<{ file: string; tokens: string[] }>;
  /** Changed files not traced to any screen (data, tests, config…). */
  other: string[];
  totalScreens: number;
  shots?: { before?: Array<{ viewport: string; artifactId: string }>; after: Array<{ viewport: string; artifactId: string }>; beforeRunId?: string };
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/\.(t|j)sx?$/, "").replace(/\/index$/, "");

/** Relative imports of one file, as workspace paths without extension. */
function importsOf(root: string, rel: string): string[] {
  let text = "";
  try {
    text = fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const m of text.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const spec = m[1] ?? m[2];
    if (!spec) continue;
    out.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel.replace(/\\/g, "/")), spec)));
  }
  return out;
}

/** Custom properties whose value differs between two versions of a stylesheet. */
function changedTokens(before: string | undefined, after: string | undefined): string[] {
  const read = (css = "") => new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
  const a = read(before);
  const b = read(after);
  const names = new Set([...a.keys(), ...b.keys()]);
  return [...names].filter((n) => a.get(n) !== b.get(n)).slice(0, 12);
}

export function changeImpact(app: App, runId: string): ChangeImpact {
  const run = app.store.runs.require(runId);
  const project = app.store.projects.require(run.projectId);
  const jail = app.projects.jail(project);
  const root = jail.root;
  const snaps = app.snapshots.forRun(runId).filter((s) => !s.restoredAt);
  // The earliest snapshot of each file in this run holds the file as it was before the build touched it.
  const first = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) if (!first.has(s.relativePath)) first.set(s.relativePath, s);
  const changedFiles = [...first.keys()].sort();
  // A changed picture or other public file counts as a change to each source file that names it (a photo is linked
  // from the data file, not from a screen: Pacific Foods' new photo showed as "not on a screen").
  const viaAsset = new Map<string, string>();
  for (const f of changedFiles.filter((x) => x.startsWith("public/"))) {
    const url = f.replace(/^public/, "");
    for (const src of listSource(root)) {
      if (changedFiles.includes(src)) continue;
      let text = "";
      try {
        text = fs.readFileSync(path.join(root, src), "utf8");
      } catch {
        continue;
      }
      if (text.includes(url)) viaAsset.set(src, `${path.posix.basename(f)} (used in ${path.posix.basename(src)})`);
    }
  }
  const tracked = [...changedFiles, ...viaAsset.keys()];
  const label = (f: string) => viaAsset.get(f) ?? f;
  const changed = new Set(tracked.map(norm));

  const screens = listScreens(root).filter((s) => s.file);
  const affected: ChangeImpact["screens"] = [];
  for (const s of screens) {
    const file = s.file!;
    const via: string[] = [];
    if (changed.has(norm(file))) via.push(label(file));
    const level1 = importsOf(root, file);
    for (const imp of level1) {
      const hit = tracked.find((c) => norm(c) === norm(imp));
      if (hit && !via.includes(label(hit))) via.push(label(hit));
      // One level further: components used by the screen's components.
      const target = tracked.length ? [".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"].map((ext) => imp + ext).find((p) => fs.existsSync(path.join(root, p))) : undefined;
      if (target)
        for (const imp2 of importsOf(root, target)) {
          const hit2 = tracked.find((c) => norm(c) === norm(imp2));
          if (hit2 && !via.includes(label(hit2))) via.push(label(hit2));
        }
    }
    if (via.length) affected.push({ id: s.id, label: s.label ?? s.id, via });
  }

  // A picture traced through a source file counts as traced.
  const traced = new Set([...affected.flatMap((a) => a.via), ...changedFiles.filter((f) => [...viaAsset.values()].some((v) => v.startsWith(`${path.posix.basename(f)} (`)) && affected.some((a) => a.via.some((x) => x.startsWith(`${path.posix.basename(f)} (`))))]);
  const shared: ChangeImpact["shared"] = [];
  const other: string[] = [];
  for (const f of changedFiles) {
    if (traced.has(f)) continue;
    if (/\.css$/.test(f) || /(^|\/)(App|main)\.(t|j)sx?$/.test(f) || /(^|\/)(theme|tokens)\.(t|j)s$/.test(f)) {
      let after: string | undefined;
      try {
        after = fs.readFileSync(path.join(root, f), "utf8");
      } catch {
        after = undefined;
      }
      const before = app.snapshots.priorContent(first.get(f)!);
      shared.push({ file: f, tokens: /\.css$/.test(f) ? changedTokens(before, after) : [] });
    } else other.push(f);
  }

  // Before and after: this build's screenshots and the most recent earlier build of this project that has them.
  const shotsOf = (id: string) =>
    app.store.artifacts
      .where("run_id = ?", id)
      .filter((a) => a.kind === "screenshot")
      .map((a) => ({ viewport: String((a.meta as { viewport?: string } | undefined)?.viewport ?? a.label), artifactId: a.id, at: a.createdAt }));
  const after = latestPerViewport(shotsOf(runId));
  let before: Array<{ viewport: string; artifactId: string }> | undefined;
  let beforeRunId: string | undefined;
  const earlier = app.store.runs
    .where("project_id = ?", run.projectId)
    .filter((r) => r.id !== runId && r.createdAt < run.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const r of earlier) {
    const s = latestPerViewport(shotsOf(r.id));
    if (s.length) {
      before = s;
      beforeRunId = r.id;
      break;
    }
  }
  return {
    runId,
    changedFiles,
    screens: affected,
    shared,
    other,
    totalScreens: screens.length,
    ...(after.length ? { shots: { after, ...(before ? { before, beforeRunId } : {}) } } : {}),
  };
}

/** Source files under src/ (code only), for finding which ones name a changed public file. */
function listSource(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(tsx?|jsx?|css|html)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(rel);
    }
  };
  if (fs.existsSync(path.join(root, "src"))) walk("src");
  return out.slice(0, 3000);
}

function latestPerViewport(list: Array<{ viewport: string; artifactId: string; at: string }>) {
  const by = new Map<string, { viewport: string; artifactId: string; at: string }>();
  for (const s of list) {
    const cur = by.get(s.viewport);
    if (!cur || s.at > cur.at) by.set(s.viewport, s);
  }
  return ["mobile", "desktop", "tablet"].flatMap((v) => (by.has(v) ? [{ viewport: v, artifactId: by.get(v)!.artifactId }] : []));
}
