/**
 * Requests pasted as Markdown documents (a PRD): show a title and a one-paragraph summary, and render the whole
 * document (headings, lists, rules) when expanded. Plain requests show as written.
 */
import { useState } from "react";
import { Markdown } from "./Markdown";

export const isMarkdownDoc = (t: string) => /^\s*#{1,3}\s/.test(t) || (t.length > 400 && /\n#{1,3}\s/.test(t));
const unmark = (t: string) => t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`>#]+/g, "").trim();
export const docTitle = (t: string) => unmark(t.split("\n").find((l) => /^\s*#{1,3}\s/.test(l)) ?? t.split("\n")[0]).replace(/^product requirements document:\s*/i, "") || "Request";
export function docSummary(t: string, max = 280): string {
  const para = t
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^#{1,6}\s/.test(p) && !/^(\*\*[^*]+:\*\*|---|[-*]\s)/.test(p) && p.length > 60);
  const text = unmark(para ?? "").replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max - 3)}…` : text;
}

/** Mostly code (CSS/JS/JSON): lots of braces, semicolons and declarations. */
const looksLikeCode = (t: string) => {
  const lines = t.split("\n");
  const codey = lines.filter((l) => /[{};]\s*$|^\s*(--[\w-]+:|[.#:@][\w-]|import |export |const |\}|\/\*|\*)/.test(l)).length;
  return lines.length > 6 && codey / lines.length > 0.4;
};

/** Compact request view for chat bubbles. */
export function RequestText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!isMarkdownDoc(text)) {
    const long = text.length > 600;
    const code = looksLikeCode(text);
    const shown = open || !long ? text : `${text.slice(0, 600)}…`;
    return (
      <div className="req-doc">
        {code ? (
          <pre className={`req-code${open ? " is-open" : ""}`} tabIndex={0} aria-label="Pasted code">
            <code>{shown}</code>
          </pre>
        ) : (
          <p style={{ whiteSpace: "pre-wrap" }}>{shown}</p>
        )}
        {long ? (
          <button type="button" className="link-btn req-doc__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Show less" : `Show full message (${text.length.toLocaleString()} characters)`}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="req-doc">
      <p className="req-doc__title">
        <strong>{docTitle(text)}</strong>
      </p>
      {open ? (
        <div className="req-doc__body">
          <Markdown source={text} />
        </div>
      ) : (
        <p className="req-doc__summary">{docSummary(text, 220)}</p>
      )}
      <button type="button" className="link-btn req-doc__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Show less" : "Show full document"}
      </button>
    </div>
  );
}
