import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Which of the app's themes the Preview and the Components sheet draw. An iframe's prefers-color-scheme follows the
 * frame's own color-scheme, so FlowCode's dark UI would otherwise always show the app's dark theme, while the Styles
 * panels edit the default (light) values. Light is the default so edits show where they're made.
 */
export type PreviewTheme = "light" | "dark";
const KEY = (projectId: string) => `fc:preview-theme:${projectId}`;
const EVENT = "fc:preview-theme";

function read(projectId: string): PreviewTheme {
  try {
    return localStorage.getItem(KEY(projectId)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function usePreviewTheme(projectId: string): [PreviewTheme, (t: PreviewTheme) => void] {
  const [theme, setTheme] = useState<PreviewTheme>(() => read(projectId));
  useEffect(() => {
    setTheme(read(projectId));
    const sync = () => setTheme(read(projectId));
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [projectId]);
  const set = (t: PreviewTheme) => {
    try {
      localStorage.setItem(KEY(projectId), t);
    } catch {
      /* per-session only */
    }
    setTheme(t);
    window.dispatchEvent(new Event(EVENT));
  };
  return [theme, set];
}

export function PreviewThemeToggle({ projectId }: { projectId: string }) {
  const [theme, setTheme] = usePreviewTheme(projectId);
  return (
    <div className="ptheme" role="group" aria-label="Theme shown in the preview">
      {(["light", "dark"] as const).map((t) => (
        <button key={t} type="button" className="ptheme__btn" aria-pressed={theme === t} onClick={() => setTheme(t)} title={t === "light" ? "Show the app's default (light) theme" : "Show the app's dark theme"}>
          {t === "light" ? <Sun size={13} aria-hidden="true" /> : <Moon size={13} aria-hidden="true" />}
          {t === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}
