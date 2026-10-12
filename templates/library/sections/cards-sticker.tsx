/** @flowcode-library cards-sticker · Sticker cards (sticker) (Cards)
 * Catalog ID: c.card@sticker (component version)
 * Version of: c.card
 * Function: Cards built with a tilted sticker tag, an icon tile, a large avatar and lead, a stats row and a footer: feature, pricing and profile.
 * Use it as: import { Card } from "./cards-variants"; <Card version="sticker" tag? accent? avatar? lead? stats?={[{ label, value }]} footer? selectable? selected? onSelect?>…</Card> (StickerCards is the working sheet)
 * Look: A card with a tilted sticker tag, an icon tile, a 4rem avatar beside a lead, a stats row and a footer; it lifts on hover and takes a success tint when chosen. Edges, corners, fill and shadow follow the chosen style and surface.
 * Tokens: --surface-border --surface-radius --surface-radius-sm --surface-bg --surface-shadow --surface-shadow-hover --surface-shadow-selected --surface-edge --surface-blur --edge-width --control-edge --control-radius --control-radius-sm --control-shadow --accent-bg --tag-tilt --hover-lift --hover-shift --color-accent --color-on-accent --color-secondary-surface --color-success --color-surface --color-text --color-text-muted --space-4 --space-6 --text-xl --text-3xl
 * Use cases: feature highlights; pricing plans; team profiles; class cards
 * Jobs to be done: compare plans at a glance; see who someone is
 * Keywords: card, sticker, pricing card, profile card, feature card
 */
/**
 * Sticker cards: a feature card, a pricing card with a tilted sticker tag, and a profile card with a follow toggle.
 * This is c.card@sticker with this piece's sample content; the implementation lives in the component, in
 * ./cards-variants.
 * Construction: a tilted sticker tag pinned to the corner, an icon tile, a 4rem avatar beside a lead (name and role),
 * a row of stats and a footer; the card lifts on hover and a chosen card takes the success tint.
 * Look: edges, corners, fill and shadow follow the chosen style and surface, so the cards are flat, soft, glassy or
 * neobrutal depending on the surface style the app uses.
 * Use them for a product page, a plan picker or a team page. Make it the app's own: replace SAMPLE with the real
 * feature, plan and person; the plan choice and follow state stay on the page.
 */
import { StickerCards } from "./cards-variants";

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

export default function CardsSticker() {
  return <StickerCards {...SAMPLE} />;
}
