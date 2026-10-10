/** @flowcode-library top-nav-variants · Top nav: app bar, marketing header and the phone menu (Navigation)
 * Use cases: app shell header; marketing site header; signed-in bar; search in the bar; mobile menu
 * Jobs to be done: get to the main areas; find what I am looking for; sign in or reach my account
 * Keywords: top nav, app bar, header, navbar, sticky, hamburger, mobile menu, skip link
 */
/**
 * The bar across the top, in the three shapes an app needs: a marketing header with a sign-up, an app bar for people
 * already signed in, and the phone version where everything but the logo folds behind one button.
 *
 * All three fold. When a bar runs out of room its links go behind one button rather than wrapping into a block, and
 * each bar measures its own width rather than the window's, so it behaves the same in a narrow card as on a page.
 *
 * The menu buttons work, the account menu opens and closes on Escape, and the first thing in the tab order is a skip
 * link, because a nav full of links is the thing keyboard users most need to get past.
 *
 * Make it the app's own: replace the links and the logo. Keep the current page marked with aria-current.
 */
/**
 * How to try it
 * - Press a section in the app bar; press the avatar for the account menu, and Escape or a press outside to close it.
 * - Narrow the piece: the links in both top bars fold behind one button, measured against the bar's own width rather than
 *   the window's.
 * - Tab into any bar: the first stop is the skip link, which appears only when it has focus.
 *
 * Dependencies: React (useEffect, useRef, useState), and the library's own inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a
 * built app exactly as it runs here.
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

/** The one button a bar folds into. Hidden by the stylesheet while the bar has room for its links. */
function Fold({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  return (
    <button
      type="button"
      className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--40 fl-ctl-nav-fold"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? "Close the menu" : "Open the menu"}
      onClick={onToggle}
    >
      <Icon name={open ? "close" : "menu"} />
    </button>
  );
}

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

/** The marketing bar: links and one thing to do, folding behind a button when the bar runs out of room. */
function MarketingBar({ say }: { say: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`fl-ctl-nav-wrap${open ? " is-open" : ""}`}>
      <header className="fl-ctl-nav fl-ctl-nav--marketing">
        <a className="fl-ctl-nav-skip" href="#top">
          Skip to content
        </a>
        <Brand />
        <nav aria-label="Site" className="fl-ctl-nav-links" id="nav-marketing-links">
          <ul>
            {SAMPLE.marketing.map((l, n) => (
              <li key={l}>
                <a
                  href="#top"
                  aria-current={n === 0 ? "page" : undefined}
                  className={n === 0 ? "is-on" : undefined}
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
        </nav>
        <span className="fl-ctl-nav-spacer" />
        <span className="fl-ctl-nav-acts">
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--40" onClick={() => (setOpen(false), say("Sign in"))}>
            Sign in
          </button>
          <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--40" onClick={() => (setOpen(false), say("Start a project"))}>
            Start a project
          </button>
        </span>
        <Fold open={open} onToggle={() => setOpen((v) => !v)} controls="nav-marketing-links" />
      </header>
    </div>
  );
}

/** The signed-in bar: sections on the left, search and the account menu on the right. */
function AppBar({ say }: { say: (s: string) => void }) {
  const [here, setHere] = useState("Shoots");
  const [open, setOpen] = useState(false);
  const [folded, setFolded] = useState(false);
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
    <div className={`fl-ctl-nav-wrap${folded ? " is-open" : ""}`}>
    <header className="fl-ctl-nav fl-ctl-nav--app">
      <Brand />
      <nav aria-label="Sections" className="fl-ctl-nav-links" id="nav-app-links">
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
                  setFolded(false);
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
      <span className="fl-ctl-combo fl-ctl-nav-search fl-ctl-nav-links">
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
      <Fold open={folded} onToggle={() => setFolded((v) => !v)} controls="nav-app-links" />
    </header>
    </div>
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
          <p className="fl-ctl-matrix-what">For people who are not signed in: a few links and one thing to do. Narrow it and the links fold behind the button.</p>
          <MarketingBar say={setSaid} />
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
