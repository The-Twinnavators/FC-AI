/** @flowcode-library hero-video · Hero with demo video (Heroes)
 * Catalog ID: b.hero-video (block)
 * Function: The demo video hero block (b.hero-video): a headline, a lede, two actions and a proof line beside a video poster whose play button opens the product demo in a dialog with a full player.
 * Use it as: import { HeroVideo } from "./hero-video"; <HeroVideo id title lede eyebrow? layout?="split"|"stacked" primary={{ label, href?, onClick? }} secondary?={{ label, href?, onClick? }} notes?={string[]} video={{ title, duration: "2:14", src?, poster?, tracks? }} proof?={{ people: [{ name, src? }], text }} labels?={{ play, close }} onPlay?={() => ...} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.media-frame, c.media-player, c.avatar.person
 * Look: Words on the left (a small eyebrow, a large display title, a muted lede, a primary and a secondary button, ticked notes and a row of overlapping faces with a proof line); on the right a wide rounded 16:9 poster with a halo behind it, a large round accent play button in the middle and a pill with the video's title and length along its foot. Stacked puts the poster under centered words; the play button opens the demo in a centered dialog.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --surface-radius --surface-shadow --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --space-8 --text-xs --text-sm --text-md --font-display --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: saas homepage; product demo; app homepage; product launch; startup homepage; course landing page; explainer video
 * Jobs to be done: see the product working before I sign up; understand what it does in two minutes; start a free trial; book a demo
 * Keywords: hero, video, demo, play button, explainer, product tour, modal player, homepage, landing
 */
/**
 * Demo video hero: the top of a homepage for a product that is easier to show than to describe. The poster is a
 * real button; pressing it opens a modal dialog (native <dialog>, so focus stays inside and Escape closes it) holding
 * the library's video player, which plays the given file or, without one, a generated stand-in clip. Closing the
 * dialog stops the player and puts focus back on the play button. The words rise in once, then the poster lifts in;
 * with reduced motion or animation off everything is simply there. Make it the app's own: replace SAMPLE with the
 * product's promise, a real poster and video (video.src, video.poster) and a true proof line.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { MediaFrame } from "./media-frames";
import { VideoPlayer, type VideoTrack } from "./media-player";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Icon, Tick } from "./icons";

export type HeroVideoAction = { label: string; href?: string; onClick?: () => void };

export type HeroVideoProps = {
  /** Prefix for the ids inside (the title's id is `${id}-title`). */
  id: string;
  title: string;
  lede: string;
  eyebrow?: string;
  /** split: words left, poster right (stacked on a phone). stacked: centered words over a wide poster. */
  layout?: "split" | "stacked";
  primary: HeroVideoAction;
  secondary?: HeroVideoAction;
  /** Short ticked notes under the buttons ("No card needed"). */
  notes?: string[];
  video: { title: string; duration: string; src?: string; poster?: string; tracks?: VideoTrack[] };
  /** A row of faces and a line of proof under the actions. */
  proof?: { people: Array<{ name: string; src?: string }>; text: string };
  labels?: { play?: string; close?: string };
  /** Called when the demo opens. */
  onPlay?: () => void;
};

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the block is in view, then "in". Without an observer, or with motion off, it is shown at once. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    // Already on screen: play the entrance now, without waiting on an observer.
    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    };
    if (inView()) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.1 });
    // A scroll check backs the observer up, so the block is never left hidden.
    const onScroll = () => inView() && show();
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return [ref, state] as const;
}

function Action({ a, variant }: { a: HeroVideoAction; variant: "primary" | "secondary" }) {
  return a.href ? (
    <Button variant={variant} href={a.href} onClick={a.onClick}>
      {a.label}
    </Button>
  ) : (
    <Button variant={variant} onClick={a.onClick}>
      {a.label}
    </Button>
  );
}

