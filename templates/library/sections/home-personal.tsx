/** @flowcode-library home-personal · Personal homepage (Homepages)
 * Catalog ID: t.home-personal (template)
 * Function: A whole personal portfolio homepage assembled from: nav (inline) > hero (inline) > selected work with filter (inline) > services and skills (inline) > experience (inline) > b.testimonial-feature > writing (inline) > enquiry form (inline) > footer (inline); no block fits this layout, so all sections are inline built from catalog components.
 * Use it as: Copy home-personal.tsx (FlowCode brings the components it uses); replace SAMPLE with the person's own projects, roles, posts and contact details, and swap the drawn project covers for real screenshots.
 * Built from: b.testimonial-feature, c.button.primary, c.button.secondary, c.button.tertiary, c.chip.filter, c.chip.static, c.badge.status, c.avatar.person, c.card.surface, c.empty-state.no-results, c.text-field.outlined, c.select.outlined
 * Look: Quiet name-first page with a large typographic introduction and availability dot, filterable project covers, services, experience, a client quote, recent writing and an enquiry form.
 * Use cases: personal website; portfolio; freelancer site; designer portfolio; developer portfolio; online resume; personal blog; hire me
 * Jobs to be done: see the freelancer's best work; check if they are available; learn what services they offer; send a project enquiry
 * Keywords: page, homepage, personal, portfolio, freelancer, resume, blog, contact
 */
/**
 * Assembled from: nav (inline) > hero with availability and portrait (inline) > selected work with a project filter
 * (inline) > services and skills (inline) > experience timeline (inline) > b.testimonial-feature > recent writing
 * (inline) > project enquiry form (inline) > footer (inline). Every button is c.button, project filters are c.chip,
 * kind labels are c.badge, skills are static c.chip, service and form cards are c.card, people are c.avatar, the form
 * is c.text-field and c.select, and the empty filter is c.empty-state.
 */
