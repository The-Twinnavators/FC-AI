/** @flowcode-library buttons-variants · Buttons: every variant and state (Forms)
 * Catalog ID: c.button (component)
 * Function: The one button every piece uses (c.button), and its reference sheet: six variants, six heights, icon and icon-only, toggle (star and heart), and the states a button passes through.
 * Use it as: import { Button } from "./ButtonsVariants"; <Button variant?="primary"|"secondary"|"tertiary"|"destructive"|"on-accent"|"ghost-on-accent" size?={24|32|40|44|48|56} icon? iconAt?="start"|"end" iconOnly? busy? pressed? block? href? type? ref? onClick?>Label</Button>  // pressed makes it a toggle (aria-pressed, icon drawn filled while pressed); ref reaches the <a> or <button>
 * Variants: c.button.primary - the one action a screen is for: filled with the accent color; c.button.secondary - beside the primary action: a surface with a border; c.button.tertiary - quiet actions in a row or toolbar: no fill until pointed at; c.button.destructive - removes something for good: filled with the danger color; c.button.on-accent - the main action on an accent band: filled with the on-accent color; c.button.ghost-on-accent - a second action on an accent band: transparent and outlined
 * Look: A rounded rectangle with a semibold one-line label and an optional icon; six heights from 24 to 56 px, square when icon-only; lifts on hover, presses in on click, a spinner while busy, a filled icon when a toggle is pressed, the focus ring on keyboard focus.
 * Tokens: --control-lg --control-pad-lg --control-radius --control-text-lg --control-border --control-shadow --color-accent --color-accent-hover --color-on-accent --color-surface --color-text --color-border --color-danger --focus-ring
 * Use cases: action button set; destructive confirm; form submit states; disabled action; toolbar actions
 * Jobs to be done: pick the right button for an action; show an action is unavailable; warn before something destructive
 * Keywords: button, primary, secondary, destructive, disabled, states
 */
/**
 * Every button as one matrix: the state across the top, the kind down the side. Hover and pressed are drawn in those
 * states on purpose, so the whole set can be read without a mouse. Each button carries the verb it would really have.
 *
 * Make it the app's own: keep the kinds your screens use and delete the rest. Colors, corners and shadows come from
 * the app's tokens, so this set restyles with everything else.
 */

/**
 * How to try it
 * - Press the heart: it toggles, and says so through the live region under the matrix.
 * - Press Delete: it arms, then needs a second press to confirm.
 * - Press Pay: it goes to its loading state, then stays done.
 * - Every other cell is a state drawn on purpose, so the set reads without hovering.
 *
 * Dependencies: React (useEffect, useRef, useState), and the library's own inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a
 * built app exactly as it runs here.
 */
import { forwardRef, useEffect, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon } from "./icons";

// ── c.button: the one button. Every piece's buttons are this component; the specimen below shows every variant. ──

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive" | "on-accent" | "ghost-on-accent";
export type ButtonSize = 24 | 32 | 40 | 44 | 48 | 56;
/** One construction; the look follows the style and surface tokens (a neobrutal button comes from the Neo-brutalist surface). */
export type ButtonVersion = "default";

// Written out in full (not built from the variant name) so a build finds every class the button needs.
const VARIANT: Record<ButtonVariant, string> = {
  primary: "fl-btn--primary",
  secondary: "fl-btn--secondary",
  tertiary: "fl-ctl-btn--tertiary",
  destructive: "fl-ctl-btn--destructive",
  "on-accent": "fl-btn--on-accent",
  "ghost-on-accent": "fl-btn--ghost-on-accent",
};
const SIZE: Record<ButtonSize, string> = { 24: "fl-ctl-btn--24", 32: "fl-ctl-btn--32", 40: "fl-ctl-btn--40", 44: "fl-ctl-btn--44", 48: "", 56: "fl-ctl-btn--56" };

type ButtonOwn = {
  /** The only version is "default"; kept so callers that pass it still type-check. */
  version?: ButtonVersion;
  variant?: ButtonVariant;
  /** Height in px; 48 when left out. */
  size?: ButtonSize;
  /** An icon name from ./icons. Before the label it says what kind of action; after it, where it leads. */
  icon?: string;
  iconAt?: "start" | "end";
  /** Square, icon only. The children are still required: they become the name screen readers and the tooltip use. */
  iconOnly?: boolean;
  /** Working: a spinner, the button disabled and marked busy. */
  busy?: boolean;
  /** A toggle: sets aria-pressed, and the icon (when given) is drawn filled while pressed. */
  pressed?: boolean;
  /** Fills the width of its container, for a form's submit or a card's call to action. */
  block?: boolean;
  className?: string;
  children?: ReactNode;
};
type AsLink = ButtonOwn & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonOwn>;
type AsButton = ButtonOwn & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwn>;

