/**
 * Vertical drag handle for resizable panels. Pointer drag reports the pointer's x; keyboard arrows step by 24px
 * (Shift: 72px); Home/End jump to the limits; double-click resets. Widths are stored as CSS variables.
 */
import { useEffect, useRef, useState } from "react";

export function usePersistedWidth(key: string, cssVar: string, target: () => HTMLElement | null) {
  const apply = (px: number | null) => {
    const el = target();
    if (!el) return;
    if (px === null) el.style.removeProperty(cssVar);
    else el.style.setProperty(cssVar, `${Math.round(px)}px`);
  };
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(key));
      if (v > 0) apply(v);
    } catch {
      /* storage unavailable */
    }
  }); // re-apply after each render in case the target re-mounted
  return (px: number | null) => {
    apply(px);
    try {
      if (px === null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(Math.round(px)));
    } catch {
      /* storage unavailable */
    }
  };
}

export function ResizeHandle({ label, value, min, max, onChange, onReset, side }: { label: string; value: () => number; min: number; max: () => number; onChange: (px: number) => void; onReset: () => void; side: "left" | "right" }) {
  const [drag, setDrag] = useState(false);
  const start = useRef<{ x: number; w: number } | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max(), v));
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      onChange(clamp(start.current.w + (side === "left" ? -dx : dx)));
    };
    const up = () => {
      setDrag(false);
      start.current = null;
      document.body.classList.remove("is-resizing");
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
  }, [drag]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      className={`resize-handle resize-handle--${side}${drag ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={Math.round(max())}
      aria-valuenow={Math.round(value())}
      tabIndex={0}
      title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = { x: e.clientX, w: value() };
        setDrag(true);
        document.body.classList.add("is-resizing");
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 72 : 24;
        const grow = side === "left" ? "ArrowLeft" : "ArrowRight";
        const shrink = side === "left" ? "ArrowRight" : "ArrowLeft";
        if (e.key === grow) onChange(clamp(value() + step));
        else if (e.key === shrink) onChange(clamp(value() - step));
        else if (e.key === "Home") onChange(min);
        else if (e.key === "End") onChange(max());
        else return;
        e.preventDefault();
      }}
    />
  );
}
