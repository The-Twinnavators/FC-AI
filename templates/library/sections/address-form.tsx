/** @flowcode-library address-form · Address form (Forms)
 * Catalog ID: p.address-form (pattern)
 * Function: Address form (p.address-form): an address book whose form follows the country (United States, Canada, United Kingdom, Germany, Japan, Australia: the region's name and list or none, the postal code's name, format and place); the street line suggests addresses from a local list and fills the rest; a live preview prints it the way that country writes it; checks on save with the first problem focused, a working state, errors and a saved line; edit, make default and delete after a confirm.
 * Use it as: import { AddressForm } from "./address-form"; <AddressForm title lede? addresses?={[{ id, label: "home"|"work"|"other", country: "US", name, line1, line2?, city, region?, postal, phone?, isDefault? }]} suggestions?={[{ country, line1, city, region?, postal }]} countries?={COUNTRIES} defaultCountry?="US" onSave?={async (address) => void} onDelete?={async (id) => void} labels?={{ add, save, country, line1, ... }} />
 * Built from: c.text-field.outlined, c.select.outlined, c.segmented.segmented, c.checkbox, c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.danger
 * Look: A white card with the title, a line of help and Add address; a row of saved address cards (label, a Default pill, the printed address, Edit, Make default, Delete); below, the form (Home / Work / Other, country, name, the street with a suggestion list under it, city, region and postal code in that country's order, phone, a default checkbox, Cancel and Save address) beside a sunken preview card with a map pin that prints the address in a mono face.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-medium --weight-semibold --focus-ring --surface-shadow-overlay --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: shipping address; billing address; address book; checkout address; delivery details; account addresses; international address form
 * Jobs to be done: add my delivery address without typing all of it; enter an address in another country the way it's written there; check how my address will print before saving; pick which address is my default; remove an old address
 * Keywords: address, shipping address, billing address, address book, postal code, zip code, country, autocomplete, suggestions, international
 */
/**
 * Address form: an address book that knows how each country writes an address. The street line is an ARIA
 * combobox over a local list of suggestions (no lookup service; pass your own list, or replace `suggestions` with
 * results from your provider); picking one fills the city, region and postal code. Fields that a country doesn't use
 * fold away (grid rows, inert while closed). Make it the app's own by extending COUNTRIES with the countries you ship to.
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its profile page's address card and edit dialog, and
 * TailGrids (MIT, Copyright (c) 2025 Tailgrids): its combobox and field components.
 */
/**
 * How to try it
 * - Press Save address with nothing filled in: each empty field says why and the name field takes focus.
 * - Type "Mark" in the street line: suggestions open. Use the arrow keys and Enter (or click): city, state and ZIP fill.
 * - Switch the country to Germany: the state row folds away and the postal code moves before the city. Type a
 *   four-digit postal code and save: it says it needs five digits.
 * - Watch the preview print the address. Save: it works, then the card appears in the book above.
 * - Edit a saved card, Make default on another, Delete one (confirmed first).
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's TextField, Select, Segmented,
 * Checkbox, Badge, Button and Modal ("./text-fields-states", "./dropdowns-states", "./segmented-control",
 * "./checkboxes-radios", "./badges-status", "./buttons-variants", "./modals-dialogs") and its inline icon set
 * ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r4d-address-form.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.address-form: an address book whose form follows the country. ──

export type AddressLabel = "home" | "work" | "other";
export type Address = {
  id: string;
  label: AddressLabel;
  country: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postal: string;
  phone?: string;
  isDefault?: boolean;
};
export type AddressSuggestion = { country: string; line1: string; city: string; region?: string; postal: string };

export type CountrySpec = {
  code: string;
  name: string;
  /** City field's name: "City", "Town or city", "Suburb". */
  city: string;
  /** The region's name and list; a text field when no list, no field at all when left out. */
  region?: { label: string; options?: { value: string; label: string }[]; optional?: boolean };
  postal: { label: string; pattern: RegExp; example: string; format?: (v: string) => string };
  /** Postal code before the city (Germany, Japan). */
  postalFirst?: boolean;
  /** Printed lines for the preview and the saved cards. */
  print: (a: Omit<Address, "id">, regionLabel: string) => string[];
};

