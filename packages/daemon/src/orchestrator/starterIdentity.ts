/**
 * Makes a freshly scaffolded starter belong to the product being built instead of the starter's own sample identity.
 * From the attached PRD (and the request) it takes:
 * - the product name and a one-line description, for the page title, the heading and the meta description;
 * - the colour tokens, when the PRD lists any, mapped onto the starter's semantic roles (canvas → background, card →
 *   surface, primary text, primary actions → accent…) and also kept under their own names as brand tokens;
 * - a design brief (.flowcode/design-brief.json) with the PRD's subject, audience, job and vocabulary, which design QA
 *   reads. The starter's sample brief described a schedule app and would judge any other product against it.
 * Pure functions: the scaffold step calls personalizeStarterFile() on each file before writing it.
 */
import { BUILD_EXTRAS, styleVibe, TEMPLATE_VIBES, vibeFromText, vibeTokens, type DesignTemplate, type ReferenceFile, type StyleVibe } from "@flowcode/contracts";
import { contrastRatio } from "../quality/tokens.js";

export interface PrdColor {
  name: string;
  hex: string;
  use: string;
}

export interface StarterIdentity {
  name: string;
  description: string;
  colors: PrdColor[];
  /** Semantic token → value, from the PRD colours. */
  roles: Record<string, string>;
  /** The PRD asks for a dark theme; otherwise the starter's dark palette (built for its own colours) is dropped. */
  wantsDark: boolean;
  brief: { subject: string; audience: string; primaryJob: string; vernacular: string[]; requiredStates: string[]; maxRadiusPx: number };
  /** The visual style chosen in New build, used when the PRD sets no colours. */
  template?: DesignTemplate;
  /** The surface style (vibe): how cards, panels and controls are drawn. */
  vibe?: StyleVibe;
}

/**
 * The surface style for a build: the one chosen in New build, else one the PRD names (glassmorphism, neo-brutalism…),
 * else the chosen template's suggestion. None means the starter's flat surfaces.
 */
export function withVibe(id: StarterIdentity, look: BuildLook | undefined, prdText: string): StarterIdentity {
  const vibe = styleVibe(look?.vibe) ?? vibeFromText(prdText) ?? styleVibe(TEMPLATE_VIBES[look?.template ?? ""]);
  return vibe ? { ...id, vibe } : id;
}

