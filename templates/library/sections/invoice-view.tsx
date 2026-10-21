/** @flowcode-library invoice-view · Invoice (Tables and lists)
 * Catalog ID: p.invoice-view (pattern)
 * Function: The invoice view (p.invoice-view): one invoice as a printable page (from, billed to, dates, line items, subtotal, discount, tax, total, payments and balance due) with the actions its status allows: edit a draft's lines (checked before saving), send it or a reminder by email, record a full or part payment, void it (asks first) and print just the invoice.
 * Use it as: import { InvoiceView } from "./invoice-view"; <InvoiceView invoice={{ number, status: "draft"|"open"|"paid"|"void", issued: "2026-10-01", due: "2026-10-31", currency: "USD", from: { name, lines: [...], email? }, to: { name, lines: [...], email? }, items: [{ id, description, detail?, qty, price }], taxRate?: 8.25, discount?: 0, payments?: [{ id, date, amount, method }], notes? }} now?={new Date()} locale? onSave?={(invoice) => ...} onSend?={async (email, message) => ...} onPayment?={(payment) => ...} onVoid?={() => ...} labels?={{ ... }} />
 * Built from: c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.select.outlined, c.modal.form, c.modal.danger
 * Look: A toolbar with the status pill and the allowed actions above a white paper sheet: the sender's name and address top left, "Invoice" and its number top right, a row of Billed to, Issued, Due and Amount due, a ruled line-item table, a right-aligned totals block ending in a bold Balance due, then payments and notes. Paid and Void invoices carry a tilted stamp. Printing hides everything but the sheet.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --font-display --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --radius-md --radius-lg --text-xs --text-sm --text-lg --text-2xl --weight-semibold --weight-bold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: invoice; invoice detail; billing; accounts receivable; client invoice; freelancer invoicing; receipt; quote; bill
 * Jobs to be done: check what a client owes; fix a line before sending; send an invoice; chase a late payment; record a payment that came in; print or save an invoice as PDF; cancel a wrong invoice
 * Keywords: invoice, billing, line items, totals, tax, payment, print, receipt, send, overdue
 */
/**
 * Invoice view: one invoice laid out like the paper it prints as, with the actions its status allows above it. A draft
 * has Edit (line items, tax rate and notes become fields; add and remove lines; Save checks every field first) and
 * Send. An open invoice past its due date shows Overdue and offers Send reminder, Record payment (full or part) and Void
 * (asks first). Paid and void invoices get a stamp. Print prints just the sheet, without the page around it. Totals are
 * worked out in cents. Make it the app's own: replace SAMPLE with the invoice, and save through onSave, onSend,
 * onPayment and onVoid.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its data tables and details lists.
 */
/**
 * How to try it
 * - Press Edit: change a quantity, clear a description and press Save; the field says why. Add a line, remove one,
 *   change the tax rate: the totals follow. Cancel puts everything back.
 * - Press Send: the email is filled in; send it and the invoice turns Open (past its due date, so Overdue).
 * - Press Record payment, enter more than is owed: it says so; enter $1,000 then record the rest: it turns Paid.
 * - Press Print: only the sheet prints. On a fresh copy press Void and confirm.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Badge, Button, TextField, Select and Modal
 * ("./badges-status", "./buttons-variants", "./text-fields-states", "./dropdowns-states", "./modals-dialogs") and its
 * inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css/r2h-invoice.css.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── p.invoice-view: a printable invoice with edit, send, payment and void. ──

export type InvoiceParty = { name: string; lines: string[]; email?: string };
export type InvoiceItem = { id: string; description: string; detail?: string; qty: number; price: number };
export type InvoicePayment = { id: string; date: string; amount: number; method: string };
export type InvoiceStatus = "draft" | "open" | "paid" | "void";
export type Invoice = {
  number: string;
  status: InvoiceStatus;
  issued: string;
  due: string;
  currency: string;
  from: InvoiceParty;
  to: InvoiceParty;
  items: InvoiceItem[];
  /** Percent, such as 8.25. */
  taxRate?: number;
  /** An amount off the subtotal, before tax. */
  discount?: number;
  payments?: InvoicePayment[];
  notes?: string;
};

