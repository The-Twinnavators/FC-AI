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
const categoryCss = import.meta.glob<string>("../../../templates/library/css/*.css", { query: "?raw", import: "default", eager: true });

const params = new URLSearchParams(location.search);
const id = params.get("id") ?? "";
const styleId = params.get("style") ?? "";

const style = document.createElement("style");
style.textContent = [
  previewBaseCss(styleId),
  "html,body{margin:0;overflow:hidden;background:var(--color-bg);color:var(--color-text);font-family:var(--font-sans);font-size:var(--text-md);-webkit-font-smoothing:antialiased}*,*::before,*::after{box-sizing:border-box}",
  baseCss,
  ...Object.keys(categoryCss).sort().map((k) => categoryCss[k]),
].join("\n\n");
document.head.appendChild(style);

// Height to the Components page, so the frame fits the section (and grows when a section opens something inline).
const report = () => parent.postMessage({ type: "fl-section-height", id, height: document.documentElement.scrollHeight }, "*");
const ro = new ResizeObserver(report);
ro.observe(document.body);
ro.observe(document.documentElement);
void document.fonts.ready.then(report);

const load = modules[`../../../templates/library/sections/${id}.tsx`];
const root = createRoot(document.getElementById("root")!);
if (load) void load().then((m) => (root.render(<m.default />), requestAnimationFrame(report)));
else root.render(<p style={{ padding: 24 }}>No section called “{id}”.</p>);
