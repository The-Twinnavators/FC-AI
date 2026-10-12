/** @flowcode-library cards-variants · Cards: kinds, elevation and states (Cards)
 * Catalog ID: c.card (component)
 * Function: The card (c.card) that holds a tile or list item, and its reference sheet: plain, clickable and selectable kinds across their states, a priced choice group made of selectable cards, and three elevations.
 * Use it as: import { Card } from "./CardsVariants"; <Card version?="default"|"tick"|"sticker" variant?="plain"|"clickable"|"selectable" elevation?="flat"|"raised"|"floating" selected? disabled? name? onSelect? pickLabel? icon? tag? onClick? ref?>content</Card>  // ref reaches the card's root element (a <label> when selectable, else a <div>)
 * Variants: c.card.plain - content that does nothing: a bordered surface; c.card.clickable - the whole card opens something: a bordered surface with an arrow, hover and focus states; c.card.selectable - one choice of a set: a bordered surface with a radio in the corner and an accent outline when chosen
 * Look: A bordered surface with padded content, optionally lifted by a flat, raised or floating shadow; clickable ones show an arrow, selectable ones a radio; icon adds a tile at the top and tag pins a short label to the corner.
 * Tokens: --accent-bg --color-accent --color-border --color-border-strong --color-surface --color-text-muted --control-edge --control-radius --control-radius-sm --control-shadow --edge-width --space-1 --space-3 --space-4 --surface-bg --surface-blur --surface-border --surface-edge --surface-radius --surface-radius-sm --surface-shadow --surface-shadow-selected --tag-tilt --radius-md
 * Use cases: dashboard tiles; project list; article list; settings groups; pickable options; plan selection; delivery options; shipping method; subscription tier; checkout options; membership choice; service package; pricing card; profile card; feature card; plan picker; team member card; creator profile; bold product page
 * Jobs to be done: scan a list of things; open one of them; choose one of several; pick the plan that suits me; choose how my order is delivered; compare options with prices; confirm my choice; choose a plan; follow a person i like; learn about a key feature
 * Keywords: card, tile, elevation, surface, clickable, selected, radio, radio cards, plan picker, delivery options, fieldset, choice, cards, pricing, profile, feature, sticker
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
import { forwardRef, useId, useState, type FormEvent, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon, Tick } from "./icons";
import { Badge } from "./BadgesStatus";
import { Button } from "./ButtonsVariants";

// ── c.card: the one card. Every piece's tiles and list items are this component; the specimen below shows every variant. ──

export type CardVariant = "plain" | "clickable" | "selectable" | "surface";
export type CardElevation = "flat" | "raised" | "floating";
/** default = the plain card; tick = a radio card with a tick-in-circle mark; sticker = a card with a tilted sticker tag, a large avatar, a stats row and a footer. Every version's look follows the style and surface tokens. */
export type CardVersion = "default" | "tick" | "sticker";

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
  /** An icon name from ./icons, drawn as a tile at the top of the card (feature and benefit cards). */
  icon?: string;
  /** A short label pinned to the card's top corner, like "Most picked" (a style may tilt it like a sticker). */
  tag?: string;
  /** "tick" draws a radio card (a real radio, a tick-in-circle mark, price or other `aside` at the right); "sticker" a card with a tilted sticker tag, a large avatar with `lead`, a stats row and a footer. Default when left out. */
  version?: CardVersion;
  /** tick: uncontrolled start state when `selected` is not passed (the native radio group keeps the choice). */
  defaultSelected?: boolean;
  /** tick: content at the right edge of the card, usually the price. */
  aside?: ReactNode;
  /** sticker: tint the card with the accent color. A chosen card (`selected`) takes the success tint and the selected shadow. */
  accent?: boolean;
  /** sticker: initials in a 4rem round avatar, with `lead` (name, role) beside it. */
  avatar?: string;
  lead?: ReactNode;
  /** sticker: a row of figures under the content. */
  stats?: { label: string; value: string }[];
  /** sticker: content under the stats row (a follow row, an action). */
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
};

