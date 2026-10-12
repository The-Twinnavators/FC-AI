/** @flowcode-library alert-inline · Inline alerts (tone card) (Alerts and states)
 * Catalog ID: c.alert@tone-card (component version)
 * Version of: c.alert
 * Function: Inline messages in info, success, warning and error tones, each with an icon, title, text and an optional action; dismissible ones close and can be brought back.
 * Use it as: import { Alert } from "./alerts-states"; <Alert version="tone-card" variant?="info"|"success"|"warning"|"danger" title="Booking confirmed" actionLabel? onAction? dismissible? onDismiss?>Detail text</Alert>
 * Look: A list card tinted by its tone with a thick colored left edge, a round tone icon, a semibold title, a muted line of text and, when useful, a small outlined text action; a dismiss x sits at the right and errors are not dismissible.
 * Tokens: --color-secondary --color-accent --color-success --color-danger --color-surface --color-border --color-text --color-text-muted --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --weight-semibold --text-sm --text-md --focus-ring
 * Use cases: form errors; success message; warning notice; system status; account notices; payment failed; validation feedback; info message
 * Jobs to be done: know what went wrong and fix it; confirm my change was saved; notice something that needs my attention; dismiss a message i've read
 * Keywords: alert, message, notice, status, feedback, dismissible
 */
/**
 * Alerts: inline messages in four tones (info, success, warning, error), each a card with a colored left edge, an
 * icon, a title, a line of text and, when useful, one action. This is c.alert@tone-card with this piece's sample
 * content; the implementation lives in the component, in ./alerts-states. Make it the app's own: replace SAMPLE with
 * the app's real messages and keep only the tones it needs; errors stay until fixed, so they are not dismissible.
 */
import { Alert } from "./alerts-states";

// flowcode:sample
const SAMPLE = {
  title: "Booking messages",
  lede: "What people see when something about their booking changes.",
  alerts: [
    { id: "info", tone: "info" as const, title: "Opening hours change next week", text: "The studio opens at 10:00 from Monday 14 October while the new floor goes in.", action: "See new hours", dismissible: true },
    { id: "success", tone: "success" as const, title: "Booking confirmed", text: "Pottery for beginners, Saturday at 11:00. A reminder will arrive the day before.", action: "Add to calendar", dismissible: true },
    { id: "warning", tone: "warning" as const, title: "Only 2 places left", text: "The Thursday evening class is nearly full. Book soon to keep your spot.", action: "", dismissible: true },
    { id: "error", tone: "danger" as const, title: "Your card was declined", text: "The payment for your class pass did not go through. Try another card to keep the booking.", action: "Update payment", dismissible: false },
  ],
};

export default function AlertInline() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="alert-inline-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="alert-inline-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-alr-stack">
          {d.alerts.map((a) => (
            <Alert key={a.id} version="tone-card" variant={a.tone} title={a.title} actionLabel={a.action || undefined} dismissible={a.dismissible}>
              {a.text}
            </Alert>
          ))}
        </div>
      </div>
    </section>
  );
}
