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

export function testingGuide(root: string, limit = 7000, testFile?: string): string {
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
  let started = "";
  try {
    if (testFile && /FlowCode started this file/.test(fs.readFileSync(path.join(root, testFile), "utf8"))) started = `\n- ${testFile} is already started: FlowCode wrote its imports, openAt(hash) and one passing test. Add the step's tests to it; don't start another file.`;
  } catch {
    started = "";
  }
  return `${HOW}${started}\n\n${testingPacket(root, testFile)}\n\nTesting map (what each screen and library piece shows and labels, from its source):\n${map || "- (no screens yet)"}`;
}

/**
 * The testing packet (reliability phase 2): what a test-writing step needs to know about this project's test setup,
 * read from its files so nothing is guessed. Clean Cart's test step imported react-router-dom (not installed) and
 * guessed at routing and data instead.
 */
export interface TestingFacts {
  installed: string[];
  notInstalled: string[];
  globals: boolean;
  setup?: string;
  setupNotes: string[];
  /** Wrappers main.tsx puts around <App /> (besides StrictMode), which a test must add too. */
  providers: string[];
  app?: { file: string; importPath: string };
  /** The hash routing contract, when the app keeps its screen in the URL hash. */
  routing?: { screenIds: string[]; idsFrom?: string };
  reset?: { name: string; from: string };
  /** The sample data's collections, with a few real names from each. */
  data: Array<{ collection: string; names: string[] }>;
  dataFile?: string;
  example?: { file: string; text: string };
}

const TEST_LIBS = ["vitest", "@testing-library/react", "@testing-library/user-event", "@testing-library/jest-dom", "@testing-library/dom", "jsdom", "happy-dom"];
// Libraries test steps reach for that a starter doesn't have (react-router-dom in Clean Cart step 14).
const OFTEN_ASSUMED = ["react-router-dom", "react-router", "@tanstack/react-query", "msw", "axios", "zustand", "@reduxjs/toolkit", "jest", "enzyme"];

const read = (root: string, rel: string) => {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return undefined;
  }
};