// The ref goes to the card's root element (a <label> when selectable, otherwise a <div>).
export const Card = forwardRef<HTMLElement, CardOwn & Omit<HTMLAttributes<HTMLElement>, keyof CardOwn>>(function Card(props, ref) {
  const { variant = "plain", version = "default", defaultSelected, aside, accent, avatar, lead, stats, footer, elevation, selected, disabled, name, onSelect, pickLabel, icon, tag, className, children, onClick, onKeyDown, ...rest } = props;
  const sk = version === "sticker";
  if (version === "tick") {
    // A radio card: the input is hidden and the tick mark shows the choice (:has(input:checked) in inputs.css).
    const cls = ["fl-in-rcard", disabled ? "fl-in-rcard--disabled" : "", className ?? ""].filter(Boolean).join(" ");
    return (
      <label {...(rest as HTMLAttributes<HTMLLabelElement>)} className={cls} data-fl="c.card@tick" ref={ref as Ref<HTMLLabelElement>} aria-disabled={disabled || undefined}>
        <input
          type="radio"
          name={name}
          {...(selected === undefined ? { defaultChecked: defaultSelected } : { checked: selected })}
          disabled={disabled}
          aria-label={pickLabel}
          onChange={() => onSelect?.()}
        />
        <span className="fl-in-rcard__mark" aria-hidden="true">
          <Tick />
        </span>
        <span className="fl-in-rcard__body">{children}</span>
        {aside ? <span className="fl-in-rcard__price">{aside}</span> : null}
      </label>
    );
  }
  const head = icon ? (
    <span className={sk ? "fl-card-sticker__tile" : "fl-ctl-card-tile"}>
      <Icon name={icon} />
    </span>
  ) : null;
  const sticker = tag ? <span className={sk ? "fl-card-sticker__tag" : "fl-ctl-card-tag"}>{tag}</span> : null;
  const skCls = ["fl-card--sticker", accent ? "fl-card-sticker--accent" : "", selected ? "fl-card-sticker--selected" : "", disabled ? "is-off" : "", className ?? ""].filter(Boolean).join(" ");
  const cls = sk ? skCls : [variant === "surface" ? "" : "fl-ctl-card", VARIANT[variant], elevation ? ELEVATION[elevation] : "", selected && variant === "selectable" ? "is-on" : "", disabled ? "is-off" : "", className ?? ""].filter(Boolean).join(" ");
  const own = { className: cls, "data-fl": sk ? "c.card@sticker" : `c.card.${variant}` };
  if (sk) {
    const body = (
      <>
        {avatar ? (
          <div className="fl-card-sticker__person">
            <span className="fl-card-sticker__avatar" aria-hidden="true">
              {avatar}
            </span>
            <div className="fl-card-sticker__lead">{lead}</div>
          </div>
        ) : null}
        {children}
        {stats ? (
          <dl className="fl-card-sticker__stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {footer}
      </>
    );
    if (variant === "clickable") {
      return (
        <div
          {...rest}
          {...own}
          ref={ref as Ref<HTMLDivElement>}
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
          {head}
          {sticker}
          {body}
        </div>
      );
    }
    if (variant === "selectable") {
      return (
        <label {...(rest as HTMLAttributes<HTMLLabelElement>)} {...own} ref={ref as Ref<HTMLLabelElement>} aria-disabled={disabled || undefined}>
          {head}
          {sticker}
          {body}
          <input type="radio" name={name} className="fl-sr" checked={!!selected} disabled={disabled} onChange={() => onSelect?.()} aria-label={pickLabel} />
        </label>
      );
    }
    return (
      <div {...rest} {...own} ref={ref as Ref<HTMLDivElement>}>
        {head}
        {sticker}
        {body}
      </div>
    );
  }
  if (variant === "selectable") {
    return (
      <label {...(rest as HTMLAttributes<HTMLLabelElement>)} {...own} ref={ref as Ref<HTMLLabelElement>} aria-disabled={disabled || undefined}>
        {head}
        {children}
        {sticker}
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
        ref={ref as Ref<HTMLDivElement>}
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
        {head}
        {children}
        {sticker}
        <Icon name="arrow" />
      </div>
    );
  }
  return (
    <div {...rest} {...own} ref={ref as Ref<HTMLDivElement>}>
      {head}
      {children}
      {sticker}
    </div>
  );
});

// ── c.card@tick in use: radio-card groups with a summary and a confirm check (input-radio-cards wraps this). ──

export type RadioCardsFormProps = {
  title: string;
  lede: string;
  groups: {
    id: string;
    legend: string;
    options: { id: string; title: string; text: string; price: string; per: string; badge: string }[];
    disabled: string[];
    initial: string;
  }[];
  submit: string;
  missing: string;
  done: (plan: string, delivery: string) => string;
};

export function RadioCardsForm(d: RadioCardsFormProps) {
  const uid = useId();
  const [picked, setPicked] = useState<Record<string, string>>(() => Object.fromEntries(d.groups.map((g) => [g.id, g.initial])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    d.groups.forEach((g) => {
      if (!picked[g.id]) next[g.id] = g.id === "delivery" ? d.missing : `Choose a ${g.legend.toLowerCase()}.`;
    });
    setErrors(next);
    if (Object.keys(next).length) {
      setDone("");
      return;
    }
    const title = (gid: string) => d.groups.find((g) => g.id === gid)?.options.find((o) => o.id === picked[gid])?.title ?? "";
    setDone(d.done(title("plan"), title("delivery")));
  }

  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <form className="fl-form" noValidate onSubmit={submit} style={{ gap: "var(--space-7)" }}>
          {d.groups.map((g) => {
            const err = errors[g.id];
            return (
              <fieldset key={g.id} className="fl-in-fieldset" aria-describedby={err ? `${uid}-${g.id}-err` : undefined}>
                <legend>{g.legend}</legend>
                <div className="fl-in-cards">
                  {g.options.map((o) => (
                    <Card
                      key={o.id}
                      version="tick"
                      variant="selectable"
                      name={`${uid}-${g.id}`}
                      selected={picked[g.id] === o.id}
                      disabled={g.disabled.includes(o.id)}
                      pickLabel={`${o.title}, ${o.price}${o.per}`}
                      onSelect={() => {
                        setPicked((p) => ({ ...p, [g.id]: o.id }));
                        setErrors((er) => ({ ...er, [g.id]: "" }));
                        setDone("");
                      }}
                      aside={
                        <>
                          <strong>{o.price}</strong>
                          {o.per ? <span className="fl-meta">{o.per}</span> : null}
                        </>
                      }
                    >
                      <span className="fl-in-rcard__top">
                        <span className="fl-in-rcard__title">{o.title}</span>
                        {o.badge ? <Badge>{o.badge}</Badge> : null}
                      </span>
                      <span className="fl-in-rcard__text">{o.text}</span>
                    </Card>
                  ))}
                </div>
                {err ? (
                  <p id={`${uid}-${g.id}-err`} className="fl-in-error" role="alert">
                    {err}
                  </p>
                ) : null}
              </fieldset>
            );
          })}
          {done ? (
            <p className="fl-done" role="status">
              {done}
            </p>
          ) : null}
          <div className="fl-actions">
            <Button type="submit">{d.submit}</Button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ── c.card@sticker in use: a feature, a pricing and a profile card (cards-sticker wraps this). The look follows the style and surface. ──

export type StickerCardsProps = {
  eyebrow: string;
  title: string;
  feature: { icon: string; title: string; text: string; link: string };
  pricing: { sticker: string; name: string; price: string; per: string; text: string; features: string[]; choose: string; chosen: string };
  profile: { initials: string; name: string; role: string; bio: string; stats: { label: string; value: string }[]; followers: number };
};

export function StickerCards(d: StickerCardsProps) {
  const uid = useId();
  const [chosen, setChosen] = useState(false);
  const [following, setFollowing] = useState(false);
  const followers = d.profile.followers + (following ? 1 : 0);

  return (
    <section className="fl-section fl-section--tint" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id={`${uid}-title`} className="fl-title">
            {d.title}
          </h2>
        </div>

        <ul className="fl-card-sticker__grid">
          <li>
            <Card version="sticker" accent icon={d.feature.icon}>
              <h3>{d.feature.title}</h3>
              <p>{d.feature.text}</p>
              <Button variant="secondary" size={40} href="#how-booking-works" icon="arrow" iconAt="end" style={{ justifySelf: "start" }}>
                {d.feature.link}
              </Button>
            </Card>
          </li>

          <li>
            <Card version="sticker" selected={chosen} tag={d.pricing.sticker} style={{ marginTop: "var(--space-4)" }}>
              <h3>{d.pricing.name}</h3>
              <p className="fl-card-sticker__price">
                <strong>{d.pricing.price}</strong>
                <span>{d.pricing.per}</span>
              </p>
              <p>{d.pricing.text}</p>
              <ul className="fl-card-sticker__list">
                {d.pricing.features.map((f) => (
                  <li key={f}>
                    <Tick />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={chosen ? "secondary" : "primary"} block pressed={chosen} icon={chosen ? "check" : undefined} onClick={() => setChosen(!chosen)}>
                {chosen ? d.pricing.chosen : d.pricing.choose}
              </Button>
              <p className="fl-card-sticker__status" role="status" aria-live="polite">
                {chosen ? "Nice pick. Tap again to undo." : ""}
              </p>
            </Card>
          </li>

          <li>
            <Card
              version="sticker"
              avatar={d.profile.initials}
              lead={
                <>
                  <h3>{d.profile.name}</h3>
                  <Badge tone="info" style={{ justifySelf: "start" }}>
                    {d.profile.role}
                  </Badge>
                </>
              }
              stats={d.profile.stats}
              footer={
                <div className="fl-card-sticker__row">
                  <span className="fl-meta" aria-live="polite">
                    {followers} followers
                  </span>
                  <Button variant={following ? "tertiary" : "primary"} size={40} pressed={following} icon={following ? "check" : "users"} onClick={() => setFollowing(!following)}>
                    {following ? "Following" : `Follow ${d.profile.name.split(" ")[0]}`}
                  </Button>
                </div>
              }
            >
              <p>{d.profile.bio}</p>
            </Card>
          </li>
        </ul>
      </div>
    </section>
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
  radio: {
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
  },
  sticker: {
    eyebrow: "Cards",
    title: "Blocks with a bit of attitude",
    feature: { icon: "bolt", title: "Book in ten seconds", text: "Pick a class, pick a time, done. No account needed for your first visit.", link: "How booking works" },
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
  },
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
      <div className="fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
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
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--bare">
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

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
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

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--bare">
        <h3>Icon tile and corner tag</h3>
        <p className="fl-ctl-btn-what">
          <code>icon</code> puts a tile at the top of a feature card; <code>tag</code> pins a short label to the corner, for the plan
          most people pick.
        </p>
        <ul className="fl-ctl-elev-list">
          <li>
            <Card icon="bolt">
              <strong>Book in ten seconds</strong>
              <span className="fl-ctl-matrix-what">Pick a class, pick a time, done.</span>
            </Card>
          </li>
          <li>
            <Card tag="Most picked">
              <strong>Studio pass</strong>
              <span className="fl-ctl-matrix-what">Four classes a month at either studio.</span>
            </Card>
          </li>
        </ul>
      </div>
      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <h3>Version: tick (c.card@tick)</h3>
        <p className="fl-ctl-btn-what">
          A radio card with a tick-in-circle mark instead of a corner radio: title, badge and text on the left, the price on
          the right. Real radios in a fieldset; the group checks that each is chosen before it confirms.
        </p>
        <RadioCardsForm {...d.radio} />
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <h3>Version: sticker (c.card@sticker)</h3>
        <p className="fl-ctl-btn-what">
          A card built for a feature, a plan or a person: a tilted sticker tag in the corner, a 4rem avatar beside a lead, a
          stats row and a footer. It lifts on hover and takes a success tint when chosen; edges, corners and shadow follow
          the style and surface.
        </p>
        <StickerCards {...d.sticker} />
      </div>

    </section>
  );
}
