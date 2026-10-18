/**
 * Motion parts: the building blocks whose motion comes from FlowCode's motion foundation (styles/motion.css and
 * lib/motion.ts), sized by the Look's motion level, quick fades under reduced motion, nothing with animation off.
 *  - <Disclosure title>…</Disclosure>: a section that opens in place (grid rows), its content inert while closed.
 *  - <NativeDialog open title onClose actions?>…</NativeDialog> and <Drawer …>: the browser's own modal <dialog>
 *    (focus kept inside, Escape and the backdrop close it, focus back on what opened it), entering and leaving with
 *    motion.css; closing never waits for the animation.
 *  - <TabStrip label tabs current onChange>{panel}</TabStrip>: tabs with one indicator that moves, arrow keys,
 *    Home and End (the ARIA tabs pattern); the panel fades in when it changes, not on first render.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useCollapse, useTabIndicator } from "../../lib/motion";

export function Disclosure({ title, children, defaultOpen = false, open: openProp, onOpenChange }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const id = useId();
  const { wrapper, inner } = useCollapse(open);
  const toggle = () => {
    setOwn(!open);
    onOpenChange?.(!open);
  };
  return (
    <div className={`ui-disclosure${open ? " is-open" : ""}`}>
      <button type="button" className="ui-disclosure__toggle" aria-expanded={open} aria-controls={id} onClick={toggle}>
        <span>{title}</span>
        <span className="ui-disclosure__chev" aria-hidden="true">
          ▾
        </span>
      </button>
      <div id={id} {...wrapper}>
        <div>
          <div className="ui-disclosure__body" {...inner}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

type DialogProps = { open: boolean; title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; description?: ReactNode };

export function NativeDialog({ placement = "center", ...p }: DialogProps & { placement?: "center" | "end" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const onClose = useRef(p.onClose);
  onClose.current = p.onClose;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!p.open && d.open) d.close();
  }, [p.open]);
  // Back to what opened it, also when the dialog goes away mid-animation (a page change).
  useLayoutEffect(() => {
    const d = ref.current;
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  const restore = () => {
    const o = opener.current;
    opener.current = null;
    if (o?.isConnected && (document.activeElement === document.body || ref.current?.contains(document.activeElement))) o.focus({ preventScroll: true });
  };
  const backdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose.current();
  };
  return (
    <dialog
      ref={ref}
      className={`ui-native-dialog ui-native-dialog--${placement}${placement === "end" ? " fc-drawer" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose.current();
      }}
      onClose={() => {
        restore();
        if (p.open) onClose.current();
      }}
      onClick={backdrop}
    >
      <header className="ui-native-dialog__head">
        <h2 id={titleId}>{p.title}</h2>
        <button type="button" className="ui-native-dialog__close" aria-label="Close" onClick={() => onClose.current()}>
          ×
        </button>
      </header>
      {p.description ? <p className="ui-native-dialog__desc">{p.description}</p> : null}
      <div className="ui-native-dialog__body">{p.children}</div>
      {p.actions ? <footer className="ui-native-dialog__foot">{p.actions}</footer> : null}
    </dialog>
  );
}

export function Drawer(p: DialogProps) {
  return <NativeDialog {...p} placement="end" />;
}

export function TabStrip({ label, tabs, current, onChange, children }: { label: string; tabs: Array<{ id: string; label: string }>; current: string; onChange: (id: string) => void; children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const base = useId();
  const focusNext = useRef(false);
  const changed = useRef(false);
  useTabIndicator(list, current);
  useLayoutEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    document.getElementById(`${base}-tab-${current}`)?.focus();
  }, [current, base]);
  const key = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === current);
    const next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    focusNext.current = true;
    changed.current = true;
    onChange(tabs[next]!.id);
  };
  return (
    <div className="ui-tabstrip">
      <div ref={list} className="ui-tabstrip__list" role="tablist" aria-label={label} onKeyDown={key}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === current}
            aria-controls={`${base}-panel`}
            tabIndex={t.id === current ? 0 : -1}
            onClick={() => {
              changed.current = true;
              onChange(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
        <span className="fc-tab-indicator" aria-hidden="true" />
      </div>
      <div key={current} id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${current}`} tabIndex={0} className={`ui-tabstrip__panel${changed.current ? " is-changed" : ""}`}>
        {children}
      </div>
    </div>
  );
}
