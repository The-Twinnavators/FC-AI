/** @flowcode-library shop-cart-page · Cart page (Shop)
 * Catalog ID: b.shop-cart-page (block)
 * Function: The full shopping bag page (b.shop-cart-page) with working quantities, undo, promo code, delivery options and totals.
 * Use it as: import { ShopCartPage } from "./shop-cart-page"; <ShopCartPage heading lede? currency? maxQty? items={[{id,name,variant,price(cents),qty,tone?}]} promo?={{code,percent}} delivery={[{id,name,note,price,freeOver?}]}/>
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined
 * Look: A title over two columns: a bordered table of bag lines with quantity steppers and remove buttons, and a summary panel with promo code, delivery choices, totals and a full-width checkout button.
 * Tokens: --space-4 --space-5 --color-surface --color-border --color-text-muted --color-accent --color-success --color-danger --radius-md
 * Use cases: cart page; shopping basket; checkout review; order summary; promo code; delivery options; online store
 * Jobs to be done: review my order before paying; apply a discount code; choose a delivery option; remove items i do not want
 * Keywords: cart, basket, promo code, delivery, order summary, table, checkout, shop
 */
/**
 * Cart page: the full shopping bag before checkout. A table of items with quantity steppers and remove (with undo),
 * a promo code box (one code works; anything else shows an inline error), delivery choices and an order summary that
 * keeps the totals right. Use it as the step between browsing and paying. Make it the app's own: replace SAMPLE with
 * the real bag, promo rules and delivery options, and send "Go to checkout" to the real payment step.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";

const LABELS = {
  cols: { product: "Product", price: "Price", qty: "Quantity", total: "Total" },
  remove: "Remove",
  removed: "removed.",
  undo: "Undo",
  promo: {
    label: "Promo code",
    placeholder: "e.g. WELCOME10",
    apply: "Apply",
    removeCode: "Remove code",
    errorEmpty: "Enter a promo code first.",
    errorInvalid: "That code is not valid. Check the spelling, or try another.",
  },
  deliveryLegend: "Delivery",
  summary: { title: "Order summary", subtotal: "Subtotal", discount: "Discount", delivery: "Delivery", free: "Free", total: "Total" },
  checkout: "Go to checkout",
  secure: "No payment is taken in this preview.",
  placed: "Order ready for payment. In the real app this is where checkout would open.",
  emptyTitle: "Your bag is empty",
  emptyText: "Have a look around the shop. Anything you add will show up here.",
  browse: "Browse the shop",
};

export type CartLine = { id: string; name: string; variant: string; price: number; qty: number; tone?: string };
export type DeliveryOption = { id: string; name: string; note: string; price: number; freeOver?: number };

export type ShopCartPageProps = {
  heading: string;
  lede?: string;
  /** Currency symbol before prices; "$" when left out. */
  currency?: string;
  /** Largest quantity per line; 9 when left out. */
  maxQty?: number;
  /** The bag's lines. Prices are in cents. */
  items: CartLine[];
  /** One working promo code and the percent it takes off. Leave out for no promo box. */
  promo?: { code: string; percent: number };
  delivery: DeliveryOption[];
};

type Item = CartLine;

