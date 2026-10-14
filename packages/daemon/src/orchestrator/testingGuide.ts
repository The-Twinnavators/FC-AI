/**
 * For a step that writes acceptance tests: how to work (write the file early and add tests in batches) and a short map
 * of what the app's screens and library pieces show and label, read from their source, so the agent can write
 * getByRole / getByLabelText / getByText queries without paging through every file. Clean Cart's test step read
 * LookupCatalog 27 times and the schema 16 times and wrote nothing in 211 tool calls.
 */
import fs from "node:fs";
import path from "node:path";

const HOW = [
  "How to write this step's tests (follow it; it decides whether you finish):",
  "- Create the test file within your first few turns, with the tests you can already write from the map below and the step's brief. Run nothing first.",
  "- Then add tests in batches of 3 to 5, saving the file after each batch. A test file that grows beats a perfect one that is never written.",
  "- Read a file at most once, and read it whole. Use the testing map below instead of the library pieces' source; open a source file only when the map doesn't answer a question.",
  "- Query the way a person finds things: getByRole with a name, getByLabelText, getByText with words the map shows. Don't invent text the app doesn't show.",
].join("\n");

/** Labels, roles, placeholders, headings and button words in one file's JSX, deduplicated. */
function shownIn(text: string): string[] {
  const out = new Set<string>();
  const add = (kind: string, v: string | undefined) => {
    const s = (v ?? "").replace(/\s+/g, " ").trim();
    if (s && s.length <= 70 && !/[{}$`]/.test(s)) out.add(`${kind} "${s}"`);
  };
  for (const m of text.matchAll(/aria-label="([^"]+)"/g)) add("label", m[1]);
  for (const m of text.matchAll(/placeholder="([^"]+)"/g)) add("placeholder", m[1]);
  for (const m of text.matchAll(/role="([^"]+)"/g)) add("role", m[1]);
  for (const m of text.matchAll(/<h[1-4][^>]*>\s*([^<{]{2,})</g)) add("heading", m[1]);
  for (const m of text.matchAll(/<button[^>]*>\s*([^<{]{2,})</g)) add("button", m[1]);
  for (const m of text.matchAll(/<label[^>]*>\s*([^<{]{2,})</g)) add("field", m[1]);
  return [...out];
}

export function testingGuide(root: string, limit = 7000): string {
  const lines: string[] = [];
  // Only the library pieces the app imports (from its screens and App.tsx), not every piece copied in.
  const used = new Set<string>();
  let screens: string[] = [];
  try {
    screens = fs.readdirSync(path.join(root, "src/screens")).map((x) => `src/screens/${x}`);
  } catch {
    screens = [];
  }
  for (const f of ["src/App.tsx", ...screens]) {
    try {
      for (const m of fs.readFileSync(path.join(root, f), "utf8").matchAll(/from "[./]*sections\/(\w+)"/g)) used.add(`${m[1]}.tsx`);
    } catch {
      /* not there */
    }
  }
  for (const dir of ["src/screens", "src/sections"]) {
    let files: string[] = [];
    try {
      files = fs.readdirSync(path.join(root, dir)).filter((f) => /\.tsx$/.test(f) && !/\.(test|spec)\./.test(f) && (dir !== "src/sections" || used.has(f)));
    } catch {
      continue;
    }
    for (const f of files.sort()) {
      let text = "";
      try {
        // A library piece ends in its demo (after "// flowcode:sample"), which the app never shows.
        text = fs.readFileSync(path.join(root, dir, f), "utf8").split("// flowcode:sample")[0]!;
      } catch {
        continue;
      }
      const exports = [...text.matchAll(/export (?:default )?function (\w+)/g)].map((m) => m[1]).slice(0, 8);
      const shown = shownIn(text).slice(0, 24);
      if (!exports.length && !shown.length) continue;
      lines.push(`- ${dir}/${f}${exports.length ? ` (${exports.join(", ")})` : ""}: ${shown.join("; ") || "no fixed labels"}`);
    }
  }
  let map = lines.join("\n");
  if (map.length > limit) map = `${map.slice(0, limit)}\n- (more files; open one only if you need it)`;
  return `${HOW}\n\nTesting map (what each screen and library piece shows and labels, from its source):\n${map || "- (no screens yet)"}`;
}
