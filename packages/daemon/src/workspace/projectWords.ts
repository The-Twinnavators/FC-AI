/**
 * The project's own words for the Components sheet. The starter kit's samples were written around a calendar
 * ("Your week at a glance", "New event"); this reads the project's PRD (spec/*.md, FlowCode's PRD format) or, without
 * one, its screen names, and swaps the calendar wording for the app's: its main thing ("brand"), the list it shows,
 * its promise, screens and features. No model call: plain text from files already in the project.
 */
import fs from "node:fs";
import path from "node:path";

export interface ProjectWords {
  /** The main thing the app deals with, singular and plural: "brand", "brands". */
  noun: string;
  plural: string;
  /** What the main list is called: "Trusted non-GMO brands". */
  listTitle: string;
  /** One sentence about what the app does for people. */
  tagline?: string;
  /** Screen names without "Screen": "Home", "Brand detail". */
  screens: string[];
  /** Short feature names from the requirements: "Filter brands by category". */
  features: string[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Lower-cases only the first letter, so names like "non-GMO" keep their capitals mid-sentence. */
const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);
const singular = (w: string) => (/ies$/i.test(w) ? w.replace(/ies$/i, "y") : /(ss|us)$/i.test(w) ? w : w.replace(/s$/i, ""));
const pluralOf = (w: string) => (/[^aeiou]y$/i.test(w) ? w.replace(/y$/i, "ies") : /(s|x|ch|sh)$/i.test(w) ? `${w}es` : `${w}s`);

/** A section of a FlowCode PRD by its heading words ("Product promise"), without the numbering. */
function section(md: string, name: string): string {
  const m = new RegExp(`^##\\s*(?:\\d+\\.\\s*)?${name}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "mi").exec(md);
  return m ? m[1].trim() : "";
}
const firstSentence = (text: string) => (text.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^[-|*_#]/.test(p)) ?? "").split(/(?<=[.!?])\s/)[0]?.trim() ?? "";
/** Screen names: "Brand Detail Screen" → "Brand detail". */
const screenName = (s: string) => cap(s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\bscreen\b/i, "").replace(/\s+/g, " ").trim().toLowerCase());

export function readProjectWords(root: string): ProjectWords | undefined {
  let prd = "";
  try {
    const dir = path.join(root, "spec");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const pick = files.find((f) => /prd/i.test(f)) ?? files[0];
    if (pick) prd = fs.readFileSync(path.join(dir, pick), "utf8");
  } catch {
    /* no spec folder */
  }
  let screens: string[] = [];
  const table = section(prd, "Main screens");
  for (const line of table.split("\n")) {
    const cell = /^\|\s*([^|]+?)\s*\|/.exec(line)?.[1];
    if (cell && !/^(screen|-+)$/i.test(cell)) screens.push(screenName(cell));
  }
  if (!screens.length)
    for (const line of section(prd, "Information architecture").split("\n")) {
      const m = /^\s*[-*]\s+(.+)/.exec(line);
      if (m) screens.push(screenName(m[1]));
    }
  if (!screens.length) {
    try {
      screens = fs
        .readdirSync(path.join(root, "src", "screens"))
        .filter((f) => /Screen\.(tsx|jsx|ts|js)$/.test(f))
        .map((f) => screenName(f.replace(/\.(tsx|jsx|ts|js)$/, "")));
    } catch {
      /* no screens yet */
    }
  }
  // Requirements: "**R1** Show a list of trusted non-GMO brands (the user can: …)".
  const reqs = [...section(prd, "Functional requirements").matchAll(/\*\*R\d+\*\*\s*([^(\n]+)/g)].map((m) => m[1].trim());
  const listPhrase = reqs.map((r) => /\b(?:list|directory|catalog(?:ue)?|collection) of ([^,.;]+)/i.exec(r)?.[1]).find(Boolean)?.trim();
  // The main noun: the "X detail" screen, else the last word of the list phrase, else a screen that names a list.
  const detail = screens.map((s) => /^(.+?) detail/i.exec(s)?.[1]).find(Boolean);
  const listWord = listPhrase?.split(/\s+/).pop();
  const fromScreens = screens.map((s) => /^(?:.+ )?(\w+) list$/i.exec(s)?.[1]).find(Boolean);
  const base = (detail ?? (listWord ? singular(listWord) : undefined) ?? (fromScreens ? singular(fromScreens) : undefined))?.toLowerCase();
  if (!base && !screens.length) return undefined;
  const noun = base ?? "item";
  const plural = listWord && singular(listWord).toLowerCase() === noun ? listWord.toLowerCase() : pluralOf(noun);
  const tagline = firstSentence(section(prd, "Product promise")) || firstSentence(section(prd, "Product summary")) || undefined;
  // Features: the requirements other than the main list itself.
  const features = reqs
    .filter((r) => !listPhrase || !r.includes(listPhrase))
    .map((r) => r.replace(/^(?:allow|let|help) (?:users|people|the user) to /i, "").replace(/^show /i, "see "))
    .map((r) => clip(cap(r.replace(/\s+/g, " ")), 34))
    .slice(0, 4);
  return {
    noun,
    plural,
    listTitle: clip(cap(listPhrase ?? plural), 40),
    tagline: tagline ? clip(tagline, 110) : undefined,
    screens: screens.filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 4),
    features,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/**
 * Rewrites a kit sample's visible text in the project's words. Only text between tags changes, never class names or
 * markup, so the sample still shows the real building block.
 */
export function localizeSample(html: string, w: ProjectWords): string {
  const N = cap(w.noun);
  const P = cap(w.plural);
  const f = (i: number, fallback: string) => w.features[i] ?? fallback;
  // Whole phrases first (most specific), then single calendar words.
  const phrases: Array<[string, string]> = [
    ["Your week at a glance", `Your ${w.plural} at a glance`],
    ["Three events today, the first at 09:00.", w.tagline ?? `Everything about your ${w.plural} in one place.`],
    ["Plan your week and keep track of what's next.", w.tagline ?? `Keep track of your ${w.plural}.`],
    ["Open calendar", `View ${w.plural}`],
    ["Calendar", w.listTitle],
    ["Weekly summary", `${P} summary`],
    ["4 events this week, 2 of them today.", `4 new ${w.plural} this week, 2 of them today.`],
    ["Team planning", f(0, `${N} details`)],
    ["Design review", f(1, `New ${w.noun}`)],
    ["Team standup", f(2, `Popular ${w.plural}`)],
    ["Thursday, 10:00 to 11:00", "Updated today"],
    ["moved Team planning to Thursday", `updated the ${w.noun} details`],
    ["added Design review", `added a new ${w.noun}`],
    ["Event title", `${N} name`],
    ["Shown on the calendar.", `Shown in the ${low(w.listTitle)} list.`],
    ["Add your first event to see it on the calendar.", `Add your first ${w.noun} to see it here.`],
    ["Add something to your calendar.", `Add a ${w.noun} to get started.`],
    ["This overlaps another event.", `This looks like another ${w.noun}.`],
    ["Start week on Monday", `Show newest ${w.plural} first`],
    ["Changes the first column of the month view.", `Changes the order of the ${low(w.listTitle)} list.`],
    ["Show weekends", `Show hidden ${w.plural}`],
    ["The next seven days.", `The latest ${w.plural}.`],
    ["Week view", w.screens[0] ?? "Overview"],
    ["Repeat", "Sort by"],
    ["Never", "Name"],
    ["Every week", "Newest first"],
  ];
  // Month / Week / Day tabs become the app's screens when it has two or more.
  if (w.screens.length >= 2) phrases.push(["Month", w.screens[0]], ["Week", w.screens[1]], ["Day", w.screens[2] ?? "Saved"]);
  const words: Array<[RegExp, string]> = [
    [/\bEvents\b/g, P],
    [/\bevents\b/g, w.plural],
    [/\bEvent\b/g, N],
    [/\bevent\b/g, w.noun],
    [/\bcalendar\b/g, "list"],
  ];
  return html.replace(/>([^<]+)</g, (whole, raw: string) => {
    const text = raw.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
    const trimmed = text.trim();
    if (!trimmed) return whole;
    const exact = phrases.find(([from]) => from === trimmed);
    let out = exact ? text.replace(trimmed, exact[1]) : text;
    if (!exact) for (const [re, to] of words) out = out.replace(re, to);
    return out === text ? whole : `>${esc(out)}<`;
  });
}
