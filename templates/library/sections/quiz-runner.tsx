/** @flowcode-library quiz-runner · Quiz with timer and review (Forms)
 * Catalog ID: p.quiz (pattern)
 * Function: A timed quiz (p.quiz): a start card with the rules, then one question at a time (one answer, several answers, true or false, or a typed answer) with a countdown, a numbered question map, flag for review, Previous and Next; Submit warns about unanswered questions first; the result shows the score against the pass mark and every question with your answer, the right one and why. Submitting shows busy and error states; time running out submits on its own.
 * Use it as: import { QuizRunner } from "./quiz-runner"; <QuizRunner title intro? minutes?={10} passMark?={70} questions={[{ id, type: "single"|"multi"|"truefalse"|"text", prompt, options?: [{ id, label }], answer: string[], explain?, hint? }]} onSubmit?={async (answers) => ...} />
 * Built from: c.radio, c.checkbox, c.text-field.outlined, c.progress.bar, c.progress.ring, c.badge.status, c.segmented.segmented, c.modal.confirm, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: A gray page with one white card: a top row with the quiz name, "Question 3 of 8" and a countdown chip, a thin progress bar, a row of numbered square chips (tinted when answered, a small amber dot when flagged), the question with answer cards, and Previous / Flag / Next along the bottom. The result card has a large score ring, a pass or fail badge and a folding list of every question marked right or wrong.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: course quiz; knowledge check; certification practice test; training assessment; school test; onboarding quiz; compliance training check
 * Jobs to be done: answer the questions before time runs out; move between questions and come back to flagged ones; know what I left unanswered before I submit; see my score and whether I passed; learn from the ones I got wrong
 * Keywords: quiz, test, exam, assessment, questions, multiple choice, true or false, timer, score, review answers, education, learning
 */
/**
 * Quiz. Start begins the countdown (left out, no time limit). Questions show one at a time; the question map is one
 * roving group (← → Home End, Enter opens) whose chips read "answered", "flagged" or "not answered". Answer cards are
 * native radios and checkboxes, so arrow keys and Space work as usual; a typed answer is checked without case and
 * extra spaces. Next and Previous move focus to the new question. Submit warns when some are unanswered (with a way to
 * go to the first one); a minute before time is up the countdown turns amber and says so; at zero the quiz submits.
 * Submitting shows busy, then the result: score ring, pass or fail against the pass mark, and a review list that folds
 * open per question. Retake starts over. A failed submit keeps every answer and offers Try again. The Test mode switch
 * makes the sample submit fail.
 * Make it the app's own: replace SAMPLE with your questions and make onSubmit send the answers to the server.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its radio groups (answer cards) and progress bars.
 */
/**
 * How to try it
 * - Press Start quiz. Answer question 1 with a click, then Next (focus goes to the new question).
 * - In the question map press ← → and Enter to jump; press Flag on a question and see the flag on its chip.
 * - Type an answer on the typed question; capitals and extra spaces don't matter.
 * - Press Submit with questions left: the dialog lists how many; "Go to question" takes you to the first.
 * - Set Test result to "Fails" and submit: the error shows with Try again, answers kept.
 * - On the result, open a question to see your answer, the right one and why. Retake starts over.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), Radio and Checkbox ("./checkboxes-radios"),
 * TextField ("./text-fields-states"), Progress ("./progress-indicators"), Badge ("./badges-status"), Segmented
 * ("./segmented-control"), Modal ("./modals-dialogs"), Button ("./buttons-variants") and the inline icon set
 * ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the library's own
 * fl- classes in templates/library/css/r5a-quiz-runner.css.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Progress } from "./progress-indicators";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.quiz: start, questions with a timer and a map, submit, then score and review. ──

export type QuizQuestion = {
  id: string;
  type: "single" | "multi" | "truefalse" | "text";
  prompt: string;
  /** single and multi: the choices. truefalse makes its own. */
  options?: { id: string; label: string }[];
  /** The right option ids; for truefalse "true" or "false"; for text, every accepted answer. */
  answer: string[];
  /** Shown in the review. */
  explain?: string;
  /** For text: a hint under the field, such as "One word". */
  hint?: string;
};
export type QuizAnswers = Record<string, string[]>;

export type QuizRunnerProps = {
  title: string;
  intro?: string;
  questions: QuizQuestion[];
  /** Time limit; no countdown when left out. */
  minutes?: number;
  /** Percent needed to pass. */
  passMark?: number;
  /** Sends the answers. Throw to show the error. */
  onSubmit?: (answers: QuizAnswers) => Promise<void>;
};

