/**
 * Shared pieces for web search and topics: result types, tab bar with counts, and result cards with a bookmark.
 * Thumbnails load through the daemon's proxy (blocked hosts are never contacted; the page's CSP stays local-only).
 */
import { useState } from "react";
import { Bookmark, BookmarkCheck, BookOpen, FileText, Globe, Newspaper, Play, Users } from "lucide-react";
import { conn } from "../api";
import { ResultModal } from "./ResultModal";

export type ResultTab = "general" | "videos" | "pdfs" | "news" | "reference" | "community";
export interface WebResult {
  url: string;
  title: string;
  snippet: string;
  source: string;
  engine?: string;
  tab: ResultTab;
  thumbnail?: string;
  author?: string;
  publishedAt?: string;
}
export interface Topic {
  id: string;
  title: string;
  query: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  results: WebResult[];
  fetchedAt?: string;
  saved: WebResult[];
  analysis?: { markdown: string; generatedAt: string; model?: string; fallback?: boolean };
  knowledgeId?: string;
  refreshError?: string;
}

export const TAB_LABEL: Record<ResultTab | "all" | "saved", string> = { all: "All", general: "General", videos: "Videos", pdfs: "PDFs", news: "News", reference: "Reference", community: "Community", saved: "Saved" };
const TAB_ICON = { general: Globe, videos: Play, pdfs: FileText, news: Newspaper, reference: BookOpen, community: Users } as const;

export const thumbUrl = (u: string) => `${conn.base}/web/thumb?u=${encodeURIComponent(u)}&token=${encodeURIComponent(conn.token)}`;

export function ResultTabs<T extends string>({ value, onChange, counts, label }: { value: T; onChange: (t: T) => void; counts: Array<[T, number]>; label: string }) {
  return (
    <div className="web-tabs" role="tablist" aria-label={label}>
      {counts.map(([id, n]) => (
        <button key={id} role="tab" aria-selected={value === id} className={`web-tab${n ? "" : " is-empty"}`} onClick={() => onChange(id)}>
          {TAB_LABEL[id as keyof typeof TAB_LABEL] ?? id}
          <span className="web-tab__n">{n}</span>
        </button>
      ))}
    </div>
  );
}

function Thumb({ r }: { r: WebResult }) {
  const [failed, setFailed] = useState(false);
  const Ico = TAB_ICON[r.tab];
  return (
    <div className="web-card__media" aria-hidden="true">
      {r.thumbnail && !failed ? <img src={thumbUrl(r.thumbnail)} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Ico size={28} strokeWidth={1.5} />}
      {r.tab === "videos" ? (
        <span className="web-card__play">
          <Play size={14} fill="currentColor" />
        </span>
      ) : null}
    </div>
  );
}

export function ResultCard({ r, saved, onToggleSave }: { r: WebResult; saved?: boolean; onToggleSave?: (r: WebResult, saved: boolean) => void }) {
  const Ico = TAB_ICON[r.tab];
  const [open, setOpen] = useState(false);
  return (
    <article className="web-card">
      <button className="web-card__link" onClick={() => setOpen(true)} aria-label={`Open ${r.title}`}>
        <Thumb r={r} />
      </button>
      {open ? <ResultModal r={r} saved={saved} onToggleSave={onToggleSave} onClose={() => setOpen(false)} /> : null}
      <div className="web-card__body">
        <span className="web-card__src">
          <Ico size={13} aria-hidden="true" />
          {r.source}
          {r.author ? ` · ${r.author}` : ""}
        </span>
        <button className="web-card__title" onClick={() => setOpen(true)}>
          {r.title}
        </button>
        {r.snippet ? <p className="web-card__snip">{r.snippet}</p> : null}
        <div className="web-card__foot">
          <span className="muted mono">{r.publishedAt ? r.publishedAt.slice(0, 10) : ""}</span>
          {onToggleSave ? (
            <button className={`icon-btn web-card__save${saved ? " is-saved" : ""}`} aria-pressed={!!saved} aria-label={saved ? `Remove "${r.title}" from saved` : `Save "${r.title}"`} title={saved ? "Saved — click to remove" : "Save to topic"} onClick={() => onToggleSave(r, !saved)}>
              {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export const PAGE_SIZE = 24;

/** Page numbers with gaps: 1 … 4 5 6 … 12. */
function pageList(page: number, pages: number): Array<number | "gap"> {
  const want = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const out: Array<number | "gap"> = [];
  let last = 0;
  for (const n of [...want].sort((a, b) => a - b)) {
    if (n - last > 1) out.push("gap");
    out.push(n);
    last = n;
  }
  return out;
}

export function Pager({ page, total, onChange, label }: { page: number; total: number; onChange: (p: number) => void; label: string }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const go = (p: number) => {
    onChange(p);
    document.querySelector(".web-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <nav className="pager" aria-label={label}>
      <button className="btn btn--sm" disabled={page <= 1} onClick={() => go(page - 1)}>
        Previous
      </button>
      {pageList(page, pages).map((p, i) =>
        p === "gap" ? (
          <span key={`g${i}`} className="pager__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button key={p} className={`pager__num${p === page ? " is-on" : ""}`} aria-current={p === page ? "page" : undefined} aria-label={`Page ${p}`} onClick={() => go(p)}>
            {p}
          </button>
        ),
      )}
      <button className="btn btn--sm" disabled={page >= pages} onClick={() => go(page + 1)}>
        Next
      </button>
      <span className="muted pager__info">
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(total, page * PAGE_SIZE)} of {total}
      </span>
    </nav>
  );
}
