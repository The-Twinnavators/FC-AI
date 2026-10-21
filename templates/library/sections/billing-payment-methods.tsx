/** @flowcode-library billing-payment-methods · Payment methods and billing details (Forms)
 * Catalog ID: p.payment-methods (pattern)
 * Function: Payment methods and billing details (p.payment-methods): the saved cards with the brand, last four digits, expiry and Default, Expires soon or Expired pills; make another card the default (the list glides to put it first), remove a card after a confirm (never the default), add a card in a panel that folds open with the card fields; and the billing details (company, contact, invoice email, tax ID, address) edited in a checked form dialog.
 * Use it as: import { PaymentMethods } from "./billing-payment-methods"; <PaymentMethods title lede? cards={[{ id, brand: "visa"|"mastercard"|"amex"|"discover", last4, expMonth, expYear, name }]} defaultId="c1" billing={{ company, contact, email, taxId?, address }} now?={new Date()} addCard?={async (card) => id} onDefault?={(id) => ...} onRemove?={(id) => ...} saveBilling?={async (billing) => void} labels?={{ add, makeDefault, remove, ... }} />
 * Built from: c.card-fields, c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.badge.status, c.modal.form, c.modal.danger, c.empty-state.first-use
 * Look: Two white cards. Payment methods: a title with Add card over rows of cards, each a small brand plate (VISA, MC, AMEX) beside the masked number, the name and expiry, a Default, Expires soon or Expired pill, and Make default and a trash button; Add card folds open a sunken panel with the card fields. Billing details: label and value pairs in two columns with Edit at the top right.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: billing settings; payment methods; saved cards; subscription billing; account billing; invoice details; company billing profile; checkout settings
 * Jobs to be done: add a new card; choose which card is charged; remove an old card; see when a card expires; update the company name and tax ID on invoices
 * Keywords: billing, payment methods, cards, credit card, default card, remove card, billing address, tax id, vat, invoice email
 */
/**
 * Payment methods and billing details: the cards on file (the default first) and who invoices are made out to. Make
 * default moves a card to the top; Remove asks first and is never offered on the default card; Add card folds open the
 * library's card fields and closes again once the card is saved. Edit opens the billing details in a form dialog that
 * checks the required fields and the email. Make it the app's own: replace SAMPLE, hand the card to the payment
 * provider's tokenizing call in `addCard` (never store the full number), and save through onDefault, onRemove and
 * saveBilling.
 * Adapted from Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): its payment method and billing information blocks.
 */
/**
 * How to try it
 * - Press Make default on the Visa: it glides to the top with the Default pill, and the Mastercard gets a trash button.
 * - Press the trash button on the expired card and confirm: it fades out and focus lands on Add card.
 * - Press Add card: the panel folds open. Use 4242 4242 4242 4242, a future expiry and any code; Save card adds it and
 *   the panel closes. Press Cancel to fold it away without saving.
 * - Press Edit on Billing details, clear the company and type "ana@" as the email: Save shows both errors.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's CardFields, Button,
 * TextField, Badge, Modal and EmptyState ("./input-card-number", "./buttons-variants", "./text-fields-states",
 * "./badges-status", "./modals-dialogs", "./empty-states") and its inline icon set ("./icons"). Nothing else: no package
 * and nothing fetched. The styles are the library's own fl- classes in templates/library/css/r3c-payment-methods.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { CardFields, type CardBrand, type SavedCard } from "./input-card-number";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── p.payment-methods: saved cards with a default, plus who invoices are made out to. ──

export type StoredCard = { id: string; brand: CardBrand; last4: string; expMonth: number; expYear: number; name: string };
export type BillingProfile = { company: string; contact: string; email: string; taxId?: string; address: string };

export type PaymentMethodsLabels = Partial<{
  cardsTitle: string;
  billingTitle: string;
  add: string;
  cancel: string;
  makeDefault: string;
  isDefault: string;
  remove: string;
  expires: string;
  expired: string;
  soon: string;
  defaultHint: string;
  empty: string;
  emptyText: string;
  edit: string;
}>;

export type PaymentMethodsProps = {
  title: string;
  lede?: string;
  cards: StoredCard[];
  defaultId?: string;
  billing: BillingProfile;
  /** "Today" for the expiry pills; the real date when left out. */
  now?: Date;
  /** Hands the new card to the payment provider and resolves with its id; throw to show the card fields' error. */
  addCard?: (card: SavedCard) => Promise<string>;
  onDefault?: (id: string) => void;
  onRemove?: (id: string) => void;
  /** Saves the billing details; throw to show an error in the dialog. Waits a moment when left out. */
  saveBilling?: (billing: BillingProfile) => Promise<void>;
  labels?: PaymentMethodsLabels;
};

