/**
 * Library pieces matched to the app's planned screens, by what each screen is for. The keyword rules (pickSections)
 * only catch websites and a few named sections, so a typical app spec got nothing but a sidebar (NOBIO: a brand list
 * with search and filters got no list, filter bar or empty state to start from), and the page templates were never
 * picked at all. Each screen's name and purpose are matched against every piece's tags, name and description.
 */
import { LIBRARY_SECTIONS, SECTION_CATEGORIES, type LibrarySection } from "@flowcode/contracts";
import type { PlannedScreen } from "./screenPlan.js";
import type { SectionPick } from "./sectionRecipes.js";

export interface ScreenPick extends SectionPick {
  screen: string;
  score: number;
}

const STOP = new Set("a an and the of to for in on at by with from your their its this that these those is are be can user users people person app screen page view see shows show lets let them they it as or into each every one any all more most what which who how use using used".split(" "));
// "comparison" and "compare", "pricing" and "price", "plans" and "plan" share a stem.
const stem = (w: string) => w.toLowerCase().replace(/ies$/, "y").replace(/(ison|ation|ment|ing|ed|es|s)$/, "").replace(/e$/, "").replace(/(.)\1$/, "$1");
const tokens = (s: string) => new Set((s.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem));

const WEBSITE = /\b(landing|website|web site|homepage|home page|marketing|visitors?)\b/i;
const groupOf = new Map(SECTION_CATEGORIES.map((c) => [c.id, c.group]));
/** What an app screen may start from: app components and app screen templates (a style kit and backgrounds aren't picks). */
const forApp = (s: LibrarySection) => (groupOf.get(s.category) === "app" && s.category !== "neobrutal") || s.category === "apptemplates" || s.category === "commerce";
const forSite = (s: LibrarySection) => s.category !== "backgrounds" && s.category !== "neobrutal" && s.category !== "apptemplates";

/** The screen's words, plain, with a few spellings the library's tags use ("log in" and "authenticate" are sign-in). */
const screenWords = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\blog ?in\b/g, "sign in login")
    .replace(/\bauthenticat[a-z]*/g, "auth sign in")
    .replace(/\bsign ?up\b/g, "sign up register")} `;

/** How well a piece fits a screen: shared words, weighted tags 3, name 2, description 1. */
/**
 * How well a piece's use cases and jobs match what the screen is for (the user's intent, in the screen's name and
 * purpose). A strong intent match lets a piece from any shelf serve the screen (a "Contact" screen in an app can use the
 * website's contact piece when its job is "get in touch with the team").
 */
export function intent(screen: Pick<PlannedScreen, "label" | "purpose">, piece: LibrarySection): number {
  const text = screenWords(`${screen.label} ${screen.purpose}`);
  const want = tokens(text);
  let score = 0;
  // The pattern's use cases, in a PRD's words, count most: the whole phrase in the screen's name or purpose ("order
  // history", "time off requests") is a strong match, all its words present a good one.
  for (const u of piece.useCases ?? []) {
    const phrase = screenWords(u).trim();
    if (text.includes(` ${phrase} `)) score += 7;
    else {
      const words = [...tokens(u)];
      if (words.length > 1 && words.every((w) => want.has(w))) score += 4;
    }
  }
  // The jobs people do with it: the job sharing most of its words with the screen's purpose counts (most of a job's
  // words, not one: "see", "list" alone say nothing).
  let job = 0;
  for (const j of piece.jobs ?? []) {
    const words = [...tokens(j)];
    if (words.length < 2) continue;
    const share = words.filter((w) => want.has(w)).length / words.length;
    job = Math.max(job, share >= 0.75 ? 6 : share >= 0.5 ? 3 : 0);
  }
  return score + job;
}

export function fit(screen: Pick<PlannedScreen, "label" | "purpose">, piece: LibrarySection): number {
  const text = screenWords(`${screen.label} ${screen.purpose}`);
  const want = tokens(text);
  // A tag phrase the screen uses whole ("sign in", "password reset") counts once more: its short words don't count alone.
  let score = piece.tags.filter((t) => t.includes(" ") && text.includes(` ${t.toLowerCase()} `)).length * 3;
  const seen = new Set<string>();
  const add = (words: string, weight: number) => {
    for (const t of tokens(words)) if (want.has(t) && !seen.has(t)) (seen.add(t), (score += weight));
  };
  score += intent(screen, piece);
  add(piece.tags.join(" "), 3);
  add(piece.name, 2);
  add(piece.description, 1);
  return score;
}

/** The best one or two pieces per screen (a clear match only, of different kinds), at most six in all, skipping ids already picked. */
export function screenPicks(screens: PlannedScreen[], already: string[] = [], min = 6): ScreenPick[] {
  const taken = new Set(already);
  const out: ScreenPick[] = [];
  for (const screen of screens) {
    const site = WEBSITE.test(`${screen.label} ${screen.purpose}`);
    const ranked = LIBRARY_SECTIONS.filter((p) => (site ? forSite : forApp)(p) || (groupOf.get(p.category) !== "template" && p.category !== "backgrounds" && p.category !== "neobrutal" && intent(screen, p) >= 6))
      .map((piece) => ({ piece, score: fit(screen, piece) }))
      .filter((r) => r.score >= min)
      .sort((a, b) => b.score - a.score);
    // A whole-screen template only as the screen's one pick; otherwise up to two components.
    // One piece per kind for a screen: two sign-in forms or two tables are alternatives, not a pair.
    let n = 0;
    const kinds = new Set<string>();
    for (const { piece, score } of ranked) {
      if (taken.has(piece.id) || kinds.has(piece.category)) continue;
      const template = groupOf.get(piece.category) === "template";
      if (template && n > 0) continue;
      // The second piece for a screen needs a clearer match than the first (an approval card for an Orders table was a
      // weak second pick): pieces now go straight into the screens.
      if (n > 0 && score < min + 1) continue;
      taken.add(piece.id);
      kinds.add(piece.category);
      out.push({ id: piece.id, screen: screen.label, score, reason: `${template ? "A whole-screen starting point" : "A starting point"} for the ${screen.label} screen: ${piece.name}` });
      n++;
      if (template || n === 2) break;
    }
    if (out.length >= 6) break;
  }
  return out.slice(0, 6);
}

/** For the design step: which screen each picked piece is for. */
export function screenPickGuidance(picks: ScreenPick[], fileOf: (id: string) => string): string {
  if (!picks.length) return "";
  return `The screens already render the library pieces matched to them (${picks.map((p) => `${p.screen} → ${fileOf(p.id).replace("src/sections/", "")}`).join("; ")}). They are each screen's starting structure: keep them, replace every value in their SAMPLE object with the spec's real content (then delete the SAMPLE comment), and reshape them for this screen. If a piece really doesn't fit its screen, remove it and name it with the reason in your task_complete summary (for example "Removed FormFilters: the spec has no filters").`;
}
