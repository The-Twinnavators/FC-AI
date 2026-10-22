/** @flowcode-library course-certificate · Course certificate (Cards)
 * Catalog ID: p.certificate (pattern)
 * Function: A course completion certificate (p.certificate): the certificate (learner, course, date, hours, skills, signer and credential ID) beside a share panel: a public-link switch (turning it off asks first), the link with Copy, share by email (checked, sending and error states), Print or save as PDF (prints only the certificate), and a check that a credential ID is genuine.
 * Use it as: import { CourseCertificate } from "./course-certificate"; <CourseCertificate learner course issuer issued="2026-10-18" hours={12} credentialId="WF-2026-48213" url skills?={["Washes"]} signer={{ name, role }} isPublic?={true} onVisibility?={async (on) => ...} onShare?={async (email) => ...} verify?={async (id) => boolean} />
 * Built from: c.switch, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.segmented.segmented, c.modal.danger
 * Look: A gray page: on the left a wide white certificate with a thin double frame, the issuer at the top, "Certificate of completion", the learner's name large in the display face, the course, skill chips, small facts (date, hours, credential ID), a round accent seal and a signature line; on the right a white share card (public-link switch, the link with Copy, an email field with Send, Print or save as PDF) above a verify card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-sm --text-xs --text-sm --text-md --text-lg --text-2xl --font-display --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: course completion certificate; training certificate; workshop attendance certificate; continuing education credit; credential page; school award
 * Jobs to be done: see my certificate; share a link to it; send it to someone; print it or keep a PDF; let someone check it's real; hide it from the public
 * Keywords: certificate, credential, completion, diploma, share link, copy link, verify, print, PDF, course, learning, education
 */
/**
 * Course certificate. Copy puts the link on the clipboard (with a fallback that selects the field), says "Copied" for
 * two seconds and announces it. The public-link switch saves at once when turned on; turning it off asks first, and
 * while off the link, Copy and Send are disabled with a note. Send checks the email, shows Sending…, then "Sent" or an
 * error with Try again (the Test mode switch makes it fail). Print or save as PDF uses the browser's print dialog,
 * which prints only the certificate. Verify checks a credential ID: Checking…, then genuine (green) or not found (red).
 * Make it the app's own: replace SAMPLE with the learner's certificate and wire onVisibility, onShare and verify to
 * the server.
 * Adapted from Creative Tim UI (MIT License, Copyright (c) 2025 Creative Tim): its share dialog (invite by email
 * beside a copyable link).
 */
