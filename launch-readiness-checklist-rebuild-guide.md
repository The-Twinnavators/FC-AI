# Rebuilding the Launch Readiness Checklist (LRC) — with an AI Prompt on Every Task

This guide recreates the Launch Readiness Checklist from Chike's Creative Space: an admin-only page that tracks every task that must be true before the site goes live, groups them into categories, auto-checks what it can, and now attaches a **specification-grade AI prompt to every task** so an AI assistant can perform (or verify) that task exactly as specified.

It is written so you can hand it to a human or an AI. Every build step ends with a copy-paste **AI build prompt**. Section 7 defines the standard every **per-task AI prompt** must meet, and Section 8 gives one fully worked task prompt per category.

---

## 0. How to use this document

1. Read Sections 1–5 once. They are the specification.
2. Paste the **Conventions Block** (Section 2.2) into your AI session first. It teaches the AI the codebase rules.
3. Run Steps 1–13 (Section 6) in order. For each step, paste that step's **AI build prompt**, review the diff, run the step's **Verify** list, then continue.
4. Do Step 12 (seed tasks + prompts) and Step 13 (verification suite) last.
5. Section 9 is the final acceptance checklist.

Rule of thumb: never move to the next step until the current step's Verify list passes.

---

## 1. What the feature is

### 1.1 Summary

An admin page at `#/admin/launch-readiness` ("Launch" group in the admin sidebar, next to the Test panel). It shows:

- A header with "N of M tasks complete across K categories", the time checks last ran, a **New task** button and a **Run checks** button.
- An **overall progress bar** and a **callout**: amber/red if there are blocked launch-gate tasks or incomplete critical launch-gate tasks, green otherwise.
- A **search box** and **filter chips**: Everything, one chip per status, Launch gate only, Flagged only. **Expand all / Collapse all.**
- **Category accordions**, each with an icon, name, blurb, mini progress bar and "done / total · pct%".
- Inside each category, **task rows**: a complete checkbox, priority / type / launch-gate / flagged chips, a title that expands a details panel, a description, the last auto-check evidence, and row actions (copy prompt, flag, edit, delete, status select). The details panel holds ordered manual steps, a notes textarea and (new) the task's AI prompt.
- Two dashboard hooks: a **launch readiness %** tile in the dashboard hero and a **Launch checklist** row in the ops digest.

### 1.2 The one addition (delta from the original build)

Everything above is the original feature, reproduced faithfully. The **only** addition is the per-task AI prompt:

| # | Addition | Where |
|---|---|---|
| A1 | New task field `aiPrompt` (string). No schema change — it lives inside the existing `data jsonb`. | Data model, §3 |
| A2 | `taskPromptFor(task)` returns the stored `aiPrompt`, or a prompt generated from the task's fields when none is stored. Every task therefore always has a usable prompt. | Step 3 |
| A3 | `lintAiPrompt(text, task)` validates a stored prompt against the standard in §7. | Step 3 |
| A4 | Task editor gets an **AI prompt** textarea, a **Fill from fields** button, and lint-on-save. | Step 7 |
| A5 | Details panel shows the prompt (authored vs generated badge) with a Copy button; the row's copy icon copies `taskPromptFor(task)`. | Steps 5, 8 |
| A6 | Every seeded task ships with an authored `aiPrompt`, built through one helper so the format is uniform. | Step 12 |
| A7 | A non-blocking test: "Every launch task has a valid AI prompt". | Step 13 |

Nothing else about behavior changes. Known quirks of the original are listed in §10 and are deliberately preserved.

---

## 2. Assumed architecture and conventions

### 2.1 Stack the original uses

- Single-file **vanilla JavaScript SPA** (`index.html`), no framework, no build step, hash/path router.
- Global **`db`** object over Supabase. Every collection is one table: `id text primary key` + `data jsonb`. The browser keeps a cache and does all filtering/sorting client-side.
- **Event delegation**: elements carry `data-act="..."`. Click actions live in an `ACTIONS` object; form submits, `change` and `input` events have their own `if (act === ...)` chains.
- Admin UI built as HTML strings. All dynamic text passes through `E()` (HTML escape). Icons via `ic("lucide-name")`.
- Admin-only data is fetched and realtime-subscribed only after an active admin signs in.

If your stack differs, keep the **behavior and data model** and translate the wiring. The prompts say "in this stack"; swap in your framework's equivalents.

### 2.2 The Conventions Block (paste this first, every session)

```text
You are working in a single-file vanilla JavaScript admin SPA (no framework, no build step).
Follow these conventions exactly.

DATA
- Global `db` with: list(col), find(col,id), add(col,rec,silent), update(col,id,patch,silent),
  remove(col,id). Records are plain objects with an `id`. In Supabase each is {id text, data jsonb}.
- Collection key -> table name goes through COLLECTION_TABLE / tableFor(col).
- silent=true skips the audit-log entry. add/remove are audited; frequent toggles are silent.
- Admin-only collections are listed in ADMIN_ONLY_COLLECTIONS and are only fetched for active admins.

UI
- HTML is assembled as strings. ALWAYS escape dynamic text with E(). Icons: ic("name").
- Events are delegated by data-act. Click -> ACTIONS["name"](el, ev). Form submit -> the submit
  handler's `if (act === "name")` chain. Select/checkbox -> the change handler. Text input ->
  the input handler (use restoreFocusAfter(() => rerender(), "#id") when the input is re-rendered).
- Transient UI state lives in AppState. rerender() redraws without jumping to the top.
- Feedback: toast(msg) / toast(msg, "bad"). Destructive actions go through confirmDelete(label, onYes).
- Styling: use the admin-* CSS variables. New component classes for this feature are prefixed `launch-`.

QUALITY
- No new dependencies, frameworks or build steps. Do not restyle unrelated code.
- After every change: extract each non-module <script> block and run `node --check` on it.
- Never print, log or commit secrets. Ask before any destructive or irreversible action.
- Report back: files changed, what you verified and how, and anything you did NOT do.
```

---

## 3. Data model

### 3.1 Task record (`launchReadiness` collection)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable and human-readable for seeds (`pf-1`, `safety-3`, `launch-6`); `uid("laun")`-style for tasks added in the UI. |
| `title` | string | Required. One outcome that is verifiably true or false. |
| `description` | string | Why it matters, what exists today, exact file/function/check names. |
| `categoryId` | string | One of the 14 category ids (§3.2). |
| `priority` | `"low" \| "medium" \| "high" \| "critical"` | `high` and `critical` get a coloured chip. |
| `executionType` | `"code" \| "manual" \| "review"` | Who/what performs it. |
| `launchGate` | boolean | If true the task blocks release while incomplete. |
| `status` | enum | `not_started`, `in_progress`, `needs_review`, `complete`, `blocked`, `not_applicable`. |
| `notes` | string | Free text. |
| `flaggedAt` | ISO string \| null | Null = not flagged. |
| `autoCheck` | string \| null | Key into `LAUNCH_CHECKS`. |
| `autoDetection` | `{status, evidence, checkedAt}` \| absent | Written only by "Run checks". |
| `manualSteps` | string[] | Ordered steps shown in the details panel. |
| **`aiPrompt`** | string | **New.** Authored prompt (§7). Empty string means "use the generated fallback". |
| `createdAt`, `updatedAt` | ISO string | Added by `db.add` / `db.update`. |

### 3.2 Category record (code constant, not stored)

```js
const LAUNCH_CATEGORIES = [
  { id:"project-foundation",            name:"Project Foundation",                 icon:"hammer",        requiredForLaunch:true,  blurb:"Build health, secrets, and documentation" },
  { id:"brand-creative-direction",      name:"Brand & Creative Direction",         icon:"sparkles",      requiredForLaunch:true,  blurb:"Voice, palette, character consistency, imagery" },
  { id:"site-structure-navigation",     name:"Site Structure & Navigation",        icon:"compass",       requiredForLaunch:true,  blurb:"Nav, footer links, 404, admin separation" },
  { id:"homepage-core-pages",           name:"Homepage & Core Pages",              icon:"house",         requiredForLaunch:true,  blurb:"Hero stats, CTAs, Privacy/Terms, announcements" },
  { id:"stories-characters-content",    name:"Stories, Characters & Content",      icon:"book-open",     requiredForLaunch:true,  blurb:"Required fields, video accuracy, safety notes" },
  { id:"activities-games-interactions", name:"Activities, Games & Interactions",   icon:"gamepad-2",     requiredForLaunch:false, blurb:"Game loading, layout fit, physics edge cases" },
  { id:"video-media-assets",            name:"Video, Media & Assets",              icon:"clapperboard",  requiredForLaunch:true,  blurb:"Alt text, cover photos, embeds, captions" },
  { id:"child-safety-privacy-legal",    name:"Child Safety, Privacy & Legal",      icon:"shield-check",  requiredForLaunch:true,  blurb:"Privacy accuracy, data collection, RLS exposure" },
  { id:"accessibility-inclusive-design",name:"Accessibility & Inclusive Design",   icon:"accessibility", requiredForLaunch:true,  blurb:"Contrast, focus, control names, screen reader" },
  { id:"responsive-performance-quality",name:"Responsive, Performance & Quality",  icon:"zap",           requiredForLaunch:true,  blurb:"Breakpoints, console errors, sync, broken links" },
  { id:"seo-discoverability-analytics", name:"SEO, Discoverability & Analytics",   icon:"search",        requiredForLaunch:true,  blurb:"Addresses, social preview, sitemap, tracking" },
  { id:"integrations-data-security",    name:"Integrations, Data & Security",      icon:"lock",          requiredForLaunch:true,  blurb:"RLS, anon key, import validation, reset/restore" },
  { id:"launch-operations-deployment",  name:"Launch Operations & Deployment",     icon:"rocket",        requiredForLaunch:true,  blurb:"Migration run, seeding, backup, /test baseline" },
  { id:"post-launch-growth",            name:"Post-Launch Growth",                 icon:"sprout",        requiredForLaunch:false, blurb:"Feedback loop, content cadence, retrospective" }
];
```

