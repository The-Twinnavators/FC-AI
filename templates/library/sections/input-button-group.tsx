/**
 * Input: button groups. An editor toolbar made of joined buttons: text alignment (one choice at a time), formatting
 * (bold, italic, underline switch on and off independently) and a split button whose main half saves and whose arrow
 * opens a menu of other save options. The sample note below shows the result. Use it for editor toolbars, view
 * switches and "save / save as" actions. Make it the app's own: replace SAMPLE with the real actions and wire each
 * one to what it should do.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Class notes",
  lede: "Format the note, then save it for the group.",
  note: "Bring an apron and an old towel. We start glazing at 7pm sharp, so please arrive ten minutes early.",
  align: [
    { id: "left", label: "Align left" },
    { id: "center", label: "Align centre" },
    { id: "right", label: "Align right" },
  ],
  format: [
    { id: "bold", label: "Bold", glyph: "B" },
    { id: "italic", label: "Italic", glyph: "I" },
    { id: "underline", label: "Underline", glyph: "U" },
  ],
  save: "Save note",
  more: "More save options",
  menu: [
    { id: "draft", label: "Save as draft", done: "Saved as a draft. Only you can see it." },
    { id: "schedule", label: "Schedule for tomorrow 9am", done: "Scheduled. The group sees it tomorrow at 9am." },
    { id: "copy", label: "Save a copy", done: "A copy was saved next to the original." },
  ],
  saved: "Saved and shared with the group.",
  emptyNote: "Write something before saving.",
};

type Align = "left" | "center" | "right";

function AlignIcon({ id }: { id: string }) {
  const lines = id === "left" ? ["M4 6h16", "M4 10h10", "M4 14h16", "M4 18h10"] : id === "center" ? ["M4 6h16", "M7 10h10", "M4 14h16", "M7 18h10"] : ["M4 6h16", "M10 10h10", "M4 14h16", "M10 18h10"];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      {lines.map((l) => (
        <path key={l} d={l} />
      ))}
    </svg>
  );
}

export default function InputButtonGroup() {
  const d = SAMPLE;
  const uid = useId();
  const [align, setAlign] = useState<Align>("left");
  const [fmt, setFmt] = useState<Record<string, boolean>>({ bold: false, italic: false, underline: false });
  const [text, setText] = useState(d.note);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !toggleRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  function onMenuKey(e: KeyboardEvent<HTMLUListElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      closeMenu();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  function save(message: string) {
    if (!text.trim()) {
      setError(d.emptyNote);
      setStatus("");
      return;
    }
    setError("");
    setStatus(message);
  }

  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-card fl-in-panel">
          <div className="fl-in-toolbar" role="toolbar" aria-label="Note formatting" aria-controls={`${uid}-note`}>
            <div className="fl-in-bgroup" role="group" aria-label="Text alignment">
              {d.align.map((a) => (
                <button key={a.id} type="button" aria-pressed={align === a.id} aria-label={a.label} title={a.label} onClick={() => setAlign(a.id as Align)}>
                  <AlignIcon id={a.id} />
                </button>
              ))}
            </div>
            <div className="fl-in-bgroup" role="group" aria-label="Text style">
              {d.format.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={!!fmt[f.id]}
                  aria-label={f.label}
                  title={f.label}
                  className={`fl-in-glyph fl-in-glyph--${f.id}`}
                  onClick={() => setFmt((m) => ({ ...m, [f.id]: !m[f.id] }))}
                >
                  {f.glyph}
                </button>
              ))}
            </div>
          </div>

          <div className="fl-field">
            <label htmlFor={`${uid}-note`}>Note for the group</label>
            <textarea
              id={`${uid}-note`}
              className="fl-input fl-in-note"
              value={text}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${uid}-err` : undefined}
              onChange={(e) => {
                setText(e.target.value);
                setStatus("");
              }}
              style={{
                textAlign: align,
                fontWeight: fmt.bold ? "var(--weight-bold)" : undefined,
                fontStyle: fmt.italic ? "italic" : undefined,
                textDecoration: fmt.underline ? "underline" : undefined,
              }}
            />
            {error && (
              <span id={`${uid}-err`} className="fl-in-error">
                {error}
              </span>
            )}
          </div>

          <div className="fl-in-split-wrap">
            <div className="fl-in-split">
              <button type="button" className="fl-in-split__main" onClick={() => save(d.saved)}>
                {d.save}
              </button>
              <button
                ref={toggleRef}
                type="button"
                className="fl-in-split__toggle"
                aria-label={d.more}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={`${uid}-menu`}
                onClick={() => setOpen((o) => !o)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && !open) {
                    e.preventDefault();
                    setOpen(true);
                  }
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
            {open && (
              <ul id={`${uid}-menu`} ref={menuRef} className="fl-in-menu" role="menu" aria-label={d.more} onKeyDown={onMenuKey}>
                {d.menu.map((m) => (
                  <li key={m.id} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => {
                        save(m.done);
                        closeMenu();
                      }}
                    >
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className={status ? "fl-done" : "fl-sr"} role="status">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
