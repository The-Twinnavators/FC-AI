/** @flowcode-library footer-newsletter · Footer with newsletter (Footers)
 * Catalog ID: b.footer-newsletter (block)
 * Function: The newsletter footer block (b.footer-newsletter): a newsletter sign-up that checks the address and confirms, the brand with social links, link columns that fold on a phone, and a bottom row with the small print, a language switcher and Back to top.
 * Use it as: import { FooterNewsletter } from "./footer-newsletter"; <FooterNewsletter brand={{ name, href? }} about newsletter={{ title, text, label?, placeholder?, action, done: { title, text } }} onSubscribe?={(email) => Promise<void> | void} columns={[{ title, links: [{ label, href }] }]} social?={[{ kind: "x"|"linkedin"|"github"|"youtube"|"instagram", href }]} languages?={Language[]} language?="en" onLanguage?={(code) => ...} legal?={[{ label, href }]} copyright="© 2026 Name" labels?={{ top, invalid, empty, failed, again, follow }} />
 * Built from: c.button.primary, c.button.tertiary, c.text-field.outlined, c.language-switcher
 * Look: A wide footer: across the top a rounded surface card with a bold newsletter title and line on the left and an email field joined to a primary button on the right; below, the brand with a muted line and round outlined social buttons beside three or four columns of quiet links; a thin rule above the copyright, legal links, a globe language button and Back to top. On a phone the link columns become rows that open and close with a chevron.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-danger --color-success --surface-radius --surface-shadow --pill-radius --radius-sm --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-xs --text-sm --text-xl --font-display --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: site footer; homepage footer; saas footer; newsletter signup; multilingual site; marketing site; blog footer
 * Jobs to be done: subscribe to the newsletter; find a page I need; change the language; follow the company; get back to the top
 * Keywords: footer, newsletter, subscribe, email, language, social links, sitemap, back to top, legal
 */
/**
 * Newsletter footer: the closing block of a homepage or marketing site. The sign-up checks the address when you leave
 * the field and on send, says what is wrong beside the field, shows a busy button while it sends, then shows a
 * confirmation (focus moves to it) with a way to use another address. When the footer is narrow (a phone) each link
 * column becomes a button that opens and closes its list; wide, every list is simply shown. The language button is
 * the library's language switcher. Back to top scrolls smoothly, or jumps with reduced motion, and moves focus to the
 * top of the page. The footer rises in once as it comes into view; with reduced motion or animation off it is simply
 * there. Make it the app's own: replace SAMPLE with the real links, social accounts and languages, and pass
 * onSubscribe to send the address to the app's own list.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";
import { LanguageSwitcher, type Language } from "./language-switcher";
import { Icon } from "./icons";

export type FooterSocialKind = "x" | "linkedin" | "github" | "youtube" | "instagram";

export type FooterNewsletterProps = {
  brand: { name: string; href?: string };
  about: string;
  newsletter: { title: string; text: string; label?: string; placeholder?: string; action: string; done: { title: string; text: string } };
  onSubscribe?: (email: string) => Promise<void> | void;
  columns: Array<{ title: string; links: Array<{ label: string; href: string }> }>;
  social?: Array<{ kind: FooterSocialKind; href: string }>;
  languages?: Language[];
  language?: string;
  onLanguage?: (code: string) => void;
  legal?: Array<{ label: string; href: string }>;
  copyright: string;
  labels?: { top?: string; invalid?: string; empty?: string; failed?: string; again?: string; follow?: string };
};

const SOCIAL_NAME: Record<FooterSocialKind, string> = { x: "X", linkedin: "LinkedIn", github: "GitHub", youtube: "YouTube", instagram: "Instagram" };
/** Line glyphs drawn like the library's icons (24 by 24, 1.75 stroke). */
const SOCIAL_PATH: Record<FooterSocialKind, string> = {
  x: "M5 4l14 16M19 4 5 20",
  linkedin: "M4 4h16v16H4zM8 10.5V16M8 7.75v.01M11.5 16v-3.25a2 2 0 0 1 4 0V16M11.5 10.5V16",
  github: "M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14",
  youtube: "M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM10 9v6l5-3z",
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM17 6.75v.01",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    // Already on screen: play the entrance now, without waiting on an observer.
    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    };
    if (inView()) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.1 });
    // A scroll check backs the observer up, so the block is never left hidden.
    const onScroll = () => inView() && show();
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return [ref, state] as const;
}

