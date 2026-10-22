/** @flowcode-library public-profile · Public profile page (Cards)
 * Catalog ID: p.public-profile (pattern)
 * Function: A member's public profile (p.public-profile): a cover, a large avatar, name, handle, bio, place, joined date and website; Follow (the follower count bumps and you join their followers), Message in a validated dialog, and a More menu button with Copy profile link, Mute and Block (after a confirm, with Unblock); Posts, About and Followers tabs with a sliding underline; posts with a picture placeholder, a like that pops, Share and Load more (older posts slide in); followers you can follow back with one Tab stop; loading, a load error with Retry and empty states, every change announced. Adapted from Meraki UI and Creative Tim UI (MIT).
 * Use it as: import { PublicProfile } from "./public-profile"; <PublicProfile me="Signed-in name" person={{ name, handle, headline?, bio, location?, joined: ISO, website?: { label, href }, verified?, interests?: string[], cover?: "a"|"b"|"c"|"d"|"e" }} followers={1280} following={312} isFollowing? posts?={[{ id, at: ISO, text, art?, alt?, likes, liked?, replies, pinned? }]} people?={[{ id, name, handle, followed? }]} load?={async () => ({ posts, people })} loadMore?={async () => ProfilePost[]} onFollow?={async (on) => void} onMessage?={async (text) => void} onBlock?={(on) => ...} profileUrl? labels?={{ follow, following, message, ... }} />
 * Built from: c.media-frame, c.avatar.person, c.badge.status, c.chip.static, c.tabs.underline-slide, c.menu, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.form, c.modal.danger, c.empty-state, c.skeleton
 * Look: A white card with a wide gradient cover across the top and a large round avatar overlapping its lower edge; beside it, Follow, Message and a round More button; then the bold name with a verified tick, a muted handle and headline, the bio, a row of place, joined date and website, and three counts (Posts, Followers, Following). Below, a Posts / About / Followers tab row with a straight accent bar that slides under the chosen tab, and post cards with text, an optional picture, a heart and count, replies and Share.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --surface-radius --surface-shadow --surface-shadow-overlay --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-md --text-xl --font-display --weight-medium --weight-semibold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: member profile; creator profile; public profile page; community profile; author page; artist page; coach or instructor profile; social app profile
 * Jobs to be done: see who someone is and what they post; follow someone; message someone; see who follows them; share a profile; mute or block someone
 * Keywords: profile, public profile, follow, followers, following, bio, cover, avatar, posts, tabs, like, message, block, mute, social, community
 */
/**
 * Public profile. The tabs follow the WAI-ARIA tabs pattern (arrow keys, Home and End move and choose; the bar slides
 * to the chosen tab). The More menu is a menu button (arrow keys move, Escape closes and returns focus). The followers
 * list has one Tab stop: Up and Down move between the Follow buttons. Following bumps the count and slides you into
 * their followers; likes pop; new posts from Load more slide in, staggered; dialogs and the menu rise in
 * (@starting-style). With motion off everything simply appears.
 * Make it the app's own: replace SAMPLE with the real person, pass onFollow, onMessage and onBlock to save, and swap the
 * gradient pictures for real ones with alt text (art becomes src on the media frame).
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa), its user card with details, avatar and line
 * tabs components, and Creative Tim UI (MIT License, Copyright (c) 2025 Creative Tim), its account profile blocks.
 */
