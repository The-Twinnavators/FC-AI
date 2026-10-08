/**
 * Which languages and frameworks FlowCode writes, and how much of the result it checks on its own. Shown as a table
 * in About FlowCode (How builds work → Languages and checks); the Copilot answers from the same rows.
 */
export interface LanguageSupport {
  language: string;
  writes: string;
  checks: string;
  /** How strong the automatic checks are, for the table's marker. */
  level: "full" | "partial" | "weak";
}

export const LANGUAGE_SUPPORT: LanguageSupport[] = [
  {
    language: "TypeScript, JavaScript, React",
    writes: "Yes: every prototype starts from FlowCode's React + Vite + TypeScript starter",
    checks: "Yes: type check, lint, tests, build and the live preview, through the project's npm scripts. Each step's acceptance tests come from the PRD.",
    level: "full",
  },
  {
    language: "HTML, CSS",
    writes: "Yes, styled only from the Styles page's design tokens, with micro-animations",
    checks: "Yes: the live preview, screenshots at three widths, and Design QA (colours from the Styles palette, text contrast, touch-target size), plus a visual review.",
    level: "full",
  },
  {
    language: "Simulated data",
    writes: "Yes: seeded collections and saved values kept in the browser's local storage (src/sim), with Reset demo data, realistic loading delays and in-app search",
    checks: "Yes: the prototype's tests exercise adding, editing, searching and resetting the data.",
    level: "full",
  },
  {
    language: "Angular",
    writes: "Yes, as TypeScript with Angular templates, from FlowCode's Angular 21 starter",
    checks: "Yes: ng build, ng lint and ng test run without asking (tests run once, headless), a TypeScript type check after each edit, and the live preview through ng serve.",
    level: "full",
  },
  {
    language: "Three.js",
    writes: "Yes, as a JavaScript library",
    checks: "Partly: installing three needs your approval, the build and type checks cover the code, and the preview shows it. FlowCode can't judge whether a 3D scene looks right; its visual review only gives rough feedback.",
    level: "partial",
  },
  {
    language: "Backends: Node servers, SQL, PostgreSQL, Python",
    writes: "No: a prototype simulates anything that needs a server. Launch readiness lists what the real app needs, each item with a prompt for a coding agent.",
    checks: "Not in prototypes. Once the real app exists, Repo Report reads its repo (security, data, engineering quality and more).",
    level: "weak",
  },
];
