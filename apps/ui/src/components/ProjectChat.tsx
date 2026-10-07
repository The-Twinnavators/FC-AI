/**
 * Chat with the IDE agent. Each message becomes a governed follow-up build on the latest version of the project
 * (planned, approved by the project's autonomy policy, implemented, verified, reversible). Replies are derived from
 * the run's live state, so the thread always shows what actually happened.
 */
import { COMPOSE_EVENT, takePendingCompose } from "./PointAndSay";
import { splitRequest } from "./splitRequest";
import { ChatApprovals } from "./ChatApprovals";
import { looksLikeQuestion } from "@flowcode/contracts";
import { isFinishedRun } from "@flowcode/contracts";
import { useEffect, useRef, useState } from "react";
import type { FlowEvent, Run, Task, VerificationCheck, Approval, Snapshot } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { CopyText, Icon, StatusChip, ago, ErrorNotice } from "./ui";
import { RequestText } from "./RequestText";
import { checkName, friendlyError, statusLabel, stepActivity } from "@flowcode/contracts";
import { playSound } from "./sounds";
import { ChatAuthor, ChatText, JumpToLatest, useStickyScroll } from "./ChatParts";
import { Logo } from "./ui";

interface View {
  run: Run;
  tasks: Task[];
  checks: VerificationCheck[];
  approvals: Approval[];
  snapshots: Snapshot[];
  active: boolean;
}

const SUGGESTIONS = [
  { label: "Change the font", text: "Change the body font to Inter and headings to Manrope SemiBold.", style: true },
  { label: "Change the accent colour", text: "Change the accent colour to a deep purple (#5b3cc4) in light and dark mode, keeping text contrast at WCAG AA.", style: true },
  { label: "More spacing", text: "Give the layout more breathing room: increase spacing between cards and sections by about 50%.", style: true },
  { label: "Larger text", text: "Increase the base text size to 16px and scale headings to match.", style: true },
  { label: "Rounder corners", text: "Use a 10px corner radius on cards and 6px on buttons.", style: true },
];
const STYLE_CONSTRAINT = "Styling only: change CSS, design tokens, fonts and colours. Do not change behaviour, content or file structure.";

type Role = "prd" | "html" | "css" | "json" | "text";
interface Attachment {
  name: string;
  role: Role;
  content: string;
  size: number;
}
const ACCEPT = ".md,.markdown,.css,.json,.html,.htm,.txt";
const MAX_FILE = 2_000_000;
const MAX_TOTAL = 6_000_000;
const roleFor = (name: string): Role | undefined => {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "md" || ext === "markdown" ? "prd" : ext === "css" ? "css" : ext === "json" ? "json" : ext === "html" || ext === "htm" ? "html" : ext === "txt" ? "text" : undefined;
};
const ROLE_LABEL: Record<Role, string> = { prd: "Markdown", html: "HTML", css: "CSS", json: "JSON", text: "Text" };
const kb = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
/** Requests are limited to this many characters (the daemon rejects longer ones). */
const LIMIT = 20_000;
const BUSY = ["draft", "awaiting_approval", "running", "recovering", "verifying"];

/**
 * What FlowCode says about a request, in plain words: what it's doing now, what it needs from you, or (when finished)
 * what changed, what you can do now and what was checked. Technical names stay in Details.
 */
