/**
 * Whether a design spec (workspace/designSpec.ts) is implemented in the rendered app, read from computed styles of the
 * app's own elements: the page, the first heading, a surface (a card) and the root tokens. It is implementation
 * evidence, not a taste score: a spec can be fully implemented and still need the person's approval. Text content is
 * never read, so changing words can't make a requirement "implemented".
 */
import type { Page } from "playwright";
import { type DesignSpec, type SpecRequirement, expectedTokens, specRequirements } from "../workspace/designSpec.js";

export interface MeasuredDesign {
  /** Each token as the page resolves it now, and the value the spec expects resolved the same way (var() substituted). */
  tokens: Record<string, string>;
  expected: Record<string, string>;
  body: { fontFamily: string; fontSize: number; color: string; background: string };
  heading?: { tag: string; fontFamily: string; fontSize: number; fontWeight: number; textTransform: string };
  surface?: { className: string; radius: number; padding: number; boxShadow: string; borderWidth: number; background: string };
}

/** Reads the design as rendered on the page now (the caller sets viewport, data, storage, fonts and animation). */
export async function measureDesign(page: Page, want: Record<string, string>): Promise<MeasuredDesign> {
  return page.evaluate((want: Record<string, string>) => {
    const root = getComputedStyle(document.documentElement);
    const tokens: Record<string, string> = {};
    const expected: Record<string, string> = {};
    // A probe under <html> resolves each expected value in the page's own context, so "var(--color-text)" compares as the colour it is.
    const probe = document.createElement("span");
    probe.style.display = "none";
    document.documentElement.appendChild(probe);
    for (const [n, v] of Object.entries(want)) {
      tokens[n] = root.getPropertyValue(n).trim();
      probe.style.setProperty("--fc-probe", v);
      expected[n] = getComputedStyle(probe).getPropertyValue("--fc-probe").trim();
    }
    probe.remove();
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const px = (v: string) => parseFloat(v) || 0;
    const bodyStyle = getComputedStyle(document.body);
    // The page colour: the first ancestor-or-self of <main> with a non-transparent background, else the body's.
    let bg = bodyStyle.backgroundColor;
    for (let el: Element | null = document.querySelector("main"); el; el = el.parentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
        bg = c;
        break;
      }
    }
    const textEl = Array.from(document.querySelectorAll("main p, main li, main span")).find((e) => visible(e) && (e.textContent ?? "").trim().length > 3) ?? document.body;
    const t = getComputedStyle(textEl);
    const h = Array.from(document.querySelectorAll("h1, .fl-title, h2")).find(visible);
    const hs = h ? getComputedStyle(h) : undefined;
    const card = Array.from(document.querySelectorAll("main [class*='card']")).find((e) => visible(e) && e.getBoundingClientRect().width > 120);
    const cs = card ? getComputedStyle(card) : undefined;
    // A card's spacing is often on an inner body (an image above it fills the edge): the first padded element spanning most of it.
    const padded = card ? [card, ...Array.from(card.querySelectorAll("*"))].find((e) => px(getComputedStyle(e).paddingLeft) > 0 && e.getBoundingClientRect().width >= card.getBoundingClientRect().width * 0.6) : undefined;
    return {
      tokens,
      expected,
      // The text colour is the content's own (main's), not a sampled paragraph that may be muted.
      body: { fontFamily: t.fontFamily, fontSize: px(t.fontSize), color: getComputedStyle(document.querySelector("main") ?? document.body).color, background: bg },
      ...(h && hs ? { heading: { tag: h.tagName.toLowerCase(), fontFamily: hs.fontFamily, fontSize: px(hs.fontSize), fontWeight: Number(hs.fontWeight), textTransform: hs.textTransform } } : {}),
      ...(card && cs ? { surface: { className: (card as HTMLElement).className.toString().split(/\s+/)[0] ?? "", radius: px(cs.borderTopLeftRadius), padding: padded ? px(getComputedStyle(padded).paddingLeft) : 0, boxShadow: cs.boxShadow, borderWidth: px(cs.borderTopWidth), background: cs.backgroundColor } } : {}),
    };
  }, want);
}

