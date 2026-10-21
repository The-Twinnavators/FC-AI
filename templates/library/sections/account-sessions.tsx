/** @flowcode-library account-sessions · Signed-in devices (Forms)
 * Catalog ID: p.account-sessions (pattern)
 * Function: The signed-in devices pattern (p.account-sessions): every device signed in to the account with browser, place and last activity, this device marked, each opening to its details; Sign out on one device or on all the others, each confirmed first, and a switch for new sign-in alerts.
 * Use it as: import { AccountSessions } from "./account-sessions"; <AccountSessions title="Where you're signed in" sessions={[{ id, device: "laptop"|"phone"|"tablet", name, browser, place, lastActive, signedIn, ip?, method?, current? }]} alerts?={true} onSignOut?={(ids) => ...} onAlerts?={(on) => ...} />
 * Built from: c.card.surface, c.badge.status, c.button.secondary, c.button.tertiary, c.modal.danger, c.switch
 * Look: A card with a short heading and a Sign out of all other devices button, then rows of devices: a rounded tile with a laptop, phone or tablet outline, the device name with a green This device pill, the browser and place over a muted last-active line, and Details and Sign out at the right; details open under a row as label and value pairs. A switch for sign-in alerts sits along the bottom.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --surface-radius --space-1 --space-2 --space-3 --space-4 --text-xs --text-sm --text-md --duration-base --duration-slow --ease-out --focus-ring
 * Use cases: account security; signed-in devices; active sessions; login activity; security settings; device management
 * Jobs to be done: see where my account is signed in; sign out a device I lost; sign out everywhere else; get told about new sign-ins
 * Keywords: sessions, devices, security, sign out, account, login activity, settings
 */
/**
 * Signed-in devices: the security section of an account's settings. This device comes first and is marked; the others
 * follow, most recently active first. Details opens a row in place (the row grows; closed content is inert) to show
 * when it signed in, how, and from which address. Sign out on a row, or Sign out of all other devices, opens a danger
 * dialog with Keep signed in focused; the person makes the final click, then the row (or rows) fold away, a status
 * line says what happened and focus moves to the heading. A switch turns alerts for new sign-ins on and off. Use it
 * on an account, profile or settings screen. Make it the app's own: replace SAMPLE with the account's real sessions
 * and call the app's own sign-out through onSignOut.
 * Built from c.card.surface, c.badge.status, c.button, c.modal.danger and c.switch.
 * Adapted from Creative Tim UI (MIT License, Copyright (c) 2025 Creative Tim): its account sessions block (devices with
 * place, browser and last activity, each with a sign-out button).
 */
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Modal } from "./modals-dialogs";
import { Switch } from "./switches-states";

export type SessionDevice = "laptop" | "phone" | "tablet";
export type AccountSession = {
  id: string;
  device: SessionDevice;
  /** "MacBook Air", "Pixel 8". */
  name: string;
  /** "Chrome 129 on macOS". */
  browser: string;
  /** "Portland, OR, USA". */
  place: string;
  /** Plain words: "Active now", "2 hours ago". */
  lastActive: string;
  /** Plain words: "Oct 2, 2026". */
  signedIn: string;
  ip?: string;
  /** "Password and code", "Passkey". */
  method?: string;
  current?: boolean;
};

export type AccountSessionsProps = {
  title: string;
  sessions: AccountSession[];
  /** New sign-in alerts on at the start. */
  alerts?: boolean;
  onSignOut?: (ids: string[]) => void;
  onAlerts?: (on: boolean) => void;
};

/** Outline drawings of the three kinds of device, in the icon set's 24px grid and stroke. */
function DeviceGlyph({ kind }: { kind: SessionDevice }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "laptop" ? (
        <>
          <rect x="4" y="5" width="16" height="11" rx="1.5" />
          <path d="M2 19h20" />
        </>
      ) : kind === "phone" ? (
        <>
          <rect x="7" y="2.5" width="10" height="19" rx="2" />
          <path d="M11 18.5h2" />
        </>
      ) : (
        <>
          <rect x="4.5" y="3" width="15" height="18" rx="2" />
          <path d="M11 18h2" />
        </>
      )}
    </svg>
  );
}

