/** @flowcode-library plans-accordion · Compare plans, phone-friendly (Pricing)
 * Catalog ID: b.plans-accordion (block)
 * Function: The phone-friendly plan comparison block (b.plans-accordion): pick any two plans side by side, swap them, and read the features in folding groups that count how many rows differ, with an Only differences switch.
 * Use it as: import { PlansAccordion } from "./plans-accordion"; <PlansAccordion label="Compare plans" plans={[{ id, name, price, period?, note?, cta?: { label, href?, onClick? } }]} groups={[{ id, label, rows: [{ id, label, hint?, values: { planId: true | false | "10 GB" } }] }]} compare?={["a", "b"]} open?={["groupId"]} labels?={{ plan, swap, differences, expand, collapse, differ, same, included, missing }} onChange?={([a, b]) => ...} />  // use only plans and limits the PRD supplies
 * Built from: c.select, c.switch, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: A white card that sticks to the top while you scroll, split in two: each half has a plan dropdown, a large price with a muted period, a short note and a button; a round Swap button sits between them. Under it a quiet row with an Only differences switch and Expand all. Then groups as bordered white rows with a bold name, a small "3 differ" pill and a chevron; inside, each feature is a row with its name and muted hint on the left and two cells, a green tick, a gray dash or a short value, with rows that differ on a faint accent tint.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-xl --font-display --weight-semibold --weight-bold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: pricing page; compare plans; plan comparison on mobile; upgrade page; feature comparison; tiers
 * Jobs to be done: see what I get if I upgrade; compare two plans on my phone; find only what's different; pick a plan and start
 * Keywords: compare plans, pricing, plan comparison, feature matrix, accordion, mobile, differences, upgrade, tiers
 */
/**
 * Compare plans, phone-friendly: a feature matrix that doesn't need a wide screen. Rather than every plan in a table
 * you scroll sideways, you compare any two, chosen in the sticky head and swapped with one press. Groups fold (buttons
 * with aria-expanded; closed groups are inert) and each says how many of its rows differ, so you can open only what
 * matters; Only differences hides the rows that match and says so when a whole group matches. Ticks and dashes carry a
 * spoken "Included" or "Not included". Make it the app's own: replace SAMPLE with the real plans and limits.
 * Adapted from AstroWind (MIT, Copyright (c) 2023 onWidget): its pricing page comparison widget.
 */
/**
 * How to try it
 * - Change either dropdown in the head: the two columns and their prices change, and the difference counts update.
 * - Press Swap: the plans trade sides.
 * - Turn on Only differences: matching rows fold away; a group with none left says the plans match there.
 * - Press a group's name, or Expand all and Collapse all; Tab through and watch the focus rings.
 * - Scroll down on a phone: the head stays on top so you always know which column is which.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's Select, Switch and Button
 * ("./dropdowns-states", "./switches-states", "./buttons-variants") and its inline icon set ("./icons"). Nothing else:
 * no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r4c-plans-accordion.css.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Switch } from "./switches-states";

export type ComparePlan = {
  id: string;
  name: string;
  price: string;
  period?: string;
  note?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
};
export type CompareValue = boolean | string;
export type CompareGroup = {
  id: string;
  label: string;
  rows: Array<{
    id: string;
    label: string;
    hint?: string;
    values: Record<string, CompareValue | undefined>;
  }>;
};

export type PlansAccordionProps = {
  label: string;
  plans: ComparePlan[];
  groups: CompareGroup[];
  compare?: [string, string];
  /** Groups open at first; the first one when left out. */
  open?: string[];
  labels?: Partial<{
    plan: string;
    swap: string;
    differences: string;
    expand: string;
    collapse: string;
    differ: string;
    same: string;
    included: string;
    missing: string;
    feature: string;
  }>;
  onChange?: (pair: [string, string]) => void;
};

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: plays now when already on screen, else on view, and never later than 1.2s. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    const box = el.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
    };
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && show(),
      { threshold: 0.1 },
    );
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

const same = (a: CompareValue | undefined, b: CompareValue | undefined) =>
  (a ?? false) === (b ?? false);

