/**
 * Dot field: a grid of small, faint slate-blue dots (like the About demo's), seen through a lens that follows the cursor and
 * magnifies the dots under it; a click swells the lens for a moment. FlowCode's own 2D canvas (the look after React
 * Bits' "Dot Field"; none of its code). It draws only while on screen and in a visible tab, and holds a still field
 * (no lens) for people who ask for reduced motion.
 */
import { useEffect, useRef } from "react";

const GAP = 26;
const DOT = 1;
const LENS = 150;

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16)) as Rgb;
const PURPLE = hex("#9b6bff");
const DEEP = hex("#6a3dff");
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((x, i) => Math.round(x + (b[i]! - x) * t)) as Rgb;

export function DotField({ from = "#9aa6e8", via = "#a9b6e6", to = "#8fb3e8" }: { from?: string; via?: string; to?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const canvas = document.createElement("canvas");
    canvas.className = "dotfield__canvas";
    el.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => canvas.remove();
    const stops = [hex(from), hex(via), hex(to)];
    const colorAt = (t: number) => (t < 0.5 ? mix(stops[0]!, stops[1]!, t * 2) : mix(stops[1]!, stops[2]!, (t - 0.5) * 2));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0, h = 0, ratio = 1;
    const size = () => {
      ratio = Math.min(devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    // The lens eases toward the cursor and grows while it is over the field; a click adds a short swell.
    const lens = { x: -9999, y: -9999, tx: -9999, ty: -9999, power: 0, target: 0, swell: 0 };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const r = LENS * (1 + lens.swell * 0.6);
      // Near the cursor the dots turn purple, deepest right under it; further out they stay faint slate-blue.
      const near = r * 1.8;
      for (let y = GAP / 2; y < h; y += GAP) {
        for (let x = GAP / 2; x < w; x += GAP) {
          let px = x, py = y, size = DOT, alpha = 0.14;
          let color = colorAt(Math.min(1, Math.max(0, (x / Math.max(w, 1)) * 0.7 + (y / Math.max(h, 1)) * 0.3)));
          const dx = x - lens.x, dy = y - lens.y;
          const d = Math.hypot(dx, dy);
          if (lens.power > 0.001 && d < near) {
            const tint = (1 - d / near) ** 1.5 * lens.power;
            color = d < r * 0.5 ? mix(PURPLE, DEEP, Math.min(1, (1 - d / (r * 0.5)) * lens.power)) : mix(color, PURPLE, Math.min(1, tint * 1.6));
            alpha = 0.14 + tint * 0.7;
            if (d < r) {
              // Magnify: push the dot out from the lens center and enlarge it, most at the center.
              const k = (1 - d / r) ** 2 * lens.power;
              px = x + dx * k * 0.55;
              py = y + dy * k * 0.55;
              size = DOT * (1 + k * 2.4);
              alpha = Math.min(1, alpha + k * 0.3);
            }
          }
          const [cr, cg, cb] = color;
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    let raf = 0, visible = true, last = 0;
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const ease = 1 - Math.exp(-dt / 0.12);
      lens.x += (lens.tx - lens.x) * ease;
      lens.y += (lens.ty - lens.y) * ease;
      lens.power += (lens.target - lens.power) * (1 - Math.exp(-dt / 0.25));
      lens.swell *= Math.pow(0.02, dt);
      draw();
      const settling = Math.abs(lens.tx - lens.x) + Math.abs(lens.ty - lens.y) > 0.3 || Math.abs(lens.target - lens.power) > 0.002 || lens.swell > 0.002;
      if (settling) wake();
      else last = 0;
    };
    const wake = () => {
      if (!raf && visible && !document.hidden && !reduced) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      const inside = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
      lens.tx = e.clientX - b.left;
      lens.ty = e.clientY - b.top;
      if (lens.power < 0.01) (lens.x = lens.tx), (lens.y = lens.ty);
      lens.target = inside ? 1 : 0;
      wake();
    };
    const onLeave = () => ((lens.target = 0), wake());
    const onDown = (e: PointerEvent) => {
      if (lens.target > 0 && e.button === 0) (lens.swell = 1), wake();
    };

    const ro = new ResizeObserver(() => (size(), draw()));
    ro.observe(el);
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((x) => x.isIntersecting);
      wake();
    });
    io.observe(el);
    size();
    draw();
    if (!reduced) {
      addEventListener("pointermove", onMove, { passive: true });
      addEventListener("pointerdown", onDown, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      canvas.remove();
    };
  }, [from, via, to]);

  return <div ref={box} className="dotfield" aria-hidden="true" />;
}
