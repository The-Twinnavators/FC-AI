/**
 * Styles → Components, left column: a small design studio (after CSSVibes). Every control writes the app's design
 * tokens straight away (debounced while dragging), for the theme shown in the preview, so the building blocks beside
 * it, the live Preview and every screen change together. Each change can be undone.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { STYLE_VIBES } from "@flowcode/contracts";
import { post, useResource } from "../api";
import type { PreviewTheme } from "./PreviewTheme";
import { stylesChanged, STYLES_CHANGED } from "./ComponentSheet";
import { ComponentPickerModal } from "./ComponentPickerModal";
import { COMPONENT_CATALOG, KIT_BLOCK } from "./componentPickerData";

interface Token {
  name: string;
  value: string;
  theme: "default" | "light" | "dark";
  resolved?: string;
}

/** Fonts that load from Google Fonts (so they look the same on every computer), and a system stack. */
const FONTS: Array<{ family: string; group: "Sans-serif" | "Serif" | "Display" | "Monospace" | "System"; google: boolean; fallback: string }> = [
  { family: "System UI", group: "System", google: false, fallback: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  ...["Inter", "DM Sans", "Manrope", "Plus Jakarta Sans", "Figtree", "Outfit", "Work Sans", "IBM Plex Sans", "Source Sans 3", "Nunito Sans", "Lato", "Open Sans"].map((family) => ({ family, group: "Sans-serif" as const, google: true, fallback: "system-ui, sans-serif" })),
  ...["Space Grotesk", "Sora", "Bricolage Grotesque", "Archivo", "Syne", "Unbounded"].map((family) => ({ family, group: "Display" as const, google: true, fallback: "system-ui, sans-serif" })),
  ...["Fraunces", "Playfair Display", "DM Serif Display", "Lora", "Merriweather", "Source Serif 4", "Instrument Serif"].map((family) => ({ family, group: "Serif" as const, google: true, fallback: "Georgia, serif" })),
  ...["JetBrains Mono", "IBM Plex Mono", "Fira Code"].map((family) => ({ family, group: "Monospace" as const, google: true, fallback: "ui-monospace, Consolas, monospace" })),
];
const stackOf = (f: (typeof FONTS)[number]) => (f.google ? `"${f.family}", ${f.fallback}` : f.fallback);
const firstFamily = (stack: string) => stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
const fontOf = (stack?: string) => (stack ? FONTS.find((f) => (f.google ? f.family === firstFamily(stack) : /^system-ui/.test(stack.trim()))) : undefined);

const COLORS: Array<{ name: string; label: string; text?: boolean }> = [
  { name: "--color-accent", label: "Accent" },
  { name: "--color-bg", label: "Page" },
  { name: "--color-surface", label: "Surface" },
  { name: "--color-surface-sunken", label: "Sunken" },
  { name: "--color-text", label: "Text", text: true },
  { name: "--color-text-muted", label: "Muted text", text: true },
  { name: "--color-border", label: "Border" },
  { name: "--color-on-accent", label: "Text on accent", text: true },
  { name: "--color-success", label: "Success", text: true },
  { name: "--color-danger", label: "Danger", text: true },
];

const SCALES: Array<{ ratio: number; label: string }> = [
  { ratio: 1.125, label: "Calm" },
  { ratio: 1.2, label: "Balanced" },
  { ratio: 1.25, label: "Clear" },
  { ratio: 1.333, label: "Bold" },
  { ratio: 1.5, label: "Dramatic" },
];
/** CSSVibes' button sizes: height, side padding and text size for each control size. */
const SIZES: Array<{ id: "sm" | "md" | "lg" | "xl"; label: string; height: number; pad: number; text: number }> = [
  { id: "sm", label: "Small", height: 32, pad: 16, text: 13 },
  { id: "md", label: "Medium", height: 40, pad: 20, text: 14 },
  { id: "lg", label: "Large", height: 48, pad: 24, text: 16 },
  { id: "xl", label: "Extra large", height: 56, pad: 28, text: 18 },
];
const SIZE_TOKENS: Record<string, string> = Object.fromEntries(
  SIZES.flatMap((z) => [
    [`--control-${z.id}`, `${z.height / 16}rem`],
    [`--control-pad-${z.id}`, `${z.pad / 16}rem`],
    [`--control-text-${z.id}`, `${z.text / 16}rem`],
  ]),
);

const toPx = (v?: string) => {
  const m = v ? /^(-?\d*\.?\d+)(px|rem|em)$/.exec(v.trim()) : null;
  return m ? Number(m[1]) * (m[2] === "px" ? 1 : 16) : undefined;
};
const rem = (px: number) => `${Math.round((px / 16) * 1000) / 1000}rem`;

/** Text sizes for a base size and a ratio: two steps down, four up. */
function typeScale(base: number, ratio: number): Record<string, string> {
  return {
    "--text-xs": rem(Math.round(base / ratio / ratio)),
    "--text-sm": rem(Math.round(base / ratio)),
    "--text-md": rem(base),
    "--text-lg": rem(Math.round(base * ratio)),
    "--text-xl": rem(Math.round(base * ratio ** 2)),
    "--text-2xl": rem(Math.round(base * ratio ** 3)),
    "--text-3xl": rem(Math.round(base * ratio ** 4)),
  };
}
/** Corners go well past the starter's 10px, for very round designs; design QA's cap follows these tokens. */
const MAX_RADIUS = 32;
const radii = (r: number): Record<string, string> => ({ "--radius-sm": `${Math.round(r * 0.4)}px`, "--radius-md": `${Math.round(r * 0.6)}px`, "--radius-lg": `${Math.round(r * 0.8)}px`, "--radius-xl": `${r}px` });

// Contrast (WCAG) for the text colours.
const hexRgb = (hex: string) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isNaN(n) || full.length !== 6 ? undefined : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (rgb: number[]) => rgb.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
function contrast(a?: string, b?: string): number | undefined {
  const x = a && hexRgb(a);
  const y = b && hexRgb(b);
  if (!x || !y) return undefined;
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10;
}
const HEX6 = /^#[0-9a-f]{6}$/i;

/** The sections a Configure modal shows (all of them when not given). */
export type ControlSection = "style" | "fonts" | "type" | "corners" | "density";

export function DesignControls({ projectId, theme, onDraft, only }: { projectId: string; theme: PreviewTheme; onDraft: (values: Record<string, string>) => void; only?: ControlSection[] }) {
  const show = (x: ControlSection) => !only || only.includes(x);
  const { data, reload } = useResource<{ tokens: Token[] }>(`/projects/${projectId}/styles`, [projectId]);
  const surface = useResource<{ current?: string; supported?: boolean }>(`/projects/${projectId}/styles/surface`, [projectId]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<Array<{ ids: string[]; label: string }>>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const pending = useRef<{ values: Record<string, string>; label: string; timer?: number }>({ values: {}, label: "" });
  const dark = theme === "dark";

  useEffect(() => {
    const again = () => (reload(), surface.reload());
    window.addEventListener(STYLES_CHANGED, again);
    return () => window.removeEventListener(STYLES_CHANGED, again);
  }, [reload, surface]);
  // Fresh values from the app replace the draft (the sheet already shows them).
  useEffect(() => setDraft({}), [data]);
  useEffect(() => onDraft(draft), [draft, onDraft]);

  /** The value the app uses for this theme: the dark override when showing dark, else the default. */
  const value = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.tokens ?? []) if (t.theme === "default" && !m.has(t.name)) m.set(t.name, t.resolved ?? t.value);
    if (dark) for (const t of data?.tokens ?? []) if (t.theme === "dark") m.set(t.name, t.resolved ?? t.value);
    return (name: string) => draft[name] ?? m.get(name);
  }, [data, dark, draft]);
  const has = (name: string) => !!data?.tokens.some((t) => t.name === name);

  const send = async (values: Record<string, string>, label: string, googleFonts?: string[]) => {
    setMsg(undefined);
    try {
      const r = await post<{ snapshotId?: string; changed: string[] }>(`/projects/${projectId}/design`, { theme: dark ? "dark" : "default", values, googleFonts });
      if (r.snapshotId) setUndo((u) => [{ ids: [r.snapshotId as string], label }, ...u].slice(0, 40));
      stylesChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setDraft({});
    }
  };
  /** Shows the change at once and saves it shortly after the last move (sliders and colour pickers fire often). */
  const change = (values: Record<string, string>, label: string, wait = 450) => {
    setDraft((d) => ({ ...d, ...values }));
    const p = pending.current;
    p.values = { ...p.values, ...values };
    p.label = label;
    window.clearTimeout(p.timer);
    p.timer = window.setTimeout(() => {
      const { values: v, label: l } = pending.current;
      pending.current = { values: {}, label: "" };
      void send(v, l);
    }, wait);
  };
  const undoLast = async () => {
    const [last, ...rest] = undo;
    if (!last) return;
    try {
      for (const id of [...last.ids].reverse()) await post(`/snapshots/${id}/restore`);
      setUndo(rest);
      setMsg({ ok: true, text: `Undid ${last.label}.` });
      stylesChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  const useStyle = async (id: string) => {
    try {
      const r = await post<{ snapshotIds: string[] }>(`/projects/${projectId}/styles/surface`, { vibe: id });
      setUndo((u) => [{ ids: r.snapshotIds ?? [], label: `the ${STYLE_VIBES.find((v) => v.id === id)?.name} style` }, ...u].slice(0, 40));
      stylesChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  const setFont = (token: string, family: string, label: string) => {
    const f = FONTS.find((x) => x.family === family);
    if (!f) return;
    const next: Record<string, string> = { [token]: stackOf(f) };
    // Every Google font the app uses after this change, so the managed @import loads exactly those.
    const google = ["--font-sans", "--font-display", "--font-mono"]
      .map((n) => fontOf(n === token ? next[token] : value(n)))
      .filter((x): x is (typeof FONTS)[number] => !!x?.google)
      .map((x) => x.family);
    setDraft((d) => ({ ...d, ...next }));
    void send(next, `${label} font`, google);
  };

  if (!data) return <div className="studio__controls" aria-busy="true" />;
  const base = toPx(value("--text-md")) ?? 16;
  const ratio = (() => {
    const lg = toPx(value("--text-lg"));
    const r = lg ? lg / base : 1.25;
    return SCALES.reduce((best, s) => (Math.abs(s.ratio - r) < Math.abs(best.ratio - r) ? s : best)).ratio;
  })();
  const radius = toPx(value("--radius-xl")) ?? 10;
  const pill = (toPx(value("--control-radius")) ?? 0) >= 999;
  // The app uses CSSVibes' sizes when every control height matches them.
  const cssvibesSizes = SIZES.filter((z) => z.id !== "xl" || has("--control-xl")).every((z) => toPx(value(`--control-${z.id}`)) === z.height);
  const bg = value("--color-bg");
  const surfaceColor = value("--color-surface");
  const current = surface.data?.current ?? "flat";

  return (
    <div className="studio__controls">
      <div className="studio__head">
        <span className="muted">
          Editing the <b>{dark ? "dark" : "light"}</b> theme. Changes save to the app as you make them.
        </span>
        <button type="button" className="btn btn--sm" onClick={undoLast} disabled={!undo.length} title={undo[0] ? `Undo ${undo[0].label}` : "Nothing to undo"}>
          <Undo2 size={14} aria-hidden="true" /> Undo
        </button>
      </div>
      {msg ? (
        <p className={`notice${msg.ok ? " notice--ok" : " notice--bad"}`} role={msg.ok ? "status" : "alert"} style={{ margin: 0 }}>
          {msg.text}
        </p>
      ) : null}

      {show("style") && surface.data?.supported !== false ? (
        <fieldset className="studio__sec">
          <legend>Style</legend>
          <div className="studio__chips">
            {STYLE_VIBES.map((v) => (
              <button key={v.id} type="button" className={`studio__chip${current === v.id ? " is-on" : ""}`} aria-pressed={current === v.id} title={v.description} onClick={() => current !== v.id && void useStyle(v.id)}>
                {v.name}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {show("fonts") ? (
      <fieldset className="studio__sec">
        <legend>Fonts</legend>
        {(
          [
            ["--font-sans", "Body"],
            ["--font-display", "Headings"],
            ["--font-mono", "Code"],
          ] as const
        )
          .filter(([n]) => has(n))
          .map(([n, label]) => {
            const f = fontOf(value(n));
            return (
              <label key={n} className="studio__row">
                <span>{label}</span>
                <select className="select" value={f?.family ?? ""} onChange={(e) => setFont(n, e.target.value, label)}>
                  {f ? null : <option value="">{firstFamily(value(n) ?? "")} (current)</option>}
                  {(["System", "Sans-serif", "Display", "Serif", "Monospace"] as const).map((g) => (
                    <optgroup key={g} label={g}>
                      {FONTS.filter((x) => x.group === g).map((x) => (
                        <option key={x.family} value={x.family}>
                          {x.family}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            );
          })}
      </fieldset>

      ) : null}

      {show("type") && has("--text-md") ? (
        <fieldset className="studio__sec">
          <legend>Type scale</legend>
          <label className="studio__row">
            <span>
              Body size <span className="mono muted">{base}px</span>
            </span>
            <input type="range" min={14} max={20} step={1} value={base} onChange={(e) => change(typeScale(Number(e.target.value), ratio), "the body size")} />
          </label>
          <div className="studio__chips" role="group" aria-label="Heading contrast">
            {SCALES.map((s) => (
              <button key={s.ratio} type="button" className={`studio__chip${ratio === s.ratio ? " is-on" : ""}`} aria-pressed={ratio === s.ratio} onClick={() => change(typeScale(base, s.ratio), "the type scale", 0)}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {show("corners") && has("--radius-xl") ? (
        <fieldset className="studio__sec">
          <legend>Corners</legend>
          <label className="studio__row">
            <span>
              Roundness <span className="mono muted">{radius}px</span>
            </span>
            <input type="range" min={0} max={MAX_RADIUS} step={1} value={Math.min(radius, MAX_RADIUS)} onChange={(e) => change(radii(Number(e.target.value)), "the corners")} />
          </label>
          <label className="studio__check">
            <input type="checkbox" checked={pill} onChange={(e) => change({ "--control-radius": e.target.checked ? "999px" : "var(--radius-md)" }, e.target.checked ? "pill-shaped controls" : "the control corners")} />
            <span>
              Pill-shaped buttons and fields
              <span className="muted"> · fully round ends; cards keep the roundness above</span>
            </span>
          </label>
        </fieldset>
      ) : null}

      {show("density") && has("--control-md") ? (
        <fieldset className="studio__sec">
          <legend>Sizes</legend>
          <p className="dmodal__note muted">CSSVibes&apos; control sizes. Buttons, fields and selects share them, so they line up.</p>
          <table className="size-table">
            <thead>
              <tr>
                <th scope="col">Size</th>
                <th scope="col">Height</th>
                <th scope="col">Padding</th>
                <th scope="col">Text</th>
                <th scope="col">
                  <span className="sr-only">In the app now</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {SIZES.map((z) => {
                const now = toPx(value(`--control-${z.id}`));
                return (
                  <tr key={z.id}>
                    <th scope="row">{z.label}</th>
                    <td className="mono">{z.height}px</td>
                    <td className="mono">{z.pad}px</td>
                    <td className="mono">{z.text}px</td>
                    <td className="muted size-table__now">{now === undefined ? "not set" : now === z.height ? "in use" : `now ${Math.round(now)}px`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" className={`btn btn--sm${cssvibesSizes ? "" : " btn--primary"}`} disabled={cssvibesSizes} onClick={() => change(SIZE_TOKENS, "CSSVibes sizes", 0)}>
            {cssvibesSizes ? "Using CSSVibes sizes" : "Use CSSVibes sizes"}
          </button>
        </fieldset>
      ) : null}
    </div>
  );
}

/**
 * The components in this design: chips to remove them, and "Add components" (the CSSVibes picker). A pick the starter
 * kit already has is stored as its building block, so it shows in the sheet; any other pick is stored by name and
 * the builder makes it from the tokens.
 */
export function DesignComponentsBar({ projectId, used, onChange }: { projectId: string; used: string[]; onChange: (shown: string[]) => void }) {
  const { data, reload } = useResource<{ components?: string[]; catalogue: Array<{ block: string; label: string }> }>(`/projects/${projectId}/design/components`, [projectId]);
  const styles = useResource<{ tokens: Token[] }>(`/projects/${projectId}/styles`, [projectId]);
  const [adding, setAdding] = useState(false);
  // Only kit components (ui-…) are chips; a saved list from before may still hold app-only classes.
  const shown = (data?.components ?? used).filter((b) => (/^ui-/.test(b) ? !["ui-input", "ui-skip", "ui-sr-only", "ui-narrow"].includes(b) : COMPONENT_CATALOG.some((c) => c.id === b)));
  useEffect(() => onChange(shown), [shown.join(","), onChange]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener(STYLES_CHANGED, styles.reload);
    return () => window.removeEventListener(STYLES_CHANGED, styles.reload);
  }, [styles.reload]);
  if (!data) return null;
  const token = (name: string) => styles.data?.tokens.find((t) => t.name === name && t.theme === "default");
  const tokenValue = (name: string) => token(name)?.resolved ?? token(name)?.value;
  const label = (b: string) =>
    COMPONENT_CATALOG.find((c) => c.id === b || KIT_BLOCK[c.id] === b)?.label ?? data.catalogue.find((c) => c.block === b)?.label ?? b;
  const save = async (next: string[]) => {
    await post(`/projects/${projectId}/design/components`, { components: next });
    reload();
  };
  const configured = COMPONENT_CATALOG.filter((c) => shown.includes(c.id) || (KIT_BLOCK[c.id] && shown.includes(KIT_BLOCK[c.id]))).map((c) => c.id);
  return (
    <div className="studio__parts">
      <span className="studio__parts-label">In this design</span>
      {shown.map((b) => (
        <span key={b} className="studio__part">
          {label(b)}
          <button type="button" aria-label={`Remove ${label(b)}`} onClick={() => void save(shown.filter((x) => x !== b))}>
            ×
          </button>
        </span>
      ))}
      <button type="button" className="btn btn--sm" aria-haspopup="dialog" onClick={() => setAdding(true)}>
        + Add components
      </button>
      <ComponentPickerModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        configured={configured}
        onAdd={(ids) => void save([...new Set([...shown, ...ids.map((id) => KIT_BLOCK[id] ?? id)])])}
        primaryColor={HEX6.test(tokenValue("--color-accent") ?? "") ? (tokenValue("--color-accent") as string) : "#9810FA"}
        radiusSm={tokenValue("--radius-sm") ?? "6px"}
        radiusMd={tokenValue("--radius-md") ?? "8px"}
      />
    </div>
  );
}
