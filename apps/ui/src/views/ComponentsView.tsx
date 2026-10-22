/**
 * Component library: every ready section FlowCode can build with, rendered live from templates/library with the
 * prototype starter's tokens and FlowCode's bundled fonts, in any visual style. Each preview runs in its own frame so
 * the section's styles never mix with FlowCode's. Read-only: builds copy the sections they need.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DESIGN_TEMPLATES, LIBRARY_SECTIONS, PROPOSED_SECTIONS, isNewPiece, SECTION_CATEGORIES, STYLE_VIBES, TEMPLATE_VIBES, levelOf, relationsOf, usedBy, versionsOf, type LibrarySection, type SectionCategory } from "@flowcode/contracts";
import { LibModal, CopyButton } from "../components/LibModal";
import { PreviewSizes, deviceWidth, type Device } from "../components/PreviewSizes";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import "../styles/cl-details.css";
import { post } from "../api";
import { ExternalSources } from "../components/ExternalSources";


const sources = import.meta.glob<string>("../../../../templates/library/sections/*.tsx", { query: "?raw", import: "default" });
const key = (id: string) => `../../../../templates/library/sections/${id}.tsx`;

/**
 * One section, live, in its own window (section-preview.html), so it behaves exactly as in a built app: its dialogs,
 * focus and Escape act on that window, never on FlowCode's page. The preview page reports its height.
 */
/**
 * The frame takes the room the sheet leaves it (the stylesheet sizes it from the window), so it is a viewport rather
 * than a measurement of its own contents. Sizing it from the content made vh circular: a piece asking for 88vh grew
 * the frame, which grew the 88vh, which grew the frame. landing-prelaunch settled at 3631px for 435px of content.
 */

function SectionFrame({ id, look, title, width, focus }: { id: string; look: string; title: string; width: number; focus?: string }) {
  // Until the section has drawn, the frame shows the loading bar (never an empty white box). The page still reports
  // its height; it is what tells us it has drawn, and no longer what sets the frame's size.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; id?: string; height?: number };
      if (m?.type === "fl-section-height" && m.id === id && typeof m.height === "number") setReady(true);
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, [id]);
  const src = new URL(`section-preview.html?id=${encodeURIComponent(id)}&${look}${focus ? `&focus=${encodeURIComponent(focus)}` : ""}`, document.baseURI).href;
  return (
    <div className={`cl-frame-wrap${ready ? "" : " is-loading"}${width ? " cl-frame-wrap--device" : ""}`}>
      {ready ? null : (
        <span className="cl-frame-load sug-progress__bar" role="progressbar" aria-label={`Loading the ${title} preview`}>
          <span className="is-indeterminate" />
        </span>
      )}
      <iframe className="cl-frame" title={`${title} preview`} src={src} loading="lazy" style={width ? { width } : undefined} />
    </div>
  );
}

/** A tile's picture: the section drawn at desktop width (1280px) and scaled down to fit the tile, not interactive. */
function SectionThumb({ id, look, title, focus }: { id: string; look: string; title: string; focus?: string }) {
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
  const src = new URL(`section-preview.html?id=${encodeURIComponent(id)}&${look}${focus ? `&focus=${encodeURIComponent(focus)}` : ""}`, document.baseURI).href;
  return (
    <div ref={box} className="cl-thumb" aria-hidden="true">
      {near ? <iframe className="cl-thumb__frame" title={`${title} thumbnail`} src={src} tabIndex={-1} style={{ transform: `scale(${scale})` }} /> : null}
    </div>
  );
}

/** The library's shelves by catalog level: whole pages, page sections, patterns, then components. */
const LEVELS = [
  ["template", "Page templates"],
  ["block", "Page sections"],
  ["pattern", "Patterns"],
  ["component", "Components"],
] as const;
/** A piece's level group: its catalog ID's level (token sheets sit with the components). */
const levelGroup = (s: LibrarySection) => {
  const l = s.ref ? levelOf(s.ref) : undefined;
  return l === "template" || l === "block" || l === "pattern" ? l : "component";
};
/** A component piece's own component: its version's or variant's base ID (c.card@tick and c.background.mesh sit with
 * c.card and c.background); token sheets are their own. */
