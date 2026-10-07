/** Where a notification leads: a route, optionally the run's Overview, with a short label for the link. */
export type AnnounceLink = { href?: string; overview?: boolean; linkLabel?: string };
import { AboutView } from "./views/AboutView";
import { JournalView } from "./views/JournalView";
import { ApprovalsView } from "./views/ApprovalsView";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { fitSideLists } from "./fitSideLists";
import { APPEARANCE_EVENT, applyTheme, readAppearance, saveAppearance, saveManualTheme, themeFor } from "./appearance";
import { Megaphone, MegaphoneOff, Moon, Sun } from "lucide-react";
import type { Approval, Project } from "@flowcode/contracts";
import { conn, post, useEventStream, useResource } from "./api";
import { Icon, Logo } from "./components/ui";
import { navigate, useRoute } from "./router";
import { ProjectsView } from "./views/ProjectsView";
import { WorkspaceView } from "./views/WorkspaceView";
import { Copilot } from "./components/Copilot";
import { ContextMenu } from "./components/ContextMenu";
import { GlobalSearch } from "./components/GlobalSearch";
import { BuildProgress, rememberBuildProject } from "./components/BuildProgress";
import { AppFooter } from "./components/AppFooter";
import { Modal } from "./components/Modal";
import { onSoundsChange, playSound, setSoundsOn, soundsOn } from "./components/sounds";
import { BackToTop } from "./components/BackToTop";
import { SkeletonBlock, useParallax, useRevealAll } from "./components/motion";
import { CopilotDriver } from "./components/CopilotDriver";

// Heavy pages load on demand (three.js, charts) so startup stays fast.
const KnowledgeView = lazy(() => import("./views/KnowledgeView").then((m) => ({ default: m.KnowledgeView })));
const LibraryView = lazy(() => import("./views/LibraryView").then((m) => ({ default: m.LibraryView })));
const QualityView = lazy(() => import("./views/QualityView").then((m) => ({ default: m.QualityView })));
const ReportsRedirect = lazy(() => import("./views/ReportsView").then((m) => ({ default: m.ReportsRedirect })));
const SettingsView = lazy(() => import("./views/SettingsView").then((m) => ({ default: m.SettingsView })));
const GuideView = lazy(() => import("./views/GuideView").then((m) => ({ default: m.GuideView })));
const ProjectSettingsView = lazy(() => import("./views/SettingsView").then((m) => ({ default: m.ProjectSettingsView })));
const SystemView = lazy(() => import("./views/SystemView").then((m) => ({ default: m.SystemView })));
const AgentsView = lazy(() => import("./views/AgentsView").then((m) => ({ default: m.AgentsView })));
const NetworkView = lazy(() => import("./views/NetworkView").then((m) => ({ default: m.NetworkView })));
const SearchView = lazy(() => import("./views/SearchView").then((m) => ({ default: m.SearchView })));
const TopicsView = lazy(() => import("./views/TopicsView").then((m) => ({ default: m.TopicsView })));
const QualityOverview = lazy(() => import("./views/QualityOverview").then((m) => ({ default: m.QualityOverview })));
const DiscoverView = lazy(() => import("./views/DiscoverView").then((m) => ({ default: m.DiscoverView })));
const PrimitivesView = lazy(() => import("./views/PrimitivesView").then((m) => ({ default: m.PrimitivesView })));
const FlowReportView = lazy(() => import("./flowReport/FlowReportView").then((m) => ({ default: m.FlowReportView })));

function PageSkeleton() {
  return (
    <div className="page">
      <SkeletonBlock rows={6} label="Loading page" />
    </div>
  );
}

