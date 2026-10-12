/** @flowcode-library page-offline · Offline (Alerts and states)
 * Catalog ID: b.page-state.offline (block)
 * Function: Offline page (b.page-state.offline): a thin wrapper that passes its own content to PageState.
 * Use it as: A ready-to-place b.page-state.offline: copy page-offline.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: b.page-state.offline
 * Look: no connection: what still works and what waits, changes saved on the device, and a retry that checks the connection
 * Use cases: offline mode; no connection; offline screen; connection lost; offline-first app; sync pending; network error
 * Jobs to be done: keep working without internet; know my changes are saved; reconnect when the network returns; see what still works offline
 * Keywords: offline, connection, retry, error, page
 */
/**
 * Offline: shown when the device loses its connection. Says so plainly, lists what still works and what has to wait,
 * shows changes saved on this device until the connection returns, and offers a retry that really checks the
 * browser's connection (and notices on its own when it comes back). Use it as the app's offline screen or banner
 * page. Make it the app's own: replace SAMPLE with what the app can genuinely do offline and its own waiting changes.
 * This is b.page-state.offline: the implementation lives in page-not-found.tsx; this file only holds the content.
 */
import { PageState } from "./page-not-found";

// flowcode:sample
const SAMPLE = {
  title: "You're offline",
  text: "Check your Wi-Fi or mobile data. You can keep using the parts of the app below; we'll catch up when you're back.",
  works: ["See this week's timetable", "Open your saved class tickets", "Read studio guides you've opened before"],
  waits: ["Booking or cancelling a class", "Paying or buying a gift card", "Messaging the studio"],
  queued: [
    { label: "Note for Thursday's wheel class", when: "Saved 4 min ago" },
    { label: "Kiln shelf request", when: "Saved 12 min ago" },
  ],
  homeHref: "#home",
};

export default function PageOffline() {
  return <PageState variant="offline" {...SAMPLE} />;
}
