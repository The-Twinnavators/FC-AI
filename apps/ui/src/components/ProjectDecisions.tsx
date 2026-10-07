/**
 * One project's decision cards, for the project page: what's waiting on you (requests that hold up a build) or FlowCode's
 * optional ideas (new and saved for later). The same approval records as the Approvals page and the builder.
 */
import type { Approval } from "@flowcode/contracts";
import { useResource } from "../api";
import { ApprovalCard } from "./ApprovalCard";
import { RobotHead, ROLE_COLOR } from "./RobotHead";
import { ago } from "./ui";
import { navigate } from "../router";
import { useState } from "react";
import { post } from "../api";
import { ErrorNotice } from "./ui";

/** Your own idea: a short title and, if you like, what should be built. Save it for later or build it now. */
function AddIdea({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState<"save" | "build">();
  const [error, setError] = useState<string>();
  const submit = async (buildNow: boolean) => {
    if (title.trim().length < 3) return setError("Give the idea a short title (at least 3 characters).");
    setBusy(buildNow ? "build" : "save");
    setError(undefined);
    try {
      const res = await post<{ followUpRunId?: string }>(`/projects/${projectId}/ideas`, { title: title.trim(), ...(detail.trim() ? { detail: detail.trim() } : {}), buildNow });
      setTitle("");
      setDetail("");
      onAdded();
      if (buildNow && res?.followUpRunId) navigate(`/projects/${projectId}/runs/${res.followUpRunId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <form
      className="add-idea"
      aria-labelledby="add-idea-title"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <div className="add-idea__head">
        <h2 id="add-idea-title" className="apv-h">
          Add your own idea
        </h2>
        <p className="muted">Something you want in this project. Save it for later, or start building it now.</p>
      </div>
      <label className="add-idea__field">
        <span className="label">Your idea</span>
        <input className="input" data-cp="idea-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Let shoppers compare two brands side by side" />
      </label>
      <label className="add-idea__field">
        <span className="label">What should be built? (optional)</span>
        <textarea className="textarea" data-cp="idea-detail" rows={5} value={detail} maxLength={4000} onChange={(e) => setDetail(e.target.value)} placeholder="Where it goes, what it does, and how you'd check it works." />
      </label>
      {error ? <ErrorNotice error={error} doing="add that idea" /> : null}
      <div className="add-idea__actions">
        <button type="submit" className="btn btn--primary" data-cp="idea-save" disabled={!!busy}>
          {busy === "save" ? "Saving…" : "Save for later"}
        </button>
        <button type="button" className="btn" disabled={!!busy} onClick={() => void submit(true)}>
          {busy === "build" ? "Writing the brief…" : "Build this now"}
        </button>
        {title || detail ? (
          <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={() => (setTitle(""), setDetail(""), setError(undefined))}>
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}

const RISK: Record<string, string> = { low: "Low risk", medium: "Medium risk", high: "High risk", critical: "Critical risk" };

/** This project's pending approvals, split into blocking requests, new ideas and saved ideas. */
export function useProjectDecisions(projectId: string) {
  const res = useResource<Approval[]>(`/approvals?projectId=${projectId}`, [projectId], 10_000);
  const all = res.data ?? [];
  return {
    reload: res.reload,
    waiting: all.filter((a) => a.kind !== "enhancement_idea").sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    ideas: all.filter((a) => a.kind === "enhancement_idea" && !a.savedForLater),
    saved: all.filter((a) => a.kind === "enhancement_idea" && a.savedForLater),
  };
}

export function ProjectDecisions({ projectId, mode }: { projectId: string; mode: "waiting" | "ideas" }) {
  const d = useProjectDecisions(projectId);
  if (mode === "waiting") {
    return d.waiting.length ? (
      <ul className="apv-list">
        {d.waiting.map((a) => (
          <li key={a.id} className="apv-item">
            <div className="apv-item__meta">
              <span className={`chip apv-risk apv-risk--${a.risk}`}>{RISK[a.risk] ?? a.risk}</span>
              <span className="muted">waiting {ago(a.createdAt).replace(/ ago$/, "")}</span>
              {a.runId ? (
                <button type="button" className="btn btn--sm apv-item__open" onClick={() => navigate(`/projects/${a.projectId}/runs/${a.runId}`)}>
                  Open the build
                </button>
              ) : null}
            </div>
            <ApprovalCard approval={a} onDecided={d.reload} />
          </li>
        ))}
      </ul>
    ) : (
      <p className="apv-empty">Nothing in this project is waiting on you. When a build needs a decision, it shows up here.</p>
    );
  }
  const list = (items: Approval[]) => (
    <ul className="apv-list">
      {items.map((a) => (
        <li key={a.id} className="apv-item">
          <div className="apv-item__meta">
            <span className="muted">suggested {ago(a.createdAt)}</span>
          </div>
          <ApprovalCard approval={a} onDecided={d.reload} savedTo="below" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="ideas-layout">
      <div className="ideas-layout__main">
      <div className="ideas-by">
        <span className="ideas-by__agent" title="The Researcher agent suggests these ideas">
          <RobotHead color={ROLE_COLOR.researcher!} id="ideas-researcher" size={32} />
          <span>Researcher</span>
        </span>
        <p className="muted">
          After each build, the Researcher agent looks at what similar apps do and suggests ideas for this one. Your own ideas sit alongside. None of them hold up a build: build one now, save it for later, or dismiss it.
        </p>
      </div>
      {!d.ideas.length && !d.saved.length ? <p className="apv-empty">No ideas yet. Add your own, or the Researcher agent will suggest some after a build finishes.</p> : null}
      {d.ideas.length ? (
        <>
          <h2 className="apv-h">New ideas ({d.ideas.length})</h2>
          {list(d.ideas)}
        </>
      ) : null}
      {d.saved.length ? (
        <>
          <h2 className="apv-h">Saved for later ({d.saved.length})</h2>
          {list(d.saved)}
        </>
      ) : null}
      </div>
      <aside className="ideas-layout__side">
        <AddIdea projectId={projectId} onAdded={d.reload} />
      </aside>
    </div>
  );
}
