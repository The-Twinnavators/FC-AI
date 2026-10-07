/**
 * Look check: after a coding step changes the app's screens, FlowCode opens the app in a browser, visits each screen
 * from its navigation (up to six), and checks what a person would see, at phone and desktop widths:
 *  - placeholder or self-describing text on screen;
 *  - the same section repeated, more than one h1, or no h1;
 *  - unstyled browser defaults (default serif font, grey system buttons) instead of the design tokens;
 *  - text below WCAG AA contrast;
 *  - horizontal scrolling at 375px, and touch targets smaller than 24px;
 *  - a screen with almost nothing on it;
 *  - the same control on every item ("Create" in each day cell), the same empty label repeated ("0 events"),
 *    "Sign in" next to "Sign out", and "No events" when the prototype's sample data has events;
 *  - once the app has more than one screen, no navigation.
 * Serious findings fail the step (the coder retries with them); the rest are warnings. One desktop screenshot per
 * screen is kept so the user can see what was checked.
 */
import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import type { BrowserSession } from "./preview.js";

export interface LookFinding {
  screen: string;
  rule: string;
  serious: boolean;
  message: string;
}

export interface LookResult {
  findings: LookFinding[];
  screens: Array<{ name: string; png: Buffer }>;
}

/** Runs in the page: what's wrong with the screen as rendered. */
function auditScreen(): Array<{ rule: string; serious: boolean; message: string }> {
  const out: Array<{ rule: string; serious: boolean; message: string }> = [];
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.1;
  };
  const main = document.querySelector("main") ?? document.body;
  const text = (main as HTMLElement).innerText.replace(/\s+/g, " ").trim();

  const placeholder = /\bthis is (?:a|an|the) [\w\s'-]{0,40}?\b(?:component|section|page|screen|placeholder|sample|view)\b|\byou will (?:see|receive|find|get) [^.]{0,60}?\bhere\b|\blorem ipsum\b|\bsample (?:scenario|text|content|data)\b|\b(?:coming soon|content goes here|start building here)\b/i.exec(text);
  if (placeholder) out.push({ rule: "placeholder-text", serious: true, message: `Shows placeholder text: "${placeholder[0]}". Replace it with the real content from the spec.` });

  const h1s = Array.from(document.querySelectorAll("h1")).filter(visible);
  if (h1s.length === 0) out.push({ rule: "no-page-title", serious: false, message: "No h1 page title: the user can't tell which screen this is." });
  if (h1s.length > 1) out.push({ rule: "several-h1", serious: true, message: `${h1s.length} h1 headings (${h1s.slice(0, 3).map((h) => `"${(h as HTMLElement).innerText.trim().slice(0, 30)}"`).join(", ")}). Use one h1 per screen and h2/h3 below it.` });
  const headings = Array.from(main.querySelectorAll("h1, h2, h3")).filter(visible).map((h) => (h as HTMLElement).innerText.trim().toLowerCase()).filter(Boolean);
  const repeated = [...new Set(headings.filter((h, i) => headings.indexOf(h) !== i))];
  if (repeated.length) out.push({ rule: "repeated-section", serious: true, message: `The same section appears more than once: ${repeated.slice(0, 3).map((h) => `"${h}"`).join(", ")}. Show each section once.` });

  const bodyFont = getComputedStyle(document.body).fontFamily.toLowerCase();
  if (/^"?times new roman"?|^serif$/.test(bodyFont)) out.push({ rule: "unstyled-text", serious: true, message: "Text uses the browser's default serif font: the design tokens' --font-sans isn't applied to the body." });
  const greyButtons = Array.from(document.querySelectorAll("button")).filter(visible).filter((b) => getComputedStyle(b).backgroundColor === "rgb(239, 239, 239)" || getComputedStyle(b).backgroundColor === "rgb(240, 240, 240)");
  if (greyButtons.length) out.push({ rule: "unstyled-buttons", serious: true, message: `${greyButtons.length} button(s) use the browser's default grey style (e.g. "${(greyButtons[0] as HTMLElement).innerText.trim().slice(0, 30)}"). Style them with the Button component or the token classes.` });

  // Contrast of visible text against what's actually behind it.
  const parse = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (t: number[], u: number[]) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3])).concat(1);
  const behind = (el: Element) => {
    const chain: Element[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) chain.push(n);
    let c = [255, 255, 255, 1];
    for (const n of chain.reverse()) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== "none") return null;
      const b = parse(cs.backgroundColor);
      if (b && b[3] > 0) c = over(b, c);
    }
    return c;
  };
  const low: string[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (low.length >= 3 || !visible(el) || el.closest("[disabled], [aria-disabled=true], svg")) continue;
    if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1)) continue;
    const bg = behind(el);
    const fg = parse(getComputedStyle(el).color);
    if (!bg || !fg) continue;
    const a = lum(over(fg, bg));
    const b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (ratio < (size >= 24 ? 3 : 4.5)) low.push(`"${(el as HTMLElement).innerText.trim().slice(0, 30)}" ${ratio.toFixed(2)}:1`);
  }
  if (low.length) out.push({ rule: "low-contrast", serious: true, message: `Text below contrast minimum: ${low.join(", ")}. Use --color-text or --color-text-muted on the surface colours.` });

  // Images that didn't load (a wrong path, or a hotlink that broke) look like an unfinished product.
  const broken = Array.from(document.images).filter((im) => visible(im) && im.complete && im.naturalWidth === 0);
  if (broken.length) out.push({ rule: "broken-image", serious: true, message: `${broken.length} image(s) don't load (e.g. "${broken[0].getAttribute("src") ?? ""}"). Use a file in public/images (find_image saves one) or an inline SVG.` });

  // Calendar prototype: "Create" and "0 events" in each of 35 day cells, put there for tests, passed as "looks right".
  const label = (el: Element) => ((el as HTMLElement).innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  const tally = (els: Element[]) => {
    const n = new Map<string, number>();
    for (const el of els) {
      const t = label(el);
      if (t.length >= 2 && !/^[\d\s:.,+\-–]+$/.test(t)) n.set(t, (n.get(t) ?? 0) + 1);
    }
    return [...n].sort((a, b) => b[1] - a[1]);
  };
  const controls = Array.from(main.querySelectorAll("button, a[href], [role=button]")).filter(visible).filter((el) => (el as HTMLElement).innerText.trim());
  const [topControl] = tally(controls);
  if (topControl && topControl[1] >= 6) out.push({ rule: "repeated-controls", serious: true, message: `"${topControl[0].slice(0, 30)}" is on ${topControl[1]} controls. Put the action once (one main button, or clicking the item opens it) instead of on every item.` });
  const leaves = Array.from(main.querySelectorAll("*")).filter((el) => el.children.length === 0 && visible(el));
  const filler = tally(leaves).find(([t, n]) => n >= 6 && /^(0 |no |none\b|nothing\b|empty\b)/i.test(t));
  if (filler) out.push({ rule: "repeated-empty-text", serious: true, message: `"${filler[0].slice(0, 30)}" is shown ${filler[1]} times. Leave empty items empty instead of labelling each one.` });
  const shown = controls.map(label).join(" | ").toLowerCase();
  if (/\b(sign|log) ?in\b/.test(shown) && /\b(sign|log) ?out\b/.test(shown)) out.push({ rule: "contradictory-controls", serious: true, message: "Both \"Sign in\" and \"Sign out\" are on screen. Show the one that fits whether the user is signed in." });
  // Prototype sample data (src/sim collections) that the screen says isn't there.
  const counts = (window as unknown as { __simCounts?: () => Record<string, number> }).__simCounts?.() ?? {};
  for (const [key, n] of Object.entries(counts)) {
    const noun = key.split(/[^a-z]+/i).filter(Boolean).pop()?.toLowerCase().replace(/s$/, "");
    if (!n || !noun || noun.length < 3) continue;
    const empty = new RegExp(`\\b(0|no|zero) ${noun}s?\\b|\\bno ${noun}s? (yet|found|here)\\b|\\bcreate your first ${noun}\\b`, "i").exec(text);
    if (empty) {
      out.push({ rule: "sample-data-hidden", serious: true, message: `Shows "${empty[0]}" although the prototype has ${n} sample ${noun}s (src/sim "${key}"). Show the sample data on this screen.` });
      break;
    }
  }

  if (text.length < 40) out.push({ rule: "empty-screen", serious: false, message: "This screen shows almost nothing. Add its real content, or a designed empty state with the next action." });
  return out;
}

