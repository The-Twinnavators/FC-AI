/** @flowcode-library bg-grid · Fading grid (Page backgrounds)
 * Catalog ID: c.background.grid (component)
 * Function: The grid page background (c.background.grid): developer and data products; behind a hero; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.grid: copy bg-grid.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.grid
 * Look: Faint grid lines that fade out toward the edges.
 * Use cases: hero background; developer tool landing; saas homepage; technical product page; launch page; feature section
 * Jobs to be done: focus on the headline; feel the product is precise and technical; notice a launch or announcement
 * Keywords: background, pattern, page background, grid
 */
/**
 * c.background.grid: the "grid" variant of the Background component in ./bg-soft.tsx (c.background). Page background: fading grid (pattern). Faint grid lines that fade out towards the edges.
 * Good for: Developer and data products; behind a hero.
 * Use it with <Background variant="grid"> or by adding the class "fl-bg-grid" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Fading grid",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgGrid() {
  return (
    <Background variant="grid" aria-labelledby="bg-grid-title">
      <BackgroundContent id="bg-grid-title" {...SAMPLE} />
    </Background>
  );
}
