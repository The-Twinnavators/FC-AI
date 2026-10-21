/** @flowcode-library reviews-summary · Product reviews with rating summary (Shop)
 * Catalog ID: p.reviews (pattern)
 * Function: A product reviews pattern (p.reviews): the average rating, a bar per star that filters the list, sort by newest, highest, lowest or most helpful, a Helpful vote per review, Show more paging, and Write a review, a validated form with a star rating whose new review joins the list and the summary. Adapted from Meraki UI (MIT).
 * Use it as: import { ReviewsSummary } from "./reviews-summary"; <ReviewsSummary product reviews={[{ id, author, rating: 1-5, title, body, date: "2026-10-02", verified?, helpful }]} pageSize?={4} onSubmit?={(review) => Promise<void>} />  // use only reviews the PRD supplies
 * Built from: c.rating, c.select.outlined, c.chip.input, c.button.secondary, c.button.tertiary, c.modal.form, c.text-field.outlined, c.avatar.person, c.badge, c.empty-state.no-results
 * Look: A card on the left with a large average, a row of stars, the count and five bar rows; on the right, a sort select and Write a review over review cards with a small avatar, stars, a bold title, the text, a verified tag and a Helpful button.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-warning --color-success --color-danger --color-text --color-text-muted --focus-ring --radius-md --radius-lg --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-lg --text-3xl --duration-fast --duration-base --duration-slow --ease-out --enter-distance --stagger
 * Use cases: product reviews; ratings and reviews; customer reviews; app reviews; course reviews; testimonials with ratings; marketplace reviews
 * Jobs to be done: see how well a product is rated; read only the bad reviews; find the most helpful reviews; write a review; mark a review helpful
 * Keywords: reviews, ratings, stars, average rating, rating breakdown, sort, helpful, write a review, verified
 */
/**
 * Reviews: a summary card whose star bars are toggle buttons (aria-pressed) that filter the list, a sort select, and
 * review cards with a Helpful toggle. Sorting and filtering glide the cards that stay (FLIP) and fade new ones in; bars
 * fill once on first view. Write a review opens a form dialog: the star rating is a real radio group (arrow keys move the
 * rating), and title, text and name are checked on submit with the first wrong field focused. The new review joins the
 * top of the list and the average; a failed send keeps the dialog open and says why.
 * Make it the app's own: replace SAMPLE with the real reviews and pass onSubmit to store new ones.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa): its testimonial card layouts.
 */
/**
 * How to try it
 * - Press the "2 stars" bar: only two-star reviews stay. Press "1 star" for the empty state, then Show all reviews.
 * - Choose "Lowest rated" in the sort select: the cards move to their new places.
 * - Press Helpful on a review: the count goes up and the button stays pressed. Press Show more for older reviews.
 * - Press Write a review, submit empty to see the errors, then rate with the arrow keys and send. A name of "fail"
 *   shows the failure.
 *
 * Dependencies: React (useEffect, useId, useRef, useState, flushSync from react-dom) and the library's own pieces and
 * inline icon set. Nothing else — no package to install and nothing fetched at run time. The styles are the fl-rev-
 * classes in templates/library/css/r2m-reviews.css.
 */
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { Select } from "./dropdowns-states";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── p.reviews: rating summary, star filter, sort, helpful votes, paging and a write-a-review form. ──

export type Review = {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  /** ISO date */ date: string;
  verified?: boolean;
  helpful: number;
};
export type NewReview = Pick<Review, "author" | "rating" | "title" | "body">;
export type ReviewSort = "newest" | "highest" | "lowest" | "helpful";
export type ReviewsSummaryProps = {
  product: string;
  reviews: Review[];
  /** Reviews shown before Show more; 4 when left out. */
  pageSize?: number;
  /** Stores a new review; reject with an Error to show its message. Resolves after a short pause when left out. */
  onSubmit?: (r: NewReview) => Promise<void>;
};

// ── Motion helpers (self-contained, same contract as the app's lib/motion.ts) ──

let moving: Animation[] = [];
const ms = (v: string, fallback: number) =>
  /ms$/.test(v.trim())
    ? parseFloat(v)
    : /s$/.test(v.trim())
      ? parseFloat(v) * 1000
      : fallback;
