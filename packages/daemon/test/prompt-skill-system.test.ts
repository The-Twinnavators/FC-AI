/** The agent prompt, skill and specification system: classification, its skills, templates and the definition of done. */
import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";
import { describe, expect, it } from "vitest";
import { PRD_TEMPLATES, prdTemplate } from "@flowcode/contracts";
import { buildGuidance, classifyRequest } from "../src/orchestrator/classify.js";
import { BUILTIN_SKILLS, selectSkills } from "../src/knowledge/skills.js";
import { definitionOfDone } from "../src/reports/definitionOfDone.js";

describe("skills per step", () => {
  it("caps a step at five skills: best matches, then the stack, then always-on (built-in before learned)", async () => {
    const { capSkills, MAX_SKILLS_PER_STEP } = await import("../src/knowledge/skills.js");
    const learned = Array.from({ length: 8 }, (_, i) => ({ ...BUILTIN_SKILLS[0], id: `skill.proposed-fix-${i}`, source: "user" as const, roles: ["coder"], triggers: ["*"], purpose: i === 7 ? "Fixes navigation patches that miss" : `Helps with thing ${i}` }));
    const library = [...BUILTIN_SKILLS, ...learned];
    const picked = selectSkills(library, "coder", "Implement the Navigation Structure with an app shell and navigation");
    // Learned always-on fixes: the one closest to the task comes first.
    expect(picked.filter((s) => s.id.startsWith("skill.proposed-fix-"))[0].id).toBe("skill.proposed-fix-7");
    const stack = [BUILTIN_SKILLS.find((s) => s.id === "skill.angular")!];
    const capped = capSkills(picked, stack);
    expect(MAX_SKILLS_PER_STEP).toBe(5);
    expect(capped).toHaveLength(5);
    // The task's own matches come first and the stack skill survives the cap.
    expect(capped.some((s) => s.id === "skill.app-layout-navigation")).toBe(true);
    expect(capped.some((s) => s.id === "skill.angular")).toBe(true);
    expect(capped.filter((s) => s.id.startsWith("skill.proposed-fix-")).length).toBeLessThan(learned.length);
  });
});

