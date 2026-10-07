/** Design playbook: uploaded design strategies reach the coder on interface steps; the built-in skill is in the library. */
import { describe, expect, it } from "vitest";
import { isInterfaceStep, listPlaybook, playbookFor, removeFromPlaybook, setPlaybookActive } from "../src/knowledge/designPlaybook.js";
import { uploadDocument } from "../src/web/webSearch.js";
import { BUILTIN_SKILLS } from "../src/knowledge/skills.js";
import { makeApp } from "./helpers.js";

describe("design playbook", () => {
  it("lists uploaded playbook documents and picks the sections that fit a step", () => {
    const { app } = makeApp();
    uploadDocument(app, { name: "rule-of-8.md", content: "# Rule of 8\nUse 8px spacing for cards, buttons and modals. Card padding 24px.", tags: ["design-playbook"] });
    uploadDocument(app, { name: "dashboards.md", content: "# Dashboards\nLead with the most actionable metric. Charts need labels.", tags: ["design-playbook"] });
    uploadDocument(app, { name: "notes.md", content: "Unrelated meeting notes about cards." });
    const docs = listPlaybook(app);
    expect(docs.map((d) => d.title).sort()).toEqual(["dashboards", "rule-of-8"]);
    expect(docs.every((d) => d.active)).toBe(true);

    const picked = playbookFor(app, "Build the card grid and modal spacing", 1);
    expect(picked[0].title).toBe("Design playbook: rule-of-8");
    expect(picked[0].content).toContain("8px spacing");

    // Switched off: the agents stop getting it, but it stays in the playbook.
    const rule = docs.find((d) => d.title === "rule-of-8")!;
    setPlaybookActive(app, rule.ids, false);
    expect(playbookFor(app, "card grid modal spacing", 2).map((p) => p.title)).toEqual(["Design playbook: dashboards"]);
    expect(listPlaybook(app).find((d) => d.title === "rule-of-8")?.active).toBe(false);
    // Removed: out of the playbook, still in the library.
    removeFromPlaybook(app, rule.ids);
    expect(listPlaybook(app).map((d) => d.title)).toEqual(["dashboards"]);
    expect(app.store.knowledge.get(rule.ids[0])?.title).toBe("rule-of-8");
  });

  it("only interface steps get the playbook", () => {
    expect(isInterfaceStep({ title: "Event creation dialog", objective: "x", expectedPaths: ["src/screens/Events.tsx"] })).toBe(true);
    expect(isInterfaceStep({ title: "Responsive layout", objective: "x", expectedPaths: ["src/"] })).toBe(true);
    expect(isInterfaceStep({ title: "Install dependencies (approved)", objective: "Install declared dependencies.", expectedPaths: ["package-lock.json"] })).toBe(false);
    expect(isInterfaceStep({ title: "Date helpers", objective: "Add a function that adds days to a date.", expectedPaths: ["src/lib/date.ts"] })).toBe(false);
  });

  it("ships the design playbook skill with the rule of 8 and layout patterns", () => {
    const skill = BUILTIN_SKILLS.find((s) => s.id === "skill.design-playbook-custom-ux")!;
    expect(skill.roles).toContain("coder");
    expect(skill.instructions).toMatch(/--space-8 64px/);
    expect(skill.instructions).toMatch(/Layout patterns/);
    expect(skill.instructions).not.toMatch(/—/);
  });
});

describe("UX architecture skill", () => {
  it("covers objects, lifecycles, states, permissions and routes, and is picked for that work only", async () => {
    const { selectSkills } = await import("../src/knowledge/skills.js");
    const skill = BUILTIN_SKILLS.find((s) => s.id === "skill.ux-architecture")!;
    for (const part of [/Objects before pages/, /Lifecycle/, /States for every screen/, /Permissions are UX/, /Routes and components/]) expect(skill.instructions).toMatch(part);
    expect(skill.instructions).not.toMatch(/—|\[web:/);
    expect(selectSkills(BUILTIN_SKILLS, "planner", "Add roles and permissions so admins can approve posts").map((s) => s.id)).toContain("skill.ux-architecture");
    expect(selectSkills(BUILTIN_SKILLS, "coder", "Make the heading font bigger").map((s) => s.id)).not.toContain("skill.ux-architecture");
  });
});

describe("typography skill", () => {
  it("uses the starter's real type tokens and stays out of unrelated work", async () => {
    const skill = BUILTIN_SKILLS.find((s) => s.id === "skill.typography-hierarchy")!;
    const fs = await import("node:fs");
    const tokens = fs.readFileSync(new URL("../../../templates/react-vite-starter/src/styles/tokens.css", import.meta.url), "utf8");
    for (const t of skill.instructions.match(/--[a-z][a-z0-9-]+/g) ?? []) expect(tokens, t).toContain(`${t}:`);
    expect(skill.instructions).not.toMatch(/—/);
    expect(skill.triggers).not.toContain("design tokens");
  });
});
