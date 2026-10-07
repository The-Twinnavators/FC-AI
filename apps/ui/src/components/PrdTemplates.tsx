/**
 * Settings → PRD templates: pick a template for the kind of project, fill it in here (the draft is kept in this
 * browser), then copy it, download it as Markdown, or start a new build with it attached as the PRD.
 * The headings are numbered so FlowCode's plans can cite them.
 */
import { useEffect, useState } from "react";
import { PRD_TEMPLATES, prdTemplate } from "@flowcode/contracts";
import { Check, Copy, Download, Eye, PencilLine, RotateCcw, Rocket } from "lucide-react";
import { navigate } from "../router";
import { Markdown } from "./Markdown";

const draftKey = (id: string) => `fc.prdDraft.${id}`;
/** New build picks this up once and attaches it as the PRD. */
export const NEW_BUILD_PRD_KEY = "fc.newbuild.prd";

const readDraft = (id: string) => {
  try {
    return localStorage.getItem(draftKey(id));
  } catch {
    return null;
  }
};

export function PrdTemplates() {
  const [id, setId] = useState(PRD_TEMPLATES[0].id);
  const [text, setText] = useState(() => readDraft(PRD_TEMPLATES[0].id) ?? prdTemplate(PRD_TEMPLATES[0].id));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);
  const template = PRD_TEMPLATES.find((t) => t.id === id)!;
  const edited = text !== prdTemplate(id);

  // Keep the draft as it's typed (per template, in this browser only).
  useEffect(() => {
    try {
      if (edited) localStorage.setItem(draftKey(id), text);
      else localStorage.removeItem(draftKey(id));
    } catch {
      /* storage unavailable */
    }
  }, [id, text, edited]);

  const pick = (next: string) => {
    setId(next);
    setText(readDraft(next) ?? prdTemplate(next));
  };
  const fileName = () => {
    const h = /^#\s+(?:[^:]+:\s*)?(.+)$/m.exec(text)?.[1]?.replace(/[[\]]/g, "").trim() ?? "";
    const slug = h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    return `${slug && !/name$/.test(slug) ? slug : `${template.id}`}-prd.md`;
  };
  const copy = () =>
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const startBuild = () => {
    try {
      sessionStorage.setItem(NEW_BUILD_PRD_KEY, JSON.stringify({ name: fileName(), content: text }));
    } catch {
      /* storage unavailable: New build just won't have it attached */
    }
    navigate("/");
    setTimeout(() => window.dispatchEvent(new CustomEvent("fc:new-build")), 300);
  };
  const placeholders = (text.match(/\[[^\]\n]{2,80}\]/g) ?? []).filter((p) => !/^\[ ?\]$/.test(p)).length;

  return (
    <section className="section" aria-labelledby="prd-templates-title">
      <div className="section__head">
        <h2 className="section__title" id="prd-templates-title">
          PRD templates
        </h2>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
          Numbered headings, so plans can cite sections
        </span>
      </div>
      <div className="section__body prdt">
        <div className="prdt__kinds" data-cp="prdt-kinds" role="radiogroup" aria-label="Kind of project">
          {PRD_TEMPLATES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={id === t.id} className="prdt__kind" onClick={() => pick(t.id)}>
              <strong>{t.label}</strong>
              <span>{t.description}</span>
              {readDraft(t.id) ? <span className="prdt__draft">Draft saved</span> : null}
            </button>
          ))}
        </div>

        <div className="prdt__bar">
          <div className="styles-views" role="tablist" aria-label="Template view">
            <button type="button" role="tab" aria-selected={mode === "edit"} className="styles-views__btn" onClick={() => setMode("edit")}>
              <PencilLine size={14} aria-hidden="true" /> Fill in
            </button>
            <button type="button" role="tab" aria-selected={mode === "preview"} className="styles-views__btn" onClick={() => setMode("preview")}>
              <Eye size={14} aria-hidden="true" /> Preview
            </button>
          </div>
          <span className="muted prdt__left">{placeholders ? `${placeholders} placeholder${placeholders === 1 ? "" : "s"} left to fill in` : "No placeholders left"}</span>
          <button type="button" className="btn btn--sm" onClick={copy}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="btn btn--sm" onClick={download}>
            <Download size={14} aria-hidden="true" /> Download .md
          </button>
          {edited ? (
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setText(prdTemplate(id))} title="Discard your changes to this template">
              <RotateCcw size={14} aria-hidden="true" /> Start over
            </button>
          ) : null}
          <button type="button" className="btn btn--sm btn--primary" data-cp="prdt-build" onClick={startBuild} title="Opens New build with this PRD attached">
            <Rocket size={14} aria-hidden="true" /> Start a prototype with it
          </button>
        </div>

        {mode === "edit" ? (
          <>
            <label className="sr-only" htmlFor="prdt-text">
              {template.label} PRD
            </label>
            <textarea id="prdt-text" className="textarea mono prdt__text" value={text} onChange={(e) => setText(e.target.value)} spellCheck />
            <p className="muted prdt__hint">Replace each [placeholder]. Delete sections that don&apos;t apply rather than leaving them empty. Your draft stays in this browser until you start over.</p>
          </>
        ) : (
          <div className="prdt__preview">
            <Markdown source={text} />
          </div>
        )}
      </div>
    </section>
  );
}
