/**
 * Per-project actions: rename, edit the latest request, open launch readiness, delete.
 * Deleting asks the user to type the project's name; workspace files are only removed for workspaces FlowCode
 * created itself, and only when the user ticks the box. A folder the user selected is never deleted.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { get, post } from "../api";
import { navigate } from "../router";
import { Icon } from "./ui";

export interface ProjectLike {
  id: string;
  name: string;
  latestRun?: { id: string } | undefined;
}

export function ProjectActions({ project, onChanged }: { project: ProjectLike; onChanged: () => void }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Where the menu opens, in the window: under the button, or above it when there is no room below.
  const [place, setPlace] = useState<{ top?: number; bottom?: number; right: number }>();

  // Right-click menu requests ("Rename project", "Delete project…") for this project.
  useEffect(() => {
    const on = (ev: Event) => {
      const d = (ev as CustomEvent<{ id: string; action: "rename" | "delete" }>).detail;
      if (d.id !== project.id) return;
      if (d.action === "rename") setRenaming(true);
      else setDeleting(true);
    };
    addEventListener("fc:project-action", on);
    return () => removeEventListener("fc:project-action", on);
  }, [project.id]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node) && setMenu(false);
    // The menu is fixed to the window, so scrolling or resizing closes it rather than leaving it behind.
    const away = () => setMenu(false);
    addEventListener("scroll", away, true);
    addEventListener("resize", away);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    addEventListener("mousedown", close);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("mousedown", close);
      removeEventListener("keydown", esc);
      removeEventListener("scroll", away, true);
      removeEventListener("resize", away);
    };
  }, [menu]);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu) return setMenu(false);
    const r = e.currentTarget.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - r.right);
    setPlace(window.innerHeight - r.bottom < 260 && r.top > 260 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
    setMenu(true);
  };

  return (
    <div className="proj-actions" ref={ref}>
      <button className="proj-actions__btn" data-cp="project-menu" aria-label={`Actions for ${project.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={toggle}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {/* Portal to <body>: the cards sit in scrolling panels that would otherwise cut the menu off. */}
      {menu && place ? createPortal(
        <div ref={menuRef} className="ctx-menu proj-actions__menu proj-actions__menu--floating" style={place} role="menu" aria-label={`${project.name} actions`}>
          <div className="ctx-menu__group">
            <button role="menuitem" className="ctx-menu__item" onClick={() => (setMenu(false), setRenaming(true))}>
              <Icon name="edit" size={16} /> Rename
            </button>
            {project.latestRun ? (
              <button role="menuitem" className="ctx-menu__item" onClick={() => (setMenu(false), navigate(`/projects/${project.id}/runs/${project.latestRun!.id}`))}>
                <Icon name="file" size={16} /> Edit request
              </button>
            ) : null}
            <button role="menuitem" className="ctx-menu__item" onClick={() => (setMenu(false), navigate(`/projects/${project.id}/settings`))}>
              <Icon name="settings" size={16} /> Project settings
            </button>
            <button role="menuitem" className="ctx-menu__item" onClick={() => (setMenu(false), navigate(`/journal/${project.id}`))}>
              <Icon name="reports" size={16} /> Project journal
            </button>
            <button role="menuitem" className="ctx-menu__item" onClick={() => (setMenu(false), navigate(`/quality/${project.id}/launch`))}>
              <Icon name="checklist" size={16} /> Launch readiness
            </button>
          </div>
          <div className="ctx-menu__group">
            <button role="menuitem" className="ctx-menu__item ctx-menu__item--danger" onClick={() => (setMenu(false), setDeleting(true))}>
              <Icon name="trash" size={16} /> Delete project…
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
      {renaming ? <RenameDialog project={project} onClose={() => setRenaming(false)} onDone={onChanged} /> : null}
      {deleting ? <DeleteDialog project={project} onClose={() => setDeleting(false)} onDone={onChanged} /> : null}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("keydown", esc);
      prev?.focus?.();
    };
  }, [onClose]);
  // Portal to <body>: animated/transformed ancestors would otherwise trap position: fixed.
  return createPortal(
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog__title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function RenameDialog({ project, onClose, onDone }: { project: ProjectLike; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(project.name);
  const [err, setErr] = useState<string>();
  return (
    <Dialog title="Rename project" onClose={onClose}>
      <form
        className="dialog__body"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await post(`/projects/${project.id}/rename`, { name });
            onDone();
            onClose();
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
      >
        <label className="label" htmlFor="rename-input">
          Name
        </label>
        <input id="rename-input" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        {err ? <p className="notice notice--bad" role="alert">{err}</p> : null}
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!name.trim() || name.trim() === project.name}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ project, onClose, onDone }: { project: ProjectLike; onClose: () => void; onDone: () => void }) {
  const [info, setInfo] = useState<{ managedWorkspace: boolean; runs: number }>();
  // On by default: the box only appears for folders FlowCode created itself, never for a folder you chose.
  const [files, setFiles] = useState(true);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void get<{ managedWorkspace: boolean; runs: number }>(`/projects/${project.id}/admin`).then(setInfo, () => undefined);
  }, [project.id]);
  return (
    <Dialog title={`Delete "${project.name}"?`} onClose={onClose}>
      <form
        className="dialog__body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await post(`/projects/${project.id}/delete`, { confirmName: project.name, deleteFiles: files });
            onDone();
            onClose();
            // Stay on this page (the list refreshes); leave only a page that belonged to the deleted project.
            if (location.hash.includes(project.id)) navigate("/");
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="dim" style={{ margin: 0 }}>
          This removes the project from FlowCode: {info ? `${info.runs} request${info.runs === 1 ? "" : "s"}, ` : ""}their tasks, checks, approvals, history and Launch readiness checklist. It can't be undone.
        </p>
        {info?.managedWorkspace ? (
          <label className="check">
            <input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} /> Also delete the workspace files FlowCode created for this project
          </label>
        ) : (
          <p className="notice" style={{ margin: 0 }}>
            The project's folder is one you chose, so its files stay on disk untouched.
          </p>
        )}
        {err ? <p className="notice notice--bad" role="alert">{err}</p> : null}
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--danger" disabled={busy}>
            {busy ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
