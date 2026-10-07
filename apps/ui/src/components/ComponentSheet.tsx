/**
 * Styles → Components: a visual style sheet of the reusable parts a project already has.
 *  - Building blocks: CSS class families (button, field, dialog…) with their variants, rendered from real usage in the
 *    app's code using the app's own stylesheets, inside a sandboxed frame (no scripts run).
 *  - Components: the app's React components with their props, what they're for and where they're used.
 * Coding agents receive the same inventory as a short "reuse these" list, so they build from it instead of rewriting.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useResource } from "../api";
import { vibeTokens } from "@flowcode/contracts";
import { Empty } from "./ui";
import { SkeletonBlock } from "./motion";
import { type PreviewTheme } from "./PreviewTheme";
import { DesignBoard } from "./DesignBoard";

interface Sample {
  label: string;
  html: string;
}
export interface Primitive {
  block: string;
  file: string;
  line: number;
  modifiers: string[];
  elements: string[];
  uses: number;
  samples: Sample[];
}
interface Component {
  name: string;
  file: string;
  line: number;
  kind: "component" | "page";
  summary?: string;
  props: Array<{ name: string; optional: boolean; type?: string }>;
  uses: number;
  usedIn: string[];
  example?: string;
}
export interface Library {
  primitives: Primitive[];
  components: Component[];
  css: string;
  cssFiles: string[];
  brief: string;
}

/** Fired after a style edit (Text, Tokens, Surface, undo) so views showing the app's styles redraw. */
export const STYLES_CHANGED = "fc:styles-changed";
export const stylesChanged = () => window.dispatchEvent(new CustomEvent(STYLES_CHANGED));

const openFile = (file: string) => window.dispatchEvent(new CustomEvent("fc:open-file", { detail: file }));
const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Sections of the style sheet, in reading order. A building block goes in the first section whose test matches. */
const SECTIONS: Array<{ id: string; title: string; hint: string; test: (p: Primitive) => boolean }> = [
  { id: "actions", title: "Actions", hint: "Buttons, links and toggles", test: (p) => /button|btn|link|toggle|tab|chip|pill|views/.test(p.block) || p.samples.every((x) => /^<(button|a)\b/.test(x.html)) },
  { id: "forms", title: "Forms", hint: "Fields, labels, inputs and their errors", test: (p) => /field|input|form|select|check|radio|search/.test(p.block) || p.samples.some((x) => /^<(input|select|textarea|label)\b/.test(x.html)) },
  { id: "overlays", title: "Overlays", hint: "Dialogs, sheets and what sits behind them", test: (p) => /dialog|modal|backdrop|popover|sheet|drawer|toast|menu|privacy/.test(p.block) },
  { id: "feedback", title: "Text and feedback", hint: "Muted text, errors, hints and loading states", test: (p) => /error|hint|loading|muted|notice|alert|empty|status|badge|title|subtitle|text/.test(p.block) },
  { id: "layout", title: "Layout and surfaces", hint: "Page structure, panels and regions", test: () => true },
];

/** The style sheet page rendered inside the frame: sections, each building block with its variants. */
/**
 * The sheet document. `vibe` previews the app's own building blocks in another surface style (after CSSVibes) by
 * setting that style's surface tokens over the app's stylesheet; nothing in the app changes until "Use this style".
 */
/** Colour tokens shown at the top of the sheet, in the order people think about them. */
const SWATCHES: Array<[string, string]> = [
  ["--color-bg", "Page"],
  ["--color-surface", "Surface"],
  ["--color-surface-sunken", "Sunken"],
  ["--color-text", "Text"],
  ["--color-text-muted", "Muted text"],
  ["--color-border", "Border"],
  ["--color-accent", "Accent"],
  ["--color-on-accent", "On accent"],
  ["--color-focus", "Focus"],
  ["--color-success", "Success"],
  ["--color-danger", "Danger"],
];

/**
 * Text and Colours, drawn with the app's own classes and tokens, so the sheet shows the type and palette set in
 * Styles → Text and Tokens before the building blocks that use them.
 */
