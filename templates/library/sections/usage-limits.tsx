/** @flowcode-library usage-limits · Usage and plan limits (Charts and data)
 * Catalog ID: p.usage-limits (pattern)
 * Function: Usage and plan limits (p.usage-limits): the current plan with when usage resets, a meter per limit (used of allowed, what's left, unlimited shown as such) that turns amber near the limit and red when full, a warning that names the limits that are close or full (dismissable), Raise limit on each one, an email-me-near-the-limit switch, Refresh with loading and a load error with Retry; Compare plans opens a dialog with Monthly / Yearly, the plans as choices with their price and limits, and what changes for each limit; switching down below current usage is blocked with the reason; the switch confirms, the meters move to the new limits and it's announced. No payment is taken here.
 * Use it as: import { UsageLimits } from "./usage-limits"; <UsageLimits title lede? plan="starter" plans={[{ id, name, monthly, yearly, limits: { meterId: number | null (unlimited) }, note? }]} meters={[{ id, label, unit? }]} usage?={{ meterId: number }} load?={async () => usage} resetsOn="2026-11-01" warnAt?={0.8} changePlan?={async (planId, period) => void} onAlertChange?={(on) => ...} labels? />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.switch, c.modal.form, c.badge.status
 * Look: A white card: the title with the plan as a tag and the reset date, Compare plans on the right; an amber or red warning strip that names the limits; a grid of small sunken meter cards (label, "8 of 10", a thick rounded bar in accent / amber / red that fills in, what's left, Raise limit when close); a row with the email switch and Refresh. The dialog shows a Monthly / Yearly switch with a sliding thumb, three plan rows with a radio dot, price and limits, and a What changes table with arrows.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: usage limits; plan limits; quota meter; upgrade prompt; billing usage; seats and storage; AI credits
 * Jobs to be done: see how much of my plan I've used; know before I hit a limit; compare what a bigger plan would give me; switch plans without leaving the screen; get an email before I run out
 * Keywords: usage, limits, quota, meter, plan, upgrade, downgrade, compare plans, seats, storage, credits, warning
 */
/**
 * Usage limits: each limit is a meter (role="meter" with its numbers). A limit counts as close at warnAt (80% unless
 * given) and full at 100%. Raise limit opens the dialog with the smallest plan that lifts that limit already chosen.
 * The dialog is the library's form modal: plan choices are native radios (arrow keys), and a plan whose limits are
 * below current usage can't be confirmed (the reason is shown and focused). changePlan does the switch; while it runs
 * the dialog is busy, and a failure keeps it open with the reason. Nothing here asks for card details: the person
 * confirms the switch, and billing happens wherever the app already handles it.
 * Meters fill from empty when they first show and glide to new values; the warning folds away (inert when folded);
 * the period thumb slides; ticks pop on the chosen plan. With motion off everything simply shows.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its progress, dialog and radio components, and HyperUI
 * (MIT, Copyright (c) Mark Mead): its progress bars, alerts and pricing components.
 */
