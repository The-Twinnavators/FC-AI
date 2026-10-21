/** @flowcode-library dialog-scroll · Long dialog with sticky footer (Dialogs and drawers)
 * Catalog ID: p.scroll-dialog (pattern)
 * Function: A dialog for long text people must read before they agree: title, reading bar and contents stay pinned on top, the body scrolls, and the footer with the agree box and buttons stays pinned at the bottom; agreeing unlocks once the end has been reached.
 * Use it as: import { ScrollDialog } from "./dialog-scroll"; <ScrollDialog open={open} onClose={() => setOpen(false)} title description? sections={[{ id, title, paragraphs: [string] }]} requireRead?={true} agreeLabel? acceptLabel? declineLabel? onAccept={() => ...} onDecline?={() => ...} labels?={{ contents, close, next, readFirst, reachedEnd, progress }} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.checkbox
 * Look: A centered rounded panel over a dimmed page; a pinned header with the title, a close button, a thin accent reading bar and a row of section names with one sliding underline; the text scrolls between; a pinned footer with an agree box, Decline and an accent Accept that wakes once it can be pressed.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --surface-radius --surface-shadow-overlay --space-2 --space-3 --space-4 --space-5 --text-sm --text-md --duration-base --ease-out --ease-spring --focus-ring
 * Use cases: terms of service; membership agreement; privacy policy update; waiver; release notes; data processing agreement; onboarding policy
 * Jobs to be done: read the terms before I agree; jump to the section I care about; know how much is left to read; agree or decline in one place
 * Keywords: dialog, modal, sticky footer, sticky header, terms, agreement, scroll, reading progress, accept, decline
 */
/**
 * Scroll dialog: a modal for a long read. It is a native <dialog> opened with showModal, so focus stays inside it and
 * Escape closes it; focus returns to the button that opened it, and the page behind does not scroll. Only the body
 * scrolls: the header (title, close, a reading bar and the contents row) and the footer (agree box and buttons) stay
 * put, so the way out and the way forward are always in reach. The contents row marks the section being read with one
 * sliding underline and jumps to a section on click. With requireRead the agree box stays off until the end has been
 * reached, and the footer says so; Accept is on only once the box is ticked. The person makes the final click.
 * Make it the app's own: pass the real sections; keep requireRead for terms people must accept.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its dialog's sticky footer example (a terms of service
 * dialog with a scrolling body between a pinned header and footer), rewritten without its dependencies.
 */