export function FooterNewsletter({
  brand,
  about,
  newsletter,
  onSubscribe,
  columns,
  social = [],
  languages,
  language,
  onLanguage,
  legal = [],
  copyright,
  labels = {},
}: FooterNewsletterProps) {
  const uid = useId();
  const L = {
    top: labels.top ?? "Back to top",
    invalid: labels.invalid ?? "Enter an email like name@example.com.",
    empty: labels.empty ?? "Enter your email.",
    failed: labels.failed ?? "That didn't go through. Try again.",
    again: labels.again ?? "Use another email",
    follow: labels.follow ?? "Follow us",
  };
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [narrow, setNarrow] = useState(false);
  const [openCols, setOpenCols] = useState<number[]>([]);
  const done = useRef<HTMLDivElement>(null);
  const [root, enter] = useEnterOnce<HTMLElement>();
  const fieldId = `${uid}-email`;
  const check = (v: string) => (!v.trim() ? L.empty : EMAIL.test(v.trim()) ? "" : L.invalid);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => setNarrow(el.clientWidth < 600);
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [root]);

  useEffect(() => {
    if (sent) done.current?.focus();
  }, [sent]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const why = check(email);
    setError(why);
    if (why) {
      document.getElementById(fieldId)?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSubscribe?.(email.trim());
      setSent(email.trim());
    } catch {
      setError(L.failed);
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setSent("");
    setEmail("");
    setError("");
    requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
  };

  const toTop = () => {
    window.scrollTo({ top: 0, behavior: still() ? "auto" : "smooth" });
    const target = document.querySelector<HTMLElement>("main, h1, body > *");
    if (target) {
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  };

  return (
    <footer
      ref={root}
      className={["fl-ftn", narrow ? "is-narrow" : "", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ")}
      data-fl="b.footer-newsletter"
    >
      <div className="fl-ftn-news fl-ftn-rise" style={{ ["--i" as string]: 0 }}>
        <div className="fl-ftn-news-words">
          <h2 id={`${uid}-nt`} className="fl-ftn-news-title">
            {newsletter.title}
          </h2>
          <p className="fl-ftn-news-text">{newsletter.text}</p>
        </div>
        {sent ? (
          <div ref={done} className="fl-ftn-done" tabIndex={-1} role="status">
            <span className="fl-ftn-done-mark" aria-hidden="true">
              <Icon name="check" />
            </span>
            <div>
              <p className="fl-ftn-done-title">{newsletter.done.title}</p>
              <p className="fl-ftn-done-text">
                {newsletter.done.text} <strong>{sent}</strong>
              </p>
              <Button variant="tertiary" size={32} onClick={again}>
                {L.again}
              </Button>
            </div>
          </div>
        ) : (
          <form className="fl-ftn-form" noValidate onSubmit={submit} aria-labelledby={`${uid}-nt`}>
            <label className="fl-sr" htmlFor={fieldId}>
              {newsletter.label ?? "Email"}
            </label>
            <div className="fl-ftn-row">
              <TextField
                id={fieldId}
                type="email"
                autoComplete="email"
                size={44}
                placeholder={newsletter.placeholder ?? "you@example.com"}
                value={email}
                invalid={Boolean(error)}
                aria-describedby={error ? `${uid}-err` : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                onBlur={() => email && setError(check(email))}
              />
              <Button type="submit" size={44} busy={busy}>
                {newsletter.action}
              </Button>
            </div>
            <p id={`${uid}-err`} className="fl-ftn-err" aria-live="polite">
              {error ? (
                <>
                  <Icon name="alert" />
                  {error}
                </>
              ) : null}
            </p>
          </form>
        )}
      </div>

      <div className="fl-ftn-main">
        <div className="fl-ftn-brand fl-ftn-rise" style={{ ["--i" as string]: 1 }}>
          {brand.href ? (
            <a className="fl-ftn-name" href={brand.href}>
              {brand.name}
            </a>
          ) : (
            <span className="fl-ftn-name">{brand.name}</span>
          )}
          <p className="fl-ftn-about">{about}</p>
          {social.length ? (
            <ul className="fl-ftn-social" aria-label={L.follow}>
              {social.map((s) => (
                <li key={s.kind}>
                  <a className="fl-ftn-soc" href={s.href} aria-label={SOCIAL_NAME[s.kind]} title={SOCIAL_NAME[s.kind]}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                      <path d={SOCIAL_PATH[s.kind]} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="fl-ftn-cols">
          {columns.map((c, i) => {
            const open = !narrow || openCols.includes(i);
            return (
              <nav key={c.title} className={open ? "fl-ftn-col fl-ftn-rise is-open" : "fl-ftn-col fl-ftn-rise"} style={{ ["--i" as string]: i + 2 }} aria-labelledby={`${uid}-c${i}`}>
                <h2 className="fl-ftn-coltitle" id={`${uid}-c${i}`}>
                  {narrow ? (
                    <button
                      type="button"
                      className="fl-ftn-colbtn"
                      aria-expanded={open}
                      aria-controls={`${uid}-l${i}`}
                      onClick={() => setOpenCols((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))}
                    >
                      {c.title}
                      <Icon name="chevron-down" />
                    </button>
                  ) : (
                    c.title
                  )}
                </h2>
                <div className="fl-ftn-links-wrap" id={`${uid}-l${i}`} inert={!open}>
                  <ul className="fl-ftn-links">
                    {c.links.map((l) => (
                      <li key={l.label}>
                        <a href={l.href}>{l.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>
            );
          })}
        </div>
      </div>

      <div className="fl-ftn-bottom">
        <p className="fl-ftn-copy">{copyright}</p>
        {legal.length ? (
          <ul className="fl-ftn-legal">
            {legal.map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="fl-ftn-tools">
          {languages?.length ? <LanguageSwitcher languages={languages} defaultValue={language} onChange={onLanguage} align="end" /> : null}
          <Button variant="tertiary" size={40} icon="arrow" className="fl-ftn-top" onClick={toTop}>
            {L.top}
          </Button>
        </div>
      </div>
    </footer>
  );
}

// flowcode:sample
const SAMPLE = {
  brand: { name: "Slotwise", href: "#home" },
  about: "Online booking for clinics. Fewer no-shows, quieter phones.",
  newsletter: {
    title: "Tips for a fuller calendar",
    text: "One short email a month. No spam, unsubscribe anytime.",
    label: "Email",
    placeholder: "you@clinic.com",
    action: "Subscribe",
    done: { title: "You're subscribed", text: "The next issue goes to" },
  },
  columns: [
    { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Integrations", href: "#integrations" }, { label: "Roadmap", href: "#roadmap" }] },
    { title: "Company", links: [{ label: "About", href: "#about" }, { label: "Careers", href: "#careers" }, { label: "Press", href: "#press" }] },
    { title: "Help", links: [{ label: "Help center", href: "#help" }, { label: "Contact", href: "#contact" }, { label: "Status", href: "#status" }] },
  ],
  social: [
    { kind: "x" as const, href: "#x" },
    { kind: "linkedin" as const, href: "#linkedin" },
    { kind: "youtube" as const, href: "#youtube" },
    { kind: "instagram" as const, href: "#instagram" },
  ],
  languages: [
    { code: "en", native: "English", name: "English" },
    { code: "es", native: "Español", name: "Spanish" },
    { code: "fr", native: "Français", name: "French" },
    { code: "de", native: "Deutsch", name: "German" },
  ] as Language[],
  legal: [{ label: "Privacy", href: "#privacy" }, { label: "Terms", href: "#terms" }, { label: "Cookies", href: "#cookies" }],
  copyright: "© 2026 Slotwise, Inc.",
};

export default function FooterNewsletterPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Footer">
      <div className="fl-wrap">
        <FooterNewsletter {...SAMPLE} language="en" onSubscribe={() => new Promise<void>((resolve) => setTimeout(resolve, 700))} />
      </div>
    </section>
  );
}
