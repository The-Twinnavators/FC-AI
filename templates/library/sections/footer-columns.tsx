/** @flowcode-library footer-columns · Footer with columns (Footers)
 * Use cases: site footer; site map; marketing footer; company links; legal links; resource links
 * Jobs to be done: find a page i couldn't find above; read the privacy policy or terms; get in touch or follow on social; browse every section of the site
 * Keywords: footer, links, site map
 */
/**
 * Footer: columns. Brand and a line about it, then three columns of links, then the small print. Make it the app's
 * own: replace SAMPLE; point links at real screens; keep the credit line if this app uses an HTML5 UP template.
 */
// flowcode:sample
const SAMPLE = {
  brand: "Brightside",
  about: "Online booking for small studios, made by people who've run one.",
  columns: [
    { title: "Product", links: ["Features", "Pricing", "What's new"] },
    { title: "Company", links: ["About", "Journal", "Careers"] },
    { title: "Help", links: ["Help center", "Contact", "Status"] },
  ],
  legal: ["Privacy", "Terms"],
  year: 2026,
};

export default function FooterColumns() {
  const d = SAMPLE;
  return (
    <footer className="fl-footer">
      <div className="fl-wrap">
        <div className="fl-footer__cols">
          <div style={{ display: "grid", gap: "var(--space-3)", alignContent: "start" }}>
            <a className="fl-nav__brand" href="#top">
              {d.brand}
            </a>
            <p className="fl-text">{d.about}</p>
          </div>
          {d.columns.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h4>{c.title}</h4>
              <ul>
                {c.links.map((l) => (
                  <li key={l}>
                    <a href={`#${l.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{l}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="fl-footer__base">
          <span>
            © {d.year} {d.brand}
          </span>
          <span style={{ display: "flex", gap: "var(--space-4)" }}>
            {d.legal.map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`}>
                {l}
              </a>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
