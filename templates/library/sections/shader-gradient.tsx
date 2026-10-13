/** @flowcode-library shader-gradient · Shader gradient: animated WebGL background (Page backgrounds)
 * Catalog ID: c.background.shader (component)
 * Function: The shader gradient background (c.background.shader): soft, flowing, grainy three-color gradients drawn live on the graphics card in eight shapes and nine named looks, behind a hero, a panel or a feature, with a visible Pause, a still frame for reduced motion and a plain CSS gradient where WebGL isn't available. Also exports SHADER_PRESETS and SHADER_SHAPES.
 * Use it as: import { ShaderGradient, SHADER_PRESETS } from "./shader-gradient"; <ShaderGradient preset?="tide"|"calm"|"pearl"|"dusk"|"mint"|"midnight"|"candy"|"ember"|"aurora" variant?="grid"|"waves"|"plane"|"orb"|"ribbon"|"halo"|"aurora"|"liquid" speed?={1.2} grain?={true} intensity?={1} colors?={["#…","#…","#…"]} scrim? paused? onPausedChange? pauseButton?={true} className? aria-label?|aria-labelledby?>content that sits on it</ShaderGradient>  // a preset picks shape, speed, grain, intensity and a tone of the style's colors; explicit props win
 * Variants: c.background.shader.grid - travel, wellness, music and calm launches: a perspective grid of light lines riding a rolling water surface towards a hazy sun; c.background.shader.waves - a launch hero or a landing page's first screen: flowing bands of color like light on moving water; c.background.shader.plane - a sign-up panel, a pricing header or a quiet feature card: large soft blobs drifting into each other; c.background.shader.orb - a product or AI feature moment, an empty state: a glowing, breathing sphere of color on the page color; c.background.shader.ribbon - a fashion, beauty or creative launch: twisting bands of color like silk; c.background.shader.halo - an AI assistant, a voice or focus moment: a turning ring of light; c.background.shader.aurora - a night or nature theme, an event: rising curtains of light; c.background.shader.liquid - an art, music or brand page: stirring marbled color
 * Built from: c.button
 * Look: A soft, grainy gradient in the accent, secondary and focus colors (or a preset's tone of them: pearly pastels or minty on a light base, warm or vivid on a dark one) that moves continuously like water or light, with a small round Pause button in the corner and the content readable above it on an optional scrim.
 * Tokens: --color-accent --color-secondary --color-focus --color-success --color-bg --color-on-accent --color-surface --color-surface-sunken --color-text --color-text-muted --color-border --overlay-border --surface-radius --radius-md --radius-lg --pill-radius --surface-shadow --space-1 --space-2 --space-3 --space-4 --space-6 --space-8 --text-xs --text-sm --text-xl --text-2xl --weight-semibold --duration-fast --easing --focus-ring
 * Use cases: hero background; landing page background; product launch; AI feature intro; sign up panel; pricing header; event page; music or game launch
 * Jobs to be done: feel the brand's personality; notice a launch or announcement; focus on the main message; stop it moving
 * Keywords: background, gradient, shader, webgl, animated gradient, mesh, grain, aurora, orb, waves, ribbon, halo, liquid, marble, water grid, presets
 */
/**
 * Shader gradient: an animated background drawn by FlowCode's own WebGL fragment shader. Eight shapes ("waves",
 * "plane", "orb", "ribbon", "halo", "aurora", "liquid", "grid") and nine presets ("tide", "calm", "pearl", "dusk", "mint",
 * "midnight", "candy", "ember", "aurora"), each a shape with a speed, grain, intensity and a tone: which of the style's
 * colors it uses, how saturated or light they are, and whether they sit on the page color or a dark or light base made
 * from the accent. Colors always come from the design tokens (re-read when the theme changes) unless `colors` is given.
 * Every instance on a page draws through one shared graphics context, so a gallery of them never runs out of contexts.
 * It animates only while on screen and the tab is visible, never for people who ask for reduced motion (they get one
 * still frame), and shows a Pause button while it moves (WCAG pause, stop, hide); `paused`/`onPausedChange` let a page
 * pause several at once. Without WebGL, or when the context is lost, a plain CSS gradient in the same colors shows.
 * Written for FlowCode; the look is inspired by soft "shader gradient" galleries, and every shader here is FlowCode's
 * own (no code from any shader library).
 * Make it the app's own: replace SAMPLE with your headline and actions, pick the preset (or shape) that suits the brand,
 * and leave the colors to the style's tokens unless a moment needs its own.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

export type ShaderGradientVariant = "waves" | "plane" | "orb" | "ribbon" | "halo" | "aurora" | "liquid" | "grid";
export type ShaderGradientPreset = "tide" | "calm" | "pearl" | "dusk" | "mint" | "midnight" | "candy" | "ember" | "aurora";
type RGB = [number, number, number];
type ColorToken = "accent" | "secondary" | "focus" | "success";

/** How a look treats the style's colors: which tokens, how saturated and light, warmer or not, and what they sit on. */
export type ShaderTone = {
  use?: [ColorToken, ColorToken, ColorToken];
  /** Saturation multiplier (1 = as the style has it). */
  sat?: number;
  /** Lightness shift, -1 to 1. */
  light?: number;
  /** Hue turn for each color, in degrees. */
  hue?: [number, number, number];
  /** Hues (degrees) each color is pulled towards, by `pull` (0 to 1): a mood, kept in the style's own saturation. */
  toward?: [number, number, number];
  pull?: number;
  /** page = the page color; dark, deep and light are made from the accent's hue. */
  base?: "page" | "dark" | "deep" | "light";
};

