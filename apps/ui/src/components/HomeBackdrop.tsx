/**
 * Home's animated background: the library's shader gradient (c.background.shader, FlowCode's own WebGL shader; the
 * look comes from the CSSVibes shader backgrounds) in FlowCode's brand colours, behind the composer. It moves only on
 * screen and in a visible tab, holds one still frame for people who ask for reduced motion, and falls back to a CSS
 * gradient without WebGL. Its own Pause sits in the corner (remembered on this device); the library's button isn't
 * used, so the library's base stylesheet stays out of FlowCode's page.
 */
import { useMemo, useState } from "react";
import { ShaderGradient } from "../../../../templates/library/sections/shader-gradient";
import "../../../../templates/library/css/shader.css";
import { Icon } from "./ui";

const KEY = "flowcode.home.backdropPaused";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export function HomeBackdrop() {
  const [paused, setPaused] = useState(read);
  // FlowCode's brand colours (tokens.css), read once: the shader takes colours, not variables.
  const colors = useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    return [v("--brand-1", "#3b3fc4"), v("--brand-2", "#5d98d0"), v("--brand-3", "#84afdb")] as [string, string, string];
  }, []);
  const toggle = () => {
    const next = !paused;
    setPaused(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* only a convenience */
    }
  };
  return (
    <>
      <div className="home__shader" aria-hidden="true">
        <ShaderGradient variant="waves" colors={colors} speed={0.6} intensity={0.85} paused={paused} pauseButton={false} />
      </div>
      <button type="button" className="home__pause" onClick={toggle} aria-pressed={paused} title={paused ? "Play the background" : "Pause the background"}>
        <Icon name={paused ? "play" : "pause"} size={14} />
        <span className="sr-only">{paused ? "Play the background" : "Pause the background"}</span>
      </button>
    </>
  );
}
