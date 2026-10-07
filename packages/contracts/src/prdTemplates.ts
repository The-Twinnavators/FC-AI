/**
 * PRD templates by kind of project. Every template keeps the same core (summary, goals, non-goals, permissions,
 * flows, requirements, states, accessibility, acceptance criteria, constraints, open questions) so FlowCode's PRD
 * intake can find what it needs; each kind adds the sections that kind of product always has to decide.
 * Headings are numbered so plans and briefs can cite them ("§7 Acceptance criteria").
 */

export interface PrdTemplate {
  id: string;
  label: string;
  /** One line: what it's for. */
  description: string;
  /** Extra sections for this kind of project, inserted after "Functional requirements". */
  extra: Array<{ title: string; body: string }>;
}

const CORE_BEFORE: Array<{ title: string; body: string }> = [
  { title: "Status", body: "Draft | In review | Approved | Implemented" },
  { title: "Owner", body: "[Name or team]" },
  { title: "Summary", body: "[Two to four sentences.]" },
  { title: "Problem", body: "[User and business problem.]" },
  { title: "Goal", body: "[Outcome this must achieve.]" },
  { title: "Non-goals", body: "- [Explicitly excluded item]\n- [Explicitly excluded item]" },
  { title: "MVP and later phases", body: "- MVP: [The smallest version that works end to end]\n- Later: [Enhancement for a future phase]" },
  { title: "Users and permissions", body: "| Role | Can do | Cannot do |\n|---|---|---|\n| [Role] | [Allowed action] | [Restricted action] |" },
  { title: "Entry points", body: "- [Route, navigation item, deep link, event, or API trigger]" },
  { title: "User flow", body: "1. [User action]\n2. [System behavior]\n3. [User outcome]" },
  { title: "Functional requirements", body: "- FR-01: [Atomic, testable requirement]\n- FR-02: [Atomic, testable requirement]" },
];

const CORE_AFTER: Array<{ title: string; body: string }> = [
  { title: "UI and content requirements", body: "- [Component or screen behavior]\n- [Content/copy requirements]\n- [Design-system or responsive requirements]" },
  { title: "Data and integrations", body: "- [Data read or written]\n- [API, service, event, or dependency]\n- [Permission and ownership rules]" },
  { title: "States and edge cases", body: "- Loading: [Expected behavior]\n- Empty: [Expected behavior]\n- Error: [Expected behavior]\n- Permission denied: [Expected behavior]\n- Edge case: [Expected behavior]" },
  { title: "Accessibility", body: "- [Keyboard, labels, focus, semantic markup, announcements, contrast requirement]" },
  { title: "Analytics", body: "- [Event name, properties, trigger]\n- [Success metric]" },
  { title: "Acceptance criteria", body: "- [ ] AC-01: [Observable, testable behavior]\n- [ ] AC-02: [Observable, testable behavior]\n- [ ] AC-03: [Expected failure or edge-case behavior]" },
  { title: "Testing and verification", body: "- [Test case: input, action, expected result]\n- [What is checked by hand: keyboard, small screen, reduced motion]" },
  { title: "Technical constraints", body: "- [Must preserve, must not change, dependencies, performance expectations]" },
  { title: "Open questions", body: "- [Question requiring a decision]" },
  { title: "Related documents", body: "- [Relative Markdown path]" },
];

