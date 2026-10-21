/**
 * A project's setup before its first build: what Home ("What would you like to build?"), Look and Feel and Build levels
 * collect. Saved with the project (a draft project) so it survives Back, Next and reloads; Start Build turns it into the
 * project's first run. The look itself lives in the project's design state (draft, selected, applied), not here.
 */
import { z } from "zod";
import type { AutonomyLevel } from "./autonomy.js";
import { BuildMode, ReferenceFile } from "./schemas.js";

/** What kind of product it is: guidance for the plan, never a template that limits it. */
export const PRODUCT_TYPES = [
  { id: "saas", label: "SaaS" },
  { id: "ai-app", label: "AI-powered application" },
  { id: "admin-portal", label: "Admin portal" },
  { id: "social", label: "Social platform" },
  { id: "website", label: "Website" },
  { id: "mobile-app", label: "Mobile application" },
  { id: "online-store", label: "Online store" },
  { id: "marketplace", label: "Marketplace" },
  { id: "internal-tool", label: "Internal tool" },
  { id: "other", label: "Other" },
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number]["id"];
const PRODUCT_TYPE_IDS = PRODUCT_TYPES.map((t) => t.id) as [ProductType, ...ProductType[]];

/**
 * The library page templates that ARE each product type, best first (the first is where Look and Feel starts). Strict:
 * a template is listed only where it is that kind of product (a startup homepage is not a social platform), so a
 * thin type gets new templates rather than borrowed ones. Ids not in the catalog yet are skipped where this is read.
 */
export const TEMPLATES_FOR: Record<ProductType, string[]> = {
  saas: ["home-saas", "app-analytics", "app-settings", "home-startup", "home-devtool"],
  "ai-app": ["app-ai-chat", "app-ai-writer"],
  "admin-portal": ["app-admin", "app-analytics", "app-settings"],
  social: ["app-social-feed", "app-social-messages"],
  website: ["site-agency", "site-cafe", "site-photographer", "site-magazine", "site-real-estate", "site-fitness", "site-nonprofit", "site-event", "site-clinic", "site-coming-soon", "site-docs", "home-personal"],
  "mobile-app": ["app-mobile-home", "app-mobile-order"],
  "online-store": ["app-storefront", "landing-product", "landing-product-clothing", "landing-subscription"],
  marketplace: ["app-marketplace", "app-marketplace-listing"],
  "internal-tool": ["app-kanban", "app-support-inbox", "app-admin", "app-calendar"],
  other: [],
};

/**
 * The build levels people choose, over the autonomy levels the runner enforces (autonomy.ts): new names, the same
 * policy. What each one does for the person is AUTONOMY_LEVELS' own `forYou`, so the words match what runs.
 */
export const BUILD_LEVELS: Array<{ id: AutonomyLevel; name: string; experience: string }> = [
  { id: "supervised", name: "Guided", experience: "You approve each consequential step: plans with any risk, downloads, deletes and programs FlowCode hasn't checked." },
  { id: "assisted", name: "Collaborative", experience: "Routine work runs on its own. FlowCode asks you about real risk and new packages." },
  { id: "autonomous", name: "Autonomous", experience: "Works start to finish within the project. It still asks before anything leaves this computer, and every change can be undone." },
];

/**
 * The design the person approved before the build: what the agents build from. Bound to the Look's version and to the
 * template, fidelity and notes as they were; changing any of them afterward asks for approval again.
 */
export const DesignApproval = z.object({
  at: z.string(),
  lookVersion: z.number().int(),
  template: z.string().max(60),
  fidelity: z.enum(["close", "inspiration"]),
  notes: z.string().max(4000).default(""),
});
export type DesignApproval = z.infer<typeof DesignApproval>;

/** How closely the build follows the chosen template and Look. */
export const DESIGN_FIDELITY = [
  { id: "close", label: "Follow closely", detail: "Keep its visual language and composition; adapt the content and features to this product." },
  { id: "inspiration", label: "Use as inspiration", detail: "A starting point: layout, type, colors, components and imagery may change." },
] as const;
export type DesignFidelity = (typeof DESIGN_FIDELITY)[number]["id"];

