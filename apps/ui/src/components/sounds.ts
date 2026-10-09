/**
 * Notification sounds, generated with the Web Audio API (no audio files):
 * - alert: a soft rising two-note chime, for a new approval waiting on you;
 * - block: a low falling two-note tone, for a blocked task or run;
 * - reply: a short soft pop, when a chat (Copilot or the builder chat) answers.
 * On by default; Settings → Sounds turns them off. Browsers only allow sound after the page has been clicked once.
 */
export type SoundKind = "alert" | "block" | "reply";

const KEY = "fc.sounds";
const listeners = new Set<(on: boolean) => void>();
let ctx: AudioContext | undefined;
const last: Partial<Record<SoundKind, number>> = {};

export function soundsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundsOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* per-browser preference only */
  }
  listeners.forEach((l) => l(on));
  if (on) playSound("reply");
}

export function onSoundsChange(l: (on: boolean) => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

function audio(): AudioContext | undefined {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return undefined;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// Unlock audio on the first click or key press, since browsers block sound until then.
if (typeof window !== "undefined") {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function tone(ac: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, peak: number, glideTo?: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export function playSound(kind: SoundKind) {
  if (!soundsOn()) return;
  // One of each kind at a time: a burst of events plays once.
  const now = Date.now();
  if (now - (last[kind] ?? 0) < 1200) return;
  last[kind] = now;
  const ac = audio();
  if (!ac || ac.state !== "running") return;
  const t = ac.currentTime + 0.01;
  if (kind === "alert") {
    tone(ac, t, 659.25, 0.22, "sine", 0.16);
    tone(ac, t + 0.13, 880, 0.32, "sine", 0.14);
  } else if (kind === "block") {
    tone(ac, t, 220, 0.26, "triangle", 0.2);
    tone(ac, t + 0.2, 164.81, 0.42, "triangle", 0.2);
  } else {
    tone(ac, t, 1046.5, 0.12, "sine", 0.1, 1318.5);
  }
}
