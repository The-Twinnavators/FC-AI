/** @flowcode-library page-server-error · Server error (500) (Alerts and states)
 * Catalog ID: b.page-state.server-error (block)
 * Function: Server error (500) page (b.page-state.server-error): a thin wrapper that passes its own content to PageState.
 * Use it as: A ready-to-place b.page-state.server-error: copy page-server-error.tsx and replace SAMPLE (FlowCode brings the implementation file with it).
 * Built from: b.page-state.server-error
 * Look: something broke on our side: server illustration, Try again with progress, a copyable reference code and a support link
 * Use cases: server error; 500 page; error page; something went wrong; error boundary; service failure; crash screen
 * Jobs to be done: try again after something broke; report a problem to support; understand what went wrong; get back to what i was doing
 * Keywords: error, 500, server error, retry, page
 */
/**
 * Server error (500): something broke on our side. A small server illustration, an honest message, a retry button
 * that shows a "trying again" state, a reference code people can copy for support, and a support link. The retry is
 * simulated (the first try still fails, the next one works) so every state can be seen. Use it as the app's error
 * boundary or 5xx page. Make it the app's own: replace SAMPLE, and point retry at the request that failed.
 * This is b.page-state.server-error: the implementation lives in page-not-found.tsx; this file only holds the content.
 */
import { PageState } from "./page-not-found";

// flowcode:sample
const SAMPLE = {
  code: "500",
  title: "Something went wrong on our side",
  text: "Your booking details are safe. Our server tripped over this request; trying again usually fixes it.",
  reference: "ERR-7F3A-2291",
  supportHref: "#support",
  supportLabel: "Contact the studio team",
  homeHref: "#home",
  succeedOnAttempt: 2,
};

export default function PageServerError() {
  return <PageState variant="server-error" {...SAMPLE} />;
}