const opts = (list: string) =>
  list.split("|").map((pair) => {
    const [value, label] = pair.split(":");
    return { value: value!, label: label ?? value! };
  });

export const COUNTRIES: CountrySpec[] = [
  {
    code: "US",
    name: "United States",
    city: "City",
    region: {
      label: "State",
      options: opts(
        "AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming",
      ),
    },
    postal: { label: "ZIP code", pattern: /^\d{5}(-\d{4})?$/, example: "94103" },
    print: (a) => [a.name, a.line1, a.line2 ?? "", [a.city, [a.region, a.postal].filter(Boolean).join(" ")].filter(Boolean).join(", "), "United States"],
  },
  {
    code: "CA",
    name: "Canada",
    city: "City",
    region: { label: "Province", options: opts("AB:Alberta|BC:British Columbia|MB:Manitoba|NB:New Brunswick|NL:Newfoundland and Labrador|NS:Nova Scotia|NT:Northwest Territories|NU:Nunavut|ON:Ontario|PE:Prince Edward Island|QC:Quebec|SK:Saskatchewan|YT:Yukon") },
    postal: {
      label: "Postal code",
      pattern: /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
      example: "M5V 2T6",
      format: (v) => {
        const s = v.toUpperCase().replace(/\s+/g, "");
        return s.length === 6 ? `${s.slice(0, 3)} ${s.slice(3)}` : v.toUpperCase();
      },
    },
    print: (a) => [a.name, a.line1, a.line2 ?? "", [a.city, a.region, a.postal].filter(Boolean).join(" "), "Canada"],
  },
  {
    code: "GB",
    name: "United Kingdom",
    city: "Town or city",
    region: { label: "County", optional: true },
    postal: {
      label: "Postcode",
      pattern: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
      example: "SW1A 1AA",
      format: (v) => {
        const s = v.toUpperCase().replace(/\s+/g, "");
        return s.length >= 5 ? `${s.slice(0, -3)} ${s.slice(-3)}` : v.toUpperCase();
      },
    },
    print: (a) => [a.name, a.line1, a.line2 ?? "", a.city.toUpperCase(), a.region ?? "", a.postal, "United Kingdom"],
  },
  {
    code: "DE",
    name: "Germany",
    city: "City",
    postal: { label: "Postal code", pattern: /^\d{5}$/, example: "10115" },
    postalFirst: true,
    print: (a) => [a.name, a.line1, a.line2 ?? "", `${a.postal} ${a.city}`.trim(), "Germany"],
  },
  {
    code: "JP",
    name: "Japan",
    city: "City or ward",
    region: {
      label: "Prefecture",
      options: opts(
        "Hokkaido|Aomori|Iwate|Miyagi|Akita|Yamagata|Fukushima|Ibaraki|Tochigi|Gunma|Saitama|Chiba|Tokyo|Kanagawa|Niigata|Toyama|Ishikawa|Fukui|Yamanashi|Nagano|Gifu|Shizuoka|Aichi|Mie|Shiga|Kyoto|Osaka|Hyogo|Nara|Wakayama|Tottori|Shimane|Okayama|Hiroshima|Yamaguchi|Tokushima|Kagawa|Ehime|Kochi|Fukuoka|Saga|Nagasaki|Kumamoto|Oita|Miyazaki|Kagoshima|Okinawa",
      ),
    },
    postal: {
      label: "Postal code",
      pattern: /^\d{3}-\d{4}$/,
      example: "100-0001",
      format: (v) => {
        const s = v.replace(/\D/g, "");
        return s.length === 7 ? `${s.slice(0, 3)}-${s.slice(3)}` : v;
      },
    },
    postalFirst: true,
    print: (a) => [`〒${a.postal}`, `${a.region ?? ""}, ${a.city}`.replace(/^, /, ""), a.line1, a.line2 ?? "", a.name, "Japan"],
  },
  {
    code: "AU",
    name: "Australia",
    city: "Suburb",
    region: { label: "State or territory", options: opts("ACT:Australian Capital Territory|NSW:New South Wales|NT:Northern Territory|QLD:Queensland|SA:South Australia|TAS:Tasmania|VIC:Victoria|WA:Western Australia") },
    postal: { label: "Postcode", pattern: /^\d{4}$/, example: "2000" },
    print: (a) => [a.name, a.line1, a.line2 ?? "", `${a.city.toUpperCase()} ${a.region ?? ""} ${a.postal}`.trim(), "Australia"],
  },
];

