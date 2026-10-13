/** @flowcode-library app-dashboard · App dashboard: totals, what needs attention, activity (Charts and data)
 * Catalog ID: p.app-dashboard (pattern)
 * Function: The app dashboard (p.app-dashboard): how things stand across one kind of record, live from the store: totals, statuses waiting on someone, breakdowns and the latest activity. Built on the app data layer: pass the app's store (createStore from ./app-data with the app's schema and seed) and an entity key.
 * Use it as: import { AppDashboard } from "./app-dashboard"; <AppDashboard store={store} entity="contract" title? description? breakdown?="category" onOpen={(id) => go("contract-detail", id)} onViewAll={() => go("contracts")} onCreate? />
 * Built from: c.button, c.kpi
 * Look: Totals as tiles (all records, the money at stake, the statuses waiting on someone), a Needs attention list that opens each record, bars by status and by a category, and the latest activity, all live from the app's store.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-secondary --color-success --color-warning --color-danger --font-display --radius-lg --focus-ring
 * Use cases: operations overview; app home; manager dashboard; portfolio overview; work queue overview
 * Jobs to be done: see how things stand; find what needs me; see what changed
 * Keywords: dashboard, overview, home, kpi, needs attention, activity, operations
 */
/**
 * App dashboard: how things stand across one kind of record, live from the app's store. Tiles for the total, each status
 * and the money at stake; bars by status and by one category field; a "Needs attention" list of the records waiting on
 * someone (statuses toned info or warning), each opening the record; and the latest activity. Everything follows the
 * store, so a record approved on another page moves here at once.
 * Written for FlowCode, on the app data layer (app-data.tsx).
 * Make it the app's own: pass the app's store and entity; choose the category field the bars break down by.
 */
import { useMemo } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { formatValue, StatusChip, titleOf, Toaster, useActivity, useStore, type AppStore, type EntityDef, type RecordData } from "./app-data";
import { sampleStore } from "./app-sample";

export interface AppDashboardProps {
  store: AppStore;
  /** The entity key (e.g. "contract"). */
  entity: string;
  title?: string;
  description?: string;
  /** A select field to break the records down by (the first select field when left out). */
  breakdown?: string;
  onOpen?: (id: string) => void;
  onViewAll?: () => void;
  onCreate?: () => void;
}

