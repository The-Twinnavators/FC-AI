/** @flowcode-library app-admin · Admin panel: users and roles (App screens)
 * Use cases: admin panel; user management; roles and permissions; access control; team directory; member management; back office; user list
 * Jobs to be done: manage who has access; change people's roles in bulk; invite a new user; deactivate a user safely; review a user's activity
 * Keywords: app, admin, users, table, filters, bulk-actions, drawer, dialog, permissions, roles
 */
/**
 * App screen: admin panel for people and access. A colored sidebar (sections, seats used on the plan) beside a top
 * bar with search and the signed-in admin. The Users tab is a data table with search, role and status filters,
 * sortable columns, row selection with bulk actions (change role; deactivate after a confirm dialog), pagination and
 * a no-results state. Opening a person shows a side drawer with editable details, a role select and their activity
 * log; "Invite user" opens a dialog that checks its fields. The Roles and permissions tab is a matrix of checkboxes
 * per role that knows when it has unsaved changes. On phones the sidebar becomes a drawer and the table scrolls inside
 * its own box. Use it as the user-management area of any back-office app. Make it the app's own: replace SAMPLE with
 * the app's real roles, permissions, teams and people, and save through the app's own data layer instead of memory.
 */
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Hollow Pine",
  area: "Admin",
  me: { id: "u1", name: "Rosa Delgado", role: "Owner" },
  nav: [
    { id: "overview", label: "Overview", icon: "chart" },
    { id: "bookings", label: "Bookings", icon: "clock" },
    { id: "classes", label: "Classes", icon: "layers" },
    { id: "customers", label: "Customers", icon: "heart" },
    { id: "people", label: "People and access", icon: "users" },
    { id: "settings", label: "Studio settings", icon: "lock" },
  ],
  currentNav: "people",
  navElsewhere: "This preview shows People and access only.",
  plan: { name: "Studio plan", seats: 15 },
  topSearchLabel: "Search people",
  topSearchPlaceholder: "Search people by name or email",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  eyebrow: "Admin",
  title: "People and access",
  lede: "Decide who can sign in to Hollow Pine and what they can do once they're in.",
  invite: "Invite user",
  tabs: [
    { id: "users", label: "Users" },
    { id: "roles", label: "Roles and permissions" },
  ],
  roles: ["Admin", "Manager", "Instructor", "Front desk"],
  statuses: ["Active", "Invited", "Deactivated"],
  teams: ["Front office", "Riverside studio", "Old Town studio"],
  pageSize: 5,
  noResultsTitle: "No one matches those filters",
  noResultsText: "Try a different name, or clear the filters to see everyone.",
  clearFilters: "Clear filters",
  users: [
    { id: "u1", name: "Rosa Delgado", email: "rosa@hollowpine.example", role: "Admin", status: "Active", team: "Front office", lastActive: "Just now", lastMins: 0, joined: "Feb 2021", activity: [{ at: "Today 9:12", text: "Changed the refund limit to $200" }, { at: "Mon 17:40", text: "Invited Daniel Kim" }] },
    { id: "u2", name: "Marcus Bell", email: "marcus@hollowpine.example", role: "Manager", status: "Active", team: "Riverside studio", lastActive: "Yesterday", lastMins: 1300, joined: "Aug 2022", activity: [{ at: "Yesterday 18:05", text: "Published next week's timetable" }, { at: "Yesterday 11:20", text: "Refunded $45 to Sam Turner" }] },
    { id: "u3", name: "Imani Okoro", email: "imani@hollowpine.example", role: "Instructor", status: "Active", team: "Riverside studio", lastActive: "2 hours ago", lastMins: 120, joined: "Jan 2023", activity: [{ at: "Today 10:02", text: "Checked in 8 people to Beginners' wheel" }, { at: "Sat 14:00", text: "Marked a taster session complete" }] },
    { id: "u4", name: "Theo Varga", email: "theo@hollowpine.example", role: "Instructor", status: "Active", team: "Old Town studio", lastActive: "3 days ago", lastMins: 4320, joined: "Mar 2023", activity: [{ at: "Mon 19:15", text: "Checked in 7 people to Hand-building" }] },
    { id: "u5", name: "Hana Sato", email: "hana@hollowpine.example", role: "Front desk", status: "Active", team: "Front office", lastActive: "35 min ago", lastMins: 35, joined: "Jun 2024", activity: [{ at: "Today 11:30", text: "Moved Maya Lindqvist to Thursday" }, { at: "Today 9:58", text: "Sold an $80 gift voucher" }] },
    { id: "u6", name: "Leo Brandt", email: "leo@hollowpine.example", role: "Front desk", status: "Deactivated", team: "Old Town studio", lastActive: "41 days ago", lastMins: 59040, joined: "Sep 2023", activity: [{ at: "28 Aug", text: "Deactivated by Rosa Delgado" }] },
    { id: "u7", name: "Priya Nair", email: "priya@hollowpine.example", role: "Instructor", status: "Invited", team: "Old Town studio", lastActive: "Never", lastMins: null, joined: "Invited 6 Oct", activity: [{ at: "6 Oct", text: "Invited by Marcus Bell" }] },
    { id: "u8", name: "Owen Pryce", email: "owen@hollowpine.example", role: "Manager", status: "Active", team: "Old Town studio", lastActive: "6 days ago", lastMins: 8640, joined: "Nov 2022", activity: [{ at: "Thu 16:45", text: "Downloaded September's sales report" }] },
    { id: "u9", name: "Sofia Marin", email: "sofia@hollowpine.example", role: "Instructor", status: "Active", team: "Riverside studio", lastActive: "2 days ago", lastMins: 2880, joined: "Apr 2024", activity: [{ at: "Tue 20:10", text: "Checked in 8 people to Intermediate wheel" }] },
    { id: "u10", name: "Daniel Kim", email: "daniel@hollowpine.example", role: "Front desk", status: "Invited", team: "Riverside studio", lastActive: "Never", lastMins: null, joined: "Invited 5 Oct", activity: [{ at: "Mon 17:40", text: "Invited by Rosa Delgado" }] },
    { id: "u11", name: "Ama Boateng", email: "ama@hollowpine.example", role: "Instructor", status: "Active", team: "Old Town studio", lastActive: "12 days ago", lastMins: 17280, joined: "Jul 2024", activity: [{ at: "26 Sep", text: "Swapped a class with Theo Varga" }] },
    { id: "u12", name: "Felix Ward", email: "felix@hollowpine.example", role: "Front desk", status: "Deactivated", team: "Riverside studio", lastActive: "3 months ago", lastMins: 129600, joined: "Jan 2023", activity: [{ at: "2 Jul", text: "Deactivated by Marcus Bell" }] },
  ],
  permissions: [
    { id: "view_bookings", label: "See bookings and the calendar", grants: ["Manager", "Instructor", "Front desk"] },
    { id: "edit_bookings", label: "Create, move and cancel bookings", grants: ["Manager", "Front desk"] },
    { id: "checkin", label: "Check customers in", grants: ["Manager", "Instructor", "Front desk"] },
    { id: "refunds", label: "Issue refunds up to $200", grants: ["Manager"] },
    { id: "timetable", label: "Edit the class timetable", grants: ["Manager"] },
    { id: "reports", label: "See sales and attendance reports", grants: ["Manager"] },
    { id: "users", label: "Invite and manage users", grants: [] as string[] },
    { id: "settings", label: "Change studio settings and billing", grants: [] as string[] },
  ],
  adminNote: "Admins can always do everything, so their column can't be changed.",
  savePerms: "Save permissions",
  discard: "Discard changes",
  unsaved: "You have unsaved changes.",
  saving: "Saving…",
  savedPerms: "Permissions saved.",
  confirmTitle: (n: number) => (n === 1 ? "Deactivate this user?" : `Deactivate ${n} users?`),
  confirmText: "They'll be signed out straight away and can't sign in again until someone reactivates them. Their bookings and history stay as they are.",
  confirmSelf: "You can't deactivate your own account, so you've been left out.",
  confirmCta: "Deactivate",
  cancel: "Cancel",
  inviteTitle: "Invite someone to Hollow Pine",
  inviteText: "They'll show as Invited until they sign in for the first time.",
  inviteCta: "Add invite",
  drawerSave: "Save changes",
  drawerSaved: "Changes saved.",
  activityTitle: "Recent activity",
  errors: {
    name: "Enter their full name.",
    email: "Enter an email address like name@example.com.",
    taken: "Someone with this email is already on the list.",
  },
};

