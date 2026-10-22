/**
 * Floating "Back to top" button: appears once the page, or a workspace panel that scrolls on its own (Styles, Activity,
 * Changes…), is scrolled down, and takes you back to the top of whichever one you were scrolling.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "./ui";
import "../styles/back-to-top-panel.css";

/** Areas that count: the page itself and the workspace's own scrolling panels. */
const isScroller = (el: EventTarget | null): el is HTMLElement => el instanceof HTMLElement && (el.id === "main" || el.classList.contains("ws__scroll"));
// Shows once you have scrolled a little (it waited for over half a screen, so short pages never showed it).
const farEnough = (el: HTMLElement) => el.scrollTop > 240;

/** Where the button sits: a workspace panel gets a small round one in its own top-right corner, over content already
 * scrolled past; its bottom corner held the chat's Queue change and Ask buttons, and the button covered them. */
const placeFor = (el: HTMLElement): CSSProperties | undefined => {
  if (el.id === "main") return undefined;
  const r = el.getBoundingClientRect();
  return { right: Math.max(16, window.innerWidth - r.right + 12), top: Math.max(16, r.top + 12), bottom: "auto" };
};

export function BackToTop({ route }: { route: string }) {
  const [show, setShow] = useState(false);
  const [place, setPlace] = useState<CSSProperties | undefined>();
  const scroller = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const main = document.getElementById("main");
    scroller.current = main;
    setShow(main ? farEnough(main) : false);
    setPlace(undefined);
    // Scroll events don't bubble, so listen in the capture phase to hear every panel.
    const on = (e: Event) => {
      if (!isScroller(e.target)) return;
      scroller.current = e.target;
      setShow(farEnough(e.target));
      setPlace(placeFor(e.target));
    };
    document.addEventListener("scroll", on, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", on, { capture: true });
  }, [route]);
  const top = () => {
    const el = scroller.current ?? document.getElementById("main");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // Return keyboard focus to the start of what was scrolled.
    const target = el?.id === "main" ? el.querySelector<HTMLElement>("h1, [tabindex='-1']") : el;
    target?.focus?.({ preventScroll: true });
  };
  return (
    <button className={`back-to-top${place ? " back-to-top--panel" : ""}${show ? " is-visible" : ""}`} style={place} onClick={top} aria-label="Back to top" title="Back to top" tabIndex={show ? 0 : -1} aria-hidden={!show}>
      <span style={{ transform: "rotate(-90deg)", display: "inline-flex" }}>
        <Icon name="chevron" size={16} />
      </span>
      {place ? null : "Back to top"}
    </button>
  );
}
