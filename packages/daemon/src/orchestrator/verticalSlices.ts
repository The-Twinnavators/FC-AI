/**
 * Feature steps are one user journey each, finished end to end.
 *
 * The planner used to be asked only for "3-7 FEATURE tasks", so it mirrored the shape of the PRD it was given. The
 * Non-GMO brand finder's PRD has a section for functional requirements, another for accessibility, another for
 * responsive behaviour and another for analytics, and the plan came back the same way: build every screen, then make
 * every screen accessible, then make every screen responsive. Nothing was usable until all of them passed, each step
 * retrofitted the one before, and the run died on "Accessibility requirements: implement keyboard navigation" - a step
 * that was adding keyboard support to a screen no step had written.
 *
 * Those requirements still have to be met; they belong inside the journey that needs them, which is what the planner
 * is now told. This drops the cross-cutting steps if it asks for them anyway.
 */

/** A step named after a quality that spans the app, rather than after something a person does. */
const CROSS_CUTTING =
  /^(?:[\w\s]*\b(?:accessibility|a11y|responsive(?:ness)?|mobile|analytics|telemetry|tracking|instrumentation|performance|seo|internationali[sz]ation|i18n|error handling|loading states?|empty states?)\b)/i;

/** …unless it names a screen or a journey, in which case it is a journey step that happens to mention the quality. */
const NAMES_A_JOURNEY = /\b(?:screen|page|view|journey|flow|list|detail|search|browse|form|checkout|dashboard)\b/i;

export interface PlannedStep {
  title: string;
  objective?: string;
}

/** Whether this step is a layer across the whole app rather than one journey through it. */
export function isCrossCutting(step: PlannedStep): boolean {
  const title = step.title.trim();
  if (!CROSS_CUTTING.test(title)) return false;
  return !NAMES_A_JOURNEY.test(title);
}

/**
 * The journeys from a planner's answer, and the layers it should not have planned. Nothing is dropped when every step
 * looks cross-cutting: a plan of none is worse than a plan of the wrong shape, and the run would have nothing to build.
 */
export function verticalSlices<T extends PlannedStep>(steps: readonly T[]): { kept: T[]; dropped: T[] } {
  const dropped = steps.filter(isCrossCutting);
  if (!dropped.length || dropped.length === steps.length) return { kept: [...steps], dropped: [] };
  return { kept: steps.filter((s) => !isCrossCutting(s)), dropped };
}
