/** @flowcode-library learner-progress · Learner progress dashboard (Charts and data)
 * Catalog ID: p.learner-progress (pattern)
 * Function: A learner's home dashboard (p.learner-progress): streak, minutes this week, courses finished and certificates as stat tiles; a weekly goal ring with a 7-day bar chart, Log practice and an Edit goal dialog (checked); courses with progress bars that filter (In progress, Completed, All), sort and resume; earned certificates. Loading, error and empty states included.
 * Use it as: import { LearnerProgress } from "./learner-progress"; <LearnerProgress name load={async () => ({ streak, best, goal, week: [{ day: "Mon", minutes }], courses: [{ id, title, progress, lessonsLeft, opened: "2026-10-20" }], certificates: [{ id, course, issued: "2026-09-02" }] })} onResume?={(courseId) => ...} onGoal?={async (minutes) => ...} onViewCertificate?={(id) => ...} />
 * Built from: c.progress.bar, c.progress.ring, c.badge.status, c.segmented.segmented, c.select.outlined, c.text-field.outlined, c.modal.form, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: A gray page: a greeting row with Log 15 min, four white stat tiles (streak with a bolt, minutes this week, courses done, certificates), then a wide white card with the weekly goal ring and seven bars (today in the accent color) beside a certificates card, and a courses card with a filter, a sort and rows with a progress bar and Resume.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --text-2xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: learner dashboard; student home; course platform account; training progress; language app stats; employee learning portal; tutoring progress
 * Jobs to be done: see how I'm doing this week; keep my streak going; set a goal I can keep; pick up the course I was on; find my certificates
 * Keywords: learner, student, dashboard, progress, streak, weekly goal, courses, certificates, learning, education, stats
 */
/**
 * Learner progress. The data comes from `load` (loading tiles, then the dashboard, or an error with Retry). Log
 * practice adds 15 minutes to today: the bar grows, the goal ring fills, and a first practice today extends the
 * streak. Edit goal opens a form dialog: 10 to 1,200 minutes, checked on Save, saving shows busy. The courses list
 * filters and sorts; its Resume buttons are one roving group (↑ ↓ Home End). A filter with nothing in it says so with a
 * way back to All. Every change is announced in a polite live region.
 * Make it the app's own: make `load` read the learner's data and wire onResume, onGoal and onViewCertificate.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its stats tiles and progress bars.
 */
/**
 * How to try it
 * - Set Test to "Fails" and Reload: the error shows; set "Loads" and Retry.
 * - Press Log practice: today's bar grows and the goal ring fills.
 * - Press Edit goal, clear the field and Save: the message shows. Enter 200 and Save.
 * - Filter the courses to Completed, then sort by Progress. In the list press ↓ ↑ between Resume buttons.
 *
 * Dependencies: React (useCallback, useEffect, useId, useRef, useState), Progress ("./progress-indicators"), Badge
 * ("./badges-status"), Segmented ("./segmented-control"), Select ("./dropdowns-states"), TextField
 * ("./text-fields-states"), Modal ("./modals-dialogs"), Button ("./buttons-variants") and the inline icon set
 * ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the library's own
 * fl- classes in templates/library/css/r5a-learner-progress.css.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Progress } from "./progress-indicators";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.learner-progress: stats, weekly goal, courses, certificates. ──

export type LearnerCourse = { id: string; title: string; /** 0-100 */ progress: number; lessonsLeft: number; /** ISO date last opened */ opened: string };
export type LearnerCertificate = { id: string; course: string; /** ISO date */ issued: string };
export type LearnerData = {
  streak: number;
  best: number;
  /** Weekly goal in minutes. */
  goal: number;
  /** The last seven days, oldest first; the last one is today. */
  week: { day: string; minutes: number }[];
  courses: LearnerCourse[];
  certificates: LearnerCertificate[];
};

