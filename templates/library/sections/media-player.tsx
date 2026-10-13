/** @flowcode-library media-player · Media player: audio now-playing card and video player with glass controls (Cards)
 * Catalog ID: c.media-player (component)
 * Function: The media player (c.media-player): an audio now-playing card (queue, play/pause, seek, like, volume) on liquid glass or a plain surface, and a video player with custom controls on liquid glass over the picture. Both run a real <audio>/<video> when given a src; without one they play a simulated clock (audio) or a clip generated from the style's colors (video), so every control works.
 * Use it as: import { AudioPlayer, VideoPlayer } from "./media-player"; <AudioPlayer track={{ title, artist, album?, src?, artwork?, duration? }} queue?={tracks} glass?={true} strength?="subtle"|"regular"|"strong"|"stronger"|"strongest" tone?="light"|"dark" start?={0} />; <VideoPlayer src? poster? title="Harbor at dawn" tracks?={[{ label, srclang, src? | cues? }]} scenes?={["DAWN", "TIDE"]} strength? tone? />  // mount <GlassFilter /> once per page for the glass's SVG lens
 * Variants: c.media-player.audio - a now-playing card: artwork, title and artist, seek with elapsed and remaining, previous / play / next as round buttons, like, mute and volume; on glass over a picture, or a plain surface card (glass={false}); c.media-player.video - a video with its controls on glass over the picture: big centre play, a bottom bar with play, back and forward 10 seconds, a scrubber with buffered range and hover time, time, volume and mute, captions, speed, picture-in-picture and full screen; the controls hide while it plays
 * Built from: c.liquid-glass, c.button
 * Look: A rounded glass card with a small square of artwork, a bold title, a thin accent seek line with times under it and a row of round glass buttons; the video has a large round glass play button in the middle and a floating glass bar along the bottom that slides away while it plays.
 * Tokens: --color-surface --color-text --color-text-muted --color-bg --color-border --color-accent --color-on-accent --color-secondary --color-success --color-focus --color-danger --radius-md --radius-lg --surface-radius --surface-shadow --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --weight-bold --duration-fast --duration-base --ease-out --focus-ring
 * Use cases: music app now playing; podcast episode player; course video lesson; product demo video; event recording; video on a landing page
 * Jobs to be done: play and pause; jump to a part of it; see how long is left; turn it down or mute it; read captions; watch it full screen
 * Keywords: media player, audio player, video player, now playing, music player, podcast player, video controls, captions, picture in picture
 */
/**
 * Media player. AudioPlayer is the now-playing card: a real <audio> when the track has a src, otherwise a simulated
 * clock; Space plays and pauses, ← → seek 5 seconds, M mutes (with focus anywhere in the card). VideoPlayer puts custom
 * controls on liquid glass over the picture: Space or K plays, J / L jump 10 seconds, ← → 5 seconds, ↑ ↓ change the
 * volume, M mutes, F goes full screen, C turns captions on and off. While it plays the controls slide away after 2.5
 * seconds and come back on pointer movement or focus; with reduced motion they appear and disappear without sliding.
 * The glass over the video uses the browser's backdrop-filter (the SVG lens, or frosted blur), which samples the live
 * frame on the GPU with nothing uploaded per frame; the WebGL lens would need a texture upload every frame.
 * Without a src, the video plays a clip drawn from the style's colors on a canvas, streamed into the <video> with
 * canvas.captureStream(); where captureStream is missing the canvas itself is shown. Full screen is the browser's own
 * full screen of the player, not a dialog. Glass is for these controls only, never for dialogs.
 * Written for FlowCode. Make it the app's own: replace SAMPLE with your own tracks (src, artwork) and video (src,
 * poster, caption tracks).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { GlassButton, GlassFilter, GlassPanel, GlassStage, resolveColor, type GlassStrength, type GlassTone } from "./liquid-glass";

export type MediaTrack = { id?: string; title: string; artist: string; album?: string; src?: string; artwork?: string; /** Seconds; used until the audio reports its own, and by the simulated clock. */ duration?: number };
export type VideoTrack = { label: string; srclang: string; /** A WebVTT file. */ src?: string; /** Or the cues themselves. */ cues?: { start: number; end: number; text: string }[]; default?: boolean };