/**
 * How to try it
 * - Wait for the profile to load. Press Follow: the follower count bumps; open Followers: you're at the top.
 * - Press the heart on a post: it pops and counts. Press Share: the link is copied (or shown).
 * - Use the arrow keys on the tabs: the bar slides. Press Load more on Posts: older posts slide in.
 * - Press Message, send it empty (it asks for a message), then write one and send.
 * - Open More (the dots): Mute, then Block and confirm. Unblock brings everything back.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's MediaFrame, Avatar, Badge,
 * Chip, TextField, Button, Modal, EmptyState and Skeleton ("./media-frames", "./avatars-variants", "./badges-status",
 * "./chips-tags", "./text-fields-states", "./buttons-variants", "./modals-dialogs", "./empty-states",
 * "./skeleton-loading") and its inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles are
 * the library's own fl- classes in templates/library/css/r6c-public-profile.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Modal } from "./modals-dialogs";
import { Skeleton } from "./skeleton-loading";
import { TextField } from "./text-fields-states";

// ── p.public-profile: someone's public page with follow, tabs, posts and followers. ──

export type ProfilePerson = {
  name: string;
  handle: string;
  headline?: string;
  bio: string;
  location?: string;
  joined: string;
  website?: { label: string; href: string };
  verified?: boolean;
  interests?: string[];
  cover?: MediaArt;
};
export type ProfilePost = { id: string; at: string; text: string; art?: MediaArt; alt?: string; likes: number; liked?: boolean; replies: number; pinned?: boolean };
export type ProfileFollower = { id: string; name: string; handle: string; followed?: boolean };
type Labels = {
  follow: string; following: string; message: string; more: string; copyLink: string; mute: string; unmute: string; block: string; unblock: string; muted: string;
  posts: string; about: string; followers: string; followingCount: string; joined: string; website: string; location: string; interests: string; pinned: string;
  like: string; replies: string; share: string; copied: string; copyFailed: string; loadMore: string; loadingMore: string; noMore: string; noPosts: string; noPostsText: string;
  noFollowers: string; noFollowersText: string; loadFailed: string; retry: string; loading: string; blocked: string; blockedText: string; blockTitle: string; blockText: string;
  blockConfirm: string; messageTitle: string; messageLabel: string; send: string; needMessage: string; sent: string; sendFailed: string; you: string; tabs: string;
};
export type PublicProfileProps = {
  me: string;
  person: ProfilePerson;
  followers: number;
  following: number;
  isFollowing?: boolean;
  posts?: ProfilePost[];
  people?: ProfileFollower[];
  load?: () => Promise<{ posts: ProfilePost[]; people: ProfileFollower[] }>;
  /** Older posts; return an empty list when there are no more. */
  loadMore?: () => Promise<ProfilePost[]>;
  onFollow?: (on: boolean) => Promise<void> | void;
  onMessage?: (text: string) => Promise<void> | void;
  onBlock?: (on: boolean) => void;
  profileUrl?: string;
  labels?: Partial<Labels>;
};

// ── Helpers ──

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];
const toneOf = (name: string) => TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length]!;
const rtf = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl ? new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }) : null;
function ago(iso: string) {
  let v = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 7], ["week", 4.35], ["month", 12], ["year", Infinity]];
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf ? rtf.format(Math.round(v), unit) : new Date(iso).toLocaleDateString();
    v /= size;
  }
  return new Date(iso).toLocaleDateString();
}
const compact = (n: number) => (n < 10_000 ? n.toLocaleString("en-US") : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n));
function Bump({ n, className, format = compact }: { n: number; className: string; format?: (n: number) => string }) {
  const prev = useRef(n);
  const [k, setK] = useState(0);
  useEffect(() => {
    if (prev.current !== n) {
      prev.current = n;
      setK((x) => x + 1);
    }
  }, [n]);
  return (
    <span key={k} className={`${className}${k ? " is-bump" : ""}`}>
      {format(n)}
    </span>
  );
}
function Like({ on, count, label, onToggle }: { on: boolean; count: number; label: string; onToggle: () => void }) {
  const [pop, setPop] = useState(0);
  return (
    <button
      type="button"
      className="fl-pubp-act fl-pubp-like"
      aria-pressed={on}
      aria-label={`${label}, ${count}`}
      onClick={() => {
        if (!on) setPop((p) => p + 1);
        onToggle();
      }}
    >
      <span key={pop} className={`fl-pubp-heart${pop ? " is-pop" : ""}`}>
        <Icon name="heart" filled={on} />
      </span>
      <Bump n={count} className="fl-pubp-n" />
    </button>
  );
}
const TICK = "M12 2.5l2.4 1.8 3-.1.9 2.8 2.4 1.8-.9 2.8.9 2.8-2.4 1.8-.9 2.8-3-.1L12 21.5l-2.4-1.8-3 .1-.9-2.8-2.4-1.8.9-2.8-.9-2.8 2.4-1.8.9-2.8 3 .1zM8.5 12.2l2.3 2.3 4.7-4.9";
const REPLY = "M4 5h16v11H9l-5 4z";

