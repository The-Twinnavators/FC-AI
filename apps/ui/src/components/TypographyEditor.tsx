/**
 * Styles → Design → Typography (after CSSVibes' typography canvas): a font browser for headings, body text and code
 * (the fonts FlowCode bundles, with pairings), and the type table: each level's size, weight and line height, previewed
 * in the chosen fonts. Saved to the app's type tokens; the live preview follows every change before it's saved.
 */
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { post, useResource } from "../api";
import { stylesChanged } from "./ComponentSheet";
import { BUNDLED_FONTS } from "@flowcode/contracts";

interface Token {
  name: string;
  value: string;
  theme: "default" | "light" | "dark";
  resolved?: string;
}

type Category = "Sans-Serif" | "Serif" | "Monospace" | "Display" | "Handwriting";
interface FontOption {
  name: string;
  category: Category;
  provider: "Bundled" | "System";
  pairsWith?: string[];
}

/**
 * The fonts that really work: the ones FlowCode bundles (registered with this page, and copied into the app's
 * public/fonts when you save, so the app draws them with no internet) plus fonts every computer has. Google Fonts
 * aren't offered: FlowCode runs locally and its security rules block loading them, so they only ever showed a
 * fallback.
 */
const KIND: Record<string, Category> = { sans: "Sans-Serif", serif: "Serif", display: "Display", mono: "Monospace" };
const FONTS: FontOption[] = [
  ...BUNDLED_FONTS.map((f) => ({ name: f.family, category: KIND[f.kind] ?? "Sans-Serif", provider: "Bundled" as const })),
  { name: "Arial", category: "Sans-Serif", provider: "System" },
  { name: "Helvetica", category: "Sans-Serif", provider: "System" },
  { name: "Georgia", category: "Serif", provider: "System" },
  { name: "Times New Roman", category: "Serif", provider: "System" },
  { name: "Courier New", category: "Monospace", provider: "System" },
];
/** Pairings among the fonts on offer: a contrasting face for the other role. */
const PAIRS: Record<string, string[]> = {
  Inter: ["Source Serif 4", "Fraunces", "Playfair Display"],
  "Source Sans 3": ["Source Serif 4", "Literata"],
  Montserrat: ["Literata", "Source Serif 4"],
  Quicksand: ["Fraunces", "Literata"],
  "DM Sans": ["Fraunces", "Playfair Display"],
  "Work Sans": ["Literata", "Source Serif 4"],
  "Source Serif 4": ["Source Sans 3", "Inter"],
  Literata: ["Work Sans", "DM Sans"],
  Fraunces: ["Inter", "DM Sans"],
  "Playfair Display": ["Inter", "Source Sans 3", "Work Sans"],
  Oswald: ["Inter", "Source Sans 3"],
  "JetBrains Mono": ["Inter", "DM Sans"],
};
const CATEGORIES: Array<"All" | Category> = ["All", "Sans-Serif", "Serif", "Display", "Monospace"];
const FALLBACK: Record<Category, string> = {
  "Sans-Serif": "system-ui, sans-serif",
  Serif: "Georgia, serif",
  Monospace: "ui-monospace, Consolas, monospace",
  Display: "system-ui, sans-serif",
  Handwriting: "cursive",
};
const stackOf = (f: FontOption) => (f.provider === "System" ? `${/\s/.test(f.name) ? `"${f.name}"` : f.name}, ${FALLBACK[f.category]}` : `"${f.name}", ${FALLBACK[f.category]}`);
const firstFamily = (stack = "") => stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
const fontOf = (stack?: string) => FONTS.find((f) => f.name === firstFamily(stack));

/** Bundled fonts are registered with the page at start-up and load when drawn; nothing is fetched from the internet. */
function loadFonts(_names: string[]) {
  /* kept so the call sites stay simple */
}

/** The levels the starter kit draws, and the tokens each one reads. Small and caption share the kit's scale sizes. */
interface Level {
  id: string;
  label: string;
  role: string;
  size: string;
  weight?: string;
  leading?: string;
  /** For apps made before per-level tokens: the scale token that sets this level's size. */
  legacySize?: string;
  heading: boolean;
}
const LEVELS: Level[] = [
  { id: "display", label: "Display", role: "Hero title", size: "--type-display-size", weight: "--type-display-weight", leading: "--type-display-leading", legacySize: "--text-3xl", heading: true },
  { id: "h1", label: "H1", role: "Page title", size: "--type-h1-size", weight: "--type-h1-weight", leading: "--type-h1-leading", legacySize: "--text-2xl", heading: true },
  { id: "h2", label: "H2", role: "Section title", size: "--type-h2-size", weight: "--type-h2-weight", leading: "--type-h2-leading", legacySize: "--text-lg", heading: true },
  { id: "h3", label: "H3", role: "Card title", size: "--type-h3-size", weight: "--type-h3-weight", leading: "--type-h3-leading", heading: true },
  { id: "body", label: "Body", role: "Paragraphs", size: "--type-body-size", weight: "--type-body-weight", leading: "--type-body-leading", legacySize: "--text-md", heading: false },
  { id: "small", label: "Small", role: "Labels, hints", size: "--text-sm", heading: false },
  { id: "caption", label: "Caption", role: "Meta, captions", size: "--text-xs", heading: false },
];
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const LEADINGS = [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.5, 1.6, 1.7, 1.8, 2];
/** "Fill from a scale": heading sizes from the body size and a ratio (the old Type scale chips). */
const SCALES: Array<{ ratio: number; label: string }> = [
  { ratio: 1.125, label: "Calm" },
  { ratio: 1.2, label: "Balanced" },
  { ratio: 1.25, label: "Clear" },
  { ratio: 1.333, label: "Bold" },
  { ratio: 1.5, label: "Dramatic" },
];
const toPx = (v?: string) => {
  const m = v ? /^(-?\d*\.?\d+)(px|rem|em)$/.exec(v.trim()) : null;
  return m ? Number(m[1]) * (m[2] === "px" ? 1 : 16) : undefined;
};
const rem = (px: number) => `${Math.round((px / 16) * 10000) / 10000}rem`;

