/**
 * Skill library (FR-K2, §11.2). Skills are versioned workflows with allowed tools, schemas, policies
 * and acceptance checks. `repository-map` is implemented natively (read-only, network denied) and
 * distinguishes verified facts from inferences, citing repository-relative paths.
 */
import fs from "node:fs";
import path from "node:path";
import { appliesToRole, type SkillSpec } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";
import { detectPreflight } from "../workspace/preflight.js";
import { RECIPE_SKILLS } from "./componentRecipes.js";
import { LIBRARY_SKILLS } from "./skillLibrary.js";

export const BUILTIN_SKILLS: SkillSpec[] = [
  {
    id: "skill.ux-flow-information-architecture",
    version: "1.0.0",
    roles: ["planner","coder"],
    triggers: ["user flow","user journey","information architecture","sitemap","site map","navigation structure","screens and flows","onboarding flow","checkout flow","main screens"],
    enabled: true,
    source: "builtin",
    purpose: "Decide which screens an app needs, what goes on each, and how people move between them",
    instructions: "When to use: Planning a new app or feature with more than one screen, or reorganising navigation.\nWhen not to use: A change inside one existing screen (use visual hierarchy instead).\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. List the users and the one main goal of each.\n2. Write the shortest path from opening the app to reaching that goal; every extra step needs a reason.\n3. Group content into at most 5 top-level screens; deeper things become sections, tabs or detail views.\n4. Name screens with the user's words from the spec, not internal names.\n5. For each screen note: main goal, main action, what shows first, and which pattern fits (list, detail, form, wizard, dashboard, table, timeline).\n6. Decide where people land first and what a first-time user sees.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Users who arrive by a shared link mid-flow; Back and refresh keeping the current screen; very long lists; nothing to show yet.\nDone when: Every screen has a stated goal and main action; The main goal is reachable in 3 steps or fewer; Navigation uses the spec's words.\nQA: Click through every navigation item; check Back and refresh keep the screen; check a first-time user can tell what to do first.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Every screen has a stated goal and main action","The main goal is reachable in 3 steps or fewer","Navigation uses the spec's words"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.interface-design-system",
    version: "1.0.0",
    roles: ["coder","critic"],
    triggers: ["design system","component library","style guide","ui kit","consistent styles","inconsistent styles","inconsistent design"],
    enabled: true,
    source: "builtin",
    purpose: "Keep every screen consistent by building on one small set of tokens and components",
    instructions: "When to use: Creating or restyling components, or when screens look inconsistent.\nWhen not to use: Copy-only changes.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Read the tokens and components that exist before writing any style.\n2. Use tokens for every colour, size, space, radius, shadow and duration; never raw values in components.\n3. Reuse a component when one fits; extend it with a variant rather than a near-copy.\n4. If a pattern repeats on two screens, make it a component in src/components/ui.\n5. Keep one accent colour for primary actions and one style per button role (primary, secondary, ghost, danger).\n6. Change the look in tokens.css, not across many files.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: A token missing for a needed value (add it to tokens.css with a clear name); dark mode needing its own values; third-party widgets that ignore tokens.\nDone when: No raw hex colours or pixel sizes in screen files; Buttons, inputs and cards look the same on every screen; New components live in src/components/ui.\nQA: Search the changed files for raw colours (#, rgb) and sizes; compare two screens side by side for matching buttons, spacing and headings.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["No raw hex colours or pixel sizes in screen files","Buttons, inputs and cards look the same on every screen","New components live in src/components/ui"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.responsive-mobile-ux",
    version: "1.0.0",
    roles: ["coder","critic"],
    triggers: ["responsive","mobile","phone","small screen","tablet","breakpoint","touch","mobile layout"],
    enabled: true,
    source: "builtin",
    purpose: "Make every screen comfortable on a phone as well as a desktop",
    instructions: "When to use: Any new or changed screen layout.\nWhen not to use: Back-end only work.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Design the 375px layout first: one column, main action visible without scrolling far.\n2. Add wider layouts with min-width breakpoints only where content benefits (lists to grids, side-by-side panels).\n3. Let text wrap; avoid fixed widths and heights.\n4. Make navigation fit: tabs that scroll sideways or a compact menu on phones.\n5. Tables become stacked cards or scroll inside their own box on phones.\n6. Touch targets at least 44px with space between them.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Long words and names, large text settings (200% zoom), landscape phones, on-screen keyboard covering inputs.\nDone when: No sideways page scroll at 375px; Main action visible on the first phone screen; Touch targets 44px or larger.\nQA: Check 375px, 768px and 1280px; zoom to 200%; tab through on desktop.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["No sideways page scroll at 375px","Main action visible on the first phone screen","Touch targets 44px or larger"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.forms-validation-feedback",
    version: "1.0.0",
    roles: ["coder"],
    triggers: ["form","forms","validation","sign up","signup","sign-up","input field","required field","error message","submit"],
    enabled: true,
    source: "builtin",
    purpose: "Forms that are quick to fill, explain mistakes kindly and confirm what happened",
    instructions: "When to use: Any form, input group or submit action.\nWhen not to use: Read-only screens.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Ask only for what's needed now; mark optional fields, not required ones, when most are required.\n2. One label per field above the control, a hint for anything unusual, sensible input types (email, number, date).\n3. Validate on submit and when leaving a field, not on every key press.\n4. Error text says what to do: 'Enter a name with at least 3 characters', next to the field and linked with aria-describedby; move focus to the first problem.\n5. Disable submit only while saving, and show 'Saving…'; then confirm in plain words ('Goal saved') and say what's next.\n6. Keep what the user typed if saving fails.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Double submits, slow saves, pasted values with spaces, very long text, leaving with unsaved changes.\nDone when: Every input has a visible label; Errors are specific and next to the field; Success is confirmed in words.\nQA: Submit empty, submit wrong values, submit right values; use only the keyboard; check screen-reader names.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Every input has a visible label","Errors are specific and next to the field","Success is confirmed in words"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.ux-states",
    version: "1.1.0",
    roles: ["coder","critic"],
    triggers: ["empty state","loading state","error state","success state","skeleton","no results","offline","first-time user","nothing yet"],
    enabled: true,
    source: "builtin",
    purpose: "Design the empty, loading, error, success and offline moments, not just the happy path",
    instructions: "When to use: Any screen that shows data, saves something or depends on the network.\nWhen not to use: Static content pages.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n0. Wrap each data area in DataState (src/components/ui): it shows the Skeleton while loading, an error with Try again, your EmptyState when there is nothing, then the content.\n1. Empty: say what belongs here and how to start, with the action as a button (EmptyState). Different message for 'no results' (offer to clear the search).\n2. Loading: keep the layout with Skeleton shapes; if text is needed, say what is happening ('Opening your goals…'), never just 'Loading'.\n3. Error: say what happened, why it matters and what to do, with a Retry; keep the user's work; technical details behind a 'Technical details' disclosure.\n4. Success: confirm in words and offer the next likely action.\n5. Offline: say it plainly and what still works.\n6. Disabled actions say why when focused or hovered.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Slow responses (show skeleton after ~300ms), partial data, retry that fails again, permission denied.\nDone when: Each data view has empty, loading, error and success states; No 'Something went wrong' or bare 'Loading'; Errors offer a next step.\nQA: Force each state (empty data, slow load, failed save) and read the message as a beginner would.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Each data view has empty, loading, error and success states","No 'Something went wrong' or bare 'Loading'","Errors offer a next step"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }, { version: "1.1.0", date: "2026-10-04", note: "Use the starter kit DataState wrapper for loading, error and empty" }],
  },
  {
    id: "skill.dashboard-data-ux",
    version: "1.0.0",
    roles: ["coder","planner"],
    triggers: ["dashboard","chart","charts","analytics","metrics","kpi","statistics","data visualization"],
    enabled: true,
    source: "builtin",
    purpose: "Dashboards and data views that answer the user's question at a glance",
    instructions: "When to use: Dashboards, charts, tables, reports, summaries of numbers.\nWhen not to use: Forms and content pages.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Start from the questions the user asks; show 3–5 key numbers first (Stat), each with what it means.\n2. Then the trend or breakdown that explains them; one chart per question, labelled axes, units, and a text summary.\n3. Tables: left-align text, right-align numbers, sticky header, sortable only where useful, readable empty and loading rows.\n4. Filters above the content they change; show what's filtered.\n5. Never rely on colour alone: label lines and bars, use patterns or text.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: No data yet, a single data point, huge numbers (format them), very long tables (paginate or virtualise), small screens (stack).\nDone when: Key numbers first with labels; Every chart has a text summary; Works at 375px.\nQA: Check with empty, tiny and large data; read the screen with colours turned off (greyscale).\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Key numbers first with labels","Every chart has a text summary","Works at 375px"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.onboarding-guided-setup",
    version: "1.0.0",
    roles: ["coder","planner"],
    triggers: ["onboarding","first run","first-run","welcome screen","getting started","setup wizard","guided setup","tutorial","walkthrough"],
    enabled: true,
    source: "builtin",
    purpose: "Get a new user to their first success quickly, without a manual",
    instructions: "When to use: First-time experience, setup steps, wizards.\nWhen not to use: Returning-user screens.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Ask only what's needed to start; defaults for the rest, changeable later.\n2. One task per step, with 'Step 1 of 3', Back, and a way to leave without losing choices.\n3. Show progress and what happens next; explain any unfamiliar word in one short sentence.\n4. End on a success screen that points to the first real action.\n5. Let returning users skip it.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Leaving halfway, coming back later, going Back, keyboard and screen-reader use.\nDone when: New user reaches a first success in under a minute; Steps can be skipped or resumed; Plain words throughout.\nQA: Do the flow as a first-time user, then as a returning user; try leaving midway.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["New user reaches a first success in under a minute","Steps can be skipped or resumed","Plain words throughout"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.interaction-microfeedback",
    version: "1.0.0",
    roles: ["coder"],
    triggers: ["micro-animation","micro-animations","microinteraction","hover state","press feedback","toast","toasts","feedback on click","button feedback"],
    enabled: true,
    source: "builtin",
    purpose: "Small, immediate feedback so every action feels acknowledged",
    instructions: "When to use: Buttons, toggles, saves, copies, drag and drop, any action without obvious result.\nWhen not to use: Decoration that doesn't respond to the user.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Respond within 100ms: pressed state, then busy state ('Saving…') if it takes longer.\n2. Confirm results where the user is looking (the button turns to 'Saved', or a toast that's announced).\n3. Use the motion tokens (--duration-fast, --easing); 120–200ms for feedback.\n4. Undo for reversible actions instead of a confirmation dialog.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Fast double clicks, failures after an optimistic update (roll back and explain), reduced motion.\nDone when: Every action shows it was received; Results are confirmed in words; Nothing animates with reduce motion on.\nQA: Click every action; turn on reduced motion; check toasts are announced.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Every action shows it was received","Results are confirmed in words","Nothing animates with reduce motion on"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.page-transitions-motion",
    version: "1.0.0",
    roles: ["coder"],
    triggers: ["page transition","page transitions","view transition","motion design","animate between","slide in","fade in"],
    enabled: true,
    source: "builtin",
    purpose: "Motion that explains where things went, never motion for its own sake",
    instructions: "When to use: Moving between screens, opening panels or dialogs, revealing content.\nWhen not to use: Dense data screens, anything the user repeats many times a minute.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Use motion to show continuity (a panel slides from where its button is) or progress.\n2. Keep it short (150–250ms) and use the tokens.\n3. Animate opacity and transform only.\n4. Provide a no-motion version under prefers-reduced-motion.\n5. Never block input while animating.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Slow devices, rapid navigation, reduced motion, screen readers (focus moves to the new screen's heading).\nDone when: Transitions under 250ms; Reduced motion removes them; Focus lands on the new screen.\nQA: Navigate quickly back and forth; turn on reduced motion; check focus after each move.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Transitions under 250ms","Reduced motion removes them","Focus lands on the new screen"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.visual-hierarchy-content",
    version: "1.0.0",
    roles: ["coder","critic","documenter"],
    triggers: ["visual hierarchy","hierarchy","content design","copy","microcopy","headings","make this page better","improve the page","cluttered","hard to read","plain language"],
    enabled: true,
    source: "builtin",
    purpose: "Make the most important thing obvious and the words easy to understand",
    instructions: "When to use: Any screen that feels busy or unclear, and all user-facing text.\nWhen not to use: Code that users never see.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Decide the one thing a person must notice first; give it the h1 and the primary button.\n2. Group related items, separate unrelated ones with space, and limit each screen to one primary action.\n3. Write short sentences in everyday words; lead with the outcome or next action; active voice.\n4. Buttons say what they do ('Save goal', not 'OK').\n5. Explain any necessary technical word immediately in plain English.\n6. Show essentials first; advanced options behind 'More options'.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Long names and translations, empty headings, two equally important actions (make one secondary).\nDone when: One h1 and one primary action per screen; No vague messages ('Something went wrong', 'Invalid input'); Buttons are descriptive.\nQA: Squint test (the main thing still stands out); read every label aloud as a beginner would.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["One h1 and one primary action per screen","No vague messages ('Something went wrong', 'Invalid input')","Buttons are descriptive"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.design-critique-ux-qa",
    version: "1.0.0",
    roles: ["critic","coder"],
    triggers: ["design review","ux review","critique","ux qa","design qa","polish","looks unprofessional","make it look better"],
    enabled: true,
    source: "builtin",
    purpose: "Review finished screens against UX standards before calling them done",
    instructions: "When to use: Before completing any user-facing change, and when asked to review or polish.\nWhen not to use: Back-end changes.\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. For each screen check: goal and main action clear; hierarchy and scanability; plain-language labels; desktop and 375px; keyboard and focus; empty, loading, error and success states; icons meaningful with labels; illustrations purposeful and not overused; motion and reduced motion.\n2. Fix what you can in this step; list what you couldn't with file and why.\n3. Run the type check, lint, tests and build that exist; read the look-check findings FlowCode returns.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Screens behind a sign-in or a dialog (open them), states that need data (create sample data in tests, not in the UI).\nDone when: Every checklist item reviewed; Problems fixed or listed with location; Only verified results reported.\nQA: Use the checklist above on every changed screen.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Every checklist item reviewed","Problems fixed or listed with location","Only verified results reported"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.plain-language-communication",
    version: "1.0.0",
    roles: ["documenter","coder","critic"],
    triggers: ["error message","status message","user-facing text","copy","wording","explain to the user","completion summary","onboarding copy"],
    enabled: true,
    source: "builtin",
    purpose: "Talk to beginners in plain words: what happened, why it matters, what to do next",
    instructions: "When to use: Any text a user reads: messages, errors, status, summaries, Copilot answers.\nWhen not to use: Code identifiers and logs (keep those behind 'Technical details').\nInspect first: src/styles/tokens.css (colours, type, space, radius, motion), src/styles/components.css and src/components/ui (AppShell, PageHeader, Section, Card, Button, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog), the screens in src/screens/, the icon library already in use (lucide-react by default), and the spec in spec/.\nProcess:\n1. Lead with the outcome or the next action.\n2. Short sentences, everyday words, about a 6th–8th grade reading level.\n3. Avoid jargon; if a technical word is needed, explain it right away (\"required packages (other code your app uses)\").\n4. Errors: what happened, why it matters, what to do next; never blame; raw errors and paths only under 'Technical details'.\n5. Never 'Something went wrong', 'Loading', 'Processing', 'Invalid input' or 'Operation completed' on their own; say what and why.\n6. Don't claim success before it's confirmed.\nAccessibility and responsive: Keyboard: every control reachable in order with a visible focus ring; labels on every input and icon-only button; status changes announced (role=status / alert); never colour alone; targets at least 44px; works at 375px with no sideways scrolling; prefers-reduced-motion respected.\nEdge cases: Messages that must stay short (buttons, chips): use a clear verb or state; long technical failures: summarise in one line, details expandable.\nDone when: No unexplained jargon; Every error has a next step; Summaries use What changed / What you can do now / What I checked / Notes.\nQA: Read each message as someone who has never coded.\nReport in plain language: What changed · What the user can do now · What I checked (only what you actually verified) · Notes (assumptions, limits). Put file lists and logs under 'Technical details'.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["No unexplained jargon","Every error has a next step","Summaries use What changed / What you can do now / What I checked / Notes"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "UX sprint: reusable design skill" }],
  },
  {
    id: "skill.ux-design-principles",
    version: "1.1.0",
    roles: ["planner","coder","debugger","critic"],
    triggers: ["new screen", "new page", "page layout", "user interface", "ui design", "ux", "redesign", "landing page", "dashboard", "empty state", "look professional", "looks unfinished", "visual hierarchy"],
    enabled: true,
    source: "builtin",
    purpose: "Design screens the way a product designer would: clear, finished, consistent",
    instructions: "Every screen you build must look finished and follow these rules:\n1. Real content only. Use the spec's words, data and examples (or src/content/*.json). Never ship text that describes the component (\"This is the X component\"), promises content (\"You will see your choices here\"), lorem ipsum, \"sample\", \"TODO\" or \"Coming soon\". If data isn't available yet, show a designed empty state with a next action.\n2. One clear job per screen. A page title (h1) that says where the user is, one primary action styled as the main button, secondary actions quieter.\n3. Hierarchy. Headings get smaller as they go down (h1 > h2 > h3, from the type tokens); body text at --text-md; related things grouped in one card, unrelated things separated by space. Don't nest a card inside a card inside a card.\n4. Spacing and alignment from the tokens only (--space-*): consistent gaps between sections (larger) and within a group (smaller), everything on one left edge, content width capped (--content-max) and centred.\n5. Controls that look like what they do: buttons for actions, links for navigation, labelled inputs with hints and inline errors, choices as radio buttons or cards with a clear selected state.\n6. States: every data view has loading (skeleton), empty (friendly message + action), error (what happened + retry) and success feedback.\n7. Visual consistency: colours, radii, shadows and fonts only from tokens; one accent colour for primary actions; icons with text labels where meaning isn't obvious.\n8. Responsive: single column at 375px, comfortable widths on desktop, touch targets at least 44px, no horizontal scroll.\nBuilding blocks: when src/components/ui exists, compose screens from it (AppShell, PageHeader, Section, Card, Button variant=\"primary\" for the one main action, Field, EmptyState, Skeleton, Stat, Badge, Notice, Dialog) instead of raw elements with new classes. Add a new building block there only when none fits.\nAfter your step, FlowCode opens the app and looks at each screen (placeholder text, repeated sections, one h1, unstyled defaults, contrast, phone width); what it finds comes back to you to fix.\nBefore task_complete, read back the screen you changed and check it against these eight rules.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["No placeholder or self-describing text","One h1 and one primary action per screen","Spacing, colours and type only from tokens","Loading, empty and error states designed"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "Design and UX skills: built apps looked unfinished (placeholder text, repeated sections, no navigation)" }],
  },
  {
    id: "skill.design-playbook-custom-ux",
    version: "1.0.0",
    roles: ["planner", "coder", "critic"],
    triggers: ["visual design", "ui design", "custom design", "modern design", "design system", "visual thesis", "rule of 8", "8px", "8-point", "spacing system", "landing page", "redesign", "look professional", "looks generic", "looks unfinished", "polish the design", "page composition", "hero section"],
    enabled: true,
    source: "builtin",
    purpose: "Design custom, modern interfaces with a visual thesis and the rule of 8, not a generic AI template",
    instructions:
      "From the design playbook (Custom Modern UX playbook, Rule of 8 guides, 8-point grid guide). Interfaces must be designed, not assembled.\n" +
      "Before coding a screen:\n" +
      "1. Product frame: who uses it, their main task, context (desk, phone, shared screen), density (sparse, balanced, dense). If the spec doesn't say, choose one and keep to it.\n" +
      "2. Archetype: editorial story, conversion journey, application workspace, guided flow, discovery feed, or detail and decision. It is a starting point, not a template.\n" +
      "3. Visual thesis: one sentence (type, surfaces, tone) every choice must support. Remove any effect that doesn't.\n" +
      "4. Container: constrained (marketing, forms, settings, reading) uses a max 1440px shell with text kept to 45-75 characters and forms to 480-640px; fullscreen (dashboards, tables, maps, editors) still keeps safe areas and caps reading regions; hybrid mixes full-width bands with constrained content. Never stretch content just because the screen is wide.\n" +
      "Rule of 8 (spacing is a relationship: tighter inside a group, larger between groups and sections). Use the project's tokens, never raw pixels: --space-1 4px (micro), --space-2 8px (icon-label, label-field), --space-4 16px (fields, card gaps), --space-5 24px (card padding, groups), --space-6 32px (before actions, groups), --space-7 48px, --space-8 64px, --space-9 96px (sections). --space-3 12px only as a half-step. No arbitrary values like 13px or 22px; a repeated exception becomes a token.\n" +
      "Components: buttons from the control heights (--control-sm/md/lg), 8px icon gap, one primary action per decision area, touch targets at least 44px; cards only around a real unit of content, padding --space-4/5/6, content-driven height, no card inside a card; forms with a visible label 8px above each field, 16px between fields, 24px between groups, 32px before actions, errors 8px under their field; dialogs 400-640px wide with 24-32px padding, focus trapped and returned, a full screen on phones when cramped; tables keep readable rows and scroll or become cards on phones instead of shrinking text.\n" +
      "Responsive: start from the phone layout. Breakpoints go where the layout fails, not at device names. Stack, reflow cards with repeat(auto-fit, minmax(min(100%, 280px), 1fr)), collapse navigation, turn sidebars into drawers, scroll comparisons horizontally, and swap hover for visible controls on touch.\n" +
      "Layout patterns. Page compositions (pick by the product's story, not by habit): split narrative (copy and media change together), immersive single idea, editorial sequence (varied grid, paced type), product proof (real UI and scenarios), modular explorer (filters and a card hierarchy), workflow walkthrough (context, action, result). Not by default: centered headline + gradient orb + two buttons + three cards + testimonials. App shell: 48-64px header, 240-320px sidebar that becomes a drawer when the main area gets narrow, fluid main with reading regions capped. Page rhythm: header, 48px to the hero, 64px between sections, 96px before the footer (smaller on phones: 32px sections, 16px gutters). Phone patterns: bottom sheet for filters and short choices, full-screen flow for long forms, sticky action bar for the main action, feed and detail with scroll position kept, compact summary instead of a squeezed dashboard. Overlays: modal for a short focused task, drawer for inspectors and filters, full route for anything that needs its own URL. When a screen in src/screens/ started from a ready-made layout (it has a flowcode:sample marker) or .flowcode/layouts/ keeps other versions (dashboard, home, settings, pricing, about, sign-in), build on that layout and replace its sample content.\n" +
      "Motion: 120-220ms for feedback, only to show what changed; respect prefers-reduced-motion.\n" +
      "Avoid by default: purple or blue gradients and glows without a brand reason, floating glass cards and blobs, every section in a rounded box, pill shapes the system doesn't use, tiny low-contrast grey text, icon-only navigation, hover-only actions, fixed-height cards that clip text, fake metrics and startup jargon. Dark surfaces, glass, bento grids and glow are options only when the visual thesis calls for them.\n" +
      "Real content and states: specific copy and action verbs (\"Create event\", not \"Submit\"), empty states that say what's missing and what to do, errors that say what happened and the next step, loading and success states, long and short text tested.\n" +
      "Before task_complete check: one clear purpose and next action on the first screen; spacing from tokens on the 8px rhythm; consistent radii, shadows and button sizes; works at 375px, 768px, 1280px and wide; keyboard, focus-visible, contrast and 44px targets; reduced motion.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "replace_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["A visual thesis and container choice fit the product", "Spacing on the 8px rhythm from tokens, no arbitrary values", "Components use shared sizes, one primary action per area", "Layout reflows by content from 375px to wide screens", "No generic decoration without a reason in the visual thesis"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-04", note: "Design playbook: six custom UX and rule-of-8 guides turned into one skill" }],
  },
  {
    id: "skill.typography-hierarchy",
    version: "1.0.0",
    roles: ["planner", "coder", "critic"],
    triggers: ["typography", "type scale", "typeface", "font pairing", "fonts", "font size", "font weight", "line height", "letter spacing", "text hierarchy", "visual hierarchy", "readability", "headings look", "hard to read", "text too small"],
    enabled: true,
    source: "builtin",
    purpose: "Set typography as a system: roles, a small scale, readable measure and hierarchy from size, weight, colour and space together",
    instructions:
      "From the design playbook (Typography UX guide, Typography hierarchy guide). Typography is the interface's main organising system; choose it for reading and the task, not for a static mockup.\n" +
      "1. Roles, not ad hoc styles. Display (short hero or brand moment only), headline (page and major sections), title (cards, dialogs, panels, list groups), body (reading), label (buttons, tabs, navigation, field labels, metadata). Remove any text style without a role.\n" +
      "2. Use the project's tokens, never raw sizes: --text-xs 12px (non-critical metadata only), --text-sm 14px (supporting text, labels, table data), --text-md 16px (default body and form copy), --text-lg 20px (titles, lead paragraphs), --text-xl 28px (section headlines), --text-2xl 40px (page h1), --text-3xl fluid 44-64px (display, short text only). Use only the steps the product needs.\n" +
      "3. Hierarchy from several signals with the fewest changes: size, weight, colour and space together. A page title may change all four; a section heading only size and weight; metadata a smaller size and muted colour that stays readable. Never make a heading big, bold, coloured, uppercase and widely tracked at once.\n" +
      "4. Weight: --weight-regular 400 for body; --weight-medium for labels, active navigation and compact emphasis; --weight-semibold 600 for headings and important labels; --weight-bold sparingly. Light weights only for large display type, never small or muted text.\n" +
      "5. Line height and tracking: --leading-tight (about 1.1-1.2) for display and headlines, --leading-snug 1.3 for titles, --leading-normal 1.5 to --leading-relaxed 1.6 for body; --tracking-tight on large display only, --tracking-wide only for short uppercase labels; default tracking for body.\n" +
      "6. Measure: body text max-width var(--measure) (about 68ch, 45-75 characters per line); forms 480-640px; left-aligned, never justified. More space before a heading than after it; paragraph spacing from the 8px spacing tokens, not extra line height.\n" +
      "7. Colour: primary text from --color-text (near-black on light, near-white on dark, not pure #000 on #fff), supporting text from --color-text-muted, which must still reach 4.5:1 (3:1 only for large text). Never muted grey for labels, instructions, errors or button text. Links and states need more than colour (underline, icon, weight).\n" +
      "8. Families: one UI family by default (--font-sans); a display family (--font-display) only for display and headlines when the visual thesis wants contrast; --font-mono only for code, IDs and technical values. At most two primary families; check numerals, symbols and languages; load real weights, never synthetic bold.\n" +
      "9. Elements: one h1 per screen and headings in order (style with classes, choose levels by meaning); buttons and labels 14-16px, never tiny all-caps; field labels visible above inputs, helper and error text 14-16px; card title 16-20px semibold, description 14-16px, metadata 12-14px; tables 14-16px with font-variant-numeric: tabular-nums for numbers; dialog title 20-24px semibold.\n" +
      "10. Responsive and accessible: shrink display and headlines on phones before body or controls; body at least 16px and controls at least 14px on mobile; fluid sizes only inside clamp() limits; no fixed heights that clip when text grows, translations lengthen or users zoom to 200% or increase text spacing.\n" +
      "Avoid: more families or sizes than needed, body text made small to look clean, light grey for important text, all caps for sentences, decorative fonts in dense UI, shrinking mobile type to keep a desktop layout.\n" +
      "Before task_complete check: every text style maps to a role and token; one visible h1 and semantic heading order; body readable and measure-capped; primary, secondary and muted text all pass contrast; nothing clips at phone width or 200% zoom.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "replace_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Every text style maps to a role and a type token", "One h1 per screen and semantic heading order", "Body text 16px, measure-capped, line height 1.5 or more", "Muted text still meets contrast; no light weights for small text", "Text reflows without clipping at phone width and 200% zoom"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-04", note: "Design playbook: typography UX and hierarchy guides turned into one skill" }],
  },
  {
    id: "skill.ux-architecture",
    version: "1.0.0",
    roles: ["planner", "coder", "critic"],
    triggers: ["ux architecture", "object model", "data model for the ui", "object lifecycle", "status workflow", "approval flow", "permissions", "permission", "user roles", "roles and permissions", "admin and member", "access denied", "deep link", "deep-link", "route map", "taxonomy", "content model", "labels are confusing", "where should this live", "multi-step flow", "search and filter", "saved views"],
    enabled: true,
    source: "builtin",
    purpose: "Architect the experience before the screens: users and top tasks, product objects and their lifecycles, structure, navigation, flows, states, permissions, labels and routes",
    instructions:
      "From the design playbook (UX architecture guide). Do not start from screens, cards or visual style. Define the user's goals, the product objects, the task flows and the information structure first; then build pages that make that structure visible. For screen lists and click paths also follow the user flow skill; this skill covers what sits beneath them.\n" +
      "1. Answer before coding. Who is the user (role, context, device, knowledge)? What is the top task, as an outcome (\"create and share a project\", not \"visit the projects page\")? Which product object is involved? What is its lifecycle? What must the user know before acting? Which action changes the state, with what confirmation, feedback and destination? What can go wrong? How will they find it later? How does it change by role and device? How is success measured? If the spec doesn't say, pick a reasonable assumption and write it in the spec's Assumptions section; never hide uncertainty behind decorative UI.\n" +
      "2. Product frame (write it in the spec when missing): users, context, need, current friction, outcome, product goal, success signal, constraints. Keep user goals separate from business goals: \"help a user see whether the paid tier solves their limit\", not \"increase upgrades\".\n" +
      "3. Objects before pages. For each core object (project, order, document, booking, invoice, member…) note its purpose, owner, attributes, relationships, lifecycle, permissions, main actions, how people find it, and its empty and error states. Pages are views of objects and tasks; don't invent a dashboard, settings page or profile page before this.\n" +
      "4. Lifecycle. Any object with a workflow gets explicit states (for example Draft, In review, Changes requested, Approved, Published, Archived). For each state: who sees it, who changes it, which actions show, what message shows, what happens downstream, what happens if the change fails. Never show an action the state or role forbids (no Publish without permission, no edits after locking).\n" +
      "5. Information architecture. Organise by the user's mental model, never by teams, database tables or services. One organising scheme per level: by task, by object type, by time, by location, by audience, by status or by hierarchy. One name per concept everywhere (navigation, headings, buttons, search, notifications); no overlapping categories; shallow but not flat; tags drive filters, not top-level navigation; keep synonyms for search (\"invoice\" finds \"bill\").\n" +
      "6. Navigation. Distinguish global (main areas), local (tabs or sub-navigation inside an object), contextual (related items, next step, breadcrumbs), utility (profile, help, notifications, settings, kept apart from task destinations) and in-page (table of contents). Labels predict what they open; avoid \"Explore\", \"Resources\", \"More\" or \"Manage\" on their own. A long list of equal destinations means the IA isn't settled. The current page is marked by more than colour (aria-current plus weight or an indicator). Coming back from a detail view keeps filters, search, sort, scroll and view. Breadcrumbs only for real hierarchy reached by deep links. Search helps find known items; it never replaces navigation. When lists grow, define search scope, filter facets people understand, a sensible default sort, and a no-results state with a way out (clear filters, check spelling).\n" +
      "7. Flows as outcomes: trigger, goal, preconditions, shortest happy path, decision points, failure paths, recovery, success, what is saved, how it's measured. Ask for information when it becomes necessary; show the current step and the object's name; keep typed input through errors and going back; confirm destructive, costly or external actions but not routine ones; make completion visible (status changes, a confirmation, the next useful action); separate Close, Save draft, Discard and Back.\n" +
      "8. States for every screen, component and flow: default, loading, empty, first use, error, offline, permission denied, disabled, success, conflict and archived. Loading: skeletons when the shape is known, real progress for long work, never an unexplained spinner or fake progress, keep loaded content while refreshing. Empty: what is empty, why if useful, one clear next action (use EmptyState). Errors: plain words, which object or action failed, the way to recover, input kept; never raw errors or a bare \"Something went wrong\".\n" +
      "9. Permissions are UX. Write a small matrix (actions by role) when roles exist. Hide an action only when knowing it exists doesn't help; otherwise show it disabled with the reason (role, plan, state or missing step). Say who can see shared things and how to change it. Risky actions get clear labels, confirmation and undo where possible.\n" +
      "10. Labels for decisions: specific, familiar, predictive, distinct from neighbours, consistent and short. Buttons are verb plus object when that helps (\"Create project\", \"Review order\", \"Delete project\", not \"Submit\" or \"Continue\"); inside a clear context a short label is fine (\"Save changes\"). Detail pages follow one order: title and status, main actions, key summary, main content, supporting details, activity, related items, then admin and destructive actions apart from routine work.\n" +
      "11. Routes and components. Routes name user concepts and support deep links (/projects/:projectId/settings); keep shareable filter, sort, tab and view state in the address; modals only for short tasks, routes for anything people bookmark, share or go back to; handle not found, access denied and error routes. Shared components get a contract: purpose, required data, variants and states, actions, permission behaviour, loading, empty, error and disabled behaviour, semantics and keyboard, responsive behaviour. A card is never a link wrapping other buttons.\n" +
      "12. Responsive, channels and accessibility. Keep the task and object model on every screen size; change presentation, not structure (sidebars become drawers, secondary controls collapse, the primary task stays visible at 375px). Notifications and emails link to the exact object and state; names and statuses match across channels. Landmarks (header, nav, main, aside, footer), headings in order, keyboard order that follows the task, skip link, focus managed in dialogs, tabs and menus, visible focus, accessible names on icon buttons, errors and success announced, nothing carried by colour, hover, drag or sound alone, text that reflows at 200% zoom.\n" +
      "Size the work to the app: a landing page needs a short page narrative and its conversion flow; a multi-user app needs objects, roles, routes and states.\n" +
      "Avoid: pages before goals and objects; navigation by department or service; vague labels; features with no home, owner or way to find them; a dashboard of cards with no task priority; only the happy path; hiding unavailable actions without a reason; modals for deep-linkable work; losing list context after a detail view; deep nesting that copies internal structure; measuring page views instead of task success.\n" +
      "Before task_complete check: the user, top task, objects and lifecycles are written down; every action shown is allowed for that role and state; each screen handles loading, empty, error and denied; labels use the spec's words and match everywhere; important views have their own route; it works by keyboard and at phone width.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "replace_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["The user, top task, core objects and their lifecycles are written in the spec", "Actions shown match the user's role and the object's state; blocked ones say why", "Every screen handles loading, empty, error and permission-denied states", "Labels use the spec's words and name each concept the same way everywhere", "Important views, filters and tabs have their own route and survive Back and refresh"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-04", note: "Design playbook: UX architecture guide turned into a skill" }],
  },
  {
    id: "skill.app-layout-navigation",
    version: "1.0.0",
    roles: ["planner","coder"],
    triggers: ["navigation", "app shell", "app layout", "sidebar", "routing", "router", "assemble the app", "wire every page", "nav bar", "navbar"],
    enabled: true,
    source: "builtin",
    purpose: "Give the app a real structure: a layout, navigation and one screen at a time",
    instructions: "Apps have a structure; they are not every feature stacked on one page.\n1. App shell: a header with the product name, navigation between the main screens (from the spec), and a main area that shows ONE screen at a time. Add a footer only if the spec needs one.\n2. Navigation: top tabs or a nav bar for up to 5 screens; a sidebar for more. The current screen is clearly marked (aria-current=\"page\"). Use the router if the app already has one; otherwise keep the current screen in state and in the URL hash so Back works.\n3. Each screen is its own component in src/screens/ (React) or its own component folder (Angular), rendered exactly once by the shell. Smaller parts (cards, lists, dialogs) live in src/components/ and are used inside screens.\n4. A home or first screen that tells a new user what to do first, with the main action.\n5. When wiring features in, add each screen to the navigation and the shell, never render the same screen twice, and remove the starter placeholder.",
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Shell with header and navigation","One screen shown at a time","Each screen rendered once","Current screen marked in the navigation"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "Design and UX skills: built apps looked unfinished (placeholder text, repeated sections, no navigation)" }],
  },
  {
    id: "skill.repository-map",
    version: "1.0.0",
    roles: ["planner","researcher"],
    triggers: ["repository map","architecture","project structure","entry points"],
    enabled: true,
    source: "builtin",
    purpose: "Build a repository architecture map",
    instructions: "List files, read manifests and entry points, then report project type, package manager, structure, entry points, scripts, dependencies and test setup. Separate verified facts (with paths) from inferences.",
    allowedTools: ["list_files", "search_code", "read_file"],
    inputSchema: "RepositoryMapInput",
    outputSchema: "RepositoryMap",
    policies: { network: "denied", filesystem: "read_workspace_only" },
    acceptance: ["Must identify package manager/project type when evidence exists", "Must distinguish verified facts from inferences", "Must cite repository-relative paths"],
    tests: [{ name: "vite-react fixture", fixture: "templates/react-vite-starter", expect: "projectType=vite, packageManager=npm" }],
    changelog: [{ version: "1.0.0", date: "2026-10-01", note: "From PRD §11.2" }],
  },
  {
    id: "skill.fix-typescript-error",
    version: "2.0.1",
    roles: ["debugger","coder"],
    triggers: ["typescript","type error","typecheck","tsc","ts2"],
    enabled: true,
    source: "builtin",
    purpose: "Write React + TypeScript that type-checks the first time, and repair type errors at their root",
    // Distilled from the user's "TypeScript stabilization" protocol and the error mix of the calendar builds
    // (unused names, missing modules, duplicate declarations, untyped props, never[] state).
    instructions: [
      "Before you write:",
      "- Search for a name (search_code) before you declare or import it; if it exists, change it in place instead of adding a second one.",
      "- Import only from files that exist now, and the way they export: `export function X` → `import { X }`, `export default` → `import X`.",
      "- Hooks come from \"react\" (useState, useEffect, useMemo). Setters come only from useState; never import setX from anywhere.",
      "- Type every state that starts empty: useState<CalendarEvent[]>([]), never useState([]) (that is never[]).",
      "- Type every component's props with an interface. A parent passes only props the child declares; share one type (for example CalendarEvent in src/lib) instead of two versions.",
      "- One owner per piece of data: the parent keeps it in state, the child gets it as a prop and reports changes with a callback (onEventsChange).",
      "- Compute values you can derive (useMemo) instead of copying them into state; use useEffect only for timers, storage, subscriptions or fetching.",
      "- JSX goes in .tsx files. Every tag closes, every { ( [ is matched, and a component returns one root element.",
      "- The kit's <Field> takes a function child: <Field label=\"Email\">{(props) => <input {...props} type=\"email\" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />}</Field>.",
      "- Finish what you start in the same step: no imports, state or helpers kept \"for later\".",
      "Fixing type errors:",
      "- Fix in this order: syntax, duplicate declarations, missing modules, prop types, undefined names, then the rest. Later errors are often side effects of the first.",
      "- Read the whole file before patching it. If a patch misses, read the file again and anchor on what is really there; never send the same patch twice.",
      "- Never hide an error (@ts-ignore, any, deleting a feature) to make the check pass.",
    ].join("\n"),
    allowedTools: ["read_file", "search_code", "apply_patch", "run_script", "report_blocked", "task_complete"],
    inputSchema: "ErrorRecord",
    outputSchema: "RepairResult",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Typecheck passes after the change"],
    tests: [],
    changelog: [
      { version: "1.0.0", date: "2026-10-01", note: "Initial" },
      { version: "2.0.0", date: "2026-10-04", note: "Inspect-first React + TypeScript rules from the user's stabilization protocol; given to every coding step in React apps" },
      { version: "2.0.1", date: "2026-10-05", note: "How the kit's Field takes its input (a function child), after Calendar test 8's sign-in form" },
    ],
  },
  {
    id: "skill.audit-accessibility",
    version: "1.1.0",
    roles: ["accessibility_qa", "coder"],
    triggers: ["accessibility", "a11y", "wcag", "aria", "screen reader", "contrast", "keyboard", "focus", "reduced motion", "responsive", "touch"],
    enabled: true,
    source: "builtin",
    purpose: "Accessibility and responsive review of new or changed screens",
    instructions: "Check, and fix what you can:\n- Semantic structure: one h1, headings in order, landmarks, native controls before ARIA.\n- Keyboard: everything reachable in a sensible order, visible focus, no traps.\n- Names: every input has a label, every icon button an accessible name; errors and status messages are announced.\n- Contrast and status: text meets contrast, and status is never shown by colour alone.\n- Touch and small screens: targets at least 24px, no horizontal scroll at 375px, no hover-only actions.\n- Motion: prefers-reduced-motion is respected; text still works at 200% zoom.\nReport findings with file and line and how severe they are. Never claim WCAG conformance.",
    allowedTools: ["list_files", "search_code", "read_file", "apply_patch"],
    inputSchema: "AuditInput",
    outputSchema: "Findings",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Findings cite file and line", "Keyboard, focus, labels, contrast, small screens and reduced motion checked", "No conformance claims"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-01", note: "Initial" }, { version: "1.1.0", date: "2026-10-03", note: "Adds responsive, touch and reduced-motion review from the prompt and skill system" }],
  },
  {
    id: "skill.generate-component",
    version: "1.1.0",
    roles: ["coder"],
    triggers: ["new component", "create a component", "add a component", "build a component", "reusable component", "widget"],
    enabled: true,
    source: "builtin",
    purpose: "Generate a React component that uses existing design tokens",
    instructions: "Read the token file and an existing component, then create the new component and its CSS classes using var(--tokens) only.",
    allowedTools: ["list_files", "read_file", "create_file", "apply_patch", "run_script", "task_complete", "report_blocked"],
    inputSchema: "ComponentRequest",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["No raw color values", "Typecheck passes"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-01", note: "Initial" }, { version: "1.1.0", date: "2026-10-02", note: "Match only requests to create a component, not any mention of components or tokens" }],
  },
  {
    id: "skill.extend-tokens",
    version: "1.1.0",
    roles: ["coder","debugger"],
    triggers: ["new token", "add a token", "add token", "new colour token", "new color token", "new css variable", "extend the tokens", "extend tokens"],
    enabled: true,
    source: "builtin",
    purpose: "Add a design token instead of inventing raw values in component CSS (PRD §13.2)",
    instructions: "Read the token stylesheet. Add ONE semantic custom property (e.g. --color-warning-surface) in :root and in the dark-mode block, derived from existing palette values, with a comment stating its role. Then use var(--new-token) in component CSS. Never add raw colors outside tokens.css.",
    allowedTools: ["read_file", "apply_patch", "task_complete", "report_blocked"],
    inputSchema: "TokenRequest",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["New token defined for light and dark themes", "design_qa raw-color finds no new violations", "Contrast pairs still pass"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-01", note: "Initial" }, { version: "1.1.0", date: "2026-10-02", note: "Match only requests to add a token, not changes to an existing value" }],
  },
  {
    id: "skill.local-database",
    version: "1.0.0",
    roles: ["coder", "debugger"],
    triggers: ["database", "persist", "persistence", "storage", "save data", "store data", "saved", "crud", "sqlite", "localstorage", "local storage", "backend", "api"],
    enabled: true,
    source: "builtin",
    purpose: "Store app data in the project's local SQLite database through src/lib/db.ts",
    instructions:
      "If src/lib/db.ts exists, persist data with it instead of localStorage or in-memory arrays: import { db } from './lib/db' (adjust the path) and use db.list<T>(collection), db.get<T>(collection, id), db.create(collection, data), db.update(collection, id, patch) (merges) and db.remove(collection, id). Collections are created on first write; names are lowercase letters, digits and _. Every call is async and can throw: show a loading state and a readable error. Documents come back with id, createdAt and updatedAt. Keep one small module per collection (e.g. src/lib/events.ts) that wraps db calls with typed functions, and use it from components. Don't edit server/ or data/. If src/lib/db.ts does not exist, keep using the existing storage and mention in your summary that the local database can be enabled from the workspace Data tab.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Data is saved through src/lib/db.ts, not localStorage", "Loading and error states are handled", "Typecheck passes"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-01", note: "Initial" }],
  },
  // Stack skills: also added by project type (see stackSkillIds), whatever the task's wording.
  {
    id: "skill.angular",
    version: "1.0.0",
    roles: ["coder", "debugger"],
    triggers: ["angular"],
    enabled: true,
    source: "builtin",
    purpose: "Write Angular code that fits the project's version and passes its build and tests",
    instructions:
      "Read package.json for the Angular version and angular.json for the project layout before writing code. Match what the project already does: standalone components (standalone: true or Angular 19+) or NgModules, signals (signal(), computed(), input(), output()) or @Input/@Output, the new control flow (@if, @for with track) or *ngIf/*ngFor. Each component keeps its class, template (.component.html) and styles (.component.css/.scss) together; add new ones next to similar components and declare or import them where they're used. Use the components listed under REUSABLE PARTS by their selector before writing a new one. Use the app's services (providedIn: 'root') for data, HttpClient for requests, and the async pipe or signals rather than manual subscribe without cleanup. Every name used in a template must exist on the component class. Don't run ng generate or ng add; create the files directly.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "Initial" }],
  },
  {
    id: "skill.python",
    version: "1.0.0",
    roles: ["coder", "debugger"],
    triggers: ["python", "pytest", "django", "flask", "fastapi"],
    enabled: true,
    source: "builtin",
    purpose: "Write Python that fits the project and passes its tests, lint and type check",
    instructions:
      "Read pyproject.toml or requirements.txt first: use the libraries and Python version the project already uses, and don't add a dependency without saying so in your summary (installing needs approval). Follow the project's layout (src/ package or flat modules) and import style. Add type hints to new functions. Put tests next to the existing ones (tests/test_<module>.py) as plain pytest functions with assert; use tmp_path and monkeypatch instead of touching real files or the network. Keep functions small and raise specific exceptions with a clear message. Each edit to a .py file is compiled right away: fix any error it reports before moving on. Run the checks listed for run_script (pytest, ruff or flake8, mypy) when they exist.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "Initial" }],
  },
  {
    id: "skill.postgres",
    version: "1.0.0",
    roles: ["coder", "debugger"],
    triggers: ["postgres", "postgresql"],
    enabled: true,
    source: "builtin",
    purpose: "Write PostgreSQL schema changes and queries safely",
    instructions:
      "Change the schema only through a new migration file in the project's existing tool and folder (Prisma, Drizzle, Knex, Alembic or plain .sql in migrations/); never edit a migration that has already been applied. Running a migration needs approval: write it, and say in your summary that it still has to be run. Always pass values as parameters ($1, $2 with pg; the ORM's query builder; %s with psycopg); never build SQL by joining strings. Use timestamptz for times, bigint or uuid ids, NOT NULL with defaults where a value is required, a foreign key plus an index for every relation, and a unique constraint for anything that must be unique. Wrap multi-step writes in a transaction. Avoid SELECT * in app code. Never DROP or TRUNCATE a table or column without an explicit request; for renames, add the new column, copy the data, and leave the old one for a later migration. Read connection details from environment variables (DATABASE_URL), never from code.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "Initial" }],
  },
  // From the agent prompt, skill and specification system: one skill per recurring kind of work.
  {
    id: "skill.project-rules",
    version: "1.0.0",
    roles: ["coder", "debugger"],
    triggers: ["*"],
    enabled: true,
    source: "builtin",
    purpose: "Permanent project rules: code, scope, UX, accessibility, motion and honest reporting",
    instructions: "Rules for every change in this project:\n- Code: TypeScript when the project uses it; typed data at every boundary (API, storage, form). Reuse the project's components, tokens and utilities. No secrets or privileged logic in browser code.\n- Scope: no unrelated refactors or redesigns; keep what already works working. A new package, schema or API change needs approval.\n- UX: interactions help people understand, decide or finish something; no motion only for decoration. Keep native scrolling. Clear hierarchy and contrast.\n- Access: semantic HTML and native controls; keyboard reachable with visible focus; works with touch and on small screens; nothing essential depends on hover, colour, motion or WebGL; labels, status and error messages for every control.\n- Motion: animate transform and opacity, not layout; honour prefers-reduced-motion; pause expensive animation off screen; less movement on small screens.\n- Honesty: never present a simulated result as fact or advice; say what you checked and what you could not.",
    allowedTools: [],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "Permanent project instructions from the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.feature-discovery-mvp",
    version: "1.0.0",
    roles: ["planner"],
    triggers: ["new feature","mvp","dashboard","simulator","workflow tool","review queue","builder","co-pilot","copilot","explorer","monitor","visualization","visualisation","3d","three.js","threejs","ai feature"],
    enabled: true,
    source: "builtin",
    purpose: "Plan a substantial feature as the smallest usable version, with clear limits",
    instructions: "1. Name the user, their problem and the one flow the feature must support first.\n2. Plan the smallest version that works end to end. List what is left out in the plan's assumptions as \"Not in this build: …\".\n3. Give each screen its states: default, loading, empty, error, success, and permission denied where people sign in.\n4. Pick the simplest technology that does the job: React, TypeScript and CSS for screens and motion; SVG for diagrams and workflow maps; Canvas only for dense drawing; Three.js only when people must inspect or move through real 3D space. Say why if you pick Canvas, Three.js, Python or a new package, and what the fallback is.\n5. Data that must survive a reload needs a storage task first (types, then storage, then screens).\n6. A new package, a schema change or an API change goes in riskNotes so the user approves it.",
    allowedTools: [],
    inputSchema: "Plan",
    outputSchema: "ImplementationPlan",
    policies: { network: "denied", filesystem: "read_workspace_only" },
    acceptance: [],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.scroll-motion-parallax",
    version: "1.0.0",
    roles: ["coder","debugger"],
    triggers: ["parallax","scroll","scrolling","sticky","pinned","scroll story","scrollytelling","reveal on scroll","horizontal scroll","scroll progress"],
    enabled: true,
    source: "builtin",
    purpose: "Build parallax and scroll-linked motion that keeps native scrolling and works without motion",
    instructions: "1. Keep native scrolling. Don't hijack the wheel, don't add global smooth scrolling.\n2. Move layers with transform and opacity only; never animate width, height, top, left or margins.\n3. Drive motion from scroll position with requestAnimationFrame or IntersectionObserver, and stop work when the section is off screen.\n4. Tie each moving layer to meaning (depth, progress, a step in the story), not decoration.\n5. Under prefers-reduced-motion, show a still composition with every piece of content visible.\n6. On small screens, cut distance and the number of moving layers; nothing may depend on hover.\n7. Reserve space for images so nothing shifts while they load. Keep text readable at every point of the motion.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Scrolling stays native; reduced motion shows a still layout with all content","No layout shift while scrolling or loading"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.interactive-ui-concept",
    version: "1.0.0",
    roles: ["coder","debugger"],
    triggers: ["timeline","before/after","before and after","comparison slider","decision tree","onboarding","wizard","stepper","drag","draggable","configurator","command palette","carousel","card stack"],
    enabled: true,
    source: "builtin",
    purpose: "Build interactive UI that people can use with a keyboard, a mouse or touch",
    instructions: "1. Write down what the interaction helps the person decide or do, and its main action.\n2. Decide keyboard and touch behaviour before styling: Tab reaches it, arrow keys move within it, Enter or Space acts, Escape closes.\n3. Use native elements first (button, input type=range, details, dialog); add ARIA only where no native element fits.\n4. Give it every state that applies: default, focus, selected, disabled, loading, empty, error and done.\n5. Nothing essential may be hover-only, colour-only or gesture-only; a drag always has a button or key alternative.\n6. Consequential actions (delete, submit, reset) are explicit buttons with clear names, and say what happened afterwards.\n7. Build the working interaction first, then the visual polish.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Works with keyboard alone, with visible focus","No essential action is hover-only or colour-only"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.svg-workflow-visualization",
    version: "1.0.0",
    roles: ["coder","debugger"],
    triggers: ["workflow map","process map","process diagram","flowchart","flow chart","dependency graph","node graph","nodes and edges","diagram","org chart","mind map"],
    enabled: true,
    source: "builtin",
    purpose: "Draw workflows and node graphs in SVG that people can read, focus and explore",
    instructions: "1. Define the data first: node types, edge types and layout direction, as TypeScript types.\n2. Render with SVG and React. Use Canvas only for thousands of elements; avoid Three.js for diagrams.\n3. Each node is focusable (tabIndex=0, role=\"button\" or a link) with an accessible name; selecting one shows its details beside the diagram.\n4. Show status with a label or icon as well as colour.\n5. Add a plain list or table of the same nodes and links for people who can't use the diagram.\n6. Handle empty data (a message, not a blank box), a single node, dense graphs, and links to missing nodes.\n7. Keep labels legible at the default zoom; add zoom and pan only when the graph needs it.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Every node is reachable by keyboard and has a name","A list or table shows the same content without the diagram"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.data-simulation-scenarios",
    version: "1.0.0",
    roles: ["coder","debugger"],
    triggers: ["simulation","simulator","what-if","what if","scenario","scenarios","forecast","projection","calculator","backtest","replay","compare scenarios"],
    enabled: true,
    source: "builtin",
    purpose: "Build simulations and what-if tools with visible assumptions and tested calculations",
    instructions: "1. Write the model as plain typed functions apart from the UI: inputs, assumptions, formulas, outputs and units.\n2. Show which numbers the person entered, which are calculated, which are estimates, and which are historical.\n3. Show the assumptions on screen next to the result.\n4. Validate inputs: missing, negative, zero and extreme values get a clear message, never NaN or Infinity on screen.\n5. Add unit tests for known cases, boundaries and invalid input; round and format consistently.\n6. Save scenarios only when the feature needs saved work, with the inputs and model version stored together.\n7. Results are estimates, not guarantees. For money, health or legal topics, say so on screen and give no personal advice.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Calculations have unit tests for known, boundary and invalid cases","Assumptions are visible next to results"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.threejs-experience",
    version: "1.0.0",
    roles: ["coder","debugger"],
    triggers: ["three.js","threejs","3d","webgl","3d model","3d scene","globe","virtual gallery","spatial"],
    enabled: true,
    source: "builtin",
    purpose: "Build Three.js scenes that are light, can be left with the keyboard, and have a fallback",
    instructions: "1. Use Three.js only when people must inspect, rotate or move through real 3D space; say so in your summary.\n2. Installing three needs approval: check package.json first and say so if it's missing.\n3. Keep it light: few lights, no shadows unless needed, small textures, one renderer, pixel ratio capped at 2.\n4. Pause the render loop when the canvas is off screen or the tab is hidden.\n5. On unmount, cancel the animation frame, remove listeners, and dispose of geometries, materials, textures and the renderer.\n6. No automatic camera movement under prefers-reduced-motion; never trap keyboard focus in the canvas.\n7. Show the essential information outside the canvas too, and a still image or message when WebGL is unavailable.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["WebGL failure shows a fallback with the essential content","Render loop stops off screen; resources are disposed on unmount"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.database-backed-feature",
    version: "1.0.0",
    roles: ["coder","debugger"],
    triggers: ["permissions","permission","roles","audit trail","audit log","user records","saved scenarios","saved settings","ownership","multi-user","sign in","login","accounts"],
    enabled: true,
    source: "builtin",
    purpose: "Build features with lasting data: entities, ownership, permissions and validation",
    instructions: "1. Name the entities, who owns each record, its lifecycle and its relations, as TypeScript types first.\n2. Decide who can read and write each one, and check it on the server or storage layer, not only in the UI.\n3. Validate at both edges: the form and the code that saves.\n4. A schema or migration change needs approval: write it as a new migration file and say it still has to run.\n5. Keep credentials and privileged access out of browser code.\n6. Design for empty, stale, missing, unauthorised and partly loaded data, and show each clearly.\n7. Deleting or overwriting data asks for confirmation; keep a record of who changed what when edits matter.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Permissions are checked where data is saved, not only in the UI","Destructive changes ask for confirmation"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.ai-assisted-workflow",
    version: "1.0.0",
    roles: ["coder","debugger"],
    triggers: ["ai","llm","chatbot","assistant","summarise","summarize","classify","extraction","extract data","recommendation","review queue","prompt","agent"],
    enabled: true,
    source: "builtin",
    purpose: "Build product features that call an AI model, with structured output and human control",
    instructions: "1. State what the model does, what it receives, and the exact output shape; validate that output with a schema before using it.\n2. Handle loading, retry, time-out, partial results and failure, with a way to continue without AI.\n3. Label AI output as generated, apart from what the person wrote or approved.\n4. When output matters, the person reviews it: edit, approve or reject, never applied silently.\n5. Keep API keys on the server; never in browser code. Don't send personal or sensitive data to an outside service without a stated policy.\n6. Don't word inferences as certain facts.\n7. Log what is needed to debug (timing, model, outcome), not the private content.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["Model output is validated against a schema before use","Consequential output needs a person to approve it"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.visual-qa-verification",
    version: "1.0.0",
    roles: ["coder","debugger","critic"],
    triggers: ["animation","animated","visual","layout","responsive","mobile layout","landing page","hero","redesign"],
    enabled: true,
    source: "builtin",
    purpose: "Check visual and interactive work before claiming it's done",
    instructions: "Before task_complete on visible work:\n1. Read back every file you changed: no repeated rules, no leftover placeholders, every import used.\n2. Check the layout at 375px and desktop widths in the CSS: no fixed widths that overflow, no horizontal scroll.\n3. Every animation has a prefers-reduced-motion alternative; focus styles are visible.\n4. Loading, empty, error and success states exist where data is shown.\n5. Run the checks run_script lists (typecheck, lint, test, build) and fix new errors.\nFlowCode then takes screenshots, runs the accessibility and design checks, and reports anything it couldn't check. Don't claim a visual result you haven't seen; say what the screenshots should show.",
    allowedTools: ["read_file", "search_code", "apply_patch", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-03", note: "From the agent prompt, skill and specification system" }],
  },
  {
    id: "skill.prepare-release-notes",
    version: "1.0.0",
    roles: ["documenter"],
    triggers: ["release notes","changelog","release"],
    enabled: true,
    source: "builtin",
    purpose: "Draft release notes from run records and diffs",
    instructions: "Summarize verified tasks, changed files and unresolved risks from the run report. Cite run and file references.",
    allowedTools: ["read_file"],
    inputSchema: "RunId",
    outputSchema: "Markdown",
    policies: { network: "denied", filesystem: "read_workspace_only" },
    acceptance: ["Every claim maps to a run record"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-01", note: "Initial" }],
  },
  {
    // Condensed from docs/design/ui-ux-pro-max.md (UI/UX Pro Max, MIT, nextlevelbuilder/ui-ux-pro-max-skill). Its
    // tables live as data in knowledge/designDirection.ts, which picks the product's row from the PRD.
    id: "skill.ui-ux-pro-max",
    version: "1.0.1",
    roles: ["planner", "coder", "designer", "critic", "reviewer"],
    triggers: ["polish", "ux review", "design review", "pre-delivery", "accessibility review", "design system", "ui/ux"],
    enabled: true,
    source: "builtin",
    purpose: "Decide the design system for the product first, build to it, then audit the UI against a pre-delivery checklist",
    instructions: `Design first, then build, then verify. Never go straight to code with default styling.
1. The design direction (given with the step) names the product's industry, pattern, style, colour mood, type pairing and what to avoid. The Styles page holds the tokens; the person's own style always wins over the direction.
2. Write the design system in 6 lines before building: pattern, style (3 keywords), colours by role (primary, accent/CTA, background, surface, text, muted, border), type (heading/body, scale), key effects, avoid.
3. Build with tokens only (no raw hex in components), mobile-first, semantic elements and native controls first, one icon set (lucide-react), never emoji as icons, real content.
   Imagery: real, openly licensed photos from find_image wherever the design shows a hero, people, places, products or food (saved into public/images with credits; object-fit: cover; meaningful alt text; width/height or aspect-ratio set so nothing shifts); illustrations as inline SVG in the brand colours. Never grey placeholder boxes or hotlinked images.
4. One visual style; mixing more than two looks incoherent. Max two font families (+ mono for code/data); body 16px, secondary never below 14px; line height 1.5–1.7 body, 1.1–1.3 headings; 45–75 characters per line; tabular numbers for figures.
5. Colour: 1 primary + 1 accent + neutrals; the CTA colour only on primary actions; never meaning by colour alone; dark mode is its own palette, not an inversion.
6. Layout: 4px spacing base (4/8/12/16/24/32/48/64/96); one radius scale; at most 2–3 shadow levels; one primary action per view; group with proximity before borders or boxes.

Pre-delivery checklist (fix failures; say what you couldn't verify):
- Visual: tokens everywhere; ≤2 font families; one primary action per view; CTA colour reserved; one icon set, no emoji; the direction's anti-patterns absent.
- Accessibility: text contrast ≥4.5:1 (≥3:1 large text and control borders); keyboard reachable with visible focus; every input labelled; icon-only buttons named; nothing by colour alone; prefers-reduced-motion respected; touch targets ≥44px.
- Responsive: works at 320, 375, 768, 1024 and 1440px with no sideways scroll; text reflows at 200% zoom; long strings wrap.
- Interaction: hover, focus, active, disabled, loading, empty, error and success states; forms validate on blur or submit, keep input and prevent double submission; destructive actions confirm or undo.
- Performance: images sized and lazy below the fold; no layout shift from fonts or media; animate transform and opacity only.`,
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "replace_file", "create_file"],
    inputSchema: "DesignRequest",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [
      "The design system is written down (pattern, style, colour roles, type, effects, avoid) and the UI follows it",
      "The pre-delivery checklist passes, or what couldn't be verified is stated",
    ],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-06", note: "From the UI/UX Pro Max design intelligence the user supplied (docs/design/ui-ux-pro-max.md); its tables are data in designDirection.ts" }, { version: "1.0.1", date: "2026-10-07", note: "Expanded guidance (shipped without a version bump before)" }],
  },
  {
    // The user wants designs a senior designer would put in a portfolio (the level of the best work on Dribbble and
    // Behance), still usable: one strong, considered design, not several mock-ups.
    id: "skill.art-direction",
    version: "1.0.1",
    roles: ["planner", "coder", "designer", "critic"],
    // Narrow on purpose: screen steps get it from designSkillIds; a one-value colour change or a table fix shouldn't.
    triggers: ["redesign", "landing page", "hero", "art direction", "portfolio", "visual design", "make it beautiful"],
    enabled: true,
    source: "builtin",
    purpose: "Design like a senior product designer: one clear concept, executed with craft, that people would call beautiful and still find easy",
    instructions: `Work like a senior product designer whose screens end up on Dribbble and Behance because they are beautiful and they work. Aim for aspirational, not acceptable.

Before any code, write the concept in 5 lines (keep it in your reply, then build to it):
1. Idea: one sentence about the product's personality (e.g. "a calm paper planner for busy weeks").
2. Composition: the layout's big move (an asymmetric split, a dominant hero metric, a generous single column, a full-bleed board).
3. Type: how the display and body faces create hierarchy (one very large headline or number, then small confident labels; at least 3:1 scale contrast).
4. Colour: the neutral ground, the one brand colour and where it appears (the primary action and the signature moment, not everywhere).
5. Signature moment: the one detail people remember (a beautifully set today block, a progress ring, an illustrated empty state, a satisfying completion animation).

Craft the details:
- Scale and space carry the design: big confident type, generous whitespace (the spacing scale's larger steps between groups), aligned edges on one grid. Fewer, larger elements beat many small ones.
- Compose, don't stack: vary the rhythm (a wide feature area beside a narrow list; full-width bands with dividers), not a column of identical cards.
- Real, specific content from the PRD and the sample data, written like a good product: short labels, human dates ("Thu 9 Oct"), believable names.
- Colour theory, not colour fill: neutrals tinted toward the brand hue (never flat grey); roughly 60% calm ground, 30% supporting surfaces and type, 10% brand accent reserved for the focal point and the primary action; one deliberate contrast moment (a deep brand-tinted band, sidebar or hero) so the screen isn't all white; status colours only for status. Check every text colour against its background (4.5:1 body, 3:1 large).
- Proportion, not size: controls at the kit's sm/md sizes (a primary button isn't a banner); one display-size element per screen and everything else on the type scale below it, so the hierarchy reads at a glance. Nothing oversized just to fill space.
- Every element has a reason and a place on the grid: align to shared edges, group related things, and leave space empty on purpose rather than scattering components across the page.
- Depth with restraint: one elevation level for things that float; subtle surface shifts and hairline dividers for structure.
- Make it feel alive: considered hover, press and focus states; content that enters with a short stagger; a tactile response when something is saved or completed (the kit's ui-screen, ui-stagger and ui-pop).
- Real imagery, openly licensed, like a production product: photos from find_image (it saves CC0, public-domain or CC BY photos into public/images and records their credit) for heroes, cards, product and people shots, cropped with object-fit: cover and given real alt text; icons from lucide-react (one family, consistent size and stroke); illustrations and empty states drawn as inline SVG in the brand colours. Never grey placeholder boxes, hotlinked images, stock clip-art or emoji as decoration. If a photo is CC BY, show the credits (about screen or footer, from src/content/image-credits.json).
- Every state is designed: empty, loading, error, long text, one item and many items.

Beauty never costs usability: text meets contrast, targets are at least 44px on touch, the primary action is obvious, and it works at phone width (rethink the composition for the phone, don't just stack it).

Design judgement: run these checks on your own screen before you finish, and fix what fails.
- Squint test: blur your eyes at the screen. You should still see one focal point, then two or three groups. If everything is the same weight, raise the focal point and quiet the rest.
- 3-second test: a newcomer can tell what the screen is for and what to do first within three seconds.
- Colour budget: count the colours doing work. Brand accent on at most the primary action and the focal point; status colours only for status. If the accent appears in more than three places, take it off the least important ones.
- Remove one thing: find the element that adds the least (a redundant label, a second button, a decorative box) and take it away. Repeat until removing more would hurt.
- Alignment audit: every edge lines up with another or with the grid; spacing between groups is clearly larger than spacing within them.
- Consistency: the same element looks and behaves the same everywhere (buttons, cards, list rows, icons at one size and stroke).
- Category leader: picture the best product in this category (the design direction names the industry). Would this screen hold up next to it? If not, name the gap and close it.
- Industry fit: honour the design direction's colour mood and type pairing, and avoid its anti-patterns.
Then ask: one clear focal point? Real type contrast? Nothing boxed that doesn't need to be? A signature moment? Would you put it in a portfolio?`,
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "replace_file", "create_file"],
    inputSchema: "DesignRequest",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [
      "The step's reply states the concept (idea, composition, type, colour, signature moment) and the screen follows it",
      "One clear focal point, at least 3:1 type scale contrast, and generous spacing between groups",
      "A signature moment and designed empty, loading and error states",
      "Still usable: contrast, 44px touch targets, an obvious primary action, a composition rethought for phone width",
    ],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-06", note: "Aspirational, portfolio-level design: concept first, then craft (the user asked for designs like the best of Dribbble and Behance)" }, { version: "1.0.1", date: "2026-10-07", note: "Expanded guidance (shipped without a version bump before)" }],
  },
  {
    // Condensed from docs/design/avoid-ai-slop.md (the full guide); short enough for local models' context.
    id: "skill.avoid-ai-slop",
    version: "1.1.0",
    roles: ["planner", "coder", "designer", "critic"],
    triggers: ["interface", "layout", "page", "screen", "dashboard", "landing", "empty state", "onboarding", "modal", "dialog", "navigation", "hero", "redesign", "new component", "responsive", "mobile"],
    enabled: true,
    source: "builtin",
    purpose: "Design interfaces with a clear point of view for this product, and avoid generic AI-generated UI",
    instructions: `Design each screen from the product outward, not from a template. Before writing markup or CSS, settle three things:
- What the product does, who uses this screen, and the one job the screen exists for.
- The order of importance: primary action, primary information, then secondary, optional and destructive actions.
- Three to five brand attributes, and how each one shows up in type, spacing, color and copy.

Layout. Start from the content structure. Use cards only for discrete objects, peer comparison, items people select or move, or a separate workflow step. Group everything else with headings, spacing, dividers, a shared grid, a table or a background shift. Skip the reflex of a centered hero followed by three equal cards; use asymmetry when it sharpens the task (a work area beside a narrow context rail, for example). Let content set component height and keep alignment lines consistent.

Typography carries the hierarchy. Use the token type scale. Sentence case for labels and buttons; uppercase only for short metadata. Important content is never tiny grey text. Monospace only for code, IDs, file names and structured data. No giant headings that say nothing.

Color has a job. Build on the neutral scale, one brand color and a few accents. Color marks brand, status, priority, interactivity or data meaning, never decoration alone, and never as the only signal. Red is for destructive or high-risk actions; green is for confirmed success. Text and controls meet WCAG AA contrast.

Effects stay restrained. No decorative gradients, glow blobs, mesh backgrounds, glassmorphism, heavy blur or floating shapes without a brand reason. Shadows only for elevation: modals, popovers, sticky or floating panels, selectable cards. Use the radius tokens and don't round everything. No thick colored left-border accent bars. No emoji as icons. Keep badges, pills and chips to the few that carry real status.

Copy is specific and honest. Say what the user gets or must do ("3 launch blockers need attention"), never slogans. Never write: elevate, unlock your potential, next-generation, seamless, revolutionize, all-in-one, game-changing, built for the future, empower, everything you need, transform the way you work. Never invent testimonials, ratings, logos, user counts, certifications, metrics, client names or case studies; use a clearly marked placeholder, an empty state or a field for real content.
Copy style for all interface text:
- Don't use the words ensure, enable, foster or comprehensive in any form.
- No em dashes. Don't start a sentence with "By".
- No fluffy adjectives, and no "A & B" phrasing.
- Introduce a list with a sentence before the bullets.

Components. Buttons name the next action with a specific verb ("Export launch report", not "Submit"). One primary button per area. Every control has hover, focus, pressed, disabled and loading states. Forms use visible labels (never placeholder-only), mark optional fields, show each error next to its field with how to fix it, and keep what the user typed. Tables hold structured records or comparisons and have a planned mobile behavior. Every status has a text label, a non-color indicator, one consistent meaning and a next step; never "Good" or "Almost done".

States. Build the default, empty, loading, error, success, disabled, long-content and no-results states, plus offline/retry and permission-denied where they apply. An empty state says what the area is for, why it is empty and what to do next, with the action as a button.

Accessibility, WCAG 2.2 AA baseline. Semantic HTML: real buttons and links, never clickable divs. Every control has an accessible name; icons get a label or aria-hidden. Everything works by keyboard with a visible focus that nothing covers. Dialogs move focus in, return it on close and don't trap it. Headings in order. Respect prefers-reduced-motion. Usable at 200% zoom; touch targets at least 44px on mobile. ARIA only where HTML can't express it.

Responsive. Rethink hierarchy for small screens: the primary action stays reachable, no dense multi-column forms, no accidental horizontal scroll, critical content stays visible, navigation is converted on purpose. On desktop, constrain reading and form widths; go wide only for comparison and data.

Dashboards lead with the decision, risk or task that matters now. Use work queues for things to act on, show only charts with a decision attached, and move secondary analytics lower. Never fake data.

Review and readiness products never claim an app is secure or legally compliant. Use "Applicable checks completed", "Requires expert review", "Not assessed". Keep automated, user-attested and expert-reviewed results apart. Credibility comes from evidence and a scope statement, not seals or shield icons.

Implementation. Use design tokens for color, spacing, type, radius, elevation and state; add a token rather than a raw value. Extract components only after real repetition. Never use animation in place of hierarchy.

When unsure, choose clarity over decoration, specifics over slogans, evidence over visual theater, accessibility over fashion, user tasks over ornament, and fewer, stronger decisions.`,
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "replace_file", "create_file"],
    inputSchema: "DesignRequest",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [
      "The screen has one primary action and a visible hierarchy",
      "No invented testimonials, metrics, logos or certifications, and no slogan copy",
      "New features have empty, loading and error states, and every control has an accessible name and visible focus",
    ],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-02", note: "From the Avoid Design AI-Slop Engine guide (docs/design/avoid-ai-slop.md)" }, { version: "1.1.0", date: "2026-10-02", note: "Interface and layout work only; a one-value colour or font change no longer pulls in the full design guide" }],
  },
  {
    id: "skill.prd-intake",
    version: "1.0.0",
    roles: ["planner"],
    triggers: ["prd","product requirements","spec","requirements document","acceptance criteria"],
    enabled: true,
    source: "builtin",
    purpose: "Plan from the PRD's relevant sections only, separating confirmed requirements from assumptions",
    instructions: "You get a PRD section index, not the whole PRD. Before planning, build a brief in the plan's \"brief\" field:\n1. feature: the exact feature, route, component or service the request changes.\n2. sections: the ids of the PRD sections that govern it. Always include acceptance criteria and non-goals sections when they exist.\n3. requirements: each requirement you will build, as one testable sentence with its section id.\n4. assumptions, ambiguities, outOfScope (what the PRD excludes), conflicts: list each separately.\n5. Conflicts: the request wins, then PRD acceptance criteria, then repository instructions, then existing code and tests, then other docs. Name every conflict; never pick silently.\n6. questions: if a choice changes permissions, sign-in, stored data or schema, payments, security, compliance, or deletes anything, put the question here and plan only the parts that don't depend on it.\n7. Give every task the section ids it implements in \"sections\". Map each acceptance criterion in scope to a task check.",
    allowedTools: ["read_file","list_files","search_code"],
    inputSchema: "PrdSectionIndex",
    outputSchema: "ImplementationPlan",
    policies: {network: "denied",filesystem: "read_workspace_only"},
    acceptance: [],
    tests: [],
    changelog: [{version: "1.0.0",date: "2026-10-02",note: "From the agent library review: section-scoped PRD reading with a requirements brief"}],
  },
  {
    id: "skill.acceptance-checks",
    version: "1.0.0",
    roles: ["planner"],
    triggers: ["*"],
    enabled: true,
    source: "builtin",
    purpose: "Write checks that a correct change passes and a wrong change fails",
    instructions: "Write checks that a correct change passes and a wrong change fails:\n- Name only files, components, tokens and scripts that exist, or that a task in this plan creates.\n- \"Contains\" text is one short exact name or declaration (`--color-accent: teal`, `export function useSchedule`), never a whole rule or a guessed snippet.\n- Removing something: file_not_contains for what goes, plus a check that what must stay is still there.\n- Use a verification check (typecheck, lint, tests, build) only if that script exists in package.json.\n- Each check's description says which requirement it proves.",
    allowedTools: [],
    inputSchema: "Plan",
    outputSchema: "AcceptanceCriteria",
    policies: {network: "denied",filesystem: "read_workspace_only"},
    acceptance: [],
    tests: [],
    changelog: [{version: "1.0.0",date: "2026-10-02",note: "From the agent library review: 56% of done claims failed their checks"}],
  },
  {
    id: "skill.exact-patch",
    version: "1.1.0",
    roles: ["coder","debugger"],
    triggers: ["*"],
    enabled: true,
    source: "builtin",
    purpose: "Edit existing files with patches that match the first time",
    instructions: "Editing an existing file with apply_patch:\n1. Copy `find` text character for character from the most recent read of that file (indentation, quotes, punctuation). Never retype it from memory.\n2. Add \"line\": the line number where the find text starts in that read. It picks the right place when the text occurs more than once.\n3. One edit per change; keep each `find` under 6 lines.\n4. If you changed the file earlier in this step, read it again before the next patch.\n5. After a miss, copy the find text from the lines the error shows you. Never send the same `find` twice.",
    allowedTools: ["read_file","apply_patch"],
    inputSchema: "FileEdit",
    outputSchema: "ChangedPaths",
    policies: {network: "denied",filesystem: "governed_write"},
    acceptance: [],
    tests: [],
    changelog: [{version: "1.0.0",date: "2026-10-02",note: "From the agent library review: 39% of patches missed"}, {version: "1.1.0",date: "2026-10-02",note: "Use the line hint; copy from the lines a miss shows"}],
  },
  {
    // From the AgenticSkills tools index (Data & backend, Auth): which hosted backend fits, for the rare PRD that needs
    // real saved data or accounts. Prototypes keep the simulated backend and the pre-filled demo login.
    id: "skill.choose-backend",
    version: "1.0.0",
    roles: ["planner", "coder"],
    triggers: ["real backend", "real database", "user accounts", "cloud sync", "sync across devices", "real-time updates", "multi-user data", "hosted database"],
    enabled: true,
    source: "builtin",
    purpose: "Pick and wire a real backend only when the PRD needs data that outlives the browser or is shared between people",
    instructions: `Default: no backend. A prototype keeps its data in src/sim (simulated API with seeded data, saved locally) and signs in with a demo login whose details are already filled in. Choose a real backend only when the PRD says data must sync across devices, be shared between users, or survive clearing the browser.
When one is needed, pick by what the product does (all have free tiers; say which and why in the plan):
- Supabase: Postgres with sign-in, file storage and real-time updates. The default for relational data and accounts. Use row level security on every table.
- Turso (libSQL): SQLite at the edge, cheap per-user databases, simple schemas.
- Firebase: document data with real-time listeners and offline cache; good for chat-like or live-collaboration apps.
- Convex: queries and mutations as TypeScript functions with reactive results; good when the whole team writes TypeScript.
- Neon: plain serverless Postgres when sign-in comes from elsewhere.
How to wire it:
1. Keep the app talking to one data module (src/data or the sim's interface). Add the real client behind the same functions so screens don't change and the sim stays for tests.
2. Read keys from import.meta.env (VITE_ prefixed, publishable keys only). Never put a secret or service key in the frontend; write .env.example with empty values, never .env.
3. The person creates the project and pastes the keys; never sign up, create accounts or enter credentials yourself.
4. Model the schema from the PRD's data model, with ids, timestamps and owner ids; add the indexes the screens' queries need.
5. Tests keep using the sim; real-backend calls are mocked.`,
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "replace_file", "create_file", "run_script"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: ["The plan names the backend and the PRD requirement that needs it, or keeps the simulated backend", "No secret keys in frontend code; .env.example lists the variables", "Screens use one data module and tests still run on the sim"],
    tests: [],
    changelog: [{ version: "1.0.0", date: "2026-10-06", note: "From the AgenticSkills tools index (Supabase, Turso, Firebase, Convex, Neon): when and how to add a real backend" }],
  },
  // Component recipes from the CSSVibes prompt library.
  ...RECIPE_SKILLS,
  // Design, product, process, frontend, copy, growth and security skills from the AgenticSkills directory.
  ...LIBRARY_SKILLS,
];

