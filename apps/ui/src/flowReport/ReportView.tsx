/**
 * A finished Repo Report run, on screen.
 *  - All fifteen sections, always: one that found nothing, failed or doesn't apply still gets a row saying which, so a
 *    failed analyser never looks like a clean result.
 *  - Severity has the colour; confidence is set in words. Two colour scales and nobody can tell which means urgent.
 *  - The Claude Code prompt is a block you copy (monospace, a Copy button), never hidden behind a disclosure.
 *  - Layout: the summary and the sections are full-width bands with dividers; findings are rows inside an open section,
 *    not cards inside a card.
 */
import { useId, useState, type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, Copy, FileWarning, ScanSearch, Terminal } from "lucide-react";
import { RobotHead, ROLE_COLOR } from "../components/RobotHead";
import { addResponse, CATEGORY_LABEL, deleteResponse, editResponse, scoreBand, setFindingStatus, sevClass, SEVERITY_LABEL, SEVERITY_ORDER, STATUS_LABEL, type Finding, type FindingStatus, type FlowReportRun, type ReportSection, type ReportSummary } from "./api";
import { ResponseList } from "./ResponseList";
import { RunHistoryList, RunTrend } from "./RunHistory";

type Resolve = (f: Finding, next: FindingStatus, reason?: string) => Promise<void>;

export function ReportView({ run, onRunChange, runs, onSelectRun, onDeleteRun }: { run: FlowReportRun; onRunChange?: (run: FlowReportRun) => void; runs?: FlowReportRun[]; onSelectRun?: (id: string) => void; onDeleteRun?: (id: string) => void }) {
  // The worst-scoring section with findings opens by default: the page answers "where is the problem" before a click.
  const [open, setOpen] = useState<string | null>(
    [...run.sections].filter((s) => s.findings.length > 0).sort((a, b) => (a.score ?? 101) - (b.score ?? 101))[0]?.category ?? null,
  );

  // Every change comes back as the whole recomputed run (scores move in several places); the page replaces what it has.
  const resolve: Resolve | undefined = onRunChange
    ? async (f, next, reason) => {
        const res = next === "open" || !reason?.trim() ? await setFindingStatus(run.id, f.category, f.id, next, reason) : await addResponse(run.id, f.category, f.id, reason.trim(), next);
        onRunChange(res.run);
      }
    : undefined;
  const editOne = onRunChange
    ? async (responseId: string, body: string) => {
        const res = await editResponse(responseId, run.id, body);
        if (res.run) onRunChange(res.run);
      }
    : undefined;
  const deleteOne = onRunChange
    ? async (responseId: string) => {
        const res = await deleteResponse(responseId, run.id);
        if (res.run) onRunChange(res.run);
      }
    : undefined;

  return (
    <div className="fr-report">
      {run.summary ? <Summary run={run} runs={runs} onSelectRun={onSelectRun} onDeleteRun={onDeleteRun} /> : null}
      <section className="fr-block" aria-labelledby="fr-sections-title">
        <header className="fr-block__head">
          <h3 className="fr-block__title" id="fr-sections-title">
            Sections
          </h3>
          <span className="fr-block__hint">Open a section to see its findings and what to do about each.</span>
        </header>
      <div className="fr-sections">
        {run.sections.map((s) => (
          <SectionBlock key={s.category} section={s} expanded={open === s.category} onToggle={() => setOpen(open === s.category ? null : s.category)} onResolve={resolve} onEditResponse={editOne} onDeleteResponse={deleteOne} />
        ))}
      </div>
      </section>
    </div>
  );
}

/** The overall score as a ring (SVG, no chart library). A null score draws an empty track and says so: never a 0. */
function ScoreRing({ score }: { score: number | null }) {
  const band = scoreBand(score);
  const R = 62;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  return (
    <div className="fr-ring" role="img" aria-label={score === null ? "Overall health: insufficient evidence" : `Overall health ${score} of 100`}>
      <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden="true">
        {/* FlowCode's gauge gradient (the same as the Radial gauge on the Branding page). */}
        <defs>
          <linearGradient id="fr-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a60c4" />
            <stop offset="60%" stopColor="#5f7fd0" />
            <stop offset="100%" stopColor="var(--sig-ok)" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={R} className="fr-ring__track" />
        {score !== null ? <circle cx="70" cy="70" r={R} className="fr-ring__arc fr-ring__arc--brand" stroke="url(#fr-ring-grad)" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 70 70)" /> : null}
      </svg>
      <div className="fr-ring__text">
        <span className="fr-ring__label">Overall health</span>
        <span className="fr-ring__score">{score ?? "—"}</span>
        <span className={`fr-ring__word fr-tone--${band.tone}`}>{band.word}</span>
      </div>
    </div>
  );
}

