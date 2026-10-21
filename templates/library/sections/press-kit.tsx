/** @flowcode-library press-kit · Press and media kit (Contact)
 * Catalog ID: b.press-kit (block)
 * Function: The press kit block (b.press-kit): the company boilerplate with Copy text, quick facts, brand and photo assets as cards filtered by kind (each with a format choice and Copy link), a press contact with Copy email, and recent coverage.
 * Use it as: import { PressKit } from "./press-kit"; <PressKit label="Press kit" about={{ title, text }} facts={[{ label, value }]} kinds={[{ id, label }]} assets={[{ id, kind, title, text, formats: [{ id, label, size?, href }], picture?: { src?, alt } }]} contact={{ name, role, email, phone? }} coverage?={[{ id, outlet, title, date, href }]} labels?={{ copyText, copyLink, copyEmail, copied, failed, manual, all, format, coverage, contact, facts }} onCopy?={(what, text) => ...} />  // links point at the company's own files
 * Built from: c.media-frame, c.chip.filter, c.button.secondary, c.button.tertiary
 * Look: Two columns. On the left a white card with the bold boilerplate title, the paragraph in a quiet sunken box and a Copy text button, then a two-column list of facts with muted labels and bold values, then a press contact card with initials, name, role and Copy email. On the right a row of filter chips over a grid of asset cards: each a picture with a small kind pill, a bold name, a muted line, a row of small format pills (SVG, PNG, PDF) with sizes and a Copy link button that turns to a green tick. Under the assets a list of recent coverage with outlet, headline, date and an outward arrow.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-xs --text-sm --text-md --text-lg --font-display --weight-semibold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: press page; media kit; newsroom; brand assets; logo download page; about us page; investor relations
 * Jobs to be done: get the logo in the right format; copy the official company description; find who to contact for press; see recent coverage
 * Keywords: press kit, media kit, newsroom, brand assets, logos, boilerplate, press contact, coverage, copy link
 */
/**
 * Press and media kit: what a journalist needs in one place, with nothing to hunt for. The boilerplate copies in one
 * press; each asset lets you pick a format and copy its link (nothing downloads here, so the page never surprises
 * anyone with a file); the press contact's email copies too. Every copy confirms in place with a tick for two seconds
 * and says so aloud, and where the clipboard is blocked the text shows in a selected box to copy by hand. Chips filter the asset cards; the grid
 * keeps its height steady while cards fade in. Make it the app's own: point every format at the company's real files.
 * Adapted from Landwind (MIT, Copyright (c) 2022 Themesberg) and AstroWind (MIT, Copyright (c) 2023 onWidget): their
 * feature-card grids, content columns and contact blocks.
 */
