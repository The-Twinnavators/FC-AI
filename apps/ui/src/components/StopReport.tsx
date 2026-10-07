/**
 * "Why it stopped": shown at the top of a build that is blocked, failed or cancelled. Says who or what stopped it and
 * why, where it got to, what FlowCode found when it looked into it, research for a way forward, and what to do next.
 * FlowCode builds this automatically when a build stops; opening it here fills in anything still missing.
 */
import { useState } from "react";
import { ArrowRight, BookOpen, Globe, History, Search } from "lucide-react";
import { post, useResource } from "../api";
import { navigate } from "../router";
import { SkeletonBlock } from "./motion";

interface Report {
  runId: string;
  status: string;
  stoppedBecause: string;
  progress: { done: number; total: number };
  stoppedAt?: { taskId: string; title: string; reason?: string; attempts: number };
  carriedOnBy?: { runId: string; title: string; status: string; why: string };
  diagnosis?: { title: string; summary: string; explanation?: string; causes: Array<{ id: string; title: string; evidence: string }> };
  research: {
    similarSteps: Array<{ title: string; project: string; attempts: number }>;
    knowledge: Array<{ id: string; title: string; snippet: string }>;
    web: Array<{ title: string; url: string; snippet: string }>;
    webSkipped?: string;
  };
  next: Array<{ kind: "open_run" | "resume" | "troubleshoot" | "follow_up"; label: string; detail: string; runId?: string; taskId?: string; text?: string }>;
}

export function StopReport({ runId, projectId, onTroubleshoot, onFollowUp, onChanged }: { runId: string; projectId: string; onTroubleshoot: (taskId: string) => void; onFollowUp: (text: string) => void; onChanged: () => void }) {
  const { data, error, loading } = useResource<Report | null>(`/runs/${runId}/stop-report`, [runId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  if (loading && !data) {
    return (
      <section className="stop-report" aria-label="Why it stopped">
        <h3 className="stop-report__title">Why it stopped</h3>
        <p className="muted" style={{ margin: 0 }}>Looking into what happened and how to get past it…</p>
        <SkeletonBlock rows={3} />
      </section>
    );
  }
  if (error || !data) return null;

  const act = async (n: Report["next"][number]) => {
    if (n.kind === "open_run" && n.runId) return navigate(`/projects/${projectId}/runs/${n.runId}`);
    if (n.kind === "troubleshoot" && n.taskId) return onTroubleshoot(n.taskId);
    if (n.kind === "follow_up") return onFollowUp(n.text ?? "");
    if (n.kind === "resume") {
      setBusy(true);
      try {
        await post(`/runs/${runId}/resume`);
        setMsg("Resumed. The stuck steps are trying again.");
        onChanged();
      } catch (e) {
        setMsg((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
  };
  const r = data.research;
  const anyResearch = r.similarSteps.length + r.knowledge.length + r.web.length > 0;

  return (
    <section className="stop-report" aria-label="Why it stopped">
      <h3 className="stop-report__title">Why it stopped</h3>
      <p className="stop-report__lead">{data.stoppedBecause}</p>
      <p className="stop-report__meta">
        {data.progress.done} of {data.progress.total} steps were done
        {data.stoppedAt ? (
          <>
            {" "}· it stopped on <strong>{data.stoppedAt.title}</strong>
            {data.stoppedAt.attempts ? ` after ${data.stoppedAt.attempts} ${data.stoppedAt.attempts === 1 ? "try" : "tries"}` : ""}
          </>
        ) : null}
      </p>

      {data.diagnosis && !data.carriedOnBy ? (
        <div className="stop-report__block">
          <h4 className="stop-report__h">
            <Search size={14} aria-hidden="true" /> What FlowCode found
          </h4>
          <p>{data.diagnosis.explanation ?? data.diagnosis.summary}</p>
          {data.diagnosis.causes.length ? (
            <ul className="stop-report__list">
              {data.diagnosis.causes.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <strong>{c.title}</strong> <span className="muted">{c.evidence.slice(0, 200)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!data.carriedOnBy ? (
        <div className="stop-report__block">
          <h4 className="stop-report__h">
            <BookOpen size={14} aria-hidden="true" /> Research
          </h4>
          {r.similarSteps.length ? (
            <>
              <p className="stop-report__sub">
                <History size={13} aria-hidden="true" /> Similar steps that passed before
              </p>
              <ul className="stop-report__list">
                {r.similarSteps.map((s) => (
                  <li key={`${s.project}-${s.title}`}>
                    {s.title} <span className="muted">· {s.project}, {s.attempts} {s.attempts === 1 ? "try" : "tries"}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {r.knowledge.length ? (
            <>
              <p className="stop-report__sub">
                <BookOpen size={13} aria-hidden="true" /> In your Knowledge
              </p>
              <ul className="stop-report__list">
                {r.knowledge.map((k) => (
                  <li key={k.id}>
                    <strong>{k.title}</strong> <span className="muted">{k.snippet}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {r.web.length ? (
            <>
              <p className="stop-report__sub">
                <Globe size={13} aria-hidden="true" /> On the web
              </p>
              <ul className="stop-report__list">
                {r.web.map((w) => (
                  <li key={w.url}>
                    <a href={w.url} target="_blank" rel="noreferrer">
                      {w.title}
                    </a>{" "}
                    <span className="muted">{w.snippet}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {!anyResearch ? <p className="muted" style={{ margin: 0 }}>Nothing similar found in earlier builds or your Knowledge yet.</p> : null}
          {r.webSkipped ? <p className="muted stop-report__note">{r.webSkipped}</p> : null}
        </div>
      ) : null}

      {data.next.length ? (
        <div className="stop-report__actions">
          {data.next.map((n, i) => (
            <button key={n.kind + i} type="button" className={`btn btn--sm${i === 0 ? " btn--primary" : ""}`} disabled={busy} title={n.detail} onClick={() => void act(n)}>
              {n.label} {n.kind === "open_run" ? <ArrowRight size={14} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {msg ? (
        <p className="muted" role="status" style={{ margin: 0 }}>
          {msg}
        </p>
      ) : null}
    </section>
  );
}
