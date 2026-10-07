// Product-UI accessibility audit (MVP metric: 0 critical/serious issues). Runs axe-core on every screen
// of the FlowCode UI in light and dark themes. Requires the dev daemon (7457) and UI dev server (5199).
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const base = process.env.UI_URL ?? "http://127.0.0.1:5199/";
const qs = "?port=7457&token=dev-token-flowcode";
const res = await fetch("http://127.0.0.1:7457/projects", { headers: { authorization: "Bearer dev-token-flowcode" } });
const projects = await res.json();
const routes = ["/", "/discover", "/discover/new", "/agents", "/network", "/primitives", "/system", "/knowledge", "/library", "/topics", "/search?q=local%20ai", "/quality", "/reports", "/system/models", "/settings", ...(projects[0] ? [`/projects/${projects[0].id}`, `/quality/${projects[0].id}/analysis`, `/quality/${projects[0].id}/launch`, `/projects/${projects[0].id}/settings`] : [])];
const browser = await chromium.launch();
let serious = 0;
const rows = [];
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => localStorage.setItem("fc.theme", t), theme);
  const page = await ctx.newPage();
  for (const r of routes) {
    await page.goto(`${base}${qs}#${r}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of result.violations) {
      if (v.impact === "critical" || v.impact === "serious") serious++;
      rows.push(`${theme}\t${r}\t${v.impact}\t${v.id}\t${v.nodes.length}\t${v.nodes[0]?.target.join(" ")}`);
    }
    console.log(`${theme} ${r}: ${result.violations.length} violation(s), ${result.passes.length} passes`);
  }
  await ctx.close();
}
await browser.close();
console.log(rows.join("\n"));
console.log(`critical/serious total: ${serious}`);
process.exit(serious ? 1 : 0);
