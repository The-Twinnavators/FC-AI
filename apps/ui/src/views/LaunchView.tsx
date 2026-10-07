/**
 * Launch Readiness Checklist: the tool for building the REAL application later. FlowCode builds a clickable prototype;
 * this lists what the prototype simulates or leaves out (the PRD's features to build for real, then backend, data,
 * accounts, security, privacy, accessibility, SEO and deployment), each item with a prompt for a coding agent.
 * Items with code or check evidence tick themselves off; people tick the rest. Users can add tasks, flag, edit, hide,
 * mark N/A, override any item, copy prompts and download the whole checklist as Markdown.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@flowcode/contracts";
import { get, post, useResource } from "../api";
import { goBack, navigate, previousRoute, routeName } from "../router";
import { Empty, Icon, ago } from "../components/ui";
import { SkeletonBlock } from "../components/motion";

type Status = "completed" | "in_progress" | "needs_review" | "blocked" | "not_started" | "not_applicable";
interface Item {
  id: string;
  title: string;
  detail: string;
  status: Status;
  source: string;
  kind: "code" | "manual" | "review" | "task";
  gate?: boolean;
  priority: Priority;
  categoryId?: string;
  prompt: string;
  promptAuthored: boolean;
  notes?: string;
  files?: string[];
  covers?: string[];
  flagged?: boolean;
  edited?: boolean;
  evidence?: string;
  override?: { status: Status; at: string };
}
interface Category {
  id: string;
  title: string;
  description: string;
  icon: string;
  optional?: boolean;
  reason?: string;
  hidden?: string[];
  items: Item[];
}
interface Report {
  projectId: string;
  projectName: string;
  projectType?: string;
  scannedAt: string;
  checksLastRunAt?: string;
  totals: Record<Status, number> & { total: number; counted: number; gateOpen: number; flagged: number; done: number; percent: number; criticalOpen: number; gateBlocked: number; gateNeedsReview: number };
  level: "red" | "amber" | "green";
  requirements?: { total: number; inSteps: number; forPeople: number; later: number; filledIn: number };
  categories: Category[];
}

type Priority = "low" | "medium" | "high" | "critical";
const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const isDone = (s: Status) => s === "completed" || s === "not_applicable";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Filter = "all" | Status | "gate" | "flagged";
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "not_started", label: "Not started" },
  { id: "in_progress", label: "In progress" },
  { id: "needs_review", label: "Needs review" },
  { id: "completed", label: "Complete" },
  { id: "blocked", label: "Blocked" },
  { id: "not_applicable", label: "Not applicable" },
  { id: "gate", label: "Launch gate only" },
  { id: "flagged", label: "Flagged only" },
];
const STATUS_LABEL: Record<Status, string> = { completed: "Complete", in_progress: "In progress", needs_review: "Needs review", blocked: "Blocked", not_started: "Not started", not_applicable: "Not applicable" };
const KIND_LABEL: Record<Item["kind"], string> = { code: "Code", manual: "Manual", review: "Review", task: "Task" };
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

/** `embedded`: shown as the Launch readiness tab of a project's page in My Projects, which supplies the page title, Back and project picker. */
export function LaunchView({ projectId, projects, embedded }: { projectId?: string; projects: Project[]; embedded?: boolean }) {
  const id = projectId ?? projects[0]?.id;
  const { data, error, reload, loading } = useResource<Report>(id ? `/projects/${id}/launch` : null, [], 5000);
  const [report, setReport] = useState<Report>();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string>();
  // D12: the prototype as a folder to host yourself.
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<{ folder?: string; files?: number; error?: string; awaitingApproval?: string }>();
  const exportFolder = async () => {
    if (!id) return;
    setExporting(true);
    setExported(undefined);
    try {
      setExported(await post<{ folder?: string; files?: number; error?: string; awaitingApproval?: string }>(`/projects/${id}/export`));
    } catch (e) {
      setExported({ error: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };
  const prev = useRef<Map<string, Status>>(new Map());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // Highlight items that just ticked over to Complete since the last scan.
  useEffect(() => {
    if (!data) return;
    const next = new Map<string, Status>();
    const ticked = new Set<string>();
    for (const c of data.categories)
      for (const it of c.items) {
        next.set(it.id, it.status);
        const was = prev.current.get(it.id);
        if (was && was !== "completed" && it.status === "completed") ticked.add(it.id);
      }
    prev.current = next;
    setReport(data);
    if (ticked.size) {
      setFresh(ticked);
      const t = setTimeout(() => setFresh(new Set()), 2400);
      return () => clearTimeout(t);
    }
  }, [data]);

  const matches = (it: Item) => {
    const term = q.trim().toLowerCase();
    if (term && !`${it.title} ${it.detail} ${it.evidence ?? ""}`.toLowerCase().includes(term)) return false;
    if (filter === "all") return true;
    if (filter === "gate") return !!it.gate;
    if (filter === "flagged") return !!it.flagged;
    return it.status === filter;
  };
  const filtering = filter !== "all" || q.trim().length > 0;
  const visible = useMemo(() => (report?.categories ?? []).map((c) => ({ ...c, shown: c.items.filter(matches) })).filter((c) => c.shown.length || !filtering), [report, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Returns the error message when the change was refused (a prompt that misses the standard), else undefined. */
  const act = async (itemId: string, body: Record<string, unknown>): Promise<string | undefined> => {
    if (!id) return;
    setBusy(itemId);
    try {
      setReport(await post<Report>(`/projects/${id}/launch/items/${encodeURIComponent(itemId)}`, body));
    } catch (e) {
      return (e as Error).message;
    } finally {
      setBusy(undefined);
    }
  };
  const fillPrompt = async (fields: { title: string; detail: string; kind: Item["kind"]; gate: boolean; categoryId?: string }) => (id ? (await post<{ prompt: string }>(`/projects/${id}/launch/prompt-preview`, fields)).prompt : "");
  // The whole checklist as Markdown, saved like Build analysis saves its report.
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const r = await get<{ markdown: string; filename: string }>(`/projects/${id}/launch/markdown`);
      const url = URL.createObjectURL(new Blob([r.markdown], { type: "text/markdown" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = r.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  if (!id)
    return (
      <div className="page">
        <Empty title="No projects yet" action={<button className="btn btn--primary" onClick={() => navigate("/")}>Start a prototype</button>}>
          Each build gets its own launch readiness checklist: what the real app needs beyond the prototype.
        </Empty>
      </div>
    );

  const t = report?.totals;
  const pct = t?.percent ?? 0;

  return (
    <div className={embedded ? "lrc lrc--embedded" : "page lrc"}>
      {embedded ? null : (
      <div className="lrc__top">
        <button className="lrc__back" onClick={() => goBack("/quality")}>
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
            <Icon name="chevron" />
          </span>
          Back to {(() => {
            const prev = previousRoute();
            return prev ? routeName(prev) : "My Projects";
          })()}
        </button>
        {projects.length > 1 ? (
          <select className="select lrc__project" aria-label="Project" value={id} onChange={(e) => navigate(`/quality/${e.target.value}/launch`)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      )}

      <header className="lrc__head" data-reveal>
        <div>
          {embedded ? (
            <h2 className="lrc__title lrc__title--sub">Launch readiness</h2>
          ) : (
            <>
              <span className="label">My Projects</span>
              <h1 className="page__title lrc__title">Launch readiness</h1>
            </>
          )}
          <p className="lrc__sub">For building the real application: everything the prototype simulates or leaves out. Each item has a prompt you can give to a coding agent.</p>
          <p className="lrc__sub">
            {report ? (
              <>
                <strong>{report.projectName}</strong>
                {report.projectType && report.projectType !== "unknown" ? <span className="mono"> · {report.projectType}</span> : null}
              </>
            ) : (
              "…"
            )}
          </p>
          {t && report ? (
            <p className="lrc__meta">
              {t.done} of {t.total} tasks complete across {report.categories.length} categories.{report.checksLastRunAt ? ` The prototype's checks last ran ${ago(report.checksLastRunAt)}.` : ""}
            </p>
          ) : null}
        </div>
        <div className="lrc__actions">
          <button className="btn" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            <Icon name="plus" size={14} /> New task
          </button>
          <button className="btn btn--primary" data-cp="launch-download" onClick={() => void download()} disabled={downloading || !report} title="Save the whole checklist, with every prompt, as a Markdown file">
            <Icon name="reports" size={14} /> {downloading ? "Preparing…" : "Download .md"}
          </button>
          <button className="btn" data-cp="export-folder" onClick={() => void exportFolder()} disabled={exporting || !id} title="Build the prototype into a folder on this computer that you can upload to any web host. Nothing is uploaded.">
            <Icon name="download" size={14} /> {exporting ? "Exporting…" : "Export as a folder"}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={reload} disabled={loading} title="Re-scan the codebase and evidence now" data-guide="lrc.rescan">
            Re-scan
          </button>
        </div>
      </header>

      {exported ? (
        <div className={`lrc-export${exported.error ? " lrc-export--bad" : ""}`} role="status">
          {exported.folder ? (
            <>
              <p>
                <strong>Exported {exported.files} files.</strong> Upload the whole folder to any static web host. Its README says how, and reminds visitors the data is pretend.
              </p>
              <p className="lrc-export__path">
                <span className="mono">{exported.folder}</span>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => void navigator.clipboard?.writeText(exported.folder!).catch(() => undefined)}>
                  Copy path
                </button>
              </p>
            </>
          ) : exported.awaitingApproval ? (
            <p>The export&apos;s build command is waiting for your OK on Approvals.</p>
          ) : (
            <p>{exported.error}</p>
          )}
        </div>
      ) : null}

      {/* D11: for people who don't write code. Only routes and hand-offs; no invented prices or timelines. */}
      <details className="lrc-real" data-cp="real-app" data-reveal>
        <summary>Not a developer? How to turn this into a real app</summary>
        <p className="lrc-real__lede">The prototype shows what the app should do. A real app also needs everything below the progress bar: a server, real data, accounts, security and a web address. There are three common routes.</p>
        <div className="lrc-real__routes">
          <section>
            <h3>Work with a developer</h3>
            <p>Hand them:</p>
            <ul>
              <li>Your PRD: what the app is for and who uses it.</li>
              <li>This checklist (<strong>Download .md</strong>). Each item has a prompt their coding tools can use.</li>
              <li>The prototype itself: <strong>Export as a folder</strong> (above) gives them a copy they can open and click through.</li>
            </ul>
            <p>Ask them which launch-gate items come first, and for an estimate per category of the checklist.</p>
          </section>
          <section>
            <h3>Use an app-builder service</h3>
            <p>Rebuild the screens and flows on a service made for people who don&apos;t code, using the prototype as your reference.</p>
            <p>Before you choose one, check it supports what the checklist lists for your app: accounts, payments, saving data, privacy.</p>
          </section>
          <section>
            <h3>Use a coding agent yourself</h3>
            <p>Each item&apos;s prompt is written for a coding agent. Start with the launch-gate items, one at a time, and check each result before the next.</p>
          </section>
        </div>
        <p className="lrc-real__note">Whichever route you take: the prototype&apos;s data is pretend. Before real customers use the app, do the security and privacy items, because they protect people&apos;s details.</p>
      </details>

      {notice ? (
        <p className="notice" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </p>
      ) : null}
      {t ? (
        <div className="lrc__progress" data-reveal>
          <div className="lrc__progress-row">
            <span>Overall progress</span>
            <strong>{pct}%</strong>
          </div>
          <span className="lrc-bar lrc-bar--lg" role="progressbar" aria-label="Overall launch readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </span>
        </div>
      ) : null}

      {t && report ? (
        report.level !== "green" ? (
          <button className={`lrc__gate lrc__gate--open lrc__gate--${report.level}`} onClick={() => setFilter("gate")}>
            <Icon name="quality" size={16} /> {[t.gateBlocked ? `${plural(t.gateBlocked, "blocked launch-gate task")}` : "", t.criticalOpen ? `${plural(t.criticalOpen, "critical launch-gate task")} remaining` : ""].filter(Boolean).join(". ")}
            <span className="lrc__gate-link">Show</span>
          </button>
        ) : (
          <p className="lrc__gate lrc__gate--clear">
            <Icon name="check" size={16} /> No blocked or incomplete critical launch-gate tasks right now.
          </p>
        )
      ) : null}

      {report?.requirements ? (
        <p className="lrc__plan" data-reveal>
          <Icon name="checklist" size={15} />
          <span>
            Your PRD has {plural(report.requirements.total, "requirement")}. The prototype simulates {report.requirements.inSteps} of them; build each for real from the Spec categories below. {report.requirements.forPeople} {report.requirements.forPeople === 1 ? "is" : "are"} for a person to check and {report.requirements.later} {report.requirements.later === 1 ? "was" : "were"} left out of the prototype.
          </span>
        </p>
      ) : null}

      {adding && report ? (
        <NewTask
          categories={report.categories}
          fillPrompt={fillPrompt}
          onCancel={() => setAdding(false)}
          onAdd={async (body) => {
            try {
              setReport(await post<Report>(`/projects/${id}/launch/tasks`, body));
              setAdding(false);
            } catch (e) {
              return (e as Error).message;
            }
          }}
        />
      ) : null}

      <label className="lrc__search">
        <span className="label">Search</span>
        <input className="input" type="search" placeholder="Search title or description" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <div className="lrc__pills" role="toolbar" aria-label="Filter checklist" data-guide="lrc.filters">
        {FILTERS.map((f) => {
          const n = !t ? undefined : f.id === "all" ? t.total : f.id === "gate" ? undefined : f.id === "flagged" ? t.flagged : t[f.id];
          return (
            <button key={f.id} className="lrc__pill" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              {n !== undefined && f.id !== "all" ? <span className="lrc__pill-n">{n}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="lrc__expand">
        <button className="btn btn--sm" onClick={() => setOpen(Object.fromEntries((report?.categories ?? []).map((c) => [c.id, true])))}>
          <Icon name="chevron" size={12} /> Expand all
        </button>
        <button className="btn btn--sm" onClick={() => setOpen(Object.fromEntries((report?.categories ?? []).map((c) => [c.id, false])))}>
          <span style={{ transform: "rotate(-90deg)", display: "inline-flex" }}>
            <Icon name="chevron" size={12} />
          </span>
          Collapse all
        </button>
      </div>

      {error && !report ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
      {!report ? <SkeletonBlock rows={7} label="Scanning project" /> : null}

      <div className="lrc__list">
        {visible.map((c, i) => {
          // Category progress counts every item in the category, not only the filtered ones; N/A counts as done.
          const counted = c.items;
          const done = counted.filter((x) => isDone(x.status)).length;
          const p = counted.length ? Math.round((done / counted.length) * 100) : 100;
          const expanded = open[c.id] ?? filtering;
          return (
            <section key={c.id} className={`lrc-cat${expanded ? " is-open" : ""}${p === 100 ? " is-done" : ""}`} data-reveal style={{ ["--i" as string]: Math.min(i, 10) }}>
              <button className="lrc-cat__head" aria-expanded={expanded} aria-controls={`lrc-${c.id}`} onClick={() => setOpen((o) => ({ ...o, [c.id]: !expanded }))}>
                <span className="lrc-cat__chev" aria-hidden="true">
                  <Icon name="chevron" size={14} />
                </span>
                <span className="lrc-cat__icon" aria-hidden="true">
                  <Icon name={c.icon} size={20} />
                </span>
                <span className="lrc-cat__text">
                  <span className="lrc-cat__title">
                    {c.title}
                    {c.optional ? <span className="lrc-cat__opt">(optional)</span> : null}
                  </span>
                  <span className="lrc-cat__desc">
                    {c.description}
                    {c.reason ? <span className="lrc-cat__reason"> · {c.reason}</span> : null}
                  </span>
                </span>
                <span className={`lrc-bar${p === 100 ? " lrc-bar--done" : ""}`} role="progressbar" aria-label={`${c.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
                  <span style={{ width: `${p}%` }} />
                </span>
                <span className="lrc-cat__score mono">
                  {done} / {counted.length} · {p}%
                </span>
              </button>
              {expanded ? (
                <div id={`lrc-${c.id}`} className="lrc-items">
                  {c.shown.map((it) => (
                    <ItemCard key={it.id} it={it} busy={busy === it.id} fresh={fresh.has(it.id)} act={(body) => act(it.id, body)} fillPrompt={fillPrompt} />
                  ))}
                  {c.hidden?.length && !filtering ? (
                    <button className="lrc-restore" onClick={() => act(c.hidden![0], { action: "restore", ids: c.hidden })}>
                      {c.hidden.length} removed item{c.hidden.length === 1 ? "" : "s"} · Restore
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
        {report && !visible.length ? <Empty title="Nothing matches">Try another filter or search term.</Empty> : null}
      </div>
    </div>
  );
}

type FillPrompt = (fields: { title: string; detail: string; kind: Item["kind"]; gate: boolean; categoryId?: string }) => Promise<string>;

const PROMPT_HINT = "Leave it empty to use the generated prompt. A stored prompt needs Goal, Context, Steps, Constraints, Acceptance criteria and Report back sections.";

function copyText(text: string, done: () => void) {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } finally {
      ta.remove();
    }
  };
  if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

function ItemCard({ it, busy, fresh, act, fillPrompt }: { it: Item; busy: boolean; fresh: boolean; act: (body: Record<string, unknown>) => Promise<string | undefined>; fillPrompt: FillPrompt }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const done = it.status === "completed";
  const copy = () =>
    copyText(it.prompt, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  return (
    <article className={`lrc-item lrc-item--${it.status}${fresh ? " is-fresh" : ""}${open ? " is-open" : ""}`} data-guide="nav.launch" data-ctx-label={it.title}>
      <input
        type="checkbox"
        className="lrc-item__check"
        checked={done}
        disabled={busy}
        aria-label={`Mark "${it.title}" ${done ? "not complete" : "complete"}`}
        onChange={(e) => void act({ action: "status", status: e.target.checked ? "completed" : it.override ? null : "not_started" })}
      />
      <div className="lrc-item__body">
        <div className="lrc-badges">
          {it.priority === "critical" || it.priority === "high" ? <span className={`lrc-badge lrc-badge--${it.priority}`}>{PRIORITY_LABEL[it.priority]}</span> : null}
          <span className="lrc-badge lrc-badge--kind">{KIND_LABEL[it.kind]}</span>
          {it.gate ? <span className="lrc-badge lrc-badge--gate">Launch gate</span> : null}
          {it.flagged ? (
            <span className="lrc-badge lrc-badge--flag">
              <Icon name="flag" size={11} /> Flagged
            </span>
          ) : null}
          {it.status !== "completed" && it.status !== "not_started" ? <span className={`lrc-badge lrc-badge--st-${it.status}`}>{STATUS_LABEL[it.status]}</span> : null}
        </div>
        {editing ? (
          <ItemEditor it={it} act={act} fillPrompt={fillPrompt} onClose={() => setEditing(false)} />
        ) : (
          <>
            <h4 className="lrc-item__title">
              <button type="button" className="lrc-item__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <span className="lrc-item__chev" aria-hidden="true">
                  <Icon name="chevron" size={13} />
                </span>
                {it.title}
              </button>
            </h4>
            {it.detail && it.detail !== it.title ? <p className="lrc-item__detail">{it.detail}</p> : null}
            <p className="lrc-item__last">
              <strong>{it.source === "spec" ? "Note:" : "Last check:"}</strong> {it.override ? `Set to ${STATUS_LABEL[it.override.status]} by you ${ago(it.override.at)}.` : it.evidence ?? (it.kind === "manual" ? "Confirm by hand, then mark it complete." : "Not checked yet.")}
            </p>
            {open ? (
              <div className="lrc-details">
                <div className="lrc-prompt">
                  <div className="lrc-prompt__head">
                    <span className="lrc-prompt__label">AI prompt</span>
                    <span className={`lrc-badge ${it.promptAuthored ? "lrc-badge--authored" : "lrc-badge--kind"}`}>{it.promptAuthored ? "Authored" : "Generated"}</span>
                    <button type="button" className="btn btn--sm btn--ghost lrc-prompt__copy" onClick={copy}>
                      <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="lrc-prompt__text" tabIndex={0} aria-label={`AI prompt for "${it.title}"`}>
                    {it.prompt}
                  </pre>
                </div>
                <label className="lrc-notes">
                  <span className="label">Notes</span>
                  <textarea className="textarea" rows={2} defaultValue={it.notes ?? ""} placeholder="Anything worth remembering about this task" onBlur={(e) => (e.target.value !== (it.notes ?? "") ? void act({ action: "notes", notes: e.target.value }) : undefined)} />
                </label>
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="lrc-item__tools">
        <button className="lrc-tool" onClick={copy} title="Copy this task's AI prompt" aria-label="Copy AI prompt">
          <Icon name={copied ? "check" : "copy"} size={15} />
        </button>
        <button className={`lrc-tool${it.flagged ? " is-on" : ""}`} onClick={() => void act({ action: "flag", flagged: !it.flagged })} aria-pressed={!!it.flagged} title={it.flagged ? "Unflag" : "Flag for attention"} aria-label="Flag">
          <Icon name="flag" size={15} />
        </button>
        <button className="lrc-tool" onClick={() => setEditing((e) => !e)} aria-pressed={editing} title="Edit" aria-label="Edit">
          <Icon name="edit" size={15} />
        </button>
        <button className="lrc-tool lrc-tool--danger" onClick={() => void act({ action: "remove" })} title={it.source === "custom" ? "Delete this task" : "Remove from this checklist (restorable)"} aria-label="Remove">
          <Icon name="trash" size={15} />
        </button>
        <select className={`select lrc-status lrc-status--${it.status}`} aria-label={`Status of "${it.title}"`} value={it.override ? it.override.status : "auto"} disabled={busy} onChange={(e) => void act({ action: "status", status: e.target.value === "auto" ? null : e.target.value })}>
          {it.source !== "custom" ? <option value="auto">{it.override ? "Use evidence" : STATUS_LABEL[it.status]}</option> : null}
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

/** The fields every task has, shared by the editor and New task. */
function TaskFields({
  v,
  set,
  categories,
  fillPrompt,
  idPrefix,
}: {
  v: { title: string; detail: string; categoryId: string; priority: Priority; kind: Item["kind"]; gate: boolean; aiPrompt: string };
  set: (patch: Partial<typeof v>) => void;
  categories?: Category[];
  fillPrompt: FillPrompt;
  idPrefix: string;
}) {
  const [filling, setFilling] = useState(false);
  return (
    <>
      <label className="lrc-field" htmlFor={`${idPrefix}-title`}>
        <span className="label">Title</span>
        <input id={`${idPrefix}-title`} className="input" placeholder="What needs to be true before launch?" value={v.title} onChange={(e) => set({ title: e.target.value })} required minLength={2} />
      </label>
      <label className="lrc-field" htmlFor={`${idPrefix}-detail`}>
        <span className="label">Description</span>
        <textarea id={`${idPrefix}-detail`} className="textarea" placeholder="Why it matters and how to check it" value={v.detail} onChange={(e) => set({ detail: e.target.value })} rows={2} />
      </label>
      <div className="lrc-edit__row">
        {categories ? (
          <select className="select" aria-label="Category" value={v.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="custom">Your tasks</option>
            {categories
              .filter((c) => c.id !== "custom")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
        ) : null}
        <select className="select" aria-label="Priority" value={v.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]} priority
            </option>
          ))}
        </select>
        <select className="select" aria-label="Type" value={v.kind} onChange={(e) => set({ kind: e.target.value as Item["kind"] })}>
          <option value="code">Code</option>
          <option value="manual">Manual</option>
          <option value="review">Review</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={v.gate} onChange={(e) => set({ gate: e.target.checked })} /> Launch gate
        </label>
      </div>
      <div className="lrc-field">
        <div className="lrc-field__row">
          <label className="label" htmlFor={`${idPrefix}-prompt`}>
            AI prompt
          </label>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            disabled={filling || v.title.trim().length < 1}
            onClick={async () => {
              setFilling(true);
              try {
                set({ aiPrompt: await fillPrompt({ title: v.title, detail: v.detail, kind: v.kind, gate: v.gate, categoryId: v.categoryId }) });
              } finally {
                setFilling(false);
              }
            }}
          >
            {filling ? "Filling…" : "Fill from fields"}
          </button>
        </div>
        <textarea id={`${idPrefix}-prompt`} className="textarea lrc-prompt__input" rows={10} value={v.aiPrompt} onChange={(e) => set({ aiPrompt: e.target.value })} aria-describedby={`${idPrefix}-prompt-hint`} spellCheck={false} />
        <p id={`${idPrefix}-prompt-hint`} className="lrc-field__hint">
          {PROMPT_HINT}
        </p>
      </div>
    </>
  );
}

function ItemEditor({ it, act, fillPrompt, onClose }: { it: Item; act: (body: Record<string, unknown>) => Promise<string | undefined>; fillPrompt: FillPrompt; onClose: () => void }) {
  const [v, setV] = useState({ title: it.title, detail: it.detail, categoryId: it.categoryId ?? "custom", priority: it.priority, kind: it.kind, gate: !!it.gate, aiPrompt: it.promptAuthored ? it.prompt : "" });
  const [error, setError] = useState<string>();
  return (
    <form
      className="lrc-edit"
      onSubmit={async (e) => {
        e.preventDefault();
        const err = await act({ action: "edit", title: v.title.trim(), detail: v.detail, priority: v.priority, gate: v.gate, ...(it.kind !== "task" ? { kind: v.kind } : {}), aiPrompt: v.aiPrompt });
        if (err) setError(err);
        else onClose();
      }}
    >
      <TaskFields v={v} set={(p) => (setV((x) => ({ ...x, ...p })), setError(undefined))} fillPrompt={fillPrompt} idPrefix={`edit-${it.id.replace(/[^\w-]/g, "_")}`} />
      {error ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
      <div className="lrc-edit__row">
        <button className="btn btn--primary btn--sm" type="submit">
          Save
        </button>
        <button className="btn btn--ghost btn--sm" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewTask({ categories, onAdd, onCancel, fillPrompt }: { categories: Category[]; onAdd: (body: Record<string, unknown>) => Promise<string | undefined>; onCancel: () => void; fillPrompt: FillPrompt }) {
  const [v, setV] = useState({ title: "", detail: "", categoryId: "custom", priority: "medium" as Priority, kind: "manual" as Item["kind"], gate: false, aiPrompt: "" });
  const [error, setError] = useState<string>();
  return (
    <form
      className="lrc-new"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.title.trim()) return setError("Add a title.");
        const err = await onAdd({ ...v, title: v.title.trim(), aiPrompt: v.aiPrompt || undefined });
        if (err) setError(err);
      }}
    >
      <h2 className="lrc-new__title">New task</h2>
      <TaskFields v={v} set={(p) => (setV((x) => ({ ...x, ...p })), setError(undefined))} categories={categories} fillPrompt={fillPrompt} idPrefix="lrc-new" />
      {error ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
      <div className="lrc-edit__row">
        <button className="btn btn--primary btn--sm" type="submit">
          Add task
        </button>
        <button className="btn btn--ghost btn--sm" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
