/**
 * An approved design proof reaches the build as a contract (designContract.ts): approve → saved → replanned (the briefs
 * are rewritten) → the layout step writes the home page from it and the style step its tokens → the approved-design
 * check passes; and a page that drifts from it (order, words, tokens) is caught.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DesignProof, DesignProofs } from "@flowcode/contracts";
import { approveProof, proofsKey } from "../src/orchestrator/designProofs.js";
import { applyDesignContract, designContractKey, designContractProblems, getContract, type DesignContract } from "../src/orchestrator/designContract.js";
import { compositionKey, type CompositionManifest } from "../src/orchestrator/compositionManifest.js";
import { screenBriefKey, type ScreenBrief } from "../src/orchestrator/screenBrief.js";
import { APP_LAYOUT, layoutStep, screenPlanKey, type ScreenPlan } from "../src/orchestrator/screenPlan.js";
import { applyDesignSpec, type DesignSpec } from "../src/workspace/designSpec.js";
import { makeApp, makeProject } from "./helpers.js";

const STARTER = path.resolve(import.meta.dirname, "../../../templates/react-vite-starter");

/** The starter's source (no node_modules), as the build's workspace starts. */
function starterFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (/\.(tsx?|css|json|html)$/.test(e.name)) out[path.relative(STARTER, abs).split(path.sep).join("/")] = fs.readFileSync(abs, "utf8");
    }
  };
  walk(path.join(STARTER, "src"));
  return out;
}

const SPEC: DesignSpec = {
  version: 1,
  id: "proof-b",
  name: "Golden Hour Flow",
  thesis: "Warm and calm, so booking a class feels like the start of the practice.",
  typography: { display: "Playfair Display", body: "Source Sans 3", scale: "expressive", headingWeight: 600, headingCase: "normal" },
  palette: { bg: "#fffaf3", surface: "#ffffff", surfaceSunken: "#f6eee2", text: "#2b2118", textMuted: "#6b5a49", border: "#e6d8c6", borderStrong: "#b89f84", accent: "#9a3412", accentHover: "#7c2d12", onAccent: "#ffffff", secondary: "#365314" },
  density: "regular",
  surface: { vibe: "flat", radii: [2, 4, 8, 8], borderWidth: 1 },
  composition: { contentWidth: "regular", changes: [] },
  signature: "",
  responsive: [],
  sources: [{ kind: "internal", ref: "design proof", confidence: "medium" }],
};

const PROOF: DesignProof = {
  id: "p_b",
  label: "Proof B",
  status: "ready",
  name: "Golden Hour Flow",
  rationale: "Warm light and a calm rhythm.",
  spec: SPEC,
  page: {
    sections: [
      { block: "top-nav-variants", props: { brand: "Sunrise Yoga", variant: "marketing", links: [{ label: "Classes", href: "#classes" }, { label: "Teachers", href: "#teachers" }], actions: [{ label: "Book a class" }] } },
      { block: "hero-split", props: { id: "hero", title: "Start the day on the mat", lede: "Small morning classes for every level, ten minutes from downtown.", primary: { label: "See this week's classes", href: "#classes" }, media: { alt: "A yoga class at sunrise", src: "fc-image:images/proof-p_b-1.jpg" } } },
      { block: "features-grid", props: { id: "why", title: "Why people stay", items: [{ icon: "calendar", title: "Book in two taps", text: "See the week and save your spot." }] } },
      { block: "testimonials-cards", props: { id: "say", title: "What members say", quotes: [{ quote: "The 7 a.m. flow changed my mornings.", name: "Priya", role: "Member" }] } },
      { block: "cta-banner", props: { id: "cta", title: "Your first class is free", primary: { label: "Book a class", href: "#classes" } } },
      { block: "footer-simple", props: { brand: "Sunrise Yoga", links: [{ label: "Privacy", href: "#" }], year: 2026 } },
    ],
  },
};

const PLAN: ScreenPlan = {
  product: "Sunrise Yoga",
  screens: [
    { id: "home", label: "Home", component: "HomeScreen", file: "src/screens/HomeScreen.tsx", purpose: "Visitors learn about the studio and start booking" },
    { id: "classes", label: "Classes", component: "ClassesScreen", file: "src/screens/ClassesScreen.tsx", purpose: "Members find a class and book it" },
  ],
};

/** The planner's briefs (as a replan writes them again): a generic home with a hero and the PRD's schedule preview. */
const plannerBriefs = (): ScreenBrief[] => [
  {
    screen: "Home",
    pageType: "home",
    who: "Visitors",
    goal: "Decide to book",
    workflow: [],
    firstView: "What the studio is",
    primaryAction: "Book a class",
    sections: [
      { title: "Hero", purpose: "Say what the studio is", part: "" },
      { title: "This week's schedule", purpose: "The next classes with free spots, from the PRD (F2)", part: "" },
    ],
    acceptance: ["F2"],
  },
  {
    screen: "Classes",
    pageType: "list",
    who: "Members",
    goal: "Book a class",
    workflow: [],
    firstView: "The week's classes",
    primaryAction: "Book",
    sections: [{ title: "Class list", purpose: "Every class this week with its spots", part: "" }],
  },
];

