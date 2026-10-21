/** @flowcode-library language-switcher · Language switcher (Navigation)
 * Catalog ID: c.language-switcher (component)
 * Function: The language switcher (c.language-switcher): a globe button with the current language that opens a menu of languages written in their own words, with the English name beside each and a tick on the current one; arrow keys, Home, End and type-ahead move through it, the choice can be remembered on the device, and right-to-left languages say so; the reference sheet shows a site header whose welcome card changes language.
 * Use it as: import { LanguageSwitcher } from "./language-switcher"; <LanguageSwitcher languages={[{ code: "de", native: "Deutsch", name: "German", dir?: "rtl" }]} value?/defaultValue?="en" onChange?={(code) => ...} compact? align?="start"|"end" rememberKey?="site-lang" labels?={{ button, menu, changed }} />
 * Built from: c.menu
 * Look: A quiet bordered button with a globe, the current language in its own words (or just its code when compact) and a chevron 8px from the right edge; it drops a menu under it of rows with the language's own name, the English name muted under it, its short code at the right and a tick on the current one.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-text --color-text-muted --space-1 --space-2 --space-3 --radius-md --text-xs --text-sm --duration-fast --duration-base --ease-out --ease-spring --enter-distance --focus-ring
 * Use cases: multilingual website header; app settings language; international store; help center language; travel site; government service; documentation site; footer language picker
 * Jobs to be done: read the site in my own language; find my language even if I can't read the current one; switch back to English; have the site remember my language
 * Keywords: language, locale, translation, i18n, international, globe, dropdown, menu, header, rtl
 */
/**
 * Language switcher. Each language is written in its own words (Deutsch, 日本語), marked with its lang so a screen reader
 * says it correctly, with the English name under it for anyone who knows it only that way. The menu is a set of radio
 * items: Enter, Space or the arrow keys open it on the current language; arrows, Home, End and typing the first
 * letters move; Enter or Space choose; Escape closes and puts focus back on the button. A right-to-left language
 * carries dir so the app can flip its layout. With rememberKey the choice is kept on this device. Make it the app's
 * own: list the languages the app is translated into, and load the chosen language's strings in onChange.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin): the header's language dropdown.
 */
/**
 * How to try it
 * - Press the globe button and choose Deutsch: the welcome card changes language and the button shows Deutsch.
 * - Tab to the button and press the down arrow; type "p" to jump to Português, then Enter.
 * - Choose العربية: the card reads right to left. Reload the page: the choice is remembered.
 *
 * Dependencies: React (useEffect, useId, useRef, useState) and the library's inline icon set ("./icons"). Nothing else:
 * no i18n package and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css, and the sample data is in the file.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// ── c.language-switcher: a globe button and a menu of languages in their own words. ──

export type Language = {
  /** BCP 47 code, used as the lang attribute: "pt-BR". */
  code: string;
  /** The name in the language itself: "Português". */
  native: string;
  /** The English name: "Portuguese (Brazil)". */
  name: string;
  dir?: "ltr" | "rtl";
};

export type LanguageSwitcherProps = {
  languages: Language[];
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  /** Just the globe and the short code, for a tight header. */
  compact?: boolean;
  /** Which edge of the button the menu lines up with. */
  align?: "start" | "end";
  /** Keep the choice on this device under this storage key. */
  rememberKey?: string;
  labels?: { button?: string; menu?: string; changed?: string };
};

const short = (code: string) => code.split("-")[0].toUpperCase();

