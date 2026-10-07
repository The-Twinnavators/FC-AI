/**
 * The About page's "What you get" pictures: miniature FlowCode UI that plays a short demo when you hover (or focus) its
 * cell, then settles on its finished state. At rest, and with reduced motion, each shows the finished state.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Phase while the demo plays (0..last), or undefined at rest (= the finished state). */
function useHoverDemo(last: number, tick = 700) {
  const [phase, setPhase] = useState<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = undefined;
  };
  useEffect(() => stop, []);
  const start = () => {
    if (reduce || timer.current) return;
    setPhase(0);
    timer.current = setInterval(() => {
      setPhase((p) => {
        if (p === undefined || p >= last) {
          stop();
          return undefined;
        }
        return p + 1;
      });
    }, tick);
  };
  const end = () => {
    stop();
    setPhase(undefined);
  };
  return { phase, handlers: { onMouseEnter: start, onMouseLeave: end, onFocus: start, onBlur: end } };
}

const at = (p: number | undefined, k: number) => p === undefined || p >= k;

function Chip({ tone, children }: { tone: "ok" | "warn" | "run" | "off"; children: ReactNode }) {
  return (
    <span className={`abf-chip abf-chip--${tone} demo-swap`} key={String(children)}>
      {children}
    </span>
  );
}

