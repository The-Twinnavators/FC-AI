/** @flowcode-library survey-builder · Survey builder (Forms)
 * Catalog ID: p.survey-builder (pattern)
 * Function: Survey builder (p.survey-builder): build a survey from six question types (short text, paragraph, one choice, several choices, a 1 to 5 rating, yes or no) with prompts, required switches and options (Enter adds the next); move questions with buttons or Alt+arrow keys (they glide, focus stays), duplicate, delete after a confirm; Save checks the title, prompts and options with the first problem focused, then a working state and the saved time; Preview is the real form, checks required answers and shows what was sent.
 * Use it as: import { SurveyBuilder } from "./survey-builder"; <SurveyBuilder title lede? survey?={{ title, questions: [{ id, type: "short"|"long"|"single"|"multi"|"rating"|"yesno", prompt, required, options: [] }] }} onSave?={async (survey) => void} onRespond?={async (answers) => void} now?={() => new Date()} labels?={{ build, preview, add, save, ... }} />
 * Built from: c.tabs.underline, c.text-field.outlined, c.select.outlined, c.switch, c.checkbox, c.radio, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.danger
 * Look: A white card with the title, a line of help and Build / Preview tabs under one sliding bar; in Build, the survey title, numbered question cards (a number tile, the type menu, Up, Down, Duplicate and Delete, the prompt, option rows with a round or square marker and a remove button, Add option, the question kind and a Required switch), a dashed row of Add question buttons, and Save survey with the saved time; Preview shows the working form on a sunken panel with rating and Yes / No pills.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: survey builder; form builder; quiz builder; feedback form; customer survey; onboarding questionnaire; event registration questions
 * Jobs to be done: put together a short survey without a separate tool; choose the right kind of question for each thing I ask; reorder questions; see the survey the way people will fill it in; make sure required questions get answered
 * Keywords: survey, form builder, quiz, questionnaire, questions, multiple choice, rating, feedback, preview, reorder
 */
/**
 * Survey builder: a small form builder that stays honest about what it makes, because Preview renders the very
 * questions being edited as a working form. The tabs follow the APG tabs pattern (arrow keys, Home, End); a
 * question moves with its Up and Down buttons or Alt+ArrowUp/Down from anywhere inside it, keeping focus where it
 * was, and the cards glide to their new places (FLIP). Make it the app's own by sending onSave to your store and
 * onRespond to wherever answers go.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its field, radio, checkbox, select and tabs components,
 * and TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its form elements page.
 */
/**
 * How to try it
 * - Clear the survey title and press Save survey: the title says why and takes focus. Fill it back in.
 * - Add a One choice question: two empty options appear. Save: the prompt asks for words first; then the options.
 *   Type an option and press Enter to add the next one.
 * - Move a question with Up or Down, or Alt+ArrowUp/Down while focus is inside it: it glides and focus stays.
 * - Delete a question (confirmed first). Save: it works, then shows the saved time.
 * - Open Preview (or press ArrowRight on the Build tab): submit with nothing answered, the first required question
 *   says so and takes focus. Answer and submit to see what was sent, then Answer again.
 *
 * Dependencies: React (useId, useLayoutEffect, useRef, useState), the library's TextField, Select, Switch, Checkbox,
 * Radio, Button and Modal ("./text-fields-states", "./dropdowns-states", "./switches-states", "./checkboxes-radios",
 * "./buttons-variants", "./modals-dialogs") and its inline icon set ("./icons"). Nothing else: no package and nothing
 * fetched. The styles are the library's own fl- classes in templates/library/css/r4d-survey-builder.css.
 */
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── p.survey-builder: build questions, reorder them and preview the working form. ──

export type QuestionType = "short" | "long" | "single" | "multi" | "rating" | "yesno";
export type SurveyQuestion = { id: string; type: QuestionType; prompt: string; required: boolean; options: string[] };
export type Survey = { title: string; questions: SurveyQuestion[] };
export type SurveyAnswers = Record<string, string | string[]>;