/** 0:05, 4:34, 1:02:09 */
export const clock = (s: number) => {
  const t = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Icons the player needs that ./icons doesn't have (same 24×24 grid and 1.75 stroke). */
function Glyph({ d, text }: { d: string; text?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
      {text ? (
        <text x="12" y="15.2" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">
          {text}
        </text>
      ) : null}
    </svg>
  );
}
const G = {
  volume: "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  mute: "M4 9h4l5-4v14l-5-4H4zM17 9.5l5 5M22 9.5l-5 5",
  captions: "M3 5h18v14H3zM10.5 10.2a2.4 2.4 0 1 0 0 3.6M17.5 10.2a2.4 2.4 0 1 0 0 3.6",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  exitFull: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  pip: "M3 5h18v14H3zM12 12h7v5h-7z",
  back: "M4 12a8 8 0 1 0 2.5-5.8M4 3.5V8h4.5",
  forward: "M20 12a8 8 0 1 1-2.5-5.8M20 3.5V8h-4.5",
};

/** A round control: glass when the player is on glass, a plain token button otherwise. */
function Ctl({ glass, label, icon, pressed, onClick, big, strength, tone }: { glass: boolean; label: string; icon: string | ReactNode; pressed?: boolean; onClick: () => void; big?: boolean; strength?: GlassStrength; tone?: GlassTone }) {
  if (glass) return <GlassButton variant="round" label={label} icon={icon} pressed={pressed} onClick={onClick} strength={strength} tone={tone} className={big ? "fl-media-big" : undefined} />;
  return (
    <button type="button" className={`fl-media-btn${big ? " fl-media-btn--big" : ""}`} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      {typeof icon === "string" ? <Icon name={icon} filled={pressed === true && icon === "heart"} /> : icon}
    </button>
  );
}

/* ── Audio ──────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The now-playing card. With `queue`, Previous and Next move through it (Previous restarts the song after 3 seconds).
 * glass={false} draws it on the plain surface, for designs without glass.
 */
export function AudioPlayer({
  track,
  queue,
  glass = true,
  strength = "regular",
  tone,
  start = 0,
  className = "",
}: {
  track: MediaTrack;
  queue?: MediaTrack[];
  glass?: boolean;
  strength?: GlassStrength;
  tone?: GlassTone;
  /** Where the first track starts, in seconds. */
  start?: number;
  className?: string;
}) {
  const list = queue && queue.length ? queue : [track];
  const [at, setAt] = useState(() => Math.max(0, list.findIndex((t) => t === track || (t.title === track.title && t.artist === track.artist))));
  const cur = list[at] ?? track;
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(start);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const real = Boolean(cur.src);
  const length = dur || cur.duration || 240;
  const key = cur.id ?? `${cur.title}·${cur.artist}`;

  const go = useCallback(
    (i: number, keepPlaying: boolean) => {
      setAt((i + list.length) % list.length);
      setPos(0);
      setDur(0);
      setPlaying(keepPlaying);
    },
    [list.length],
  );
  const next = useCallback((auto: boolean) => (auto && at === list.length - 1 ? (setPlaying(false), setPos(0)) : go(at + 1, playing || auto)), [at, list.length, go, playing]);

  // The simulated clock, for tracks without a src.
  useEffect(() => {
    if (real || !playing) return;
    const t = window.setInterval(() => setPos((p) => p + 0.25), 250);
    return () => window.clearInterval(t);
  }, [real, playing]);
  useEffect(() => {
    if (!real && pos >= length) next(true);
  }, [real, pos, length, next]);

  // The real <audio>: follow play/pause, volume and mute.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (playing) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing, at, real]);
  useEffect(() => {
    if (!audio.current) return;
    audio.current.volume = volume;
    audio.current.muted = muted;
  }, [volume, muted, real]);

  const seek = (t: number) => {
    const x = Math.min(Math.max(0, t), length);
    if (audio.current) audio.current.currentTime = x;
    setPos(x);
  };
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (e.key === " " && el.tagName !== "BUTTON") setPlaying((p) => !p);
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && el.dataset.role !== "volume") seek(pos + (e.key === "ArrowRight" ? 5 : -5));
    else if (e.key === "m" || e.key === "M") setMuted((m) => !m);
    else return;
    e.preventDefault();
  };

  const body = (
    <>
      <div className="fl-media-head">
        <span className="fl-media-art" aria-hidden="true">
          {cur.artwork ? <img src={cur.artwork} alt="" /> : <Icon name="play" />}
        </span>
        <div className="fl-media-meta">
          <p className="fl-media-eyebrow">{cur.album ? `Now playing · ${cur.album}` : "Now playing"}</p>
          <p className="fl-media-title">{cur.title}</p>
          <p className="fl-media-artist">{cur.artist}</p>
        </div>
      </div>
      <label className="fl-media-seek">
        <span className="fl-sr">Position in the song</span>
        <input type="range" min={0} max={Math.round(length)} step={1} value={Math.min(Math.round(pos), Math.round(length))} onChange={(e) => seek(Number(e.target.value))} aria-valuetext={`${clock(pos)} of ${clock(length)}`} />
      </label>
      <p className="fl-media-times" aria-hidden="true">
        <span>{clock(pos)}</span>
        <span>-{clock(length - pos)}</span>
      </p>
      <div className="fl-media-row">
        <Ctl glass={glass} label="Previous song" icon="chevron-left" strength="subtle" tone={tone} onClick={() => (pos > 3 ? seek(0) : go(at - 1, playing))} />
        <Ctl glass={glass} big label={playing ? "Pause" : "Play"} icon={playing ? "pause" : "play"} strength={strength} tone={tone} onClick={() => setPlaying((p) => !p)} />
        <Ctl glass={glass} label="Next song" icon="chevron-right" strength="subtle" tone={tone} onClick={() => next(false)} />
        <Ctl glass={glass} label="Like" icon="heart" pressed={Boolean(liked[key])} strength="subtle" tone={tone} onClick={() => setLiked((l) => ({ ...l, [key]: !l[key] }))} />
      </div>
      <div className="fl-media-volume">
        <Ctl glass={glass} label={muted ? "Unmute" : "Mute"} icon={<Glyph d={muted || volume === 0 ? G.mute : G.volume} />} pressed={muted} strength="subtle" tone={tone} onClick={() => setMuted((m) => !m)} />
        <label className="fl-media-vol">
          <span className="fl-sr">Volume</span>
          <input type="range" data-role="volume" min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => (setVolume(Number(e.target.value) / 100), setMuted(false))} aria-valuetext={`${Math.round(volume * 100)} percent${muted ? ", muted" : ""}`} />
        </label>
      </div>
      {real ? (
        <audio
          ref={audio}
          src={cur.src}
          preload="metadata"
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)}
          onEnded={() => next(true)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      ) : null}
    </>
  );
  const shared = {
    "aria-label": `Now playing: ${cur.title} by ${cur.artist}`,
    "aria-keyshortcuts": "Space ArrowLeft ArrowRight M",
    tabIndex: 0,
    onKeyDown: onKey,
    "data-fl": "c.media-player.audio",
  };
  return glass ? (
    <GlassPanel as="section" strength={strength} tone={tone} className={`fl-media-audio ${className}`.trim()} {...shared}>
      {body}
    </GlassPanel>
  ) : (
    <section className={`fl-media-audio fl-media-card ${className}`.trim()} {...shared}>
      {body}
    </section>
  );
}

