/** @flowcode-library home-startup · Startup homepage (Homepages)
 * Use cases: startup homepage; company website; careers; open roles; about the team; mission statement; traction milestones; investor-facing site
 * Jobs to be done: understand what the company is building; learn who the founders are; find a job that fits me; hear about future roles
 * Keywords: page, homepage, startup, mission, traction, timeline, team, careers, hiring
 */
/**
 * Page template: startup homepage. A whole page for an early-stage company that is selling a vision as much as a
 * product, here a small team building a shared household planner: navigation, a bold left-aligned hero with a
 * working product glimpse, the mission, what is being built, traction and milestones, the founders, open roles with
 * a team filter, and a "hear about future roles" form, then a footer. Suits seed-stage startups, labs and new
 * ventures that are hiring. Make it the app's own: replace SAMPLE with the company's real mission, numbers, team and
 * roles; keep the traction honest and dated.
 */
import { useState, type FormEvent } from "react";
import { Icon, Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Hearthly",
  links: [
    { label: "Mission", href: "#hp-st-mission" },
    { label: "Product", href: "#hp-st-product" },
    { label: "Progress", href: "#hp-st-progress" },
    { label: "Team", href: "#hp-st-team" },
    { label: "Jobs", href: "#hp-st-jobs" },
  ],
  cta: "Join the beta",
  eyebrow: "Seed-funded · 9 people · Remote across 4 time zones",
  title: "Running a home is a team sport. We're building the playbook.",
  lede: "Hearthly is one shared plan for chores, bills, meals and the school run, so nobody in the house has to be the one who remembers everything.",
  secondary: "We're hiring",
  board: {
    title: "This week at the Okafor-Lindqvist house",
    items: [
      { id: "bins", label: "Bins out (Tuesday night)", who: "TL", done: true },
      { id: "dentist", label: "Book Ada's dentist check-up", who: "MO", done: false },
      { id: "rent", label: "Pay rent share: $640", who: "TL", done: false },
      { id: "shop", label: "Big shop for the week", who: "MO", done: false },
    ],
  },
  missionLabel: "Our mission",
  mission: "Give every household back the hours lost to keeping track, and make sure the invisible work is seen and shared fairly.",
  missionText: "Couples, flatmates and families tell us the same thing: the work itself is fine, it's carrying the list in your head that wears you down. We think software should take that weight.",
  productTitle: "What we're building",
  product: [
    { icon: "users", title: "One plan, everyone in it", text: "Each person sees what's theirs today. Swaps and hand-offs take one tap, no group chat needed." },
    { icon: "clock", title: "Repeats that remember", text: "Bins every Tuesday, boiler service every October, birthdays forever. Set it once." },
    { icon: "chart", title: "A fair-share view", text: "See who did what this month, gently. Households that use it argue less about chores." },
  ],
  stats: [
    { value: "4,800", label: "households in the beta" },
    { value: "71%", label: "still active after 8 weeks" },
    { value: "3.1 hrs", label: "saved per household, per week" },
    { value: "$2.4M", label: "seed round, closed March" },
  ],
  milestones: [
    { when: "Jun 2025", title: "Kitchen-table prototype", text: "Twelve households, a spreadsheet and a lot of interviews." },
    { when: "Nov 2025", title: "Private beta", text: "First app release; 600 households from a waitlist of 9,000." },
    { when: "Mar 2026", title: "Seed round", text: "Raised from two funds that back consumer software for families." },
    { when: "Now", title: "Public launch prep", text: "Shared budgets, meal plans and a calmer onboarding.", now: true },
  ],
  teamTitle: "Small team, lived experience",
  team: [
    { initials: "MO", name: "Mara Okafor", role: "Co-founder, CEO", bio: "Ran operations at a home-services company. Parent of two; owner of far too many lists." },
    { initials: "TL", name: "Tomas Lindqvist", role: "Co-founder, CTO", bio: "Built sync engines for a note-taking app. Insists the app must work offline in a basement." },
    { initials: "PR", name: "Priya Raman", role: "Head of Design", bio: "Designed tools for carers. Tests every flow with her grandmother and her flatmates." },
  ],
  jobsTitle: "Help us build it",
  jobsLede: "We pay at the top of our stage, share equity with everyone, and keep a four-day week in August.",
  teams: ["All", "Engineering", "Design", "Growth", "Operations"],
  roles: [
    { id: "mobile", title: "Senior Mobile Engineer", team: "Engineering", where: "Remote, UTC-5 to UTC+2", pay: "$150k-$175k + equity", text: "Own the shared-plan experience on phones: offline sync, notifications and widgets.", needs: ["5+ years shipping mobile apps", "Comfortable with sync and conflict handling", "Cares about accessibility"] },
    { id: "backend", title: "Backend Engineer", team: "Engineering", where: "Remote, Europe", pay: "€85k-€100k + equity", text: "Build the calendar, reminders and payments services that every household relies on.", needs: ["Strong with relational databases", "Has run services in production", "Writes clear docs"] },
    { id: "pd", title: "Product Designer", team: "Design", where: "Remote, Americas", pay: "$120k-$140k + equity", text: "Design the fair-share and budgeting features from first sketch to shipped.", needs: ["A portfolio of shipped consumer work", "Runs research sessions with real people", "Can prototype in code or close to it"] },
    { id: "community", title: "Community Lead", team: "Growth", where: "Remote, UK or Ireland", pay: "£55k-£65k + equity", text: "Grow and look after our beta households, and turn what they tell us into product changes.", needs: ["Has built an online community before", "Writes warmly and plainly", "Organised enough to run a household"] },
  ],
  futureTitle: "Nothing for you yet?",
  futureText: "Leave your details and the team you'd join. We'll write when a matching role opens, and never for anything else.",
  footer: { base: "© 2026 Hearthly, Inc.", links: ["Press kit", "Privacy", "Contact"] },
};

