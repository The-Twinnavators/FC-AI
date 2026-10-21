/** @flowcode-library table-members · Team members table (Tables and lists)
 * Catalog ID: p.members-table (pattern)
 * Function: The team members table (p.members-table): everyone on a workspace with their role, status and last activity; change a role in the row (with undo), invite by email with a role (checked for format, duplicates and free seats), resend or cancel an invite, and remove someone after a confirmation; search and a role filter narrow the list.
 * Use it as: import { MembersTable } from "./table-members"; <MembersTable title lede? roles={[{ value, label }]} people={[{ id, name, email, role, status?: "active"|"invited", lastActive?, src? }]} ownerRole?="owner" you?="id" seats?={10} inviteRole? labels?={{ invite, search, allRoles, ... }} onRoleChange?={(id, role) => ...} onInvite?={(email, role) => ...} onResend?={(id) => ...} onRemove?={(id) => ...} />
 * Built from: c.text-field.outlined, c.select.outlined, c.badge.status, c.avatar.person, c.button.primary, c.button.tertiary, c.modal.form, c.modal.danger
 * Look: A title with a seat meter and an Invite button, a search box and role filter, then a bordered table: avatar, name and email; a compact role dropdown; an Active or Invited pill; last active; and quiet Resend and Remove buttons. The owner's role is a fixed pill. On a phone each person becomes a small card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-warning --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --text-md --weight-semibold --focus-ring --duration-fast --duration-base --ease-out --easing --enter-distance
 * Use cases: team members; workspace members; user management; roles and permissions; invite teammates; account users; organization settings; seat management; admin users list
 * Jobs to be done: see who is on my team; change what someone can do; invite a teammate; resend an invite that got lost; remove someone who left; find a person by name or email; check how many seats are left
 * Keywords: members, team, users, roles, invite, permissions, seats, admin, table, remove
 */
/**
 * Team members table: the people on a workspace with their roles. Each row's role is a compact dropdown; changing it
 * says so in the status line with Undo. Invite opens a short form (email and role) that checks the address, refuses
 * someone already on the team and stops when the seats are full; the new person joins the list as Invited with Resend
 * and Cancel invite. Remove asks first. The owner's role is fixed and the signed-in person can't remove themselves.
 * Search and the role filter narrow the list, and rows glide to their new places when it changes. On a narrow screen
 * each person becomes a card. Make it the app's own: replace SAMPLE with the workspace's people and roles, and save
 * through onRoleChange, onInvite, onResend and onRemove.
 * Built from c.text-field.outlined, c.select.outlined, c.badge.status, c.avatar.person, c.button.primary,
 * c.button.tertiary and c.modal (form and danger).
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its base and striped data tables.
 */
/**
 * How to try it
 * - Change Marcus's role to Viewer: the status line says so; press Undo.
 * - Press Invite, type a bad address and press Send invite: the field says what's wrong. Try ana@northlight.studio
 *   (already on the team), then a new address: the person joins as Invited.
 * - Press Resend on an invited row, then Cancel invite.
 * - Press Remove on Priya and confirm. Type in the search box or pick a role: rows glide into place.
 *
 * Dependencies: React (useId, useLayoutEffect, useMemo, useRef, useState), the library's TextField, Select, Badge,
 * Avatar, Button and Modal ("./text-fields-states", "./dropdowns-states", "./badges-status", "./avatars-variants",
 * "./buttons-variants", "./modals-dialogs") and its inline icon set ("./icons"). Nothing else: no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css/teammembers.css.
 */
import { useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── p.members-table: people, roles, invites and removals. ──

export type MemberRole = { value: string; label: string };
export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  /** "invited" until they accept; "active" when left out. */
  status?: "active" | "invited";
  /** Words for the last-active column: "2 hours ago". */
  lastActive?: string;
  src?: string;
};

export type MembersLabels = {
  invite?: string;
  inviteTitle?: string;
  inviteText?: string;
  send?: string;
  email?: string;
  role?: string;
  search?: string;
  allRoles?: string;
  seats?: string;
  full?: string;
  name?: string;
  status?: string;
  lastActive?: string;
  actions?: string;
  active?: string;
  invited?: string;
  resend?: string;
  resent?: string;
  cancelInvite?: string;
  remove?: string;
  removeTitle?: string;
  removeText?: string;
  you?: string;
  never?: string;
  noMatch?: string;
  clear?: string;
  undo?: string;
  badEmail?: string;
  noEmail?: string;
  taken?: string;
};

