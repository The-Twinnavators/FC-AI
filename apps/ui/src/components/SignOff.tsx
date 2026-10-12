/**
 * Your review of a prototype build: it isn't complete until you have looked at every page and user journey, approved
 * each or said what should change, and signed off. Pick a page or journey on the left; it opens in the preview at its
 * address on the right, with what it is for, what was checked and your notes. Notes save as drafts while you write.
 * "Send change requests" starts one follow-up build for just those; "Sign off" appears when everything is approved.
 * Nothing here is decided for you.
 */
import { useEffect, useRef, useState } from "react";
import { CHECKS, type VerificationCheck } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { ConfirmButton } from "./ConfirmButton";

type Decision = "pending" | "approved" | "changes_requested";
interface Item {
  id: string;
  kind: "page" | "workflow";
  name: string;
  purpose: string;
  route?: string;
  steps?: string[];
  files: string[];
  decision: Decision;
  note: string;
  draft: string;
  decidedVersion?: number;
  invalidated?: string;
  feedback?: "open" | "in_progress" | "addressed" | "confirmed";
}
interface Review {
  runId: string;
  state: "ready_for_review" | "changes_requested" | "updating" | "awaiting_rereview" | "signed_off";
  version: number;
  items: Item[];
  rounds: Array<{ at: string; version: number; followUpRunId: string; requests: Array<{ item: string; note: string }>; outcome?: string }>;
  signedOff?: { at: string; version: number };
}

const DECISION: Record<Decision, string> = { pending: "To review", approved: "Approved", changes_requested: "Changes requested" };
const FEEDBACK: Record<string, string> = { open: "Not sent yet", in_progress: "Being built", addressed: "Built: look again", confirmed: "Confirmed" };
const STATE: Record<Review["state"], string> = {
  ready_for_review: "Ready for your review",
  changes_requested: "Changes requested",
  updating: "Updating from your review",
  awaiting_rereview: "Ready for another look",
  signed_off: "Signed off",
};

