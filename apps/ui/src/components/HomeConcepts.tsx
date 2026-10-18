/**
 * The Home direction on the plan card: the build's Home concepts, each live (concept-preview.html) on the build's own
 * records, to pick before approving the plan. Part of the plan approval, not another stop: picking is optional, nothing
 * is applied until the plan is approved, and no pick keeps the default Home.
 */
import { useEffect, useRef, useState } from "react";
import { appearanceTokens, type Appearance } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { DirectionEditor } from "./DirectionEditor";

interface Concept {
  id: string;
  name: string;
  thesis: string;
  design?: "storefront" | "magazine" | "listings";
  tokens: Record<string, string>;
  fonts: string[];
}
interface Offer {
  offered: boolean;
  why?: string;
  concepts: Concept[];
  chosen?: { conceptId: string };
  preview?: { product: string; promise?: string; data: unknown };
}

/** One concept's live preview, scaled into its slot; it gets its data from here by message once it has loaded. */
function ConceptFrame({ runId, concept, offer, look }: { runId: string; concept: Concept; offer: Offer; look?: Appearance }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  // The page is drawn at 1280px wide and scaled to the slot's width.
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const ro = new ResizeObserver(() => el.style.setProperty("--hc-scale", String(el.clientWidth / 1280)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || e.data?.type !== "fl-concept-ready") return;
      frame.current?.contentWindow?.postMessage(message(), location.origin);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [runId, concept, offer, look]);
  // The concept is the layout; the look you're editing (if any) is drawn on it, so changing the look keeps the layout.
  const message = () => ({ type: "fl-concept", id: `${runId}-${concept.id}`, design: concept.design, tokens: look ? appearanceTokens(look) : concept.tokens, promise: offer.preview?.promise, data: offer.preview?.data });
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(message(), location.origin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look]);
  return (
    <div className="hc-frame" ref={slot}>
      <iframe ref={frame} src={`concept-preview.html?concept=${encodeURIComponent(concept.id)}`} title={`${concept.name}: Home page preview`} tabIndex={-1} loading="lazy" />
    </div>
  );
}

export function HomeConcepts({ runId, projectId }: { runId: string; projectId: string }) {
  const offer = useResource<Offer>(`/runs/${runId}/concepts`, [runId]);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [look, setLook] = useState<Appearance>();
  const o = offer.data;
  const current = picked ?? o?.chosen?.conceptId;
  const pick = async (id: string) => {
    setPicked(id);
    setError(undefined);
    try {
      await post(`/runs/${runId}/concept`, { conceptId: id });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  // The look is editable on every plan; the Home layouts only where concepts are offered.
  return (
    <fieldset className="hc">
      <legend className="label">{o?.offered ? "Look and Home page" : "Look"}</legend>
      {/* Change the look here instead of denying the plan. Confirmed with "Use this direction"; approving the plan uses it. */}
      <DirectionEditor projectId={projectId} where="plan" onAppearance={setLook} />
      {o?.offered ? (
        <>
          <p className="hc-sub label">Home page layout</p>
          <p className="hc-lede">
            Pick the layout of {o.preview?.product ?? "the app"}'s Home page from your library's page designs, shown on this build's own products{look ? " in the look above" : ""}. {look ? "A layout never changes your look." : "Without a look of your own, a layout brings its own (Flat or Tactile)."} Applied when you approve the plan; you still review the finished app. If you approve without choosing, no layout is recorded and the design requirement stays open.
          </p>
          <div className="hc-grid">
            {o.concepts.map((c) => (
              <label key={c.id} className={`hc-option${current === c.id ? " is-picked" : ""}`}>
                <ConceptFrame runId={runId} concept={c} offer={o} look={look} />
                <span className="hc-choice">
                  <input type="radio" name={`hc-${runId}`} checked={current === c.id} onChange={() => void pick(c.id)} />
                  <span>
                    <strong>{c.name}</strong>
                    <span className="hc-thesis">{c.thesis}</span>
                    <span className="hc-fonts">{look ? `${c.design} page, in your look` : `${c.fonts.join(" / ")}${c.design ? ` · ${c.design} page` : ""}`}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          <label className="hc-default">
            <input type="radio" name={`hc-${runId}`} checked={current === "default"} onChange={() => void pick("default")} /> Use the generic default Home layout (no concept)
          </label>
        </>
      ) : o?.why && !o.concepts.length ? (
        <p className="hc-note">Home page layouts: {o.why}.</p>
      ) : null}
      {error ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