function Bars({ rows, label }: { rows: Array<{ key: string; label: string; value: number; tone?: string }>; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="fl-db-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="fl-db-bar">
          <span className="fl-db-bar-label">{r.label}</span>
          <span className="fl-db-bar-track" aria-hidden="true">
            <span className={`fl-db-bar-fill${r.tone ? ` fl-db-bar-fill--${r.tone}` : ""}`} style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
          </span>
          <span className="fl-db-bar-value">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function AppDashboard({ store, entity, title, description, breakdown, onOpen, onViewAll, onCreate }: AppDashboardProps) {
  const state = useStore(store);
  const e: EntityDef = store.entity(entity);
  const records: RecordData[] = useMemo(() => (state.records[entity] ?? []).filter((r) => !r.draft), [state.records, entity]);
  const activity = useActivity(store, entity).slice(0, 6);
  const money = e.fields.find((f) => f.type === "money");
  const cat = e.fields.find((f) => f.key === breakdown) ?? e.fields.find((f) => f.type === "select");
  const byStatus = (e.statuses ?? []).map((s) => ({ key: s.key, label: s.label, tone: s.tone, value: records.filter((r) => r[e.statusField!] === s.key).length }));
  const byCat = cat ? (cat.options ?? []).map((o) => ({ key: o, label: o, value: records.filter((r) => r[cat.key] === o).length })).filter((r) => r.value) : [];
  const waiting = records.filter((r) => ["info", "warning"].includes(e.statuses?.find((s) => s.key === r[e.statusField ?? ""])?.tone ?? "")).slice(0, 6);
  const total = money ? records.reduce((n, r) => n + (Number(r[money.key]) || 0), 0) : 0;
  const when = (iso: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  return (
    <div className="fl-db" data-fl="p.app-dashboard">
      <header className="fl-db-head">
        <div>
          <h2 className="fl-db-title">{title ?? `${e.plural} overview`}</h2>
          {description ? <p className="fl-db-lede">{description}</p> : null}
        </div>
        <div className="fl-db-actions">
          {onViewAll ? (
            <Button variant="secondary" size={40} onClick={onViewAll}>
              All {e.plural.toLowerCase()}
            </Button>
          ) : null}
          {onCreate ? (
            <Button variant="primary" size={40} icon="plus" onClick={onCreate}>
              New {e.label.toLowerCase()}
            </Button>
          ) : null}
        </div>
      </header>
      <ul className="fl-db-tiles" aria-label="Totals">
        <li className="fl-db-tile">
          <span className="fl-db-tile-label">All {e.plural.toLowerCase()}</span>
          <span className="fl-db-tile-value">{records.length}</span>
        </li>
        {money ? (
          <li className="fl-db-tile">
            <span className="fl-db-tile-label">{money.label}, in all</span>
            <span className="fl-db-tile-value">{formatValue(money, total)}</span>
          </li>
        ) : null}
        {byStatus
          .filter((s) => s.tone === "info" || s.tone === "warning")
          .map((s) => (
            <li key={s.key} className={`fl-db-tile fl-db-tile--${s.tone}`}>
              <span className="fl-db-tile-label">{s.label}</span>
              <span className="fl-db-tile-value">{s.value}</span>
            </li>
          ))}
      </ul>
      <div className="fl-db-grid">
        <section className="fl-db-panel" aria-labelledby="fl-db-attn">
          <h3 id="fl-db-attn" className="fl-db-panel-title">
            Needs attention <span className="fl-db-count">{waiting.length}</span>
          </h3>
          {waiting.length ? (
            <ul className="fl-db-list">
              {waiting.map((r) => (
                <li key={r.id}>
                  <button type="button" className="fl-db-row" onClick={() => onOpen?.(r.id)}>
                    <span className="fl-db-row-main">
                      <span className="fl-db-row-title">{titleOf(e, r)}</span>
                      <span className="fl-db-row-sub">
                        {r.id}
                        {e.subtitleField ? ` · ${String(r[e.subtitleField] ?? "")}` : ""}
                      </span>
                    </span>
                    <StatusChip entity={e} record={r} />
                    <Icon name="chevron-right" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-db-empty">Nothing is waiting on anyone.</p>
          )}
        </section>
        <section className="fl-db-panel" aria-labelledby="fl-db-status">
          <h3 id="fl-db-status" className="fl-db-panel-title">
            By status
          </h3>
          <Bars rows={byStatus} label={`${e.plural} by status`} />
          {cat && byCat.length ? (
            <>
              <h3 className="fl-db-panel-title fl-db-panel-title--sub">By {cat.label.toLowerCase()}</h3>
              <Bars rows={byCat} label={`${e.plural} by ${cat.label.toLowerCase()}`} />
            </>
          ) : null}
        </section>
        <section className="fl-db-panel" aria-labelledby="fl-db-act">
          <h3 id="fl-db-act" className="fl-db-panel-title">
            Latest activity
          </h3>
          {activity.length ? (
            <ol className="fl-db-activity">
              {activity.map((a) => (
                <li key={a.id}>
                  <span className="fl-db-activity-text">
                    <strong>{a.who}</strong> {a.text}
                  </span>
                  {a.reason ? <span className="fl-db-activity-reason">"{a.reason}"</span> : null}
                  <time dateTime={a.at}>{when(a.at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="fl-db-empty">No changes yet. Approvals, edits and new {e.plural.toLowerCase()} appear here.</p>
          )}
        </section>
      </div>
    </div>
  );
}

// flowcode:sample
export default function AppDashboardSheet() {
  const s = sampleStore;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Dashboard on the app's live data</h3>
        <p className="fl-ctl-btn-what">Every number comes from the store: approve a contract on another page (or with the button here) and it moves at once.</p>
        <div className="fl-db-demo">
          <Button
            variant="secondary"
            size={32}
            onClick={() => {
              s.setRole("Manager");
              const r = (s.get().records.contract ?? []).find((x) => x.status === "review");
              if (r) s.transition("contract", r.id, "approve");
            }}
          >
            Approve one in review
          </Button>
          <Button variant="tertiary" size={32} onClick={() => s.reset()}>
            Reset the sample
          </Button>
        </div>
        <AppDashboard store={s} entity="contract" description="Contracts by status, the money at stake, and what is waiting on someone." />
      </div>
      <Toaster />
    </section>
  );
}