`requiredForLaunch:false` categories render "(optional)" after the name. Rename or swap categories to fit your product; keep the shape.

### 3.3 Reference numbers from the original (for sanity checks)

The original seed has **110 tasks across 14 categories** (53 code, 31 review, 26 manual), **26 distinct auto-checks**, and ID prefixes `pf, bc, nav, hp, content, games, media, safety, a11y, perf, seo, sec, launch, growth, auto, fa`. You do not need to match these; they are a benchmark.

---

## 4. Database and registration

### 4.1 SQL (admin-only from day one)

The original started with open anon access and later tightened it. A fresh build should start locked down. This assumes an `is_active_admin()` function exists (a `security definer` function that returns true for signed-in, active admins); substitute your own admin check if not.

```sql
create table if not exists launch_readiness (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table launch_readiness enable row level security;
revoke all on launch_readiness from anon;
grant select, insert, update, delete on launch_readiness to authenticated;
drop policy if exists "admin only" on launch_readiness;
create policy "admin only" on launch_readiness
  for all to authenticated
  using (is_active_admin()) with check (is_active_admin());
```

### 4.2 Client registration

```js
// 1. collection key -> table name
const COLLECTION_TABLE = { /* ... */ launchReadiness: "launch_readiness" };

// 2. fetched/subscribed only for active admins
const ADMIN_ONLY_COLLECTIONS = [ /* ... */ "launchReadiness" ];

// 3. the seed database object includes the collection
launchReadiness: seedLaunchReadiness()
```

Also register the collection in your backup script and seed script (both map `launchReadiness: "launch_readiness"` and list it in their collection arrays).

### 4.3 Admin navigation and route

```js
{ heading:"Launch", icon:"rocket" },
{ hash:"#/admin/launch-readiness", label:"Launch Readiness", icon:"rocket" },
{ hash:"#/admin/test-panel",       label:"Test panel",       icon:"clipboard-check" },
```

In the admin section router: `else if (section === "launch-readiness") body = adminLaunchReadiness();`

---

## 5. Business rules (the invariants)

1. **Done** means `status === "complete" || status === "not_applicable"`. Both count toward every percentage.
2. **`not_applicable` vs `blocked`**: `not_applicable` means "does not apply here" and counts as done. `blocked` means "stuck on something external", counts as not done, and surfaces in the callout (for launch-gate tasks).
3. **Summary** (`launchStatusSummary`): `total`; `complete` (done count); among launch-gate tasks: `blocked`, `criticalIncomplete` (priority `critical` and not done), `needsReview`. `level` is `red` if `blocked > 0 || criticalIncomplete > 5`, else `amber` if `criticalIncomplete > 0`, else `green`.
4. **Auto-checks never decide alone for sensitive work.** A task in `child-safety-privacy-legal` can never be set to `complete` by an auto-check; it is capped at `needs_review` so a human signs off.
5. **Auto-checks never overwrite human intent.** "Run checks" updates `autoDetection` on every task with an `autoCheck`, but only changes `status` when the current status is `not_started` (then to `complete`, or `needs_review` if not passing).
6. **Silent writes for churn, audited writes for structure.** Status changes, notes, flags and auto-check results use `silent = true` (no audit entry). Creating, editing and deleting a task are audited.
7. **Unchecking** a task's checkbox sets `status = "not_started"` (it does not restore a prior in-progress state).
8. **Filters**: while any filter or search is active, every category is forced open, only matching tasks show, and categories with no matches are hidden. Empty result shows "No tasks match this search or filter."
9. **Category progress** counts all tasks in the category (not just filtered ones).
10. **AI prompt rule (the addition):** every task must always resolve to a usable prompt. `taskPromptFor(task)` = stored `aiPrompt` if non-empty, else the generated fallback. A stored prompt must pass `lintAiPrompt`. Safety-category prompts must demand human sign-off.

---

## 6. Build steps

Each step: **Goal → Files/areas → Spec → AI build prompt → Verify.** Paste the Conventions Block (§2.2) before the first step prompt of a session.

---

### Step 1 — Storage layer

**Goal:** a persisted, admin-only `launchReadiness` collection the app can read and write.
**Areas:** SQL migration, `COLLECTION_TABLE`, `ADMIN_ONLY_COLLECTIONS`, seed/backup scripts.
**Spec:** §4.1 and §4.2.

**AI build prompt**

```text
# Step 1 - Create the launchReadiness storage layer

## Goal
Add an admin-only `launchReadiness` collection backed by a `launch_readiness` Supabase table.

## Context
Every collection is a table with columns id text PK, data jsonb, created_at, updated_at. The browser
reads/writes through the global `db`. Admin-only collections are fetched only for active admins.

## Steps
1. Add a migration SQL block creating `launch_readiness` with RLS enabled, anon fully revoked,
   authenticated granted select/insert/update/delete, and one policy "admin only" using
   is_active_admin() for both USING and WITH CHECK. Make it idempotent (create if not exists,
   drop policy if exists).
2. Register `launchReadiness: "launch_readiness"` in COLLECTION_TABLE.
3. Add "launchReadiness" to ADMIN_ONLY_COLLECTIONS.
4. Add `launchReadiness: []` to the seed database object for now (real seed arrives in Step 12).
5. Register the collection in the backup script and seed script collection maps/arrays.

## Constraints
- Do not touch any other table's policies. Do not grant anything to anon.
- Do not run the SQL against production; provide it for review.

## Acceptance criteria
- Migration is idempotent (safe to run twice).
- tableFor("launchReadiness") === "launch_readiness".
- A signed-out visitor never requests this table.
- node --check passes on every inline script.

## Report back
List files changed, the exact SQL, and confirm nothing was executed against a live database.
```

**Verify:** run the SQL in a scratch project; as anon, `select * from launch_readiness` returns nothing/permission error; as an active admin it works.

---

### Step 2 — Constants and seed shape

**Goal:** categories, status labels, priority chips and the task factory.
**Spec:** §3.1, §3.2.

```js
const LAUNCH_STATUS_LABELS = {
  not_started:"Not started", in_progress:"In progress", needs_review:"Needs review",
  complete:"Complete", blocked:"Blocked", not_applicable:"Not applicable"
};
const LAUNCH_PRIORITY_CHIP = { low:"", medium:"", high:"launch-chip--high", critical:"launch-chip--critical" };
const SEED_DATE = "2026-01-01"; // any fixed date; seeds should not embed "now"

function seedLaunchReadiness(){
  const T = (id, title, description, categoryId, priority, executionType, launchGate, extra) =>
    Object.assign({
      id, title, description, categoryId, priority, executionType, launchGate,
      status:"not_started", notes:"", flaggedAt:null, autoCheck:null, manualSteps:[],
      aiPrompt:"", updatedAt: SEED_DATE
    }, extra || {});
  return [ /* tasks, grouped by category with a comment header per category */ ];
}
```

**AI build prompt**

```text
# Step 2 - Constants and seed factory for the Launch Readiness Checklist

## Goal
Define the category list, status labels, priority chip map and the `seedLaunchReadiness()` factory.

## Steps
1. Add LAUNCH_CATEGORIES with exactly the 14 entries from the spec (id, name, icon, requiredForLaunch,
   blurb). Preserve ids exactly; they are foreign keys.
2. Add LAUNCH_STATUS_LABELS with the six statuses in this order: not_started, in_progress,
   needs_review, complete, blocked, not_applicable.
3. Add LAUNCH_PRIORITY_CHIP mapping low/medium to "" and high/critical to launch-chip--high /
   launch-chip--critical.
4. Add seedLaunchReadiness() returning an array built through an inner factory T(id,title,description,
   categoryId,priority,executionType,launchGate,extra) that fills defaults: status "not_started",
   notes "", flaggedAt null, autoCheck null, manualSteps [], aiPrompt "", updatedAt SEED_DATE, then
   Object.assign(extra).
5. Put TWO placeholder tasks in the array so the page can render (real tasks arrive in Step 12).

## Constraints
- Do not read Date.now() inside seeds. Do not add fields beyond the spec.

## Acceptance criteria
- Every seeded task's categoryId exists in LAUNCH_CATEGORIES.
- Every status/priority/executionType value is from the allowed sets.
- node --check passes.

## Report back
Files changed and a one-line count of categories and seeded tasks.
```

**Verify:** in the console, `seedLaunchReadiness().every(t => LAUNCH_CATEGORIES.some(c => c.id === t.categoryId))` is `true`.

---

### Step 3 — Pure logic (summary, filter, prompts, lint)

**Goal:** all decision logic as pure functions with no DOM, so it can be unit-tested.
**Spec:** §5 rules 1, 3, 8, 10; §7.

```js
const isLaunchDone = t => t.status === "complete" || t.status === "not_applicable";

function launchStatusSummary(){
  const tasks = db.list("launchReadiness");
  const gate = tasks.filter(t => t.launchGate);
  const blocked = gate.filter(t => t.status === "blocked").length;
  const criticalIncomplete = gate.filter(t => t.priority === "critical" && !isLaunchDone(t)).length;
  const needsReview = gate.filter(t => t.status === "needs_review").length;
  let level = "green";
  if (blocked > 0 || criticalIncomplete > 5) level = "red";
  else if (criticalIncomplete > 0) level = "amber";
  return { total: tasks.length, complete: tasks.filter(isLaunchDone).length,
           blocked, criticalIncomplete, needsReview, level };
}

function launchFilteredTasks(){
  const f = AppState.launchFilter, q = f.q.trim().toLowerCase();
  return db.list("launchReadiness").filter(t => {
    if (q && (t.title + " " + t.description).toLowerCase().indexOf(q) < 0) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.gateOnly && !t.launchGate) return false;
    if (f.flaggedOnly && !t.flaggedAt) return false;
    return true;
  });
}
```

Add `AppState.launchFilter = { q:"", status:"", gateOnly:false, flaggedOnly:false }`, `AppState.launchOpenCategories = {}` and `AppState.launchChecksRunAt` (unset).

The prompt functions (the addition):

