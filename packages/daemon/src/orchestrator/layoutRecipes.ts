/**
 * Ready-made screen layouts (templates/layouts): finished dashboard, home and settings screens built only from the
 * starter's building blocks and design tokens, each in two versions. When a React build's spec or request asks for one
 * of those screens, the runtime (not a model) copies the best-fitting version into src/screens/ before the coder
 * starts, so the coder customises a working, consistent screen instead of inventing one. Every version is also kept in
 * .flowcode/layouts/ so an agent can switch versions later when fine-tuning the design.
 */
import fs from "node:fs";
import path from "node:path";
import type { PlanTask } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { AgentOutcome } from "./agentLoop.js";
import { templatesRoot, type RuntimeStepArgs } from "./templates.js";

export const ADD_LAYOUTS = "Add ready-made screen layouts";
/** Marks a layout's sample data; the content check fails a wired-in screen that still has it. */
export const SAMPLE_MARKER = "flowcode:sample";

export interface LayoutVersion {
  id: string;
  name: string;
  bestFor: string;
}
export interface LayoutKind {
  kind: "home" | "dashboard" | "settings" | "pricing" | "about" | "signin";
  /** File it becomes in the app. */
  screen: string;
  /** When the spec or request asks for this screen. */
  wanted: RegExp;
  versions: LayoutVersion[];
  /** Picks the version that fits the text best. */
  pick: (text: string) => string;
}

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

export const LAYOUTS: LayoutKind[] = [
  {
    kind: "home",
    screen: "src/screens/HomeScreen.tsx",
    wanted: /\b(home ?(screen|page)|welcome (screen|page)|landing (screen|page)|start screen|first screen|get started|onboarding)\b/i,
    versions: [
      { id: "home-welcome", name: "Welcome", bestFor: "first screen of most apps: welcome, one main action, main tasks as tiles, how it works" },
      { id: "home-returning", name: "Returning", bestFor: "apps opened daily: continue where you left off, today's list, shortcuts" },
    ],
    pick: (t) => (count(t, /\b(continue|resume|pick up|today|daily|streaks?|habits?|journal|every day)\b/gi) >= 2 ? "home-returning" : "home-welcome"),
  },
  {
    kind: "dashboard",
    screen: "src/screens/DashboardScreen.tsx",
    wanted: /\b(dashboards?|overview (screen|page)|stats|statistics|analytics|progress (screen|page|tracking)|track (your |my )?progress)\b/i,
    versions: [
      { id: "dashboard-overview", name: "Overview", bestFor: "amounts, items or orders over time: key numbers with trends, a chart, recent activity and a table" },
      { id: "dashboard-progress", name: "Progress", bestFor: "goal-based apps (learning, habits, fitness, savings): streak, goals, next step and recent wins" },
    ],
    pick: (t) => (count(t, /\b(learn\w*|lessons?|courses?|goals?|habits?|streaks?|missions?|levels?|badges?|fitness|study|savings?|quiz\w*)\b/gi) >= 2 ? "dashboard-progress" : "dashboard-overview"),
  },
  {
    kind: "settings",
    screen: "src/screens/SettingsScreen.tsx",
    wanted: /\b(settings|preferences|backup|restore|export (your |my )?data|accessibility options)\b/i,
    versions: [
      { id: "settings-grouped", name: "Grouped", bestFor: "a handful of settings on one page, in titled groups, with reset last" },
      { id: "settings-tabs", name: "Tabs", bestFor: "many settings: profile, appearance, notifications and data in separate sections" },
    ],
    pick: (t) => (new Set((t.match(/\b(profile|appearance|theme|notifications?|privacy|backup|accessibility|account|language|sounds?)\b/gi) ?? []).map((w) => w.toLowerCase().replace(/s$/, ""))).size >= 5 ? "settings-tabs" : "settings-grouped"),
  },
  {
    kind: "pricing",
    screen: "src/screens/PricingScreen.tsx",
    wanted: /\b(pricing|price plans?|subscription plans?|plans? and pricing|compare plans|membership tiers?)\b/i,
    versions: [
      { id: "pricing-cards", name: "Cards", bestFor: "two to four plans side by side with a monthly or yearly switch" },
      { id: "pricing-compare", name: "Compare", bestFor: "plans that differ in many details: summaries plus a feature comparison table" },
    ],
    pick: (t) => (/\b(compare|comparison|feature table|feature matrix)\b/i.test(t) ? "pricing-compare" : "pricing-cards"),
  },
  {
    kind: "about",
    screen: "src/screens/AboutScreen.tsx",
    wanted: /\b(about (us|page|screen)|our (story|mission|team)|meet the team|mission (statement|and values))\b/i,
    versions: [
      { id: "about-story", name: "Story", bestFor: "small products: mission, values and how it started" },
      { id: "about-team", name: "Team", bestFor: "organisations and services: mission, numbers, the people and how to get in touch" },
    ],
    pick: (t) => (/\b(team|staff|volunteers|members|contact us|get in touch)\b/i.test(t) ? "about-team" : "about-story"),
  },
  {
    kind: "signin",
    screen: "src/screens/SignInScreen.tsx",
    // Accounts only when asked for: a "no login" or "without accounts" spec never gets a sign-in screen.
    wanted: /^(?![\s\S]*\b(no|without) (login|log-in|sign[- ]?in|accounts?)\b)[\s\S]*\b(log ?in|sign[- ]?in|sign[- ]?up|create (an )?account|register)\b/i,
    versions: [
      { id: "signin-centered", name: "Centred", bestFor: "most apps: one small card with sign in and create account" },
      { id: "signin-split", name: "Split", bestFor: "people who may not know the product yet: its promise beside the form" },
    ],
    // Calendar design rebuild: "first-time visitors" in a PRD gave a personal calendar a marketing split sign-in.
    pick: (t) => (/\b(landing page|marketing (site|page))\b/i.test(t) ? "signin-split" : "signin-centered"),
  },
];

