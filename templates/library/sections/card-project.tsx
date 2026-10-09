/** @flowcode-library card-project · Project cards (Cards)
 * Use cases: projects dashboard; project overview; client projects; campaign tracker; course progress; workspace list; portfolio projects
 * Jobs to be done: see how each project is progressing; open a project to work on it; rename or delete a project; spot which projects need attention
 * Keywords: projects, dashboard, gauge, progress, status
 */
/**
 * Project cards: a grid of projects, each with a picture banner, a status chip, two small gauges, the last update and
 * a menu to rename or delete. Good for a workspace home, a client list or any "my things" overview. Make it the app's
 * own: replace SAMPLE with the real projects and the two numbers that matter; "View" should open the project.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Your projects",
  lede: "Every space you're planning, with how close it is to ready.",
  gaugeA: "Ready",
  gaugeB: "Health",
  projects: [
    { id: "p1", name: "Kitchen refit", type: "Home renovation", status: "On track", tone: "ok", ready: 72, health: 91, updated: "2026-10-06", alt: "Pale oak kitchen with open shelves" },
    { id: "p2", name: "Garden studio", type: "Outbuilding", status: "Waiting on quote", tone: "warn", ready: 38, health: 77, updated: "2026-10-02", alt: "Small timber studio at the end of a lawn" },
    { id: "p3", name: "Spare room to office", type: "Room makeover", status: "Ready", tone: "ok", ready: 100, health: 96, updated: "2026-09-28", alt: "Bright desk by a window with a plant" },
    { id: "p4", name: "Bathroom leak", type: "Repair", status: "Blocked", tone: "bad", ready: 15, health: 54, updated: "2026-09-21", alt: "Tiled bathroom with a damp patch on the ceiling" },
  ],
};

type Project = (typeof SAMPLE.projects)[number];

function Gauge({ value, label, ok }: { value: number; label: string; ok: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg className={`fl-brd-gauge${ok ? " fl-brd-gauge--ok" : ""}`} viewBox="0 0 36 36" role="img" aria-label={label}>
      <circle className="fl-brd-gauge__track" cx="18" cy="18" r="15" fill="none" strokeWidth="4" />
      <circle className="fl-brd-gauge__fill" cx="18" cy="18" r="15" fill="none" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${v} 100`} />
    </svg>
  );
}

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function ProjectCard({ p, names, onRename, onDelete, onView }: { p: Project; names: string[]; onRename: (name: string) => void; onDelete: () => void; onView: () => void }) {
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [draft, setDraft] = useState(p.name);
  const [error, setError] = useState("");
  const menuBtn = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cancelDel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menu) firstItem.current?.focus();
  }, [menu]);
  useEffect(() => {
    if (mode === "rename") input.current?.select();
    if (mode === "delete") cancelDel.current?.focus();
  }, [mode]);

  const close = (back = true) => {
    setMenu(false);
    if (back) menuBtn.current?.focus();
  };
  const reset = () => {
    setMode("idle");
    setError("");
    setDraft(p.name);
    menuBtn.current?.focus();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return setError("Give the project a name.");
    if (name.length > 40) return setError("Keep the name to 40 characters or fewer.");
    if (names.some((n) => n.toLowerCase() === name.toLowerCase() && n !== p.name)) return setError("Another project already has that name.");
    setError("");
    setMode("idle");
    onRename(name);
    menuBtn.current?.focus();
  };

  const done = p.ready === 100;
  const errId = `${p.id}-rename-err`;
  return (
    <li className={`fl-brd-proj${done ? " fl-brd-proj--ready" : ""}`} aria-labelledby={`${p.id}-name`}>
      <div className="fl-brd-proj__banner">
        <div className="fl-media" role="img" aria-label={p.alt}>
          <span aria-hidden="true">{p.alt}</span>
        </div>
        <span className={`fl-brd-chip fl-brd-chip--${p.tone} fl-brd-proj__status`}>{p.status}</span>
        <div
          className="fl-brd-proj__menu"
          onKeyDown={(e) => {
            if (e.key === "Escape" && menu) {
              e.stopPropagation();
              close();
            }
          }}
          onBlur={(e) => {
            if (menu && !e.currentTarget.contains(e.relatedTarget as Node | null)) close(false);
          }}
        >
          <button ref={menuBtn} type="button" className="fl-brd-iconbtn" aria-haspopup="menu" aria-expanded={menu} aria-controls={`${p.id}-menu`} aria-label={`More for ${p.name}`} onClick={() => setMenu((m) => !m)}>
            <span aria-hidden="true">⋯</span>
          </button>
          {menu ? (
            <div id={`${p.id}-menu`} className="fl-brd-menu" role="menu" aria-label={`${p.name} actions`}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
                const i = items.indexOf(document.activeElement as HTMLButtonElement);
                items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
              }}
            >
              <button ref={firstItem} type="button" role="menuitem" onClick={() => { close(false); setMode("rename"); }}>
                Rename
              </button>
              <button type="button" role="menuitem" className="fl-brd-menu__danger" onClick={() => { close(false); setMode("delete"); }}>
                Delete…
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {mode === "rename" ? (
        <form className="fl-brd-rename" onSubmit={submit} noValidate onKeyDown={(e) => e.key === "Escape" && reset()}>
          <label className="fl-brd-label" htmlFor={`${p.id}-rename`}>
            Project name
          </label>
          <div className="fl-brd-rename__row">
            <input ref={input} id={`${p.id}-rename`} className="fl-input" value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={!!error} aria-describedby={error ? errId : undefined} maxLength={60} />
            <button type="submit" className="fl-btn fl-btn--primary fl-brd-btn--sm">Save</button>
            <button type="button" className="fl-btn fl-btn--secondary fl-brd-btn--sm" onClick={reset}>Cancel</button>
          </div>
          {error ? <p id={errId} className="fl-brd-error">{error}</p> : null}
        </form>
      ) : (
        <div className="fl-brd-proj__name">
          <h3 id={`${p.id}-name`}>{p.name}</h3>
          <span className="fl-brd-mono">{p.type}</span>
        </div>
      )}

      {mode === "delete" ? (
        <div className="fl-brd-confirm" role="alertdialog" aria-labelledby={`${p.id}-del`} onKeyDown={(e) => e.key === "Escape" && reset()}>
          <p id={`${p.id}-del`}>
            <strong>Delete “{p.name}”?</strong> It's removed from this list.
          </p>
          <div className="fl-actions" style={{ marginTop: 0, gap: "var(--space-2)" }}>
            <button type="button" className="fl-btn fl-brd-btn--danger fl-brd-btn--sm" onClick={onDelete}>Delete project</button>
            <button ref={cancelDel} type="button" className="fl-btn fl-btn--secondary fl-brd-btn--sm" onClick={reset}>Keep it</button>
          </div>
        </div>
      ) : null}

      <div className="fl-brd-proj__metrics">
        <div className="fl-brd-metric">
          <Gauge value={p.ready} ok={done} label={`${p.name}: ${SAMPLE.gaugeA} ${p.ready}%`} />
          <span>
            <span className="fl-brd-label">{SAMPLE.gaugeA}</span>
            <span className="fl-brd-metric__val">{p.ready}%</span>
          </span>
        </div>
        <div className="fl-brd-metric">
          <Gauge value={p.health} ok={p.health >= 90} label={`${p.name}: ${SAMPLE.gaugeB} ${p.health} out of 100`} />
          <span>
            <span className="fl-brd-label">{SAMPLE.gaugeB}</span>
            <span className="fl-brd-metric__val">{p.health}/100</span>
          </span>
        </div>
      </div>

      <div className="fl-brd-proj__foot">
        <span className="fl-meta">
          Updated <time dateTime={p.updated}>{fmtDate(p.updated)}</time>
        </span>
        <button type="button" className="fl-btn fl-btn--primary fl-brd-btn--sm" onClick={onView} aria-label={`View ${p.name}`}>
          View
        </button>
      </div>
    </li>
  );
}

export default function CardProject() {
  const d = SAMPLE;
  const [projects, setProjects] = useState<Project[]>(d.projects);
  const [status, setStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  const rename = (id: string, name: string) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
    setStatus(`Renamed to “${name}”.`);
  };
  const remove = (p: Project) => {
    setProjects((ps) => ps.filter((x) => x.id !== p.id));
    setStatus(`Deleted “${p.name}”.`);
    heading.current?.focus();
  };

  return (
    <section className="fl-section" aria-labelledby="card-project-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id="card-project-title" ref={heading} tabIndex={-1} className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <p className="fl-sr" role="status" aria-live="polite">
          {status}
        </p>
        {projects.length ? (
          <ul className="fl-brd-list fl-brd-projects">
            {projects.map((p) => (
              <ProjectCard key={p.id} p={p} names={projects.map((x) => x.name)} onRename={(n) => rename(p.id, n)} onDelete={() => remove(p)} onView={() => setStatus(`Opening “${p.name}”…`)} />
            ))}
          </ul>
        ) : (
          <div className="fl-brd-empty">
            <strong>No projects yet</strong>
            <p>Start one and it shows up here with how close it is to ready.</p>
            <button type="button" className="fl-btn fl-btn--primary" onClick={() => { setProjects(d.projects); setStatus("Sample projects restored."); }}>
              Bring back the samples
            </button>
          </div>
        )}
        {status && status.startsWith("Opening") ? (
          <p className="fl-note" style={{ marginTop: "var(--space-4)" }} aria-hidden="true">
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
