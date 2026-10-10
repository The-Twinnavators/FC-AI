# Guided walkthrough: "Show me" and "Do it for me"

A portable spec for adding FlowCode's guided walkthrough to another product. Hand this whole file
to a coding agent, or implement it by hand. It describes a feature that works today, including the
parts that only became obvious after they were wrong once.

The product you are adding this to has a **help topics** page rather than a chat assistant. That is
the normal case and this spec assumes it. A chat is not required and nothing here depends on one.

---

## What it is

A help topic is not a paragraph telling someone where a button is. It is a list of real steps on
real controls, and pressing **Show me** makes a cursor glide to each one in turn, open what needs
opening, type what needs typing, and stop at the button that makes the decision.

Two modes:

| Mode | Who presses Next | Offer it |
| --- | --- | --- |
| **Show me** | The person, at each step | Always |
| **Do it for me** | Nobody — it runs on | Only where the product qualifies, below |

**"Do it for me" is not for every product.** Offer it only where both are true:

1. The product has an AI or automation that can produce the input, and
2. the workflow needs the user to supply data or text that the automation can draft for them.

If a workflow is only navigation and clicking, "Do it for me" has nothing to add and should not
appear: it would race the person through steps they needed to read. Ship **Show me** everywhere and
**Do it for me** only on the workflows that qualify.

### The rule that makes it safe to ship

**The walkthrough never presses a button that makes a decision.** It points at it and stops. Send,
submit, start, build, approve, allow, deny, delete, remove, apply, save, confirm, pay, publish,
restart — the person presses those. This is not a nicety. It is what makes it acceptable to let
software move a cursor around someone's screen, and the feature loses its licence the first time it
submits something on its own.

---

## Part 1 — Make the UI addressable

Nothing else works until this is done, and it is the part that gets skipped.

Put a stable attribute on every control a walkthrough needs to reach:

```html
<button data-cp="invoice-new">New invoice</button>
<input  data-cp="invoice-client" />
<button data-cp="invoice-send">Send invoice</button>
```

Rules:

- **`data-cp` is an API.** Name it for what the control *is*, not where it sits. Renaming one breaks
  every walkthrough that points at it, so treat it like a public identifier.
- **Mark the current state of a container** when a walkthrough needs to know a step landed:
  `data-cp="stage-{id}"` on the panel that is open. Without this the walkthrough has to assume a
  click worked, and assumption is where these break.
- **`data-cp-safe`** on a control whose label matches the decision words but is harmless — a
  disclosure called "Save a copy" that only expands a section. Use it rarely and deliberately.

> Learned the hard way: a workspace in FlowCode had three anchors, all on the form that *started* it.
> Once the user was inside the real work there was nothing to point at, so every walkthrough ended at
> the first button and abandoned them there. **Count your anchors per screen before writing a single
> step.** If a screen has fewer anchors than it has things to do, the walkthrough cannot help there.

---

## Part 2 — The step vocabulary

Eight kinds. Resist adding more; the constraint is what keeps walkthroughs honest.

```ts
type Step = {
  /** A travel step: moves on by itself even in Show me. */
  auto?: boolean;
  /** Said instead when the control is not there - e.g. nothing is waiting. */
  missing?: string;
  /** Your turn on this screen: waits for Next even in Do it for me. */
  pause?: boolean;
} & (
  | { do: "go";      path: string;                   say: string }
  | { do: "tab";     tab: string;                    say: string }
  | { do: "event";   name: string; detail?: unknown; say: string }
  /** Waits (up to a few minutes) until `until` appears, then carries on. */
  | { do: "wait";    target: string; until: string;  say: string }
  | { do: "point";   target: string;                 say: string }
  | { do: "click";   target: string;                 say: string }
  | { do: "type";    target: string; text: string;   say: string }
  /** The final button: pointed at, never pressed. */
  | { do: "confirm"; target: string;                 say: string }
);

interface Journey {
  id?: string;
  title: string;
  steps: Step[];
}
```

**`wait` is what makes long workflows possible.** A walkthrough cannot press a decision button, so
without `wait` every walkthrough ends at the first one. With it, the walkthrough points at the
button, the person presses it, and the walkthrough resumes when the next thing actually appears:

```ts
{ do: "wait", target: "stage-continue", until: "stage-solution",
  say: "When this reads right, press Continue. I'll pick up on the next stage." }
```

`missing` keeps a walkthrough from pointing at nothing:

```ts
{ do: "point", target: "approval-allow",
  say: "Read the action, then Allow or Deny. Those buttons are yours.",
  missing: "Nothing is waiting on you right now, so there is nothing to approve." }
```

### Writing the `say` lines

They are read, one at a time, by someone who does not know the product.

- Say what the control **is for**, not what it is called — the label is already on screen.
- One idea per step. If a `say` needs a semicolon and a "then", it is two steps.
- Name the consequence before the final button: *"Publish emails the client a link. You can
  unpublish at any time."*