const firstFamily = (stack: string) => (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
const rgb = (hex: string) => {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `rgb(${parseInt(f.slice(0, 2), 16)}, ${parseInt(f.slice(2, 4), 16)}, ${parseInt(f.slice(4, 6), 16)})`;
};
const flat = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

export type ImplementationStatus = "implemented" | "not implemented" | "for the coder" | "needs your review";

export interface RequirementResult {
  id: string;
  aspect: string;
  statement: string;
  by: string;
  status: ImplementationStatus;
  evidence: string;
}

/** Each spec requirement against the rendered app. Coder work that styles can't show stays "for the coder" or "needs your review". */
export function specImplementation(s: DesignSpec, m: MeasuredDesign, opts: { coderDone?: string[]; requirements?: SpecRequirement[] } = {}): RequirementResult[] {
  const tokenOk = (names: string[]) => names.filter((n) => !m.tokens[n] || flat(m.tokens[n]) !== flat(m.expected[n] ?? ""));
  return (opts.requirements ?? specRequirements(s)).map((r) => {
    const base = { id: r.id, aspect: r.aspect, statement: r.statement, by: r.by };
    const result = (ok: boolean, evidence: string): RequirementResult => ({ ...base, status: ok ? "implemented" : "not implemented", evidence });
    if (r.by === "unsupported") return { ...base, status: "not implemented", evidence: `this app doesn't declare ${(r.missing ?? []).join(", ")}` };
    switch (r.id) {
      case "type-families": {
        const body = firstFamily(m.body.fontFamily);
        const head = firstFamily(m.heading?.fontFamily ?? "");
        return result(body === s.typography.body.toLowerCase() && head === s.typography.display.toLowerCase(), `text in "${body}", heading (${m.heading?.tag ?? "none"}) in "${head}"`);
      }
      case "type-scale": {
        const off = tokenOk(r.tokens ?? []);
        const weight = m.heading?.fontWeight ?? 0;
        return result(!off.length && weight === s.typography.headingWeight, `scale tokens ${off.length ? `differ: ${off.join(", ")}` : "as specified"}; heading ${m.heading?.fontSize ?? "?"}px over text ${m.body.fontSize}px, weight ${weight}`);
      }
      case "palette":
        return result(m.body.background === rgb(s.palette.bg) && m.body.color === rgb(s.palette.text) && !tokenOk(["--color-accent", "--color-surface"]).length, `page ${m.body.background}, text ${m.body.color}, accent token ${m.tokens["--color-accent"] ?? "?"}`);
      case "density": {
        const off = tokenOk(r.tokens ?? []);
        return result(!off.length, `spacing ${off.length ? `differs: ${off.join(", ")}` : "as specified"}; a card's padding ${m.surface?.padding ?? "?"}px`);
      }
      case "shape": {
        const off = tokenOk(r.tokens ?? []);
        // The rendered card too: its corners are --radius-lg and its outline the spec's width.
        const card = !m.surface || (m.surface.radius === s.surface.radii[2] && m.surface.borderWidth === s.surface.borderWidth);
        return result(!off.length && card, `corner and border tokens ${off.length ? `differ: ${off.join(", ")}` : "as specified"}; a card's corners ${m.surface?.radius ?? "?"}px, border ${m.surface?.borderWidth ?? "?"}px`);
      }
      case "surfaces": {
        const off = tokenOk(r.tokens ?? []);
        return result(!off.length, `surface tokens ${off.length ? `differ: ${off.join(", ")}` : `as the ${s.surface.vibe} style`}; a card's shadow ${m.surface?.boxShadow ?? "?"}`);
      }
      case "content-width":
        return result(!tokenOk(["--content-max"]).length, `content width ${m.tokens["--content-max"] ?? "?"}`);
      case "heading-case":
        return { ...base, status: m.heading?.textTransform === "uppercase" ? "implemented" : opts.coderDone?.includes(r.id) ? "needs your review" : "for the coder", evidence: `heading text-transform ${m.heading?.textTransform ?? "?"}` };
      default:
        // Composition, the signature detail, responsive changes: the coder's work, and only the person can judge them.
        return { ...base, status: opts.coderDone?.includes(r.id) ? "needs your review" : "for the coder", evidence: "not visible in styles alone" };
    }
  });
}

/** The tokens to measure for a spec, with the values expected (pass to measureDesign). */
export const specMeasureTokens = (s: DesignSpec) => expectedTokens(s);