/* ── Video ──────────────────────────────────────────────────────────────────────────────────────────────── */

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const CLIP_SECONDS = 48;

/** One frame of the generated clip, drawn from the style's colors. */
function drawClip(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, colors: Record<string, [number, number, number]>, scenes: string[], length: number) {
  const rgba = (c: [number, number, number] | undefined, a: number) => (c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : `rgba(128,128,128,${a})`);
  ctx.fillStyle = rgba(colors.bg, 1);
  ctx.fillRect(0, 0, w, h);
  const blooms: [string, number, number][] = [
    ["accent", 0.25, 0.35],
    ["secondary", 0.75, 0.3],
    ["success", 0.55, 0.85],
    ["focus", 0.2, 0.9],
  ];
  blooms.forEach(([k, x, y], i) => {
    const cx = w * (x + 0.12 * Math.sin(t * 0.45 + i * 1.7));
    const cy = h * (y + 0.1 * Math.cos(t * 0.38 + i));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.42);
    g.addColorStop(0, rgba(colors[k], 0.95));
    g.addColorStop(1, rgba(colors[k], 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  ctx.strokeStyle = rgba(colors.text, 0.28);
  ctx.lineWidth = 10;
  const step = 38;
  const off = (t * 30) % step;
  for (let x = -h - step + off; x < w + h; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h * 0.47, 0);
    ctx.stroke();
  }
  const scene = scenes[Math.min(scenes.length - 1, Math.floor((t / length) * scenes.length))] ?? "";
  ctx.fillStyle = rgba(colors.text, 0.9);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(h * 0.34)}px system-ui, sans-serif`;
  ctx.fillText(scene, w / 2, h / 2 + Math.sin(t * 0.8) * 6);
  ctx.font = `600 ${Math.round(h * 0.05)}px ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.fillStyle = rgba(colors.text, 0.75);
  ctx.fillText(clock(t), w - 24, h * 0.08);
}

/**
 * A video with its controls on liquid glass over the picture. Without `src` it plays a clip generated from the style's
 * colors (`scenes` are the words it shows), so the controls can be tried anywhere.
 */
export function VideoPlayer({
  src,
  poster,
  title,
  tracks,
  scenes = ["DAWN", "TIDE", "DUSK"],
  strength = "regular",
  tone,
  label,
}: {
  src?: string;
  poster?: string;
  title?: string;
  tracks?: VideoTrack[];
  scenes?: string[];
  strength?: GlassStrength;
  tone?: GlassTone;
  /** Names the player for screen readers (defaults to the title). */
  label?: string;
}) {
  const generated = !src;
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gen = useRef({ t: 0, raf: 0, last: 0, shown: 0, colors: {} as Record<string, [number, number, number]> });
  const hideTimer = useRef(0);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(generated ? CLIP_SECONDS : 0);
  const [buffered, setBuffered] = useState(generated ? CLIP_SECONDS : 0);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(!generated);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [cc, setCc] = useState(() => (tracks ?? []).findIndex((x) => x.default));
  const [cue, setCue] = useState("");
  const [idle, setIdle] = useState(false);
  const [full, setFull] = useState(false);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [stream, setStream] = useState(true);
  /** The streamed <video> has shown a frame; until then the canvas itself stands in as the poster. */
  const [framed, setFramed] = useState(false);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const canFull = typeof document !== "undefined" && document.fullscreenEnabled;
  const canPip = typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled;
  const name = label ?? title ?? "Video";

  const now = () => (generated ? gen.current.t : (video.current?.currentTime ?? 0));
  const paint = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) drawClip(ctx, c.width, c.height, gen.current.t, gen.current.colors, scenes, CLIP_SECONDS);
  }, [scenes]);

  // The generated clip: colors from the tokens, the canvas streamed into the <video>.
  useEffect(() => {
    if (!generated) return;
    const c = canvas.current;
    const v = video.current;
    const r = root.current;
    if (!c || !v || !r) return;
    const read = () => {
      gen.current.colors = {
        bg: resolveColor(r, "var(--color-bg)"),
        text: resolveColor(r, "var(--color-text)"),
        accent: resolveColor(r, "var(--color-accent)"),
        secondary: resolveColor(r, "var(--color-secondary, var(--color-accent))"),
        success: resolveColor(r, "var(--color-success)"),
        focus: resolveColor(r, "var(--color-focus, var(--color-accent))"),
      };
      paint();
    };
    c.width = 960;
    c.height = 540;
    read();
    let ms: MediaStream | null = null;
    if (typeof c.captureStream === "function") {
      ms = c.captureStream(30);
      v.srcObject = ms;
      setStream(true);
    } else setStream(false);
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", read);
    const g = gen.current;
    return () => {
      scheme.removeEventListener("change", read);
      cancelAnimationFrame(g.raf);
      ms?.getTracks().forEach((tr) => tr.stop());
      v.srcObject = null;
    };
  }, [generated, paint]);

  const pause = useCallback(() => {
    // The generated clip pauses its own clock; the <video> keeps showing the stream, so a seek while paused is seen.
    if (generated) {
      cancelAnimationFrame(gen.current.raf);
      setPlaying(false);
    } else video.current?.pause();
  }, [generated]);

  const play = useCallback(() => {
    setError("");
    if (generated) {
      const g = gen.current;
      if (g.t >= CLIP_SECONDS) g.t = 0;
      cancelAnimationFrame(g.raf);
      g.last = performance.now();
      const tick = (time: number) => {
        g.t = Math.min(CLIP_SECONDS, g.t + ((time - g.last) / 1000) * rateRef.current);
        g.last = time;
        paint();
        if (time - g.shown > 66) {
          g.shown = time;
          setT(g.t);
        }
        if (g.t >= CLIP_SECONDS) {
          setT(g.t);
          setPlaying(false);
          return;
        }
        g.raf = requestAnimationFrame(tick);
      };
      g.raf = requestAnimationFrame(tick);
      if (video.current && stream) void video.current.play().catch(() => {});
      setPlaying(true);
    } else {
      void video.current?.play().catch(() => setError("This video can't be played here."));
    }
  }, [generated, paint, stream]);

  const toggle = () => (playingRef.current ? pause() : play());
  const seek = (x: number) => {
    const to = Math.min(Math.max(0, x), dur || 0);
    if (generated) {
      gen.current.t = to;
      paint();
      setT(to);
    } else if (video.current) video.current.currentTime = to;
  };

  // Volume, mute and speed on the element (the generated clip has no sound, but keeps the settings).
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
    if (!generated) v.playbackRate = rate;
  }, [volume, muted, rate, generated]);

  // Captions: cues given inline, or a WebVTT track the browser parses (hidden, drawn by the player).
  useEffect(() => {
    const tr = cc >= 0 ? tracks?.[cc] : undefined;
    if (!tr) return setCue("");
    if (tr.cues) {
      setCue(tr.cues.find((c) => t >= c.start && t < c.end)?.text ?? "");
      return;
    }
  }, [cc, t, tracks]);
  useEffect(() => {
    const v = video.current;
    if (!v || generated) return;
    const list = [...v.textTracks];
    list.forEach((tt, i) => (tt.mode = i === cc && !tracks?.[i]?.cues ? "hidden" : "disabled"));
    const tt = list[cc];
    if (!tt || tracks?.[cc]?.cues) return;
    const on = () => setCue([...(tt.activeCues ?? [])].map((c) => (c as VTTCue).text).join("\n"));
    tt.addEventListener("cuechange", on);
    return () => tt.removeEventListener("cuechange", on);
  }, [cc, generated, tracks]);

  // The controls hide 2.5 s after the last movement while playing (never while focus is on one of them).
  const poke = useCallback(() => {
    setIdle(false);
    window.clearTimeout(hideTimer.current);
    if (!playingRef.current) return;
    hideTimer.current = window.setTimeout(() => {
      const chrome = root.current?.querySelector(".fl-media-chrome");
      if (playingRef.current && !chrome?.contains(document.activeElement)) setIdle(true);
    }, 2500);
  }, []);
  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, [playing, poke]);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? void document.exitFullscreen() : void root.current?.requestFullscreen?.().catch(() => {}));
  const togglePip = () => {
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void video.current?.requestPictureInPicture?.().catch(() => {});
  };
  const changeVolume = (v: number) => {
    setVolume(Math.min(1, Math.max(0, Math.round(v * 100) / 100)));
    setMuted(false);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    poke();
    const el = e.target as HTMLElement;
    const tag = el.tagName;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === " " && (tag === "BUTTON" || tag === "SELECT")) return;
    if ((k === "ArrowUp" || k === "ArrowDown") && tag === "SELECT") return;
    if ((k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") && el.dataset.role === "volume") return;
    if (k === " " || k === "k") toggle();
    else if (k === "j" || k === "l") seek(now() + (k === "l" ? 10 : -10));
    else if (k === "ArrowLeft" || k === "ArrowRight") seek(now() + (k === "ArrowRight" ? 5 : -5));
    else if (k === "ArrowUp" || k === "ArrowDown") changeVolume(volume + (k === "ArrowUp" ? 0.1 : -0.1));
    else if (k === "m") setMuted((m) => !m);
    else if (k === "f" && canFull) toggleFull();
    else if (k === "c" && tracks?.length) setCc((c) => (c >= 0 ? -1 : 0));
    else return;
    e.preventDefault();
  };

  const onScrubMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover({ x: f * r.width, t: f * (dur || 0) });
  };

  const pct = (x: number) => `${dur ? Math.min(100, (x / dur) * 100) : 0}%`;
  const hidden = idle && playing;
  const vol = muted || volume === 0;
  return (
    <div
      ref={root}
      className={`fl-media-video${full ? " fl-media-video--full" : ""}`}
      data-idle={hidden ? "" : undefined}
      data-fl="c.media-player.video"
      role="region"
      aria-label={`${name}: video player`}
      aria-keyshortcuts="Space K J L ArrowLeft ArrowRight ArrowUp ArrowDown M F C"
      tabIndex={0}
      onKeyDown={onKey}
      onPointerMove={poke}
      onFocus={poke}
    >
      <video
        ref={video}
        className="fl-media-picture"
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        hidden={generated && !(stream && framed)}
        onLoadedData={() => generated && setFramed(true)}
        onTimeUpdate={(e) => !generated && setT(e.currentTarget.currentTime)}
        onDurationChange={(e) => !generated && Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)}
        onProgress={(e) => {
          if (generated) return;
          const v = e.currentTarget;
          for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 0.5) setBuffered(v.buffered.end(i));
        }}
        onWaiting={() => !generated && setWaiting(true)}
        onCanPlay={() => !generated && setWaiting(false)}
        onPlaying={() => !generated && setWaiting(false)}
        onPlay={() => !generated && setPlaying(true)}
        onPause={() => !generated && setPlaying(false)}
        onEnded={() => !generated && setPlaying(false)}
        onError={() => !generated && (setError("This video can't be played here."), setWaiting(false))}
      >
        {!generated
          ? tracks
              ?.filter((tr) => tr.src)
              .map((tr) => <track key={tr.srclang + tr.label} kind="subtitles" src={tr.src} srcLang={tr.srclang} label={tr.label} />)
          : null}
      </video>
      {generated ? <canvas ref={canvas} className="fl-media-picture" hidden={stream && framed} aria-hidden="true" /> : null}
      {/* Clicking the picture plays and pauses, as on every video site; the keyboard has Space and the buttons. */}
      <div className="fl-media-hit" aria-hidden="true" onClick={toggle} />
      {cue ? (
        <p className="fl-media-cue" aria-live="off">
          {cue}
        </p>
      ) : null}
      {waiting && !error ? (
        <div className="fl-media-state" role="status">
          <span className="fl-media-spinner" aria-hidden="true" />
          <span className="fl-sr">Loading the video</span>
        </div>
      ) : null}
      {error ? (
        <div className="fl-media-state" role="alert">
          <GlassPanel strength={strength} tone={tone} className="fl-media-error">
            <p>{error}</p>
            <button type="button" className="fl-media-retry" onClick={() => (setError(""), setWaiting(true), video.current?.load())}>
              Try again
            </button>
          </GlassPanel>
        </div>
      ) : null}
      <div className="fl-media-chrome">
        {title ? (
          <GlassPanel strength="subtle" tone={tone} className="fl-media-overlay-title fl-media-fade">
            <p>{title}</p>
          </GlassPanel>
        ) : null}
        {!playing && !waiting && !error ? (
          <div className="fl-media-center">
            <GlassButton variant="round" label={`Play ${title ?? "the video"}`} icon="play" strength={strength} tone={tone} className="fl-media-huge" onClick={play} />
          </div>
        ) : null}
        <GlassPanel strength={strength} tone={tone} className="fl-media-bar fl-media-fade" role="group" aria-label="Video controls">
          <div className="fl-media-scrub" onPointerMove={onScrubMove} onPointerLeave={() => setHover(null)} style={{ "--fl-media-pos": pct(t), "--fl-media-buf": pct(buffered) } as CSSProperties}>
            <span className="fl-media-rail" aria-hidden="true">
              <span className="fl-media-buffered" />
              <span className="fl-media-played" />
            </span>
            <input type="range" aria-label="Seek" min={0} max={Math.max(1, Math.round(dur))} step={1} value={Math.round(t)} onChange={(e) => seek(Number(e.target.value))} aria-valuetext={`${clock(t)} of ${clock(dur)}`} />
            {hover ? (
              <span className="fl-media-tip" aria-hidden="true" style={{ "--fl-media-x": `${hover.x}px` } as CSSProperties}>
                {clock(hover.t)}
              </span>
            ) : null}
          </div>
          <div className="fl-media-controls">
            <div className="fl-media-group">
              <button type="button" className="fl-media-ctl" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
                <Icon name={playing ? "pause" : "play"} />
              </button>
              <button type="button" className="fl-media-ctl" aria-label="Back 10 seconds" onClick={() => seek(now() - 10)}>
                <Glyph d={G.back} text="10" />
              </button>
              <button type="button" className="fl-media-ctl" aria-label="Forward 10 seconds" onClick={() => seek(now() + 10)}>
                <Glyph d={G.forward} text="10" />
              </button>
              <span className="fl-media-time">
                {clock(t)} / {clock(dur)}
              </span>
            </div>
            <div className="fl-media-group">
              <button type="button" className="fl-media-ctl" aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
                <Glyph d={vol ? G.mute : G.volume} />
              </button>
              <label className="fl-media-vol fl-media-vol--bar">
                <span className="fl-sr">Volume</span>
                <input type="range" data-role="volume" min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => changeVolume(Number(e.target.value) / 100)} aria-valuetext={`${Math.round(volume * 100)} percent${muted ? ", muted" : ""}`} />
              </label>
              {tracks?.length ? (
                <button type="button" className="fl-media-ctl" aria-label="Captions" aria-pressed={cc >= 0} onClick={() => setCc((c) => (c >= 0 ? -1 : 0))}>
                  <Glyph d={G.captions} />
                </button>
              ) : null}
              <span className="fl-media-select">
                <select aria-label="Playback speed" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                  {RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}×
                    </option>
                  ))}
                </select>
              </span>
              {canPip && stream ? (
                <button type="button" className="fl-media-ctl" aria-label="Picture in picture" onClick={togglePip}>
                  <Glyph d={G.pip} />
                </button>
              ) : null}
              {canFull ? (
                <button type="button" className="fl-media-ctl" aria-label={full ? "Exit full screen" : "Full screen"} onClick={toggleFull}>
                  <Glyph d={full ? G.exitFull : G.full} />
                </button>
              ) : null}
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  tracks: [
    { title: "Northern Lights Over Tromsø", artist: "Ola Haugen Quartet", album: "Polar Hours", duration: 274 },
    { title: "Saltwater Hymn", artist: "Maren Solvik", album: "Lowtide", duration: 221 },
    { title: "Night Ferry to Bergen", artist: "The Fjord Sessions", album: "Crossings", duration: 309 },
  ] as MediaTrack[],
  podcast: [
    { title: "Episode 41: Building a kiln in the yard", artist: "The Clay Hour", album: "Season 3", duration: 2312 },
    { title: "Episode 42: Glazes that behave", artist: "The Clay Hour", album: "Season 3", duration: 2087 },
  ] as MediaTrack[],
  video: {
    title: "Harbor at dawn",
    scenes: ["DAWN", "TIDE", "DUSK"],
    tracks: [
      {
        label: "English",
        srclang: "en",
        cues: [
          { start: 1, end: 6, text: "The first ferry leaves at a quarter past six." },
          { start: 8, end: 14, text: "By seven the fish market is already loud." },
          { start: 17, end: 24, text: "At high tide the whole quay goes quiet." },
          { start: 27, end: 33, text: "Boats come in one by one as the light changes." },
          { start: 36, end: 44, text: "And by dusk, the harbor belongs to the gulls." },
        ],
      },
    ] as VideoTrack[],
  },
};

function Note({ children }: { children: ReactNode }) {
  return <p className="fl-ctl-btn-what">{children}</p>;
}

export default function MediaPlayerSheet() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <GlassFilter />
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Audio player on glass</h3>
        <Note>Over a picture or gradient. Space plays and pauses, ← → jump 5 seconds and M mutes, with focus anywhere in the card. Previous restarts the song after 3 seconds.</Note>
        <GlassStage word="PLAY" className="fl-media-stage">
          <AudioPlayer track={d.tracks[0]!} queue={d.tracks} start={96} />
        </GlassStage>
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Audio player, plain</h3>
        <Note>The same player on the surface, for designs without glass (glass=&#123;false&#125;).</Note>
        <AudioPlayer track={d.podcast[0]!} queue={d.podcast} glass={false} />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Video player</h3>
        <Note>
          A clip drawn from the style's colors, so nothing is downloaded. Space or K plays, J / L jump 10 seconds, ← → 5, ↑ ↓ volume, M mute, F full screen, C captions. While it plays the controls slide away after a moment and come back when you move the pointer or press a key.
        </Note>
        <VideoPlayer title={d.video.title} scenes={d.video.scenes} tracks={d.video.tracks} />
      </div>
    </section>
  );
}
