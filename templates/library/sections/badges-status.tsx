/** @flowcode-library badges-status · Badges: status pills, counts and dots (Small components)
 * Use cases: a row's status; unread counts; an online dot; a plan label; a new flag
 * Jobs to be done: see the state of a row at a glance; see how many are waiting; tell live from stale
 * Keywords: badge, pill, status, count, dot, notification, label, tone
 */
/**
 * Three different things that all get called badges. A status pill says what state a thing is in and is read as words.
 * A count says how many and is read as a number. A dot says only "something", and needs words somewhere near it.
 *
 * Every tone carries a shape or a word as well as a color: a pill has its label, a dot has a hidden line of text. The
 * counts here go up and over, because the only interesting thing about a count badge is what it does at 100.
 *
 * Make it the app's own: pick five status words and never add a sixth. Six statuses is a table column, not a pill.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  tones: [
    { id: "neutral", label: "Draft", what: "Nothing has happened to it yet" },
    { id: "info", label: "In review", what: "Waiting on somebody" },
    { id: "success", label: "Approved", what: "Finished, and good" },
    { id: "warning", label: "Needs changes", what: "Finished, and not good" },
    { id: "danger", label: "Rejected", what: "Stopped" },
  ],
  looks: [
    { id: "soft", label: "Soft", what: "A tinted pill: the default, quiet enough for a whole column" },
    { id: "solid", label: "Solid", what: "Filled: for one row that needs pulling out" },
    { id: "outline", label: "Outline", what: "A border only: for a dense table where fills would be noise" },
  ],
  live: [
    { id: "online", label: "Online", what: "Here now" },
    { id: "away", label: "Away", what: "Signed in, not at the desk" },
    { id: "offline", label: "Offline", what: "Not here" },
  ],
};

export default function BadgesStatus() {
  const d = SAMPLE;
  const [n, setN] = useState(3);

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each status in each look</caption>
          <thead>
            <tr>
              <th scope="col">Status</th>
              {d.looks.map((l) => (
                <th key={l.id} scope="col">
                  <span className="fl-ctl-matrix-kind">{l.label}</span>
                  <span className="fl-ctl-matrix-what">{l.what}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.tones.map((t) => (
              <tr key={t.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{t.label}</span>
                  <span className="fl-ctl-matrix-what">{t.what}</span>
                </th>
                {d.looks.map((l) => (
                  <td key={l.id} data-state={l.label}>
                    <span className={`fl-ctl-badge fl-ctl-badge--${l.id} fl-ctl-badge--${t.id}`}>{t.label}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Counts</h3>
        <p className="fl-ctl-btn-what">
          A number on top of something. Past 99 it becomes 99+, because three digits do not fit on an icon and nobody
          reads the difference between 142 and 143 anyway.
        </p>
        <div className="fl-ctl-badge-count-row">
          {[0, 1, 9, 42, 128].map((c) => (
            <span key={c} className="fl-ctl-badge-host">
              <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--40" aria-label={`Messages, ${c} unread`}>
                <Icon name="mail" />
              </button>
              {c ? <span className="fl-ctl-badge-count" aria-hidden="true">{c > 99 ? "99+" : c}</span> : null}
            </span>
          ))}
        </div>
        <div className="fl-ctl-badge-count-row">
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => setN((v) => Math.max(0, v - 1))}>
            One fewer
          </button>
          <span className="fl-ctl-badge-host">
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--40" aria-label={`Notifications, ${n} unread`}>
              <Icon name="bell" />
            </button>
            {n ? <span className="fl-ctl-badge-count" aria-hidden="true">{n > 99 ? "99+" : n}</span> : null}
          </span>
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => setN((v) => v + 1)}>
            One more
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" onClick={() => setN(120)}>
            Jump past 99
          </button>
          <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
            {n === 0 ? "Nothing unread, so no badge at all" : `${n} unread`}
          </span>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Dots</h3>
        <p className="fl-ctl-btn-what">
          The smallest badge there is. A dot alone says nothing to a screen reader and nothing to anyone who cannot tell
          the colors apart, so each carries its word, visible or hidden.
        </p>
        <ul className="fl-ctl-dot-list">
          {d.live.map((s) => (
            <li key={s.id}>
              <span className={`fl-ctl-dot fl-ctl-dot--${s.id}`} aria-hidden="true" />
              <span>
                <strong>{s.label}</strong>
                <span className="fl-ctl-matrix-what">{s.what}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
