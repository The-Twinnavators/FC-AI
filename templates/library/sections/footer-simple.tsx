/**
 * Footer: simple. One row: brand, a few links and the small print. For apps and small sites. Make it the app's own:
 * replace SAMPLE and point links at real screens.
 */
// flowcode:sample
const SAMPLE = {
  brand: "Brightside",
  links: ["About", "Help", "Privacy", "Terms"],
  year: 2026,
};

export default function FooterSimple() {
  const d = SAMPLE;
  return (
    <footer className="fl-footer" style={{ paddingBlock: "var(--space-6)" }}>
      <div className="fl-wrap" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "center", justifyContent: "space-between" }}>
        <a className="fl-nav__brand" href="#top">
          {d.brand}
        </a>
        <nav aria-label="Footer">
          <ul style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-5)" }}>
            {d.links.map((l) => (
              <li key={l}>
                <a href={`#${l.toLowerCase()}`}>{l}</a>
              </li>
            ))}
          </ul>
        </nav>
        <span className="fl-meta">
          © {d.year} {d.brand}
        </span>
      </div>
    </footer>
  );
}
