/** @flowcode-library liquid-glass · Liquid glass: refracting glass buttons, bars and panels (Cards)
 * Catalog ID: c.liquid-glass (component)
 * Function: Liquid glass (c.liquid-glass): Apple-style glass that bends and softens what is behind it, for controls, floating bars and panels laid over imagery or gradients. A WebGL lens samples a backdrop the piece controls (the stage's token gradient, an image or a canvas); without WebGL it falls back to an SVG lens through backdrop-filter, then to frosted blur, then to the solid surface. Also exports GlassStage, GlassFilter, refreshGlass and useGlassMode.
 * Use it as: import { GlassStage, GlassFilter, GlassPanel, GlassButton, GlassBar } from "./liquid-glass"; <GlassFilter /> once per page; <GlassStage word?="TIDE">…glass here…</GlassStage>; <GlassButton label="Share" icon?="share" variant?="pill"|"round" pressed?={bool} onClick strength?="subtle"|"regular"|"strong"|"stronger"|"strongest" tone?="light"|"dark" />; <GlassBar items={[{ id, label, icon }]} current="home" onSelect={(id) => ...} label?="Main" />; <GlassPanel as?="section" strength? tone? radius? backdrop?="gradient"|imageUrl|canvasOrImgRef>…</GlassPanel>  // never for dialogs or modals
 * Variants: c.liquid-glass.button - a pill or perfectly round glass button over a picture or gradient; a toggle when pressed is set (aria-pressed); c.liquid-glass.bar - a floating navigation bar of glass: icon and label per place, an indicator that slides to the current one, arrow keys to move; c.liquid-glass.panel - a glass panel holding a small piece of content over imagery (now playing, weather, a caption). Every variant takes five strengths: subtle, regular, strong, stronger and strongest, each bending more at a thicker rim, blurring and tinting more, with a brighter rim
 * Built from: c.button
 * Look: Rounded panes of clear glass with a bright rim along the top edge and a soft shadow under them; what is behind bends at the curved edges and blurs gently in the middle, a light tint keeps text readable, and a soft highlight follows the pointer.
 * Tokens: --color-surface --color-text --color-bg --color-accent --color-on-accent --color-secondary --color-success --color-focus --color-text-muted --radius-lg --radius-xl --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-lg --weight-medium --weight-semibold --weight-bold --duration-fast --duration-base --ease-out --ease-spring --press-scale --focus-ring
 * Use cases: media player controls over artwork; floating tab bar over a photo; map overlay controls; weather or now-playing card over a hero image; camera or gallery toolbar; landing page hero buttons
 * Jobs to be done: use controls without losing sight of the picture behind; see where I am in the app; read a small card over a busy image
 * Keywords: liquid glass, glassmorphism, frosted glass, refraction, glass button, floating tab bar, translucent panel, backdrop blur
 */
/**
 * Liquid glass: panes that bend and soften what lies behind them. The glass is for controls, bars and panels laid over
 * imagery or gradients, never for dialogs or modals (a dialog sits on the solid surface, nothing showing through).
 * How it draws, best first, chosen by feature detection, never by browser name (data-glass on each surface says which):
 * - "webgl": one shared WebGL context renders a lens (edge refraction, rim, corner boost, ripple, gaussian blur,
 *   shape mask) from a backdrop the piece controls: the GlassStage's token gradient canvas, an image URL, or a canvas or
 *   image you pass by ref, aligned to the surface's place within its backdrop area (redrawn on resize and scroll, only
 *   while visible, device pixel ratio capped at 2). Nothing captures the page.
 * - "refract": no WebGL or no backdrop: an SVG lens (feImage displacement map into feDisplacementMap) through
 *   backdrop-filter: url(), then a light blur, where the browser takes url() in backdrop-filter.
 * - "frost": backdrop-filter: blur() saturate().
 * - "solid": the surface color: no backdrop-filter, prefers-reduced-transparency or forced colors.
 * Five strengths, subtle to strongest: each step bends more and deeper into the body, blurs more, widens the edge band
 * and brightens the rim and sheen; "strongest" is thick, heavily curved glass that clearly warps what is behind it.
 * Text stays readable: the tint is --color-surface at 42 to 88 percent, rising with the strength (tone="light"|"dark" to force one), and the
 * subtle strength adds a faint halo behind text. Reduced motion stops the indicator slide, the press wobble and the
 * pointer highlight.
 * Written for FlowCode. Make it the app's own: replace SAMPLE with your own controls and places, keep the glass to
 * controls and panels over pictures, and give GlassStage (or the backdrop prop) the picture they float over.
 * Adapted from liquid-glass-js by Armagan Amcalar (MIT), https://github.com/dashersw/liquid-glass-js
 */
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Icon } from "./icons";
import { AudioPlayer } from "./media-player";

export type GlassStrength = "subtle" | "regular" | "strong" | "stronger" | "strongest";
export type GlassTone = "light" | "dark";
/** How a surface is drawn; see the note at the top. */
export type GlassMode = "webgl" | "refract" | "frost" | "solid";
/** What the WebGL lens looks through: "gradient" (the token gradient, drawn offscreen), an image URL, or a canvas or image by ref. */
export type GlassBackdropSource = "gradient" | (string & {}) | RefObject<HTMLCanvasElement | HTMLImageElement | null>;