/**
 * How to try it
 * - Wait for the meters to fill. Storage is amber (close) and Members red (full); the warning names both.
 * - Press Raise limit on Members: the dialog opens with Team chosen and shows Members 3 → 15.
 * - Switch to Yearly: the thumb slides and the prices change. Choose Free: it says why you can't (8 projects).
 * - Choose Team and press Switch to Team: it works for a moment, closes, and the meters glide to the new limits.
 * - Close the warning with its X. Turn on the email switch. Press Refresh: the meters load again.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Button, Switch, Modal and
 * Badge ("./buttons-variants", "./switches-states", "./modals-dialogs", "./badges-status") and its inline icon set
 * ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r6b-usage-limits.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Switch } from "./switches-states";

// ── p.usage-limits: plan meters, near-limit warnings and a compare-and-switch dialog. ──

export type UsageMeter = { id: string; label: string; unit?: string };
export type UsagePlan = { id: string; name: string; monthly: number; yearly: number; limits: Record<string, number | null>; note?: string };
export type Period = "monthly" | "yearly";

export type UsageLimitsLabels = Partial<{
  plan: string;
  resets: string;
  compare: string;
  of: string;
  left: string;
  none: string;
  unlimited: string;
  raise: string;
  close: string;
  full: string;
  warnClose: string;
  warnFull: string;
  dismiss: string;
  alerts: string;
  refresh: string;
  loading: string;
  loadFailed: string;
  retry: string;
  dialogTitle: string;
  dialogText: string;
  monthly: string;
  yearly: string;
  perMonth: string;
  perYear: string;
  current: string;
  changes: string;
  switchTo: string;
  switching: string;
  already: string;
  tooSmall: string;
  failed: string;
  switched: string;
}>;

export type UsageLimitsProps = {
  title: string;
  lede?: string;
  /** The current plan's id. */
  plan: string;
  plans: UsagePlan[];
  meters: UsageMeter[];
  /** Used amounts by meter id. Ignored while `load` is given. */
  usage?: Record<string, number>;
  load?: () => Promise<Record<string, number>>;
  /** ISO date when usage starts again. */
  resetsOn?: string;
  /** Share of a limit that counts as close; 0.8 when left out. */
  warnAt?: number;
  /** Does the switch; a rejection keeps the dialog open with the reason. */
  changePlan?: (planId: string, period: Period) => Promise<void>;
  alertsOn?: boolean;
  onAlertChange?: (on: boolean) => void;
  labels?: UsageLimitsLabels;
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fmtNum = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** A two-option switch whose thumb slides to the chosen option (native radios: arrow keys move it). */
function PeriodSwitch({ value, onChange, labels, name }: { value: Period; onChange: (v: Period) => void; labels: Record<Period, string>; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => {
    const el = box.current?.querySelector<HTMLElement>("label:has(input:checked)");
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value]);
  return (
    <div className="fl-uplim-period" role="radiogroup" aria-label="Billing period" ref={box} style={{ ["--ind-x" as string]: `${ind.x}px`, ["--ind-w" as string]: `${ind.w}px` }}>
      <i aria-hidden="true" />
      {(["monthly", "yearly"] as const).map((p) => (
        <label key={p}>
          <input type="radio" name={name} value={p} checked={value === p} onChange={() => onChange(p)} />
          {labels[p]}
        </label>
      ))}
    </div>
  );
}

