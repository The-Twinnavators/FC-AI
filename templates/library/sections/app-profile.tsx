/** @flowcode-library app-profile · My profile (App screens)
 * Catalog ID: t.app-profile (template)
 * Function: A profile screen (t.app-profile): the person's header card and their personal information and address as label and value sections, each edited in a form dialog with checks, Escape to close and focus back on Edit.
 * Use it as: Copy app-profile.tsx (FlowCode brings the components it uses); replace SAMPLE with the app's own profile fields and the signed-in person's details, and save through the app's own data layer.
 * Built from: c.avatar.person, c.button.secondary, c.button.tertiary, c.modal.form, c.text-field.outlined
 * Look: A top bar over a profile header card (large initials or photo, name, role and place, link buttons, Edit), then Personal information and Address cards of label and value pairs in two columns, each with an Edit button that opens a two-column form dialog.
 * Use cases: user profile; my profile; account profile; profile page; personal details; contact details; member profile; staff profile
 * Jobs to be done: see my profile details; update my personal information; change my address; add links to my profile
 * Keywords: app, profile, account, personal information, address, edit, dialog, user
 */
/**
 * App screen: my profile. A whole screen with its own top bar, a profile header card (photo or initials, name, role,
 * location and the person's links) and two sections of facts, Personal information and Address. Each has an Edit
 * button that opens a form dialog with those fields: the fields are checked before saving, Escape or Cancel closes it
 * without changes, and focus goes back to the Edit button that opened it. A status line announces each save. Use it as
 * the profile page of any signed-in app. Make it the app's own: replace SAMPLE with the app's real fields and the
 * signed-in person's details, and save through the app's own data layer instead of this screen's memory.
 * Assembled from: top bar (inline, c.avatar) > header card (c.avatar, link buttons c.button.tertiary, c.button.secondary)
 * > fact sections (inline label and value grid, c.button.secondary) > c.modal.form with c.text-field fields.
 * The profile card (p.profile-card) is someone else's public card with Follow and Message, and the settings form
 * (p.settings-form) is a whole page with a save bar, so neither is reused here; the dialog is the library's c.modal.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin), its profile page and profile edit dialogs.
 */
import { useState } from "react";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  screen: "My profile",
  screenText: "How you appear to students and the studio team.",
  edit: "Edit",
  cancel: "Cancel",
  save: "Save changes",
  saved: "saved.",
  linksLabel: "Links",
  /** Fields shown in the header card; name, role and location come from these keys. */
  header: { first: "firstName", last: "lastName", role: "role", location: "city", links: ["website", "instagram", "linkedin"] },
  groups: [
    {
      id: "header",
      title: "Profile",
      dialogTitle: "Edit profile",
      dialogText: "Your role and links show on your public page.",
      shown: false,
      fields: [
        { key: "role", label: "Role", required: "Enter your role, such as Teacher." },
        { key: "website", label: "Website", type: "url", invalid: "Enter a full address starting with https://." },
        { key: "instagram", label: "Instagram", type: "url", invalid: "Enter a full address starting with https://." },
        { key: "linkedin", label: "LinkedIn", type: "url", invalid: "Enter a full address starting with https://." },
      ],
    },
    {
      id: "personal",
      title: "Personal information",
      dialogTitle: "Edit personal information",
      dialogText: "Keep your details up to date so the studio can reach you.",
      shown: true,
      fields: [
        { key: "firstName", label: "First name", autoComplete: "given-name", required: "Enter your first name.", half: true },
        { key: "lastName", label: "Last name", autoComplete: "family-name", required: "Enter your last name.", half: true },
        { key: "email", label: "Email address", type: "email", autoComplete: "email", required: "Enter your email address.", invalid: "Enter an email like name@studio.com.", half: true },
        { key: "phone", label: "Phone", type: "tel", autoComplete: "tel", half: true },
        { key: "bio", label: "Bio", type: "textarea" },
      ],
    },
    {
      id: "address",
      title: "Address",
      dialogTitle: "Edit address",
      dialogText: "Used on your invoices and payouts.",
      shown: true,
      fields: [
        { key: "country", label: "Country", autoComplete: "country-name", required: "Enter your country.", half: true },
        { key: "city", label: "City and state", autoComplete: "address-level2", required: "Enter your city.", half: true },
        { key: "postalCode", label: "Postal code", autoComplete: "postal-code", half: true },
        { key: "taxId", label: "Tax ID", half: true },
      ],
    },
  ] as ProfileGroup[],
  values: {
    firstName: "Maya",
    lastName: "Okafor",
    role: "Pottery teacher",
    email: "maya@kilnroom.studio",
    phone: "+1 503 555 0142",
    bio: "Teaches wheel throwing for beginners on weekday evenings.",
    website: "https://kilnroom.studio/maya",
    instagram: "https://www.instagram.com/kilnroom",
    linkedin: "https://www.linkedin.com/in/maya-okafor",
    country: "United States",
    city: "Portland, Oregon",
    postalCode: "97214",
    taxId: "84-2917735",
  } as Record<string, string>,
  empty: "Not added",
};

type ProfileField = {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "url" | "textarea";
  autoComplete?: string;
  /** The message when it is left empty; leave out for an optional field. */
  required?: string;
  /** The message when an email or web address is not one. */
  invalid?: string;
  /** Half width in the dialog, so two sit side by side. */
  half?: boolean;
};
type ProfileGroup = { id: string; title: string; dialogTitle: string; dialogText: string; shown: boolean; fields: ProfileField[] };
type Values = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_OK = /^https:\/\/[^\s.]+\.[^\s]+$/;

/** The first problem with one field's entry, or "". */
function problem(f: ProfileField, value: string): string {
  if (!value) return f.required ?? "";
  if (f.type === "email" && !EMAIL.test(value)) return f.invalid ?? "";
  if (f.type === "url" && !URL_OK.test(value)) return f.invalid ?? "";
  return "";
}

