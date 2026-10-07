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
  normalizeHex,
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
import { TypographyEditor } from "./TypographyEditor";
import { componentStyleSpec, componentStylesCss, type ComponentStyleValues } from "@flowcode/contracts";
import { StyleSheetFrame, stylesChanged, STYLES_CHANGED, type Library } from "./ComponentSheet";
import { DesignControls, DesignComponentsBar, type ControlSection } from "./DesignStudio";
import { COMPONENT_CATALOG, KIT_BLOCK } from "./componentPickerData";
import type { PreviewTheme } from "./PreviewTheme";

/** The kit's components (ui-…). App-only classes (.muted, .shell) and the bare input aren't components to configure. */
const isComponent = (block: string) => /^ui-/.test(block) && !["ui-input", "ui-skip", "ui-sr-only", "ui-narrow"].includes(block);

type Editor = { kind: "colours" } | { kind: "type" } | { kind: "shape" } | { kind: "block"; block: string };

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

  const nav: Array<{ group: string; items: Array<{ id: string; label: string }> }> = [
    { group: "Foundations", items: [{ id: "colours", label: "Colours" }, { id: "type", label: "Typography" }, { id: "shape", label: "Shape & style" }] },
    { group: "Components", items: blocks.map((b) => ({ id: b.block, label: blockLabel(lib, b.block) })) },
  ];
  const go = (id: string) => document.getElementById(`dcard-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="dboard">
      <nav className="dboard__nav" aria-label="Design system">
        {nav.map((g) => (
          <div key={g.group} className="dboard__nav-group">
            <span className="label">{g.group}</span>
            {g.items.map((it) => (
              <a key={it.id} href={`#dcard-${it.id}`} onClick={(e) => (e.preventDefault(), go(it.id))}>
                {it.label}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="dboard__cards">
        {/* What's in this design, and adding more, first: everything below follows from it. */}
        <div className="dboard__group-head dboard__group-head--top">
          <h3 className="dboard__group-title">Components in this design</h3>
          <DesignComponentsBar projectId={projectId} used={used.filter(isComponent)} onChange={onShown} />
        </div>
        <DesignCard id="colours" title="Colours" group="Foundation" note="5 brand colours, 10 shades each; neutrals and status colours follow them" onConfigure={() => setEditor({ kind: "colours" })}>
          <PaletteSummary projectId={projectId} theme={theme} />
        </DesignCard>
        <DesignCard id="type" title="Typography" group="Foundation" note="Heading, body and code fonts; size, weight and line height for each level" onConfigure={() => setEditor({ kind: "type" })}>
          {frame("type", undefined, 160)}
        </DesignCard>
        <DesignCard id="shape" title="Shape & style" group="Foundation" note="Surface style, corners and density" onConfigure={() => setEditor({ kind: "shape" })}>
          {frame("shape", ["ui-btn", "ui-field", "ui-badge", "ui-switch", "ui-card"], 120)}
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

      {editor?.kind === "colours" ? <ColoursEditor projectId={projectId} theme={theme} onDraft={setDraft} onClose={close} preview={frame("palette", ["ui-btn", "ui-badge", "ui-notice", "ui-field", "ui-switch"], 260)} /> : null}
      {editor?.kind === "type" ? (
        <TypographyEditor
          projectId={projectId}
          onDraft={setDraft}
          onClose={close}
          frame={(controls, footer) => (
            <EditorModal title="Typography" onClose={close} footer={footer} preview={frame("type", undefined, 260)}>
              {controls}
            </EditorModal>
          )}
        />
      ) : null}
      {editor?.kind === "shape" ? (
        <ControlsEditor title="Shape & style" projectId={projectId} theme={theme} only={["style", "corners", "density"]} onDraft={setDraft} onClose={close} preview={frame("shape", ["ui-btn", "ui-field", "ui-badge", "ui-switch", "ui-card"], 260)} />
      ) : null}
      {editor?.kind === "block" && componentStyleSpec(editor.block) ? (
        <ComponentEditor projectId={projectId} block={editor.block} onCss={setComponentCss} onClose={close} preview={frame("blocks", [editor.block], 260)} />
      ) : editor?.kind === "block" ? (
        <ControlsEditor
          title={blockLabel(lib, editor.block)}
          projectId={projectId}
          theme={theme}
          only={["style", "corners", "density"]}
          onDraft={setDraft}
          onClose={close}
          note="This part of the layout follows the shared settings below, so the app stays consistent."
          preview={frame("blocks", [editor.block], 260)}
        />
      ) : null}
    </div>
  );
}

