/**
 * Troubleshoot panel for a blocked task or run: likely causes (from pattern detectors, shown at once), a plain-language
 * explanation from the local model (filled in when ready), and one-click fixes.
 */
import { useEffect, useState } from "react";
import { ErrorNotice } from "./ui";
import { AlertTriangle, Cpu, Lightbulb, RefreshCw, RotateCcw, Send, Sparkles, Undo2, X } from "lucide-react";
import { post } from "../api";
import { ConfirmButton } from "./ConfirmButton";
import { navigate } from "../router";

interface Fix {
  id: string;
  label: string;
  detail: string;
  kind: "retry_with_guidance" | "follow_up" | "rerun_check" | "open_models" | "rollback";
  text?: string;
  check?: string;
}
interface Diagnosis {
  scope: "task" | "run";
  title: string;
  summary: string;
  causes: Array<{ id: string; title: string; evidence: string; confidence: "high" | "medium" }>;
  fixes: Fix[];
  explanation?: string;
  model?: string;
}

const FIX_ICON = { retry_with_guidance: RotateCcw, follow_up: Send, rerun_check: RefreshCw, open_models: Cpu, rollback: Undo2 } as const;

export function TroubleshootPanel({ runId, taskId, onClose, onChanged, onFollowUp }: { runId: string; taskId?: string; onClose: () => void; onChanged: () => void; onFollowUp: (text: string) => void }) {
  const [d, setD] = useState<Diagnosis>();
  const [explaining, setExplaining] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [done, setDone] = useState<string>();
  const [edit, setEdit] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    post<Diagnosis>(`/runs/${runId}/troubleshoot`, { taskId, explain: false })
      .then((x) => alive && setD(x))
      .catch((e) => alive && setError((e as Error).message));
    post<Diagnosis>(`/runs/${runId}/troubleshoot`, { taskId, explain: true })
      .then((x) => alive && setD((cur) => ({ ...(cur ?? x), explanation: x.explanation, model: x.model })))
      .catch(() => undefined)
      .finally(() => alive && setExplaining(false));
    return () => {
      alive = false;
    };
  }, [runId, taskId]);

  const apply = async (f: Fix) => {
    setBusy(f.id);
    setError(undefined);
    try {
      const text = edit[f.id] ?? f.text;
      if (f.kind === "retry_with_guidance" && taskId) {
        await post(`/runs/${runId}/tasks/${taskId}/retry`, { guidance: text });
        setDone("Retrying the task with that fix. The agent sees your guidance first.");
        onChanged();
      } else if (f.kind === "follow_up") {
        onFollowUp(text ?? "");
        onClose();
      } else if (f.kind === "rerun_check" && f.check) {
        await post(`/runs/${runId}/checks/${f.check}/rerun`);
        setDone("Checks re-ran. See the strip at the bottom.");
        onChanged();
      } else if (f.kind === "open_models") {
        navigate("/system/models");
      } else if (f.kind === "rollback" && taskId) {
        await post(`/runs/${runId}/tasks/${taskId}/rollback`);
        setDone("This task's changes were undone. You can retry it from a clean state.");
        onChanged();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <section className="tshoot" aria-label="Troubleshoot">
      <header className="tshoot__head">
        <Lightbulb size={16} aria-hidden="true" />
        <strong>{d?.title ?? "Looking into it…"}</strong>
        <button className="icon-btn" aria-label="Close troubleshooter" onClick={onClose} style={{ marginLeft: "auto" }}>
          <X size={16} />
        </button>
      </header>
      {error ? <ErrorNotice error={error} doing="look into this" /> : null}
      {done ? <p className="notice notice--ok" role="status" style={{ margin: 0 }}>{done}</p> : null}
      {!d && !error ? <p className="muted" style={{ margin: 0 }}>Reading the errors, commands and files involved…</p> : null}
      {d ? (
        <>
          <div className="tshoot__explain" aria-live="polite">
            <Sparkles size={14} aria-hidden="true" />
            {d.explanation ? (
              <p>
                {d.explanation}
                {d.model ? <span className="muted tshoot__model"> · {d.model}</span> : null}
              </p>
            ) : explaining ? (
              <p className="muted">The local model is writing a plain-language explanation…</p>
            ) : (
              <p className="muted">{d.summary}</p>
            )}
          </div>
          {d.causes.length ? (
            <div className="tshoot__block">
              <span className="label">Likely causes</span>
              <ul className="tshoot__causes">
                {d.causes.map((c) => (
                  <li key={c.id}>
                    <AlertTriangle size={14} aria-hidden="true" />
                    <span>
                      <strong>{c.title}</strong>
                      <span className="muted tshoot__evidence">{c.evidence}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {d.fixes.length ? (
            <div className="tshoot__block">
              <span className="label">Fixes</span>
              <ul className="tshoot__fixes">
                {d.fixes.map((f) => {
                  const Icon = FIX_ICON[f.kind];
                  return (
                    <li key={f.id} className="tshoot__fix">
                      <div className="tshoot__fix-top">
                        <span>
                          <strong>{f.label}</strong>
                          <span className="muted tshoot__evidence">{f.detail}</span>
                        </span>
                        {f.kind === "rollback" ? (
                          <ConfirmButton className={`btn btn--sm${f === d.fixes[0] ? " btn--primary" : ""}`} disabled={!!busy} question="Undo every file change this task made?" confirmLabel="Undo changes" onConfirm={() => apply(f)}>
                            <Icon size={14} aria-hidden="true" className={busy === f.id ? "spin" : undefined} />
                            Undo changes
                          </ConfirmButton>
                        ) : (
                          <button className={`btn btn--sm${f === d.fixes[0] ? " btn--primary" : ""}`} disabled={!!busy} onClick={() => void apply(f)}>
                            <Icon size={14} aria-hidden="true" className={busy === f.id ? "spin" : undefined} />
                            {f.kind === "retry_with_guidance" ? "Retry with this fix" : f.kind === "follow_up" ? "Send as follow-up" : f.kind === "rerun_check" ? "Re-run" : "Open Models"}
                          </button>
                        )}
                      </div>
                      {f.text && (f.kind === "retry_with_guidance" || f.kind === "follow_up") ? (
                        <details className="tshoot__text">
                          <summary>What the agent will be told</summary>
                          <label className="sr-only" htmlFor={`fix-${f.id}`}>
                            Instruction for the agent
                          </label>
                          <textarea id={`fix-${f.id}`} className="textarea" rows={3} value={edit[f.id] ?? f.text} onChange={(e) => setEdit((x) => ({ ...x, [f.id]: e.target.value }))} />
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
