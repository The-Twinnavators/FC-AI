/** @flowcode-library order-history · Order history (Shop)
 * Catalog ID: p.order-history (pattern)
 * Function: The order history pattern (p.order-history): a customer's past orders newest first, searchable and filtered by status, each opening to its items, delivery progress and address, with Buy again, an invoice dialog and Cancel order (confirmed first) while it is still being prepared.
 * Use it as: import { OrderHistory } from "./order-history"; <OrderHistory title="Your orders" orders={[{ id, number, placed: "2026-10-18", status: "processing"|"shipped"|"delivered"|"canceled", items: [{ name, variant?, qty, price }], shipping?, address, tracking? }]} currency?="USD" locale? statuses?={{ processing: { label, tone } }} onBuyAgain?={(id) => ...} onCancel?={(id) => ...} />
 * Built from: c.text-field.outlined, c.select.outlined, c.badge.status, c.button.secondary, c.button.tertiary, c.button.destructive, c.modal.confirm, c.modal.danger, c.empty-state
 * Look: A panel with a search field and a status select over rows of orders: the order number and date, a count of items, the total and a colored status pill, and a Details button; an open order shows its items with quantities and prices, a three-stop delivery line (Placed, Shipped, Delivered) and the address, then Buy again, Invoice and Cancel order. On a phone each order is a stacked card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --duration-base --duration-slow --ease-out --focus-ring
 * Use cases: order history; my orders; past purchases; customer account orders; purchase history; returns and reorders; shop account
 * Jobs to be done: find an order I placed; see where my order is; buy something again; get an invoice; cancel an order before it ships
 * Keywords: orders, order history, purchases, invoice, reorder, tracking, shop account, ecommerce
 */
/**
 * Order history: what a shopper sees under "Your orders". Orders sit newest first; the search matches the order number
 * or any item's name, and the select narrows them by status. Details opens an order in place (the row grows; closed
 * content is inert): its items, a delivery line that fills to where it is, the address and tracking number, and the
 * actions. Buy again reports what went into the bag; Invoice opens a dialog with the totals; Cancel order asks first
 * (the person makes the final click) and then marks it canceled. A status line announces each change, and an empty
 * result offers Clear filters. Use it on a shop's account pages. Make it the app's own: replace SAMPLE with the
 * customer's real orders and wire onBuyAgain and onCancel to the shop's own data.
 * Built from c.text-field, c.select, c.badge.status, c.button, c.modal and c.empty-state.
 * Adapted from Creative Tim UI (MIT License, Copyright (c) 2025 Creative Tim): its order history block (orders with
 * status badges and a details action).
 */
import { useId, useMemo, useState } from "react";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

export type OrderStatus = "processing" | "shipped" | "delivered" | "canceled";
export type OrderLine = { name: string; variant?: string; qty: number; price: number };
export type Order = {
  id: string;
  number: string;
  /** ISO date it was placed: "2026-10-18". */
  placed: string;
  status: OrderStatus;
  items: OrderLine[];
  shipping?: number;
  address: string;
  tracking?: string;
};

export type OrderHistoryProps = {
  title: string;
  orders: Order[];
  currency?: string;
  locale?: string;
  /** The words and badge tone for each status. */
  statuses?: Record<OrderStatus, { label: string; tone: BadgeTone }>;
  onBuyAgain?: (id: string) => void;
  onCancel?: (id: string) => void;
};

const STATUSES: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  processing: { label: "Preparing", tone: "info" },
  shipped: { label: "On the way", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  canceled: { label: "Canceled", tone: "neutral" },
};
const STOPS = ["Placed", "Shipped", "Delivered"];
const REACHED: Record<OrderStatus, number> = { processing: 0, shipped: 1, delivered: 2, canceled: -1 };

