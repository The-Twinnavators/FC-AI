/** @flowcode-library card-project · Project cards (Cards)
 * Catalog ID: p.project-card (pattern)
 * Function: The project card pattern (p.project-card): a workspace grid whose cards rename, delete with confirmation, and open; the reference sheet shows four projects at different stages with an empty state once all are deleted.
 * Use it as: import { ProjectCards } from "./card-project"; <ProjectCards title lede? gaugeA="Ready" gaugeB="Health" projects={[{ id, name, type, status, tone: "success"|"warning"|"danger"|"info"|"neutral", ready: 0-100, health: 0-100, updated: "2026-10-06", alt, image? }]} onView?={(id) => ...} onRename?={(id, name) => ...} onDelete?={(id) => ...} />
 * Built from: c.card.surface, c.media-frame, c.badge.status, c.progress.ring, c.menu, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.destructive, c.empty-state.first-use
 * Look: A responsive grid of project cards, each with a 16:9 picture, a status chip at its top left and a three-dot menu at its top right, the name and type, two small ring gauges with their values, and a footer with the update date and a View button.
 * Tokens: --color-surface --color-border --color-accent --color-success --color-danger --color-danger-surface --color-surface-sunken --color-text-muted --space-3 --space-4 --space-5 --radius-lg --font-display --font-mono --hover-lift
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
import { useRef, useState, type FormEvent } from "react";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { EmptyState } from "./empty-states";
import { MediaFrame } from "./media-frames";
import { Menu } from "./popovers-menus";
import { Progress } from "./progress-indicators";
import { TextField } from "./text-fields-states";

// ── p.project-card: a grid of project cards with a status chip, two gauges, a rename/delete menu and a View button. ──

export type ProjectItem = {
  id: string;
  name: string;
  /** What kind of project: "Home renovation". */
  type: string;
  /** The status words on the picture: "On track". */
  status: string;
  /** The status color: success, warning, danger, info or neutral. */
  tone: BadgeTone;
  /** First gauge, 0 to 100; at 100 the card reads as finished. */
  ready: number;
  /** Second gauge, 0 to 100; 90 and over reads as healthy. */
  health: number;
  /** Last update, as a date: "2026-10-06". */
  updated: string;
  /** Describes the picture (and names it when there is no image). */
  alt: string;
  /** Picture address; a gradient picture shows without one. */
  image?: string;
};

export type ProjectCardsProps = {
  title: string;
  lede?: string;
  /** Names of the two gauges: "Ready" and "Health". */
  gaugeA: string;
  gaugeB: string;
  projects: ProjectItem[];
  /** Called when View is pressed. */
  onView?: (id: string) => void;
  /** Called after a rename or delete is confirmed. */
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
};

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function ProjectCard({ p, gaugeA, gaugeB, names, onRename, onDelete, onView }: { p: ProjectItem; gaugeA: string; gaugeB: string; names: string[]; onRename: (name: string) => void; onDelete: () => void; onView: () => void }) {
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [draft, setDraft] = useState(p.name);
  const [error, setError] = useState("");
  const menuBox = useRef<HTMLDivElement>(null);

  const focusMenu = () => menuBox.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
  const reset = () => {
    setMode("idle");
    setError("");
    setDraft(p.name);
    focusMenu();
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
    focusMenu();
  };

  const done = p.ready === 100;
  const errId = `${p.id}-rename-err`;
  return (
    <li style={{ display: "grid" }}>
      <Card variant="surface" className={`fl-brd-proj${done ? " fl-brd-proj--ready" : ""}`} role="group" aria-labelledby={`${p.id}-name`}>
        <div className="fl-brd-proj__banner">
          <div {...(p.image ? {} : { role: "img", "aria-label": p.alt })}>
            <MediaFrame ratio="16-9" src={p.image} alt={p.alt} />
          </div>
          <Badge look="chip" tone={p.tone} className="fl-brd-proj__status">
            {p.status}
          </Badge>
          <div className="fl-brd-proj__menu" ref={menuBox}>
            <Menu
              iconOnly
              align="end"
              label={`More for ${p.name}`}
              menuLabel={`${p.name} actions`}
              items={[
                { id: "rename", label: "Rename" },
                { id: "delete", label: "Delete…", danger: true },
              ]}
              onSelect={(id) => setMode(id === "rename" ? "rename" : "delete")}
            />
          </div>
        </div>

        {mode === "rename" ? (
          <form className="fl-brd-rename" onSubmit={submit} noValidate onKeyDown={(e) => e.key === "Escape" && reset()}>
            <label className="fl-brd-label" htmlFor={`${p.id}-rename`}>
              Project name
            </label>
            <div className="fl-brd-rename__row">
              <TextField autoFocus onFocus={(e) => e.currentTarget.select()} id={`${p.id}-rename`} value={draft} onChange={(e) => setDraft(e.target.value)} invalid={!!error} aria-describedby={error ? errId : undefined} maxLength={60} />
              <Button type="submit" variant="primary" size={32}>
                Save
              </Button>
              <Button variant="secondary" size={32} onClick={reset}>
                Cancel
              </Button>
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
              <Button variant="destructive" size={32} onClick={onDelete}>
                Delete project
              </Button>
              <Button variant="secondary" size={32} onClick={reset} autoFocus>
                Keep it
              </Button>
            </div>
          </div>
        ) : null}

        <div className="fl-brd-proj__metrics">
          <div className="fl-brd-metric">
            <Progress variant="ring" value={p.ready} tone={done ? "success" : "accent"} label={`${p.name}: ${gaugeA} ${p.ready}%`} />
            <span>
              <span className="fl-brd-label">{gaugeA}</span>
              <span className="fl-brd-metric__val">{p.ready}%</span>
            </span>
          </div>
          <div className="fl-brd-metric">
            <Progress variant="ring" value={p.health} tone={p.health >= 90 ? "success" : "accent"} label={`${p.name}: ${gaugeB} ${p.health} out of 100`} />
            <span>
              <span className="fl-brd-label">{gaugeB}</span>
              <span className="fl-brd-metric__val">{p.health}/100</span>
            </span>
          </div>
        </div>

        <div className="fl-brd-proj__foot">
          <span className="fl-meta">
            Updated <time dateTime={p.updated}>{fmtDate(p.updated)}</time>
          </span>
          <Button variant="primary" size={32} onClick={onView} aria-label={`View ${p.name}`}>
            View
          </Button>
        </div>
      </Card>
    </li>
  );
}

