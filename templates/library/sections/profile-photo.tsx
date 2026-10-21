/** @flowcode-library profile-photo · Profile photo (Forms)
 * Catalog ID: p.profile-photo (pattern)
 * Function: Profile photo (p.profile-photo): upload a picture (button, drag and drop or a sample), frame it on a square crop stage with a round guide (drag or arrow keys to move, slider, buttons, + and - or the wheel to zoom, rotate, reset), see live previews at three sizes, and save a cropped square made locally on a canvas; wrong type and too-large files are explained, saving shows a working state and errors, and Remove asks first.
 * Use it as: import { ProfilePhoto } from "./profile-photo"; <ProfilePhoto title lede? name="Ana Ruiz" photo?={dataUrl | null} maxBytes?={5_000_000} outputSize?={256} sample?={async () => Blob} onSave?={async (dataUrl) => void} onRemove?={async () => void} labels?={{ upload, drop, save, remove, ... }} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.modal.danger, c.slider
 * Look: A white card with the title and a line of help; at the left the current round photo (or initials on an accent tint) with Upload and Remove; at the right a dashed drop area that turns into a square stage with the photo under a dimmed frame and a round cut-out, a zoom row (minus, slider, plus, a percent), Rotate and Reset, three round previews in a sunken strip, then Cancel and Save photo.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: profile photo; avatar upload; account picture; team member photo; profile settings; crop picture; company logo upload
 * Jobs to be done: add a picture of myself to my account; crop and zoom my photo so my face is centered; see how my photo looks small before saving it; remove my photo
 * Keywords: avatar, profile photo, profile picture, upload, crop, zoom, rotate, image, drag and drop, account
 */
/**
 * Profile photo: upload, frame and save a round account picture without leaving the page. Nothing is sent anywhere:
 * the file is read locally, framed on a square stage and drawn to a canvas, and onSave gets a square PNG data URL
 * at outputSize. The stage is a focusable group: drag or use the arrow keys to move the photo, + and - to zoom,
 * R to rotate and 0 to reset; the photo always covers the frame, so there are never empty corners.
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its profile page's photo card, and TailGrids (MIT,
 * Copyright (c) 2025 Tailgrids): its avatar and slider components.
 */
/**
 * How to try it
 * - Press Try a sample (or Upload photo with any picture, or drop one on the dashed area): the crop stage opens.
 * - Drag the photo, or focus the stage and use the arrow keys (Shift moves further), + and -, R and 0. The three
 *   previews follow along.
 * - Drop a text file, or a picture over 5 MB: the message under the area says why and the area shakes.
 * - Save photo: it works for a moment, then the round photo at the left changes and a saved line shows.
 *   Remove asks first and puts the initials back.
 *
 * Dependencies: React (useCallback, useEffect, useId, useRef, useState), the library's Button and Modal
 * ("./buttons-variants", "./modals-dialogs") and its inline icon set ("./icons"). Canvas and FileReader from the
 * browser. Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r4d-profile-photo.css.
 */
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";

// ── p.profile-photo: upload, crop and zoom a round account picture. ──

export type ProfilePhotoLabels = Partial<{
  upload: string;
  replace: string;
  remove: string;
  drop: string;
  dropHint: string;
  sample: string;
  reading: string;
  stage: string;
  stageHint: string;
  zoom: string;
  zoomIn: string;
  zoomOut: string;
  rotate: string;
  reset: string;
  preview: string;
  cancel: string;
  save: string;
  saving: string;
  saved: string;
  removed: string;
  failed: string;
  badType: string;
  tooBig: string;
  unreadable: string;
  removeTitle: string;
  removeText: string;
}>;

