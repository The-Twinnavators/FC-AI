/** @flowcode-library navbar-centered · Centered navigation (Navigation)
 * Use cases: portfolio header; studio website header; blog header; editorial navigation; agency site menu; restaurant site header; content site navigation
 * Jobs to be done: browse the main sections of the site; find the work or articles i want; get in touch with the studio; move between pages easily
 * Keywords: header, navbar, portfolio, studio
 */
/**
 * Navigation: centered. Links in the middle, brand left, action right: a calmer, more editorial header for content
 * sites, portfolios and studios. Make it the app's own: replace SAMPLE and point links at real screens.
 */
// flowcode:sample
const SAMPLE = {
  brand: "Atelier North",
  links: [
    { label: "Work", href: "#work" },
    { label: "Studio", href: "#studio" },
    { label: "Journal", href: "#journal" },
  ],
  action: { label: "Get in touch", href: "#contact" },
};

export default function NavbarCentered() {
  const d = SAMPLE;
  return (
    <header className="fl-nav fl-nav--center">
      <nav className="fl-nav__row" aria-label="Main">
        <a className="fl-nav__brand" href="#top">
          {d.brand}
        </a>
        <ul className="fl-nav__links">
          {d.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
        <a className="fl-btn fl-btn--secondary" href={d.action.href}>
          {d.action.label}
        </a>
      </nav>
    </header>
  );
}
