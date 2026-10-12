/** @flowcode-library empty-states · Empty states: nothing yet, nothing found, nothing left, nothing worked (Alerts and states)
 * Catalog ID: c.empty-state (component)
 * Function: The empty state (c.empty-state), one component for the four different reasons a place is empty; the reference sheet shows nothing yet, nothing found (live search), nothing left and nothing worked. Version: illustrated.
 * Use it as: import { EmptyState } from "./empty-states"; <EmptyState version?="illustrated" variant?="first-use"|"no-results"|"done"|"error" title headingLevel?={2|3} align?="center"|"start" icon? art?={<svg/>} before? action?={<Button>…</Button>}>one sentence why</EmptyState>
 * Variants: c.empty-state.first-use - nothing has been made yet: a muted round icon, a bold title, one sentence and a primary Button that makes the first thing; c.empty-state.no-results - a search or filter matched nothing: a search icon, the title naming the query, and a Button that clears or widens it; c.empty-state.done - finished, nothing left to do: a green check icon and a calm sentence, usually no action; c.empty-state.error - empty because a load failed: a red-tinted border and alert icon, with a Try again Button
 * Look: A dashed-border panel with centered content: a round icon, a bold title, one muted sentence and the one action that fits.
 * Tokens: --color-surface-sunken --color-text-muted --color-success --color-danger --color-border --text-md --space-1 --space-2 --space-3 --radius-md --color-border-strong --color-accent --text-lg
 * Use cases: a new account's first screen; a search with no results; a cleared inbox; a failed load; a filtered table; empty list; first run; no projects yet; empty inbox; no tasks; empty cart; onboarding start; no saved items
 * Jobs to be done: understand why this is empty; know what to do next; get back to something that is not empty; add my first item; understand what goes here; get started with the product
 * Keywords: empty state, zero state, no results, first run, onboarding, error state, placeholder, list, zero data
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
import { createElement, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.empty-state: what a place shows when it has nothing to show. One for each reason it can be empty. ──

export type EmptyStateVariant = "first-use" | "no-results" | "done" | "error";
/**
 * Other designs of the empty state. "default" is the compact dashed panel with a round icon; "illustrated" is the roomy
 * first-run panel with a drawn illustration, a heading, a line and one primary action (the variant is ignored).
 */
export type EmptyStateVersion = "default" | "illustrated";

// Written out in full (not built from the variant name) so a build finds every class the empty state needs.
const VARIANT: Record<EmptyStateVariant, string> = { "first-use": "", "no-results": "", done: "fl-ctl-empty--good", error: "fl-ctl-empty--bad" };
const ICON: Record<EmptyStateVariant, string> = { "first-use": "image", "no-results": "search", done: "check", error: "alert" };

