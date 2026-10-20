/**
 * A color as a wide swatch that opens into its 50–900 ramp on hover or keyboard focus (after CSSVibes' color
 * preview): each step shows its number, and its hex while pointed at; choosing a step makes that shade the color.
 * The ramp is FlowCode's own (makeRamp), the same one the app's tokens are built from.
 */
import { makeRamp, luminance, RAMP_STEPS } from "@flowcode/contracts";

export function RampSwatch({ label, value, onPick, disabled }: { label: string; value: string; onPick: (hex: string) => void; disabled?: boolean }) {
  const { ramp, baseStep } = makeRamp(value);
  return (
    <div className="rs" style={{ background: value }} tabIndex={-1}>
      <div className="rs__ramp" role="radiogroup" aria-label={`${label} shades`}>
        {RAMP_STEPS.map((step) => {
          const hex = ramp[step];
          const dark = luminance(hex) > 0.45;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={step === baseStep}
              aria-label={`${label} ${step}, ${hex}`}
              className={`rs__step${step === baseStep ? " is-base" : ""}`}
              style={{ background: hex, color: dark ? "#111" : "#fff" }}
              disabled={disabled}
              onClick={() => onPick(hex)}
            >
              <span className="rs__n">{step}</span>
              <span className="rs__hex">{hex}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
