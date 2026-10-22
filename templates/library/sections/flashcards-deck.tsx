/** @flowcode-library flashcards-deck · Flashcards deck (Cards)
 * Catalog ID: p.flashcards (pattern)
 * Function: A flashcard study session (p.flashcards): one card at a time that flips to the answer, then Still learning or Know it; missed cards come back a few cards later; each card moves through three review boxes (today, tomorrow, in 3 days) shown as counts; undo, shuffle, a finished-session summary with Review missed and Review all, and Reset progress after a confirm. Loading, error and empty decks have their own states; progress stays in the browser.
 * Use it as: import { FlashcardsDeck } from "./flashcards-deck"; <FlashcardsDeck deck cards?={[{ id, front, back, hint? }]} load?={async () => cards} storageKey?="deck-1" />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.progress.bar, c.modal.danger
 * Look: A gray page with one white card: the deck name and three small count chips (Due, Learning, Known) above a thin progress bar, a large flip card (question on the front, answer on an accent-tinted back) and two wide buttons under it, Still learning and Know it, with key hints. The finished view is a centered card with a green tick and the review-box counts.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-lg --text-xl --text-2xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: language vocabulary; exam revision; course key terms; medical or law terms; onboarding glossary; study app; spelling practice
 * Jobs to be done: test myself one card at a time; see the answer when I'm ready; see the ones I miss again soon; know how many are left and how many I know; pick up where I left off
 * Keywords: flashcards, flip card, study, spaced repetition, review, memorize, vocabulary, deck, learning, education
 */
/**
 * Flashcards. The card is a button: Enter or Space flips it. Once flipped, "Still learning" (or 1) and "Know it" (or 2)
 * answer; focus goes back to the next card. Know it moves the card up a box (today → tomorrow → in 3 days) and out of
 * this session; Still learning puts it in box 1 and back into the queue three cards later. Undo (or U) takes back the
 * last answer; Shuffle mixes the cards left. When the queue is empty the summary shows the box counts, Review missed
 * (box 1 only) and Review all. Reset progress asks first. With `load`, the deck shows a loading card, then the cards,
 * or an error with Retry; an empty deck says so.
 * Make it the app's own: replace SAMPLE with your cards (or a `load` that fetches them) and give each deck its own
 * storageKey.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa): its article card (a label and tag row over a
 * title and text).
 */
/**
 * How to try it
 * - Press the card (or Enter / Space) to flip it. Press 1 for Still learning or 2 for Know it.
 * - Miss a card: it comes back a few cards later. Press Undo (or U) to take an answer back.
 * - Press Shuffle to mix what's left. Finish the session to see the summary; try Review missed.
 * - Press Reset progress: it asks first.
 * - Set Test to "Fails" and Reload: the error shows; set "Loads" and Retry.
 *
 * Dependencies: React (useCallback, useEffect, useId, useRef, useState), Button ("./buttons-variants"), Progress
 * ("./progress-indicators"), Modal ("./modals-dialogs"), Segmented ("./segmented-control", preview only) and the
 * inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css/r5a-flashcards-deck.css.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Progress } from "./progress-indicators";
import { Segmented } from "./segmented-control";

// ── p.flashcards: flip, answer, spaced boxes, summary. ──

export type FlashCard = { id: string; front: string; back: string; /** A short line under the answer, like an example. */ hint?: string };
/** 0 new, 1 today, 2 tomorrow, 3 in 3 days. */
type Box = 0 | 1 | 2 | 3;

export type FlashcardsDeckProps = {
  deck: string;
  cards?: FlashCard[];
  /** Fetches the cards; the deck shows loading and error states while it runs. */
  load?: () => Promise<FlashCard[]>;
  /** Keeps the boxes in this browser under this key. */
  storageKey?: string;
};

const BOX_WHEN = ["New", "Today", "Tomorrow", "In 3 days"];

function readStore(key: string | undefined): Record<string, Box> {
  if (!key) return {};
  try {
    return JSON.parse(window.localStorage.getItem(`fl-fcd:${key}`) ?? "{}") as Record<string, Box>;
  } catch {
    return {};
  }
}
function writeStore(key: string | undefined, value: Record<string, Box>) {
  if (!key) return;
  try {
    window.localStorage.setItem(`fl-fcd:${key}`, JSON.stringify(value));
  } catch {
    /* Blocked storage: the session still works, it just isn't kept. */
  }
}
function shuffled<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Focuses an element once React has drawn it. */
function useFocusLater() {
  const want = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const find = want.current;
    if (!find) return;
    const el = find();
    if (el) {
      want.current = null;
      el.focus();
    }
  });
  return (find: () => HTMLElement | null | undefined) => {
    want.current = find;
    setTick((t) => t + 1);
  };
}

