/** @flowcode-library landing-subscription · Subscription offer (Landing pages)
 * Use cases: subscription box; meal kit; coffee subscription; plan builder; recurring delivery; pet food subscription; flower delivery; subscribe and save
 * Jobs to be done: build a subscription that fits me; choose how often it arrives; see what it will cost; start my subscription
 * Keywords: landing, subscription, plan picker, order summary, meal kit, coffee, page template
 */
/**
 * Page template: subscription offer landing page. A short split hero, three "how it works" steps, then a plan builder
 * (box size, roast, grind and delivery frequency) beside a live order summary that does the maths, and a sign-up that
 * checks its fields. Suits coffee, meal-kit, flower, pet-food and other repeat-delivery subscriptions. Starting the
 * subscription is a prototype: it shows a confirmation and keeps the order in local storage; nothing is charged or
 * sent. Make it the app's own: replace SAMPLE with the real plans, prices and delivery rules, and keep the summary
 * honest about what is charged when.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Slow Pour",
  signIn: { label: "Already subscribed? Sign in", href: "#signin" },
  eyebrow: "Coffee subscription",
  title: "Fresh beans at your door before the last bag runs out",
  lede: "Small-batch coffee roasted on Monday, posted on Tuesday. Pick a box, choose how often, and skip or pause whenever you like.",
  heroOffer: "Half price on your first box",
  steps: [
    { title: "Build your box", text: "Choose how many bags, the roast you like and how you brew." },
    { title: "We roast to order", text: "Your beans are roasted the week they ship, never sitting on a shelf." },
    { title: "Skip, pause or cancel", text: "Change anything from your account up to two days before each delivery." },
  ],
  plans: [
    { id: "solo", label: "Solo", bags: 1, detail: "1 × 250 g bag · about 16 cups", price: 14 },
    { id: "pair", label: "Pair", bags: 2, detail: "2 × 250 g bags · about 32 cups", price: 26, tag: "Most chosen" },
    { id: "office", label: "Studio", bags: 4, detail: "4 × 250 g bags · about 64 cups", price: 48 },
  ],
  roasts: [
    { id: "light", label: "Light & fruity", detail: "Berries, citrus, tea-like" },
    { id: "medium", label: "Balanced", detail: "Caramel, nuts, chocolate" },
    { id: "dark", label: "Dark & bold", detail: "Cocoa, toffee, smoky" },
  ],
  grinds: ["Whole bean", "Espresso", "Moka pot", "Filter / pour-over", "Cafetière"],
  frequencies: [
    { id: "2w", label: "Every 2 weeks", perMonth: 2, discount: 0.1 },
    { id: "4w", label: "Every 4 weeks", perMonth: 1, discount: 0 },
  ],
  shipping: { fee: 4, freeFromBags: 2 },
  firstBoxOff: 0.5,
  currency: "$",
  firstDelivery: "Tuesday 20 October",
  reassurance: [
    { icon: "clock", text: "Skip or pause any delivery" },
    { icon: "lock", text: "Cancel online in two clicks" },
    { icon: "heart", text: "Not your taste? Next bag is on us" },
  ],
  done: "Your subscription is set up. Your first box ships on",
  footer: { copy: "© 2026 Slow Pour Coffee Roasters", links: [{ label: "Delivery", href: "#delivery" }, { label: "Terms", href: "#terms" }, { label: "Help", href: "#help" }] },
};

type Errors = Partial<Record<"email" | "postcode", string>>;

function Bag({ tall }: { tall?: boolean }) {
  return (
    <svg viewBox="0 0 40 60" fill="color-mix(in srgb, currentColor 16%, transparent)" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true" style={{ height: tall ? "100%" : "80%" }}>
      <path d="M6 10 L10 4 H30 L34 10 V56 H6 Z" />
      <path d="M6 10 H34 M14 26 h12 M14 32 h12" />
      <circle cx="20" cy="42" r="5" />
    </svg>
  );
}

export default function LandingSubscription() {
  const d = SAMPLE;
  const [planId, setPlanId] = useState(d.plans[1].id);
  const [roast, setRoast] = useState(d.roasts[1].id);
  const [grind, setGrind] = useState(d.grinds[0]);
  const [freqId, setFreqId] = useState(d.frequencies[0].id);
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);

  const plan = d.plans.find((p) => p.id === planId) ?? d.plans[0];
  const freq = d.frequencies.find((f) => f.id === freqId) ?? d.frequencies[0];
  const roastLabel = d.roasts.find((r) => r.id === roast)?.label ?? "";
  const discount = Math.round(plan.price * freq.discount * 100) / 100;
  const shipping = plan.bags >= d.shipping.freeFromBags ? 0 : d.shipping.fee;
  const perDelivery = plan.price - discount + shipping;
  const firstBox = Math.round((plan.price - discount) * (1 - d.firstBoxOff) * 100) / 100 + shipping;
  const money = (n: number) => `${d.currency}${n.toFixed(2)}`;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Errors = {};
    if (!email.trim()) next.email = "Add an email for delivery updates.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "That email looks incomplete, for example sam@home.com.";
    if (!postcode.trim()) next.postcode = "Add your postcode so we can check delivery.";
    else if (postcode.trim().length < 3) next.postcode = "That postcode looks too short.";
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`ld-sub-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    try {
      localStorage.setItem("landing-subscription", JSON.stringify({ plan: plan.id, roast, grind, frequency: freq.id, email: email.trim(), postcode: postcode.trim(), at: new Date().toISOString() }));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setDone(true);
  };

  return (
    <div className="fl-ld-page">
      <header className="fl-ld-bar">
        <a className="fl-ld-brand" href="#top">
          <span className="fl-ld-brand__mark">
            <Icon name="heart" />
          </span>
          {d.brand}
        </a>
        <div className="fl-ld-bar__aside">
          <a href={d.signIn.href}>{d.signIn.label}</a>
        </div>
      </header>

      <main id="top">
        <section className="fl-section fl-bg-split" aria-labelledby="ld-sub-title" style={{ paddingTop: "var(--space-7)" }}>
          <div className="fl-wrap fl-split">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <span className="fl-eyebrow">{d.eyebrow}</span>
              <h1 id="ld-sub-title" className="fl-title fl-title--xl">
                {d.title}
              </h1>
              <p className="fl-lede">{d.lede}</p>
              <div className="fl-actions">
                <a className="fl-btn fl-btn--primary" href="#build">
                  Build my box
                </a>
                <span className="fl-badge">{d.heroOffer}</span>
              </div>
            </div>
            <div className="fl-media fl-media--wide" role="img" aria-label="Three coffee bags (placeholder image)">
              <div className="fl-ld-bags" style={{ height: "60%" }}>
                <Bag />
                <Bag tall />
                <Bag />
              </div>
            </div>
          </div>
        </section>

        <section className="fl-section" aria-labelledby="ld-sub-how">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="ld-sub-how" className="fl-title fl-title--md">
                How it works
              </h2>
            </div>
            <ol className="fl-ld-howto">
              {d.steps.map((s, i) => (
                <li key={s.title}>
                  <span className="fl-ld-step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p className="fl-text">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="build" aria-labelledby="ld-sub-build">
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="ld-sub-build" className="fl-title">
                Build your box
              </h2>
              <p className="fl-lede">Prices include roasting and packing. Change any of this later.</p>
            </div>
            <div className="fl-ld-builder">
              <div className="fl-ld-steps">
                <fieldset className="fl-ld-opts">
                  <legend className="fl-ld-step-title">
                    <span className="fl-ld-step-num" aria-hidden="true">
                      1
                    </span>
                    Box size
                  </legend>
                  <div className="fl-ld-options">
                    {d.plans.map((p) => (
                      <label key={p.id}>
                        <input className="fl-sr" type="radio" name="ld-sub-plan" checked={planId === p.id} onChange={() => setPlanId(p.id)} />
                        <span className="fl-ld-option">
                          {p.tag ? <span className="fl-badge">{p.tag}</span> : null}
                          <strong>{p.label}</strong>
                          <small>{p.detail}</small>
                          <span className="fl-ld-option__price">{money(p.price)} per delivery</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="fl-ld-opts">
                  <legend className="fl-ld-step-title">
                    <span className="fl-ld-step-num" aria-hidden="true">
                      2
                    </span>
                    Roast and grind
                  </legend>
                  <div className="fl-ld-options">
                    {d.roasts.map((r) => (
                      <label key={r.id}>
                        <input className="fl-sr" type="radio" name="ld-sub-roast" checked={roast === r.id} onChange={() => setRoast(r.id)} />
                        <span className="fl-ld-option">
                          <strong>{r.label}</strong>
                          <small>{r.detail}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="fl-field" style={{ maxWidth: "20rem" }}>
                    <label htmlFor="ld-sub-grind">How do you brew?</label>
                    <select id="ld-sub-grind" className="fl-input fl-ld-select" value={grind} onChange={(e) => setGrind(e.target.value)}>
                      {d.grinds.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </fieldset>

                <div>
                  <h3 className="fl-ld-step-title" id="ld-sub-freq">
                    <span className="fl-ld-step-num" aria-hidden="true">
                      3
                    </span>
                    Delivery
                  </h3>
                  <div className="fl-toggle" role="group" aria-labelledby="ld-sub-freq">
                    {d.frequencies.map((f) => (
                      <button key={f.id} type="button" aria-pressed={freqId === f.id} onClick={() => setFreqId(f.id)}>
                        {f.label}
                        {f.discount ? ` · save ${Math.round(f.discount * 100)}%` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="fl-card fl-ld-summary" aria-labelledby="ld-sub-summary">
                <h3 id="ld-sub-summary">Your order</h3>
                <dl className="fl-ld-lines" aria-live="polite">
                  <div>
                    <dt>
                      {plan.label} box · {roastLabel}
                    </dt>
                    <dd>{money(plan.price)}</dd>
                  </div>
                  <div>
                    <dt>Grind</dt>
                    <dd>{grind}</dd>
                  </div>
                  {discount ? (
                    <div className="fl-ld-discount">
                      <dt>{freq.label} saving</dt>
                      <dd>−{money(discount)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Delivery</dt>
                    <dd>{shipping ? money(shipping) : "Free"}</dd>
                  </div>
                  <div className="fl-ld-total">
                    <dt>Each delivery</dt>
                    <dd>{money(perDelivery)}</dd>
                  </div>
                  <div className="fl-ld-discount">
                    <dt>First box ({Math.round(d.firstBoxOff * 100)}% off)</dt>
                    <dd>{money(firstBox)}</dd>
                  </div>
                </dl>
                <p className="fl-meta" style={{ margin: 0 }}>
                  {freq.label.toLowerCase()}, about {money(perDelivery * freq.perMonth)} a month. First delivery {d.firstDelivery}.
                </p>
                {done ? (
                  <p className="fl-done" role="status">
                    {d.done} {d.firstDelivery}. We've emailed the details to {email.trim()}.
                  </p>
                ) : (
                  <form className="fl-form" onSubmit={submit} noValidate>
                    <div className="fl-field">
                      <label htmlFor="ld-sub-email">Email</label>
                      <input
                        id="ld-sub-email"
                        className="fl-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={errors.email ? "ld-sub-email-err" : undefined}
                      />
                      {errors.email ? (
                        <p className="fl-ld-error" id="ld-sub-email-err">
                          {errors.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="ld-sub-postcode">Delivery postcode</label>
                      <input
                        id="ld-sub-postcode"
                        className="fl-input"
                        autoComplete="postal-code"
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        aria-invalid={errors.postcode ? true : undefined}
                        aria-describedby={errors.postcode ? "ld-sub-postcode-err" : undefined}
                      />
                      {errors.postcode ? (
                        <p className="fl-ld-error" id="ld-sub-postcode-err">
                          {errors.postcode}
                        </p>
                      ) : null}
                    </div>
                    <button type="submit" className="fl-btn fl-btn--primary fl-ld-btn-block">
                      Start subscription · {money(firstBox)} today
                    </button>
                    <p className="fl-ld-fine">You'll add payment details on the next step. No charge until you confirm.</p>
                  </form>
                )}
              </aside>
            </div>
          </div>
        </section>

        <section className="fl-section" aria-label="Our promises" style={{ paddingBlock: "var(--space-7)" }}>
          <ul className="fl-wrap fl-ld-trust" style={{ justifyContent: "center", fontSize: "var(--text-md)" }}>
            {d.reassurance.map((r) => (
              <li key={r.text}>
                <Icon name={r.icon} />
                {r.text}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="fl-ld-foot">
        <span>{d.footer.copy}</span>
        <ul>
          {d.footer.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
