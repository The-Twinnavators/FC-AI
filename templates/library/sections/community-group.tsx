/** @flowcode-library community-group · Community group page (Cards)
 * Catalog ID: p.community-group (pattern)
 * Function: A community group's page (p.community-group): cover, name, public or private, member count and tags; Join after agreeing to the group rules in a dialog (the count bumps and you slide into the members), Leave after a confirm (your RSVPs go with it), Invite by copying the link, and a notification choice for members; upcoming events with a Going toggle (asks you to join first, then RSVPs) and a going count that bumps; the members preview opens to everyone with their roles; the rules fold open one by one; loading, a load error with Retry and empty states, every change announced. Adapted from Tailblocks, Meraki UI and Creative Tim UI (MIT).
 * Use it as: import { CommunityGroup } from "./community-group"; <CommunityGroup me="Signed-in name" group={{ name, tagline, about, privacy: "public"|"private", location?, tags?: string[], cover?: "a"|"b"|"c"|"d"|"e" }} members={2140} people={[{ id, name, role?: "admin"|"moderator" }]} rules={[{ id, title, text }]} events?={[{ id, title, start: ISO, place, going, mine? }]} load?={async () => GroupEvent[]} joined? onJoin?={async (on) => void} onRsvp?={async (eventId, on) => void} inviteUrl? labels?={{ join, leave, invite, going, ... }} />
 * Built from: c.media-frame, c.avatar.organization, c.avatar.person, c.badge.status, c.checkbox, c.collapsible, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.form, c.modal.danger, c.empty-state, c.skeleton
 * Look: A white card with a wide gradient cover, a square group mark overlapping it, the bold group name, a muted line with Public group, the place and the member count, a short tagline, tag pills, and Join (or Joined with a Leave link), Invite and, for members, an All / Highlights / Off switch with a sliding thumb. Below in two columns: About and Upcoming events (each a stacked date on a sunken tile, the title, time and place, a going count and a Going toggle) on the left; Members (overlapping round initials and See all) and Rules (numbered rows that fold open) on the right.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --font-display --weight-medium --weight-semibold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: community group; club page; interest group; neighborhood group; meetup group; alumni group; course cohort; volunteer group
 * Jobs to be done: decide whether to join a group; join after reading the rules; see who's in the group; RSVP to the next meetup; invite a friend; leave a group
 * Keywords: group, community, club, join, leave, members, rules, events, RSVP, invite, notifications, meetup
 */
/**
 * Community group page. Join asks the person to agree to the rules (a checkbox the dialog checks for); a Going press
 * from someone who hasn't joined opens the same dialog and RSVPs once they join. Leaving confirms first and takes
 * their RSVPs with it. The Going buttons are one Tab stop (Up and Down move between them). The member count and going
 * counts bump, you slide into the members, See all and each rule fold open (grid rows; closed parts are inert), the
 * notification thumb slides and dialogs rise in (@starting-style). With motion off everything simply changes.
 * Make it the app's own: replace SAMPLE with the group's real details, pass onJoin and onRsvp to save, and swap the
 * gradient cover for the group's picture.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren), its team and content blocks, Meraki UI (MIT
 * License, Copyright (c) 2021 Khatab Wedaa), its avatar group and card components, and Creative Tim UI (MIT License,
 * Copyright (c) 2025 Creative Tim), its card display block.
 */