// ── The profile ──

export function PublicProfile({ me, person, followers: startFollowers, following, isFollowing = false, posts: givenPosts, people: givenPeople, load, loadMore, onFollow, onMessage, onBlock, profileUrl, labels = {} }: PublicProfileProps) {
  const l: Labels = {
    follow: "Follow", following: "Following", message: "Message", more: "More", copyLink: "Copy profile link", mute: "Mute", unmute: "Unmute", block: "Block", unblock: "Unblock", muted: "Muted",
    posts: "Posts", about: "About", followers: "Followers", followingCount: "Following", joined: "Joined", website: "Website", location: "Lives in", interests: "Interests", pinned: "Pinned",
    like: "Like", replies: "replies", share: "Share", copied: "Link copied", copyFailed: "Couldn't copy. The link is", loadMore: "Load more", loadingMore: "Loading...", noMore: "That's every post.",
    noPosts: "No posts yet", noPostsText: "When they post, it shows up here.", noFollowers: "No followers yet", noFollowersText: "Be the first to follow.", loadFailed: "Couldn't load this profile.",
    retry: "Try again", loading: "Loading the profile", blocked: "You blocked", blockedText: "You won't see their posts, and they can't follow or message you.", blockTitle: "Block", blockText: "They won't be able to follow or message you, and you won't see their posts. They aren't told.",
    blockConfirm: "Block", messageTitle: "Message", messageLabel: "Your message", send: "Send", needMessage: "Write a message first.", sent: "Message sent", sendFailed: "Couldn't send. Try again.", you: "You", tabs: "Profile sections",
    ...labels,
  };
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [posts, setPosts] = useState<ProfilePost[]>(givenPosts ?? []);
  const [people, setPeople] = useState<ProfileFollower[]>(givenPeople ?? []);
  const [state, setState] = useState<"ready" | "loading" | "error">((givenPosts && givenPeople) || !load ? "ready" : "loading");
  const [tab, setTab] = useState<"posts" | "about" | "followers">("posts");
  const [follows, setFollows] = useState(isFollowing);
  const [count, setCount] = useState(startFollowers);
  const [followBusy, setFollowBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [writing, setWriting] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState("");
  const [sending, setSending] = useState(false);
  const [more, setMore] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [freshPosts, setFreshPosts] = useState<string[]>([]);
  const [freshMe, setFreshMe] = useState(false);
  const [rove, setRove] = useState(0);
  const [status, setStatus] = useState("");
  const [focusTo, setFocusTo] = useState<{ id: string; n: number } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const run = () => {
    if (!load) return;
    setState("loading");
    load().then(
      (d) => {
        setPosts(d.posts);
        setPeople(d.people);
        setState("ready");
      },
      () => setState("error"),
    );
  };
  useEffect(() => {
    if (!(givenPosts && givenPeople) && load) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (focusTo) document.getElementById(focusTo.id)?.focus();
  }, [focusTo]);
  const focusLater = (id: string) => setFocusTo({ id, n: Date.now() });

  // The tab bar slides under the chosen tab; the first placement doesn't slide.
  useLayoutEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const place = () => {
      const on = el.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!on) return;
      el.style.setProperty("--bar-x", `${on.offsetLeft}px`);
      el.style.setProperty("--bar-w", `${on.offsetWidth}px`);
      if (!el.dataset.ready) setTimeout(() => (el.dataset.ready = "1"), 0);
    };
    place();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, blocked, state]);

  // The menu opens with focus on its first (or, from the Up arrow, last) item.
  const menuAt = useRef<"first" | "last">("first");
  useEffect(() => {
    if (!menu) return;
    const els = menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]");
    els?.[menuAt.current === "first" ? 0 : els.length - 1]?.focus();
  }, [menu]);
  // The menu closes on a click outside it.
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !moreBtn.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menu]);

  const first = person.name.split(" ")[0];
  const url = profileUrl ?? `${typeof location !== "undefined" ? location.href.split("#")[0] : ""}#${person.handle}`;
  const copy = async (link: string) => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(link);
      setStatus(l.copied);
    } catch {
      setStatus(`${l.copyFailed} ${link}`);
    }
  };

  const follow = async () => {
    const on = !follows;
    setFollowBusy(true);
    try {
      await onFollow?.(on);
      setFollows(on);
      setCount((c) => c + (on ? 1 : -1));
      setFreshMe(on);
      setStatus(on ? `Following ${person.name}` : `Unfollowed ${person.name}`);
    } catch {
      setStatus("Couldn't change that. Try again.");
    } finally {
      setFollowBusy(false);
    }
  };
  const like = (p: ProfilePost) => {
    const on = !p.liked;
    setPosts((all) => all.map((x) => (x.id === p.id ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x)));
    setStatus(on ? "Liked" : "Like removed");
  };
  const followBack = (f: ProfileFollower) => {
    setPeople((all) => all.map((x) => (x.id === f.id ? { ...x, followed: !x.followed } : x)));
    setStatus(f.followed ? `Unfollowed ${f.name}` : `Following ${f.name}`);
  };
  const older = async () => {
    if (!loadMore) return;
    setMore("loading");
    try {
      const got = await loadMore();
      const fresh = got.filter((p) => !posts.some((x) => x.id === p.id));
      if (!fresh.length) {
        setMore("done");
        setStatus(l.noMore);
        return;
      }
      setPosts((all) => [...all, ...fresh]);
      setFreshPosts(fresh.map((p) => p.id));
      setMore("idle");
      setStatus(`${fresh.length} more posts`);
      focusLater(`${uid}-post-${fresh[0]!.id}`);
    } catch {
      setMore("error");
    }
  };
  const send = (): false => {
    const text = msg.trim();
    if (!text) {
      setMsgError(l.needMessage);
      document.getElementById(`${uid}-msg`)?.focus();
      return false;
    }
    setSending(true);
    Promise.resolve()
      .then(() => onMessage?.(text))
      .then(
        () => {
          setSending(false);
          setWriting(false);
          setMsg("");
          setStatus(`${l.sent} to ${person.name}`);
        },
        () => {
          setSending(false);
          setMsgError(l.sendFailed);
        },
      );
    return false;
  };
  const doBlock = (on: boolean) => {
    setBlocked(on);
    onBlock?.(on);
    if (on) {
      if (follows) {
        setFollows(false);
        setCount((c) => c - 1);
      }
      setStatus(`Blocked ${person.name}`);
      focusLater(`${uid}-unblock`);
    } else {
      setStatus(`Unblocked ${person.name}`);
      focusLater(`${uid}-follow`);
    }
  };

  // Menu button: opens on the first item; arrows move; Escape closes and returns focus.
  const items = [
    { id: "copy", label: l.copyLink, icon: "link", run: () => copy(url) },
    { id: "mute", label: muted ? l.unmute : l.mute, icon: "bell", run: () => (setMuted((m) => !m), setStatus(muted ? `Unmuted ${person.name}` : `Muted ${person.name}. Their posts won't show in your feed.`)) },
    { id: "block", label: blocked ? l.unblock : l.block, icon: "lock", run: () => (blocked ? doBlock(false) : setConfirmBlock(true)) },
  ];
  const openMenu = (at: "first" | "last" = "first") => {
    menuAt.current = at;
    setMenu(true);
  };
  const closeMenu = () => {
    setMenu(false);
    moreBtn.current?.focus();
  };
  const menuKeys = (e: KeyboardEvent<HTMLUListElement>) => {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    const n = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? els.length - 1 : null;
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      closeMenu();
      return;
    }
    if (n === null) return;
    e.preventDefault();
    els[(n + els.length) % els.length]?.focus();
  };

  const TABS = [
    { id: "posts" as const, label: l.posts, n: posts.length },
    { id: "about" as const, label: l.about },
    { id: "followers" as const, label: l.followers, n: count },
  ];
  const tabKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const t = TABS[(n + TABS.length) % TABS.length]!;
    setTab(t.id);
    document.getElementById(`${uid}-tab-${t.id}`)?.focus();
  };
  const goTab = (id: typeof tab) => {
    setTab(id);
    focusLater(`${uid}-tab-${id}`);
  };

  const sortedPosts = [...posts].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at));
  const shownPeople: (ProfileFollower & { me?: boolean })[] = follows ? [{ id: "__me", name: me, handle: l.you.toLowerCase(), me: true }, ...people] : people;
  const roveKeys = (e: KeyboardEvent<HTMLUListElement>) => {
    const btns = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button"));
    const i = btns.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const n = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const to = Math.max(0, Math.min(btns.length - 1, n));
    setRove(to);
    btns[to]?.focus();
  };

  const panel = () => {
    if (state === "loading")
      return (
        <div className="fl-pubp-skel">
          <Skeleton variant="card" />
          <Skeleton variant="card" seed={1} />
        </div>
      );
    if (state === "error")
      return (
        <EmptyState
          variant="error"
          title={l.loadFailed}
          action={
            <Button variant="secondary" size={40} icon="refresh" onClick={run}>
              {l.retry}
            </Button>
          }
        />
      );
    if (tab === "posts") {
      if (!posts.length)
        return (
          <EmptyState variant="first-use" icon="image" title={l.noPosts}>
            {l.noPostsText}
          </EmptyState>
        );
      return (
        <>
          <ul className="fl-pubp-posts">
            {sortedPosts.map((p) => {
              const fi = freshPosts.indexOf(p.id);
              return (
                <li key={p.id} className={fi >= 0 ? "is-new" : undefined} style={fi >= 0 ? ({ "--i": fi } as CSSProperties) : undefined} onAnimationEnd={(e) => e.target === e.currentTarget && setFreshPosts((f) => f.filter((x) => x !== p.id))}>
                  <article className="fl-pubp-post" id={`${uid}-post-${p.id}`} tabIndex={-1} aria-label={`${person.name}, ${ago(p.at)}`}>
                    <header className="fl-pubp-posthead">
                      <Avatar name={person.name} size={32} tone={toneOf(person.name)} decorative />
                      <span className="fl-pubp-postwho">
                        <strong>{person.name}</strong>
                        <time dateTime={p.at}>{ago(p.at)}</time>
                      </span>
                      {p.pinned ? <Badge tone="neutral">{l.pinned}</Badge> : null}
                    </header>
                    <p className="fl-pubp-text">{p.text}</p>
                    {p.art ? <MediaFrame ratio="16-9" art={p.art} alt={p.alt ?? ""} className="fl-pubp-pic" /> : null}
                    <div className="fl-pubp-acts">
                      <Like on={!!p.liked} count={p.likes} label={l.like} onToggle={() => like(p)} />
                      <span className="fl-pubp-replies">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={REPLY} />
                        </svg>
                        {p.replies} {l.replies}
                      </span>
                      <button type="button" className="fl-pubp-act" onClick={() => copy(`${url}/posts/${p.id}`)}>
                        <Icon name="share" />
                        {l.share}
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          {loadMore && more !== "done" ? (
            <div className="fl-pubp-more">
              {more === "error" ? <span className="fl-pubp-error">Couldn't load older posts.</span> : null}
              <Button variant="secondary" size={40} busy={more === "loading"} onClick={older}>
                {more === "loading" ? l.loadingMore : more === "error" ? l.retry : l.loadMore}
              </Button>
            </div>
          ) : more === "done" ? (
            <p className="fl-pubp-end">{l.noMore}</p>
          ) : null}
        </>
      );
    }
    if (tab === "about") {
      return (
        <div className="fl-pubp-about">
          <p>{person.bio}</p>
          <dl>
            {person.location ? (
              <div>
                <dt>{l.location}</dt>
                <dd>{person.location}</dd>
              </div>
            ) : null}
            <div>
              <dt>{l.joined}</dt>
              <dd>{new Date(person.joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</dd>
            </div>
            {person.website ? (
              <div>
                <dt>{l.website}</dt>
                <dd>
                  <a className="fl-pubp-link" href={person.website.href} target="_blank" rel="noreferrer">
                    {person.website.label}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          {person.interests?.length ? (
            <div className="fl-pubp-interests">
              <h3>{l.interests}</h3>
              <ul>
                {person.interests.map((t) => (
                  <li key={t}>
                    <Chip variant="static">{t}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      );
    }
    if (!shownPeople.length)
      return (
        <EmptyState variant="first-use" icon="users" title={l.noFollowers}>
          {l.noFollowersText}
        </EmptyState>
      );
    let bi = -1;
    return (
      <ul className="fl-pubp-people" aria-label={`${person.name}'s ${l.followers.toLowerCase()}`} onKeyDown={roveKeys}>
        {shownPeople.map((f) => {
          if (!f.me) bi += 1;
          const idx = bi;
          return (
            <li key={f.id} className={f.me && freshMe ? "is-new" : undefined} onAnimationEnd={() => f.me && setFreshMe(false)}>
              <Avatar name={f.name} size={40} tone={toneOf(f.name)} decorative />
              <span className="fl-pubp-who">
                <strong>{f.me ? `${f.name} (${l.you})` : f.name}</strong>
                {f.me ? null : <span>@{f.handle}</span>}
              </span>
              {f.me ? null : (
                <button type="button" className={`fl-pubp-mini${f.followed ? " is-on" : ""}`} aria-pressed={!!f.followed} aria-label={`${f.followed ? l.following : l.follow} ${f.name}`} tabIndex={idx === Math.min(rove, people.length - 1) ? 0 : -1} onClick={() => followBack(f)} onFocus={() => setRove(idx)}>
                  {f.followed ? <Icon name="check" /> : null}
                  {f.followed ? l.following : l.follow}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <article className="fl-pubp" data-fl="p.public-profile" aria-labelledby={`${uid}-name`} aria-busy={state === "loading" || undefined}>
      <div className="fl-pubp-cover">
        <MediaFrame ratio="16-9" art={person.cover ?? "c"} alt="" />
      </div>
      <div className="fl-pubp-top">
        <span className="fl-pubp-avatar">
          <Avatar name={person.name} size={96} tone={toneOf(person.name)} decorative />
        </span>
        <div className="fl-pubp-buttons">
          {blocked ? null : (
            <>
              <Button id={`${uid}-follow`} size={40} variant={follows ? "secondary" : "primary"} icon={follows ? "check" : "plus"} pressed={follows} busy={followBusy} onClick={follow} className="fl-pubp-follow">
                {follows ? l.following : l.follow}
              </Button>
              <Button
                size={40}
                variant="secondary"
                icon="mail"
                onClick={() => {
                  setMsg("");
                  setMsgError("");
                  setWriting(true);
                }}
              >
                {l.message}
              </Button>
            </>
          )}
          <div className="fl-pubp-menuwrap">
            <button
              ref={moreBtn}
              type="button"
              className="fl-pubp-morebtn"
              aria-label={`${l.more}: ${person.name}`}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-controls={`${uid}-menu`}
              onClick={() => (menu ? setMenu(false) : openMenu())}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  openMenu(e.key === "ArrowUp" ? "last" : "first");
                }
              }}
            >
              <Icon name="more" />
            </button>
            {menu ? (
              <ul className="fl-pubp-menu" role="menu" id={`${uid}-menu`} aria-label={l.more} ref={menuRef} onKeyDown={menuKeys}>
                {items.map((it) => (
                  <li key={it.id} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      className={it.id === "block" && !blocked ? "is-danger" : undefined}
                      onClick={() => {
                        closeMenu();
                        it.run();
                      }}
                    >
                      <Icon name={it.icon} />
                      {it.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <header className="fl-pubp-id">
        <h2 id={`${uid}-name`}>
          {person.name}
          {person.verified ? (
            <span className="fl-pubp-verified" title="Verified">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={TICK} />
              </svg>
              <span className="fl-sr">Verified</span>
            </span>
          ) : null}
          {muted ? <Badge tone="warning">{l.muted}</Badge> : null}
        </h2>
        <p className="fl-pubp-handle">
          @{person.handle}
          {person.headline ? ` · ${person.headline}` : ""}
        </p>
        {blocked ? null : <p className="fl-pubp-bio">{person.bio}</p>}
        <ul className="fl-pubp-facts">
          {person.location ? (
            <li>
              <Icon name="pin" />
              {person.location}
            </li>
          ) : null}
          <li>
            <Icon name="calendar" />
            {l.joined} {new Date(person.joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </li>
          {person.website ? (
            <li>
              <Icon name="link" />
              <a className="fl-pubp-link" href={person.website.href} target="_blank" rel="noreferrer">
                {person.website.label}
              </a>
            </li>
          ) : null}
        </ul>
        {blocked ? null : (
          <ul className="fl-pubp-stats">
            <li>
              <button type="button" onClick={() => goTab("posts")}>
                <Bump n={posts.length} className="fl-pubp-statn" /> {l.posts}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => goTab("followers")}>
                <Bump n={count} className="fl-pubp-statn" /> {l.followers}
              </button>
            </li>
            <li>
              <span>
                <span className="fl-pubp-statn">{compact(following)}</span> {l.followingCount}
              </span>
            </li>
          </ul>
        )}
      </header>

      {blocked ? (
        <div className="fl-pubp-blocked">
          <Icon name="lock" />
          <p>
            <strong>
              {l.blocked} @{person.handle}
            </strong>
            {l.blockedText}
          </p>
          <Button id={`${uid}-unblock`} variant="secondary" size={40} onClick={() => doBlock(false)}>
            {l.unblock}
          </Button>
        </div>
      ) : (
        <>
          <div className="fl-pubp-tabs" role="tablist" aria-label={l.tabs} ref={tabsRef} onKeyDown={tabKeys}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`${uid}-panel`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.n !== undefined && state === "ready" ? <span className="fl-pubp-tabn">{compact(t.n)}</span> : null}
              </button>
            ))}
            <span className="fl-pubp-bar" aria-hidden="true" />
          </div>
          <div className="fl-pubp-panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`} key={tab}>
            {panel()}
          </div>
        </>
      )}

      <p className="fl-pubp-status" role="status" aria-live="polite">
        {state === "loading" ? l.loading : status}
      </p>

      {writing ? (
        <Modal variant="form" className="fl-pubp-dlg" title={`${l.messageTitle} ${first}`} confirmLabel={l.send} busy={sending} busyLabel="Sending..." onConfirm={() => send()} onClose={() => setWriting(false)}>
          <label htmlFor={`${uid}-msg`} className="fl-pubp-label">
            {l.messageLabel}
          </label>
          <TextField
            id={`${uid}-msg`}
            multiline
            rows={4}
            data-autofocus=""
            value={msg}
            maxLength={1000}
            invalid={!!msgError}
            aria-describedby={msgError ? `${uid}-msgerr` : undefined}
            onChange={(e) => {
              setMsg(e.target.value);
              if (msgError) setMsgError("");
            }}
          />
          {msgError ? (
            <p className="fl-pubp-error" id={`${uid}-msgerr`} role="alert">
              {msgError}
            </p>
          ) : null}
        </Modal>
      ) : null}
      {confirmBlock ? (
        <Modal variant="danger" className="fl-pubp-dlg" icon="lock" title={`${l.blockTitle} @${person.handle}?`} description={l.blockText} confirmLabel={l.blockConfirm} onConfirm={() => doBlock(true)} onClose={() => setConfirmBlock(false)} />
      ) : null}
    </article>
  );
}

// flowcode:sample
const SAMPLE = (() => {
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
  const posts: ProfilePost[] = [
    { id: "p1", pinned: true, at: at(24 * 30), text: "New here? I post a short trail report every Sunday: distance, mud level and where to get coffee after.", likes: 214, replies: 31 },
    { id: "p2", at: at(5), text: "Bear Creek loop this morning. Fog until nine, then the whole valley lit up. Trail's dry past the bridge.", art: "b", alt: "Fog lifting over a forest valley", likes: 86, replies: 12 },
    { id: "p3", at: at(30), text: "Reminder: the north lot closes at sunset now. Got a polite note on my windshield last night.", likes: 41, replies: 6, liked: true },
    { id: "p4", at: at(72), text: "Tried the new ridge connector. Steep, rocky, worth it. Bring more water than you think.", art: "d", alt: "A rocky ridge trail under a clear sky", likes: 132, replies: 19 },
  ];
  const older: ProfilePost[] = [
    { id: "p5", at: at(24 * 6), text: "Trail report: Miller Falls is running high after the rain. Wear boots, not trail runners.", likes: 58, replies: 7 },
    { id: "p6", at: at(24 * 9), text: "Shoutout to whoever left the dog water bowl at the Pine Gap trailhead. Legend.", art: "e", alt: "A trailhead sign beside a water bowl", likes: 203, replies: 24 },
  ];
  const people: ProfileFollower[] = [
    { id: "f1", name: "Jordan Blake", handle: "jordanhikes", followed: true },
    { id: "f2", name: "Priya Raman", handle: "priyaoutside" },
    { id: "f3", name: "Tom Okafor", handle: "tomokafor" },
    { id: "f4", name: "Ana Silva", handle: "anasilva", followed: true },
    { id: "f5", name: "Leo Martins", handle: "leoruns" },
  ];
  return {
    me: "Maya Chen",
    person: {
      name: "Rosa Delgado",
      handle: "rosatrails",
      headline: "Trail runner and weekend guide",
      bio: "Mapping every trail within an hour of the city, one muddy Sunday at a time. Volunteer with the county trail crew.",
      location: "Portland, OR",
      joined: new Date(new Date().getFullYear() - 2, 2, 14).toISOString(),
      website: { label: "rosatrails.example", href: "#rosatrails-site" },
      verified: true,
      interests: ["Trail running", "Volunteering", "Maps", "Photography", "Coffee"],
      cover: "b" as MediaArt,
    },
    followers: 1284,
    following: 312,
    posts,
    older,
    people,
  };
})();

export default function PublicProfilePreview() {
  const served = useRef(false);
  return (
    <section className="fl-section fl-section--canvas" aria-label={`${SAMPLE.person.name}'s profile`}>
      <div className="fl-wrap fl-wrap--narrow">
        <PublicProfile
          me={SAMPLE.me}
          person={SAMPLE.person}
          followers={SAMPLE.followers}
          following={SAMPLE.following}
          profileUrl={`https://trails.example/@${SAMPLE.person.handle}`}
          load={() => new Promise((ok) => setTimeout(() => ok({ posts: SAMPLE.posts, people: SAMPLE.people }), 700))}
          loadMore={() =>
            new Promise((ok) =>
              setTimeout(() => {
                ok(served.current ? [] : SAMPLE.older);
                served.current = true;
              }, 600),
            )
          }
          onFollow={() => new Promise((ok) => setTimeout(ok, 250))}
          onMessage={() => new Promise((ok) => setTimeout(ok, 400))}
        />
      </div>
    </section>
  );
}
