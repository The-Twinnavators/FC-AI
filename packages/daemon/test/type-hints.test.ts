/** FlowCode works out exact fixes for type errors small models loop on (No GMO App, Home screen step). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PathJail } from "../src/security/pathJail.js";
import { importFixes, typeErrorHints } from "../src/quality/typeHints.js";

function project(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-hints-"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return new PathJail(root);
}

describe("importFixes", () => {
  it("moves a name imported from the wrong module to the one that exports it (Calendar test 8 Field)", () => {
    const jail = project({
      "src/components/ui/index.tsx": "export function Button() { return null; }\nexport function Field() { return null; }\n",
      "src/components/ui/screen-parts.tsx": "export function Hero() { return null; }\n",
      "src/screens/AuthScreen.tsx": "import React from 'react';\nimport { Button } from '../components/ui';\nimport { Field } from '../components/ui/screen-parts';\nimport { useScreen } from '../lib/screens';\n",
      "src/screens/Other.tsx": "import { Hero, Field } from '../components/ui/screen-parts';\n",
    });
    const fixes = importFixes(jail, [
      `src/screens/AuthScreen.tsx(3,10): error TS2305: Module '"../components/ui/screen-parts"' has no exported member 'Field'.`,
      `src/screens/Other.tsx(1,16): error TS2305: Module '"../components/ui/screen-parts"' has no exported member 'Field'.`,
    ]);
    expect(fixes.get("src/screens/AuthScreen.tsx")).toBe("import React from 'react';\nimport { Button, Field } from '../components/ui';\nimport { useScreen } from '../lib/screens';\n");
    expect(fixes.get("src/screens/Other.tsx")).toBe("import { Hero } from '../components/ui/screen-parts';\nimport { Field } from '../components/ui';\n");
  });
});

describe("type error hints", () => {
  it("tells a screen to take onNavigate instead of calling useScreen, and leaves Field child functions untyped (Calendar test 8)", () => {
    const jail = project({
      "src/screens/AuthScreen.tsx": "import { useScreen } from '../lib/screens';\nexport const AuthScreen = () => {\n  const screen = useScreen();\n  screen.goTo('calendar');\n  return <Field label=\"Email\">\n    {(props) => <input {...props} />}\n  </Field>;\n};\n",
    });
    const hints = typeErrorHints(jail, [
      "src/screens/AuthScreen.tsx(3,18): error TS2554: Expected 1 arguments, but got 0.",
      "src/screens/AuthScreen.tsx(4,10): error TS2339: Property 'goTo' does not exist on type '[string, (id: string) => void]'.",
      "src/screens/AuthScreen.tsx(6,6): error TS7006: Parameter 'props' implicitly has an 'any' type.",
    ]);
    expect(hints).toHaveLength(2);
    expect(hints[0]).toContain("`const [, go] = useScreen(SCREEN_IDS);`");
    expect(hints[1]).toContain("Don't give it a type");
  });

  it("says what to write when an older app's tests use jest-dom matchers, and how to use Field", () => {
    // No BIO & GMO build: toBeInTheDocument in an app made before the kit had jest-dom; input props put on <Field>.
    const jail = project({ "src/acceptance/brands.test.tsx": "it('x', () => {});\n", "src/screens/Brands.tsx": "export const B = () => null;\n" });
    const hints = typeErrorHints(jail, [
      "src/acceptance/brands.test.tsx(18,50): error TS2339: Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'.",
      "src/acceptance/brands.test.tsx(22,50): error TS2339: Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'.",
      "src/screens/Brands.tsx(81,13): error TS2322: Type '{ type: string; placeholder: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement, Element>) => void; label: string; }' is not assignable to type 'IntrinsicAttributes'.",
    ]);
    expect(hints).toHaveLength(2);
    expect(hints[0]).toMatch(/don't have the jest-dom matchers .*expect\(screen\.queryByText\("…"\)\)\.toBeNull\(\)/s);
    expect(hints[1]).toMatch(/<Field> takes a function as its child/);
  });

  it("gives the right import path when a relative import points to nothing", () => {
    const jail = project({ "src/App.tsx": `import { useScreen } from "../lib/screens";\n`, "src/lib/screens.ts": "export const useScreen = () => 1;\n", "src/screens/Home.tsx": `import { useScreen } from "./lib/screens";\n` });
    const hints = typeErrorHints(jail, [
      "src/App.tsx(1,27): error TS2307: Cannot find module '../lib/screens' or its corresponding type declarations.",
      "src/screens/Home.tsx(1,27): error TS2307: Cannot find module './lib/screens' or its corresponding type declarations.",
    ]);
    expect(hints).toEqual([
      'src/App.tsx line 1: "../lib/screens" points to nothing. The file is src/lib/screens.ts, so import it from "./lib/screens". Change only that path.',
      'src/screens/Home.tsx line 1: "./lib/screens" points to nothing. The file is src/lib/screens.ts, so import it from "../lib/screens". Change only that path.',
    ]);
  });

  it("removes one unused name from an import without dropping the names still used", () => {
    const jail = project({ "src/Week.tsx": `import { useState, useEffect } from "react";\nimport { format } from "date-fns";\n` });
    expect(typeErrorHints(jail, ["src/Week.tsx(1,10): error TS6133: 'useState' is declared but its value is never read."])).toEqual([
      'src/Week.tsx line 1 is `import { useState, useEffect } from "react";`: only "useState" is unused. Remove just "useState" from that import and keep "useEffect"; don\'t delete the whole line.',
    ]);
    expect(typeErrorHints(jail, ["src/Week.tsx(2,10): error TS6133: 'format' is declared but its value is never read."])[0]).toMatch(/Delete that whole line/);
  });

  it("shows the AppShell shape, keeps App prop-less and explains <link to>", () => {
    const jail = project({
      "src/App.tsx": `import { AppShell } from "./components/ui";\nexport default function App({ screens }: { screens: string[] } = {}) {\n  return (\n    <AppShell>\n      <link to="x" />\n    </AppShell>\n  );\n}\n`,
      "src/main.tsx": `import App from "./App";\nconst x = (\n  <App />\n);\n`,
    });
    const hints = typeErrorHints(jail, [
      "src/App.tsx(2,29): error TS2739: Type '{}' is missing the following properties from type '{ screens: string[]; }': screens",
      "src/App.tsx(4,6): error TS2739: Type '{ children: Element; }' is missing the following properties from type '{ name: string; }': name, screens, current, onNavigate",
      "src/App.tsx(5,13): error TS2322: Type '{ to: string; }' is not assignable to type 'DetailedHTMLProps<LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>'. Property 'to' does not exist on type 'DetailedHTMLProps<LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>'.",
      "src/main.tsx(3,4): error TS2739: Type '{}' is missing the following properties from type '{ screens: string[]; }': screens",
    ]);
    expect(hints[0]).toMatch(/App is the root/);
    expect(hints[1]).toMatch(/<AppShell> needs name, screens, current, onNavigate[\s\S]*useScreen\(SCREEN_IDS\)/);
    expect(hints.some((h) => /<link to=…> isn't a navigation link/.test(h))).toBe(true);
    expect(hints.filter((h) => /App is the root/.test(h))).toHaveLength(2);
  });

  it("gives the exact type to write for a DOM Event mix-up and an undefined type (Calendar test 7 loop)", () => {
    const jail = project({ "src/Day.tsx": `import { useState } from "react";\nfunction Day() {\n  const [events, setEvents] = useState<CalendarEvent[]>([]);\n}\n` });
    const undefinedType = typeErrorHints(jail, ["src/Day.tsx(3,40): error TS2304: Cannot find name 'CalendarEvent'."])[0];
    expect(undefinedType).toMatch(/isn't defined anywhere[\s\S]*interface CalendarEvent \{\n {2}id: string;/);
    expect(undefinedType).not.toMatch(/doesn't exist anywhere in the project yet/);
    const dom = typeErrorHints(jail, ["src/Day.tsx(9,27): error TS2339: Property 'id' does not exist on type 'Event'."])[0];
    expect(dom).toMatch(/DOM Event type[\s\S]*interface CalendarEvent[\s\S]*useState<CalendarEvent\[\]>/);
  });

  it("types event handlers instead of reading value from EventTarget", () => {
    const jail = project({ "src/C.tsx": "x\n" });
    expect(typeErrorHints(jail, ["src/C.tsx(35,53): error TS2339: Property 'value' does not exist on type 'EventTarget'."])[0]).toMatch(/e.currentTarget.value/);
  });

  it("says what to do with a router import and with half-used useState pairs", () => {
    const jail = project({ "src/List.tsx": `import { useState } from "react";\nimport { useNavigate } from "react-router-dom";\nconst [error, setError] = useState("");\nconst [events, setEvents] = useState([]);\n` });
    const hints = typeErrorHints(jail, [
      "src/List.tsx(2,29): error TS2307: Cannot find module 'react-router-dom' or its corresponding type declarations.",
      "src/List.tsx(3,17): error TS6133: 'setError' is declared but its value is never read.",
      "src/List.tsx(4,8): error TS6133: 'events' is declared but its value is never read.",
    ]);
    expect(hints[0]).toMatch(/can't be added.*onNavigate/);
    expect(hints[1]).toMatch(/keep only the value: `const \[error\] = …`/);
    expect(hints[2]).toMatch(/set but never shown.*every setEvents\(\.\.\.\) call/);
  });

  it("points a wrongly imported name at the file that exports it, and finds a file one extension away", async () => {
    const { nearestFile } = await import("../src/quality/typeHints.js");
    const jail = project({ "src/App.tsx": `import { AppShell, useScreen } from "./components/ui";\n`, "src/components/ui/index.tsx": "export function AppShell() {}\n", "src/lib/screens.ts": "export function useScreen() {}\n" });
    expect(typeErrorHints(jail, [`src/App.tsx(1,20): error TS2724: '"./components/ui"' has no exported member named 'useScreen'. Did you mean 'Screen'?`])).toEqual([
      'src/App.tsx line 1: "useScreen" isn\'t exported by "./components/ui". It is exported by src/lib/screens.ts, so import it from "./lib/screens" (keep the other names where they are).',
    ]);
    expect(nearestFile(jail, "./components/ui/index.ts")).toBe("src/components/ui/index.tsx");
    expect(nearestFile(jail, "src/nothing.ts")).toBeUndefined();
  });

  it("says which component takes no children, and stays quiet when the file has moved on", () => {
    const jail = project({ "src/App.tsx": `export default () => (\n  <main>\n    <PageHeader title="x">\n      <Section title="y" />\n    </PageHeader>\n  </main>\n);\n` });
    const err = "src/App.tsx(3,6): error TS2322: Type '{ children: Element; title: string; }' is not assignable to type 'IntrinsicAttributes & { title: string; }'. Property 'children' does not exist on type 'IntrinsicAttributes & { title: string; }'.";
    expect(typeErrorHints(jail, [err])).toEqual(['src/App.tsx line 3: <PageHeader> takes no children. Close it on that line with "/>", delete its closing </PageHeader>, and put what was inside it after it, as a sibling.']);
    expect(typeErrorHints(jail, [err.replace("(3,6)", "(4,1)")])).toEqual([]);
  });
});

describe("kit protection and cover-ups", () => {
  it("refuses @ts-ignore and new imports in the kit, and says to delete a kit line that breaks the build", async () => {
    const { coverUpEdit } = await import("../src/orchestrator/guards.js");
    expect(coverUpEdit("src/App.tsx", "const a = 1;\n", "// @ts-ignore\nconst a = 1;\n")).toMatch(/hides the type error/);
    expect(coverUpEdit("src/App.tsx", "// @ts-ignore\nconst a = 1;\n", "// @ts-ignore\nconst a = 2;\n")).toBeUndefined();
    const kit = 'import { useId } from "react";\nexport * from "./screen-parts";\n';
    expect(coverUpEdit("src/components/ui/index.tsx", kit, `${kit}import { useScreen } from "./screen-parts";\n`)).toMatch(/starter kit's building-block file[\s\S]*src\/App\.tsx: import \{ useScreen \} from "\.\/lib\/screens"/);
    expect(coverUpEdit("src/components/ui/index.tsx", kit, kit.replace("useId", "useId, useRef"))).toBeUndefined();
    expect(coverUpEdit("src/components/ui/index.tsx", kit, `${kit}import { dates } from "../../lib/dates";
`)).toMatch(/don.t add imports/);
    expect(coverUpEdit("src/screens/Home.tsx", "", 'import { x } from "../lib/x";\n')).toBeUndefined();
    const jail = project({ "src/components/ui/index.tsx": kit });
    expect(typeErrorHints(jail, ["src/components/ui/index.tsx(24,10): error TS2305: Module '\"./screen-parts\"' has no exported member 'useScreen'."])[0]).toMatch(/Delete line 24/);
  });
});

describe("Calendar test 6 mistakes", () => {
  it("rewrites broken JSX whole, gives the missing kit import, and keeps routers out of the starter", async () => {
    const jail = project({ "src/App.tsx": "export default function App() { return <AppShell /> }\n", "src/components/ui/index.tsx": "export function AppShell() { return null; }\n", "src/lib/screens.ts": "export function useScreen() {}\n", "package.json": '{ "name": "x", "version": "1.0.0", "dependencies": {} }\n' });
    const hints = typeErrorHints(jail, ["src/App.tsx(12,7): error TS17002: Expected corresponding JSX closing tag for 'AppShell'.", "src/App.tsx(3,6): error TS2304: Cannot find name 'AppShell'."]);
    expect(hints[0]).toMatch(/JSX structure is broken[\s\S]*replace_file[\s\S]*ONE root element/);
    expect(hints[1]).toBe('src/App.tsx line 3: "AppShell" isn\'t imported. Add it to the imports at the top: import { AppShell } from "./components/ui";');
  });
});

describe("project-root import paths", () => {
  it("turns src/… and @/… imports into the right relative path", () => {
    const jail = project({ "src/App.tsx": `import { useScreen } from "src/lib/screens";\n`, "src/lib/screens.ts": "export function useScreen() {}\n" });
    expect(typeErrorHints(jail, ["src/App.tsx(1,27): error TS2307: Cannot find module 'src/lib/screens' or its corresponding type declarations."])[0]).toMatch(/import it from "\.\/lib\/screens"/);
    expect(typeErrorHints(jail, ["src/App.tsx(1,27): error TS2307: Cannot find module '@/lib/screens' or its corresponding type declarations."])[0]).toMatch(/import it from "\.\/lib\/screens"/);
  });
});

describe("Calendar test 6, month view step", () => {
  it("plans .tsx/.ts files in a TypeScript project and keeps React Native out of a web app", async () => {
    const { toTsPath, toTsText, nativeInWebApp } = await import("../src/orchestrator/guards.js");
    expect(toTsPath("src/components/CalendarMonth.js")).toBe("src/components/CalendarMonth.tsx");
    expect(toTsPath("src/screens/AuthScreen.js")).toBe("src/screens/AuthScreen.tsx");
    expect(toTsPath("src/lib/eventStorage.js")).toBe("src/lib/eventStorage.ts");
    expect(toTsPath("vite.config.js")).toBe("vite.config.js");
    expect(toTsText("Implement month view with 6-week grid in CalendarMonth.js")).toBe("Implement month view with 6-week grid in CalendarMonth.tsx");
    expect(toTsText("src/lib/dates.js exists; eslint.config.js stays")).toBe("src/lib/dates.ts exists; eslint.config.js stays");
    expect(nativeInWebApp("src/components/CalendarMonth.tsx", "import { View } from 'react-native';\nimport { Calendar } from 'react-native-calendars';\n")).toMatch(/React Native \(mobile\)[\s\S]*web app/);
    expect(nativeInWebApp("src/components/CalendarMonth.tsx", 'import { Button } from "../components/ui";\n')).toBeUndefined();
  });
});

describe("lint parse errors from .js files with JSX", () => {
  it("says to rename each one to .tsx with move_file", () => {
    const jail = project({ "src/screens/AuthScreen.js": "export default () => <div />;\n" });
    const abs = path.join(jail.root, "src", "screens", "AuthScreen.js");
    const hints = typeErrorHints(jail, [abs, "  38:5  error  Parsing error: Unexpected token <", "", "✖ 1 problem (1 error, 0 warnings)"]);
    expect(hints).toEqual(['src/screens/AuthScreen.js contains JSX but is a .js file, which the linter can\'t parse in this TypeScript project. Rename it with move_file from "src/screens/AuthScreen.js" to "src/screens/AuthScreen.tsx". Imports without an extension keep working; fix any that end in ".js".']);
  });
});

describe("building blocks from another UI library", () => {
  it("names the ones that don't exist and shows how the kit's Dialog is used", async () => {
    const { buildingBlockImports } = await import("../src/orchestrator/guards.js");
    const msg = buildingBlockImports("src/screens/Calendar/EventCreationDialog.tsx", 'import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";\n');
    expect(msg).toMatch(/DialogContent, DialogHeader aren't building blocks[\s\S]*<Dialog open=\{open\} title=[\s\S]*Import from "\.\.\/\.\.\/components\/ui"/);
  });
});

describe("month view step errors", () => {
  it("says to drop an import of a component no step has built yet, and types untyped props", () => {
    const jail = project({ "src/components/CalendarMonth.tsx": "" });
    const hints = typeErrorHints(jail, [
      "src/components/CalendarMonth.tsx(3,30): error TS2307: Cannot find module './CalendarWeek' or its corresponding type declarations.",
      "src/components/CalendarMonth.tsx(5,33): error TS7031: Binding element 'currentDate' implicitly has an 'any' type.",
      "src/components/CalendarMonth.tsx(5,46): error TS7031: Binding element 'onDateSelect' implicitly has an 'any' type.",
    ]);
    expect(hints[0]).toMatch(/"\.\/CalendarWeek" doesn't exist in the project yet[\s\S]*Remove that import/);
    expect(hints[1]).toBe("src/components/CalendarMonth.tsx line 5: the component's props have no type. Give them one on that line, e.g. ({ currentDate, onDateSelect }: { currentDate: Date; onDateSelect: (value: Date) => void }), adjusting the types to what you pass in.");
  });
});

describe("unused imports and .tsx scope", () => {
  it("shows the unused import line to delete, and treats the .tsx of a planned .js as in scope", async () => {
    const jail = project({ "src/components/CalendarMonth.tsx": 'import { useState } from "react";\nimport { Card, Button } from "../components/ui";\n' });
    expect(typeErrorHints(jail, ["src/components/CalendarMonth.tsx(2,1): error TS6192: All imports in import declaration are unused."])[0]).toBe('src/components/CalendarMonth.tsx line 2 is `import { Card, Button } from "../components/ui";`: nothing it imports is used. Delete that whole line (find it exactly as shown, replace with nothing).');
    const { inScope } = await import("../src/orchestrator/tools.js");
    const task = { expectedPaths: ["src/components/CalendarMonth.js"] } as never;
    expect(inScope(task, "src/components/CalendarMonth.tsx")).toBe(true);
    expect(inScope(task, "src/components/CalendarWeek.tsx")).toBe(false);
  });
});

describe("components nothing defines yet", () => {
  it("says to stop using them", () => {
    const jail = project({ "src/components/CalendarMonth.tsx": "" });
    expect(typeErrorHints(jail, ["src/components/CalendarMonth.tsx(33,16): error TS2304: Cannot find name 'CalendarWeek'."])[0]).toMatch(/<CalendarWeek> doesn't exist anywhere in the project yet[\s\S]*remove it/);
  });
});

describe("props a component doesn't accept", () => {
  it("names the component, what it accepts and the two ways to make them agree", () => {
    const jail = project({ "src/components/CalendarMonth.tsx": "x\n".repeat(38) + "                  <CalendarWeek day={d} selectedDate={s} onDateSelect={f} />\n" });
    const h = typeErrorHints(jail, ["src/components/CalendarMonth.tsx(39,19): error TS2322: Type '{ day: Date; selectedDate: Date; }' is not assignable to type 'IntrinsicAttributes & { day: Date; }'. Property 'selectedDate' does not exist on type 'IntrinsicAttributes & { day: Date; }'."]);
    expect(h[0]).toBe('src/components/CalendarMonth.tsx line 39: <CalendarWeek> only accepts { day: Date; }, not "selectedDate". Either stop passing selectedDate, or add it to that component\'s props type (and use it there). Change one side so both agree.');
  });
});

describe("leftover .js files with JSX", () => {
  it("are found for FlowCode to rename, and 'rename them' isn't a reason to stop", async () => {
    const { jsxInJsFiles } = await import("../src/orchestrator/guards.js");
    const jail = project({ "src/screens/AuthScreen.js": "export default () => <div>Sign in</div>;\n", "src/lib/dates.js": "export const x = 1;\n", "src/components/Old.js": "export const A = () => <Card />;\n", "src/components/Old.tsx": "x" });
    expect(jsxInJsFiles(jail.root)).toEqual(["src/screens/AuthScreen.js"]);
    const { selfBlockIsWork } = await import("../src/orchestrator/stepRecovery.js");
    expect(selfBlockIsWork("The lint failed because JSX files are named .js instead of .tsx; rename them to fix the error.")).toMatch(/move_file/);
  });
});

describe("untyped state and parameters", () => {
  it("says to type useState([]) and untyped parameters", () => {
    const jail = project({ "src/components/CalendarMonth.tsx": "const x = 1;\n  const [weeks, setWeeks] = useState([]);\n" });
    const h = typeErrorHints(jail, [
      "src/components/CalendarMonth.tsx(52,14): error TS2345: Argument of type '(Date | null)[][]' is not assignable to parameter of type 'SetStateAction<never[]>'.",
      "src/components/CalendarMonth.tsx(85,27): error TS2339: Property 'map' does not exist on type 'never'.",
      "src/components/CalendarMonth.tsx(65,29): error TS7006: Parameter 'date' implicitly has an 'any' type.",
    ]);
    expect(h).toHaveLength(2);
    expect(h[0]).toMatch(/useState\(\[\]\)[\s\S]*change `const \[weeks, setWeeks\] = useState\(\[\]\);`[\s\S]*useState<YourType\[\]>/);
    expect(h[1]).toBe('src/components/CalendarMonth.tsx line 65: give the parameter "date" a type, e.g. (date: Date) => …');
  });
});

describe("names TypeScript suggests, clashes and the rewrite way out", () => {
  it("uses the suggested name, resolves import/local clashes, and allows a rewrite after two misses", async () => {
    const jail = project({ "src/components/CalendarMonth.tsx": "" });
    const h = typeErrorHints(jail, [
      "src/components/CalendarMonth.tsx(2,10): error TS2724: '\"../lib/dates\"' has no exported member named 'formatDisplay'. Did you mean 'formatDisplayDate'?",
      "src/components/CalendarMonth.tsx(2,10): error TS2440: Import declaration conflicts with local declaration of 'formatDisplay'.",
    ]);
    expect(h[0]).toMatch(/"formatDisplay" doesn't exist; the real name is "formatDisplayDate"/);
    expect(h[1]).toMatch(/"formatDisplay" is both imported \(line 2\) and defined in this file. Keep one/);
    const { editGuard } = await import("../src/orchestrator/guards.js");
    const before = Array.from({ length: 140 }, (_, i) => `const v${i} = ${i};`).join("\n");
    const after = before.replace("const v1 = 1;", "const v1 = 2;").replace("const v2 = 2;", "const v2 = 3;").replace("const v3 = 3;", "const v3 = 4;").replace("const v4 = 4;", "const v4 = 5;");
    expect(editGuard("replace_file", "src/a.ts", before, { content: after }, { patchMisses: 0 })).toMatch(/rewrites all 140 lines/);
    expect(editGuard("replace_file", "src/a.ts", before, { content: after }, { patchMisses: 2 })).toBeUndefined();
  });
});

describe("which file an error belongs to", () => {
  it("reads the file from tsc and eslint-style lines", async () => {
    const { errorFile } = await import("../src/quality/verification.js");
    expect(errorFile("src/screens/AuthScreen.tsx(11,38): error TS7006: Parameter 'e' implicitly has an 'any' type.")).toBe("src/screens/AuthScreen.tsx");
    expect(errorFile("C:/work/cal/src/components/CalendarMonth.tsx:23:5 error Parsing error")).toBe("src/components/CalendarMonth.tsx");
    expect(errorFile(String.raw`C:\work\cal\src\components\CalendarMonth.tsx:23:5 error Parsing error`)).toBe("src/components/CalendarMonth.tsx");
    expect(errorFile("Found 3 errors in 2 files.")).toBeUndefined();
  });
});
