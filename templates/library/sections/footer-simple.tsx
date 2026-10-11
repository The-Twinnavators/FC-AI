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
 */
export type FooterSimpleProps = {
  brand: string;
  links: { label: string; href: string }[];
  year: number;
};

export function FooterSimple({ brand, links, year }: FooterSimpleProps) {
  return (
    <footer className="fl-footer" style={{ paddingBlock: "var(--space-6)" }} data-fl="b.footer-simple">
      <div className="fl-wrap" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "center", justifyContent: "space-between" }}>
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
