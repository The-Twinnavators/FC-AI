/** @flowcode-library footer-simple · Simple footer (Footers)
 * Catalog ID: b.footer-simple (block)
 * Function: A one-row page footer (b.footer-simple) for apps and small sites.
 * Use it as: import { FooterSimple } from "./footer-simple"; <FooterSimple brand links={[{label,href}]} year={2026}/>
 * Look: One compact row: brand on the left, a few links in the middle, the copyright on the right; wraps on a narrow screen.
 * Tokens: --space-4 --space-5 --space-6 --color-border --color-text-muted
 * Use cases: app footer; simple footer; landing page footer; legal links; small print
 * Jobs to be done: read the privacy policy or terms; find a few key links; see who runs the site
 * Keywords: footer, app
 */
/**
 * Footer: simple. One row: brand, a few links and the small print. For apps and small sites. Make it the app's own:
 * replace SAMPLE and point links at real screens.
 * Motion: the footer rises in once; links draw a straight underline from the left on hover or focus. With reduced motion or animation off nothing moves.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the section is in view, then "in". Already on screen plays at once; without an observer,
 * or with motion off, it is simply shown; a timeout never leaves it hidden. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in" | "done">("idle");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    const box = el.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.15 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  // Once it has played, drop the entrance classes, so content never depends on an animation finishing (a page that
  // isn't painting freezes animations).
  useEffect(() => {
    if (state !== "in") return;
    const t = setTimeout(() => setState("done"), 1200);
    return () => clearTimeout(t);
  }, [state]);
  return [ref, state] as const;
}

const enterClass = (state: "idle" | "wait" | "in" | "done") => (state === "wait" ? " is-waiting" : state === "in" ? " is-entering" : "");

export type FooterSimpleProps = {
  brand: string;
  links: { label: string; href: string }[];
  year: number;
};

export function FooterSimple({ brand, links, year }: FooterSimpleProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <footer ref={ref} className={`fl-footer fl-hx fl-hx-foot${enterClass(enter)}`} style={{ paddingBlock: "var(--space-6)" }} data-fl="b.footer-simple">
      <div className="fl-wrap fl-hx-seq" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "center", justifyContent: "space-between" }}>
        <a className="fl-nav__brand" href="#top">
          {brand}
        </a>
        <nav aria-label="Footer">
          <ul style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-5)" }}>
            {links.map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <span className="fl-meta">
          © {year} {brand}
        </span>
      </div>
    </footer>
  );
}

// flowcode:sample
const SAMPLE: FooterSimpleProps = {
  brand: "Brightside",
  links: [
    { label: "About", href: "#about" },
    { label: "Help", href: "#help" },
    { label: "Privacy", href: "#privacy" },
    { label: "Terms", href: "#terms" },
  ],
  year: 2026,
};

export default function FooterSimplePreview() {
  return <FooterSimple {...SAMPLE} />;
}
