import { useEffect, useState } from "react";

type VTDocument = Document & { startViewTransition?: (cb: () => void) => unknown };

/** Hash router — works from file:// inside Electron. Uses View Transitions for seamless page changes. */
export function navigate(path: string) {
  const doc = document as VTDocument;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => (location.hash = path));
  else location.hash = path;
}

export function useRoute(): { path: string; parts: string[]; query: URLSearchParams } {
  const read = () => {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [p, q] = raw.split("?");
    return { path: p, parts: p.split("/").filter(Boolean), query: new URLSearchParams(q ?? "") };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

// ── In-app history: lets "Back" return to the page that brought you here (not the browser's history) ──
const trail: string[] = [];
const current = () => (location.hash.replace(/^#/, "") || "/").split("?")[0];
if (typeof window !== "undefined") {
  trail.push(current());
  window.addEventListener("hashchange", () => {
    const p = current();
    // A new page opens at its top, not at the old page's scroll position (the page area, #main, scrolls on its own).
    // Only a query change on the same page (a filter, a picked item) keeps the scroll.
    if (trail.at(-1) !== p)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          document.getElementById("main")?.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
          window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        }),
      );
    if (trail.at(-1) !== p) trail.push(p);
    if (trail.length > 50) trail.splice(0, trail.length - 50);
  });
}

/** The previous in-app route (ignoring same-page query changes), or undefined when this is the first page. */
export function previousRoute(): string | undefined {
  for (let i = trail.length - 2; i >= 0; i--) if (trail[i] !== current()) return trail[i];
  return undefined;
}

const PAGE_NAMES: Record<string, string> = {
  "": "Dashboard",
  projects: "workspace",
  quality: "My Projects",
  search: "Search",
  topics: "Topic Search",
  reports: "Reports",
  knowledge: "Knowledge Hub",
  library: "Prompts & Skills",
  models: "Models",
  agents: "Agents",
  network: "Network Graph",
  settings: "Settings",
  system: "System Health",
  primitives: "Branding",
  guide: "About FlowCode",
  discover: "Create PRD",
  flowreport: "Repo Report",
};

/** Human name for a route, for "Back to …" labels. */
export function routeName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "quality" && parts[2] === "launch") return "Launch readiness";
  if (parts[0] === "quality" && parts[2] === "plan") return "Prototype plan";
  if (parts[0] === "quality" && parts[1]) return "project";
  if (parts[0] === "topics" && parts[1]) return "topic";
  return PAGE_NAMES[parts[0] ?? ""] ?? "previous page";
}

/** Go back to the page that brought you here, or to `fallback` when there is none. */
export function goBack(fallback: string) {
  const prev = previousRoute();
  // Drop the current entry so repeated Back presses keep walking backwards.
  if (prev) {
    const at = trail.lastIndexOf(prev);
    trail.splice(at + 1);
    trail.pop();
  }
  navigate(prev ?? fallback);
}
