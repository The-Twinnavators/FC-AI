/**
 * Styles tab → Surface: switch an existing app's surface style (flat, glass, soft, neo-brutalist…). FlowCode rewrites
 * the app's surface tokens (and, for older apps, connects their building blocks to them). Each change is snapshotted
 * and can be undone here.
 */
import { useState } from "react";
import { Undo2 } from "lucide-react";
import { STYLE_VIBES } from "@flowcode/contracts";
import { post, useResource } from "../api";
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
  const [busy, setBusy] = useState<string>();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [undo, setUndo] = useState<Array<{ snapshotIds: string[]; from?: string }>>([]);

  const choose = async (id: string) => {
    if (id === data?.current) return;
    setBusy(id);
    setMsg(undefined);
    try {
      const r = await post<{ snapshotIds: string[]; changed: string[] }>(`/projects/${projectId}/styles/surface`, { vibe: id });
      setUndo((u) => [{ snapshotIds: r.snapshotIds, from: data?.current }, ...u].slice(0, 10));
      const name = STYLE_VIBES.find((v) => v.id === id)?.name ?? id;
      setMsg({ ok: true, text: `Changed to ${name}. Open Preview to see every screen in the new style.${r.changed.includes("src/styles/surfaces.css") ? " This app's building blocks were connected to the surface style for the first time." : ""}` });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(undefined);
    }
  };

  const undoLast = async () => {
    const [last, ...rest] = undo;
    if (!last) return;
    setBusy("undo");
    try {
      // Restore newest first, so files return to how they were before the change.
      for (const id of [...last.snapshotIds].reverse()) await post(`/snapshots/${id}/restore`);
      setUndo(rest);
      setMsg({ ok: true, text: `Undone. The app is back to ${STYLE_VIBES.find((v) => v.id === last.from)?.name ?? "its previous style"}.` });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(undefined);
    }
  };

  if (error) return <ErrorNotice error={error} doing="open the surface styles" onRetry={reload} />;
  if (loading && !data) return <SkeletonBlock rows={4} />;
  if (!data) return null;
  if (!data.supported) return <Empty title="Surface styles aren't available for this app">{data.reason}</Empty>;

  return (
    <div className="surface-panel">
      <div className="surface-panel__head">
        <p className="muted" style={{ margin: 0 }}>
          How cards, panels and buttons are drawn. Colors and fonts stay the same. Pick one to apply it to the whole app.
        </p>
        <button type="button" className="btn btn--sm" onClick={undoLast} disabled={!undo.length || !!busy} title={undo.length ? "Undo the last change" : "Nothing to undo"}>
          <Undo2 size={14} aria-hidden="true" /> Undo
        </button>
      </div>
      {msg ? (
        <p className={`notice ${msg.ok ? "notice--ok" : "notice--bad"}`} role={msg.ok ? "status" : "alert"} style={{ margin: 0 }}>
          {msg.text}
        </p>
      ) : null}
      <div className="look__grid look__grid--vibes" role="radiogroup" aria-label="Surface style">
        {STYLE_VIBES.map((v) => (
          <label key={v.id} className={`look-card${data.current === v.id ? " is-on" : ""}${busy === v.id ? " is-busy" : ""}`}>
            <input type="radio" name={`surface-${projectId}`} value={v.id} checked={data.current === v.id} disabled={!!busy} onChange={() => void choose(v.id)} className="sr-only" />
            <VibePreview vibe={v.id} colors={data.colors} />
            <span className="look-card__name">
              {v.name}
              {data.current === v.id ? <span className="look-card__tag">Current</span> : null}
            </span>
            <span className="look-card__desc">{busy === v.id ? "Applying…" : v.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
