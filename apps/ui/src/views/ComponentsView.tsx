/**
 * Component library: every ready section FlowCode can build with, rendered live from templates/library with the
 * prototype starter's tokens and FlowCode's bundled fonts, in any visual style. Each preview runs in its own frame so
 * the section's styles never mix with FlowCode's. Read-only: builds copy the sections they need.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DESIGN_TEMPLATES, LIBRARY_SECTIONS, PROPOSED_SECTIONS, SECTION_CATEGORIES, type LibrarySection, type SectionCategory } from "@flowcode/contracts";
import { LibModal, CopyButton } from "../components/LibModal";
import { PreviewSizes, deviceWidth, type Device } from "../components/PreviewSizes";
import { Search } from "lucide-react";


const sources = import.meta.glob<string>("../../../../templates/library/sections/*.tsx", { query: "?raw", import: "default" });
const key = (id: string) => `../../../../templates/library/sections/${id}.tsx`;

/**
 * One section, live, in its own window (section-preview.html), so it behaves exactly as in a built app: its dialogs,
 * focus and Escape act on that window, never on FlowCode's page. The preview page reports its height.
 */
function SectionFrame({ id, styleId, title, width }: { id: string; styleId: string; title: string; width: number }) {
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
    <div className={`cl-frame-wrap${ready ? "" : " is-loading"}${width ? " cl-frame-wrap--device" : ""}`}>
      {ready ? null : (
        <span className="cl-frame-load sug-progress__bar" role="progressbar" aria-label={`Loading the ${title} preview`}>
          <span className="is-indeterminate" />
        </span>
      )}
      <iframe className="cl-frame" title={`${title} preview`} src={src} loading="lazy" style={{ height, ...(width ? { width } : {}) }} />
    </div>
  );
}

/** A tile's picture: the section drawn at desktop width (1280px) and scaled down to fit the tile, not interactive. */
function SectionThumb({ id, styleId, title }: { id: string; styleId: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  // Each thumbnail is a whole page, so it starts only when its tile comes near the screen (the browser's own lazy
  // loading starts frames a couple of screens away, which on a long shelf is most of them) and then stays.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1280));
    ro.observe(el);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => (ro.disconnect(), io.disconnect());
  }, []);
  const src = new URL(`section-preview.html?id=${encodeURIComponent(id)}&style=${encodeURIComponent(styleId)}`, document.baseURI).href;
  return (
    <div ref={box} className="cl-thumb" aria-hidden="true">
      {near ? <iframe className="cl-thumb__frame" title={`${title} thumbnail`} src={src} tabIndex={-1} style={{ transform: `scale(${scale})` }} /> : null}
    </div>
  );
}

