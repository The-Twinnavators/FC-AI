/**
 * Exact fixes for type errors small models get stuck on, worked out by FlowCode instead of left to the model
 * (No GMO App, Home screen step: four patches around "../lib/screens" from src/App.tsx, and a Section wrapped in
 * PageHeader). Each hint names the file, the line and the change.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";

const EXT = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];
const posix = (p: string) => p.split(path.sep).join("/");

function resolves(root: string, fromFile: string, spec: string): boolean {
  const base = path.resolve(root, path.dirname(fromFile), spec);
  return [base, ...EXT.map((e) => base + e), ...EXT.map((e) => path.join(base, `index${e}`))].some((p) => fs.existsSync(p) && fs.statSync(p).isFile());
}

/** The import path from `fromFile` to the project file that matches the missing module's name, if exactly one does. */
function nearestModule(jail: PathJail, fromFile: string, spec: string): string | undefined {
  const name = spec.replace(/^(\.\.?\/|@\/|~\/|\/)+/, "").replace(/\.(tsx?|jsx?|mts|cts)$/, "");
  const files = flattenFiles(jail, 8000).filter((f) => !/(^|\/)(node_modules|dist|build)\//.test(f) && !/\.(test|spec)\./.test(f));
  const hits = files.filter((f) => {
    const noExt = f.replace(/\.(tsx?|jsx?|mts|cts)$/, "");
    return noExt === name || noExt.endsWith(`/${name}`) || noExt.endsWith(`/${name}/index`);
  });
  if (hits.length !== 1) return undefined;
  let rel = posix(path.relative(path.dirname(fromFile), hits[0].replace(/\.(tsx?|jsx?|mts|cts)$/, "").replace(/\/index$/, "")));
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return `${rel}|${hits[0]}`;
}

/** Whether a missing PascalCase name is used as a type on that line (": Name", "Name[]", "<Name>"), not as a component. */
function usedAsType(jail: PathJail, file: string, ln: string, name: string): boolean {
  let text = "";
  try {
    text = fs.readFileSync(path.join(jail.root, file), "utf8").split(/\r?\n/)[Number(ln) - 1] ?? "";
  } catch {
    return false;
  }
  return new RegExp(`:\\s*${name}\\b|\\b${name}\\[\\]|<${name}(\\[\\])?>\\s*\\(|\\bas ${name}\\b|\\b(type|interface) ${name}\\b`).test(text);
}

/** A ready-to-paste type for a missing name: the calendar event shape for event types, else a stub to fill in. */
function typeShape(name: string): string {
  return /event/i.test(name)
    ? `interface ${name} {\n  id: string;\n  title: string;\n  start: Date;\n  end: Date;\n}`
    : `interface ${name} {\n  id: string;\n  // the fields this file reads from it\n}`;
}

/** The import path from one source file to another ("../lib/events"). */
function relImport(fromFile: string, toFile: string): string {
  const rel = posix(path.relative(path.dirname(fromFile), toFile.replace(/\.(tsx?|jsx?|mts|cts)$/, "").replace(/\/index$/, "")));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/** The one source file that exports `name`, if exactly one does. */
export function exporterFile(jail: PathJail, name: string): string | undefined {
  return exporterOf(jail, name);
}
function exporterOf(jail: PathJail, name: string): string | undefined {
  const decl = new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?(?:function\\*?|const|let|var|class|type|interface|enum)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
  const files = flattenFiles(jail, 8000).filter((f) => /\.(tsx?|jsx?|mts|cts)$/.test(f) && !/(^|\/)(node_modules|dist|build)\//.test(f) && !/\.(test|spec)\./.test(f));
  const hits = files.filter((f) => {
    try {
      return decl.test(fs.readFileSync(path.join(jail.root, f), "utf8"));
    } catch {
      return false;
    }
  });
  return hits.length === 1 ? hits[0] : undefined;
}

/**
 * Mechanical fixes FlowCode applies itself: a name imported from a module that doesn't export it, when exactly one
 * project file does ("Field" from screen-parts → from "../components/ui"). The name moves to an import of the right
 * module (an existing one, or a new line after it); the old import keeps its other names or goes if it's left empty.
 * Returns the new text per file. Calendar test 8: the hint said exactly this and the model never did it in six attempts.
 */
export function importFixes(jail: PathJail, errors: string[], only?: (file: string) => boolean): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of errors) {
    const m = /^(\S+?\.[jt]sx?)\((\d+),\d+\): error TS(?:2305|2724): .*?['"]{1,2}(\.{1,2}\/[^'"]+)['"]{1,2} has no exported member(?: named)? '(\w+)'/.exec(line);
    if (!m) continue;
    const [, file, , spec, name] = m;
    if (only && !only(file)) continue;
    const owner = exporterOf(jail, name);
    if (!owner) continue;
    let rel = posix(path.relative(path.dirname(file), owner.replace(/\.(tsx?|jsx?|mts|cts)$/, "").replace(/\/index$/, "")));
    if (!rel.startsWith(".")) rel = `./${rel}`;
    if (rel === spec) continue;
    let text: string;
    try {
      text = out.get(file) ?? fs.readFileSync(path.join(jail.root, file), "utf8");
    } catch {
      continue;
    }
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const from = new RegExp(`^import\\s*\\{([^}]*)\\}\\s*from\\s*(['"])${esc(spec)}\\2;?[ \\t]*$`, "m");
    const hit = from.exec(text);
    if (!hit || !hit[1].split(",").map((n) => n.trim()).includes(name)) continue;
    const rest = hit[1].split(",").map((n) => n.trim()).filter((n) => n && n !== name);
    const q = hit[2];
    const replacement = rest.length ? `import { ${rest.join(", ")} } from ${q}${spec}${q};` : "";
    text = text.slice(0, hit.index) + replacement + text.slice(hit.index + hit[0].length);
    if (!replacement) text = text.replace(/^\r?\n/m, (x, i: number) => (i === hit.index ? "" : x));
    const to = new RegExp(`^import\\s*\\{([^}]*)\\}\\s*from\\s*(['"])${esc(rel)}\\2;?`, "m");
    const there = to.exec(text);
    if (there) {
      const names = there[1].split(",").map((n) => n.trim()).filter(Boolean);
      if (!names.includes(name)) text = text.slice(0, there.index) + `import { ${[...names, name].join(", ")} } from ${there[2]}${rel}${there[2]};` + text.slice(there.index + there[0].length);
    } else {
      const lastImport = [...text.matchAll(/^import\b[^;]*;?[ \t]*$/gm)].pop();
      const at = lastImport ? lastImport.index + lastImport[0].length : 0;
      text = `${text.slice(0, at)}${at ? "\n" : ""}import { ${name} } from ${q}${rel}${q};${at ? "" : "\n"}${text.slice(at)}`;
    }
    out.set(file, text);
  }
  return out;
}

/** A file the model asked for that doesn't exist, but only differs by extension or "src/" (index.ts → index.tsx). */
export function nearestFile(jail: PathJail, asked: string): string | undefined {
  const want = posix(asked).replace(/^\.\//, "").replace(/\.(tsx?|jsx?|mts|cts)$/, "");
  const files = flattenFiles(jail, 8000).filter((f) => !/(^|\/)node_modules\//.test(f));
  return files.find((f) => {
    const noExt = f.replace(/\.(tsx?|jsx?|mts|cts)$/, "");
    return noExt === want || noExt === `src/${want}`;
  });
}

export function typeErrorHints(jail: PathJail, raw: string[]): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();
  // tsc continues an error on indented lines ("Type … is not assignable to type '…'." then "  Property 'className'
  // does not exist on type 'IntrinsicAttributes & …'."). Joined to their error line, so a hint that reads the detail
  // matches (NOBIO: <Card className> failed six type checks while its hint never fired).
  const errors = raw.flatMap((l) => l.split(/\r?\n/)).reduce<string[]>((out, l) => {
    if (/^\s{2,}\S/.test(l) && out.length && /error TS\d+/.test(out[out.length - 1]!)) out[out.length - 1] += ` ${l.trim()}`;
    else out.push(l);
    return out;
  }, []);
  // ESLint prints the file on its own line, then "23:5  error  Parsing error: Unexpected token <" under it. A .js file
  // with JSX in a TypeScript project (Calendar test 6: four left from before the plan used .tsx) breaks lint for every
  // later step; renaming it to .tsx fixes it, and extension-less imports keep working.
  let lintFile = "";
  const rootPosix = posix(jail.root).toLowerCase();
  for (const line of errors) {
    const fileLine = /^\s*([A-Za-z]:[\\/].+|\/.+|src[\\/].+)\.(jsx?)\s*$/.exec(line);
    if (fileLine) {
      let rel = posix(`${fileLine[1]}.${fileLine[2]}`);
      if (rel.toLowerCase().startsWith(rootPosix)) rel = rel.slice(rootPosix.length).replace(/^\//, "");
      lintFile = rel.startsWith("src/") ? rel : "";
      continue;
    }
    if (lintFile && /Parsing error: Unexpected token </.test(line) && !seen.has(`lint:${lintFile}`)) {
      seen.add(`lint:${lintFile}`);
      const to = lintFile.replace(/\.jsx?$/, ".tsx");
      hints.push(`${lintFile} contains JSX but is a .js file, which the linter can't parse in this TypeScript project. Rename it with move_file from "${lintFile}" to "${to}". Imports without an extension keep working; fix any that end in ".js".`);
    }
  }
  // Syntax errors (TS1xxx, TS17xxx) make every later error in that file unreliable: fix them first.
  const syntaxFiles = [...new Set(errors.map((l) => /^(\S+?)\(\d+,\d+\): error TS(1\d{3}|17\d{3})\b/.exec(l)?.[1]).filter((x): x is string => !!x))];
  for (const line of errors) {
    // An error inside the starter kit comes from an edit made there: the fix is to undo that line, not to repoint it.
    const kit = /^(src\/components\/ui\/(?:index|screen-parts)\.tsx)\((\d+),\d+\): error TS(?:2305|2724|6133|2307)/.exec(line);
    if (kit) {
      const [, file, ln] = kit;
      if (!seen.has(`${file}:${ln}`)) {
        seen.add(`${file}:${ln}`);
        hints.push(`${file} line ${ln}: this is the starter kit's building-block file, and the line was added by an edit. Delete line ${ln}; don't add imports to the kit. Import what you need where you use it.`);
      }
      continue;
    }
    // Broken JSX structure (unclosed tag, several roots, stray brace): patching piece by piece keeps breaking it.
    const jsx = /^(\S+?\.[jt]sx)\((\d+),\d+\): error TS(17002|2657|17008|1381|1382|1005|1109|1128)\b/.exec(line);
    if (jsx) {
      const [, file] = jsx;
      if (!seen.has(`${file}:jsx`)) {
        seen.add(`${file}:jsx`);
        hints.push(`${file}: its JSX structure is broken (an unclosed tag, more than one root element, or a stray brace). Read the whole file, then write it again with replace_file: imports at the top, one component that returns ONE root element (for example <AppShell>…</AppShell>), and every opening tag closed. Don't patch it piece by piece.`);
      }
      continue;
    }
    // A package the app doesn't have. Routers can't be added to the starter (it moves between screens itself), so say
    // what to use instead; any other package is either added on purpose or not imported.
    const pkg = /^(\S+?)\((\d+),\d+\): error TS2307: Cannot find module '((?:@[\w.-]+\/)?[\w.-]+)[^']*'/.exec(line);
    const spec = /Cannot find module '([^']*)'/.exec(line)?.[1] ?? "";
    if (pkg && !/^(src|app|lib|components)$/.test(pkg[3]) && !/^[.@~/]/.test(spec.replace(/^@[\w.-]+\//, "x/"))) {
      const [, file, ln, name] = pkg;
      if (seen.has(`${file}:pkg:${name}`)) continue;
      seen.add(`${file}:pkg:${name}`);
      if (/^(react-router(-dom)?|@reach\/router|wouter|@tanstack\/react-router)$/.test(name))
        hints.push(`${file} line ${ln}: "${name}" isn't part of this app and can't be added: it moves between screens with its own navigation. Delete that import and everything that used it (useNavigate, navigate(...), <Link>, <Routes>). To change screen, take an onNavigate prop (onNavigate("calendar")) and let src/App.tsx pass it: App already holds the current screen with useScreen from src/lib/screens.`);
      else hints.push(`${file} line ${ln}: the package "${name}" isn't installed. If this step really needs it, add it with add_dependency; otherwise delete the import and use what the app already has.`);
      continue;
    }
    // Required props missing (TS2739/TS2741). Calendar test 7: the fast model rewrote App.tsx with props of its own,
    // <AppShell> without its props and a router-style <link to>, then patched one piece per attempt.
    const required = /^(\S+?\.tsx)\((\d+),\d+\): error TS(2739|2741): .*?(?:: ([\w, ]+)\.?$|Property '(\w+)' is missing)/.exec(line);
    if (required) {
      const [, file, ln, , list, one] = required;
      let text = "";
      try {
        text = fs.readFileSync(path.join(jail.root, file), "utf8").split(/\r?\n/)[Number(ln) - 1] ?? "";
      } catch {
        /* unreadable */
      }
      const props = (list ?? one ?? "").split(",").map((p) => p.trim()).filter(Boolean);
      const tag = /<([A-Z]\w*)/.exec(text)?.[1];
      const key = `${file}:missing:${tag ?? ln}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (/export default function App\s*\(\s*\{/.test(text) || (/function App\b/.test(text) && !tag) || tag === "App")
          hints.push(`${file} line ${ln}: App is the root: src/main.tsx renders <App /> with no props, so App takes none. Remove App's parameters and keep the current screen inside App with useScreen (see the AppShell example).`);
        else if (tag === "AppShell")
          hints.push(
            `${file} line ${ln}: <AppShell> needs ${props.join(", ") || "its props"}. It draws the header and the navigation itself; don't write your own header, nav or links. Use this shape:\n` +
              `const SCREENS = [{ id: "<screen-id>", label: "<Screen name>" }]; // one entry per screen the spec names, no others\nconst SCREEN_IDS = SCREENS.map((s) => s.id);\n` +
              `export default function App() {\n  const [current, go] = useScreen(SCREEN_IDS); // import { useScreen } from "./lib/screens"\n  return (\n    <AppShell name="<Product name>" screens={SCREENS} current={current} onNavigate={go}>\n      <FirstScreen /> {/* with more screens, render the one whose id is current */}\n    </AppShell>\n  );\n}`,
          );
        else if (tag) hints.push(`${file} line ${ln}: <${tag}> needs ${props.join(", ")}. Pass ${props.length > 1 ? "them" : "it"} there (read ${tag}'s props where it's defined), or don't use ${tag} here.`);
        continue;
      }
    }
    // A calendar "Event" without an import is the browser's DOM Event type (Calendar test 7: 'id' does not exist in
    // type 'Event'). Name the app's own type something else and import it.
    const domEvent = /^(\S+?)\((\d+),\d+\): error TS(2353|2339|2741|2322): .*'(\w+)' does not exist in type 'Event'|^(\S+?)\((\d+),\d+\): error TS2339: Property '(\w+)' does not exist on type 'Event'/.exec(line);
    if (domEvent) {
      const file = domEvent[1] ?? domEvent[5];
      const ln = domEvent[2] ?? domEvent[6];
      if (!seen.has(`${file}:dom-event`)) {
        seen.add(`${file}:dom-event`);
        const own = exporterOf(jail, "CalendarEvent");
        hints.push(
          `${file} line ${ln}: "Event" here is the browser's built-in DOM Event type, not your calendar event, so it has no id, title or start. ${
            own ? `Import the app's type: import type { CalendarEvent } from "${relImport(file, own)}";` : `Define the app's type in this file, right under the imports:\n${typeShape("CalendarEvent")}`
          }\nThen write CalendarEvent everywhere this file says Event (for example useState<CalendarEvent[]>([])).`,
        );
      }
      continue;
    }
    // e.target.value in an event handler: EventTarget has no value (Calendar test 7, Today control).
    const target = /^(\S+?)\((\d+),\d+\): error TS2339: Property '(value|checked|files)' does not exist on type 'EventTarget/.exec(line);
    if (target) {
      const [, file, ln, prop] = target;
      if (!seen.has(`${file}:target:${ln}`)) {
        seen.add(`${file}:target:${ln}`);
        hints.push(`${file} line ${ln}: e.target is a plain EventTarget, so it has no ${prop}. Type the handler and read the element itself: onChange={(e: React.ChangeEvent<HTMLInputElement>) => setX(e.currentTarget.${prop})} (HTMLSelectElement for a <select>, HTMLTextAreaElement for a <textarea>).`);
      }
      continue;
    }
    // jest-dom matchers in an app made before the kit had them (No BIO & GMO build: qwen3-coder went round
    // "Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'" across two steps).
    const matcher = /error TS2339: Property '(toBeInTheDocument|toHaveTextContent|toBeVisible|toHaveValue|toBeChecked|toBeDisabled|toHaveAttribute|toHaveClass)' does not exist on type 'Assertion/.exec(line);
    if (matcher) {
      const file = /^(\S+?)\(\d+,\d+\)/.exec(line)?.[1] ?? "";
      if (!seen.has(`${file}:jest-dom`)) {
        seen.add(`${file}:jest-dom`);
        hints.push(`${file}: this app's tests don't have the jest-dom matchers (${matcher[1]} and similar). Use plain checks instead: getByText/getByRole already fail when the element is missing, so \`screen.getByText("Nature's Path")\` on its own is the check; for absence use \`expect(screen.queryByText("…")).toBeNull()\`; for text use \`expect(el.textContent).toContain("…")\`; for a field's value \`expect((el as HTMLInputElement).value).toBe("…")\`. Change every one in the file.`);
      }
      continue;
    }
    // The kit's <Field> takes a function as its child (it passes the input its id, aria and class). Writing the input
    // straight inside fails with "Type 'Element' is not assignable to type '(props: { id: string; …' (Calendar test 8).
    // Or input props put on <Field> itself (<Field type="search" placeholder value onChange label>): No BIO & GMO build,
    // qwen3-coder went round "Type '{ type: string; placeholder: string; value …; label: string; }' is not assignable".
    if (/error TS2322: Type 'Element' is not assignable to type '\(props: \{ id: string;.*aria-describedby/.test(line) || /error TS2322: Type '\{[^}]*\b(placeholder|value|onChange|type)\b[^}]*\blabel: string;[^}]*\}' is not assignable/.test(line)) {
      const file = /^(\S+?)\(\d+,\d+\)/.exec(line)?.[1] ?? "";
      if (!seen.has(`${file}:field-child`)) {
        seen.add(`${file}:field-child`);
        hints.push(`${file}: <Field> takes a function as its child, not an element. It hands the input its id, aria and class:\n<Field label="Email" hint="We never share it" error={emailError}>\n  {(props) => <input {...props} type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />}\n</Field>\nDo this for every Field in the file (the same goes for <select> and <textarea>).`);
      }
      continue;
    }
    // A screen calling useScreen() itself (no ids) or using a .goTo it doesn't have (Calendar test 8 sign-in screen).
    const scr = /^(\S+?\.[jt]sx?)\((\d+),\d+\): error TS(2554|2339): (?:Expected 1 arguments, but got 0|Property '(\w+)' does not exist on type '\[string, \(id: string\) => void\]')/.exec(line);
    if (scr) {
      const [, file, ln, code] = scr;
      let text = "";
      try {
        text = fs.readFileSync(path.join(jail.root, file), "utf8").split(/\r?\n/)[Number(ln) - 1]?.trim() ?? "";
      } catch {
        /* unreadable */
      }
      if (code === "2339" || /\buseScreen\(\s*\)/.test(text)) {
        if (!seen.has(`${file}:useScreen`)) {
          seen.add(`${file}:useScreen`);
          // The app's real screen ids, so the hint doesn't send the model to a screen that doesn't exist ("calendar"
          // when App calls it "home").
          let ids: string[] = [];
          try {
            const app = fs.readFileSync(path.join(jail.root, "src/App.tsx"), "utf8");
            ids = [...app.matchAll(/\{\s*id:\s*["']([\w-]+)["']/g)].map((m) => m[1]);
          } catch {
            /* no App.tsx */
          }
          const list = ids.length ? `[${ids.map((i) => `"${i}"`).join(", ")}]` : "SCREEN_IDS";
          const first = ids[0] ?? "home";
          // go() only sets the URL hash, which App listens to, so a screen can change screen with its own call: a fix
          // inside this one file, nothing to wire through App.
          hints.push(
            /^src\/App\.[jt]sx$/.test(file)
              ? `${file}: useScreen takes the screen ids and returns a pair, not an object: \`const [current, go] = useScreen(SCREEN_IDS);\`, then go("${first}") to change screen.`
              : `${file}: useScreen takes the app's screen ids and returns a pair [current, go], not an object with goTo. Change the call to \`const [, go] = useScreen(${list});\` and replace each screen.goTo(x) with go(x), using one of those ids (${ids.length ? ids.map((i) => `"${i}"`).join(", ") : "the ids in src/App.tsx"}; there is no other screen id). That fixes all of these errors in this one file.`,
          );
        }
        continue;
      }
    }
    // <link> is the HTML <head> tag: a router-style <link to=…> isn't navigation here.
    if (/error TS2322: .*Property 'to' does not exist on type .*LinkHTMLAttributes/.test(line)) {
      const file = /^(\S+?)\(\d+,\d+\)/.exec(line)?.[1] ?? "";
      if (!seen.has(`${file}:link`)) {
        seen.add(`${file}:link`);
        hints.push(`${file}: <link to=…> isn't a navigation link (<link> is the HTML head tag, and this app has no router). AppShell already shows the navigation from its screens; to move from inside a screen, use a <button> that calls onNavigate("screen-id").`);
      }
      continue;
    }
    // An unused half of a useState pair: say exactly what to keep, instead of "use it or delete it".
    const pair = /^(\S+?\.[jt]sx?)\((\d+),\d+\): error TS6133: '(\w+)' is declared but its value is never read/.exec(line);
    if (pair) {
      const [, file, ln, name] = pair;
      let text = "";
      try {
        text = fs.readFileSync(path.join(jail.root, file), "utf8").split(/\r?\n/)[Number(ln) - 1]?.trim() ?? "";
      } catch {
        /* unreadable */
      }
      const st = /const\s*\[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*(?:React\.)?useState\b/.exec(text);
      if (st && !seen.has(`${file}:unused:${ln}`)) {
        seen.add(`${file}:unused:${ln}`);
        const [, value, setter] = st;
        if (name === setter)
          hints.push(`${file} line ${ln} is \`${text.slice(0, 120)}\`: "${setter}" is never called. If nothing changes ${value} yet, keep only the value: \`const [${value}] = …\` (or a plain const). If something should change it (loading, an error, a button), call ${setter} there.`);
        else if (name === value)
          hints.push(`${file} line ${ln} is \`${text.slice(0, 120)}\`: "${value}" is set but never shown. Render it in the JSX (for example ${value}.map(...) into the view, with an empty state when there are none), or, if this component doesn't need it, delete the whole line and every ${setter}(...) call.`);
        continue;
      }
    }
    // "All imports in import declaration are unused" / "'X' is declared but never read": show the line and say delete it.
    const unused = /^(\S+?\.[jt]sx?)\((\d+),\d+\): error TS(6192|6133): (?:All imports in import declaration are unused|'(\w+)' is declared but its value is never read)/.exec(line);
    if (unused && !/^src\/components\/ui\//.test(unused[1])) {
      const [, file, ln, code, name] = unused;
      if (seen.has(`${file}:unused:${ln}`)) continue;
      seen.add(`${file}:unused:${ln}`);
      let text = "";
      try {
        text = fs.readFileSync(path.join(jail.root, file), "utf8").split(/\r?\n/)[Number(ln) - 1]?.trim() ?? "";
      } catch {
        /* unreadable */
      }
      // One unused name in an import that brings in others: drop just that name. Deleting the whole line
      // also removes names still in use (useEffect), and the next check fails on those instead.
      const names = /^import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?/.exec(text);
      const imported = names ? [names[1], ...(names[2] ?? "").split(",").map((n) => n.trim().split(/\s+as\s+/).pop())].filter((n): n is string => !!n) : [];
      if (code === "6133" && name && /^import\b/.test(text) && imported.length > 1 && imported.includes(name)) {
        const keep = imported.filter((n) => n !== name);
        hints.push(`${file} line ${ln} is \`${text.slice(0, 120)}\`: only "${name}" is unused. Remove just "${name}" from that import and keep ${keep.map((n) => `"${n}"`).join(", ")}; don't delete the whole line.`);
      } else if (code === "6192" || /^import\b/.test(text))
        hints.push(`${file} line ${ln}${text ? ` is \`${text.slice(0, 120)}\`` : ""}: nothing it imports is used. Delete that whole line (find it exactly as shown, replace with nothing).`);
      else if (name) hints.push(`${file} line ${ln}: "${name}" is never used. Use it, or delete it${text ? ` (the line is \`${text.slice(0, 120)}\`)` : ""}.`);
      continue;
    }
    // "Did you mean 'formatDisplayDate'?": TypeScript already knows the right name; say to use it.
    const meant = /^(\S+?)\((\d+),\d+\): error TS(?:2724|2552|2551): .*?'(\w+)'.*Did you mean '(\w+)'\?/.exec(line);
    // A file that really exports the name beats TypeScript's guess (useScreen → "Did you mean Screen?").
    if (meant && !exporterOf(jail, meant[3])) {
      const [, file, ln, wrong, right] = meant;
      if (!seen.has(`${file}:${wrong}`)) {
        seen.add(`${file}:${wrong}`);
        hints.push(`${file} line ${ln}: "${wrong}" doesn't exist; the real name is "${right}". Use ${right} there and wherever ${wrong} is used, and don't define a ${wrong} of your own.`);
      }
      continue;
    }
    // "Import declaration conflicts with local declaration of 'x'": imported and also defined in the file.
    const clash = /^(\S+?)\((\d+),\d+\): error TS2440: Import declaration conflicts with local declaration of '(\w+)'/.exec(line);
    if (clash) {
      const [, file, ln, name] = clash;
      if (!seen.has(`${file}:clash:${name}`)) {
        seen.add(`${file}:clash:${name}`);
        hints.push(`${file}: "${name}" is both imported (line ${ln}) and defined in this file. Keep one: remove it from the import on line ${ln} if you meant your own, or delete your own definition if you meant the imported one.`);
      }
      continue;
    }
    // useState([]) with no type is "never[]": every later use fails ("not assignable to SetStateAction<never[]>",
    // "Property 'map' does not exist on type 'never'").
    const never = /^(\S+?\.[jt]sx?)\((\d+),\d+\): error TS(2345|2339|2322): .*(SetStateAction<never\[\]>|on type 'never'|to type 'never')/.exec(line);
    if (never) {
      const [, file] = never;
      if (seen.has(`${file}:never`)) continue;
      seen.add(`${file}:never`);
      let decl = "";
      try {
        decl = fs.readFileSync(path.join(jail.root, file), "utf8").split(/\r?\n/).find((l) => /useState\(\s*(\[\]|null)\s*\)/.test(l))?.trim() ?? "";
      } catch {
        /* unreadable */
      }
      hints.push(`${file}: a useState([]) or useState(null) has no type, so TypeScript treats it as always empty ("never"). Give it one${decl ? `: change \`${decl.slice(0, 100)}\`` : ""} to useState<YourType[]>([]) (for example useState<(Date | null)[][]>([]) for weeks of days, or useState<Event | null>(null)).`);
      continue;
    }
    // A function parameter with no type: "Parameter 'date' implicitly has an 'any' type".
    const param = /^(\S+?\.[jt]sx?)\((\d+),\d+\): error TS7006: Parameter '(\w+)' implicitly has an 'any' type/.exec(line);
    if (param) {
      const [, file, ln, name] = param;
      if (seen.has(`${file}:${ln}:${name}`)) continue;
      seen.add(`${file}:${ln}:${name}`);
      // `{(props) => <input {...props} />}` is the child of <Field>/<SettingRow>: its type comes from that component,
      // so the error means the component itself didn't resolve (wrong import), not that props needs a type.
      let text = "";
      try {
        text = fs.readFileSync(path.join(jail.root, file), "utf8").split(/\r?\n/)[Number(ln) - 1]?.trim() ?? "";
      } catch {
        /* unreadable */
      }
      if (/^\{?\s*\(\s*\w+\s*\)\s*=>/.test(text) && name === "props") {
        if (!seen.has(`${file}:childfn`)) {
          seen.add(`${file}:childfn`);
          hints.push(`${file} line ${ln}: "(props) =>" is the child function of <Field> (or <SettingRow>). Don't give it a type: it gets one from that component once the component's import is right. Import Field from the building blocks index ("../components/ui", not screen-parts), then this error goes away by itself.`);
        }
        continue;
      }
      const guess = /date|day|start|end/i.test(name) ? "Date" : /^(e|ev|event)$/.test(name) ? "React.ChangeEvent<HTMLInputElement>" : /index|count|n$/i.test(name) ? "number" : "string";
      hints.push(`${file} line ${ln}: give the parameter "${name}" a type, e.g. (${name}: ${guess}) => …`);
      continue;
    }
    // Untyped props: "Binding element 'currentDate' implicitly has an 'any' type". Collect the names per file and line
    // so the hint gives one complete props type.
    const untyped = /^(\S+?\.[jt]sx?)\((\d+),\d+\): error TS7031: Binding element '(\w+)' implicitly has an 'any' type/.exec(line);
    if (untyped) {
      const [, file, ln] = untyped;
      if (seen.has(`${file}:props:${ln}`)) continue;
      seen.add(`${file}:props:${ln}`);
      const props = errors.map((l) => new RegExp(`^${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\(${ln},\\d+\\): error TS7031: Binding element '(\\w+)'`).exec(l)?.[1]).filter((x): x is string => !!x);
      const guess = (n: string) => (/^on[A-Z]/.test(n) ? "(value: Date) => void" : /date|day|start|end/i.test(n) ? "Date" : /^(is|has|show|open)[A-Z]?/.test(n) ? "boolean" : /s$/.test(n) ? "Item[]" : "string");
      hints.push(`${file} line ${ln}: the component's props have no type. Give them one on that line, e.g. ({ ${props.join(", ")} }: { ${props.map((p) => `${p}: ${guess(p)}`).join("; ")} }), adjusting the types to what you pass in.`);
      continue;
    }
    // A prop the component doesn't accept: "Property 'selectedDate' does not exist on type 'IntrinsicAttributes & { day: Date; }'".
    const extraProp = /^(\S+?\.[jt]sx)\((\d+),(\d+)\): error TS2322: .*Property '(\w+)' does not exist on type 'IntrinsicAttributes & (\{[^']*\})'/.exec(line);
    if (extraProp && extraProp[4] !== "children") {
      const [, file, ln, col, prop, accepted] = extraProp;
      if (seen.has(`${file}:${ln}:${prop}`)) continue;
      seen.add(`${file}:${ln}:${prop}`);
      let tag = "the component";
      let kit = false;
      try {
        const src = fs.readFileSync(path.join(jail.root, file), "utf8");
        const t = src.split(/\r?\n/)[Number(ln) - 1] ?? "";
        const name = /^<?([A-Z]\w*)/.exec(t.slice(Number(col) - 1))?.[1] ?? /<([A-Z]\w*)/.exec(t)?.[1];
        tag = `<${name ?? "component"}>`;
        // A part of the starter's UI kit (src/components/ui): shared by every screen, so the screen adapts, not the kit.
        kit = !!name && new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["'][./]*(?:[\\w/]*/)?components/ui["']`).test(src);
      } catch {
        /* unreadable */
      }
      const props = accepted.replace(/\s+/g, " ");
      hints.push(
        kit
          ? `${file} line ${ln}: ${tag} is part of the app's UI kit (src/components/ui) and only accepts ${props}, not "${prop}". Don't change the kit: ${prop === "className" || prop === "style" ? `put the ${prop} on a <div> around it (<div ${prop}=…>${tag}…${tag.replace("<", "</")}</div>), or drop it` : `stop passing ${prop}; use only the props listed`}.`
          : `${file} line ${ln}: ${tag} only accepts ${props}, not "${prop}". Either stop passing ${prop}, or add it to that component's props type (and use it there). Change one side so both agree.`,
      );
      continue;
    }
    // "Cannot find name 'AppShell'": the missing import, from the one file that exports the name.
    const noName = /^(\S+?)\((\d+),\d+\): error TS2304: Cannot find name '(\w+)'/.exec(line);
    if (noName) {
      const [, file, ln, name] = noName;
      if (seen.has(`${file}:${name}`)) continue;
      seen.add(`${file}:${name}`);
      const owner = exporterOf(jail, name);
      if (owner) {
        let rel = posix(path.relative(path.dirname(file), owner.replace(/\.(tsx?|jsx?|mts|cts)$/, "").replace(/\/index$/, "")));
        if (!rel.startsWith(".")) rel = `./${rel}`;
        hints.push(`${file} line ${ln}: "${name}" isn't imported. Add it to the imports at the top: import { ${name} } from "${rel}";`);
      } else if (/^[A-Z]/.test(name) && usedAsType(jail, file, ln, name)) {
        // A type nothing defines (Calendar test 7: CalendarEvent used, never declared; the model went back to the DOM
        // Event type, then to never[], round and round). Say exactly what to write.
        hints.push(`${file} line ${ln}: the type "${name}" isn't defined anywhere. Define it in this file, right under the imports, then keep using it:\n${typeShape(name)}`);
      } else if (/^[A-Z]/.test(name)) {
        // A component nothing defines yet (Calendar test 6: <CalendarWeek> used inside the month view).
        hints.push(`${file} line ${ln}: <${name}> doesn't exist anywhere in the project yet (a later step may build it). Don't use it here: remove it and write what this step needs with plain elements or the building blocks from src/components/ui. If the file is short, rewrite it whole with replace_file rather than patching around it.`);
      }
      continue;
    }
    // Relative paths ("../lib/screens") and project-root paths written as if they were packages ("src/lib/screens",
    // "@/lib/screens"), which don't resolve without an alias (Calendar test 6).
    const missing = /^(\S+?)\((\d+),\d+\): error TS2307: Cannot find module '((?:\.{1,2}\/|src\/|\/src\/|@\/|~\/)[^']+)'/.exec(line);
    if (missing) {
      const [, file, ln, spec] = missing;
      if (seen.has(`${file}:${spec}`) || (spec.startsWith(".") && resolves(jail.root, file, spec))) continue;
      seen.add(`${file}:${spec}`);
      const near = nearestModule(jail, file, spec);
      if (near) {
        const [importPath, real] = near.split("|");
        hints.push(`${file} line ${ln}: "${spec}" points to nothing. The file is ${real}, so import it from "${importPath}". Change only that path.`);
      } else {
        // Nothing by that name exists yet: usually a component a later step builds (Calendar test 6: ./CalendarWeek
        // imported while building the month view).
        hints.push(`${file} line ${ln}: "${spec}" doesn't exist in the project yet (a later step may build it). Remove that import and anything that uses it; build only what this step asks for.`);
      }
      continue;
    }
    // "'./components/ui' has no exported member 'useScreen'": point at the file that does export it.
    const member = /^(\S+?)\((\d+),\d+\): error TS(?:2305|2724): .*?['"]{1,2}(\.{1,2}\/[^'"]+)['"]{1,2} has no exported member(?: named)? '(\w+)'/.exec(line);
    if (member) {
      const [, file, ln, spec, name] = member;
      if (seen.has(`${file}:${name}`)) continue;
      seen.add(`${file}:${name}`);
      const owner = exporterOf(jail, name);
      if (owner) {
        let rel = posix(path.relative(path.dirname(file), owner.replace(/\.(tsx?|jsx?|mts|cts)$/, "").replace(/\/index$/, "")));
        if (!rel.startsWith(".")) rel = `./${rel}`;
        hints.push(`${file} line ${ln}: "${name}" isn't exported by "${spec}". It is exported by ${owner}, so import it from "${rel}" (keep the other names where they are).`);
      }
      continue;
    }
    const children = /^(\S+?)\((\d+),(\d+)\): error TS2322: .*Property 'children' does not exist/.exec(line);
    if (children) {
      const [, file, ln, col] = children;
      let tag = "";
      try {
        // TypeScript points at the component's name; if the file changed since, there is no hint rather than a wrong one.
        const text = fs.readFileSync(path.join(jail.root, file), "utf8").split(/\r?\n/)[Number(ln) - 1] ?? "";
        tag = /^([A-Z]\w*)/.exec(text.slice(Number(col) - 1))?.[1] ?? "";
      } catch {
        /* unreadable */
      }
      if (!tag || seen.has(`${file}:${tag}`)) continue;
      seen.add(`${file}:${tag}`);
      hints.push(`${file} line ${ln}: <${tag}> takes no children. Close it on that line with "/>", delete its closing </${tag}>, and put what was inside it after it, as a sibling.`);
    }
  }
  if (syntaxFiles.length)
    hints.push(`Fix the syntax errors (TS1…/TS17…) in ${syntaxFiles.join(", ")} first: an unclosed tag or brace causes many misleading errors after it. Re-run the type check only once the file parses, then fix the type errors.`);
  return hints;
}
