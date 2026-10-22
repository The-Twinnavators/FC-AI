/** @flowcode-library donation-form · Donation form (Forms)
 * Catalog ID: b.donation-form (block)
 * Function: The donation form block (b.donation-form): the cause beside a gift card with one-time or monthly, preset and custom amounts, a line that says what the gift does, an optional "cover the fee", an in-honor-of note, the donor's name and email, and a confirmation; it takes no payment as shipped (test mode).
 * Use it as: import { DonationForm } from "./donation-form"; <DonationForm cause={{ name, text?, picture?: { src?, alt }, split?: [{ id, label, share: 62 }] }} title? presets={[{ amount: 5000 (cents), impact? }]} monthlyPresets? defaultAmount?={5000} defaultFrequency?="once"|"monthly" impactRate?={{ cents: 250, unit: "meal", units: "meals", what: "shared with neighbors" }} fee?={{ percent: 2.9, fixed: 30 }} min?={500} max?={1000000} currency?="USD" testMode?={true} onDonate?={async (gift) => ...} />  // connect onDonate to the real payment step
 * Built from: c.media-frame, c.button.primary, c.button.secondary, c.text-field.outlined, c.switch, c.animated-number
 * Look: Two columns. On the left a rounded picture, the cause's name, a short paragraph and "Where each $1 goes" as thin straight bars. On the right a white card: a pill track for One time / Monthly with a sliding accent thumb, a grid of amount tiles plus Other, a tinted impact line with a counting figure, a cover-the-fee switch, a link-style "Give in honor of someone" that opens a field, name and email, and a full-width button with the total. After giving, the card settles into a thank-you with a drawn check.
 * Tokens: --color-accent --color-accent-hover --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-danger --color-success --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-md --text-lg --text-xl --font-display --weight-semibold --weight-bold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: donate page; nonprofit donation form; fundraising; charity giving; monthly giving; give now; support our cause; year-end appeal
 * Jobs to be done: give an amount that suits me; see what my gift does; give every month; cover the processing fee; give in honor of someone
 * Keywords: donate, donation, give, gift, charity, nonprofit, monthly, one-time, amount, fee, impact, fundraising, form
 */
/**
 * Donation form: what a giving page has to get right. Choosing one time or monthly slides a thumb along a pill track;
 * the amount tiles are real radios (arrow keys move between them) with Other opening a dollar field; the impact line
 * counts up to what the amount pays for; "Cover the fee" adds the processing fee to the total, worked out in cents so
 * the charity receives the full gift. "Give in honor of someone" opens a name field with a grid-rows reveal and stays
 * inert while closed. The button names the total. Submitting checks the amount, name and email, focuses the first
 * problem and says it in a live region; on success the card settles into a thank-you. As shipped it is test mode: no
 * payment is taken; pass onDonate to send the gift to the real payment step.
 * Adapted from Tailblocks (MIT, Copyright (c) 2020 Mert Cukuren): its contact block's picture-beside-a-form layout.
 */
/**
 * How to try it
 * - Press Monthly: the thumb slides, the tiles switch to the monthly amounts and the total says "/month".
 * - Pick a tile, then Other and type 37.50: the impact figure counts to the new number of meals.
 * - Turn on "Cover the fee": the total grows by the fee and the button counts to it.
 * - Press Give with an empty name or a bad email: the first problem gets focus and the reason shows under it.
 * - Fill both and press Give: the card settles into the thank-you; Give again starts over.
 * - Narrow the window to a phone: the cause stacks above the card and the tiles go two across.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's MediaFrame, Button, TextField, Switch and
 * AnimatedNumber ("./media-frames", "./buttons-variants", "./text-fields-states", "./switches-states",
 * "./data-animated-number") and its inline icon set ("./icons"). Nothing else: no package, no payment and nothing
 * fetched. The styles are the library's own fl- classes in templates/library/css/r6d-donation-form.css.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { AnimatedNumber } from "./data-animated-number";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { MediaFrame } from "./media-frames";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

export type DonationFrequency = "once" | "monthly";
export type DonationPreset = { amount: number; impact?: string };
export type DonationGift = {
  frequency: DonationFrequency;
  /** The gift itself, in cents. */
  amount: number;
  /** The processing fee added on top, in cents (0 when not covered). */
  fee: number;
  total: number;
  currency: string;
  name: string;
  email: string;
  honoree?: string;
};

