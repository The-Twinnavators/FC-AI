// Renders scripts/ui-gallery/gallery.tsx to templates/ui-gallery.json: { block: [{ label, html }] }.
// Run after changing the starter's building blocks: npm run build:ui-gallery
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fc-gallery-")), "gallery.mjs");
await build({
  entryPoints: [path.join(here, "gallery.tsx")],
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  outfile: out,
  external: ["react", "react-dom"],
  // Component styles are drawn with the app's own CSS; the gallery only needs markup.
  loader: { ".css": "empty" },
  nodePaths: [path.join(root, "node_modules")],
  logLevel: "warning",
});
// Resolve react from the repo, not the temp folder.
fs.symlinkSync(path.join(root, "node_modules"), path.join(path.dirname(out), "node_modules"), "junction");
const { GALLERY } = await import(pathToFileURL(out).href);
const { renderToStaticMarkup } = await import(pathToFileURL(path.join(root, "node_modules/react-dom/server.node.js")).href).catch(() => import("react-dom/server"));
// A key only shows up when it is a block of the app's stylesheets (the kit's ui-* sheets, or the catalog's library.css).
const styles = path.join(root, "templates/react-vite-starter/src/styles");
const blocks = new Set();
for (const f of fs.readdirSync(styles).filter((x) => x.endsWith(".css"))) {
  const css = fs.readFileSync(path.join(styles, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of css.matchAll(/([^{}@;]+)\{/g)) for (const c of m[1].matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) blocks.add(c[1].split(/__|--/)[0]);
}
const unknown = Object.keys(GALLERY).filter((b) => !blocks.has(b));
if (unknown.length) {
  console.error(`ui-gallery: no starter stylesheet defines ${unknown.join(", ")}; key each example by the block its markup uses`);
  process.exit(1);
}
const result = {};
for (const [block, examples] of Object.entries(GALLERY)) result[block] = examples.map((x) => ({ label: x.label, html: renderToStaticMarkup(x.el) }));
const dest = path.join(root, "templates/ui-gallery.json");
fs.writeFileSync(dest, `${JSON.stringify(result, null, 1)}\n`);
console.log(`Wrote ${Object.keys(result).length} blocks, ${Object.values(result).flat().length} examples to ${path.relative(root, dest)}`);
