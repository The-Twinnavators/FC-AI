/**
 * Styles → Design: the app's design system laid out like the Primitives page. A sticky list on the left (Foundations,
 * then Components); each item is a card with a live preview drawn with the app's own stylesheets and a Configure
 * button that opens its editor (after CSSVibes). Changes are written to the app's tokens, so the Preview and every
 * screen follow.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import {
  BRAND_ROLES,
  MAX_BRAND_COLORS,
  RAMP_STEPS,
  STATUS_KINDS,
  buildPalette,
  contrastAudit,
  contrastLevel,
  contrastRatio,
  defaultSecondary,
  harmonies,
  normalizeHex,
  secondaryFit,
  secondaryTokens,
  rampTokens,
  roleTokens,
  type BrandColor,
  type NeutralTone,
  type PaletteConfig,
  type Ramp,
  type StatusKind,
} from "@flowcode/contracts";
import { post, useResource } from "../api";
import { Modal } from "./Modal";
import { ColorPicker } from "./ColorPicker";
import { componentStyleSpec, componentStylesCss, type ComponentStyleValues } from "@flowcode/contracts";
import { StyleSheetFrame, stylesChanged, STYLES_CHANGED, type Library } from "./ComponentSheet";
import { DesignControls, DesignComponentsBar, type ControlSection } from "./DesignStudio";
import { COMPONENT_CATALOG, KIT_BLOCK } from "./componentPickerData";
import type { PreviewTheme } from "./PreviewTheme";

/** The kit's components (ui-…). App-only classes (.muted, .shell) and the bare input aren't components to configure. */
const isComponent = (block: string) => /^ui-/.test(block) && !["ui-input", "ui-skip", "ui-sr-only", "ui-narrow"].includes(block);

// Colours and fonts are edited in the Look (one governed path), so their cards open it rather than an editor here.
type Editor = { kind: "shape" } | { kind: "block"; block: string };

const blockLabel = (lib: Library, block: string) =>
  COMPONENT_CATALOG.find((c) => KIT_BLOCK[c.id] === block)?.label ?? block.replace(/^ui-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

export function DesignBoard({ projectId, lib, theme, fonts, used }: { projectId: string; lib: Library; theme: PreviewTheme; fonts?: string[]; used: string[] }) {
  const [shown, setShown] = useState<string[]>(used);
  const onShown = useCallback((x: string[]) => setShown(x), []);
  const [editor, setEditor] = useState<Editor>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const blocks = useMemo(() => lib.primitives.filter((p) => p.samples.length && shown.includes(p.block) && isComponent(p.block)), [lib, shown]);
  // Unsaved component settings (a Configure modal open): drawn in place of the saved ones.
  const [componentCss, setComponentCss] = useState<string>();
  const frame = (part: "type" | "colours" | "blocks" | "all" | "palette" | "shape", only?: string[], min = 120) => (
    <StyleSheetFrame lib={lib} fonts={fonts} theme={theme} draft={draft} shown={only} part={part} minHeight={min} componentCss={componentCss} />
  );
  const close = () => (setEditor(undefined), setDraft({}), setComponentCss(undefined));
  const openLook = () => window.dispatchEvent(new CustomEvent("fc:open-look"));

  const nav: Array<{ group: string; items: Array<{ id: string; label: string }> }> = [
    { group: "Foundations", items: [{ id: "colours", label: "Colors" }, { id: "type", label: "Typography" }, { id: "shape", label: "Shape & style" }] },
    { group: "Components", items: blocks.map((b) => ({ id: b.block, label: blockLabel(lib, b.block) })) },
  ];
  const go = (id: string) => document.getElementById(`dcard-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="dboard">
      <nav className="dboard__nav" aria-label="Design system">
        {nav.map((g) => (
          <div key={g.group} className="dboard__nav-group">
            <span className="label">{g.group}</span>
            {g.group === "Components" ? (
              <DesignComponentsBar variant="nav" projectId={projectId} used={used.filter(isComponent)} onChange={onShown} />
            ) : (
              g.items.map((it) => (
                <a key={it.id} href={`#dcard-${it.id}`} onClick={(e) => (e.preventDefault(), go(it.id))}>
                  {it.label}
                </a>
              ))
            )}
          </div>
        ))}
      </nav>

      <div className="dboard__cards">

        {/* Colours, fonts and the surface style are the project's Look (DirectionEditor): changed there as a draft and applied
            deliberately, never written straight to the app from here. */}
        <DesignCard id="colours" title="Colors" group="Foundation" note="Set in Look: primary and neutral family, optional secondary, tertiary and status colours" onConfigure={openLook} configureLabel="Change in Look">
          <PaletteSummary projectId={projectId} theme={theme} />
        </DesignCard>
        <DesignCard id="type" title="Typography" group="Foundation" note="Fonts set in Look; sizes and weights are advanced source settings on the Tokens tab" onConfigure={openLook} configureLabel="Change in Look">
          {frame("type", undefined, 160)}
        </DesignCard>
        <DesignCard id="shape" title="Shape & style" group="Foundation" note="Corners and density here; the surface style is set in Look" onConfigure={() => setEditor({ kind: "shape" })}>
          {frame("shape", ["fl-btn", "ui-field", "fl-ctl-badge", "fl-ctl-switch", "fl-card"], 120)}
        </DesignCard>

        {blocks.map((b) => (
          <DesignCard
            key={b.block}
            id={b.block}
            title={blockLabel(lib, b.block)}
            group="Component"
            note={[`.${b.block}`, b.uses ? `${b.uses} use${b.uses === 1 ? "" : "s"}` : "not used yet", b.modifiers.length ? `variants: ${b.modifiers.join(", ")}` : ""].filter(Boolean).join(" · ")}
            onConfigure={() => setEditor({ kind: "block", block: b.block })}
          >
            {frame("blocks", [b.block], 90)}
          </DesignCard>
        ))}
      </div>

      {editor?.kind === "shape" ? (
        <ControlsEditor title="Shape & style" projectId={projectId} theme={theme} only={["corners", "density"]} onDraft={setDraft} onClose={close} preview={frame("shape", ["fl-btn", "ui-field", "fl-ctl-badge", "fl-ctl-switch", "fl-card"], 260)} />
      ) : null}
      {editor?.kind === "block" && componentStyleSpec(editor.block) ? (
        <ComponentEditor projectId={projectId} block={editor.block} onCss={setComponentCss} onClose={close} preview={frame("blocks", [editor.block], 260)} />
      ) : editor?.kind === "block" ? (
        <ControlsEditor
          title={blockLabel(lib, editor.block)}
          projectId={projectId}
          theme={theme}
          only={["corners", "density"]}
          onDraft={setDraft}
          onClose={close}
          note="This part of the layout follows the shared settings below, so the app stays consistent."
          preview={frame("blocks", [editor.block], 260)}
        />
      ) : null}
    </div>
  );
}