- Never promise a time ("this takes 30 seconds"). You do not know their machine.

---

## Part 3 — The driver

A single always-mounted component. It listens for a start event, walks the steps, and draws its own
cursor.

```ts
const FINAL = /\b(send|submit|start|build|approve|allow|deny|delete|remove|apply|save|confirm|pay|publish|restart|stop|clear)\b/i;

function find(target: string): HTMLElement | null {
  return document.querySelector(`[data-cp="${target}"]`);
}

async function waitFor(get: () => HTMLElement | null, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const el = get();
    if (el && el.getClientRects().length) return el;   // visible, not merely present
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}
```

Behaviour that matters:

- **Pace it like a person.** Roughly: 1100ms to glide, 500ms resting on the control, 1100ms after a
  click, ~55ms per keystroke, 1200ms between steps. Instant is unreadable; the point is that someone
  can follow it.
- **Refuse the final click even when a journey asks for it.** Test `FINAL` against the control's
  label at click time, not only when the journey was written, and say why: *"That button makes a
  decision, so it's yours to click."* Authors make mistakes; the driver is the backstop.
- **Scroll the control into view** before pointing, and re-find it after any navigation. A reference
  held across a route change is stale.
- **Handing control back.** Escape, a Stop button, or the person clicking anything themselves ends
  it at once. Moving the mouse to watch does **not** — people move the mouse while reading, and
  stopping on that makes the feature feel broken. Ignore clicks on the walkthrough's own controls
  (Next, Stop) or it stops itself. Check `event.isTrusted` to tell a real pointer event from the
  driver's own.
- **Finishing is not stopping.** Reaching the last step or a `confirm` ends the run, but must not be
  reported as "stopped" — the person did not abandon anything.

### Narration

Emit an event per step so a panel, a toast or a log can show it. Keep the driver ignorant of what
displays it:

```ts
narrate({ title, i, n, say, final?, note?, ended?: "done" | "stopped" });
```

---

## Part 4 — The help topics page

Each topic is a card: a title, a sentence on what it is for, what is in it, and the buttons.

```
+----------------------------------------------------+
| PAGE   Component library       [Show me] [Ask...]  |
| The ready page sections the app builds from...     |
| WHAT'S IN IT                                       |
|  - Categories - filter by kind                     |
|  - Live previews - each one in its own frame       |
+----------------------------------------------------+
```

- **Show me** on every topic that has steps.
- **Do it for me** only on qualifying workflows. Omit the button entirely rather than disabling it;
  a disabled button is a question nobody can answer.
- A topic with no steps yet should not show the button at all.

### Chain the topics

The failure that is easy to miss: a walkthrough finishes, and the product offers a menu of other
things it can do. That is a menu, not a procedure. It tells people what else exists and nothing
about what they are in the middle of.

Give each topic a successor, and say why it follows:

```ts
const NEXT: Record<string, { id: string; why: string }> = {
  "create-invoice": { id: "send-invoice",  why: "A draft invoice does nothing until it is sent." },
  "send-invoice":   { id: "track-payment", why: "Once it is out, this is where you watch for payment." },
};
```

When a walkthrough ends, lead with the next step — *"Next: send the invoice. A draft does nothing
until it is sent."* — and a button that starts it. Put any other suggestions **below** it, under a
heading like "Or go somewhere else".

Two rules:

- **Check the state before pointing someone onward.** If the next stage is an inbox and the inbox is
  empty, send them somewhere useful instead. Pointing at an empty page and calling it the next step
  is worse than saying nothing.
- **A walkthrough the person stopped is not pushed onward.** Stopping is a decision. Answering it
  with "next" argues with them.

---

## Part 5 — Accessibility, and the things that bite

- The cursor is decoration: `aria-hidden`, and never the only way to follow along. The `say` text
  must be in the DOM and announced.
- Put each `say` in a **polite** live region. Not assertive — it fires on every step.
- Respect `prefers-reduced-motion`: jump the cursor rather than gliding it. Do not disable the
  feature.
- Keyboard: Next, Stop and Escape must all work without a mouse.
- The step counter ("Step 3 of 7") belongs on screen. People want to know how much is left.
- A step whose target never appears should say so and move on, not hang. Time out after a few
  seconds.
- Starting a second walkthrough must cancel the first cleanly.

---

## Build order

1. Anchors on one screen, and a walkthrough using only `go`, `point` and `confirm`.
2. The driver, with the `FINAL` guard and hand-back, before anything else.
3. `click`, `type`, `tab`.
4. `wait` — what lets a walkthrough cross a decision button.
5. The topics page and Show me.
6. Chaining and state checks.
7. "Do it for me", last, and only on qualifying workflows.

The order matters: everything after step 2 is safe because step 2 exists.
