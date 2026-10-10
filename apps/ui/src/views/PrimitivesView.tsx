/**
 * Primitives: the living component library. Every reusable UI building block rendered live, with its
 * variants, usage notes and a suggestions thread so design feedback is tracked per component.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { Approval, Project } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { ApprovalCard } from "../components/ApprovalCard";
import { AutonomyPicker } from "../components/AutonomyPicker";
import { navigate } from "../router";
import { IconMatrix, IllustrationGallery } from "../components/IconLibrary";
import { ATTRIBUTES, AttributeEditor } from "../components/AttributeEditor";
import { DiffView, Empty, Icon, Led, Logo, StatusChip, Tabs, ago } from "../components/ui";
import { AnimatedNumber, AreaChart, RadialGauge, Skeleton, SkeletonBlock } from "../components/motion";
import { ConfirmButton } from "../components/ConfirmButton";
import { ProjectCards } from "./QualityOverview";
import type { AutonomyLevel } from "@flowcode/contracts";

interface Suggestion {
  id: string;
  component: string;
  text: string;
  runId?: string;
  projectId?: string;
  runStatus?: string;
  progress?: { done: number; total: number; current?: string; phase?: string; paused?: boolean };
  status: "open" | "done" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

interface Primitive {
  id: string;
  name: string;
  group: string;
  file: string;
  usage: string;
  demo: () => ReactNode;
}

const sampleApproval: Approval = {
  id: "apr_demo",
  projectId: "demo",
  kind: "dependency_install",
  action: "Run `npm install --no-fund --no-audit` in .",
  reason: "Install the starter template's declared dependencies",
  affected: ["npm install --no-fund --no-audit"],
  risk: "high",
  detail: "Policy: npm install installs or changes dependencies (runs lifecycle scripts, uses network)",
  consequencesOfDenial: "The command will not run; the task will be blocked or must find another approach.",
  status: "pending",
  createdAt: new Date().toISOString(),
};

function TabsDemo() {
  const [t, setT] = useState<"a" | "b" | "c">("a");
  return (
    <div style={{ width: "100%" }}>
      <Tabs label="demo" value={t} onChange={setT} tabs={[{ id: "a", label: "Activity" }, { id: "b", label: "Terminal", count: 3 }, { id: "c", label: "Approvals", count: 1 }]} />
      <div role="tabpanel" id={`panel-demo-${t}`} aria-labelledby={`tab-demo-${t}`} className="muted" style={{ padding: 12 }}>
        Panel {t.toUpperCase()}
      </div>
    </div>
  );
}

function AutonomyDemo() {
  const [v, setV] = useState<AutonomyLevel>("assisted");
  return (
    <div style={{ width: "100%" }}>
      <AutonomyPicker value={v} onChange={setV} compact />
    </div>
  );
}

/** Project card, live: your most recent project, at full size (My Projects) and compact (Dashboard). */
function ProjectCardDemo() {
  const projects = useResource<Project[]>("/projects", []);
  const latest = [...(projects.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 1);
  if (!projects.data) return <SkeletonBlock rows={2} />;
  if (!latest.length) return <p className="muted">Shown here once you have a project.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, width: "100%", alignItems: "start" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <span className="label">Full · My Projects</span>
        <ProjectCards projects={latest} reload={projects.reload} />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <span className="label">Compact · Dashboard</span>
        <ProjectCards projects={latest} reload={projects.reload} compact />
      </div>
    </div>
  );
}

function NumberDemo() {
  const [n, setN] = useState(1284);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 34, fontWeight: 300 }}>
        <AnimatedNumber value={n} />
      </span>
      <button className="btn btn--sm" onClick={() => setN(Math.round(Math.random() * 5000))}>
        Randomize
      </button>
    </span>
  );
}

const series = (seed: number) => Array.from({ length: 24 }, (_, i) => Math.round(4 + i * (0.6 + seed / 10) + Math.sin(i / 2 + seed) * 2));

