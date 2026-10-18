/**
 * Reads an exported plan version (`node inspect.mjs v1`) and prints the evidence for each requested correction and for
 * the mismatches disclosed after the replay (layout, test data, capabilities): quoted plan text, not a verdict. The
 * verdicts are written by hand in REPORT.md from this output and the plan itself.
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const label = process.argv[2] ?? "v1";
const read = (f, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, label, f), "utf8"));
  } catch {
    return d;
  }
};
const plan = read("plan.json");
const raw = (k) => read(`raw/${k}.json`);
const model = raw("appModel");
const tasks = plan.tasks;
const out = [];
const say = (...l) => out.push(l.join(" "));
const quote = (s, n = 400) => JSON.stringify(String(s).slice(0, n));
const find = (re) => tasks.filter((t) => re.test(`${t.title}\n${t.objective}`)).map((t, i) => `#${tasks.indexOf(t) + 1} ${t.title}`);

say(`# ${label}: ${tasks.length} steps`);
say("\n## Assumptions");
for (const a of plan.assumptions) say("-", a);

say("\n## 1 Scope");
say("app model destinations:", model ? model.nav.flatMap((g) => g.items.map((v) => `${v.label} [${v.kind}]`)).join(", ") : "(no app model)");
say("lookup.omit:", JSON.stringify(model?.lookup?.omit ?? null));
say("scope:", JSON.stringify((raw("planScope")?.capabilities ?? []).map((c) => `${c.capability}:${c.status}/${c.source}`)));
for (const w of ["categor", "ZIP", "store finder|Find a store|near you|nearby", "\\blists?\\b", "ratings?", "comments?", "shar(e|ing)", "\\blikes?\\b|most liked"]) say(`mentions /${w}/i:`, find(new RegExp(w, "i")).join("; ") || "none");

say("\n## 2 Home");
const lib = tasks.find((t) => t.title === "Add library sections");
say("library step:", lib ? quote(lib.objective, 600) : "(none)", "| files:", lib?.expectedPaths.join(", "));
for (const b of raw("screenBrief") ?? []) {
  say(`brief ${b.screen}: pageType=${b.pageType}; firstView=${quote(b.firstView, 200)}`);
  for (const s of b.sections) say(`  - ${s.title}: ${s.purpose} [${s.part || "no part"}]`);
}
const comp = raw("composition");
if (comp) say("composition gaps:", JSON.stringify(comp.gaps));

say("\n## 3 Tests");
const seedText = JSON.stringify(model?.seed ?? {}).toLowerCase();
for (const t of tasks.filter((x) => /^lrc_/.test(x.key))) {
  say(`#${tasks.indexOf(t) + 1} ${t.title}`);
  for (const l of t.objective.split("\n").filter((x) => /^- .* → /.test(x))) {
    // Search terms a test types: quoted words in the behaviour, checked against the records.
    const terms = [...l.split(" → ")[0].matchAll(/['"‘“]([^'"’”]{2,40})['"’”]/g)].map((m) => m[1]);
    const missing = terms.filter((x) => !seedText.includes(x.toLowerCase()));
    say(`  ${l.slice(0, 260)}${missing.length ? `   <-- not in the records: ${missing.join(", ")}` : ""}`);
  }
  for (const c of t.acceptanceCriteria.filter((c) => c.check.type === "file_contains")) say(`  criterion: ${c.description}`);
}

say("\n## 4 Journeys");
const asm = tasks.find((t) => t.title.startsWith("Assemble the app"));
for (const l of (asm?.objective ?? "").split("\n").filter((x) => /^- "/.test(x))) say(" ", l.slice(0, 700));
say("scope decisions:", JSON.stringify(raw("scopeDecisions")));

say("\n## 5 Data owners and navigation");
const write = tasks.find((t) => t.title === "Write the complete app");
for (const l of (write?.objective ?? "").split("\n").filter((x) => /^(Primary navigation|Opened from|Navigation|A look-up app|Not in this build)/.test(x))) say(" ", l);
for (const t of tasks.filter((x) => /^lrc_/.test(x.key))) say(`  #${tasks.indexOf(t) + 1} ${t.title}: ${t.expectedPaths.join(", ")}`);
say("owners line in steps:", find(/Data owners \(one each/).length);
say("src/sim mentions:", find(/src\/sim/).join("; ") || "none");

say("\n## 6 Look");
for (const t of tasks.filter((x) => /Capture the style|Review the prototype plan/.test(x.title))) say(`#${tasks.indexOf(t) + 1} ${t.title}: ${quote(t.objective, 500)}`);
const concepts = read("concepts.json");
if (concepts) for (const c of concepts.concepts ?? []) say(`concept ${c.name}: ${c.thesis.slice(0, 160)} | problems: ${JSON.stringify(c.problems)}`);
say("design state:", JSON.stringify(read("design-state.json")?.label), "chosen concept:", JSON.stringify(concepts?.chosen ?? null));

say("\n## Plan checks (FlowCode's own)");
for (const c of raw("planChecks") ?? []) say(`- ${c.id} ${c.ok ? "pass" : "FAIL"}: ${c.label}${c.problems.length ? ` -- ${c.problems.join(" | ")}` : ""}`);

fs.writeFileSync(path.join(dir, label, "inspection.txt"), out.join("\n"));
console.log(out.join("\n"));
