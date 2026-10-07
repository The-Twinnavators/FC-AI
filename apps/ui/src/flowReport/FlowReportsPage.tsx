/**
 * FlowReport's list (#/flowreport): every repository you analyse, as a card with its last reading.
 *  - A project is a folder you keep coming back to: the second run is comparable to the first (same settings, same
 *    analysis version) and the history is somewhere you can find it.
 *  - The card shows the last run, not the project: whether the last reading was clean, when, and whether it's still
 *    running. A project never run says so instead of showing an empty score.
 *  - Display names only, never paths: the folder's location appears on the project page and in the folder browser.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, FileSearch, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FolderBrowser } from "../components/FolderBrowser";
import { navigate } from "../router";
import { BROWSE_ROUTES, createProject, deleteProject, listProjects, listRuns, scoreBand, sevClass, SEVERITY_LABEL, SEVERITY_ORDER, startRun, STATUS_LABEL, TERMINAL, type FlowReportProject, type FlowReportRun } from "./api";

/** A project and its latest run: undefined while loading (so "no runs yet" is never shown before it's known). */
type Row = { project: FlowReportProject; latest: FlowReportRun | null | undefined };

export function FlowReportsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const projects = await listProjects();
      setRows(projects.map((project) => ({ project, latest: undefined })));
      // Runs per project, so one whose history fails shows as unknown instead of taking the page down.
      for (const project of projects) {
        const put = (latest: FlowReportRun | null) => setRows((prev) => prev?.map((r) => (r.project.id === project.id ? { ...r, latest } : r)) ?? null);
        void listRuns(project.id)
          .then((runs) => put(runs[0] ?? null))
          .catch(() => put(null));
      }
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async (repositoryPath: string, displayName: string) => {
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({ repositoryPath, name: displayName });
      setPicking(false);
      navigate(`/flowreport/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };
  const run = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await startRun(id);
      navigate(`/flowreport/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };
  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteProject(id);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page fr-page">
      <div className="fr-head">
        <div className="fr-head__text">
          <h1 className="fr-title">
            <FileSearch size={20} aria-hidden="true" /> FlowReport
          </h1>
          <p className="fr-intro">Point FlowCode at a folder on this computer and it reads the code: fifteen sections, from error handling to security. Nothing is run, no dependency is installed, and no request leaves this computer.</p>
        </div>
        <div className="fr-head__actions">
          <button type="button" className="btn btn--sm" onClick={() => void load()}>
            <RefreshCw size={13} aria-hidden="true" /> Refresh
          </button>
          <button type="button" className="btn btn--sm btn--primary" data-cp="fr-new" onClick={() => setPicking(true)}>
            <Plus size={13} aria-hidden="true" /> New report
          </button>
        </div>
      </div>

      {error ? (
        <p className="fr-alert fr-alert--bad" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      ) : null}

      {rows === null ? (
        <p className="fr-loading">
          <Loader2 size={15} className="spin" aria-hidden="true" /> Loading your report projects…
        </p>
      ) : null}

      {rows?.length === 0 && !error ? (
        <div className="fr-emptybox">
          <FileSearch size={26} aria-hidden="true" className="fr-emptybox__icon" />
          <h2>No report projects yet</h2>
          <p>Choose a repository folder to start. FlowCode keeps the project so a second reading is comparable to the first, and so the history is somewhere you can find it.</p>
          <button type="button" className="btn btn--primary" onClick={() => setPicking(true)}>
            <Plus size={14} aria-hidden="true" /> Choose a repository
          </button>
        </div>
      ) : null}

      {rows?.length ? (
        <div className="fr-grid">
          {rows.map(({ project, latest }) => (
            <ProjectCard
              key={project.id}
              project={project}
              latest={latest}
              busy={busyId === project.id}
              confirming={confirmDelete === project.id}
              onOpen={() => navigate(`/flowreport/${project.id}`)}
              onRun={() => void run(project.id)}
              onAskDelete={() => setConfirmDelete(confirmDelete === project.id ? null : project.id)}
              onDelete={() => void remove(project.id)}
            />
          ))}
        </div>
      ) : null}

      {picking ? <FolderBrowser routes={BROWSE_ROUTES} busy={creating} note="FlowCode reads the files in this folder. It never writes to it, never runs anything in it, and never installs a dependency." onCancel={() => setPicking(false)} onChoose={(path, name) => void create(path, name)} /> : null}
    </div>
  );
}

