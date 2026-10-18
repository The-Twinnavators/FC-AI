/**
 * Spec references (§5.1 "optional references", FR-V2 "every requirement maps to evidence").
 * - HTML: an inventory of what must survive the build — visible words, links and form fields.
 * - PRD (Markdown): requirement lines extracted for planning and traceability.
 * - CSS / JSON: summaries for the planner.
 * - Fidelity: compares the built app's rendered DOM against the HTML inventory and lists losses.
 */
import { parse as parseHtml, type DefaultTreeAdapterMap } from "parse5";
import type { ReferenceFile } from "@flowcode/contracts";

type El = DefaultTreeAdapterMap["element"];
type Node = DefaultTreeAdapterMap["childNode"];

export interface HtmlInventory {
  title: string;
  headings: string[];
  words: string[];
  links: Array<{ href: string; text: string }>;
  fields: Array<{ name: string; type: string; label: string }>;
}

const SKIP = new Set(["script", "style", "noscript", "template", "svg", "head"]);

export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function wordsOf(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length > 0);
}

export function analyzeHtml(html: string): HtmlInventory {
  const doc = parseHtml(html);
  const texts: string[] = [];
  const headings: string[] = [];
  const links: HtmlInventory["links"] = [];
  const fields: HtmlInventory["fields"] = [];
  const labels = new Map<string, string>();
  let title = "";
  const textOf = (n: Node): string => {
    if (n.nodeName === "#text") return (n as DefaultTreeAdapterMap["textNode"]).value;
    if ((n as El).childNodes && !SKIP.has(n.nodeName)) return (n as El).childNodes.map(textOf).join(" ");
    return "";
  };
  const attr = (e: El, name: string) => e.attrs.find((a) => a.name === name)?.value;
  const walk = (n: Node, inHead = false) => {
    if (n.nodeName === "title") title = textOf({ ...(n as El), nodeName: "div" } as El).trim();
    if (n.nodeName === "#text" && !inHead) texts.push((n as DefaultTreeAdapterMap["textNode"]).value);
    const e = n as El;
    if (!e.tagName) {
      for (const c of (n as El).childNodes ?? []) walk(c, inHead);
      return;
    }
    if (SKIP.has(e.tagName) && e.tagName !== "head") return;
    if (/^h[1-6]$/.test(e.tagName)) headings.push(textOf(e).replace(/\s+/g, " ").trim());
    if (e.tagName === "a" && attr(e, "href")) links.push({ href: attr(e, "href")!, text: textOf(e).replace(/\s+/g, " ").trim() });
    if (e.tagName === "label") {
      const forId = attr(e, "for");
      if (forId) labels.set(forId, textOf(e).replace(/\s+/g, " ").trim());
    }
    if (["input", "select", "textarea", "button"].includes(e.tagName)) {
      const type = e.tagName === "input" ? (attr(e, "type") ?? "text") : e.tagName;
      if (type !== "hidden" && !(e.tagName === "button" && !attr(e, "name"))) {
        fields.push({ name: attr(e, "name") ?? attr(e, "id") ?? "", type, label: attr(e, "aria-label") ?? attr(e, "placeholder") ?? (attr(e, "id") ? `#${attr(e, "id")}` : "") });
      }
      const ph = attr(e, "placeholder");
      if (ph && !inHead) texts.push(ph);
      if (e.tagName === "input" && (type === "submit" || type === "button") && attr(e, "value")) texts.push(attr(e, "value")!);
    }
    for (const c of e.childNodes ?? []) walk(c, inHead || e.tagName === "head");
    if (e.tagName === "template") {
      const content = (e as unknown as { content?: El }).content;
      for (const c of content?.childNodes ?? []) walk(c, inHead);
    }
  };
  for (const c of doc.childNodes) walk(c);
  for (const f of fields) if (f.label.startsWith("#") && labels.has(f.label.slice(1))) f.label = labels.get(f.label.slice(1))!;
  return { title, headings, words: wordsOf(texts.join(" ")), links, fields };
}

export interface Requirement {
  id: string;
  text: string;
  section: string;
  /** Backticked identifiers in the requirement (keys, file names, routes): concrete evidence to look for. */
  code: string[];
  /** Where it is in the PRD: its first line (1-based) and the headings above it. */
  source?: { line: number; path: string[] };
  /** The lead-in a list item belongs to ("Keep one shared source of truth for:"), so the item keeps its meaning. */
  context?: string;
}