export function testingFacts(root: string): TestingFacts {
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(read(root, "package.json") ?? "{}") as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    deps = {};
  }
  const config = read(root, "vite.config.ts") ?? read(root, "vitest.config.ts") ?? "";
  const setup = /setupFiles:\s*\[\s*["']([^"']+)["']/.exec(config)?.[1];
  const setupText = setup ? (read(root, setup) ?? "") : "";
  const setupNotes = [
    /cleanup\(/.test(setupText) ? "each test starts from an empty page (cleanup after every test)" : "",
    /jest-dom/.test(setupText) ? "the DOM matchers (toBeInTheDocument, toHaveTextContent, toHaveAttribute…) are loaded" : "",
    /showModal/.test(setupText) ? "<dialog> opens and closes as in a browser" : "",
  ].filter(Boolean);
  const main = read(root, "src/main.tsx") ?? "";
  const rendered = /\.render\(([\s\S]*?)\);/.exec(main)?.[1] ?? "";
  const providers = [...rendered.matchAll(/<([A-Z]\w*)[\s>]/g)].map((m) => m[1]!).filter((n) => n !== "StrictMode" && n !== "App");
  const appText = read(root, "src/App.tsx");
  const app = appText && /export default/.test(appText) ? { file: "src/App.tsx", importPath: "../App" } : undefined;
  // Hash routing: src/lib/screens.ts (useRoute / useScreen) with the screen ids in src/app/routes.ts, or listed in App.
  const screensLib = read(root, "src/lib/screens.ts") ?? "";
  let routing: TestingFacts["routing"];
  if (/export function use(Route|Screen)\b/.test(screensLib)) {
    const routes = read(root, "src/app/routes.ts");
    const idsText = /SCREEN_IDS\s*=\s*\[([^\]]*)\]/.exec(routes ?? appText ?? "")?.[1] ?? "";
    const screenIds = [...idsText.matchAll(/["']([\w-]+)["']/g)].map((m) => m[1]!);
    routing = { screenIds, ...(routes ? { idsFrom: "src/app/routes.ts" } : {}) };
  }
  const sim = read(root, "src/sim/index.ts") ?? "";
  const reset = /export function (resetDemoData)\b/.test(sim) ? { name: "resetDemoData", from: "../sim" } : undefined;
  // Sample data: the seed's collections and a few real names (the step must use real ones).
  const dataFile = read(root, "src/app/schema.ts") !== undefined ? "src/app/schema.ts" : undefined;
  const data: TestingFacts["data"] = [];
  const schema = dataFile ? (read(root, dataFile) ?? "") : "";
  const seedAt = schema.search(/export const seed\b/);
  if (seedAt >= 0) {
    const seed = schema.slice(seedAt);
    const starts = [...seed.matchAll(/^\s{2}["']?([\w-]+)["']?\s*:\s*\[/gm)];
    starts.forEach((m, i) => {
      const body = seed.slice(m.index!, starts[i + 1]?.index ?? seed.length);
      const names = [...body.matchAll(/["'](?:name|title|label)["']?\s*:\s*["']([^"']{2,60})["']/g)].map((x) => x[1]!).slice(0, 4);
      data.push({ collection: m[1]!, names });
    });
  }
  // One working example: the shortest test the project already has (outside the acceptance folder).
  let example: TestingFacts["example"];
  const walk = (dir: string): string[] => {
    let out: string[] = [];
    try {
      for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory() && e.name !== "node_modules" && e.name !== "acceptance") out = out.concat(walk(rel));
        else if (/\.test\.tsx$/.test(e.name)) out.push(rel);
      }
    } catch {
      /* none */
    }
    return out;
  };
  const tests = walk("src")
    .map((f) => ({ file: f, text: read(root, f) ?? "" }))
    .filter((t) => /render\(/.test(t.text) && /expect\(/.test(t.text))
    .sort((a, b) => a.text.length - b.text.length);
  if (tests[0]) example = { file: tests[0].file, text: tests[0].text.split("\n").slice(0, 32).join("\n") };
  return {
    installed: TEST_LIBS.filter((l) => deps[l]),
    notInstalled: OFTEN_ASSUMED.filter((l) => !deps[l]),
    globals: /globals:\s*true/.test(config),
    ...(setup ? { setup } : {}),
    setupNotes,
    providers,
    ...(app ? { app } : {}),
    ...(routing ? { routing } : {}),
    ...(reset ? { reset } : {}),
    data,
    ...(dataFile ? { dataFile } : {}),
    ...(example ? { example } : {}),
  };
}

/** The packet as text for the step's brief. */
export function testingPacket(root: string, testFile?: string): string {
  const f = testingFacts(root);
  const lines: string[] = ["Testing packet (this project's test setup, read from its files; rely on it instead of guessing):"];
  if (f.installed.length) lines.push(`- Installed for tests: ${f.installed.join(", ")}.${f.globals ? " describe, it, expect and beforeEach also work without importing them." : ""}`);
  if (f.notInstalled.length) lines.push(`- Not installed, so never import them: ${f.notInstalled.join(", ")}. FlowCode doesn't add packages for a step.`);
  if (f.setup) lines.push(`- ${f.setup} runs before every test file: ${f.setupNotes.join("; ") || "see the file"}.`);
  if (f.app) lines.push(`- Render the whole app with render(<App />), App imported from "${f.app.importPath}" (${f.app.file}). ${f.providers.length ? `Wrap it the way src/main.tsx does: ${f.providers.map((p) => `<${p}>`).join(" ")}.` : "No provider is needed: src/main.tsx renders <App /> on its own."}`);
  if (f.routing) {
    lines.push(`- Routing: the app keeps the screen in the URL hash (src/lib/screens.ts); there is no router library. Open a screen by setting window.location.hash = "#/<screen id>" before render(<App />)${f.routing.screenIds.length ? `; the screen ids are ${f.routing.screenIds.map((s) => `"${s}"`).join(", ")}${f.routing.idsFrom ? ` (${f.routing.idsFrom})` : ""}` : ""}. A record opens as "#/<screen id>/<record id>". After a click that changes screen, wait for the new screen with await screen.findBy…(…).`);
  }
  if (f.reset) lines.push(`- Sample data is saved between tests: call ${f.reset.name}() (from "${f.reset.from}") and clear window.location.hash in beforeEach.`);
  if (f.data.length) lines.push(`- Fixtures: the sample data in ${f.dataFile} (seed). Use only these real records: ${f.data.map((d) => `${d.collection}${d.names.length ? ` (${d.names.map((n) => `"${n}"`).join(", ")})` : ""}`).join("; ")}.`);
  if (testFile) lines.push(`- Run only this step's tests: run_script "test -- ${testFile}". It prints each failing test and why.`);
  if (f.example) lines.push(`- A working test from this project (${f.example.file}), to copy the style of:\n\`\`\`tsx\n${f.example.text}\n\`\`\``);
  return lines.join("\n");
}

/**
 * The start of a step's acceptance test file, written by FlowCode before the step's first attempt: the imports, the
 * reset between tests, a helper that opens a screen by its hash, and one test that passes. The step adds its tests
 * below. Undefined when the project lacks what it needs (no App, no hash routing).
 */
export function testScaffold(root: string, stepTitle: string): string | undefined {
  const f = testingFacts(root);
  // An app wrapped in providers needs their imports, which a template can't know: no scaffold then.
  if (!f.app || !f.routing || f.providers.length || !f.installed.includes("@testing-library/react")) return undefined;
  const first = f.routing.screenIds[0] ?? "";
  const title = stepTitle.replace(/["\\]/g, "").slice(0, 100);
  return [
    `/** Acceptance tests for "${title}". FlowCode started this file (imports, the reset between tests, openAt and one`,
    " * working test); the step adds its tests below, one `it` each. */",
    `import { beforeEach, describe, expect, it } from "vitest";`,
    `import { render, screen } from "@testing-library/react";`,
    `import App from "${f.app.importPath}";`,
    ...(f.reset ? [`import { ${f.reset.name} } from "${f.reset.from}";`] : []),
    "",
    "/** Opens the app on a screen the way a link does (#/<screen id>, or #/<screen id>/<record id>). */",
    `function openAt(hash = "#/${first}") {`,
    "  window.location.hash = hash;",
    "  return render(<App />);",
    "}",
    "",
    "beforeEach(() => {",
    ...(f.reset ? [`  ${f.reset.name}();`] : []),
    `  window.location.hash = "";`,
    "});",
    "",
    `describe("${title}", () => {`,
    `  it("opens the app on the ${first || "first"} screen", () => {`,
    `    openAt("#/${first}");`,
    "    expect(screen.getAllByRole(\"heading\").length).toBeGreaterThan(0);",
    "  });",
    "});",
    "",
  ].join("\n");
}
