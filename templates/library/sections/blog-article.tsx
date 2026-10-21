/** @flowcode-library blog-article · Blog post with recent posts (Blog)
 * Catalog ID: p.blog-article (pattern)
 * Function: A blog post page (p.blog-article): the article with a reading progress bar, an On this page list that follows the section being read and jumps to a heading (focus moves there), Like, Save and Copy link, and recent posts beside it; on a phone the contents fold behind a button. Adapted from Meraki UI (MIT).
 * Use it as: Import { BlogArticle } from "./blog-article"; <BlogArticle post={{ category, title, dek, author: { name, role }, date, minutes, media, likes?, sections: [{ id, heading, paragraphs: [...], quote? }] }} recent={[{ category, title, href, date? }]} onLike?={(liked) => ...} onSave?={(saved) => ...} />
 * Built from: c.badge.status, c.avatar.person, c.button.tertiary
 * Look: A wide tinted picture over a category pill, a large title, a one-line dek and an author line with Like, Save and Copy link, then the sections with a pull quote; a sticky side column lists the sections with a bar beside the one being read and recent posts split by thin rules. A thin accent bar along the top fills as you read; on a phone the contents fold behind a button and recent posts follow the article.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-danger --color-secondary --color-text --color-text-muted --focus-ring --radius-md --radius-lg --space-2 --space-3 --space-4 --space-5 --space-6 --space-8 --text-xs --text-sm --text-md --text-lg --duration-fast --duration-base --duration-slow --ease-out --ease-spring
 * Use cases: blog post; article page; news story; guide; case study; changelog entry; help article; newsletter archive
 * Jobs to be done: read an article without losing my place; jump to the part i care about; save or like a post; share a link to it; find another post to read next
 * Keywords: blog, article, post, reading, table of contents, progress, recent posts, share, like
 */
/**
 * Blog post: one article with the tools a long read needs. A progress bar fills as the article scrolls past; the "On
 * this page" list marks the section in view (measured once per frame while scrolling) with one bar that slides beside it, and a press
 * scrolls to that heading and moves focus there. Like and Save are toggles; Copy link copies the page address (or says
 * it couldn't and shows it). Recent posts sit beside the article, adapted from Meraki UI's single post with recent posts;
 * on a phone they follow it, and the contents fold into a button above the text (grid rows, inert while closed).
 * Make it the app's own: replace SAMPLE with the real post and the latest posts, and save likes and saves through
 * onLike and onSave.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa), its "Single Post With Recent" blog component.
 */
/**
 * How to try it
 * - Scroll: the bar along the top fills and the bar in "On this page" follows the section you're reading.
 * - Press a section in "On this page": the page scrolls to it and focus moves to its heading.
 * - Press Like and Save; press Copy link and the status line says it was copied.
 * - At phone width, "On this page" folds behind a button above the article.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), and the library's own inline icon set
 * ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample data
 * is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── p.blog-article: an article with reading progress, contents that follow along, and recent posts. ──

export type ArticleSection = { id: string; heading: string; paragraphs: string[]; quote?: string };
export type ArticlePost = {
  category: string;
  title: string;
  /** One line under the title. */
  dek: string;
  author: { name: string; role: string };
  /** Already written for people: "Oct 14, 2026". */
  date: string;
  minutes: number;
  /** A description of the lead picture: shown in the placeholder and read as its alt text. */
  media: string;
  likes?: number;
  sections: ArticleSection[];
};
export type RecentPost = { category: string; title: string; href: string; date?: string };

