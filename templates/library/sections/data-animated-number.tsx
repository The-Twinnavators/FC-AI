/**
 * Data: animated numbers. A row of three headline figures that count up with an ease-out curve when they scroll into
 * view, with a refresh button that loads the next set and counts again. Use at the top of an overview or a report.
 * Make it the app's own: replace SAMPLE with the app's real measures and periods; keep each prefix and suffix right.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useEffect, useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Studio overview",
  title: "This month at a glance",
  lede: "Bookings, takings and returning clients, counted from the diary.",
  refresh: "Refresh numbers",
  refreshing: "Refreshing…",
  updated: "Numbers updated for",
  periods: [
    {
      name: "October",
      stats: [
        { label: "Classes booked", value: 584, prefix: "", suffix: "", change: 6.1, note: "vs September" },
        { label: "Takings", value: 26910, prefix: "$", suffix: "", change: 9.8, note: "vs September" },
        { label: "Clients who came back", value: 68, prefix: "", suffix: "%", change: -2.4, note: "vs September" },
      ],
    },
    {
      name: "September",
      stats: [
        { label: "Classes booked", value: 550, prefix: "", suffix: "", change: 3.4, note: "vs August" },
        { label: "Takings", value: 24510, prefix: "$", suffix: "", change: 4.2, note: "vs August" },
        { label: "Clients who came back", value: 70, prefix: "", suffix: "%", change: 1.5, note: "vs August" },
      ],
    },
    {
      name: "August",
      stats: [
        { label: "Classes booked", value: 532, prefix: "", suffix: "", change: -5.1, note: "vs July" },
        { label: "Takings", value: 23520, prefix: "$", suffix: "", change: -3.7, note: "vs July" },
        { label: "Clients who came back", value: 69, prefix: "", suffix: "%", change: 0.8, note: "vs July" },
      ],
    },
  ],
};

const DURATION = 900;

function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

const format = (n: number, prefix: string, suffix: string) => `${prefix}${Math.round(n).toLocaleString("en-US")}${suffix}`;

/** Counts from the last shown value to `value` with an ease-out curve. Screen readers only ever hear the final value. */
function CountUp({ value, prefix, suffix, active, reduced }: { value: number; prefix: string; suffix: string; active: boolean; reduced: boolean }) {
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      const now = a + (value - a) * eased;
      from.current = now;
      setShown(now);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active, reduced]);
  return (
    <>
      <span className="fl-dat-num" aria-hidden="true">
        {format(shown, prefix, suffix)}
      </span>
      <span className="fl-sr">{format(value, prefix, suffix)}</span>
    </>
  );
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {up ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={spinning ? "fl-dat-spin" : undefined} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
    </svg>
  );
}

export default function DataAnimatedNumber() {
  const d = SAMPLE;
  const reduced = useReducedMotion();
  const host = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const timer = useRef<number | undefined>(undefined);

  // Start counting the first time the row is on screen.
  useEffect(() => {
    const el = host.current;
    if (!el || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const period = d.periods[index];

  const refresh = () => {
    if (loading) return;
    setLoading(true);
    setStatus(d.refreshing);
    // A short pause stands in for loading fresh figures; nothing is fetched.
    timer.current = window.setTimeout(() => {
      const next = (index + 1) % d.periods.length;
      setIndex(next);
      setLoading(false);
      setStatus(`${d.updated} ${d.periods[next].name}.`);
    }, 500);
  };

  return (
    <section ref={host} className="fl-section" aria-labelledby="data-animated-number-title">
      <div className="fl-wrap">
        <div className="fl-dat-bar">
          <div className="fl-head">
            <p className="fl-eyebrow">{d.eyebrow}</p>
            <h2 id="data-animated-number-title" className="fl-title">
              {d.title}
            </h2>
            <p className="fl-lede">
              {d.lede} <span className="fl-meta">Showing {period.name}.</span>
            </p>
          </div>
          <button type="button" className="fl-btn fl-btn--secondary" onClick={refresh} disabled={loading}>
            <RefreshIcon spinning={loading} />
            {loading ? d.refreshing : d.refresh}
          </button>
        </div>

        <dl className="fl-dat-stats" aria-busy={loading}>
          {period.stats.map((s) => {
            const up = s.change >= 0;
            return (
              <div key={s.label} className="fl-card fl-dat-stat">
                <dt>{s.label}</dt>
                <dd>
                  <CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} active={inView} reduced={reduced} />
                </dd>
                <dd className="fl-meta">
                  <span className={`fl-dat-change ${up ? "fl-dat-change--up" : "fl-dat-change--down"}`}>
                    <Arrow up={up} />
                    <span className="fl-sr">{up ? "Up" : "Down"}</span>
                    {Math.abs(s.change).toFixed(1)}%
                  </span>{" "}
                  {s.note}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="fl-dat-status" role="status" aria-live="polite" style={{ marginTop: "var(--space-4)" }}>
          {status}
        </p>
      </div>
    </section>
  );
}