export function FlashcardsDeck({ deck, cards: given, load, storageKey }: FlashcardsDeckProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const [cards, setCards] = useState<FlashCard[] | null>(load ? null : given ?? []);
  const [loadError, setLoadError] = useState(false);
  const [boxes, setBoxes] = useState<Record<string, Box>>(() => readStore(storageKey));
  const [queue, setQueue] = useState<string[]>([]);
  const [sessionSize, setSessionSize] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<{ boxes: Record<string, Box>; queue: string[] }[]>([]);
  const [askReset, setAskReset] = useState(false);
  const [started, setStarted] = useState(false);
  const [said, setSaid] = useState("");

  useEffect(() => writeStore(storageKey, boxes), [storageKey, boxes]);

  const fetchCards = useCallback(async (retry = false) => {
    if (!load) return;
    setCards(null);
    setLoadError(false);
    setSaid("Loading cards…");
    try {
      const list = await load();
      setCards(list);
      setSaid(`${list.length} cards loaded.`);
      // After Retry the button is gone, so focus goes to the card that replaced it.
      if (retry) focusLater(() => document.getElementById(`${uid}-card`) ?? document.getElementById(`${uid}-title`));
    } catch {
      setLoadError(true);
      setSaid("Couldn't load the deck.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  const boxOf = (id: string): Box => boxes[id] ?? 0;
  const start = (ids: string[], focus = true) => {
    setQueue(ids);
    setSessionSize(ids.length);
    setRevealed(false);
    setHistory([]);
    setStarted(true);
    setSaid(`${ids.length} cards to review.`);
    if (focus) focusLater(() => document.getElementById(`${uid}-card`));
  };

  // First session once the cards are in: whatever is due (new and box 1), or every card when nothing is due.
  useEffect(() => {
    if (!cards || started) return;
    const due = cards.filter((c) => (boxes[c.id] ?? 0) <= 1).map((c) => c.id);
    start(due.length ? due : cards.map((c) => c.id), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  const card = cards?.find((c) => c.id === queue[0]);
  const counts = { due: 0, learning: 0, known: 0 };
  for (const c of cards ?? []) {
    const b = boxOf(c.id);
    if (b <= 1) counts.due++;
    if (b === 1) counts.learning++;
    if (b >= 2) counts.known++;
  }
  const reviewed = sessionSize - new Set(queue).size;
  const pct = sessionSize ? Math.round((reviewed / sessionSize) * 100) : 0;
  const missed = (cards ?? []).filter((c) => boxOf(c.id) === 1).map((c) => c.id);

  const flip = () => {
    if (!card) return;
    setRevealed((r) => !r);
    setSaid(revealed ? `Front: ${card.front}` : `Answer: ${card.back}${card.hint ? `. ${card.hint}` : ""}`);
  };

  const answer = (know: boolean) => {
    if (!card || !revealed) return;
    setHistory((h) => [...h, { boxes, queue }]);
    const b = boxOf(card.id);
    const nextBox: Box = know ? (b >= 2 ? 3 : 2) : 1;
    setBoxes((x) => ({ ...x, [card.id]: nextBox }));
    const rest = queue.slice(1);
    let q: string[];
    if (know) q = rest;
    else {
      const at = Math.min(3, rest.length);
      q = [...rest.slice(0, at), card.id, ...rest.slice(at)];
    }
    setQueue(q);
    setRevealed(false);
    const nextCard = cards?.find((c) => c.id === q[0]);
    setSaid(`${know ? `Known. Next review ${BOX_WHEN[nextBox]!.toLowerCase()}.` : "Still learning. It comes back soon."} ${nextCard ? `Next: ${nextCard.front}` : "Session done."}`);
    focusLater(() => document.getElementById(q.length ? `${uid}-card` : `${uid}-done`));
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setBoxes(last.boxes);
    setQueue(last.queue);
    setRevealed(false);
    setSaid("Last answer undone.");
    focusLater(() => document.getElementById(`${uid}-card`));
  };

  const shuffle = () => {
    if (queue.length < 2) return;
    setQueue((q) => shuffled([...new Set(q)]));
    setRevealed(false);
    setSaid("Cards shuffled.");
  };

  const reset = () => {
    setBoxes({});
    setAskReset(false);
    start((cards ?? []).map((c) => c.id));
    setSaid("Progress reset. Every card is new again.");
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (askReset || e.target instanceof HTMLInputElement || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "1") answer(false);
    else if (e.key === "2") answer(true);
    else if (e.key === "u" || e.key === "U") undo();
    else return;
    e.preventDefault();
  };

  const header = (
    <div className="fl-fcd-top">
      <div>
        <p className="fl-fcd-eyebrow">Flashcards</p>
        <h3 className="fl-fcd-title" id={`${uid}-title`} tabIndex={-1}>
          {deck}
        </h3>
      </div>
      {cards?.length ? (
        <ul className="fl-fcd-counts" aria-label="Review boxes">
          <li className="is-due">
            <span className="fl-fcd-num">{counts.due}</span> Due
          </li>
          <li className="is-learning">
            <span className="fl-fcd-num">{counts.learning}</span> Learning
          </li>
          <li className="is-known">
            <span className="fl-fcd-num">{counts.known}</span> Known
          </li>
        </ul>
      ) : null}
    </div>
  );

  let body;
  if (loadError) {
    body = (
      <div className="fl-fcd-state" role="alert">
        <span className="fl-fcd-state-icon is-error" aria-hidden="true">
          <Icon name="alert" />
        </span>
        <p className="fl-fcd-state-title">Couldn't load the deck</p>
        <p className="fl-fcd-muted">Check your connection and try again.</p>
        <Button variant="secondary" size={40} icon="refresh" onClick={() => void fetchCards(true)}>
          Retry
        </Button>
      </div>
    );
  } else if (!cards) {
    body = (
      <div className="fl-fcd-stage" aria-busy="true">
        <div className="fl-fcd-skel" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="fl-sr">Loading cards…</p>
      </div>
    );
  } else if (!cards.length) {
    body = (
      <div className="fl-fcd-state">
        <span className="fl-fcd-state-icon" aria-hidden="true">
          <Icon name="layers" />
        </span>
        <p className="fl-fcd-state-title">No cards in this deck</p>
        <p className="fl-fcd-muted">Add some cards to start studying.</p>
      </div>
    );
  } else if (!card) {
    body = (
      <div className="fl-fcd-state fl-fcd-enter">
        <span className="fl-fcd-state-icon is-done" aria-hidden="true">
          <Icon name="check" />
        </span>
        <p className="fl-fcd-state-title" id={`${uid}-done`} tabIndex={-1}>
          Session done
        </p>
        <p className="fl-fcd-muted">
          {sessionSize} {sessionSize === 1 ? "card" : "cards"} reviewed. {counts.known} known, {counts.learning} still learning.
        </p>
        <dl className="fl-fcd-boxes">
          {([1, 2, 3] as const).map((b) => (
            <div key={b}>
              <dt>{BOX_WHEN[b]}</dt>
              <dd className="fl-fcd-num">{cards.filter((c) => boxOf(c.id) === b).length}</dd>
            </div>
          ))}
        </dl>
        <div className="fl-fcd-row">
          <Button variant="primary" size={44} icon="refresh" disabled={!missed.length} onClick={() => start(shuffled(missed))}>
            Review missed{missed.length ? ` (${missed.length})` : ""}
          </Button>
          <Button variant="secondary" size={44} onClick={() => start(shuffled(cards.map((c) => c.id)))}>
            Review all
          </Button>
        </div>
      </div>
    );
  } else {
    const left = new Set(queue).size;
    body = (
      <>
        <Progress value={pct} label={`${reviewed} of ${sessionSize} reviewed`} thin />
        <div className="fl-fcd-stage">
          <button
            type="button"
            id={`${uid}-card`}
            className={revealed ? "fl-fcd-card is-flipped" : "fl-fcd-card"}
            aria-describedby={`${uid}-how`}
            onClick={flip}
          >
            <span className="fl-fcd-inner" key={card.id}>
              <span className="fl-fcd-face fl-fcd-front" aria-hidden={revealed}>
                <span className="fl-fcd-face-meta">
                  {left} left · {BOX_WHEN[boxOf(card.id)]}
                </span>
                <span className="fl-fcd-text">{card.front}</span>
                <span className="fl-fcd-tap">
                  <Icon name="refresh" />
                  Show answer
                </span>
              </span>
              <span className="fl-fcd-face fl-fcd-back" aria-hidden={!revealed}>
                <span className="fl-fcd-face-meta">Answer</span>
                <span className="fl-fcd-text">{card.back}</span>
                {card.hint ? <span className="fl-fcd-hint">{card.hint}</span> : null}
              </span>
            </span>
          </button>
          <p className="fl-sr" id={`${uid}-how`}>
            {revealed ? "Showing the answer. Press 1 for still learning, 2 for know it." : "Press Enter to show the answer."}
          </p>
        </div>
        <div className="fl-fcd-answer">
          <Button variant="secondary" size={48} icon="close" disabled={!revealed} onClick={() => answer(false)}>
            Still learning
            <kbd aria-hidden="true">1</kbd>
          </Button>
          <Button variant="primary" size={48} icon="check" disabled={!revealed} onClick={() => answer(true)}>
            Know it
            <kbd aria-hidden="true">2</kbd>
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="fl-fcd" data-fl="p.flashcards" onKeyDown={onKey}>
      <div className="fl-fcd-shell">
        {header}
        {body}
        {cards?.length ? (
          <div className="fl-fcd-tools">
            <Button variant="tertiary" size={40} icon="arrow-left" disabled={!history.length} onClick={undo}>
              Undo
            </Button>
            <Button variant="tertiary" size={40} icon="refresh" disabled={!card || queue.length < 2} onClick={shuffle}>
              Shuffle
            </Button>
            <Button variant="tertiary" size={40} icon="trash" onClick={() => setAskReset(true)}>
              Reset progress
            </Button>
          </div>
        ) : null}
      </div>
      {askReset ? (
        <Modal
          variant="danger"
          icon="trash"
          title="Reset progress for this deck?"
          description={`All ${cards?.length ?? 0} cards go back to new, and this session starts over.`}
          confirmLabel="Reset progress"
          cancelLabel="Keep progress"
          onConfirm={() => {
            reset();
            return false;
          }}
          onClose={() => setAskReset(false)}
        />
      ) : null}
      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: FlashcardsDeckProps & { cards: FlashCard[] } = {
  deck: "Spanish: around town",
  storageKey: "sample-spanish-town",
  cards: [
    { id: "c1", front: "la biblioteca", back: "the library", hint: "¿Dónde está la biblioteca?" },
    { id: "c2", front: "la panadería", back: "the bakery", hint: "Compro pan en la panadería." },
    { id: "c3", front: "el ayuntamiento", back: "the town hall" },
    { id: "c4", front: "la parada de autobús", back: "the bus stop", hint: "La parada está en la esquina." },
    { id: "c5", front: "a la derecha", back: "to the right" },
    { id: "c6", front: "todo recto", back: "straight ahead", hint: "Siga todo recto dos calles." },
    { id: "c7", front: "el mercado", back: "the market" },
    { id: "c8", front: "cerca de", back: "near (to)", hint: "El hotel está cerca de la playa." },
  ],
};

export default function FlashcardsDeckPreview() {
  const [test, setTest] = useState<"ok" | "fail">("ok");
  const [run, setRun] = useState(0);
  const testRef = useRef(test);
  testRef.current = test;
  const load = useCallback(async () => {
    await new Promise((r) => window.setTimeout(r, 700));
    if (testRef.current === "fail") throw new Error("offline");
    return SAMPLE.cards;
  }, []);
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.deck}>
      <div className="fl-wrap fl-fcd-preview">
        <div className="fl-fcd-test">
          <span className="fl-fcd-badge">Test mode</span>
          <Segmented
            label="Test"
            size="sm"
            value={test}
            onChange={(v) => setTest(v as "ok" | "fail")}
            options={[
              { value: "ok", label: "Loads" },
              { value: "fail", label: "Fails" },
            ]}
          />
          <Button variant="tertiary" size={32} icon="refresh" onClick={() => setRun((n) => n + 1)}>
            Reload
          </Button>
        </div>
        <FlashcardsDeck key={run} deck={SAMPLE.deck} storageKey={SAMPLE.storageKey} load={load} />
      </div>
    </section>
  );
}
