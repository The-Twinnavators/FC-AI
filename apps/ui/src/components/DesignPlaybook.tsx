/**
 * Design playbook (Knowledge Hub): upload your own strategies for custom UX design. FlowCode's agents read the parts
 * that fit each interface step (screens, components, styles), for every project. Documents can be switched off
 * without removing them.
 */
import { useState } from "react";
import { FileText } from "lucide-react";
import { post, useResource } from "../api";
import { Empty, ErrorNotice, ago } from "./ui";
import { SkeletonBlock } from "./motion";
import { KnowledgeUpload } from "./KnowledgeUpload";
import { ConfirmDialog } from "./ConfirmDialog";

interface Doc {
  title: string;
  ids: string[];
  sections: number;
  characters: number;
  active: boolean;
  addedAt: string;
}

export function DesignPlaybook() {
  const { data, error, reload } = useResource<{ docs: Doc[] }>("/design-playbook", []);
  const [busy, setBusy] = useState<string>();
  const [removing, setRemoving] = useState<Doc>();
  const [msg, setMsg] = useState<string>();
  const docs = data?.docs ?? [];
  const act = async (d: Doc, path: string, body: Record<string, unknown>, done: string) => {
    setBusy(d.title);
    try {
      await post(path, body);
      setMsg(done);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  const on = docs.filter((d) => d.active).length;

  return (
    <div className="pbook">
      <div className="pbook__intro">
        <div>
          <h2 className="pbook__title">Design playbook</h2>
          <p className="pbook__lede">
            Your own strategies for custom UX design: layout systems, spacing rules, visual direction, component patterns. On every step that builds screens, components or styles, FlowCode gives the coder the parts of your playbook that fit that step. It applies to every project.
          </p>
        </div>
        <KnowledgeUpload label="Upload to the playbook" tags={["design-playbook"]} onDone={() => reload()} />
      </div>
      <p className="pbook__note">
        FlowCode also has a built-in skill from the design playbook guides (custom modern UX and the rule of 8). Uploaded documents add your own detail on top of it.
      </p>
      {msg ? (
        <p className="notice" role="status">
          {msg}
        </p>
      ) : null}
      {error ? <ErrorNotice error={error} doing="load the design playbook" onRetry={reload} /> : null}
      {!data && !error ? <SkeletonBlock rows={3} label="Loading the design playbook" /> : null}
      {data && !docs.length ? (
        <Empty title="No playbook documents yet" action={<KnowledgeUpload label="Upload a design strategy" tags={["design-playbook"]} onDone={() => reload()} />}>
          Upload a guide you want the agents to design by, such as a layout system, a spacing rule or a brand&apos;s visual direction. PDF, Word, Markdown and text files work.
        </Empty>
      ) : null}
      {docs.length ? (
        <>
          <p className="pbook__count">
            {on} of {docs.length} document{docs.length === 1 ? "" : "s"} in use by the agents
          </p>
          <ul className="pbook__list">
            {docs.map((d) => (
              <li key={d.title} className={`pbook__doc${d.active ? "" : " is-off"}`}>
                <FileText size={18} aria-hidden="true" className="pbook__icon" />
                <div className="pbook__main">
                  <span className="pbook__name">{d.title}</span>
                  <span className="pbook__meta">
                    {d.sections} section{d.sections === 1 ? "" : "s"} · {Math.max(1, Math.round(d.characters / 1000))}k characters · added {ago(d.addedAt)}
                  </span>
                </div>
                <label className="check pbook__toggle">
                  <input
                    type="checkbox"
                    checked={d.active}
                    disabled={busy === d.title}
                    onChange={(e) => void act(d, "/design-playbook/active", { ids: d.ids, active: e.target.checked }, e.target.checked ? `The agents use "${d.title}" again.` : `The agents no longer use "${d.title}". It stays in the playbook.`)}
                  />
                  <span>In use</span>
                </label>
                <button type="button" className="btn btn--sm btn--ghost" disabled={busy === d.title} onClick={() => setRemoving(d)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove "${removing.title}" from the playbook?`}
          confirmLabel="Remove from playbook"
          busy={busy === removing.title}
          onCancel={() => setRemoving(undefined)}
          onConfirm={() => void act(removing, "/design-playbook/remove", { ids: removing.ids }, `Removed "${removing.title}" from the playbook. It is still in the Knowledge Hub as an uploaded document.`).then(() => setRemoving(undefined))}
        >
          The agents stop using it on interface steps. The document stays in the Knowledge Hub, so nothing is lost.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