/** Runs in the page at phone width: overflow and tiny targets. */
function auditPhone(): Array<{ rule: string; serious: boolean; message: string }> {
  const out: Array<{ rule: string; serious: boolean; message: string }> = [];
  // A phone browser widens its layout to fit content that is too wide, so compare with the phone's real width, not innerWidth.
  if (Math.max(document.documentElement.scrollWidth, window.innerWidth) > Math.min(window.screen.width || 375, 375) + 2) out.push({ rule: "phone-overflow", serious: true, message: `At 375px the page scrolls sideways (${Math.max(document.documentElement.scrollWidth, window.innerWidth)}px wide). Let content wrap and drop fixed widths.` });
  const small = Array.from(document.querySelectorAll("button, a[href], input, select, [role=button]")).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
  });
  if (small.length) out.push({ rule: "small-targets", serious: false, message: `${small.length} control(s) are smaller than 24px at phone size. Make touch targets at least 44px.` });
  return out;
}

/** Labels of the app's own navigation items (the screens to visit). */
async function navItems(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("nav a, nav button, [role=tablist] [role=tab]"))
      .map((el) => (el as HTMLElement).innerText.trim())
      .filter((t, i, all) => t && t.length < 40 && all.indexOf(t) === i)
      .slice(0, 6),
  );
}

