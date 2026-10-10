/**
 * Copilot: app-aware assistant available on every page (Ctrl/⌘+K). Answers come with guided steps that
 * navigate to the right page and spotlight the exact UI element being explained.
 */
import { scripted, setupGreeting, setupReply, type SetupState } from "./copilotSetup";
import { ChatApprovals } from "./ChatApprovals";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { friendlyError } from "@flowcode/contracts";
import { APP_GUIDE, featureFamily, stepTarget } from "@flowcode/contracts";
import { post, useResource, get } from "../api";
import { CopyText, Icon, Logo } from "./ui";
import { navigate } from "../router";
import { ResizeHandle, usePersistedWidth } from "./ResizeHandle";
import { playSound } from "./sounds";
import { NARRATE, startJourney } from "./CopilotDriver";
import { CATALOG, DRAFT_LABEL, draftJourney, matchDraft, matchJourney, moreJourneys, nextInBuild, stepsJourney, type JourneyMatch } from "./copilotJourneys";
import { ChatAuthor, ChatText, JumpToLatest, useStickyScroll } from "./ChatParts";

interface Msg {
  role: "user" | "assistant";
  content: string;
  steps?: Array<{ anchor: string; text: string }>;
  source?: string;
  /** A change request the Copilot drafted for the FlowCode Builder; sent only when the user clicks. */
  draft?: { projectId: string; projectName: string; objective: string; sentRunId?: string };
  /** Questions the user can pick to keep going. */
  followUps?: string[];
  /** The project and run on screen when this was said: history is only sent back for the same build. */
  projectId?: string;
  runId?: string;
  /** For status questions: the facts the answer came from. */
  status?: RunStatusFacts;
  /** A journey the Copilot can walk you through in the app (with its cursor). */
  journey?: JourneyMatch;
  /** After a journey ends: other things the Copilot can do for you (catalog ids). */
  more?: string[];
  /** The next stage of the build after the journey that just finished, with the reason it follows. */
  next?: { id: string; why: string };
}

/** The structured run facts behind a status answer (from the daemon's runFacts). */
interface RunStatusFacts {
  projectName: string;
  runId: string;
  resolvedBy: "route" | "project" | "named";
  statusLabel: string;
  finished: boolean;
  steps: { verified: number; total: number; running?: string };
  checks: Array<{ kind: string; name: string; state: string }>;
  verification: "complete" | "incomplete" | "not_run";
  waitingApprovals: number;
}

export type CopilotPart = { name: string; kind: string; context?: string };
export type CopilotRequest = { kind: "explain"; anchor: string; label?: string; part?: CopilotPart } | { kind: "ask"; question: string } | { kind: "prefill"; text: string } | { kind: "tour"; steps: Array<{ anchor: string; text: string }> };

/** Opens the Copilot drawer from anywhere and hands it a request. */
export function copilot(detail: CopilotRequest) {
  window.dispatchEvent(new CustomEvent<CopilotRequest>("fc:copilot", { detail }));
}

