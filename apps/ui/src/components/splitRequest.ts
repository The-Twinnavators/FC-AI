/**
 * The separate changes in a request written as a numbered or bulleted list (D5). Two or more items of real length are
 * needed; the lines before the list (e.g. "Two fixes, change nothing else:") go with each item as context.
 */
export function splitRequest(message: string): string[] {
  const lines = message.split(/\r?\n/);
  const items: string[] = [];
  const intro: string[] = [];
  for (const line of lines) {
    const m = /^\s*(?:\d+[.)]|[-*•])\s+(.+)$/.exec(line);
    if (m) items.push(m[1]!.trim());
    else if (items.length && line.trim()) items[items.length - 1] += `\n${line.trim()}`;
    else if (!items.length && line.trim()) intro.push(line.trim());
  }
  if (items.length < 2 || items.some((x) => x.length < 8)) return [];
  const context = intro.join(" ").slice(0, 300);
  return items.map((x) => (context ? `${x}\n\nFrom a larger request: ${context}` : x));
}
