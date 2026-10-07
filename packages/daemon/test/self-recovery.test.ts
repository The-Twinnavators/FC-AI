import { describe, expect, it } from "vitest";
import { makeApp, makeProject } from "./helpers.js";
import { replaceUnpassableChecks } from "../src/orchestrator/orchestrator.js";

describe("self-recovery", () => {
  it("refuses a whole-file rewrite that looks cut off, but allows a stated removal", () => {
    const { app } = makeApp();
    const long = Array.from({ length: 120 }, (_, i) => `.rule-${i} { color: var(--c-${i}); }`).join("\n") + "\n";
    const { project, jail } = makeProject(app, { "src/styles/app.css": long });
    const ctx = { jail, projectId: project.id, runId: "run_rf", approved: true };
    const cut = long.slice(0, Math.floor(long.length * 0.4));
    expect(app.ops.replace_file(ctx, { path: "src/styles/app.css", content: cut, reason: "update styles" }).message).toMatch(/looks cut off/);
    expect(app.ops.replace_file(ctx, { path: "src/styles/app.css", content: cut, reason: "remove the unused rules" }).ok).toBe(true);
  });

  it("swaps a file_contains check that no project file could match for the type check", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "src/styles/tokens.css": ":root { --font-display: var(--font-sans); }\n" });
    const task = {
      id: "t1",
      acceptanceCriteria: [
        { id: "a", description: "invented", check: { type: "file_contains", path: "src/styles/tokens.css", text: "body { font-family: 'San', sans-serif; }" }, met: false, evidenceRefs: [] },
        { id: "b", description: "real", check: { type: "file_contains", path: "src/styles/tokens.css", text: "--font-display: var(--font-sans)" }, met: false, evidenceRefs: [] },
      ],
    } as never;
    const r = replaceUnpassableChecks(task, jail);
    expect(r.dropped).toEqual(["body { font-family: 'San', sans-serif; }"]);
    expect(r.criteria.map((c) => c.check.type)).toEqual(["file_contains", "verification"]);
  });
});

describe("removal checks", () => {
  it("reads removal wording as 'must not contain'", async () => {
    const { isRemovalWording } = await import("../src/quality/verification.js");
    expect(isRemovalWording("Dark mode media query removed")).toBe(true);
    expect(isRemovalWording("The app no longer uses a serif font")).toBe(true);
    expect(isRemovalWording("Light mode colors are applied")).toBe(false);
  });
});