/**
 * How to try it
 * - Press Copy: it says Copied. Press Send with the email empty, then with "sam@" : the messages show.
 * - Enter a full email and Send. Set Test result to "Fails" and Send again: the error shows with Try again.
 * - Turn the public link off: it asks first. Confirm; the link and Send are disabled. Turn it back on.
 * - Verify WF-2026-48213 (genuine), then any other ID (not found).
 * - Press Print or save as PDF: only the certificate prints.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), Switch ("./switches-states"), TextField
 * ("./text-fields-states"), Button ("./buttons-variants"), Badge ("./badges-status"), Segmented
 * ("./segmented-control"), Modal ("./modals-dialogs") and the inline icon set ("./icons"). Nothing else: no package to
 * install and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r5a-course-certificate.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── p.certificate: the certificate, then share, print and verify. ──

export type CourseCertificateProps = {
  learner: string;
  course: string;
  issuer: string;
  /** ISO date */
  issued: string;
  hours: number;
  credentialId: string;
  /** The public page of this certificate. */
  url: string;
  skills?: string[];
  signer: { name: string; role: string };
  isPublic?: boolean;
  /** Saves the public-link setting. Throw to keep the old one. */
  onVisibility?: (on: boolean) => Promise<void>;
  /** Sends the link to an email. Throw to show the error. */
  onShare?: (email: string) => Promise<void>;
  /** Whether a credential ID is genuine. */
  verify?: (id: string) => Promise<boolean>;
  locale?: string;
};

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function CourseCertificate({ learner, course, issuer, issued, hours, credentialId, url, skills = [], signer, isPublic = true, onVisibility, onShare, verify, locale = "en-US" }: CourseCertificateProps) {
  const uid = useId();
  const [pub, setPub] = useState(isPublic);
  const [visBusy, setVisBusy] = useState(false);
  const [askOff, setAskOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [sendError, setSendError] = useState("");
  const [test, setTest] = useState<"ok" | "fail">("ok");
  const [checkId, setCheckId] = useState("");
  const [checkError, setCheckError] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<null | { id: string; ok: boolean }>(null);
  const [said, setSaid] = useState("");
  const copyTimer = useRef(0);
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${issued}T12:00`)), [issued, locale]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // No clipboard access: select the link so Ctrl+C or the menu copies it.
      const field = document.getElementById(`${uid}-link`) as HTMLInputElement | null;
      field?.focus();
      field?.select();
      ok = document.execCommand?.("copy") ?? false;
    }
    if (ok) {
      setCopied(true);
      setSaid("Link copied.");
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } else {
      setSaid("The link is selected. Press Ctrl+C to copy it.");
    }
  };

  const setVisibility = async (on: boolean) => {
    setVisBusy(true);
    try {
      await (onVisibility ?? (() => wait(500)))(on);
      setPub(on);
      setSaid(on ? "Public link on. Anyone with the link can see this certificate." : "Public link off. The link no longer works.");
    } catch {
      setSaid("Couldn't change the link setting. Try again.");
    } finally {
      setVisBusy(false);
      setAskOff(false);
      document.querySelector<HTMLInputElement>(`#${CSS.escape(`${uid}-vis`)} input`)?.focus();
    }
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const v = email.trim();
    const bad = !v ? "Enter an email address." : !EMAIL.test(v) ? "Enter an email like name@example.com." : "";
    if (bad) {
      setEmailError(bad);
      setSaid(bad);
      document.getElementById(`${uid}-email`)?.focus();
      return;
    }
    setSending(true);
    setSendError("");
    setSent("");
    setSaid("Sending…");
    try {
      await (onShare ?? (async () => {
        await wait(800);
        if (test === "fail") throw new Error("offline");
      }))(v);
      setSent(v);
      setEmail("");
      setSaid(`Sent to ${v}.`);
      document.getElementById(`${uid}-email`)?.focus();
    } catch {
      setSendError("Not sent. Check your connection and try again.");
      setSaid("Not sent. Check your connection and try again.");
      window.setTimeout(() => document.getElementById(`${uid}-send-alert`)?.focus());
    } finally {
      setSending(false);
    }
  };

  const check = async (e: FormEvent) => {
    e.preventDefault();
    const id = checkId.trim().toUpperCase();
    if (!id) {
      setCheckError("Enter a credential ID.");
      setSaid("Enter a credential ID.");
      document.getElementById(`${uid}-check`)?.focus();
      return;
    }
    setChecking(true);
    setResult(null);
    setSaid("Checking…");
    try {
      const ok = await (verify ?? (async (x: string) => {
        await wait(700);
        return x === credentialId.toUpperCase();
      }))(id);
      setResult({ id, ok });
      setSaid(ok ? `${id} is genuine: ${learner}, ${course}.` : `${id} was not found.`);
    } catch {
      setCheckError("Couldn't check right now. Try again.");
      setSaid("Couldn't check right now. Try again.");
    } finally {
      setChecking(false);
      window.setTimeout(() => document.getElementById(`${uid}-check`)?.focus());
    }
  };

  return (
    <div className="fl-crt" data-fl="p.certificate">
      <article className="fl-crt-paper" aria-labelledby={`${uid}-name`}>
        <div className="fl-crt-frame">
          <p className="fl-crt-issuer">
            <Icon name="layers" />
            {issuer}
          </p>
          <p className="fl-crt-kind">Certificate of completion</p>
          <p className="fl-crt-lede">This certifies that</p>
          <h3 className="fl-crt-name" id={`${uid}-name`}>
            {learner}
          </h3>
          <p className="fl-crt-lede">has completed</p>
          <p className="fl-crt-course">{course}</p>
          {skills.length ? (
            <ul className="fl-crt-skills" aria-label="Skills">
              {skills.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
          <div className="fl-crt-foot">
            <dl className="fl-crt-facts">
              <div>
                <dt>Issued</dt>
                <dd>{date}</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{hours} hours</dd>
              </div>
              <div>
                <dt>Credential ID</dt>
                <dd className="fl-crt-mono">{credentialId}</dd>
              </div>
            </dl>
            <span className="fl-crt-seal" aria-hidden="true">
              <Icon name="star" filled />
            </span>
            <div className="fl-crt-sign">
              <span className="fl-crt-sign-name">{signer.name}</span>
              <span className="fl-crt-sign-line" />
              <span className="fl-crt-sign-role">{signer.role}</span>
            </div>
          </div>
        </div>
      </article>

      <aside className="fl-crt-side" aria-label="Share and verify">
        <section className="fl-crt-card" aria-labelledby={`${uid}-share-h`}>
          <h4 id={`${uid}-share-h`}>Share</h4>
          <div className="fl-crt-vis" id={`${uid}-vis`}>
            <span className="fl-crt-vis-text">
              <span className="fl-crt-strong">Public link</span>
              <span className="fl-crt-muted">{pub ? "Anyone with the link can see it" : "Only you can see it"}</span>
            </span>
            <Switch
              on={pub}
              disabled={visBusy}
              label="Public link"
              onToggle={(next) => {
                if (next) void setVisibility(true);
                else setAskOff(true);
              }}
            />
          </div>
          <div className="fl-crt-field">
            <label htmlFor={`${uid}-link`}>Link</label>
            <div className="fl-crt-row">
              <TextField id={`${uid}-link`} size={40} readOnly value={pub ? url : "Link is off"} disabled={!pub} onFocus={(e) => e.currentTarget.select()} />
              <Button variant="secondary" size={40} icon={copied ? "check" : "copy"} disabled={!pub} onClick={() => void copy()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <form className="fl-crt-field" onSubmit={(e) => void send(e)} noValidate>
            <label htmlFor={`${uid}-email`}>Send by email</label>
            <div className="fl-crt-row">
              <TextField
                id={`${uid}-email`}
                size={40}
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                disabled={!pub}
                value={email}
                invalid={Boolean(emailError)}
                aria-describedby={emailError ? `${uid}-email-err` : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                  if (sent) setSent("");
                }}
              />
              <Button type="submit" variant="primary" size={40} icon="send" busy={sending} disabled={!pub}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
            {emailError ? (
              <p className="fl-crt-err" id={`${uid}-email-err`}>
                <Icon name="alert" />
                {emailError}
              </p>
            ) : null}
            {sent ? (
              <p className="fl-crt-ok">
                <Icon name="check" />
                Sent to {sent}
              </p>
            ) : null}
            {sendError ? (
              <div className="fl-crt-alert" role="alert" id={`${uid}-send-alert`} tabIndex={-1}>
                <Icon name="alert" />
                <span>{sendError}</span>
                <Button variant="secondary" size={32} onClick={() => void send()}>
                  Try again
                </Button>
              </div>
            ) : null}
          </form>
          {!pub ? <p className="fl-crt-note">Turn the public link on to copy or send it.</p> : null}
          <Button variant="tertiary" size={40} icon="download" block onClick={() => window.print()}>
            Print or save as PDF
          </Button>
          <div className="fl-crt-test">
            <span className="fl-crt-badge">Test mode</span>
            <Segmented
              label="Test result"
              size="sm"
              value={test}
              onChange={(v) => setTest(v as "ok" | "fail")}
              options={[
                { value: "ok", label: "Sends" },
                { value: "fail", label: "Fails" },
              ]}
            />
          </div>
        </section>

        <section className="fl-crt-card" aria-labelledby={`${uid}-ver-h`}>
          <h4 id={`${uid}-ver-h`}>Verify a certificate</h4>
          <form className="fl-crt-field" onSubmit={(e) => void check(e)} noValidate>
            <label htmlFor={`${uid}-check`}>Credential ID</label>
            <div className="fl-crt-row">
              <TextField
                id={`${uid}-check`}
                size={40}
                autoComplete="off"
                spellCheck={false}
                placeholder="WF-2026-00000"
                value={checkId}
                invalid={Boolean(checkError)}
                aria-describedby={checkError ? `${uid}-check-err` : undefined}
                onChange={(e) => {
                  setCheckId(e.target.value);
                  if (checkError) setCheckError("");
                  if (result) setResult(null);
                }}
              />
              <Button type="submit" variant="secondary" size={40} icon="shield" busy={checking}>
                {checking ? "Checking…" : "Verify"}
              </Button>
            </div>
            {checkError ? (
              <p className="fl-crt-err" id={`${uid}-check-err`}>
                <Icon name="alert" />
                {checkError}
              </p>
            ) : null}
          </form>
          {result ? (
            <div className={result.ok ? "fl-crt-result is-ok" : "fl-crt-result is-bad"}>
              <Badge tone={result.ok ? "success" : "danger"} led>
                {result.ok ? "Genuine" : "Not found"}
              </Badge>
              <p className="fl-crt-muted">{result.ok ? `${learner} · ${course} · ${date}` : `No certificate has the ID ${result.id}.`}</p>
            </div>
          ) : null}
        </section>
      </aside>

      {askOff ? (
        <Modal
          variant="danger"
          icon="link"
          title="Turn off the public link?"
          description="Anyone you've shared it with will see that it's unavailable. You can turn it back on later."
          confirmLabel="Turn off"
          cancelLabel="Keep it on"
          busy={visBusy}
          busyLabel="Turning off…"
          onConfirm={() => {
            void setVisibility(false);
            return false;
          }}
          onClose={() => setAskOff(false)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: CourseCertificateProps = {
  learner: "Priya Raman",
  course: "Watercolor Foundations",
  issuer: "Northlight Art School",
  issued: "2026-10-18",
  hours: 12,
  credentialId: "WF-2026-48213",
  url: "https://learn.northlight.example/certificates/WF-2026-48213",
  skills: ["Flat and graded washes", "Color mixing", "Layered landscapes"],
  signer: { name: "Elena Marsh", role: "Lead instructor" },
};

export default function CourseCertificatePreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={`${SAMPLE.course} certificate`}>
      <div className="fl-wrap">
        <CourseCertificate {...SAMPLE} />
      </div>
    </section>
  );
}
