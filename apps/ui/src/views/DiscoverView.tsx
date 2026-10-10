/**
 * Create PRD: start from the problem. Choose Light Research (a fast, focused first-version plan) or Deep Research (a
 * workspace for stronger evidence), work through the steps at your own pace, and hand the approved PRD to New build.
 * Everything is saved on this machine as you go.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FOLLOW_UP_MAX, OPTIONAL_STEPS, discoveryStep, projectStages, stageOf, stagesFor, stepsFor, STATUS_LABEL, type ProjectStage, type BlockValue, type DiscoveryProject, type DiscoveryStage, type DiscoveryStep, type DiscoverySummary, type Row } from "@flowcode/contracts";
import { get, post, useResource } from "../api";
import { navigate } from "../router";
import { Empty, ErrorNotice, Icon, ago } from "../components/ui";
import { SkeletonBlock } from "../components/motion";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Markdown } from "../components/Markdown";
import { NEW_BUILD_PRD_KEY } from "../components/PrdTemplates";
import { Block, Disclosure, FieldInput } from "../components/discovery/Blocks";
import { RobotHead, ROLE_COLOR } from "../components/RobotHead";
import { VirtualInterviewsPanel, VirtualTestsPanel } from "../components/discovery/VirtualResearch";
import { Sparkles } from "lucide-react";
import { ViewLayoutToggle, useViewLayout } from "../components/ViewLayoutToggle";

interface View {
  project: DiscoveryProject;
  fitApproved: boolean;
  summary?: string;
  report?: string;
  affected?: string[];
}

const download = (filename: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** When "more detail" opens, bring the new fields into view and put the cursor in the first one, so it is clear what appeared. */
function revealMore(e: React.SyntheticEvent<HTMLDetailsElement>) {
  const d = e.currentTarget;
  if (!d.open) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    d.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    const first = d.querySelector<HTMLElement>(".disc-more__body textarea, .disc-more__body input, .disc-more__body select");
    first?.focus({ preventScroll: true });
  });
}

export function DiscoverView({ id }: { id?: string }) {
  if (id === "new") return <StartResearch />;
  if (id) return <Workspace key={id} id={id} />;
  return <DiscoveryList />;
}

// ───────────────────────── Start ─────────────────────────

/** Set by the start screen so the new project asks its first follow-up without a click. */
const AUTO_ASK_KEY = "fc.discover.autoAsk";

