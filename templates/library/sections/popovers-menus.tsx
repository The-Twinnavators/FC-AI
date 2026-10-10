/** @flowcode-library popovers-menus · Popovers: a panel on a button, and how it differs from a tooltip (Dialogs and drawers)
 * Use cases: a filter panel; a date picker; a share panel; a profile card on a name; an action menu
 * Jobs to be done: change a few things without leaving the page; look something up in place; act on one row
 * Keywords: popover, menu, dropdown panel, flyout, anchored, placement, dismiss, aria-expanded
 */
/**
 * A popover is a small panel anchored to the control that opened it, holding things you can press. That last part is
 * what separates it from a tooltip: a tooltip closes when the pointer leaves, so nothing in one can be reached.
 *
 * All three open from their own button, close on Escape and on a press outside, and give focus back to the button they
 * came from. The filter panel keeps its changes until you apply them, which is the one thing a popover must get right:
 * it is a small form, not a menu, and closing it by accident should not throw the work away.
 *
 * Make it the app's own: anchor it to the control, never to the page. If it has more than about six things in it, it
 * wants to be a drawer.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  filters: [
    { id: "enquiry", label: "Enquiry" },
    { id: "booked", label: "Booked" },
    { id: "shot", label: "Shot" },
    { id: "delivered", label: "Delivered" },
  ],
  share: ["Anyone with the link", "Only the client", "Only me"],
};

/** Everything a popover has to do, in one place: outside press, Escape, and focus back. */
function usePopover(open: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);
  return box;
}

function FilterPopover({ say }: { say: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(["booked"]);
  const [applied, setApplied] = useState<string[]>(["booked"]);
  const box = usePopover(open, () => {
    setDraft(applied);
    setOpen(false);
  });

  return (
    <div className="fl-ctl-pop-wrap" ref={box}>
      <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--40" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
        <Icon name="filter" /> Status
        {applied.length ? <span className="fl-ctl-badge fl-ctl-badge--soft fl-ctl-badge--info">{applied.length}</span> : null}
        <Icon name="chevron-down" />
      </button>
      {open ? (
        <div className="fl-ctl-pop" role="dialog" aria-label="Filter by status">
          <ul className="fl-ctl-choice-list">
            {SAMPLE.filters.map((f) => (
              <li key={f.id}>
                <label className="fl-ctl-choice">
                  <input
                    type="checkbox"
                    className="fl-ctl-check fl-ctl-check--16"
                    checked={draft.includes(f.id)}
                    onChange={() => setDraft((v) => (v.includes(f.id) ? v.filter((x) => x !== f.id) : [...v, f.id]))}
                  />
                  <span>
                    <strong>{f.label}</strong>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="fl-ctl-pop-foot">
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" onClick={() => setDraft([])}>
              Clear
            </button>
            <button
              type="button"
              className="fl-btn fl-btn--primary fl-ctl-btn--32"
              onClick={() => {
                setApplied(draft);
                setOpen(false);
                say(draft.length ? `Filtered to ${draft.length} status${draft.length === 1 ? "" : "es"}` : "Filter cleared");
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SharePopover({ say }: { say: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(SAMPLE.share[1]);
  const box = usePopover(open, () => setOpen(false));

  return (
    <div className="fl-ctl-pop-wrap" ref={box}>
      <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--40" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
        <Icon name="send" /> Share
      </button>
      {open ? (
        <div className="fl-ctl-pop fl-ctl-pop--wide" role="dialog" aria-label="Share this gallery">
          <p className="fl-ctl-matrix-kind">Who can open it</p>
          <ul className="fl-ctl-choice-list">
            {SAMPLE.share.map((s) => (
              <li key={s}>
                <label className="fl-ctl-choice">
                  <input type="radio" name="share-who" className="fl-ctl-check fl-ctl-check--16" checked={who === s} onChange={() => setWho(s)} />
                  <span>
                    <strong>{s}</strong>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="fl-ctl-pop-link">
            <input className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32" readOnly value="northlight.example/g/riverside" aria-label="Link to this gallery" />
            <button
              type="button"
              className="fl-btn fl-btn--primary fl-ctl-btn--32"
              onClick={() => {
                setOpen(false);
                say(`Link copied — ${who.toLowerCase()}`);
              }}
            >
              <Icon name="copy" /> Copy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CardPopover() {
  const [open, setOpen] = useState(false);
  const box = usePopover(open, () => setOpen(false));
  return (
    <div className="fl-ctl-pop-wrap" ref={box}>
      <button type="button" className="fl-ctl-pop-name" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
        Ana Moreau
      </button>
      {open ? (
        <div className="fl-ctl-pop" role="dialog" aria-label="About Ana Moreau">
          <div className="fl-ctl-pop-person">
            <span className="fl-ctl-avatar fl-ctl-avatar--40" aria-hidden="true">
              AM
            </span>
            <span>
              <strong>Ana Moreau</strong>
              <span className="fl-ctl-matrix-what">Second photographer &middot; here since 2021</span>
            </span>
          </div>
          <p className="fl-ctl-matrix-what">On four shoots this month. Last signed in an hour ago.</p>
          <div className="fl-ctl-pop-foot">
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32">
              <Icon name="mail" /> Message
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PopoversMenus() {
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-pop-list">
        <li>
          <p className="fl-ctl-matrix-kind">A small form</p>
          <p className="fl-ctl-matrix-what">Change several things, then apply. Pressing outside puts your changes back rather than keeping half of them.</p>
          <FilterPopover say={setSaid} />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">A panel with one job</p>
          <p className="fl-ctl-matrix-what">A choice and the thing it produces, side by side.</p>
          <SharePopover say={setSaid} />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">On a name</p>
          <p className="fl-ctl-matrix-what">A card about whatever you pressed. Anchored to the word, not the page.</p>
          <CardPopover />
        </li>
      </ul>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Open one, then press Escape, or press outside it."}
      </p>

      <div className="fl-ctl-sizes">
        <h3>Popover, tooltip or menu</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>Tooltip</strong>
            <span className="fl-ctl-matrix-what">Names a control. Nothing inside it can be pressed. Opens on hover and on focus.</span>
          </li>
          <li>
            <strong>Menu</strong>
            <span className="fl-ctl-matrix-what">A list of actions, one press each, and it closes. Arrow keys move through it.</span>
          </li>
          <li>
            <strong>Popover</strong>
            <span className="fl-ctl-matrix-what">A panel with several things in it. Opens on press only, and stays until you are done.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
