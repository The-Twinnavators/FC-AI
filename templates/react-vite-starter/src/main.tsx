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
window.addEventListener("message", (e: MessageEvent) => {
  const d = e.data as { type?: string; theme?: unknown; off?: unknown } | null;
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
