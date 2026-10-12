/** @flowcode-library dividers-rules · Dividers: horizontal, vertical, with a label, and when to use none (Small components)
 * Catalog ID: c.divider (component)
 * Function: The divider (c.divider): the rule that separates groups, and a reference sheet of its weights, vertical form, labelled form and when to use space instead.
 * Use it as: import { Divider } from "./dividers-rules"; <Divider variant?="horizontal"|"vertical"|"labelled" weight?="hair"|"regular"|"heavy"|"dash" label? labelAt?="center"|"start" decorative? />
 * Variants: c.divider.horizontal - between sections or list rows: a full-width line in one of four weights (hair, regular, heavy, dash); c.divider.vertical - between groups in a toolbar: a thin upright line the height of its row; c.divider.labelled - an "or" between two ways to do something, or a day marker in a feed: a line with a word in it, centered or at the start
 * Look: A one-pixel line in the border color, horizontal, vertical, or broken by a short word.
 * Tokens: --color-border --color-border-strong --color-text-muted --text-sm --space-2 --space-3 --space-4
 * Use cases: between list rows; between toolbar groups; an or between two ways to sign in; a section break
 * Jobs to be done: see where one group ends; separate a toolbar's groups; break a long page up
 * Keywords: divider, rule, separator, hr, horizontal rule, vertical rule, spacing
 */
/**
 * The smallest component there is, and the one most often used instead of spacing. A line says "these are different
 * things". Space says "these are different things" just as well and makes less noise, so the honest default is space,
 * and the line is for when space alone is not enough.
 *
 * Both are here side by side so the difference is visible rather than argued. A decorative line is aria-hidden; a line
 * that genuinely separates sections is an hr, which screen readers already announce, so it needs nothing added.
 *
 * Make it the app's own: one weight and one color for every divider in the app. Two weights reads as a mistake.
 */
/**
 * How to try it
 * - Switch "Draw the lines" off: the same list without them, so you can judge whether they were doing anything.
 * - The rest is reference: four weights, a vertical rule for toolbar groups, and a labelled rule.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState, type HTMLAttributes } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.divider: the one rule. Pieces that separate groups use this component; the specimen below shows every kind. ──

export type DividerVariant = "horizontal" | "vertical" | "labelled";
export type DividerWeight = "hair" | "regular" | "heavy" | "dash";

// Written out in full (not built from the weight name) so a build finds every class the divider needs.
const WEIGHT: Record<DividerWeight, string> = {
  hair: "fl-ctl-rule--hair",
  regular: "",
  heavy: "fl-ctl-rule--heavy",
  dash: "fl-ctl-rule--dash",
};

type DividerProps = {
  variant?: DividerVariant;
  /** Horizontal only: hairline in a card, regular between sections, heavy almost never, dashed for provisional. */
  weight?: DividerWeight;
  /** Labelled only: the word on the line. It is real text, so it is read out. */
  label?: string;
  /** Labelled only: where the word sits. Center when left out. */
  labelAt?: "center" | "start";
  /** Hide it from screen readers. On by default for vertical, off for the others. */
  decorative?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

export function Divider({ variant = "horizontal", weight = "regular", label, labelAt = "center", decorative, className, ...rest }: DividerProps) {
  const hidden = (decorative ?? variant === "vertical") || undefined;
  const fl = `c.divider.${variant}`;
  if (variant === "vertical") {
    const cls = ["fl-ctl-vrule", className ?? ""].filter(Boolean).join(" ");
    return <span {...rest} className={cls} data-fl={fl} aria-hidden={hidden} />;
  }
  if (variant === "labelled") {
    const cls = ["fl-ctl-rule-label", labelAt === "start" ? "fl-ctl-rule-label--start" : "", className ?? ""].filter(Boolean).join(" ");
    return (
      <span {...rest} className={cls} data-fl={fl} aria-hidden={hidden}>
        <span>{label}</span>
      </span>
    );
  }
  const cls = ["fl-ctl-rule", WEIGHT[weight], className ?? ""].filter(Boolean).join(" ");
  return <hr {...rest} className={cls} data-fl={fl} aria-hidden={hidden} />;
}

// flowcode:sample
const SAMPLE = {
  rows: ["Riverside wedding", "Harbour engagement", "Studio headshots"],
};

export default function DividersRules() {
  const d = SAMPLE;
  const [lines, setLines] = useState(true);

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec">
        <h3>A line, or just space</h3>
        <p className="fl-ctl-btn-what">The same list twice. Switch the lines off and see whether anything was lost.</p>
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <span className="fl-ctl-switch fl-ctl-switch--20">
            <input type="checkbox" checked={lines} onChange={(e) => setLines(e.target.checked)} />
            <span className="fl-ctl-switch-track" aria-hidden="true">
              <span className="fl-ctl-switch-thumb" />
            </span>
          </span>
          <span>
            <strong>Draw the lines</strong>
            <span className="fl-ctl-matrix-what">{lines ? "On. Useful in a dense list where rows nearly touch." : "Off. In a roomy list, space does the whole job."}</span>
          </span>
        </label>
        <ul className={`fl-ctl-div-list${lines ? " has-rules" : ""}`}>
          {d.rows.map((r) => (
            <li key={r}>
              <strong>{r}</strong>
              <span className="fl-ctl-matrix-what">12 June &middot; 420 photos</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Horizontal</h3>
        <p className="fl-ctl-btn-what">Three weights. Pick one for the whole app: hairline inside a card, regular between sections, heavy almost never.</p>
        <div className="fl-ctl-div-weights">
          <span className="fl-ctl-matrix-what">Hairline</span>
          <Divider weight="hair" />
          <span className="fl-ctl-matrix-what">Regular</span>
          <Divider />
          <span className="fl-ctl-matrix-what">Heavy</span>
          <Divider weight="heavy" />
          <span className="fl-ctl-matrix-what">Dashed, for something provisional</span>
          <Divider weight="dash" />
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Vertical</h3>
        <p className="fl-ctl-btn-what">Between groups in a toolbar, so a row of buttons reads as two or three sets rather than seven buttons.</p>
        <div className="fl-ctl-div-bar">
          <Button variant="tertiary" size={32} icon="plus" iconOnly>
            New
          </Button>
          <Button variant="tertiary" size={32} icon="pencil" iconOnly>
            Rename
          </Button>
          <Divider variant="vertical" />
          <Button variant="tertiary" size={32} icon="download" iconOnly>
            Download
          </Button>
          <Button variant="tertiary" size={32} icon="send" iconOnly>
            Share
          </Button>
          <Divider variant="vertical" />
          <Button variant="tertiary" size={32} icon="trash" iconOnly>
            Delete
          </Button>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>With a label</h3>
        <p className="fl-ctl-btn-what">A line with a word in it, for when the break itself means something. The word is real text, so it is read out.</p>
        <div className="fl-ctl-div-labelled">
          <Button size={44}>
            Continue with email
          </Button>
          <Divider variant="labelled" label="or" />
          <Button variant="secondary" size={44} icon="globe">
            Continue with your studio account
          </Button>
        </div>
        <Divider variant="labelled" label="Last month" labelAt="start" />
        <p className="fl-ctl-matrix-what">Aligned to the start, this is how a long feed marks where one day ends and the next begins.</p>
      </div>
    </section>
  );
}
