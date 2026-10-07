/**
 * Prompts & Skills → Proposed by FlowCode: failures that keep happening in FlowCode's own runs, the skill it drafted
 * for each (switched off until you turn it on), and, once on, whether the failure actually happens less often.
 * Failures a prompt can't fix (model crashes, time-outs) are on System Health → Model problems.
 */
import { useState } from "react";
import { Check, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { post, useResource } from "../api";
import { Empty } from "./ui";
import { SkeletonBlock } from "./motion";
import { ConfirmDialog } from "./ConfirmDialog";
import { RobotHead, ROLE_COLOR, ROLE_LABEL } from "./RobotHead";

interface Pattern {
  id: string;
  category: string;
  title: string;
  count: number;
  runs: string[];
  examples: string[];
  lastSeen: string;
  needsCodeFix: boolean;
}
interface Item {
  patternId: string;
  skillId?: string;
  status: "drafting" | "proposed" | "enabled" | "dismissed" | "failed";
  error?: string;
  pattern?: Pattern;
  skill?: { id: string; purpose: string; instructions: string; roles: string[]; triggers: string[]; enabled?: boolean };
  effect?: { before: number; after: number; runsAfter: number; verdict: string };
}
interface View {
  items: Item[];
  dismissed?: Array<{ patternId: string; title: string; skillId?: string }>;
  codeFix: Pattern[];
  open: Pattern[];
  scanning: boolean;
  lastScanAt?: string;
}

const STATUS: Record<Item["status"], string> = { drafting: "Drafting…", proposed: "Waiting for your review", enabled: "On", dismissed: "Dismissed", failed: "Couldn't draft" };

export function SkillProposals({ onOpenSkill, layout = "cards", layoutToggle }: { onOpenSkill: (id: string) => void; layout?: "cards" | "list"; layoutToggle?: React.ReactNode }) {
  const { data, error, reload, loading } = useResource<View>("/skill-proposals", [], 6000);
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState<string>();
  // The proposal waiting for "Are you sure?" before it is dismissed.
  const [confirming, setConfirming] = useState<Item>();
  const act = async (path: string, id: string, done: string) => {
    setBusy(id);
    try {
      await post(path, { id });
      setMsg(done);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  const scan = async () => {
    const r = await post<{ started: boolean; reason?: string }>("/skill-proposals/scan");
    setMsg(r.started ? "Looking for repeated failures. New drafts appear here in a minute or two." : r.reason);
    reload();
  };

  if (!data) return <div style={{ padding: 16 }}>{error ? <p className="notice notice--bad" role="alert">{error}</p> : <SkeletonBlock rows={4} label="Reading FlowCode's run history" />}</div>;
  const live = data.items.filter((i) => i.status !== "dismissed");

  return (
    <div className="sprop">
      <div className="sprop__bar">
        <p className="muted">
          FlowCode reads its own last two weeks of runs for failures that keep happening (3 or more times, in 2 or more runs) and drafts a skill for each. Drafts stay off until you turn them on.
        </p>
        <div className="sprop__bar-actions">
          {layoutToggle}
          <button type="button" className="btn btn--sm" onClick={() => void scan()} disabled={data.scanning || loading}>
            <RefreshCw size={14} aria-hidden="true" className={data.scanning ? "spin" : undefined} /> {data.scanning ? "Looking…" : "Look for patterns now"}
          </button>
        </div>
      </div>
      {msg ? (
        <p className="notice" role="status" style={{ margin: 0 }}>
          {msg}
        </p>
      ) : null}

      {live.length ? (
        <ul className={`sprop__list${layout === "list" ? " sprop__list--rows" : ""}`}>
          {live.map((i) => (
            <li key={i.patternId} className={`sprop-item sprop-item--${i.status}`}>
              <div className="sprop-item__head">
                <span className={`sprop-item__status is-${i.status}`}>{STATUS[i.status]}</span>
                {i.pattern ? (
                  <span className="muted">
                    {i.pattern.count} times in {i.pattern.runs.length} runs
                  </span>
                ) : null}
              </div>
              <h3 className="sprop-item__title">{i.pattern?.title ?? i.patternId}</h3>
              {i.skill ? (
                <div className="sprop-item__skill">
                  <p>
                    <Sparkles size={13} aria-hidden="true" /> <strong>{i.skill.purpose}</strong>
                  </p>
                  {layout === "list" ? null : <pre className="sprop-item__instr">{i.skill.instructions}</pre>}
                  {layout === "list" ? null : (
                    <div className="sprop-item__agents">
                      {/* Who wrote this skill, and which agents follow it. */}
                      <span className="sprop-agent" title="The Documenter agent drafted this skill from the failures below">
                        <RobotHead color={ROLE_COLOR.documenter!} id={`sp-doc-${i.patternId}`} size={20} />
                        <span>
                          Drafted by <strong>Documenter</strong>
                        </span>
                      </span>
                      <span className="sprop-agent">
                        <span>Followed by</span>
                        {(i.skill.roles.length ? i.skill.roles : ["coder"]).map((r) => (
                          <span key={r} className="sprop-agent__who" title={ROLE_LABEL[r] ?? r}>
                            <RobotHead color={ROLE_COLOR[r] ?? "#9a9fd6"} id={`sp-${r}-${i.patternId}`} size={20} />
                            <strong>{ROLE_LABEL[r] ?? r}</strong>
                          </span>
                        ))}
                      </span>
                      <span className="muted sprop-item__meta">applies {i.skill.triggers.includes("*") ? "to every step" : `when a task mentions ${i.skill.triggers.join(", ")}`}</span>
                    </div>
                  )}
                </div>
              ) : null}
              {i.status === "failed" ? <p className="notice notice--bad" style={{ margin: 0 }}>{i.error}</p> : null}
              {layout !== "list" && i.pattern?.examples.length ? (
                <details className="sprop-item__evidence">
                  <summary>What happened ({i.pattern.examples.length} example{i.pattern.examples.length === 1 ? "" : "s"})</summary>
                  <ul>
                    {i.pattern.examples.map((x) => (
                      <li key={x} className="mono">
                        {x}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {layout !== "list" && i.effect ? (
                <p className="sprop-item__effect">
                  Before: {i.effect.before} per run · Since you turned it on: {i.effect.after} per run over {i.effect.runsAfter} run{i.effect.runsAfter === 1 ? "" : "s"}. {i.effect.verdict}
                </p>
              ) : null}
              <div className="sprop-item__actions">
                {i.status === "proposed" && i.skill ? (
                  <button type="button" className="btn btn--sm btn--primary" disabled={busy === i.patternId} onClick={() => void act("/skill-proposals/enable", i.patternId, `Turned on ${i.skill!.id}. FlowCode will compare how often this happens from now on.`)}>
                    <Check size={14} aria-hidden="true" /> Turn it on
                  </button>
                ) : null}
                {i.skill ? (
                  <button type="button" className="btn btn--sm" onClick={() => onOpenSkill(i.skill!.id)}>
                    Review or edit
                  </button>
                ) : null}
                {i.status === "enabled" ? (
                  <button type="button" className="btn btn--sm btn--ghost" disabled={busy === i.patternId} onClick={() => void act("/skill-proposals/disable", i.patternId, `Turned off ${i.skill?.id ?? "the skill"}. It stays in the list; turn it on again any time.`)}>
                    <X size={14} aria-hidden="true" /> Turn off
                  </button>
                ) : i.status !== "drafting" ? (
                  <button type="button" className="btn btn--sm btn--ghost" disabled={busy === i.patternId} onClick={() => setConfirming(i)}>
                    <X size={14} aria-hidden="true" /> Dismiss
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No proposals yet">
          {data.open.length ? `${data.open.length} repeated failure${data.open.length === 1 ? "" : "s"} found; use "Look for patterns now" to draft skills for them.` : "Nothing has failed often enough to need a skill. FlowCode checks again after each run."}
        </Empty>
      )}

      {data.open.length && live.length ? (
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          {data.open.length} more repeated failure{data.open.length === 1 ? "" : "s"} without a draft yet. FlowCode drafts up to two per look.
        </p>
      ) : null}

      {/* Failures a skill can't fix (the models or the machine) are on System Health → Model problems. */}
      {data.codeFix.length ? (
        <p className="muted sprop__elsewhere">
          {data.codeFix.length} other repeated failure{data.codeFix.length === 1 ? " comes" : "s come"} from the AI models or this computer, not from what the agents are told, so a skill can&apos;t fix {data.codeFix.length === 1 ? "it" : "them"}. See <a href="#/system/problems">System Health → Model problems</a>.
        </p>
      ) : null}

      {data.dismissed?.length ? (
        <section className="sprop__dismissed" aria-labelledby="sprop-dismissed">
          <h3 id="sprop-dismissed" className="styles-group__title">
            Dismissed ({data.dismissed.length})
          </h3>
          <ul>
            {data.dismissed.map((d) => (
              <li key={d.patternId}>
                <span>{d.title}</span>
                <button type="button" className="btn btn--sm" disabled={busy === d.patternId} onClick={() => void act("/skill-proposals/restore", d.patternId, "Restored. It's back in the list for your review, switched off.")}>
                  <RotateCcw size={14} aria-hidden="true" /> Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title={confirming.status === "enabled" ? "Turn off and dismiss this skill?" : "Dismiss this proposal?"}
          confirmLabel={confirming.status === "enabled" ? "Turn off and dismiss" : "Dismiss"}
          busy={busy === confirming.patternId}
          onCancel={() => setConfirming(undefined)}
          onConfirm={() => {
            const i = confirming;
            void act("/skill-proposals/dismiss", i.patternId, "Dismissed. You can restore it from the Dismissed list below.").then(() => setConfirming(undefined));
          }}
        >
          <p>
            <strong>{proposalTitle(confirming)}</strong>
          </p>
          <p>
            {confirming.status === "enabled" ? "The skill stops being used in builds, and " : "The drafted skill stays off, and "}
            FlowCode won&apos;t propose it again. You can restore it later from the Dismissed list at the bottom of this page.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** What the dialog calls the proposal: the failure it fixes, else its skill's purpose. */
function proposalTitle(i: Item): string {
  return i.pattern?.title ?? i.skill?.purpose ?? "This proposal";
}
