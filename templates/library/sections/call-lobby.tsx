/** @flowcode-library call-lobby · Call lobby (Forms)
 * Catalog ID: p.call-lobby (pattern)
 * Function: Call lobby (p.call-lobby): the check before joining a video call: a preview tile that shows you (or your initials with the camera off), camera and microphone toggles with a live mic level, a blur switch, camera, microphone and speaker choices with a speaker test, your display name (required), who is already in the call, and Join, which asks the host and waits (Cancel), then lets you in or says you were not admitted with Ask again.
 * Use it as: import { CallLobby } from "./call-lobby"; <CallLobby title when? host present={[{ name, tone? }]} devices={{ camera: [{ id, label }], mic: [...], speaker: [...] }} name? requireApproval? join?={async ({ name, camera, mic, devices }) => "admitted" | "denied"} onLeave?={() => ...} labels?={{ join, cancel, again, leave, ... }} />
 * Built from: c.text-field.outlined, c.select.outlined, c.switch, c.button.primary, c.button.secondary, c.button.tertiary, c.avatar.person, c.avatar-stack
 * Look: A white card in two columns: on the left a wide rounded preview tile (a soft moving wash with your name tag while the camera is on, or a large initials avatar on a dark tile while it is off) with round camera and microphone buttons over its bottom edge and a small level meter beside the mic; on the right the meeting name and time, a row of faces already in the call, your name field, three device dropdowns with a Test button by the speaker, and a full-width Join button. Asking to join swaps the button for a waiting line with a spinner and Cancel; once in, a green "You're in" banner with Leave.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --radius-md --radius-lg --text-xs --text-sm --text-lg --text-xl --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: video call lobby; meeting pre-join; telehealth waiting room; webinar join; interview call; classroom call; support video call
 * Jobs to be done: check how I look and sound before joining; pick the right microphone and speaker; join with my camera off; ask the host to let me in; see who is already in the call
 * Keywords: video call, meeting, lobby, pre-join, camera, microphone, speaker, devices, waiting room, join, mute
 */
/**
 * Call lobby: everything a person checks before a video call, without touching real media. The tile, the level meter
 * and the speaker test are stand-ins: connect them to the app's own media code (getUserMedia, a device list, an audio
 * element) where marked. Camera and microphone are toggle buttons (aria-pressed; Space or
 * Enter). The name is required. Join calls `join`, which resolves "admitted" or "denied"; while it waits the person can
 * Cancel. Make it the app's own: pass the meeting, the people present and the real device lists, and start the call in
 * `join`.
 * Adapted from Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): the two-column layout of its modal and contact
 * blocks (media on one side, the form on the other).
 */
/**
 * How to try it
 * - Press the camera button: the tile switches to your initials; press it again to come back. Blur is only offered
 *   with the camera on.
 * - Press the microphone button: the level meter stops and the button reads Unmute.
 * - Pick another speaker and press Test: it plays for two seconds.
 * - Clear your name and press Join: the field says it is needed. Type a name and Join: it waits for the host; Cancel
 *   stops it. Join again: the first try is not admitted, press Ask again and you are in. Leave takes you back.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's Button, TextField, Switch, Avatar and
 * AvatarStack ("./buttons-variants", "./text-fields-states", "./switches-states", "./avatars-variants") and its inline
 * icon set ("./icons"). Nothing else: no package, no camera or microphone access and nothing fetched. The styles are the
 * library's own fl- classes in templates/library/css/r4a-call-lobby.css.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Avatar, AvatarStack, type AvatarTone } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── p.call-lobby: preview, devices, name and a join that waits for the host. ──

export type LobbyDevice = { id: string; label: string };
export type LobbyDevices = { camera: LobbyDevice[]; mic: LobbyDevice[]; speaker: LobbyDevice[] };
export type LobbyChoice = { name: string; camera: boolean; mic: boolean; blur: boolean; devices: { camera?: string; mic?: string; speaker?: string } };

export type CallLobbyLabels = Partial<{
  join: string;
  cancel: string;
  again: string;
  leave: string;
  name: string;
  camera: string;
  mic: string;
  speaker: string;
  test: string;
  testing: string;
  blur: string;
}>;

export type CallLobbyProps = {
  title: string;
  /** When it runs, as words: "Today, 10:30 – 11:00 AM". */
  when?: string;
  host: string;
  present: Array<{ name: string; tone?: AvatarTone }>;
  devices: LobbyDevices;
  /** The name filled in at first. */
  name?: string;
  /** The host lets people in; Join says "Asking to join". */
  requireApproval?: boolean;
  /** Starts joining; resolve "admitted" or "denied", throw for a connection error. Admits after a moment when left out. */
  join?: (choice: LobbyChoice) => Promise<"admitted" | "denied">;
  onLeave?: () => void;
  labels?: CallLobbyLabels;
};