```js
// Project-specific text lives in config, never hard-coded in the generator.
const LRC_PROMPT_CONFIG = {
  repoNote: "A single index.html (vanilla JS, no build step, no framework) plus games/*.html and supabase/ scripts. Inspect existing code and conventions before changing anything; do not introduce a framework or restyle unrelated code.",
  verifyLines: [
    "node --check passes on every inline script (extract each non-module <script> block and run it)",
    "The /test suite still passes at its established baseline"
  ]
};

const LRC_PROMPT_HEADINGS = ["## Goal", "## Context", "## Steps", "## Constraints", "## Acceptance criteria", "## Report back"];

// Assemble a prompt from structured parts so every authored prompt has the same shape.
function buildTaskPrompt(p){
  const list = a => (a || []).map((x, i) => (i + 1) + ". " + x).join("\n");
  const bullets = a => (a || []).map(x => "- " + x).join("\n");
  return "# " + p.title + "\n\n"
    + "## Goal\n" + p.goal + "\n\n"
    + "## Context\n" + p.context + "\n\n"
    + "## Steps\n" + list(p.steps) + "\n\n"
    + "## Constraints\n" + bullets((p.constraints || []).concat(["Do not touch unrelated code, data or settings."])) + "\n\n"
    + "## Acceptance criteria\n" + bullets(p.acceptance) + "\n\n"
    + "## Report back\n" + (p.report || "Files changed, evidence for each acceptance criterion, and anything you did not do.") + "\n"
    + (p.safety ? "\n## Human sign-off\nThis is a Child Safety / Privacy / Legal task. Do not mark it complete from code or documents alone: report your findings and stop so a human can review and sign off.\n" : "");
}

// Fallback so EVERY task (including ones added later through the UI) has a prompt.
function generatedTaskPrompt(t){
  const cat = LAUNCH_CATEGORIES.find(c => c.id === t.categoryId);
  const steps = (t.manualSteps && t.manualSteps.length) ? t.manualSteps
    : [t.executionType === "code" ? "Implement or verify the above directly in the codebase."
       : "Complete this " + t.executionType + " task directly and record the outcome in the task's notes."];
  return buildTaskPrompt({
    title: t.title,
    goal: t.title + " is verifiably true" + (t.launchGate ? " (launch gate: blocks release if incomplete)." : "."),
    context: t.description + "\n\nCategory: " + (cat ? cat.name : t.categoryId) + ".\n" + LRC_PROMPT_CONFIG.repoNote,
    steps: steps,
    constraints: ["Follow existing conventions; add no dependencies."],
    acceptance: [t.title + " is verifiably true"].concat(LRC_PROMPT_CONFIG.verifyLines),
    safety: t.categoryId === "child-safety-privacy-legal"
  });
}

function taskPromptFor(t){ return (t.aiPrompt && t.aiPrompt.trim()) ? t.aiPrompt : generatedTaskPrompt(t); }

// Returns an array of problems; empty array = valid. Empty prompt text is valid (falls back).
function lintAiPrompt(text, t){
  const s = String(text || "").trim();
  if (!s) return [];
  const problems = [];
  LRC_PROMPT_HEADINGS.forEach(h => { if (s.indexOf(h) < 0) problems.push("missing section " + h); });
  if (s.length > 8000) problems.push("longer than 8000 characters");
  if (/eyJ[A-Za-z0-9_-]{20,}|sk_(live|test)_|service_role\s*[:=]/i.test(s)) problems.push("contains something shaped like a secret");
  if (t && t.categoryId === "child-safety-privacy-legal" && !/human[^.\n]*(review|sign[- ]?off)/i.test(s))
    problems.push("safety tasks must require human sign-off");
  return problems;
}
```

**AI build prompt**

```text
# Step 3 - Pure logic for the Launch Readiness Checklist (including the AI-prompt functions)

## Goal
Implement the DOM-free functions that drive the checklist, so they can be unit-tested.

## Context
Business rules: "done" = complete or not_applicable. launchStatusSummary reports total, complete,
and, among launchGate tasks, blocked / criticalIncomplete / needsReview plus a level
(red if blocked>0 or criticalIncomplete>5; amber if criticalIncomplete>0; else green).
Every task must always resolve to an AI prompt: the stored `aiPrompt` if non-empty, else a prompt
generated from the task's own fields.

## Steps
1. Add isLaunchDone(t), launchStatusSummary(), launchFilteredTasks() exactly per the rules above.
   Search matches title + description, case-insensitive. Filters: status, gateOnly, flaggedOnly.
2. Add AppState.launchFilter ({q:"",status:"",gateOnly:false,flaggedOnly:false}) and
   AppState.launchOpenCategories ({}).
3. Add LRC_PROMPT_CONFIG (repoNote, verifyLines) so no absolute paths or test-baseline numbers are
   hard-coded in generator code.
4. Add buildTaskPrompt(parts) producing sections in this order: "# title", "## Goal", "## Context",
   "## Steps", "## Constraints", "## Acceptance criteria", "## Report back", and, when parts.safety
   is true, "## Human sign-off". It must always append the constraint "Do not touch unrelated code,
   data or settings."
5. Add generatedTaskPrompt(task): uses manualSteps if present, otherwise one default step by
   executionType; sets safety for category child-safety-privacy-legal.
6. Add taskPromptFor(task): stored aiPrompt if non-empty after trim, else generatedTaskPrompt(task).
7. Add lintAiPrompt(text, task): empty text is valid; otherwise require the six headings, reject
   > 8000 chars, reject secret-shaped strings (JWTs, sk_live_/sk_test_, service_role assignments),
   and for safety tasks require a human review/sign-off sentence. Return an array of problem strings.

## Constraints
- All seven functions must be pure (no DOM, no network, no writes) except that the first three read
  db.list and AppState.
- Do not hard-code any absolute file path or test count in generator code.

## Acceptance criteria
- Add unit tests (or a /test group) covering: done-counting incl. not_applicable; level thresholds
  (0, 1, 5, 6 critical-incomplete; and one blocked); filter combinations; taskPromptFor returns the
  stored prompt when present and a lint-clean generated prompt otherwise; lintAiPrompt catches each
  problem type.
- node --check passes.

## Report back
Files changed, test names and results, anything not done.
```

**Verify:** `lintAiPrompt(generatedTaskPrompt(task), task)` returns `[]` for every seeded task.

---

### Step 4 — Route, nav entry and page header

**Goal:** the page exists, shows header, overall progress and the callout.
**Spec:** §1.1, §4.3.

Header text: `"<complete> of <total> tasks complete across <K> categories."` followed by `" Checks last run <time>."` or `" Checks have not been run yet."`. Callout: if `blocked || criticalIncomplete` → warning callout `"<n blocked task(s)> <n critical launch-gate task(s) remaining>"` (using `plural()`); otherwise the green callout `"No blocked or incomplete critical launch-gate tasks right now."`

**AI build prompt**

```text
# Step 4 - Launch Readiness route, nav entry and page header

## Goal
Render the top of the admin Launch Readiness page.

## Steps
1. Add the admin nav entries: a "Launch" heading with a rocket icon, then "Launch Readiness"
   (#/admin/launch-readiness, rocket icon) followed by the existing Test panel entry.
2. In the admin section router add: section === "launch-readiness" -> adminLaunchReadiness().
3. Create adminLaunchReadiness() returning a wrapper <div class="launch-page"> containing:
   a) eyebrow "Launch", h1.launch-page__title "Launch Readiness", and a meta line:
      "<complete> of <total> tasks complete across <categoryCount> categories." plus either
      " Checks last run <fmtDate(AppState.launchChecksRunAt, true)>." or " Checks have not been run yet."
   b) two buttons: "New task" (data-act="launch-new-task", plus icon) and "Run checks"
      (data-act="launch-run-checks", refresh-cw icon, primary style).
   c) "Overall progress" row with the percentage, and a .launch-progress-track with a
      .launch-progress-fill whose width is the percentage (class is-complete at 100%).
   d) a callout: warning style if summary.blocked or summary.criticalIncomplete, text built with
      plural(); otherwise the green .launch-callout--ok with "No blocked or incomplete critical
      launch-gate tasks right now."
4. Leave a clearly marked placeholder where the search/filters/categories will go.

## Constraints
- Escape all dynamic text with E(). Use launchStatusSummary() from Step 3; do not recompute.

## Acceptance criteria
- Navigating to #/admin/launch-readiness renders the header with correct counts.
- With 0 tasks, percentages are 0 (no divide-by-zero / NaN).
- node --check passes.

## Report back
Files changed and a screenshot description or DOM excerpt of the header.
```

**Verify:** change a seeded critical gate task to `complete` and confirm the callout and counts update on re-render.

---

### Step 5 — Category accordions and task rows

**Goal:** the main list. **Spec:** §1.1, §5 rules 8–9.

Task row structure (per task):

```text
.launch-task[.is-done]
  .row-between
    left:  checkbox.launch-task__check[data-act=launch-toggle-complete][data-id]
           chips: priority (if high/critical), executionType, "Launch gate", "Flagged"
           h4.launch-task__title[data-act=launch-toggle-details]  (chevron + title)
           p.launch-task__desc  (description)
           p.launch-task__desc  "Last check: <evidence>"  (only if autoDetection exists)
    right: icon buttons: copy prompt, flag, edit, delete   +  <select> status
  .launch-task__details  (hidden until .is-open)
     <ol> manualSteps (if any)
     .launch-prompt  (NEW: label + authored/generated badge + Copy button + <pre> prompt text)
     <textarea> notes   [data-act=launch-set-notes]
```

Category block: header button (chevron, icon, name + optional "(optional)", blurb, 70px mini progress, `done / total · pct%`), then `.launch-category__body` with the task rows. Open when a filter is active or `AppState.launchOpenCategories[id]`. Add `is-complete` at 100%.

**AI build prompt**

