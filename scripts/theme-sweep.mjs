// Theme sweep: finds colours that only work in the other theme. For every screen (and every tab on it) in the chosen
// theme it composites each element's background layers to get the colour actually behind its text, then reports:
//  - text below WCAG AA contrast (4.5:1, or 3:1 for large text);
//  - "foreign patches": in the light theme, dark see-through or dark solid backgrounds; in the dark theme, light ones.
// Usage: node scripts/theme-sweep.mjs [light|dark]   Requires the dev daemon (7457) and UI dev server (5199).
import { chromium } from "playwright";

const theme = process.argv[2] === "dark" ? "dark" : "light";
const base = process.env.UI_URL ?? "http://127.0.0.1:5199/";
const qs = "?port=7457&token=dev-token-flowcode";
const res = await fetch("http://127.0.0.1:7457/projects", { headers: { authorization: "Bearer dev-token-flowcode" } });
const projects = await res.json();
const p = projects[0];
const routes = ["/", "/agents", "/network", "/primitives", "/system", "/knowledge", "/library", "/topics", "/search?q=local%20ai", "/quality", "/reports", "/system/models", "/settings", "/guide", ...(p ? [`/projects/${p.id}`, `/quality/${p.id}`, `/quality/${p.id}/analysis`, `/quality/${p.id}/launch`, `/projects/${p.id}/settings`] : [])];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((t) => {
  localStorage.setItem("fc.theme", t);
  localStorage.setItem("fc.sounds", "off");
}, theme);
const page = await ctx.newPage();

const findings = new Map();
async function scan(where) {
  const found = await page.evaluate((theme) => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [r, g, b, a];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (top, under) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
    };
    const page0 = parse(getComputedStyle(document.body).backgroundColor) ?? (theme === "light" ? [241, 242, 246, 1] : [13, 17, 25, 1]);
    // Background actually behind an element: its ancestors' background colours, composited bottom-up.
    const behind = (el) => {
      const chain = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
      let c = page0;
      for (const n of chain.reverse()) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage !== "none" && /gradient|url/.test(cs.backgroundImage) && n !== document.body) return null; // can't judge images
        const b = parse(cs.backgroundColor);
        if (b && b[3] > 0) c = over(b, c);
      }
      return c;
    };
    const sig = (el) => {
      const cls = [...el.classList].filter((c) => !/^is-|^has-/.test(c)).slice(0, 2).join(".");
      const par = el.parentElement ? [...el.parentElement.classList].slice(0, 1).join(".") : "";
      return `${par ? par + " > " : ""}${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
    };
    const out = [];
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight * 3) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.2;
    };
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el) || el.closest("svg, canvas, .codeview, .term, video, iframe, [aria-hidden=true]")) continue;
      const cs = getComputedStyle(el);
      // Foreign patches: the other theme's backgrounds.
      const own = parse(cs.backgroundColor);
      const r = el.getBoundingClientRect();
      if (own && own[3] > 0.08 && r.width * r.height > 600) {
        const bad = theme === "light" ? (own[0] + own[1] + own[2] < 120 && own[3] >= 0.12) || (own[3] === 1 && lum(own) < 0.08) : own[3] >= 0.5 && lum(own) > 0.7;
        if (bad) out.push({ kind: "patch", sig: sig(el), detail: cs.backgroundColor });
      }
      // Text contrast for elements that hold their own text.
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!text) continue;
      const bg = behind(el);
      const fg = parse(cs.color);
      if (!bg || !fg) continue;
      const fgc = over(fg, bg);
      const [hi, lo] = [lum(fgc), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need && !el.closest("[disabled], [aria-disabled=true], .placeholder, input, textarea, select")) out.push({ kind: "contrast", sig: sig(el), detail: `${ratio.toFixed(2)}:1 (${cs.color} on rgb(${bg.slice(0, 3).map(Math.round).join(", ")})) "${el.textContent.trim().slice(0, 40)}"` });
    }
    return out;
  }, theme);
  for (const f of found) {
    const key = `${f.kind}\t${f.sig}`;
    const cur = findings.get(key) ?? { ...f, where: new Set(), n: 0 };
    cur.n++;
    if (cur.where.size < 3) cur.where.add(where);
    findings.set(key, cur);
  }
}

for (const r of routes) {
  await page.goto(`${base}${qs}#${r}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await scan(r);
  // Every tab and segmented option on the screen, one at a time.
  const tabs = await page.$$('[role="tab"], .seg [role="radio"]');
  for (let i = 0; i < Math.min(tabs.length, 24); i++) {
    const all = await page.$$('[role="tab"], .seg [role="radio"]');
    const t = all[i];
    if (!t || !(await t.isVisible())) continue;
    const label = ((await t.textContent()) ?? "").trim().slice(0, 20);
    await t.click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(700);
    await scan(`${r} [${label}]`);
  }
}
await browser.close();

const rows = [...findings.values()].sort((a, b) => (a.kind === b.kind ? b.n - a.n : a.kind < b.kind ? -1 : 1));
for (const f of rows) console.log(`${f.kind}\t${f.n}\t${f.sig}\t${f.detail}\t${[...f.where].join(" | ")}`);
console.log(`${theme}: ${rows.filter((f) => f.kind === "contrast").length} contrast problem(s), ${rows.filter((f) => f.kind === "patch").length} foreign patch(es)`);
