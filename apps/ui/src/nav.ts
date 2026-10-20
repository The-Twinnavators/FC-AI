/** The side navigation's pages, in order and grouped (also the choices for Settings → Start page). */
export const NAV_GROUPS: Array<{ label?: string; items: Array<{ path: string; icon: string; label: string }> }> = [
  // Create PRD sits right under Home: the two places a build starts (research a problem and write the PRD it starts from).
  { items: [{ path: "/", icon: "home", label: "Home" }, { path: "/discover", icon: "write", label: "Create PRD" }, { path: "/dashboard", icon: "gauge", label: "Dashboard" }] },
  {
    label: "Work",
    items: [
      { path: "/quality", icon: "checklist", label: "My Projects" },
      // Everything waiting on you, and the decision log.
      { path: "/approvals", icon: "thumbsUp", label: "Approvals" },
    ],
  },
  {
    label: "Repo tools",
    // Reports on any repo folder on this computer (not only FlowCode projects).
    items: [{ path: "/flowreport", icon: "folderOpen", label: "Repo Report" }],
  },
  {
    label: "Intelligence",
    items: [
      { path: "/library", icon: "library", label: "Prompts & Skills" },
      { path: "/components", icon: "layers", label: "Component library" },
      // The motion patterns, running live (a review harness, not the builder).
      { path: "/motion", icon: "play", label: "Motion Lab" },
      { path: "/knowledge", icon: "bulb", label: "Knowledge Hub" },
      { path: "/topics", icon: "search", label: "Topic Search" },
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
      // About FlowCode has three tabs: About, Walkthrough and Feature guide (LearnTabs).
      { path: "/about", icon: "flowcode", label: "About FlowCode" },
      // FlowCode's own look: its brand, icons and the components the app is built from.
      { path: "/primitives", icon: "palette", label: "Branding" },
      { path: "/settings", icon: "settings", label: "Settings" },
      { path: "/system", icon: "gauge", label: "System" },
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
 * At launch: open the chosen start page when FlowCode opens with no page of its own (no address, or Home's),
 * once per window, so a reload or the logo still shows Home after that.
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
