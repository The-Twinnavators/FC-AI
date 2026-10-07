/** 90px site footer shown on every page except the project workspace (which is a full-height tool). */
import { navigate } from "../router";
import { Logo } from "./ui";

export const VERSION = "0.1.0";

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
      <p className="app-footer__note">
        <span className="led led--ok" aria-hidden="true" /> Runs locally — your code and models stay on this machine.
      </p>
      <span className="app-footer__version">v{VERSION} · © {new Date().getFullYear()} The Twinnovators, LLC. · In God We Trust</span>
    </footer>
  );
}
