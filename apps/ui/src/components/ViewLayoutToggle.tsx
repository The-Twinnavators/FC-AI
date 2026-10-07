/** Cards or a compact list, per library tab; the choice is remembered in this browser. */
import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";

export type ViewLayout = "cards" | "list";

export function useViewLayout(key: string): [ViewLayout, (v: ViewLayout) => void] {
  const storageKey = `fc.${key}.layout`;
  const [layout, setLayoutState] = useState<ViewLayout>(() => {
    try {
      return localStorage.getItem(storageKey) === "list" ? "list" : "cards";
    } catch {
      return "cards";
    }
  });
  const setLayout = (v: ViewLayout) => {
    setLayoutState(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      /* storage unavailable */
    }
  };
  return [layout, setLayout];
}

export function ViewLayoutToggle({ layout, setLayout, label }: { layout: ViewLayout; setLayout: (v: ViewLayout) => void; label: string }) {
  return (
    <div className="seg skill-browse__layout" role="radiogroup" aria-label={label}>
      {(["cards", "list"] as const).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={layout === v} className={`seg__btn${layout === v ? " is-on" : ""}`} onClick={() => setLayout(v)}>
          {v === "cards" ? <LayoutGrid size={14} aria-hidden="true" /> : <List size={14} aria-hidden="true" />}
          {v === "cards" ? "Cards" : "List"}
        </button>
      ))}
    </div>
  );
}