const MODE: Record<ShaderGradientVariant, number> = { waves: 0, plane: 1, orb: 2, ribbon: 3, halo: 4, aurora: 5, liquid: 6, grid: 7 };

/** The shapes, with a line on what each looks like (for pickers). */
export const SHADER_SHAPES: { id: ShaderGradientVariant; label: string; what: string }[] = [
  { id: "grid", label: "Grid", what: "light lines on rolling water" },
  { id: "waves", label: "Waves", what: "flowing bands like light on water" },
  { id: "plane", label: "Plane", what: "soft blobs drifting together" },
  { id: "orb", label: "Orb", what: "a glowing, breathing sphere" },
  { id: "ribbon", label: "Ribbon", what: "twisting silk bands" },
  { id: "halo", label: "Halo", what: "a turning ring of light" },
  { id: "aurora", label: "Aurora", what: "rising curtains of light" },
  { id: "liquid", label: "Liquid", what: "stirring marbled color" },
];

export type ShaderPresetSpec = { label: string; what: string; variant: ShaderGradientVariant; speed: number; grain: boolean; intensity: number; tone: ShaderTone };

/** The named looks: a shape, its motion and a tone of the style's colors (never fixed colors). */
export const SHADER_PRESETS: Record<ShaderGradientPreset, ShaderPresetSpec> = {
  tide: { label: "Tide", what: "Lines of light on rolling water", variant: "grid", speed: 1.1, grain: false, intensity: 0.95, tone: { use: ["secondary", "accent", "focus"], sat: 1.1, light: 0.04, base: "deep" } },
  calm: { label: "Calm", what: "Soft blobs, toned down, on the page color", variant: "plane", speed: 0.9, grain: true, intensity: 0.7, tone: { sat: 0.85, light: 0.08, base: "page" } },
  pearl: { label: "Pearl", what: "Soft iridescent pastels on a light base", variant: "waves", speed: 0.9, grain: false, intensity: 0.8, tone: { sat: 0.6, light: 0.22, hue: [0, 70, -70], base: "light" } },
  dusk: { label: "Dusk", what: "Warm-to-cool waves on a deep base", variant: "waves", speed: 1.1, grain: true, intensity: 0.95, tone: { sat: 1.2, toward: [22, 275, 330], pull: 0.7, base: "deep" } },
  mint: { label: "Mint", what: "Fresh marbled liquid on a light base", variant: "liquid", speed: 1, grain: false, intensity: 0.85, tone: { use: ["success", "focus", "success"], sat: 1, light: 0.12, toward: [158, 185, 135], pull: 0.65, base: "light" } },
  midnight: { label: "Midnight", what: "A ring of light on a dark base", variant: "halo", speed: 1.2, grain: true, intensity: 1, tone: { sat: 1.3, light: 0.05, base: "dark" } },
  candy: { label: "Candy", what: "Pastel ribbons on a light base", variant: "ribbon", speed: 1.4, grain: false, intensity: 0.9, tone: { sat: 1.25, light: 0.2, hue: [0, 45, -45], base: "light" } },
  ember: { label: "Ember", what: "A glowing warm orb on a dark base", variant: "orb", speed: 1.3, grain: true, intensity: 1, tone: { sat: 1.4, toward: [22, 8, 40], pull: 0.7, base: "dark" } },
  aurora: { label: "Aurora", what: "Northern-light curtains on a dark base", variant: "aurora", speed: 1, grain: true, intensity: 1, tone: { use: ["success", "focus", "secondary"], sat: 1.4, light: 0.04, toward: [150, 185, 285], pull: 0.5, base: "dark" } },
};

export type ShaderGradientProps = {
  /** A named look; explicit props below win over it. */
  preset?: ShaderGradientPreset;
  variant?: ShaderGradientVariant;
  /** How fast it flows: 1.2 (the default) is a lively, continuous flow; 0.5 is a slow drift. */
  speed?: number;
  /** Film grain mixed in by the shader. */
  grain?: boolean;
  /** How strongly the colors show over the base, 0 to 1. */
  intensity?: number;
  /** Three CSS colors instead of the style's (the preset's base still applies). */
  colors?: [string, string, string];
  /** A soft wash of the base color behind the content, so text stays readable on any colors. */
  scrim?: boolean;
  /** Controlled pause, for a page that pauses several at once. */
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** The corner Pause button. Turn it off only when the page gives its own Pause for this piece. */
  pauseButton?: boolean;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

const reducedMotionQuery = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null);

/** True while the person asks for reduced motion; follows changes. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => reducedMotionQuery()?.matches ?? false);
  useEffect(() => {
    const q = reducedMotionQuery();
    if (!q) return;
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

// ── Colors: tokens (or the colors prop) to 0–1 RGB, then the tone ──

let paintCtx: CanvasRenderingContext2D | null | undefined;
/** Any CSS color the browser understands, painted on a 1×1 canvas and read back. */
function paintToRgb(v: string): RGB | null {
  if (paintCtx === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    paintCtx = c.getContext("2d", { willReadFrequently: true });
  }
  if (!paintCtx) return null;
  paintCtx.clearRect(0, 0, 1, 1);
  paintCtx.fillStyle = "#000";
  paintCtx.fillStyle = v;
  paintCtx.fillRect(0, 0, 1, 1);
  const d = paintCtx.getImageData(0, 0, 1, 1).data;
  return [d[0]! / 255, d[1]! / 255, d[2]! / 255];
}