export type AddressFormLabels = Partial<{
  book: string;
  add: string;
  empty: string;
  labelGroup: string;
  home: string;
  work: string;
  other: string;
  country: string;
  name: string;
  line1: string;
  line2: string;
  phone: string;
  optional: string;
  makeDefault: string;
  defaultBadge: string;
  setDefault: string;
  edit: string;
  remove: string;
  removeTitle: string;
  removeText: string;
  save: string;
  saving: string;
  cancel: string;
  saved: string;
  removed: string;
  failed: string;
  preview: string;
  previewEmpty: string;
  suggestions: string;
  filled: string;
  newTitle: string;
  editTitle: string;
  required: string;
  badPostal: string;
  badPhone: string;
}>;

export type AddressFormProps = {
  title: string;
  lede?: string;
  addresses?: Address[];
  /** Local suggestions for the street line; matched on street and city, in the chosen country only. */
  suggestions?: AddressSuggestion[];
  countries?: CountrySpec[];
  /** Country for a new address; the first in `countries` when left out. */
  defaultCountry?: string;
  /** Stores a new or edited address. Throw to show an error. */
  onSave?: (address: Address) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  labels?: AddressFormLabels;
};

type Draft = Omit<Address, "id"> & { id?: string };
type Key = "name" | "line1" | "city" | "region" | "postal" | "phone";
const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));
const blank = (country: string): Draft => ({ label: "home", country, name: "", line1: "", line2: "", city: "", region: "", postal: "", phone: "", isDefault: false });

