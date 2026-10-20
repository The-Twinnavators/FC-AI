/**
 * The Component library's preview page (section-preview.html?id=…&style=…): one library section running in its own
 * window, exactly as it would in a built app (its dialogs, focus, Escape and scroll lock act on this page, not on
 * FlowCode's). It gets the starter's tokens, FlowCode's bundled fonts, the chosen visual style and the library styles,
 * and tells the Components page how tall it is.
 */
import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import { previewBaseCss } from "./libraryStyle";
import baseCss from "../../../templates/library/library.css?raw";

const modules = import.meta.glob<{ default: ComponentType }>("../../../templates/library/sections/*.tsx");
const sources = import.meta.glob<string>("../../../templates/library/sections/*.tsx", { query: "?raw", import: "default" });
const categoryCss = import.meta.glob<string>("../../../templates/library/css/*.css", { query: "?raw", import: "default", eager: true });

/** The fl- class names a stylesheet defines (category files each use their own prefix, e.g. fl-shop-). */
const cssClasses = (css: string) => [...new Set([...css.matchAll(/\.(fl-[a-z0-9]+-[a-z0-9-]+)/g)].map((m) => m[1]!))];

const params = new URLSearchParams(location.search);
const id = params.get("id") ?? "";
const styleId = params.get("style") ?? "";
const surface = params.get("surface") ?? "";

// Only the category styles this section uses (as a built app gets): parsing all of them in every preview frame made a
// page of thumbnails slow. backgrounds.css stays, as in a built app.
const addStyles = (used: string) => {
  const style = document.createElement("style");
  style.textContent = [
    previewBaseCss(styleId, surface),
    // The surface's backdrop (liquid glass's colour wash, for one) behind the page, as a built app paints it.
    "html,body{margin:0;overflow-x:hidden;background:var(--color-bg);background-image:var(--page-backdrop,none);background-attachment:fixed;color:var(--color-text);font-family:var(--font-sans);font-size:var(--text-md);-webkit-font-smoothing:antialiased}body{overflow-y:auto}html{height:100%}body{min-height:100%}*,*::before,*::after{box-sizing:border-box}",
    baseCss,
    ...Object.keys(categoryCss)
      .sort()
      .filter((k) => k.endsWith("/backgrounds.css") || cssClasses(categoryCss[k]!).some((c) => used.includes(c)))
      .map((k) => categoryCss[k]),
  ].join("\n\n");
  document.head.appendChild(style);
};

// Height to the Components page, so the frame fits the section (and grows when a section opens something inline).
// Floating panels (a search's results, a menu, a popover) sit outside the normal flow and don't count in scrollHeight,
// so the frame also grows to the lowest element on the page; otherwise they were cut off at the frame's edge.
const report = () => {
  let bottom = document.documentElement.scrollHeight;
  for (const el of document.querySelectorAll("#root *")) bottom = Math.max(bottom, Math.ceil(el.getBoundingClientRect().bottom + window.scrollY) + 24);
  parent.postMessage({ type: "fl-section-height", id, height: bottom }, "*");
};
// Opening a menu or a popover changes the page without resizing the body, so watch for that too.
new MutationObserver(() => requestAnimationFrame(report)).observe(document.getElementById("root")!, { childList: true, subtree: true });
const ro = new ResizeObserver(report);
ro.observe(document.body);
ro.observe(document.documentElement);
void document.fonts.ready.then(report);

const file = `../../../templates/library/sections/${id}.tsx`;