```text
# Step 5 - Category accordions and task rows (including the AI prompt panel)

## Goal
Render every category as an accordion of task rows.

## Steps
1. Inside adminLaunchReadiness(), build rows(list) producing, per task, the .launch-task markup
   described in the spec: complete checkbox (aria-label "Mark <title> as complete"), chips,
   expandable title, description, optional "Last check: <autoDetection.evidence>", row actions
   (copy prompt, flag, edit, delete - each an icon button with an aria-label) and a status <select>
   listing LAUNCH_STATUS_LABELS with the current one selected and aria-label "Status for <title>".
2. In .launch-task__details render: the manualSteps as an <ol> (if any); then the AI prompt panel;
   then a notes <textarea data-act="launch-set-notes" data-id>.
3. AI prompt panel: a header row with the label "AI prompt", a badge "Authored" when the task has a
   non-empty aiPrompt else "Generated", and a Copy button (data-act="launch-copy-prompt"); below it
   a <pre class="launch-prompt__text"> containing E(taskPromptFor(task)).
4. Build one .launch-category per LAUNCH_CATEGORIES entry: header button
   (data-act="launch-toggle-category" data-id), icon, name (+ " (optional)" when
   requiredForLaunch is false), blurb, a 70px progress bar and "<done> / <total> &middot; <pct>%".
   Progress counts ALL tasks in the category (isLaunchDone), never only filtered ones.
5. A category is open when any filter/search is active OR AppState.launchOpenCategories[id].
   When a filter is active, show only matching tasks and omit categories with none.
6. If a filter is active and nothing matches, render "No tasks match this search or filter."

## Constraints
- Escape everything with E(); the prompt text especially (it may contain < and &).
- Do not add new status values or fields.

## Acceptance criteria
- Done tasks show strikethrough title; complete and not_applicable both render as done.
- The prompt panel renders for every task, including ones with no stored aiPrompt.
- node --check passes.

## Report back
Files changed and which markup you verified in the DOM.
```

**Verify:** a task with `aiPrompt:""` shows a "Generated" badge and a lint-clean prompt; a task with a stored prompt shows "Authored".

---

### Step 6 — Search and filters

**Goal:** search box, status chips, gate/flag toggles, expand/collapse all.

```text
Search (type=search, id=launch-q, data-act=launch-search)
Chips:  [Everything] + one per status  (data-act=launch-filter-status, data-value="" | status)
        [Launch gate only]  [Flagged only]  (data-act=launch-filter-toggle, data-key=gateOnly|flaggedOnly)
Buttons: Expand all / Collapse all (data-act=launch-expand-all / launch-collapse-all)
Chips use aria-pressed="true|false".
```

**AI build prompt**

```text
# Step 6 - Search and filters for the Launch Readiness page

## Steps
1. Under the callout render: a labelled search input (id launch-q, type=search, value from
   AppState.launchFilter.q, placeholder "Search title or description", data-act="launch-search").
2. Render filter chips as <button type="button" class="launch-filter-chip" aria-pressed>:
   "Everything" (value "") then one per LAUNCH_STATUS_LABELS key (data-act="launch-filter-status",
   data-value). Then "Launch gate only" and "Flagged only"
   (data-act="launch-filter-toggle", data-key="gateOnly"/"flaggedOnly").
3. Render "Expand all" and "Collapse all" buttons (data-act="launch-expand-all"/"launch-collapse-all").
4. filterActive = q || status || gateOnly || flaggedOnly. Use it for the open/omit/empty-state rules
   from Step 5.

## Constraints
- Typing in search re-renders the page; focus and caret must survive (the wiring step handles
  restoreFocusAfter, but make the input id stable: launch-q).

## Acceptance criteria
- Each chip's aria-pressed matches AppState.launchFilter.
- node --check passes.

## Report back
Files changed.
```

---

### Step 7 — Task editor modal (includes the AI prompt field)

**Goal:** create and edit tasks. **Spec:** §3.1; addition A4.

Fields: Title (required), Description, Category (select), Priority (select), Execution type (select), Launch gate (checkbox), and **AI prompt** (monospace textarea, ~10 rows) with a **Fill from fields** button (`data-act="launch-prompt-fill"`) and a hint: *"Leave empty to use the generated prompt. A stored prompt must contain Goal, Context, Steps, Constraints, Acceptance criteria and Report back sections."*

Save behavior:
- Title required.
- If `aiPrompt` is non-empty, run `lintAiPrompt(text, taskFromFormValues)`. If problems exist, **do not save**; show `toast("AI prompt: " + problems.join("; "), "bad")`.
- New tasks are added with `{status:"not_started", notes:"", flaggedAt:null, autoCheck:null, manualSteps:[]}` plus the form patch (audited `db.add`); existing tasks use audited `db.update`.
- **Fill from fields** reads the *current* (unsaved) form values, builds a task-shaped object, and writes `generatedTaskPrompt(thatTask)` into the textarea. It never saves.

**AI build prompt**

```text
# Step 7 - Task editor modal with an AI prompt field

## Goal
Add a create/edit modal for launch tasks, including authoring the task's AI prompt.

## Steps
1. Create launchTaskFormHTML(existing). Title "New task" or "Edit task". Form
   data-act="save-launch-task" data-id=<id or empty>. Fields (each with a <label for>): Title
   (required), Description (textarea), Category (select of LAUNCH_CATEGORIES), Priority
   (low/medium/high/critical), Execution type (code/manual/review), a Launch gate checkbox, and
   "AI prompt" (textarea name="aiPrompt", id lt-prompt, rows 10, monospace) with a hint and a
   "Fill from fields" button (type="button", data-act="launch-prompt-fill").
2. Defaults for a new task: first category, priority "medium", executionType "manual",
   launchGate false, empty aiPrompt.
3. Implement the "save-launch-task" submit branch: trim the title (toast "Add a title." when empty).
   Build the patch {title, description, categoryId, priority, executionType, launchGate, aiPrompt}.
   If aiPrompt is non-empty, run lintAiPrompt(aiPrompt, patch-as-task); when it returns problems,
   do NOT save - toast "AI prompt: <problems joined by '; '>" with the "bad" style and keep the
   modal open. Otherwise: existing id -> await db.update("launchReadiness", id, patch); no id ->
   await db.add("launchReadiness", Object.assign({status:"not_started", notes:"", flaggedAt:null,
   autoCheck:null, manualSteps:[]}, patch)). Close the modal, toast "Task updated"/"Task added",
   rerender.
4. Implement the click action "launch-prompt-fill": read title, description, categoryId, priority,
   executionType, launchGate from the open form, keep the existing task's manualSteps when editing,
   write generatedTaskPrompt(thatObject) into #lt-prompt. Do not save or close.

## Constraints
- A stored aiPrompt is optional; empty means "use the generated fallback".
- Never log or echo the prompt text anywhere except the textarea and the details panel.

## Acceptance criteria
- Creating a task without a prompt works; its details panel shows a Generated badge.
- Pasting a prompt missing "## Acceptance criteria" blocks the save with a clear toast.
- A safety-category prompt without a human-sign-off sentence blocks the save.
- "Fill from fields" output always passes lintAiPrompt.
- node --check passes.

## Report back
Files changed and the three negative cases you tested.
```

---

### Step 8 — Action wiring

**Goal:** every control does something. **Spec:** table below.

| `data-act` | Element | Event | Behavior | Audit |
|---|---|---|---|---|
| `launch-toggle-complete` | checkbox | change | `status = checked ? "complete" : "not_started"`; rerender | silent |
| `launch-set-status` | select | change | `status = value`; rerender | silent |
| `launch-set-notes` | textarea | change | `notes = value`; **no** rerender | silent |
| `launch-toggle-flag` | button | click | `flaggedAt = flaggedAt ? null : nowISO()`; rerender | silent |
| `launch-toggle-details` | h4 | click | toggle `.is-open` on the closest `.launch-task` (DOM only) | – |
| `launch-toggle-category` | button | click | flip `AppState.launchOpenCategories[id]`; rerender | – |
| `launch-expand-all` / `launch-collapse-all` | button | click | set every category open/closed; rerender | – |
| `launch-filter-status` | chip | click | `AppState.launchFilter.status = data-value`; rerender | – |
| `launch-filter-toggle` | chip | click | flip `launchFilter[data-key]`; rerender | – |
| `launch-search` | input | input | `launchFilter.q = value`; `restoreFocusAfter(rerender, "#launch-q")` | – |
| `launch-new-task` | button | click | open editor modal (empty) | – |
| `launch-edit-task` | button | click | open editor modal for the record | – |
| `save-launch-task` | form | submit | Step 7 | audited |
| `launch-prompt-fill` | button | click | Step 7 | – |
| `launch-delete-task` | button | click | `confirmDelete(title, async () => { await db.remove(...); closeModal(); toast("Task deleted"); rerender(); })` | audited |
| `launch-copy-prompt` | button | click | copy `taskPromptFor(record)` to the clipboard, toast "Prompt copied"; fall back to `fallbackCopy(text, done)` when the Clipboard API is unavailable or rejects | – |
| `launch-run-checks` | button | click | toast "Running launch checks..."; `await runLaunchChecks()`; toast "Checks updated"; rerender | silent |

**AI build prompt**

```text
# Step 8 - Wire every Launch Readiness control

## Goal
Make every data-act on the Launch Readiness page work, per the action table.

## Steps
1. Click actions (add to the ACTIONS object): launch-toggle-flag, launch-toggle-details,
   launch-toggle-category, launch-expand-all, launch-collapse-all, launch-filter-status,
   launch-filter-toggle, launch-new-task, launch-edit-task, launch-delete-task,
   launch-copy-prompt, launch-prompt-fill, launch-run-checks.
2. Change handler branches: launch-toggle-complete (checkbox), launch-set-status (select),
   launch-set-notes (textarea; update silently and do NOT rerender, so typing is not interrupted).
3. Input handler branch: launch-search -> update AppState.launchFilter.q, then
   restoreFocusAfter(() => rerender(), "#launch-q").
4. Submit handler branch: save-launch-task (from Step 7).
5. All status/notes/flag writes call db.update("launchReadiness", id, patch, true) (silent).
   Wrap awaited writes in try/catch and return quietly on failure (db already toasts the error).
6. launch-copy-prompt copies taskPromptFor(record) via navigator.clipboard.writeText, falling back to
   the existing fallbackCopy helper; toast "Prompt copied" on success.
7. launch-delete-task must go through confirmDelete(rec.title, ...).

## Constraints
- Do not introduce new event listeners; use the existing delegated handlers.
- Unchecking the complete checkbox sets status "not_started".

## Acceptance criteria
- Each row in the action table can be exercised in the browser with the described result.
- Typing in a notes textarea never loses focus; typing in search keeps focus and caret.
- Deleting a task asks for confirmation and writes an audit entry.
- node --check passes.

## Report back
Files changed and a pass/fail line for each action in the table.
```