/**
 * Page template: personal homepage. A whole one-person site for a freelancer, here a product designer who also
 * builds front ends: a quiet name-first navigation, a large typographic introduction with availability, selected
 * work with a filter, what they do, experience, a client quote, recent writing, a project enquiry form and a footer.
 * Suits freelance designers, developers, writers, photographers and consultants. Make it the app's own: replace
 * SAMPLE with the person's real projects, roles and posts, and swap the drawn project covers for real screenshots.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { Chip } from "./chips-tags";
import { Avatar } from "./avatars-variants";
import { Card } from "./cards-variants";
import { TextField } from "./text-fields-states";
import { Select } from "./dropdowns-states";
import { EmptyState } from "./empty-states";
import { TestimonialFeature } from "./testimonial-feature";

// flowcode:sample
const SAMPLE = {
  name: "Noor Halvorsen",
  initials: "NH",
  links: [
    { label: "Work", href: "#hp-me-work" },
    { label: "Experience", href: "#hp-me-xp" },
    { label: "Writing", href: "#hp-me-writing" },
    { label: "Contact", href: "#hp-me-contact" },
  ],
  available: "Booking projects from June 2026",
  hello: "Hi, I'm Noor.",
  title: "I design and build calm, useful software for small businesses.",
  lede: "Product designer and front-end developer in Rotterdam. Ten years of turning messy booking, ordering and admin tools into screens people actually enjoy using.",
  primary: "Start a project",
  secondary: "See selected work",
  filters: ["All", "Product", "Web", "Brand"],
  work: [
    { id: "kiln", title: "Kiln & Co. booking app", kind: "Product", year: "2025", text: "Class booking and waitlists for a chain of four pottery studios. Bookings up 38% in the first quarter.", shape: "calendar" },
    { id: "harbour", title: "Harbour Bakery ordering", kind: "Web", year: "2025", text: "Pre-order site for a neighborhood bakery, built to sell out by 9am without a queue.", shape: "bag" },
    { id: "greenline", title: "Greenline Cleaners rebrand", kind: "Brand", year: "2024", text: "Name, logo and van livery for a family cleaning business moving into offices.", shape: "mark" },
    { id: "ledger", title: "Fieldnote invoicing", kind: "Product", year: "2023", text: "Invoices and expenses for independent tradespeople, designed for use on a phone in a van.", shape: "chart" },
  ],
  servicesTitle: "What I can help with",
  services: [
    { icon: "layers", title: "Product design", text: "Research, flows, wireframes and polished screens for web and mobile apps." },
    { icon: "bolt", title: "Front-end build", text: "Accessible, fast React front ends that match the design to the pixel." },
    { icon: "sparkle", title: "Design systems", text: "Tokens, components and docs so your team can keep shipping after I leave." },
  ],
  skills: ["User research", "Prototyping", "Accessibility audits", "React", "TypeScript", "Design tokens", "Workshops", "Copywriting for UI"],
  experience: [
    { when: "2021 - now", role: "Independent designer and developer", where: "Self-employed", text: "Projects for studios, shops, clinics and two early-stage startups." },
    { when: "2018 - 2021", role: "Senior Product Designer", where: "A booking platform for salons (120 people)", text: "Led the redesign of the calendar used by 9,000 salons every day." },
    { when: "2016 - 2018", role: "Designer and front-end developer", where: "A small digital agency in Utrecht", text: "Websites and first apps for local businesses and cultural venues." },
  ],
  quote: { text: "Noor understood our studio in a week and gave us a booking app our members actually compliment. She also left us with docs so clear our part-time developer kept going without her.", name: "Ilse de Vries", role: "Owner, Kiln & Co." },
  posts: [
    { date: "2026-03-18", label: "18 Mar 2026", title: "Designing waitlists that feel fair", read: "6 min read" },
    { date: "2026-01-30", label: "30 Jan 2026", title: "Why small businesses don't need a design system (yet)", read: "8 min read" },
    { date: "2025-11-12", label: "12 Nov 2025", title: "Booking forms: the five fields you can delete today", read: "4 min read" },
  ],
  contactTitle: "Tell me about your project",
  contactText: "A few lines is plenty. I reply within two working days with honest thoughts, even if I'm not the right fit.",
  email: "hello@noorhalvorsen.example",
  types: ["Product design", "Front-end build", "Design and build", "Design system", "Something else"],
  budgets: ["Under €5k", "€5k - €15k", "€15k - €40k", "Over €40k", "Not sure yet"],
  footer: "© 2026 Noor Halvorsen · Rotterdam · KvK 81234567",
  socials: ["Newsletter", "Reading list", "CV (PDF)"],
};

type Field = "name" | "email" | "type" | "message";
type Errors = Partial<Record<Field, string>>;

function Cover({ shape }: { shape: string }) {
  const common = { fill: "none", stroke: "var(--color-surface)", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true">
      <rect x="10" y="8" width="140" height="104" rx="10" fill="var(--color-surface)" opacity="0.92" />
      {shape === "calendar" ? (
        <g>
          {[0, 1, 2, 3, 4].map((c) => (
            <rect key={c} x={22 + c * 24} y="24" width="18" height="6" rx="2" fill="var(--color-border-strong)" />
          ))}
          <rect x="22" y="38" width="42" height="18" rx="4" fill="var(--color-accent)" />
          <rect x="70" y="58" width="42" height="26" rx="4" fill="var(--color-success)" opacity="0.8" />
          <rect x="46" y="88" width="42" height="14" rx="4" fill="var(--color-secondary, var(--color-accent))" opacity="0.5" />
          <rect x="118" y="38" width="20" height="30" rx="4" fill="var(--color-focus)" opacity="0.6" />
        </g>
      ) : shape === "bag" ? (
        <g>
          <rect x="24" y="22" width="112" height="14" rx="4" fill="var(--color-surface-sunken)" />
          {[0, 1, 2].map((c) => (
            <g key={c}>
              <rect x={24 + c * 39} y="44" width="34" height="34" rx="6" fill="var(--color-secondary, var(--color-accent))" opacity={0.35 + c * 0.2} />
              <rect x={24 + c * 39} y="84" width="26" height="5" rx="2" fill="var(--color-border-strong)" />
              <rect x={24 + c * 39} y="94" width="16" height="5" rx="2" fill="var(--color-text-muted)" />
            </g>
          ))}
        </g>
      ) : shape === "mark" ? (
        <g>
          <circle cx="80" cy="54" r="28" fill="var(--color-success)" />
          <path d="M66 56c6-14 22-14 28 0" {...common} strokeWidth={4} />
          <path d="M70 62h20" {...common} strokeWidth={4} />
          <rect x="52" y="92" width="56" height="7" rx="3" fill="var(--color-text)" opacity="0.7" />
        </g>
      ) : (
        <g>
          <rect x="22" y="22" width="56" height="8" rx="3" fill="var(--color-text)" opacity="0.7" />
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <rect key={c} x={26 + c * 19} y={96 - [30, 44, 26, 52, 60, 40][c]} width="12" height={[30, 44, 26, 52, 60, 40][c]} rx="3" fill="var(--color-secondary, var(--color-accent))" opacity={0.45 + c * 0.09} />
          ))}
          <rect x="22" y="100" width="116" height="2" fill="var(--color-border-strong)" />
        </g>
      )}
    </svg>
  );
}

export default function HomePersonal() {
  const d = SAMPLE;
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState("All");
  const [errors, setErrors] = useState<Errors>({});
  const [sentTo, setSentTo] = useState("");

  const work = filter === "All" ? d.work : d.work.filter((w) => w.kind === filter);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const next: Errors = {};
    if (!v("name")) next.name = "Please add your name.";
    if (!v("email")) next.email = "Please add an email I can reply to.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))) next.email = "That email is missing an @ or a dot.";
    if (!v("type")) next.type = "Choose the kind of project.";
    if (v("message").length < 20) next.message = "A sentence or two more, please (at least 20 characters).";
    setErrors(next);
    const first = (["name", "email", "type", "message"] as Field[]).find((k) => next[k]);
    if (first) {
      document.getElementById(`hp-me-${first}`)?.focus();
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("noor-enquiries") ?? "[]") as unknown[];
      localStorage.setItem("noor-enquiries", JSON.stringify([...saved, { ...Object.fromEntries(f), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setSentTo(v("name"));
  };

  const fieldProps = (k: Field) => ({
    id: `hp-me-${k}`,
    name: k,
    invalid: !!errors[k],
    "aria-describedby": errors[k] ? `hp-me-${k}-err` : undefined,
  });
  const fieldError = (k: Field) =>
    errors[k] ? (
      <p id={`hp-me-${k}-err`} className="fl-hp-error">
        {errors[k]}
      </p>
    ) : null;
  return (
    <div className="fl-hp-page" id="top">
      <header className="fl-nav" style={{ background: "var(--color-bg)" }}>
        <nav className="fl-nav__row fl-hp-me-nav" aria-label="Main">
          <a className="fl-nav__brand" href="#top" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Avatar name={d.name} size={40} decorative />
            {d.name}
          </a>
          <ul className="fl-nav__links">
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="fl-nav__end">
            <Button variant="secondary" className="fl-nav__menu" aria-expanded={menu} aria-controls="hp-me-menu" aria-label="Menu" onClick={() => setMenu((o) => !o)}>
              <Icon name="menu" />
            </Button>
          </div>
        </nav>
        <ul id="hp-me-menu" className="fl-hp-menu" data-open={menu}>
          {d.links.map((l) => (
            <li key={l.label}>
              <a href={l.href} onClick={() => setMenu(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <main>
        <section className="fl-hp-me-hero fl-bg-dots" aria-labelledby="hp-me-title">
          <div className="fl-wrap fl-hp-me-hero__grid">
            <div style={{ display: "grid", gap: "var(--space-5)" }}>
              <p className="fl-hp-avail">
                <i aria-hidden="true" />
                {d.available}
              </p>
              <p className="fl-lede" style={{ color: "var(--color-text)", fontWeight: "var(--weight-semibold)" }}>
                {d.hello}
              </p>
              <h1 id="hp-me-title" className="fl-title fl-title--xl" style={{ maxWidth: "20ch" }}>
                {d.title}
              </h1>
              <p className="fl-lede">{d.lede}</p>
              <div className="fl-actions">
                <Button variant="primary" href="#hp-me-contact">
                  {d.primary}
                </Button>
                <Button variant="tertiary" icon="arrow" iconAt="end" href="#hp-me-work">
                  {d.secondary}
                </Button>
              </div>
            </div>
            <div className="fl-hp-me-portrait" aria-hidden="true">
              {d.initials}
            </div>
          </div>
        </section>

        <section className="fl-section" id="hp-me-work" aria-labelledby="hp-me-work-title">
          <div className="fl-wrap">
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "end", gap: "var(--space-4)", marginBottom: "var(--space-7)" }}>
              <div className="fl-head" style={{ marginBottom: 0 }}>
                <p className="fl-eyebrow">Selected work</p>
                <h2 id="hp-me-work-title" className="fl-title">
                  Recent projects
                </h2>
              </div>
              <div className="fl-hp-chips" role="group" aria-label="Filter projects">
                {d.filters.map((f) => (
                  <Chip key={f} variant="filter" selected={filter === f} onClick={() => setFilter(f)}>
                    {f}
                  </Chip>
                ))}
              </div>
            </div>
            <p className="fl-sr" aria-live="polite">
              {work.length} {work.length === 1 ? "project" : "projects"} shown
            </p>
            {work.length === 0 ? (
              <EmptyState variant="no-results" title={`No ${filter.toLowerCase()} projects to show yet`}>
                Try another filter to see more work.
              </EmptyState>
            ) : (
              <ul className="fl-hp-list fl-hp-work">
                {work.map((w) => {
                  const i = d.work.findIndex((x) => x.id === w.id) % 4;
                  return (
                    <li key={w.id}>
                      <a className="fl-hp-work__card" href={`#work-${w.id}`}>
                        <div className={`fl-hp-work__art fl-hp-work__art--${i}`}>
                          <Cover shape={w.shape} />
                        </div>
                        <div className="fl-hp-work__meta">
                          <Badge tone="info">{w.kind}</Badge>
                          <span className="fl-meta">{w.year}</span>
                        </div>
                        <h3>{w.title}</h3>
                        <p className="fl-text">{w.text}</p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="fl-section fl-section--tint" aria-labelledby="hp-me-services-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <p className="fl-eyebrow">Services</p>
              <h2 id="hp-me-services-title" className="fl-title">
                {d.servicesTitle}
              </h2>
            </div>
            <ul className="fl-hp-list fl-grid fl-grid--3">
              {d.services.map((s) => (
                <li key={s.title} style={{ display: "grid" }}>
                  <Card variant="surface">
                    <span className="fl-icon">
                      <Icon name={s.icon} />
                    </span>
                    <h3>{s.title}</h3>
                    <p className="fl-text">{s.text}</p>
                  </Card>
                </li>
              ))}
            </ul>
            <h3 className="fl-sr">Skills</h3>
            <ul className="fl-hp-list fl-hp-tags" style={{ marginTop: "var(--space-6)" }}>
              {d.skills.map((s) => (
                <li key={s} style={{ padding: 0, background: "none" }}>
                  <Chip variant="static" size={24}>
                    {s}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section" id="hp-me-xp" aria-labelledby="hp-me-xp-title">
          <div className="fl-wrap fl-split fl-split--start fl-hp-xp-split">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <p className="fl-eyebrow">Experience</p>
              <h2 id="hp-me-xp-title" className="fl-title">
                Ten years, three chapters
              </h2>
            </div>
            <ol className="fl-hp-list fl-hp-xp">
              {d.experience.map((x) => (
                <li key={x.role}>
                  <time>{x.when}</time>
                  <div>
                    <h3>{x.role}</h3>
                    <p className="fl-meta" style={{ margin: "0 0 var(--space-2)" }}>
                      {x.where}
                    </p>
                    <p className="fl-text">{x.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <TestimonialFeature quote={d.quote.text} name={d.quote.name} role={d.quote.role} />

        <section className="fl-section" id="hp-me-writing" aria-labelledby="hp-me-writing-title">
          <div className="fl-wrap">
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "end", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
              <div className="fl-head" style={{ marginBottom: 0 }}>
                <p className="fl-eyebrow">Writing</p>
                <h2 id="hp-me-writing-title" className="fl-title">
                  Notes from the work
                </h2>
              </div>
              <a className="fl-link" href="#writing">
                All posts
              </a>
            </div>
            <ul className="fl-hp-list fl-hp-posts" style={{ borderBottom: "1px solid var(--color-border)" }}>
              {d.posts.map((p) => (
                <li key={p.title}>
                  <a href={`#post-${p.date}`}>
                    <time dateTime={p.date} className="fl-meta">
                      {p.label}
                    </time>
                    <span style={{ display: "grid", gap: "var(--space-1)" }}>
                      <strong>{p.title}</strong>
                      <span className="fl-meta">{p.read}</span>
                    </span>
                    <Icon name="arrow" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="hp-me-contact" aria-labelledby="hp-me-contact-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <p className="fl-eyebrow">Contact</p>
              <h2 id="hp-me-contact-title" className="fl-title">
                {d.contactTitle}
              </h2>
              <p className="fl-lede">{d.contactText}</p>
              <p className="fl-person" style={{ marginTop: "var(--space-3)" }}>
                <span className="fl-icon">
                  <Icon name="mail" />
                </span>
                <a className="fl-link" href={`mailto:${d.email}`}>
                  {d.email}
                </a>
              </p>
            </div>
            <Card variant="surface">
              {sentTo ? (
                <div role="status" style={{ display: "grid", gap: "var(--space-3)" }}>
                  <p className="fl-done">Thanks, {sentTo}. Your note is saved and I'll reply within two working days.</p>
                  <Button variant="secondary" onClick={() => setSentTo("")}>
                    Send another
                  </Button>
                </div>
              ) : (
                <form className="fl-form" onSubmit={submit} noValidate>
                  <div className="fl-grid fl-grid--2" style={{ gap: "var(--space-4)" }}>
                    <div className="fl-field">
                      <label htmlFor="hp-me-name">Your name</label>
                      <TextField autoComplete="name" {...fieldProps("name")} />
                      {fieldError("name")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="hp-me-email">Email</label>
                      <TextField type="email" autoComplete="email" {...fieldProps("email")} />
                      {fieldError("email")}
                    </div>
                  </div>
                  <div className="fl-grid fl-grid--2" style={{ gap: "var(--space-4)" }}>
                    <div className="fl-field">
                      <label htmlFor="hp-me-type">Project type</label>
                      <Select options={d.types} placeholder="Choose one" {...fieldProps("type")} />
                      {fieldError("type")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="hp-me-budget">Budget (optional)</label>
                      <Select id="hp-me-budget" name="budget" options={d.budgets} defaultValue="Not sure yet" />
                    </div>
                  </div>
                  <div className="fl-field">
                    <label htmlFor="hp-me-message">What are you working on?</label>
                    <TextField multiline {...fieldProps("message")} />
                    {fieldError("message")}
                  </div>
                  <Button variant="primary" type="submit">
                    Send enquiry
                  </Button>
                </form>
              )}
            </Card>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--space-4)", alignItems: "center" }}>
          <span className="fl-meta">{d.footer}</span>
          <nav aria-label="Elsewhere">
            <ul style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-5)" }}>
              {d.socials.map((s) => (
                <li key={s}>
                  <a href="#top">{s}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