type Phase = "ready" | "asking" | "in" | "denied" | "error";
const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));

const GLYPHS: Record<string, string> = {
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  "video-off": "M3 3l18 18M8 7h7v7M15 10l6-3v10l-6-3M3 7h2v10h10",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  "mic-off": "M3 3l18 18M9 9v3a3 3 0 0 0 5 2.2M15 10V6a3 3 0 0 0-6-.8M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.6 2.8M12 18v3",
  speaker: "M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11",
};
function Glyph({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

export function CallLobby({ title, when, host, present, devices, name: nameProp = "", requireApproval = true, join, onLeave, labels = {} }: CallLobbyProps) {
  const l = {
    join: requireApproval ? "Ask to join" : "Join now",
    cancel: "Cancel",
    again: "Ask again",
    leave: "Leave call",
    name: "Your name",
    camera: "Camera",
    mic: "Microphone",
    speaker: "Speaker",
    test: "Test",
    testing: "Playing…",
    blur: "Blur my background",
    ...labels,
  };
  const id = useId();
  const [name, setName] = useState(nameProp);
  const [touched, setTouched] = useState(false);
  const [camera, setCamera] = useState(devices.camera.length > 0);
  const [mic, setMic] = useState(devices.mic.length > 0);
  const [blur, setBlur] = useState(false);
  const [pick, setPick] = useState({ camera: devices.camera[0]?.id ?? "", mic: devices.mic[0]?.id ?? "", speaker: devices.speaker[0]?.id ?? "" });
  const [testing, setTesting] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [status, setStatus] = useState("");
  const attempt = useRef(0);

  const nameError = touched && !name.trim() ? "Add the name others will see." : "";
  const label = (kind: keyof LobbyDevices) => devices[kind].find((d) => d.id === pick[kind])?.label ?? "";

  useEffect(() => {
    if (!testing) return;
    // Stand-in for playing a test sound on the chosen speaker.
    const t = window.setTimeout(() => {
      setTesting(false);
      setStatus("Test sound finished.");
    }, 2000);
    return () => window.clearTimeout(t);
  }, [testing]);

  const doJoin = async () => {
    setTouched(true);
    if (!name.trim()) {
      document.getElementById(`${id}-name`)?.focus();
      setStatus("Add your name first.");
      return;
    }
    attempt.current += 1;
    const mine = attempt.current;
    setPhase("asking");
    setStatus(requireApproval ? `Asking ${host} to let you in…` : "Joining…");
    try {
      const result = join ? await join({ name: name.trim(), camera, mic, blur, devices: pick }) : await wait(1200).then(() => "admitted" as const);
      if (attempt.current !== mine) return; // cancelled meanwhile
      setPhase(result === "admitted" ? "in" : "denied");
      setStatus(result === "admitted" ? `You're in ${title}.` : `${host} didn't let you in.`);
      window.setTimeout(() => document.getElementById(`${id}-${result === "admitted" ? "leave" : "join"}`)?.focus(), 30);
    } catch {
      if (attempt.current !== mine) return;
      setPhase("error");
      setStatus("Couldn't connect to the call.");
      window.setTimeout(() => document.getElementById(`${id}-join`)?.focus(), 30);
    }
  };
  const cancel = () => {
    attempt.current += 1;
    setPhase("ready");
    setStatus("Request cancelled.");
    window.setTimeout(() => document.getElementById(`${id}-join`)?.focus(), 30);
  };

  const select = (kind: keyof LobbyDevices, text: string) => (
    <div className="fl-lobby-field">
      <label htmlFor={`${id}-${kind}`}>{text}</label>
      <div className="fl-lobby-device">
        <span className="fl-ctl-select">
          <select
            id={`${id}-${kind}`}
            className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40"
            value={pick[kind]}
            disabled={!devices[kind].length || phase === "asking" || phase === "in"}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setPick((p) => ({ ...p, [kind]: v }));
              setStatus(`${text}: ${devices[kind].find((d) => d.id === v)?.label ?? ""}.`);
            }}
          >
            {devices[kind].length ? (
              devices[kind].map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))
            ) : (
              <option value="">None found</option>
            )}
          </select>
          <Icon name="chevron-down" />
        </span>
        {kind === "speaker" ? (
          <Button
            variant="secondary"
            size={40}
            className="fl-lobby-test"
            disabled={!devices.speaker.length}
            aria-pressed={testing}
            onClick={() => {
              setTesting((t) => !t);
              setStatus(testing ? "Test stopped." : `Playing a test sound on ${label("speaker")}.`);
            }}
          >
            {testing ? l.testing : l.test}
          </Button>
        ) : null}
      </div>
    </div>
  );

  const locked = phase === "asking" || phase === "in";

  return (
    <section className={`fl-lobby is-${phase}`} aria-labelledby={`${id}-title`} data-fl="p.call-lobby">
      <div className="fl-lobby-grid">
      <div className="fl-lobby-stage">
        <div className={["fl-lobby-tile", camera ? "is-camera" : "", blur && camera ? "is-blur" : ""].filter(Boolean).join(" ")} role="img" aria-label={camera ? `Your camera preview${blur ? ", background blurred" : ""}` : "Camera off"}>
          {/* Stand-in for the camera's video element. */}
          {camera ? <span className="fl-lobby-wash" aria-hidden="true" /> : <Avatar name={name.trim() || "You"} size={96} tone="b" decorative />}
          <span className="fl-lobby-tag" aria-hidden="true">
            {name.trim() || "You"}
            {mic ? null : <Glyph name="mic-off" />}
          </span>
          {phase === "in" ? <span className="fl-lobby-live">Live</span> : null}
        </div>
        <div className="fl-lobby-controls">
          <button
            type="button"
            className={mic ? "fl-lobby-round" : "fl-lobby-round is-off"}
            aria-pressed={!mic}
            aria-label={mic ? "Mute microphone" : "Unmute microphone"}
            title={mic ? "Mute" : "Unmute"}
            disabled={!devices.mic.length}
            onClick={() => {
              setMic((m) => !m);
              setStatus(mic ? "Microphone off." : "Microphone on.");
            }}
          >
            <Glyph name={mic ? "mic" : "mic-off"} />
          </button>
          <button
            type="button"
            className={camera ? "fl-lobby-round" : "fl-lobby-round is-off"}
            aria-pressed={!camera}
            aria-label={camera ? "Turn camera off" : "Turn camera on"}
            title={camera ? "Camera off" : "Camera on"}
            disabled={!devices.camera.length}
            onClick={() => {
              setCamera((c) => !c);
              setStatus(camera ? "Camera off." : "Camera on.");
            }}
          >
            <Glyph name={camera ? "video" : "video-off"} />
          </button>
          {/* Stand-in for a level read from the microphone's audio. */}
          <span className={mic ? "fl-lobby-meter is-on" : "fl-lobby-meter"} role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={mic ? 40 : 0}>
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>
        <label className="fl-lobby-blur">
          <Switch size={20} on={blur && camera} disabled={!camera} label={l.blur} onToggle={(v) => setBlur(v)} />
          <span aria-hidden="true">{l.blur}</span>
        </label>
      </div>

      <div className="fl-lobby-side">
        <header className="fl-lobby-head">
          <h2 id={`${id}-title`}>{title}</h2>
          {when ? (
            <p>
              <Icon name="clock" />
              {when}
            </p>
          ) : null}
        </header>
        <div className="fl-lobby-here">
          {present.length ? (
            <>
              <AvatarStack people={present} max={4} size={32} label={`${present.length} in the call`} />
              <p>
                {present.length === 1 ? `${present[0]!.name} is` : `${present[0]!.name} and ${present.length - 1} ${present.length === 2 ? "other is" : "others are"}`} in the call
              </p>
            </>
          ) : (
            <p>No one else is here yet.</p>
          )}
        </div>

        {phase === "in" ? (
          <div className="fl-lobby-in" role="group" aria-label="In the call">
            <p className="fl-lobby-banner">
              <Icon name="check" />
              You're in, as {name.trim()}
            </p>
            <p className="fl-lobby-small">
              {camera ? "Camera on" : "Camera off"} · {mic ? "Mic on" : "Muted"} · {label("speaker") || "No speaker"}
            </p>
            <Button
              id={`${id}-leave`}
              variant="destructive"
              size={44}
              block
              onClick={() => {
                setPhase("ready");
                setStatus("You left the call.");
                onLeave?.();
                window.setTimeout(() => document.getElementById(`${id}-join`)?.focus(), 30);
              }}
            >
              {l.leave}
            </Button>
          </div>
        ) : (
          <form
            className="fl-lobby-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (phase !== "asking") void doJoin();
            }}
          >
            <div className="fl-lobby-field">
              <label htmlFor={`${id}-name`}>{l.name}</label>
              <TextField
                id={`${id}-name`}
                size={40}
                value={name}
                autoComplete="name"
                maxLength={60}
                disabled={locked}
                invalid={Boolean(nameError)}
                aria-describedby={nameError ? `${id}-name-err` : undefined}
                onChange={(e) => setName(e.currentTarget.value)}
                onBlur={() => setTouched(true)}
              />
              {nameError ? (
                <p id={`${id}-name-err`} className="fl-lobby-err">
                  {nameError}
                </p>
              ) : null}
            </div>
            {select("camera", l.camera)}
            {select("mic", l.mic)}
            {select("speaker", l.speaker)}

            {phase === "denied" || phase === "error" ? (
              <p className="fl-lobby-err fl-lobby-alert" role="alert">
                <Icon name="alert" />
                {phase === "denied" ? `${host} didn't let you in this time.` : "Couldn't connect. Check your connection."}
              </p>
            ) : null}

            {phase === "asking" ? (
              <div className="fl-lobby-wait">
                <span className="fl-ctl-spinner" aria-hidden="true" />
                <span>{requireApproval ? `Waiting for ${host} to let you in…` : "Joining…"}</span>
                <Button variant="tertiary" size={32} onClick={cancel}>
                  {l.cancel}
                </Button>
              </div>
            ) : (
              <Button id={`${id}-join`} type="submit" variant="primary" size={44} icon="arrow" iconAt="end" block>
                {phase === "denied" || phase === "error" ? l.again : l.join}
              </Button>
            )}
          </form>
        )}
      </div>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Autumn launch: weekly check-in",
  when: "Today, 10:30 – 11:00 AM",
  host: "Marcus",
  name: "Ana Ruiz",
  present: [
    { name: "Marcus Bell", tone: "e" },
    { name: "Maya Chen", tone: "b" },
    { name: "Leo Park", tone: "c" },
  ] as Array<{ name: string; tone?: AvatarTone }>,
  devices: {
    camera: [
      { id: "cam-built-in", label: "FaceTime HD Camera" },
      { id: "cam-usb", label: "Logitech C920" },
    ],
    mic: [
      { id: "mic-built-in", label: "MacBook Pro Microphone" },
      { id: "mic-headset", label: "AirPods Pro" },
    ],
    speaker: [
      { id: "spk-built-in", label: "MacBook Pro Speakers" },
      { id: "spk-headset", label: "AirPods Pro" },
    ],
  } as LobbyDevices,
};

export default function CallLobbySheet() {
  const tries = useRef(0);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Call lobby">
      <div className="fl-wrap">
        <CallLobby
          {...SAMPLE}
          join={async () => {
            await wait(1600);
            tries.current += 1;
            // The first request is turned down, so Ask again can be seen.
            return tries.current === 1 ? "denied" : "admitted";
          }}
        />
      </div>
    </section>
  );
}
