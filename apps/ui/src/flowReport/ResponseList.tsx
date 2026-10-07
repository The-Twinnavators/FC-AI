/**
 * The accounts of what was done about one finding, oldest first. A list rather than one field, because a finding is
 * answered more than once and each account can be revised or removed on its own. Removing the only response on a
 * closed finding reopens it and moves the score, so the confirmation says so first. Where an account came from
 * (typed here, or imported from a document) is kept and shown.
 */
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { FindingResponse } from "./api";

const WHEN: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };

export function ResponseList({ responses, closes, onEdit, onDelete }: { responses: FindingResponse[]; closes: boolean; onEdit?: (id: string, body: string) => Promise<void>; onDelete?: (id: string) => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (responses.length === 0) return null;

  const save = async (id: string) => {
    if (!onEdit || !draft.trim() || busy) return;
    setBusy(true);
    try {
      await onEdit(id, draft.trim());
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!onDelete || busy) return;
    setBusy(true);
    try {
      await onDelete(id);
      setConfirmId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ul className="fr-responses">
      {responses.map((r, i) => (
        <li key={r.id} className="fr-response">
          <div className="fr-response__meta">
            <span>
              {responses.length > 1 ? `${i + 1} of ${responses.length} · ` : ""}
              {new Date(r.createdAt).toLocaleString(undefined, WHEN)}
            </span>
            {r.source === "imported" ? <span>· imported{r.sourceName ? ` from ${r.sourceName}` : ""}</span> : null}
            {r.editedAt ? <span>· revised {new Date(r.editedAt).toLocaleString(undefined, WHEN)}</span> : null}
            <span className="fr-response__tools">
              {onEdit ? (
                <button
                  type="button"
                  className="fr-iconbtn"
                  title="Revise this response"
                  aria-label="Revise this response"
                  onClick={() => {
                    setDraft(r.body);
                    setEditingId(r.id);
                    setConfirmId(null);
                  }}
                >
                  <Pencil size={11} />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className="fr-iconbtn fr-iconbtn--bad"
                  title="Remove this response"
                  aria-label="Remove this response"
                  onClick={() => {
                    setConfirmId(r.id);
                    setEditingId(null);
                  }}
                >
                  <Trash2 size={11} />
                </button>
              ) : null}
            </span>
          </div>

          {editingId === r.id ? (
            <>
              <textarea className="textarea fr-textarea" value={draft} rows={4} onChange={(e) => setDraft(e.target.value)} aria-label="Response" />
              {!draft.trim() ? <p className="fr-req is-bad">A resolution reason is required.</p> : null}
              <div className="fr-row">
                <button type="button" className="fr-okbtn" disabled={!draft.trim() || busy} onClick={() => void save(r.id)}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button type="button" className="fr-link" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <p className="fr-response__body">{r.body}</p>
          )}

          {confirmId === r.id ? (
            <div className="fr-confirm">
              <span>{closes && responses.length === 1 ? "This is the only response. Removing it reopens the finding and puts its score back." : "Remove this response for good?"}</span>
              <button type="button" className="fr-link fr-link--bad" disabled={busy} onClick={() => void remove(r.id)}>
                {busy ? "Removing…" : "Remove"}
              </button>
              <button type="button" className="fr-link" onClick={() => setConfirmId(null)}>
                No
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
