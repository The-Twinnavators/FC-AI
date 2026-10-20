/**
 * A library page template, live in its own window (section-preview.html, live mode), painted in a look: the look's
 * tokens and its gradient rules are sent by message whenever they change, so the page follows every control without
 * reloading. As a thumbnail it is drawn at desktop width and scaled to its box, starting only when it comes near the
 * screen.
 */
import { useEffect, useRef, useState } from "react";

const PAGE_WIDTH: Record<"phone" | "tablet" | "desktop", number> = { phone: 390, tablet: 820, desktop: 1280 };

function useLiveFrame(id: string, tokens: Record<string, string>, css: string) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const on = (e: MessageEvent) => {
      const m = e.data as { type?: string; id?: string } | null;
      if (m?.type === "fl-live-ready" && m.id === id && e.source === frame.current?.contentWindow) setReady(true);
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, [id]);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: "fl-tokens", tokens, css }, "*");
  }, [ready, tokens, css]);
  const src = new URL(`section-preview.html?id=${encodeURIComponent(id)}&live=1`, document.baseURI).href;
  return { frame, ready, src };
}

/**
 * The big preview: the template in a faux browser window (dots, the site's address) at the device's width, scaled to fit
 * the stage. The stage takes the window's height, so the page shows as much as the screen allows.
 */
export function LiveTemplate({ id, title, tokens, css, device, site, reserve = 0 }: { id: string; title: string; tokens: Record<string, string>; css: string; device: "phone" | "tablet" | "desktop"; site: string; reserve?: number }) {
  const { frame, ready, src } = useLiveFrame(id, tokens, css);
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // The stage fills what is visible of the page's scroll area below its top, leaving `reserve` px for what follows
    // it (the "Describe a change" bar), so nothing the person needs sits below the fold.
    const scroller = el.closest<HTMLElement>(".view") ?? document.documentElement;
    const measure = () => {
      setFit(Math.min(1, (el.clientWidth - 32) / PAGE_WIDTH[device]));
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      // Whatever is pinned over the bottom of the page (FlowCode's footer, or the setup's action bar) hides what's
      // under it too.
      const footer = scroller.querySelector<HTMLElement>(".app-footer");
      const bar = document.querySelector<HTMLElement>(".psetup-actions");
      const pinned = Math.max(footer && footer.offsetParent && /sticky|fixed/.test(getComputedStyle(footer).position) ? footer.offsetHeight : 0, bar?.offsetHeight ?? 0);
      setHeight(Math.max(280, Math.floor(scroller.clientHeight - top - reserve - pinned)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(scroller);
    addEventListener("resize", measure);
    return () => (ro.disconnect(), removeEventListener("resize", measure));
  }, [device, reserve]);
  const width = Math.round(PAGE_WIDTH[device] * fit);
  return (
    <div className="lt-stage" ref={box} style={height ? { height } : undefined}>
      <div className={`lt-browser lt-browser--${device}`} style={{ width }}>
        <div className="lt-browser__bar" aria-hidden="true">
          <span className="lt-browser__dots"><i /><i /><i /></span>
          <span className="lt-browser__address">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            {site}
          </span>
          <span className="lt-browser__end" />
        </div>
        <div className="lt-browser__view">
          {ready ? null : <span className="lt-loading" role="progressbar" aria-label={`Loading ${title}`} />}
          <iframe
            key={id}
            ref={frame}
            className={`lt-frame${ready ? " is-ready" : ""}`}
            title={`${title}, live preview`}
            src={src}
            style={{ width: PAGE_WIDTH[device], height: `${100 / fit}%`, transform: `scale(${fit})` }}
          />
        </div>
      </div>
    </div>
  );
}

/** A gallery tile's picture: the template at desktop width, scaled down; starts only near the screen. */
export function TemplateThumb({ id, title, tokens, css }: { id: string; title: string; tokens: Record<string, string>; css: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  const [near, setNear] = useState(false);
  const { frame, ready, src } = useLiveFrame(id, tokens, css);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1280));
    ro.observe(el);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: "200px 0px" });
    io.observe(el);
    return () => (ro.disconnect(), io.disconnect());
  }, []);
  return (
    <div ref={box} className={`lt-thumb${ready ? " is-ready" : ""}`} aria-hidden="true">
      {near ? <iframe ref={frame} className="lt-thumb__frame" title={`${title} thumbnail`} src={src} tabIndex={-1} style={{ transform: `scale(${scale})` }} /> : null}
    </div>
  );
}
