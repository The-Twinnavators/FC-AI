/** @flowcode-library pricing-calculator · Pricing calculator (Pricing)
 * Catalog ID: b.pricing-calculator (block)
 * Function: A pricing calculator block (b.pricing-calculator): pick a plan, set the number of seats with a slider or a number field, add extras and switch monthly or yearly billing; a summary lists each line, the yearly saving and a total that counts to its new value, with Copy quote and a call to action. Seats outside a plan's range say why and point to the plan that fits. Adapted from Meraki UI (MIT).
 * Use it as: import { PricingCalculator } from "./pricing-calculator"; <PricingCalculator title eyebrow? lede? currency?="USD" yearlyDiscount?={0.2} plans={[{ id, name, blurb, seatPrice, minSeats, maxSeats, includes: [] }]} addons={[{ id, name, blurb, price, per: "seat"|"flat" }]} cta={{ label, href }} salesHref? />  // use only plans and prices the PRD names
 * Built from: c.segmented.toggle, c.card@tick, c.slider, c.text-field.outlined, c.checkbox, c.button.primary, c.button.tertiary, c.animated-number
 * Look: A heading and a Monthly / Yearly pill switch; on the left, plan cards with a tick, a seats slider beside a number field and a list of extras with checkboxes; on the right, a summary card with the lines, the saving in green, a large total and the buttons.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-on-accent --color-success --color-danger --color-text --color-text-muted --focus-ring --radius-md --radius-lg --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-lg --text-2xl --duration-fast --duration-base --duration-slow --ease-out --ease-spring
 * Use cases: pricing page; price calculator; quote builder; plan picker; seat-based pricing; cost estimate; checkout preview
 * Jobs to be done: work out what a plan costs for my team; compare monthly and yearly billing; see what extras add; find the plan that fits my team size; share a quote with my manager
 * Keywords: pricing, calculator, quote, estimate, seats, plans, add-ons, monthly, yearly, billing, total
 */
/**
 * Pricing calculator: plans are real radios (arrow keys move between them), seats are a slider kept in step with a
 * number field (typing a number outside the plan's range shows why and the plan that fits; leaving the field puts it back
 * in range), extras are checkboxes. The summary is the sum of lines, so it never disagrees with what is chosen; the total
 * counts up or down to its new value (instantly with reduced motion or motion off) and a polite live region reads it
 * once you stop changing things. Copy quote writes the lines as plain text, with a fallback when the clipboard is blocked.
 * Make it the app's own: replace SAMPLE with the real plans and prices and point the call to action at sign-up.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa): its "Checkbox with details" pricing layout.
 */
/**
 * How to try it
 * - Switch to Yearly: the saving line appears and the total counts to its new value.
 * - Pick Team with the arrow keys, then drag the seats slider or type 300 in the field: the field says Team goes up to
 *   100 seats and offers Switch to Business. Press Tab to leave the field and it snaps back into range.
 * - Tick an extra and press Copy quote: the status line says the quote was copied.
 *
 * Dependencies: React (useEffect, useId, useRef, useState) and the library's own pieces and inline icon set. Nothing
 * else — no package to install and nothing fetched at run time. The styles are the fl-pcalc- classes in
 * templates/library/css/r2m-pricing-calculator.css.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { Segmented } from "./segmented-control";
import { Slider } from "./sliders-states";
import { TextField } from "./text-fields-states";

// ── b.pricing-calculator: plan, seats, extras and billing period summed into a live quote. ──

export type CalcPlan = {
  id: string;
  name: string;
  blurb: string;
  /** per seat, per month */ seatPrice: number;
  minSeats: number;
  maxSeats: number;
  includes: string[];
};
export type CalcAddon = {
  id: string;
  name: string;
  blurb: string;
  /** per month */ price: number;
  per: "seat" | "flat";
};
export type PricingCalculatorProps = {
  title: string;
  eyebrow?: string;
  lede?: string;
  /** ISO currency code; "USD" when left out. */
  currency?: string;
  /** Share off when paid yearly, 0.2 = 20%. */
  yearlyDiscount?: number;
  plans: CalcPlan[];
  addons: CalcAddon[];
  cta: { label: string; href: string };
  /** Where "Talk to sales" leads when the team is bigger than every plan. */
  salesHref?: string;
};

