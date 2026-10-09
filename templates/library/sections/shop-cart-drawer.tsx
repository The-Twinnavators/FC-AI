/** @flowcode-library shop-cart-drawer · Cart drawer (Shop)
 * Use cases: shopping cart; mini cart; slide-out cart; online store; basket; checkout; order review
 * Jobs to be done: check what is in my bag; change quantities before buying; reach free delivery; check out quickly
 * Keywords: cart, bag, drawer, slide-over, checkout, quantity, undo, free delivery, shop
 */
/**
 * Cart drawer: a "Bag" button that slides the shopping bag in from the right. Change quantities, remove a line (with
 * undo), see how far it is to free delivery and the subtotal, then check out to a confirmation (no payment is taken).
 * Use it on any shop page so people can check their bag without leaving. Make it the app's own: replace SAMPLE with
 * the real bag lines, prices and delivery threshold, and point checkout at the real checkout step.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  shop: "Kiln & Thread",
  heading: "Small things for slow mornings",
  lede: "Your bag stays here while you browse. Open it to change anything.",
  bag: "Bag",
  drawerTitle: "Your bag",
  currency: "$",
  freeDeliveryAt: 6000,
  freeAway: "away from free delivery",
  freeDone: "Free delivery unlocked",
  subtotal: "Subtotal",
  taxNote: "Delivery and taxes are worked out at checkout.",
  checkout: "Check out",
  keepShopping: "Keep shopping",
  remove: "Remove",
  removed: "removed from your bag.",
  undo: "Undo",
  emptyTitle: "Your bag is empty",
  emptyText: "Pieces you add will wait here until you are ready.",
  doneTitle: "Order placed",
  doneText: "This is a preview, so no payment was taken. A confirmation would go to your email.",
  orderRef: "Order",
  done: "Done",
  maxQty: 9,
  items: [
    { id: "mug", name: "Speckled stoneware mug", variant: "Oat · 350 ml", price: 2400, qty: 1, tone: "oat" },
    { id: "apron", name: "Linen studio apron", variant: "Clay · One size", price: 3800, qty: 1, tone: "clay" },
    { id: "candle", name: "Fig leaf candle", variant: "Sage · 200 g", price: 1600, qty: 1, tone: "sage" },
  ],
};

type Item = (typeof SAMPLE.items)[number];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Traps Tab inside the panel, closes on Escape, locks page scroll and puts focus back on the trigger. */
function useModal(open: boolean, onClose: () => void, returnTo: RefObject<HTMLElement | null>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    (panel.querySelector<HTMLElement>("[data-autofocus]") ?? items()[0] ?? panel).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo.current?.focus();
    };
  }, [open, returnTo]);
  return panelRef;
}

function money(cents: number) {
  return `${SAMPLE.currency}${(cents / 100).toFixed(2)}`;
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function MinusPlus({ plus }: { plus?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d={plus ? "M5 12h14M12 5v14" : "M5 12h14"} />
    </svg>
  );
}

function QtyStepper({ id, label, value, max, onChange }: { id: string; label: string; value: number; max: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1)));
  return (
    <div className="fl-shop-qty" role="group" aria-label={`Quantity, ${label}`}>
      <button type="button" aria-label={`One fewer ${label}`} disabled={value <= 1} onClick={() => set(value - 1)}>
        <MinusPlus />
      </button>
      <label htmlFor={id} className="fl-sr">
        Quantity
      </label>
      <input id={id} type="number" inputMode="numeric" min={1} max={max} value={value} onChange={(e) => set(Number(e.target.value))} />
      <button type="button" aria-label={`One more ${label}`} disabled={value >= max} onClick={() => set(value + 1)}>
        <MinusPlus plus />
      </button>
    </div>
  );
}