export function parseColor(input: string): RGB | null {
  const v = input.trim();
  if (!v) return null;
  let m = /^#([0-9a-f]{3,4})$/i.exec(v);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1]![i]! + m![1]![i]!, 16) / 255) as RGB;
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1]!.slice(i, i + 2), 16) / 255) as RGB;
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/i.exec(v);
  if (m) return [m[1]!, m[2]!, m[3]!].map((n) => (n.endsWith("%") ? parseFloat(n) / 100 : parseFloat(n) / 255)) as RGB;
  return paintToRgb(v);
}

export const rgbToHex = (c: RGB) => `#${c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0")).join("")}`;
const rgbCss = (c: RGB) => `rgb(${c.map((x) => Math.round(x * 255)).join(" ")})`;

function toHsl([r, g, b]: RGB): RGB {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl([h, s, l]: RGB): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const luminance = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

type Tokens = Record<ColorToken | "bg", RGB | null>;

/** The color tokens as RGB, resolved through a probe inside the element (so var() and color-mix() are worked out). */
function readTokens(el: HTMLElement): Tokens {
  const probe = document.createElement("span");
  probe.style.display = "none";
  el.appendChild(probe);
  const cs = getComputedStyle(el);
  const read = (name: string) => {
    if (!cs.getPropertyValue(name).trim()) return null;
    probe.style.color = `var(${name})`;
    return parseColor(getComputedStyle(probe).color);
  };
  try {
    return { accent: read("--color-accent"), secondary: read("--color-secondary"), focus: read("--color-focus"), success: read("--color-success"), bg: read("--color-bg") };
  } finally {
    probe.remove();
  }
}

/** Resolves any CSS color through the element (so tokens and names work too). */
function resolveColor(el: HTMLElement, v: string): RGB | null {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = v;
  el.appendChild(probe);
  const out = probe.style.color ? parseColor(getComputedStyle(probe).color) : null;
  probe.remove();
  return out ?? parseColor(v);
}

type Palette = { a: RGB; b: RGB; c: RGB; bg: RGB; base: RGB | null; on: RGB | null };

function palette(el: HTMLElement, tone: ShaderTone, override?: [string, string, string]): Palette {
  const t = readTokens(el);
  const accent = t.accent ?? [0.36, 0.4, 0.95];
  const pick = (k: ColorToken): RGB => t[k] ?? (k === "focus" ? t.secondary ?? accent : accent);
  const use = tone.use ?? ["accent", "secondary", "focus"];
  const own = override?.map((s) => resolveColor(el, s));
  const raw = use.map((k, i) => own?.[i] ?? pick(k)) as [RGB, RGB, RGB];
  const shade = (c: RGB, i: number): RGB => {
    if (own) return c;
    let [h, s, l] = toHsl(c);
    h = (h + (tone.hue?.[i] ?? 0) + 360) % 360;
    if (tone.toward && tone.pull) {
      const d = ((tone.toward[i] - h + 540) % 360) - 180;
      h = (h + d * tone.pull + 360) % 360;
    }
    s = clamp01(s * (tone.sat ?? 1));
    l = clamp01(l + (tone.light ?? 0));
    return fromHsl([h, s, l]);
  };
  const [a, b, c] = raw.map(shade) as [RGB, RGB, RGB];
  const [ah, as] = toHsl(accent);
  const kind = tone.base ?? "page";
  const base: RGB | null =
    kind === "dark" ? fromHsl([ah, Math.min(0.45, as), 0.075]) : kind === "deep" ? fromHsl([ah, Math.min(0.55, as), 0.17]) : kind === "light" ? fromHsl([ah, Math.min(0.5, as), 0.955]) : null;
  const bg = base ?? t.bg ?? [1, 1, 1];
  // Text on a base the preset made: light on dark, dark on light, in the accent's hue.
  const on: RGB | null = base ? (luminance(base) < 0.4 ? fromHsl([ah, 0.3, 0.96]) : fromHsl([ah, 0.35, 0.12])) : null;
  return { a, b, c, bg, base, on };
}

// ── The shaders (FlowCode's own) ──

const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform vec3 uBg;
uniform float uMode;
uniform float uGrain;
uniform float uAmt;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p; a *= 0.5; }
  return v;
}
float sat(float x) { return clamp(x, 0.0, 1.0); }
// Three colors along one 0..1 ramp: A, then B, then C.
vec3 ramp(float k) {
  k = sat(k);
  return mix(mix(uA, uB, smoothstep(0.0, 0.55, k)), uC, smoothstep(0.45, 1.0, k));
}

// Waves: a tilted surface of bands, bent by slow noise, with a soft sheen along each crest.
vec3 waves(vec2 p, float t) {
  vec2 q = mat2(0.92, -0.38, 0.38, 0.92) * p;
  float w = fbm(q * 1.3 + vec2(t * 0.12, -t * 0.07));
  float h = q.y * 1.6 + 0.28 * sin(q.x * 2.4 + t * 0.55 + w * 2.6) + 0.14 * sin(q.x * 4.7 - t * 0.38) + (w - 0.5) * 0.9;
  vec3 col = ramp(0.5 + 0.5 * sin(h * 3.2 - t * 0.25));
  float crest = pow(0.5 + 0.5 * sin(h * 5.2 - t * 0.5 + 1.3), 5.0);
  col = mix(col, mix(col, vec3(1.0), 0.55), crest * 0.35);
  col *= 0.9 + 0.18 * (1.0 - abs(cos(h * 3.2 - t * 0.25)));
  return mix(uBg, col, uAmt);
}

