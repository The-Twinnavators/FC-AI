/** @flowcode-library app-mobile-home · Mobile app home screen (App screens)
 * Catalog ID: t.app-mobile-home (template)
 * Function: The home screen inside a phone app (t.app-mobile-home): a balance card with an SVG ring, quick adds, a checklist, a week strip and a bottom tab bar with Stats, Inbox and Profile screens, assembled from the bottom navigation, an action sheet, checkboxes, switches, avatars, badges and buttons.
 * Use it as: Copy app-mobile-home.tsx (FlowCode brings the components it uses); replace SAMPLE with the app's own person, budget, quick adds, bills, categories and messages, and keep what is logged in the app's own store instead of this screen's memory.
 * Built from: c.bottom-nav.labels, c.drawer@action-sheet, c.checkbox, c.switch, c.avatar.person, c.badge.status, c.button.secondary, c.button.tertiary
 * Look: A phone-width app screen: a greeting with the avatar, a balance card with a progress ring, a row of round quick-add buttons, today's checklist, a seven-day bar strip and recent spending, over a fixed bottom tab bar with a round Add in the middle.
 * Use cases: mobile app home; phone app dashboard; budgeting app; habit tracker; fitness app home; banking app home; daily tracker; PWA home screen
 * Jobs to be done: see where I stand today at a glance; log something in one tap; tick off today's tasks; see my week's trend; move between the app's main tabs
 * Keywords: app, mobile app, phone app, home screen, dashboard, bottom navigation, tab bar, budget, habit tracker, pwa
 */
/**
 * App screen: the home screen inside a phone app (here a personal budgeting app). A phone-width column (centered on
 * wider screens) with a greeting and the person's avatar, a balance card whose ring shows how much of the month's
 * budget is spent, a row of quick-add buttons, today's bills and to-dos with checkboxes that really tick (paying a bill
 * counts it as spent), a seven-day spending strip whose days you can pick, and recent spending. A fixed bottom tab bar
 * (Home, Stats, a round Add button in the middle, Inbox, Profile) marks the current tab; Stats, Inbox and Profile are
 * screens of their own, and Add opens a sheet of the person's usual expenses. Works by keyboard, keeps 44px targets,
 * honors reduced motion and clears the phone's home bar.
 * Use it as the first screen of a phone app or a PWA: budgeting, habits, fitness, banking or any daily tracker. Make
 * it the app's own: replace SAMPLE with the app's real person, budget, bills, categories and messages, and keep what is
 * logged in the app's own store instead of this screen's memory.
 * Assembled from: header (inline: greeting, c.avatar.person as a button) > balance card (inline SVG ring) > quick adds
 * (inline) > today's list (c.checkbox) > week strip (inline) > recent list (inline) > c.bottom-nav.labels (center Add
 * drawn round) > c.drawer@action-sheet for Add; Stats (inline bars, c.badge.status), Inbox (c.button.tertiary,
 * c.badge.status) and Profile (c.avatar.person, c.switch, c.button.secondary).
 */
import { useState } from "react";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { Avatar } from "./avatars-variants";
import { Checkbox } from "./checkboxes-radios";
import { Switch } from "./switches-states";
import { BottomNav, type BottomNavItem } from "./bottom-nav";
import { Drawer } from "./panels-drawers";

