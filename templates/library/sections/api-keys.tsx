/** @flowcode-library api-keys · API keys manager (Tables and lists)
 * Catalog ID: p.api-keys (pattern)
 * Function: The API keys manager (p.api-keys): a workspace's keys with their access, created, last used and expiry dates; create a key (name checked for empty, too long and duplicate; access and expiry picked), see the secret once with Show, Copy and an "I saved it" check before the dialog closes; roll a key (new secret, old one stops) and revoke a key, each confirmed first.
 * Use it as: import { ApiKeys } from "./api-keys"; <ApiKeys title lede? keys={[{ id, name, prefix: "sk_test_", last4, access: "read"|"write"|"admin", created: "2026-09-02", lastUsed?: "2026-10-20T08:12", expires?: "2027-03-01" | null }]} accessLevels?={[{ value, label, text }]} now?={new Date()} create?={async ({ name, access, days }) => ({ id, secret })} onRoll?={async (id) => newSecret} onRevoke?={(id) => ...} labels?={{ create, empty, emptyText, ... }} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.select.outlined, c.radio, c.checkbox, c.badge.status, c.modal.form, c.modal.danger, c.modal.blocking, c.empty-state.first-use
 * Look: A title with a Create key button over a bordered table: the key's name, its masked value in a mono chip (sk_test_••••a91c), an access pill, created, last used and expiry dates, and quiet Roll and Revoke buttons. A new key arrives in a dialog that shows the secret in a mono box with Show and Copy. On a phone each key becomes a small card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: API keys; developer settings; access tokens; personal access tokens; integrations settings; service credentials; webhook secrets; developer portal
 * Jobs to be done: create a key for an integration; copy a new key before it is hidden; see which keys are still used; replace a key that leaked; revoke a key nobody needs
 * Keywords: api, keys, tokens, secret, developer, credentials, revoke, roll, copy, integrations
 */
/**
 * API keys manager: the keys a workspace has made, newest first. Create key opens a short form (name, access, expiry);
 * the new secret then shows once in a dialog that only closes after "I saved this key" is ticked, because it can't be
 * shown again. Roll gives an existing key a new secret (the old one stops working) and Revoke deletes it; both ask
 * first. Keys past their expiry date are marked Expired. Make it the app's own: replace SAMPLE with the workspace's
 * keys (never real secrets, only a prefix and the last four characters), have `create` and `onRoll` call the server
 * that makes the secret, and revoke through onRevoke.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its data tables, inputs and modals.
 */
/**
 * How to try it
 * - Press Create key, leave the name empty and press Create: the field says why. Try "Zapier sync" (already used),
 *   then "Billing export": the secret dialog opens. Press Show, then Copy; Done stays locked until you tick the box.
 * - Name a key "fail" to see the error a failed request shows.
 * - Press Roll on a key and confirm: a new secret shows once. Press Revoke and confirm: the row fades away.
 * - Revoke every key: the empty state invites you to make the first one.
 *
 * Dependencies: React (useId, useLayoutEffect, useMemo, useRef, useState), the library's Button, TextField, Select,
 * Radio, Checkbox, Badge, Modal and EmptyState ("./buttons-variants", "./text-fields-states", "./dropdowns-states",
 * "./checkboxes-radios", "./badges-status", "./modals-dialogs", "./empty-states") and its inline icon set ("./icons").
 * Nothing else: no package to install and nothing fetched at run time. The sample secrets are made up in the browser.
 * The styles are the library's own fl- classes in templates/library/css/r2h-apikeys.css.
 */
import { useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── p.api-keys: create, show once, copy, roll and revoke. ──

export type ApiKey = {
  id: string;
  name: string;
  /** The public start of the key, such as "sk_test_". */
  prefix: string;
  /** The last four characters, the only part of the secret kept after it is made. */
  last4: string;
  access: string;
  /** ISO date the key was made. */
  created: string;
  /** ISO date and time it was last used; left out when never. */
  lastUsed?: string;
  /** ISO date it stops working; null or left out when it never expires. */
  expires?: string | null;
};

export type AccessLevel = { value: string; label: string; text: string; tone?: BadgeTone };

export type ApiKeysLabels = Partial<{
  create: string;
  createTitle: string;
  createText: string;
  name: string;
  namePlaceholder: string;
  access: string;
  expiry: string;
  key: string;
  created: string;
  lastUsed: string;
  expires: string;
  never: string;
  noExpiry: string;
  expired: string;
  roll: string;
  rollTitle: string;
  rollText: string;
  revoke: string;
  revokeTitle: string;
  revokeText: string;
  secretTitle: string;
  secretText: string;
  show: string;
  hide: string;
  copy: string;
  copied: string;
  saved: string;
  savedFirst: string;
  done: string;
  creating: string;
  empty: string;
  emptyText: string;
  noName: string;
  tooLong: string;
  taken: string;
  failed: string;
}>;

export type ApiKeysProps = {
  title: string;
  lede?: string;
  keys: ApiKey[];
  accessLevels?: AccessLevel[];
  /** Expiry choices in days; 0 means never. */
  expiryDays?: number[];
  /** "Today" for the Expired and last-used words; the real date when left out. */
  now?: Date;
  /** Makes the key on the server and returns its id and full secret. Made up in the browser when left out. */
  create?: (draft: { name: string; access: string; days: number }) => Promise<{ id: string; secret: string }>;
  /** Gives a key a new secret and returns it. Made up in the browser when left out. */
  onRoll?: (id: string) => Promise<string>;
  onRevoke?: (id: string) => void;
  labels?: ApiKeysLabels;
};

const ACCESS: AccessLevel[] = [
  { value: "read", label: "Read only", text: "Can look up data, never change it.", tone: "neutral" },
  { value: "write", label: "Read and write", text: "Can create and update records.", tone: "info" },
  { value: "admin", label: "Full access", text: "Everything, including billing and members.", tone: "warning" },
];

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ms = (el: Element, name: string, fallback: number) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith("ms") ? n : n * 1000) : fallback;
};
const wait = (t: number) => new Promise((r) => window.setTimeout(r, t));

/** A made-up secret for the sample: the prefix and 32 random letters and digits. */
function fakeSecret(prefix: string) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return prefix + [...bytes].map((b) => abc[b % abc.length]).join("");
}

