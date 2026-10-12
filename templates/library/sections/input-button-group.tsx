/** @flowcode-library input-button-group · Button groups (Forms)
 * Catalog ID: c.button-group (component)
 * Function: Button groups (c.button-group) as toggle bars and a split button with a menu; the reference sheet is a note editor toolbar with alignment, formatting and save options.
 * Use it as: import { ButtonGroup } from "./input-button-group"; toggle: <ButtonGroup label="Text alignment" items={[{ id, label, icon?, text? }]} value={id | ids[]} multiple? quiet? onChange={(value) => ...} />; split: <ButtonGroup variant="split" label="Save note" onPress={() => ...} menu={[{ id, label }]} onSelect={(id) => ...} moreLabel="More save options" />
 * Variants: c.button-group.toggle - a toolbar choice: joined square buttons that switch on (one at a time for alignment or view, several with multiple for bold and italic), the pressed ones tinted with the accent; c.button-group.split - a save action with options: an accent main button with an arrow half that opens a keyboard-driven menu of other ways to do it
 * Look: Buttons joined into one bordered bar, or an accent main button fused to a chevron that opens a small menu.
 * Tokens: --color-accent --color-accent-hover --color-on-accent --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-focus --control-md --control-lg --control-radius --radius-md --radius-sm --focus-ring
 * Use cases: editor toolbar; text formatting; note editor; view switcher; save options; rich text editor; document editor
 * Jobs to be done: format my text; align my content; save my work in different ways; switch between views
 * Keywords: button group, toolbar, toggle, aria-pressed, split button, menu, formatting
 */
/**
 * Input: button groups. An editor toolbar made of joined buttons: text alignment (one choice at a time), formatting
 * (bold, italic, underline switch on and off independently) and a split button whose main half saves and whose arrow
 * opens a menu of other save options. The sample note below shows the result. Use it for editor toolbars, view
 * switches and "save / save as" actions. Make it the app's own: replace SAMPLE with the real actions and wire each
 * one to what it should do.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// ── c.button-group: joined buttons. toggle: a row where buttons switch on (one at a time, or several). split: a main action with an arrow that opens other actions. ──

export type ButtonGroupItem = {
  id: string;
  /** The button's name for screen readers and its tooltip. */
  label: string;
  /** An icon (<svg>) drawn in the button. */
  icon?: ReactNode;
  /** Short text drawn in the button when there is no icon ("B"). */
  text?: ReactNode;
  className?: string;
};
export type ButtonGroupMenuItem = { id: string; label: string };

type ToggleProps = {
  variant?: "toggle";
  items: ButtonGroupItem[];
  /** Pressed button(s): an id, or an array of ids with `multiple`. */
  value: string | string[];
  onChange: (value: string | string[]) => void;
  /** Several buttons can be on at once (bold, italic); otherwise one at a time (alignment). */
  multiple?: boolean;
  /** Names the group for screen readers. */
  label: string;
  /** No frame: for a toolbar that already has one. */
  quiet?: boolean;
  className?: string;
};
type SplitProps = {
  variant: "split";
  /** The main button's words: "Save note". */
  label: string;
  onPress: () => void;
  /** The other actions behind the arrow. */
  menu: ButtonGroupMenuItem[];
  onSelect: (id: string) => void;
  /** Name of the arrow button and of the menu. */
  moreLabel: string;
  className?: string;
};
export type ButtonGroupProps = ToggleProps | SplitProps;

export function ButtonGroup(props: ButtonGroupProps) {
  return props.variant === "split" ? <SplitGroup {...props} /> : <ToggleGroup {...props} />;
}

function ToggleGroup({ items, value, onChange, multiple, label, quiet, className }: ToggleProps) {
  const on = (id: string) => (Array.isArray(value) ? value.includes(id) : value === id);
  const press = (id: string) => {
    if (!multiple) return onChange(id);
    const list = Array.isArray(value) ? value : [];
    onChange(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  };
  return (
    <div className={["fl-in-bgroup", quiet ? "fl-in-bgroup--quiet" : "", className ?? ""].filter(Boolean).join(" ")} role="group" aria-label={label} data-fl="c.button-group.toggle">
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={on(it.id)} aria-label={it.label} title={it.label} className={it.className} onClick={() => press(it.id)}>
          {it.icon}
          {it.text}
        </button>
      ))}
    </div>
  );
}

function SplitGroup({ label, onPress, menu, onSelect, moreLabel, className }: SplitProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
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

  return (
    <div className={["fl-in-split-wrap", className ?? ""].filter(Boolean).join(" ")} data-fl="c.button-group.split">
      <div className="fl-in-split">
        <button type="button" className="fl-in-split__main" onClick={onPress}>
          {label}
        </button>
        <button
          ref={toggleRef}
          type="button"
          className="fl-in-split__toggle"
          aria-label={moreLabel}
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
        <ul id={`${uid}-menu`} ref={menuRef} className="fl-in-menu" role="menu" aria-label={moreLabel} onKeyDown={onMenuKey}>
          {menu.map((m) => (
            <li key={m.id} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  onSelect(m.id);
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
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Class notes",
  lede: "Format the note, then save it for the group.",
  note: "Bring an apron and an old towel. We start glazing at 7pm sharp, so please arrive ten minutes early.",
  align: [
    { id: "left", label: "Align left" },
    { id: "center", label: "Align center" },
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
  const [fmt, setFmt] = useState<string[]>([]);
  const [text, setText] = useState(d.note);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

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
            <ButtonGroup
              label="Text alignment"
              items={d.align.map((a) => ({ id: a.id, label: a.label, icon: <AlignIcon id={a.id} /> }))}
              value={align}
              onChange={(v) => setAlign(v as Align)}
            />
            <ButtonGroup
              multiple
              label="Text style"
              items={d.format.map((f) => ({ id: f.id, label: f.label, text: f.glyph, className: `fl-in-glyph fl-in-glyph--${f.id}` }))}
              value={fmt}
              onChange={(v) => setFmt(v as string[])}
            />
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
                fontWeight: fmt.includes("bold") ? "var(--weight-bold)" : undefined,
                fontStyle: fmt.includes("italic") ? "italic" : undefined,
                textDecoration: fmt.includes("underline") ? "underline" : undefined,
              }}
            />
            {error && (
              <span id={`${uid}-err`} className="fl-in-error">
                {error}
              </span>
            )}
          </div>

          <ButtonGroup
            variant="split"
            label={d.save}
            moreLabel={d.more}
            menu={d.menu.map((m) => ({ id: m.id, label: m.label }))}
            onPress={() => save(d.saved)}
            onSelect={(id) => save(d.menu.find((m) => m.id === id)?.done ?? d.saved)}
          />
          <p className={status ? "fl-done" : "fl-sr"} role="status">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