function DesignCard({ id, title, group, note, onConfigure, children }: { id: string; title: string; group: string; note: string; onConfigure: () => void; children: React.ReactNode }) {
  return (
    <section className="section dcard" id={`dcard-${id}`} aria-labelledby={`dcard-${id}-title`}>
      <div className="section__head">
        <h4 className="section__title" id={`dcard-${id}-title`}>
          {title}
        </h4>
        <span className="label">{group}</span>
        <button type="button" className="btn btn--sm dcard__configure" onClick={onConfigure}>
          <SlidersHorizontal size={13} aria-hidden="true" /> Configure
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

// ───────────────────────── Colours ─────────────────────────

const ROLE_LABEL: Record<string, string> = { primary: "Primary", secondary: "Secondary", tertiary: "Tertiary", "accent-1": "Accent 1", "accent-2": "Accent 2" };
const STATUS_LABEL: Record<StatusKind, string> = { success: "Success", warning: "Warning", error: "Error", info: "Info" };
const NEUTRAL_LABEL: Record<NeutralTone, string> = { brand: "Brand-tinted", warm: "Warm", cool: "Cool", pure: "Pure grey" };

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

/** The Colours card: brand ramps, neutrals and status colours, and how many contrast checks pass. */
function PaletteSummary({ projectId, theme }: { projectId: string; theme: PreviewTheme }) {
  const { data } = usePalette(projectId);
  const palette = useMemo(() => (data ? buildPalette(data.config) : undefined), [data]);
  if (!palette) return <div className="dcard__loading muted">Reading colours…</div>;
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
      {!data?.saved ? <p className="muted palette-sum__hint">Started from the app&apos;s accent colour. Configure to choose your brand colours.</p> : null}
    </div>
  );
}

function ColoursEditor({ projectId, theme, onDraft, onClose, preview }: { projectId: string; theme: PreviewTheme; onDraft: (v: Record<string, string>) => void; onClose: () => void; preview: React.ReactNode }) {
  const { data } = usePalette(projectId);
  const [cfg, setCfg] = useState<PaletteConfig>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [auditTheme, setAuditTheme] = useState<"light" | "dark">(theme);
  useEffect(() => {
    if (data && !cfg) setCfg(data.config);
  }, [data, cfg]);
  const palette = useMemo(() => (cfg ? buildPalette(cfg) : undefined), [cfg]);
  // The preview follows every change before it's saved.
  useEffect(() => {
    if (palette) onDraft({ ...rampTokens(palette), ...roleTokens(palette, theme === "dark") });
  }, [palette, theme, onDraft]);
  if (!cfg || !palette) return null;

  const setBrand = (i: number, patch: Partial<BrandColor>) => setCfg({ ...cfg, brand: cfg.brand.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const addBrand = () => {
    // A starting suggestion: the primary's complement, so a new colour is never a copy.
    const base = palette.brand[0]?.ramp[500] ?? "#6d28d9";
    const h = parseInt(base.slice(1), 16);
    const comp = `#${(0xffffff ^ h).toString(16).padStart(6, "0")}`;
    setCfg({ ...cfg, brand: [...cfg.brand, { hex: comp, role: BRAND_ROLES[cfg.brand.length] }] });
  };
  const removeBrand = (i: number) => setCfg({ ...cfg, brand: cfg.brand.filter((_, j) => j !== i).map((b, j) => ({ ...b, role: BRAND_ROLES[j] })) });
  const setStatus = (k: StatusKind, hex?: string) => setCfg({ ...cfg, status: { ...cfg.status, [k]: hex } });
  const swatches = [
    ...palette.brand.map((b) => ({ label: ROLE_LABEL[b.role], hex: b.hex })),
    ...STATUS_KINDS.map((k) => ({ label: STATUS_LABEL[k], hex: palette.status[k].hex })),
    { label: "Neutral 50", hex: palette.neutral[50] },
    { label: "Neutral 500", hex: palette.neutral[500] },
    { label: "Neutral 900", hex: palette.neutral[900] },
  ];
  const tokens = roleTokens(palette, auditTheme === "dark");
  const audit = contrastAudit(palette, tokens);

  const save = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      await post(`/projects/${projectId}/design/palette`, { ...cfg, status: Object.fromEntries(Object.entries(cfg.status ?? {}).filter(([, v]) => v)) });
      stylesChanged();
      onClose();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <EditorModal
      title="Colours"
      onClose={onClose}
      preview={preview}
      footer={
        <>
          {msg ? <span className="dmodal__msg">{msg.text}</span> : <span className="muted dmodal__msg">Saving updates the app&apos;s colour tokens for light and dark. You can undo it.</span>}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save colours"}
          </button>
        </>
      }
    >
      <fieldset className="studio__sec">
        <legend>Brand colours</legend>
        {cfg.brand.map((b, i) => {
          const hex = normalizeHex(b.hex) ?? "#000000";
          const p = palette.brand[i];
          return (
            <div key={i} className="brand-row">
              <span className="brand-row__name">{ROLE_LABEL[b.role]}</span>
              <ColorPicker value={hex} label={ROLE_LABEL[b.role]} swatches={swatches} onChange={(v) => setBrand(i, { hex: v })} />
              {cfg.brand.length > 1 ? (
                <button type="button" className="dmodal__icon-btn" onClick={() => removeBrand(i)} aria-label={`Remove ${ROLE_LABEL[b.role]}`}>
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
              {p ? <RampRow label="" ramp={p.ramp} base={p.baseStep} /> : null}
            </div>
          );
        })}
        {cfg.brand.length < MAX_BRAND_COLORS ? (
          <button type="button" className="btn btn--sm brand-add" onClick={addBrand}>
            <Plus size={13} aria-hidden="true" /> Add a brand colour
          </button>
        ) : null}
      </fieldset>

      <fieldset className="studio__sec">
        <legend>Suggested neutrals</legend>
        <p className="dmodal__note muted">Picked to go with your brand colours. Choose a different tone if you like.</p>
        <div className="studio__chips" role="group" aria-label="Neutral tone">
          {(Object.keys(NEUTRAL_LABEL) as NeutralTone[]).map((t) => (
            <button key={t} type="button" className={`studio__chip${(cfg.neutral ?? "brand") === t ? " is-on" : ""}`} aria-pressed={(cfg.neutral ?? "brand") === t} onClick={() => setCfg({ ...cfg, neutral: t })}>
              {NEUTRAL_LABEL[t]}
            </button>
          ))}
        </div>
        <RampRow label="" ramp={palette.neutral} />
      </fieldset>

      <fieldset className="studio__sec">
        <legend>Status colours</legend>
        <p className="dmodal__note muted">Picked from your brand colours when one fits, otherwise made to sit with your primary. Set one to override it.</p>
        {STATUS_KINDS.map((k) => {
          const st = palette.status[k];
          return (
            <div key={k} className="brand-row">
              <span className="brand-row__name">
                {STATUS_LABEL[k]}
                <span className="muted">{st.from === "brand" ? "from your brand colours" : st.from === "you" ? "set by you" : "picked to match your primary"}</span>
              </span>
              <span className="brand-row__tools">
                {st.from === "you" ? (
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => setStatus(k, undefined)}>
                    Reset
                  </button>
                ) : null}
                <ColorPicker value={st.hex} label={STATUS_LABEL[k]} swatches={swatches} onChange={(v) => setStatus(k, v)} />
              </span>
              <RampRow label="" ramp={st.ramp} />
            </div>
          );
        })}
      </fieldset>

      <fieldset className="studio__sec">
        <legend>Contrast</legend>
        <div className="studio__chips" role="group" aria-label="Theme to check">
          {(["light", "dark"] as const).map((t) => (
            <button key={t} type="button" className={`studio__chip${auditTheme === t ? " is-on" : ""}`} aria-pressed={auditTheme === t} onClick={() => setAuditTheme(t)}>
              {t === "light" ? "Light theme" : "Dark theme"}
            </button>
          ))}
        </div>
        <ul className="audit">
          {audit.map((c) => (
            <li key={c.id} className={`audit__row is-${c.pass ? "ok" : "bad"}`}>
              <span className="audit__sample" style={{ color: c.fg, background: c.bg }} aria-hidden="true">
                Aa
              </span>
              <span className="audit__label">{c.label}</span>
              <span className="audit__ratio mono">
                {c.ratio}:1 · {contrastLevel(c.ratio)}
              </span>
              {!c.pass && c.suggestion ? <span className="audit__fix">Use shade {c.suggestion.step} ({c.suggestion.hex}) → {c.suggestion.ratio}:1</span> : null}
            </li>
          ))}
        </ul>
        <p className="dmodal__note muted">The app&apos;s colour roles are chosen from these shades to pass: text 4.5:1, focus rings and borders 3:1.</p>
      </fieldset>
    </EditorModal>
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
