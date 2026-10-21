/** @flowcode-library business-details · Billing details (Forms)
 * Catalog ID: p.business-details (pattern)
 * Function: Billing details (p.business-details): who invoices are made out to, with fields that follow the answers (individual name; business legal name, trading name, size and an optional tax ID whose name and format follow the country: EIN, BN, VAT number, USt-IdNr., ABN; nonprofit registration and exemption certificate; copy-to addresses and a PO number only when asked); fields fold open and closed, a live summary shows the invoice and required fields done, Save checks open fields with the first problem focused, shows a server-side tax ID error and a saved time, and Discard changes asks first.
 * Use it as: import { BusinessDetails } from "./business-details"; <BusinessDetails title lede? value?={{ kind: "individual"|"business"|"nonprofit", country: "US", fullName, legalName, tradingName, size, hasTaxId, taxId, orgName, charityNumber, taxExempt, exemptionCert, email, sendCopies, ccEmails, needsPo, poNumber }} countries?={TAX_COUNTRIES} onSave?={async (details) => void} now?={() => new Date()} labels?={{ save, discard, summary, ... }} />  // throw new Error("tax-id") when the tax ID is rejected
 * Built from: c.choice-group.tile, c.text-field.outlined, c.select.outlined, c.switch, c.checkbox, c.button.primary, c.button.tertiary, c.modal.danger
 * Look: A white card with the title and a line of help; at the left a grouped form (three option tiles for Individual, Business and Nonprofit, the country, the fields for that kind with a switch or checkbox that folds more fields open, the billing email, copies and a PO number behind checkboxes) with Discard changes and Save details; at the right a sunken On your invoices card printing the bill-to block, a thin progress bar with how many required fields are done, and a note.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: billing details; business details; invoice settings; tax ID; company profile; billing profile; checkout for businesses; nonprofit discount
 * Jobs to be done: get invoices made out to my company; add our VAT or tax number so invoices show it; tell you we're tax-exempt; send invoices to our accounts team too; put our purchase order number on invoices
 * Keywords: billing, business details, company, tax id, vat, ein, invoice, nonprofit, tax exempt, purchase order, conditional fields
 */
/**
 * Billing details: a form that asks only what applies. Each answer that opens more questions (the kind of
 * customer, a tax ID, tax exemption, copies, a PO number) folds its fields open on grid rows and makes them inert
 * while closed, so hidden fields are never focused, checked or sent. The summary beside it is the same data as the
 * invoice would print it. Make it the app's own by setting `countries` to the tax IDs you collect and checking the
 * number on your server (throw Error("tax-id") to put the message under the field).
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its form elements page (inputs, select, checkbox and
 * toggle groups), and TailGrids (MIT, Copyright (c) 2025 Tailgrids): its field, radio and collapsible components.
 */
/**
 * How to try it
 * - Switch between Individual, Business and Nonprofit: the fields fold open and closed and the summary follows.
 * - As a Business, turn on Add a tax ID and save with it empty: it says why and takes focus. Change the country to
 *   Germany: the field becomes USt-IdNr. with its own format. Type "DE000000000" and save: the server rejects it.
 * - Tick Send copies and type "accounts@, finance@example.com": it names the address that isn't valid.
 * - Fix everything and save: it works, then shows when it was saved. Change something and press Discard changes:
 *   it asks first, then puts back the last saved details.
 *
 * Dependencies: React (useId, useState), the library's ChoiceGroup and Checkbox, TextField, Select, Switch, Button
 * and Modal ("./checkboxes-radios", "./text-fields-states", "./dropdowns-states", "./switches-states",
 * "./buttons-variants", "./modals-dialogs") and its inline icon set ("./icons"). Nothing else: no package and nothing
 * fetched. The styles are the library's own fl- classes in templates/library/css/r4d-business-details.css.
 */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Checkbox, ChoiceGroup } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── p.business-details: billing details whose fields follow the answers, with a live invoice summary. ──