/**
 * How to try it
 * - Wait for the events to load. Press Going on an event: the Join dialog opens. Press Join without ticking the box
 *   (it asks you to agree), tick it and join: the member count bumps, you appear in Members and the RSVP is made.
 * - Use Up and Down between the Going buttons; press one again to drop the RSVP.
 * - Pick Highlights in Notifications: the thumb slides. Press See all members; open a rule.
 * - Press Invite: the link is copied (or shown). Press Leave and confirm: you're out and your RSVPs are gone.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's MediaFrame, Avatar, Badge,
 * Checkbox, Button, Modal, EmptyState and Skeleton ("./media-frames", "./avatars-variants", "./badges-status",
 * "./checkboxes-radios", "./buttons-variants", "./modals-dialogs", "./empty-states", "./skeleton-loading") and its
 * inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl-
 * classes in templates/library/css/r6c-community-group.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Modal } from "./modals-dialogs";
import { Skeleton } from "./skeleton-loading";

// ── p.community-group: a group's page with join, members, rules and events. ──

export type GroupInfo = { name: string; tagline: string; about: string; privacy: "public" | "private"; location?: string; tags?: string[]; cover?: MediaArt };
export type GroupMember = { id: string; name: string; role?: "admin" | "moderator" };
export type GroupRule = { id: string; title: string; text: string };
export type GroupEvent = { id: string; title: string; start: string; place: string; going: number; mine?: boolean };
type Labels = {
  join: string; joined: string; leave: string; invite: string; copied: string; copyFailed: string; notify: string; all: string; highlights: string; off: string;
  about: string; events: string; going: string; goingCount: string; members: string; seeAll: string; showLess: string; rules: string; admin: string; moderator: string; you: string;
  noEvents: string; noEventsText: string; loadFailed: string; retry: string; loading: string; joinTitle: string; joinText: string; agree: string; needAgree: string; joinConfirm: string;
  leaveTitle: string; leaveText: string; leaveConfirm: string; publicGroup: string; privateGroup: string; membersWord: string;
};
export type CommunityGroupProps = {
  me: string;
  group: GroupInfo;
  /** The member count, not counting you unless joined is set. */
  members: number;
  /** A few members to show (the first ones show in the stack). */
  people: GroupMember[];
  rules: GroupRule[];
  events?: GroupEvent[];
  load?: () => Promise<GroupEvent[]>;
  joined?: boolean;
  onJoin?: (on: boolean) => Promise<void> | void;
  onRsvp?: (eventId: string, on: boolean) => Promise<void> | void;
  inviteUrl?: string;
  labels?: Partial<Labels>;
};

// ── Helpers ──

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];
const toneOf = (name: string) => TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length]!;
function Bump({ n, className }: { n: number; className: string }) {
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
      {n.toLocaleString("en-US")}
    </span>
  );
}
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

