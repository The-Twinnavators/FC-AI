/**
 * Look and Feel (setup step 2): a preview-first studio. A large live preview of realistic app screens (LookPreview)
 * at phone, tablet or desktop width; beside it a slim panel: where to start (a theme, or the PRD's look) and five
 * groups (Buttons, Type, Colours, Layout, Motion), one open at a time, each with its current value and a lock. Under
 * the preview, "Describe a change" in words. Saved as a draft as you go (useLookDraft); Next makes it the selected
 * direction the build applies. Short words on screen; the state (draft saved, contrast, not supported) is shown, not
 * explained.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  APPEARANCE_THEMES,
  BORDER_WEIGHTS,
  BASE_APPEARANCE,
  DENSITIES,
  DENSITY_LABEL,
  MOTION_LABEL,
  MOTION_LEVELS,
  TYPE_PAIRS,
  TYPE_RATIOS,
  appearanceChecks,
  appearanceFromTheme,
  appearanceTokens,
  gradientOf,
  type Appearance,
  type DirectionReading,
  type LookGroup,
  type NeutralTone,
} from "@flowcode/contracts";
import { Icon } from "./ui";
import { ColorPicker } from "./ColorPicker";
import { LookPreview, PREVIEW_SCREENS, type PreviewScreen } from "./LookPreview";
import { useLookDraft } from "./useLookDraft";

type Device = "phone" | "tablet" | "desktop";
const WIDTH: Record<Device, number> = { phone: 390, tablet: 820, desktop: 1280 };
type Group = "buttons" | "type" | "colours" | "layout" | "motion";
const LOCK_OF: Record<Group, LookGroup> = { buttons: "surface", type: "type", colours: "colors", layout: "shape", motion: "motion" };
const NEUTRALS: Array<{ id: NeutralTone; label: string }> = [
  { id: "brand", label: "Tinted" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "pure", label: "Grey" },
];
const CORNERS = [
  { r: 0, label: "Sharp" },
  { r: 6, label: "Soft" },
  { r: 12, label: "Round" },
];
const SIZES = [
  { base: 14, label: "S" },
  { base: 16, label: "M" },
  { base: 18, label: "L" },
];
const SHAPE = { radius: 10, density: "comfortable" as const, borders: "fine" as const };
const SCALE = { base: 16, ratio: 1.2 };

/** A row of choices drawn as one segmented control. */
function Seg<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T | undefined; options: Array<{ v: T; label: string; title?: string }>; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="ls-field">
      <span className="ls-field__k">{label}</span>
      <div className="ls-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? "is-on" : ""} title={o.title} disabled={disabled} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LookStudio({ projectId, brand, tagline, onBack, onNext }: { projectId: string; brand: string; tagline: string; onBack: () => void; onNext: () => void }) {
  const look = useLookDraft(projectId);
  const a = look.appearance ?? BASE_APPEARANCE;
  const [screen, setScreen] = useState<PreviewScreen>("home");
  const [device, setDevice] = useState<Device>("desktop");
  const [open, setOpen] = useState<Group | "start">("start");
  const [words, setWords] = useState("");
  const [reading, setReading] = useState<DirectionReading>();
  const [busy, setBusy] = useState(false);
  const [nextError, setNextError] = useState<string>();
  const tokens = useMemo(() => appearanceTokens(a), [a]);
  const checks = useMemo(() => appearanceChecks(a), [a]);
  const failing = checks.filter((c) => !c.ok);
  const g = gradientOf(a);
  const shape = a.shape ?? SHAPE;
  const scale = a.typeScale ?? SCALE;
  const locked = (grp: Group) => look.locks.includes(LOCK_OF[grp]);

  // The preview is drawn at the device's real width and scaled to fit the stage.
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setFit(Math.min(1, (el.clientWidth - 2) / WIDTH[device]));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // The stage exists only once the look has loaded.
  }, [device, !!look.appearance]);

  // Ctrl/Cmd+Z undoes the last change while focus isn't in a text field.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !/^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        look.undo();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const next = async () => {
    setBusy(true);
    setNextError(undefined);
    try {
      await look.select();
      onNext();
    } catch (e) {
      setNextError((e as Error).message);
      setBusy(false);
    }
  };

  const summary: Record<Group, string> = {
    buttons: `${CORNERS.find((c) => c.r === shape.radius)?.label ?? `${shape.radius}px`} · ${a.surface === "skeuomorphism" ? "Tactile" : "Flat"}${g?.uses.includes("buttons") ? " · Gradient" : ""}`,
    type: `${a.fonts.display}${a.fonts.body !== a.fonts.display ? ` + ${a.fonts.body}` : ""}`,
    colours: `${a.mode === "dark" ? "Dark" : "Light"} · ${NEUTRALS.find((n) => n.id === a.neutral)?.label}`,
    layout: `${DENSITY_LABEL[shape.density].name} · ${shape.borders === "strong" ? "Strong" : "Fine"} borders`,
    motion: a.motion ? MOTION_LABEL[a.motion.level].name : "As is",
  };
  const section = (id: Group, label: string, body: React.ReactNode) => (
    <section className={`ls-group${open === id ? " is-open" : ""}`}>
      <div className="ls-group__head">
        <button type="button" className="ls-group__btn" aria-expanded={open === id} onClick={() => setOpen(open === id ? "start" : id)}>
          <span className="ls-group__name">{label}</span>
          <span className="ls-group__val">{summary[id]}</span>
          <Icon name="chevron" size={13} />
        </button>
        <button type="button" className={`ls-lock${locked(id) ? " is-on" : ""}`} aria-pressed={locked(id)} title={locked(id) ? `${label} locked: nothing changes it` : `Lock ${label.toLowerCase()}`} onClick={() => void look.toggleLock(LOCK_OF[id])}>
          <Icon name="pin" size={13} />
          <span className="sr-only">Lock {label}</span>
        </button>
      </div>
      {open === id ? <div className="ls-group__body">{body}</div> : null}
    </section>
  );

  if (!look.appearance) return <p className="dim">Loading the look…</p>;
  return (
    <div className="ls">
      <div className="ls-main">
        <div className="ls-bar">
          <div className="ls-tabs" role="tablist" aria-label="Screen">
            {PREVIEW_SCREENS.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={screen === s.id} className={screen === s.id ? "is-on" : ""} onClick={() => setScreen(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="ls-seg ls-seg--icons" role="radiogroup" aria-label="Width">
            {(["phone", "tablet", "desktop"] as Device[]).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={device === d} className={device === d ? "is-on" : ""} onClick={() => setDevice(d)} title={`${d[0]!.toUpperCase()}${d.slice(1)} · ${WIDTH[d]}px`}>
                {d === "phone" ? "Phone" : d === "tablet" ? "Tablet" : "Desktop"}
              </button>
            ))}
          </div>
          <span className={`ls-status is-${look.saving}`} role="status">
            {look.saving === "saving" ? "Saving…" : look.saving === "error" ? "Not saved" : "Draft saved"}
          </span>
          <button type="button" className="ls-icon-btn" disabled={!look.canUndo} onClick={look.undo} title="Undo (Ctrl+Z)">
            <Icon name="undo" size={15} />
            <span className="sr-only">Undo</span>
          </button>
        </div>
        <div className="ls-stage" ref={stage}>
          <div className="ls-frame" style={{ width: WIDTH[device], transform: `scale(${fit})`, height: `${100 / fit}%` }}>
            <LookPreview screen={screen} tokens={tokens} brand={brand} tagline={tagline} gradientUses={g?.uses ?? []} />
          </div>
        </div>
        <form
          className="ls-ask"
          onSubmit={(e) => {
            e.preventDefault();
            if (!words.trim()) return;
            setReading(look.read(words));
            setWords("");
          }}
        >
          <input className="ls-ask__input" value={words} onChange={(e) => setWords(e.target.value)} placeholder="Describe a change… e.g. warmer, rounder corners, bolder headings" aria-label="Describe a change" />
          <button type="submit" className="btn btn--primary btn--sm" disabled={!words.trim()}>Apply</button>
        </form>
        {reading ? (
          <ul className="ls-read" aria-label="What the change did">
            {reading.understood.map((u) => (
              <li key={u.words} className={u.locked ? "is-locked" : u.group === "build" ? "is-later" : "is-ok"} title={u.words}>
                {u.locked ? `Locked: ${u.change}` : u.group === "build" ? `During the build: ${u.words}` : `✓ ${u.change}`}
              </li>
            ))}
            {reading.unread.map((w) => (
              <li key={w} className="is-no" title="FlowCode can't do this from words yet">✕ Not supported: {w}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <aside className="ls-panel" aria-label="Look controls">
        <section className={`ls-group${open === "start" ? " is-open" : ""}`}>
          <div className="ls-group__head">
            <button type="button" className="ls-group__btn" aria-expanded={open === "start"} onClick={() => setOpen("start")}>
              <span className="ls-group__name">Start from</span>
              <span className="ls-group__val">{a.theme ? APPEARANCE_THEMES.find((t) => t.id === a.theme)?.name : "Your colours"}</span>
              <Icon name="chevron" size={13} />
            </button>
          </div>
          {open === "start" ? (
            <div className="ls-group__body">
              <div className="ls-themes">
                {APPEARANCE_THEMES.map((t) => {
                  const tk = appearanceTokens(appearanceFromTheme(t.id) ?? BASE_APPEARANCE);
                  return (
                    <button key={t.id} type="button" className={`ls-theme${a.theme === t.id ? " is-on" : ""}`} aria-pressed={a.theme === t.id} title={t.name} disabled={locked("colours")} onClick={() => look.edit(appearanceFromTheme(t.id, a.surface)!, `theme:${t.id}`)}>
                      <span className="ls-theme__sw" style={{ background: tk["--color-bg"], borderColor: tk["--color-border"] }}>
                        <span style={{ background: tk["--color-accent"] }} />
                      </span>
                      <span className="ls-theme__name">{t.name}</span>
                    </button>
                  );
                })}
              </div>
              {look.state?.prd?.direction ? (
                <button type="button" className="btn btn--sm ls-prd" onClick={() => setReading(look.read(look.state!.prd!.direction!))}>
                  Use my PRD's look
                </button>
              ) : (
                <p className="ls-quiet">No design direction found in a PRD.</p>
              )}
              <label className="ls-check ls-check--off" title="Three different drafts to choose from: not built yet">
                <input type="checkbox" disabled /> Show me three drafts first <span className="ls-soon">Soon</span>
              </label>
            </div>
          ) : null}
        </section>

        {section(
          "buttons",
          "Buttons",
          <>
            <Seg label="Corners" value={shape.radius} options={CORNERS.map((c) => ({ v: c.r, label: c.label }))} disabled={locked("layout")} onChange={(r) => look.edit({ shape: { ...shape, radius: r } })} />
            <Seg label="Style" value={a.surface === "skeuomorphism" ? "skeuomorphism" : "flat"} options={[{ v: "flat", label: "Flat" }, { v: "skeuomorphism", label: "Tactile" }]} disabled={locked("buttons")} onChange={(v) => look.edit({ surface: v })} />
            <Seg
              label="Fill"
              value={g?.uses.includes("buttons") ? "gradient" : "solid"}
              options={[{ v: "solid", label: "Solid" }, { v: "gradient", label: "Gradient" }]}
              disabled={locked("colours")}
              onChange={(v) => {
                const uses = (g?.uses ?? []).filter((u) => u !== "buttons");
                const nextUses = v === "gradient" ? [...uses, "buttons" as const] : uses;
                look.edit({ gradient: nextUses.length ? { to: g?.to ?? (a.secondary ? "secondary" : "lighter"), angle: g?.angle ?? 135, uses: nextUses } : undefined });
              }}
            />
          </>,
        )}
        {section(
          "type",
          "Type",
          <>
            <div className="ls-fonts" role="radiogroup" aria-label="Fonts">
              {TYPE_PAIRS.map((p) => {
                const on = p.display === a.fonts.display && p.body === a.fonts.body;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={on} className={on ? "is-on" : ""} disabled={locked("type")} onClick={() => look.edit({ fonts: { display: p.display, body: p.body } })} title={p.mood}>
                    <span className="ls-fonts__aa" style={{ fontFamily: `"${p.display}", system-ui` }}>Aa</span>
                    <span className="ls-fonts__name">{p.label}</span>
                  </button>
                );
              })}
            </div>
            <Seg label="Size" value={scale.base} options={SIZES.map((s) => ({ v: s.base, label: s.label, title: `${s.base}px body text` }))} disabled={locked("type")} onChange={(base) => look.edit({ typeScale: { ...scale, base } })} />
            <Seg label="Headings" value={scale.ratio} options={TYPE_RATIOS.filter((r) => [1.125, 1.25, 1.5].includes(r.ratio)).map((r) => ({ v: r.ratio, label: r.label }))} disabled={locked("type")} onChange={(ratio) => look.edit({ typeScale: { ...scale, ratio } })} />
          </>,
        )}
        {section(
          "colours",
          "Colours",
          <>
            <div className="ls-field">
              <span className="ls-field__k">Primary</span>
              <ColorPicker label="Primary colour" value={a.primary} onChange={(hex) => !locked("colours") && look.edit({ primary: hex })} />
            </div>
            <div className="ls-field">
              <span className="ls-field__k">Secondary</span>
              {a.secondary ? (
                <span className="ls-row">
                  <ColorPicker label="Secondary colour" value={a.secondary} onChange={(hex) => !locked("colours") && look.edit({ secondary: hex })} />
                  <button type="button" className="ls-icon-btn" title="Remove" onClick={() => look.edit({ secondary: undefined })}><Icon name="x" size={13} /><span className="sr-only">Remove secondary</span></button>
                </span>
              ) : (
                <button type="button" className="btn btn--sm" disabled={locked("colours")} onClick={() => look.edit({ secondary: "#be6a2a" })}>Add</button>
              )}
            </div>
            <Seg label="Neutrals" value={a.neutral} options={NEUTRALS.map((n) => ({ v: n.id, label: n.label }))} disabled={locked("colours")} onChange={(n) => look.edit({ neutral: n })} />
            <Seg label="Mode" value={a.mode} options={[{ v: "light", label: "Light" }, { v: "dark", label: "Dark" }]} disabled={locked("colours")} onChange={(mode) => look.edit({ mode })} />
          </>,
        )}
        {section(
          "layout",
          "Layout",
          <>
            <Seg label="Spacing" value={shape.density} options={DENSITIES.map((d) => ({ v: d, label: DENSITY_LABEL[d].name, title: DENSITY_LABEL[d].detail }))} disabled={locked("layout")} onChange={(density) => look.edit({ shape: { ...shape, density } })} />
            <Seg label="Borders" value={shape.borders} options={BORDER_WEIGHTS.map((b) => ({ v: b, label: b === "fine" ? "Fine" : "Strong" }))} disabled={locked("layout")} onChange={(borders) => look.edit({ shape: { ...shape, borders } })} />
          </>,
        )}
        {section(
          "motion",
          "Motion",
          <Seg label="Amount" value={a.motion?.level} options={MOTION_LEVELS.map((m) => ({ v: m, label: MOTION_LABEL[m].name, title: MOTION_LABEL[m].detail }))} disabled={locked("motion")} onChange={(level) => look.edit({ motion: { ...a.motion, level } })} />,
        )}

        <p className={`ls-contrast${failing.length ? " is-bad" : ""}`} title={checks.map((c) => `${c.ok ? "✓" : "✕"} ${c.label}: ${c.ratio}:1 (needs ${c.min}:1)`).join("\n")}>
          {failing.length ? `✕ ${failing.length} contrast ${failing.length === 1 ? "issue" : "issues"}` : `✓ Contrast passes (${checks.length})`}
        </p>
      </aside>

      <footer className="ls-foot">
        {look.error || nextError ? <span className="ls-err" role="alert">{nextError ?? look.error}</span> : null}
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void next()}>
          {busy ? "Saving…" : "Next: Agentic Build Levels"} <Icon name="chevron" size={13} />
        </button>
      </footer>
    </div>
  );
}
