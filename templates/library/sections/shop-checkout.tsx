/** @flowcode-library shop-checkout · Checkout with steps (Shop)
 * Catalog ID: b.shop-checkout (block)
 * Function: A three-step checkout (b.shop-checkout): contact, delivery address with a shipping method, then review and a test payment beside an order summary that stays in view, with promo codes, shipping, tax and a counting total; Place order shows placing, declined and confirmed states.
 * Use it as: import { ShopCheckout } from "./shop-checkout"; <ShopCheckout title lines={[{ id, name, variant, price(cents), qty, art?: "a"|"b"|"c"|"d"|"e" }]} methods={[{ id, name, note, price(cents), freeOver?(cents) }]} promos?={[{ code, label, percent?, freeShipping?, minSubtotal?(cents) }]} taxRate?={8.25} states?={["CA","OR"]} onPlaceOrder?={async (order) => ({ number })} onBackToShop?={() => ...} />
 * Built from: c.text-field.outlined, c.select.outlined, c.radio, c.checkbox, c.segmented.segmented, c.media-frame, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A gray page with two white cards: on the left a row of three named steps over one straight progress bar and the current step's fields (contact, address and shipping-method cards, or the review with Edit links and a test-card switch); on the right an order summary with square product pictures and quantity dots, a promo code field, the money lines and a bold total, pinned while the page scrolls. On a phone the summary folds into a "Show order summary" bar at the top.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --color-danger-surface --surface-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: checkout; online store checkout; guest checkout; order payment; shipping and payment; cart to order; shop checkout page
 * Jobs to be done: give my delivery details once; pick how fast it arrives; see the full price before I pay; use a promo code; place my order and know it went through
 * Keywords: checkout, steps, shipping, address, order summary, promo code, tax, place order, test payment, shop
 */
/**
 * Checkout with steps: the page between the bag and "thank you". Step 1 asks for an email, step 2 for the delivery
 * address and a shipping method (cards with prices; a method can turn free over a set subtotal), step 3 shows
 * everything with Edit links and a clearly fake test card (Approves or Declines; no money moves). Continue checks the
 * step's fields, says what is wrong under each one and puts focus on the first. Finished steps stay reachable from the
 * step row; the bar under it fills as you go. The order summary keeps the lines (remove one, then Undo), a promo code
 * (checked, with a reason when refused, removable), shipping once a method is known, tax and the total, which counts
 * to its new value. Place order shows "Placing order…", then either a declined message with the form kept or the
 * confirmation. All money is worked out in cents. Make it the app's own: replace SAMPLE with the bag, shipping
 * methods, promo codes and tax rate, and make onPlaceOrder call the shop's real payment step.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its cart and checkout summary layouts.
 */
/**
 * How to try it
 * - Press Continue with the email empty: the message shows and focus lands in the field. Type an email, Continue.
 * - Fill the address (ZIP is 5 digits) and pick Express: shipping and the total update. Continue.
 * - Type NOPE in Promo code and press Enter: it is refused. Try SAVE10, FALL15 (over $100) or FREESHIP. Remove it.
 * - On Review press Edit next to Delivery: you are back on step 2 with the fields kept. The step row goes back too.
 * - Set Test card to Declines and Place order: the declined message shows. Set Approves and place it again.
 * - Remove every line in the summary: the empty bag shows Start again. Narrow the window: the summary folds.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's TextField, Select, Radio,
 * Checkbox, Segmented, MediaFrame and Button ("./text-fields-states", "./dropdowns-states", "./checkboxes-radios",
 * "./segmented-control", "./media-frames", "./buttons-variants") and its inline icon set ("./icons"). Nothing else:
 * no package to install and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r3h-checkout.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.shop-checkout: contact, delivery and review steps beside an order summary that stays in view. ──

export type CheckoutLine = { id: string; name: string; variant: string; /** cents */ price: number; qty: number; art?: MediaArt };
export type CheckoutMethod = { id: string; name: string; note: string; /** cents */ price: number; /** Free when the discounted subtotal reaches this (cents). */ freeOver?: number };
export type CheckoutPromo = { code: string; label: string; percent?: number; freeShipping?: boolean; /** cents */ minSubtotal?: number };
export type CheckoutAddress = { first: string; last: string; street: string; unit: string; city: string; state: string; zip: string };
export type CheckoutOrder = {
  email: string;
  news: boolean;
  address: CheckoutAddress;
  method: string;
  promo?: string;
  lines: CheckoutLine[];
  totals: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  testCard: "approve" | "decline";
};

