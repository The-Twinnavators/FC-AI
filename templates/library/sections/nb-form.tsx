/** @flowcode-library nb-form · Neobrutal sign-up form (neobrutal version) (Forms)
 * Catalog ID: c.text-field@neobrutal (component version)
 * Version of: c.text-field
 * Function: A bold sign-up form with inputs, a select, a pill radio group, a textarea with a counter and a terms checkbox, showing inline errors and a success panel.
 * Use it as: import { TextField } from "./text-fields-states"; <TextField version="neobrutal" multiline? invalid? id name type value placeholder aria-describedby? onChange? />  // give it a <label className="fl-nb-label">; wrap it in a className="fl-nb" ancestor only if you want the kit's text style around it. The whole sign-up form is NeobrutalForm in the same file.
 * Look: A text box with a thick ink border, a hard offset shadow and a small corner radius (never over 24px) that nudges up and left on focus; an invalid field turns danger-red with a red shadow, messages carry a small icon, and the form's radios are pills and its checkbox a shadowed square.
 * Tokens: --color-text --color-surface --color-accent --color-on-accent --color-danger --color-success --color-text-muted --radius-sm --control-lg --control-md --space-2 --space-3 --text-md --text-sm --text-xs --weight-bold --weight-medium --focus-ring --duration-fast --easing
 * Use cases: sign up form; club membership; waitlist form; class registration; event registration; application form; contact form
 * Jobs to be done: join a club or studio; register for a class; sign up for the waitlist; tell them about myself
 * Keywords: form, sign up, validation, radio, checkbox, select, neobrutalism
 */
/**
 * c.text-field@neobrutal: the neobrutalism kit's text fields in a sign-up form (inputs, a select, pill radios, a textarea and
 * a shadowed terms checkbox) with chunky borders, icons on messages and a success panel. The field implementation lives in
 * the text field component, ./text-fields-states (<TextField version="neobrutal">); this piece shows it working with this sample.
 */
import { NeobrutalForm } from "./text-fields-states";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Join the studio",
  title: "Get your first class free",
  lede: "Tell us a little about you and we will hold a seat at your first class.",
  studios: ["North Street studio", "Riverside studio", "Either is fine"],
  levels: ["Never tried", "A few classes", "I have my own wheel"],
  notesMax: 200,
  submit: "Create my account",
  success: {
    title: "You are in!",
    text: "We sent a welcome note to {email}. Your free class is waiting at {studio}.",
    again: "Sign up someone else",
  },
};

export default function NbForm() {
  return <NeobrutalForm {...SAMPLE} />;
}