export function OrderHistory({ title, orders: given, currency = "USD", locale = "en-US", statuses = STATUSES, onBuyAgain, onCancel }: OrderHistoryProps) {
  const uid = useId();
  const [orders, setOrders] = useState(given);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Order | null>(null);
  const [cancel, setCancel] = useState<Order | null>(null);
  const [said, setSaid] = useState("");

  const money = (n: number) => n.toLocaleString(locale, { style: "currency", currency });
  const date = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  const subtotal = (o: Order) => o.items.reduce((a, l) => a + l.qty * l.price, 0);
  const total = (o: Order) => subtotal(o) + (o.shipping ?? 0);
  const count = (o: Order) => o.items.reduce((a, l) => a + l.qty, 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...orders]
      .sort((a, b) => b.placed.localeCompare(a.placed))
      .filter((o) => status === "all" || o.status === status)
      .filter((o) => !q || o.number.toLowerCase().includes(q) || o.items.some((l) => l.name.toLowerCase().includes(q)));
  }, [orders, query, status]);

  const clear = () => {
    setQuery("");
    setStatus("all");
    setSaid("Filters cleared.");
    document.getElementById(`${uid}-q`)?.focus();
  };

  return (
    <div className="fl-oh" data-fl="p.order-history">
      <div className="fl-oh-head">
        <h3 id={`${uid}-title`}>{title}</h3>
        <div className="fl-oh-tools">
          <label className="fl-oh-search">
            <span className="fl-sr">Search orders</span>
            <Icon name="search" />
            <TextField id={`${uid}-q`} size={40} type="search" placeholder="Order or item" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="fl-oh-filter">
            <span className="fl-sr">Status</span>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | OrderStatus)}
              options={[{ value: "all", label: "All orders" }, ...(Object.keys(statuses) as OrderStatus[]).map((k) => ({ value: k, label: statuses[k].label }))]}
            />
          </label>
        </div>
      </div>
      <p className="fl-oh-sum" aria-live="polite">
        {shown.length === 1 ? "1 order" : `${shown.length} orders`}
      </p>

      {shown.length === 0 ? (
        <div className="fl-oh-empty" data-fl="c.empty-state">
          <Icon name="cart" />
          <strong>No orders match</strong>
          <p>Try another word or status.</p>
          <Button variant="secondary" size={40} onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="fl-oh-list" aria-labelledby={`${uid}-title`}>
          {shown.map((o) => {
            const isOpen = open === o.id;
            const st = statuses[o.status];
            const reached = REACHED[o.status];
            return (
              <li key={o.id} className={isOpen ? "fl-oh-order is-open" : "fl-oh-order"}>
                <div className="fl-oh-row">
                  <span className="fl-oh-id">
                    <strong>{o.number}</strong>
                    <time dateTime={o.placed}>{date(o.placed)}</time>
                  </span>
                  <span className="fl-oh-items">{count(o) === 1 ? "1 item" : `${count(o)} items`}</span>
                  <span className="fl-oh-total">{money(total(o))}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Button variant="tertiary" size={32} icon="chevron-down" iconAt="end" className="fl-oh-toggle" aria-expanded={isOpen} aria-controls={`${uid}-${o.id}`} aria-label={`Details for order ${o.number}`} onClick={() => setOpen(isOpen ? null : o.id)}>
                    Details
                  </Button>
                </div>
                <div className="fl-oh-more" id={`${uid}-${o.id}`} inert={!isOpen}>
                  <div>
                    <div className="fl-oh-detail">
                      <ul className="fl-oh-lines" aria-label={`Items in order ${o.number}`}>
                        {o.items.map((l) => (
                          <li key={l.name + (l.variant ?? "")}>
                            <span className="fl-oh-thumb" aria-hidden="true">
                              {l.name.slice(0, 1)}
                            </span>
                            <span className="fl-oh-line">
                              <strong>{l.name}</strong>
                              <span>{[l.variant, `Qty ${l.qty}`].filter(Boolean).join(" · ")}</span>
                            </span>
                            <span className="fl-oh-price">{money(l.qty * l.price)}</span>
                          </li>
                        ))}
                        <li className="fl-oh-subtotal">
                          <span>Shipping</span>
                          <span>{o.shipping ? money(o.shipping) : "Free"}</span>
                        </li>
                      </ul>
                      <div className="fl-oh-side">
                        {reached >= 0 ? (
                          <ol className="fl-oh-track" aria-label="Delivery" style={{ ["--fl-oh-at" as string]: reached / (STOPS.length - 1) }}>
                            {STOPS.map((s, i) => (
                              <li key={s} className={i <= reached ? "is-done" : undefined} aria-current={i === reached ? "step" : undefined}>
                                <span aria-hidden="true" />
                                {s}
                                {i <= reached ? <span className="fl-sr"> (done)</span> : null}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="fl-oh-note">This order was canceled and refunded.</p>
                        )}
                        <dl className="fl-oh-facts">
                          <div>
                            <dt>Deliver to</dt>
                            <dd>{o.address}</dd>
                          </div>
                          {o.tracking ? (
                            <div>
                              <dt>Tracking</dt>
                              <dd>{o.tracking}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    </div>
                    <div className="fl-oh-actions">
                      <Button
                        variant="secondary"
                        size={40}
                        icon="refresh"
                        onClick={() => {
                          onBuyAgain?.(o.id);
                          setSaid(`${count(o) === 1 ? "1 item" : `${count(o)} items`} from ${o.number} added to your bag.`);
                        }}
                      >
                        Buy again
                      </Button>
                      <Button variant="tertiary" size={40} icon="download" onClick={() => setInvoice(o)}>
                        Invoice
                      </Button>
                      {o.status === "processing" ? (
                        <Button variant="destructive" size={40} onClick={() => setCancel(o)}>
                          Cancel order
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="fl-oh-said" role="status" aria-live="polite">
        {said}
      </p>

      {invoice ? (
        <Modal title={`Invoice ${invoice.number}`} description={`Placed ${date(invoice.placed)}`} confirmLabel="Done" cancelLabel="Close" onClose={() => setInvoice(null)}>
          <table className="fl-oh-invoice">
            <caption className="fl-sr">Invoice lines</caption>
            <tbody>
              {invoice.items.map((l) => (
                <tr key={l.name + (l.variant ?? "")}>
                  <th scope="row">
                    {l.name} × {l.qty}
                  </th>
                  <td>{money(l.qty * l.price)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Shipping</th>
                <td>{invoice.shipping ? money(invoice.shipping) : "Free"}</td>
              </tr>
              <tr className="fl-oh-invoice-total">
                <th scope="row">Total</th>
                <td>{money(total(invoice))}</td>
              </tr>
            </tbody>
          </table>
        </Modal>
      ) : null}

      {cancel ? (
        <Modal
          variant="danger"
          icon="alert"
          title={`Cancel order ${cancel.number}?`}
          description={`${money(total(cancel))} goes back to your card in 3 to 5 days.`}
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          onConfirm={() => {
            setOrders((list) => list.map((o) => (o.id === cancel.id ? { ...o, status: "canceled" } : o)));
            onCancel?.(cancel.id);
            setSaid(`Order ${cancel.number} canceled.`);
            // The Cancel order button is gone, so focus goes back to the order's Buy again button.
            const id = cancel.id;
            window.setTimeout(() => document.getElementById(`${uid}-${id}`)?.querySelector<HTMLElement>(".fl-oh-actions button")?.focus(), 0);
          }}
          onClose={() => setCancel(null)}
        />
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Your orders",
  orders: [
    {
      id: "o1",
      number: "#10482",
      placed: "2026-10-19",
      status: "processing" as OrderStatus,
      items: [
        { name: "Speckled mug", variant: "Oat, 12 oz", qty: 2, price: 28 },
        { name: "Linen tea towel", variant: "Sage", qty: 1, price: 16 },
      ],
      shipping: 6,
      address: "Ana Ruiz, 214 Alder Street, Portland, OR 97214",
    },
    {
      id: "o2",
      number: "#10431",
      placed: "2026-10-11",
      status: "shipped" as OrderStatus,
      items: [{ name: "Serving bowl", variant: "Large, cobalt", qty: 1, price: 64 }],
      shipping: 0,
      address: "Ana Ruiz, 214 Alder Street, Portland, OR 97214",
      tracking: "1Z 999 AA1 0123 4567 84",
    },
    {
      id: "o3",
      number: "#10377",
      placed: "2026-09-28",
      status: "delivered" as OrderStatus,
      items: [
        { name: "Dinner plate", variant: "Set of 4, chalk", qty: 1, price: 96 },
        { name: "Bud vase", variant: "Moss", qty: 3, price: 18 },
      ],
      shipping: 0,
      address: "Ana Ruiz, 214 Alder Street, Portland, OR 97214",
      tracking: "1Z 999 AA1 0123 4521 09",
    },
    {
      id: "o4",
      number: "#10302",
      placed: "2026-09-02",
      status: "canceled" as OrderStatus,
      items: [{ name: "Teapot", variant: "Charcoal", qty: 1, price: 72 }],
      shipping: 6,
      address: "Ana Ruiz, 214 Alder Street, Portland, OR 97214",
    },
    {
      id: "o5",
      number: "#10255",
      placed: "2026-08-14",
      status: "delivered" as OrderStatus,
      items: [{ name: "Speckled mug", variant: "Ink, 12 oz", qty: 4, price: 28 }],
      shipping: 0,
      address: "Ana Ruiz, 214 Alder Street, Portland, OR 97214",
      tracking: "1Z 999 AA1 0123 4410 33",
    },
  ],
};

export default function OrderHistorySheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <OrderHistory {...SAMPLE} />
      </div>
    </section>
  );
}
