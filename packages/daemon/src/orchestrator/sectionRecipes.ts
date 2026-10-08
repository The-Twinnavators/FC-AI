/**
 * Library sections in builds (templates/library). The library is a starting point the agents may use, not the design:
 * a section is picked only where it clearly fits (a landing or marketing page, or a section the spec asks for by name),
 * each pick with its reason, shown in the plan the person approves. The runtime (not a model) copies the picked
 * sections into src/sections/ and keeps every other section in .flowcode/sections/ for later; the coder reshapes them
 * for this product and composes its own where nothing fits.
 *
 * How sections are chosen (deterministic, no model):
 *  1. Which: a category is wanted when the spec's screen text asks for it; navigation, a hero, a closing call to
 *     action and a footer come only with a landing, marketing or website page.
 *  2. Which variant: from the spec's real content (3 plans → three tiers; monthly and yearly prices → the switch;
 *     numbers to show → the hero with proof; real quotes → testimonials, none invented when there are none).
 *  3. Ties: product type and tone first (a studio or portfolio gets the centered header), then a fixed choice per
 *     project, so one project always gets the same answer and different projects don't all look alike.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { LIBRARY_SECTIONS, SECTION_CATEGORIES, type PlanTask } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { AgentOutcome } from "./agentLoop.js";
import { screenText, SAMPLE_MARKER } from "./layoutRecipes.js";
import { templatesRoot, type RuntimeStepArgs } from "./templates.js";

export const ADD_SECTIONS = "Add library sections";

export interface SectionPick {
  id: string;
  /** Why this section and this variant, in plain words (shown in the plan). */
  reason: string;
}

const has = (t: string, re: RegExp) => re.test(t);
const count = (t: string, re: RegExp) => (t.match(re) ?? []).length;
/** A fixed choice per project between equally good variants. */
const seeded = (seed: string, options: string[]) => options[parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 6), 16) % options.length]!;