/** A prototype's demo account, from its simulated data, so the look check can see the screens behind sign-in. */
export interface DemoAccount {
  email: string;
  password: string;
}

/** The first seeded account in the prototype's simulated data (src/sim): an object with an email and a password. */
export function demoAccount(root: string): DemoAccount | undefined {
  const dir = path.join(root, "src/sim");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(ts|tsx|js|json)$/.test(f) && !/\.test\./.test(f));
  } catch {
    return undefined;
  }
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of text.matchAll(/\{[^{}]*?["']?email["']?\s*:\s*["']([^"'\s]+@[^"'\s]+)["'][^{}]*?\}/g)) {
      const pw = /["']?password["']?\s*:\s*["']([^"']+)["']/.exec(m[0]);
      if (pw) return { email: m[1], password: pw[1] };
    }
  }
  return undefined;
}

/**
 * Signs in through the app's own form when the screen shows one. Calendar design rebuild: once signed-out visitors saw
 * only the sign-in screen, the look check never saw the calendar, and Design polish passed on that one screen.
 */
async function signInIfAsked(page: Page, account: DemoAccount | undefined): Promise<boolean> {
  if (!account) return false;
  const password = page.locator('input[type="password"]:visible').first();
  if (!(await password.count())) return false;
  const email = page.locator('input[type="email"]:visible, input[autocomplete="username"]:visible, input[name*="email" i]:visible').first();
  if (!(await email.count())) return false;
  await email.fill(account.email).catch(() => undefined);
  await password.fill(account.password).catch(() => undefined);
  await password.press("Enter").catch(() => undefined);
  await page.waitForTimeout(700);
  return !(await page.locator('input[type="password"]:visible').count());
}

/**
 * Waits (up to 4 s) for loading placeholders to go: skeletons, busy regions, spinners. A prototype's simulated loading
 * (500 ms) outlasted the 400 ms pause, so every screenshot showed skeleton bars and Design polish was blocked four times
 * for "only grey skeleton bars" (No BIO & GMO build).
 */
async function settled(page: Page, ms = 400): Promise<void> {
  await page.waitForTimeout(ms);
  await page
    .waitForFunction(
      () => {
        const busy = document.querySelectorAll('[aria-busy="true"], [class*="skeleton" i], [class*="spinner" i], [role="progressbar"]:not([aria-valuenow])');
        return Array.prototype.every.call(busy, (el: Element) => !(el as HTMLElement).offsetParent);
      },
      undefined,
      { timeout: 4000, polling: 200 },
    )
    .catch(() => undefined);
}

export async function lookCheck(session: BrowserSession, url: string, opts: { account?: DemoAccount } = {}): Promise<LookResult> {
  const findings: LookFinding[] = [];
  const screens: LookResult["screens"] = [];
  const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await settled(page);
    // The signed-out screen first, then (with a demo account) the app behind it.
    for (const f of await page.evaluate(auditScreen)) findings.push({ screen: "First screen", ...f });
    screens.push({ name: "First screen", png: await page.screenshot({ fullPage: false }) });
    const signedIn = await signInIfAsked(page, opts.account);
    const items = await navItems(page);
    const visits = [...(signedIn ? [{ name: "After sign-in", click: undefined as string | undefined }] : []), ...items.map((t) => ({ name: t, click: t as string | undefined }))];
    for (const v of visits) {
      if (v.click) {
        const target = page.locator("nav a, nav button, [role=tablist] [role=tab]").filter({ hasText: v.click }).first();
        if (!(await target.count())) continue;
        await target.click({ timeout: 3000 }).catch(() => undefined);
        await settled(page);
      }
      for (const f of await page.evaluate(auditScreen)) findings.push({ screen: v.name, ...f });
      screens.push({ name: v.name, png: await page.screenshot({ fullPage: false }) });
    }
    const appHasScreens = (await page.evaluate(() => document.querySelectorAll("main section, main h2").length)) >= 3;
    if (!items.length && appHasScreens) findings.push({ screen: "App", rule: "no-navigation", serious: false, message: "Several sections but no navigation: give the app a nav with one screen at a time." });

    const phone = await session.browser.newContext({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 1, reducedMotion: "reduce", isMobile: true, hasTouch: true });
    const p2 = await phone.newPage();
    await p2.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await settled(p2, 300);
    await signInIfAsked(p2, opts.account);
    for (const f of await p2.evaluate(auditPhone)) findings.push({ screen: "First screen (phone)", ...f });
    await phone.close();
  } finally {
    await ctx.close();
  }
  // The same problem on several screens is reported once, naming the screens.
  const merged = new Map<string, LookFinding>();
  for (const f of findings) {
    const key = `${f.rule}|${f.message}`;
    const cur = merged.get(key);
    if (cur) cur.screen = cur.screen.includes(f.screen) ? cur.screen : `${cur.screen}, ${f.screen}`;
    else merged.set(key, { ...f });
  }
  return { findings: [...merged.values()], screens };
}
