/** @flowcode-library navbar-centered · Centered navigation (Navigation)
 * Catalog ID: p.top-nav.centered (pattern)
 * Function: A ready-to-place editorial or portfolio header (p.top-nav.centered).
 * Use it as: A ready-to-place p.top-nav.centered: copy navbar-centered.tsx and replace SAMPLE (FlowCode brings the pattern file with it).
 * Built from: p.top-nav.centered
 * Look: A calm header with the brand at the left, the links centered and one secondary action at the right.
 * Use cases: portfolio header; studio website header; blog header; editorial navigation; agency site menu; restaurant site header; content site navigation
 * Jobs to be done: browse the main sections of the site; find the work or articles i want; get in touch with the studio; move between pages easily
 * Keywords: header, navbar, portfolio, studio
 */
/**
 * Navigation: centered. This is p.top-nav.centered with this piece's sample content; the implementation lives in the
 * pattern, in ./top-nav-variants. Links in the middle, brand left, action right: a calmer, more editorial header for
 * content sites, portfolios and studios. Make it the app's own: replace SAMPLE and point links at real screens.
 */
import { TopNav } from "./top-nav-variants";

// flowcode:sample
const SAMPLE = {
  brand: "Atelier North",
  links: [
    { label: "Work", href: "#work" },
    { label: "Studio", href: "#studio" },
    { label: "Journal", href: "#journal" },
  ],
  actions: [{ label: "Get in touch", variant: "secondary" as const, href: "#contact" }],
};

export default function NavbarCentered() {
  return <TopNav variant="centered" mark={false} {...SAMPLE} />;
}
