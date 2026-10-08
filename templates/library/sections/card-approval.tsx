/**
 * Approval queue: requests that need a person's decision, one at a time, each with what is asked, why, what it
 * touches, a risk level and how far the decision reaches. Good for refunds, booking changes or any action a team
 * signs off. Make it the app's own: replace SAMPLE with the real requests and scopes; decisions stay on the page.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useEffect, useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Waiting for your decision",
  lede: "Each request needs a yes or no before it goes ahead.",
  undoSeconds: 6,
  scopes: [
    { id: "once", label: "Just this once" },
    { id: "always", label: "Always for this customer" },
    { id: "deny", label: "Deny" },
  ],
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
  ],
};

type Req = (typeof SAMPLE.requests)[number];
type Scope = "once" | "always" | "deny";
type Decision = { id: string; scope: Scope; at: number };

const outcomeText = (r: Req, s: Scope) =>
  s === "deny" ? `Denied: ${r.action}.` : s === "always" ? `Approved, and always allowed for ${r.customer}: ${r.action}.` : `Approved once: ${r.action}.`;

export default function CardApproval() {
  const d = SAMPLE;
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [scope, setScope] = useState<Scope | "">("");
  const [error, setError] = useState("");
  const [last, setLast] = useState<Decision | null>(null);
  const [left, setLeft] = useState(0);
  const heading = useRef<HTMLElement | null>(null);
  const setHeading = (el: HTMLElement | null) => {
    heading.current = el;
  };
  const firstRender = useRef(true);

  const decided = new Set(decisions.map((x) => x.id));
  const pending = d.requests.filter((r) => !decided.has(r.id));
  const current = pending[0];

  // Count down the Undo window, then let the outcome go.
  useEffect(() => {
    if (!last) return;
    setLeft(d.undoSeconds);
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    const end = setTimeout(() => setLast(null), d.undoSeconds * 1000);
    return () => {
      clearInterval(t);
      clearTimeout(end);
    };
  }, [last, d.undoSeconds]);

  // Move focus to the next request (or the summary) after each decision or undo.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [current?.id]);

  const decide = (s: Scope | "") => {
    if (!current) return;
    if (!s) return setError("Choose how far this approval reaches.");
    const rec = { id: current.id, scope: s, at: Date.now() };
    setDecisions((xs) => [...xs, rec]);
    setLast(rec);
    setScope("");
    setError("");
  };
  const undo = () => {
    if (!last) return;
    setDecisions((xs) => xs.filter((x) => x.id !== last.id));
    setScope(last.scope);
    setLast(null);
  };

  const lastReq = last ? d.requests.find((r) => r.id === last.id) : undefined;
  const pos = current ? d.requests.indexOf(current) : -1;
  const errId = "card-approval-err";

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="card-approval-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="card-approval-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <div className="fl-brd-queue">
          <div className="fl-brd-queue__bar">
            <span className="fl-meta">{pending.length ? `${pending.length} of ${d.requests.length} waiting` : "Nothing waiting"}</span>
            <ol className="fl-brd-steps" aria-hidden="true">
              {d.requests.map((r) => (
                <li key={r.id} data-state={decided.has(r.id) ? "done" : r.id === current?.id ? "current" : "todo"} />
              ))}
            </ol>
          </div>

          <div role="status" aria-live="polite">
            {last && lastReq ? (
              <div className={`fl-brd-outcome${last.scope === "deny" ? " fl-brd-outcome--deny" : ""}`}>
                <span>{outcomeText(lastReq, last.scope)}</span>
                <button type="button" className="fl-btn fl-btn--secondary fl-brd-btn--sm" onClick={undo}>
                  Undo <span className="fl-brd-mono" aria-hidden="true">({Math.max(left, 0)}s)</span>
                </button>
              </div>
            ) : null}
          </div>

          {current ? (
            <article className={`fl-brd-appr${current.risk === "high" ? " fl-brd-appr--high" : ""}`} aria-labelledby="card-approval-action">
              <header className="fl-brd-appr__head">
                <span className={`fl-brd-chip fl-brd-chip--${current.risk === "high" ? "bad" : current.risk === "medium" ? "warn" : "ok"}`}>
                  {current.risk} risk
                </span>
                <span className="fl-brd-label">{current.kind}</span>
                <span className="fl-brd-label">
                  Request {pos + 1} of {d.requests.length}
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
                  {d.scopes.map((s) => (
                    <label key={s.id}>
                      <input type="radio" name={`scope-${current.id}`} value={s.id} checked={scope === s.id} onChange={() => { setScope(s.id as Scope); setError(""); }} />
                      {s.label}
                    </label>
                  ))}
                  {error ? (
                    <p id={errId} className="fl-brd-error">
                      {error}
                    </p>
                  ) : null}
                </fieldset>
              </div>
              <footer className="fl-brd-appr__actions">
                <button
                  type="button"
                  className="fl-btn fl-btn--primary"
                  disabled={scope === "deny"}
                  aria-describedby={scope === "deny" ? "card-approval-hint" : undefined}
                  onClick={() => decide(scope)}
                >
                  {scope === "always" ? "Approve for this customer" : "Approve"}
                </button>
                <button type="button" className="fl-btn fl-brd-btn--danger" onClick={() => decide("deny")}>
                  Deny
                </button>
                {scope === "deny" ? (
                  <span id="card-approval-hint" className="fl-meta" style={{ alignSelf: "center" }}>
                    You picked Deny; press Deny to confirm.
                  </span>
                ) : null}
              </footer>
            </article>
          ) : (
            <div className="fl-brd-empty">
              <strong ref={setHeading} tabIndex={-1}>
                All caught up
              </strong>
              <p>Every request has a decision.</p>
              <ul className="fl-brd-log" aria-label="Decisions made">
                {decisions.map((x) => {
                  const r = d.requests.find((q) => q.id === x.id)!;
                  return (
                    <li key={x.id}>
                      <span>{r.action}</span>
                      <span className={`fl-brd-chip fl-brd-chip--plain fl-brd-chip--${x.scope === "deny" ? "bad" : "ok"}`}>
                        {x.scope === "deny" ? "Denied" : x.scope === "always" ? "Always" : "Once"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="fl-btn fl-btn--secondary" onClick={() => { setDecisions([]); setLast(null); }}>
                Start over with the samples
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
