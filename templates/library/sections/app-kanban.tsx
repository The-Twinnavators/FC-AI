/**
 * App screen: task board. A top bar with the board name and an assignee filter, then columns of cards. Move a card
 * with its arrow buttons, with Alt + arrow keys while it has focus (left/right between columns, up/down within one),
 * or by dragging it where a mouse is available. Each column adds a card inline, "In progress" warns when it goes over
 * its work-in-progress limit, and the board remembers its cards in this browser. On phones the columns scroll sideways.
 * Use it for planning, production or any to-do flow with stages. Make it the app's own: replace SAMPLE with the app's
 * real stages, limits, people and tasks, and store the cards in the app's data instead of localStorage.
 */
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  board: "Winter open studio",
  boardText: "Getting the studio ready for the open weekend on 6 December.",
  filterLabel: "Show cards for",
  everyone: "Everyone",
  addLabel: "Add a card",
  addPlaceholder: "What needs doing?",
  addError: "Give the card a title.",
  reset: "Reset board",
  wipWarning: "{n} cards in progress, the limit is {limit}. Finish one before starting more.",
  people: [
    { id: "ar", name: "Ada Reyes", initials: "AR" },
    { id: "si", name: "Sam Ito", initials: "SI" },
    { id: "rv", name: "Rosa Vidal", initials: "RV" },
  ],
  columns: [
    { id: "todo", title: "To do", limit: 0 },
    { id: "doing", title: "In progress", limit: 3 },
    { id: "review", title: "Check", limit: 0 },
    { id: "done", title: "Done", limit: 0 },
  ],
  cards: [
    { id: "k1", col: "todo", title: "Order 200 kg of buff stoneware clay", who: "rv", tag: "Supplies", due: "14 Nov" },
    { id: "k2", col: "todo", title: "Print price cards for the sale shelf", who: "ar", tag: "Shop", due: "28 Nov" },
    { id: "k3", col: "todo", title: "Ask the bakery next door about coffee", who: "si", tag: "Event", due: "21 Nov" },
    { id: "k4", col: "doing", title: "Glaze firing for the members' show", who: "si", tag: "Kiln", due: "12 Nov" },
    { id: "k5", col: "doing", title: "Write the open weekend newsletter", who: "ar", tag: "Event", due: "15 Nov" },
    { id: "k6", col: "doing", title: "Fix the splash pan on wheel 4", who: "rv", tag: "Studio", due: "10 Nov" },
    { id: "k7", col: "review", title: "Demo schedule for Saturday", who: "ar", tag: "Event", due: "18 Nov" },
    { id: "k8", col: "done", title: "Book the trestle tables", who: "rv", tag: "Event", due: "3 Nov" },
  ],
};

type Card = { id: string; col: string; title: string; who: string; tag: string; due: string };
const STORE = "fl-as-kanban-cards";
const ARROW_L = "M15 6l-6 6 6 6";
const ARROW_R = "M9 6l6 6-6 6";
const PLUS = "M12 5v14M5 12h14";

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function load(): Card[] {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Card[];
    }
  } catch {
    /* storage blocked: start from the sample */
  }
  return SAMPLE.cards;
}

