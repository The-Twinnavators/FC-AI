/**
 * The section library: ready page sections in templates/library/sections, written in FlowCode's own React and
 * design-token CSS (templates/library/library.css). Each takes on a project's colours, fonts, spacing and corners
 * from its tokens. The Components page browses them; builds copy the ones a screen needs.
 */
export type SectionCategory = "navigation" | "hero" | "features" | "stats" | "pricing" | "testimonials" | "faq" | "cta" | "team" | "contact" | "newsletter" | "blog" | "footer" | "forms" | "tables" | "cards" | "dialogs" | "alerts" | "backgrounds" | "data" | "sidenav" | "auth" | "wayfinding" | "homepages" | "landings" | "sites";

export interface LibrarySection {
  /** File stem in templates/library/sections. */
  id: string;
  name: string;
  category: SectionCategory;
  description: string;
  /** Words a request or spec uses when this section fits. */
  tags: string[];
}

/** "template": whole pages, built from the library's own pieces. "page": marketing and website sections. "app": the
 * pieces an app's own screens are made of. */
export type SectionGroup = "template" | "page" | "app";

export const SECTION_CATEGORIES: Array<{ id: SectionCategory; label: string; group: SectionGroup }> = [
  { id: "homepages", label: "Homepages", group: "template" },
  { id: "landings", label: "Landing pages", group: "template" },
  { id: "sites", label: "Industry sites", group: "template" },
  { id: "navigation", label: "Navigation", group: "page" },
  { id: "hero", label: "Heroes", group: "page" },
  { id: "features", label: "Features", group: "page" },
  { id: "stats", label: "Stats", group: "page" },
  { id: "pricing", label: "Pricing", group: "page" },
  { id: "testimonials", label: "Testimonials", group: "page" },
  { id: "faq", label: "FAQ", group: "page" },
  { id: "cta", label: "Calls to action", group: "page" },
  { id: "team", label: "Team", group: "page" },
  { id: "contact", label: "Contact", group: "page" },
  { id: "newsletter", label: "Newsletter", group: "page" },
  { id: "blog", label: "Blog", group: "page" },
  { id: "footer", label: "Footers", group: "page" },
  { id: "backgrounds", label: "Page backgrounds", group: "page" },
  { id: "sidenav", label: "Side navigation", group: "app" },
  { id: "auth", label: "Sign-in and sign-up", group: "app" },
  { id: "wayfinding", label: "Tabs, breadcrumbs and paging", group: "app" },
  { id: "forms", label: "Forms", group: "app" },
  { id: "tables", label: "Tables and lists", group: "app" },
  { id: "cards", label: "Cards", group: "app" },
  { id: "dialogs", label: "Dialogs and drawers", group: "app" },
  { id: "alerts", label: "Alerts and states", group: "app" },
  { id: "data", label: "Charts and data", group: "app" },
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
  { id: "alert-inline", name: "Inline alerts", category: "alerts", description: "Inline messages in info, success, warning and error tones, each with an icon, title, text and an optional action; dismissible ones close and can be brought back.", tags: ["alert","message","notice","status","feedback","dismissible"] },
  { id: "banner-top", name: "Top announcement banner", category: "alerts", description: "Full-width announcement bar at the top of a page with a link and a dismiss button that remembers the dismissal.", tags: ["banner","announcement","notice","dismissible"] },
  { id: "toast-stack", name: "Toast notifications", category: "alerts", description: "Toasts that stack bottom-right, auto-dismiss with a pause on hover or focus, close by hand or Escape, are announced to screen readers, and offer Undo.", tags: ["toast","snackbar","notification","undo"] },
  { id: "empty-state", name: "Empty list state", category: "alerts", description: "An empty list with a small token-coloured drawing, helpful text and a primary action that adds the first item.", tags: ["empty state","list","onboarding","zero data"] },
  { id: "page-not-found", name: "404 page", category: "alerts", description: "Page-not-found screen with a big 404, a short message, a search over the main pages and links back.", tags: ["404","not found","error page"] },
  { id: "card-product-grid", name: "Product card grid", category: "cards", description: "Shop product cards with a picture, name, price and rating, and an add-to-basket button that switches to Added and updates a basket count.", tags: ["shop","product","ecommerce","basket","cart","grid"] },
  { id: "card-kpi", name: "KPI cards", category: "cards", description: "Dashboard number cards with the change on the last period (green or red by whether up is good) and a small trend line, with a week or month switch.", tags: ["dashboard","kpi","metrics","analytics","overview"] },
  { id: "card-profile", name: "Profile card", category: "cards", description: "A person card with initials, role, short bio and three numbers, a Follow toggle and a Message button that opens a short note form.", tags: ["profile","person","contact","follow","avatar"] },
  { id: "card-media-list", name: "Media list cards", category: "cards", description: "Wide cards with a picture on the left, title, summary, details and tags, a heart to save each one, and a switch to show only saved items.", tags: ["list","media","listing","favourites","saved"] },
  { id: "table-sortable", name: "Sortable table", category: "tables", description: "A clean data table with a caption, click-to-sort column headers, tabular numbers and a total row.", tags: ["table","sort","data","numbers"] },
  { id: "table-actions", name: "Table with row actions", category: "tables", description: "A searchable, paginated table with status badges and a per-row menu to edit, duplicate or delete (with a confirmation).", tags: ["table","search","pagination","admin","status"] },
  { id: "table-selectable", name: "Selectable table", category: "tables", description: "A table with row checkboxes, select-all with a mixed state, and a bulk-action bar to mark done or delete, with undo.", tags: ["table","checkbox","select","bulk actions","undo"] },
  { id: "list-stacked", name: "Stacked list", category: "tables", description: "A phone-friendly stacked list with initials, title, meta line, status and chevron, plus search, status filters and expandable rows.", tags: ["list","mobile","search","filter"] },
  { id: "dialog-confirm", name: "Confirm dialog", category: "dialogs", description: "A destructive confirmation (Delete this booking?) with Cancel focused first and a danger-coloured confirm, then a result message with Undo.", tags: ["dialog","modal","confirm","delete","undo"] },
  { id: "dialog-form", name: "Form dialog", category: "dialogs", description: "A New booking dialog with checked fields that, on save, adds the booking to a list on the page.", tags: ["dialog","modal","form","validation"] },
  { id: "drawer-side", name: "Side drawer", category: "dialogs", description: "Choosing a list item slides in a drawer from the right with its details and edits.", tags: ["drawer","side panel","details","edit"] },
  { id: "sheet-bottom", name: "Bottom sheet", category: "dialogs", description: "A phone-style More menu that opens a bottom sheet with Share, Duplicate and Archive.", tags: ["bottom sheet","action sheet","mobile","more menu"] },
  { id: "form-account", name: "Create account form", category: "forms", description: "Stacked sign-up form with name, email, a password with show and hide and a strength hint, and a terms checkbox, checked as you go, ending in a confirmation.", tags: ["form","sign up","account","validation","password","registration"] },
  { id: "form-settings", name: "Settings form", category: "forms", description: "Two-column settings with profile fields, notification switches and a danger zone whose delete needs typed confirmation, plus a save bar that shows unsaved changes.", tags: ["form","settings","profile","switch","danger zone"] },
  { id: "form-wizard", name: "Multi-step form", category: "forms", description: "Three steps (details, preferences, review) with a step indicator, back and next, checks per step, a review with edit links and a final confirmation.", tags: ["form","wizard","steps","multi-step","review"] },
  { id: "form-filters", name: "Search and filter bar", category: "forms", description: "Search, selects and quick filters that narrow a list, with removable chips, Clear all, a live result count and a no-results state.", tags: ["form","search","filter","chips"] },
  { id: "bg-soft", name: "Soft gradient", category: "backgrounds", description: "A gentle wash of the accent colour at the top, fading into the page.", tags: ["background","gradient","page background","soft"] },
  { id: "bg-mesh", name: "Mesh gradient", category: "backgrounds", description: "Soft colour blooms in the corners from the accent, success and focus colours.", tags: ["background","gradient","page background","mesh"] },
  { id: "bg-glow", name: "Top glow", category: "backgrounds", description: "A spotlight of the accent colour from the top edge.", tags: ["background","gradient","page background","glow"] },
  { id: "bg-aurora", name: "Aurora", category: "backgrounds", description: "A slowly turning, blurred blend of the theme colours (still for people who ask for less motion).", tags: ["background","gradient","page background","aurora"] },
  { id: "bg-split", name: "Diagonal split", category: "backgrounds", description: "Two tones divided on a diagonal.", tags: ["background","gradient","page background","split"] },
  { id: "bg-ink", name: "Ink band", category: "backgrounds", description: "The accent colour as a solid band with a soft highlight; text switches to the on-accent colour.", tags: ["background","gradient","page background","ink"] },
  { id: "bg-dots", name: "Dot grid", category: "backgrounds", description: "A fine grid of dots in the text colour.", tags: ["background","pattern","page background","dots"] },
  { id: "bg-grid", name: "Fading grid", category: "backgrounds", description: "Faint grid lines that fade out towards the edges.", tags: ["background","pattern","page background","grid"] },
  { id: "bg-stripes", name: "Diagonal stripes", category: "backgrounds", description: "Thin diagonal stripes in the accent colour.", tags: ["background","pattern","page background","stripes"] },
  { id: "bg-waves", name: "Waves", category: "backgrounds", description: "Repeating wave lines in the accent colour.", tags: ["background","pattern","page background","waves"] },
  { id: "bg-topo", name: "Contour lines", category: "backgrounds", description: "Topographic contour lines in the text colour.", tags: ["background","pattern","page background","topo"] },
  { id: "bg-grain", name: "Film grain", category: "backgrounds", description: "A subtle paper-like grain over the page colour.", tags: ["background","pattern","page background","grain"] },
  { id: "status-badges", name: "Status badges", category: "alerts", description: "Status chips with a coloured dot (done, in progress, waiting, failed, draft) and signal lights that pulse while working, on a list whose status moves on.", tags: ["status","badge","chip","signal light","indicator"] },
  { id: "skeleton-loading", name: "Skeleton loading", category: "alerts", description: "Shimmering placeholders shaped like a card list that swap to the real content after a short delay.", tags: ["skeleton","loading","placeholder","shimmer"] },
  { id: "tabs-underline", name: "Underline tabs", category: "navigation", description: "Accessible tabs with an underline that slides to the active tab, optional counts, and arrow, Home and End keys.", tags: ["tabs","underline","navigation","counts"] },
  { id: "segmented-control", name: "Segmented control", category: "forms", description: "A segmented choice of three options with a description that changes with the choice, remembered on the device.", tags: ["segmented","radio group","toggle","settings"] },
  { id: "data-animated-number", name: "Animated numbers", category: "data", description: "Three headline figures that count up when they come into view, with a refresh that loads the next period.", tags: ["stats","count up","kpi","dashboard"] },
  { id: "chart-radial-gauge", name: "Radial gauges", category: "data", description: "Radial gauges in three sizes that fill with an accent-to-success gradient and animate when values change.", tags: ["gauge","progress","ring","percentage","chart"] },
  { id: "chart-area", name: "Area chart", category: "data", description: "Two series as smooth areas that draw in, with a legend, a 4 or 12 week switch, a crosshair tooltip and a data table for screen readers.", tags: ["chart","area","trend","time series","report"] },
  { id: "data-diff", name: "Before and after diff", category: "data", description: "A line-by-line comparison with added and removed lines tinted and a unified or side-by-side view.", tags: ["diff","compare","changes","versions"] },
  { id: "card-project", name: "Project cards", category: "cards", description: "Project cards with a picture banner, a status chip, two small radial gauges, the last update, a View button and a menu to rename or delete.", tags: ["projects","dashboard","gauge","progress","status"] },
  { id: "card-approval", name: "Approval queue", category: "cards", description: "Requests waiting for a decision, each with what is asked, why, a risk badge, details and a scope choice, with Approve, Deny and a timed Undo.", tags: ["approval","review","refund","decision","queue"] },
  { id: "hero-gradient", name: "Gradient hero", category: "hero", description: "A dark hero panel with an announcement pill, a light display heading with one phrase in a gradient, and two actions.", tags: ["hero","dark","gradient","announcement","landing"] },
  { id: "sidebar-app", name: "App sidebar", category: "sidenav", description: "Classic app frame: a sidebar with the product mark, page search, grouped pages with icons and a count badge, a New booking button and the signed-in person's menu. It collapses to icons with tooltips, remembers that choice, and becomes a top bar with a drawer on phones.", tags: ["sidebar","navigation","app shell","dashboard","collapsible","search","account menu","drawer","responsive"] },
  { id: "sidebar-rail", name: "Icon rail and panel", category: "sidenav", description: "A slim rail of section icons with tooltips next to a wider panel that lists the chosen section's pages, like an email or chat app. Choosing a page opens it in the main area, and on phones both become a drawer.", tags: ["sidebar","navigation","icon rail","secondary panel","inbox","app shell","tooltips","drawer","responsive"] },
  { id: "sidebar-nested", name: "Nested sidebar with pins", category: "sidenav", description: "A two-level sidebar tree (Projects, then each project, then its pages) with expandable groups and turning chevrons, plus a Pinned list at the top where pages can be pinned and unpinned. Open groups and pins are both remembered, and on phones it becomes a drawer.", tags: ["sidebar","navigation","tree","nested","expandable","pinned","favorites","app shell","drawer","responsive"] },
  { id: "auth-sign-in", name: "Sign in", category: "auth", description: "Email and password sign-in with show/hide password, remember me, a forgot-password link, inline errors, a signing-in state and plain-text continue-with options.", tags: ["auth","sign in","login","form","password"] },
  { id: "auth-sign-up", name: "Sign up", category: "auth", description: "Create-account form with name, email, a password strength meter and live rules checklist, a terms checkbox and a check-your-email success state.", tags: ["auth","sign up","register","form","password strength"] },
  { id: "auth-split", name: "Sign in, split", category: "auth", description: "Sign-in form beside an accent-gradient picture panel with a member quote that becomes a banner above the form on phones.", tags: ["auth","sign in","login","split","quote"] },
  { id: "auth-forgot-password", name: "Forgot password", category: "auth", description: "Ask for an email to send a reset link, then a check-your-email screen with next steps and a resend button behind a cooldown timer.", tags: ["auth","password reset","forgot password","email","cooldown"] },
  { id: "auth-verify-code", name: "Verify code", category: "auth", description: "Six-digit one-time code boxes that auto-advance, fill from a paste and step back on Backspace, with wrong-code errors, an attempt limit and resend.", tags: ["auth","otp","verification","two-step","code input"] },
  { id: "page-server-error", name: "Server error (500)", category: "alerts", description: "A 500 page with a server illustration, a retry button with a progress state, a copyable reference code and a support link.", tags: ["error","500","server error","retry","page"] },
  { id: "page-maintenance", name: "Planned maintenance", category: "alerts", description: "Planned maintenance page with start time, expected return time and countdown, a filterable service status list and a notify-me form.", tags: ["maintenance","downtime","status","page","notify"] },
  { id: "page-offline", name: "Offline", category: "alerts", description: "You're-offline page that lists what still works and what waits, shows changes saved on the device, and retries or detects when the connection returns.", tags: ["offline","connection","retry","error","page"] },
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