const TF = [
  { id: "true", label: "True" },
  { id: "false", label: "False" },
];
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function isRight(q: QuizQuestion, given: string[] | undefined) {
  if (!given?.length) return false;
  if (q.type === "text") return q.answer.some((a) => norm(a) === norm(given[0] ?? ""));
  const a = [...q.answer].sort().join("|");
  return [...given].sort().join("|") === a;
}
const answered = (given: string[] | undefined) => Boolean(given?.length && given.some((g) => g.trim()));

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

export function QuizRunner({ title, intro, questions, minutes, passMark = 70, onSubmit }: QuizRunnerProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [flags, setFlags] = useState<string[]>([]);
  const [left, setLeft] = useState((minutes ?? 0) * 60);
  const [timedOut, setTimedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ask, setAsk] = useState(false);
  const [test, setTest] = useState<"ok" | "fail">("ok");
  const [open, setOpen] = useState<string[]>([]);
  const [mapAt, setMapAt] = useState(0);
  const [said, setSaid] = useState("");
  const submitting = useRef(false);

  const total = questions.length;
  const q = questions[at];
  const doneCount = questions.filter((x) => answered(answers[x.id])).length;
  const unanswered = questions.map((x, i) => (answered(answers[x.id]) ? -1 : i)).filter((i) => i >= 0);
  const score = questions.filter((x) => isRight(x, answers[x.id])).length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const passed = pct >= passMark;
  const timed = Boolean(minutes);
  const low = timed && left <= 60;

  const send = onSubmit ?? (async () => {
    await wait(900);
    if (test === "fail") throw new Error("offline");
  });

  const submit = async (auto = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setAsk(false);
    setBusy(true);
    setError("");
    setSaid(auto ? "Time is up. Submitting your answers…" : "Submitting…");
    try {
      await send(answers);
      setPhase("done");
      setOpen([]);
      const s = questions.filter((x) => isRight(x, answers[x.id])).length;
      const p = total ? Math.round((s / total) * 100) : 0;
      setSaid(`${auto ? "Time is up. " : ""}You scored ${s} of ${total}, ${p}%. ${p >= passMark ? "Passed." : "Not passed."}`);
      focusLater(() => document.getElementById(`${uid}-result`));
    } catch {
      const msg = "Your answers weren't sent. They're still here.";
      setError(msg);
      setSaid(msg);
      focusLater(() => document.getElementById(`${uid}-alert`));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  // The countdown: one tick a second while running; a warning at one minute; at zero it submits.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (phase !== "run" || !timed || timedOut) return;
    const t = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [phase, timed, timedOut]);
  useEffect(() => {
    if (phase !== "run" || !timed) return;
    if (left === 60) setSaid("One minute left.");
    if (left === 0 && !timedOut) {
      setTimedOut(true);
      void submitRef.current(true);
    }
  }, [left, phase, timed, timedOut]);

  const begin = () => {
    setPhase("run");
    setAt(0);
    setMapAt(0);
    setAnswers({});
    setFlags([]);
    setLeft((minutes ?? 0) * 60);
    setTimedOut(false);
    setError("");
    setSaid(`Question 1 of ${total}.${timed ? ` ${minutes} minutes.` : ""}`);
    focusLater(() => document.getElementById(`${uid}-q`));
  };

  const goTo = (i: number, focusQuestion = true) => {
    if (i < 0 || i >= total) return;
    setAt(i);
    setMapAt(i);
    setSaid(`Question ${i + 1} of ${total}.`);
    if (focusQuestion) focusLater(() => document.getElementById(`${uid}-q`));
  };

  const setAnswer = (id: string, value: string[]) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    if (error) setError("");
  };

  const toggleFlag = () => {
    if (!q) return;
    const on = !flags.includes(q.id);
    setFlags((f) => (on ? [...f, q.id] : f.filter((x) => x !== q.id)));
    setSaid(on ? `Question ${at + 1} flagged for review.` : `Flag removed from question ${at + 1}.`);
  };

  const tryFinish = () => {
    if (unanswered.length) setAsk(true);
    else void submit();
  };

  const onMapKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const to = e.key === "ArrowRight" ? (mapAt + 1) % total : e.key === "ArrowLeft" ? (mapAt - 1 + total) % total : e.key === "Home" ? 0 : e.key === "End" ? total - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setMapAt(to);
    document.getElementById(`${uid}-chip-${to}`)?.focus();
  };

  if (!total) {
    return (
      <div className="fl-qz" data-fl="p.quiz">
        <div className="fl-qz-card fl-qz-center">
          <span className="fl-qz-icon" aria-hidden="true">
            <Icon name="help" />
          </span>
          <h3 className="fl-qz-h">No questions yet</h3>
          <p className="fl-qz-muted">This quiz opens once it has questions.</p>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="fl-qz" data-fl="p.quiz">
        <div className="fl-qz-card fl-qz-center fl-qz-enter">
          <span className="fl-qz-icon" aria-hidden="true">
            <Icon name="help" />
          </span>
          <h3 className="fl-qz-h" id={`${uid}-intro`} tabIndex={-1}>
            {title}
          </h3>
          {intro ? <p className="fl-qz-muted">{intro}</p> : null}
          <dl className="fl-qz-facts">
            <div>
              <dt>Questions</dt>
              <dd>{total}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{timed ? `${minutes} min` : "No limit"}</dd>
            </div>
            <div>
              <dt>Pass mark</dt>
              <dd>{passMark}%</dd>
            </div>
          </dl>
          <Button variant="primary" size={48} icon="play" onClick={begin}>
            Start quiz
          </Button>
        </div>
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="fl-qz" data-fl="p.quiz">
        <div className="fl-qz-card fl-qz-result fl-qz-enter">
          <div className="fl-qz-score">
            <Progress variant="ring" large value={pct} tone={passed ? "success" : "danger"} label="Score">
              <h3 className="fl-qz-h" id={`${uid}-result`} tabIndex={-1}>
                {passed ? "You passed" : "Not this time"}
              </h3>
              <p className="fl-qz-muted">
                {score} of {total} right · pass mark {passMark}%{timedOut ? " · time ran out" : ""}
              </p>
              <Badge tone={passed ? "success" : "danger"} led>
                {passed ? "Passed" : "Not passed"}
              </Badge>
            </Progress>
          </div>
          <div className="fl-qz-review">
            <div className="fl-qz-review-top">
              <h4>Review answers</h4>
              <button type="button" className="fl-qz-link" onClick={() => setOpen((o) => (o.length === total ? [] : questions.map((x) => x.id)))}>
                {open.length === total ? "Close all" : "Open all"}
              </button>
            </div>
            <ol className="fl-qz-rlist">
              {questions.map((x, i) => {
                const ok = isRight(x, answers[x.id]);
                const isOpen = open.includes(x.id);
                const opts = x.type === "truefalse" ? TF : x.options ?? [];
                const label = (ids: string[] | undefined) => (x.type === "text" ? ids?.[0]?.trim() || "" : opts.filter((o) => ids?.includes(o.id)).map((o) => o.label).join(", "));
                const yours = label(answers[x.id]);
                return (
                  <li key={x.id} className={["fl-qz-ritem", ok ? "is-right" : "is-wrong", isOpen ? "is-open" : ""].filter(Boolean).join(" ")}>
                    <button type="button" className="fl-qz-rbtn" aria-expanded={isOpen} aria-controls={`${uid}-r${i}`} onClick={() => setOpen((o) => (isOpen ? o.filter((y) => y !== x.id) : [...o, x.id]))}>
                      <span className="fl-qz-mark" aria-hidden="true">
                        <Icon name={ok ? "check" : "close"} />
                      </span>
                      <span className="fl-qz-rq">
                        <span className="fl-sr">{ok ? "Right: " : "Wrong: "}</span>
                        {i + 1}. {x.prompt}
                      </span>
                      <Icon name="chevron-down" />
                    </button>
                    <div className="fl-qz-fold" id={`${uid}-r${i}`} inert={!isOpen}>
                      <dl className="fl-qz-rbody">
                        <div>
                          <dt>Your answer</dt>
                          <dd>{yours || <em>Not answered</em>}</dd>
                        </div>
                        {!ok ? (
                          <div>
                            <dt>Right answer</dt>
                            <dd>{x.type === "text" ? x.answer[0] : label(x.answer)}</dd>
                          </div>
                        ) : null}
                        {x.explain ? (
                          <div>
                            <dt>Why</dt>
                            <dd>{x.explain}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="fl-qz-actions">
            <Button variant="primary" size={44} icon="refresh" onClick={begin}>
              Retake quiz
            </Button>
          </div>
        </div>
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    );
  }

  const given = answers[q!.id] ?? [];
  const flagged = flags.includes(q!.id);
  const opts = q!.type === "truefalse" ? TF : q!.options ?? [];

  return (
    <div className="fl-qz" data-fl="p.quiz">
      <div className="fl-qz-card fl-qz-run">
        <div className="fl-qz-top">
          <div>
            <p className="fl-qz-eyebrow">{title}</p>
            <p className="fl-qz-count">
              Question {at + 1} of {total}
            </p>
          </div>
          {timed ? (
            <span className={low ? "fl-qz-timer is-low" : "fl-qz-timer"} role="timer" aria-label={`Time left ${mmss(left)}`}>
              <Icon name="clock" />
              <span className="fl-qz-num" aria-hidden="true">
                {mmss(left)}
              </span>
            </span>
          ) : null}
        </div>
        <Progress value={Math.round((doneCount / total) * 100)} label={`${doneCount} of ${total} answered`} thin />

        <div className="fl-qz-map" role="toolbar" aria-label="Questions" onKeyDown={onMapKey}>
          {questions.map((x, i) => {
            const a = answered(answers[x.id]);
            const f = flags.includes(x.id);
            return (
              <button
                key={x.id}
                type="button"
                id={`${uid}-chip-${i}`}
                tabIndex={i === mapAt ? 0 : -1}
                className={["fl-qz-chip", a ? "is-answered" : "", i === at ? "is-current" : "", f ? "is-flagged" : ""].filter(Boolean).join(" ")}
                aria-current={i === at ? "step" : undefined}
                aria-label={`Question ${i + 1}, ${a ? "answered" : "not answered"}${f ? ", flagged" : ""}`}
                onFocus={() => setMapAt(i)}
                onClick={() => goTo(i, false)}
              >
                {i + 1}
                {f ? <span className="fl-qz-flagdot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        <fieldset className="fl-qz-q" key={q!.id} disabled={busy}>
          <legend id={`${uid}-q`} tabIndex={-1} className="fl-qz-prompt">
            <span className="fl-sr">
              Question {at + 1}:{" "}
            </span>
            {q!.prompt}
            {q!.type === "multi" ? <span className="fl-qz-hint"> Choose all that apply.</span> : null}
          </legend>
          {q!.type === "text" ? (
            <div className="fl-qz-text">
              <label htmlFor={`${uid}-text`} className="fl-sr">
                Your answer
              </label>
              <TextField id={`${uid}-text`} size={44} autoComplete="off" spellCheck={false} placeholder="Type your answer" value={given[0] ?? ""} aria-describedby={q!.hint ? `${uid}-hint` : undefined} onChange={(e) => setAnswer(q!.id, [e.target.value])} />
              {q!.hint ? (
                <p className="fl-qz-muted" id={`${uid}-hint`}>
                  {q!.hint}
                </p>
              ) : null}
            </div>
          ) : (
            <div className={q!.type === "truefalse" ? "fl-qz-opts fl-qz-opts--two" : "fl-qz-opts"}>
              {opts.map((o) => {
                const on = given.includes(o.id);
                return (
                  <div key={o.id} className={on ? "fl-qz-opt is-on" : "fl-qz-opt"}>
                    {q!.type === "multi" ? (
                      <Checkbox name={`${uid}-${q!.id}`} value={o.id} checked={on} label={o.label} onChange={(e) => setAnswer(q!.id, e.target.checked ? [...given, o.id] : given.filter((g) => g !== o.id))} />
                    ) : (
                      <Radio name={`${uid}-${q!.id}`} value={o.id} checked={on} label={o.label} onChange={() => setAnswer(q!.id, [o.id])} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>

        {error ? (
          <div className="fl-qz-alert" role="alert" id={`${uid}-alert`} tabIndex={-1}>
            <Icon name="alert" />
            <span>{error}</span>
            <Button variant="secondary" size={32} onClick={() => void submit()}>
              Try again
            </Button>
          </div>
        ) : null}

        <div className="fl-qz-actions">
          <Button variant="tertiary" size={44} icon="arrow-left" disabled={at === 0 || busy} onClick={() => goTo(at - 1)}>
            Previous
          </Button>
          <Button variant="tertiary" size={44} icon="bookmark" pressed={flagged} disabled={busy} onClick={toggleFlag}>
            Flag
          </Button>
          {at < total - 1 ? (
            <Button variant="primary" size={44} icon="chevron-right" iconAt="end" disabled={busy} onClick={() => goTo(at + 1)}>
              Next
            </Button>
          ) : (
            <Button variant="primary" size={44} icon="send" busy={busy} onClick={tryFinish}>
              {busy ? "Submitting…" : "Submit"}
            </Button>
          )}
        </div>
        <div className="fl-qz-foot">
          {at < total - 1 ? (
            <button type="button" className="fl-qz-link" disabled={busy} onClick={tryFinish}>
              Submit now
            </button>
          ) : (
            <span />
          )}
          <div className="fl-qz-test">
            <span className="fl-qz-badge">Test mode</span>
            <Segmented
              label="Test result"
              size="sm"
              value={test}
              onChange={(v) => setTest(v as "ok" | "fail")}
              options={[
                { value: "ok", label: "Submits" },
                { value: "fail", label: "Fails" },
              ]}
            />
          </div>
        </div>
      </div>

      {ask ? (
        <Modal
          title={unanswered.length === 1 ? "1 question is unanswered" : `${unanswered.length} questions are unanswered`}
          description={`Unanswered questions count as wrong. ${flags.length ? `${flags.length} flagged for review.` : ""}`}
          confirmLabel="Submit anyway"
          cancelLabel="Go to question"
          onConfirm={() => {
            void submit();
            return false;
          }}
          onClose={() => {
            setAsk(false);
            goTo(unanswered[0] ?? at);
          }}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: QuizRunnerProps = {
  title: "Module 2 check: Washes",
  intro: "Eight short questions on flat, graded and variegated washes. You can go back and change answers before you submit.",
  minutes: 8,
  passMark: 75,
  questions: [
    { id: "q1", type: "single", prompt: "Why tilt the board for a flat wash?", options: [{ id: "a", label: "So the paint dries faster" }, { id: "b", label: "So a bead of paint gathers along the bottom edge" }, { id: "c", label: "So the paper doesn't buckle" }, { id: "d", label: "To see the color better" }], answer: ["b"], explain: "The bead is the wet edge you pick up with the next stroke, which keeps the wash even." },
    { id: "q2", type: "truefalse", prompt: "A graded wash goes from full color to clear water.", answer: ["true"], explain: "Each stroke adds a little more water, so the color fades smoothly." },
    { id: "q3", type: "multi", prompt: "Which of these cause streaks in a wash?", options: [{ id: "a", label: "Not mixing enough paint first" }, { id: "b", label: "Letting the wet edge dry" }, { id: "c", label: "Using cotton paper" }, { id: "d", label: "Working too slowly" }], answer: ["a", "b", "d"], explain: "Streaks come from a drying edge: running out of paint or working slowly both let it dry." },
    { id: "q4", type: "text", prompt: "What is the name for the ring left when wetter paint runs into a drying wash?", hint: "One word", answer: ["bloom", "blooms", "backrun", "cauliflower"], explain: "It's called a bloom (or backrun). Let it dry, then lift it." },
    { id: "q5", type: "single", prompt: "Which brush suits a large sky wash best?", options: [{ id: "a", label: "Rigger" }, { id: "b", label: "Size 2 round" }, { id: "c", label: "3/4 inch flat" }], answer: ["c"], explain: "A wide flat holds plenty of water and lays straight, even strokes." },
    { id: "q6", type: "truefalse", prompt: "You should add the second color of a variegated wash once the first is dry.", answer: ["false"], explain: "The colors meet while both are wet, so they mix on the paper." },
    { id: "q7", type: "single", prompt: "Hot-press paper is best known for…", options: [{ id: "a", label: "A smooth surface" }, { id: "b", label: "A heavy tooth" }, { id: "c", label: "Holding the most water" }], answer: ["a"], explain: "Hot-press is pressed smooth, good for fine detail." },
    { id: "q8", type: "multi", prompt: "Which of these keep a mix clean on the palette?", options: [{ id: "a", label: "Keeping yellows apart from blues" }, { id: "b", label: "Rinsing between colors" }, { id: "c", label: "Mixing in the middle well" }, { id: "d", label: "Using one jar of water all day" }], answer: ["a", "b", "c"], explain: "Separated colors, a clean brush and a free mixing area keep mixes bright." },
  ],
};

export default function QuizRunnerPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <QuizRunner {...SAMPLE} />
      </div>
    </section>
  );
}