export type InvoiceLabels = Partial<{
  edit: string;
  save: string;
  cancel: string;
  send: string;
  remind: string;
  pay: string;
  void: string;
  print: string;
  invoice: string;
  billedTo: string;
  issued: string;
  due: string;
  amountDue: string;
  description: string;
  qty: string;
  price: string;
  amount: string;
  addLine: string;
  removeLine: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paid: string;
  balance: string;
  payments: string;
  notes: string;
  fixFields: string;
}>;

export type InvoiceViewProps = {
  invoice: Invoice;
  /** "Today", for Overdue and new payment dates; the real date when left out. */
  now?: Date;
  locale?: string;
  /** Payment methods offered when recording a payment. */
  methods?: string[];
  onSave?: (invoice: Invoice) => void;
  /** Sends the invoice; reject to show the error in the dialog. */
  onSend?: (email: string, message: string) => Promise<void>;
  onPayment?: (payment: InvoicePayment) => void;
  onVoid?: () => void;
  labels?: InvoiceLabels;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cents = (n: number) => Math.round(n * 100);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Draft = { items: Array<Omit<InvoiceItem, "qty" | "price"> & { qty: string; price: string }>; taxRate: string; notes: string };
type Errors = Record<string, string>;

function totalsOf(items: Array<{ qty: number; price: number }>, discount: number, taxRate: number, payments: InvoicePayment[]) {
  const sub = items.reduce((s, it) => s + cents(it.qty * it.price), 0);
  const off = Math.min(cents(discount), sub);
  const tax = Math.round(((sub - off) * taxRate) / 100);
  const total = sub - off + tax;
  const paid = payments.reduce((s, p) => s + cents(p.amount), 0);
  return { sub, off, tax, total, paid, balance: Math.max(0, total - paid) };
}

export function InvoiceView({ invoice, now: nowProp, locale, methods = ["Bank transfer", "Card", "Check", "Cash"], onSave, onSend, onPayment, onVoid, labels = {} }: InvoiceViewProps) {
  const l = {
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    send: "Send",
    remind: "Send reminder",
    pay: "Record payment",
    void: "Void",
    print: "Print",
    invoice: "Invoice",
    billedTo: "Billed to",
    issued: "Issued",
    due: "Due",
    amountDue: "Amount due",
    description: "Description",
    qty: "Qty",
    price: "Price",
    amount: "Amount",
    addLine: "Add line",
    removeLine: "Remove line",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    total: "Total",
    paid: "Paid",
    balance: "Balance due",
    payments: "Payments",
    notes: "Notes",
    fixFields: "Fix the highlighted fields to save.",
    ...labels,
  };
  const id = useId();
  const now = nowProp ?? new Date();
  const [inv, setInv] = useState(invoice);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [fresh, setFresh] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"send" | "pay" | "void" | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const [printing, setPrinting] = useState(false);
  // When the button that opened a dialog goes away (paid, voided), focus lands on Print instead of the page.
  const printBtn = useRef<HTMLButtonElement>(null);
  const focusPrint = () => window.setTimeout(() => printBtn.current?.focus(), 50);

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: inv.currency }), [locale, inv.currency]);
  const m = (c: number) => money.format(c / 100);
  const day = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });
  const fmtDay = (d: string) => day.format(new Date(`${d}T12:00`));

  // While editing, the totals follow the fields (a field that isn't a number yet counts as 0).
  const liveItems = draft ? draft.items.map((it) => ({ qty: Number(it.qty) || 0, price: Number(it.price) || 0 })) : inv.items;
  const liveTax = draft ? Number(draft.taxRate) || 0 : inv.taxRate ?? 0;
  const t = totalsOf(liveItems, inv.discount ?? 0, liveTax, inv.payments ?? []);
  const overdue = inv.status === "open" && iso(now) > inv.due;
  const shown: { label: string; tone: BadgeTone } =
    inv.status === "paid" ? { label: "Paid", tone: "success" } : inv.status === "void" ? { label: "Void", tone: "neutral" } : inv.status === "draft" ? { label: "Draft", tone: "neutral" } : overdue ? { label: "Overdue", tone: "danger" } : { label: "Open", tone: "info" };

  // Print only the sheet: the page around it hides while the attribute is on.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    window.print();
    const t = window.setTimeout(done, 1000);
    return () => {
      window.removeEventListener("afterprint", done);
      window.clearTimeout(t);
    };
  }, [printing]);

  const startEdit = () => {
    setDraft({ items: inv.items.map((it) => ({ ...it, qty: String(it.qty), price: String(it.price) })), taxRate: String(inv.taxRate ?? 0), notes: inv.notes ?? "" });
    setErrors({});
    setStatus("Editing. Save or Cancel when you're done.");
  };
  const setItem = (iid: string, key: "description" | "qty" | "price", v: string) => {
    setDraft((d) => d && { ...d, items: d.items.map((it) => (it.id === iid ? { ...it, [key]: v } : it)) });
    if (errors[`${iid}-${key}`]) setErrors((e) => ({ ...e, [`${iid}-${key}`]: "" }));
  };
  const addLine = () => {
    const nid = `li-${Date.now()}`;
    setDraft((d) => d && { ...d, items: [...d.items, { id: nid, description: "", qty: "1", price: "0" }] });
    setFresh(nid);
    window.setTimeout(() => document.getElementById(`${id}-${nid}-description`)?.focus(), 0);
  };
  const removeLine = (iid: string, name: string) => {
    if (!draft) return;
    const at = draft.items.findIndex((it) => it.id === iid);
    const rest = draft.items.filter((it) => it.id !== iid);
    setDraft({ ...draft, items: rest });
    setStatus(`Removed ${name || "the empty line"}. Cancel brings it back.`);
    // Focus moves to the next line's remove button, or Add line when it was the last.
    window.setTimeout(() => {
      const next = rest[Math.min(at, rest.length - 1)];
      (next ? document.getElementById(`${id}-${next.id}-remove`) : document.getElementById(`${id}-add`))?.focus();
    }, 0);
  };
  const save = () => {
    if (!draft) return;
    const e: Errors = {};
    for (const it of draft.items) {
      if (!it.description.trim()) e[`${it.id}-description`] = "Enter a description.";
      const q = Number(it.qty);
      if (!it.qty.trim() || !Number.isInteger(q) || q < 1) e[`${it.id}-qty`] = "Whole number, 1 or more.";
      const p = Number(it.price);
      if (!it.price.trim() || !Number.isFinite(p) || p < 0) e[`${it.id}-price`] = "A price of 0 or more.";
    }
    const tr = Number(draft.taxRate);
    if (!draft.taxRate.trim() || !Number.isFinite(tr) || tr < 0 || tr > 100) e.taxRate = "0 to 100.";
    if (!draft.items.length) e.items = "Add at least one line.";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      setStatus(l.fixFields);
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    const next: Invoice = {
      ...inv,
      items: draft.items.map((it) => ({ id: it.id, description: it.description.trim(), detail: it.detail, qty: Number(it.qty), price: Number(it.price) })),
      taxRate: tr,
      notes: draft.notes.trim() || undefined,
    };
    setInv(next);
    setDraft(null);
    onSave?.(next);
    setStatus("Invoice saved.");
  };

  const send = (data: FormData) => {
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "");
    if (!EMAIL.test(email)) return (setDialogError({ email: email ? "Enter an email like name@company.com." : "Enter an email address." }), false as const);
    setDialogError({});
    setBusy(true);
    (onSend ? onSend(email, message) : new Promise<void>((r) => window.setTimeout(r, 700)))
      .then(() => {
        const was = inv.status;
        setInv((x) => ({ ...x, status: x.status === "draft" ? "open" : x.status }));
        setDialog(null);
        setStatus(was === "draft" ? `Invoice ${inv.number} sent to ${email}.` : `Reminder sent to ${email}.`);
      })
      .catch(() => setDialogError({ form: "Couldn't send. Check the address and try again." }))
      .finally(() => setBusy(false));
    return false as const;
  };

  const pay = (data: FormData) => {
    const raw = String(data.get("amount") ?? "").replace(/[^0-9.]/g, "");
    const amount = Number(raw);
    const method = String(data.get("method") ?? methods[0]);
    const date = String(data.get("date") ?? iso(now));
    if (!raw || !Number.isFinite(amount) || amount <= 0) return (setDialogError({ amount: "Enter an amount above 0." }), false as const);
    if (cents(amount) > t.balance) return (setDialogError({ amount: `That's more than the ${m(t.balance)} owed.` }), false as const);
    if (!date) return (setDialogError({ date: "Pick a date." }), false as const);
    const p: InvoicePayment = { id: `pay-${Date.now()}`, date, amount, method };
    const left = t.balance - cents(amount);
    setInv((x) => ({ ...x, payments: [...(x.payments ?? []), p], status: left === 0 ? "paid" : x.status }));
    onPayment?.(p);
    if (left === 0) focusPrint();
    setStatus(left === 0 ? `Payment of ${m(cents(amount))} recorded. Invoice ${inv.number} is paid.` : `Payment of ${m(cents(amount))} recorded. ${m(left)} still due.`);
  };

  const openDialog = (d: "send" | "pay" | "void") => {
    setDialogError({});
    setDialog(d);
  };

  const err = (key: string) =>
    errors[key] ? (
      <span id={`${id}-${key}-err`} className="fl-inv-err">
        {errors[key]}
      </span>
    ) : null;
  const errProps = (key: string) => ({ id: `${id}-${key}`, invalid: Boolean(errors[key]), "aria-describedby": errors[key] ? `${id}-${key}-err` : undefined });

  const editing = Boolean(draft);
  const canPay = inv.status === "open" && t.balance > 0;

  return (
    <section className="fl-inv" aria-labelledby={`${id}-title`} data-fl="p.invoice-view" data-printing={printing || undefined}>
      <div className="fl-inv-bar">
        <div className="fl-inv-bar-title">
          <Badge tone={shown.tone} led>
            {shown.label}
          </Badge>
          <span className="fl-inv-bar-due">{inv.status === "paid" ? `Paid in full` : inv.status === "void" ? "Not payable" : `${m(t.balance)} due ${fmtDay(inv.due)}`}</span>
        </div>
        <div className="fl-inv-actions">
          {editing ? (
            <>
              <Button variant="secondary" size={40} onClick={() => { setDraft(null); setErrors({}); setStatus("Changes discarded."); }}>
                {l.cancel}
              </Button>
              <Button size={40} icon="check" onClick={save}>
                {l.save}
              </Button>
            </>
          ) : (
            <>
              {inv.status === "draft" ? (
                <Button variant="secondary" size={40} icon="pencil" onClick={startEdit}>
                  {l.edit}
                </Button>
              ) : null}
              <Button ref={printBtn} variant="secondary" size={40} onClick={() => setPrinting(true)}>
                {l.print}
              </Button>
              {inv.status === "open" ? (
                <Button variant="tertiary" size={40} onClick={() => openDialog("void")}>
                  {l.void}
                </Button>
              ) : null}
              {inv.status === "draft" || inv.status === "open" ? (
                <Button variant={canPay ? "secondary" : "primary"} size={40} icon="send" onClick={() => openDialog("send")}>
                  {inv.status === "draft" ? l.send : l.remind}
                </Button>
              ) : null}
              {canPay ? (
                <Button size={40} icon="check" onClick={() => openDialog("pay")}>
                  {l.pay}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {editing && Object.values(errors).some(Boolean) ? (
        <p className="fl-inv-alert" role="alert">
          <Icon name="alert" />
          {errors.items || l.fixFields}
        </p>
      ) : null}

      <article className={`fl-inv-sheet${editing ? " is-editing" : ""}`} aria-labelledby={`${id}-title`}>
        {inv.status === "paid" || inv.status === "void" ? (
          <span className={`fl-inv-stamp fl-inv-stamp--${inv.status}`} aria-hidden="true">
            {inv.status === "paid" ? "Paid" : "Void"}
          </span>
        ) : null}
        <header className="fl-inv-top">
          <div className="fl-inv-from">
            <span className="fl-inv-mark" aria-hidden="true">
              {inv.from.name.slice(0, 1)}
            </span>
            <strong>{inv.from.name}</strong>
            {inv.from.lines.map((x) => (
              <span key={x}>{x}</span>
            ))}
            {inv.from.email ? <span>{inv.from.email}</span> : null}
          </div>
          <div className="fl-inv-titleblock">
            <h2 id={`${id}-title`}>{l.invoice}</h2>
            <span className="fl-inv-number">#{inv.number}</span>
          </div>
        </header>

        <dl className="fl-inv-meta">
          <div className="fl-inv-billed">
            <dt>{l.billedTo}</dt>
            <dd>
              <strong>{inv.to.name}</strong>
              {inv.to.lines.map((x) => (
                <span key={x}>{x}</span>
              ))}
              {inv.to.email ? <span>{inv.to.email}</span> : null}
            </dd>
          </div>
          <div>
            <dt>{l.issued}</dt>
            <dd>{fmtDay(inv.issued)}</dd>
          </div>
          <div>
            <dt>{l.due}</dt>
            <dd className={overdue ? "is-late" : undefined}>{fmtDay(inv.due)}</dd>
          </div>
          <div>
            <dt>{l.amountDue}</dt>
            <dd className="fl-inv-big">{m(inv.status === "void" ? 0 : t.balance)}</dd>
          </div>
        </dl>

        <table className="fl-inv-items">
          <caption className="fl-sr">Line items</caption>
          <thead>
            <tr>
              <th scope="col">{l.description}</th>
              <th scope="col" className="fl-inv-num">
                {l.qty}
              </th>
              <th scope="col" className="fl-inv-num">
                {l.price}
              </th>
              <th scope="col" className="fl-inv-num">
                {l.amount}
              </th>
              {editing ? (
                <th scope="col">
                  <span className="fl-sr">{l.removeLine}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {draft
              ? draft.items.map((it, i) => (
                  <tr key={it.id} className={fresh === it.id ? "is-new" : undefined}>
                    <td data-label={l.description}>
                      <TextField size={40} aria-label={`${l.description}, line ${i + 1}`} value={it.description} onChange={(e) => setItem(it.id, "description", e.target.value)} {...errProps(`${it.id}-description`)} />
                      {err(`${it.id}-description`)}
                    </td>
                    <td data-label={l.qty} className="fl-inv-num">
                      <TextField size={40} inputMode="numeric" className="fl-inv-small" aria-label={`${l.qty}, line ${i + 1}`} value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} {...errProps(`${it.id}-qty`)} />
                      {err(`${it.id}-qty`)}
                    </td>
                    <td data-label={l.price} className="fl-inv-num">
                      <TextField size={40} inputMode="decimal" className="fl-inv-small" aria-label={`${l.price}, line ${i + 1}`} value={it.price} onChange={(e) => setItem(it.id, "price", e.target.value)} {...errProps(`${it.id}-price`)} />
                      {err(`${it.id}-price`)}
                    </td>
                    <td data-label={l.amount} className="fl-inv-num fl-inv-amt">
                      {m(cents((Number(it.qty) || 0) * (Number(it.price) || 0)))}
                    </td>
                    <td className="fl-inv-rm">
                      <Button id={`${id}-${it.id}-remove`} variant="tertiary" size={32} icon="trash" iconOnly aria-label={`${l.removeLine} ${i + 1}${it.description ? `, ${it.description}` : ""}`} onClick={() => removeLine(it.id, it.description)}>
                        {l.removeLine}
                      </Button>
                    </td>
                  </tr>
                ))
              : inv.items.map((it) => (
                  <tr key={it.id}>
                    <td data-label={l.description}>
                      <strong>{it.description}</strong>
                      {it.detail ? <span className="fl-inv-detail">{it.detail}</span> : null}
                    </td>
                    <td data-label={l.qty} className="fl-inv-num">
                      {it.qty}
                    </td>
                    <td data-label={l.price} className="fl-inv-num">
                      {m(cents(it.price))}
                    </td>
                    <td data-label={l.amount} className="fl-inv-num fl-inv-amt">
                      {m(cents(it.qty * it.price))}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {editing ? (
          <div className="fl-inv-add">
            <Button id={`${id}-add`} variant="tertiary" size={32} icon="plus" onClick={addLine}>
              {l.addLine}
            </Button>
          </div>
        ) : null}

        <div className="fl-inv-foot">
          <div className="fl-inv-notes">
            {draft ? (
              <>
                <label htmlFor={`${id}-notes`}>{l.notes}</label>
                <TextField id={`${id}-notes`} multiline autoGrow rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </>
            ) : inv.notes ? (
              <>
                <h3>{l.notes}</h3>
                <p>{inv.notes}</p>
              </>
            ) : null}
            {inv.payments?.length ? (
              <>
                <h3>{l.payments}</h3>
                <ul className="fl-inv-pays">
                  {inv.payments.map((p) => (
                    <li key={p.id}>
                      <span>
                        {fmtDay(p.date)} · {p.method}
                      </span>
                      <strong>{m(cents(p.amount))}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          <dl className="fl-inv-totals">
            <div>
              <dt>{l.subtotal}</dt>
              <dd>{m(t.sub)}</dd>
            </div>
            {t.off ? (
              <div>
                <dt>{l.discount}</dt>
                <dd>−{m(t.off)}</dd>
              </div>
            ) : null}
            <div>
              <dt>
                {draft ? (
                  <label className="fl-inv-taxfield" htmlFor={`${id}-taxRate`}>
                    {l.tax}
                    <TextField size={32} inputMode="decimal" className="fl-inv-small" value={draft.taxRate} onChange={(e) => { setDraft({ ...draft, taxRate: e.target.value }); setErrors((x) => ({ ...x, taxRate: "" })); }} {...errProps("taxRate")} />%
                  </label>
                ) : (
                  `${l.tax} (${liveTax}%)`
                )}
                {err("taxRate")}
              </dt>
              <dd>{m(t.tax)}</dd>
            </div>
            <div className="fl-inv-total">
              <dt>{l.total}</dt>
              <dd>{m(t.total)}</dd>
            </div>
            {t.paid ? (
              <div>
                <dt>{l.paid}</dt>
                <dd>−{m(t.paid)}</dd>
              </div>
            ) : null}
            <div className="fl-inv-balance">
              <dt>{l.balance}</dt>
              <dd>{m(inv.status === "void" ? 0 : t.balance)}</dd>
            </div>
          </dl>
        </div>
      </article>

      <p className="fl-inv-status" role="status" aria-live="polite">
        {status}
      </p>

      {dialog === "send" ? (
        <Modal
          variant="form"
          title={inv.status === "draft" ? `Send invoice ${inv.number}` : `Remind ${inv.to.name}`}
          description={`They get a link to view and pay ${m(t.balance)}.`}
          confirmLabel={inv.status === "draft" ? l.send : l.remind}
          busy={busy}
          busyLabel="Sending…"
          onConfirm={send}
          onClose={() => setDialog(null)}
        >
          <div className="fl-inv-form">
            <div className="fl-inv-field">
              <label htmlFor={`${id}-to`}>To</label>
              <TextField id={`${id}-to`} name="email" type="email" size={40} defaultValue={inv.to.email} data-autofocus invalid={Boolean(dialogError.email)} aria-describedby={dialogError.email ? `${id}-to-err` : undefined} />
              {dialogError.email ? (
                <span id={`${id}-to-err`} className="fl-inv-err" role="alert">
                  {dialogError.email}
                </span>
              ) : null}
            </div>
            <div className="fl-inv-field">
              <label htmlFor={`${id}-msg`}>Message</label>
              <TextField
                id={`${id}-msg`}
                name="message"
                multiline
                rows={3}
                defaultValue={inv.status === "draft" ? `Hi, here's invoice ${inv.number} for ${m(t.balance)}, due ${fmtDay(inv.due)}. Thank you!` : `Hi, a friendly reminder that invoice ${inv.number} for ${m(t.balance)} was due ${fmtDay(inv.due)}.`}
              />
            </div>
            {dialogError.form ? (
              <p className="fl-inv-err" role="alert">
                {dialogError.form}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {dialog === "pay" ? (
        <Modal variant="form" title={l.pay} description={`${m(t.balance)} is still due.`} confirmLabel={l.pay} onConfirm={pay} onClose={() => setDialog(null)}>
          <div className="fl-inv-form">
            <div className="fl-inv-field">
              <label htmlFor={`${id}-amt`}>{l.amount}</label>
              <TextField id={`${id}-amt`} name="amount" inputMode="decimal" size={40} defaultValue={(t.balance / 100).toFixed(2)} data-autofocus invalid={Boolean(dialogError.amount)} aria-describedby={dialogError.amount ? `${id}-amt-err` : undefined} />
              {dialogError.amount ? (
                <span id={`${id}-amt-err`} className="fl-inv-err" role="alert">
                  {dialogError.amount}
                </span>
              ) : null}
            </div>
            <div className="fl-inv-row2">
              <div className="fl-inv-field">
                <label htmlFor={`${id}-date`}>Date</label>
                <TextField id={`${id}-date`} name="date" type="date" size={40} defaultValue={iso(now)} max={iso(now)} invalid={Boolean(dialogError.date)} />
              </div>
              <div className="fl-inv-field">
                <label htmlFor={`${id}-method`}>Method</label>
                <Select id={`${id}-method`} name="method" options={methods} />
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {dialog === "void" ? (
        <Modal
          variant="danger"
          icon="alert"
          title={`Void invoice ${inv.number}?`}
          description={`${inv.to.name} can no longer pay it. It stays in your records marked Void. This can't be undone.`}
          confirmLabel={l.void}
          onConfirm={() => {
            setInv((x) => ({ ...x, status: "void" }));
            onVoid?.();
            focusPrint();
            setStatus(`Invoice ${inv.number} voided.`);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  now: new Date("2026-10-21T10:00:00"),
  invoice: {
    number: "NL-2026-0142",
    status: "draft",
    issued: "2026-09-30",
    due: "2026-10-15",
    currency: "USD",
    from: { name: "Northlight Studio", lines: ["218 Alder Street, Suite 4", "Portland, OR 97204"], email: "billing@northlight.studio" },
    to: { name: "Harbor & Pine Co.", lines: ["Attn: Dana Whitfield", "77 Wharf Road", "Seattle, WA 98101"], email: "dana@harborpine.com" },
    items: [
      { id: "li1", description: "Brand identity refresh", detail: "Logo, color system and type scale", qty: 1, price: 4800 },
      { id: "li2", description: "Packaging design", detail: "Three SKUs, print-ready files", qty: 3, price: 950 },
      { id: "li3", description: "Product photography", detail: "Half-day shoot, 40 edited photos", qty: 1, price: 1650 },
      { id: "li4", description: "Revision rounds", detail: "Beyond the two included", qty: 4, price: 120 },
    ],
    taxRate: 8.25,
    discount: 500,
    payments: [],
    notes: "Thank you for working with us. Pay by bank transfer to the account on file or by card from the link in your email.",
  } as Invoice,
};

export default function InvoiceViewSheet() {
  return (
    <section className="fl-section fl-section--canvas fl-section--tint" aria-label={`Invoice ${SAMPLE.invoice.number}`}>
      <div className="fl-wrap fl-wrap--narrow">
        <InvoiceView {...SAMPLE} />
      </div>
    </section>
  );
}