export const ProjectSetup = z.object({
  status: z.enum(["draft", "started"]),
  description: z.string().max(20_000),
  productType: z.enum(PRODUCT_TYPE_IDS).optional(),
  references: z.array(ReferenceFile).max(20).default([]),
  extras: z.array(z.string().max(40)).max(20).default([]),
  autonomy: z.enum(["supervised", "assisted", "autonomous"]).default("supervised"),
  coder: z.enum(["local", "cloud"]).default("local"),
  buildMode: BuildMode.optional(),
  /** "Show me three design drafts before building." */
  threeDrafts: z.boolean().default(false),
  /** The library page template chosen in Look and Feel (a LIBRARY_SECTIONS id): the build's starting composition. */
  template: z.string().max(60).optional(),
  /** "mine": the person picks the template and Look. "agents": FlowCode proposes the direction (still approved by them). */
  designMode: z.enum(["mine", "agents"]).default("mine"),
  /** How closely the build follows the chosen design. Unset until the person says. */
  fidelity: z.enum(["close", "inspiration"]).optional(),
  /** "What would you like to change, keep, or add?" (agents mode: the person's design preferences). */
  designNotes: z.string().max(4000).optional(),
  /** Agents mode: what the designs should avoid. */
  designAvoid: z.string().max(2000).optional(),
  /** Agents mode: inspiration (images, notes, links as text files) for the designer. */
  inspiration: z.array(ReferenceFile).max(6).default([]),
  designApproval: DesignApproval.optional(),
  /** The run Start Build created. */
  runId: z.string().optional(),
  updatedAt: z.string(),
});
export type ProjectSetup = z.infer<typeof ProjectSetup>;

/**
 * What Home and the setup pages may change while the setup is a draft. No defaults: a patch changes only what it sends
 * (inheriting ProjectSetup's defaults reset the attachments and the level on every partial save).
 */
export const ProjectSetupPatch = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20_000).optional(),
  productType: z.enum(PRODUCT_TYPE_IDS).optional(),
  references: z.array(ReferenceFile).max(20).optional(),
  extras: z.array(z.string().max(40)).max(20).optional(),
  autonomy: z.enum(["supervised", "assisted", "autonomous"]).optional(),
  coder: z.enum(["local", "cloud"]).optional(),
  buildMode: BuildMode.optional(),
  threeDrafts: z.boolean().optional(),
  template: z.string().max(60).optional(),
  designMode: z.enum(["mine", "agents"]).optional(),
  fidelity: z.enum(["close", "inspiration"]).optional(),
  designNotes: z.string().max(4000).optional(),
  designAvoid: z.string().max(2000).optional(),
  inspiration: z.array(ReferenceFile).max(6).optional(),
});
export type ProjectSetupPatch = z.infer<typeof ProjectSetupPatch>;

/** What still needs the person before the design can be approved: focused questions, never a silent default. */
export function designQuestions(s: Pick<ProjectSetup, "designMode" | "fidelity" | "designNotes">): string[] {
  const q: string[] = [];
  // Agents mode: the design is approved with the plan, from the proofs the designer makes while planning.
  if (s.designMode === "agents") return q;
  if (!s.fidelity) q.push("How closely should FlowCode follow this design?");
  if (s.fidelity === "inspiration" && !s.designNotes?.trim()) q.push("You chose to use it as inspiration: what would you like to change, keep, or add?");
  return q;
}

/** Whether the approval still holds: the same Look version (no unsaved draft), template, fidelity and notes. */
export function designApprovalHolds(s: Pick<ProjectSetup, "designApproval" | "template" | "fidelity" | "designNotes">, look: { version?: number; draftPending: boolean }): boolean {
  const a = s.designApproval;
  return !!a && !look.draftPending && a.lookVersion === look.version && a.template === s.template && a.fidelity === s.fidelity && a.notes === (s.designNotes ?? "");
}