export interface LayoutPick {
  kind: LayoutKind["kind"];
  screen: string;
  version: string;
}

/**
 * The parts of a spec that describe the app's own screens. A long PRD also has goals, launch plans, analytics and
 * risks ("monitoring dashboard", "Product goals", "row-level security"); words there say nothing about which screens
 * the app has. When the text has markdown sections, only those about screens, navigation, features or user stories
 * count; text without sections (a short request) is used as it is.
 */
export function screenText(text: string): string {
  const sections = text.split(/\n(?=#{1,4}\s)/);
  if (sections.length < 3) return text;
  const about = /^#{1,4}\s.*\b(information architecture|main screens?|screens?|pages?|navigation|site ?map|user interface|ui|ux|layouts?|views?|user stories|features?|feature scope|functional requirements|interaction)\b/i;
  const off = /^#{1,4}\s.*\b(goals|non-goals|launch|analytics|metrics|risks?|roadmap|implementation plan|sprint|backlog|testing|technical|recommended architecture|system architecture|tech stack|data model|api|security|performance|delivery|open decisions)\b/i;
  const kept = sections.filter((s) => about.test(s) && !off.test(s.split("\n")[0]));
  return kept.length ? kept.join("\n") : text;
}

/** The layouts a spec or request asks for, each with the version that fits it best. */
export function pickLayouts(text: string): LayoutPick[] {
  const screens = screenText(text);
  // The Welcome home is a pitch (hero, headline, tiles). Most PRDs name a "home screen" for the tool itself, and every
  // build's first screen came out as the same landing page (No BIO & GMO build: "same AI slop"). Only a PRD that asks
  // for a landing, welcome, marketing or onboarding page gets it; otherwise the design step composes the first screen.
  const pitch = /\b(landing (screen|page)|welcome (screen|page)|marketing (site|page)|onboarding|get started)\b/i.test(screens);
  return LAYOUTS.filter((l) => l.wanted.test(screens) && (l.kind !== "home" || pitch)).map((l) => ({ kind: l.kind, screen: l.screen, version: l.pick(screens) }));
}

export const layoutsDir = () => path.join(templatesRoot(), "layouts");

/** Where every version is kept in the app for later switching (".txt" so the app's lint and type check skip it). */
export const keptPath = (version: string) => `.flowcode/layouts/${version}.tsx.txt`;

/** One sentence for the coder: which screens start from a layout and how to switch versions. */
export function layoutGuidance(picks: LayoutPick[]): string {
  if (!picks.length) return "";
  const lines = picks.map((p) => {
    const kind = LAYOUTS.find((l) => l.kind === p.kind)!;
    const others = kind.versions.filter((v) => v.id !== p.version).map((v) => `${keptPath(v.id)} (${v.name}: ${v.bestFor})`);
    return `${p.screen} (${kind.versions.find((v) => v.id === p.version)?.name} version)${others.length ? `; other version: ${others.join(", ")}` : ""}`;
  });
  return `Ready-made screens are already in the app: ${lines.join("; ")}. Each is a starting point, not the design: keep its building blocks, replace every value in its SAMPLE object with the spec's real content and data (then delete the "${SAMPLE_MARKER}" comment), and reshape it for this product and the screen's one job. Remove every section the spec doesn't ask for (a sign-in screen is the form, not a marketing promise or a feature checklist, unless the spec describes one), and add the spec's own sections with the same building blocks. It should look made for this app, not like a template with the blanks filled in. To switch to another version, copy its .tsx.txt file over the screen file. Delete a ready-made screen the app doesn't use.`;
}

/** The runtime step, for a spec build or a follow-up request. Returns undefined when nothing needs adding. */
export function layoutsTask(jail: PathJail | undefined, text: string, dependsOn: string[]): PlanTask | undefined {
  const picks = pickLayouts(text).filter((p) => !jail || !fs.existsSync(path.join(jail.root, p.screen)));
  if (!picks.length) return undefined;
  return {
    key: "fc_layouts",
    title: ADD_LAYOUTS,
    objective: `Copy FlowCode's ready-made layouts into src/screens/ for the coder to customise: ${picks.map((p) => p.version).join(", ")}.`,
    dependsOn,
    expectedPaths: [...picks.map((p) => p.screen), ".flowcode/layouts/"],
    acceptanceCriteria: picks.map((p, i) => ({ id: `y${i + 1}`, description: `${p.kind} layout added`, check: { type: "file_exists" as const, path: p.screen } })),
    verification: [],
    role: "coder",
  };
}

const PARTS = ["src/components/ui/screen-parts.tsx", "src/styles/screen-parts.css"];

/** Copies the chosen versions (and every version, kept for switching) plus the screen parts the layouts are built from. */
async function addLayouts({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> {
  const refsText = (() => {
    try {
      const dir = path.join(jail.root, "spec");
      return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(md|markdown|txt)$/i.test(f)).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n") : "";
    } catch {
      return "";
    }
  })();
  // The screens this step was planned for; the spec's wording only helps choose each one's version.
  const planned = new Set(task.objective.match(/\b(home|dashboard|settings|pricing|about|signin)-[a-z]+\b/g) ?? []);
  const picks = pickLayouts(`${run.objective}\n${refsText}`)
    .filter((p) => task.expectedPaths.includes(p.screen))
    .map((p) => ({ ...p, version: LAYOUTS.find((l) => l.kind === p.kind)!.versions.find((v) => planned.has(v.id))?.id ?? p.version }));
  const ctx = { jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved };
  const changed: string[] = [];
  const write = (rel: string, content: string, reason: string) => {
    const exists = fs.existsSync(path.join(jail.root, rel));
    const res = exists ? deps.ops.replace_file(ctx, { path: rel, content, reason }) : deps.ops.create_file(ctx, { path: rel, content });
    if (res.ok) changed.push(rel);
    return res;
  };
  // Apps made before the screen parts existed get them, and the building blocks' index re-exports them.
  const starter = path.join(templatesRoot(), "react-vite-starter");
  for (const rel of PARTS) {
    if (fs.existsSync(path.join(jail.root, rel))) continue;
    const res = write(rel, fs.readFileSync(path.join(starter, rel), "utf8"), "Add the screen parts the layouts use");
    if (!res.ok) return { kind: "blocked", reason: `Couldn't add ${rel}: ${res.message}`, nextAction: "Check the workspace, then retry this step" };
  }
  const indexRel = "src/components/ui/index.tsx";
  const index = (() => {
    try {
      return fs.readFileSync(path.join(jail.root, indexRel), "utf8");
    } catch {
      return undefined;
    }
  })();
  if (index === undefined) return { kind: "blocked", reason: "The app has no building blocks (src/components/ui/index.tsx)", nextAction: `Run "Add FlowCode building blocks" first` };
  if (!index.includes("./screen-parts")) {
    const res = write(indexRel, `${index.trimEnd()}\n\nexport * from "./screen-parts";\n`, "Export the screen parts with the other building blocks");
    if (!res.ok) return { kind: "blocked", reason: `Couldn't update ${indexRel}: ${res.message}`, nextAction: "Retry this step" };
  }
  const added: string[] = [];
  for (const p of picks) {
    const kind = LAYOUTS.find((l) => l.kind === p.kind)!;
    for (const v of kind.versions) {
      const src = fs.readFileSync(path.join(layoutsDir(), `${v.id}.tsx`), "utf8");
      if (!fs.existsSync(path.join(jail.root, keptPath(v.id)))) {
        const res = write(keptPath(v.id), src, "Keep this layout version for switching later");
        if (!res.ok) return { kind: "blocked", reason: `Couldn't keep ${v.id}: ${res.message}`, nextAction: "Retry this step" };
      }
      if (v.id === p.version && !fs.existsSync(path.join(jail.root, p.screen))) {
        const res = write(p.screen, src, "Start this screen from a ready-made layout");
        if (!res.ok) return { kind: "blocked", reason: `Couldn't add ${p.screen}: ${res.message}`, nextAction: "Retry this step" };
        added.push(`${kind.kind} (${v.name})`);
      }
    }
  }
  onChanged(changed);
  deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: added.length ? `Added ready-made screens: ${added.join(", ")}` : "The ready-made screens were already in place" });
  return { kind: "complete", summary: `Added ${added.length} screen layout(s)`, changedPaths: changed };
}

export const LAYOUT_STEPS: Record<string, (a: RuntimeStepArgs) => Promise<AgentOutcome>> = { [ADD_LAYOUTS]: addLayouts };
