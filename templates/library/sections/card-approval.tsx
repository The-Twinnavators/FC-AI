/** @flowcode-library card-approval · Approval queue (Cards)
 * Catalog ID: p.approval-card (pattern)
 * Function: The approval queue pattern (p.approval-card): requests decided one by one with a required scope, a timed Undo, focus that follows the queue, and an all-caught-up summary of decisions.
 * Use it as: import { ApprovalQueue } from "./card-approval"; <ApprovalQueue title lede? undoSeconds?={6} scopes={[{ id: "once"|"always"|"deny", label }]} requests={[{ id, kind, risk: "low"|"medium"|"high", customer, action, reason, affected: [], ifDenied, details }]} onDecide?={(id, scope) => ...} onUndo?={(id) => ...} />
 * Built from: c.card.surface, c.badge.status, c.radio, c.button.primary, c.button.secondary, c.button.destructive
 * Look: One bordered request card at a time under a progress strip: a risk chip header, the action as a heading, labeled details, a More details disclosure, a choice of how far approval reaches, and Approve / Deny buttons; an outcome bar with a counting-down Undo follows each decision.
 * Tokens: --color-surface --color-border --color-accent --color-success --color-danger --color-danger-surface --color-surface-sunken --color-text-muted --space-2 --space-4 --space-5 --radius-lg --font-display --focus-ring
 * Use cases: approval queue; refund requests; expense approvals; access requests; moderation queue; leave requests; change requests; review inbox
 * Jobs to be done: approve or deny pending requests; judge the risk before deciding; undo a decision made by mistake; clear the queue of requests
 * Keywords: approval, review, refund, decision, queue
 */
/**
 * Approval queue: requests that need a person's decision, one at a time, each with what is asked, why, what it
 * touches, a risk level and how far the decision reaches. Good for refunds, booking changes or any action a team
 * signs off. Make it the app's own: replace SAMPLE with the real requests and scopes; decisions stay on the page.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useEffect, useRef, useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Radio } from "./checkboxes-radios";

// ── p.approval-card: a queue of requests, one card at a time, each with its risk, details and a how-far-does-this-reach choice. ──

export type ApprovalRisk = "low" | "medium" | "high";
export type ApprovalScope = "once" | "always" | "deny";

export type ApprovalRequest = {
  id: string;
  /** What kind of request: "Refund". */
  kind: string;
  risk: ApprovalRisk;
  /** Who it concerns. */
  customer: string;
  /** What is being asked, in one line. */
  action: string;
  /** Why it was asked. */
  reason: string;
  /** What it touches, one line each. */
  affected: string[];
  /** What happens if it is denied. */
  ifDenied: string;
  /** Longer notes, shown under "More details". */
  details: string;
};

export type ApprovalQueueProps = {
  title: string;
  lede?: string;
  requests: ApprovalRequest[];
  /** The choices for how far an approval reaches; ids must be once, always and deny. */
  scopes: { id: ApprovalScope; label: string }[];
  /** How long Undo stays available after a decision. */
  undoSeconds?: number;
  /** Called when Approve or Deny is pressed. */
  onDecide?: (id: string, scope: ApprovalScope) => void;
  /** Called when a decision is undone within the Undo window. */
  onUndo?: (id: string) => void;
};

type Decision = { id: string; scope: ApprovalScope; at: number };

const outcomeText = (r: ApprovalRequest, s: ApprovalScope) =>
  s === "deny" ? `Denied: ${r.action}.` : s === "always" ? `Approved, and always allowed for ${r.customer}: ${r.action}.` : `Approved once: ${r.action}.`;

