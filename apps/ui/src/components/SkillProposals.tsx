/**
 * Prompts & Skills → Proposed by FlowCode: failures that keep happening in FlowCode's own runs, the skill it drafted
 * for each (switched off until you turn it on), and, once on, whether the failure actually happens less often.
 * Failures a prompt can't fix (model crashes, time-outs) are on System Health → Model problems.
 */
import { useState } from "react";
import { RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { post, useResource } from "../api";
import { Empty } from "./ui";
import { SkeletonBlock } from "./motion";
import { RobotHead, ROLE_COLOR } from "./RobotHead";
import { AgentHeads, CardSwitch, LibModal } from "./LibModal";

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

/** `waitingOnly` (Approvals): just the drafts that need your answer, without the scan controls or the ones already on. */
export function SkillProposals({ onOpenSkill, waitingOnly = false }: { onOpenSkill: (id: string) => void; waitingOnly?: boolean }) {
  const { data, error, reload, loading } = useResource<View>("/skill-proposals", [], 6000);
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState<string>();
  // The proposal open in the modal.
  const [openId, setOpenId] = useState<string>();
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
  const live = data.items.filter((i) => (waitingOnly ? i.status === "proposed" : i.status !== "dismissed"));
  const opened = data.items.find((i) => i.patternId === openId);
  const toggleSkill = (i: Item, on: boolean) =>
    void act(on ? "/skill-proposals/enable" : "/skill-proposals/disable", i.patternId, on ? `Turned on ${i.skill!.id}. FlowCode will compare how often this happens from now on.` : `Turned off ${i.skill?.id ?? "the skill"}. It stays in the list; turn it on again any time.`);
  const actionsFor = (i: Item) => (
    <>
      {i.skill ? (
        <button type="button" className="btn btn--primary" onClick={() => (setOpenId(undefined), onOpenSkill(i.skill!.id))}>
          Review or edit
        </button>
      ) : null}
    </>
  );

  return (
    <div className="sprop">
      {waitingOnly ? null : (
      <div className="library-grid__bar">
        <p className="muted">
          FlowCode reads its own last two weeks of runs for failures that keep happening (3 or more times, in 2 or more runs) and drafts a skill for each. Drafts stay off until you turn them on.
        </p>
        <div className="library-grid__actions">
          <button type="button" className="btn btn--sm" onClick={() => void scan()} disabled={data.scanning || loading}>
            <RefreshCw size={14} aria-hidden="true" className={data.scanning ? "spin" : undefined} /> {data.scanning ? "Looking…" : "Look for patterns now"}
          </button>
        </div>
      </div>
      )}
      {msg ? (
        <p className="notice" role="status" style={{ margin: 0 }}>
          {msg}
        </p>
      ) : null}

      {live.length ? (
        <ul className="lib-cards" aria-label="Proposed skills">
          {live.map((i) => (
            <li key={i.patternId} className={i.skill && (i.status === "enabled" || i.status === "proposed") ? "has-switch" : undefined}>
              <button type="button" className={`lib-card${i.status === "enabled" ? "" : " is-off"}`} onClick={() => setOpenId(i.patternId)}>
                <span className="lib-card__top">
                  <strong className="lib-card__title">{proposalTitle(i)}</strong>
                  {i.status === "enabled" ? null : <span className={`sprop-item__status is-${i.status}`}>{STATUS[i.status]}</span>}
                </span>
                <span className="lib-card__purpose">{i.skill?.purpose ?? (i.status === "failed" ? i.error : "Drafting a skill for this failure…")}</span>
                <span className="lib-card__meta">
                  {i.skill ? (
                    <span className="lib-card__used">
                      Used by <AgentHeads roles={i.skill.roles.length ? i.skill.roles : ["coder"]} id={`sp-${i.patternId}`} max={2} />
                    </span>
                  ) : null}
                  {i.pattern ? <span>{howOften(i.pattern)}</span> : null}
                </span>
              </button>
              {i.skill && (i.status === "enabled" || i.status === "proposed") ? (
                <CardSwitch
                  on={i.status === "enabled"}
                  disabled={busy === i.patternId}
                  label={`Use the skill for ${proposalTitle(i)}`}
                  onChange={(v) => toggleSkill(i, v)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : waitingOnly ? (
        <p className="apv-empty">No skills waiting for your review. FlowCode drafts one when the same failure keeps happening; it shows up here.</p>
      ) : (
        <Empty title="No proposals yet">
          {data.open.length ? `${data.open.length} repeated failure${data.open.length === 1 ? "" : "s"} found; use "Look for patterns now" to draft skills for them.` : "Nothing has failed often enough to need a skill. FlowCode checks again after each run."}
        </Empty>
      )}

      {!waitingOnly && data.open.length && live.length ? (
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

      {opened ? (
        <LibModal label={opened.status === "proposed" ? "Proposed skill · waiting for you" : "Proposed skill"} onClose={() => setOpenId(undefined)} actions={actionsFor(opened)}>
          <div className="sprop-detail">
            <div className="sprop-detail__head">
              <div>
                <h2 className="sprop-detail__title">{proposalTitle(opened)}</h2>
                {opened.pattern ? <p className="muted">{howOften(opened.pattern)}</p> : null}
              </div>
              <span className="sprop-detail__state">
                {opened.status === "enabled" ? null : <span className={`sprop-item__status is-${opened.status}`}>{STATUS[opened.status]}</span>}
                {/* On or off, the same switch as skills and servers. */}
                {opened.skill && (opened.status === "enabled" || opened.status === "proposed") ? (
                  <label className="mcp-switch" title={opened.status === "enabled" ? "On: agents use this skill" : "Off: turn it on to start using it"}>
                    <input type="checkbox" checked={opened.status === "enabled"} disabled={busy === opened.patternId} onChange={(e) => toggleSkill(opened, e.target.checked)} aria-label={`Use the skill for ${proposalTitle(opened)}`} />
                    <span aria-hidden="true" />
                  </label>
                ) : null}
              </span>
            </div>
            {opened.status === "failed" ? <p className="notice notice--bad" style={{ margin: 0 }}>{opened.error}</p> : null}
            {opened.skill ? (
              <section className="sprop-detail__section">
                <span className="sprop-item__label">
                  <Sparkles size={12} aria-hidden="true" /> The skill
                </span>
                <p className="sprop-item__purpose">{opened.skill.purpose}</p>
                <pre className="sprop-item__instr">{opened.skill.instructions}</pre>
                <div className="sprop-item__agents">
                  {/* Who wrote this skill, and which agents follow it. */}
                  <span className="sprop-agent" title={opened.pattern?.category === "taste" ? "The Documenter agent drafted this from your own requests below" : "The Documenter agent drafted this skill from the failures below"}>
                    <RobotHead color={ROLE_COLOR.documenter!} id={`sp-doc-${opened.patternId}`} size={20} />
                    <span>
                      Drafted by <strong>Documenter</strong>
                    </span>
                  </span>
                  <span className="sprop-agent">
                    <span>Followed by</span>
                    <AgentHeads roles={opened.skill.roles.length ? opened.skill.roles : ["coder"]} id={`spd-${opened.patternId}`} />
                  </span>
                  <span className="muted sprop-item__meta">applies {opened.skill.triggers.includes("*") ? "to every step" : `when a task mentions ${opened.skill.triggers.join(", ")}`}</span>
                </div>
              </section>
            ) : null}
            {opened.pattern?.examples.length ? (
              <section className="sprop-item__evidence">
                <span className="sprop-item__label">{opened.pattern.category === "taste" ? "What you asked" : "What happened"}</span>
                <ul>
                  {opened.pattern.examples.map((x) => (
                    <li key={x} className="mono">
                      {x}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {opened.effect ? (
              <section className="sprop-item__effect">
                <span className="sprop-item__label">Result</span>
                <p className="sprop-item__verdict">{opened.effect.verdict}</p>
                <p className="sprop-item__numbers">
                  Before: {opened.effect.before} per run · Since you turned it on: {opened.effect.after} per run over {opened.effect.runsAfter} run{opened.effect.runsAfter === 1 ? "" : "s"}
                </p>
              </section>
            ) : null}
          </div>
        </LibModal>
      ) : null}

    </div>
  );
}

/** How often: failures per run, or (taste) how many of your own requests asked for it. */
function howOften(p: Pattern): string {
  return p.category === "taste" ? `In ${p.count} of your requests` : `${p.count} times in ${p.runs.length} runs`;
}

/** What the dialog calls the proposal: the failure it fixes, else its skill's purpose. */
function proposalTitle(i: Item): string {
  return i.pattern?.title ?? i.skill?.purpose ?? "This proposal";
}