export function PlansAccordion({
  label,
  plans,
  groups,
  compare,
  open: openAtFirst,
  labels = {},
  onChange,
}: PlansAccordionProps) {
  const uid = useId();
  const L = {
    plan: labels.plan ?? "Plan",
    swap: labels.swap ?? "Swap plans",
    differences: labels.differences ?? "Only differences",
    expand: labels.expand ?? "Expand all",
    collapse: labels.collapse ?? "Collapse all",
    differ: labels.differ ?? "differ",
    same: labels.same ?? "Both plans match here.",
    included: labels.included ?? "Included",
    missing: labels.missing ?? "Not included",
    feature: labels.feature ?? "Feature",
  };
  const [pair, setPair] = useState<[string, string]>(
    compare ?? [plans[0]?.id ?? "", plans[1]?.id ?? plans[0]?.id ?? ""],
  );
  const [open, setOpen] = useState<string[]>(
    openAtFirst ?? (groups[0] ? [groups[0].id] : []),
  );
  const [diffOnly, setDiffOnly] = useState(false);
  const [said, setSaid] = useState("");
  const [root, enter] = useEnterOnce<HTMLDivElement>();

  const plan = (id: string) => plans.find((p) => p.id === id);
  const choose = (side: 0 | 1, id: string) => {
    const next: [string, string] = side === 0 ? [id, pair[1]] : [pair[0], id];
    setPair(next);
    onChange?.(next);
    setSaid(`${plan(next[0])?.name} and ${plan(next[1])?.name}.`);
  };
  const swap = () => {
    const next: [string, string] = [pair[1], pair[0]];
    setPair(next);
    onChange?.(next);
    setSaid(`${plan(next[0])?.name} and ${plan(next[1])?.name}.`);
  };
  const diffs = (g: CompareGroup) =>
    g.rows.filter((r) => !same(r.values[pair[0]], r.values[pair[1]])).length;
  const total = groups.reduce((n, g) => n + diffs(g), 0);
  const allOpen = open.length === groups.length;

  const cell = (v: CompareValue | undefined) =>
    v === true ? (
      <span className="fl-pac-yes">
        <Icon name="check" />
        <span className="fl-sr">{L.included}</span>
      </span>
    ) : v === false || v === undefined ? (
      <span className="fl-pac-no">
        <span aria-hidden="true" className="fl-pac-dash" />
        <span className="fl-sr">{L.missing}</span>
      </span>
    ) : (
      <span className="fl-pac-text">{v}</span>
    );

  const cls = [
    "fl-pac",
    enter === "wait" ? "is-waiting" : "",
    enter === "in" ? "is-entering" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={root} className={cls} data-fl="b.plans-accordion">
      <div
        className="fl-pac-head fl-pac-rise"
        style={{ "--i": 0 } as CSSProperties}
        role="group"
        aria-label={label}
      >
        {[0, 1].map((side) => {
          const p = plan(pair[side as 0 | 1]);
          return (
            <div key={side} className="fl-pac-plan">
              <label className="fl-sr" htmlFor={`${uid}-p${side}`}>
                {L.plan} {side + 1}
              </label>
              <Select
                id={`${uid}-p${side}`}
                options={plans.map((x) => ({ value: x.id, label: x.name }))}
                value={pair[side as 0 | 1]}
                onChange={(e) => choose(side as 0 | 1, e.target.value)}
              />
              {p ? (
                <div key={p.id} className="fl-pac-price">
                  <strong>{p.price}</strong>
                  {p.period ? <span>{p.period}</span> : null}
                </div>
              ) : null}
              {p?.note ? <p className="fl-pac-note">{p.note}</p> : null}
              {p?.cta ? (
                p.cta.href ? (
                  <Button
                    href={p.cta.href}
                    variant={side === 1 ? "primary" : "secondary"}
                    size={40}
                    block
                  >
                    {p.cta.label}
                  </Button>
                ) : (
                  <Button
                    variant={side === 1 ? "primary" : "secondary"}
                    size={40}
                    block
                    onClick={p.cta.onClick}
                  >
                    {p.cta.label}
                  </Button>
                )
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          className="fl-pac-swap"
          onClick={swap}
          aria-label={L.swap}
          title={L.swap}
        >
          <Icon name="refresh" />
        </button>
      </div>

      <div
        className="fl-pac-tools fl-pac-rise"
        style={{ "--i": 1 } as CSSProperties}
      >
        <label className="fl-pac-switch">
          <Switch
            on={diffOnly}
            label={L.differences}
            size={20}
            onToggle={setDiffOnly}
          />
          <span aria-hidden="true">{L.differences}</span>
          <span className="fl-pac-total">{total}</span>
        </label>
        <Button
          variant="tertiary"
          size={32}
          icon={allOpen ? "chevron-down" : "plus"}
          onClick={() => setOpen(allOpen ? [] : groups.map((g) => g.id))}
        >
          {allOpen ? L.collapse : L.expand}
        </Button>
      </div>

      <div className="fl-pac-groups">
        {groups.map((g, gi) => {
          const isOpen = open.includes(g.id);
          const n = diffs(g);
          const rows = diffOnly
            ? g.rows.filter((r) => !same(r.values[pair[0]], r.values[pair[1]]))
            : g.rows;
          return (
            <section
              key={g.id}
              className={
                isOpen
                  ? "fl-pac-group is-open fl-pac-rise"
                  : "fl-pac-group fl-pac-rise"
              }
              style={{ "--i": gi + 2 } as CSSProperties}
            >
              <h3 className="fl-pac-gh">
                <button
                  type="button"
                  className="fl-pac-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`${uid}-g-${g.id}`}
                  onClick={() =>
                    setOpen((o) =>
                      isOpen ? o.filter((x) => x !== g.id) : [...o, g.id],
                    )
                  }
                >
                  <span className="fl-pac-gname">{g.label}</span>
                  <span className={n ? "fl-pac-pill is-diff" : "fl-pac-pill"}>
                    {n} {L.differ}
                  </span>
                  <Icon name="chevron-down" />
                </button>
              </h3>
              <div
                id={`${uid}-g-${g.id}`}
                className="fl-pac-body"
                inert={!isOpen}
              >
                <div>
                  {rows.length ? (
                    <table className="fl-pac-table">
                      <caption className="fl-sr">
                        {g.label}: {plan(pair[0])?.name} and{" "}
                        {plan(pair[1])?.name}
                      </caption>
                      <thead className="fl-sr">
                        <tr>
                          <th scope="col">{L.feature}</th>
                          <th scope="col">{plan(pair[0])?.name}</th>
                          <th scope="col">{plan(pair[1])?.name}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const a = r.values[pair[0]];
                          const b = r.values[pair[1]];
                          return (
                            <tr
                              key={r.id}
                              className={
                                same(a, b) ? "fl-pac-row" : "fl-pac-row is-diff"
                              }
                            >
                              <th scope="row">
                                {r.label}
                                {r.hint ? <span>{r.hint}</span> : null}
                              </th>
                              <td>{cell(a)}</td>
                              <td>{cell(b)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="fl-pac-same">
                      <Icon name="check" />
                      {L.same}
                    </p>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Compare plans",
  title: "Find the plan that fits",
  lede: "Pick two plans and see exactly what changes.",
  plans: [
    {
      id: "solo",
      name: "Solo",
      price: "$19",
      period: "/ month",
      note: "One person, one calendar.",
      cta: { label: "Start Solo", href: "#start-solo" },
    },
    {
      id: "studio",
      name: "Studio",
      price: "$49",
      period: "/ month",
      note: "Up to 10 staff. Most popular.",
      cta: { label: "Start Studio", href: "#start-studio" },
    },
    {
      id: "multi",
      name: "Multi-site",
      price: "$129",
      period: "/ month",
      note: "Several locations, one account.",
      cta: { label: "Start Multi-site", href: "#start-multi" },
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      note: "Chains and franchises.",
      cta: { label: "Talk to sales", href: "#sales" },
    },
  ],
  groups: [
    {
      id: "booking",
      label: "Booking",
      rows: [
        {
          id: "online",
          label: "Online booking page",
          values: { solo: true, studio: true, multi: true, enterprise: true },
        },
        {
          id: "staff",
          label: "Staff calendars",
          values: {
            solo: "1",
            studio: "10",
            multi: "50",
            enterprise: "Unlimited",
          },
        },
        {
          id: "wait",
          label: "Waitlists",
          hint: "Offer freed-up slots automatically",
          values: { solo: false, studio: true, multi: true, enterprise: true },
        },
        {
          id: "groups",
          label: "Group classes",
          values: { solo: false, studio: true, multi: true, enterprise: true },
        },
      ],
    },
    {
      id: "payments",
      label: "Payments",
      rows: [
        {
          id: "cards",
          label: "Card payments",
          values: { solo: true, studio: true, multi: true, enterprise: true },
        },
        {
          id: "deposits",
          label: "Deposits and no-show fees",
          values: { solo: true, studio: true, multi: true, enterprise: true },
        },
        {
          id: "fee",
          label: "Processing fee",
          values: {
            solo: "2.9%",
            studio: "2.6%",
            multi: "2.4%",
            enterprise: "Custom",
          },
        },
        {
          id: "packages",
          label: "Visit packages",
          values: { solo: false, studio: true, multi: true, enterprise: true },
        },
      ],
    },
    {
      id: "messages",
      label: "Reminders",
      rows: [
        {
          id: "email",
          label: "Email reminders",
          values: { solo: true, studio: true, multi: true, enterprise: true },
        },
        {
          id: "sms",
          label: "Text reminders",
          hint: "A month's worth included",
          values: {
            solo: "100",
            studio: "1,000",
            multi: "5,000",
            enterprise: "Unlimited",
          },
        },
      ],
    },
    {
      id: "support",
      label: "Support",
      rows: [
        {
          id: "help",
          label: "Help center and email",
          values: { solo: true, studio: true, multi: true, enterprise: true },
        },
        {
          id: "phone",
          label: "Phone support",
          values: { solo: false, studio: false, multi: true, enterprise: true },
        },
        {
          id: "manager",
          label: "Account manager",
          values: {
            solo: false,
            studio: false,
            multi: false,
            enterprise: true,
          },
        },
      ],
    },
  ],
};

export default function PlansAccordionPreview() {
  const d = SAMPLE;
  return (
    <section
      className="fl-section fl-section--canvas"
      aria-labelledby="plans-accordion-title"
    >
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="plans-accordion-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <PlansAccordion
          label={d.eyebrow}
          plans={d.plans}
          groups={d.groups}
          compare={["solo", "studio"]}
        />
      </div>
    </section>
  );
}