describe("request classification", () => {
  it("follows the concept map", () => {
    const hero = classifyRequest("Add a parallax hero to the landing page with three layers");
    expect(hero).toMatchObject({ primary: "saved_prompt", concepts: ["Parallax or scroll story"], specNeeded: false });
    expect(hero.skills).toEqual(expect.arrayContaining(["skill.scroll-motion-parallax", "skill.audit-accessibility", "skill.visual-qa-verification"]));

    const sim = classifyRequest("Build a workflow simulator for our support team's ticket process");
    expect(sim).toMatchObject({ primary: "feature_spec", specNeeded: true });
    expect(sim.skills).toEqual(expect.arrayContaining(["skill.svg-workflow-visualization", "skill.data-simulation-scenarios"]));
    expect(sim.note).toMatch(/feature spec/);

    expect(classifyRequest("Build a financial strategy lab for comparing retirement plans").primary).toBe("product_spec");
    expect(classifyRequest("Add an AI review queue where reviewers approve generated summaries").skills).toContain("skill.ai-assisted-workflow");
    expect(classifyRequest("Show a 3D product explainer with three.js").skills).toContain("skill.threejs-experience");
  });

  it("calls a small change a small change, and steps up when lasting data is involved", () => {
    expect(classifyRequest("Change the accent colour to a darker teal")).toMatchObject({ primary: "task_note", specNeeded: false });
    const timeline = classifyRequest("Add an interactive timeline where users can save their own events and share them");
    expect(timeline.specNeeded).toBe(true);
    expect(timeline.skills).toContain("skill.database-backed-feature");
  });

  it("knows when a spec is already attached", () => {
    const c = classifyRequest("Build a workflow simulator", { referenceRoles: ["prd"] });
    expect(c).toMatchObject({ specNeeded: true, specAttached: true, note: "Built to the attached spec." });
  });

  it("reads the attached PRD and picks the build prompts on its own", () => {
    const prd = "# Studio site\n\n## Home\nThe hero uses a parallax effect with three layers as you scroll. A before/after slider shows a renovated room.\nWe may add AI summaries later and a timeline of past projects.";
    const c = classifyRequest("Build the site in the attached PRD.", { referenceRoles: ["prd"], prd });
    expect(c.concepts).toEqual(expect.arrayContaining(["Parallax or scroll story", "Before/after slider"]));
    expect(c.prompts).toEqual(expect.arrayContaining(["parallax-scroll", "before-after-slider"]));
    expect(c.skills).toContain("skill.scroll-motion-parallax");
    // Loose words in a long PRD (AI, timeline) don't pull in their skills; only the request itself can.
    expect(c.concepts).not.toContain("AI feature");
    expect(c.concepts).not.toContain("Interactive control");
    expect(classifyRequest("Add AI summaries to each ticket").concepts).toContain("AI feature");
  });

  it("adds the new-feature prompt for spec-sized work and nothing for small changes", () => {
    expect(classifyRequest("Build a workflow simulator for our support team").prompts).toEqual(expect.arrayContaining(["plan-new-feature", "workflow-simulator"]));
    expect(classifyRequest("Change the accent colour to a darker teal").prompts).toEqual([]);
  });

  it("turns build prompts into planner guidance without the fill-in placeholders", () => {
    const g = buildGuidance(["parallax-scroll"]);
    expect(g).toMatch(/^Build guidance/);
    expect(g).not.toMatch(/\[[A-Z]/);
    expect(g.split("\n").length).toBeGreaterThan(3);
    expect(buildGuidance([])).toBe("");
    expect(buildGuidance(["no-such-prompt"])).toBe("");
  });
});

describe("the system's skills", () => {
  const ids = ["skill.feature-discovery-mvp", "skill.scroll-motion-parallax", "skill.interactive-ui-concept", "skill.svg-workflow-visualization", "skill.data-simulation-scenarios", "skill.threejs-experience", "skill.database-backed-feature", "skill.ai-assisted-workflow", "skill.visual-qa-verification", "skill.audit-accessibility"];

  it("are all in the library, follow the copy rules, and don't duplicate the accessibility skill", () => {
    for (const id of ids) {
      const s = BUILTIN_SKILLS.find((x) => x.id === id);
      expect(s, id).toBeDefined();
      expect(s!.instructions, id).not.toMatch(/\b(ensure|enable|foster|comprehensive)\w*\b|—/i);
      expect(s!.purpose, id).not.toMatch(/—/);
    }
    expect(BUILTIN_SKILLS.filter((s) => /accessib|a11y/i.test(s.id)).map((s) => s.id)).toEqual(["skill.audit-accessibility"]);
    expect(BUILTIN_SKILLS.find((s) => s.id === "skill.audit-accessibility")!.version).toBe("1.1.0");
  });

  it("match the work they're for and stay out of unrelated tasks", () => {
    const pick = (role: string, text: string) => selectSkills(BUILTIN_SKILLS, role, text).map((s) => s.id);
    expect(pick("coder", "Build the scroll story section with pinned panels")).toContain("skill.scroll-motion-parallax");
    expect(pick("coder", "Render the approval workflow as a flowchart")).toContain("skill.svg-workflow-visualization");
    expect(pick("planner", "Plan the new dashboard feature")).toContain("skill.feature-discovery-mvp");
    const plain = pick("coder", "Rename the getTotal function to sumTotals in src/lib/math.ts");
    for (const id of ids.slice(1, 9)) expect(plain).not.toContain(id);
  });
});

describe("PRD templates from the system", () => {
  it("adds the interactive, simulation, AI and product templates, and every template has phases and testing", () => {
    expect(PRD_TEMPLATES.map((t) => t.id)).toEqual(expect.arrayContaining(["interactive", "simulation", "ai-feature", "product"]));
    for (const t of PRD_TEMPLATES) {
      const md = prdTemplate(t.id);
      expect(md, t.id).toMatch(/## \d+\. MVP and later phases/);
      expect(md, t.id).toMatch(/## \d+\. Testing and verification/);
    }
    expect(prdTemplate("interactive")).toMatch(/## \d+\. Reduced motion/);
    expect(prdTemplate("product")).toMatch(/^# Product spec: /);
  });
});

describe("definition of done", () => {
  const base = {
    classification: classifyRequest("Add a parallax hero to the landing page"),
    planApproved: true,
    skillsApplied: ["skill.scroll-motion-parallax", "skill.audit-accessibility", "skill.visual-qa-verification"],
    approvals: [],
    verification: ["typecheck", "lint", "tests", "build", "preview_health", "screenshots", "accessibility", "design_qa"].map((kind) => ({ kind, status: "passed", required: true })),
    filesChanged: ["src/components/Hero.tsx", "src/styles/app.css"],
    hasPreview: true,
  };
  const status = (items: ReturnType<typeof definitionOfDone>, start: string) => items.find((i) => i.item.startsWith(start))!.status;

  it("is met where the run recorded it, and leaves keyboard and motion to a person", () => {
    const d = definitionOfDone(base);
    expect(d).toHaveLength(9);
    expect(status(d, "The request was classified")).toBe("met");
    expect(status(d, "Type check, lint")).toBe("met");
    expect(status(d, "The changed screens")).toBe("met");
    expect(status(d, "Accessibility, keyboard")).toBe("not_checked");
  });

  it("says what failed, what was skipped, and what to review", () => {
    const d = definitionOfDone({
      ...base,
      planApproved: false,
      skillsApplied: [],
      verification: [{ kind: "typecheck", status: "failed", required: true }, { kind: "lint", status: "not_run", required: true }],
      filesChanged: ["package.json", "prisma/migrations/001/migration.sql"],
    });
    expect(status(d, "The work stayed")).toBe("not_met");
    expect(status(d, "Relevant skills")).toBe("not_met");
    expect(d.find((i) => i.item.startsWith("Type check"))!.detail).toMatch(/Failed: typecheck\. Didn't run: lint\./);
    expect(d.find((i) => i.item.startsWith("No unrequested"))!.detail).toMatch(/package\.json, prisma\/migrations/);
  });
});

describe("project rules, role prompts and request templates", () => {
  it("gives every coding step the project rules, whatever the task", async () => {
    for (const role of ["coder", "debugger"]) expect(selectSkills(BUILTIN_SKILLS, role, "Rename a variable").map((s) => s.id)).toContain("skill.project-rules");
    expect(selectSkills(BUILTIN_SKILLS, "planner", "Rename a variable").map((s) => s.id)).not.toContain("skill.project-rules");
    const { ROLE_PROMPTS } = await import("../src/orchestrator/prompts.js");
    const v = Object.fromEntries(ROLE_PROMPTS.map((p) => [p.id, p]));
    expect(v["role.planner"].version).toBe("1.7.0");
    // Builds are prototypes: planner and coder both get the rules.
    for (const id of ["role.planner", "role.coder"]) expect(v[id].template).toMatch(/clickable PROTOTYPE[\s\S]*src\/sim/);
    expect(v["role.planner"].template).toMatch(/Not in this build/);
    expect(v["role.coder"].template).toMatch(/Inspect before editing/);
    expect(v["role.debugger"].template).toMatch(/never claim a result you have not seen/);
  });

  it("templates name real skills, bring them in from their own wording, and follow the copy rules", async () => {
    const { REQUEST_TEMPLATES } = await import("@flowcode/contracts");
    expect(REQUEST_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    const ids = new Set(BUILTIN_SKILLS.map((s) => s.id));
    for (const t of REQUEST_TEMPLATES) {
      for (const s of t.skills) expect(ids.has(s), `${t.id}: ${s}`).toBe(true);
      expect(t.body, t.id).not.toMatch(/\b(ensure|enable|foster|comprehensive)\w*\b|—/i);
      const cls = classifyRequest(t.body);
      const main = t.skills.filter((s) => s !== "skill.audit-accessibility" && s !== "skill.database-backed-feature" && s !== "skill.feature-discovery-mvp");
      for (const s of main) expect(cls.skills, `${t.id} should bring in ${s}`).toContain(s);
    }
    expect(BUILTIN_SKILLS.find((s) => s.id === "skill.project-rules")!.instructions).not.toMatch(/\b(ensure|enable|foster|comprehensive)\w*\b|—/i);
  });
});

describe("spec build plans", () => {
  it("give every runtime-added task its verification list, so cleaning up the plan can't crash", async () => {
    const { assembleTask, specFallbackTasks } = await import("../src/orchestrator/templates.js");
    for (const id of [undefined, "angular-starter"]) {
      const tasks = [...specFallbackTasks([{ name: "prd.md", role: "prd", content: "# App" } as never], id), assembleTask(["features"], id)];
      for (const t of tasks) expect(Array.isArray(t.verification), `${id ?? "react"}: ${t.key}`).toBe(true);
    }
  });
});

describe("commands FlowCode runs", () => {
  it("trust the operating system's certificates, so antivirus HTTPS scanning doesn't break npm installs", async () => {
    const { scrubbedEnv } = await import("../src/commands/runner.js");
    const saved = process.env.NODE_USE_SYSTEM_CA;
    delete process.env.NODE_USE_SYSTEM_CA;
    try {
      expect(scrubbedEnv().NODE_USE_SYSTEM_CA).toBe("1");
    } finally {
      if (saved !== undefined) process.env.NODE_USE_SYSTEM_CA = saved;
    }
  });
});

describe("a scaffolded starter becomes the product in the PRD", () => {
  const prd = [
    "# Lantern — PRD",
    "",
    "**Lantern** is a calm reading tracker that helps adults finish the books they start.",
    "",
    "## Goals",
    "Readers log a session in under ten seconds and see their Reading Streak grow. The Reading Streak resets gently.",
    "Each Shelf Card shows progress, and the Reading Streak and Shelf Card appear on the home screen with the Shelf Card list.",
    "",
    "## Visual direction",
    "| Token | Hex | Use |",
    "|---|---|---|",
    "| `paper-50` | `#FBF8F2` | Canvas background |",
    "| `card-100` | `#FFFFFF` | Card surface |",
    "| `ink-900` | `#1B1F24` | Primary text |",
    "| `lamp-700` | `#8A4B12` | Primary actions |",
  ].join("\n");

  it("takes the PRD's name, colours and vocabulary, and drops the starter's schedule identity", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { starterIdentity, personalizeStarterFile } = await import("../src/orchestrator/starterIdentity.js");
    const { templatesRoot } = await import("../src/orchestrator/templates.js");
    const id = starterIdentity([{ name: "lantern.md", role: "prd", content: prd } as never], "My project", "Build it");
    expect(id.name).toBe("Lantern");
    expect(id.roles).toMatchObject({ "--color-bg": "#fbf8f2", "--color-surface": "#ffffff", "--color-text": "#1b1f24", "--color-accent": "#8a4b12", "--color-on-accent": "#ffffff" });
    expect(id.brief.vernacular).toEqual(expect.arrayContaining(["reading streak", "shelf card"]));
    const dir = path.join(templatesRoot(), "react-vite-starter");
    const read = (rel: string) => personalizeStarterFile(rel, fs.readFileSync(path.join(dir, rel), "utf8"), id);
    const css = read("src/styles/tokens.css");
    expect(css).toMatch(/--color-accent: #8a4b12;/);
    expect(css).toMatch(/--brand-lamp-700: #8a4b12;/);
    expect(css).not.toMatch(/prefers-color-scheme: dark/);
    for (const rel of ["index.html", "src/App.tsx", ".flowcode/design-brief.json"]) expect(read(rel), rel).not.toMatch(/schedule/i);
    expect(read("index.html")).toMatch(/<title>Lantern<\/title>/);
  });

  it("leaves the starter's colours alone when the PRD names none, but still renames it", async () => {
    const { starterIdentity, personalizeStarterFile } = await import("../src/orchestrator/starterIdentity.js");
    const id = starterIdentity([], "Garden Planner", "Plan a vegetable garden by season");
    expect(id.colors).toEqual([]);
    expect(personalizeStarterFile("src/styles/tokens.css", ":root {\n  --color-accent: #24423a;\n}\n", id)).toBe(":root {\n  --color-accent: #24423a;\n}\n");
    expect(JSON.parse(personalizeStarterFile(".flowcode/design-brief.json", "{}", id)).subject).toBe("Garden Planner");
  });
});

describe("visual styles and extras for builds whose PRD sets no look", () => {
  it("offers at least 10 styles, every one readable (WCAG AA)", async () => {
    const { DESIGN_TEMPLATES } = await import("@flowcode/contracts");
    const { contrastRatio } = await import("../src/quality/tokens.js");
    expect(DESIGN_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(DESIGN_TEMPLATES.map((t) => t.id)).size).toBe(DESIGN_TEMPLATES.length);
    for (const t of DESIGN_TEMPLATES) {
      const c = t.colors;
      const ratio = (a: string, b: string) => contrastRatio(a, b) ?? 0;
      expect(ratio(c.text, c.bg), `${t.id} text/bg`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.text, c.surface), `${t.id} text/surface`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.textMuted, c.bg), `${t.id} muted/bg`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.textMuted, c.surface), `${t.id} muted/surface`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.onAccent, c.accent), `${t.id} on-accent`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.borderStrong, c.surface), `${t.id} strong border`).toBeGreaterThanOrEqual(3);
      expect(ratio(c.accent, c.surface), `${t.id} accent as text`).toBeGreaterThanOrEqual(3);
    }
  });

  it("writes the chosen style into the starter, unless the PRD has its own colours", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { designTemplate } = await import("@flowcode/contracts");
    const { starterIdentity, withTemplate, personalizeStarterFile, lookGuidance } = await import("../src/orchestrator/starterIdentity.js");
    const { templatesRoot } = await import("../src/orchestrator/templates.js");
    const css = fs.readFileSync(path.join(templatesRoot(), "react-vite-starter/src/styles/tokens.css"), "utf8");
    const midnight = designTemplate("midnight")!;
    const id = withTemplate(starterIdentity([], "Notes", "A notes app"), midnight);
    const out = personalizeStarterFile("src/styles/tokens.css", css, id);
    expect(out).toMatch(/--color-bg: #0f1420;/);
    expect(out).toMatch(/--color-accent: #818cf8;/);
    expect(out).toMatch(/--radius-xl: 14px;/);
    expect(out).toMatch(/color-scheme: dark;/);
    expect(out).not.toMatch(/prefers-color-scheme: dark/);
    expect(out).not.toMatch(/#24423a/);
    // A PRD with its own colours wins over the chosen style.
    const prd = "# X\n| Token | Hex | Use |\n|---|---|---|\n| `a` | `#FBF8F2` | Canvas background |\n| `b` | `#1B1F24` | Primary text |\n| `c` | `#8A4B12` | Primary actions |";
    const withPrd = withTemplate(starterIdentity([{ name: "x.md", role: "prd", content: prd } as never], "X", "x"), midnight);
    expect(withPrd.template).toBeUndefined();
    // The planner hears about the style and the extras.
    const g = lookGuidance({ template: "midnight", extras: ["skeleton-loading", "micro-animations"] }, midnight);
    expect(g).toMatch(/Midnight/);
    expect(g).toMatch(/Skeleton loading/);
    expect(g).toMatch(/prefers-reduced-motion/);
  });

  it("recognises extras a PRD already asks for", async () => {
    const { BUILD_EXTRAS } = await import("@flowcode/contracts");
    const prd = "Show skeleton screens while loading, support dark mode, and make it an installable PWA.";
    expect(BUILD_EXTRAS.filter((x) => x.match.test(prd)).map((x) => x.id).sort()).toEqual(["installable", "skeleton-loading", "theme-toggle"]);
  });
});

describe("design quality in builds", () => {
  it("fails a step that leaves placeholder text or shows a screen twice", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { contentProblems } = await import("../src/quality/contentCheck.js");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-content-"));
    fs.mkdirSync(path.join(root, "src/screens"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/screens/Choices.tsx"), `export const Choices = () => <section><h2>Choices</h2><p>You will see your choices here. Select an option to proceed.</p></section>;`);
    fs.writeFileSync(path.join(root, "src/screens/Lab.tsx"), `// This is the Lab component (a comment is fine)\nexport const Lab = () => <section><h2>Strategy Lab</h2><input placeholder="This is a sample text" /><p>Compare two saving plans side by side.</p></section>;`);
    fs.writeFileSync(path.join(root, "src/App.tsx"), `export default function App(){ return <main><Lab /><Lab /><Lab /><Choices /></main>; }`);
    const jail = { root } as never;
    const problems = contentProblems(jail, ["src/screens/Choices.tsx", "src/screens/Lab.tsx", "src/App.tsx"]);
    expect(problems.map((p) => p.file).sort()).toEqual(["src/App.tsx", "src/screens/Choices.tsx"]);
    expect(problems.find((p) => p.file === "src/App.tsx")!.message).toMatch(/<Lab> 3 times/);
    // Calculator test 1: "Calculator screen content would go here" was left in App.tsx.
    fs.writeFileSync(path.join(root, "src/screens/Calc.tsx"), `export const Calc = () => <div><p>Calculator screen content would go here</p></div>;`);
    expect(contentProblems(jail, ["src/screens/Calc.tsx"]).map((p) => p.message).join()).toMatch(/placeholder content/);
  });

  it("plans the app layout and navigation before any feature", async () => {
    const { specRuntimeTasks, specFallbackTasks } = await import("../src/orchestrator/templates.js");
    const runtime = specRuntimeTasks([], undefined);
    const layout = runtime.find((t) => t.key === "layout")!;
    expect(layout.title).toBe("App layout and navigation");
    // The layout waits for the person to approve the prototype plan and the design (the review step after the imports),
    // then for the library step, which every React build has: it keeps the component library and its index in the app.
    expect(layout.dependsOn).toEqual(["fc_sections"]);
    expect(runtime.find((t) => t.key === "fc_sections")?.dependsOn).toEqual(["review"]);
    // Every spec build sets its look first: captured from the user's sources, or from the product's design direction.
    expect(runtime.find((t) => t.key === "style")?.dependsOn).toEqual(["refs"]);
    expect(runtime.find((t) => t.key === "review")?.dependsOn).toEqual(["style"]);
    expect(layout.acceptanceCriteria.some((c) => c.check.type === "file_contains" && c.check.text === "<AppShell")).toBe(true);
    // Calendar prototype: the main screens are designed whole, with sample data, before features are added to them.
    const screens = runtime.find((t) => t.key === "screens")!;
    expect(screens.title).toBe("Design the main screens");
    expect(screens.dependsOn).toEqual(["layout"]);
    expect(screens.objective).toMatch(/segmented control/);
    expect(screens.objective).toMatch(/createCollection/);
    expect(specFallbackTasks([], undefined).find((t) => t.key === "features")!.dependsOn).toEqual(["screens"]);
  });

  it("polishes the whole app before assembly, keeping the tests' names", async () => {
    const { polishTask } = await import("../src/orchestrator/templates.js");
    const polish = polishTask(["lrc_3"]);
    expect(polish.title).toBe("Design polish");
    expect(polish.dependsOn).toEqual(["lrc_3"]);
    expect(polish.objective).toMatch(/repeated on every item/);
    expect(polish.acceptanceCriteria.map((c) => c.check.type === "verification" && c.check.kind)).toContain("tests");
  });

  it("gives screen-building work the design skills", async () => {
    const c = classifyRequest("Build the app in the attached PRD", { specBuild: true, referenceRoles: ["prd"] });
    expect(c.skills).toEqual(expect.arrayContaining(["skill.ux-design-principles", "skill.app-layout-navigation"]));
    expect(classifyRequest("Change the accent colour to teal").skills).not.toContain("skill.app-layout-navigation");
  });

  it("keeps only complete, new improvement ideas", async () => {
    const { parseIdeas } = await import("../src/orchestrator/ideaScout.js");
    const ideas = parseIdeas(JSON.stringify({ ideas: [{ title: "Streak badge", why: "Encourages daily practice.", prompt: "Add a streak badge to the home screen that counts consecutive days with a finished mission." }, { title: "Old idea", why: "x", prompt: "Something long enough to count as an instruction for the coder." }, { title: "", why: "missing title", prompt: "nope" }] }), ["old idea"]);
    expect(ideas.map((i) => i.title)).toEqual(["Streak badge"]);
  });
});

describe("follow-ups on apps made before the building blocks", () => {
  it("adds the building blocks and the spec's look first, only for screen work on the React starter", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { upgradeTasks } = await import("../src/orchestrator/upgradeSteps.js");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-upgrade-"));
    fs.mkdirSync(path.join(root, "src/styles"), { recursive: true });
    fs.mkdirSync(path.join(root, "spec"));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "flowcode-starter" }));
    fs.writeFileSync(path.join(root, "src/main.tsx"), "");
    fs.writeFileSync(path.join(root, "src/styles/tokens.css"), ":root {\n  --color-accent: #24423a;\n}\n");
    fs.writeFileSync(path.join(root, "spec/prd.md"), "# X\n| Token | Hex | Use |\n|---|---|---|\n| `a` | `#FBF8F2` | Canvas background |\n| `b` | `#1B1F24` | Primary text |\n| `c` | `#8A4B12` | Primary actions |");
    const jail = { root } as never;
    expect(upgradeTasks(jail, "Rebuild the screens").map((t) => t.key)).toEqual(["fc_blocks", "fc_look"]);
    expect(upgradeTasks(jail, "Fix the failing date test")).toEqual([]);
    fs.mkdirSync(path.join(root, "src/components/ui"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/components/ui/index.tsx"), "");
    expect(upgradeTasks(jail, "Redesign the layout").map((t) => t.key)).toEqual(["fc_look"]);
  });
});

describe("plan salvage", () => {
  it("keeps the complete steps of a plan that was cut off", async () => {
    const { salvagePlan } = await import("../src/orchestrator/planSalvage.js");
    const task = (k: string, deps: string[] = []) => JSON.stringify({ key: k, title: `Step ${k}`, objective: "Do it, with a \"quoted\" word and a { brace", dependsOn: deps, expectedPaths: ["src/"], acceptanceCriteria: [{ id: `${k}1`, description: "Typecheck", check: { type: "verification", kind: "typecheck" } }], verification: ["typecheck"], role: "coder" });
    const cut = `{"goal":"Rebuild","assumptions":[],"relevantFiles":[],"expectedChanges":["src/"],"risk":"low","riskNotes":[],"validationPlan":["typecheck"],"rollbackStrategy":"x","tasks":[${task("a")},${task("b", ["a"])},${task("c", ["b", "z"])},{"key":"d","title":"Step d","objective":"half wri`;
    const plan = salvagePlan(cut)!;
    expect(plan.tasks.map((t) => t.key)).toEqual(["a", "b", "c"]);
    expect(plan.tasks[2].dependsOn).toEqual(["b"]);
    expect(plan.goal).toBe("Rebuild");
    expect(salvagePlan('{"goal":"x","tasks":[{"key":"a"')).toBeUndefined();
  });
});

describe("plain language for beginners", () => {
  it("names statuses, checks and steps in everyday words", async () => {
    const { statusLabel, checkName, stepActivity } = await import("@flowcode/contracts");
    expect(statusLabel("awaiting_approval")).toBe("Needs your OK");
    expect(statusLabel("done_with_warnings")).toBe("Ready, with notes");
    expect(checkName("typecheck")).toBe("Code check");
    expect(checkName("install")).toBe("Required packages");
    expect(stepActivity("Install dependencies (approved)")).toBe("Adding required packages…");
    expect(stepActivity("Implement the Goal Jar with visual and text-based progress")).toBe("Creating Goal Jar…");
  });

  it("turns raw errors into what happened and what to do, keeping readable ones as they are", async () => {
    const { friendlyError } = await import("@flowcode/contracts");
    expect(friendlyError("TypeError: Failed to fetch").title).toBe("We can't reach FlowCode's engine");
    expect(friendlyError("src/App.tsx(3,7): error TS2304: Cannot find name 'x'").title).toBe("We found a code issue");
    const raw = friendlyError("ENOENT: no such file or directory, open 'C:/x/y.json'");
    expect(raw.technical).toMatch(/ENOENT/);
    expect(raw.title).not.toMatch(/ENOENT/);
    const readable = friendlyError("notes.pdf: only .md, .html, .css, .json and .txt files are supported", "add that file");
    expect(readable.explain).toMatch(/only \.md/);
    expect(readable.technical).toBeUndefined();
  });

  it("has every sprint design skill, each with the nine required parts", async () => {
    const ids = ["skill.ux-flow-information-architecture", "skill.interface-design-system", "skill.responsive-mobile-ux", "skill.forms-validation-feedback", "skill.ux-states", "skill.dashboard-data-ux", "skill.onboarding-guided-setup", "skill.interaction-microfeedback", "skill.page-transitions-motion", "skill.visual-hierarchy-content", "skill.design-critique-ux-qa", "skill.plain-language-communication"];
    for (const id of ids) {
      const s = BUILTIN_SKILLS.find((x) => x.id === id);
      expect(s, id).toBeDefined();
      for (const part of ["When to use:", "When not to use:", "Inspect first:", "Process:", "Accessibility and responsive:", "Edge cases:", "Done when:", "QA:", "Report in plain language"]) expect(s!.instructions, `${id} ${part}`).toContain(part);
      expect(s!.instructions, id).not.toMatch(/\b(ensure|enable|foster|comprehensive)\w*\b|—/i);
    }
  });
});

describe("ready-made screen layouts", () => {
  const prd = "Penny Paths helps kids learn money. A dashboard shows lessons, goals and streaks. Settings let parents export data and restore a backup.";

  it("picks the screens a spec asks for, and the version that fits it", async () => {
    const { pickLayouts } = await import("../src/orchestrator/layoutRecipes.js");
    const picks = pickLayouts(prd);
    expect(picks.map((p) => p.version).sort()).toEqual(["dashboard-progress", "settings-grouped"]);
    expect(pickLayouts("A sales dashboard with revenue analytics").map((p) => p.version)).toEqual(["dashboard-overview"]);
    expect(pickLayouts("Settings for profile, theme, notifications, privacy, language and backup").map((p) => p.version)).toEqual(["settings-tabs"]);
    expect(pickLayouts("A home screen with a welcome and a get started button").map((p) => p.version)).toEqual(["home-welcome"]);
    expect(pickLayouts("A timer that counts down")).toEqual([]);
  });

  it("adds the layouts step before the app layout in React spec builds only", async () => {
    const { specRuntimeTasks } = await import("../src/orchestrator/templates.js");
    const refs = [{ name: "prd.md", role: "prd", content: prd }] as never;
    const tasks = specRuntimeTasks(refs, "react-vite-scheduler");
    const keys = tasks.map((t) => t.key);
    // A dashboard spec also gets library sections (its side navigation), added between the layouts and the app layout.
    expect(keys.indexOf("fc_layouts")).toBe(keys.indexOf("fc_sections") - 1);
    expect(keys.indexOf("fc_sections")).toBe(keys.indexOf("layout") - 1);
    expect(tasks.find((t) => t.key === "fc_sections")!.dependsOn).toEqual(["fc_layouts"]);
    expect(tasks.find((t) => t.key === "fc_sections")!.objective).toMatch(/sidebar-app/);
    const layout = tasks.find((t) => t.key === "layout")!;
    expect(layout.dependsOn).toEqual(["fc_sections"]);
    // App layout wires the ready-made screens; Design the main screens replaces their sample content.
    expect(layout.objective).toMatch(/Design the main screens", replaces their sample content/);
    const screens = tasks.find((t) => t.key === "screens")!;
    expect(screens.objective).toMatch(/src\/screens\/DashboardScreen\.tsx \(Progress version\)/);
    expect(screens.objective).toMatch(/flowcode:sample/);
    expect(tasks.find((t) => t.key === "fc_layouts")!.objective).toMatch(/dashboard-progress/);
    expect(specRuntimeTasks(refs, "angular-starter").some((t) => t.key === "fc_layouts")).toBe(false);
    expect(specRuntimeTasks([], "react-vite-scheduler").some((t) => t.key === "fc_layouts")).toBe(false);
  });

  it("ships every layout version as a building-block screen with marked sample data", async () => {
    const { LAYOUTS, layoutsDir } = await import("../src/orchestrator/layoutRecipes.js");
    for (const kind of LAYOUTS) {
      expect(kind.versions).toHaveLength(2);
      for (const v of kind.versions) {
        const src = nodeFs.readFileSync(nodePath.join(layoutsDir(), `${v.id}.tsx`), "utf8");
        expect(src).toContain("// flowcode:sample");
        expect(src).toMatch(/export default function \w+Screen/);
        expect(src).toMatch(/from "\.\.\/components\/ui"/);
        // Tokens only: no raw colours or inline styles in a layout.
        expect(src).not.toMatch(/#[0-9a-f]{3,8}\b|style=\{\{/i);
        expect(src).not.toMatch(/—/);
      }
    }
  });

  it("fails a shown screen that still has a layout's sample content", async () => {
    const { contentProblems } = await import("../src/quality/contentCheck.js");
    const root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "fc-sample-"));
    nodeFs.mkdirSync(nodePath.join(root, "src/screens"), { recursive: true });
    nodeFs.writeFileSync(nodePath.join(root, "src/screens/DashboardScreen.tsx"), "// flowcode:sample\nconst SAMPLE = {};\nexport default function DashboardScreen(){ return <p>{String(SAMPLE)}</p>; }");
    nodeFs.writeFileSync(nodePath.join(root, "src/screens/SettingsScreen.tsx"), "// flowcode:sample\nexport default function SettingsScreen(){ return null; }");
    nodeFs.writeFileSync(nodePath.join(root, "src/App.tsx"), `import DashboardScreen from "./screens/DashboardScreen";\nexport default function App(){ return <DashboardScreen />; }`);
    const problems = contentProblems({ root } as never, ["src/App.tsx"]);
    expect(problems.map((p) => p.file)).toEqual(["src/screens/DashboardScreen.tsx"]);
    // A step that owns other files (a sign-in screen) isn't blamed for the dashboard's sample (Calendar test 8).
    expect(contentProblems({ root } as never, ["src/App.tsx"], ["src/screens/AuthScreen.tsx", "src/App.tsx"])).toEqual([]);
    expect(contentProblems({ root } as never, ["src/App.tsx"], ["src/screens/DashboardScreen.js"]).map((p) => p.file)).toEqual(["src/screens/DashboardScreen.tsx"]);
    nodeFs.writeFileSync(nodePath.join(root, "src/screens/DashboardScreen.tsx"), "export default function DashboardScreen(){ return <p>Real</p>; }");
    expect(contentProblems({ root } as never, ["src/screens/DashboardScreen.tsx"])).toEqual([]);
  });
});
