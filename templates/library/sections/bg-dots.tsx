/** @flowcode-library bg-dots · Dot grid (Page backgrounds)
 * Catalog ID: c.background.dots (component)
 * Function: The dots page background (c.background.dots): tools and technical products; behind cards or diagrams; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.dots: copy bg-dots.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.dots
 * Look: A fine grid of faint dots in the text color.
 * Use cases: hero background; developer tool landing; docs page background; feature section; technical product page; portfolio background
 * Jobs to be done: focus on the content on a subtle backdrop; feel the product is precise and technical; read the page without visual clutter
 * Keywords: background, pattern, page background, dots
 */
/**
 * c.background.dots: the "dots" variant of the Background component in ./bg-soft.tsx (c.background). Page background: dot grid (pattern). A fine grid of dots in the text color.
 * Good for: Tools and technical products; behind cards or diagrams.
 * Use it with <Background variant="dots"> or by adding the class "fl-bg-dots" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Dot grid",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgDots() {
  return (
    <Background variant="dots" aria-labelledby="bg-dots-title">
      <BackgroundContent id="bg-dots-title" {...SAMPLE} />
    </Background>
  );
}
