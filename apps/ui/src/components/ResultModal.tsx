/**
 * Result detail modal (search results and topic items): embedded video for YouTube/Vimeo (privacy-enhanced players),
 * otherwise the image; an overview and key points written by the local model; save; and personal notes.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, BookmarkCheck, ExternalLink, NotebookPen, Plus, Sparkles, Trash2, X } from "lucide-react";
import { get, post } from "../api";
import { thumbUrl, type WebResult } from "./WebResults";

interface Summary {
  overview: string;
  keyPoints: string[];
  model?: string;
  from: "page" | "description";
}
interface Note {
  id: string;
  text: string;
  at: string;
}

/** Embeddable player URL for YouTube and Vimeo links; undefined for everything else. */
export function embedUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    let id: string | null | undefined;
    if (host === "youtube.com") id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(u.pathname)?.[1];
    else if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
    if (host === "vimeo.com") {
      const v = /^\/(\d{5,12})/.exec(u.pathname)?.[1];
      if (v) return `https://player.vimeo.com/video/${v}?dnt=1`;
    }
  } catch {
    /* not a URL */
  }
  return undefined;
}

const KIND: Record<WebResult["tab"], string> = { general: "Web page", videos: "Video", pdfs: "PDF", news: "News", reference: "Reference", community: "Community" };
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export function ResultModal({ r, saved, onToggleSave, onClose }: { r: WebResult; saved?: boolean; onToggleSave?: (r: WebResult, saved: boolean) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<Summary>();
  const [summarizing, setSummarizing] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [isSaved, setIsSaved] = useState(!!saved);
  const embed = embedUrl(r.url);

  useEffect(() => {
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  useEffect(() => {
    let alive = true;
    setSummarizing(true);
    post<Summary>("/web/summary", { url: r.url, title: r.title, snippet: r.snippet })
      .then((s) => alive && setSummary(s))
      .catch(() => undefined)
      .finally(() => alive && setSummarizing(false));
    get<Note[]>(`/web/notes?url=${encodeURIComponent(r.url)}`)
      .then((n) => alive && setNotes(n))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [r.url, r.title, r.snippet]);

  const addNote = async () => {
    if (!draft.trim()) return;
    setNotes(await post<Note[]>("/web/notes", { url: r.url, text: draft }));
    setDraft("");
  };

  return createPortal(
    <div className="res-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="res-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="res-title" tabIndex={-1} ref={dialog}>
        <header className="res-modal__head">
          <div style={{ minWidth: 0 }}>
            <span className="res-modal__kind">
              {KIND[r.tab]} · {r.source}
              {r.author ? ` · ${r.author}` : ""}
            </span>
            <h2 id="res-title" className="res-modal__title">
              {r.title}
            </h2>
          </div>
          <div className="res-modal__actions">
            {onToggleSave ? (
              <button
                className={`icon-btn${isSaved ? " web-card__save is-saved" : ""}`}
                aria-pressed={isSaved}
                aria-label={isSaved ? "Remove from saved" : "Save to topic"}
                title={isSaved ? "Saved" : "Save to topic"}
                onClick={() => {
                  onToggleSave(r, !isSaved);
                  setIsSaved(!isSaved);
                }}
              >
                {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </button>
            ) : null}
            <a className="icon-btn" href={r.url} target="_blank" rel="noopener noreferrer" aria-label="Open in browser" title="Open in browser">
              <ExternalLink size={16} />
            </a>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="res-modal__scroll">
          <div className="res-modal__media">
            {embed ? (
              <iframe src={embed} title={r.title} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
            ) : r.thumbnail ? (
              <img src={thumbUrl(r.thumbnail)} alt="" />
            ) : null}
          </div>
          <div className="res-modal__body">
            <p className="res-modal__overview">{summary?.overview || r.snippet || (summarizing ? "" : "No description available.")}</p>
            <div className="res-modal__points">
              <span className="label">
                <Sparkles size={12} aria-hidden="true" /> Key points
              </span>
              {summarizing ? (
                <p className="muted" style={{ margin: 0 }}>Reading {r.tab === "videos" ? "the description" : "the page"} with your local model…</p>
              ) : summary?.keyPoints.length ? (
                <ul>
                  {summary.keyPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ margin: 0 }}>Couldn't pull key points from this {r.tab === "videos" ? "video's description" : "page"}.</p>
              )}
              {summary?.model ? <span className="muted res-modal__meta">Summarized by {summary.model} from the {summary.from === "page" ? "page" : "description"}</span> : null}
            </div>
            {r.publishedAt ? <span className="muted res-modal__meta">Published {when(r.publishedAt)}</span> : null}
            <div className="res-modal__notes">
              <span className="label">
                <NotebookPen size={12} aria-hidden="true" /> My notes
              </span>
              {notes.map((n) => (
                <div key={n.id} className="res-note">
                  <p>{n.text}</p>
                  <span className="muted res-modal__meta">{when(n.at)}</span>
                  <button className="icon-btn" aria-label="Delete note" onClick={() => void post<Note[]>("/web/notes/delete", { url: r.url, id: n.id }).then(setNotes)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="res-note__add">
                <label htmlFor="res-note" className="sr-only">
                  Add a note
                </label>
                <textarea
                  id="res-note"
                  className="textarea"
                  rows={2}
                  placeholder="Add a note… (Enter to post, Shift+Enter for a new line)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void addNote();
                    }
                  }}
                />
                <button className="btn btn--sm" disabled={!draft.trim()} onClick={() => void addNote()}>
                  <Plus size={14} aria-hidden="true" /> Post
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