const STRENGTHS: GlassStrength[] = ["subtle", "regular", "strong", "stronger", "strongest"];
const isBrowser = typeof window !== "undefined";
const media = (q: string) => isBrowser && window.matchMedia(q).matches;
const reducedMotion = () => media("(prefers-reduced-motion: reduce)");
const supports = (prop: string, value: string) => isBrowser && typeof CSS !== "undefined" && CSS.supports(prop, value);

/* ── Fallback path: the SVG lens and what the browser can do ─────────────────────────────────────────────── */

/** The mounted SVG lens (one per page) and everyone watching for it. */
let lensId = "";
const watchers = new Set<() => void>();
const emit = () => watchers.forEach((fn) => fn());
const FALLBACK_QUERIES = ["(forced-colors: active)", "(prefers-reduced-transparency: reduce)"];
function subscribeMode(fn: () => void) {
  watchers.add(fn);
  const mqs = isBrowser ? FALLBACK_QUERIES.map((q) => window.matchMedia(q)) : [];
  mqs.forEach((m) => m.addEventListener("change", fn));
  return () => {
    watchers.delete(fn);
    mqs.forEach((m) => m.removeEventListener("change", fn));
  };
}

/** The path a surface takes when there is no WebGL lens for it: refract, frost or solid. */
function fallbackMode(): Exclude<GlassMode, "webgl"> {
  if (!isBrowser || FALLBACK_QUERIES.some(media)) return "solid";
  if (!supports("backdrop-filter", "blur(1px)") && !supports("-webkit-backdrop-filter", "blur(1px)")) return "solid";
  return lensId && supports("backdrop-filter", "url(#fl-glass-probe) blur(1px)") ? "refract" : "frost";
}
const snapshot = () => `${fallbackMode()}|${lensId}`;

/** The fallback path on this page and the mounted SVG lens's id ("" when GlassFilter isn't mounted). */
export function useGlassMode(): { fallback: Exclude<GlassMode, "webgl">; lens: string } {
  const [fallback, lens] = useSyncExternalStore(subscribeMode, snapshot, () => "solid|").split("|") as [Exclude<GlassMode, "webgl">, string];
  return { fallback, lens };
}

/**
 * The displacement map for the SVG lens: red runs right to left and green bottom to top, so the rim samples inward,
 * with a blurred neutral grey middle that leaves the center undisturbed.
 */
