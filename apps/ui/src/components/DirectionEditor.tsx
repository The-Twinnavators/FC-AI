/**
 * The project's look, edited in one place wherever it is shown: the plan card (before the app exists), the design
 * review (the build waiting for "Approve the prototype plan and the design") and the Design tab. Edits are a draft,
 * saved as you go and kept when this closes; nothing is written to the app until "Apply changes" (or, before the
 * app exists, until the build applies the selected direction). Same record and tokens as the daemon
 * (workspace/designState.ts, contracts appearance.ts).
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { APPEARANCE_THEMES, BASE_APPEARANCE, GRADIENT_ENDS, GRADIENT_USES, GRADIENT_USE_LABEL, MOTION_LABEL, MOTION_LEVELS, STYLE_VIBES, TYPE_PAIRS, appearanceChecks, appearanceFromTheme, appearanceTokens, gradientOf, gradientStops, type Appearance, type AppearanceCheck, type GradientEnd, type GradientSetting } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { navigate } from "../router";
import { ColorPicker } from "./ColorPicker";
import { DesignComponentsBar } from "./DesignStudio";

type Sources = Partial<Record<keyof Appearance, string>>;
interface DesignStateView {
  base: { source: string; detail: string };
  draft?: { appearance: Appearance; sources: Sources; updatedAt: string };
  selected?: { appearance: Appearance; sources: Sources; version: number; selectedAt: string };
  applied?: { appearance: Appearance; version: number; appliedAt: string; verification?: Verification };
  lastFailure?: { version: number; at: string; reason: string };
  surfaceExceptions: string[];
  hasApp: boolean;
  /** False for an app without FlowCode's motion foundation (an Angular app): the level is kept but not applied. */
  motionSupported?: boolean;
  differs: string[];
  label: string;
  prd?: { colors: Array<{ hex: string; name: string; use?: string }> };
}

type VerifyStatus = "passed" | "failed" | "not_run";
interface Verification {
  version: number;
  at: string;
  file: "applied";
  technical: { status: VerifyStatus; checks: Array<{ kind: string; status: string; summary: string }>; note?: string };
  browser: { status: VerifyStatus; checks: Array<{ kind: string; status: string; summary: string }>; note?: string };
  human: "pending";
}
const STATUS_WORD: Record<VerifyStatus, string> = { passed: "Passed", failed: "Failed", not_run: "Not run" };
const CHECK_LABEL: Record<string, string> = { typecheck: "Typecheck", build: "Build", preview_health: "Preview", screenshots: "Screenshots", functional_journey: "Journey through the app", look_reached: "Rendered page uses it" };

