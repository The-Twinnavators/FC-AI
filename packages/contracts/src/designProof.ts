/**
 * Design proofs: custom design concepts the designer agent makes while a build is planned, when the person lets
 * FlowCode decide the design. Each proof is a design specification (type, palette, density, surface, corners) and a
 * composition of the build's main screen: its frame, layout and content blocks, written with the project's own words.
 * FlowCode draws the composition with its own components (proof-preview.html), so a proof is always readable, and the
 * same specification is what the build applies once the person approves it. A proof is a proposal, never a screenshot
 * of a built app.
 */
import { z } from "zod";

const Line = z.string().trim().min(1).max(160);
const Text = z.string().trim().max(400);
const Items = <T extends z.ZodTypeAny>(t: T, min: number, max: number) => z.array(t).min(min).max(max);

/** The content blocks a proof's screen is composed from. Each holds the project's own words. */
export const ProofBlock = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("intro"), variant: z.enum(["banner", "split", "compact", "centered"]), eyebrow: Line.optional(), title: Line, body: Text.optional(), action: Line.optional(), secondary: Line.optional() }),
  z.object({ kind: z.literal("cards"), title: Line.optional(), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]), items: Items(z.object({ title: Line, body: Text.optional(), meta: Line.optional(), tag: Line.optional() }), 2, 8) }),
  z.object({ kind: z.literal("list"), title: Line.optional(), items: Items(z.object({ title: Line, meta: Line.optional(), status: Line.optional() }), 2, 8) }),
  z.object({ kind: z.literal("schedule"), title: Line.optional(), days: Items(Line, 2, 7), items: Items(z.object({ day: Line, time: Line, title: Line, meta: Line.optional() }), 2, 14) }),
  z.object({ kind: z.literal("stats"), items: Items(z.object({ label: Line, value: Line, note: Line.optional() }), 2, 4) }),
  z.object({ kind: z.literal("form"), title: Line, fields: Items(z.object({ label: Line, type: z.enum(["text", "select", "date", "textarea", "number"]) }), 1, 6), action: Line }),
  z.object({ kind: z.literal("table"), title: Line.optional(), columns: Items(Line, 2, 5), rows: Items(Items(Line, 2, 5), 2, 6) }),
  z.object({ kind: z.literal("feature"), title: Line, body: Text, bullets: Items(Line, 0, 5).optional() }),
  z.object({ kind: z.literal("callout"), title: Line, body: Text.optional(), action: Line.optional() }),
  z.object({ kind: z.literal("filters"), chips: Items(Line, 2, 8) }),
  z.object({ kind: z.literal("detail"), title: Line, meta: Line.optional(), body: Text, action: Line.optional() }),
]);
export type ProofBlock = z.infer<typeof ProofBlock>;

/** The main screen, composed: its frame (navigation), layout and blocks (main column, and an aside when it has one). */
export const ProofScreen = z.object({
  /** The screen's name in the app ("Class schedule"). */
  title: Line,
  /** What the person does here, in one sentence. */
  purpose: Text,
  product: Line,
  frame: z.enum(["top-nav", "side-nav", "minimal"]),
  nav: Items(Line, 2, 7),
  layout: z.enum(["single", "main-aside", "split"]),
  main: Items(ProofBlock, 1, 5),
  aside: Items(ProofBlock, 0, 3).optional(),
});
export type ProofScreen = z.infer<typeof ProofScreen>;

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
  screen?: ProofScreen;
  /** Library skills the designer was given, by name (only ones that exist in this FlowCode). */
  skills?: string[];
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
  rounds: ProofRound[];
  chosen?: string;
  approved?: { at: string; proofId: string };
  /** What the person said before the build (preferences, what to avoid), passed to every proof. */
  brief?: { preferences?: string; avoid?: string; inspiration?: string[] };
}

export const proofsDone = (p: DesignProofs) => p.rounds.every((r) => r.proofs.every((x) => x.status === "ready" || x.status === "failed"));
export const proofById = (p: DesignProofs, id?: string) => (id ? p.rounds.flatMap((r) => r.proofs).find((x) => x.id === id) : undefined);
