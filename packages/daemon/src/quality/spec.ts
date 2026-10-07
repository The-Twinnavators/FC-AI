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
}

/** Extracts requirement-like lines from a Markdown PRD: list items and must/should/shall sentences. */
export function extractRequirements(md: string, max = 120): Requirement[] {
  const out: Requirement[] = [];
  let section = "";
  let inCode = false;
  // Requirement tables (| ID | Requirement | Priority |): one requirement per row. Calculator test 1: the PRD's F1–F12
  // and its non-functional requirements were tables, which were skipped, so the plan never had its core features.
  let header: string[] | undefined;
  // A layout drawn in a code block (box-drawing characters) is a requirement too: the Calculator PRD's keypad order
  // lived only in one, so the plan never had it and the keys came out in the wrong order.
  let block: string[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      if (inCode && block.some((l) => /[┌┐└┘│├┤┬┴─]|\+-{2,}\+/.test(l)))
        out.push({ id: `R${out.length + 1}`, text: `Layout drawn in the PRD (follow it exactly: order, grouping and positions):\n${block.join("\n").slice(0, 1200)}`, section, code: [] });
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
      if (text) out.push({ id: `R${out.length + 1}`, text: text.slice(0, 300), section, code: [] });
      if (out.length >= max) break;
      continue;
    }
    header = undefined;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      section = h[1].replace(/[*_`]/g, "").trim();
      continue;
    }
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)?.[1];
    const normative = /\b(must|should|shall|required|needs? to|has to)\b/i.test(line);
    const source = item ?? (normative ? line : "");
    const code = [...source.matchAll(/`([^`\n]{2,60})`/g)].map((m) => m[1].trim());
    const text = source.replace(/\*\*|__|`/g, "").trim();
    if (text.length >= 8 && !/^\|/.test(text)) out.push({ id: `R${out.length + 1}`, text: text.slice(0, 300), section, code });
    if (out.length >= max) break;
  }
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
