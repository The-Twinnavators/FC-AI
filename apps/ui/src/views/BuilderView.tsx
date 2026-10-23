/**
 * The builder (V2.1): one conversation beside the working app. The person describes the product, FlowCode clarifies
 * only what matters (quick choices, each skippable), says what it will build, and plans and builds; later messages
 * are changes. Each build or change has one live status card in the chat, derived from the run's own state and events
 * (never invented progress). The workspace with files, activity and terminal is optional: Details.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Eye, EyeOff, PanelsTopLeft } from "lucide-react";
import type { Approval, FlowEvent, Run, Task, VerificationCheck } from "@flowcode/contracts";
import { post, useEventStream, useResource } from "../api";
import { navigate } from "../router";
import { RobotHead, ROLE_COLOR } from "../components/RobotHead";
import { ApprovalCard } from "../components/ApprovalCard";
import { PreviewPanel } from "./WorkspaceView";

interface ConvQuestion {
  id: string;
  question: string;
  why: string;
  options: string[];
  answer?: string;
  skipped?: boolean;
}
interface ConvMessage {
  id: string;
  at: string;
  role: "user" | "assistant";
  kind: "text" | "interpretation" | "questions" | "build";
  text?: string;
  questions?: ConvQuestion[];
  runId?: string;
  state?: "started" | "queued";
}
interface Conversation {
  projectId: string;
  stage: "clarifying" | "building";
  messages: ConvMessage[];
  queue: Array<{ id: string; text: string; at: string }>;
}
interface RunView {
  run: Run;
  active: boolean;
  paused?: boolean;
  /** Why the build stopped, when it did, and whether it needs the person. */
  interruption?: { cause: string; detail?: string; needsUser: boolean; taskId?: string; state: string };
  tasks: Task[];
  checks: VerificationCheck[];
  approvals: Approval[];
  artifacts: Array<{ id: string; kind: string; label: string; mime: string; createdAt: string; meta?: Record<string, unknown> }>;
}

const TERMINAL = new Set(["done", "done_with_warnings", "done_unverified", "failed", "cancelled"]);

