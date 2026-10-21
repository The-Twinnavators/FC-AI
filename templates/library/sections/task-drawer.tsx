/** @flowcode-library task-drawer · Task detail drawer (Dialogs and drawers)
 * Catalog ID: p.task-drawer (pattern)
 * Function: The task detail drawer (p.task-drawer): a board card opened in a side drawer to work on it: rename it, set status, assignee, due date and priority, write a description, tick, add, reorder (Alt + arrow keys) and delete checklist items, hide finished ones, read and post comments (with posting and failed states) and delete the task; every delete asks first.
 * Use it as: import { TaskDrawer } from "./task-drawer"; <button data-task-id={task.id} onClick={() => open(task.id)}>…</button>; <TaskDrawer open={Boolean(task)} task={task} statuses={[{ value, label }]} people={[{ id, name, src? }]} me="id" now?={new Date()} onChange={(task) => ...} onClose={() => ...} onDelete?={(id) => ...} onComment?={async (text) => ...} labels?={{ ... }} />
 * Built from: c.select.outlined, c.text-field.outlined, c.segmented.segmented, c.checkbox, c.avatar.person, c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary, c.button.destructive
 * Look: A drawer from the right edge: the task key and a large editable title at the top, a two-column grid of status, assignee, due date and priority, a description box, a checklist with a thin progress bar, then a comment thread with avatars and a reply box; a footer holds Delete task and Done. On a phone it fills the screen.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --text-xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: task details; kanban card details; issue detail; ticket detail; to-do item; project task; card drawer; work item
 * Jobs to be done: see everything about a task; change who owns a task; move a task to another stage; track the steps left; discuss a task with the team; delete a task made by mistake
 * Keywords: task, kanban, card, drawer, checklist, comments, assignee, due date, priority, side panel
 */
/**
 * Task detail drawer: a native modal <dialog> that slides in from the right (@starting-style; it fades on the way out)
 * with everything about one task. The title is a field: Enter saves, Escape puts it back, and an empty title is
 * refused. Status, assignee, due date and priority save as they change. The checklist shows progress; Enter in the
 * add box adds an item, Alt + Up or Down on an item moves it (items glide, a FLIP), and Delete asks "Delete?" before
 * removing it. Comments post with Ctrl + Enter or the Post button, show "Posting…" and keep the text if posting fails;
 * your own comments can be deleted after a second press. Delete task asks first in the footer. Make it the app's own:
 * replace SAMPLE with the board's tasks, people and stages, and save through onChange, onDelete and onComment.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its slide-over drawer, checkboxes and comment lists.
 */
/**
 * How to try it
 * - Press "Write launch email" on the board: the drawer opens. Clear the title and press Enter: it says why.
 * - Change Status to Done: the card moves column on the board behind. Pick an assignee and a due date.
 * - Tick checklist items; focus one and press Alt + Down: it moves. Press its trash button twice to delete it.
 *   Type in "Add an item" and press Enter.
 * - Write a comment and press Ctrl + Enter. A comment with "fail" in it shows the failed state with Retry.
 * - Press Delete task, then confirm. Escape or Done closes the drawer and focus goes back to the card.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Select, TextField,
 * Segmented, Checkbox, Avatar, Badge and Button ("./dropdowns-states", "./text-fields-states", "./segmented-control",
 * "./checkboxes-radios", "./avatars-variants", "./badges-status", "./buttons-variants") and its inline icon set
 * ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the library's own
 * fl- classes in templates/library/css/r2h-taskdrawer.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Avatar } from "./avatars-variants";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.task-drawer: one task's details, checklist and comments in a side drawer. ──

export type TaskPerson = { id: string; name: string; src?: string };
export type TaskCheck = { id: string; text: string; done: boolean };
export type TaskComment = { id: string; who: string; at: string; text: string };
export type TaskPriority = "low" | "medium" | "high";
export type Task = {
  id: string;
  /** A short key shown above the title: "WEB-42". */
  key?: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  /** ISO date. */
  due?: string;
  priority: TaskPriority;
  checklist: TaskCheck[];
  comments: TaskComment[];
};
export type TaskStatus = { value: string; label: string; tone?: BadgeTone };

