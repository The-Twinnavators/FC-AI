/** @flowcode-library media-frames · Media frames: ratios, fit, loading and what to do when it fails (Small components)
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

// flowcode:sample
const SAMPLE = {
  ratios: [
    { id: "1-1", label: "1:1", what: "Avatars, product grids" },
    { id: "4-3", label: "4:3", what: "Photographs, the old default" },
    { id: "16-9", label: "16:9", what: "Video, covers, heroes" },
    { id: "3-4", label: "3:4", what: "Portraits, phone pictures" },
  ],
  shots: [
    { id: "s1", title: "Riverside, first look", tone: "a" },
    { id: "s2", title: "Harbour, golden hour", tone: "b" },
    { id: "s3", title: "Studio, headshots", tone: "c" },
    { id: "s4", title: "Vineyard, toasts", tone: "d" },
    { id: "s5", title: "Autumn, brand day", tone: "e" },
    { id: "s6", title: "Reception, first dance", tone: "a" },
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
            <span className={`fl-ctl-media fl-ctl-media--${r.id}`}>
              <span className="fl-ctl-media-art fl-ctl-media-art--a" aria-hidden="true" />
            </span>
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
            <span className="fl-ctl-media fl-ctl-media--16-9">
              <span className="fl-ctl-media-art fl-ctl-media-art--b is-cover" aria-hidden="true" />
            </span>
            <span className="fl-ctl-matrix-kind">Cover</span>
            <span className="fl-ctl-matrix-what">Fills the frame, loses the edges</span>
          </span>
          <span>
            <span className="fl-ctl-media fl-ctl-media--16-9">
              <span className="fl-ctl-media-art fl-ctl-media-art--b is-contain" aria-hidden="true" />
            </span>
            <span className="fl-ctl-matrix-kind">Contain</span>
            <span className="fl-ctl-matrix-what">Keeps all of it, leaves bars</span>
          </span>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Before it arrives, and when it never does</h3>
        <p className="fl-ctl-btn-what">Two states a frame has to have. Switch them on and watch the layout hold still through both.</p>
        <div className="fl-ctl-alert-pick">
          <button type="button" className={`fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32${loading ? " is-on" : ""}`} aria-pressed={loading} onClick={() => setLoading((v) => !v)}>
            Still loading
          </button>
          <button type="button" className={`fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32${broken ? " is-on" : ""}`} aria-pressed={broken} onClick={() => setBroken((v) => !v)}>
            Never arrived
          </button>
        </div>
        <ul className="fl-ctl-media-grid">
          {d.shots.map((s, n) => (
            <li key={s.id}>
              <figure className="fl-ctl-media-fig">
                <span className="fl-ctl-media fl-ctl-media--4-3">
                  {loading && n % 2 === 0 ? (
                    <span className="fl-spec-skel fl-ctl-media-skel" aria-hidden="true" />
                  ) : broken && n % 3 === 0 ? (
                    <span className="fl-ctl-media-gone">
                      <Icon name="image" />
                      <span className="fl-ctl-matrix-what">Picture missing</span>
                    </span>
                  ) : (
                    <span className={`fl-ctl-media-art fl-ctl-media-art--${s.tone}`} aria-hidden="true" />
                  )}
                </span>
                <figcaption>{s.title}</figcaption>
              </figure>
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
