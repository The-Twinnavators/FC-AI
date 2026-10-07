/**
 * Design token inventory and contrast math (§13.2 "compile design tokens from structured inputs").
 * Tokens are read from the project's token stylesheet (CSS custom properties) and an optional
 * structured brief (.flowcode/design-brief.json).
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";

export interface DesignBrief {
  subject: string;
  audience: string;
  primaryJob: string;
  vernacular: string[];
  requiredStates: string[];
  maxRadiusPx?: number;
  contrastPairs?: Array<{ fg: string; bg: string; min: number }>;
}

export interface TokenInventory {
  file?: string;
  tokens: Map<string, string>;
  resolve(name: string): string | undefined;
  contrastPairs: Array<{ fg: string; bg: string; min: number }>;
  brief?: DesignBrief;
}

const DEFAULT_PAIRS = [
  { fg: "--color-text", bg: "--color-bg", min: 4.5 },
  { fg: "--color-text", bg: "--color-surface", min: 4.5 },
  { fg: "--color-text-muted", bg: "--color-bg", min: 4.5 },
  { fg: "--color-text-muted", bg: "--color-surface", min: 4.5 },
  { fg: "--color-on-accent", bg: "--color-accent", min: 4.5 },
  { fg: "--color-danger", bg: "--color-surface", min: 3 },
  { fg: "--color-border-strong", bg: "--color-surface", min: 3 },
];

export function parseTokens(jail: PathJail): TokenInventory {
  // The app's own token file, not reference files attached to the spec; src/ first when there are several.
  const files = flattenFiles(jail)
    .filter((p) => /tokens?\.css$/.test(p) && !isReferencePath(p))
    .sort((a, b) => Number(!a.startsWith("src/")) - Number(!b.startsWith("src/")));
  const tokens = new Map<string, string>();
  for (const rel of files) {
    const css = fs.readFileSync(path.join(jail.root, rel), "utf8");
    // Only the first (default/light or root) definition block is used for contrast evaluation.
    const root = /:root\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? css;
    for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) if (!tokens.has(m[1])) tokens.set(m[1], m[2].trim());
  }
  let brief: DesignBrief | undefined;
  const briefPath = path.join(jail.root, ".flowcode", "design-brief.json");
  if (fs.existsSync(briefPath)) {
    try {
      brief = JSON.parse(fs.readFileSync(briefPath, "utf8")) as DesignBrief;
    } catch {
      /* invalid brief is reported by design QA */
    }
  }
  const resolve = (name: string, depth = 0): string | undefined => {
    const v = tokens.get(name);
    if (!v || depth > 8) return v;
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    return ref ? resolve(ref[1], depth + 1) : v;
  };
  return { file: files[0], tokens, resolve, contrastPairs: brief?.contrastPairs ?? DEFAULT_PAIRS.filter((p) => tokens.has(p.fg) && tokens.has(p.bg)), brief };
}

export function parseColor(v: string): [number, number, number] | undefined {
  const s = v.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16)) as [number, number, number];
    if (h.length === 6 || h.length === 8) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(s);
  if (m) {
    const h = Number(m[1]) / 360;
    const sat = Number(m[2]) / 100;
    const l = Number(m[3]) / 100;
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    const conv = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [conv(h + 1 / 3), conv(h), conv(h - 1 / 3)].map((x) => Math.round(x * 255)) as [number, number, number];
  }
  return undefined;
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((x) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrastRatio(fg: string, bg: string): number | undefined {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return undefined;
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Spec attachments, docs and build output: material about the app, not the app's own styles. */
export function isReferencePath(rel: string): boolean {
  return /^(spec|docs?|references?|dist|build)\//.test(rel);
}