function Overview({ p }: { p?: number }) {
  const s1 = at(p, 1) ? "checked" : "working";
  const s2 = at(p, 2) ? "checked" : at(p, 1) ? "working" : "waiting";
  const done = at(p, 3);
  return (
    <div className="abf abf--overview">
      <div className="abf__row">
        {done ? <Chip tone="warn">Ready, not fully checked</Chip> : <Chip tone="run">{at(p, 2) ? "Running final checks" : "Building"}</Chip>}
        <span className="abf__meta">12:48</span>
      </div>
      <p className="abf__title">Two small fixes to the No BIO &amp; GMO app</p>
      <div className="abf__label">Where it stands</div>
      <p className="abf__text demo-swap" key={done ? "d" : "n"}>
        {done ? "A check couldn't run, so part of the work isn't verified." : "Building step by step; each step is checked before the next."}
      </p>
      <div className="abf__label">Plan and progress</div>
      <ul className="abf__steps">
        {(
          [
            ["Update backdrop colour tokens", s1],
            ["Give Pacific Foods its own photo", s2],
          ] as const
        ).map(([t, s]) => (
          <li key={t}>
            <span className={`abf__dot ${s === "checked" ? "abf__dot--ok" : s === "working" ? "abf__dot--run" : ""}`} /> {t}
            <Chip tone={s === "checked" ? "ok" : s === "working" ? "run" : "off"}>{s === "checked" ? "Checked" : s === "working" ? "Working" : "Waiting"}</Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Approval({ p }: { p?: number }) {
  // At rest the request is waiting for your OK; the demo approves it.
  const approved = p !== undefined && p >= 3;
  const cursorIn = p !== undefined && p >= 1 && p < 4;
  const pressing = p === 2 || p === 3;
  return (
    <div className={`abf abf--approval${p !== undefined && !approved ? " is-waiting" : ""}`} style={{ position: "relative" }}>
      <div className="abf__row">
        {approved ? <Chip tone="ok">Approved</Chip> : <Chip tone="run">Needs your OK</Chip>}
        <span className="abf__meta">Medium risk</span>
      </div>
      <p className="abf__text">Install packages for the date picker</p>
      <code className="abf__code">npm install date-fns</code>
      <div className="abf__buttons">
        <span className={`abf__btn abf__btn--primary${pressing ? " is-pressed" : ""}${approved && p !== undefined ? " is-ok" : ""}`}>{approved && p !== undefined ? "Approved once" : "Approve once"}</span>
        {approved && p !== undefined ? null : <span className="abf__btn">Deny</span>}
      </div>
      <span className={`demo-cursor${cursorIn ? " is-in" : ""}${pressing ? " is-pressing" : ""}`} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M5 3l14 8-6.5 1.5L10 19z" fill="var(--text-0)" stroke="var(--bg-1)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

const CHECKS: Array<[string, "ok" | "warn"]> = [
  ["Automatic tests", "ok"],
  ["App packaging", "ok"],
  ["Accessibility", "ok"],
  ["Design check", "ok"],
  ["Design review", "warn"],
];

function Checks({ p }: { p?: number }) {
  const shown = p === undefined ? CHECKS.length : Math.min(CHECKS.length, p);
  return (
    <div className="abf abf--checks">
      <p className="abf__text abf__text--strong demo-swap" key={shown === CHECKS.length ? "d" : "n"}>
        {shown === CHECKS.length ? "12 of 13 checks passed, 1 couldn't run." : `Checking… ${shown} of ${CHECKS.length}`}
      </p>
      <ul className="abf__checks">
        {CHECKS.map(([n, t], i) => (
          <li key={n} className={i < shown ? "is-in" : "is-pending"}>
            <span>{n}</span>
            <span className={`abf__state ${i < shown ? `abf__state--${t}` : ""}`}>{i < shown ? (t === "ok" ? "Passed" : "Couldn't run") : "…"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Review({ p }: { p?: number }) {
  return (
    <div className="abf abf--review">
      <div className="abf__row">
        <strong className="abf__h">Run review</strong>
        {at(p, 3) ? <Chip tone="warn">Verification incomplete</Chip> : <Chip tone="run">Reviewing…</Chip>}
      </div>
      <div className={`demo-reveal${at(p, 1) ? " is-in" : ""}`}>
        <div className="abf__label">Needs attention</div>
        <p className="abf__text">The visual review couldn&apos;t run (the cloud model ran out of credit), so that part isn&apos;t verified.</p>
      </div>
      <div className={`demo-reveal${at(p, 2) ? " is-in" : ""}`}>
        <div className="abf__label">What worked</div>
        <p className="abf__text">2 of 2 steps passed their checks.</p>
      </div>
    </div>
  );
}

const SCREENS: Array<[string, string, "ok" | "warn"]> = [
  ["Find brands", "Designed", "ok"],
  ["Brand list", "Designed", "ok"],
  ["Brand details", "Broad pass only", "warn"],
];

function Screens({ p }: { p?: number }) {
  const shown = p === undefined ? SCREENS.length : Math.min(SCREENS.length, p);
  return (
    <div className="abf abf--screens">
      <p className={`abf__note demo-reveal${at(p, 4) ? " is-in" : ""}`}>“Find brands” and “Brand list” may overlap.</p>
      <ul className="abf__checks">
        {SCREENS.map(([n, s, t], i) => (
          <li key={n} className={i < shown ? "is-in" : "is-pending"}>
            <span>{n}</span>
            {i < shown ? <Chip tone={t}>{s}</Chip> : <span className="abf__state">…</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STAGES = ["Suggested", "Approved", "Being tested", "Confirmed"];

function Improve({ p }: { p?: number }) {
  // At rest it's being tested; the demo walks it through to confirmed.
  const now = p === undefined ? 2 : Math.min(3, p);
  return (
    <div className="abf abf--improve">
      <p className="abf__text abf__text--strong">Run the visual review on a local model when the cloud one can&apos;t</p>
      <ol className="abf__lifecycle">
        {STAGES.map((s, i) => (
          <li key={s} className={i < now || (i === 3 && now === 3) ? "is-done" : i === now ? "is-now" : ""}>
            <span className="abf__dot" />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

const DEMOS = {
  overview: { last: 3, render: (p?: number) => <Overview p={p} /> },
  approval: { last: 4, render: (p?: number) => <Approval p={p} /> },
  checks: { last: 5, render: (p?: number) => <Checks p={p} /> },
  review: { last: 3, render: (p?: number) => <Review p={p} /> },
  screens: { last: 4, render: (p?: number) => <Screens p={p} /> },
  improve: { last: 3, render: (p?: number) => <Improve p={p} /> },
} as const;

export type DemoKind = keyof typeof DEMOS;

/** A "What you get" cell: hovering or focusing it plays that fragment's short demo. */
export function DemoCell({ kind, children }: { kind: DemoKind; children: ReactNode }) {
  const d = DEMOS[kind];
  const { phase, handlers } = useHoverDemo(d.last);
  return (
    <li className={`ab2__cell${phase !== undefined ? " is-playing" : ""}`} tabIndex={0} {...handlers}>
      {children}
      <div className="ab2__canvas" aria-hidden="true">
        {d.render(phase)}
      </div>
    </li>
  );
}
