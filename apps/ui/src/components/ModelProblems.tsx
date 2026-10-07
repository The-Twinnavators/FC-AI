/**
 * System Health → Model problems: failures that keep happening in FlowCode's runs but come from the AI models or this
 * computer (time-outs, Ollama dropping connections, malformed tool calls…), so a skill can't fix them. Each says, in
 * plain words, what it means and what you can do, with the raw errors behind "Technical details".
 */
import { useState } from "react";
import { post, useResource } from "../api";
import { navigate } from "../router";
import { ago } from "./ui";
import { SkeletonBlock } from "./motion";
import { RobotHead, ROLE_COLOR, ROLE_LABEL } from "./RobotHead";

/** The agents a problem hit, read from its errors ("planner model error (…)"), most affected first. */
const agentsOf = (p: Pattern): string[] => {
  const n = new Map<string, number>();
  for (const x of p.examples) {
    const role = /^([a-z_]+) model error/.exec(x)?.[1];
    if (role) n.set(role, (n.get(role) ?? 0) + 1);
  }
  return [...n].sort((a, b) => b[1] - a[1]).map(([r]) => r);
};

interface Pattern {
  id: string;
  title: string;
  count: number;
  runs: string[];
  examples: string[];
  lastSeen: string;
}

interface Explained {
  title: string;
  means: string;
  todo: string;
  action?: { label: string; to: string };
}

/** What each kind of model failure means for you. Keyed by the failure kind in the pattern's title. */
const KINDS: Array<[RegExp, Explained]> = [
  [/timeout/i, { title: "A model took too long to answer", means: "The local model didn't finish in time, so the step was retried or stopped. It happens most with large models (like qwen3-coder:30b) on long steps, or when the computer is busy.", todo: "Give models more time, or use a smaller or faster model for that role.", action: { label: "Speed & recovery settings", to: "/settings/speed" } }],
  [/connection reset/i, { title: "Ollama dropped the connection", means: "Ollama closed the connection in the middle of an answer. That usually means it ran out of memory or restarted, often when two large models run at once.", todo: "Close other heavy apps, or avoid giving two roles different large models at the same time.", action: { label: "AI models on this computer", to: "/system/models" } }],
  [/tool call invalid/i, { title: "A model wrote a broken tool call", means: "The model tried to use a tool but sent something malformed (bad XML or JSON, or a tool result in the wrong place). FlowCode rejects it and asks again, which costs time.", todo: "Mostly the model's ability. A model that's better at tool calls, tested in the capability lab, helps most.", action: { label: "Models & capability lab", to: "/system/models" } }],
  [/invalid response/i, { title: "A model's answer couldn't be used", means: "The answer came back in a form FlowCode couldn't read, or Ollama's model process wasn't reachable. Older entries here also include hosted models that refused a temperature setting; FlowCode now retries those without it.", todo: "If this keeps growing, restart Ollama and check the model still loads.", action: { label: "AI models on this computer", to: "/system/models" } }],
  [/quota|credit|billing/i, { title: "A hosted model ran out of credit", means: "A cloud model you set up refused calls because the account's quota or credit ran out.", todo: "Top up that provider's account, or switch the role back to a local model.", action: { label: "AI engine", to: "/system/engine" } }],
  [/out of memory|oom/i, { title: "The computer ran out of memory for a model", means: "A model couldn't load or crashed because there wasn't enough memory (RAM or graphics memory).", todo: "Use a smaller model for that role, or close other heavy apps while building.", action: { label: "AI models on this computer", to: "/system/models" } }],
];

const explain = (p: Pattern): Explained => KINDS.find(([re]) => re.test(p.title))?.[1] ?? { title: p.title.replace(/^Model calls fail:\s*/i, "Model calls fail: "), means: "A model call keeps failing the same way.", todo: "Copy the technical details into a report if it keeps growing." };