/** The sections a spec clearly calls for, with the variant that fits its content, and why. */
export function pickSections(text: string, seed = ""): SectionPick[] {
  const t = screenText(text);
  const picks: SectionPick[] = [];
  const add = (id: string, reason: string) => picks.push({ id, reason });
  const pitch = has(t, /\b(landing (screen|page)|marketing (site|page)|website|web site|homepage|home page for visitors|public (site|page)|one-page site|product page)\b/i);
  const numbers = count(t, /\b\d[\d,.]*\s?(%|percent|x\b|customers|users|members|bookings|orders|downloads|hours|minutes|stars|reviews)\b/gi);
  const quotes = (t.match(/[“"][^”"\n]{25,}[”"]/g) ?? []).length;
  const editorial = has(t, /\b(portfolio|studio|agency|journal|magazine|editorial|gallery|photograph\w*|architect\w*)\b/i);

  if (pitch) {
    add(editorial ? "navbar-centered" : "navbar-simple", editorial ? "A website for a studio or portfolio: a calmer, centered header." : "A website: brand, page links and one main action.");
    if (numbers >= 2) add("hero-stats", `The spec gives ${numbers} figures to show, so the hero backs its promise with them.`);
    else if (has(t, /\b(app|tool)\b/i) && !has(t, /\b(services?|clients?|agency|studio)\b/i)) add("hero-centered", "A product with one clear job: one bold promise over a wide picture of it.");
    else add(seeded(`${seed}:hero`, ["hero-split", "hero-centered"]), "A website's opening: its promise and main action (variant fixed for this project).");
  }
  // An app (not a website) with several sections gets a side navigation to start from; its kind follows the product.
  if (!pitch) {
    const screens = count(t, /\b(screens?|pages?|views?|tabs?|sections?)\b/gi);
    const tool = has(t, /\b(dashboard|admin|back ?office|workspace|crm|inventory|portal|console|management|manager)\b/i);
    if (tool || screens >= 4) {
      if (has(t, /\b(inbox|messages|mail|email client|chat|conversations|threads)\b/i)) add("sidebar-rail", "An app built around a list of conversations or messages: an icon rail beside a list panel.");
      else if (has(t, /\b(projects?|folders?|workspaces|nested|sub-?pages|tree)\b/i) && has(t, /\b(each|per|within|inside|under)\b/i)) add("sidebar-nested", "An app whose content nests (projects with their own pages): a sidebar with expandable groups.");
      else add("sidebar-app", tool ? "A tool with several sections: a sidebar, grouped, that can collapse to icons." : `An app with several screens (${screens} named): a sidebar to move between them.`);
    }
  }
  if (has(t, /\b(features?|benefits|what it does|services|how it works|what you get|what's included)\b/i)) {
    if (has(t, /\b(how it works|steps?|step by step|walkthrough)\b/i)) add("features-alternating", "The spec explains how it works in steps: alternating rows with a picture each.");
    else if (has(t, /\b(included|what you get|checklist|every plan)\b/i)) add("features-checklist", "The spec lists what's included: a compact checklist.");
    else add("features-grid", "The spec lists features or benefits: an icon grid.");
  }
  if (numbers >= 3 && has(t, /\b(stats|statistics|numbers|results|impact|in numbers)\b/i)) add("stats-band", `The spec has real figures (${numbers}) and asks to show results.`);
  if (has(t, /\b(pricing|price plans?|subscription plans?|plans and pricing|membership tiers?)\b/i)) {
    if (has(t, /\b(monthly)\b/i) && has(t, /\b(yearly|annual(ly)?|per year)\b/i)) add("pricing-toggle", "The spec gives monthly and yearly prices: plans with a billing switch.");
    else add("pricing-tiers", "The spec describes paid plans: tiers with the usual choice highlighted.");
  }
  if (has(t, /\b(testimonials?|reviews|what (customers|people|users) say|social proof)\b/i)) {
    if (quotes >= 2) add("testimonials-cards", `The spec has ${quotes} real quotes.`);
    else if (quotes === 1) add("testimonial-feature", "The spec has one real quote: shown large.");
    // Asked for but no real quotes: nothing is added, and nothing is invented.
  }
  if (has(t, /\b(faq|frequently asked|common questions|questions and answers)\b/i)) add(has(t, /\b(short answers?|at a glance)\b/i) ? "faq-columns" : "faq-accordion", "The spec asks for a FAQ.");
  if (has(t, /\b(our team|meet the team|the team|founders|staff|our people)\b/i)) add("team-grid", "The spec introduces the team.");
  if (has(t, /\b(contact (us|form|page|details)|get in touch|enquir\w+|inquir\w+|book a call)\b/i)) add("contact-split", "The spec asks for a way to get in touch.");
  if (has(t, /\b(newsletter|mailing list|subscribe (for|to) updates|email updates)\b/i)) add("newsletter-inline", "The spec asks for a newsletter sign-up.");
  if (has(t, /\b(blog|articles|latest posts|news section|journal entries)\b/i)) add("blog-cards", "The spec has a blog or articles.");
  if (pitch) {
    add(has(t, /\b(free trial|import|demo|try it with)\b/i) ? "cta-split" : "cta-banner", "A website closes with one invitation to act.");
    add(count(t, /\b(blog|careers|help|docs|documentation|press|partners|status)\b/gi) >= 2 ? "footer-columns" : "footer-simple", "A website's footer, sized to how many pages it links to.");
  }
  const known = new Set(LIBRARY_SECTIONS.map((s) => s.id));
  return picks.filter((p) => known.has(p.id));
}

export const sectionsDir = () => path.join(templatesRoot(), "library");

/** The library's styles as the app gets them: the shared sheet, then each category's (templates/library/css/*.css). */
/**
 * The library's styles for an app: the shared base, the page backgrounds (one class anywhere), and only the category
 * files whose classes the given source uses. With no source, every file (FlowCode's own previews of the whole library).
 * All of it together is ~0.5 MB; an app using a few pieces needs a few tens of KB.
 */
export function libraryStyles(usedSource?: string): string {
  const lib = sectionsDir();
  const dir = path.join(lib, "css");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".css")).sort() : [];
  const parts = files
    .map((f) => ({ f, css: fs.readFileSync(path.join(dir, f), "utf8") }))
    .filter(({ f, css }) => usedSource === undefined || f === "backgrounds.css" || cssClasses(css).some((c) => usedSource.includes(c)))
    .map(({ css }) => css);
  return [fs.readFileSync(path.join(lib, "library.css"), "utf8"), ...parts].join("\n\n");
}

/** The fl- class names a stylesheet defines (category files each use their own prefix, e.g. fl-shop-). */
const cssClasses = (css: string) => [...new Set([...css.matchAll(/\.(fl-[a-z0-9]+-[a-z0-9-]+)/g)].map((m) => m[1]!))];

/**
 * Keeps src/styles/library.css to what the app's sections use: rebuilt from the library whenever a piece is added to
 * src/sections/ (by the library step, or by an agent copying a kept piece). Returns the new text, or undefined when
 * nothing changed or the app has no library.
 */
export function syncedLibraryCss(root: string): string | undefined {
  const target = path.join(root, "src/styles/library.css");
  const dir = path.join(root, "src/sections");
  if (!fs.existsSync(dir)) return undefined;
  const used = fs.readdirSync(dir).filter((f) => /\.(tsx|jsx)$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  const next = libraryStyles(used);
  const now = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  return next === now ? undefined : next;
}
/** In the app: picked sections as components, every section kept as text for later. */
export const sectionFile = (id: string) => `src/sections/${id.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join("")}.tsx`;
export const keptSection = (id: string) => `.flowcode/sections/${id}.tsx.txt`;

/** What the coder is told: a starting point it reshapes, never a template to fill in. */
export function sectionGuidance(picks: SectionPick[]): string {
  // No section picked: the library is still in the app, with an index, for any screen that needs a ready piece.
  if (!picks.length)
    return `FlowCode's component library is kept in .flowcode/sections/ (${INDEX_FILE} lists every piece: name, one line, file). Before writing a card, list, form, table, empty state, stats row or navigation from scratch, check the index: when one fits the screen, copy it into src/sections/ as a .tsx file, replace its SAMPLE object with the spec's real content (then delete the "${SAMPLE_MARKER}" comment) and reshape it for this product. It styles itself from src/styles/library.css, which reads the design tokens. Use a piece only where it fits; compose your own otherwise.`;
  return `Library sections are in src/sections/ (${picks.map((p) => `${sectionFile(p.id).replace("src/sections/", "")}: ${p.reason}`).join("; ")}). They are starting points, not the design: use one only where it fits the screen, replace every value in its SAMPLE object with the spec's real content (then delete the "${SAMPLE_MARKER}" comment), reshape it for this product, and delete any you don't use. Compose your own where none fits. They style themselves from src/styles/library.css, which reads the design tokens; restyle through the tokens, not by editing library.css. Every other library section is kept in .flowcode/sections/ if a screen needs one. Page backgrounds are one class on a section or the page (fl-bg-soft, -mesh, -glow, -aurora, -split, -ink for gradients; fl-bg-dots, -grid, -stripes, -waves, -topo, -grain for patterns); use at most one or two where the design calls for atmosphere, never on every section.`;
}

/** The index of the kept library, for the design and screen steps to choose from. */
export const INDEX_FILE = ".flowcode/sections/INDEX.md";

/**
 * The runtime step, for every React spec build: it keeps the whole library (with its index) in the app, and copies
 * any sections the spec clearly calls for as starting points. Kids cash app: the spec named no section, the step was
 * skipped, and the design step had no library at all to draw on.
 */
export function sectionsTask(text: string, seed: string, dependsOn: string[]): PlanTask | undefined {
  const picks = pickSections(text, seed);
  return {
    key: "fc_sections",
    title: ADD_SECTIONS,
    objective: picks.length
      ? `Copy the library sections this spec calls for into src/sections/ as starting points: ${picks.map((p) => `${p.id} (${p.reason})`).join("; ")}`
      : "Keep FlowCode's component library in .flowcode/sections/ with its index, for the screens to draw on (the spec calls for no section as a starting point)",
    dependsOn,
    expectedPaths: [...picks.map((p) => sectionFile(p.id)), "src/styles/library.css", ".flowcode/sections/"],
    acceptanceCriteria: [{ id: "q1", description: "Library styles added", check: { type: "file_exists" as const, path: "src/styles/library.css" } }],
    verification: [],
    role: "coder",
  };
}

/** Copies the planned sections, their icons and styles, keeps the whole library for later, and imports library.css. */
async function addSections({ deps, run, task, jail, onChanged }: RuntimeStepArgs): Promise<AgentOutcome> {
  const planned = new Set(task.objective.match(/\b[a-z]+(?:-[a-z]+)+(?= \()/g) ?? []);
  const ctx = { jail, projectId: run.projectId, runId: run.id, taskId: task.id, approved: run.planApproved };
  const changed: string[] = [];
  const write = (rel: string, content: string) => {
    if (fs.existsSync(path.join(jail.root, rel))) return { ok: true as const };
    const res = deps.ops.create_file(ctx, { path: rel, content });
    if (res.ok) changed.push(rel);
    return res;
  };
  const lib = sectionsDir();
  for (const [rel, content] of [["src/sections/icons.tsx", fs.readFileSync(path.join(lib, "sections/icons.tsx"), "utf8")]] as const) {
    const res = write(rel, content);
    if (!res.ok) return { kind: "blocked", reason: `Couldn't add ${rel}: ${res.message}`, nextAction: "Check the workspace, then retry this step" };
  }
  const index = [
    "# FlowCode component library (kept for this app)",
    "",
    "Each piece is a self-contained React component styled by src/styles/library.css and the design tokens. To use one, copy",
    "its file into src/sections/ as a .tsx file, replace its SAMPLE object with the app's real content, and reshape it.",
    "",
    ...SECTION_CATEGORIES.filter((c) => LIBRARY_SECTIONS.some((x) => x.category === c.id)).flatMap((c) => ["## " + c.label, ...LIBRARY_SECTIONS.filter((x) => x.category === c.id).map((x) => `- ${x.name}: ${x.description} (${keptSection(x.id)})`), ""]),
  ].join("\n");
  write(INDEX_FILE, index);
  const added: string[] = [];
  let usedSource = "";
  for (const s of LIBRARY_SECTIONS) {
    const src = fs.readFileSync(path.join(lib, "sections", `${s.id}.tsx`), "utf8");
    write(keptSection(s.id), src);
    if (planned.has(s.id)) {
      const res = write(sectionFile(s.id), src);
      if (!res.ok) return { kind: "blocked", reason: `Couldn't add ${sectionFile(s.id)}: ${res.message}`, nextAction: "Retry this step" };
      added.push(s.name);
      usedSource += src;
    }
  }
  // Only the styles the copied pieces use (and the page backgrounds); kept in sync as agents add more pieces.
  const css = write("src/styles/library.css", libraryStyles(usedSource));
  if (!css.ok) return { kind: "blocked", reason: "Couldn't add src/styles/library.css: " + css.message, nextAction: "Check the workspace, then retry this step" };
  // The app loads the library's styles after its own tokens.
  const mainRel = "src/main.tsx";
  try {
    const main = fs.readFileSync(path.join(jail.root, mainRel), "utf8");
    if (!main.includes("./styles/library.css")) {
      const next = main.replace(/(import "\.\/styles\/tokens\.css";\r?\n)/, `$1import "./styles/library.css";\n`);
      if (next !== main) {
        const res = deps.ops.replace_file(ctx, { path: mainRel, content: next, reason: "Load the library sections' styles" });
        if (res.ok) changed.push(mainRel);
      }
    }
  } catch {
    /* no main.tsx: the coder imports library.css where the app loads its styles */
  }
  onChanged(changed);
  deps.bus.emit({ type: "tool.completed", projectId: run.projectId, runId: run.id, taskId: task.id, message: added.length ? `Added library sections as starting points: ${added.join(", ")}` : "The library sections were already in place" });
  return { kind: "complete", summary: `Added ${added.length} library section(s)`, changedPaths: changed };
}

export const SECTION_STEPS: Record<string, (a: RuntimeStepArgs) => Promise<AgentOutcome>> = { [ADD_SECTIONS]: addSections };
