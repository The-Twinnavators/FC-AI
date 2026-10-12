/** @flowcode-library cards-variants · Cards: kinds, elevation and states (Cards)
 * Catalog ID: c.card (component)
 * Function: The card (c.card) that holds a tile or list item, and its reference sheet: plain, clickable and selectable kinds across their states, a priced choice group made of selectable cards, and three elevations.
 * Use it as: import { Card } from "./cards-variants"; <Card variant?="plain"|"clickable"|"selectable" elevation?="flat"|"raised"|"floating" selected? disabled? name? onSelect? pickLabel? onClick?>content</Card>
 * Variants: c.card.plain - content that does nothing: a bordered surface; c.card.clickable - the whole card opens something: a bordered surface with an arrow, hover and focus states; c.card.selectable - one choice of a set: a bordered surface with a radio in the corner and an accent outline when chosen
 * Look: A bordered surface with padded content, optionally lifted by a flat, raised or floating shadow; clickable ones show an arrow, selectable ones a radio.
 * Tokens: --color-surface --color-border --color-border-strong --color-accent --color-text-muted --radius-md --space-1 --space-3 --space-4
 * Use cases: dashboard tiles; project list; article list; settings groups; pickable options; plan selection; delivery options; shipping method; subscription tier; checkout options; membership choice; service package
 * Jobs to be done: scan a list of things; open one of them; choose one of several; pick the plan that suits me; choose how my order is delivered; compare options with prices; confirm my choice
 * Keywords: card, tile, elevation, surface, clickable, selected, radio, radio cards, plan picker, delivery options, fieldset, choice
 */
/**
 * A card is a surface, and what matters is whether it does anything. A plain card holds content; a clickable card is
 * a link or a button and so has hover, focus and pressed states; a chosen card is a radio in disguise.
 *
 * The clickable cards here report what they opened and the selectable ones are one real radio group, so only one of
 * them can be chosen at a time. Make it the app's own: pick one kind per list and keep it. Mixing clickable and plain
 * cards in one grid confuses.
 */
/**
 * How to try it
 * - Press a clickable card, or focus one and press Enter: it says what it opened.
 * - Choose a selectable card: they are one radio group, so choosing one lets go of the last.
 * - Cells that say "not applicable" are states that kind of card cannot reach.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "./icons";
import { Badge } from "./badges-status";

// ── c.card: the one card. Every piece's tiles and list items are this component; the specimen below shows every variant. ──

export type CardVariant = "plain" | "clickable" | "selectable" | "surface";
export type CardElevation = "flat" | "raised" | "floating";

// Written out in full (not built from the variant name) so a build finds every class the card needs.
// surface: the card page sections are built on (.fl-card in library.css): roomier, a heading and text stacked, no app states.
const VARIANT: Record<CardVariant, string> = { plain: "fl-ctl-card--plain", clickable: "fl-ctl-card--clickable", selectable: "fl-ctl-card--selectable", surface: "fl-card" };
const ELEVATION: Record<CardElevation, string> = { flat: "fl-ctl-card--flat", raised: "fl-ctl-card--raised", floating: "fl-ctl-card--floating" };

type CardOwn = {
  variant?: CardVariant;
  /** How far off the page it sits; none (the base border) when left out. */
  elevation?: CardElevation;
  /** Selectable: this card is the chosen one. */
  selected?: boolean;
  disabled?: boolean;
  /** Selectable: the radio group name, shared by the cards that are one choice. */
  name?: string;
  /** Selectable: called when this card is chosen. */
  onSelect?: () => void;
  /** Selectable: the radio's accessible name, such as "Choose the Riverside wedding". */
  pickLabel?: string;
  className?: string;
  children?: ReactNode;
};