function NotifySwitch({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const place = () => {
      const on = el.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!on) return;
      el.style.setProperty("--thumb-x", `${on.offsetLeft}px`);
      el.style.setProperty("--thumb-w", `${on.offsetWidth}px`);
      if (!el.dataset.ready) setTimeout(() => (el.dataset.ready = "1"), 0);
    };
    place();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    const n = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = options[(n + options.length) % options.length]!;
    onChange(next.value);
    box.current?.querySelector<HTMLElement>(`[data-v="${next.value}"]`)?.focus();
  };
  return (
    <div className="fl-cgrp-seg" role="radiogroup" aria-label={label} ref={box} onKeyDown={keys}>
      <span className="fl-cgrp-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" data-v={o.value} aria-checked={value === o.value} tabIndex={value === o.value ? 0 : -1} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Fold({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return (
    <div className={`fl-cgrp-fold${open ? " is-open" : ""}`} id={id} inert={!open}>
      <div>{children}</div>
    </div>
  );
}

// ── The group ──

export function CommunityGroup({ me, group, members, people, rules, events: givenEvents, load, joined: startJoined = false, onJoin, onRsvp, inviteUrl, labels = {} }: CommunityGroupProps) {
  const l: Labels = {
    join: "Join group", joined: "Joined", leave: "Leave", invite: "Invite", copied: "Invite link copied", copyFailed: "Couldn't copy. The link is", notify: "Notifications", all: "All", highlights: "Highlights", off: "Off",
    about: "About", events: "Upcoming events", going: "Going", goingCount: "going", members: "Members", seeAll: "See all", showLess: "Show less", rules: "Group rules", admin: "Admin", moderator: "Moderator", you: "You",
    noEvents: "No events planned", noEventsText: "New meetups show up here.", loadFailed: "Couldn't load the events.", retry: "Try again", loading: "Loading events", joinTitle: "Join", joinText: "Members agree to these rules.",
    agree: "I agree to the group rules", needAgree: "Tick the box to agree to the rules.", joinConfirm: "Join group", leaveTitle: "Leave", leaveText: "You'll stop getting updates, and your RSVPs are canceled. You can join again later.",
    leaveConfirm: "Leave group", publicGroup: "Public group", privateGroup: "Private group", membersWord: "members",
    ...labels,
  };
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [joined, setJoined] = useState(startJoined);
  const [count, setCount] = useState(members);
  const [events, setEvents] = useState<GroupEvent[]>(givenEvents ?? []);
  const [state, setState] = useState<"ready" | "loading" | "error">(givenEvents || !load ? "ready" : "loading");
  const [notify, setNotify] = useState("highlights");
  const [asking, setAsking] = useState<{ thenRsvp?: string } | null>(null);
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [rove, setRove] = useState(0);
  const [freshMe, setFreshMe] = useState(false);
  const [status, setStatus] = useState("");
  const [focusTo, setFocusTo] = useState<{ id: string; n: number } | null>(null);

  const run = () => {
    if (!load) return;
    setState("loading");
    load().then(
      (e) => {
        setEvents(e);
        setState("ready");
      },
      () => setState("error"),
    );
  };
  useEffect(() => {
    if (!givenEvents && load) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (focusTo) document.getElementById(focusTo.id)?.focus();
  }, [focusTo]);
  const focusLater = (id: string) => setFocusTo({ id, n: Date.now() });

  const url = inviteUrl ?? (typeof location !== "undefined" ? location.href.split("#")[0]! : "");
  const invite = async () => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setStatus(l.copied);
    } catch {
      setStatus(`${l.copyFailed} ${url}`);
    }
  };

  const rsvp = async (ev: GroupEvent, on: boolean) => {
    try {
      await onRsvp?.(ev.id, on);
      setEvents((all) => all.map((x) => (x.id === ev.id ? { ...x, mine: on, going: x.going + (on ? 1 : -1) } : x)));
      setStatus(on ? `You're going to ${ev.title}` : `RSVP canceled for ${ev.title}`);
    } catch {
      setStatus("Couldn't save your RSVP. Try again.");
    }
  };
  const pressGoing = (ev: GroupEvent) => {
    if (!joined) {
      setAgree(false);
      setAgreeError("");
      setAsking({ thenRsvp: ev.id });
      return;
    }
    void rsvp(ev, !ev.mine);
  };
  const askJoin = () => {
    setAgree(false);
    setAgreeError("");
    setAsking({});
  };
  const confirmJoin = (): false => {
    if (!agree) {
      setAgreeError(l.needAgree);
      document.getElementById(`${uid}-agree`)?.focus();
      return false;
    }
    setBusy(true);
    const then = asking?.thenRsvp;
    Promise.resolve()
      .then(() => onJoin?.(true))
      .then(
        () => {
          setBusy(false);
          setAsking(null);
          setJoined(true);
          setCount((c) => c + 1);
          setFreshMe(true);
          const ev = events.find((e) => e.id === then);
          setStatus(`You joined ${group.name}`);
          if (ev && !ev.mine) void rsvp(ev, true).then(() => setStatus(`You joined ${group.name} and you're going to ${ev.title}`));
          focusLater(ev ? `${uid}-go-${ev.id}` : `${uid}-joined`);
        },
        () => {
          setBusy(false);
          setAgreeError("Couldn't join. Try again.");
        },
      );
    return false;
  };
  const leave = (): false => {
    setBusy(true);
    Promise.resolve()
      .then(() => onJoin?.(false))
      .then(
        () => {
          setBusy(false);
          setLeaving(false);
          setJoined(false);
          setCount((c) => c - 1);
          setEvents((all) => all.map((x) => (x.mine ? { ...x, mine: false, going: x.going - 1 } : x)));
          setStatus(`You left ${group.name}`);
          focusLater(`${uid}-join`);
        },
        () => {
          setBusy(false);
          setStatus("Couldn't leave. Try again.");
        },
      );
    return false;
  };

  const roster: (GroupMember & { me?: boolean })[] = joined ? [{ id: "__me", name: me, me: true }, ...people] : people;
  const stack = roster.slice(0, 5);
  const goingKeys = (e: KeyboardEvent<HTMLUListElement>) => {
    const btns = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button[data-going]"));
    const i = btns.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const n = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const to = Math.max(0, Math.min(btns.length - 1, n));
    setRove(to);
    btns[to]?.focus();
  };
  const sortedEvents = [...events].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <article className="fl-cgrp" data-fl="p.community-group" aria-labelledby={`${uid}-name`}>
      <div className="fl-cgrp-cover">
        <MediaFrame ratio="16-9" art={group.cover ?? "a"} alt="" />
      </div>
      <header className="fl-cgrp-head">
        <span className="fl-cgrp-mark">
          <Avatar variant="organization" name={group.name} size={72} tone={toneOf(group.name)} decorative />
        </span>
        <div className="fl-cgrp-title">
          <h2 id={`${uid}-name`}>{group.name}</h2>
          <p className="fl-cgrp-meta">
            <Icon name={group.privacy === "public" ? "globe" : "lock"} />
            {group.privacy === "public" ? l.publicGroup : l.privateGroup}
            {group.location ? ` · ${group.location}` : ""} · <Bump n={count} className="fl-cgrp-count" /> {l.membersWord}
          </p>
          <p className="fl-cgrp-tagline">{group.tagline}</p>
          {group.tags?.length ? (
            <ul className="fl-cgrp-tags" aria-label="Topics">
              {group.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="fl-cgrp-actions">
          {joined ? (
            <>
              <span className="fl-cgrp-joined" id={`${uid}-joined`} tabIndex={-1}>
                <Icon name="check" />
                {l.joined}
              </span>
              <Button variant="tertiary" size={40} onClick={() => setLeaving(true)}>
                {l.leave}
              </Button>
            </>
          ) : (
            <Button id={`${uid}-join`} size={40} icon="plus" onClick={askJoin}>
              {l.join}
            </Button>
          )}
          <Button variant="secondary" size={40} icon="share" onClick={invite}>
            {l.invite}
          </Button>
        </div>
        {joined ? (
          <div className="fl-cgrp-notify">
            <span id={`${uid}-notify`}>
              <Icon name="bell" />
              {l.notify}
            </span>
            <NotifySwitch
              label={l.notify}
              value={notify}
              onChange={(v) => {
                setNotify(v);
                setStatus(`${l.notify}: ${v === "all" ? l.all : v === "highlights" ? l.highlights : l.off}`);
              }}
              options={[
                { value: "all", label: l.all },
                { value: "highlights", label: l.highlights },
                { value: "off", label: l.off },
              ]}
            />
          </div>
        ) : null}
      </header>

      <div className="fl-cgrp-body">
        <div className="fl-cgrp-main">
          <section aria-labelledby={`${uid}-about`}>
            <h3 id={`${uid}-about`}>{l.about}</h3>
            <p className="fl-cgrp-about">{group.about}</p>
          </section>
          <section aria-labelledby={`${uid}-ev`} aria-busy={state === "loading" || undefined}>
            <h3 id={`${uid}-ev`}>{l.events}</h3>
            {state === "loading" ? (
              <div className="fl-cgrp-skel">
                <p className="fl-sr" role="status">
                  {l.loading}
                </p>
                <Skeleton variant="row" />
                <Skeleton variant="row" seed={1} />
              </div>
            ) : state === "error" ? (
              <EmptyState
                variant="error"
                title={l.loadFailed}
                action={
                  <Button variant="secondary" size={40} icon="refresh" onClick={run}>
                    {l.retry}
                  </Button>
                }
              />
            ) : !events.length ? (
              <EmptyState variant="first-use" icon="calendar" title={l.noEvents}>
                {l.noEventsText}
              </EmptyState>
            ) : (
              <ul className="fl-cgrp-events" onKeyDown={goingKeys}>
                {sortedEvents.map((ev, i) => {
                  const d = new Date(ev.start);
                  return (
                    <li key={ev.id} className="fl-cgrp-event" style={{ "--i": i } as CSSProperties}>
                      <span className="fl-cgrp-date" aria-hidden="true">
                        <span>{d.toLocaleDateString("en-US", { month: "short" })}</span>
                        <strong>{d.getDate()}</strong>
                      </span>
                      <span className="fl-cgrp-evtext">
                        <strong>{ev.title}</strong>
                        <span>
                          <time dateTime={ev.start}>{d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, {when(ev.start)}</time> · {ev.place}
                        </span>
                        <span className="fl-cgrp-evgoing">
                          <Bump n={ev.going} className="fl-cgrp-n" /> {l.goingCount}
                          {ev.mine ? <Badge tone="success">{l.you}</Badge> : null}
                        </span>
                      </span>
                      <button
                        type="button"
                        id={`${uid}-go-${ev.id}`}
                        data-going=""
                        className={`fl-cgrp-go${ev.mine ? " is-on" : ""}`}
                        aria-pressed={!!ev.mine}
                        aria-label={`${l.going}: ${ev.title}`}
                        tabIndex={i === Math.min(rove, sortedEvents.length - 1) ? 0 : -1}
                        onFocus={() => setRove(i)}
                        onClick={() => pressGoing(ev)}
                      >
                        <Icon name={ev.mine ? "check" : "calendar"} />
                        {l.going}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="fl-cgrp-side">
          <section aria-labelledby={`${uid}-mem`}>
            <div className="fl-cgrp-sidehead">
              <h3 id={`${uid}-mem`}>{l.members}</h3>
              <button type="button" className="fl-cgrp-link" aria-expanded={allOpen} aria-controls={`${uid}-all`} onClick={() => setAllOpen((o) => !o)}>
                {allOpen ? l.showLess : l.seeAll}
                <Icon name="chevron-down" />
              </button>
            </div>
            <ul className="fl-cgrp-stack" aria-label={`${count.toLocaleString("en-US")} ${l.membersWord}, including ${stack.map((p) => p.name).join(", ")}`}>
              {stack.map((p, i) => (
                <li key={p.id} className={p.me && freshMe ? "is-new" : undefined} style={{ zIndex: stack.length - i }} onAnimationEnd={() => p.me && setFreshMe(false)}>
                  <Avatar name={p.name} size={40} tone={toneOf(p.name)} decorative />
                </li>
              ))}
              {count > stack.length ? (
                <li className="fl-cgrp-more" aria-hidden="true">
                  +{(count - stack.length).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 } as Intl.NumberFormatOptions)}
                </li>
              ) : null}
            </ul>
            <Fold open={allOpen} id={`${uid}-all`}>
              <ul className="fl-cgrp-people">
                {roster.map((p) => (
                  <li key={p.id}>
                    <Avatar name={p.name} size={32} tone={toneOf(p.name)} decorative />
                    <span>{p.me ? `${p.name} (${l.you})` : p.name}</span>
                    {p.role ? <Badge tone={p.role === "admin" ? "info" : "neutral"}>{p.role === "admin" ? l.admin : l.moderator}</Badge> : null}
                  </li>
                ))}
              </ul>
            </Fold>
          </section>
          <section aria-labelledby={`${uid}-rules`}>
            <h3 id={`${uid}-rules`}>{l.rules}</h3>
            <ol className="fl-cgrp-rules">
              {rules.map((r, i) => {
                const open = openRule === r.id;
                return (
                  <li key={r.id}>
                    <button type="button" className="fl-cgrp-rule" aria-expanded={open} aria-controls={`${uid}-rule-${r.id}`} onClick={() => setOpenRule(open ? null : r.id)}>
                      <span className="fl-cgrp-ruleno">{i + 1}</span>
                      <span>{r.title}</span>
                      <Icon name="chevron-down" />
                    </button>
                    <Fold open={open} id={`${uid}-rule-${r.id}`}>
                      <p>{r.text}</p>
                    </Fold>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>

      <p className="fl-cgrp-status" role="status" aria-live="polite">
        {status}
      </p>

      {asking ? (
        <Modal variant="form" className="fl-cgrp-dlg" title={`${l.joinTitle} ${group.name}`} description={l.joinText} confirmLabel={l.joinConfirm} busy={busy} busyLabel="Joining..." onConfirm={() => confirmJoin()} onClose={() => setAsking(null)}>
          <ol className="fl-cgrp-dlgrules">
            {rules.map((r) => (
              <li key={r.id}>
                <strong>{r.title}</strong> {r.text}
              </li>
            ))}
          </ol>
          <div className={`fl-cgrp-agree${agreeError ? " is-invalid" : ""}`}>
            <Checkbox
              id={`${uid}-agree`}
              data-autofocus=""
              label={l.agree}
              checked={agree}
              aria-invalid={!!agreeError || undefined}
              aria-describedby={agreeError ? `${uid}-agree-err` : undefined}
              onChange={(e) => {
                setAgree(e.target.checked);
                if (e.target.checked) setAgreeError("");
              }}
            />
          </div>
          {agreeError ? (
            <p className="fl-cgrp-error" id={`${uid}-agree-err`} role="alert">
              {agreeError}
            </p>
          ) : null}
        </Modal>
      ) : null}
      {leaving ? <Modal variant="danger" className="fl-cgrp-dlg" icon="alert" title={`${l.leaveTitle} ${group.name}?`} description={l.leaveText} confirmLabel={l.leaveConfirm} busy={busy} busyLabel="Leaving..." onConfirm={() => leave()} onClose={() => setLeaving(false)} /> : null}
    </article>
  );
}

// flowcode:sample
const SAMPLE = (() => {
  const day = (days: number, hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  return {
    me: "Maya Chen",
    group: {
      name: "Eastside Night Runners",
      tagline: "Easy-paced evening runs, every pace welcome. Nobody gets left behind.",
      about: "We meet twice a week at the riverfront for 5 to 8 km loops, then grab tacos. Headlamps after October. New runners get a buddy on their first run.",
      privacy: "public" as const,
      location: "Portland, OR",
      tags: ["Running", "Fitness", "Social"],
      cover: "d" as MediaArt,
    },
    members: 2140,
    people: [
      { id: "m1", name: "Rosa Delgado", role: "admin" as const },
      { id: "m2", name: "Dev Patel", role: "moderator" as const },
      { id: "m3", name: "Jordan Blake" },
      { id: "m4", name: "Priya Raman" },
      { id: "m5", name: "Tom Okafor" },
      { id: "m6", name: "Ana Silva" },
    ],
    rules: [
      { id: "r1", title: "Be kind", text: "Every pace is welcome. Cheer for the last runner as loudly as the first." },
      { id: "r2", title: "Safety first", text: "Wear something bright after dark and tell a host if you leave early." },
      { id: "r3", title: "No selling", text: "Don't promote products or races without asking an admin first." },
    ],
    events: [
      { id: "e1", title: "Tuesday riverfront 5K", start: day(2, 18, 30), place: "Hawthorne Bridge steps", going: 23 },
      { id: "e2", title: "Hill repeats at Mt. Tabor", start: day(4, 18, 0), place: "Tabor main lot", going: 11 },
      { id: "e3", title: "Saturday long run and brunch", start: day(6, 8, 0), place: "Eastbank Esplanade", going: 37 },
    ],
  };
})();

export default function CommunityGroupPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.group.name}>
      <div className="fl-wrap">
        <CommunityGroup
          me={SAMPLE.me}
          group={SAMPLE.group}
          members={SAMPLE.members}
          people={SAMPLE.people}
          rules={SAMPLE.rules}
          inviteUrl="https://runners.example/g/eastside-night-runners"
          load={() => new Promise((ok) => setTimeout(() => ok(SAMPLE.events), 700))}
          onJoin={() => new Promise((ok) => setTimeout(ok, 350))}
        />
      </div>
    </section>
  );
}
