/**
 * CSSVibes style capture: the look a person points at becomes the app's starting design, which they then configure on
 * the Styles page (Design, Tokens, Surface) before the build is approved. Sources, most exact first:
 *  - a website URL: computed styles of the live page (colours by area, fonts, button corners, surface effects);
 *  - attached CSS or HTML: its custom properties, colours, fonts, corners and surface effects;
 *  - attached images (screenshots, mockups): the dominant colours from the pixels, plus fonts, corners and surface
 *    style read by a vision model when one is set up;
 *  - the PRD's design section (applied when the starter is scaffolded; see starterIdentity.ts).
 * The result is written with the Styles page's own functions (palette, tokens, surface), so it is one more edit the
 * person can change or undo.
 */
import { BRAND_ROLES, STYLE_VIBES, hexToOklch, normalizeHex, type ModelAssignment } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import type { ModelRouter } from "../models/router.js";
import type { BrowserSession } from "../quality/preview.js";
import { applyDesign, applyPalette } from "./designStudio.js";
import { setSurfaceStyle } from "./surfaceStyle.js";

export interface StylePart {
  source: string;
  /** Colour candidates with how much they're used (area, count or declared role). */
  colors: Array<{ hex: string; weight: number }>;
  background?: string;
  text?: string;
  fonts: { display?: string; body?: string };
  radiusPx?: number;
  vibe?: string;
}

export interface CapturedStyle {
  brand: string[];
  background?: string;
  text?: string;
  fonts: { display?: string; body?: string };
  radiusPx?: number;
  vibe?: string;
  sources: string[];
  /** D9: which source each value came from ("from image 2: accent #… and 12px corners"). */
  origins?: Array<{ what: string; value: string; from: string }>;
}

// ───────────────────────── colours ─────────────────────────

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");

/** A CSS colour (hex, rgb(), rgba(), hsl()) as #rrggbb, or undefined for keywords, transparent or anything else. */
export function toHex(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    const h = hex[1];
    if (h.length === 8 && h.endsWith("00")) return undefined;
    return normalizeHex(h.length === 4 ? h.slice(0, 3) : h.length === 8 ? h.slice(0, 6) : h);
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    if (a < 0.5) return undefined;
    return `#${hex2(+rgb[1])}${hex2(+rgb[2])}${hex2(+rgb[3])}`;
  }
  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (hsl) {
    const a = hsl[4] === undefined ? 1 : hsl[4].endsWith("%") ? parseFloat(hsl[4]) / 100 : parseFloat(hsl[4]);
    if (a < 0.5) return undefined;
    const h = +hsl[1] / 360;
    const s = +hsl[2] / 100;
    const l = +hsl[3] / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t: number) => {
      const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
    };
    return `#${hex2(f(h + 1 / 3) * 255)}${hex2(f(h) * 255)}${hex2(f(h - 1 / 3) * 255)}`;
  }
  if (v === "white") return "#ffffff";
  if (v === "black") return "#000000";
  return undefined;
}

/** True for a colour with a real hue (a brand colour), not a grey, white or black. */
export const isChromatic = (hex: string) => hexToOklch(hex).c > 0.045;

/** Distinct colours, most used first: near-identical shades (same hue and lightness) count as one. */
function distinct(colors: Array<{ hex: string; weight: number }>, max: number): string[] {
  const merged: Array<{ hex: string; weight: number }> = [];
  for (const c of [...colors].sort((a, b) => b.weight - a.weight)) {
    const o = hexToOklch(c.hex);
    const near = merged.find((m) => {
      const n = hexToOklch(m.hex);
      const dh = Math.min(Math.abs(o.h - n.h), 360 - Math.abs(o.h - n.h));
      return dh < 18 && Math.abs(o.l - n.l) < 0.12;
    });
    if (near) near.weight += c.weight;
    else merged.push({ ...c });
  }
  return merged.sort((a, b) => b.weight - a.weight).slice(0, max).map((m) => m.hex);
}

// ───────────────────────── fonts, corners, surfaces ─────────────────────────

