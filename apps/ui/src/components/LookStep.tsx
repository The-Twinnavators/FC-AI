/**
 * New build → Look and feel. When the PRD (or an attached stylesheet) doesn't set the app's look, the user picks one of
 * the visual design templates; either way they're asked which extras to include. Extras the PRD already mentions start
 * ticked.
 */
import { BUILD_EXTRAS, DESIGN_TEMPLATES, STYLE_VIBES, TEMPLATE_VIBES, designTemplate, vibeFromText, vibeTokens, type DesignTemplate, type ReferenceFile } from "@flowcode/contracts";

/** The surface style to preselect: one the PRD names, else the template's suggestion, else flat. */
export function suggestedVibe(refs: Pick<ReferenceFile, "role" | "content">[], template?: string): string {
  const prd = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n");
  return vibeFromText(prd)?.id ?? TEMPLATE_VIBES[template ?? ""] ?? "flat";
}

/** A design template's colours and radii as CSS custom properties, for previews. */
export function templateVars(t: DesignTemplate): Record<string, string> {
  const c = t.colors;
  return {
    "--color-bg": c.bg,
    "--color-surface": c.surface,
    "--color-text": c.text,
    "--color-border": c.border,
    "--color-border-strong": c.borderStrong,
    "--color-accent": c.accent,
    "--color-focus": c.focus,
    "--color-success": c.success,
    "--border-width": "1px",
    "--radius-md": `${t.radii[1]}px`,
    "--radius-lg": `${t.radii[2]}px`,
  };
}

/** A small card drawn with a vibe's surface tokens over a theme's colours (a template's, or an app's own). */
export function VibePreview({ vibe, colors }: { vibe: string; colors: Record<string, string> }) {
  const vars = { "--border-width": "1px", "--radius-md": "6px", "--radius-lg": "8px", ...colors, ...vibeTokens(vibe) } as React.CSSProperties;
  return (
    <span className="vibe-prev" style={vars} aria-hidden="true">
      <span className="vibe-prev__card">
        <i className="vibe-prev__line" />
        <i className="vibe-prev__line vibe-prev__line--short" />
        <span className="vibe-prev__btn" />
      </span>
    </span>
  );
}

/** The PRD (or an attached CSS file) already decides the colours. */
export function prdSetsLook(refs: Pick<ReferenceFile, "role" | "content">[]): boolean {
  if (refs.some((r) => r.role === "css")) return true;
  const prd = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n");
  return (prd.match(/#[0-9a-f]{6}\b/gi) ?? []).length >= 3;
}

/** Extras the PRD already asks for. */
export function extrasInPrd(refs: Pick<ReferenceFile, "role" | "content">[]): string[] {
  const prd = refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => r.content).join("\n");
  return prd ? BUILD_EXTRAS.filter((x) => x.match.test(prd)).map((x) => x.id) : [];
}

function Preview({ t }: { t: DesignTemplate }) {
  const c = t.colors;
  const r = t.radii;
  return (
    <span className="look-card__preview" aria-hidden="true" style={{ background: c.bg, color: c.text, fontFamily: t.fonts.sans }}>
      <span className="look-card__bar" style={{ background: c.surface, borderBottom: `1px solid ${c.border}` }}>
        <i style={{ background: c.accent, borderRadius: r[0] }} />
        <b style={{ background: c.textMuted, opacity: 0.5 }} />
      </span>
      <span className="look-card__body">
        <span className="look-card__title" style={{ fontFamily: t.fonts.display }}>
          Aa
        </span>
        <span className="look-card__lines">
          <b style={{ background: c.text, opacity: 0.75 }} />
          <b style={{ background: c.textMuted, opacity: 0.5, width: "70%" }} />
        </span>
        <span className="look-card__card" style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: r[2] }}>
          <span className="look-card__btn" style={{ background: c.accent, color: c.onAccent, borderRadius: r[1] }}>
            Button
          </span>
          <i style={{ background: c.success, borderRadius: 99 }} />
        </span>
      </span>
    </span>
  );
}

export function LookStep({
  refs,
  template,
  onTemplate,
  extras,
  onExtras,
  vibe,
  onVibe,
}: {
  refs: Pick<ReferenceFile, "role" | "content">[];
  template: string;
  onTemplate: (id: string) => void;
  extras: string[];
  onExtras: (ids: string[]) => void;
  vibe: string;
  onVibe: (id: string) => void;
}) {
  const previewT = (!prdSetsLook(refs) && designTemplate(template)) || DESIGN_TEMPLATES[0];
  const fromPrd = prdSetsLook(refs);
  const asked = new Set(extrasInPrd(refs));
  return (
    <div className="look">
      {fromPrd ? (
        <p className="look__note">Your PRD sets the colours, so FlowCode uses them. You can still add the extras below.</p>
      ) : (
        <fieldset className="look__styles">
          <legend className="look__legend">Choose a visual style</legend>
          <p className="look__hint">Your PRD doesn&apos;t set colours or fonts, so pick a starting look. You can change any colour or font later in Styles.</p>
          <div className="look__grid" role="radiogroup" aria-label="Visual style">
            {DESIGN_TEMPLATES.map((t) => (
              <label key={t.id} className={`look-card${template === t.id ? " is-on" : ""}`}>
                <input type="radio" name="look-template" value={t.id} checked={template === t.id} onChange={() => onTemplate(t.id)} className="sr-only" />
                <Preview t={t} />
                <span className="look-card__name">
                  {t.name}
                  {t.dark ? <span className="look-card__tag">Dark</span> : null}
                </span>
                <span className="look-card__desc">{t.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="look__styles">
        <legend className="look__legend">Choose a surface style</legend>
        <p className="look__hint">How cards, panels and buttons are drawn: flat, glass, soft, bold outlines and more. It works with any colours.</p>
        <div className="look__grid look__grid--vibes" role="radiogroup" aria-label="Surface style">
          {STYLE_VIBES.map((v) => (
            <label key={v.id} className={`look-card${vibe === v.id ? " is-on" : ""}`}>
              <input type="radio" name="look-vibe" value={v.id} checked={vibe === v.id} onChange={() => onVibe(v.id)} className="sr-only" />
              <VibePreview vibe={v.id} colors={templateVars(previewT)} />
              <span className="look-card__name">{v.name}</span>
              <span className="look-card__desc">{v.description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="look__extras">
        <legend className="look__legend">Would you like to add:</legend>
        <ul className="look__checks">
          {BUILD_EXTRAS.map((x) => (
            <li key={x.id}>
              <label className="look-check">
                <input type="checkbox" checked={extras.includes(x.id)} onChange={(e) => onExtras(e.target.checked ? [...extras, x.id] : extras.filter((y) => y !== x.id))} />
                <span>
                  <span className="look-check__label">
                    {x.label}
                    {asked.has(x.id) ? <span className="look-card__tag">In your PRD</span> : null}
                  </span>
                  <span className="look-check__hint">{x.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="look__hint">Animations always respect the &ldquo;reduce motion&rdquo; setting on the viewer&apos;s device.</p>
      </fieldset>
    </div>
  );
}