const MAP = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs>" +
    "<linearGradient id='x'><stop offset='0' stop-color='rgb(255,0,0)'/><stop offset='1' stop-color='rgb(0,0,0)'/></linearGradient>" +
    "<linearGradient id='y' x2='0' y2='1'><stop offset='0' stop-color='rgb(0,255,0)'/><stop offset='1' stop-color='rgb(0,0,0)'/></linearGradient>" +
    "<filter id='b' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='6'/></filter></defs>" +
    "<rect width='100' height='100' fill='url(#x)'/><rect width='100' height='100' fill='url(#y)' style='mix-blend-mode:screen'/>" +
    "<rect x='12' y='12' width='76' height='76' rx='20' fill='rgb(128,128,128)' filter='url(#b)'/></svg>",
)}`;
const SVG_SCALE: Record<GlassStrength, number> = { subtle: 16, regular: 28, strong: 44, stronger: 64, strongest: 90 };

/** The SVG lens the fallback path refracts through. Mount it once per page (a second one is harmless). */
export function GlassFilter() {
  const id = `fl-glass-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  useEffect(() => {
    lensId = id;
    emit();
    return () => {
      if (lensId === id) {
        lensId = "";
        emit();
      }
    };
  }, [id]);
  return (
    <svg className="fl-glass-filter" aria-hidden="true" focusable="false" width="0" height="0">
      {STRENGTHS.map((s) => (
        <filter key={s} id={`${id}-${s}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href={MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={SVG_SCALE[s]} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      ))}
    </svg>
  );
}

/* ── Colors from tokens, for the canvas painter and the shader ───────────────────────────────────────────── */

let swatch: CanvasRenderingContext2D | null = null;
/** Any CSS color (tokens, color-mix, light-dark) as it resolves inside `el`, as [r, g, b] from 0 to 255. */
export function resolveColor(el: Element, css: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;width:0;height:0;color:${css}`;
  el.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  swatch ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!swatch) return [128, 128, 128];
  swatch.clearRect(0, 0, 1, 1);
  swatch.fillStyle = computed;
  swatch.fillRect(0, 0, 1, 1);
  const [r, g, b] = swatch.getImageData(0, 0, 1, 1).data;
  return [r ?? 128, g ?? 128, b ?? 128];
}
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`;

/**
 * Paints the token backdrop into `canvas` at `area`'s size: the page color, four color blooms (accent, secondary,
 * success, focus), diagonal stripes and an optional bold word, so there is something for the glass to bend.
 * Returns false when the canvas is already that size and nothing changed.
 */
export function paintTokenGradient(canvas: HTMLCanvasElement, area: HTMLElement, word = "", force = false): boolean {
  const box = area.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(box.width * dpr));
  const h = Math.max(1, Math.round(box.height * dpr));
  if (!force && canvas.width === w && canvas.height === h && canvas.dataset.word === word) return false;
  canvas.width = w;
  canvas.height = h;
  canvas.dataset.word = word;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const c = (v: string) => resolveColor(area, v);
  ctx.fillStyle = rgba(c("var(--color-bg)"), 1);
  ctx.fillRect(0, 0, w, h);
  const blooms: [string, number, number, number][] = [
    ["var(--color-accent)", 0.18, 0.3, 0.42],
    ["var(--color-secondary, var(--color-accent))", 0.82, 0.22, 0.4],
    ["var(--color-success)", 0.62, 0.9, 0.46],
    ["var(--color-focus, var(--color-accent))", 0.3, 0.95, 0.36],
  ];
  for (const [token, x, y, r] of blooms) {
    const col = c(token);
    const rad = r * Math.max(w, h);
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, rad);
    g.addColorStop(0, rgba(col, 0.95));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const ink = c("var(--color-text)");
  ctx.save();
  ctx.strokeStyle = rgba(ink, 0.32);
  ctx.lineWidth = 6 * dpr;
  const step = 24 * dpr;
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h * 0.47, 0);
    ctx.stroke();
  }
  ctx.restore();
  if (word) {
    ctx.fillStyle = rgba(ink, 0.92);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.min(h * 0.62, (w * 1.5) / Math.max(3, word.length));
    ctx.font = `800 ${size}px ${getComputedStyle(area).fontFamily}`;
    ctx.fillText(word, w / 2, h / 2);
  }
  return true;
}

/* ── The WebGL lens: one shared context, drawn into each surface's own 2D canvas ─────────────────────────── */

/*
 * The lens shader is adapted from liquid-glass-js by Armagan Amcalar (MIT), https://github.com/dashersw/liquid-glass-js
 * (container.js): edge, rim, base and corner refraction along the shape's normal, the rim ripple, the gaussian blur,
 * the vertical sheen and sampled-gradient tint, and the rounded rectangle / pill / circle mask. Changed for FlowCode:
 * coordinates are in CSS pixels within a backdrop the piece controls (no page snapshot), the blur is a true gaussian,
 * the gradient is sampled across the surface only, a band uniform widens the edge for the stronger glass, the blur eases off in the rim band, the sheen color comes from the tokens and alpha is premultiplied.
 */
const VERTEX = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
varying vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_texcoord;
}`;
const FRAGMENT = `
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_res;
uniform vec2 u_origin;
uniform float u_scale;
uniform vec2 u_texSize;
uniform float u_radius;
uniform float u_blur;
uniform float u_edge;
uniform float u_rim;
uniform float u_base;
uniform float u_corner;
uniform float u_ripple;
uniform float u_warp;
uniform vec3 u_light;
uniform float u_shade;
uniform float u_band;
varying vec2 v_uv;

float boxDistance(vec2 p, vec2 size, float r) {
  vec2 c = size * 0.5;
  vec2 q = abs(p - c) - (c - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 shapeNormal(vec2 p, vec2 size, float r) {
  vec2 c = size * 0.5;
  if (abs(r - size.y * 0.5) < 2.0 && size.x > size.y + 4.0) {
    vec2 a = vec2(r, c.y);
    vec2 ab = vec2(size.x - r, c.y) - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    vec2 n = p - (a + t * ab);
    return length(n) > 0.0 ? normalize(n) : vec2(0.0, 1.0);
  }
  vec2 n = (p - c) / size;
  return length(n) > 0.0 ? normalize(n) : vec2(0.0, 1.0);
}

void main() {
  vec2 p = v_uv * u_res;
  float r = min(u_radius, min(u_res.x, u_res.y) * 0.5);
  float d = boxDistance(p, u_res, r);
  float inside = max(-d, 0.0);
  vec2 n = shapeNormal(p, u_res, r);

  float base = 1.0 - exp(-inside * 0.1 / u_band);
  float edge = exp(-inside * 0.15 / u_band);
  float rim = exp(-inside * 0.8 / u_band);
  float total = u_warp * base * u_base + edge * u_edge + rim * u_rim;
  float cornerD = max(min(p.x, u_res.x - p.x), min(p.y, u_res.y - p.y));
  total += exp(-cornerD * 0.3 / u_band) * u_corner;
  vec2 perpendicular = vec2(-n.y, n.x);
  float ripple = sin(inside / min(u_res.x, u_res.y) * 25.0) * u_ripple * rim;
  vec2 source = u_origin + (p + n * total + perpendicular * ripple) * u_scale;

  vec2 texel = 1.0 / u_texSize;
  // The rim band stays sharp so its bending reads, the body is frosted (a thick lens edge).
  float stepPx = max(u_blur * u_scale, 0.0001) / 3.0 * mix(1.0, 0.25, edge);
  vec4 color = vec4(0.0);
  float weights = 0.0;
  for (float i = -6.0; i <= 6.0; i += 1.0) {
    for (float j = -6.0; j <= 6.0; j += 1.0) {
      float dd = length(vec2(i, j));
      if (dd > 6.0) continue;
      float w = exp(-(dd * dd) / 18.0);
      color += texture2D(u_image, (source + vec2(i, j) * stepPx) * texel) * w;
      weights += w;
    }
  }
  color /= weights;

  vec3 top = vec3(0.0);
  vec3 mid = vec3(0.0);
  vec3 bottom = vec3(0.0);
  for (float k = 0.0; k < 7.0; k += 1.0) {
    float x = u_origin.x + (k / 6.0) * u_res.x * u_scale;
    top += texture2D(u_image, vec2(x, u_origin.y + 0.1 * u_res.y * u_scale) * texel).rgb;
    mid += texture2D(u_image, vec2(x, u_origin.y + 0.5 * u_res.y * u_scale) * texel).rgb;
    bottom += texture2D(u_image, vec2(x, u_origin.y + 0.9 * u_res.y * u_scale) * texel).rgb;
  }
  float g = v_uv.y;
  vec3 sampled = g < 0.5 ? mix(top, mid, g * 2.0) / 7.0 : mix(mid, bottom, (g - 0.5) * 2.0) / 7.0;
  vec3 rgb = mix(color.rgb, mix(u_light, u_light * 0.7, g), u_shade);
  rgb = mix(rgb, sampled, u_shade * 0.3);

  float mask = 1.0 - smoothstep(-1.0, 1.0, d);
  gl_FragColor = vec4(rgb * mask, mask);
}`;

/** Refraction in CSS pixels and blur radius per strength. */
/** band widens the edge band (how deep the bending reaches into the body); shade brightens the sheen. */
const LENS: Record<GlassStrength, { blur: number; edge: number; rim: number; base: number; corner: number; ripple: number; warp: number; shade: number; band: number }> = {
  subtle: { blur: 2, edge: 6, rim: 22, base: 0, corner: 8, ripple: 10, warp: 0, shade: 0.1, band: 1 },
  regular: { blur: 3.5, edge: 10, rim: 36, base: 6, corner: 14, ripple: 18, warp: 1, shade: 0.14, band: 1 },
  strong: { blur: 5.5, edge: 18, rim: 54, base: 12, corner: 22, ripple: 26, warp: 1, shade: 0.18, band: 1.4 },
  stronger: { blur: 8, edge: 28, rim: 74, base: 22, corner: 32, ripple: 34, warp: 1, shade: 0.22, band: 2 },
  strongest: { blur: 11, edge: 42, rim: 96, base: 34, corner: 44, ripple: 44, warp: 1, shade: 0.27, band: 2.9 },
};
const UNIFORMS = ["u_image", "u_res", "u_origin", "u_scale", "u_texSize", "u_radius", "u_blur", "u_edge", "u_rim", "u_base", "u_corner", "u_ripple", "u_warp", "u_light", "u_shade", "u_band"] as const;

type Shared = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffers: WebGLBuffer[];
  loc: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  textures: Map<TexImageSource, { tex: WebGLTexture; stamp: number }>;
};
let shared: Shared | null = null;
let glBroken = false;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

/** The shared WebGL renderer, made on first use; null when the browser has no WebGL. */
function getGL(): Shared | null {
  if (shared) return shared;
  if (glBroken || !isBrowser) return null;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
  const vs = gl && compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl?.createProgram();
  if (!gl || !vs || !fs || !program) {
    glBroken = true;
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    glBroken = true;
    return null;
  }
  gl.useProgram(program);
  const quad = (name: string, data: number[]) => {
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    return b;
  };
  const buffers = [quad("a_position", [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), quad("a_texcoord", [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0])];
  const loc = Object.fromEntries(UNIFORMS.map((u) => [u, gl.getUniformLocation(program, u)])) as Shared["loc"];
  gl.uniform1i(loc.u_image, 0);
  gl.clearColor(0, 0, 0, 0);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    shared = null;
    schedule();
  });
  shared = { canvas, gl, program, buffers, loc, textures: new Map() };
  return shared;
}

/** Lets the context go once no glass surface is drawn with it. */
function releaseGL() {
  if (!shared) return;
  const { gl, program, buffers, textures } = shared;
  textures.forEach(({ tex }) => gl.deleteTexture(tex));
  buffers.forEach((b) => gl.deleteBuffer(b));
  gl.deleteProgram(program);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  shared = null;
}

/** Bumped when a backdrop's pixels change, so its texture is uploaded again. */
const stamps = new WeakMap<object, number>();
/** Redraw the glass: after you repaint a canvas you passed as a backdrop, or after moving glass without resizing it. */
export function refreshGlass(source?: HTMLCanvasElement | HTMLImageElement | null) {
  if (source) stamps.set(source, (stamps.get(source) ?? 0) + 1);
  schedule();
}

type Job = {
  el: HTMLElement;
  out: HTMLCanvasElement;
  strength: GlassStrength;
  /** The backdrop's pixels, or null while it isn't ready. */
  source: () => HTMLCanvasElement | HTMLImageElement | null;
  /** The element the backdrop covers (object-fit: cover). */
  area: () => HTMLElement | null;
  visible: boolean;
  failed: boolean;
  onState: (drawn: boolean) => void;
};
const jobs = new Set<Job>();
const dirty = new Set<Job>();
const byEl = new Map<Element, Job>();
let frame = 0;
let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
const onMove = () => schedule();

function schedule(job?: Job) {
  if (job) dirty.add(job);
  else jobs.forEach((j) => dirty.add(j));
  if (!frame && isBrowser && dirty.size) frame = requestAnimationFrame(flush);
}
function flush() {
  frame = 0;
  for (const j of [...dirty]) {
    if (!j.visible) continue; // Drawn when it scrolls into view.
    dirty.delete(j);
    draw(j);
  }
}

function addJob(j: Job) {
  if (!jobs.size) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const job = byEl.get(e.target);
        if (!job) continue;
        job.visible = e.isIntersecting;
        if (job.visible && dirty.has(job)) schedule(job);
      }
    });
    ro = new ResizeObserver(onMove);
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove);
  }
  jobs.add(j);
  byEl.set(j.el, j);
  io!.observe(j.el);
  ro!.observe(j.el);
  const a = j.area();
  if (a) ro!.observe(a);
  schedule(j);
}
function removeJob(j: Job) {
  jobs.delete(j);
  dirty.delete(j);
  byEl.delete(j.el);
  io?.unobserve(j.el);
  ro?.unobserve(j.el);
  if (jobs.size) return;
  io?.disconnect();
  ro?.disconnect();
  io = ro = null;
  window.removeEventListener("scroll", onMove, { capture: true });
  window.removeEventListener("resize", onMove);
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  releaseGL();
}