function DesignCard({ id, title, group, note, onConfigure, configureLabel = "Configure", children }: { id: string; title: string; group: string; note: string; onConfigure: () => void; configureLabel?: string; children: React.ReactNode }) {
  return (
    <section className="section dcard" id={`dcard-${id}`} aria-labelledby={`dcard-${id}-title`}>
      <div className="section__head">
        <h4 className="section__title" id={`dcard-${id}-title`}>
          {title}
        </h4>
        <span className="label">{group}</span>
        <button type="button" className="btn btn--sm dcard__configure" data-cp={`configure-${id}`} onClick={onConfigure}>
          <SlidersHorizontal size={13} aria-hidden="true" /> {configureLabel}
        </button>
      </div>
      <div className="section__body dcard__body">
        <div className="dcard__stage">{children}</div>
        <p className="dcard__note muted">{note}</p>
      </div>
    </section>
  );
}

/** Modal frame shared by every editor: title, the editor's controls on the left, a live preview on the right. */
function EditorModal({ title, onClose, footer, preview, children }: { title: string; onClose: () => void; footer?: React.ReactNode; preview: React.ReactNode; children: React.ReactNode }) {
  return (
    <Modal onClose={onClose} labelledBy="deditor-title" className="dmodal">
      <div className="dmodal__box">
        <header className="dmodal__head">
          <h2 id="deditor-title">{title}</h2>
          <button type="button" className="dmodal__close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="dmodal__body">
          <div className="dmodal__controls">{children}</div>
          <div className="dmodal__preview">
            <span className="label">Preview</span>
            {preview}
          </div>
        </div>
        {footer ? <footer className="dmodal__foot">{footer}</footer> : null}
      </div>
    </Modal>
  );
}

