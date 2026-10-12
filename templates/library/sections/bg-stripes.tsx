/** @flowcode-library bg-stripes · Diagonal stripes (Page backgrounds)
 * Catalog ID: c.background.stripes (component)
 * Function: The stripes page background (c.background.stripes): playful sections and promotional banners; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.stripes: copy bg-stripes.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.stripes
 * Look: Thin diagonal stripes in a light accent tint.
 * Use cases: promo section; sale banner background; highlight section; construction or coming soon page; call to action band
 * Jobs to be done: notice a highlighted section; see a clear break between sections; find out about a sale or offer
 * Keywords: background, pattern, page background, stripes
 */
/**
 * c.background.stripes: the "stripes" variant of the Background component in ./bg-soft.tsx (c.background). Page background: diagonal stripes (pattern). Thin diagonal stripes in the accent color.
 * Good for: Playful sections and promotional banners.
 * Use it with <Background variant="stripes"> or by adding the class "fl-bg-stripes" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Diagonal stripes",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgStripes() {
  return (
    <Background variant="stripes" aria-labelledby="bg-stripes-title">
      <BackgroundContent id="bg-stripes-title" {...SAMPLE} />
    </Background>
  );
}
