/** @flowcode-library nb-feedback · Neobrutal feedback (Alerts and states)
 * Catalog ID: c.alert@neobrutal (component version)
 * Version of: c.alert
 * Function: Dismissable alerts in info, success, warning and error tones, status badges, and chunky progress bars including a running upload.
 * Use it as: import { Alert } from "./alerts-states"; <Alert version="neobrutal" variant?="info"|"success"|"warning"|"danger" icon? title="Booking confirmed" dismissible? onDismiss?>Detail text</Alert>. Same kit, other components: <Badge version="neobrutal" tone? look?="soft"|"solid">Open</Badge> (c.badge@neobrutal) and <Progress version="neobrutal" value caption valueText striped? tone?/> (c.progress@neobrutal)
 * Built from: c.alert@neobrutal, c.badge@neobrutal, c.progress@neobrutal
 * Look: Flat color blocks with a thick ink border and a hard offset shadow: alerts with a square colored icon tile and a chunky close button, uppercase pill badges with a dot, and ink-bordered progress bars with a striped running fill.
 * Tokens: --color-text --color-surface --color-secondary --color-accent --color-success --color-danger --radius-sm --space-1 --space-2 --space-3 --space-4 --space-5 --weight-bold --text-xs --text-sm --text-md --tracking-wide --duration-fast --duration-base --easing --focus-ring
 * Use cases: alerts; notifications; status badges; upload progress; system messages; booking status; dashboard notices
 * Jobs to be done: know if something worked; see the status of my booking; track an upload until it finishes; dismiss notices i have read
 * Keywords: alerts, badges, progress, notifications, status, neobrutalism
 */
/**
 * Neobrutalist feedback: alerts in four tones that can be dismissed, status badges, and chunky progress bars with a
 * striped upload. This is c.alert@neobrutal, c.badge@neobrutal and c.progress@neobrutal with this piece's sample
 * content; the implementations live in the components, in ./alerts-states, ./badges-status and ./progress-indicators.
 * Make it the app's own: replace SAMPLE with real messages and statuses and drive the progress value from the real task.
 */
import { Alert } from "./alerts-states";
import { Badge } from "./badges-status";
import { Progress } from "./progress-indicators";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Feedback",
  title: "Say it loud, then get out of the way",
  alerts: [
    { id: "info", tone: "info" as const, icon: "sparkle", title: "New evening classes", text: "Tuesday and Thursday wheel classes now run until 9pm." },
    { id: "success", tone: "success" as const, icon: "check", title: "Booking confirmed", text: "Saturday glazing workshop, 10am. We sent the details by email." },
    { id: "warning", tone: "warning" as const, icon: "clock", title: "Two spots left", text: "Sunday hand-building is nearly full. Book soon to keep your place." },
    { id: "error", tone: "danger" as const, icon: "shield", title: "Card was declined", text: "We could not take the deposit. Check the card details and try again." },
  ],
  badges: [
    { label: "Open", tone: "success" as const },
    { label: "Waitlist", tone: "warning" as const },
    { label: "Full", tone: "danger" as const },
    { label: "New", tone: "info" as const },
  ],
  count: "12 booked",
  bars: [
    { label: "Classes used this month", value: 3, max: 4, tone: "accent" as const },
    { label: "Kiln load", value: 85, max: 100, tone: "warning" as const },
  ],
  upload: { label: "Uploading class photos", value: 60 },
};

export default function NbFeedback() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-feedback-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <div className="fl-head">
          <p className="fl-nb-kicker">{d.eyebrow}</p>
          <h2 id="nb-feedback-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-nb-group">
          <h3 className="fl-nb-group__label">Alerts</h3>
          <div className="fl-nb-alerts">
            {d.alerts.map((a) => (
              <Alert key={a.id} version="neobrutal" variant={a.tone} icon={a.icon} title={a.title} dismissible>
                {a.text}
              </Alert>
            ))}
          </div>
        </div>

        <div className="fl-nb-group">
          <h3 className="fl-nb-group__label">Badges</h3>
          <div className="fl-nb-badges">
            {d.badges.map((b) => (
              <Badge key={b.label} version="neobrutal" tone={b.tone}>
                {b.label}
              </Badge>
            ))}
            <Badge version="neobrutal" look="solid">
              {d.count}
            </Badge>
          </div>
        </div>

        <div className="fl-nb-group">
          <h3 className="fl-nb-group__label">Progress</h3>
          <div className="fl-nb-box" style={{ padding: "var(--space-5)", display: "grid", gap: "var(--space-5)" }}>
            {d.bars.map((b) => (
              <Progress key={b.label} version="neobrutal" tone={b.tone} value={Math.round((b.value / b.max) * 100)} caption={b.label} valueText={`${b.value} of ${b.max}`} />
            ))}
            <Progress version="neobrutal" striped value={d.upload.value} caption={d.upload.label} valueText={`${d.upload.value}%`} />
          </div>
        </div>
      </div>
    </section>
  );
}