/** After an apply: the four things kept apart. Only the first is what "applied" means; not run is never shown as passed. */
function ApplyResult({ v }: { v: Verification }) {
  const row = (label: string, status: VerifyStatus, checks: Verification["technical"]["checks"], note?: string) => (
    <li className={`ds-verify__row is-${status}`}>
      <span className="ds-verify__k">{label}</span>
      <span className="ds-verify__v">
        <span aria-hidden="true">{status === "passed" ? "✓" : status === "failed" ? "✕" : "–"}</span> {STATUS_WORD[status]}
        {checks.length ? <span className="dim"> · {checks.map((c) => `${CHECK_LABEL[c.kind] ?? c.kind} ${c.status === "not_run" ? "not run" : c.status}`).join(", ")}</span> : null}
        {note ? <span className="dim"> · {note}</span> : null}
        {checks.filter((c) => c.status !== "passed").map((c) => <span key={c.kind} className="ds-verify__why">{CHECK_LABEL[c.kind] ?? c.kind}: {c.summary}</span>)}
      </span>
    </li>
  );
  return (
    <div className="ds-verify" aria-label={`After applying version ${v.version}`}>
      <ul>
        <li className="ds-verify__row is-passed">
          <span className="ds-verify__k">File update</span>
          <span className="ds-verify__v"><span aria-hidden="true">✓</span> Applied</span>
        </li>
        {row("Technical verification", v.technical.status, v.technical.checks, v.technical.note)}
        {row("Browser and functional verification", v.browser.status, v.browser.checks, v.browser.note)}
        <li className="ds-verify__row is-not_run">
          <span className="ds-verify__k">Your visual approval</span>
          <span className="ds-verify__v"><span aria-hidden="true">–</span> Pending: look at the app and decide</span>
        </li>
      </ul>
      {v.technical.status === "failed" || v.browser.status === "failed" ? <p className="ds__warn">A failed check doesn't undo the change. To go back to the previous look, undo this apply in Changes.</p> : null}
    </div>
  );
}

const NEUTRALS: Array<{ id: Appearance["neutral"]; label: string }> = [
  { id: "brand", label: "Brand-tinted" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "pure", label: "Pure gray" },
];
const SOURCE_LABEL = (s?: string) => (!s ? "" : s === "you" ? "you" : s === "prd" ? "your PRD" : s.startsWith("theme:") ? `the ${APPEARANCE_THEMES.find((t) => `theme:${t.id}` === s)?.name ?? "theme"} theme` : s === "suggested" ? "FlowCode's suggestion" : s);

/** A small sample of the look: heading, text, a card, the primary action and the status colours (with their words). */
export function StyleSample({ appearance, label }: { appearance: Appearance; label: string }) {
  const vars = useMemo(() => Object.fromEntries(Object.entries(appearanceTokens(appearance)).filter(([k]) => k.startsWith("--"))), [appearance]);
  const uses = gradientOf(appearance)?.uses ?? [];
  return (
    <figure className="ds-sample" style={vars as React.CSSProperties} aria-label={label}>
      <figcaption className="ds-sample__label">{label}</figcaption>
      <div className="ds-sample__page">
        <p className={uses.includes("headline") ? "ds-sample__h is-gradient" : "ds-sample__h"}>Find it near you</p>
        {uses.includes("panels") ? <p className="ds-sample__panel">New this week: oat and soy, two for one</p> : null}
        <p className="ds-sample__p">Search products, save the ones you like and see which stores carry them.</p>
        <div className="ds-sample__card">
          <p className="ds-sample__card-title">Oat Milk Original</p>
          <p className="ds-sample__muted">Willow Farms · 4.8 rating</p>
          <span className="ds-sample__btn">Save product</span>
        </div>
        <ul className="ds-sample__status">
          <li data-k="success"><span aria-hidden="true">✓</span> Saved</li>
          <li data-k="warning"><span aria-hidden="true">!</span> Low stock</li>
          <li data-k="error"><span aria-hidden="true">✕</span> Couldn't save</li>
        </ul>
      </div>
    </figure>
  );
}

/** The contrast checks, folded to one line while they all pass; open when a pair falls short. */
function Checks({ checks }: { checks: AppearanceCheck[] }) {
  const failing = checks.filter((c) => !c.ok).length;
  return (
    <details className={`ds-checks${failing ? " is-bad" : ""}`} open={failing > 0}>
      <summary className="ds-checks__sum" role="status">
        <span aria-hidden="true">{failing ? "✕" : "✓"}</span> {failing ? `${failing} of ${checks.length} colour pairs are below their contrast target` : `All ${checks.length} colour pairs meet their contrast target`}
      </summary>
      <ul>
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? "is-ok" : "is-bad"}>
            <span aria-hidden="true">{c.ok ? "✓" : "✕"}</span> {c.label}: {c.ratio}:1 <span className="dim">(needs {c.min}:1)</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** One section of the editor: a title, what it decides, then its controls. */
function Section({ title, hint, wide, children }: { title: string; hint: string; wide?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <section className={wide ? "ds-sec ds-sec--wide" : "ds-sec"} aria-labelledby={id}>
      <header className="ds-sec__head">
        <h3 id={id} className="ds-sec__title">{title}</h3>
        <p className="ds-sec__hint">{hint}</p>
      </header>
      {children}
    </section>
  );
}

const END_LABEL: Record<GradientEnd, string> = { secondary: "To the secondary", tertiary: "To the tertiary", lighter: "To a lighter primary" };
const ANGLES = [90, 135, 180, 225];

/** The Look's gradient: on or off, what it runs to, its angle, and where the app uses it. */
function GradientEditor({ appearance, group, onChange }: { appearance: Appearance; group: string; onChange: (g: GradientSetting | undefined) => void }) {
  const g = gradientOf(appearance);
  const accent = appearanceTokens(appearance)["--color-accent"] ?? appearance.primary;
  const css = (s: GradientSetting) => {
    const [from, to] = gradientStops({ ...appearance, gradient: s }, accent);
    return `linear-gradient(${s.angle}deg, ${from}, ${to})`;
  };
  const turnOn = () => onChange({ to: appearance.secondary ? "secondary" : "lighter", angle: 135, uses: ["buttons"] });
  if (!g)
    return (
      <div className="ds-grad ds-grad--off">
        <span className="ds-grad__bar" aria-hidden="true" style={{ background: css({ to: appearance.secondary ? "secondary" : "lighter", angle: 135, uses: [] }) }} />
        <button type="button" className="btn btn--sm" onClick={turnOn}>Use a gradient</button>
      </div>
    );
  const set = (patch: Partial<GradientSetting>) => onChange({ ...g, ...patch });
  return (
    <div className="ds-grad">
      <span className="ds-grad__bar" aria-hidden="true" style={{ background: css(g) }} />
      <fieldset className="ds-field ds-tiles ds-tiles--ends">
        <legend>Runs from the primary</legend>
        {GRADIENT_ENDS.map((to) => {
          const missing = (to === "secondary" && !appearance.secondary) || (to === "tertiary" && !appearance.tertiary);
          return (
            <label key={to} className={`ds-tile ds-end${g.to === to ? " is-on" : ""}`}>
              <input type="radio" name={`ds-end-${group}`} checked={g.to === to} onChange={() => set({ to })} />
              <span className="ds-end__strip" aria-hidden="true" style={{ background: css({ ...g, to, angle: 90 }) }} />
              <span className="ds-tile__name">{END_LABEL[to]}</span>
              {missing ? <span className="ds-tile__sub">Add one above; a lighter primary until then</span> : null}
            </label>
          );
        })}
      </fieldset>
      <fieldset className="ds-field ds-angles">
        <legend>Angle</legend>
        {ANGLES.map((angle) => (
          <label key={angle} className={`ds-angle${g.angle === angle ? " is-on" : ""}`} title={`${angle}°`}>
            <input type="radio" name={`ds-angle-${group}`} checked={g.angle === angle} onChange={() => set({ angle })} />
            <span className="ds-angle__arrow" aria-hidden="true" style={{ transform: `rotate(${angle - 90}deg)` }}>→</span>
            <span className="sr-only">{angle} degrees</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="ds-field ds-tiles ds-tiles--uses">
        <legend>Use it for</legend>
        {GRADIENT_USES.map((u) => {
          const on = g.uses.includes(u);
          return (
            <label key={u} className={`ds-tile ds-use${on ? " is-on" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => set({ uses: on ? g.uses.filter((x) => x !== u) : GRADIENT_USES.filter((x) => x === u || g.uses.includes(x)) })} />
              <span className={`ds-use__art ds-use__art--${u}`} aria-hidden="true" style={{ "--g": css(g) } as React.CSSProperties}><span /></span>
              <span className="ds-tile__name">{GRADIENT_USE_LABEL[u].name}</span>
              <span className="ds-tile__sub">{GRADIENT_USE_LABEL[u].detail}</span>
            </label>
          );
        })}
      </fieldset>
      <button type="button" className="link-btn ds-grad__off" onClick={() => onChange(undefined)}>Don't use a gradient</button>
    </div>
  );
}

/** A theme's own colours for its tile: page, card, text and primary. */
const THEME_COLOURS = APPEARANCE_THEMES.map((t) => {
  const look = appearanceFromTheme(t.id);
  const tk = look ? appearanceTokens(look) : {};
  return { ...t, bg: tk["--color-bg"], surface: tk["--color-surface"], text: tk["--color-text"], accent: tk["--color-accent"], border: tk["--color-border"] };
});
const noShown = () => undefined;

/**
 * `where`: "plan" (no app yet: confirm only), "review" or "tab" (the app exists: confirm and apply).
 * `onAppearance`: the look being shown (draft, else selected), for previews beside the editor (the plan's concepts).
 */
export function DirectionEditor({ projectId, where, onAppearance }: { projectId: string; where: "plan" | "review" | "tab"; onAppearance?: (a: Appearance | undefined) => void }) {
  const res = useResource<DesignStateView>(`/projects/${projectId}/design/state`, [projectId]);
  const s = res.data;
  const [a, setA] = useState<Appearance>();
  const [sources, setSources] = useState<Sources>({});
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The card can be on screen twice (the pop-up and the run panel): each copy needs its own radio group.
  const group = useId();

  // What the editor shows with no draft: the selected direction, else the PRD's primary, else FlowCode's neutral base.
  const settled = (st: DesignStateView): { a?: Appearance; sources: Sources } => {
    const prdPrimary = st.prd?.colors[0]?.hex;
    return st.selected ? { a: st.selected.appearance, sources: st.selected.sources } : prdPrimary ? { a: { ...BASE_APPEARANCE, primary: prdPrimary }, sources: { primary: "prd" } } : { a: undefined, sources: {} };
  };
  // Start from the draft, else the settled look. Once: later reloads never overwrite what is on screen.
  const inited = useRef(false);
  useEffect(() => {
    if (!s || inited.current) return;
    inited.current = true;
    const start = s.draft ? { a: s.draft.appearance, sources: s.draft.sources } : settled(s);
    setA(start.a);
    setSources(start.sources);
  }, [s]);
  useEffect(() => onAppearance?.(s?.draft || s?.selected || a ? a : undefined), [a, s, onAppearance]);

  const edit = (patch: Partial<Appearance>, source: string) => {
    const next = { ...(a ?? BASE_APPEARANCE), ...patch };
    const nextSources = { ...sources, ...Object.fromEntries(Object.keys(patch).map((k) => [k, source])) };
    setA(next);
    setSources(nextSources);
    setMsg(undefined);
    setError(undefined);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Saved as you go: closing and coming back keeps it.
    saveTimer.current = setTimeout(() => {
      post(`/projects/${projectId}/design/draft`, { appearance: next, sources: nextSources })
        .then(() => (setMsg("Draft saved"), res.reload()))
        .catch((e: Error) => setError(e.message));
    }, 400);
  };

  const confirm = async (apply: boolean) => {
    setBusy(true);
    setError(undefined);
    setMsg(undefined);
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        await post(`/projects/${projectId}/design/draft`, { appearance: a, sources });
      }
      if (s?.draft || saveTimer.current) await post(`/projects/${projectId}/design/select`, {});
      if (apply) {
        setMsg("Applying, then rerunning the latest build's checks…");
        const r = await post<{ ok: boolean; reason?: string }>(`/projects/${projectId}/design/apply`, {});
        setMsg(r.ok ? "Files updated. What the checks showed is listed above." : `Not applied: ${r.reason}. Your draft and the previous look are kept.`);
      } else setMsg(where === "plan" ? "Selected. Approving the plan uses this direction." : "Selected. Apply it to change the app.");
      saveTimer.current = undefined;
      res.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    setBusy(true);
    try {
      await post(`/projects/${projectId}/design/draft/discard`, {});
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      const back = s ? settled(s) : { a: undefined, sources: {} };
      setA(back.a);
      setSources(back.sources);
      setMsg("Draft discarded. The selected and applied look are unchanged.");
      res.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!s) return <p className="dim">Loading the look…</p>;
  const cur = a ?? BASE_APPEARANCE;
  const surfaces = STYLE_VIBES.filter((v) => v.id === "flat" || v.id === "skeuomorphism" || s.surfaceExceptions.includes(v.id));
  const prdPrimary = s.prd?.colors[0];
  const hasDraft = !!s.draft || !!saveTimer.current;
  const appExists = where !== "plan" && s.hasApp;
  return (
    <section className="ds" aria-label="Look">
      <header className="ds__head">
        <p className="ds__state" role="status">
          <strong>{s.label}</strong>
          {s.selected ? <span className="dim"> · selected version {s.selected.version}</span> : null}
          {s.applied ? <span className="dim"> · applied version {s.applied.version}</span> : null}
          <button type="button" className="link-btn ds__open" onClick={() => navigate(`/projects/${projectId}/design`)}>Open the full design direction, with a live preview</button>
        </p>
        {s.differs.length ? <p className="ds__warn">These tokens no longer match the applied direction: {s.differs.join(", ")}</p> : null}
        {s.lastFailure ? <p className="ds__warn">The last update (version {s.lastFailure.version}) failed: {s.lastFailure.reason}</p> : null}
        {where !== "plan" && s.applied?.verification ? <ApplyResult v={s.applied.verification} /> : null}
      </header>
      <div className="ds__body">
        <div className="ds__controls">
          <Section wide title="Starting point" hint="A theme sets colours and fonts together. Everything below can still be changed.">
            <fieldset className="ds-tiles ds-tiles--theme">
              <legend className="sr-only">Theme</legend>
              <label className={`ds-tile ds-theme${!cur.theme ? " is-on" : ""}`}>
                <input type="radio" name={`ds-theme-${group}`} checked={!cur.theme} onChange={() => edit({ theme: undefined }, "you")} />
                <span className="ds-theme__swatch ds-theme__swatch--own" aria-hidden="true" style={{ "--t-accent": cur.primary } as React.CSSProperties}>
                  <span className="ds-theme__dot" />
                </span>
                <span className="ds-tile__name">Your colours</span>
              </label>
              {THEME_COLOURS.map((t) => (
                <label key={t.id} className={`ds-tile ds-theme${cur.theme === t.id ? " is-on" : ""}`}>
                  <input type="radio" name={`ds-theme-${group}`} checked={cur.theme === t.id} onChange={() => {
                    const look = appearanceFromTheme(t.id, cur.surface);
                    if (look) edit(look, `theme:${look.theme}`);
                  }} />
                  <span className="ds-theme__swatch" aria-hidden="true" style={{ "--t-bg": t.bg, "--t-surface": t.surface, "--t-text": t.text, "--t-accent": t.accent, "--t-border": t.border } as React.CSSProperties}>
                    <span className="ds-theme__aa">Aa</span>
                    <span className="ds-theme__dot" />
                    {t.dark ? <span className="ds-theme__tag">Dark</span> : null}
                  </span>
                  <span className="ds-tile__name">{t.name}</span>
                </label>
              ))}
            </fieldset>
          </Section>

          <Section title="Colour" hint="The primary colour marks the main action, links and focus. The neutral family tints pages, cards and borders.">
            <div className="ds-field">
              <span>Primary colour{sources.primary ? <span className="ds-src"> · from {SOURCE_LABEL(sources.primary)}</span> : null}</span>
              <ColorPicker label="Primary colour" value={cur.primary} onChange={(hex) => edit({ primary: hex }, "you")} swatches={prdPrimary ? [{ label: `PRD: ${prdPrimary.name}`, hex: prdPrimary.hex }] : []} />
              {prdPrimary && prdPrimary.hex.toLowerCase() !== cur.primary.toLowerCase() ? (
                <p className="ds-note">
                  Your PRD names {prdPrimary.name} ({prdPrimary.hex}){prdPrimary.use ? ` for ${prdPrimary.use}` : ""}.{" "}
                  <button type="button" className="link-btn" onClick={() => edit({ primary: prdPrimary.hex }, "prd")}>Use the PRD's colour</button>
                </p>
              ) : null}
            </div>
            <fieldset className="ds-field ds-tiles ds-tiles--neutral">
              <legend>Neutral family</legend>
              {NEUTRALS.map((n) => {
                const tk = appearanceTokens({ ...cur, neutral: n.id });
                return (
                  <label key={n.id} className={`ds-tile ds-neutral${cur.neutral === n.id ? " is-on" : ""}`}>
                    <input type="radio" name={`ds-neutral-${group}`} checked={cur.neutral === n.id} onChange={() => edit({ neutral: n.id }, "you")} />
                    <span className="ds-neutral__ramp" aria-hidden="true">
                      {["--color-bg", "--color-surface-sunken", "--color-border", "--color-text-muted", "--color-text"].map((k) => <span key={k} style={{ background: tk[k] }} />)}
                    </span>
                    <span className="ds-tile__name">{n.label}</span>
                  </label>
                );
              })}
            </fieldset>
            <div className="ds-pair">
              <div className="ds-field">
                <span>Secondary colour <span className="ds-src">optional</span></span>
                {cur.secondary ? (
                  <span className="ds-row">
                    <ColorPicker label="Secondary colour" value={cur.secondary} onChange={(hex) => edit({ secondary: hex }, "you")} />
                    <button type="button" className="link-btn" onClick={() => edit({ secondary: undefined }, "you")}>Remove</button>
                  </span>
                ) : (
                  <button type="button" className="btn btn--sm ds-add" onClick={() => edit({ secondary: "#be6a2a" }, "you")}>Add a secondary colour</button>
                )}
              </div>
              <div className="ds-field">
                <span>Tertiary colour <span className="ds-src">optional</span></span>
                {cur.tertiary ? (
                  <span className="ds-row">
                    <ColorPicker label="Tertiary colour" value={cur.tertiary} onChange={(hex) => edit({ tertiary: hex }, "you")} />
                    <button type="button" className="link-btn" onClick={() => edit({ tertiary: undefined }, "you")}>Remove</button>
                  </span>
                ) : (
                  <button type="button" className="btn btn--sm ds-add" onClick={() => edit({ tertiary: "#3f7d6a" }, "you")}>Add a tertiary colour</button>
                )}
              </div>
            </div>
            <div className="ds-field">
              <span>Status colours <span className="ds-src">suggested from your palette; change any</span></span>
              <div className="ds-status">
                {(["success", "warning", "error", "info"] as const).map((k) => (
                  <span key={k} className="ds-row">
                    <ColorPicker label={`${k} colour`} value={cur.status?.[k] ?? appearanceTokens(cur)[k === "error" ? "--color-danger" : k === "info" ? "--color-accent" : `--color-${k}`] ?? "#666666"} onChange={(hex) => edit({ status: { ...cur.status, [k]: hex } }, "you")} />
                    <span>{k[0]!.toUpperCase() + k.slice(1)}</span>
                    {cur.status?.[k] ? <button type="button" className="link-btn" onClick={() => { const { [k]: _drop, ...rest } = cur.status ?? {}; edit({ status: Object.keys(rest).length ? rest : undefined }, "you"); }}>Restore</button> : null}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Gradient" hint="One gradient from your primary colour, used wherever you turn it on.">
            <GradientEditor appearance={cur} group={group} onChange={(gradient) => edit({ gradient }, "you")} />
          </Section>

          <Section wide title="Type" hint="Headings use the first face, text the second.">
            <fieldset className="ds-tiles ds-tiles--type">
              <legend className="sr-only">Typography</legend>
              {TYPE_PAIRS.find((p) => p.display === cur.fonts.display && p.body === cur.fonts.body) ? null : (
                <label className="ds-tile ds-type is-on">
                  <input type="radio" name={`ds-type-${group}`} checked readOnly />
                  <span className="ds-type__aa" aria-hidden="true" style={{ fontFamily: `"${cur.fonts.display}", system-ui, sans-serif` }}>Aa</span>
                  <span className="ds-tile__name">{cur.fonts.display} + {cur.fonts.body}</span>
                  <span className="ds-tile__sub">Current</span>
                </label>
              )}
              {TYPE_PAIRS.map((p) => (
                <label key={p.id} className={`ds-tile ds-type${p.display === cur.fonts.display && p.body === cur.fonts.body ? " is-on" : ""}`}>
                  <input type="radio" name={`ds-type-${group}`} checked={p.display === cur.fonts.display && p.body === cur.fonts.body} onChange={() => edit({ fonts: { display: p.display, body: p.body } }, "you")} />
                  <span className="ds-type__aa" aria-hidden="true" style={{ fontFamily: `"${p.display}", system-ui, sans-serif` }}>Aa</span>
                  <span className="ds-tile__name">{p.label}</span>
                  <span className="ds-tile__sub">{p.mood}</span>
                </label>
              ))}
            </fieldset>
          </Section>

          <Section title="Surface and motion" hint="How cards and controls are drawn, and how much the app moves.">
            <fieldset className="ds-field ds-tiles ds-tiles--surface">
              <legend>Surface</legend>
              {surfaces.map((v) => (
                <label key={v.id} className={`ds-tile ds-surface${cur.surface === v.id ? " is-on" : ""}`}>
                  <input type="radio" name={`ds-surface-${group}`} checked={cur.surface === v.id} onChange={() => edit({ surface: v.id }, "you")} />
                  <span className={`ds-surface__card ds-surface__card--${v.id === "flat" ? "flat" : "tactile"}`} aria-hidden="true">
                    <span /><span />
                  </span>
                  <span className="ds-tile__name">{v.name}</span>
                </label>
              ))}
            </fieldset>
            {/* How much the app moves. Reduced motion on a person's device always wins; expressive effects need their own
                opt-in and an eligible page (homepage, marketing, portfolio), so a level alone never turns them on. */}
            <fieldset className="ds-field ds-tiles ds-tiles--motion">
              <legend>Motion</legend>
              {MOTION_LEVELS.map((m, i) => (
                <label key={m} className={`ds-tile ds-motion${cur.motion?.level === m ? " is-on" : ""}`}>
                  <input type="radio" name={`ds-motion-${group}`} checked={cur.motion?.level === m} onChange={() => edit({ motion: { ...cur.motion, level: m } }, "you")} />
                  <span className="ds-motion__bars" aria-hidden="true">
                    {[0, 1, 2].map((b) => <span key={b} className={b <= i ? "is-lit" : ""} />)}
                  </span>
                  <span className="ds-tile__name">{MOTION_LABEL[m].name}</span>
                  <span className="ds-tile__sub">{MOTION_LABEL[m].detail}</span>
                </label>
              ))}
            </fieldset>
            <p className="ds-hint dim">
              {s.motionSupported === false ? "This app isn't a React app: FlowCode's motion foundation is React only, so the level is kept in the Look but not applied to it. " : null}
              {cur.motion ? null : "Not set for this direction: the app keeps the motion it has. "}People who ask their device for reduced motion get quick fades instead, at every level.
            </p>
          </Section>

          <Section title="Components" hint="Suggest building blocks from the library. The builder is told to use these instead of writing its own.">
            <DesignComponentsBar projectId={projectId} used={[]} onChange={noShown} />
          </Section>
        </div>
        <aside className="ds__preview">
          <StyleSample appearance={cur} label={appExists ? "Draft preview (not applied to the app)" : "Style sample"} />
          <Checks checks={appearanceChecks(cur)} />
        </aside>
      </div>
      <footer className="ds__actions">
        {appExists ? (
          <button type="button" className="btn btn--primary" disabled={busy || (!hasDraft && !(s.selected && (!s.applied || s.selected.version > s.applied.version)))} onClick={() => void confirm(true)}>
            Apply changes
          </button>
        ) : null}
        <button type="button" className={appExists ? "btn" : "btn btn--primary"} disabled={busy || !hasDraft} onClick={() => void confirm(false)}>
          Use this direction
        </button>
        {hasDraft ? <button type="button" className="btn" disabled={busy} onClick={() => void discard()}>Discard draft</button> : null}
        {msg ? <span className="ds__msg" role="status">{msg}</span> : null}
        {error ? <span className="ds__err" role="alert">{error}</span> : null}
      </footer>
    </section>
  );
}