function radiusPx(el: HTMLElement, w: number, h: number) {
  const v = getComputedStyle(el).borderTopLeftRadius;
  const n = parseFloat(v) || 0;
  return v.trim().endsWith("%") ? (n / 100) * Math.min(w, h) : n;
}

function draw(j: Job) {
  if (j.failed) return;
  const G = getGL();
  const src = j.source();
  const area = j.area();
  if (!G || !src || !area) return;
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const r = j.el.getBoundingClientRect();
  const a = area.getBoundingClientRect();
  if (!sw || !sh || r.width < 1 || r.height < 1 || a.width < 1 || a.height < 1) return;
  const { gl, loc, canvas } = G;
  // Upload the backdrop when it is new or was repainted.
  const stamp = stamps.get(src) ?? 0;
  let t = G.textures.get(src);
  try {
    if (!t || t.stamp !== stamp) {
      const tex = t?.tex ?? gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      t = { tex, stamp };
      G.textures.set(src, t);
    }
  } catch {
    // A cross-origin image without CORS can't be read: this surface keeps the CSS glass.
    j.failed = true;
    j.onState(false);
    return;
  }
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(r.width * dpr);
  const h = Math.round(r.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
  // The backdrop covers the area like object-fit: cover; find the surface's place in it, in backdrop pixels.
  const cssPerPx = Math.max(a.width / sw, a.height / sh);
  const offX = (a.width - sw * cssPerPx) / 2;
  const offY = (a.height - sh * cssPerPx) / 2;
  const lens = LENS[j.strength];
  const light = resolveColor(j.el, "var(--fl-glass-shine)");
  gl.uniform2f(loc.u_res, r.width, r.height);
  gl.uniform2f(loc.u_origin, (r.left - a.left - offX) / cssPerPx, (r.top - a.top - offY) / cssPerPx);
  gl.uniform1f(loc.u_scale, 1 / cssPerPx);
  gl.uniform2f(loc.u_texSize, sw, sh);
  gl.uniform1f(loc.u_radius, radiusPx(j.el, r.width, r.height));
  gl.uniform1f(loc.u_blur, lens.blur);
  gl.uniform1f(loc.u_edge, lens.edge);
  gl.uniform1f(loc.u_rim, lens.rim);
  gl.uniform1f(loc.u_base, lens.base);
  gl.uniform1f(loc.u_corner, lens.corner);
  gl.uniform1f(loc.u_ripple, lens.ripple);
  gl.uniform1f(loc.u_warp, lens.warp);
  gl.uniform3f(loc.u_light, light[0] / 255, light[1] / 255, light[2] / 255);
  gl.uniform1f(loc.u_shade, lens.shade);
  gl.uniform1f(loc.u_band, lens.band);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  // Copy into the surface's own canvas in the same task, so one context serves every surface.
  if (j.out.width !== w || j.out.height !== h) {
    j.out.width = w;
    j.out.height = h;
  }
  const ctx = j.out.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0);
  j.onState(true);
}

