/**
 * The app frame's design, composed by FlowCode: a stylesheet of the frame's own rules (AppFrame's rail, brand, navigation
 * items, top bar and page area) in the app's tokens only, imported by App.tsx. The model's frame part then refines it.
 * Frameproof main build: the frame part's model spent three turns of four to five minutes each writing prose and
 * never called a tool, twice.
 */
export const FRAME_SHEET = "src/styles/frame.css";

/** Whether App.tsx renders the library's AppFrame (the frame this stylesheet styles). */
export const usesAppFrame = (app: string) => /from\s+["']\.\/sections\/AppFrame["']/.test(app) && /<AppFrame\b/.test(app);

/** App.tsx importing the frame stylesheet (after its last import); undefined when it does already. */
export function withFrameImport(app: string): string | undefined {
  if (/["']\.\/styles\/frame\.css["']/.test(app)) return undefined;
  const imports = [...app.matchAll(/^import[^;]*;[ \t]*$/gm)];
  const last = imports.at(-1);
  if (!last || last.index === undefined) return `import "./styles/frame.css";\n${app}`;
  const at = last.index + last[0].length;
  return `${app.slice(0, at)}\nimport "./styles/frame.css";${app.slice(at)}`;
}

/**
 * A frame stylesheet FlowCode composed, with the rules its composer has since gained appended (by selector; the step's
 * refinements stay as they are). Undefined when the file isn't FlowCode's or has every rule. Frameproof: the "PROTOTYPE"
 * badge failed the final contrast check after the frame was composed.
 */
export function refreshedFrameCss(current: string, product: string): string | undefined {
  if (!current.includes("composed by FlowCode (frameComposer.ts)")) return undefined;
  const has = new Set([...current.matchAll(/(^|\n)([^{}\n/@][^{}]*?)\s*\{/g)].map((m) => m[2]!.trim()));
  const missing = frameCss(product)
    .split("\n")
    .filter((l) => /^\.[^{]+\{.*\}$/.test(l.trim()) && !has.has(l.trim().replace(/\s*\{.*$/, "").trim()));
  return missing.length ? `${current.trimEnd()}\n${missing.join("\n")}\n` : undefined;
}

export function frameCss(product: string): string {
  return `/**
 * ${product.replace(/\*\//g, "* /")}'s frame, composed by FlowCode (frameComposer.ts): the rail, brand, navigation, top bar and page
 * area of AppFrame, in the app's tokens only. Quiet chrome, so the content leads.
 */
.fl-af-rail { background: var(--color-surface); border-right: var(--border-width, 1px) solid var(--color-border); }
.fl-af-brand { min-height: 3.5rem; border-bottom-color: var(--color-border); }
.fl-af-product { font-family: var(--font-display); font-weight: var(--weight-semibold); letter-spacing: 0.01em; }
.fl-af-groups { gap: var(--space-3); padding: var(--space-3) var(--space-2); }
.fl-af-group-head { color: var(--color-text-muted); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.fl-af-item { border-radius: var(--radius-sm); color: var(--color-text-muted); font-size: var(--text-sm); }
.fl-af-item:hover { background: var(--color-surface-sunken); color: var(--color-text); }
.fl-af-item--current, .fl-af-item--current:hover { background: var(--color-surface-sunken); color: var(--color-text); font-weight: var(--weight-semibold); }
.fl-af-item--current .fl-af-label { text-decoration: underline; text-decoration-color: var(--color-accent); text-decoration-thickness: 2px; text-underline-offset: 0.35em; }
.fl-af-count { font-variant-numeric: tabular-nums; }
.fl-af-top { background: var(--color-bg); border-bottom: var(--border-width, 1px) solid var(--color-border); }
.fl-af-crumbs ol { font-size: var(--text-sm); }
.fl-af-main { background: var(--color-bg); }
.fl-af-env { color: var(--color-text); }
@media (prefers-reduced-motion: reduce) { .fl-af-item, .fl-af-iconbtn { transition: none; } }
`;
}
