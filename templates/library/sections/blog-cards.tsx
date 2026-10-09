/** @flowcode-library blog-cards · Latest posts (Blog)
 * Use cases: blog; latest posts; news; articles; journal; resources; case studies; press releases; recipes
 * Jobs to be done: read the latest articles; find posts on a topic i care about; keep up with company news; learn from guides and stories
 * Keywords: blog, posts, articles, journal, news
 */
/**
 * Blog: latest posts. Three cards with a picture, topic, title, summary and date. Make it the app's own: replace
 * SAMPLE with real posts (or the spec's topics); link each card to its post screen.
 */
// flowcode:sample
const SAMPLE = {
  title: "From the journal",
  all: { label: "All posts", href: "#journal" },
  posts: [
    { topic: "Guides", title: "Five ways to cut no-shows this month", summary: "Small changes that add up, from reminders to deposits.", date: "Oct 2", minutes: 4, media: "A calendar with reminders turned on" },
    { topic: "Stories", title: "How a two-chair barber doubled bookings", summary: "What changed when clients could book themselves.", date: "Sep 24", minutes: 6, media: "A barber shop on a busy Saturday" },
    { topic: "Product", title: "New: waiting lists", summary: "When a slot opens up, the next person is told straight away.", date: "Sep 12", minutes: 2, media: "The waiting list on a phone" },
  ],
};

export default function BlogCards() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="blog-cards-title">
      <div className="fl-wrap">
        <div className="fl-head" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "end", maxWidth: "none", gap: "var(--space-4)" }}>
          <h2 id="blog-cards-title" className="fl-title">
            {d.title}
          </h2>
          <a className="fl-link" href={d.all.href}>
            {d.all.label}
          </a>
        </div>
        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {d.posts.map((p) => (
            <li key={p.title}>
              <article className="fl-card" style={{ padding: 0, overflow: "hidden", height: "100%" }}>
                <div className="fl-media fl-media--wide" role="img" aria-label={p.media} style={{ borderRadius: 0, border: 0 }}>
                  {p.media}
                </div>
                <div style={{ display: "grid", gap: "var(--space-3)", padding: "var(--space-5)" }}>
                  <span className="fl-eyebrow">{p.topic}</span>
                  <h3>
                    <a className="fl-link" href="#post" style={{ color: "inherit" }}>
                      {p.title}
                    </a>
                  </h3>
                  <p className="fl-text">{p.summary}</p>
                  <p className="fl-meta">
                    {p.date} · {p.minutes} min read
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