const BRAND: Record<CardBrand, { plate: string; name: string }> = {
  visa: { plate: "VISA", name: "Visa" },
  mastercard: { plate: "MC", name: "Mastercard" },
  amex: { plate: "AMEX", name: "American Express" },
  discover: { plate: "DISC", name: "Discover" },
};
const reduced = () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off");
const wait = (t: number) => new Promise((r) => window.setTimeout(r, t));
const ms = (el: Element, name: string, fallback: number) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith("ms") ? n : n * 1000) : fallback;
};

/** FLIP: rows marked data-flip glide from where they were to where they are now whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const rows = [...el.querySelectorAll<HTMLElement>("[data-flip]")];
    const now = new Map(rows.map((r) => [r.dataset.flip!, r.getBoundingClientRect().top]));
    if (!reduced()) {
      const duration = ms(el, "--duration-slow", 300);
      const easing = getComputedStyle(el).getPropertyValue("--ease-out").trim() || "ease-out";
      for (const r of rows) {
        const was = last.current.get(r.dataset.flip!);
        const dy = was === undefined ? 0 : was - now.get(r.dataset.flip!)!;
        if (Math.abs(dy) > 1) r.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration, easing });
      }
    }
    last.current = now;
  }, [box, key]);
}

export function PaymentMethods({ title, lede, cards, defaultId, billing, now: nowProp, addCard, onDefault, onRemove, saveBilling, labels = {} }: PaymentMethodsProps) {
  const l = {
    cardsTitle: "Payment methods",
    billingTitle: "Billing details",
    add: "Add card",
    cancel: "Cancel",
    makeDefault: "Make default",
    isDefault: "Default",
    remove: "Remove",
    expires: "Expires {date}",
    expired: "Expired",
    soon: "Expires soon",
    defaultHint: "To remove your default card, make another card the default first.",
    empty: "No payment method",
    emptyText: "Add a card so your plan keeps running.",
    edit: "Edit",
    ...labels,
  };
  const id = useId();
  const now = nowProp ?? new Date();
  const [list, setList] = useState(cards);
  const [def, setDef] = useState(defaultId ?? cards[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<StoredCard | null>(null);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);
  const [profile, setProfile] = useState(billing);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [entering, setEntering] = useState(true);
  const [formKey, setFormKey] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const addBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setEntering(false), 900);
    return () => window.clearTimeout(t);
  }, []);

  const sorted = useMemo(() => [...list].sort((a, b) => Number(b.id === def) - Number(a.id === def)), [list, def]);
  useFlip(listRef, sorted.map((c) => c.id).join());

  const month = now.getFullYear() * 12 + now.getMonth();
  const state = (c: StoredCard) => {
    const left = c.expYear * 12 + (c.expMonth - 1) - month;
    return left < 0 ? "expired" : left <= 2 ? "soon" : "ok";
  };
  const exp = (c: StoredCard) => `${String(c.expMonth).padStart(2, "0")}/${String(c.expYear).slice(-2)}`;
  const label = (c: StoredCard) => `${BRAND[c.brand].name} ending in ${c.last4}`;

  const makeDefault = (c: StoredCard) => {
    setDef(c.id);
    onDefault?.(c.id);
    setStatus(`${label(c)} is now your default card.`);
    window.setTimeout(() => document.getElementById(`${id}-${c.id}-row`)?.focus(), 0);
  };

  const remove = (c: StoredCard) => {
    setLeaving((xs) => [...xs, c.id]);
    setStatus(`${label(c)} removed.`);
    onRemove?.(c.id);
    const go = () => {
      setList((xs) => xs.filter((x) => x.id !== c.id));
      setLeaving((xs) => xs.filter((x) => x !== c.id));
    };
    if (reduced() || !listRef.current) go();
    else window.setTimeout(go, ms(listRef.current, "--duration-base", 200));
    window.setTimeout(() => addBtn.current?.focus(), 0);
  };

  const save = async (card: SavedCard) => {
    // The same card twice would only confuse which one is charged; the card fields show their error instead.
    if (list.some((c) => c.brand === card.brand && c.last4 === card.last4 && c.expMonth === card.expMonth && c.expYear === card.expYear)) {
      setStatus("That card is already saved.");
      throw new Error("duplicate");
    }
    const newId = addCard ? await addCard(card) : (await wait(700), `card-${Date.now()}`);
    setList((xs) => [...xs, { id: newId, ...card }]);
    if (!def) setDef(newId);
    setFresh([newId]);
    setStatus(`${BRAND[card.brand].name} ending in ${card.last4} added.`);
    // Let the saved state show for a moment, then fold the panel away.
    window.setTimeout(() => {
      setAdding(false);
      addBtn.current?.focus();
    }, 900);
  };

  const toggleAdd = () => {
    if (!adding) setFormKey((k) => k + 1);
    setAdding((a) => !a);
  };

  return (
    <section className="fl-bpm" aria-labelledby={`${id}-title`} data-fl="p.payment-methods">
      <header className="fl-bpm-top">
        <h2 id={`${id}-title`}>{title}</h2>
        {lede ? <p>{lede}</p> : null}
      </header>

      <div className="fl-bpm-card">
        <div className="fl-bpm-head">
          <h3>{l.cardsTitle}</h3>
          <Button ref={addBtn} variant={adding ? "secondary" : "primary"} size={40} icon={adding ? "close" : "plus"} aria-expanded={adding} aria-controls={`${id}-add`} onClick={toggleAdd}>
            {adding ? l.cancel : l.add}
          </Button>
        </div>

        <div className={["fl-bpm-add", adding ? "is-open" : ""].filter(Boolean).join(" ")} id={`${id}-add`} inert={!adding || undefined}>
          <div className="fl-bpm-clip">
            <div className="fl-bpm-addbody">
              <CardFields key={formKey} accepted={["visa", "mastercard", "amex", "discover"]} now={now} submitLabel="Save card" onSave={save} labels={{ failed: "Couldn't save the card. If it's already in your list, use that one." }} />
            </div>
          </div>
        </div>

        {sorted.length === 0 ? (
          <EmptyState variant="first-use" icon="cart" title={l.empty}>
            {l.emptyText}
          </EmptyState>
        ) : (
          <ul className="fl-bpm-list" role="list" ref={listRef}>
            {sorted.map((c, i) => {
              const s = state(c);
              const isDef = c.id === def;
              const cls = ["fl-bpm-row", entering ? "is-entering" : "", leaving.includes(c.id) ? "is-leaving" : "", fresh.includes(c.id) ? "is-new" : "", isDef ? "is-default" : ""].filter(Boolean).join(" ");
              return (
                <li key={c.id} id={`${id}-${c.id}-row`} tabIndex={-1} data-flip={c.id} className={cls} style={{ "--i": i } as CSSProperties} inert={leaving.includes(c.id) || undefined} aria-label={label(c)}>
                  <span className="fl-bpm-plate" data-brand={c.brand} aria-hidden="true">
                    {BRAND[c.brand].plate}
                  </span>
                  <div className="fl-bpm-copy">
                    <p className="fl-bpm-num">
                      <span className="fl-sr">{BRAND[c.brand].name} </span>
                      <span aria-hidden="true">•••• </span>
                      {c.last4}
                    </p>
                    <p className="fl-bpm-meta">
                      {c.name} · {s === "expired" ? `${l.expired} ${exp(c)}` : l.expires.replace("{date}", exp(c))}
                    </p>
                  </div>
                  <div className="fl-bpm-tags">
                    {isDef ? (
                      <Badge tone="success" led>
                        {l.isDefault}
                      </Badge>
                    ) : null}
                    {s === "expired" ? <Badge tone="danger">{l.expired}</Badge> : s === "soon" ? <Badge tone="warning">{l.soon}</Badge> : null}
                  </div>
                  <div className="fl-bpm-actions">
                    {!isDef ? (
                      <>
                        <Button variant="tertiary" size={32} disabled={s === "expired"} onClick={() => makeDefault(c)} aria-label={`${l.makeDefault}: ${label(c)}`}>
                          {l.makeDefault}
                        </Button>
                        <Button variant="tertiary" size={32} icon="trash" iconOnly aria-label={`${l.remove} ${label(c)}`} onClick={() => setRemoving(c)}>
                          {l.remove}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {sorted.length > 1 ? <p className="fl-bpm-hint">{l.defaultHint}</p> : null}
      </div>

      <div className="fl-bpm-card">
        <div className="fl-bpm-head">
          <h3>{l.billingTitle}</h3>
          <Button variant="secondary" size={40} icon="pencil" onClick={() => setEditing(true)} aria-label={`${l.edit} ${l.billingTitle.toLowerCase()}`}>
            {l.edit}
          </Button>
        </div>
        <dl className="fl-bpm-facts">
          <div>
            <dt>Company</dt>
            <dd>{profile.company}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{profile.contact}</dd>
          </div>
          <div>
            <dt>Invoice email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Tax ID</dt>
            <dd>{profile.taxId || "None"}</dd>
          </div>
          <div className="fl-bpm-wide">
            <dt>Address</dt>
            <dd>{profile.address}</dd>
          </div>
        </dl>
      </div>

      <p className="fl-bpm-status" role="status" aria-live="polite">
        {status}
      </p>

      {removing ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Remove ${BRAND[removing.brand].name} •••• ${removing.last4}?`}
          description="You won't be able to pay with this card until you add it again."
          confirmLabel={l.remove}
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      ) : null}

      {editing ? (
        <BillingDialog
          profile={profile}
          save={saveBilling}
          onClose={() => setEditing(false)}
          onSaved={(p) => {
            setProfile(p);
            setEditing(false);
            setStatus("Billing details saved.");
          }}
        />
      ) : null}
    </section>
  );
}

type Field = keyof BillingProfile;
const FIELDS: { key: Field; label: string; type?: string; auto: string; optional?: boolean; wide?: boolean }[] = [
  { key: "company", label: "Company", auto: "organization" },
  { key: "contact", label: "Contact name", auto: "name" },
  { key: "email", label: "Invoice email", type: "email", auto: "email" },
  { key: "taxId", label: "Tax ID", auto: "off", optional: true },
  { key: "address", label: "Address", auto: "street-address", wide: true },
];

function BillingDialog({ profile, save, onClose, onSaved }: { profile: BillingProfile; save?: (p: BillingProfile) => Promise<void>; onClose: () => void; onSaved: (p: BillingProfile) => void }) {
  const id = useId();
  const [errors, setErrors] = useState<Partial<Record<Field | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      variant="form"
      title="Billing details"
      description="This is who your invoices are made out to."
      confirmLabel="Save"
      busy={busy}
      busyLabel="Saving…"
      onClose={onClose}
      onConfirm={(data) => {
        const p = Object.fromEntries(FIELDS.map((f) => [f.key, String(data.get(f.key) ?? "").trim()])) as BillingProfile;
        const e: Partial<Record<Field, string>> = {};
        if (!p.company) e.company = "Enter the company name.";
        if (!p.contact) e.contact = "Enter a contact name.";
        if (!p.email) e.email = "Enter an email for invoices.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) e.email = "Enter a full email, like billing@company.com.";
        if (p.taxId && !/^[A-Za-z0-9 -]{4,20}$/.test(p.taxId)) e.taxId = "Use 4 to 20 letters and numbers.";
        if (!p.address) e.address = "Enter the billing address.";
        setErrors(e);
        const first = FIELDS.find((f) => e[f.key]);
        if (first) {
          window.setTimeout(() => document.getElementById(`${id}-${first.key}`)?.focus(), 0);
          return false as const;
        }
        setBusy(true);
        (save ? save(p) : wait(600))
          .then(() => onSaved(p))
          .catch(() => setErrors({ form: "Couldn't save. Try again." }))
          .finally(() => setBusy(false));
        return false as const;
      }}
    >
      <div className="fl-bpm-form">
        {FIELDS.map((f, i) => (
          <div key={f.key} className={["fl-bpm-field", f.wide ? "fl-bpm-wide" : ""].filter(Boolean).join(" ")}>
            <label htmlFor={`${id}-${f.key}`}>
              {f.label}
              {f.optional ? <span className="fl-bpm-opt"> (optional)</span> : null}
            </label>
            <TextField
              id={`${id}-${f.key}`}
              name={f.key}
              type={f.type ?? "text"}
              size={40}
              autoComplete={f.auto}
              defaultValue={profile[f.key] ?? ""}
              data-autofocus={i === 0 || undefined}
              invalid={Boolean(errors[f.key])}
              aria-describedby={errors[f.key] ? `${id}-${f.key}-err` : undefined}
              onInput={() => errors[f.key] && setErrors((x) => ({ ...x, [f.key]: undefined }))}
            />
            {errors[f.key] ? (
              <p id={`${id}-${f.key}-err`} className="fl-bpm-error" role="alert">
                <Icon name="alert" />
                {errors[f.key]}
              </p>
            ) : null}
          </div>
        ))}
        {errors.form ? (
          <p className="fl-bpm-error fl-bpm-wide" role="alert">
            <Icon name="alert" />
            {errors.form}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Billing",
  lede: "Manage how you pay for Northlight and who your invoices go to.",
  now: new Date("2026-10-21T10:00:00"),
  defaultId: "c1",
  // Made-up test cards: only the brand, last four digits and expiry are ever kept.
  cards: [
    { id: "c1", brand: "mastercard", last4: "7852", expMonth: 4, expYear: 2028, name: "Ana Ruiz" },
    { id: "c2", brand: "visa", last4: "4242", expMonth: 11, expYear: 2026, name: "Ana Ruiz" },
    { id: "c3", brand: "amex", last4: "0005", expMonth: 6, expYear: 2026, name: "Northlight Studio" },
  ] as StoredCard[],
  billing: { company: "Northlight Studio LLC", contact: "Ana Ruiz", email: "billing@northlight.example", taxId: "US 84-2093117", address: "418 Alder Street, Suite 3, Portland, OR 97205" },
};

export default function PaymentMethodsSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <PaymentMethods {...SAMPLE} />
      </div>
    </section>
  );
}
