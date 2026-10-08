/**
 * Component library: every ready section FlowCode can build with, rendered live from templates/library with the
 * prototype starter's tokens and FlowCode's bundled fonts, in any visual style. Each preview runs in its own frame so
 * the section's styles never mix with FlowCode's. Read-only: builds copy the sections they need.
 */
import { useEffect, useMemo, useState } from "react";
import { DESIGN_TEMPLATES, LIBRARY_SECTIONS, SECTION_CATEGORIES, type LibrarySection, type SectionCategory } from "@flowcode/contracts";
import { LibModal, CopyButton } from "../components/LibModal";


const sources = import.meta.glob<string>("../../../../templates/library/sections/*.tsx", { query: "?raw", import: "default" });
const key = (id: string) => `../../../../templates/library/sections/${id}.tsx`;

/**
 * One section, live, in its own window (section-preview.html), so it behaves exactly as in a built app: its dialogs,
 * focus and Escape act on that window, never on FlowCode's page. The preview page reports its height.
 */
function SectionFrame({ id, styleId, title }: { id: string; styleId: string; title: string }) {
  const [height, setHeight] = useState(360);
  // Until the section has drawn, the frame shows the loading bar (never an empty white box).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; id?: string; height?: number };
      if (m?.type === "fl-section-height" && m.id === id && typeof m.height === "number") (setHeight(Math.max(120, Math.ceil(m.height))), setReady(true));
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, [id]);
  const src = new URL(`section-preview.html?id=${encodeURIComponent(id)}&style=${encodeURIComponent(styleId)}`, document.baseURI).href;
  return (
    <div className={`cl-frame-wrap${ready ? "" : " is-loading"}`}>
      {ready ? null : (
        <span className="cl-frame-load sug-progress__bar" role="progressbar" aria-label={`Loading the ${title} preview`}>
          <span className="is-indeterminate" />
        </span>
      )}
      <iframe className="cl-frame" title={`${title} preview`} src={src} loading="lazy" style={{ height }} />
    </div>
  );
}

export function ComponentsView() {
  const [cat, setCat] = useState<SectionCategory | "all">("all");
  const [styleId, setStyleId] = useState(() => {
    try {
      const saved = localStorage.getItem("flowcode.componentsStyle");
      return DESIGN_TEMPLATES.some((t) => t.id === saved) ? saved! : DESIGN_TEMPLATES[0]!.id;
    } catch {
      return DESIGN_TEMPLATES[0]!.id;
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
  // Choosing a shelf goes back up to the top of the list (just under the top bar); already above it, it stays put.
  const pick = (id: SectionCategory | "all") => {
    setCat(id);
    const top = document.getElementById("cl-room-top");
    if (top && top.getBoundingClientRect().top < 72) top.scrollIntoView({ block: "start", behavior: "smooth" });
  };
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
          {LIBRARY_SECTIONS.length} sections, components and page templates written for FlowCode. Sources and credits are in the Third-party notices.
        </p>
        <label className="cl-style">
          <span className="muted">Preview in</span>
          <select className="select" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
            {DESIGN_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div id="cl-room-top" className="skill-room cl-room">
        <nav className="lib-shelves skill-room__nav" aria-label="Section categories">
          <button type="button" className="lib-shelf" aria-current={cat === "all"} onClick={() => pick("all")}>
            <span className="lib-shelf__label">All sections</span>
            <span className="lib-shelf__count">{LIBRARY_SECTIONS.length}</span>
          </button>
          {(["template", "page", "app"] as const).filter((g) => SECTION_CATEGORIES.some((c) => c.group === g && counts.get(c.id))).map((g) => (
            <div key={g} className="cl-group">
              <p className="lib-shelves__heading">{g === "template" ? "Page templates" : g === "page" ? "Page sections" : "App components"}</p>
              {SECTION_CATEGORIES.filter((c) => c.group === g && counts.get(c.id)).map((c) => (
                <button key={c.id} type="button" className="lib-shelf" aria-current={cat === c.id} onClick={() => pick(c.id)}>
                  <span className="lib-shelf__label">{c.label}</span>
                  <span className="lib-shelf__count">{counts.get(c.id)}</span>
                </button>
              ))}
            </div>
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