const motionOff = () =>
  document.documentElement.dataset.motion === "off" ||
  (typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches);

/** A number that counts to its new value over --duration-slow; instant with motion off or reduced. */
function useTween(target: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (motionOff() || typeof requestAnimationFrame !== "function") {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--duration-slow")
      .trim();
    const dur = /ms$/.test(raw)
      ? parseFloat(raw)
      : /s$/.test(raw)
        ? parseFloat(raw) * 1000
        : 320;
    let id = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / Math.max(dur, 1));
      const v = a + (target - a) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setShown(v);
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    // A hidden tab pauses animation frames; the number still lands on its value.
    const done = window.setTimeout(() => {
      from.current = target;
      setShown(target);
    }, dur + 80);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(done);
    };
  }, [target]);
  return shown;
}

export function PricingCalculator({
  title,
  eyebrow,
  lede,
  currency = "USD",
  yearlyDiscount = 0.2,
  plans,
  addons,
  cta,
  salesHref,
}: PricingCalculatorProps) {
  const uid = useId().replace(/:/g, "");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [planId, setPlanId] = useState(
    plans[Math.min(1, plans.length - 1)]?.id ?? "",
  );
  const plan = plans.find((p) => p.id === planId) ?? plans[0]!;
  const [seats, setSeats] = useState(Math.max(plan.minSeats, 10));
  const [seatText, setSeatText] = useState(String(seats));
  const [extras, setExtras] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [announce, setAnnounce] = useState("");

  const money = (n: number, frac = 0) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: frac,
      minimumFractionDigits: frac,
    }).format(n);
  const clamp = (n: number, p = plan) =>
    Math.min(p.maxSeats, Math.max(p.minSeats, Math.round(n)));

  const typed = Number(seatText);
  const typedOk =
    seatText.trim() !== "" && Number.isFinite(typed) && Number.isInteger(typed);
  const fits = typedOk
    ? plans.find((p) => typed >= p.minSeats && typed <= p.maxSeats)
    : undefined;
  const seatError = !typedOk
    ? "Enter a whole number of seats."
    : typed < plan.minSeats
      ? `${plan.name} starts at ${plan.minSeats} seats.`
      : typed > plan.maxSeats
        ? `${plan.name} goes up to ${plan.maxSeats} seats.`
        : "";

  const choosePlan = (p: CalcPlan) => {
    setPlanId(p.id);
    const n = clamp(seats, p);
    setSeats(n);
    setSeatText(String(n));
  };
  const setFromSlider = (n: number) => {
    setSeats(n);
    setSeatText(String(n));
  };
  const commitText = () => {
    const n = typedOk ? clamp(typed) : seats;
    setSeats(n);
    setSeatText(String(n));
  };

  // The quote: the lines, the saving and the total for the chosen period.
  const months = period === "yearly" ? 12 : 1;
  const lines = [
    {
      label: `${plan.name} · ${seats} ${seats === 1 ? "seat" : "seats"} × ${money(plan.seatPrice, 2)}`,
      amount: plan.seatPrice * seats * months,
    },
    ...addons
      .filter((a) => extras.includes(a.id))
      .map((a) => ({
        label:
          a.per === "seat"
            ? `${a.name} · ${seats} × ${money(a.price, 2)}`
            : a.name,
        amount: (a.per === "seat" ? a.price * seats : a.price) * months,
      })),
  ];
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const saving =
    period === "yearly" ? Math.round(subtotal * yearlyDiscount * 100) / 100 : 0;
  const total = subtotal - saving;
  const per = period === "yearly" ? "/ year" : "/ month";
  const shown = useTween(total);

  // Read the total once changes settle, not on every slider step.
  useEffect(() => {
    const t = window.setTimeout(
      () =>
        setAnnounce(
          `Total ${money(total, 2)} ${per === "/ year" ? "per year" : "per month"}`,
        ),
      700,
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, per]);

  const copy = async () => {
    const text = [
      `${plan.name} plan, billed ${period}`,
      ...lines.map((l) => `${l.label}: ${money(l.amount, 2)}`),
      saving ? `Yearly saving: -${money(saving, 2)}` : "",
      `Total: ${money(total, 2)} ${per}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setStatus("Quote copied.");
    } catch {
      setStatus(`Couldn't copy. Your total is ${money(total, 2)} ${per}.`);
    }
  };

  const maxAll = Math.max(...plans.map((p) => p.maxSeats));

  return (
    <div className="fl-pcalc" data-fl="b.pricing-calculator">
      <header className="fl-pcalc-head">
        {eyebrow ? <p className="fl-eyebrow">{eyebrow}</p> : null}
        <h2 className="fl-title">{title}</h2>
        {lede ? <p className="fl-lede">{lede}</p> : null}
        <Segmented
          variant="toggle"
          label="Billing period"
          value={period}
          onChange={(v) => setPeriod(v as "monthly" | "yearly")}
          options={[
            { value: "monthly", label: "Monthly" },
            {
              value: "yearly",
              label: "Yearly",
              note: `Save ${Math.round(yearlyDiscount * 100)}%`,
            },
          ]}
        />
      </header>

      <div className="fl-pcalc-grid">
        <div className="fl-pcalc-build">
          <fieldset className="fl-pcalc-set">
            <legend>Plan</legend>
            <div className="fl-pcalc-plans">
              {plans.map((p) => (
                <label
                  key={p.id}
                  className={`fl-pcalc-plan${p.id === planId ? " is-on" : ""}`}
                >
                  <input
                    type="radio"
                    name={`${uid}-plan`}
                    value={p.id}
                    checked={p.id === planId}
                    onChange={() => choosePlan(p)}
                    aria-describedby={`${uid}-p-${p.id}`}
                  />
                  <span className="fl-pcalc-tick" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                  <span className="fl-pcalc-plan-name">{p.name}</span>
                  <span className="fl-pcalc-plan-price">
                    {money(p.seatPrice, p.seatPrice % 1 ? 2 : 0)}{" "}
                    <small>/ seat / mo</small>
                  </span>
                  <span className="fl-pcalc-plan-blurb" id={`${uid}-p-${p.id}`}>
                    {p.blurb} {p.minSeats}–{p.maxSeats} seats.
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="fl-pcalc-set">
            <div className="fl-pcalc-seats-head">
              <label htmlFor={`${uid}-seats`} className="fl-pcalc-legend">
                Seats
              </label>
              <span className="fl-pcalc-range">
                {plan.minSeats}–{plan.maxSeats}
              </span>
            </div>
            <div className="fl-pcalc-seats">
              <Slider
                label="Seats"
                min={plan.minSeats}
                max={plan.maxSeats}
                value={seats}
                onChange={setFromSlider}
                format={(n) => `${n} seats`}
              />
              <TextField
                id={`${uid}-seats`}
                type="number"
                inputMode="numeric"
                size={44}
                min={plan.minSeats}
                max={plan.maxSeats}
                value={seatText}
                invalid={!!seatError}
                aria-describedby={seatError ? `${uid}-seats-err` : undefined}
                onChange={(e) => {
                  setSeatText(e.target.value);
                  const n = Number(e.target.value);
                  if (
                    e.target.value.trim() !== "" &&
                    Number.isInteger(n) &&
                    n >= plan.minSeats &&
                    n <= plan.maxSeats
                  )
                    setSeats(n);
                }}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitText();
                  }
                }}
              />
            </div>
            {seatError ? (
              <div
                className="fl-pcalc-err"
                id={`${uid}-seats-err`}
                role="alert"
              >
                <Icon name="alert" />
                <span>
                  {seatError}{" "}
                  {fits && fits.id !== plan.id ? (
                    <button
                      type="button"
                      className="fl-pcalc-link"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPlanId(fits.id);
                        setSeats(typed);
                      }}
                    >
                      Switch to {fits.name}
                    </button>
                  ) : typedOk && typed > maxAll && salesHref ? (
                    <a className="fl-pcalc-link" href={salesHref}>
                      Talk to sales
                    </a>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>

          <fieldset className="fl-pcalc-set">
            <legend>Extras</legend>
            <ul className="fl-pcalc-addons">
              {addons.map((a) => (
                <li key={a.id}>
                  <Checkbox
                    checked={extras.includes(a.id)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setExtras((x) =>
                        on ? [...x, a.id] : x.filter((y) => y !== a.id),
                      );
                    }}
                    label={
                      <span className="fl-pcalc-addon-row">
                        <span>{a.name}</span>
                        <span className="fl-pcalc-addon-price">
                          +{money(a.price, a.price % 1 ? 2 : 0)}{" "}
                          {a.per === "seat" ? "/ seat / mo" : "/ mo"}
                        </span>
                      </span>
                    }
                    description={a.blurb}
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        </div>

        <aside className="fl-pcalc-sum" aria-labelledby={`${uid}-sum-h`}>
          <h3 id={`${uid}-sum-h`}>Your quote</h3>
          <dl className="fl-pcalc-lines">
            {lines.map((l) => (
              <div key={l.label}>
                <dt>{l.label}</dt>
                <dd>{money(l.amount, 2)}</dd>
              </div>
            ))}
            {saving ? (
              <div className="fl-pcalc-save">
                <dt>Yearly saving ({Math.round(yearlyDiscount * 100)}%)</dt>
                <dd>−{money(saving, 2)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="fl-pcalc-total">
            <span>Total</span>
            <strong>
              <span className="fl-pcalc-num">{money(shown, 2)}</span>{" "}
              <small>{per}</small>
            </strong>
          </div>
          {period === "yearly" ? (
            <p className="fl-pcalc-note">
              That's {money(total / 12, 2)} a month, billed once a year.
            </p>
          ) : (
            <p className="fl-pcalc-note">
              Switch to yearly to save{" "}
              {money(subtotal * 12 * yearlyDiscount, 0)} a year.
            </p>
          )}
          <ul className="fl-pcalc-incl" aria-label={`${plan.name} includes`}>
            {plan.includes.map((i) => (
              <li key={i}>
                <Icon name="check" />
                {i}
              </li>
            ))}
          </ul>
          <div className="fl-pcalc-actions">
            <Button variant="primary" href={cta.href} block>
              {cta.label}
            </Button>
            <Button
              variant="tertiary"
              size={40}
              icon="copy"
              onClick={copy}
              block
            >
              Copy quote
            </Button>
          </div>
          <p className="fl-pcalc-status" role="status" aria-live="polite">
            {status}
          </p>
          <p className="fl-sr" aria-live="polite">
            {announce}
          </p>
        </aside>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE: PricingCalculatorProps = {
  eyebrow: "Pricing",
  title: "Work out your price",
  lede: "Pay per seat. Change plans or seats any time.",
  yearlyDiscount: 0.2,
  plans: [
    {
      id: "starter",
      name: "Starter",
      blurb: "For small teams getting going.",
      seatPrice: 8,
      minSeats: 1,
      maxSeats: 10,
      includes: [
        "Unlimited projects",
        "5 GB storage per seat",
        "Email support",
      ],
    },
    {
      id: "team",
      name: "Team",
      blurb: "Shared views and admin tools.",
      seatPrice: 14,
      minSeats: 5,
      maxSeats: 100,
      includes: [
        "Everything in Starter",
        "Shared views and guests",
        "Admin roles",
        "Priority support",
      ],
    },
    {
      id: "business",
      name: "Business",
      blurb: "Security and control at scale.",
      seatPrice: 24,
      minSeats: 50,
      maxSeats: 1000,
      includes: [
        "Everything in Team",
        "SSO and audit log",
        "99.9% uptime promise",
        "A named contact",
      ],
    },
  ],
  addons: [
    {
      id: "ai",
      name: "AI assistant",
      blurb: "Summaries and drafts in every project.",
      price: 6,
      per: "seat",
    },
    {
      id: "storage",
      name: "Extra storage",
      blurb: "1 TB shared across the team.",
      price: 40,
      per: "flat",
    },
    {
      id: "onboarding",
      name: "Guided onboarding",
      blurb: "Two live sessions with our team.",
      price: 99,
      per: "flat",
    },
  ],
  cta: { label: "Start free trial", href: "#start" },
  salesHref: "#sales",
};

export default function PricingCalculatorPreview() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <PricingCalculator {...SAMPLE} />
      </div>
    </section>
  );
}
