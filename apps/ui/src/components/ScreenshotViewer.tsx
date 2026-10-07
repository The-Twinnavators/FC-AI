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

export function ScreenshotGallery({ shots }: { shots: Shot[] }) {
  const [open, setOpen] = useState<number>();
  const thumbs = useRef<Array<HTMLButtonElement | null>>([]);
  const close = () => {
    const i = open;
    setOpen(undefined);
    if (i !== undefined) requestAnimationFrame(() => thumbs.current[i]?.focus());
  };
  return (
    <>
      <div className="screens">
        {shots.map((s, i) => (
          <figure key={s.id}>
            <button
              className="screens__thumb"
              ref={(el) => {
                thumbs.current[i] = el;
              }}
              onClick={() => setOpen(i)}
              aria-label={`Open ${s.label}`}
            >
              <img src={artifactUrl(s.id)} alt="" loading="lazy" />
            </button>
            <figcaption>{s.label}</figcaption>
          </figure>
        ))}
      </div>
      {open !== undefined && shots[open] ? <ShotModal shots={shots} index={open} onIndex={setOpen} onClose={close} /> : null}
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
