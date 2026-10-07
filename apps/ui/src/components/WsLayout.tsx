/**
 * Builder layout: the three panels (Files/Knowledge, Chat/Details, Preview and the other tabs) can be dragged into any
 * left-to-right order, and the signal strip can sit at the top or the bottom. Each has a grip; arrow keys move it too.
 * The layout is saved per browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type PanelId = "files" | "work" | "right";
export interface WsLayout {
  order: PanelId[];
  strip: "top" | "bottom";
}

const KEY = "fc.ws.layout";
const DEFAULT: WsLayout = { order: ["files", "work", "right"], strip: "bottom" };
const NAMES: Record<PanelId, string> = { files: "Files and Knowledge", work: "Chat and Details", right: "Preview and tabs" };
// Each panel keeps its own width rule wherever it goes.
const WIDTH: Record<PanelId, string> = { files: "var(--ws-files, minmax(200px, 250px))", work: "var(--ws-work, minmax(0, 1.1fr))", right: "minmax(320px, 1fr)" };

function load(): WsLayout {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as WsLayout | null;
    if (v && Array.isArray(v.order) && v.order.length === 3 && DEFAULT.order.every((p) => v.order.includes(p)) && (v.strip === "top" || v.strip === "bottom")) return v;
  } catch {
    /* fall back to the default */
  }
  return DEFAULT;
}

export function useWsLayout() {
  const [layout, setLayout] = useState<WsLayout>(load);
  const save = useCallback((next: WsLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* per-browser convenience only */
    }
  }, []);
  const movePanel = useCallback((id: PanelId, to: number) => {
    setLayout((cur) => {
      const order = cur.order.filter((p) => p !== id);
      order.splice(Math.max(0, Math.min(2, to)), 0, id);
      const next = { ...cur, order };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* per-browser convenience only */
      }
      return next;
    });
  }, []);
  const style = { ["--ws-cols" as string]: layout.order.map((p) => WIDTH[p]).join(" ") };
  return { layout, movePanel, setStrip: (strip: WsLayout["strip"]) => save({ ...layout, strip }), reset: () => save(DEFAULT), style, orderOf: (p: PanelId) => layout.order.indexOf(p) };
}

/** Grip for a panel: drag sideways (or use the left and right arrow keys) to change its place. */
export function PanelGrip({ id, layout, onMove }: { id: PanelId; layout: WsLayout; onMove: (id: PanelId, to: number) => void }) {
  const [drag, setDrag] = useState(false);
  const target = useRef<number | null>(null);
  const at = layout.order.indexOf(id);

  const startX = useRef(0);
  useEffect(() => {
    if (!drag) return;
    const ws = document.querySelector<HTMLElement>(".ws");
    const self = document.querySelector<HTMLElement>(`.ws__col[data-panel="${id}"]`);
    self?.classList.add("is-lifted");
    const cols = () => layout.order.map((p) => document.querySelector<HTMLElement>(`.ws__col[data-panel="${p}"]`)?.getBoundingClientRect());
    const move = (e: PointerEvent) => {
      // The panel stays attached to the cursor, sideways only.
      if (self) self.style.transform = `translateX(${e.clientX - startX.current}px)`;
      const rects = cols();
      // The slot under the pointer, by column midpoints (horizontal only).
      let to = rects.findIndex((r) => r && e.clientX < r.left + r.width / 2);
      if (to < 0) to = rects.length - 1;
      target.current = to;
      ws?.querySelectorAll(".ws__col").forEach((c) => c.classList.toggle("is-drop", c.getAttribute("data-panel") === layout.order[to] && layout.order[to] !== id));
    };
    const up = () => {
      if (self) self.style.transform = "";
      self?.classList.remove("is-lifted");
      ws?.querySelectorAll(".ws__col").forEach((c) => c.classList.remove("is-drop"));
      if (target.current !== null && target.current !== at) onMove(id, target.current);
      target.current = null;
      setDrag(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    document.body.classList.add("is-dragging-x");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("is-dragging-x");
    };
  }, [drag, at, id, layout.order, onMove]);

  return (
    <button
      type="button"
      className={`ws-grip ws-grip--x${drag ? " is-active" : ""}`}
      aria-label={`Move ${NAMES[id]} panel. Position ${at + 1} of 3. Use the left and right arrow keys.`}
      title="Drag sideways to move this panel"
      onPointerDown={(e) => {
        e.preventDefault();
        startX.current = e.clientX;
        setDrag(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" && at > 0) (e.preventDefault(), onMove(id, at - 1));
        if (e.key === "ArrowRight" && at < 2) (e.preventDefault(), onMove(id, at + 1));
      }}
    >
      <GripDots />
    </button>
  );
}

/** Grip for the signal strip: drag up or down (or use the up and down arrow keys) to put it at the top or bottom. */
export function StripGrip({ strip, onChange }: { strip: WsLayout["strip"]; onChange: (s: WsLayout["strip"]) => void }) {
  const [drag, setDrag] = useState(false);
  const startY = useRef(0);
  useEffect(() => {
    if (!drag) return;
    const ws = document.querySelector<HTMLElement>(".ws");
    const bar = ws?.querySelector<HTMLElement>(":scope > .strip");
    bar?.classList.add("is-lifted");
    let side: WsLayout["strip"] = strip;
    const move = (e: PointerEvent) => {
      // The strip stays attached to the cursor, up and down only.
      if (bar) bar.style.transform = `translateY(${e.clientY - startY.current}px)`;
      const r = ws?.getBoundingClientRect();
      if (!r) return;
      side = e.clientY < r.top + r.height / 2 ? "top" : "bottom";
      ws?.setAttribute("data-strip-drop", side);
    };
    const up = () => {
      if (bar) bar.style.transform = "";
      bar?.classList.remove("is-lifted");
      ws?.removeAttribute("data-strip-drop");
      if (side !== strip) onChange(side);
      setDrag(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    document.body.classList.add("is-dragging-y");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("is-dragging-y");
    };
  }, [drag, strip, onChange]);
  return (
    <button
      type="button"
      className={`ws-grip ws-grip--y${drag ? " is-active" : ""}`}
      aria-label={`Move the signal strip. It is at the ${strip}. Use the up and down arrow keys.`}
      title="Drag up or down to move the signal strip"
      onPointerDown={(e) => {
        e.preventDefault();
        startY.current = e.clientY;
        setDrag(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" && strip !== "top") (e.preventDefault(), onChange("top"));
        if (e.key === "ArrowDown" && strip !== "bottom") (e.preventDefault(), onChange("bottom"));
      }}
    >
      <GripDots />
    </button>
  );
}

function GripDots() {
  return (
    <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden="true">
      {[2, 7, 12, 17].map((x) => (
        <g key={x}>
          <circle cx={x - 0.5} cy="1.5" r="1.1" fill="currentColor" />
          <circle cx={x - 0.5} cy="4.5" r="1.1" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}