export function ApprovalQueue({ title, lede, requests, scopes, undoSeconds = 6, onDecide, onUndo }: ApprovalQueueProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [scope, setScope] = useState<ApprovalScope | "">("");
  const [error, setError] = useState("");
  const [last, setLast] = useState<Decision | null>(null);
  const [left, setLeft] = useState(0);
  const heading = useRef<HTMLElement | null>(null);
  const setHeading = (el: HTMLElement | null) => {
    heading.current = el;
  };
  const firstRender = useRef(true);

  const decided = new Set(decisions.map((x) => x.id));
  const pending = requests.filter((r) => !decided.has(r.id));
  const current = pending[0];

  // Count down the Undo window, then let the outcome go.
  useEffect(() => {
    if (!last) return;
    setLeft(undoSeconds);
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    const end = setTimeout(() => setLast(null), undoSeconds * 1000);
    return () => {
      clearInterval(t);
      clearTimeout(end);
    };
  }, [last, undoSeconds]);

  // Move focus to the next request (or the summary) after each decision or undo.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [current?.id]);

  const decide = (s: ApprovalScope | "") => {
    if (!current) return;
    if (!s) return setError("Choose how far this approval reaches.");
    const rec = { id: current.id, scope: s, at: Date.now() };
    setDecisions((xs) => [...xs, rec]);
    setLast(rec);
    setScope("");
    setError("");
    onDecide?.(current.id, s);
  };
  const undo = () => {
    if (!last) return;
    setDecisions((xs) => xs.filter((x) => x.id !== last.id));
    setScope(last.scope);
    setLast(null);
    onUndo?.(last.id);
  };

  const lastReq = last ? requests.find((r) => r.id === last.id) : undefined;
  const pos = current ? requests.indexOf(current) : -1;
  const errId = "card-approval-err";
  const riskTone = { high: "danger", medium: "warning", low: "success" } as const;

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="card-approval-title" data-fl="p.approval-card">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="card-approval-title" className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>

        <div className="fl-brd-queue">
          <div className="fl-brd-queue__bar">
            <span className="fl-meta">{pending.length ? `${pending.length} of ${requests.length} waiting` : "Nothing waiting"}</span>
            <ol className="fl-brd-steps" aria-hidden="true">
              {requests.map((r) => (
                <li key={r.id} data-state={decided.has(r.id) ? "done" : r.id === current?.id ? "current" : "todo"} />
              ))}
            </ol>
          </div>

          <div role="status" aria-live="polite">
            {last && lastReq ? (
              <div className={`fl-brd-outcome${last.scope === "deny" ? " fl-brd-outcome--deny" : ""}`}>
                <span>{outcomeText(lastReq, last.scope)}</span>
                <Button variant="secondary" size={32} onClick={undo}>
                  Undo <span className="fl-brd-mono" aria-hidden="true">({Math.max(left, 0)}s)</span>
                </Button>
              </div>
            ) : null}
          </div>

          {current ? (
            <Card variant="surface" className={`fl-brd-appr${current.risk === "high" ? " fl-brd-appr--high" : ""}`} style={{ padding: 0, gap: 0 }} role="group" aria-labelledby="card-approval-action">
              <header className="fl-brd-appr__head">
                <Badge look="chip" tone={riskTone[current.risk]}>
                  {current.risk} risk
                </Badge>
                <span className="fl-brd-label">{current.kind}</span>
                <span className="fl-brd-label">
                  Request {pos + 1} of {requests.length}
                </span>
              </header>
              <div className="fl-brd-appr__body">
                <h3 id="card-approval-action" ref={setHeading} tabIndex={-1} className="fl-brd-appr__action">
                  {current.action}
                </h3>
                <dl>
                  <dt className="fl-brd-label">Customer</dt>
                  <dd>{current.customer}</dd>
                  <dt className="fl-brd-label">Why</dt>
                  <dd>{current.reason}</dd>
                  <dt className="fl-brd-label">Affects</dt>
                  <dd>
                    <ul>
                      {current.affected.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </dd>
                  <dt className="fl-brd-label">If denied</dt>
                  <dd className="fl-meta">{current.ifDenied}</dd>
                </dl>
                <details>
                  <summary className="fl-brd-label">More details</summary>
                  <p>{current.details}</p>
                </details>
                <fieldset className="fl-brd-scope" aria-invalid={!!error} aria-describedby={error ? errId : undefined}>
                  <legend className="fl-brd-label">How far does this reach?</legend>
                  {scopes.map((s) => (
                    <Radio
                      key={s.id}
                      name={`scope-${current.id}`}
                      value={s.id}
                      label={s.label}
                      checked={scope === s.id}
                      onChange={() => {
                        setScope(s.id);
                        setError("");
                      }}
                    />
                  ))}
                  {error ? (
                    <p id={errId} className="fl-brd-error">
                      {error}
                    </p>
                  ) : null}
                </fieldset>
              </div>
              <footer className="fl-brd-appr__actions">
                <Button
                  variant="primary"
                  disabled={scope === "deny"}
                  aria-describedby={scope === "deny" ? "card-approval-hint" : undefined}
                  onClick={() => decide(scope)}
                >
                  {scope === "always" ? "Approve for this customer" : "Approve"}
                </Button>
                <Button variant="destructive" onClick={() => decide("deny")}>
                  Deny
                </Button>
                {scope === "deny" ? (
                  <span id="card-approval-hint" className="fl-meta" style={{ alignSelf: "center" }}>
                    You picked Deny; press Deny to confirm.
                  </span>
                ) : null}
              </footer>
            </Card>
          ) : (
            <div className="fl-brd-empty">
              <strong ref={setHeading} tabIndex={-1}>
                All caught up
              </strong>
              <p>Every request has a decision.</p>
              <ul className="fl-brd-log" aria-label="Decisions made">
                {decisions.map((x) => {
                  const r = requests.find((q) => q.id === x.id)!;
                  return (
                    <li key={x.id}>
                      <span>{r.action}</span>
                      <Badge look="soft" tone={x.scope === "deny" ? "danger" : "success"}>
                        {x.scope === "deny" ? "Denied" : x.scope === "always" ? "Always" : "Once"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
              <Button
                variant="secondary"
                onClick={() => {
                  setDecisions([]);
                  setLast(null);
                }}
              >
                Start over with the samples
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Waiting for your decision",
  lede: "Each request needs a yes or no before it goes ahead.",
  undoSeconds: 6,
  scopes: [
    { id: "once", label: "Just this once" },
    { id: "always", label: "Always for this customer" },
    { id: "deny", label: "Deny" },
  ] as { id: ApprovalScope; label: string }[],
  requests: [
    {
      id: "r1",
      kind: "Refund",
      risk: "medium",
      customer: "Priya Natarajan",
      action: "Refund $64.00 for a cancelled pottery class",
      reason: "The class on 3 October was cancelled by the studio with less than a day's notice.",
      affected: ["Order #4821 · Wheel throwing, beginners", "Card ending 2207"],
      ifDenied: "Priya keeps a class credit instead of the money.",
      details: "Booked 12 September, paid in full. Our policy refunds any class we cancel inside 48 hours. No earlier refunds on this account.",
    },
    {
      id: "r2",
      kind: "Booking change",
      risk: "low",
      customer: "Tom Okafor",
      action: "Move a 2-person table from Friday 7pm to Saturday 7pm",
      reason: "Guest asked by message; Saturday has free tables at that time.",
      affected: ["Booking #B-1093", "Saturday 7pm seating"],
      ifDenied: "The Friday booking stays as it is.",
      details: "No deposit on this booking. Change made more than 24 hours ahead, so no fee applies.",
    },
    {
      id: "r3",
      kind: "Refund",
      risk: "high",
      customer: "Jess Moreau",
      action: "Refund $420.00 for a 10-week course already half done",
      reason: "Customer is moving away and asks for the unused weeks back.",
      affected: ["Order #4710 · Evening life drawing", "Weeks 6 to 10", "Card ending 9134"],
      ifDenied: "Jess can transfer the remaining weeks to a friend.",
      details: "Our policy does not refund courses after week 2. This would be an exception; a partial refund of $210 covers only the unused weeks.",
    },
  ] as ApprovalRequest[],
};

export default function CardApproval() {
  return <ApprovalQueue {...SAMPLE} />;
}
