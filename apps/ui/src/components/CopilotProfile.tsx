/**
 * Settings → Copilot · About you: how the Copilot addresses the user, and any number of short notes about them (who
 * they are, goals, projects, preferences…). Each note is sorted into a category automatically so the Copilot can pick
 * the ones that matter for each message. Everything stays on this machine.
 */
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { post, useResource } from "../api";
import { ConfirmButton } from "./ConfirmButton";
import { ago } from "./ui";
import { UserAvatar, avatarFromFile } from "./UserAvatar";

const CATEGORIES = ["Identity", "Goals", "Work & projects", "Preferences", "Skills & tools", "Personal", "Other"] as const;
type Category = (typeof CATEGORIES)[number];
interface Entry {
  id: string;
  text: string;
  category: Category;
  updatedAt: string;
}
interface Profile {
  address: string;
  entries: Entry[];
  avatar?: string;
}

const HINTS: Record<Category, string> = {
  Identity: "Who you are and your role",
  Goals: "What you want to achieve",
  "Work & projects": "What you're working on",
  Preferences: "How you like things done and answered",
  "Skills & tools": "What you know and use",
  Personal: "Life outside work",
  Other: "Anything else",
};

// Starter questions: each opens a note in its category with a first few words to finish.
const STARTERS: Array<{ category: Category; question: string; prefix: string }> = [
  { category: "Identity", question: "Who are you?", prefix: "I am " },
  { category: "Goals", question: "What do you want to achieve?", prefix: "My goal is to " },
  { category: "Work & projects", question: "What are you working on?", prefix: "I'm working on " },
  { category: "Preferences", question: "How should answers be written?", prefix: "I prefer " },
  { category: "Skills & tools", question: "What do you know or use?", prefix: "I use " },
  { category: "Personal", question: "Anything personal to keep in mind?", prefix: "" },
];

