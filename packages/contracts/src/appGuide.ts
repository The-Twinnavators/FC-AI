/**
 * App guide: the Copilot's map of FlowCode. Each anchor is a real element in the UI (data-guide="id"),
 * the page it lives on, and what it does. The daemon gives this to the model; the UI uses it to navigate
 * and spotlight. Keep descriptions factual — they are the Copilot's ground truth about the product.
 */
export interface GuideAnchor {
  id: string;
  /** Route pattern; ":project" means the current (or first) project's workspace. "*" means every page. */
  route: string;
  title: string;
  description: string;
  keywords: string[];
}

export const APP_GUIDE: GuideAnchor[] = [
  // Global chrome
  { id: "nav.projects", route: "*", title: "Dashboard", description: "Home: start a prototype and see My Projects.", keywords: ["home", "projects", "builds", "start"] },
  { id: "nav.agents", route: "*", title: "Agents", description: "Live map of agent roles, their models and the tools they call, with the Plan → Implement → Repair → Verify pipeline.", keywords: ["agents", "who", "activity", "pipeline", "visual"] },
  { id: "nav.components", route: "*", title: "Component library", description: "The ready page sections FlowCode builds from, shown live in any visual style, with their code.", keywords: ["components", "sections", "library", "templates", "blocks"] },
  { id: "nav.pipeline", route: "*", title: "Skill pipeline", description: "How skills flow into your builds over 24h, 7 or 30 days: library changes, skills agents picked, the steps that used them and whether checks passed.", keywords: ["pipeline", "skills", "usage", "activity"] },
  { id: "nav.network", route: "*", title: "Network Graph", description: "Interactive 3D knowledge graph of projects, runs, tasks, files, requirements, knowledge, agents, models and tools.", keywords: ["network", "graph", "knowledge graph", "3d", "relationships"] },
  { id: "nav.knowledge", route: "*", title: "Knowledge Hub", description: "Search files, decisions, sources and history; record decisions; run research with consent; map the repository.", keywords: ["knowledge", "search", "memory", "research", "decision"] },
  { id: "nav.library", route: "*", title: "Prompts & Skills", description: "Versioned prompts and skills the agents use; edit a prompt to create a new version.", keywords: ["prompts", "skills", "library", "versions"] },
  { id: "nav.launch", route: "*", title: "Launch readiness", description: "In My Projects, each project's Launch readiness checklist: what the prototype simulates or leaves out, for when you build the real application. Every item has a prompt for a coding agent; download it as Markdown.", keywords: ["launch", "readiness", "checklist", "lrc", "real app", "ship", "go live", "markdown"] },
  { id: "ws.launch", route: ":project", title: "Launch readiness", description: "Opens this project's Launch readiness checklist: the work to build the real application from the prototype.", keywords: ["launch", "checklist", "readiness", "lrc", "real app"] },
  { id: "lrc.filters", route: "/quality", title: "Checklist filters", description: "Filter items by Completed, In progress, Needs review or Not started.", keywords: ["filter", "needs review", "completed"] },
  { id: "lrc.rescan", route: "/quality", title: "Re-scan codebase", description: "Re-reads tasks, checks, workspace files and git state. The page also refreshes every few seconds on its own.", keywords: ["rescan", "refresh", "scan"] },
  { id: "nav.quality", route: "*", title: "My Projects", description: "One page per project with its Prototype plan, Launch readiness checklist, run reports, performance and a repository intelligence report.", keywords: ["quality", "launch", "readiness", "projects", "prototype plan"] },
  { id: "nav.flowreport", route: "*", title: "Repo Report", description: "Choose any repo folder on this computer and get one report on it: an overall health score and fifteen sections (error handling, engineering quality, security, compliance, accessibility, SEO, data architecture and more), each finding with where it is, why it matters, what to do and a Claude Code prompt. Mark findings resolved with a reason, import responses from a Markdown document, compare runs over time, and export PDF or Markdown (whole report or one per section). Files are only read.", keywords: ["flowreport", "flow report", "report", "build analysis", "compliance", "repo health", "scan repo", "folder", "health score", "security", "privacy", "accessibility", "seo", "audit"] },
  { id: "nav.reports", route: "*", title: "Reports", description: "Evidence-backed run reports with Markdown and PDF export.", keywords: ["report", "export", "pdf", "markdown", "evidence"] },
  { id: "nav.models", route: "*", title: "Models & capability lab", description: "Run the 8-probe Coder capability test and assign models to roles. Only a model that passes every probe can be the Coder.", keywords: ["model", "capability", "coder", "ollama", "probe", "lab"] },
  { id: "nav.system", route: "*", title: "System Health", description: "Daemon health and controls (stop, restart, pause scheduler), environment & connections, models and the AI engine.", keywords: ["system", "daemon", "restart", "environment", "connections", "health"] },
  { id: "nav.settings", route: "*", title: "Settings", description: "Per-project autonomy level and policy, retention, appearance and what data leaves the machine.", keywords: ["settings", "policy", "theme", "retention", "privacy"] },
  { id: "topbar.search", route: "*", title: "Global search", description: "Searches files, knowledge, prompts, skills and run history.", keywords: ["search", "find"] },
  { id: "topbar.provider", route: "*", title: "Provider status", description: "Shows whether the local model provider (Ollama) is online.", keywords: ["ollama", "online", "offline", "provider"] },
  { id: "topbar.copilot", route: "*", title: "Copilot", description: "Opens the app-aware Copilot in a docked side panel (Ctrl+K). It answers questions about FlowCode and highlights the parts of the screen it is describing.", keywords: ["copilot", "help", "assistant", "ask"] },
  { id: "nav.approvals", route: "*", title: "Approvals", description: "Decisions waiting on you across projects; the badge shows how many.", keywords: ["approvals", "pending", "waiting"] },
  // Home
  { id: "newbuild.form", route: "/", title: "How FlowCode works", description: "Six tabs from writing a PRD to handing off the real app, and Start a prototype, which opens New build as a 4-step modal. Describe what to build, optionally attach a PRD (.md) plus HTML/CSS/JSON and images of the look, choose autonomy, and start.", keywords: ["new", "build", "create", "prd", "spec", "start"] },
  { id: "newbuild.description", route: "/", title: "What are you building?", description: "Your description is scored live; name who uses it, what they do and the data involved to avoid a generic result.", keywords: ["description", "score", "generic", "request"] },
  { id: "newbuild.files", route: "/", title: "Spec files", description: "Drop a PRD and HTML/CSS/JSON. FlowCode builds the prototype from the PRD and checks that every word, link and form field of your HTML survives (spec fidelity check).", keywords: ["files", "upload", "prd", "html", "css", "json", "fidelity", "drop"] },
  { id: "newbuild.starter", route: "/", title: "Start from", description: "The starter FlowCode scaffolds into an empty folder: React + Vite, or Angular 21. Both come with design tokens, unit tests, a type check and a live preview; FlowCode then plans your request on top.", keywords: ["starter", "template", "angular", "react", "vite", "scaffold"] },
  { id: "newbuild.autonomy", route: "/", title: "Autonomy level", description: "Supervised asks for every consequential step; Assisted auto-approves routine steps; Autonomous runs end to end. External research and hosted models always ask.", keywords: ["autonomy", "autonomous", "assisted", "supervised", "approvals", "manual"] },
  { id: "projects.list", route: "/", title: "My Projects", description: "Your four most recent projects with their latest run status; View all projects opens My Projects.", keywords: ["list", "builds", "projects"] },
  // Workspace
  { id: "ws.files", route: ":project", title: "Files", description: "Workspace file tree; files changed in the current run are highlighted; secret files are listed but never readable.", keywords: ["files", "tree", "explorer"] },
  { id: "ws.preflight", route: ":project", title: "Preflight", description: "Detected project type, package manager, manifest validity, preview strategy and which checks may run automatically.", keywords: ["preflight", "project type", "scripts"] },
  { id: "ws.work", route: ":project", title: "Work column", description: "The current request, its plan and tasks with acceptance criteria. The agents' messages and tool calls are in the Agents tab on the right.", keywords: ["work", "plan", "tasks", "conversation"] },
  { id: "ws.tasks", route: ":project", title: "Tasks", description: "Each task's status, attempts, acceptance criteria (met or not, with evidence) and any blocker with the next action; Retry and Roll back live here.", keywords: ["tasks", "blocked", "criteria", "retry", "rollback", "why"] },
  { id: "ws.tabs", route: ":project", title: "Preview · Design · Review · Activity · Technical output", description: "Live preview and screenshots; styles, screens and specs; what changed and what was checked (with undo); what FlowCode did, step by step; raw command output and runtime details.", keywords: ["preview", "design", "styles", "review", "changes", "diff", "checks", "terminal", "activity", "diagnostics", "restore", "checkpoint"] },
  { id: "ws.strip", route: ":project", title: "Signal strip (verification matrix)", description: "Every verification check as a light: green passed, amber warning, red failed/blocked, grey not run. A * marks checks required for Done.", keywords: ["signal", "verification", "matrix", "checks", "done", "lights", "green", "red"] },
  { id: "ws.controls", route: ":project", title: "Run controls", description: "Start, Resume, Cancel and New request. Cancel stops every owned process; Resume continues from the current task.", keywords: ["cancel", "resume", "start", "stop", "controls"] },
  // Other pages
  { id: "models.lab", route: "/system/models", title: "Coder capability lab", description: "Runs eight probes (read, create, patch, protected manifest edit, follow-up, approval, command interpretation, repair loop) in a disposable workspace.", keywords: ["capability", "probe", "lab", "test", "coder"] },
  { id: "models.roles", route: "/system/models", title: "Role assignments", description: "Which model each agent role uses; the Coder must have passed the lab.", keywords: ["roles", "assign", "model"] },
  { id: "system.controls", route: "/system", title: "Daemon controls", description: "Stop, Restart and Pause/Resume scheduler. Pausing lets running tasks finish and starts no new ones.", keywords: ["stop", "restart", "pause", "daemon", "scheduler"] },
  { id: "system.health", route: "/system", title: "Health & controls", description: "Uptime, version, active runs, queue depth and each subsystem's status, plus the system log.", keywords: ["health", "uptime", "status", "subsystems", "log"] },
  { id: "system.tabs", route: "/system", title: "Environment, models and AI engine", description: "Toolchain and connection status (secrets shown only as set/missing), allowed directories, the Models & capability lab, and local models with context and usage. The tools agents can call are listed on the Agents page under Agent tools.", keywords: ["environment", "connections", "engine", "tools", "directories"] },
  { id: "settings.autonomy", route: "/settings", title: "Project autonomy", description: "Change a project's autonomy level at any time; the policy applies to the next approval request.", keywords: ["autonomy", "settings", "approvals"] },
  { id: "network.canvas", route: "/network", title: "Graph canvas", description: "Drag to rotate, right-drag to pan, scroll to zoom, click a node to inspect its links.", keywords: ["graph", "rotate", "node", "canvas"] },
  { id: "network.panel", route: "/network", title: "Categories and inspector", description: "Search nodes, expand categories, and inspect a node's receives-from and sends-to links.", keywords: ["categories", "inspect", "search nodes"] },
  { id: "agents.map", route: "/agents", title: "Agent map", description: "Agents around the orchestrator, linked to the tools they use; pulses show live tool calls and halos mark active agents.", keywords: ["agent map", "live", "pulses"] },
  { id: "agents.pipeline", route: "/agents", title: "Pipeline", description: "Plan, Implement, Repair and Verify counts with 24h/7d sparklines from the event log.", keywords: ["pipeline", "sparkline", "stages"] },
  { id: "knowledge.search", route: "/knowledge", title: "Knowledge search", description: "Full-text (and optional semantic) search with provenance for every result.", keywords: ["search", "provenance", "semantic"] },
  { id: "knowledge.research", route: "/knowledge", title: "Research", description: "Plans search queries and asks before anything leaves the machine; results are stored as cited sources and claims.", keywords: ["research", "web", "citations", "consent"] },
  { id: "reports.export", route: "/reports", title: "Export", description: "Export the selected run's report as Markdown or PDF.", keywords: ["export", "pdf", "markdown"] },
];

/** Deterministic fallback when no model is available: best-matching anchors by keyword overlap. */
export function matchGuide(question: string, limit = 3): GuideAnchor[] {
  const q = question.toLowerCase();
  const words = new Set(q.split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  return APP_GUIDE.map((a) => {
    let score = 0;
    for (const k of a.keywords) if (q.includes(k)) score += k.includes(" ") ? 3 : 2;
    for (const w of a.title.toLowerCase().split(/\W+/)) if (words.has(w)) score += 1;
    return { a, score };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a);
}