export function AccountSessions({ title, sessions, alerts = true, onSignOut, onAlerts }: AccountSessionsProps) {
  const uid = useId();
  const [list, setList] = useState(sessions);
  // Rows on their way out: they fold closed first, then leave the list.
  const [leaving, setLeaving] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ ids: string[]; what: string } | null>(null);
  const [alertsOn, setAlertsOn] = useState(alerts);
  const [said, setSaid] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const ordered = [...list].sort((a, b) => Number(!!b.current) - Number(!!a.current));
  const others = list.filter((s) => !s.current && !leaving.includes(s.id));

  const signOut = (ids: string[], what: string) => {
    setLeaving(ids);
    setOpen(null);
    onSignOut?.(ids);
    setSaid(`Signed out of ${what}.`);
    // The row folds over --duration-slow; it is then removed. Reduced motion or animation off: the fold is near instant.
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--duration-slow")) || 320;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setList((l) => l.filter((s) => !ids.includes(s.id)));
      setLeaving([]);
    }, ms + 40);
    // The button that opened the dialog is gone, so focus lands on the heading instead of the page's top.
    window.setTimeout(() => heading.current?.focus(), 0);
  };

  return (
    <div data-fl="p.account-sessions" style={{ display: "grid" }}>
      <Card variant="surface" className="fl-ses" role="group" aria-labelledby={`${uid}-title`}>
        <div className="fl-ses-head">
          <div>
            <h3 id={`${uid}-title`} ref={heading} tabIndex={-1}>
              {title}
            </h3>
            <p>{list.length === 1 ? "1 device" : `${list.length} devices`}</p>
          </div>
          <Button variant="secondary" size={40} disabled={others.length === 0} onClick={() => setAsk({ ids: others.map((s) => s.id), what: others.length === 1 ? "1 other device" : `${others.length} other devices` })}>
            Sign out of all other devices
          </Button>
        </div>

        <ul className="fl-ses-list">
          {ordered.map((s) => {
            const isOpen = open === s.id;
            const gone = leaving.includes(s.id);
            return (
              <li key={s.id} className={["fl-ses-item", isOpen ? "is-open" : "", gone ? "is-leaving" : ""].filter(Boolean).join(" ")} inert={gone}>
                <div>
                  <div className="fl-ses-row">
                    <span className="fl-ses-glyph">
                      <DeviceGlyph kind={s.device} />
                    </span>
                    <span className="fl-ses-what">
                      <span className="fl-ses-name">
                        <strong>{s.name}</strong>
                        {s.current ? <Badge tone="success">This device</Badge> : null}
                      </span>
                      <span>
                        {s.browser} · {s.place}
                      </span>
                      <span className="fl-ses-when">{s.lastActive}</span>
                    </span>
                    <span className="fl-ses-acts">
                      <Button variant="tertiary" size={32} aria-expanded={isOpen} aria-controls={`${uid}-${s.id}`} aria-label={`Details for ${s.name}`} onClick={() => setOpen(isOpen ? null : s.id)}>
                        Details
                      </Button>
                      {!s.current ? (
                        <Button variant="tertiary" size={32} aria-label={`Sign out ${s.name}`} onClick={() => setAsk({ ids: [s.id], what: s.name })}>
                          Sign out
                        </Button>
                      ) : null}
                    </span>
                  </div>
                  <div className="fl-ses-more" id={`${uid}-${s.id}`} inert={!isOpen}>
                    <dl>
                      <div>
                        <dt>Signed in</dt>
                        <dd>{s.signedIn}</dd>
                      </div>
                      {s.method ? (
                        <div>
                          <dt>How</dt>
                          <dd>{s.method}</dd>
                        </div>
                      ) : null}
                      {s.ip ? (
                        <div>
                          <dt>Address</dt>
                          <dd>{s.ip}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="fl-ses-foot">
          <span className="fl-ses-alert">
            <strong id={`${uid}-alerts`}>New sign-in alerts</strong>
            <span>Email me when a new device signs in.</span>
          </span>
          <Switch
            on={alertsOn}
            label="New sign-in alerts"
            onToggle={(on) => {
              setAlertsOn(on);
              onAlerts?.(on);
              setSaid(on ? "Sign-in alerts on." : "Sign-in alerts off.");
            }}
          />
        </div>
        <p className="fl-ses-said" role="status" aria-live="polite">
          {said}
        </p>
      </Card>

      {ask ? (
        <Modal
          variant="danger"
          icon="lock"
          title={ask.ids.length > 1 ? `Sign out of ${ask.what}?` : `Sign out ${ask.what}?`}
          description="Anyone using it will need your password to get back in."
          confirmLabel="Sign out"
          cancelLabel="Keep signed in"
          onConfirm={() => signOut(ask.ids, ask.what)}
          onClose={() => setAsk(null)}
        />
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Where you're signed in",
  sessions: [
    { id: "s1", device: "laptop" as SessionDevice, name: "MacBook Air", browser: "Chrome 129 on macOS", place: "Portland, OR, USA", lastActive: "Active now", signedIn: "Oct 2, 2026", method: "Passkey", ip: "203.0.113.24", current: true },
    { id: "s2", device: "phone" as SessionDevice, name: "iPhone 15", browser: "Safari on iOS 19", place: "Portland, OR, USA", lastActive: "2 hours ago", signedIn: "Sep 14, 2026", method: "Password and code", ip: "198.51.100.7" },
    { id: "s3", device: "tablet" as SessionDevice, name: "iPad", browser: "Safari on iPadOS 19", place: "Seattle, WA, USA", lastActive: "Yesterday at 3:45 PM", signedIn: "Aug 30, 2026", method: "Password and code", ip: "198.51.100.62" },
    { id: "s4", device: "laptop" as SessionDevice, name: "Windows PC", browser: "Firefox 131 on Windows 11", place: "Austin, TX, USA", lastActive: "12 days ago", signedIn: "Jul 8, 2026", method: "Password", ip: "192.0.2.140" },
  ],
};

export default function AccountSessionsSheet() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <AccountSessions {...SAMPLE} />
      </div>
    </section>
  );
}