/**
 * The score, the shape it has been making and the runs it came from, in one band. With a single run there's no trend
 * or history, so the prose sits beside the score instead of under it.
 */
function Summary({ run, runs, onSelectRun, onDeleteRun }: { run: FlowReportRun; runs?: FlowReportRun[]; onSelectRun?: (id: string) => void; onDeleteRun?: (id: string) => void }) {
  const s = run.summary!;
  const lists: Array<[string, string[]]> = [
    ["Priority actions", s.priorities],
    ["Quick wins", s.quickWins],
    ["Longer-term", s.longerTerm],
  ];
  const history = runs && runs.length > 1 && onSelectRun ? { runs, onSelect: onSelectRun } : null;

  return (
    <>
    <section className="fr-summary fr-block fr-block--card" aria-labelledby="fr-overview-title">
      <h3 className="fr-block__title" id="fr-overview-title">
        Overview
      </h3>
      <div className="fr-summary__top">
        <div className="fr-summary__score">
          <ScoreRing score={s.overallScore} />
          {/* Every severity, the zeros too: dropping them would let "absent" read as "none found". */}
          <div className="fr-sevcounts">
            {SEVERITY_ORDER.map((sev) => {
              const n = s.severityCounts?.[sev] ?? 0;
              return (
                <div key={sev} className={`fr-sevcount ${n > 0 ? sevClass(sev) : "is-zero"}`}>
                  <b>{n}</b>
                  <span>{SEVERITY_LABEL[sev]}</span>
                </div>
              );
            })}
          </div>
        </div>
        {history ? (
          <>
            <div className="fr-summary__trend">
              <h4 className="fr-eyebrow">Score trend</h4>
              <RunTrend runs={history.runs} selected={run.id} onSelect={history.onSelect} />
            </div>
            <div className="fr-summary__history">
              <h4 className="fr-eyebrow">Score history</h4>
              <RunHistoryList runs={history.runs} selected={run.id} onSelect={history.onSelect} onDelete={onDeleteRun} />
            </div>
          </>
        ) : (
          <div className="fr-summary__trend">
            <Narrative summary={s} />
          </div>
        )}
      </div>

      {history ? (
        <div className="fr-summary__prose">
          <Narrative summary={s} />
        </div>
      ) : null}

    </section>
    <section className="fr-block fr-block--card" aria-labelledby="fr-next-title">
      <h3 className="fr-block__title" id="fr-next-title">
        What to do next
      </h3>
      <div className="fr-summary__lists">
        {lists.map(([label, items]) => (
          <div key={label}>
            <h4 className="fr-eyebrow">{label}</h4>
            {items.length === 0 ? (
              <p className="fr-none">None recorded.</p>
            ) : (
              <ul className="fr-bullets">
                {items.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {s.couldNotVerify.length > 0 ? (
        <details className="fr-summary__unverified">
          <summary>What could not be verified ({s.couldNotVerify.length})</summary>
          <ul className="fr-bullets fr-bullets--quiet">
            {s.couldNotVerify.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
    </>
  );
}

function Narrative({ summary: s }: { summary: ReportSummary }) {
  return (
    <>
      <p className="fr-narrative">{s.narrative}</p>
      <p className="fr-fine">
        <b>How this score was calculated.</b> {s.scoreExplanation}
      </p>
      {/* A score improved by ticking a box isn't the same fact as one a scan produced: the measured figure stays beside it. */}
      {s.resolved ? (
        <p className="fr-fine">
          <b className="fr-tone--ok">
            {s.resolved.count} finding{s.resolved.count === 1 ? "" : "s"} marked resolved by hand.
          </b>{" "}
          {s.resolved.scoreAsMeasured === null ? "The scan itself produced no overall score. " : `This run measured ${s.resolved.scoreAsMeasured}. `}
          Marking something resolved records that work was done; it isn't a measurement, and only a new scan can confirm it. It applies to this report alone.
        </p>
      ) : null}
    </>
  );
}

/** Brings an element's top to the top of the page's scroll area (#main), just under its top edge. */
function scrollToTop(el: HTMLElement | null) {
  const main = document.getElementById("main");
  if (!el || !main) return;
  const top = main.scrollTop + el.getBoundingClientRect().top - main.getBoundingClientRect().top - 16;
  main.scrollTo({ top, behavior: "smooth" });
}

function SectionBlock({ section, expanded, onToggle, onResolve, onEditResponse, onDeleteResponse }: { section: ReportSection; expanded: boolean; onToggle: () => void; onResolve?: Resolve; onEditResponse?: (id: string, body: string) => Promise<void>; onDeleteResponse?: (id: string) => Promise<void> }) {
  const band = scoreBand(section.score);
  const failed = section.status === "failed";
  // Settled only when every finding is closed (resolved or not applicable). An empty section isn't settled either:
  // nothing found isn't the same as everything dealt with.
  const allSettled = section.findings.length > 0 && section.findings.every((f) => f.status === "resolved" || f.status === "not_applicable");
  // Findings carrying at least one response (two responses on one finding aren't two findings answered).
  const answered = section.findings.filter((f) => (f.responses ?? []).length > 0).length;
  const bodyId = `fr-sec-${section.category}`;

  return (
    <div className={`fr-section${expanded ? " is-open" : ""}`}>
      <button
        type="button"
        className="fr-section__head"
        onClick={(e) => {
          const sec = (e.currentTarget as HTMLElement).closest(".fr-section");
          const opening = !expanded;
          onToggle();
          // Opening one closes the one above it, which pulls everything up: once the page has settled, bring this
          // section's top to the top of the view (under the top bar) so it never ends up off screen.
          if (opening) requestAnimationFrame(() => requestAnimationFrame(() => scrollToTop(sec as HTMLElement | null)));
        }}
        aria-expanded={expanded}
        aria-controls={bodyId}
      >
        {/* A status dot, not an accent bar: teal when every finding here is closed. */}
        <span className={`fr-section__dot${allSettled ? " is-settled" : ""}`} title={allSettled ? "Every finding in this section is closed" : undefined} aria-hidden="true" />
        {expanded ? <ChevronDown size={14} className="fr-section__chev" aria-hidden="true" /> : <ChevronRight size={14} className="fr-section__chev" aria-hidden="true" />}
        <span className="fr-section__name">
          <b>{CATEGORY_LABEL[section.category] ?? section.category}</b>
          <span>
            {STATUS_LABEL[section.status] ?? section.status}
            {section.findings.length > 0 ? ` · ${section.findings.length} finding${section.findings.length === 1 ? "" : "s"}` : ""}
            {answered > 0 ? ` · ${answered} answered` : ""}
            {allSettled ? " · all closed" : ""}
          </span>
        </span>
        {/* Counts per severity, so the row says what kind of trouble it is, not only how much. */}
        <span className="fr-section__chips">
          {SEVERITY_ORDER.map((sev) => {
            const n = section.findings.filter((f) => f.severity === sev).length;
            return n ? (
              <span key={sev} className={`fr-sevchip ${sevClass(sev)}`}>
                {n} {SEVERITY_LABEL[sev].toLowerCase()}
              </span>
            ) : null;
          })}
        </span>
        <span className="fr-section__score">
          <b className={`fr-tone--${band.tone}`}>{section.score ?? "—"}</b>
          {section.score !== null ? <span> / 100</span> : null}
        </span>
      </button>

      {expanded ? (
        <div className="fr-section__body" id={bodyId}>
          {/* Why a section is empty or partial is the useful part of it being empty. */}
          {section.reason ? <p className="fr-reason">{section.reason}</p> : null}
          <p className="fr-section__summary">{section.summary || "No summary was produced for this section."}</p>
          {section.findings.length === 0 ? (
            <p className={`fr-empty-note${failed ? " is-bad" : ""}`}>
              {failed ? <AlertCircle size={14} aria-hidden="true" /> : <FileWarning size={14} aria-hidden="true" />}
              {section.status === "not_applicable" ? "This section doesn't apply to this repository." : failed ? "This section failed and produced no findings. Its absence here isn't a clean result." : "No findings were produced. That's a statement about this analyser and these files, not a guarantee that nothing is wrong."}
            </p>
          ) : (
            <ol className="fr-findings">
              {section.findings.map((f, i) => (
                <FindingBlock key={f.id} finding={f} index={i + 1} onResolve={onResolve} onEditResponse={onEditResponse} onDeleteResponse={onDeleteResponse} />
              ))}
            </ol>
          )}
          {section.limitations.length > 0 ? (
            <div className="fr-limits">
              <h4 className="fr-eyebrow">Limitations</h4>
              <ul className="fr-bullets fr-bullets--quiet">
                {section.limitations.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* Close from the bottom, then bring the section's header back into view so you're not left mid-page. */}
          <div className="fr-section__foot">
            <button
              type="button"
              className="btn btn--sm fr-section__close"
              onClick={(e) => {
                const sec = (e.currentTarget as HTMLElement).closest(".fr-section");
                onToggle();
                requestAnimationFrame(() => sec?.scrollIntoView({ block: "center", behavior: "smooth" }));
              }}
            >
              <ChevronDown size={14} aria-hidden="true" style={{ transform: "rotate(180deg)" }} /> Close {CATEGORY_LABEL[section.category] ?? "this section"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** A step arrives as `**Open the file** and confirm…`: only the bold lead-in is emphasised (split, not parsed). */
function renderLeadIn(text: string): ReactNode {
  const m = text.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
  if (!m) return text;
  return (
    <>
      <b>{m[1]}</b> {m[2]}
    </>
  );
}

/** One labelled part of a finding. Always shown, even when its content is an absence. */
/**
 * Who produced a part of a finding: the Repository analyst agent (the local model, writing for this finding) or
 * Repo Report's own checks (fixed rules that measure the code; not an agent).
 */
type By = "analyst" | "checks";
function ByLine({ by }: { by: By[] }) {
  const uid = useId().replace(/:/g, "");
  return (
    <span className="fr-part__by">
      {by.map((b) =>
        b === "analyst" ? (
          <span key={b} className="fr-by" title="Written for this finding by the Repository analyst agent (the local model)">
            <RobotHead color={ROLE_COLOR.repository_analyst!} id={`fr-by-${uid}`} size={18} />
            Repository analyst
          </span>
        ) : (
          <span key={b} className="fr-by fr-by--checks" title="Measured by Repo Report's checks: fixed rules run on the code, not an AI agent">
            <ScanSearch size={13} aria-hidden="true" />
            Repo Report checks
          </span>
        ),
      )}
    </span>
  );
}

function Part({ label, by, children }: { label: string; by?: By[]; children: ReactNode }) {
  return (
    <div className="fr-part">
      <h5 className="fr-part__label">
        <span>{label}</span>
        {by?.length ? <ByLine by={by} /> : null}
      </h5>
      <div className="fr-part__body">{children}</div>
    </div>
  );
}

function FindingBlock({ finding: f, index, onResolve, onEditResponse, onDeleteResponse }: { finding: Finding; index: number; onResolve?: Resolve; onEditResponse?: (id: string, body: string) => Promise<void>; onDeleteResponse?: (id: string) => Promise<void> }) {
  const [copied, setCopied] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // The reason box: `reason` is the draft; `touched` turns the requirement red only once someone has been in the field.
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const r = f.resolution;
  const done = f.status === "resolved" || f.status === "not_applicable";
  const responses = f.responses ?? [];
  // A decision with nothing said for it is an unfinished resolution: it keeps its place and asks for the account.
  const needsReason = Boolean(r) && responses.length === 0;
  const located = f.evidence.filter((e) => e.path);
  const unlocated = f.evidence.filter((e) => !e.path);
  const shared = new Set(located.map((e) => e.description.trim()));
  const collapse = shared.size === 1 && located.length > 1;
  const steps = f.tailored?.whatToDo ?? f.steps;

  const copy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard denied; the text is selectable either way */
    }
  };
  const openBox = () => {
    setReason(r?.reason ?? "");
    setTouched(false);
    setEditing(true);
  };
  const save = async () => {
    setTouched(true);
    // Guarded here as well as by the disabled button: a form can be submitted by keyboard.
    if (!onResolve || saving || !reason.trim()) return;
    setSaving(true);
    try {
      await onResolve(f, "resolved", reason.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  /** Reopen, or settle a finding that already has an account without asking for another. */
  const settle = async (next: FindingStatus) => {
    if (!onResolve || saving) return;
    setSaving(true);
    try {
      await onResolve(f, next);
    } finally {
      setSaving(false);
    }
  };

  return (
    // Dimmed rather than hidden: a resolved finding is still part of what the run found.
    <li className={`fr-finding${done ? " is-done" : ""}`}>
      <div className="fr-finding__head">
        <span className={`fr-finding__mark ${done ? "is-done" : sevClass(f.severity)}`} aria-hidden="true" />
        <div className="fr-finding__titles">
          {/* The measured title, always. */}
          <h4 className={`fr-finding__title ${done ? "" : sevClass(f.severity)}`}>
            {index}. {f.title}
          </h4>
          <p className="fr-finding__meta">
            {SEVERITY_LABEL[f.severity]} · Confidence: {f.confidence}
            {f.requiresManualValidation ? " · Requires manual validation" : ""}
            {done ? " · Resolved, not counted in the score" : ""}
            {needsReason ? " · Resolved before a reason was required" : ""}
          </p>
        </div>
        {/* Resolve records that a person says the work was done, and why. It isn't a measurement; only a new scan
            confirms it. Reversible, because the likeliest mistake is resolving the wrong one. */}
        {onResolve && !editing ? (
          <div className="fr-finding__actions">
            <button type="button" className={done ? "fr-okbtn" : "fr-btn"} onClick={openBox} disabled={saving} title={done ? "Read or revise the reason this was resolved." : "Record that this is dealt with, and why. A reason is required."}>
              <Check size={12} aria-hidden="true" /> {done ? "Resolved" : needsReason ? "Add a reason" : "Resolve"}
            </button>
            {done || needsReason ? (
              <button type="button" className="fr-btn" onClick={() => void settle("open")} disabled={saving} title="Reopen this finding. The reason is discarded and it counts again.">
                {saving ? "Saving…" : "Reopen"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* The reason is required, by the daemon too: a sentence someone can act on in six months. */}
      {editing ? (
        <div className="fr-tint">
          <label className="fr-tint__label" htmlFor={`r-${f.id}`}>
            Why is this resolved?
          </label>
          <textarea
            id={`r-${f.id}`}
            className={`textarea fr-textarea${touched && !reason.trim() ? " is-bad" : ""}`}
            value={reason}
            autoFocus
            rows={3}
            placeholder="What was changed, where, and how it was checked: enough for someone rereading this in six months."
            onChange={(e) => {
              setReason(e.target.value);
              setTouched(true);
            }}
            onBlur={() => setTouched(true)}
          />
          {/* Shown while the box is empty, so the disabled button is never a dead end. Red once it's been left empty. */}
          {!reason.trim() ? <p className={`fr-req${touched ? " is-bad" : ""}`}>A resolution reason is required.</p> : null}
          <div className="fr-row">
            <button type="button" className="fr-okbtn" onClick={() => void save()} disabled={saving || !reason.trim()}>
              {saving ? "Saving…" : r?.reason.trim() ? "Save reason" : "Resolve"}
            </button>
            <button type="button" className="fr-link" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* What has been said about this finding. Teal when it's closed; amber when it's answered but still counts. */}
      {!editing && (responses.length > 0 || r) ? (
        <div className={`fr-tint ${done ? "fr-tint--ok" : "fr-tint--warn"}`}>
          {needsReason ? <p className="fr-tint__text">Nothing has been recorded for this, so it still counts. It was resolved before an account was required: add one to close it again.</p> : null}
          {!done && responses.length > 0 && onResolve ? (
            <div className="fr-row fr-row--wrap">
              <p className="fr-warn-text fr-grow">Answered, but still open: this keeps counting towards the score until it's resolved or marked not applicable.</p>
              <button type="button" className="fr-okbtn" disabled={saving} onClick={() => void settle("resolved")}>
                {saving ? "Saving…" : "Mark resolved"}
              </button>
              <button type="button" className="fr-btn" disabled={saving} onClick={() => void settle("not_applicable")}>
                Not applicable
              </button>
            </div>
          ) : null}
          <ResponseList responses={responses} closes={done} onEdit={onEditResponse} onDelete={onDeleteResponse} />
          {r ? (
            <p className="fr-fine">
              Resolved {new Date(r.resolvedAt).toLocaleString()}
              {r.resolvedBy ? ` by ${r.resolvedBy}` : ""}
            </p>
          ) : null}
          {r?.titleChanged ? <p className="fr-warn-text">This finding has changed since the response was written: it read “{r.titleWhenResolved}”. Worth checking it still holds.</p> : null}
        </div>
      ) : null}

      {/* Two columns on wide screens, so "what was found" sits beside "why it matters". The prompt stays full width. */}
      <div className="fr-finding__parts">
        <Part label="What was found" by={f.tailored ? ["analyst", "checks"] : ["checks"]}>
          {f.tailored ? (
            <>
              <p>{f.tailored.whatItMeans}</p>
              <p>
                <span className="fr-quiet">Measured as. </span>
                {f.title}
              </p>
            </>
          ) : f.plain ? (
            <p>{f.plain.what}</p>
          ) : null}
          {!f.tailored && f.genericReading ? <p className="fr-aside">That paragraph is the general reading for this section rather than one written for this finding. The precise statement is the technical detail below.</p> : null}
          <p>
            <span className="fr-quiet">Technical detail. </span>
            {f.summary}
          </p>
          {f.impact && f.impact.trim() !== f.summary.trim() ? <p>{f.impact}</p> : null}
        </Part>

        <Part label="Where it was found" by={["checks"]}>
          {located.length === 0 && unlocated.length === 0 ? <p className="fr-quiet">No location. This finding is about something that was looked for and not found, so there's no file to point at.</p> : null}
          {collapse ? <p className="fr-quiet">{[...shared][0]} Found in:</p> : null}
          {located.length > 0 ? (
            <ul className="fr-locs">
              {located.map((e, i) => (
                <li key={i}>
                  <code className="fr-loc">
                    {e.path}
                    {e.lineStart ? `:${e.lineStart}${e.lineEnd ? `-${e.lineEnd}` : ""}` : ""}
                  </code>
                  {!collapse ? <span className="fr-quiet"> — {e.description}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {unlocated.length > 0 ? (
            <ul className="fr-bullets fr-bullets--quiet">
              {unlocated.map((e, i) => (
                <li key={i}>{e.description}</li>
              ))}
            </ul>
          ) : null}
          <p className="fr-fine">All paths are relative to the repository root.</p>
        </Part>

        <Part label="Why it matters" by={f.tailored ? ["analyst"] : ["checks"]}>
          {f.tailored ? (
            <p>{f.tailored.whyItMatters}</p>
          ) : f.plain ? (
            <>
              <p>{f.plain.soWhat}</p>
              <p>
                <span className="fr-quiet">If nothing is done. </span>
                {f.plain.ifIgnored}
              </p>
            </>
          ) : null}
          <p>
            <span className="fr-quiet">Rationale. </span>
            {f.rationale}
          </p>
        </Part>

        <Part label="Recommendations" by={["checks"]}>
          <p>{f.recommendation}</p>
        </Part>

        <Part label="What to do" by={f.tailored?.whatToDo ? ["analyst"] : ["checks"]}>
          {steps && steps.length > 0 ? (
            <ol className="fr-steps">
              {steps.map((t, i) => (
                <li key={i}>
                  <span className="fr-steps__n">{i + 1}.</span>
                  <span>{renderLeadIn(t)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="fr-quiet">No steps were derived for this finding.</p>
          )}
          {f.limitations && f.limitations.length > 0 ? (
            <div>
              <span className="fr-quiet">Before acting, note</span>
              <ul className="fr-bullets fr-bullets--quiet">
                {f.limitations.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Part>
      </div>

      <Part label="Claude Code prompt" by={["checks"]}>
        {f.claudeCodePrompts.length === 0 ? <p className="fr-quiet">No prompt was generated for this finding. It needs a decision or a look at something outside the repository before any change is the right one.</p> : null}
        {f.claudeCodePrompts.map((p, i) => (
          <div key={i} className="fr-prompt">
            <div className="fr-prompt__head">
              <span className="fr-prompt__title">
                <Terminal size={11} aria-hidden="true" />
                <span>{p.title}</span>
              </span>
              <button type="button" className="fr-btn" onClick={() => void copy(p.prompt, i)}>
                {copied === i ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
                {copied === i ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="fr-prompt__text">{p.prompt}</pre>
            <p className="fr-prompt__outcome">Intended outcome: {p.intendedOutcome}</p>
          </div>
        ))}
      </Part>
    </li>
  );
}
