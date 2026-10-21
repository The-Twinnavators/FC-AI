/** @flowcode-library scroll-area · Scroll area (Small components)
 * Catalog ID: c.scroll-area (component)
 * Function: Native scrolling with slim themed scrollbars that wake on hover, focus and scroll, a draggable thumb, a clickable track and edge fades, shown on a release-notes list and a sideways row of cards.
 * Use it as: import { ScrollArea } from "./scroll-area"; <ScrollArea label="Release notes" orientation?="vertical"|"horizontal"|"both" maxHeight?="18rem" type?="hover"|"always">content</ScrollArea>
 * Look: Content in a bordered box with no browser scrollbar; a thin rounded thumb fades in along the edge when you point at the box or scroll it, grows a little when pointed at, and a gentle fade marks each edge that has more beyond it.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --radius-sm --radius-md --radius-lg --space-1 --space-2 --space-3 --space-4 --text-xs --text-sm --duration-fast --duration-base --ease-out --focus-ring
 * Use cases: release notes; chat history; long list in a sidebar; horizontal card row; code or log panel; terms in a dialog; table that is wider than the screen
 * Jobs to be done: read a long list without the page jumping; see that there is more to scroll; scroll sideways through cards; scroll with the keyboard
 * Keywords: scroll area, scrollbar, custom scrollbar, overflow, horizontal scroll, fade edges
 */
/**
 * Scroll area: native scrolling with the library's own scrollbars. The browser still does the scrolling, so the wheel,
 * touch, trackpad momentum and the keyboard all work (the box takes focus only when it has something to scroll: arrows,
 * Page Up and Down, Home and End, Space). The browser's scrollbar is hidden and a slim thumb drawn over the edge shows
 * where you are: drag it, or click the track to move a page toward the click. It fades in on hover, focus and scroll
 * and out a moment later ("always" keeps it), and the edges that have more content fade softly. The thumbs are
 * decoration for screen readers, which use the box's own scrolling.
 * Make it the app's own: put any long content inside and give the box a maxHeight (vertical) or let it take its width
 * (horizontal); give it a label that says what scrolls.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its scroll area and scroll bar, rewritten without its
 * dependencies.
 */
