/**
 * Styles tab → Surface: the app's surface styles, with its current one marked. Read-only: the surface is part of the
 * project's Look (DirectionEditor), changed there as a draft and applied deliberately, so nothing here writes to the app.
 */
import { STYLE_VIBES } from "@flowcode/contracts";
import { useResource } from "../api";
import { ErrorNotice, Empty } from "./ui";
import { SkeletonBlock } from "./motion";
import { VibePreview } from "./LookStep";

interface Info {
  supported: boolean;
  reason?: string;
  current?: string;
  colors: Record<string, string>;
}

export function SurfacePanel({ projectId }: { projectId: string }) {
  const { data, error, reload, loading } = useResource<Info>(`/projects/${projectId}/styles/surface`, [projectId]);
  if (error) return <ErrorNotice error={error} doing="open the surface styles" onRetry={reload} />;
  if (loading && !data) return <SkeletonBlock rows={4} />;
  if (!data) return null;
  if (!data.supported) return <Empty title="Surface styles aren't available for this app">{data.reason}</Empty>;

  return (
    <div className="surface-panel">
      <div className="surface-panel__head">
        <p className="muted" style={{ margin: 0 }}>
          How cards, panels and buttons are drawn. The surface is part of the project's Look: change it there (Flat or Tactile; another style only if you ask for it in this project), as a draft you apply deliberately.
        </p>
        <button type="button" className="btn btn--sm" onClick={() => window.dispatchEvent(new CustomEvent("fc:open-look"))}>
          Change in Look
        </button>
      </div>
      <div className="look__grid look__grid--vibes" role="radiogroup" aria-label="Surface style">
        {STYLE_VIBES.map((v) => (
          <label key={v.id} className={`look-card${data.current === v.id ? " is-on" : ""}`}>
            <input type="radio" name={`surface-${projectId}`} value={v.id} checked={data.current === v.id} disabled readOnly className="sr-only" />
            <VibePreview vibe={v.id} colors={data.colors} />
            <span className="look-card__name">
              {v.name}
              {data.current === v.id ? <span className="look-card__tag">Current</span> : null}
            </span>
            <span className="look-card__desc">{v.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
