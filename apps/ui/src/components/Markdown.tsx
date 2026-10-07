/**
 * Safe Markdown renderer for reports: builds React elements (never innerHTML), so report content
 * cannot inject markup.
 */
import type { ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) out.push(<code key={`${key}-${i++}`}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={`${key}-${i++}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const l = lines[i];
    const key = `b${k++}`;
    if (l.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (/^\|.*\|$/.test(l) && /^\|[-| ]+\|$/.test(lines[i + 1] ?? "")) {
      const cells = (r: string) => r.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={key} style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>{head.map((h, j) => <th key={j}>{inline(h, `${key}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `${key}${ri}${ci}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) {
      blocks.push(<hr key={key} />);
      i++;
      continue;
    }
    if (/^\s*\d+[.)]\s/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s/, ""));
      blocks.push(
        <ol key={key}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${key}${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const level = Math.min(h[1].length + 1, 5);
      const Tag = `h${level}` as "h2";
      blocks.push(<Tag key={key}>{inline(h[2], key)}</Tag>);
    } else if (/^\s*- /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*- /.test(lines[i])) items.push(lines[i++].replace(/^\s*- /, ""));
      blocks.push(
        <ul key={key}>
          {items.map((it, j) => {
            const box = /^\[( |x)\] /.exec(it);
            return (
              <li key={j}>
                {box ? <span aria-label={box[1] === "x" ? "met" : "not met"}>{box[1] === "x" ? "☑ " : "☐ "}</span> : null}
                {inline(box ? it.slice(4) : it, `${key}${j}`)}
              </li>
            );
          })}
        </ul>,
      );
      continue;
    } else if (l.startsWith("> ")) blocks.push(<blockquote key={key}>{inline(l.slice(2), key)}</blockquote>);
    else if (l.trim()) blocks.push(<p key={key}>{inline(l, key)}</p>);
    i++;
  }
  return <div className="markdown">{blocks}</div>;
}