const OWNER = new Map(LIBRARY_SECTIONS.flatMap((s) => (s.ref ? (s.also ?? []).map((a) => [a.ref, s.ref!] as const) : [])));
const componentOf = (s: LibrarySection) => {
  const ref = s.versionOf ?? s.ref;
  if (!ref) return s.category;
  if (ref.startsWith("tokens.")) return ref;
  const base = ref.split("@")[0]!.split(".").slice(0, 2).join(".");
  // A version of a secondary ID (c.avatar-stack on the avatar piece) shelves with that piece's component.
  return OWNER.get(base) ?? base;
};
/**
 * A library entry: a piece, or one variant of a piece shown on its own (focus is the variant's catalog ID; the preview
 * page hides the rest of the piece's sheet). Variants that already have a piece of their own (p.auth-form.sign-up) are
 * not repeated.
 */
type Item = LibrarySection & { focus?: string; variantOf?: string };
const uid = (x: Item) => (x.focus ? `${x.id}#${x.focus}` : x.id);
const OWN_PIECES = new Set(LIBRARY_SECTIONS.map((s) => s.ref).filter(Boolean));
const variantItems = (s: LibrarySection): Item[] =>
  s.ref
    ? [...(s.variants ?? []).map((v) => ({ v, of: s.ref! })), ...(s.also ?? []).flatMap((a) => (a.variants ?? []).map((v) => ({ v, of: a.ref })))]
        .filter(({ v }) => !OWN_PIECES.has(v.ref))
        .map(({ v, of }) => ({
          ...s,
          // The sheet that draws it: its own piece's, or the one the catalog names (the vertical tabs).
          id: (v as { sheet?: string }).sheet ?? s.id,
          ref: v.ref,
          focus: v.ref,
          variantOf: of,
          variants: undefined,
          also: undefined,
          versionOf: undefined,
          uses: undefined,
          name: `${of.startsWith("c.") ? componentName(of) : s.name.split(":")[0]} · ${v.ref.slice(of.length + 1).replace(/-/g, " ")}`,
          description: `${v.look.charAt(0).toUpperCase()}${v.look.slice(1)}${/[.!?]$/.test(v.look) ? "" : "."}`,
          tags: [...s.tags, v.ref.slice(of.length + 1)],
        }))
    : [];

/** Components get one shelf each (the component and its versions); everything else shelves by category. */
const shelfOf = (s: LibrarySection) => (levelGroup(s) === "component" ? `component:${componentOf(s)}` : `${levelGroup(s)}:${s.category}`);
const NAMES: Record<string, string> = { "c.liquid-glass": "Liquid glass", "c.search": "Search fields", "c.fab": "Floating action buttons", "c.ai-indicator": "AI indicators", "c.kpi": "KPI cards", "c.area-chart": "Area charts", "c.chat-bubble": "Chat bubbles", "c.media-frame": "Media frames", "c.list-row": "List rows", "c.empty-state": "Empty states", "c.text-field": "Text fields", "c.button-group": "Button groups", "c.animated-number": "Animated numbers", "c.avatar-stack": "Avatar stacks", "c.toast-stack": "Toast stacks", "c.accordion": "Accordions", "c.breadcrumbs": "Breadcrumbs", "c.progress": "Progress", "c.quantity": "Quantity steppers", "c.segmented": "Segmented controls", "c.skeleton": "Skeletons", "c.switch": "Switches", "c.tabs": "Tabs", "c.pagination": "Pagination", "c.background": "Backgrounds", "c.combobox": "Combo boxes", "c.checkbox": "Checkboxes and radios", "c.select": "Selects and combo boxes", "c.avatar": "Avatars", "tokens.focus-ring": "Focus rings (tokens)", "tokens.motion": "Motion (tokens)" };
/** A component shelf's name: "c.badge" → "Badges". */
const plural = (w: string) => (/[^aeiou]y$/i.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/i.test(w) ? `${w}es` : `${w}s`);
const componentName = (ref: string) => NAMES[ref] ?? ((w) => w.charAt(0).toUpperCase() + w.slice(1))(plural(ref.replace(/^c./, "").replace(/-/g, " ")));
/** Every entry on the shelves: each piece followed by its variants. */
const ALL_ITEMS: Item[] = LIBRARY_SECTIONS.flatMap((p) => [p, ...variantItems(p)]);