// Plane: large blobs, the noise warped by itself so the shapes melt into each other.
vec3 plane(vec2 p, float t) {
  vec2 s = p * 1.1;
  vec2 w = vec2(fbm(s + vec2(t * 0.12, t * 0.08)), fbm(s + vec2(5.2, 1.3) - t * 0.1));
  float n = fbm(s + w * 1.7 + vec2(-t * 0.06, t * 0.04));
  vec3 col = ramp(smoothstep(0.28, 0.72, n));
  col = mix(col, mix(col, vec3(1.0), 0.4), smoothstep(0.62, 0.9, w.x) * 0.3);
  return mix(uBg, col, uAmt);
}

// Orb: a sphere with a wobbling edge, colors swirling inside, lit from the top left, and a glow around it.
vec3 orb(vec2 p, float t, out float mask) {
  float r = length(p);
  vec2 dir = r > 0.0001 ? p / r : vec2(1.0, 0.0);
  float ang = atan(p.y, p.x);
  float edge = 0.3 + 0.014 * sin(ang * 3.0 + t * 0.7) + 0.045 * (fbm(dir * 1.3 + vec2(t * 0.12, -t * 0.09)) - 0.5);
  float n = fbm(p * 2.6 + vec2(t * 0.18, -t * 0.12));
  vec3 inner = ramp(smoothstep(0.15, 0.85, n + p.y * 0.9 + 0.05));
  float depth = sqrt(max(0.0, 1.0 - (r * r) / (edge * edge)));
  float light = sat(dot(normalize(vec3(p, depth * edge + 0.0001)), normalize(vec3(-0.45, 0.55, 0.7))));
  inner = inner * (0.72 + 0.38 * light) + vec3(1.0) * pow(light, 14.0) * 0.25;
  float body = smoothstep(edge + 0.012, edge - 0.012, r);
  float glow = exp(-max(r - edge, 0.0) * 7.0) * (1.0 - body);
  vec3 halo = mix(uBg, ramp(0.5 + 0.5 * dot(dir, vec2(cos(t * 0.3), sin(t * 0.3)))), 0.55 * uAmt);
  mask = sat(body + glow);
  return mix(mix(uBg, halo, glow), mix(uBg, inner, uAmt), body);
}

// Ribbon: two silk bands following waving centre lines; their width follows a twist, so they turn over.
vec3 ribbon(vec2 p, float t) {
  vec3 col = mix(uBg, ramp(0.5 + 0.5 * sin(p.x * 1.2 + t * 0.2)), 0.12 * uAmt);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float cy = 0.16 * sin(p.x * 1.7 + t * 0.55 + fi * 2.1) + 0.07 * sin(p.x * 3.3 - t * 0.4 + fi) + (fi - 0.5) * 0.16;
    float tw = cos(p.x * 1.9 - t * 0.7 + fi * 1.7);
    float wdt = 0.02 + 0.11 * abs(tw) * (1.0 - fi * 0.45);
    float d = (p.y - cy) / wdt;
    float ad = abs(d);
    float body = smoothstep(1.0, 1.0 - min(0.9, 0.004 / wdt), ad);
    float shadow = exp(-abs(p.y - cy + 0.04) / (wdt + 0.05)) * 0.2 * (1.0 - body);
    col = mix(col, col * 0.82, shadow * uAmt);
    float face = tw > 0.0 ? 1.0 : -1.0;
    vec3 c = ramp(sat(0.5 + 0.45 * sin(p.x * 0.9 + t * 0.25 + fi * 1.5) + d * 0.12 * face));
    float sheen = pow(sat(1.0 - ad), 3.0) * abs(tw) * 0.35;
    c = c * (0.75 + 0.35 * (1.0 - ad * ad)) * (face > 0.0 ? 1.0 : 0.82) + vec3(sheen);
    col = mix(col, mix(uBg, c, uAmt), body);
  }
  return col;
}

// Halo: a thin bright ring with a wide glow; its colors turn around it and its radius breathes.
vec3 halo(vec2 p, float t) {
  float r = length(p);
  vec2 dir = r > 0.0001 ? p / r : vec2(1.0, 0.0);
  float R = 0.27 + 0.04 * (fbm(dir * 1.5 + t * 0.15) - 0.5) + 0.008 * sin(t * 0.9);
  float x = r - R;
  float core = exp(-x * x / 0.0006);
  float glow = exp(-abs(x) * 9.0);
  float fill = smoothstep(R, 0.0, r) * 0.25;
  float ang = dot(dir, vec2(cos(t * 0.5), sin(t * 0.5)));
  vec3 c = ramp(0.5 + 0.5 * ang);
  vec3 col = mix(uBg, ramp(0.5 - 0.5 * ang), fill * 0.6 * uAmt);
  col = mix(col, c, sat(glow * 0.75 * uAmt));
  return mix(col, mix(c, vec3(1.0), 0.6), sat(core * uAmt));
}

// Aurora: three curtains rising from a wavy lower edge, folded and streaked upwards.
vec3 aurora(vec2 p, float t) {
  vec3 col = mix(uBg, ramp(0.2), sat(0.25 - p.y * 0.5) * 0.25 * uAmt);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float n = fbm(vec2(p.x * 1.4 + fi * 3.1 + t * 0.08, t * 0.12 + fi));
    float edge = -0.12 + 0.16 * sin(p.x * 2.1 + t * 0.35 + fi * 2.0) + (n - 0.5) * 0.35 + fi * 0.06;
    float h = p.y - edge;
    float curtain = h > 0.0 ? exp(-h * (2.6 + fi)) : exp(h * 30.0);
    float folds = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(p.x * (7.0 + fi * 3.0) + n * 8.0 + t * 0.5), 2.0);
    float rays = 0.65 + 0.35 * noise(vec2(p.x * 38.0 + fi * 7.0, h * 1.5 + t * 0.15));
    float a = curtain * folds * rays * (0.85 - fi * 0.2);
    vec3 c = ramp(sat(h * 1.4 + 0.15 + fi * 0.25));
    col = mix(col, c, sat(a * uAmt));
    col += c * a * 0.15 * uAmt;
  }
  return col;
}