export interface TypographyEditorProps {
  projectId: string;
  onDraft: (values: Record<string, string>) => void;
  /** Renders the modal frame (title, preview, footer) around the editor's controls. */
  frame: (controls: React.ReactNode, footer: React.ReactNode) => React.ReactElement;
  onClose: () => void;
}

export function TypographyEditor({ projectId, onDraft, frame, onClose }: TypographyEditorProps) {
  const { data } = useResource<{ tokens: Token[] }>(`/projects/${projectId}/styles`, [projectId]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sample, setSample] = useState("The quick brown fox jumps over the lazy dog");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  const base = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.tokens ?? []) if (t.theme === "default" && !m.has(t.name)) m.set(t.name, t.resolved ?? t.value);
    return m;
  }, [data]);
  const has = (n: string) => base.has(n);
  const value = (n: string) => edits[n] ?? base.get(n);
  useEffect(() => onDraft(edits), [edits, onDraft]);
  useEffect(() => loadFonts([firstFamily(value("--font-sans")), firstFamily(value("--font-display")), firstFamily(value("--font-mono"))]));
  if (!data) return frame(<p className="muted">Reading the app&apos;s type…</p>, null);

  const perLevel = has("--type-h1-size");
  const set = (patch: Record<string, string>) => setEdits((e) => ({ ...e, ...patch }));
  const levelSizeToken = (l: Level) => (perLevel ? l.size : l.legacySize ?? (l.id === "small" || l.id === "caption" ? l.size : undefined));
  const fillScale = (ratio: number) => {
    const body = toPx(value(levelSizeToken(LEVELS[4])!)) ?? 16;
    const step = (n: number) => rem(Math.round(body * ratio ** n));
    const patch: Record<string, string> = {};
    const target: Record<string, number> = { display: 5, h1: 4, h2: 2, h3: 1 };
    for (const l of LEVELS) {
      const tok = levelSizeToken(l);
      if (tok && target[l.id] !== undefined) patch[tok] = step(target[l.id]);
    }
    set(patch);
  };
  const save = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      await post(`/projects/${projectId}/design`, { theme: "default", values: edits });
      stylesChanged();
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const controls = (
    <div className="typo">
      <fieldset className="studio__sec">
        <legend data-cp="typo-fonts">Fonts</legend>
        <FontPicker label="Headings" token="--font-display" value={value("--font-display")} pairWith={firstFamily(value("--font-sans"))} onPick={(f) => set({ "--font-display": stackOf(f) })} />
        <FontPicker label="Body" token="--font-sans" value={value("--font-sans")} pairWith={firstFamily(value("--font-display"))} onPick={(f) => set({ "--font-sans": stackOf(f) })} />
        {has("--font-mono") ? <FontPicker label="Code" token="--font-mono" value={value("--font-mono")} only="Monospace" onPick={(f) => set({ "--font-mono": stackOf(f) })} /> : null}
      </fieldset>

      <fieldset className="studio__sec">
        <legend>Type scale</legend>
        <label className="typo__sample">
          <span>Sample text</span>
          <input className="input" value={sample} onChange={(e) => setSample(e.target.value)} />
        </label>
        <div className="studio__chips" role="group" aria-label="Fill the heading sizes from a scale">
          <span className="typo__chips-label muted">Fill headings from a scale:</span>
          {SCALES.map((s) => (
            <button key={s.ratio} type="button" className="studio__chip" onClick={() => fillScale(s.ratio)} title={`Each heading ${s.ratio}× the one below`}>
              {s.label}
            </button>
          ))}
        </div>
        {!perLevel ? <p className="dmodal__note muted">This app was made before per-level type settings, so weights and line heights follow the shared scale here; sizes still change.</p> : null}
        <table className="typo-table">
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">Size</th>
              <th scope="col">Weight</th>
              <th scope="col">Line height</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((l) => {
              const sizeTok = levelSizeToken(l);
              const px = sizeTok ? toPx(value(sizeTok)) : undefined;
              const weight = perLevel && l.weight ? Number(value(l.weight)) || undefined : undefined;
              const leading = perLevel && l.leading ? Number(value(l.leading)) || undefined : undefined;
              const font = l.heading ? value("--font-display") : value("--font-sans");
              return (
                <tr key={l.id}>
                  <th scope="row">
                    <span className="typo-table__label">
                      {l.label} <span className="muted">{l.role}</span>
                    </span>
                    <span className="typo-table__sample" style={{ fontFamily: font, fontSize: Math.min(px ?? 16, 40), fontWeight: weight, lineHeight: leading }}>
                      {sample}
                    </span>
                  </th>
                  <td>
                    {sizeTok && px !== undefined ? (
                      <span className="typo-table__px">
                        <input className="input mono" type="number" min={8} max={120} value={Math.round(px)} aria-label={`${l.label} size in pixels`} onChange={(e) => Number(e.target.value) >= 8 && set({ [sizeTok]: rem(Number(e.target.value)) })} />
                        <span className="muted">px</span>
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {weight !== undefined && l.weight ? (
                      <select className="select" value={weight} aria-label={`${l.label} weight`} onChange={(e) => set({ [l.weight!]: e.target.value })}>
                        {WEIGHTS.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="muted" title="Set by each component">—</span>
                    )}
                  </td>
                  <td>
                    {leading !== undefined && l.leading ? (
                      <select className="select" value={LEADINGS.reduce((b, x) => (Math.abs(x - leading) < Math.abs(b - leading) ? x : b))} aria-label={`${l.label} line height`} onChange={(e) => set({ [l.leading!]: e.target.value })}>
                        {LEADINGS.map((x) => (
                          <option key={x} value={x}>
                            {x.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="muted" title="Set by each component">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>
    </div>
  );
  const footer = (
    <>
      {msg ? <span className="dmodal__msg">{msg}</span> : <span className="muted dmodal__msg">Saving updates the app&apos;s type tokens and loads the fonts. You can undo it.</span>}
      <button type="button" className="btn" onClick={onClose}>
        Cancel
      </button>
      <button type="button" className="btn btn--primary" data-cp="typo-save" onClick={() => void save()} disabled={busy || !Object.keys(edits).length}>
        {busy ? "Saving…" : "Save typography"}
      </button>
    </>
  );
  return frame(controls, footer);
}

/** CSSVibes' font browser for one role: the current font, then search, categories, pairings and the list. */
function FontPicker({ label, token, value, pairWith, only, onPick }: { label: string; token: string; value?: string; pairWith?: string; only?: Category; onPick: (f: FontOption) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"All" | Category>(only ?? "All");
  const current = firstFamily(value);
  const list = FONTS.filter((f) => (cat === "All" || f.category === cat) && f.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pairs = (pairWith && PAIRS[pairWith]?.map((n) => FONTS.find((f) => f.name === n)).filter((f): f is FontOption => !!f)) || [];
  useEffect(() => {
    if (open) loadFonts([...list.map((f) => f.name), ...pairs.map((f) => f.name)]);
  }, [open, list, pairs]);
  return (
    <div className="fpick">
      <div className="fpick__row">
        <span className="fpick__label">
          {label}
          <span className="mono muted">{token}</span>
        </span>
        <button type="button" className="fpick__current" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ fontFamily: value }}>
          {current || "Choose a font"}
          <span className="muted fpick__change">{open ? "Close" : "Change"}</span>
        </button>
      </div>
      {open ? (
        <div className="fpick__browser">
          {pairs.length ? (
            <div className="fpick__pairs">
              <span className="muted">Pairs well with {pairWith}:</span>
              {pairs.map((f) => (
                <button key={f.name} type="button" className={`studio__chip${f.name === current ? " is-on" : ""}`} style={{ fontFamily: stackOf(f) }} onClick={() => onPick(f)}>
                  {f.name}
                </button>
              ))}
            </div>
          ) : null}
          <label className="fpick__search">
            <Search size={14} aria-hidden="true" />
            <input className="input" placeholder="Search fonts" value={q} aria-label={`Search ${label.toLowerCase()} fonts`} onChange={(e) => setQ(e.target.value)} />
          </label>
          {only ? null : (
            <div className="studio__chips" role="group" aria-label="Font category">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={`studio__chip${cat === c ? " is-on" : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <ul className="fpick__list" role="listbox" aria-label={`${label} fonts`}>
            {list.map((f) => (
              <li key={f.name}>
                <button type="button" role="option" aria-selected={f.name === current} className={`fpick__opt${f.name === current ? " is-on" : ""}`} onClick={() => onPick(f)}>
                  <span style={{ fontFamily: stackOf(f) }}>{f.name}</span>
                  <span className="muted">
                    {f.category}
                    {f.provider === "System" ? " · system" : ""}
                  </span>
                </button>
              </li>
            ))}
            {!list.length ? <li className="muted fpick__none">No fonts match.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