export function ComponentsView() {
  // "proposed": new pieces waiting for the owner's approval, not in the library yet.
  // A shelf is a catalog level and a category in it ("component:forms"), or all pieces, or the approval queue.
  // On arrival: the approval queue while anything waits in it, else the shelf last viewed, else all pieces.
  const [cat, setCat] = useState<string>(() => {
    if (PROPOSED_SECTIONS.length) return "proposed";
    try {
      const saved = localStorage.getItem("flowcode.componentsShelf") ?? "";
      return saved === "external" || ALL_ITEMS.some((s) => shelfOf(s) === saved) ? saved : "all";
    } catch {
      return "all";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("flowcode.componentsShelf", cat);
    } catch {
      /* kept for this visit */
    }
  }, [cat]);
  const [styleId, setStyleId] = useState(() => {
    try {
      const saved = localStorage.getItem("flowcode.componentsStyle");
      return DESIGN_TEMPLATES.some((t) => t.id === saved) ? saved! : DESIGN_TEMPLATES[0]!.id;
    } catch {
      return DESIGN_TEMPLATES[0]!.id;
    }
  });
  // The surface style (outlines, shadows, corners): "" is the chosen style's own, as a build gets it.
  const [surface, setSurface] = useState(() => {
    try {
      const saved = localStorage.getItem("flowcode.componentsSurface") ?? "";
      return STYLE_VIBES.some((v) => v.id === saved) ? saved : "";
    } catch {
      return "";
    }
  });
  const look = `style=${encodeURIComponent(styleId)}${surface ? `&surface=${encodeURIComponent(surface)}` : ""}`;
  const [open, setOpen] = useState<Item>();
  const [code, setCode] = useState<string>();
  const [showCode, setShowCode] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  // The piece's description and catalog rows: folded away so the preview gets the room, open on request.
  const [details, setDetails] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("flowcode.componentsStyle", styleId);
      localStorage.setItem("flowcode.componentsSurface", surface);
    } catch {
      /* kept for this visit */
    }
  }, [styleId, surface]);
  useEffect(() => {
    setCode(undefined);
    if (open) void sources[key(open.id)]?.().then(setCode);
  }, [open]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of ALL_ITEMS) m.set(shelfOf(s), (m.get(shelfOf(s)) ?? 0) + 1);
    return m;
  }, []);
  // Shelves holding pieces that joined the library in the last two weeks, and how many.
  const newCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of ALL_ITEMS) if (isNewPiece(s.id)) m.set(shelfOf(s), (m.get(shelfOf(s)) ?? 0) + 1);
    return m;
  }, []);
  const newTotal = useMemo(() => ALL_ITEMS.filter((s) => isNewPiece(s.id)).length, []);
  // A small sparkle beside the shelf's name (inside the label, so the shelf's name/count layout is unchanged).
  const NewBadge = ({ n }: { n?: number }) =>
    n ? (
      <span className="cl-new" title={`${n} new in the last two weeks`}>
        <Sparkles size={10} strokeWidth={2.5} aria-hidden="true" />
        <span className="sr-only">, {n} new</span>
      </span>
    ) : null;
  const catOrder = useMemo(() => new Map(SECTION_CATEGORIES.map((c, i) => [c.id, i])), []);
  // Search: every word must appear in the piece's name, description, tags or shelf (within the shelf you're on).
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const label = (c: string) => (c.startsWith("component:") ? componentName(c.slice(10)) : SECTION_CATEGORIES.find((x) => x.id === c.split(":").pop())?.label ?? c);
  // Component shelves in alphabetical order.
  const componentShelves = useMemo(() => [...counts.keys()].filter((k) => k.startsWith("component:")).sort((a, b) => label(a).localeCompare(label(b))), [counts]);
  const matches = (x: Item) => !words.length || words.every((w) => `${x.name} ${x.description} ${x.tags.join(" ")} ${x.ref ?? ""} ${label(x.category)}`.toLowerCase().includes(w));
  // The grid follows the shelves beside it: categories in their listed order, and inside one, the order they are
  // written in (sort is stable). On a single shelf every piece shares a category, so this changes nothing there.
  const byCategory = (a: LibrarySection, b: LibrarySection) =>
    LEVELS.findIndex(([l]) => l === levelGroup(a)) - LEVELS.findIndex(([l]) => l === levelGroup(b)) ||
    (levelGroup(a) === "component"
      ? label(shelfOf(a)).localeCompare(label(shelfOf(b))) || Number(!!a.versionOf) - Number(!!b.versionOf)
      : (catOrder.get(a.category) ?? SECTION_CATEGORIES.length) - (catOrder.get(b.category) ?? SECTION_CATEGORIES.length));
  const shown: Item[] = (cat === "proposed" ? PROPOSED_SECTIONS.filter(matches) : ALL_ITEMS.filter((s) => (cat === "all" || shelfOf(s) === cat) && matches(s))).sort(byCategory);
  // Previous and next in the details modal, through the pieces on the current shelf (← and → keys too).
  const at = open ? shown.findIndex((x) => uid(x) === uid(open)) : -1;
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
  const pick = (id: string) => {
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
          <p className="muted cl-count">
            {LIBRARY_SECTIONS.length} sections, components and page templates written for FlowCode. Sources and credits are in the Third-party notices.
          </p>
        </div>
      </header>

      <div className="library-grid__bar cl-bar">
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
        <label className="cl-style">
          <span className="muted">Surface</span>
          <select className="select" value={surface} onChange={(e) => setSurface(e.target.value)}>
            <option value="">{`The style's own (${STYLE_VIBES.find((v) => v.id === TEMPLATE_VIBES[styleId])?.name ?? "Flat"})`}</option>
            {STYLE_VIBES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
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
            <span className="lib-shelf__label">
              All sections
              <NewBadge n={newTotal} />
            </span>
            <span className="lib-shelf__count">{ALL_ITEMS.length}</span>
          </button>
          <button type="button" className="lib-shelf" aria-current={cat === "external"} onClick={() => pick("external")}>
            <span className="lib-shelf__label">External components</span>
          </button>
          {LEVELS.map(([l, heading]) => {
            const shelves = l === "component" ? componentShelves : SECTION_CATEGORIES.map((c) => `${l}:${c.id}`).filter((k) => counts.get(k));
            return shelves.length ? (
              <div key={l} className="cl-group">
                <p className="lib-shelves__heading">{heading}</p>
                {shelves.map((k) => (
                  <button key={k} type="button" className="lib-shelf" aria-current={cat === k} onClick={() => pick(k)}>
                    <span className="lib-shelf__label">
                      {label(k)}
                      <NewBadge n={newCounts.get(k)} />
                    </span>
                    <span className="lib-shelf__count">{counts.get(k)}</span>
                  </button>
                ))}
              </div>
            ) : null;
          })}
        </nav>
        {cat === "external" ? (
          <ExternalSources query={q} />
        ) : null}
        {cat !== "external" && !shown.length ? (
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
        {cat !== "external" ? <ul className="cl-grid">
          {cat === "proposed" ? (
            <li className="cl-proposed-note" role="note">
              New pieces, not in the library yet: builds don't use them until you accept them. Open one to try it, then Accept or Decline it.
            </li>
          ) : null}
          {shown.map((s) => (
            <li key={uid(s)}>
              <button type="button" className="cl-tile" onClick={() => (setShowCode(false), setOpen(s))} aria-label={`${s.name}${isNewPiece(s.id) ? " (new)" : ""}: open details`}>
                <SectionThumb id={s.id} look={look} title={s.name} focus={s.focus} />
                {isNewPiece(s.id) ? (
                  <span className="cl-new cl-new--tile" title="New in the last two weeks" aria-hidden="true">
                    <Sparkles size={14} strokeWidth={2.25} />
                  </span>
                ) : null}
                <span className="cl-tile__text">
                  <strong>{s.name}</strong>
                  <span className="muted">{s.description}</span>
                </span>
              </button>
              {cat === "proposed" ? <ShelfDecision piece={s} /> : null}
            </li>
          ))}
        </ul> : null}
      </div>

      {open ? (
        <LibModal
          label={`${SECTION_CATEGORIES.find((c) => c.id === open.category)?.label ?? "Section"} · ${showCode ? "code" : "preview"}`}
          onClose={() => setOpen(undefined)}
          toolbar={showCode ? undefined : <PreviewSizes value={device} onChange={setDevice} />}
          scrollKey={`${uid(open)}:${showCode ? "code" : "preview"}`}
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
              <div className="cl-detail__head">
                <h2 style={{ margin: 0, fontSize: 18 }}>{open.name}</h2>
                <button type="button" className="btn btn--sm cl-detail__toggle" aria-expanded={details} aria-controls="cl-detail-more" onClick={() => setDetails((v) => !v)}>
                  Details
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              </div>
              <div id="cl-detail-more" className="cl-detail__more" data-open={details} inert={!details}>
                <div>
                  <p className="dim" style={{ margin: "4px 0 0" }}>
                    {open.description} File: <span className="mono">templates/library/sections/{open.id}.tsx</span>
                  </p>
                  <PieceRefs piece={open} />
                </div>
              </div>
            </div>
            {showCode ? <pre className="cl-code">{code ?? "Loading…"}</pre> : <SectionFrame id={open.id} look={look} title={open.name} width={deviceWidth(device)} focus={open.focus} />}
          </div>
        </LibModal>
      ) : null}
    </div>
  );
}

const LEVEL_NAMES = { component: "Component", pattern: "Pattern", block: "Block", template: "Template", tokens: "Tokens" } as const;

/** One catalog ID, tinted by its level (component, pattern, block, template, tokens). With `base`, the part it shares
 * with the piece's own ID is dimmed so a variant reads as its suffix. */
function RefChip({ id, base }: { id: string; base?: string }) {
  const shared = base && (id.startsWith(`${base}.`) || id.startsWith(`${base}@`)) ? base : "";
  return (
    <code className="cl-ref" data-level={levelOf(id) ?? "component"} title={id}>
      {shared ? <span className="cl-ref__base">{shared}</span> : null}
      {id.slice(shared.length)}
    </code>
  );
}

/** A piece's catalog ID to copy, its variants' IDs, what it's built from and what uses it, one labelled row each, with
 * a key to the level colours used on this sheet; then the composition rules the builders follow (where it belongs,
 * what it gives a page, what it needs and when to avoid it). */
function PieceRefs({ piece }: { piece: Item }) {
  if (!piece.ref) return null;
  const ref = piece.ref;
  const own = (r: string) => r === ref || r.startsWith(`${ref}.`) || r.startsWith(`${ref}@`);
  // A piece's own variants and versions are listed above; "Used by" is for the pieces built on top of it.
  const users = usedBy(ref).filter((u) => !own(u.ref ?? u.id));
  const rows: [string, string[]][] = [
    ["Variant of", piece.variantOf ? [piece.variantOf] : []],
    ["Variants", (piece.variants ?? []).map((v) => v.ref)],
    ["Also", (piece.also ?? []).flatMap((a) => [a.ref, ...(a.variants ?? []).map((v) => v.ref)])],
    ["Version of", piece.versionOf ? [piece.versionOf] : []],
    ["Versions", versionsOf(ref).map((v) => v.ref!)],
    ["Uses", piece.uses ?? []],
    ["Used by", users.map((u) => u.ref ?? u.id)],
  ];
  const shown = rows.filter(([, ids]) => ids.length);
  const level = levelOf(ref) ?? "component";
  const levels = [...new Set([ref, ...shown.flatMap(([, ids]) => ids)].map((r) => levelOf(r) ?? "component"))];
  const rel = relationsOf(ref);
  const rules: [string, string][] = [
    ["Belongs on", rel.contexts.map((c) => (c === "app" ? "App screens" : "Marketing pages")).join(" and ")],
    ["Gives a page", rel.provides.join(", ")],
    ["Needs", rel.requires.join("; ")],
    ["Avoid when", rel.avoidWhen.join("; ")],
  ];
  return (
    <dl className="cl-refs">
      <div className="cl-refs__row">
        <dt>Catalog ID</dt>
        <dd>
          <span className="cl-ref-id" data-level={level}>
            <CopyButton text={ref} label={ref} />
          </span>
          <span className="cl-level" data-level={level}>
            {LEVEL_NAMES[level]}
          </span>
          {levels.length > 1 ? (
            <span className="cl-levels" aria-label="Colour key">
              {levels.map((l) => (
                <span key={l} className="cl-levels__item" data-level={l}>
                  {LEVEL_NAMES[l]}
                </span>
              ))}
            </span>
          ) : null}
        </dd>
      </div>
      {shown.map(([label, ids]) => (
        <div key={label} className="cl-refs__row">
          <dt>{label}</dt>
          <dd>
            {ids.map((id) => (
              <RefChip key={id} id={id} base={label === "Variants" || label === "Versions" ? ref : undefined} />
            ))}
          </dd>
        </div>
      ))}
      {rules
        .filter(([, text]) => text)
        .map(([label, text]) => (
          <div key={label} className="cl-refs__row cl-refs__row--rule">
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
    </dl>
  );
}

/**
 * Accept or Decline for a piece on the approval shelf (daemon workspace/libraryDecisions.ts). Decline deletes the
 * piece's file, so it asks first. FlowCode rebuilds and restarts after either, then this page reloads.
 */
function ShelfDecision({ piece }: { piece: LibrarySection }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const decide = async (decision: "accept" | "decline") => {
    setBusy(decision === "accept" ? "Adding to the library…" : "Removing…");
    setError(undefined);
    try {
      await post(`/library/proposed/${encodeURIComponent(piece.id)}`, { decision });
      // The library is rebuilt and FlowCode restarts; the page comes back with the change.
      window.setTimeout(() => location.reload(), 6000);
    } catch (e) {
      setError((e as Error).message);
      setBusy(undefined);
    }
  };
  if (busy) return <p className="cl-decide__busy" role="status">{busy}</p>;
  return (
    <div className="cl-decide">
      {confirm ? (
        <>
          <span className="cl-decide__q">Decline {piece.name}? Its file is deleted.</span>
          <button type="button" className="btn btn--sm btn--danger" onClick={() => void decide("decline")}>Decline</button>
          <button type="button" className="btn btn--sm" onClick={() => setConfirm(false)}>Keep</button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => void decide("accept")}>Accept</button>
          <button type="button" className="btn btn--sm" onClick={() => setConfirm(true)}>Decline</button>
        </>
      )}
      {error ? <p className="psetup__err" role="alert">{error}</p> : null}
    </div>
  );
}
