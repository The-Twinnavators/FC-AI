/** @flowcode-library input-group · Input group (Forms)
 * Catalog ID: c.input-group (component)
 * Function: The input group (c.input-group): one field that carries fixed text, an icon or a small button at either end, or a footer row under a text area; shown as a shop address, a price, a search with clear, a copy link, a password with show and hide, and a message with a counter and Send. Adapted from TailGrids (MIT).
 * Use it as: import { InputGroup, InputGroupButton } from "./input-group"; <InputGroup label="Shop address" start?="https://"|{{ icon: "search" }}|<node/> end?=".makers.market"|<InputGroupButton label="Copy" icon="copy" iconOnly? pressed? variant?="tertiary"|"primary" onClick={...} /> footer?={<node/>} multiline? rows? hint? error? hideLabel? disabled? readOnly? id? value onChange placeholder type? inputMode? autoComplete? />
 * Built from: c.button.tertiary, c.button.primary
 * Look: A single bordered field; fixed text sits muted at the edge behind a thin divider, icons sit inside without one, small quiet buttons sit flush at the right; a text area grows a footer row with a counter and a button; the whole group rings in the accent when any part has focus and turns red with the reason below when invalid.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-danger --color-text --color-text-muted --control-md --field-radius --text-sm --text-xs --space-1 --space-2 --space-3 --focus-ring --control-shadow-focus --duration-fast --duration-base --easing --ease-out
 * Use cases: website address field; price with currency; search box with clear; copy invite link; password with show and hide; message composer; email username with domain; coupon code with apply
 * Jobs to be done: type only the part that changes; see what unit a number is in; copy a link in one click; clear what i typed; check my password before sending
 * Keywords: input group, addon, prefix, suffix, input with button, input with icon, copy field, composer
 */
/**
 * Input: input group. A text field with fixed text, an icon or a button joined inside its border, so people type only
 * the part that changes. Text addons ("https://", "$", ".makers.market") are read with the field (aria-describedby), so
 * a screen reader hears "Shop address, https://, .makers.market". Clicking the empty part of the group puts the caret
 * in the field. InputGroupButton is a small quiet button for actions on the field's text (Copy, Clear, Show).
 * With multiline it becomes a text area with a footer row for a counter and a Send button.
 * Make it the app's own: replace SAMPLE with the app's own fields and addons.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): the input group.
 */

/**
 * How to try it
 * - Shop address starts with a space and a "!": fix it to letters, numbers and dashes and the message clears.
 * - Type in Search, then press Clear (or Escape): the text goes and the caret stays.
 * - Press Copy: the link is copied and the button says Copied for a moment.
 * - Press Show on the password: the text shows and the button is pressed (aria-pressed).
 * - Type past 280 characters in Message: the counter turns red and Send switches off.
 *
 * Dependencies: React (useEffect, useId, useRef, useState, isValidElement), the library's Button ("./buttons-variants")
 * and inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at run time. Styles are the
 * fl-ig- classes in templates/library/css/input-group.css.
 */