type Status = "Active" | "Invited" | "Deactivated";
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: Status;
  team: string;
  lastActive: string;
  lastMins: number | null;
  joined: string;
  activity: { at: string; text: string }[];
};
type SortKey = "name" | "role" | "status" | "lastMins";
type Fields = { name: string; email: string; role: string; team: string };
type Errors = Partial<Record<"name" | "email", string>>;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const P = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  x: "M6 6l12 12M18 6L6 18",
  chev: "M6 9l6 6 6-6",
  sortUp: "M12 19V5M6 11l6-6 6 6",
  sortDown: "M12 5v14M6 13l6 6 6-6",
  sortBoth: "M8 9l4-4 4 4M8 15l4 4 4-4",
  plus: "M12 5v14M5 12h14",
  prev: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
  warn: "M12 8v5M12 16.5v.01M10.3 3.9L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trapKeys(e: KeyboardEvent<HTMLElement>, box: HTMLElement | null, close: () => void) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
    return;
  }
  if (e.key !== "Tab" || !box) return;
  const f = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Moves focus into a dialog when it opens and back to whatever opened it when it closes. */
function useModal<T extends HTMLElement>(open: boolean, fallback: () => HTMLElement | null) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const box = ref.current;
    (box?.querySelector<HTMLElement>("[data-autofocus]") ?? box?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => {
      window.setTimeout(() => {
        if (back && back.isConnected) back.focus();
        else fallback()?.focus();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return ref;
}

function validate(f: Fields, users: User[], selfId?: string): Errors {
  const e: Errors = {};
  if (f.name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = SAMPLE.errors.name;
  const email = f.email.trim().toLowerCase();
  if (!EMAIL.test(email)) e.email = SAMPLE.errors.email;
  else if (users.some((u) => u.id !== selfId && u.email.toLowerCase() === email)) e.email = SAMPLE.errors.taken;
  return e;
}

function Select({ id, label, value, onChange, options, hideLabel, allLabel }: { id: string; label: string; value: string; onChange: (v: string) => void; options: string[]; hideLabel?: boolean; allLabel?: string }) {
  return (
    <div className="fl-field">
      <label htmlFor={id} className={hideLabel ? "fl-sr" : undefined}>
        {label}
      </label>
      <div className="fl-aa-select">
        <select id={id} className="fl-input" value={value} onChange={(e) => onChange(e.target.value)}>
          {allLabel && <option value="">{allLabel}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <Glyph d={P.chev} />
      </div>
    </div>
  );
}

export default function AppAdmin() {
  const d = SAMPLE;
  const [users, setUsers] = useState<User[]>(() => d.users as unknown as User[]);
  const [tab, setTab] = useState("users");
  const [query, setQuery] = useState("");
  const [topQuery, setTopQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState(d.roles[2]);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [form, setForm] = useState<Fields>({ name: "", email: "", role: "", team: "" });
  const [formErrors, setFormErrors] = useState<Errors>({});
  const [formSaved, setFormSaved] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<Fields>({ name: "", email: "", role: d.roles[2], team: d.teams[0] });
  const [inviteErrors, setInviteErrors] = useState<Errors>({});
  const startPerms = () => Object.fromEntries(d.permissions.map((p) => [p.id, Object.fromEntries(d.roles.map((r) => [r, r === "Admin" || p.grants.includes(r)]))])) as Record<string, Record<string, boolean>>;
  const [perms, setPerms] = useState(startPerms);
  const [savedPerms, setSavedPerms] = useState(startPerms);
  const [permStatus, setPermStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [narrow, setNarrow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const toastTimer = useRef<number | null>(null);
  const headCheck = useRef<HTMLInputElement>(null);

  const fallback = () => headingRef.current;
  const confirmRef = useModal<HTMLDivElement>(confirm !== null, fallback);
  const drawerRef = useModal<HTMLDivElement>(drawerId !== null, fallback);
  const inviteRef = useModal<HTMLDivElement>(inviteOpen, fallback);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setNarrow(el.getBoundingClientRect().width < 820);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 820));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!narrow) setMenuOpen(false);
  }, [narrow]);

  useEffect(() => {
    if (menuOpen) navRef.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [menuOpen]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function notify(text: string) {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 5000);
  }

  const stamp = () => `Today ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const logged = (u: User, text: string): User => ({ ...u, activity: [{ at: stamp(), text }, ...u.activity] });

  // ── Users table: filter, sort, paginate ──
  const q = query.trim().toLowerCase();
  const filtered = users.filter(
    (u) => (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)) && (!roleFilter || u.role === roleFilter) && (!statusFilter || u.status === statusFilter),
  );
  const compare = (a: User, b: User) => {
    if (sort.key === "lastMins") return ((a.lastMins ?? Infinity) - (b.lastMins ?? Infinity)) * sort.dir || a.name.localeCompare(b.name);
    if (sort.key === "role") return (d.roles.indexOf(a.role) - d.roles.indexOf(b.role)) * sort.dir || a.name.localeCompare(b.name);
    if (sort.key === "status") return (d.statuses.indexOf(a.status) - d.statuses.indexOf(b.status)) * sort.dir || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name) * sort.dir;
  };
  const sorted = [...filtered].sort(compare);
  const pages = Math.max(1, Math.ceil(sorted.length / d.pageSize));
  const current = Math.min(page, pages);
  const rows = sorted.slice((current - 1) * d.pageSize, current * d.pageSize);
  const pageIds = rows.map((u) => u.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const filtersOn = !!(q || roleFilter || statusFilter);
  const seatsUsed = users.filter((u) => u.status !== "Deactivated").length;
  const counts = Object.fromEntries(d.statuses.map((s) => [s, users.filter((u) => u.status === s).length]));

  useEffect(() => {
    if (headCheck.current) headCheck.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);

  function changeFilters(fn: () => void) {
    fn();
    setPage(1);
    setSelected(new Set());
  }

  function clearFilters() {
    changeFilters(() => {
      setQuery("");
      setRoleFilter("");
      setStatusFilter("");
    });
  }

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function applyBulkRole() {
    const ids = Array.from(selected);
    setUsers((us) => us.map((u) => (ids.includes(u.id) && u.role !== bulkRole ? logged({ ...u, role: bulkRole }, `Role changed to ${bulkRole} by ${d.me.name}`) : u)));
    setSelected(new Set());
    notify(`Role changed to ${bulkRole} for ${ids.length} ${ids.length === 1 ? "person" : "people"}.`);
  }

  function askDeactivate(ids: string[]) {
    setConfirm(ids);
  }

  const confirmIds = (confirm ?? []).filter((id) => id !== d.me.id);
  const confirmNames = confirmIds.map((id) => users.find((u) => u.id === id)?.name ?? "");

  function doDeactivate() {
    const ids = confirmIds;
    setUsers((us) => us.map((u) => (ids.includes(u.id) && u.status !== "Deactivated" ? logged({ ...u, status: "Deactivated" }, `Deactivated by ${d.me.name}`) : u)));
    setSelected(new Set());
    setConfirm(null);
    notify(ids.length === 1 ? `${confirmNames[0]} has been deactivated.` : `${ids.length} people have been deactivated.`);
  }

  // ── Drawer ──
  const drawerUser = users.find((u) => u.id === drawerId) ?? null;
  const drawerDirty = !!drawerUser && (form.name !== drawerUser.name || form.email !== drawerUser.email || form.role !== drawerUser.role || form.team !== drawerUser.team);

  function openDrawer(u: User) {
    setForm({ name: u.name, email: u.email, role: u.role, team: u.team });
    setFormErrors({});
    setFormSaved(false);
    setDrawerId(u.id);
  }

  function saveDrawer(e: FormEvent) {
    e.preventDefault();
    if (!drawerUser) return;
    const errs = validate(form, users, drawerUser.id);
    setFormErrors(errs);
    if (Object.keys(errs).length) {
      window.setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(), 0);
      return;
    }
    const roleChanged = form.role !== drawerUser.role;
    const clean = { ...form, name: form.name.trim(), email: form.email.trim() };
    setUsers((us) => us.map((u) => (u.id === drawerUser.id ? logged({ ...u, ...clean }, roleChanged ? `Role changed to ${form.role} by ${d.me.name}` : `Details updated by ${d.me.name}`) : u)));
    setForm(clean);
    setFormSaved(true);
  }

  function reactivate(u: User) {
    setUsers((us) => us.map((x) => (x.id === u.id ? logged({ ...x, status: "Active" }, `Reactivated by ${d.me.name}`) : x)));
    notify(`${u.name} can sign in again.`);
  }

  // ── Invite ──
  function openInvite() {
    setInvite({ name: "", email: "", role: d.roles[2], team: d.teams[0] });
    setInviteErrors({});
    setInviteOpen(true);
  }

  function submitInvite(e: FormEvent) {
    e.preventDefault();
    const errs = validate(invite, users);
    setInviteErrors(errs);
    if (Object.keys(errs).length) {
      window.setTimeout(() => inviteRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(), 0);
      return;
    }
    const name = invite.name.trim();
    const user: User = {
      id: `u${Date.now().toString(36)}`,
      name,
      email: invite.email.trim(),
      role: invite.role,
      team: invite.team,
      status: "Invited",
      lastActive: "Never",
      lastMins: null,
      joined: "Invited today",
      activity: [{ at: stamp(), text: `Invited by ${d.me.name}` }],
    };
    setUsers((us) => [user, ...us]);
    setInviteOpen(false);
    changeFilters(() => {
      setQuery("");
      setRoleFilter("");
      setStatusFilter("");
    });
    const at = [user, ...users].sort(compare).findIndex((u) => u.id === user.id);
    setPage(Math.floor(at / d.pageSize) + 1);
    notify(`${name} has been added as Invited.`);
  }

  // ── Permissions ──
  function peopleIn(role: string) {
    const n = users.filter((u) => u.role === role && u.status !== "Deactivated").length;
    return `${n} ${n === 1 ? "person" : "people"}`;
  }
  const permsDirty = JSON.stringify(perms) !== JSON.stringify(savedPerms);
  function savePerms() {
    setPermStatus("saving");
    window.setTimeout(() => {
      setSavedPerms(perms);
      setPermStatus("saved");
      notify(d.savedPerms);
    }, 700);
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const ids = d.tabs.map((t) => t.id);
    const at = ids.indexOf(tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (at + 1) % ids.length;
    else if (e.key === "ArrowLeft") next = (at - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(ids[next]);
    tabRefs.current[ids[next]]?.focus();
  }

  function closeMenu() {
    setMenuOpen(false);
    window.setTimeout(() => menuBtn.current?.focus(), 0);
  }

  function sortHead(k: SortKey, label: string) {
    const on = sort.key === k;
    return (
      <th key={k} scope="col" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
        <button type="button" className="fl-aa-sort" onClick={() => sortBy(k)}>
          {label}
          <Glyph d={on ? (sort.dir === 1 ? P.sortUp : P.sortDown) : P.sortBoth} />
        </button>
      </th>
    );
  }

  const fieldProps = (prefix: string, key: "name" | "email", errs: Errors) => ({
    id: `${prefix}-${key}`,
    "aria-invalid": errs[key] ? true : undefined,
    "aria-describedby": errs[key] ? `${prefix}-${key}-err` : undefined,
  });

  return (
    <div ref={rootRef} className="fl-aa-frame fl-aa-admin" data-narrow={narrow ? "true" : "false"}>
      {narrow && menuOpen && <button type="button" className="fl-aa-scrim" aria-label={d.closeMenu} tabIndex={-1} onClick={closeMenu} />}

      <aside
        ref={navRef}
        className={`fl-aa-nav${menuOpen ? " is-open" : ""}`}
        aria-label={d.area}
        role={narrow && menuOpen ? "dialog" : undefined}
        aria-modal={narrow && menuOpen ? true : undefined}
        onKeyDown={(e) => menuOpen && trapKeys(e, navRef.current, closeMenu)}
      >
        <div className="fl-aa-nav__brand">
          <span className="fl-aa-nav__mark" aria-hidden="true">
            {d.product[0]}
          </span>
          <span>
            <strong>{d.product}</strong>
            <span>{d.area}</span>
          </span>
          {narrow && (
            <button type="button" className="fl-aa-iconbtn fl-aa-iconbtn--ink" aria-label={d.closeMenu} onClick={closeMenu}>
              <Glyph d={P.x} />
            </button>
          )}
        </div>
        <nav aria-label="Sections">
          <ul className="fl-aa-nav__list">
            {d.nav.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  aria-current={n.id === d.currentNav ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    if (n.id !== d.currentNav) notify(d.navElsewhere);
                    if (menuOpen) closeMenu();
                  }}
                >
                  <Icon name={n.icon} />
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="fl-aa-nav__plan">
          <strong>{d.plan.name}</strong>
          <span>
            {seatsUsed} of {d.plan.seats} seats used
          </span>
          <span className="fl-aa-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (seatsUsed / d.plan.seats) * 100)}%` }} />
          </span>
        </div>
      </aside>

      <div className="fl-aa-body">
        <header className="fl-aa-topbar">
          {narrow && (
            <button ref={menuBtn} type="button" className="fl-aa-iconbtn" aria-label={d.openMenu} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <Icon name="menu" />
            </button>
          )}
          <form
            role="search"
            className="fl-aa-search fl-aa-search--top"
            onSubmit={(e) => {
              e.preventDefault();
              setTab("users");
              changeFilters(() => setQuery(topQuery));
              notify(topQuery.trim() ? `Showing people matching “${topQuery.trim()}”.` : "Showing everyone.");
            }}
          >
            <label htmlFor="fl-aa-top-q" className="fl-sr">
              {d.topSearchLabel}
            </label>
            <Glyph d={P.search} />
            <input id="fl-aa-top-q" className="fl-input" type="search" placeholder={d.topSearchPlaceholder} value={topQuery} onChange={(e) => setTopQuery(e.target.value)} />
          </form>
          <div className="fl-aa-me">
            <span className="fl-aa-avatar" aria-hidden="true">
              {initials(d.me.name)}
            </span>
            <span className="fl-aa-me__text">
              <span className="fl-sr">Signed in as </span>
              <strong>{d.me.name}</strong>
              <span>{d.me.role}</span>
            </span>
          </div>
        </header>

        <div className="fl-aa-content">
          <div className="fl-aa-pagehead">
            <div>
              <p className="fl-eyebrow">{d.eyebrow}</p>
              <h1 ref={headingRef} tabIndex={-1} className="fl-title fl-title--md">
                {d.title}
              </h1>
              <p className="fl-meta">{d.lede}</p>
            </div>
            <button type="button" className="fl-btn fl-btn--primary" onClick={openInvite}>
              <Glyph d={P.plus} />
              {d.invite}
            </button>
          </div>

          <div className="fl-aa-tabs" role="tablist" aria-label={d.title}>
            {d.tabs.map((t) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`fl-aa-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`fl-aa-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={onTabKey}
              >
                {t.label}
                {t.id === "users" && <span className="fl-aa-count-pill">{users.length}</span>}
              </button>
            ))}
          </div>

          {tab === "users" ? (
            <div role="tabpanel" id="fl-aa-panel-users" aria-labelledby="fl-aa-tab-users" className="fl-aa-panel">
              <p className="fl-aa-summary">
                {d.statuses.map((s) => (
                  <span key={s}>
                    <span className={`fl-aa-dot fl-aa-dot--${s.toLowerCase()}`} aria-hidden="true" />
                    {counts[s]} {s.toLowerCase()}
                  </span>
                ))}
              </p>

              <div className="fl-aa-toolbar">
                <div className="fl-aa-search">
                  <label htmlFor="fl-aa-users-q" className="fl-sr">
                    Search users
                  </label>
                  <Glyph d={P.search} />
                  <input id="fl-aa-users-q" className="fl-input" type="search" placeholder="Name or email" value={query} onChange={(e) => changeFilters(() => setQuery(e.target.value))} />
                </div>
                <Select id="fl-aa-f-role" label="Role" hideLabel allLabel="All roles" value={roleFilter} options={d.roles} onChange={(v) => changeFilters(() => setRoleFilter(v))} />
                <Select id="fl-aa-f-status" label="Status" hideLabel allLabel="All statuses" value={statusFilter} options={d.statuses} onChange={(v) => changeFilters(() => setStatusFilter(v))} />
                {filtersOn && (
                  <button type="button" className="fl-aa-textbtn" onClick={clearFilters}>
                    {d.clearFilters}
                  </button>
                )}
              </div>

              {selected.size > 0 && (
                <div className="fl-aa-bulk" role="region" aria-label="Bulk actions">
                  <strong>{selected.size} selected</strong>
                  <div className="fl-aa-bulk__role">
                    <Select id="fl-aa-bulk-role" label="Change role to" hideLabel value={bulkRole} options={d.roles} onChange={setBulkRole} />
                    <button type="button" className="fl-btn fl-btn--secondary fl-aa-btn-sm" onClick={applyBulkRole}>
                      Change role
                    </button>
                  </div>
                  <button type="button" className="fl-btn fl-aa-btn-sm fl-aa-btn--danger-quiet" onClick={() => askDeactivate(Array.from(selected))}>
                    Deactivate
                  </button>
                  <button type="button" className="fl-aa-textbtn" onClick={() => setSelected(new Set())}>
                    Clear selection
                  </button>
                </div>
              )}

              <div className="fl-aa-tablewrap" tabIndex={0} role="region" aria-labelledby="fl-aa-users-caption">
                <table className="fl-aa-table">
                  <caption id="fl-aa-users-caption" className="fl-sr">
                    Users, sorted by {sort.key === "lastMins" ? "last active" : sort.key} {sort.dir === 1 ? "ascending" : "descending"}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="fl-aa-table__check">
                        <input ref={headCheck} type="checkbox" checked={allOnPage} disabled={!rows.length} onChange={togglePage} aria-label="Select everyone on this page" />
                      </th>
                      {sortHead("name", "Name")}
                      {sortHead("role", "Role")}
                      {sortHead("status", "Status")}
                      <th scope="col">Team</th>
                      {sortHead("lastMins", "Last active")}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="fl-aa-empty">
                            <span className="fl-icon">
                              <Icon name="users" />
                            </span>
                            <strong>{d.noResultsTitle}</strong>
                            <p className="fl-meta">{d.noResultsText}</p>
                            <button type="button" className="fl-btn fl-btn--secondary fl-aa-btn-sm" onClick={clearFilters}>
                              {d.clearFilters}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      rows.map((u) => (
                        <tr key={u.id} data-selected={selected.has(u.id) ? "true" : undefined}>
                          <td className="fl-aa-table__check">
                            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleRow(u.id)} aria-label={`Select ${u.name}`} />
                          </td>
                          <td>
                            <span className="fl-aa-who">
                              <span className="fl-aa-avatar fl-aa-avatar--sm" aria-hidden="true">
                                {initials(u.name)}
                              </span>
                              <span>
                                <button type="button" className="fl-aa-who__name" onClick={() => openDrawer(u)}>
                                  {u.name}
                                  {u.id === d.me.id && <span className="fl-aa-you">You</span>}
                                </button>
                                <span className="fl-aa-who__email">{u.email}</span>
                              </span>
                            </span>
                          </td>
                          <td>{u.role}</td>
                          <td>
                            <span className={`fl-aa-status fl-aa-status--${u.status.toLowerCase()}`}>{u.status}</span>
                          </td>
                          <td className="fl-aa-muted">{u.team}</td>
                          <td className="fl-aa-muted">{u.lastActive}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="fl-aa-tablefoot">
                <p className="fl-meta">
                  {sorted.length === 0 ? "No users to show" : `Showing ${(current - 1) * d.pageSize + 1}–${(current - 1) * d.pageSize + rows.length} of ${sorted.length} ${sorted.length === 1 ? "user" : "users"}`}
                </p>
                {pages > 1 && (
                  <nav className="fl-aa-pager" aria-label="Pages">
                    <button type="button" className="fl-aa-iconbtn fl-aa-iconbtn--sm" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}>
                      <Glyph d={P.prev} />
                    </button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" className="fl-aa-pager__n" aria-current={n === current ? "page" : undefined} aria-label={`Page ${n}`} onClick={() => setPage(n)}>
                        {n}
                      </button>
                    ))}
                    <button type="button" className="fl-aa-iconbtn fl-aa-iconbtn--sm" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}>
                      <Glyph d={P.next} />
                    </button>
                  </nav>
                )}
              </div>
            </div>
          ) : (
            <div role="tabpanel" id="fl-aa-panel-roles" aria-labelledby="fl-aa-tab-roles" className="fl-aa-panel">
              <p className="fl-meta">{d.adminNote}</p>
              <div className="fl-aa-tablewrap" tabIndex={0} role="region" aria-labelledby="fl-aa-perms-caption">
                <table className="fl-aa-table fl-aa-matrix">
                  <caption id="fl-aa-perms-caption" className="fl-sr">
                    What each role can do
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Permission</th>
                      {d.roles.map((r) => (
                        <th key={r} scope="col">
                          {r}
                          <span className="fl-aa-matrix__n">{peopleIn(r)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.permissions.map((p) => (
                      <tr key={p.id}>
                        <th scope="row">{p.label}</th>
                        {d.roles.map((r) => (
                          <td key={r}>
                            <input
                              type="checkbox"
                              checked={perms[p.id][r]}
                              disabled={r === "Admin" || permStatus === "saving"}
                              aria-label={`${r}: ${p.label}`}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setPerms((all) => ({ ...all, [p.id]: { ...all[p.id], [r]: on } }));
                                setPermStatus("idle");
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fl-aa-savebar">
                <span className={`fl-aa-savebar__msg${permStatus === "saved" && !permsDirty ? " is-saved" : ""}`} role="status">
                  {permStatus === "saving" ? d.saving : permsDirty ? d.unsaved : permStatus === "saved" ? d.savedPerms : ""}
                </span>
                <button type="button" className="fl-aa-textbtn" disabled={!permsDirty || permStatus === "saving"} onClick={() => setPerms(savedPerms)}>
                  {d.discard}
                </button>
                <button type="button" className="fl-btn fl-btn--primary fl-aa-btn-sm" disabled={!permsDirty || permStatus === "saving"} onClick={savePerms}>
                  {permStatus === "saving" ? d.saving : d.savePerms}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {drawerUser && (
        <div className="fl-aa-overlay fl-aa-overlay--drawer" onMouseDown={(e) => e.target === e.currentTarget && setDrawerId(null)}>
          <div
            ref={drawerRef}
            className="fl-aa-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fl-aa-drawer-title"
            onKeyDown={(e) => trapKeys(e, drawerRef.current, () => setDrawerId(null))}
          >
            <div className="fl-aa-drawer__head">
              <span className="fl-aa-avatar fl-aa-avatar--lg" aria-hidden="true">
                {initials(drawerUser.name)}
              </span>
              <div>
                <h2 id="fl-aa-drawer-title" className="fl-aa-h2">
                  {drawerUser.name}
                </h2>
                <p className="fl-meta">
                  <span className={`fl-aa-status fl-aa-status--${drawerUser.status.toLowerCase()}`}>{drawerUser.status}</span> · Joined {drawerUser.joined}
                </p>
              </div>
              <button type="button" className="fl-aa-iconbtn" aria-label="Close" onClick={() => setDrawerId(null)}>
                <Glyph d={P.x} />
              </button>
            </div>

            <form className="fl-form fl-aa-drawer__form" noValidate onSubmit={saveDrawer}>
              <div className="fl-field">
                <label htmlFor="fl-aa-dr-name">Full name</label>
                <input
                  {...fieldProps("fl-aa-dr", "name", formErrors)}
                  className="fl-input"
                  autoComplete="off"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setFormSaved(false);
                    if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                  }}
                />
                {formErrors.name && (
                  <p id="fl-aa-dr-name-err" className="fl-aa-err">
                    {formErrors.name}
                  </p>
                )}
              </div>
              <div className="fl-field">
                <label htmlFor="fl-aa-dr-email">Email</label>
                <input
                  {...fieldProps("fl-aa-dr", "email", formErrors)}
                  className="fl-input"
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setFormSaved(false);
                    if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                  }}
                />
                {formErrors.email && (
                  <p id="fl-aa-dr-email-err" className="fl-aa-err">
                    {formErrors.email}
                  </p>
                )}
              </div>
              <div className="fl-aa-row2">
                <Select id="fl-aa-dr-role" label="Role" value={form.role} options={d.roles} onChange={(v) => (setForm({ ...form, role: v }), setFormSaved(false))} />
                <Select id="fl-aa-dr-team" label="Team" value={form.team} options={d.teams} onChange={(v) => (setForm({ ...form, team: v }), setFormSaved(false))} />
              </div>
              <div className="fl-aa-drawer__save">
                <span className={`fl-aa-savebar__msg${formSaved && !drawerDirty ? " is-saved" : ""}`} role="status">
                  {drawerDirty ? d.unsaved : formSaved ? d.drawerSaved : ""}
                </span>
                <button type="submit" className="fl-btn fl-btn--primary fl-aa-btn-sm" disabled={!drawerDirty}>
                  {d.drawerSave}
                </button>
              </div>
            </form>

            <section className="fl-aa-activity" aria-labelledby="fl-aa-activity-title">
              <h3 id="fl-aa-activity-title" className="fl-aa-h3">
                {d.activityTitle}
              </h3>
              <ol>
                {drawerUser.activity.map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    <span className="fl-aa-activity__dot" aria-hidden="true" />
                    <span>{a.text}</span>
                    <time className="fl-meta">{a.at}</time>
                  </li>
                ))}
              </ol>
            </section>

            {drawerUser.id !== d.me.id && (
              <div className="fl-aa-drawer__danger">
                {drawerUser.status === "Deactivated" ? (
                  <button type="button" className="fl-btn fl-btn--secondary fl-aa-btn-sm" onClick={() => reactivate(drawerUser)}>
                    Reactivate {drawerUser.name.split(" ")[0]}
                  </button>
                ) : (
                  <button type="button" className="fl-btn fl-aa-btn-sm fl-aa-btn--danger-quiet" onClick={() => askDeactivate([drawerUser.id])}>
                    Deactivate {drawerUser.name.split(" ")[0]}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="fl-aa-overlay" onMouseDown={(e) => e.target === e.currentTarget && setInviteOpen(false)}>
          <div ref={inviteRef} className="fl-aa-dialog" role="dialog" aria-modal="true" aria-labelledby="fl-aa-invite-title" aria-describedby="fl-aa-invite-text" onKeyDown={(e) => trapKeys(e, inviteRef.current, () => setInviteOpen(false))}>
            <div className="fl-aa-dialog__head">
              <h2 id="fl-aa-invite-title" className="fl-aa-h2">
                {d.inviteTitle}
              </h2>
              <button type="button" className="fl-aa-iconbtn" aria-label="Close" onClick={() => setInviteOpen(false)}>
                <Glyph d={P.x} />
              </button>
            </div>
            <p id="fl-aa-invite-text" className="fl-meta">
              {d.inviteText}
            </p>
            <form className="fl-form" noValidate onSubmit={submitInvite}>
              <div className="fl-field">
                <label htmlFor="fl-aa-inv-name">Full name</label>
                <input
                  {...fieldProps("fl-aa-inv", "name", inviteErrors)}
                  className="fl-input"
                  autoComplete="off"
                  data-autofocus
                  value={invite.name}
                  onChange={(e) => {
                    setInvite({ ...invite, name: e.target.value });
                    if (inviteErrors.name) setInviteErrors({ ...inviteErrors, name: undefined });
                  }}
                />
                {inviteErrors.name && (
                  <p id="fl-aa-inv-name-err" className="fl-aa-err">
                    {inviteErrors.name}
                  </p>
                )}
              </div>
              <div className="fl-field">
                <label htmlFor="fl-aa-inv-email">Email</label>
                <input
                  {...fieldProps("fl-aa-inv", "email", inviteErrors)}
                  className="fl-input"
                  type="email"
                  autoComplete="off"
                  placeholder="name@example.com"
                  value={invite.email}
                  onChange={(e) => {
                    setInvite({ ...invite, email: e.target.value });
                    if (inviteErrors.email) setInviteErrors({ ...inviteErrors, email: undefined });
                  }}
                />
                {inviteErrors.email && (
                  <p id="fl-aa-inv-email-err" className="fl-aa-err">
                    {inviteErrors.email}
                  </p>
                )}
              </div>
              <div className="fl-aa-row2">
                <Select id="fl-aa-inv-role" label="Role" value={invite.role} options={d.roles} onChange={(v) => setInvite({ ...invite, role: v })} />
                <Select id="fl-aa-inv-team" label="Team" value={invite.team} options={d.teams} onChange={(v) => setInvite({ ...invite, team: v })} />
              </div>
              <div className="fl-aa-dialog__actions">
                <button type="button" className="fl-btn fl-btn--secondary fl-aa-btn-sm" onClick={() => setInviteOpen(false)}>
                  {d.cancel}
                </button>
                <button type="submit" className="fl-btn fl-btn--primary fl-aa-btn-sm">
                  {d.inviteCta}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fl-aa-overlay fl-aa-overlay--top" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div
            ref={confirmRef}
            className="fl-aa-dialog fl-aa-dialog--sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="fl-aa-confirm-title"
            aria-describedby="fl-aa-confirm-text"
            onKeyDown={(e) => trapKeys(e, confirmRef.current, () => setConfirm(null))}
          >
            <span className="fl-aa-dialog__icon" aria-hidden="true">
              <Glyph d={P.warn} />
            </span>
            <h2 id="fl-aa-confirm-title" className="fl-aa-h2">
              {d.confirmTitle(confirmIds.length)}
            </h2>
            <p id="fl-aa-confirm-text" className="fl-meta">
              {d.confirmText}
            </p>
            {confirmIds.length > 0 && (
              <ul className="fl-aa-confirm__names">
                {confirmNames.slice(0, 4).map((n) => (
                  <li key={n}>{n}</li>
                ))}
                {confirmNames.length > 4 && <li>and {confirmNames.length - 4} more</li>}
              </ul>
            )}
            {confirm.includes(d.me.id) && <p className="fl-aa-note">{d.confirmSelf}</p>}
            <div className="fl-aa-dialog__actions">
              <button type="button" className="fl-btn fl-btn--secondary fl-aa-btn-sm" data-autofocus onClick={() => setConfirm(null)}>
                {d.cancel}
              </button>
              <button type="button" className="fl-btn fl-aa-btn-sm fl-aa-btn--danger" disabled={confirmIds.length === 0} onClick={doDeactivate}>
                {d.confirmCta}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fl-aa-toast fl-aa-toast--admin" role="status" aria-live="polite" data-show={toast ? "true" : undefined}>
        {toast}
      </div>
    </div>
  );
}
