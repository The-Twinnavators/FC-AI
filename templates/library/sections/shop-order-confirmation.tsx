/** @flowcode-library shop-order-confirmation · Order confirmation (Shop)
 * Catalog ID: b.shop-order-confirmation (block)
 * Function: The thank-you page after checkout (b.shop-order-confirmation): a drawn tick and the order number, a delivery line with the arrival date, items and totals, a delivery address that can change for a short while (checked before saving), the payment summary, text updates (sending, sent, failed), print, and Cancel order (asked first) while the window is open.
 * Use it as: import { ShopOrderConfirmation } from "./shop-order-confirmation"; <ShopOrderConfirmation order={{ number, placed: "2026-10-21T14:45", name, email, items: [{ id, name, variant, price(cents), qty, art? }], shipping(cents), discount?(cents), taxRate, method: { name, arrives: "2026-10-24" }, address: { street, unit?, city, state, zip }, card: { brand, last4 } }} now?={new Date()} changeMinutes?={60} shopHref? onAddressChange?={async (address) => ...} onCancel?={async () => ...} onTextUpdates?={async (phone) => ...} />
 * Built from: c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.button.destructive, c.modal.danger, c.media-frame
 * Look: A centered success header with a green tick that draws itself, "Thanks, Ana!" and the order number, a straight four-stop delivery line with the arrival date; then two white cards: the items with small square pictures and the money lines ending in a bold total, and a side card with Delivery (address and Change), Payment (card and last four) and Text updates (a phone field and Send). Continue shopping, Print receipt and Cancel order close the page.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --color-danger-surface --surface-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --text-2xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: order confirmation; thank you page; order placed; receipt page; post-purchase; order success
 * Jobs to be done: know my order went through; see when it arrives; fix a wrong address in time; get text updates; keep a receipt; cancel if I changed my mind
 * Keywords: order confirmation, thank you, receipt, order placed, delivery, cancel order, text updates, print, shop
 */
/**
 * Order confirmation: what the shopper sees right after "Place order". The tick draws itself and the totals count up.
 * The delivery line starts at Confirmed with the expected arrival. For a short while after the order (changeMinutes,
 * 60 by default) the address can be changed (checked: street, city, state and a 5-digit ZIP; Saving…, then the new
 * address) and the order can be canceled after a confirm dialog (the person makes the final click; then a canceled
 * banner with the refund). Text updates take a 10-digit US number and show Sending…, sent, or a failure with the
 * number kept. Print receipt prints the page. Make it the app's own: replace SAMPLE with the placed order and wire
 * onAddressChange, onCancel and onTextUpdates to the shop's own order system.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its cart summaries and marketing section layouts.
 */
/**
 * How to try it
 * - Watch the tick draw and the total count up. Press Change next to the address, clear City and Save: it says why.
 *   Fix it and Save: "Saving…", then the new address.
 * - Type 555 010 0000 in Text updates and Send: it fails and keeps the number. Change the end and Send again.
 * - Press Cancel order, then Keep order (nothing changes); press it again and confirm: the canceled banner shows.
 * - Press Print receipt: the print dialog opens with the page.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's TextField, Button, Modal and MediaFrame
 * ("./text-fields-states", "./buttons-variants", "./modals-dialogs", "./media-frames") and its inline icon set
 * ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the library's own
 * fl- classes in templates/library/css/r3h-order-confirm.css.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── b.shop-order-confirmation: the thank-you page with delivery, totals and a short window to change or cancel. ──

export type ConfirmAddress = { street: string; unit?: string; city: string; state: string; zip: string };
export type ConfirmOrder = {
  number: string;
  /** ISO date and time it was placed. */
  placed: string;
  name: string;
  email: string;
  items: { id: string; name: string; variant: string; /** cents */ price: number; qty: number; art?: MediaArt }[];
  /** cents */
  shipping: number;
  /** cents */
  discount?: number;
  /** Sales tax in percent of the discounted subtotal. */
  taxRate: number;
  method: { name: string; /** ISO date */ arrives: string };
  address: ConfirmAddress;
  card: { brand: string; last4: string };
};

export type ShopOrderConfirmationProps = {
  order: ConfirmOrder;
  now?: Date;
  /** How long after placing the address can change and the order can be canceled. */
  changeMinutes?: number;
  shopHref?: string;
  currency?: string;
  locale?: string;
  onAddressChange?: (address: ConfirmAddress) => Promise<void>;
  onCancel?: () => Promise<void>;
  /** Signs up for texts; throw to show it failed. */
  onTextUpdates?: (phone: string) => Promise<void>;
};