export interface RepositoryMap {
  projectType: string;
  packageManager: string;
  facts: Array<{ statement: string; paths: string[] }>;
  inferences: Array<{ statement: string; basis: string[] }>;
  structure: Array<{ dir: string; files: number }>;
  entryPoints: string[];
  scripts: Array<{ name: string; command: string; classification: string; policy: string }>;
  dependencies: { runtime: string[]; dev: string[] };
  tests: string[];
  risks: string[];
}

export function repositoryMap(jail: PathJail): RepositoryMap {
  const pf = detectPreflight("repo-map", jail.root);
  const files = flattenFiles(jail, 8000);
  const facts: RepositoryMap["facts"] = [];
  const inferences: RepositoryMap["inferences"] = [];
  const has = (f: string) => files.includes(f);
  let pkg: Record<string, unknown> | undefined;
  if (has("package.json")) {
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(jail.root, "package.json"), "utf8"));
    } catch {
      facts.push({ statement: "package.json exists but is not valid JSON", paths: ["package.json"] });
    }
  }
  facts.push({ statement: `Detected project type: ${pf.projectType} (signals: ${pf.detectedTypes.join(", ") || "none"})`, paths: ["package.json", "vite.config.ts", "next.config.js", "pyproject.toml"].filter(has) });
  if (pf.packageManager !== "none") facts.push({ statement: `Package manager: ${pf.packageManager}`, paths: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "package.json"].filter(has) });
  const dirCounts = new Map<string, number>();
  for (const f of files) {
    const top = f.includes("/") ? f.split("/").slice(0, f.startsWith("src/") ? 2 : 1).join("/") : ".";
    dirCounts.set(top, (dirCounts.get(top) ?? 0) + 1);
  }
  const entryCandidates = ["src/main.tsx", "src/main.ts", "src/index.tsx", "src/index.ts", "index.html", "app/page.tsx", "pages/index.tsx", "src/App.tsx", "main.py", "app.py", "src/main.rs"].filter(has);
  if (entryCandidates.length) facts.push({ statement: `Entry points: ${entryCandidates.join(", ")}`, paths: entryCandidates });
  const tests = files.filter((f) => /(\.test|\.spec)\.[jt]sx?$|(^|\/)tests?\//.test(f)).slice(0, 50);
  if (tests.length) facts.push({ statement: `${tests.length} test file(s) present`, paths: tests.slice(0, 5) });
  const deps = Object.keys((pkg?.dependencies as Record<string, string>) ?? {});
  const devDeps = Object.keys((pkg?.devDependencies as Record<string, string>) ?? {});
  if (deps.includes("react")) inferences.push({ statement: "UI is built with React", basis: ["package.json dependencies"] });
  if (devDeps.includes("vitest") || deps.includes("vitest")) inferences.push({ statement: "Unit tests use Vitest", basis: ["package.json devDependencies"] });
  if (files.some((f) => f.startsWith(".github/workflows/"))) facts.push({ statement: "GitHub Actions CI workflows exist", paths: files.filter((f) => f.startsWith(".github/workflows/")).slice(0, 5) });
  if (files.some((f) => /tokens?\.css$/.test(f))) inferences.push({ statement: "A design-token stylesheet is used", basis: files.filter((f) => /tokens?\.css$/.test(f)) });
  const risks: string[] = [];
  if (!tests.length) risks.push("No automated tests detected");
  if (pf.missingPrerequisites.length) risks.push(...pf.missingPrerequisites);
  if (pf.scripts.some((s) => s.policy === "never")) risks.push(`Forbidden scripts: ${pf.scripts.filter((s) => s.policy === "never").map((s) => s.name).join(", ")}`);
  if (files.some((f) => jail.isSecretPath(f))) risks.push("Secret-like files are present in the workspace (contents not read)");
  return {
    projectType: pf.projectType,
    packageManager: pf.packageManager,
    facts,
    inferences,
    structure: [...dirCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([dir, n]) => ({ dir, files: n })),
    entryPoints: entryCandidates,
    scripts: pf.scripts.map((s) => ({ name: s.name, command: s.command, classification: s.classification, policy: s.policy })),
    dependencies: { runtime: deps, dev: devDeps },
    tests,
    risks,
  };
}

