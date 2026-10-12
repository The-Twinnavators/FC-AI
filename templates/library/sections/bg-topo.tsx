/** @flowcode-library bg-topo · Contour lines (Page backgrounds)
 * Catalog ID: c.background.topo (component)
 * Function: The topo page background (c.background.topo): outdoor, maps, travel and exploration products; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.topo: copy bg-topo.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.topo
 * Look: Topographic contour lines in the text color.
 * Use cases: outdoor brand site; travel site; maps or location product; adventure booking; hero background; about section
 * Jobs to be done: feel a sense of exploration; focus on the main message; enjoy an outdoorsy, natural feel
 * Keywords: background, pattern, page background, topo
 */
/**
 * c.background.topo: the "topo" variant of the Background component in ./bg-soft.tsx (c.background). Page background: contour lines (pattern). Topographic contour lines in the text color.
 * Good for: Outdoor, maps, travel and exploration products.
 * Use it with <Background variant="topo"> or by adding the class "fl-bg-topo" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Contour lines",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgTopo() {
  return (
    <Background variant="topo" aria-labelledby="bg-topo-title">
      <BackgroundContent id="bg-topo-title" {...SAMPLE} />
    </Background>
  );
}
