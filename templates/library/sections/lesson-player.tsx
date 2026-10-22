/** @flowcode-library lesson-player · Lesson player (App screens)
 * Catalog ID: p.lesson-player (pattern)
 * Function: The lesson screen of an online course (p.lesson-player): an outline of modules and lessons with ticks and the course's progress, the current lesson as a video (the library's video player) or a reading, Previous / Mark complete / Next, and the learner's own notes per lesson (saved, deleted after a confirm). Saving shows busy and error states; progress and notes stay in the browser.
 * Use it as: import { LessonPlayer } from "./lesson-player"; <LessonPlayer course modules={[{ id, title, lessons: [{ id, title, minutes, kind: "video"|"reading", summary, body?: string[], scenes?: string[], captions?: [{ start, end, text }] }] }]} done?={["l1"]} start?="l2" storageKey?="course-1" onComplete?={async (lessonId, complete) => ...} onSaveNote?={async (lessonId, note) => ...} />
 * Built from: c.media-player.video, c.progress.bar, c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.segmented.segmented, c.modal.danger
 * Look: A gray page with a white outline card on the left (course name, a thin progress bar, modules that fold open with numbered lessons and green ticks, the current one tinted with a straight accent bar) and on the right a white lesson card (module and lesson number, the title, a video on glass controls or a reading, then Previous, Mark complete and Next) above a notes card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: online course lesson; training module; onboarding course; video course player; school lesson page; certification prep course; internal academy
 * Jobs to be done: watch or read the next lesson; see where I am in the course; mark a lesson done; go back to a lesson; keep notes as I learn
 * Keywords: lesson, course, learning, e-learning, LMS, outline, curriculum, video lesson, notes, mark complete, progress, education
 */
/**
 * Lesson player. The outline lists modules; a module folds open and closed (its lessons leave the tab order while
 * closed). The lessons are one roving group: ↑ ↓ move between them, Home and End jump to the first and last, Enter
 * opens one. Opening a lesson keeps focus in the outline; Previous and Next move focus to the new lesson's title.
 * Mark complete saves (busy, then a tick in the outline and the progress bar fills); when every lesson is done the
 * course shows as complete, and Start over clears progress after a confirm. Notes belong to the lesson: an empty note
 * is refused, Save note shows busy, and a failed save keeps the text with a Try again. Delete asks first; focus then
 * goes to the next note, or back to the note field. The Test mode switch makes the sample saves fail.
 * Make it the app's own: replace SAMPLE with the course, and make onComplete and onSaveNote call the server.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its side menu (collapsible groups of links) and steps.
 */
/**
 * How to try it
 * - In the outline press ↓ and ↑ to move between lessons and Enter to open one; fold a module with its header.
 * - Press Next: focus goes to the new lesson's title. Play the video with Space, or read a reading lesson.
 * - Press Mark complete: the tick shows in the outline and the bar fills. Press it again to undo.
 * - Press Save note with the field empty: the message shows. Write a note and save it.
 * - Set Test result to "Fails" and save a note or mark a lesson: the error shows with Try again.
 * - Delete a note: it asks first. Finish every lesson to see "Course complete", then Start over (asks first).
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's VideoPlayer and GlassFilter
 * ("./media-player", "./liquid-glass"), Progress ("./progress-indicators"), Badge ("./badges-status"), Button
 * ("./buttons-variants"), TextField ("./text-fields-states"), Segmented ("./segmented-control"), Modal
 * ("./modals-dialogs") and the inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at
 * run time. The styles are the library's own fl- classes in templates/library/css/r5a-lesson-player.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { GlassFilter } from "./liquid-glass";
import { VideoPlayer } from "./media-player";
import { Modal } from "./modals-dialogs";
import { Progress } from "./progress-indicators";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.lesson-player: outline, the lesson, Previous / Mark complete / Next, and notes. ──

export type Lesson = {
  id: string;
  title: string;
  minutes: number;
  kind: "video" | "reading";
  /** One or two sentences under the lesson. */
  summary: string;
  /** Reading lessons: the paragraphs. */
  body?: string[];
  /** Video lessons without a src: the words the generated clip shows. */
  scenes?: string[];
  /** Video lessons: a real file. */
  src?: string;
  captions?: { start: number; end: number; text: string }[];
};
export type LessonModule = { id: string; title: string; lessons: Lesson[] };
export type LessonNote = { id: string; text: string; /** ISO time */ at: string };

