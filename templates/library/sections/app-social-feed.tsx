/** @flowcode-library app-social-feed · Social feed (App screens)
 * Catalog ID: t.app-social-feed (template)
 * Function: An app screen: a social platform's home feed with a composer, posts whose like, reply, repost and save counts toggle, inline replies, trending topics that filter the feed and follow buttons, assembled from catalog avatars, text fields, buttons and badges.
 * Use it as: Copy app-social-feed.tsx (FlowCode brings the components it uses); replace SAMPLE with the platform's own people, posts, topics and suggestions, and load and save posts, likes, replies and follows through the app's own data instead of this screen's memory.
 * Built from: c.avatar.person, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status
 * Look: A left rail of sections with an unread count, a composer card, a column of post cards with like, reply, repost and save counts (one with a photo), and a right column of trending topics and people to follow.
 * Use cases: social network; community app; home feed; activity feed; neighborhood app; club or member community; microblog; creator platform
 * Jobs to be done: see what people I follow are posting; share an update with a photo; like, reply to or save a post; find trending topics; discover people to follow
 * Keywords: app, social, feed, posts, timeline, community, likes, follow
 */
/**
 * App screen: a social platform's home feed. A left rail with the product name and its sections (Home, Explore,
 * Notifications with an unread count, Messages, Profile), a composer ("What's new?") with a photo attachment, a
 * character count and Post, then the feed: each post has its author, handle, time, text and sometimes a photo, with
 * Like, Reply, Repost and Save buttons whose counts change as you press them. Reply opens a short reply field under
 * the post. The right column lists trending topics (pick one to filter the feed) and people to follow. Every control
 * works by keyboard; on narrow screens the rail becomes a row of icons at the top and the right column moves below the
 * feed. Use it as the first screen of a community, club or neighborhood app. Make it the app's own: replace SAMPLE
 * with the platform's real people, posts and topics, and load and save them through the app's own data.
 */