export function HeroVideo({
  id,
  title,
  lede,
  eyebrow,
  layout = "split",
  primary,
  secondary,
  notes,
  video,
  proof,
  labels = {},
  onPlay,
}: HeroVideoProps) {
  const [open, setOpen] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const playBtn = useRef<HTMLButtonElement>(null);
  const [root, enter] = useEnterOnce<HTMLDivElement>();
  const playLabel = labels.play ?? "Play the demo";

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);

  const show = () => {
    setOpen(true);
    onPlay?.();
  };
  const hide = () => {
    setOpen(false);
    requestAnimationFrame(() => playBtn.current?.focus());
  };

  return (
    <div
      ref={root}
      className={["fl-hvd", layout === "stacked" ? "fl-hvd--stacked" : "", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ")}
      data-fl="b.hero-video"
    >
      <div className="fl-hvd-grid">
        <div className="fl-hvd-words">
          {eyebrow ? (
            <p className="fl-eyebrow fl-hvd-rise" style={{ ["--i" as string]: 0 }}>
              {eyebrow}
            </p>
          ) : null}
          <h1 id={`${id}-title`} className="fl-title fl-title--xl fl-hvd-title fl-hvd-rise" style={{ ["--i" as string]: 1 }}>
            {title}
          </h1>
          <p className="fl-lede fl-hvd-rise" style={{ ["--i" as string]: 2 }}>
            {lede}
          </p>
          <div className="fl-hvd-actions fl-hvd-rise" style={{ ["--i" as string]: 3 }}>
            <Action a={primary} variant="primary" />
            {secondary ? <Action a={secondary} variant="secondary" /> : null}
          </div>
          {notes?.length ? (
            <ul className="fl-hvd-notes fl-hvd-rise" style={{ ["--i" as string]: 4 }}>
              {notes.map((n) => (
                <li key={n}>
                  <Tick />
                  {n}
                </li>
              ))}
            </ul>
          ) : null}
          {proof ? (
            <div className="fl-hvd-proof fl-hvd-rise" style={{ ["--i" as string]: 5 }}>
              <span className="fl-hvd-faces" aria-hidden="true">
                {proof.people.slice(0, 5).map((p, i) => (
                  <Avatar key={p.name} name={p.name} src={p.src} size={32} tone={TONES[i % TONES.length]} decorative />
                ))}
              </span>
              <p>{proof.text}</p>
            </div>
          ) : null}
        </div>

        <div className="fl-hvd-stage">
          <button ref={playBtn} type="button" className="fl-hvd-poster" onClick={show} aria-haspopup="dialog">
            <MediaFrame ratio="16-9" src={video.poster} alt="" art="b" />
            <span className="fl-hvd-play" aria-hidden="true">
              <Icon name="play" />
            </span>
            <span className="fl-hvd-meta">
              <span className="fl-sr">{playLabel}: </span>
              <span className="fl-hvd-meta-title">{video.title}</span>
              <span className="fl-hvd-meta-time">{video.duration}</span>
            </span>
          </button>
        </div>
      </div>

      <dialog
        ref={dlg}
        className="fl-hvd-dialog"
        aria-labelledby={`${id}-video-title`}
        onClose={() => open && hide()}
        onCancel={(e) => {
          e.preventDefault();
          hide();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) hide();
        }}
      >
        <div className="fl-hvd-panel">
          <div className="fl-hvd-bar">
            <h2 id={`${id}-video-title`} className="fl-hvd-dtitle">
              {video.title}
            </h2>
            <Button variant="tertiary" size={40} icon="close" iconOnly onClick={hide}>
              {labels.close ?? "Close"}
            </Button>
          </div>
          {open ? <VideoPlayer src={video.src} poster={video.poster} title={video.title} tracks={video.tracks} /> : null}
        </div>
      </dialog>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  id: "hero-video",
  eyebrow: "Scheduling for clinics",
  title: "Fill every slot without the phone tag",
  lede: "Patients book, move and confirm visits on their own. Your front desk gets two hours back every day.",
  primary: { label: "Start free trial", href: "#start" },
  secondary: { label: "Book a demo", href: "#demo" },
  notes: ["14 days free", "No card needed", "Set up in an afternoon"],
  video: { title: "See Slotwise in action", duration: "2:14" },
  proof: {
    people: [{ name: "Dana Ruiz" }, { name: "Omar Haddad" }, { name: "Mei Tanaka" }, { name: "Luca Bianchi" }],
    text: "Used by 1,200 clinics across 14 states",
  },
};

export default function HeroVideoPreview() {
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section" aria-labelledby={`${SAMPLE.id}-title`}>
      <div className="fl-wrap">
        <HeroVideo {...SAMPLE} onPlay={() => setSaid("Demo opened.")} />
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}