import { isValidElement, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── c.input-group: text, icons and buttons joined inside one field's border. ──

/** Fixed text, an icon ({ icon: "search" }) or any node (usually an InputGroupButton). */
export type InputAddon = string | { icon: string } | ReactNode;

type Own = {
  label: string;
  start?: InputAddon;
  end?: InputAddon;
  /** A row under a text area: a counter, a Send button. */
  footer?: ReactNode;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  /** Rejected: the reason. Red border, aria-invalid, message tied to the field. */
  error?: string;
  /** Hide the label from sight (still read out). */
  hideLabel?: boolean;
  className?: string;
};
export type InputGroupProps = Own & Omit<InputHTMLAttributes<HTMLInputElement>, keyof Own | "size">;

const isIcon = (a: unknown): a is { icon: string } => !!a && typeof a === "object" && !isValidElement(a) && "icon" in (a as object);

export function InputGroup({ label, start, end, footer, multiline, rows = 4, hint, error, hideLabel, className, id, disabled, readOnly, ...rest }: InputGroupProps) {
  const uid = useId();
  const fieldId = id ?? `${uid}-field`;
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const ids = { start: `${uid}-start`, end: `${uid}-end`, hint: `${uid}-hint`, err: `${uid}-err` };
  const described =
    [error ? ids.err : "", typeof start === "string" ? ids.start : "", typeof end === "string" ? ids.end : "", hint ? ids.hint : "", rest["aria-describedby"] ?? ""].filter(Boolean).join(" ") ||
    undefined;

  const addon = (a: InputAddon, side: "start" | "end") => {
    if (a === undefined || a === null || a === false) return null;
    if (typeof a === "string")
      return (
        <span id={ids[side]} className={`fl-ig-text fl-ig-text--${side}`}>
          {a}
        </span>
      );
    if (isIcon(a))
      return (
        <span className={`fl-ig-icon fl-ig-icon--${side}`}>
          <Icon name={a.icon} />
        </span>
      );
    return <span className={`fl-ig-slot fl-ig-slot--${side}`}>{a as ReactNode}</span>;
  };

  const common = {
    id: fieldId,
    ref: field,
    className: "fl-ig-field",
    disabled,
    readOnly,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": described,
  };

  return (
    <div className={["fl-ig", className ?? ""].filter(Boolean).join(" ")} data-fl="c.input-group">
      <label htmlFor={fieldId} className={hideLabel ? "fl-sr" : "fl-ig-label"}>
        {label}
      </label>
      <div
        className={`fl-ig-group${multiline ? " fl-ig-group--multi" : ""}${error ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}${readOnly ? " is-readonly" : ""}`}
        // A click on the group's padding or fixed text puts the caret in the field, as a single field would.
        onMouseDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("button, a, input, textarea, select")) return;
          e.preventDefault();
          field.current?.focus();
        }}
      >
        {multiline ? (
          <>
            <textarea {...(rest as object)} {...common} rows={rows} />
            {footer ? <div className="fl-ig-footer">{footer}</div> : null}
          </>
        ) : (
          <>
            {addon(start, "start")}
            <input type="text" {...rest} {...common} />
            {addon(end, "end")}
          </>
        )}
      </div>
      {error ? (
        <p id={ids.err} className="fl-ig-error" role="alert">
          <Icon name="alert" />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={ids.hint} className="fl-ig-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A small quiet button that sits inside the group: Copy, Clear, Show. Icon-only when `iconOnly`; the label is still its name. */
export function InputGroupButton({ label, icon, iconOnly, pressed, disabled, onClick, variant = "tertiary" }: { label: string; icon?: string; iconOnly?: boolean; pressed?: boolean; disabled?: boolean; onClick: () => void; variant?: "tertiary" | "primary" }) {
  return (
    <Button variant={variant} size={32} icon={icon} iconOnly={iconOnly} pressed={pressed} disabled={disabled} className="fl-ig-btn" onClick={onClick} type="button">
      {label}
    </Button>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Input group",
  lede: "Fixed text, icons and buttons inside one field.",
  shop: { label: "Shop address", start: "https://", end: ".makers.market", value: "clay studio!", error: "Use letters, numbers and dashes only.", hint: "You can change this once a month." },
  price: { label: "Price", start: "$", end: "USD", value: "48.00", placeholder: "0.00" },
  search: { label: "Search orders", placeholder: "Order number or name", clear: "Clear" },
  invite: { label: "Invite link", value: "https://makers.market/join/ana-k-7Q2", copy: "Copy", copied: "Copied", said: "Link copied.", manual: "Selected. Press Ctrl+C (⌘C on a Mac) to copy." },
  password: { label: "Password", value: "kiln-season-42", show: "Show", hide: "Hide" },
  message: { label: "Message", placeholder: "Write to the buyer…", limit: 280, send: "Send", sent: "Message sent." },
  disabled: { label: "Store email", start: { icon: "mail" }, end: "@makers.market", value: "ana", hint: "Ask an owner to change it." },
};

function CopyDemo() {
  const d = SAMPLE.invite;
  const box = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<"" | "done" | "manual">("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(d.value);
    } catch {
      // No clipboard permission (an embedded preview): select the text so Ctrl+C still works.
      ok = false;
      const input = box.current?.querySelector("input");
      input?.focus();
      input?.select();
    }
    setCopied(ok ? "done" : "manual");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(""), 2400);
  };
  return (
    <div ref={box} className="fl-ig-stack">
      <InputGroup label={d.label} value={d.value} readOnly start={{ icon: "link" }} end={<InputGroupButton label={copied === "done" ? d.copied : d.copy} icon={copied === "done" ? "check" : "copy"} onClick={copy} />} onFocus={(e) => e.target.select()} />
      <p className="fl-ig-hint" role="status">
        {copied === "done" ? d.said : copied === "manual" ? d.manual : ""}
      </p>
    </div>
  );
}

export default function InputGroupSheet() {
  const d = SAMPLE;
  const uid = useId();
  const [shop, setShop] = useState(d.shop.value);
  const [price, setPrice] = useState(d.price.value);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const shopBad = !/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(shop);
  const over = msg.length > d.message.limit;

  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-ig-sheet">
          <div className="fl-ig-card">
            <h3>Text at both ends · invalid</h3>
            <InputGroup label={d.shop.label} start={d.shop.start} end={d.shop.end} value={shop} onChange={(e) => setShop(e.target.value)} error={shopBad ? d.shop.error : undefined} hint={d.shop.hint} autoComplete="off" spellCheck={false} />
          </div>
          <div className="fl-ig-card">
            <h3>Currency</h3>
            <InputGroup label={d.price.label} start={d.price.start} end={d.price.end} value={price} placeholder={d.price.placeholder} inputMode="decimal" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div className="fl-ig-card" ref={searchRef}>
            <h3>Icon and clear</h3>
            <InputGroup
              label={d.search.label}
              type="search"
              placeholder={d.search.placeholder}
              start={{ icon: "search" }}
              end={
                query ? (
                  <InputGroupButton
                    label={d.search.clear}
                    icon="close"
                    iconOnly
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.querySelector("input")?.focus();
                    }}
                  />
                ) : undefined
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
            />
          </div>
          <div className="fl-ig-card">
            <h3>Copy button</h3>
            <CopyDemo />
          </div>
          <div className="fl-ig-card">
            <h3>Toggle button</h3>
            <InputGroup label={d.password.label} type={show ? "text" : "password"} defaultValue={d.password.value} autoComplete="current-password" start={{ icon: "lock" }} end={<InputGroupButton label={show ? d.password.hide : d.password.show} icon={show ? "eye-off" : "eye"} pressed={show} onClick={() => setShow((s) => !s)} />} />
          </div>
          <div className="fl-ig-card">
            <h3>Text area with footer</h3>
            <InputGroup
              label={d.message.label}
              multiline
              rows={3}
              placeholder={d.message.placeholder}
              value={msg}
              error={over ? `Keep it to ${d.message.limit} characters.` : undefined}
              onChange={(e) => {
                setMsg(e.target.value);
                setSent(false);
              }}
              footer={
                <>
                  <span className={`fl-ig-count${over ? " is-over" : ""}`} aria-live="polite">
                    {msg.length}/{d.message.limit}
                  </span>
                  <InputGroupButton
                    label={d.message.send}
                    icon="send"
                    variant="primary"
                    disabled={!msg.trim() || over}
                    onClick={() => {
                      setMsg("");
                      setSent(true);
                    }}
                  />
                </>
              }
            />
            <p className="fl-ig-status" role="status">
              {sent ? d.message.sent : ""}
            </p>
          </div>
          <div className="fl-ig-card">
            <h3>Disabled</h3>
            <InputGroup label={d.disabled.label} start={d.disabled.start} end={d.disabled.end} defaultValue={d.disabled.value} hint={d.disabled.hint} disabled />
          </div>
        </div>
      </div>
    </section>
  );
}
