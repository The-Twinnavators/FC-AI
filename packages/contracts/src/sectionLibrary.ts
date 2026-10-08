/**
 * The section library: ready page sections in templates/library/sections, written in FlowCode's own React and
 * design-token CSS (templates/library/library.css). Each takes on a project's colours, fonts, spacing and corners
 * from its tokens. The Components page browses them; builds copy the ones a screen needs.
 */
export type SectionCategory = "navigation" | "hero" | "features" | "stats" | "pricing" | "testimonials" | "faq" | "cta" | "team" | "contact" | "newsletter" | "blog" | "footer";

export interface LibrarySection {
  /** File stem in templates/library/sections. */
  id: string;
  name: string;
  category: SectionCategory;
  description: string;
  /** Words a request or spec uses when this section fits. */
  tags: string[];
}

export const SECTION_CATEGORIES: Array<{ id: SectionCategory; label: string }> = [
  { id: "navigation", label: "Navigation" },
  { id: "hero", label: "Heroes" },
  { id: "features", label: "Features" },
  { id: "stats", label: "Stats" },
  { id: "pricing", label: "Pricing" },
  { id: "testimonials", label: "Testimonials" },
  { id: "faq", label: "FAQ" },
  { id: "cta", label: "Calls to action" },
  { id: "team", label: "Team" },
  { id: "contact", label: "Contact" },
  { id: "newsletter", label: "Newsletter" },
  { id: "blog", label: "Blog" },
  { id: "footer", label: "Footers" },
];

export const LIBRARY_SECTIONS: LibrarySection[] = [
  { id: "navbar-simple", name: "Simple navigation", category: "navigation", description: "Brand, page links and one main action; links fold into a menu on phones.", tags: ["header", "navbar", "menu", "navigation"] },
  { id: "navbar-centered", name: "Centered navigation", category: "navigation", description: "Links in the middle: a calmer header for content sites and studios.", tags: ["header", "navbar", "portfolio", "studio"] },
  { id: "hero-split", name: "Split hero", category: "hero", description: "Promise and actions beside a picture of the product.", tags: ["hero", "landing", "header", "product"] },
  { id: "hero-centered", name: "Centered hero", category: "hero", description: "One bold promise in the middle with a wide picture underneath.", tags: ["hero", "landing", "launch", "app"] },
  { id: "hero-stats", name: "Hero with proof", category: "hero", description: "Promise and actions with three numbers that back it up.", tags: ["hero", "landing", "results", "stats"] },
  { id: "features-grid", name: "Feature grid", category: "features", description: "Six benefits as cards, each with an icon, title and one sentence.", tags: ["features", "benefits", "services", "grid"] },
  { id: "features-alternating", name: "Alternating features", category: "features", description: "Each feature with a picture and a short story, alternating sides.", tags: ["features", "how it works", "steps", "showcase"] },
  { id: "features-checklist", name: "Feature checklist", category: "features", description: "A heading beside a two-column list of what's included.", tags: ["features", "included", "checklist", "plan"] },
  { id: "stats-band", name: "Stats band", category: "stats", description: "Four numbers on the accent colour, a strong break between sections.", tags: ["stats", "numbers", "results", "metrics"] },
  { id: "pricing-tiers", name: "Three pricing tiers", category: "pricing", description: "Three plans with the usual choice highlighted.", tags: ["pricing", "plans", "subscription", "tiers"] },
  { id: "pricing-toggle", name: "Monthly or yearly pricing", category: "pricing", description: "Two plans with a switch that shows the yearly saving.", tags: ["pricing", "plans", "yearly", "monthly", "subscription"] },
  { id: "testimonials-cards", name: "Testimonial cards", category: "testimonials", description: "Three short quotes with who said them.", tags: ["testimonials", "reviews", "quotes", "social proof"] },
  { id: "testimonial-feature", name: "Featured quote", category: "testimonials", description: "One strong quote, centered, with who said it.", tags: ["testimonial", "quote", "review"] },
  { id: "faq-accordion", name: "FAQ accordion", category: "faq", description: "Questions that open in place; works with the keyboard and without script.", tags: ["faq", "questions", "help", "accordion"] },
  { id: "faq-columns", name: "FAQ columns", category: "faq", description: "Every short answer visible at once, with a way to reach a person.", tags: ["faq", "questions", "help"] },
  { id: "cta-banner", name: "Call-to-action banner", category: "cta", description: "A closing invitation on the accent colour with one main action.", tags: ["cta", "call to action", "sign up", "closing"] },
  { id: "cta-split", name: "Call-to-action card", category: "cta", description: "An invitation in a card with a picture beside it.", tags: ["cta", "call to action", "import", "trial"] },
  { id: "team-grid", name: "Team grid", category: "team", description: "The people behind the product, with a role and one line each.", tags: ["team", "about", "people", "staff"] },
  { id: "contact-split", name: "Contact details and form", category: "contact", description: "Ways to reach you beside a short form that confirms and keeps the message.", tags: ["contact", "form", "email", "support", "address"] },
  { id: "newsletter-inline", name: "Newsletter sign-up", category: "newsletter", description: "One email field and a button, with a confirmation.", tags: ["newsletter", "subscribe", "email", "updates"] },
  { id: "blog-cards", name: "Latest posts", category: "blog", description: "Three post cards with a picture, topic, title, summary and date.", tags: ["blog", "posts", "articles", "journal", "news"] },
  { id: "footer-columns", name: "Footer with columns", category: "footer", description: "Brand and a line about it, three columns of links and the small print.", tags: ["footer", "links", "site map"] },
  { id: "footer-simple", name: "Simple footer", category: "footer", description: "One row: brand, a few links and the small print.", tags: ["footer", "app"] },
];

/** The sections whose tags appear in some text (a request or a screen's spec), best matches first. */
export function sectionsFor(text: string, max = 6): LibrarySection[] {
  const t = text.toLowerCase();
  return LIBRARY_SECTIONS.map((s) => ({ s, n: s.tags.filter((tag) => t.includes(tag)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((x) => x.s);
}
