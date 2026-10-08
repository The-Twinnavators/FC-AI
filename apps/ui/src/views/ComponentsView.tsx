/**
 * Component library: every ready section FlowCode can build with, rendered live from templates/library with the
 * prototype starter's tokens and FlowCode's bundled fonts, in any visual style. Each preview runs in its own frame so
 * the section's styles never mix with FlowCode's. Read-only: builds copy the sections they need.
 */
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BUNDLED_FONTS, DESIGN_TEMPLATES, LIBRARY_SECTIONS, SECTION_CATEGORIES, fontFaceCss, type LibrarySection, type SectionCategory } from "@flowcode/contracts";
import { LibModal, CopyButton } from "../components/LibModal";
import tokensCss from "../../../../templates/react-vite-starter/src/styles/tokens.css?raw";
import libraryCss from "../../../../templates/library/library.css?raw";

const modules = import.meta.glob<{ default: ComponentType }>("../../../../templates/library/sections/*.tsx");
const sources = import.meta.glob<string>("../../../../templates/library/sections/*.tsx", { query: "?raw", import: "default" });
const key = (id: string) => `../../../../templates/library/sections/${id}.tsx`;

/** The CSS a preview frame gets: fonts, the starter's tokens, an optional visual style on top, and the library. */
function frameCss(styleId: string): string {
  const fonts = fontFaceCss(BUNDLED_FONTS, (file) => new URL(`fonts/${file}.woff2`, document.baseURI).href);
  const t = DESIGN_TEMPLATES.find((x) => x.id === styleId);
  const style = t
    ? `:root{--color-bg:${t.colors.bg};--color-surface:${t.colors.surface};--color-surface-sunken:${t.colors.surfaceSunken};--color-text:${t.colors.text};--color-text-muted:${t.colors.textMuted};--color-border:${t.colors.border};--color-border-strong:${t.colors.borderStrong};--color-accent:${t.colors.accent};--color-accent-hover:${t.colors.accentHover};--color-on-accent:${t.colors.onAccent};--color-focus:${t.colors.focus};--color-success:${t.colors.success};--color-danger:${t.colors.danger};--font-sans:${t.fonts.sans};--font-display:${t.fonts.display};--radius-sm:${t.radii[0]}px;--radius-md:${t.radii[1]}px;--radius-lg:${t.radii[2]}px;--radius-xl:${t.radii[3]}px;color-scheme:${t.dark ? "dark" : "light"}}`
    : "";
  return `${fonts}\n${tokensCss}\n${style}\nhtml,body{margin:0;overflow:hidden;background:var(--color-bg);color:var(--color-text);font-family:var(--font-sans);font-size:var(--text-md);-webkit-font-smoothing:antialiased}*,*::before,*::after{box-sizing:border-box}a{color:inherit}\n${libraryCss}`;
}

/** One section rendered live in its own frame, sized to its content. */
function SectionFrame({ id, styleId, title }: { id: string; styleId: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const root = useRef<Root | undefined>(undefined);
  const [height, setHeight] = useState(360);
  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const doc = f.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style id="fl-css"></style></head><body><div id="root"></div></body></html>`);
    doc.close();
    const host = doc.getElementById("root")!;
    root.current = createRoot(host);
    let alive = true;
    void modules[key(id)]?.().then((m) => alive && root.current?.render(<m.default />));
    const ro = new ResizeObserver(() => setHeight(Math.max(120, doc.documentElement.scrollHeight)));
    ro.observe(doc.body);
    ro.observe(host);
    return () => {
      alive = false;
      ro.disconnect();
      const r = root.current;
      root.current = undefined;
      setTimeout(() => r?.unmount(), 0);
    };
  }, [id]);
  useEffect(() => {
    const el = frame.current?.contentDocument?.getElementById("fl-css");
    if (el) el.textContent = frameCss(styleId);
  }, [styleId, id]);
  return <iframe ref={frame} className="cl-frame" title={`${title} preview`} style={{ height }} />;
}

export function ComponentsView() {
  const [cat, setCat] = useState<SectionCategory | "all">("all");
  const [styleId, setStyleId] = useState(() => {
    try {
      return localStorage.getItem("flowcode.componentsStyle") ?? "";
    } catch {
      return "";
    }
  });
  const [open, setOpen] = useState<LibrarySection>();
  const [code, setCode] = useState<string>();
  useEffect(() => {
    try {
      localStorage.setItem("flowcode.componentsStyle", styleId);
    } catch {
      /* kept for this visit */
    }
  }, [styleId]);
  useEffect(() => {
    setCode(undefined);
    if (open) void sources[key(open.id)]?.().then(setCode);
  }, [open]);
  const counts = useMemo(() => new Map(SECTION_CATEGORIES.map((c) => [c.id, LIBRARY_SECTIONS.filter((s) => s.category === c.id).length])), []);
  const shown = LIBRARY_SECTIONS.filter((s) => cat === "all" || s.category === cat);
  return (
    <div className="page page-enter cl-page">
      <header className="page__head">
        <div>
          <span className="label">Intelligence</span>
          <h1 className="page__title">Component library</h1>
          <p className="lrc__meta">
            The ready sections FlowCode builds pages from. Each one takes on a project&apos;s colours, fonts, spacing and corners from its design tokens, so the same section fits any style. Pick a style below to see.
          </p>
        </div>
      </header>

      <div className="library-grid__bar cl-bar">
        <p className="muted">
          {LIBRARY_SECTIONS.length} sections in {SECTION_CATEGORIES.length} categories. Written for FlowCode; patterns informed by open-source libraries (see Third-party notices).
        </p>
        <label className="cl-style">
          <span className="muted">Preview in</span>
          <select className="select" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
            <option value="">The starter&apos;s default style</option>
            {DESIGN_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="skill-room cl-room">
        <nav className="lib-shelves skill-room__nav" aria-label="Section categories">
          <button type="button" className="lib-shelf" aria-current={cat === "all"} onClick={() => setCat("all")}>
            <span className="lib-shelf__label">All sections</span>
            <span className="lib-shelf__count">{LIBRARY_SECTIONS.length}</span>
          </button>
          <p className="lib-shelves__heading">Categories</p>
          {SECTION_CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="lib-shelf" aria-current={cat === c.id} onClick={() => setCat(c.id)}>
              <span className="lib-shelf__label">{c.label}</span>
              <span className="lib-shelf__count">{counts.get(c.id)}</span>
            </button>
          ))}
        </nav>
        <ul className="cl-list">
          {shown.map((s) => (
            <li key={s.id} className="cl-item">
              <div className="cl-item__head">
                <div>
                  <strong>{s.name}</strong>
                  <p className="muted">{s.description}</p>
                </div>
                <button type="button" className="btn btn--sm" onClick={() => setOpen(s)}>
                  View code
                </button>
              </div>
              <SectionFrame id={s.id} styleId={styleId} title={s.name} />
            </li>
          ))}
        </ul>
      </div>

      {open ? (
        <LibModal label="Section · code" onClose={() => setOpen(undefined)} actions={code ? <CopyButton text={code} label="Copy code" /> : undefined}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{open.name}</h2>
              <p className="dim" style={{ margin: "4px 0 0" }}>
                {open.description} File: <span className="mono">templates/library/sections/{open.id}.tsx</span>
              </p>
            </div>
            <pre className="cl-code">{code ?? "Loading…"}</pre>
          </div>
        </LibModal>
      ) : null}
    </div>
  );
}
