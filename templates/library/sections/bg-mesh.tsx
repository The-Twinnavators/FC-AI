/** @flowcode-library bg-mesh · Mesh gradient (Page backgrounds)
 * Catalog ID: c.background.mesh (component)
 * Function: The mesh page background (c.background.mesh): lively hero sections and landing pages; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.mesh: copy bg-mesh.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.mesh
 * Look: Soft color blooms in the corners from the accent, success and focus colors.
 * Use cases: hero background; landing page background; launch page; creative portfolio; product announcement; event page
 * Jobs to be done: feel the brand's personality; notice a launch or announcement; focus on the main message
 * Keywords: background, gradient, page background, mesh
 */
/**
 * c.background.mesh: the "mesh" variant of the Background component in ./bg-soft.tsx (c.background). Page background: mesh gradient (gradient). Soft color blooms in the corners from the accent, success and focus colors.
 * Good for: Hero sections and landing pages that should feel lively.
 * Use it with <Background variant="mesh"> or by adding the class "fl-bg-mesh" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Mesh gradient",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgMesh() {
  return (
    <Background variant="mesh" aria-labelledby="bg-mesh-title">
      <BackgroundContent id="bg-mesh-title" {...SAMPLE} />
    </Background>
  );
}