function ProjectCard({ project, latest, busy, confirming, onOpen, onRun, onAskDelete, onDelete }: { project: FlowReportProject; latest: FlowReportRun | null | undefined; busy: boolean; confirming: boolean; onOpen: () => void; onRun: () => void; onAskDelete: () => void; onDelete: () => void }) {
  const running = !!latest && !TERMINAL.has(latest.status);
  const score = latest?.summary?.overallScore ?? null;
  const band = scoreBand(score);
  return (
    <div className="fr-card">
      <button type="button" className="fr-card__main" onClick={onOpen}>
        <div className="fr-card__top">
          <div className="fr-card__names">
            <h3 className="fr-card__name">{project.name}</h3>
            <p className="fr-card__sub">
              {project.repositoryDisplayName} · {project.settings.depth} analysis
            </p>
          </div>
          <ChevronRight size={15} className="fr-card__chev" aria-hidden="true" />
        </div>
        <div className="fr-card__reading">
          {latest === undefined ? <p className="fr-card__never">Loading history…</p> : null}
          {latest === null ? <p className="fr-card__never">Never run. Nothing has been read yet.</p> : null}
          {latest && running ? (
            <div>
              <p className="fr-card__stage">
                <Loader2 size={12} className="spin" aria-hidden="true" /> {latest.currentStage ?? STATUS_LABEL[latest.status] ?? latest.status}
              </p>
              <div className="fr-bar">
                <i style={{ width: `${Math.round((latest.progress ?? 0) * 100)}%` }} />
              </div>
            </div>
          ) : null}
          {latest && !running ? (
            <div className="fr-card__scorerow">
              <div>
                <div className={`fr-card__score fr-tone--${band.tone}`}>
                  {score ?? "—"}
                  {score !== null ? <span>/ 100</span> : null}
                </div>
                <p className={`fr-card__word fr-tone--${band.tone}`}>{band.word}</p>
              </div>
              {/* Every severity, the zeros too: dropping them would let "absent" read as "none found". */}
              <div className="fr-minisevs">
                {SEVERITY_ORDER.map((s) => {
                  const n = latest.summary?.severityCounts?.[s] ?? 0;
                  return (
                    <div key={s} className={`fr-minisev ${n > 0 ? sevClass(s) : "is-zero"}`} title={SEVERITY_LABEL[s]}>
                      <b>{n}</b>
                      <i />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </button>
      <div className="fr-card__foot">
        <span className="fr-card__when">{latest ? `${STATUS_LABEL[latest.status] ?? latest.status}${latest.completedAt ? ` · ${new Date(latest.completedAt).toLocaleDateString()}` : ""}` : "No runs"}</span>
        <div className="fr-card__btns">
          {/* Two clicks to delete, and the second says what goes: every reading ever taken of that repository. */}
          {confirming ? (
            <>
              <button type="button" className="fr-btn fr-btn--danger" onClick={onDelete} disabled={busy}>
                {busy ? "Deleting…" : "Delete project and all its runs"}
              </button>
              <button type="button" className="fr-link" onClick={onAskDelete}>
                Keep
              </button>
            </>
          ) : (
            <>
              <button type="button" className="fr-btn" onClick={onRun} disabled={busy || running}>
                <RefreshCw size={11} className={busy ? "spin" : undefined} aria-hidden="true" /> {running ? "Running" : latest ? "Re-run" : "Run"}
              </button>
              <button type="button" className="fr-iconbtn fr-iconbtn--bad" onClick={onAskDelete} aria-label={`Delete ${project.name}`}>
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
