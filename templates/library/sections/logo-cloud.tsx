/** @flowcode-library logo-cloud · Logo cloud (Testimonials)
 * Catalog ID: b.logo-cloud (block)
 * Function: The logo cloud block (b.logo-cloud): trusted-by wordmarks as a row, a grid or a pausable scrolling strip.
 * Use it as: import { LogoCloud } from "./logo-cloud"; <LogoCloud variant?="row"|"grid"|"marquee" title lede? id? logos={[{name,mark:"flame"|"leaf"|"fold"|"rings"|"wave"|"dot"|"grid"|"pebble",style?:""|"serif"|"mono"|"caps"}]} pauseLabel? playLabel? />
 * Variants: b.logo-cloud.row - a caption over one line of up to six logos, under a hero; b.logo-cloud.grid - a heading and lede over every logo in a grid, for a customers page; b.logo-cloud.marquee - a caption and pause button over a slowly scrolling strip, for many logos in little height
 * Built from: c.button.tertiary
 * Look: Muted centered caption over quiet wordmarks (a small drawn symbol beside lettering), as a row, a grid or a slowly scrolling strip with a pause button.
 * Tokens: --space-5 --space-8 --text-sm --color-text-muted --color-border --color-surface
 * Use cases: trusted by; customer logos; client list; partners; social proof; as featured in; sponsors
 * Jobs to be done: see who already uses this; judge if the company is credible; check if businesses like mine use it
 * Keywords: logos, trusted by, social proof, marquee, customers, clients
 */
/**
 * Logo cloud: "Trusted by" wordmarks of the businesses that use you, in three layouts: a simple row, a tidy grid and a
 * slow scrolling strip that pauses on hover, on focus or with its pause button, and stands still for people who ask
 * for less motion. Use it under a hero or near pricing. Make it the app's own: replace SAMPLE's names with your real
 * customers (with their permission) and swap the drawn marks for their logo files.
 */
import { useState } from "react";
import { Button } from "./buttons-variants";

const MARKS: Record<string, string> = {
  flame: "M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-2-1-4 0-6z",
  leaf: "M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l8-8",
  fold: "M4 6l8-3 8 3v12l-8 3-8-3zM12 3v18",
  rings: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  wave: "M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0",
  dot: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  pebble: "M6 15c-2-4 1-9 6-9s9 3 8 7-5 6-9 6-4-1-5-4z",
};

export type LogoMark = "flame" | "leaf" | "fold" | "rings" | "wave" | "dot" | "grid" | "pebble";
export type LogoStyle = "" | "serif" | "mono" | "caps";
export type LogoItem = {
  name: string;
  /** The small drawn symbol beside the name. */
  mark: LogoMark;
  /** The lettering: plain when "" or left out. */
  style?: LogoStyle;
};
export type LogoCloudVariant = "row" | "grid" | "marquee";

export type LogoCloudProps = {
  /** row: one line of up to six logos; grid: all of them in a grid; marquee: a scrolling strip. row when left out. */
  variant?: LogoCloudVariant;
  /** Base of the heading's id. "logo-cloud" when left out. */
  id?: string;
  /** The caption (row, marquee) or heading (grid). */
  title: string;
  /** A sentence under the heading; used by the grid. */
  lede?: string;
  logos: LogoItem[];
  /** Marquee only: the pause button's label while scrolling and while paused. */
  pauseLabel?: string;
  playLabel?: string;
};

// Written out in full so a build finds every class a variant needs.
const WORD_STYLE: Record<LogoStyle, string> = { "": "", serif: " fl-dsp-logo--serif", mono: " fl-dsp-logo--mono", caps: " fl-dsp-logo--caps" };

function Wordmark({ logo }: { logo: LogoItem }) {
  return (
    <span className={`fl-dsp-logo${WORD_STYLE[logo.style ?? ""]}`} role="img" aria-label={logo.name}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={MARKS[logo.mark]} />
      </svg>
      <span aria-hidden="true">{logo.name}</span>
    </span>
  );
}

export function LogoCloud({ variant = "row", id = "logo-cloud", title, lede, logos, pauseLabel = "Pause scrolling", playLabel = "Play scrolling" }: LogoCloudProps) {
  const [paused, setPaused] = useState(false);
  const titleId = `${id}-title`;
  return (
    <section className="fl-section" aria-labelledby={titleId} data-fl={`b.logo-cloud.${variant}`}>
      <div className="fl-wrap">
        {variant === "row" ? (
          <div className="fl-dsp-logo-block">
            <h2 id={titleId} className="fl-dsp-logo-cap">
              {title}
            </h2>
            <ul className="fl-dsp-logos">
              {logos.slice(0, 6).map((l) => (
                <li key={l.name}>
                  <Wordmark logo={l} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {variant === "grid" ? (
          <div className="fl-dsp-logo-block">
            <div className="fl-head fl-head--center" style={{ marginBottom: 0 }}>
              <h2 id={titleId} className="fl-title fl-title--md">
                {title}
              </h2>
              {lede ? <p className="fl-text">{lede}</p> : null}
            </div>
            <ul className="fl-dsp-logo-grid">
              {logos.map((l) => (
                <li key={l.name}>
                  <Wordmark logo={l} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {variant === "marquee" ? (
          <div className="fl-dsp-logo-block">
            <div className="fl-dsp-toolbar" style={{ marginBottom: 0, justifyContent: "center" }}>
              <h2 id={titleId} className="fl-dsp-logo-cap">
                {title}
              </h2>
              <Button variant="tertiary" size={32} className="fl-dsp-marquee-toggle" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
                {paused ? playLabel : pauseLabel}
              </Button>
            </div>
            <div className="fl-dsp-marquee" data-paused={paused}>
              <div className="fl-dsp-marquee__track">
                <ul>
                  {logos.map((l) => (
                    <li key={l.name}>
                      <Wordmark logo={l} />
                    </li>
                  ))}
                </ul>
                <ul aria-hidden="true">
                  {logos.map((l) => (
                    <li key={l.name}>
                      <Wordmark logo={l} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  row: { title: "Trusted by makers, shops and studios across the county" },
  grid: { title: "Studios that teach with us", lede: "From one-room workshops to community art centers." },
  marquee: { title: "Stocked by independent shops" },
  // Invented businesses. `mark` picks one of the small drawn symbols; `style` picks the lettering.
  logos: [
    { name: "Kilnworks", mark: "flame", style: "" },
    { name: "Maple & Moss", mark: "leaf", style: "serif" },
    { name: "northpaper", mark: "fold", style: "mono" },
    { name: "Oakline", mark: "rings", style: "caps" },
    { name: "Tidehouse", mark: "wave", style: "" },
    { name: "Studio Fen", mark: "dot", style: "serif" },
    { name: "Brightloom", mark: "grid", style: "caps" },
    { name: "Pebble Co.", mark: "pebble", style: "mono" },
  ] satisfies LogoItem[],
};

export default function LogoCloudPreview() {
  const d = SAMPLE;
  return (
    <>
      <LogoCloud variant="row" id="logo-row" title={d.row.title} logos={d.logos} />
      <LogoCloud variant="grid" id="logo-grid" title={d.grid.title} lede={d.grid.lede} logos={d.logos} />
      <LogoCloud variant="marquee" id="logo-marquee" title={d.marquee.title} logos={d.logos} />
    </>
  );
}
