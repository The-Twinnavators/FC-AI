/** @flowcode-library empty-states · Empty states: nothing yet, nothing found, nothing left, nothing worked (Alerts and states)
 * Catalog ID: c.empty-state (component)
 * Function: The empty state (c.empty-state), one component for the four different reasons a place is empty; the reference sheet shows nothing yet, nothing found (live search), nothing left and nothing worked.
 * Use it as: import { EmptyState } from "./empty-states"; <EmptyState variant?="first-use"|"no-results"|"done"|"error" title icon? before? action?={<Button>…</Button>}>one sentence why</EmptyState>
 * Variants: c.empty-state.first-use - nothing has been made yet: a muted round icon, a bold title, one sentence and a primary Button that makes the first thing; c.empty-state.no-results - a search or filter matched nothing: a search icon, the title naming the query, and a Button that clears or widens it; c.empty-state.done - finished, nothing left to do: a green check icon and a calm sentence, usually no action; c.empty-state.error - empty because a load failed: a red-tinted border and alert icon, with a Try again Button
 * Look: A dashed-border panel with centered content: a round icon, a bold title, one muted sentence and the one action that fits.
 * Tokens: --color-surface-sunken --color-text-muted --color-success --color-danger --color-border --text-md --space-1 --space-2 --space-3 --radius-md
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
/**
 * How to try it
 * - Type a word that is not there in the "Nothing found" search: it empties and fills as you type.
 * - Press "Try again" on the failed one, then "Break it again".
 * - The four are different on purpose: nothing yet, nothing found, nothing left, nothing worked.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.empty-state: what a place shows when it has nothing to show. One for each reason it can be empty. ──

export type EmptyStateVariant = "first-use" | "no-results" | "done" | "error";

// Written out in full (not built from the variant name) so a build finds every class the empty state needs.
const VARIANT: Record<EmptyStateVariant, string> = { "first-use": "", "no-results": "", done: "fl-ctl-empty--good", error: "fl-ctl-empty--bad" };
const ICON: Record<EmptyStateVariant, string> = { "first-use": "image", "no-results": "search", done: "check", error: "alert" };

export function EmptyState({ variant = "first-use", title, icon, before, action, className, children }: {
  variant?: EmptyStateVariant;
  /** What is empty, in a few words: "No shoots yet". */
  title: string;
  /** An icon name from ./icons; each variant has its own when left out. */
  icon?: string;
  /** Something that sits above the icon, such as the search box a no-results state belongs to. */
  before?: ReactNode;
  /** The one thing to do next, as a <Button>. Leave it out only when nothing is left to do. */
  action?: ReactNode;
  className?: string;
  /** One sentence saying why it is empty. */
  children?: ReactNode;
}) {
  const cls = ["fl-spec-empty", VARIANT[variant], className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls} data-fl={`c.empty-state.${variant}`}>
      {before}
      <span className="fl-ctl-empty-art" aria-hidden="true">
        <Icon name={icon ?? ICON[variant]} />
      </span>
      <strong>{title}</strong>
      {children ? <span className="fl-ctl-matrix-what">{children}</span> : null}
      {action}
    </div>
  );
}

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

  const search = (
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
  );

  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-empty-grid">
        <li>
          <p className="fl-ctl-matrix-kind">Nothing yet</p>
          <p className="fl-ctl-matrix-what">A new account. There is nothing because nothing has been made.</p>
          <EmptyState
            title="No shoots yet"
            action={
              <Button size={40} icon="plus" onClick={() => setSaid("Started a first shoot")}>
                Add your first shoot
              </Button>
            }
          >
            Your first shoot takes about a minute to set up, and you can change any of it later.
          </EmptyState>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Nothing found</p>
          <p className="fl-ctl-matrix-what">There is something, but not this. Type a word that is not there.</p>
          {hits.length ? (
            <div className="fl-spec-empty">
              {search}
              <ul className="fl-ctl-empty-hits">
                {hits.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              variant="no-results"
              before={search}
              title={`Nothing matches "${q}"`}
              action={
                <Button variant="secondary" size={32} onClick={() => setQ("")}>
                  Clear the search
                </Button>
              }
            >
              Four shoots are here, just not that one. Check the spelling, or clear the search.
            </EmptyState>
          )}
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Nothing left</p>
          <p className="fl-ctl-matrix-what">Finished, not broken. This is the only empty that should feel good.</p>
          <EmptyState variant="done" title="Nothing waiting on you">
            Every approval is handled. We will put the next one here.
          </EmptyState>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Nothing worked</p>
          <p className="fl-ctl-matrix-what">Empty because something failed. Say so, and offer the retry.</p>
          {broke ? (
            <EmptyState
              variant="error"
              title="We could not load your shoots"
              action={
                <Button
                  variant="secondary"
                  size={40}
                  icon="refresh"
                  onClick={() => {
                    setBroke(false);
                    setSaid("Loaded on the second try");
                  }}
                >
                  Try again
                </Button>
              }
            >
              The connection dropped partway. Nothing was lost.
            </EmptyState>
          ) : (
            <EmptyState
              variant="done"
             
              title="Four shoots loaded"
              action={
                <Button variant="tertiary" size={32} onClick={() => setBroke(true)}>
                  Break it again
                </Button>
              }
            />
          )}
        </li>
      </ul>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Four empties, four different reasons."}
      </p>
    </section>
  );
}
