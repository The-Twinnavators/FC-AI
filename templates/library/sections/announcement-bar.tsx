/** @flowcode-library announcement-bar · Announcements (Alerts and states)
 * Catalog ID: b.announcement-bar (block)
 * Function: The announcement block (b.announcement-bar): news as a top strip, a heading pill or a floating bottom notice.
 * Use it as: import { AnnouncementBar } from "./announcement-bar"; <AnnouncementBar variant?="strip"|"pill"|"floating" text link?={{label,href}} tag? icon? storageKey? closeLabel? onClose? /> (text: one sentence; link: strip = link after the text, pill = where the pill goes, floating = the action button; tag: pill's "New"; storageKey: strip stays closed on this device, change it when the message changes)
 * Variants: b.announcement-bar.strip - news for the whole site, at the very top: a slim dark bar across the page with centered text, an underlined link and a close button that is remembered on this device; b.announcement-bar.pill - a small teaser above a page heading: a rounded pill with a solid accent tag ("New"), one line of text and an arrow, linking to the news; b.announcement-bar.floating - a notice that must not be missed but can wait, such as holiday hours: a raised card pinned at the bottom of the screen with an icon, one sentence, one action and a close button; Escape closes it
 * Built from: c.button.primary, c.button.tertiary, c.button.ghost-on-accent, c.badge.status
 * Look: A dark full-width strip, a bordered pill with an accent tag, or a raised notice card at the bottom of the screen; one sentence of news and at most one action.
 * Tokens: --color-text --color-bg --color-accent --color-on-accent --color-surface --color-border --space-3 --space-5 --radius-lg
 * Use cases: announcement banner; promo bar; product update; launch news; sale announcement; site notice; whats new
 * Jobs to be done: hear about what is new; learn about a current offer; dismiss news i have seen
 * Keywords: announcement, banner, pill, notice, dismiss, news
 */
/**
 * Announcements: three ways to tell people about something new. A slim top bar with a link and a close button (stays
 * closed on this device), a small pill above a page heading, and a notice that floats at the bottom of the screen
 * with one action. Use one at a time for news, a launch or a change. Make it the app's own: replace SAMPLE, and change
 * `storageKey` whenever the top bar's message changes so everyone sees the new one.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";

export type AnnouncementVariant = "strip" | "pill" | "floating";

export type AnnouncementBarProps = {
  variant?: AnnouncementVariant;
  /** The news, one sentence. */
  text: string;
  /** strip: the link after the text. pill: where the whole pill goes. floating: the action button. */
  link?: { label: string; href: string };
  /** pill only: the small tag before the text, such as "New". */
  tag?: string;
  /** floating only: an icon name from ./icons; "clock" when left out. */
  icon?: string;
  /** strip only: remember the close on this device under this key. Change the key when the message changes. */
  storageKey?: string;
  /** strip and floating: the close button's name for screen readers. */
  closeLabel?: string;
  /** strip and floating: called after the close button or Escape closes it. */
  onClose?: () => void;
};

