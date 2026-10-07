/**
 * Approvals: everything waiting on you, in one place, with the decision history beside it. Requests that hold up a build
 * come first (with how long they've waited); FlowCode's optional suggestions are kept apart; the log shows every
 * decision: approvals, settings, models, skills, recoveries, rollbacks, run control and improvements.
 * One source of truth: these are the same approval records the builder and the phone page use.
 */
import { useMemo, useState } from "react";
import type { Approval, Project } from "@flowcode/contracts";
import { useResource } from "../api";
import { ApprovalCard } from "../components/ApprovalCard";
import { Tabs, ago } from "../components/ui";
import { navigate } from "../router";
import { DecisionCalendar, type LogEntry } from "../components/DecisionCalendar";

interface Decision {
  id: string;
  at: string;
  kind: string;
  actor: "user" | "flowcode";
  summary: string;
  reason?: string;
  projectId?: string;
  runId?: string;
  ref?: string;
}

const KIND: Record<string, string> = { approval: "Approval", settings: "Settings", model: "Models", prompt_skill: "Prompts & skills", recovery: "Recovery", rollback: "Undo", run_control: "Build control", improvement: "Improvement" };
const RISK: Record<string, string> = { low: "Low risk", medium: "Medium risk", high: "High risk", critical: "Critical risk" };
const WHAT: Record<string, string> = {
  file_operation: "Change files outside the step's usual scope",
  command: "Run a command on your computer",
  dependency_install: "Install packages",
  plan: "Start building from this plan",
  external_research: "Search the web",
  network: "Use the network",
  tool: "Use an outside tool",
};

export function ApprovalsView({ projects }: { projects: Project[] }) {
  const pending = useResource<Approval[]>("/approvals", [], 10_000);
  const history = useResource<Approval[]>("/approvals/history?limit=500", [], 0);
  const decisions = useResource<Decision[]>("/decisions?limit=5000", [], 0);
  const [tab, setTab] = useState<"waiting" | "ideas" | "log">("waiting");
  const [kind, setKind] = useState("");
  const name = useMemo(() => new Map(projects.map((p) => [p.id, p.name.replace(/\s+/g, " ")])), [projects]);
  const reload = () => {
    pending.reload();
    history.reload();
    decisions.reload();
  };
  const blocking = (pending.data ?? []).filter((a) => a.kind !== "enhancement_idea").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const allIdeas = (pending.data ?? []).filter((a) => a.kind === "enhancement_idea");
  const ideas = allIdeas.filter((a) => !a.savedForLater);
  const saved = allIdeas.filter((a) => a.savedForLater);
  const savedByProject = [...saved.reduce((m, a) => m.set(a.projectId, (m.get(a.projectId) ?? 0) + 1), new Map<string, number>())];
  const log = (decisions.data ?? []).filter((d) => !kind || d.kind === kind);
  // One dated feed for the calendar: the decision log, plus decided approvals from before it existed (not logged twice).
  const logged = new Set((decisions.data ?? []).map((d) => d.ref).filter(Boolean));
  const entries: LogEntry[] = [
    ...log.map((d) => ({ id: d.id, at: d.at, chip: KIND[d.kind] ?? d.kind, summary: d.summary, ...(d.reason ? { reason: d.reason } : {}), who: `${d.actor === "user" ? "You" : "FlowCode"}${d.projectId ? ` · ${name.get(d.projectId) ?? "project"}` : ""}`, ...(d.projectId ? { projectId: d.projectId } : {}), ...(d.runId ? { runId: d.runId } : {}) })),
    ...(!kind || kind === "approval"
      ? (history.data ?? [])
          .filter((a) => a.resolvedAt && !logged.has(`approval:${a.id}`))
          .map((a) => ({ id: a.id, at: a.resolvedAt!, chip: a.status === "approved" ? "Approved" : a.status === "denied" ? "Denied" : "Expired", summary: a.action.slice(0, 160), who: name.get(a.projectId) ?? "", projectId: a.projectId, ...(a.runId ? { runId: a.runId } : {}) }))
      : []),
  ];

  return (
    <div className="page page-enter approvals-page">
      <header className="page__head">
        <div>
          <span className="label">Work</span>
          <h1 className="page__title">Approvals</h1>
          <p className="lib__lede">What's waiting on you, and every decision made so far. Nothing waiting here runs until you decide.</p>
        </div>
      </header>
      <Tabs
        label="Approvals"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        tabs={[
          { id: "waiting", label: `Waiting on you${blocking.length ? ` (${blocking.length})` : ""}` },
          { id: "ideas", label: `Suggestions${ideas.length ? ` (${ideas.length})` : ""}` },
          { id: "log", label: "Decision log" },
        ]}
      />
      {tab === "waiting" ? (
        blocking.length ? (
          <ul className="apv-list">
            {blocking.map((a) => (
              <li key={a.id} className="apv-item">
                <div className="apv-item__meta">
                  <strong>{name.get(a.projectId) ?? "A project"}</strong>
                  <span>{WHAT[a.kind] ?? a.kind.replace(/_/g, " ")}</span>
                  <span className={`chip apv-risk apv-risk--${a.risk}`}>{RISK[a.risk] ?? a.risk}</span>
                  <span className="muted">waiting {ago(a.createdAt).replace(/ ago$/, "")}</span>
                  {a.runId ? (
                    <button type="button" className="btn btn--sm apv-item__open" onClick={() => navigate(`/projects/${a.projectId}/runs/${a.runId}`)}>
                      Open the build
                    </button>
                  ) : null}
                </div>
                <ApprovalCard approval={a} onDecided={reload} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="apv-empty">Nothing is waiting on you. Builds that need a decision show up here.</p>
        )
      ) : null}
      {tab === "ideas" ? (
        allIdeas.length ? (
          <>
            <p className="muted apv-note">New ideas FlowCode found while building. They never hold up a build. Build one now, save it for later (it moves to its project's Suggestions tab), or dismiss it.</p>
            {!ideas.length ? <p className="apv-empty">No new ideas right now.</p> : null}
            <ul className="apv-list">
              {ideas.map((a) => (
                <li key={a.id} className="apv-item">
                  <div className="apv-item__meta">
                    <strong>{name.get(a.projectId) ?? "A project"}</strong>
                    <span className="muted">suggested {ago(a.createdAt)}</span>
                  </div>
                  <ApprovalCard approval={a} onDecided={reload} />
                </li>
              ))}
            </ul>
            {/* Saved ideas live on each project's own Suggestions tab, not here. */}
            {savedByProject.length ? (
              <p className="muted apv-note apv-saved-note">
                Saved for later:{" "}
                {savedByProject.map(([pid, n], i) => (
                  <span key={pid}>
                    {i ? ", " : ""}
                    <a href={`#/quality/${pid}/ideas`}>
                      {name.get(pid) ?? "A project"} ({n})
                    </a>
                  </span>
                ))}
                . They&apos;re on each project&apos;s Suggestions tab.
              </p>
            ) : null}
          </>
        ) : (
          <p className="apv-empty">No suggestions right now.</p>
        )
      ) : null}
      {tab === "log" ? (
        <section className="apv-log" aria-label="Decision log">
          <DecisionCalendar
            entries={entries}
            emptyHint={kind ? ` of this kind` : ""}
            filter={
              <div className="apv-log__filters">
                <label className="label" htmlFor="apv-kind">
                  Show
                </label>
                <select id="apv-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="">All decisions</option>
                  {Object.entries(KIND).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </section>
      ) : null}
    </div>
  );
}