export const QUESTION_TYPES: { value: QuestionType; label: string; icon: string }[] = [
  { value: "short", label: "Short text", icon: "pencil" },
  { value: "long", label: "Paragraph", icon: "menu" },
  { value: "single", label: "One choice", icon: "dot" },
  { value: "multi", label: "Several choices", icon: "check" },
  { value: "rating", label: "Rating", icon: "star" },
  { value: "yesno", label: "Yes or no", icon: "thumbs-up" },
];
const hasOptions = (t: QuestionType) => t === "single" || t === "multi";

export type SurveyBuilderLabels = Partial<{
  build: string;
  preview: string;
  tabs: string;
  surveyTitle: string;
  question: string;
  type: string;
  prompt: string;
  promptPlaceholder: string;
  option: string;
  addOption: string;
  removeOption: string;
  required: string;
  up: string;
  down: string;
  duplicate: string;
  remove: string;
  removeTitle: string;
  removeText: string;
  add: string;
  empty: string;
  emptyText: string;
  save: string;
  saving: string;
  savedAt: string;
  failed: string;
  needTitle: string;
  needPrompt: string;
  needOptions: string;
  sameOptions: string;
  problems: string;
  moved: string;
  submit: string;
  sending: string;
  answerRequired: string;
  thanks: string;
  again: string;
  noAnswer: string;
  yes: string;
  no: string;
  low: string;
  high: string;
}>;