function foundations(css: string, part: "all" | "type" | "colours" = "all"): string {
  const has = (name: string) => css.includes(`${name}:`);
  const swatches = SWATCHES.filter(([n]) => has(n))
    .map(([n, label]) => `<figure class="fc-sheet__swatch"><span style="background: var(${n})"></span><figcaption>${label}<br><code>${n}</code></figcaption></figure>`)
    .join("");
  const type: Array<[string, string]> = [
    ['<p class="ui-hero__title" style="margin:0">Display</p>', "Display · --font-display, --text-3xl"],
    ['<h1 class="ui-page-header__title" style="margin:0">Page title</h1>', "Page title (h1)"],
    ['<h2 class="ui-section__title" style="margin:0">Section title</h2>', "Section title (h2)"],
    ['<h3 class="ui-card__title" style="margin:0">Card title</h3>', "Card title (h3)"],
    ['<p style="margin:0; max-width: var(--measure, 68ch)">Body text reads at a comfortable size and line length, in the app\'s main font.</p>', "Body · --font-sans, --text-md"],
    ['<p class="ui-page-header__desc" style="margin:0">Supporting text for descriptions and hints.</p>', "Supporting · --color-text-muted"],
    ['<span class="ui-field__label">Field label</span>', "Label · --text-sm"],
  ];
  const typeHtml = `<div class="fc-sheet__type">${type.map(([html, label]) => `<div class="fc-sheet__type-row"><div>${html}</div><span>${label}</span></div>`).join("")}</div>`;
  if (part === "type") return typeHtml;
  if (part === "colours") return `<div class="fc-sheet__swatches">${swatches}</div>`;
  return `<div class="fc-sheet__section">
  <div class="fc-sheet__head"><h2>Text</h2><span>From Styles → Text: fonts, sizes and weights</span></div>
  <div class="fc-sheet__type">${type.map(([html, label]) => `<div class="fc-sheet__type-row"><div>${html}</div><span>${label}</span></div>`).join("")}</div>
</div>
${swatches ? `<div class="fc-sheet__section">
  <div class="fc-sheet__head"><h2>Colours</h2><span>From Styles → Tokens</span></div>
  <div class="fc-sheet__swatches">${swatches}</div>
</div>` : ""}`;
}