// Liquid: space folded over itself a few times, then read as marbled bands with fine light veins and a gloss.
vec3 liquid(vec2 p, float t) {
  vec2 q = p * 2.2;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    q += 0.32 * vec2(sin(q.y * 1.3 + t * 0.45 + fi * 1.7), cos(q.x * 1.1 - t * 0.35 + fi * 2.3));
  }
  float k = 0.5 + 0.5 * sin(q.x * 1.1 + q.y * 0.9);
  float k2 = 0.5 + 0.5 * sin(length(q) * 2.0 - t * 0.3);
  vec3 c = ramp(sat(k * 0.75 + k2 * 0.25));
  float vein = smoothstep(0.08, 0.0, abs(sin((k + k2 * 0.4) * 9.42)));
  c = mix(c, mix(c, vec3(1.0), 0.7), vein * 0.45);
  c += pow(sat(0.5 + 0.5 * sin(q.y * 2.0 + q.x * 0.5 + 1.0)), 8.0) * 0.18;
  return mix(uBg, c, uAmt);
}

// Grid (tide): a perspective grid of light lines laid on calm water. Layered swells roll towards the viewer, fine
// ripples run over them, the lines bend and brighten with the slope, the crests sparkle, and everything fades into
// haze at the horizon.
vec3 grid(vec2 p, float t) {
  float hz = 0.1;
  vec3 hazeCol = mix(uBg, ramp(0.75), 0.45 * uAmt);
  vec3 col = mix(uBg, hazeCol, exp(-max(p.y - hz, 0.0) * 5.0));
  // A soft band of light along the horizon, for depth.
  col += ramp(0.9) * exp(-abs(p.y - hz) * 14.0) * 0.18 * uAmt;
  if (p.y < hz) {
    float dy = hz - p.y;
    float z = 0.32 / dy;
    float x = p.x * z;
    // Four travelling waves (long swells to fine ripples), all moving towards the viewer: height and slope.
    float h = 0.0;
    vec2 slope = vec2(0.0);
    vec4 K = vec4(0.55, 1.1, 2.3, 6.1);
    vec4 A = vec4(0.42, 0.2, 0.08, 0.022);
    vec4 S = vec4(0.9, 1.3, 1.9, 3.0);
    vec2 D0 = normalize(vec2(0.15, 1.0));
    vec2 D1 = normalize(vec2(-0.45, 1.0));
    vec2 D2 = normalize(vec2(0.6, 1.0));
    vec2 D3 = normalize(vec2(-0.2, 1.0));
    float ph;
    ph = K.x * dot(D0, vec2(x, z)) + S.x * t; h += A.x * sin(ph); slope += A.x * K.x * cos(ph) * D0;
    ph = K.y * dot(D1, vec2(x, z)) + S.y * t; h += A.y * sin(ph); slope += A.y * K.y * cos(ph) * D1;
    ph = K.z * dot(D2, vec2(x, z)) + S.z * t; h += A.z * sin(ph); slope += A.z * K.z * cos(ph) * D2;
    ph = K.w * dot(D3, vec2(x, z)) + S.w * t + 1.7; h += A.w * sin(ph); slope += A.w * K.w * cos(ph) * D3;
    // The grid rides the surface: lines pushed sideways by the slope and lifted with the crests.
    float gx = x * 2.2 + slope.x * 0.9 + h * 0.3;
    float gz = z * 1.6 + h * 1.4;
    float w = clamp(0.028 * z, 0.035, 0.45);
    float lx = smoothstep(0.5 - w, 0.5, abs(fract(gx) - 0.5));
    float lz = smoothstep(0.5 - w * 1.3, 0.5, abs(fract(gz) - 0.5));
    // Facing the light on the front of a swell, in shadow in the troughs.
    float lit = sat(0.5 + 0.55 * clamp(-slope.y * 0.8 + h * 0.9, -1.0, 1.0));
    float near = exp(-z * 0.1);
    vec3 water = mix(uBg, ramp(0.12), 0.4 * uAmt) * (0.62 + 0.75 * lit);
    // Sparkle on the steepest crests only.
    float crest = pow(sat(h * 1.4 + 0.2), 6.0) * pow(lit, 3.0);
    water += mix(ramp(0.9), vec3(1.0), 0.4) * crest * 0.35 * near * uAmt;
    vec3 lineCol = mix(ramp(0.25 + 0.55 * lit), vec3(1.0), pow(lit, 4.0) * 0.35);
    float lines = max(lx, lz * 0.9) * (0.25 + 1.1 * lit) * (0.3 + 0.7 * near);
    vec3 sea = mix(water, lineCol, sat(lines * uAmt));
    // Haze swallows the far water and the lines at the horizon.
    col = mix(hazeCol, sea, sat(dy * 7.0));
    col += ramp(0.85) * exp(-dy * 45.0) * 0.2 * uAmt;
  }
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2((uv.x - 0.5) * uRes.x / uRes.y, uv.y - 0.5);
  float t = uTime;
  float mask = 1.0;
  vec3 col;
  if (uMode < 0.5) col = waves(p, t);
  else if (uMode < 1.5) col = plane(p, t);
  else if (uMode < 2.5) col = orb(p, t, mask);
  else if (uMode < 3.5) col = ribbon(p, t);
  else if (uMode < 4.5) col = halo(p, t);
  else if (uMode < 5.5) col = aurora(p, t);
  else if (uMode < 6.5) col = liquid(p, t);
  else col = grid(p, t);
  if (uGrain > 0.5) col += (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 137.0) - 0.5) * 0.07 * mask;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// ── One graphics context for every instance: each draws into it and copies the picture to its own canvas ──