describe("an approved design proof becomes the home page", () => {
  it("is saved as a contract, survives a replan, is written by the layout step and checked against the page", async () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, starterFiles());
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Sunrise Yoga's booking site", constraints: [], attachedKnowledgeIds: [], references: [] });
    app.store.setSetting(screenPlanKey(run.id), PLAN);
    app.store.setSetting(screenBriefKey(run.id), plannerBriefs());
    const proofs: DesignProofs = { runId: run.id, projectId: project.id, rounds: [{ id: "r1", at: "2026-10-21T00:00:00Z", proofs: [PROOF] }], chosen: PROOF.id };
    app.store.setSetting(proofsKey(run.id), proofs);

    // Approve → persist: a versioned contract with every section, its content, the tokens and the target page.
    approveProof({ store: app.store, bus: app.bus, router: app.router }, run.id);
    const saved = getContract(app.store, run.id)!;
    expect(saved).toMatchObject({ schema: 1, revision: 1, proofId: "p_b", target: { screen: "Home", file: "src/screens/HomeScreen.tsx" } });
    expect(saved.sections.map((x) => x.component)).toEqual(["TopNav", "HeroSplit", "FeaturesGrid", "TestimonialsCards", "CtaBanner", "FooterSimple"]);
    expect(saved.sections[1]!.props.title).toBe("Start the day on the mat");
    expect(saved.tokens["--color-accent"]).toBe("#9a3412");

    // Replan / reload: the planner writes its generic briefs again, and planning puts the contract back on Home only.
    app.store.setSetting(screenBriefKey(run.id), plannerBriefs());
    const again = applyDesignContract(app.store, run.id)!;
    expect(again.revision).toBe(1);
    const briefs = app.store.getSetting<ScreenBrief[]>(screenBriefKey(run.id), []);
    const home = briefs.find((b) => b.screen === "Home")!;
    expect(home.sections.filter((x) => x.contract).map((x) => x.contract!.component)).toEqual(saved.sections.map((x) => x.component));
    // The PRD's schedule stays on the page (after the hero) and the disagreement is said, not dropped.
    expect(home.sections[2]).toMatchObject({ title: "This week's schedule", required: true });
    expect(again.conflicts.join(" ")).toContain("This week's schedule");
    expect(home.pageType).toBe("marketing");
    // Unrelated pages keep their own brief and rules.
    expect(briefs.find((b) => b.screen === "Classes")).toEqual(plannerBriefs()[1]);
    const manifest = app.store.getSetting<CompositionManifest>(compositionKey(run.id), { entries: [], gaps: [] });
    expect(manifest.entries.filter((e) => e.page === "Home").map((e) => e.ref)).toContain("b.hero-split");
    expect(manifest.entries.some((e) => e.page === "Classes")).toBe(false);

    // Generate: the style step's tokens, then FlowCode's layout step writes the page from the contract.
    applyDesignSpec(jail, app.ops, { projectId: project.id, runId: run.id }, SPEC, { frameCss: "src/styles/components.css", screens: [] });
    // The layout step runs after the person approves the plan (a fixture here).
    app.store.runs.upsert({ ...app.store.runs.require(run.id), planApproved: true });
    const task = { id: "t_layout", title: APP_LAYOUT } as Parameters<ReturnType<typeof layoutStep>>[0]["task"];
    const out = await layoutStep(PLAN)({ deps: { store: app.store, ops: app.ops, bus: app.bus } as never, run: app.store.runs.require(run.id), task, jail, signal: new AbortController().signal, onChanged: () => undefined });
    expect(out.kind === "blocked" ? out.reason : out.kind).toBe("complete");
    const page = fs.readFileSync(path.join(jail.root, "src/screens/HomeScreen.tsx"), "utf8");
    const order = ["<TopNav", "<HeroSplit", "<FeaturesGrid", "<TestimonialsCards", "<CtaBanner", "<FooterSimple"].map((c) => page.indexOf(c));
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!))).toBe(true);
    expect(page).toContain("Start the day on the mat");
    expect(page).toContain('"/images/proof-p_b-1.jpg"');
    expect(page).not.toContain("PageHeader");
    // Required behavior kept: the PRD's schedule slot, and the app's other screen reachable from the approved top bar.
    expect(page).toContain("This week's schedule");
    expect(page).toContain('"href":"#/classes"');
    const appFile = fs.readFileSync(path.join(jail.root, "src/App.tsx"), "utf8");
    expect(appFile).toContain('const FULL_PAGE = ["home"]');
    expect(fs.readFileSync(path.join(jail.root, "src/screens/ClassesScreen.tsx"), "utf8")).toContain("PageHeader");
    for (const f of ["HeroSplit", "TopNavVariants", "FooterSimple"]) expect(fs.existsSync(path.join(jail.root, `src/sections/${f}.tsx`))).toBe(true);

    // Design validation: the page matches its approved design.
    const contract = app.store.getSetting<DesignContract>(designContractKey(run.id), null as never);
    expect(designContractProblems(jail.root, contract)).toEqual([]);

    // A deliberate mismatch is caught: sections swapped, approved words gone, a token changed.
    const swapped = page.replace(/<HeroSplit[^\n]*\n/, "").replace("{/* 6.", `${/<HeroSplit[^\n]*\n/.exec(page)![0]}      {/* 6.`);
    fs.writeFileSync(path.join(jail.root, "src/screens/HomeScreen.tsx"), swapped.replaceAll("Why people stay", "Our features"));
    const tokens = path.join(jail.root, "src/styles/tokens.css");
    fs.writeFileSync(tokens, fs.readFileSync(tokens, "utf8").replace(/(--color-accent:\s*)[^;]+;/g, "$1#2563eb;"));
    const problems = designContractProblems(jail.root, contract);
    expect(problems.some((p) => p.includes("out of the approved order"))).toBe(true);
    expect(problems.some((p) => p.includes("Why people stay"))).toBe(true);
    expect(problems.some((p) => p.includes("--color-accent"))).toBe(true);
  });
});