const motionOff = () =>
  document.documentElement.dataset.motion === "off" ||
  typeof Element.prototype.animate !== "function";
const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cards glide from where they were to where they are after a sort or filter; new ones fade in. */
function continuity(list: HTMLElement | null, update: () => void) {
  if (!list || motionOff() || list.children.length > 30) {
    update();
    return;
  }
  const first = new Map<string, DOMRect>();
  for (const el of Array.from(list.children) as HTMLElement[])
    if (el.dataset.key) first.set(el.dataset.key, el.getBoundingClientRect());
  for (const m of moving) m.cancel();
  moving = [];
  flushSync(update);
  const css = getComputedStyle(document.documentElement);
  const slow = ms(css.getPropertyValue("--duration-slow"), 320);
  const base = ms(css.getPropertyValue("--duration-base"), 200);
  const easing = css.getPropertyValue("--ease-out").trim() || "ease-out";
  const reduced = reducedMotion();
  for (const el of Array.from(list.children) as HTMLElement[]) {
    const was = el.dataset.key ? first.get(el.dataset.key) : undefined;
    if (!was) {
      moving.push(
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: base,
          easing,
        }),
      );
      continue;
    }
    if (reduced) continue;
    const dy = was.top - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    moving.push(
      el.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], {
        duration: slow,
        easing,
      }),
    );
  }
}

const wait = (n: number) => new Promise<void>((r) => setTimeout(r, n));
const defaultSubmit = async (r: NewReview) => {
  await wait(700);
  if (r.author.trim().toLowerCase() === "fail")
    throw new Error("We couldn't post your review. Try again in a moment.");
};
const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

