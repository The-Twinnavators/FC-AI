/**
 * Look and Feel (setup step 2): a preview-first studio. A large live preview of the chosen library page template
 * (LiveTemplate: the real template, painted in the draft look) at phone, tablet or desktop width; beside it a slim panel: where to start (a template from the gallery, or the PRD's look) and five
 * groups (Buttons, Type, Colors, Layout, Motion), one open at a time, each with its current value and a lock. Under
 * the preview, "Describe a change" in words. Saved as a draft as you go (useLookDraft); Next makes it the selected
 * direction the build applies. Short words on screen; the state (draft saved, contrast, not supported) is shown, not
 * explained.
 */
import { useEffect, useMemo, useState } from "react";
import {
  APPEARANCE_THEMES,
  BORDER_WEIGHTS,
  BUTTON_OUTLINES,
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
  gradientUseCss,
  LIBRARY_SECTIONS,
  PRODUCT_TYPES,
  TEMPLATES_FOR,
  type ProductType,
  type Appearance,
  type DirectionReading,
  type LookGroup,
  type NeutralTone,
} from "@flowcode/contracts";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Icon } from "./ui";
import { ColorPicker } from "./ColorPicker";
import { RampSwatch } from "./RampSwatch";
import { ExtrasPicker } from "./ExtrasPicker";
import { LiveTemplate, TemplateThumb } from "./LiveTemplate";
import { Modal } from "./Modal";
import { SetupSteps, StepActions } from "../views/SetupView";
import { useLookDraft } from "./useLookDraft";

