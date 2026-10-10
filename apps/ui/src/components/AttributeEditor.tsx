/**
 * Attributes tab on the Primitives page: edit a component's design attributes directly (no model involved).
 * Changes apply live across the whole app and are saved as theme overrides; colors are per theme.
 */
import { useEffect, useState } from "react";
import { onThemeChange, resetThemeVars, setThemeVar, themeOverrides, activeTheme } from "../theme";

export type Attr =
  | { var: string; label: string; kind: "px"; min: number; max: number; step?: number }
  | { var: string; label: string; kind: "color" }
  | { var: string; label: string; kind: "select"; options: Array<[string, string]> };

/** Attribute definitions per Primitives section id. Radius never exceeds 10px (product rule). */
export const ATTRIBUTES: Record<string, Attr[]> = {
  button: [
    { var: "--btn-primary-bg", label: "Primary background", kind: "color" },
    { var: "--btn-radius", label: "Corner radius", kind: "px", min: 0, max: 10 },
    { var: "--btn-height", label: "Height", kind: "px", min: 28, max: 48 },
    { var: "--btn-font-size", label: "Label size", kind: "px", min: 12, max: 18, step: 0.5 },
    { var: "--btn-pad-x", label: "Horizontal padding", kind: "px", min: 8, max: 32 },
  ],
  chip: [
    { var: "--chip-radius", label: "Corner radius", kind: "px", min: 0, max: 10 },
    { var: "--chip-font-size", label: "Text size", kind: "px", min: 10, max: 14, step: 0.5 },
    { var: "--chip-case", label: "Letter case", kind: "select", options: [["uppercase", "UPPERCASE"], ["none", "As written"], ["capitalize", "Capitalised"]] },
  ],
  input: [
    { var: "--input-radius", label: "Corner radius", kind: "px", min: 0, max: 10 },
    { var: "--input-font-size", label: "Text size", kind: "px", min: 12, max: 18, step: 0.5 },
  ],
  tabs: [{ var: "--tab-font-size", label: "Label size", kind: "px", min: 11, max: 17, step: 0.5 }],
  section: [
    { var: "--card-radius", label: "Card corner radius", kind: "px", min: 0, max: 10 },
    { var: "--space-inset", label: "Card padding", kind: "px", min: 12, max: 40 },
    { var: "--space-gap", label: "Gap between cards", kind: "px", min: 8, max: 40 },
  ],
  notice: [
    { var: "--notice-radius", label: "Corner radius", kind: "px", min: 0, max: 10 },
    { var: "--notice-font-size", label: "Text size", kind: "px", min: 12, max: 17, step: 0.5 },
  ],
  spacing: [
    { var: "--space-page", label: "Page padding", kind: "px", min: 16, max: 96 },
    { var: "--space-head", label: "Title → content", kind: "px", min: 16, max: 64 },
    { var: "--space-gap", label: "Between cards", kind: "px", min: 8, max: 40 },
    { var: "--space-gap-list", label: "Between rows", kind: "px", min: 4, max: 24 },
    { var: "--space-inset", label: "Card padding", kind: "px", min: 12, max: 40 },
    { var: "--space-inset-sm", label: "Compact padding", kind: "px", min: 8, max: 32 },
    { var: "--space-stack", label: "Between form controls", kind: "px", min: 6, max: 28 },
  ],
  color: [
    { var: "--brand-1", label: "Accent (strong)", kind: "color" },
    { var: "--brand-2", label: "Accent", kind: "color" },
    { var: "--brand-3", label: "Accent (soft)", kind: "color" },
    { var: "--sig-ok", label: "Positive (teal)", kind: "color" },
    { var: "--sig-warn", label: "Warning", kind: "color" },
    { var: "--sig-bad", label: "Error", kind: "color" },
  ],
};

/** Reads the value the page is actually using (overrides included), normalised for the control. */
function computed(a: Attr): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(a.var).trim();
  if (a.kind === "color") return toHex(raw);
  if (a.kind === "px") return String(parseFloat(raw) || 0);
  return raw;
}
function toHex(v: string): string {
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v.slice(1).split("").map((c) => c + c).join("")}`;
  // Resolve var()/rgb()/names through the browser.
  const probe = document.createElement("span");
  probe.style.color = v;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  probe.remove();
  return `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
}

export function AttributeEditor({ attrs }: { attrs: Attr[] }) {
  const [, force] = useState(0);
  useEffect(() => onThemeChange(() => force((n) => n + 1)), []);
  const o = themeOverrides();
  const changed = (a: Attr) => a.var in o.all || a.var in o.light || a.var in o.dark;
  const anyChanged = attrs.some(changed);
  return (
    <div className="attr">
      <div className="attr__grid">
        {attrs.map((a) => {
          const value = computed(a);
          const id = `attr-${a.var.slice(2)}`;
          const scope = a.kind === "color" ? "theme" : "all";
          return (
            <div key={a.var} className={`attr__row${changed(a) ? " is-changed" : ""}`}>
              <label htmlFor={id}>
                {a.label}
                <code>{a.var}</code>
              </label>
              {a.kind === "px" ? (
                <div className="attr__control">
                  <input id={id} type="range" min={a.min} max={a.max} step={a.step ?? 1} value={value} onChange={(e) => setThemeVar(a.var, `${e.target.value}px`, scope)} />
                  <span className="mono attr__val">{value}px</span>
                </div>
              ) : a.kind === "color" ? (
                <div className="attr__control">
                  <input id={id} type="color" value={value} onChange={(e) => setThemeVar(a.var, e.target.value, scope)} />
                  <span className="mono attr__val">{value}</span>
                </div>
              ) : (
                <select id={id} className="select" value={value} onChange={(e) => setThemeVar(a.var, e.target.value, scope)}>
                  {a.options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              {changed(a) ? (
                <button className="btn btn--sm btn--ghost" onClick={() => resetThemeVars([a.var])} aria-label={`Reset ${a.label}`}>
                  Reset
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
      <div className="attr__foot">
        <span className="muted">
          Changes apply across the whole app and are saved automatically.{attrs.some((a) => a.kind === "color") ? ` Colors are saved for the ${activeTheme()} theme only.` : ""}
        </span>
        {anyChanged ? (
          <button className="btn btn--sm" onClick={() => resetThemeVars(attrs.map((a) => a.var))}>
            Reset all
          </button>
        ) : null}
      </div>
    </div>
  );
}