export default function AppKanban() {
  const d = SAMPLE;
  const [cards, setCards] = useState<Card[]>(load);
  const [who, setWho] = useState<string>("all");
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const [say, setSay] = useState("");
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const addBtns = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(cards));
    } catch {
      /* not saved; the board still works for this visit */
    }
    if (focusAfter.current) {
      cardRefs.current[focusAfter.current]?.focus();
      focusAfter.current = null;
    }
  }, [cards]);

  const colIndex = (id: string) => d.columns.findIndex((c) => c.id === id);
  const person = (id: string) => d.people.find((p) => p.id === id);

  function moveTo(id: string, col: string, before?: string | null) {
    setCards((cs) => {
      const card = cs.find((c) => c.id === id);
      if (!card) return cs;
      const rest = cs.filter((c) => c.id !== id);
      const moved = { ...card, col };
      let at = before ? rest.findIndex((c) => c.id === before) : -1;
      if (at < 0) {
        const lastInCol = rest.map((c) => c.col).lastIndexOf(col);
        at = lastInCol < 0 ? rest.length : lastInCol + 1;
      }
      return [...rest.slice(0, at), moved, ...rest.slice(at)];
    });
    const title = d.columns.find((c) => c.id === col)!.title;
    setSay(`Moved “${cards.find((c) => c.id === id)?.title}” to ${title}.`);
  }

  function step(card: Card, dir: -1 | 1) {
    const next = d.columns[colIndex(card.col) + dir];
    if (!next) return;
    focusAfter.current = card.id;
    moveTo(card.id, next.id);
  }

  function reorder(card: Card, dir: -1 | 1) {
    const inCol = cards.filter((c) => c.col === card.col);
    const i = inCol.findIndex((c) => c.id === card.id);
    const j = i + dir;
    if (j < 0 || j >= inCol.length) return;
    focusAfter.current = card.id;
    setCards((cs) => {
      const a = cs.findIndex((c) => c.id === card.id);
      const b = cs.findIndex((c) => c.id === inCol[j].id);
      const next = [...cs];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
    setSay(`“${card.title}” is now number ${j + 1} of ${inCol.length}.`);
  }

  function onCardKey(e: KeyboardEvent<HTMLLIElement>, card: Card) {
    if (!e.altKey || e.target !== e.currentTarget) return;
    if (e.key === "ArrowLeft") step(card, -1);
    else if (e.key === "ArrowRight") step(card, 1);
    else if (e.key === "ArrowUp") reorder(card, -1);
    else if (e.key === "ArrowDown") reorder(card, 1);
    else return;
    e.preventDefault();
  }

  function addCard(e: FormEvent, col: string) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) {
      setDraftError(true);
      return;
    }
    const id = `k${Date.now()}`;
    setCards((cs) => [...cs, { id, col, title, who: who === "all" ? d.people[0].id : who, tag: "New", due: "No date" }]);
    setDraft("");
    setDraftError(false);
    setSay(`Added “${title}” to ${d.columns.find((c) => c.id === col)!.title}.`);
  }

  function closeAdd(col: string) {
    setAdding(null);
    setDraft("");
    setDraftError(false);
    window.setTimeout(() => addBtns.current[col]?.focus(), 0);
  }

  function onDrop(e: DragEvent, col: string) {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    if (id) moveTo(id, col);
    setDragId(null);
    setDropCol(null);
  }

  return (
    <div className="fl-as-app">
      <header className="fl-as-top">
        <div className="fl-as-brand">
          <span className="fl-as-mark" aria-hidden="true">
            {d.mark}
          </span>
          <span className="fl-as-brand__name">{d.product}</span>
        </div>
        <div className="fl-as-top__end">
          <div className="fl-as-people" role="group" aria-label={d.filterLabel}>
            <button type="button" className="fl-as-chip" aria-pressed={who === "all"} onClick={() => setWho("all")}>
              {d.everyone}
            </button>
            {d.people.map((p) => (
              <button key={p.id} type="button" className="fl-as-avatar fl-as-avatar--btn" aria-pressed={who === p.id} title={p.name} onClick={() => setWho(who === p.id ? "all" : p.id)}>
                <span aria-hidden="true">{p.initials}</span>
                <span className="fl-sr">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="fl-as-main fl-as-boardmain">
        <div className="fl-as-pagehead">
          <div>
            <h1 className="fl-as-h1">{d.board}</h1>
            <p className="fl-text">{d.boardText}</p>
          </div>
          <button
            type="button"
            className="fl-as-btn fl-as-btn--quiet"
            onClick={() => {
              setCards(d.cards);
              setSay("Board reset to the starting cards.");
            }}
          >
            {d.reset}
          </button>
        </div>
        <p className="fl-meta" id="fl-as-kb-help">
          Tip: focus a card and press Alt + arrow keys to move it.
        </p>
        <p className="fl-sr" aria-live="polite">
          {say}
        </p>

        <div className="fl-as-board">
          {d.columns.map((col, ci) => {
            const all = cards.filter((c) => c.col === col.id);
            const shown = all.filter((c) => who === "all" || c.who === who);
            const over = col.limit > 0 && all.length > col.limit;
            return (
              <section
                key={col.id}
                className="fl-as-col"
                data-over={over || undefined}
                data-drop={dropCol === col.id || undefined}
                aria-labelledby={`fl-as-kb-${col.id}`}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setDropCol(col.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropCol(null);
                }}
                onDrop={(e) => onDrop(e, col.id)}
              >
                <div className="fl-as-col__head">
                  <h2 id={`fl-as-kb-${col.id}`} className="fl-as-col__title">
                    {col.title}
                  </h2>
                  <span className="fl-as-col__count">
                    {all.length}
                    {col.limit > 0 ? ` / ${col.limit}` : ""}
                    <span className="fl-sr"> cards{col.limit > 0 ? `, limit ${col.limit}` : ""}</span>
                  </span>
                </div>
                {over && (
                  <p className="fl-as-wip" role="alert">
                    {d.wipWarning.replace("{n}", String(all.length)).replace("{limit}", String(col.limit))}
                  </p>
                )}
                {shown.length === 0 ? (
                  <p className="fl-as-col__empty">{all.length ? `No cards for ${person(who)?.name.split(" ")[0]}` : "Nothing here yet"}</p>
                ) : (
                  <ul className="fl-as-cards">
                    {shown.map((card) => {
                      const p = person(card.who);
                      return (
                        <li
                          key={card.id}
                          ref={(el) => {
                            cardRefs.current[card.id] = el;
                          }}
                          className="fl-as-card"
                          tabIndex={0}
                          draggable
                          data-dragging={dragId === card.id || undefined}
                          aria-describedby="fl-as-kb-help"
                          aria-label={`${card.title}. ${p?.name ?? ""}. Due ${card.due}. In ${col.title}.`}
                          onKeyDown={(e) => onCardKey(e, card)}
                          onDragStart={(e) => {
                            setDragId(card.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", card.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDropCol(null);
                          }}
                        >
                          <span className="fl-badge">{card.tag}</span>
                          <p className="fl-as-card__title">{card.title}</p>
                          <div className="fl-as-card__foot">
                            <span className="fl-as-avatar fl-as-avatar--xs" aria-hidden="true" title={p?.name}>
                              {p?.initials}
                            </span>
                            <span className="fl-meta">
                              <Icon name="clock" /> {card.due}
                            </span>
                            <span className="fl-as-card__moves">
                              <button type="button" className="fl-as-iconbtn fl-as-iconbtn--sm" disabled={ci === 0} onClick={() => step(card, -1)}>
                                <Glyph d={ARROW_L} />
                                <span className="fl-sr">
                                  Move “{card.title}” to {d.columns[ci - 1]?.title ?? "previous column"}
                                </span>
                              </button>
                              <button type="button" className="fl-as-iconbtn fl-as-iconbtn--sm" disabled={ci === d.columns.length - 1} onClick={() => step(card, 1)}>
                                <Glyph d={ARROW_R} />
                                <span className="fl-sr">
                                  Move “{card.title}” to {d.columns[ci + 1]?.title ?? "next column"}
                                </span>
                              </button>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {adding === col.id ? (
                  <form className="fl-as-addcard" noValidate onSubmit={(e) => addCard(e, col.id)}>
                    <label htmlFor={`fl-as-kb-add-${col.id}`} className="fl-sr">
                      New card title for {col.title}
                    </label>
                    <textarea
                      id={`fl-as-kb-add-${col.id}`}
                      className="fl-input"
                      rows={2}
                      autoFocus
                      placeholder={d.addPlaceholder}
                      value={draft}
                      aria-invalid={draftError || undefined}
                      aria-describedby={draftError ? `fl-as-kb-err-${col.id}` : undefined}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        if (draftError) setDraftError(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        } else if (e.key === "Escape") {
                          closeAdd(col.id);
                        }
                      }}
                    />
                    {draftError && (
                      <p id={`fl-as-kb-err-${col.id}`} className="fl-as-error">
                        {d.addError}
                      </p>
                    )}
                    <div className="fl-as-addcard__row">
                      <button type="submit" className="fl-as-btn fl-as-btn--primary">
                        Add card
                      </button>
                      <button type="button" className="fl-as-btn fl-as-btn--quiet" onClick={() => closeAdd(col.id)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    ref={(el) => {
                      addBtns.current[col.id] = el;
                    }}
                    type="button"
                    className="fl-as-addbtn"
                    onClick={() => {
                      setAdding(col.id);
                      setDraft("");
                      setDraftError(false);
                    }}
                  >
                    <Glyph d={PLUS} />
                    {d.addLabel}
                    <span className="fl-sr"> to {col.title}</span>
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
