/**
 * Workspace → Styles, two views:
 *  - Tokens: the project's design primitives (CSS custom properties) grouped as colors, typography, spacing, radius,
 *    shadows and motion. Editing a value rewrites that one declaration (snapshotted, so it can be undone). Tokens
 *    nothing uses are tucked away.
 *  - Components: a visual style sheet of the reusable parts the app already has (CSS class families rendered with
 *    the app's own stylesheets, and its React components). Coding agents get the same list so they reuse these.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Boxes, Layers, Palette, RefreshCw, Sparkles, Undo2, Wand2 } from "lucide-react";
import { ExtrasPanel } from "./ExtrasPanel";
import { DirectionEditor } from "./DirectionEditor";
import { ComponentSheet, stylesChanged, StylesBar } from "./ComponentSheet";
import { SurfacePanel } from "./SurfacePanel";
import { StyleCapture } from "./StyleCapture";
import { post, useResource } from "../api";
import { Empty } from "./ui";
import { SkeletonBlock } from "./motion";

type Group = "color" | "typography" | "spacing" | "radius" | "shadow" | "motion" | "other";
type Theme = "default" | "light" | "dark";
interface Token {
  name: string;
  value: string;
  group: Group;
  theme: Theme;
  selector: string;
  file: string;
  line: number;
  uses: number;
  resolved?: string;
}
interface Scan {
  tokens: Token[];
  files: string[];
  scanned: number;
  truncated: boolean;
}

const GROUPS: Array<{ id: Group; label: string }> = [
  { id: "color", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing & sizes" },
  { id: "radius", label: "Radius" },
  { id: "shadow", label: "Shadows" },
  { id: "motion", label: "Motion" },
  { id: "other", label: "Other" },
];
const keyOf = (t: Token) => `${t.file}|${t.selector}|${t.name}`;
const HEX = /^#([0-9a-f]{6})$/i;

/**
 * The project's brand direction on the Design tab: its honest state (base styling, selected, applied, differs) and
 * the shared look editor (DirectionEditor), the same one as the plan card and the design review.
 */
function DirectionButton({ projectId, open, onToggle }: { projectId: string; open: boolean; onToggle: () => void }) {
  const state = useResource<{ label: string }>(`/projects/${projectId}/design/state`, [projectId, open]);
  return (
    <button type="button" className="btn btn--sm ds-open" aria-expanded={open} onClick={onToggle} title={state.data?.label}>
      <Palette size={14} aria-hidden="true" /> <span className="ds-open__label">{state.data?.label ?? "Brand direction"}</span>
    </button>
  );
}

