// Typechecks every library piece (templates/library/sections/*.tsx). The workspace's own typecheck
// does not reach them: they are copied into built apps rather than compiled here, so until this ran
// a syntax error or a bad prop in one piece stayed hidden until somebody opened that one preview.
// Each piece is self-contained React with the library's own token CSS, so one strict pass over the
// whole folder is enough. Run on its own with `npm run typecheck:library`.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "templates/library/sections");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".tsx"))
  .sort()
  .map((f) => path.join(dir, f));

if (!files.length) {
  console.error("library sections: nothing to check in templates/library/sections");
  process.exit(1);
}

// A generated config rather than a command line: 176 paths is past what a shell will take.
const cfg = path.join(root, "tsconfig.library-sections.json");
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
        types: [],
      },
      files,
    },
    null,
    2,
  ),
);

try {
  execFileSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "-p", cfg], { cwd: root, stdio: "inherit" });
  console.log(`library sections: ${files.length} piece(s) typecheck`);
} catch {
  console.error(`library sections: ${files.length} piece(s) checked, see the errors above`);
  process.exitCode = 1;
} finally {
  fs.rmSync(cfg, { force: true });
}
