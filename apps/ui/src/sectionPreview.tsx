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

// Only the category styles this section uses (as a built app gets): parsing all of them in every preview frame made a
// page of thumbnails slow. backgrounds.css stays, as in a built app.
const addStyles = (used: string) => {
  const style = document.createElement("style");
  style.textContent = [
    previewBaseCss(styleId),
    "html,body{margin:0;overflow:hidden;background:var(--color-bg);color:var(--color-text);font-family:var(--font-sans);font-size:var(--text-md);-webkit-font-smoothing:antialiased}*,*::before,*::after{box-sizing:border-box}",
    baseCss,
    ...Object.keys(categoryCss)
      .sort()
      .filter((k) => k.endsWith("/backgrounds.css") || cssClasses(categoryCss[k]!).some((c) => used.includes(c)))
      .map((k) => categoryCss[k]),
  ].join("\n\n");
  document.head.appendChild(style);
};

// Height to the Components page, so the frame fits the section (and grows when a section opens something inline).
const report = () => parent.postMessage({ type: "fl-section-height", id, height: document.documentElement.scrollHeight }, "*");
const ro = new ResizeObserver(report);
ro.observe(document.body);
ro.observe(document.documentElement);
void document.fonts.ready.then(report);

const file = `../../../templates/library/sections/${id}.tsx`;
const load = modules[file];
const root = createRoot(document.getElementById("root")!);
if (load)
  void Promise.all([load(), sources[file]!()]).then(([m, used]) => {
    addStyles(used);
    root.render(<m.default />);
    requestAnimationFrame(report);
  });
else (addStyles(""), root.render(<p style={{ padding: 24 }}>No section called “{id}”.</p>));