export function StylesPanel({ projectId }: { projectId: string }) {
  const [view, setView] = useState<"tokens" | "surface" | "components" | "extras">("components");
  const [capturing, setCapturing] = useState(false);
  const [direction, setDirection] = useState(false);
  // "Change in Look" from a Colors, Typography or Surface card opens the shared editor here.
  useEffect(() => {
    const open = () => {
      setDirection(true);
      requestAnimationFrame(() => document.querySelector(".ds-panel")?.scrollIntoView({ block: "start" }));
    };
    window.addEventListener("fc:open-look", open);
    return () => window.removeEventListener("fc:open-look", open);
  }, []);
  return (
    <div className="styles-wrap">
      <StylesBar projectId={projectId} />
      <div className="styles-top">
      <div className="styles-views" data-cp="design-views" role="tablist" aria-label="Styles view">
        <button type="button" role="tab" aria-selected={view === "components"} className="styles-views__btn" onClick={() => setView("components")}>
          <Boxes size={14} aria-hidden="true" /> Design
        </button>
        <button type="button" role="tab" aria-selected={view === "tokens"} className="styles-views__btn" onClick={() => setView("tokens")}>
          <Palette size={14} aria-hidden="true" /> Tokens
        </button>
        <button type="button" role="tab" aria-selected={view === "surface"} className="styles-views__btn" onClick={() => setView("surface")}>
          <Layers size={14} aria-hidden="true" /> Surface
        </button>
        <button type="button" role="tab" aria-selected={view === "extras"} className="styles-views__btn" data-cp="design-view-extras" onClick={() => setView("extras")}>
          <Sparkles size={14} aria-hidden="true" /> Extras
        </button>
      </div>
        <div className="styles-top__actions">
          <DirectionButton projectId={projectId} open={direction} onToggle={() => setDirection((d) => !d)} />
          <button type="button" className="btn btn--sm" data-cp="capture-open" data-cp-safe aria-expanded={capturing} onClick={() => setCapturing((c) => !c)}>
            <Wand2 size={14} aria-hidden="true" /> Capture a style
          </button>
        </div>
      </div>
      {direction ? (
        <div className="ds-panel">
          <DirectionEditor projectId={projectId} where="tab" onAppearance={undefined} />
        </div>
      ) : null}
      {capturing ? <StyleCapture projectId={projectId} onClose={() => setCapturing(false)} /> : null}
      {view === "extras" ? <ExtrasPanel projectId={projectId} /> : view === "tokens" ? <TokensView projectId={projectId} /> : view === "surface" ? <SurfacePanel projectId={projectId} /> : <ComponentSheet projectId={projectId} />}
    </div>
  );
}

