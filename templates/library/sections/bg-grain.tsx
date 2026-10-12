/** @flowcode-library bg-grain · Film grain (Page backgrounds)
 * Catalog ID: c.background.grain (component)
 * Function: The grain page background (c.background.grain): editorial, craft and premium brands; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.grain: copy bg-grain.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.grain
 * Look: A subtle paper-like grain over the page color.
 * Use cases: editorial site; portfolio; studio website; blog background; craft brand site; restaurant site
 * Jobs to be done: enjoy a warm, crafted feel; read comfortably on a textured page; focus on the words and pictures
 * Keywords: background, pattern, page background, grain
 */
/**
 * c.background.grain: the "grain" variant of the Background component in ./bg-soft.tsx (c.background). Page background: film grain (pattern). A subtle paper-like grain over the page color.
 * Good for: Editorial, craft and premium brands; pairs well with serif type.
 * Use it with <Background variant="grain"> or by adding the class "fl-bg-grain" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Film grain",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgGrain() {
  return (
    <Background variant="grain" aria-labelledby="bg-grain-title">
      <BackgroundContent id="bg-grain-title" {...SAMPLE} />
    </Background>
  );
}
