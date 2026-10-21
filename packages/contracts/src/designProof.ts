/**
 * Design proofs: custom design concepts the designer agent makes while a build is planned, when the person lets
 * FlowCode decide the design. Each proof is a design specification (type, palette, density, surface, corners) and the
 * product's home page composed from the Component library's own sections (a hero, what it does, proof, a call to
 * action, a footer), filled with the project's own words. FlowCode draws it with those sections (proof-preview.html),
 * and the same specification is what the build applies once the person approves it. A proof is a proposal, never a
 * screenshot of a built app.
 */
import { z } from "zod";

/**
 * The library page blocks a proof's home page is composed from: each a real section of FlowCode's Component library,
 * drawn with the agent's content (its props) in the proof's tokens. `component` is the section file's named export.
 */
export const PROOF_BLOCKS = [
  { id: "top-nav-variants", component: "TopNav", role: "nav", use: "The site's top bar: brand, links and the main action (variant \"marketing\")." },
  { id: "hero-split", component: "HeroSplit", role: "hero", use: "Words on the left, a picture of the product or place on the right." },
  { id: "hero-centered", component: "HeroCentered", role: "hero", use: "A centered headline and actions; calm and direct." },
  { id: "hero-stats", component: "HeroStats", role: "hero", use: "A headline with three or four proof numbers beside it." },
  { id: "hero-gradient", component: "HeroGradient", role: "hero", use: "A bold headline with an emphasized phrase and an announcement badge." },
  { id: "features-grid", component: "FeaturesGrid", role: "info", use: "Three to six features, each an icon, a title and a sentence." },
  { id: "features-alternating", component: "FeaturesAlternating", role: "info", use: "Two or three rows alternating words and a picture: how it works in depth." },
  { id: "features-checklist", component: "FeaturesChecklist", role: "info", use: "A short list of what's included." },
  { id: "stats-band", component: "StatsBand", role: "info", use: "A band of up to four numbers that prove it works." },
  { id: "testimonials-cards", component: "TestimonialsCards", role: "social", use: "Three quotes from the people who use it." },
  { id: "testimonial-feature", component: "TestimonialFeature", role: "social", use: "One large quote." },
  { id: "pricing-tiers", component: "PricingTiers", role: "info", use: "Plans or passes with prices." },
  { id: "faq-accordion", component: "FaqAccordion", role: "info", use: "Questions people ask before they sign up." },
  { id: "cta-banner", component: "CtaBanner", role: "cta", use: "A closing call to action." },
  { id: "cta-split", component: "CtaSplit", role: "cta", use: "A closing call to action beside a picture." },
  { id: "footer-columns", component: "FooterColumns", role: "footer", use: "Brand, a line about it, link columns and legal links." },
  { id: "footer-simple", component: "FooterSimple", role: "footer", use: "Brand, a few links and the year." },
] as const;
export type ProofBlockId = (typeof PROOF_BLOCKS)[number]["id"];

/** A proof's home page: library blocks in order, each with the agent's content for it. */
export const ProofPage = z.object({
  sections: z
    .array(z.object({ block: z.enum(PROOF_BLOCKS.map((b) => b.id) as [ProofBlockId, ...ProofBlockId[]]), props: z.record(z.string(), z.unknown()) }))
    .min(4)
    .max(9),
});
export type ProofPage = z.infer<typeof ProofPage>;

export type ProofStatus = "queued" | "working" | "ready" | "failed";

/** One proof: its direction, specification (as tokens to draw it), composition and the skills it was made with. */
export interface DesignProof {
  id: string;
  /** "Proof A". */
  label: string;
  status: ProofStatus;
  /** Why it failed, in plain words, when it did. */
  error?: string;
  name?: string;
  /** Its design rationale: why this direction fits this product. */
  rationale?: string;
  /** The design specification (daemon DesignSpec), kept whole: it is what the build applies. */
  spec?: unknown;
  /** The specification's tokens, to draw the proof. */
  tokens?: Record<string, string>;
  page?: ProofPage;
  /** Library skills the designer was given, by name (only ones that exist in this FlowCode). */
  skills?: string[];
  /** Openly licensed photos it uses (Openverse; CC0, public domain or CC BY), with their credit. */
  photos?: Array<{ title: string; creator: string; license: string; source: string }>;
  /** A short summary of its settings: type, colors, surface, corners, spacing. */
  settings?: Array<{ label: string; value: string }>;
  /** The proof it revises, and the feedback it answers. */
  revises?: string;
  feedback?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ProofRound {
  id: string;
  at: string;
  /** What the person asked to change (every round after the first). */
  feedback?: string;
  proofs: DesignProof[];
}

/** A build's design proofs: every round, the chosen proof, and the person's approval. */
export interface DesignProofs {
  runId: string;
  projectId?: string;
  rounds: ProofRound[];
  chosen?: string;
  approved?: { at: string; proofId: string };
  /** What the person said before the build (preferences, what to avoid), passed to every proof. */
  brief?: { preferences?: string; avoid?: string; inspiration?: string[] };
}

/** A photo saved in the project for a proof: props hold "fc-image:images/<file>"; the review turns it into an address. */
export const PROOF_IMAGE = "fc-image:";

export const proofsDone = (p: DesignProofs) => p.rounds.every((r) => r.proofs.every((x) => x.status === "ready" || x.status === "failed"));
export const proofById = (p: DesignProofs, id?: string) => (id ? p.rounds.flatMap((r) => r.proofs).find((x) => x.id === id) : undefined);