export type LessonPlayerProps = {
  course: string;
  modules: LessonModule[];
  /** Lesson ids already finished. */
  done?: string[];
  /** The lesson to open first; the first unfinished one when left out. */
  start?: string;
  /** Keeps progress and notes in this browser under this key. */
  storageKey?: string;
  /** Saves a lesson as complete (or not). Throw to show the error. */
  onComplete?: (lessonId: string, complete: boolean) => Promise<void>;
  /** Saves a note. Throw to show the error. */
  onSaveNote?: (lessonId: string, note: LessonNote) => Promise<void>;
  locale?: string;
};

const NOTE_MAX = 500;
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function readStore<T>(key: string | undefined, fallback: T): T {
  if (!key) return fallback;
  try {
    const raw = window.localStorage.getItem(`fl-lsn:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string | undefined, value: unknown) {
  if (!key) return;
  try {
    window.localStorage.setItem(`fl-lsn:${key}`, JSON.stringify(value));
  } catch {
    /* Private windows and blocked storage: progress just isn't kept. */
  }
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

/** ↑ ↓ Home End between the items matching `selector` inside the group (items in a closed fold are skipped). */
function rove(e: KeyboardEvent<HTMLElement>, selector: string) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(selector)).filter((el) => !el.closest("[inert]"));
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  const to = e.key === "ArrowDown" ? (i + 1) % items.length : e.key === "ArrowUp" ? (i - 1 + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
  if (to < 0) return;
  e.preventDefault();
  items[to]?.focus();
}

export function LessonPlayer({ course, modules, done: doneStart = [], start, storageKey, onComplete, onSaveNote, locale = "en-US" }: LessonPlayerProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const flat = useMemo(() => modules.flatMap((m) => m.lessons.map((l, i) => ({ lesson: l, module: m, index: i }))), [modules]);
  const [done, setDone] = useState<string[]>(() => readStore(storageKey ? `${storageKey}:done` : undefined, doneStart));
  const [notes, setNotes] = useState<Record<string, LessonNote[]>>(() => readStore(storageKey ? `${storageKey}:notes` : undefined, {}));
  const [current, setCurrent] = useState(() => start ?? flat.find((x) => !done.includes(x.lesson.id))?.lesson.id ?? flat[0]?.lesson.id ?? "");
  const [open, setOpen] = useState<string[]>(() => {
    const m = flat.find((x) => x.lesson.id === current)?.module.id;
    return m ? [m] : modules.slice(0, 1).map((x) => x.id);
  });
  const [rover, setRover] = useState(current);
  const [test, setTest] = useState<"ok" | "fail">("ok");
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState("");
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [askReset, setAskReset] = useState(false);
  const [said, setSaid] = useState("");

  useEffect(() => writeStore(storageKey ? `${storageKey}:done` : undefined, done), [storageKey, done]);
  useEffect(() => writeStore(storageKey ? `${storageKey}:notes` : undefined, notes), [storageKey, notes]);

  const at = flat.findIndex((x) => x.lesson.id === current);
  const here = flat[at];
  const total = flat.length;
  const doneCount = flat.filter((x) => done.includes(x.lesson.id)).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const lessonNotes = here ? notes[here.lesson.id] ?? [] : [];
  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), [locale]);

  // The lesson the outline's Tab stop sits on: the roving one if it's showing, else the first showing.
  const showing = flat.filter((x) => open.includes(x.module.id)).map((x) => x.lesson.id);
  const tabStop = showing.includes(rover) ? rover : showing[0];

  const openLesson = (id: string, focusTitle: boolean) => {
    const target = flat.find((x) => x.lesson.id === id);
    if (!target) return;
    setCurrent(id);
    setRover(id);
    setMarkError("");
    setDraft("");
    setDraftError("");
    setSaveError("");
    setOpen((o) => (o.includes(target.module.id) ? o : [...o, target.module.id]));
    setSaid(`${target.lesson.title}. ${target.module.title}, lesson ${target.index + 1} of ${target.module.lessons.length}.`);
    if (focusTitle) focusLater(() => document.getElementById(`${uid}-title`));
  };

  const toggleModule = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  const saveComplete = onComplete ?? (async () => {
    await wait(700);
    if (test === "fail") throw new Error("offline");
  });
  const saveNote = onSaveNote ?? (async () => {
    await wait(700);
    if (test === "fail") throw new Error("offline");
  });

  const toggleDone = async () => {
    if (!here) return;
    const id = here.lesson.id;
    const next = !done.includes(id);
    setMarking(true);
    setMarkError("");
    setSaid(next ? "Saving…" : "Undoing…");
    try {
      await saveComplete(id, next);
      const nextDone = next ? [...done, id] : done.filter((x) => x !== id);
      setDone(nextDone);
      const n = flat.filter((x) => nextDone.includes(x.lesson.id)).length;
      setSaid(next ? (n === total ? "Course complete." : `Lesson complete. ${n} of ${total} done.`) : `Marked not complete. ${n} of ${total} done.`);
      focusLater(() => document.getElementById(`${uid}-mark`));
    } catch {
      const msg = "Couldn't save. Check your connection and try again.";
      setMarkError(msg);
      setSaid(msg);
      focusLater(() => document.getElementById(`${uid}-mark-alert`));
    } finally {
      setMarking(false);
    }
  };

  const addNote = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!here) return;
    const text = draft.trim();
    if (!text) {
      setDraftError("Write something first.");
      setSaid("Write something first.");
      document.getElementById(`${uid}-note`)?.focus();
      return;
    }
    const note: LessonNote = { id: `n${Date.now()}`, text, at: new Date().toISOString() };
    setSaving(true);
    setSaveError("");
    setSaid("Saving note…");
    try {
      await saveNote(here.lesson.id, note);
      setNotes((all) => ({ ...all, [here.lesson.id]: [note, ...(all[here.lesson.id] ?? [])] }));
      setDraft("");
      setSaid("Note saved.");
      focusLater(() => document.getElementById(`${uid}-note`));
    } catch {
      const msg = "Note not saved. Your text is still here.";
      setSaveError(msg);
      setSaid(msg);
      focusLater(() => document.getElementById(`${uid}-save-alert`));
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = (noteId: string) => {
    if (!here) return;
    const list = notes[here.lesson.id] ?? [];
    const i = list.findIndex((n) => n.id === noteId);
    const rest = list.filter((n) => n.id !== noteId);
    setNotes((all) => ({ ...all, [here.lesson.id]: rest }));
    setAskDelete(null);
    setSaid("Note deleted.");
    const nextNote = rest[Math.min(i, rest.length - 1)];
    focusLater(() => document.getElementById(nextNote ? `${uid}-del-${nextNote.id}` : `${uid}-note`));
  };

  const resetAll = () => {
    setDone([]);
    setAskReset(false);
    setSaid("Progress cleared. Starting from the first lesson.");
    openLesson(flat[0]!.lesson.id, true);
  };

  if (!total || !here) {
    return (
      <div className="fl-lsn" data-fl="p.lesson-player">
        <div className="fl-lsn-card fl-lsn-empty is-wide">
          <span className="fl-lsn-empty-icon" aria-hidden="true">
            <Icon name="layers" />
          </span>
          <h3>No lessons yet</h3>
          <p>Lessons show here once the course has some.</p>
        </div>
      </div>
    );
  }

  const prev = flat[at - 1];
  const next = flat[at + 1];
  const isDone = done.includes(here.lesson.id);
  const finished = doneCount === total;

  return (
    <div className="fl-lsn" data-fl="p.lesson-player">
      <aside className="fl-lsn-card fl-lsn-side" aria-label="Course outline">
        <p className="fl-lsn-eyebrow">Course</p>
        <h3 className="fl-lsn-course">{course}</h3>
        <div className="fl-lsn-progress">
          <Progress value={pct} label="Course progress" thin />
          <p className="fl-lsn-muted">
            <span className="fl-lsn-num">
              {doneCount} of {total}
            </span>{" "}
            lessons · {pct}%
          </p>
        </div>
        <div className="fl-lsn-outline" onKeyDown={(e) => rove(e, "[data-lsn]")}>
          {modules.map((m, mi) => {
            const isOpen = open.includes(m.id);
            const mDone = m.lessons.filter((l) => done.includes(l.id)).length;
            return (
              <div key={m.id} className={isOpen ? "fl-lsn-mod is-open" : "fl-lsn-mod"}>
                <h4 className="fl-lsn-mod-h">
                  <button type="button" className="fl-lsn-mod-btn" aria-expanded={isOpen} aria-controls={`${uid}-m${mi}`} onClick={() => toggleModule(m.id)}>
                    <Icon name="chevron-down" />
                    <span className="fl-lsn-mod-name">{m.title}</span>
                    <span className="fl-lsn-mod-count fl-lsn-num" aria-label={`${mDone} of ${m.lessons.length} done`}>
                      {mDone}/{m.lessons.length}
                    </span>
                  </button>
                </h4>
                <div className="fl-lsn-fold" id={`${uid}-m${mi}`} inert={!isOpen}>
                  <ol className="fl-lsn-list">
                    {m.lessons.map((l, li) => {
                      const d = done.includes(l.id);
                      const cur = l.id === current;
                      return (
                        <li key={l.id}>
                          <button
                            type="button"
                            data-lsn={l.id}
                            tabIndex={l.id === tabStop ? 0 : -1}
                            className={["fl-lsn-item", d ? "is-done" : "", cur ? "is-current" : ""].filter(Boolean).join(" ")}
                            aria-current={cur ? "page" : undefined}
                            onFocus={() => setRover(l.id)}
                            onClick={() => openLesson(l.id, false)}
                          >
                            <span className="fl-lsn-tick" aria-hidden="true">
                              {d ? <Icon name="check" /> : li + 1}
                            </span>
                            <span className="fl-lsn-item-text">
                              <span className="fl-lsn-item-title">{l.title}</span>
                              <span className="fl-lsn-item-meta">
                                <Icon name={l.kind === "video" ? "play" : "layers"} />
                                {l.kind === "video" ? "Video" : "Reading"} · {l.minutes} min
                              </span>
                            </span>
                            {d ? <span className="fl-sr">, done</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="fl-lsn-main">
        {finished ? (
          <div className="fl-lsn-card fl-lsn-finished" role="status">
            <span className="fl-lsn-seal" aria-hidden="true">
              <Icon name="check" />
            </span>
            <div>
              <p className="fl-lsn-finished-title">Course complete</p>
              <p className="fl-lsn-muted">All {total} lessons done.</p>
            </div>
            <Button variant="tertiary" size={40} icon="refresh" onClick={() => setAskReset(true)}>
              Start over
            </Button>
          </div>
        ) : null}

        <article className="fl-lsn-card fl-lsn-lesson" aria-labelledby={`${uid}-title`}>
          <div className="fl-lsn-enter" key={here.lesson.id}>
            <p className="fl-lsn-eyebrow">
              {here.module.title} · Lesson {here.index + 1} of {here.module.lessons.length}
            </p>
            <h3 className="fl-lsn-title" id={`${uid}-title`} tabIndex={-1}>
              {here.lesson.title}
            </h3>
            <div className="fl-lsn-meta">
              <Badge tone="info">{here.lesson.kind === "video" ? "Video" : "Reading"}</Badge>
              <span className="fl-lsn-muted">
                <Icon name="clock" />
                {here.lesson.minutes} min
              </span>
              {isDone ? (
                <Badge tone="success" led>
                  Completed
                </Badge>
              ) : null}
            </div>
            {here.lesson.kind === "video" ? (
              <div className="fl-lsn-media">
                <VideoPlayer
                  src={here.lesson.src}
                  title={here.lesson.title}
                  scenes={here.lesson.scenes}
                  tracks={here.lesson.captions ? [{ label: "English", srclang: "en", cues: here.lesson.captions }] : undefined}
                />
              </div>
            ) : (
              <div className="fl-lsn-read">
                {(here.lesson.body ?? []).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
            <p className="fl-lsn-summary">{here.lesson.summary}</p>
          </div>

          {markError ? (
            <div className="fl-lsn-alert" role="alert" id={`${uid}-mark-alert`} tabIndex={-1}>
              <Icon name="alert" />
              <span>{markError}</span>
              <Button variant="secondary" size={32} onClick={() => void toggleDone()}>
                Try again
              </Button>
            </div>
          ) : null}

          <div className="fl-lsn-nav">
            <Button variant="tertiary" size={44} icon="arrow-left" disabled={!prev || marking} onClick={() => prev && openLesson(prev.lesson.id, true)}>
              Previous
            </Button>
            <Button id={`${uid}-mark`} variant={isDone ? "secondary" : "primary"} size={44} icon={isDone ? "refresh" : "check"} busy={marking} onClick={() => void toggleDone()}>
              {marking ? "Saving…" : isDone ? "Mark not complete" : "Mark complete"}
            </Button>
            <Button variant="secondary" size={44} icon="chevron-right" iconAt="end" disabled={!next || marking} onClick={() => next && openLesson(next.lesson.id, true)}>
              Next
            </Button>
          </div>
        </article>

        <section className="fl-lsn-card fl-lsn-notes" aria-labelledby={`${uid}-notes-h`}>
          <div className="fl-lsn-notes-top">
            <h4 id={`${uid}-notes-h`}>Notes</h4>
            <span className="fl-lsn-muted fl-lsn-num">{lessonNotes.length === 1 ? "1 note" : `${lessonNotes.length} notes`}</span>
          </div>
          <form className="fl-lsn-form" onSubmit={(e) => void addNote(e)} noValidate>
            <label htmlFor={`${uid}-note`} className="fl-sr">
              Note for this lesson
            </label>
            <TextField
              id={`${uid}-note`}
              multiline
              autoGrow
              rows={2}
              maxLength={NOTE_MAX}
              placeholder="Write a note for this lesson"
              value={draft}
              invalid={Boolean(draftError)}
              aria-describedby={`${uid}-count${draftError ? ` ${uid}-note-err` : ""}`}
              onChange={(e) => {
                setDraft(e.target.value);
                if (draftError) setDraftError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void addNote();
              }}
            />
            {draftError ? (
              <p className="fl-lsn-err" id={`${uid}-note-err`}>
                <Icon name="alert" />
                {draftError}
              </p>
            ) : null}
            <div className="fl-lsn-form-row">
              <span className="fl-lsn-muted fl-lsn-num" id={`${uid}-count`}>
                {draft.length}/{NOTE_MAX}
              </span>
              <Button type="submit" variant="primary" size={40} icon="plus" busy={saving}>
                {saving ? "Saving…" : "Save note"}
              </Button>
            </div>
          </form>
          {saveError ? (
            <div className="fl-lsn-alert" role="alert" id={`${uid}-save-alert`} tabIndex={-1}>
              <Icon name="alert" />
              <span>{saveError}</span>
              <Button variant="secondary" size={32} onClick={() => void addNote()}>
                Try again
              </Button>
            </div>
          ) : null}
          {lessonNotes.length === 0 ? (
            <p className="fl-lsn-none">No notes for this lesson yet.</p>
          ) : (
            <ul className="fl-lsn-notes-list" aria-label="Saved notes" onKeyDown={(e) => rove(e, "[data-note]")}>
              {lessonNotes.map((n, i) => (
                <li key={n.id} className="fl-lsn-note">
                  <p>{n.text}</p>
                  <span className="fl-lsn-note-foot">
                    <time dateTime={n.at}>{fmtTime.format(new Date(n.at))}</time>
                    <Button id={`${uid}-del-${n.id}`} data-note="" tabIndex={i === 0 ? 0 : -1} variant="tertiary" size={32} icon="trash" iconOnly aria-label={`Delete note: ${n.text.slice(0, 40)}`} onClick={() => setAskDelete(n.id)}>
                      Delete note
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="fl-lsn-test">
            <span className="fl-lsn-badge">Test mode</span>
            <Segmented
              label="Test result"
              size="sm"
              value={test}
              onChange={(v) => setTest(v as "ok" | "fail")}
              options={[
                { value: "ok", label: "Saves" },
                { value: "fail", label: "Fails" },
              ]}
            />
          </div>
        </section>
      </div>

      {askDelete ? (
        <Modal
          variant="danger"
          icon="trash"
          title="Delete this note?"
          description="It's removed from this lesson for good."
          confirmLabel="Delete note"
          cancelLabel="Keep it"
          onConfirm={() => {
            deleteNote(askDelete);
            return false;
          }}
          onClose={() => {
            const id = askDelete;
            setAskDelete(null);
            focusLater(() => document.getElementById(`${uid}-del-${id}`));
          }}
        />
      ) : null}
      {askReset ? (
        <Modal
          variant="danger"
          icon="refresh"
          title="Start the course over?"
          description={`This clears the ticks on all ${total} lessons. Your notes stay.`}
          confirmLabel="Clear progress"
          cancelLabel="Keep progress"
          onConfirm={() => {
            resetAll();
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
const SAMPLE: LessonPlayerProps = {
  course: "Watercolor Foundations",
  storageKey: "sample-watercolor",
  done: ["paper", "brushes"],
  modules: [
    {
      id: "m1",
      title: "Getting set up",
      lessons: [
        { id: "paper", title: "Choosing paper", minutes: 6, kind: "video", summary: "Cold-press, hot-press and rough paper, and why 300 gsm cotton forgives the most.", scenes: ["COLD PRESS", "HOT PRESS", "ROUGH"] },
        { id: "brushes", title: "Three brushes are enough", minutes: 5, kind: "reading", summary: "A round, a flat and a rigger cover almost every stroke in this course.", body: ["You do not need a full set. A size 8 round carries enough water for washes and still comes to a point for detail.", "Add a 3/4 inch flat for skies and straight edges, and a small rigger for branches and grasses.", "Rinse each brush in clean water, reshape the tip and dry it flat so water never runs into the ferrule."] },
        { id: "palette", title: "Setting out a palette", minutes: 8, kind: "video", summary: "Warm and cool of each primary, laid out so mixes stay clean.", scenes: ["WARM", "COOL", "MIX"], captions: [{ start: 1, end: 6, text: "Start with a warm and a cool of each primary." }, { start: 8, end: 14, text: "Keep yellows apart from blues so they stay bright." }, { start: 17, end: 24, text: "Leave the middle of the palette free for mixing." }] },
      ],
    },
    {
      id: "m2",
      title: "Washes",
      lessons: [
        { id: "flat", title: "The flat wash", minutes: 9, kind: "video", summary: "Tilt the board, load the brush fully and keep a wet edge moving down the page.", scenes: ["TILT", "LOAD", "BEAD"] },
        { id: "graded", title: "Graded and variegated washes", minutes: 11, kind: "video", summary: "Fade a color to clear water, then let two colors meet and mix on the paper.", scenes: ["FADE", "BLEND"] },
        { id: "fix", title: "Fixing blooms and streaks", minutes: 4, kind: "reading", summary: "Most marks can be lifted or turned into texture.", body: ["A bloom happens when wetter paint runs into a drying wash. Let it dry, then lift it with a damp brush and a tissue.", "Streaks mean the wash dried before the next stroke. Work faster, or mix more paint before you start."] },
      ],
    },
    {
      id: "m3",
      title: "First painting",
      lessons: [
        { id: "sketch", title: "A light sketch", minutes: 7, kind: "video", summary: "Keep the pencil loose and light so it disappears under the first wash.", scenes: ["SKETCH"] },
        { id: "layers", title: "Painting in layers", minutes: 14, kind: "video", summary: "Light to dark, big to small: three passes to a finished landscape.", scenes: ["LIGHT", "MID", "DARK"] },
      ],
    },
  ],
};

export default function LessonPlayerPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.course}>
      <GlassFilter />
      <div className="fl-wrap">
        <LessonPlayer {...SAMPLE} />
      </div>
    </section>
  );
}