interface Fix {
  id: string;
  name: string;
  status: string;
  benefit: string;
  change: string;
  relatedRuns: string[];
  history: Array<{ at: string; status: string; note: string }>;
}
/** Where a fix to FlowCode stands, in plain words. */
const FIX_STATUS: Record<string, [string, string]> = {
  awaiting_approval: ["Proposed", "warn"],
  approved: ["Approved, not built yet", "warn"],
  in_progress: ["Being built", "work"],
  testing: ["Built, checking on your next builds", "work"],
  verified: ["Fixed", "ok"],
  deferred: ["Later", "muted"],
  rejected: ["Not doing", "muted"],
  rolled_back: ["Undone", "muted"],
};

/** Changes to FlowCode itself that its run reviews found, and where each stands. */
function FlowCodeFixes() {
  const { data } = useResource<Fix[]>("/improvements", [], 30_000);
  const list = (data ?? []).filter((f) => f.status !== "rejected");
  if (!list.length) return null;
  return (
    <section className="mprob__fixes" aria-labelledby="mprob-fixes-title">
      <h3 className="mprob__fixes-title" id="mprob-fixes-title">
        Fixes to FlowCode
      </h3>
      <p className="muted stuck__lede">Changes to FlowCode itself that its run reviews found, so these problems happen less. FlowCode can&apos;t change its own code; these are built into FlowCode by its developers.</p>
      <ul className="mprob__list">
        {list.map((f) => {
          const [label, tone] = FIX_STATUS[f.status] ?? [f.status.replace(/_/g, " "), "muted"];
          const last = f.history.at(-1);
          return (
            <li key={f.id} className="mprob__item">
              <div className="mprob__top">
                <span className={`mprob__fix-status mprob__fix-status--${tone}`}>{label}</span>
                <h3 className="mprob__title">{f.name}</h3>
                <span className="muted mprob__count">
                  Seen in {f.relatedRuns.length} build{f.relatedRuns.length === 1 ? "" : "s"}
                  {last ? ` · updated ${ago(last.at)}` : ""}
                </span>
              </div>
              <p className="mprob__means">{f.benefit}</p>
              {last?.note ? <p className="mprob__todo">{last.note}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface Suggestion {
  patternId: string;
  at: string;
  model: string;
  diagnosis: string;
  suggestion: string;
  fixableInFlowCode: boolean;
  action?: { label: string };
  status: "new" | "applied" | "dismissed";
}
interface Solver {
  lastRunAt?: string;
  nextAt?: string;
  running: boolean;
  suggestions: Suggestion[];
}

/** The Researcher's look into one problem: what's likely wrong and one thing to do, with Apply when FlowCode can do it. */
function SolverNote({ s, onChange }: { s: Suggestion; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const act = async (what: "apply" | "dismiss") => {
    setBusy(true);
    setError(undefined);
    try {
      await post(`/model-problems/solver/${encodeURIComponent(s.patternId)}/${what}`, {});
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`mprob__solver${s.status !== "new" ? " is-done" : ""}`}>
      <div className="mprob__solver-head">
        <RobotHead color={ROLE_COLOR.researcher!} id={`solver-${s.patternId}`} size={22} />
        <strong>Researcher</strong>
        <span className="muted">
          looked into this {ago(s.at)} · {s.model}
        </span>
      </div>
      <p>
        <strong>Likely cause:</strong> {s.diagnosis}
      </p>
      <p>
        <strong>Suggestion:</strong> {s.suggestion}
      </p>
      {s.status === "applied" ? (
        <p className="mprob__solver-done">Applied{s.action ? `: ${s.action.label}` : ""}. You can change it back in Models &amp; capability lab.</p>
      ) : s.status === "dismissed" ? (
        <p className="mprob__solver-done">Dismissed.</p>
      ) : (
        <div className="mprob__solver-actions">
          {s.action ? (
            <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => void act("apply")}>
              Apply: {s.action.label}
            </button>
          ) : (
            <span className="muted mprob__solver-manual">
              No one-click change for this. If it means changing a model, you can do it in <a href="#/system/models">Models &amp; capability lab</a>.
            </span>
          )}
          <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void act("dismiss")}>
            Dismiss
          </button>
        </div>
      )}
      {error ? <p className="notice notice--bad">{error}</p> : null}
    </div>
  );
}

export function ModelProblems() {
  const { data, error } = useResource<{ codeFix: Pattern[] }>("/skill-proposals", [], 15_000);
  const solver = useResource<Solver>("/model-problems/solver", [], 10_000);
  const [lookMsg, setLookMsg] = useState<string>();
  const lookNow = async () => {
    const r = await post<{ started: boolean; reason?: string }>("/model-problems/solver/run", {});
    setLookMsg(r.started ? "The Researcher is looking into the most frequent problem. Its suggestion appears on that card in a minute or two." : r.reason);
    solver.reload();
  };
  const sugFor = (id: string) => solver.data?.suggestions.find((s) => s.patternId === id);
  if (!data) return error ? <p className="notice notice--bad">{error}</p> : <SkeletonBlock rows={3} label="Reading FlowCode's run history" />;
  const list = [...data.codeFix].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  return (
    <section className="mprob" aria-labelledby="mprob-title">
      <header className="mprob__head">
        <h2 className="stuck__title" id="mprob-title">
          Model problems
        </h2>
        <p className="muted stuck__lede">
          Failures that keep happening in your builds but come from the AI models or this computer, not from what the agents are told, so FlowCode can&apos;t fix them with a skill. Each says what it means and what you can do. Counts cover the last two weeks.
        </p>
        <div className="mprob__daily">
          <RobotHead color={ROLE_COLOR.researcher!} id="solver-daily" size={30} />
          <p>
            <strong>One problem a day.</strong> Once a day, when no build is running, the Researcher looks into one of these (most frequent first) and suggests a fix on its card. Nothing changes until you click Apply.
            {solver.data?.running ? " Looking into one now…" : solver.data?.lastRunAt ? ` Last looked ${ago(solver.data.lastRunAt)}.` : ""}
          </p>
          <button type="button" className="btn btn--sm" disabled={solver.data?.running} onClick={() => void lookNow()}>
            Look into one now
          </button>
        </div>
        {lookMsg ? <p className="notice" role="status">{lookMsg}</p> : null}
      </header>
      {!list.length ? (
        <p className="apv-empty">No repeated model problems in the last two weeks.</p>
      ) : (
        <ul className="mprob__list">
          {list.map((p) => {
            const e = explain(p);
            return (
              <li key={p.id} className="mprob__item">
                <div className="mprob__top">
                  <h3 className="mprob__title">{e.title}</h3>
                  <span className="muted mprob__count">
                    {p.count} times in {p.runs.length} build{p.runs.length === 1 ? "" : "s"} · last {ago(p.lastSeen)}
                  </span>
                </div>
                {agentsOf(p).length ? (
                  <div className="mprob__agents" aria-label="Agents affected">
                    {agentsOf(p).map((r) => (
                      <span key={r} className="mprob__agent" title={`The ${ROLE_LABEL[r] ?? r} agent hit this`}>
                        <RobotHead color={ROLE_COLOR[r] ?? "#9a9fd6"} id={`mp-${p.id}-${r}`} size={22} />
                        <span>{ROLE_LABEL[r] ?? r}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mprob__means">{e.means}</p>
                <p className="mprob__todo">
                  <strong>What you can do:</strong> {e.todo}
                </p>
                {sugFor(p.id) ? <SolverNote s={sugFor(p.id)!} onChange={solver.reload} /> : null}
                <div className="mprob__foot">
                  {e.action ? (
                    <button type="button" className="btn btn--sm" onClick={() => navigate(e.action!.to)}>
                      {e.action.label}
                    </button>
                  ) : null}
                  <details className="mprob__raw">
                    <summary>Technical details</summary>
                    <ul>
                      {p.examples.map((x) => (
                        <li key={x} className="mono">
                          {x}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <FlowCodeFixes />
    </section>
  );
}