function MinusPlus({ plus }: { plus?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d={plus ? "M5 12h14M12 5v14" : "M5 12h14"} />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
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

export function ShopCartPage({ heading, lede, currency = "$", maxQty = 9, items: initial, promo, delivery: deliveryOptions }: ShopCartPageProps) {
  const d = LABELS;
  const money = (cents: number) => `${currency}${(cents / 100).toFixed(2)}`;
  const [items, setItems] = useState<Item[]>(initial);
  const [removed, setRemoved] = useState<{ item: Item; index: number } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [applied, setApplied] = useState(false);
  const [delivery, setDelivery] = useState(deliveryOptions[0]?.id ?? "");
  const [placed, setPlaced] = useState(false);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);
  const discount = applied && promo ? Math.round((subtotal * promo.percent) / 100) : 0;
  const costOf = (o: DeliveryOption) => (o.freeOver !== undefined && subtotal - discount >= o.freeOver ? 0 : o.price);
  const option = deliveryOptions.find((o) => o.id === delivery) ?? deliveryOptions[0];
  const deliveryCost = option ? costOf(option) : 0;
  const total = subtotal - discount + deliveryCost;

  const setQty = (id: string, qty: number) => {
    setPlaced(false);
    setItems((list) => list.map((i) => (i.id === id ? { ...i, qty } : i)));
  };
  const remove = (id: string) => {
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    setPlaced(false);
    setRemoved({ item: items[index], index });
    setItems((list) => list.filter((i) => i.id !== id));
    window.setTimeout(() => document.getElementById("shop-cart-page-undo")?.focus(), 0);
  };
  const undo = () => {
    if (!removed) return;
    setItems((list) => {
      const next = [...list];
      next.splice(Math.min(removed.index, next.length), 0, removed.item);
      return next;
    });
    setRemoved(null);
  };

  const applyCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value) {
      setCodeError(d.promo.errorEmpty);
      return;
    }
    if (!promo || value !== promo.code) {
      setCodeError(d.promo.errorInvalid);
      return;
    }
    setCodeError("");
    setApplied(true);
    setCode("");
  };

  if (items.length === 0 && !removed) {
    return (
      <section className="fl-section" aria-labelledby="shop-cart-page-title" data-fl="b.shop-cart-page">
        <div className="fl-wrap fl-wrap--narrow fl-shop-stage">
          <h2 id="shop-cart-page-title" className="fl-title fl-title--md">
            {heading}
          </h2>
          <div className="fl-shop-empty">
            <span className="fl-icon">
              <BagIcon />
            </span>
            <strong>{d.emptyTitle}</strong>
            <span>{d.emptyText}</span>
            <Button variant="primary" href="#shop">
              {d.browse}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="fl-section" aria-labelledby="shop-cart-page-title" data-fl="b.shop-cart-page">
      <div className="fl-wrap fl-shop-stage">
        <div className="fl-shop-bar__title">
          <h2 id="shop-cart-page-title" className="fl-title fl-title--md">
            {heading} <span className="fl-meta">({count} {count === 1 ? "item" : "items"})</span>
          </h2>
          {lede ? <p className="fl-text">{lede}</p> : null}
        </div>

        <div className="fl-shop-cart">
          <div style={{ display: "grid", gap: "var(--space-4)", minWidth: 0 }}>
            <div aria-live="polite">
              {removed && (
                <div className="fl-shop-undo">
                  <span>
                    <strong>{removed.item.name}</strong> {d.removed}
                  </span>
                  <button id="shop-cart-page-undo" type="button" className="fl-shop-link" onClick={undo}>
                    {d.undo}
                  </button>
                </div>
              )}
            </div>
            {items.length === 0 ? (
              <div className="fl-shop-empty">
                <strong>{d.emptyTitle}</strong>
                <span>{d.emptyText}</span>
              </div>
            ) : (
              <div className="fl-shop-scroll" role="region" aria-labelledby="shop-cart-page-caption" tabIndex={0}>
                <table className="fl-shop-table">
                  <caption id="shop-cart-page-caption" className="fl-sr">
                    Items in your bag
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{d.cols.product}</th>
                      <th scope="col" className="fl-shop-num">
                        {d.cols.price}
                      </th>
                      <th scope="col">{d.cols.qty}</th>
                      <th scope="col" className="fl-shop-num">
                        {d.cols.total}
                      </th>
                      <th scope="col">
                        <span className="fl-sr">{d.remove}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <th scope="row">
                          <div className="fl-shop-table__product">
                            <span className={`fl-shop-img fl-shop-img--thumb fl-shop-tone--${i.tone ?? "oat"}`} aria-hidden="true" />
                            <span>
                              <strong>{i.name}</strong>
                              <span className="fl-meta">
                                {i.variant}
                              </span>
                            </span>
                          </div>
                        </th>
                        <td className="fl-shop-num fl-shop-price">{money(i.price)}</td>
                        <td>
                          <QtyStepper id={`shop-cart-page-qty-${i.id}`} label={i.name} value={i.qty} max={maxQty} onChange={(n) => setQty(i.id, n)} />
                        </td>
                        <td className="fl-shop-num fl-shop-price">{money(i.price * i.qty)}</td>
                        <td>
                          <Button variant="tertiary" size={40} icon="trash" iconOnly onClick={() => remove(i.id)}>
                            {`${d.remove} ${i.name}`}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="fl-shop-cart__aside" aria-labelledby="shop-cart-page-summary">
            <div className="fl-shop-panel">
              <h3 id="shop-cart-page-summary">{d.summary.title}</h3>

              {promo && applied ? (
                <div className="fl-shop-applied">
                  <span>{promo?.percent}% off with {promo?.code}</span>
                  <button type="button" className="fl-shop-link" onClick={() => setApplied(false)}>
                    {d.promo.removeCode}
                  </button>
                </div>
              ) : promo ? (
                <form className="fl-field" noValidate onSubmit={applyCode}>
                  <label htmlFor="shop-cart-page-code">{d.promo.label}</label>
                  <div className="fl-shop-promo">
                    <TextField
                      id="shop-cart-page-code"
                      value={code}
                      autoComplete="off"
                      placeholder={d.promo.placeholder}
                      onChange={(e) => {
                        setCode(e.target.value);
                        if (codeError) setCodeError("");
                      }}
                      invalid={!!codeError}
                      aria-describedby={codeError ? "shop-cart-page-code-error" : undefined}
                    />
                    <Button type="submit" variant="secondary" size={40} className="fl-shop-btn--sm" style={{ minHeight: "var(--control-md)" }}>
                      {d.promo.apply}
                    </Button>
                  </div>
                  {codeError && (
                    <p id="shop-cart-page-code-error" className="fl-shop-error" role="alert">
                      {codeError}
                    </p>
                  )}
                </form>
              ) : null}

              <fieldset className="fl-shop-fieldset">
                <legend>{d.deliveryLegend}</legend>
                {deliveryOptions.map((o) => {
                  const cost = costOf(o);
                  return (
                    <label key={o.id} className="fl-shop-option">
                      <input type="radio" name="shop-cart-page-delivery" value={o.id} checked={delivery === o.id} onChange={() => setDelivery(o.id)} />
                      <span>
                        {o.name}
                        <small>{o.note}</small>
                      </span>
                      <b>{cost === 0 ? d.summary.free : money(cost)}</b>
                    </label>
                  );
                })}
              </fieldset>

              <dl className="fl-shop-sum" aria-live="polite">
                <div>
                  <dt>{d.summary.subtotal}</dt>
                  <dd>{money(subtotal)}</dd>
                </div>
                {applied && (
                  <div className="fl-shop-sum__save">
                    <dt>{d.summary.discount}</dt>
                    <dd>−{money(discount)}</dd>
                  </div>
                )}
                <div>
                  <dt>{d.summary.delivery}</dt>
                  <dd>{deliveryCost === 0 ? d.summary.free : money(deliveryCost)}</dd>
                </div>
                <div className="fl-shop-sum__total">
                  <dt>{d.summary.total}</dt>
                  <dd>{money(total)}</dd>
                </div>
              </dl>

              <Button variant="primary" className="fl-shop-btn--block" icon="lock" disabled={items.length === 0} onClick={() => setPlaced(true)}>
                {d.checkout}
              </Button>
              <p className={`fl-shop-status${placed ? " fl-shop-status--ok" : ""}`} role="status" aria-live="polite" style={{ marginTop: "calc(-1 * var(--space-2))" }}>
                {placed ? d.placed : d.secure}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: ShopCartPageProps = {
  heading: "Your bag",
  lede: "Check sizes and quantities, then pick how you would like it delivered.",
  currency: "$",
  maxQty: 9,
  items: [
    { id: "bowl", name: "Hand-thrown serving bowl", variant: "Sage · Large", price: 4600, qty: 1, tone: "sage" },
    { id: "towels", name: "Waffle tea towels, set of 2", variant: "Oat", price: 1800, qty: 2, tone: "oat" },
    { id: "jug", name: "Pouring jug", variant: "Charcoal · 600 ml", price: 3200, qty: 1, tone: "charcoal" },
  ],
  promo: { code: "STUDIO10", percent: 10 },
  delivery: [
    { id: "standard", name: "Standard", note: "3–5 working days · free over $60", price: 495, freeOver: 6000 },
    { id: "express", name: "Express", note: "Next working day if ordered by 2pm", price: 995 },
    { id: "collect", name: "Collect from the studio", note: "Ready in 2 days · 14 Mill Lane", price: 0 },
  ],
};

export default function ShopCartPagePreview() {
  return <ShopCartPage {...SAMPLE} />;
}
