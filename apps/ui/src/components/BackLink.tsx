/** "Back to …" link that returns to the page that brought you here (in-app history), or to `fallback`. */
import { goBack, previousRoute, routeName } from "../router";
import { Icon } from "./ui";

export function BackLink({ fallback, fallbackLabel }: { fallback: string; fallbackLabel: string }) {
  const prev = previousRoute();
  return (
    <button className="lrc__back back-link" onClick={() => goBack(fallback)}>
      <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
        <Icon name="chevron" />
      </span>
      Back to {prev ? routeName(prev) : fallbackLabel}
    </button>
  );
}
