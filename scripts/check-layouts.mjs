// Typechecks every ready-made screen layout (templates/layouts/*.tsx). The workspace's own typecheck
// does not reach them: they are copied into src/screens/ of a built app rather than compiled here, so
// until this ran a bad prop or a renamed building block stayed hidden until a build used that layout.
// Unlike the library's sections they are not self-contained - each imports the starter's building
// blocks as "../components/ui", which only resolves from src/screens/ - so they are checked in a
// mirror of the starter's tree, kept inside the repo so react and its types resolve by walking up to
// node_modules exactly as they do in a built app. Run on its own with `npm run typecheck:layouts`.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "templates/layouts");
const kit = path.join(root, "templates/react-vite-starter/src/components/ui");

const names = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".tsx"))
  .sort();

if (!names.length) {
  console.error("layouts: nothing to check in templates/layouts");
  process.exit(1);
}
if (!fs.existsSync(kit)) {
  console.error(`layouts: the starter's building blocks are missing at ${path.relative(root, kit)}`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(root, ".layout-typecheck-"));
const screens = path.join(tmp, "src/screens");
const blocks = path.join(tmp, "src/components/ui");
fs.mkdirSync(screens, { recursive: true });
fs.mkdirSync(blocks, { recursive: true });
for (const f of fs.readdirSync(kit)) fs.copyFileSync(path.join(kit, f), path.join(blocks, f));
for (const f of names) fs.copyFileSync(path.join(dir, f), path.join(screens, f));

const cfg = path.join(tmp, "tsconfig.json");
fs.writeFileSync(
  cfg,
  JSON.stringify(
    {
      compilerOptions: {
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        target: "es2022",
        module: "esnext",
        moduleResolution: "bundler",
        lib: ["es2022", "dom", "dom.iterable"],
      },
      files: names.map((f) => path.join(screens, f)),
    },
    null,
    2,
  ),
);

try {
  execFileSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "-p", cfg], { cwd: root, stdio: "inherit" });
  console.log(`layouts: ${names.length} layout(s) typecheck`);
} catch {
  console.error(`layouts: ${names.length} layout(s) checked, see the errors above`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
