/** @flowcode-library lists-rows · Lists: plain rows, rows that open, rows you act on, and rows you reorder (Tables and lists)
 * Use cases: a settings list; an inbox; search results; a queue; a playlist
 * Jobs to be done: scan a list; open one; act on one without opening it; put them in my own order
 * Keywords: list, rows, list item, divider, hover, selected, reorder, drag handle
 */
/**
 * Four lists that look nearly the same and behave completely differently, which is the point: the look of a row has to
 * say whether pressing it does anything.
 *
 * A plain row does nothing and must not light up under the pointer, or people press it and feel ignored. A row that
 * opens something is a link. A row with actions keeps them visible on touch rather than hiding them behind hover. A
 * reorderable row has a handle, and the handle takes arrow keys, because dragging is not available to everyone.
 *
 * Make it the app's own: one kind per list. The commonest fault is a hover state on a row that cannot be pressed.
 */
/**
 * How to try it
 * - Press a message row: it is a link, and the one you are on stays marked.
 * - Press Download or the x on a file row: the row's buttons act, the row itself does not.
 * - Move a part of the day up or down: reordering works from the keyboard, not only by dragging.
 * - The first list is facts and reacts to nothing, on purpose.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  facts: [
    { k: "Shoot", v: "Riverside wedding" },
    { k: "Date", v: "12 June 2026" },
    { k: "Photographer", v: "Ana Moreau" },
    { k: "Deposit", v: "Paid on 2 March" },
  ],
  mail: [
    { id: "m1", who: "Ana Moreau", sub: "Re: the second shooter", when: "9:04", unread: true },
    { id: "m2", who: "Lane & Co", sub: "Headshot brief attached", when: "Yesterday", unread: true },
    { id: "m3", who: "Tom Reed", sub: "Thank you!", when: "Monday", unread: false },
  ],
  files: [
    { id: "f1", name: "contract-signed.pdf", meta: "240 KB · 2 March" },
    { id: "f2", name: "moodboard.png", meta: "3.1 MB · 5 March" },
    { id: "f3", name: "shot-list.docx", meta: "41 KB · 11 March" },
  ],
  order: ["Getting ready", "First look", "Ceremony", "Portraits", "Reception"],
};

export default function ListsRows() {
  const d = SAMPLE;
  const [open, setOpen] = useState("m1");
  // Read is not the same thing as open: opening a message reads it, and it stays read after you move on.
  const [read, setRead] = useState<string[]>([]);
  const [files, setFiles] = useState(d.files);
  const [order, setOrder] = useState(d.order);
  const [said, setSaid] = useState("");

  const shift = (n: number, dir: number) => {
    const to = n + dir;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[n], next[to]] = [next[to], next[n]];
    setOrder(next);
    setSaid(`${next[to]} moved ${dir > 0 ? "down" : "up"} to place ${to + 1}`);
  };

  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-list-grid">
        <li>
          <p className="fl-ctl-matrix-kind">Plain rows</p>
          <p className="fl-ctl-matrix-what">Facts about one thing. Nothing here can be pressed, so nothing here reacts to the pointer.</p>
          <dl className="fl-ctl-rows fl-ctl-rows--facts">
            {d.facts.map((f) => (
              <div key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Rows that open</p>
          <p className="fl-ctl-matrix-what">
            Each row is a link to one thing. The one you are looking at stays marked, and opening a message reads it for good.
          </p>
          <ul className="fl-ctl-rows fl-ctl-rows--links">
            {d.mail.map((m) => {
              const unread = m.unread && !read.includes(m.id);
              return (
                <li key={m.id}>
                  <a
                    href="#top"
                    className={`fl-ctl-row${m.id === open ? " is-on" : ""}${unread ? " is-unread" : ""}`}
                    aria-current={m.id === open ? "true" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(m.id);
                      setRead((v) => (v.includes(m.id) ? v : [...v, m.id]));
                      setSaid(`Opened: ${m.sub}`);
                    }}
                  >
                    <span className="fl-ctl-row-unread" aria-hidden="true" />
                    {unread ? <span className="fl-sr">Unread. </span> : null}
                    <span className="fl-ctl-row-main">
                      <strong>{m.who}</strong>
                      <span className="fl-ctl-matrix-what">{m.sub}</span>
                    </span>
                    <span className="fl-ctl-matrix-what">{m.when}</span>
                  </a>
                </li>
              );
            })}
          </ul>
          {read.length ? (
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" onClick={() => setRead([])}>
              Mark them unread again
            </button>
          ) : null}
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Rows you act on</p>
          <p className="fl-ctl-matrix-what">The row itself does nothing; the buttons do. They stay visible, because hover does not exist on a phone.</p>
          <ul className="fl-ctl-rows">
            {files.map((f) => (
              <li key={f.id} className="fl-ctl-row fl-ctl-row--static">
                <span className="fl-ctl-row-icon" aria-hidden="true">
                  <Icon name="folder" />
                </span>
                <span className="fl-ctl-row-main">
                  <strong>{f.name}</strong>
                  <span className="fl-ctl-matrix-what">{f.meta}</span>
                </span>
                <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label={`Download ${f.name}`} title="Download" onClick={() => setSaid(`Downloading ${f.name}`)}>
                  <Icon name="download" />
                </button>
                <button
                  type="button"
                  className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32"
                  aria-label={`Remove ${f.name}`}
                  title="Remove"
                  onClick={() => {
                    setFiles((v) => v.filter((x) => x.id !== f.id));
                    setSaid(`Removed ${f.name}`);
                  }}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
            {files.length ? null : (
              <li className="fl-ctl-row fl-ctl-row--static">
                <span className="fl-ctl-matrix-what">Nothing attached.</span>
                <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => setFiles(d.files)}>
                  Put them back
                </button>
              </li>
            )}
          </ul>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Rows you reorder</p>
          <p className="fl-ctl-matrix-what">A handle, and two buttons that do the same job for anyone who cannot drag.</p>
          <ol className="fl-ctl-rows fl-ctl-rows--order">
            {order.map((o, n) => (
              <li key={o} className="fl-ctl-row fl-ctl-row--static">
                <span className="fl-ctl-row-grip" aria-hidden="true">
                  <Icon name="more" />
                </span>
                <span className="fl-ctl-row-main">
                  <strong>
                    {n + 1}. {o}
                  </strong>
                </span>
                <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32 fl-ctl-row-up" aria-label={`Move ${o} up`} title="Move up" disabled={n === 0} onClick={() => shift(n, -1)}>
                  <Icon name="chevron-down" />
                </button>
                <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label={`Move ${o} down`} title="Move down" disabled={n === order.length - 1} onClick={() => shift(n, 1)}>
                  <Icon name="chevron-down" />
                </button>
              </li>
            ))}
          </ol>
        </li>
      </ul>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Open a message, remove a file, or move a part of the day."}
      </p>
    </section>
  );
}
