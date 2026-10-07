/**
 * Agents: a live map of the agent roles, the models they run on and the governed tools they use, with
 * pulses as tool calls happen, plus the Plan → Implement → Repair → Verify pipeline from the event log.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useEventStream, useResource } from "../api";
import { Led, time } from "../components/ui";
import { navigate } from "../router";
import { Sparkline } from "../components/Sparkline";
import { ROLE_COLOR, RobotHead } from "../components/RobotHead";

interface Activity {
  window: Win;
  stages: Array<{ id: string; label: string; sub: string; total: number; series: number[] }>;
  agents: Array<{ role: string; model: string; calls: number; ok: number; rejected: number; failed: number; tokens: number; tools: Array<{ name: string; n: number }>; allowedTools: string[]; last?: { at: string; tool: string; status: string; summary?: string } }>;
  activeRuns: Array<{ id: string; objective: string; task?: string; role?: string; projectId?: string }>;
}

const STAGE_COLOR: Record<string, string> = { plan: "#c084fc", implement: "#9a9fd6", repair: "#f472b6", verify: "#2fc4b2" };

type Win = "24h" | "7d" | "30d" | "all";
const WINDOWS: Win[] = ["24h", "7d", "30d", "all"];
const WIN_LABEL: Record<Win, string> = { "24h": "24h", "7d": "7d", "30d": "30d", all: "All time" };

const W = 1000;
const H = 500;
const CX = W / 2;
/** Top-down tiers: orchestrator, agents, tools. */
const CY = 62;
const AGENT_Y = 238;
const TOOL_Y = 404;

interface Pulse {
  id: number;
  role: string;
  tool: string;
  ok: boolean;
}

