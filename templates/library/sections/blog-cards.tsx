/** @flowcode-library blog-cards · Latest posts (Blog)
 * Catalog ID: b.blog-cards (block)
 * Function: The latest posts block (b.blog-cards): post cards with a picture, topic, title, summary and date.
 * Use it as: import { BlogCards } from "./blog-cards"; <BlogCards title all={{label,href}} posts={[{topic,title,summary,date,minutes,media,href?}]} />
 * Look: A heading with an all-posts link above three bordered cards, each with a wide picture, an eyebrow topic, a linked title, a summary and a date line.
 * Tokens: --space-3 --space-5 --color-surface --color-border --color-accent --color-text-muted --radius-lg
 * Use cases: blog; latest posts; news; articles; journal; resources; case studies; press releases; recipes
 * Jobs to be done: read the latest articles; find posts on a topic i care about; keep up with company news; learn from guides and stories
 * Keywords: blog, posts, articles, journal, news
 */
/**
 * Blog: latest posts. Three cards with a picture, topic, title, summary and date. Make it the app's own: replace
 * SAMPLE with real posts (or the spec's topics); link each card to its post screen.
 */

export type BlogCardsProps = {
  title: string;
  /** The link to the full list of posts. */
  all: { label: string; href: string };
  /** Each post: topic, title, summary, date text, minutes to read, a description of its picture (placeholder and alt text), and the post's link ("#post" when left out). */
  posts: { topic: string; title: string; summary: string; date: string; minutes: number; media: string; href?: string }[];
};

export function BlogCards({ title, all, posts }: BlogCardsProps) {
  return (
    <section className="fl-section" aria-labelledby="blog-cards-title" data-fl="b.blog-cards">
      <div className="fl-wrap">
        <div className="fl-head" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "end", maxWidth: "none", gap: "var(--space-4)" }}>
          <h2 id="blog-cards-title" className="fl-title">
            {title}
          </h2>
          <a className="fl-link" href={all.href}>
            {all.label}
          </a>
        </div>
        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {posts.map((p) => (
            <li key={p.title}>
              <article className="fl-card" style={{ padding: 0, overflow: "hidden", height: "100%" }}>
                <div className="fl-media fl-media--wide" role="img" aria-label={p.media} style={{ borderRadius: 0, border: 0 }}>
                  {p.media}
                </div>
                <div style={{ display: "grid", gap: "var(--space-3)", padding: "var(--space-5)" }}>
                  <span className="fl-eyebrow">{p.topic}</span>
                  <h3>
                    <a className="fl-link" href={p.href ?? "#post"} style={{ color: "inherit" }}>
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

// flowcode:sample
const SAMPLE: BlogCardsProps = {
  title: "From the journal",
  all: { label: "All posts", href: "#journal" },
  posts: [
    { topic: "Guides", title: "Five ways to cut no-shows this month", summary: "Small changes that add up, from reminders to deposits.", date: "Oct 2", minutes: 4, media: "A calendar with reminders turned on" },
    { topic: "Stories", title: "How a two-chair barber doubled bookings", summary: "What changed when clients could book themselves.", date: "Sep 24", minutes: 6, media: "A barber shop on a busy Saturday" },
    { topic: "Product", title: "New: waiting lists", summary: "When a slot opens up, the next person is told straight away.", date: "Sep 12", minutes: 2, media: "The waiting list on a phone" },
  ],
};

export default function BlogCardsPreview() {
  return <BlogCards {...SAMPLE} />;
}
