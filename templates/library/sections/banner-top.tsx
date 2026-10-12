/** @flowcode-library banner-top · Top announcement banner (announcement strip) (Alerts and states)
 * Catalog ID: c.alert@announcement (component version)
 * Version of: c.alert
 * Function: Full-width announcement bar at the top of a page with a link and a dismiss button that remembers the dismissal.
 * Use it as: import { Alert } from "./alerts-states"; <Alert version="announcement" rememberKey="banner-autumn-term" restoreLabel? tag="New" title="Autumn term bookings are open." action={<a href="#timetable">See the timetable</a>}>more words?</Alert>
 * Look: A full-width accent strip across the top of a page with a small pill tag, one centered message, a link and a dismiss x; once closed it stays closed on that device.
 * Tokens: --color-secondary --color-accent --color-on-secondary --color-on-accent --radius-sm --space-1 --space-2 --space-3 --space-4 --weight-semibold --focus-ring
 * Use cases: announcement bar; promo banner; new feature announcement; maintenance notice; sale announcement; cookie or policy notice; event promotion
 * Jobs to be done: hear about what's new; find out about a sale or offer; learn about planned downtime; hide a notice i've seen
 * Keywords: banner, announcement, notice, dismissible
 */
/**
 * Top banner: a full-width announcement across the top of a page, with one link and a dismiss button. Once someone
 * closes it, it stays closed on that device (remembered in local storage). This is c.alert@announcement with this
 * piece's sample content; the implementation lives in the component, in ./alerts-states. Make it the app's own:
 * replace SAMPLE; change `storageKey` whenever the message changes so everyone sees the new one.
 */
import { Alert } from "./alerts-states";

// flowcode:sample
const SAMPLE = {
  storageKey: "banner-autumn-term-dismissed",
  tag: "New",
  message: "Autumn term bookings are open: weekly pottery, life drawing and printmaking.",
  link: { label: "See the timetable", href: "#timetable" },
  page: {
    title: "Welcome back to the studio",
    text: "This is the page under the banner. Close the banner and reload: it stays closed on this device.",
    reset: "Show the banner again",
  },
};

export default function BannerTop() {
  const d = SAMPLE;
  return (
    <div>
      <Alert version="announcement" rememberKey={d.storageKey} restoreLabel={d.page.reset} tag={d.tag} title={d.message} action={<a href={d.link.href}>{d.link.label} &rarr;</a>} />
      <div className="fl-alr-page">
        <div className="fl-wrap fl-wrap--narrow fl-head" style={{ marginBottom: 0 }}>
          <h2 className="fl-title fl-title--md">{d.page.title}</h2>
          <p className="fl-text">{d.page.text}</p>
        </div>
      </div>
    </div>
  );
}