/** Primary navigation: Dashboard, then grouped sections. */
const NAV_GROUPS: Array<{ label?: string; items: Array<{ path: string; icon: string; label: string }> }> = [
  { items: [{ path: "/", icon: "home", label: "Dashboard" }] },
  {
    label: "Work",
    items: [
      { path: "/quality", icon: "checklist", label: "My Projects" },
      // Everything waiting on you, and the decision log.
      { path: "/approvals", icon: "flag", label: "Approvals" },
      // Create PRD: research a problem and write the PRD a build starts from.
      { path: "/discover", icon: "compass", label: "Create PRD" },
    ],
  },
  {
    label: "Repo tools",
    // Reports on any repo folder on this computer (not only FlowCode projects).
    items: [{ path: "/flowreport", icon: "reports", label: "FlowReport" }],
  },
  {
    label: "Intelligence",
    items: [
      { path: "/library", icon: "library", label: "Prompts & Skills" },
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
    ],
  },
  {
    label: "System",
    items: [
      { path: "/settings", icon: "settings", label: "System Settings" },
      { path: "/about", icon: "help", label: "About FlowCode" },
      { path: "/guide", icon: "library", label: "Feature guide" },
      { path: "/primitives", icon: "layers", label: "Branding" },
      { path: "/system", icon: "server", label: "System Health" },
    ],
  },
];

