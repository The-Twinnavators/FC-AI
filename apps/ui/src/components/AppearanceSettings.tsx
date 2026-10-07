/**
 * Settings → Appearance: choose how light and dark are picked. With "Custom per page", each page has its own mode
 * and moving between pages with different modes fades the colours.
 */
import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEMED_PAGES, manualTheme, readAppearance, saveAppearance, systemTheme, type Appearance, type AppearanceMode, type ThemeName } from "../appearance";

const MODES: Array<{ id: AppearanceMode; label: string; hint: string }> = [
  { id: "toggle", label: "Light/dark toggle", hint: "Switch with the sun and moon button in the top bar. FlowCode remembers your choice." },
  { id: "system", label: "Follow my system", hint: "Match your computer's light or dark setting, including when it changes at sunset." },
  { id: "custom", label: "Custom per page", hint: "Choose light or dark for each page. Moving between pages with different modes fades gently." },
];

export function AppearanceSettings() {
  const [a, setA] = useState<Appearance>(readAppearance);
  const update = (next: Appearance) => {
    setA(next);
    saveAppearance(next);
  };
  const fallback = manualTheme();
  const setAll = (t: ThemeName) => update({ ...a, pages: Object.fromEntries(THEMED_PAGES.map((p) => [p.section, t])) });
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Appearance</h2>
      </div>
      <div className="section__body appear">
        <fieldset className="appear__modes">
          <legend className="appear__legend">How FlowCode picks light or dark</legend>
          {MODES.map((m) => (
            <label key={m.id} className={`appear__mode${a.mode === m.id ? " is-on" : ""}`}>
              <input type="radio" name="appearance-mode" data-cp={`appear-mode-${m.id}`} value={m.id} checked={a.mode === m.id} onChange={() => update({ ...a, mode: m.id })} />
              <span>
                <span className="appear__mode-label">{m.label}</span>
                <span className="appear__mode-hint">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {a.mode === "system" ? <p className="appear__note">Your system is set to {systemTheme()} right now.</p> : null}
        {a.mode === "custom" ? (
          <div className="appear__pages">
            <div className="appear__pages-head">
              <p className="appear__note">Pages you haven&apos;t set use your last toggle choice ({fallback}). The top-bar button changes the page you&apos;re on.</p>
              <div className="appear__all">
                <button type="button" className="btn btn--sm" onClick={() => setAll("light")}>
                  All light
                </button>
                <button type="button" className="btn btn--sm" onClick={() => setAll("dark")}>
                  All dark
                </button>
              </div>
            </div>
            <ul className="appear__list" data-cp="appear-pages">
              {THEMED_PAGES.map((p) => {
                const cur = a.pages[p.section] ?? fallback;
                return (
                  <li key={p.section || "home"} className="appear__row">
                    <span className="appear__page" id={`appear-${p.section || "home"}`}>
                      {p.label}
                    </span>
                    <div className="seg" role="radiogroup" aria-labelledby={`appear-${p.section || "home"}`}>
                      {(["light", "dark"] as const).map((t) => (
                        <button key={t} type="button" role="radio" aria-checked={cur === t} className={`seg__btn${cur === t ? " is-on" : ""}`} onClick={() => update({ ...a, pages: { ...a.pages, [p.section]: t } })}>
                          {t === "light" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
                          {t === "light" ? "Light" : "Dark"}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
