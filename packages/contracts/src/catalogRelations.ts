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
import { LIBRARY_SECTIONS, type LibrarySection, type SectionCategory } from "./sectionLibrary.js";

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
  "p.stats-compare": { provides: ["metrics", "compare"] },
  "p.plan-comparison": { provides: ["compare"], requires: ["two to four options with the same features"] },
  "p.diff": { provides: ["review", "compare"], requires: ["a before and an after"] },
  "p.approval-card": { provides: ["review"], requires: ["requests waiting for a decision"] },
  // Media and navigation
  "c.carousel": { provides: ["media", "results"], avoidWhen: ["the items are the page's main list: show them all instead"] },
  "c.slideshow": { provides: ["media"], requires: ["pictures"], avoidWhen: ["text the person must read: a moving slide hides it"] },
  "c.media-frame": { provides: ["media"] },
  "p.top-nav": { provides: ["navigation"] },
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
export function providersOf(cap: Capability, context?: PieceContext): string[] {
  return Object.keys(RELATIONS).filter((ref) => (RELATIONS[ref]!.provides ?? []).includes(cap) && (!context || relationsOf(ref).contexts.includes(context)));
}