const STOPS = ["Confirmed", "Packed", "Shipped", "Delivered"];
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function motionOff() {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/** Counts up from zero once, then to each new value; shows the value straight away with motion off. */
function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(() => (motionOff() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (motionOff()) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    let start = -1;
    let raf = 0;
    const tick = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / ms);
      const now = Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      from.current = now;
      setShown(now);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}


/** Focuses an element once React has drawn it (a plain timer can run before the new state is on the page). */
function useFocusLater() {
  const want = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const find = want.current;
    if (!find) return;
    const el = find();
    if (el) {
      want.current = null;
      el.focus();
    }
  });
  return (find: () => HTMLElement | null | undefined) => {
    want.current = find;
    setTick((t) => t + 1);
  };
}

export function ShopOrderConfirmation({ order, now = new Date(), changeMinutes = 60, shopHref = "#", currency = "USD", locale = "en-US", onAddressChange, onCancel, onTextUpdates }: ShopOrderConfirmationProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const [address, setAddress] = useState(order.address);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(order.address);
  const [errors, setErrors] = useState<Partial<Record<keyof ConfirmAddress, string>>>({});
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [phone, setPhone] = useState("");
  const [sms, setSms] = useState<{ state: "idle" | "sending" | "sent" | "failed"; msg?: string }>({ state: "idle" });
  const [phoneErr, setPhoneErr] = useState("");
  const [said, setSaid] = useState("");

  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: "currency", currency });
  const placed = new Date(order.placed);
  const until = new Date(placed.getTime() + changeMinutes * 60000);
  const open = !canceled && now < until;
  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const day = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });

  const subtotal = order.items.reduce((n, i) => n + i.price * i.qty, 0);
  const discount = order.discount ?? 0;
  const tax = Math.round(((subtotal - discount) * order.taxRate) / 100);
  const total = subtotal - discount + order.shipping + tax;
  const shownTotal = useCountUp(total);
  const count = order.items.reduce((n, i) => n + i.qty, 0);
  const first = order.name.split(" ")[0];

  const startEdit = () => {
    setDraft(address);
    setErrors({});
    setEditing(true);
    focusLater(() => document.getElementById(`${uid}-street`));
  };
  const save = async () => {
    const e: Partial<Record<keyof ConfirmAddress, string>> = {};
    if (!draft.street.trim()) e.street = "Enter a street address.";
    if (!draft.city.trim()) e.city = "Enter a city.";
    if (!/^[A-Za-z]{2}$/.test(draft.state.trim())) e.state = "Use the 2-letter state.";
    if (!/^\d{5}$/.test(draft.zip.trim())) e.zip = "ZIP is 5 digits.";
    setErrors(e);
    const bad = Object.keys(e)[0];
    if (bad) {
      document.getElementById(`${uid}-${bad}`)?.focus();
      setSaid("Check the address.");
      return;
    }
    const next = { ...draft, state: draft.state.trim().toUpperCase(), street: draft.street.trim(), city: draft.city.trim(), unit: draft.unit?.trim() };
    setSaving(true);
    await (onAddressChange ? onAddressChange(next) : wait(800));
    setSaving(false);
    setAddress(next);
    setEditing(false);
    setSaid("Delivery address updated.");
    focusLater(() => document.getElementById(`${uid}-change`));
  };

  const send = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setPhoneErr("Enter a 10-digit number.");
      document.getElementById(`${uid}-phone`)?.focus();
      return;
    }
    setPhoneErr("");
    setSms({ state: "sending" });
    try {
      await (onTextUpdates ? onTextUpdates(digits) : wait(800));
      setSms({ state: "sent", msg: `We'll text (${digits.slice(0, 3)}) •••-${digits.slice(6)} when it ships.` });
    } catch (err) {
      setSms({ state: "failed", msg: err instanceof Error ? err.message : "Couldn't reach that number. Check it and try again." });
    }
  };

  const confirmCancel = () => {
    setCanceling(true);
    void (onCancel ? onCancel() : wait(900)).then(() => {
      setCanceling(false);
      setAsking(false);
      setCanceled(true);
      setSaid(`Order ${order.number} canceled.`);
      focusLater(() => document.getElementById(`${uid}-head`));
    });
    return false as const;
  };

  const addrField = (k: keyof ConfirmAddress, label: string, opts?: { short?: boolean; numeric?: boolean; max?: number }) => (
    <div className={opts?.short ? "fl-oc-field is-short" : "fl-oc-field"}>
      <label htmlFor={`${uid}-${k}`}>{label}</label>
      <TextField
        id={`${uid}-${k}`}
        size={40}
        value={draft[k] ?? ""}
        inputMode={opts?.numeric ? "numeric" : undefined}
        maxLength={opts?.max}
        invalid={Boolean(errors[k])}
        aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
        onChange={(e) => {
          const v = opts?.numeric ? e.target.value.replace(/\D/g, "") : e.target.value;
          setDraft((d) => ({ ...d, [k]: v }));
          if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
        }}
      />
      {errors[k] ? (
        <p className="fl-oc-err" id={`${uid}-${k}-err`}>
          <Icon name="alert" />
          {errors[k]}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="fl-oc" data-fl="b.shop-order-confirmation">
      <header className="fl-oc-hero">
        {canceled ? (
          <span className="fl-oc-mark is-canceled" aria-hidden="true">
            <Icon name="close" />
          </span>
        ) : (
          <svg className="fl-oc-tick" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27l7 7 15-16" />
          </svg>
        )}
        <h2 id={`${uid}-head`} tabIndex={-1}>
          {canceled ? "Order canceled" : `Thanks, ${first}!`}
        </h2>
        <p>
          {canceled ? (
            <>
              Order <strong>{order.number}</strong> is canceled. {money(total)} goes back to your {order.card.brand} in 3 to 5 days.
            </>
          ) : (
            <>
              Order <strong>{order.number}</strong> is confirmed. A receipt is on its way to {order.email}.
            </>
          )}
        </p>
      </header>

      {!canceled ? (
        <div className="fl-oc-track fl-oc-card">
          <p>
            Arrives <strong>{day(order.method.arrives)}</strong> · {order.method.name}
          </p>
          <ol aria-label="Delivery progress">
            {STOPS.map((s, i) => (
              <li key={s} className={i === 0 ? "is-done" : undefined} aria-current={i === 0 ? "step" : undefined}>
                <span aria-hidden="true" />
                {s}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="fl-oc-cols">
        <section className="fl-oc-card fl-oc-items" aria-labelledby={`${uid}-items`}>
          <h3 id={`${uid}-items`}>
            Your order <span>{count === 1 ? "1 item" : `${count} items`}</span>
          </h3>
          <ul>
            {order.items.map((i, n) => (
              <li key={i.id} style={{ ["--fl-oc-i" as string]: Math.min(n, 5) }}>
                <span className="fl-oc-pic">
                  <MediaFrame ratio="1-1" art={i.art ?? "a"} alt="" />
                </span>
                <span className="fl-oc-what">
                  <strong>{i.name}</strong>
                  <span>
                    {i.variant} · Qty {i.qty}
                  </span>
                </span>
                <span className="fl-oc-num">{money(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="fl-oc-money">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            {discount ? (
              <div className="is-saving">
                <dt>Discount</dt>
                <dd>−{money(discount)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Shipping</dt>
              <dd>{order.shipping ? money(order.shipping) : "Free"}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{money(tax)}</dd>
            </div>
            <div className="fl-oc-total">
              <dt>{canceled ? "Refund" : "Total"}</dt>
              <dd>
                <span aria-hidden="true">{money(shownTotal)}</span>
                <span className="fl-sr">{money(total)}</span>
              </dd>
            </div>
          </dl>
        </section>

        <div className="fl-oc-side">
          <section className="fl-oc-card" aria-labelledby={`${uid}-ship`}>
            <div className="fl-oc-row">
              <h3 id={`${uid}-ship`}>Delivery</h3>
              {open && !editing ? (
                <Button id={`${uid}-change`} variant="tertiary" size={32} icon="pencil" onClick={startEdit} aria-label="Change delivery address">
                  Change
                </Button>
              ) : null}
            </div>
            {editing ? (
              <form
                className="fl-oc-form"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                {addrField("street", "Street address")}
                {addrField("unit", "Apartment, suite (optional)")}
                <div className="fl-oc-trio">
                  {addrField("city", "City")}
                  {addrField("state", "State", { short: true, max: 2 })}
                  {addrField("zip", "ZIP", { short: true, numeric: true, max: 5 })}
                </div>
                <div className="fl-oc-formbtns">
                  <Button variant="tertiary" size={40} disabled={saving} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size={40} busy={saving}>
                    {saving ? "Saving…" : "Save address"}
                  </Button>
                </div>
              </form>
            ) : (
              <address className="fl-oc-addr">
                {order.name}
                <br />
                {address.street}
                {address.unit ? `, ${address.unit}` : ""}
                <br />
                {address.city}, {address.state} {address.zip}
              </address>
            )}
            <p className="fl-oc-note">
              {canceled ? "Nothing will ship." : open ? `You can change or cancel until ${time(until)}.` : "It's being packed, so the address is set."}
            </p>
          </section>

          <section className="fl-oc-card" aria-labelledby={`${uid}-pay`}>
            <h3 id={`${uid}-pay`}>Payment</h3>
            <p className="fl-oc-card-line">
              <Icon name="lock" />
              {order.card.brand} ending in {order.card.last4}
            </p>
          </section>

          {!canceled ? (
            <section className="fl-oc-card" aria-labelledby={`${uid}-sms`}>
              <h3 id={`${uid}-sms`}>Text updates</h3>
              {sms.state === "sent" ? (
                <p className="fl-oc-ok" role="status">
                  <Icon name="check" />
                  {sms.msg}
                </p>
              ) : (
                <form
                  className="fl-oc-sms"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <label htmlFor={`${uid}-phone`} className="fl-sr">
                    Mobile number
                  </label>
                  <TextField
                    id={`${uid}-phone`}
                    size={40}
                    type="tel"
                    autoComplete="tel-national"
                    placeholder="Mobile number"
                    value={phone}
                    invalid={Boolean(phoneErr) || sms.state === "failed"}
                    aria-describedby={phoneErr || sms.state === "failed" ? `${uid}-phone-err` : undefined}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneErr("");
                      if (sms.state === "failed") setSms({ state: "idle" });
                    }}
                  />
                  <Button type="submit" variant="secondary" size={40} busy={sms.state === "sending"}>
                    {sms.state === "sending" ? "Sending…" : "Send"}
                  </Button>
                  {phoneErr || sms.state === "failed" ? (
                    <p className="fl-oc-err" id={`${uid}-phone-err`} role="alert">
                      <Icon name="alert" />
                      {phoneErr || sms.msg}
                    </p>
                  ) : null}
                </form>
              )}
            </section>
          ) : null}
        </div>
      </div>

      <div className="fl-oc-actions">
        <Button href={shopHref} variant="primary" size={44} icon="arrow" iconAt="end">
          Continue shopping
        </Button>
        <Button variant="secondary" size={44} icon="download" onClick={() => window.print()}>
          Print receipt
        </Button>
        {open ? (
          <Button variant="destructive" size={44} onClick={() => setAsking(true)}>
            Cancel order
          </Button>
        ) : null}
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {asking ? (
        <Modal
          variant="danger"
          icon="alert"
          title={`Cancel order ${order.number}?`}
          description={`${money(total)} goes back to your ${order.card.brand} in 3 to 5 days.`}
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          busy={canceling}
          busyLabel="Canceling…"
          onConfirm={confirmCancel}
          onClose={() => setAsking(false)}
        />
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE: ShopOrderConfirmationProps = {
  order: {
    number: "FC-10492",
    placed: "2026-10-21T14:45",
    name: "Ana Ruiz",
    email: "ana@example.com",
    items: [
      { id: "mug", name: "Speckled stoneware mug", variant: "Oat · 12 oz", price: 2800, qty: 2, art: "a" },
      { id: "towel", name: "Linen tea towel", variant: "Sage", price: 1600, qty: 1, art: "c" },
      { id: "bowl", name: "Serving bowl", variant: "Large · Cobalt", price: 6400, qty: 1, art: "b" },
    ],
    shipping: 1495,
    discount: 1360,
    taxRate: 8.25,
    method: { name: "Express", arrives: "2026-10-24" },
    address: { street: "214 Alder Street", city: "Portland", state: "OR", zip: "97214" },
    card: { brand: "Visa", last4: "4242" },
  },
  now: new Date("2026-10-21T15:02"),
  changeMinutes: 60,
  onTextUpdates: async (phone) => {
    await wait(800);
    if (phone.endsWith("0000")) throw new Error("Couldn't reach that number. Check it and try again.");
  },
};

export default function ShopOrderConfirmationPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Order confirmation">
      <div className="fl-wrap fl-wrap--narrow">
        <ShopOrderConfirmation {...SAMPLE} />
      </div>
    </section>
  );
}