export type DonationFormProps = {
  title?: string;
  cause: {
    name: string;
    text?: string;
    picture?: { src?: string; alt: string };
    splitTitle?: string;
    /** Where each dollar goes: shares in percent. */
    split?: { id: string; label: string; share: number }[];
  };
  /** Amounts in cents. */
  presets: DonationPreset[];
  monthlyPresets?: DonationPreset[];
  defaultAmount?: number;
  defaultFrequency?: DonationFrequency;
  /** How much one unit of impact costs, in cents: 250 = one meal per $2.50. */
  impactRate?: { cents: number; unit: string; units: string; what?: string };
  /** The processor's fee: percent of the charge plus a fixed amount in cents. */
  fee?: { percent: number; fixed: number };
  min?: number;
  max?: number;
  currency?: string;
  locale?: string;
  /** True (the default) shows "Test mode: no payment was taken" on the thank-you. */
  testMode?: boolean;
  onDonate?: (gift: DonationGift) => Promise<void> | void;
};

const still = () =>
  typeof window === "undefined" || document.documentElement.dataset.motion === "off" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.1 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "37.50" or "1,200" to cents; null when it isn't a money amount. */
function toCents(text: string): number | null {
  const t = text.replace(/[,\s$]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [whole, part = ""] = t.split(".");
  return Number(whole) * 100 + Number((part + "00").slice(0, 2));
}

/** The fee that, added on top, leaves the charity the whole gift after the processor takes its cut. */
function feeFor(amount: number, fee: { percent: number; fixed: number }) {
  return Math.max(0, Math.ceil((amount + fee.fixed) / (1 - fee.percent / 100)) - amount);
}

export function DonationForm({
  title = "Make a gift",
  cause,
  presets,
  monthlyPresets,
  defaultAmount,
  defaultFrequency = "once",
  impactRate,
  fee = { percent: 2.9, fixed: 30 },
  min = 500,
  max = 1000000,
  currency = "USD",
  locale = "en-US",
  testMode = true,
  onDonate,
}: DonationFormProps) {
  const uid = useId();
  const money = (c: number) =>
    (c / 100).toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const [root, enter] = useEnterOnce<HTMLDivElement>();
  const [freq, setFreq] = useState<DonationFrequency>(defaultFrequency);
  const list = freq === "monthly" && monthlyPresets?.length ? monthlyPresets : presets;
  const [pick, setPick] = useState<number | "other">(defaultAmount ?? list[Math.min(1, list.length - 1)]?.amount ?? "other");
  const [other, setOther] = useState("");
  const [cover, setCover] = useState(true);
  const [honor, setHonor] = useState(false);
  const [honoree, setHonoree] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; name?: string; email?: string }>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<DonationGift | null>(null);
  const focus = (id: string) => document.getElementById(`${uid}-${id}`)?.focus();
  const firstTile = useRef<HTMLInputElement>(null);
  const thanks = useRef<HTMLHeadingElement>(null);

  const amount = pick === "other" ? (toCents(other) ?? 0) : pick;
  const feeCents = amount > 0 ? feeFor(amount, fee) : 0;
  const total = amount + (cover ? feeCents : 0);
  const preset = pick === "other" ? undefined : list.find((p) => p.amount === pick);
  const units = impactRate && amount > 0 ? Math.floor(amount / impactRate.cents) : 0;
  const per = freq === "monthly" ? "/month" : "";

  const switchFreq = (f: DonationFrequency) => {
    setFreq(f);
    const next = f === "monthly" && monthlyPresets?.length ? monthlyPresets : presets;
    if (pick !== "other" && !next.some((p) => p.amount === pick)) setPick(next[Math.min(1, next.length - 1)]?.amount ?? "other");
  };

  const amountError = (): string | undefined => {
    if (pick === "other" && !other.trim()) return "Enter an amount.";
    if (pick === "other" && toCents(other) === null) return "Enter dollars and cents, like 25 or 37.50.";
    if (amount < min) return `The smallest gift is ${money(min)}.`;
    if (amount > max) return `For gifts over ${money(max)}, please contact us.`;
    return undefined;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      amount: amountError(),
      name: name.trim() ? undefined : "Enter your name.",
      email: !email.trim() ? "Enter your email for the receipt." : EMAIL.test(email.trim()) ? undefined : "Check the email address.",
    };
    setErrors(next);
    const bad = Object.values(next).filter(Boolean).length;
    if (bad) {
      setStatus(`${bad} ${bad === 1 ? "thing needs" : "things need"} fixing.`);
      if (next.amount) {
        if (pick === "other") focus("other");
        else firstTile.current?.focus();
      } else focus(next.name ? "n" : "e");
      return;
    }
    const gift: DonationGift = {
      frequency: freq,
      amount,
      fee: cover ? feeCents : 0,
      total,
      currency,
      name: name.trim(),
      email: email.trim(),
      honoree: honor && honoree.trim() ? honoree.trim() : undefined,
    };
    setBusy(true);
    setStatus("Sending your gift.");
    try {
      if (onDonate) await onDonate(gift);
      else await new Promise((r) => setTimeout(r, 600));
      setDone(gift);
      setStatus(`Thank you. ${money(gift.total)}${freq === "monthly" ? " a month" : ""} to ${cause.name}.`);
    } catch {
      setStatus("That didn't go through. Nothing was charged. Try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (done) thanks.current?.focus();
  }, [done]);

  const again = () => {
    setDone(null);
    setName("");
    setEmail("");
    setHonoree("");
    setHonor(false);
    setErrors({});
    setStatus("");
    setTimeout(() => firstTile.current?.focus(), 0);
  };

  const cls = ["fl-dnf", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ");
  let n = 0;
  const rise = () => ({ "--i": n++ }) as CSSProperties;

  return (
    <div ref={root} className={cls} data-fl="b.donation-form">
      <div className="fl-dnf-in">
        <div className="fl-dnf-cause">
          <div className="fl-dnf-pic fl-dnf-rise" style={rise()}>
            <MediaFrame ratio="4-3" src={cause.picture?.src} alt={cause.picture?.alt ?? ""} art="c" />
          </div>
          <h3 className="fl-dnf-name fl-dnf-rise" style={rise()}>
            {cause.name}
          </h3>
          {cause.text ? (
            <p className="fl-dnf-text fl-dnf-rise" style={rise()}>
              {cause.text}
            </p>
          ) : null}
          {cause.split?.length ? (
            <div className="fl-dnf-split fl-dnf-rise" style={rise()}>
              <h4 className="fl-dnf-split-title">{cause.splitTitle ?? "Where each $1 goes"}</h4>
              <ul>
                {cause.split.map((s, i) => (
                  <li key={s.id} style={{ "--share": `${s.share}%`, "--j": i } as CSSProperties}>
                    <span className="fl-dnf-split-label">{s.label}</span>
                    <span className="fl-dnf-split-val">{s.share}¢</span>
                    <span className="fl-dnf-bar" aria-hidden="true">
                      <span />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="fl-dnf-card fl-dnf-rise" style={rise()}>
          {done ? (
            <div className="fl-dnf-done">
              <span className="fl-dnf-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <h3 ref={thanks} tabIndex={-1} className="fl-dnf-done-title">
                Thank you, {done.name.split(" ")[0]}!
              </h3>
              <p className="fl-dnf-done-sum">
                <strong>
                  {money(done.total)}
                  {done.frequency === "monthly" ? " a month" : ""}
                </strong>{" "}
                to {cause.name}
                {done.honoree ? `, in honor of ${done.honoree}` : ""}.
              </p>
              <p className="fl-dnf-done-note">A receipt goes to {done.email}.</p>
              {testMode ? (
                <p className="fl-dnf-test">
                  <Icon name="info" /> Test mode: no payment was taken.
                </p>
              ) : null}
              <Button variant="secondary" size={44} icon="heart" onClick={again}>
                Give again
              </Button>
            </div>
          ) : (
            <form className="fl-dnf-form" onSubmit={submit} noValidate aria-labelledby={`${uid}-t`}>
              <h3 id={`${uid}-t`} className="fl-dnf-title">
                {title}
              </h3>

              <div className="fl-dnf-freq" role="radiogroup" aria-label="How often" style={{ "--at": freq === "monthly" ? 1 : 0 } as CSSProperties}>
                <span className="fl-dnf-thumb" aria-hidden="true" />
                {(["once", "monthly"] as const).map((f) => (
                  <label key={f} className={freq === f ? "is-on" : undefined}>
                    <input type="radio" className="fl-sr" name={`${uid}-freq`} checked={freq === f} onChange={() => switchFreq(f)} />
                    {f === "once" ? "One time" : "Monthly"}
                  </label>
                ))}
              </div>

              <fieldset className="fl-dnf-amounts" aria-describedby={errors.amount ? `${uid}-ae` : undefined}>
                <legend className="fl-sr">Amount</legend>
                {list.map((p, i) => (
                  <label key={`${freq}-${p.amount}`} className={["fl-dnf-tile", pick === p.amount ? "is-on" : ""].filter(Boolean).join(" ")}>
                    <input
                      ref={i === 0 ? firstTile : undefined}
                      type="radio"
                      className="fl-sr"
                      name={`${uid}-amt`}
                      checked={pick === p.amount}
                      onChange={() => {
                        setPick(p.amount);
                        setErrors((x) => ({ ...x, amount: undefined }));
                      }}
                    />
                    {money(p.amount)}
                  </label>
                ))}
                <label className={["fl-dnf-tile", pick === "other" ? "is-on" : ""].filter(Boolean).join(" ")}>
                  <input
                    type="radio"
                    className="fl-sr"
                    name={`${uid}-amt`}
                    checked={pick === "other"}
                    onChange={() => {
                      setPick("other");
                      setTimeout(() => focus("other"), 0);
                    }}
                  />
                  Other
                </label>
              </fieldset>

              <div className={["fl-dnf-reveal", pick === "other" ? "is-open" : ""].filter(Boolean).join(" ")}>
                <div className="fl-dnf-reveal-in" inert={pick !== "other"}>
                  <div className="fl-field fl-dnf-other">
                    <label htmlFor={`${uid}-other`}>Your amount</label>
                    <span className="fl-dnf-money">
                      <span aria-hidden="true">$</span>
                      <TextField
                        id={`${uid}-other`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        value={other}
                        invalid={!!errors.amount && pick === "other"}
                        aria-describedby={errors.amount ? `${uid}-ae` : undefined}
                        onChange={(e) => {
                          setOther(e.target.value);
                          setErrors((x) => ({ ...x, amount: undefined }));
                        }}
                      />
                    </span>
                  </div>
                </div>
              </div>
              {errors.amount ? (
                <p id={`${uid}-ae`} className="fl-dnf-err">
                  {errors.amount}
                </p>
              ) : null}

              {impactRate ? (
                <p className="fl-dnf-impact" aria-live="polite">
                  <Icon name="heart" />
                  <span>
                    {amount > 0 && units > 0 ? (
                      <>
                        About <AnimatedNumber value={units} duration={600} className="fl-dnf-impact-n" /> {units === 1 ? impactRate.unit : impactRate.units}
                        {impactRate.what ? ` ${impactRate.what}` : ""}
                        {freq === "monthly" ? " every month" : ""}.{preset?.impact ? <span className="fl-dnf-impact-more"> {preset.impact}</span> : null}
                      </>
                    ) : (
                      <>Pick an amount to see what it does.</>
                    )}
                  </span>
                </p>
              ) : null}

              <div className="fl-dnf-fee">
                <Switch size={24} on={cover} label="Cover the processing fee" onToggle={setCover} />
                <span>
                  <strong>Cover the fee</strong>
                  <span className="fl-dnf-muted">{amount > 0 ? `Adds ${money(feeCents)} so all of your gift arrives.` : "So all of your gift arrives."}</span>
                </span>
              </div>

              <button type="button" className="fl-dnf-honor" aria-expanded={honor} aria-controls={`${uid}-hon`} onClick={() => setHonor((h) => !h)}>
                <Icon name={honor ? "close" : "plus"} />
                Give in honor of someone
              </button>
              <div id={`${uid}-hon`} className={["fl-dnf-reveal", honor ? "is-open" : ""].filter(Boolean).join(" ")}>
                <div className="fl-dnf-reveal-in" inert={!honor}>
                  <div className="fl-field">
                    <label htmlFor={`${uid}-hn`}>Their name</label>
                    <TextField id={`${uid}-hn`} autoComplete="off" value={honoree} onChange={(e) => setHonoree(e.target.value)} placeholder="Rosa Delgado" />
                  </div>
                </div>
              </div>

              <div className="fl-dnf-row">
                <div className="fl-field">
                  <label htmlFor={`${uid}-n`}>Name</label>
                  <TextField
                    id={`${uid}-n`}
                    autoComplete="name"
                    value={name}
                    invalid={!!errors.name}
                    aria-describedby={errors.name ? `${uid}-ne` : undefined}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((x) => ({ ...x, name: undefined }));
                    }}
                  />
                  {errors.name ? (
                    <p id={`${uid}-ne`} className="fl-dnf-err">
                      {errors.name}
                    </p>
                  ) : null}
                </div>
                <div className="fl-field">
                  <label htmlFor={`${uid}-e`}>Email</label>
                  <TextField
                    id={`${uid}-e`}
                    type="email"
                    autoComplete="email"
                    value={email}
                    invalid={!!errors.email}
                    aria-describedby={errors.email ? `${uid}-ee` : undefined}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((x) => ({ ...x, email: undefined }));
                    }}
                  />
                  {errors.email ? (
                    <p id={`${uid}-ee`} className="fl-dnf-err">
                      {errors.email}
                    </p>
                  ) : null}
                </div>
              </div>

              <Button type="submit" block size={48} busy={busy} icon="heart">
                Give{" "}
                {total > 0 ? <AnimatedNumber value={total / 100} duration={500} format={(v) => money(Math.round(v * 100))} className="fl-dnf-total" /> : null}
                {total > 0 ? per : ""}
              </Button>
              {testMode ? <p className="fl-dnf-muted fl-dnf-center">Test mode: no payment is taken.</p> : null}
            </form>
          )}
          <p className="fl-sr" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Donate",
  title: "Keep the larder open this winter",
  lede: "Every gift buys food for neighbors who need it. Monthly gifts let us plan ahead.",
  cause: {
    name: "Open Larder Trust",
    text: "We collect good food that would go to waste and share it with families in Eastfield, five days a week, with no forms to fill in.",
    picture: { alt: "Volunteers packing grocery boxes at the community larder" },
    split: [
      { id: "food", label: "Food and deliveries", share: 82 },
      { id: "space", label: "Rent and utilities", share: 11 },
      { id: "admin", label: "Running costs", share: 7 },
    ],
  },
  presets: [
    { amount: 2500, impact: "Covers a week of breakfasts for one child." },
    { amount: 5000, impact: "Fills a family's box for a week." },
    { amount: 10000, impact: "Stocks a delivery run for 12 homes." },
    { amount: 25000, impact: "Pays for a month of fresh produce." },
  ],
  monthlyPresets: [
    { amount: 1000, impact: "A steady breakfast for one child." },
    { amount: 2000, impact: "A family's fresh fruit, every week." },
    { amount: 3500, impact: "One home delivery each week." },
    { amount: 7500, impact: "A month of milk for the larder." },
  ],
  impactRate: { cents: 250, unit: "meal", units: "meals", what: "shared with neighbors" },
};

export default function DonationFormPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="donation-form-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="donation-form-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <DonationForm cause={d.cause} presets={d.presets} monthlyPresets={d.monthlyPresets} defaultAmount={5000} impactRate={d.impactRate} />
      </div>
    </section>
  );
}
