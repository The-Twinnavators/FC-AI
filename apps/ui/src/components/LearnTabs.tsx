/**
 * About FlowCode's tabs: About (the overview), Walkthrough and Feature guide, the three pages that explain FlowCode
 * itself. Each keeps its own address (#/about, #/walkthrough, #/guide), so old links and the Copilot still reach them;
 * the side navigation shows them as one item, About FlowCode.
 */
import { useEffect, useState } from "react";
import { navigate } from "../router";

const TABS = [
  { id: "about", label: "About", path: "/about", guide: "nav.about" },
  { id: "walkthrough", label: "Walkthrough", path: "/walkthrough", guide: "nav.walkthrough" },
  { id: "guide", label: "Feature guide", path: "/guide", guide: "nav.guide" },
] as const;

export function LearnTabs({ at }: { at: (typeof TABS)[number]["id"] }) {
  // Pinned to the top as the page scrolls; its background shows only once something has scrolled under it.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const on = () => setStuck(main.scrollTop > 24);
    on();
    main.addEventListener("scroll", on, { passive: true });
    return () => main.removeEventListener("scroll", on);
  }, []);
  return (
    <nav className={`learn-tabs${stuck ? " is-stuck" : ""}`} aria-label="About FlowCode">
      {TABS.map((t) => (
        <button key={t.id} type="button" data-guide={t.guide} className={t.id === at ? "is-on" : undefined} aria-current={t.id === at ? "page" : undefined} onClick={() => navigate(t.path)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
