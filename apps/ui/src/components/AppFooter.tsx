/** 90px site footer shown on every page except the project workspace (which is a full-height tool). */
import { navigate } from "../router";
import { Logo } from "./ui";

declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;

/** The running FlowCode's version, from package.json at build time (vite.config.ts), and the code revision it was built from. */
export const VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
export const BUILD = typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : "";

export function AppFooter() {
  return (
    <footer className="app-footer" aria-label="FlowCode">
      <div className="app-footer__brand">
        <Logo size={22} />
        <div>
          <strong>FlowCode <em className="brand-ai">AI</em></strong>
          <span>Personal Intelligence</span>
        </div>
      </div>
      <span className="app-footer__version" title={BUILD ? `Built from ${BUILD}` : undefined}>v{VERSION}{BUILD ? ` (${BUILD})` : ""} · © {new Date().getFullYear()} The Twinnovators, LLC. · In God We Trust</span>
    </footer>
  );
}
