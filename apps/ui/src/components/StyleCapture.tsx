/**
 * Styles → Capture a style (CSSVibes): point at a website, or attach screenshots, mockups, CSS or HTML, and FlowCode
 * captures their colors, fonts, corners and surface style onto this app's Styles page. It is one more Styles edit:
 * adjust it in Design, Tokens and Surface afterwards, or undo it.
 */
import { useState } from "react";
import { Paperclip, Wand2, X } from "lucide-react";
import { RobotHead, ROLE_COLOR } from "./RobotHead";
import { ConfirmDialog } from "./ConfirmDialog";
import { post, useResource } from "../api";
import { stylesChanged } from "./ComponentSheet";

interface CaptureFile {
  name: string;
  role: "image" | "html" | "css";
  content: string;
}
interface CaptureResult {
  at: string;
  sources: string[];
  applied: string[];
  notes: string[];
  /** Which source each captured value came from. */
  origins?: Array<{ what: string; value: string; from: string }>;
}

export const CAPTURE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.css,.html,.htm";
const MAX_FILE = 1_500_000;

/** Reads a picked file the way capture needs it: images as base64, CSS and HTML as text. */
export async function readCaptureFile(f: File): Promise<CaptureFile | string> {
  if (f.size > MAX_FILE) return `${f.name} is larger than 1.5 MB`;
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  if (/^(png|jpe?g|webp|gif)$/.test(ext)) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { name: f.name, role: "image", content: btoa(bin) };
  }
  if (ext === "css") return { name: f.name, role: "css", content: await f.text() };
  if (ext === "html" || ext === "htm") return { name: f.name, role: "html", content: await f.text() };
  return `${f.name} isn't an image, CSS or HTML file`;
}

export function StyleCapture({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const vision = useResource<{ model: string | null; vision: boolean }>(`/models/critic-vision?projectId=${encodeURIComponent(projectId)}`, [projectId]);
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<CaptureFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<CaptureResult>();
  // Capturing restyles the whole app, so it asks first.
  const [confirming, setConfirming] = useState(false);

  const pick = async (list: FileList | null) => {
    setError(undefined);
    const read = await Promise.all([...(list ?? [])].slice(0, 8).map(readCaptureFile));
    const bad = read.filter((r): r is string => typeof r === "string");
    if (bad.length) setError(bad.join(". "));
    setFiles((cur) => [...cur, ...read.filter((r): r is CaptureFile => typeof r !== "string")].slice(0, 8));
  };
  const capture = async () => {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const r = await post<CaptureResult>(`/projects/${projectId}/design/capture`, { url: url.trim() || undefined, files });
      setResult(r);
      if (r.applied.length) stylesChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="capture" aria-label="Capture a style">
      <div className="capture__head">
        <button type="button" className="btn btn--ghost btn--sm capture__close" onClick={onClose} aria-label="Close capture">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {/* One description: exact styles from a website, CSS or HTML; from images, colors from the pixels and the rest
          read by the Visual critic (inline, with its robot head), or colors only when its model can't see. */}
      <div className="capture__intro">
        <span className="capture__bot" title="The Visual critic agent reads fonts, corners and surface style from images">
          <RobotHead color={ROLE_COLOR.critic!} id="capture-critic" size={44} />
          <span className="capture__bot-name">Visual critic</span>
        </span>
      <div className="capture__text">
      <span className="capture__title">
        <Wand2 size={15} aria-hidden="true" /> Capture a style
      </span>
      <p className="capture__lede">
        Point at a website, or attach screenshots, mockups, CSS or HTML. From a website, CSS or HTML, FlowCode reads the exact colors, fonts, corners and surface style. From images, colors are sampled from the pixels; fonts, corners and surface style are read by the{" "}
Visual critic
        {vision.data?.model ? <span className="capture__model"> ({vision.data.model})</span> : null}
        {vision.data && !vision.data.vision ? (
          <span className="capture__warn">
            , but its model can&apos;t see images, so an image gives you its colors only (give it a vision model in <a href="#/system/models">Models &amp; capability lab</a>)
          </span>
        ) : null}
        . You can change any of it here afterwards, or undo it.
      </p>
      </div>
      </div>
      <div className="capture__row">
        <label className="capture__field">
          <span className="label">Website</span>
          <input className="input" data-cp="capture-url" type="url" inputMode="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="btn capture__files">
          <Paperclip size={15} aria-hidden="true" /> Attach files
          <input type="file" multiple accept={CAPTURE_ACCEPT} onChange={(e) => void pick(e.target.files)} hidden />
        </label>
        <button type="button" className="btn btn--primary" data-cp="capture-go" disabled={busy || (!url.trim() && !files.length)} onClick={() => setConfirming(true)}>
          {busy ? "Capturing…" : "Capture"}
        </button>
      </div>
      {confirming ? (
        <ConfirmDialog
          title="Restyle every page?"
          confirmLabel="Capture and apply"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void capture();
          }}
        >
          <p>
            Capture a style replaces this project&apos;s colors, fonts, corners and surface style, so <strong>every page</strong> takes on the new look, not just one.
          </p>
          <p>You can change any of it afterwards on the Design tab, or undo it.</p>
          <p className="muted">
            Want a different look on one page only? Don&apos;t capture: ask for that page in the chat and attach the screenshot or mockup there instead.
          </p>
        </ConfirmDialog>
      ) : null}
      {files.length ? (
        <ul className="capture__chips" aria-label="Attached files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="capture__chip">
              {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {busy ? <p className="capture__status" role="status">Reading {[url.trim() ? "the website" : "", files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ")}. Images and websites take a few seconds.</p> : null}
      {error ? (
        <p className="capture__status capture__status--bad" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="capture__result" role="status">
          <strong>{result.applied.length ? `Applied ${result.applied.join("; ")}.` : "Nothing could be applied."}</strong>
          {result.sources.length ? <span className="muted"> From {result.sources.join(", ")}.</span> : null}
          {result.notes.map((n) => (
            <span key={n} className="capture__note">
              {n}
            </span>
          ))}
          {result.origins?.length ? (
            <details className="capture__origins">
              <summary>Where each part of the style came from</summary>
              <table>
                <tbody>
                  {result.origins.map((o) => (
                    <tr key={`${o.what}-${o.value}`}>
                      <th scope="row">{o.what}</th>
                      <td>
                        {/^#[0-9a-f]{6}$/i.test(o.value) ? <span className="capture__swatch" style={{ background: o.value }} aria-hidden="true" /> : null}
                        <span className="mono">{o.value}</span>
                      </td>
                      <td className="muted">{o.from}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