function reply(r: Run, v: View | undefined, events: FlowEvent[]): { text: string; tone: "work" | "ok" | "warn" | "bad" | "idle" } {
  const live = v && v.run.id === r.id ? v : undefined;
  const tasks = (live?.tasks ?? []).filter((t) => t.status !== "skipped");
  const done = tasks.filter((t) => t.status === "verified").length;
  const current = tasks.find((t) => t.status === "running" || t.status === "attempted" || t.status === "awaiting_approval");
  const files = new Set((live?.snapshots ?? []).filter((s) => !s.restoredAt).map((s) => s.relativePath)).size;
  const runChecks = (live?.checks ?? []).filter((c) => !c.taskId);
  const failed = runChecks.filter((c) => c.status === "failed").map((c) => checkName(c.kind));
  const passed = runChecks.filter((c) => c.status === "passed" || c.status === "passed_with_warnings").map((c) => checkName(c.kind));
  const pending = (live?.approvals ?? []).filter((a) => a.status === "pending");
  const built = tasks.filter((t) => t.status === "verified" && !/^(scaffold|install dependencies|import spec references)/i.test(t.title)).map((t) => `- ${stepActivity(t.title).replace(/…$/, "").replace(/^Creating /, "Added ").replace(/^Working on: /, "")}`);
  const summary = (lead: string) =>
    [
      lead,
      built.length ? `What changed:\n${built.slice(0, 6).join("\n")}${built.length > 6 ? `\n- and ${built.length - 6} more` : ""}` : files ? `What changed:\n- ${files} file${files === 1 ? "" : "s"} updated` : "",
      "What you can do now:\n- Open Preview to try it\n- Open Changes to review or undo anything",
      passed.length ? `What I checked:\n- ${passed.slice(0, 6).join(", ")}${passed.length > 6 ? ` and ${passed.length - 6} more` : ""}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  switch (r.status) {
    case "draft":
      return { text: "Reading your request and planning the work…", tone: "work" };
    case "awaiting_approval":
      return pending.length ? { text: `I've planned this and need your OK for ${pending.length === 1 ? "one step" : `${pending.length} steps`} before I continue. Open Approvals to review.`, tone: "warn" } : { text: "The plan is ready. Review it and approve to start building.", tone: "warn" };
    case "running":
    case "recovering":
      return { text: tasks.length ? `${current ? stepActivity(current.title) : "Working on it…"}\n${done} of ${tasks.length} steps done.` : "Getting started…", tone: "work" };
    case "verifying":
      return { text: "Checking that your app starts and works…", tone: "work" };
    case "done":
      return { text: summary("Your changes are ready."), tone: "ok" };
    case "done_unverified":
      return { text: summary("Your changes are ready, but not everything could be checked: a check couldn't run. Open Details to see which."), tone: "warn" };
    case "done_with_warnings":
      return { text: summary(`Your changes are ready, with a few notes${failed.length ? ` (${failed.join(", ")} need a look)` : ""}. Open Details to see them.`), tone: "warn" };
    case "blocked": {
      const why = tasks.find((t) => t.blocker)?.blocker?.reason ?? events.filter((e) => e.type === "task.blocked").at(-1)?.message;
      const e = friendlyError(why, "finish this");
      // Raw reasons are long and technical: lead with a short version, details stay in Troubleshoot.
      const short = (why ?? "").replace(/^Done gate not met:\s*/i, "").split(/;|\n/)[0].replace(/^Task "([^"]+)" is blocked\s*[—-]\s*/i, "$1: ").slice(0, 160);
      const what = e.technical ? (short ? `What stopped it: ${short}${(why ?? "").length > short.length ? "…" : ""}` : e.explain) : e.explain;
      return { text: `I need your help to continue. ${e.title}.\n${what}\nOpen Details and choose Troubleshoot on the step that stopped. It explains the problem and offers fixes.`, tone: "bad" };
    }
    case "failed":
      return { text: "This request stopped before it finished. Nothing was left half-done. Open Details to see what happened.", tone: "bad" };
    case "cancelled":
      return { text: "Cancelled. Nothing else will change.", tone: "idle" };
    default:
      return { text: statusLabel(r.status), tone: "idle" };
  }
}

