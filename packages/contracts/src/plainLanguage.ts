/**
 * Plain-language wording for everything FlowCode shows about a build: statuses, checks and errors. One dictionary so
 * the same thing reads the same everywhere, written for people who don't code. Technical names stay available behind
 * "Technical details".
 */

/** Statuses of builds (runs), steps (tasks), checks and commands, in everyday words. */
const STATUS: Record<string, string> = {
  // builds
  draft: "Planning",
  awaiting_approval: "Needs your OK",
  running: "Building",
  recovering: "Fixing a problem",
  verifying: "Checking your app",
  done: "Ready",
  done_with_warnings: "Ready, with notes",
  done_unverified: "Ready, not fully checked",
  blocked: "Needs your help",
  failed: "Stopped",
  cancelled: "Cancelled",
  // steps
  pending: "Waiting",
  // Tried and not finished; it gets another turn after the step that is running now.
  attempted: "Will retry",
  invalidated: "Paused",
  verified: "Done",
  skipped: "Skipped",
  // checks
  passed: "Passed",
  passed_with_warnings: "Passed, with notes",
  not_run: "Not checked yet",
  // commands
  queued: "Waiting",
  succeeded: "Finished",
  timed_out: "Took too long",
  rejected: "Not allowed",
};

export function statusLabel(status: string | undefined): string {
  if (!status) return "Not started";
  return STATUS[status] ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** The checks FlowCode runs on an app: a short name and one sentence a beginner understands. */
export const CHECKS: Record<string, { name: string; short: string; explain: string }> = {
  project_preflight: { name: "Project ready", short: "Ready", explain: "FlowCode looked at the project's files to see how to run it." },
  manifest_validation: { name: "Project file", short: "Project", explain: "The file that lists the app's name, scripts and required packages is valid." },
  install: { name: "Required packages", short: "Packages", explain: "The other code your app uses has been downloaded." },
  typecheck: { name: "Code check", short: "Code", explain: "The code was checked for mistakes before running it." },
  lint: { name: "Code style", short: "Style", explain: "The code follows consistent writing rules that catch common slips." },
  tests: { name: "Automatic tests", short: "Tests", explain: "Small automatic tests confirm parts of the app still work." },
  build: { name: "App packaging", short: "Package", explain: "The app was packaged the way it would be for sharing or publishing." },
  app_wiring: { name: "Screens connected", short: "Screens", explain: "Every screen that was built can be reached in the app." },
  server_start: { name: "App starts", short: "Starts", explain: "The app opened on this computer." },
  preview_health: { name: "Preview opens", short: "Preview", explain: "The preview loaded without errors." },
  screenshots: { name: "Screenshots", short: "Shots", explain: "Pictures of the app at phone, tablet and desktop sizes." },
  accessibility: { name: "Accessibility", short: "Access", explain: "Automatic checks that people using a keyboard or screen reader can use the app." },
  design_qa: { name: "Design check", short: "Design", explain: "The screens were checked for layout, contrast, placeholder text and phone size." },
  visual_critique: { name: "Design review", short: "Review", explain: "A review of the screenshots for visual polish." },
  spec_fidelity: { name: "Matches your spec", short: "Spec", explain: "The app includes the words, links and fields from your reference page." },
  security_scan: { name: "Security", short: "Security", explain: "A scan for common security mistakes, such as secrets left in the code." },
  compliance_triage: { name: "Policy check", short: "Policy", explain: "A scan for privacy and policy topics worth a human look." },
  seo: { name: "Search basics", short: "Search", explain: "Page titles and descriptions that help search engines." },
  final_report: { name: "Summary report", short: "Report", explain: "A written summary of what was built and checked." },
};

export function checkName(kind: string): string {
  return CHECKS[kind]?.name ?? kind.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** What FlowCode is doing for a step, said simply ("Adding required packages…"). */
export function stepActivity(title: string): string {
  const t = title.trim();
  const rules: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
    [/^scaffold/i, "Setting up your project…"],
    [/install dependencies/i, "Adding required packages…"],
    [/import spec references/i, "Reading your spec…"],
    [/building blocks/i, "Adding ready-made building blocks…"],
    [/spec's look|apply the .*look/i, "Applying your colours and style…"],
    [/layout and navigation/i, "Creating the app's layout and navigation…"],
    [/^assemble/i, "Connecting all the screens…"],
    [/^(verify|check)/i, "Checking that your app works…"],
    [/^(implement|build|add|create)\s+(?:the\s+)?(.+)$/i, (m) => `Creating ${m[2].replace(/\s+with\s+.*$/i, "")}…`],
    [/^(fix|repair)\s+(.+)$/i, (m) => `Fixing ${m[2]}…`],
    [/^(reorgani[sz]e|restructure|refactor|update|improve|redesign|polish|move|style|rework)\s+(.+)$/i, (m) => `Improving ${m[2]}…`],
    [/^(ensure|make sure|confirm)\s+(.+)$/i, (m) => `Making sure ${m[2]}…`],
  ];
  // File names and code identifiers mean nothing to most people.
  const tidy = (x: string) => x.replace(/\s+to use [^,]+? for /i, " for ").replace(/\s+in src\/\S*/gi, "").replace(/\bsrc\/\S*/gi, "the app").replace(/\s*\b[\w./-]+\.(tsx?|jsx?|css|html|json|md)\b/g, " the app").replace(/\b(use[A-Z]\w+|[A-Z][a-z]+[A-Z]\w+)\b/g, (w) => w.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()).replace(/\s{2,}/g, " ").replace(/ the app the app/g, " the app").trim();
  for (const [re, out] of rules) {
    const m = t.match(re);
    if (m) return tidy(typeof out === "string" ? out : out(m));
  }
  return `Working on: ${t}`;
}

export interface FriendlyError {
  title: string;
  explain: string;
  next: string;
  /** The original text, for "Technical details". */
  technical?: string;
}

/**
 * Turns a raw error (from the engine, the browser or a tool) into what happened, why it matters and what to do.
 * Unknown errors still get a calm, specific frame and keep their text for "Technical details".
 */
export function friendlyError(raw: string | undefined, doing = "do that"): FriendlyError {
  const text = (raw ?? "").trim();
  const t = text.toLowerCase();
  const out = (title: string, explain: string, next: string): FriendlyError => ({ title, explain, next, technical: text || undefined });
  if (/failed to fetch|networkerror|econnrefused|could not connect|load failed|fetch failed/.test(t))
    return out("We can't reach FlowCode's engine", "The part of FlowCode that builds and runs apps isn't answering. It may be starting up or may have stopped.", "Wait a few seconds and try again. If it keeps happening, open System Health and choose Restart.");
  if (/unauthori[sz]ed|\b401\b|forbidden|\b403\b/.test(t))
    return out("FlowCode couldn't confirm this window", "The connection to FlowCode's engine wasn't accepted.", "Reload the page. If you opened FlowCode from a link, open it from the app instead.");
  if (/not found|\b404\b|does not exist|no such file/.test(t))
    return out("We couldn't find that", "It may have been moved, renamed or deleted.", "Go back and open it again from the list.");
  if (/timed? ?out|took too long|etimedout/.test(t))
    return out("That took too long", "The step didn't finish in the time allowed. Your work so far is saved.", "Try again. If it keeps happening, check your internet connection.");
  if (/dependenc(y|ies) (are )?not installed|node_modules|npm install|install (failed|timed out)/.test(t))
    return out("Your project needs its required packages", "Required packages are other code your app uses. They haven't been added yet.", "Choose Resume to add them, then try again.");
  if (/type ?check|typescript|ts\d{4}|cannot find name|is not assignable/.test(t))
    return out("We found a code issue", "One file has a mistake that stops the app from starting.", "Open Troubleshoot to see the file and the suggested fix.");
  if (/schema validation|valid plan|unexpected token|in json at position|expected .{1,6} after array element/.test(t))
    return out("The plan came back incomplete", "The AI's answer was cut off or in the wrong shape.", "Choose Resume to plan again. Shorter, clearer requests plan faster.");
  if (/ollama|model (is )?(not|un)available|model error|provider (error|unreachable)|no model/.test(t))
    return out("The local AI model isn't responding", "FlowCode uses an AI model on this computer, and it didn't answer.", "Check that Ollama is running (System Health → Models & capability lab), then try again.");
  if (/approval|denied/.test(t))
    return out("This needs your OK", "FlowCode paused before doing something that needs permission.", "Open Approvals to review it.");
  // A message that is already a readable sentence is shown as it is; raw technical text gets a calm frame instead.
  const readable = text.length > 0 && text.length < 220 && !/[{}<>]|\bat \w+ \(|\w+Error:|[\\/][\w.-]+[\\/]|ENOENT|EPERM|\bundefined\b|\bnull\b|\bstatus \d{3}\b|HTTP \d{3}/.test(text);
  if (readable) return { title: `We couldn't ${doing}`, explain: text.replace(/^\w/, (c) => c.toUpperCase()), next: "Fix that and try again." };
  return out(`We couldn't ${doing}`, "Something stopped this from finishing. Your work so far is saved.", "Try again. If it happens again, open Technical details and share them with support.");
}

/**
 * A skipped check whose summary says it failed to run (no credit, model unreachable, an HTTP error), rather than that it
 * wasn't needed. Such a check verified nothing and must never read as passed or harmlessly skipped.
 */
export function checkCouldNotRun(status: string | undefined, summary: string | undefined): boolean {
  return status === "skipped" && /\b(failed|error|unavailable|unreachable|not reachable|credit|quota|rate.?limit|timed? ?out|no (vision|critic|browser|model)|could not|couldn't|cannot|can't|HTTP \d{3})\b/i.test(summary ?? "");
}

/**
 * Whether a chat message asks something rather than requests a change. Questions ("why did the run stop?") are
 * answered; they must never start a build. "Can you add a footer?" is a change request, not a question.
 */
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length > 400 || t.split("\n").filter((l) => l.trim()).length > 2) return false;
  const change = /^(please\s+)?((can|could|would|will) you\s+(please\s+)?)?(add|make|change|fix|remove|delete|update|create|build|move|rename|replace|use|set|turn|show|hide|put|redesign|restyle|improve|implement|apply|swap|increase|decrease|align|center|resize)\b/;
  if (change.test(t)) return false;
  return t.endsWith("?") || /^(what|why|how|when|where|who|which|is|are|was|were|does|do|did|has|have|should|whats|what's|hows|how's|why's)\b/.test(t);
}