/**
 * How to try it
 * - Press "Read the terms": the dialog opens over the page.
 * - Scroll the text: the bar fills and the underline slides to the section you're in.
 * - Press a section name to jump there; Next section steps through.
 * - At the end, tick the box and press Accept; or press Decline, the X or Escape.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Button
 * ("./buttons-variants") and Checkbox ("./checkboxes-radios"), and its inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The
 * styles are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece
 * runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";

// ── p.scroll-dialog: pinned header and footer around a scrolling read. ──

export type ScrollSection = { id: string; title: string; paragraphs: string[] };
type ScrollLabels = { contents: string; close: string; next: string; readFirst: string; reachedEnd: string; progress: string };

const LABELS: ScrollLabels = {
  contents: "Sections",
  close: "Close",
  next: "Next section",
  readFirst: "Read to the end to agree.",
  reachedEnd: "You've reached the end.",
  progress: "Read",
};

export function ScrollDialog({
  open,
  onClose,
  title,
  description,
  sections,
  requireRead = true,
  agreeLabel = "I've read and agree to these terms",
  acceptLabel = "Accept",
  declineLabel = "Decline",
  onAccept,
  onDecline,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  sections: ScrollSection[];
  requireRead?: boolean;
  agreeLabel?: string;
  acceptLabel?: string;
  declineLabel?: string;
  onAccept: () => void;
  onDecline?: () => void;
  labels?: Partial<ScrollLabels>;
}) {
  const L = { ...LABELS, ...labels };
  const uid = useId().replace(/:/g, "");
  const dlg = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const [read, setRead] = useState(0);
  const [atEnd, setAtEnd] = useState(!requireRead);
  const [agreed, setAgreed] = useState(false);
  const [current, setCurrent] = useState(sections[0]?.id ?? "");
  const [said, setSaid] = useState("");
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);

  // Open and close the native dialog; lock the page behind it while open.
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.classList.add("fl-sdl-locked");
      setRead(0);
      setAgreed(false);
      setAtEnd(!requireRead);
      setSaid("");
      setCurrent(sections[0]?.id ?? "");
      if (body.current) body.current.scrollTop = 0;
    } else if (!open && d.open) d.close();
    return () => document.documentElement.classList.remove("fl-sdl-locked");
  }, [open]);

  const onScroll = () => {
    const el = body.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const k = max <= 0 ? 1 : el.scrollTop / max;
    setRead(k);
    if (k > 0.98 && !atEnd) {
      setAtEnd(true);
      setSaid(L.reachedEnd);
    }
    // The section whose heading has passed the top third of the box is the one being read.
    const top = el.getBoundingClientRect().top + el.clientHeight / 3;
    let at = sections[0]?.id ?? "";
    for (const s of sections) {
      const h = el.querySelector<HTMLElement>(`#${uid}-${s.id}`);
      if (h && h.getBoundingClientRect().top <= top) at = s.id;
    }
    if (k > 0.98) at = sections[sections.length - 1]?.id ?? at;
    setCurrent(at);
  };

  // The underline sits under the current section's name and slides to the next; the row scrolls to keep it in view.
  useLayoutEffect(() => {
    const b = tabs.current?.querySelector<HTMLElement>(`[data-sec="${current}"]`);
    if (!b) return;
    setBar({ x: b.offsetLeft, w: b.offsetWidth });
    const row = tabs.current!;
    if (b.offsetLeft < row.scrollLeft || b.offsetLeft + b.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollTo({ left: b.offsetLeft - 16 });
  }, [current, open]);

  const jump = (id: string) => {
    const el = body.current;
    const h = el?.querySelector<HTMLElement>(`#${uid}-${id}`);
    if (!el || !h) return;
    el.scrollTo({ top: h.offsetTop - el.offsetTop - 8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off" ? "auto" : "smooth" });
    h.focus({ preventScroll: true });
  };
  const idx = sections.findIndex((s) => s.id === current);
  const nextId = sections[idx + 1]?.id;

  return (
    <dialog
      ref={dlg}
      className="fl-sdl"
      aria-labelledby={`${uid}-t`}
      aria-describedby={description ? `${uid}-d` : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fl-sdl-panel">
        <header className="fl-sdl-head">
          <div className="fl-sdl-titles">
            <h2 id={`${uid}-t`} className="fl-sdl-title">
              {title}
            </h2>
            {description ? (
              <p id={`${uid}-d`} className="fl-sdl-desc">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="tertiary" size={32} icon="close" iconOnly onClick={onClose}>
            {L.close}
          </Button>
          <div className="fl-sdl-progress" role="progressbar" aria-label={L.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(read * 100)}>
            <span style={{ transform: `scaleX(${read})` }} />
          </div>
          <nav className="fl-sdl-tabs" aria-label={L.contents} ref={tabs}>
            {sections.map((s) => (
              <button key={s.id} type="button" data-sec={s.id} className="fl-sdl-tab" aria-current={s.id === current ? "location" : undefined} onClick={() => jump(s.id)}>
                {s.title}
              </button>
            ))}
            {bar ? <span className="fl-sdl-bar" style={{ translate: `${bar.x}px 0`, width: bar.w }} aria-hidden="true" /> : null}
          </nav>
        </header>
        <div ref={body} className="fl-sdl-body" onScroll={onScroll} tabIndex={0} role="region" aria-label={title}>
          {sections.map((s, i) => (
            <section key={s.id} className="fl-sdl-sec" aria-labelledby={`${uid}-${s.id}`}>
              <h3 id={`${uid}-${s.id}`} className="fl-sdl-h" tabIndex={-1}>
                <span className="fl-sdl-n">{i + 1}</span>
                {s.title}
              </h3>
              {s.paragraphs.map((p, k) => (
                <p key={k}>{p}</p>
              ))}
            </section>
          ))}
        </div>
        <footer className="fl-sdl-foot">
          <div className="fl-sdl-agree">
            <Checkbox label={agreeLabel} checked={agreed} disabled={!atEnd} onChange={(e) => setAgreed(e.currentTarget.checked)} size={18} />
            <p className="fl-sdl-said" role="status">
              {atEnd ? said : L.readFirst}
            </p>
          </div>
          <div className="fl-sdl-btns">
            {!atEnd && nextId ? (
              <Button variant="tertiary" size={40} icon="chevron-down" iconAt="end" onClick={() => jump(nextId)}>
                {L.next}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size={40}
              onClick={() => {
                onDecline?.();
                onClose();
              }}
            >
              {declineLabel}
            </Button>
            <Button
              variant="primary"
              size={40}
              disabled={!agreed}
              onClick={() => {
                onAccept();
                onClose();
              }}
            >
              {acceptLabel}
            </Button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}

// ── The reference sheet: a studio's membership terms. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Dialogs",
  title: "Read, then agree",
  lede: "A long read with the way out always in reach.",
  card: { name: "Studio membership", text: "Open studio, two firings a month, shelf space.", open: "Read the terms", pending: "Not accepted", accepted: "Accepted", declined: "Declined" },
  dialog: { title: "Membership terms", description: "Updated October 1, 2026. About 4 minutes to read." },
  sections: [
    {
      id: "membership",
      title: "Membership",
      paragraphs: [
        "Your membership starts on the day you pay and renews every month until you cancel. It covers open studio hours, two kiln firings a month and one shelf in the drying room.",
        "Memberships are for one person. Guests may join you twice a month after signing their own waiver at the front desk.",
      ],
    },
    {
      id: "studio",
      title: "Studio use",
      paragraphs: [
        "Open studio runs Tuesday to Sunday, 10 AM to 9 PM. Wheels are first come, first served; please limit sessions to two hours when others are waiting.",
        "Clean your wheel, tools and table before you leave. Unlabeled work on shared shelves is moved to the lost-and-found shelf after seven days.",
        "Only studio clay and glazes may be fired. Ask staff before bringing in outside materials, so they can be tested first.",
      ],
    },
    {
      id: "firing",
      title: "Firing",
      paragraphs: [
        "Staff load and fire every kiln. Place finished work on the bisque or glaze shelf with your label, and expect it back within ten days.",
        "Pieces sometimes crack or run in the kiln. We take care with every load but can't replace work lost in firing.",
      ],
    },
    {
      id: "safety",
      title: "Safety",
      paragraphs: [
        "Wear closed shoes in the studio. Wet-clean dust; never sweep it dry. Glaze mixing happens only in the vented glaze room.",
        "Tell staff about any injury or broken equipment right away. The first aid kit is beside the sinks.",
      ],
    },
    {
      id: "billing",
      title: "Billing and canceling",
      paragraphs: [
        "We charge your card on file on the same date each month. A failed payment pauses studio access until it's updated.",
        "Cancel any time from your account page before your renewal date. You keep access until the end of the month you've paid for. Unused firings don't carry over.",
        "We'll email you at least 30 days before any change to these terms or to the price.",
      ],
    },
  ],
};

export default function DialogScrollPreview() {
  const d = SAMPLE;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"pending" | "accepted" | "declined">("pending");
  const opener = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="dialog-scroll-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="dialog-scroll-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <div className="fl-sdl-card">
          <div>
            <p className="fl-sdl-card-name">{d.card.name}</p>
            <p className="fl-sdl-card-text">{d.card.text}</p>
          </div>
          <p className={`fl-sdl-state is-${state}`} role="status">
            <Icon name={state === "accepted" ? "check" : state === "declined" ? "close" : "info"} />
            {d.card[state]}
          </p>
          <Button ref={opener} variant="secondary" size={40} icon="info" onClick={() => setOpen(true)}>
            {d.card.open}
          </Button>
        </div>
        <ScrollDialog
          open={open}
          onClose={() => {
            setOpen(false);
            opener.current?.focus();
          }}
          title={d.dialog.title}
          description={d.dialog.description}
          sections={d.sections}
          onAccept={() => setState("accepted")}
          onDecline={() => setState("declined")}
        />
      </div>
    </section>
  );
}