export type CustomerKind = "individual" | "business" | "nonprofit";
export type BusinessDetailsValue = {
  kind: CustomerKind;
  country: string;
  fullName: string;
  legalName: string;
  tradingName: string;
  size: string;
  hasTaxId: boolean;
  taxId: string;
  orgName: string;
  charityNumber: string;
  taxExempt: boolean;
  exemptionCert: string;
  email: string;
  sendCopies: boolean;
  ccEmails: string;
  needsPo: boolean;
  poNumber: string;
};
export type TaxCountry = { code: string; name: string; taxLabel: string; pattern: RegExp; example: string; clean?: (v: string) => string };

const upper = (v: string) => v.toUpperCase().replace(/[\s.]/g, "");
export const TAX_COUNTRIES: TaxCountry[] = [
  { code: "US", name: "United States", taxLabel: "EIN", pattern: /^\d{2}-\d{7}$/, example: "12-3456789", clean: (v) => (/^\d{9}$/.test(v.replace(/\D/g, "")) ? v.replace(/\D/g, "").replace(/^(\d{2})/, "$1-") : v.trim()) },
  { code: "CA", name: "Canada", taxLabel: "Business Number (BN)", pattern: /^\d{9}$/, example: "123456789", clean: (v) => v.replace(/\s/g, "") },
  { code: "GB", name: "United Kingdom", taxLabel: "VAT number", pattern: /^GB\d{9}$/, example: "GB123456789", clean: upper },
  { code: "DE", name: "Germany", taxLabel: "USt-IdNr. (VAT ID)", pattern: /^DE\d{9}$/, example: "DE123456789", clean: upper },
  { code: "FR", name: "France", taxLabel: "VAT number", pattern: /^FR[0-9A-Z]{2}\d{9}$/, example: "FR12345678901", clean: upper },
  { code: "AU", name: "Australia", taxLabel: "ABN", pattern: /^\d{11}$/, example: "51824753556", clean: (v) => v.replace(/\s/g, "") },
];
const SIZES = ["Just me", "2–10 people", "11–50 people", "51–200 people", "201 or more"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));

export type BusinessDetailsLabels = Partial<{
  kindLabel: string;
  individual: string;
  individualText: string;
  business: string;
  businessText: string;
  nonprofit: string;
  nonprofitText: string;
  country: string;
  fullName: string;
  legalName: string;
  tradingName: string;
  size: string;
  sizePick: string;
  hasTaxId: string;
  orgName: string;
  charityNumber: string;
  taxExempt: string;
  taxExemptText: string;
  exemptionCert: string;
  email: string;
  sendCopies: string;
  ccEmails: string;
  ccHint: string;
  needsPo: string;
  poNumber: string;
  optional: string;
  contact: string;
  summary: string;
  billTo: string;
  progress: string;
  nextInvoice: string;
  save: string;
  saving: string;
  discard: string;
  discardTitle: string;
  discardText: string;
  saved: string;
  failed: string;
  required: string;
  badFormat: string;
  badEmail: string;
  badCc: string;
  taxRejected: string;
  exempt: string;
  po: string;
  copies: string;
}>;

export type BusinessDetailsProps = {
  title: string;
  lede?: string;
  value?: Partial<BusinessDetailsValue>;
  countries?: TaxCountry[];
  /** Stores the details (only the fields that apply). Throw Error("tax-id") for a rejected tax ID; anything else shows a general error. */
  onSave?: (details: Partial<BusinessDetailsValue>) => Promise<void>;
  /** "Today" for the saved line; the real time when left out. */
  now?: () => Date;
  labels?: BusinessDetailsLabels;
};

const EMPTY: BusinessDetailsValue = {
  kind: "business",
  country: "US",
  fullName: "",
  legalName: "",
  tradingName: "",
  size: "",
  hasTaxId: false,
  taxId: "",
  orgName: "",
  charityNumber: "",
  taxExempt: false,
  exemptionCert: "",
  email: "",
  sendCopies: false,
  ccEmails: "",
  needsPo: false,
  poNumber: "",
};
type Key = keyof BusinessDetailsValue;

