/**
 * How catalog pieces fit together, as data the planner and the checks can use rather than advice in a prompt: where a
 * piece may appear (an app screen, a marketing page, or both), what it provides a page (search, results, a form...),
 * what it needs to work (records with fields to compare, a place to go to), and when to avoid it. With these, a page
 * plan that puts a marketing hero on an app's list screen, or a list screen with nothing that shows the list, is
 * caught at planning, before any code.
 *
 * Contexts come from the piece's category unless a piece says otherwise; capabilities are listed per catalog ID. A
 * variant or version answers to its component's entry (c.tabs@folder → c.tabs).
 */
import { LIBRARY_SECTIONS, PROPOSED_SECTIONS, refsOf, type LibrarySection, type SectionCategory } from "./sectionLibrary.js";

export type PieceContext = "app" | "marketing";

/** What a part gives a page. The page types (daemon pageTypes.ts) ask for these. */
export type Capability =
  | "results"
  | "search"
  | "filter"
  | "sort"
  | "detail"
  | "edit"
  | "form"
  | "steps"
  | "settings"
  | "metrics"
  | "chart"
  | "review"
  | "compare"
  | "history"
  | "booking"
  | "date entry"
  | "time entry"
  | "upload"
  | "conversation"
  | "media"
  | "navigation"
  | "primary action"
  | "empty state"
  | "loading state"
  | "error state"
  | "sign-in"
  | "persuade";

export interface PieceRelations {
  contexts: PieceContext[];
  provides: Capability[];
  /** What it needs from the app's data or routes to make sense. */
  requires: string[];
  /** When not to use it, in a sentence each. */
  avoidWhen: string[];
}

/** Marketing-page sections and whole website pages; everything else may sit on an app screen. */
const MARKETING: ReadonlySet<SectionCategory> = new Set(["hero", "features", "stats", "pricing", "testimonials", "faq", "cta", "team", "contact", "newsletter", "blog", "footer", "homepages", "landings", "sites"]);
const APP_ONLY: ReadonlySet<SectionCategory> = new Set(["apptemplates", "tables", "auth"]);

type Rel = Partial<Omit<PieceRelations, "contexts">> & { contexts?: PieceContext[] };