/** A requirement as planners and steps read it: with its lead-in when it has one. */
export const requirementText = (r: Pick<Requirement, "text" | "context">) => (r.context ? `${r.context.replace(/:\s*$/, "")}: ${r.text}` : r.text);

/**
 * A paragraph line that says what the product must do, show, keep or not do: an obligation, a limit, an exception or a
 * prohibition (Frameproof: "Each photo can have an optional editing note of up to 300 characters.", "Do not wrap:
 * disable Previous on photo-01 and Next on photo-12.", "If saved data cannot be read, recover to a usable Draft state…"
 * were paragraphs, and only list items and must/should sentences were extracted, so 51 such lines never reached the plan).
 */
const SUBSTANTIVE = /\b(must|should|shall|required|needs? to|has to|may|can|cannot|do not|don't|does not|never|avoid|no|not|only|exactly|at (least|most)|up to|maximum|minimum|limit|unless|except|if|when|before|after|until|while|regardless|each|every|all|any|initial|default)\b|\b(display|show|provide|use|keep|open|close|return|disable|enable|lock|unlock|recover|record|preserve|survive|persist|save|store|follow|match|contain|include|exclude|allow|permit|prevent|support|work|explain|offer|select|choose|add|remove|clear|reset|submit|confirm|cancel|restore|respect|test|check|verify|review|browse|set|sort|filter|search|find|load|link|navigate|appear)(s|es|ed|d|ing)?\b|\d|^[A-Z][\w\s/-]{2,40}:\s+\S/i;
/** A line that only introduces the list or table after it ("Accessibility:", "Use these exact records:"). */
const LEAD_IN = /:\s*$/;

/**
 * Extracts the PRD's requirements: list items, table rows, drawn layouts, and paragraph lines that say what the product
 * must do (each line whole, as the author wrote it, so a sentence keeps the one beside it: "With fewer than five, explain
 * how many more are needed. Mouse or keyboard interaction must not submit."). Each keeps its source line and headings,
 * and a list item keeps the lead-in it belongs to. The same requirement as a paragraph or as a bullet is extracted alike.
 */
export function extractRequirements(md: string, max = 120): Requirement[] {
  const out: Requirement[] = [];
  let section = "";
  let inCode = false;
  const path: Array<{ level: number; text: string }> = [];
  let lead: string | undefined;
  let lineNo = 0;
  const src = () => ({ line: lineNo, path: path.map((p) => p.text) });
  // Requirement tables (| ID | Requirement | Priority |): one requirement per row. Calculator test 1: the PRD's F1–F12
  // and its non-functional requirements were tables, which were skipped, so the plan never had its core features.
  let header: string[] | undefined;
  // A layout drawn in a code block (box-drawing characters) is a requirement too: the Calculator PRD's keypad order
  // lived only in one, so the plan never had it and the keys came out in the wrong order.
  let block: string[] = [];
  for (const { raw, line: at } of logicalLines(md)) {
    lineNo = at;
    const line = raw.trim();
    if (line.startsWith("```")) {
      if (inCode && block.some((l) => /[┌┐└┘│├┤┬┴─]|\+-{2,}\+/.test(l)))
        out.push({ id: `R${out.length + 1}`, text: `Layout drawn in the PRD (follow it exactly: order, grouping and positions):\n${block.join("\n").slice(0, 1200)}`, section, code: [], source: src() });
      inCode = !inCode;
      block = [];
      continue;
    }
    if (inCode) {
      block.push(raw.replace(/\s+$/, ""));
      continue;
    }
    if (inCode || !line) {
      header = undefined;
      continue;
    }
    if (line.startsWith("|")) {
      const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.replace(/\*\*|__|`/g, "").replace(/\\([<>|])/g, "$1").trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (!header) {
        header = cells.map((c) => c.toLowerCase());
        continue;
      }
      const text = tableRequirement(header, cells);
      if (text) out.push({ id: `R${out.length + 1}`, text: text.slice(0, 300), section, code: [], source: src() });
      if (out.length >= max) break;
      continue;
    }
    header = undefined;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      section = h[2]!.replace(/[*_`]/g, "").trim();
      while (path.length && path.at(-1)!.level >= h[1]!.length) path.pop();
      path.push({ level: h[1]!.length, text: section });
      lead = undefined;
      continue;
    }
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)?.[1];
    const clean = (s: string) => s.replace(/\*\*|__|`/g, "").trim();
    const code = [...(item ?? line).matchAll(/`([^`\n]{2,60})`/g)].map((m) => m[1].trim());
    if (item !== undefined) {
      const text = clean(item);
      if (text.length >= 8) out.push({ id: `R${out.length + 1}`, text: text.slice(0, 600), section, code, source: src(), ...(lead ? { context: lead } : {}) });
    } else if (LEAD_IN.test(line)) {
      // A lead-in gives its list its meaning; it is a requirement of its own only when it says something ("exactly two").
      lead = clean(line);
      if (lead.length >= 25 && /\b(must|should|shall|exactly|only|never|do not|don't|no|at (least|most)|maximum|minimum)\b|\d/i.test(lead.replace(/:$/, ""))) out.push({ id: `R${out.length + 1}`, text: lead.slice(0, 600), section, code, source: src() });
    } else {
      lead = undefined;
      const text = clean(line);
      // A paragraph line that says what the product must do, kept whole; a very long one in sentence groups.
      if (text.length >= 8 && SUBSTANTIVE.test(text)) for (const part of groups(text, 600)) out.push({ id: `R${out.length + 1}`, text: part, section, code, source: src() });
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

/**
 * The PRD's lines with hard-wrapped sentences joined: a paragraph or list line that ends mid-sentence continues on the
 * next plain line ("…carried by at" / "least one of them."). Each keeps the number of its first line. Code blocks,
 * headings, tables and blank lines are never joined.
 */
export function logicalLines(md: string): Array<{ raw: string; line: number }> {
  const out: Array<{ raw: string; line: number; end: number; inCode: boolean }> = [];
  let inCode = false;
  md.split(/\r?\n/).forEach((raw, i) => {
    const t = raw.trim();
    if (t.startsWith("```")) inCode = !inCode;
    const prev = out.at(-1);
    const plain = !inCode && t && !t.startsWith("```") && !/^(#{1,6}\s|\||(?:[-*+]|\d+[.)])\s)/.test(t);
    const open = prev && !prev.inCode && prev.raw.trim() && !/^(#{1,6}\s|\|)/.test(prev.raw.trim()) && !/[.!?:;)\]"”]$/.test(prev.raw.trim());
    if (plain && open && i === prev!.end + 1) {
      prev!.raw = `${prev!.raw.trimEnd()} ${t}`;
      prev!.end = i;
      return;
    }
    out.push({ raw, line: i + 1, end: i, inCode });
  });
  return out.map(({ raw, line }) => ({ raw, line }));
}

/** A long line in whole sentences of at most `max` characters together (never a sentence cut in half). */
function groups(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if (cur && cur.length + s.length + 1 > max) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * One table row as a requirement line: "F1: Addition, subtraction… (Must)" from an ID / Requirement / Priority table,
 * or "Accessibility: WCAG 2.2 AA…" from a two-column table (first column as the label). Rows too short to be a
 * requirement are skipped.
 */
function tableRequirement(header: string[], cells: string[]): string | undefined {
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const id = col(/^(id|#|ref|req(uirement)? ?id|no\.?)$/);
  const priority = col(/^(priority|moscow|importance|must\/should)$/);
  const named = col(/requirement|feature|description|capability|behaviou?r|criteria|need|choice|rule|target/);
  const others = cells.map((_, i) => i).filter((i) => i !== id && i !== priority);
  const textCol = named >= 0 && named !== id ? named : others.sort((a, b) => (cells[b]?.length ?? 0) - (cells[a]?.length ?? 0))[0];
  const text = textCol === undefined ? "" : cells[textCol] ?? "";
  if (text.length < 8) return undefined;
  const label = id >= 0 ? cells[id] : others.length > 1 && others[0] !== textCol ? cells[others[0]] : "";
  const prio = priority >= 0 && cells[priority] ? ` (${cells[priority]})` : "";
  return `${label ? `${label}: ` : ""}${text}${prio}`;
}

export function summarizeCss(css: string): string {
  const vars = [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
  const selectors = (css.match(/\{/g) ?? []).length;
  const colors = new Set((css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? []).map((c) => c.toLowerCase()));
  const fonts = [...new Set([...css.matchAll(/font-family\s*:\s*([^;]+);/g)].map((m) => m[1].trim()))].slice(0, 4);
  const media = [...new Set([...css.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim()))].slice(0, 6);
  return `${selectors} rules, ${vars.length} custom properties${vars.length ? ` (${vars.slice(0, 12).join(", ")}${vars.length > 12 ? ", …" : ""})` : ""}, ${colors.size} distinct colors, fonts: ${fonts.join(" | ") || "inherited"}, media: ${media.join(" | ") || "none"}`;
}

export function summarizeJson(json: string): string {
  try {
    const v = JSON.parse(json) as unknown;
    const describe = (x: unknown, depth: number): string => {
      if (Array.isArray(x)) return `array(${x.length})${x.length && depth < 2 ? ` of ${describe(x[0], depth + 1)}` : ""}`;
      if (x && typeof x === "object") {
        const keys = Object.keys(x as object);
        return depth < 2 ? `{ ${keys.slice(0, 14).map((k) => `${k}: ${describe((x as Record<string, unknown>)[k], depth + 1)}`).join(", ")}${keys.length > 14 ? ", …" : ""} }` : `object(${keys.length} keys)`;
      }
      return typeof x;
    };
    return describe(v, 0);
  } catch (e) {
    return `invalid JSON: ${(e as Error).message}`;
  }
}

/** Where each reference is placed in the workspace. JSON content goes where the app can import it. */
export function referencePath(ref: ReferenceFile): string {
  const safe = ref.name
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 80) || "reference";
  if (ref.role === "json") return `src/content/${safe.endsWith(".json") ? safe : `${safe}.json`}`;
  return `spec/${safe}`;
}

export function summarizeReference(ref: ReferenceFile): string {
  switch (ref.role) {
    case "html": {
      const inv = analyzeHtml(ref.content);
      return `HTML page "${inv.title || ref.name}": ${inv.words.length} words, ${inv.links.length} links, ${inv.fields.length} form fields; headings: ${inv.headings.slice(0, 10).join(" / ") || "none"}`;
    }
    case "css":
      return `Stylesheet: ${summarizeCss(ref.content)}`;
    case "json":
      return `JSON content: ${summarizeJson(ref.content)}`;
    case "prd":
      return `PRD with ${extractRequirements(ref.content).length} requirement lines`;
    default:
      return `Text, ${ref.content.length} characters`;
  }
}

export interface FidelityResult {
  wordCoverage: number;
  missingWords: string[];
  missingLinks: Array<{ href: string; text: string }>;
  missingFields: Array<{ name: string; type: string; label: string }>;
  totals: { words: number; links: number; fields: number };
}

/**
 * Compares the reference inventory with the built app's rendered DOM. Words are compared as a
 * multiset so repeated words must be preserved as often as they appear.
 */
export function compareFidelity(reference: HtmlInventory, rendered: HtmlInventory): FidelityResult {
  const have = new Map<string, number>();
  for (const w of rendered.words) have.set(w, (have.get(w) ?? 0) + 1);
  const missing: string[] = [];
  for (const w of reference.words) {
    const n = have.get(w) ?? 0;
    if (n > 0) have.set(w, n - 1);
    else missing.push(w);
  }
  const normHref = (h: string) => h.trim().replace(/\/$/, "").toLowerCase();
  const renderedHrefs = new Set(rendered.links.map((l) => normHref(l.href)));
  const missingLinks = reference.links.filter((l) => !/^#/.test(l.href) && !renderedHrefs.has(normHref(l.href)));
  const fieldKey = (f: { name: string; type: string; label: string }) => (f.name || f.label).toLowerCase();
  const renderedFields = new Set(rendered.fields.flatMap((f) => [f.name.toLowerCase(), f.label.toLowerCase()]).filter(Boolean));
  const missingFields = reference.fields.filter((f) => fieldKey(f) && !renderedFields.has(fieldKey(f)) && !renderedFields.has(f.label.toLowerCase()));
  return {
    wordCoverage: reference.words.length ? (reference.words.length - missing.length) / reference.words.length : 1,
    missingWords: [...new Set(missing)].slice(0, 200),
    missingLinks,
    missingFields,
    totals: { words: reference.words.length, links: reference.links.length, fields: reference.fields.length },
  };
}