export function ProjectCards({ title, lede, gaugeA, gaugeB, projects: initial, onView, onRename, onDelete }: ProjectCardsProps) {
  const [projects, setProjects] = useState<ProjectItem[]>(initial);
  const [status, setStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  const rename = (id: string, name: string) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
    setStatus(`Renamed to “${name}”.`);
    onRename?.(id, name);
  };
  const remove = (p: ProjectItem) => {
    setProjects((ps) => ps.filter((x) => x.id !== p.id));
    setStatus(`Deleted “${p.name}”.`);
    heading.current?.focus();
    onDelete?.(p.id);
  };

  return (
    <section className="fl-section" aria-labelledby="card-project-title" data-fl="p.project-card">
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id="card-project-title" ref={heading} tabIndex={-1} className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>
        <p className="fl-sr" role="status" aria-live="polite">
          {status}
        </p>
        {projects.length ? (
          <ul className="fl-brd-list fl-brd-projects">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                gaugeA={gaugeA}
                gaugeB={gaugeB}
                names={projects.map((x) => x.name)}
                onRename={(n) => rename(p.id, n)}
                onDelete={() => remove(p)}
                onView={() => {
                  setStatus(`Opening “${p.name}”…`);
                  onView?.(p.id);
                }}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            variant="first-use"
            icon="folder"
            title="No projects yet"
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setProjects(initial);
                  setStatus("Sample projects restored.");
                }}
              >
                Bring back the samples
              </Button>
            }
          >
            Start one and it shows up here with how close it is to ready.
          </EmptyState>
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

// flowcode:sample
const SAMPLE = {
  title: "Your projects",
  lede: "Every space you're planning, with how close it is to ready.",
  gaugeA: "Ready",
  gaugeB: "Health",
  projects: [
    { id: "p1", name: "Kitchen refit", type: "Home renovation", status: "On track", tone: "success", ready: 72, health: 91, updated: "2026-10-06", alt: "Pale oak kitchen with open shelves" },
    { id: "p2", name: "Garden studio", type: "Outbuilding", status: "Waiting on quote", tone: "warning", ready: 38, health: 77, updated: "2026-10-02", alt: "Small timber studio at the end of a lawn" },
    { id: "p3", name: "Spare room to office", type: "Room makeover", status: "Ready", tone: "success", ready: 100, health: 96, updated: "2026-09-28", alt: "Bright desk by a window with a plant" },
    { id: "p4", name: "Bathroom leak", type: "Repair", status: "Blocked", tone: "danger", ready: 15, health: 54, updated: "2026-09-21", alt: "Tiled bathroom with a damp patch on the ceiling" },
  ] as ProjectItem[],
};

export default function CardProject() {
  return <ProjectCards {...SAMPLE} />;
}
