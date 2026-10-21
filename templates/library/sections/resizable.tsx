/** @flowcode-library resizable · Resizable panes (Small components)
 * Catalog ID: c.split-panes (component)
 * Function: Split panes side by side or stacked, with handles that drag, move with the arrow keys (aria-valuenow), collapse with Enter and reset with a double-click, shown on a three-pane inbox with a stacked reply box.
 * Use it as: import { SplitPanes } from "./resizable"; <SplitPanes label="Inbox layout" orientation?="horizontal"|"vertical" step?={2} panes={[{ id, label, size: 25, min?: 15, max?: 40, collapsible?, content }]} onResize?={(sizes) => ...} />  // sizes in percent; give the group a height when vertical; remount with a new key to reset
 * Look: Panes divided by a hairline; pointing at or tabbing to a line thickens it into an accent bar with a small grip, the cursor turns into a resize arrow, and panes glide to their new size when moved from the keyboard.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-text --color-text-muted --radius-sm --radius-lg --space-1 --space-2 --space-3 --space-4 --text-xs --text-sm --duration-fast --duration-base --ease-out --focus-ring
 * Use cases: mail client; file manager; code editor with a preview; admin list and detail; chat with a side panel; dashboard layout; documentation with a live example
 * Jobs to be done: give more room to what i'm reading; hide a side panel i don't need; see the list and the detail at once; put the layout back the way it was
 * Keywords: resizable, split view, splitter, panels, drag to resize, window splitter
 */
/**
 * Split panes: the WAI-ARIA window splitter. Each handle is a focusable role="separator" whose value is the size of the
 * pane before it (aria-valuenow, -min, -max, a spoken "Folders 22%"). Drag it with a mouse, finger or pen; or Tab to it
 * and use the arrow keys (Left and Right side by side, Up and Down stacked; Shift moves five times as far), Home and End
 * for the smallest and largest size, Enter to collapse the pane and Enter again to bring it back. A double-click puts
 * the pair back to their first sizes. Collapsible panes snap shut when dragged under half their minimum, and a closed
 * pane is inert so Tab skips what's in it. Keyboard moves glide; drags follow the pointer with no lag.
 * Make it the app's own: replace SAMPLE with the app's panes and their first sizes and limits; save sizes from onResize
 * if the layout should survive a reload.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its resizable panel group, panel and handle, rewritten
 * without its dependencies.
 */
/**
 * How to try it
 * - Drag the line between Folders and Messages; drag it far left and Folders snaps shut.
 * - Tab to a line, press Left or Right (Shift for bigger steps), Home or End; Enter collapses, Enter again restores.
 * - Pick a message: it opens in the reading pane, whose reply box is a stacked pair of its own.
 * - Double-click a line, or press Reset layout, to put the sizes back.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's own Button and Badge, and its inline icon set
 * ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample data
 * is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── c.split-panes: panes in percents, a separator between each pair. ──

export type SplitPane = {
  id: string;
  /** Names the pane and its handle for screen readers ("Resize Folders"). */
  label: string;
  /** First size, in percent; the sizes are scaled to add up to 100. */
  size: number;
  min?: number;
  max?: number;
  /** May close to nothing (by Enter, or by dragging under half its minimum). */
  collapsible?: boolean;
  content: ReactNode;
};

