/**
 * Prompts & skills overview: the Define → Match → Run → Verify pipeline with activity sparklines, and summary cards.
 * Collapsible (remembered) so the library list keeps its room.
 */
import { useState } from "react";
import { BookOpen, ChevronDown, Cpu, GitBranch, ListChecks, Sparkles, Target, Users, Wand2 } from "lucide-react";
import { useResource } from "../api";
import { Logo } from "./ui";
import { Sparkline } from "./Sparkline";

type Win = "24h" | "7d" | "30d";
interface Stats {
  window: Win;
  stages: Array<{ id: "define" | "match" | "run" | "verify"; label: string; sub: string; total: number; series: number[] }>;
  cards: {
    prompts: { total: number; yours: number; edited: number };
    skills: { total: number; on: number; yours: number };
    applied: number;
    tasksWithSkills: number;
    verifiedRate: number;
    topSkill: { id: string; count: number } | null;
    promptRuns: number;
    versions: { total: number; recent: number };
    roles: { covered: number; total: number };
  };
}

const STAGE: Record<Stats["stages"][number]["id"], { color: string; Icon: typeof Wand2 }> = {
  // FlowCode palette: the bolt’s violet → brand blue → verified teal.
  define: { color: "#c4b5fd", Icon: BookOpen },
  match: { color: "#8b5cf6", Icon: Target },
  run: { color: "#5f7fd0", Icon: Cpu },
  verify: { color: "#2fc4b2", Icon: ListChecks },
};
const KEY = "fc.library.overview";
const nice = (id: string) => {
  const t = id.replace(/^skill\./, "").replace(/[-_.]+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * An isometric column for a share (0–1): a 3D block filled from the bottom in the card's color (lit top, mid left,
 * shaded right), with an empty glass track above it showing what's left.
 */
function IsoColumn({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(1, value));
  const cx = 28, w = 14, d = 7, base = 44, H = 34;
  const top = base - H;
  const y = base - H * v; // the top of the filled part
  const left = (lo: number, hi: number) => `${cx - w},${hi} ${cx},${hi + d} ${cx},${lo + d} ${cx - w},${lo}`;
  const right = (lo: number, hi: number) => `${cx},${hi + d} ${cx + w},${hi} ${cx + w},${lo} ${cx},${lo + d}`;
  const lid = (at: number) => `${cx - w},${at} ${cx},${at - d} ${cx + w},${at} ${cx},${at + d}`;
  const shade = (pct: number, to: string) => ({ fill: `color-mix(in srgb, ${color} ${pct}%, ${to})` });
  return (
    <svg className="lib-card__ring lib-card__iso" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      {/* The empty track: the whole column, faint. */}
      <polygon points={left(base, top)} className="iso-track iso-track--l" />
      <polygon points={right(base, top)} className="iso-track iso-track--r" />
      <polygon points={lid(top)} className="iso-track iso-track--t" />
      {v > 0 ? (
        <>
          <polygon points={left(base, y)} style={shade(88, "black")} />
          <polygon points={right(base, y)} style={shade(62, "black")} />
          <polygon points={lid(y)} style={shade(70, "white")} />
        </>
      ) : null}
    </svg>
  );
}

/** One isometric box: left, right and top faces in shades of `color`. */
function IsoBox({ x, base, h, w, d, color }: { x: number; base: number; h: number; w: number; d: number; color: string }) {
  const t = base - h;
  const f = (pct: number, to: string) => `color-mix(in srgb, ${color} ${pct}%, ${to})`;
  return (
    <>
      <polygon points={`${x - w},${t} ${x},${t + d} ${x},${base + d} ${x - w},${base}`} style={{ fill: f(88, "black") }} />
      <polygon points={`${x},${t + d} ${x + w},${t} ${x + w},${base} ${x},${base + d}`} style={{ fill: f(62, "black") }} />
      <polygon points={`${x - w},${t} ${x},${t - d} ${x + w},${t} ${x},${t + d}`} style={{ fill: f(70, "white") }} />
    </>
  );
}

/** Isometric bars for activity over the window: the series folded into 6 buckets, each bar as tall as its share of the busiest. */
function IsoBars({ series, color }: { series: number[]; color: string }) {
  const n = 6;
  const size = Math.ceil(series.length / n) || 1;
  const sums = Array.from({ length: n }, (_, i) => series.slice(i * size, (i + 1) * size).reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...sums);
  return (
    <svg className="lib-card__ring lib-card__iso" width="72" height="56" viewBox="0 0 72 56" aria-hidden="true">
      {sums.map((v, i) => (
        <IsoBox key={i} x={10 + i * 10.5} base={46 - i * 2.5} h={v ? 4 + (v / max) * 28 : 1.5} w={4.5} d={2.3} color={color} />
      ))}
    </svg>
  );
}

/** A stack of isometric slabs, one per item (up to 8). */
function IsoStack({ count, color }: { count: number; color: string }) {
  const k = Math.max(1, Math.min(8, count));
  return (
    <svg className="lib-card__ring lib-card__iso" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      {Array.from({ length: k }, (_, i) => (
        <IsoBox key={i} x={28} base={46 - i * 5.2} h={3.2} w={13} d={6.5} color={color} />
      ))}
    </svg>
  );
}

/** `embedded`: shown as its own tab, so always expanded and without the collapse toggle. */
export function LibraryOverview({ embedded = false }: { embedded?: boolean } = {}) {
  const [win, setWin] = useState<Win>("24h");
  const [openState, setOpenState] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "closed";
    } catch {
      return true;
    }
  });
  const open = embedded || openState;
  const setOpen = (o: boolean) => {
    setOpenState(o);
    try {
      localStorage.setItem(KEY, o ? "open" : "closed");
    } catch {
      /* storage unavailable */
    }
  };
  const { data } = useResource<Stats>(open ? `/library/stats?window=${win}` : null, [win, open], 30_000);
  const c = data?.cards;
  const cards = c
    ? [
        { label: "Prompts", Icon: BookOpen, value: c.prompts.total, sub: c.prompts.yours ? `${c.prompts.yours} yours` : c.prompts.edited ? `${c.prompts.edited} edited by you` : "built-in role prompts", ring: undefined, viz: { stack: c.prompts.total }, color: "#5f7fd0" },
        { label: "Skills", Icon: Sparkles, value: c.skills.total, sub: `${c.skills.on} on · ${c.skills.yours} yours`, ring: c.skills.total ? c.skills.on / c.skills.total : 0, color: "#8b5cf6", live: true },
        { label: "Skills used by agents", Icon: Target, value: c.applied, sub: `on ${c.tasksWithSkills} build task${c.tasksWithSkills === 1 ? "" : "s"}`, ring: undefined, viz: { bars: "match" as const }, color: "#5f7fd0", live: true },
        { label: "Passed FlowCode checks", Icon: ListChecks, value: `${Math.round(c.verifiedRate * 100)}%`, sub: "of tasks that used a skill", ring: c.verifiedRate, color: "#22c55e", live: true },
        { label: "Agent turns", Icon: Cpu, value: c.promptRuns, sub: "planner, coder & debugger on local models", ring: undefined, viz: { bars: "run" as const }, color: "#8b5cf6", live: true },
        { label: "Most used skill", Icon: Wand2, value: c.topSkill ? nice(c.topSkill.id) : "—", sub: c.topSkill ? `${c.topSkill.count} time${c.topSkill.count === 1 ? "" : "s"}` : "no skills used yet", ring: c.topSkill && c.applied ? c.topSkill.count / c.applied : undefined, color: "#2fc4b2", small: true },
        { label: "Versions", Icon: GitBranch, value: c.versions.total, sub: c.versions.recent ? `+${c.versions.recent} in ${win}` : "no changes in this window", ring: undefined, viz: { bars: "define" as const }, color: "#2fc4b2" },
        { label: "Agents with skills", Icon: Users, value: `${c.roles.covered} of ${c.roles.total}`, sub: "FlowCode agent roles covered", ring: c.roles.total ? c.roles.covered / c.roles.total : 0, color: "#c4b5fd" },
      ]
    : [];

  return (
    <section className={`lib-overview${embedded ? " lib-overview--embedded" : ""}`} aria-label="Skill pipeline">
      <header className={embedded ? "library-grid__bar" : "lib-overview__head"}>
        {embedded ? (
          // On its own page the page header already explains it; the bar just holds the time window.
          <span className="muted">Time window</span>
        ) : (
          <button className="lib-overview__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            <ChevronDown size={14} aria-hidden="true" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
            <Logo size={14} /> FlowCode skill pipeline
          </button>
        )}
        {open ? (
          <>
            <div className="seg" role="radiogroup" aria-label="Time window" style={{ marginLeft: "auto" }}>
              {(["24h", "7d", "30d"] as Win[]).map((w) => (
                <button key={w} role="radio" aria-checked={win === w} className={`seg__btn${win === w ? " is-on" : ""}`} onClick={() => setWin(w)}>
                  {w}
                </button>
              ))}
            </div>
            <span className="lib-overview__live">
              <span className="led led--ok" aria-hidden="true" /> live from your FlowCode builds
            </span>
          </>
        ) : null}
      </header>
      {open ? (
        <>
          <div className="lib-pipeline">
            {(data?.stages ?? []).map((s) => {
              const { color, Icon } = STAGE[s.id];
              return (
                <div key={s.id} className="lib-stage">
                  <div className="lib-stage__top">
                    <Icon size={15} style={{ color }} aria-hidden="true" />
                    <strong>{s.label}</strong>
                    <span className="lib-stage__n">{s.total}</span>
                  </div>
                  <span className="muted lib-stage__sub">{s.sub}</span>
                  <Sparkline values={s.series} color={color} label={`${s.label} over ${win}`} />
                  <div className="lib-stage__axis mono muted" aria-hidden="true">
                    <span>−{win}</span>
                    <span>now</span>
                  </div>
                </div>
              );
            })}
            {!data ? <p className="muted" style={{ padding: 16, margin: 0 }}>Gathering recent skill activity…</p> : null}
          </div>
          <div className="lib-cards">
            {cards.map((k) => (
              <div key={k.label} className="lib-card">
                <div className="lib-card__top">
                  <span className="lib-card__label">
                    <k.Icon size={14} aria-hidden="true" style={{ color: k.color }} /> {k.label}
                  </span>
                  {k.live ? <span className="lib-card__live">LIVE</span> : null}
                </div>
                <strong className={`lib-card__value${k.small ? " is-small" : ""}`}>{k.value}</strong>
                <span className="lib-card__sub muted">{k.sub}</span>
                {k.ring !== undefined ? (
                  <IsoColumn value={k.ring} color={k.color} />
                ) : "viz" in k && k.viz && "stack" in k.viz ? (
                  <IsoStack count={k.viz.stack ?? 0} color={k.color} />
                ) : "viz" in k && k.viz && "bars" in k.viz ? (
                  <IsoBars series={data?.stages.find((st) => st.id === (k.viz as { bars: string }).bars)?.series ?? []} color={k.color} />
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