export function AddressForm({ title, lede, addresses = [], suggestions = [], countries = COUNTRIES, defaultCountry, onSave, onDelete, labels = {} }: AddressFormProps) {
  const l = {
    book: "Saved addresses",
    add: "Add address",
    empty: "No saved addresses yet.",
    labelGroup: "Address type",
    home: "Home",
    work: "Work",
    other: "Other",
    country: "Country or region",
    name: "Full name",
    line1: "Street address",
    line2: "Apartment, suite or floor",
    phone: "Phone",
    optional: "optional",
    makeDefault: "Use as my default address",
    defaultBadge: "Default",
    setDefault: "Make default",
    edit: "Edit",
    remove: "Delete",
    removeTitle: "Delete this address?",
    removeText: "It's removed from your address book. Orders already placed keep it.",
    save: "Save address",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Address saved.",
    removed: "Address deleted.",
    failed: "Couldn't save the address. Try again.",
    preview: "How it prints",
    previewEmpty: "Start typing to see the address.",
    suggestions: "Suggested addresses",
    filled: "Filled in from the suggestion.",
    newTitle: "New address",
    editTitle: "Edit address",
    required: "Enter the {field}.",
    badPostal: "Use the format {example}.",
    badPhone: "Enter a phone number with at least 7 digits.",
    ...labels,
  };
  const id = useId();
  const first = defaultCountry ?? countries[0]!.code;
  const [book, setBook] = useState<Address[]>(addresses);
  const [draft, setDraft] = useState<Draft>(() => blank(first));
  const [errors, setErrors] = useState<Partial<Record<Key | "form", string>>>({});
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [savedLine, setSavedLine] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const spec = countries.find((c) => c.code === draft.country) ?? countries[0]!;
  const regionLabel = spec.region?.options?.find((o) => o.value === draft.region)?.label ?? draft.region ?? "";

  const matches = useMemo(() => {
    const q = draft.line1.trim().toLowerCase();
    if (q.length < 2) return [];
    return suggestions.filter((s) => s.country === draft.country && `${s.line1} ${s.city}`.toLowerCase().includes(q)).slice(0, 5);
  }, [draft.line1, draft.country, suggestions]);
  const listOpen = open && matches.length > 0;

  useEffect(() => setActive(-1), [draft.line1]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSavedLine("");
    if (errors[k as Key] || errors.form) setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  const pick = (s: AddressSuggestion) => {
    setDraft((d) => ({ ...d, line1: s.line1, city: s.city, region: s.region ?? "", postal: s.postal }));
    setErrors((e) => ({ ...e, line1: undefined, city: undefined, region: undefined, postal: undefined }));
    setOpen(false);
    setSaid(l.filled);
  };

  const onStreetKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (matches.length ? (a + 1) % matches.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (matches.length ? (a <= 0 ? matches.length - 1 : a - 1) : -1));
    } else if (e.key === "Enter" && listOpen && active >= 0) {
      e.preventDefault();
      pick(matches[active]!);
    } else if (e.key === "Escape" && listOpen) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const changeCountry = (code: string) => {
    setDraft((d) => ({ ...d, country: code, region: "", postal: "" }));
    setErrors({});
  };

  const fieldName = (k: Key) => (k === "city" ? spec.city : k === "region" ? spec.region?.label ?? "" : k === "postal" ? spec.postal.label : l[k]).replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const postal = spec.postal.format ? spec.postal.format(draft.postal.trim()) : draft.postal.trim();
    const d: Draft = { ...draft, name: draft.name.trim(), line1: draft.line1.trim(), city: draft.city.trim(), postal };
    const err: Partial<Record<Key, string>> = {};
    for (const k of ["name", "line1", "city"] as Key[]) if (!String(d[k] ?? "")) err[k] = l.required.replace("{field}", fieldName(k));
    if (spec.region && !spec.region.optional && !d.region) err.region = l.required.replace("{field}", fieldName("region"));
    if (!d.postal) err.postal = l.required.replace("{field}", fieldName("postal"));
    else if (!spec.postal.pattern.test(d.postal)) err.postal = l.badPostal.replace("{example}", spec.postal.example);
    if (d.phone && (d.phone.replace(/\D/g, "").length < 7 || /[^\d\s()+.-]/.test(d.phone))) err.phone = l.badPhone;
    setDraft(d);
    setErrors(err);
    const order: Key[] = ["name", "line1", ...(spec.postalFirst ? (["postal", "city"] as Key[]) : (["city", "postal"] as Key[])), "region", "phone"];
    const firstBad = order.find((k) => err[k]);
    if (firstBad) {
      setShake((n) => n + 1);
      window.setTimeout(() => document.getElementById(`${id}-${firstBad}`)?.focus(), 0);
      return;
    }
    const address: Address = { ...d, id: d.id ?? `a${Date.now().toString(36)}`, line2: d.line2?.trim() || undefined, phone: d.phone?.trim() || undefined, region: d.region || undefined };
    setBusy(true);
    try {
      await (onSave ? onSave(address) : wait(800));
      setBook((b) => {
        const next = b.some((x) => x.id === address.id) ? b.map((x) => (x.id === address.id ? address : x)) : [...b, address];
        // One default at a time; the only address, or the one ticked, becomes it.
        const def = Boolean(address.isDefault) || !next.some((x) => x.isDefault && x.id !== address.id);
        return next.map((x) => (x.id === address.id ? { ...x, isDefault: def } : def ? { ...x, isDefault: false } : x));
      });
      setDraft(blank(first));
      setSavedLine(l.saved);
      setSaid(l.saved);
      window.setTimeout(() => document.getElementById(`${id}-card-${address.id}`)?.focus(), 0);
    } catch {
      setErrors({ form: l.failed });
    } finally {
      setBusy(false);
    }
  };

  const edit = (a: Address) => {
    setDraft({ ...a, line2: a.line2 ?? "", region: a.region ?? "", phone: a.phone ?? "" });
    setErrors({});
    setSavedLine("");
    formRef.current?.scrollIntoView({ block: "nearest" });
    window.setTimeout(() => document.getElementById(`${id}-name`)?.focus(), 0);
  };
  const startNew = () => {
    setDraft(blank(first));
    setErrors({});
    setSavedLine("");
    window.setTimeout(() => document.getElementById(`${id}-name`)?.focus(), 0);
  };
  const makeDefault = (a: Address) => {
    setBook((b) => b.map((x) => ({ ...x, isDefault: x.id === a.id })));
    setSaid(`${a.name}, ${a.city}: ${l.defaultBadge.toLowerCase()}.`);
  };
  const remove = () => {
    const a = confirmDelete;
    if (!a) return;
    void (onDelete ? onDelete(a.id) : Promise.resolve()).then(() => {
      setBook((b) => {
        const next = b.filter((x) => x.id !== a.id);
        if (a.isDefault && next[0]) next[0] = { ...next[0], isDefault: true };
        return next;
      });
      if (draft.id === a.id) setDraft(blank(first));
      setSaid(l.removed);
      window.setTimeout(() => document.getElementById(`${id}-add`)?.focus(), 0);
    });
  };

  const printed = (a: Omit<Address, "id">) => {
    const c = countries.find((x) => x.code === a.country) ?? spec;
    const rl = c.region?.options?.find((o) => o.value === a.region)?.label ?? a.region ?? "";
    return c.print(a, rl).filter((line) => line.trim());
  };
  const hasAny = Boolean(draft.name || draft.line1 || draft.city || draft.postal);
  const shakeAttr = shake ? (shake % 2 ? "a" : "b") : undefined;

  const err = (k: Key) =>
    errors[k] ? (
      <p id={`${id}-${k}-err`} className="fl-adf-error" role="alert">
        <Icon name="alert" />
        {errors[k]}
      </p>
    ) : null;
  const text = (k: "name" | "city" | "postal" | "phone", label: string, extra: Record<string, unknown> = {}, optional = false) => (
    <div className={`fl-adf-field fl-adf-field--${k}`} data-shake={errors[k] ? shakeAttr : undefined}>
      <label htmlFor={`${id}-${k}`}>
        {label}
        {optional ? <span className="fl-adf-opt"> ({l.optional})</span> : null}
      </label>
      <TextField
        id={`${id}-${k}`}
        size={40}
        value={draft[k] ?? ""}
        invalid={Boolean(errors[k])}
        aria-describedby={errors[k] ? `${id}-${k}-err` : undefined}
        onChange={(e) => set(k, e.currentTarget.value)}
        {...extra}
      />
      {err(k)}
    </div>
  );

  const cityField = text("city", spec.city, { autoComplete: "address-level2" });
  const postalField = text("postal", spec.postal.label, {
    autoComplete: "postal-code",
    placeholder: spec.postal.example,
    inputMode: /^\d/.test(spec.postal.example) ? "numeric" : "text",
    onBlur: () => spec.postal.format && draft.postal && set("postal", spec.postal.format(draft.postal.trim())),
  });

  return (
    <section className="fl-adf" aria-labelledby={`${id}-title`} data-fl="p.address-form">
      <header className="fl-adf-head">
        <div className="fl-adf-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <Button id={`${id}-add`} variant="secondary" size={40} icon="plus" onClick={startNew}>
          {l.add}
        </Button>
      </header>

      <div className="fl-adf-book">
        <h3 className="fl-adf-sub">{l.book}</h3>
        {book.length ? (
          <ul className="fl-adf-cards" role="list">
            {book.map((a) => (
              <li key={a.id} id={`${id}-card-${a.id}`} tabIndex={-1} className={["fl-adf-card", draft.id === a.id ? "is-editing" : ""].filter(Boolean).join(" ")}>
                <div className="fl-adf-card-top">
                  <strong>{l[a.label]}</strong>
                  {a.isDefault ? (
                    <Badge tone="success" led>
                      {l.defaultBadge}
                    </Badge>
                  ) : null}
                </div>
                <address>
                  {printed(a).map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </address>
                <div className="fl-adf-card-btns">
                  <Button variant="tertiary" size={32} icon="pencil" onClick={() => edit(a)} aria-label={`${l.edit} ${l[a.label]} address, ${a.city}`}>
                    {l.edit}
                  </Button>
                  {!a.isDefault ? (
                    <Button variant="tertiary" size={32} onClick={() => makeDefault(a)} aria-label={`${l.setDefault}: ${l[a.label]}, ${a.city}`}>
                      {l.setDefault}
                    </Button>
                  ) : null}
                  <Button variant="tertiary" size={32} icon="trash" iconOnly className="fl-adf-del" aria-label={`${l.remove} ${l[a.label]} address, ${a.city}`} onClick={() => setConfirmDelete(a)}>
                    {l.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fl-adf-empty">
            <Icon name="pin" />
            {l.empty}
          </p>
        )}
      </div>

      <div className="fl-adf-main" ref={formRef}>
        <form className="fl-adf-form" noValidate onSubmit={(e) => void submit(e)} aria-busy={busy || undefined} aria-labelledby={`${id}-formtitle`}>
          <h3 className="fl-adf-sub" id={`${id}-formtitle`}>
            {draft.id ? l.editTitle : l.newTitle}
          </h3>
          <Segmented
            size="sm"
            label={l.labelGroup}
            value={draft.label}
            onChange={(v) => set("label", v as AddressLabel)}
            options={[
              { value: "home", label: l.home },
              { value: "work", label: l.work },
              { value: "other", label: l.other },
            ]}
          />
          <div className="fl-adf-field">
            <label htmlFor={`${id}-country`}>{l.country}</label>
            <Select id={`${id}-country`} value={draft.country} autoComplete="country" onChange={(e) => changeCountry(e.currentTarget.value)} options={countries.map((c) => ({ value: c.code, label: c.name }))} />
          </div>
          {text("name", l.name, { autoComplete: "name" })}

          <div className="fl-adf-field fl-adf-street" data-shake={errors.line1 ? shakeAttr : undefined}>
            <label htmlFor={`${id}-line1`}>{l.line1}</label>
            <span className="fl-adf-combo">
            <TextField
              id={`${id}-line1`}
              size={40}
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={`${id}-list`}
              aria-activedescendant={listOpen && active >= 0 ? `${id}-opt-${active}` : undefined}
              value={draft.line1}
              invalid={Boolean(errors.line1)}
              aria-describedby={errors.line1 ? `${id}-line1-err` : undefined}
              onChange={(e) => {
                set("line1", e.currentTarget.value);
                setOpen(true);
              }}
              onKeyDown={onStreetKey}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            />
            <ul id={`${id}-list`} role="listbox" aria-label={l.suggestions} className="fl-adf-list" hidden={!listOpen}>
              {matches.map((s, i) => (
                <li
                  key={`${s.line1}-${s.postal}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? "is-active" : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  onMouseMove={() => setActive(i)}
                >
                  <Icon name="pin" />
                  <span>
                    <strong>{s.line1}</strong>
                    <span>
                      {s.city}
                      {s.region ? `, ${s.region}` : ""} {s.postal}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            </span>
            {err("line1")}
          </div>
          <div className="fl-adf-field">
            <label htmlFor={`${id}-line2`}>
              {l.line2}
              <span className="fl-adf-opt"> ({l.optional})</span>
            </label>
            <TextField id={`${id}-line2`} size={40} autoComplete="address-line2" value={draft.line2 ?? ""} onChange={(e) => set("line2", e.currentTarget.value)} />
          </div>

          <div className="fl-adf-row">{spec.postalFirst ? [<div key="p">{postalField}</div>, <div key="c">{cityField}</div>] : [<div key="c">{cityField}</div>, <div key="p">{postalField}</div>]}</div>

          <div className={["fl-adf-fold", spec.region ? "is-open" : ""].filter(Boolean).join(" ")} inert={!spec.region || undefined}>
            <div>
              <div className="fl-adf-field" data-shake={errors.region ? shakeAttr : undefined}>
                <label htmlFor={`${id}-region`}>
                  {spec.region?.label ?? ""}
                  {spec.region?.optional ? <span className="fl-adf-opt"> ({l.optional})</span> : null}
                </label>
                {spec.region?.options ? (
                  <Select
                    key={spec.code}
                    id={`${id}-region`}
                    value={draft.region ?? ""}
                    autoComplete="address-level1"
                    placeholder={`Choose a ${spec.region.label.toLowerCase()}`}
                    invalid={Boolean(errors.region)}
                    aria-describedby={errors.region ? `${id}-region-err` : undefined}
                    onChange={(e) => set("region", e.currentTarget.value)}
                    options={spec.region.options}
                  />
                ) : (
                  <TextField id={`${id}-region`} size={40} autoComplete="address-level1" value={draft.region ?? ""} onChange={(e) => set("region", e.currentTarget.value)} />
                )}
                {err("region")}
              </div>
            </div>
          </div>

          {text("phone", l.phone, { type: "tel", autoComplete: "tel", inputMode: "tel" }, true)}
          <Checkbox label={l.makeDefault} checked={Boolean(draft.isDefault)} onChange={(e) => set("isDefault", e.currentTarget.checked)} />

          {errors.form ? (
            <p className="fl-adf-error" role="alert">
              <Icon name="alert" />
              {errors.form}
            </p>
          ) : null}

          <div className="fl-adf-btns">
            <Button type="button" variant="tertiary" size={40} onClick={startNew} disabled={busy}>
              {l.cancel}
            </Button>
            <Button type="submit" size={40} busy={busy}>
              {busy ? l.saving : l.save}
            </Button>
          </div>
          {savedLine ? (
            <p className="fl-adf-saved">
              <span aria-hidden="true">
                <Icon name="check" />
              </span>
              {savedLine}
            </p>
          ) : null}
        </form>

        <aside className="fl-adf-preview" aria-labelledby={`${id}-ptitle`}>
          <p className="fl-adf-ptitle" id={`${id}-ptitle`}>
            <Icon name="pin" />
            {l.preview}
          </p>
          {hasAny ? (
            <address className="fl-adf-print">
              {spec.print({ ...draft, postal: draft.postal }, regionLabel)
                .filter((line) => line.trim())
                .map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
            </address>
          ) : (
            <p className="fl-adf-pempty">{l.previewEmpty}</p>
          )}
        </aside>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {confirmDelete ? <Modal variant="danger" icon="trash" title={l.removeTitle} description={l.removeText} confirmLabel={l.remove} onConfirm={() => remove()} onClose={() => setConfirmDelete(null)} /> : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Addresses",
  lede: "Where we send orders and invoices.",
  addresses: [{ id: "a1", label: "home", country: "US", name: "Ana Ruiz", line1: "1450 Mission Street", line2: "Apt 4B", city: "San Francisco", region: "CA", postal: "94103", phone: "+1 415 555 0142", isDefault: true }] as Address[],
  suggestions: [
    { country: "US", line1: "1 Market Street", city: "San Francisco", region: "CA", postal: "94105" },
    { country: "US", line1: "350 Market Avenue", city: "Grand Rapids", region: "MI", postal: "49503" },
    { country: "US", line1: "200 Marketplace Drive", city: "Austin", region: "TX", postal: "78701" },
    { country: "US", line1: "77 Massachusetts Avenue", city: "Cambridge", region: "MA", postal: "02139" },
    { country: "CA", line1: "290 Bremner Boulevard", city: "Toronto", region: "ON", postal: "M5V 3L9" },
    { country: "GB", line1: "10 Downing Street", city: "London", postal: "SW1A 2AA" },
    { country: "GB", line1: "221B Baker Street", city: "London", postal: "NW1 6XE" },
    { country: "DE", line1: "Marktstraße 12", city: "Berlin", postal: "10115" },
    { country: "DE", line1: "Unter den Linden 77", city: "Berlin", postal: "10117" },
    { country: "JP", line1: "1-1 Marunouchi", city: "Chiyoda-ku", region: "Tokyo", postal: "100-0005" },
    { country: "AU", line1: "1 Macquarie Street", city: "Sydney", region: "NSW", postal: "2000" },
  ] as AddressSuggestion[],
};

export default function AddressFormSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <AddressForm {...SAMPLE} onSave={() => wait(800)} />
      </div>
    </section>
  );
}
