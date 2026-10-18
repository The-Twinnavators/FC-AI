/**
 * The validation run's raw planning intermediates (read only, from the validation daemon's database): the app model,
 * screen plan, prototype plan items, experience map, coverage, scope decisions, screen briefs, composition, catalog
 * picks, plan versions. These are version 2's (each replan overwrites them); version 1's are in v1/events.json data.
 * `node export-raw.mjs <label>` writes <label>/raw/<key>.json. The regression tests read them as the captured failed artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const { created } = JSON.parse(fs.readFileSync(path.join(dir, "freeze.json"), "utf8"));
const db = new DatabaseSync(path.resolve(dir, "../../../.flowcode-frameproof-2/flowcode.sqlite"), { readOnly: true });
const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE ? OR key LIKE ?").all(`%${created.runId}`, `%${created.projectId}`);
const out = path.join(dir, `${process.argv[2] ?? "v2"}/raw`);
fs.mkdirSync(out, { recursive: true });
for (const { key, value } of rows) {
  if (/^(runRefs|providerCheck|runDeadline|runInput|runModelSources)/.test(key)) continue;
  fs.writeFileSync(path.join(out, `${key.split(":")[0]}.json`), JSON.stringify(JSON.parse(value), null, 2));
}
console.log(rows.map((r) => r.key).join("\n"));