type Program = { prog: WebGLProgram; buf: WebGLBuffer | null; U: Record<"res" | "time" | "a" | "b" | "c" | "bg" | "mode" | "grain" | "amt", WebGLUniformLocation | null> };
type Shared = Program & { gl: WebGLRenderingContext; canvas: HTMLCanvasElement; lost: boolean; users: Set<() => void>; release: number };
let shared: Shared | null = null;
let noWebGL = false;

function build(gl: WebGLRenderingContext): Program | null {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (!gl.isContextLost()) console.warn("ShaderGradient: shader didn't compile", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  return { prog, buf, U: { res: u("uRes"), time: u("uTime"), a: u("uA"), b: u("uB"), c: u("uC"), bg: u("uBg"), mode: u("uMode"), grain: u("uGrain"), amt: u("uAmt") } };
}

function join(user: () => void): Shared | null {
  if (!shared && !noWebGL) {
    const canvas = document.createElement("canvas");
    const opts: WebGLContextAttributes = { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true, powerPreference: "low-power" };
    const gl = (canvas.getContext("webgl", opts) ?? canvas.getContext("experimental-webgl", opts)) as WebGLRenderingContext | null;
    const program = gl && !gl.isContextLost() ? build(gl) : null;
    if (!gl || !program) noWebGL = true;
    else {
      const s: Shared = { ...program, gl, canvas, lost: false, users: new Set(), release: 0 };
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        s.lost = true;
        s.users.forEach((f) => f());
      });
      canvas.addEventListener("webglcontextrestored", () => {
        const again = build(gl);
        if (again) Object.assign(s, again, { lost: false });
        s.users.forEach((f) => f());
      });
      shared = s;
    }
  }
  if (!shared) return null;
  window.clearTimeout(shared.release);
  shared.users.add(user);
  return shared;
}

function leave(s: Shared, user: () => void) {
  s.users.delete(user);
  if (s.users.size) return;
  // Give the context back once nothing has used it for a moment (a remount in between keeps it).
  window.clearTimeout(s.release);
  s.release = window.setTimeout(() => {
    if (s.users.size || shared !== s) return;
    shared = null;
    s.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }, 1500);
}

type Frame = { time: number; mode: number; grain: boolean; amt: number; pal: Palette };

function drawInto(s: Shared, target: CanvasRenderingContext2D, w: number, h: number, f: Frame) {
  if (s.lost) return;
  const { gl, canvas, U } = s;
  if (canvas.width < w || canvas.height < h) {
    canvas.width = Math.max(canvas.width, w);
    canvas.height = Math.max(canvas.height, h);
  }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(U.res, w, h);
  gl.uniform1f(U.time, f.time);
  gl.uniform1f(U.mode, f.mode);
  gl.uniform1f(U.grain, f.grain ? 1 : 0);
  gl.uniform1f(U.amt, clamp01(f.amt));
  gl.uniform3fv(U.a, f.pal.a);
  gl.uniform3fv(U.b, f.pal.b);
  gl.uniform3fv(U.c, f.pal.c);
  gl.uniform3fv(U.bg, f.pal.bg);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // WebGL draws from the bottom left, so the picture is the bottom-left w×h of the shared canvas.
  target.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
}

type Live = { speed: number; grain: boolean; intensity: number; mode: number; tone: ShaderTone; colors?: [string, string, string]; playing: boolean };
type Api = { draw: () => void; sync: () => void; recolor: () => void };

