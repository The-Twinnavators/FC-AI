/** @flowcode-library site-clinic · Health clinic site (Industry sites)
 * Use cases: clinic website; medical practice; dental practice; physiotherapy; appointment request; practitioner profiles; opening hours; healthcare services
 * Jobs to be done: book an appointment; check if the clinic is open now; find the right practitioner; see if my insurance is accepted
 * Keywords: page, clinic, health, medical, practice, physiotherapy, services, practitioners, opening hours, appointment, insurance, faq, form, html5up
 */
/**
 * Site: health clinic / practice. A one-page site for a GP surgery, physiotherapy or dental practice, or any clinic
 * that takes appointments: a centered emblem header with a live "open now" line, services in alternating feature boxes,
 * the practitioners, opening hours with today highlighted, an appointment request form that checks itself and keeps
 * the request in local storage, and insurance, self-pay fees and FAQs.
 * Layout adapted from HTML5 UP "Directive" (html5up.net, CC BY 3.0); keep the credit.
 * Make it the app's own: replace SAMPLE with the practice's real services, people, hours and insurers; route the
 * appointment request to the booking flow the PRD describes, and keep the emergency notice.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Ashgrove Family Clinic",
  phone: "01632 960 772",
  links: [
    { label: "Services", href: "#cl-services" },
    { label: "Our team", href: "#cl-team" },
    { label: "Hours", href: "#cl-hours" },
    { label: "Insurance", href: "#cl-insurance" },
  ],
  header: {
    title: "Ashgrove Family Clinic",
    lede: "Unhurried appointments with doctors, physiotherapists and nurses who know your history. Same-day slots kept free every morning for urgent problems.",
  },
  services: {
    title: "How we can help",
    lede: "Most appointments are 20 minutes, not 10, so there's time to talk things through.",
    features: [
      { icon: "heart", title: "General practice", text: "Check-ups, long-term conditions, prescriptions and referrals, with the same doctor each visit wherever possible.", points: ["20-minute appointments", "Same-day urgent slots", "Video calls for follow-ups"] },
      { icon: "bolt", title: "Physiotherapy", text: "Assessment and treatment for back and neck pain, sports injuries and recovery after surgery, with a home exercise plan you'll actually do.", points: ["No referral needed", "45-minute first assessment", "Exercise plan in the app"] },
      { icon: "shield", title: "Women's health", text: "Contraception, menopause support, smear tests and pelvic health physiotherapy in a calm, private setting.", points: ["Female clinicians available", "Evening appointments on Wednesdays", "Chaperone always offered"] },
    ],
    more: ["Blood tests", "Travel vaccinations", "Minor procedures", "Children's clinic"],
  },
  team: {
    title: "Our team",
    people: [
      { initials: "NA", name: "Dr Nadia Amari", role: "GP, clinical lead", langs: "English, French, Arabic", days: "Mon, Tue, Thu, Fri", accepting: true },
      { initials: "JW", name: "Dr James Whitfield", role: "GP", langs: "English", days: "Mon, Wed, Fri", accepting: false },
      { initials: "LK", name: "Lena Kowalczyk", role: "Physiotherapist", langs: "English, Polish", days: "Tue–Sat", accepting: true },
      { initials: "GO", name: "Grace Osei", role: "Nurse practitioner", langs: "English, Twi", days: "Mon–Thu", accepting: true },
    ],
  },
  hours: {
    title: "Opening hours",
    // index 0 = Sunday; null means closed
    days: [
      { day: "Sunday", open: null, close: null },
      { day: "Monday", open: "08:00", close: "18:30" },
      { day: "Tuesday", open: "08:00", close: "18:30" },
      { day: "Wednesday", open: "08:00", close: "20:00" },
      { day: "Thursday", open: "08:00", close: "18:30" },
      { day: "Friday", open: "08:00", close: "18:00" },
      { day: "Saturday", open: "09:00", close: "12:30" },
    ] as { day: string; open: string | null; close: string | null }[],
    address: "22 Ashgrove Road, Millbrook · Free parking behind the building · Bus 7 and 12 stop outside",
    afterHours: "When we're closed, call the out-of-hours medical line on 111.",
  },
  appointment: {
    title: "Request an appointment",
    lede: "Tell us what you need and when suits you. We'll call back within one working day to confirm a time.",
    services: ["General practice", "Physiotherapy", "Women's health", "Blood test", "Travel vaccination", "Minor procedure", "Children's clinic"],
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    times: ["Morning", "Afternoon", "Evening (Wed only)"],
  },
  insurance: {
    title: "Insurance and fees",
    lede: "We're a recognized provider with these insurers. Bring your policy number; we'll bill them directly.",
    insurers: ["Meridian Health", "Northgate Cover", "Clearwell Medical", "Harbour Mutual", "Evergreen Care Plans"],
    fees: [
      { item: "Primary care visit (20 min)", fee: "$99" },
      { item: "Physiotherapy assessment (45 min)", fee: "$90" },
      { item: "Physiotherapy follow-up (30 min)", fee: "$73" },
      { item: "Women's health review (30 min)", fee: "$125" },
      { item: "Blood test (plus lab fee)", fee: "$46" },
      { item: "Travel vaccination", fee: "from $59" },
    ],
    faq: [
      { q: "Do I need a referral for physiotherapy?", a: "No. You can book directly. If your insurer needs a GP referral, we can arrange one at the same visit." },
      { q: "Can I see a doctor on the same day?", a: "We keep slots free every morning for urgent problems. Call at 08:00 and we'll offer the next one." },
      { q: "What if I need to cancel?", a: "Cancel at least 24 hours ahead and there's no charge. Late cancellations for self-pay appointments are charged at half the fee." },
      { q: "Do you see children?", a: "Yes, from newborns upwards. Our children's clinic runs on Tuesday and Thursday afternoons." },
      { q: "Do you offer video appointments?", a: "For follow-ups, results and repeat prescriptions, yes. First appointments are in person." },
    ],
  },
  footer: "© 2027 Ashgrove Family Clinic · Registered with the national care quality regulator",
};

type Errors = Partial<Record<"patient" | "name" | "dob" | "phone" | "email" | "service" | "days" | "consent", string>>;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export default function SiteClinic() {
  const d = SAMPLE;
  const [menuOpen, setMenuOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [request, setRequest] = useState<{ ref: string; name: string; phone: string; service: string } | null>(null);

  const now = new Date();
  const todayIdx = now.getDay();
  const today = d.hours.days[todayIdx];
  const mins = now.getHours() * 60 + now.getMinutes();
  const openNow = today.open !== null && today.close !== null && mins >= toMin(today.open) && mins < toMin(today.close);
  const nextOpen = (() => {
    for (let i = 0; i < 7; i++) {
      const idx = (todayIdx + i) % 7;
      const day = d.hours.days[idx];
      if (!day.open) continue;
      if (i === 0 && mins >= toMin(day.open)) continue;
      return `${i === 0 ? "today" : i === 1 ? "tomorrow" : day.day} at ${day.open}`;
    }
    return "soon";
  })();

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const next: Errors = {};
    if (!v("patient")) next.patient = "Tell us whether you're already registered with us.";
    if (!v("name")) next.name = "Please enter the patient's full name.";
    if (!v("dob")) next.dob = "Enter a date of birth so we find the right record.";
    else if (new Date(v("dob")) > new Date()) next.dob = "The date of birth can't be in the future.";
    if (!v("phone")) next.phone = "We call to confirm, so we need a phone number.";
    else if (v("phone").replace(/\D/g, "").length < 7) next.phone = "That number looks too short. Include the area code.";
    if (v("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))) next.email = "That email doesn't look right, or leave it blank.";
    if (!v("service")) next.service = "Choose the kind of appointment you need.";
    if (f.getAll("days").length === 0) next.days = "Pick at least one day that suits you.";
    if (!f.get("consent")) next.consent = "Please agree so we can use these details to arrange your appointment.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    const ref = `AG-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const saved = JSON.parse(localStorage.getItem("clinic-requests") ?? "[]") as unknown[];
      localStorage.setItem("clinic-requests", JSON.stringify([...saved, { ref, ...Object.fromEntries(f), days: f.getAll("days"), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setRequest({ ref, name: v("name").split(" ")[0], phone: v("phone"), service: v("service") });
  };

  const err = (k: keyof Errors) => (errors[k] ? { "aria-invalid": true as const, "aria-describedby": `cl-${k}-err` } : {});
  const errText = (k: keyof Errors) =>
    errors[k] ? (
      <p id={`cl-${k}-err`} className="fl-st2-err">
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="fl-st2-page" id="top">
      <header className="fl-st2-bar fl-st2-bar--split">
        <nav className="fl-st2-bar__row" aria-label="Main">
          <a className="fl-st2-brand" href="#top">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
            </svg>
            {d.brand}
          </a>
          <ul className="fl-st2-links" id="cl-links" data-open={menuOpen}>
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="fl-st2-bar__end">
            <a className="fl-btn fl-btn--primary" href="#cl-appointment">
              Request appointment
            </a>
            <button type="button" className="fl-btn fl-btn--secondary fl-st2-burger" aria-expanded={menuOpen} aria-controls="cl-links" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="menu" />
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="fl-st2-dirhead fl-bg-soft fl-bg-waves" aria-labelledby="cl-title">
          <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
            <span className="fl-st2-emblem" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round">
                <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
              </svg>
            </span>
            <h1 id="cl-title" className="fl-title fl-title--xl">
              {d.header.title}
            </h1>
            <p className="fl-lede">{d.header.lede}</p>
            <p className={openNow ? "fl-st2-status fl-st2-status--open" : "fl-st2-status fl-st2-status--closed"} style={{ margin: 0 }}>
              {openNow ? `Open now · until ${today.close}` : `Closed now · opens ${nextOpen}`}
            </p>
            <div className="fl-actions">
              <a className="fl-btn fl-btn--primary" href="#cl-appointment">
                Request an appointment
              </a>
              <a className="fl-btn fl-btn--secondary" href={`tel:${d.phone.replace(/\s/g, "")}`}>
                <Icon name="phone" />
                {d.phone}
              </a>
            </div>
          </div>
        </section>

        <section className="fl-section" id="cl-services" aria-labelledby="cl-services-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="cl-services-title" className="fl-title">
                {d.services.title}
              </h2>
              <p className="fl-lede">{d.services.lede}</p>
            </div>
            <div className="fl-st2-features">
              {d.services.features.map((s, i) => (
                <article key={s.title} className={i % 2 ? "fl-st2-feature fl-st2-feature--right" : "fl-st2-feature"}>
                  <div className="fl-st2-feature__media" aria-hidden="true">
                    <Icon name={s.icon} />
                  </div>
                  <div className="fl-st2-feature__body">
                    <h3>{s.title}</h3>
                    <p className="fl-text">{s.text}</p>
                    <ul className="fl-checks">
                      {s.points.map((p) => (
                        <li key={p}>
                          <span className="fl-tick">
                            <Icon name="check" />
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center", justifyContent: "center", marginTop: "var(--space-7)" }}>
              <span className="fl-meta">Also at Ashgrove:</span>
              <ul className="fl-st2-chips">
                {d.services.more.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="cl-team" aria-labelledby="cl-team-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="cl-team-title" className="fl-title">
                {d.team.title}
              </h2>
            </div>
            <ul className="fl-grid fl-grid--4" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {d.team.people.map((p) => (
                <li key={p.name} className="fl-card">
                  <div className="fl-person">
                    <span className="fl-person__avatar" aria-hidden="true">
                      {p.initials}
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <span>{p.role}</span>
                    </span>
                  </div>
                  <dl className="fl-meta" style={{ display: "grid", gap: "var(--space-1)", margin: 0 }}>
                    <div>
                      <dt style={{ display: "inline", fontWeight: "var(--weight-semibold)" }}>Speaks: </dt>
                      <dd style={{ display: "inline", margin: 0 }}>{p.langs}</dd>
                    </div>
                    <div>
                      <dt style={{ display: "inline", fontWeight: "var(--weight-semibold)" }}>In clinic: </dt>
                      <dd style={{ display: "inline", margin: 0 }}>{p.days}</dd>
                    </div>
                  </dl>
                  <span className={p.accepting ? "fl-st2-pill fl-st2-pill--calm" : "fl-st2-pill fl-st2-pill--muted"} style={{ justifySelf: "start" }}>
                    {p.accepting ? "Taking new patients" : "List full"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section" id="cl-hours" aria-labelledby="cl-hours-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div style={{ display: "grid", gap: "var(--space-5)" }}>
              <h2 id="cl-hours-title" className="fl-title">
                {d.hours.title}
              </h2>
              <div className="fl-st2-tablewrap">
                <table className="fl-st2-table fl-st2-hours" style={{ minWidth: 0 }}>
                  <caption className="fl-sr">Opening hours by day; today is highlighted</caption>
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col" className="fl-st2-num">
                        Hours
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                      const h = d.hours.days[i];
                      return (
                        <tr key={h.day} className={i === todayIdx ? "fl-st2-today" : undefined} aria-current={i === todayIdx ? "date" : undefined}>
                          <th scope="row" style={{ fontWeight: "inherit" }}>
                            {h.day}
                            {i === todayIdx ? <span className="fl-st2-pill" style={{ marginLeft: "var(--space-2)" }}>Today</span> : null}
                          </th>
                          <td className="fl-st2-num">{h.open ? `${h.open}–${h.close}` : "Closed"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="fl-note" style={{ margin: 0 }}>
                {d.hours.afterHours}
              </p>
            </div>
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div className="fl-media fl-media--wide" role="img" aria-label="Map placeholder showing the clinic on Ashgrove Road">
                <span>Map: 22 Ashgrove Road</span>
              </div>
              <p className="fl-text">{d.hours.address}</p>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="cl-appointment" aria-labelledby="cl-appt-title">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-head fl-head--center">
              <h2 id="cl-appt-title" className="fl-title">
                {d.appointment.title}
              </h2>
              <p className="fl-lede">{d.appointment.lede}</p>
            </div>
            <div className="fl-card" aria-live="polite">
              {request ? (
                <div style={{ display: "grid", gap: "var(--space-4)" }}>
                  <p className="fl-done" role="status">
                    Request {request.ref} received. Thank you, {request.name}: we'll call {request.phone} within one working day to book your {request.service.toLowerCase()} appointment.
                  </p>
                  <button type="button" className="fl-btn fl-btn--secondary" style={{ justifySelf: "start" }} onClick={() => setRequest(null)}>
                    Make another request
                  </button>
                </div>
              ) : (
                <form className="fl-form" noValidate onSubmit={submit}>
                  <p className="fl-st2-callout" style={{ margin: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                      <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />
                    </svg>
                    <span>
                      <strong>Not for emergencies.</strong> For chest pain, difficulty breathing or serious injury, call your local emergency number now.
                    </span>
                  </p>
                  <fieldset className="fl-st2-fieldset" aria-describedby={errors.patient ? "cl-patient-err" : undefined}>
                    <legend>Are you registered with us?</legend>
                    <div className="fl-st2-choices">
                      {["Yes, I'm a patient here", "No, I'm new"].map((x) => (
                        <label key={x} className="fl-st2-choice">
                          <input type="radio" name="patient" value={x} aria-invalid={errors.patient ? true : undefined} />
                          {x}
                        </label>
                      ))}
                    </div>
                    {errText("patient")}
                  </fieldset>
                  <div className="fl-st2-row2">
                    <div className="fl-field">
                      <label htmlFor="cl-name">Patient's full name</label>
                      <input id="cl-name" name="name" className="fl-input" autoComplete="name" {...err("name")} />
                      {errText("name")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="cl-dob">Date of birth</label>
                      <input id="cl-dob" name="dob" type="date" className="fl-input" autoComplete="bday" {...err("dob")} />
                      {errText("dob")}
                    </div>
                  </div>
                  <div className="fl-st2-row2">
                    <div className="fl-field">
                      <label htmlFor="cl-phone">Phone</label>
                      <input id="cl-phone" name="phone" type="tel" className="fl-input" autoComplete="tel" {...err("phone")} />
                      {errText("phone")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="cl-email">
                        Email <span className="fl-meta">(optional)</span>
                      </label>
                      <input id="cl-email" name="email" type="email" className="fl-input" autoComplete="email" {...err("email")} />
                      {errText("email")}
                    </div>
                  </div>
                  <div className="fl-st2-row2">
                    <div className="fl-field">
                      <label htmlFor="cl-service">Appointment for</label>
                      <span className="fl-st2-select">
                        <select id="cl-service" name="service" className="fl-input" defaultValue="" {...err("service")}>
                          <option value="">Choose a service</option>
                          {d.appointment.services.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </span>
                      {errText("service")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="cl-who">Practitioner</label>
                      <span className="fl-st2-select">
                        <select id="cl-who" name="who" className="fl-input" defaultValue="No preference">
                          <option>No preference</option>
                          {d.team.people.map((p) => (
                            <option key={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </span>
                    </div>
                  </div>
                  <fieldset className="fl-st2-fieldset" aria-describedby={errors.days ? "cl-days-err" : undefined}>
                    <legend>Days that suit you</legend>
                    <div className="fl-st2-choices">
                      {d.appointment.days.map((x) => (
                        <label key={x} className="fl-st2-choice">
                          <input type="checkbox" name="days" value={x} aria-invalid={errors.days ? true : undefined} />
                          {x}
                        </label>
                      ))}
                    </div>
                    {errText("days")}
                  </fieldset>
                  <fieldset className="fl-st2-fieldset">
                    <legend>Time of day</legend>
                    <div className="fl-st2-choices">
                      {d.appointment.times.map((x, i) => (
                        <label key={x} className="fl-st2-choice">
                          <input type="radio" name="time" value={x} defaultChecked={i === 0} />
                          {x}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="fl-field">
                    <label htmlFor="cl-reason">
                      What's it about? <span className="fl-meta">(optional)</span>
                    </label>
                    <textarea id="cl-reason" name="reason" className="fl-input" style={{ minHeight: "5rem" }} aria-describedby="cl-reason-note" />
                    <p id="cl-reason-note" className="fl-note" style={{ margin: 0 }}>
                      A line is enough. It helps us book the right length of appointment.
                    </p>
                  </div>
                  <div className="fl-field">
                    <label className="fl-st2-check" style={{ fontWeight: "var(--weight-regular)" }}>
                      <input type="checkbox" name="consent" {...err("consent")} />
                      I agree that the clinic may use these details to contact me about this appointment.
                    </label>
                    {errText("consent")}
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Send request
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="fl-section" id="cl-insurance" aria-labelledby="cl-ins-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div style={{ display: "grid", gap: "var(--space-5)" }}>
              <div className="fl-head" style={{ marginBottom: 0 }}>
                <h2 id="cl-ins-title" className="fl-title">
                  {d.insurance.title}
                </h2>
                <p className="fl-lede">{d.insurance.lede}</p>
              </div>
              <ul className="fl-st2-chips" aria-label="Insurers we work with">
                {d.insurance.insurers.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <div className="fl-st2-tablewrap">
                <table className="fl-st2-table" style={{ minWidth: 0 }}>
                  <caption>Self-pay fees</caption>
                  <thead>
                    <tr>
                      <th scope="col">Appointment</th>
                      <th scope="col" className="fl-st2-num">
                        Fee
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.insurance.fees.map((f) => (
                      <tr key={f.item}>
                        <th scope="row" style={{ fontWeight: "var(--weight-regular)" }}>
                          {f.item}
                        </th>
                        <td className="fl-st2-num">{f.fee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <h3 className="fl-title fl-title--md">Common questions</h3>
              <div className="fl-faq">
                {d.insurance.faq.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap fl-footer__base" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
          <span>{d.footer}</span>
          <span className="fl-st2-credit">
            Design: <a href="https://html5up.net">HTML5 UP</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