const GENERIC_FONT = /^(system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica( neue)?|arial|sans-serif|serif|monospace|ui-sans-serif|ui-serif|ui-monospace|inherit|initial|var\(.*)$/i;

/** The first named family in a font-family list that isn't a system or generic one. */
export function firstFamily(value: string): string | undefined {
  for (const f of value.split(",")) {
    const name = f.trim().replace(/^["']|["']$/g, "").trim();
    if (name && !GENERIC_FONT.test(name) && /^[\w -]{2,40}$/.test(name)) return name;
  }
  return undefined;
}

const toPx = (v: string): number | undefined => {
  const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(v.trim().split(/\s+/)[0] ?? "");
  if (!m) return undefined;
  const n = parseFloat(m[1]) * (m[2] === "rem" || m[2] === "em" ? 16 : 1);
  return Number.isFinite(n) ? n : undefined;
};

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** The CSSVibes surface style the effects point to (glass, neumorphism, neobrutalism), if any. */
function vibeFrom(effects: { blur: number; inset: number; hardShadow: number; thickBorder: number; total: number }): string | undefined {
  if (!effects.total) return undefined;
  if (effects.blur >= 2) return "glass";
  if (effects.inset >= 3) return "neumorphism";
  if (effects.hardShadow >= 2 && effects.thickBorder >= 2) return "neobrutalism";
  return undefined;
}

// ───────────────────────── CSS and HTML ─────────────────────────

const STATUS_WORDS = /danger|error|success|warning|warn\b|alert|destructive|delete|invalid|critical|positive|negative/;
const STATUS_VAR = /var\(\s*--[\w-]*(danger|error|success|warning|warn|alert|destructive|invalid|critical|positive|negative|info)/i;

/** Reads a stylesheet: declared brand colours first, then colours by use, fonts, button corners and surface effects. */
export function styleFromCss(css: string, source: string): StylePart {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const vars = new Map<string, string>();
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  const resolve = (v: string, depth = 0): string => (depth > 3 ? v : v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, n: string, fb?: string) => resolve(vars.get(n) ?? fb ?? "", depth + 1)));
  const colors: Array<{ hex: string; weight: number }> = [];
  for (const [name, raw] of vars) {
    const hex = toHex(resolve(raw));
    if (!hex) continue;
    // A variable named for a brand role is the design's own statement of its colours.
    const role = /primary|brand/.test(name) ? 40 : /secondary|accent/.test(name) ? 25 : /tertiary|highlight/.test(name) ? 15 : 0;
    if (role && isChromatic(hex)) colors.push({ hex, weight: role });
  }
  let background: string | undefined;
  let textColor: string | undefined;
  const fonts: StylePart["fonts"] = {};
  const radii: number[] = [];
  const effects = { blur: 0, inset: 0, hardShadow: 0, thickBorder: 0, total: 0 };
  for (const rule of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim().toLowerCase();
    if (selector.startsWith("@")) continue;
    const isRoot = /(^|[\s,])(html|body|:root)([\s,{:.]|$)/.test(selector);
    const isHeading = /(^|[\s,.#])(h1|h2|h3|\.?title|\.?heading|\.?display|\.?hero)/.test(selector);
    const isControl = /button|\.btn|input|select|\.card|\.panel/.test(selector);
    // Status colours (danger, success, warning…) are never brand colours: the Calendar theme's red delete button and
    // green success notice came out as its second and third brand colours.
    const statusRule = STATUS_WORDS.test(selector);
    for (const d of rule[2].matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)) {
      const prop = d[1].toLowerCase();
      if (statusRule || STATUS_VAR.test(d[2])) continue;
      const value = resolve(d[2].trim());
      effects.total++;
      if (/^(background|background-color)$/.test(prop)) {
        const hex = toHex(value.split(/\s+(?![^(]*\))/).find((p) => toHex(p)) ?? "");
        if (hex) {
          if (isRoot) background ??= hex;
          else if (isChromatic(hex)) colors.push({ hex, weight: isControl ? 6 : 3 });
        }
      } else if (prop === "color") {
        const hex = toHex(value);
        if (hex) {
          if (isRoot) textColor ??= hex;
          else if (isChromatic(hex)) colors.push({ hex, weight: 2 });
        }
      } else if (/^(border|border-color|outline-color|fill|stroke)$/.test(prop)) {
        const hex = toHex(value.split(/\s+(?![^(]*\))/).find((p) => toHex(p)) ?? "");
        if (hex && isChromatic(hex)) colors.push({ hex, weight: 1 });
        const w = /^(border)$/.test(prop) ? toPx(value) : undefined;
        if (w && w >= 2 && w <= 6) effects.thickBorder++;
      } else if (prop === "font-family") {
        const fam = firstFamily(value);
        if (fam) {
          if (isHeading) fonts.display ??= fam;
          else if (isRoot) fonts.body ??= fam;
        }
      } else if (prop === "border-radius" && isControl) {
        const px = toPx(value);
        // Pill buttons (999px) are a style too.
        if (px !== undefined && px >= 0) radii.push(Math.min(px, 999));
      } else if (/^(-webkit-)?backdrop-filter$/.test(prop) && /blur\(/.test(value)) effects.blur++;
      else if (prop === "box-shadow") {
        if (/inset/.test(value)) effects.inset++;
        if (/^\s*-?\d+px\s+-?\d+px\s+0(px)?\s/.test(value)) effects.hardShadow++;
      }
    }
  }
  for (const [name, raw] of vars) {
    const v = resolve(raw);
    if (/^--(font-)?(display|heading|title)/.test(name)) fonts.display ??= firstFamily(v);
    else if (/^--(font-)?(sans|body|base|text)$|^--font$/.test(name)) fonts.body ??= firstFamily(v);
    else if (/^--(bg|background|color-bg|surface-0)$/.test(name)) background ??= toHex(v);
  }
  for (const m of text.matchAll(/fonts\.googleapis\.com\/css2?\?([^"')\s]+)/g))
    for (const f of m[1].matchAll(/family=([^:&]+)/g)) {
      const fam = decodeURIComponent(f[1].replace(/\+/g, " "));
      if (!fonts.display) fonts.display = fam;
      else if (!fonts.body && fam !== fonts.display) fonts.body = fam;
    }
  return { source, colors, background, text: textColor, fonts, radiusPx: median(radii), vibe: vibeFrom(effects) };
}

/** Reads an HTML page: its <style> blocks, inline styles and Google Fonts links. */
export function styleFromHtml(html: string, source: string): StylePart {
  const css = [
    ...[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<([a-z0-9]+)[^>]*\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => `${m[1]}{${m[2]}}`),
    ...[...html.matchAll(/href\s*=\s*"([^"]*fonts\.googleapis\.com[^"]*)"/gi)].map((m) => `/* */ @import url("${m[1].replace(/&amp;/g, "&")}");`),
  ].join("\n");
  return styleFromCss(css, source);
}

// ───────────────────────── a live website ─────────────────────────

interface PageStyles {
  bgs: Array<[string, number]>;
  texts: Array<[string, number]>;
  accents: Array<[string, number]>;
  rootBg?: string;
  rootColor?: string;
  headingFont?: string;
  bodyFont?: string;
  radii: number[];
  blur: number;
  inset: number;
  hardShadow: number;
  thickBorder: number;
}

/** Opens the page and reads the styles the browser computed, weighting colours by how much of the page they cover. */
export async function styleFromUrl(session: BrowserSession, url: string): Promise<{ part: StylePart; screenshot: Buffer }> {
  if (!/^https?:\/\//i.test(url)) throw new Error("Use a web address that starts with http:// or https://");
  const page = await session.browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => page.waitForLoadState("domcontentloaded"));
    await page.waitForTimeout(600);
    const s = (await page.evaluate(`(() => {
      const out = { bgs: [], texts: [], accents: [], radii: [], blur: 0, inset: 0, hardShadow: 0, thickBorder: 0 };
      // Modern sites give colours as oklch(), oklab() or color(); the canvas turns any CSS colour into hex or rgba.
      const cx = document.createElement("canvas").getContext("2d");
      const norm = (c) => { if (!cx || !c) return c; try { cx.fillStyle = "#000"; cx.fillStyle = c; return cx.fillStyle; } catch { return c; } };
      const root = getComputedStyle(document.body);
      out.rootBg = norm(root.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.documentElement).backgroundColor : root.backgroundColor);
      out.rootColor = norm(root.color);
      out.bodyFont = root.fontFamily;
      const h = document.querySelector("h1, h2");
      if (h) out.headingFont = getComputedStyle(h).fontFamily;
      const els = Array.from(document.querySelectorAll("body *")).slice(0, 2500);
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > 2400) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.3) continue;
        const area = Math.min(r.width * r.height, 1280 * 900);
        if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") out.bgs.push([norm(cs.backgroundColor), area]);
        const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
        if (own) out.texts.push([norm(cs.color), own.length]);
        const control = el.matches("button, a.button, .btn, [role=button], input[type=submit]");
        if (control || el.tagName === "A") out.accents.push([norm(control ? cs.backgroundColor : cs.color), control ? 400 : 40]);
        if (control || el.matches("input, select, textarea")) { const px = parseFloat(cs.borderTopLeftRadius); if (px >= 0) out.radii.push(Math.min(px, r.height / 2 >= px ? px : 999)); }
        if ((cs.backdropFilter || cs.webkitBackdropFilter || "").includes("blur")) out.blur++;
        if (cs.boxShadow.includes("inset")) out.inset++;
        if (/\\d+px \\d+px 0px/.test(cs.boxShadow)) out.hardShadow++;
        if (parseFloat(cs.borderTopWidth) >= 2 && cs.borderTopStyle === "solid") out.thickBorder++;
      }
      return out;
    })()`)) as PageStyles;
    const colors: StylePart["colors"] = [];
    for (const [c, w] of s.accents) {
      const hex = toHex(c);
      if (hex && isChromatic(hex)) colors.push({ hex, weight: w * 3 });
    }
    for (const [c, w] of s.bgs) {
      const hex = toHex(c);
      if (hex && isChromatic(hex)) colors.push({ hex, weight: w / 2000 });
    }
    for (const [c, w] of s.texts) {
      const hex = toHex(c);
      if (hex && isChromatic(hex)) colors.push({ hex, weight: w / 4 });
    }
    const screenshot = await page.screenshot({ type: "png" });
    const part: StylePart = {
      source: url,
      colors,
      background: s.rootBg ? toHex(s.rootBg) : undefined,
      text: s.rootColor ? toHex(s.rootColor) : undefined,
      fonts: { display: s.headingFont ? firstFamily(s.headingFont) : undefined, body: s.bodyFont ? firstFamily(s.bodyFont) : undefined },
      radiusPx: median(s.radii),
      vibe: vibeFrom({ blur: s.blur, inset: s.inset, hardShadow: s.hardShadow, thickBorder: s.thickBorder, total: 1 }),
    };
    return { part, screenshot };
  } finally {
    await page.close().catch(() => undefined);
  }
}

// ───────────────────────── an image ─────────────────────────

/** The image's colours from its pixels (drawn small in the browser and counted in 4-bit buckets). */
export async function colorsFromImage(session: BrowserSession, base64: string, mime = "image/png"): Promise<Array<{ hex: string; weight: number }>> {
  const page = await session.browser.newPage();
  try {
    await page.setContent("<canvas id=c width=96 height=96></canvas>");
    const counts = (await page.evaluate(
      `(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.getElementById("c");
        const scale = Math.min(96 / img.width, 96 / img.height);
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const buckets = {};
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
          const b = buckets[k] || (buckets[k] = [0, 0, 0, 0]);
          b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++;
        }
        return Object.values(buckets).map((b) => [b[0] / b[3], b[1] / b[3], b[2] / b[3], b[3]]);
      })(${JSON.stringify(`data:${mime};base64,${base64}`)})`,
    )) as Array<[number, number, number, number]>;
    return counts.map(([r, g, b, n]) => ({ hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`, weight: n }));
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Splits an image's colours into its background, text and brand candidates. */
export function partFromImageColors(source: string, counted: Array<{ hex: string; weight: number }>): StylePart {
  const byUse = [...counted].sort((a, b) => b.weight - a.weight);
  const neutrals = byUse.filter((c) => !isChromatic(c.hex));
  const background = neutrals[0]?.hex ?? byUse[0]?.hex;
  const bgL = background ? hexToOklch(background).l : 1;
  // Text is the most used neutral far from the background's lightness.
  const text = neutrals.find((c) => Math.abs(hexToOklch(c.hex).l - bgL) > 0.45)?.hex;
  // Brand colours: chromatic, and weighted up by saturation so a small bright button beats a large dull area.
  const colors = byUse.filter((c) => isChromatic(c.hex)).map((c) => ({ hex: c.hex, weight: c.weight * (0.5 + hexToOklch(c.hex).c * 6) }));
  return { source, colors, background, text, fonts: {} };
}

const VISION_SCHEMA = {
  type: "object",
  properties: {
    headingFont: { type: "string" },
    bodyFont: { type: "string" },
    cornerRadiusPx: { type: "number" },
    surface: { type: "string", enum: STYLE_VIBES.map((v) => v.id) },
  },
  required: ["headingFont", "bodyFont", "cornerRadiusPx", "surface"],
};

/** Fonts, button corners and surface style read from an image by a vision model (when one is set up). */
export async function visionStyle(router: ModelRouter, assignment: ModelAssignment | undefined, base64: string, ctx: { projectId?: string; runId?: string; signal?: AbortSignal }): Promise<Pick<StylePart, "fonts" | "radiusPx" | "vibe"> | undefined> {
  if (!assignment) return undefined;
  try {
    const info = await router.provider(assignment.providerId).describe(assignment.model);
    if (!info?.capabilities?.includes("vision")) return undefined;
    const res = await router.chat({ role: "critic", projectId: ctx.projectId, runId: ctx.runId }, assignment, {
      messages: [
        {
          role: "system",
          content: `You read the visual style of an interface screenshot or mockup for a design system. Name the closest Google Fonts families for the headings and the body text (e.g. "Inter", "Playfair Display", "DM Sans"), the corner radius of its buttons and inputs in pixels (0 square, about 6 subtle, 12 soft, 999 pill), and its surface style: ${STYLE_VIBES.map((v) => `${v.id} (${v.description})`).join("; ")}. Return JSON only.`,
        },
        { role: "user", content: "The image:", images: [base64] },
      ],
      format: VISION_SCHEMA,
      signal: ctx.signal,
      timeoutMs: 120_000,
    });
    const p = JSON.parse(res.content) as { headingFont?: string; bodyFont?: string; cornerRadiusPx?: number; surface?: string };
    return {
      fonts: { display: p.headingFont ? firstFamily(p.headingFont) : undefined, body: p.bodyFont ? firstFamily(p.bodyFont) : undefined },
      radiusPx: typeof p.cornerRadiusPx === "number" && p.cornerRadiusPx >= 0 ? Math.min(p.cornerRadiusPx, 999) : undefined,
      vibe: STYLE_VIBES.some((v) => v.id === p.surface) ? p.surface : undefined,
    };
  } catch {
    return undefined;
  }
}

// ───────────────────────── merge and apply ─────────────────────────

/** One style from every source, the most exact first (a website and CSS name their colours; images are sampled). */
export function mergeStyles(parts: StylePart[]): CapturedStyle {
  const firstOf = <K extends keyof StylePart>(k: K) => parts.map((p) => p[k]).find((v) => v !== undefined);
  // Each source's colours count by their share of that source, so one busy page doesn't drown out the others.
  const colors = parts.flatMap((p, i) => {
    const total = p.colors.reduce((n, c) => n + c.weight, 0) || 1;
    return p.colors.map((c) => ({ hex: c.hex, weight: (c.weight / total) * (parts.length - i) }));
  });
  const brand = distinct(colors, 3);
  // Where each value came from: the first source that has it (colours: the source whose palette holds that exact hex).
  const origins: Array<{ what: string; value: string; from: string }> = [];
  brand.forEach((hex, i) => {
    const p = parts.find((x) => x.colors.some((c) => c.hex.toLowerCase() === hex.toLowerCase()));
    if (p) origins.push({ what: i === 0 ? "Main brand colour" : `Brand colour ${i + 1}`, value: hex, from: p.source });
  });
  const firstWith = (pick: (p: StylePart) => string | number | undefined, what: string, fmt: (v: string | number) => string = String) => {
    const p = parts.find((x) => pick(x) !== undefined && pick(x) !== "");
    if (p) origins.push({ what, value: fmt(pick(p)!), from: p.source });
  };
  firstWith((p) => p.background, "Background");
  firstWith((p) => p.text, "Text colour");
  firstWith((p) => p.fonts.display, "Heading font");
  firstWith((p) => p.fonts.body, "Body font");
  firstWith((p) => p.radiusPx, "Corners", (v) => `${v}px`);
  firstWith((p) => p.vibe, "Surface style");
  return {
    origins,
    brand,
    background: firstOf("background") as string | undefined,
    text: firstOf("text") as string | undefined,
    fonts: { display: parts.map((p) => p.fonts.display).find(Boolean), body: parts.map((p) => p.fonts.body).find(Boolean) },
    radiusPx: firstOf("radiusPx") as number | undefined,
    vibe: firstOf("vibe") as string | undefined,
    sources: parts.map((p) => p.source),
  };
}

const SERIF = /serif|garamond|playfair|georgia|times|merriweather|lora|baskerville|caslon|didot|bodoni|crimson|libre/i;
const stack = (family: string) => `"${family}", ${SERIF.test(family) && !/sans/i.test(family) ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif'}`;

/** Writes the captured style through the Styles page's own functions; returns what changed, in plain words. */
export function applyCapturedStyle(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }, style: CapturedStyle): string[] {
  const done: string[] = [];
  if (style.brand.length) {
    applyPalette(jail, ops, ctx, { brand: style.brand.map((hex, i) => ({ hex, role: BRAND_ROLES[i] })), neutral: "brand" });
    done.push(`colours ${style.brand.join(", ")}`);
  }
  const values: Record<string, string> = {};
  const googleFonts: string[] = [];
  if (style.fonts.display) {
    values["--font-display"] = stack(style.fonts.display);
    googleFonts.push(style.fonts.display);
  }
  if (style.fonts.body) {
    values["--font-sans"] = stack(style.fonts.body);
    googleFonts.push(style.fonts.body);
  }
  if (style.radiusPx !== undefined) {
    const r = Math.round(style.radiusPx);
    if (r >= 99) values["--radius-md"] = "999px";
    else {
      values["--radius-sm"] = `${Math.max(0, Math.round(r * 0.66))}px`;
      values["--radius-md"] = `${r}px`;
      values["--radius-lg"] = `${Math.min(32, Math.round(r * 1.5))}px`;
    }
  }
  if (Object.keys(values).length) {
    const res = applyDesign(jail, ops, ctx, { theme: "default", values, googleFonts: googleFonts.length ? googleFonts : undefined });
    if (res.changed.length) done.push([style.fonts.display || style.fonts.body ? `fonts ${[style.fonts.display, style.fonts.body].filter(Boolean).join(" and ")}` : "", style.radiusPx !== undefined ? `${Math.round(style.radiusPx)}px corners` : ""].filter(Boolean).join(", "));
  }
  if (style.vibe && style.vibe !== "flat") {
    setSurfaceStyle(jail, ops, ctx, style.vibe);
    done.push(`${STYLE_VIBES.find((v) => v.id === style.vibe)?.name ?? style.vibe} surfaces`);
  }
  return done.filter(Boolean);
}

// ───────────────────────── one call for a build or the Styles page ─────────────────────────

export interface CaptureSource {
  name: string;
  role: "image" | "html" | "css";
  /** Text for HTML and CSS; base64 for an image. */
  content: string;
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/**
 * Captures one style from a website and attached files: exact sources (the website, CSS, HTML) first, then images.
 * The headless browser starts only when a website or an image needs it. Notes say what each source gave, in plain
 * words, including what couldn't be read.
 */
export async function captureStyle(
  deps: { router: ModelRouter; launchBrowser: () => Promise<BrowserSession> },
  input: { url?: string; files: CaptureSource[]; vision?: ModelAssignment },
  ctx: { projectId?: string; runId?: string; signal?: AbortSignal },
): Promise<{ style: CapturedStyle; notes: string[] }> {
  const parts: StylePart[] = [];
  const notes: string[] = [];
  for (const f of input.files.filter((x) => x.role === "css")) parts.push(styleFromCss(f.content, f.name));
  for (const f of input.files.filter((x) => x.role === "html")) parts.push(styleFromHtml(f.content, f.name));
  const images = input.files.filter((x) => x.role === "image");
  let session: BrowserSession | undefined;
  try {
    if (input.url || images.length) session = await deps.launchBrowser();
    if (input.url && session) {
      try {
        const { part } = await styleFromUrl(session, input.url);
        parts.unshift(part);
      } catch (err) {
        notes.push(`Couldn't read ${input.url}: ${(err as Error).message.split("\n")[0].slice(0, 160)}`);
      }
    }
    for (const img of images) {
      if (!session || ctx.signal?.aborted) break;
      const ext = img.name.split(".").pop()?.toLowerCase() ?? "png";
      try {
        const part = partFromImageColors(img.name, await colorsFromImage(session, img.content, MIME[ext] ?? "image/png"));
        const seen = await visionStyle(deps.router, input.vision, img.content, ctx);
        if (seen) Object.assign(part, { fonts: seen.fonts, radiusPx: seen.radiusPx, vibe: seen.vibe });
        else notes.push(`${img.name}: colours read from the image; fonts, corners and surface need a vision model (set one up as the critic), so set them on the Styles page.`);
        parts.push(part);
      } catch (err) {
        notes.push(`Couldn't read ${img.name}: ${(err as Error).message.split("\n")[0].slice(0, 160)}`);
      }
    }
  } finally {
    await session?.close();
  }
  const style = mergeStyles(parts);
  // A black-and-white site has no brand hue: its ink is the brand (agenticskills.io gave only fonts and corners, and
  // the person couldn't tell whether the capture had worked).
  if (!style.brand.length && style.text && /^#[0-9a-f]{6}$/i.test(style.text) && parts.length) {
    style.brand = [style.text];
    notes.push(`${style.sources.join(", ") || "The source"} is black and white, with no accent colour, so its ink ${style.text} is the brand colour. Pick an accent on the Colours card if you want one.`);
  }
  style.fonts = await googleFonts(style.fonts, notes, ctx.signal);
  return { style, notes };
}

// ───────────────────────── fonts the app can actually load ─────────────────────────

/**
 * Open lookalikes on Google Fonts for well-known proprietary fonts. No BIO & GMO build: the captured site used Square
 * Sans Display VF and Square Sans Text VF; their names went into a Google Fonts link that Google answered with an
 * error, so the app and the Styles page silently fell back to the system font.
 */
const LOOKALIKES: Array<[RegExp, string]> = [
  [/square sans|circular|cera|gt walsheim|gilroy|sofia pro/i, "DM Sans"],
  [/sf pro|san francisco|helvetica|arial|graphik|söhne|sohne|suisse|neue haas|aktiv grotesk|segoe/i, "Inter"],
  [/proxima nova|gotham|montserrat/i, "Montserrat"],
  [/avenir|nunito/i, "Nunito Sans"],
  [/futura|century gothic|twentieth century/i, "Jost"],
  [/brandon|josefin/i, "Josefin Sans"],
  [/garamond/i, "EB Garamond"],
  [/didot|bodoni|canela|freight display|tiempos headline/i, "Playfair Display"],
  [/tiempos|georgia|charter|times|caslon|baskerville|freight/i, "Lora"],
  [/sf mono|menlo|consolas|monaco|cascadia|fira code|operator mono/i, "JetBrains Mono"],
];

const googleSeen = new Map<string, boolean>();
async function onGoogleFonts(family: string, signal?: AbortSignal): Promise<boolean> {
  if (googleSeen.has(family)) return googleSeen.get(family)!;
  let ok = false;
  try {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400`, { signal });
    ok = res.ok;
  } catch {
    ok = false;
  }
  googleSeen.set(family, ok);
  return ok;
}

/** Each captured font as a family Google Fonts serves: itself, or the closest open lookalike (with a note saying so). */
export async function googleFonts(fonts: CapturedStyle["fonts"], notes: string[], signal?: AbortSignal): Promise<CapturedStyle["fonts"]> {
  const out: CapturedStyle["fonts"] = {};
  for (const role of ["display", "body"] as const) {
    const family = fonts[role];
    if (!family) continue;
    if (await onGoogleFonts(family, signal)) {
      out[role] = family;
      continue;
    }
    // "Square Sans Display VF" → "Square Sans": the family without its optical-size and variable-font suffixes.
    const base = family.replace(/\b(VF|Variable|Display|Text|Pro|Std|Web)\b/gi, "").replace(/\s+/g, " ").trim();
    if (base && base !== family && (await onGoogleFonts(base, signal))) {
      out[role] = base;
      continue;
    }
    const swap = LOOKALIKES.find(([re]) => re.test(family))?.[1] ?? (SERIF.test(family) && !/sans/i.test(family) ? "Lora" : /mono|code/i.test(family) ? "JetBrains Mono" : role === "display" ? "Manrope" : "DM Sans");
    out[role] = swap;
    notes.push(`${family} isn't on Google Fonts, so the app uses ${swap}, the closest open font. Change it on the Styles page if you prefer another.`);
  }
  return out;
}
