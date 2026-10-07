/**
 * What a build changed, by screen (C2): "Affects 2 of 6 screens: Find brands, Brand list · Shared styles: --brand-500",
 * with FlowCode's before and after screenshots. Per-file diffs stay below in Review.
 */
import { useEffect, useState } from "react";

/**
 * Where two screenshots differ: both drawn small on canvases, compared cell by cell, and the box around the cells
 * that changed (in the full-size picture's pixels). Undefined while loading or when they can't be compared.
 */
type Region = { x: number; y: number; w: number; h: number; width: number; height: number } | null;
function useDiffRegion(a?: string, b?: string): Region | undefined {
  const [region, setRegion] = useState<Region | undefined>();
  useEffect(() => {
    if (!a || !b) return setRegion(undefined);
    let live = true;
    setRegion(undefined);
    const load = (src: string) =>
      new Promise<HTMLImageElement>((ok, no) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => ok(i);
        i.onerror = no;
        i.src = src;
      });
    Promise.all([load(a), load(b)])
      .then(([ia, ib]) => {
        const W = 200;
        const s = W / ib.naturalWidth;
        const H = Math.round(Math.max(ia.naturalHeight, ib.naturalHeight) * s);
        const px = (img: HTMLImageElement) => {
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          const g = c.getContext("2d", { willReadFrequently: true })!;
          g.fillStyle = "#fff";
          g.fillRect(0, 0, W, H);
          g.drawImage(img, 0, 0, W, img.naturalHeight * s);
          return g.getImageData(0, 0, W, H).data;
        };
        const da = px(ia);
        const db = px(ib);
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (Math.abs(da[i]! - db[i]!) + Math.abs(da[i + 1]! - db[i + 1]!) + Math.abs(da[i + 2]! - db[i + 2]!) > 60) {
              if (x < x0) x0 = x;
              if (y < y0) y0 = y;
              if (x > x1) x1 = x;
              if (y > y1) y1 = y;
            }
          }
        if (!live) return;
        if (x1 < 0) return setRegion(null);
        const pad = 24;
        const toFull = (v: number) => v / s;
        setRegion({ x: Math.max(0, toFull(x0) - pad), y: Math.max(0, toFull(y0) - pad), w: toFull(x1 - x0 + 1) + pad * 2, h: toFull(y1 - y0 + 1) + pad * 2, width: ib.naturalWidth, height: Math.max(ia.naturalHeight, ib.naturalHeight) });
      })
      .catch(() => live && setRegion(undefined));
    return () => {
      live = false;
    };
  }, [a, b]);
  return region;
}

/** A screenshot cropped to a band around the changed region (whole width, so the context stays), with the change marked. */
function Cropped({ src, alt, region }: { src: string; alt: string; region: Region | undefined }) {
  if (!region) return <img src={src} alt={alt} loading="lazy" />;
  const top = Math.max(0, region.y - 60);
  const bandH = Math.min(region.height - top, Math.max(region.h + 120, 260));
  return (
    <div className="impact__crop" style={{ aspectRatio: `${region.width} / ${bandH}` }}>
      <img src={src} alt={alt} style={{ top: `${(-top / bandH) * 100}%`, height: `${(region.height / bandH) * 100}%` }} />
      <span className="impact__mark" style={{ left: `${(region.x / region.width) * 100}%`, width: `${(region.w / region.width) * 100}%`, top: `${((region.y - top) / bandH) * 100}%`, height: `${(region.h / bandH) * 100}%` }} aria-hidden="true" />
    </div>
  );
}
import { useResource, artifactUrl } from "../api";

type Impact = {
  changedFiles: string[];
  screens: Array<{ id: string; label: string; via: string[] }>;
  shared: Array<{ file: string; tokens: string[] }>;
  other: string[];
  totalScreens: number;
  shots?: { before?: Array<{ viewport: string; artifactId: string }>; after: Array<{ viewport: string; artifactId: string }> };
};

export function ChangeImpactPanel({ runId }: { runId: string }) {
  const res = useResource<Impact>(`/runs/${runId}/impact`, [runId], 20_000);
  const [vp, setVp] = useState<"desktop" | "mobile">("desktop");
  const d = res.data;
  const before = d?.shots?.before?.find((s) => s.viewport === vp);
  const after = d?.shots?.after.find((s) => s.viewport === vp);
  const region = useDiffRegion(before ? artifactUrl(before.artifactId) : undefined, after ? artifactUrl(after.artifactId) : undefined);
  if (!d || !d.changedFiles.length) return null;
  const all = d.shared.length > 0;
  const head = all
    ? `Affects every screen (shared styles)${d.screens.length ? `, and ${d.screens.length} directly` : ""}`
    : d.screens.length
      ? `Affects ${d.screens.length} of ${d.totalScreens} screen${d.totalScreens === 1 ? "" : "s"}`
      : "No screen traced to these changes";
  return (
    <section className="impact" data-cp="change-impact" aria-label="What this change affects">
      <h3 className="impact__head">{head}</h3>
      <ul className="impact__list">
        {d.screens.map((s) => (
          <li key={s.id}>
            <strong>{s.label}</strong> <span className="muted">via {s.via.map((v) => v.split("/").pop()).join(", ")}</span>
          </li>
        ))}
        {d.shared.map((s) => (
          <li key={s.file}>
            <strong>Shared styles</strong> <span className="muted">{s.file.split("/").pop()}</span>
            {s.tokens.length ? <span className="impact__tokens">{s.tokens.map((t) => <code key={t}>{t}</code>)}</span> : null}
          </li>
        ))}
        {d.other.length ? (
          <li>
            <strong>Not on a screen</strong> <span className="muted">{d.other.map((v) => v.split("/").pop()).join(", ")}</span>
          </li>
        ) : null}
      </ul>
      {after ? (
        <div className="impact__shots">
          <div className="impact__shots-bar">
            <span className="label">{region ? "Where the first screen changed" : region === null ? "First screen: no visible change" : "First screen, before and after"}</span>
            <div className="seg preview-devices" role="radiogroup" aria-label="Screenshot size">
              {(["desktop", "mobile"] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={vp === v} className={`seg__btn${vp === v ? " is-on" : ""}`} onClick={() => setVp(v)}>
                  {v === "desktop" ? "Desktop" : "Phone"}
                </button>
              ))}
            </div>
          </div>
          <div className={`impact__pair impact__pair--${vp}`}>
            <figure>
              {before ? <Cropped src={artifactUrl(before.artifactId)} alt="Before this change" region={region} /> : <div className="impact__none">No earlier screenshot</div>}
              <figcaption>Before</figcaption>
            </figure>
            <figure>
              <Cropped src={artifactUrl(after.artifactId)} alt="After this change" region={region} />
              <figcaption>After</figcaption>
            </figure>
          </div>
        </div>
      ) : null}
    </section>
  );
}