export const PRD_TEMPLATES: PrdTemplate[] = [
  {
    id: "feature",
    label: "Feature",
    description: "One feature in an existing product. The general template.",
    extra: [],
  },
  {
    id: "website",
    label: "Website",
    description: "Marketing, portfolio or content site: pages, content, search visibility, forms.",
    extra: [
      { title: "Pages and sitemap", body: "| Page | Route | Purpose | Primary action |\n|---|---|---|---|\n| [Home] | [/] | [Why it exists] | [What the visitor should do] |" },
      { title: "Content model", body: "- [Content type, its fields, who edits it, how often]\n- [Where content comes from: files, CMS, spreadsheet]" },
      { title: "Search and link previews", body: "- Title and description per page: [rule or list]\n- Social preview image: [source]\n- Sitemap, robots.txt, canonical URLs: [requirements]" },
      { title: "Forms and lead capture", body: "- [Form, its fields, where submissions go, confirmation shown]\n- Spam protection: [approach]" },
      { title: "Performance budget", body: "- [Largest page weight, image formats, load time target on a mid-range phone]" },
      { title: "Legal and consent", body: "- Privacy notice: [location]\n- Cookies or tracking: [what is used, consent needed or not]" },
    ],
  },
  {
    id: "saas",
    label: "SaaS app",
    description: "Signed-in web app with accounts, teams, plans and billing.",
    extra: [
      { title: "Accounts, teams and roles", body: "- Sign-up and sign-in: [methods]\n- Workspaces or teams: [yes/no, how people join]\n- Roles: [owner, admin, member, …] and what each can do" },
      { title: "Onboarding", body: "1. [First screen after sign-up]\n2. [Setup steps and what can be skipped]\n3. [The first moment the user gets value]" },
      { title: "Plans, limits and billing", body: "| Plan | Price | Limits | Features |\n|---|---|---|---|\n| [Free] | [0] | [Limits] | [Included] |\n\n- Trial: [length, what happens when it ends]\n- Payment provider: [name]; card data never stored by the app\n- Upgrade, downgrade, cancel: [behavior and timing]" },
      { title: "Data isolation", body: "- [How one customer's data is kept from another's]\n- [What your own staff can see, and when]" },
      { title: "Notifications", body: "- [Event] → [email / in-app], [who receives it], [how to turn it off]" },
      { title: "Integrations and API", body: "- [Third-party service, what it's used for, auth method]\n- Public API: [yes/no, rate limits]" },
      { title: "Admin and support", body: "- [Admin screens, impersonation rules, audit log]" },
      { title: "Account deletion and data export", body: "- [How a user deletes their account, what is removed, export format]" },
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce store",
    description: "Online shop: catalogue, cart, checkout, orders, shipping and returns.",
    extra: [
      { title: "Catalogue and product data", body: "- Product fields: [title, price, variants, images, stock, …]\n- Categories and filters: [list]\n- Who manages products and how: [admin screen, import, CMS]" },
      { title: "Cart and checkout", body: "1. [Add to cart rules: limits, variants, out of stock]\n2. [Checkout steps: guest or account, address, delivery, payment]\n3. [Confirmation page and email]" },
      { title: "Payments", body: "- Provider: [name]; card data handled only by the provider\n- Currencies and taxes: [rules]\n- Failed or abandoned payments: [behavior]" },
      { title: "Shipping and tax", body: "- Delivery options and prices: [rules]\n- Regions served: [list]\n- Tax calculation: [rule or service]" },
      { title: "Orders and fulfilment", body: "- Order statuses: [placed, paid, shipped, delivered, cancelled]\n- Notifications at each status: [email / SMS]\n- Who fulfils orders and where they see them" },
      { title: "Returns and refunds", body: "- Return window and conditions: [rules]\n- Refund method and timing: [rules]" },
      { title: "Promotions", body: "- Discount codes, sales, free-shipping thresholds: [rules and limits]" },
      { title: "Legal", body: "- Terms of sale, privacy notice, cookie consent, consumer-law requirements for the regions served" },
    ],
  },
  {
    id: "internal-tool",
    label: "Internal tool / dashboard",
    description: "Admin panel or dashboard for a team: data tables, actions, approvals.",
    extra: [
      { title: "Data sources", body: "- [Database, API or spreadsheet, read or write, refresh rate]" },
      { title: "Tables, filters and exports", body: "| View | Columns | Filters | Sort | Export |\n|---|---|---|---|---|\n| [Name] | [Columns] | [Filters] | [Default sort] | [CSV / none] |" },
      { title: "Actions and bulk actions", body: "- [Action, who can do it, confirmation needed, can it be undone]" },
      { title: "Approvals", body: "- [What needs a second person's approval and how it's recorded]" },
      { title: "Audit log", body: "- [Which changes are recorded, who can see the log, how long it's kept]" },
    ],
  },
  {
    id: "interactive",
    label: "Interactive or animated feature",
    description: "Parallax, scroll stories, timelines, sliders, workflow maps or 3D: how it moves and how it works without motion.",
    extra: [
      { title: "Interaction model", body: "- Trigger: [scroll / pointer / keyboard / touch]\n- What moves or changes, and what it tells the user: [meaning, not decoration]\n- Starts when: [condition]; ends when: [condition]" },
      { title: "Layers and assets", body: "| Layer or element | Depth or role | Asset | Size |\n|---|---|---|---|\n| [Background] | [Far] | [file] | [px, KB] |" },
      { title: "Keyboard, touch and small screens", body: "- Keyboard: [Tab order, arrow keys, Enter, Escape]\n- Touch: [tap, swipe, and the button that does the same]\n- Small screens: [what moves less or not at all]" },
      { title: "Reduced motion", body: "- [The still composition shown under prefers-reduced-motion; all content visible]" },
      { title: "Performance budget", body: "- [Frame-rate target, asset weight, what pauses off screen]" },
      { title: "Technology choice", body: "- [CSS transforms / SVG / Canvas / Three.js] because [reason a simpler option can't do it]\n- Fallback if it fails: [static image or list]\n- Same information without the visual: [where]" },
    ],
  },
  {
    id: "simulation",
    label: "Simulation or what-if tool",
    description: "Calculators, forecasts, scenario comparison or replay: inputs, assumptions, formulas and saved scenarios.",
    extra: [
      { title: "Inputs", body: "| Input | Unit | Range | Default | Required |\n|---|---|---|---|---|\n| [Name] | [unit] | [min to max] | [value] | [yes/no] |" },
      { title: "Assumptions shown to the user", body: "- [Assumption, its value, where it comes from]" },
      { title: "Formulas and rules", body: "- [Output] = [formula], rounded to [n] decimals" },
      { title: "Outputs and comparison", body: "- [Output, unit, chart or table, how two scenarios are compared]" },
      { title: "Saved scenarios", body: "- [Saved or not; what is stored with each: inputs, model version, date]" },
      { title: "Known cases for testing", body: "| Inputs | Expected output |\n|---|---|\n| [Baseline] | [Value] |\n| [Boundary] | [Value] |\n| [Invalid] | [Message] |" },
      { title: "Disclaimers", body: "- [Results are estimates; wording for money, health or legal topics]" },
    ],
  },
  {
    id: "ai-feature",
    label: "AI feature",
    description: "Generation, extraction, classification, summaries, recommendations or a co-pilot, with human review.",
    extra: [
      { title: "Model role", body: "- What the model does: [task]\n- What it receives: [inputs, and what is never sent]\n- Model or provider: [local / hosted, and why]" },
      { title: "Output schema", body: "```json\n{ \"[field]\": \"[type and meaning]\" }\n```\n- Validation before use: [rule]" },
      { title: "Human review", body: "- [Which outputs need approval; edit, approve, reject; how AI text is labelled]" },
      { title: "Failure and fallback", body: "- Loading: [behavior]\n- Time-out and retry: [limits]\n- Failure: [how the user continues without AI]" },
      { title: "Privacy and retention", body: "- [What is stored, for how long, who can see it; what goes to outside services]" },
      { title: "Quality and logging", body: "- [How quality is measured; what is logged: timing, model, outcome, not private content]" },
    ],
  },
  {
    id: "product",
    label: "Product spec",
    description: "A whole product area with several features: vision, principles, modules and milestones, linking to feature specs.",
    extra: [
      { title: "Vision", body: "[What the product makes possible, in two or three sentences.]" },
      { title: "Product principles", body: "- [Principle that settles trade-offs]\n- [Principle]" },
      { title: "Modules", body: "| Module | Purpose | Users | Feature spec |\n|---|---|---|---|\n| [Name] | [Why] | [Roles] | [docs/features/name.md] |" },
      { title: "Information architecture", body: "- [Main navigation and how modules connect]" },
      { title: "Domain rules", body: "- [Rule that holds across modules]" },
      { title: "Milestones", body: "1. [Milestone: modules included, success signal]\n2. [Milestone]" },
    ],
  },
  {
    id: "api",
    label: "API / backend service",
    description: "Service other apps call: endpoints, auth, limits, errors.",
    extra: [
      { title: "Endpoints", body: "| Method | Path | Purpose | Auth | Request | Response |\n|---|---|---|---|---|---|\n| [GET] | [/items] | [Why] | [Scope] | [Params] | [Shape] |" },
      { title: "Authentication and authorization", body: "- [API keys, OAuth, sessions; scopes and who issues them]" },
      { title: "Errors", body: "- Error format: [shape]\n- [Status code → meaning → what the caller should do]" },
      { title: "Rate limits and quotas", body: "- [Limit per key / user / IP, response when exceeded]" },
      { title: "Versioning and compatibility", body: "- [How versions are named, how long old versions are supported]" },
      { title: "Data model and storage", body: "- [Entities, fields, relationships, retention]" },
      { title: "Reliability", body: "- [Uptime target, timeouts, retries, idempotency keys, monitoring]" },
    ],
  },
];

/** The full Markdown for a template kind, with numbered headings. */
export function prdTemplate(id: string, name = ""): string {
  const t = PRD_TEMPLATES.find((x) => x.id === id) ?? PRD_TEMPLATES[0];
  const sections = [...CORE_BEFORE, ...t.extra, ...CORE_AFTER];
  const title = t.id === "feature" || t.id === "interactive" || t.id === "simulation" || t.id === "ai-feature" ? `# Feature: ${name || "[Feature name]"}` : `# ${t.label}: ${name || "[Product name]"}`;
  return [title, "", ...sections.flatMap((s, i) => [`## ${i + 1}. ${s.title}`, "", s.body, ""])].join("\n");
}
