/**
 * One Repo Report repository (#/flowreport/<projectId>): its settings, its runs, live progress, and the report from
 * whichever run is selected, with exports, per-domain reports, imported responses and the run's diagnostic log.
 *  - Progress is followed over the event stream and also polled every 4 s: a stream that dies silently (the daemon
 *    restarting) would otherwise leave a bar frozen at 40% with no way to tell whether the run is still going.
 *  - A cancelled run is never shown as a report: it keeps what finished and says it isn't a reading of the whole repo.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Download, FileDown, FileUp, Info, Loader2, Play, Settings2, Square, Terminal, X } from "lucide-react";
import { ApiError } from "../api";
import { navigate } from "../router";
import { ReportView } from "./ReportView";
import { RunPicker } from "./RunHistory";
import { ResponseImport } from "./ResponseImport";
import { cancelRun, CATEGORY_LABEL, deleteRun, downloadArtifact, getProject, getRun, listRuns, REPORT_CATEGORIES, runLog, startRun, STATUS_LABEL, subscribeRun, TERMINAL, updateProject, type AnalysisSettings, type FlowReportProject, type FlowReportRun, type RunLogEvent } from "./api";

export function FlowReportProjectPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<FlowReportProject | null>(null);
  const [runs, setRuns] = useState<FlowReportRun[]>([]);
  const [run, setRun] = useState<FlowReportRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [log, setLog] = useState<RunLogEvent[] | null>(null);

  // In a ref so the poll and the stream both see the current run without depending on each other's effect.
  const runIdRef = useRef<string | null>(null);
  runIdRef.current = run?.id ?? null;

  const loadProject = useCallback(async () => {
    try {
      // The single-project route, because only it carries the folder path this page shows.
      setProject(await getProject(projectId));
      setNotFound(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError((e as Error).message);
    }
  }, [projectId]);

  const loadRuns = useCallback(
    async (select?: string) => {
      try {
        const list = await listRuns(projectId);
        setRuns(list);
        const chosen = (select && list.find((r) => r.id === select)) || list[0] || null;
        if (chosen) {
          const full = await getRun(chosen.id);
          setRun(full.run);
          setRunning(full.running);
        } else {
          setRun(null);
          setRunning(false);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void loadProject();
    void loadRuns();
  }, [loadProject, loadRuns]);
  // A different run has a different log.
  useEffect(() => setLog(null), [run?.id]);

  // ── The live view ──
  useEffect(() => {
    if (!run || TERMINAL.has(run.status)) return;
    const close = subscribeRun(run.id, (e) => {
      setRun((prev) =>
        prev && prev.id === e.runId
          ? {
              ...prev,
              status: e.status ?? prev.status,
              progress: e.progress ?? prev.progress,
              currentStage: e.currentStage ?? prev.currentStage,
              sections: e.section ? prev.sections.map((s) => (s.category === e.section!.category ? { ...s, status: e.section!.status } : s)) : prev.sections,
            }
          : prev,
      );
      // The run's own record is the truth about what it produced: on a terminal event, re-read it.
      if (e.status && TERMINAL.has(e.status)) void loadRuns(e.runId);
    });
    // The stream can die without saying so. This is what notices.
    const poll = window.setInterval(() => {
      const id = runIdRef.current;
      if (!id) return;
      void getRun(id)
        .then(({ run: fresh, running: live }) => {
          setRun((prev) => (prev && prev.id === fresh.id ? fresh : prev));
          setRunning(live);
          if (TERMINAL.has(fresh.status)) void loadRuns(fresh.id);
        })
        .catch(() => {
          /* the next tick tries again */
        });
    }, 4000);
    return () => {
      close();
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status, loadRuns]);

  const start = async () => {
    setBusy("run");
    setError(null);
    try {
      const started = await startRun(projectId);
      setRunning(true);
      await loadRuns(started.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const stop = async () => {
    if (!run) return;
    setBusy("cancel");
    try {
      await cancelRun(run.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const download = async (format: string, filename?: string) => {
    if (!run) return;
    const artifact = run.artifacts.find((a) => a.format === format);
    // A domain's PDF isn't listed until someone asks for it; the daemon renders it on request.
    const name = artifact?.filename ?? filename;
    if (!name) return;
    setBusy(format);
    setError(null);
    try {
      await downloadArtifact(run.id, format, name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const saveSettings = async (settings: AnalysisSettings) => {
    setBusy("settings");
    try {
      await updateProject(projectId, { settings });
      await loadProject();
      setShowSettings(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  /** The domains this run wrote a Markdown for, in report order. */
  const perDomain = (run?.artifacts ?? []).flatMap((a) => {
    const m = /^markdown:(.+)$/.exec(String(a.format));
    return m ? [{ category: m[1], label: CATEGORY_LABEL[m[1]] ?? m[1], md: a }] : [];
  });

  if (notFound) {
    return (
      <div className="page fr-page">
        <BackLink />
        <p className="fr-quiet fr-gap">That report project no longer exists. It may have been deleted.</p>
      </div>
    );
  }

  const live = run !== null && !TERMINAL.has(run.status);
  const cancelled = run?.status === "cancelled";

  return (
    <div className="page fr-page">
      <BackLink />
      <div className="fr-head fr-head--project">
        <div className="fr-head__text">
          <h1 className="fr-title fr-title--project">{project?.name ?? "Loading…"}</h1>
          <p className="fr-intro">
            {project ? (
              <>
                Reading <b>{project.repositoryDisplayName}</b> · {project.settings.depth} analysis
                {project.settings.networkResearch ? " · external research on" : " · nothing leaves this computer"}
              </>
            ) : (
              " "
            )}
          </p>
          {/* The folder in full: a display name is a basename, and two folders called `app` look the same by it. */}
          {project?.repositoryPath ? (
            <p className="fr-path" title="The folder being analyzed">
              {project.repositoryPath}
            </p>
          ) : null}
        </div>
        <div className="fr-head__actions">
          <button type="button" className="btn btn--sm" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>
            <Settings2 size={13} aria-hidden="true" /> Settings
          </button>
          {/* Beside the exports: importing answers is the inverse of exporting. Only once a run has finished. */}
          {run && !live ? (
            <button type="button" className="btn btn--sm" onClick={() => setShowImport((v) => !v)} aria-expanded={showImport}>
              <FileUp size={13} aria-hidden="true" /> Import responses
            </button>
          ) : null}
          {live ? (
            <button type="button" className="btn btn--sm" onClick={() => void stop()} disabled={busy === "cancel"}>
              <Square size={12} aria-hidden="true" /> {busy === "cancel" ? "Stopping…" : "Stop"}
            </button>
          ) : (
            <button type="button" className="btn btn--sm btn--primary" onClick={() => void start()} disabled={busy === "run"}>
              {busy === "run" ? <Loader2 size={13} className="spin" aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
              {busy === "run" ? "Starting…" : runs.length > 0 ? "Re-run" : "Run the analysis"}
            </button>
          )}
          {/* Two formats, two buttons: Markdown still works when the PDF renderer won't start. */}
          {(["pdf", "markdown"] as const).map((format) => {
            const artifact = run?.artifacts.find((a) => a.format === format);
            if (!artifact) return null;
            const Glyph = format === "pdf" ? Download : FileDown;
            return (
              <button key={format} type="button" className="btn btn--sm" onClick={() => void download(format)} disabled={busy !== null} title={`${artifact.filename} · ${(artifact.bytes / 1024).toFixed(0)} KB`}>
                <Glyph size={13} aria-hidden="true" /> {busy === format ? "Saving…" : format === "pdf" ? "PDF" : "Markdown"}
              </button>
            );
          })}
        </div>
      </div>

      {/* One report per domain: every domain gets its own Markdown on every run; its PDF is rendered the first time
          it's asked for, so that button can take a moment the first time. */}
      {perDomain.length > 0 ? (
        <details className="fr-domains">
          <summary>One report per domain ({perDomain.length})</summary>
          <ul className="fr-domains__list">
            {perDomain.map(({ category, label, md }) => (
              <li key={category}>
                <span className="fr-domains__name">{label}</span>
                <span className="fr-domains__btns">
                  <button type="button" className="fr-btn" onClick={() => void download(`markdown:${category}`)} disabled={busy !== null} title={`${md.filename} · ${(md.bytes / 1024).toFixed(0)} KB`}>
                    {busy === `markdown:${category}` ? "…" : ".md"}
                  </button>
                  <button type="button" className="fr-btn" onClick={() => void download(`pdf:${category}`, md.filename.replace(/\.md$/i, ".pdf"))} disabled={busy !== null} title="Rendered when you ask for it, then kept">
                    {busy === `pdf:${category}` ? "Rendering…" : ".pdf"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {showImport && run && !live ? (
        <ResponseImport
          run={run}
          onClose={() => setShowImport(false)}
          onApplied={(next, applied) => {
            setRun(next);
            setShowImport(false);
            setError(applied === 0 ? "Nothing was imported." : null);
          }}
        />
      ) : null}

      {showSettings && project ? <SettingsPanel settings={project.settings} busy={busy === "settings"} onCancel={() => setShowSettings(false)} onSave={(s) => void saveSettings(s)} /> : null}

      {error ? (
        <p className="fr-alert fr-alert--bad" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      ) : null}

      {/* The summary holds the trend and history whenever it's shown; this row is for runs with no summary (one still
          going, one that failed), so selecting such a run is never a way in with no way back. */}
      {runs.length > 1 && !(run && !live && run.summary) ? <RunPicker runs={runs} selected={run?.id ?? null} onSelect={(id) => void loadRuns(id)} /> : null}

      {run === null ? (
        <div className="fr-emptybox">
          <h2>Nothing has been read yet</h2>
          <p>Run the analysis and FlowCode will read the files in this folder, produce fifteen sections, and write a Markdown and a PDF report you can download.</p>
        </div>
      ) : null}

      {live && run ? <LiveRun run={run} running={running} /> : null}

      {cancelled ? (
        <p className="fr-alert">
          <Info size={14} aria-hidden="true" /> This run was cancelled. What's below is whatever finished before it stopped: sections not listed were never started, and this isn't a reading of the whole repository.
        </p>
      ) : null}

      {run && (run.warnings.length > 0 || run.errors.length > 0) ? <Notices run={run} /> : null}

      {/* `!live` means finished, which is also the only time resolving makes sense. */}
      {run && !live ? (
        <ReportView
          run={run}
          onRunChange={setRun}
          runs={runs}
          onSelectRun={(id) => void loadRuns(id)}
          onDeleteRun={(id) => {
            // No id to the reload: the selected run may be the one that just went, so the newest survivor is chosen.
            void deleteRun(id)
              .then(() => loadRuns())
              .catch((e: Error) => setError(`That run couldn't be removed: ${e.message}`));
          }}
        />
      ) : null}

      {run ? <DiagnosticLog runId={run.id} events={log} onOpen={() => void runLog(run.id).then(setLog).catch(() => setLog([]))} /> : null}
    </div>
  );
}

function BackLink() {
  return (
    <button type="button" className="fr-back" onClick={() => navigate("/flowreport")}>
      <ArrowLeft size={13} aria-hidden="true" /> All report projects
    </button>
  );
}

/**
 * The run as it happens. The percentage comes from the daemon, derived from work actually finished: nothing here
 * advances on a timer (a timed bar reaches 100% while work remains, and someone closes the window on a half-run).
 */
function LiveRun({ run, running }: { run: FlowReportRun; running: boolean }) {
  const pct = Math.round((run.progress ?? 0) * 100);
  const byCategory = new Map(run.sections.map((s) => [s.category, s]));
  return (
    <section className="fr-band fr-live" aria-label="Run progress">
      <div className="fr-live__top">
        <span className="fr-live__stage">
          <Loader2 size={15} className="spin" aria-hidden="true" /> {run.currentStage ?? STATUS_LABEL[run.status] ?? run.status}
        </span>
        <span className="fr-live__pct">{pct}%</span>
      </div>
      <div className="fr-bar fr-bar--lg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Run progress">
        <i style={{ width: `${pct}%` }} />
      </div>
      {!running ? <p className="fr-warn-text">The daemon is no longer reporting this run as active. It may have finished, or it may have stopped without saying so. This page will keep checking.</p> : null}
      <ul className="fr-live__sections">
        {REPORT_CATEGORIES.map((c) => {
          const state = byCategory.get(c)?.status ?? "pending";
          const done = state === "completed" || state === "completed_with_warnings";
          const active = state === "in_progress";
          return (
            <li key={c} className={done || active ? "is-on" : undefined}>
              {done ? <Check size={12} className="fr-tone--ok" aria-hidden="true" /> : active ? <Loader2 size={12} className="spin fr-accent" aria-hidden="true" /> : state === "failed" ? <AlertTriangle size={12} className="fr-tone--bad" aria-hidden="true" /> : <span className="fr-live__todo" aria-hidden="true" />}
              {CATEGORY_LABEL[c]}
              <span className="sr-only"> ({STATUS_LABEL[state] ?? state})</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * What a run couldn't do, and a way to put it away. Dismissed, not deleted: a line says how many are hidden and brings
 * them back. Kept per run in this browser (a new scan that fails the same way should say so again), keyed by the text
 * so a re-read with one fewer warning doesn't hide the wrong one.
 */
const noticeStoreKey = (runId: string) => `fc.flowreport.notices-dismissed.${runId}`;
function readDismissed(runId: string): Set<string> {
  try {
    const raw = localStorage.getItem(noticeStoreKey(runId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    // Storage blocked or unreadable: showing every notice is the safe way to fail.
    return new Set();
  }
}
function writeDismissed(runId: string, keys: Set<string>) {
  try {
    localStorage.setItem(noticeStoreKey(runId), JSON.stringify([...keys]));
  } catch {
    /* the dismissal still holds for this visit */
  }
}
interface Notice {
  kind: "error" | "warning";
  stage: string;
  message: string;
}
const noticeKey = (n: Notice) => `${n.kind}:${n.stage}:${n.message}`;

function Notices({ run }: { run: FlowReportRun }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed(run.id));
  const [showHidden, setShowHidden] = useState(false);
  // Each run has its own: switching runs must not carry one report's dismissals onto another.
  useEffect(() => {
    setDismissed(readDismissed(run.id));
    setShowHidden(false);
  }, [run.id]);
  const notices: Notice[] = [...run.errors.map((e) => ({ kind: "error" as const, stage: e.stage, message: e.message })), ...run.warnings.map((w) => ({ kind: "warning" as const, stage: w.stage, message: w.message }))];
  const hiddenCount = notices.filter((n) => dismissed.has(noticeKey(n))).length;
  const visible = showHidden ? notices : notices.filter((n) => !dismissed.has(noticeKey(n)));
  const dismiss = (n: Notice) => {
    const next = new Set(dismissed).add(noticeKey(n));
    setDismissed(next);
    writeDismissed(run.id, next);
  };

  return (
    <div className="fr-notices">
      {visible.map((n) => (
        <div key={noticeKey(n)} className={`fr-alert ${n.kind === "error" ? "fr-alert--bad" : "fr-alert--warn"}`}>
          {n.kind === "error" ? <AlertTriangle size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}
          <p className="fr-grow">
            <span className="fr-quiet">{n.stage}</span> — {n.message}
          </p>
          <button type="button" className="fr-iconbtn" onClick={() => dismiss(n)} title="Dismiss this notice for this report" aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
      {hiddenCount > 0 ? (
        <button type="button" className="fr-link fr-link--under" onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? "Hide dismissed notices again" : `${hiddenCount} dismissed notice${hiddenCount === 1 ? "" : "s"}: show`}
        </button>
      ) : null}
    </div>
  );
}

function SettingsPanel({ settings, busy, onCancel, onSave }: { settings: AnalysisSettings; busy: boolean; onCancel: () => void; onSave: (s: AnalysisSettings) => void }) {
  const [draft, setDraft] = useState<AnalysisSettings>(settings);
  const toggles: Array<[keyof AnalysisSettings, string, string]> = [
    ["includeTests", "Read test files", "Tests say what the project believes about itself."],
    ["includeDocs", "Read documentation", "Off by default. Prose about code quotes code, and an analyser reading it counts the quotation: a report kept in docs/ was being read back in as evidence for itself."],
    ["includeDependencyManifests", "Read dependency manifests", "package.json and its equivalents, for what the project depends on."],
    ["excludeGenerated", "Skip generated files", "Bundles, lockfiles and minified output. Nobody edits these, and findings in them are noise."],
  ];
  return (
    <section className="fr-band" aria-labelledby="fr-settings-title">
      <div className="fr-band__head">
        <div>
          <h3 id="fr-settings-title" className="fr-band__title">
            Analysis settings
          </h3>
          <p className="fr-band__note">These apply to the next run. Existing reports keep the settings they were produced with.</p>
        </div>
      </div>
      <div className="fr-depth" role="radiogroup" aria-label="Depth">
        <span className="fr-quiet">Depth</span>
        {(["quick", "standard", "deep"] as const).map((d) => (
          <button key={d} type="button" role="radio" aria-checked={draft.depth === d} className={`fr-chip${draft.depth === d ? " is-on" : ""}`} onClick={() => setDraft({ ...draft, depth: d })}>
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
      <div className="fr-toggles">
        {toggles.map(([key, label, hint]) => (
          <label key={key} className="fr-toggle">
            <input type="checkbox" checked={Boolean(draft[key])} onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })} />
            <span>
              <b>{label}</b>
              <span>{hint}</span>
            </span>
          </label>
        ))}
      </div>
      {/* On by default: without it the findings are a catalog. A toggle because it costs time on a quick re-run. */}
      <label className="fr-toggle fr-toggle--wide">
        <input type="checkbox" checked={draft.tailoredWriting} onChange={(e) => setDraft({ ...draft, tailoredWriting: e.target.checked })} />
        <span>
          <b>Write the findings for this product</b>
          <span>A local model rewrites each finding in your product's own words (its users, its data, its flows) instead of the general wording. It can't change what was found: same problem, same files, same severity, and the measured statement is printed beside it. Nothing leaves this computer. Adds roughly a minute or two to a run; turn it off for a quick re-run.</span>
        </span>
      </label>
      {/* Off by default, and it says what turning it on means, where the choice is made. */}
      <label className="fr-toggle fr-toggle--wide">
        <input type="checkbox" checked={draft.networkResearch} onChange={(e) => setDraft({ ...draft, networkResearch: e.target.checked })} />
        <span>
          <b>Allow external research for competitive gaps</b>
          <span>Off by default. With it off, nothing about this repository leaves this computer and the competitive section compares against capabilities products of this kind commonly have, naming no competitor. Turning it on means search queries derived from the project go to an external service.</span>
        </span>
      </label>
      <div className="fr-band__foot fr-band__foot--end">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => onSave(draft)} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </section>
  );
}

/** What the run did, in order. Collapsed by default: it's for when someone needs to know why a section behaved as it did. */
function DiagnosticLog({ runId, events, onOpen }: { runId: string; events: RunLogEvent[] | null; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="fr-log">
      <button
        type="button"
        className="fr-log__toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && events === null) onOpen();
        }}
      >
        <Terminal size={13} aria-hidden="true" />
        <span className="fr-grow">What this run did, step by step</span>
        <ChevronDown size={14} className={`fr-log__chev${open ? " is-open" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="fr-log__body">
          {events === null ? <p className="fr-quiet">Loading…</p> : null}
          {events?.length === 0 ? <p className="fr-quiet">No entries were recorded for this run.</p> : null}
          {events?.map((e) => (
            <div key={e.id} className="fr-log__line">
              <span className="fr-log__time">{new Date(e.createdAt).toLocaleTimeString()}</span>
              <span className={`fr-log__stage fr-log__stage--${e.level}`}>{e.stage ?? e.level}</span>
              <span className="fr-log__msg">{e.message}</span>
            </div>
          ))}
          <p className="fr-log__id">Run {runId}</p>
        </div>
      ) : null}
    </section>
  );
}
