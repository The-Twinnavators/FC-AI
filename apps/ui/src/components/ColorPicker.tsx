/**
 * A color picker: the swatch opens a popover with a saturation/brightness square, a hue slider, the hex value and
 * the palette's own colors as quick picks. Dragging, arrow keys and typing a hex all work; changes are live.
 */
import { useEffect, useId, useRef, useState } from "react";
import { normalizeHex } from "@flowcode/contracts";

type Hsv = { h: number; s: number; v: number };

function hexToHsv(hex: string): Hsv {
  const n = parseInt((normalizeHex(hex) ?? "#000000").slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvToHex({ h, s, v }: Hsv): string {
  const f = (k: number) => {
    const x = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function ColorPicker({ value, onChange, label, swatches = [] }: { value: string; onChange: (hex: string) => void; label: string; swatches?: Array<{ label: string; hex: string }> }) {
  const hex = normalizeHex(value) ?? "#000000";
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(hex));
  const [text, setText] = useState(hex);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  // Follow outside changes (another control, a palette pick) without losing the hue of grays while dragging.
  useEffect(() => {
    setText(hex);
    if (hsvToHex(hsv) !== hex) setHsv((cur) => ({ ...hexToHsv(hex), h: hexToHsv(hex).s === 0 ? cur.h : hexToHsv(hex).h }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  const commit = (next: Hsv) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };
  /** Pointer drag on the square or the hue bar; `apply` maps the 0–1 position to a color. */
  const drag = (apply: (x: number, y: number) => void) => (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const at = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      apply(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    };
    el.setPointerCapture(e.pointerId);
    at(e);
    const move = (ev: PointerEvent) => at(ev);
    const up = () => (el.removeEventListener("pointermove", move), el.removeEventListener("pointerup", up));
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const keys = (axis: "sv" | "h") => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    if (axis === "h") commit({ ...hsv, h: (hsv.h + d[0] * 360 + d[1] * 360 + 360) % 360 });
    else commit({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + d[0])), v: Math.min(1, Math.max(0, hsv.v + d[1])) });
  };
  const typed = (v: string) => {
    setText(v);
    const n = normalizeHex(v);
    if (n) {
      setHsv(hexToHsv(n));
      onChange(n);
    }
  };

  return (
    <div className="cpick" ref={box}>
      <button type="button" className="cpick__swatch" style={{ background: hex }} aria-label={`${label}: ${hex}. Open the color picker`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} />
      <input className="input mono cpick__hex" value={text} aria-label={`${label} hex value`} maxLength={7} onChange={(e) => typed(e.target.value)} onBlur={() => setText(hex)} />
      {open ? (
        <div className="cpick__pop" id={id} role="dialog" aria-label={`${label} color picker`}>
          <div
            className="cpick__sv"
            style={{ background: `hsl(${hsv.h} 100% 50%)` }}
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuetext={`saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
            onPointerDown={drag((x, y) => commit({ ...hsv, s: x, v: 1 - y }))}
            onKeyDown={keys("sv")}
          >
            <span className="cpick__knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
          </div>
          <div
            className="cpick__hue"
            role="slider"
            tabIndex={0}
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            onPointerDown={drag((x) => commit({ ...hsv, h: x * 360 }))}
            onKeyDown={keys("h")}
          >
            <span className="cpick__knob cpick__knob--bar" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} />
          </div>
          <div className="cpick__row">
            <span className="cpick__current" style={{ background: hex }} aria-hidden="true" />
            <input className="input mono cpick__hex cpick__hex--pop" value={text} aria-label="Hex value" maxLength={7} onChange={(e) => typed(e.target.value)} onBlur={() => setText(hex)} />
          </div>
          {swatches.length ? (
            <div className="cpick__swatches" role="group" aria-label="Colors in your palette">
              {swatches.map((s) => (
                <button key={s.label + s.hex} type="button" className={`cpick__chip${s.hex === hex ? " is-on" : ""}`} style={{ background: s.hex }} title={`${s.label} · ${s.hex}`} aria-label={`${s.label} ${s.hex}`} onClick={() => typed(s.hex)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