export type MembersTableProps = {
  title: string;
  lede?: string;
  people: Member[];
  /** The roles a member can have, in order of power; the first is the one an invite starts on unless `inviteRole`. */
  roles: MemberRole[];
  /** A role nobody can change or remove (the workspace owner). */
  ownerRole?: string;
  /** The signed-in person's id: marked "You" and can't be removed. */
  you?: string;
  /** How many people (active and invited) the plan allows. */
  seats?: number;
  /** The role the invite form starts on. */
  inviteRole?: string;
  labels?: MembersLabels;
  onRoleChange?: (id: string, role: string) => void;
  onInvite?: (email: string, role: string) => void;
  onResend?: (id: string) => void;
  onRemove?: (id: string) => void;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ms = (el: Element, name: string, fallback: number) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith("ms") ? n : n * 1000) : fallback;
};

/** FLIP: rows marked data-flip glide from where they were to where they are now whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const rows = [...el.querySelectorAll<HTMLElement>("[data-flip]")];
    const now = new Map(rows.map((r) => [r.dataset.flip!, r.getBoundingClientRect().top]));
    if (!reduced()) {
      const duration = ms(el, "--duration-base", 200);
      const easing = getComputedStyle(el).getPropertyValue("--ease-out").trim() || "ease-out";
      for (const r of rows) {
        const was = last.current.get(r.dataset.flip!);
        const dy = was === undefined ? 0 : was - now.get(r.dataset.flip!)!;
        if (Math.abs(dy) > 1) r.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration, easing });
      }
    }
    last.current = now;
  }, [box, key]);
}

export function MembersTable({ title, lede, people, roles, ownerRole, you, seats, inviteRole, labels = {}, onRoleChange, onInvite, onResend, onRemove }: MembersTableProps) {
  const l = {
    invite: "Invite",
    inviteTitle: "Invite a teammate",
    inviteText: "They'll get an email with a link to join.",
    send: "Send invite",
    email: "Email",
    role: "Role",
    search: "Search people",
    allRoles: "All roles",
    seats: "seats used",
    full: "All seats are taken. Remove someone or add seats to invite more.",
    name: "Name",
    status: "Status",
    lastActive: "Last active",
    actions: "Actions",
    active: "Active",
    invited: "Invited",
    resend: "Resend",
    resent: "Sent",
    cancelInvite: "Cancel invite",
    remove: "Remove",
    removeTitle: "Remove {name}?",
    removeText: "They lose access right away. You can invite them again later.",
    you: "You",
    never: "Never",
    noMatch: "No one matches your search.",
    clear: "Clear filters",
    undo: "Undo",
    badEmail: "Enter an email like name@company.com.",
    noEmail: "Enter an email address.",
    taken: "is already on the team.",
    ...labels,
  };
  const id = useId();
  const [list, setList] = useState(people);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [removing, setRemoving] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);
  const [resent, setResent] = useState<string[]>([]);
  const [status, setStatus] = useState<{ text: string; undo?: () => void } | null>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const focusSearch = () => document.getElementById(`${id}-search`)?.focus();

  const roleLabel = (v: string) => roles.find((r) => r.value === v)?.label ?? v;
  const used = list.length;
  const full = seats !== undefined && used >= seats;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((m) => (!roleFilter || m.role === roleFilter) && (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)));
  }, [list, query, roleFilter]);

  useFlip(body, rows.map((m) => m.id).join());

  const changeRole = (m: Member, role: string) => {
    const before = m.role;
    setList((xs) => xs.map((x) => (x.id === m.id ? { ...x, role } : x)));
    onRoleChange?.(m.id, role);
    setStatus({
      text: `${m.name} is now ${roleLabel(role)}.`,
      undo: () => {
        setList((xs) => xs.map((x) => (x.id === m.id ? { ...x, role: before } : x)));
        onRoleChange?.(m.id, before);
        setStatus({ text: `${m.name} is back to ${roleLabel(before)}.` });
      },
    });
  };

  // Leaving rows fade first, then go; focus moves to the search box so it isn't left on nothing.
  const drop = (m: Member, text: string) => {
    setLeaving((xs) => [...xs, m.id]);
    setStatus({ text });
    focusSearch();
    const go = () => {
      setList((xs) => xs.filter((x) => x.id !== m.id));
      setLeaving((xs) => xs.filter((x) => x !== m.id));
    };
    if (reduced() || !body.current) go();
    else window.setTimeout(go, ms(body.current, "--duration-base", 200));
  };

  const invite = (data: FormData) => {
    const email = String(data.get("email") ?? "").trim();
    const role = String(data.get("role") ?? "");
    if (!email) return (setInviteError(l.noEmail), false as const);
    if (!EMAIL.test(email)) return (setInviteError(l.badEmail), false as const);
    if (list.some((m) => m.email.toLowerCase() === email.toLowerCase())) return (setInviteError(`${email} ${l.taken}`), false as const);
    if (full) return (setInviteError(l.full), false as const);
    const person: Member = { id: `inv-${Date.now()}`, name: email.split("@")[0]!, email, role, status: "invited" };
    setList((xs) => [...xs, person]);
    setFresh([person.id]);
    setQuery("");
    setRoleFilter("");
    setStatus({ text: `Invite sent to ${email}.` });
    onInvite?.(email, role);
  };

  const resend = (m: Member) => {
    setResent((xs) => [...xs, m.id]);
    setStatus({ text: `Invite sent again to ${m.email}.` });
    onResend?.(m.id);
    window.setTimeout(() => setResent((xs) => xs.filter((x) => x !== m.id)), 4000);
  };

  const filtered = query.trim() !== "" || roleFilter !== "";

  return (
    <section className="fl-tm" aria-labelledby={`${id}-title`} data-fl="p.members-table">
      <div className="fl-tm-head">
        <div className="fl-tm-heading">
          <h2 id={`${id}-title`}>
            {title}
          </h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <div className="fl-tm-headtools">
          {seats !== undefined ? (
            <div className="fl-tm-seats">
              <span>
                <strong>{used}</strong> of {seats} {l.seats}
              </span>
              <span className={`fl-tm-meter${full ? " is-full" : ""}`} role="meter" aria-label={l.seats} aria-valuemin={0} aria-valuemax={seats} aria-valuenow={used}>
                <span style={{ width: `${Math.min(100, (used / seats) * 100)}%` }} />
              </span>
            </div>
          ) : null}
          <Button
            icon="plus"
            size={40}
            disabled={full}
            onClick={() => {
              setInviteError("");
              setInviting(true);
            }}
            aria-describedby={full ? `${id}-full` : undefined}
          >
            {l.invite}
          </Button>
        </div>
      </div>
      {full ? (
        <p id={`${id}-full`} className="fl-tm-note">
          <Icon name="info" />
          {l.full}
        </p>
      ) : null}

      <div className="fl-tm-tools">
        <label className="fl-tm-search">
          <span className="fl-sr">{l.search}</span>
          <Icon name="search" />
          <TextField id={`${id}-search`} type="search" size={40} placeholder={l.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="fl-tm-filter">
          <span className="fl-sr">{l.role}</span>
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} options={[{ value: "", label: l.allRoles }, ...roles]} />
        </label>
      </div>

      <div className="fl-tm-scroll">
        <table className="fl-tm-table">
          <caption className="fl-sr">
            {title}, {rows.length} of {list.length} shown
          </caption>
          <thead>
            <tr>
              <th scope="col">{l.name}</th>
              <th scope="col">{l.role}</th>
              <th scope="col">{l.status}</th>
              <th scope="col">{l.lastActive}</th>
              <th scope="col">
                <span className="fl-sr">{l.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody ref={body}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="fl-tm-empty">
                  <span>{l.noMatch}</span>
                  {filtered ? (
                    <Button
                      variant="tertiary"
                      size={32}
                      onClick={() => {
                        setQuery("");
                        setRoleFilter("");
                        focusSearch();
                      }}
                    >
                      {l.clear}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const isOwner = ownerRole !== undefined && m.role === ownerRole;
                const isYou = m.id === you;
                const invited = m.status === "invited";
                const cls = ["fl-tm-row", leaving.includes(m.id) ? "is-leaving" : "", fresh.includes(m.id) ? "is-new" : ""].filter(Boolean).join(" ");
                return (
                  <tr key={m.id} data-flip={m.id} className={cls} inert={leaving.includes(m.id) || undefined}>
                    <th scope="row" data-label={l.name}>
                      <span className="fl-tm-person">
                        <Avatar name={m.name} src={m.src} size={40} decorative />
                        <span className="fl-tm-who">
                          <strong>
                            {m.name}
                            {isYou ? <span className="fl-tm-you">{l.you}</span> : null}
                          </strong>
                          <span>{m.email}</span>
                        </span>
                      </span>
                    </th>
                    <td data-label={l.role}>
                      {isOwner ? (
                        <Badge tone="info">{roleLabel(m.role)}</Badge>
                      ) : (
                        <span className="fl-tm-role">
                          <Select
                            aria-label={`${l.role} for ${m.name}`}
                            value={m.role}
                            onChange={(e) => changeRole(m, e.target.value)}
                            options={roles.filter((r) => r.value !== ownerRole)}
                          />
                        </span>
                      )}
                    </td>
                    <td data-label={l.status}>
                      <Badge tone={invited ? "warning" : "success"} led>
                        {invited ? l.invited : l.active}
                      </Badge>
                    </td>
                    <td data-label={l.lastActive} className="fl-tm-muted">
                      {invited ? "—" : m.lastActive ?? l.never}
                    </td>
                    <td className="fl-tm-actions">
                      {invited ? (
                        <>
                          <Button variant="tertiary" size={32} icon={resent.includes(m.id) ? "check" : "send"} disabled={resent.includes(m.id)} onClick={() => resend(m)} aria-label={`${l.resend} invite to ${m.email}`}>
                            {resent.includes(m.id) ? l.resent : l.resend}
                          </Button>
                          <Button variant="tertiary" size={32} icon="close" iconOnly aria-label={`${l.cancelInvite} for ${m.email}`} onClick={() => drop(m, `Invite to ${m.email} canceled.`)}>
                            {l.cancelInvite}
                          </Button>
                        </>
                      ) : !isOwner && !isYou ? (
                        <Button variant="tertiary" size={32} icon="trash" iconOnly aria-label={`${l.remove} ${m.name}`} onClick={() => setRemoving(m)}>
                          {l.remove}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="fl-tm-status" role="status" aria-live="polite">
        {status ? (
          <>
            <span>{status.text}</span>
            {status.undo ? (
              <Button variant="tertiary" size={32} onClick={status.undo}>
                {l.undo}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {inviting ? (
        <Modal variant="form" title={l.inviteTitle} description={l.inviteText} confirmLabel={l.send} onConfirm={invite} onClose={() => setInviting(false)}>
          <div className="fl-tm-form">
            <div className="fl-tm-field">
              <label htmlFor={`${id}-email`}>{l.email}</label>
              <TextField
                id={`${id}-email`}
                name="email"
                type="email"
                autoComplete="off"
                placeholder="name@company.com"
                data-autofocus
                invalid={Boolean(inviteError)}
                aria-describedby={inviteError ? `${id}-err` : undefined}
                onInput={() => inviteError && setInviteError("")}
              />
              {inviteError ? (
                <p id={`${id}-err`} className="fl-tm-error" role="alert">
                  <Icon name="alert" />
                  {inviteError}
                </p>
              ) : null}
            </div>
            <div className="fl-tm-field">
              <label htmlFor={`${id}-role`}>{l.role}</label>
              <Select id={`${id}-role`} name="role" defaultValue={inviteRole ?? roles.filter((r) => r.value !== ownerRole).at(-1)?.value} options={roles.filter((r) => r.value !== ownerRole)} />
            </div>
          </div>
        </Modal>
      ) : null}

      {removing ? (
        <Modal
          variant="danger"
          icon="trash"
          title={l.removeTitle.replace("{name}", removing.name)}
          description={l.removeText}
          confirmLabel={l.remove}
          onConfirm={() => {
            drop(removing, `${removing.name} was removed.`);
            onRemove?.(removing.id);
          }}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Team members",
  lede: "Manage who can see and edit projects in Northlight.",
  seats: 8,
  ownerRole: "owner",
  you: "u1",
  roles: [
    { value: "owner", label: "Owner" },
    { value: "admin", label: "Admin" },
    { value: "editor", label: "Editor" },
    { value: "viewer", label: "Viewer" },
  ],
  people: [
    { id: "u1", name: "Jordan Hale", email: "jordan@northlight.studio", role: "owner", lastActive: "Now" },
    { id: "u2", name: "Ana Ruiz", email: "ana@northlight.studio", role: "admin", lastActive: "12 min ago" },
    { id: "u3", name: "Marcus Lee", email: "marcus@northlight.studio", role: "editor", lastActive: "2 hours ago" },
    { id: "u4", name: "Priya Shah", email: "priya@northlight.studio", role: "editor", lastActive: "Yesterday" },
    { id: "u5", name: "Tom Becker", email: "tom@clientco.com", role: "viewer", lastActive: "Oct 3" },
    { id: "u6", name: "lena.m", email: "lena.m@northlight.studio", role: "editor", status: "invited" },
  ] as Member[],
};

export default function MembersTableSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <MembersTable {...SAMPLE} />
      </div>
    </section>
  );
}
