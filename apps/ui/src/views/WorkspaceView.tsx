/**
 * Workspace (§14.1): files/knowledge · task/plan/work · preview/changes/activity/terminal/approvals/
 * diagnostics, with the verification signal strip and run controls along the bottom.
 */
import { COMPOSE_EVENT, PointAndSay } from "../components/PointAndSay";
import { PatchButton } from "../components/PatchButton";
import { BlockerAdvice } from "../components/BlockerAdvice";
import { ChangeImpactPanel } from "../components/ChangeImpactPanel";
import { RunModelsPanel } from "../components/RunModelsPanel";
import { useDisplayMode } from "../displayMode";
import { RobotHead, ROLE_COLOR, ROLE_LABEL, workingRole } from "../components/RobotHead";
import { KnowledgePicker } from "../components/KnowledgePicker";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { checkName, friendlyError } from "@flowcode/contracts";
import { Check, Copy, ExternalLink, ListChecks, MessageSquare, RefreshCw } from "lucide-react";
import { PreviewSizes, deviceWidth, type Device } from "../components/PreviewSizes";
import type { Approval, Checkpoint, CommandRecord, FlowEvent, KnowledgeItem, PreflightRecord, Project, Run, Snapshot, Task, VerificationCheck } from "@flowcode/contracts";
import { artifactUrl, get, post, useEventStream, useResource } from "../api";
import { ApprovalCard } from "../components/ApprovalCard";
import { ResizeHandle, usePersistedWidth } from "../components/ResizeHandle";
import { ProjectChat } from "../components/ProjectChat";
import { SignalStrip } from "../components/SignalStrip";
import { DiffView, Empty, Icon, Led, StatusChip, TabPanel, Tabs, ago, time, ErrorNotice } from "../components/ui";
import { navigate } from "../router";
import { StylesPanel } from "../components/StylesPanel";
import { KnowledgeKindIcon } from "../components/KnowledgeKindIcon";
import { TroubleshootPanel } from "../components/Troubleshoot";
import { ScreenshotGallery, latestShots } from "../components/ScreenshotViewer";
import { Markdown } from "../components/Markdown";
import { docSummary, docTitle, isMarkdownDoc } from "../components/RequestText";
import { CodeView } from "../components/CodeView";
import { ConfirmButton } from "../components/ConfirmButton";
import { StopReport } from "../components/StopReport";
import { RunReview } from "../components/RunReview";
import { RunActivity } from "../components/RunActivity";
import { ScreenCoverage } from "../components/ScreenCoverage";
import { ReviewPanel } from "../components/ReviewPanel";
import { Modal } from "../components/Modal";
import { PanelGrip, StripGrip, useWsLayout, type PanelId } from "../components/WsLayout";


interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  secret?: boolean;
  children?: TreeNode[];
}

interface RunView {
  run: Run;
  active: boolean;
  resumable: boolean;
  /** Paused between steps from the builder. */
  paused?: boolean;
  probing?: boolean;
  coder: { ok: boolean; reason: string };
  tasks: Task[];
  checks: VerificationCheck[];
  commands: CommandRecord[];
  approvals: Approval[];
  snapshots: Array<Snapshot & { seq: number }>;
  checkpoints: Checkpoint[];
  artifacts: Array<{ id: string; kind: string; label: string; mime: string; createdAt: string; meta?: Record<string, unknown> }>;
}

type RightTab = "preview" | "styles" | "review" | "changes" | "activity" | "conversation" | "terminal" | "approvals" | "diagnostics" | "file";
type LeftTab = "files" | "knowledge";

