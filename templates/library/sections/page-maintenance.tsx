/** @flowcode-library page-maintenance · Planned maintenance (Alerts and states)
 * Catalog ID: b.page-state.maintenance (block)
 * Function: Planned maintenance page (b.page-state.maintenance): a thin wrapper that passes its own content to PageState.
 * Use it as: A ready-to-place b.page-state.maintenance: copy page-maintenance.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: b.page-state.maintenance
 * Look: planned downtime: when it started and ends with a live countdown, a notify-me email form and a filterable service status list
 * Use cases: maintenance page; planned downtime; scheduled outage; service status; system upgrade notice; outage notice; back soon
 * Jobs to be done: know when the service is back; see which features are affected; get notified when it returns; plan around the downtime
 * Keywords: maintenance, downtime, status, page, notify
 */
/**
 * Planned maintenance: tells people the app is down on purpose, when it started, when it should be back (with a live
 * countdown) and which parts are affected, in a status list they can filter. A "tell me when it's back" form keeps
 * the email in local storage instead of sending it. Use it as the page shown during a planned outage. Make it the
 * app's own: replace SAMPLE with the real window and the app's real services.
 * This is b.page-state.maintenance: the implementation lives in page-not-found.tsx; this file only holds the content.
 */
import { PageState } from "./page-not-found";

// flowcode:sample
const SAMPLE = {
  title: "We're tidying up the booking system",
  text: "Planned maintenance tonight while the studio is closed. Classes already booked are not affected.",
  startedMinutesAgo: 25,
  backInMinutes: 95,
  services: [
    { name: "Class bookings", detail: "New bookings and changes", state: "maintenance" },
    { name: "Payments", detail: "Card payments and gift cards", state: "maintenance" },
    { name: "Member accounts", detail: "Sign in and profile", state: "down" },
    { name: "Timetable", detail: "Read-only, still visible", state: "up" },
    { name: "Studio phone line", detail: "Open until 9 pm", state: "up" },
  ],
  stateLabels: { up: "Working", maintenance: "In maintenance", down: "Unavailable" },
  storageKey: "studio-maintenance-notify",
};

export default function PageMaintenance() {
  return <PageState variant="maintenance" {...SAMPLE} />;
}