/* ── The stage: a backdrop area whose token gradient the glass inside it looks through ──────────────────── */

type StageValue = { area: RefObject<HTMLDivElement | null>; paint: RefObject<HTMLCanvasElement | null> };
const StageContext = createContext<StageValue | null>(null);

/**
 * A backdrop area for glass: the token gradient (color blooms, stripes and an optional bold word) painted into a
 * canvas that fills it, which every glass surface inside looks through. Decorative; put real content in children.
 */
export function GlassStage({ children, word = "", className = "", style }: { children?: ReactNode; word?: string; className?: string; style?: CSSProperties }) {
  const area = useRef<HTMLDivElement>(null);
  const paint = useRef<HTMLCanvasElement>(null);
  const value = useRef<StageValue>({ area, paint }).current;
  useEffect(() => {
    const el = area.current;
    const c = paint.current;
    if (!el || !c) return;
    const repaint = (force = false) => {
      if (paintTokenGradient(c, el, word, force)) refreshGlass(c);
    };
    repaint(true);
    const obs = new ResizeObserver(() => repaint());
    obs.observe(el);
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => repaint(true);
    scheme.addEventListener("change", onScheme);
    void document.fonts?.ready.then(() => repaint(true));
    return () => {
      obs.disconnect();
      scheme.removeEventListener("change", onScheme);
    };
  }, [word]);
  return (
    <div ref={area} className={`fl-glass-stage${className ? ` ${className}` : ""}`} data-glass-area="" style={style}>
      <canvas ref={paint} className="fl-glass-stage-paint" aria-hidden="true" />
      <StageContext.Provider value={value}>{children}</StageContext.Provider>
    </div>
  );
}

