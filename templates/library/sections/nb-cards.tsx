/** @flowcode-library nb-cards · Neobrutal cards (neobrutal) (Cards)
 * Catalog ID: c.card@neobrutal (component version)
 * Version of: c.card
 * Function: A feature card, a pricing card with a tilted sticker badge and a profile card with stats and a follow toggle, all in thick borders and hard shadows.
 * Use it as: import { Card } from "./cards-variants"; <Card version="neobrutal" variant?="plain"|"clickable"|"selectable" accent? selected? tag?="Most picked" icon? avatar?="MO" lead?={<h3>Name</h3>} stats?={[{ label, value }]} footer?={<Button version="neobrutal" …/>}>content</Card>
 * Look: A thick ink border and a hard offset shadow; it lifts up and left on hover, a chosen card turns green with a deeper shadow, and it can carry a tilted sticker, a stats strip and a 4rem avatar with its own hard shadow.
 * Tokens: --color-text --color-surface --color-success --color-danger --color-secondary --color-accent --color-on-accent --radius-sm --space-4 --space-6 --duration-fast --font-sans
 * Use cases: pricing card; profile card; feature card; plan picker; team member card; creator profile; bold product page
 * Jobs to be done: choose a plan; follow a person i like; learn about a key feature
 * Keywords: cards, pricing, profile, feature, sticker, neobrutalism
 */
/**
 * Neobrutalist cards: a feature card, a pricing card with a tilted sticker badge, and a profile card with a follow
 * toggle. This is c.card@neobrutal with this piece's sample content; the implementation lives in the component, in
 * ./cards-variants. Use them for a bold product page, a plan picker or a team page. Make it the app's own: replace
 * SAMPLE with the real feature, plan and person; the plan choice and follow state stay on the page.
 */
import { NeobrutalCards } from "./cards-variants";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Cards",
  title: "Blocks with a bit of attitude",
  feature: {
    icon: "bolt",
    title: "Book in ten seconds",
    text: "Pick a class, pick a time, done. No account needed for your first visit.",
    link: "How booking works",
  },
  pricing: {
    sticker: "Most picked",
    name: "Studio pass",
    price: "$39",
    per: "/month",
    text: "Four classes a month at any of our two studios.",
    features: ["4 classes each month", "Free mat and apron", "Bring a friend once"],
    choose: "Choose Studio pass",
    chosen: "Studio pass chosen",
  },
  profile: {
    initials: "MO",
    name: "Mira Okafor",
    role: "Ceramics teacher",
    bio: "Teaches wheel throwing on weekday evenings. Twelve years at the studio.",
    stats: [
      { label: "Classes", value: "214" },
      { label: "Students", value: "1.3k" },
      { label: "Rating", value: "4.9" },
    ],
    followers: 318,
  },
};

export default function NbCards() {
  return <NeobrutalCards {...SAMPLE} />;
}