/**
 * Assembled from: side rail (inline nav, count pill) > composer (c.avatar, c.text-field.outlined multiline,
 * c.button.tertiary attach, c.button.primary Post) > feed of posts (c.avatar, inline photo drawn in SVG, inline
 * toggle actions, reply form with c.text-field.outlined and c.button.primary) > right column (trending topics as
 * filter buttons, who to follow with c.avatar and c.button.primary / c.button.secondary toggles, c.badge.status).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Badge } from "./badges-status";
import { TextField } from "./text-fields-states";

// flowcode:sample
const SAMPLE = {
  product: "Commons",
  mark: "C",
  me: { name: "Maya Brooks", handle: "@mayabrooks", bio: "Neighborhood newsletter editor. Coffee, bikes and city council notes." },
  nav: [
    { id: "home", label: "Home", icon: "home" },
    { id: "explore", label: "Explore", icon: "search" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "messages", label: "Messages", icon: "mail" },
    { id: "profile", label: "Profile", icon: "user" },
  ],
  composer: {
    label: "Write a post",
    prompt: "What's new?",
    attach: "Attach a photo",
    attached: "rooftop-beds.jpg",
    remove: "Remove photo",
    post: "Post",
    limit: 280,
  },
  feedTitle: "Home",
  filterNote: "Showing posts about",
  clearFilter: "Show all posts",
  replyLabel: "Write a reply",
  replyHint: "Post your reply",
  reply: "Reply",
  posts: [
    {
      id: "p1",
      name: "Priya Natarajan",
      handle: "@priyabuilds",
      time: "2m",
      text: "Shipped dark mode for our recipe app today. The trick that saved us: every color is a token, so the switch touched one file. Thank you to everyone who sent screenshots of the old contrast bugs.",
      topic: "DesignSystems",
      photo: "",
      likes: 128,
      comments: 14,
      shares: 9,
      saves: 22,
    },
    {
      id: "p2",
      name: "Diego Alvarez",
      handle: "@diegoalvarez",
      time: "38m",
      text: "First harvest from the rooftop beds on 5th Street. Tomatoes, basil and far too many zucchini. Neighbors, come grab some before Saturday.",
      topic: "CommunityGardens",
      photo: "Raised garden beds on a rooftop at sunset, with tomato vines in the foreground",
      likes: 342,
      comments: 41,
      shares: 27,
      saves: 63,
    },
    {
      id: "p3",
      name: "Hana Sato",
      handle: "@hanasato",
      time: "1h",
      text: "Reading list for the long weekend: two novels, one book on city planning and a cookbook I will only look at. What are you reading?",
      topic: "WeekendReads",
      photo: "",
      likes: 89,
      comments: 56,
      shares: 4,
      saves: 11,
    },
    {
      id: "p4",
      name: "Marcus Reed",
      handle: "@marcusreed",
      time: "3h",
      text: "Our branch library now lends tools: drills, ladders, even a pressure washer. Bring your card and borrow for a week. Small idea, big difference for renters.",
      topic: "LibraryOfThings",
      photo: "",
      likes: 1204,
      comments: 97,
      shares: 310,
      saves: 455,
    },
    {
      id: "p5",
      name: "Lena Fischer",
      handle: "@lenafischer",
      time: "5h",
      text: "Ran my first 10K this morning along the river path. Slow, happy, and already looking up the next one.",
      topic: "Running",
      photo: "",
      likes: 216,
      comments: 33,
      shares: 6,
      saves: 8,
    },
  ],
  trendingTitle: "Trending",
  trending: [
    { tag: "LibraryOfThings", context: "Trending in your city", posts: 4820 },
    { tag: "CommunityGardens", context: "Home and garden", posts: 2814 },
    { tag: "WeekendReads", context: "Books", posts: 1932 },
    { tag: "Running", context: "Sports", posts: 1207 },
    { tag: "DesignSystems", context: "Technology", posts: 864 },
  ],
  followTitle: "Who to follow",
  follow: [
    { id: "f1", name: "Ana Lima", handle: "@analima", bio: "Urban planner. Maps, bikes, benches." },
    { id: "f2", name: "Tom Becker", handle: "@tombecker", bio: "Makes furniture from salvaged wood." },
    { id: "f3", name: "Sofia Russo", handle: "@sofiarusso", bio: "Food writer. Mostly soups." },
  ],
  notifications: [
    { id: "n1", name: "Priya Natarajan", text: "liked your post about the bike lane meeting", time: "4m" },
    { id: "n2", name: "Diego Alvarez", text: "replied: “Save me a basil plant!”", time: "41m" },
    { id: "n3", name: "Hana Sato", text: "started following you", time: "2h" },
  ],
  messages: [
    { id: "m1", name: "Ana Lima", text: "Are you covering the council vote on Thursday?", time: "12m", unread: true },
    { id: "m2", name: "Marcus Reed", text: "The tool library list is in the shared folder.", time: "1h", unread: false },
    { id: "m3", name: "Lena Fischer", text: "Thanks for the route tips!", time: "Yesterday", unread: false },
  ],
  profileEmpty: "You haven't posted yet. Share something from Home and it will show here.",
};

type Seed = (typeof SAMPLE.posts)[number];
type Post = Seed & { liked: boolean; shared: boolean; saved: boolean; replies: string[] };
type View = (typeof SAMPLE.nav)[number]["id"];
type Kind = "like" | "share" | "save";

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];
const COMMENT = "M4 5h16v11H9l-5 4z";
const REPOST = "M7 7h11l-3-3M17 17H6l3 3M18 7v5M6 17v-5";

/** A small inline glyph for the two shapes the shared icon set doesn't have (reply bubble, repost arrows). */
function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));
const toneFor = (name: string) => TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];
const fresh = (s: Seed): Post => ({ ...s, liked: false, shared: false, saved: false, replies: [] });

/** The photo in a post, drawn from the theme's colors: sky, sun, rooftop beds and vines. */
function Photo({ alt }: { alt: string }) {
  return (
    <figure className="fl-social-photo">
      <svg viewBox="0 0 400 225" role="img" aria-label={alt} preserveAspectRatio="xMidYMid slice">
        <rect className="fl-social-photo__sky" width="400" height="225" />
        <circle className="fl-social-photo__sun" cx="300" cy="78" r="30" />
        <path className="fl-social-photo__far" d="M0 130 60 112 120 124 190 100 260 118 330 104 400 120V225H0z" />
        <path className="fl-social-photo__roof" d="M0 160h400v65H0z" />
        <rect className="fl-social-photo__bed" x="28" y="150" width="150" height="34" rx="4" />
        <rect className="fl-social-photo__bed" x="220" y="150" width="150" height="34" rx="4" />
        <g className="fl-social-photo__leaf">
          <circle cx="58" cy="146" r="12" />
          <circle cx="92" cy="140" r="15" />
          <circle cx="132" cy="146" r="12" />
          <circle cx="252" cy="144" r="13" />
          <circle cx="292" cy="140" r="16" />
          <circle cx="336" cy="146" r="11" />
        </g>
        <g className="fl-social-photo__fruit">
          <circle cx="86" cy="138" r="4" />
          <circle cx="100" cy="146" r="4" />
          <circle cx="286" cy="136" r="4" />
          <circle cx="300" cy="146" r="4" />
        </g>
      </svg>
    </figure>
  );
}

