/** Saves a step's (or a whole build's) changes as a .patch file, to apply in your own repository with git apply (D13). */
import { useState } from "react";
import { get } from "../api";
import { Icon } from "./ui";

export function PatchButton({ runId, taskId, label = "Patch" }: { runId: string; taskId?: string; label?: string }) {
  const [note, setNote] = useState<string>();
  const save = async () => {
    setNote(undefined);
    try {
      const p = await get<{ name: string; patch: string; files: string[]; binary: string[] }>(`/runs/${runId}/patch${taskId ? `?taskId=${taskId}` : ""}`);
      // Images and fonts can't go in a text patch: say which to copy by hand.
      const copy = p.binary.length ? ` Copy these yourself (a patch can't hold images or fonts): ${p.binary.join(", ")}.` : "";
      if (!p.patch.trim()) return setNote(p.binary.length ? `Only images or fonts changed.${copy}` : "No changes left to export: they were undone.");
      const url = URL.createObjectURL(new Blob([p.patch], { type: "text/x-diff" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = p.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setNote(`Saved ${p.name}: ${p.files.length} file${p.files.length === 1 ? "" : "s"}. Apply it with git apply.${copy}`);
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  return (
    <>
      <button type="button" className="btn btn--sm btn--ghost" data-cp="patch" onClick={() => void save()} title="Save these changes as a .patch file to apply in your own repository (git apply)">
        <Icon name="download" size={12} /> {label}
      </button>
      {note ? <span className="muted patch-note" role="status">{note}</span> : null}
    </>
  );
}