/**
 * How to try it
 * - Point at the release notes: the thumb appears; drag it, or click the track above or below it.
 * - Tab to the list and use the arrow keys or Page Down; the top fade appears once you've scrolled.
 * - Scroll the cards sideways with Shift+wheel, a trackpad, the bottom thumb, or the arrow keys, Home and End.
 *
 * Dependencies: React (useCallback, useEffect, useRef, useState), the library's own Badge, and its inline icon set
 * ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample data
 * is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Badge } from "./badges-status";
import { Icon } from "./icons";

// ── c.scroll-area: a native scroller with drawn thumbs and edge fades. ──

type Axis = "y" | "x";
type Bar = { size: number; pos: number; show: boolean };
const MIN_THUMB = 24;

export function ScrollArea({ label, children, orientation = "vertical", maxHeight, type = "hover", className }: {
  label: string;
  children: ReactNode;
  orientation?: "vertical" | "horizontal" | "both";
  maxHeight?: string;
  /** "hover": thumbs show on hover, focus and scroll; "always": they stay. */
  type?: "hover" | "always";
  className?: string;
}) {
  const view = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const tracks = useRef<Record<Axis, HTMLDivElement | null>>({ x: null, y: null });
  const [bars, setBars] = useState<Record<Axis, Bar>>({ x: { size: 0, pos: 0, show: false }, y: { size: 0, pos: 0, show: false } });
  const [edges, setEdges] = useState({ top: false, bottom: false, left: false, right: false });
  const [awake, setAwake] = useState(false);
  const [dragging, setDragging] = useState<Axis | null>(null);
  const sleep = useRef(0);
  const drag = useRef({ start: 0, scroll: 0, ratio: 1 });
  const wantY = orientation !== "horizontal";
  const wantX = orientation !== "vertical";

  const measure = useCallback(() => {
    {
      const v = view.current;
      if (!v) return;
      const calc = (axis: Axis): Bar => {
        const client = axis === "y" ? v.clientHeight : v.clientWidth;
        const total = axis === "y" ? v.scrollHeight : v.scrollWidth;
        const at = axis === "y" ? v.scrollTop : Math.abs(v.scrollLeft);
        const track = (axis === "y" ? tracks.current.y?.clientHeight : tracks.current.x?.clientWidth) ?? client;
        if (total <= client + 1) return { size: 0, pos: 0, show: false };
        const size = Math.max(MIN_THUMB, (client / total) * track);
        return { size, pos: (at / (total - client)) * (track - size), show: true };
      };
      const y = wantY ? calc("y") : { size: 0, pos: 0, show: false };
      const x = wantX ? calc("x") : { size: 0, pos: 0, show: false };
      setBars({ x, y });
      setEdges({
        top: y.show && v.scrollTop > 1,
        bottom: y.show && v.scrollTop < v.scrollHeight - v.clientHeight - 1,
        left: x.show && Math.abs(v.scrollLeft) > 1,
        right: x.show && Math.abs(v.scrollLeft) < v.scrollWidth - v.clientWidth - 1,
      });
    }
  }, [wantX, wantY]);

  const wake = () => {
    setAwake(true);
    window.clearTimeout(sleep.current);
    sleep.current = window.setTimeout(() => setAwake(false), 900);
  };

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (view.current) ro.observe(view.current);
    if (inner.current) ro.observe(inner.current);
    return () => {
      ro.disconnect();
      window.clearTimeout(sleep.current);
    };
  }, [measure]);

  const onThumbDown = (e: ReactPointerEvent<HTMLDivElement>, axis: Axis) => {
    const v = view.current;
    const t = tracks.current[axis];
    if (!v || !t || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const client = axis === "y" ? v.clientHeight : v.clientWidth;
    const total = axis === "y" ? v.scrollHeight : v.scrollWidth;
    const track = axis === "y" ? t.clientHeight : t.clientWidth;
    drag.current = { start: axis === "y" ? e.clientY : e.clientX, scroll: axis === "y" ? v.scrollTop : v.scrollLeft, ratio: (total - client) / Math.max(1, track - bars[axis].size) };
    setDragging(axis);
  };
  const onThumbMove = (e: ReactPointerEvent<HTMLDivElement>, axis: Axis) => {
    const v = view.current;
    if (dragging !== axis || !v) return;
    const d = drag.current;
    const delta = ((axis === "y" ? e.clientY : e.clientX) - d.start) * d.ratio;
    if (axis === "y") v.scrollTop = d.scroll + delta;
    else v.scrollLeft = d.scroll + delta;
  };
  // A press on the track moves a page toward it.
  const onTrackDown = (e: ReactPointerEvent<HTMLDivElement>, axis: Axis) => {
    const v = view.current;
    if (!v || e.target !== e.currentTarget || e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const at = axis === "y" ? e.clientY - r.top : e.clientX - r.left;
    const dir = at < bars[axis].pos ? -1 : 1;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    v.scrollBy({ [axis === "y" ? "top" : "left"]: dir * (axis === "y" ? v.clientHeight : v.clientWidth) * 0.9, behavior: smooth ? "smooth" : "auto" });
  };

  // The tracks appear only once there is something to scroll; measure again against their own length.
  useEffect(() => {
    if (bars.x.show || bars.y.show) measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars.x.show, bars.y.show]);

  const scrollable = bars.x.show || bars.y.show;
  const visible = type === "always" || awake || dragging !== null;

  return (
    <div
      className={["fl-sa", visible ? "is-awake" : "", className].filter(Boolean).join(" ")}
      data-fl="c.scroll-area"
      data-top={edges.top || undefined}
      data-bottom={edges.bottom || undefined}
      data-left={edges.left || undefined}
      data-right={edges.right || undefined}
      onPointerEnter={measure}
      onPointerMove={(e) => e.pointerType === "mouse" && wake()}
    >
      <div
        ref={view}
        className={["fl-sa-view", wantX ? "fl-sa-view--x" : "", wantY ? "fl-sa-view--y" : ""].filter(Boolean).join(" ")}
        style={{ maxHeight }}
        role="region"
        aria-label={label}
        tabIndex={scrollable ? 0 : undefined}
        onScroll={() => {
          measure();
          wake();
        }}
        onFocus={wake}
        onKeyDown={(e) => {
          // A sideways-only box: Home, End and Page Up/Down move along it (the browser would only move up and down).
          const v = view.current;
          if (orientation !== "horizontal" || !v || e.altKey || e.ctrlKey || e.metaKey) return;
          const smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
          const page = v.clientWidth * 0.9;
          const to = { Home: 0, End: v.scrollWidth, PageUp: v.scrollLeft - page, PageDown: v.scrollLeft + page }[e.key];
          if (to === undefined) return;
          e.preventDefault();
          v.scrollTo({ left: to, behavior: smooth });
        }}
      >
        <div ref={inner} className="fl-sa-inner">
          {children}
        </div>
      </div>
      {(["y", "x"] as Axis[]).map((axis) =>
        bars[axis].show ? (
          <div
            key={axis}
            ref={(el) => {
              tracks.current[axis] = el;
            }}
            className={`fl-sa-track fl-sa-track--${axis}${bars.x.show && bars.y.show ? " fl-sa-track--both" : ""}`}
            aria-hidden="true"
            onPointerDown={(e) => onTrackDown(e, axis)}
          >
            <div
              className={["fl-sa-thumb", dragging === axis ? "is-dragging" : ""].filter(Boolean).join(" ")}
              style={axis === "y" ? { height: bars.y.size, translate: `0 ${bars.y.pos}px` } : { width: bars.x.size, translate: `${bars.x.pos}px 0` }}
              onPointerDown={(e) => onThumbDown(e, axis)}
              onPointerMove={(e) => onThumbMove(e, axis)}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              onLostPointerCapture={() => setDragging(null)}
            />
          </div>
        ) : null,
      )}
    </div>
  );
}

// ── The reference sheet: release notes that scroll down, and a row of cards that scrolls sideways. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Scrolling",
  title: "Scroll area",
  lede: "Point at a box, or tab to it and use the arrow keys.",
  notesLabel: "Release notes",
  notes: [
    { version: "4.2", date: "Oct 14", tag: "New", changes: ["Firing reports show cone, glaze and result for every load.", "Waitlists move people up when a seat opens.", "Gift cards can be split across two orders."] },
    { version: "4.1", date: "Sep 30", tag: "Improved", changes: ["Class pages load twice as fast on phones.", "Members can see their shelf space in the portal."] },
    { version: "4.0", date: "Sep 9", tag: "New", changes: ["A new calendar with week and day views.", "Kiln log entries can carry photos.", "Point of sale works offline and syncs later."] },
    { version: "3.9", date: "Aug 18", tag: "Fixed", changes: ["Receipts show the right tax for gift cards.", "Waitlist emails no longer go out twice."] },
    { version: "3.8", date: "Jul 29", tag: "Improved", changes: ["Exports include class notes.", "Search finds members by phone number."] },
  ],
  cardsLabel: "Recently viewed",
  cards: [
    { title: "Wheel basics", meta: "6 weeks · Tue", icon: "calendar" },
    { title: "Glaze lab", meta: "4 weeks · Thu", icon: "sparkle" },
    { title: "Hand building", meta: "Drop-in · Sat", icon: "heart" },
    { title: "Kiln loading", meta: "1 evening", icon: "bolt" },
    { title: "Open studio", meta: "Members · daily", icon: "home" },
    { title: "Kids' clay club", meta: "Sat mornings", icon: "users" },
    { title: "Surface design", meta: "3 weeks · Wed", icon: "layers" },
  ],
};

