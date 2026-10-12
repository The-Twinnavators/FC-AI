/** @flowcode-library bg-glow · Top glow (Page backgrounds)
 * Catalog ID: c.background.glow (component)
 * Function: The glow page background (c.background.glow): product launches and hero sections over a plain page; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.glow: copy bg-glow.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.glow
 * Look: A spotlight of the accent color glowing from the top edge.
 * Use cases: hero background; launch page; dark landing page; product announcement; pricing highlight; sign in page background
 * Jobs to be done: focus on the headline; notice what's new; feel the product is modern and polished
 * Keywords: background, gradient, page background, glow
 */
/**
 * c.background.glow: the "glow" variant of the Background component in ./bg-soft.tsx (c.background). Page background: top glow (gradient). A spotlight of the accent color from the top edge.
 * Good for: Product launches and hero sections over a plain page.
 * Use it with <Background variant="glow"> or by adding the class "fl-bg-glow" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Top glow",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgGlow() {
  return (
    <Background variant="glow" aria-labelledby="bg-glow-title">
      <BackgroundContent id="bg-glow-title" {...SAMPLE} />
    </Background>
  );
}