export type ProfilePhotoProps = {
  title: string;
  lede?: string;
  /** The person's name, for the initials and the picture's alt text. */
  name: string;
  /** The current picture as any image URL (a data URL from onSave works); null or left out for initials. */
  photo?: string | null;
  /** Largest file accepted, in bytes; 5 MB when left out. */
  maxBytes?: number;
  /** Width and height of the saved square, in px; 256 when left out. */
  outputSize?: number;
  /** When given, a Try a sample button loads this picture into the crop stage. */
  sample?: () => Promise<Blob>;
  /** Stores the cropped square (a PNG data URL). Throw to show an error. */
  onSave?: (dataUrl: string) => Promise<void>;
  /** Clears the stored picture. Throw to show an error. */
  onRemove?: () => Promise<void>;
  labels?: ProfilePhotoLabels;
};

type Crop = { zoom: number; x: number; y: number; turn: number };
const START: Crop = { zoom: 1, x: 0, y: 0, turn: 0 };
const ZOOM_MAX = 3;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const PREVIEWS = [96, 56, 32];
const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** The image's width and height once turned. */
const turned = (img: HTMLImageElement, turn: number) => (turn % 2 ? { w: img.naturalHeight, h: img.naturalWidth } : { w: img.naturalWidth, h: img.naturalHeight });

/** How far the center may move (as a share of the frame) and still cover it. */
function limits(img: HTMLImageElement, c: Crop) {
  const { w, h } = turned(img, c.turn);
  const short = Math.min(w, h);
  return { x: Math.max(0, ((c.zoom * w) / short - 1) / 2), y: Math.max(0, ((c.zoom * h) / short - 1) / 2) };
}
function clamp(img: HTMLImageElement, c: Crop): Crop {
  const zoom = Math.min(ZOOM_MAX, Math.max(1, c.zoom));
  const lim = limits(img, { ...c, zoom });
  return { ...c, zoom, x: Math.min(lim.x, Math.max(-lim.x, c.x)), y: Math.min(lim.y, Math.max(-lim.y, c.y)) };
}

/** Draws the framed square at `size` px; the previews and the saved picture share this. */
function draw(canvas: HTMLCanvasElement, img: HTMLImageElement, c: Crop, size: number) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.round(size * ratio);
  if (canvas.width !== px) canvas.width = px;
  if (canvas.height !== px) canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { w, h } = turned(img, c.turn);
  const scale = (px / Math.min(w, h)) * c.zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(px / 2 + c.x * px, px / 2 + c.y * px);
  ctx.rotate((c.turn * Math.PI) / 2);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
}

