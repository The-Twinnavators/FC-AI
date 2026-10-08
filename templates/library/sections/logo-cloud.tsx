/**
 * Logo cloud: "Trusted by" wordmarks of the businesses that use you, in three layouts: a simple row, a tidy grid and a
 * slow scrolling strip that pauses on hover, on focus or with its pause button, and stands still for people who ask
 * for less motion. Use it under a hero or near pricing. Make it the app's own: replace SAMPLE's names with your real
 * customers (with their permission) and swap the drawn marks for their logo files.
 */
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  row: { caption: "Trusted by makers, shops and studios across the county" },
  grid: { title: "Studios that teach with us", lede: "From one-room workshops to community art centres." },
  marquee: { caption: "Stocked by independent shops", pause: "Pause scrolling", play: "Play scrolling" },
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
  ],
};

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

type Logo = (typeof SAMPLE.logos)[number];

function Wordmark({ logo }: { logo: Logo }) {
  return (
    <span className={`fl-dsp-logo${logo.style ? ` fl-dsp-logo--${logo.style}` : ""}`} role="img" aria-label={logo.name}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={MARKS[logo.mark]} />
      </svg>
      <span aria-hidden="true">{logo.name}</span>
    </span>
  );
}

export default function LogoCloud() {
  const d = SAMPLE;
  const [paused, setPaused] = useState(false);
  return (
    <section className="fl-section" aria-labelledby="logo-cloud-title">
      <div className="fl-wrap">
        <div className="fl-dsp-logo-block">
          <h2 id="logo-cloud-title" className="fl-dsp-logo-cap">
            {d.row.caption}
          </h2>
          <ul className="fl-dsp-logos">
            {d.logos.slice(0, 6).map((l) => (
              <li key={l.name}>
                <Wordmark logo={l} />
              </li>
            ))}
          </ul>
        </div>

        <div className="fl-dsp-logo-block">
          <div className="fl-head fl-head--center" style={{ marginBottom: 0 }}>
            <h3 className="fl-title fl-title--md">{d.grid.title}</h3>
            <p className="fl-text">{d.grid.lede}</p>
          </div>
          <ul className="fl-dsp-logo-grid">
            {d.logos.map((l) => (
              <li key={l.name}>
                <Wordmark logo={l} />
              </li>
            ))}
          </ul>
        </div>

        <div className="fl-dsp-logo-block">
          <div className="fl-dsp-toolbar" style={{ marginBottom: 0, justifyContent: "center" }}>
            <h3 className="fl-dsp-logo-cap">{d.marquee.caption}</h3>
            <button type="button" className="fl-dsp-btn fl-dsp-btn--ghost fl-dsp-marquee-toggle" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              {paused ? d.marquee.play : d.marquee.pause}
            </button>
          </div>
          <div className="fl-dsp-marquee" data-paused={paused}>
            <div className="fl-dsp-marquee__track">
              <ul>
                {d.logos.map((l) => (
                  <li key={l.name}>
                    <Wordmark logo={l} />
                  </li>
                ))}
              </ul>
              <ul aria-hidden="true">
                {d.logos.map((l) => (
                  <li key={l.name}>
                    <Wordmark logo={l} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
