/** @flowcode-library table-plan-compare · Plan comparison (Tables and lists)
 * Catalog ID: p.plan-comparison (pattern)
 * Function: The plan comparison table (p.plan-comparison): plans side by side with features grouped under headings, each feature row opening to show its details under its name, and the most-chosen plan marked.
 * Use it as: import { PlanComparison } from "./table-plan-compare"; <PlanComparison title lede? featuresLabel? plans={[{ id, name, price, per?, note?, pick?: "Most chosen", cta: { label, href } }]} groups={[{ id, label, features: [{ id, label, detail?, values: { [planId]: true | false | "text" } }] }]} defaultOpen?={[featureId]} showAllLabel? hideAllLabel? />
 * Built from: c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: Plans across the top with name, price, note and a button; features down the side under plain group headings, every one listed; a feature row opens (its name is the button, with a turning chevron) to show that feature's details under its name, and Show all details opens them all; ticks, dashes or values in each cell; the most-chosen plan is tinted down its column; feature names stay put while the plans scroll sideways on a phone.
 * Tokens: --surface-bg --surface-border --surface-radius --surface-shadow --color-surface --color-surface-sunken --color-secondary-surface --color-border --color-border-strong --color-accent --color-success --color-text-muted --space-1 --space-2 --space-3 --space-4 --text-xs --text-sm --text-2xl --focus-ring
 * Use cases: pricing page; plan comparison; compare tiers; subscription plans; feature matrix; upgrade page
 * Jobs to be done: compare plans before I choose; see what each plan includes; find the details behind a feature
 * Keywords: table, pricing, comparison, plans, expand, features
 */
/**
 * Plan comparison: p.plan-comparison, a table of plans across the top and features down the side under group
 * headings. Every feature is always listed; a feature row opens (press its name) to show the details of that feature
 * under its name, and "Show all details" opens every one. The plan people pick most is marked and tinted down its
 * column. On a phone the table scrolls sideways with the feature names held in place.
 * Make it the app's own: replace SAMPLE with the real plans, prices and features, and point each plan's button at the
 * app's own sign-up or checkout step.
 */
