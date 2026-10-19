/**
 * An isolated copy of the main FlowCode data for demonstrating the design direction on Frameproof without changing the
 * real project: the database (SQLite online backup) and the Frameproof workspace (node_modules linked, not copied) in
 * .flowcode-design-demo, with the workspace reference pointed at the copy. Run it with the demo daemon stopped.
 *   node scripts/design-demo-setup.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const demo = path.join(root, ".flowcode-design-demo");
const srcWs = path.join(root, ".flowcode-data/workspaces/frameproof-f6873f");
const ws = path.join(demo, "workspaces/frameproof-f6873f");
fs.rmSync(demo, { recursive: true, force: true });
fs.mkdirSync(path.dirname(ws), { recursive: true });
const live = new DatabaseSync(path.join(root, ".flowcode-data/flowcode.sqlite"), { readOnly: true });
await backup(live, path.join(demo, "flowcode.sqlite"));
live.close();
fs.cpSync(srcWs, ws, { recursive: true, filter: (s) => !/[\\/]node_modules([\\/]|$)/.test(s) });
fs.symlinkSync(path.join(srcWs, "node_modules"), path.join(ws, "node_modules"), "junction");
const db = new DatabaseSync(path.join(demo, "flowcode.sqlite"));
const refs = JSON.parse(db.prepare("select value from settings where key='workspaceRefs'").get().value);
refs.ws_7e4df4e9500fc3e7 = ws;
db.prepare("update settings set value=? where key='workspaceRefs'").run(JSON.stringify(refs));
db.close();
console.log(JSON.stringify({ demo, workspace: ws }));