// A piece's source with the sources of the library pieces it imports (a template built from blocks, a block built from
// components), so the styles those use load too.
const withImports = async (path: string, seen = new Set<string>()): Promise<string> => {
  if (seen.has(path) || !sources[path]) return "";
  seen.add(path);
  const text = await sources[path]!();
  const deps = [...text.matchAll(/from "\.\/([a-z0-9-]+)"/g)].map((m) => `../../../templates/library/sections/${m[1]}.tsx`);
  return [text, ...(await Promise.all(deps.map((d) => withImports(d, seen))))].join("\n");
};
// &focus=<variant ID> (c.tabs.pills): show only that variant of a component's sheet, for its own entry in the library.
// The sheet marks each drawn variant with data-fl; the variant's block is the largest one around it that holds no other
// variant of the same component (its label and note come with it), and everything beside that block is hidden.
const focus = params.get("focus") ?? "";
const isolate = () => {
  if (!focus) return;
  const target = document.querySelector(`#root [data-fl="${CSS.escape(focus)}"]`);
  const root = document.getElementById("root")!;
  if (!target) {
    const note = document.createElement("p");
    note.textContent = `${focus} isn't drawn on its own on this sheet, so the whole sheet is shown.`;
    note.style.cssText = "margin:0;padding:10px 24px;font:13px/1.4 system-ui,sans-serif;background:#fff7e0;color:#5c4400";
    root.prepend(note);
    return;
  }
  const base = focus.split(".").slice(0, 2).join(".");
  const others = (scope: Element) => [...scope.querySelectorAll(`[data-fl^="${CSS.escape(base)}."], [data-fl="${CSS.escape(base)}"]`)].some((e) => e.getAttribute("data-fl") !== focus);
  // Column headings and section headings stay, so a row of states keeps its labels.
  const keep = (el: HTMLElement) => el.tagName === "STYLE" || el.tagName === "THEAD" || /(^|\s)fl-[a-z0-9-]*(head|header)(\s|$)/.test(el.className) || el.getAttribute("role") === "columnheader" || (!!el.querySelector("[role=columnheader], th") && !el.querySelector("[data-fl]"));
  let block = target;
  while (block.parentElement && block.parentElement !== root && !others(block.parentElement)) block = block.parentElement;
  // A state table whose variants are its columns (Outlined | Filled | Underlined, a state per row): the block stops at
  // one cell, so keep that variant's whole column, every state, plus the row labels, and hide the other columns.
  const cell = block.closest("td, th");
  const table = cell?.closest("table");
  if (cell instanceof HTMLTableCellElement && table) {
    const col = cell.cellIndex;
    for (const row of table.rows) for (const c of row.cells) if (c.cellIndex !== 0 && c.cellIndex !== col) c.style.display = "none";
    block = table;
  }
  for (let n: Element = block; n.parentElement && n !== root; n = n.parentElement)
    for (const sib of n.parentElement.children) if (sib !== n && sib instanceof HTMLElement && !keep(sib)) sib.style.display = "none";
};

// &live=1 (the Look studio): the page takes a look's token values by message and paints them over the starter's, so the
// template follows every change without reloading. It says when it is ready for them.
const live = params.get("live") === "1";
// A preview opens at the top: a piece that focuses a field on mount (a slider, a sign-up box) mustn't scroll to it.
if (live) {
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    focus.call(this, { ...options, preventScroll: true });
  };
  // …nor scroll itself into view.
  Element.prototype.scrollIntoView = function () {};
  history.scrollRestoration = "manual";
}
if (live)
  addEventListener("message", (e: MessageEvent) => {
    const m = e.data as { type?: string; tokens?: Record<string, string>; css?: string } | null;
    if (m?.type !== "fl-tokens" || !m.tokens) return;
    const el = document.documentElement;
    for (const [k, v] of Object.entries(m.tokens)) if (k.startsWith("--")) el.style.setProperty(k, v);
    // Rules a look adds beyond tokens (its gradient's page titles and feature panels).
    let extra = document.getElementById("fl-live-css");
    if (!extra) (extra = document.createElement("style")), (extra.id = "fl-live-css"), document.head.appendChild(extra);
    extra.textContent = m.css ?? "";
  });

const load = modules[file];
const root = createRoot(document.getElementById("root")!);
if (load)
  void Promise.all([load(), withImports(file)]).then(([m, used]) => {
    addStyles(used);
    root.render(<m.default />);
    setTimeout(isolate, 60);
    requestAnimationFrame(report);
    if (live) {
      // A preview starts at the top of the page (an element further down can take focus and scroll to itself).
      for (const ms of [0, 80, 300, 900]) setTimeout(() => scrollTo(0, 0), ms);
      parent.postMessage({ type: "fl-live-ready", id }, "*");
    }
  });
else (addStyles(""), root.render(<p style={{ padding: 24 }}>No section called “{id}”.</p>));