const norm = (list: number[]) => {
  const total = list.reduce((a, v) => a + v, 0) || 1;
  return list.map((v) => (v / total) * 100);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function SplitPanes({ panes, orientation = "horizontal", label, step = 2, onResize, className }: {
  panes: SplitPane[];
  orientation?: "horizontal" | "vertical";
  label: string;
  /** Percent per arrow key press; Shift moves five steps. */
  step?: number;
  onResize?: (sizes: number[]) => void;
  className?: string;
}) {
  const uid = useId();
  const box = useRef<HTMLDivElement>(null);
  const first = useRef(norm(panes.map((p) => p.size)));
  const [sizes, setSizes] = useState(first.current);
  const [drag, setDrag] = useState<number | null>(null);
  const stash = useRef<Record<number, number>>({});
  const start = useRef<{ pos: number; sizes: number[]; span: number }>({ pos: 0, sizes: [], span: 1 });
  const across = orientation === "horizontal";

  useEffect(() => {
    onResize?.(sizes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizes]);

  /** The range the pane before separator i can take, given its neighbor's limits. */
  const range = (i: number, from = sizes) => {
    const a = panes[i]!;
    const b = panes[i + 1]!;
    const pair = from[i]! + from[i + 1]!;
    const lo = Math.max(a.collapsible ? 0 : a.min ?? 0, pair - (b.max ?? 100));
    const hi = Math.min(a.max ?? 100, pair - (b.min ?? 0));
    return { lo, hi, pair, min: a.min ?? 0 };
  };
  /** Gives the pane before separator i the size `want`, taking it from (or giving it to) the pane after. */
  const setPair = (i: number, want: number, from = sizes, snap = false) => {
    const { lo, hi, pair, min } = range(i, from);
    let a = clamp(want, lo, hi);
    if (panes[i]!.collapsible && a < min) a = snap && want < min / 2 ? 0 : a === 0 ? 0 : Math.max(min, lo);
    // The pane after can collapse too, from the other side.
    let b = pair - a;
    const nb = panes[i + 1]!;
    if (nb.collapsible && b < (nb.min ?? 0)) {
      b = snap && b < (nb.min ?? 0) / 2 ? 0 : nb.min ?? 0;
      a = pair - b;
    }
    const next = [...from];
    next[i] = a;
    next[i + 1] = b;
    setSizes(next);
  };

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>, i: number) => {
    const less = across ? "ArrowLeft" : "ArrowUp";
    const more = across ? "ArrowRight" : "ArrowDown";
    const s = step * (e.shiftKey ? 5 : 1);
    const a = sizes[i]!;
    const { lo, hi } = range(i);
    let handled = true;
    if (e.key === less) setPair(i, a - s);
    else if (e.key === more) setPair(i, a + s);
    else if (e.key === "Home") setPair(i, lo);
    else if (e.key === "End") setPair(i, hi);
    else if (e.key === "Enter") {
      if (a > lo + 0.5) {
        stash.current[i] = a;
        setPair(i, lo);
      } else setPair(i, stash.current[i] ?? first.current[i]!);
    } else handled = false;
    if (handled) e.preventDefault();
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>, i: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = box.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    const r = el.getBoundingClientRect();
    const handles = el.querySelectorAll(":scope > [role='separator']");
    const hsize = handles[0] ? (across ? (handles[0] as HTMLElement).offsetWidth : (handles[0] as HTMLElement).offsetHeight) : 0;
    start.current = { pos: across ? e.clientX : e.clientY, sizes, span: Math.max(1, (across ? r.width : r.height) - hsize * handles.length) };
    setDrag(i);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>, i: number) => {
    if (drag !== i) return;
    const st = start.current;
    const delta = (((across ? e.clientX : e.clientY) - st.pos) / st.span) * 100;
    setPair(i, st.sizes[i]! + delta, st.sizes, true);
  };

  const track = sizes.map((s, i) => `minmax(0, ${s.toFixed(3)}fr)${i < sizes.length - 1 ? " var(--fl-split-handle, 9px)" : ""}`).join(" ");

  return (
    <div
      ref={box}
      role="group"
      aria-label={label}
      className={["fl-split-group", across ? "fl-split-group--across" : "fl-split-group--stacked", drag !== null ? "is-dragging" : "", className].filter(Boolean).join(" ")}
      style={across ? { gridTemplateColumns: track } : { gridTemplateRows: track }}
      data-fl="c.split-panes"
    >
      {panes.map((p, i) => {
        const shut = sizes[i]! < 0.5;
        const r = i < panes.length - 1 ? range(i) : null;
        return (
          <Fragment key={p.id}>
            <div id={`${uid}-${p.id}`} className={["fl-split-pane", shut ? "is-shut" : ""].filter(Boolean).join(" ")} inert={shut} aria-hidden={shut || undefined}>
              {p.content}
            </div>
            {r ? (
              <div
                role="separator"
                tabIndex={0}
                aria-orientation={across ? "vertical" : "horizontal"}
                aria-label={`Resize ${p.label}`}
                aria-controls={`${uid}-${p.id}`}
                aria-valuenow={Math.round(sizes[i]!)}
                aria-valuemin={Math.round(r.lo)}
                aria-valuemax={Math.round(r.hi)}
                aria-valuetext={shut ? `${p.label} closed` : `${p.label} ${Math.round(sizes[i]!)}%`}
                className={["fl-split-handle", drag === i ? "is-active" : ""].filter(Boolean).join(" ")}
                onKeyDown={(e) => onKey(e, i)}
                onPointerDown={(e) => onDown(e, i)}
                onPointerMove={(e) => onMove(e, i)}
                onPointerUp={() => setDrag(null)}
                onPointerCancel={() => setDrag(null)}
                onLostPointerCapture={() => setDrag(null)}
                onDoubleClick={() => setPair(i, first.current[i]!, (() => {
                  const next = [...sizes];
                  const pair = sizes[i]! + sizes[i + 1]!;
                  const want = first.current[i]! + first.current[i + 1]!;
                  next[i] = (first.current[i]! / want) * pair;
                  next[i + 1] = pair - next[i]!;
                  return next;
                })())}
              >
                <span className="fl-split-grip" aria-hidden="true" />
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── The reference sheet: an inbox in three panes, the reading pane split again into the message and a reply. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Layout",
  title: "Inbox with resizable panes",
  lede: "Drag a line, or tab to it and use the arrow keys.",
  folders: [
    { id: "inbox", label: "Inbox", icon: "mail", count: 3 },
    { id: "starred", label: "Starred", icon: "star", count: 0 },
    { id: "sent", label: "Sent", icon: "send", count: 0 },
    { id: "archive", label: "Archive", icon: "archive", count: 0 },
  ],
  messages: [
    { id: "m1", from: "Rosa Lindqvist", subject: "Kiln schedule for November", when: "9:41", unread: true, body: "Hi all,\n\nThe kiln is booked for bisque firings on the 4th and 18th, and glaze firings on the 11th and 25th. Put your pieces on the top shelf by noon the day before.\n\nRosa" },
    { id: "m2", from: "Theo Marsh", subject: "Re: Saturday class numbers", when: "8:15", unread: true, body: "We're at 11 for Saturday, so one more seat is open. I'll bring the extra wheel from the back room.\n\nTheo" },
    { id: "m3", from: "Clay Supply Co.", subject: "Your order has shipped", when: "Yesterday", unread: true, body: "Your order of 4 bags of stoneware and 2 bags of porcelain is on its way and should arrive Thursday." },
    { id: "m4", from: "Ana Ruiz", subject: "Photos from the open studio", when: "Mon", unread: false, body: "Here are the best shots from Sunday. The mug wall turned out great; feel free to use any of them on the site." },
  ],
  replyPlaceholder: "Write a reply…",
};

export default function ResizablePreview() {
  const d = SAMPLE;
  const host = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [folder, setFolder] = useState("inbox");
  const [openId, setOpenId] = useState(d.messages[0]!.id);
  const [read, setRead] = useState<string[]>([d.messages[0]!.id]);
  const [sizes, setSizes] = useState<number[]>([]);
  const [layout, setLayout] = useState(0);
  const [reply, setReply] = useState("");
  const [said, setSaid] = useState("");

  useEffect(() => {
    const el = host.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setNarrow((entry?.contentRect.width ?? 900) < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const msg = d.messages.find((m) => m.id === openId) ?? d.messages[0]!;
  const unread = d.messages.filter((m) => m.unread && !read.includes(m.id)).length;

  const folders = (
    <nav className="fl-split-folders" aria-label="Folders">
      <ul>
        {d.folders.map((f) => (
          <li key={f.id}>
            <button type="button" className="fl-split-folder" aria-current={folder === f.id ? "page" : undefined} onClick={() => setFolder(f.id)}>
              <Icon name={f.icon} />
              <span>{f.label}</span>
              {f.id === "inbox" && unread ? (
                <>
                  <Badge variant="count" count={unread} />
                  <span className="fl-sr">, {unread} unread</span>
                </>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  const list = (
    <ul className="fl-split-list" aria-label="Messages">
      {(folder === "inbox" ? d.messages : []).map((m) => {
        const isUnread = m.unread && !read.includes(m.id);
        return (
          <li key={m.id}>
            <button
              type="button"
              className={["fl-split-msg", isUnread ? "is-unread" : ""].filter(Boolean).join(" ")}
              aria-current={openId === m.id ? "true" : undefined}
              onClick={() => {
                setOpenId(m.id);
                setRead((r) => (r.includes(m.id) ? r : [...r, m.id]));
              }}
            >
              <span className="fl-split-msg-top">
                <strong>{m.from}</strong>
                <time>{m.when}</time>
              </span>
              <span className="fl-split-msg-subject">{m.subject}</span>
            </button>
          </li>
        );
      })}
      {folder !== "inbox" ? <li className="fl-split-none">Nothing in {d.folders.find((f) => f.id === folder)?.label}.</li> : null}
    </ul>
  );

  const reading = (
    <SplitPanes
      key={`read-${layout}`}
      label="Message and reply"
      orientation="vertical"
      panes={[
        {
          id: "message",
          label: "Message",
          size: 64,
          min: 30,
          content: (
            <article className="fl-split-read" aria-label={msg.subject}>
              <h3>{msg.subject}</h3>
              <p className="fl-split-from">
                {msg.from} · {msg.when}
              </p>
              {msg.body.split("\n\n").map((para, k) => (
                <p key={k}>{para}</p>
              ))}
            </article>
          ),
        },
        {
          id: "reply",
          label: "Reply",
          size: 36,
          min: 24,
          collapsible: true,
          content: (
            <form
              className="fl-split-reply"
              onSubmit={(e) => {
                e.preventDefault();
                if (!reply.trim()) return setSaid("Write something first.");
                setReply("");
                setSaid(`Reply to ${msg.from} sent.`);
              }}
            >
              <textarea aria-label={`Reply to ${msg.from}`} placeholder={d.replyPlaceholder} value={reply} onChange={(e) => setReply(e.target.value)} />
              <Button size={32} icon="send" type="submit">
                Send
              </Button>
            </form>
          ),
        },
      ]}
    />
  );

  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="resizable-title">
      <div className="fl-wrap" ref={host}>
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="resizable-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <div className={["fl-split-app", narrow ? "fl-split-app--narrow" : ""].filter(Boolean).join(" ")}>
          <SplitPanes
            key={`${narrow ? "n" : "w"}-${layout}`}
            label="Inbox layout"
            orientation={narrow ? "vertical" : "horizontal"}
            onResize={setSizes}
            panes={[
              { id: "folders", label: "Folders", size: narrow ? 20 : 22, min: narrow ? 14 : 14, max: 40, collapsible: true, content: folders },
              { id: "messages", label: "Messages", size: narrow ? 34 : 34, min: 20, content: list },
              { id: "reading", label: "Reading pane", size: narrow ? 46 : 44, min: 25, content: reading },
            ]}
          />
        </div>

        <div className="fl-split-foot">
          <span className="fl-split-sizes" aria-hidden="true">
            {sizes.map((s) => `${Math.round(s)}%`).join(" · ")}
          </span>
          <p className="fl-split-status" role="status">
            {said}
          </p>
          <Button
            variant="tertiary"
            size={32}
            icon="refresh"
            onClick={() => {
              setLayout((n) => n + 1);
              setSaid("Layout reset.");
            }}
          >
            Reset layout
          </Button>
        </div>
      </div>
    </section>
  );
}
