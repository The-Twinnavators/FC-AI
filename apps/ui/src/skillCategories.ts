/**
 * Groups for the skill library, so 60+ skills can be browsed by what they help with. Built-in skills are listed by id;
 * anything else (skills you add or import, ones FlowCode proposes) is placed by its id, then its source.
 */
import type { SkillSpec } from "@flowcode/contracts";

export type SkillCategory = "planning" | "design" | "recipes" | "process" | "quality" | "code" | "growth" | "learned" | "yours";

export const SKILL_CATEGORIES: Array<{ id: SkillCategory; label: string; hint: string }> = [
  { id: "planning", label: "Planning and product", hint: "PRDs, scope, flows, structure and how FlowCode reports back" },
  { id: "design", label: "Design and UX", hint: "Layout, type, states, forms, motion and responsive behavior" },
  { id: "recipes", label: "Component recipes", hint: "Ready patterns for cards, pricing, sign-in, toasts and more" },
  { id: "process", label: "Build process", hint: "Tests first, root-cause debugging, small steps, simplifying and proving it works" },
  { id: "quality", label: "Review and checks", hint: "Accessibility, code and design review, audits, security and performance" },
  { id: "code", label: "Code and data", hint: "React patterns, stacks, backends, databases, patches and type errors" },
  { id: "growth", label: "Copy, SEO and growth", hint: "Interface and landing copy, conversion, pricing, SEO, metadata and analytics" },
  { id: "learned", label: "Learned from builds", hint: "Fixes FlowCode proposed after a step went wrong" },
  { id: "yours", label: "Your skills", hint: "Skills you added or imported" },
];

const BY_ID: Record<string, SkillCategory> = {
  "skill.prd-intake": "planning",
  "skill.feature-discovery-mvp": "planning",
  "skill.ux-flow-information-architecture": "planning",
  "skill.ux-architecture": "planning",
  "skill.project-rules": "planning",
  "skill.repository-map": "planning",
  "skill.acceptance-checks": "planning",
  "skill.prepare-release-notes": "planning",
  "skill.plain-language-communication": "planning",
  "skill.ai-assisted-workflow": "planning",
  "skill.design-critique-ux-qa": "quality",
  "skill.visual-qa-verification": "quality",
  "skill.audit-accessibility": "quality",
  "skill.generate-component": "recipes",
  "skill.postgres": "code",
  "skill.python": "code",
  "skill.angular": "code",
  "skill.database-backed-feature": "code",
  "skill.local-database": "code",
  "skill.data-simulation-scenarios": "code",
  "skill.exact-patch": "code",
  "skill.fix-typescript-error": "code",
  // From the AgenticSkills directory (packages/daemon/src/knowledge/skillLibrary.ts); the rest of it is design.
  "skill.brainstorming-design-gate": "planning",
  "skill.writing-plans": "planning",
  "skill.spec-driven-development": "planning",
  "skill.planning-task-breakdown": "planning",
  "skill.recursive-decomposition": "planning",
  "skill.planning-with-files": "planning",
  "skill.positioning-brief": "planning",
  "skill.launch-pages-plan": "planning",
  "skill.content-hub-plan": "planning",
  "skill.designer-research": "planning",
  "skill.designer-ux-strategy": "planning",
  "skill.anthropic-design-user-research": "planning",
  "skill.anthropic-design-research-synthesis": "planning",
  "skill.anthropic-design-handoff": "planning",
  "skill.documentation-adrs": "planning",
  "skill.impeccable-shape": "planning",
  "skill.taste-design-read": "planning",
  "skill.landing-page-structure": "planning",
  "skill.executing-plans": "process",
  "skill.systematic-debugging": "process",
  "skill.test-driven-development": "process",
  "skill.verification-before-completion": "process",
  "skill.incremental-implementation": "process",
  "skill.debugging-error-recovery": "process",
  "skill.code-simplification": "process",
  "skill.receiving-code-review": "process",
  "skill.ui-flow-tests": "process",
  "skill.playwright-e2e": "process",
  "skill.requesting-code-review": "quality",
  "skill.sentry-code-review": "quality",
  "skill.find-bugs": "quality",
  "skill.code-review-quality": "quality",
  "skill.anthropic-design-critique": "quality",
  "skill.impeccable-critique": "quality",
  "skill.impeccable-audit": "quality",
  "skill.impeccable-harden": "quality",
  "skill.jakub-interface-review": "quality",
  "skill.jakub-better-interface": "quality",
  "skill.jakub-break": "quality",
  "skill.designer-visual-critique": "quality",
  "skill.designer-ops-qa": "quality",
  "skill.web-design-guidelines-review": "quality",
  "skill.web-design-guidelines-forms-focus": "quality",
  "skill.web-performance-audit": "quality",
  "skill.security-threat-model": "quality",
  "skill.frontend-security-defaults": "quality",
  "skill.site-audit-fix-loop": "quality",
  "skill.emil-review-animations": "quality",
  "skill.emil-improve-animations": "quality",
  "skill.landing-page-ship-checklist": "quality",
  "skill.web-design-engineer-craft-check": "quality",
  "skill.taste-content-tells": "quality",
  "skill.dialog-focus-aria-fixes": "quality",
  "skill.platform-web-wcag": "quality",
  "skill.react-performance-rules": "code",
  "skill.react-composition-patterns": "code",
  "skill.react-view-transitions": "code",
  "skill.frontend-ui-engineering": "code",
  "skill.postgres-rls-indexing": "code",
  "skill.choose-backend": "code",
  "skill.shadcn-cli": "code",
  "skill.motion-performance-fixes": "code",
  "skill.emil-ask-sonner": "code",
  "skill.emil-pick-ui-library": "code",
  "skill.conversion-copywriting": "growth",
  "skill.copy-editing-sweeps": "growth",
  "skill.humanize-ai-text": "growth",
  "skill.landing-page-cro": "growth",
  "skill.pricing-packaging": "growth",
  "skill.behavioral-design": "growth",
  "skill.analytics-event-plan": "growth",
  "skill.structured-data-jsonld": "growth",
  "skill.seo-audit-checklist": "growth",
  "skill.seo-aeo-metadata": "growth",
  "skill.page-metadata": "growth",
  "skill.landing-page-copy": "growth",
  "skill.anthropic-design-ux-copy": "growth",
  "skill.jakub-better-writing": "growth",
  "skill.designer-ux-writing": "growth",
};

export function categoryOf(s: SkillSpec): SkillCategory {
  if (BY_ID[s.id]) return BY_ID[s.id];
  if (s.id.startsWith("skill.recipe-")) return "recipes";
  if (s.id.startsWith("skill.proposed-")) return "learned";
  if (s.source === "user") return "yours";
  return "design";
}

/** Matches the words typed against a skill's name, purpose, triggers and roles (every word must appear). */
export function skillMatches(s: SkillSpec, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [s.id.replace(/^skill\./, "").replace(/[-_.]+/g, " "), s.purpose, ...(s.triggers ?? []), ...(s.roles ?? [])].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}
