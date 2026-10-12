/** @flowcode-library bg-soft · Soft gradient (Page backgrounds)
 * Catalog ID: c.background (component)
 * Function: The page background component (c.background): twelve gradient and pattern backdrops, and the reference sheet shows the soft one with sample content.
 * Use it as: import { Background, BackgroundContent, BACKGROUND_CLASS } from "./bg-soft"; <Background variant="soft"|"mesh"|"glow"|"aurora"|"split"|"ink"|"dots"|"grid"|"stripes"|"waves"|"topo"|"grain" as?="section"|"div" className?>content that sits on it</Background>. A block can instead add BACKGROUND_CLASS[variant] (e.g. "fl-bg-grid") to its own section.
 * Variants: c.background.soft - Calm, friendly pages (onboarding, help, settings intros): a gentle wash of the accent color at the top fading into the page color.; c.background.mesh - Lively hero sections and landing pages: soft color blooms in the corners from the accent, success and focus colors.; c.background.glow - Product launches and hero sections over a plain page: a spotlight of the accent color glowing from the top edge.; c.background.aurora - One standout moment such as a launch hero or sign-up page: a slowly turning blurred blend of theme colors (still when reduced motion is requested).; c.background.split - Sections pairing a promise with a picture or form: two tones divided on a diagonal, accent tint above and page color below.; c.background.ink - A closing call to action or a stats band: a solid accent band with a soft highlight; text switches to the on-accent color (use a Button on-accent).; c.background.dots - Tools and technical products; behind cards or diagrams: a fine grid of faint dots in the text color.; c.background.grid - Developer and data products; behind a hero: faint grid lines that fade out toward the edges.; c.background.stripes - Playful sections and promotional banners: thin diagonal stripes in a light accent tint.; c.background.waves - Wellness, travel, water or calm brands: repeating wave lines in the accent color.; c.background.topo - Outdoor, maps, travel and exploration products: topographic contour lines in the text color.; c.background.grain - Editorial, craft and premium brands: a subtle paper-like grain over the page color.
 * Look: A page or section backdrop drawn only by design tokens: a gradient or pattern behind centered content.
 * Tokens: --color-accent --color-bg --color-focus --color-on-accent --color-success --color-text --space-3 --space-9
 * Use cases: landing page background; hero background; sign in page background; marketing page; onboarding screen; pricing page background
 * Jobs to be done: feel welcomed by a calm page; focus on the main message; read the page without visual clutter
 * Keywords: background, gradient, page background, soft
 */
/**
 * Page background: soft gradient (gradient). A gentle wash of the accent color at the top, fading into the page.
 * Good for: Calm, friendly pages: onboarding, help, settings intros.
 * Use it as <Background variant="soft"> or by adding the class "fl-bg-soft" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./buttons-variants";

export type BackgroundVariant = "soft" | "mesh" | "glow" | "aurora" | "split" | "ink" | "dots" | "grid" | "stripes" | "waves" | "topo" | "grain";

/** The fl-bg-* class for each variant, for a block that puts a background on its own section. */
export const BACKGROUND_CLASS: Record<BackgroundVariant, string> = {
  soft: "fl-bg-soft",
  mesh: "fl-bg-mesh",
  glow: "fl-bg-glow",
  aurora: "fl-bg-aurora",
  split: "fl-bg-split",
  ink: "fl-bg-ink",
  dots: "fl-bg-dots",
  grid: "fl-bg-grid",
  stripes: "fl-bg-stripes",
  waves: "fl-bg-waves",
  topo: "fl-bg-topo",
  grain: "fl-bg-grain",
};

export type BackgroundProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  variant?: BackgroundVariant;
  as?: "section" | "div";
  children?: ReactNode;
};

/** c.background: a page or section backdrop. All twelve variants are pure CSS (the pattern or gradient is drawn by the class), so no extra layers are needed. */
export function Background({ variant = "soft", as = "section", className, children, style, ...rest }: BackgroundProps) {
  const Tag = as;
  return (
    <Tag
      {...rest}
      data-fl={`c.background.${variant}`}
      className={`fl-section ${BACKGROUND_CLASS[variant]}${className ? ` ${className}` : ""}`}
      style={{ paddingBlock: "var(--space-9)", ...style }}
    >
      {children}
    </Tag>
  );
}

export type BackgroundContentProps = { id?: string; eyebrow: string; title: string; lede: string; action: string; onAccent?: boolean };

/** Sample content that sits on a background: centered heading, text and a button. onAccent switches the button for the ink band. */
export function BackgroundContent({ id, eyebrow, title, lede, action, onAccent }: BackgroundContentProps) {
  return (
    <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
      <span className="fl-eyebrow">{eyebrow}</span>
      <h2 id={id} className="fl-title">
        {title}
      </h2>
      <p className="fl-lede">{lede}</p>
      <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
        <Button variant={onAccent ? "on-accent" : "primary"} href="#start">
          {action}
        </Button>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Soft gradient",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgSoft() {
  return (
    <Background variant="soft" aria-labelledby="bg-soft-title">
      <BackgroundContent id="bg-soft-title" {...SAMPLE} />
    </Background>
  );
}