export function UsageLimits({ title, lede, plan: initialPlan, plans, meters, usage: initialUsage = {}, load, resetsOn, warnAt = 0.8, changePlan, alertsOn = false, onAlertChange, labels = {} }: UsageLimitsProps) {
  const l = {
    plan: "{name} plan",
    resets: "Resets {date}",
    compare: "Compare plans",
    of: "{used} of {limit}",
    left: "{n} left",
    none: "None left",
    unlimited: "Unlimited",
    raise: "Raise limit",
    close: "Close to the limit",
    full: "Full",
    warnClose: "You're close to the limit on {list}.",
    warnFull: "You've reached the limit on {list}.",
    dismiss: "Dismiss",
    alerts: "Email me at 90% of a limit",
    refresh: "Refresh",
    loading: "Loading usage…",
    loadFailed: "Couldn't load your usage.",
    retry: "Retry",
    dialogTitle: "Compare plans",
    dialogText: "Your new limits start right away. You'll see the new price on your next invoice.",
    monthly: "Monthly",
    yearly: "Yearly",
    perMonth: "/mo",
    perYear: "/yr",
    current: "Current",
    changes: "What changes",
    switchTo: "Switch to {name}",
    switching: "Switching…",
    already: "You're already on {name}.",
    tooSmall: "{name} allows {limit} {label}; you use {used}. Remove some first or choose a bigger plan.",
    failed: "Couldn't switch plans. Try again.",
    switched: "You're on {name} now. New limits apply.",
    ...labels,
  };
  const id = useId();
  const [planId, setPlanId] = useState(initialPlan);
  const [usage, setUsage] = useState<Record<string, number>>(load ? {} : initialUsage);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(load ? "loading" : "ready");
  const [warnHidden, setWarnHidden] = useState(false);
  const [alerts, setAlerts] = useState(alertsOn);
  const [dlg, setDlg] = useState<{ pick: string; period: Period; error: string; busy: boolean } | null>(null);
  const [said, setSaid] = useState("");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const fetchUsage = () => {
    if (!load) return;
    setPhase("loading");
    load()
      .then((u) => {
        setUsage(u);
        setPhase("ready");
        setSaid("");
      })
      .catch(() => setPhase("error"));
  };
  useEffect(fetchUsage, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const ratio = (m: UsageMeter, p = plan) => {
    const limit = p.limits[m.id];
    if (limit === null || limit === undefined) return 0;
    return limit <= 0 ? 1 : (usage[m.id] ?? 0) / limit;
  };
  const state = (m: UsageMeter) => (ratio(m) >= 1 ? "full" : ratio(m) >= warnAt ? "close" : "ok");
  const full = phase === "ready" ? meters.filter((m) => state(m) === "full") : [];
  const close = phase === "ready" ? meters.filter((m) => state(m) === "close") : [];
  const listNames = (ms: UsageMeter[]) => ms.map((m) => m.label.toLowerCase()).join(" and ");
  const warnKey = [...full, ...close].map((m) => m.id).join(",");
  // A new set of limits in trouble brings the warning back.
  useEffect(() => setWarnHidden(false), [warnKey]);
  const showWarn = Boolean(full.length || close.length) && !warnHidden;

  const priceOf = (p: UsagePlan, period: Period) => (period === "monthly" ? p.monthly : p.yearly);
  const openDialog = (forMeter?: UsageMeter) => {
    let pick = planId;
    if (forMeter) {
      const order = [...plans].sort((a, b) => a.monthly - b.monthly);
      const used = usage[forMeter.id] ?? 0;
      pick = order.find((p) => p.monthly > plan.monthly && (p.limits[forMeter.id] === null || (p.limits[forMeter.id] ?? 0) > used))?.id ?? planId;
    }
    setDlg({ pick, period: "monthly", error: "", busy: false });
  };

  const problem = (p: UsagePlan) => {
    if (p.id === planId) return l.already.replace("{name}", p.name);
    for (const m of meters) {
      const lim = p.limits[m.id];
      const used = usage[m.id] ?? 0;
      if (lim !== null && lim !== undefined && used > lim) return l.tooSmall.replace("{name}", p.name).replace("{limit}", fmtNum(lim)).replace("{label}", m.label.toLowerCase()).replace("{used}", fmtNum(used));
    }
    return "";
  };

  const confirm = (): false => {
    if (!dlg || dlg.busy) return false as const;
    const p = plans.find((x) => x.id === dlg.pick)!;
    const err = problem(p);
    if (err) {
      setDlg({ ...dlg, error: err });
      timers.current.push(window.setTimeout(() => document.getElementById(`${id}-dlg-err`)?.focus(), 20));
      return false;
    }
    setDlg({ ...dlg, busy: true, error: "" });
    const run = changePlan ?? (() => new Promise<void>((r) => window.setTimeout(r, 700)));
    run(p.id, dlg.period)
      .then(() => {
        setPlanId(p.id);
        setDlg(null);
        setSaid(l.switched.replace("{name}", p.name));
        // The Raise limit button that opened the dialog may be gone now; land on Compare plans.
        timers.current.push(window.setTimeout(() => document.getElementById(`${id}-compare`)?.focus(), 40));
      })
      .catch(() => {
        setDlg((d) => (d ? { ...d, busy: false, error: l.failed } : d));
        timers.current.push(window.setTimeout(() => document.getElementById(`${id}-dlg-err`)?.focus(), 20));
      });
    return false;
  };

  const picked = dlg ? plans.find((x) => x.id === dlg.pick) ?? plan : plan;
  const limitText = (v: number | null | undefined, m: UsageMeter) => (v === null || v === undefined ? l.unlimited : `${fmtNum(v)}${m.unit ? ` ${m.unit}` : ""}`);

  return (
    <section className="fl-uplim" aria-labelledby={`${id}-title`} data-fl="p.usage-limits">
      <header className="fl-uplim-head">
        <div className="fl-uplim-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          <p>
            <Badge tone="info" key={plan.id} className="fl-uplim-plan">
              {l.plan.replace("{name}", plan.name)}
            </Badge>
            {resetsOn ? <span>{l.resets.replace("{date}", dateFmt.format(new Date(`${resetsOn.slice(0, 10)}T12:00:00`)))}</span> : null}
          </p>
          {lede ? <p className="fl-uplim-lede">{lede}</p> : null}
        </div>
        <Button id={`${id}-compare`} size={40} icon="layers" onClick={() => openDialog()}>
          {l.compare}
        </Button>
      </header>

      <div className={["fl-uplim-warn", full.length ? "is-full" : "", showWarn ? "is-open" : ""].filter(Boolean).join(" ")} inert={!showWarn || undefined}>
        <div>
          <div className="fl-uplim-warn-in" role={showWarn ? "alert" : undefined}>
            <Icon name="alert" />
            <p>
              {full.length ? l.warnFull.replace("{list}", listNames(full)) + " " : ""}
              {close.length ? l.warnClose.replace("{list}", listNames(close)) : ""}
            </p>
            <Button
              variant="tertiary"
              size={32}
              icon="close"
              iconOnly
              onClick={() => {
                setWarnHidden(true);
                document.getElementById(`${id}-alerts`)?.querySelector<HTMLElement>("button, input")?.focus();
              }}
            >
              {l.dismiss}
            </Button>
          </div>
        </div>
      </div>

      {phase === "error" ? (
        <div className="fl-uplim-empty" role="alert">
          <Icon name="alert" />
          <p>{l.loadFailed}</p>
          <Button variant="secondary" size={32} icon="refresh" onClick={fetchUsage}>
            {l.retry}
          </Button>
        </div>
      ) : (
        <ul className="fl-uplim-grid" aria-busy={phase === "loading" || undefined} aria-label={phase === "loading" ? l.loading : title}>
          {meters.map((m, i) => {
            const limit = plan.limits[m.id];
            const used = usage[m.id] ?? 0;
            const unlimited = limit === null || limit === undefined;
            const st = phase === "ready" ? state(m) : "ok";
            const left = unlimited ? null : Math.max(0, (limit ?? 0) - used);
            return (
              <li key={m.id} className={["fl-uplim-meter", `is-${st}`, phase === "loading" ? "is-loading" : ""].filter(Boolean).join(" ")} style={{ ["--i" as string]: i }}>
                <div className="fl-uplim-row">
                  <span className="fl-uplim-label" id={`${id}-m-${m.id}`}>
                    {m.label}
                  </span>
                  {st !== "ok" ? <span className="fl-uplim-flag">{st === "full" ? l.full : l.close}</span> : null}
                </div>
                {phase === "loading" ? (
                  <>
                    <span className="fl-uplim-skel" aria-hidden="true" />
                    <span className="fl-uplim-bar" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <p className="fl-uplim-nums">
                      <strong>{fmtNum(used)}</strong>
                      {unlimited ? ` ${m.unit ?? ""} · ${l.unlimited}` : ` / ${limitText(limit, m)}`}
                    </p>
                    <span
                      className={["fl-uplim-bar", unlimited ? "is-unlimited" : ""].filter(Boolean).join(" ")}
                      role="meter"
                      aria-labelledby={`${id}-m-${m.id}`}
                      aria-valuemin={0}
                      aria-valuemax={unlimited ? undefined : limit ?? 0}
                      aria-valuenow={used}
                      aria-valuetext={unlimited ? `${fmtNum(used)} ${m.unit ?? ""}, ${l.unlimited}` : l.of.replace("{used}", fmtNum(used)).replace("{limit}", limitText(limit, m))}
                    >
                      <span style={{ ["--fill" as string]: unlimited ? 0 : Math.min(1, ratio(m)) }} />
                    </span>
                    <div className="fl-uplim-row">
                      <span className="fl-uplim-left">{unlimited ? "" : left ? l.left.replace("{n}", limitText(left, m)) : l.none}</span>
                      {st !== "ok" ? (
                        <Button variant="tertiary" size={24} icon="arrow" iconAt="end" className="fl-uplim-raise" onClick={() => openDialog(m)}>
                          {l.raise}
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <footer className="fl-uplim-foot">
        <span className="fl-uplim-alerts" id={`${id}-alerts`}>
          <Switch
            size={20}
            on={alerts}
            label={l.alerts}
            onToggle={(on) => {
              setAlerts(on);
              onAlertChange?.(on);
              setSaid(on ? `${l.alerts}: on` : `${l.alerts}: off`);
            }}
          />
          <span aria-hidden="true">{l.alerts}</span>
        </span>
        {load ? (
          <Button variant="secondary" size={32} icon="refresh" className={phase === "loading" ? "fl-uplim-spin" : undefined} aria-disabled={phase === "loading" || undefined} onClick={() => phase !== "loading" && fetchUsage()}>
            {l.refresh}
          </Button>
        ) : null}
      </footer>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {dlg ? (
        <Modal
          variant="form"
          title={l.dialogTitle}
          description={l.dialogText}
          className="fl-uplim-dlg"
          confirmLabel={l.switchTo.replace("{name}", picked.name)}
          busy={dlg.busy}
          busyLabel={l.switching}
          onConfirm={() => confirm()}
          onClose={() => setDlg(null)}
        >
          <PeriodSwitch value={dlg.period} onChange={(period) => setDlg({ ...dlg, period, error: "" })} labels={{ monthly: l.monthly, yearly: l.yearly }} name={`${id}-period`} />
          <div className="fl-uplim-plans" role="radiogroup" aria-label={l.dialogTitle}>
            {plans.map((p) => {
              const price = priceOf(p, dlg.period);
              return (
                <label key={p.id} className="fl-uplim-choice">
                  <input type="radio" name={`${id}-plan`} value={p.id} checked={dlg.pick === p.id} disabled={dlg.busy} onChange={() => setDlg({ ...dlg, pick: p.id, error: "" })} />
                  <span className="fl-uplim-radio" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                  <span className="fl-uplim-choice-main">
                    <strong>
                      {p.name}
                      {p.id === planId ? <span className="fl-uplim-current">{l.current}</span> : null}
                    </strong>
                    <span className="fl-uplim-choice-limits">{meters.map((m) => `${limitText(p.limits[m.id], m)} ${m.unit ? "" : m.label.toLowerCase()}`.replace(/\s+/g, " ").trim()).join(" · ")}</span>
                  </span>
                  <span className="fl-uplim-price" key={dlg.period}>
                    {money(price)}
                    {price ? <small>{dlg.period === "monthly" ? l.perMonth : l.perYear}</small> : null}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="fl-uplim-diff">
            <p className="fl-uplim-diff-title">{l.changes}</p>
            <table>
              <caption className="fl-sr">
                {l.changes}: {plan.name} → {picked.name}
              </caption>
              <tbody>
                {meters.map((m) => {
                  const a = plan.limits[m.id];
                  const b = picked.limits[m.id];
                  const up = b === null ? a !== null : a !== null && a !== undefined && (b ?? 0) > a;
                  const down = a === null ? b !== null : b !== null && b !== undefined && b < (a ?? 0);
                  return (
                    <tr key={m.id} className={up ? "is-up" : down ? "is-down" : undefined}>
                      <th scope="row">{m.label}</th>
                      <td>{limitText(a, m)}</td>
                      <td aria-hidden="true">
                        <Icon name="arrow" />
                      </td>
                      <td key={`${picked.id}-${m.id}`} className="fl-uplim-to">
                        {limitText(b, m)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {dlg.error ? (
            <p id={`${id}-dlg-err`} className="fl-uplim-err" role="alert" tabIndex={-1}>
              <Icon name="alert" />
              {dlg.error}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Usage",
  lede: "What your workspace has used this month.",
  plan: "starter",
  resetsOn: "2026-11-01",
  meters: [
    { id: "projects", label: "Projects" },
    { id: "storage", label: "Storage", unit: "GB" },
    { id: "members", label: "Members" },
    { id: "credits", label: "AI credits" },
  ] as UsageMeter[],
  plans: [
    { id: "free", name: "Free", monthly: 0, yearly: 0, limits: { projects: 3, storage: 1, members: 1, credits: 100 } },
    { id: "starter", name: "Starter", monthly: 12, yearly: 120, limits: { projects: 10, storage: 5, members: 3, credits: 1000 } },
    { id: "team", name: "Team", monthly: 39, yearly: 390, limits: { projects: 50, storage: 100, members: 15, credits: 5000 } },
    { id: "business", name: "Business", monthly: 99, yearly: 990, limits: { projects: null, storage: 1000, members: null, credits: 20000 } },
  ] as UsagePlan[],
  usage: { projects: 8, storage: 4.3, members: 3, credits: 420 },
};

export default function UsageLimitsSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <UsageLimits
          title={SAMPLE.title}
          lede={SAMPLE.lede}
          plan={SAMPLE.plan}
          plans={SAMPLE.plans}
          meters={SAMPLE.meters}
          resetsOn={SAMPLE.resetsOn}
          load={() => new Promise((r) => window.setTimeout(() => r(SAMPLE.usage), 700))}
        />
      </div>
    </section>
  );
}