/**
 * How to try it
 * - Press Copy text under the boilerplate: it turns into a green Copied for two seconds.
 * - Press Photos in the chip row: only the photo cards stay. Press All to bring the rest back.
 * - On a logo card pick PNG, then Copy link: the copied address ends in the PNG file.
 * - Press Copy email on the contact card; Tab through everything and watch the focus rings.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's MediaFrame, Chip and Button
 * ("./media-frames", "./chips-tags", "./buttons-variants") and its inline icon set ("./icons"). Nothing else: no
 * package and nothing fetched. The styles are the library's own fl- classes in templates/library/css/r4c-press-kit.css.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { Icon } from "./icons";
import { MediaFrame } from "./media-frames";

export type PressFormat = {
  id: string;
  label: string;
  size?: string;
  href: string;
};
export type PressAsset = {
  id: string;
  kind: string;
  title: string;
  text: string;
  formats: PressFormat[];
  picture?: { src?: string; alt: string };
};
export type PressCoverage = {
  id: string;
  outlet: string;
  title: string;
  date: string;
  href: string;
};

export type PressKitProps = {
  label: string;
  about: { title: string; text: string };
  facts: Array<{ label: string; value: string }>;
  kinds: Array<{ id: string; label: string }>;
  assets: PressAsset[];
  contact: { name: string; role: string; email: string; phone?: string };
  coverage?: PressCoverage[];
  labels?: Partial<{
    copyText: string;
    copyLink: string;
    copyEmail: string;
    copied: string;
    failed: string;
    manual: string;
    all: string;
    format: string;
    coverage: string;
    contact: string;
    facts: string;
    assets: string;
  }>;
  onCopy?: (what: string, text: string) => void;
};

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: plays now when already on screen, else on view, and never later than 1.2s. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
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
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && show(),
      { threshold: 0.1 },
    );
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

/** Copies text; falls back to a hidden textarea where the async clipboard is blocked. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const absolute = (href: string) => {
  try {
    return new URL(href, window.location.href).href;
  } catch {
    return href;
  }
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const ART = ["a", "b", "c", "d", "e"] as const;

export function PressKit({
  label,
  about,
  facts,
  kinds,
  assets,
  contact,
  coverage = [],
  labels = {},
  onCopy,
}: PressKitProps) {
  const uid = useId();
  const L = {
    copyText: labels.copyText ?? "Copy text",
    copyLink: labels.copyLink ?? "Copy link",
    copyEmail: labels.copyEmail ?? "Copy email",
    copied: labels.copied ?? "Copied",
    failed: labels.failed ?? "Couldn't copy. Copy it from the box instead.",
    manual: labels.manual ?? "Copy from here",
    all: labels.all ?? "All",
    format: labels.format ?? "Format",
    coverage: labels.coverage ?? "In the news",
    contact: labels.contact ?? "Press contact",
    facts: labels.facts ?? "Quick facts",
    assets: labels.assets ?? "Brand assets",
  };
  const [kind, setKind] = useState("all");
  const [fmt, setFmt] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  // Where the clipboard is blocked, the text shows in a selected box instead.
  const [manual, setManual] = useState<{ key: string; text: string } | null>(
    null,
  );
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (manual) box.current?.select();
  }, [manual]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [root, enter] = useEnterOnce<HTMLDivElement>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (key: string, what: string, text: string) => {
    const ok = await copyText(text);
    clearTimeout(timer.current);
    if (ok) {
      setManual(null);
      setDone(key);
      setSaid(`${L.copied}: ${what}.`);
      onCopy?.(key, text);
      timer.current = setTimeout(() => setDone(null), 2000);
    } else {
      setDone(null);
      setManual({ key, text });
      setSaid(L.failed);
    }
  };

  const shown = assets.filter((a) => kind === "all" || a.kind === kind);
  const kindLabel = (id: string) => kinds.find((k) => k.id === id)?.label ?? id;
  const cls = [
    "fl-prk",
    enter === "wait" ? "is-waiting" : "",
    enter === "in" ? "is-entering" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const fallback = (key: string) =>
    manual?.key === key ? (
      <label className="fl-prk-manual">
        <span>{L.manual}</span>
        <input
          ref={box}
          readOnly
          value={manual.text}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => setManual(null)}
        />
      </label>
    ) : null;
  const tick = (key: string, idle: string, icon: string) =>
    done === key
      ? { label: L.copied, icon: "check", className: "fl-prk-copy is-done" }
      : { label: idle, icon, className: "fl-prk-copy" };

  return (
    <div ref={root} className={cls} data-fl="b.press-kit">
      <div className="fl-prk-grid">
        <div className="fl-prk-side">
          <section
            className="fl-prk-card fl-prk-rise"
            style={{ "--i": 0 } as CSSProperties}
            aria-labelledby={`${uid}-about`}
          >
            <h3 id={`${uid}-about`} className="fl-prk-h">
              {about.title}
            </h3>
            <p id={`${uid}-boiler`} className="fl-prk-boiler">
              {about.text}
            </p>
            {(() => {
              const t = tick("about", L.copyText, "copy");
              return (
                <Button
                  variant="secondary"
                  size={40}
                  icon={t.icon}
                  className={t.className}
                  onClick={() => copy("about", about.title, about.text)}
                >
                  {t.label}
                </Button>
              );
            })()}
            {fallback("about")}
            <h4 className="fl-prk-sub">{L.facts}</h4>
            <dl className="fl-prk-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            className="fl-prk-card fl-prk-contact fl-prk-rise"
            style={{ "--i": 1 } as CSSProperties}
            aria-labelledby={`${uid}-contact`}
          >
            <h3 id={`${uid}-contact`} className="fl-prk-sub">
              {L.contact}
            </h3>
            <div className="fl-prk-person">
              <span className="fl-prk-initials" aria-hidden="true">
                {initials(contact.name)}
              </span>
              <span>
                <strong>{contact.name}</strong>
                <span className="fl-prk-muted">{contact.role}</span>
              </span>
            </div>
            <p className="fl-prk-lines">
              <a href={`mailto:${contact.email}`}>
                <Icon name="mail" />
                {contact.email}
              </a>
              {contact.phone ? (
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>
                  <Icon name="phone" />
                  {contact.phone}
                </a>
              ) : null}
            </p>
            {(() => {
              const t = tick("email", L.copyEmail, "copy");
              return (
                <Button
                  variant="tertiary"
                  size={40}
                  icon={t.icon}
                  className={t.className}
                  onClick={() => copy("email", contact.email, contact.email)}
                >
                  {t.label}
                </Button>
              );
            })()}
            {fallback("email")}
          </section>
        </div>

        <div className="fl-prk-main">
          <section aria-labelledby={`${uid}-assets`} className="fl-prk-assets">
            <h3 id={`${uid}-assets`} className="fl-prk-h">
              {L.assets}
            </h3>
            <div
              className="fl-prk-chips"
              role="group"
              aria-label={`${label}: ${L.assets}`}
            >
              {[{ id: "all", label: L.all }, ...kinds].map((k) => (
                <Chip
                  key={k.id}
                  selected={kind === k.id}
                  onClick={() => setKind(k.id)}
                >
                  {k.label}
                  <span className="fl-prk-n">
                    {k.id === "all"
                      ? assets.length
                      : assets.filter((a) => a.kind === k.id).length}
                  </span>
                </Chip>
              ))}
            </div>
            <ul className="fl-prk-list">
              {shown.map((a, i) => {
                const chosen =
                  a.formats.find((f) => f.id === fmt[a.id]) ?? a.formats[0];
                const t = tick(a.id, L.copyLink, "link");
                return (
                  <li
                    key={`${kind}-${a.id}`}
                    className="fl-prk-asset fl-prk-rise"
                    style={{ "--i": i + 2 } as CSSProperties}
                  >
                    <div className="fl-prk-pic">
                      <MediaFrame
                        ratio="16-9"
                        src={a.picture?.src}
                        alt={a.picture?.alt ?? ""}
                        art={ART[assets.indexOf(a) % ART.length]}
                      />
                      <span className="fl-prk-kind">{kindLabel(a.kind)}</span>
                    </div>
                    <div className="fl-prk-body">
                      <h4 className="fl-prk-title">{a.title}</h4>
                      <p className="fl-prk-muted">{a.text}</p>
                      {a.formats.length > 1 ? (
                        <div
                          className="fl-prk-formats"
                          role="radiogroup"
                          aria-label={`${L.format}: ${a.title}`}
                        >
                          {a.formats.map((f) => (
                            <label key={f.id} className="fl-prk-format">
                              <input
                                type="radio"
                                name={`${uid}-${a.id}`}
                                value={f.id}
                                checked={chosen?.id === f.id}
                                onChange={() =>
                                  setFmt((m) => ({ ...m, [a.id]: f.id }))
                                }
                              />
                              <span>
                                {f.label}
                                {f.size ? <small>{f.size}</small> : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : chosen ? (
                        <p className="fl-prk-one">
                          {chosen.label}
                          {chosen.size ? <small>{chosen.size}</small> : null}
                        </p>
                      ) : null}
                      {chosen ? (
                        <Button
                          variant="secondary"
                          size={40}
                          icon={t.icon}
                          className={t.className}
                          onClick={() =>
                            copy(
                              a.id,
                              `${a.title} (${chosen.label})`,
                              absolute(chosen.href),
                            )
                          }
                        >
                          {t.label}
                          <span className="fl-sr">
                            : {a.title}, {chosen.label}
                          </span>
                        </Button>
                      ) : null}
                      {fallback(a.id)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {coverage.length ? (
            <section
              aria-labelledby={`${uid}-news`}
              className="fl-prk-news fl-prk-rise"
              style={{ "--i": 6 } as CSSProperties}
            >
              <h3 id={`${uid}-news`} className="fl-prk-h">
                {L.coverage}
              </h3>
              <ul>
                {coverage.map((c) => (
                  <li key={c.id}>
                    <a href={c.href} className="fl-prk-story">
                      <span className="fl-prk-outlet">{c.outlet}</span>
                      <span className="fl-prk-headline">{c.title}</span>
                      <time className="fl-prk-muted">{c.date}</time>
                      <Icon name="external" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Press",
  title: "Press and media kit",
  lede: "Logos, photos and facts about Frontdesk, ready to use.",
  about: {
    title: "About Frontdesk",
    text: "Frontdesk is booking and payments software for independent studios, salons and clinics. Founded in Portland in 2019, it helps more than 5,200 businesses in 14 countries take bookings, cut no-shows and get paid on time.",
  },
  facts: [
    { label: "Founded", value: "2019, Portland" },
    { label: "Team", value: "48 people" },
    { label: "Customers", value: "5,200+" },
    { label: "Funding", value: "$14M Series A" },
  ],
  kinds: [
    { id: "logo", label: "Logos" },
    { id: "photo", label: "Photos" },
    { id: "product", label: "Product" },
  ],
  assets: [
    {
      id: "logo-full",
      kind: "logo",
      title: "Full logo",
      text: "Mark and wordmark, for light and dark.",
      formats: [
        {
          id: "svg",
          label: "SVG",
          size: "12 KB",
          href: "/press/frontdesk-logo.svg",
        },
        {
          id: "png",
          label: "PNG",
          size: "220 KB",
          href: "/press/frontdesk-logo.png",
        },
      ],
    },
    {
      id: "logo-mark",
      kind: "logo",
      title: "Logo mark",
      text: "The square mark on its own.",
      formats: [
        {
          id: "svg",
          label: "SVG",
          size: "4 KB",
          href: "/press/frontdesk-mark.svg",
        },
        {
          id: "png",
          label: "PNG",
          size: "96 KB",
          href: "/press/frontdesk-mark.png",
        },
      ],
    },
    {
      id: "founders",
      kind: "photo",
      title: "Founders",
      text: "Maya Lindqvist and Dev Okafor.",
      formats: [
        {
          id: "jpg",
          label: "JPG",
          size: "4.2 MB",
          href: "/press/founders.jpg",
        },
      ],
      picture: { alt: "The two founders at a studio front desk" },
    },
    {
      id: "office",
      kind: "photo",
      title: "Portland studio",
      text: "Where the first bookings were made.",
      formats: [
        { id: "jpg", label: "JPG", size: "3.8 MB", href: "/press/studio.jpg" },
      ],
      picture: { alt: "A bright yoga studio front desk" },
    },
    {
      id: "screens",
      kind: "product",
      title: "Product screenshots",
      text: "Calendar, payments and the mobile app.",
      formats: [
        {
          id: "zip",
          label: "ZIP",
          size: "18 MB",
          href: "/press/screenshots.zip",
        },
      ],
      picture: { alt: "The calendar screen on a laptop" },
    },
    {
      id: "guide",
      kind: "logo",
      title: "Brand guide",
      text: "Colors, type and how to use the logo.",
      formats: [
        {
          id: "pdf",
          label: "PDF",
          size: "2.1 MB",
          href: "/press/brand-guide.pdf",
        },
      ],
    },
  ],
  contact: {
    name: "Priya Nair",
    role: "Head of communications",
    email: "press@frontdesk.example",
    phone: "+1 (503) 555-0142",
  },
  coverage: [
    {
      id: "c1",
      outlet: "Portland Business Journal",
      title: "The booking app small studios swear by",
      date: "Sep 2026",
      href: "#coverage-1",
    },
    {
      id: "c2",
      outlet: "SmallBiz Weekly",
      title: "How deposits cut no-shows by a third",
      date: "Jun 2026",
      href: "#coverage-2",
    },
    {
      id: "c3",
      outlet: "Tech Northwest",
      title: "Frontdesk raises $14M to go mobile",
      date: "Feb 2026",
      href: "#coverage-3",
    },
  ],
};

export default function PressKitPreview() {
  const d = SAMPLE;
  return (
    <section
      className="fl-section fl-section--canvas"
      aria-labelledby="press-kit-title"
    >
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="press-kit-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <PressKit
          label={d.title}
          about={d.about}
          facts={d.facts}
          kinds={d.kinds}
          assets={d.assets}
          contact={d.contact}
          coverage={d.coverage}
        />
      </div>
    </section>
  );
}
