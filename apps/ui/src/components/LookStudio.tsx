/**
 * Look and Feel (setup step 2): a preview-first studio. A large live preview of the chosen library page template
 * (LiveTemplate: the real template, painted in the draft look) at phone, tablet or desktop width; beside it a slim panel: where to start (a template from the gallery, or the PRD's look) and five
 * groups (Buttons, Type, Colors, Layout, Motion), one open at a time, each with its current value and a lock. Under
 * the preview, "Describe a change" in words. Saved as a draft as you go (useLookDraft); Next makes it the selected
 * direction the build applies. Short words on screen; the state (draft saved, contrast, not supported) is shown, not
 * explained.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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
  DESIGN_FIDELITY,
  designQuestions,
  type DesignDraft,
  type ProjectSetup,
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
import { DesignDrafts } from "./DesignDrafts";
import { post } from "../api";

/** Locked Look groups, by the names the panel uses. */
const LOCK_NAME: Record<string, string> = { colors: "Colors", type: "Type", shape: "Layout", surface: "Buttons", motion: "Motion" };

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

export function LookStudio({ projectId, site, setup, design, onSetup, extras: extrasIn = [], onExtras, onTemplate, onBack, onNext }: { projectId: string; site: string; setup: ProjectSetup; design?: { approved: boolean; questions: string[] }; onSetup: () => void; extras?: string[]; onExtras: (next: string[]) => void; onTemplate: (id: string) => void; onBack: () => void; onNext: () => void }) {
  const { template, productType } = setup;
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
  // FlowCode's proposals: shown in place of the preview until one is chosen.
  const [view, setView] = useState<"drafts" | "preview">(setup.designMode === "agents" && setup.draftSets.length && !setup.chosenDraft ? "drafts" : "preview");
  const [drafting, setDrafting] = useState<string>();
  const [draftError, setDraftError] = useState<string>();
  const [notes, setNotes] = useState(setup.designNotes ?? "");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [summary, setSummary] = useState(false);
  const askBox = useRef<HTMLTextAreaElement>(null);
  const saveSetup = (patch: Partial<ProjectSetup>) => post(`/projects/${projectId}/setup`, patch).then(onSetup);
  const propose = async (feedback?: string) => {
    setDrafting(feedback ? "Making new drafts…" : "Making drafts…");
    setDraftError(undefined);
    try {
      await post(`/projects/${projectId}/setup/drafts`, feedback ? { feedback } : {});
      onSetup();
      setView("drafts");
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setDrafting(undefined);
    }
  };
  const setMode = async (mode: "mine" | "agents") => {
    // Letting FlowCode decide starts with three drafts (one proposal is a click away).
    await saveSetup(mode === "agents" ? { designMode: mode, threeDrafts: true } : { designMode: mode });
    if (mode === "agents" && !setup.draftSets.length) await propose();
    else setView(mode === "agents" && !setup.chosenDraft ? "drafts" : "preview");
  };
  const chooseDraft = async (d: DesignDraft, refine: boolean) => {
    setDrafting("Choosing…");
    setDraftError(undefined);
    try {
      await post(`/projects/${projectId}/setup/choose-draft`, { draft: d.id });
      look.adopt(d.appearance);
      setPicked(d.template);
      setView("preview");
      onSetup();
      // Refine: the studio, ready for words.
      if (refine) setTimeout(() => askBox.current?.focus(), 50);
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setDrafting(undefined);
    }
  };
  const editNotes = (text: string) => {
    setNotes(text);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => void saveSetup({ designNotes: text }), 500);
  };
  const flushNotes = async () => {
    if (!notesTimer.current) return;
    clearTimeout(notesTimer.current);
    notesTimer.current = undefined;
    await saveSetup({ designNotes: notes });
  };
  const questions = designQuestions({ ...setup, designNotes: notes });
  // Any change to the Look after the page opened means the approval (if any) no longer holds.
  const [changed, setChanged] = useState(false);
  const firstLook = useRef<unknown>(undefined);
  useEffect(() => {
    if (!look.appearance) return;
    if (firstLook.current === undefined) firstLook.current = look.appearance;
    else if (firstLook.current !== look.appearance) setChanged(true);
  }, [look.appearance]);
  const approved = !!design?.approved && !changed && notes === (setup.designNotes ?? "");
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

  /** Saves what is pending, then shows the summary to approve. */
  const review = async () => {
    setNextError(undefined);
    try {
      await Promise.all([look.flush(), flushNotes()]);
      setSummary(true);
    } catch (e) {
      setNextError((e as Error).message);
    }
  };
  /** "Approve Design and Continue": the person's approval; the build can start only from it. */
  const approve = async () => {
    setBusy(true);
    setNextError(undefined);
    try {
      await post(`/projects/${projectId}/setup/approve-design`, { template: picked });
      onSetup();
      onNext();
    } catch (e) {
      setNextError((e as Error).message);
      setBusy(false);
    }
  };

  const values: Record<Group, string> = {
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
          <span className="ls-group__val">{values[id]}</span>
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
        {view === "drafts" && setup.draftSets.length ? (
            <DesignDrafts sets={setup.draftSets} chosen={setup.chosenDraft} site={site} busy={drafting} error={draftError} onChoose={(d, refine) => void chooseDraft(d, refine)} onRevise={(f) => void propose(f)}>
            <StepActions back={onBack} next={{ label: "Approve Design and Continue", cp: "look-next", onClick: () => void review() }} />
          </DesignDrafts>
        ) : (
          <LiveTemplate id={current.id} title={current.name} tokens={tokens} css={css} device={device} site={site} reserve={16}>
            <StepActions back={onBack} next={{ label: approved ? "Next: Build" : "Approve Design and Continue", cp: "look-next", onClick: () => (approved ? onNext() : void review()), busy: busy ? "Saving…" : undefined }} />
          </LiveTemplate>
        )}
      </div>

      <aside className="ls-panel" aria-label="Look controls" data-cp="look-panel">
        <section className={`ls-group${open === "start" ? " is-open" : ""}`}>
          <div className="ls-group__head">
            <button type="button" className="ls-group__btn" aria-expanded={open === "start"} onClick={() => setOpen("start")}>
              <span className="ls-group__name">Select a template</span>
              <span className="ls-group__val">{current.name}</span>
              <Icon name="chevron" size={13} />
            </button>
          </div>
          {open === "start" ? (
            <div className="ls-group__body">
              <div className="ls-seg ls-mode" role="radiogroup" aria-label="Who picks the design">
                {([["mine", "I'll choose"], ["agents", "Let FlowCode agents decide"]] as const).map(([m, label]) => (
                  <button key={m} type="button" role="radio" aria-checked={setup.designMode === m} className={setup.designMode === m ? "is-on" : ""} disabled={!!drafting} onClick={() => void setMode(m)}>
                    {label}
                  </button>
                ))}
              </div>
              {setup.designMode === "agents" ? (
                <div className="ls-agents">
                  <label className="ls-check">
                    <input type="checkbox" checked={setup.threeDrafts} onChange={(e) => void saveSetup({ threeDrafts: e.target.checked })} /> Show me three design drafts
                  </label>
                  {setup.draftSets.length ? (
                    <button type="button" className="btn btn--sm" onClick={() => setView("drafts")}>{view === "drafts" ? "Showing the drafts" : setup.chosenDraft ? "Compare the drafts" : "See the drafts"}</button>
                  ) : (
                    <button type="button" className="btn btn--primary btn--sm" disabled={!!drafting} onClick={() => void propose()}>{drafting ?? (setup.threeDrafts ? "Propose three designs" : "Propose a design")}</button>
                  )}
                  {draftError && view !== "drafts" ? <p className="psetup__err" role="alert">{draftError}</p> : null}
                </div>
              ) : null}
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
              <fieldset className="ls-fidelity">
                <legend>How closely should FlowCode follow this design?</legend>
                {DESIGN_FIDELITY.map((f) => (
                  <label key={f.id} className={`ls-fidelity__opt${setup.fidelity === f.id ? " is-on" : ""}`} title={f.detail}>
                    <input type="radio" name="ls-fidelity" checked={setup.fidelity === f.id} onChange={() => void saveSetup({ fidelity: f.id })} />
                    <span className="ls-fidelity__name">{f.label}</span>
                    <span className="ls-fidelity__detail">{f.detail}</span>
                  </label>
                ))}
              </fieldset>
              <label className="ls-notes">
                <span className="ls-notes__k">
                  What would you like to change, keep, or add?
                  {setup.fidelity === "inspiration" ? <span className={notes.trim() ? "ls-notes__ok" : "ls-notes__req"}>{notes.trim() ? "" : " Needed"}</span> : <span className="ls-notes__opt"> Optional</span>}
                </span>
                <textarea className="ls-ask__input ls-notes__input" rows={3} value={notes} onChange={(e) => editNotes(e.target.value)} placeholder="e.g. keep the calendar, add a photo of the studio, no pricing table" />
              </label>
            </div>
          ) : null}
        </section>

        <form
          className="ls-ask"
          onSubmit={(e) => {
            e.preventDefault();
            if (!words.trim()) return;
            setReading(look.read(words));
            setWords("");
          }}
        >
          <textarea
            ref={askBox}
            className="ls-ask__input"
            rows={3}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            // Enter applies; Shift+Enter starts a new line.
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Describe a change… e.g. warmer, bolder headings"
            aria-label="Describe a change"
          />
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

      {summary ? (
        <Modal onClose={() => setSummary(false)} labelledBy="ls-approve-title" className="ls-approve">
          <h2 id="ls-approve-title">Approve the design</h2>
          <p className="ls-approve__lede">The build starts from this. Nothing is built until you approve it.</p>
          <dl className="ls-approve__list">
            <dt>Visual reference</dt>
            <dd>{current.name}{setup.chosenDraft ? ` · ${setup.draftSets.flatMap((x) => x.drafts).find((x) => x.id === setup.chosenDraft)?.label ?? ""}` : ""} · {values.colors} · {values.type}</dd>
            <dt>How closely</dt>
            <dd>{DESIGN_FIDELITY.find((f) => f.id === setup.fidelity)?.label ?? <em className="ls-approve__missing">Not chosen yet</em>}</dd>
            <dt>Changes and additions</dt>
            <dd>{notes.trim() || "None"}{look.state?.draft?.notes?.length || look.state?.selected?.notes?.length ? ` · For the build: ${(look.state?.draft?.notes ?? look.state?.selected?.notes ?? []).join(", ")}` : ""}</dd>
            <dt>Locked</dt>
            <dd>{look.locks.length ? look.locks.map((l) => LOCK_NAME[l] ?? l).join(", ") : "Nothing"}</dd>
            <dt>Open questions</dt>
            <dd>
              {questions.length || reading?.unread.length ? (
                <ul className="ls-approve__q">
                  {questions.map((q) => <li key={q}>{q}</li>)}
                  {reading?.unread.length ? <li>FlowCode couldn't apply: {reading.unread.join(", ")}. Add it to your notes, or say it another way.</li> : null}
                </ul>
              ) : (
                "None"
              )}
            </dd>
          </dl>
          {nextError ? <p className="psetup__err" role="alert">{nextError}</p> : null}
          <div className="ls-approve__actions">
            <button type="button" className="btn" onClick={() => setSummary(false)}>Keep editing</button>
            <button type="button" className="btn btn--primary" data-cp="look-approve" disabled={busy || questions.length > 0} onClick={() => void approve()}>
              {busy ? "Approving…" : "Approve Design and Continue"}
            </button>
          </div>
        </Modal>
      ) : null}
      {gallery ? (
        <Modal onClose={() => setGallery(false)} labelledBy="ls-gallery-title" className="ls-gallery-modal">
          <TemplateGallery current={current.id} productType={productType} tokens={tokens} css={css} onChoose={choose} onClose={() => setGallery(false)} />
        </Modal>
      ) : null}
    </div>
    </>
  );
}
