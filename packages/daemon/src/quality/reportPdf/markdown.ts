/**
 * The Markdown subset the repo reports write, converted to HTML for the PDF (ported from FlowMap's FlowReport
 * pipeline). The PDF is rendered from the report's own Markdown rather than from the report object, so the PDF cannot
 * claim a different count from the .md: there is no second path through which a number could be computed differently.
 */

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline marks. Code spans are lifted out first (behind a control-character placeholder) so `**` inside one is left alone. */
function inline(s: string): string {
  const code: string[] = [];
  // A plain " 3 " placeholder would collide with numbers in the prose ("found 3 files"), so the marker is \u0000.
  let t = s.replace(/`([^`]+)`/g, (_m, c: string) => `\u0000${code.push(`<code>${esc(c)}</code>`) - 1}\u0000`);
  t = esc(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Underscore emphasis is deliberately not supported: an identifier like snake_case outside a code span would break up.
  t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => code[Number(i)] ?? "");
}

const cells = (row: string): string[] =>
  row
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

/** Escapes text for a Markdown table cell: pipes escaped, newlines flattened. */
export const mdCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export function markdownToHtml(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (/^```/.test(ln)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      // Marked long when it cannot fit on one page, so the PDF lets it break instead of leaving a page white.
      out.push(`<pre class="prompt${body.length > 40 ? " long" : ""}">${esc(body.join("\n"))}</pre>`);
      continue;
    }
    if (/^---\s*$/.test(ln)) {
      out.push("<hr/>");
      i += 1;
      continue;
    }
    if (/^>\s?/.test(ln)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      // A blank line inside a quote starts a new paragraph, as Markdown means it to.
      const paras = quote.reduce<string[][]>(
        (acc, q) => {
          if (q.trim() === "") {
            if (acc[acc.length - 1].length > 0) acc.push([]);
          } else acc[acc.length - 1].push(q);
          return acc;
        },
        [[]],
      );
      const body = paras
        .filter((p) => p.length > 0)
        .map((p) => `<p>${inline(p.join(" "))}</p>`)
        .join("");
      out.push(`<blockquote>${body || "<p></p>"}</blockquote>`);
      continue;
    }
    const h = ln.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i += 1;
      continue;
    }
    if (/^\|/.test(ln) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? "")) {
      const head = cells(ln);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<table class="cols-${head.length}"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const ordered = /^\d+\.\s+/.test(ln);
    if (ordered || /^[-*]\s+/.test(ln)) {
      const tag = ordered ? "ol" : "ul";
      const re = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) {
        let text = inline(lines[i++].replace(/^(\d+\.|[-*])\s+/, ""));
        // Items indented under the one above belong to it (one level is all the reports write).
        const sub: string[] = [];
        while (i < lines.length && /^[ \t]+([-*]|\d+\.)\s+/.test(lines[i])) sub.push(inline(lines[i++].replace(/^[ \t]+(\d+\.|[-*])\s+/, "")));
        if (sub.length) text += `<ul>${sub.map((x) => `<li>${x}</li>`).join("")}</ul>`;
        items.push(text);
      }
      out.push(`<${tag}>${items.map((t) => `<li>${t}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (!ln.trim()) {
      i += 1;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\||```|---\s*$|[-*]\s|\d+\.\s|>)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

/**
 * Cuts the document at its `## ` headings. Fenced blocks are skipped rather than searched, so a prompt containing a
 * line that looks like a heading cannot cut the document in the wrong place. This is what lets each section become
 * its own two-column block with a divider page in front of it.
 */
export function splitByH2(markdown: string): Array<{ title: string; body: string }> {
  const parts: Array<{ title: string; body: string }> = [];
  let current: { title: string; body: string[] } | undefined;
  let fenced = false;
  for (const ln of markdown.split("\n")) {
    if (/^```/.test(ln)) fenced = !fenced;
    const h = !fenced && ln.match(/^##\s+(.*)$/);
    if (h) {
      if (current) parts.push({ title: current.title, body: current.body.join("\n") });
      current = { title: h[1].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(ln);
  }
  if (current) parts.push({ title: current.title, body: current.body.join("\n") });
  return parts;
}

/** A GitHub-style heading anchor, so the Markdown contents list jumps in any viewer. */
export const anchor = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s/g, "-");