const TONE: Record<string, "info" | "success" | "warning"> = { New: "info", Improved: "success", Fixed: "warning" };

export default function ScrollAreaPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="scroll-area-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="scroll-area-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <div className="fl-sa-demo">
          <div className="fl-sa-box">
            <h3 className="fl-sa-heading">{d.notesLabel}</h3>
            <ScrollArea label={d.notesLabel} maxHeight="18rem">
              <ol className="fl-sa-notes">
                {d.notes.map((n) => (
                  <li key={n.version}>
                    <div className="fl-sa-note-head">
                      <strong>Version {n.version}</strong>
                      <Badge variant="status" tone={TONE[n.tag] ?? "info"}>
                        {n.tag}
                      </Badge>
                      <time>{n.date}</time>
                    </div>
                    <ul>
                      {n.changes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </div>

          <div className="fl-sa-box">
            <h3 className="fl-sa-heading">{d.cardsLabel}</h3>
            <ScrollArea label={d.cardsLabel} orientation="horizontal">
              <ul className="fl-sa-cards">
                {d.cards.map((c) => (
                  <li key={c.title} className="fl-sa-card">
                    <span className="fl-sa-card-icon" aria-hidden="true">
                      <Icon name={c.icon} />
                    </span>
                    <strong>{c.title}</strong>
                    <span>{c.meta}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </div>
      </div>
    </section>
  );
}
