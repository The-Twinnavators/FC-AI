/**
 * Home's animated background: React Bits' Gradient Waves (GradientWaves; see its notice),
 * behind the composer and every setup step. It moves only on
 * screen and in a visible tab, holds still for people who ask for reduced motion, and leaves a plain gradient without
 * WebGL2. Its own Pause sits in the corner (remembered on this device); the library's button isn't
 * used, so the library's base stylesheet stays out of FlowCode's page.
 */
import { useState } from "react";
import { GradientWaves } from "./GradientWaves";
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
        <div className="satin">
          <GradientWaves paused={paused} />
        </div>
      </div>
      <button type="button" className="home__pause" onClick={toggle} aria-pressed={paused} title={paused ? "Play the background" : "Pause the background"}>
        <Icon name={paused ? "play" : "pause"} size={14} />
        <span className="sr-only">{paused ? "Play the background" : "Pause the background"}</span>
      </button>
    </>
  );
}
