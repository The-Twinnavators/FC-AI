/**
 * App screen: account settings. A top bar, a section nav (Profile, Notifications, Billing, Team) that switches the
 * panel, and forms that know when they have unsaved changes and show Saving / Saved. Profile checks its fields
 * inline; Team invites people by email and removes them; Billing changes plan; and a danger zone deletes the
 * workspace only after its name is typed, with a way to undo. On phones the section nav becomes a scrolling row of
 * tabs. Use it as the settings area of any signed-in app. Make it the app's own: replace SAMPLE with the app's real
 * sections, fields, plans and people, and save through the app's own data layer instead of this screen's memory.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  screen: "Settings",
  person: { initials: "AR", name: "Ada Reyes" },
  sections: [
    { id: "profile", label: "Profile", icon: "users", text: "Your name, studio and how clients see you." },
    { id: "notifications", label: "Notifications", icon: "mail", text: "Choose what we tell you about, and how." },
    { id: "billing", label: "Billing", icon: "layers", text: "Your plan and past invoices." },
    { id: "team", label: "Team", icon: "shield", text: "People who can manage bookings with you." },
  ],
  profile: { name: "Ada Reyes", email: "ada@kilnroom.example", studio: "Kiln Room", bio: "Wheel throwing and hand-building classes for adults, six evenings a week." },
  notifications: [
    { id: "newBooking", label: "New bookings", text: "An email each time someone books a class.", on: true },
    { id: "cancel", label: "Cancellations", text: "An email and a text when a seat is freed.", on: true },
    { id: "digest", label: "Weekly summary", text: "Bookings, income and busy times every Monday.", on: false },
    { id: "tips", label: "Product news", text: "New features, at most once a month.", on: false },
  ],
  plans: [
    { id: "solo", name: "Solo", price: "$12", text: "One teacher, up to 40 bookings a month." },
    { id: "studio", name: "Studio", price: "$29", text: "Up to five teachers, unlimited bookings." },
    { id: "school", name: "School", price: "$59", text: "Unlimited teachers, several locations." },
  ],
  currentPlan: "studio",
  invoices: [
    { id: "INV-1042", date: "1 Oct 2026", amount: "$29.00", status: "Paid" },
    { id: "INV-0987", date: "1 Sep 2026", amount: "$29.00", status: "Paid" },
    { id: "INV-0931", date: "1 Aug 2026", amount: "$29.00", status: "Paid" },
  ],
  team: [
    { email: "ada@kilnroom.example", name: "Ada Reyes", role: "Owner" },
    { email: "sam@kilnroom.example", name: "Sam Ito", role: "Teacher" },
    { email: "rosa@kilnroom.example", name: "Rosa Vidal", role: "Front desk" },
  ],
  roles: ["Teacher", "Front desk", "Admin"],
  danger: {
    title: "Delete this studio",
    text: "This removes the studio, every class, booking and client record. Clients with upcoming bookings get an email. After 30 days it can't be undone.",
    prompt: "Type the studio name to confirm",
    action: "Delete studio",
    done: "Kiln Room is scheduled for deletion on 7 Nov 2026.",
    undo: "Keep the studio",
  },
  saving: "Saving…",
  saved: "Changes saved",
  unsaved: "You have unsaved changes",
};

type Status = "idle" | "saving" | "saved";
type Member = { email: string; name: string; role: string; pending?: boolean };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHEV = "M7 10l5 5 5-5";

function useSave() {
  const [status, setStatus] = useState<Status>("idle");
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  function run(done?: () => void) {
    setStatus("saving");
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      setStatus("saved");
      done?.();
    }, 700);
  }
  return { status, run, reset: () => setStatus("idle") };
}

function SaveBar({ dirty, status, label = "Save changes" }: { dirty: boolean; status: Status; label?: string }) {
  const d = SAMPLE;
  return (
    <div className="fl-as-savebar">
      <span className={`fl-as-savemsg${status === "saved" && !dirty ? " is-saved" : ""}`} role="status">
        {status === "saving" ? d.saving : dirty ? d.unsaved : status === "saved" ? d.saved : ""}
      </span>
      <button type="submit" className="fl-btn fl-btn--primary fl-as-btn-md" disabled={!dirty || status === "saving"}>
        {status === "saving" ? d.saving : label}
      </button>
    </div>
  );
}

export default function AppSettings() {
  const d = SAMPLE;
  const [section, setSection] = useState("profile");
  const heading = useRef<HTMLHeadingElement>(null);

  // Profile
  const [saved, setSaved] = useState(d.profile);
  const [profile, setProfile] = useState(d.profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const profileSave = useSave();
  const profileDirty = JSON.stringify(profile) !== JSON.stringify(saved);

  // Notifications
  const initialNotes = Object.fromEntries(d.notifications.map((n) => [n.id, n.on]));
  const [notesSaved, setNotesSaved] = useState<Record<string, boolean>>(initialNotes);
  const [notes, setNotes] = useState<Record<string, boolean>>(initialNotes);
  const notesSave = useSave();
  const notesDirty = JSON.stringify(notes) !== JSON.stringify(notesSaved);

  // Billing
  const [planSaved, setPlanSaved] = useState(d.currentPlan);
  const [plan, setPlan] = useState(d.currentPlan);
  const planSave = useSave();

  // Team
  const [team, setTeam] = useState<Member[]>(d.team);
  const [invite, setInvite] = useState({ email: "", role: d.roles[0] });
  const [inviteError, setInviteError] = useState("");
  const [teamMsg, setTeamMsg] = useState("");

  // Danger zone
  const [confirmText, setConfirmText] = useState("");
  const [deleted, setDeleted] = useState(false);

  function go(id: string) {
    setSection(id);
    window.setTimeout(() => heading.current?.focus(), 0);
  }

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!profile.name.trim()) next.name = "Enter your name.";
    if (!EMAIL.test(profile.email.trim())) next.email = "Enter an email like name@example.com.";
    if (!profile.studio.trim()) next.studio = "Enter your studio's name.";
    if (profile.bio.length > 160) next.bio = "Keep it to 160 characters.";
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      document.getElementById(`fl-as-st-${first}`)?.focus();
      return;
    }
    profileSave.run(() => setSaved(profile));
  }

  function sendInvite(e: FormEvent) {
    e.preventDefault();
    const email = invite.email.trim().toLowerCase();
    if (!EMAIL.test(email)) return setInviteError("Enter an email like name@example.com.");
    if (team.some((m) => m.email === email)) return setInviteError("That person is already on the team.");
    setInviteError("");
    setTeam((t) => [...t, { email, name: email, role: invite.role, pending: true }]);
    setInvite({ email: "", role: invite.role });
    setTeamMsg(`Invite sent to ${email}.`);
  }

  const sec = d.sections.find((s) => s.id === section)!;
  const field = (id: keyof typeof profile, label: string, type = "text") => (
    <div className="fl-field">
      <label htmlFor={`fl-as-st-${id}`}>{label}</label>
      <input
        id={`fl-as-st-${id}`}
        className="fl-input"
        type={type}
        value={profile[id]}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={errors[id] ? `fl-as-st-${id}-err` : undefined}
        onChange={(e) => {
          setProfile({ ...profile, [id]: e.target.value });
          if (errors[id]) setErrors({ ...errors, [id]: "" });
          profileSave.reset();
        }}
      />
      {errors[id] && (
        <p id={`fl-as-st-${id}-err`} className="fl-as-error">
          {errors[id]}
        </p>
      )}
    </div>
  );

  return (
    <div className="fl-as-app">
      <header className="fl-as-top">
        <div className="fl-as-brand">
          <span className="fl-as-mark" aria-hidden="true">
            {d.mark}
          </span>
          <span className="fl-as-brand__name">{d.product}</span>
        </div>
        <div className="fl-as-top__end">
          <span className="fl-as-avatar" title={d.person.name}>
            <span aria-hidden="true">{d.person.initials}</span>
            <span className="fl-sr">Signed in as {d.person.name}</span>
          </span>
        </div>
      </header>

      <div className="fl-as-settings">
        <nav className="fl-as-secnav" aria-label={d.screen}>
          <h1 className="fl-as-secnav__title">{d.screen}</h1>
          <ul>
            {d.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={section === s.id ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go(s.id);
                  }}
                >
                  <Icon name={s.icon} />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="fl-as-main fl-as-settings__main">
          <div className="fl-as-pagehead">
            <div>
              <h2 ref={heading} tabIndex={-1} className="fl-as-h1">
                {sec.label}
              </h2>
              <p className="fl-text">{sec.text}</p>
            </div>
          </div>

          {section === "profile" && (
            <div className="fl-as-stack">
              <form className="fl-as-panel fl-form" noValidate onSubmit={saveProfile}>
                <div className="fl-as-formgrid">
                  {field("name", "Your name")}
                  {field("email", "Email", "email")}
                  {field("studio", "Studio name")}
                </div>
                <div className="fl-field">
                  <label htmlFor="fl-as-st-bio">Short bio</label>
                  <textarea
                    id="fl-as-st-bio"
                    className="fl-input"
                    rows={3}
                    value={profile.bio}
                    aria-invalid={errors.bio ? true : undefined}
                    aria-describedby={`fl-as-st-bio-hint${errors.bio ? " fl-as-st-bio-err" : ""}`}
                    onChange={(e) => {
                      setProfile({ ...profile, bio: e.target.value });
                      if (errors.bio) setErrors({ ...errors, bio: "" });
                      profileSave.reset();
                    }}
                  />
                  <span id="fl-as-st-bio-hint" className="fl-note">
                    {profile.bio.length} of 160 characters. Shown on your booking page.
                  </span>
                  {errors.bio && (
                    <p id="fl-as-st-bio-err" className="fl-as-error">
                      {errors.bio}
                    </p>
                  )}
                </div>
                <SaveBar dirty={profileDirty} status={profileSave.status} />
              </form>

              <section className="fl-as-panel fl-as-danger" aria-labelledby="fl-as-st-danger">
                <h3 id="fl-as-st-danger" className="fl-as-h2">
                  {d.danger.title}
                </h3>
                {deleted ? (
                  <div className="fl-as-stack" role="status">
                    <p className="fl-as-danger__done">{d.danger.done}</p>
                    <button
                      type="button"
                      className="fl-btn fl-btn--secondary fl-as-btn-md"
                      onClick={() => {
                        setDeleted(false);
                        setConfirmText("");
                      }}
                    >
                      {d.danger.undo}
                    </button>
                  </div>
                ) : (
                  <form
                    className="fl-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (confirmText === saved.studio) setDeleted(true);
                    }}
                  >
                    <p className="fl-text">{d.danger.text}</p>
                    <div className="fl-field">
                      <label htmlFor="fl-as-st-confirm">
                        {d.danger.prompt}: <strong>{saved.studio}</strong>
                      </label>
                      <input id="fl-as-st-confirm" className="fl-input" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-describedby="fl-as-st-confirm-hint" />
                      <span id="fl-as-st-confirm-hint" className="fl-note">
                        {confirmText && confirmText !== saved.studio ? "That doesn't match the studio name yet." : "The button unlocks when the name matches exactly."}
                      </span>
                    </div>
                    <div>
                      <button type="submit" className="fl-as-btn fl-as-btn--danger" disabled={confirmText !== saved.studio}>
                        {d.danger.action}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          )}

          {section === "notifications" && (
            <form
              className="fl-as-panel fl-form"
              onSubmit={(e) => {
                e.preventDefault();
                notesSave.run(() => setNotesSaved(notes));
              }}
            >
              <fieldset className="fl-as-fieldset">
                <legend className="fl-sr">Email and text notifications</legend>
                {d.notifications.map((n) => (
                  <div key={n.id} className="fl-as-switchrow">
                    <div>
                      <span id={`fl-as-st-n-${n.id}`} className="fl-as-switchrow__label">
                        {n.label}
                      </span>
                      <span id={`fl-as-st-n-${n.id}-t`} className="fl-meta">
                        {n.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      className="fl-as-switch"
                      aria-checked={notes[n.id]}
                      aria-labelledby={`fl-as-st-n-${n.id}`}
                      aria-describedby={`fl-as-st-n-${n.id}-t`}
                      onClick={() => {
                        setNotes({ ...notes, [n.id]: !notes[n.id] });
                        notesSave.reset();
                      }}
                    />
                  </div>
                ))}
              </fieldset>
              <SaveBar dirty={notesDirty} status={notesSave.status} />
            </form>
          )}

          {section === "billing" && (
            <div className="fl-as-stack">
              <form
                className="fl-as-panel fl-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  planSave.run(() => setPlanSaved(plan));
                }}
              >
                <fieldset className="fl-as-fieldset">
                  <legend className="fl-as-h2">Plan</legend>
                  <div className="fl-as-plans">
                    {d.plans.map((p) => (
                      <label key={p.id} className="fl-as-plan">
                        <input
                          type="radio"
                          name="fl-as-st-plan"
                          value={p.id}
                          checked={plan === p.id}
                          onChange={() => {
                            setPlan(p.id);
                            planSave.reset();
                          }}
                        />
                        <span className="fl-as-plan__body">
                          <span className="fl-as-plan__row">
                            <strong>{p.name}</strong>
                            {planSaved === p.id && <span className="fl-badge">Current</span>}
                          </span>
                          <span className="fl-as-plan__price">
                            {p.price}
                            <span className="fl-meta"> / month</span>
                          </span>
                          <span className="fl-meta">{p.text}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SaveBar dirty={plan !== planSaved} status={planSave.status} label="Change plan" />
              </form>
              <section className="fl-as-panel" aria-labelledby="fl-as-st-inv">
                <h3 id="fl-as-st-inv" className="fl-as-h2">
                  Invoices
                </h3>
                <div className="fl-as-scroll">
                  <table className="fl-as-tbl">
                    <thead>
                      <tr>
                        <th scope="col">Invoice</th>
                        <th scope="col">Date</th>
                        <th scope="col" className="fl-as-num">
                          Amount
                        </th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.invoices.map((i) => (
                        <tr key={i.id}>
                          <th scope="row">{i.id}</th>
                          <td>{i.date}</td>
                          <td className="fl-as-num">{i.amount}</td>
                          <td>
                            <span className="fl-as-status fl-as-status--closed">{i.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {section === "team" && (
            <div className="fl-as-stack">
              <form className="fl-as-panel fl-form" noValidate onSubmit={sendInvite}>
                <h3 className="fl-as-h2">Invite someone</h3>
                <div className="fl-as-invite">
                  <div className="fl-field">
                    <label htmlFor="fl-as-st-invite">Email</label>
                    <input
                      id="fl-as-st-invite"
                      className="fl-input"
                      type="email"
                      placeholder="name@example.com"
                      value={invite.email}
                      aria-invalid={inviteError ? true : undefined}
                      aria-describedby={inviteError ? "fl-as-st-invite-err" : undefined}
                      onChange={(e) => {
                        setInvite({ ...invite, email: e.target.value });
                        setInviteError("");
                        setTeamMsg("");
                      }}
                    />
                  </div>
                  <div className="fl-field">
                    <label htmlFor="fl-as-st-role">Role</label>
                    <span className="fl-as-select">
                      <select id="fl-as-st-role" className="fl-input" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                        {d.roles.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={CHEV} />
                      </svg>
                    </span>
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary fl-as-btn-md">
                    Send invite
                  </button>
                </div>
                {inviteError && (
                  <p id="fl-as-st-invite-err" className="fl-as-error">
                    {inviteError}
                  </p>
                )}
                <p className="fl-as-okmsg" role="status">
                  {teamMsg}
                </p>
              </form>
              <section className="fl-as-panel" aria-labelledby="fl-as-st-members">
                <h3 id="fl-as-st-members" className="fl-as-h2">
                  Members ({team.length})
                </h3>
                <ul className="fl-as-members">
                  {team.map((m) => (
                    <li key={m.email}>
                      <span className="fl-as-avatar fl-as-avatar--sm" aria-hidden="true">
                        {m.pending ? m.email[0].toUpperCase() : m.name.split(" ").map((w) => w[0]).join("")}
                      </span>
                      <span className="fl-as-members__who">
                        <strong>{m.pending ? m.email : m.name}</strong>
                        <span className="fl-meta">{m.pending ? "Invite sent, not joined yet" : m.email}</span>
                      </span>
                      <span className="fl-badge">{m.role}</span>
                      {m.role !== "Owner" && (
                        <button
                          type="button"
                          className="fl-as-btn fl-as-btn--quiet"
                          onClick={() => {
                            setTeam((t) => t.filter((x) => x.email !== m.email));
                            setTeamMsg(`${m.name} removed from the team.`);
                          }}
                        >
                          Remove<span className="fl-sr"> {m.name}</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