const PRIMITIVES: Primitive[] = [
  { id: "logo", name: "Logo", group: "Brand", file: "components/ui.tsx", usage: "Gradient bolt mark; `withWordmark` adds FlowCode + tagline.", demo: () => (<><Logo size={32} /><Logo size={30} withWordmark /></>) },
  {
    id: "button",
    name: "Button",
    group: "Actions",
    file: "styles/app.css .btn",
    usage: "Primary for the one main action per view; default for secondary; ghost for low emphasis; danger for destructive. Press shrinks slightly.",
    demo: () => (
      <>
        <button className="btn btn--primary">Build the prototype</button>
        <button className="btn">Secondary</button>
        <button className="btn btn--ghost">Ghost</button>
        <button className="btn btn--danger">
          <Icon name="stop" size={13} /> Cancel
        </button>
        <button className="btn btn--sm">Small</button>
        <button className="btn" disabled>
          Disabled
        </button>
      </>
    ),
  },
  {
    id: "chip",
    name: "Status chip",
    group: "Status",
    file: "components/ui.tsx StatusChip",
    usage: "Run, task and check states. Color comes from the shared signal mapping, so states read the same everywhere.",
    demo: () => (
      <>
        {["verified", "running", "awaiting_approval", "blocked", "failed", "skipped", "not_run"].map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </>
    ),
  },
  {
    id: "led",
    name: "Signal light",
    group: "Status",
    file: "components/ui.tsx Led",
    usage: "Compact status in dense lists and the verification strip; running pulses, settled states breathe.",
    demo: () => (
      <>
        {["passed", "running", "awaiting_approval", "failed", undefined].map((s, i) => (
          <span key={i} style={{ display: "inline-flex", gap: 8, alignItems: "center", marginRight: 12 }}>
            <Led status={s} /> {s ?? "not run"}
          </span>
        ))}
      </>
    ),
  },
  {
    id: "input",
    name: "Inputs",
    group: "Forms",
    file: "styles/app.css .input .textarea .select",
    usage: "Always paired with a visible label. Focus shows a magenta ring.",
    demo: () => (
      <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 520 }}>
        <label className="field">
          <span className="label">Text input</span>
          <input className="input" placeholder="Climbing gym bookings" />
        </label>
        <label className="field">
          <span className="label">Select</span>
          <select className="select">
            <option>qwen3:14b</option>
            <option>qwen3:8b</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Textarea</span>
          <textarea className="textarea" placeholder="Describe what to build…" />
        </label>
        <label className="check">
          <input type="checkbox" defaultChecked /> Checkbox with label
        </label>
      </div>
    ),
  },
  { id: "tabs", name: "Tabs", group: "Navigation", file: "components/ui.tsx Tabs", usage: "Roving focus with arrow keys; the gradient underline slides to the active tab; optional counts.", demo: () => <TabsDemo /> },
  { id: "autonomy", name: "Autonomy picker", group: "Forms", file: "components/AutonomyPicker.tsx", usage: "Segmented radio group bound to the shared autonomy policy, so the description is exactly what the daemon enforces.", demo: () => <AutonomyDemo /> },
  { id: "section", name: "Glass section", group: "Layout", file: "styles/app.css .section", usage: "The main surface: translucent, blurred, top-edge highlight and soft shadow. Add .lift for interactive cards.", demo: () => (<div className="section lift" style={{ width: 320 }}><div className="section__head"><h3 className="section__title">Section title</h3></div><div className="section__body muted">Body content with generous spacing.</div></div>) },
  { id: "empty", name: "Empty state", group: "Feedback", file: "components/ui.tsx Empty", usage: "Explain what will appear and how to get there; never just 'No data'.", demo: () => <div style={{ width: "100%" }}><Empty title="No builds yet">Describe what you want, or open an existing repository.</Empty></div> },
  { id: "notice", name: "Notice", group: "Feedback", file: "styles/app.css .notice", usage: "Inline status: default, warn and bad variants; use role=alert for errors.", demo: () => (<div style={{ display: "grid", gap: 8, width: "100%" }}><p className="notice">Informational notice.</p><p className="notice notice--warn">Coder preflight: no capability record yet.</p><p className="notice notice--bad">Install failed: network unreachable.</p></div>) },
  { id: "skeleton", name: "Skeleton", group: "Feedback", file: "components/motion.tsx", usage: "Shimmering placeholders shaped like the content; used instead of loading text and for lazy-loaded pages.", demo: () => <div style={{ width: "100%" }}><SkeletonBlock rows={2} /><div style={{ marginTop: 10 }}><Skeleton h={80} /></div></div> },
  { id: "project-card", name: "Project card", group: "Cards", file: "views/QualityOverview.tsx ProjectCards", usage: "A project at a glance: screenshot, build status, launch readiness and build health. Full size on My Projects; `compact` (smaller gauges, three across) on the Dashboard. The ⋯ menu renames or deletes; View opens the builder.", demo: () => <ProjectCardDemo /> },
  { id: "approval", name: "Approval card", group: "Governance", file: "components/ApprovalCard.tsx", usage: "Exact action, reason, affected items, risk, details/diff, scope (once/project/deny) and consequences of denial (PRD §14.4).", demo: () => <div style={{ width: "100%", maxWidth: 640 }}><ApprovalCard approval={sampleApproval} /></div> },
  { id: "diff", name: "Diff view", group: "Code", file: "components/ui.tsx DiffView", usage: "Line diff with added/removed tinting and screen-reader prefixes.", demo: () => <div style={{ width: "100%" }} className="codeblock"><DiffView before={"const a = 1;\nconst b = 2;\n"} after={"const a = 1;\nconst b = 3;\nconst c = 4;\n"} /></div> },
  { id: "number", name: "Animated number", group: "Data", file: "components/motion.tsx AnimatedNumber", usage: "Counts up with ease-out; screen readers get the final value.", demo: () => <NumberDemo /> },
  { id: "gauge", name: "Radial gauge", group: "Data", file: "components/motion.tsx RadialGauge", usage: "Ratios (pass rate, completion). Purple → magenta → teal gradient; animates on change.", demo: () => (<><RadialGauge value={0.82} label="Pass rate" /><RadialGauge value={0.4} size={84} label="Completion" /><RadialGauge value={1} size={52} stroke={5} label="Ready" /></>) },
  {
    id: "area",
    name: "Area chart",
    group: "Data",
    file: "components/motion.tsx AreaChart",
    usage: "Time series with draw-in animation, smooth curves, glowing end points and a hover crosshair tooltip.",
    demo: () => (
      <div style={{ width: "100%" }}>
        <AreaChart
          label="Demo series"
          start={new Date(Date.now() - 7 * 864e5).toISOString()}
          end={new Date().toISOString()}
          height={200}
          series={[
            { key: "a", label: "Tool calls", color: "#a78bfa", values: series(1) },
            { key: "b", label: "Verified", color: "#2fc4b2", values: series(0).map((v) => Math.round(v / 2)) },
          ]}
        />
      </div>
    ),
  },
  { id: "eyebrow", name: "Eyebrow & gradient text", group: "Typography", file: "styles/motion.css .eyebrow .grad", usage: "Announcements above display headings; .grad for one emphasised phrase per heading.", demo: () => (<div style={{ display: "grid", gap: 10 }}><span className="eyebrow"><b>NEW</b> Capture a style from any website or screenshot</span><span style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.03em" }}>Turn a PRD into a <span className="grad">clickable prototype.</span></span></div>) },
  { id: "type", name: "Type scale", group: "Typography", file: "styles/tokens.css", usage: "Manrope for UI text (light 300 for descriptions); Martian Mono for labels and code; Roboto Mono for logs, feeds and metrics.", demo: () => (<div style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 56, fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1 }}>Display 56</span><span style={{ fontSize: 30, fontWeight: 300 }}>Title 30</span><span style={{ fontSize: 17, fontWeight: 650 }}>Section 17</span><span>Body 14</span><span className="label">Micro label 10</span><span className="mono">Mono 11.5</span></div>) },
  {
    id: "icons",
    name: "Icons",
    group: "Foundations",
    file: "lucide-react · components/IconLibrary.tsx",
    usage: "Lucide (open source, ISC) for every system cue: a 24px grid, 2px stroke, currentColor. Status icons always carry their signal color.",
    demo: () => <IconMatrix />,
  },
  {
    id: "illustrations",
    name: "Illustrations",
    group: "Foundations",
    file: "components/Illustration.tsx · assets/illustrations/",
    usage: "unDraw (free, unDraw license) for empty, error, success and onboarding states. Inline SVG, bundled locally, recoloured to the brand accent and theme.",
    demo: () => <IllustrationGallery />,
  },
  {
    id: "spacing",
    name: "Spacing tokens",
    group: "Foundations",
    file: "styles/responsive.css :root --space-*",
    usage: "Every layout uses these seven tokens: one gap between cards (both directions), a tighter gap for repeated rows, one card inset. Pages, grids and stacked cards never add their own margins.",
    demo: () => (
      <div style={{ display: "grid", gap: 10, width: "100%" }}>
        {[
          ["--space-page", "64px", "Page padding"],
          ["--space-head", "40px", "Page title → first content"],
          ["--space-gap", "24px", "Between cards, horizontally and vertically"],
          ["--space-gap-list", "12px", "Between repeated rows (checklist categories, analysis sections, findings)"],
          ["--space-inset", "28px", "Card padding"],
          ["--space-inset-sm", "20px", "Compact cards and floating panels"],
          ["--space-stack", "16px", "Between form controls inside a card"],
        ].map(([t, v, use]) => (
          <div key={t} className="space-token">
            <code className="mono">{t}</code>
            <span className="space-token__bar" style={{ width: `var(${t})` }} aria-hidden="true" />
            <span className="space-token__val mono">{v}</span>
            <span className="muted">{use}</span>
          </div>
        ))}
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
          Below 900px wide: page 20 · head 28 · gap 16 · inset 20 · inset-sm 16.
        </p>
      </div>
    ),
  },
  {
    id: "color",
    name: "Color tokens",
    group: "Foundations",
    file: "styles/tokens.css",
    usage: "Muted slate-navy surfaces and a mid-saturation blue accent (reduced blue light); teal means positive/passed; amber and red for warnings and failures. The logo keeps its purple. Never hard-code colors in components.",
    demo: () => (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, width: "100%" }}>
        {["--brand-1", "--brand-2", "--brand-3", "--teal-1", "--teal-2", "--teal-ink", "--sig-ok", "--sig-warn", "--sig-bad", "--sig-run", "--text-0", "--text-2"].map((t) => (
          <div key={t} style={{ display: "grid", gap: 6 }}>
            <span style={{ height: 44, borderRadius: 8, background: `var(${t})`, boxShadow: "inset 0 0 0 1px var(--line)" }} />
            <span className="mono muted" style={{ fontSize: 10.5 }}>
              {t}
            </span>
          </div>
        ))}
      </div>
    ),
  },
];

