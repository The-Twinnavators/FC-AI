/** @flowcode-library video-grid · Video grid (Cards)
 * Catalog ID: p.video-grid (pattern)
 * Function: The video grid pattern (p.video-grid): responsive embedded videos (YouTube, Vimeo or any embeddable player) that hold their aspect ratio and load the player only when someone presses Play.
 * Use it as: import { VideoGrid } from "./video-grid"; <VideoGrid videos={[{ id, title, embed: "https://www.youtube-nocookie.com/embed/ID", length?, meta?, poster?, ratio? }]} ratio?="16-9"|"4-3"|"21-9"|"1-1" columns?={1|2|3} playLabel? />
 * Built from: c.segmented.toggle
 * Look: A grid of rounded video tiles that hold their ratio, each a tinted poster with a round accent play button and the length in a corner, a bold title and a muted line under it; pressing play swaps in the embedded player.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-on-accent --color-text-muted --color-focus --space-2 --space-3 --space-5 --radius-lg --radius-sm --text-sm --text-xs --duration-fast
 * Use cases: video library; course lessons; talks page; product demos; media gallery; tutorial videos; webinar recordings
 * Jobs to be done: watch a video without leaving the page; browse the videos on offer; keep the page fast until i choose to watch
 * Keywords: video, embed, youtube, vimeo, grid, aspect ratio, gallery, media
 */
/**
 * Video grid: a responsive grid of embedded videos (YouTube, Vimeo or any player page that can sit in a frame), each
 * holding its aspect ratio (16:9, 4:3, 21:9 or square) before anything loads, so the page never jumps. Nothing is
 * fetched from the video site until someone presses Play: each tile shows its title, length and a play button first,
 * then swaps in the player and moves focus to it. That keeps the page fast and the visitor's privacy until they choose
 * to watch. Use it for a course's lessons, a talks page, product demos or a media library. Make it the app's own:
 * replace SAMPLE with the app's own videos (their embed addresses, titles and lengths); a single video on a page with
 * custom controls is the media player (c.media-player) instead.
 * The poster is itself the play button; the reference sheet's frame switch is c.segmented.toggle.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin), its videos page and video partials.
 */
import { useRef, useState } from "react";
import { Icon } from "./icons";
import { Segmented } from "./segmented-control";

// ── p.video-grid: ratio-holding video tiles that load the player only when played. ──

export type VideoRatio = "16-9" | "4-3" | "21-9" | "1-1";

export type GridVideo = {
  id: string;
  title: string;
  /** The player's embed address, such as "https://www.youtube-nocookie.com/embed/VIDEO_ID". */
  embed: string;
  /** Length as shown: "9:56". */
  length?: string;
  /** A line under the title: who made it, or what it covers. */
  meta?: string;
  /** A still to show before it plays; a tinted tile shows without one. */
  poster?: string;
  /** This tile's own ratio; the grid's when left out. */
  ratio?: VideoRatio;
};

export type VideoGridProps = {
  videos: GridVideo[];
  /** The ratio every tile holds unless it says otherwise. */
  ratio?: VideoRatio;
  /** The most tiles in a row on a wide screen; fewer fit on narrow ones. */
  columns?: 1 | 2 | 3;
  /** The play button's words, read with the title: "Play". */
  playLabel?: string;
};

// Written out in full so a build finds every class.
const RATIO: Record<VideoRatio, string> = { "16-9": "fl-vg-frame fl-vg-frame--16-9", "4-3": "fl-vg-frame fl-vg-frame--4-3", "21-9": "fl-vg-frame fl-vg-frame--21-9", "1-1": "fl-vg-frame fl-vg-frame--1-1" };
const COLUMNS = { 1: "fl-vg fl-vg--1", 2: "fl-vg fl-vg--2", 3: "fl-vg fl-vg--3" } as const;

/** The embed address with autoplay on, since the person has just pressed Play. */
function withAutoplay(src: string) {
  try {
    const u = new URL(src);
    u.searchParams.set("autoplay", "1");
    return u.toString();
  } catch {
    return src;
  }
}

function VideoTile({ video, ratio, playLabel }: { video: GridVideo; ratio: VideoRatio; playLabel: string }) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  return (
    <li className="fl-vg-item">
      <div className={RATIO[video.ratio ?? ratio]}>
        {playing ? (
          <iframe
            ref={frame}
            src={withAutoplay(video.embed)}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => frame.current?.focus()}
          />
        ) : (
          <button type="button" className="fl-vg-poster" onClick={() => setPlaying(true)} aria-label={`${playLabel}: ${video.title}${video.length ? `, ${video.length}` : ""}`}>
            {video.poster ? <img src={video.poster} alt="" loading="lazy" /> : null}
            <span className="fl-vg-play" aria-hidden="true">
              <Icon name="play" filled />
            </span>
            {video.length ? (
              <span className="fl-vg-length" aria-hidden="true">
                {video.length}
              </span>
            ) : null}
          </button>
        )}
      </div>
      <div className="fl-vg-caption">
        <strong>{video.title}</strong>
        {video.meta ? <span>{video.meta}</span> : null}
      </div>
    </li>
  );
}

export function VideoGrid({ videos, ratio = "16-9", columns = 2, playLabel = "Play" }: VideoGridProps) {
  return (
    <ul className={COLUMNS[columns]} data-fl="p.video-grid">
      {videos.map((v) => (
        <VideoTile key={v.id} video={v} ratio={ratio} playLabel={playLabel} />
      ))}
    </ul>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Open movie library",
  lede: "Short films from the Blender Studio, free to watch and share.",
  ratioLabel: "Frame",
  ratios: [
    { value: "16-9", label: "16:9" },
    { value: "4-3", label: "4:3" },
    { value: "21-9", label: "21:9" },
    { value: "1-1", label: "1:1" },
  ],
  videos: [
    { id: "v1", title: "Big Buck Bunny", meta: "Blender Studio · 2008", length: "10:34", embed: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ" },
    { id: "v2", title: "Sintel", meta: "Blender Studio · 2010", length: "14:48", embed: "https://www.youtube-nocookie.com/embed/eRsGyueVLvQ" },
    { id: "v3", title: "Tears of Steel", meta: "Blender Studio · 2012", length: "12:14", embed: "https://www.youtube-nocookie.com/embed/R6MlUcmOul8" },
    { id: "v4", title: "Spring", meta: "Blender Studio · 2019", length: "7:44", embed: "https://www.youtube-nocookie.com/embed/WhWc3b3KhnY" },
  ] as GridVideo[],
};

export default function VideoGridSheet() {
  const d = SAMPLE;
  const [ratio, setRatio] = useState<VideoRatio>("16-9");
  return (
    <section className="fl-section" aria-labelledby="video-grid-title">
      <div className="fl-wrap">
        <div className="fl-vg-head">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <h2 id="video-grid-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
            <p className="fl-text">{d.lede}</p>
          </div>
          <Segmented variant="toggle" size="sm" label={d.ratioLabel} value={ratio} onChange={(v) => setRatio(v as VideoRatio)} options={d.ratios} />
        </div>
        <VideoGrid videos={d.videos} ratio={ratio} columns={2} />
      </div>
    </section>
  );
}