// The ref goes to the rendered <a> or <button>.
export const Button = forwardRef<HTMLAnchorElement | HTMLButtonElement, AsLink | AsButton>(function Button(props, ref) {
  const { version = "default", variant = "primary", size = 48, icon, iconAt = "start", iconOnly, busy, pressed, block, className, children, ...rest } = props;
  const cls = ["fl-btn", VARIANT[variant], SIZE[size], iconOnly ? "fl-ctl-btn--icon" : "", block ? "fl-ctl-btn--block" : "", className ?? ""].filter(Boolean).join(" ");
  const name = typeof children === "string" ? children : undefined;
  const glyph = busy ? <span className="fl-ctl-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} filled={pressed} /> : null;
  const inner = iconOnly ? glyph : iconAt === "end" ? <>{children}{glyph}</> : <>{glyph}{children}</>;
  // Icon-only: the label names it for screen readers and the tooltip, unless the caller already gave it a name.
  const given = rest as { "aria-label"?: string; title?: string };
  const own = { className: cls, "data-fl": `c.button.${variant}`, ...(pressed !== undefined ? { "aria-pressed": pressed } : {}), ...(iconOnly ? { "aria-label": given["aria-label"] ?? name, title: given.title ?? name } : {}) };
  if (typeof rest.href === "string") {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} {...own} ref={ref as Ref<HTMLAnchorElement>}>
        {inner}
      </a>
    );
  }
  const { type = "button", disabled, ...btn } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button {...btn} {...own} ref={ref as Ref<HTMLButtonElement>} type={type} disabled={disabled || busy} aria-busy={busy || undefined}>
      {inner}
    </button>
  );
});

// flowcode:sample
const SAMPLE = {
  states: [
    { id: "rest", label: "Enabled" },
    { id: "hover", label: "Hovered" },
    { id: "active", label: "Pressed" },
    { id: "disabled", label: "Disabled" },
    { id: "busy", label: "Loading" },
  ],
  kinds: [
    { id: "primary", label: "Primary", verb: "Save", variant: "primary" as const, what: "The one action a screen is for" },
    { id: "secondary", label: "Secondary", verb: "Preview", variant: "secondary" as const, what: "Sits beside the primary action" },
    { id: "tertiary", label: "Tertiary", verb: "Rename", variant: "tertiary" as const, what: "Quiet actions in a row or toolbar" },
    { id: "destructive", label: "Destructive", verb: "Delete", variant: "destructive" as const, what: "Removes something for good" },
  ],
  sizes: [
    { px: 24 as const, note: "Dense toolbars and table rows" },
    { px: 32 as const, note: "Compact filters and chips" },
    { px: 40 as const, note: "Forms on a desktop screen" },
    { px: 44 as const, note: "Comfortable to tap" },
    { px: 48 as const, note: "Default" },
    { px: 56 as const, note: "A screen's main action" },
  ],
};

const stateClass = (id: string) => (id === "hover" ? "is-hover" : id === "active" ? "is-active" : undefined);