export function PrimitivesView() {
  const { data, reload } = useResource<Suggestion[]>("/primitives/suggestions", [], 5000);
  const groups = [...new Set(PRIMITIVES.map((p) => p.group))];
  const openCount = (id: string) => (data ?? []).filter((s) => s.component === id && s.status === "open").length;
  const totalOpen = (data ?? []).filter((s) => s.status === "open").length;
  // The component in view is marked in the list, like the active row in other side lists.
  const [current, setCurrent] = useState(PRIMITIVES[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id.replace(/^prim-/, ""));
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    PRIMITIVES.forEach((p) => {
      const el = document.getElementById(`prim-${p.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return (
    <div className="page page-enter">
      <header className="page__head">
        <div>
          <span className="label">System</span>
          <h1 className="page__title">
            Branding <span className="grad">— FlowCode's own look, live</span>
          </h1>
          <p className="muted" style={{ margin: "8px 0 0", maxWidth: "70ch" }}>
            FlowCode's brand and design system: its icons, illustrations and every component the app is built from, shown live. Leave a suggestion on any of them; open suggestions are tracked here until they are marked done.
          </p>
        </div>
        <span className="chip chip--warn" style={{ alignSelf: "center" }}>
          {totalOpen} open suggestion{totalOpen === 1 ? "" : "s"}
        </span>
      </header>
      <div className="prim-grid">
        <nav className="section prim-nav" aria-label="Components">
          {groups.map((g) => (
            <div key={g} style={{ display: "grid", gap: 2, marginBottom: 8 }}>
              <span className="label" style={{ padding: "4px 10px" }}>
                {g}
              </span>
              {PRIMITIVES.filter((p) => p.group === g).map((p) => (
                <a key={p.id} href={`#/primitives`} aria-current={current === p.id ? "true" : undefined} onClick={(e) => (e.preventDefault(), document.getElementById(`prim-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }))}>
                  {p.name}
                  {openCount(p.id) ? <span className="chip chip--warn">{openCount(p.id)}</span> : null}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ display: "grid", gap: 24 }}>
          {PRIMITIVES.map((p, i) => (
            <section key={p.id} id={`prim-${p.id}`} className="section" data-reveal style={{ ["--i" as string]: Math.min(i, 3), scrollMarginTop: 24 }} aria-labelledby={`h-${p.id}`}>
              <div className="section__head">
                <h2 className="section__title" id={`h-${p.id}`}>
                  {p.name}
                </h2>
                <span className="label">{p.group}</span>
                <span className="mono muted" style={{ marginLeft: "auto", fontSize: 11 }}>
                  {p.file}
                </span>
              </div>
              <div className="section__body" style={{ display: "grid", gap: 16 }}>
                {(() => {
                  const live = (data ?? []).find((sg) => sg.component === p.id && isWorking(sg));
                  return (
                    <div className={`prim-demo${live ? " is-updating" : ""}`} aria-busy={!!live}>
                      {p.demo()}
                      {live ? (
                        <span className="prim-updating" role="status">
                          <span className="stack-anim stack-anim--sm" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
                          FlowCode is updating this component
                        </span>
                      ) : null}
                    </div>
                  );
                })()}
                <PrimitiveDetails p={p} items={(data ?? []).filter((s) => s.component === p.id)} onChange={reload} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Under each live demo: usage notes and suggestions, or the component's editable attributes. */
function PrimitiveDetails({ p, items, onChange }: { p: Primitive; items: Suggestion[]; onChange: () => void }) {
  const attrs = ATTRIBUTES[p.id];
  const [tab, setTab] = useState<"usage" | "attributes">("usage");
  const open = items.filter((s) => s.status === "open").length;
  return (
    <>
      {attrs ? (
        <Tabs
          label={`prim-${p.id}`}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "usage", label: "Usage & suggestions", count: open || undefined },
            { id: "attributes", label: "Attributes", count: attrs.length },
          ]}
        />
      ) : null}
      {tab === "attributes" && attrs ? (
        <div role="tabpanel" id={`panel-prim-${p.id}-attributes`} aria-labelledby={`tab-prim-${p.id}-attributes`}>
          <AttributeEditor attrs={attrs} />
        </div>
      ) : (
        <div role={attrs ? "tabpanel" : undefined} id={attrs ? `panel-prim-${p.id}-usage` : undefined} aria-labelledby={attrs ? `tab-prim-${p.id}-usage` : undefined} style={{ display: "grid", gap: 16 }}>
          <p className="dim" style={{ margin: 0 }}>
            {p.usage}
          </p>
          <Suggestions component={p.id} prim={p} items={items} onChange={onChange} />
        </div>
      )}
    </>
  );
}

const isWorking = (sg: Suggestion) => !!sg.runId && sg.status === "open" && !["cancelled", "failed", "blocked", "done", "done_with_warnings", "done_unverified"].includes(sg.runStatus ?? "");

/** Live progress of FlowCode applying a suggestion: building blocks, current step and a step bar. */
function SuggestionProgress({ sg, onChange }: { sg: Suggestion; onChange: () => void }) {
  const p = sg.progress;
  const [resuming, setResuming] = useState(false);
  const pct = p && p.total ? Math.round((p.done / p.total) * 100) : 0;
  const label = p?.paused ? "Paused (FlowCode restarted). Resume to continue from this step." : sg.runStatus === "awaiting_approval" ? "Waiting for your approval" : p?.phase ?? (p?.current ? `Step ${Math.min(p.done + 1, p.total)} of ${p.total}: ${p.current}` : "Starting…");
  return (
    <div className={`sug-progress${p?.paused ? " is-paused" : ""}`} role="status" aria-live="polite">
      <span className="stack-anim stack-anim--sm" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
      <div className="sug-progress__text">
        <span>{label}</span>
        <span className="sug-progress__bar" role="progressbar" aria-label="Change progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${Math.max(pct, p?.total ? 4 : 0)}%` }} className={p?.total ? undefined : "is-indeterminate"} />
        </span>
      </div>
      {p?.total ? <span className="mono sug-progress__count">{p.done}/{p.total}</span> : null}
      {p?.paused && sg.runId ? (
        <button className="btn btn--sm btn--primary" disabled={resuming} onClick={() => (setResuming(true), void post(`/runs/${sg.runId}/resume`).then(onChange).finally(() => setResuming(false)))}>
          {resuming ? "Resuming…" : "Resume"}
        </button>
      ) : null}
    </div>
  );
}

function Suggestions({ component, prim, items, onChange }: { component: string; prim: Primitive; items: Suggestion[]; onChange: () => void }) {
  const [applying, setApplying] = useState<string>();
  const [applyError, setApplyError] = useState<string>();
  const apply = async (sg: Suggestion) => {
    setApplying(sg.id);
    setApplyError(undefined);
    try {
      await post(`/primitives/suggestions/${sg.id}/apply`, { componentName: prim.name, file: prim.file, usage: prim.usage });
      onChange();
    } catch (e) {
      setApplyError((e as Error).message);
    } finally {
      setApplying(undefined);
    }
  };
  const working = isWorking;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (text.trim().length < 2) return;
    setBusy(true);
    try {
      await post("/primitives/suggestions", { component, text: text.trim() });
      setText("");
      onChange();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span className="label">suggestions ({items.filter((s) => s.status === "open").length} open)</span>
      <span className="muted" style={{ fontSize: 12 }}>Apply with FlowCode turns a suggestion into a supervised change on FlowCode's own interface: the agents plan and make it, you approve each step, and it's marked done once verified (and can be rolled back).</span>
      {applyError ? <p className="notice notice--bad" role="alert" style={{ margin: 0 }}>{applyError}</p> : null}
      {items.map((s) => (
        <div key={s.id} style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 12px", borderRadius: 8, background: "var(--bg-2)", boxShadow: "inset 0 0 0 1px var(--line)", opacity: s.status === "open" ? 1 : 0.6 }}>
          <span className={`chip ${s.status === "done" ? "chip--ok" : working(s) ? "chip--run" : s.runStatus === "blocked" || s.runStatus === "failed" ? "chip--bad" : s.status === "open" ? "chip--run" : ""}`}>{s.status === "done" ? "Done" : s.status === "dismissed" ? "Dismissed" : working(s) ? (s.runStatus === "awaiting_approval" ? "Needs your approval" : "FlowCode is working") : s.runStatus === "blocked" || s.runStatus === "failed" ? "Change got stuck" : "To do"}</span>
          <span style={{ flex: 1, textDecoration: s.status === "done" ? "line-through" : undefined, whiteSpace: "pre-wrap" }}>{s.text}</span>
          <span className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
            {ago(s.createdAt)}
          </span>
          {s.status === "open" ? (
            <>
              {working(s) ? (
                <button className="btn btn--sm btn--primary" onClick={() => navigate(`/projects/${s.projectId}/runs/${s.runId}`)}>
                  View change
                </button>
              ) : (
                <button className="btn btn--sm btn--primary" disabled={!!applying} onClick={() => void apply(s)} title="Have FlowCode's agents make this change">
                  <Icon name="play" size={12} /> {applying === s.id ? "Starting…" : s.runId ? "Try again with FlowCode" : "Apply with FlowCode"}
                </button>
              )}
              <button className="btn btn--sm" onClick={() => post(`/primitives/suggestions/${s.id}`, { status: "done" }).then(onChange)}>
                Mark done
              </button>
              <button className="btn btn--sm btn--ghost" onClick={() => post(`/primitives/suggestions/${s.id}`, { status: "dismissed" }).then(onChange)}>
                Dismiss
              </button>
            </>
          ) : (
            <button className="btn btn--sm btn--ghost" onClick={() => post(`/primitives/suggestions/${s.id}`, { status: "open" }).then(onChange)}>
              Reopen
            </button>
          )}
          {isWorking(s) ? null : (
            <ConfirmButton className="icon-btn suggestion__remove" question="Remove this suggestion?" confirmLabel="Remove" onConfirm={() => post(`/primitives/suggestions/${s.id}/delete`).then(onChange)}>
              <Icon name="trash" size={15} />
              <span className="sr-only">Remove suggestion: {s.text.slice(0, 60)}</span>
            </ConfirmButton>
          )}
        </div>
        {working(s) ? <SuggestionProgress sg={s} onChange={onChange} /> : null}
        </div>
      ))}
      <form
        style={{ display: "flex", gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label htmlFor={`sug-${component}`} className="sr-only">
          Suggest a change to this component
        </label>
        <input id={`sug-${component}`} data-cp="brand-suggest" className="input" placeholder="Suggest a change to this component…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" type="submit" data-cp="brand-suggest-add" disabled={busy || text.trim().length < 2}>
          Add suggestion
        </button>
      </form>
    </div>
  );
}