/** Google Fonts the app loads (Styles → Text), so the sheet draws in the same fonts as the app. */
const fontLinks = (fonts: string[]) =>
  fonts
    .filter((f) => /^[A-Za-z0-9 ]+$/.test(f))
    .map((f) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap">`)
    .join("");

/** What a sheet frame draws: everything, or one card's part (the type scale, the colours, or just some blocks' samples). */
/** The kit's markup for blocks an app may not use yet (same classes as src/components/ui), for the Shape preview. */
const KIT_SAMPLES: Record<string, string> = {
  "ui-btn": `<button type="button" class="ui-btn ui-btn--primary ui-btn--md">Save changes</button>`,
  "ui-field": `<div class="ui-field" style="min-width:180px"><label class="ui-field__label">Email</label><input class="ui-input" value="ada@example.com" readonly /></div>`,
  "ui-badge": `<span class="ui-badge ui-badge--accent">New</span>`,
  "ui-switch": `<button type="button" role="switch" aria-checked="true" class="ui-switch"><span class="ui-switch__thumb"></span><span class="ui-switch__text">On</span></button>`,
  "ui-card": `<div class="ui-card" style="min-width:180px"><h3 class="ui-card__title">Card</h3><div class="ui-card__body">Surfaces use these corners.</div></div>`,
};

/** "shape": one sample per shown block, side by side, so a foundation card shows the shape across components. */
export type SheetPart = "all" | "type" | "colours" | "blocks" | "palette" | "shape";

function sheetDoc(lib: Library, vibe?: string, fonts: string[] = [], draft: Record<string, string> = {}, shown?: string[], part: SheetPart = "all", componentCss?: string): string {
  const placed = new Map<string, Primitive[]>();
  for (const p of lib.primitives.filter((x) => x.samples.length && (!shown || shown.includes(x.block)))) {
    const sec = SECTIONS.find((x) => x.test(p))!;
    placed.set(sec.id, [...(placed.get(sec.id) ?? []), p]);
  }
  const block = (p: Primitive) => {
    const meta = [
      `${p.uses} use${p.uses === 1 ? "" : "s"}`,
      p.modifiers.length ? `variants: ${p.modifiers.join(", ")}` : "",
      p.elements.length ? `parts: ${p.elements.join(", ")}` : "",
    ].filter(Boolean);
    return `<section class="fc-sheet__block">
  <div class="fc-sheet__name"><b>.${escHtml(p.block)}</b>${meta.map((m) => `<span>${escHtml(m)}</span>`).join("")}</div>
  <div class="fc-sheet__samples">${p.samples
    .map((x) => `<figure class="fc-sheet__sample"><div class="fc-sheet__stage">${x.html}</div><figcaption>${escHtml(x.label)}</figcaption></figure>`)
    .join("")}</div>
</section>`;
  };
  // A card's frame: only its part, without the sheet's section headings.
  const samplesOnly = () => [...placed.values()].flat().map((p) => `<div class="fc-sheet__samples">${p.samples.map((x) => `<figure class="fc-sheet__sample"><div class="fc-sheet__stage">${x.html}</div><figcaption>${escHtml(x.label)}</figcaption></figure>`).join("")}</div>`).join("");
  // One sample of each block, in the order asked for (button, field, card…), on one stage. A block the app's code
  // doesn't use yet is drawn from the kit's own markup, so the shape shows across components from the first step.
  const oneEach = () =>
    `<div class="fc-sheet__samples">${(shown ?? [...placed.values()].flat().map((p) => p.block))
      .flatMap((b) => {
        const html = lib.primitives.find((x) => x.block === b && x.samples.length)?.samples[0].html ?? (lib.css.includes(`.${b}`) ? KIT_SAMPLES[b] : undefined);
        return html ? [`<figure class="fc-sheet__sample"><div class="fc-sheet__stage">${html}</div><figcaption>${escHtml(b.replace(/^ui-/, ""))}</figcaption></figure>`] : [];
      })
      .join("")}</div>`;
  // "palette": the colour swatches, then the given blocks drawn in those colours (the Colours editor's preview).
  const body = part === "type" || part === "colours" ? foundations(lib.css, part) : part === "blocks" ? samplesOnly() : part === "shape" ? oneEach() : part === "palette" ? foundations(lib.css, "colours") + samplesOnly() : foundations(lib.css) + SECTIONS.filter((x) => placed.get(x.id)?.length)
    .map(
      (x) => `<div class="fc-sheet__section">
  <div class="fc-sheet__head"><h2>${x.title}</h2><span>${x.hint} · ${placed.get(x.id)!.length}</span></div>
  ${placed.get(x.id)!.map(block).join("\n")}
</div>`,
    )
    .join("\n");
  // Sheet chrome uses its own prefixed classes and a neutral font so the app's styles don't restyle the labels.
  const vibeCss = vibe ? `:root{${Object.entries(vibeTokens(vibe)).map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
    // Unsaved studio changes (a slider being dragged) drawn over the app's values.
  const draftCss = Object.keys(draft).length ? `:root{${Object.entries(draft).map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
  // Every web font the frame needs: the app's saved ones, any its CSS imports (an @import that isn't first in the
  // merged sheet is ignored by the browser), and the first family of each font token being edited right now.
  const imported = [...lib.css.matchAll(/@import\s+url\(["']?https:\/\/fonts\.googleapis\.com\/css2\?([^"')]+)/g)].flatMap((m) => [...m[1].matchAll(/family=([^&:]+)/g)].map((f) => decodeURIComponent(f[1]).replace(/\+/g, " ")));
  const drafted = Object.entries(draft)
    .filter(([k]) => /^--font-/.test(k))
    .map(([, v]) => v.split(",")[0].trim().replace(/^["']|["']$/g, ""));
  // Up to the closing ");": the URL itself has semicolons (wght@400;500;600).
  // While a component is being configured, its unsaved CSS replaces the saved settings block.
  const saved = componentCss === undefined ? lib.css : lib.css.replace(/\/\* FlowCode component settings[\s\S]*?End of FlowCode component settings \*\//, "");
  const css = saved.replace(/@import\s+url\(["']?https:\/\/fonts\.googleapis\.com[^)]*\)\s*;/g, "");
  return `<!doctype html><html><head><meta charset="utf-8">${fontLinks([...new Set([...fonts, ...imported, ...drafted])])}<style>${css}</style><style>${vibeCss}${draftCss}${componentCss ?? ""}</style><style>
  html, body { margin: 0 !important; padding: 0 !important; min-height: 0 !important; }
  body { padding: 4px 20px 20px !important; background-color: var(--color-bg, #fff) !important; background-image: var(--page-backdrop, none) !important; background-attachment: fixed !important; }
  .fc-sheet__section { padding: 20px 0 4px; border-top: 2px solid #d5dbe6; }
  .fc-sheet__section:first-child { border-top: 0; }
  .fc-sheet__head { display: flex; align-items: baseline; gap: 12px; margin: 0 0 4px; }
  .fc-sheet__head h2 { margin: 0 !important; padding: 0 !important; font: 650 15px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif !important; letter-spacing: 0 !important; color: var(--color-text, #1d2433) !important; text-transform: none !important; }
  .fc-sheet__head span { font: 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; color: #6b7487; }
  .fc-sheet__block { padding: 16px 0; border-top: 1px solid #e4e8ef; }
  .fc-sheet__head + .fc-sheet__block { border-top: 0; padding-top: 10px; }
  .fc-sheet__name { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #6b7487; margin: 0 0 10px; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
  .fc-sheet__name b { font-weight: 650; color: var(--color-text, #1d2433); }
  .fc-sheet__samples { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
  .fc-sheet__sample { margin: 0; display: grid; gap: 6px; min-width: 120px; max-width: 100%; }
  .fc-sheet__stage { position: relative; transform: translateZ(0); overflow: hidden; padding: 16px; border: 1px dashed color-mix(in srgb, var(--color-text, #1d2433) 18%, transparent); border-radius: 6px; max-width: 560px; max-height: 320px; }
  .fc-sheet__stage > * { position: relative !important; inset: auto !important; }
  .fc-sheet__type { display: grid; gap: 4px; padding-top: 10px; }
  .fc-sheet__type-row { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 16px; align-items: baseline; padding: 10px 0; border-top: 1px solid #e4e8ef; }
  .fc-sheet__type-row:first-child { border-top: 0; }
  .fc-sheet__type-row > span, .fc-sheet__swatch figcaption { font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #8a94a6; }
  .fc-sheet__swatches { display: flex; flex-wrap: wrap; gap: 14px; padding-top: 10px; }
  .fc-sheet__swatch { margin: 0; display: grid; gap: 6px; width: 104px; }
  .fc-sheet__swatch span { display: block; height: 48px; border-radius: 6px; border: 1px solid rgba(0, 0, 0, 0.12); }
  .fc-sheet__swatch code { font: inherit; }
  .fc-sheet__sample figcaption { font: 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #8a94a6; }
</style></head><body>${body}</body></html>`;
}

export function StyleSheetFrame({ lib, vibe, fonts, theme, draft, shown, part = "all", minHeight = 200, componentCss }: { lib: Library; vibe?: string; fonts?: string[]; theme: PreviewTheme; draft?: Record<string, string>; shown?: string[]; part?: SheetPart; minHeight?: number; componentCss?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const doc = useMemo(() => sheetDoc(lib, vibe, fonts, draft, shown, part, componentCss), [lib, vibe, fonts, draft, shown, part, componentCss]);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    // Same-origin (no scripts allowed inside), so the frame's height can be read to fit its content.
    const fit = () => {
      const body = frame.contentDocument?.body;
      if (body) setHeight(Math.min(6000, Math.max(minHeight, body.scrollHeight + 8)));
    };
    frame.addEventListener("load", fit);
    return () => frame.removeEventListener("load", fit);
  }, [doc]);
  return <iframe ref={ref} className="sheet-frame" title="Building blocks rendered with the app's stylesheets" sandbox="allow-same-origin" srcDoc={doc} style={{ height, colorScheme: theme }} />;
}

export function ComponentSheet({ projectId }: { projectId: string }) {
  const { data, error, reload, loading } = useResource<Library>(`/projects/${projectId}/components`, [projectId]);
  const styles = useResource<{ text?: { loadedFonts: string[] } }>(`/projects/${projectId}/styles`, [projectId]);
  // The Styles page shows the app's own (default) theme; the light/dark switch was removed here at the user's request.
  const theme: PreviewTheme = "light";
  // A change in the studio, Tokens or Surface redraws the sheet, so it always matches them.
  useEffect(() => {
    const again = () => (reload(), styles.reload());
    window.addEventListener(STYLES_CHANGED, again);
    return () => window.removeEventListener(STYLES_CHANGED, again);
  }, [reload, styles]);
  const [showPages, setShowPages] = useState(false);
  const used = useMemo(() => (data?.primitives ?? []).filter((p) => p.uses > 0 && p.samples.length).map((p) => p.block), [data]);
  if (!data) return <div style={{ padding: 16 }}>{error ? <p className="notice notice--bad" role="alert">{error}</p> : <SkeletonBlock rows={5} label="Reading components" />}</div>;
  const comps = data.components.filter((c) => c.kind === "component");
  const pages = data.components.filter((c) => c.kind === "page");
  if (!data.primitives.length && !data.components.length)
    return (
      <div style={{ padding: 16 }}>
        <Empty title="No reusable parts yet" action={<button className="btn" onClick={reload}>Re-scan</button>}>
          This view lists the CSS classes and React components the app uses, so the builder reuses them. Nothing was found in this project&apos;s source yet.
        </Empty>
      </div>
    );
  return (
    <div className="sheet">
      <div className="styles-panel__bar">
        <span className="muted" style={{ fontSize: 12.5 }}>
          {data.primitives.length} building blocks · {comps.length} components{pages.length ? ` · ${pages.length} pages` : ""}
        </span>
        <span className="sheet__note muted">The builder gets this list with every interface step, so it reuses these instead of writing new ones.</span>
        <button className="btn btn--sm" onClick={reload} disabled={loading} aria-label="Re-scan components">
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      {data.primitives.length ? (
        <section className="styles-group" aria-labelledby="sheet-blocks">
          <h3 id="sheet-blocks" className="sr-only">
            Design
          </h3>
          <DesignBoard projectId={projectId} lib={data} theme={theme} fonts={styles.data?.text?.loadedFonts} used={used} />
        </section>
      ) : null}

      {comps.length ? (
        <section className="styles-group" aria-labelledby="sheet-comps">
          <h3 id="sheet-comps" className="styles-group__title">
            Components <span className="muted">{comps.length}</span>
          </h3>
          <ul className="sheet-comps">
            {comps.map((c) => (
              <ComponentCard key={c.file + c.name} c={c} />
            ))}
          </ul>
        </section>
      ) : null}

      {pages.length ? (
        <section className="styles-group" aria-labelledby="sheet-pages">
          <h3 id="sheet-pages" className="styles-group__title">
            Pages <span className="muted">{pages.length}</span>
            <button type="button" className="btn btn--sm btn--ghost" style={{ marginLeft: 8 }} aria-expanded={showPages} onClick={() => setShowPages((v) => !v)}>
              {showPages ? "Hide" : "Show"}
            </button>
          </h3>
          {showPages ? (
            <ul className="sheet-comps">
              {pages.map((c) => (
                <ComponentCard key={c.file + c.name} c={c} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ComponentCard({ c }: { c: Component }) {
  return (
    <li className="sheet-comp">
      <div className="sheet-comp__top">
        <strong className="sheet-comp__name mono">&lt;{c.name}&gt;</strong>
        <span className="muted">
          {c.uses ? `used in ${c.usedIn.length} file${c.usedIn.length === 1 ? "" : "s"}` : "not used yet"}
        </span>
      </div>
      {c.summary ? <p className="sheet-comp__summary">{c.summary}</p> : null}
      {c.props.length ? (
        <p className="sheet-comp__props">
          {c.props.map((p) => (
            <code key={p.name} title={p.type}>
              {p.name}
              {p.optional ? "?" : ""}
            </code>
          ))}
        </p>
      ) : null}
      {c.example ? <pre className="sheet-comp__example mono">{c.example}</pre> : null}
      <button type="button" className="link-btn sheet-comp__file" onClick={() => openFile(c.file)}>
        {c.file}:{c.line}
      </button>
    </li>
  );
}