export function Card(props: CardOwn & Omit<HTMLAttributes<HTMLElement>, keyof CardOwn>) {
  const { variant = "plain", elevation, selected, disabled, name, onSelect, pickLabel, className, children, onClick, onKeyDown, ...rest } = props;
  const cls = [variant === "surface" ? "" : "fl-ctl-card", VARIANT[variant], elevation ? ELEVATION[elevation] : "", selected && variant === "selectable" ? "is-on" : "", disabled ? "is-off" : "", className ?? ""].filter(Boolean).join(" ");
  const own = { className: cls, "data-fl": `c.card.${variant}` };
  if (variant === "selectable") {
    return (
      <label {...(rest as HTMLAttributes<HTMLLabelElement>)} {...own} aria-disabled={disabled || undefined}>
        {children}
        <span className="fl-ctl-card-pick">
          <input type="radio" name={name} className="fl-ctl-check fl-ctl-check--16" checked={!!selected} disabled={disabled} onChange={() => onSelect?.()} aria-label={pickLabel} />
        </span>
      </label>
    );
  }
  if (variant === "clickable") {
    return (
      <div
        {...rest}
        {...own}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        onClick={(e) => {
          if (!disabled) onClick?.(e);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            e.currentTarget.click();
          }
        }}
      >
        {children}
        <Icon name="arrow" />
      </div>
    );
  }
  return (
    <div {...rest} {...own}>
      {children}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "plain" as const, label: "Plain", what: "Holds content; does nothing" },
    { id: "clickable" as const, label: "Clickable", what: "The whole card opens something" },
    { id: "selectable" as const, label: "Selectable", what: "One of a set; a radio underneath" },
  ],
  states: [
    { id: "rest", label: "Enabled" },
    { id: "hover", label: "Hovered" },
    { id: "selected", label: "Selected" },
    { id: "disabled", label: "Disabled" },
  ],
  elevations: [
    { id: "flat" as const, label: "Flat", what: "A line, no shadow: lists and dense grids" },
    { id: "raised" as const, label: "Raised", what: "A soft shadow: the default card" },
    { id: "floating" as const, label: "Floating", what: "A deeper shadow: something over the page" },
  ],
  shoot: { name: "Riverside wedding", meta: "12 June · 420 photos" },
  plans: [
    { id: "small", title: "Small box", text: "For one or two. About 6 kinds of veg.", price: "$18", per: "/week", badge: "", off: false },
    { id: "family", title: "Family box", text: "For three to five. About 9 kinds, plus fruit.", price: "$29", per: "/week", badge: "Most chosen", off: false },
    { id: "large", title: "Large box", text: "For big households or batch cooks.", price: "$38", per: "/week", badge: "", off: false },
    { id: "saturday", title: "Saturday morning", text: "Full until next month.", price: "$4", per: "", badge: "Full", off: true },
  ],
};

export default function CardsVariants() {
  const d = SAMPLE;
  // One radio group across the whole column: choosing one card lets go of the last.
  const [picked, setPicked] = useState("selected");
  const [said, setSaid] = useState("");
  const [plan, setPlan] = useState("family");

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each kind of card in each state</caption>
          <thead>
            <tr>
              <th scope="col">State</th>
              {d.kinds.map((k) => (
                <th key={k.id} scope="col">
                  <span className="fl-ctl-matrix-kind">{k.label}</span>
                  <span className="fl-ctl-matrix-what">{k.what}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.states.map((s) => (
              <tr key={s.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{s.label}</span>
                </th>
                {d.kinds.map((k) => {
                  const off = s.id === "disabled";
                  const on = k.id === "selectable" && picked === s.id;
                  const hovered = s.id === "hover" ? "is-hover" : undefined;
                  // A plain card reacts to nothing, and only the selectable one can stay chosen.
                  const why = k.id === "plain" && s.id !== "rest" ? "Not applicable" : k.id === "clickable" && s.id === "selected" ? "Not applicable: opens something" : "";
                  if (why) {
                    return (
                      <td key={k.id} data-state={k.label}>
                        <span className="fl-ctl-matrix-what">{why}</span>
                      </td>
                    );
                  }
                  return (
                    <td key={k.id} data-state={k.label}>
                      <Card
                        variant={k.id}
                        className={hovered}
                        disabled={off}
                        selected={on}
                        name="card-pick"
                        pickLabel={`Choose the ${s.label.toLowerCase()} card`}
                        onSelect={() => {
                          setPicked(s.id);
                          setSaid(`Chose the ${s.label.toLowerCase()} card`);
                        }}
                        onClick={() => setSaid(`Opened ${d.shoot.name}`)}
                      >
                        <strong>{d.shoot.name}</strong>
                        <span className="fl-ctl-matrix-what">{d.shoot.meta}</span>
                      </Card>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Open a clickable card, or choose a selectable one."}
      </p>

      <div className="fl-ctl-sizes">
        <h3>A choice with a price</h3>
        <p className="fl-ctl-btn-what">
          Selectable cards as the options of a plan or delivery picker: a title, a badge, a line of text and a price inside
          each. They are real radios in a fieldset, so the arrow keys move between them, and one that is unavailable is
          disabled and says why.
        </p>
        <fieldset className="fl-in-fieldset">
          <legend>Box size</legend>
          <div className="fl-in-cards">
            {d.plans.map((o) => (
              <Card key={o.id} variant="selectable" name="card-plan" selected={plan === o.id} disabled={o.off} pickLabel={o.title} onSelect={() => setPlan(o.id)}>
                <span className="fl-in-rcard__top">
                  <strong>{o.title}</strong>
                  {o.badge ? <Badge tone={o.off ? "neutral" : "info"}>{o.badge}</Badge> : null}
                </span>
                <span className="fl-in-rcard__text">{o.text}</span>
                <span className="fl-in-rcard__price">
                  <strong>{o.price}</strong>
                  {o.per ? <span className="fl-meta">{o.per}</span> : null}
                </span>
              </Card>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Elevation</h3>
        <p className="fl-ctl-btn-what">How far off the page a card sits. One level per list: a grid of mixed elevations reads as a mistake.</p>
        <ul className="fl-ctl-elev-list">
          {d.elevations.map((e) => (
            <li key={e.id}>
              <Card elevation={e.id}>
                <strong>{e.label}</strong>
                <span className="fl-ctl-matrix-what">{e.what}</span>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