function ControlsEditor({ title, projectId, theme, only, onDraft, onClose, preview, note }: { title: string; projectId: string; theme: PreviewTheme; only: ControlSection[]; onDraft: (v: Record<string, string>) => void; onClose: () => void; preview: React.ReactNode; note?: string }) {
  return (
    <EditorModal title={title} onClose={onClose} preview={preview} footer={<button type="button" className="btn btn--primary" onClick={onClose}>Done</button>}>
      {note ? <p className="dmodal__note muted">{note}</p> : null}
      <DesignControls projectId={projectId} theme={theme} onDraft={onDraft} only={only} />
    </EditorModal>
  );
}

// ───────────────────────── Colors ─────────────────────────

/**
 * The 60/30/10 rule for the secondary: harmonies traced from the primary (accent) as swatches to pick, how the chosen
 * secondary fits (and a note when it clashes or had to be nudged for contrast), and a strip showing the split.
 */
function SecondaryHarmonies({ primary, secondary, tokens, dark, onPick }: { primary: string; secondary?: string; tokens: Record<string, string>; dark: boolean; onPick: (hex: string) => void }) {
  const options = useMemo(() => harmonies(primary), [primary]);
  const fit = secondary ? secondaryFit(secondary, primary) : undefined;
  const used = secondary ? secondaryTokens(secondary, dark ? "dark" : "light", { surface: tokens["--color-surface"], text: tokens["--color-text"] }) : undefined;
  const fill = used?.["--color-secondary"];
  const nudged = secondary && fill && fill !== normalizeHex(secondary);
  return (
    <div className="harmony">
      <p className="dmodal__note muted">
        60/30/10: neutrals cover about 60% of a screen, the secondary about 30% (tinted panels, secondary buttons, tags), the primary only 10% (the main action, links, focus). These secondaries are traced from your primary.
      </p>
      <div className="harmony__list" role="group" aria-label="Secondary colors traced from the primary">
        {options.map((h) => {
          const on = secondary ? normalizeHex(secondary) === h.hex : false;
          return (
            <button key={`${h.kind}${h.offset}`} type="button" className={`harmony__opt${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => onPick(h.hex)} title={`${h.name} ${h.offset > 0 ? "+" : ""}${h.offset}° · ${h.hex}`}>
              <span className="harmony__swatch" style={{ background: h.hex }} aria-hidden="true" />
              <span className="harmony__name">
                {h.name} <span className="muted mono">{h.offset > 0 ? "+" : "−"}{Math.abs(h.offset)}°</span>
              </span>
              <span className="harmony__why muted">{h.why}</span>
            </button>
          );
        })}
      </div>
      {fit ? (
        <p className={`harmony__fit${fit.clash ? " is-warn" : ""}`} role={fit.clash ? "status" : undefined}>
          {fit.clash ?? (fit.harmony ? `${fit.harmony.name} to your primary (${fit.delta > 0 ? "+" : ""}${fit.delta}°), so the two belong together.` : "A near-neutral secondary: it stays out of the primary's way.")}
        </p>
      ) : null}
      {nudged && used ? (
        <p className="harmony__fit is-warn">
          Used as {fill} in the {dark ? "dark" : "light"} theme so text and labels on it pass AA ({contrastRatio(used["--color-on-secondary"], fill)}:1).
        </p>
      ) : null}
      {used ? (
        <span className="harmony__split" aria-hidden="true">
          <i style={{ flexGrow: 6, background: tokens["--color-surface"] }} />
          <i style={{ flexGrow: 3, background: used["--color-secondary-surface"] }} />
          <i style={{ flexGrow: 1, background: tokens["--color-accent"] }} />
        </span>
      ) : null}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { primary: "Primary", secondary: "Secondary", tertiary: "Tertiary", "accent-1": "Accent 1", "accent-2": "Accent 2" };
const STATUS_LABEL: Record<StatusKind, string> = { success: "Success", warning: "Warning", error: "Error", info: "Info" };
const NEUTRAL_LABEL: Record<NeutralTone, string> = { brand: "Brand-tinted", warm: "Warm", cool: "Cool", pure: "Pure gray" };

function usePalette(projectId: string) {
  const r = useResource<{ config: PaletteConfig; saved: boolean }>(`/projects/${projectId}/design/palette`, [projectId]);
  useEffect(() => {
    window.addEventListener(STYLES_CHANGED, r.reload);
    return () => window.removeEventListener(STYLES_CHANGED, r.reload);
  }, [r.reload]);
  return r;
}

function RampRow({ label, ramp, base, sub }: { label: string; ramp: Ramp; base?: number; sub?: string }) {
  return (
    <div className="ramp">
      <span className="ramp__label">
        {label}
        {sub ? <span className="muted">{sub}</span> : null}
      </span>
      <span className="ramp__steps">
        {RAMP_STEPS.map((s) => (
          <span key={s} className={`ramp__step${s === base ? " is-base" : ""}`} style={{ background: ramp[s] }} title={`${s} · ${ramp[s]}`}>
            <span className="ramp__num" style={{ color: s >= 500 ? "#fff" : "#111" }}>
              {s}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

/** The Colors card: brand ramps, neutrals and status colors, and how many contrast checks pass. */
function PaletteSummary({ projectId, theme }: { projectId: string; theme: PreviewTheme }) {
  const { data } = usePalette(projectId);
  const palette = useMemo(() => (data ? buildPalette(data.config) : undefined), [data]);
  if (!palette) return <div className="dcard__loading muted">Reading colors…</div>;
  const audit = contrastAudit(palette, roleTokens(palette, theme === "dark"));
  const fails = audit.filter((c) => !c.pass).length;
  return (
    <div className="palette-sum">
      {palette.brand.map((b) => (
        <RampRow key={b.role} label={ROLE_LABEL[b.role]} sub={b.hex} ramp={b.ramp} base={b.baseStep} />
      ))}
      <RampRow label="Neutral" ramp={palette.neutral} />
      <div className="palette-sum__status">
        {STATUS_KINDS.map((k) => (
          <span key={k} className="palette-sum__chip">
            <span style={{ background: palette.status[k].hex }} aria-hidden="true" />
            {STATUS_LABEL[k]}
          </span>
        ))}
        <span className={`palette-sum__audit is-${fails ? "bad" : "ok"}`}>{fails ? `${fails} contrast check${fails === 1 ? "" : "s"} to fix` : `All ${audit.length} contrast checks pass`}</span>
      </div>
      {!data?.saved ? <p className="muted palette-sum__hint">Started from the app&apos;s accent color. Choose brand colors in Look.</p> : null}
    </div>
  );
}

/** A component's own options (after CSSVibes' component canvases), previewed live and saved as CSS in components.css. */
function ComponentEditor({ projectId, block, onCss, onClose, preview }: { projectId: string; block: string; onCss: (css: string) => void; onClose: () => void; preview: React.ReactNode }) {
  const spec = componentStyleSpec(block)!;
  const saved = useResource<ComponentStyleValues>(`/projects/${projectId}/design/component-styles`, [projectId]);
  const [values, setValues] = useState<Record<string, string>>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  useEffect(() => {
    if (saved.data && !values) setValues(saved.data[block] ?? {});
  }, [saved.data, values, block]);
  // The preview draws every saved component's settings, with this one's unsaved choices.
  useEffect(() => {
    if (saved.data && values) onCss(componentStylesCss({ ...saved.data, [block]: values }));
  }, [saved.data, values, block, onCss]);
  const pick = (o: string, c: string) => setValues((v) => ({ ...v, [o]: c }));
  const save = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      await post(`/projects/${projectId}/design/component-styles`, { block, values: values ?? {} });
      stylesChanged();
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const isDefault = spec.options.every((o) => (values?.[o.id] ?? o.default) === o.default);
  return (
    <EditorModal
      title={spec.title}
      onClose={onClose}
      preview={preview}
      footer={
        <>
          {msg ? <span className="dmodal__msg">{msg}</span> : <span className="muted dmodal__msg">Saved as CSS in the app&apos;s components.css, so every screen follows. You can undo it.</span>}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={busy || !values}>
            {busy ? "Saving…" : `Save ${spec.title.toLowerCase()}`}
          </button>
        </>
      }
    >
      {values ? (
        <>
          {spec.options.map((o) => {
            const cur = values[o.id] ?? o.default;
            return (
              <fieldset key={o.id} className="studio__sec">
                <legend>{o.label}</legend>
                <div className="studio__chips" role="radiogroup" aria-label={o.label}>
                  {o.choices.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={cur === c.id} className={`studio__chip${cur === c.id ? " is-on" : ""}`} onClick={() => pick(o.id, c.id)}>
                      {c.label}
                      {c.id === o.default ? <span className="studio__chip-note"> · kit</span> : null}
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <button type="button" className="btn btn--sm btn--ghost dmodal__reset" disabled={isDefault} onClick={() => setValues({})}>
            Back to the kit&apos;s look
          </button>
        </>
      ) : (
        <p className="muted">Reading this component&apos;s settings…</p>
      )}
    </EditorModal>
  );
}