export type LearnerProgressProps = {
  name: string;
  load: () => Promise<LearnerData>;
  onResume?: (courseId: string) => void;
  /** Saves a new weekly goal. Throw to show the error. */
  onGoal?: (minutes: number) => Promise<void>;
  onViewCertificate?: (id: string) => void;
  locale?: string;
};

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`);

export function LearnerProgress({ name, load, onResume, onGoal, onViewCertificate, locale = "en-US" }: LearnerProgressProps) {
  const uid = useId();
  const [data, setData] = useState<LearnerData | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<"active" | "done" | "all">("active");
  const [sort, setSort] = useState<"recent" | "progress" | "name">("recent");
  const [rover, setRover] = useState("");
  const [editing, setEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalError, setGoalError] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);
  const [said, setSaid] = useState("");
  const fmtDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });

  const retried = useRef(false);
  const fetchData = useCallback(async () => {
    setData(null);
    setFailed(false);
    setSaid("Loading your progress…");
    try {
      const d = await load();
      setData(d);
      setSaid("Progress loaded.");
    } catch {
      setFailed(true);
      setSaid("Couldn't load your progress.");
    }
  }, [load]);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (failed) {
    return (
      <div className="fl-lrn" data-fl="p.learner-progress">
        <div className="fl-lrn-card fl-lrn-state" role="alert">
          <span className="fl-lrn-state-icon is-error" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <p className="fl-lrn-state-title">Couldn't load your progress</p>
          <p className="fl-lrn-muted">Check your connection and try again.</p>
          <Button variant="secondary" size={40} icon="refresh" onClick={() => {
              retried.current = true;
              void fetchData();
            }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fl-lrn" data-fl="p.learner-progress" aria-busy="true">
        <div className="fl-lrn-stats" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="fl-lrn-card fl-lrn-skel">
              <span />
              <span />
            </div>
          ))}
        </div>
        <div className="fl-lrn-card fl-lrn-skel fl-lrn-skel--tall" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    );
  }

  const weekTotal = data.week.reduce((n, d) => n + d.minutes, 0);
  const goalPct = Math.min(100, Math.round((weekTotal / Math.max(1, data.goal)) * 100));
  const maxDay = Math.max(30, ...data.week.map((d) => d.minutes));
  const doneCourses = data.courses.filter((c) => c.progress >= 100);
  const shown = data.courses
    .filter((c) => (filter === "all" ? true : filter === "done" ? c.progress >= 100 : c.progress < 100))
    .sort((a, b) => (sort === "progress" ? b.progress - a.progress : sort === "name" ? a.title.localeCompare(b.title) : b.opened.localeCompare(a.opened)));
  const tabStop = shown.some((c) => c.id === rover) ? rover : shown[0]?.id;
  const today = data.week[data.week.length - 1];

  const logPractice = () => {
    const first = (today?.minutes ?? 0) === 0;
    const week = data.week.map((d, i) => (i === data.week.length - 1 ? { ...d, minutes: d.minutes + 15 } : d));
    const streak = first ? data.streak + 1 : data.streak;
    setData({ ...data, week, streak, best: Math.max(data.best, streak) });
    const total = weekTotal + 15;
    setSaid(`Logged 15 minutes. ${total} of ${data.goal} minutes this week.${first ? ` Streak: ${streak} days.` : ""}`);
  };

  const openGoal = () => {
    setGoalDraft(String(data.goal));
    setGoalError("");
    setEditing(true);
  };
  const saveGoal = async () => {
    const n = Number(goalDraft.trim());
    const bad = !goalDraft.trim() ? "Enter a goal in minutes." : !Number.isInteger(n) || n < 10 || n > 1200 ? "Use a whole number from 10 to 1,200." : "";
    if (bad) {
      setGoalError(bad);
      document.getElementById(`${uid}-goal`)?.focus();
      return;
    }
    setGoalBusy(true);
    setGoalError("");
    try {
      await (onGoal ?? (() => wait(600)))(n);
      setData((d) => (d ? { ...d, goal: n } : d));
      setEditing(false);
      setSaid(`Weekly goal set to ${n} minutes.`);
    } catch {
      setGoalError("Couldn't save the goal. Try again.");
    } finally {
      setGoalBusy(false);
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = shown.findIndex((c) => c.id === tabStop);
    const to = e.key === "ArrowDown" ? (i + 1) % shown.length : e.key === "ArrowUp" ? (i - 1 + shown.length) % shown.length : e.key === "Home" ? 0 : e.key === "End" ? shown.length - 1 : -1;
    if (to < 0 || !shown[to]) return;
    e.preventDefault();
    setRover(shown[to].id);
    document.getElementById(`${uid}-go-${shown[to].id}`)?.focus();
  };

  const stats = [
    { icon: "bolt", label: "Day streak", value: String(data.streak), note: `Best ${data.best}`, tone: "is-streak" },
    { icon: "clock", label: "This week", value: hours(weekTotal), note: `Goal ${hours(data.goal)}`, tone: "" },
    { icon: "check", label: "Courses done", value: String(doneCourses.length), note: `${data.courses.length - doneCourses.length} in progress`, tone: "" },
    { icon: "star", label: "Certificates", value: String(data.certificates.length), note: data.certificates[0] ? `Latest ${fmtDate.format(new Date(`${data.certificates[0].issued}T12:00`))}` : "None yet", tone: "" },
  ];

  return (
    <div className="fl-lrn" data-fl="p.learner-progress">
      <div className="fl-lrn-hello">
        <div>
          <p className="fl-lrn-eyebrow">Your learning</p>
          <h3 className="fl-lrn-title" tabIndex={-1} ref={(el) => {
            // After Retry the button is gone, so focus goes to the heading that replaced it.
            if (el && retried.current) {
              retried.current = false;
              el.focus();
            }
          }}>
            Welcome back, {name}
          </h3>
        </div>
        <Button variant="primary" size={44} icon="plus" onClick={logPractice}>
          Log 15 min
        </Button>
      </div>

      <ul className="fl-lrn-stats" aria-label="Summary">
        {stats.map((s) => (
          <li key={s.label} className={`fl-lrn-card fl-lrn-stat ${s.tone}`}>
            <span className="fl-lrn-stat-icon" aria-hidden="true">
              <Icon name={s.icon} />
            </span>
            <span className="fl-lrn-stat-label">{s.label}</span>
            <span className="fl-lrn-stat-value">{s.value}</span>
            <span className="fl-lrn-muted">{s.note}</span>
          </li>
        ))}
      </ul>

      <div className="fl-lrn-grid">
        <section className="fl-lrn-card fl-lrn-goal" aria-labelledby={`${uid}-goal-h`}>
          <div className="fl-lrn-head">
            <h4 id={`${uid}-goal-h`}>Weekly goal</h4>
            <Button variant="tertiary" size={32} icon="pencil" onClick={openGoal}>
              Edit goal
            </Button>
          </div>
          <div className="fl-lrn-goal-body">
            <Progress variant="ring" large value={goalPct} tone={goalPct >= 100 ? "success" : "accent"} label="Weekly goal">
              <p className="fl-lrn-goal-num">
                {weekTotal} <span>of {data.goal} min</span>
              </p>
              {goalPct >= 100 ? (
                <Badge tone="success" led>
                  Goal met
                </Badge>
              ) : (
                <p className="fl-lrn-muted">{data.goal - weekTotal} min to go</p>
              )}
            </Progress>
            <div className="fl-lrn-chart" role="img" aria-label={`Minutes per day: ${data.week.map((d) => `${d.day} ${d.minutes}`).join(", ")}`}>
              {data.week.map((d, i) => (
                <div key={i} className={i === data.week.length - 1 ? "fl-lrn-bar is-today" : "fl-lrn-bar"} style={{ ["--fl-lrn-h" as string]: d.minutes / maxDay, ["--fl-lrn-i" as string]: i }}>
                  <span className="fl-lrn-bar-val">{d.minutes || ""}</span>
                  <span className="fl-lrn-bar-track">
                    <span className="fl-lrn-bar-fill" />
                  </span>
                  <span className="fl-lrn-bar-day">{i === data.week.length - 1 ? "Today" : d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="fl-lrn-card fl-lrn-certs" aria-labelledby={`${uid}-cert-h`}>
          <div className="fl-lrn-head">
            <h4 id={`${uid}-cert-h`}>Certificates</h4>
          </div>
          {data.certificates.length ? (
            <ul className="fl-lrn-cert-list">
              {data.certificates.map((c) => (
                <li key={c.id}>
                  <span className="fl-lrn-seal" aria-hidden="true">
                    <Icon name="star" filled />
                  </span>
                  <span className="fl-lrn-cert-text">
                    <span className="fl-lrn-cert-name">{c.course}</span>
                    <span className="fl-lrn-muted">Issued {fmtDate.format(new Date(`${c.issued}T12:00`))}</span>
                  </span>
                  <Button variant="secondary" size={32} aria-label={`View certificate: ${c.course}`} onClick={() => (onViewCertificate ? onViewCertificate(c.id) : setSaid(`Opening the certificate for ${c.course}.`))}>
                    View
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-lrn-none">Finish a course to earn your first certificate.</p>
          )}
        </section>
      </div>

      <section className="fl-lrn-card fl-lrn-courses" aria-labelledby={`${uid}-courses-h`}>
        <div className="fl-lrn-head fl-lrn-head--tools">
          <h4 id={`${uid}-courses-h`}>My courses</h4>
          <div className="fl-lrn-tools">
            <Segmented
              label="Show"
              size="sm"
              value={filter}
              onChange={(v) => {
                setFilter(v as typeof filter);
                const n = data.courses.filter((c) => (v === "all" ? true : v === "done" ? c.progress >= 100 : c.progress < 100)).length;
                setSaid(`${n} ${n === 1 ? "course" : "courses"}.`);
              }}
              options={[
                { value: "active", label: "In progress" },
                { value: "done", label: "Completed" },
                { value: "all", label: "All" },
              ]}
            />
            <label className="fl-sr" htmlFor={`${uid}-sort`}>
              Sort by
            </label>
            <Select
              id={`${uid}-sort`}
              className="fl-lrn-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setSaid(`Sorted by ${e.target.selectedOptions[0]?.text.toLowerCase()}.`);
              }}
              options={[
                { value: "recent", label: "Recent" },
                { value: "progress", label: "Progress" },
                { value: "name", label: "Name" },
              ]}
            />
          </div>
        </div>
        {shown.length ? (
          <ul className="fl-lrn-course-list" onKeyDown={onListKey}>
            {shown.map((c) => {
              const finished = c.progress >= 100;
              return (
                <li key={c.id} className="fl-lrn-course">
                  <div className="fl-lrn-course-text">
                    <span className="fl-lrn-course-name">{c.title}</span>
                    <span className="fl-lrn-muted">
                      {finished ? "Completed" : `${c.lessonsLeft} ${c.lessonsLeft === 1 ? "lesson" : "lessons"} left`} · opened {fmtDate.format(new Date(`${c.opened}T12:00`))}
                    </span>
                  </div>
                  <div className="fl-lrn-course-bar">
                    <Progress value={c.progress} tone={finished ? "success" : "accent"} label={`${c.title} progress`} thin />
                    <span className="fl-lrn-pct">{c.progress}%</span>
                  </div>
                  <Button
                    id={`${uid}-go-${c.id}`}
                    variant={finished ? "tertiary" : "secondary"}
                    size={32}
                    icon={finished ? "refresh" : "play"}
                    tabIndex={c.id === tabStop ? 0 : -1}
                    aria-label={`${finished ? "Review" : "Resume"} ${c.title}`}
                    onFocus={() => setRover(c.id)}
                    onClick={() => (onResume ? onResume(c.id) : setSaid(`Opening ${c.title}.`))}
                  >
                    {finished ? "Review" : "Resume"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="fl-lrn-none">
            <p>{filter === "done" ? "No finished courses yet." : "Nothing in progress."}</p>
            <Button variant="secondary" size={32} onClick={() => setFilter("all")}>
              Show all courses
            </Button>
          </div>
        )}
      </section>

      {editing ? (
        <Modal
          variant="form"
          title="Weekly goal"
          description="Minutes of practice you aim for each week."
          confirmLabel="Save goal"
          busy={goalBusy}
          busyLabel="Saving…"
          onConfirm={() => {
            void saveGoal();
            return false;
          }}
          onClose={() => setEditing(false)}
        >
          <div className="fl-lrn-field">
            <label htmlFor={`${uid}-goal`}>Minutes per week</label>
            <TextField
              id={`${uid}-goal`}
              data-autofocus=""
              size={44}
              inputMode="numeric"
              value={goalDraft}
              invalid={Boolean(goalError)}
              aria-describedby={goalError ? `${uid}-goal-err` : `${uid}-goal-help`}
              onChange={(e) => {
                setGoalDraft(e.target.value.replace(/[^\d]/g, ""));
                if (goalError) setGoalError("");
              }}
            />
            {goalError ? (
              <p className="fl-lrn-err" id={`${uid}-goal-err`} role="alert">
                <Icon name="alert" />
                {goalError}
              </p>
            ) : (
              <p className="fl-lrn-muted" id={`${uid}-goal-help`}>
                From 10 to 1,200. 150 is about 20 minutes a day.
              </p>
            )}
          </div>
        </Modal>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: { name: string; data: LearnerData } = {
  name: "Priya",
  data: {
    streak: 6,
    best: 14,
    goal: 150,
    week: [
      { day: "Wed", minutes: 20 },
      { day: "Thu", minutes: 35 },
      { day: "Fri", minutes: 0 },
      { day: "Sat", minutes: 45 },
      { day: "Sun", minutes: 15 },
      { day: "Mon", minutes: 25 },
      { day: "Tue", minutes: 0 },
    ],
    courses: [
      { id: "wc", title: "Watercolor Foundations", progress: 38, lessonsLeft: 5, opened: "2026-10-20" },
      { id: "es", title: "Spanish for Travel, Level 1", progress: 72, lessonsLeft: 4, opened: "2026-10-19" },
      { id: "ph", title: "Phone Photography Basics", progress: 100, lessonsLeft: 0, opened: "2026-09-02" },
      { id: "py", title: "Python for Spreadsheets", progress: 12, lessonsLeft: 18, opened: "2026-10-11" },
      { id: "sp", title: "Public Speaking in 10 Days", progress: 100, lessonsLeft: 0, opened: "2026-07-28" },
    ],
    certificates: [
      { id: "cert-ph", course: "Phone Photography Basics", issued: "2026-09-02" },
      { id: "cert-sp", course: "Public Speaking in 10 Days", issued: "2026-07-28" },
    ],
  },
};

export default function LearnerProgressPreview() {
  const [test, setTest] = useState<"ok" | "fail">("ok");
  const [run, setRun] = useState(0);
  const testRef = useRef(test);
  testRef.current = test;
  const load = useCallback(async () => {
    await wait(700);
    if (testRef.current === "fail") throw new Error("offline");
    return SAMPLE.data;
  }, []);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Learner progress">
      <div className="fl-wrap fl-lrn-preview">
        <div className="fl-lrn-test">
          <span className="fl-lrn-badge">Test mode</span>
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
        <LearnerProgress key={run} name={SAMPLE.name} load={load} />
      </div>
    </section>
  );
}
