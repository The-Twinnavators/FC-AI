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
    // A heading people see: not a screen-reader-only one (1px, clipped).
    const h = Array.from(document.querySelectorAll("h1, .fl-title, h2")).find((e) => visible(e) && e.getBoundingClientRect().width > 20 && e.getBoundingClientRect().height > 10);
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
export function specImplementation(s: DesignSpec, m: MeasuredDesign, opts: { coderDone?: string[]; requirements?: SpecRequirement[]; layout?: MeasuredLayout; structure?: MeasuredStructure } = {}): RequirementResult[] {
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
      case "home-layout": {
        if (!opts.layout) return { ...base, status: "not implemented", evidence: "the page's layout wasn't measured" };
        const r2 = homeLayoutResult(s, opts.layout, opts.structure);
        return result(r2.ok, r2.evidence);
      }
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

/** The Home page's structure as rendered: what each section is (by the library's markers) and its geometry. */
export interface MeasuredLayout {
  /** The sections of the page in order, under the opening: zip, categories, featured (others as "other"). */
  order: string[];
  hero: { centered: boolean; beside: boolean; width: number } | undefined;
  /** sideways: the row can scroll sideways (a rail), whether or not it overflows at this width. */
  categories: { perRow: number; rows: number; scrolls: boolean; sideways: boolean; tileHeight: number } | undefined;
  list: { perRow: number; cardRatio: number } | undefined;
}

export async function measureLayout(page: Page): Promise<MeasuredLayout> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const stack = main?.querySelector(".fl-lkf-stack") ?? main;
    const kids = stack ? Array.from(stack.children).filter((e) => e.getBoundingClientRect().height > 0) : [];
    const kind = (e: Element) => {
      const fl = e.getAttribute("data-fl") ?? e.querySelector("[data-fl]")?.getAttribute("data-fl") ?? "";
      return fl === "p.place-finder.prompt" ? "zip" : fl === "p.lookup-catalog.categories" ? "categories" : fl === "p.lookup-catalog.grid" ? "featured" : "other";
    };
    const heroEl = kids.find((e) => e.querySelector("h1"));
    const order = kids.filter((e) => e !== heroEl).map(kind);
    let hero: MeasuredLayout["hero"];
    if (heroEl) {
      const h1 = heroEl.querySelector("h1")!.getBoundingClientRect();
      const box = heroEl.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      // Something beside the words: an element in the opening that starts to the right of the heading, level with it.
      const beside = Array.from(heroEl.querySelectorAll("*")).some((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 120 && r.height > 120 && r.left >= h1.right - 4 && r.top < h1.bottom + 200;
      });
      hero = { centered: Math.abs(h1.left + h1.width / 2 - mid) < 24 && getComputedStyle(heroEl.querySelector("h1")!).textAlign === "center", beside, width: Math.round(box.width) };
    }
    const rowsOf = (items: Element[]) => {
      const tops = items.map((e) => Math.round(e.getBoundingClientRect().top));
      const first = tops.filter((t) => Math.abs(t - tops[0]!) < 4).length;
      return { perRow: first, rows: new Set(tops.map((t) => Math.round(t / 8))).size };
    };
    const catList = document.querySelector("main [data-fl='p.lookup-catalog.categories'] ul");
    const tiles = catList ? Array.from(catList.querySelectorAll(":scope > li")) : [];
    const categories = catList && tiles.length ? { ...rowsOf(tiles), scrolls: catList.scrollWidth > catList.clientWidth + 2, sideways: ["auto", "scroll"].includes(getComputedStyle(catList).overflowX), tileHeight: Math.round(tiles[0]!.getBoundingClientRect().height) } : undefined;
    const cards = Array.from(document.querySelectorAll("main [data-fl='p.lookup-catalog.grid'] .fl-cat-card"));
    const list = cards.length ? { perRow: rowsOf(cards).perRow, cardRatio: Math.round((cards[0]!.getBoundingClientRect().width / cards[0]!.getBoundingClientRect().height) * 100) / 100 } : undefined;
    return { order, hero, categories, list };
  });
}

/**
 * A page's structure as a person sees it, from geometry alone (no class names): the main blocks top to bottom, whether
 * a side column runs beside the content, how tall the opening is, and the widest row of like items (cards, tiles).
 */
export interface MeasuredStructure {
  /** The full-page design rendered, by the library's marker (p.lookup-home.<design>), if any. */
  design?: string;
  blocks: number;
  sidebar: boolean;
  /** The first block's height over the viewport's. */
  opening: number;
  /** The most like items side by side in one row anywhere on the page. */
  perRow: number;
  /** Rows of like items (repeated cards or tiles), counted per group. */
  groups: number;
  /** How many like items sit side by side in the first group down the page. */
  firstRow: number;
}