export function CopilotProfile() {
  const res = useResource<Profile>("/copilot/profile");
  const [address, setAddress] = useState("");
  const [draft, setDraft] = useState("");
  const [fileUnder, setFileUnder] = useState<Category | "auto">("auto");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [picError, setPicError] = useState<string>();
  const setPicture = async (file?: File | null) => {
    setPicError(undefined);
    try {
      const image = file ? await avatarFromFile(file) : null;
      await post("/copilot/avatar", { image });
      setNote(file ? "Picture updated." : "Picture removed.");
      res.reload();
    } catch (e) {
      setPicError((e as Error).message);
    }
  };
  useEffect(() => {
    if (res.data) setAddress(res.data.address);
  }, [res.data]);

  const entries = res.data?.entries ?? [];
  const groups = CATEGORIES.map((c) => ({ c, list: entries.filter((e) => e.category === c) })).filter((g) => g.list.length);

  const saveAddress = async () => {
    await post("/copilot/profile", { address });
    setNote(address.trim() ? `The Copilot will call you “${address.trim()}”.` : "The Copilot won't use a form of address.");
    res.reload();
  };
  const add = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const e = await post<Entry>("/copilot/context", { text: draft, ...(fileUnder === "auto" ? {} : { category: fileUnder }) });
      setDraft("");
      setFileUnder("auto");
      setNote(`Saved under ${e.category}.`);
      res.reload();
    } finally {
      setBusy(false);
    }
  };
  const start = (s: (typeof STARTERS)[number]) => {
    setFileUnder(s.category);
    setDraft((d) => (!d.trim() || STARTERS.some((x) => x.prefix && d === x.prefix) ? s.prefix : d));
    requestAnimationFrame(() => {
      const el = box.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  return (
    <section className="section" id="copilot-profile" aria-labelledby="copilot-profile-title">
      <div className="section__head">
        <h2 className="section__title" id="copilot-profile-title">
          Copilot · About you
        </h2>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
          Stays on this computer
        </span>
      </div>
      <div className="section__body cpp">
        <div className="cpp__me">
          <UserAvatar src={res.data?.avatar} size={64} label={res.data?.avatar ? "Your picture" : "Default picture: a pyramid"} />
          <div className="cpp__me-text">
            <p className="cpp__intro">Tell the Copilot about yourself so its answers fit you. Add short notes, one idea each. It reads the ones that matter for each question.</p>
            <div className="cpp__pic-actions">
              <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => (void setPicture(e.target.files?.[0]), (e.target.value = ""))} />
              <button type="button" className="btn btn--sm" data-cp="about-picture" onClick={() => picker.current?.click()}>
                {res.data?.avatar ? "Change picture" : "Add a picture"}
              </button>
              {res.data?.avatar ? (
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => void setPicture(null)}>
                  Remove
                </button>
              ) : null}
              {picError ? (
                <span role="alert" className="cpp__pic-error">
                  {picError}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <form
          className="cpp__address"
          onSubmit={(e) => {
            e.preventDefault();
            void saveAddress();
          }}
        >
          <label className="label" htmlFor="cp-address">
            What it calls you
          </label>
          <input id="cp-address" data-cp="about-name" className="input" value={address} maxLength={40} onChange={(e) => setAddress(e.target.value)} placeholder="Your name" />
          <button className="btn" type="submit" data-cp="about-name-save" disabled={!res.data || address === res.data.address}>
            Save
          </button>
        </form>

        <div className="cpp__new">
          <span className="cpp__new-title" id="cp-start">
            Add a note
          </span>
          <div className="cpp__starters" data-cp="about-starters" role="group" aria-labelledby="cp-start">
            {STARTERS.map((s) => (
              <button key={s.category} type="button" className={`cpp__starter${fileUnder === s.category ? " is-on" : ""}`} onClick={() => start(s)}>
                {s.question}
              </button>
            ))}
          </div>
          <form
            className="cpp__add"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <label className="sr-only" htmlFor="cp-new">
              Note about you
            </label>
            <textarea
              id="cp-new"
              data-cp="about-note"
              ref={box}
              className="textarea"
              rows={2}
              maxLength={4000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void add();
              }}
              placeholder="Pick a question above, or write anything, e.g. “I'm a product designer building tools for small businesses.”"
            />
            <div className="cpp__add-row">
              <label className="cpp__file">
                <span>File under</span>
                <select className="select" value={fileUnder} onChange={(e) => setFileUnder(e.target.value as Category | "auto")}>
                  <option value="auto">Sort it for me</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <span className="muted cpp__keys">Ctrl+Enter saves</span>
              <button className="btn btn--primary btn--sm" type="submit" data-cp="about-note-add" disabled={busy || !draft.trim()}>
                <Plus size={14} aria-hidden="true" /> {busy ? "Saving…" : "Save note"}
              </button>
            </div>
          </form>
        </div>

        {note ? (
          <p className="cpp__status" role="status">
            {note}
          </p>
        ) : null}

        {groups.length ? (
          <div className="cpp__groups">
            {groups.map((g) => (
              <section key={g.c} className="cpp__group" aria-labelledby={`cpg-${g.c}`}>
                <h3 className="cpp__group-title" id={`cpg-${g.c}`}>
                  {g.c} <span className="muted">{g.list.length}</span>
                  <span className="cpp__group-hint">{HINTS[g.c]}</span>
                </h3>
                <ul className="cpp__list">
                  {g.list.map((e) => (
                    <EntryRow key={e.id} entry={e} onChanged={res.reload} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="cpp__empty">No notes yet. Start with &ldquo;Who are you?&rdquo; above. A few notes are enough: who you are, what you&apos;re building, and how you like answers.</p>
        )}
      </div>
    </section>
  );
}

function EntryRow({ entry, onChanged }: { entry: Entry; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const save = async (patch: { text?: string; category?: Category }) => {
    await post(`/copilot/context/${entry.id}`, patch);
    setEditing(false);
    onChanged();
  };
  return (
    <li className="cpp__item">
      {editing ? (
        <form
          className="cpp__edit"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ text });
          }}
        >
          <textarea className="textarea" rows={3} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} aria-label="Edit note" autoFocus />
          <div className="cpp__edit-row">
            <button className="btn btn--sm btn--primary" type="submit" disabled={!text.trim()}>
              Save
            </button>
            <button className="btn btn--sm" type="button" onClick={() => (setEditing(false), setText(entry.text))}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="cpp__text">{entry.text}</p>
      )}
      {editing ? null : (
        <div className="cpp__actions">
          <span className="muted cpp__time">{ago(entry.updatedAt)}</span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(true)}>
            <Pencil size={13} aria-hidden="true" /> Edit
          </button>
          <label className="cpp__move">
            <span className="sr-only">Move to category</span>
            <select className="select" value={entry.category} onChange={(e) => void save({ category: e.target.value as Category })} title="Move to another category">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  Move to {c}
                </option>
              ))}
            </select>
          </label>
          <ConfirmButton className="btn btn--sm btn--ghost" question="Delete this note?" confirmLabel="Delete" cancelLabel="Keep it" onConfirm={() => post(`/copilot/context/${entry.id}/delete`).then(onChanged)}>
            <Trash2 size={13} aria-hidden="true" /> Delete
          </ConfirmButton>
        </div>
      )}
    </li>
  );
}
