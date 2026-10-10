// Checks the feature catalog against the UI it describes. The Copilot, the right-click explainer
// and the Feature guide all answer from this catalog, so a stale line here is a confident wrong
// answer about the product - the worst kind, because nothing looks broken.
//
//   node scripts/audit-guide.mjs            report
//   node scripts/audit-guide.mjs --strict   exit 1 on anything in the first two sections
//
// The first two sections are facts: an anchor nothing carries, or a route the app does not render,
// is wrong with no judgement needed. The third is a suspicion list and needs a person: many part
// names are deliberately descriptive ("Show unused" for a button that reads "Show 3 unused"), and
// some are genuinely stale. Read it, do not mass-edit from it.
import fs from "node:fs";
import path from "node:path";
import { FEATURE_CATALOG, APP_GUIDE } from "../packages/contracts/dist/index.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
};
const ui = walk(path.join(ROOT, "apps/ui/src")).map((p) => fs.readFileSync(p, "utf8")).join("\n");
// JSX writes an apostrophe as an entity, so "Confirm it&apos;s right" must still match "Confirm it's right".
const flat = (t) => t.toLowerCase().replace(/&apos;|&#0?39;|&rsquo;|[\u2018\u2019]/g, "'");
const hay = flat(ui);

// ── Anchors nothing carries: "Show me" would point at nothing ────────────────
const present = new Set([...ui.matchAll(/data-guide=["'`]([^"'`]+)["'`]/g)].map((m) => m[1]));
const dynamic = [...ui.matchAll(/data-guide=\{`([a-z.]+)\$\{/g)].map((m) => m[1]);
const covered = (id) => present.has(id) || dynamic.some((d) => id.startsWith(d));
const deadAnchors = FEATURE_CATALOG.flatMap((f) => (f.anchors ?? []).filter((a) => !covered(a)).map((a) => `${f.id} -> ${a}`));

// ── Routes the app does not render ───────────────────────────────────────────
const app = fs.readFileSync(path.join(ROOT, "apps/ui/src/App.tsx"), "utf8");
// What the app draws, from the JSX: {section === "x" && <XView />}. The bare "" case is Projects.
const renders = new Set([...app.matchAll(/\{section === "([a-z]*)"/g)].map((m) => m[1]));
// Everything else a URL may say, including the legacy sections that only redirect elsewhere.
const routable = new Set([...renders, ...[...app.matchAll(/section === "([a-z]+)"/g)].map((m) => m[1])]);
const badRoutes = FEATURE_CATALOG.filter((f) => {
  if (!f.route || f.route === "*") return false;
  const top = f.route.replace(/^\//, "").split("/")[0].replace(/^:.*/, "");
  return top && !routable.has(top);
}).map((f) => `${f.id} -> ${f.route}`);

// ── Pages with no entry: the right-click menu has nothing to say there ───────
// Only pages that render. A redirect has no screen of its own to explain.
const pagesMissing = [...renders].filter((s) => !APP_GUIDE.some((g) => g.id === `nav.${s || "projects"}`));

// ── Part names that are nowhere in the UI: suspicion, not proof ──────────────
// `concept` entries explain how the engine behaves, not what is on a screen, so there is no label
// to find and nothing this check could tell you.
const NOT_A_LABEL = /^(badge|click|hover|tooltip|status light|label|results?|rows?|columns?|cards?|list|items?|header|footer|icon|colou?rs?|sizes?|states?|title|name|notes? list|categories)$/i;
const suspects = [];
for (const f of FEATURE_CATALOG.filter((f) => f.kind !== "concept"))
  for (const p of f.parts ?? []) {
    const name = p.name.trim();
    if (NOT_A_LABEL.test(name) || name.length < 4 || name.split(/\s+/).length > 5 || /[(),]/.test(name)) continue;
    const core = name.replace(/^\d+\.\s*/, "").split(" / ")[0].trim();
    if (core.length >= 4 && !hay.includes(flat(core))) suspects.push(`${f.id}: "${name}"`);
  }

const say = (title, rows, note = "") => {
  console.log(`\n=== ${title}: ${rows.length} ===${note ? `\n${note}` : ""}`);
  for (const r of rows) console.log("  " + r);
};

say("anchors nothing carries", deadAnchors);
say("routes the app does not render", badRoutes);
say("pages with no guide entry", pagesMissing);
say("part names not found in the UI", suspects, "  Suspicion, not proof: read each one. Dynamic labels are normal.");

const hard = deadAnchors.length + badRoutes.length + pagesMissing.length;
console.log(`\n${hard} fact(s) wrong, ${suspects.length} name(s) to read.`);
if (process.argv.includes("--strict") && hard) process.exit(1);