// flowcode:sample
const SAMPLE = {
  app: "Penny",
  person: { name: "Maya Brooks", first: "Maya", email: "maya.brooks@example.com", since: "Saving with Penny since March 2025" },
  greeting: "Good morning",
  date: "Monday, October 19",
  month: "October",
  budget: 2400,
  daysLeft: 12,
  tabs: [
    { id: "home", label: "Home", icon: "home" },
    { id: "stats", label: "Stats", icon: "chart" },
    { id: "add", label: "Add expense", icon: "plus" },
    { id: "inbox", label: "Inbox", icon: "mail" },
    { id: "profile", label: "Profile", icon: "user" },
  ],
  quick: [
    { id: "coffee", label: "Coffee", amount: 4.5, category: "Eating out", glyph: "M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3" },
    { id: "lunch", label: "Lunch", amount: 12, category: "Eating out", glyph: "M4 11h16a8 8 0 0 1-16 0zM3 21h18M12 4v3M8 5l1 2M16 5l-1 2" },
    { id: "transit", label: "Transit", amount: 2.75, category: "Transport", glyph: "M6 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 11h16M8 21l1.5-4M16 21l-1.5-4M8 14h.01M16 14h.01" },
    { id: "groceries", label: "Groceries", amount: 48, category: "Groceries", glyph: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" },
  ],
  more: [
    { id: "dinner", label: "Dinner out", amount: 36, category: "Eating out", hint: "Your usual: $36" },
    { id: "gas", label: "Gas", amount: 42.6, category: "Transport", hint: "Your usual: $42.60" },
  ],
  today: [
    { id: "t1", title: "Pay the electric bill", note: "Due today · City Power", amount: 64.2 },
    { id: "t2", title: "Phone plan renews", note: "Auto-pay · Northwind Mobile", amount: 35 },
    { id: "t3", title: "Move $50 to the Lisbon trip fund", note: "Goal: $1,200 by May", amount: 0 },
    { id: "t4", title: "Snap the pharmacy receipt", note: "For your FSA claim", amount: 0 },
  ],
  week: [
    { day: "Tue", date: "Oct 13", amount: 38.4 },
    { day: "Wed", date: "Oct 14", amount: 12.75 },
    { day: "Thu", date: "Oct 15", amount: 86.1 },
    { day: "Fri", date: "Oct 16", amount: 54.3 },
    { day: "Sat", date: "Oct 17", amount: 112.9 },
    { day: "Sun", date: "Oct 18", amount: 21.5 },
    { day: "Mon", date: "Oct 19", amount: 6.25 },
  ],
  recent: [
    { id: "r1", label: "Corner Bakery", category: "Eating out", when: "8:12 AM", amount: 6.25 },
    { id: "r2", label: "Fresh Market", category: "Groceries", when: "Yesterday", amount: 21.5 },
    { id: "r3", label: "Cinema tickets", category: "Fun", when: "Saturday", amount: 31 },
  ],
  categories: [
    { name: "Housing", spent: 950, limit: 950 },
    { name: "Groceries", spent: 286.4, limit: 450 },
    { name: "Eating out", spent: 164.75, limit: 200 },
    { name: "Transport", spent: 88.2, limit: 160 },
    { name: "Fun", spent: 72, limit: 120 },
  ],
  lastMonth: 1688.3,
  inbox: [
    { id: "m1", from: "Penny", title: "You're on track for October", text: "Spending is $142 below where you were this time last month.", when: "7:30 AM", unread: true },
    { id: "m2", from: "Bill reminder", title: "Electric bill due today", text: "City Power, $64.20. Tick it off on Home once it's paid.", when: "6:00 AM", unread: true },
    { id: "m3", from: "Lisbon trip fund", title: "You're 40% of the way there", text: "$480 saved of $1,200. Keep moving $50 a week and you'll make it by May.", when: "Fri", unread: false },
  ],
  settings: [
    { id: "weekly", label: "Weekly summary", text: "A short recap every Sunday evening", on: true },
    { id: "bills", label: "Bill reminders", text: "The morning a bill is due", on: true },
    { id: "round", label: "Round up to savings", text: "Round each expense up to the next dollar", on: false },
  ],
};

type Expense = { id: string; label: string; category: string; when: string; amount: number };

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The budget ring: a track and an arc for the share spent, drawn in SVG from the tokens. */
function Ring({ share, label }: { share: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(share, 0), 1);
  return (
    <div className="fl-mapp-ring" data-tight={pct >= 0.9 || undefined}>
      <svg viewBox="0 0 128 128" role="img" aria-label={label}>
        <circle className="fl-mapp-ring__track" cx="64" cy="64" r={r} />
        <circle className="fl-mapp-ring__value" cx="64" cy="64" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 64 64)" />
      </svg>
      <span className="fl-mapp-ring__text" aria-hidden="true">
        <strong>{Math.round(pct * 100)}%</strong>
        <span>spent</span>
      </span>
    </div>
  );
}

