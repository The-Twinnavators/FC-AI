/** @flowcode-library bg-ink · Ink band (Page backgrounds)
 * Catalog ID: c.background.ink (component)
 * Function: The ink page background (c.background.ink): a closing call to action or a stats band; implemented in bg-soft.tsx.
 * Use it as: A ready-to-place c.background.ink: copy bg-ink.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: c.background.ink
 * Look: A solid accent band with a soft highlight; text switches to the on-accent color (use a Button on-accent).
 * Use cases: call to action band; stats band; promo section; newsletter section; highlight section; closing section
 * Jobs to be done: notice the key invitation; see a clear break between sections; take the next step
 * Keywords: background, gradient, page background, ink
 */
/**
 * c.background.ink: the "ink" variant of the Background component in ./bg-soft.tsx (c.background). Page background: ink band (gradient). The accent color as a solid band with a soft highlight; text switches to the on-accent color.
 * Good for: A closing call to action or a stats band.
 * Use it with <Background variant="ink"> or by adding the class "fl-bg-ink" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import { Background, BackgroundContent } from "./bg-soft";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Ink band",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
  onAccent: true,
};

export default function BgInk() {
  return (
    <Background variant="ink" aria-labelledby="bg-ink-title">
      <BackgroundContent id="bg-ink-title" {...SAMPLE} onAccent />
    </Background>
  );
}
