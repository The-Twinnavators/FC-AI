/** @flowcode-library account-two-factor · Two-factor settings (Forms)
 * Catalog ID: p.two-factor (pattern)
 * Function: Two-factor sign-in settings (p.two-factor): a card of sign-in methods (security key, authenticator app, text message), each set up in a short dialog that checks a 6-digit code (the app shows a scan code and a setup key to copy; text message sends a code to a checked phone number; a key is named and touched), removed only after a confirm, plus recovery codes that are generated, shown once, copied or downloaded, and replaced only after a confirm.
 * Use it as: import { TwoFactor } from "./account-two-factor"; <TwoFactor title lede? methods={[{ id, kind: "key"|"app"|"sms", title, text, recommended?, detail?: "+1 ••• ••• 4567" | null, added?: "2026-09-02" }]} codesLeft?={8} now?={new Date()} verify?={async (kind, code) => boolean} sendCode?={async (phone) => void} makeCodes?={async () => string[]} onChange?={(methods) => ...} labels?={{ on, off, setUp, edit, remove, ... }} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.checkbox, c.badge.status, c.modal.form, c.modal.danger, c.modal.blocking
 * Look: A white card with a shield tile, the title and a line of help, and an On or Off pill at the right; below, three method rows (a rounded icon tile, the method name with a Recommended pill, a muted sentence, and a ticked detail line once set up) each with Set up or Edit and Remove; a sunken recovery panel sits along the bottom with the count of codes left and Show codes / New codes.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: two-factor authentication; 2FA settings; security settings; account security; authenticator app setup; recovery codes; MFA; sign-in protection
 * Jobs to be done: turn on two-factor sign-in; set up an authenticator app; add a phone for sign-in codes; save recovery codes in case I lose my phone; remove a method I no longer use
 * Keywords: two-factor, 2fa, mfa, authenticator, totp, security key, sms, recovery codes, backup codes, security
 */
/**
 * Two-factor settings: the ways a person can prove it's them after the password. Each method sets up in a dialog and
 * only counts once a code checks out; removing one asks first (and says when that turns two-factor off). Recovery
 * codes appear once in a dialog that only closes after "I saved these codes" is ticked. Make it the app's own: replace
 * SAMPLE with the account's methods, and have `verify`, `sendCode` and `makeCodes` call the server (the scan code here
 * is a drawn stand-in, so draw the server's otpauth link with the app's own QR renderer).
 * Adapted from Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): its account two-factor block.
 */
/**
 * How to try it
 * - Press Set up on Authenticator app: Copy the setup key, type 000000 and press Verify (it says the code didn't match),
 *   then any other six digits: the row is ticked and the recovery codes dialog opens because none exist yet.
 * - In that dialog press Done before ticking the box: it asks you to tick it. Copy or Download the codes, tick, Done.
 * - Press Edit on Text message: a short number is refused; a full one sends a code, then any six digits other than
 *   000000 save it.
 * - Press Add on Security key, name it and press Add key: it waits for the touch, then the key is listed.
 * - Remove every method: the confirm says two-factor turns off, and the pill flips to Off.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Button, TextField, Checkbox, Badge
 * and Modal ("./buttons-variants", "./text-fields-states", "./checkboxes-radios", "./badges-status", "./modals-dialogs")
 * and its inline icon set ("./icons"). Nothing else: no package and nothing fetched; the sample codes are made up in the
 * browser. The styles are the library's own fl- classes in templates/library/css/r3c-two-factor.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── p.two-factor: methods, set up with a code check, and one-time recovery codes. ──

export type TwoFactorKind = "key" | "app" | "sms";

export type TwoFactorMethod = {
  id: string;
  kind: TwoFactorKind;
  title: string;
  text: string;
  recommended?: boolean;
  /** What is set up, shown with a tick: a masked phone number, a key's name, "Authenticator app". Null when not set up. */
  detail?: string | null;
  /** ISO date it was set up. */
  added?: string;
};

export type TwoFactorLabels = Partial<{
  on: string;
  off: string;
  setUp: string;
  add: string;
  edit: string;
  remove: string;
  recommended: string;
  notSet: string;
  codesTitle: string;
  codesText: string;
  codesLeft: string;
  noCodes: string;
  showCodes: string;
  newCodes: string;
  needMethod: string;
  verify: string;
  verifying: string;
  code: string;
  badCode: string;
  noCode: string;
  mismatch: string;
  failed: string;
}>;