/** Capabilities, needs and cautions per catalog ID (variants and versions use their component's). */
const RELATIONS: Record<string, Rel> = {
  // Lists and tables
  "p.filterable-list": { provides: ["results", "search", "filter", "detail"], requires: ["a list of records with a name and a few fields"], avoidWhen: ["there are only one to three items: show them as cards"] },
  "p.filter-panel": { provides: ["search", "filter"], requires: ["a list of results it narrows"], avoidWhen: ["nothing on the page is a list to narrow"] },
  "p.resource-table": { provides: ["results", "sort", "edit"], requires: ["records with at least two fields to compare", "a detail page or row actions"], avoidWhen: ["fewer than four records", "long narrative content", "phone-first screens without a card fallback"] },
  "p.data-table": { provides: ["results", "sort", "filter"], requires: ["records with at least two fields to compare"], avoidWhen: ["fewer than four records", "long narrative content"] },
  "p.product-grid": { provides: ["results", "filter"], requires: ["items with a picture, a name and a price or status"] },
  "p.media-list": { provides: ["results"], requires: ["items with a picture or icon and a title"] },
  "p.project-card": { provides: ["results"], requires: ["projects or items with a status"] },
  "c.list-row": { provides: ["results"] },
  "c.pagination": { provides: ["navigation"], requires: ["a list longer than one page"], avoidWhen: ["a short list that fits on one screen"] },
  "c.search": { provides: ["search"], requires: ["something to search"] },
  "p.command-palette": { provides: ["search", "navigation"], avoidWhen: ["a first-time visitor's only way to get around"] },
  // One record
  "p.editable-details": { provides: ["detail", "edit"], requires: ["one record's fields"] },
  "p.profile-card": { provides: ["detail"], requires: ["a person or organization"] },
  "p.activity-timeline": { provides: ["history"], requires: ["dated events about one thing"] },
  "p.upcoming-schedule": { provides: ["results"], requires: ["dated appointments or events with a status"], avoidWhen: ["the person needs to pick a day or time: use the booking calendar"] },
  "p.comment-box": { provides: ["conversation", "form"] },
  "c.chat-bubble": { provides: ["conversation"], requires: ["messages between people or with an assistant"] },
  // Forms and entry
  "p.account-form": { provides: ["form", "sign-in"] },
  "p.auth-form": { provides: ["sign-in", "form"], avoidWhen: ["the person is already signed in"] },
  "p.settings-form": { provides: ["settings", "form"], requires: ["settings the person can change"] },
  "p.form-wizard": { provides: ["form", "steps"], requires: ["a task long enough to split into steps"], avoidWhen: ["a form of five fields or fewer"] },
  "p.stepper": { provides: ["steps", "navigation"] },
  "c.text-field": { provides: ["form"] },
  "c.select": { provides: ["form"] },
  "c.checkbox": { provides: ["form"] },
  "c.switch": { provides: ["settings", "form"] },
  "c.segmented": { provides: ["filter", "form"] },
  "c.slider": { provides: ["form", "filter"] },
  "c.chip": { provides: ["filter"] },
  "c.quantity": { provides: ["form"] },
  "p.file-upload": { provides: ["upload", "form"] },
  "c.date-picker": { provides: ["date entry", "form"] },
  "c.time-picker": { provides: ["time entry", "form"] },
  "p.booking-calendar": { provides: ["booking", "date entry", "time entry"], requires: ["the times free on each day"] },
  "p.poll": { provides: ["form"] },
  // Numbers and comparison
  "c.kpi": { provides: ["metrics"], requires: ["a few numbers that matter, with a change or a target"] },
  "c.gauge": { provides: ["metrics"], requires: ["a value against a known maximum"] },
  "c.area-chart": { provides: ["chart", "metrics"], requires: ["a value over time"] },
  "c.animated-number": { provides: ["metrics"] },
  "p.stock-watchlist": { provides: ["metrics", "chart", "results", "sort"], requires: ["symbols or items with a price over time"] },
  "p.stats-compare": { provides: ["metrics", "compare"] },
  "p.plan-comparison": { provides: ["compare"], requires: ["two to four options with the same features"] },
  "p.diff": { provides: ["review", "compare"], requires: ["a before and an after"] },
  "p.approval-card": { provides: ["review"], requires: ["requests waiting for a decision"] },
  // Media and navigation
  "c.carousel": { provides: ["media", "results"], avoidWhen: ["the items are the page's main list: show them all instead"] },
  "c.slideshow": { provides: ["media"], requires: ["pictures"], avoidWhen: ["text the person must read: a moving slide hides it"] },
  "c.media-frame": { provides: ["media"] },
  "p.top-nav": { provides: ["navigation"] },
  // Look-up apps (find it and where to get it): their landing page is the app's own front door, so its search, ZIP code
  // prompt, category tiles and featured entries are the working pieces, on marketing pages as on app screens (Clean
  // Cart's plan was told to rebuild them by hand).
  "p.lookup-catalog": { provides: ["results", "search", "filter", "sort", "empty state", "loading state"], contexts: ["app", "marketing"] },
  "p.lookup-entry": { provides: ["detail", "review"], contexts: ["app"] },
  "p.place-finder": { provides: ["search", "results"], contexts: ["app", "marketing"] },
  "p.list-builder": { provides: ["edit", "form"], contexts: ["app"] },
  "p.lookup-frame": { provides: ["navigation"], contexts: ["app", "marketing"] },
  "p.side-nav": { provides: ["navigation"], contexts: ["app"] },
  "c.tabs": { provides: ["navigation"] },
  "c.breadcrumbs": { provides: ["navigation"], requires: ["pages nested more than one level deep"] },
  "c.bottom-nav": { provides: ["navigation"], contexts: ["app"], avoidWhen: ["a desktop tool with more than five main places"] },
  "c.fab": { provides: ["primary action"], contexts: ["app"], avoidWhen: ["a screen with no single main action", "desktop layouts with a visible primary button"] },
  "c.button": { provides: ["primary action"] },
  // States
  "c.empty-state": { provides: ["empty state"] },
  "c.skeleton": { provides: ["loading state"] },
  "c.progress": { provides: ["loading state"] },
  "c.alert": { provides: ["error state"] },
  "b.page-state": { provides: ["error state"] },
  // Marketing
  "b.hero-split": { provides: ["persuade", "primary action"] },
  "b.hero-centered": { provides: ["persuade", "primary action"] },
  "b.hero-stats": { provides: ["persuade", "metrics"] },
  "b.hero-gradient": { provides: ["persuade", "primary action"] },
  "b.pricing-tiers": { provides: ["persuade", "compare"] },
  "b.pricing-toggle": { provides: ["persuade", "compare"] },
  "b.cookie-consent": { contexts: ["app", "marketing"] },
  "b.announcement-bar": { contexts: ["app", "marketing"] },
  // On the approval shelf (agents' batch, 2026-10-21)
  "c.multi-select": { provides: ["form", "filter"], requires: ["a list of options to choose from"] },
  "c.phone-field": { provides: ["form"] },
  "c.card-fields": { provides: ["form", "primary action"], requires: ["a payment provider to hand the card to"], avoidWhen: ["The app uses the payment provider's own hosted card fields or checkout page."] },
  "c.language-switcher": { contexts: ["app", "marketing"], provides: ["navigation", "settings"], requires: ["the app translated into more than one language"] },
  "p.members-table": { provides: ["results", "search", "filter", "edit", "settings", "empty state"], requires: ["the people on a workspace and the roles they can have"] },
  "p.wide-table": { provides: ["results", "sort", "compare", "metrics"], requires: ["a report with more columns than fit on screen"] },
  "c.skip-links": { provides: ["navigation"] },
  "p.setup-checklist": { provides: ["steps", "primary action", "error state"], requires: ["three to six first tasks a new account should do"] },
  "p.notification-menu": { contexts: ["app"], provides: ["results", "filter", "navigation", "empty state", "loading state", "error state"], requires: ["notifications for the signed-in person, with who, what and when"], avoidWhen: ["the screen is the full notifications list: use a list or table there instead"] },
  "b.team-directory": { provides: ["results", "filter", "search", "empty state"], requires: ["the real people, with a role and a department each"], avoidWhen: ["there are only three or four people: the team grid is enough"] },
  "p.files-table": { contexts: ["app"], provides: ["results", "upload", "sort", "edit", "empty state", "loading state", "error state"], requires: ["files with a name, size, date and uploader", "a place to upload to"] },
  "p.blog-article": { provides: ["detail", "navigation"], requires: ["one post with its sections, and a few recent posts"], avoidWhen: ["the page lists many posts: use the latest posts block instead"] },
  "b.how-it-works": { provides: ["steps", "media", "primary action"], requires: ["three to six steps of a process, each with a title and a line"], avoidWhen: ["the person is filling in a multi-step form: use the form wizard"] },
  "b.gallery-filter": { provides: ["media", "filter", "results"], requires: ["pictures with a title and a category"], avoidWhen: ["fewer than six pictures or a single category: use the slideshow"] },
  "p.order-history": { provides: ["history", "results", "search", "filter", "detail", "empty state"], requires: ["the customer's orders with items, a status and a total"], contexts: ["app"] },
  "p.account-sessions": { provides: ["settings", "results"], requires: ["the account's signed-in sessions with device, place and last activity"], contexts: ["app"] },
  "c.otp-input": { provides: ["form"], avoidWhen: ["a whole verify screen is wanted: use p.auth-form.verify-code"] },
  "c.number-field": { provides: ["form"], avoidWhen: ["a whole count of items or tickets: use c.quantity"] },
  "c.input-group": { provides: ["form"] },
  "c.social-button": { provides: ["sign-in"], requires: ["sign-in providers the app has set up"], avoidWhen: ["the person is already signed in"] },
  // On the approval shelf (agents' batch, 2026-10-21)
  "c.context-menu": { contexts: ["app"], provides: ["edit"], requires: ["items or records to act on"] },
  "c.menubar": { contexts: ["app"], provides: ["navigation", "settings"], requires: ["commands grouped into a few menus"], avoidWhen: ["A marketing page: use a header with links instead."] },
  "c.split-panes": { contexts: ["app"], provides: ["detail"], requires: ["two or more panes of content that benefit from being seen at once"] },
  "p.mega-menu": { contexts: ["marketing"], provides: ["navigation"], requires: ["a site with enough pages to group into sections"], avoidWhen: ["A site with five pages or fewer: a simple header is enough."] },
  "c.scroll-area": { provides: [] },
};

