/** @flowcode-library footer-columns · Footer with columns (Footers)
 * Catalog ID: b.footer-columns (block)
 * Function: The closing page section (b.footer-columns): brand, columns of links and the small print.
 * Use it as: import { FooterColumns } from "./footer-columns"; <FooterColumns brand about columns={[{title, links:[{label,href}]}]} legal={[{label,href}]} year={2026}/>
 * Look: A wide footer: brand and a blurb on the left, three or four columns of quiet links beside it, and a thin rule above the copyright and legal links.
 * Tokens: --space-3 --space-4 --color-border --color-text-muted --color-surface
 * Use cases: site footer; site map; marketing footer; company links; legal links; resource links
 * Jobs to be done: find a page i couldn't find above; read the privacy policy or terms; get in touch or follow on social; browse every section of the site
 * Keywords: footer, links, site map
 */
/**
 * Footer: columns. Brand and a line about it, then columns of links, then the small print. Make it the app's own:
 * replace SAMPLE; point links at real screens; keep the credit line if this app uses an HTML5 UP template.
 * Motion: the columns, then the small print, rise in once as the footer comes into view; links draw a straight underline on hover and keyboard focus. With reduced motion they only fade; with animation off they are simply there.
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
  // Once it has played, drop the entrance classes, so content never depends on an animation finishing.
  useEffect(() => {
    if (state !== "in") return;
    const t = setTimeout(() => setState("done"), 1200);
    return () => clearTimeout(t);
  }, [state]);
  return [ref, state] as const;
}

const enterClass = (state: "idle" | "wait" | "in" | "done") => (state === "wait" ? " is-waiting" : state === "in" ? " is-entering" : "");

type Link = { label: string; href: string };

export type FooterColumnsProps = {
  brand: string;
  /** One line under the brand: what the company does. */
  about: string;
  /** Three or four columns, each a title and its links. */
  columns: { title: string; links: Link[] }[];
  /** The small-print links at the bottom: privacy, terms. */
  legal: Link[];
  year: number;
};

export function FooterColumns({ brand, about, columns, legal, year }: FooterColumnsProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <footer ref={ref} className={`fl-footer fl-hx fl-hx-foot${enterClass(enter)}`} data-fl="b.footer-columns">
      <div className="fl-wrap">
        <div className="fl-footer__cols fl-hx-items">
          <div style={{ display: "grid", gap: "var(--space-3)", alignContent: "start" }}>
            <a className="fl-nav__brand" href="#top">
              {brand}
            </a>
            <p className="fl-text">{about}</p>
          </div>
          {columns.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h4>{c.title}</h4>
              <ul>
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="fl-footer__base fl-hx-last">
          <span>
            © {year} {brand}
          </span>
          <span style={{ display: "flex", gap: "var(--space-4)" }}>
            {legal.map((l) => (
              <a key={l.label} href={l.href}>
                {l.label}
              </a>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}

// flowcode:sample
const SAMPLE: FooterColumnsProps = {
  brand: "Brightside",
  about: "Online booking for small studios, made by people who've run one.",
  columns: [
    { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "What's new", href: "#what-s-new" }] },
    { title: "Company", links: [{ label: "About", href: "#about" }, { label: "Journal", href: "#journal" }, { label: "Careers", href: "#careers" }] },
    { title: "Help", links: [{ label: "Help center", href: "#help-center" }, { label: "Contact", href: "#contact" }, { label: "Status", href: "#status" }] },
  ],
  legal: [{ label: "Privacy", href: "#privacy" }, { label: "Terms", href: "#terms" }],
  year: 2026,
};

export default function FooterColumnsPreview() {
  return <FooterColumns {...SAMPLE} />;
}
