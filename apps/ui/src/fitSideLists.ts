/**
 * Side lists (System Settings, Feature guide, Branding, Knowledge Hub shelves) always end just above the sticky footer,
 * wherever they start on screen: at the top of a page they start under the heading, once scrolled they stick under
 * the top bar. Their height is set to the space between their top and the footer; longer lists scroll inside.
 */
const SELECTOR = ".settings-nav, .prim-nav, .lib-shelves";
const GAP = 16;

function fit() {
  const footer = document.querySelector<HTMLElement>(".app-footer");
  const bottom = footer ? footer.getBoundingClientRect().top : window.innerHeight;
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    const top = Math.max(0, el.getBoundingClientRect().top);
    el.style.setProperty("--snav-max", `${Math.max(160, Math.round(bottom - top - GAP))}px`);
  });
}

/** Starts keeping side lists above the footer; returns a function that stops it. */
export function fitSideLists(): () => void {
  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fit);
  };
  // Scrolling happens in #main; capture catches it (and any inner scroller) without knowing which element scrolls.
  document.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);
  // Pages and lists appear as you navigate.
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true });
  schedule();
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
    mo.disconnect();
  };
}
