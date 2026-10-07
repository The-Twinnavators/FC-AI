import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/martian-mono/400.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/motion.css";
import "./styles/readability.css";
import "./styles/launch.css";
import "./styles/analysis.css";
import "./styles/discover.css";
import "./styles/responsive.css";
import "./styles/about.css";
import "./styles/component-tokens.css";
import { App } from "./App";
import { loadThemeOverrides } from "./theme";
import { themeFor } from "./appearance";

// First paint: the theme this page should have (toggle, system or per page).
document.documentElement.dataset.theme = themeFor(location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] ?? "");

// Saved attribute overrides from Primitives → Attributes.
void loadThemeOverrides();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