export default function ShopCartDrawer() {
  const d = SAMPLE;
  const [items, setItems] = useState<Item[]>(d.items);
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState<{ item: Item; index: number } | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);
  const away = Math.max(0, d.freeDeliveryAt - subtotal);
  const progress = Math.min(100, Math.round((subtotal / d.freeDeliveryAt) * 100));

  const close = () => {
    setOpen(false);
    setRemoved(null);
    if (placed) {
      setItems([]);
      setPlaced(null);
      setStatus(`${d.doneTitle}. Your bag is now empty.`);
    }
  };
  const panelRef = useModal(open, close, triggerRef);

  const setQty = (id: string, qty: number) => setItems((list) => list.map((i) => (i.id === id ? { ...i, qty } : i)));
  const remove = (id: string) => {
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    setRemoved({ item: items[index], index });
    setItems((list) => list.filter((i) => i.id !== id));
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-undo]")?.focus(), 0);
  };
  const undo = () => {
    if (!removed) return;
    setItems((list) => {
      const next = [...list];
      next.splice(Math.min(removed.index, next.length), 0, removed.item);
      return next;
    });
    const id = removed.item.id;
    setRemoved(null);
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>(`[data-remove="${id}"]`)?.focus(), 0);
  };
  const checkout = () => {
    setRemoved(null);
    setPlaced(`${d.orderRef} #${String(Date.now()).slice(-6)}`);
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-done]")?.focus(), 0);
  };

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="shop-cart-drawer-title">
      <div className="fl-wrap fl-shop-stage">
        <div className="fl-shop-bar">
          <div className="fl-shop-bar__title">
            <span className="fl-eyebrow">{d.shop}</span>
            <h2 id="shop-cart-drawer-title" className="fl-title fl-title--md">
              {d.heading}
            </h2>
            <p className="fl-text">{d.lede}</p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="fl-btn fl-btn--primary"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              setStatus("");
              setOpen(true);
            }}
          >
            <BagIcon />
            {d.bag} ({count})
            <span className="fl-sr">{count === 1 ? "item" : "items"}</span>
          </button>
        </div>
        <p className={`fl-shop-status${status ? " fl-shop-status--ok" : ""}`} role="status" aria-live="polite">
          {status}
        </p>
      </div>

      {open && (
        <div
          className="fl-shop-backdrop fl-shop-backdrop--drawer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div ref={panelRef} className="fl-shop-drawer" role="dialog" aria-modal="true" aria-labelledby="shop-cart-drawer-dialog-title" tabIndex={-1}>
            <div className="fl-shop-drawer__head">
              <h2 id="shop-cart-drawer-dialog-title" className="fl-shop-dialog-title">
                {d.drawerTitle} {!placed && <span className="fl-meta">({count})</span>}
              </h2>
              <button type="button" className="fl-shop-icon-btn" aria-label="Close bag" onClick={close}>
                <CloseIcon />
              </button>
            </div>

            <div className="fl-shop-drawer__body">
              {placed ? (
                <div className="fl-shop-done" role="status">
                  <span className="fl-icon">
                    <Icon name="check" />
                  </span>
                  <strong>{d.doneTitle}</strong>
                  <span className="fl-meta">{placed}</span>
                  <p className="fl-text">{d.doneText}</p>
                </div>
              ) : (
                <>
                  {items.length > 0 && (
                    <div className={`fl-shop-progress${away === 0 ? " fl-shop-progress--done" : ""}`}>
                      <span aria-live="polite">
                        {away === 0 ? (
                          <strong>{d.freeDone}</strong>
                        ) : (
                          <>
                            <strong>{money(away)}</strong> {d.freeAway}
                          </>
                        )}
                      </span>
                      <div className="fl-shop-progress__track" role="progressbar" aria-label="Progress to free delivery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                        <div className="fl-shop-progress__fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  <div aria-live="polite">
                    {removed && (
                      <div className="fl-shop-undo">
                        <span>
                          <strong>{removed.item.name}</strong> {d.removed}
                        </span>
                        <button type="button" className="fl-shop-link" data-undo onClick={undo}>
                          {d.undo}
                        </button>
                      </div>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <div className="fl-shop-empty">
                      <span className="fl-icon">
                        <BagIcon />
                      </span>
                      <strong>{d.emptyTitle}</strong>
                      <span>{d.emptyText}</span>
                    </div>
                  ) : (
                    <ul className="fl-shop-lines">
                      {items.map((i) => (
                        <li key={i.id} className="fl-shop-line">
                          <span className={`fl-shop-img fl-shop-img--thumb fl-shop-tone--${i.tone}`} aria-hidden="true" />
                          <div className="fl-shop-line__main">
                            <div className="fl-shop-line__top">
                              <h3 className="fl-shop-line__name">{i.name}</h3>
                              <span className="fl-shop-price">{money(i.price * i.qty)}</span>
                            </div>
                            <span className="fl-meta">
                              {i.variant}
                              {i.qty > 1 && ` · ${money(i.price)} each`}
                            </span>
                            <div className="fl-shop-line__actions">
                              <QtyStepper id={`shop-cart-drawer-qty-${i.id}`} label={i.name} value={i.qty} max={d.maxQty} onChange={(n) => setQty(i.id, n)} />
                              <button type="button" className="fl-shop-link fl-shop-link--muted" data-remove={i.id} onClick={() => remove(i.id)}>
                                {d.remove}
                                <span className="fl-sr"> {i.name}</span>
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="fl-shop-drawer__foot">
              {placed ? (
                <button type="button" className="fl-btn fl-btn--primary fl-shop-btn--block" data-done onClick={close}>
                  {d.done}
                </button>
              ) : items.length === 0 ? (
                <button type="button" className="fl-btn fl-btn--primary fl-shop-btn--block" onClick={close}>
                  {d.keepShopping}
                </button>
              ) : (
                <>
                  <dl className="fl-shop-sum">
                    <div className="fl-shop-sum__total">
                      <dt>{d.subtotal}</dt>
                      <dd>{money(subtotal)}</dd>
                    </div>
                  </dl>
                  <p className="fl-note" style={{ margin: 0 }}>
                    {d.taxNote}
                  </p>
                  <button type="button" className="fl-btn fl-btn--primary fl-shop-btn--block" onClick={checkout}>
                    {d.checkout}
                  </button>
                  <button type="button" className="fl-btn fl-btn--secondary fl-shop-btn--block" onClick={close}>
                    {d.keepShopping}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
