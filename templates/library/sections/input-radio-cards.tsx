/** @flowcode-library input-radio-cards · Radio cards (tick) (Cards)
 * Catalog ID: c.card@tick (component version)
 * Version of: c.card
 * Function: Plan and delivery choices shown as radio cards with descriptions, prices, badges and an unavailable option, built on native radios in fieldsets.
 * Use it as: import { Card } from "./cards-variants"; <Card version="tick" name="plan" pickLabel="Family box, $29/week" selected?|defaultSelected? disabled? onSelect? aside={<><strong>$29</strong><span className="fl-meta">/week</span></>}><span className="fl-in-rcard__top"><span className="fl-in-rcard__title">Family box</span></span><span className="fl-in-rcard__text">For three to five.</span></Card>  // wrap the cards of one choice in <fieldset className="fl-in-fieldset"><legend>…</legend><div className="fl-in-cards">
 * Look: A round tick mark at the left instead of a corner radio: it fills with the accent color and the card gets an accent outline when chosen; title, badge and text sit in the middle and the price at the right.
 * Tokens: --color-accent --color-border --color-border-strong --color-surface --color-surface-sunken --color-text-muted --color-on-accent --radius-md --space-3 --space-4 --focus-ring
 * Use cases: plan selection; delivery options; shipping method; subscription tier; checkout options; membership choice; service package
 * Jobs to be done: pick the plan that suits me; choose how my order is delivered; compare options with prices; confirm my choice
 * Keywords: radio, radio cards, plan picker, delivery options, fieldset, choice
 */
/**
 * Input: radio cards. This is c.card@tick with this piece's sample content; the implementation lives in the component,
 * in ./cards-variants. Choices shown as cards, each with a title, a short description and a price: one group for a plan
 * and one for delivery, including an option that can't be picked right now. They are real radio buttons in a fieldset,
 * so arrow keys move between them and screen readers announce the group. A summary and a confirm button check that
 * both are chosen. Make it the app's own: replace SAMPLE with the real options and prices.
 */
import { RadioCardsForm } from "./cards-variants";

// flowcode:sample
const SAMPLE = {
  title: "Set up your veg box",
  lede: "Pick a box size and how you'd like it to arrive. You can change both any week.",
  groups: [
    {
      id: "plan",
      legend: "Box size",
      options: [
        { id: "small", title: "Small box", text: "For one or two. About 6 kinds of veg.", price: "$18", per: "/week", badge: "" },
        { id: "family", title: "Family box", text: "For three to five. About 9 kinds, plus fruit.", price: "$29", per: "/week", badge: "Most chosen" },
        { id: "large", title: "Large box", text: "For big households or batch cooks.", price: "$38", per: "/week", badge: "" },
      ],
      disabled: [] as string[],
      initial: "family",
    },
    {
      id: "delivery",
      legend: "Delivery",
      options: [
        { id: "doorstep", title: "Doorstep, Thursday", text: "Left in a cool bag by 8am.", price: "Free", per: "", badge: "" },
        { id: "pickup", title: "Pick up from the shop", text: "Collect any time Thursday or Friday.", price: "$2 off", per: "", badge: "" },
        { id: "saturday", title: "Saturday morning", text: "Full until next month. Join the waiting list in the shop.", price: "$4", per: "", badge: "Full" },
      ],
      disabled: ["saturday"],
      initial: "",
    },
  ],
  submit: "Confirm box",
  missing: "Choose a delivery option.",
  done: (plan: string, delivery: string) => `All set: ${plan}, ${delivery.toLowerCase()}. Your first box arrives next week.`,
};

export default function InputRadioCards() {
  return <RadioCardsForm {...SAMPLE} />;
}