export type BlogArticleProps = {
  post: ArticlePost;
  recent: RecentPost[];
  labels?: { contents?: string; recent?: string; like?: string; save?: string; saved?: string; copy?: string; copied?: string; copyFailed?: string; progress?: string; minRead?: string };
  onLike?: (liked: boolean) => void;
  onSave?: (saved: boolean) => void;
};

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function BlogArticle({ post, recent, labels = {}, onLike, onSave }: BlogArticleProps) {
  const l = {
    contents: "On this page",
    recent: "Recent posts",
    like: "Like",
    save: "Save",
    saved: "Saved",
    copy: "Copy link",
    copied: "Link copied.",
    copyFailed: "Couldn't copy. The link is",
    progress: "Reading progress",
    minRead: "min read",
    ...labels,
  };
  const uid = useId().replace(/:/g, "");
  const article = useRef<HTMLElement>(null);
  // The contents list is drawn twice (beside the article, and folded above it on a phone); one is shown at a time.
  const tocSide = useRef<HTMLOListElement>(null);
  const tocFold = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(post.sections[0]?.id ?? "");
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [status, setStatus] = useState("");
  const likes = (post.likes ?? 0) + (liked ? 1 : 0);
  const sid = (id: string) => `${uid}-${id}`;

  // Progress: how much of the article has scrolled past the top of the window. The section being read: the last
  // heading that has crossed the upper third of the window. Both are measured once per frame while scrolling.
  useEffect(() => {
    const heads = post.sections.map((s) => document.getElementById(sid(s.id))).filter(Boolean) as HTMLElement[];
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = article.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setProgress(total <= 0 ? (r.top <= 0 ? 100 : 0) : Math.max(0, Math.min(100, (-r.top / total) * 100)));
      let cur = post.sections[0]?.id ?? "";
      for (const h of heads) if (h.getBoundingClientRect().top <= window.innerHeight * 0.35 + 1) cur = h.dataset.section ?? cur;
      // At the very end, the last section is the one being read even when its heading can't reach the top third.
      if (total > 0 && -r.top >= total - 2 && heads.length) cur = heads[heads.length - 1]!.dataset.section ?? cur;
      setActive(cur);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [post.sections]);

  // One bar beside the contents list that slides to the active entry.
  const [bars, setBars] = useState<Record<"side" | "fold", { y: number; h: number } | null>>({ side: null, fold: null });
  useLayoutEffect(() => {
    const at = (ol: HTMLOListElement | null) => {
      const a = ol?.querySelector<HTMLElement>('[aria-current="location"]');
      return a && a.offsetHeight ? { y: a.offsetTop, h: a.offsetHeight } : null;
    };
    const place = () => setBars({ side: at(tocSide.current), fold: at(tocFold.current) });
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, tocOpen]);

  const jump = (id: string) => {
    const h = document.getElementById(sid(id));
    if (!h) return;
    h.scrollIntoView({ behavior: reduced() || document.documentElement.dataset.motion === "off" ? "auto" : "smooth", block: "start" });
    h.focus({ preventScroll: true });
    setActive(id);
    setTocOpen(false);
  };

  const copy = async () => {
    const href = typeof location !== "undefined" ? location.href : "";
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(href);
      setStatus(l.copied);
    } catch {
      setStatus(`${l.copyFailed} ${href}`);
    }
  };

  const contents = (where: "side" | "fold") => {
    const bar = bars[where];
    return (
    <nav className="fl-art-toc" aria-label={where === "side" ? l.contents : `${l.contents} (menu)`}>
      <ol ref={where === "side" ? tocSide : tocFold}>
        {post.sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${sid(s.id)}`}
              aria-current={active === s.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                jump(s.id);
              }}
            >
              {s.heading}
            </a>
          </li>
        ))}
      </ol>
      <span className="fl-art-toc-bar" aria-hidden="true" data-ready={bar ? "" : undefined} style={bar ? { height: `${bar.h}px`, translate: `0 ${bar.y}px` } : undefined} />
    </nav>
    );
  };

  return (
    <div className="fl-art" data-fl="p.blog-article">
      <div className="fl-art-progress" role="progressbar" aria-label={l.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>

      <div className="fl-art-layout">
        <article className="fl-art-main" ref={article} aria-labelledby={`${uid}-title`}>
          <div className="fl-art-media" role="img" aria-label={post.media}>
            <Icon name="image" />
            <span aria-hidden="true">{post.media}</span>
          </div>
          <header className="fl-art-head">
            <Badge tone="info">{post.category}</Badge>
            <h2 id={`${uid}-title`} className="fl-art-title">
              {post.title}
            </h2>
            <p className="fl-art-dek">{post.dek}</p>
            <div className="fl-art-byline">
              <Avatar name={post.author.name} size={44} decorative />
              <div className="fl-art-author">
                <strong>{post.author.name}</strong>
                <span>
                  {post.author.role} · {post.date} · {post.minutes} {l.minRead}
                </span>
              </div>
              <div className="fl-art-actions">
                <Button
                  variant="tertiary"
                  size={40}
                  icon="heart"
                  pressed={liked}
                  className="fl-art-like"
                  onClick={() => {
                    setLiked(!liked);
                    onLike?.(!liked);
                  }}
                  aria-label={`${l.like}, ${likes}`}
                >
                  {likes}
                </Button>
                <Button
                  variant="tertiary"
                  size={40}
                  icon="bookmark"
                  iconOnly
                  pressed={saved}
                  onClick={() => {
                    setSaved(!saved);
                    onSave?.(!saved);
                    setStatus(saved ? "" : `${l.saved}.`);
                  }}
                >
                  {saved ? l.saved : l.save}
                </Button>
                <Button variant="tertiary" size={40} icon="link" iconOnly onClick={copy}>
                  {l.copy}
                </Button>
              </div>
            </div>
            <p className="fl-art-status" role="status" aria-live="polite">
              {status}
            </p>
          </header>

          {/* Phone: the contents fold behind a button above the text. */}
          <div className={`fl-art-fold${tocOpen ? " is-open" : ""}`}>
            <button type="button" className="fl-art-fold-btn" aria-expanded={tocOpen} aria-controls={`${uid}-fold`} onClick={() => setTocOpen((v) => !v)}>
              {l.contents}
              <Icon name="chevron-down" />
            </button>
            <div className="fl-art-fold-body" id={`${uid}-fold`} inert={!tocOpen}>
              <div>{contents("fold")}</div>
            </div>
          </div>

          <div className="fl-art-body">
            {post.sections.map((s) => (
              <section key={s.id} aria-labelledby={sid(s.id)}>
                <h3 id={sid(s.id)} data-section={s.id} tabIndex={-1}>
                  {s.heading}
                </h3>
                {s.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {s.quote ? (
                  <blockquote>
                    <p>{s.quote}</p>
                  </blockquote>
                ) : null}
              </section>
            ))}
          </div>
        </article>

        <aside className="fl-art-side" aria-label="Article tools">
          <div className="fl-art-side-toc">
            <h3 className="fl-art-side-h">{l.contents}</h3>
            {contents("side")}
          </div>
          <div className="fl-art-recent">
            <h3 className="fl-art-side-h">{l.recent}</h3>
            <ul>
              {recent.map((r) => (
                <li key={r.href}>
                  <span className="fl-eyebrow">{r.category}</span>
                  <a href={r.href}>{r.title}</a>
                  {r.date ? <span className="fl-art-recent-date">{r.date}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE: BlogArticleProps = {
  post: {
    category: "Guides",
    title: "How we cut our design review time in half",
    dek: "Four small changes to how a six-person team shares work, gives feedback and decides.",
    author: { name: "Amelia Anderson", role: "Lead designer" },
    date: "Oct 14, 2026",
    minutes: 6,
    media: "A team around a whiteboard covered in sticky notes",
    likes: 128,
    sections: [
      {
        id: "problem",
        heading: "Reviews that ran long",
        paragraphs: [
          "Our weekly design review used to take two hours. Everyone came, nobody had seen the work before, and the loudest opinion in the room usually won.",
          "Worse, decisions didn't stick. A week later someone would ask why we chose the blue button, and nobody could remember.",
        ],
      },
      {
        id: "async",
        heading: "Share the work a day early",
        paragraphs: [
          "Now every piece of work goes up the afternoon before, with one paragraph on what it's for and what kind of feedback the designer wants.",
          "People leave comments on their own time. By the meeting, the small things are already fixed and we only talk about the hard questions.",
        ],
        quote: "The meeting is for decisions. Everything else can be a comment.",
      },
      {
        id: "roles",
        heading: "Give every review a decider",
        paragraphs: [
          "Each review names one person who makes the call. Everyone else advises. It sounds strict, but it made the conversations kinder: nobody has to win the argument.",
          "The decider writes the decision down before the meeting ends, in one or two sentences.",
        ],
      },
      {
        id: "log",
        heading: "Keep a decision log",
        paragraphs: [
          "Those sentences go into a shared log with a link to the work. When the blue button comes up again, the answer takes ten seconds to find.",
          "The log has also become the best onboarding document we have. New designers read it in their first week.",
        ],
      },
      {
        id: "results",
        heading: "What changed",
        paragraphs: [
          "Reviews now take about fifty minutes. We revisit fewer decisions, and the designers say they get more useful feedback, not less.",
          "None of this needed new tools. It needed a habit, a name on each decision and a place to write it down.",
        ],
      },
    ],
  },
  recent: [
    { category: "Design tools", title: "Five plugins we use every day", href: "#post-plugins", date: "Oct 9" },
    { category: "Resources", title: "Should you build your own UI kit?", href: "#post-ui-kit", date: "Oct 2" },
    { category: "Stories", title: "What a year of design critiques taught us", href: "#post-critiques", date: "Sep 24" },
    { category: "Hiring", title: "How we run a design take-home that respects your time", href: "#post-hiring", date: "Sep 12" },
  ],
};

export default function BlogArticlePreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.post.title}>
      <div className="fl-wrap">
        <BlogArticle {...SAMPLE} />
      </div>
    </section>
  );
}