export default function AppSocialFeed() {
  const d = SAMPLE;
  const [view, setView] = useState<View>("home");
  const [posts, setPosts] = useState<Post[]>(() => d.posts.map(fresh));
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [unread, setUnread] = useState(d.notifications.length);
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [say, setSay] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Focus follows a section change, never the first paint (a live preview must open at its top).
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [view]);

  const left = d.composer.limit - draft.length;
  const canPost = draft.trim().length > 0 && left >= 0;
  const shown = topic ? posts.filter((p) => p.topic === topic) : posts;
  const mine = posts.filter((p) => p.handle === d.me.handle);

  function go(id: View) {
    moved.current = true;
    setView(id);
    if (id === "notifications") setUnread(0);
    if (id !== "home") setTopic(null);
  }

  function toggle(id: string, kind: Kind) {
    const key = kind === "like" ? "liked" : kind === "share" ? "shared" : "saved";
    const count = kind === "like" ? "likes" : kind === "share" ? "shares" : "saves";
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const on = !post[key];
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, [key]: on, [count]: p[count] + (on ? 1 : -1) } : p)));
    const verb = kind === "like" ? (on ? "Liked" : "Removed your like from") : kind === "share" ? (on ? "Reposted" : "Undid your repost of") : on ? "Saved" : "Removed from saved:";
    setSay(`${verb} ${post.name}'s post.`);
  }

  function submitPost(e: FormEvent) {
    e.preventDefault();
    if (!canPost) return;
    const post: Post = {
      id: `p${Date.now()}`,
      name: d.me.name,
      handle: d.me.handle,
      time: "now",
      text: draft.trim(),
      topic: "",
      photo: photo ? "Your attached photo" : "",
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      liked: false,
      shared: false,
      saved: false,
      replies: [],
    };
    setPosts((ps) => [post, ...ps]);
    setDraft("");
    setPhoto(false);
    setTopic(null);
    setSay("Your post is live at the top of your feed.");
  }

  function submitReply(e: FormEvent, post: Post) {
    e.preventDefault();
    const text = replyDraft.trim();
    if (!text) return;
    setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, comments: p.comments + 1, replies: [...p.replies, text] } : p)));
    setReplyDraft("");
    setSay(`Replied to ${post.name}.`);
  }

  function follow(id: string, name: string) {
    const on = !following[id];
    setFollowing((f) => ({ ...f, [id]: on }));
    setSay(on ? `You follow ${name}.` : `You unfollowed ${name}.`);
  }

  function postCard(p: Post) {
    const open = replyOpen === p.id;
    const first = p.name.split(" ")[0];
    return (
      <li key={p.id}>
        <article className="fl-social-post" aria-labelledby={`fl-social-by-${p.id}`}>
          <Avatar name={p.name} size={40} tone={toneFor(p.name)} decorative />
          <div className="fl-social-post__body">
            <header className="fl-social-post__head">
              <strong id={`fl-social-by-${p.id}`}>{p.name}</strong>
              <span className="fl-social-meta">{p.handle}</span>
              <span className="fl-social-meta" aria-hidden="true">
                &middot;
              </span>
              <span className="fl-social-meta">
                <span className="fl-sr">posted </span>
                {p.time}
                <span className="fl-sr">{p.time === "now" ? "" : " ago"}</span>
              </span>
            </header>
            <p className="fl-social-post__text">{p.text}</p>
            {p.topic && (
              <button type="button" className="fl-social-tag" onClick={() => setTopic(p.topic)}>
                #{p.topic}
              </button>
            )}
            {p.photo && <Photo alt={p.photo} />}
            <div className="fl-social-actions" role="group" aria-label={`Actions for ${first}'s post`}>
              <button type="button" className="fl-social-act" data-kind="reply" aria-expanded={open} aria-controls={`fl-social-reply-${p.id}`} onClick={() => { setReplyOpen(open ? null : p.id); setReplyDraft(""); }}>
                <Glyph d={COMMENT} />
                <span aria-hidden="true">{compact(p.comments)}</span>
                <span className="fl-sr">Reply, {p.comments} replies</span>
              </button>
              <button type="button" className="fl-social-act" data-kind="share" aria-pressed={p.shared} onClick={() => toggle(p.id, "share")}>
                <Glyph d={REPOST} />
                <span aria-hidden="true">{compact(p.shares)}</span>
                <span className="fl-sr">Repost, {p.shares} reposts</span>
              </button>
              <button type="button" className="fl-social-act" data-kind="like" aria-pressed={p.liked} onClick={() => toggle(p.id, "like")}>
                <Icon name="heart" filled={p.liked} />
                <span aria-hidden="true">{compact(p.likes)}</span>
                <span className="fl-sr">Like, {p.likes} likes</span>
              </button>
              <button type="button" className="fl-social-act" data-kind="save" aria-pressed={p.saved} onClick={() => toggle(p.id, "save")}>
                <Icon name="bookmark" filled={p.saved} />
                <span aria-hidden="true">{compact(p.saves)}</span>
                <span className="fl-sr">Save, {p.saves} saves</span>
              </button>
            </div>
            <div id={`fl-social-reply-${p.id}`} hidden={!open}>
              {open && (
                <>
                  {p.replies.length > 0 && (
                    <ul className="fl-social-replies" aria-label={`Your replies to ${first}`}>
                      {p.replies.map((r, i) => (
                        <li key={i}>
                          <Avatar name={d.me.name} size={24} tone={toneFor(d.me.name)} decorative />
                          <p>{r}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form className="fl-social-replyform" onSubmit={(e) => submitReply(e, p)}>
                    <label htmlFor={`fl-social-r-${p.id}`} className="fl-sr">
                      {d.replyLabel} to {p.name}
                    </label>
                    <TextField
                      id={`fl-social-r-${p.id}`}
                      size={40}
                      placeholder={d.replyHint}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setReplyOpen(null);
                      }}
                    />
                    <Button type="submit" size={40} disabled={!replyDraft.trim()}>
                      {d.reply}
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </article>
      </li>
    );
  }

  const title = d.nav.find((n) => n.id === view)!.label;

  return (
    <div className="fl-social-app">
      <div className="fl-social-layout">
        <aside className="fl-social-side">
          <div className="fl-social-brand">
            <span className="fl-social-mark" aria-hidden="true">
              {d.mark}
            </span>
            <span className="fl-social-brand__name">{d.product}</span>
          </div>
          <nav aria-label={d.product}>
            <ul className="fl-social-nav">
              {d.nav.map((n) => {
                const count = n.id === "notifications" ? unread : 0;
                return (
                  <li key={n.id}>
                    <button type="button" className="fl-social-nav__item" aria-current={view === n.id ? "page" : undefined} onClick={() => go(n.id)}>
                      <Icon name={n.icon} />
                      <span className="fl-social-nav__label">{n.label}</span>
                      {count > 0 && (
                        <span className="fl-social-count">
                          {count}
                          <span className="fl-sr"> unread</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="fl-social-me">
            <Avatar name={d.me.name} size={32} tone={toneFor(d.me.name)} decorative />
            <span>
              <strong>{d.me.name}</strong>
              <span className="fl-social-meta">{d.me.handle}</span>
            </span>
          </div>
        </aside>

        <main className="fl-social-main">
          <div className="fl-social-mainhead">
            <h1 ref={heading} tabIndex={-1} className="fl-social-h1">
              {view === "home" ? d.feedTitle : title}
            </h1>
          </div>
          <p className="fl-sr" aria-live="polite">
            {say}
          </p>

          {view === "home" && (
            <>
              <form className="fl-social-composer" onSubmit={submitPost}>
                <Avatar name={d.me.name} size={40} tone={toneFor(d.me.name)} decorative />
                <div className="fl-social-composer__body">
                  <label htmlFor="fl-social-draft" className="fl-sr">
                    {d.composer.label}
                  </label>
                  <TextField
                    multiline
                    autoGrow
                    id="fl-social-draft"
                    rows={2}
                    placeholder={d.composer.prompt}
                    value={draft}
                    aria-describedby="fl-social-left"
                    invalid={left < 0}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  {photo && (
                    <div className="fl-social-attachment">
                      <span className="fl-social-attachment__thumb" aria-hidden="true">
                        <Icon name="image" />
                      </span>
                      <span className="fl-social-meta">{d.composer.attached}</span>
                      <Button variant="tertiary" size={24} icon="close" iconOnly onClick={() => setPhoto(false)}>
                        {d.composer.remove}
                      </Button>
                    </div>
                  )}
                  <div className="fl-social-composer__foot">
                    <Button variant="tertiary" size={32} icon="paperclip" iconOnly pressed={photo} onClick={() => setPhoto((v) => !v)}>
                      {d.composer.attach}
                    </Button>
                    <span id="fl-social-left" className="fl-social-left" data-over={left < 0 || undefined} data-near={(left >= 0 && left <= 20) || undefined}>
                      {left}
                      <span className="fl-sr"> characters left</span>
                    </span>
                    <Button type="submit" size={32} disabled={!canPost}>
                      {d.composer.post}
                    </Button>
                  </div>
                </div>
              </form>

              {topic && (
                <div className="fl-social-filter">
                  <span>
                    {d.filterNote} <strong>#{topic}</strong>
                  </span>
                  <Button variant="tertiary" size={32} onClick={() => setTopic(null)}>
                    {d.clearFilter}
                  </Button>
                </div>
              )}

              <ul className="fl-social-feed" aria-label={topic ? `Posts about ${topic}` : "Your feed"}>
                {shown.map(postCard)}
              </ul>
            </>
          )}

          {view === "explore" && (
            <ul className="fl-social-list">
              {d.trending.map((t, i) => (
                <li key={t.tag}>
                  <button
                    type="button"
                    className="fl-social-row"
                    onClick={() => {
                      go("home");
                      setTopic(t.tag);
                    }}
                  >
                    <span className="fl-social-rank" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span>
                      <span className="fl-social-meta">{t.context}</span>
                      <strong>#{t.tag}</strong>
                      <span className="fl-social-meta">{compact(t.posts)} posts</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {view === "notifications" && (
            <ul className="fl-social-list">
              {d.notifications.map((n) => (
                <li key={n.id} className="fl-social-row">
                  <Avatar name={n.name} size={32} tone={toneFor(n.name)} decorative />
                  <p>
                    <strong>{n.name}</strong> {n.text}
                    <span className="fl-social-meta"> &middot; {n.time}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {view === "messages" && (
            <ul className="fl-social-list">
              {d.messages.map((m) => (
                <li key={m.id} className="fl-social-row">
                  <Avatar name={m.name} size={40} tone={toneFor(m.name)} decorative />
                  <span>
                    <strong>{m.name}</strong>
                    <span className="fl-social-meta">{m.text}</span>
                  </span>
                  <span className="fl-social-row__end">
                    <span className="fl-social-meta">{m.time}</span>
                    {m.unread && <Badge tone="info">New</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {view === "profile" && (
            <>
              <section className="fl-social-profile" aria-label={d.me.name}>
                <Avatar name={d.me.name} size={64} tone={toneFor(d.me.name)} decorative />
                <div>
                  <h2 className="fl-social-h2">{d.me.name}</h2>
                  <p className="fl-social-meta">{d.me.handle}</p>
                  <p>{d.me.bio}</p>
                  <p className="fl-social-meta">
                    <strong>{Object.values(following).filter(Boolean).length + 214}</strong> following &middot; <strong>1,086</strong> followers
                  </p>
                </div>
              </section>
              {mine.length === 0 ? (
                <div className="fl-social-empty">
                  <p>{d.profileEmpty}</p>
                  <Button variant="secondary" size={32} onClick={() => go("home")}>
                    Go to Home
                  </Button>
                </div>
              ) : (
                <ul className="fl-social-feed" aria-label="Your posts">
                  {mine.map(postCard)}
                </ul>
              )}
            </>
          )}
        </main>

        <aside className="fl-social-rail" aria-label="Trending and suggestions">
          <section className="fl-social-card" aria-labelledby="fl-social-trending">
            <h2 id="fl-social-trending" className="fl-social-h2">
              {d.trendingTitle}
            </h2>
            <ul className="fl-social-topics">
              {d.trending.slice(0, 4).map((t) => (
                <li key={t.tag}>
                  <button
                    type="button"
                    className="fl-social-topic"
                    aria-pressed={view === "home" && topic === t.tag}
                    onClick={() => {
                      if (view !== "home") go("home");
                      setTopic(topic === t.tag ? null : t.tag);
                    }}
                  >
                    <span className="fl-social-meta">{t.context}</span>
                    <strong>#{t.tag}</strong>
                    <span className="fl-social-meta">{compact(t.posts)} posts</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="fl-social-card" aria-labelledby="fl-social-follow">
            <h2 id="fl-social-follow" className="fl-social-h2">
              {d.followTitle}
            </h2>
            <ul className="fl-social-people">
              {d.follow.map((f) => {
                const on = !!following[f.id];
                return (
                  <li key={f.id}>
                    <Avatar name={f.name} size={40} tone={toneFor(f.name)} decorative />
                    <span className="fl-social-people__who">
                      <strong>{f.name}</strong>
                      <span className="fl-social-meta">{f.handle}</span>
                      <span className="fl-social-people__bio">{f.bio}</span>
                    </span>
                    <Button variant={on ? "secondary" : "primary"} size={32} icon={on ? "check" : undefined} onClick={() => follow(f.id, f.name)}>
                      {on ? "Following" : "Follow"}
                      <span className="fl-sr"> {f.name}</span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