export function BuilderView({ projectId }: { projectId: string }) {
  const conv = useResource<Conversation>(`/projects/${projectId}/conversation`, [projectId]);
  const project = useResource<{ project: { id: string; name: string } }>(`/projects/${projectId}`, [projectId]);
  const [c, setC] = useState<Conversation>();
  const data = c ?? conv.data;
  const [error, setError] = useState<string>();
  const [thinking, setThinking] = useState(false);
  // The preview opens beside the chat once there's an app to show (on a wide screen; on a phone, from Preview).
  const [showPreview, setShowPreview] = useState<boolean>();
  const wide = typeof matchMedia === "function" && matchMedia("(min-width: 861px)").matches;
  const previewOpen = showPreview ?? (wide && conv.data?.stage === "building");
  const asked = useRef(false);

  // The first reply: what FlowCode will build, and any questions. Asked once, when the conversation has none yet.
  useEffect(() => {
    if (!data || asked.current || data.stage !== "clarifying" || data.messages.some((m) => m.kind === "interpretation")) return;
    asked.current = true;
    setThinking(true);
    post<Conversation>(`/projects/${projectId}/conversation/clarify`)
      .then(setC)
      .catch((e) => setError((e as Error).message))
      .finally(() => setThinking(false));
  }, [data, projectId]);

  // Clarified: every question answered or left to FlowCode (or none asked), so the build starts. No separate approval.
  const questions = data?.messages.flatMap((m) => m.questions ?? []) ?? [];
  const settled = !!data && data.stage === "clarifying" && data.messages.some((m) => m.kind === "interpretation") && questions.every((q) => q.answer || q.skipped);
  const starting = useRef(false);
  const build = async () => {
    if (starting.current) return;
    starting.current = true;
    setError(undefined);
    try {
      setC(await post<Conversation>(`/projects/${projectId}/conversation/build`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      starting.current = false;
    }
  };
  useEffect(() => {
    if (settled) void build();
  }, [settled]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (q: ConvQuestion, value: string | null) => {
    setError(undefined);
    try {
      setC(await post<Conversation>(`/projects/${projectId}/conversation/answer`, { questionId: q.id, answer: value }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const send = async (text: string) => {
    setError(undefined);
    try {
      setC(await post<Conversation>(`/projects/${projectId}/conversation/message`, { text }));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  // A queued change starts on the daemon when the running one ends: read the conversation again then.
  const latestRun = [...(data?.messages ?? [])].reverse().find((m) => m.kind === "build")?.runId;
  const onRunEnded = () => {
    setC(undefined);
    conv.reload();
  };

  // Once there's an app, its preview starts by itself beside the chat (no Start button to find).
  const [previewKey, setPreviewKey] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!previewOpen || data?.stage !== "building" || started.current) return;
    started.current = true;
    post(`/projects/${projectId}/preview/start`)
      .then(() => setPreviewKey((n) => n + 1))
      .catch(() => undefined);
  }, [previewOpen, data?.stage, projectId]);

  const listRef = useRef<HTMLDivElement>(null);
  const count = data?.messages.length ?? 0;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [count, thinking]);

  if (conv.error) return <div className="page"><p className="psetup__err" role="alert">{conv.error}</p></div>;
  if (!data) return <div className="page"><p className="dim">Loading…</p></div>;
  return (
    <div className={`bld${previewOpen ? " bld--preview" : ""}`}>
      <header className="bld__bar">
        <h1 className="bld__name">{project.data?.project.name ?? ""}</h1>
        <div className="bld__tools">
          <button type="button" className="btn btn--sm" aria-pressed={previewOpen} onClick={() => setShowPreview(!previewOpen)}>
            {previewOpen ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />} Preview
          </button>
          <button type="button" className="btn btn--sm btn--ghost" title="Files, activity and the terminal" onClick={() => navigate(`/projects/${projectId}`)}>
            <PanelsTopLeft size={14} aria-hidden="true" /> Details
          </button>
        </div>
      </header>
      <section className="bld__chat" aria-label="Conversation">
        <div className="bld__list" ref={listRef}>
          {data.messages.map((m) => (
            <Message key={m.id} m={m} stage={data.stage} latest={m.runId === latestRun} onAnswer={answer} onRunEnded={onRunEnded} onPreview={() => setShowPreview(true)} />
          ))}
          {thinking ? (
            <div className="bld-msg bld-msg--agent" role="status">
              <RobotHead color={ROLE_COLOR.planner ?? "#c084fc"} id="bld-thinking" size={24} />
              <p className="bld-msg__text dim">Reading your description…</p>
            </div>
          ) : null}
          {data.stage === "clarifying" && questions.some((q) => !q.answer && !q.skipped) ? (
            <div className="bld__go">
              <button type="button" className="btn btn--sm" onClick={() => void build()}>
                Build now
              </button>
              <span className="dim">FlowCode chooses the rest and says so.</span>
            </div>
          ) : null}
          {error ? (
            <p className="psetup__err" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Composer stage={data.stage} busy={!!data.queue.length} onSend={send} />
      </section>
      {previewOpen ? (
        <section className="bld__preview" aria-label="Preview">
          <PreviewPanel key={`${latestRun ?? "none"}-${previewKey}`} projectId={projectId} artifacts={[]} />
        </section>
      ) : null}
    </div>
  );
}

function Message({ m, stage, latest, onAnswer, onRunEnded, onPreview }: { m: ConvMessage; stage: Conversation["stage"]; latest: boolean; onAnswer: (q: ConvQuestion, v: string | null) => void; onRunEnded: () => void; onPreview: () => void }) {
  if (m.role === "user") return <YouSaid text={m.text ?? ""} />;
  if (m.kind === "build" && m.runId) return <BuildCard runId={m.runId} change={m.text} latest={latest} onEnded={onRunEnded} onPreview={onPreview} />;
  return (
    <div className="bld-msg bld-msg--agent">
      <RobotHead color={ROLE_COLOR.planner ?? "#c084fc"} id={`bld-${m.id}`} size={24} />
      <div className="bld-msg__body">
        <span className="bld-msg__who">Planner</span>
        {m.text ? <p className={`bld-msg__text${m.state === "queued" ? " dim" : ""}`}>{m.text}</p> : null}
        {m.questions?.map((q) => <Question key={q.id} q={q} open={stage === "clarifying"} onAnswer={onAnswer} />)}
      </div>
    </div>
  );
}

/** Your message; a long one (a pasted PRD) is shown short, with Show all. */
function YouSaid({ text }: { text: string }) {
  const long = text.length > 420 || text.split("\n").length > 8;
  const [all, setAll] = useState(false);
  return (
    <div className="bld-msg bld-msg--you">
      <div className={`bld-msg__text${long && !all ? " is-clamped" : ""}`}>
        {text}
        {long ? (
          <button type="button" className="link-btn bld-msg__more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? "Show less" : "Show all"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** One quick-choice question: its answers as chips, your own words, or "Choose for me". */
function Question({ q, open, onAnswer }: { q: ConvQuestion; open: boolean; onAnswer: (q: ConvQuestion, v: string | null) => void }) {
  const [own, setOwn] = useState("");
  const [typing, setTyping] = useState(false);
  const done = !!q.answer || !!q.skipped;
  return (
    <fieldset className="bld-q" disabled={!open}>
      <legend className="bld-q__text">{q.question}</legend>
      {q.why ? <p className="bld-q__why dim">{q.why}</p> : null}
      <div className="bld-q__chips">
        {q.options.map((o) => (
          <button key={o} type="button" className="bld-chip" aria-pressed={q.answer === o} onClick={() => onAnswer(q, o)}>
            {o}
          </button>
        ))}
        <button type="button" className="bld-chip bld-chip--quiet" aria-pressed={!!q.skipped} onClick={() => onAnswer(q, null)}>
          Choose for me
        </button>
        {!typing && !(q.answer && !q.options.includes(q.answer)) ? (
          <button type="button" className="bld-chip bld-chip--quiet" onClick={() => setTyping(true)}>
            Other…
          </button>
        ) : null}
      </div>
      {typing || (q.answer && !q.options.includes(q.answer)) ? (
        <form
          className="bld-q__own"
          onSubmit={(e) => {
            e.preventDefault();
            if (own.trim()) onAnswer(q, own.trim());
          }}
        >
          <label className="sr-only" htmlFor={`own-${q.id}`}>
            Your answer
          </label>
          <input id={`own-${q.id}`} className="input" value={own || (q.answer && !q.options.includes(q.answer) ? q.answer : "")} onChange={(e) => setOwn(e.target.value)} placeholder="Your answer" autoFocus={typing && !done} />
          <button type="submit" className="btn btn--sm" disabled={!own.trim()}>
            Answer
          </button>
        </form>
      ) : null}
    </fieldset>
  );
}

type Phase = "understanding" | "building" | "checking" | "recovering" | "input" | "complete" | "failed" | "stopped" | "stalled";

/** What the status card says, from the run's state, its steps and its last events. */
function phaseOf(v: RunView | undefined, lastEventAt: number, now: number): { phase: Phase; line: string } {
  if (!v) return { phase: "understanding", line: "Reviewing your description and the project." };
  const s = v.run.status;
  const current = v.tasks.find((t) => t.status === "running" || t.status === "attempted");
  const step = current ? plain(current.title) : "";
  if (s === "done" || s === "done_with_warnings" || s === "done_unverified") return { phase: "complete", line: "" };
  if (s === "failed") return { phase: "failed", line: "This update didn't finish. The last working version is unchanged." };
  if (s === "cancelled") return { phase: "stopped", line: "Stopped. The last working version is unchanged." };
  if (v.approvals.some((a) => a.status === "pending")) return { phase: "input", line: "This needs your OK before it continues." };
  if (s === "blocked" || s === "awaiting_approval") {
    const stuck = v.tasks.find((t) => t.id === v.interruption?.taskId) ?? v.tasks.find((t) => t.status === "blocked");
    return { phase: "input", line: stuck ? `Stuck on ${plain(stuck.title).toLowerCase()}: ${why(v.interruption)} Try again, or tell me how in the chat.` : "This is waiting for you." };
  }
  if (!v.active && !v.paused && (s === "running" || s === "verifying" || s === "recovering")) return { phase: "stalled", line: "Not running right now. The last working version is still available." };
  if (s === "recovering") return { phase: "recovering", line: `Fixing a problem${step ? ` in ${step.toLowerCase()}` : ""}. Your previous working preview is still available.` };
  if (s === "verifying") return { phase: "checking", line: "Checking the app: its screens, interactions and layout." };
  if (!v.run.plan || !v.run.planApproved) return { phase: "understanding", line: "Planning the screens and the central journey." };
  const quiet = lastEventAt && now - lastEventAt > 120_000;
  if (quiet) return { phase: "building", line: `Still working${step ? ` on ${step.toLowerCase()}` : ""}. No new update for ${Math.round((now - lastEventAt) / 60_000)} min.` };
  return { phase: "building", line: step ? `${step}.` : "Building." };
}
/** Why a step stopped, in plain words (the full record is in Details). */
function why(i: RunView["interruption"]): string {
  const d = i?.detail ?? "";
  if (/no_action|prose only/.test(d)) return "the coder answered without making a change.";
  if (/attempts/.test(i?.cause ?? "")) return "it failed the same way twice.";
  if (/model|provider|ollama|unreachable|timed out/i.test(d)) return "the AI model didn't respond.";
  return "it needs a decision.";
}
/** A step's title in plain words: "Implement proper app navigation" → "Proper app navigation". */
const plain = (t: string) => t.replace(/^(implement|create|build|add|write)\s+/i, () => "").replace(/^./, (x) => x.toUpperCase());

const elapsed = (from: string, to: number) => {
  const s = Math.max(0, Math.round((to - new Date(from).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

/** One build's or change's live status card: what it's doing, what's done, and when it needs you. */
function BuildCard({ runId, change, latest, onEnded, onPreview }: { runId: string; change?: string; latest: boolean; onEnded: () => void; onPreview: () => void }) {
  const [tick, setTick] = useState(0);
  const view = useResource<RunView>(`/runs/${runId}`, [runId, tick]);
  const v = view.data;
  const live = !!v && !TERMINAL.has(v.run.status);
  const events = useEventStream(latest && live ? `/runs/${runId}/events` : null, () => setTick((n) => n + 1), 200);
  const lastEventAt = events.length ? new Date(events[events.length - 1]!.createdAt).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => (setNow(Date.now()), setTick((n) => n + 1)), 4000);
    return () => clearInterval(t);
  }, [live]);
  const ended = useRef(false);
  useEffect(() => {
    if (v && TERMINAL.has(v.run.status) && latest && !ended.current) {
      ended.current = true;
      onEnded();
    }
  }, [v, latest, onEnded]);
  const { phase, line } = phaseOf(v, lastEventAt, now);
  const done = (v?.tasks ?? []).filter((t) => t.status === "verified");
  const firstLook = events.some((e: FlowEvent) => (e.data as { firstLook?: boolean } | undefined)?.firstLook);
  const title = change ? `Updating: ${change.length > 60 ? `${change.slice(0, 60)}…` : change}` : "Building your app";
  const working = live && phase !== "input" && phase !== "stalled";
  const stop = async () => {
    await post(`/runs/${runId}/cancel`).catch(() => undefined);
    setTick((n) => n + 1);
  };
  const retry = async () => {
    const task = v?.tasks.find((t) => t.id === v.interruption?.taskId) ?? v?.tasks.find((t) => t.status === "blocked");
    if (task) await post(`/runs/${runId}/tasks/${task.id}/retry`, {}).catch(() => undefined);
    setTick((n) => n + 1);
  };
  const resume = async () => {
    await post(`/runs/${runId}/resume`).catch(() => undefined);
    setTick((n) => n + 1);
  };
  const checks = (v?.checks ?? []).filter((x) => x.status === "passed");
  const warnings = v?.run.status === "done_with_warnings" || v?.run.status === "done_unverified";
  return (
    <article className={`bld-card bld-card--${phase}`} aria-live="polite">
      <header className="bld-card__head">
        <span className={`bld-card__mark${working ? " is-working" : ""}`} aria-hidden="true">
          {phase === "complete" ? "✓" : phase === "failed" || phase === "stopped" ? "■" : "✦"}
        </span>
        <h2 className="bld-card__title">{phase === "complete" ? (change ? "Update complete" : "Your app is ready") : title}</h2>
        {v ? (
          <span className="bld-card__time dim">
            {LABEL[phase]}
            {working ? ` · ${elapsed(v.run.createdAt, now)}` : ""}
          </span>
        ) : null}
      </header>
      {line ? <p className="bld-card__line">{line}</p> : null}
      {done.length ? (
        <ul className="bld-card__steps">
          {done.map((t) => (
            <li key={t.id}>
              <span aria-hidden="true">✓</span> {plain(t.title)}
            </li>
          ))}
          {working && phase === "building" && line ? (
            <li className="is-now">
              <span aria-hidden="true">◌</span> {line.replace(/\.$/, "")}
            </li>
          ) : null}
        </ul>
      ) : null}
      {phase === "complete" ? (
        <p className="bld-card__note dim">
          {checks.length ? `Checked: ${checks.length} check${checks.length === 1 ? "" : "s"} passed.` : "No automatic checks ran for this update."}
          {warnings ? " Some checks couldn't run or found problems; see Details." : ""} Sample data is demo data.
        </p>
      ) : null}
      {firstLook && live ? <p className="bld-card__note">The main screens are ready to try. Features are still being added.</p> : null}
      {working ? <p className="bld-card__note dim">You can keep chatting while I work.</p> : null}
      {phase === "input" ? (
        <div className="bld-card__approvals">
          {(v?.approvals ?? [])
            .filter((a) => a.status === "pending")
            .map((a) => (
              <ApprovalCard key={a.id} approval={a} onDecided={() => setTick((n) => n + 1)} />
            ))}
        </div>
      ) : null}
      <footer className="bld-card__actions">
        {phase === "complete" || firstLook ? (
          <button type="button" className="btn btn--sm btn--primary" onClick={onPreview}>
            Open preview
          </button>
        ) : null}
        {phase === "input" && v?.run.status === "blocked" ? (
          <button type="button" className="btn btn--sm btn--primary" onClick={() => void retry()}>
            Try again
          </button>
        ) : null}
        {phase === "stalled" ? (
          <button type="button" className="btn btn--sm btn--primary" onClick={() => void resume()}>
            Continue
          </button>
        ) : null}
        {live ? (
          <button type="button" className="btn btn--sm" onClick={() => void stop()}>
            Stop
          </button>
        ) : null}
      </footer>
    </article>
  );
}
const LABEL: Record<Phase, string> = {
  understanding: "Planning",
  building: "Working",
  checking: "Checking",
  recovering: "Recovering",
  input: "Needs you",
  complete: "Done",
  failed: "Didn't finish",
  stopped: "Stopped",
  stalled: "Paused",
};

/** The chat's box: always usable. Before the build it adds detail; afterwards it asks for a change. */
function Composer({ stage, busy, onSend }: { stage: Conversation["stage"]; busy: boolean; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const placeholder = useMemo(() => (stage === "clarifying" ? "Add detail, or answer in your own words" : busy ? "Ask for another change (it waits its turn)" : "Ask for a change"), [stage, busy]);
  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    if (await onSend(text.trim())) setText("");
    setSending(false);
  };
  return (
    <form
      className="bld-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="sr-only" htmlFor="bld-input">
        Message
      </label>
      <textarea
        id="bld-input"
        className="bld-composer__input"
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <button type="submit" className="btn btn--primary btn--icon bld-composer__send" disabled={!text.trim() || sending} aria-label="Send">
        <ArrowUp size={16} aria-hidden="true" />
      </button>
    </form>
  );
}
