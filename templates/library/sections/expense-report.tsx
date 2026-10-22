/** @flowcode-library expense-report · Expense report (Forms)
 * Catalog ID: b.expense-report (block)
 * Function: An expense report to fill in and send (b.expense-report): line items with date, merchant, category, amount, a receipt (attach a JPG, PNG or PDF, checked for type and size, with an uploading state) and a note; people at the table for meals; policy checks per line (receipt needed over a limit, meal cap per person, older than the claim window, future dates, items not paid back, likely duplicates); totals by category with what will be paid back; Add line, Delete line after a confirm; Submit that checks every line and focuses the first problem, then confirms with a statement box; a submitted, read-only state with Recall.
 * Use it as: import { ExpenseReport } from "./expense-report"; <ExpenseReport title owner categories={[{ id, name, perPersonCap?: 7500, reimbursable }]} lines={[{ id, date: "2026-10-14", merchant, category, amount: 4280 (cents), receipt?: { name, size } | null, note, people?: 3 }]} policy?={{ receiptOver: 2500, maxAgeDays: 60 }} currency?="USD" onUpload?={async (file) => ({ name, size })} onSubmit?={async (report) => void} onRecall?={async () => void} />
 * Built from: c.text-field.outlined, c.select.outlined, c.quantity, c.checkbox, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.modal.confirm, c.modal.danger, c.empty-state
 * Look: A white card: an editable report name, the owner and a status pill, with the total large at the right; then line cards, each a row of fields (date, merchant, category, amount with a currency sign) and a receipt slot (a dashed Attach button, or the file's name with a remove button) plus delete; a note field and, for meals, a people count under it; policy notes as small amber or red lines with a straight bar at their left. A sunken side panel lists totals by category over thin straight bars, what is not paid back and the amount to be paid, with Submit.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --color-info --surface-bg --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --font-display --font-mono --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: expense report; expense claim; reimbursement request; travel expenses; business trip costs; corporate card reconciliation; finance approvals
 * Jobs to be done: claim back what I spent on a trip; attach receipts to each expense; know before I submit what breaks the policy; see how much I'll get back; take a report back to fix it
 * Keywords: expense, expenses, reimbursement, receipt, claim, travel, per diem, policy, meals, mileage, finance, submit
 */
/**
 * Expense report: what an employee fills in after a trip. Amounts are typed in the currency's main unit and kept in
 * cents. Per line: date, merchant and amount are required, the date can't be in the future, and a receipt is needed
 * over policy.receiptOver unless the note says why. Warnings don't stop a submit: a meal over the per-person cap (only
 * the cap is paid back), a date older than policy.maxAgeDays, a category that isn't paid back, and a likely duplicate.
 * Attach opens the file picker; a JPG, PNG or PDF under 10 MB uploads (onUpload) and shows its name. Submit checks every
 * line and focuses the first problem; then a confirm with a statement box; then the report is read-only with Recall.
 * Make it the app's own: replace SAMPLE with the person's draft, upload receipts to storage in onUpload, and send the
 * report to the approval flow in onSubmit.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its file uploader and table components.
 */
