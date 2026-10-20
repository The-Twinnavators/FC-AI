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
 * The build levels people choose, over the autonomy levels the runner enforces (autonomy.ts): new names, the same
 * policy. What each one does for the person is AUTONOMY_LEVELS' own `forYou`, so the words match what runs.
 */
export const BUILD_LEVELS: Array<{ id: AutonomyLevel; name: string; experience: string }> = [
  { id: "supervised", name: "Guided", experience: "You approve each consequential step: plans with any risk, downloads, deletes and programs FlowCode hasn't checked." },
  { id: "assisted", name: "Collaborative", experience: "Routine work runs on its own. FlowCode asks you about real risk and new packages." },
  { id: "autonomous", name: "Autonomous", experience: "Works start to finish within the project. It still asks before anything leaves this computer, and every change can be undone." },
];

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
});
export type ProjectSetupPatch = z.infer<typeof ProjectSetupPatch>;
