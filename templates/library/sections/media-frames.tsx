/** @flowcode-library media-frames · Media frames: ratios, fit, loading and what to do when it fails (Small components)
 * Catalog ID: c.media-frame (component)
 * Function: The media frame (c.media-frame): a picture frame that holds its ratio and handles loading and failure itself, and a reference sheet of ratios, cover versus contain, and the loading and failed states.
 * Use it as: import { MediaFrame } from "./media-frames"; <MediaFrame ratio?="1-1"|"4-3"|"16-9"|"3-4" fit?="cover"|"contain" src? alt? caption? />
 * Look: A rounded frame that holds its aspect ratio, filled with a cropped or letterboxed picture, a skeleton while loading, or a "Picture missing" note if it fails; an optional caption sits below.
 * Tokens: --radius-md --color-surface-sunken --color-text-muted --color-accent --text-sm --space-2
 * Use cases: a gallery grid; a card's cover; a video thumbnail; an avatar crop; a logo wall
 * Jobs to be done: lay out pictures without the page jumping; keep a grid even; cope with a picture that fails
 * Keywords: image, thumbnail, aspect ratio, object-fit, placeholder, lazy, caption, fallback
 */
/**
 * Frames for pictures, with the three things that go wrong built in rather than described: a page that jumps while
 * images load, a grid that goes ragged because one picture is the wrong shape, and a frame left empty when a file is
 * missing.
 *
 * Every frame holds its ratio before anything loads, so nothing moves. Fit is a real choice with a real cost - cover
 * crops, contain letterboxes - so both are shown at the same ratio with the same picture. Nothing here loads from the
 * network: the "pictures" are drawn with gradients, so the piece works in a built app with no assets at all.
 *
 * Make it the app's own: put your own images in, keep the ratio on the frame, and give every one a real alt or an
 * empty alt if it is decoration. There is no third option.
 */
/**
 * How to try it
 * - Switch "Still loading" and "Never arrived" on and off: the layout holds still through both, which is the thing being
 *   shown.
 * - Cover and contain are the same picture in the same frame, so the cost of each is visible.
 * - No image is fetched: the pictures are gradients, so the piece works in an app with no assets.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.media-frame: the one picture frame. It holds its ratio, and handles loading and failure itself. ──

export type MediaRatio = "1-1" | "4-3" | "16-9" | "3-4";
export type MediaFit = "cover" | "contain";
export type MediaArt = "a" | "b" | "c" | "d" | "e";

// Written out in full (not built from the value) so a build finds every class the frame needs.
const RATIO: Record<MediaRatio, string> = {
  "1-1": "fl-ctl-media--1-1",
  "4-3": "fl-ctl-media--4-3",
  "16-9": "fl-ctl-media--16-9",
  "3-4": "fl-ctl-media--3-4",
};
const ART: Record<MediaArt, string> = {
  a: "fl-ctl-media-art--a",
  b: "fl-ctl-media-art--b",
  c: "fl-ctl-media-art--c",
  d: "fl-ctl-media-art--d",
  e: "fl-ctl-media-art--e",
};
const FIT: Record<MediaFit, string> = { cover: "is-cover", contain: "is-contain" };

type MediaFrameProps = {
  /** The frame's shape, held before anything loads. 4-3 when left out. */
  ratio?: MediaRatio;
  /** Cover fills the frame and crops; contain keeps all of it and leaves bars. Cover when left out. */
  fit?: MediaFit;
  /** Image address. Without one, the frame draws a gradient picture (see art). */
  src?: string;
  /** Describe the picture, or pass "" if it is decoration. */
  alt?: string;
  /** Which gradient stands in for a picture when there is no src. */
  art?: MediaArt;
  /** Force a state: loading shows a skeleton, failed shows "Picture missing". Otherwise it follows the image. */
  status?: "loading" | "failed";
  /** A caption below the frame; wraps it in a figure. */
  caption?: string;
  className?: string;
};

