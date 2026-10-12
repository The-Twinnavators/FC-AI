/** @flowcode-library nb-buttons · Neobrutal buttons (neobrutal version) (Forms)
 * Catalog ID: c.button@neobrutal (component version)
 * Version of: c.button
 * Function: Chunky ink-bordered buttons in primary, secondary, danger, icon, disabled and loading forms, with a hard shadow that lifts on hover and presses flat on click.
 * Use it as: import { Button } from "./buttons-variants"; <Button version="neobrutal" variant?="primary"|"secondary"|"tertiary"|"destructive" size? icon? iconAt? iconOnly? busy? pressed? block? onClick?>Label</Button>  // tertiary = the plain white button; disabled draws the hatched fill
 * Look: A square-cornered button with a thick ink border, a hard offset shadow and a bold 700 label; it lifts up and left on hover, presses flat on click, the secondary is tinted success green, and a disabled one is filled with hatched stripes.
 * Tokens: --color-text --color-surface --color-surface-sunken --color-accent --color-on-accent --color-success --color-danger --radius-sm --control-lg --control-md --control-pad-lg --text-md --weight-bold --disabled-opacity --focus-ring --duration-fast --easing
 * Use cases: button styles; playful ui; bold design system; action buttons; loading buttons; icon buttons; ui kit
 * Jobs to be done: take an action with one click; see that my action is working; toggle an option on or off
 * Keywords: buttons, neobrutalism, loading, icon button, toggle, bold
 */
/**
 * c.button@neobrutal: the neobrutalism kit's buttons (primary, secondary, danger, icon-only, disabled and loading) with
 * thick ink borders and a hard shadow that lifts on hover and presses flat on click. The implementation lives in the
 * button component, ./buttons-variants (<Button version="neobrutal">); this piece shows them working with this sample.
 */
import { NeobrutalButtons } from "./buttons-variants";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Buttons",
  title: "Press it like you mean it",
  lede: "Every button sits on a hard shadow. Hover lifts it, a click pushes it flat.",
  primary: "Book a session",
  secondary: "See the timetable",
  danger: "Cancel booking",
  dangerConfirm: "Tap again to cancel",
  favourite: "Save to favorites",
  unfavourite: "Remove from favorites",
  share: "Share this class",
  disabled: "Fully booked",
  disabledNote: "No spots left this week.",
  loadingIdle: "Pay deposit",
  loadingBusy: "Paying…",
  loadingDone: "Deposit paid",
  messages: {
    primary: "Session picked: Thursday, 6pm pottery.",
    secondary: "Opening the timetable…",
    cancelled: "Booking cancelled. Your spot is free for others.",
    saved: "Saved to favorites.",
    unsaved: "Removed from favorites.",
    shared: "Link copied to share.",
    paid: "Deposit of $15 paid. See you Thursday.",
  },
};

export default function NbButtons() {
  return <NeobrutalButtons {...SAMPLE} />;
}