function TokensView({ projectId }: { projectId: string }) {
  const { data, error, reload, loading } = useResource<Scan>(`/projects/${projectId}/styles`, [projectId]);
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState<"all" | Theme>("all");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<Array<{ snapshotId: string; label: string }>>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [saving, setSaving] = useState<string>();
  const [showUnused, setShowUnused] = useState(false);
  const unused = useMemo(() => (data?.tokens ?? []).filter((t) => t.uses === 0 && !/\.ui-/.test(t.selector)).length, [data]);

  const themes = useMemo(() => [...new Set((data?.tokens ?? []).map((t) => t.theme))], [data]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.tokens ?? [])
      .map((t) => ({ ...t, value: edits[keyOf(t)] ?? t.value }))
      .filter((t) => !/\.ui-/.test(t.selector) && (showUnused || t.uses > 0) && (theme === "all" || t.theme === theme) && (!term || `${t.name} ${t.value}`.toLowerCase().includes(term)));
  }, [data, q, theme, edits, showUnused]);

  const save = async (t: Token, value: string) => {
    const v = value.trim();
    if (!v || v === t.value) return;
    setSaving(keyOf(t));
    setMsg(undefined);
    try {
      const r = await post<{ snapshotId: string }>(`/projects/${projectId}/styles`, { file: t.file, name: t.name, selector: t.selector, expected: t.value, value: v });
      setEdits((e) => ({ ...e, [keyOf(t)]: v }));
      setUndo((u) => [{ snapshotId: r.snapshotId, label: `${t.name}: ${t.value} → ${v}` }, ...u].slice(0, 30));
      setMsg({ ok: true, text: `Saved ${t.name} in ${t.file}. The live preview updates on its own.` });
      reload();
      stylesChanged();
      setEdits({});
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(undefined);
    }
  };
  const undoLast = async () => {
    const [last, ...rest] = undo;
    if (!last) return;
    try {
      await post(`/snapshots/${last.snapshotId}/restore`);
      setUndo(rest);
      setMsg({ ok: true, text: `Undid ${last.label}` });
      reload();
      stylesChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  if (!data) return <div style={{ padding: 16 }}>{error ? <p className="notice notice--bad" role="alert">{error}</p> : <SkeletonBlock rows={5} label="Reading styles" />}</div>;
  const lookup = tokenLookup(data.tokens);
  if (!data.tokens.length)
    return (
      <div style={{ padding: 16 }}>
        <Empty title="No design tokens yet" action={<button className="btn" onClick={reload}>Re-scan</button>}>
          Styles shows the CSS custom properties (like <code>--color-primary: #3a60c4</code>) in this project's stylesheets. Scanned {data.scanned} stylesheet{data.scanned === 1 ? "" : "s"} and found none. Ask the agent to “move the colors, fonts and spacing into design tokens in tokens.css” and they'll appear here.
        </Empty>
      </div>
    );

  return (
    <div className="styles-panel">
      {/* The advanced path, kept apart from the Look: a raw edit is written at once and the Look then shows the app differs. */}
      <p className="notice styles-panel__advanced" role="note">
        <strong>Advanced: direct source edit.</strong> Each change rewrites one token in the app's stylesheet straight away, outside the Look's draft and apply. For colours, fonts and the surface style, use{" "}
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => window.dispatchEvent(new CustomEvent("fc:open-look"))}>
          Look
        </button>
        ; the Look then reports that the app differs from its applied direction.
      </p>
      <div className="styles-panel__bar">
        <span className="muted" style={{ fontSize: 12.5 }}>
          {data.tokens.length - unused} tokens in use · {data.files.length} file{data.files.length === 1 ? "" : "s"}
        </span>
        {unused ? (
          <button type="button" className="btn btn--sm btn--ghost" aria-pressed={showUnused} onClick={() => setShowUnused((v) => !v)} title="Tokens defined but not used anywhere in the app">
            {showUnused ? `Hide ${unused} unused` : `Show ${unused} unused`}
          </button>
        ) : null}
        <label className="sr-only" htmlFor="styles-q">
          Filter tokens
        </label>
        <input id="styles-q" className="input styles-panel__q" placeholder="Filter by name or value" value={q} onChange={(e) => setQ(e.target.value)} />
        {themes.length > 1 ? (
          <select className="select styles-panel__theme" aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
            <option value="all">All themes</option>
            {themes.map((t) => (
              <option key={t} value={t}>
                {t === "default" ? "Default" : t === "dark" ? "Dark" : "Light"}
              </option>
            ))}
          </select>
        ) : null}
        <button className="btn btn--sm" onClick={undoLast} disabled={!undo.length} title={undo[0] ? `Undo ${undo[0].label}` : "Nothing to undo"}>
          <Undo2 size={14} aria-hidden="true" /> Undo
        </button>
        <button className="btn btn--sm" onClick={reload} disabled={loading} aria-label="Re-scan stylesheets">
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>
      {msg ? (
        <p className={`notice${msg.ok ? " notice--ok" : " notice--bad"}`} role={msg.ok ? "status" : "alert"} style={{ margin: "0 0 12px" }}>
          {msg.text}
        </p>
      ) : null}
      {GROUPS.map((g) => {
        const list = shown.filter((t) => t.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} className="styles-group" aria-labelledby={`sg-${g.id}`}>
            <h3 id={`sg-${g.id}`} className="styles-group__title">
              {g.label} <span className="muted">{list.length}</span>
            </h3>
            {g.id === "color" ? (
              <ColorFamilies list={list} lookup={lookup} open={!!q.trim()} render={(t) => <TokenRow key={keyOf(t) + t.value} t={t} lookup={lookup} busy={saving === keyOf(t)} onSave={(v) => void save(t, v)} />} />
            ) : (
              <div className="styles-list">
                {list.map((t) => (
                  <TokenRow key={keyOf(t) + t.value} t={t} lookup={lookup} busy={saving === keyOf(t)} onSave={(v) => void save(t, v)} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Hue families, in colour-wheel order; low-saturation colours go to Neutrals. */
const FAMILIES: Array<{ id: string; label: string; from: number; to: number }> = [
  { id: "red", label: "Reds", from: 345, to: 15 },
  { id: "orange", label: "Oranges & browns", from: 15, to: 45 },
  { id: "yellow", label: "Yellows", from: 45, to: 70 },
  { id: "green", label: "Greens", from: 70, to: 165 },
  { id: "teal", label: "Teals & cyans", from: 165, to: 200 },
  { id: "blue", label: "Blues", from: 200, to: 255 },
  { id: "purple", label: "Purples", from: 255, to: 290 },
  { id: "pink", label: "Pinks", from: 290, to: 345 },
  { id: "neutral", label: "Neutrals", from: 0, to: 0 },
];

let probe: { el: HTMLSpanElement; ctx: CanvasRenderingContext2D | null } | undefined;
/** A CSS colour (hex, var() already resolved, color-mix, oklab…) as sRGB, measured the way the browser draws it. */
function rgbOf(css: string): [number, number, number] | undefined {
  if (typeof document === "undefined" || !css) return undefined;
  if (!probe) {
    const el = document.createElement("span");
    el.style.display = "none";
    document.body.appendChild(el);
    probe = { el, ctx: document.createElement("canvas").getContext("2d", { willReadFrequently: true }) };
  }
  probe.el.style.color = "";
  probe.el.style.color = css;
  if (!probe.el.style.color || !probe.ctx) return undefined;
  const computed = getComputedStyle(probe.el).color;
  probe.ctx.clearRect(0, 0, 1, 1);
  probe.ctx.fillStyle = "#000";
  probe.ctx.fillStyle = computed;
  probe.ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.ctx.getImageData(0, 0, 1, 1).data;
  return a === 0 ? undefined : [r!, g!, b!];
}

function familyOf([r, g, b]: [number, number, number]): string {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  // Greys, near-blacks and near-whites with a faint tint read as neutral, not as a hue.
  if (s < 0.14 || d < 0.08 || l < 0.07 || l > 0.96) return "neutral";
  const rn = r / 255, gn = g / 255, bn = b / 255;
  let h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h = (h * 60 + 360) % 360;
  return FAMILIES.find((f) => (f.from > f.to ? h >= f.from || h < f.to : h >= f.from && h < f.to))?.id ?? "neutral";
}

/**
 * Colours grouped by hue family in cards that open and close, three tokens a row. Colours that look the same (within a
 * few steps of each other in every channel, same theme) are shown once; the rest stay a click away, since each is
 * still a token the app uses.
 */
function ColorFamilies({ list, lookup, open, render }: { list: Token[]; lookup: Map<string, string>; open: boolean; render: (t: Token) => ReactNode }) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [showSame, setShowSame] = useState<Record<string, boolean>>({});
  const families = useMemo(() => {
    const by = new Map<string, Array<{ t: Token; rgb?: [number, number, number]; same?: string }>>();
    for (const t of list) {
      const rgb = rgbOf(resolveVars(t.resolved ?? t.value, lookup));
      const id = rgb ? familyOf(rgb) : "neutral";
      by.set(id, [...(by.get(id) ?? []), { t, rgb }]);
    }
    for (const items of by.values()) {
      items.sort((a, b) => (a.rgb ? a.rgb[0] * 0.3 + a.rgb[1] * 0.59 + a.rgb[2] * 0.11 : 0) - (b.rgb ? b.rgb[0] * 0.3 + b.rgb[1] * 0.59 + b.rgb[2] * 0.11 : 0));
      const kept: typeof items = [];
      for (const it of items) {
        const twin = it.rgb && kept.find((k) => k.rgb && k.t.theme === it.t.theme && Math.hypot(k.rgb[0] - it.rgb![0], k.rgb[1] - it.rgb![1], k.rgb[2] - it.rgb![2]) < 8);
        if (twin) it.same = twin.t.name;
        else kept.push(it);
      }
    }
    return FAMILIES.map((f) => ({ ...f, items: by.get(f.id) ?? [] })).filter((f) => f.items.length);
  }, [list, lookup]);
  return (
    <div className="color-families">
      {families.map((f) => {
        const isOpen = open || !!opened[f.id];
        const same = f.items.filter((i) => i.same);
        const shown = f.items.filter((i) => !i.same || showSame[f.id]);
        return (
          <div key={f.id} className={`color-family${isOpen ? " is-open" : ""}`}>
            <button type="button" className="color-family__head" aria-expanded={isOpen} aria-controls={`cf-${f.id}`} onClick={() => setOpened((o) => ({ ...o, [f.id]: !isOpen }))}>
              <span className="color-family__name">{f.label}</span>
              <span className="muted color-family__count">
                {f.items.length - same.length}
                {same.length ? ` · ${same.length} look the same` : ""}
              </span>
              <span className="color-family__strip" aria-hidden="true">
                {f.items
                  .filter((i) => !i.same)
                  .slice(0, 16)
                  .map((i) => (
                    <span key={keyOf(i.t)} style={{ background: i.rgb ? `rgb(${i.rgb.join(" ")})` : "transparent" }} />
                  ))}
              </span>
              <span className="color-family__chevron" aria-hidden="true" />
            </button>
            {isOpen ? (
              <div id={`cf-${f.id}`} className="color-family__body">
                <div className="styles-list">{shown.map((i) => render(i.t))}</div>
                {same.length ? (
                  <button type="button" className="btn btn--sm btn--ghost color-family__same" aria-pressed={!!showSame[f.id]} onClick={() => setShowSame((s) => ({ ...s, [f.id]: !s[f.id] }))}>
                    {showSame[f.id] ? `Hide ${same.length} that look the same` : `Show ${same.length} that look the same (${same.slice(0, 3).map((i) => i.t.name).join(", ")}${same.length > 3 ? "…" : ""})`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Swatches that would blend into the page get an outline: very light colors on the light theme, very dark ones on the
 * dark theme (the CSS applies each class only in its theme).
 */
function edgeClass(v: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return "";
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  return l > 0.8 ? " is-near-light" : l < 0.02 ? " is-near-dark" : "";
}

/** The app's token values by name; the default theme wins over theme overrides. */
function tokenLookup(tokens: Token[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of tokens) if (t.theme === "default" || !m.has(t.name)) m.set(t.name, t.value);
  return m;
}

/** Replaces var(--x) (and var(--x, fallback)) with the app's own values, so previews show what the app shows. */
function resolveVars(v: string, lookup?: Map<string, string>, depth = 0): string {
  if (!lookup || depth > 6 || !v.includes("var(")) return v;
  const out = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_m, name: string, fallback?: string) => lookup.get(name) ?? fallback?.trim() ?? _m);
  return out === v ? v : resolveVars(out, lookup, depth + 1);
}

function preview(t: Token, lookup?: Map<string, string>) {
  const v = resolveVars(t.resolved ?? t.value, lookup);
  switch (t.group) {
    case "color":
      return <span className={`styles-swatch${edgeClass(v)}`} style={{ background: v }} aria-hidden="true" />;

    case "radius":
      return <span className="styles-box" style={{ borderRadius: v }} aria-hidden="true" />;
    case "shadow":
      return (
        <span className="styles-shadow-stage" aria-hidden="true">
          <span className="styles-shadow-card" style={{ boxShadow: v }} />
        </span>
      );
    case "motion":
      return <MotionPreview t={t} lookup={lookup} />;
    case "spacing": {
      const px = /^(-?\d*\.?\d+)(px|rem)$/.exec(v);
      const w = px ? Math.min(160, Math.max(2, Number(px[1]) * (px[2] === "rem" ? 16 : 1))) : 0;
      return <span className="styles-bar" style={{ width: w || 2 }} aria-hidden="true" />;
    }
    case "typography": {
      const n = t.name.toLowerCase();
      const style = /family|font-(body|sans|serif|mono|heading|display|ui)$|^--font$/.test(n) ? { fontFamily: v } : /size|fs-|text-(xs|sm|md|lg|xl)/.test(n) ? { fontSize: v } : /weight/.test(n) ? { fontWeight: v } : /line|leading|lh/.test(n) ? { lineHeight: v } : /letter|tracking/.test(n) ? { letterSpacing: v } : {};
      return (
        <span className="styles-type" style={style} aria-hidden="true">
          Aa
        </span>
      );
    }
    default: {
      const n = t.name.toLowerCase();
      const num = Number.parseFloat(v);
      const style: CSSProperties = /opacity|alpha/.test(n) && Number.isFinite(num)
        ? { opacity: num }
        : /scale/.test(n) && Number.isFinite(num)
          ? { transform: `scale(${num})` }
          : /lift|translate|offset/.test(n)
            ? { transform: `translateY(${v})`, boxShadow: "0 3px 6px -3px rgba(0,0,0,0.35)" }
            : /ring|outline|focus/.test(n)
              ? { boxShadow: v }
              : {};
      return <span className="styles-box styles-box--effect" style={style} aria-hidden="true" />;
    }
  }
}

/** Named choices for values that are hard to type: shadows and easing curves. */
const ink = (n: number) => `color-mix(in srgb, var(--color-text) ${n}%, transparent)`;
const PRESETS: Record<string, Array<{ label: string; value: string }> | undefined> = {
  shadow: [
    { label: "None", value: "none" },
    { label: "Hairline", value: `0 0 0 1px ${ink(10)}` },
    { label: "Subtle", value: `0 1px 2px ${ink(12)}` },
    { label: "Soft", value: `0 4px 12px -2px ${ink(14)}` },
    { label: "Raised", value: `0 8px 24px -8px ${ink(28)}` },
    { label: "Floating", value: `0 18px 40px -12px ${ink(35)}` },
  ],
  easing: [
    { label: "Standard", value: "cubic-bezier(0.2, 0, 0, 1)" },
    { label: "Ease out", value: "cubic-bezier(0.16, 1, 0.3, 1)" },
    { label: "Ease in-out", value: "cubic-bezier(0.65, 0, 0.35, 1)" },
    { label: "Spring", value: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    { label: "Linear", value: "linear" },
  ],
};
const presetKind = (t: Token) => (t.group === "shadow" ? "shadow" : t.group === "motion" && /eas|curve|bezier/i.test(t.name) ? "easing" : "");

/** Plays a token's motion: a dot crosses the track with that duration (or easing), so it can be judged by eye. */
function MotionPreview({ t, lookup }: { t: Token; lookup?: Map<string, string> }) {
  const [on, setOn] = useState(false);
  const v = resolveVars(t.value, lookup);
  const easing = presetKind(t) === "easing" ? v : resolveVars(lookup?.get("--easing") ?? "cubic-bezier(0.2, 0, 0, 1)", lookup);
  const duration = /^\d/.test(v) && /m?s$/.test(v) ? v : "600ms";
  return (
    <button type="button" className="styles-motion" onClick={() => setOn((x) => !x)} title={`Play ${t.name}`} aria-label={`Play ${t.name}`}>
      <span className="styles-motion__dot" style={{ transform: on ? "translateX(26px)" : "translateX(0)", transition: `transform ${duration} ${easing}` }} />
    </button>
  );
}

const trimNum = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * A slider for tokens that hold one number: sizes in px, rem or em (spacing, radius, font sizes), font weights and
 * line heights. Values that can't map to a slider (var(), calc(), clamp(), lists) keep the text box. The range
 * always reaches past the current value, so a large token isn't clipped.
 */
function sliderRange(t: Token): { min: number; max: number; step: number; unit: string } | undefined {
  if (t.group === "color" || t.group === "shadow") return undefined;
  const m = /^\s*(-?\d*\.?\d+)(px|rem|em|%|ms)?\s*$/.exec(t.value);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2] ?? "";
  const name = t.name.toLowerCase();
  const fit = (min: number, max: number, step: number) => ({ min: Math.min(min, n), max: Math.max(max, Math.ceil(n * 2 / step) * step), step, unit });
  if (!unit) {
    if (/weight/.test(name)) return { min: 100, max: 900, step: 100, unit };
    if (/line|leading|lh/.test(name)) return fit(0.8, 2.5, 0.05);
    if (/opacity|alpha/.test(name)) return { min: 0, max: 1, step: 0.05, unit };
    if (/scale/.test(name)) return { min: Math.min(0.5, n), max: Math.max(1.5, n), step: 0.01, unit };
    if (/z-?index|^--z\b|^--z-/.test(name)) return undefined;
    return fit(0, 10, 0.1);
  }
  if (unit === "ms") return fit(0, /stagger/.test(name) ? 200 : 1000, 10);
  if (unit === "px") return fit(0, /radius|round/.test(name) ? 48 : 96, 1);
  if (unit === "%") return fit(0, 100, 1);
  if (/letter|tracking/.test(name)) return fit(-0.1, 0.3, 0.005);
  return fit(0, /radius|round/.test(name) ? 3 : 6, 0.125);
}

function TokenRow({ t, lookup, busy, onSave }: { t: Token; lookup?: Map<string, string>; busy: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(t.value);
  const id = `tok-${t.name}-${t.theme}-${t.line}`.replace(/[^\w-]/g, "");
  const commit = () => draft.trim() !== t.value && onSave(draft);
  const range = sliderRange(t);
  const sliderValue = range ? Number(/^-?\d*\.?\d+/.exec(draft)?.[0] ?? range.min) : 0;
  return (
    <div className={`styles-token styles-token--${t.group}${busy ? " is-busy" : ""}`}>
      {t.group === "color" && HEX.test(t.value) ? (
        <label className={`styles-swatch styles-swatch--pick${edgeClass(draft.match(HEX) ? draft : t.value)}`} style={{ background: draft.match(HEX) ? draft : t.value }} title="Pick a color">
          <input type="color" aria-label={`${t.name} color picker`} value={draft.match(HEX) ? draft : t.value} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
        </label>
      ) : (
        preview(t, lookup)
      )}
      <div className="styles-token__main">
        <label htmlFor={id} className="styles-token__name mono">
          {t.name}
          {t.theme !== "default" ? <span className="chip">{t.theme}</span> : null}
        </label>
        <div className="styles-token__edit">
          {PRESETS[presetKind(t)] ? (
            <span className="styles-presets">
              <select
                className="select"
                aria-label={`${t.name} preset`}
                value={PRESETS[presetKind(t)]!.find((p) => p.value === draft)?.value ?? "custom"}
                onChange={(e) => {
                  if (e.target.value === "custom") return;
                  setDraft(e.target.value);
                  onSave(e.target.value);
                }}
              >
                {PRESETS[presetKind(t)]!.map((p) => (
                  <option key={p.label} value={p.value}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              <input
                id={id}
                className="input mono"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                  if (e.key === "Escape") setDraft(t.value);
                }}
              />
            </span>
          ) : range ? (
            <span className="styles-slider">
              <input
                id={id}
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={sliderValue}
                aria-valuetext={draft}
                onChange={(e) => setDraft(`${trimNum(Number(e.target.value))}${range.unit}`)}
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
              />
              <output htmlFor={id} className="styles-slider__value mono">
                {draft}
              </output>
            </span>
          ) : (
            <input
              id={id}
              className="input mono"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                if (e.key === "Escape") setDraft(t.value);
              }}
            />
          )}
        </div>
        <span className="styles-token__meta muted">
          {t.resolved ? `→ ${t.resolved} · ` : ""}
          {t.uses} use{t.uses === 1 ? "" : "s"} ·{" "}
          <button className="link-btn" onClick={() => window.dispatchEvent(new CustomEvent("fc:open-file", { detail: t.file }))}>
            {t.file}:{t.line}
          </button>
        </span>
      </div>
    </div>
  );
}
