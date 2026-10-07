/**
 * Project Journal: see what FlowCode did, what worked, what needs improvement, and what to try next. One run at a time,
 * built from the run's own records; each statement says whether it was observed, suspected, an interpretation, a
 * verified improvement or an open question. Questions are answered from the selected run only.
 */
import { useEffect, useState } from "react";
import type { Project } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { ErrorNotice, StatusChip } from "../components/ui";
import { navigate } from "../router";

interface Statement {
  kind: "observed" | "suspected" | "interpretation" | "verified" | "open_question";
  text: string;
  evidence: string[];
}
interface Entry {
  runId: string;
  createdAt: string;
  status: string;
  asked: string;
  contributions: Array<{ role: string; models: string[]; calls: number; steps: number; stepsPassed: number }>;
  worked: Statement[];
  wentWrong: Statement[];
  repaired: Statement[];
  incomplete: Statement[];
  checked: Statement[];
  notChecked: Statement[];
  time: { measured: boolean; phases: Array<{ phase: string; minutes: number }>; waitingMinutes?: number; totalMinutes?: number };
  prd: Statement[];
  next: Statement[];
  proposals: Array<{ id: string; name: string; status: string }>;
}
interface Journal {
  projectId: string;
  projectName: string;
  entries: Entry[];
}

const KIND: Record<Statement["kind"], string> = { observed: "Observed", suspected: "Suspected cause", interpretation: "FlowCode's reading", verified: "Verified", open_question: "Open question" };
const ROLE: Record<string, string> = { planner: "Planner", coder: "Coder", debugger: "Debugger", critic: "Design critic", documenter: "Writer", designer: "Designer", researcher: "Researcher" };
const QUESTIONS = ["Why did this take so long?", "What caused the failure?", "What did the design critic contribute?", "Which part of my PRD was unclear?", "What should I improve before the next build?", "What was not verified?"];