/* ── One glass surface: classes, tokens, pointer highlight and the WebGL lens ───────────────────────────── */

type SurfaceOptions = {
  strength?: GlassStrength;
  tone?: GlassTone;
  radius?: number | string;
  className?: string;
  /** A soft highlight that follows the pointer (off with reduced motion). */
  highlight?: boolean;
  /** What the WebGL lens looks through; defaults to the surrounding GlassStage. */
  backdrop?: GlassBackdropSource;
  style?: CSSProperties;
};

const images = new Map<string, HTMLImageElement>();

function useSurface<T extends HTMLElement>(kind: string, o: SurfaceOptions) {
  const ref = useRef<T>(null);
  const out = useRef<HTMLCanvasElement>(null);
  const stage = useContext(StageContext);
  const { fallback, lens } = useGlassMode();
  const [drawn, setDrawn] = useState(false);
  const strength = o.strength ?? "regular";
  const backdrop = o.backdrop;
  const wantsGL = fallback !== "solid" && (backdrop !== undefined || stage !== null);

  // The WebGL lens, when there is a backdrop to look through.
  useEffect(() => {
    const el = ref.current;
    const c = out.current;
    if (!wantsGL || !el || !c || !getGL()) return;
    const area = () => (backdrop === undefined ? stage?.area.current : null) ?? el.closest<HTMLElement>("[data-glass-area]") ?? el.parentElement;
    let source: Job["source"];
    let dispose = () => {};
    if (backdrop === undefined) source = () => stage?.paint.current ?? null;
    else if (typeof backdrop === "object") source = () => backdrop.current;
    else if (backdrop === "gradient") {
      const own = document.createElement("canvas");
      source = () => {
        const a = area();
        if (a && paintTokenGradient(own, a)) refreshGlass(own);
        return own;
      };
    } else {
      let img = images.get(backdrop);
      if (!img) {
        img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.src = backdrop;
        images.set(backdrop, img);
      }
      const ready = img;
      const onLoad = () => schedule(job);
      ready.addEventListener("load", onLoad);
      dispose = () => ready.removeEventListener("load", onLoad);
      source = () => (ready.complete && ready.naturalWidth ? ready : null);
    }
    const job: Job = { el, out: c, strength, source, area, visible: false, failed: false, onState: setDrawn };
    addJob(job);
    return () => {
      // drawn stays as it is, so a change of strength doesn't flash the fallback for a frame.
      dispose();
      removeJob(job);
    };
  }, [wantsGL, backdrop, stage, strength]);

  // The pointer highlight: custom properties set at most once a frame.
  useEffect(() => {
    const el = ref.current;
    if (!el || o.highlight === false) return;
    let raf = 0;
    let at: { x: number; y: number } | null = null;
    const paint = () => {
      raf = 0;
      if (!at) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--fl-glass-x", `${at.x - r.left}px`);
      el.style.setProperty("--fl-glass-y", `${at.y - r.top}px`);
      el.style.setProperty("--fl-glass-lit", "1");
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" || reducedMotion()) return;
      at = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const leave = () => {
      at = null;
      el.style.setProperty("--fl-glass-lit", "0");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [o.highlight]);

  const style: CSSProperties & Record<string, string | number | undefined> = { ...o.style };
  if (lens) style["--fl-glass-lens"] = `url(#${lens}-${strength})`;
  if (o.radius !== undefined) style["--fl-glass-radius"] = typeof o.radius === "number" ? `${o.radius}px` : o.radius;
  return {
    ref,
    props: {
      className: `fl-glass-surface ${kind}${o.className ? ` ${o.className}` : ""}`,
      "data-glass": drawn && wantsGL ? "webgl" : fallback,
      "data-strength": strength,
      "data-tone": o.tone,
      style,
    },
    lensCanvas: wantsGL ? <canvas ref={out} className="fl-glass-gl" aria-hidden="true" /> : null,
  };
}

/* ── Panel ──────────────────────────────────────────────────────────────────────────────────────────────── */

type PanelTag = "div" | "section" | "article" | "aside" | "figure" | "header" | "footer";

/** A glass panel for a small piece of content over a picture or gradient (now playing, weather, a caption). Not a dialog. */
export function GlassPanel({
  as = "div",
  strength,
  tone,
  radius,
  className,
  highlight,
  backdrop,
  style,
  children,
  ...rest
}: SurfaceOptions & { as?: PanelTag; children?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "className" | "style" | "children">) {
  const s = useSurface<HTMLElement>("fl-glass-panel", { strength, tone, radius, className, highlight, backdrop, style });
  const Tag = as;
  return (
    <Tag {...rest} {...s.props} ref={s.ref as RefObject<HTMLDivElement>} data-fl="c.liquid-glass.panel">
      {s.lensCanvas}
      {children}
    </Tag>
  );
}

/* ── Button ─────────────────────────────────────────────────────────────────────────────────────────────── */

/** A real button made of glass: a pill with icon and label, or round with the icon only (the label is its name). */
export function GlassButton({
  label,
  icon,
  variant = "pill",
  pressed,
  onClick,
  disabled,
  type = "button",
  strength,
  tone,
  radius,
  className,
  highlight,
  backdrop,
}: SurfaceOptions & {
  label: string;
  /** An icon name from ./icons, or your own icon element. */
  icon?: string | ReactNode;
  variant?: "pill" | "round";
  /** Makes it a toggle (aria-pressed); the icon is drawn filled while pressed. */
  pressed?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  const s = useSurface<HTMLButtonElement>(`fl-glass-button fl-glass-button--${variant}`, { strength, tone, radius, className, highlight, backdrop });
  return (
    <button
      {...s.props}
      ref={s.ref}
      type={type}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={variant === "round" ? label : undefined}
      title={variant === "round" ? label : undefined}
      onClick={onClick}
      data-fl="c.liquid-glass.button"
    >
      {s.lensCanvas}
      {icon ? (
        <span className="fl-glass-icon" aria-hidden="true">
          {typeof icon === "string" ? <Icon name={icon} filled={pressed === true && (icon === "heart" || icon === "star")} /> : icon}
        </span>
      ) : null}
      {variant === "pill" ? <span className="fl-glass-label">{label}</span> : null}
    </button>
  );
}

/* ── Floating bar ───────────────────────────────────────────────────────────────────────────────────────── */

export type GlassBarItem = { id: string; label: string; /** An icon name from ./icons. */ icon: string };

/**
 * A floating navigation bar of glass. Tab reaches the current place; ← → (and Home/End) move between places; Enter or
 * Space goes there. An indicator slides to the current place (it jumps with reduced motion).
 */
export function GlassBar({
  items,
  current,
  onSelect,
  label = "Main",
  strength,
  tone,
  className,
  highlight,
  backdrop,
}: SurfaceOptions & { items: GlassBarItem[]; current: string; onSelect: (id: string) => void; label?: string }) {
  const s = useSurface<HTMLElement>("fl-glass-bar", { strength, tone, className, highlight, backdrop });
  const list = useRef<HTMLUListElement>(null);
  const [focusId, setFocusId] = useState(current);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => setFocusId(current), [current]);

  // Place the indicator under the current place, and keep it there as the bar resizes.
  useLayoutEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const place = () => {
      const b = ul.querySelector<HTMLElement>('[aria-current="page"]');
      setInd(b ? { x: b.offsetLeft, w: b.offsetWidth } : null);
    };
    place();
    const obs = new ResizeObserver(place);
    obs.observe(ul);
    return () => obs.disconnect();
  }, [current, items]);
  // Slide only after the first placement, so it doesn't fly in from the left on load.
  useEffect(() => {
    if (!ind || ready) return;
    const f = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(f);
  }, [ind, ready]);

  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const btns = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const to = e.key === "ArrowRight" ? (i + 1) % btns.length : e.key === "ArrowLeft" ? (i - 1 + btns.length) % btns.length : e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    btns[to]!.focus();
  };

  return (
    <nav {...s.props} ref={s.ref} aria-label={label} data-fl="c.liquid-glass.bar">
      {s.lensCanvas}
      <ul className="fl-glass-bar-list" ref={list} onKeyDown={onKey}>
        <li className="fl-glass-bar-ind" aria-hidden="true" data-ready={ready && ind ? "" : undefined} style={ind ? ({ "--fl-glass-ind-x": `${ind.x}px`, "--fl-glass-ind-w": `${ind.w}px` } as CSSProperties) : undefined} />
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              className="fl-glass-bar-item"
              aria-current={it.id === current ? "page" : undefined}
              tabIndex={it.id === focusId ? 0 : -1}
              onFocus={() => setFocusId(it.id)}
              onClick={() => onSelect(it.id)}
            >
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// flowcode:sample
const SAMPLE = {
  buttons: {
    word: "PLAY",
    actions: [
      { id: "add", label: "Add to library", icon: "plus" },
      { id: "share", label: "Share", icon: "share" },
    ],
  },
  bar: {
    word: "TIDE",
    label: "Main",
    items: [
      { id: "listen", label: "Listen now", icon: "play" },
      { id: "browse", label: "Browse", icon: "globe" },
      { id: "radio", label: "Radio", icon: "bell" },
      { id: "library", label: "Library", icon: "folder" },
      { id: "search", label: "Search", icon: "search" },
    ] as GlassBarItem[],
    pages: {
      listen: "Listen now: three new mixes made for your Sunday",
      browse: "Browse: new releases from Nordic jazz and ambient",
      radio: "Radio: Harbor FM is live with the morning set",
      library: "Library: 412 songs, 38 albums, 9 playlists",
      search: "Search: artists, songs, lyrics and stations",
    } as Record<string, string>,
  },
  player: {
    word: "NOW",
    tracks: [
      { title: "Northern Lights Over Tromsø", artist: "Ola Haugen Quartet", album: "Polar Hours", duration: 274 },
      { title: "Saltwater Hymn", artist: "Maren Solvik", album: "Lowtide", duration: 221 },
      { title: "Night Ferry to Bergen", artist: "The Fjord Sessions", album: "Crossings", duration: 309 },
    ],
  },
};

function Note({ children }: { children: ReactNode }) {
  return <p className="fl-ctl-btn-what">{children}</p>;
}

const PATHS: Record<GlassMode, string> = {
  webgl: "WebGL lens, looking through the stage's gradient",
  refract: "SVG lens through backdrop-filter",
  frost: "frosted backdrop blur",
  solid: "solid surface",
};

function ButtonsDemo() {
  const d = SAMPLE.buttons;
  const [said, setSaid] = useState("");
  const [liked, setLiked] = useState(false);
  const [shuffle, setShuffle] = useState(true);
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <GlassStage word={d.word}>
        <div className="fl-glass-row">
          {d.actions.map((a) => (
            <GlassButton key={a.id} label={a.label} icon={a.icon} onClick={() => setSaid(`${a.label}: done`)} />
          ))}
          <GlassButton label="Shuffle" icon="refresh" pressed={shuffle} onClick={() => setShuffle((v) => !v)} />
        </div>
        <div className="fl-glass-row">
          <GlassButton variant="round" label={playing ? "Pause" : "Play"} icon={playing ? "pause" : "play"} strength="strong" onClick={() => setPlaying((v) => !v)} />
          <GlassButton variant="round" label="Favorite" icon="heart" pressed={liked} onClick={() => setLiked((v) => !v)} />
          <GlassButton variant="round" label="More" icon="more" strength="subtle" onClick={() => setSaid("More: the menu would open here")} />
        </div>
      </GlassStage>
      <p className="fl-glass-status" aria-live="polite">
        {said || `Shuffle ${shuffle ? "on" : "off"} · ${liked ? "In favorites" : "Not in favorites"} · ${playing ? "Playing" : "Paused"}`}
      </p>
    </>
  );
}

function BarDemo() {
  const d = SAMPLE.bar;
  const [at, setAt] = useState("listen");
  return (
    <>
      <GlassStage word={d.word} className="fl-glass-stage--bar">
        <GlassBar items={d.items} current={at} onSelect={setAt} label={d.label} />
      </GlassStage>
      <p className="fl-glass-status" aria-live="polite">
        {d.pages[at]}
      </p>
    </>
  );
}

function PlayerDemo() {
  const d = SAMPLE.player;
  const [strength, setStrength] = useState<GlassStrength>("regular");
  const [tone, setTone] = useState<GlassTone | undefined>(undefined);
  const [path, setPath] = useState<GlassMode | "">("");
  const panel = useRef<HTMLDivElement>(null);
  // Say which drawing path this browser took, as the panel reports it (it changes once the WebGL lens has drawn).
  useEffect(() => {
    const el = panel.current?.querySelector(".fl-glass-panel");
    if (!el) return;
    const read = () => setPath((el.getAttribute("data-glass") as GlassMode | null) ?? "");
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-glass"] });
    return () => obs.disconnect();
  }, []);
  return (
    <>
      <div ref={panel}>
        <GlassStage word={d.word} className="fl-glass-stage--panel">
          <div className="fl-glass-row" role="group" aria-label="Glass strength">
            {STRENGTHS.map((s) => (
              <GlassButton key={s} label={s[0]!.toUpperCase() + s.slice(1)} strength="subtle" pressed={strength === s} onClick={() => setStrength(s)} />
            ))}
          </div>
          <AudioPlayer track={d.tracks[0]!} queue={d.tracks} strength={strength} tone={tone} start={96} />
          <div className="fl-glass-row" role="group" aria-label="Glass tone">
            {([undefined, "light", "dark"] as const).map((t) => (
              <GlassButton key={t ?? "auto"} label={t ? `${t[0]!.toUpperCase()}${t.slice(1)}` : "Auto"} strength="subtle" pressed={tone === t} onClick={() => setTone(t)} />
            ))}
          </div>
        </GlassStage>
      </div>
      <p className="fl-glass-status">{path ? `This browser draws the glass with: ${PATHS[path]}.` : "\u00a0"}</p>
    </>
  );
}

export default function LiquidGlassSheet() {
  return (
    <section className="fl-section fl-section--specimen">
      <GlassFilter />
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Buttons: pill, round and toggle</h3>
        <Note>Real buttons of glass over a token gradient. Shuffle and the heart are toggles (they say pressed); the highlight follows your pointer and the press springs back, both off with reduced motion.</Note>
        <ButtonsDemo />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Floating bar</h3>
        <Note>Tab reaches the current place, ← → move between places, Enter goes there. The indicator slides to it (it jumps with reduced motion).</Note>
        <BarDemo />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Panel: now playing (AudioPlayer)</h3>
        <Note>A glass panel holding the AudioPlayer from media-player: Space plays, ← → seek, M mutes. Try the five strengths and the tones: the tint keeps the text readable at each. Glass is for controls and panels like this, never for dialogs.</Note>
        <PlayerDemo />
      </div>
    </section>
  );
}
