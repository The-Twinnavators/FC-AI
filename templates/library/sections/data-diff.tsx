/**
 * Data: before and after. A line-by-line comparison of two versions of a text, with added lines tinted green, removed
 * lines tinted red, line numbers, and a switch between one unified list and side-by-side columns. Use for reviewing a
 * changed policy, price list or template before it goes live. Make it the app's own: replace SAMPLE with the two
 * versions the app compares and the names it gives them.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useMemo, useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "House rules",
  title: "What changed in the booking rules",
  lede: "Check the new version before it goes on the booking page.",
  beforeName: "Current rules (March)",
  afterName: "New rules (October)",
  before: [
    "Booking opens 7 days before each class.",
    "Cancel up to 12 hours before for a full refund.",
    "Late cancellations lose the class from your pack.",
    "Mats are provided, or bring your own.",
    "Arrive 10 minutes early for your first class.",
    "Children under 12 attend with an adult.",
  ].join("\n"),
  after: [
    "Booking opens 14 days before each class.",
    "Cancel up to 12 hours before for a full refund.",
    "Late cancellations lose the class from your pack.",
    "A waiting list fills any cancelled place automatically.",
    "Mats are provided, or bring your own.",
    "Arrive 10 minutes early for your first class.",
  ].join("\n"),
  views: [
    { id: "unified", label: "Unified" },
    { id: "split", label: "Side by side" },
  ],
  empty: { title: "No changes", text: "Both versions are exactly the same." },
};

type Kind = "same" | "add" | "del";
interface Op {
  kind: Kind;
  text: string;
  oldNo?: number;
  newNo?: number;
}

/** Line diff from the longest common subsequence. Fine for the short texts a prototype compares. */
function diffLines(before: string, after: string): Op[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      ops.push({ kind: "same", text: a[i], oldNo: i + 1, newNo: j + 1 });
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      ops.push({ kind: "add", text: b[j], newNo: j + 1 });
      j++;
    } else {
      ops.push({ kind: "del", text: a[i], oldNo: i + 1 });
      i++;
    }
  }
  return ops;
}

/** Pairs removed lines with the added lines that replace them, so side-by-side rows line up. */
function toRows(ops: Op[]): [Op | null, Op | null][] {
  const rows: [Op | null, Op | null][] = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].kind === "same") {
      rows.push([ops[k], ops[k]]);
      k++;
      continue;
    }
    const dels: Op[] = [];
    const adds: Op[] = [];
    while (k < ops.length && ops[k].kind !== "same") (ops[k].kind === "del" ? dels : adds).push(ops[k++]);
    for (let m = 0; m < Math.max(dels.length, adds.length); m++) rows.push([dels[m] ?? null, adds[m] ?? null]);
  }
  return rows;
}

const SIGN: Record<Kind, string> = { same: " ", add: "+", del: "−" };
const SAID: Record<Kind, string> = { same: "", add: "Added: ", del: "Removed: " };

function Line({ op }: { op: Op }) {
  return (
    <>
      <span className="fl-dat-sign" aria-hidden="true">
        {SIGN[op.kind]}
      </span>
      <span className="fl-dat-code">
        {op.kind !== "same" ? <span className="fl-sr">{SAID[op.kind]}</span> : null}
        {op.text || " "}
      </span>
    </>
  );
}

function Side({ op, side }: { op: Op | null; side: "old" | "new" }) {
  if (!op) return <td className="fl-dat-row--blank" />;
  const no = side === "old" ? op.oldNo : op.newNo;
  return (
    <td className={`fl-dat-row--${op.kind}`}>
      <div className="fl-dat-row fl-dat-row--split">
        <span className="fl-dat-lno" aria-hidden="true">
          {no}
        </span>
        <Line op={op} />
      </div>
    </td>
  );
}

export default function DataDiff() {
  const d = SAMPLE;
  const [view, setView] = useState("unified");
  const ops = useMemo(() => diffLines(d.before, d.after), [d.before, d.after]);
  const rows = useMemo(() => toRows(ops), [ops]);
  const added = ops.filter((o) => o.kind === "add").length;
  const removed = ops.filter((o) => o.kind === "del").length;
  const none = added === 0 && removed === 0;

  return (
    <section className="fl-section" aria-labelledby="data-diff-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="data-diff-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <div className="fl-dat-panel">
          <div className="fl-dat-chart-head">
            <p className="fl-dat-diff-summary" style={{ margin: 0 }}>
              <span className="fl-meta">
                {d.beforeName} → {d.afterName}
              </span>
              {!none ? (
                <>
                  <span className="fl-dat-pill fl-dat-pill--add">
                    {added} added
                  </span>
                  <span className="fl-dat-pill fl-dat-pill--del">
                    {removed} removed
                  </span>
                </>
              ) : null}
            </p>
            {!none ? (
              <div className="fl-toggle" role="group" aria-label="Diff layout">
                {d.views.map((v) => (
                  <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                    {v.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {none ? (
            <div className="fl-dat-empty" role="status">
              <strong>{d.empty.title}</strong>
              <p>{d.empty.text}</p>
            </div>
          ) : view === "unified" ? (
            <div className="fl-dat-diff" role="region" aria-label={`Changes from ${d.beforeName} to ${d.afterName}`} tabIndex={0}>
              <ol>
                {ops.map((op, k) => (
                  <li key={k} className={`fl-dat-row fl-dat-row--${op.kind}`}>
                    <span className="fl-dat-lno" aria-hidden="true">
                      {op.oldNo ?? ""}
                    </span>
                    <span className="fl-dat-lno" aria-hidden="true">
                      {op.newNo ?? ""}
                    </span>
                    <Line op={op} />
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="fl-dat-diff" role="region" aria-label={`${d.beforeName} and ${d.afterName} side by side`} tabIndex={0}>
              <table className="fl-dat-split">
                <thead>
                  <tr>
                    <th scope="col">{d.beforeName}</th>
                    <th scope="col">{d.afterName}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([l, r], k) => (
                    <tr key={k}>
                      <Side op={l} side="old" />
                      <Side op={r} side="new" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