/** The edit dialog for one group: its fields, checked on save; it stays open while a field is wrong. */
function EditDialog({ group, values, onSave, onClose }: { group: ProfileGroup; values: Values; onSave: (next: Values) => void; onClose: () => void }) {
  const d = SAMPLE;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const id = (key: string) => `app-profile-${group.id}-${key}`;

  return (
    <Modal
      variant="form"
      title={group.dialogTitle}
      description={group.dialogText}
      cancelLabel={d.cancel}
      confirmLabel={d.save}
      className="fl-pf-dialog"
      onConfirm={(form) => {
        const next: Values = {};
        const found: Record<string, string> = {};
        for (const f of group.fields) {
          next[f.key] = String(form.get(f.key) ?? "").trim();
          const p = problem(f, next[f.key]);
          if (p) found[f.key] = p;
        }
        setErrors(found);
        const first = group.fields.find((f) => found[f.key]);
        if (first) {
          document.getElementById(id(first.key))?.focus();
          return false;
        }
        onSave(next);
      }}
      onClose={onClose}
    >
      <div className="fl-pf-fields">
        {group.fields.map((f, i) => (
          <div key={f.key} className={f.half ? "fl-field" : "fl-field fl-pf-wide"}>
            <label htmlFor={id(f.key)}>{f.label}</label>
            {f.type === "textarea" ? (
              <TextField multiline id={id(f.key)} name={f.key} rows={3} defaultValue={values[f.key] ?? ""} invalid={!!errors[f.key]} aria-describedby={errors[f.key] ? `${id(f.key)}-error` : undefined} />
            ) : (
              <TextField
                id={id(f.key)}
                name={f.key}
                type={f.type ?? "text"}
                autoComplete={f.autoComplete ?? "off"}
                defaultValue={values[f.key] ?? ""}
                data-autofocus={i === 0 ? "" : undefined}
                invalid={!!errors[f.key]}
                aria-describedby={errors[f.key] ? `${id(f.key)}-error` : undefined}
              />
            )}
            {errors[f.key] ? (
              <p id={`${id(f.key)}-error`} className="fl-dlg-error">
                {errors[f.key]}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function AppProfile() {
  const d = SAMPLE;
  const [values, setValues] = useState<Values>(d.values);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const h = d.header;
  const name = `${values[h.first] ?? ""} ${values[h.last] ?? ""}`.trim();
  const headerGroup = d.groups.find((g) => g.id === "header");
  const open = d.groups.find((g) => g.id === editing);
  const labelOf = (key: string) => d.groups.flatMap((g) => g.fields).find((f) => f.key === key)?.label ?? key;

  return (
    <div className="fl-as-app">
      <header className="fl-as-top">
        <div className="fl-as-brand">
          <span className="fl-as-mark" aria-hidden="true">
            {d.mark}
          </span>
          <span className="fl-as-brand__name">{d.product}</span>
        </div>
        <div className="fl-as-top__end">
          <Avatar name={name} size={32} />
        </div>
      </header>

      <main className="fl-as-main fl-pf">
        <div className="fl-as-pagehead">
          <div>
            <h1 className="fl-as-h1">{d.screen}</h1>
            <p className="fl-text">{d.screenText}</p>
          </div>
        </div>

        <section className="fl-as-panel fl-pf-head" aria-labelledby="app-profile-name">
          <Avatar name={name} size={72} decorative />
          <div className="fl-pf-who">
            <h2 id="app-profile-name" className="fl-pf-name">
              {name}
            </h2>
            <p className="fl-pf-role">
              <span>{values[h.role]}</span>
              {values[h.location] ? <span>{values[h.location]}</span> : null}
            </p>
          </div>
          <ul className="fl-pf-links" aria-label={d.linksLabel}>
            {h.links
              .filter((k) => values[k])
              .map((k) => (
                <li key={k}>
                  <Button variant="tertiary" size={32} href={values[k]} target="_blank" rel="noopener noreferrer" icon="external" iconAt="end">
                    {labelOf(k)}
                  </Button>
                </li>
              ))}
          </ul>
          {headerGroup ? (
            <Button variant="secondary" size={40} icon="pencil" aria-haspopup="dialog" aria-label={`${d.edit} ${headerGroup.title.toLowerCase()}`} onClick={() => (setStatus(""), setEditing(headerGroup.id))}>
              {d.edit}
            </Button>
          ) : null}
        </section>

        {d.groups
          .filter((g) => g.shown)
          .map((g) => (
            <section key={g.id} className="fl-as-panel" aria-labelledby={`app-profile-${g.id}-title`}>
              <div className="fl-pf-sechead">
                <h2 id={`app-profile-${g.id}-title`} className="fl-as-h2">
                  {g.title}
                </h2>
                <Button variant="secondary" size={40} icon="pencil" aria-haspopup="dialog" aria-label={`${d.edit} ${g.title.toLowerCase()}`} onClick={() => (setStatus(""), setEditing(g.id))}>
                  {d.edit}
                </Button>
              </div>
              <dl className="fl-pf-facts">
                {g.fields.map((f) => (
                  <div key={f.key} className={f.half ? undefined : "fl-pf-wide"}>
                    <dt>{f.label}</dt>
                    <dd className={values[f.key] ? undefined : "fl-pf-empty"}>{values[f.key] || d.empty}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

        <p className="fl-note fl-pf-status" role="status" aria-live="polite">
          {status}
        </p>
      </main>

      {open ? (
        <EditDialog
          group={open}
          values={values}
          onSave={(next) => {
            setValues((v) => ({ ...v, ...next }));
            setStatus(`${open.title} ${d.saved}`);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