/** Five stars drawn for a rating (fractions fill partly); the words go to screen readers. */
function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  return (
    <span
      className={`fl-rev-stars fl-rev-stars--${size}`}
      role="img"
      aria-label={`${value.toFixed(1).replace(/\.0$/, "")} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="fl-rev-star"
          style={{
            ["--fill" as string]: `${Math.max(0, Math.min(1, value - i)) * 100}%`,
          }}
        >
          <Icon name="star" filled />
          <span className="fl-rev-star-fill">
            <Icon name="star" filled />
          </span>
        </span>
      ))}
    </span>
  );
}

type Errors = Partial<
  Record<"rating" | "title" | "body" | "author" | "form", string>
>;

export function ReviewsSummary({
  product,
  reviews: initial,
  pageSize = 4,
  onSubmit = defaultSubmit,
}: ReviewsSummaryProps) {
  const uid = useId().replace(/:/g, "");
  const [reviews, setReviews] = useState<Review[]>(initial);
  const [stars, setStars] = useState<number | null>(null);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [limit, setLimit] = useState(pageSize);
  const [voted, setVoted] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState("");
  const [seen, setSeen] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const bars = useRef<HTMLUListElement>(null);
  const focusAt = useRef<number | null>(null);

  // Bars fill once, the first time the summary is seen.
  useEffect(() => {
    const el = bars.current;
    if (!el || motionOff() || typeof IntersectionObserver !== "function") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const i = focusAt.current;
    if (i === null) return;
    focusAt.current = null;
    list.current?.querySelectorAll<HTMLElement>(".fl-rev-title")[i]?.focus();
  }, [limit]);

  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  const byStar = (n: number) => reviews.filter((r) => r.rating === n).length;
  const sorted = [...reviews].sort((a, b) =>
    sort === "highest"
      ? b.rating - a.rating || b.date.localeCompare(a.date)
      : sort === "lowest"
        ? a.rating - b.rating || b.date.localeCompare(a.date)
        : sort === "helpful"
          ? b.helpful - a.helpful
          : b.date.localeCompare(a.date),
  );
  const filtered = stars ? sorted.filter((r) => r.rating === stars) : sorted;
  const shown = filtered.slice(0, limit);
  const left = filtered.length - shown.length;

  const change = (fn: () => void) => continuity(list.current, fn);
  const pickStars = (n: number | null) =>
    change(() => {
      setStars(n);
      setLimit(pageSize);
    });

  const vote = (r: Review) => {
    const on = voted.includes(r.id);
    setVoted((v) => (on ? v.filter((x) => x !== r.id) : [...v, r.id]));
    setReviews((all) =>
      all.map((x) =>
        x.id === r.id ? { ...x, helpful: x.helpful + (on ? -1 : 1) } : x,
      ),
    );
  };

  const open = () => {
    setErrors({});
    setRating(0);
    setWriting(true);
  };

  const submit = (data: FormData): false => {
    if (busy) return false;
    const r: NewReview = {
      rating,
      title: String(data.get("title") ?? "").trim(),
      body: String(data.get("body") ?? "").trim(),
      author: String(data.get("author") ?? "").trim(),
    };
    const next: Errors = {};
    if (!r.rating) next.rating = "Choose a rating.";
    if (!r.title) next.title = "Add a short title.";
    if (r.body.length < 20)
      next.body = r.body
        ? "Write at least 20 characters."
        : "Write your review.";
    if (!r.author) next.author = "Enter the name to show.";
    setErrors(next);
    const bad = (["rating", "title", "body", "author"] as const).find(
      (k) => next[k],
    );
    if (bad) {
      setTimeout(
        () =>
          (
            document.getElementById(`${uid}-${bad}`) ??
            document.querySelector<HTMLElement>(`input[name="${uid}-stars"]`)
          )?.focus(),
        0,
      );
      return false;
    }
    setBusy(true);
    onSubmit(r)
      .then(() => {
        const added: Review = {
          ...r,
          id: `new-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          helpful: 0,
        };
        setWriting(false);
        change(() => {
          setReviews((all) => [added, ...all]);
          setSort("newest");
          setStars(null);
        });
        setStatus("Thanks, your review is posted.");
      })
      .catch((err: unknown) => {
        setErrors({
          form:
            err instanceof Error
              ? err.message
              : "Something went wrong. Try again.",
        });
        setTimeout(() => document.getElementById(`${uid}-formerr`)?.focus(), 0);
      })
      .finally(() => setBusy(false));
    return false;
  };

  const clearErr = (k: keyof Errors) =>
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  const err = (k: keyof Errors) =>
    errors[k] ? (
      <p className="fl-rev-err" id={`${uid}-${k}-err`}>
        <Icon name="alert" />
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="fl-rev" data-fl="p.reviews">
      <div className="fl-rev-layout">
        <aside className="fl-rev-sum" aria-labelledby={`${uid}-h`}>
          <h2 id={`${uid}-h`} className="fl-rev-h">
            Reviews
          </h2>
          <div className="fl-rev-avg">
            <strong>{avg.toFixed(1)}</strong>
            <div>
              <Stars value={avg} size="lg" />
              <p>
                Based on {total} {total === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
          <ul
            className={`fl-rev-bars${seen ? " is-seen" : ""}`}
            ref={bars}
            aria-label="Filter by rating"
          >
            {[5, 4, 3, 2, 1].map((n) => {
              const c = byStar(n);
              const pct = total ? Math.round((c / total) * 100) : 0;
              return (
                <li key={n}>
                  <button
                    type="button"
                    className="fl-rev-bar"
                    aria-pressed={stars === n}
                    onClick={() => pickStars(stars === n ? null : n)}
                    aria-label={`${n} ${n === 1 ? "star" : "stars"}: ${c} ${c === 1 ? "review" : "reviews"}, ${pct}%`}
                  >
                    <span className="fl-rev-bar-n">
                      {n} <Icon name="star" filled />
                    </span>
                    <span className="fl-rev-track">
                      <span style={{ ["--pct" as string]: `${pct}%` }} />
                    </span>
                    <span className="fl-rev-bar-c">{pct}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="fl-rev-write">
            <p>Used {product}? Tell others what you think.</p>
            <Button
              variant="secondary"
              size={40}
              icon="pencil"
              onClick={open}
              block
            >
              Write a review
            </Button>
          </div>
        </aside>

        <div className="fl-rev-main">
          <div className="fl-rev-tools">
            <div className="fl-rev-filter">
              {stars ? (
                <Chip
                  variant="input"
                  onRemove={() => pickStars(null)}
                  removeLabel={`Remove the ${stars}-star filter`}
                >
                  {stars} {stars === 1 ? "star" : "stars"}
                </Chip>
              ) : null}
              <p className="fl-rev-count" role="status" aria-live="polite">
                {filtered.length} {filtered.length === 1 ? "review" : "reviews"}
                {stars
                  ? ` with ${stars} ${stars === 1 ? "star" : "stars"}`
                  : ""}
              </p>
            </div>
            <div className="fl-rev-sort">
              <label htmlFor={`${uid}-sort`}>Sort by</label>
              <Select
                id={`${uid}-sort`}
                value={sort}
                options={[
                  { value: "newest", label: "Newest" },
                  { value: "highest", label: "Highest rated" },
                  { value: "lowest", label: "Lowest rated" },
                  { value: "helpful", label: "Most helpful" },
                ]}
                onChange={(e) => {
                  const v = e.target.value as ReviewSort;
                  change(() => setSort(v));
                }}
              />
            </div>
          </div>

          <ul className="fl-rev-list" ref={list}>
            {shown.map((r) => {
              const on = voted.includes(r.id);
              return (
                <li key={r.id} data-key={r.id} className="fl-rev-item">
                  <article
                    className="fl-rev-card"
                    aria-labelledby={`${uid}-${r.id}-t`}
                  >
                    <header className="fl-rev-who">
                      <Avatar name={r.author} size={40} decorative />
                      <div>
                        <p className="fl-rev-author">{r.author}</p>
                        <p className="fl-rev-meta">
                          <time dateTime={r.date}>{fmtDate(r.date)}</time>
                          {r.verified ? (
                            <Badge tone="success" look="outline">
                              Verified buyer
                            </Badge>
                          ) : null}
                        </p>
                      </div>
                    </header>
                    <Stars value={r.rating} />
                    <h3
                      className="fl-rev-title"
                      id={`${uid}-${r.id}-t`}
                      tabIndex={-1}
                    >
                      {r.title}
                    </h3>
                    <p className="fl-rev-body">{r.body}</p>
                    <div className="fl-rev-foot">
                      <button
                        type="button"
                        className="fl-rev-helpful"
                        aria-pressed={on}
                        onClick={() => vote(r)}
                      >
                        <Icon name="thumbs-up" filled={on} />
                        Helpful
                        <span
                          className="fl-rev-hn"
                          aria-label={`, ${r.helpful} ${r.helpful === 1 ? "person" : "people"}`}
                        >
                          {r.helpful}
                        </span>
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 ? (
            <EmptyState
              variant="no-results"
              headingLevel={3}
              title={`No ${stars}-star reviews`}
              action={
                <Button
                  variant="secondary"
                  size={40}
                  onClick={() => {
                    pickStars(null);
                    document.getElementById(`${uid}-sort`)?.focus();
                  }}
                >
                  Show all reviews
                </Button>
              }
            >
              Nobody has rated it {stars} {stars === 1 ? "star" : "stars"} yet.
            </EmptyState>
          ) : null}
          {left > 0 ? (
            <div className="fl-rev-more">
              <Button
                variant="secondary"
                size={40}
                onClick={() => {
                  focusAt.current = shown.length;
                  setLimit((n) => n + pageSize);
                }}
              >
                Show more ({left})
              </Button>
            </div>
          ) : null}
          <p className="fl-rev-status" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>

      {writing ? (
        <Modal
          variant="form"
          title="Write a review"
          description={product}
          confirmLabel="Post review"
          busy={busy}
          busyLabel="Posting..."
          onConfirm={submit}
          onClose={() => !busy && setWriting(false)}
        >
          <div className="fl-rev-form">
            {errors.form ? (
              <p
                className="fl-rev-formerr"
                role="alert"
                id={`${uid}-formerr`}
                tabIndex={-1}
              >
                <Icon name="alert" />
                {errors.form}
              </p>
            ) : null}
            <fieldset
              className="fl-rev-rate"
              aria-describedby={errors.rating ? `${uid}-rating-err` : undefined}
            >
              <legend>Your rating</legend>
              <div className="fl-rev-rate-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className={`fl-rev-rate-star${n <= rating ? " is-on" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`${uid}-stars`}
                      value={n}
                      checked={rating === n}
                      onChange={() => {
                        setRating(n);
                        clearErr("rating");
                      }}
                      data-autofocus={n === 1 ? true : undefined}
                    />
                    <Icon name="star" filled={n <= rating} />
                    <span className="fl-sr">
                      {n} {n === 1 ? "star" : "stars"}
                    </span>
                  </label>
                ))}
                <span className="fl-rev-rate-word" aria-hidden="true">
                  {
                    ["", "Poor", "Fair", "Good", "Very good", "Excellent"][
                      rating
                    ]
                  }
                </span>
              </div>
              {err("rating")}
            </fieldset>
            <div className="fl-field">
              <label htmlFor={`${uid}-title`}>Title</label>
              <TextField
                id={`${uid}-title`}
                name="title"
                onInput={() => clearErr("title")}
                maxLength={80}
                invalid={!!errors.title}
                aria-describedby={errors.title ? `${uid}-title-err` : undefined}
              />
              {err("title")}
            </div>
            <div className="fl-field">
              <label htmlFor={`${uid}-body`}>Review</label>
              <TextField
                id={`${uid}-body`}
                name="body"
                onInput={() => clearErr("body")}
                multiline
                autoGrow
                rows={4}
                maxLength={1200}
                invalid={!!errors.body}
                aria-describedby={errors.body ? `${uid}-body-err` : undefined}
              />
              {err("body")}
            </div>
            <div className="fl-field">
              <label htmlFor={`${uid}-author`}>Name to show</label>
              <TextField
                id={`${uid}-author`}
                name="author"
                onInput={() => clearErr("author")}
                autoComplete="nickname"
                invalid={!!errors.author}
                aria-describedby={
                  errors.author ? `${uid}-author-err` : undefined
                }
              />
              {err("author")}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE: ReviewsSummaryProps = {
  product: "Trailhead 28L backpack",
  pageSize: 4,
  reviews: [
    {
      id: "r1",
      author: "Maya Chen",
      rating: 5,
      title: "Carries like a dream",
      body: "Took it on a three-day hike. The hip belt takes the weight off your shoulders and nothing rubbed.",
      date: "2026-10-12",
      verified: true,
      helpful: 14,
    },
    {
      id: "r2",
      author: "Daniel Ortiz",
      rating: 4,
      title: "Great pack, small side pockets",
      body: "Comfortable and tough. The side pockets barely fit a one-liter bottle, which is my only gripe.",
      date: "2026-10-05",
      verified: true,
      helpful: 9,
    },
    {
      id: "r3",
      author: "Priya Nair",
      rating: 5,
      title: "Worth every dollar",
      body: "I use it for commuting and weekend trips. The laptop sleeve is padded and the rain cover works.",
      date: "2026-09-28",
      helpful: 6,
    },
    {
      id: "r4",
      author: "Tom Becker",
      rating: 3,
      title: "Good but runs short",
      body: "Nice materials, but the torso length is short for me at six foot three. Check the size chart.",
      date: "2026-09-20",
      verified: true,
      helpful: 11,
    },
    {
      id: "r5",
      author: "Leila Haddad",
      rating: 5,
      title: "My new everyday bag",
      body: "Lots of pockets without feeling cluttered. The zippers are smooth and the color hasn't faded.",
      date: "2026-09-11",
      helpful: 3,
    },
    {
      id: "r6",
      author: "Chris Park",
      rating: 2,
      title: "Strap came loose",
      body: "One shoulder strap buckle slipped after two weeks. Support sent a replacement quickly, though.",
      date: "2026-08-30",
      verified: true,
      helpful: 7,
    },
    {
      id: "r7",
      author: "Ana Souza",
      rating: 4,
      title: "Light and roomy",
      body: "Fits more than I expected for 28 liters. Would love a key clip inside the top pocket.",
      date: "2026-08-18",
      helpful: 2,
    },
  ],
};

export default function ReviewsSummaryPreview() {
  return (
    <section className="fl-section" aria-label={`Reviews of ${SAMPLE.product}`}>
      <div className="fl-wrap">
        <ReviewsSummary {...SAMPLE} />
      </div>
    </section>
  );
}