---

### Step 9 — Auto-check engine

**Goal:** "Run checks" evaluates `autoCheck` keys and records evidence. **Spec:** §5 rules 4–6.

Contract: each entry of `LAUNCH_CHECKS` is a function (sync or async) returning `{ status: "complete" | "needs_review", evidence: string }`.

```js
function testResult(names){            // reuse /test results instead of re-implementing checks
  const run = AppState.lastTestRun;
  if (!run) return { status:"needs_review", evidence:"Run /test first, then \"Run checks\" here." };
  const list = Array.isArray(names) ? names : [names];
  const rows = list.map(n => run.results.find(r => r.name === n)).filter(Boolean);
  if (rows.length < list.length)
    return { status:"needs_review", evidence:"Could not find a matching /test check - it may have been renamed." };
  const allPass = rows.every(r => r.result === "pass" || r.result === "skip");
  return { status: allPass ? "complete" : "needs_review",
           evidence: rows.map(r => r.name + ": " + r.result).join("; ") };
}

async function runLaunchChecks(){
  const tasks = db.list("launchReadiness").filter(t => t.autoCheck && LAUNCH_CHECKS[t.autoCheck]);
  for (const t of tasks){
    let result;
    try { result = await LAUNCH_CHECKS[t.autoCheck](); }
    catch (err){ result = { status:"needs_review", evidence:"Check threw: " + err.message }; }
    const capped = (t.categoryId === "child-safety-privacy-legal" && result.status === "complete")
      ? "needs_review" : result.status;
    const nextStatus = (t.status === "not_started")
      ? (capped === "complete" ? "complete" : "needs_review")
      : t.status;
    await db.update("launchReadiness", t.id, {
      autoDetection: { status: capped, evidence: result.evidence, checkedAt: nowISO() },
      status: nextStatus
    }, true);
  }
  AppState.launchChecksRunAt = nowISO();
}
```

Start with a few checks and grow. The original has 26. Typical kinds: *reminders* that cannot run in a browser (`node --check`), *source scans* (fetch the page source and count a pattern; keep the evidence text from containing the pattern itself), *live-state checks* (compare on-screen counts with data), *behavioral probes* (e.g. attempt an anonymous read that must return nothing), and *test-suite bridges* (`testResult([...])`).

**AI build prompt**

```text
# Step 9 - Launch Readiness auto-check engine

## Goal
Let "Run checks" evaluate tasks that have an autoCheck key and record evidence, without ever
overruling a human or auto-completing a safety task.

## Steps
1. Add testResult(names) (bridges to AppState.lastTestRun) exactly as specified: no run -> needs_review
   with "Run /test first..."; missing check names -> needs_review "may have been renamed"; all
   pass/skip -> complete; evidence is "name: result; ...".
2. Add const LAUNCH_CHECKS = { ... } with FOUR starter checks:
   a) nodeCheckReminder: always needs_review ("node --check must be run from a terminal...").
   b) noDebugLogs: fetch location.pathname as text, count a debug-logging pattern built by string
      concatenation (so this source never contains the literal pattern), complete when 0.
   c) testSuiteBaseline: needs_review if no /test run yet; else complete when there are 0 FAILED
      blocking results.
   d) one test-suite bridge using testResult([...]) for a check that already exists in your /test suite.
3. Add async runLaunchChecks() exactly per the spec: for each task with a known autoCheck, run it
   (try/catch -> needs_review "Check threw: ..."); cap category child-safety-privacy-legal at
   needs_review; write autoDetection {status, evidence, checkedAt} and change `status` ONLY when the
   task is currently "not_started" (to complete, or needs_review when not passing); all writes silent.
   Finally set AppState.launchChecksRunAt = nowISO().
4. Make the page show "Last check: <evidence>" on rows that have autoDetection (Step 5 markup).

## Constraints
- Never change status of a task whose status is not "not_started".
- A check must never write data, send network requests other than reads, or take > a few seconds.

## Acceptance criteria
- A safety-category task whose check returns complete ends up needs_review.
- A task manually set to in_progress keeps in_progress after Run checks but gets fresh evidence.
- A check that throws produces needs_review with the error message, and other checks still run.
- node --check passes.

## Report back
Files changed and the three behaviors above verified.
```

---

### Step 10 — Dashboard integration

**Goal:** surface readiness where admins look first. **Spec:**

- **Dashboard hero tile** "Launch readiness": big `N%`, a progress bar (minimum 2% width so it is visible), and `"<done> of <total> checklist items"`. The hero also has a button linking to `#/admin/launch-readiness`. Headline logic: if nothing needs attention and `pct >= 90` → "Your site is operating steadily."
- **Ops digest row** "Launch checklist": a badge (good style at 100%), `"<done> of <total> tasks marked complete"`, a progress bar and the percentage in mono type.
- Percentage = `total ? Math.round(done / total * 100) : 0` where `done` counts `complete` only (matching the original dashboard) — note this differs from the page's own counting (which also counts `not_applicable`). **Decide once and keep both consistent;** the recommended choice is to use `isLaunchDone` everywhere. The original uses `complete` only on the dashboard; preserve that if you want a faithful copy, otherwise unify.

**AI build prompt**

```text
# Step 10 - Dashboard hooks for Launch Readiness

## Goal
Show launch readiness on the admin dashboard.

## Steps
1. Compute lrc = db.list("launchReadiness"), lrcDone, lrcPct (0 when empty) in the dashboard hero
   builder and in the ops-digest builder. Use isLaunchDone for lrcDone so the dashboard agrees with
   the Launch Readiness page.
2. Hero: add a tile "Launch readiness" with the big percentage, a progress bar (min width 2%) and
   "<done> of <total> checklist items"; add an admin button "Launch Readiness" linking to
   #/admin/launch-readiness; make the hero headline "Your site is operating steadily." only when no
   items need attention AND lrcPct >= 90.
3. Ops digest: add a "Launch checklist" row with a rocket/list-checks icon badge (good style at 100%),
   "<done> of <total> tasks marked complete", a progress bar and the mono percentage.

## Constraints
- Reuse existing dashboard card/row markup and admin-* classes; no new CSS beyond Step 11.
- Escape dynamic text.

## Acceptance criteria
- Dashboard % equals the Launch Readiness page's overall %.
- Empty collection renders 0% with no errors.
- node --check passes.

## Report back
Files changed.
```

---

### Step 11 — Styling

All classes are prefixed `launch-` and use the admin design tokens (`--admin-surface`, `--admin-surface-2`, `--admin-border`, `--admin-ink`, `--admin-mute`, `--admin-faint`, `--admin-accent`, `--admin-good(-soft)`, `--admin-warn(-soft|-ink)`, `--admin-bad(-soft)`, `--admin-neutral-soft`, `--admin-teal(-soft)`, `--admin-info`, and the three admin font variables).

```css
.launch-page{ font-family:var(--admin-font-body); color:var(--admin-ink); }
.launch-page__title{ font-family:var(--admin-font-display); text-transform:uppercase; margin:0; font-size:1.4rem; font-weight:700; }
.launch-page__eyebrow{ font-family:var(--admin-font-mono); font-size:.7rem; letter-spacing:.1em; text-transform:uppercase; color:var(--admin-faint); }
.launch-page__meta{ margin:4px 0 0; font-size:.84rem; color:var(--admin-mute); }
.launch-btn{ display:inline-flex; align-items:center; gap:7px; background:var(--admin-surface); border:1px solid var(--admin-border); color:var(--admin-ink); border-radius:8px; padding:8px 14px; font-weight:600; cursor:pointer; white-space:nowrap; }
.launch-btn--primary{ background:var(--admin-accent); border-color:var(--admin-accent); color:#fff; }
.launch-btn--icon{ padding:7px; }
.launch-chip{ display:inline-flex; align-items:center; gap:5px; font-family:var(--admin-font-mono); font-size:.68rem; font-weight:600; padding:3px 9px; border-radius:100px; background:var(--admin-neutral-soft); color:var(--admin-mute); }
.launch-chip--critical,.launch-chip--high{ background:var(--admin-bad-soft); color:var(--admin-bad); }
.launch-chip--gate{ background:var(--admin-ink); color:#fff; }
.launch-chip--flag{ background:var(--admin-warn-soft); color:var(--admin-warn); }
.launch-input,.launch-select,.launch-textarea{ background:var(--admin-surface); border:1px solid var(--admin-border); border-radius:8px; padding:9px 12px; font-size:.88rem; color:var(--admin-ink); width:100%; }
.launch-input:focus,.launch-select:focus,.launch-textarea:focus{ outline:2px solid var(--admin-accent); outline-offset:1px; }
.launch-field{ display:flex; flex-direction:column; gap:6px; }
.launch-field label{ font-size:.72rem; font-weight:700; color:var(--admin-mute); text-transform:uppercase; letter-spacing:.05em; }
.launch-filter-chip{ display:inline-flex; padding:6px 13px; border-radius:100px; border:1px solid var(--admin-border); background:var(--admin-surface); color:var(--admin-mute); font-size:.78rem; font-weight:600; cursor:pointer; }
.launch-filter-chip[aria-pressed="true"]{ background:var(--admin-ink); color:#fff; border-color:var(--admin-ink); }
.launch-callout{ display:flex; gap:10px; padding:12px 15px; border-radius:10px; font-size:.84rem; background:var(--admin-warn-soft); color:var(--admin-warn-ink); }
.launch-callout--ok{ background:var(--admin-good-soft); color:var(--admin-good); }
.launch-progress-track{ height:6px; border-radius:4px; background:var(--admin-surface-2); border:1px solid var(--admin-border); overflow:hidden; }
.launch-progress-fill{ height:100%; background:linear-gradient(90deg, var(--admin-accent), var(--admin-info)); }
.launch-progress-fill.is-complete{ background:var(--admin-good); }
.launch-category{ background:var(--admin-surface); border:1px solid var(--admin-border); border-radius:10px; overflow:hidden; }
.launch-category.is-complete{ background:linear-gradient(135deg, var(--admin-surface) 0%, var(--admin-good-soft) 140%); }
.launch-category__head{ display:flex; align-items:center; gap:10px; width:100%; padding:13px 15px; background:none; border:none; cursor:pointer; text-align:left; }
.launch-category__chev{ width:15px; height:15px; transition:transform .15s; opacity:.5; }
.launch-category.is-open .launch-category__chev{ transform:rotate(90deg); }
.launch-category__body{ display:none; padding:8px 15px 13px; }
.launch-category.is-open .launch-category__body{ display:block; }
.launch-task{ background:var(--admin-surface); border:1px solid var(--admin-border); border-radius:8px; padding:10px 11px; margin-bottom:7px; }
.launch-task__details{ display:none; }
.launch-task.is-open .launch-task__details{ display:block; }
.launch-task__title{ margin:0 0 3px; cursor:pointer; display:flex; align-items:center; gap:5px; font-size:.87rem; font-weight:700; }
.launch-task__chev{ width:14px; height:14px; transition:transform .15s; opacity:.5; }
.launch-task.is-open .launch-task__chev{ transform:rotate(90deg); }
.launch-task__desc{ font-size:.78rem; color:var(--admin-mute); }
.launch-task__check{ width:16px; height:16px; accent-color:var(--admin-good); cursor:pointer; }
.launch-task.is-done{ background:var(--admin-surface-2); }
.launch-task.is-done .launch-task__title{ text-decoration:line-through; color:var(--admin-mute); }

/* NEW: AI prompt panel */
.launch-prompt{ margin:0 0 8px; }
.launch-prompt__text{ white-space:pre-wrap; font-family:var(--admin-font-mono); font-size:.74rem; line-height:1.5; max-height:220px; overflow:auto; background:var(--admin-surface-2); border:1px solid var(--admin-border); border-radius:8px; padding:10px 12px; margin:6px 0 0; }
```