describe("secret scan", () => {
  it("doesn't flag plain storage-key names, still flags secret-shaped values", async () => {
    const { onlyPlainNames } = await import("../src/quality/staticTriage.js");
    expect(onlyPlainNames('const KEY = "calendar.user";')).toBe(true);
    expect(onlyPlainNames("const STORE_KEY = 'fc.copilot.history.v2';")).toBe(true);
    expect(onlyPlainNames('const API_KEY = "sk-live-9fA83kQz7Lm2xVb6";')).toBe(false);
    expect(onlyPlainNames('const token = "ghp_A1b2C3d4E5f6G7h8I9j0";')).toBe(false);
  });
  it("doesn't flag code assigned to secret-sounding names, still flags literals inside calls", async () => {
    const { withoutCodeValues } = await import("../src/quality/staticTriage.js");
    const { redact } = await import("../src/security/redaction.js");
    const flagged = (l: string) => redact(withoutCodeValues(l)) !== withoutCodeValues(l);
    expect(flagged("export const AuthContext = createContext<AuthContextType | undefined>(undefined);")).toBe(false);
    expect(flagged("const token = useAuth();")).toBe(false);
    expect(flagged("const authHeader = this.headers.auth;")).toBe(false);
    expect(flagged('const apiKey = "abc123secretvalue";')).toBe(true);
    expect(flagged('const client = createClient({ apiKey: "sk-live-abcdefghijklmnopqrstuvwxyz" });')).toBe(true);
  });
  it("design scan uses the app's own tokens, skips spec attachments, allows !important for reduced motion", async () => {
    const { designQa } = await import("../src/quality/designQa.js");
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "spec/attachments/theme-tokens.css": ":root { --x: #123456; }\n.a { color: #ffffff !important; }\n",
      "src/styles/tokens.css": ":root { --color-text: #111111; --color-bg: #ffffff; }\n",
      "src/styles/app.css": ".b { color: var(--color-text); }\n@media (prefers-reduced-motion: reduce) {\n  * {\n    scroll-behavior: auto !important;\n  }\n}\n.c { color: red !important; background: #000; }\n",
    });
    const found = designQa(jail).filter((x) => ["raw-color", "important"].includes(x.rule ?? "")).map((x) => `${x.rule} ${x.path}:${x.line}`);
    expect(found).toEqual(["raw-color src/styles/app.css:7", "important src/styles/app.css:7"]);
  });
  it("gives the avoid-ai-slop design skill to interface work, not to unrelated fixes", async () => {
    const { BUILTIN_SKILLS, selectSkills } = await import("../src/knowledge/skills.js");
    const has = (role: string, text: string) => selectSkills(BUILTIN_SKILLS, role, text).some((s) => s.id === "skill.avoid-ai-slop");
    expect(has("planner", "Redesign the settings page layout")).toBe(true);
    expect(has("coder", "Add an empty state to the projects dashboard")).toBe(true);
    expect(has("critic", "Calendar app\ninterface design review")).toBe(true);
    expect(has("debugger", "Redesign the settings page layout")).toBe(false);
    expect(has("coder", "Fix the failing date parsing unit test")).toBe(false);
    // The skill follows its own copy rules (apart from the lines that name the banned words).
    const slop = BUILTIN_SKILLS.find((s) => s.id === "skill.avoid-ai-slop")!.instructions.split("\n").filter((l) => !/^- Don't use the words|^Never write:|Never write:/.test(l)).join("\n");
    expect(slop).not.toMatch(/\bensur|\benabl|\bfoster|comprehensive|—/i);
  });
  it("inventories reusable components and CSS classes, and briefs coding agents on them", async () => {
    const { scanComponentLibrary } = await import("../src/workspace/componentLibrary.js");
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "spec/attachments/ref.css": ".ref-only { color: red; }\n",
      "src/styles/app.css": ".button { padding: 4px; }\n.button--ghost { background: none; }\n.button--danger { color: red; }\n.field__input { border: 1px solid; }\n.unused-thing { color: blue; }\n",
      "src/components/Field.tsx": '/** A labelled text field. */\nexport function Field({ label, hint }: { label: string; hint?: string }) {\n  return <label className="field"><span>{label}</span><input className="field__input" /></label>;\n}\n',
      "src/App.tsx": 'import { Field } from "./components/Field";\nexport default function App() {\n  return <div><Field label="Name" /><button className="button button--ghost">Cancel</button><button className="button">Save</button></div>;\n}\n',
    });
    const lib = scanComponentLibrary(jail);
    expect(lib.components.map((c) => c.name)).toEqual(["Field"]);
    expect(lib.components[0]).toMatchObject({ uses: 1, summary: "A labelled text field.", props: [{ name: "label", optional: false }, { name: "hint", optional: true }] });
    const button = lib.primitives.find((p) => p.block === "button")!;
    expect(button.modifiers).toEqual(["ghost", "danger"]);
    expect(button.samples.map((x) => x.html)).toEqual(['<button class="button button--ghost">Cancel</button>', '<button class="button">Save</button>', '<button class="button button--danger">Save</button>']);
    expect(lib.primitives.some((p) => p.block === "unused-thing" || p.block === "ref-only")).toBe(false);
    expect(lib.cssFiles).toEqual(["src/styles/app.css"]);
    expect(lib.brief).toMatch(/Field \(src\/components\/Field\.tsx\): label, hint\?/);
    expect(lib.brief).toMatch(/\.button \(variants --ghost --danger\)/);
  });
  it("flags slogan copy in JSX text", async () => {
    const { designQa } = await import("../src/quality/designQa.js");
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "src/styles/tokens.css": ":root { --color-text: #111111; }\n",
      "src/Hero.tsx": "export const Hero = () => <h1>Everything you need to transform your workflow</h1>;\n",
      "src/Plain.tsx": "export const Plain = () => <h1>3 launch blockers need attention</h1>;\n",
    });
    expect(designQa(jail).filter((x) => x.rule === "filler-copy").map((x) => x.path)).toEqual(["src/Hero.tsx"]);
  });
  it("doesn't read React's children prop as a children's-data signal", async () => {
    const { withoutChildrenProp } = await import("../src/quality/staticTriage.js");
    const re = /\b(children|kids|under 13|coppa|parental consent)\b/i;
    expect(re.test(withoutChildrenProp("export function P({ children }: { children: ReactNode }) { return <div>{children}</div>; }"))).toBe(false);
    expect(re.test(withoutChildrenProp("const n = props.children;"))).toBe(false);
    expect(re.test(withoutChildrenProp("A homework planner for children and their parents."))).toBe(true);
  });
  it("flags SQL joined from strings, not HTTP verbs next to string joins", async () => {
    const { SECURITY_RULES } = await import("../src/quality/staticTriage.js");
    const re = SECURITY_RULES.find((r) => r.rule === "sql-concat")!.re;
    expect(re.test('return call<void>("DELETE", enc(collection) + "/" + enc(id));')).toBe(false);
    expect(re.test("db.prepare(LIST[sort]).all(collection, limit, offset)")).toBe(false);
    expect(re.test('db.prepare("SELECT * FROM t ORDER BY " + order)')).toBe(true);
    expect(re.test('db.query("DELETE FROM users WHERE id = " + id)')).toBe(true);
  });
});