/**
 * How to try it
 * - Press Submit: the dinner line asks for a receipt; its field is focused. Attach any image or PDF; Submit again.
 * - Change the dinner's people from 4 to 2: the meal-cap note appears and "Paid back" drops.
 * - Press Add line, then Submit: the new line's merchant is required. Fill it in, or press its trash button (it asks).
 * - Set a date after today: it says so. Pick Personal as a category: it moves to "Not paid back".
 * - Submit, tick the statement and send: the report locks. Press Recall to edit again.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's TextField ("./text-fields-states"),
 * Select ("./dropdowns-states"), Quantity ("./input-quantity"), Checkbox ("./checkboxes-radios"), Button
 * ("./buttons-variants"), Badge ("./badges-status"), Modal ("./modals-dialogs") and its inline icon set ("./icons").
 * Nothing else: no package to install and nothing fetched at run time (the sample upload keeps the file's name only).
 * The styles are the library's own fl- classes in templates/library/css/r5c-expense-report.css.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Quantity } from "./input-quantity";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── b.expense-report: line items with receipts, policy checks, totals, submit and recall. ──

export type ExpenseCategory = { id: string; name: string; /** cents per person, for meals */ perPersonCap?: number; reimbursable: boolean };
export type Receipt = { name: string; size: number };
export type ExpenseLine = { id: string; /** "YYYY-MM-DD" */ date: string; merchant: string; category: string; /** cents */ amount: number; receipt?: Receipt | null; note: string; /** people at the table, for capped categories */ people?: number };
export type ExpenseReportProps = {
  title: string;
  owner: string;
  categories: ExpenseCategory[];
  lines: ExpenseLine[];
  policy?: { receiptOver: number; maxAgeDays: number };
  submitted?: boolean;
  locale?: string;
  currency?: string;
  onUpload?: (file: File) => Promise<Receipt>;
  onSubmit?: (report: { title: string; lines: ExpenseLine[]; total: number; payBack: number }) => Promise<void>;
  onRecall?: () => Promise<void>;
};

type Row = ExpenseLine & { amountText: string };
type Issue = { level: "error" | "warn"; field: "date" | "merchant" | "amount" | "receipt" | "row"; text: string };

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoOf(d);
};
const toCents = (s: string) => {
  const t = s.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
};
const plain = (c: number) => (c / 100).toFixed(2);
const quick = async () => undefined;
const fakeUpload = (f: File) => new Promise<Receipt>((r) => setTimeout(() => r({ name: f.name, size: f.size }), 600));
const OK_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

/** Focuses an element once React has drawn it (and after any dialog has handed focus back). */
function useFocusLater() {
  const want = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const find = want.current;
    if (!find) return;
    const el = find();
    if (el) {
      want.current = null;
      el.focus();
    }
  });
  return (find: () => HTMLElement | null | undefined) => {
    want.current = find;
    setTick((t) => t + 1);
  };
}