/** Writes a vibe's surface tokens into tokens.css (the first, default definition of each). */
export function applyVibe(css: string, vibe: StyleVibe): string {
  let out = css;
  for (const [name, value] of Object.entries(vibeTokens(vibe.id))) {
    const re = new RegExp(`(\\n\\s*${name}\\s*:\\s*)[^;]+;`);
    out = re.test(out) ? out.replace(re, `$1${value};`) : out;
  }
  return out.replace(/\/\* Surface style: [^(]*\(/, `/* Surface style: ${vibe.name} (`);
}

/** Uses a chosen visual style for an app whose PRD sets no colours: its colours, fonts and corner radii. */
export function withTemplate(id: StarterIdentity, template: DesignTemplate | undefined): StarterIdentity {
  if (!template || id.colors.length) return id;
  const c = template.colors;
  const roles: Record<string, string> = {
    "--color-bg": c.bg,
    "--color-surface": c.surface,
    "--color-surface-sunken": c.surfaceSunken,
    "--color-text": c.text,
    "--color-text-muted": c.textMuted,
    "--color-border": c.border,
    "--color-border-strong": c.borderStrong,
    "--color-accent": c.accent,
    "--color-accent-hover": c.accentHover,
    "--color-on-accent": c.onAccent,
    "--color-focus": c.focus,
    "--color-success": c.success,
    "--color-danger": c.danger,
    "--color-danger-surface": c.dangerSurface,
  };
  return { ...id, roles, template, wantsDark: false, brief: { ...id.brief, maxRadiusPx: template.radii[3] } };
}

const clean = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();

/** Colour rows from the PRD: table rows or list items with a hex value, a name and (optionally) what it's for. */
export function prdColors(prd: string): PrdColor[] {
  const out: PrdColor[] = [];
  const seen = new Set<string>();
  for (const line of prd.split(/\r?\n/)) {
    const hex = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(line)?.[0];
    if (!hex) continue;
    let name = "";
    let use = "";
    if (line.trim().startsWith("|")) {
      const cells = line.split("|").map((c) => clean(c)).filter(Boolean);
      const at = cells.findIndex((c) => c.toLowerCase().includes(hex.toLowerCase()));
      name = cells.find((c, i) => i !== at && /^[a-z][\w-]*$/i.test(c)) ?? cells[0] ?? "";
      use = cells.filter((c, i) => i !== at && c !== name).join(" ");
    } else {
      const m = /([a-z][\w-]*)\W{0,4}[:=–—-]?\s*`?#/i.exec(line);
      name = m?.[1] ?? "";
      use = clean(line.replace(hex, ""));
    }
    name = name.replace(/^--/, "").toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, hex: hex.toLowerCase(), use: use.toLowerCase() });
  }
  return out.slice(0, 24);
}

// Semantic role ← words in a colour's name or stated use, most specific first.
const ROLE_RULES: Array<[string, RegExp]> = [
  ["--color-bg", /\b(canvas|page|app)\s*background|\bbackground\b|\bcanvas\b/],
  ["--color-surface", /\b(card|surface|panel|sheet)\b/],
  ["--color-text", /\bprimary text\b|\bbody text\b|\btext\b|\bink\b/],
  ["--color-accent", /\bprimary (action|button|cta)s?\b|\bprimary\b|\baccent\b|\bbrand\b|\bbuttons?\b/],
  ["--color-focus", /\bfocus\b/],
  ["--color-success", /\b(success|saving|saved|complete|correct|progress state)\b/],
  ["--color-danger", /\b(error|danger|destructive|wrong)\b/],
];

export function mapRoles(colors: PrdColor[]): Record<string, string> {
  const roles: Record<string, string> = {};
  for (const [role, re] of ROLE_RULES) {
    const hit = colors.find((c) => re.test(`${c.use} ${c.name.replace(/-/g, " ")}`) && !Object.values(roles).includes(c.hex));
    if (hit) roles[role] = hit.hex;
  }
  // A "focus-compatible" primary colour doubles as the focus colour when none is given.
  if (!roles["--color-focus"] && roles["--color-accent"] && colors.some((c) => c.hex === roles["--color-accent"] && /focus/.test(c.use))) roles["--color-focus"] = roles["--color-accent"];
  // Contrast-safe roles (after CSSVibes' accessible-shade picker): a PRD colour too light to read on the surface is
  // darkened, keeping its hue, until it passes WCAG AA. The exact PRD colours stay available as --brand-* tokens.
  const surface = roles["--color-surface"] ?? (roles["--color-bg"] ? "#ffffff" : undefined) ?? "#fffdf8";
  // Text-like roles need 4.5:1; the accent marks buttons, focus and the current item, so 3:1 (WCAG non-text), with
  // its button text checked separately below.
  for (const role of ["--color-danger", "--color-success", "--color-text"]) if (roles[role]) roles[role] = readableOn(roles[role], surface, 4.5);
  if (roles["--color-accent"]) roles["--color-accent"] = readableOn(roles["--color-accent"], surface, 3);
  const accent = roles["--color-accent"];
  if (accent) {
    roles["--color-accent-hover"] = shade(accent, -0.14);
    const text = roles["--color-text"] ?? "#1f2a37";
    const onAccent = (contrastRatio("#ffffff", accent) ?? 0) >= (contrastRatio(text, accent) ?? 0) ? "#ffffff" : text;
    // Button text must reach 4.5:1 on the accent; fall back to black or white, whichever reads better.
    roles["--color-on-accent"] = (contrastRatio(onAccent, accent) ?? 0) >= 4.5 ? onAccent : (contrastRatio("#000000", accent) ?? 0) > (contrastRatio("#ffffff", accent) ?? 0) ? "#111111" : "#ffffff";
  }
  if (roles["--color-bg"] && !roles["--color-surface"]) roles["--color-surface"] = "#ffffff";
  // Neutrals from the PRD's own text and background, so none of the starter's colours sit beside the PRD palette.
  if (roles["--color-surface"]) roles["--color-surface-sunken"] = shade(roles["--color-surface"], -0.05);
  if (roles["--color-text"]) {
    const bg = roles["--color-bg"] ?? "#ffffff";
    // Muted text stays readable: pull it back toward the text colour until it passes AA on the background.
    let t = 0.3;
    while (t > 0 && (contrastRatio(mix(roles["--color-text"], bg, t), bg) ?? 0) < 4.5) t -= 0.05;
    roles["--color-text-muted"] = mix(roles["--color-text"], bg, Math.max(0, t));
    roles["--color-border"] = mix(roles["--color-text"], bg, 0.84);
    roles["--color-border-strong"] = mix(roles["--color-text"], bg, 0.4);
  }
  return roles;
}

const rgb = (hex: string) => {
  const n = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};

/** a mixed toward b by t (0 = a, 1 = b). */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** The colour, darkened in small steps (same hue) until it reaches `min` contrast on `bg`; lightened on a dark bg. */
export function readableOn(hex: string, bg: string, min: number): string {
  const dark = (contrastRatio("#000000", bg) ?? 0) < (contrastRatio("#ffffff", bg) ?? 0);
  let out = hex;
  for (let i = 0; i < 20 && (contrastRatio(out, bg) ?? 0) < min; i++) out = shade(out, dark ? 0.08 : -0.08);
  return out;
}

function shade(hex: string, amount: number): string {
  const n = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
  const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  return `#${ch.map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}

/** The product's name: the PRD's first heading (without "PRD:" style prefixes), else the project name. */
function productName(prd: string, projectName: string): string {
  const bold = /\*\*([A-Z][\w' -]{2,40})\*\*\s+is\b/.exec(prd)?.[1];
  if (bold) return clean(bold);
  const h1 = /^#\s+(.+)$/m.exec(prd)?.[1];
  const fromH1 = h1 ? clean(h1.replace(/^(prd|product requirements( document)?)\s*[:—–-]\s*/i, "").split(/\s+[—–|:-]\s+/)[0]) : "";
  return fromH1 && fromH1.length <= 48 ? fromH1 : projectName;
}

/** First full sentence of the first prose paragraph (tables, lists, headings and lead-ins ending in ":" skipped). */
function firstSentence(text: string): string {
  for (const para of text.split(/\r?\n\s*\r?\n/)) {
    const p = clean(para.split(/\r?\n/).filter((l) => !/^\s*(\||#|-\s|\*\s|>|\d+\.\s)/.test(l)).join(" "));
    if (p.length < 40) continue;
    const s = sentence(p);
    if (s.endsWith(":")) continue;
    return s.slice(0, 220);
  }
  return "";
}

// A sentence ends at . ! ? or : before a capital letter or the end, but not after "vs.", "e.g." and the like.
function sentence(p: string): string {
  const re = /[.!?:](?=\s+[A-Z"(]|\s*$)/g;
  for (let m = re.exec(p); m; m = re.exec(p)) {
    const before = p.slice(0, m.index + 1);
    if (/\b(vs|e\.g|i\.e|etc|approx|incl|Mr|Ms|Dr|St|No)\.$/i.test(before)) continue;
    return before;
  }
  return p;
}

/** The text under the first heading that matches, trying the patterns in order. */
function section(prd: string, ...res: RegExp[]): string {
  const lines = prd.split(/\r?\n/);
  let at = -1;
  for (const re of res) if ((at = lines.findIndex((l) => /^#{1,4}\s/.test(l) && re.test(l))) >= 0) break;
  if (at < 0) return "";
  const out: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (/^#{1,4}\s/.test(l)) break;
    out.push(l);
  }
  return out.join("\n");
}

export function starterIdentity(refs: ReferenceFile[], projectName: string, objective: string): StarterIdentity {
  const prd = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n\n");
  const name = prd ? productName(prd, projectName) : projectName;
  const description = firstSentence(prd) || clean(objective).slice(0, 160);
  const colors = prd ? prdColors(prd) : [];
  const roles = mapRoles(colors);
  const audienceText = section(prd, /\b(target )?(audience|users?)\b/i, /\bpersonas?\b/i, /\bwho\b/i);
  // A user table (User | Age | Need…) reads better as its first column: "Curious Starter, Growing Planner…".
  const personas = [...audienceText.matchAll(/^\|\s*([^|]+?)\s*\|/gm)].map((m) => clean(m[1])).filter((c) => c && !/^(:?-+:?|users?|personas?|name|role)$/i.test(c));
  const audience = firstSentence(audienceText) || personas.slice(0, 5).join(", ") || description;
  const goalText = section(prd, /\bgoals?\b/i, /\b(purpose|objective|job)\b/i, /\b(problem|why)\b/i);
  // The product's own words: bold terms in the PRD (Glow Coins, Goal Jar…), most frequent first. Not tech or
  // process words, and not button labels (they start with a verb).
  const TECH = /\b(mvp|api|json|pwa|wcag|url|http|indexeddb|localstorage|cache|storage|service worker|sql|sdk|ui|ux|p\d|total)\b/i;
  const VERB = /^(start|read|download|restore|open|save|add|delete|edit|show|view|go|try|play|back|next|continue)\b/i;
  // Recurring capitalised names in the prose (Glow Coins, Goal Jar, Mission Player…), headings and tables aside.
  const DOC = /\b(research|prototype|workflow|requirements?|version|duration|metrics?|risks?|appendix|section|table|phase|milestone|owner|status|priority)\b/i;
  const counts = new Map<string, number>();
  const prose = prd
    .split(/\r?\n/)
    .filter((l) => !/^\s*(#|\|)/.test(l))
    .join("\n");
  for (const m of prose.matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]+(?: [A-Z][a-z]+){1,2})\b/gm)) {
    const t = clean(m[1]);
    if (!TECH.test(t) && !VERB.test(t) && !DOC.test(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  for (const [t, n] of counts) if (n < 3) counts.delete(t);
  const vernacular: string[] = [];
  for (const [t] of [...counts.entries()].sort((x, y) => y[1] - x[1])) {
    const w = t.toLowerCase();
    // One entry per name: "glow coin" and "glow coins" are the same thing.
    if (w === name.toLowerCase() || vernacular.some((v) => v.replace(/s$/, "") === w.replace(/s$/, ""))) continue;
    vernacular.push(w);
  }
  vernacular.splice(8);
  return {
    name,
    description,
    colors,
    roles,
    wantsDark: /\bdark (mode|theme)\b/i.test(prd),
    brief: {
      subject: name,
      audience,
      primaryJob: firstSentence(goalText) || description,
      vernacular,
      requiredStates: ["empty", "loading", "error"],
      maxRadiusPx: 10,
    },
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Rewrites one starter file for this product; files it doesn't know are returned unchanged. */
export function personalizeStarterFile(rel: string, content: string, id: StarterIdentity): string {
  const out = personalizeFile(rel, content, id);
  return /(^|\/)tokens\.css$/.test(rel) && id.vibe ? applyVibe(out, id.vibe) : out;
}

function personalizeFile(rel: string, content: string, id: StarterIdentity): string {
  if (rel === ".flowcode/design-brief.json") return `${JSON.stringify(id.brief, null, 2)}\n`;
  if (rel === "index.html" || rel === "src/index.html") {
    return content
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(id.name)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(id.description)}$2`);
  }
  if (rel === "src/App.tsx") return content.replace(/(<h1 className="shell__title">)[^<]*(<\/h1>)/, `$1${id.name.replace(/[{}<>]/g, "")}$2`);
  if (rel === "src/app/app.ts") return content.replace(/(title\s*=\s*signal\(\s*['"])[^'"]*(['"])/, `$1${id.name.replace(/['"\\]/g, "")}$2`);
  if (/(^|\/)tokens\.css$/.test(rel) && id.template) {
    // A chosen visual style: every colour role, the fonts and the radii, as the one root theme.
    const t = id.template;
    const rootEnd = content.indexOf("}", content.indexOf(":root"));
    let root = content.slice(0, rootEnd);
    const set = (name: string, value: string) => (root = root.replace(new RegExp(`(${name}\\s*:\\s*)[^;]+;`), `$1${value};`));
    for (const [role, value] of Object.entries(id.roles)) set(role, value);
    set("--font-sans", t.fonts.sans);
    set("--font-display", t.fonts.display);
    ["--radius-sm", "--radius-md", "--radius-lg", "--radius-xl"].forEach((r, i) => set(r, `${t.radii[i]}px`));
    root = root.replace(/\/\* Shape — radius never exceeds 10px \*\//, "/* Shape */");
    root = `${root.replace(/\s*$/, "")}\n\n  /* Visual style: ${t.name}${t.dark ? " (dark)" : ""} */\n  color-scheme: ${t.dark ? "dark" : "light"};\n`;
    let css = root + content.slice(rootEnd);
    css = css.replace(/\n*@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n?/, "\n");
    return css;
  }
  if (/(^|\/)tokens\.css$/.test(rel) && id.colors.length) {
    let css = content;
    // Light (root) values: replace the first definition of each mapped role.
    const rootEnd = css.indexOf("}", css.indexOf(":root"));
    let root = css.slice(0, rootEnd);
    for (const [role, value] of Object.entries(id.roles)) root = root.replace(new RegExp(`(${role}\\s*:\\s*)[^;]+;`), `$1${value};`);
    const brand = id.colors.map((c) => `  --brand-${c.name}: ${c.hex};${c.use ? ` /* ${c.use.replace(/\*\//g, "").slice(0, 70)} */` : ""}`).join("\n");
    root = `${root.replace(/\s*$/, "")}\n\n  /* Brand colours from the PRD (also mapped onto the roles above) */\n${brand}\n`;
    css = root + css.slice(rootEnd);
    // The starter's dark palette was made for the starter's colours; without a dark theme in the PRD it would show the
    // starter's colours to anyone whose system is in dark mode, so it goes.
    if (!id.wantsDark) css = css.replace(/\n*@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n?/, "\n");
    return css;
  }
  return content;
}

/**
 * The PRD's visual direction (brand personality, type, layout, colour use), for the planner: so feature tasks follow it
 * and use the colours already applied to the theme. Empty when the PRD has no such section.
 */
export function visualDirection(refs: ReferenceFile[]): string {
  const prd = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n\n");
  const lines = prd.split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{1,3}\s/.test(l) && /\b(visual|design (direction|system|language)|brand|look and feel|art direction|style guide)\b/i.test(l));
  if (at < 0) return "";
  const level = /^(#+)/.exec(lines[at])![1].length;
  const out: string[] = [];
  for (const l of lines.slice(at + 1)) {
    const h = /^(#+)\s/.exec(l);
    if (h && h[1].length <= level) break;
    out.push(l);
  }
  const body = out.join("\n").trim().slice(0, 1800);
  return body
    ? `Visual direction from the PRD (follow it in every UI task; its colour tokens are already in src/styles/tokens.css as the theme roles and as --brand-* tokens, so use those rather than new raw colours):\n${body}`
    : "";
}

/** What the user chose in New build → Look and feel. */
export interface BuildLook {
  template?: string;
  /** Surface style id (see STYLE_VIBES). */
  vibe?: string;
  extras: string[];
  /** A website whose look is captured (workspace/styleCapture.ts). */
  styleUrl?: string;
}

/** For the planner: the chosen style (already applied) and the extras to build. */
export function lookGuidance(look: BuildLook | undefined, template: DesignTemplate | undefined): string {
  if (!look) return "";
  const parts: string[] = [];
  if (template) parts.push(`Visual style chosen by the user: ${template.name} (${template.description}) Its colours, fonts and corner radii are already in src/styles/tokens.css; use those tokens in every UI task rather than new raw values.`);
  const vibe = styleVibe(look.vibe) ?? styleVibe(TEMPLATE_VIBES[look.template ?? ""]);
  if (vibe && vibe.id !== "flat") parts.push(`Surface style: ${vibe.name} (${vibe.description}) It is already set by the surface tokens in src/styles/tokens.css (--surface-*, --control-*). Draw every card, panel and control with the building blocks or those tokens; never add borders, shadows or blur of your own.`);
  const extras = BUILD_EXTRAS.filter((x) => look.extras.includes(x.id));
  if (extras.length) parts.push(`The user asked for these extras. Plan them into the tasks that build the related screens (or one task if they are app-wide), and respect prefers-reduced-motion for anything animated:\n${extras.map((x) => `- ${x.label}: ${x.guidance}`).join("\n")}`);
  return parts.join("\n\n");
}
