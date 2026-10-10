/** @flowcode-library top-nav-variants · Top nav: app bar, marketing header and the phone menu (Navigation)
 * Use cases: app shell header; marketing site header; signed-in bar; search in the bar; mobile menu
 * Jobs to be done: get to the main areas; find what I am looking for; sign in or reach my account
 * Keywords: top nav, app bar, header, navbar, sticky, hamburger, mobile menu, skip link
 */
/**
 * The bar across the top, in the three shapes an app needs: a marketing header with a sign-up, an app bar for people
 * already signed in, and the phone version where everything but the logo folds behind one button.
 *
 * The menu button works, the account menu opens and closes on Escape, and the first thing in the tab order is a skip
 * link, because a nav full of links is the thing keyboard users most need to get past.
 *
 * Make it the app's own: replace the links and the logo. Keep the current page marked with aria-current.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Northlight",
  marketing: ["Work", "Studio", "Pricing", "Journal"],
  app: [
    { label: "Shoots", icon: "image", here: true },
    { label: "Clients", icon: "users", here: false },
    { label: "Invoices", icon: "chart", here: false },
    { label: "Settings", icon: "settings", here: false },
  ],
  account: ["Your profile", "Studio settings", "Keyboard shortcuts", "Sign out"],
};

function Brand() {
  return (
    <a className="fl-ctl-nav-brand" href="#top">
      <span className="fl-ctl-nav-mark" aria-hidden="true">
        <Icon name="bolt" />
      </span>
      {SAMPLE.brand}
    </a>
  );
}

/** The signed-in bar: sections on the left, search and the account menu on the right. */
function AppBar({ say }: { say: (s: string) => void }) {
  const [here, setHere] = useState("Shoots");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <header className="fl-ctl-nav fl-ctl-nav--app">
      <Brand />
      <nav aria-label="Sections">
        <ul>
          {SAMPLE.app.map((l) => (
            <li key={l.label}>
              <a
                href="#top"
                aria-current={l.label === here ? "page" : undefined}
                className={l.label === here ? "is-on" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setHere(l.label);
                  say(`Went to ${l.label}`);
                }}
              >
                <Icon name={l.icon} />
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <span className="fl-ctl-nav-spacer" />
      <span className="fl-ctl-combo fl-ctl-nav-search">
        <label className="fl-sr" htmlFor="nav-search">
          Search
        </label>
        <input id="nav-search" className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32" type="search" placeholder="Search shoots" />
        <Icon name="search" />
      </span>
      <div className="fl-ctl-nav-account" ref={box}>
        <button type="button" className="fl-ctl-nav-avatar" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true">AM</span>
          <span className="fl-sr">Your account</span>
        </button>
        {open ? (
          <ul className="fl-ctl-menu fl-ctl-menu--actions fl-ctl-nav-menu" role="menu" aria-label="Your account">
            {SAMPLE.account.map((a) => (
              <li
                key={a}
                role="menuitem"
                tabIndex={-1}
                className={a === "Sign out" ? "is-danger" : undefined}
                onClick={() => {
                  setOpen(false);
                  say(a);
                }}
              >
                {a}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </header>
  );
}

/** The phone bar: one button, and everything else behind it. */
function PhoneBar({ say }: { say: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fl-ctl-nav-phone">
      <header className="fl-ctl-nav fl-ctl-nav--phone">
        <Brand />
        <button
          type="button"
          className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--40"
          aria-expanded={open}
          aria-controls="nav-phone-menu"
          aria-label={open ? "Close the menu" : "Open the menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </header>
      <div className={`fl-ctl-nav-sheet${open ? " is-open" : ""}`} id="nav-phone-menu" hidden={!open}>
        <ul>
          {SAMPLE.marketing.map((l) => (
            <li key={l}>
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  say(`Went to ${l}`);
                }}
              >
                {l}
              </a>
            </li>
          ))}
        </ul>
        <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--44" onClick={() => say("Sign up")}>
          Start a project
        </button>
      </div>
    </div>
  );
}

export default function TopNavVariants() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-nav-list">
        <li>
          <p className="fl-ctl-matrix-kind">Marketing header</p>
          <p className="fl-ctl-matrix-what">For people who are not signed in: a few links and one thing to do.</p>
          <header className="fl-ctl-nav fl-ctl-nav--marketing">
            <a className="fl-ctl-nav-skip" href="#top">
              Skip to content
            </a>
            <Brand />
            <nav aria-label="Site">
              <ul>
                {d.marketing.map((l, n) => (
                  <li key={l}>
                    <a href="#top" aria-current={n === 0 ? "page" : undefined} className={n === 0 ? "is-on" : undefined}>
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <span className="fl-ctl-nav-spacer" />
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--40" onClick={() => setSaid("Sign in")}>
              Sign in
            </button>
            <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--40" onClick={() => setSaid("Start a project")}>
              Start a project
            </button>
          </header>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">App bar</p>
          <p className="fl-ctl-matrix-what">For people already in: sections, a search, and the account menu. Press a section, or open the avatar.</p>
          <AppBar say={setSaid} />
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">On a phone</p>
          <p className="fl-ctl-matrix-what">Everything but the logo folds behind one button, which says whether it is open.</p>
          <PhoneBar say={setSaid} />
        </li>
      </ul>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Press anything in the bars above."}
      </p>

      <div className="fl-ctl-sizes">
        <h3>The rules these follow</h3>
        <p className="fl-ctl-btn-what">
          The current section carries aria-current, not just a color. The first thing in the tab order is a skip link,
          hidden until it has focus. The menu button says aria-expanded. A sticky bar needs a background, or the page
          scrolls through it.
        </p>
      </div>
    </section>
  );
}