/** c.background.shader: an animated WebGL gradient with content layered above it. */
export function ShaderGradient({
  preset,
  variant,
  speed,
  grain,
  intensity,
  colors,
  scrim,
  paused: pausedProp,
  onPausedChange,
  pauseButton = true,
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: ShaderGradientProps) {
  const look = preset ? SHADER_PRESETS[preset] : undefined;
  const shape = variant ?? look?.variant ?? "waves";
  const tone: ShaderTone = look?.tone ?? {};
  const settings = { speed: speed ?? look?.speed ?? 1.2, grain: grain ?? look?.grain ?? true, intensity: intensity ?? look?.intensity ?? 1 };

  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [ownPaused, setOwnPaused] = useState(false);
  const paused = pausedProp ?? ownPaused;
  const [failed, setFailed] = useState(false);
  const live = useRef<Live>({ ...settings, mode: MODE[shape], tone, colors, playing: false });
  const api = useRef<Api | null>(null);
  const colorKey = colors ? colors.join("|") : "";
  const toneKey = JSON.stringify(tone);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    let raf = 0;
    let last = 0;
    let onScreen = true;
    // A pleasant moment to start from (and the still frame for reduced motion).
    let time = 12;
    let pal: Palette | null = null;

    const onShared = () => {
      if (!s) return;
      setFailed(s.lost);
      if (!s.lost) draw();
      sync();
    };
    const s = ctx ? join(onShared) : null;
    if (!s || !ctx) {
      setFailed(true);
      return;
    }
    setFailed(false);

    const recolor = () => {
      const l = live.current;
      pal = palette(root, l.tone, l.colors);
      // A preset's own base and text colors, for the fallback, the scrim and the content.
      if (pal.base && pal.on) {
        root.style.setProperty("--fl-shader-base", rgbCss(pal.base));
        root.style.setProperty("--fl-shader-on", rgbCss(pal.on));
      } else {
        root.style.removeProperty("--fl-shader-base");
        root.style.removeProperty("--fl-shader-on");
      }
    };
    const render = () => {
      if (!canvas.width || !canvas.height || !pal) return;
      const l = live.current;
      drawInto(s, ctx, canvas.width, canvas.height, { time, mode: l.mode, grain: l.grain, amt: l.intensity, pal });
    };
    const frame = (ts: number) => {
      raf = 0;
      if (last) time += (Math.min(ts - last, 100) / 1000) * live.current.speed;
      last = ts;
      render();
      sync();
    };
    // Runs the loop only while playing, on screen and in a visible tab; otherwise stops it.
    const sync = () => {
      const run = live.current.playing && onScreen && !document.hidden && !s.lost;
      if (run && !raf) {
        if (!last) last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!run) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    };
    const draw = () => {
      if (!raf) render();
    };
    api.current = { draw, sync, recolor: () => (recolor(), draw()) };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      // Resizing clears a canvas, so draw again even when paused.
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      sync();
    });
    io.observe(root);
    const onVisibility = () => sync();
    document.addEventListener("visibilitychange", onVisibility);
    // A theme switch changes attributes on <html> (data-theme, class, style) or swaps a stylesheet.
    const mo = new MutationObserver(() => api.current?.recolor());
    mo.observe(document.documentElement, { attributes: true });
    mo.observe(document.head, { childList: true });

    recolor();
    resize();
    sync();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      api.current = null;
      leave(s, onShared);
    };
  }, []);

  // Props reach the running shader without starting it over.
  useEffect(() => {
    Object.assign(live.current, { ...settings, mode: MODE[shape] });
    api.current?.draw();
    // The settings are spelled out in the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.speed, settings.grain, settings.intensity, shape]);
  useEffect(() => {
    live.current.colors = colors;
    live.current.tone = tone;
    api.current?.recolor();
    // colorKey and toneKey stand for the colors and tone, so a new array with the same values doesn't re-read them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorKey, toneKey]);
  useEffect(() => {
    live.current.playing = !reduced && !paused;
    api.current?.sync();
    api.current?.draw();
  }, [reduced, paused, failed]);

  const toggle = () => {
    onPausedChange?.(!paused);
    if (pausedProp === undefined) setOwnPaused(!paused);
  };
  const Tag = children ? "section" : "div";
  return (
    <Tag
      ref={rootRef as never}
      className={`fl-shader-root fl-shader-root--${shape}${failed ? " fl-shader-static" : ""}${className ? ` ${className}` : ""}`}
      data-fl={`c.background.shader.${shape}`}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
    >
      <canvas ref={canvasRef} className="fl-shader-canvas" aria-hidden="true" />
      {children ? <div className={`fl-shader-content${scrim ? " fl-shader-scrim" : ""}`}>{children}</div> : null}
      {pauseButton && !failed && !reduced ? (
        <button type="button" className="fl-shader-toggle" aria-label={paused ? "Play animation" : "Pause animation"} title={paused ? "Play animation" : "Pause animation"} onClick={toggle}>
          <Icon name={paused ? "play" : "pause"} />
        </button>
      ) : null}
    </Tag>
  );
}

// ── The reference sheet: a playground, a gallery of every preset, and a hero ──

// flowcode:sample
const SAMPLE = {
  hero: {
    eyebrow: "New in Tidewater 3.0",
    title: "Your team's notes, flowing into one clear plan",
    lede: "Tidewater gathers meeting notes, decisions and follow-ups as they happen, and turns them into a plan everyone can see by Monday morning.",
    primary: "Start a free workspace",
    secondary: "Watch the two-minute tour",
  },
  playground: { eyebrow: "Playground", title: "Find your brand's motion", lede: "Pick a look, then tune its shape, speed and grain." },
};

function Note({ children }: { children: ReactNode }) {
  return <p className="fl-ctl-btn-what">{children}</p>;
}

type Play = { preset: ShaderGradientPreset; variant: ShaderGradientVariant; speed: number; grain: boolean; intensity: number };
const fromPreset = (p: ShaderGradientPreset): Play => {
  const s = SHADER_PRESETS[p];
  return { preset: p, variant: s.variant, speed: s.speed, grain: s.grain, intensity: s.intensity };
};
const PRESET_IDS = Object.keys(SHADER_PRESETS) as ShaderGradientPreset[];

function Playground() {
  const id = useId();
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState<Play>(() => fromPreset("dusk"));
  const [paused, setPaused] = useState(false);
  const [source, setSource] = useState<"style" | "custom">("style");
  const [custom, setCustom] = useState<[string, string, string]>(["#6e56cf", "#e5484d", "#12a594"]);
  const set = (patch: Partial<Play>) => setPlay((p) => ({ ...p, ...patch }));

  // Custom pickers start from the style's own colors, so switching changes nothing until a color is picked.
  const chooseCustom = () => {
    const el = stageRef.current;
    if (el && source !== "custom") {
      const t = readTokens(el);
      const a = t.accent ?? [0.4, 0.35, 0.8];
      setCustom([rgbToHex(a), rgbToHex(t.secondary ?? a), rgbToHex(t.focus ?? t.secondary ?? a)]);
    }
    setSource("custom");
  };

  return (
    <div className="fl-shader-play">
      <div ref={stageRef}>
        <ShaderGradient
          preset={play.preset}
          variant={play.variant}
          speed={play.speed}
          grain={play.grain}
          intensity={play.intensity}
          colors={source === "custom" ? custom : undefined}
          paused={paused}
          onPausedChange={setPaused}
          scrim
          className="fl-shader-preview"
          aria-labelledby={`${id}-title`}
        >
          <span className="fl-eyebrow">{SAMPLE.playground.eyebrow}</span>
          <h3 id={`${id}-title`} className="fl-shader-heading fl-shader-heading--big">
            {SAMPLE.playground.title}
          </h3>
          <p className="fl-shader-text">{SAMPLE.playground.lede}</p>
        </ShaderGradient>
      </div>

      <div className="fl-shader-controls">
        <div className="fl-shader-field fl-shader-field--wide" role="group" aria-labelledby={`${id}-looks`}>
          <span id={`${id}-looks`} className="fl-shader-label">
            Look
          </span>
          <div className="fl-shader-chips">
            {PRESET_IDS.map((p) => (
              <button key={p} type="button" className="fl-shader-chip" aria-pressed={play.preset === p} onClick={() => setPlay(fromPreset(p))}>
                {SHADER_PRESETS[p].label}
              </button>
            ))}
          </div>
        </div>

        <label className="fl-shader-field">
          <span className="fl-shader-label">Shape</span>
          <span className="fl-shader-select">
            <select value={play.variant} onChange={(e) => set({ variant: e.target.value as ShaderGradientVariant })}>
              {SHADER_SHAPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" />
          </span>
        </label>

        <label className="fl-shader-field">
          <span className="fl-shader-label">
            Speed <output>{play.speed.toFixed(1)}×</output>
          </span>
          <input className="fl-shader-range" type="range" min={0.2} max={3} step={0.1} value={play.speed} onChange={(e) => set({ speed: Number(e.target.value) })} />
        </label>

        <label className="fl-shader-field">
          <span className="fl-shader-label">
            Intensity <output>{Math.round(play.intensity * 100)}%</output>
          </span>
          <input className="fl-shader-range" type="range" min={0.2} max={1} step={0.05} value={play.intensity} onChange={(e) => set({ intensity: Number(e.target.value) })} />
        </label>

        <label className="fl-shader-check">
          <input type="checkbox" checked={play.grain} onChange={(e) => set({ grain: e.target.checked })} />
          <span>Film grain</span>
        </label>

        <div className="fl-shader-field" role="radiogroup" aria-labelledby={`${id}-colors`}>
          <span id={`${id}-colors`} className="fl-shader-label">
            Colors
          </span>
          <div className="fl-shader-chips">
            <label className="fl-shader-radio">
              <input type="radio" name={`${id}-src`} checked={source === "style"} onChange={() => setSource("style")} />
              <span>From the style</span>
            </label>
            <label className="fl-shader-radio">
              <input type="radio" name={`${id}-src`} checked={source === "custom"} onChange={chooseCustom} />
              <span>Custom</span>
            </label>
          </div>
          {source === "custom" ? (
            <div className="fl-shader-swatches">
              {custom.map((c, i) => (
                <label key={i} className="fl-shader-swatch">
                  <input type="color" value={c} onChange={(e) => setCustom((cs) => cs.map((x, j) => (j === i ? e.target.value : x)) as [string, string, string])} />
                  <span>{["First", "Second", "Third"][i]}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="fl-shader-field">
          <span className="fl-shader-label">Motion</span>
          {reduced ? (
            <p className="fl-shader-hint">Still: your device asks for reduced motion.</p>
          ) : (
            <Button variant="secondary" size={40} icon={paused ? "play" : "pause"} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              {paused ? "Play animation" : "Pause animation"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Gallery() {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [chosen, setChosen] = useState<ShaderGradientPreset | null>(null);
  return (
    <>
      <div className="fl-shader-gallery-bar">
        <p className="fl-shader-hint" aria-live="polite">
          {chosen ? `${SHADER_PRESETS[chosen].label}: preset="${chosen}"` : "Choose a look to see how to use it."}
        </p>
        {reduced ? null : (
          <Button variant="tertiary" size={32} icon={paused ? "play" : "pause"} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? "Play all" : "Pause all"}
          </Button>
        )}
      </div>
      <ul className="fl-shader-gallery">
        {PRESET_IDS.map((p) => {
          const s = SHADER_PRESETS[p];
          return (
            <li key={p}>
              <button type="button" className="fl-shader-tile" aria-pressed={chosen === p} onClick={() => setChosen(p)}>
                <ShaderGradient preset={p} paused={paused} pauseButton={false} className="fl-shader-thumb" />
                <span className="fl-shader-tile-name">{s.label}</span>
                <span className="fl-shader-tile-what">{s.what}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function ShaderGradientSheet() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Playground</h3>
        <Note>Every control works: pick a look, then change its shape, speed, intensity, grain and colors. Colors come from the style unless you pick your own.</Note>
        <Playground />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Nine looks</h3>
        <Note>Each preset is a shape, a speed and a tone of the style's colors. Only the tiles on screen move, they share one graphics context, and Pause all stops them.</Note>
        <Gallery />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Waves behind a hero</h3>
        <Note>Bands of the accent, secondary and focus colors flow like light on moving water. A page-colored scrim keeps the text readable; the corner button pauses it, and with reduced motion it stays still.</Note>
        <ShaderGradient variant="waves" scrim className="fl-shader-hero" aria-labelledby="shader-hero-title">
          <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
            <span className="fl-eyebrow">{d.hero.eyebrow}</span>
            <h2 id="shader-hero-title" className="fl-title">
              {d.hero.title}
            </h2>
            <p className="fl-lede">{d.hero.lede}</p>
            <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
              <Button href="#start">{d.hero.primary}</Button>
              <Button variant="secondary" href="#tour">
                {d.hero.secondary}
              </Button>
            </div>
          </div>
        </ShaderGradient>
      </div>
    </section>
  );
}
