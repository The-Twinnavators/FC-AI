/**
 * Point-and-say (D1): the person points at part of their running app and says what should change. The live preview
 * runs on another origin, so FlowCode looks with its own headless browser instead: a fresh full-page screenshot at the
 * chosen size, then, for the spot clicked, the element there (tag, text, a short selector, its box) and the source
 * files that contain its visible text. Nothing in the app is changed; the result only goes into a change request.
 */
import type { App } from "../app.js";
import { BrowserSession } from "../quality/preview.js";
import { searchWorkspace } from "../workspace/fileService.js";

export const POINT_SIZES = { phone: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } } as const;
export type PointSize = keyof typeof POINT_SIZES;

export interface PointedElement {
  tag: string;
  text: string;
  label?: string;
  selector: string;
  /** The nearest heading above it, to say where on the page it is. */
  section?: string;
  rect: { x: number; y: number; width: number; height: number };
  /** Source files containing its visible text (best effort). */
  files: string[];
}

export async function pointAt(app: App, projectId: string, previewUrl: string, size: PointSize, at?: { x: number; y: number; path?: string }): Promise<{ png?: string; width: number; height: number; path: string; element?: PointedElement }> {
  const vp = POINT_SIZES[size];
  const session = await BrowserSession.launch(`point_${projectId}`, app.processes);
  try {
    const ctx = await session.browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: "reduce", ...(size === "phone" ? { isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    // The same screen the person was looking at (the app's own route), when they point.
    const url = new URL(at?.path ?? "/", previewUrl).toString();
    // Loaded, then a short wait for the network to settle: a dev server with the live preview open beside it may never
    // go fully quiet (its reload connection stays open), and that mustn't fail the look.
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    const path = new URL(page.url()).pathname + new URL(page.url()).hash;
    if (!at) {
      // Lazy pictures load only when scrolled to: pass down the page once, give images a moment, then back to the top.
      await page.evaluate(async () => {
        const step = Math.max(400, window.innerHeight * 0.8);
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        const pending = Array.from(document.images).filter((i) => !i.complete);
        const settled = (i: HTMLImageElement) =>
          new Promise((r) => {
            i.addEventListener("load", r, { once: true });
            i.addEventListener("error", r, { once: true });
          });
        await Promise.race([Promise.all(pending.map(settled)), new Promise((r) => setTimeout(r, 4000))]);
        window.scrollTo(0, 0);
      });
      // Pictures requested during the pass, then any fade-in.
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(700);
      const png = (await page.screenshot({ fullPage: true })).toString("base64");
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await ctx.close();
      return { png, width: vp.width, height, path };
    }
    const element = await page.evaluate(
      ({ x, y }) => {
        // Bring the point into view, then ask what's there.
        window.scrollTo(0, Math.max(0, y - window.innerHeight / 2));
        const vx = x - window.scrollX;
        const vy = y - window.scrollY;
        let el = document.elementFromPoint(vx, vy) as HTMLElement | null;
        if (!el) return null;
        // Prefer the control or labelled thing the person most likely means, not a span inside it.
        const meaningful = el.closest("button, a, input, select, textarea, label, img, h1, h2, h3, h4, li, [role], [aria-label]") as HTMLElement | null;
        if (meaningful) el = meaningful;
        const part = (e: Element) => {
          const cls = typeof (e as HTMLElement).className === "string" ? (e as HTMLElement).className.trim().split(/\s+/).filter((c) => c && !/^(css|sc|jsx)-/.test(c)).slice(0, 2) : [];
          return `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${cls.map((c) => `.${c}`).join("")}`;
        };
        const chain: string[] = [];
        for (let e: Element | null = el; e && e !== document.body && chain.length < 4; e = e.parentElement) chain.unshift(part(e));
        // The nearest heading before it in the page.
        let section: string | undefined;
        const heads = Array.from(document.querySelectorAll("h1, h2, h3"));
        for (const h of heads) if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING || h.contains(el)) section = (h.textContent ?? "").trim().slice(0, 80);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: ((el as HTMLInputElement).value || el.innerText || (el as HTMLImageElement).alt || "").replace(/\s+/g, " ").trim().slice(0, 120),
          label: el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? undefined,
          selector: chain.join(" > "),
          section,
          rect: { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) },
        };
      },
      { x: at.x, y: at.y },
    );
    await ctx.close();
    if (!element) return { width: vp.width, height: 0, path };
    // Where it probably lives in the code: files that contain its visible text.
    // Its own class names find the component that renders it; its text finds where the words (or data) live. Tests
    // repeat the text, so they're left out.
    const jail = app.projects.jail(projectId);
    const notTest = (p: string) => !/(^|\/)(acceptance|__tests__|tests?)\/|\.(test|spec)\.[tj]sx?$/.test(p);
    const classes = [...element.selector.matchAll(/\.([\w-]{4,})/g)].map((m) => m[1]!).reverse();
    const needle = (element.text || element.label || "").split(/\s+/).slice(0, 6).join(" ");
    const found: string[] = [];
    for (const q of [...classes.slice(0, 2), ...(needle.length >= 3 ? [needle] : [])])
      for (const h of searchWorkspace(jail, q, { glob: "src/**", maxHits: 12 })) if (notTest(h.path) && !found.includes(h.path) && !/\.css$/.test(h.path)) found.push(h.path);
    const files = found.slice(0, 3);
    return { width: vp.width, height: 0, path, element: { ...element, label: element.label ?? undefined, files } };
  } finally {
    await session.close();
  }
}
