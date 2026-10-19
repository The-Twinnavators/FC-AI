import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/library.css";
import "./styles/app.css";
import "./styles/components.css";
import "./styles/motion.css";
import App from "./App";
import { setMotionOff } from "./lib/motion";

// Light or dark: FlowCode's preview toggle sends it (and ?theme=dark in the address sets it); light by default. The
// computer's own setting never switches it, so the app always shows its style.
const setTheme = (theme: unknown) => {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
};
setTheme(new URLSearchParams(window.location.search).get("theme") ?? "light");
// FlowCode's design preview: a draft Look's tokens and fonts, shown live in FlowCode's preview frame only (nothing is
// saved; a reload shows the app's own styles).
let previewed: string[] = [];
const previewTokens = (tokens: Record<string, string> | null) => {
  const s = document.documentElement.style;
  for (const k of previewed) s.removeProperty(k);
  previewed = [];
  for (const [k, v] of Object.entries(tokens ?? {})) if (k.startsWith("--")) {
    s.setProperty(k, v);
    previewed.push(k);
  }
};
const previewFonts = (fonts: Array<{ family: string; url: string }>) => {
  for (const f of fonts) if (![...document.fonts].some((x) => x.family.replace(/"/g, "") === f.family)) void new FontFace(f.family, `url(${f.url})`).load().then((face) => document.fonts.add(face)).catch(() => undefined);
};
window.addEventListener("message", (e: MessageEvent) => {
  const d = e.data as { type?: string; theme?: unknown; off?: unknown } | null;
  if (d && d.type === "flowcode:tokens") {
    previewTokens((d as { tokens?: Record<string, string> | null }).tokens ?? null);
    requestAnimationFrame(() => window.parent?.postMessage({ type: "flowcode:painted", id: (d as { id?: unknown }).id }, "*"));
  }
  if (d && d.type === "flowcode:fonts") previewFonts((d as { fonts?: Array<{ family: string; url: string }> }).fonts ?? []);
  if (d && d.type === "flowcode:hello") window.parent?.postMessage({ type: "flowcode:ready", tokens: true }, "*");
  if (d && d.type === "flowcode:theme") setTheme(d.theme);
  if (d && d.type === "flowcode:motion") setMotionOff(d.off === true);
});
// Animation off (?motion=off, or FlowCode's preview): the app at rest, fully working. Reduced motion is the system's.
if (new URLSearchParams(window.location.search).get("motion") === "off") setMotionOff(true);

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
