/**
 * Screenshots from the latest verification (one per viewport) and a modal viewer: click to open full size,
 * arrow keys / buttons to move between viewports, Esc or the backdrop to close. Focus returns to the thumbnail.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { artifactUrl } from "../api";

export interface Shot {
  id: string;
  label: string;
  createdAt?: string;
}

/** Newest screenshot per viewport label, in mobile → tablet → desktop order. */
export function latestShots<T extends Shot>(all: T[]): T[] {
  const byLabel = new Map<string, T>();
  for (const s of all) {
    const prev = byLabel.get(s.label);
    if (!prev || (s.createdAt ?? "") > (prev.createdAt ?? "")) byLabel.set(s.label, s);
  }
  const width = (l: string) => Number(/(\d+)px/.exec(l)?.[1] ?? 0);
  return [...byLabel.values()].sort((a, b) => width(a.label) - width(b.label));
}

/** The screen a look-check shot is of: its label without the step it was taken after. */
const screenOf = (label: string) => label.replace(/\s*\(after\s+"[^"]*"\)\s*$/, "").trim();

/**
 * The latest shot of each screen, with each screen's earlier shots behind a toggle. FlowCode retakes every screen after
 * every step, so a build's gallery was mostly near-identical repeats (Kids cash app: 35 shots of 4 screens).
 */
export function ScreenshotGallery({ shots }: { shots: Shot[] }) {
  const [open, setOpen] = useState<number>();
  const [showEarlier, setShowEarlier] = useState(false);
  const thumbs = useRef<Array<HTMLButtonElement | null>>([]);
  const order = (x: Shot, i: number) => x.createdAt ?? String(i).padStart(6, "0");
  const indexed = shots.map((x, i) => ({ x, k: order(x, i) }));
  const latest = new Map<string, { x: Shot; k: string }>();
  for (const it of indexed) {
    const key = screenOf(it.x.label);
    const prev = latest.get(key);
    if (!prev || it.k > prev.k) latest.set(key, it);
  }
  const current = [...latest.values()].map((it) => it.x);
  const earlier = indexed.filter((it) => !current.includes(it.x)).sort((p, q) => (p.k < q.k ? 1 : -1)).map((it) => it.x);
  const all = showEarlier ? [...current, ...earlier] : current;
  const close = () => {
    const i = open;
    setOpen(undefined);
    if (i !== undefined) requestAnimationFrame(() => thumbs.current[i]?.focus());
  };
  const grid = (list: Shot[], offset: number) => (
    <div className="screens">
      {list.map((x, j) => (
        <figure key={x.id}>
          <button
            className="screens__thumb"
            ref={(el) => {
              thumbs.current[offset + j] = el;
            }}
            onClick={() => setOpen(offset + j)}
            aria-label={`Open ${x.label}`}
          >
            <img src={artifactUrl(x.id)} alt="" loading="lazy" />
          </button>
          <figcaption>{offset ? x.label : screenOf(x.label).replace(/^Look check:\s*/, "")}</figcaption>
        </figure>
      ))}
    </div>
  );
  return (
    <>
      {grid(current, 0)}
      {earlier.length ? (
        <div className="screens__earlier">
          <button type="button" className="btn btn--sm btn--ghost" aria-expanded={showEarlier} onClick={() => setShowEarlier((v) => !v)}>
            {showEarlier ? "Hide earlier look checks" : `Earlier look checks (${earlier.length})`}
          </button>
          {showEarlier ? grid(earlier, current.length) : null}
        </div>
      ) : null}
      {open !== undefined && all[open] ? <ShotModal shots={all} index={open} onIndex={setOpen} onClose={close} /> : null}
    </>
  );
}

function ShotModal({ shots, index, onIndex, onClose }: { shots: Shot[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const s = shots[index];
  const go = (d: number) => onIndex((index + d + shots.length) % shots.length);
  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  return createPortal(
    <div className="shot-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="shot-modal__dialog" role="dialog" aria-modal="true" aria-label={s.label} tabIndex={-1} ref={dialog}>
        <header className="shot-modal__head">
          <strong>{s.label}</strong>
          <span className="muted">
            {index + 1} of {shots.length}
          </span>
          <a className="btn btn--sm btn--ghost" href={artifactUrl(s.id)} target="_blank" rel="noreferrer" style={{ marginLeft: "auto" }}>
            <ExternalLink size={14} aria-hidden="true" /> Open full size
          </a>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="shot-modal__body">
          {shots.length > 1 ? (
            <button className="shot-modal__nav shot-modal__nav--prev" onClick={() => go(-1)} aria-label="Previous screenshot">
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <img src={artifactUrl(s.id)} alt={s.label} />
          {shots.length > 1 ? (
            <button className="shot-modal__nav shot-modal__nav--next" onClick={() => go(1)} aria-label="Next screenshot">
              <ChevronRight size={22} />
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