export type TaskDrawerLabels = Partial<{
  title: string;
  noTitle: string;
  status: string;
  assignee: string;
  nobody: string;
  due: string;
  priority: string;
  description: string;
  descriptionHint: string;
  checklist: string;
  hideDone: string;
  addItem: string;
  noItem: string;
  reorderHint: string;
  deleteItem: string;
  confirmDelete: string;
  comments: string;
  noComments: string;
  writeComment: string;
  post: string;
  posting: string;
  noComment: string;
  postFailed: string;
  retry: string;
  deleteTask: string;
  deleteTaskText: string;
  cancel: string;
  done: string;
  close: string;
}>;

export type TaskDrawerProps = {
  open: boolean;
  task: Task | null;
  statuses: TaskStatus[];
  people: TaskPerson[];
  /** The signed-in person's id: new comments are theirs, and only theirs can be deleted. */
  me: string;
  now?: Date;
  onChange: (task: Task) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
  /** Saves a comment; reject to show the failed state. Saved at once when left out. */
  onComment?: (text: string) => Promise<void>;
  labels?: TaskDrawerLabels;
};

const reduced = () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off");

/** FLIP: items marked data-flip glide from where they were to where they are now whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const rows = [...el.querySelectorAll<HTMLElement>("[data-flip]")];
    const now = new Map(rows.map((r) => [r.dataset.flip!, r.getBoundingClientRect().top]));
    if (!reduced()) {
      const easing = getComputedStyle(el).getPropertyValue("--ease-out").trim() || "ease-out";
      for (const r of rows) {
        const was = last.current.get(r.dataset.flip!);
        const dy = was === undefined ? 0 : was - now.get(r.dataset.flip!)!;
        if (Math.abs(dy) > 1) r.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: 200, easing });
      }
    }
    last.current = now;
  }, [box, key]);
}

export function TaskDrawer({ open, task: given, statuses, people, me, now: nowProp, onChange, onClose, onDelete, onComment, labels = {} }: TaskDrawerProps) {
  const l = {
    title: "Task title",
    noTitle: "A task needs a title.",
    status: "Status",
    assignee: "Assignee",
    nobody: "Unassigned",
    due: "Due date",
    priority: "Priority",
    description: "Description",
    descriptionHint: "Add more detail…",
    checklist: "Checklist",
    hideDone: "Hide done",
    addItem: "Add an item",
    noItem: "Type the item first.",
    reorderHint: "Alt + ↑ or ↓ moves an item.",
    deleteItem: "Delete item",
    confirmDelete: "Delete?",
    comments: "Comments",
    noComments: "No comments yet.",
    writeComment: "Write a comment",
    post: "Post",
    posting: "Posting…",
    noComment: "Write something first.",
    postFailed: "Couldn't post your comment.",
    retry: "Retry",
    deleteTask: "Delete task",
    deleteTaskText: "Delete this task and its comments? This can't be undone.",
    cancel: "Cancel",
    done: "Done",
    close: "Close",
    ...labels,
  };
  const id = useId();
  // The last task stays drawn while the drawer fades out after a close or a delete.
  const keep = useRef(given);
  if (given) keep.current = given;
  const task = given ?? keep.current;
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const now = nowProp ?? new Date();
  const [title, setTitle] = useState(task?.title ?? "");
  const [titleError, setTitleError] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [itemError, setItemError] = useState("");
  const [arming, setArming] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [posting, setPosting] = useState<"idle" | "busy" | "failed">("idle");
  const [confirmTask, setConfirmTask] = useState(false);
  const [status, setStatus] = useState("");

  // A different task resets the drawer's own state, during render so the fields are right before the dialog opens.
  const [seen, setSeen] = useState(task?.id);
  if (task?.id !== seen) {
    setSeen(task?.id);
    setTitle(task?.title ?? "");
    setTitleError("");
    setNewItem("");
    setItemError("");
    setArming(null);
    setComment("");
    setCommentError("");
    setPosting("idle");
    setConfirmTask(false);
  }

  // The native modal dialog: the page behind turns inert, Tab stays inside, and focus goes back to the opener.
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && d.open) {
      d.close();
      // The card may have moved (a new status puts it in another column): find it again by its data-task-id.
      const back = opener.current?.isConnected ? opener.current : opener.current?.dataset.taskId ? document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(opener.current.dataset.taskId)}"]`) : null;
      // A deleted task has no card left: the first card on the board takes focus instead.
      (back ?? document.querySelector<HTMLElement>("[data-task-id]"))?.focus();
    }
  }, [open]);

  const checklist = task?.checklist ?? [];
  useFlip(list, checklist.map((c) => c.id).join());
  if (!task) return <dialog ref={dlg} className="fl-td" aria-label={l.title} />;

  const update = (patch: Partial<Task>, say?: string) => {
    onChange({ ...task, ...patch });
    if (say) setStatus(say);
  };
  const person = (pid?: string) => people.find((p) => p.id === pid);
  const doneCount = checklist.filter((c) => c.done).length;
  const shownItems = hideDone ? checklist.filter((c) => !c.done) : checklist;

  // Reads the field itself: a blur can arrive before React has the latest text (the dialog moving focus on open).
  const commitTitle = (value: string) => {
    const t = value.trim();
    if (!t) {
      setTitleError(l.noTitle);
      return false;
    }
    setTitleError("");
    if (t !== task.title) update({ title: t }, "Title saved.");
    return true;
  };
  const titleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (commitTitle(e.currentTarget.value)) e.currentTarget.blur();
    } else if (e.key === "Escape" && (title !== task.title || titleError)) {
      // Escape first undoes the edit; a second Escape closes the drawer.
      e.preventDefault();
      e.stopPropagation();
      setTitle(task.title);
      setTitleError("");
    }
  };

  const addItem = () => {
    const t = newItem.trim();
    if (!t) return setItemError(l.noItem);
    update({ checklist: [...checklist, { id: `c-${Date.now()}`, text: t, done: false }] }, `Added "${t}".`);
    setNewItem("");
    setItemError("");
  };
  const moveItem = (cid: string, by: -1 | 1) => {
    const at = checklist.findIndex((c) => c.id === cid);
    const to = at + by;
    if (to < 0 || to >= checklist.length) return;
    const next = [...checklist];
    const [it] = next.splice(at, 1);
    next.splice(to, 0, it!);
    update({ checklist: next }, `${it!.text} moved to position ${to + 1} of ${next.length}.`);
    window.setTimeout(() => document.getElementById(`${id}-c-${cid}`)?.focus(), 0);
  };
  const deleteItem = (c: TaskCheck) => {
    if (arming !== c.id) {
      setArming(c.id);
      setStatus(`Press again to delete "${c.text}".`);
      return;
    }
    const at = checklist.findIndex((x) => x.id === c.id);
    const rest = checklist.filter((x) => x.id !== c.id);
    update({ checklist: rest }, `Deleted "${c.text}".`);
    setArming(null);
    window.setTimeout(() => {
      const next = rest[Math.min(at, rest.length - 1)];
      (next ? document.getElementById(`${id}-c-${next.id}`) : document.getElementById(`${id}-add`))?.focus();
    }, 0);
  };

  const post = async () => {
    const text = comment.trim();
    if (!text) return setCommentError(l.noComment);
    setCommentError("");
    setPosting("busy");
    try {
      await (onComment ? onComment(text) : Promise.resolve());
      update({ comments: [...task.comments, { id: `m-${Date.now()}`, who: me, at: new Date(Math.max(now.getTime(), Date.now())).toISOString(), text }] }, "Comment posted.");
      setComment("");
      setPosting("idle");
    } catch {
      setPosting("failed");
      setStatus(l.postFailed);
    }
  };
  const ago = (iso: string) => {
    const mins = Math.max(0, Math.round((Math.max(now.getTime(), Date.now()) - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  };

  return (
    <dialog
      ref={dlg}
      className="fl-td"
      aria-labelledby={`${id}-title`}
      data-fl="p.task-drawer"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        // A press on the backdrop (the dialog box itself, outside the panel) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fl-td-panel">
        <header className="fl-td-head">
          <div className="fl-td-headline">
            {task.key ? <span className="fl-td-key">{task.key}</span> : null}
            <label htmlFor={`${id}-title`} className="fl-sr">
              {l.title}
            </label>
            <input
              id={`${id}-title`}
              className={`fl-td-title${titleError ? " is-invalid" : ""}`}
              value={title}
              aria-invalid={Boolean(titleError) || undefined}
              aria-describedby={titleError ? `${id}-title-err` : undefined}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => commitTitle(e.currentTarget.value)}
              onKeyDown={titleKey}
            />
            {titleError ? (
              <p id={`${id}-title-err`} className="fl-td-err" role="alert">
                <Icon name="alert" />
                {titleError}
              </p>
            ) : null}
          </div>
          <Button variant="tertiary" size={32} icon="close" iconOnly data-autofocus onClick={onClose}>
            {l.close}
          </Button>
        </header>

        <div className="fl-td-body">
          <div className="fl-td-fields">
            <div className="fl-td-field">
              <label htmlFor={`${id}-status`}>{l.status}</label>
              <Select id={`${id}-status`} value={task.status} options={statuses} onChange={(e) => update({ status: e.target.value }, `Status: ${statuses.find((s) => s.value === e.target.value)?.label}.`)} />
            </div>
            <div className="fl-td-field">
              <label htmlFor={`${id}-who`}>{l.assignee}</label>
              <span className="fl-td-who">
                <Avatar name={person(task.assignee)?.name ?? "?"} src={person(task.assignee)?.src} size={24} decorative />
                <Select id={`${id}-who`} value={task.assignee ?? ""} options={[{ value: "", label: l.nobody }, ...people.map((p) => ({ value: p.id, label: p.id === me ? `${p.name} (you)` : p.name }))]} onChange={(e) => update({ assignee: e.target.value || undefined }, e.target.value ? `Assigned to ${person(e.target.value)?.name}.` : "Unassigned.")} />
              </span>
            </div>
            <div className="fl-td-field">
              <label htmlFor={`${id}-due`}>{l.due}</label>
              <TextField id={`${id}-due`} type="date" size={40} value={task.due ?? ""} onChange={(e) => update({ due: e.target.value || undefined }, e.target.value ? "Due date saved." : "Due date cleared.")} />
            </div>
            <div className="fl-td-field">
              <span id={`${id}-prio`}>{l.priority}</span>
              <Segmented
                size="sm"
                label={l.priority}
                value={task.priority}
                onChange={(v) => update({ priority: v as TaskPriority }, `Priority set.`)}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
              />
            </div>
          </div>

          <div className="fl-td-field">
            <label htmlFor={`${id}-desc`}>{l.description}</label>
            <TextField
              id={`${id}-desc`}
              multiline
              autoGrow
              rows={3}
              placeholder={l.descriptionHint}
              defaultValue={task.description ?? ""}
              key={task.id}
              onBlur={(e) => {
                if (e.target.value !== (task.description ?? "")) update({ description: e.target.value }, "Description saved.");
              }}
            />
          </div>

          <section className="fl-td-section" aria-labelledby={`${id}-cl`}>
            <div className="fl-td-section-head">
              <h3 id={`${id}-cl`}>
                {l.checklist} <span>{checklist.length ? `${doneCount}/${checklist.length}` : ""}</span>
              </h3>
              {doneCount ? (
                <Button variant="tertiary" size={24} pressed={hideDone} onClick={() => setHideDone((h) => !h)}>
                  {l.hideDone}
                </Button>
              ) : null}
            </div>
            {checklist.length ? (
              <span className="fl-td-progress" role="progressbar" aria-label={l.checklist} aria-valuemin={0} aria-valuemax={checklist.length} aria-valuenow={doneCount} aria-valuetext={`${doneCount} of ${checklist.length} done`}>
                <span style={{ scale: `${checklist.length ? doneCount / checklist.length : 0} 1` }} />
              </span>
            ) : null}
            <ul className="fl-td-checks" ref={list} aria-describedby={`${id}-hint`}>
              {shownItems.map((c) => (
                <li key={c.id} data-flip={c.id} className={c.done ? "is-done" : undefined}>
                  <Checkbox
                    id={`${id}-c-${c.id}`}
                    label={c.text}
                    checked={c.done}
                    onChange={(e) => update({ checklist: checklist.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)) }, `${c.text}: ${e.target.checked ? "done" : "not done"}.`)}
                    onKeyDown={(e) => {
                      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                        e.preventDefault();
                        moveItem(c.id, e.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                  />
                  <Button
                    variant={arming === c.id ? "destructive" : "tertiary"}
                    size={24}
                    icon="trash"
                    iconOnly={arming !== c.id}
                    aria-label={arming === c.id ? `Confirm: delete ${c.text}` : `${l.deleteItem}: ${c.text}`}
                    onClick={() => deleteItem(c)}
                    onBlur={() => arming === c.id && setArming(null)}
                  >
                    {arming === c.id ? l.confirmDelete : l.deleteItem}
                  </Button>
                </li>
              ))}
            </ul>
            <p id={`${id}-hint`} className="fl-td-hint">
              {checklist.length > 1 ? l.reorderHint : ""}
            </p>
            <div className="fl-td-add">
              <label htmlFor={`${id}-add`} className="fl-sr">
                {l.addItem}
              </label>
              <TextField
                id={`${id}-add`}
                size={32}
                placeholder={l.addItem}
                value={newItem}
                invalid={Boolean(itemError)}
                aria-describedby={itemError ? `${id}-add-err` : undefined}
                onChange={(e) => {
                  setNewItem(e.target.value);
                  if (itemError) setItemError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <Button variant="secondary" size={32} icon="plus" iconOnly onClick={addItem}>
                {l.addItem}
              </Button>
            </div>
            {itemError ? (
              <p id={`${id}-add-err`} className="fl-td-err" role="alert">
                <Icon name="alert" />
                {itemError}
              </p>
            ) : null}
          </section>

          <section className="fl-td-section" aria-labelledby={`${id}-cm`}>
            <h3 id={`${id}-cm`}>
              {l.comments} <span>{task.comments.length || ""}</span>
            </h3>
            {task.comments.length ? (
              <ol className="fl-td-comments">
                {task.comments.map((c) => {
                  const who = person(c.who);
                  const mine = c.who === me;
                  return (
                    <li key={c.id}>
                      <Avatar name={who?.name ?? "Someone"} src={who?.src} size={32} decorative />
                      <div>
                        <p className="fl-td-cmeta">
                          <strong>{who?.name ?? "Someone"}</strong>
                          <time dateTime={c.at}>{ago(c.at)}</time>
                          {mine ? (
                            <button
                              type="button"
                              className={`fl-td-cdel${arming === c.id ? " is-armed" : ""}`}
                              aria-label={arming === c.id ? "Confirm: delete your comment" : "Delete your comment"}
                              onBlur={() => arming === c.id && setArming(null)}
                              onClick={() => {
                                if (arming !== c.id) {
                                  setArming(c.id);
                                  setStatus("Press again to delete your comment.");
                                  return;
                                }
                                setArming(null);
                                update({ comments: task.comments.filter((x) => x.id !== c.id) }, "Comment deleted.");
                                document.getElementById(`${id}-reply`)?.focus();
                              }}
                            >
                              {arming === c.id ? l.confirmDelete : "Delete"}
                            </button>
                          ) : null}
                        </p>
                        <p className="fl-td-ctext">{c.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="fl-td-hint">{l.noComments}</p>
            )}
            <div className="fl-td-reply">
              <Avatar name={person(me)?.name ?? "You"} src={person(me)?.src} size={32} decorative />
              <div className="fl-td-field">
                <label htmlFor={`${id}-reply`} className="fl-sr">
                  {l.writeComment}
                </label>
                <TextField
                  id={`${id}-reply`}
                  multiline
                  autoGrow
                  rows={2}
                  placeholder={`${l.writeComment}…`}
                  value={comment}
                  disabled={posting === "busy"}
                  invalid={Boolean(commentError)}
                  aria-describedby={`${id}-reply-hint${commentError ? ` ${id}-reply-err` : ""}`}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (commentError) setCommentError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      post();
                    }
                  }}
                />
                {commentError ? (
                  <p id={`${id}-reply-err`} className="fl-td-err" role="alert">
                    <Icon name="alert" />
                    {commentError}
                  </p>
                ) : null}
                {posting === "failed" ? (
                  <p className="fl-td-err" role="alert">
                    <Icon name="alert" />
                    {l.postFailed}
                  </p>
                ) : null}
                <div className="fl-td-reply-foot">
                  <span id={`${id}-reply-hint`}>Ctrl + Enter to post</span>
                  <Button size={32} icon={posting === "failed" ? "refresh" : "send"} busy={posting === "busy"} onClick={post}>
                    {posting === "busy" ? l.posting : posting === "failed" ? l.retry : l.post}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className={`fl-td-foot${confirmTask ? " is-confirming" : ""}`}>
          {confirmTask ? (
            <div className="fl-td-confirm" role="group" aria-labelledby={`${id}-del`}>
              <p id={`${id}-del`}>{l.deleteTaskText}</p>
              <div>
                <Button
                  variant="secondary"
                  size={40}
                  data-autofocus-confirm
                  onClick={() => {
                    setConfirmTask(false);
                    window.setTimeout(() => document.getElementById(`${id}-deltask`)?.focus(), 0);
                  }}
                >
                  {l.cancel}
                </Button>
                <Button
                  variant="destructive"
                  size={40}
                  icon="trash"
                  onClick={() => {
                    onDelete?.(task.id);
                    onClose();
                  }}
                >
                  {l.deleteTask}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {onDelete ? (
                <Button
                  id={`${id}-deltask`}
                  variant="tertiary"
                  size={40}
                  icon="trash"
                  className="fl-td-danger"
                  onClick={() => {
                    setConfirmTask(true);
                    window.setTimeout(() => dlg.current?.querySelector<HTMLElement>("[data-autofocus-confirm]")?.focus(), 0);
                  }}
                >
                  {l.deleteTask}
                </Button>
              ) : (
                <span />
              )}
              <Button size={40} onClick={onClose}>
                {l.done}
              </Button>
            </>
          )}
        </footer>
        <p className="fl-sr" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </dialog>
  );
}

// flowcode:sample
const SAMPLE = {
  me: "p1",
  now: new Date("2026-10-21T10:00:00"),
  statuses: [
    { value: "todo", label: "To do" },
    { value: "doing", label: "In progress" },
    { value: "done", label: "Done" },
  ] as TaskStatus[],
  people: [
    { id: "p1", name: "Jordan Hale" },
    { id: "p2", name: "Ana Ruiz" },
    { id: "p3", name: "Marcus Lee" },
  ] as TaskPerson[],
  tasks: [
    {
      id: "t1",
      key: "WEB-41",
      title: "Write launch email",
      description: "Short email to the waitlist announcing the new site. Link to the pricing page.",
      status: "doing",
      assignee: "p2",
      due: "2026-10-24",
      priority: "high",
      checklist: [
        { id: "c1", text: "Draft subject lines", done: true },
        { id: "c2", text: "Write the body copy", done: true },
        { id: "c3", text: "Get sign-off from Jordan", done: false },
        { id: "c4", text: "Schedule the send", done: false },
      ],
      comments: [
        { id: "m1", who: "p2", at: "2026-10-21T08:40:00", text: "First draft is in the doc. Two subject lines to pick from." },
        { id: "m2", who: "p1", at: "2026-10-21T09:15:00", text: "Going with the shorter one. Can we add the launch date?" },
      ],
    },
    { id: "t2", key: "WEB-42", title: "Fix footer links on mobile", status: "todo", assignee: "p3", priority: "medium", checklist: [{ id: "c5", text: "Check iOS Safari", done: false }], comments: [] },
    { id: "t3", key: "WEB-38", title: "Pick hero photo", status: "done", assignee: "p1", due: "2026-10-18", priority: "low", checklist: [], comments: [{ id: "m3", who: "p3", at: "2026-10-19T14:00:00", text: "Went with the harbor shot." }] },
  ] as Task[],
};

export default function TaskDrawerSheet() {
  const [tasks, setTasks] = useState(SAMPLE.tasks);
  const [openId, setOpenId] = useState<string | null>(null);
  const task = tasks.find((t) => t.id === openId) ?? null;
  return (
    <section className="fl-section fl-section--canvas" aria-label="Task board">
      <div className="fl-wrap">
        <div className="fl-td-board">
          {SAMPLE.statuses.map((s) => (
            <section key={s.value} className="fl-td-col" aria-label={s.label}>
              <h3>
                {s.label} <span>{tasks.filter((t) => t.status === s.value).length}</span>
              </h3>
              {tasks
                .filter((t) => t.status === s.value)
                .map((t) => {
                  const who = SAMPLE.people.find((p) => p.id === t.assignee);
                  const done = t.checklist.filter((c) => c.done).length;
                  return (
                    <button key={t.id} type="button" className="fl-td-card" data-task-id={t.id} aria-haspopup="dialog" onClick={() => setOpenId(t.id)}>
                      <span className="fl-td-key">{t.key}</span>
                      <strong>{t.title}</strong>
                      <span className="fl-td-cardmeta">
                        <Badge tone={t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "neutral"}>{t.priority === "high" ? "High" : t.priority === "medium" ? "Medium" : "Low"}</Badge>
                        {t.checklist.length ? (
                          <span>
                            <Icon name="check" /> {done}/{t.checklist.length}
                          </span>
                        ) : null}
                        {t.comments.length ? (
                          <span>
                            <Icon name="mail" /> {t.comments.length}
                          </span>
                        ) : null}
                        {who ? <Avatar name={who.name} size={24} decorative /> : null}
                      </span>
                    </button>
                  );
                })}
            </section>
          ))}
        </div>
        <TaskDrawer
          open={Boolean(task)}
          task={task}
          statuses={SAMPLE.statuses}
          people={SAMPLE.people}
          me={SAMPLE.me}
          now={SAMPLE.now}
          onChange={(t) => setTasks((xs) => xs.map((x) => (x.id === t.id ? t : x)))}
          onDelete={(tid) => setTasks((xs) => xs.filter((x) => x.id !== tid))}
          onClose={() => setOpenId(null)}
          onComment={async (text) => {
            await new Promise((r) => window.setTimeout(r, 600));
            if (/fail/i.test(text)) throw new Error("Server said no");
          }}
        />
      </div>
    </section>
  );
}
