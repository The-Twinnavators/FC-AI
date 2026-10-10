/**
 * Virtual interviews and virtual user testing: AI-simulated participants answer the interview plan or try the test
 * tasks. FlowCode runs one participant per request so progress shows, then summarizes. Everything here is labelled as
 * an AI-generated perspective and sits apart from real findings.
 */
import { useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { VIRTUAL_INTERVIEW_NOTE, VIRTUAL_TEST_NOTE, type DiscoveryProject } from "@flowcode/contracts";
import { post } from "../../api";
import { ago } from "../ui";
import { EvidenceTag } from "./Blocks";

type ViewLike = { project: DiscoveryProject };

/** Runs start → each participant → summary, reporting progress as it goes. */
function useVirtualRun<V extends ViewLike>(path: string, onView: (v: V) => void) {
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const call = (body: Record<string, unknown>) => post<V>(path, body);
  const run = async (noun: string) => {
    setError(undefined);
    try {
      setProgress("Choosing four different participants…");
      let v = await call({ action: "start" });
      onView(v);
      const people = (path.endsWith("interviews") ? v.project.virtualInterviews?.participants : v.project.virtualTests?.participants) ?? [];
      for (let i = 0; i < people.length; i++) {
        setProgress(`${noun} ${people[i].name.split(",")[0]} (${i + 1} of ${people.length})…`);
        v = await call({ action: "participant", index: i });
        onView(v);
      }
      setProgress("Summarizing what they said…");
      onView(await call({ action: "synthesize" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(undefined);
    }
  };
  const clear = async () => {
    setError(undefined);
    try {
      onView(await call({ action: "clear" }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return { progress, error, run, clear };
}

function RunBar({ label, again, progress, agent, disabled, onRun, onClear, note }: { label: string; again: boolean; progress?: string; agent: ReactNode; disabled?: string; onRun: () => void; onClear?: () => void; note: string }) {
  return (
    <>
      <p className="disc-virtual__note" role="note">
        <EvidenceTag label="ai_perspective" /> {note}
      </p>
      <div className="disc-generate">
        {agent}
        <button type="button" className="btn btn--primary disc-ai-btn" disabled={!!progress || !!disabled} onClick={onRun}>
          <Sparkles size={15} aria-hidden="true" />
          {progress ? "Working…" : again ? `${label} again` : label}
        </button>
        {again && onClear && !progress ? (
          <button type="button" className="btn btn--sm btn--ghost" onClick={onClear}>
            Clear
          </button>
        ) : null}
        {progress ? (
          <span className="disc-wait" role="status">
            {progress} On a local model each participant takes a few seconds.
          </span>
        ) : disabled ? (
          <span className="disc-wait">{disabled}</span>
        ) : null}
      </div>
    </>
  );
}

const changed = (then: string[], now: string[]) => then.join("\n") !== now.join("\n");

export function VirtualInterviewsPanel<V extends ViewLike>({ view, onView, agent, questions }: { view: V; onView: (v: V) => void; agent: ReactNode; questions: string[] }) {
  const p = view.project;
  const vi = p.virtualInterviews;
  const { progress, error, run, clear } = useVirtualRun<V>(`/discovery/${p.id}/virtual-interviews`, onView);
  const s = vi?.synthesis;
  return (
    <section className="disc-virtual" aria-labelledby="vi-title">
      <h3 id="vi-title" className="disc-virtual__title">
        Virtual interviews
      </h3>
      <p className="disc-virtual__lede">Practise your interview plan before talking to real people. FlowCode role-plays four different participants, asks them your screening and interview questions, and summarizes what came up.</p>
      <RunBar label="Conduct virtual interviews" again={!!vi} progress={progress} agent={agent} disabled={questions.length ? undefined : "Plan the conversations first."} onRun={() => void run("Interviewing")} onClear={() => void clear()} note={VIRTUAL_INTERVIEW_NOTE} />
      {error ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
      {vi && changed(vi.questions, questions) && !progress ? <p className="disc-virtual__stale">Your questions changed after these interviews. Run them again to hear answers to the new questions.</p> : null}
      {s ? (
        <div className="disc-virtual__summary">
          <h4>What came up {vi ? <span className="disc-virtual__when">{ago(s.at)}</span> : null}</h4>
          {s.themes.length ? (
            <ul className="disc-virtual__themes">
              {s.themes.map((t) => (
                <li key={t.theme}>
                  <strong>{t.theme}</strong>
                  <span className="disc-virtual__count">
                    {t.mentions} of {vi!.participants.filter((x) => x.done).length}
                  </span>
                  <span>{t.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <SummaryList title="Where they disagreed" items={s.disagreements} />
          <SummaryList title="Check with real people" items={s.toVerify} />
          <SummaryList title="Questions to reword" items={s.questionFixes} />
        </div>
      ) : null}
      {vi?.participants.some((x) => x.done) ? (
        <div className="disc-virtual__people">
          <h4>Transcripts</h4>
          {vi.participants
            .filter((x) => x.done)
            .map((x) => (
              <details key={x.id} className="disc-virtual__person">
                <summary>
                  <span className="disc-virtual__name">{x.name}</span>
                  <span className="disc-virtual__angle">{x.angle}</span>
                </summary>
                <p className="disc-virtual__profile">{x.profile}</p>
                <dl className="disc-virtual__qa">
                  {[...x.screening, ...x.answers].map((a, i) => (
                    <div key={i}>
                      <dt>{a.question}</dt>
                      <dd>{a.answer}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
        </div>
      ) : null}
    </section>
  );
}

export function VirtualTestsPanel<V extends ViewLike>({ view, onView, agent, tasks }: { view: V; onView: (v: V) => void; agent: ReactNode; tasks: string[] }) {
  const p = view.project;
  const vt = p.virtualTests;
  const { progress, error, run, clear } = useVirtualRun<V>(`/discovery/${p.id}/virtual-tests`, onView);
  const s = vt?.synthesis;
  const n = vt?.participants.filter((x) => x.done).length ?? 0;
  return (
    <section className="disc-virtual" aria-labelledby="vt-title">
      <h3 id="vt-title" className="disc-virtual__title">
        Virtual user testing
      </h3>
      <p className="disc-virtual__lede">
        Try your test tasks with four virtual participants before building anything. Each one walks through every task, says where they hesitated, and rates how sure they felt.{p.virtualInterviews?.participants.length ? " FlowCode uses the same people from your virtual interviews." : ""}
      </p>
      <RunBar label="Run virtual user testing" again={!!vt} progress={progress} agent={agent} disabled={tasks.length ? undefined : "Plan the tests first."} onRun={() => void run("Testing with")} onClear={() => void clear()} note={VIRTUAL_TEST_NOTE} />
      {error ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
      {vt && changed(vt.tasks, tasks) && !progress ? <p className="disc-virtual__stale">Your test tasks changed after this session. Run it again to test the new tasks.</p> : null}
      {s ? (
        <div className="disc-virtual__summary">
          <h4>How each task went {vt ? <span className="disc-virtual__when">{ago(s.at)}</span> : null}</h4>
          <div className="disc-table-wrap" tabIndex={0} role="region" aria-label="Virtual test results by task">
            <table className="disc-table">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Struggled</th>
                  <th scope="col">Gave up</th>
                  <th scope="col">Main issue</th>
                </tr>
              </thead>
              <tbody>
                {s.tasks.map((t) => (
                  <tr key={t.task}>
                    <td>{t.task}</td>
                    <td className="disc-virtual__num">{t.completed} of {n}</td>
                    <td className="disc-virtual__num">{t.struggled}</td>
                    <td className="disc-virtual__num">{t.gaveUp}</td>
                    <td>{t.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SummaryList title="Usability and clarity issues" items={s.issues} />
          <SummaryList title="Signs of value (or not)" items={s.valueSignals} />
          <SummaryList title="Check with real people" items={s.toVerify} />
        </div>
      ) : null}
      {vt?.participants.some((x) => x.done) ? (
        <div className="disc-virtual__people">
          <h4>Session notes</h4>
          {vt.participants
            .filter((x) => x.done)
            .map((x) => (
              <details key={x.id} className="disc-virtual__person">
                <summary>
                  <span className="disc-virtual__name">{x.name}</span>
                  <span className="disc-virtual__angle">{x.angle}</span>
                  <span className="disc-virtual__score">
                    {x.results.filter((r) => r.outcome === "Completed").length} of {x.results.length} tasks completed
                  </span>
                </summary>
                <p className="disc-virtual__profile">{x.profile}</p>
                <ol className="disc-virtual__tasks">
                  {x.results.map((r, i) => (
                    <li key={i}>
                      <p className="disc-virtual__task">
                        <strong>{r.task}</strong> <span className={`disc-virtual__outcome disc-virtual__outcome--${r.outcome.replace(/\s+/g, "-").toLowerCase()}`}>{r.outcome}</span> <span className="disc-virtual__conf">Confidence {r.confidence} of 5</span>
                      </p>
                      <p>{r.whatTheyDid}</p>
                      {r.hesitation && !/^nothing\.?$/i.test(r.hesitation) ? <p className="disc-virtual__hesitation">Hesitated: {r.hesitation}</p> : null}
                      {r.quote ? <blockquote>“{r.quote}”</blockquote> : null}
                    </li>
                  ))}
                </ol>
              </details>
            ))}
        </div>
      ) : null}
    </section>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="disc-virtual__list">
      <h5>{title}</h5>
      <ul>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
