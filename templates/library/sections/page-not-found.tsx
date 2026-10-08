/**
 * Page not found (404): a big number, a short honest message, a search across the app's main pages and links back to
 * them. Use it as the catch-all route. Make it the app's own: replace SAMPLE with the app's real pages and their
 * addresses; the search only looks through that list, so nothing is sent anywhere.
 */
import { useId, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  code: "404",
  title: "We couldn't find that page",
  text: "The link may be old, or the page has moved. Search for it, or start again from one of these.",
  searchLabel: "Search the site",
  searchPlaceholder: "Try “timetable” or “gift card”",
  pages: [
    { label: "Home", href: "#home", text: "What's on at the studio this week", keywords: "start welcome" },
    { label: "Class timetable", href: "#timetable", text: "Book pottery, drawing and print classes", keywords: "classes book schedule times" },
    { label: "Gift cards", href: "#gifts", text: "Give a class or a month of open studio", keywords: "present voucher" },
    { label: "Your bookings", href: "#bookings", text: "Change or cancel a class you booked", keywords: "account cancel reschedule" },
    { label: "Visit us", href: "#visit", text: "Opening hours, address and parking", keywords: "contact hours map directions" },
    { label: "Help", href: "#help", text: "Answers about payments, refunds and kit", keywords: "faq refund questions" },
  ],
  popular: ["Home", "Class timetable", "Your bookings", "Help"],
};

export default function PageNotFound() {
  const d = SAMPLE;
  const id = useId();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<typeof d.pages | null>(null);
  const [searched, setSearched] = useState("");

  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) {
      setError("Type a word to search for.");
      setResults(null);
      return;
    }
    setError("");
    setSearched(query.trim());
    setResults(d.pages.filter((p) => `${p.label} ${p.text} ${p.keywords}`.toLowerCase().includes(q)));
  };

  const popular = d.pages.filter((p) => d.popular.includes(p.label));

  return (
    <section className="fl-section" aria-labelledby={`${id}-title`}>
      <div className="fl-wrap fl-wrap--narrow fl-alr-404">
        <p className="fl-alr-404__code" aria-hidden="true">
          {d.code}
        </p>
        <div className="fl-head fl-head--center" style={{ marginBottom: 0 }}>
          <span className="fl-eyebrow">Error {d.code}</span>
          <h1 id={`${id}-title`} className="fl-title">
            {d.title}
          </h1>
          <p className="fl-lede">{d.text}</p>
        </div>

        <form role="search" className="fl-form" onSubmit={search} noValidate>
          <label htmlFor={`${id}-q`} className="fl-sr">
            {d.searchLabel}
          </label>
          <div className="fl-inline-form">
            <input
              id={`${id}-q`}
              type="search"
              className="fl-input"
              placeholder={d.searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError("");
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
            />
            <button type="submit" className="fl-btn fl-btn--primary">
              Search
            </button>
          </div>
          {error && (
            <p id={`${id}-err`} className="fl-alr-404__error">
              {error}
            </p>
          )}
        </form>

        <div aria-live="polite" style={{ width: "100%", display: "grid", justifyItems: "center", gap: "var(--space-3)" }}>
          {results &&
            (results.length === 0 ? (
              <p className="fl-text">
                Nothing matches “{searched}”. Try a shorter word, or pick a page below.
              </p>
            ) : (
              <>
                <p className="fl-meta" style={{ margin: 0 }}>
                  {results.length} {results.length === 1 ? "page matches" : "pages match"} “{searched}”
                </p>
                <ul className="fl-alr-404__results">
                  {results.map((p) => (
                    <li key={p.href}>
                      <a href={p.href}>
                        <span>
                          <strong>{p.label}</strong>
                          <span className="fl-meta" style={{ display: "block" }}>
                            {p.text}
                          </span>
                        </span>
                        <Icon name="arrow" />
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ))}
        </div>

        <nav aria-label="Main pages" style={{ width: "100%" }}>
          <h2 className="fl-meta" style={{ margin: "0 0 var(--space-3)", fontWeight: "var(--weight-semibold)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
            Popular pages
          </h2>
          <ul className="fl-alr-404__links">
            {popular.map((p) => (
              <li key={p.href}>
                <a href={p.href}>
                  <strong>{p.label}</strong>
                  <span>{p.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
