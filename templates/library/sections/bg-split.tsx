/** @flowcode-library bg-split · Diagonal split (Page backgrounds)
 * Catalog ID: c.background.split (component)
 * Function: The split page background (c.background.split): sections pairing a promise with a picture or form; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.split: copy bg-split.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.split
 * Look: Two tones divided on a diagonal, accent tint above and page color below.
 * Use cases: hero background; landing page section; sign in page background; feature highlight; promo section; portfolio header
 * Jobs to be done: see a clear break between sections; focus on the main message; tell the two halves of a page apart
 * Keywords: background, gradient, page background, split
 */
/**
 * c.background.split: the "split" variant of the Background component in ./bg-soft.tsx (c.background). Page background: diagonal split (gradient). Two tones divided on a diagonal.
 * Good for: Sections that pair a promise with a picture or a form.
 * Use it with <Background variant="split"> or by adding the class "fl-bg-split" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Diagonal split",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgSplit() {
  return (
    <Background variant="split" aria-labelledby="bg-split-title">
      <BackgroundContent id="bg-split-title" {...SAMPLE} />
    </Background>
  );
}