export default function AppMobileHome() {
  const d = SAMPLE;
  const [tab, setTab] = useState("home");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [logged, setLogged] = useState<Expense[]>([]);
  const [day, setDay] = useState(d.week.length - 1);
  const [read, setRead] = useState<Record<string, boolean>>({});
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => Object.fromEntries(d.settings.map((s) => [s.id, s.on])));
  const [say, setSay] = useState("");

  const base = d.categories.reduce((n, c) => n + c.spent, 0);
  const paid = d.today.filter((t) => done[t.id]).reduce((n, t) => n + t.amount, 0);
  const extra = logged.reduce((n, e) => n + e.amount, 0);
  const spent = base + paid + extra;
  const left = d.budget - spent;
  const perDay = Math.max(left, 0) / d.daysLeft;
  const doneCount = d.today.filter((t) => done[t.id]).length;
  const unread = d.inbox.filter((m) => m.unread && !read[m.id]).length;
  const dayAmount = (i: number) => d.week[i]!.amount + (i === d.week.length - 1 ? extra : 0);
  const weekMax = Math.max(...d.week.map((_, i) => dayAmount(i)));
  const recent: Expense[] = [...logged].reverse().concat(d.recent);

  const navItems: BottomNavItem[] = d.tabs.map((t) => (t.id === "inbox" ? { ...t, badge: unread } : t));

  function log(item: { id: string; label: string; amount: number; category: string }) {
    setLogged((l) => [...l, { id: `${item.id}-${l.length}`, label: item.label, category: item.category, when: "Just now", amount: item.amount }]);
    setSay(`Logged ${item.label}, ${money(item.amount)}.`);
  }
  function undo() {
    const last = logged[logged.length - 1];
    if (!last) return;
    setLogged((l) => l.slice(0, -1));
    setSay(`Removed ${last.label}.`);
  }
  function go(id: string) {
    if (id === "add") {
      setAdding(true);
      return;
    }
    setTab(id);
    setSay(`${d.tabs.find((t) => t.id === id)?.label ?? ""} tab`);
  }

  const lastLogged = logged[logged.length - 1];

  return (
    <div className="fl-mapp">
      <div className="fl-mapp-phone">
        {tab === "home" && (
          <main className="fl-mapp-main" aria-labelledby="fl-mapp-hello">
            <header className="fl-mapp-head">
              <div>
                <p className="fl-mapp-head__date">{d.date}</p>
                <h1 id="fl-mapp-hello" className="fl-mapp-h1">
                  {d.greeting}, {d.person.first}
                </h1>
              </div>
              <button type="button" className="fl-mapp-avatarbtn" onClick={() => go("profile")} aria-label={`Your profile, ${d.person.name}`}>
                <Avatar name={d.person.name} size={44} tone="b" decorative />
              </button>
            </header>

            <section className="fl-mapp-hero" aria-labelledby="fl-mapp-left">
              <div className="fl-mapp-hero__text">
                <h2 id="fl-mapp-left" className="fl-mapp-eyebrow">
                  Left to spend in {d.month}
                </h2>
                <p className={`fl-mapp-hero__amount${left < 0 ? " is-over" : ""}`}>{money(left)}</p>
                <p className="fl-mapp-hero__of">
                  {money(spent)} of {money(d.budget)}
                </p>
                <p className="fl-mapp-hero__pace">
                  {d.daysLeft} days left · about {money(perDay)} a day
                </p>
              </div>
              <Ring share={spent / d.budget} label={`${Math.round((spent / d.budget) * 100)}% of the ${d.month} budget spent`} />
            </section>

            <section aria-labelledby="fl-mapp-quick">
              <h2 id="fl-mapp-quick" className="fl-mapp-h2">
                Quick add
              </h2>
              <ul className="fl-mapp-quick">
                {d.quick.map((q) => (
                  <li key={q.id}>
                    <button type="button" className="fl-mapp-quick__btn" onClick={() => log(q)} aria-label={`Log ${q.label}, ${money(q.amount)}`}>
                      <span className="fl-mapp-quick__icon">
                        <Glyph d={q.glyph} />
                      </span>
                      <span className="fl-mapp-quick__label">{q.label}</span>
                      <span className="fl-mapp-quick__amount">{money(q.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {lastLogged ? (
                <p className="fl-mapp-logged">
                  <span>
                    Logged {lastLogged.label}, {money(lastLogged.amount)}
                  </span>
                  <Button variant="tertiary" size={44} onClick={undo}>
                    Undo
                  </Button>
                </p>
              ) : null}
            </section>

            <section aria-labelledby="fl-mapp-today">
              <div className="fl-mapp-row">
                <h2 id="fl-mapp-today" className="fl-mapp-h2">
                  Today
                </h2>
                <span className="fl-mapp-meta">
                  {doneCount} of {d.today.length} done
                </span>
              </div>
              <ul className="fl-mapp-list">
                {d.today.map((t) => (
                  <li key={t.id}>
                    <label className={`fl-mapp-task${done[t.id] ? " is-done" : ""}`}>
                      <Checkbox
                        size={24}
                        checked={Boolean(done[t.id])}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setDone((x) => ({ ...x, [t.id]: on }));
                          setSay(on ? `Done: ${t.title}.` : `Not done: ${t.title}.`);
                        }}
                      />
                      <span className="fl-mapp-task__body">
                        <span className="fl-mapp-task__title">{t.title}</span>
                        <span className="fl-mapp-meta">{t.note}</span>
                      </span>
                      {t.amount ? <span className="fl-mapp-task__amount">{money(t.amount)}</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="fl-mapp-week">
              <div className="fl-mapp-row">
                <h2 id="fl-mapp-week" className="fl-mapp-h2">
                  Last 7 days
                </h2>
                <span className="fl-mapp-meta" aria-live="polite">
                  {d.week[day]!.date}: {money(dayAmount(day))}
                </span>
              </div>
              <ol className="fl-mapp-week" aria-label="Spending by day">
                {d.week.map((w, i) => {
                  const amt = dayAmount(i);
                  return (
                    <li key={w.date}>
                      <button
                        type="button"
                        className="fl-mapp-week__day"
                        aria-pressed={day === i}
                        aria-label={`${w.day}, ${w.date}: ${money(amt)}${i === d.week.length - 1 ? ", today" : ""}`}
                        onClick={() => setDay(i)}
                      >
                        <span className="fl-mapp-week__bar" aria-hidden="true">
                          <span style={{ ["--fl-mapp-h" as string]: `${Math.max((amt / weekMax) * 100, 4)}%` }} />
                        </span>
                        <span className="fl-mapp-week__label" aria-hidden="true">
                          {i === d.week.length - 1 ? "Today" : w.day}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section aria-labelledby="fl-mapp-recent">
              <h2 id="fl-mapp-recent" className="fl-mapp-h2">
                Recent
              </h2>
              <ul className="fl-mapp-list fl-mapp-list--plain">
                {recent.slice(0, 5).map((e) => (
                  <li key={e.id} className="fl-mapp-line">
                    <span className="fl-mapp-line__body">
                      <span className="fl-mapp-task__title">{e.label}</span>
                      <span className="fl-mapp-meta">
                        {e.category} · {e.when}
                      </span>
                    </span>
                    <span className="fl-mapp-task__amount">−{money(e.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </main>
        )}

        {tab === "stats" && (
          <main className="fl-mapp-main" aria-labelledby="fl-mapp-stats">
            <header className="fl-mapp-head">
              <div>
                <p className="fl-mapp-head__date">{d.month}</p>
                <h1 id="fl-mapp-stats" className="fl-mapp-h1">
                  Stats
                </h1>
              </div>
            </header>
            <section className="fl-mapp-card" aria-labelledby="fl-mapp-total">
              <h2 id="fl-mapp-total" className="fl-mapp-eyebrow">
                Spent so far
              </h2>
              <p className="fl-mapp-hero__amount">{money(spent)}</p>
              <p className="fl-mapp-statline">
                <Badge tone={spent <= d.lastMonth ? "success" : "warning"}>
                  {spent <= d.lastMonth ? `${money(d.lastMonth - spent)} under` : `${money(spent - d.lastMonth)} over`}
                </Badge>
                <span className="fl-mapp-meta">September at this point: {money(d.lastMonth)}</span>
              </p>
            </section>
            <section aria-labelledby="fl-mapp-cats">
              <h2 id="fl-mapp-cats" className="fl-mapp-h2">
                By category
              </h2>
              <ul className="fl-mapp-list">
                {d.categories.map((c) => {
                  const amt = c.spent + logged.filter((e) => e.category === c.name).reduce((n, e) => n + e.amount, 0);
                  const share = Math.min(amt / c.limit, 1);
                  return (
                    <li key={c.name} className="fl-mapp-cat">
                      <div className="fl-mapp-row">
                        <span className="fl-mapp-task__title">{c.name}</span>
                        <span className="fl-mapp-meta">
                          {money(amt)} of {money(c.limit)}
                        </span>
                      </div>
                      <span className="fl-mapp-meter" data-full={amt >= c.limit || undefined} role="img" aria-label={`${c.name}: ${Math.round((amt / c.limit) * 100)}% of its limit`}>
                        <span style={{ ["--fl-mapp-w" as string]: `${share * 100}%` }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </main>
        )}

        {tab === "inbox" && (
          <main className="fl-mapp-main" aria-labelledby="fl-mapp-inbox">
            <header className="fl-mapp-head">
              <div>
                <p className="fl-mapp-head__date">{unread ? `${unread} unread` : "All caught up"}</p>
                <h1 id="fl-mapp-inbox" className="fl-mapp-h1">
                  Inbox
                </h1>
              </div>
              <Button variant="tertiary" size={44} disabled={!unread} onClick={() => setRead(Object.fromEntries(d.inbox.map((m) => [m.id, true])))}>
                Mark all read
              </Button>
            </header>
            <ul className="fl-mapp-list">
              {d.inbox.map((m) => {
                const isNew = m.unread && !read[m.id];
                return (
                  <li key={m.id}>
                    <button type="button" className={`fl-mapp-msg${isNew ? " is-new" : ""}`} onClick={() => setRead((r) => ({ ...r, [m.id]: true }))}>
                      <span className="fl-mapp-row">
                        <span className="fl-mapp-meta">{m.from}</span>
                        <span className="fl-mapp-meta">{m.when}</span>
                      </span>
                      <span className="fl-mapp-task__title">
                        {isNew ? <span className="fl-mapp-dot" aria-hidden="true" /> : null}
                        {m.title}
                        {isNew ? <span className="fl-sr">, unread</span> : null}
                      </span>
                      <span className="fl-mapp-msg__text">{m.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </main>
        )}

        {tab === "profile" && (
          <main className="fl-mapp-main" aria-labelledby="fl-mapp-profile">
            <header className="fl-mapp-head">
              <h1 id="fl-mapp-profile" className="fl-mapp-h1">
                Profile
              </h1>
            </header>
            <section className="fl-mapp-card fl-mapp-me" aria-label="You">
              <Avatar name={d.person.name} size={64} tone="b" decorative />
              <div>
                <p className="fl-mapp-task__title">{d.person.name}</p>
                <p className="fl-mapp-meta">{d.person.email}</p>
                <p className="fl-mapp-meta">{d.person.since}</p>
              </div>
            </section>
            <section aria-labelledby="fl-mapp-notify">
              <h2 id="fl-mapp-notify" className="fl-mapp-h2">
                Notifications and saving
              </h2>
              <ul className="fl-mapp-list">
                {d.settings.map((s) => (
                  <li key={s.id} className="fl-mapp-setting">
                    <span className="fl-mapp-task__body">
                      <span className="fl-mapp-task__title">{s.label}</span>
                      <span className="fl-mapp-meta">{s.text}</span>
                    </span>
                    <Switch
                      on={Boolean(prefs[s.id])}
                      label={s.label}
                      onToggle={(on) => {
                        setPrefs((p) => ({ ...p, [s.id]: on }));
                        setSay(`${s.label} ${on ? "on" : "off"}.`);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
            <Button variant="secondary" size={48} block onClick={() => go("home")}>
              Back to Home
            </Button>
          </main>
        )}

        <p className="fl-sr" aria-live="polite">
          {say}
        </p>
      </div>

      <BottomNav items={navItems} current={tab} onNavigate={go} label={`${d.app} tabs`} />

      <Drawer
        version="action-sheet"
        open={adding}
        onClose={() => setAdding(false)}
        title="Add an expense"
        hint="Your usual ones. Pick one to log it now."
        options={[...d.quick, ...d.more].map((q) => ({ id: q.id, label: `${q.label}, ${money(q.amount)}`, hint: q.category, icon: "plus" }))}
        onSelect={(id) => {
          const item = [...d.quick, ...d.more].find((q) => q.id === id);
          if (item) log(item);
          setAdding(false);
          setTab("home");
        }}
        closeLabel="Cancel"
      />
    </div>
  );
}
