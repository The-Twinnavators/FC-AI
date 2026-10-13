/**
 * A style chosen in New build survives "Capture the style": with nothing to capture from (no website, image, CSS or
 * HTML), the step keeps the chosen style's colours and fonts and treats the industry direction as advice. Build test 7
 * chose Soft Neutral and came out food-industry green because this step overwrote it.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { designTemplate, type Task } from "@flowcode/contracts";
import { CAPTURE_STYLE, TEMPLATES } from "../src/orchestrator/templates.js";

const SCAFFOLD = "Scaffold from verified starter template";
import { makeApp, makeProject } from "./helpers.js";

const PRD = "# Brand finder\nPeople want healthy food and trusted non-GMO grocery brands for their family meals.";

async function build(look: unknown) {
  const { app } = makeApp();
  const { project, jail, ws } = makeProject(app);
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "A grocery brand finder for healthy food", kind: "spec_build", references: [{ name: "prd.md", role: "prd", content: PRD }], constraints: [], attachedKnowledgeIds: [] });
  if (look) app.store.setSetting(`runLook:${run.id}`, look);
  const deps = (app.orchestrator as unknown as { d: never }).d;
  const tpl = TEMPLATES["react-vite-scheduler"]!;
  const task = (title: string) => ({ id: `t_${title}`, runId: run.id, title, objective: "", role: "coder", status: "running", attempts: 1, expectedPaths: [], actualPaths: [], acceptanceCriteria: [], dependsOn: [], ordinal: 0, verification: [] }) as unknown as Task;
  const args = (title: string) => ({ deps, run: { ...app.store.runs.require(run.id), planApproved: true }, task: task(title), jail, signal: new AbortController().signal, onChanged: () => undefined });
  expect((await tpl.runtimeSteps[SCAFFOLD]!(args(SCAFFOLD))).kind).not.toBe("blocked");
  await tpl.runtimeSteps[CAPTURE_STYLE]!(args(CAPTURE_STYLE));
  const css = fs.readFileSync(path.join(ws, "src/styles/tokens.css"), "utf8");
  return { accent: /--color-accent:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]?.toLowerCase(), bg: /--color-bg:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]?.toLowerCase() };
}

describe("a style chosen in New build", () => {
  it("keeps its colours through Capture the style when there is nothing to capture", async () => {
    const soft = designTemplate("soft-neutral")!;
    const got = await build({ template: "soft-neutral", vibe: "flat", extras: [] });
    expect(got.accent).toBe(soft.colors.accent.toLowerCase());
    expect(got.bg).toBe(soft.colors.bg.toLowerCase());
  });

  it("without a chosen style, still gets the industry direction's palette instead of the starter default", async () => {
    const soft = designTemplate("soft-neutral")!;
    const got = await build(undefined);
    expect(got.accent).toBeDefined();
    expect(got.accent).not.toBe(soft.colors.accent.toLowerCase());
  });
});