export function ExpenseReport({ title: givenTitle, owner, categories, lines, policy = { receiptOver: 2500, maxAgeDays: 60 }, submitted: givenSubmitted = false, locale = "en-US", currency = "USD", onUpload = fakeUpload, onSubmit = quick, onRecall = quick }: ExpenseReportProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const [title, setTitle] = useState(givenTitle);
  const [rows, setRows] = useState<Row[]>(() => lines.map((l) => ({ ...l, amountText: l.amount ? plain(l.amount) : "" })));
  const [checked, setChecked] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<{ id: string; text: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [agree, setAgree] = useState(false);
  const [agreeErr, setAgreeErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [submitted, setSubmitted] = useState(givenSubmitted);
  const [said, setSaid] = useState("");
  const fileFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const today = isoOf(new Date());

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const symbol = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$", [locale, currency]);
  const cat = (id: string) => categories.find((c) => c.id === id);

  /** What each line pays back, and its problems. */
  const review = useMemo(() => {
    const out = new Map<string, { pay: number; issues: Issue[] }>();
    for (const r of rows) {
      const issues: Issue[] = [];
      const c = cat(r.category);
      const cents = toCents(r.amountText);
      if (!r.date) issues.push({ level: "error", field: "date", text: "Enter the date." });
      else if (r.date > today) issues.push({ level: "error", field: "date", text: "The date can't be after today." });
      else if (r.date < daysAgo(policy.maxAgeDays)) issues.push({ level: "warn", field: "row", text: `Older than ${policy.maxAgeDays} days: it may need a manager's OK.` });
      if (!r.merchant.trim()) issues.push({ level: "error", field: "merchant", text: "Enter the merchant." });
      if (!r.amountText.trim()) issues.push({ level: "error", field: "amount", text: "Enter the amount." });
      else if (!Number.isFinite(cents) || cents <= 0) issues.push({ level: "error", field: "amount", text: "Enter an amount like 42.50." });
      if (Number.isFinite(cents) && cents > policy.receiptOver && !r.receipt && !r.note.trim()) issues.push({ level: "error", field: "receipt", text: `Attach a receipt (needed over ${money.format(policy.receiptOver / 100)}), or say why in the note.` });
      let pay = Number.isFinite(cents) && cents > 0 ? cents : 0;
      if (c && !c.reimbursable) {
        issues.push({ level: "warn", field: "row", text: `${c.name} isn't paid back.` });
        pay = 0;
      } else if (c?.perPersonCap && pay) {
        const cap = c.perPersonCap * Math.max(1, r.people ?? 1);
        if (pay > cap) {
          issues.push({ level: "warn", field: "row", text: `Over the ${money.format(c.perPersonCap / 100)} per person limit: ${money.format(cap / 100)} is paid back.` });
          pay = cap;
        }
      }
      const twin = rows.find((o) => o.id !== r.id && o.date === r.date && o.merchant.trim().toLowerCase() === r.merchant.trim().toLowerCase() && r.merchant.trim() && toCents(o.amountText) === cents);
      if (twin) issues.push({ level: "warn", field: "row", text: "Looks like a duplicate of another line." });
      out.set(r.id, { pay, issues });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, policy, today, money]);

  const total = rows.reduce((n, r) => n + (Number.isFinite(toCents(r.amountText)) ? Math.max(0, toCents(r.amountText)) : 0), 0);
  const payBack = rows.reduce((n, r) => n + (review.get(r.id)?.pay ?? 0), 0);
  const byCat = categories
    .map((c) => ({ c, sum: rows.filter((r) => r.category === c.id).reduce((n, r) => n + (Number.isFinite(toCents(r.amountText)) ? Math.max(0, toCents(r.amountText)) : 0), 0) }))
    .filter((x) => x.sum > 0)
    .sort((a, b) => b.sum - a.sum);
  const errors = rows.flatMap((r) => (review.get(r.id)?.issues ?? []).filter((i) => i.level === "error").map((i) => ({ r, i })));
  const warns = rows.reduce((n, r) => n + (review.get(r.id)?.issues ?? []).filter((i) => i.level === "warn").length, 0);

  const edit = (id: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const fieldId = (rowId: string, f: Issue["field"]) => `${uid}-${rowId}-${f === "row" ? "merchant" : f}`;

  const add = () => {
    const id = `l-${Date.now()}`;
    setRows((all) => [...all, { id, date: today, merchant: "", category: categories[0]?.id ?? "", amount: 0, amountText: "", receipt: null, note: "" }]);
    setSaid("Line added.");
    focusLater(() => document.getElementById(`${uid}-${id}-merchant`));
  };

  const pick = (id: string) => {
    fileFor.current = id;
    setUploadErr(null);
    fileInput.current?.click();
  };
  const onFile = async (file: File | undefined) => {
    const id = fileFor.current;
    if (!file || !id) return;
    if (!OK_TYPES.includes(file.type) || file.size > MAX_BYTES) {
      setUploadErr({ id, text: "Use a JPG, PNG or PDF under 10 MB." });
      setSaid("That file can't be used. Use a JPG, PNG or PDF under 10 MB.");
      return;
    }
    setUploading(id);
    setSaid(`Uploading ${file.name}…`);
    try {
      const receipt = await onUpload(file);
      edit(id, { receipt });
      setSaid(`Receipt attached: ${receipt.name}.`);
      focusLater(() => document.getElementById(`${uid}-${id}-rm`));
    } catch {
      setUploadErr({ id, text: "Couldn't upload. Try again." });
    } finally {
      setUploading(null);
    }
  };

  const deleting = deleteId ? rows.find((r) => r.id === deleteId) : undefined;
  const doDelete = () => {
    if (!deleting) return;
    const at = rows.findIndex((r) => r.id === deleting.id);
    const next = rows[at + 1] ?? rows[at - 1];
    setRows((all) => all.filter((r) => r.id !== deleting.id));
    setDeleteId(null);
    setSaid(`Deleted ${deleting.merchant.trim() || "the line"}.`);
    focusLater(() => (next ? document.getElementById(`${uid}-${next.id}-merchant`) : document.getElementById(`${uid}-add`)));
  };

  const trySubmit = () => {
    setChecked(true);
    if (!rows.length) {
      setSaid("Add at least one expense.");
      document.getElementById(`${uid}-add`)?.focus();
      return;
    }
    if (!title.trim()) {
      setSaid("Give the report a name.");
      document.getElementById(`${uid}-title`)?.focus();
      return;
    }
    const first = errors[0];
    if (first) {
      setSaid(`${errors.length} ${errors.length === 1 ? "problem" : "problems"} to fix. ${first.i.text}`);
      document.getElementById(fieldId(first.r.id, first.i.field))?.focus();
      return;
    }
    setAgree(false);
    setAgreeErr("");
    setSendErr("");
    setConfirm(true);
  };
  const send = async () => {
    if (!agree) {
      setAgreeErr("Tick the box to confirm.");
      document.getElementById(`${uid}-agree`)?.focus();
      return;
    }
    setBusy(true);
    setSendErr("");
    try {
      await onSubmit({ title: title.trim(), lines: rows.map(({ amountText, ...l }) => ({ ...l, amount: toCents(amountText) })), total, payBack });
      setSubmitted(true);
      setConfirm(false);
      setSaid(`Submitted. ${money.format(payBack / 100)} to be paid back after approval.`);
      focusLater(() => document.getElementById(`${uid}-recall`));
    } catch {
      setSendErr("Couldn't submit. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const recall = async () => {
    setBusy(true);
    try {
      await onRecall();
      setSubmitted(false);
      setSaid("Report recalled. You can edit it again.");
      focusLater(() => document.getElementById(`${uid}-submit`));
    } catch {
      setSaid("Couldn't recall. Try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!uploadErr) return;
    const t = window.setTimeout(() => setUploadErr(null), 6000);
    return () => window.clearTimeout(t);
  }, [uploadErr]);

  const show = (r: Row, f: Issue["field"]) => (checked || f === "row" ? (review.get(r.id)?.issues ?? []).find((i) => i.field === f && (checked || i.level === "warn")) : undefined);

  return (
    <div className={`fl-exr${submitted ? " is-locked" : ""}`} data-fl="b.expense-report">
      <header className="fl-exr-head">
        <div className="fl-exr-name">
          <label htmlFor={`${uid}-title`} className="fl-sr">
            Report name
          </label>
          <TextField id={`${uid}-title`} size={44} value={title} readOnly={submitted} invalid={checked && !title.trim()} onChange={(e) => setTitle(e.target.value)} />
          <p>
            {owner} · {rows.length} {rows.length === 1 ? "expense" : "expenses"}
          </p>
        </div>
        <div className="fl-exr-total">
          <Badge tone={submitted ? "info" : "neutral"} led>
            {submitted ? "Submitted" : "Draft"}
          </Badge>
          <strong>{money.format(total / 100)}</strong>
        </div>
      </header>

      <div className="fl-exr-layout">
        <div className="fl-exr-lines">
          {rows.length === 0 ? (
            <div className="fl-exr-empty" data-fl="c.empty-state">
              <Icon name="paperclip" />
              <strong>No expenses yet</strong>
              <p>Add a line for each receipt.</p>
            </div>
          ) : (
            <ol className="fl-exr-list" aria-label="Expenses">
              {rows.map((r, n) => {
                const c = cat(r.category);
                const issues = review.get(r.id)?.issues ?? [];
                const shownIssues = issues.filter((i) => i.level === "warn" || checked);
                const e = (f: Issue["field"]) => show(r, f);
                const label = r.merchant.trim() || `line ${n + 1}`;
                return (
                  <li key={r.id} className={`fl-exr-line${shownIssues.some((i) => i.level === "error") ? " has-error" : ""}`} style={{ ["--fl-exr-i" as string]: Math.min(n, 8) }} aria-label={`Expense ${n + 1}: ${label}`}>
                    <div className="fl-exr-fields">
                      <div className="fl-exr-field fl-exr-date">
                        <label htmlFor={`${uid}-${r.id}-date`}>Date</label>
                        <TextField id={`${uid}-${r.id}-date`} type="date" size={40} max={today} value={r.date} readOnly={submitted} invalid={Boolean(e("date"))} aria-describedby={e("date") ? `${uid}-${r.id}-date-err` : undefined} onChange={(ev) => edit(r.id, { date: ev.target.value })} />
                      </div>
                      <div className="fl-exr-field fl-exr-merchant">
                        <label htmlFor={`${uid}-${r.id}-merchant`}>Merchant</label>
                        <TextField id={`${uid}-${r.id}-merchant`} size={40} value={r.merchant} readOnly={submitted} autoComplete="off" invalid={Boolean(e("merchant"))} aria-describedby={e("merchant") ? `${uid}-${r.id}-merchant-err` : undefined} onChange={(ev) => edit(r.id, { merchant: ev.target.value })} />
                      </div>
                      <div className="fl-exr-field fl-exr-cat">
                        <label htmlFor={`${uid}-${r.id}-cat`}>Category</label>
                        <Select id={`${uid}-${r.id}-cat`} value={r.category} disabled={submitted} options={categories.map((x) => ({ value: x.id, label: x.name }))} onChange={(ev) => edit(r.id, { category: ev.target.value })} />
                      </div>
                      <div className="fl-exr-field fl-exr-amount">
                        <label htmlFor={`${uid}-${r.id}-amount`}>Amount</label>
                        <span className="fl-exr-money">
                          <span aria-hidden="true">{symbol}</span>
                          <TextField
                            id={`${uid}-${r.id}-amount`}
                            size={40}
                            inputMode="decimal"
                            value={r.amountText}
                            readOnly={submitted}
                            placeholder="0.00"
                            invalid={Boolean(e("amount"))}
                            aria-describedby={e("amount") ? `${uid}-${r.id}-amount-err` : undefined}
                            onChange={(ev) => edit(r.id, { amountText: ev.target.value })}
                            onBlur={() => {
                              const c2 = toCents(r.amountText);
                              if (Number.isFinite(c2) && c2 > 0) edit(r.id, { amountText: plain(c2) });
                            }}
                          />
                        </span>
                      </div>
                    </div>
                    <div className="fl-exr-extra">
                      <div className="fl-exr-field fl-exr-note">
                        <label htmlFor={`${uid}-${r.id}-note`} className="fl-sr">
                          Note for {label}
                        </label>
                        <TextField id={`${uid}-${r.id}-note`} size={32} value={r.note} readOnly={submitted} placeholder="Note (optional)" onChange={(ev) => edit(r.id, { note: ev.target.value })} />
                      </div>
                      {c?.perPersonCap ? (
                        <div className="fl-exr-people">
                          <label htmlFor={`${uid}-${r.id}-people`}>People</label>
                          <Quantity id={`${uid}-${r.id}-people`} label={`People at ${label}`} size="sm" min={1} max={40} disabled={submitted} value={r.people ?? 1} onChange={(v) => edit(r.id, { people: v })} />
                        </div>
                      ) : null}
                      <div className="fl-exr-receipt">
                        {r.receipt ? (
                          <span className="fl-exr-file">
                            <Icon name="paperclip" />
                            <span title={r.receipt.name}>{r.receipt.name}</span>
                            {!submitted ? (
                              <button
                                type="button"
                                id={`${uid}-${r.id}-rm`}
                                className="fl-exr-x"
                                aria-label={`Remove receipt ${r.receipt.name}`}
                                onClick={() => {
                                  edit(r.id, { receipt: null });
                                  setSaid("Receipt removed.");
                                  focusLater(() => document.getElementById(`${uid}-${r.id}-receipt`));
                                }}
                              >
                                <Icon name="close" />
                              </button>
                            ) : null}
                          </span>
                        ) : (
                          <button
                            type="button"
                            id={`${uid}-${r.id}-receipt`}
                            className={`fl-exr-attach${e("receipt") ? " is-invalid" : ""}`}
                            disabled={submitted}
                            aria-disabled={uploading === r.id || undefined}
                            aria-describedby={e("receipt") ? `${uid}-${r.id}-receipt-err` : undefined}
                            aria-label={`Attach receipt for ${label}`}
                            onClick={() => uploading !== r.id && pick(r.id)}
                          >
                            {uploading === r.id ? <span className="fl-ctl-spinner" aria-hidden="true" /> : <Icon name="upload" />}
                            {uploading === r.id ? "Uploading…" : "Receipt"}
                          </button>
                        )}
                      </div>
                      {!submitted ? (
                        <Button variant="tertiary" size={40} icon="trash" iconOnly className="fl-exr-del" onClick={() => setDeleteId(r.id)} aria-label={`Delete ${label}`}>
                          Delete line
                        </Button>
                      ) : null}
                    </div>
                    {shownIssues.length || uploadErr?.id === r.id ? (
                      <ul className="fl-exr-issues">
                        {uploadErr?.id === r.id ? (
                          <li className="is-error" role="alert">
                            <Icon name="alert" />
                            {uploadErr.text}
                          </li>
                        ) : null}
                        {shownIssues.map((i) => (
                          <li key={i.text} className={`is-${i.level}`} id={i.field !== "row" ? `${uid}-${r.id}-${i.field}-err` : undefined}>
                            <Icon name={i.level === "error" ? "alert" : "info"} />
                            {i.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
          {!submitted ? (
            <Button id={`${uid}-add`} variant="secondary" size={40} icon="plus" onClick={add}>
              Add line
            </Button>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            hidden
            tabIndex={-1}
            onChange={(ev) => {
              void onFile(ev.target.files?.[0]);
              ev.target.value = "";
            }}
          />
        </div>

        <aside className="fl-exr-sum" aria-label="Totals">
          <h4>By category</h4>
          {byCat.length ? (
            <ul className="fl-exr-cats">
              {byCat.map(({ c, sum }) => (
                <li key={c.id} className={c.reimbursable ? undefined : "is-no"}>
                  <span>{c.name}</span>
                  <strong>{money.format(sum / 100)}</strong>
                  <span className="fl-exr-bar" aria-hidden="true">
                    <span style={{ ["--w" as string]: total ? sum / total : 0 }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-exr-muted">Amounts show here as you add them.</p>
          )}
          <dl className="fl-exr-dl">
            <dt>Total spent</dt>
            <dd>{money.format(total / 100)}</dd>
            <dt>Not paid back</dt>
            <dd>{money.format((total - payBack) / 100)}</dd>
            <dt className="is-big">Paid back to you</dt>
            <dd className="is-big">{money.format(payBack / 100)}</dd>
          </dl>
          {warns || (checked && errors.length) ? (
            <p className="fl-exr-flags">
              <Icon name="alert" />
              {checked && errors.length ? `${errors.length} to fix` : ""}
              {checked && errors.length && warns ? " · " : ""}
              {warns ? `${warns} policy ${warns === 1 ? "note" : "notes"}` : ""}
            </p>
          ) : null}
          {submitted ? (
            <Button id={`${uid}-recall`} variant="secondary" size={44} icon="refresh" busy={busy} block onClick={() => void recall()}>
              Recall to edit
            </Button>
          ) : (
            <Button id={`${uid}-submit`} variant="primary" size={44} icon="send" block onClick={trySubmit}>
              Submit
            </Button>
          )}
        </aside>
      </div>

      {deleting ? (
        <Modal
          variant="danger"
          icon="trash"
          title="Delete this expense?"
          description={`${deleting.merchant.trim() || "This line"}${toCents(deleting.amountText) > 0 ? `, ${money.format(toCents(deleting.amountText) / 100)}` : ""}${deleting.receipt ? ", and its receipt" : ""}.`}
          confirmLabel="Delete"
          cancelLabel="Keep"
          onConfirm={() => {
            doDelete();
            return false;
          }}
          onClose={() => setDeleteId(null)}
        />
      ) : null}

      {confirm ? (
        <Modal
          variant="confirm"
          title={`Submit ${rows.length} ${rows.length === 1 ? "expense" : "expenses"}?`}
          description={`${money.format(total / 100)} spent, ${money.format(payBack / 100)} to be paid back${warns ? `, with ${warns} policy ${warns === 1 ? "note" : "notes"} for your manager` : ""}.`}
          confirmLabel="Submit report"
          busy={busy}
          busyLabel="Submitting…"
          onConfirm={() => {
            void send();
            return false;
          }}
          onClose={() => setConfirm(false)}
        >
          <div className="fl-exr-agree">
            <Checkbox
              id={`${uid}-agree`}
              label="These are business expenses I paid myself."
              checked={agree}
              aria-describedby={agreeErr ? `${uid}-agree-err` : undefined}
              onChange={(ev) => {
                setAgree(ev.currentTarget.checked);
                setAgreeErr("");
              }}
            />
            {agreeErr ? (
              <p className="fl-exr-err" id={`${uid}-agree-err`}>
                <Icon name="alert" />
                {agreeErr}
              </p>
            ) : null}
            {sendErr ? (
              <p className="fl-exr-err" role="alert">
                <Icon name="alert" />
                {sendErr}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: ExpenseReportProps = {
  title: "Chicago site visit",
  owner: "Jordan Lee",
  policy: { receiptOver: 2500, maxAgeDays: 60 },
  categories: [
    { id: "air", name: "Airfare", reimbursable: true },
    { id: "hotel", name: "Lodging", reimbursable: true },
    { id: "meal", name: "Meals", perPersonCap: 7500, reimbursable: true },
    { id: "ground", name: "Taxi and rideshare", reimbursable: true },
    { id: "supplies", name: "Supplies", reimbursable: true },
    { id: "personal", name: "Personal", reimbursable: false },
  ],
  lines: [
    { id: "e1", date: daysAgo(9), merchant: "United Airlines", category: "air", amount: 41260, receipt: { name: "united-eticket.pdf", size: 182000 }, note: "" },
    { id: "e2", date: daysAgo(8), merchant: "Hyatt Regency Chicago", category: "hotel", amount: 52890, receipt: { name: "hyatt-folio.pdf", size: 96000 }, note: "2 nights" },
    { id: "e3", date: daysAgo(8), merchant: "Lyft", category: "ground", amount: 3840, receipt: { name: "lyft-ride.png", size: 54000 }, note: "" },
    { id: "e4", date: daysAgo(7), merchant: "Girl & the Goat", category: "meal", amount: 24650, receipt: null, note: "", people: 4 },
    { id: "e5", date: daysAgo(7), merchant: "Walgreens", category: "supplies", amount: 1899, receipt: null, note: "Safety glasses for the floor walk" },
    { id: "e6", date: daysAgo(6), merchant: "Hudson News", category: "personal", amount: 1250, receipt: null, note: "" },
  ],
};

export default function ExpenseReportPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ExpenseReport {...SAMPLE} />
      </div>
    </section>
  );
}