**AI build prompt**

```text
# Step 11 - Launch Readiness styling

## Goal
Add the CSS for the Launch Readiness page using the existing admin design tokens only.

## Steps
1. Add the launch-* rule set from the spec to the admin stylesheet section.
2. Add the new .launch-prompt and .launch-prompt__text rules (pre-wrap monospace, max-height 220px
   with overflow auto, surface-2 background, 1px border, 8px radius).
3. Verify focus outlines are visible on inputs, selects, textareas and buttons, and that text meets
   WCAG AA contrast in both the done and not-done row states.

## Constraints
- Use only existing --admin-* variables. No new colors, fonts or libraries.
- Do not modify any non-launch selector.

## Acceptance criteria
- Page matches the spec visually at desktop and phone widths (accordion header text truncates with
  an ellipsis rather than wrapping; row actions wrap under the title on narrow screens).
- node --check passes (CSS lives in a <style> block; check that it still parses in the page).

## Report back
Files changed and which breakpoints you checked.
```

---

### Step 12 — Seed tasks and prompts (the bulk authoring step)

**Goal:** populate the checklist, with an authored prompt on every task.

1. Author tasks per category using `T(...)`, each with an `autoCheck` when a deterministic check exists, `manualSteps` for human tasks, and `launchGate:true` for anything that blocks release.
2. Author each task's `aiPrompt` through `buildTaskPrompt({...})` so the format is uniform (Section 7). Section 8 has one worked example per category.
3. Seed to Supabase with your seed script (`launchReadiness` → `launch_readiness`), then verify the row count.

How a seeded task looks (the worked example from Section 8, category 1):

```js
T("pf-1", "node --check passes on every inline script",
  "Extract every <script> block from index.html (and each games/*.html file), concatenate, and run node --check.",
  "project-foundation", "critical", "code", true, {
    autoCheck: "nodeCheckReminder",
    aiPrompt: buildTaskPrompt({
      title: "node --check passes on every inline script",
      goal: "Every inline <script> block in index.html and games/*.html parses with node --check.",
      context: "The site is a single-file SPA; one syntax error blanks the whole app. The browser cannot run node --check, so this task is a terminal verification.",
      steps: [
        "Write a throwaway Node script (outside the repo) that reads each file, extracts every non-module <script> block, and writes each to a temp file.",
        "Run node --check on every temp file and record the exit code per file/block.",
        "Fix only genuine syntax errors, in the file where they occur.",
        "Delete the temp files."
      ],
      constraints: ["Do not reformat or refactor code while fixing syntax.", "Ignore non-JavaScript script types such as application/ld+json."],
      acceptance: ["Every extracted script block exits 0.", "Any file you edited is listed with the exact line changed."]
    })
  });
```

**AI build prompt (authoring)**

```text
# Step 12 - Author the seed tasks and their AI prompts

## Goal
Populate seedLaunchReadiness() with real tasks for this product, each with an authored aiPrompt.

## Inputs you must use
- LAUNCH_CATEGORIES (14 categories) and the prompt standard in the "AI prompt standard" section.
- The product's own code, /test suite, issue list and docs. Every task must name a REAL file,
  function, check or behavior from this repository; no generic filler.

## Steps
1. For each category write 3-8 tasks. Per task provide: id (category prefix + number), title that is
   one verifiable outcome, description (why + what exists + exact names), priority, executionType,
   launchGate, optional autoCheck (must be a key of LAUNCH_CHECKS), optional manualSteps (3-6
   imperative steps for human tasks).
2. For every task author aiPrompt with buildTaskPrompt({title, goal, context, steps, constraints,
   acceptance, report, safety}). Steps must be imperative and individually verifiable. Acceptance
   criteria must be binary. For category child-safety-privacy-legal set safety:true.
3. Where a task is covered by a /test check, the prompt's steps must say to run that check and quote
   its name in the acceptance criteria.
4. Run lintAiPrompt over every authored prompt and fix every problem it reports.
5. Seed the table with the existing seed script and confirm the row count matches the array length.

## Constraints
- Do not invent facts about the product. If you cannot find evidence for a claim, say so in the
  task's description instead of guessing.
- No secrets, keys or personal data in any prompt.
- Do not mark any task complete or not_applicable in the seed; status stays "not_started".

## Acceptance criteria
- 100% of seeded tasks have a lint-clean aiPrompt.
- No two tasks share an id; every categoryId is valid; every autoCheck key exists.
- node --check passes.

## Report back
Counts per category, any task you could not ground in the repository, and the lint results.
```

**Backfill meta-prompt** (use when tasks already exist without prompts, e.g. migrating the original 110):

```text
# Backfill - add an authored AI prompt to every existing launch task

## Goal
Every task in seedLaunchReadiness() (and every row in the launch_readiness table) has a lint-clean
aiPrompt, without changing any other field.

## Steps
1. Enumerate all tasks missing aiPrompt (aiPrompt empty or absent).
2. For each, author a prompt with buildTaskPrompt using ONLY that task's title, description,
   manualSteps, category, executionType, priority, launchGate and autoCheck. If the description
   names a /test check, reproduce its exact name in the steps and acceptance criteria. For
   child-safety-privacy-legal tasks set safety:true.
3. Output the result as a patch that adds `aiPrompt` to each seed entry; for live rows output an
   idempotent UPDATE or a one-off script that merges {aiPrompt} into data jsonb. Do NOT run it.
4. Run lintAiPrompt on every generated prompt; fix and re-run until zero problems.

## Constraints
- Do not change title, description, status, notes, flags, steps, priority or any other field.
- Do not execute SQL or writes; produce them for human review.

## Acceptance criteria
- Zero tasks without aiPrompt after applying the patch; zero lint problems.
- The diff touches only aiPrompt lines (and the helper import, if needed).

## Report back
Counts (updated / skipped), skipped task ids with reasons, and the lint summary.
```

---

### Step 13 — Verification suite

Add a "Launch Readiness" group to your self-test panel (the original has a `/test` panel whose results the auto-checks reuse). Suggested cases:

| Case | Blocking |
|---|---|
| Done counting treats `complete` and `not_applicable` as done | yes |
| `launchStatusSummary` level is green at 0, amber at 1–5, red at 6 critical incomplete, red with any blocked gate task | yes |
| Every task's `categoryId` exists; every `autoCheck` key exists in `LAUNCH_CHECKS` | yes |
| Safety-category task with a passing check ends `needs_review` after `runLaunchChecks` | yes |
| A non-`not_started` task keeps its status after `runLaunchChecks` | yes |
| Filters: search + status + gate + flag combine with AND | yes |
| **Every launch task resolves to a prompt, and every stored prompt passes `lintAiPrompt`** | no (non-blocking, so adding a task in the UI never fails the suite) |
| Task editor blocks a malformed stored prompt | yes |

Run mutating cases against a disposable mock `db` (as the original does), never the live database.

**AI build prompt**

```text
# Step 13 - Launch Readiness verification suite

## Goal
Add automated checks that lock in the checklist's rules, including the AI-prompt invariant.

## Steps
1. Add a "Launch Readiness" group to the self-test suite with the cases in the spec table.
2. Mutating cases (runLaunchChecks, editor save) must run against the disposable mock db, never the
   real one. Read-only cases may use the real hydrated cache.
3. The case "Every launch task resolves to a prompt and every stored prompt passes lintAiPrompt"
   must be NON-blocking and must list the offending task ids in its failure detail.
4. Run the whole suite and report pass/fail counts.

## Constraints
- Do not modify existing tests. Do not make any test depend on network access.

## Acceptance criteria
- All blocking cases pass; the prompt-invariant case passes on the seeded data.
- Deliberately corrupting one stored prompt (remove "## Steps") makes only the non-blocking case fail.
- node --check passes.

## Report back
Suite totals and the deliberate-failure experiment's result.
```

---

## 7. The AI prompt standard (what makes a task prompt "to specification")

