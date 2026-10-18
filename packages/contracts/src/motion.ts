/**
 * Motion, as part of the Look (appearance.motion): how much the app moves, never whether it respects reduced motion.
 *
 * - The level (Minimal, Balanced, Expressive) sets the amount: durations, travel, stagger and its caps. It is a token
 *   set, written with the rest of the appearance through the same draft → select → apply path.
 * - Expressive capabilities (hero, section reveal, product demo, parallax, smooth scrolling, ambient background) are
 *   approved per project in the Look, but a page only gets one when its purpose is eligible (a homepage, marketing page
 *   or portfolio). An opt-in made for the homepage never reaches the app's own screens. Balanced alone enables none.
 * - Reduced motion (the person's system setting) overrides every level; "animation off" removes all of it. Both live in
 *   the app's motion stylesheet and helpers (template: src/styles/motion.css, src/lib/motion.ts), not here.
 */

export const MOTION_LEVELS = ["minimal", "balanced", "expressive"] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];

export const EXPRESSIVE_FEATURES = ["hero", "sectionReveal", "productDemo", "parallax", "smoothScroll", "ambient"] as const;
export type ExpressiveFeature = (typeof EXPRESSIVE_FEATURES)[number];

/** What a page is for. Only the expressive purposes can carry expressive motion. */
export const PAGE_PURPOSES = ["app", "homepage", "marketing", "portfolio"] as const;
export type PagePurpose = (typeof PAGE_PURPOSES)[number];
export const EXPRESSIVE_PAGES: readonly PagePurpose[] = ["homepage", "marketing", "portfolio"];

export interface MotionSetting {
  level: MotionLevel;
  /** Expressive capabilities approved for this project's eligible pages (none unless chosen). */
  expressive?: ExpressiveFeature[];
}

export const MOTION_LABEL: Record<MotionLevel, { name: string; detail: string }> = {
  minimal: { name: "Minimal", detail: "Feedback and state changes only: quick fades, no travel, no stagger" },
  balanced: { name: "Balanced", detail: "Short, purposeful movement for feedback, dialogs, pages and results" },
  expressive: { name: "Expressive", detail: "Longer, livelier movement; enables the expressive effects you approve, on homepage, marketing and portfolio pages only" },
};

/**
 * The motion tokens per level. (How far a press scales is the surface style's --press-scale, not motion's.) Balanced
 * preserves the starter's previous timing defaults; applying motion to an existing app still changes other behaviour
 * (reduced motion keeps short fades, page transitions and the motion stylesheet arrive). Stagger is capped twice: by steps (how many items get their own delay) and by total delay, so no item
 * waits longer than --stagger-max to start, at any level.
 */
const LEVEL_TOKENS: Record<MotionLevel, Record<string, string>> = {
  minimal: {
    "--duration-instant": "60ms",
    "--duration-fast": "100ms",
    "--duration-base": "140ms",
    "--duration-slow": "180ms",
    "--enter-distance": "0px",
    "--stagger": "0ms",
    "--stagger-steps": "0",
    "--stagger-max": "0ms",
  },
  balanced: {
    "--duration-instant": "80ms",
    "--duration-fast": "120ms",
    "--duration-base": "200ms",
    "--duration-slow": "320ms",
    "--enter-distance": "8px",
    "--stagger": "40ms",
    "--stagger-steps": "5",
    "--stagger-max": "200ms",
  },
  expressive: {
    "--duration-instant": "90ms",
    "--duration-fast": "160ms",
    "--duration-base": "260ms",
    "--duration-slow": "420ms",
    "--enter-distance": "16px",
    "--stagger": "50ms",
    "--stagger-steps": "6",
    "--stagger-max": "300ms",
  },
};

export function motionTokens(level: MotionLevel): Record<string, string> {
  return { ...LEVEL_TOKENS[level], "--motion-level": level };
}

/** The start delay for the i-th item at a level: capped by steps and by total, so essential content is never held back. */
export function staggerDelay(level: MotionLevel, index: number): number {
  const t = LEVEL_TOKENS[level];
  const step = parseFloat(t["--stagger"]!);
  const steps = parseFloat(t["--stagger-steps"]!);
  const max = parseFloat(t["--stagger-max"]!);
  return Math.min(Math.min(Math.max(index, 0), steps) * step, max);
}

/**
 * Whether a page may use an expressive capability: the project's Look approved it, the level isn't Minimal, and the
 * page's purpose is eligible. Balanced or Expressive alone never enables one; neither does an opt-in on an app screen.
 */
export function expressiveAllowed(motion: MotionSetting | undefined, feature: ExpressiveFeature, page: PagePurpose): boolean {
  if (!motion || motion.level === "minimal") return false;
  if (!motion.expressive?.includes(feature)) return false;
  return EXPRESSIVE_PAGES.includes(page);
}

export function motionProblems(m: MotionSetting): string[] {
  const out: string[] = [];
  if (!MOTION_LEVELS.includes(m.level)) out.push(`motion level "${m.level}" doesn't exist (use minimal, balanced or expressive)`);
  for (const f of m.expressive ?? []) if (!EXPRESSIVE_FEATURES.includes(f)) out.push(`expressive capability "${f}" doesn't exist`);
  return out;
}