export function renderRepositoryMap(m: RepositoryMap): string {
  return [
    `# Repository map`,
    `Project type: **${m.projectType}** · Package manager: **${m.packageManager}**`,
    `## Verified facts`,
    ...m.facts.map((f) => `- ${f.statement}${f.paths.length ? ` _(${f.paths.join(", ")})_` : ""}`),
    `## Inferences (not verified)`,
    ...(m.inferences.length ? m.inferences.map((f) => `- ${f.statement} _(basis: ${f.basis.join(", ")})_`) : ["- none"]),
    `## Structure`,
    ...m.structure.map((s) => `- \`${s.dir}\` — ${s.files} files`),
    `## Scripts`,
    ...(m.scripts.length ? m.scripts.map((s) => `- \`${s.name}\`: \`${s.command}\` (${s.classification}, policy: ${s.policy})`) : ["- none"]),
    `## Dependencies`,
    `- runtime: ${m.dependencies.runtime.join(", ") || "none"}`,
    `- dev: ${m.dependencies.dev.join(", ") || "none"}`,
    `## Risks`,
    ...(m.risks.length ? m.risks.map((r) => `- ${r}`) : ["- none detected"]),
  ].join("\n");
}

const STOP = new Set(["the", "and", "with", "from", "that", "this", "into", "then", "when", "only", "each", "their", "have", "will", "must", "should", "using", "use", "add", "make", "file", "files", "page", "app"]);
/** A trigger as a whole word or phrase: "react" doesn't match "reactive", "api" doesn't match "rapid". */
const phrase = (t: string) => new RegExp(`(^|[^a-z0-9])${t.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
/** Words too common in task text to show a skill is relevant on their own. */
const GENERIC = new Set(["design", "tokens", "token", "update", "change", "existing", "project", "file", "files", "component", "components", "code", "uses", "using", "make", "style", "styles", "color", "colour"]);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9#]+/).filter((w) => w.length > 3 && !STOP.has(w)));

/**
 * Picks the skills an agent should follow for a task: enabled, allowed for the role, and relevant to the task text
 * (a trigger phrase matches as a whole word or phrase, or the skill's purpose shares at least three specific words).
 * Best matches first, max 3.
 */
export function selectSkills(skills: SkillSpec[], role: string, taskText: string, max = 3): SkillSpec[] {
  const text = taskText.toLowerCase();
  const tw = words(taskText);
  // A skill for a role that never runs (designer, reviewer, the scans) reaches the agent that does that work.
  const usable = skills.filter((s) => s.enabled !== false && appliesToRole(s.roles, role));
  // Skills with the "*" trigger always apply to their roles, after the best matches: built-in ones first (project
  // rules, exact patching), then learned fixes, the ones closest to this task first.
  const always = usable.filter(isAlways).sort((a, b) => Number(a.source === "user") - Number(b.source === "user") || relevance(b, tw) - relevance(a, tw));
  return [...matched(usable.filter((s) => !always.includes(s)), text, tw, max), ...always];
}

/** Most skills a step's prompt gets. More than this buries a small model in instructions (No GMO App: 11 on one step). */
export const MAX_SKILLS_PER_STEP = 5;
const isAlways = (s: SkillSpec) => (s.triggers ?? []).some((t) => t.trim() === "*");
const relevance = (s: SkillSpec, tw: Set<string>) => [...words(`${s.purpose} ${s.id.replace(/[-.]/g, " ")}`)].filter((w) => tw.has(w) && !GENERIC.has(w)).length;

/**
 * The skills one step gets, capped: the task's best matches, then the project's stack skills, then always-on skills
 * (built-in before learned). Order is priority, so the cap drops the least specific first.
 */
export function capSkills(selected: SkillSpec[], stack: SkillSpec[], cap = MAX_SKILLS_PER_STEP, opts: { design?: SkillSpec[]; retry?: boolean } = {}): SkillSpec[] {
  const out: SkillSpec[] = [];
  const add = (s: SkillSpec) => (out.some((x) => x.id === s.id) ? undefined : out.push(s));
  // Repair skills learned from failed edits ("patch didn't apply in .tsx") only help once something has failed. On a
  // first attempt they took 3-4 of the 5 places and pushed every design skill out (Calculator app's style steps).
  const repair = (s: SkillSpec) => isRepairSkill(s);
  if (opts.retry) selected.filter(repair).forEach(add);
  (opts.design ?? []).forEach(add);
  selected.filter((s) => !isAlways(s) && !repair(s)).forEach(add);
  stack.forEach(add);
  selected.filter((s) => isAlways(s) && !repair(s)).forEach(add);
  if (!opts.retry) selected.filter(repair).forEach(add);
  return out.slice(0, cap);
}

/** Skills FlowCode learned from a failed edit or check (proposals the user accepted), as opposed to guidance. */
export function isRepairSkill(s: SkillSpec): boolean {
  return s.source === "user" && /^skill\.proposed-/.test(s.id) && /\b(fail|fails|failed|failing|errors?|mismatch|ambiguous|patch|patches|exists|guess|doesn't|prevents|resolves|fix|fixes)\b/i.test(`${s.id.replace(/[-.]/g, " ")} ${s.purpose}`);
}

/**
 * Design skills an interface step gets first, so the step builds on the Styles page instead of improvising: the design
 * system (one set of tokens and building blocks), the custom-design playbook for screens, adding tokens when the step
 * styles things, and the anti-generic rules.
 */
export function designSkillIds(taskText: string): string[] {
  const t = taskText.toLowerCase();
  const styling = /\b(styles?|styling|css|tokens?|colou?rs?|theme|themes|palette|visual|look|dark mode|light mode)\b/.test(t);
  const screen = /\b(screens?|pages?|layout|views?|keypad|display|dashboard|component|components)\b/.test(t);
  if (!styling && !screen) return [];
  // Screens are art-directed first: a concept and craft, like a senior designer (micro-feedback is part of it).
  // A polish or review pass gets the UI/UX Pro Max checklist in place of the playbook (it audits rather than composes).
  const audit = /\b(polish|pre-delivery|audit|ux review|design review)\b/.test(t);
  const ids = screen
    ? ["skill.art-direction", audit ? "skill.ui-ux-pro-max" : "skill.interface-design-system", audit ? "skill.interface-design-system" : "skill.design-playbook-custom-ux", "skill.avoid-ai-slop", ...(styling ? ["skill.extend-tokens"] : [])]
    : ["skill.interface-design-system", ...(styling ? ["skill.extend-tokens"] : []), "skill.avoid-ai-slop"];
  // Design is what a prototype is judged on: up to four of the five places go to design.
  return ids.slice(0, 4);
}

/**
 * The process skill each kind of step always gets, the way the AgenticSkills workflows pair skills with stages (plan
 * before code, tests first, debug from the root cause, simplify, verify before done). Picked by the step, not by
 * matching words, so the right one is there every time. Design skills come from designSkillIds.
 */
export function workflowSkillIds(role: string, taskText: string): string[] {
  const t = taskText.toLowerCase();
  if (role === "planner") return ["skill.planning-task-breakdown"];
  if (role === "debugger") return ["skill.systematic-debugging"];
  if (role !== "coder") return [];
  if (/\bacceptance tests?\b|\btest[- ]first\b/.test(t)) return ["skill.test-driven-development"];
  if (/\bclean(?:[- ])?up\b/.test(t)) return ["skill.code-simplification"];
  if (/^assemble the app\b/.test(t)) return ["skill.verification-before-completion"];
  return [];
}

/**
 * One-word triggers that mean something else in everyday task text: "register the service worker" isn't sign-in,
 * "the PRD's colour roles" aren't user roles (Calculator follow-ups got recipe-sign-in and database-backed-feature).
 * On their own they don't pick a skill; with a second sign (another trigger, or the purpose's words) they do.
 */
const AMBIGUOUS = new Set(["register", "roles", "saved", "storage", "api", "copy", "focus", "touch", "scroll", "scrolling", "drag", "monitor", "builder", "explorer", "offline", "submit", "form", "hierarchy", "tracking", "timeline", "widget", "backend", "persist", "keyboard", "sticky", "pinned", "wizard", "stepper", "settings", "polish", "critique", "navigation", "copilot", "calculator", "replay", "projection"]);

function matched(skills: SkillSpec[], text: string, tw: Set<string>, max: number): SkillSpec[] {
  return skills
    .map((s) => {
      const hits = (s.triggers ?? []).filter((t) => t.trim() && phrase(t).test(text));
      const overlap = [...words(s.purpose)].filter((w) => tw.has(w) && !GENERIC.has(w)).length;
      const weak = hits.filter((t) => AMBIGUOUS.has(t.trim().toLowerCase())).length;
      const strong = hits.length - weak;
      // A lone ambiguous word with nothing else pointing at the skill doesn't count.
      const score = strong * 3 + (weak && (strong || weak > 1 || overlap >= 2) ? weak * 2 : 0) + (overlap >= 3 ? overlap : 0);
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.s);
}

/**
 * Tool names the agent doesn't have, rewritten to the ones it does. A proposed skill that says "use search_files"
 * sends the agent to a tool that doesn't exist (skill.proposed-patch-check-ts did, from an old tool list here).
 */
const TOOL_ALIASES: Array<[RegExp, string]> = [
  [/\b(?:search_files|grep_files|grep|find_in_files|search_workspace)\b/g, "search_code"],
  [/\b(?:write_file|edit_file)\b/g, "replace_file"],
  [/\b(?:run_command\s+npm|run_npm|npm_run)\b/g, "run_script"],
  [/\b(?:ls|list_dir|list_directory)\b(?=\s|\(|$)/g, "list_files"],
];
export function fixToolNames(text: string): string {
  return TOOL_ALIASES.reduce((t, [re, to]) => t.replace(re, to), text);
}

/** Skills as a system-prompt section. They come from the user's own library, so they are instructions, not data. */
export function renderSkills(skills: SkillSpec[]): string {
  if (!skills.length) return "";
  const body = skills
    .map((s) => {
      const tools = s.allowedTools.length ? `\nPreferred tools: ${s.allowedTools.join(", ")}` : "";
      const checks = s.acceptance.length ? `\nThe work must satisfy:\n${s.acceptance.map((a) => `- ${a}`).join("\n")}` : "";
      // Skills written before the tool list was right (or by hand) can name tools the agent doesn't have.
      const instructions = s.source === "user" ? fixToolNames(s.instructions) : s.instructions;
      return `### ${s.id}@${s.version}: ${s.purpose}\n${instructions}${tools}${checks}`;
    })
    .join("\n\n");
  return `\n\nSkills to follow for this task (from the project's skill library):\n${body}\nThe runtime's tool permissions still apply; a skill cannot grant extra access.`;
}

/** Skills for the project's stack, added to every coding step whatever the task's wording (Angular, Python, Postgres). */
export function stackSkillIds(detectedTypes: readonly string[]): string[] {
  const ids: string[] = [];
  if (detectedTypes.includes("angular")) ids.push("skill.angular");
  // React + TypeScript: the rules that keep code type-checking the first time (most failed checks were these).
  else if (detectedTypes.includes("react") || detectedTypes.includes("vite") || detectedTypes.includes("nextjs")) ids.push("skill.fix-typescript-error");
  if (detectedTypes.includes("python")) ids.push("skill.python");
  if (detectedTypes.includes("postgres")) ids.push("skill.postgres");
  return ids;
}