Every `aiPrompt` — authored or generated — must satisfy this standard. `lintAiPrompt` enforces the structural parts; reviewers enforce the rest.

### 7.1 Anatomy

```text
# <Task title>

## Goal
One sentence. The outcome, not the activity. Verifiable.

## Context
Why it matters; what already exists; exact file, function, check and issue names.
The repository note (stack and conventions).

## Steps
1. Imperative, individually verifiable actions in the order to perform them.

## Constraints
- Scope fences: what NOT to touch. Stack rules (no new dependencies). Safety rules.
- Always: "Do not touch unrelated code, data or settings."

## Acceptance criteria
- Binary, checkable statements. Include the exact command or check name that proves each one.

## Report back
What to return: files changed, evidence for each criterion, anything not done.

## Human sign-off          (required for child-safety-privacy-legal tasks)
Do not mark complete from code alone; report findings and stop for human review.
```

### 7.2 Authoring rules

1. **One task, one outcome.** If the prompt needs "and", split the task.
2. **Name real things.** File paths, function names, /test check names, issue ids. No "the relevant file".
3. **Imperative, verifiable steps.** "Run X and record the exit code" beats "make sure X works".
4. **Binary acceptance.** A reader must be able to answer yes/no without judgment calls.
5. **State the fences.** Say what must not change, and what requires asking first (destructive commands, production data, spending money, rotating credentials).
6. **No secrets, ever.** Never paste keys, tokens, passwords or personal data into a prompt. The linter rejects secret-shaped strings.
7. **Human tasks stay human.** For `manual`/`review` tasks, the prompt directs the AI to *prepare, check and report* — not to claim the human step is done.
8. **Safety tasks stop at a human.** Prompts in `child-safety-privacy-legal` must demand human sign-off; auto-checks cap them at `needs_review`.
9. **Reports are evidence, not assurances.** Require quoting output, check names or line references.
10. **Keep it under ~8,000 characters.** Split large tasks.

### 7.3 Prompt review checklist (reviewer ticks all)

- [ ] Goal is one verifiable sentence.
- [ ] Every named file/function/check exists today.
- [ ] Each step can be performed and checked on its own.
- [ ] Each acceptance criterion is binary and names its proof.
- [ ] Scope fences and "ask first" conditions are explicit.
- [ ] No secrets or personal data.
- [ ] Human sign-off present where required.
- [ ] Report format demands evidence.
- [ ] `lintAiPrompt` returns zero problems.

### 7.4 Why generated fallbacks exist

A task added through the UI in a hurry should not have *no* prompt. `generatedTaskPrompt` produces a lint-clean, safe-by-default prompt from the task's own fields, so the copy button always works. The "Authored/Generated" badge tells reviewers which tasks still deserve a hand-written prompt.

---

## 8. Worked examples — one authored prompt per category

Each example lists the task fields, then the exact `aiPrompt` text. They are drawn from tasks in the original checklist. Replace the project-specific names when you apply them to another product.

### 8.1 Project Foundation — `pf-1`

| priority | type | gate | autoCheck |
|---|---|---|---|
| critical | code | yes | `nodeCheckReminder` |

```text
# node --check passes on every inline script

## Goal
Every inline <script> block in index.html and games/*.html parses with node --check.

## Context
The site is a single-file SPA; one syntax error blanks the whole app. A browser cannot run
node --check, so this is a terminal verification. Repository: single index.html (vanilla JS, no build
step) plus games/*.html and supabase/ scripts. Inspect existing conventions before changing anything.

## Steps
1. Write a throwaway Node script outside the repo that reads each file, extracts every non-module
   <script> block, and writes each to a temp file.
2. Run node --check on every temp file; record the exit code per file and block.
3. Fix only genuine syntax errors, in the file where they occur.
4. Delete the temp files.

## Constraints
- Do not reformat or refactor while fixing syntax.
- Ignore non-JavaScript script types such as application/ld+json.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- Every extracted script block exits 0.
- Any edited file is listed with the exact line changed.

## Report back
Per-file exit codes, files changed, and anything you did not do.
```

### 8.2 Brand & Creative Direction — `bc-2`

| priority | type | gate | manualSteps |
|---|---|---|---|
| high | manual | yes | open the site and confirm the tab icon; confirm the header logo loads on every page; confirm the manifest and social-preview image are current |

```text
# Favicon, app icons, and social share image are set

## Goal
The browser tab icon, header logo, install icon and social-preview image are all present, current and load.

## Context
Brand assets live under assets/brand/. The header logo is assets/brand/logo.webp. A manifest and a
social preview image may exist; confirm rather than assume. Repository: single index.html SPA.

## Steps
1. Serve the site locally and open the homepage; note the tab icon.
2. Visit Home, Create, Watch, Shop and Admin; confirm the header logo renders on each.
3. Locate the web app manifest and the og:image URL in the page head; request each URL and record
   the HTTP status and image dimensions.
4. List every missing, stale (old brand) or 404 asset with its file path.

## Constraints
- Report findings only; do not replace brand artwork or invent new assets.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- A table of asset, URL, status, dimensions, verdict (ok / stale / missing) covering icon, logo,
  manifest icons and social image.
- Every "stale" or "missing" row names the file a human must replace.

## Report back
The table, plus which items need a human to supply new artwork.
```

### 8.3 Site Structure & Navigation — `nav-1`

| priority | type | gate | autoCheck |
|---|---|---|---|
| critical | code | yes | `testSuiteSiteMap` |

```text
# Main navigation and footer links all resolve

## Goal
Every main-navigation and footer link resolves to a page that exists, in both routing modes.

## Context
The /test suite already checks this: "Every footer link points at a page that exists" and "Rendered
links match the routing mode". Routes are defined by parseRoute()/renderRoute(). Keep both checks passing.

## Steps
1. Run the /test suite and record the result of the two named checks.
2. If either fails, list each broken link (label, href, expected route) from the failure detail.
3. Fix each broken link at its source (the nav/footer array), or add the missing route; never
   special-case the test.
4. Re-run /test and record the results again.

## Constraints
- Do not delete a page to make a link resolve. Do not edit the test to make it pass.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- "Every footer link points at a page that exists": pass.
- "Rendered links match the routing mode": pass.
- No previously passing /test check regressed.

## Report back
Before/after results for both checks and each link you fixed.
```

### 8.4 Homepage & Core Pages — `hp-1`

| priority | type | gate | autoCheck |
|---|---|---|---|
| medium | code | no | `heroStatsAreDynamic` |

```text
# Hero stats are accurate and dynamic, not hand-typed

## Goal
The homepage hero's counts (activities, games, episodes) are computed from published records, never hard-coded.

## Context
Counts come from publishedActivities().length and published games/videos. The auto-check
heroStatsAreDynamic compares on-screen hero text with the live counts, so the homepage must be on
screen when it runs.

## Steps
1. Find where the hero stats are rendered and confirm each number is computed from db data.
2. Replace any literal number with the computed value.
3. Publish and unpublish one record in a scratch environment and confirm the hero updates.
4. Open the homepage, then run "Run checks" and read the evidence line.

## Constraints
- Do not change what counts as "published". Do not touch the hero layout or copy.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- No hard-coded stat numbers remain in the hero source.
- heroStatsAreDynamic evidence reports matching live counts.

## Report back
The lines changed and the evidence string.
```

### 8.5 Stories, Characters & Content — `content-2`

| priority | type | gate |
|---|---|---|
| high | review | yes |

```text
# Video descriptions match their actual video content

## Goal
For every published video, the description summarizes the linked YouTube video's actual content.

## Context
videos[].youtubeId links each record to its video. Episode 6 once shipped with a description for the
wrong plot, so this is a systemic check, not a one-off. This is a content-accuracy review.

## Steps
1. List every published video (title, episode, youtubeId).
2. For each, open the video and read its description side by side; note any mismatch in plot,
   characters or learning idea.
3. Record each mismatch with the video id and the specific wrong claim.
4. Propose corrected wording for each mismatch but do not publish changes.

## Constraints
- Review and propose only; a content owner approves any wording change.
- Do not watch-and-guess: if a video is unavailable, say so rather than inferring its content.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- Every published video has a verdict: matches / mismatch / could not verify.
- Every mismatch lists the exact sentence and a proposed fix.

## Report back
The verdict table and proposed corrections.
```

### 8.6 Activities, Games & Interactions — `games-4`

| priority | type | gate | manualSteps |
|---|---|---|---|
| medium | manual | no | play each physics game for a few minutes; watch for an AI or ball becoming permanently stuck |

```text
# Game physics/AI edge cases don't get the player or AI stuck

## Goal
No physics-based game leaves the player or AI permanently stuck against an edge or corner.

## Context
A past bug: the Air Hockey AI camped a corner defending a puck at rest. The class of bug is "an
object at rest treated as active". Games live in games/*.html.

## Steps
1. Play each physics game (Air Hockey, Ballinko, DropBlox) for at least three minutes.
2. Deliberately create edge cases: let an object come to rest in a corner, stall the puck, pause
   and resume.
3. Note any state where a paddle, AI or ball stops responding for more than five seconds.
4. For each, record the game, the steps to reproduce and a console screenshot or error text.

## Constraints
- Report reproductions only; do not change game physics in this task.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- Each game has a verdict: no stuck state found / stuck state found (with reproduction).
- Every stuck state includes exact reproduction steps.

## Report back
Verdicts and reproductions.
```

### 8.7 Video, Media & Assets — `media-1`

| priority | type | gate | autoCheck |
|---|---|---|---|
| critical | code | yes | `testSuiteImageAlt` |

```text
# Every image has alt text

## Goal
Every media reference and rendered <img> carries alt text, and every referenced image file loads.

## Context
Covered by three /test checks: "Every media reference has alt text", "Every image element in the
rendered interface has an alt attribute", "Every referenced image file actually loads". Decorative
images use alt="" deliberately; informative images need a specific description.

## Steps
1. Run /test and record the three named checks.
2. For each failing item, locate the record or template that renders it.
3. Add specific alt text for informative images (describe what is shown, not "image" or "photo");
   use alt="" only for purely decorative images.
4. Fix or remove references to image files that 404.
5. Re-run /test.

## Constraints
- Do not use filenames or generic words as alt text.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- All three named /test checks pass.
- No alt text is empty on an informative image.

## Report back
Before/after results and each alt text you added.
```