const readSaved = (key?: string) => {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export function LanguageSwitcher({ languages, value, defaultValue, onChange, compact, align = "end", rememberKey, labels = {} }: LanguageSwitcherProps) {
  const l = { button: "Language", menu: "Choose a language", changed: "Language changed to", ...labels };
  const id = useId();
  const [own, setOwn] = useState(() => {
    const saved = readSaved(rememberKey);
    return languages.some((x) => x.code === saved) ? saved! : (defaultValue ?? languages[0]?.code ?? "");
  });
  const cur = value ?? own;
  const current = languages.find((x) => x.code === cur) ?? languages[0];
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const start = useRef<"current" | "last">("current");
  const typed = useRef({ text: "", at: 0 });

  // A remembered choice is handed to the app once, so it loads that language's strings.
  useEffect(() => {
    if (value === undefined && own !== (defaultValue ?? languages[0]?.code)) onChange?.(own);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = start.current === "last" ? items.length - 1 : Math.max(0, items.findIndex((el) => el.getAttribute("aria-checked") === "true"));
    items[at]?.focus();
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open]);

  const choose = (lang: Language) => {
    setOpen(false);
    btn.current?.focus();
    if (lang.code === cur) return;
    if (value === undefined) setOwn(lang.code);
    if (rememberKey) {
      try {
        localStorage.setItem(rememberKey, lang.code);
      } catch {
        /* storage blocked: the choice lasts for this visit */
      }
    }
    setSaid(`${l.changed} ${lang.native}.`);
    onChange?.(lang.code);
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      start.current = e.key === "ArrowUp" ? "last" : "current";
      setOpen(true);
    }
  };
  const onMenuKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => items[(i + items.length) % items.length]?.focus();
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") {
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
      return;
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      // Type-ahead on the language's own name or its English one.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const q = typed.current.text;
      const order = [...languages.slice(at + 1), ...languages.slice(0, at + 1)];
      const hit = order.find((x) => x.native.toLowerCase().startsWith(q) || x.name.toLowerCase().startsWith(q));
      if (hit) items[languages.indexOf(hit)]?.focus();
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={root} className={`fl-lang fl-lang--${align}${open ? " is-open" : ""}`} data-fl="c.language-switcher">
      <button
        ref={btn}
        type="button"
        className={`fl-lang-btn${compact ? " is-compact" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={`${l.button}: ${current?.native}`}
        onClick={() => {
          start.current = "current";
          setOpen((o) => !o);
        }}
        onKeyDown={onButtonKey}
      >
        <Icon name="globe" />
        <span lang={current?.code}>{compact ? short(current?.code ?? "") : current?.native}</span>
        <svg className="fl-lang-chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open ? (
        <ul ref={menu} id={`${id}-menu`} className="fl-lang-menu" role="menu" aria-label={l.menu} onKeyDown={onMenuKey}>
          {languages.map((x) => {
            const on = x.code === cur;
            return (
              <li
                key={x.code}
                role="menuitemradio"
                aria-checked={on}
                tabIndex={-1}
                className="fl-lang-item"
                onClick={() => choose(x)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(x);
                  }
                }}
              >
                <span className="fl-lang-tick" aria-hidden="true">
                  {on ? <Icon name="check" /> : null}
                </span>
                <span className="fl-lang-names">
                  <span lang={x.code} dir={x.dir}>
                    {x.native}
                  </span>
                  {x.name !== x.native ? <small>{x.name}</small> : null}
                </span>
                <span className="fl-lang-code" aria-hidden="true">
                  {short(x.code)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  brand: "Northwind Travel",
  nav: ["Trips", "Deals", "Help"],
  rememberKey: "fl-lang-demo",
  languages: [
    { code: "en", native: "English", name: "English" },
    { code: "es", native: "Español", name: "Spanish" },
    { code: "fr", native: "Français", name: "French" },
    { code: "de", native: "Deutsch", name: "German" },
    { code: "pt-BR", native: "Português", name: "Portuguese (Brazil)" },
    { code: "ja", native: "日本語", name: "Japanese" },
    { code: "hi", native: "हिन्दी", name: "Hindi" },
    { code: "ar", native: "العربية", name: "Arabic", dir: "rtl" },
  ] as Language[],
  copy: {
    en: { title: "Welcome back", text: "Your trip to Lisbon starts in 12 days.", cta: "View trip" },
    es: { title: "Hola de nuevo", text: "Tu viaje a Lisboa empieza en 12 días.", cta: "Ver viaje" },
    fr: { title: "Bon retour", text: "Votre voyage à Lisbonne commence dans 12 jours.", cta: "Voir le voyage" },
    de: { title: "Willkommen zurück", text: "Deine Reise nach Lissabon beginnt in 12 Tagen.", cta: "Reise ansehen" },
    "pt-BR": { title: "Que bom te ver", text: "Sua viagem para Lisboa começa em 12 dias.", cta: "Ver viagem" },
    ja: { title: "おかえりなさい", text: "リスボンへの旅行まであと12日です。", cta: "旅程を見る" },
    hi: { title: "फिर से स्वागत है", text: "आपकी लिस्बन यात्रा 12 दिनों में शुरू होगी।", cta: "यात्रा देखें" },
    ar: { title: "مرحبًا بعودتك", text: "تبدأ رحلتك إلى لشبونة بعد 12 يومًا.", cta: "عرض الرحلة" },
  } as Record<string, { title: string; text: string; cta: string }>,
};

export default function LanguageSwitcherSheet() {
  const d = SAMPLE;
  const [lang, setLang] = useState(() => {
    const saved = readSaved(d.rememberKey);
    return d.languages.some((x) => x.code === saved) ? saved! : "en";
  });
  const current = d.languages.find((x) => x.code === lang) ?? d.languages[0];
  const copy = d.copy[lang] ?? d.copy.en;
  return (
    <section className="fl-section fl-section--canvas" aria-label={d.brand}>
      <div className="fl-wrap">
        <div className="fl-lang-demo">
          <header className="fl-lang-demo-bar">
            <strong>{d.brand}</strong>
            <nav aria-label="Main">
              {d.nav.map((n) => (
                <a key={n} href={`#${n.toLowerCase()}`}>
                  {n}
                </a>
              ))}
            </nav>
            <LanguageSwitcher languages={d.languages} value={lang} onChange={setLang} rememberKey={d.rememberKey} />
            <LanguageSwitcher languages={d.languages} value={lang} onChange={setLang} rememberKey={d.rememberKey} compact labels={{ button: "Language (compact)" }} />
          </header>
          <article key={lang} className="fl-lang-demo-card" lang={current.code} dir={current.dir ?? "ltr"}>
            <h2>{copy.title}</h2>
            <p>{copy.text}</p>
            <a className="fl-btn fl-btn--primary fl-ctl-btn--40" href="#trip">
              {copy.cta}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
