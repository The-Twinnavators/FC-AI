/**
 * Extras: optional enhancements, any combination, as toggle chips (a tick and, for screen readers, "in this build";
 * the description in the tooltip). Each chip adds or removes only itself; the order follows the catalog.
 */
import { BUILD_EXTRAS } from "@flowcode/contracts";
import { Icon } from "./ui";

export function ExtrasPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : BUILD_EXTRAS.map((x) => x.id).filter((x) => x === id || value.includes(x)));
  return (
    <div className="psetup-chips" role="group" aria-label="Extras">
      {BUILD_EXTRAS.map((x) => {
        const on = value.includes(x.id);
        return (
          <label key={x.id} className={`psetup-chip${on ? " is-on" : ""}`} title={x.hint}>
            <input type="checkbox" checked={on} onChange={() => toggle(x.id)} aria-description={x.hint} />
            {on ? <Icon name="check" size={13} /> : null}
            {x.label}
            {on ? <span className="sr-only"> (in this build)</span> : null}
          </label>
        );
      })}
    </div>
  );
}
