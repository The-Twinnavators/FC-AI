import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import type { DarkTone, LightTone, ThemeName } from "../appearance";

export type ThemeChoice = { theme: "dark"; tone: DarkTone } | { theme: "light"; tone: LightTone } | { theme: "system" };

const CHOICES: Array<{ key: string; label: string; choice: ThemeChoice }> = [
  { key: "dark-blue", label: "Dark · Blue", choice: { theme: "dark", tone: "blue" } },
  { key: "dark-grey", label: "Dark · Grey", choice: { theme: "dark", tone: "grey" } },
  { key: "light-white", label: "Light · White", choice: { theme: "light", tone: "white" } },
  { key: "light-grey", label: "Light · Grey", choice: { theme: "light", tone: "grey" } },
  { key: "system", label: "System", choice: { theme: "system" } },
];

/**
 * The top bar's theme button: a menu of the four palettes (dark blue or grey, light white or grey) and System, which
 * follows the computer's light or dark setting with the tones chosen here. Arrow keys move, Enter or Space picks,
 * Escape closes and returns focus to the button.
 */
export function ThemeMenu({ theme, current, perPage, onPick }: { theme: ThemeName; current: string; perPage: boolean; onPick: (c: ThemeChoice) => void }) {
  const [open, setOpen] = useState(false);
  // Where the menu opens: under the button, right-aligned. It renders on the page itself, not inside the top bar,
  // because the top bar is blurred and a blur inside it can't see the page behind.
  const [at, setAt] = useState<{ top: number; right: number }>();
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    (items.find((i) => i.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => (e.preventDefault(), items[(i + items.length) % items.length]?.focus());
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") (e.preventDefault(), setOpen(false), btn.current?.focus());
    else if (e.key === "Tab") setOpen(false);
  };

  const label = CHOICES.find((c) => c.key === current)?.label ?? "System";
  return (
    <div className="theme-menu">
      <button
        ref={btn}
        className="theme-toggle"
        onClick={() => {
          const r = btn.current?.getBoundingClientRect();
          if (r) setAt({ top: r.bottom + 6, right: window.innerWidth - r.right });
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${label}${perPage ? " (this page)" : ""}`}
        title={`Theme: ${label}${perPage ? " for this page" : ""}`}
      >
        {current === "system" ? <Monitor size={16} aria-hidden="true" /> : theme === "light" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      </button>
      {open && at ? createPortal(
        <div ref={menu} className="ctx-menu theme-menu__list" role="menu" aria-label="Theme" onKeyDown={keys} style={{ top: at.top, right: at.right }}>
          {CHOICES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="menuitemradio"
              aria-checked={c.key === current}
              className="ctx-menu__item theme-menu__item"
              onClick={() => (onPick(c.choice), setOpen(false), btn.current?.focus())}
            >
              <span className={`theme-menu__swatch theme-menu__swatch--${c.key}`} aria-hidden="true" />
              {c.label}
              {c.key === current ? <span className="theme-menu__check" aria-hidden="true">✓</span> : null}
            </button>
          ))}
          {perPage ? <p className="theme-menu__note">Pages have their own themes (Settings → Appearance); a choice here sets this page.</p> : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
