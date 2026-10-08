/**
 * Navigation: simple. Brand on the left, page links, one main action on the right. On phones the links fold into a
 * menu button. Make it the app's own: replace SAMPLE, point each link at a real screen, keep one primary action.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Brightside",
  links: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Stories", href: "#stories" },
    { label: "Help", href: "#help" },
  ],
  signIn: { label: "Sign in", href: "#signin" },
  action: { label: "Start free", href: "#start" },
};

export default function NavbarSimple() {
  const d = SAMPLE;
  const [open, setOpen] = useState(false);
  return (
    <header className="fl-nav">
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
        <div className="fl-nav__end">
          <a className="fl-link" href={d.signIn.href}>
            {d.signIn.label}
          </a>
          <a className="fl-btn fl-btn--primary" href={d.action.href}>
            {d.action.label}
          </a>
          <button type="button" className="fl-btn fl-btn--secondary fl-nav__menu" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <Icon name="menu" />
          </button>
        </div>
      </nav>
      {open ? (
        <ul className="fl-nav__links fl-nav__links--open" style={{ display: "grid", padding: "var(--space-4) var(--space-5)", gap: "var(--space-3)" }}>
          {d.links.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