function readClosed(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
export function writeClosed(key: string, closed: boolean) {
  try {
    if (closed) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked: it just won't be remembered */
  }
}

export function AnnouncementBar({ variant = "strip", text, link, tag, icon = "clock", storageKey, closeLabel, onClose }: AnnouncementBarProps) {
  const [closed, setClosed] = useState(() => (variant === "strip" && storageKey ? readClosed(storageKey) : false));
  const root = useRef<HTMLElement>(null);

  // A floating notice moves focus to its close button when it appears.
  useEffect(() => {
    if (variant === "floating") root.current?.querySelector("button")?.focus();
  }, [variant]);

  function close() {
    setClosed(true);
    if (variant === "strip" && storageKey) writeClosed(storageKey, true);
    onClose?.();
  }

  if (variant === "pill") {
    const inner = (
      <>
        {tag ? (
          <Badge look="solid" tone="info">
            {tag}
          </Badge>
        ) : null}
        {text}
        <Icon name="arrow" />
      </>
    );
    return link ? (
      <a className="fl-dsp-pill" href={link.href} data-fl="b.announcement-bar.pill">
        {inner}
      </a>
    ) : (
      <span className="fl-dsp-pill" data-fl="b.announcement-bar.pill">
        {inner}
      </span>
    );
  }

  if (closed) return null;

  if (variant === "floating") {
    return (
      <section
        ref={root}
        className="fl-dsp-float"
        data-fl="b.announcement-bar.floating"
        aria-label="Notice"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <span className="fl-icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
        <p>{text}</p>
        <div className="fl-dsp-float__acts">
          {link ? (
            <Button variant="primary" size={32} href={link.href}>
              {link.label}
            </Button>
          ) : null}
          <Button variant="tertiary" size={32} icon="close" iconOnly onClick={close}>
            {closeLabel ?? "Close notice"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section ref={root} className="fl-dsp-ann" data-fl="b.announcement-bar.strip" aria-label="Announcement">
      <div className="fl-dsp-ann__row">
        <p className="fl-dsp-ann__msg">
          {text}
          {link ? <a href={link.href}>{link.label} →</a> : null}
        </p>
        <Button variant="ghost-on-accent" size={32} icon="close" iconOnly onClick={close}>
          {closeLabel ?? "Close announcement"}
        </Button>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  storageKey: "announce-gift-cards-v1",
  bar: { text: "Gift cards are here: give a class for any occasion.", link: { label: "Buy a gift card", href: "#gift-cards" } },
  pill: { tag: "New", text: "Saturday family sessions", link: { label: "Saturday family sessions", href: "#family" } },
  heading: "Make something with your hands this weekend",
  text: "Small classes, all materials included, and a kiln that fires every Friday.",
  primary: { label: "Book a class", href: "#book" },
  restore: "Show the top bar again",
  float: {
    open: "Preview the bottom notice",
    text: "The studio is closed on 25–26 December. Bookings reopen on the 27th.",
    link: { label: "See holiday hours", href: "#hours" },
    closed: "Notice closed.",
  },
};

export default function AnnouncementBarPreview() {
  const d = SAMPLE;
  // Bumped to bring the top bar back: a new key remounts it, and it reads the cleared storage again.
  const [barRun, setBarRun] = useState(0);
  const [barClosed, setBarClosed] = useState(() => readClosed(d.storageKey));
  const [floatOpen, setFloatOpen] = useState(false);
  const [status, setStatus] = useState("");
  const floatTrigger = useRef<HTMLSpanElement>(null);
  const restoreBtn = useRef<HTMLSpanElement>(null);

  function barDone() {
    setBarClosed(true);
    setStatus("Announcement closed.");
    window.setTimeout(() => restoreBtn.current?.querySelector("button")?.focus(), 0);
  }
  function openBar() {
    writeClosed(d.storageKey, false);
    setBarClosed(false);
    setBarRun((n) => n + 1);
    setStatus("");
  }
  function floatDone() {
    setFloatOpen(false);
    setStatus(d.float.closed);
    window.setTimeout(() => floatTrigger.current?.querySelector("button")?.focus(), 0);
  }

  return (
    <section className="fl-section" aria-label="Announcements">
      <div className="fl-wrap fl-dsp-ann-demo">
        <div className="fl-dsp-ann-frame">
          {!barClosed && <AnnouncementBar key={barRun} variant="strip" {...d.bar} storageKey={d.storageKey} onClose={barDone} />}
          <div className="fl-dsp-ann-frame__body">
            <AnnouncementBar variant="pill" tag={d.pill.tag} text={d.pill.text} link={d.pill.link} />
            <h2 className="fl-title">{d.heading}</h2>
            <p className="fl-lede">{d.text}</p>
            <div className="fl-actions">
              <Button variant="primary" href={d.primary.href}>
                {d.primary.label}
              </Button>
              <span ref={floatTrigger}>
                <Button variant="secondary" onClick={() => setFloatOpen(true)} disabled={floatOpen}>
                  {d.float.open}
                </Button>
              </span>
            </div>
            {barClosed && (
              <span ref={restoreBtn}>
                <Button variant="tertiary" onClick={openBar}>
                  {d.restore}
                </Button>
              </span>
            )}
          </div>
        </div>
        <p className="fl-sr" aria-live="polite">
          {status}
        </p>
      </div>

      {floatOpen && <AnnouncementBar variant="floating" text={d.float.text} link={d.float.link} onClose={floatDone} />}
    </section>
  );
}