export function EmptyState({ version = "default", variant = "first-use", title, icon, art, headingLevel, align = "center", before, action, className, children }: {
  /** Another design of the empty state; "default" when left out. See EmptyStateVersion. */
  version?: EmptyStateVersion;
  variant?: EmptyStateVariant;
  /** What is empty, in a few words: "No shoots yet". */
  title: string;
  /** An icon name from ./icons; each variant has its own when left out. */
  icon?: string;
  /** Draw the title as a real heading of this level (2 or 3) so the page outline has it. Left out, it is bold text. */
  headingLevel?: 2 | 3;
  /** center (default) or start: left-aligned, for a panel beside other left-aligned content. */
  align?: "center" | "start";
  /** A larger illustration (an <svg>) drawn instead of the round icon, for a first-use screen with room to spare. */
  art?: ReactNode;
  /** Something that sits above the icon, such as the search box a no-results state belongs to. */
  before?: ReactNode;
  /** The one thing to do next, as a <Button>. Leave it out only when nothing is left to do. */
  action?: ReactNode;
  className?: string;
  /** One sentence saying why it is empty. */
  children?: ReactNode;
}) {
  if (version === "illustrated") {
    const Heading = `h${headingLevel ?? 3}` as "h2" | "h3";
    return (
      <div className={["fl-alr-empty", className ?? ""].filter(Boolean).join(" ")} data-fl="c.empty-state@illustrated">
        {before}
        {art ?? LIST_ART}
        <Heading className="fl-title fl-title--md" style={{ fontSize: "var(--text-lg)" }}>
          {title}
        </Heading>
        {children ? <p className="fl-text">{children}</p> : null}
        {action}
      </div>
    );
  }
  const cls = ["fl-spec-empty", VARIANT[variant], className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls} data-fl={`c.empty-state.${variant}`} style={align === "start" ? { justifyItems: "start", textAlign: "left" } : undefined}>
      {before}
      {art ? (
        <span aria-hidden="true">{art}</span>
      ) : (
        <span className="fl-ctl-empty-art" aria-hidden="true">
          <Icon name={icon ?? ICON[variant]} />
        </span>
      )}
      {headingLevel ? createElement(`h${headingLevel}`, { style: { margin: 0, fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" } }, title) : <strong>{title}</strong>}
      {children ? <span className="fl-ctl-matrix-what">{children}</span> : null}
      {action}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  shoots: ["Riverside wedding", "Harbour engagement", "Studio headshots", "Vineyard anniversary"],
  suggestions: [
    { name: "Oat milk", note: "2 cartons" },
    { name: "Washing-up liquid", note: "The unscented one" },
    { name: "Sourdough loaf", note: "From the bakery on the corner" },
    { name: "Bin bags", note: "Large, 30 pack" },
  ],
};

// A drawn list with a plus: the illustration a first-use screen can carry in place of the round icon.
const LIST_ART = (
  <svg className="fl-alr-empty__art" viewBox="0 0 160 120" aria-hidden="true">
    <ellipse cx="80" cy="108" rx="58" ry="7" style={{ fill: "var(--color-surface-sunken)" }} />
    <rect x="38" y="18" width="84" height="88" rx="10" style={{ fill: "var(--color-surface)", stroke: "var(--color-border-strong)", strokeWidth: 2 }} />
    <rect x="62" y="10" width="36" height="16" rx="6" style={{ fill: "var(--color-secondary-surface, color-mix(in srgb, var(--color-accent) 22%, var(--color-surface)))", stroke: "var(--color-secondary-border, var(--color-accent))", strokeWidth: 2 }} />
    {[44, 62, 80].map((y, i) => (
      <g key={y}>
        <rect x="52" y={y - 5} width="10" height="10" rx="3" style={{ fill: "none", stroke: "var(--color-border-strong)", strokeWidth: 2 }} />
        <rect x="70" y={y - 3} width={i === 1 ? 26 : 38} height="6" rx="3" style={{ fill: "var(--color-surface-sunken)" }} />
      </g>
    ))}
    <circle cx="124" cy="92" r="16" style={{ fill: "var(--color-accent)" }} />
    <path d="M124 85v14M117 92h14" style={{ stroke: "var(--color-on-accent)", strokeWidth: 3, strokeLinecap: "round" }} />
  </svg>
);

export default function EmptyStates() {
  const d = SAMPLE;
  const [q, setQ] = useState("");
  const [broke, setBroke] = useState(true);
  const [said, setSaid] = useState("");
  const hits = d.shoots.filter((s) => s.toLowerCase().includes(q.trim().toLowerCase()));

  // The illustrated version's live list: add fills it, removing every item brings the empty state back.
  const [items, setItems] = useState<{ id: number; name: string; note: string }[]>([]);
  const nextId = useRef(1);
  const addRef = useRef<HTMLButtonElement>(null);
  const addItem = () => {
    const s = d.suggestions[(nextId.current - 1) % d.suggestions.length];
    setItems((all) => [...all, { id: nextId.current++, ...s }]);
    setSaid(`Added ${s.name}`);
  };
  const removeItem = (id: number, name: string) => {
    const left = items.length - 1;
    setItems((all) => all.filter((i) => i.id !== id));
    setSaid(`Removed ${name}`);
    if (left === 0) window.setTimeout(() => addRef.current?.focus(), 0);
  };

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
      <div className="fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
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
            <p className="fl-ctl-matrix-kind">Nothing yet, with art</p>
            <p className="fl-ctl-matrix-what">The same state with a drawn illustration, for a page that has the room.</p>
            <EmptyState
              art={LIST_ART}
              title="Nothing on the list yet"
              action={
                <Button size={40} icon="plus" onClick={() => setSaid("Added a first item")}>
                  Add your first item
                </Button>
              }
            >
              Everyone at home sees the same list, so nobody buys milk twice.
            </EmptyState>
          </li>

          <li>
            <p className="fl-ctl-matrix-kind">c.empty-state@illustrated</p>
            <p className="fl-ctl-matrix-what">version="illustrated": the roomy first-run panel. Add an item and the list appears; remove them all and it returns.</p>
            {items.length === 0 ? (
              <EmptyState
                version="illustrated"
                title="Nothing on the list yet"
                action={
                  <Button ref={addRef} size={40} onClick={addItem}>
                    Add your first item
                  </Button>
                }
              >
                Add what the house needs this week. Everyone at home sees the same list, so nobody buys milk twice.
              </EmptyState>
            ) : (
              <>
                <ul className="fl-alr-empty__list" aria-label={`${items.length} ${items.length === 1 ? "item" : "items"} on the list`}>
                  {items.map((i) => (
                    <li key={i.id}>
                      <div>
                        <strong>{i.name}</strong>
                        <span className="fl-meta">{i.note}</span>
                      </div>
                      <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => removeItem(i.id, i.name)}>
                        {`Remove ${i.name}`}
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button size={40} onClick={addItem}>
                  Add another
                </Button>
              </>
            )}
          </li>

          <li>
            <p className="fl-ctl-matrix-kind">Heading, left-aligned</p>
            <p className="fl-ctl-matrix-what">headingLevel makes the title a real h3; align="start" sets it against the left edge.</p>
            <EmptyState headingLevel={3} align="start" title="No invoices yet">
              Invoices you send will be listed here.
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
      </div>
    </section>
  );
}
