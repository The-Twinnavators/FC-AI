/**
 * Preview sizes: the widths FlowCode's own screenshots use, so what you try matches what was checked. Shared by the
 * builder's live preview and the component library's piece preview, so a size means the same thing in both.
 */
import { Monitor, Moon, Smartphone, Sun, Tablet } from "lucide-react";

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

export type PreviewTheme = "light" | "dark";
const THEME_KEY = "flowcode.previewTheme";

/** The preview's light or dark theme, remembered on this computer; light until changed. */
export function storedPreviewTheme(): PreviewTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
export function storePreviewTheme(theme: PreviewTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* kept for this visit */
  }
}

/**
 * Light or dark for the app in the preview. The app switches itself (its dark theme is written from its style), so the
 * choice is sent to it; FlowCode's own light or dark theme never changes the preview.
 */
export function PreviewThemeToggle({ value, onChange }: { value: PreviewTheme; onChange: (theme: PreviewTheme) => void }) {
  return (
    <div className="seg preview-theme" role="radiogroup" aria-label="Preview theme">
      {(["light", "dark"] as const).map((t) => (
        <button key={t} type="button" role="radio" aria-checked={value === t} className={`seg__btn${value === t ? " is-on" : ""}`} onClick={() => onChange(t)} aria-label={t === "light" ? "Light mode" : "Dark mode"} title={t === "light" ? "Show the app in light mode" : "Show the app in dark mode"}>
          {t === "light" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