export function MediaFrame({ ratio = "4-3", fit = "cover", src, alt = "", art = "a", status, caption, className }: MediaFrameProps) {
  const [seen, setSeen] = useState<{ src?: string; state: "loading" | "loaded" | "failed" }>({ src, state: "loading" });
  const own = seen.src === src ? seen.state : "loading";
  const state = status ?? (src ? own : "loaded");
  const frame = (
    <span className={["fl-ctl-media", RATIO[ratio], caption ? "" : (className ?? "")].filter(Boolean).join(" ")} data-fl={caption ? undefined : "c.media-frame"}>
      {state === "failed" ? (
        <span className="fl-ctl-media-gone" role="img" aria-label={alt ? `${alt} (picture missing)` : "Picture missing"}>
          <Icon name="image" />
          <span className="fl-ctl-matrix-what">Picture missing</span>
        </span>
      ) : (
        <>
          {src ? (
            <img
              className="fl-ctl-media-art"
              src={src}
              alt={alt}
              style={{ width: "100%", height: "100%", objectFit: fit, opacity: state === "loaded" ? 1 : 0 }}
              onLoad={() => setSeen({ src, state: "loaded" })}
              onError={() => setSeen({ src, state: "failed" })}
            />
          ) : (
            <span className={`fl-ctl-media-art ${ART[art]} ${FIT[fit]}`} aria-hidden="true" />
          )}
          {state === "loading" ? <span className="fl-spec-skel fl-ctl-media-skel" aria-hidden="true" /> : null}
        </>
      )}
    </span>
  );
  if (!caption) return frame;
  return (
    <figure className={["fl-ctl-media-fig", className ?? ""].filter(Boolean).join(" ")} data-fl="c.media-frame">
      {frame}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

// flowcode:sample
const SAMPLE = {
  ratios: [
    { id: "1-1" as const, label: "1:1", what: "Avatars, product grids" },
    { id: "4-3" as const, label: "4:3", what: "Photographs, the old default" },
    { id: "16-9" as const, label: "16:9", what: "Video, covers, heroes" },
    { id: "3-4" as const, label: "3:4", what: "Portraits, phone pictures" },
  ],
  shots: [
    { id: "s1", title: "Riverside, first look", tone: "a" as const },
    { id: "s2", title: "Harbour, golden hour", tone: "b" as const },
    { id: "s3", title: "Studio, headshots", tone: "c" as const },
    { id: "s4", title: "Vineyard, toasts", tone: "d" as const },
    { id: "s5", title: "Autumn, brand day", tone: "e" as const },
    { id: "s6", title: "Reception, first dance", tone: "a" as const },
  ],
};

export default function MediaFrames() {
  const d = SAMPLE;
  const [loading, setLoading] = useState(false);
  const [broken, setBroken] = useState(false);

  return (
    <section className="fl-section fl-section--specimen">
      <h3>Ratios</h3>
      <p className="fl-ctl-btn-what">The frame holds its shape before anything is in it, which is what stops the page jumping as pictures arrive.</p>
      <ul className="fl-ctl-media-row">
        {d.ratios.map((r) => (
          <li key={r.id}>
            <MediaFrame ratio={r.id} />
            <span className="fl-ctl-matrix-kind">{r.label}</span>
            <span className="fl-ctl-matrix-what">{r.what}</span>
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Cover or contain</h3>
        <p className="fl-ctl-btn-what">
          The same tall picture in the same wide frame. Cover fills the frame and cuts the edges off; contain keeps all
          of it and leaves bars. Cover for photographs, contain for logos and screenshots, where cropping loses meaning.
        </p>
        <div className="fl-ctl-media-pair">
          <span>
            <MediaFrame ratio="16-9" art="b" fit="cover" />
            <span className="fl-ctl-matrix-kind">Cover</span>
            <span className="fl-ctl-matrix-what">Fills the frame, loses the edges</span>
          </span>
          <span>
            <MediaFrame ratio="16-9" art="b" fit="contain" />
            <span className="fl-ctl-matrix-kind">Contain</span>
            <span className="fl-ctl-matrix-what">Keeps all of it, leaves bars</span>
          </span>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Before it arrives, and when it never does</h3>
        <p className="fl-ctl-btn-what">Two states a frame has to have. Switch them on and watch the layout hold still through both.</p>
        <div className="fl-ctl-alert-pick">
          <Button variant="tertiary" size={32} className={loading ? "is-on" : undefined} aria-pressed={loading} onClick={() => setLoading((v) => !v)}>
            Still loading
          </Button>
          <Button variant="tertiary" size={32} className={broken ? "is-on" : undefined} aria-pressed={broken} onClick={() => setBroken((v) => !v)}>
            Never arrived
          </Button>
        </div>
        <ul className="fl-ctl-media-grid">
          {d.shots.map((s, n) => (
            <li key={s.id}>
              <MediaFrame ratio="4-3" art={s.tone} caption={s.title} status={loading && n % 2 === 0 ? "loading" : broken && n % 3 === 0 ? "failed" : undefined} />
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes">
        <h3>What a frame has to carry</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>A ratio, always.</strong>
            <span className="fl-ctl-matrix-what">Set it on the frame, not the image. Without it the page jumps as each picture lands.</span>
          </li>
          <li>
            <strong>Alt text, or an empty alt.</strong>
            <span className="fl-ctl-matrix-what">Describe it, or mark it decoration with alt="". A missing alt attribute reads the file name aloud.</span>
          </li>
          <li>
            <strong>Loading="lazy" below the fold.</strong>
            <span className="fl-ctl-matrix-what">And never on the first picture on the page, which is the one that should load first.</span>
          </li>
          <li>
            <strong>Something to show when it fails.</strong>
            <span className="fl-ctl-matrix-what">A frame with a broken-image icon in it looks like a bug. A frame that says so looks considered.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
