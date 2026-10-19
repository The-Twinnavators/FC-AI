/**
 * Whether an applied Look reached the rendered app: the running preview is opened in a browser and the page's own
 * computed values are compared with the direction's tokens (what the app's CSS resolves at :root), then with what the
 * page actually draws (the body's background and text colours, the heading and body fonts). Tokens written to a file
 * that no screen uses don't count as reaching the app.
 */
import { chromium } from "playwright";

export interface LookReached {
  ok: boolean;
  summary: string;
  mismatched: Array<{ what: string; expected: string; actual: string }>;
}

// The tokens that most show a direction: colours, fonts, and shape/type when the direction sets them.
const KEYS = ["--color-bg", "--color-text", "--color-accent", "--color-surface", "--font-sans", "--font-display", "--radius-xl", "--space-4", "--border-width", "--text-md"];

export async function lookReached(url: string, tokens: Record<string, string>): Promise<LookReached> {
  const want = Object.fromEntries(KEYS.filter((k) => tokens[k] !== undefined).map((k) => [k, tokens[k]!]));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(600);
    const seen = await page.evaluate((keys: string[]) => {
      const root = getComputedStyle(document.documentElement);
      const vars = Object.fromEntries(keys.map((k) => [k, root.getPropertyValue(k).trim()]));
      // The colour a token resolves to, the way the page draws it (rgb), to compare with what the body really uses.
      const probe = document.createElement("span");
      document.body.appendChild(probe);
      const resolve = (v: string) => {
        probe.style.color = "";
        probe.style.color = v;
        return getComputedStyle(probe).color;
      };
      const body = getComputedStyle(document.body);
      const h = document.querySelector("h1, h2");
      const out = {
        vars,
        bg: { token: resolve("var(--color-bg)"), drawn: body.backgroundColor },
        text: { token: resolve("var(--color-text)"), drawn: body.color },
        bodyFont: body.fontFamily,
        headingFont: h ? getComputedStyle(h).fontFamily : "",
      };
      probe.remove();
      return out;
    }, Object.keys(want));
    const flat = (v: string) => v.replace(/\s+/g, " ").replace(/"/g, "'").trim().toLowerCase();
    const first = (stack: string) => flat(stack).split(",")[0]!.replace(/'/g, "").trim();
    const mismatched: LookReached["mismatched"] = [];
    for (const [k, v] of Object.entries(want)) if (flat(seen.vars[k] ?? "") !== flat(v)) mismatched.push({ what: `${k} at :root`, expected: v, actual: seen.vars[k] || "(not set)" });
    // Drawn: the page's background and text use the direction's colours (a transparent body shows the page's own).
    if (seen.bg.drawn !== "rgba(0, 0, 0, 0)" && seen.bg.drawn !== seen.bg.token) mismatched.push({ what: "the page background", expected: seen.bg.token, actual: seen.bg.drawn });
    if (seen.text.drawn !== seen.text.token) mismatched.push({ what: "the body text colour", expected: seen.text.token, actual: seen.text.drawn });
    if (want["--font-sans"] && first(seen.bodyFont) !== first(want["--font-sans"])) mismatched.push({ what: "the body font", expected: first(want["--font-sans"]), actual: first(seen.bodyFont) });
    if (want["--font-display"] && seen.headingFont && first(seen.headingFont) !== first(want["--font-display"])) mismatched.push({ what: "the heading font", expected: first(want["--font-display"]), actual: first(seen.headingFont) });
    const checked = Object.keys(want).length + 4;
    return {
      ok: !mismatched.length,
      summary: mismatched.length ? `${mismatched.length} of ${checked} looks differ on the rendered page: ${mismatched.slice(0, 3).map((m) => `${m.what} is ${m.actual}, not ${m.expected}`).join("; ")}` : `The rendered page uses the applied direction (${checked} values checked, colours and fonts as drawn)`,
      mismatched,
    };
  } finally {
    await browser.close();
  }
}
