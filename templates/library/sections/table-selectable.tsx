/**
 * Table: select rows and act on many at once. Row checkboxes, a select-all box (with a mixed state when only some are
 * picked) and a bar of bulk actions that appears once anything is selected, with an undo message after each action.
 * Use it for to-do lists, orders to process or messages to clear. Make it the app's own: replace SAMPLE with real
 * rows and swap the two bulk actions for the ones people need most.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Studio to-dos",
  lede: "Tick the jobs you've handled, then mark them done or clear them in one go.",
  rows: [
    { id: "t1", task: "Order backdrop paper (grey, 2.7m)", who: "Maya", due: "Today", done: false },
    { id: "t2", task: "Edit Tom Reyes product shots", who: "Jonah", due: "Today", done: false },
    { id: "t3", task: "Send deposit reminder to Ana", who: "Maya", due: "Tomorrow", done: false },
    { id: "t4", task: "Charge camera batteries for Saturday", who: "Elif", due: "Fri 9 Oct", done: false },
    { id: "t5", task: "Book cleaner for the studio", who: "Jonah", due: "Fri 9 Oct", done: true },
    { id: "t6", task: "Back up last week's sessions", who: "Elif", due: "Sun 11 Oct", done: false },
  ],
  emptyTitle: "All clear",
  emptyText: "No to-dos left. New jobs you add will show up here.",
};

type Row = (typeof SAMPLE.rows)[number];

export default function TableSelectable() {
  const d = SAMPLE;
  const [rows, setRows] = useState<Row[]>(d.rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ message: string; rows: Row[]; selected: Set<string> } | null>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);

  const count = selected.size;
  const all = rows.length > 0 && count === rows.length;
  const some = count > 0 && !all;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  // The undo message goes away on its own after a while.
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(t);
  }, [undo]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(all ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function act(kind: "done" | "delete") {
    const n = count;
    const noun = n === 1 ? "to-do" : "to-dos";
    setUndo({ message: kind === "done" ? `Marked ${n} ${noun} done.` : `Deleted ${n} ${noun}.`, rows, selected });
    setRows((rs) => (kind === "done" ? rs.map((r) => (selected.has(r.id) ? { ...r, done: true } : r)) : rs.filter((r) => !selected.has(r.id))));
    setSelected(new Set());
    // Keep focus on the page: select-all if the table is still there, otherwise the Undo button.
    requestAnimationFrame(() => (allRef.current ?? undoRef.current)?.focus());
  }

  function restore() {
    if (!undo) return;
    setRows(undo.rows);
    setSelected(undo.selected);
    setUndo(null);
  }

  return (
    <section className="fl-section" aria-labelledby="table-selectable-title">
      <div className="fl-wrap fl-wrap--narrow fl-tbl">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="table-selectable-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>

        <div className="fl-tbl-panel">
          {count > 0 && (
            <div className="fl-tbl-bulk" role="region" aria-label="Bulk actions">
              <strong>{count} selected</strong>
              <div className="fl-actions">
                <button type="button" className="fl-btn fl-btn--primary fl-tbl-btn-sm" onClick={() => act("done")}>
                  <Icon name="check" /> Mark done
                </button>
                <button type="button" className="fl-btn fl-btn--secondary fl-tbl-btn-sm" onClick={() => act("delete")} style={{ color: "var(--color-danger)" }}>
                  Delete
                </button>
                <button type="button" className="fl-btn fl-tbl-btn-quiet fl-tbl-btn-sm" onClick={() => setSelected(new Set())}>
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="fl-tbl-empty">
              <span className="fl-icon">
                <Icon name="check" />
              </span>
              <strong>{d.emptyTitle}</strong>
              <span>{d.emptyText}</span>
            </div>
          ) : (
            <div className="fl-tbl-scroll">
              <table className="fl-tbl-table" style={{ minWidth: "30rem" }}>
                <caption className="fl-sr">{d.title}. Use the checkboxes to select rows.</caption>
                <thead>
                  <tr>
                    <th scope="col" className="fl-tbl-check-cell">
                      <input
                        ref={allRef}
                        id="ts-all"
                        type="checkbox"
                        className="fl-tbl-check"
                        checked={all}
                        onChange={toggleAll}
                      />
                      <label htmlFor="ts-all" className="fl-sr">
                        Select all to-dos
                      </label>
                    </th>
                    <th scope="col">To-do</th>
                    <th scope="col">Who</th>
                    <th scope="col">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const on = selected.has(r.id);
                    return (
                      <tr key={r.id} aria-selected={on} onClick={(e) => (e.target as HTMLElement).tagName !== "INPUT" && toggle(r.id)} style={{ cursor: "pointer" }}>
                        <td className="fl-tbl-check-cell">
                          <input id={`ts-${r.id}`} type="checkbox" className="fl-tbl-check" checked={on} onChange={() => toggle(r.id)} />
                          <label htmlFor={`ts-${r.id}`} className="fl-sr">
                            Select “{r.task}”
                          </label>
                        </td>
                        <th scope="row" style={{ fontWeight: "var(--weight-medium)" }}>
                          <span className={r.done ? "fl-tbl-done-text" : undefined}>{r.task}</span>
                          {r.done && <span className="fl-sr"> (done)</span>}
                        </th>
                        <td>{r.who}</td>
                        <td className="fl-tbl-nowrap">
                          {r.done ? <span className="fl-tbl-status fl-tbl-status--success">Done</span> : <span className="fl-tbl-muted">{r.due}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div aria-live="polite" role="status">
          {undo && (
            <div className="fl-tbl-toast">
              <span>{undo.message}</span>
              <span style={{ display: "flex", gap: "var(--space-1)" }}>
                <button ref={undoRef} type="button" onClick={restore}>
                  Undo
                </button>
                <button type="button" onClick={() => setUndo(null)} aria-label="Dismiss message">
                  Dismiss
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
