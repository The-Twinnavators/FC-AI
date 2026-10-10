/** @flowcode-library site-nonprofit · Charity site (Industry sites)
 * Use cases: charity website; nonprofit; donation page; fundraising; volunteer signup; foundation site; community group; impact report
 * Jobs to be done: donate to a cause i care about; see the impact of my gift; set up a monthly donation; sign up to volunteer
 * Keywords: page, nonprofit, charity, donate, donation, impact, programs, volunteer, sign-up, form, html5up
 */
/**
 * Site: charity / nonprofit. A one-page site for a community charity, foundation or volunteer-run group: a tall banner,
 * the mission in a box lifted over it with impact figures, four programs, a voice from the community, a donation
 * picker (one-off or monthly, preset or own amount, gift aid) that only shows a confirmation and takes no payment, and
 * a volunteer sign-up form. Layout adapted from HTML5 UP "Alpha" (html5up.net, CC BY 3.0); keep the credit.
 * Make it the app's own: replace SAMPLE with the organization's mission, real figures and programs; point the
 * donation confirmation at the payment step the PRD describes.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Open Larder Trust",
  links: [
    { label: "Mission", href: "#np-mission" },
    { label: "Programmes", href: "#np-programmes" },
    { label: "Donate", href: "#np-donate" },
    { label: "Volunteer", href: "#np-volunteer" },
  ],
  banner: {
    eyebrow: "Community food charity · Eastfield",
    title: "No one in Eastfield should face an empty cupboard.",
    lede: "We collect good food that would go to waste and share it with neighbours who need it, with dignity and no forms to fill in.",
  },
  mission: {
    title: "Our mission",
    text: "Open Larder started in a church hall in 2016 with one table and six volunteers. Today we run a weekly larder, holiday lunches for children, cooking classes and home deliveries for people who can't get out, all from donated food and local generosity.",
    impact: [
      { value: "38,400", label: "meals shared last year" },
      { value: "1,250", label: "households supported" },
      { value: "212", label: "active volunteers" },
      { value: "92¢", label: "of every $1 goes to food" },
    ],
  },
  programmes: {
    title: "What we do",
    lede: "Four programs, each run by volunteers and shaped by the people who use them.",
    items: [
      { icon: "layers", title: "Community larder", text: "A shop-style larder where members choose their own groceries for $4.50 a visit, around $33 of food.", when: "Tue and Fri, 10:00–14:00 · Fernhill Hall" },
      { icon: "heart", title: "Holiday lunches", text: "A hot meal and an activity for children in every school holiday, with a bag of food to take home.", when: "School holidays, Mon–Thu 12:00 · Three schools" },
      { icon: "sparkle", title: "Cook and share", text: "Six-week classes on cooking well on a budget, ending with a meal together. Childcare provided.", when: "Wednesday evenings · Community kitchen" },
      { icon: "pin", title: "Home deliveries", text: "Weekly food parcels and a friendly chat for people who are housebound, unwell or caring full-time.", when: "Every Thursday · 140 homes" },
    ],
  },
  quote: {
    text: "When my hours were cut, the larder meant my kids still had fruit in their lunchboxes. Now I volunteer on Fridays.",
    name: "Dee",
    role: "Larder member, then volunteer",
  },
  donate: {
    title: "Give a gift that turns into meals",
    lede: "Every pound buys about three meals' worth of food from our wholesale partners.",
    spend: [
      { label: "Food and fresh produce", pence: 72 },
      { label: "Delivery van and fuel", pence: 11 },
      { label: "Kitchen, rent and utilities", pence: 9 },
      { label: "Running the charity", pence: 8 },
    ],
    amounts: [15, 35, 65, 130],
    impact: {
      10: "feeds a family of four for two days",
      25: "pays for ten hot holiday lunches",
      50: "fuels the delivery van for a week",
      100: "stocks the larder's fresh shelf for a whole day",
    } as Record<number, string>,
  },
  volunteer: {
    title: "Give a few hours instead",
    lede: "Most volunteers do one three-hour shift a fortnight. No experience needed; we'll train you and pair you up.",
    perks: ["A free food-hygiene certificate", "Shifts that fit around work or school runs", "Lunch on us, every shift"],
    roles: ["Larder shifts", "Driving deliveries", "Cooking", "Office and admin"],
    availability: ["Weekday daytimes", "Weekday evenings", "Weekends", "School holidays only"],
  },
  footer: {
    about: "Open Larder Trust · Registered charity no. 1170 4421 · Fernhill Hall, 9 Mill Road, Eastfield",
    follow: [
      { label: "Monthly newsletter", href: "#np-volunteer" },
      { label: "Annual report 2026", href: "#np-mission" },
      { label: "Contact the team", href: "#np-volunteer" },
    ],
  },
};

type VolErrors = Partial<Record<"name" | "email" | "roles" | "when", string>>;

export default function SiteNonprofit() {
  const d = SAMPLE;
  const [menuOpen, setMenuOpen] = useState(false);
  const [monthly, setMonthly] = useState(false);
  const [amount, setAmount] = useState<number | "other">(25);
  const [other, setOther] = useState("");
  const [giftAid, setGiftAid] = useState(false);
  const [amountError, setAmountError] = useState("");
  const [gift, setGift] = useState<{ value: number; monthly: boolean; giftAid: boolean } | null>(null);
  const [volErrors, setVolErrors] = useState<VolErrors>({});
  const [volunteer, setVolunteer] = useState<{ name: string; roles: string[] } | null>(null);

  const otherValue = Number(other);
  const value = amount === "other" ? otherValue : amount;
  const valid = amount !== "other" || (other.trim() !== "" && Number.isFinite(otherValue) && otherValue >= 2 && otherValue <= 10000);
  const impactText =
    amount !== "other" ? d.donate.impact[amount] : valid ? `buys about ${Math.floor(otherValue * 3)} meals' worth of food` : "";

  const give = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (amount === "other") {
      if (other.trim() === "") return setAmountError("Enter an amount, or pick one of the buttons.");
      if (!Number.isFinite(otherValue) || !/^\d+(\.\d{1,2})?$/.test(other.trim())) return setAmountError("Use numbers only, like 15 or 12.50.");
      if (otherValue < 2) return setAmountError("The smallest gift we can process is $3.");
      if (otherValue > 13000) return setAmountError("For gifts over $13,000, please contact us so we can thank you properly.");
    }
    setAmountError("");
    setGift({ value, monthly, giftAid });
  };

  const signUp = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const roles = f.getAll("roles").map(String);
    const next: VolErrors = {};
    if (!name) next.name = "Please tell us your name.";
    if (!email) next.email = "We need an email to send your induction date.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "That email doesn't look right.";
    if (roles.length === 0) next.roles = "Pick at least one thing you'd like to help with.";
    if (!f.get("when")) next.when = "Choose when you're usually free.";
    setVolErrors(next);
    if (Object.keys(next).length > 0) {
      form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("np-volunteers") ?? "[]") as unknown[];
      localStorage.setItem("np-volunteers", JSON.stringify([...saved, { name, email, roles, when: f.get("when"), note: f.get("note"), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setVolunteer({ name: name.split(" ")[0], roles });
  };

  const vErr = (k: keyof VolErrors) => (volErrors[k] ? { "aria-invalid": true as const, "aria-describedby": `np-${k}-err` } : {});
  const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

  return (
    <div className="fl-st2-page" id="top">
      <header className="fl-st2-bar fl-st2-bar--split">
        <nav className="fl-st2-bar__row" aria-label="Main">
          <a className="fl-st2-brand" href="#top">
            <Icon name="heart" />
            {d.brand}
          </a>
          <ul className="fl-st2-links" id="np-links" data-open={menuOpen}>
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="fl-st2-bar__end">
            <a className="fl-btn fl-btn--primary" href="#np-donate">
              Donate
            </a>
            <button type="button" className="fl-btn fl-btn--secondary fl-st2-burger" aria-expanded={menuOpen} aria-controls="np-links" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="menu" />
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="fl-st2-banner fl-bg-glow" aria-labelledby="np-title">
          <div className="fl-wrap fl-head fl-head--center">
            <span className="fl-eyebrow">{d.banner.eyebrow}</span>
            <h1 id="np-title" className="fl-title fl-title--xl">
              {d.banner.title}
            </h1>
            <p className="fl-lede">{d.banner.lede}</p>
            <div className="fl-actions">
              <a className="fl-btn fl-btn--primary" href="#np-donate">
                Give today
              </a>
              <a className="fl-btn fl-btn--secondary" href="#np-volunteer">
                Volunteer with us
              </a>
            </div>
          </div>
        </section>

        <div className="fl-st2-lift" id="np-mission">
          <section className="fl-wrap fl-card fl-st2-box" aria-labelledby="np-mission-title">
            <h2 id="np-mission-title" className="fl-title fl-title--md">
              {d.mission.title}
            </h2>
            <p className="fl-text" style={{ maxWidth: "var(--measure)" }}>
              {d.mission.text}
            </p>
            <dl className="fl-st2-impact">
              {d.mission.impact.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section className="fl-section" id="np-programmes" aria-labelledby="np-prog-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="np-prog-title" className="fl-title">
                {d.programmes.title}
              </h2>
              <p className="fl-lede">{d.programmes.lede}</p>
            </div>
            <ul className="fl-st2-quad">
              {d.programmes.items.map((p) => (
                <li key={p.title}>
                  <span className="fl-icon">
                    <Icon name={p.icon} />
                  </span>
                  <h3>{p.title}</h3>
                  <p className="fl-text">{p.text}</p>
                  <p className="fl-meta" style={{ margin: 0 }}>
                    {p.when}
                  </p>
                </li>
              ))}
            </ul>
            <figure className="fl-wrap--narrow" style={{ margin: "var(--space-8) auto 0", textAlign: "center", display: "grid", gap: "var(--space-4)", justifyItems: "center" }}>
              <blockquote className="fl-quote fl-quote--xl" style={{ margin: 0 }}>
                “{d.quote.text}”
              </blockquote>
              <figcaption className="fl-person">
                <span className="fl-person__avatar" aria-hidden="true">
                  {d.quote.name[0]}
                </span>
                <span style={{ textAlign: "left" }}>
                  <strong>{d.quote.name}</strong>
                  <span>{d.quote.role}</span>
                </span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="np-donate" aria-labelledby="np-donate-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <h2 id="np-donate-title" className="fl-title">
                {d.donate.title}
              </h2>
              <p className="fl-lede">{d.donate.lede}</p>
              <h3 className="fl-eyebrow" style={{ marginTop: "var(--space-4)" }}>
                Where each $1 goes
              </h3>
              <ul style={{ display: "grid", gap: "var(--space-3)", margin: 0, padding: 0, listStyle: "none" }}>
                {d.donate.spend.map((s) => (
                  <li key={s.label} style={{ display: "grid", gap: "var(--space-1)" }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
                      <span>{s.label}</span>
                      <strong style={{ fontVariantNumeric: "tabular-nums" }}>{s.pence}p</strong>
                    </span>
                    <span aria-hidden="true" style={{ display: "block", height: "0.5rem", borderRadius: "999px", background: "var(--color-border)" }}>
                      <span style={{ display: "block", height: "100%", width: `${s.pence}%`, borderRadius: "999px", background: "var(--color-accent)" }} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="fl-card" aria-live="polite">
              {gift ? (
                <div style={{ display: "grid", gap: "var(--space-4)" }}>
                  <p className="fl-done" role="status">
                    Thank you. You chose to give {money(gift.value)}
                    {gift.monthly ? " every month" : " once"}
                    {gift.giftAid ? `, worth ${money(Math.round(gift.value * 125) / 100)} with gift aid` : ""}.
                  </p>
                  <p className="fl-note" style={{ margin: 0 }}>
                    This is a preview: no payment has been taken. On the live site you would now continue to a secure payment page.
                  </p>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setGift(null)}>
                    Change my gift
                  </button>
                </div>
              ) : (
                <form className="fl-form" noValidate onSubmit={give}>
                  <div className="fl-toggle" role="group" aria-label="How often" style={{ justifySelf: "start" }}>
                    <button type="button" aria-pressed={!monthly} onClick={() => setMonthly(false)}>
                      One-off
                    </button>
                    <button type="button" aria-pressed={monthly} onClick={() => setMonthly(true)}>
                      Monthly
                    </button>
                  </div>
                  <fieldset className="fl-st2-fieldset">
                    <legend>Amount{monthly ? " each month" : ""}</legend>
                    <div className="fl-st2-amounts">
                      {d.donate.amounts.map((a) => (
                        <label key={a} className="fl-st2-amount">
                          <input type="radio" name="amount" value={a} checked={amount === a} onChange={() => { setAmount(a); setAmountError(""); }} />
                          <span>${a}</span>
                        </label>
                      ))}
                    </div>
                    <label className="fl-st2-check" style={{ marginTop: "var(--space-2)" }}>
                      <input type="radio" name="amount" value="other" checked={amount === "other"} onChange={() => setAmount("other")} />
                      Another amount
                    </label>
                  </fieldset>
                  {amount === "other" ? (
                    <div className="fl-field">
                      <label htmlFor="np-other">Your amount in pounds</label>
                      <input
                        id="np-other"
                        className="fl-input"
                        inputMode="decimal"
                        value={other}
                        onChange={(e) => setOther(e.target.value)}
                        aria-invalid={amountError ? true : undefined}
                        aria-describedby={amountError ? "np-other-err" : undefined}
                        placeholder="e.g. 15"
                      />
                      {amountError ? <p id="np-other-err" className="fl-st2-err">{amountError}</p> : null}
                    </div>
                  ) : null}
                  {impactText ? (
                    <p className="fl-st2-impactline">
                      <strong>{money(value)}</strong> {impactText}.
                    </p>
                  ) : null}
                  <label className="fl-st2-check">
                    <input type="checkbox" checked={giftAid} onChange={(e) => setGiftAid(e.target.checked)} />
                    Send me a tax receipt: gifts to Northlight are tax-deductible in the US.
                  </label>
                  <button type="submit" className="fl-btn fl-btn--primary">
                    {valid && value > 0 ? `Give ${money(value)}${monthly ? " a month" : ""}` : "Give"}
                  </button>
                  <p className="fl-note" style={{ margin: 0 }}>
                    Cancel a monthly gift any time by emailing us. We never sell or share supporters' details.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--accent" id="np-volunteer" aria-labelledby="np-vol-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <span className="fl-eyebrow">Volunteer</span>
              <h2 id="np-vol-title" className="fl-title">
                {d.volunteer.title}
              </h2>
              <p className="fl-lede">{d.volunteer.lede}</p>
              <ul className="fl-checks" style={{ marginTop: "var(--space-3)" }}>
                {d.volunteer.perks.map((p) => (
                  <li key={p}>
                    <span className="fl-tick" style={{ background: "color-mix(in srgb, var(--color-on-accent) 20%, transparent)", color: "var(--color-on-accent)" }}>
                      <Icon name="check" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="fl-card fl-st2-oncard" aria-live="polite">
              {volunteer ? (
                <div style={{ display: "grid", gap: "var(--space-4)" }}>
                  <p className="fl-done" role="status">
                    Welcome aboard, {volunteer.name}. We've noted your interest in {volunteer.roles.join(", ").toLowerCase()}; our volunteer lead will email you an induction date within a week.
                  </p>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setVolunteer(null)}>
                    Sign up someone else
                  </button>
                </div>
              ) : (
                <form className="fl-form" noValidate onSubmit={signUp}>
                  <div className="fl-st2-row2">
                    <div className="fl-field">
                      <label htmlFor="np-name">Name</label>
                      <input id="np-name" name="name" className="fl-input" autoComplete="name" {...vErr("name")} />
                      {volErrors.name ? <p id="np-name-err" className="fl-st2-err">{volErrors.name}</p> : null}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="np-email">Email</label>
                      <input id="np-email" name="email" type="email" className="fl-input" autoComplete="email" {...vErr("email")} />
                      {volErrors.email ? <p id="np-email-err" className="fl-st2-err">{volErrors.email}</p> : null}
                    </div>
                  </div>
                  <fieldset className="fl-st2-fieldset" aria-describedby={volErrors.roles ? "np-roles-err" : undefined}>
                    <legend>I'd like to help with</legend>
                    <div className="fl-st2-choices">
                      {d.volunteer.roles.map((r) => (
                        <label key={r} className="fl-st2-choice">
                          <input type="checkbox" name="roles" value={r} aria-invalid={volErrors.roles ? true : undefined} />
                          {r}
                        </label>
                      ))}
                    </div>
                    {volErrors.roles ? <p id="np-roles-err" className="fl-st2-err">{volErrors.roles}</p> : null}
                  </fieldset>
                  <div className="fl-field">
                    <label htmlFor="np-when">I'm usually free</label>
                    <span className="fl-st2-select">
                      <select id="np-when" name="when" className="fl-input" defaultValue="" {...vErr("when")}>
                        <option value="">Choose one</option>
                        {d.volunteer.availability.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </span>
                    {volErrors.when ? <p id="np-when-err" className="fl-st2-err">{volErrors.when}</p> : null}
                  </div>
                  <div className="fl-field">
                    <label htmlFor="np-note">
                      Anything we should know? <span className="fl-meta">(optional)</span>
                    </label>
                    <textarea id="np-note" name="note" className="fl-input" style={{ minHeight: "5rem" }} />
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Sign me up
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap" style={{ display: "grid", gap: "var(--space-4)", justifyItems: "center", textAlign: "center" }}>
          <ul className="fl-st2-social" style={{ justifyContent: "center" }}>
            {d.footer.follow.map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
          <p className="fl-meta" style={{ margin: 0 }}>
            {d.footer.about}
          </p>
          <p className="fl-meta fl-st2-credit" style={{ margin: 0 }}>
            Design: <a href="https://html5up.net">HTML5 UP</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
