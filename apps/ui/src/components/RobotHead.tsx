/**
 * An agent's robot head: neutral shaded metal (lit from the top-left) with the role colour on the antenna tip and
 * eyes. Used on the Agents page and, for whoever is working right now, on a run's signal strip.
 */
export const ROLE_COLOR: Record<string, string> = {
  planner: "#c084fc",
  coder: "#9a9fd6",
  debugger: "#f472b6",
  accessibility_qa: "#2fc4b2",
  security_qa: "#fbbf24",
  critic: "#7fb0c4",
  researcher: "#5eead4",
  repository_analyst: "#93c5fd",
  documenter: "#fde68a",
};

export const ROLE_LABEL: Record<string, string> = {
  planner: "Planner",
  coder: "Coder",
  debugger: "Debugger",
  accessibility_qa: "Accessibility reviewer",
  security_qa: "Security reviewer",
  critic: "Visual critic",
  researcher: "Researcher",
  repository_analyst: "Repository analyst",
  documenter: "Documenter",
};

export function RobotHead({ color, id, size = 26, className }: { color: string; id: string; size?: number; className?: string }) {
  const g = `head-${id}`;
  return (
    <svg className={className} width={size} height={(size * 22) / 26} viewBox="-19 -31 38 34" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <radialGradient id={g} cx="35%" cy="28%" r="80%">
          <stop offset="0%" style={{ stopColor: "var(--bot-hi)" }} />
          <stop offset="55%" style={{ stopColor: "var(--bot-mid)" }} />
          <stop offset="100%" style={{ stopColor: "var(--bot-lo)" }} />
        </radialGradient>
      </defs>
      <line x1={0} y1={-26} x2={0} y2={-19} style={{ stroke: "var(--bot-mid)" }} strokeWidth={2} strokeLinecap="round" />
      <circle className="robot-head__antenna" cx={0} cy={-28} r={2.8} fill={color} />
      <rect x={-16} y={-19} width={32} height={20} rx={6} fill={`url(#${g})`} />
      <rect x={-12} y={-15.5} width={24} height={12.5} rx={4} fill="#0b0f18" />
      <circle className="robot-head__eye" cx={-5.5} cy={-9.2} r={2.3} fill={color} />
      <circle className="robot-head__eye" cx={5.5} cy={-9.2} r={2.3} fill={color} />
      <rect x={-19} y={-12} width={3} height={6} rx={1.5} style={{ fill: "var(--bot-mid)" }} />
      <rect x={16} y={-12} width={3} height={6} rx={1.5} style={{ fill: "var(--bot-mid)" }} />
    </svg>
  );
}