export type ShopCheckoutProps = {
  title: string;
  lines: CheckoutLine[];
  methods: CheckoutMethod[];
  promos?: CheckoutPromo[];
  /** Sales tax in percent of the discounted subtotal. */
  taxRate?: number;
  /** Choices for the State field. */
  states?: string[];
  currency?: string;
  locale?: string;
  /** Places the order; return its number, or throw to show the declined message. A test stand-in when left out. */
  onPlaceOrder?: (order: CheckoutOrder) => Promise<{ number: string }>;
  /** Where "Back to shop" goes; the sample restores the bag instead. */
  onBackToShop?: () => void;
};

const STEPS = ["Contact", "Delivery", "Review"];
const EMPTY_ADDRESS: CheckoutAddress = { first: "", last: "", street: "", unit: "", city: "", state: "", zip: "" };
type FieldKey = "email" | keyof CheckoutAddress;

function motionOff() {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}

/** Counts from the last shown value to the new one (ease-out); jumps straight there with motion off. */
function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (motionOff()) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    const ms = tokenMs("--duration-slow", 320);
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
  }, [value]);
  return shown;
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

async function testPlaceOrder(order: CheckoutOrder) {
  await wait(1100);
  if (order.testCard === "decline") throw new Error("Your card was declined. Nothing was charged. Try another card.");
  return { number: `FC-${String(Date.now()).slice(-5)}` };
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

export function ShopCheckout({ title, lines: given, methods, promos = [], taxRate = 0, states = [], currency = "USD", locale = "en-US", onPlaceOrder = testPlaceOrder, onBackToShop }: ShopCheckoutProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const root = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(given);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ line: CheckoutLine; index: number } | null>(null);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [email, setEmail] = useState("");
  const [news, setNews] = useState(false);
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [method, setMethod] = useState(methods[0]?.id ?? "");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [promoText, setPromoText] = useState("");
  const [promo, setPromo] = useState<CheckoutPromo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [testCard, setTestCard] = useState<"approve" | "decline">("approve");
  const [placing, setPlacing] = useState(false);
  const [declined, setDeclined] = useState("");
  const [placed, setPlaced] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [narrow, setNarrow] = useState(false);
  const [settled, setSettled] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const moved = useRef(false);

  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: "currency", currency });

  // The summary folds into a bar when the piece itself is narrow (not the window): a container, measured.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    setNarrow(el.getBoundingClientRect().width < 760);
    // Transitions start only after the first measure, so the summary doesn't fold shut on load.
    const raf = requestAnimationFrame(() => setSettled(true));
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 760));
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // After a step change, focus goes to the new step's heading so a screen reader starts there.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    document.getElementById(`${uid}-h${step}`)?.focus();
  }, [step, uid]);

  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const promoOk = promo && subtotal >= (promo.minSubtotal ?? 0) ? promo : null;
  const discount = promoOk?.percent ? Math.round((subtotal * promoOk.percent) / 100) : 0;
  const chosen = methods.find((m) => m.id === method) ?? methods[0];
  const shippingKnown = reached >= 1 && Boolean(chosen);
  const freeByAmount = (m: CheckoutMethod) => m.freeOver !== undefined && subtotal - discount >= m.freeOver;
  const shipCost = (m: CheckoutMethod) => (promoOk?.freeShipping || freeByAmount(m) ? 0 : m.price);
  const shipping = shippingKnown && chosen ? shipCost(chosen) : 0;
  const tax = Math.round(((subtotal - discount) * taxRate) / 100);
  const total = subtotal - discount + shipping + tax;
  const shownTotal = useCountUp(total);

  const validate = (at: number) => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (at === 0) {
      if (!email.trim()) e.email = "Enter your email.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = "Enter an email like name@example.com.";
    }
    if (at === 1) {
      if (!address.first.trim()) e.first = "Enter a first name.";
      if (!address.last.trim()) e.last = "Enter a last name.";
      if (!address.street.trim()) e.street = "Enter a street address.";
      if (!address.city.trim()) e.city = "Enter a city.";
      if (!address.state) e.state = "Choose a state.";
      if (!/^\d{5}$/.test(address.zip.trim())) e.zip = address.zip.trim() ? "ZIP is 5 digits." : "Enter a ZIP code.";
    }
    return e;
  };

  const go = (to: number) => {
    moved.current = true;
    setDeclined("");
    setStep(to);
  };
  const next = () => {
    const e = validate(step);
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      setSaid(`${Object.keys(e).length === 1 ? "1 field needs" : `${Object.keys(e).length} fields need`} attention.`);
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setSaid("");
    setReached((r) => Math.max(r, step + 1));
    go(step + 1);
  };

  const fix = (k: FieldKey, value: string) => {
    if (k === "email") setEmail(value);
    else setAddress((a) => ({ ...a, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const removeLine = (id: string) => {
    const index = lines.findIndex((l) => l.id === id);
    if (index < 0 || leaving) return;
    const line = lines[index];
    setLeaving(id);
    window.setTimeout(
      () => {
        setLines((list) => list.filter((l) => l.id !== id));
        setLeaving(null);
        setRemoved({ line, index });
        setSaid(`${line.name} removed.`);
        focusLater(() => document.getElementById(`${uid}-undo`));
      },
      motionOff() ? 0 : tokenMs("--duration-base", 200),
    );
  };
  const undo = () => {
    if (!removed) return;
    setLines((list) => {
      const nextList = [...list];
      nextList.splice(Math.min(removed.index, nextList.length), 0, removed.line);
      return nextList;
    });
    setSaid(`${removed.line.name} is back.`);
    setRemoved(null);
  };

  const applyPromo = async () => {
    const code = promoText.trim().toUpperCase();
    if (!code) {
      setPromoError("Enter a code.");
      document.getElementById(`${uid}-promo`)?.focus();
      return;
    }
    setPromoBusy(true);
    setPromoError("");
    await wait(600);
    setPromoBusy(false);
    const found = promos.find((p) => p.code.toUpperCase() === code);
    if (!found) {
      setPromoError(`${code} isn't a valid code.`);
      document.getElementById(`${uid}-promo`)?.focus();
      return;
    }
    if (found.minSubtotal && subtotal < found.minSubtotal) {
      setPromoError(`${code} needs ${money(found.minSubtotal)} or more.`);
      return;
    }
    setPromo(found);
    setPromoText("");
    setSaid(`${found.code} applied: ${found.label}.`);
    focusLater(() => document.getElementById(`${uid}-promo-remove`));
  };
  const removePromo = () => {
    if (!promo) return;
    setSaid(`${promo.code} removed.`);
    setPromo(null);
    focusLater(() => document.getElementById(`${uid}-promo`));
  };

  const place = async () => {
    if (!chosen) return;
    setPlacing(true);
    setDeclined("");
    setSaid("Placing order…");
    try {
      const res = await onPlaceOrder({
        email: email.trim(),
        news,
        address,
        method: chosen.id,
        promo: promoOk?.code,
        lines,
        totals: { subtotal, discount, shipping, tax, total },
        testCard,
      });
      setPlaced(res.number);
      setSaid(`Order ${res.number} placed.`);
      focusLater(() => document.getElementById(`${uid}-done`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "The order didn't go through. Try again.";
      setDeclined(msg);
      setSaid(msg);
      focusLater(() => document.getElementById(`${uid}-declined`));
    } finally {
      setPlacing(false);
    }
  };

  const startAgain = () => {
    if (onBackToShop) return onBackToShop();
    setLines(given);
    setRemoved(null);
    setPlaced(null);
    setStep(0);
    setReached(0);
    setPromo(null);
    setDeclined("");
    setSaid("Your bag is back.");
  };

  const field = (k: FieldKey, label: string, input: ReactNode, opts?: { wide?: boolean; optional?: boolean }) => (
    <div className={opts?.wide ? "fl-co-field is-wide" : "fl-co-field"}>
      <label htmlFor={`${uid}-${k}`}>
        {label}
        {opts?.optional ? <span> (optional)</span> : null}
      </label>
      {input}
      {errors[k] ? (
        <p className="fl-co-err" id={`${uid}-${k}-err`}>
          <Icon name="alert" />
          {errors[k]}
        </p>
      ) : null}
    </div>
  );
  const text = (k: keyof CheckoutAddress, autoComplete: string, extra?: { inputMode?: "numeric"; maxLength?: number }) => (
    <TextField
      id={`${uid}-${k}`}
      size={44}
      value={address[k]}
      autoComplete={autoComplete}
      invalid={Boolean(errors[k])}
      aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
      onChange={(e) => fix(k, extra?.inputMode === "numeric" ? e.target.value.replace(/\D/g, "") : e.target.value)}
      {...extra}
    />
  );

  if (placed) {
    return (
      <div className="fl-co" ref={root} data-fl="b.shop-checkout">
        <div className="fl-co-card fl-co-placed" role="status">
          <span className="fl-co-tick" aria-hidden="true">
            <Icon name="check" />
          </span>
          <h3 id={`${uid}-done`} tabIndex={-1}>
            Order placed
          </h3>
          <p>
            Order <strong>{placed}</strong> for <strong>{money(total)}</strong>. A receipt is on its way to {email.trim()}.
          </p>
          <p className="fl-co-muted">Test mode: no money moved.</p>
          <Button variant="secondary" size={44} onClick={startAgain}>
            Back to shop
          </Button>
        </div>
      </div>
    );
  }

  const summary = (
    <div className="fl-co-sum-body">
      {removed ? (
        <div className="fl-co-undo">
          <span>
            <strong>{removed.line.name}</strong> removed.
          </span>
          <button type="button" id={`${uid}-undo`} className="fl-co-link" onClick={undo}>
            Undo
          </button>
        </div>
      ) : null}
      <ul className="fl-co-lines" aria-label="Items">
        {lines.map((l) => (
          <li key={l.id} className={leaving === l.id ? "fl-co-line is-leaving" : "fl-co-line"}>
            <div>
              <span className="fl-co-pic">
                <MediaFrame ratio="1-1" art={l.art ?? "a"} alt="" />
                <span className="fl-co-qty" aria-label={`Quantity ${l.qty}`}>
                  {l.qty}
                </span>
              </span>
              <span className="fl-co-what">
                <strong>{l.name}</strong>
                <span>{l.variant}</span>
                {step < 2 ? (
                  <button type="button" className="fl-co-link fl-co-link--muted" disabled={Boolean(leaving)} onClick={() => removeLine(l.id)}>
                    Remove<span className="fl-sr"> {l.name}</span>
                  </button>
                ) : null}
              </span>
              <span className="fl-co-num">{money(l.price * l.qty)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="fl-co-promo">
        {promo ? (
          <div className="fl-co-chip">
            <Icon name="check" />
            <span>
              <strong>{promo.code}</strong> {promoOk ? promo.label : `needs ${money(promo.minSubtotal ?? 0)} or more`}
            </span>
            <button type="button" id={`${uid}-promo-remove`} className="fl-co-link" onClick={removePromo}>
              Remove<span className="fl-sr"> code {promo.code}</span>
            </button>
          </div>
        ) : (
          <>
            <label htmlFor={`${uid}-promo`}>Promo code</label>
            <div className="fl-co-promo-row">
              <TextField
                id={`${uid}-promo`}
                size={40}
                value={promoText}
                autoComplete="off"
                invalid={Boolean(promoError)}
                aria-describedby={promoError ? `${uid}-promo-err` : undefined}
                onChange={(e) => {
                  setPromoText(e.target.value);
                  setPromoError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyPromo();
                  }
                }}
              />
              <Button variant="secondary" size={40} busy={promoBusy} onClick={() => void applyPromo()}>
                {promoBusy ? "Checking…" : "Apply"}
              </Button>
            </div>
            {promoError ? (
              <p className="fl-co-err" id={`${uid}-promo-err`}>
                <Icon name="alert" />
                {promoError}
              </p>
            ) : null}
          </>
        )}
      </div>

      <dl className="fl-co-money">
        <div>
          <dt>Subtotal · {count === 1 ? "1 item" : `${count} items`}</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        {discount > 0 ? (
          <div className="is-saving">
            <dt>Discount ({promoOk?.code})</dt>
            <dd>−{money(discount)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Shipping{shippingKnown && chosen ? ` · ${chosen.name}` : ""}</dt>
          <dd>{shippingKnown ? (shipping === 0 ? "Free" : money(shipping)) : "Next step"}</dd>
        </div>
        <div>
          <dt>Estimated tax</dt>
          <dd>{money(tax)}</dd>
        </div>
        <div className="fl-co-total">
          <dt>Total</dt>
          <dd>
            <span aria-hidden="true">{money(shownTotal)}</span>
            <span className="fl-sr">{money(total)}</span>
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <div className={`fl-co${narrow ? " is-narrow" : ""}${settled ? " is-settled" : ""}`} ref={root} data-fl="b.shop-checkout">
      <div className="fl-co-main fl-co-card">
        <h3 className="fl-co-title">{title}</h3>
        <ol className="fl-co-steps" aria-label="Checkout steps" style={{ ["--fl-co-at" as string]: step / (STEPS.length - 1) }}>
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "is-done" : i === step ? "is-current" : undefined}>
              <button type="button" disabled={i > reached || i === step || placing} aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
                <span className="fl-co-dot" aria-hidden="true">
                  {i < step ? <Icon name="check" /> : i + 1}
                </span>
                {s}
                {i < step ? <span className="fl-sr"> (done)</span> : null}
              </button>
            </li>
          ))}
        </ol>

        {lines.length === 0 ? (
          <div className="fl-co-empty" data-fl="c.empty-state">
            <Icon name="cart" />
            <strong>Your bag is empty</strong>
            <p>Add something to check out.</p>
            <Button variant="secondary" size={44} onClick={startAgain}>
              {onBackToShop ? "Back to shop" : "Start again"}
            </Button>
          </div>
        ) : (
          <div className="fl-co-step" key={step}>
            <h4 id={`${uid}-h${step}`} tabIndex={-1}>
              {step === 0 ? "Contact" : step === 1 ? "Delivery" : "Review and pay"}
            </h4>

            {step === 0 ? (
              <div className="fl-co-grid">
                {field(
                  "email",
                  "Email",
                  <TextField
                    id={`${uid}-email`}
                    size={44}
                    type="email"
                    autoComplete="email"
                    value={email}
                    invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${uid}-email-err` : undefined}
                    onChange={(e) => fix("email", e.target.value)}
                  />,
                  { wide: true },
                )}
                <div className="fl-co-field is-wide">
                  <Checkbox label="Email me about new arrivals" checked={news} onChange={(e) => setNews(e.target.checked)} />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <>
                <div className="fl-co-grid">
                  {field("first", "First name", text("first", "given-name"))}
                  {field("last", "Last name", text("last", "family-name"))}
                  {field("street", "Street address", text("street", "address-line1"), { wide: true })}
                  {field("unit", "Apartment, suite", text("unit", "address-line2"), { wide: true, optional: true })}
                  {field("city", "City", text("city", "address-level2"))}
                  <div className="fl-co-pair">
                    {field(
                      "state",
                      "State",
                      <Select
                        id={`${uid}-state`}
                        value={address.state}
                        placeholder="Choose"
                        options={states}
                        autoComplete="address-level1"
                        invalid={Boolean(errors.state)}
                        aria-describedby={errors.state ? `${uid}-state-err` : undefined}
                        onChange={(e) => fix("state", e.target.value)}
                      />,
                    )}
                    {field("zip", "ZIP", text("zip", "postal-code", { inputMode: "numeric", maxLength: 5 }))}
                  </div>
                </div>
                <fieldset className="fl-co-methods">
                  <legend>Shipping method</legend>
                  {methods.map((m) => {
                    const cost = shipCost(m);
                    return (
                      <div key={m.id} className={method === m.id ? "fl-co-method is-on" : "fl-co-method"}>
                        <Radio
                          name={`${uid}-method`}
                          value={m.id}
                          checked={method === m.id}
                          onChange={() => setMethod(m.id)}
                          label={
                            <span className="fl-co-mline">
                              <span>{m.name}</span>
                              <span className="fl-co-num">{cost === 0 ? "Free" : money(cost)}</span>
                            </span>
                          }
                          description={cost === 0 && m.price > 0 ? `${m.note} · was ${money(m.price)}` : m.note}
                        />
                      </div>
                    );
                  })}
                </fieldset>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <dl className="fl-co-review">
                  <div>
                    <dt>Contact</dt>
                    <dd>{email.trim()}</dd>
                    <Button variant="tertiary" size={32} onClick={() => go(0)} aria-label="Edit contact">
                      Edit
                    </Button>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>
                      {address.first.trim()} {address.last.trim()}, {address.street.trim()}
                      {address.unit.trim() ? `, ${address.unit.trim()}` : ""}, {address.city.trim()}, {address.state} {address.zip}
                    </dd>
                    <Button variant="tertiary" size={32} onClick={() => go(1)} aria-label="Edit delivery">
                      Edit
                    </Button>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>
                      {chosen?.name} · {chosen?.note} · {shipping === 0 ? "Free" : money(shipping)}
                    </dd>
                    <Button variant="tertiary" size={32} onClick={() => go(1)} aria-label="Edit shipping method">
                      Edit
                    </Button>
                  </div>
                </dl>
                <div className="fl-co-pay">
                  <div className="fl-co-pay-head">
                    <strong>Payment</strong>
                    <span className="fl-co-test">Test mode</span>
                  </div>
                  <p className="fl-co-muted">A pretend card ending in {testCard === "approve" ? "4242" : "0002"}. No money moves.</p>
                  <Segmented
                    label="Test card"
                    size="sm"
                    value={testCard}
                    onChange={(v) => setTestCard(v as "approve" | "decline")}
                    options={[
                      { value: "approve", label: "Approves" },
                      { value: "decline", label: "Declines" },
                    ]}
                  />
                </div>
                {declined ? (
                  <div className="fl-co-alert" role="alert" id={`${uid}-declined`} tabIndex={-1}>
                    <Icon name="alert" />
                    <span>{declined}</span>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="fl-co-actions">
              {step > 0 ? (
                <Button variant="tertiary" size={44} icon="arrow-left" disabled={placing} onClick={() => go(step - 1)}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              {step < 2 ? (
                <Button variant="primary" size={44} icon="chevron-right" iconAt="end" onClick={next}>
                  {step === 0 ? "Continue to delivery" : "Continue to review"}
                </Button>
              ) : (
                <Button variant="primary" size={44} icon="lock" busy={placing} onClick={() => void place()}>
                  {placing ? "Placing order…" : `Place order · ${money(total)}`}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="fl-co-sum fl-co-card" aria-label="Order summary">
        {narrow ? (
          <button type="button" className="fl-co-sum-toggle" aria-expanded={summaryOpen} aria-controls={`${uid}-sum`} onClick={() => setSummaryOpen((o) => !o)}>
            <span>
              <Icon name="cart" />
              {summaryOpen ? "Hide order summary" : "Show order summary"}
            </span>
            <strong>{money(total)}</strong>
            <Icon name="chevron-down" />
          </button>
        ) : (
          <h3 className="fl-co-sum-title">Order summary</h3>
        )}
        <div id={`${uid}-sum`} className={!narrow || summaryOpen ? "fl-co-fold is-open" : "fl-co-fold"} inert={narrow && !summaryOpen}>
          {summary}
        </div>
      </aside>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: ShopCheckoutProps = {
  title: "Checkout",
  lines: [
    { id: "mug", name: "Speckled stoneware mug", variant: "Oat · 12 oz", price: 2800, qty: 2, art: "a" },
    { id: "towel", name: "Linen tea towel", variant: "Sage", price: 1600, qty: 1, art: "c" },
    { id: "bowl", name: "Serving bowl", variant: "Large · Cobalt", price: 6400, qty: 1, art: "b" },
  ],
  methods: [
    { id: "standard", name: "Standard", note: "4–6 business days", price: 595, freeOver: 15000 },
    { id: "express", name: "Express", note: "2–3 business days", price: 1495 },
    { id: "next", name: "Next day", note: "Order by 2 PM", price: 2495 },
  ],
  promos: [
    { code: "SAVE10", label: "10% off", percent: 10 },
    { code: "FALL15", label: "15% off orders over $100", percent: 15, minSubtotal: 10000 },
    { code: "FREESHIP", label: "Free shipping", freeShipping: true },
  ],
  taxRate: 8.25,
  states: ["AZ", "CA", "CO", "IL", "MA", "NY", "OR", "TX", "WA"],
};

export default function ShopCheckoutPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ShopCheckout {...SAMPLE} />
      </div>
    </section>
  );
}
