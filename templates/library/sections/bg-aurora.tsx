/** @flowcode-library bg-aurora · Aurora (Page backgrounds)
 * Catalog ID: c.background.aurora (component)
 * Function: The aurora page background (c.background.aurora): one standout moment such as a launch hero or sign-up page; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.aurora: copy bg-aurora.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.aurora
 * Look: A slowly turning blurred blend of theme colors (still when reduced motion is requested).
 * Use cases: hero background; launch page; ai product landing; creative portfolio; event page; coming soon page
 * Jobs to be done: feel the brand's personality; focus on the main message; notice a launch or announcement
 * Keywords: background, gradient, page background, aurora
 */
/**
 * c.background.aurora: the "aurora" variant of the Background component in ./bg-soft.tsx (c.background). Page background: aurora (gradient). A slowly turning, blurred blend of the theme colors (still for people who ask for less motion).
 * Good for: One standout moment: a launch hero or a sign-up page.
 * Use it with <Background variant="aurora"> or by adding the class "fl-bg-aurora" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Aurora",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgAurora() {
  return (
    <Background variant="aurora" aria-labelledby="bg-aurora-title">
      <BackgroundContent id="bg-aurora-title" {...SAMPLE} />
    </Background>
  );
}