export type TwoFactorProps = {
  title: string;
  lede?: string;
  methods: TwoFactorMethod[];
  /** Recovery codes still unused; 0 or left out when none were made. */
  codesLeft?: number;
  /** "Today" for the added dates; the real date when left out. */
  now?: Date;
  /** Checks a 6-digit code for a method; resolve true when it matches. Any code but 000000 passes when left out. */
  verify?: (kind: TwoFactorKind, code: string) => Promise<boolean>;
  /** Sends a sign-in code to a phone number. Waits a moment when left out. */
  sendCode?: (phone: string) => Promise<void>;
  /** Makes a fresh set of recovery codes (the old ones stop working). Made up in the browser when left out. */
  makeCodes?: () => Promise<string[]>;
  onChange?: (methods: TwoFactorMethod[]) => void;
  labels?: TwoFactorLabels;
};

const ICON: Record<TwoFactorKind, string> = { key: "lock", app: "phone", sms: "send" };
const reduced = () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off");
const wait = (t: number) => new Promise((r) => window.setTimeout(r, t));

/** Made-up recovery codes for the sample: ten of xxxx-xxxx in letters and digits that are easy to read. */
function fakeCodes() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(80);
  crypto.getRandomValues(bytes);
  return Array.from({ length: 10 }, (_, i) => {
    const s = [...bytes.slice(i * 8, i * 8 + 8)].map((b) => abc[b % abc.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

/** A made-up setup key in groups of four, like the base32 secret an authenticator app takes. */
function fakeSecret() {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => abc[b % 32]).join("").replace(/(.{4})/g, "$1 ").trim();
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A drawn stand-in for the scan code: 25 x 25 modules seeded from the key, with the three corner squares. */
function ScanCode({ seed, label }: { seed: string; label: string }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const out: [number, number][] = [];
    const finder = (x: number, y: number) => (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16);
    for (let y = 0; y < 25; y++)
      for (let x = 0; x < 25; x++) {
        h = Math.imul(h ^ (x * 31 + y), 2654435761) >>> 0;
        if (!finder(x, y) && h % 100 < 46) out.push([x, y]);
      }
    return out;
  }, [seed]);
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="var(--color-surface)" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  );
  return (
    <svg className="fl-tfa-qr" viewBox="-2 -2 29 29" role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={29} height={29} fill="var(--color-surface)" />
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
      ))}
      {eye(0, 0)}
      {eye(18, 0)}
      {eye(0, 18)}
    </svg>
  );
}

