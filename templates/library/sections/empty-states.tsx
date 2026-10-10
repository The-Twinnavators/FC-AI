/** @flowcode-library empty-states · Empty states: nothing yet, nothing found, nothing left, nothing worked (Alerts and states)
 * Use cases: a new account's first screen; a search with no results; a cleared inbox; a failed load; a filtered table
 * Jobs to be done: understand why this is empty; know what to do next; get back to something that is not empty
 * Keywords: empty state, zero state, no results, first run, onboarding, error state, placeholder
 */
/**
 * Four empties that look alike and mean completely different things, which is why one "Nothing here" screen for all of
 * them is the commonest mistake in an app: first run has nothing to show yet, a search found nothing, a finished list
 * has nothing left, and a failed load has nothing because something broke.
 *
 * Each says which it is and offers the one action that fits: make the first thing, widen the search, nothing at all,
 * or try again. The search one is live - type and watch it empty and fill.
 *
 * Make it the app's own: replace the words, keep the four apart. An empty state with no action is a dead end.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  shoots: ["Riverside wedding", "Harbour engagement", "Studio headshots", "Vineyard anniversary"],
};

export default function EmptyStates() {
  const d = SAMPLE;
  const [q, setQ] = useState("");
  const [broke, setBroke] = useState(true);
  const [said, setSaid] = useState("");
  const hits = d.shoots.filter((s) => s.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-empty-grid">
        <li>
          <p className="fl-ctl-matrix-kind">Nothing yet</p>
          <p className="fl-ctl-matrix-what">A new account. There is nothing because nothing has been made.</p>
          <div className="fl-ctl-empty">
            <span className="fl-ctl-empty-art" aria-hidden="true">
              <Icon name="image" />
            </span>
            <strong>No shoots yet</strong>
            <span className="fl-ctl-matrix-what">Your first shoot takes about a minute to set up, and you can change any of it later.</span>
            <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--40" onClick={() => setSaid("Started a first shoot")}>
              <Icon name="plus" /> Add your first shoot
            </button>
          </div>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Nothing found</p>
          <p className="fl-ctl-matrix-what">There is something, but not this. Type a word that is not there.</p>
          <div className="fl-ctl-empty">
            <span className="fl-ctl-combo fl-ctl-empty-search">
              <label className="fl-sr" htmlFor="empty-q">
                Search shoots
              </label>
              <input
                id="empty-q"
                className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32"
                type="search"
                placeholder="Search shoots"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Icon name="search" />
            </span>
            {hits.length ? (
              <ul className="fl-ctl-empty-hits">
                {hits.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : (
              <>
                <span className="fl-ctl-empty-art" aria-hidden="true">
                  <Icon name="search" />
                </span>
                <strong>Nothing matches "{q}"</strong>
                <span className="fl-ctl-matrix-what">Four shoots are here, just not that one. Check the spelling, or clear the search.</span>
                <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => setQ("")}>
                  Clear the search
                </button>
              </>
            )}
          </div>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Nothing left</p>
          <p className="fl-ctl-matrix-what">Finished, not broken. This is the only empty that should feel good.</p>
          <div className="fl-ctl-empty fl-ctl-empty--good">
            <span className="fl-ctl-empty-art" aria-hidden="true">
              <Icon name="check" />
            </span>
            <strong>Nothing waiting on you</strong>
            <span className="fl-ctl-matrix-what">Every approval is handled. We will put the next one here.</span>
          </div>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Nothing worked</p>
          <p className="fl-ctl-matrix-what">Empty because something failed. Say so, and offer the retry.</p>
          <div className={`fl-ctl-empty${broke ? " fl-ctl-empty--bad" : ""}`}>
            {broke ? (
              <>
                <span className="fl-ctl-empty-art" aria-hidden="true">
                  <Icon name="alert" />
                </span>
                <strong>We could not load your shoots</strong>
                <span className="fl-ctl-matrix-what">The connection dropped partway. Nothing was lost.</span>
                <button
                  type="button"
                  className="fl-btn fl-btn--secondary fl-ctl-btn--40"
                  onClick={() => {
                    setBroke(false);
                    setSaid("Loaded on the second try");
                  }}
                >
                  <Icon name="refresh" /> Try again
                </button>
              </>
            ) : (
              <>
                <span className="fl-ctl-empty-art" aria-hidden="true">
                  <Icon name="check" />
                </span>
                <strong>Four shoots loaded</strong>
                <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" onClick={() => setBroke(true)}>
                  Break it again
                </button>
              </>
            )}
          </div>
        </li>
      </ul>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Four empties, four different reasons."}
      </p>
    </section>
  );
}
