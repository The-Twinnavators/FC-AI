/**
 * What a spec build is and isn't building, decided once and deterministically before any planning stage runs, so every
 * stage (the app model, its navigation, the library pieces, the feature steps, the journeys and the assembled plan) gets
 * the same answer (Clean Cart planning validation, 2026-10-18: the PRD said "Not in this release: comments, ratings,
 * choosing a store by ZIP code, grocery lists" and asked for three links, and the plan still built a Categories page,
 * Lists, a List, a Store Finder, ratings and comments, because the look-up app model adds its whole working set; the
 * person's revision request asking for the same never reached the PRD planning path at all).
 *
 *  - Library capabilities (what the look-up pieces can do beyond the PRD's slice) are in scope only when the PRD's own
 *    in-scope text asks for them. One the PRD's "not in this release" section or the person's revision request names
 *    is deferred, with where that came from. Others are left out as library capabilities nobody asked for.
 *  - Requirements under the PRD's records or sample-data headings are supporting data (the app model holds them), not
 *    features with their own step.
 *  - The navigation the PRD declares ("three links: Home, Search, Saved") is the primary navigation; a record's own
 *    page (a product detail) is opened from other pages, never a navigation link.
 *  - The person's revision requests reach every planning stage as directives (planDirectives).
 */
import type { Requirement } from "../quality/spec.js";
import type { AppModel, LookupKind, ModelView } from "./appModel.js";

export type LookupCapability = "categories" | "places" | "lists" | "ratings" | "comments" | "sharing" | "likes";
export const LOOKUP_CAPABILITIES: LookupCapability[] = ["categories", "places", "lists", "ratings", "comments", "sharing", "likes"];

export const CAPABILITY_LABEL: Record<LookupCapability, string> = {
  categories: "a Categories page (browsing by category)",
  places: "a store finder (choosing a place by ZIP code, where to find it nearby)",
  lists: "lists (shopping or grocery lists)",
  ratings: "ratings",
  comments: "comments",
  sharing: "sharing",
  likes: "likes",
};

/** The destinations a capability brings into a look-up app. */
export const CAPABILITY_KINDS: Partial<Record<LookupCapability, LookupKind[]>> = { categories: ["categories"], places: ["places"], lists: ["lists", "mylist"] };