/** Fields that open with an answer: grid rows 0fr to 1fr, inert while closed. */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={["fl-bzd-fold", open ? "is-open" : ""].filter(Boolean).join(" ")} inert={!open || undefined}>
      <div>{children}</div>
    </div>
  );
}

export function BusinessDetails({ title, lede, value, countries = TAX_COUNTRIES, onSave, now = () => new Date(), labels = {} }: BusinessDetailsProps) {
  const l = {
    kindLabel: "Who are invoices for?",
    individual: "Individual",
    individualText: "Just you",
    business: "Business",
    businessText: "A company or sole trader",
    nonprofit: "Nonprofit",
    nonprofitText: "A charity or school",
    country: "Country",
    fullName: "Full name",
    legalName: "Legal business name",
    tradingName: "Trading name",
    size: "Company size",
    sizePick: "Choose a size",
    hasTaxId: "Add a tax ID to invoices",
    orgName: "Organization name",
    charityNumber: "Registration number",
    taxExempt: "We're tax-exempt",
    taxExemptText: "We won't add sales tax once your certificate is on file.",
    exemptionCert: "Exemption certificate number",
    email: "Billing email",
    sendCopies: "Send copies to more people",
    ccEmails: "Copy invoices to",
    ccHint: "Separate addresses with commas.",
    needsPo: "We need a purchase order number on invoices",
    poNumber: "PO number",
    optional: "optional",
    contact: "Where invoices go",
    summary: "On your invoices",
    billTo: "Bill to",
    progress: "{done} of {all} required done",
    nextInvoice: "Changes apply from your next invoice.",
    save: "Save details",
    saving: "Saving…",
    discard: "Discard changes",
    discardTitle: "Discard your changes?",
    discardText: "The form goes back to the last saved details.",
    saved: "Saved at {time}.",
    failed: "Couldn't save your details. Try again.",
    required: "Enter the {field}.",
    badFormat: "Use the format {example}.",
    badEmail: "Enter an email address like name@example.com.",
    badCc: "“{bad}” isn't a valid email address.",
    taxRejected: "We couldn't verify that number. Check it and try again.",
    exempt: "Tax-exempt",
    po: "PO",
    copies: "Copies",
    ...labels,
  };
  const id = useId();
  const [saved, setSaved] = useState<BusinessDetailsValue>({ ...EMPTY, ...value });
  const [form, setForm] = useState<BusinessDetailsValue>({ ...EMPTY, ...value });
  const [errors, setErrors] = useState<Partial<Record<Key | "form", string>>>({});
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [savedLine, setSavedLine] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const tax = countries.find((c) => c.code === form.country) ?? countries[0]!;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = <K extends Key>(k: K, v: BusinessDetailsValue[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSavedLine("");
    if (errors[k] || errors.form) setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  // Which fields are open and required right now, in the order they appear.
  const isBiz = form.kind === "business";
  const isNon = form.kind === "nonprofit";
  const requiredNow: Key[] = [
    ...(form.kind === "individual" ? (["fullName"] as Key[]) : []),
    ...(isBiz ? (["legalName", "size"] as Key[]) : []),
    ...(isBiz && form.hasTaxId ? (["taxId"] as Key[]) : []),
    ...(isNon ? (["orgName", "charityNumber"] as Key[]) : []),
    ...(isNon && form.taxExempt ? (["exemptionCert"] as Key[]) : []),
    "email",
    ...(form.sendCopies ? (["ccEmails"] as Key[]) : []),
    ...(form.needsPo ? (["poNumber"] as Key[]) : []),
  ];
  const doneCount = requiredNow.filter((k) => String(form[k]).trim()).length;
  const nameOf = (k: Key) => (k === "taxId" ? tax.taxLabel : String(l[k as keyof typeof l] ?? k)).replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());

  const ccList = form.ccEmails
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const clean: BusinessDetailsValue = { ...form, taxId: tax.clean ? tax.clean(form.taxId) : form.taxId.trim(), email: form.email.trim() };
    const err: Partial<Record<Key, string>> = {};
    for (const k of requiredNow) if (!String(clean[k]).trim()) err[k] = l.required.replace("{field}", nameOf(k));
    if (!err.taxId && requiredNow.includes("taxId") && !tax.pattern.test(clean.taxId)) err.taxId = l.badFormat.replace("{example}", tax.example);
    if (!err.email && !EMAIL.test(clean.email)) err.email = l.badEmail;
    if (!err.ccEmails && form.sendCopies) {
      const bad = ccList.find((x) => !EMAIL.test(x));
      if (bad) err.ccEmails = l.badCc.replace("{bad}", bad);
    }
    setForm(clean);
    setErrors(err);
    const firstBad = requiredNow.concat(["email"]).find((k) => err[k]);
    if (firstBad) {
      setShake((n) => n + 1);
      window.setTimeout(() => document.getElementById(`${id}-${firstBad}`)?.focus(), 0);
      return;
    }
    // Only the fields that apply are sent.
    const out: Partial<BusinessDetailsValue> = { kind: clean.kind, country: clean.country, email: clean.email };
    for (const k of requiredNow) (out as Record<string, unknown>)[k] = clean[k];
    if (isBiz) Object.assign(out, { tradingName: clean.tradingName.trim(), hasTaxId: clean.hasTaxId });
    if (isNon) out.taxExempt = clean.taxExempt;
    out.sendCopies = clean.sendCopies;
    out.needsPo = clean.needsPo;
    setBusy(true);
    try {
      await (onSave ? onSave(out) : wait(800));
      setSaved(clean);
      setSavedLine(l.saved.replace("{time}", new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now())));
    } catch (ex) {
      if (ex instanceof Error && ex.message === "tax-id") {
        setErrors({ taxId: l.taxRejected });
        setShake((n) => n + 1);
        window.setTimeout(() => document.getElementById(`${id}-taxId`)?.focus(), 0);
      } else setErrors({ form: l.failed });
    } finally {
      setBusy(false);
    }
  };

  const discard = () => {
    setForm(saved);
    setErrors({});
    setSavedLine("");
    // Discard is disabled once nothing has changed, so focus moves on to Save.
    window.setTimeout(() => document.getElementById(`${id}-save`)?.focus(), 0);
  };

  const shakeAttr = shake ? (shake % 2 ? "a" : "b") : undefined;
  const msg = (k: Key, hint?: string) => {
    const ids = [errors[k] ? `${id}-${k}-err` : "", hint ? `${id}-${k}-hint` : ""].filter(Boolean).join(" ") || undefined;
    return {
      ids,
      node: (
        <>
          {hint ? (
            <p id={`${id}-${k}-hint`} className="fl-bzd-hint">
              {hint}
            </p>
          ) : null}
          {errors[k] ? (
            <p id={`${id}-${k}-err`} className="fl-bzd-error" role="alert">
              <Icon name="alert" />
              {errors[k]}
            </p>
          ) : null}
        </>
      ),
    };
  };
  const text = (k: Key, label: string, opts: { optional?: boolean; hint?: string; placeholder?: string; type?: string; auto?: string; mono?: boolean } = {}) => {
    const m = msg(k, opts.hint);
    return (
      <div className="fl-bzd-field" data-shake={errors[k] ? shakeAttr : undefined}>
        <label htmlFor={`${id}-${k}`}>
          {label}
          {opts.optional ? <span className="fl-bzd-opt"> ({l.optional})</span> : null}
        </label>
        <TextField
          id={`${id}-${k}`}
          size={40}
          type={opts.type ?? "text"}
          autoComplete={opts.auto}
          placeholder={opts.placeholder}
          className={opts.mono ? "fl-bzd-mono" : undefined}
          value={String(form[k])}
          invalid={Boolean(errors[k])}
          aria-required={!opts.optional || undefined}
          aria-describedby={m.ids}
          onChange={(e) => set(k, e.currentTarget.value as never)}
        />
        {m.node}
      </div>
    );
  };

  const billName = form.kind === "individual" ? form.fullName : isBiz ? form.legalName : form.orgName;
  const summaryLines: [string, string][] = [
    ...(isBiz && form.tradingName.trim() ? ([["Trading as", form.tradingName.trim()]] as [string, string][]) : []),
    ...(isBiz && form.hasTaxId && form.taxId.trim() ? ([[tax.taxLabel, tax.clean ? tax.clean(form.taxId) : form.taxId]] as [string, string][]) : []),
    ...(isNon && form.charityNumber.trim() ? ([[l.charityNumber, form.charityNumber.trim()]] as [string, string][]) : []),
    ...(isNon && form.taxExempt ? ([[l.exempt, form.exemptionCert.trim() || "…"]] as [string, string][]) : []),
    ...(form.needsPo ? ([[l.po, form.poNumber.trim() || "…"]] as [string, string][]) : []),
  ];

  return (
    <section className="fl-bzd" aria-labelledby={`${id}-title`} data-fl="p.business-details">
      <header className="fl-bzd-head">
        <h2 id={`${id}-title`}>{title}</h2>
        {lede ? <p>{lede}</p> : null}
      </header>

      <div className="fl-bzd-body">
        <form className="fl-bzd-form" noValidate onSubmit={(e) => void submit(e)} aria-busy={busy || undefined}>
          <div className="fl-bzd-group">
            <ChoiceGroup
              variant="tile"
              label={l.kindLabel}
              value={form.kind}
              onChange={(v) => {
                set("kind", v as CustomerKind);
                setErrors({});
              }}
              options={[
                { value: "individual", label: l.individual, text: l.individualText },
                { value: "business", label: l.business, text: l.businessText },
                { value: "nonprofit", label: l.nonprofit, text: l.nonprofitText },
              ]}
              className="fl-bzd-kinds"
            />
            <div className="fl-bzd-field">
              <label htmlFor={`${id}-country`}>{l.country}</label>
              <Select
                id={`${id}-country`}
                value={form.country}
                autoComplete="country"
                onChange={(e) => {
                  set("country", e.currentTarget.value);
                  setErrors((x) => ({ ...x, taxId: undefined }));
                }}
                options={countries.map((c) => ({ value: c.code, label: c.name }))}
              />
            </div>

            <Fold open={form.kind === "individual"}>{text("fullName", l.fullName, { auto: "name" })}</Fold>

            <Fold open={isBiz}>
              <div className="fl-bzd-stack">
                {text("legalName", l.legalName, { auto: "organization" })}
                <div className="fl-bzd-row">
                  {text("tradingName", l.tradingName, { optional: true })}
                  <div className="fl-bzd-field" data-shake={errors.size ? shakeAttr : undefined}>
                    <label htmlFor={`${id}-size`}>{l.size}</label>
                    <Select
                      id={`${id}-size`}
                      value={form.size}
                      placeholder={l.sizePick}
                      invalid={Boolean(errors.size)}
                      aria-required
                      aria-describedby={errors.size ? `${id}-size-err` : undefined}
                      onChange={(e) => set("size", e.currentTarget.value)}
                      options={SIZES}
                    />
                    {msg("size").node}
                  </div>
                </div>
                <label className="fl-bzd-switch">
                  <Switch size={20} on={form.hasTaxId} label={l.hasTaxId} onToggle={(v) => set("hasTaxId", v)} />
                  <span>{l.hasTaxId}</span>
                </label>
                <Fold open={isBiz && form.hasTaxId}>{text("taxId", tax.taxLabel, { placeholder: tax.example, hint: `Format: ${tax.example}`, mono: true })}</Fold>
              </div>
            </Fold>

            <Fold open={isNon}>
              <div className="fl-bzd-stack">
                {text("orgName", l.orgName, { auto: "organization" })}
                {text("charityNumber", l.charityNumber, { mono: true })}
                <Checkbox label={l.taxExempt} description={l.taxExemptText} checked={form.taxExempt} onChange={(e) => set("taxExempt", e.currentTarget.checked)} />
                <Fold open={isNon && form.taxExempt}>{text("exemptionCert", l.exemptionCert, { mono: true })}</Fold>
              </div>
            </Fold>
          </div>

          <div className="fl-bzd-group">
            <h3 className="fl-bzd-sub">{l.contact}</h3>
            {text("email", l.email, { type: "email", auto: "email", placeholder: "billing@example.com" })}
            <Checkbox label={l.sendCopies} checked={form.sendCopies} onChange={(e) => set("sendCopies", e.currentTarget.checked)} />
            <Fold open={form.sendCopies}>{text("ccEmails", l.ccEmails, { hint: l.ccHint, placeholder: "accounts@example.com, finance@example.com" })}</Fold>
            <Checkbox label={l.needsPo} checked={form.needsPo} onChange={(e) => set("needsPo", e.currentTarget.checked)} />
            <Fold open={form.needsPo}>{text("poNumber", l.poNumber, { mono: true })}</Fold>
          </div>

          {errors.form ? (
            <p className="fl-bzd-error" role="alert">
              <Icon name="alert" />
              {errors.form}
            </p>
          ) : null}

          <div className="fl-bzd-btns">
            <p className="fl-bzd-savedline" role="status" aria-live="polite">
              {savedLine ? (
                <>
                  <Icon name="check" />
                  {savedLine}
                </>
              ) : null}
            </p>
            <Button type="button" variant="tertiary" size={40} disabled={!dirty || busy} onClick={() => setConfirmDiscard(true)}>
              {l.discard}
            </Button>
            <Button id={`${id}-save`} type="submit" size={40} busy={busy}>
              {busy ? l.saving : l.save}
            </Button>
          </div>
        </form>

        <aside className="fl-bzd-summary" aria-labelledby={`${id}-sum`}>
          <p className="fl-bzd-sumtitle" id={`${id}-sum`}>
            <Icon name="paperclip" />
            {l.summary}
          </p>
          <div className="fl-bzd-invoice">
            <span className="fl-bzd-billto">{l.billTo}</span>
            <strong className={billName.trim() ? undefined : "fl-bzd-placeholder"}>{billName.trim() || (form.kind === "individual" ? l.fullName : isBiz ? l.legalName : l.orgName)}</strong>
            <span>{tax.name}</span>
            <span className={form.email.trim() ? undefined : "fl-bzd-placeholder"}>{form.email.trim() || l.email}</span>
            {summaryLines.length ? (
              <dl>
                {summaryLines.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {form.sendCopies && ccList.length ? (
              <span className="fl-bzd-cc">
                {l.copies}: {ccList.join(", ")}
              </span>
            ) : null}
          </div>
          <div className="fl-bzd-progress">
            <div className="fl-bzd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={requiredNow.length} aria-valuenow={doneCount} aria-label={l.progress.replace("{done}", String(doneCount)).replace("{all}", String(requiredNow.length))}>
              <span style={{ scale: `${requiredNow.length ? doneCount / requiredNow.length : 0} 1` }} data-done={doneCount === requiredNow.length || undefined} />
            </div>
            <p>{l.progress.replace("{done}", String(doneCount)).replace("{all}", String(requiredNow.length))}</p>
          </div>
          <p className="fl-bzd-note">{l.nextInvoice}</p>
        </aside>
      </div>

      {confirmDiscard ? <Modal variant="danger" icon="refresh" title={l.discardTitle} description={l.discardText} confirmLabel={l.discard} onConfirm={() => discard()} onClose={() => setConfirmDiscard(false)} /> : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Billing details",
  lede: "How your invoices are made out.",
  value: { kind: "business", country: "US", legalName: "Northlight Studio LLC", tradingName: "Northlight", size: "11–50 people", email: "billing@northlight.example" } as Partial<BusinessDetailsValue>,
};

export default function BusinessDetailsSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <BusinessDetails
          {...SAMPLE}
          onSave={async (d) => {
            await wait(800);
            // The sample server rejects a tax ID made only of zeros.
            if (d.taxId && /^\D*0+$/.test(d.taxId.replace(/-/g, ""))) throw new Error("tax-id");
          }}
        />
      </div>
    </section>
  );
}