/** FLIP: rows marked data-flip glide from where they were to where they are now whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const rows = [...el.querySelectorAll<HTMLElement>("[data-flip]")];
    const now = new Map(rows.map((r) => [r.dataset.flip!, r.getBoundingClientRect().top]));
    if (!reduced() && document.documentElement.dataset.motion !== "off") {
      const duration = ms(el, "--duration-base", 200);
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

async function copyText(text: string, field: HTMLInputElement | null) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and locked-down frames: select the field so Ctrl+C works, and try the old command.
    if (!field) return false;
    field.type = "text";
    field.select();
    return document.execCommand?.("copy") ?? false;
  }
}

export function ApiKeys({ title, lede, keys, accessLevels = ACCESS, expiryDays = [30, 90, 365, 0], now: nowProp, create, onRoll, onRevoke, labels = {} }: ApiKeysProps) {
  const l = {
    create: "Create key",
    createTitle: "Create an API key",
    createText: "Give it a name you'll recognize later.",
    name: "Name",
    namePlaceholder: "e.g. Zapier sync",
    access: "Access",
    expiry: "Expires",
    key: "Key",
    created: "Created",
    lastUsed: "Last used",
    expires: "Expires",
    never: "Never",
    noExpiry: "No expiry",
    expired: "Expired",
    roll: "Roll",
    rollTitle: "Roll {name}?",
    rollText: "You get a new secret. The old one stops working right away, so update anything that uses it.",
    revoke: "Revoke",
    revokeTitle: "Revoke {name}?",
    revokeText: "Anything using this key stops working right away. This can't be undone.",
    secretTitle: "Save your key",
    secretText: "This is the only time you'll see it. Store it somewhere safe.",
    show: "Show",
    hide: "Hide",
    copy: "Copy",
    copied: "Copied",
    saved: "I saved this key somewhere safe",
    savedFirst: "Tick the box once you've saved the key.",
    done: "Done",
    creating: "Creating…",
    empty: "No API keys yet",
    emptyText: "Create a key to connect another app to your workspace.",
    noName: "Enter a name.",
    tooLong: "Keep it under 40 characters.",
    taken: "A key already has that name.",
    failed: "Couldn't create the key. Try again.",
    ...labels,
  };
  const id = useId();
  const now = nowProp ?? new Date();
  const [list, setList] = useState(keys);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(null);
  const [rolling, setRolling] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const body = useRef<HTMLTableSectionElement>(null);
  const createBtn = useRef<HTMLButtonElement>(null);

  const level = (v: string) => accessLevels.find((a) => a.value === v) ?? { value: v, label: v, text: "", tone: "neutral" as const };
  const sorted = useMemo(() => [...list].sort((a, b) => b.created.localeCompare(a.created)), [list]);
  useFlip(body, sorted.map((k) => k.id).join());

  const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
  const fmt = (iso: string) => day.format(new Date(iso.length === 10 ? `${iso}T12:00` : iso));
  const ago = (iso?: string) => {
    if (!iso) return l.never;
    const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
    if (mins < 60 * 24 * 14) return `${Math.round(mins / 1440)} days ago`;
    return fmt(iso);
  };
  const isExpired = (k: ApiKey) => Boolean(k.expires) && new Date(`${k.expires}T23:59`).getTime() < now.getTime();
  const dayLabel = (d: number) => (d === 0 ? l.noExpiry : d === 365 ? "1 year" : `${d} days`);

  const make = async (draft: { name: string; access: string; days: number }) => {
    if (create) return create(draft);
    await wait(600);
    return { id: `key-${Date.now()}`, secret: fakeSecret("sk_test_") };
  };

  const submit = (data: FormData) => {
    const name = String(data.get("name") ?? "").trim();
    const access = String(data.get("access") ?? accessLevels[0]!.value);
    const days = Number(data.get("days") ?? 0);
    setFormError("");
    if (!name) return (setNameError(l.noName), false as const);
    if (name.length > 40) return (setNameError(l.tooLong), false as const);
    if (list.some((k) => k.name.toLowerCase() === name.toLowerCase())) return (setNameError(l.taken), false as const);
    setBusy(true);
    make({ name, access, days })
      .then(({ id: newId, secret: value }) => {
        const today = now.toISOString().slice(0, 10);
        const expires = days ? new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10) : null;
        const key: ApiKey = { id: newId, name, prefix: value.slice(0, value.indexOf("_", 3) + 1) || "sk_", last4: value.slice(-4), access, created: today, expires };
        setList((xs) => [key, ...xs]);
        setFresh([newId]);
        setCreating(false);
        setSecret({ name, value });
        setStatus(`${name} created.`);
      })
      .catch(() => setFormError(l.failed))
      .finally(() => setBusy(false));
    return false as const;
  };

  const roll = (k: ApiKey) => {
    setBusy(true);
    (onRoll ? onRoll(k.id) : wait(500).then(() => fakeSecret(k.prefix)))
      .then((value) => {
        setList((xs) => xs.map((x) => (x.id === k.id ? { ...x, last4: value.slice(-4), lastUsed: undefined } : x)));
        setRolling(null);
        setSecret({ name: k.name, value });
        setStatus(`${k.name} has a new secret. The old one no longer works.`);
      })
      .catch(() => {
        setRolling(null);
        setStatus(`Couldn't roll ${k.name}. Try again.`);
      })
      .finally(() => setBusy(false));
    return false as const;
  };

  const revoke = (k: ApiKey) => {
    setLeaving((xs) => [...xs, k.id]);
    setStatus(`${k.name} revoked.`);
    onRevoke?.(k.id);
    const go = () => {
      setList((xs) => xs.filter((x) => x.id !== k.id));
      setLeaving((xs) => xs.filter((x) => x !== k.id));
    };
    if (reduced() || !body.current) go();
    else window.setTimeout(go, ms(body.current, "--duration-base", 200));
    // The row's buttons go away with it; focus waits on Create key.
    window.setTimeout(() => createBtn.current?.focus(), 0);
  };

  const openCreate = () => {
    setNameError("");
    setFormError("");
    setCreating(true);
  };

  return (
    <section className="fl-ak" aria-labelledby={`${id}-title`} data-fl="p.api-keys">
      <div className="fl-ak-head">
        <div className="fl-ak-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <Button ref={createBtn} icon="plus" size={40} onClick={openCreate}>
          {l.create}
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState variant="first-use" icon="lock" title={l.empty} action={<Button icon="plus" size={40} onClick={openCreate}>{l.create}</Button>}>
          {l.emptyText}
        </EmptyState>
      ) : (
        <div className="fl-ak-scroll">
          <table className="fl-ak-table">
            <caption className="fl-sr">
              {title}, {sorted.length}
            </caption>
            <thead>
              <tr>
                <th scope="col">{l.name}</th>
                <th scope="col">{l.key}</th>
                <th scope="col">{l.access}</th>
                <th scope="col">{l.created}</th>
                <th scope="col">{l.lastUsed}</th>
                <th scope="col">{l.expires}</th>
                <th scope="col">
                  <span className="fl-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody ref={body}>
              {sorted.map((k) => {
                const a = level(k.access);
                const expired = isExpired(k);
                const cls = ["fl-ak-row", leaving.includes(k.id) ? "is-leaving" : "", fresh.includes(k.id) ? "is-new" : "", expired ? "is-expired" : ""].filter(Boolean).join(" ");
                return (
                  <tr key={k.id} data-flip={k.id} className={cls} inert={leaving.includes(k.id) || undefined}>
                    <th scope="row" data-label={l.name}>
                      <span className="fl-ak-name">{k.name}</span>
                    </th>
                    <td data-label={l.key}>
                      <code className="fl-ak-mask" aria-label={`${k.prefix} ending in ${k.last4}`}>
                        {k.prefix}
                        <span aria-hidden="true">••••</span>
                        {k.last4}
                      </code>
                    </td>
                    <td data-label={l.access}>
                      <Badge tone={a.tone ?? "neutral"}>{a.label}</Badge>
                    </td>
                    <td data-label={l.created} className="fl-ak-muted">
                      {fmt(k.created)}
                    </td>
                    <td data-label={l.lastUsed} className="fl-ak-muted">
                      {ago(k.lastUsed)}
                    </td>
                    <td data-label={l.expires} className="fl-ak-muted">
                      {expired ? (
                        <Badge tone="danger" led>
                          {l.expired}
                        </Badge>
                      ) : k.expires ? (
                        fmt(k.expires)
                      ) : (
                        l.never
                      )}
                    </td>
                    <td className="fl-ak-actions">
                      <Button variant="tertiary" size={32} icon="refresh" aria-label={`${l.roll} ${k.name}`} onClick={() => setRolling(k)}>
                        {l.roll}
                      </Button>
                      <Button variant="tertiary" size={32} icon="trash" iconOnly aria-label={`${l.revoke} ${k.name}`} onClick={() => setRevoking(k)}>
                        {l.revoke}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="fl-ak-status" role="status" aria-live="polite">
        {status}
      </p>

      {creating ? (
        <Modal variant="form" title={l.createTitle} description={l.createText} confirmLabel={l.create} busy={busy} busyLabel={l.creating} onConfirm={submit} onClose={() => setCreating(false)}>
          <div className="fl-ak-form">
            <div className="fl-ak-field">
              <label htmlFor={`${id}-name`}>{l.name}</label>
              <TextField
                id={`${id}-name`}
                name="name"
                size={40}
                autoComplete="off"
                maxLength={60}
                placeholder={l.namePlaceholder}
                data-autofocus
                invalid={Boolean(nameError)}
                aria-describedby={nameError ? `${id}-name-err` : undefined}
                onInput={() => nameError && setNameError("")}
              />
              {nameError ? (
                <p id={`${id}-name-err`} className="fl-ak-error" role="alert">
                  <Icon name="alert" />
                  {nameError}
                </p>
              ) : null}
            </div>
            <fieldset className="fl-ak-field fl-ak-radios">
              <legend>{l.access}</legend>
              {accessLevels.map((a, i) => (
                <Radio key={a.value} name="access" value={a.value} defaultChecked={i === 0} label={a.label} description={a.text} />
              ))}
            </fieldset>
            <div className="fl-ak-field">
              <label htmlFor={`${id}-days`}>{l.expiry}</label>
              <Select id={`${id}-days`} name="days" defaultValue={String(expiryDays[1] ?? expiryDays[0])} options={expiryDays.map((d) => ({ value: String(d), label: dayLabel(d) }))} />
            </div>
            {formError ? (
              <p className="fl-ak-error" role="alert">
                <Icon name="alert" />
                {formError}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {secret ? <SecretDialog name={secret.name} value={secret.value} l={l} onDone={() => { setSecret(null); setStatus(`${secret.name} is ready to use.`); }} /> : null}

      {rolling ? (
        <Modal variant="danger" icon="refresh" title={l.rollTitle.replace("{name}", rolling.name)} description={l.rollText} confirmLabel={l.roll} busy={busy} busyLabel="Rolling…" onConfirm={() => roll(rolling)} onClose={() => setRolling(null)} />
      ) : null}

      {revoking ? (
        <Modal
          variant="danger"
          icon="trash"
          title={l.revokeTitle.replace("{name}", revoking.name)}
          description={l.revokeText}
          confirmLabel={l.revoke}
          onConfirm={() => revoke(revoking)}
          onClose={() => setRevoking(null)}
        />
      ) : null}
    </section>
  );
}

/** The secret, shown once: hidden until Show, copyable, and the dialog closes only after the person says it is saved. */
function SecretDialog({ name, value, l, onDone }: { name: string; value: string; l: Required<ApiKeysLabels>; onDone: () => void }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nag, setNag] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  return (
    <Modal
      variant="blocking"
      title={l.secretTitle}
      description={l.secretText}
      confirmLabel={l.done}
      onConfirm={() => {
        if (!saved) return (setNag(true), false as const);
        onDone();
      }}
      onClose={onDone}
    >
      <div className="fl-ak-secret">
        <label htmlFor={`${id}-secret`} className="fl-ak-secret-name">
          {name}
        </label>
        <div className="fl-ak-secret-row">
          <input ref={field} id={`${id}-secret`} className="fl-ak-secret-value" type={shown ? "text" : "password"} value={value} readOnly spellCheck={false} onFocus={(e) => e.currentTarget.select()} />
          <Button variant="secondary" size={40} icon={shown ? "eye-off" : "eye"} iconOnly pressed={shown} onClick={() => setShown((s) => !s)}>
            {shown ? l.hide : l.show}
          </Button>
          <Button
            variant="secondary"
            size={40}
            icon={copied ? "check" : "copy"}
            data-autofocus
            onClick={async () => {
              const ok = await copyText(value, field.current);
              setCopied(ok);
              if (ok) window.setTimeout(() => setCopied(false), 2500);
            }}
          >
            {copied ? l.copied : l.copy}
          </Button>
        </div>
        <p className="fl-ak-copied" role="status" aria-live="polite">
          {copied ? "Key copied to the clipboard." : ""}
        </p>
        <Checkbox
          label={l.saved}
          checked={saved}
          onChange={(e) => {
            setSaved(e.target.checked);
            if (e.target.checked) setNag(false);
          }}
          aria-describedby={nag ? `${id}-nag` : undefined}
        />
        {nag ? (
          <p id={`${id}-nag`} className="fl-ak-error" role="alert">
            <Icon name="alert" />
            {l.savedFirst}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "API keys",
  lede: "Keys let other apps read and change data in Northlight. Treat them like passwords.",
  now: new Date("2026-10-21T10:00:00"),
  // Made-up test keys: only a prefix and the last four characters are ever kept.
  keys: [
    { id: "k1", name: "Zapier sync", prefix: "sk_test_", last4: "a91c", access: "write", created: "2026-09-14", lastUsed: "2026-10-21T09:48:00", expires: "2027-09-14" },
    { id: "k2", name: "Reporting dashboard", prefix: "sk_test_", last4: "7Qe2", access: "read", created: "2026-08-02", lastUsed: "2026-10-19T16:05:00", expires: null },
    { id: "k3", name: "Old CRM import", prefix: "sk_test_", last4: "mP0x", access: "admin", created: "2026-03-30", lastUsed: "2026-06-11T11:20:00", expires: "2026-09-30" },
    { id: "k4", name: "Staging deploy bot", prefix: "sk_test_", last4: "Hk4d", access: "write", created: "2026-10-03", expires: "2027-01-01" },
  ] as ApiKey[],
};

export default function ApiKeysSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ApiKeys
          {...SAMPLE}
          create={async ({ name }) => {
            await wait(700);
            if (name.toLowerCase() === "fail") throw new Error("Server said no");
            return { id: `key-${Date.now()}`, secret: fakeSecret("sk_test_") };
          }}
        />
      </div>
    </section>
  );
}