/** Words that ask for a capability in the PRD's in-scope text (a field called "category" is not a Categories page). */
const ASKS: Record<LookupCapability, RegExp> = {
  categories: /\b(categories (page|screen|tab|list)|browse (by )?categor\w*|filter(s|ing)? by category|category (page|filters?|tiles?|browsing))\b/i,
  places: /\b(store finder|find (a|the|your) (store|shop|place|location)|(stores?|shops?|places?) near( me| you|by)?|near(by| me| you)|by zip|zip code (search|lookup|prompt|entry)|choos\w+ (a|your) (store|shop|place)|where to (buy|find) it)\b/i,
  lists: /\b(shopping lists?|grocery lists?|my lists?|wish ?lists?|lists? of (products|items|entries)|add (it )?to (a )?list)\b/i,
  ratings: /\b(ratings?|star ratings?|rate (it|them|a|the|products?)|(customer|product|user) reviews?)\b/i,
  comments: /\bcomments?\b/i,
  sharing: /\b(share|sharing)\b/i,
  likes: /\b(likes?|like button|favou?rites?)\b/i,
};
/** Words that name a capability where something is left out (a non-goals section, a revision sentence that says no). */
const NAMES: Record<LookupCapability, RegExp> = {
  categories: /\b(categor(y|ies) (page|browsing|tiles)|categories page|browse by category)\b/i,
  places: /\b(zip codes?|store finder|store[- ]management|choosing a store|stores? near|find a store|store locator|locations?)\b/i,
  lists: /\b(lists?|wish ?lists?)\b/i,
  ratings: /\b(ratings?|reviews?|stars)\b/i,
  comments: /\bcomments?\b/i,
  sharing: /\bshar(e|ing)\b/i,
  likes: /\b(likes|liking|favou?rites)\b/i,
};
const NEGATION = /\b(do not|don't|never|no|not|without|remove|drop|leave out|left out|instead of)\b/i;
const MARKETING_FUNNEL = /\b(marketing (funnel|page|sections?)|hero|cta|call[- ]to[- ]action|footer|landing funnel)\b/i;
const OUT_OF_SCOPE_HEADING = /\b(not in (this|the first|v1|the) ?release|out of scope|non-?goals?|not included|excluded|later|future)\b/i;
const RECORDS_HEADING = /\b(records?|data model|entities|data|fields)\b/i;
const SAMPLE_HEADING = /\b(sample|seed|example) data\b/i;
const NAV_HEADING = /\bnavigation\b/i;

export const planScopeKey = (runId: string) => `planScope:${runId}`;

export const REVISION_MARK = "Revision requested by the person";

export interface ScopeDecision {
  capability: LookupCapability;
  status: "in scope" | "deferred" | "not requested";
  /** Where the decision came from: the PRD's words, its non-goals section, the person's revision request, or nobody asking. */
  source: "prd" | "prd non-goals" | "revision" | "not asked for";
  quote?: string;
}
export interface PlanScope {
  capabilities: ScopeDecision[];
  /** The person's revision requests, newest last (they reach every planning stage). */
  revisions: string[];
  /** The person asked for no marketing funnel (hero, CTA banner, footer). */
  noMarketing: boolean;
  /** The links the PRD's navigation section names, in order (empty: the PRD names none). */
  navigation: string[];
  /** Headings whose requirements are supporting data (records, fields, sample data), lower case. */
  dataSections: string[];
  /** A capability the PRD's in-scope text asks for but the person's revision defers: theirs to confirm. */
  conflicts: string[];
}

const sentences = (text: string) => text.split(/(?<=[.;!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** The PRD split into its sections (heading line, its level, its body). */
function sectionsOf(prd: string): Array<{ heading: string; level: number; body: string }> {
  const out: Array<{ heading: string; level: number; body: string }> = [];
  let cur = { heading: "", level: 0, body: "" };
  for (const line of prd.split(/\r?\n/)) {
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      out.push(cur);
      cur = { heading: h[2]!.trim(), level: h[1]!.length, body: "" };
    } else cur.body += `${line}\n`;
  }
  out.push(cur);
  return out.filter((s) => s.heading || s.body.trim());
}

const plainHeading = (h: string) => h.replace(/^\d+(\.\d+)*[.)]?\s*/, "").trim();

/** The revision requests in a run's constraints (planReview.ts writes them), text only. */
export function revisionRequests(constraints: string[]): string[] {
  return constraints.filter((c) => c.startsWith(REVISION_MARK)).map((c) => c.replace(/^Revision requested by the person for plan version \d+\. Plan again so the new plan does this:\s*/, "").trim());
}

export function planScope(prd: string, constraints: string[] = []): PlanScope {
  const parts = sectionsOf(prd);
  const outParts = parts.filter((p) => OUT_OF_SCOPE_HEADING.test(plainHeading(p.heading)));
  const outText = outParts.map((p) => p.body).join("\n");
  const inText = parts.filter((p) => !outParts.includes(p)).map((p) => `${p.heading}\n${p.body}`).join("\n");
  const revisions = revisionRequests(constraints);
  // Quoted examples are the person's examples of wording, not things they leave out ("such as "list of saved products"").
  const refusals = revisions.flatMap((r) => sentences(r.replace(/"[^"\n]*"|“[^”\n]*”/g, '""'))).filter((s) => NEGATION.test(s));
  const capabilities: ScopeDecision[] = [];
  const conflicts: string[] = [];
  for (const cap of LOOKUP_CAPABILITIES) {
    const prdOut = sentences(outText).find((s) => NAMES[cap].test(s));
    const rev = refusals.find((s) => NAMES[cap].test(s));
    const asked = ASKS[cap].exec(inText);
    if (prdOut) capabilities.push({ capability: cap, status: "deferred", source: "prd non-goals", quote: prdOut.slice(0, 200) });
    else if (rev) {
      capabilities.push({ capability: cap, status: "deferred", source: "revision", quote: rev.slice(0, 200) });
      if (asked) conflicts.push(`The PRD asks for ${CAPABILITY_LABEL[cap]} ("${asked[0]}"), and your revision request leaves it out: it is left out; say if the PRD should win.`);
    } else if (asked) capabilities.push({ capability: cap, status: "in scope", source: "prd", quote: asked[0] });
    else capabilities.push({ capability: cap, status: "not requested", source: "not asked for" });
  }
  // The navigation the PRD declares: "three links: Home, Search, Saved", or a bulleted list under its heading.
  const navPart = parts.find((p) => NAV_HEADING.test(plainHeading(p.heading)));
  let navigation: string[] = [];
  if (navPart) {
    const m = /\blinks?\b[^:\n]*:\s*([^\n.]+)/i.exec(navPart.body);
    const raw = m ? m[1]!.split(/,|\band\b/) : navPart.body.split(/\n/).filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").split(/[:(—-]/)[0]!);
    navigation = raw.map((x) => x.replace(/[*_`"]/g, "").trim()).filter((x) => x && x.length <= 30 && !/\s{2,}/.test(x));
  }
  // Records and sample data: the headings themselves and the ones nested under a records heading.
  const dataSections: string[] = [];
  let recordsLevel = 0;
  for (const p of parts) {
    if (!p.heading) continue;
    const h = plainHeading(p.heading);
    if (recordsLevel && p.level <= recordsLevel) recordsLevel = 0;
    if (SAMPLE_HEADING.test(h) || (RECORDS_HEADING.test(h) && !/\brequirements?\b/i.test(h))) {
      dataSections.push(h.toLowerCase());
      if (!SAMPLE_HEADING.test(h)) recordsLevel = p.level;
    } else if (recordsLevel && p.level > recordsLevel) dataSections.push(h.toLowerCase());
  }
  return { capabilities, revisions, noMarketing: refusals.some((s) => MARKETING_FUNNEL.test(s)), navigation, dataSections, conflicts };
}

export const leftOut = (s: PlanScope) => s.capabilities.filter((c) => c.status !== "in scope").map((c) => c.capability);
export const inScope = (s: PlanScope, cap: LookupCapability) => s.capabilities.some((c) => c.capability === cap && c.status === "in scope");

/** Requirements that describe records and sample data: the app model holds them; they are not a build step of their own. */
export const isSupportingData = (s: PlanScope, r: Pick<Requirement, "section">) => s.dataSections.includes(plainHeading(r.section).toLowerCase());

/** The scope as every planner and step reads it. */
export function scopeNote(s: PlanScope, required: Requirement[] = []): string {
  const deferred = s.capabilities.filter((c) => c.status === "deferred");
  const unasked = s.capabilities.filter((c) => c.status === "not requested");
  const kept = s.capabilities.filter((c) => c.status === "in scope");
  return [
    "Scope of this build (decided by FlowCode from the PRD and the person's requests; every step follows it):",
    required.length ? `- Required behaviour: ${required.map((r) => r.id).join(", ")} (the PRD's requirements, each built and tested).` : "",
    s.dataSections.length ? `- Supporting data (records the app holds and shows; no page or feature of their own): the PRD's ${s.dataSections.map((d) => `"${d}"`).join(", ")} sections.` : "",
    kept.length ? `- Library capabilities the PRD asks for: ${kept.map((c) => CAPABILITY_LABEL[c.capability]).join("; ")}.` : "",
    deferred.length ? `- Deferred (not in this release; no page, navigation link, control or test for them): ${deferred.map((c) => `${CAPABILITY_LABEL[c.capability]} (${c.source === "revision" ? "your revision request" : "the PRD's non-goals"})`).join("; ")}.` : "",
    unasked.length ? `- Left out (the library could add them, but nothing asks for them): ${unasked.map((c) => CAPABILITY_LABEL[c.capability]).join("; ")}.` : "",
    s.navigation.length ? `- Primary navigation: ${s.navigation.join(", ")} (as the PRD declares). A record's own page opens from a list or a result, never from the navigation.` : "- A record's own page opens from a list or a result, never from the navigation.",
    s.noMarketing ? "- No marketing funnel: no hero banner, call-to-action banner or marketing footer." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The person's revision requests and the scope, for every planning stage's request. */
export function planDirectives(s: PlanScope, required: Requirement[] = []): string {
  return [
    s.revisions.length ? `The person reviewed an earlier version of this plan and asked for these changes; the new plan must do them (they override the defaults below):\n${s.revisions.map((r) => `- ${r}`).join("\n")}` : "",
    scopeNote(s, required),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The app model held to the scope: destinations of left-out capabilities removed (the look-up model adds its whole
 * working set by default), their sample ratings and lists dropped, what the look-up pieces leave out recorded on the
 * model (lookup.omit), the PRD's own screen purposes used, and the primary navigation recorded.
 */
export function applyScope(m: AppModel, s: PlanScope, declared: Array<{ name: string; purpose: string }> = []): { model: AppModel; removed: string[] } {
  const out = leftOut(s);
  const kinds = new Set(out.flatMap((c) => CAPABILITY_KINDS[c] ?? []));
  const removed: string[] = [];
  const purposeOf = (v: ModelView) => v.purpose ?? declared.find((d) => d.name.toLowerCase() === v.label.toLowerCase() || (v.kind === "landing" && /^home$/i.test(d.name)))?.purpose;
  const nav = m.nav
    .map((g) => ({
      ...g,
      items: g.items.filter((v) => {
        if (m.lookup && kinds.has(v.kind as LookupKind)) {
          removed.push(v.label);
          return false;
        }
        return true;
      }).map((v) => {
        const purpose = purposeOf(v);
        return purpose ? { ...v, purpose } : v;
      }),
    }))
    .filter((g) => g.items.length);
  const lookup = m.lookup ? { ...m.lookup, omit: out, ...(out.includes("ratings") || out.includes("comments") ? { ratings: [] } : {}), ...(out.includes("lists") ? { lists: [] } : {}), ...(out.includes("likes") ? { likes: {} } : {}) } : undefined;
  return { model: { ...m, nav, ...(lookup ? { lookup } : {}), ...(s.navigation.length ? { primaryNav: s.navigation } : {}) }, removed };
}

/** Who owns the app's data: one file for the records, one for what the person saved (kept after a reload). */
export interface DataOwners {
  records: string;
  saved: string;
  note: string;
}
export function dataOwners(m: AppModel): DataOwners {
  const records = "src/app/store.ts";
  const saved = m.lookup ? "src/app/lookup.ts" : records;
  const entries = m.lookup ? m.entities.find((e) => e.key === m.lookup!.entries)?.plural ?? "records" : m.entities.map((e) => e.plural).join(", ");
  return {
    records,
    saved,
    note: `Data owners (one each; no other file keeps a copy, including src/sim or a screen's own state): ${entries} records are owned by ${records} (the one store, seeded from src/app/schema.ts); what the person saved is owned by ${saved}${saved === records ? "" : ", which reads the records from the store"}, kept in this browser so it survives a reload.`,
  };
}

const SAVE_WORDS = /\bsav(e|ed|es|ing)\b|\bpersist|\breload/i;

/**
 * Feature steps held to the data owners: a step about saving names the saved-state owner, not the record store or a
 * simulated copy (Clean Cart planning validation: the step "Persistent Saved Products" wrote src/app/store.ts while the
 * app kept saves in src/app/lookup.ts), and every feature step reads the owners. Returns the steps and what changed.
 */
export function withOwners<T extends { key: string; title: string; objective: string; expectedPaths: string[] }>(tasks: T[], owners: DataOwners, feature: (t: T) => boolean): { tasks: T[]; moved: string[] } {
  const moved: string[] = [];
  const out = tasks.map((t) => {
    if (!feature(t)) return t;
    let paths = t.expectedPaths.filter((p) => !/^src\/sim(\/|$)/.test(p));
    if (owners.saved !== owners.records && SAVE_WORDS.test(`${t.title} ${t.objective}`) && paths.includes(owners.records)) {
      paths = [...new Set(paths.map((p) => (p === owners.records ? owners.saved : p)))];
      moved.push(`${t.title}: ${owners.records} → ${owners.saved}`);
    } else if (paths.length !== t.expectedPaths.length) moved.push(`${t.title}: no src/sim copy`);
    return { ...t, expectedPaths: paths, objective: `${t.objective}\n\n${owners.note}` };
  });
  return { tasks: out, moved };
}