export type SurveyBuilderProps = {
  title: string;
  lede?: string;
  survey?: Survey;
  /** Stores the survey. Throw to show an error. */
  onSave?: (survey: Survey) => Promise<void>;
  /** Gets a preview response keyed by question id. */
  onRespond?: (answers: SurveyAnswers) => Promise<void>;
  /** The clock for "Saved at"; the real time when left out. */
  now?: () => Date;
  labels?: SurveyBuilderLabels;
};

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
/** FLIP: cards marked data-flip glide from where they were whenever `key` changes; new ones rise in. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) {
      last.current = new Map();
      return;
    }
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(":scope > [data-flip]"));
    const now = new Map(nodes.map((n) => [n.dataset.flip!, n.getBoundingClientRect().top]));
    if (!motionOff() && last.current.size) {
      const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
      for (const n of nodes) {
        const was = last.current.get(n.dataset.flip!);
        const is = now.get(n.dataset.flip!)!;
        if (was === undefined) n.animate([{ opacity: 0, translate: "0 var(--enter-distance, 8px)" }, { opacity: 1, translate: "0 0" }], { duration: tokenMs("--duration-base", 200), easing: ease });
        else if (was !== is) n.animate([{ translate: `0 ${was - is}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: ease });
      }
    }
    last.current = now;
  }, [key, box]);
}

const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));
let seq = 0;
const newId = () => `q${Date.now().toString(36)}${(seq++).toString(36)}`;

type Errors = Record<string, string>;

export function SurveyBuilder({ title, lede, survey: initial = { title: "", questions: [] }, onSave, onRespond, now = () => new Date(), labels = {} }: SurveyBuilderProps) {
  const l = {
    build: "Build",
    preview: "Preview",
    tabs: "Survey views",
    surveyTitle: "Survey title",
    question: "Question {n}",
    type: "Question type",
    prompt: "Question",
    promptPlaceholder: "What do you want to ask?",
    option: "Option {n}",
    addOption: "Add option",
    removeOption: "Remove option {n}",
    required: "Required",
    up: "Move up",
    down: "Move down",
    duplicate: "Duplicate",
    remove: "Delete",
    removeTitle: "Delete question {n}?",
    removeText: "“{prompt}” and its options are removed from the survey.",
    add: "Add a question",
    empty: "No questions yet",
    emptyText: "Pick a kind of question below to start.",
    save: "Save survey",
    saving: "Saving…",
    savedAt: "Saved at {time}",
    failed: "Couldn't save the survey. Try again.",
    needTitle: "Give the survey a title.",
    needPrompt: "Write the question.",
    needOptions: "Fill in every option; keep at least two.",
    sameOptions: "Two options say the same thing.",
    problems: "{n} things to fix before saving.",
    moved: "Question moved to position {n}.",
    submit: "Submit",
    sending: "Sending…",
    answerRequired: "This one needs an answer.",
    thanks: "Thanks! Here's what was sent.",
    again: "Answer again",
    noAnswer: "No answer",
    yes: "Yes",
    no: "No",
    low: "Not likely",
    high: "Very likely",
    ...labels,
  };
  const id = useId();
  const [survey, setSurvey] = useState<Survey>(initial);
  const [tab, setTab] = useState<"build" | "preview">("build");
  const [errors, setErrors] = useState<Errors>({});
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [said, setSaid] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  // Preview state.
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [answerErrors, setAnswerErrors] = useState<Errors>({});
  const [sent, setSent] = useState<SurveyAnswers | null>(null);
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const qs = survey.questions;
  useFlip(list, `${tab}|${qs.map((q) => q.id).join(",")}`);

  const touch = () => setSavedAt("");
  const clearErr = (...keys: string[]) => {
    if (keys.some((k) => errors[k])) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))));
  };
  const setQ = (i: number, patch: Partial<SurveyQuestion>) => {
    setSurvey((s) => ({ ...s, questions: s.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
    touch();
  };
  const focusLater = (elId: string) => window.setTimeout(() => document.getElementById(elId)?.focus(), 0);

  const addQuestion = (type: QuestionType) => {
    const q: SurveyQuestion = { id: newId(), type, prompt: "", required: false, options: hasOptions(type) ? ["", ""] : [] };
    setSurvey((s) => ({ ...s, questions: [...s.questions, q] }));
    touch();
    focusLater(`${id}-${q.id}-prompt`);
  };
  const changeType = (i: number, type: QuestionType) => {
    const q = qs[i]!;
    setQ(i, { type, options: hasOptions(type) ? (q.options.length >= 2 ? q.options : [...q.options, "", ""].slice(0, Math.max(2, q.options.length))) : q.options });
    clearErr(`${q.id}-options`);
  };
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= qs.length) return;
    const active = document.activeElement as HTMLElement | null;
    setSurvey((s) => {
      const next = [...s.questions];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...s, questions: next };
    });
    touch();
    setSaid(l.moved.replace("{n}", String(j + 1)));
    // Focus stays on the same control; if that control was a move button that is now disabled, use the other one.
    window.setTimeout(() => {
      if (active && document.contains(active) && !(active as HTMLButtonElement).disabled) active.focus();
      else document.getElementById(`${id}-${qs[i]!.id}-${by < 0 ? "down" : "up"}`)?.focus();
    }, 0);
  };
  const duplicate = (i: number) => {
    const q = qs[i]!;
    const copy = { ...q, id: newId(), options: [...q.options] };
    setSurvey((s) => ({ ...s, questions: [...s.questions.slice(0, i + 1), copy, ...s.questions.slice(i + 1)] }));
    touch();
    focusLater(`${id}-${copy.id}-prompt`);
  };
  const remove = () => {
    if (confirmDelete === null) return;
    const i = confirmDelete;
    const gone = qs[i]!;
    setSurvey((s) => ({ ...s, questions: s.questions.filter((_, j) => j !== i) }));
    touch();
    setSaid(`${l.question.replace("{n}", String(i + 1))}: ${l.remove.toLowerCase()}d.`);
    const nextFocus = qs[i + 1] ?? qs[i - 1];
    focusLater(nextFocus && nextFocus.id !== gone.id ? `${id}-${nextFocus.id}-prompt` : `${id}-add-short`);
  };
  const setOption = (i: number, k: number, v: string) => {
    const q = qs[i]!;
    setQ(i, { options: q.options.map((o, m) => (m === k ? v : o)) });
    clearErr(`${q.id}-options`);
  };
  const addOption = (i: number, at?: number) => {
    const q = qs[i]!;
    const pos = at ?? q.options.length;
    setQ(i, { options: [...q.options.slice(0, pos), "", ...q.options.slice(pos)] });
    focusLater(`${id}-${q.id}-opt-${pos}`);
  };
  const removeOption = (i: number, k: number) => {
    const q = qs[i]!;
    setQ(i, { options: q.options.filter((_, m) => m !== k) });
    focusLater(`${id}-${q.id}-opt-${Math.max(0, k - 1)}`);
  };

  const onCardKey = (e: KeyboardEvent<HTMLLIElement>, i: number) => {
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      move(i, e.key === "ArrowUp" ? -1 : 1);
    }
  };

  const save = async () => {
    if (busy) return;
    const err: Errors = {};
    const order: string[] = [];
    if (!survey.title.trim()) {
      err.title = l.needTitle;
      order.push(`${id}-title-field`);
    }
    for (const q of qs) {
      if (!q.prompt.trim()) {
        err[`${q.id}-prompt`] = l.needPrompt;
        order.push(`${id}-${q.id}-prompt`);
      }
      if (hasOptions(q.type)) {
        const opts = q.options.map((o) => o.trim());
        const blankAt = opts.findIndex((o) => !o);
        if (opts.length < 2 || blankAt >= 0) {
          err[`${q.id}-options`] = l.needOptions;
          order.push(`${id}-${q.id}-opt-${Math.max(0, blankAt)}`);
        } else if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) {
          err[`${q.id}-options`] = l.sameOptions;
          order.push(`${id}-${q.id}-opt-0`);
        }
      }
    }
    setErrors(err);
    if (order.length) {
      setShake((n) => n + 1);
      setSaid(l.problems.replace("{n}", String(order.length)));
      focusLater(order[0]!);
      return;
    }
    setBusy(true);
    try {
      const clean: Survey = { title: survey.title.trim(), questions: qs.map((q) => ({ ...q, prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()) })) };
      await (onSave ? onSave(clean) : wait(800));
      setSurvey(clean);
      const t = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now());
      setSavedAt(l.savedAt.replace("{time}", t));
      setSaid(l.savedAt.replace("{time}", t));
    } catch {
      setErrors({ form: l.failed });
    } finally {
      setBusy(false);
    }
  };

  // Tabs: arrow keys, Home and End move and select (automatic activation).
  const tabKeys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const order = ["build", "preview"] as const;
    const at = order.indexOf(tab);
    const next = e.key === "ArrowRight" ? order[(at + 1) % 2] : e.key === "ArrowLeft" ? order[(at + 1) % 2] : e.key === "Home" ? order[0] : e.key === "End" ? order[1] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    focusLater(`${id}-tab-${next}`);
  };

  // Preview form.
  const respond = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const err: Errors = {};
    for (const q of qs) {
      const a = answers[q.id];
      const empty = a === undefined || (Array.isArray(a) ? a.length === 0 : !String(a).trim());
      if (q.required && empty) err[q.id] = l.answerRequired;
    }
    setAnswerErrors(err);
    const firstBad = qs.find((q) => err[q.id]);
    if (firstBad) {
      setShake((n) => n + 1);
      const target = document.querySelector<HTMLElement>(`[data-answer="${firstBad.id}"] input, [data-answer="${firstBad.id}"] textarea`);
      target?.focus();
      return;
    }
    setSending(true);
    try {
      await (onRespond ? onRespond(answers) : wait(700));
      setSent(answers);
      focusLater(`${id}-thanks`);
    } finally {
      setSending(false);
    }
  };
  const answer = (qid: string, v: string | string[]) => {
    setAnswers((a) => ({ ...a, [qid]: v }));
    if (answerErrors[qid]) setAnswerErrors((e) => ({ ...e, [qid]: "" }));
  };
  const shown = (q: SurveyQuestion, a: string | string[] | undefined) => {
    if (a === undefined || (Array.isArray(a) && !a.length) || a === "") return l.noAnswer;
    if (q.type === "rating") return `${a} / 5`;
    if (q.type === "yesno") return a === "yes" ? l.yes : l.no;
    return Array.isArray(a) ? a.join(", ") : a;
  };

  const shakeAttr = shake ? (shake % 2 ? "a" : "b") : undefined;
  const msg = (key: string, elId: string) =>
    errors[key] ? (
      <p id={elId} className="fl-svb-error" role="alert">
        <Icon name="alert" />
        {errors[key]}
      </p>
    ) : null;

  return (
    <section className="fl-svb" aria-labelledby={`${id}-h`} data-fl="p.survey-builder">
      <header className="fl-svb-head">
        <div className="fl-svb-heading">
          <h2 id={`${id}-h`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <div className="fl-svb-tabs" role="tablist" aria-label={l.tabs}>
          {(["build", "preview"] as const).map((t) => (
            <button
              key={t}
              id={`${id}-tab-${t}`}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={`${id}-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={tabKeys}
            >
              <Icon name={t === "build" ? "pencil" : "eye"} />
              {l[t]}
            </button>
          ))}
          <span className="fl-svb-tabbar" data-at={tab} aria-hidden="true" />
        </div>
      </header>

      {tab === "build" ? (
        <div id={`${id}-panel-build`} role="tabpanel" aria-labelledby={`${id}-tab-build`} className="fl-svb-panel">
          <div className="fl-svb-field" data-shake={errors.title ? shakeAttr : undefined}>
            <label htmlFor={`${id}-title-field`}>{l.surveyTitle}</label>
            <TextField
              id={`${id}-title-field`}
              size={44}
              value={survey.title}
              invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? `${id}-title-err` : undefined}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setSurvey((s) => ({ ...s, title: v }));
                touch();
                clearErr("title");
              }}
            />
            {msg("title", `${id}-title-err`)}
          </div>

          {qs.length ? (
            <ol className="fl-svb-list" ref={list}>
              {qs.map((q, i) => {
                const n = i + 1;
                const pErr = errors[`${q.id}-prompt`];
                const oErr = errors[`${q.id}-options`];
                return (
                  <li key={q.id} data-flip={q.id} className="fl-svb-card" onKeyDown={(e) => onCardKey(e, i)} aria-label={l.question.replace("{n}", String(n))}>
                    <div className="fl-svb-card-top">
                      <span className="fl-svb-num" aria-hidden="true">
                        {n}
                      </span>
                      <div className="fl-svb-field fl-svb-type">
                        <label className="fl-sr" htmlFor={`${id}-${q.id}-type`}>
                          {l.type}, {l.question.replace("{n}", String(n)).toLowerCase()}
                        </label>
                        <Select id={`${id}-${q.id}-type`} value={q.type} onChange={(e) => changeType(i, e.currentTarget.value as QuestionType)} options={QUESTION_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
                      </div>
                      <div className="fl-svb-tools">
                        <Button id={`${id}-${q.id}-up`} variant="tertiary" size={32} icon="arrow-left" iconOnly className="fl-svb-up" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${l.up}, ${l.question.replace("{n}", String(n)).toLowerCase()}`}>
                          {l.up}
                        </Button>
                        <Button id={`${id}-${q.id}-down`} variant="tertiary" size={32} icon="arrow-left" iconOnly className="fl-svb-down" disabled={i === qs.length - 1} onClick={() => move(i, 1)} aria-label={`${l.down}, ${l.question.replace("{n}", String(n)).toLowerCase()}`}>
                          {l.down}
                        </Button>
                        <Button variant="tertiary" size={32} icon="duplicate" iconOnly onClick={() => duplicate(i)} aria-label={`${l.duplicate}, ${l.question.replace("{n}", String(n)).toLowerCase()}`}>
                          {l.duplicate}
                        </Button>
                        <Button variant="tertiary" size={32} icon="trash" iconOnly className="fl-svb-del" onClick={() => setConfirmDelete(i)} aria-label={`${l.remove}, ${l.question.replace("{n}", String(n)).toLowerCase()}`}>
                          {l.remove}
                        </Button>
                      </div>
                    </div>

                    <div className="fl-svb-field" data-shake={pErr ? shakeAttr : undefined}>
                      <label htmlFor={`${id}-${q.id}-prompt`}>{l.prompt}</label>
                      <TextField
                        id={`${id}-${q.id}-prompt`}
                        size={40}
                        value={q.prompt}
                        placeholder={l.promptPlaceholder}
                        invalid={Boolean(pErr)}
                        aria-describedby={pErr ? `${id}-${q.id}-prompt-err` : undefined}
                        onChange={(e) => {
                          setQ(i, { prompt: e.currentTarget.value });
                          clearErr(`${q.id}-prompt`);
                        }}
                      />
                      {msg(`${q.id}-prompt`, `${id}-${q.id}-prompt-err`)}
                    </div>

                    <div className={["fl-svb-fold", hasOptions(q.type) ? "is-open" : ""].filter(Boolean).join(" ")} inert={!hasOptions(q.type) || undefined}>
                      <div>
                        <fieldset className="fl-svb-options" data-shake={oErr ? shakeAttr : undefined} aria-describedby={oErr ? `${id}-${q.id}-opt-err` : undefined}>
                          <legend className="fl-sr">Options for {l.question.replace("{n}", String(n)).toLowerCase()}</legend>
                          {q.options.map((o, k) => (
                            <div key={k} className="fl-svb-option">
                              <span className={`fl-svb-marker fl-svb-marker--${q.type}`} aria-hidden="true" />
                              <label className="fl-sr" htmlFor={`${id}-${q.id}-opt-${k}`}>
                                {l.option.replace("{n}", String(k + 1))}
                              </label>
                              <TextField
                                id={`${id}-${q.id}-opt-${k}`}
                                size={32}
                                value={o}
                                placeholder={l.option.replace("{n}", String(k + 1))}
                                invalid={Boolean(oErr) && (!o.trim() || l.sameOptions === oErr)}
                                aria-describedby={oErr ? `${id}-${q.id}-opt-err` : undefined}
                                onChange={(e) => setOption(i, k, e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addOption(i, k + 1);
                                  } else if (e.key === "Backspace" && !o && q.options.length > 2) {
                                    e.preventDefault();
                                    removeOption(i, k);
                                  }
                                }}
                              />
                              <Button variant="tertiary" size={32} icon="close" iconOnly disabled={q.options.length <= 2} onClick={() => removeOption(i, k)} aria-label={l.removeOption.replace("{n}", String(k + 1))}>
                                {l.removeOption.replace("{n}", String(k + 1))}
                              </Button>
                            </div>
                          ))}
                          {oErr ? (
                            <p id={`${id}-${q.id}-opt-err`} className="fl-svb-error" role="alert">
                              <Icon name="alert" />
                              {oErr}
                            </p>
                          ) : null}
                          <Button variant="tertiary" size={32} icon="plus" className="fl-svb-addopt" onClick={() => addOption(i)}>
                            {l.addOption}
                          </Button>
                        </fieldset>
                      </div>
                    </div>

                    <div className="fl-svb-card-foot">
                      <span className="fl-svb-kind">
                        <Icon name={QUESTION_TYPES.find((t) => t.value === q.type)!.icon} />
                        {QUESTION_TYPES.find((t) => t.value === q.type)!.label}
                      </span>
                      <label className="fl-svb-req">
                        <span>{l.required}</span>
                        <Switch size={20} on={q.required} label={`${l.required}, ${l.question.replace("{n}", String(n)).toLowerCase()}`} onToggle={(v) => setQ(i, { required: v })} />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="fl-svb-empty">
              <Icon name="help" />
              <p className="fl-svb-empty-title">{l.empty}</p>
              <p>{l.emptyText}</p>
            </div>
          )}

          <div className="fl-svb-add" role="group" aria-label={l.add}>
            <p>{l.add}</p>
            <div>
              {QUESTION_TYPES.map((t) => (
                <Button key={t.value} id={`${id}-add-${t.value}`} variant="secondary" size={32} icon={t.icon} onClick={() => addQuestion(t.value)}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {errors.form ? (
            <p className="fl-svb-error" role="alert">
              <Icon name="alert" />
              {errors.form}
            </p>
          ) : null}
          <div className="fl-svb-foot">
            {savedAt ? (
              <span className="fl-svb-saved">
                <Icon name="check" />
                {savedAt}
              </span>
            ) : (
              <span className="fl-svb-count">{qs.length === 1 ? "1 question" : `${qs.length} questions`}</span>
            )}
            <Button size={40} busy={busy} onClick={() => void save()}>
              {busy ? l.saving : l.save}
            </Button>
          </div>
        </div>
      ) : (
        <div id={`${id}-panel-preview`} role="tabpanel" aria-labelledby={`${id}-tab-preview`} className="fl-svb-panel fl-svb-preview">
          <h3 className="fl-svb-ptitle">{survey.title.trim() || l.surveyTitle}</h3>
          {sent ? (
            <div className="fl-svb-thanks">
              <p id={`${id}-thanks`} tabIndex={-1} className="fl-svb-saved">
                <Icon name="check" />
                {l.thanks}
              </p>
              <dl>
                {qs.map((q) => (
                  <div key={q.id}>
                    <dt>{q.prompt || l.prompt}</dt>
                    <dd>{shown(q, sent[q.id])}</dd>
                  </div>
                ))}
              </dl>
              <Button
                variant="secondary"
                size={40}
                icon="refresh"
                onClick={() => {
                  setSent(null);
                  setAnswers({});
                  setAnswerErrors({});
                }}
              >
                {l.again}
              </Button>
            </div>
          ) : qs.length ? (
            <form className="fl-svb-pform" noValidate onSubmit={(e) => void respond(e)} aria-busy={sending || undefined}>
              {qs.map((q, i) => {
                const err = answerErrors[q.id];
                const errId = `${id}-${q.id}-ans-err`;
                const label = (
                  <>
                    <span className="fl-svb-pnum">{i + 1}.</span> {q.prompt || l.prompt}
                    {q.required ? (
                      <span className="fl-svb-star" aria-label={l.required}>
                        *
                      </span>
                    ) : null}
                  </>
                );
                const a = answers[q.id];
                return (
                  <div key={q.id} className="fl-svb-pq" data-answer={q.id} data-shake={err ? shakeAttr : undefined}>
                    {q.type === "short" || q.type === "long" ? (
                      <>
                        <label htmlFor={`${id}-${q.id}-ans`} className="fl-svb-plabel">
                          {label}
                        </label>
                        {q.type === "short" ? (
                          <TextField id={`${id}-${q.id}-ans`} size={40} value={String(a ?? "")} invalid={Boolean(err)} aria-required={q.required} aria-describedby={err ? errId : undefined} onChange={(e) => answer(q.id, e.currentTarget.value)} />
                        ) : (
                          <TextField multiline autoGrow rows={3} id={`${id}-${q.id}-ans`} value={String(a ?? "")} invalid={Boolean(err)} aria-required={q.required} aria-describedby={err ? errId : undefined} onChange={(e) => answer(q.id, e.currentTarget.value)} />
                        )}
                      </>
                    ) : (
                      <fieldset aria-describedby={err ? errId : undefined}>
                        <legend className="fl-svb-plabel">{label}</legend>
                        {q.type === "single" ? (
                          <div className="fl-svb-choices">
                            {q.options.map((o, k) => (
                              <Radio key={k} name={`${id}-${q.id}-ans`} label={o || l.option.replace("{n}", String(k + 1))} checked={a === o} onChange={() => answer(q.id, o)} />
                            ))}
                          </div>
                        ) : q.type === "multi" ? (
                          <div className="fl-svb-choices">
                            {q.options.map((o, k) => {
                              const list = Array.isArray(a) ? a : [];
                              return <Checkbox key={k} label={o || l.option.replace("{n}", String(k + 1))} checked={list.includes(o)} onChange={(e) => answer(q.id, e.currentTarget.checked ? [...list, o] : list.filter((x) => x !== o))} />;
                            })}
                          </div>
                        ) : q.type === "rating" ? (
                          <div className="fl-svb-rating fl-svb-rating--scale">
                            {[1, 2, 3, 4, 5].map((v) => (
                              <label key={v} className="fl-svb-pill">
                                <input type="radio" name={`${id}-${q.id}-ans`} value={v} checked={a === String(v)} onChange={() => answer(q.id, String(v))} />
                                <span>{v}</span>
                                {v === 1 || v === 5 ? <span className="fl-sr">{v === 1 ? l.low : l.high}</span> : null}
                              </label>
                            ))}
                            <span className="fl-svb-scales" aria-hidden="true">
                              <span>1 · {l.low}</span>
                              <span>5 · {l.high}</span>
                            </span>
                          </div>
                        ) : (
                          <div className="fl-svb-rating">
                            {(["yes", "no"] as const).map((v) => (
                              <label key={v} className="fl-svb-pill fl-svb-pill--wide">
                                <input type="radio" name={`${id}-${q.id}-ans`} value={v} checked={a === v} onChange={() => answer(q.id, v)} />
                                <span>{l[v]}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </fieldset>
                    )}
                    {err ? (
                      <p id={errId} className="fl-svb-error" role="alert">
                        <Icon name="alert" />
                        {err}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <div className="fl-svb-foot">
                <span />
                <Button type="submit" size={40} busy={sending}>
                  {sending ? l.sending : l.submit}
                </Button>
              </div>
            </form>
          ) : (
            <div className="fl-svb-empty">
              <Icon name="help" />
              <p className="fl-svb-empty-title">{l.empty}</p>
              <Button variant="secondary" size={32} onClick={() => setTab("build")}>
                {l.build}
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {confirmDelete !== null && qs[confirmDelete] ? (
        <Modal
          variant="danger"
          icon="trash"
          title={l.removeTitle.replace("{n}", String(confirmDelete + 1))}
          description={l.removeText.replace("{prompt}", qs[confirmDelete]!.prompt.trim() || l.question.replace("{n}", String(confirmDelete + 1)))}
          confirmLabel={l.remove}
          onConfirm={() => remove()}
          onClose={() => setConfirmDelete(null)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Survey builder",
  lede: "Ask customers a few quick questions after their visit.",
  survey: {
    title: "How was your visit?",
    questions: [
      { id: "q1", type: "rating", prompt: "How likely are you to recommend us to a friend?", required: true, options: [] },
      { id: "q2", type: "single", prompt: "What brought you in today?", required: true, options: ["A haircut", "Coloring", "A beard trim", "Something else"] },
      { id: "q3", type: "multi", prompt: "What did you like?", required: false, options: ["Friendly staff", "Short wait", "Fair price"] },
      { id: "q4", type: "yesno", prompt: "Would you like a reminder for your next visit?", required: false, options: [] },
      { id: "q5", type: "long", prompt: "Anything we could do better?", required: false, options: [] },
    ],
  } as Survey,
};

export default function SurveyBuilderSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <SurveyBuilder {...SAMPLE} onSave={() => wait(800)} />
      </div>
    </section>
  );
}