export function App() {
  const route = useRoute();
  useRevealAll();
  useParallax();
  useEffect(() => fitSideLists(), []);
  const [announcement, setAnnouncement] = useState("");
  const [copilotOpen, setCopilotOpen] = useState(false);
  // Navigation rail: collapsed (icons) or expanded (icons + labels); remembered per viewer, toggled with Ctrl+B.
  const [navExpanded, setNavExpanded] = useState(() => {
    try {
      return localStorage.getItem("fc.nav") === "expanded";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("fc.nav", navExpanded ? "expanded" : "collapsed");
    } catch {
      /* storage unavailable */
    }
  }, [navExpanded]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !(e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable]")) {
        e.preventDefault();
        setNavExpanded((v) => !v);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  // External links: the desktop app opens them in the default browser itself. In a browser that blocks new tabs
  // (embedded panes), ask the local backend to open them in the default browser instead of doing nothing.
  useEffect(() => {
    if (window.flowcode) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !/^https?:\/\//i.test(a.href) || a.origin === location.origin) return;
      // Never let the link replace FlowCode: embedded browsers either block new tabs or load them in this same tab.
      e.preventDefault();
      void post("/open-external", { url: a.href }).catch(() => {
        // Backend unreachable: last resort, a real new window (may still be blocked by the browser).
        window.open(a.href, "_blank", "noopener");
      });
    };
    addEventListener("click", onClick);
    return () => removeEventListener("click", onClick);
  }, []);
  // Notifications say what happened and to which build, and open the exact place to look (a run's Overview, Approvals).
  const [toasts, setToasts] = useState<Array<{ id: number; text: string } & AnnounceLink>>([]);
  const toastId = useRef(0);
  const announce = useCallback((text: string, link?: AnnounceLink) => {
    setAnnouncement(text);
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, ...(link ?? {}) }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), link?.href ? 9000 : 5000);
  }, []);
  const openToast = (t: AnnounceLink & { id: number }) => {
    if (!t.href) return;
    location.hash = t.href.replace(/^#/, "");
    if (t.overview) window.dispatchEvent(new Event("fc:show-overview"));
    setToasts((all) => all.filter((x) => x.id !== t.id));
  };

  // Every 30 s normally; every 5 s while local models are offline, so the pill turns online as soon as Ollama starts
  // (the setup card checks that often too).
  const [healthMs, setHealthMs] = useState(30_000);
  const health = useResource<{ ok: boolean; providers: { ollama: { ok: boolean; detail: string } } }>("/health", [], healthMs);
  useEffect(() => setHealthMs(health.data && !health.data.providers.ollama.ok ? 5_000 : 30_000), [health.data]);
  const approvals = useResource<Approval[]>("/approvals", [], 0);
  // The page you're on and the projects' names, for notifications about builds you aren't looking at.
  const nav = useRef<{ projectId?: string; names: Map<string, string> }>({ names: new Map() });
  useEventStream("/events?after=999999999", (e) => {
    if (e.type.startsWith("approval.")) approvals.reload();
    // A build you aren't looking at: say which one, and link to the place to act (its builder handles its own).
    if (e.projectId && e.projectId !== nav.current.projectId) {
      const who = nav.current.names.get(e.projectId) ?? "A project";
      const toStatus = (e.data as { to?: string } | undefined)?.to;
      if (e.type === "approval.requested" && !/enhancement/i.test(String((e.data as { kind?: string } | undefined)?.kind ?? ""))) announce(`${who} needs your OK: ${e.message.replace(/^Approval needed \([a-z]+ risk\): /, "")}`, { href: "#/approvals", linkLabel: "Review it" });
      else if (e.type === "run.status_changed" && e.runId && (toStatus === "blocked" || toStatus === "done_unverified" || toStatus === "done" || toStatus === "done_with_warnings")) {
        const what = toStatus === "blocked" ? "stopped and needs a decision" : toStatus === "done_unverified" ? "is ready, but not fully checked" : toStatus === "done_with_warnings" ? "is ready, with notes" : "is ready";
        announce(`${who} ${what}.`, { href: `#/projects/${e.projectId}/runs/${e.runId}`, overview: true, linkLabel: toStatus === "blocked" ? "Decide" : "Open" });
      }
    }
    // Sounds: something blocked (a task or a whole run), or a new approval waiting on you.
    const to = (e.data as { to?: unknown } | undefined)?.to;
    if (e.type === "task.blocked" || (e.type === "run.status_changed" && to === "blocked")) playSound("block");
    else if (e.type === "approval.requested") playSound("alert");
  });
  const [sounds, setSounds] = useState(soundsOn);
  useEffect(() => onSoundsChange(setSounds), []);
  const projects = useResource<Project[]>("/projects", [route.path]);

  const section = route.parts[0] ?? "";
  // Launch readiness now lives in My Projects; old links (/launch, /launch/:id) redirect there.
  useEffect(() => {
    if (section === "launch") location.replace(`#/quality${route.parts[1] ? `/${route.parts[1]}/launch` : ""}`);
  }, [section, route.parts]);
  const projectId = section === "projects" ? route.parts[1] : undefined;
  nav.current = { projectId, names: new Map((projects.data ?? []).map((p) => [p.id, p.name.replace(/\s+/g, " ")])) };
  const projectSettings = section === "projects" && route.parts[2] === "settings";
  useEffect(() => {
    if (section === "diagnostics") location.replace("#/system");
    // Improvements now lives on System Health → Model problems.
    if (section === "improvements") location.replace("#/system/problems");
    // Models & capability lab is a System tab now.
    if (section === "models") location.replace("#/system/models");
    // Build analysis and Compliance report are one page now: FlowReport.
    if (section === "analysis" || section === "compliance") location.replace("#/flowreport");
  }, [section]);
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme ?? "dark");
  const [appearance, setAppearance] = useState(readAppearance);
  // Settings → Appearance changes take effect at once.
  useEffect(() => {
    const sync = () => setAppearance(readAppearance());
    addEventListener(APPEARANCE_EVENT, sync);
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    mq?.addEventListener?.("change", sync);
    return () => (removeEventListener(APPEARANCE_EVENT, sync), mq?.removeEventListener?.("change", sync));
  }, []);
  // Each page shows its theme; a change fades instead of flashing.
  useEffect(() => {
    const next = themeFor(section, appearance);
    applyTheme(next);
    setThemeState(next);
  }, [section, appearance]);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    // Per page: the button sets this page. Following the system: pressing it switches to the manual toggle.
    if (appearance.mode === "custom") saveAppearance({ ...appearance, pages: { ...appearance.pages, [section]: next } });
    else {
      saveManualTheme(next);
      if (appearance.mode === "system") saveAppearance({ ...appearance, mode: "toggle" });
      else applyTheme(next);
      setThemeState(next);
    }
  };
  const runId = section === "projects" && route.parts[2] === "runs" ? route.parts[3] : undefined;
  // Where to return when project settings close: the page you opened them from.
  const beforeSettings = useRef<string>("");
  const lastRun = useRef<Record<string, string>>({});
  useEffect(() => {
    if (section === "projects" && route.parts[2] === "settings") return;
    beforeSettings.current = route.path;
    if (projectId && runId) lastRun.current[projectId] = runId;
  }, [route.path]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeSettings = () => navigate(beforeSettings.current && beforeSettings.current !== route.path ? beforeSettings.current : `/projects/${projectId}`);
  const project = projects.data?.find((p) => p.id === projectId);
  // The last project opened in the builder is the one the top bar shows progress for afterwards.
  useEffect(() => {
    if (projectId) rememberBuildProject(projectId);
  }, [projectId]);

  useEffect(() => {
    const titles: Record<string, string> = { "": "Dashboard", knowledge: "Knowledge Hub", library: "Prompts & Skills", search: "Search", topics: "Research Topics", quality: "My Projects", reports: "Reports", models: "Models", settings: "System Settings", system: "System Health", agents: "Agents", network: "Network Graph", primitives: "Branding", guide: "Feature guide", about: "About FlowCode", approvals: "Approvals", improvements: "Improvements", journal: "Project journal", discover: "Create PRD", flowreport: "FlowReport" };
    document.title = `${project ? project.name : titles[section] ?? "FlowCode"} · FlowCode`;
  }, [section, project]);

  if (!conn.token) {
    return (
      <main className="page" id="main">
        <Logo withWordmark size={34} />
        <h1 className="page__title" style={{ marginTop: 24 }}>Daemon connection missing</h1>
        <p className="dim">Open FlowCode through the desktop app, or start the daemon and open this page with <code className="mono">?port=…&amp;token=…</code>.</p>
      </main>
    );
  }

  // Requests that hold up a build; FlowCode's optional suggestions are counted separately.
  const blockingApprovals = (approvals.data ?? []).filter((a) => a.kind !== "enhancement_idea");
  const pending = blockingApprovals.length;
  const ideasPending = (approvals.data?.length ?? 0) - pending;
  // Reminder: a request that has waited over 5 minutes turns the counter amber-red.
  const oldestWaitMin = blockingApprovals.length ? Math.round((Date.now() - Math.min(...blockingApprovals.map((a) => Date.parse(a.createdAt)))) / 60000) : 0;

  return (
    <div className="app" data-nav={navExpanded ? "expanded" : "collapsed"}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <nav className="rail" aria-label="Primary">
        {/* The logo goes home. Always rendered: the wordmark fades and folds with the rail instead of popping in and out. */}
        <a className="rail__brand" href="#/" aria-label="FlowCode AI: Dashboard" title="Dashboard">
          <Logo size={26} withWordmark />
        </a>
        {NAV_GROUPS.map((g, gi) => (
          <div key={g.label ?? gi} className="rail__group" role="group" aria-label={g.label}>
            {g.label ? (
              <span className="rail__heading" aria-hidden="true">
                {g.label}
              </span>
            ) : null}
            {g.items.map((n) => {
              const active = n.path === "/" ? section === "" || section === "projects" : `/${section}` === n.path || (n.path === "/system" && section === "models");
              return (
                <button key={n.path} data-guide={`nav.${n.path === "/" ? "projects" : n.path.slice(1)}`} className="rail__item" aria-label={n.label} title={n.label} aria-current={active ? "page" : undefined} onClick={() => navigate(n.path)}>
                  <Icon name={n.icon} size={18} />
                  <span className="rail__label">{n.label}</span>
                  {n.path === "/approvals" && pending ? <span className="rail__badge" aria-label={`${pending} approvals waiting`}>{pending}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
        <span className="rail__spacer" />
        <button className="rail__item rail__toggle" aria-expanded={navExpanded} aria-label={navExpanded ? "Collapse navigation" : "Expand navigation"} title={`${navExpanded ? "Collapse" : "Expand"} navigation (Ctrl+B)`} onClick={() => setNavExpanded((v) => !v)}>
          <span className="rail__toggle-icon" aria-hidden="true">
            <Icon name="chevron" size={16} />
          </span>
          <span className="rail__label">Collapse</span>
        </button>
      </nav>

      <header className="topbar">
        <div className="topbar__crumbs">
          {/* The navigation shows the full logo when expanded, so this one fades out then. */}
          <a className="topbar__brand" href="#/" aria-label="FlowCode AI: Dashboard" title="Dashboard" tabIndex={navExpanded ? -1 : undefined} aria-hidden={navExpanded || undefined}>
            FlowCode <em className="brand-ai">AI</em>
          </a>
          {project ? (
            <>
              <span className="topbar__sep" aria-hidden="true">/</span>
              <label className="sr-only" htmlFor="project-switcher">
                Switch project
              </label>
              <select id="project-switcher" className="select" style={{ height: 26, padding: "0 8px", width: "auto", background: "transparent", border: "1px solid var(--line)" }} value={project.id} onChange={(e) => navigate(`/projects/${e.target.value}`)}>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="icon-btn topbar__proj-settings" aria-label={`${project.name} settings`} title="Project settings" onClick={() => navigate(`/projects/${project.id}/settings`)}>
                <Icon name="settings" size={15} />
              </button>
            </>
          ) : null}
        </div>
        {/* Outside the builder only: inside it, the builder shows the build itself. */}
        {projectId ? null : <BuildProgress />}
        <GlobalSearch />
        <button data-guide="topbar.provider" className="provider-pill" onClick={() => navigate(health.data && !health.data.providers.ollama.ok ? "/" : "/system/models")} title={health.data && !health.data.providers.ollama.ok ? "Local models are offline: the Dashboard shows how to set up Ollama" : `${health.data?.providers.ollama.detail ?? "Checking provider"} · open Models & capability lab`}>
          <span className={`led ${health.data ? (health.data.providers.ollama.ok ? "led--ok" : "led--bad") : ""}`} aria-hidden="true" />
          {health.data ? (health.data.providers.ollama.ok ? "Local models · online" : "Local models · offline") : "Provider…"}
        </button>
        <button
          data-guide="topbar.approvals"
          className={`provider-pill${pending && oldestWaitMin >= 5 ? " provider-pill--overdue" : ""}`}
          onClick={() => navigate("/approvals")}
          aria-label={`${pending} approval${pending === 1 ? "" : "s"} waiting${ideasPending ? `, ${ideasPending} suggestion${ideasPending === 1 ? "" : "s"}` : ""}. Open Approvals`}
          title={pending ? `Oldest has waited ${oldestWaitMin} min${ideasPending ? ` · plus ${ideasPending} optional suggestion${ideasPending === 1 ? "" : "s"}` : ""}` : ideasPending ? `${ideasPending} optional suggestion${ideasPending === 1 ? "" : "s"}` : "Nothing waiting on you"}
        >
          <span className={`led ${pending ? (oldestWaitMin >= 5 ? "led--bad" : "led--warn") : ""}`} aria-hidden="true" /> {pending ? `${pending} waiting on you` : ideasPending ? `${ideasPending} suggestion${ideasPending === 1 ? "" : "s"}` : "No approvals"}
        </button>
        <button className="theme-toggle" onClick={() => setSoundsOn(!sounds)} aria-pressed={sounds} aria-label={sounds ? "Mute sounds" : "Turn sounds on"} title={sounds ? "Sounds on: alerts, blocks and chat replies. Click to mute." : "Sounds off. Click to turn on."}>
          {sounds ? <Megaphone size={16} aria-hidden="true" /> : <MegaphoneOff size={16} aria-hidden="true" />}
        </button>
        <button className="theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} title={appearance.mode === "custom" ? `${theme === "light" ? "Dark" : "Light"} theme for this page` : appearance.mode === "system" ? "Following your system theme. Click to choose by hand." : theme === "light" ? "Dark theme" : "Light theme"}>
          {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        </button>
        <button data-guide="topbar.copilot" className="copilot-trigger" onClick={() => setCopilotOpen((o) => !o)} aria-expanded={copilotOpen} aria-controls="copilot-panel" title="Copilot (Ctrl+K)">
          <Logo size={16} />
          <span>Copilot</span>
          <kbd>Ctrl K</kbd>
        </button>
      </header>

      <main id="main" className="view" tabIndex={-1}>
        <Suspense fallback={<PageSkeleton />}>
        <div key={section || "home"} className={`page-enter${section !== "projects" ? " page-enter--footer" : ""}`} style={{ minHeight: "100%" }}>
        {section === "" && <ProjectsView projects={projects.data} reload={projects.reload} />}
        {section === "projects" && projectId && <WorkspaceView key={projectId} projectId={projectId} runId={runId ?? lastRun.current[projectId]} announce={announce} />}
        {projectSettings && projectId ? (
          <Modal className="proj-settings-modal-box" labelledBy="proj-settings-title" onClose={closeSettings}>
            <Suspense fallback={null}>
              <ProjectSettingsView projectId={projectId} onClose={closeSettings} onSaved={closeSettings} />
            </Suspense>
          </Modal>
        ) : null}
        {section === "knowledge" && <KnowledgeView query={route.query} projects={projects.data ?? []} />}
        {section === "library" && <LibraryView query={route.query} />}
        {section === "search" && <SearchView query={route.query} />}
        {section === "topics" && <TopicsView topicId={route.parts[1]} />}
        {section === "quality" && (route.parts[1] ? <QualityView key={route.parts[1]} projectId={route.parts[1]} view={route.parts[2]} runId={route.parts[3]} projects={projects.data ?? []} /> : <QualityOverview projects={projects.data ?? []} reload={projects.reload} />)}
        {section === "reports" && <ReportsRedirect runId={route.parts[1]} />}
        {section === "settings" && <SettingsView projects={projects.data ?? []} />}
        {section === "guide" && <GuideView />}
        {section === "about" && <AboutView />}
        {section === "system" && <SystemView key={route.parts[1] ?? "health"} tab={route.parts[1] as never} />}
        {section === "agents" && <AgentsView />}
        {section === "approvals" && <ApprovalsView projects={projects.data ?? []} />}

        {section === "journal" && <JournalView key={route.parts[1] ?? "first"} projectId={route.parts[1]} runId={route.parts[2]} projects={projects.data ?? []} />}
        {section === "network" && <NetworkView projects={projects.data ?? []} query={route.query} />}
        {section === "primitives" && <PrimitivesView />}
        {section === "discover" && <DiscoverView id={route.parts[1]} />}
        {section === "flowreport" && <FlowReportView projectId={route.parts[1]} />}
        {section !== "projects" ? <AppFooter /> : null}
        </div>
        </Suspense>
      </main>

      <Copilot route={route.path} projectId={projectId} runId={runId} open={copilotOpen} setOpen={setCopilotOpen} />
      <CopilotDriver />
      <ContextMenu />
      <BackToTop route={route.path} />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className="toast-region">
        {toasts.map((t) =>
          t.href ? (
            <button key={t.id} type="button" className="toast toast--link reveal" onClick={() => openToast(t)}>
              <span>{t.text}</span>
              <span className="toast__go">{t.linkLabel ?? "Open"} →</span>
            </button>
          ) : (
            <div key={t.id} className="toast reveal" aria-hidden="true">
              {t.text}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
