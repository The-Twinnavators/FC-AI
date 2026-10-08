/**
 * Point-and-say (D1): a fresh screenshot of the running app at the chosen size; click what should change, say how,
 * and the request (with exactly what was pointed at) goes into the builder chat for you to review and send. FlowCode
 * looks with its own browser because the live preview runs on another origin.
 */
import { useEffect, useState } from "react";
import { post } from "../api";
import { Modal } from "./Modal";
import { ErrorNotice } from "./ui";

type Element = { tag: string; text: string; label?: string; selector: string; section?: string; rect: { x: number; y: number; width: number; height: number }; files: string[] };
type Size = "phone" | "tablet" | "desktop";

/** The builder chat takes this text into its message box (it never sends it on its own). */
export const COMPOSE_EVENT = "fc:compose-change";
let pendingCompose: string | undefined;
/** Opens the builder chat with a change written out, for the person to read and send. */
export function composeChange(text: string) {
  pendingCompose = text;
  window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: text }));
}
export const takePendingCompose = () => {
  const t = pendingCompose;
  pendingCompose = undefined;
  return t;
};

const describe = (e: Element) => {
  const what = e.text ? `"${e.text}"` : e.label ? `(${e.label})` : "";
  const kind: Record<string, string> = { a: "link", button: "button", input: "field", textarea: "field", select: "menu", img: "image", h1: "heading", h2: "heading", h3: "heading", li: "list item" };
  return `the ${kind[e.tag] ?? e.tag} ${what}`.trim();
};

export function PointAndSay({ projectId, size, onClose }: { projectId: string; size: Size; onClose: () => void }) {
  const [shot, setShot] = useState<{ png: string; width: number; height: number; path: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [hit, setHit] = useState<Element>();
  const [say, setSay] = useState("");
  // A fresh look at the app when this opens.
  useEffect(() => {
    let live = true;
    setBusy(true);
    post<{ png: string; width: number; height: number; path: string }>(`/projects/${projectId}/point`, { size })
      .then((s) => live && setShot(s), (e: Error) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [projectId, size]);

  const click = async (ev: React.MouseEvent<HTMLImageElement>) => {
    if (!shot || busy) return;
    const box = ev.currentTarget.getBoundingClientRect();
    const scale = shot.width / box.width;
    const x = Math.round((ev.clientX - box.left) * scale);
    const y = Math.round((ev.clientY - box.top) * scale);
    setBusy(true);
    setError(undefined);
    try {
      const r = await post<{ element?: Element }>(`/projects/${projectId}/point`, { size, x, y, path: shot.path });
      setHit(r.element);
      if (!r.element) setError("Nothing clickable there. Try pointing at a word, button or picture.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toChat = () => {
    if (!hit || !say.trim()) return;
    const where = [`On the ${shot?.path && shot.path !== "/" ? `${shot.path} ` : "first "}screen at ${size} size`, hit.section ? `in the "${hit.section}" part` : ""].filter(Boolean).join(", ");
    const text = [
      `${where}, change ${describe(hit)}.`,
      `Exactly this element: \`${hit.selector}\`${hit.files.length ? `, likely in ${hit.files.join(", ")}` : ""}.`,
      "",
      `What to change: ${say.trim()}`,
      "",
      "Change only this; keep everything else as it is.",
    ].join("\n");
    pendingCompose = text;
    window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: text }));
    onClose();
  };

  return (
    <Modal onClose={onClose} labelledBy="pas-title" className="pas-modal">
      <div className="pas">
        <header className="pas__head">
          <h2 id="pas-title">Point at what should change</h2>
          <span className="muted">{busy && !shot ? "Taking a fresh look at your app…" : `Your app at ${size} size. Click the thing to change.`}</span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="pas__body">
          <div className="pas__shot">
            {shot ? (
              <div className="pas__frame" style={{ maxWidth: Math.min(shot.width, 900) }}>
                <img src={`data:image/png;base64,${shot.png}`} alt="Your app, to point at" onClick={(e) => void click(e)} style={{ cursor: busy ? "progress" : "crosshair" }} />
                {hit ? (
                  <span
                    className="pas__hit"
                    aria-hidden="true"
                    style={{ left: `${(hit.rect.x / shot.width) * 100}%`, top: `${(hit.rect.y / shot.height) * 100}%`, width: `${(hit.rect.width / shot.width) * 100}%`, height: `${(hit.rect.height / shot.height) * 100}%` }}
                  />
                ) : null}
              </div>
            ) : busy ? (
              <p className="muted">Loading…</p>
            ) : null}
          </div>
          <aside className="pas__side">
            {error ? <ErrorNotice error={error} doing="look at your app" /> : null}
            {hit ? (
              <>
                <p className="pas__picked">
                  <strong>You pointed at {describe(hit)}.</strong>
                  {hit.section ? <span className="muted"> In the &ldquo;{hit.section}&rdquo; part.</span> : null}
                </p>
                <p className="muted mono pas__sel">{hit.selector}</p>
                {hit.files.length ? <p className="muted">Probably in {hit.files.join(", ")}</p> : null}
                <label className="pas__label" htmlFor="pas-say">
                  What should change?
                </label>
                <textarea id="pas-say" className="textarea" rows={4} value={say} onChange={(e) => setSay(e.target.value)} placeholder="e.g. Make this button say “Start lesson” and use the accent colour" />
                <button type="button" className="btn btn--primary" disabled={!say.trim()} onClick={toChat}>
                  Put it in the chat
                </button>
                <p className="muted pas__hint">It goes into the builder chat&apos;s message box. Read it, then send it yourself.</p>
              </>
            ) : (
              <p className="muted">Click anything in the picture: a button, heading, card or image. FlowCode works out exactly which element it is.</p>
            )}
          </aside>
        </div>
      </div>
    </Modal>
  );
}
