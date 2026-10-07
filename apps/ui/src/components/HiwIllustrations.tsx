/**
 * How FlowCode works → animated illustrations, one per stage. Each scene steps through a short timeline (a tick every
 * 650 ms, 12 ticks) so its parts stay in order; CSS transitions do the motion between ticks. The timeline pauses when
 * the scene is off screen or the tab is hidden, and under prefers-reduced-motion the finished scene is shown still.
 */
import { useEffect, useRef, useState } from "react";

const TICKS = 12;

function useTimeline(ms = 650) {
  const ref = useRef<SVGSVGElement>(null);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [t, setT] = useState(reduce ? TICKS - 2 : 0);
  useEffect(() => {
    if (reduce || !ref.current) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(ref.current);
    const id = window.setInterval(() => {
      if (visible && !document.hidden) setT((x) => (x + 1) % TICKS);
    }, ms);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [reduce, ms]);
  /** The scene fades out on the last tick and restarts with its parts reset (no visible "undrawing"). */
  const cls = `ill${t === TICKS - 1 ? " is-out" : ""}${t === 0 ? " is-snap" : ""}`;
  const on = (k: number) => (t >= k ? " on" : "");
  return { ref, t, cls, on };
}

/** Each scene is cropped to its own drawing, so it fills the band instead of sitting in empty margins. */
const svgProps = (viewBox: string) => ({ viewBox, preserveAspectRatio: "xMidYMid meet", role: "presentation", "aria-hidden": true }) as const;

/** 1. Write a PRD: notes slide into a document whose sections write themselves. */
function PrdScene() {
  const { ref, t, cls, on } = useTimeline();
  const notes = ["Users", "Flows", "Non-goals"];
  const pen: Record<number, [number, number]> = { 2: [400, 28], 3: [360, 37], 5: [390, 64], 6: [330, 73], 8: [358, 94], 9: [318, 106] };
  const at = Object.keys(pen).map(Number).filter((k) => k <= t).pop();
  const [px, py] = at ? pen[at] : [216, 20];
  return (
    <svg ref={ref} className={cls} {...svgProps("28 0 556 128")}>
      {notes.map((n, i) => (
        <g key={n} className={`ill-note${on(1 + i * 3)}`} style={{ ["--x" as string]: "150px" }}>
          <rect x={40} y={18 + i * 34} width={92} height={24} rx={4} className="ill-soft" />
          <text x={52} y={34 + i * 34} className="ill-label">
            {n}
          </text>
        </g>
      ))}
      {/* Frosted glass behind the sheet: blurs the band's grid and glow showing through it. */}
      <foreignObject x={200} y={6} width={240} height={116}>
        <div className="ill-frost" />
      </foreignObject>
      <rect x={200} y={6} width={240} height={116} rx={6} className="ill-paper" />
      <path d="M418 6 L440 28 L418 28 Z" className="ill-fold" />
      {[20, 56, 88].map((y, i) => (
        <rect key={y} x={216} y={y} width={44} height={5} rx={2.5} className={`ill-head${on(2 + i * 3)}`} />
      ))}
      {[
        [216, 31, 400, 2],
        [216, 40, 360, 3],
        [216, 67, 390, 5],
        [216, 76, 330, 6],
        [232, 97, 360, 8],
        [232, 109, 320, 9],
      ].map(([x1, y, x2, k]) => (
        <line key={`${y}`} x1={x1} y1={y} x2={x2} y2={y} pathLength={1} className={`ill-draw ill-ink${on(k)}`} />
      ))}
      {[93, 105].map((y, i) => (
        <g key={y}>
          <rect x={216} y={y} width={8} height={8} rx={2} className="ill-box" />
          <path d={`M217.5 ${y + 4} l2 2 l3.5 -4.5`} pathLength={1} className={`ill-draw ill-tick${on(8 + i)}`} />
        </g>
      ))}
      <g className={`ill-pen${t >= 2 && t <= 9 ? " on" : ""}`} style={{ transform: `translate(${px}px, ${py}px)` }}>
        {/* A pencil, tip at the writing point, leaning right as if held: lead, wood, body, metal band, eraser. */}
        <g transform="rotate(35)">
          <path d="M-3.5 -8 L3.5 -8 L1.6 -3.4 L-1.6 -3.4 Z" className="ill-pen__wood" />
          <path d="M-1.6 -3.4 L1.6 -3.4 L0 0 Z" className="ill-pen__lead" />
          <rect x={-3.5} y={-28} width={7} height={20} className="ill-pen__body" />
          <rect x={-3.5} y={-28} width={2.2} height={20} className="ill-pen__shine" />
          <rect x={-3.8} y={-31.5} width={7.6} height={3.5} rx={0.6} className="ill-pen__band" />
          <rect x={-3.5} y={-36} width={7} height={4.5} rx={1.8} className="ill-pen__eraser" />
        </g>
      </g>
      <g className={`ill-pop${on(10)}`}>
        <circle cx={530} cy={64} r={22} className="ill-ring-ok" />
        <path d="M519 64 l7 7 l14 -15" pathLength={1} className={`ill-draw ill-check${on(10)}`} />
      </g>
      <text x={530} y={104} textAnchor="middle" className={`ill-label ill-fade${on(10)}`}>
        Ready to build
      </text>
    </svg>
  );
}

/** 2. Start a build: the path through the four steps fills node by node. */
function StartScene() {
  const { ref, t, cls, on } = useTimeline();
  const xs = [110, 250, 390, 530];
  const names = ["Describe", "Spec files", "Name & starter", "Autonomy"];
  const frac = Math.min(1, Math.max(0, (t - 1) / 9));
  const current = Math.min(3, Math.max(0, Math.floor((t - 1) / 3)));
  return (
    <svg ref={ref} className={cls} {...svgProps("76 0 488 128")}>
      <line x1={110} y1={54} x2={530} y2={54} className="ill-track" />
      <line x1={110} y1={54} x2={530} y2={54} pathLength={1} className="ill-progress" style={{ strokeDashoffset: 1 - frac }} />
      <circle r={26} cy={54} className="ill-here" style={{ transform: `translateX(${xs[current]}px)` }} />
      {xs.map((x, i) => {
        const lit = on(1 + i * 3);
        return (
          <g key={x} className={`ill-node${lit}`}>
            <circle cx={x} cy={54} r={18} />
            <g className="ill-glyph" transform={`translate(${x} 54)`}>
              {i === 0 ? <path d="M-7 -5 h14 M-7 0 h10 M-7 5 h12" /> : null}
              {i === 1 ? <path d="M-6 -8 h8 l4 4 v12 h-12 Z M2 -8 v4 h4" /> : null}
              {i === 2 ? <path d="M-8 -2 l8 -5 l8 5 l-8 5 Z M-8 3 l8 5 l8 -5" /> : null}
              {i === 3 ? <path d="M-7 4 a8 8 0 1 1 14 0 M0 2 l4 -6" /> : null}
            </g>
            <text x={x} y={96} textAnchor="middle" className="ill-label">
              {names[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 3. Approve the plan: the PRD feeds a clipboard; steps are written and checked, then approved. */
function PlanScene() {
  const { ref, cls, on } = useTimeline();
  const rows: Array<[number, number]> = [
    [44, 370],
    [72, 350],
    [100, 380],
  ];
  return (
    <svg ref={ref} className={cls} {...svgProps("30 0 578 128")}>
      <rect x={44} y={26} width={66} height={80} rx={4} className="ill-paper" />
      {[40, 50, 60, 74, 84].map((y, i) => (
        <line key={y} x1={54} y1={y} x2={i % 2 ? 88 : 98} y2={y} className="ill-ink ill-ink--still" />
      ))}
      <text x={77} y={120} textAnchor="middle" className="ill-label">
        PRD
      </text>
      <path d="M118 66 H204" className={`ill-flow${on(1)}`} />
      <path d="M198 60 l7 6 l-7 6" className={`ill-arrow${on(1)}`} />
      {/* The planner agent turns the PRD into tasks: the same bot as in the Build picture, above the arrow. */}
      <g>
        <text x={161} y={12} textAnchor="middle" className="ill-label">
          Planner
        </text>
        <line x1={161} y1={22} x2={161} y2={30} className="ill-antenna" />
        <circle cx={161} cy={20} r={3} fill="#c084fc" />
        <rect x={141} y={30} width={40} height={26} rx={7} className="ill-bot" />
        <rect x={146} y={34} width={30} height={16} rx={4} className="ill-visor" />
        <circle cx={155} cy={42} r={2.6} fill="#c084fc" className="ill-eye" />
        <circle cx={167} cy={42} r={2.6} fill="#c084fc" className="ill-eye" />
      </g>
      <rect x={215} y={12} width={210} height={108} rx={6} className="ill-paper" />
      <rect x={290} y={6} width={60} height={13} rx={3} className="ill-clip" />
      <text x={230} y={30} className={`ill-label ill-label--accent ill-fade${on(1)}`}>
        Feature task
      </text>
      {rows.map(([y, x2], i) => (
        <g key={y}>
          <circle cx={238} cy={y} r={8} className={`ill-num${on(2 + i * 2)}`} />
          <text x={238} y={y + 3.5} textAnchor="middle" className="ill-num__t">
            {i + 1}
          </text>
          <line x1={254} y1={y} x2={x2} y2={y} pathLength={1} className={`ill-draw ill-ink${on(2 + i * 2)}`} />
          <g className={`ill-pop${on(3 + i * 2)}`}>
            <circle cx={404} cy={y} r={8} className="ill-ok" />
            <path d={`M400 ${y} l3 3 l5 -6`} className="ill-tick ill-tick--light" />
          </g>
        </g>
      ))}
      <g className={`ill-stamp${on(9)}`} style={{ transformOrigin: "535px 64px" }}>
        <rect x={478} y={46} width={114} height={36} rx={5} className="ill-stamp__box" />
        <text x={535} y={69} textAnchor="middle" className="ill-stamp__t">
          APPROVED
        </text>
      </g>
    </svg>
  );
}

/**
 * What the agents say while a step is built, in turn: the Planner sets up the step from the plan, the Coder writes and
 * applies it, the Debugger runs the checks and fixes what fails. Each line is something FlowCode really does.
 */
const BOT_LINES: Array<[number, string]> = [
  [0, "Step 3 of 8: the brand list"],
  [1, "Writing BrandList.tsx…"],
  [2, "Type check failed: 1 error"],
  [1, "Fixed the missing import"],
  [2, "Tests and build pass ✓"],
  [0, "Step 3 done. Next: details"],
];

/** The bubble that's showing: one line every 2 seconds, only while the picture is on screen. */
function useBotTalk(ref: React.RefObject<SVGSVGElement | null>) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce || !ref.current) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(ref.current);
    const id = window.setInterval(() => visible && !document.hidden && setI((x) => (x + 1) % BOT_LINES.length), 2000);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [reduce, ref]);
  return i;
}

/** 4. Watch it build: blocks ride a conveyor past the planner, coder and debugger, who talk through the step. */
function BuildScene() {
  const ref = useRef<SVGSVGElement>(null);
  const said = useBotTalk(ref);
  const [who, line] = BOT_LINES[said]!;
  const robots: Array<[number, string, string, string]> = [
    [170, "Planner", "#c084fc", "1.39s"],
    [320, "Coder", "#9a9fd6", "1s"],
    [470, "Debugger", "#f472b6", "0.61s"],
  ];
  return (
    <svg ref={ref} className="ill ill--loop" {...svgProps("28 -36 584 164")}>
      <rect x={34} y={98} width={572} height={8} rx={4} className="ill-soft" />
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={50 + i * 42} cy={102} r={5} className="ill-roller" />
      ))}
      {robots.map(([x, name, color, delay]) => (
        <g key={name}>
          <text x={x} y={12} textAnchor="middle" className="ill-label">
            {name}
          </text>
          <line x1={x} y1={22} x2={x} y2={30} className="ill-antenna" />
          <circle cx={x} cy={20} r={3} fill={color} />
          <rect x={x - 20} y={30} width={40} height={26} rx={7} className="ill-bot" />
          <rect x={x - 15} y={34} width={30} height={16} rx={4} className="ill-visor" />
          <circle cx={x - 6} cy={42} r={2.6} fill={color} className="ill-eye" style={{ animationDelay: delay }} />
          <circle cx={x + 6} cy={42} r={2.6} fill={color} className="ill-eye" style={{ animationDelay: delay }} />
          <line x1={x} y1={58} x2={x} y2={74} className="ill-arm" style={{ animationDelay: delay }} />
        </g>
      ))}
      {/* The speaking robot's bubble, above its name; a new line pops in each turn. */}
      {(() => {
        const [x, , color] = robots[who]!;
        const w = Math.round(line.length * 6.1 + 24);
        // A line that reports a pass is green, like a passed check.
        const pass = line.includes("✓");
        return (
          <g key={said} className={`ill-say${pass ? " ill-say--pass" : ""}`} style={{ transformOrigin: `${x}px -2px` }}>
            <rect x={x - w / 2} y={-34} width={w} height={26} rx={8} className="ill-say__box" style={pass ? undefined : { stroke: color }} />
            <path d={`M${x - 5} -8.5 L${x} -2 L${x + 5} -8.5 Z`} className="ill-say__tail" style={pass ? undefined : { stroke: color }} />
            <text x={x} y={-17} textAnchor="middle" className="ill-say__t">
              {line}
            </text>
          </g>
        );
      })()}
      {[0, 2, 4].map((d) => (
        <rect key={d} x={34} y={80} width={18} height={18} rx={3} className="ill-block" style={{ animationDelay: `-${d}s` }} />
      ))}
    </svg>
  );
}

/** 5. Check the result: a magnifier scans the code line by line; lines turn green (one amber), then a shield. */
function CheckScene() {
  const { ref, t, cls, on } = useTimeline();
  const lines: Array<[number, number, number]> = [
    [30, 172, 180],
    [44, 188, 140],
    [58, 188, 210],
    [72, 172, 120],
    [86, 188, 170],
    [100, 172, 150],
  ];
  const idx = Math.min(5, Math.max(0, t - 1));
  const [ly, lx, len] = lines[idx];
  const mx = t >= 1 && t <= 6 ? lx + len * 0.7 : t > 6 ? 470 : 172;
  const my = t >= 1 && t <= 6 ? ly - 3 : t > 6 ? 70 : 20;
  return (
    <svg ref={ref} className={cls} {...svgProps("64 0 508 128")}>
      {/* The critic agent reviews the work: the same bot as in the other pictures, beside the code it checks. */}
      <g>
        <text x={104} y={22} textAnchor="middle" className="ill-label">
          Critic
        </text>
        <line x1={104} y1={32} x2={104} y2={40} className="ill-antenna" />
        <circle cx={104} cy={30} r={3} fill="#7fb0c4" />
        <rect x={84} y={40} width={40} height={26} rx={7} className="ill-bot" />
        <rect x={89} y={44} width={30} height={16} rx={4} className="ill-visor" />
        <circle cx={98} cy={52} r={2.6} fill="#7fb0c4" className="ill-eye" />
        <circle cx={110} cy={52} r={2.6} fill="#7fb0c4" className="ill-eye" />
        <path d="M128 53 H142" className={`ill-flow${on(1)}`} />
      </g>
      <rect x={150} y={8} width={300} height={112} rx={6} className="ill-paper" />
      <text x={162} y={21} className="ill-label ill-label--mono">
        {"</>"}
      </text>
      {lines.map(([y, x, l], i) => (
        <g key={y}>
          <line x1={x} y1={y} x2={x + l} y2={y} className="ill-ink ill-ink--still" />
          <line x1={x} y1={y} x2={x + l} y2={y} pathLength={1} className={`ill-draw ${i === 4 ? "ill-warn" : "ill-pass"}${on(1 + i)}`} />
        </g>
      ))}
      <g className={`ill-lens${t >= 1 && t <= 7 ? " on" : ""}`} style={{ transform: `translate(${mx}px, ${my}px)` }}>
        <circle r={13} className="ill-lens__glass" />
        <line x1={9} y1={9} x2={19} y2={19} className="ill-lens__handle" />
      </g>
      <path d="M530 26 L558 36 V62 C558 82 544 94 530 100 C516 94 502 82 502 62 V36 Z" pathLength={1} className={`ill-draw ill-shield${on(7)}`} />
      <path d="M518 62 l8 8 l16 -18" pathLength={1} className={`ill-draw ill-check${on(8)}`} />
      <text x={530} y={118} textAnchor="middle" className={`ill-label ill-fade${on(9)}`}>
        5 passed · 1 to review
      </text>
    </svg>
  );
}

/** 6. Test and launch: the page builds in a browser window, the checklist ticks off, and a rocket lifts off. */
function LaunchScene() {
  const { ref, t, cls, on } = useTimeline();
  const items = ["Security", "Privacy", "Accessibility", "Performance"];
  return (
    <svg ref={ref} className={cls} {...svgProps("50 0 650 128")}>
      <rect x={60} y={10} width={270} height={108} rx={6} className="ill-paper" />
      <line x1={60} y1={26} x2={330} y2={26} className="ill-ink ill-ink--still" />
      {[72, 82, 92].map((x) => (
        <circle key={x} cx={x} cy={18} r={3} className="ill-dot" />
      ))}
      <rect x={76} y={38} width={118} height={9} rx={3} className={`ill-accent ill-fade${on(1)}`} />
      <rect x={76} y={54} width={100} height={5} rx={2.5} className={`ill-softer ill-fade${on(2)}`} />
      <rect x={76} y={64} width={84} height={5} rx={2.5} className={`ill-softer ill-fade${on(2)}`} />
      <rect x={214} y={36} width={100} height={42} rx={4} className={`ill-soft ill-fade${on(3)}`} />
      {[76, 156, 236].map((x) => (
        <rect key={x} x={x} y={88} width={70} height={20} rx={4} className={`ill-soft ill-fade${on(4)}`} />
      ))}
      {/* The agents behind these checks, evenly spaced between the app and the checklist. */}
      <g>
        <g>
          <text x={418} y={14} textAnchor="middle" className="ill-label">
            Security QA
          </text>
          <line x1={418} y1={22} x2={418} y2={30} className="ill-antenna" />
          <circle cx={418} cy={21} r={3} fill="#fbbf24" />
          <rect x={398} y={30} width={40} height={26} rx={7} className="ill-bot" />
          <rect x={403} y={34} width={30} height={16} rx={4} className="ill-visor" />
          <circle cx={412} cy={42} r={2.6} fill="#fbbf24" className="ill-eye" />
          <circle cx={424} cy={42} r={2.6} fill="#fbbf24" className="ill-eye" />
        </g>
        <g>
          <text x={418} y={76} textAnchor="middle" className="ill-label">
            Accessibility QA
          </text>
          <line x1={418} y1={84} x2={418} y2={92} className="ill-antenna" />
          <circle cx={418} cy={83} r={3} fill="#2fc4b2" />
          <rect x={398} y={92} width={40} height={26} rx={7} className="ill-bot" />
          <rect x={403} y={96} width={30} height={16} rx={4} className="ill-visor" />
          <circle cx={412} cy={104} r={2.6} fill="#2fc4b2" className="ill-eye" />
          <circle cx={424} cy={104} r={2.6} fill="#2fc4b2" className="ill-eye" />
        </g>
      </g>
      {items.map((n, i) => (
        <g key={n}>
          <rect x={492} y={28 + i * 22} width={11} height={11} rx={2.5} className="ill-box" />
          <path d={`M494 ${34 + i * 22} l2.5 2.5 l4.5 -5`} pathLength={1} className={`ill-draw ill-tick${on(5 + i)}`} />
          <text x={512} y={37 + i * 22} className="ill-label">
            {n}
          </text>
        </g>
      ))}
      <g transform="translate(80 0)">
        <line x1={520} y1={120} x2={600} y2={120} className="ill-ink ill-ink--still" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={546 + i * 14} cy={114} r={7} className={`ill-puff${t === 9 || t === 10 ? " on" : ""}`} style={{ transitionDelay: `${i * 0.12}s` }} />
        ))}
        <g className={`ill-rocket${t === 9 ? " is-shake" : ""}${t >= 10 ? " is-up" : ""}`}>
          <path d="M553 96 Q560 116 567 96 Z" className="ill-flame" />
          <path d="M560 34 C551 48 549 68 550 94 L570 94 C571 68 569 48 560 34 Z" className="ill-rocket__body" />
          <path d="M550 80 L540 96 L550 94 Z M570 80 L580 96 L570 94 Z" className="ill-rocket__fin" />
          <circle cx={560} cy={62} r={5} className="ill-rocket__window" />
        </g>
      </g>
    </svg>
  );
}

export type IllustrationId = "prd" | "start" | "plan" | "build" | "check" | "launch";

export function HiwIllustration({ id }: { id: IllustrationId }) {
  return (
    <div className="hiw-vis hiw-ill" aria-hidden="true">
      {id === "prd" ? <PrdScene /> : null}
      {id === "start" ? <StartScene /> : null}
      {id === "plan" ? <PlanScene /> : null}
      {id === "build" ? <BuildScene /> : null}
      {id === "check" ? <CheckScene /> : null}
      {id === "launch" ? <LaunchScene /> : null}
    </div>
  );
}