/** Starter questions for the page you are on (by the first part of the address, with a few deeper pages). */
const SUGGESTIONS: Record<string, string[]> = {
  "": ["How do I start a prototype?", "What do the project cards show?", "How do I build a prototype from a PRD?", "Where do I find a past run?"],
  discover: ["Should I pick Light or Deep Research?", "What happens after I describe the problem?", "How do I turn my research into a PRD?", "Can I upgrade Light Research to Deep?"],
  "discover/new": ["Should I pick Light or Deep Research?", "How long does Light Research take?", "What does Deep Research add?"],
  "discover/:id": ["What should I do on this stage?", "What do the evidence labels mean?", "Why is a stage marked out of date?", "How do I start a prototype from this PRD?"],
  agents: ["What does each agent do?", "What is the design playbook?", "How do I add a playbook guide?", "Which agent reviews the work?"],
  quality: ["What is Launch readiness?", "How do I download Launch readiness as Markdown?", "How do I fix a failing check?"],
  "quality/:id": ["What does this check mean?", "What is the prototype plan?", "Why did this check fail?"],
  "projects/:id": ["What's the build doing right now?", "Is anything going wrong?", "What should I do next?", "What do the checks at the bottom mean?"],
  knowledge: ["How do I upload a document?", "How does the AI use my knowledge?", "What is the difference between notes and sources?"],
  topics: ["How does Topic Search work?", "How do I start a new topic?", "Where do the findings go?"],
  network: ["What does the graph show?", "How are items linked?", "How do I filter the graph?"],
  library: ["What is a skill?", "How do I turn a guide into a skill?", "How do I use a prompt in a prototype?", "What are the UI components for?"],
  search: ["What does search cover?", "How do I search the web?", "How do I save a result to knowledge?"],
  system: ["Where do I restart the daemon?", "Which local models are running?", "What do the health checks mean?"],
  settings: ["How do I set light or dark per page?", "What does the Copilot know about me?", "How do I change the PRD templates?"],
  primitives: ["What is on the Branding page?", "How do prototypes use these components?"],
  guide: ["Where should I start?", "How do I build a prototype from a PRD?", "What does Create PRD do?"],
  // These six had no entry and fell through to the Dashboard's four, so the Copilot opened on Approvals asking how
  // to start a prototype. A page you are standing on is the thing you are most likely to be asking about.
  approvals: ["What is waiting on me?", "What happens if I deny this?", "Why does FlowCode need my OK for this?", "Where do I see what I decided before?"],
  components: ["What is the component library for?", "How do agents choose a component?", "What is the approval shelf?", "Can I use these in my own app?"],
  pipeline: ["What does the skill pipeline show?", "How does a skill get proposed?", "How do I approve a skill?"],
  journal: ["What goes in the journal?", "How do I write a decision?", "Where do notes show up later?"],
  flowreport: ["What does a repo report cover?", "How long does a report take?", "What do the section scores mean?", "Is my code sent anywhere?"],
  about: ["What is FlowCode?", "What runs on my computer?", "Which models does it use?"],
};
function suggestionsFor(route: string): string[] {
  const parts = route.replace(/^\//, "").split(/[/?]/).filter(Boolean);
  const top = parts[0] ?? "";
  if (top === "discover" && parts[1]) return SUGGESTIONS[parts[1] === "new" ? "discover/new" : "discover/:id"];
  if ((top === "quality" || top === "projects") && parts[1]) return SUGGESTIONS[`${top}/:id`];
  return SUGGESTIONS[top] ?? SUGGESTIONS[""];
}
// v2: conversations from before the Copilot became conversational are not shown or sent back as history,
// so the model does not copy their status-report style.
const STORE = "fc.copilot.history.v2";
const MODEL_KEY = "fc.copilot.model";
const readModel = () => {
  try {
    return localStorage.getItem(MODEL_KEY) ?? "";
  } catch {
    return "";
  }
};

function load(): Msg[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]") as Msg[];
  } catch {
    return [];
  }
}

