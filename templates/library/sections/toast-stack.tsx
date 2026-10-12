/** @flowcode-library toast-stack · Toast notifications (cards) (Alerts and states)
 * Catalog ID: c.toast-stack@cards (component version)
 * Version of: c.toast-stack
 * Function: Toasts that stack bottom-right, auto-dismiss with a pause on hover or focus, close by hand or Escape, are announced to screen readers, and offer Undo.
 * Use it as: import { ToastStack } from "./alerts-states"; <ToastStack version="cards" toasts={[{id, variant?, title, text?, onUndo?}]} onDismiss={(id) => ...} max?={4} duration?={5000} contained? />
 * Look: Toast cards stacked in the bottom-right corner, each with a tone icon, title, optional second line and Undo, a close x and a thin bar along the bottom that shrinks as the toast counts down.
 * Tokens: --color-secondary --color-accent --color-success --color-danger --color-surface --color-border --color-text --color-text-muted --radius-md --space-2 --space-3 --space-4 --duration-med --easing --focus-ring
 * Use cases: notifications; save confirmation; undo action; background task updates; activity alerts; error notifications; upload complete
 * Jobs to be done: know my action worked; undo something i did by mistake; stay aware of updates while working; notice errors without losing my place
 * Keywords: toast, snackbar, notification, undo
 */
/**
 * Toasts: short notices that stack in the bottom-right corner after an action. They close by themselves after a few
 * seconds (the timer pauses while the pointer or keyboard focus is on one), can be closed by hand or with Escape, and
 * are announced to screen readers. One carries an "Undo". This is c.toast-stack@cards with this piece's sample
 * content; the implementation lives in the component, in ./alerts-states. Make it the app's own: replace SAMPLE and
 * call the stack wherever the app finishes an action worth confirming.
 */
import { ToastBasket } from "./alerts-states";

// flowcode:sample
const SAMPLE = {
  title: "Your basket",
  lede: "Try the buttons: each one confirms with a toast.",
  basket: ["Pottery for beginners · Sat 11:00", "Life drawing · Tue 19:00", "Printmaking taster · Sun 14:00"],
  durationMs: 5000,
  toasts: {
    saved: { tone: "success", title: "Details saved", text: "Your name and phone number are up to date." },
    removed: { tone: "info", title: "Class removed", text: "" },
    failed: { tone: "error", title: "Payment didn't go through", text: "Nothing was charged. Check the card details and try again." },
    reminder: { tone: "info", title: "Reminder set", text: "We'll text you the evening before each class." },
  },
};

export default function ToastStack() {
  return <ToastBasket {...SAMPLE} />;
}