export function ProfilePhoto({ title, lede, name, photo = null, maxBytes = 5_000_000, outputSize = 256, sample, onSave, onRemove, labels = {} }: ProfilePhotoProps) {
  const l = {
    upload: "Upload photo",
    replace: "Replace",
    remove: "Remove",
    drop: "Drop a photo here",
    dropHint: "PNG, JPG, WebP or GIF, up to {max}",
    sample: "Try a sample",
    reading: "Opening the photo…",
    stage: "Photo framing",
    stageHint: "Drag or use the arrow keys to move. + and - zoom, R rotates, 0 resets.",
    zoom: "Zoom",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    rotate: "Rotate",
    reset: "Reset",
    preview: "Preview",
    cancel: "Cancel",
    save: "Save photo",
    saving: "Saving…",
    saved: "Photo saved.",
    removed: "Photo removed.",
    failed: "Couldn't save the photo. Try again.",
    badType: "That file isn't a picture. Use PNG, JPG, WebP or GIF.",
    tooBig: "That picture is over {max}. Pick a smaller one.",
    unreadable: "Couldn't open that picture. Try another one.",
    removeTitle: "Remove your photo?",
    removeText: "Your initials show instead until you add a new one.",
    ...labels,
  };
  const id = useId();
  const maxText = `${Math.round(maxBytes / 1_000_000)} MB`;
  const [current, setCurrent] = useState<string | null>(photo);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>(START);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const previews = useRef<(HTMLCanvasElement | null)[]>([]);
  const drag = useRef<{ x: number; y: number; from: Crop } | null>(null);
  const uploadBtn = useRef<HTMLButtonElement>(null);

  const fail = (msg: string) => {
    setError(msg);
    setShake((n) => n + 1);
  };

  const open = useCallback(
    (blob: Blob) => {
      setStatus("");
      if (!TYPES.includes(blob.type)) return fail(l.badType);
      if (blob.size > maxBytes) return fail(l.tooBig.replace("{max}", maxText));
      setError("");
      setReading(true);
      const reader = new FileReader();
      reader.onerror = () => {
        setReading(false);
        fail(l.unreadable);
      };
      reader.onload = () => {
        const pic = new Image();
        pic.onload = () => {
          setReading(false);
          setCrop(START);
          setImg(pic);
        };
        pic.onerror = () => {
          setReading(false);
          fail(l.unreadable);
        };
        pic.src = String(reader.result);
      };
      reader.readAsDataURL(blob);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxBytes, maxText],
  );

  // Back on the Upload button once the stage closes (after the button is enabled again).
  useEffect(() => {
    if (focusTick) uploadBtn.current?.focus();
  }, [focusTick]);

  // A new photo puts focus on the stage, ready for the arrow keys.
  useEffect(() => {
    if (img) stage.current?.focus();
  }, [img]);

  // The three previews redraw whenever the framing changes.
  useEffect(() => {
    if (!img) return;
    previews.current.forEach((c, i) => c && draw(c, img, crop, PREVIEWS[i]!));
  }, [img, crop]);

  // The wheel zooms; it has to be a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const el = stage.current;
    if (!el || !img) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setCrop((c) => clamp(img, { ...c, zoom: c.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [img]);

  const set = (next: Partial<Crop>) => img && setCrop((c) => clamp(img, { ...c, ...next }));

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!img) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, Partial<Crop>> = {
      ArrowLeft: { x: crop.x - step },
      ArrowRight: { x: crop.x + step },
      ArrowUp: { y: crop.y - step },
      ArrowDown: { y: crop.y + step },
    };
    if (moves[e.key]) set(moves[e.key]!);
    else if (e.key === "+" || e.key === "=") set({ zoom: crop.zoom + 0.1 });
    else if (e.key === "-" || e.key === "_") set({ zoom: crop.zoom - 0.1 });
    else if (e.key === "r" || e.key === "R") set({ turn: crop.turn + 1 });
    else if (e.key === "0") setCrop(START);
    else return;
    e.preventDefault();
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!img || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: crop };
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !img || !stage.current) return;
    const size = stage.current.clientWidth || 1;
    setCrop(clamp(img, { ...d.from, x: d.from.x + (e.clientX - d.x) / size, y: d.from.y + (e.clientY - d.y) / size }));
  };
  const onUp = () => {
    drag.current = null;
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) open(f);
  };

  const cancel = () => {
    setImg(null);
    setCrop(START);
    setFocusTick((t) => t + 1);
  };

  const save = async () => {
    if (!img || busy) return;
    const canvas = document.createElement("canvas");
    // The saved file ignores the screen's pixel ratio: exactly outputSize square.
    const ctx = canvas.getContext("2d");
    if (!ctx) return fail(l.failed);
    canvas.width = canvas.height = outputSize;
    const { w, h } = turned(img, crop.turn);
    const scale = (outputSize / Math.min(w, h)) * crop.zoom;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(outputSize / 2 + crop.x * outputSize, outputSize / 2 + crop.y * outputSize);
    ctx.rotate((crop.turn * Math.PI) / 2);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const url = canvas.toDataURL("image/png");
    setBusy(true);
    setError("");
    try {
      await (onSave ? onSave(url) : wait(800));
      setCurrent(url);
      setImg(null);
      setStatus(l.saved);
      setFocusTick((t) => t + 1);
    } catch {
      fail(l.failed);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setConfirmRemove(false);
    setBusy(true);
    void (onRemove ? onRemove() : wait(400))
      .then(() => {
        setCurrent(null);
        setStatus(l.removed);
      })
      .catch(() => fail(l.failed))
      .finally(() => {
        setBusy(false);
        setFocusTick((t) => t + 1);
      });
  };

  const trySample = async () => {
    if (!sample) return;
    setReading(true);
    try {
      open(await sample());
    } catch {
      setReading(false);
      fail(l.unreadable);
    }
  };

  // The photo on the stage: centered, turned, scaled to cover, then moved.
  let picStyle: CSSProperties | undefined;
  if (img) {
    const { w, h } = turned(img, crop.turn);
    const cover = 100 / Math.min(w, h);
    picStyle = {
      width: `${img.naturalWidth * cover * crop.zoom}cqi`,
      height: `${img.naturalHeight * cover * crop.zoom}cqi`,
      translate: `calc(-50% + ${crop.x * 100}cqi) calc(-50% + ${crop.y * 100}cqi)`,
      rotate: `${crop.turn * 90}deg`,
    };
  }

  const errId = `${id}-err`;
  const hintId = `${id}-hint`;

  return (
    <section className="fl-pho" aria-labelledby={`${id}-title`} data-fl="p.profile-photo">
      <header className="fl-pho-head">
        <h2 id={`${id}-title`}>{title}</h2>
        {lede ? <p>{lede}</p> : null}
      </header>

      <div className="fl-pho-body">
        <div className="fl-pho-current">
          <span className="fl-pho-avatar" data-empty={current ? undefined : ""}>
            {current ? <img src={current} alt={`${name}'s photo`} /> : <span aria-label={`${name}, no photo`} role="img">{initialsOf(name)}</span>}
          </span>
          <div className="fl-pho-current-btns">
            <Button ref={uploadBtn} variant="secondary" size={40} icon="upload" onClick={() => file.current?.click()} disabled={busy || reading} aria-describedby={error ? errId : undefined}>
              {current ? l.replace : l.upload}
            </Button>
            {current ? (
              <Button variant="tertiary" size={40} icon="trash" onClick={() => setConfirmRemove(true)} disabled={busy}>
                {l.remove}
              </Button>
            ) : null}
          </div>
          <input
            ref={file}
            className="fl-sr"
            type="file"
            accept={TYPES.join(",")}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (f) open(f);
            }}
          />
        </div>

        <div className="fl-pho-work">
          {!img ? (
            <div
              className={["fl-pho-drop", over ? "is-over" : "", error ? "is-invalid" : ""].filter(Boolean).join(" ")}
              data-shake={shake % 2 ? "a" : shake ? "b" : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
              aria-busy={reading || undefined}
            >
              {reading ? (
                <div className="fl-pho-reading">
                  <span className="fl-pho-spinner" aria-hidden="true" />
                  {l.reading}
                </div>
              ) : (
                <>
                  <span className="fl-pho-drop-icon" aria-hidden="true">
                    <Icon name="image" />
                  </span>
                  <p className="fl-pho-drop-title">{l.drop}</p>
                  <p className="fl-pho-drop-hint">{l.dropHint.replace("{max}", maxText)}</p>
                  <div className="fl-pho-drop-btns">
                    <Button size={40} icon="upload" onClick={() => file.current?.click()} aria-describedby={error ? errId : undefined}>
                      {l.upload}
                    </Button>
                    {sample ? (
                      <Button variant="tertiary" size={40} icon="sparkle" onClick={() => void trySample()}>
                        {l.sample}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
              <p id={errId} className="fl-pho-error" role={error ? "alert" : undefined}>
                {error ? (
                  <>
                    <Icon name="alert" />
                    {error}
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <div className="fl-pho-editor">
              <div
                ref={stage}
                className="fl-pho-stage"
                role="group"
                tabIndex={0}
                aria-label={l.stage}
                aria-describedby={hintId}
                aria-roledescription="crop area"
                onKeyDown={onKey}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <img className="fl-pho-pic" src={img.src} alt="" draggable={false} style={picStyle} />
                <span className="fl-pho-mask" aria-hidden="true" />
              </div>
              <p id={hintId} className="fl-pho-hint">
                {l.stageHint}
              </p>

              <div className="fl-pho-tools">
                <div className="fl-pho-zoom">
                  <button type="button" className="fl-pho-iconbtn" aria-label={l.zoomOut} title={l.zoomOut} onClick={() => set({ zoom: crop.zoom - 0.1 })} disabled={crop.zoom <= 1}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                  <label className="fl-sr" htmlFor={`${id}-zoom`}>
                    {l.zoom}
                  </label>
                  <input
                    id={`${id}-zoom`}
                    className="fl-pho-range"
                    type="range"
                    min={1}
                    max={ZOOM_MAX}
                    step={0.01}
                    value={crop.zoom}
                    aria-valuetext={`${Math.round(crop.zoom * 100)}%`}
                    style={{ "--pho-fill": `${((crop.zoom - 1) / (ZOOM_MAX - 1)) * 100}%` } as CSSProperties}
                    onChange={(e) => set({ zoom: Number(e.currentTarget.value) })}
                  />
                  <button type="button" className="fl-pho-iconbtn" aria-label={l.zoomIn} title={l.zoomIn} onClick={() => set({ zoom: crop.zoom + 0.1 })} disabled={crop.zoom >= ZOOM_MAX}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12h14M12 5v14" />
                    </svg>
                  </button>
                  <output className="fl-pho-pct" htmlFor={`${id}-zoom`}>
                    {Math.round(crop.zoom * 100)}%
                  </output>
                </div>
                <div className="fl-pho-tool-btns">
                  <Button variant="tertiary" size={32} icon="refresh" onClick={() => set({ turn: crop.turn + 1 })}>
                    {l.rotate}
                  </Button>
                  <Button variant="tertiary" size={32} onClick={() => setCrop(START)} disabled={crop.zoom === 1 && !crop.x && !crop.y && !crop.turn}>
                    {l.reset}
                  </Button>
                </div>
              </div>

              <div className="fl-pho-previews" role="group" aria-label={l.preview}>
                {PREVIEWS.map((s, i) => (
                  <canvas key={s} ref={(c) => void (previews.current[i] = c)} className="fl-pho-preview" style={{ width: s, height: s }} role="img" aria-label={`${l.preview}, ${s} pixels`} />
                ))}
              </div>

              {error ? (
                <p className="fl-pho-error" role="alert">
                  <Icon name="alert" />
                  {error}
                </p>
              ) : null}

              <div className="fl-pho-btns">
                <Button variant="tertiary" size={40} onClick={cancel} disabled={busy}>
                  {l.cancel}
                </Button>
                <Button size={40} busy={busy} onClick={() => void save()}>
                  {busy ? l.saving : l.save}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="fl-pho-status" role="status" aria-live="polite">
        {status ? (
          <>
            <span className="fl-pho-tick" aria-hidden="true">
              <Icon name="check" />
            </span>
            {status}
          </>
        ) : null}
      </p>

      {confirmRemove ? (
        <Modal variant="danger" icon="trash" title={l.removeTitle} description={l.removeText} confirmLabel={l.remove} onConfirm={() => remove()} onClose={() => setConfirmRemove(false)} />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Profile photo",
  lede: "Shown on your profile, comments and the team page.",
  name: "Ana Ruiz",
};

/** A made-up picture drawn on a canvas, so the sample needs no file and nothing fetched. */
function samplePicture(): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 480;
  const ctx = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  // Token colors only; a system color stands in if a token is missing.
  const tone = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
  const sky = ctx.createLinearGradient(0, 0, 0, 480);
  sky.addColorStop(0, tone("--color-accent", "Highlight"));
  sky.addColorStop(1, tone("--color-secondary", "GrayText"));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = tone("--color-surface", "Canvas");
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(320, 200, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(320, 470, 190, 160, 0, Math.PI, 0);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = tone("--color-text", "CanvasText");
  ctx.beginPath();
  ctx.arc(290, 190, 9, 0, Math.PI * 2);
  ctx.arc(350, 190, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.arc(320, 222, 34, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no-blob"))), "image/png"));
}

export default function ProfilePhotoSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <ProfilePhoto {...SAMPLE} sample={samplePicture} onSave={() => wait(900)} />
      </div>
    </section>
  );
}