### 8.8 Child Safety, Privacy & Legal — `safety-1`

| priority | type | gate | autoCheck | manualSteps |
|---|---|---|---|---|
| critical | review | yes | `complianceProfilesLockdown` | list every form and data flow; read the live Privacy page against each; note whether qualified legal review is still needed |

```text
# Privacy policy matches actual data practices

## Goal
Produce an evidence-based comparison of the Privacy page against every real data flow, for a human to review.

## Context
Data flows include the newsletter form, the Grown-Ups contact form, the business inquiry form, the
report-a-problem form, admin accounts and the Supabase database itself. The Privacy page text
(viewPrivacy / the saved Privacy page record) must describe each accurately. This is a legal-adjacent
review: you prepare findings; a human decides.

## Steps
1. Enumerate every form and every place the app reads or writes personal data (fields collected,
   where stored, who can read it, retention).
2. Read the live Privacy page text and map each data flow to the sentence that discloses it.
3. List every data flow with no disclosure and every disclosure with no matching data flow.
4. Run the "Run checks" auto-check complianceProfilesLockdown and quote its evidence.
5. State whether qualified legal review (for example child-privacy law applicability) is still needed.

## Constraints
- Do not edit the Privacy page or any legal text; report only.
- Do not mark this task complete.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- A table of data flow, fields, storage, disclosed? (yes/no), disclosing sentence.
- The auto-check evidence is quoted verbatim.
- An explicit statement of whether legal review is still required.

## Report back
The table, the evidence and your recommendation, then stop.

## Human sign-off
This is a Child Safety / Privacy / Legal task. Do not mark it complete from code or documents alone:
report your findings and stop so a human can review and sign off.
```

### 8.9 Accessibility & Inclusive Design — `a11y-2`

| priority | type | gate | autoCheck |
|---|---|---|---|
| critical | code | yes | `testSuiteFocus` |

```text
# Focus is always visible and a skip link exists

## Goal
Keyboard focus is always visible on every interactive element, and a working skip link exists.

## Context
Covered by the /test check "Focus is always visible and there is a skip link". Never remove an
outline without providing a :focus-visible replacement.

## Steps
1. Run /test and record the named check.
2. Tab through Home, Create, a game page and the admin dashboard; list every element where focus
   is not visibly indicated.
3. For each, add a :focus-visible style (ring or outline) clearly visible on its background.
4. Confirm the skip link is the first focusable element, is visible on focus, and moves focus to
   the main content.
5. Re-run /test.

## Constraints
- Use :focus-visible, not :focus, so mouse clicks do not show rings.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- "Focus is always visible and there is a skip link": pass.
- A tab-through of the four pages shows a visible indicator on every stop.

## Report back
The list of elements fixed and the check result.
```

### 8.10 Responsive, Performance & Quality — `perf-2`

| priority | type | gate | manualSteps |
|---|---|---|---|
| high | manual | yes | open the console; visit Home, Play, Watch and Admin Dashboard; confirm no uncaught errors in normal use |

```text
# No known console errors on core pages

## Goal
Core pages produce no uncaught console errors during normal use.

## Context
The only expected error surface is the offline/retry path in boot(), and only when genuinely
offline. Core pages: Home, Play, Watch, Admin > Dashboard.

## Steps
1. Open each core page with the browser console visible and the cache cleared.
2. Use each page normally (navigate, open a modal, play a card) for two minutes.
3. Record every console error and warning: page, message, source line.
4. Classify each as: expected (offline path), third-party, or bug.

## Constraints
- Report only; do not suppress errors or add try/catch to hide them.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- A table of page, message, source, classification.
- Zero entries classified "bug", or each "bug" has a reproduction and a proposed fix.

## Report back
The table and proposed fixes.
```

### 8.11 SEO, Discoverability & Analytics — `seo-2`

| priority | type | gate | manualSteps |
|---|---|---|---|
| medium | manual | no | view source on the homepage; confirm og:title, og:description and og:image are present and point at a real image |

```text
# Social share preview (Open Graph image/description) is set

## Goal
A shared link previews correctly: og:title, og:description and og:image are present and valid.

## Context
Open Graph tags live in the page <head> in index.html. The og:image URL must be absolute, load over
https, and be at least 1200x630.

## Steps
1. Read the <head> of the homepage source and list every og:* and twitter:* tag.
2. Request the og:image URL; record status code and pixel dimensions.
3. Confirm title and description are specific (not the generic site tagline repeated).
4. If anything is missing or invalid, add or correct the tags in the head.

## Constraints
- Reuse the existing <title> and meta description as copy sources; do not invent marketing copy.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- og:title, og:description, og:image and og:url are present; og:image returns 200 at >= 1200x630.

## Report back
The tag list, the image check results and any lines you changed.
```

### 8.12 Integrations, Data & Security — `sec-1`

| priority | type | gate | manualSteps |
|---|---|---|---|
| critical | manual | yes | run the verification SELECT at the bottom of migration.sql; confirm every listed table shows rowsecurity = true |

```text
# Supabase RLS is enabled and reviewed on every table

## Goal
Every table created by the migration has row-level security enabled and an explicit policy set.

## Context
The migration file ends with verification queries listing every table with its rowsecurity flag and
the policies in force. Admin-only tables must have no anon access of any kind.

## Steps
1. Read the migration file and list every table it creates.
2. Prepare (do not run) the verification SELECT statements against pg_tables and pg_policies.
3. For each table, state the expected rowsecurity value and the expected policy names/roles.
4. Provide the SQL for a human to run in the SQL editor, and a table to record the actual results.

## Constraints
- Do not execute SQL against any database. Do not change any policy.
- Never include keys or connection strings in the output.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- Every table appears in the expected-results table with rowsecurity and policies filled in.
- The SQL provided is read-only (SELECT only).

## Report back
The expected-results table and the SELECT statements.
```

### 8.13 Launch Operations & Deployment — `launch-1`

| priority | type | gate |
|---|---|---|
| critical | manual | yes |

```text
# migration.sql has been run against the production Supabase project

## Goal
Confirm the production database matches the migration file, with RLS on every table.

## Context
The migration has a verification query at the bottom listing all tables with RLS flags. "Run against
dev" is not sufficient; this must be the production project.

## Steps
1. Produce a read-only checklist of every table and function the migration should have created.
2. Write the verification SELECT statements a human will run in the production SQL editor.
3. Provide a results template: object name, expected, actual, match? (yes/no).
4. After the human pastes results, compare them and list every discrepancy.

## Constraints
- Do not run any SQL against production yourself. Do not suggest running the migration again to
  "fix" a mismatch without a human reviewing the diff first.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- Every expected object has a recorded actual value.
- Every mismatch is listed with the specific statement that would resolve it, marked "for human approval".

## Report back
The comparison table and the list of proposed (not executed) fixes.
```

### 8.14 Post-Launch Growth — `growth-1`

| priority | type | gate |
|---|---|---|
| low | manual | no |

```text
# A feedback loop exists for parents and caregivers

## Goal
A real person is assigned to read the contact forms and the support-ticket queue after launch.

## Context
The Grown-Ups contact form, business inquiry form and report-a-problem form all write to the
support queue. A working form with nobody reading it is not a feedback loop.

## Steps
1. Trace each form end to end and confirm tickets reach the admin queue and the alert email.
2. Identify who is notified (the alert address) and whether anyone owns triage.
3. Draft a one-paragraph triage plan: who checks, how often, target response time.
4. List what would make a ticket get missed (no owner, unmonitored inbox, filtered alerts).

## Constraints
- Do not assign real people or send any message; propose only.
- Do not touch unrelated code, data or settings.

## Acceptance criteria
- Each form's path to the queue is confirmed or flagged broken.
- A named-role triage plan exists, with a response-time target.

## Report back
The path confirmations and the draft plan.
```

---

## 9. Final acceptance checklist

Functional

- [ ] `#/admin/launch-readiness` renders for an active admin and is unreachable/empty for everyone else.
- [ ] Header counts, overall %, per-category counts and % agree with each other and with the dashboard.
- [ ] Complete checkbox, status select, notes, flag, edit, delete, copy-prompt, run-checks all work.
- [ ] Filters AND together; active filters open all matching categories and hide empty ones.
- [ ] Auto-checks: safety tasks cap at `needs_review`; human-set statuses are never overwritten; throwing checks are isolated.
- [ ] Task editor saves tasks with and without a stored prompt; malformed prompts are rejected with a clear toast.
- [ ] Every task shows a prompt (Authored or Generated); Copy copies it.

Data

- [ ] `launch_readiness` exists with RLS on, anon revoked, admin-only policy.
- [ ] Seed count in the table equals the seed array length; 100% of seeded tasks have a lint-clean `aiPrompt`.

Quality

- [ ] `node --check` passes on every inline script.
- [ ] The Launch Readiness test group passes; the prompt-invariant case is non-blocking.
- [ ] Keyboard-only use works (Tab order sensible, controls have accessible names, focus visible).

---

## 10. Behaviors carried over from the original (intentionally unchanged)

These are quirks of the original build. They are preserved so the rebuild matches it; fix them in a separate change if you want.

1. The details panel's open/closed state is DOM-only, so a re-render (for example after changing a status) collapses it.
2. The category accordion header buttons do not expose `aria-expanded`.
3. Notes save on the `change` event (when the textarea loses focus), not on every keystroke.
4. Unchecking the complete box returns a task to `not_started`, discarding a prior `in_progress` state.
5. The dashboard percentage in the original counted only `complete`, while the Launch Readiness page counts `complete` and `not_applicable`. Step 10 recommends unifying on `isLaunchDone`.
6. The original's generated prompt hard-coded an absolute repository path and a test-baseline count. The rebuild moves both into `LRC_PROMPT_CONFIG`.
7. Multiple admins editing the same task concurrently: last write wins.
