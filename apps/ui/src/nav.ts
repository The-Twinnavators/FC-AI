/** The side navigation's pages, in order and grouped (also the choices for Settings → Start page). */
export const NAV_GROUPS: Array<{ label?: string; items: Array<{ path: string; icon: string; label: string }> }> = [
  { items: [{ path: "/", icon: "home", label: "Dashboard" }] },
  {
    label: "Work",
    items: [
      { path: "/quality", icon: "checklist", label: "My Projects" },
      // Create PRD: research a problem and write the PRD a build starts from.
      { path: "/discover", icon: "compass", label: "Create PRD" },
      // Everything waiting on you, and the decision log.
      { path: "/approvals", icon: "flag", label: "Approvals" },
    ],
  },
  {
    label: "Repo tools",
    // Reports on any repo folder on this computer (not only FlowCode projects).
    items: [{ path: "/flowreport", icon: "reports", label: "Repo Report" }],
  },
  {
    label: "Intelligence",
    items: [
      { path: "/library", icon: "library", label: "Prompts & Skills" },
      { path: "/components", icon: "layers", label: "Component library" },
      { path: "/knowledge", icon: "knowledge", label: "Knowledge Hub" },
      { path: "/topics", icon: "search", label: "Research Topics" },
      // What FlowCode proposes to change about how it works, from run reviews.
    ],
  },
  {
    label: "Data process",
    items: [
      { path: "/agents", icon: "agents", label: "Agents" },
      { path: "/network", icon: "network", label: "Network Graph" },
      { path: "/pipeline", icon: "diagnostics", label: "Skill pipeline" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/about", icon: "help", label: "About FlowCode" },
      { path: "/guide", icon: "library", label: "Feature guide" },
      { path: "/settings", icon: "settings", label: "Settings" },
      { path: "/primitives", icon: "layers", label: "Branding" },
      { path: "/system", icon: "server", label: "System Health" },
    ],
  },
];

/** The page FlowCode opens on when it starts (Settings → Start page). Saved for this browser; the Dashboard by default. */
const START_KEY = "fc.startPage";
const PATHS = () => NAV_GROUPS.flatMap((g) => g.items.map((i) => i.path));

export function readStartPage(): string {
  try {
    const p = localStorage.getItem(START_KEY);
    return p && PATHS().includes(p) ? p : "/";
  } catch {
    return "/";
  }
}

export function saveStartPage(path: string) {
  try {
    localStorage.setItem(START_KEY, path);
  } catch {
    /* kept for this visit only */
  }
}

/**
 * At launch: open the chosen start page when FlowCode opens with no page of its own (no address, or the Dashboard's),
 * once per window, so a reload or the logo still shows the Dashboard after that.
 */
export function applyStartPage() {
  const start = readStartPage();
  let started = false;
  try {
    started = sessionStorage.getItem("fc.started") === "1";
    sessionStorage.setItem("fc.started", "1");
  } catch {
    /* storage unavailable: apply each load */
  }
  if (started || start === "/") return;
  if (["", "#", "#/"].includes(location.hash)) location.replace(`#${start}`);
}
