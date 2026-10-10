/**
 * Preview sizes: the widths FlowCode's own screenshots use, so what you try matches what was checked. Shared by the
 * builder's live preview and the component library's piece preview, so a size means the same thing in both.
 */
import { Monitor, Smartphone, Tablet } from "lucide-react";

export const DEVICES = [
  { id: "phone", label: "Phone", width: 375, Icon: Smartphone },
  { id: "tablet", label: "Tablet", width: 768, Icon: Tablet },
  { id: "desktop", label: "Desktop", width: 0, Icon: Monitor },
] as const;
export type Device = (typeof DEVICES)[number]["id"];

/** How wide a frame is at this size; 0 means "as wide as there is room for". */
export const deviceWidth = (device: Device) => DEVICES.find((d) => d.id === device)!.width;

export function PreviewSizes({ value, onChange, style }: { value: Device; onChange: (device: Device) => void; style?: React.CSSProperties }) {
  return (
    <div className="seg preview-devices" data-cp="preview-sizes" role="radiogroup" aria-label="Preview size" style={style}>
      {DEVICES.map((d) => (
        <button key={d.id} type="button" role="radio" aria-checked={value === d.id} className={`seg__btn${value === d.id ? " is-on" : ""}`} onClick={() => onChange(d.id)} aria-label={d.label} title={d.width ? `${d.label} (${d.width} px wide)` : "Desktop (full width)"}>
          <d.Icon size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