type Errors = Partial<Record<"name" | "email" | "team", string>>;

export default function HomeStartup() {
  const d = SAMPLE;
  const [menu, setMenu] = useState(false);
  const [tasks, setTasks] = useState(d.board.items);
  const [filter, setFilter] = useState("All");
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState("");

  const roles = filter === "All" ? d.roles : d.roles.filter((r) => r.team === filter);
  const left = tasks.filter((t) => !t.done).length;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const team = String(f.get("team") ?? "");
    const next: Errors = {};
    if (!name) next.name = "Tell us your name.";
    if (!email) next.email = "Add an email so we can reach you.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "That email is missing an @ or a dot.";
    if (!team) next.team = "Pick the team you'd most like to join.";
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      document.getElementById(`hp-st-${first}`)?.focus();
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("hearthly-talent") ?? "[]") as unknown[];
      localStorage.setItem("hearthly-talent", JSON.stringify([...saved, { name, email, team, at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setSent(name);
  };

  return (
    <div className="fl-hp-page" id="top">
      <header className="fl-nav">
        <nav className="fl-nav__row" aria-label="Main">
          <a className="fl-nav__brand" href="#top">
            {d.brand}
          </a>
          <ul className="fl-nav__links">
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="fl-nav__end">
            <a className="fl-btn fl-btn--primary fl-hp-hide-sm" href="#beta">
              {d.cta}
            </a>
            <button type="button" className="fl-btn fl-btn--secondary fl-nav__menu" aria-expanded={menu} aria-controls="hp-st-menu" aria-label="Menu" onClick={() => setMenu((o) => !o)}>
              <Icon name="menu" />
            </button>
          </div>
        </nav>
        <ul id="hp-st-menu" className="fl-hp-menu" data-open={menu}>
          {[...d.links, { label: d.cta, href: "#beta" }].map((l) => (
            <li key={l.label}>
              <a href={l.href} onClick={() => setMenu(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <main>
        <section className="fl-hp-st-hero fl-bg-mesh" aria-labelledby="hp-st-title">
          <div className="fl-wrap fl-hp-st-hero__grid">
            <div style={{ display: "grid", gap: "var(--space-5)" }}>
              <p className="fl-eyebrow">{d.eyebrow}</p>
              <h1 id="hp-st-title" className="fl-title fl-title--xl">
                {d.title}
              </h1>
              <p className="fl-lede">{d.lede}</p>
              <div className="fl-actions">
                <a className="fl-btn fl-btn--primary" href="#hp-st-product">
                  {d.cta}
                  <Icon name="arrow" />
                </a>
                <a className="fl-btn fl-btn--secondary" href="#hp-st-jobs">
                  {d.secondary} · {d.roles.length} roles
                </a>
              </div>
            </div>
            <div className="fl-hp-board" aria-labelledby="hp-st-board-title" role="group">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "baseline" }}>
                <h2 id="hp-st-board-title" style={{ margin: 0, fontSize: "var(--text-md)", fontFamily: "var(--font-display)" }}>
                  {d.board.title}
                </h2>
              </div>
              <p className="fl-meta" aria-live="polite" style={{ margin: 0 }}>
                {left === 0 ? "All done this week. Nice work, team." : `${left} of ${tasks.length} still to do`}
              </p>
              <ul className="fl-hp-list" style={{ display: "grid", gap: "var(--space-2)" }}>
                {tasks.map((t) => (
                  <li key={t.id} className="fl-hp-board__item" data-done={t.done}>
                    <input
                      id={`hp-st-task-${t.id}`}
                      type="checkbox"
                      checked={t.done}
                      onChange={() => setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                    />
                    <label htmlFor={`hp-st-task-${t.id}`}>
                      <span>{t.label}</span>
                    </label>
                    <span className="fl-hp-board__who" title={`Assigned to ${t.who}`}>
                      {t.who}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="fl-section" id="hp-st-mission" aria-labelledby="hp-st-mission-title">
          <div className="fl-wrap fl-hp-mission">
            <h2 id="hp-st-mission-title" className="fl-eyebrow" style={{ margin: 0, paddingTop: "var(--space-2)" }}>
              {d.missionLabel}
            </h2>
            <div style={{ display: "grid", gap: "var(--space-5)" }}>
              <blockquote>{d.mission}</blockquote>
              <p className="fl-lede">{d.missionText}</p>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="hp-st-product" aria-labelledby="hp-st-product-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <p className="fl-eyebrow">Product</p>
              <h2 id="hp-st-product-title" className="fl-title">
                {d.productTitle}
              </h2>
            </div>
            <ul className="fl-hp-list fl-grid fl-grid--3">
              {d.product.map((p) => (
                <li key={p.title} className="fl-card">
                  <span className="fl-icon">
                    <Icon name={p.icon} />
                  </span>
                  <h3>{p.title}</h3>
                  <p className="fl-text">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section" id="hp-st-progress" aria-labelledby="hp-st-progress-title">
          <div className="fl-wrap" style={{ display: "grid", gap: "var(--space-8)" }}>
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <p className="fl-eyebrow">Progress</p>
              <h2 id="hp-st-progress-title" className="fl-title">
                Where we are, as of April 2026
              </h2>
            </div>
            <dl className="fl-grid fl-grid--4" style={{ margin: 0 }}>
              {d.stats.map((s) => (
                <div key={s.label} className="fl-stat" style={{ borderTop: "1px solid var(--color-border-strong)", paddingTop: "var(--space-4)" }}>
                  <dt className="fl-sr">{s.label}</dt>
                  <dd style={{ margin: 0, display: "grid", gap: "var(--space-1)" }}>
                    <strong>{s.value}</strong>
                    <span aria-hidden="true">{s.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <ol className="fl-hp-list fl-hp-timeline" aria-label="Milestones">
              {d.milestones.map((m) => (
                <li key={m.title} data-now={m.now ? true : undefined}>
                  <time>{m.when}</time>
                  <strong>{m.title}</strong>
                  <p className="fl-text">{m.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="hp-st-team" aria-labelledby="hp-st-team-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <p className="fl-eyebrow">Team</p>
              <h2 id="hp-st-team-title" className="fl-title">
                {d.teamTitle}
              </h2>
            </div>
            <ul className="fl-hp-list fl-grid fl-grid--3">
              {d.team.map((p) => (
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
                  <p className="fl-text">{p.bio}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section" id="hp-st-jobs" aria-labelledby="hp-st-jobs-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <p className="fl-eyebrow">Jobs</p>
              <h2 id="hp-st-jobs-title" className="fl-title">
                {d.jobsTitle}
              </h2>
              <p className="fl-lede">{d.jobsLede}</p>
            </div>
            <div className="fl-hp-chips" role="group" aria-label="Filter roles by team" style={{ marginBottom: "var(--space-5)" }}>
              {d.teams.map((t) => (
                <button key={t} type="button" className="fl-hp-chip" aria-pressed={filter === t} onClick={() => setFilter(t)}>
                  {t}
                </button>
              ))}
            </div>
            <p className="fl-sr" aria-live="polite">
              {roles.length} {roles.length === 1 ? "role" : "roles"} shown
            </p>
            {roles.length === 0 ? (
              <div className="fl-hp-empty">No open roles in {filter} right now. Leave your details below and we'll write when one opens.</div>
            ) : (
              <ul className="fl-hp-list fl-hp-roles">
                {roles.map((r) => {
                  const open = openRole === r.id;
                  return (
                    <li key={r.id} className="fl-hp-role">
                      <h3 style={{ margin: 0 }}>
                        <button type="button" className="fl-hp-role__btn" aria-expanded={open} aria-controls={`hp-st-role-${r.id}`} onClick={() => setOpenRole(open ? null : r.id)}>
                          <strong>{r.title}</strong>
                          <span className="fl-meta">
                            {r.team} · {r.where}
                          </span>
                          <Icon name="arrow" />
                        </button>
                      </h3>
                      {open ? (
                        <div id={`hp-st-role-${r.id}`} className="fl-hp-role__body">
                          <p className="fl-text">{r.text}</p>
                          <ul className="fl-checks">
                            {r.needs.map((n) => (
                              <li key={n}>
                                <Tick />
                                {n}
                              </li>
                            ))}
                          </ul>
                          <div className="fl-actions">
                            <span className="fl-badge">{r.pay}</span>
                            <a className="fl-btn fl-btn--primary" href={`#apply-${r.id}`}>
                              Apply for this role
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="fl-card fl-split fl-split--start" style={{ marginTop: "var(--space-8)" }}>
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <h3 className="fl-title fl-title--md">{d.futureTitle}</h3>
                <p className="fl-text">{d.futureText}</p>
              </div>
              {sent ? (
                <p className="fl-done" role="status">
                  Thanks, {sent}. You're on the list and we'll be in touch when something fits.
                </p>
              ) : (
                <form className="fl-form" onSubmit={submit} noValidate>
                  <div className="fl-field">
                    <label htmlFor="hp-st-name">Name</label>
                    <input id="hp-st-name" name="name" className="fl-input" autoComplete="name" aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? "hp-st-name-err" : undefined} />
                    {errors.name ? (
                      <p id="hp-st-name-err" className="fl-hp-error">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-field">
                    <label htmlFor="hp-st-email">Email</label>
                    <input id="hp-st-email" name="email" type="email" className="fl-input" autoComplete="email" aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? "hp-st-email-err" : undefined} />
                    {errors.email ? (
                      <p id="hp-st-email-err" className="fl-hp-error">
                        {errors.email}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-field">
                    <label htmlFor="hp-st-team">Team you'd join</label>
                    <span className="fl-hp-select">
                      <select id="hp-st-team" name="team" className="fl-input" defaultValue="" aria-invalid={errors.team ? true : undefined} aria-describedby={errors.team ? "hp-st-team-err" : undefined}>
                        <option value="" disabled>
                          Choose a team
                        </option>
                        {d.teams.slice(1).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                    {errors.team ? (
                      <p id="hp-st-team-err" className="fl-hp-error">
                        {errors.team}
                      </p>
                    ) : null}
                  </div>
                  <button type="submit" className="fl-btn fl-btn--secondary">
                    Keep me posted
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--space-4)", alignItems: "center" }}>
          <a className="fl-nav__brand" href="#top">
            {d.brand}
          </a>
          <nav aria-label="Footer">
            <ul style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-5)" }}>
              {d.footer.links.map((l) => (
                <li key={l}>
                  <a href="#top">{l}</a>
                </li>
              ))}
            </ul>
          </nav>
          <span className="fl-meta">{d.footer.base}</span>
        </div>
      </footer>
    </div>
  );
}
