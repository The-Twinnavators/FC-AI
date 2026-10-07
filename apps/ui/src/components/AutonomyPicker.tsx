/** Autonomy level picker: what runs on its own vs. what asks — the same policy the daemon enforces. */
import { Bot, User } from "lucide-react";
import { AUTONOMY_LEVELS, type AutonomyLevel } from "@flowcode/contracts";

export function AutonomyPicker({ value, onChange, compact = false }: { value: AutonomyLevel; onChange: (v: AutonomyLevel) => void; compact?: boolean }) {
  const current = AUTONOMY_LEVELS.find((l) => l.id === value)!;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div role="radiogroup" aria-label="Autonomy level" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: "1px solid var(--line-strong)", borderRadius: 8, overflow: "hidden" }}>
        {AUTONOMY_LEVELS.map((l, i) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={value === l.id}
            onClick={() => onChange(l.id)}
            style={{
              border: 0,
              borderLeft: i ? "1px solid var(--line-strong)" : 0,
              padding: "8px 10px",
              background: value === l.id ? "var(--bg-active)" : "transparent",
              color: value === l.id ? "var(--text-0)" : "var(--text-1)",
              fontWeight: value === l.id ? 650 : 500,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Who acts: you (supervised), you and the agent (assisted), the agent (autonomous). */}
              <span aria-hidden="true" style={{ display: "inline-flex", gap: 1, color: value === l.id ? "var(--brand-ink)" : "var(--text-2)" }}>
                {i < 2 ? <User size={16} strokeWidth={2} /> : null}
                {i > 0 ? <Bot size={16} strokeWidth={2} /> : null}
              </span>
              {l.label}
            </span>
          </button>
        ))}
      </div>
      <div className="muted" style={{ margin: 0, fontSize: 12, display: "grid", gap: 6 }} aria-live="polite">
        <strong style={{ color: "var(--text-1)" }}>{current.summary}</strong>
        {/* What it means for you, always; the exact rules (what the daemon enforces) on request, outside the compact view. */}
        <ul className="autonomy-foryou">
          {current.forYou.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {compact ? null : (
          <>
            <details className="autonomy-rules">
              <summary>The exact rules</summary>
              <p style={{ margin: "4px 0 0" }}>
                Runs on its own: {current.autoApproves.join(", ").toLowerCase()}. Always asks: {current.alwaysAsks.join(", ").toLowerCase()}. Never allowed at any level: git push, deploys, system changes, anything outside the workspace or touching secrets.
              </p>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
