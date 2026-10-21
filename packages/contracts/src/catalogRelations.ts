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
  // On the approval shelf (agents' batch, 2026-10-21)
  "p.api-keys": { contexts: ["app"], provides: ["results", "edit", "settings", "empty state", "loading state", "error state"], requires: ["the workspace's keys (name, prefix, last four, access, dates)", "a server call that makes and rolls secrets"], avoidWhen: ["the app has no outside integrations or developer access"] },
  "p.audit-log": { contexts: ["app"], provides: ["results", "history", "filter", "search", "sort", "detail", "empty state", "loading state", "error state"], requires: ["events with a time, a person, an action and a target", "names for each kind of action"], avoidWhen: ["a casual activity feed for end users (use p.activity-timeline)"] },
  "p.invoice-view": { contexts: ["app"], provides: ["detail", "edit", "form", "primary action"], requires: ["one invoice with parties, line items, tax and payments", "a way to send email and record payments"], avoidWhen: ["a list of many invoices (use a table)", "a shopper's order history (use p.order-history)"] },
  "p.task-drawer": { contexts: ["app"], provides: ["detail", "edit", "conversation", "steps", "date entry"], requires: ["tasks with status, assignee, due date, priority, checklist and comments", "the people who can be assigned"], avoidWhen: ["a record with many fields better served by a full page (use p.record-detail)"] },
  "p.csv-import": { contexts: ["app"], provides: ["upload", "steps", "form", "review", "error state", "loading state"], requires: ["the fields a record has, with which are required and their kinds", "a save that takes many rows"], avoidWhen: ["uploading files to keep as files (use p.files-table)"] },
  "b.careers": { provides: ["results", "filter", "search", "empty state", "form", "detail"], requires: ["the real open roles, each with a department, place and type"], avoidWhen: ["there is only one opening: a single role page fits better"] },
  "b.changelog": { provides: ["history", "filter", "results", "detail"], requires: ["the real releases, newest first, each with a version, a date and its changes"], avoidWhen: ["a history of one record's events: use the activity timeline"] },
  "b.contact-offices": { provides: ["form", "navigation"], requires: ["the real channels, offices with time zones and opening hours, and the message topics"], avoidWhen: ["one address and no opening hours: the contact split is enough"] },
  "b.pricing-calculator": { provides: ["form"], requires: ["the real per-seat plan prices, seat ranges, extras and the yearly discount"], avoidWhen: ["flat-price plans with no seats or extras: use the pricing tiers or the monthly or yearly toggle"] },
  "p.reviews": { provides: ["filter", "sort", "results", "form", "empty state"], requires: ["the real reviews with a rating, author, date and text"], avoidWhen: ["hand-picked quotes with no ratings: use the testimonial cards"] },
  "b.hero-signup": { provides: ["media"], requires: ["a one-line promise","a picture of the product"], avoidWhen: ["the page's main action is not an email sign-up: use the split or centered hero"] },
  "b.features-bento": { provides: ["media"], requires: ["four to ten features, each with a title and a line"], avoidWhen: ["three features or fewer of equal weight: use the features grid"] },
  "b.use-cases-tabs": { provides: ["navigation", "media"], requires: ["three to five customer types or jobs, each with points and a picture"], avoidWhen: ["one kind of customer only: use features alternating"] },
  "b.compare-old-way": { provides: ["compare", "primary action"], requires: ["four to six topics, each with the old way and the product's way"], avoidWhen: ["comparing plans or tiers: use the plan comparison table"] },
  "b.testimonials-wall": { provides: [], requires: ["six or more short quotes with a name"], avoidWhen: ["three quotes or fewer: use the testimonial cards or the featured quote"] },
  "c.date-field": { contexts: ["app"], provides: ["date entry", "form"], requires: ["a date people already know (birthday, expiry, due date)"], avoidWhen: ["Picking a day from availability: use the date picker or booking calendar instead."] },
  "c.collapsible": { contexts: ["app", "marketing"], provides: ["detail", "settings"], requires: ["sections people only sometimes need"], avoidWhen: ["Only one section may be open at a time: use the accordion instead."] },
  "p.zoom-chart": { contexts: ["app"], provides: ["chart", "metrics", "history"], requires: ["a long time series (weeks or months of points)"], avoidWhen: ["A dozen points or fewer: use the area or bar chart instead."] },
  "p.scroll-dialog": { contexts: ["app"], provides: ["review", "primary action"], requires: ["long text people must read before agreeing"], avoidWhen: ["A short confirmation: use the confirm modal instead."] },
  "c.time-zone-field": { contexts: ["app"], provides: ["time entry", "settings", "form"], requires: ["a person's or event's time zone"] },
  // On the approval shelf (agents' batch, 2026-10-21)
  "p.two-factor": { contexts: ["app"], provides: ["edit", "settings", "form", "steps", "loading state", "error state"], requires: ["the account's sign-in methods and whether each is set up", "server calls that check codes, send texts and make recovery codes"], avoidWhen: ["the app has no accounts or sign-in"] },
  "p.connected-apps": { contexts: ["app"], provides: ["results", "search", "filter", "detail", "settings", "empty state", "loading state", "error state"], requires: ["the outside services the product supports, with what each may do", "each provider's sign-in for Connect"], avoidWhen: ["the app has no outside integrations", "developer keys and secrets (use p.api-keys)"] },
  "p.notification-matrix": { contexts: ["app"], provides: ["settings", "edit", "form", "error state", "loading state"], requires: ["the events the app notifies about, grouped", "the channels it can send on", "a save for the person's choices"], avoidWhen: ["the app sends no notifications", "a list of the notifications themselves (use p.notification-menu)"] },
  "p.payment-methods": { contexts: ["app"], provides: ["settings", "edit", "form", "results", "empty state", "error state", "loading state"], requires: ["the cards on file (brand, last four, expiry) and the default", "the billing profile", "the payment provider's tokenizing call for new cards"], avoidWhen: ["the app takes no payments", "a one-time checkout (use the checkout or card fields)"] },
  "p.change-password": { contexts: ["app"], provides: ["form", "edit", "settings", "error state", "loading state"], requires: ["the server's password rules", "a call that checks the current password and saves the new one"], avoidWhen: ["the app signs people in without passwords", "resetting a forgotten password (use p.auth-form.forgot-password)"] },
  "b.shop-checkout": { contexts: ["marketing", "app"], provides: ["steps", "form", "review", "primary action", "empty state", "loading state", "error state"], requires: ["the bag lines with prices in cents", "shipping methods, promo codes and a tax rate", "a payment step to call on Place order"], avoidWhen: ["a single product bought in one tap (use a buy button)", "only the bag itself (use b.shop-cart-page)"] },
  "b.shop-wishlist": { contexts: ["marketing", "app"], provides: ["results", "sort", "edit", "primary action", "empty state", "loading state", "error state"], requires: ["the shopper's saved items with price, old price, stock and sizes", "a way to add to the bag"], avoidWhen: ["a catalog of products the shopper has not saved (use b.shop-collection)"] },
  "b.shop-compare": { contexts: ["marketing"], provides: ["compare", "results", "detail", "primary action"], requires: ["products with a price, a rating and the same set of specs", "which specs are better high or low"], avoidWhen: ["products with nothing measurable in common", "comparing plans (use p.plan-comparison)"] },
  "b.shop-order-confirmation": { contexts: ["marketing", "app"], provides: ["detail", "edit", "form", "history", "primary action", "loading state", "error state"], requires: ["the placed order with items, totals, delivery method, address and card", "order calls to change the address, cancel and sign up for texts"], avoidWhen: ["a list of past orders (use p.order-history)"] },
  "b.shop-bundle-builder": { contexts: ["marketing"], provides: ["form", "filter", "persuade", "primary action", "loading state"], requires: ["box sizes with their savings", "products with a kind and a price in cents"], avoidWhen: ["products sold one at a time with no bundle offer"] },
  "b.hero-video": { provides: ["media", "persuade", "primary action"] },
  "b.integrations": { provides: ["search", "filter", "detail", "empty state"] },
  "b.case-studies": { provides: ["persuade", "navigation"] },
  "b.roadmap": { provides: ["filter", "detail", "review", "steps"] },
  "b.footer-newsletter": { provides: ["form", "navigation"] },
  "p.donut-chart": { contexts: ["app"], provides: ["chart", "metrics", "compare", "loading state", "empty state"], requires: ["a total that splits into two to six parts", "the same parts for each period shown"], avoidWhen: ["Many parts or values over time: use the bar or area chart instead."] },
  "p.funnel-chart": { contexts: ["app"], provides: ["chart", "metrics", "steps", "compare", "loading state", "empty state"], requires: ["an ordered list of steps people pass through", "how many reached each step, per period"], avoidWhen: ["Steps people can skip or take in any order: use a bar chart instead."] },
  "p.activity-heatmap": { contexts: ["app"], provides: ["chart", "history", "metrics", "detail", "loading state", "empty state"], requires: ["a count per day over weeks or months"], avoidWhen: ["Fewer than a few weeks of days, or values that are not counts per day: use a bar chart instead."] },
  "p.leaderboard": { contexts: ["app"], provides: ["results", "sort", "compare", "metrics", "loading state", "empty state"], requires: ["people, teams or products with a score per measure and period", "the scores from the period before, for rank changes"], avoidWhen: ["A plain data table with many columns to sort: use p.data-table or the sortable table instead."] },
  "p.goal-targets": { contexts: ["app"], provides: ["metrics", "edit", "settings", "loading state", "empty state"], requires: ["goals with a current value and a target", "how far through the period today is"], avoidWhen: ["A single figure with no target: use c.kpi instead."] },
  // On the approval shelf (agents' batch, 2026-10-21)
  "t.app-team-chat": { contexts: ["app"], provides: ["conversation", "navigation", "results", "detail", "form", "empty state", "loading state", "error state"], requires: ["the workspace's people, channels and message history", "a send call (and live delivery of new messages)"], avoidWhen: ["one-to-one direct messages only (use t.app-social-messages)", "customer support conversations (use t.app-support-inbox)"] },
  "t.app-mail": { contexts: ["app"], provides: ["results", "search", "filter", "detail", "conversation", "form", "upload", "navigation", "empty state", "loading state", "error state"], requires: ["the account's mail by folder", "calls that send, move, flag and snooze messages"], avoidWhen: ["help-desk tickets with assignment (use t.app-support-inbox)", "chat-style messaging (use t.app-team-chat)"] },
  "p.call-lobby": { contexts: ["app"], provides: ["form", "settings", "media", "primary action", "loading state", "error state"], requires: ["the meeting and who is already in it", "the device lists and the app's own media code", "a join call that admits or declines"], avoidWhen: ["the app has no live calls", "booking a call time (use the booking calendar)"] },
  "p.announcement-composer": { contexts: ["app"], provides: ["form", "edit", "date entry", "time entry", "review", "history", "primary action", "error state", "loading state"], requires: ["the organization's teams and people", "a call that sends or schedules announcements", "the list of past and scheduled announcements"], avoidWhen: ["a banner shown on a marketing page (use b.announcement-bar)", "one-to-one messages (use t.app-team-chat)"] },
  "p.away-message": { contexts: ["app"], provides: ["settings", "form", "edit", "date entry", "review", "error state", "loading state"], requires: ["the person's saved automatic-reply settings", "their teammates for a backup contact", "a save call"], avoidWhen: ["the app sends no email or messages", "notification preferences (use p.notification-matrix)"] },
  "b.event-listing": { contexts: ["marketing", "app"], provides: ["results", "search", "filter", "detail", "booking", "form", "primary action", "empty state", "loading state", "error state"], requires: ["upcoming events with a start, length, place, price in cents, capacity and how many are going", "an RSVP service that can hold spots and a waitlist"], avoidWhen: ["selling paid tickets with types and fees (use a checkout)", "one event's own page (use t.site-event)"] },
  "b.booking-flow": { contexts: ["marketing", "app"], provides: ["booking", "steps", "date entry", "time entry", "form", "review", "edit", "primary action", "error state"], requires: ["services with length, price in cents and who does them", "staff, opening hours and closed days", "which start times are taken"], avoidWhen: ["only a day and a time to pick (use p.booking-calendar)", "classes with a fixed timetable many people join (use an event listing)"] },
  "b.rental-detail": { contexts: ["marketing", "app"], provides: ["detail", "media", "booking", "date entry", "form", "primary action", "error state"], requires: ["one listing's photos, facts, amenities and host", "a nightly rate, cleaning fee, service and tax rates in cents and percent", "the nights already booked"], avoidWhen: ["browsing many listings (use t.lookup-home-listings or a results grid)", "instant booking with payment (add a checkout)"] },
  "b.store-hours": { contexts: ["marketing", "app"], provides: ["detail", "time entry", "date entry"], requires: ["the regular week's opening periods and the shop's time zone", "holiday closures and special hours by date", "an address and a phone number"], avoidWhen: ["booking a time (use b.booking-flow or p.booking-calendar)", "several locations side by side (use b.contact-offices)"] },
  "b.guest-checkin": { contexts: ["app"], provides: ["results", "search", "filter", "metrics", "edit", "form", "primary action", "empty state", "error state"], requires: ["the guest list with ticket type, party size and a code", "a way to save check-ins, undo, walk-ins and removals"], avoidWhen: ["guests booking or RSVPing themselves (use b.event-listing)", "a general member list (use p.members-table)"] },
  "b.about-story": { contexts: ["marketing"], provides: ["history", "persuade", "navigation"] },
  "b.numbers-story": { contexts: ["marketing"], provides: ["metrics", "media", "persuade", "detail"] },
  "b.press-kit": { contexts: ["marketing"], provides: ["media", "filter", "primary action"] },
  "b.partner-apply": { contexts: ["marketing"], provides: ["form", "steps", "persuade", "error state", "primary action"] },
  "b.plans-accordion": { contexts: ["marketing"], provides: ["compare", "filter", "detail", "primary action"] },
  "p.profile-photo": { contexts: ["app"], provides: ["upload", "media", "edit", "settings", "loading state", "error state"], requires: ["somewhere to store the saved image (a data URL or an upload endpoint)"], avoidWhen: ["the app has no accounts or profiles"] },
  "p.tags-manager": { contexts: ["app"], provides: ["results", "search", "sort", "edit", "form", "settings", "empty state", "loading state", "error state"], requires: ["the workspace's tags with how many items use each", "a store that applies renames, merges and deletes to tagged items"], avoidWhen: ["tags are fixed and not editable by people"] },
  "p.address-form": { contexts: ["app"], provides: ["form", "edit", "search", "results", "settings", "empty state", "error state"], requires: ["the countries the product ships to with their address rules", "an address list or lookup service for suggestions"], avoidWhen: ["only a city or region is needed, not a full address"] },
  "p.survey-builder": { contexts: ["app"], provides: ["edit", "form", "steps", "review", "empty state", "error state"], requires: ["a store for surveys and their responses"], avoidWhen: ["the questions are fixed and never edited (use a plain form)"] },
  "p.business-details": { contexts: ["app"], provides: ["form", "edit", "settings", "review", "error state"], requires: ["the countries and tax IDs the product collects", "a server check for tax IDs"], avoidWhen: ["the product never invoices or bills customers"] },
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