export default function ButtonsVariants() {
  const d = SAMPLE;
  const [status, setStatus] = useState("");
  const [armed, setArmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [starred, setStarred] = useState(false);
  const [pay, setPay] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const say = (m: string) => setStatus(m);
  const onDelete = () => {
    if (!armed) {
      setArmed(true);
      say("Press Delete again to confirm. Nothing has been removed yet.");
      timer.current = window.setTimeout(() => (setArmed(false), say("Confirmation timed out.")), 4000);
      return;
    }
    window.clearTimeout(timer.current);
    setArmed(false);
    say("Deleted. This is a demo, so nothing really went anywhere.");
  };
  const onPay = () => {
    if (pay !== "idle") return;
    setPay("loading");
    say("Working\u2026");
    timer.current = window.setTimeout(() => (setPay("done"), say("Done. The button stays done so the state can be read.")), 1400);
  };
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap fl-ctl-spec fl-ctl-spec--wide">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each kind of button in each of its states</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              {d.states.map((s) => (
                <th key={s.id} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.kinds.map((k) => (
              <tr key={k.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{k.label}</span>
                  <span className="fl-ctl-matrix-what">{k.what}</span>
                </th>
                {d.states.map((s) => {
                  return (
                    <td key={s.id} data-state={s.label}>
                      <Button variant={k.variant} className={stateClass(s.id)} disabled={s.id === "disabled"} busy={s.id === "busy"}>
                        {s.id === "busy" ? "Saving" : k.verb}
                      </Button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Heights</h3>
        <p className="fl-ctl-btn-what">Six steps, in pixels, so the scale means the same in every project. 44 is the smallest that stays comfortable to tap.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((s) => (
            <li key={s.px}>
              <Button size={s.px}>{`${s.px} px`}</Button>
              <span className="fl-ctl-btn-what">{s.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>With an icon</h3>
        <p className="fl-ctl-btn-what">An icon before the label says what kind of action it is; after the label, where it leads. Never both.</p>
        <div className="fl-actions">
          <Button icon="plus">New booking</Button>
          <Button variant="secondary" icon="download">
            Export
          </Button>
          <Button variant="tertiary" icon="arrow" iconAt="end">
            Continue
          </Button>
          <Button variant="destructive" icon="trash">
            Delete
          </Button>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Icon only</h3>
        <p className="fl-ctl-btn-what">
          Square, at the same six heights. Each one still carries its name for screen readers and a tooltip on hover,
          because an icon alone is a guess.
        </p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((s) => (
            <li key={s.px}>
              <span className="fl-ctl-icon-row">
                <Button size={s.px} icon="plus" iconOnly>
                  Add
                </Button>
                <Button size={s.px} variant="secondary" icon="pencil" iconOnly>
                  Edit
                </Button>
                <Button size={s.px} variant="tertiary" icon="more" iconOnly>
                  More actions
                </Button>
                <Button size={s.px} variant="destructive" icon="trash" iconOnly>
                  Delete
                </Button>
              </span>
              <span className="fl-ctl-btn-what">{s.px} px</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Full width</h3>
        <p className="fl-ctl-btn-what">
          <code>block</code> stretches a button to its container: a form&apos;s submit, or the call to action at the foot of a card.
        </p>
        <div className="fl-actions" style={{ maxWidth: "20rem" }}>
          <Button block icon="arrow" iconAt="end">
            Choose this plan
          </Button>
          <Button block variant="secondary">
            Compare plans
          </Button>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--bare">
        <h3>On an accent band</h3>
        <p className="fl-ctl-btn-what">Two more variants for a section filled with the accent color, where primary would disappear.</p>
        <div className="fl-section--accent fl-ctl-accent-band">
          <div className="fl-actions">
            <Button variant="on-accent" href="#join">
              Join the beta
            </Button>
            <Button variant="ghost-on-accent" href="#roles">
              See open roles
            </Button>
          </div>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-try fl-ctl-spec fl-ctl-spec--wide">
        <h3>Try them</h3>
        <p className="fl-ctl-btn-what">
          The matrix above draws the states; these are real. Hover lifts, pressing pushes down, a destructive action asks
          once before it acts, and a slow action goes to loading and stays done so the state can be read.
        </p>
        <div className="fl-actions">
          <Button onClick={() => say("Saved.")}>Save</Button>
          <Button variant="secondary" onClick={() => say("Opened the preview.")}>
            Preview
          </Button>
          <Button
            variant="tertiary"
            icon="heart"
            iconOnly
            pressed={saved}
            onClick={() => {
              setSaved((v) => !v);
              say(saved ? "Removed from your list." : "Added to your list.");
            }}
          >
            {saved ? "Remove from saved" : "Save to your list"}
          </Button>
          <Button variant="tertiary" icon="star" iconOnly pressed={starred} onClick={() => (setStarred((v) => !v), say(starred ? "Unstarred." : "Starred."))}>
            {starred ? "Remove star" : "Star"}
          </Button>
          <Button variant="destructive" icon="trash" className={armed ? "is-armed" : undefined} onClick={onDelete}>
            {armed ? "Press again to delete" : "Delete"}
          </Button>
          <Button onClick={onPay} busy={pay === "loading"} disabled={pay === "done"} icon={pay === "done" ? "check" : undefined}>
            {pay === "loading" ? "Paying" : pay === "done" ? "Paid" : "Pay deposit"}
          </Button>
          {pay === "done" ? (
            <Button variant="tertiary" size={32} onClick={() => (setPay("idle"), say(""))}>
              Reset
            </Button>
          ) : null}
        </div>
        <p className="fl-ctl-status" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </section>
  );
}