export function AgentsView() {
  const [win, setWin] = useState<Win>("24h");
  const { data, reload } = useResource<Activity>(`/agents/activity?window=${win}`, [win], 15_000);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [hot, setHot] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<Array<{ at: string; text: string; role: string }>>([]);
  const seq = useRef(0);

  useEventStream("/events?after=999999999", (e) => {
    const m = /^(\w+) requested (\w+)/.exec(e.message);
    if (e.type === "tool.requested" && m) {
      const p = { id: ++seq.current, role: m[1], tool: m[2], ok: true };
      setPulses((ps) => [...ps.slice(-30), p]);
      setTimeout(() => setPulses((ps) => ps.filter((x) => x.id !== p.id)), 1400);
      setHot((h) => ({ ...h, [m[1]]: Date.now() }));
      setFeed((f) => [{ at: e.createdAt, text: e.message, role: m[1] }, ...f].slice(0, 30));
    }
    if (e.type === "model.requested") {
      const r = /^(\w+) →/.exec(e.message)?.[1];
      if (r) setHot((h) => ({ ...h, [r]: Date.now() }));
    }
    if (e.type === "task.verified" || e.type === "task.blocked" || e.type === "run.done") reload();
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const layout = useMemo(() => {
    const agents = data?.agents ?? [];
    const n = Math.max(1, agents.length);
    const pos = new Map<string, { x: number; y: number }>();
    const tools = new Map<string, { x: number; y: number; agents: string[]; n: number }>();
    // Agents: one evenly spaced row under the orchestrator.
    agents.forEach((a, i) => pos.set(a.role, { x: 90 + ((W - 180) * (i + 0.5)) / n, y: AGENT_Y }));
    // Tools: one row at the bottom, each placed under the agents that use it most (fewer crossings).
    const allTools = new Map<string, { n: number; agents: string[]; xSum: number }>();
    for (const a of agents) {
      const ax = pos.get(a.role)!.x;
      for (const t of a.tools) {
        const cur = allTools.get(t.name) ?? { n: 0, agents: [], xSum: 0 };
        cur.n += t.n;
        cur.agents.push(a.role);
        cur.xSum += ax * t.n;
        allTools.set(t.name, cur);
      }
    }
    const sorted = [...allTools.entries()].sort((a, b) => a[1].xSum / a[1].n - b[1].xSum / b[1].n);
    const m = Math.max(1, sorted.length);
    sorted.forEach(([name, t], i) => {
      // Labels alternate between two lines so long tool names never collide.
      tools.set(name, { x: 50 + ((W - 100) * (i + 0.5)) / m, y: TOOL_Y + (i % 2) * 34, agents: t.agents, n: t.n });
    });
    return { pos, tools };
  }, [data]);

  const maxTool = Math.max(1, ...[...layout.tools.values()].map((t) => t.n));
  const active = new Set((data?.activeRuns ?? []).map((r) => r.role).filter(Boolean) as string[]);

  return (
    <div className="page" style={{ maxWidth: 1400, display: "grid", gap: 14 }}>
      <header className="page__head" style={{ marginBottom: 0 }}>
        <div>
          <span className="label">Data process</span>
          <h1 className="page__title">Agents</h1>
          <p className="lrc__meta">Who is doing what, right now: each agent's role and model, the pipeline from plan to verify, the tools agents call and what they're allowed to do.</p>
        </div>
        <div role="radiogroup" aria-label="Window" style={{ display: "flex", gap: 4 }}>
          {WINDOWS.map((w) => (
            <button key={w} role="radio" aria-checked={win === w} className={`btn btn--sm ${win === w ? "btn--primary" : ""}`} onClick={() => setWin(w)}>
              {WIN_LABEL[w]}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
        <div className="agents-stage" data-guide="agents.map">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Agent map: agent roles connected to the models they use and the tools they call">
            <defs>
              <radialGradient id="core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#7f84c4" stopOpacity="0.15" />
              </radialGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <pattern id="agent-grid" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M25 0H0V25" fill="none" style={{ stroke: "var(--agent-grid)" }} strokeWidth={0.6} />
              </pattern>
              <radialGradient id="agent-grid-fade" cx="50%" cy="45%" r="65%">
                <stop offset="0%" stopColor="#fff" stopOpacity={1} />
                <stop offset="100%" stopColor="#fff" stopOpacity={0} />
              </radialGradient>
              <mask id="agent-grid-mask">
                <rect width={W} height={H} fill="url(#agent-grid-fade)" />
              </mask>
              {/* Robot shading: lit from the top-left so the parts read as rounded metal. */}
              <radialGradient id="bot-shade" cx="35%" cy="28%" r="80%">
                <stop offset="0%" style={{ stopColor: "var(--bot-hi)" }} />
                <stop offset="55%" style={{ stopColor: "var(--bot-mid)" }} />
                <stop offset="100%" style={{ stopColor: "var(--bot-lo)" }} />
              </radialGradient>
              <linearGradient id="bot-limb" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" style={{ stopColor: "var(--bot-mid)" }} />
                <stop offset="100%" style={{ stopColor: "var(--bot-lo)" }} />
              </linearGradient>
              <linearGradient id="bot-visor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1b2130" />
                <stop offset="100%" stopColor="#06080d" />
              </linearGradient>
              <radialGradient id="bot-floor" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#000" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#000" stopOpacity={0} />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="url(#agent-grid)" mask="url(#agent-grid-mask)" />
            {/* orchestrator ↔ agents */}
            {data?.agents.map((a) => {
              const p = layout.pos.get(a.role)!;
              return <path key={`o-${a.role}`} d={`M${CX},${CY + 38} C${CX},${(CY + AGENT_Y) / 2} ${p.x},${(CY + AGENT_Y) / 2} ${p.x},${p.y - 72}`} fill="none" stroke={ROLE_COLOR[a.role]} strokeOpacity={0.4} strokeWidth={1.2} strokeDasharray="3 5" />;
            })}
            {/* agent → tool edges, width by usage */}
            {data?.agents.flatMap((a) =>
              a.tools.map((t) => {
                const p = layout.pos.get(a.role)!;
                const q = layout.tools.get(t.name)!;
                return <path key={`${a.role}-${t.name}`} d={`M${p.x},${p.y + 50} C${p.x},${(p.y + q.y) / 2 + 20} ${q.x},${(p.y + q.y) / 2} ${q.x},${q.y - 8}`} fill="none" stroke={ROLE_COLOR[a.role]} strokeOpacity={0.18 + (0.5 * t.n) / maxTool} strokeWidth={0.6 + (2.4 * t.n) / maxTool} />;
              }),
            )}
            {/* live pulses */}
            {pulses.map((p) => {
              const a = layout.pos.get(p.role);
              const t = layout.tools.get(p.tool);
              if (!a) return null;
              const tx = t?.x ?? CX;
              const ty = t?.y ?? CY;
              return (
                <circle key={p.id} r={4} fill={ROLE_COLOR[p.role] ?? "#fff"} filter="url(#glow)">
                  <animateMotion dur="1.2s" fill="freeze" path={`M${a.x},${a.y + 50} C${a.x},${(a.y + ty) / 2 + 20} ${tx},${(a.y + ty) / 2} ${tx},${ty - 8}`} />
                  <animate attributeName="opacity" values="1;1;0" dur="1.3s" fill="freeze" />
                </circle>
              );
            })}
            {/* tools */}
            {[...layout.tools.entries()].map(([name, t]) => (
              <g key={name}>
                <circle cx={t.x} cy={t.y} r={3 + (6 * t.n) / maxTool} fill="#7fb0c4" fillOpacity={0.75} filter="url(#glow)" />
                <text x={t.x} y={t.y + 18 + (6 * t.n) / maxTool} textAnchor="middle" fontSize="11" fill="currentColor" style={{ fill: "var(--text-1)" }}>
                  {name}
                </text>
              </g>
            ))}
            {/* orchestrator */}
            <WireframeBall x={CX} y={CY} r={34} />
            <text x={CX} y={CY + 52} textAnchor="middle" fontSize="12.5" fontWeight="700" style={{ fill: "var(--text-0)" }}>
              Orchestrator
            </text>
            {/* agents */}
            {data?.agents.map((a) => {
              const p = layout.pos.get(a.role)!;
              const isHot = active.has(a.role) || now - (hot[a.role] ?? 0) < 8000;
              // Every robot is the same size; activity shows as a call-count badge instead.
              const r = 24;
              return (
                <g key={a.role} className={`agent-node${isHot ? " is-hot" : ""}`}>
                  <Robot x={p.x} y={p.y} s={r / 22} color={ROLE_COLOR[a.role]} level={isHot ? 1 : a.calls ? 0.85 : 0.55} />
                  {a.calls ? <CallBadge x={p.x} y={p.y - (r / 22) * 31 - 12} calls={a.calls} /> : null}
                  {active.has(a.role) ? <WorkBar x={p.x} y={p.y - (r / 22) * 31 - 30} task={data?.activeRuns.find((x) => x.role === a.role)?.task} /> : null}
                  <text x={p.x} y={p.y + (r / 22) * 24 + 16} textAnchor="middle" fontSize="12.5" fontWeight="650" style={{ fill: "var(--text-0)" }}>
                    {a.role.replace(/_/g, " ")}
                  </text>
                  <text x={p.x} y={p.y + (r / 22) * 24 + 30} textAnchor="middle" fontSize="10.5" style={{ fill: "var(--text-2)" }}>
                    {a.model}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="agent-card" style={{ alignContent: "start", maxHeight: 560, overflow: "auto" }} aria-label="Live activity">
          <span className="label">live activity</span>
          {data?.activeRuns.length ? (
            data.activeRuns.map((r) => (
              <button key={r.id} className="net-chip" style={{ display: "grid", textAlign: "left", gap: 2 }} onClick={() => r.projectId && navigate(`/projects/${r.projectId}/runs/${r.id}`)}>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Led status="running" /> <strong>{r.role ?? "runtime"}</strong>
                </span>
                <span className="muted">{r.task ?? r.objective.slice(0, 60)}</span>
              </button>
            ))
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              No agent is running. Start a prototype and the map lights up as agents read, write and run checks.
            </p>
          )}
          <span className="label" style={{ marginTop: 8 }}>
            tool calls
          </span>
          <ul className="feed" style={{ padding: 0 }}>
            {feed.map((f, i) => (
              <li key={i} className="feed__item" style={{ padding: "3px 0", gridTemplateColumns: "54px 10px 1fr" }}>
                <span className="feed__time">{time(f.at)}</span>
                <span className="dot" style={{ background: ROLE_COLOR[f.role] ?? "#fff", color: ROLE_COLOR[f.role] }} />
                <span className="feed__msg" style={{ fontSize: 12 }}>
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section aria-label="Agent pipeline" className="pipeline" data-guide="agents.pipeline">
        {data?.stages.map((s) => (
          <div key={s.id} className="stage-card">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="dot" style={{ background: STAGE_COLOR[s.id], color: STAGE_COLOR[s.id] }} />
              <strong style={{ fontSize: 15 }}>{s.label}</strong>
              <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{s.total}</span>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>
              {s.sub}
            </span>
            <Sparkline values={s.series} color={STAGE_COLOR[s.id]} label={`${s.label} activity over ${win}`} />
            <div style={{ display: "flex", justifyContent: "space-between" }} className="mono muted" aria-hidden="true">
              <span style={{ fontSize: 9.5 }}>{win === "all" ? "first run" : `−${win}`}</span>
              <span style={{ fontSize: 9.5 }}>now</span>
            </div>
          </div>
        ))}
      </section>

      <section className="agent-cards" aria-label="Agents">
        {data?.agents.map((a) => (
          <article key={a.role} className="agent-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RobotHead color={ROLE_COLOR[a.role]} id={a.role} />
              <strong style={{ textTransform: "capitalize" }}>{a.role.replace(/_/g, " ")}</strong>
              <span className="mono muted" style={{ marginLeft: "auto", fontSize: 11 }}>
                {a.model}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              <Mini label="calls" value={a.calls} />
              <Mini label="success" value={a.calls ? `${Math.round((a.ok / a.calls) * 100)}%` : "—"} />
              <Mini label="tokens" value={a.tokens >= 1000 ? `${(a.tokens / 1000).toFixed(1)}K` : a.tokens} />
            </div>
            {a.last ? (
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Last: <span className="mono">{a.last.tool}</span> · {a.last.status} · {time(a.last.at)}
              </p>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Idle in this window. Allowed: {a.allowedTools.slice(0, 5).join(", ")}
                {a.allowedTools.length > 5 ? "…" : ""}
              </p>
            )}
          </article>
        ))}
      </section>
      {/* The tools agents may use live in Prompts & Skills → Tools. */}
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        The tools these agents may use, with their permissions, are in <a href="#/library?tab=tools">Prompts &amp; Skills → Built-in tools</a> (and extra tools from <a href="#/library?tab=servers">Connected servers</a>).
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
      <div className="label">{label}</div>
      <div style={{ fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}


/**
 * An agent as a small shaded robot: neutral metal lit from the top-left (reads as 3D), with the role colour kept to
 * the eyes and antenna tip. Busy agents blink and pulse their antenna and chest light.
 */
function Robot({ x, y, s, color, level }: { x: number; y: number; s: number; color: string; level: number }) {
  return (
    <g className="robot" transform={`translate(${x} ${y}) scale(${s})`} opacity={level}>
      <ellipse cx={0} cy={25} rx={17} ry={3.2} fill="url(#bot-floor)" />
      <line x1={0} y1={-26} x2={0} y2={-19} style={{ stroke: "var(--bot-mid)" }} strokeWidth={2} strokeLinecap="round" />
      <circle className="robot__antenna" cx={0} cy={-28} r={2.8} fill={color} />
      <rect x={-19} y={6} width={5} height={13} rx={2.5} fill="url(#bot-limb)" />
      <rect x={14} y={6} width={5} height={13} rx={2.5} fill="url(#bot-limb)" />
      <rect x={-13} y={4} width={26} height={19} rx={5} fill="url(#bot-shade)" />
      <circle className="robot__core" cx={0} cy={13.5} r={3} fill={color} opacity={0.9} />
      <rect x={-3} y={0} width={6} height={5} fill="url(#bot-limb)" />
      <rect x={-16} y={-19} width={32} height={20} rx={6} fill="url(#bot-shade)" />
      <rect x={-12} y={-15.5} width={24} height={12.5} rx={4} fill="url(#bot-visor)" />
      <rect x={-10} y={-14.6} width={20} height={2.2} rx={1.1} fill="#ffffff" opacity={0.12} />
      <circle className="robot__eye" cx={-5.5} cy={-9.2} r={2.3} fill={color} />
      <circle className="robot__eye" cx={5.5} cy={-9.2} r={2.3} fill={color} />
      <path d="M-13 -17.5 Q0 -21 13 -17.5" fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.2} strokeLinecap="round" />
      <rect x={-19} y={-12} width={3} height={6} rx={1.5} fill="url(#bot-limb)" />
      <rect x={16} y={-12} width={3} height={6} rx={1.5} fill="url(#bot-limb)" />
    </g>
  );
}

/** Tool-call count shown above the robot's head. */
function CallBadge({ x, y, calls }: { x: number; y: number; calls: number }) {
  const label = calls >= 1000 ? `${(calls / 1000).toFixed(calls >= 10_000 ? 0 : 1)}k` : String(calls);
  const w = 10 + label.length * 6.4;
  return (
    <g transform={`translate(${x} ${y})`} className="call-badge">
      <title>{`${calls} tool call${calls === 1 ? "" : "s"} in this window`}</title>
      <rect x={-w / 2} y={-8} width={w} height={16} rx={4} style={{ fill: "var(--badge-bg)", stroke: "var(--badge-line)" }} strokeWidth={1} />
      <text y={3.6} textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily="var(--font-mono)" style={{ fill: "var(--text-0)" }}>
        {label}
      </text>
    </g>
  );
}

/** Progress bar over a working agent's head. The run reports no percentage, so it's an indeterminate sweep. */
function WorkBar({ x, y, task }: { x: number; y: number; task?: string }) {
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const w = 46;
  const id = `wb-${Math.round(x)}`;
  return (
    <g transform={`translate(${x - w / 2} ${y})`} className="work-bar">
      <title>{task ? `Working: ${task}` : "Working"}</title>
      <clipPath id={id}>
        <rect width={w} height={5} rx={2.5} />
      </clipPath>
      <rect width={w} height={5} rx={2.5} style={{ fill: "var(--bot-track)" }} />
      <g clipPath={`url(#${id})`}>
        <rect x={still ? 0 : -18} width={still ? w : 18} height={5} rx={2.5} style={{ fill: "var(--sig-ok)" }}>
          {still ? null : <animate attributeName="x" values={`-18;${w}`} dur="1.3s" repeatCount="indefinite" />}
        </rect>
      </g>
    </g>
  );
}

/**
 * The orchestrator as a spinning wireframe globe: fixed latitude rings and meridians whose projected width follows
 * |sin(angle + t)|, which reads as rotation about a tilted axis. SVG-only (SMIL), still under reduced motion.
 */
function WireframeBall({ x, y, r }: { x: number; y: number; r: number }) {
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const MERIDIANS = 6;
  const STEPS = 24;
  const DUR = "9s";
  const latitudes = [-0.66, -0.33, 0, 0.33, 0.66];
  return (
    <g transform={`translate(${x} ${y}) rotate(-18)`} className="orchestrator-orb" aria-hidden="true">
      <circle r={r * 1.05} fill="url(#core)" opacity={0.35} filter="url(#glow)" />
      <circle r={r} fill="none" style={{ stroke: "var(--orb-line)" }} strokeOpacity={0.95} strokeWidth={1.5} />
      {latitudes.map((k) => (
        <ellipse key={k} cy={k * r} rx={r * Math.sqrt(1 - k * k)} ry={r * Math.sqrt(1 - k * k) * 0.22} fill="none" style={{ stroke: "var(--orb-line)" }} strokeOpacity={k === 0 ? 0.85 : 0.45} strokeWidth={1} />
      ))}
      {Array.from({ length: MERIDIANS }, (_, i) => {
        const offset = (i / MERIDIANS) * Math.PI;
        const values = Array.from({ length: STEPS + 1 }, (_, j) => (r * Math.abs(Math.sin(offset + (j / STEPS) * Math.PI))).toFixed(2)).join(";");
        return (
          <ellipse key={i} rx={(r * Math.abs(Math.sin(offset))).toFixed(2)} ry={r} fill="none" style={{ stroke: "var(--orb-line)" }} strokeOpacity={0.7} strokeWidth={1}>
            {still ? null : <animate attributeName="rx" values={values} dur={DUR} repeatCount="indefinite" />}
          </ellipse>
        );
      })}
      <circle r={3.2} style={{ fill: "var(--orb-line)" }} />
    </g>
  );
}