import { useId, useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

type Cell = boolean | string;
export type PlanComparisonProps = {
  title: string;
  lede?: string;
  /** The column heading over the feature names. */
  featuresLabel?: string;
  plans: { id: string; name: string; price: string; per?: string; note?: string; pick?: string; cta: { label: string; href: string } }[];
  /** Group headings with their features. true is a tick (included), false a dash (not included), text shows as it is.
   * A feature with a detail opens to show it under its name. */
  groups: { id: string; label: string; features: { id: string; label: string; detail?: string; values: Record<string, Cell> }[] }[];
  /** Features open at first (their ids); none when left out. */
  defaultOpen?: string[];
  showAllLabel?: string;
  hideAllLabel?: string;
};

// flowcode:sample
const SAMPLE: PlanComparisonProps = {
  title: "Compare plans",
  lede: "Every plan includes online booking and a free trial week. Open a feature to see how it works on each plan.",
  featuresLabel: "Features",
  plans: [
    { id: "solo", name: "Solo", price: "$12", per: "/month", note: "One teacher", cta: { label: "Start with Solo", href: "#solo" } },
    { id: "studio", name: "Studio", price: "$39", per: "/month", note: "Up to 8 teachers", pick: "Most chosen", cta: { label: "Start with Studio", href: "#studio" } },
    { id: "school", name: "School", price: "$99", per: "/month", note: "Unlimited teachers", cta: { label: "Talk to us", href: "#school" } },
  ],
  groups: [
    {
      id: "booking",
      label: "Booking",
      features: [
        { id: "classes", label: "Classes on the timetable", detail: "Classes you can list at once. Past classes don't count, and a repeating class counts once.", values: { solo: "20", studio: "Unlimited", school: "Unlimited" } },
        { id: "waitlist", label: "Waiting list", detail: "When a place opens, the first person waiting is offered it by email and has two hours to take it.", values: { solo: false, studio: true, school: true } },
        { id: "packs", label: "Class packs and passes", detail: "Sell a pack of 5 or 10 classes, or a monthly pass. Each booking takes one class from the pack.", values: { solo: false, studio: true, school: true } },
        { id: "reminders", label: "Reminder emails", detail: "Sent the day before and an hour before each class, with a link to cancel.", values: { solo: true, studio: true, school: true } },
      ],
    },
    {
      id: "payments",
      label: "Payments",
      features: [
        { id: "cards", label: "Card payments", detail: "Visa, Mastercard and Amex, paid at booking. Money reaches your bank in two working days.", values: { solo: true, studio: true, school: true } },
        { id: "fee", label: "Fee per booking", detail: "On top of the card processor's own fee. Cash and bank transfers have no fee.", values: { solo: "2%", studio: "1%", school: "None" } },
        { id: "refunds", label: "Refunds from the timetable", detail: "Refund a booking in full or in part from the class itself; the person is emailed when it is sent.", values: { solo: false, studio: true, school: true } },
      ],
    },
    {
      id: "team",
      label: "Team and support",
      features: [
        { id: "teachers", label: "Teacher accounts", detail: "Each teacher signs in with their own email and sees their own classes first.", values: { solo: "1", studio: "8", school: "Unlimited" } },
        { id: "roles", label: "Roles and permissions", detail: "Decide who can edit the timetable, take payments or see the books.", values: { solo: false, studio: false, school: true } },
        { id: "support", label: "Support", detail: "Email replies within a working day; chat on weekdays 9 to 5; a named contact who knows your studio.", values: { solo: "Email", studio: "Email and chat", school: "Named contact" } },
      ],
    },
  ],
  showAllLabel: "Show all details",
  hideAllLabel: "Hide all details",
};

function Value({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="fl-plan-yes">
        <Icon name="check" />
        <span className="fl-sr">Included</span>
      </span>
    );
  if (v === false)
    return (
      <span className="fl-plan-no">
        <span aria-hidden="true">—</span>
        <span className="fl-sr">Not included</span>
      </span>
    );
  return <span>{v}</span>;
}

export function PlanComparison({ title, lede, featuresLabel = "Features", plans, groups, defaultOpen = [], showAllLabel = "Show all details", hideAllLabel = "Hide all details" }: PlanComparisonProps) {
  const uid = useId();
  const [open, setOpen] = useState<string[]>(defaultOpen);
  const withDetail = groups.flatMap((g) => g.features.filter((f) => f.detail).map((f) => f.id));
  const allOpen = withDetail.length > 0 && withDetail.every((id) => open.includes(id));
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const cols = plans.length + 1;
  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap">
        <div className="fl-plan">
          <div className="fl-plan-top">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <h2 id={`${uid}-title`} className="fl-title fl-title--md">
                {title}
              </h2>
              {lede ? <p className="fl-text">{lede}</p> : null}
            </div>
            {withDetail.length ? (
              <Button variant="tertiary" size={32} onClick={() => setOpen(allOpen ? [] : withDetail)} aria-pressed={allOpen}>
                {allOpen ? hideAllLabel : showAllLabel}
              </Button>
            ) : null}
          </div>
          <div className="fl-plan-scroll" role="region" aria-labelledby={`${uid}-title`} tabIndex={0}>
            <table className="fl-plan-table">
              <thead>
                <tr>
                  <th scope="col" className="fl-plan-feat-head">
                    {featuresLabel}
                  </th>
                  {plans.map((p) => (
                    <th key={p.id} scope="col" className={p.pick ? "fl-plan-col is-pick" : "fl-plan-col"}>
                      <span className="fl-plan-name">
                        {p.name}
                        {p.pick ? <Badge tone="info">{p.pick}</Badge> : null}
                      </span>
                      <span className="fl-plan-price">
                        <strong>{p.price}</strong>
                        {p.per ? <span>{p.per}</span> : null}
                      </span>
                      {p.note ? <span className="fl-plan-note">{p.note}</span> : null}
                      <Button variant={p.pick ? "primary" : "secondary"} size={32} href={p.cta.href} block>
                        {p.cta.label}
                      </Button>
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.id}>
                  <tr className="fl-plan-group">
                    <th scope="colgroup" colSpan={cols}>
                      {g.label}
                    </th>
                  </tr>
                  {g.features.map((f) => {
                    const shown = open.includes(f.id);
                    const detailId = `${uid}-${f.id}`;
                    return (
                      <tr key={f.id} className={shown ? "fl-plan-row is-open" : "fl-plan-row"}>
                        <th scope="row" className="fl-plan-feat">
                          {f.detail ? (
                            <button type="button" className="fl-plan-feat-btn" aria-expanded={shown} aria-controls={detailId} onClick={() => toggle(f.id)}>
                              <span className="fl-plan-caret" aria-hidden="true">
                                <Icon name="chevron-right" />
                              </span>
                              {f.label}
                            </button>
                          ) : (
                            <span className="fl-plan-feat-text">{f.label}</span>
                          )}
                          {f.detail ? (
                            <span id={detailId} className="fl-plan-detail" hidden={!shown}>
                              {f.detail}
                            </span>
                          ) : null}
                        </th>
                        {plans.map((p) => (
                          <td key={p.id} className={p.pick ? "fl-plan-col is-pick" : "fl-plan-col"}>
                            <Value v={f.values[p.id] ?? false} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TablePlanCompare() {
  return <PlanComparison {...SAMPLE} />;
}