export function Copilot({ route, projectId, runId, open, setOpen }: { route: string; projectId?: string; runId?: string; open: boolean; setOpen: (fn: (o: boolean) => boolean) => void }) {
  // What the chain needs to know before it sends you anywhere: how many decisions are actually waiting, and whether
  // there is a project to go to. The same /approvals the nav badge reads, so the two can never disagree.
  const waitingNow = useResource<Array<{ status?: string }>>("/approvals", [], 0);
  const state = useRef({ waiting: 0, hasProject: false });
  state.current = { waiting: (waitingNow.data ?? []).filter((a) => (a.status ?? "pending") === "pending").length, hasProject: Boolean(projectId) };
  const [msgs, setMsgs] = useState<Msg[]>(load);
  /** The "Show me how to…" list, opened from the header's Show me. */
  const [showMenu, setShowMenu] = useState(false);
  const pick = (id: string) => {
    setShowMenu(false);
    offer(id);
  };
  // Clear also clears past approval decisions from this panel (they stay on Approvals → Decision log).
  const [clearedAt, setClearedAt] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem("flowcode.copilot.clearedAt") ?? undefined;
    } catch {
      return undefined;
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tour, setTour] = useState<{ steps: Array<{ anchor: string; text: string }>; i: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(msgs.slice(-40)));
    } catch {
      /* storage unavailable */
    }
  }, [msgs]);
  // Follow new messages only while you're at the bottom; scrolled up, a "Jump to latest" button appears instead.
  const stick = useStickyScroll(listRef, [msgs.length, msgs.at(-1)?.content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setTour(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // Drawer width: a CSS variable on .app (the grid column), persisted per viewer.
  const setWidth = usePersistedWidth("fc.copilotW", "--copilot-w", () => document.querySelector<HTMLElement>(".app"));
  const panelWidth = () => document.getElementById("copilot-panel")?.getBoundingClientRect().width ?? 420;

  // Requests from elsewhere in the app (right-click "Explain this feature", "Ask Copilot about this").
  const askRef = useRef<(q: string, explain?: string, part?: CopilotPart) => void>(() => undefined);
  /** "" = automatic (the documenter role's model). */
  // Embedding models (e.g. nomic-embed) can’t chat; a saved one falls back to Auto.
  // Before any model can run (no Ollama, or the Copilot's model isn't downloaded), a scripted setup assistant answers.
  const setupS = useResource<SetupState>(open ? "/setup/status" : null, [open], 5000);
  const isScripted = scripted(setupS.data);
  const projectsList = useResource<Array<{ id: string; name: string; updatedAt: string }>>(open ? "/projects" : null, [open]);
  const [model, setModelState] = useState(() => (/embed/i.test(readModel()) ? "" : readModel()));
  const models = useResource<Array<{ name: string; parameterSize?: string }>>(open ? "/models/providers/ollama/models" : null, [open]);
  const roles = useResource<Record<string, { assignment?: { model: string } }>>(open ? "/models/roles" : null, [open]);
  const autoModel = roles.data?.documenter?.assignment?.model;
  const setModel = (m: string) => {
    setModelState(m);
    try {
      if (m) localStorage.setItem(MODEL_KEY, m);
      else localStorage.removeItem(MODEL_KEY);
    } catch {
      /* storage unavailable */
    }
  };
  useEffect(() => {
    const on = (ev: Event) => {
      const d = (ev as CustomEvent<CopilotRequest>).detail;
      // A guided tour from elsewhere (e.g. About FlowCode's Show me): run it without opening the panel.
      if (d.kind === "tour") {
        if (d.steps.length) setTour({ steps: d.steps, i: 0 });
        return;
      }
      setOpen(() => true);
      if (d.kind === "explain" && d.part) {
        // One part (a button, link, tab, text…): explain only that, with follow-up questions to go further.
        askRef.current(`What does the "${d.part.name}" ${d.part.kind} do?`, d.anchor, d.part);
      } else if (d.kind === "explain") {
        // Explained by the model from the full feature catalog (the feature, its parts and what it connects to).
        const title = featureFamily(d.anchor)[0]?.title ?? APP_GUIDE.find((a) => a.id === d.anchor)?.title ?? d.label ?? d.anchor;
        askRef.current(`Explain ${title}: what it is, what each part does, and how I use it.`, d.anchor);
      } else if (d.kind === "ask") askRef.current(d.question);
      else if (d.kind === "prefill") {
        setInput(d.text);
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    };
    window.addEventListener("fc:copilot", on);
    return () => window.removeEventListener("fc:copilot", on);
  }, [setOpen]);

  // A question can wait behind a build: the local model answers one request at a time. Say so, and allow stopping.
  const reqId = useRef(0);
  const [waitingOn, setWaitingOn] = useState<string>();
  useEffect(() => {
    if (!busy) return setWaitingOn(undefined);
    const id = reqId.current;
    const t = setTimeout(() => {
      void get<{ busy: boolean; runs: Array<{ projectName: string }> }>("/copilot/status")
        .then((st) => {
          if (reqId.current === id && st.busy) setWaitingOn(st.runs[0]?.projectName ?? "a project");
        })
        .catch(() => undefined);
    }, 2500);
    return () => clearTimeout(t);
  }, [busy]);
  const stop = () => {
    reqId.current++;
    setBusy(false);
    setMsgs((m) => [...m, { role: "assistant", content: "Stopped. Ask again once the build's current step is done, or any time after it finishes." }]);
  };

  const ask = async (q: string, explain?: string, part?: CopilotPart) => {
    const question = q.trim();
    if (!question || busy) return;
    const history = msgs.slice(-6).map(({ role, content, projectId: p, runId: r }) => ({ role, content, ...(p ? { projectId: p } : {}), ...(r ? { runId: r } : {}) }));
    const tags = { ...(projectId ? { projectId } : {}), ...(runId ? { runId } : {}) };
    setMsgs((m) => [...m, { role: "user", content: question, ...tags }]);
    setInput("");
    if (isScripted && setupS.data) {
      const reply = setupReply(question, setupS.data);
      setMsgs((m) => [...m, { role: "assistant", content: reply.text, source: "setup", followUps: reply.chips, ...tags }]);
      // Each answer re-checks the setup, so "I've done that" reflects what really changed.
      setupS.reload();
      return;
    }
    // "How do I…" for something FlowCode can show in the app: offer to do it with the Copilot's cursor.
    // The project list may still be loading right after the panel opens: fetch it rather than miss the journey.
    const plist = projectsList.data ?? (await get<Array<{ id: string; name: string; updatedAt: string }>>("/projects").catch(() => []));
    const proj = plist.find((p) => p.id === (projectId ?? lastOpenedProject())) ?? [...plist].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    // "Help me write…": the local model drafts from the idea, then the Copilot types it into the form and waits for review.
    const wantsDraft = matchDraft(question);
    if (wantsDraft) {
      if (!wantsDraft.idea) {
        setMsgs((m) => [...m, { role: "assistant", content: `Happy to. What should the ${DRAFT_LABEL[wantsDraft.kind]} be about? Say it in a sentence or two, like "help me write a ${DRAFT_LABEL[wantsDraft.kind]} for …", and I'll write a first draft for you to review.`, ...tags }]);
        return;
      }
      setBusy(true);
      const id = ++reqId.current;
      try {
        const d = await post<{ fields: Record<string, string>; model: string }>("/copilot/draft", { kind: wantsDraft.kind, idea: wantsDraft.idea });
        if (id !== reqId.current) return;
        playSound("reply");
        const journey = { ...draftJourney(wantsDraft.kind, d.fields), id: `draft-${wantsDraft.kind}` };
        const preview = Object.values(d.fields).filter(Boolean).join("\n\n");
        setMsgs((m) => [...m, { role: "assistant", content: `Here's a first draft of your ${DRAFT_LABEL[wantsDraft.kind]} (written by ${d.model} on this computer):\n\n${preview}\n\nI'll put it into the form and stop after each part so you can review and edit it. Saving is yours.`, journey: { journey, summary: "" }, ...tags }]);
      } catch (e) {
        if (id === reqId.current) setMsgs((m) => [...m, { role: "assistant", content: (() => { const fe = friendlyError((e as Error).message, "write that draft"); return `${fe.title}. ${fe.explain} ${fe.next}`; })(), ...tags }]);
      } finally {
        if (id === reqId.current) setBusy(false);
      }
      return;
    }
    const journey = matchJourney(question, proj ? { id: proj.id, name: proj.name.replace(/\s+/g, " "), ...(proj.id === projectId && runId ? { runId } : {}) } : undefined);
    if (journey) {
      setMsgs((m) => [...m, { role: "assistant", content: journey.summary, journey, ...tags }]);
      return;
    }
    setBusy(true);
    const id = ++reqId.current;
    try {
      const res = await post<{ answer: string; steps: Array<{ anchor: string; text: string }>; source: string; draft?: Msg["draft"]; followUps?: string[]; status?: RunStatusFacts }>("/copilot/ask", { question, route, projectId, runId, history, model: model || undefined, explain, part });
      if (id !== reqId.current) return; // stopped while waiting
      playSound("reply");
      setMsgs((m) => [...m, { role: "assistant", content: res.answer, steps: res.steps, source: res.source, draft: res.draft, followUps: res.followUps, status: res.status, ...tags }]);
    } catch (e) {
      if (id !== reqId.current) return;
      setMsgs((m) => [...m, { role: "assistant", content: (() => { const fe = friendlyError((e as Error).message, "answer that"); return `${fe.title}. ${fe.explain} ${fe.next}`; })() }]);
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  };

  askRef.current = (q, explain, part) => void ask(q, explain, part);
  /** The project you opened last in the builder (remembered by the top bar). */
  const lastOpenedProject = () => {
    try {
      return localStorage.getItem("flowcode.topbarProject") ?? undefined;
    } catch {
      return undefined;
    }
  };
  /** The project a journey works on: the one on screen, else the most recent. */
  const journeyProject = () => {
    const p = (projectsList.data ?? []).find((x) => x.id === (projectId ?? lastOpenedProject())) ?? [...(projectsList.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return p ? { id: p.id, name: p.name.replace(/\s+/g, " "), ...(p.id === projectId && runId ? { runId } : {}) } : undefined;
  };
  const offer = (id: string) => {
    const c = CATALOG.find((x) => x.id === id);
    if (!c) return;
    const project = journeyProject();
    if (c.project && !project) {
      setMsgs((m) => [...m, { role: "assistant", content: `"${c.label}" works on a project, and you don't have one yet. Start a new build first.` }]);
      return;
    }
    setMsgs((m) => [...m, { role: "user", content: `Show me how to ${c.label.charAt(0).toLowerCase() + c.label.slice(1)}` }, { role: "assistant", content: `Here's how${c.project && project ? ` (in ${project.name})` : ""}. Watch the Copilot cursor, or let it do it for you. Anything final is yours to press.`, journey: { journey: c.build({ project }), summary: c.label } }]);
  };
  /** Journeys offered lately, so the next "more" list shows different ones. */
  const recentMore = useRef<string[]>([]);
  // While the Copilot drives the app, each step is also said here, as it happens.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id?: string; title: string; i: number; n: number; say: string; final?: boolean; note?: string; ended?: "done" | "stopped" }>).detail;
      const content = d.ended === "stopped" ? `Stopped at step ${d.i + 1} of ${d.n}. You've got the controls; ask me again any time.` : `Step ${d.i + 1} of ${d.n}: ${d.say}${d.note ? ` (${d.note})` : ""}${d.final ? " The final button is yours to press." : ""}`;
      setMsgs((m) => [...m, { role: "assistant", content, source: "drive" }]);
      // A finished journey hands you to the next stage of the build; a stopped one does not push you onward.
      if (d.ended === "stopped" || d.i === d.n - 1) {
        const next = d.ended === "stopped" ? undefined : nextInBuild(d.id, state.current);
        if (next) {
          setMsgs((m) => [...m, { role: "assistant", content: `Next: ${next.entry.label.toLowerCase()}. ${next.why}`, source: "drive", next: { id: next.entry.id, why: next.why } }]);
        }
        const more = moreJourneys(d.title, recentMore.current, d.id);
        recentMore.current = [...more, ...recentMore.current].slice(0, 8);
        setMsgs((m) => [...m, { role: "assistant", content: next ? "Or go somewhere else:" : "I can also do these for you in the app:", source: "drive", more }]);
      }
    };
    window.addEventListener(NARRATE, on);
    return () => window.removeEventListener(NARRATE, on);
  }, []);
  const sendDraft = async (i: number, objective: string) => {
    const d = msgs[i]?.draft;
    if (!d) return;
    const run = await post<{ id: string }>("/copilot/send-draft", { projectId: d.projectId, objective });
    setMsgs((m) => m.map((x, j) => (j === i && x.draft ? { ...x, draft: { ...x.draft, objective, sentRunId: run.id } } : x)));
    navigate(`/projects/${d.projectId}`);
  };

  return (
    <>
      {open ? (
        <aside id="copilot-panel" className="copilot" aria-label="FlowCode Copilot">
          <ResizeHandle side="left" label="Copilot width" value={panelWidth} min={300} max={() => Math.min(900, innerWidth * 0.6)} onChange={setWidth} onReset={() => setWidth(null)} />
          <header className="copilot__head">
            <Logo size={20} />
            <strong>Copilot</strong>
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: "auto" }}
              title="Walkthroughs: the Copilot's cursor shows you how to do something (Tell the Copilot about you is under Settings)"
              aria-expanded={showMenu}
              onClick={() => {
                setShowMenu((o) => !o);
                setTimeout(() => document.querySelector(".cp-menu")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
              }}
            >
              Show me
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => {
              setMsgs([]);
              const now = new Date().toISOString();
              setClearedAt(now);
              try {
                localStorage.setItem("flowcode.copilot.clearedAt", now);
              } catch {
                /* the conversation still clears */
              }
            }} title="Clear the conversation and past decisions (anything still waiting on you stays)">
              Clear
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setOpen(() => false)} aria-label="Close Copilot">
              <Icon name="x" size={14} />
            </button>
          </header>
          <JumpToLatest show={stick.away} onClick={stick.jump} />
          <div className="copilot__body" ref={listRef} aria-live="polite">
            {/* Decisions waiting on you, as action cards (never answered by typing in chat). */}
            <ChatApprovals projectId={projectId} runId={runId} compact since={clearedAt} />
            {msgs.length === 0 && isScripted && setupS.data ? (
              (() => {
                const g = setupGreeting(setupS.data);
                return (
                  <div className="copilot__msg copilot__msg--assistant">
                    <ChatAuthor avatar={<Logo size={16} />} name="Copilot" detail="setup guide" />
                    <ChatText text={g.text} />
                    <div className="copilot__follow" role="group" aria-label="Quick replies">
                      {g.chips.map((q) => (
                        <button key={q} type="button" className="net-chip" onClick={() => void ask(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : msgs.length === 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="dim" style={{ margin: 0 }}>
                  Ask anything about FlowCode: how a feature works, where something lives, or what is happening in your run. I'll point at the exact part of the screen.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {suggestionsFor(route).map((s) => (
                    <button key={s} className="net-chip" onClick={() => void ask(s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <JourneyMenu onPick={pick} open={showMenu} onToggle={setShowMenu} />
              </div>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`copilot__msg copilot__msg--${m.role}`}>
                  {m.role === "assistant" ? <ChatAuthor avatar={<Logo size={16} />} name="Copilot" detail={m.source === "setup" ? "setup guide" : m.source === "guide" ? "from the built-in guide" : m.source === "drive" ? "showing you in the app" : model || autoModel || undefined} /> : null}
                  {m.status ? <StatusFacts f={m.status} /> : null}
                  {m.role === "assistant" ? <ChatText text={m.content} /> : <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>}
                  <div className="copilot__msg-foot chat-msg-actions">
                    <CopyText text={m.content} label={m.role === "assistant" ? "Copy reply" : "Copy message"} />
                  </div>
                  {m.steps?.length ? (
                    <ol className="copilot__steps">
                      {m.steps.map((s, j) => (
                        <li key={j}>
                          <span>{s.text}</span>
                          <button className="btn btn--sm" onClick={() => startJourney(stepsJourney(m.steps!, (a) => stepTarget(a, projectId), j), "show")}>
                            Show me
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {m.steps && m.steps.length > 1 ? (
                    <button className="btn btn--primary btn--sm" style={{ marginTop: 8 }} onClick={() => startJourney(stepsJourney(m.steps!, (a) => stepTarget(a, projectId)), "show")}>
                      Walk me through it
                    </button>
                  ) : null}
                  {m.draft ? <DraftCard draft={m.draft} onSend={(text) => sendDraft(i, text)} /> : null}
                  {m.next ? (
                    <div className="copilot__journey">
                      <button type="button" className="btn btn--sm btn--primary" onClick={() => offer(m.next!.id)}>
                        Take me there
                      </button>
                    </div>
                  ) : null}
                  {m.more?.length ? (
                    <div className="copilot__more" role="group" aria-label="Other things the Copilot can do">
                      {m.more.map((id) => {
                        const c = CATALOG.find((x) => x.id === id);
                        return c ? (
                          <button key={id} type="button" className="copilot__more-item" onClick={() => offer(id)}>
                            <Icon name="chevron" size={12} /> {c.label}
                          </button>
                        ) : null;
                      })}
                    </div>
                  ) : null}
                  {m.journey ? (
                    <div className="copilot__journey">
                      <button type="button" className="btn btn--sm btn--primary" onClick={() => startJourney(m.journey!.journey, "show")}>
                        Show me, step by step
                      </button>
                      <button type="button" className="btn btn--sm" onClick={() => startJourney(m.journey!.journey, "do")}>
                        Do it for me
                      </button>
                      <span className="copilot__journey-note">You press the final button yourself.</span>
                    </div>
                  ) : null}
                  {m.followUps?.length && i === msgs.length - 1 ? (
                    <div className="copilot__follow" role="group" aria-label="Follow-up questions">
                      {m.followUps.map((q) => (
                        <button key={q} type="button" className="net-chip" disabled={busy} onClick={() => void ask(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                  ) : null}

                </div>
              ))
            )}
            {showMenu && msgs.length ? <JourneyMenu onPick={pick} open onToggle={setShowMenu} /> : null}
            {busy ? (
              <div className="copilot__msg copilot__msg--assistant">
                <span className="typing" aria-label="Copilot is thinking">
                  <i />
                  <i />
                  <i />
                </span>
                {waitingOn ? (
                  <div className="copilot__waiting" role="status">
                    <p>
                      Your build for {waitingOn} is using the local model, which answers one request at a time. I&apos;ll reply as soon as its current step finishes.
                    </p>
                    <button type="button" className="btn btn--sm" onClick={stop}>
                      Stop waiting
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <form
            className="copilot__input"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <label htmlFor="copilot-q" className="sr-only">
              Ask Copilot
            </label>
            <textarea
              id="copilot-q"
              ref={inputRef}
              className="textarea"
              rows={2}
              style={{ minHeight: 44 }}
              placeholder="Ask about FlowCode or your run…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
            />
            <button className="btn btn--primary" type="submit" disabled={busy || !input.trim()} aria-label="Send">
              <Icon name="chevron" size={14} />
            </button>
            <div className="copilot__model">
              <label htmlFor="copilot-model" className="sr-only">Copilot model</label>
              <select id="copilot-model" className="select" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">Auto{autoModel ? ` (${autoModel})` : ""}</option>
                {(models.data ?? []).filter((m) => !/embed/i.test(m.name)).map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                    {m.parameterSize ? ` · ${m.parameterSize}` : ""}
                  </option>
                ))}
                {model && models.data && !models.data.some((m) => m.name === model && !/embed/i.test(m.name)) ? <option value={model}>{model} (not installed)</option> : null}
              </select>
            </div>
          </form>
        </aside>
      ) : null}
      {tour ? <Spotlight tour={tour} setTour={setTour} projectId={projectId} /> : null}
    </>
  );
}

/** Navigates to the anchor's page, then dims the screen around the element and explains it. */
function Spotlight({ tour, setTour, projectId }: { tour: { steps: Array<{ anchor: string; text: string }>; i: number }; setTour: (t: { steps: Array<{ anchor: string; text: string }>; i: number } | null) => void; projectId?: string }) {
  const step = tour.steps[tour.i];
  // Steps name catalog features: go to the feature's page, open its tab, then highlight it.
  const target = stepTarget(step.anchor, projectId);
  const legacy = APP_GUIDE.find((a) => a.id === step.anchor);
  const title = target.feature?.title ?? legacy?.title;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);

  const locate = useCallback(() => {
    let el: HTMLElement | null = null;
    if (target.tab) {
      // Open the tab, then highlight its panel (or the tab itself).
      const btn = document.querySelector<HTMLElement>(`[data-tab="${target.tab}"]`);
      if (btn) {
        if (btn.getAttribute("aria-selected") !== "true") btn.click();
        el = document.getElementById(btn.getAttribute("aria-controls") ?? "") ?? btn;
      }
    }
    if (!el && target.anchor) el = document.querySelector<HTMLElement>(`[data-guide="${target.anchor}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const found = el;
    setTimeout(() => setRect(found.getBoundingClientRect()), 280);
    return true;
  }, [target.tab, target.anchor]);

  useLayoutEffect(() => {
    setRect(null);
    setMissing(false);
    const route = target.route ?? (legacy && legacy.route !== "*" ? (legacy.route === ":project" ? (projectId ? `/projects/${projectId}` : undefined) : legacy.route) : undefined);
    if (route) {
      const here = location.hash.replace(/^#/, "").split("?")[0] || "/";
      const onPage = here === route || (route !== "/" && here.startsWith(`${route}/`));
      if (!onPage) navigate(route);
    }
    // A whole page or section with nothing specific to highlight: opening it is the step; explain it over the page.
    if (!target.anchor && !target.tab && target.route) return;
    let tries = 0;
    const t = setInterval(() => {
      if (locate() || ++tries > 25) {
        clearInterval(t);
        if (tries > 25) setMissing(true);
      }
    }, 120);
    const onResize = () => locate();
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", onResize);
    };
  }, [tour.i, step.anchor, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pad = 8;
  const box = rect ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const below = box ? box.top + box.height + 220 < window.innerHeight : true;
  const calloutStyle: React.CSSProperties = box
    ? { left: Math.min(Math.max(12, box.left), window.innerWidth - 372), top: below ? box.top + box.height + 12 : Math.max(12, box.top - 12 - 190) }
    : { left: "50%", top: "40%", transform: "translate(-50%, -50%)" };

  return (
    <div className="spotlight" role="dialog" aria-modal="true" aria-label={`Guided step ${tour.i + 1} of ${tour.steps.length}`}>
      {box ? <div className="spotlight__hole" style={box} /> : <div className="spotlight__veil" />}
      <div className="spotlight__callout" style={calloutStyle}>
        <span className="label">
          step {tour.i + 1} of {tour.steps.length}
          {title ? ` · ${title}` : ""}
        </span>
        <p style={{ margin: "6px 0 10px" }}>{missing ? `${step.text} (${target.needsProject && !projectId ? "Open a project first; this part lives in a project's builder." : "That part isn't visible on this screen right now."})` : step.text}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--sm" disabled={tour.i === 0} onClick={() => setTour({ ...tour, i: tour.i - 1 })}>
            Back
          </button>
          {tour.i < tour.steps.length - 1 ? (
            <button className="btn btn--primary btn--sm" onClick={() => setTour({ ...tour, i: tour.i + 1 })} autoFocus>
              Next
            </button>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={() => setTour(null)} autoFocus>
              Done
            </button>
          )}
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }} onClick={() => setTour(null)}>
            Esc
          </button>
        </div>
      </div>
    </div>
  );
}

/** A change the Copilot drafted for the FlowCode Builder: editable, and sent only when the user clicks Send. */
function DraftCard({ draft, onSend }: { draft: NonNullable<Msg["draft"]>; onSend: (objective: string) => Promise<void> }) {
  const [text, setText] = useState(draft.objective);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (draft.sentRunId) {
    return (
      <div className="copilot-draft is-sent" role="status">
        <span className="copilot-draft__label">Sent to the builder · {draft.projectName}</span>
        <button type="button" className="btn btn--sm" onClick={() => navigate(`/projects/${draft.projectId}`)}>
          Open the builder
        </button>
      </div>
    );
  }
  return (
    <div className="copilot-draft">
      <span className="copilot-draft__label">Change request for {draft.projectName}</span>
      <textarea className="textarea copilot-draft__text" aria-label="Change request" rows={Math.min(10, Math.max(3, text.split("\n").length + 1))} value={text} onChange={(e) => setText(e.target.value)} />
      {error ? <p className="notice notice--bad" style={{ margin: 0 }}>{error}</p> : null}
      <div className="copilot-draft__actions">
        <span className="muted">Edit it if you like. Nothing is sent until you click.</span>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await onSend(text.trim());
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending…" : "Send to builder"}
        </button>
      </div>
    </div>
  );
}

/** The facts a status answer is based on: which build, where it stands, and what was (and wasn't) verified. */
function StatusFacts({ f }: { f: RunStatusFacts }) {
  const missing = f.checks.filter((c) => c.state === "unavailable");
  const failed = f.checks.filter((c) => c.state === "failed");
  return (
    <div className="copilot__facts" aria-label="Build facts">
      <div className="copilot__facts-head">
        <strong>{f.projectName}</strong>
        <span className="copilot__facts-status">{f.statusLabel}</span>
      </div>
      <div className="copilot__facts-row">
        {f.steps.verified} of {f.steps.total} steps passed
        {f.waitingApprovals ? ` · ${f.waitingApprovals} waiting for you` : ""}
      </div>
      {f.finished ? (
        <div className={`copilot__facts-row${f.verification === "complete" && !failed.length ? "" : " copilot__facts-row--warn"}`}>
          {f.verification === "complete" && !failed.length
            ? "All final checks ran and passed"
            : missing.length
              ? `Not verified: ${missing.map((c) => c.name).join(", ")} couldn't run`
              : failed.length
                ? `Failing: ${failed.map((c) => c.name).join(", ")}`
                : "Final checks incomplete"}
        </div>
      ) : null}
      <div className="copilot__facts-basis">{f.resolvedBy === "named" ? "Latest build of the project you named" : f.resolvedBy === "route" ? "The build on this page" : "Latest build of this project"} · live data</div>
    </div>
  );
}

/** Everything the Copilot can show you in the app, grouped; picking one offers Show me / Do it for me. */
function JourneyMenu({ onPick, open, onToggle }: { onPick: (id: string) => void; open?: boolean; onToggle?: (open: boolean) => void }) {
  const groups = [...new Set(CATALOG.map((c) => c.group))];
  return (
    <details className="cp-menu" open={open} onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Show me how to…</summary>
      {groups.map((g) => (
        <div key={g} className="cp-menu__group">
          <span className="cp-menu__label">{g}</span>
          {CATALOG.filter((c) => c.group === g).map((c) => (
            <button key={c.id} type="button" className="cp-menu__item" onClick={() => onPick(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      ))}
    </details>
  );
}
