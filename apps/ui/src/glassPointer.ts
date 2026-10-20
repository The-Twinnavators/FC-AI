/**
 * Liquid glass's pointer light, app-wide: over any FlowCode glass surface a soft highlight follows the mouse and fades
 * in and out (the look of the library's c.liquid-glass). One listener for the whole app; the surface under the pointer
 * gets --glass-x / --glass-y (where the light is) and --glass-lit (0 or 1, eased in CSS). No light for touch or reduced
 * motion. The surfaces are listed in GLASS; their ::after draws the light (styles/glass-light.css).
 */
export const GLASS = [
  ".composer",
  ".disc-list-bg .disc-projects--cards .disc-project",
  ".disc-list-bg .disc-projects--list",
  ".dots-bg .lrc-card.qa-card",
  ".dots-bg .ab2__demo .abf",
  ".dots-bg .hero--panel.hero--dark",
  ".dots-bg .ab2__section--panel",
  ".dots-bg .ab2__setup-wrap",
].join(", ");

export function startGlassPointer() {
  let lit: HTMLElement | null = null;
  let at: { x: number; y: number; el: HTMLElement } | null = null;
  let raf = 0;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const off = (el: HTMLElement | null) => el?.style.setProperty("--glass-lit", "0");
  const paint = () => {
    raf = 0;
    if (!at) return;
    const r = at.el.getBoundingClientRect();
    at.el.style.setProperty("--glass-x", `${at.x - r.left}px`);
    at.el.style.setProperty("--glass-y", `${at.y - r.top}px`);
    at.el.style.setProperty("--glass-lit", "1");
  };
  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch" || reduced()) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(GLASS) ?? null;
      if (el !== lit) (off(lit), (lit = el));
      if (!el) return void (at = null);
      at = { x: e.clientX, y: e.clientY, el };
      if (!raf) raf = requestAnimationFrame(paint);
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => (off(lit), (lit = null), (at = null)));
}
