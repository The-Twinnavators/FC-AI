/** @flowcode-library navbar-simple · Simple navigation (Navigation)
 * Catalog ID: p.top-nav.marketing (pattern)
 * Function: A ready-to-place marketing header (p.top-nav.marketing) for a public site.
 * Use it as: A ready-to-place p.top-nav.marketing: copy navbar-simple.tsx and replace SAMPLE (FlowCode brings the pattern file with it).
 * Built from: p.top-nav.marketing
 * Look: A full-width header with a plain wordmark at the left, a few links, then a quiet Sign in and one primary action; the links fold behind a menu button when narrow.
 * Use cases: site header; marketing navigation; landing page header; product site menu; top navigation; mobile menu; saas homepage header
 * Jobs to be done: find my way around the site; get to the page i need; start a free trial from anywhere; open the menu on my phone
 * Keywords: header, navbar, menu, navigation
 */
/**
 * Navigation: simple. This is p.top-nav.marketing (plain wordmark, mark off) with this piece's sample content; the
 * implementation lives in the pattern, in ./top-nav-variants. Brand on the left, page links, sign-in and one main
 * action on the right; on phones the links fold into a menu button. Make it the app's own: replace SAMPLE, point each
 * link at a real screen, keep one primary action.
 */
import { TopNav } from "./top-nav-variants";

// flowcode:sample
const SAMPLE = {
  brand: "Brightside",
  links: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Stories", href: "#stories" },
    { label: "Help", href: "#help" },
  ],
  actions: [{ label: "Sign in", variant: "tertiary" as const, href: "#signin" }, { label: "Start free", href: "#start" }],
};

export default function NavbarSimple() {
  return <TopNav variant="marketing" mark={false} {...SAMPLE} />;
}