export async function measureStructure(page: Page): Promise<MeasuredStructure> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return { blocks: 0, sidebar: false, opening: 0, perRow: 0, groups: 0, firstRow: 0 };
    const design = main.querySelector("[data-fl^='p.lookup-home.']")?.getAttribute("data-fl")?.replace("p.lookup-home.", "");
    const box = (e: Element) => e.getBoundingClientRect();
    const shown = (e: Element) => box(e).height > 4 && box(e).width > 4;
    // Descend through single-child wrappers to the page's own blocks.
    let root: Element = main;
    for (let i = 0; i < 8; i++) {
      const kids = Array.from(root.children).filter(shown);
      if (kids.length !== 1) break;
      root = kids[0]!;
    }
    const mw = box(root).width;
    let kids = Array.from(root.children).filter(shown);
    // A side column: a block under 40% of the width, beside another block that starts level with it.
    const side = kids.find((k) => box(k).width < mw * 0.4 && kids.some((o) => o !== k && Math.abs(box(o).top - box(k).top) < 40 && box(o).width > box(k).width));
    if (side) {
      const content = kids.find((o) => o !== side && box(o).width > box(side).width);
      if (content) kids = Array.from(content.children).filter(shown);
    }
    const opening = kids[0] ? Math.round((box(kids[0]).height / innerHeight) * 100) / 100 : 0;
    // Groups of like items: siblings (3+) with the same width and tag, laid out in rows.
    let perRow = 0;
    let groups = 0;
    let firstRow = 0;
    for (const parent of Array.from(main.querySelectorAll("*"))) {
      const items = Array.from(parent.children).filter((c) => shown(c) && box(c).width > 80 && box(c).height > 40);
      if (items.length < 3) continue;
      const w = Math.round(box(items[0]!).width);
      const like = items.filter((c) => c.tagName === items[0]!.tagName && Math.abs(box(c).width - w) < 3);
      if (like.length < 3) continue;
      const top = box(like[0]!).top;
      const row = like.filter((c) => Math.abs(box(c).top - top) < 4).length;
      if (row < 2) continue;
      groups++;
      if (!firstRow) firstRow = row;
      perRow = Math.max(perRow, row);
    }
    return { ...(design ? { design } : {}), blocks: kids.length, sidebar: Boolean(side), opening, perRow, groups, firstRow };
  });
}

/** Whether the rendered Home has the spec's layout, from geometry: the opening, the order, how categories and cards flow. */
export function homeLayoutResult(s: DesignSpec, l: MeasuredLayout, st?: MeasuredStructure): { ok: boolean; evidence: string } {
  const h = s.composition.home;
  if (!h) return { ok: true, evidence: "no Home layout in the spec" };
  if (h.design) {
    if (!st) return { ok: false, evidence: "the page's structure wasn't measured" };
    const evidence = `${st.design ? `the ${st.design} page` : "no library page"}; ${st.blocks} blocks${st.sidebar ? " beside a side column" : ""}; opening ${st.opening} of the screen; up to ${st.perRow} like items in a row (${st.groups} groups)`;
    return { ok: st.design === h.design && st.blocks >= 2, evidence: st.design === h.design ? evidence : `the ${h.design} page isn't on Home (${evidence})` };
  }
  const why: string[] = [];
  const hero = l.hero;
  if (!hero) why.push("no opening with a heading");
  else if (h.hero === "centered" && !hero.centered) why.push("the opening isn't centered");
  else if (h.hero === "split" && !hero.beside) why.push("nothing sits beside the opening's words");
  else if (h.hero === "search" && (hero.centered || hero.beside)) why.push("the opening is centered or split, not the search opening");
  const order = l.order.filter((k) => k !== "other");
  if (order.join(",") !== h.order.join(",")) why.push(`sections in the order ${order.join(", ")}`);
  const c = l.categories;
  if (!c) why.push("no categories");
  else if (h.categories === "rail" && !(c.rows === 1 && c.sideways)) why.push("categories don't run in one sideways row");
  else if (h.categories === "chips" && c.tileHeight > 48) why.push(`category chips are ${c.tileHeight}px tall`);
  else if (h.categories === "tiles" && (c.sideways || c.tileHeight <= 48)) why.push("categories aren't tiles");
  const li = l.list;
  if (!li) why.push("no list of entries");
  else if (h.list === "rows" && li.cardRatio < 1.6) why.push(`entries aren't wide rows (card ${li.cardRatio}:1)`);
  else if (h.list === "grid" && li.cardRatio >= 1.6) why.push("entries are rows, not a grid of cards");
  const evidence = `opening ${hero ? (hero.centered ? "centered" : hero.beside ? "split" : "left") : "none"}; order ${order.join(", ")}; categories ${c ? `${c.perRow} per row, ${c.rows} row(s)${c.scrolls ? ", scrolling" : ""}, ${c.tileHeight}px tall` : "none"}; entries ${li ? `${li.perRow} per row, ${li.cardRatio}:1` : "none"}`;
  return { ok: !why.length, evidence: why.length ? `${why.join("; ")} (${evidence})` : evidence };
}