function Statements({ title, items, empty }: { title: string; items: Statement[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <section className="jr__section">
      <h3 className="jr__h">{title}</h3>
      {items.length ? (
        <ul className="jr__list">
          {items.map((s, i) => (
            <li key={i} className="jr__item">
              <span className={`jr__kind jr__kind--${s.kind}`}>{KIND[s.kind]}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="jr__empty">{empty}</p>
      )}
    </section>
  );
}

export function JournalView({ projectId, runId, projects }: { projectId?: string; runId?: string; projects: Project[] }) {
  const pid = projectId ?? projects[0]?.id;
  const journal = useResource<Journal>(pid ? `/projects/${pid}/journal` : null, [pid]);
  const entries = journal.data?.entries ?? [];
  const entry = entries.find((e) => e.runId === runId) ?? entries[0];
  const [q, setQ] = useState("");
  const [answers, setAnswers] = useState<Array<{ q: string; a: string; source: string }>>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  // Switching project or run starts a fresh conversation: earlier answers were about another run.
  useEffect(() => setAnswers([]), [pid, entry?.runId]);
  const ask = async (question: string) => {
    if (!pid || !entry || !question.trim()) return;
    setAsking(true);
    setError(undefined);
    try {
      const r = await post<{ answer: string; source: string }>(`/projects/${pid}/journal/ask`, { runId: entry.runId, question });
      setAnswers((a) => [...a, { q: question, a: r.answer, source: r.source }]);
      setQ("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="page page-enter journal-page">
      <header className="page__head">
        <div>
          <span className="label">Project</span>
          <h1 className="page__title">Project Journal</h1>
          <p className="lib__lede">See what FlowCode did, what worked, what needs improvement, and what to try next. Built from each run's records; every line says whether it was observed or is FlowCode's reading.</p>
        </div>
        <div className="jr__pickers">
          <label className="sr-only" htmlFor="jr-project">
            Project
          </label>
          <select id="jr-project" className="select" value={pid ?? ""} onChange={(e) => navigate(`/journal/${e.target.value}`)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.replace(/\s+/g, " ")}
              </option>
            ))}
          </select>
          {entries.length ? (
            <>
              <label className="sr-only" htmlFor="jr-run">
                Run
              </label>
              <select id="jr-run" className="select" value={entry?.runId ?? ""} onChange={(e) => navigate(`/journal/${pid}/${e.target.value}`)}>
                {entries.map((e) => (
                  <option key={e.runId} value={e.runId}>
                    {new Date(e.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} — {e.asked.slice(0, 50)}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
      </header>
      {journal.error ? <ErrorNotice error={journal.error} doing="open the journal" /> : null}
      {!entry ? (
        <p className="jr__empty">No runs yet for this project.</p>
      ) : (
        <div className="jr">
          <div className="jr__main">
            <section className="jr__section jr__lead">
              <div className="jr__lead-head">
                <StatusChip status={entry.status} dot />
                <button type="button" className="btn btn--sm" onClick={() => navigate(`/projects/${pid}/runs/${entry.runId}`)}>
                  Open the build
                </button>
              </div>
              <h2 className="jr__asked">{entry.asked}</h2>
            </section>
            <section className="jr__section">
              <h3 className="jr__h">Who did what</h3>
              <ul className="jr__roles">
                {entry.contributions.map((c) => (
                  <li key={c.role}>
                    <strong>{ROLE[c.role] ?? c.role}</strong>
                    <span>
                      {c.steps ? `${c.stepsPassed} of ${c.steps} step${c.steps === 1 ? "" : "s"} passed · ` : ""}
                      {c.calls} model call{c.calls === 1 ? "" : "s"}
                    </span>
                    <span className="muted mono">{c.models.join(", ") || "no model recorded"}</span>
                  </li>
                ))}
              </ul>
            </section>
            <Statements title="What worked" items={entry.worked} empty="Nothing passed in this run." />
            <Statements title="What went wrong" items={entry.wentWrong} empty="Nothing went wrong that was recorded." />
            <Statements title="What was repaired" items={entry.repaired} />
            <Statements title="Still incomplete" items={entry.incomplete} />
            <Statements title="Not checked" items={entry.notChecked} />
            <Statements title="Checked" items={entry.checked} />
            <section className="jr__section">
              <h3 className="jr__h">Where the time went</h3>
              {entry.time.measured ? (
                <p className="jr__text">
                  {entry.time.totalMinutes} min in all{entry.time.waitingMinutes ? `, of which ${entry.time.waitingMinutes} min waiting for you` : ""}. {entry.time.phases.map((p) => `${p.phase}: ${p.minutes} min`).join(" · ")}
                </p>
              ) : (
                <p className="jr__empty">Not measured.</p>
              )}
            </section>
            <Statements title="How clear the PRD was" items={entry.prd} empty="The plan didn't record anything it found unclear." />
            <Statements title="What to try next" items={entry.next} />
          </div>
          <aside className="jr__ask" aria-label="Ask about this run">
            <h3 className="jr__h">Ask about this run</h3>
            <p className="jr__support">Answers come from this run's records only.</p>
            <div className="jr__suggest">
              {QUESTIONS.map((s) => (
                <button key={s} type="button" className="btn btn--sm" disabled={asking} onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
            <form
              className="jr__form"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(q);
              }}
            >
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="How is this run different from the last one?" aria-label="Your question" />
              <button type="submit" className="btn btn--primary btn--sm" disabled={asking || !q.trim()}>
                {asking ? "Looking…" : "Ask"}
              </button>
            </form>
            {error ? <ErrorNotice error={error} doing="answer that" /> : null}
            <ol className="jr__answers">
              {answers.map((x, i) => (
                <li key={i}>
                  <strong>{x.q}</strong>
                  <p>{x.a}</p>
                  <span className="muted">{x.source === "model" ? "Worded by your local model from the records" : "Straight from the records"}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