export function SignOff({ runId, projectId, checks, onChanged }: { runId: string; projectId: string; checks: VerificationCheck[]; onChanged: () => void }) {
  const review = useResource<Review | null>(`/runs/${runId}/signoff`, [runId]);
  const live = useResource<{ url: string } | null>(`/projects/${projectId}/preview`, [projectId]);
  const [picked, setPicked] = useState<string>();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // No review answers with an empty reply.
  const r = review.data && Array.isArray(review.data.items) ? review.data : undefined;
  const item = r?.items.find((i) => i.id === picked) ?? r?.items.find((i) => i.decision !== "approved") ?? r?.items[0];
  // The note box shows the item's draft; switching items saves nothing new.
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (item && shown.current !== item.id) {
      shown.current = item.id;
      setText(item.draft);
    }
  }, [item]);
  // Drafts save a moment after you stop typing.
  useEffect(() => {
    if (!item || text === item.draft || r?.state === "updating" || r?.state === "signed_off") return;
    const t = window.setTimeout(() => void post(`/runs/${runId}/signoff/items/${encodeURIComponent(item.id)}`, { draft: text }).catch(() => undefined), 700);
    return () => window.clearTimeout(t);
  }, [text, item, runId, r?.state]);
  if (!r) return null;

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(undefined);
    try {
      await post(path, body);
      review.reload();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const decide = (decision: Decision) => item && act(`/runs/${runId}/signoff/items/${encodeURIComponent(item.id)}`, { decision, note: text });
  const approved = r.items.filter((i) => i.decision === "approved").length;
  const asks = r.items.filter((i) => i.decision === "changes_requested").length;
  const undecided = r.items.length - approved - asks;
  const locked = r.state === "updating" || r.state === "signed_off";
  const latest = new Map<string, VerificationCheck>();
  for (const c of checks) if (!c.taskId) latest.set(c.kind, c);
  const shownChecks = ["app_wiring", "tests", "design_qa", "typecheck"].map((k) => latest.get(k)).filter((c): c is VerificationCheck => !!c);
  const pages = r.items.filter((i) => i.kind === "page");
  const flows = r.items.filter((i) => i.kind === "workflow");

  return (
    <section className="signoff" aria-labelledby="signoff-h">
      <header className="signoff__head">
        <h3 className="ov__h" id="signoff-h">
          Your review
        </h3>
        <span className={`signoff__state signoff__state--${r.state}`}>{STATE[r.state]}</span>
        <span className="muted signoff__count">
          Version {r.version} · {approved} of {r.items.length} approved{asks ? ` · ${asks} with changes requested` : ""}
        </span>
      </header>
      {r.state === "signed_off" && r.signedOff ? (
        <p className="signoff__note">
          You signed off version {r.signedOff.version} on {new Date(r.signedOff.at).toLocaleString()}.
        </p>
      ) : r.state === "updating" ? (
        <p className="signoff__note" role="status">
          FlowCode is building your change requests. When it's done, the pages you asked about come back here for another look.
        </p>
      ) : (
        <p className="signoff__note">This prototype isn't complete until you've looked at every page and user journey, approved each one or said what should change, and signed off.</p>
      )}
      <div className="signoff__body">
        <nav className="signoff__list" aria-label="Pages and journeys to review">
          {[
            ["Pages", pages],
            ["User journeys", flows],
          ].map(([label, list]) =>
            (list as Item[]).length ? (
              <div key={label as string} className="signoff__group">
                <span className="label">{label as string}</span>
                {(list as Item[]).map((i) => (
                  <button key={i.id} type="button" className={`signoff__pick${item?.id === i.id ? " is-current" : ""}`} aria-current={item?.id === i.id ? "true" : undefined} onClick={() => setPicked(i.id)}>
                    <span className="signoff__pick-name">{i.name}</span>
                    <span className={`signoff__chip signoff__chip--${i.decision}`}>{DECISION[i.decision]}</span>
                  </button>
                ))}
              </div>
            ) : null,
          )}
        </nav>
        {item ? (
          <div className="signoff__detail">
            <div className="signoff__frame">
              {live.data?.url && item.route ? (
                <iframe key={item.id} title={`Preview of ${item.name}`} src={`${live.data.url.replace(/#.*$/, "")}${item.route}`} sandbox="allow-scripts allow-same-origin allow-forms" />
              ) : (
                <p className="muted signoff__noframe">Start the preview (Preview tab) to see this {item.kind === "page" ? "page" : "journey"} here.</p>
              )}
            </div>
            <dl className="kv signoff__facts">
              <dt>{item.kind === "page" ? "Page" : "Journey"}</dt>
              <dd>
                <strong>{item.name}</strong>
                {item.route ? <span className="muted mono"> {item.route}</span> : null}
              </dd>
              <dt>For</dt>
              <dd>{item.purpose}</dd>
              {item.steps?.length ? (
                <>
                  <dt>Steps</dt>
                  <dd>
                    <ol className="signoff__steps">{item.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                  </dd>
                </>
              ) : null}
              <dt>Built in</dt>
              <dd className="mono signoff__files">{item.files.join(", ")}</dd>
              {shownChecks.length ? (
                <>
                  <dt>Checked</dt>
                  <dd>
                    <ul className="signoff__checks">
                      {shownChecks.map((c) => (
                        <li key={c.kind}>
                          <span className={`signoff__check signoff__check--${c.status}`}>{CHECKS[c.kind]?.name ?? c.kind}</span> <span className="muted">{c.summary.slice(0, 220)}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              {item.invalidated || item.feedback ? (
                <>
                  <dt>Note</dt>
                  <dd>{[item.invalidated, item.feedback ? `Your last request: ${FEEDBACK[item.feedback]}${item.note ? ` ("${item.note.slice(0, 160)}")` : ""}` : ""].filter(Boolean).join(" ")}</dd>
                </>
              ) : null}
            </dl>
            {locked ? null : (
              <div className="signoff__decide">
                <label className="label" htmlFor="signoff-note">
                  Your notes on {item.name}
                </label>
                <textarea id="signoff-note" className="input signoff__text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What works, and what should change (needed to request changes)" />
                <div className="signoff__actions">
                  <button type="button" className="btn btn--sm" disabled={busy || !text.trim()} onClick={() => decide("changes_requested")}>
                    Request changes
                  </button>
                  <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => decide("approved")}>
                    Approve
                  </button>
                  {item.decision !== "pending" ? <span className="muted">Decided on version {item.decidedVersion}</span> : null}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="signoff__error" role="alert">
          {error}
        </p>
      ) : null}
      {locked ? null : (
        <footer className="signoff__foot">
          {undecided ? <span className="muted">{undecided} still to review</span> : null}
          <button type="button" className="btn btn--sm" disabled={busy || undecided > 0 || !asks} onClick={() => act(`/runs/${runId}/signoff/submit`)} title={undecided ? "Decide every page and journey first" : asks ? "Starts one follow-up build for these changes only" : "Nothing to change"}>
            Send {asks || ""} change request{asks === 1 ? "" : "s"}
          </button>
          {approved === r.items.length ? (
            <ConfirmButton className="btn btn--sm btn--primary" question={`Sign off version ${r.version}? It records that you approved every page and journey as they are now.`} confirmLabel="Sign off" cancelLabel="Not yet" onConfirm={() => act(`/runs/${runId}/signoff/sign`)}>
              Sign off
            </ConfirmButton>
          ) : null}
        </footer>
      )}
    </section>
  );
}