type Device = "phone" | "tablet" | "desktop";
const WIDTH: Record<Device, number> = { phone: 390, tablet: 820, desktop: 1280 };
type Group = "buttons" | "type" | "colors" | "layout" | "motion";
const LOCK_OF: Record<Group, LookGroup> = { buttons: "surface", type: "type", colors: "colors", layout: "shape", motion: "motion" };
const NEUTRALS: Array<{ id: NeutralTone; label: string }> = [
  { id: "brand", label: "Tinted" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "pure", label: "Gray" },
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

/** The library's whole-page templates (not the neobrutalist landing: FlowCode starts from Flat or Tactile). */
const TEMPLATES = LIBRARY_SECTIONS.filter((x) => x.ref?.startsWith("t.") && x.id !== "nb-landing");
/** The gallery's filters: the product types that have templates, then all of them. */
const KINDS = [...PRODUCT_TYPES.filter((t) => TEMPLATES_FOR[t.id].some((id) => TEMPLATES.some((x) => x.id === id))).map((t) => ({ id: t.id as string, label: t.label })), { id: "", label: "All" }];
const fits = (kind: string) => (kind ? (TEMPLATES_FOR[kind as ProductType] ?? []).filter((id) => TEMPLATES.some((x) => x.id === id)) : TEMPLATES.map((x) => x.id));
/** Where a product type starts when nothing is chosen yet: its best fitting template. */
const firstFor = (type?: string) => (type ? fits(type)[0] : undefined);

/** Every template as a finished page in the current look, filtered by kind. */
function TemplateGallery({ current, productType, tokens, css, onChoose, onClose }: { current: string; productType?: string; tokens: Record<string, string>; css: string; onChoose: (id: string) => void; onClose: () => void }) {
  // Opens on the project's own product type.
  const [kind, setKind] = useState(productType && productType !== "other" && KINDS.some((k) => k.id === productType) ? productType : "");
  const shown = fits(kind).map((id) => TEMPLATES.find((x) => x.id === id)!);
  return (
    <div className="ls-gallery">
      <header className="ls-gallery__head">
        <h2 id="ls-gallery-title">Choose a starting design</h2>
        <div className="ls-gallery__kinds" role="radiogroup" aria-label="Kind">
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={kind === k.id ? "is-on" : ""} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <button type="button" className="ls-icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={15} />
        </button>
      </header>
      <div className="ls-gallery__grid">
        {shown.map((t) => (
          <button key={t.id} type="button" className={`ls-tpl${t.id === current ? " is-on" : ""}`} aria-pressed={t.id === current} onClick={() => onChoose(t.id)}>
            <TemplateThumb id={t.id} title={t.name} tokens={tokens} css={css} />
            <span className="ls-tpl__name">
              {t.name}
              {t.id === current ? <span className="ls-tpl__on">Selected</span> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

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

export function LookStudio({ projectId, site, template, productType, extras: extrasIn = [], onExtras, onTemplate, onBack, onNext }: { projectId: string; site: string; template?: string; productType?: string; extras?: string[]; onExtras: (next: string[]) => void; onTemplate: (id: string) => void; onBack: () => void; onNext: () => void }) {
  const look = useLookDraft(projectId);
  const a = look.appearance ?? BASE_APPEARANCE;
  const [picked, setPicked] = useState(template ?? firstFor(productType) ?? "home-saas");
  const [gallery, setGallery] = useState(false);
  const [extras, setExtras] = useState(extrasIn);
  const current = TEMPLATES.find((t) => t.id === picked) ?? TEMPLATES[0]!;
  const choose = (id: string) => {
    setPicked(id);
    setGallery(false);
    onTemplate(id);
  };
  const [device, setDevice] = useState<Device>("desktop");
  const [open, setOpen] = useState<Group | "start" | "extras">("start");
  const [words, setWords] = useState("");
  const [reading, setReading] = useState<DirectionReading>();
  const [busy, setBusy] = useState(false);
  const [nextError, setNextError] = useState<string>();
  const tokens = useMemo(() => appearanceTokens(a), [a]);
  const css = useMemo(() => gradientUseCss(a), [a]);
  const checks = useMemo(() => appearanceChecks(a), [a]);
  const failing = checks.filter((c) => !c.ok);
  const g = gradientOf(a);
  const shape = a.shape ?? SHAPE;
  const scale = a.typeScale ?? SCALE;
  const locked = (grp: Group) => look.locks.includes(LOCK_OF[grp]);

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
    buttons: `${CORNERS.find((c) => c.r === shape.radius)?.label ?? `${shape.radius}px`} · ${a.surface === "skeuomorphism" ? "Tactile" : "Flat"}${a.buttonOutline !== undefined ? ` · ${a.buttonOutline}px` : ""}${g?.uses.includes("buttons") ? " · Gradient" : ""}`,
    type: `${a.fonts.display}${a.fonts.body !== a.fonts.display ? ` + ${a.fonts.body}` : ""}`,
    colors: `${a.theme ? `${APPEARANCE_THEMES.find((t) => t.id === a.theme)?.name} · ` : ""}${a.mode === "dark" ? "Dark" : "Light"}`,
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
    <>
    <SetupSteps projectId={projectId} at="look" />
    <div className="ls">
      <div className="ls-main">
        <div className="ls-bar">
          <button type="button" className="ls-template" onClick={() => setGallery(true)} title="Choose another starting design">
            <span className="ls-template__k">Template</span>
            <span className="ls-template__v">{current.name}</span>
            <Icon name="chevron" size={12} />
          </button>
          <div className="ls-seg ls-seg--icons" role="radiogroup" aria-label="Width">
            {(["phone", "tablet", "desktop"] as Device[]).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={device === d} className={device === d ? "is-on" : ""} onClick={() => setDevice(d)} title={`${d[0]!.toUpperCase()}${d.slice(1)} · ${WIDTH[d]}px`} aria-label={`${d[0]!.toUpperCase()}${d.slice(1)}`}>
                {d === "phone" ? <Smartphone size={16} strokeWidth={1.8} aria-hidden="true" /> : d === "tablet" ? <Tablet size={16} strokeWidth={1.8} aria-hidden="true" /> : <Monitor size={16} strokeWidth={1.8} aria-hidden="true" />}
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
          {look.error || nextError ? <span className="ls-err" role="alert" title={nextError ?? look.error}>Not saved</span> : null}
        </div>
        <LiveTemplate id={current.id} title={current.name} tokens={tokens} css={css} device={device} site={site} reserve={16}>
          <StepActions back={onBack} next={{ label: "Next: Build", cp: "look-next", onClick: () => void next(), busy: busy ? "Saving…" : undefined }} />
        </LiveTemplate>
      </div>

      <aside className="ls-panel" aria-label="Look controls" data-cp="look-panel">
        <form
          className="ls-ask"
          onSubmit={(e) => {
            e.preventDefault();
            if (!words.trim()) return;
            setReading(look.read(words));
            setWords("");
          }}
        >
          <input className="ls-ask__input" value={words} onChange={(e) => setWords(e.target.value)} placeholder="Describe a change… e.g. warmer, bolder headings" aria-label="Describe a change" />
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
        <section className={`ls-group${open === "start" ? " is-open" : ""}`}>
          <div className="ls-group__head">
            <button type="button" className="ls-group__btn" aria-expanded={open === "start"} onClick={() => setOpen("start")}>
              <span className="ls-group__name">Start from</span>
              <span className="ls-group__val">{current.name}</span>
              <Icon name="chevron" size={13} />
            </button>
          </div>
          {open === "start" ? (
            <div className="ls-group__body">
              <button type="button" className="ls-current" onClick={() => setGallery(true)}>
                <TemplateThumb id={current.id} title={current.name} tokens={tokens} css={css} />
                <span className="ls-current__name">{current.name}</span>
                <span className="ls-current__change">Browse templates</span>
              </button>
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
            <Seg label="Outline" value={a.buttonOutline} options={BUTTON_OUTLINES.map((w) => ({ v: w, label: `${w}px` }))} disabled={locked("buttons")} onChange={(w) => look.edit({ buttonOutline: w })} />
            <Seg label="Style" value={a.surface === "skeuomorphism" ? "skeuomorphism" : "flat"} options={[{ v: "flat", label: "Flat" }, { v: "skeuomorphism", label: "Tactile" }]} disabled={locked("buttons")} onChange={(v) => look.edit({ surface: v })} />
            <Seg
              label="Fill"
              value={g?.uses.includes("buttons") ? "gradient" : "solid"}
              options={[{ v: "solid", label: "Solid" }, { v: "gradient", label: "Gradient" }]}
              disabled={locked("colors")}
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
          "colors",
          "Colors",
          <>
            <div className="ls-field">
              <span className="ls-field__k">Palette</span>
              <div className="ls-palettes">
                {APPEARANCE_THEMES.map((t) => {
                  const tk = appearanceTokens(appearanceFromTheme(t.id) ?? BASE_APPEARANCE);
                  return (
                    <button key={t.id} type="button" className={`ls-palette${a.theme === t.id ? " is-on" : ""}`} aria-pressed={a.theme === t.id} title={t.name} aria-label={t.name} disabled={locked("colors")} onClick={() => look.edit(appearanceFromTheme(t.id, a.surface)!, `theme:${t.id}`)} style={{ background: tk["--color-bg"], borderColor: tk["--color-border"] }}>
                      <span style={{ background: tk["--color-accent"] }} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="ls-field">
              <span className="ls-field__k">Primary</span>
              <RampSwatch label="Primary" value={a.primary} disabled={locked("colors")} onPick={(hex) => look.edit({ primary: hex })} />
              <ColorPicker label="Primary color" value={a.primary} onChange={(hex) => !locked("colors") && look.edit({ primary: hex })} />
            </div>
            <div className="ls-field">
              <span className="ls-field__k">Secondary</span>
              {a.secondary ? (
                <>
                  <RampSwatch label="Secondary" value={a.secondary} disabled={locked("colors")} onPick={(hex) => look.edit({ secondary: hex })} />
                  <span className="ls-row">
                    <ColorPicker label="Secondary color" value={a.secondary} onChange={(hex) => !locked("colors") && look.edit({ secondary: hex })} />
                    <button type="button" className="ls-icon-btn" title="Remove" onClick={() => look.edit({ secondary: undefined })}><Icon name="x" size={13} /><span className="sr-only">Remove secondary</span></button>
                  </span>
                </>
              ) : (
                <button type="button" className="btn btn--sm" disabled={locked("colors")} onClick={() => look.edit({ secondary: "#be6a2a" })}>Add</button>
              )}
            </div>
            <Seg label="Neutrals" value={a.neutral} options={NEUTRALS.map((n) => ({ v: n.id, label: n.label }))} disabled={locked("colors")} onChange={(n) => look.edit({ neutral: n })} />
            <Seg label="Mode" value={a.mode} options={[{ v: "light", label: "Light" }, { v: "dark", label: "Dark" }]} disabled={locked("colors")} onChange={(mode) => look.edit({ mode })} />
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

        <section className={`ls-group${open === "extras" ? " is-open" : ""}`}>
          <div className="ls-group__head">
            <button type="button" className="ls-group__btn" aria-expanded={open === "extras"} onClick={() => setOpen(open === "extras" ? "start" : "extras")}>
              <span className="ls-group__name">Extras</span>
              <span className="ls-group__val">{extras.length ? `${extras.length} in this build` : "None"}</span>
              <Icon name="chevron" size={13} />
            </button>
          </div>
          {open === "extras" ? (
            <div className="ls-group__body">
              <ExtrasPicker value={extras} onChange={(next) => (setExtras(next), onExtras(next))} />
            </div>
          ) : null}
        </section>

        <p className={`ls-contrast${failing.length ? " is-bad" : ""}`} title={checks.map((c) => `${c.ok ? "✓" : "✕"} ${c.label}: ${c.ratio}:1 (needs ${c.min}:1)`).join("\n")}>
          {failing.length ? `✕ ${failing.length} contrast ${failing.length === 1 ? "issue" : "issues"}` : `✓ Contrast passes (${checks.length})`}
        </p>
      </aside>

      {gallery ? (
        <Modal onClose={() => setGallery(false)} labelledBy="ls-gallery-title" className="ls-gallery-modal">
          <TemplateGallery current={current.id} productType={productType} tokens={tokens} css={css} onChoose={choose} onClose={() => setGallery(false)} />
        </Modal>
      ) : null}
    </div>
    </>
  );
}
