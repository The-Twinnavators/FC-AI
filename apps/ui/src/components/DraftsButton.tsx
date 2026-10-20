/**
 * Home's drafts: "You have 2 drafts" opens a list of the builds not started yet, newest first, with when each was last
 * changed, its name and the start of its description. A draft opens where it left off (Look and Feel), or is deleted
 * after a confirmation.
 */
import { useId, useState } from "react";
import { post } from "../api";
import { navigate } from "../router";
import { Modal } from "./Modal";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./ui";

export type Draft = { project: { id: string; name: string }; description: string; productType?: string; updatedAt: string };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function DraftsButton({ drafts, reload }: { drafts: Draft[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Draft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const titleId = useId();
  if (!drafts.length) return null;

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setError(undefined);
    try {
      await post(`/projects/${removing.project.id}/delete`, { deleteFiles: true, confirmName: removing.project.name });
      setRemoving(undefined);
      if (drafts.length === 1) setOpen(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="home__drafts-btn" data-cp="home-drafts" onClick={() => setOpen(true)}>
        <Icon name="write" size={14} />
        You have {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}
      </button>
      {open && !removing ? (
        <Modal onClose={() => setOpen(false)} labelledBy={titleId} className="drafts-dlg">
          <header className="drafts-dlg__head">
            <h2 id={titleId} className="drafts-dlg__title">
              Drafts
            </h2>
            <button type="button" className="drafts-dlg__icon" aria-label="Close" onClick={() => setOpen(false)}>
              <Icon name="x" size={16} />
            </button>
          </header>
          {error ? <p className="drafts-dlg__error" role="alert">{error}</p> : null}
          <ul className="drafts-dlg__list">
            {drafts.map((d) => (
              <li key={d.project.id} className="drafts-dlg__item">
                <button type="button" className="drafts-dlg__open" onClick={() => navigate(`/new/${d.project.id}/look`)}>
                  <time className="drafts-dlg__when" dateTime={d.updatedAt}>
                    {when(d.updatedAt)}
                  </time>
                  <strong className="drafts-dlg__name">{d.project.name.trim() || "Untitled"}</strong>
                  {d.description ? <span className="drafts-dlg__desc">{d.description}</span> : null}
                </button>
                <button type="button" className="drafts-dlg__icon drafts-dlg__del" aria-label={`Delete ${d.project.name || "Untitled"}`} title="Delete" onClick={() => setRemoving(d)}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}
      {removing ? (
        <ConfirmDialog title={`Delete "${removing.project.name.trim() || "Untitled"}"?`} confirmLabel="Delete draft" busy={busy} onConfirm={() => void remove()} onCancel={() => setRemoving(undefined)}>
          The draft, its description and attached files are removed. This can't be undone.
          {error ? <p className="drafts-dlg__error" role="alert">{error}</p> : null}
        </ConfirmDialog>
      ) : null}
    </>
  );
}