/** The component an ID belongs to: variants and versions answer to it (c.tabs@folder, c.button.primary → c.tabs, c.button). */
function baseRef(ref: string): string {
  const noVersion = ref.split("@")[0]!;
  if (RELATIONS[noVersion]) return noVersion;
  const parts = noVersion.split(".");
  return parts.length > 2 ? parts.slice(0, 2).join(".") : noVersion;
}

function pieceFor(ref: string): LibrarySection | undefined {
  return LIBRARY_SECTIONS.find((s) => s.ref === ref || (s.variants ?? []).some((v) => v.ref === ref) || (s.also ?? []).some((a) => a.ref === ref));
}

/** A piece's relations, by catalog ID or by the piece. */
export function relationsOf(refOrPiece: string | LibrarySection): PieceRelations {
  const piece = typeof refOrPiece === "string" ? pieceFor(refOrPiece) ?? pieceFor(baseRef(refOrPiece)) : refOrPiece;
  const ref = typeof refOrPiece === "string" ? refOrPiece : refOrPiece.ref ?? "";
  const rel = RELATIONS[ref] ?? RELATIONS[baseRef(ref)] ?? {};
  const cat = piece?.category;
  const contexts: PieceContext[] = rel.contexts ?? (cat && MARKETING.has(cat) ? ["marketing"] : cat && APP_ONLY.has(cat) ? ["app"] : ["app", "marketing"]);
  return { contexts, provides: rel.provides ?? [], requires: rel.requires ?? [], avoidWhen: rel.avoidWhen ?? [] };
}

/** Catalog IDs that provide a capability and may sit in the given context, components and patterns first. */
/** Catalog IDs of approved pieces: a piece on the approval shelf can have relations ready, but builds aren't offered it. */
let approved: Set<string> | undefined;
const isApproved = (ref: string) => (approved ??= new Set(LIBRARY_SECTIONS.flatMap((s) => refsOf(s)))).has(ref) || ![...PROPOSED_SECTIONS.flatMap((s) => refsOf(s))].includes(ref);

export function providersOf(cap: Capability, context?: PieceContext): string[] {
  return Object.keys(RELATIONS).filter((ref) => isApproved(ref) && (RELATIONS[ref]!.provides ?? []).includes(cap) && (!context || relationsOf(ref).contexts.includes(context)));
}