/** One flow: describe the problem and start. Deeper research is added per stage when the idea needs it. */
function StartResearch() {
  const [problem, setProblem] = useState("");
  const [thorough, setThorough] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const start = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const v = await post<View>("/discovery", { problem, research: thorough ? OPTIONAL_STEPS : [] });
      try {
        sessionStorage.setItem(AUTO_ASK_KEY, v.project.id);
      } catch {
        /* storage unavailable: the questions start when asked */
      }
      navigate(`/discover/${v.project.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="page disc-page">
      <header className="disc-hero">
        <span className="label">Create PRD</span>
        <h1 className="page__title">What problem do you want to solve?</h1>
        <p className="disc-lede">Describe the difficulty, not the app. FlowCode asks a few questions, then drafts a focused PRD you can build a prototype from.</p>
      </header>
      {error ? <ErrorNotice error={error} doing="start your research" /> : null}
      <form className="disc-start" onSubmit={(e) => (e.preventDefault(), void start())}>
        <label className="disc-field">
          <span className="disc-field__label">The problem</span>
          <span className="disc-field__hint" id="start-hint">
            Who has it, and what makes it hard? For example: &ldquo;Busy parents can&apos;t tell which brands are non-GMO while shopping.&rdquo;
          </span>
          <textarea className="textarea" data-cp="prd-problem" rows={4} value={problem} aria-describedby="start-hint" autoFocus onChange={(e) => setProblem(e.target.value)} />
        </label>
        <label className="disc-start__thorough">
          <input type="checkbox" checked={thorough} onChange={(e) => setThorough(e.target.checked)} />
          <span>
            <strong>Research this thoroughly</strong>
            <span>Adds users and evidence, alternatives, interviews, risks and testing from the start. Leave it off to begin with a focused plan; you can add any of these later.</span>
          </span>
        </label>
        <div className="disc-actions">
          <button type="submit" className="btn btn--primary" data-cp="prd-start" disabled={busy || !problem.trim()}>
            {busy ? "Starting…" : "Start"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ───────────────────────── Agents ─────────────────────────

/** The agent that writes each step: the Planner plans, the Researcher looks at people and evidence, the Critic reviews. */
const STEP_AGENT: Record<string, "planner" | "researcher" | "critic"> = {
  l_problem: "planner", l_draft: "planner", l_fit: "planner", l_summary: "critic", l_prd: "planner",
  d_problem: "planner", d_brief: "planner", d_users: "researcher", d_journey: "researcher", d_ledger: "researcher", d_market: "researcher", d_perspectives: "researcher", d_interviews: "researcher",
  d_options: "planner", d_fit: "planner", d_risks: "critic", d_tests: "critic", d_experiments: "planner", d_report: "critic", d_prd: "planner",
};
/** Extra parts some sections offer once drafted, beyond their blocks. */
const EXTRA_PARTS: Record<string, Array<{ label: string; detail: string; after: string }>> = {
  d_interviews: [{ after: "followUps", label: "Virtual interviews", detail: "four AI-simulated participants answer your questions, then a summary of themes and what to check with real people" }],
  d_tests: [{ after: "virtual", label: "Virtual user testing", detail: "four AI-simulated participants try each task and say where they hesitated" }],
};

/** "What you'll get here": the section's parts, read from its blocks, shown until it is drafted. */
function WhatYouGet({ step }: { step: DiscoveryStep }) {
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const parts = step.blocks
    .filter((b) => b.id !== "redirect")
    .map((b) => {
      const names = b.kind === "fields" ? (b.keys ?? []).map((k) => k.label) : b.kind === "table" ? (b.columns ?? []).map((c) => c.label) : [];
      const detail = names.length ? `${names.slice(0, 4).map(lower).join(", ")}${names.length > 4 ? " and more" : ""}` : b.hint ? lower(b.hint.replace(/\.$/, "")) : "";
      return { id: b.id, label: b.label, detail, yours: !!b.manual };
    });
  // Extra parts (the virtual sessions) sit right after the block they follow on the page.
  const list = parts.flatMap((x) => [x, ...(EXTRA_PARTS[step.id] ?? []).filter((e) => e.after === x.id).map((e) => ({ id: e.label, label: e.label, detail: e.detail, yours: false }))]);
  if (!list.length) return null;
  return (
    <div className="disc-preview">
      <p className="disc-preview__title">What you&apos;ll get here</p>
      <ul className="disc-preview__list">
        {list.map((x) => (
          <li key={x.label}>
            <strong>{x.label}</strong>
            {x.yours ? <span className="disc-preview__yours">You add this</span> : null}
            {x.detail ? <span className="disc-preview__detail">{x.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const strList = (v: BlockValue | undefined) => (Array.isArray(v) ? (v as Array<string | Row>).filter((x): x is string => typeof x === "string") : []);
const rowList = (v: BlockValue | undefined) => (Array.isArray(v) ? (v as Array<string | Row>).filter((x): x is Row => typeof x === "object") : []);
const AGENT_NAME = { planner: "Planner", researcher: "Researcher", critic: "Critic" } as const;

function AgentBadge({ role, working, id }: { role: keyof typeof AGENT_NAME; working?: boolean; id: string }) {
  return (
    <span className="disc-agent" title={`The ${AGENT_NAME[role]} agent ${working ? "is working on this" : "does this"}`}>
      {/* Working: the same sweeping progress bar the Agents map shows over a working agent's head. */}
      <span className="disc-agent__head">
        {working ? <span className="disc-agent__bar" aria-hidden="true" /> : null}
        <RobotHead color={ROLE_COLOR[role] ?? "#9a9fd6"} id={`disc-${role}-${id}`} size={32} className={working ? "robot-head--working" : undefined} />
      </span>
      <span className="disc-agent__name">{AGENT_NAME[role]}</span>
    </span>
  );
}

// ───────────────────────── List ─────────────────────────

/** A research card's actions, in a "⋯" menu at its top right (the list layout shows it at the row's end). */
function DiscMenu({ title, disabled, items }: { title: string; disabled: boolean; items: Array<{ label: string; icon: string; danger?: boolean; run: () => void }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("mousedown", close);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("mousedown", close);
      removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="disc-menu" ref={ref}>
      <button type="button" className="proj-actions__btn" aria-label={`Actions for ${title}`} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div className="ctx-menu proj-actions__menu" role="menu" aria-label={`${title} actions`}>
          <div className="ctx-menu__group">
            {items.map((it) => (
              <button key={it.label} role="menuitem" className={`ctx-menu__item${it.danger ? " ctx-menu__item--danger" : ""}`} onClick={() => (setOpen(false), it.run())}>
                <Icon name={it.icon as never} size={16} /> {it.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DiscoveryList() {
  const { data, error, reload } = useResource<DiscoverySummary[]>("/discovery", []);
  const [deleting, setDeleting] = useState<DiscoverySummary>();
  const [renaming, setRenaming] = useState<{ id: string; title: string }>();
  const [busy, setBusy] = useState<string>();
  const [layout, setLayout] = useViewLayout("discover");
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      reload();
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div className="page disc-page">
      <header className="disc-hero disc-hero--row">
        <div>
          <span className="label">Work</span>
          <h1 className="page__title">Create PRD</h1>
          <p className="disc-lede">Start from the problem, not the app. FlowCode researches it with you and writes a focused PRD for the real product; approve it and build a clickable prototype from it. Your research is saved on this computer.</p>
        </div>
        <button type="button" className="btn btn--primary" data-cp="prd-new" onClick={() => navigate("/discover/new")}>
          <Icon name="plus" size={14} /> New PRD
        </button>
      </header>
      {error ? <ErrorNotice error={error} doing="load your research" onRetry={reload} /> : null}
      {!data && !error ? <SkeletonBlock rows={4} label="Loading your research" /> : null}
      {data && !data.length ? (
        <Empty title="No PRDs yet" action={<button className="btn btn--primary" onClick={() => navigate("/discover/new")}>New PRD</button>}>
          Start with the problem, not the app. FlowCode helps you find who has it, what makes it hard, and the smallest first version worth building, then writes the PRD.
        </Empty>
      ) : null}
      {data?.length ? (
        <div className="disc-projects__bar">
          <span className="muted">{data.length} {data.length === 1 ? "problem" : "problems"}</span>
          <ViewLayoutToggle layout={layout} setLayout={setLayout} label="Show research as" />
        </div>
      ) : null}
      {data?.length ? (
        <ul className={`disc-projects disc-projects--${layout}`}>
          {data.map((d) => (
            <li key={d.id} className="disc-project">
              <button type="button" className="disc-project__open" onClick={() => navigate(`/discover/${d.id}`)}>
                <span className={`disc-status-badge disc-status-badge--${d.status}`}>{STATUS_LABEL[d.status]}</span>
                <span className="disc-project__title">{d.title}</span>
                <span className="disc-project__meta">
                  {d.mode === "light" ? <span className="disc-mode-tag disc-mode-tag--light">Light Research</span> : null}
                  {d.stepsDone} of {d.stepsTotal} stages · updated {ago(d.updatedAt)}
                </span>
                <span className="disc-progress" aria-hidden="true">
                  <span style={{ width: `${Math.round((d.stepsDone / Math.max(1, d.stepsTotal)) * 100)}%` }} />
                </span>
              </button>
              <DiscMenu
                title={d.title}
                disabled={busy === d.id}
                items={[
                  { label: "Rename", icon: "edit", run: () => setRenaming({ id: d.id, title: d.title }) },
                  { label: "Duplicate", icon: "copy", run: () => void act(d.id, () => post(`/discovery/${d.id}/duplicate`)) },
                  { label: "Export", icon: "file", run: () => void act(d.id, async () => { const r = await get<{ filename: string; markdown: string }>(`/discovery/${d.id}/export`); download(r.filename, r.markdown); }) },
                  { label: "Delete…", icon: "trash", danger: true, run: () => setDeleting(d) },
                ]}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {renaming ? (
        <ConfirmDialog title="Rename this research" confirmLabel="Save name" onCancel={() => setRenaming(undefined)} onConfirm={() => void act(renaming.id, () => post(`/discovery/${renaming.id}/rename`, { title: renaming.title })).then(() => setRenaming(undefined))}>
          <label className="disc-field">
            <span className="disc-field__label">Name</span>
            <input className="input" value={renaming.title} autoFocus onChange={(e) => setRenaming({ ...renaming, title: e.target.value })} />
          </label>
        </ConfirmDialog>
      ) : null}
      {deleting ? (
        <ConfirmDialog title={`Delete "${deleting.title}"?`} confirmLabel="Delete research" onCancel={() => setDeleting(undefined)} onConfirm={() => void act(deleting.id, () => post(`/discovery/${deleting.id}/delete`)).then(() => setDeleting(undefined))}>
          Your answers, summaries and PRD versions for this research are removed from this machine. Export it first if you want a copy. Builds you already started are not affected.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

// ───────────────────────── Workspace ─────────────────────────

function stepState(p: DiscoveryProject, s: DiscoveryStep): "done" | "stale" | "approved" | "todo" {
  const o = p.outputs[s.id];
  if (o?.stale) return "stale";
  if (s.gate) return o?.approvedAt ? "approved" : "todo";
  if (s.special === "prd") return p.prds.some((d) => d.status === "approved") ? "approved" : p.prds.length ? "done" : "todo";
  if (s.special === "build") return p.handoff ? "done" : "todo";
  if (o?.data && Object.keys(o.data).length) return "done";
  return !s.prompt && s.fields.length && p.inputs[s.id] ? "done" : "todo";
}

function stageState(p: DiscoveryProject, stage: DiscoveryStage): "done" | "stale" | "approved" | "todo" | "optional" {
  if (!stage.steps.length) return "optional";
  const states = stage.steps.map((sid) => stepState(p, discoveryStep(sid)!));
  if (states.includes("stale")) return "stale";
  if (states.every((s) => s === "done" || s === "approved")) return states.includes("approved") ? "approved" : "done";
  return "todo";
}

function Workspace({ id }: { id: string }) {
  const [view, setView] = useState<View>();
  const [error, setError] = useState<string>();
  const [affected, setAffected] = useState<string[]>([]);
  const load = useCallback(async () => {
    try {
      setView(await get<View>(`/discovery/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  const apply = (v: View) => {
    setView(v);
    if (v.affected?.length) setAffected(v.affected);
  };
  if (error && !view) return <div className="page"><ErrorNotice error={error} doing="open this research" onRetry={() => void load()} /></div>;
  if (!view) return <div className="page"><SkeletonBlock rows={6} label="Opening your research" /></div>;
  const p = view.project;
  const stages = projectStages(p);
  const stageId = stageOf(p.mode, p.currentStep).id;
  const stage = stages.find((st) => st.id === stageId) ?? stages[0];
  const idx = stages.indexOf(stage);
  // Navigation opens a stage by its first section, added or not (an optional stage opens on its add-research card).
  const go = (st: DiscoveryStage) => stagesFor(p.mode).find((x) => x.id === st.id)!.steps[0];
  const open = async (stepId: string) => {
    apply(await post<View>(`/discovery/${id}/open`, { stepId }));
    requestAnimationFrame(() => document.getElementById("disc-step-title")?.focus());
  };
  return (
    <div className="page disc-page disc-ws">
      <header className="disc-ws__head">
        <div>
          <button type="button" className="link-btn" onClick={() => navigate("/discover")}>
            ← Create PRD
          </button>
          <h1 className="disc-ws__title">{p.title}</h1>
          <p className="disc-ws__meta">
            {p.mode === "light" ? <span className="disc-mode-tag disc-mode-tag--light">Light Research</span> : null}
            {STATUS_LABEL[p.status]} · saved {ago(p.updatedAt)}
          </p>
        </div>
        <div className="disc-actions">
          {p.mode === "light" ? <GoDeeper id={id} onDone={(v) => apply(v)} /> : null}
          <button type="button" className="btn btn--sm" onClick={async () => { const r = await get<{ filename: string; markdown: string }>(`/discovery/${id}/export`); download(r.filename, r.markdown); }}>
            Export
          </button>
        </div>
      </header>
      <div className="disc-ws__body">
        <nav className="disc-steps" aria-label="Research stages" data-cp="prd-stages">
          <p className="disc-steps__count">
            Stage {idx + 1} of {stages.length}
          </p>
          <ol>
            {stages.map((st, i) => {
              const state = stageState(p, st);
              return (
                <li key={st.id}>
                  <button type="button" data-stage={st.id} data-optional={state === "optional" ? "true" : undefined} className={`disc-step disc-step--${state}${st.id === stage.id ? " is-current" : ""}`} aria-current={st.id === stage.id ? "step" : undefined} onClick={() => void open(go(st))}>
                    <span className="disc-step__n" aria-hidden="true">
                      {state === "done" || state === "approved" ? <Icon name="check" size={12} /> : i + 1}
                    </span>
                    <span className="disc-step__name">
                      {st.name}
                      {state === "stale" ? <span className="disc-step__flag">May need review</span> : state === "optional" ? <span className="disc-step__flag disc-step__flag--optional">Optional research</span> : null}
                    </span>
                    {state === "approved" ? <span className="sr-only"> (approved)</span> : state === "done" ? <span className="sr-only"> (done)</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="disc-steps__note">FlowCode drafts each stage for you. Edit anything, or add detail and draft it again.</p>
        </nav>
        <main className="disc-main" aria-labelledby="disc-step-title" data-cp={`prd-on-${stage.id}`}>
          {affected.length ? <AffectedNotice id={id} view={view} affected={affected} onDone={(v) => (setView(v), setAffected([]))} onReview={(s) => (setAffected([]), void open(s))} /> : null}
          <StageView key={stage.id + p.mode} view={view} stage={stage} onView={apply} onOpen={(s) => void open(s)} prev={stages[idx - 1]} next={stages[idx + 1]} go={go} />
        </main>
      </div>
    </div>
  );
}

/** One stage: its sections on one page, one action that drafts them all, and the stage-to-stage navigation. */
function StageView({ view, stage, onView, onOpen, prev, next, go }: { view: View; stage: ProjectStage; onView: (v: View) => void; onOpen: (stepId: string) => void; prev?: DiscoveryStage; next?: DiscoveryStage; go: (st: DiscoveryStage) => string }) {
  const p = view.project;
  const steps = stage.steps.map((s) => discoveryStep(s)!);
  const multi = steps.length > 1 || (!steps.length && stage.addable.length > 0);
  const [progress, setProgress] = useState<string>();
  const [working, setWorking] = useState<string>();
  const [error, setError] = useState<string>();
  const flushers = useRef(new Map<string, () => Promise<void>>());
  const gate = steps.find((s) => s.gate);
  const gateOpen = gate ? !(p.outputs[gate.id]?.approvedAt && !p.outputs[gate.id]?.stale) : false;
  const problem = (p.inputs.l_problem?.problem ?? p.inputs.d_problem?.problem ?? "") as string;
  const draft = async () => {
    setError(undefined);
    // Save what was typed first, so the draft uses it.
    for (const f of flushers.current.values()) await f();
    let v = view;
    const chain = stage.draft ?? [];
    for (const [n, sid] of chain.entries()) {
      const s = discoveryStep(sid)!;
      setProgress(`${AGENT_NAME[STEP_AGENT[sid] ?? "planner"]} is drafting ${n + 1} of ${chain.length}: ${s.name}`);
      setWorking(sid);
      try {
        v = await post<View>(`/discovery/${p.id}/generate`, { stepId: sid });
        onView(v);
      } catch (e) {
        setError(`${s.name}: ${(e as Error).message.replace(/^HTTP \d+:\s*/, "")}`);
        setProgress(undefined);
        setWorking(undefined);
        return;
      }
    }
    setProgress(undefined);
    setWorking(undefined);
    if (stage.then && stage.then !== stage.id) onOpen(stage.then);
  };
  const needsProblem = !!stage.draft?.length && !problem.trim() && stage.steps.some((s) => s === "l_problem" || s === "d_problem");
  return (
    <article className="disc-step-panel">
      {multi ? (
        <header className="disc-step-panel__head">
          <h2 id="disc-step-title" tabIndex={-1}>
            {stage.name}
          </h2>
        </header>
      ) : null}
      {steps.map((s) => (
        <StepPanel key={s.id} view={view} step={s} onView={onView} onOpen={onOpen} embedded={multi} inDraft={!!stage.draft?.includes(s.id)} register={(fn) => flushers.current.set(s.id, fn)} />
      ))}
      {stage.addable.length && p.mode === "deep" ? <AddResearch view={view} stage={stage} onView={onView} empty={!steps.length} /> : null}
      {stage.draft?.length ? (
        <div className="disc-generate disc-stage-draft">
          {/* The Planner agent drafts the plan; its head animates while it works. */}
          <AgentBadge role={(working && STEP_AGENT[working]) || STEP_AGENT[stage.draft[0]] || "planner"} working={!!progress} id={stage.id} />
          <button type="button" className="btn btn--primary disc-ai-btn" data-cp="prd-draft" disabled={!!progress || needsProblem} onClick={() => void draft()}>
            <Sparkles size={15} aria-hidden="true" />
            {progress ? "Drafting…" : stage.steps.every((s) => p.outputs[s]?.data) ? "Draft this stage again" : stage.draftLabel ?? "Draft this stage"}
          </button>
          {progress ? <span className="disc-wait" role="status">{progress}. On a local model each part takes a few seconds.</span> : needsProblem ? <span className="disc-wait">Describe the problem first.</span> : <span className="disc-wait">{stage.draft.length > stage.steps.length ? `FlowCode drafts ${stage.draft.length} sections in a row, then stops for you to review and approve how the solution fits the problem.` : `FlowCode drafts the ${stage.draft.length} sections on this page.`}</span>}
        </div>
      ) : null}
      {error ? <p className="notice notice--bad" role="alert">{error}</p> : null}
      <footer className="disc-nav">
        {prev ? (
          <button type="button" className="btn btn--ghost" onClick={() => onOpen(go(prev))}>
            Back
          </button>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={async () => { for (const f of flushers.current.values()) await f(); navigate("/discover"); }}>
          Save and exit
        </button>
        {next ? (
          <button type="button" className="btn btn--primary disc-nav__next" data-cp="prd-continue" disabled={gateOpen} title={gateOpen ? "Approve the map first" : undefined} onClick={async () => { for (const f of flushers.current.values()) await f(); onOpen(go(next)); }}>
            Continue: {next.name}
          </button>
        ) : null}
      </footer>
    </article>
  );
}

/**
 * Research a stage can add: pick sections, or add everything. Each comes in undrafted, with what it will hold and its
 * own draft button; the stage's draft button drafts them all.
 */
function AddResearch({ view, stage, onView, empty }: { view: View; stage: ProjectStage; onView: (v: View) => void; empty: boolean }) {
  const p = view.project;
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const current = p.research ?? OPTIONAL_STEPS;
  const add = async (ids: string[]) => {
    setBusy(true);
    setError(undefined);
    try {
      onView(await post<View>(`/discovery/${p.id}/research`, { research: [...current, ...ids] }));
      setPicked([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const allLeft = OPTIONAL_STEPS.filter((x) => !current.includes(x));
  return (
    <section className={`disc-addr${empty ? " disc-addr--empty" : ""}`} aria-labelledby={`addr-${stage.id}`}>
      <h3 id={`addr-${stage.id}`} className="disc-addr__title">
        {empty ? "Add research to this stage" : "More research you can add here"}
      </h3>
      <p className="disc-addr__lede">
        {empty ? "This stage is optional. Your plan works without it; add it when the idea is bigger, the demand is unclear, or mistakes would be costly." : "Optional sections for this stage. Add them when the idea needs more evidence."}
      </p>
      <ul className="disc-addr__list">
        {stage.addable.map((sid) => {
          const st = discoveryStep(sid)!;
          return (
            <li key={sid}>
              <label className="disc-addr__item">
                <input type="checkbox" checked={picked.includes(sid)} onChange={(e) => setPicked(e.target.checked ? [...picked, sid] : picked.filter((x) => x !== sid))} />
                <span>
                  <strong>{st.title}</strong>
                  <span>{st.copy}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
      <div className="disc-actions">
        <button type="button" className="btn btn--sm btn--primary" disabled={busy || !picked.length} onClick={() => void add(picked)}>
          {busy ? "Adding…" : picked.length ? `Add ${picked.length} section${picked.length === 1 ? "" : "s"}` : "Choose sections to add"}
        </button>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void add(stage.addable)}>
          Add all {stage.addable.length} here
        </button>
        {allLeft.length > stage.addable.length ? (
          <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void add(allLeft)}>
            Research this thoroughly (all {allLeft.length})
          </button>
        ) : null}
      </div>
    </section>
  );
}

function GoDeeper({ id, onDone }: { id: string; onDone: (v: View) => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--sm" onClick={() => setAsking(true)}>
        Add research
      </button>
      {asking ? (
        <ConfirmDialog
          title="Add research to this idea?"
          confirmLabel="Switch to the full flow"
          busy={busy}
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              onDone(await post<View>(`/discovery/${id}/upgrade`));
              setAsking(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          Everything you wrote stays. This older Light project moves to the full flow, where each stage can add research: users and evidence, alternatives, interviews, risks and testing. Your problem, assumptions and solution are carried over; review them when you reach those stages.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

/** Takes an optional section out of the plan; its work is kept and returns if it is added again. */
function RemoveResearch({ view, stepId, onView }: { view: View; stepId: string; onView: (v: View) => void }) {
  const p = view.project;
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--sm btn--ghost disc-section-remove"
      disabled={busy}
      title="Take this research out of your plan. Anything written here is kept if you add it again."
      onClick={async () => {
        setBusy(true);
        try {
          onView(await post<View>(`/discovery/${p.id}/research`, { research: (p.research ?? OPTIONAL_STEPS).filter((x) => x !== stepId) }));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Removing…" : "Remove section"}
    </button>
  );
}

function AffectedNotice({ id, view, affected, onDone, onReview }: { id: string; view: View; affected: string[]; onDone: (v: View) => void; onReview: (stepId: string) => void }) {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const steps = stepsFor(view.project.mode);
  const names = affected.map((a) => steps.find((s) => s.id === a)?.name).filter(Boolean);
  const update = async () => {
    setError(undefined);
    let v = view;
    for (const a of affected) {
      const s = steps.find((x) => x.id === a);
      if (!s || (!s.prompt && s.special !== "prd")) continue;
      if ((s.special === "prd" || s.gate || s.id === "l_summary" || s.special === "report") && !v.fitApproved && s.gate !== true) continue;
      setBusy(s.name);
      try {
        v = await post<View>(`/discovery/${id}/generate`, { stepId: a });
      } catch (e) {
        setError(`${s.name}: ${(e as Error).message}`);
        break;
      }
    }
    setBusy(undefined);
    onDone(v);
  };
  return (
    <div className="disc-notice" role="status">
      <p>
        <strong>Changing this may affect later steps:</strong> {names.join(", ")}. Your earlier versions are kept until you choose.
      </p>
      {error ? <p className="disc-notice__err">{error}</p> : null}
      <div className="disc-actions">
        <button type="button" className="btn btn--sm btn--primary" disabled={!!busy} onClick={() => void update()}>
          {busy ? `Updating ${busy}…` : "Update related sections"}
        </button>
        <button type="button" className="btn btn--sm" disabled={!!busy} onClick={async () => onDone(await post<View>(`/discovery/${id}/keep`, { stepIds: affected }))}>
          Keep current version for now
        </button>
        <button type="button" className="btn btn--sm btn--ghost" disabled={!!busy} onClick={() => onReview(affected[0])}>
          Review changes first
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── One step ─────────────────────────

type Inputs = Record<string, string | string[]>;

function StepPanel({ view, step, onView, onOpen, embedded, inDraft, register }: { view: View; step: DiscoveryStep; onView: (v: View) => void; onOpen: (stepId: string) => void; embedded?: boolean; inDraft?: boolean; register?: (flush: () => Promise<void>) => void }) {
  const p = view.project;
  const id = p.id;
  const [draft, setDraft] = useState<Inputs>(() => ({ ...(p.inputs[step.id] ?? {}) }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<{ text: string; details?: string }>();
  const timer = useRef<number | undefined>(undefined);
  const out = p.outputs[step.id];
  const needsFit = (step.special && step.special !== "build" ? true : false) && !view.fitApproved && ["l_summary", "l_prd", "d_report", "d_prd"].includes(step.id);

  // Autosave answers shortly after typing stops.
  const flush = useCallback(
    async (values: Inputs) => {
      setSaveState("saving");
      try {
        const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v.filter((x) => x.trim()) : v]));
        onView(await post<View>(`/discovery/${id}/inputs`, { stepId: step.id, values: clean }));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [id, step.id, onView],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // The stage saves every section's typing before it drafts or moves on.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    register?.(async () => {
      window.clearTimeout(timer.current);
      if (step.fields.length) await flush(draftRef.current);
    });
  }, [register, flush, step.fields.length]);
  const change = (fid: string, v: string | string[]) => {
    const nextDraft = { ...draft, [fid]: v };
    setDraft(nextDraft);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(nextDraft), 700);
  };

  const run = async (label: string, fn: () => Promise<View>) => {
    setBusy(label);
    setError(undefined);
    try {
      window.clearTimeout(timer.current);
      if (step.fields.length) await flush(draft);
      onView(await fn());
    } catch (e) {
      const msg = (e as Error).message;
      setError({ text: /model|provider|fetch|timeout|ECONN|abort/i.test(msg) ? "FlowCode couldn't reach your local model, so nothing was written. Your answers are saved. Check that your local models are running, then try again." : msg.replace(/^HTTP \d+:\s*/, ""), details: msg });
    } finally {
      setBusy(undefined);
    }
  };
  const generate = () => run("generate", () => post<View>(`/discovery/${id}/generate`, { stepId: step.id }));
  const saveBlock = async (blockId: string, value: BlockValue) => {
    await run("save", () => post<View>(`/discovery/${id}/output`, { stepId: step.id, data: { [blockId]: value } }));
  };
  const approve = () => run("approve", () => post<View>(`/discovery/${id}/approve`, { stepId: step.id }));
  const hasOutput = !!out?.data && Object.keys(out.data).length > 0;
  const required = step.fields.filter((f) => f.required);
  const missing = required.filter((f) => {
    const v = draft[f.id];
    return Array.isArray(v) ? !v.some((x) => x.trim()) : !String(v ?? "").trim();
  });
  const solutionFirst = step.id === "l_problem" || step.id === "d_problem" ? String(out?.data?.redirect ?? "").trim() : "";

  return (
    <article className="disc-step-panel">
      <header className="disc-step-panel__head">
        {embedded ? (
          <div className="disc-section-head">
            <h3 className="disc-section-title">{step.title}</h3>
            {p.mode === "deep" && OPTIONAL_STEPS.includes(step.id) ? <RemoveResearch view={view} stepId={step.id} onView={onView} /> : null}
          </div>
        ) : (
          <h2 id="disc-step-title" tabIndex={-1}>
            {step.title}
          </h2>
        )}
        <p className="disc-lede">{step.copy}</p>
        {out?.stale ? <p className="disc-stale">An earlier answer changed after this was written. Review it, or generate it again.</p> : null}
      </header>
      {step.disclosure ? <Disclosure /> : null}

      {step.fields.length ? (
        <form className="disc-form" onSubmit={(e) => (e.preventDefault(), step.prompt && !inDraft ? void generate() : undefined)}>
          {step.fields.filter((f) => f.required).map((f) => (
            <FieldInput key={f.id} f={f} value={draft[f.id]} idPrefix={step.id} onChange={(v) => change(f.id, v)} />
          ))}
          {step.fields.some((f) => !f.required) ? (
            <details className="disc-more" open={step.fields.every((f) => !f.required) && !hasOutput && !inDraft} onToggle={revealMore}>
              <summary>{hasOutput ? "Add detail and draft again (optional)" : "Add more detail (optional)"}</summary>
              <div className="disc-more__body">
                {step.fields.filter((f) => !f.required).map((f) => (
                  <FieldInput key={f.id} f={f} value={draft[f.id]} idPrefix={step.id} onChange={(v) => change(f.id, v)} />
                ))}
              </div>
            </details>
          ) : null}
          <p className="disc-save" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved on this machine" : saveState === "error" ? "Couldn't save just now. Your typing is kept here; it will try again when you continue." : ""}
          </p>
        </form>
      ) : null}

      {step.followUps ? <FollowUps view={view} step={step} onView={onView} flushProblem={async () => { window.clearTimeout(timer.current); await flush(draftRef.current); }} /> : null}
      {needsFit ? (
        <div className="disc-gate-note" role="note">
          <p>First review and approve how the solution connects to your problem. The plan builds on it.</p>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => onOpen(p.mode === "deep" ? "d_fit" : "l_fit")}>
            Review the problem-to-solution map
          </button>
        </div>
      ) : null}

      {step.special === "build" ? <BuildStep view={view} onOpen={onOpen} /> : null}
      {step.special === "prd" && !needsFit ? <PrdStep view={view} step={step} onView={onView} onOpen={onOpen} /> : null}

      {/* Not drafted yet: say what this section will hold, and let it be drafted on its own. */}
      {step.prompt && !needsFit && !hasOutput ? <WhatYouGet step={step} /> : null}
      {step.prompt && !needsFit ? (
        <div className="disc-generate">
          <AgentBadge role={STEP_AGENT[step.id] ?? "planner"} working={busy === "generate"} id={step.id} />
          <button type="button" className={`btn ${hasOutput ? "" : "btn--primary"} disc-ai-btn`} disabled={!!busy || missing.length > 0} onClick={() => void generate()}>
            <Sparkles size={15} aria-hidden="true" />
            {busy === "generate" ? "Writing…" : hasOutput ? "Write it again" : step.generateLabel ?? "Generate"}
          </button>
          {busy === "generate" ? <span className="disc-wait" role="status">The {AGENT_NAME[STEP_AGENT[step.id] ?? "planner"]} is writing this with your local model. This can take a minute.</span> : null}
          {missing.length && !busy ? <span className="disc-wait">Answer &quot;{missing[0].label}&quot; first.</span> : null}
        </div>
      ) : null}

      {error ? (
        <div className="notice notice--bad" role="alert">
          <p style={{ margin: 0 }}>{error.text}</p>
          {error.details && error.details !== error.text ? (
            <details>
              <summary>View details</summary>
              <pre className="disc-details">{error.details}</pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {solutionFirst ? (
        <div className="disc-redirect" role="note">
          <p>{solutionFirst}</p>
          <button type="button" className="btn btn--sm" onClick={() => document.getElementById(`${step.id}-problem`)?.focus()}>
            Describe the problem
          </button>
        </div>
      ) : null}

      {hasOutput && step.blocks.length ? (
        <div className="disc-blocks">
          {step.confirm ? <p className="disc-confirm">{step.confirm}</p> : null}
          {step.blocks
            .filter((b) => !(b.id === "redirect"))
            .map((b) => (
              <Fragment key={b.id}>
                {/* Virtual interviews sit after the interview plan, before the real findings they must never mix with. */}
                {step.id === "d_interviews" && b.id === "findings" ? <VirtualInterviewsPanel view={view} onView={onView} agent={<AgentBadge role="researcher" id="vi" />} questions={[...strList(out!.data.screening), ...strList(out!.data.questions)]} /> : null}
                <Block b={b} v={out!.data[b.id]} busy={!!busy} onSave={(v) => saveBlock(b.id, v)} />
                {/* Virtual user testing follows the one-shot simulated review. */}
                {step.id === "d_tests" && b.id === "virtual" ? <VirtualTestsPanel view={view} onView={onView} agent={<AgentBadge role="critic" id="vt" />} tasks={rowList(out!.data.tasks).map((r) => String(r.task ?? "")).filter(Boolean)} /> : null}
              </Fragment>
            ))}
        </div>
      ) : null}

      {step.special === "summary" && view.summary && !needsFit ? <SummaryDoc view={view} onOpen={onOpen} onView={onView} /> : null}
      {step.special === "report" && view.report && !needsFit && hasOutput ? <ReportDoc view={view} onOpen={onOpen} onView={onView} /> : null}

      {step.gate && hasOutput ? (
        <div className="disc-gate">
          {out?.approvedAt && !out.stale ? <p className="disc-approved">Approved {ago(out.approvedAt)}. Later steps build on this map.</p> : <p>Review this map. Later steps build on it once you approve it.</p>}
          <div className="disc-actions">
            {(step.gateActions ?? []).map((a) =>
              a.goTo ? (
                <button key={a.label} type="button" className="btn btn--sm" onClick={() => onOpen(a.goTo!)}>
                  {a.label}
                </button>
              ) : (
                <button key={a.label} type="button" className="btn btn--sm btn--primary" disabled={!!busy || (!!out?.approvedAt && !out.stale)} onClick={() => void approve()}>
                  {busy === "approve" ? "Approving…" : a.label}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}

    </article>
  );
}

/**
 * Follow-ups after the open answer: FlowCode reasons about the problem and asks the one question that would most
 * change the plan, with answers to tap. Up to three, one at a time; the person can skip or draft at any point.
 */
function FollowUps({ view, step, onView, flushProblem }: { view: View; step: DiscoveryStep; onView: (v: View) => void; flushProblem: () => Promise<void> }) {
  const p = view.project;
  const list = p.followups?.[step.id] ?? [];
  const [busy, setBusy] = useState<"ask" | number>();
  const [error, setError] = useState<string>();
  const [own, setOwn] = useState("");
  const problem = String(p.inputs[step.id]?.problem ?? "").trim();
  const open = list.findIndex((q) => !q.answer && !q.skipped);
  const ask = async () => {
    setBusy("ask");
    setError(undefined);
    try {
      await flushProblem();
      onView(await post<View>(`/discovery/${p.id}/followup`, { stepId: step.id }));
    } catch (e) {
      setError((e as Error).message.replace(/^HTTP \d+:\s*/, ""));
    } finally {
      setBusy(undefined);
    }
  };
  // Coming from the start screen with the problem already written: ask the first question straight away.
  useEffect(() => {
    let flag: string | null = null;
    try {
      flag = sessionStorage.getItem(AUTO_ASK_KEY);
      if (flag === p.id) sessionStorage.removeItem(AUTO_ASK_KEY);
    } catch {
      /* storage unavailable */
    }
    if (flag === p.id && problem && !list.length) void ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const answer = async (index: number, value: string | null) => {
    setBusy(index);
    setError(undefined);
    try {
      const v = await post<View>(`/discovery/${p.id}/followup/answer`, { stepId: step.id, index, answer: value });
      onView(v);
      setOwn("");
      // Keep the conversation going until the last question.
      const asked = v.project.followups?.[step.id]?.length ?? 0;
      if (asked < FOLLOW_UP_MAX && index === asked - 1) {
        setBusy("ask");
        onView(await post<View>(`/discovery/${p.id}/followup`, { stepId: step.id }));
      }
    } catch (e) {
      setError((e as Error).message.replace(/^HTTP \d+:\s*/, ""));
    } finally {
      setBusy(undefined);
    }
  };
  if (!problem && !list.length) return null;
  return (
    <section className="disc-fu" aria-label="Follow-up questions">
      {list.map((q, i) => (
        <div key={i} className={`disc-fu__q${i === open ? " is-open" : ""}`}>
          <p className="disc-fu__ask">
            <span className="disc-fu__n">
              Question {i + 1} of {FOLLOW_UP_MAX}
            </span>
            {q.question}
          </p>
          {q.why ? <p className="disc-fu__why">Why I&apos;m asking: {q.why}</p> : null}
          {i === open ? (
            <>
              <div className="disc-fu__chips" role="group" aria-label="Suggested answers">
                {q.suggestions.map((sug) => (
                  <button key={sug} type="button" className="disc-fu__chip" disabled={busy !== undefined} onClick={() => void answer(i, sug)}>
                    {sug}
                  </button>
                ))}
              </div>
              <form className="disc-fu__own" onSubmit={(e) => (e.preventDefault(), own.trim() && void answer(i, own))}>
                <label className="sr-only" htmlFor={`fu-${step.id}-${i}`}>
                  Your own answer
                </label>
                <input id={`fu-${step.id}-${i}`} className="input" placeholder="Or type your own answer" value={own} onChange={(e) => setOwn(e.target.value)} />
                <button type="submit" className="btn btn--sm" disabled={!own.trim() || busy !== undefined}>
                  Answer
                </button>
                <button type="button" className="btn btn--sm btn--ghost" disabled={busy !== undefined} onClick={() => void answer(i, null)}>
                  Skip
                </button>
              </form>
            </>
          ) : (
            <p className="disc-fu__a">
              {q.skipped ? <span className="disc-empty">Skipped</span> : <>Your answer: {q.answer}</>}{" "}
              <button type="button" className="link-btn" onClick={() => onView({ ...view, project: { ...p, followups: { ...p.followups, [step.id]: list.map((x, n) => (n === i ? { ...x, answer: undefined, skipped: false } : x)) } } })}>
                Change
              </button>
            </p>
          )}
        </div>
      ))}
      {busy === "ask" ? (
        <div className="disc-generate" role="status">
          <AgentBadge role="planner" working id={`fu-${step.id}`} />
          <span className="disc-wait">The Planner is thinking about your problem…</span>
        </div>
      ) : null}
      {!list.length && busy !== "ask" ? (
        <div className="disc-fu__start">
          <AgentBadge role="planner" id={`fu-start-${step.id}`} />
          <button type="button" className="btn disc-ai-btn" onClick={() => void ask()}>
            <Sparkles size={15} aria-hidden="true" />
            Ask me a few questions
          </button>
          <span className="disc-wait">FlowCode thinks through your problem and asks a few quick questions with suggested answers. You can skip them and draft right away.</span>
        </div>
      ) : null}
      {list.length >= FOLLOW_UP_MAX && open < 0 ? <p className="disc-fu__done">Thanks. That&apos;s what FlowCode needs to draft your plan.</p> : null}
      {error ? <p className="notice notice--bad" role="alert">{error}</p> : null}
    </section>
  );
}

// ───────────────────────── Summary, report, PRD, build ─────────────────────────

/**
 * A document as pages, like a word processor: a cover page (title and the note about AI content), then one white page
 * per numbered section. Pages stay white in both themes, the way a document does.
 */
function DocPages({ source, label }: { source: string; label: string }) {
  const pages = useMemo(() => {
    const out: string[] = [];
    let cur: string[] = [];
    for (const line of source.split("\n")) {
      if (/^## /.test(line) && cur.some((l) => l.trim())) {
        out.push(cur.join("\n"));
        cur = [];
      }
      cur.push(line);
    }
    if (cur.some((l) => l.trim())) out.push(cur.join("\n"));
    return out;
  }, [source]);
  return (
    <div className="doc-desk" role="region" aria-label={label}>
      {pages.map((page, i) => (
        <section key={i} className={`doc-page${i === 0 ? " doc-page--cover" : ""}`} aria-label={i === 0 ? `${label}: cover` : `${label}: page ${i + 1}`}>
          <Markdown source={page} />
          <span className="doc-page__n" aria-hidden="true">
            {i + 1} / {pages.length}
          </span>
        </section>
      ))}
    </div>
  );
}


function SummaryDoc({ view, onOpen, onView }: { view: View; onOpen: (s: string) => void; onView: (v: View) => void }) {
  const id = view.project.id;
  return (
    <section className="disc-doc" aria-label="Your idea summary">
      <DocPages source={view.summary ?? ""} label="Idea summary" />
      <div className="disc-actions disc-doc__actions">
        <button type="button" className="btn btn--primary" onClick={() => onOpen("l_prd")}>
          Generate starter PRD
        </button>
        <button type="button" className="btn" onClick={() => onOpen("l_fit")}>
          Edit summary
        </button>
        <button type="button" className="btn" onClick={async () => { const v = await post<View>(`/discovery/${id}/upgrade`); onView(v); onOpen("d_interviews"); }}>
          Create interview questions
        </button>
        <button type="button" className="btn" onClick={async () => onView(await post<View>(`/discovery/${id}/upgrade`))}>
          Go deeper with this idea
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => download(`${view.project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-summary.md`, view.summary ?? "")}>
          Export summary
        </button>
      </div>
      <p className="disc-foot">Create interview questions opens Deep Research with your work carried over.</p>
    </section>
  );
}

function ReportDoc({ view, onOpen, onView }: { view: View; onOpen: (s: string) => void; onView: (v: View) => void }) {
  const p = view.project;
  const latest = p.reports.at(-1);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(latest?.markdown ?? view.report ?? "");
  const source = latest?.markdown ?? view.report ?? "";
  return (
    <section className="disc-doc" aria-label="Discovery report">
      <p className="disc-doc__ver">{latest ? `Report version ${latest.version}${latest.status === "approved" ? " (approved)" : ""}` : "Report preview"}</p>
      {editing ? (
        <>
          <textarea className="textarea disc-doc__edit" aria-label="Edit report" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="disc-actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={async () => (onView(await post<View>(`/discovery/${p.id}/doc`, { action: "edit", kind: "report", markdown: text })), setEditing(false))}>
              Save as a new version
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <DocPages source={source} label="Discovery report" />
      )}
      <div className="disc-actions disc-doc__actions">
        <button type="button" className="btn btn--primary" onClick={() => onOpen("d_prd")}>
          Generate full PRD
        </button>
        <button type="button" className="btn" onClick={() => (setText(source), setEditing(true))}>
          Edit report
        </button>
        <button type="button" className="btn" onClick={() => onOpen("d_interviews")}>
          Create interview guide
        </button>
        <button type="button" className="btn" onClick={() => onOpen("d_tests")}>
          Create usability test plan
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => download(`${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-report.md`, source)}>
          Export report
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onOpen("d_brief")}>
          Go back to research workspace
        </button>
      </div>
    </section>
  );
}

function PrdStep({ view, step, onView, onOpen }: { view: View; step: DiscoveryStep; onView: (v: View) => void; onOpen: (s: string) => void }) {
  const p = view.project;
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [chosen, setChosen] = useState<number>();
  const doc = useMemo(() => (chosen ? p.prds.find((d) => d.version === chosen) : p.prds.at(-1)), [p.prds, chosen]);
  const [text, setText] = useState(doc?.markdown ?? "");
  const deep = p.mode === "deep";
  const run = async (label: string, fn: () => Promise<View>) => {
    setBusy(label);
    setError(undefined);
    try {
      onView(await fn());
      setChosen(undefined);
    } catch (e) {
      setError((e as Error).message.replace(/^HTTP \d+:\s*/, ""));
    } finally {
      setBusy(undefined);
    }
  };
  const generate = () => run("generate", () => post<View>(`/discovery/${p.id}/generate`, { stepId: step.id }));
  if (!p.prds.length)
    return (
      <section className="disc-doc">
        <div className="disc-actions">
          <AgentBadge role="planner" working={!!busy} id={`prd-${p.id}`} />
          <button type="button" className="btn btn--primary disc-ai-btn" disabled={!!busy} onClick={() => void generate()}>
            <Sparkles size={15} aria-hidden="true" />
            {busy ? "Writing your PRD…" : step.generateLabel}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onOpen(deep ? "d_report" : "l_summary")}>
            Go back and edit {deep ? "report" : "summary"}
          </button>
        </div>
        {busy ? <p className="disc-wait" role="status">FlowCode is writing your PRD with your local model. This can take a few minutes.</p> : null}
        {error ? <p className="notice notice--bad" role="alert">{error}</p> : null}
      </section>
    );
  return (
    <section className="disc-doc" aria-label="Product requirements document">
      <div className="disc-doc__bar">
        <label className="disc-field disc-doc__versions">
          <span className="disc-field__label">Version</span>
          <select className="select" value={doc?.version} onChange={(e) => setChosen(Number(e.target.value))}>
            {[...p.prds].reverse().map((d) => (
              <option key={d.version} value={d.version}>
                Version {d.version}: {d.status === "approved" ? "approved" : d.status === "draft" ? "draft" : "earlier"} ({ago(d.createdAt)})
              </option>
            ))}
          </select>
        </label>
        <span className={`disc-status disc-status--${doc?.status}`}>{doc?.status === "approved" ? "Approved" : doc?.status === "draft" ? "Draft" : "Earlier version"}</span>
      </div>
      {error ? <p className="notice notice--bad" role="alert">{error}</p> : null}
      {editing ? (
        <>
          <textarea className="textarea disc-doc__edit" aria-label="Edit PRD" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="disc-actions">
            <button type="button" className="btn btn--primary btn--sm" disabled={!!busy} onClick={() => void run("edit", () => post<View>(`/discovery/${p.id}/doc`, { action: "edit", kind: "prd", markdown: text })).then(() => setEditing(false))}>
              Save as a new version
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <DocPages source={doc?.markdown ?? ""} label="Product requirements document" />
      )}
      <div className="disc-actions disc-doc__actions">
        {doc && doc.status !== "approved" ? (
          <button type="button" className="btn btn--primary" disabled={!!busy} onClick={() => void run("approve", () => post<View>(`/discovery/${p.id}/doc`, { action: "approve", kind: "prd", version: doc.version }))}>
            {busy === "approve" ? "Approving…" : "Approve this PRD"}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => onOpen(deep ? "d_build" : "l_build")}>
            Start a prototype
          </button>
        )}
        <button type="button" className="btn" onClick={() => (setText(doc?.markdown ?? ""), setEditing(true))}>
          Edit PRD
        </button>
        <button type="button" className="btn" disabled={!!busy} onClick={() => void generate()}>
          {busy === "generate" ? "Writing…" : "Write it again"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => download(`${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-prd-v${doc?.version}.md`, doc?.markdown ?? "")}>
          Export PRD
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onOpen(deep ? "d_brief" : "l_problem")}>
          Return to research
        </button>
      </div>
    </section>
  );
}

function BuildStep({ view, onOpen }: { view: View; onOpen: (s: string) => void }) {
  const p = view.project;
  const deep = p.mode === "deep";
  const approved = [...p.prds].reverse().find((d) => d.status === "approved");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const start = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const h = await post<{ prd: { name: string; content: string }; extra: { name: string; content: string }; description: string }>(`/discovery/${p.id}/handoff`);
      sessionStorage.setItem(NEW_BUILD_PRD_KEY, JSON.stringify({ name: h.prd.name, content: h.prd.content, extra: h.extra, description: h.description }));
      navigate("/");
      setTimeout(() => window.dispatchEvent(new CustomEvent("fc:new-build")), 300);
    } catch (e) {
      setError((e as Error).message.replace(/^HTTP \d+:\s*/, ""));
      setBusy(false);
    }
  };
  if (!approved)
    return (
      <div className="disc-gate-note" role="note">
        <p>Approve your PRD first. The prototype is built from the version you approved.</p>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => onOpen(deep ? "d_prd" : "l_prd")}>
          Review PRD
        </button>
      </div>
    );
  return (
    <section className="disc-build">
      <ul className="disc-list">
        <li>FlowCode opens New build with your approved PRD (version {approved.version}) and your {deep ? "discovery report" : "idea summary"} attached.</li>
        <li>FlowCode builds a clickable prototype from it: real screens, links and search, with simulated data and no backend, designed with your look. The PRD stays the spec for the real product.</li>
        <li>It writes the prototype plan from your PRD for you to approve, and builds the most important user flow first.</li>
        <li>Each planned step traces to a pain point, goal, accessibility need or necessary dependency. Anything else is flagged as possible scope creep.</li>
        <li>When you're ready to build the real product, the Launch readiness checklist lists what the prototype simulates or leaves out, each with a prompt for a coding agent.</li>
      </ul>
      {p.handoff ? <p className="disc-approved">A prototype was started from this research {ago(p.handoff.at)}.</p> : null}
      {error ? <p className="notice notice--bad" role="alert">{error}</p> : null}
      <div className="disc-actions">
        <button type="button" className="btn btn--primary" data-cp="prd-prototype" disabled={busy} onClick={() => void start()}>
          {busy ? "Opening New build…" : "Start a prototype"}
        </button>
        <button type="button" className="btn" onClick={() => onOpen(deep ? "d_prd" : "l_prd")}>
          Review PRD
        </button>
      </div>
    </section>
  );
}