export function ProjectChat({ projectId, runs, view, events, onSent, onShow, onDetails }: { projectId: string; runs: Run[]; view?: View; events: FlowEvent[]; onSent: (r: Run) => void; onShow: (tab: "preview" | "changes" | "approvals" | "diagnostics") => void; onDetails: (runId: string) => void }) {
  const [text, setText] = useState(() => takePendingCompose() ?? "");
  // A pointed-at change from Preview lands in the message box, for you to read and send.
  useEffect(() => {
    const on = (e: Event) => {
      takePendingCompose();
      setText((e as CustomEvent<string>).detail);
    };
    window.addEventListener(COMPOSE_EVENT, on);
    return () => window.removeEventListener(COMPOSE_EVENT, on);
  }, []);
  /** Questions asked while a change is running, answered by the Copilot from the live run state. */
  const qaKey = `fc.chat.qa.${projectId}`;
  const [qa, setQa] = useState<Array<{ id: string; q: string; a?: string; at: string; runId?: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem(qaKey) ?? "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(qaKey, JSON.stringify(qa.slice(-30)));
    } catch {
      /* storage unavailable */
    }
  }, [qa, qaKey]);
  const [styleOnly, setStyleOnly] = useState(false);
  // D7: this one change on the cloud model. Unticked again after each send: the consent is per change.
  const [useCloud, setUseCloud] = useState(false);
  const cloudCfg = useResource<{ ready: boolean; model: string; providerLabel?: string }>("/models/cloud-coder");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const addFiles = async (list: FileList | File[]) => {
    const next: Attachment[] = [];
    const problems: string[] = [];
    for (const f of Array.from(list)) {
      const role = roleFor(f.name);
      if (!role) {
        problems.push(`${f.name}: only .md, .css, .json, .html and .txt files can be attached`);
        continue;
      }
      if (f.size > MAX_FILE) {
        problems.push(`${f.name} is larger than 2 MB`);
        continue;
      }
      next.push({ name: f.name, role, content: await f.text(), size: f.size });
    }
    setFiles((cur) => {
      const merged = [...cur.filter((c) => !next.some((n) => n.name === c.name)), ...next];
      if (merged.reduce((n, a) => n + a.size, 0) > MAX_TOTAL) {
        problems.push("Attachments are limited to 6 MB in total");
        return cur;
      }
      return merged;
    });
    setError(problems.length ? problems.join(". ") : undefined);
  };
  const thread = [...runs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latest = thread.at(-1);
  // The run view is live; the run list can lag behind (e.g. right after Cancel).
  const latestStatus = view?.run.id === latest?.id ? view?.run.status ?? latest?.status : latest?.status;
  const busy = !!latest && (BUSY.includes(latestStatus ?? "") || (view?.run.id === latest.id && view.active));
  const agentNotes = events.filter((e) => e.type === "agent.message").slice(-3);

  // Follow new messages only while you're at the bottom; scrolled up, a "Jump to latest" button appears instead.
  const stick = useStickyScroll(listRef, [runs.length, latest?.status, view?.tasks.filter((t) => t.status === "verified").length, qa.length, qa.at(-1)?.a]);

  /** Changes waiting their turn (typed while another runs, or the parts of a split request); sent one by one. */
  type Queued = { message: string; styleOnly: boolean; files: typeof files; cloud?: boolean };
  const [queuedList, setQueuedList] = useState<Queued[]>([]);
  /** D5: a request with several numbered or bulleted changes, waiting for "one change or separate changes?". */
  const [split, setSplit] = useState<{ message: string; items: string[] } | null>(null);
  const sendWith = async (message: string, style: boolean, attach: typeof files, cloud = false) => {
    setSending(true);
    setError(undefined);
    try {
      const run = await post<Run>("/runs", {
        projectId,
        objective: message,
        constraints: style ? [STYLE_CONSTRAINT] : [],
        attachedKnowledgeIds: [],
        references: attach.map(({ name, role, content }) => ({ name, role, content })),
        coder: cloud ? "cloud" : "local",
        ...(latest ? { parentRunId: latest.id, kind: "iterate" } : {}),
      });
      onSent(run);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSending(false);
    }
  };
  const composed = () => text.trim() || (files.length ? `Apply the attached file${files.length === 1 ? "" : "s"} to the project.` : "");
  /** Mid-run question: answered from the live run without interrupting it. */
  const ask = async () => {
    const q = text.trim();
    if (!q) return;
    const id = `qa_${Date.now().toString(36)}`;
    setQa((cur) => [...cur, { id, q, at: new Date().toISOString(), runId: latest?.id }]);
    setText("");
    try {
      const history = qa.slice(-3).flatMap((m) => [{ role: "user" as const, content: m.q }, ...(m.a ? [{ role: "assistant" as const, content: m.a }] : [])]);
      const res = await post<{ answer: string }>("/copilot/ask", { question: q, route: `/projects/${projectId}`, projectId, runId: latest?.id, history });
      playSound("reply");
      setQa((cur) => cur.map((m) => (m.id === id ? { ...m, a: res.answer } : m)));
    } catch (e) {
      setQa((cur) => cur.map((m) => (m.id === id ? { ...m, a: `I couldn't answer that just now (${(e as Error).message}).` } : m)));
    }
  };
  const send = async () => {
    const message = composed();
    if (!message) return;
    // A question is answered, never turned into a build (a "Why did the run stop?" once became a run of its own).
    if (busy || (!files.length && looksLikeQuestion(message))) return void ask();
    const items = !files.length ? splitRequest(message) : [];
    if (items.length >= 2) return void setSplit({ message, items });
    if (await sendWith(message, styleOnly, files, useCloud)) {
      setUseCloud(false);
      setText("");
      setFiles([]);
    }
  };
  const queue = () => {
    const message = composed();
    if (!message) return;
    setQueuedList((q) => [...q, { message, styleOnly, files, cloud: useCloud }]);
    setUseCloud(false);
    setText("");
    setFiles([]);
  };
  /** The split choice: everything as one change, or each part as its own change, one after another. */
  const sendSplit = async (separate: boolean) => {
    if (!split) return;
    const { message, items } = split;
    setSplit(null);
    if (!separate) {
      if (await sendWith(message, styleOnly, [], useCloud)) (setText(""), setUseCloud(false));
      return;
    }
    if (await sendWith(items[0]!, styleOnly, [], useCloud)) {
      setText("");
      setQueuedList((q) => [...q, ...items.slice(1).map((m) => ({ message: m, styleOnly, files: [] as typeof files, cloud: useCloud }))]);
      setUseCloud(false);
    }
  };
  // Send the next queued change as soon as the current one stops (a stopped change doesn't hold up the rest).
  useEffect(() => {
    if (!busy && queuedList.length && !sending) {
      const [q, ...rest] = queuedList;
      setQueuedList(rest);
      void sendWith(q!.message, q!.styleOnly, q!.files, q!.cloud);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, queuedList]);

  return (
    <div className="pchat">
      <JumpToLatest show={stick.away} onClick={stick.jump} />
      <div className="pchat__list" ref={listRef} aria-live="polite">
        {!thread.length ? (
          <div className="pchat__empty">
            <Icon name="ask" size={20} />
            <p>Describe a change and FlowCode will plan it, make it, check it and show you the result. Every change can be undone from the Review tab.</p>
          </div>
        ) : null}
        {thread.map((r) => {
          const a = reply(r, view, r.id === view?.run.id ? events : []);
          const isLive = r.id === view?.run.id;
          return (
            <div key={r.id} className="pchat__turn">
              <div className="pchat__me">
                <RequestText text={r.objective} />
                {r.referencePaths?.length ? (
                  <ul className="pchat__sent-files" aria-label="Attached files">
                    {r.referencePaths.map((p) => (
                      <li key={p}>
                        <Icon name="clip" size={11} /> {p.split("/").pop()}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="pchat__me-foot">
                  <CopyText text={r.objective} />
                  <span className="pchat__time">{ago(r.createdAt)}</span>
                </div>
              </div>
              <div className={`pchat__agent pchat__agent--${a.tone}`}>
                <ChatAuthor
                  avatar={<Logo size={18} />}
                  name="FlowCode"
                  detail={
                    <>
                      <StatusChip status={r.status} />
                      {a.tone === "work" ? <span className="pchat__dots" aria-hidden="true"><i /><i /><i /></span> : null}
                    </>
                  }
                  when={ago(r.completedAt ?? r.createdAt)}
                />
                <ChatText text={a.text} />
                {isLive && agentNotes.length && BUSY.includes(r.status) ? (
                  <ul className="pchat__notes">
                    {agentNotes.map((e) => (
                      <li key={e.seq}>{e.message.slice(0, 220)}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="pchat__actions">
                  {isLive && (isFinishedRun(r.status) || r.status === "verifying") ? (
                    <>
                      <button className="btn btn--sm" onClick={() => onShow("preview")}>
                        <Icon name="play" size={12} /> Preview
                      </button>
                      <button className="btn btn--sm" onClick={() => onShow("changes")}>
                        <Icon name="undo" size={12} /> Changes
                      </button>
                    </>
                  ) : null}
                  {isLive && r.status === "awaiting_approval" ? (
                    <button className="btn btn--sm btn--primary" onClick={() => onShow("approvals")}>
                      Review approval
                    </button>
                  ) : null}
                  <button className="btn btn--sm btn--ghost" onClick={() => onDetails(r.id)}>
                    Details
                  </button>
                  <span className="chat-msg-actions">
                    <CopyText text={a.text} label="Copy reply" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {qa
          .filter((m) => !latest || !m.runId || m.runId === latest.id)
          .map((m) => (
            <div key={m.id} className="pchat__turn pchat__qa">
              <div className="pchat__me">
                <p style={{ whiteSpace: "pre-wrap" }}>{m.q}</p>
                <div className="pchat__me-foot">
                  <CopyText text={m.q} />
                  <span className="pchat__time">{ago(m.at)}</span>
                </div>
              </div>
              <div className="pchat__agent pchat__answer">
                <ChatAuthor avatar={<Logo size={18} />} name="Copilot" detail="answers about this build" when={ago(m.at)} />
                {m.a ? <ChatText text={m.a} /> : <p className="muted chat-thinking"><span className="typing" aria-hidden="true"><i /><i /><i /></span> Looking at the run…</p>}
                {m.a ? (
                  <span className="chat-msg-actions">
                    <CopyText text={m.a} label="Copy reply" />
                  </span>
                ) : null}
                {m.a && !busy ? (
                  <button type="button" className="btn btn--sm pchat__as-change" onClick={() => void sendWith(m.q, false, [])}>
                    Build this as a change instead
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        {/* This project's decisions waiting on you, as action cards in the thread. */}
        <ChatApprovals projectId={projectId} runId={latest?.id} />
        {split ? (
          <div className="pchat__split" role="group" aria-label="Send as one change or separate changes">
            <p>
              <strong>This asks for {split.items.length} changes.</strong> Send them as one change, or as {split.items.length} separate changes? Separate changes run one after another, so if one stops, the others still go ahead.
            </p>
            <ol>
              {split.items.map((it) => (
                <li key={it}>{it.split("\n")[0]!.length > 110 ? `${it.split("\n")[0]!.slice(0, 110)}…` : it.split("\n")[0]}</li>
              ))}
            </ol>
            <div className="pchat__split-actions">
              <button type="button" className="btn btn--sm btn--primary" onClick={() => void sendSplit(true)}>
                {split.items.length} separate changes
              </button>
              <button type="button" className="btn btn--sm" onClick={() => void sendSplit(false)}>
                One change
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSplit(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {queuedList.map((queued, i) => (
          <div key={`${i}-${queued.message.slice(0, 20)}`} className="pchat__queued" role="status">
            <span>
              <strong>{queuedList.length > 1 ? `Queued ${i + 1} of ${queuedList.length}:` : "Queued:"}</strong> “{queued.message.length > 120 ? `${queued.message.slice(0, 120)}…` : queued.message}” {queued.cloud ? "(on the cloud) " : ""}{i === 0 ? "will be sent when the current change finishes." : "follows the one above."}
            </span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setQueuedList((q) => q.filter((_, k) => k !== i))}>
              <Icon name="close" size={12} /> Remove
            </button>
          </div>
        ))}
      </div>

      <form
        className={`pchat__composer${dragging ? " is-dragging" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
        }}
      >
        {dragging ? <div className="pchat__drop">Drop .md, .css, .json, .html or .txt files to attach</div> : null}
        <div className="pchat__chips" role="group" aria-label="Suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s.label} type="button" className="pchat__chip" onClick={() => (setText(s.text), setStyleOnly(s.style))}>
              {s.label}
            </button>
          ))}
        </div>
        <label htmlFor="pchat-input" className="sr-only">
          Message FlowCode
        </label>
        <textarea
          id="pchat-input"
          data-cp="chat-input"
          className="textarea pchat__input"
          rows={3}
          value={text}
          disabled={sending}
          placeholder={busy ? "Ask about the change in progress (e.g. “What are you doing now?”), or type a change to queue for next" : "Ask for a change — e.g. “Use a warmer accent colour and larger headings”"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {text.length > 1500 ? (
          <span className={`pchat__count${text.length > LIMIT ? " is-over" : ""}`} aria-live="polite">
            {text.length.toLocaleString()} / {LIMIT.toLocaleString()} characters{text.length > LIMIT ? " — too long. Attach it as a file instead (.css, .md, .json, .html)." : text.length > 4000 ? " · long code is easier to attach as a file" : ""}
          </span>
        ) : null}
        {files.length ? (
          <ul className="pchat__files" aria-label="Attached files">
            {files.map((f) => (
              <li key={f.name} className="pchat__file">
                <Icon name="file" size={13} />
                <span className="pchat__file-name">{f.name}</span>
                <span className="pchat__file-meta">
                  {ROLE_LABEL[f.role]} · {kb(f.size)}
                </span>
                <button type="button" className="pchat__file-x" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x.name !== f.name))}>
                  <Icon name="x" size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <ErrorNotice error={error} doing="send that" />
        ) : null}
        <div className="pchat__bar">
          <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (e.target.files && void addFiles(e.target.files), (e.target.value = ""))} />
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => fileInput.current?.click()} disabled={sending} title="Attach .md, .css, .json, .html or .txt files for FlowCode to read and apply">
            <Icon name="clip" size={14} /> Attach
          </button>
          <label className="check" title={STYLE_CONSTRAINT}>
            <input type="checkbox" checked={styleOnly} onChange={(e) => setStyleOnly(e.target.checked)} /> Styling only
          </label>
          {cloudCfg.data?.ready ? (
            <label className="check" data-cp="cloud-change" title={`This change only: ${cloudCfg.data.model} writes and checks it, so this project's code and screenshots are sent to ${cloudCfg.data.providerLabel ?? "the provider"}, which charges per use. Unticked, everything stays on this computer.`}>
              <input type="checkbox" checked={useCloud} onChange={(e) => setUseCloud(e.target.checked)} /> Use the cloud for this change
            </label>
          ) : null}
          <span className="pchat__hint">{busy ? "Enter asks about the current change · Queue sends a new change when it finishes" : "Enter to send · Shift+Enter for a new line"}</span>
          {busy ? (
            <>
              <button type="button" className="btn btn--sm" disabled={!text.trim() && !files.length} onClick={queue} title="Send this change when the ones before it finish">
                Queue change
              </button>
              <button className="btn btn--primary btn--sm" type="submit" disabled={!text.trim()}>
                Ask <Icon name="chevron" size={12} />
              </button>
            </>
          ) : (
            <button className="btn btn--primary btn--sm" data-cp="chat-send" type="submit" disabled={(!text.trim() && !files.length) || sending}>
              {sending ? "Sending…" : "Send"} <Icon name="chevron" size={12} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
