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
 */
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
  return (
    <footer className="fl-footer" data-fl="b.footer-columns">
      <div className="fl-wrap">
        <div className="fl-footer__cols">
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
        <div className="fl-footer__base">
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
