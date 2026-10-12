/** @flowcode-library site-agency · Creative agency website (Industry sites)
 * Catalog ID: t.site-agency (template)
 * Function: The creative agency one-page website (t.site-agency), assembled inline from its own sections with catalog chips, accordion, avatar, fields, budget pills and buttons; no page block fits its layout.
 * Use it as: Copy site-agency.tsx (FlowCode brings the components it uses); replace SAMPLE with the business's own content.
 * Built from: c.chip.filter, c.empty-state, c.accordion.bordered, c.badge.status, c.avatar.person, c.card.surface, c.text-field.outlined, c.choice-group.pill, c.button.primary, c.button.secondary, c.button.on-accent, c.button.ghost-on-accent
 * Look: A bold, ink-dark creative studio page: big banner, filterable tiles of work, accordion services, numbered process, client wordmarks with a quote, and an enquiry form.
 * Use cases: agency website; design studio; creative portfolio; services overview; case studies; client work; consultancy site; project enquiry
 * Jobs to be done: see the studio's past work; understand how they work; find out what services they offer; start a project with the studio
 * Keywords: page, template, agency, studio, portfolio, work, services, process, clients, contact, html5up
 */
/**
 * Page template: creative agency or design studio website. A one-page site for a branding, web or campaign studio:
 * a bold banner, a filterable showcase of work in alternating wide and narrow tiles, services with what each includes,
 * a four-step process, client names with a quote, and a project enquiry form beside the ways to get in touch. The
 * menu opens as a side panel. Layout adapted from HTML5 UP "Forty" (html5up.net, CC BY 3.0); keep the credit.
 * The form checks its fields and keeps enquiries in local storage; nothing is sent.
 * Assembled from: header and side menu panel (inline) > banner (inline) > work showcase (inline) with c.chip.filter and
 * c.empty-state > services c.accordion.bordered (inline section) > process steps (inline) > clients (inline) with c.avatar >
 * contact c.card.surface (inline) with c.text-field and the c.choice-group.pill budget > footer (inline). No page block matches this studio
 * layout, so the sections stay in the template; every button, chip, badge, card, avatar, field, budget pills, accordion and
 * empty state is the catalog component.
 * Make it the app's own: replace SAMPLE with real projects, services and clients, and keep the budget options honest.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { Chip } from "./chips-tags";
import { Avatar } from "./avatars-variants";
import { Card } from "./cards-variants";
import { TextField } from "./text-fields-states";
import { ChoiceGroup } from "./checkboxes-radios";
import { Accordion } from "./accordion-variants";
import { EmptyState } from "./empty-states";

// flowcode:sample
const SAMPLE = {
  brand: "Northlight Studio",
  links: [
    { label: "Work", href: "#agency-work" },
    { label: "Services", href: "#agency-services" },
    { label: "Process", href: "#agency-process" },
    { label: "Clients", href: "#agency-clients" },
    { label: "Contact", href: "#agency-contact" },
  ],
  hero: {
    eyebrow: "Brand, web and campaign studio",
    title: "We make small companies look like they mean it.",
    lede: "Eleven people in a converted print works. Since 2016 we've named, branded and launched over 140 businesses, from bakeries to biotech.",
    action: { label: "Start a project", href: "#agency-contact" },
    secondary: { label: "See our work", href: "#agency-work" },
  },
  work: {
    title: "Selected work",
    filters: ["All", "Brand", "Digital", "Campaign"],
    projects: [
      { title: "Fernhill Dairy", kind: "Brand", summary: "A new name, packaging system and van livery for a family creamery.", result: "Stocked in 60 new shops in a year" },
      { title: "Tidewater Rowing Club", kind: "Campaign", summary: "A membership drive built around early-morning river photography.", result: "312 new members in one season" },
      { title: "Cartograph", kind: "Digital", summary: "Website and booking flow for an independent map and travel bookshop.", result: "Online orders up 2.4×" },
      { title: "Hollow Oak Cider", kind: "Brand", summary: "Labels that change with each harvest, printed on the farm's own press.", result: "Shortlisted for two packaging awards" },
      { title: "Quayside Clinic", kind: "Digital", summary: "A calmer website and appointment finder for a physiotherapy practice.", result: "Missed appointments down 28%" },
      { title: "Lantern Festival 2026", kind: "Campaign", summary: "Posters, wayfinding and a ticket site for a three-night light festival.", result: "Sold out four weeks early" },
    ],
  },
  services: {
    eyebrow: "What we do",
    title: "Services",
    lede: "Hire us for one thing or all of it. Every project has one lead designer from start to finish.",
    items: [
      { name: "Brand identity", from: "From $11,000", text: "Naming, logo, type, color, a short brand guide and the first twenty things you'll need to print." },
      { name: "Websites", from: "From $16,000", text: "Design and build on a platform you can edit yourself. Booking, shops and memberships included where you need them." },
      { name: "Campaigns", from: "From $8,000", text: "Launches, open days and fundraising drives: posters, social, email and the landing page that ties them together." },
      { name: "Packaging", from: "From $6,000", text: "Labels, boxes and bags with print-ready files and a supplier we trust to make them." },
    ],
  },
  process: {
    title: "How a project runs",
    steps: [
      { n: "01", title: "Listen", text: "A half-day workshop with you and two of your customers. We leave with a one-page brief.", time: "Week 1" },
      { n: "02", title: "Explore", text: "Three distinct directions, presented in person, with the thinking behind each one.", time: "Weeks 2–4" },
      { n: "03", title: "Refine", text: "One direction, two rounds of changes, tested on the real things you'll use.", time: "Weeks 5–8" },
      { n: "04", title: "Launch", text: "Files, guides and a launch day together. We check in again at three months.", time: "Week 9 on" },
    ],
  },
  clients: {
    title: "Some people we've worked with",
    names: ["Fernhill Dairy", "Cartograph", "Quayside Clinic", "Hollow Oak", "Tidewater RC", "Marlow & Finch", "Saltmarsh Trust", "Bramble Tech"],
    quote: "They asked better questions about our business than our accountant does. The new brand paid for itself by Christmas.",
    person: { name: "Ruth Adeyemi", role: "Owner, Fernhill Dairy", initials: "RA" },
  },
  contact: {
    title: "Tell us about your project",
    lede: "We take on six new projects a quarter. Tell us a little and we'll reply within two working days.",
    budgets: ["Under $13k", "$13k – $33k", "$33k – $66k", "$66k +"],
    methods: [
      { icon: "mail", label: "Email", value: "studio@northlight.example" },
      { icon: "phone", label: "Phone", value: "0117 496 0732" },
      { icon: "pin", label: "Studio", value: "The Print Works, 3 Kiln Yard, Bristol" },
    ],
    storageKey: "site-agency-enquiries",
  },
  footer: { copyright: "© 2026 Northlight Studio Ltd", social: ["Instagram", "Dribbble", "LinkedIn"] },
};

type Errors = Partial<Record<"name" | "email" | "budget" | "message", string>>;

export default function SiteAgency() {
  const d = SAMPLE;
  const [panel, setPanel] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState("All");
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!panel) return;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setPanel(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  const closePanel = () => setPanel(false);

  // Return focus to the trigger whenever the panel closes (Escape included).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !panel) menuBtn.current?.focus();
    wasOpen.current = panel;
  }, [panel]);

  const shown = filter === "All" ? d.work.projects : d.work.projects.filter((p) => p.kind === filter);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const next: Errors = {};
    if (!v("name")) next.name = "Add your name.";
    if (!/^\S+@\S+\.\S+$/.test(v("email"))) next.email = "Enter an email address like name@company.com.";
    if (!v("budget")) next.budget = "Choose a rough budget. It helps us suggest the right team.";
    if (v("message").length < 20) next.message = "Tell us a little more: at least a sentence or two.";
    setErrors(next);
    if (Object.keys(next).length) {
      e.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(d.contact.storageKey) ?? "[]") as unknown[];
      localStorage.setItem(d.contact.storageKey, JSON.stringify([...saved, { ...Object.fromEntries(f), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setSent(v("name"));
  };

  const errText = (k: keyof Errors) =>
    errors[k] ? (
      <p id={`agency-${k}-err`} className="fl-st-err">
        {errors[k]}
      </p>
    ) : null;
  const errProps = (k: keyof Errors) => ({ invalid: errors[k] ? true : undefined, "aria-describedby": errors[k] ? `agency-${k}-err` : undefined });

  return (
    <div className="fl-st fl-st-agency" id="top">
      <header className="fl-st-agency-top">
        <a className="fl-st-agency-brand" href="#top">
          {d.brand}
        </a>
        <button ref={menuBtn} type="button" className="fl-st-agency-menubtn" aria-expanded={panel} aria-haspopup="dialog" onClick={() => setPanel(true)}>
          Menu
          <Icon name="menu" />
        </button>
      </header>

      {panel ? (
        <div className="fl-st-scrim" onClick={closePanel}>
          <div ref={panelRef} className="fl-st-agency-panel" role="dialog" aria-modal="true" aria-labelledby="agency-panel-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="agency-panel-title" className="fl-sr">
              Site menu
            </h2>
            <ul>
              {d.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={closePanel}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <Button variant="secondary" onClick={closePanel}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      <main>
        <section className="fl-section fl-bg-ink fl-st-agency-banner" aria-labelledby="agency-hero-title">
          <div className="fl-wrap">
            <p className="fl-eyebrow">{d.hero.eyebrow}</p>
            <h1 id="agency-hero-title" className="fl-title fl-title--xl fl-st-major">
              {d.hero.title}
            </h1>
            <p className="fl-lede">{d.hero.lede}</p>
            <div className="fl-actions">
              <Button variant="on-accent" href={d.hero.action.href}>
                {d.hero.action.label}
              </Button>
              <Button variant="ghost-on-accent" href={d.hero.secondary.href}>
                {d.hero.secondary.label}
              </Button>
            </div>
          </div>
        </section>

        <section id="agency-work" aria-labelledby="agency-work-title" className="fl-st-agency-work">
          <div className="fl-st-agency-workbar">
            <h2 id="agency-work-title" className="fl-title fl-title--md">
              {d.work.title}
            </h2>
            <div className="fl-st-chips" role="group" aria-label="Filter work">
              {d.work.filters.map((f) => (
                <Chip key={f} variant="filter" selected={filter === f} onClick={() => setFilter(f)}>
                  {f}
                </Chip>
              ))}
            </div>
            <p className="fl-sr" aria-live="polite">
              {shown.length} projects shown
            </p>
          </div>
          {shown.length ? (
            <ul className="fl-st-tiles">
              {shown.map((p, i) => (
                <li key={p.title} className={`fl-st-tile fl-st-tone-${(d.work.projects.indexOf(p) % 6) + 1}`}>
                  <a href="#agency-work" className="fl-st-tile__link" aria-describedby={`agency-tile-${i}`}>
                    <span className="fl-st-tile__kind">{p.kind}</span>
                    <strong className="fl-st-tile__title">{p.title}</strong>
                    <span id={`agency-tile-${i}`} className="fl-st-tile__more">
                      {p.summary} <em>{p.result}</em>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ margin: "var(--space-6) var(--space-5)" }}>
              <EmptyState
                variant="no-results"
                title={`No ${filter.toLowerCase()} projects to show yet.`}
                action={
                  <Button variant="secondary" onClick={() => setFilter("All")}>
                    Show all work
                  </Button>
                }
              >
                Pick another category to see more.
              </EmptyState>
            </div>
          )}
        </section>

        <section className="fl-section" id="agency-services" aria-labelledby="agency-services-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <p className="fl-eyebrow">{d.services.eyebrow}</p>
              <h2 id="agency-services-title" className="fl-title fl-st-major">
                {d.services.title}
              </h2>
              <p className="fl-lede">{d.services.lede}</p>
            </div>
            <Accordion variant="bordered" defaultOpen={[0]} items={d.services.items.map((it) => ({ q: `${it.name} · ${it.from}`, a: it.text }))} />
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="agency-process" aria-labelledby="agency-process-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="agency-process-title" className="fl-title fl-st-major">
                {d.process.title}
              </h2>
            </div>
            <ol className="fl-st-steps">
              {d.process.steps.map((s) => (
                <li key={s.n}>
                  <span className="fl-st-steps__n" aria-hidden="true">
                    {s.n}
                  </span>
                  <h3>{s.title}</h3>
                  <p className="fl-text">{s.text}</p>
                  <Badge tone="info">{s.time}</Badge>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="fl-section" id="agency-clients" aria-labelledby="agency-clients-title">
          <div className="fl-wrap">
            <h2 id="agency-clients-title" className="fl-eyebrow" style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
              {d.clients.title}
            </h2>
            <ul className="fl-st-wordmarks">
              {d.clients.names.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <figure className="fl-st-agency-quote">
              <blockquote className="fl-quote fl-quote--xl">“{d.clients.quote}”</blockquote>
              <figcaption className="fl-person">
                <Avatar name={d.clients.person.name} size={48} decorative />
                <span>
                  <strong>{d.clients.person.name}</strong>
                  <span>{d.clients.person.role}</span>
                </span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="agency-contact" aria-labelledby="agency-contact-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="agency-contact-title" className="fl-title fl-st-major">
                {d.contact.title}
              </h2>
              <p className="fl-lede">{d.contact.lede}</p>
            </div>
            <div className="fl-st-agency-contact">
              <Card variant="surface">
                {sent ? (
                  <div className="fl-form" role="status">
                    <p className="fl-done">Thanks {sent}. Your brief is with us and a designer will reply within two working days.</p>
                    <Button variant="secondary" onClick={() => setSent(null)}>
                      Send another enquiry
                    </Button>
                  </div>
                ) : (
                  <form className="fl-form" onSubmit={submit} noValidate>
                    <div className="fl-st-row2">
                      <div className="fl-field">
                        <label htmlFor="agency-name">Name</label>
                        <TextField id="agency-name" name="name" autoComplete="name" {...errProps("name")} />
                        {errText("name")}
                      </div>
                      <div className="fl-field">
                        <label htmlFor="agency-email">Email</label>
                        <TextField id="agency-email" name="email" type="email" autoComplete="email" {...errProps("email")} />
                        {errText("email")}
                      </div>
                    </div>
                    <div className="fl-st-fieldset" aria-describedby={errors.budget ? "agency-budget-err" : undefined}>
                      <ChoiceGroup variant="pill" label="Rough budget" name="budget" options={d.contact.budgets.map((b) => ({ value: b, label: b }))} />
                      {errText("budget")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="agency-message">About the project</label>
                      <TextField multiline id="agency-message" name="message" placeholder="What are you making, and by when?" {...errProps("message")} />
                      {errText("message")}
                    </div>
                    <Button variant="primary" type="submit">
                      Send enquiry
                    </Button>
                  </form>
                )}
              </Card>
              <ul className="fl-st-methods">
                {d.contact.methods.map((m) => (
                  <li key={m.label} className="fl-person">
                    <span className="fl-icon">
                      <Icon name={m.icon} />
                    </span>
                    <span>
                      <strong>{m.label}</strong>
                      <span>{m.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap fl-footer__base" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
          <ul style={{ display: "flex", gap: "var(--space-5)" }}>
            {d.footer.social.map((s) => (
              <li key={s}>
                <a href="#top">{s}</a>
              </li>
            ))}
          </ul>
          <span>
            {d.footer.copyright} · Design: <a href="https://html5up.net">HTML5 UP</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
