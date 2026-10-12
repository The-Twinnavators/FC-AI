/** @flowcode-library bg-waves · Waves (Page backgrounds)
 * Catalog ID: c.background.waves (component)
 * Function: The waves page background (c.background.waves): wellness, travel, water or calm brands; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.waves: copy bg-waves.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.waves
 * Look: Repeating wave lines in the accent color.
 * Use cases: hero background; travel site; wellness site; music or audio product; landing page section; event page
 * Jobs to be done: feel calm and at ease; focus on the main message; enjoy a relaxed, flowing page
 * Keywords: background, pattern, page background, waves
 */
/**
 * c.background.waves: the "waves" variant of the Background component in ./bg-soft.tsx (c.background). Page background: waves (pattern). Repeating wave lines in the accent color.
 * Good for: Wellness, travel, water or calm brands.
 * Use it with <Background variant="waves"> or by adding the class "fl-bg-waves" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Waves",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgWaves() {
  return (
    <Background variant="waves" aria-labelledby="bg-waves-title">
      <BackgroundContent id="bg-waves-title" {...SAMPLE} />
    </Background>
  );
}