export function TwoFactor({ title, lede, methods, codesLeft = 0, now: nowProp, verify, sendCode, makeCodes, onChange, labels = {} }: TwoFactorProps) {
  const l = {
    on: "On",
    off: "Off",
    setUp: "Set up",
    add: "Add",
    edit: "Edit",
    remove: "Remove",
    recommended: "Recommended",
    notSet: "Not set up",
    codesTitle: "Recovery codes",
    codesText: "Use one if you lose your phone or key. Each code works once.",
    codesLeft: "{n} of 10 codes left",
    noCodes: "No codes yet",
    showCodes: "Show codes",
    newCodes: "New codes",
    needMethod: "Set up a method first.",
    verify: "Verify",
    verifying: "Checking…",
    code: "6-digit code",
    badCode: "Enter the 6 digits from the app.",
    noCode: "Enter the code.",
    mismatch: "That code didn't match. Try the newest one.",
    failed: "Something went wrong. Try again.",
    ...labels,
  };
  const id = useId();
  const now = nowProp ?? new Date();
  const [list, setList] = useState(methods);
  const [left, setLeft] = useState(codesLeft);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [lastCodes, setLastCodes] = useState<string[] | null>(null);
  const [open, setOpen] = useState<TwoFactorMethod | null>(null);
  const [removing, setRemoving] = useState<TwoFactorMethod | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [entering, setEntering] = useState(true);
  const [popped, setPopped] = useState("");
  const codesBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setEntering(false), 900);
    return () => window.clearTimeout(t);
  }, []);

  const isOn = list.some((m) => m.detail);
  const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
  const fmt = (iso: string) => day.format(new Date(`${iso}T12:00`));

  const commit = (next: TwoFactorMethod[]) => {
    setList(next);
    onChange?.(next);
  };

  const generate = async () => {
    setBusy(true);
    try {
      const fresh = makeCodes ? await makeCodes() : (await wait(500), fakeCodes());
      setCodes(fresh);
      setLastCodes(fresh);
      setLeft(fresh.length);
      setStatus("New recovery codes made. The old ones no longer work.");
    } catch {
      setStatus(l.failed);
    } finally {
      setBusy(false);
      setRenewing(false);
    }
  };

  const finishSetup = (m: TwoFactorMethod, detail: string) => {
    const today = now.toISOString().slice(0, 10);
    commit(list.map((x) => (x.id === m.id ? { ...x, detail, added: today } : x)));
    setOpen(null);
    setPopped(m.id);
    setStatus(`${m.title} is set up.`);
    if (!left) void generate();
  };

  const remove = (m: TwoFactorMethod) => {
    const next = list.map((x) => (x.id === m.id ? { ...x, detail: null, added: undefined } : x));
    commit(next);
    setRemoving(null);
    const stillOn = next.some((x) => x.detail);
    setStatus(stillOn ? `${m.title} removed.` : `${m.title} removed. Two-factor sign-in is off.`);
  };

  return (
    <section className="fl-tfa" aria-labelledby={`${id}-title`} data-fl="p.two-factor">
      <header className="fl-tfa-head">
        <span className="fl-tfa-shield" aria-hidden="true">
          <Icon name="shield" />
        </span>
        <div className="fl-tfa-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <Badge tone={isOn ? "success" : "neutral"} led className="fl-tfa-state">
          {isOn ? l.on : l.off}
        </Badge>
      </header>

      <ul className="fl-tfa-list" role="list">
        {list.map((m, i) => {
          const set = Boolean(m.detail);
          return (
            <li key={m.id} className={["fl-tfa-row", entering ? "is-entering" : "", set ? "is-set" : ""].filter(Boolean).join(" ")} style={{ "--i": i } as CSSProperties}>
              <span className="fl-tfa-tile" aria-hidden="true">
                <Icon name={ICON[m.kind]} />
              </span>
              <div className="fl-tfa-copy">
                <p className="fl-tfa-name">
                  <strong>{m.title}</strong>
                  {m.recommended ? <span className="fl-tfa-rec">{l.recommended}</span> : null}
                </p>
                <p className="fl-tfa-text">{m.text}</p>
                <p className={["fl-tfa-detail", popped === m.id ? "is-popped" : ""].filter(Boolean).join(" ")}>
                  {set ? (
                    <>
                      <span className="fl-tfa-tick" aria-hidden="true">
                        <Icon name="check" />
                      </span>
                      <span>
                        {m.detail}
                        {m.added ? <span className="fl-tfa-added"> · Added {fmt(m.added)}</span> : null}
                      </span>
                    </>
                  ) : (
                    <span className="fl-tfa-muted">{l.notSet}</span>
                  )}
                </p>
              </div>
              <div className="fl-tfa-actions">
                {set ? (
                  <>
                    {m.kind === "sms" ? (
                      <Button variant="secondary" size={32} onClick={() => setOpen(m)} aria-label={`${l.edit} ${m.title}`}>
                        {l.edit}
                      </Button>
                    ) : null}
                    <Button variant="tertiary" size={32} icon="trash" iconOnly aria-label={`${l.remove} ${m.title}`} onClick={() => setRemoving(m)}>
                      {l.remove}
                    </Button>
                  </>
                ) : (
                  <Button size={32} variant={m.recommended ? "primary" : "secondary"} onClick={() => setOpen(m)} aria-label={`${m.kind === "key" ? l.add : l.setUp} ${m.title}`}>
                    {m.kind === "key" ? l.add : l.setUp}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fl-tfa-codes">
        <span className="fl-tfa-codes-icon" aria-hidden="true">
          <Icon name="lock" />
        </span>
        <div className="fl-tfa-copy">
          <p className="fl-tfa-name">
            <strong>{l.codesTitle}</strong>
          </p>
          <p className="fl-tfa-text">{l.codesText}</p>
          <p className="fl-tfa-detail">
            {left ? (
              <span className={left <= 3 ? "fl-tfa-low" : undefined}>{l.codesLeft.replace("{n}", String(left))}</span>
            ) : (
              <span className="fl-tfa-muted">{isOn ? l.noCodes : l.needMethod}</span>
            )}
          </p>
        </div>
        <div className="fl-tfa-actions">
          {lastCodes ? (
            <Button variant="tertiary" size={32} icon="eye" onClick={() => setCodes(lastCodes)}>
              {l.showCodes}
            </Button>
          ) : null}
          <Button ref={codesBtn} variant="secondary" size={32} icon="refresh" disabled={!isOn} busy={busy && !codes && !renewing} onClick={() => (left ? setRenewing(true) : void generate())}>
            {l.newCodes}
          </Button>
        </div>
      </div>

      <p className="fl-tfa-status" role="status" aria-live="polite">
        {status}
      </p>

      {open?.kind === "app" ? <AppSetup method={open} l={l} verify={verify} onClose={() => setOpen(null)} onDone={() => finishSetup(open, "Authenticator app")} /> : null}
      {open?.kind === "sms" ? <SmsSetup method={open} l={l} verify={verify} sendCode={sendCode} onClose={() => setOpen(null)} onDone={(masked) => finishSetup(open, masked)} /> : null}
      {open?.kind === "key" ? <KeySetup method={open} l={l} onClose={() => setOpen(null)} onDone={(name) => finishSetup(open, name)} /> : null}

      {removing ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Remove ${removing.title.toLowerCase()}?`}
          description={list.filter((m) => m.detail).length === 1 ? "This is your last method, so two-factor sign-in turns off. Anyone with your password could sign in." : "You can still sign in with your other methods."}
          confirmLabel={l.remove}
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      ) : null}

      {renewing ? (
        <Modal variant="danger" icon="refresh" title="Make new recovery codes?" description="Your current codes stop working right away." confirmLabel={l.newCodes} busy={busy} busyLabel="Making…" onConfirm={() => (void generate(), false as const)} onClose={() => setRenewing(false)} />
      ) : null}

      {codes ? (
        <CodesDialog
          codes={codes}
          onDone={() => {
            setCodes(null);
            setStatus("Recovery codes saved.");
            window.setTimeout(() => codesBtn.current?.focus(), 0);
          }}
        />
      ) : null}
    </section>
  );
}

type L = Required<TwoFactorLabels>;

/** The 6-digit code box shared by the app and text message dialogs. */
function CodeField({ id, error, onInput, l }: { id: string; error: string; onInput: () => void; l: L }) {
  return (
    <div className="fl-tfa-field">
      <label htmlFor={id}>{l.code}</label>
      <TextField
        id={id}
        name="code"
        size={44}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        className="fl-tfa-otp"
        placeholder="123456"
        invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
        onInput={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          el.value = el.value.replace(/\D/g, "").slice(0, 6);
          onInput();
        }}
      />
      {error ? (
        <p id={`${id}-err`} className="fl-tfa-error" role="alert">
          <Icon name="alert" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const check = async (verify: TwoFactorProps["verify"], kind: TwoFactorKind, code: string) => (verify ? verify(kind, code) : (await wait(700), code !== "000000"));

function AppSetup({ method, l, verify, onClose, onDone }: { method: TwoFactorMethod; l: L; verify?: TwoFactorProps["verify"]; onClose: () => void; onDone: () => void }) {
  const id = useId();
  const secret = useMemo(fakeSecret, []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <Modal
      variant="form"
      title={`Set up ${method.title.toLowerCase()}`}
      description="Scan the code with your app, then enter the code it shows."
      confirmLabel={l.verify}
      busy={busy}
      busyLabel={l.verifying}
      onClose={onClose}
      onConfirm={(data) => {
        const code = String(data.get("code") ?? "");
        if (!code) return (setError(l.noCode), false as const);
        if (!/^\d{6}$/.test(code)) return (setError(l.badCode), false as const);
        setBusy(true);
        check(verify, "app", code)
          .then((ok) => (ok ? onDone() : setError(l.mismatch)))
          .catch(() => setError(l.failed))
          .finally(() => setBusy(false));
        return false as const;
      }}
    >
      <div className="fl-tfa-setup">
        <ol className="fl-tfa-steps">
          <li>
            <span className="fl-tfa-step">1</span>
            <div className="fl-tfa-scan">
              <ScanCode seed={secret} label="Scan code for your authenticator app" />
              <div className="fl-tfa-key">
                <span id={`${id}-k`} className="fl-tfa-keylabel">
                  Can't scan? Enter this key
                </span>
                <code aria-labelledby={`${id}-k`}>{secret}</code>
                <Button
                  variant="secondary"
                  size={32}
                  icon={copied ? "check" : "copy"}
                  onClick={async () => {
                    const ok = await copyText(secret.replace(/ /g, ""));
                    setCopied(ok);
                    if (ok) window.setTimeout(() => setCopied(false), 2500);
                  }}
                >
                  {copied ? "Copied" : "Copy key"}
                </Button>
                <span className="fl-sr" role="status" aria-live="polite">
                  {copied ? "Setup key copied." : ""}
                </span>
              </div>
            </div>
          </li>
          <li>
            <span className="fl-tfa-step">2</span>
            <CodeField id={`${id}-code`} error={error} onInput={() => error && setError("")} l={l} />
          </li>
        </ol>
      </div>
    </Modal>
  );
}

function SmsSetup({ method, l, verify, sendCode, onClose, onDone }: { method: TwoFactorMethod; l: L; verify?: TwoFactorProps["verify"]; sendCode?: TwoFactorProps["sendCode"]; onClose: () => void; onDone: (masked: string) => void }) {
  const id = useId();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const digits = (s: string) => s.replace(/\D/g, "");
  // The send button goes busy (and loses focus); the code box takes it once the text is on its way.
  useEffect(() => {
    if (sent) document.getElementById(`${id}-code`)?.focus();
  }, [sent, id]);
  const masked = (s: string) => {
    const d = digits(s);
    // A number written with + keeps its country code; one without is read as a +1 number.
    const cc = s.trim().startsWith("+") ? d.slice(0, Math.max(1, d.length - 10)) : "1";
    return `+${cc} ••• ••• ${d.slice(-4)}`;
  };
  return (
    <Modal
      variant="form"
      title={sent ? "Enter the code" : `Set up ${method.title.toLowerCase()}`}
      description={sent ? `We sent a code to ${masked(phone)}.` : "We'll text a code to this number each time you sign in."}
      confirmLabel={sent ? l.verify : "Send code"}
      busy={busy}
      busyLabel={sent ? l.verifying : "Sending…"}
      onClose={onClose}
      onConfirm={(data) => {
        if (!sent) {
          const p = String(data.get("phone") ?? "").trim();
          if (!p) return (setError("Enter a phone number."), false as const);
          if (digits(p).length < 10 || digits(p).length > 15) return (setError("Enter the full number, with the area code."), false as const);
          setPhone(p);
          setBusy(true);
          (sendCode ? sendCode(p) : wait(700))
            .then(() => setSent(true))
            .catch(() => setError(l.failed))
            .finally(() => setBusy(false));
          return false as const;
        }
        const code = String(data.get("code") ?? "");
        if (!code) return (setError(l.noCode), false as const);
        if (!/^\d{6}$/.test(code)) return (setError("Enter the 6 digits from the text."), false as const);
        setBusy(true);
        check(verify, "sms", code)
          .then((ok) => (ok ? onDone(masked(phone)) : setError(l.mismatch)))
          .catch(() => setError(l.failed))
          .finally(() => setBusy(false));
        return false as const;
      }}
    >
      {sent ? (
        <div className="fl-tfa-setup" key="code">
          <CodeField id={`${id}-code`} error={error} onInput={() => error && setError("")} l={l} />
          <button
            type="button"
            className="fl-tfa-link"
            onClick={() => {
              setSent(false);
              setError("");
            }}
          >
            Use a different number
          </button>
        </div>
      ) : (
        <div className="fl-tfa-field" key="phone">
          <label htmlFor={`${id}-phone`}>Phone number</label>
          <TextField
            id={`${id}-phone`}
            name="phone"
            type="tel"
            size={44}
            autoComplete="tel"
            defaultValue={phone}
            placeholder="+1 555 123 4567"
            data-autofocus
            invalid={Boolean(error)}
            aria-describedby={error ? `${id}-perr` : undefined}
            onInput={() => error && setError("")}
          />
          {error ? (
            <p id={`${id}-perr`} className="fl-tfa-error" role="alert">
              <Icon name="alert" />
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function KeySetup({ method, l, onClose, onDone }: { method: TwoFactorMethod; l: L; onClose: () => void; onDone: (name: string) => void }) {
  const id = useId();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      variant="form"
      title={`Add a ${method.title.toLowerCase().replace(/s$/, "")}`}
      description="Name it, press Add key, then touch the key when it blinks."
      confirmLabel="Add key"
      busy={busy}
      busyLabel="Touch your key…"
      onClose={onClose}
      onConfirm={(data) => {
        const name = String(data.get("name") ?? "").trim();
        if (!name) return (setError("Enter a name."), false as const);
        if (name.length > 32) return (setError("Keep it under 32 characters."), false as const);
        setBusy(true);
        wait(1200)
          .then(() => (name.toLowerCase() === "fail" ? setError("The key didn't respond. Try again.") : onDone(name)))
          .finally(() => setBusy(false));
        return false as const;
      }}
    >
      <div className="fl-tfa-field">
        <label htmlFor={`${id}-name`}>Key name</label>
        <TextField id={`${id}-name`} name="name" size={44} autoComplete="off" maxLength={40} placeholder="e.g. YubiKey 5C" data-autofocus invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} onInput={() => error && setError("")} />
        {error ? (
          <p id={`${id}-err`} className="fl-tfa-error" role="alert">
            <Icon name="alert" />
            {error}
          </p>
        ) : null}
        {busy ? (
          <p className="fl-tfa-touch" aria-hidden="true">
            <span className="fl-tfa-pulse" />
            Waiting for your key
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** The codes, shown once: copy or download, and the dialog closes only after the person says they saved them. */
function CodesDialog({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const id = useId();
  const [saved, setSaved] = useState(false);
  const [nag, setNag] = useState(false);
  const [note, setNote] = useState({ text: "", ok: true });
  const text = codes.join("\n");
  return (
    <Modal
      variant="blocking"
      title="Save your recovery codes"
      description="This is the only time you'll see them. Keep them somewhere safe."
      confirmLabel="Done"
      onConfirm={() => {
        if (!saved) return (setNag(true), false as const);
        onDone();
      }}
      onClose={onDone}
    >
      <div className="fl-tfa-codebox">
        <ol className="fl-tfa-codegrid" aria-label="Recovery codes">
          {codes.map((c, i) => (
            <li key={c} style={{ "--i": i } as CSSProperties}>
              <code>{c}</code>
            </li>
          ))}
        </ol>
        <div className="fl-tfa-codebtns">
          <Button
            variant="secondary"
            size={40}
            icon="copy"
            data-autofocus
            onClick={async () => setNote((await copyText(text)) ? { text: "Codes copied to the clipboard.", ok: true } : { text: "Couldn't copy. Select the codes and copy them.", ok: false })}
          >
            Copy all
          </Button>
          <Button
            variant="secondary"
            size={40}
            icon="download"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([`Recovery codes\n\n${text}\n`], { type: "text/plain" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = "recovery-codes.txt";
              a.click();
              window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              setNote({ text: "Codes downloaded as recovery-codes.txt.", ok: true });
            }}
          >
            Download
          </Button>
        </div>
        <p className={["fl-tfa-note", note.ok ? "" : "is-failed"].filter(Boolean).join(" ")} role="status" aria-live="polite">
          {note.text}
        </p>
        <Checkbox
          label="I saved these codes somewhere safe"
          checked={saved}
          onChange={(e) => {
            setSaved(e.target.checked);
            if (e.target.checked) setNag(false);
          }}
          aria-describedby={nag ? `${id}-nag` : undefined}
        />
        {nag ? (
          <p id={`${id}-nag`} className="fl-tfa-error" role="alert">
            <Icon name="alert" />
            Tick the box once you've saved the codes.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Two-factor sign-in",
  lede: "Ask for a second step after your password, so a stolen password isn't enough.",
  now: new Date("2026-10-21T10:00:00"),
  codesLeft: 0,
  methods: [
    { id: "m-key", kind: "key", title: "Security keys", text: "A small hardware key you touch to sign in. The strongest option.", recommended: true, detail: null },
    { id: "m-app", kind: "app", title: "Authenticator app", text: "Codes from an app like 1Password, Authy or Google Authenticator.", recommended: true, detail: null },
    { id: "m-sms", kind: "sms", title: "Text message", text: "A code sent to your phone each time you sign in.", detail: "+1 ••• ••• 4567", added: "2026-08-14" },
  ] as TwoFactorMethod[],
};

export default function TwoFactorSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <TwoFactor {...SAMPLE} />
      </div>
    </section>
  );
}