export function ComponentsView() {
  // "proposed": new pieces waiting for the owner's approval, not in the library yet.
  const [cat, setCat] = useState<SectionCategory | "all" | "proposed">("all");
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
  const [showCode, setShowCode] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
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
  const catOrder = useMemo(() => new Map(SECTION_CATEGORIES.map((c, i) => [c.id, i])), []);
  // Search: every word must appear in the piece's name, description, tags or shelf (within the shelf you're on).
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const label = (c: string) => SECTION_CATEGORIES.find((x) => x.id === c)?.label ?? c;
  const matches = (x: LibrarySection) => !words.length || words.every((w) => `${x.name} ${x.description} ${x.tags.join(" ")} ${label(x.category)}`.toLowerCase().includes(w));
  // The grid follows the shelves beside it: categories in their listed order, and inside one, the order they are
  // written in (sort is stable). On a single shelf every piece shares a category, so this changes nothing there.
  const byCategory = (a: LibrarySection, b: LibrarySection) => (catOrder.get(a.category) ?? SECTION_CATEGORIES.length) - (catOrder.get(b.category) ?? SECTION_CATEGORIES.length);
  const shown = (cat === "proposed" ? PROPOSED_SECTIONS.filter(matches) : LIBRARY_SECTIONS.filter((s) => (cat === "all" || s.category === cat) && matches(s))).sort(byCategory);
  // Previous and next in the details modal, through the pieces on the current shelf (← and → keys too).
  const at = open ? shown.findIndex((x) => x.id === open.id) : -1;
  const step = (d: number) => {
    if (at < 0 || !shown.length) return;
    setShowCode(false);
    setOpen(shown[(at + d + shown.length) % shown.length]);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || (t instanceof Element && t.closest("input, textarea, select, [contenteditable=true]"))) return;
      if (e.key === "ArrowRight") (e.preventDefault(), step(1));
      else if (e.key === "ArrowLeft") (e.preventDefault(), step(-1));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  // Choosing a shelf goes back up to the top of the list (just under the top bar); already above it, it stays put.
  const pick = (id: SectionCategory | "all" | "proposed") => {
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
            The ready sections FlowCode builds pages from. Each one takes on a project&apos;s colors, fonts, spacing and corners from its design tokens, so the same section fits any style. Pick a style below to see.
          </p>
        </div>
      </header>

      <div className="library-grid__bar cl-bar">
        <p className="muted">
          {LIBRARY_SECTIONS.length} sections, components and page templates written for FlowCode. Sources and credits are in the Third-party notices.
        </p>
        <label className="cl-search">
          <Search size={14} aria-hidden="true" />
          <input className="input" type="search" placeholder="Search the library: cart, pricing, dark, table…" aria-label="Search the library" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} />
          {q ? <span className="muted cl-search__n" aria-live="polite">{shown.length} found</span> : null}
        </label>
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
          {PROPOSED_SECTIONS.length ? (
            <button type="button" className="lib-shelf lib-shelf--proposed" aria-current={cat === "proposed"} onClick={() => pick("proposed")}>
              <span className="lib-shelf__label">Needs your approval</span>
              <span className="lib-shelf__count">{PROPOSED_SECTIONS.length}</span>
            </button>
          ) : null}
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
        {!shown.length ? (
          <div className="cl-none" role="status">
            <p>
              Nothing matches “{q}”{cat === "proposed" ? " in the pieces waiting for approval" : cat !== "all" ? ` in ${label(cat)}` : ""}.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {cat !== "all" ? (
                <button type="button" className="btn btn--sm" onClick={() => setCat("all")}>
                  Search every shelf
                </button>
              ) : null}
              <button type="button" className="btn btn--sm" onClick={() => setQ("")}>
                Clear search
              </button>
            </div>
          </div>
        ) : null}
        <ul className="cl-grid">
          {cat === "proposed" ? (
            <li className="cl-proposed-note" role="note">
              New pieces, not in the library yet: builds don't use them until you approve them. Open one to try it, then say which to approve and which to change or drop.
            </li>
          ) : null}
          {shown.map((s) => (
            <li key={s.id}>
              <button type="button" className="cl-tile" onClick={() => (setShowCode(false), setOpen(s))} aria-label={`${s.name}: open details`}>
                <SectionThumb id={s.id} styleId={styleId} title={s.name} />
                <span className="cl-tile__text">
                  <strong>{s.name}</strong>
                  <span className="muted">{s.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {open ? (
        <LibModal
          label={`${SECTION_CATEGORIES.find((c) => c.id === open.category)?.label ?? "Section"} · ${showCode ? "code" : "preview"}`}
          onClose={() => setOpen(undefined)}
          toolbar={showCode ? undefined : <PreviewSizes value={device} onChange={setDevice} />}
          scrollKey={`${open.id}:${showCode ? "code" : "preview"}`}
          actions={
            <>
              <span className="cl-detail__nav">
                <button type="button" className="btn btn--sm" onClick={() => step(-1)} aria-label="Previous piece" title="Previous (←)">
                  ← Previous
                </button>
                <span className="muted" aria-live="polite">
                  {at + 1} of {shown.length}
                </span>
                <button type="button" className="btn btn--sm" onClick={() => step(1)} aria-label="Next piece" title="Next (→)">
                  Next →
                </button>
              </span>
              <button type="button" className="btn btn--sm" aria-pressed={showCode} onClick={() => setShowCode((v) => !v)}>
                {showCode ? "Show preview" : "View code"}
              </button>
              {showCode && code ? <CopyButton text={code} label="Copy code" /> : null}
            </>
          }
        >
          <div className="cl-detail">
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{open.name}</h2>
              <p className="dim" style={{ margin: "4px 0 0" }}>
                {open.description} File: <span className="mono">templates/library/sections/{open.id}.tsx</span>
              </p>
            </div>
            {showCode ? <pre className="cl-code">{code ?? "Loading…"}</pre> : <SectionFrame id={open.id} styleId={styleId} title={open.name} width={deviceWidth(device)} />}
          </div>
        </LibModal>
      ) : null}
    </div>
  );
}