export function WorkspaceView({ projectId, runId, announce }: { projectId: string; runId?: string; announce: (m: string, link?: { href?: string; overview?: boolean; linkLabel?: string }) => void }) {
  const [runTick, setRunTick] = useState(0);
  // Re-fetched on run events too, so a cancelled or finished run never leaves the chat looking busy.
  const projectRes = useResource<{ project: Project; preflight?: PreflightRecord; runs: Run[]; workspaceName?: string }>(`/projects/${projectId}`, [runId, runTick]);
  const runs = projectRes.data?.runs ?? [];
  const currentRunId = runId ?? runs[0]?.id;
  const runRes = useResource<RunView>(currentRunId ? `/runs/${currentRunId}` : null, [runTick]);
  const view = runRes.data;
  const [right, setRightRaw] = useState<RightTab>("activity");
  const technical = useDisplayMode() === "technical";
  // Older tab names land on their new homes: Agents → Activity; Changes and Diagnostics → Review (runtime events are in
  // Technical output); Approvals → the Overview's "Needs you" (and chat, and the Approvals page).
  const setRight = (t: RightTab) => {
    if (t === "approvals") return setWorkMode("details");
    setRightRaw(t === "conversation" ? "activity" : t === "changes" || t === "diagnostics" ? "review" : t);
  };
  const [left, setLeft] = useState<LeftTab>("files");
  const [openFile, setOpenFile] = useState<string>();
  useEffect(() => {
    const on = (ev: Event) => {
      setOpenFile((ev as CustomEvent<string>).detail);
      setRight("file");
    };
    window.addEventListener("fc:open-file", on);
    return () => window.removeEventListener("fc:open-file", on);
  }, []);
  useEffect(() => {
    const toChat = () => setWorkMode("chat");
    window.addEventListener(COMPOSE_EVENT, toChat);
    // Show me for parts of the chat (the cloud box, separate changes) switches the builder to its chat first.
    window.addEventListener("fc:show-chat", toChat);
    return () => {
      window.removeEventListener(COMPOSE_EVENT, toChat);
      window.removeEventListener("fc:show-chat", toChat);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const tab = (e: Event) => setRight((e as CustomEvent<RightTab>).detail);
    window.addEventListener("fc:show-tab", tab);
    return () => window.removeEventListener("fc:show-tab", tab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const show = () => setWorkMode("details");
    window.addEventListener("fc:show-overview", show);
    return () => window.removeEventListener("fc:show-overview", show);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [composing, setComposing] = useState(false);
  const [composeText, setComposeText] = useState<string>();
  // Work column: chat with the agent (default) or the detailed plan/task view; remembered per viewer.
  const [workMode, setWorkModeState] = useState<"chat" | "details">(() => {
    try {
      return localStorage.getItem("fc.workMode") === "details" ? "details" : "chat";
    } catch {
      return "chat";
    }
  });
  const setWorkMode = (m: "chat" | "details") => {
    setWorkModeState(m);
    try {
      localStorage.setItem("fc.workMode", m);
    } catch {
      /* storage unavailable */
    }
  };
  // Work column width: CSS variable on .ws, persisted per viewer.
  const wsLayout = useWsLayout();
  const setWorkWidth = usePersistedWidth("fc.workW", "--ws-work", () => document.querySelector<HTMLElement>(".ws"));
  const setFilesWidth = usePersistedWidth("fc.filesW", "--ws-files", () => document.querySelector<HTMLElement>(".ws"));
  const panelWidth = (p: PanelId) => document.querySelector<HTMLElement>(`.ws__col[data-panel="${p}"]`)?.getBoundingClientRect().width ?? 300;
  // Pull bars on the inner edges between panels. The Preview panel takes the space left over, so each edge resizes
  // the panel beside it that isn't Preview (the left one when neither is).
  const resizers = (p: PanelId) => {
    const order = wsLayout.layout.order;
    const i = order.indexOf(p);
    const out: ReactNode[] = [];
    for (const [a, b] of [[order[i - 1], p], [p, order[i + 1]]] as const) {
      if (!a || !b) continue;
      const owner = a !== "right" ? a : b;
      if (owner !== p) continue;
      const side = owner === a ? "right" : "left";
      const set = p === "files" ? setFilesWidth : setWorkWidth;
      const min = p === "files" ? 180 : 320;
      const max = () => Math.max(min + 40, (document.querySelector(".ws")?.getBoundingClientRect().width ?? 1200) - 340 - (p === "files" ? panelWidth("work") : panelWidth("files")));
      out.push(<ResizeHandle key={side} side={side} label={`${p === "files" ? "Files and Knowledge" : "Chat and Overview"} panel width`} value={() => panelWidth(p)} min={min} max={max} onChange={set} onReset={() => set(null)} />);
    }
    return out;
  };

  // The stream replays history on connect; only events newer than this page announce themselves.
  const openedAt = useRef(Date.now() - 2000);
  const events = useEventStream(currentRunId ? `/runs/${currentRunId}/events` : null, (e) => {
    if (/^(task\.|run\.|plan\.|approval\.|verification\.completed|command\.(completed|failed|awaiting)|snapshot\.|report\.ready)/.test(e.type)) setRunTick((t) => t + 1);
    if (new Date(e.createdAt).getTime() < openedAt.current) return;
    // Which build, what happened, and where to look.
    const who = projectRes.data?.project.name.replace(/\s+/g, " ") ?? "This project";
    const here = { href: `#/projects/${projectId}/runs/${currentRunId}`, overview: true };
    if (e.type === "approval.requested") announce(`${who} needs your OK: ${e.message.replace(/^Approval needed \([a-z]+ risk\): /, "")}`, { ...here, linkLabel: "Review it" });
    if (e.type === "run.status_changed") {
      const to = (e.data as { to?: string } | undefined)?.to;
      const needs = to === "blocked" || to === "awaiting_approval" || to === "done_unverified" || to === "done_with_warnings";
      if (to && needs) {
        const say2: Record<string, string> = { blocked: "stopped and needs a decision", awaiting_approval: "needs your OK to continue", done_unverified: "is ready, but not fully checked", done_with_warnings: "is ready, with notes" };
        announce(`${who} ${say2[to]}.`, { ...here, linkLabel: to === "blocked" || to === "awaiting_approval" ? "Decide" : "See the review" });
        return;
      }
      const say: Record<string, string> = { running: "Building…", recovering: "Fixing a problem…", verifying: "Checking that your app works…", done: "Your changes are ready", done_with_warnings: "Your changes are ready, with a few notes", done_unverified: "Your changes are ready, but not fully checked", blocked: "FlowCode needs your help to continue", awaiting_approval: "Needs your OK to continue", cancelled: "Stopped. Nothing else will change." };
      if (to && say[to]) announce(say[to]);
    }
    if (e.type === "phase.started") {
      const phase = (e.data as { phase?: string } | undefined)?.phase;
      announce(phase === "planning" ? "Planning your changes…" : phase === "verification" ? "Checking that your app works…" : "Building your changes…");
    }
    if (e.level === "error" && e.type !== "command.output" && e.type !== "command.failed") announce(friendlyError(e.message).title);
  });
  // The agent working right now, by the same rule as the Agents page: the current task's role (the debugger on a
  // retry), the planner while a draft has no tasks yet, otherwise whoever made the latest model call.
  const lastCaller = [...events].reverse().find((e) => e.type === "model.requested" && typeof (e.data as { role?: unknown } | undefined)?.role === "string")?.data as { role: string } | undefined;
  const role = workingRole(view?.run, view?.tasks, lastCaller?.role);
  const workingAgent = role ? { role } : undefined;

  useEffect(() => {
    if (view?.approvals.some((a) => a.status === "pending")) setWorkMode("details");
  }, [view?.approvals.filter((a) => a.status === "pending").length]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingApprovals = view?.approvals.filter((a) => a.status === "pending") ?? [];
  const changedPaths = useMemo(() => new Set(view?.snapshots.filter((s) => !s.restoredAt).map((s) => s.relativePath) ?? []), [view?.snapshots]);
  const project = projectRes.data?.project;

  const control = async (action: "start" | "cancel" | "resume" | "pause" | "unpause") => {
    if (!view) return;
    try {
      await post(`/runs/${view.run.id}/${action}`);
      announce(
        action === "start" ? "Building started" : action === "cancel" ? "Stopped. Nothing else will change." : action === "pause" ? "Pausing: the step in progress finishes, then the build waits." : action === "unpause" ? "Continuing the build." : "Picking up where it left off…",
      );
    } catch (e) {
      announce(friendlyError((e as Error).message, action === "cancel" ? "stop it" : "continue").title);
    }
    setRunTick((t) => t + 1);
  };

  const controls = view ? (
    <>
      {view.run.status === "running" && !view.active && view.run.planApproved && !view.resumable && !view.probing ? (
        <button className="btn btn--primary" onClick={() => control("start")}>
          <Icon name="play" size={14} /> Start
        </button>
      ) : null}
      {view.resumable && !["awaiting_approval"].includes(view.run.status) ? (
        <button className="btn btn--primary" onClick={() => control("resume")}>
          <Icon name="refresh" size={14} /> Resume
        </button>
      ) : null}
      {/* Pause between steps: the step in progress finishes, the next one waits for Continue. */}
      {view.active && view.run.planApproved ? (
        view.paused ? (
          <button className="btn btn--primary btn--icon" onClick={() => control("unpause")} aria-label="Continue" data-tip="Continue">
            <Icon name="play" size={14} />
          </button>
        ) : (
          <button className="btn btn--icon" onClick={() => control("pause")} aria-label="Pause" data-tip="Pause after this step">
            <Icon name="pause" size={14} />
          </button>
        )
      ) : null}
      {view.active || ["running", "awaiting_approval", "verifying", "recovering"].includes(view.run.status) ? (
        <button className="btn btn--danger btn--icon" onClick={() => control("cancel")} aria-label="Cancel the build" data-tip="Cancel the build">
          <Icon name="stop" size={14} />
        </button>
      ) : null}
      {/* New requests go through Chat. */}
      <button className="btn" onClick={() => navigate(`/quality/${projectId}/plan`)} data-tip="What this build follows: its steps, requirements and acceptance tests">
        <Icon name="checklist" size={14} /> Prototype plan
      </button>
      <button className="btn" data-guide="ws.launch" onClick={() => navigate(`/quality/${projectId}/launch`)} data-tip="For building the real app later">
        <Icon name="rocket" size={14} /> Launch readiness
      </button>
      <button className="btn" onClick={() => navigate(`/quality/${projectId}/reports`)} data-tip="Each run's report, its performance and the repository read, in My Projects">
        <Icon name="quality" size={14} /> Run reports
      </button>
    </>
  ) : (
    <button className="btn btn--primary" onClick={() => setComposing(true)}>
      <Icon name="plus" size={14} /> New request
    </button>
  );

  return (
    <div className={`ws${wsLayout.layout.strip === "top" ? " ws--strip-top" : ""}`} style={wsLayout.style}>
      <section className="ws__col" data-guide="ws.files" data-panel="files" style={{ order: wsLayout.orderOf("files") }} aria-label="Files and knowledge">
        <PanelGrip id="files" layout={wsLayout.layout} onMove={wsLayout.movePanel} />
        {resizers("files")}
        <Tabs label="left" value={left} onChange={setLeft} tabs={[{ id: "files", label: "Files" }, { id: "knowledge", label: "Knowledge" }]} />
        {left === "files" ? (
          <TabPanel label="left" id="files">
            <FileTree projectId={projectId} changed={changedPaths} refreshKey={runTick} selected={openFile} onOpen={(p) => (setOpenFile(p), setRight("file"))} />
            <PreflightSummary preflight={projectRes.data?.preflight} projectId={projectId} onDone={projectRes.reload} />
          </TabPanel>
        ) : (
          <TabPanel label="left" id="knowledge">
            <ProjectKnowledge projectId={projectId} />
          </TabPanel>
        )}
      </section>

      <section className="ws__col" data-guide="ws.work" data-panel="work" style={{ order: wsLayout.orderOf("work") }} aria-label="Task, plan and work">
        <PanelGrip id="work" layout={wsLayout.layout} onMove={wsLayout.movePanel} />
        {resizers("work")}
        <div className="ws__colhead">
          <div className="seg seg--sm" role="radiogroup" aria-label="Work view">
            <button role="radio" data-cp="ws-mode-chat" data-cp-safe aria-checked={workMode === "chat"} onClick={() => setWorkMode("chat")}>
              <MessageSquare size={14} strokeWidth={2} aria-hidden="true" /> Chat
            </button>
            <button role="radio" aria-checked={workMode === "details"} onClick={() => setWorkMode("details")}>
              <ListChecks size={14} strokeWidth={2} aria-hidden="true" /> Overview
            </button>
          </div>
          {/* Plain or technical explanations: set once in System Settings → Explanations (not a toggle in the builder). */}
          {workMode === "details" && runs.length > 1 ? (
            <select className="select ws__run-select" style={{ width: "auto", marginLeft: "auto" }} aria-label="Select run" value={currentRunId} onChange={(e) => navigate(`/projects/${projectId}/runs/${e.target.value}`)}>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {(isMarkdownDoc(r.objective) ? docTitle(r.objective) : r.objective).slice(0, 48)} — {r.status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {workMode === "chat" && projectRes.data ? (
          <ProjectChat
            projectId={projectId}
            runs={runs}
            view={view}
            events={events}
            onSent={(r) => {
              projectRes.reload();
              navigate(`/projects/${projectId}/runs/${r.id}`);
            }}
            onShow={(tab) => setRight(tab)}
            onDetails={(id) => {
              setWorkMode("details");
              navigate(`/projects/${projectId}/runs/${id}`);
            }}
          />
        ) : null}
        <div className="ws__scroll" hidden={workMode === "chat" && !!projectRes.data}>
          {/* The very first request of an empty project is written here; later ones open in a modal. */}
          {!composing && !currentRunId && projectRes.data ? (
            <Composer key={composeText ?? "new"}
              project={project}
              preflight={projectRes.data?.preflight}
              parentRun={view?.run}
              initialObjective={composeText}
              
              onCreated={(r) => {
                setComposing(false);
                setComposeText(undefined);
                projectRes.reload();
                navigate(`/projects/${projectId}/runs/${r.id}`);
              }}
            />
          ) : null}
          {view ? <RunPanel view={view} events={events} onChanged={() => setRunTick((t) => t + 1)} onFollowUp={(text) => (setComposeText(text), setComposing(true))} /> : null}
          {!view && currentRunId ? <p className="muted" style={{ padding: 16 }}>Opening this request…</p> : null}
        </div>
      </section>

      <section className="ws__col ws__col--right" data-guide="ws.tabs" data-panel="right" style={{ order: wsLayout.orderOf("right") }} aria-label="Preview, design, review, activity and technical output">
        <PanelGrip id="right" layout={wsLayout.layout} onMove={wsLayout.movePanel} />
        <Tabs
          label="right"
          value={right}
          onChange={setRight}
          tabs={[
            { id: "preview", label: "Preview" },
            { id: "styles", label: "Design" },
            { id: "review", label: "Review", count: changedPaths.size },
            { id: "activity", label: "Activity" },
            { id: "terminal", label: "Terminal" },
            ...(openFile ? [{ id: "file" as const, label: openFile.split("/").pop() ?? "File" }] : []),
          ]}
        />
        {right === "preview" && (
          <TabPanel label="right" id="preview">
            <PreviewPanel projectId={projectId} artifacts={view?.artifacts ?? []} />
          </TabPanel>
        )}
        {right === "styles" && (
          <TabPanel label="right" id="styles">
            <StylesPanel projectId={projectId} />
            <ScreenCoverage projectId={projectId} />
          </TabPanel>
        )}
        {right === "review" && (
          <TabPanel label="right" id="review">
            {view ? (
              <>
                <ChangeImpactPanel runId={view.run.id} />
                <RunModelsPanel runId={view.run.id} />
                <ReviewPanel runId={view.run.id} checks={view.checks} tasks={view.tasks} onChanged={() => setRunTick((t) => t + 1)} changes={<ChangesPanel view={view} onChanged={() => setRunTick((t) => t + 1)} />} />
              </>
            ) : (
              <div style={{ padding: 16 }}>
                <Empty title="Nothing to review yet">When FlowCode builds something, this shows what changed, what was checked and what needs your attention.</Empty>
              </div>
            )}
          </TabPanel>
        )}
        {right === "activity" && (
          <TabPanel label="right" id="activity">
            <ActivityFeed events={events} working={view?.active ? workingAgent?.role ?? "planner" : undefined} />
          </TabPanel>
        )}
        {right === "terminal" && (
          <TabPanel label="right" id="terminal">
            <Terminal events={events} commands={view?.commands ?? []} />
            <details className="tech-details" open={technical}>
              <summary>Runtime details: model and provider errors, policy refusals, cleanup</summary>
              <RunDiagnostics events={events} view={view} />
            </details>
          </TabPanel>
        )}
        {right === "file" && openFile && (
          <TabPanel label="right" id="file">
            <FileViewer projectId={projectId} path={openFile} />
          </TabPanel>
        )}
      </section>

      {composing && projectRes.data ? (
        <Modal onClose={() => (setComposing(false), setComposeText(undefined))} labelledBy="composer-title" className="composer-modal-box">
          <div className="composer-modal">
            <button type="button" className="icon-btn composer-modal__close" aria-label="Close new request" onClick={() => (setComposing(false), setComposeText(undefined))}>
              <Icon name="x" size={16} />
            </button>
            <Composer key={composeText ?? "new"}
                project={project}
                preflight={projectRes.data?.preflight}
                parentRun={view?.run}
                initialObjective={composeText}
                onCancel={() => (setComposing(false), setComposeText(undefined))}
                onCreated={(r) => {
                  setComposing(false);
                  setComposeText(undefined);
                  projectRes.reload();
                  navigate(`/projects/${projectId}/runs/${r.id}`);
                }}
              />
          </div>
        </Modal>
      ) : null}
      <SignalStrip run={view?.run} checks={view?.checks ?? []} active={!!view?.active} resumable={!!view?.resumable} paused={!!view?.paused} controls={controls} onRerun={() => setRunTick((t) => t + 1)} agent={workingAgent?.role} doing={doingNow(events, workingAgent?.role)} grip={<StripGrip strip={wsLayout.layout.strip} onChange={wsLayout.setStrip} />} style={{ order: wsLayout.layout.strip === "top" ? -1 : 10 }} />
    </div>
  );
}

// ─── Left column ────────────────────────────────────────────────────

function FileTree({ projectId, changed, refreshKey, selected, onOpen }: { projectId: string; changed: Set<string>; refreshKey: number; selected?: string; onOpen: (p: string) => void }) {
  const { data, error } = useResource<TreeNode>(`/projects/${projectId}/files?depth=5`, [refreshKey]);
  const [open, setOpen] = useState<Set<string>>(new Set(["src"]));
  if (error) return <ErrorNotice error={error} doing="open this" />;
  if (!data) return <p className="muted" style={{ padding: 12 }}>Reading workspace…</p>;
  if (!data.children?.length) return <div style={{ padding: 12 }}><Empty title="No files yet" illustration="empty">Your app's files appear here once FlowCode starts building. Describe what you want in Chat to begin.</Empty></div>;
  const render = (nodes: TreeNode[]) =>
    nodes.map((n) => (
      <li key={n.path}>
        {n.type === "dir" ? (
          <>
            <button className="tree__row" aria-expanded={open.has(n.path)} onClick={() => setOpen((s) => new Set(s.has(n.path) ? [...s].filter((x) => x !== n.path) : [...s, n.path]))}>
              <span style={{ transform: open.has(n.path) ? "rotate(90deg)" : undefined, display: "inline-flex", transition: "transform 120ms" }}>
                <Icon name="chevron" size={12} />
              </span>
              <Icon name="folder" size={14} /> {n.name}
            </button>
            {open.has(n.path) && n.children?.length ? <ul>{render(n.children)}</ul> : null}
          </>
        ) : (
          <button data-ctx-path={n.secret ? undefined : n.path} className={`tree__row ${changed.has(n.path) ? "tree__row--changed" : ""}`} aria-current={selected === n.path} disabled={n.secret} title={n.secret ? "Secret file — access denied by policy" : n.path} onClick={() => onOpen(n.path)}>
            <span style={{ width: 12 }} />
            <Icon name="file" size={14} /> {n.name}
            {changed.has(n.path) ? <span className="sr-only"> (changed in this run)</span> : null}
            {n.secret ? <span className="label" style={{ marginLeft: "auto" }}>secret</span> : null}
          </button>
        )}
      </li>
    ));
  return (
    <ul className="tree" aria-label="Workspace files">
      {render(data.children)}
    </ul>
  );
}

function PreflightSummary({ preflight, projectId, onDone }: { preflight?: PreflightRecord; projectId: string; onDone: () => void }) {
  // Collapsible; remembered per browser. Collapsed by default so the file list gets the room.
  const [open, setOpenState] = useState(() => {
    try {
      return localStorage.getItem("fc.ws.preflight") === "open";
    } catch {
      return false;
    }
  });
  const setOpen = (o: boolean) => {
    setOpenState(o);
    try {
      localStorage.setItem("fc.ws.preflight", o ? "open" : "closed");
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div data-guide="ws.preflight" className="ws-preflight" style={{ padding: open ? "10px 12px 12px" : "6px 12px", borderTop: "1px solid var(--line)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="ws-preflight__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }}>
            <Icon name="chevron" size={12} />
          </span>
          <span className="label" title="What FlowCode found when it looked at this project (preflight)">project setup</span>
          {!open && preflight ? <span className="muted" style={{ fontSize: 11.5 }}>{preflight.projectType} · {preflight.manifestValid ? "ok" : "check"}</span> : null}
        </button>
        <button className="btn btn--sm btn--ghost" style={{ marginLeft: "auto" }} onClick={() => post(`/projects/${projectId}/preflight`).then(onDone)}>
          <Icon name="refresh" size={12} /> Re-run
        </button>
      </div>
      {!open ? null : preflight ? (
        <dl className="kv" style={{ gridTemplateColumns: "84px 1fr", fontSize: 12 }}>
          <dt>Type</dt>
          <dd>{preflight.projectType}</dd>
          <dt>Manager</dt>
          <dd>{preflight.packageManager}</dd>
          <dt>Manifest</dt>
          <dd>{preflight.manifestValid ? "valid" : preflight.manifestErrors.length ? "invalid" : "none"}</dd>
          <dt>Preview</dt>
          <dd>{preflight.previewStrategy}</dd>
          <dt>Auto checks</dt>
          <dd>{preflight.allowedChecks.join(", ") || "none"}</dd>
          {preflight.missingPrerequisites.length ? (
            <>
              <dt>Missing</dt>
              <dd style={{ color: "var(--sig-warn)" }}>{preflight.missingPrerequisites.join("; ")}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Not run yet.</p>
      )}
    </div>
  );
}

/**
 * The builder's Knowledge tab: only what bears on building this project (decisions, notes, specs, repository map,
 * pinned items). Research results and uploaded documents stay in the library; a single line links to them.
 */
function ProjectKnowledge({ projectId }: { projectId: string }) {
  const { data } = useResource<KnowledgeItem[]>(`/knowledge?projectId=${projectId}`);
  if (!data) return null;
  const isLibrary = (k: KnowledgeItem) => !k.pinned && (k.tags.includes("research") || k.tags.includes("upload"));
  const build = data.filter((k) => !k.excluded && !isLibrary(k));
  const library = data.filter((k) => !k.excluded && isLibrary(k));
  const docs = new Set(library.filter((k) => k.tags.includes("upload")).map((k) => k.title.replace(/\s*\(part \d+ of \d+\)$/, ""))).size;
  const research = library.filter((k) => k.tags.includes("research") && !k.tags.includes("upload")).length;
  return (
    <div className="pk">
      {build.length ? (
        <ul className="tree">
          {build.slice(0, 80).map((k) => (
            <li key={k.id}>
              <button className="tree__row" onClick={() => navigate(`/knowledge?focus=${k.id}`)} title={k.content.slice(0, 200)}>
                <KnowledgeKindIcon kind={k.kind} />
                <span className="kn-row__title">{k.title}</span>
                {k.pinned ? <Icon name="pin" size={12} label="pinned" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ padding: 12 }}>
          <Empty title="Nothing saved for this app yet">Decisions, notes and specs you add for this app show up here.</Empty>
        </div>
      )}
      {library.length ? (
        <button type="button" className="pk__library" onClick={() => navigate(`/knowledge?projectId=${projectId}`)}>
          <Icon name="knowledge" size={13} />
          <span>
            {[docs ? `${docs} document${docs === 1 ? "" : "s"}` : "", research ? `${research} research item${research === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ")} for this project in the Knowledge Hub
          </span>
          <Icon name="chevron" size={12} />
        </button>
      ) : null}
    </div>
  );
}

// ─── Center column ──────────────────────────────────────────────────

function Composer({ project, preflight, parentRun, initialObjective, onCreated, onCancel }: { project?: Project; preflight?: PreflightRecord; parentRun?: Run; initialObjective?: string; onCreated: (r: Run) => void; onCancel?: () => void }) {
  const empty = !preflight || preflight.projectType === "incomplete" || preflight.projectType === "unknown";
  const [objective, setObjective] = useState(initialObjective ?? "");
  const [constraints, setConstraints] = useState("");
  const [starter, setStarter] = useState<"none" | "react" | "angular">(empty ? "react" : "none");
  const template = empty && starter !== "none";
  const [iterate, setIterate] = useState(!!initialObjective);
  const [attached, setAttached] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const knowledge = useResource<KnowledgeItem[]>(project ? `/knowledge?projectId=${project.id}` : null);
  const submit = async () => {
    if (!project || !objective.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const run = await post<Run>("/runs", {
        projectId: project.id,
        objective: objective.trim(),
        constraints: constraints.split("\n").map((c) => c.trim()).filter(Boolean),
        // React runs the verified golden path; Angular scaffolds its starter and plans the request on top of it.
        ...(template ? (starter === "angular" ? { kind: "spec_build", templateId: "angular-starter" } : { kind: "template_build", templateId: "react-vite-scheduler" }) : {}),
        ...(iterate && parentRun ? { parentRunId: parentRun.id, kind: "iterate" } : {}),
        origin: "you",
        attachedKnowledgeIds: attached,
      });
      onCreated(run);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <span className="label">new request</span>
        <h2 id="composer-title" style={{ margin: "6px 0 0", fontSize: 18 }}>What should FlowCode build or change?</h2>
      </div>
      <div className="field">
        <label htmlFor="objective" className="label">
          Request
        </label>
        <textarea id="objective" className="textarea" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={template && starter === "angular" ? "Describe the app to build on the Angular starter: what it does, its screens and the data it keeps." : template ? "Build a local-first personal scheduler with create, edit, delete, list view, local persistence, responsive layouts and designed empty/loading/error states." : "Describe a bounded change, bug or feature…"} required />
      </div>
      <div className="field">
        <label htmlFor="constraints" className="label">
          Constraints (one per line, optional)
        </label>
        <textarea id="constraints" className="textarea" style={{ minHeight: 56 }} value={constraints} onChange={(e) => setConstraints(e.target.value)} />
      </div>
      <fieldset className="starter-pick" disabled={!empty}>
        <legend className="label">Start from</legend>
        {([
          ["none", "Nothing", "Plan the request from scratch."],
          ["react", "React + Vite starter", "Verified golden path: scaffolds the starter, then builds the feature."],
          ["angular", "Angular starter", "Scaffolds Angular 21 with design tokens and tests, then plans your request on top."],
        ] as const).map(([id, label, note]) => (
          <label key={id} className="check">
            <input type="radio" name="starter" value={id} checked={(empty ? starter : "none") === id} onChange={() => setStarter(id)} />
            <span>
              {label}
              <span className="muted" style={{ display: "block", fontSize: 12 }}>{note}</span>
            </span>
          </label>
        ))}
        {!empty ? <p className="muted" style={{ margin: 0, fontSize: 12 }}>Starters are only available for empty workspaces.</p> : null}
      </fieldset>
      {parentRun ? (
        <label className="check">
          <input type="checkbox" checked={iterate} onChange={(e) => setIterate(e.target.checked)} />
          <span>Iterate on the previous run's result (delta plan)</span>
        </label>
      ) : null}
      {project ? <KnowledgePicker projectId={project.id} items={knowledge.data ?? []} attached={attached} onChange={setAttached} onUploaded={() => knowledge.reload()} /> : null}
      {error ? <ErrorNotice error={error} doing="open this" /> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn--primary" type="submit" disabled={busy || !objective.trim()}>
          {busy ? "Planning…" : "Plan this request"}
        </button>
        {onCancel ? (
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Nothing changes until you approve the plan. Installs, deletes and out-of-scope edits always ask first.
      </p>
    </form>
  );
}

/** Steps grouped by what they mean for you: stopped first, then working, done, not started, and replaced (skipped isn't done). */
const STEP_GROUPS: Array<{ id: string; label: string; statuses: string[] }> = [
  { id: "stopped", label: "Stopped", statuses: ["blocked", "failed"] },
  { id: "working", label: "Working", statuses: ["running", "attempted", "awaiting_approval"] },
  { id: "done", label: "Done", statuses: ["verified"] },
  { id: "todo", label: "Not started", statuses: ["pending", "invalidated"] },
  { id: "skipped", label: "Skipped (replaced by smaller steps)", statuses: ["skipped"] },
];
const STEP_LABEL: Record<string, string> = {
  verified: "Done, checked",
  running: "Working",
  attempted: "Will retry",
  awaiting_approval: "Waiting for your OK",
  pending: "Not started",
  invalidated: "Waiting on an earlier step",
  blocked: "Stopped, needs you",
  failed: "Failed",
  skipped: "Split into smaller steps",
};

function RunPanel({ view, events, onChanged, onFollowUp }: { view: RunView; events: FlowEvent[]; onChanged: () => void; onFollowUp: (text: string) => void }) {
  const [troubleTask, setTroubleTask] = useState<string>();
  // Finished steps fold to one line (step number, title, status); a click opens one to see its checks and files.
  const [openDone, setOpenDone] = useState<Set<string>>(() => new Set());
  const toggleDone = (id: string) => setOpenDone((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const [troubleRun, setTroubleRun] = useState(false);
  const { run, tasks } = view;
  // The latest finished step that changed files: where "Undo a change" opens.
  const lastChanged = [...tasks].reverse().find((t) => t.status === "verified" && t.actualPaths.length)?.id;
  const planApproval = view.approvals.find((a) => a.kind === "plan" && a.status === "pending");
  const state = view.resumable && run.status !== "awaiting_approval" ? "resumable" : run.status;
  const [showFull, setShowFull] = useState(false);
  // Stopped steps in plain language: what happened, and what (if anything) you decide.
  const facts = useResource<{ blocked: Array<{ taskId: string; explanation: string; decision?: string }> }>(`/runs/${run.id}/facts`, [run.id, run.status, tasks.map((t) => t.status).join()]);
  const technical = useDisplayMode() === "technical";
  const plainStop = new Map((facts.data?.blocked ?? []).map((b) => [b.taskId, b]));
  const otherApprovals = view.approvals.filter((a) => a.status === "pending" && a.kind !== "plan" && a.kind !== "enhancement_idea");
  const ideas = view.approvals.filter((a) => a.status === "pending" && a.kind === "enhancement_idea" && !a.savedForLater).length;
  const savedIdeas = view.approvals.filter((a) => a.status === "pending" && a.kind === "enhancement_idea" && a.savedForLater).length;
  // Follow the work: when a new step starts, scroll Details to it (only on a change, so reading back isn't interrupted).
  const activeTask = tasks.find((t) => t.status === "running")?.id;
  const lastActive = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!activeTask || activeTask === lastActive.current) return;
    const first = lastActive.current === undefined;
    lastActive.current = activeTask;
    const el = document.querySelector<HTMLElement>(`.task-list [data-ctx-task="${activeTask}"]`);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "start", behavior: reduce || first ? "auto" : "smooth" });
  }, [activeTask]);
  // A request can be edited in place until work starts; after that, edits become a follow-up request.
  const editable = !view.active && !view.probing && ["draft", "awaiting_approval"].includes(run.status) && tasks.every((t) => t.status === "pending" || t.status === "invalidated");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(run.objective);
  const [editError, setEditError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const saveEdit = async () => {
    setSaving(true);
    setEditError(undefined);
    try {
      await post(`/runs/${run.id}/objective`, { objective: draft });
      setEditing(false);
      onChanged();
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div>
      <header className="run-head" data-guide="ws.work" data-ctx-run={run.id} data-ctx-project={run.projectId} data-ctx-label="This request">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <StatusChip status={view.probing ? "running" : state === "resumable" && run.planApproved ? "awaiting_approval" : run.status} />
          {state === "resumable" ? <span className="chip chip--warn">{run.planApproved ? "resumable after restart" : "can be planned again"}</span> : null}
          {view.probing ? <span className="chip chip--run">running capability test</span> : null}
          {run.strategy ? <span className="label">{run.strategy.kind.replace(/_/g, " ")}</span> : null}
          <span className="label" style={{ marginLeft: "auto" }}>{ago(run.createdAt)}</span>
        </div>
        {editing ? (
          <form
            className="run-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit();
            }}
          >
            <label className="label" htmlFor="edit-objective">
              Edit request
            </label>
            <textarea id="edit-objective" className="textarea" rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} required minLength={3} />
            {editError ? (
              <ErrorNotice error={editError} doing="open this" />
            ) : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--primary btn--sm" type="submit" disabled={saving || draft.trim() === run.objective.trim()}>
                {saving ? "Planning again…" : "Save and re-plan"}
              </button>
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => (setEditing(false), setDraft(run.objective))}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            {isMarkdownDoc(run.objective) ? (
              <>
                <h2 className="run-head__objective">{docTitle(run.objective)}</h2>
                {showFull ? (
                  <div className="run-head__doc">
                    <Markdown source={run.objective} />
                  </div>
                ) : (
                  <p className="run-head__summary">{docSummary(run.objective)}</p>
                )}
              </>
            ) : (
              <h2 className={`run-head__objective ${showFull ? "" : "run-head__objective--clamped"}`}>{run.objective}</h2>
            )}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {run.objective.length > 220 ? (
                <button className="btn btn--ghost btn--sm" style={{ padding: 0 }} aria-expanded={showFull} onClick={() => setShowFull(!showFull)}>
                  {showFull ? "Show less" : "Show full request"}
                </button>
              ) : null}
              {editable ? (
                <button className="btn btn--ghost btn--sm" style={{ padding: 0 }} onClick={() => (setDraft(run.objective), setEditing(true))}>
                  <Icon name="edit" size={13} /> Edit request
                </button>
              ) : (
                <button className="btn btn--ghost btn--sm" style={{ padding: 0 }} onClick={() => onFollowUp(run.objective)} title="Work has started, so changes go in a follow-up request (the history stays accurate)">
                  <Icon name="edit" size={13} /> Edit as follow-up
                </button>
              )}
              {view.coder.ok ? (
                // The coder on the same row as the edit button; its test result is in the tooltip.
                <span className="muted run-head__coder" title={view.coder.reason}>
                  Coder <span className="mono">{run.modelAssignments.coder?.model}</span>
                </span>
              ) : null}
            </div>
          </>
        )}
        {!view.coder.ok ? (
          <p className="notice notice--warn" role="status">
            {/no capability record/i.test(view.coder.reason) ? `FlowCode tests the coding model (${run.modelAssignments.coder?.model}) automatically when the build starts. Nothing to do.` : `Before building, FlowCode tests the coding model: ${view.coder.reason}`}{" "}
            <button className="btn btn--sm" onClick={() => navigate("/system/models")}>
              View capability lab
            </button>
          </p>
        ) : null}
      </header>
      <section className="ov__section" aria-labelledby="ov-now">
        <h3 className="ov__h" id="ov-now">
          Where it stands
        </h3>
        <RunActivity runId={run.id} taskId={view.tasks.find((t) => t.status === "running")?.id} onChanged={onChanged} />
        {["blocked", "failed", "cancelled"].includes(run.status) ? (
          <StopReport key={run.id + run.status} runId={run.id} projectId={run.projectId} onTroubleshoot={(id) => setTroubleTask(id)} onFollowUp={onFollowUp} onChanged={onChanged} />
        ) : null}
      </section>
      {planApproval || otherApprovals.length ? (
        <section className="ov__section ov__section--needs" aria-labelledby="ov-needs">
          <h3 className="ov__h" id="ov-needs">
            Needs you
          </h3>
          {planApproval ? <ApprovalCard approval={planApproval} onDecided={onChanged} /> : null}
          {otherApprovals.map((a) => (
            <ApprovalCard key={a.id} approval={a} onDecided={onChanged} />
          ))}
          <p className="ov__support">
            Also on the <a href="#/approvals">Approvals page</a>, or decide from your phone (<a href="#/settings/phone">set up phone approvals</a>).
          </p>
        </section>
      ) : null}

      {run.status === "draft" ? (
        view.active ? (
          <div className="ov__working" role="status">
            <RobotHead color={ROLE_COLOR.planner ?? "#9a9fd6"} id="ov-working" size={24} className="robot-head--working" />
            <span>
              <strong>{ROLE_LABEL.planner ?? "Planner"}</strong> is {doingNow(events, "planner", true)}
            </span>
          </div>
        ) : (
          <div style={{ padding: 16 }} role="status">
            <Led status="running" /> Reading your project and drafting a plan…
          </div>
        )
      ) : null}

      {ideas || savedIdeas ? (
        <p className="ov__support ov__ideas">
          {ideas ? `FlowCode has ${ideas} new idea${ideas === 1 ? "" : "s"} for this project` : ""}
          {ideas && savedIdeas ? "; " : ""}
          {savedIdeas ? `${savedIdeas} saved for later` : ""}. <a href="#/approvals">See suggestions</a>
        </p>
      ) : null}
      {tasks.length || run.plan ? (
        <h3 className="ov__h ov__h--plan" id="ov-plan">
          Plan and progress
        </h3>
      ) : null}
      {run.plan && !planApproval ? (
        <details style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <summary className="label" style={{ cursor: "pointer" }}>
            The plan · {run.plan.tasks.length} steps · {run.plan.risk === "low" ? "low risk" : run.plan.risk === "medium" ? "medium risk" : "high risk"}
          </summary>
          <dl className="kv" style={{ marginTop: 10 }}>
            <dt>Goal</dt>
            <dd>{run.plan.goal}</dd>
            {run.plan.classification && run.plan.classification.primary !== "task_note" ? (
              <>
                <dt>Request type</dt>
                <dd>
                  <strong>{run.plan.classification.label}</strong>
                  {run.plan.classification.concepts.length ? <span className="muted"> · {run.plan.classification.concepts.join(", ")}</span> : null}
                  {run.plan.classification.skills.length ? (
                    <span className="plan-class__skills">
                      Skills for every step:{" "}
                      {run.plan.classification.skills.map((id) => (
                        <code key={id}>{id.replace(/^skill\./, "")}</code>
                      ))}
                    </span>
                  ) : null}
                  {run.plan.classification.note && !run.plan.classification.specAttached ? <span className="plan-class__note">{run.plan.classification.note}</span> : null}
                </dd>
              </>
            ) : null}
            <dt>Assumptions</dt>
            <dd>{run.plan.assumptions.join(" · ")}</dd>
            <dt>Checks</dt>
            <dd title={run.plan.validationPlan.join(", ")}>{run.plan.validationPlan.map(checkName).join(", ")}</dd>
            <dt>How to undo</dt>
            <dd>{run.plan.rollbackStrategy}</dd>
            {run.plan.brief ? (
              <>
                <dt>From the PRD</dt>
                <dd>
                  {run.plan.brief.feature ? <strong>{run.plan.brief.feature}</strong> : null}
                  {run.plan.brief.sections.length ? <span className="muted"> · sections read: {run.plan.brief.sections.join(", ")}</span> : null}
                </dd>
                {run.plan.brief.questions.length ? (
                  <>
                    <dt>Questions for you</dt>
                    <dd>
                      <ul className="plan-brief">{run.plan.brief.questions.map((q) => <li key={q}>{q}</li>)}</ul>
                    </dd>
                  </>
                ) : null}
                {run.plan.brief.requirements.length ? (
                  <>
                    <dt>Requirements built</dt>
                    <dd>
                      <ul className="plan-brief">
                        {run.plan.brief.requirements.map((r) => (
                          <li key={r.text}>
                            {r.text}
                            {r.section ? <span className="muted mono"> §{r.section}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </>
                ) : null}
                {[...run.plan.brief.assumptions, ...run.plan.brief.ambiguities.map((a) => `Unclear: ${a}`), ...run.plan.brief.conflicts.map((c) => `Conflict: ${c}`)].length ? (
                  <>
                    <dt>Assumed or unclear</dt>
                    <dd>
                      <ul className="plan-brief">
                        {[...run.plan.brief.assumptions, ...run.plan.brief.ambiguities.map((a) => `Unclear: ${a}`), ...run.plan.brief.conflicts.map((c) => `Conflict: ${c}`)].map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                ) : null}
                {run.plan.brief.outOfScope.length ? (
                  <>
                    <dt>Out of scope</dt>
                    <dd>{run.plan.brief.outOfScope.join(" · ")}</dd>
                  </>
                ) : null}
              </>
            ) : null}
          </dl>
        </details>
      ) : null}

      {tasks.length ? (
        <div className="task-groups">
        {STEP_GROUPS.map((g) => {
          const items = tasks.map((t, i) => ({ t, i })).filter(({ t }) => g.statuses.includes(t.status));
          if (!items.length) return null;
          return (
          <section key={g.id} className="task-group" aria-labelledby={`tg-${g.id}`}>
          <h4 className="task-group__h" id={`tg-${g.id}`}>
            {g.label} <span className="task-group__n">{items.length}</span>
          </h4>
        <ol className="task-list" data-guide="ws.tasks" aria-label={g.label}>
          {items.map(({ t, i }) => {
            const foldable = g.id === "done";
            const folded = foldable && !openDone.has(t.id);
            return (
            <li key={t.id} className={folded ? "task task--folded" : "task"} data-guide="ws.tasks" data-ctx-task={t.id} data-ctx-run={run.id} data-ctx-status={t.status} data-ctx-label={t.title}>
              <div className="task__rail">
                <Led status={t.status} />
              </div>
              {foldable ? (
                <button type="button" className="task__fold" aria-expanded={!folded} data-cp={t.id === lastChanged ? "step-fold-changed" : undefined} onClick={() => toggleDone(t.id)}>
                  <span className="label">Step {i + 1}</span>
                  <h3 className="task__title">{t.title}</h3>
                </button>
              ) : (
                <div>
                  <span className="label">Step {i + 1}</span>
                  <h3 className="task__title">{t.title}</h3>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <StatusChip status={t.status} label={STEP_LABEL[t.status]} />
                {folded ? null : <>
                {t.status === "blocked" || t.status === "failed" ? (
                  <button className="btn btn--sm btn--primary" onClick={() => setTroubleTask(troubleTask === t.id ? undefined : t.id)} aria-expanded={troubleTask === t.id}>
                    <Icon name="help" size={13} /> Troubleshoot
                  </button>
                ) : null}
                {(t.status === "blocked" || t.status === "failed") && !view.active ? (
                  <button className="btn btn--sm" onClick={() => post(`/runs/${run.id}/tasks/${t.id}/retry`).then(onChanged)}>
                    Retry
                  </button>
                ) : null}
                {t.actualPaths.length && !view.active ? (
                  <ConfirmButton className="btn btn--sm btn--ghost" data-cp="rollback" question={`Roll back every change "${t.title}" made?`} confirmLabel="Roll back" cancelLabel="Cancel" onConfirm={async () => (await post(`/runs/${run.id}/tasks/${t.id}/rollback`), onChanged())}>
                    <Icon name="undo" size={12} /> Roll back
                  </ConfirmButton>
                ) : null}
                {t.actualPaths.length && !view.active ? <PatchButton runId={run.id} taskId={t.id} /> : null}
                </>}
              </div>
              {folded ? null : (
              <div className="task__body">
                {t.acceptanceCriteria.length ? (
                  <details className="task__how" open={technical || t.status === "running" || t.status === "blocked" || t.status === "failed"}>
                  <summary>
                    How it's checked · {t.acceptanceCriteria.filter((c) => c.met).length} of {t.acceptanceCriteria.length} met{t.attempts > 1 ? ` · ${t.attempts} tries` : ""}
                  </summary>
                  <ul className="criteria" aria-label="How FlowCode checks this step">
                    {t.acceptanceCriteria.map((c) => (
                      // Manual checks (e.g. from skills) can't be evaluated automatically: they're for you to review, not failures.
                      <li key={c.id} className={c.check.type === "manual" ? "criteria__review" : undefined}>
                        {c.check.type === "manual" && !c.met ? (
                          <span className="criteria__review-mark" role="img" aria-label="for you to review" title="Checked by you, not automatically" />
                        ) : (
                          <Led status={c.met === undefined ? undefined : c.met ? "passed" : "failed"} label={c.met === undefined ? "not evaluated" : c.met ? "met" : "not met"} />
                        )}
                        <span>
                          {c.description.replace(/\s*\((skill\.[\w-]+)\)$/, "")}
                          {c.check.type === "manual" ? <span className="criteria__tag">{/\((skill\.[\w-]+)\)$/.exec(c.description)?.[1]?.replace("skill.", "") ?? "review"}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  </details>
                ) : null}
                {t.actualPaths.length ? <span className="mono muted">{t.actualPaths.slice(0, 8).join("  ")}{t.actualPaths.length > 8 ? ` +${t.actualPaths.length - 8}` : ""}</span> : null}
                {t.blocker ? (
                  <div className="blocker">
                    {/* Plain words first: what happened and what you decide. The agent's own note stays under Technical details. */}
                    <p className="blocker__plain">{plainStop.get(t.id)?.explanation ?? "This step stopped."}</p>
                    {plainStop.get(t.id)?.decision ? <p className="blocker__decide">You decide: {plainStop.get(t.id)!.decision}</p> : null}
                    {t.status === "blocked" || t.status === "failed" ? <BlockerAdvice runId={run.id} taskId={t.id} /> : null}
                    <details className="blocker__tech" open={technical}>
                      <summary>Technical details</summary>
                      <p>
                        {t.blocker.category.replace(/_/g, " ")}: {t.blocker.reason.slice(0, 600)}
                      </p>
                    </details>
                  </div>
                ) : null}
                {troubleTask === t.id ? (
                  // In a modal, so the causes and fixes have room and sit right where you're looking.
                  <Modal className="tshoot-modal" labelledBy="tshoot-title" onClose={() => setTroubleTask(undefined)}>
                    <TroubleshootPanel runId={run.id} taskId={t.id} onClose={() => setTroubleTask(undefined)} onChanged={onChanged} onFollowUp={onFollowUp} />
                  </Modal>
                ) : null}
              </div>
              )}
            </li>
            );
          })}
        </ol>
          </section>
          );
        })}
        </div>
      ) : null}

      {["done", "done_with_warnings", "done_unverified", "blocked", "failed", "cancelled"].includes(run.status) ? (
        <section className="ov__section" aria-labelledby="ov-review">
          <h3 className="ov__h" id="ov-review">
            Latest review
          </h3>
          <RunReview key={`review-${run.id}-${run.status}`} runId={run.id} />
          <p className="ov__support">
            <a href={`#/journal/${run.projectId}/${run.id}`}>Open the project journal</a> to see who did what, where the time went, and ask questions about this run.
          </p>
        </section>
      ) : null}

      {["done", "done_with_warnings", "done_unverified", "blocked", "failed", "cancelled"].includes(run.status) ? (
        <div style={{ padding: 16, display: "flex", gap: 8 }}>
          {run.status === "blocked" || run.status === "failed" || run.status === "done_with_warnings" || run.status === "done_unverified" ? (
            <button className="btn btn--primary" data-cp="troubleshoot" data-cp-safe onClick={() => setTroubleRun((o) => !o)} aria-expanded={troubleRun}>
              <Icon name="help" size={14} /> Troubleshoot run
            </button>
          ) : null}
          <button className="btn" onClick={() => navigate(`/quality/${run.projectId}/reports/${run.id}`)}>
            Open final report
          </button>
        </div>
      ) : null}
      {troubleRun ? (
        <Modal className="tshoot-modal" labelledBy="tshoot-title" onClose={() => setTroubleRun(false)}>
          <TroubleshootPanel runId={run.id} onClose={() => setTroubleRun(false)} onChanged={onChanged} onFollowUp={onFollowUp} />
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Right column ───────────────────────────────────────────────────

/** A one-line reminder above the live preview that it's a demo (VUS-06); dismissed per project. */
function DemoBanner({ projectId }: { projectId: string }) {
  const key = `flowcode.demoBanner.${projectId}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "hidden";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <div className="demo-banner" role="note">
      <span>
        <strong>This is a demo.</strong> Data is pretend and stays in this browser; nothing reaches real people.{" "}
        <a href={`#/quality/${projectId}/launch`}>What a real app needs</a>
      </span>
      <button
        type="button"
        className="demo-banner__x"
        aria-label="Hide this reminder for this project"
        title="Hide for this project"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(key, "hidden");
          } catch {
            /* hidden for now */
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}

/** A screen with a pointer on it, drawn like the lucide icons around it (lucide has no monitor-and-cursor icon). */
function MonitorPointer() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M9.5 6.5l6 2.4-2.6.9-.9 2.6z" />
    </svg>
  );
}

function PreviewPanel({ projectId, artifacts }: { projectId: string; artifacts: RunView["artifacts"] }) {
  // The chosen size is kept per project.
  const deviceKey = `flowcode.previewDevice.${projectId}`;
  const [device, setDeviceState] = useState<Device>(() => {
    try {
      const v = localStorage.getItem(deviceKey);
      return v === "phone" || v === "tablet" ? v : "desktop";
    } catch {
      return "desktop";
    }
  });
  const setDevice = (d: Device) => {
    setDeviceState(d);
    try {
      localStorage.setItem(deviceKey, d);
    } catch {
      /* kept for this visit */
    }
  };
  const frameWidth = deviceWidth(device);
  const [pointing, setPointing] = useState(false);
  const live = useResource<{ url: string } | null>(`/projects/${projectId}/preview`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Bumped by Refresh: a new key reloads the preview (the app runs on another origin, so it can't be reloaded from here).
  const [reloads, setReloads] = useState(0);
  // Only the latest verification’s screenshots (one per viewport); older runs stay in Reports.
  const shots = latestShots(artifacts.filter((a) => a.kind === "screenshot"));
  const start = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await post(`/projects/${projectId}/preview/start`);
      live.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ display: "flex", gap: 8, padding: 12, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
        <span className="label">live preview</span>
        {live.data?.url ? (
          <>
            <a className="btn btn--sm" href={live.data.url} target="_blank" rel="noopener noreferrer" title={`Open ${live.data.url} in your browser`}>
              <ExternalLink size={14} aria-hidden="true" /> View in browser
            </a>
            <CopyUrl url={live.data.url} />
            <PreviewSizes value={device} onChange={setDevice} style={{ marginLeft: "auto" }} />
            <button type="button" className="btn btn--sm btn--icon" data-cp="point-something" onClick={() => setPointing(true)} aria-label="Point &amp; Edit" title="Point &amp; Edit: click what should change on a fresh picture of your app, and say how">
              <MonitorPointer />
            </button>
            <button type="button" className="btn btn--sm btn--icon" onClick={() => setReloads((n) => n + 1)} aria-label="Refresh" title="Reload the preview to see the latest changes">
              <RefreshCw size={14} aria-hidden="true" />
            </button>
            <button className="btn btn--sm" onClick={() => post(`/projects/${projectId}/preview/stop`).then(live.reload)}>
              Stop
            </button>
          </>
        ) : (
          <button className="btn btn--sm" style={{ marginLeft: "auto" }} disabled={busy} onClick={start}>
            {busy ? "Starting…" : "Start preview"}
          </button>
        )}
      </div>
      {error ? <ErrorNotice error={error} doing="open this" /> : null}
      {pointing ? <PointAndSay projectId={projectId} size={device} onClose={() => setPointing(false)} /> : null}
      {live.data?.url || shots.length ? <DemoBanner projectId={projectId} /> : null}
      {live.data?.url ? (
        <div className={`preview-stage${frameWidth ? " preview-stage--device" : ""}`}>
          <iframe key={reloads} className="preview-frame" title={`Live preview, ${device}`} src={live.data.url} sandbox="allow-scripts allow-same-origin allow-forms" style={{ ...(frameWidth ? { width: frameWidth, maxWidth: "100%" } : {}) }} />
        </div>
      ) : shots.length ? (
        <ScreenshotGallery shots={shots} />
      ) : (
        <div style={{ padding: 12 }}>
          <Empty title="No preview yet">Once your app's required packages are added, you can open a live preview here. Pictures at phone, tablet and desktop sizes appear after FlowCode checks the app.</Empty>
        </div>
      )}
    </div>
  );
}

function ChangesPanel({ view, onChanged }: { view?: RunView; onChanged: () => void }) {
  const [selected, setSelected] = useState<string>();
  const [diff, setDiff] = useState<{ before: string | null; after: string | null }>();
  useEffect(() => {
    if (!selected) return;
    get<{ before: string | null; after: string | null }>(`/snapshots/${selected}/diff`).then(setDiff, () => setDiff(undefined));
  }, [selected]);
  if (!view?.snapshots.length) return <div style={{ padding: 12 }}><Empty title="No changes yet">Every change FlowCode makes is saved first, so you can undo any file, any step, or go back to an earlier point.</Empty></div>;
  const latestByFile = new Map<string, RunView["snapshots"][number]>();
  for (const s of view.snapshots) latestByFile.set(s.relativePath, s);
  return (
    <div>
      <table className="table">
        <thead>
          <tr>
            <th>File</th>
            <th>Operation</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...latestByFile.values()].map((s) => (
            <tr key={s.id} aria-selected={selected === s.id}>
              <td>
                <button className="btn btn--ghost btn--sm mono" onClick={() => setSelected(s.id)}>
                  {s.relativePath}
                </button>
              </td>
              <td className="mono muted">
                {s.operation}
                {s.contentHash === "absent" ? " (new)" : ""}
                {s.restoredAt ? " · restored" : ""}
              </td>
              <td style={{ textAlign: "right" }}>
                {!s.restoredAt && !view.active ? (
                  <button className="btn btn--sm" onClick={() => post(`/snapshots/${s.id}/restore`).then(onChanged)}>
                    Restore
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && diff ? (
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <div className="ws__colhead">
            <span className="label">diff (snapshot → current)</span>
          </div>
          <DiffView before={diff.before ?? ""} after={diff.after ?? ""} />
        </div>
      ) : null}
      <div style={{ borderTop: "1px solid var(--line)", padding: 12, display: "grid", gap: 8 }}>
        <span className="label">checkpoints</span>
        {view.checkpoints.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
            <Led status={c.safe ? "passed" : undefined} />
            <span>{c.label}</span>
            <span className="muted mono">{time(c.createdAt)}</span>
            {!view.active ? (
              <ConfirmButton className="btn btn--sm btn--ghost cp-restore" question={`Restore the workspace to "${c.label}"? Later changes are undone; snapshots are kept.`} confirmLabel="Restore" cancelLabel="Cancel" onConfirm={async () => (await post(`/runs/${view.run.id}/checkpoints/${c.id}/restore`), onChanged())}>
                Restore
              </ConfirmButton>
            ) : null}
          </div>
        ))}
      </div>
      <GitCommit projectId={view.run.projectId} />
    </div>
  );
}

function GitCommit({ projectId }: { projectId: string }) {
  const git = useResource<{ available: boolean; branch?: string; changes: Array<{ status: string; path: string }> }>(`/projects/${projectId}/git`);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string>();
  if (!git.data?.available) return null;
  return (
    <form
      style={{ borderTop: "1px solid var(--line)", padding: 12, display: "grid", gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        setResult("Waiting for your approval of git add / git commit under Needs you in the Overview (also on Approvals)…");
        post<{ status: string; step: string }>(`/projects/${projectId}/git/commit`, { message })
          .then((r) => setResult(`${r.step}: ${r.status}`), (err: Error) => setResult(err.message))
          .finally(git.reload);
      }}
    >
      <span className="label">
        git · {git.data.branch ?? "detached"} · {git.data.changes.length} change(s)
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <label htmlFor="commit-msg" className="sr-only">
          Commit message
        </label>
        <input id="commit-msg" className="input" placeholder="Commit message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <button className="btn" type="submit" disabled={message.length < 3 || !git.data.changes.length}>
          Commit…
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>{result ?? "Commits require approval. Push is disabled by policy."}</p>
    </form>
  );
}

/** Which agent an event belongs to: its role, or the role named at the start of its message ("coder requested …"). */
function agentOf(e: FlowEvent): string | undefined {
  const role = typeof e.data?.role === "string" ? e.data.role : undefined;
  if (role && ROLE_LABEL[role]) return role;
  const m = /^([a-z_]+) (?:requested|→|←)/.exec(e.message);
  return m && ROLE_LABEL[m[1]] ? m[1] : undefined;
}

/**
 * Everything FlowCode and its agents did for this request, newest first. Consecutive work by one agent is one block,
 * headed by that agent's robot head, name and start time, so a hand-over (Coder → Debugger) is easy to see.
 */
/** What each agent is doing while its model writes: in full (Overview, Activity) and short (the status strip). */
const ROLE_DOING_FULL: Record<string, string> = {
  planner: "drafting the plan",
  coder: "writing code",
  debugger: "working out a fix",
  accessibility_qa: "reviewing accessibility",
  security_qa: "reviewing security",
  critic: "reviewing the design",
  researcher: "researching",
  repository_analyst: "reading the repository",
  documenter: "writing the docs",
};
const ROLE_DOING: Record<string, string> = {
  planner: "drafting",
  coder: "coding",
  debugger: "fixing",
  accessibility_qa: "reviewing",
  security_qa: "reviewing",
  critic: "reviewing",
  researcher: "researching",
  repository_analyst: "reading",
  documenter: "writing",
};

/** The model the working agent is thinking with, when its latest event is a model call. */
export function modelNow(events: FlowEvent[]): string | undefined {
  const last = [...events].reverse().find((e) => e.type !== "command.output");
  return last?.type === "model.requested" ? last.message.split("→").pop()?.trim() || undefined : undefined;
}

/**
 * What the working agent is doing right now, in the same words everywhere it shows (Activity, Overview, status strip):
 * from the latest event, e.g. "drafting". The model it thinks with is shown beside it where there is room (modelNow).
 */
export function doingNow(events: FlowEvent[], role?: string, full = false): string {
  const last = [...events].reverse().find((e) => e.type !== "command.output");
  if (!last) return "working";
  if (last.type === "model.requested") {
    return (role && (full ? ROLE_DOING_FULL : ROLE_DOING)[role]) || "thinking";
  }
  if (last.type.startsWith("command.")) return "running a command";
  if (last.type.startsWith("tool.")) return "working in the files";
  if (last.type.startsWith("verification.")) return "checking the work";
  return "working";
}

/**
 * While a run is working: the agent's head moves, the row says what it is waiting on, and a clock counts the seconds
 * since the last event, so a long model call never looks frozen.
 */
function FeedWorking({ role, last, doing, model }: { role: string; last?: FlowEvent; doing: string; model?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const since = last ? Math.max(0, Math.floor((now - new Date(last.createdAt).getTime()) / 1000)) : 0;
  const clock = `${Math.floor(since / 60)}:${String(since % 60).padStart(2, "0")}`;
  return (
    <div className="feed__live" role="status">
      <RobotHead color={ROLE_COLOR[role] ?? "#9a9fd6"} id="feed-live" size={26} className="robot-head--working" />
      <span className="feed__agent-name">{ROLE_LABEL[role] ?? role}</span>
      <span className="feed__live-doing">is {doing}</span>
      {model ? <span className="feed__live-model">{model}</span> : null}
      <span className="feed__live-clock" aria-label={`${since} seconds since the last update`}>{clock}</span>
      <span className="feed__live-bar sug-progress__bar" aria-hidden="true">
        <span className="is-indeterminate" />
      </span>
    </div>
  );
}

function ActivityFeed({ events, working }: { events: FlowEvent[]; working?: string }) {
  const items = events.filter((e) => e.type !== "command.output").slice(-400);
  if (!items.length) return <div style={{ padding: 12 }}><Empty title="Nothing has happened yet">Each thing FlowCode and its agents do for this request is listed here as it happens.</Empty></div>;
  // Oldest first, events without a role belong to whoever is working; a task start or a new role opens a block.
  const blocks: Array<{ agent?: string; events: FlowEvent[] }> = [];
  let current: string | undefined;
  for (const e of items) {
    const who = agentOf(e);
    const opens = (who && who !== current) || e.type === "task.started";
    if (who) current = who;
    if (opens || !blocks.length) blocks.push({ agent: who ?? (e.type === "task.started" ? undefined : current), events: [e] });
    else blocks[blocks.length - 1].events.push(e);
  }
  return (
    <>
    {working ? <FeedWorking role={working} last={items[items.length - 1]} doing={doingNow(items, working, true)} model={modelNow(items)} /> : null}
    <ol className="feed feed--agents" aria-live="off">
      {blocks.reverse().map((blk, bi) => {
        const first = blk.events[0];
        return (
          <li key={first.seq} className="feed__block">
            {blk.agent ? (
              <div className="feed__agent">
                <RobotHead color={ROLE_COLOR[blk.agent] ?? "#9a9fd6"} id={`feed-${first.seq}`} size={26} className={working && bi === 0 ? "robot-head--working" : undefined} />
                <span className="feed__agent-name">{ROLE_LABEL[blk.agent] ?? blk.agent}</span>
                <span className="feed__agent-time">started {time(first.createdAt)}</span>
              </div>
            ) : null}
            <ul className="feed__list">
              {[...blk.events].reverse().map((e) => (
                <li key={e.seq} className={`feed__item act act--${actKind(e.type, e.level, e.message)}${e.type === "agent.message" ? " feed__item--agent" : ""}`}>
                  <span className="feed__time">{time(e.createdAt)}</span>
                  <Led status={e.level === "error" || e.type === "task.blocked" || e.type === "tool.rejected" ? "failed" : e.level === "warning" ? "awaiting_approval" : e.type === "agent.message" ? "running" : /verified|completed|passed|approved|ready/.test(e.type) ? "passed" : undefined} />
                  <FeedMessage type={e.type === "agent.message" ? undefined : e.type} message={e.message} />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
    </>
  );
}

/**
 * Activity colours by what an event is: failures red, model calls blue, tool calls teal, commands amber, checks green,
 * steps and plans purple, run status grey.
 */
function actKind(type: string, level?: string, message = ""): string {
  if (level === "error" || /failed|rejected|blocked/.test(type) || /→ (failed|error)/.test(message)) return "bad";
  if (level === "warning" || /approval|recovery|retry/.test(type)) return "warn";
  if (type.startsWith("model.")) return "model";
  if (type.startsWith("tool.")) return "tool";
  if (type.startsWith("command.")) return "cmd";
  if (type.startsWith("verification.")) return "check";
  if (/^(task|plan|phase)\./.test(type)) return "step";
  if (type === "agent.message") return "agent";
  return "run";
}

/** Long event messages (plans, pasted specs) collapse to three lines with an explicit expand control. */
function FeedMessage({ type, message }: { type?: string; message: string }) {
  const [full, setFull] = useState(false);
  const long = message.length > 240;
  return (
    <span className="feed__msg">
      <span className={long && !full ? "feed__text feed__text--clamped" : "feed__text"}>
        {type ? <span className="label" style={{ marginRight: 8 }}>{type}</span> : null}
        {message}
      </span>
      {long ? (
        <button className="feed__more" aria-expanded={full} onClick={() => setFull(!full)}>
          {full ? "Show less" : "Show more"}
        </button>
      ) : null}
    </span>
  );
}

/** Command status → the app's status colours: teal passed, red failed, blue running, purple waiting, grey not yet. */
const termStatus = (s: string) => (s === "succeeded" ? "ok" : /fail|timed|killed|error/.test(s) ? "bad" : /running|started/.test(s) ? "run" : /awaiting|blocked|queued/.test(s) ? "wait" : "idle");

/**
 * One output line, coloured by what it says: errors red (the file and line in blue so they're easy to find), passes
 * teal, warnings yellow, npm's own echo lines grey.
 */
function TermLine({ line, prev = [] }: { line: string; prev?: string[] }) {
  // The rest of a multi-line error ("  Property 'children' does not exist…") stays red with the line that started it.
  let start = prev.length - 1;
  while (start >= 0 && prev[start].trim() && !/^\S+\.\w+[(:]\d+[,:]\d+/.test(prev[start]) && !/^\s*>/.test(prev[start])) start--;
  const continues = !!line.trim() && !/^\S+\.\w+[(:]\d+[,:]\d+/.test(line) && start >= 0 && start < prev.length && /^\S+\.\w+[(:]\d+[,:]\d+\)?:? error\b/.test(prev[start]);
  const tone = continues || /\berror\b|\bERR!|\bFAIL\b|✗|×|failed\b/i.test(line)
    ? "bad"
    : /\bwarn(ing)?\b/i.test(line)
      ? "warn"
      : /✓|√|\bpassed\b|\bPASS\b|\bsucceeded\b/.test(line)
        ? "ok"
        : /^\s*> /.test(line)
          ? "echo"
          : /^\s*RUN\s/.test(line)
            ? "run"
            : "";
  // "src/App.tsx(2,27): error TS2307: …": the location is the part people look for.
  const loc = /^(\s*)(\S+\.\w+[(:]\d+[,:]\d+\)?:?)(.*)$/.exec(line);
  return (
    <span className={tone ? `term__line term__line--${tone}` : "term__line"}>
      {loc ? (
        <>
          {loc[1]}
          <span className="term__loc">{loc[2]}</span>
          {loc[3]}
        </>
      ) : (
        line
      )}
      {"\n"}
    </span>
  );
}

function Terminal({ events, commands }: { events: FlowEvent[]; commands: CommandRecord[] }) {
  const byCommand = new Map<string, string>();
  for (const e of events) if (e.type === "command.output") byCommand.set(String(e.data.commandId), (byCommand.get(String(e.data.commandId)) ?? "") + e.message);
  // Follow the latest output like a real terminal: stick to the bottom while you're there; scrolling up to read earlier
  // output pauses it until you scroll back down.
  const ref = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);
  const outputSize = events.length + commands.length;
  useEffect(() => {
    const box = ref.current?.closest<HTMLElement>(".ws__scroll");
    if (!box) return;
    const onScroll = () => {
      pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < 48;
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => box.removeEventListener("scroll", onScroll);
  }, [commands.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const box = ref.current?.closest<HTMLElement>(".ws__scroll");
    if (box && pinned.current) box.scrollTop = box.scrollHeight;
  }, [outputSize]);
  if (!commands.length) return <div style={{ padding: 12 }}><Empty title="No commands yet">When FlowCode runs a command, like adding packages or starting your app, its output appears here (with private details hidden).</Empty></div>;
  return (
    <pre ref={ref} className="term" aria-label="Terminal output">
      {commands.map((c) => (
        <span key={c.id}>
          <span className="term__cmd">
            {c.argv.join(" ")}
            {"  "}
            <span className={`term__status term__status--${termStatus(c.status)}`}>{c.status}</span>
            <span className="muted">
              {" "}
              [{c.policyTier}
              {c.exitCode !== undefined ? ` · exit ${c.exitCode}` : ""}
              {c.durationMs ? ` · ${(c.durationMs / 1000).toFixed(1)}s` : ""}]
            </span>
          </span>
          {"\n"}
          {(byCommand.get(c.id) ?? c.outputPreview ?? "")
            .slice(-20000)
            .split(/\r?\n/)
            .map((line, i, all) => (
              <TermLine key={i} line={line} prev={all.slice(0, i)} />
            ))}
        </span>
      ))}
    </pre>
  );
}

function RunDiagnostics({ events, view }: { events: FlowEvent[]; view?: RunView }) {
  const diag = events.filter((e) => ["model.failed", "model.retry_scheduled", "policy.rejected", "process.cleanup", "tool.rejected"].includes(e.type));
  const fingerprints = (view?.commands ?? []).filter((c) => c.errorFingerprint);
  return (
    <div style={{ display: "grid" }}>
      <div className="ws__colhead">
        <span className="label">provider, policy & cleanup</span>
      </div>
      {diag.length ? (
        <ul className="feed">
          {diag.map((e) => (
            <li key={e.seq} className="feed__item">
              <span className="feed__time">{time(e.createdAt)}</span>
              <Led status={e.level === "error" ? "failed" : "awaiting_approval"} />
              <span className="feed__msg">
                <span className="label" style={{ marginRight: 8 }}>{e.type}</span>
                {e.message}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ padding: "8px 16px" }}>No provider errors, policy rejections or cleanup events for this run.</p>
      )}
      <div className="ws__colhead">
        <span className="label">command fingerprints</span>
      </div>
      {fingerprints.length ? (
        <table className="table">
          <tbody>
            {fingerprints.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.errorFingerprint}</td>
                <td className="mono">{c.argv.join(" ")}</td>
                <td>
                  <StatusChip status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted" style={{ padding: "8px 16px" }}>No failing commands.</p>
      )}
    </div>
  );
}

function FileViewer({ projectId, path }: { projectId: string; path: string }) {
  const { data, error } = useResource<{ content: string; truncated: boolean; binary: boolean }>(`/projects/${projectId}/file?path=${encodeURIComponent(path)}`);
  if (error) return <ErrorNotice error={error} doing="open this" />;
  if (!data) return null;
  if (data.binary) return <p className="muted" style={{ padding: 12 }}>Binary file.</p>;
  return (
    <>
      <CodeView path={path} content={data.content} />
      {data.truncated ? <p className="muted codeview__more">The file is longer than this; the rest is not shown.</p> : null}
    </>
  );
}

/** A small copy button for the live preview address, with a brief "copied" check. */
function CopyUrl({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  const copy = () =>
    void navigator.clipboard?.writeText(url).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    });
  return (
    <button type="button" className="icon-copy" onClick={copy} aria-label={done ? "Copied" : "Copy preview address"} title={done ? "Copied" : "Copy address"}>
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}
