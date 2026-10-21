/**
 * Screen briefs: before any screen is designed, one short planner call turns the PRD into what each screen is for in
 * the person's terms - who arrives, what they came to do, the steps they take, what they must see first and the one
 * main action - and lays the screen out as a few sections in order, each built from a catalog part matched to that
 * screen. Without it the design step started from "a page header and the matched pieces" and produced the same page
 * every time (Build test 4: a brand guide for busy parents opened on a bare list of names). The brief is the design
 * steps' target and the visual review's yardstick.
 */
import { LIBRARY_SECTIONS } from "@flowcode/contracts";
import { catalogContract, resolveCatalogId } from "./catalogContract.js";
import type { CatalogManifest } from "./catalogMatch.js";
import type { ScreenPlan } from "./screenPlan.js";
import { PAGE_TYPE_IDS, PAGE_TYPES, checkComposition, pageTypeGuide, pageTypeOf, type CompositionIssue, type PageType } from "./pageTypes.js";

export interface ScreenBriefSection {
  title: string;
  purpose: string;
  /** A catalog ID from the screen's matched list, or "" for plain content. */
  part: string;
  /** How the part is used: as it is, reshaped for this page, put together with others, or built new (no part fits). */
  use?: "reuse" | "adapt" | "compose" | "create";
  /** For adapt: what changes from the part as the catalog has it (content mapping, removed or added pieces). */
  adapt?: string;
  /** An approved design's section (designContract.ts): FlowCode writes it with this component and content. */
  contract?: { block: string; component: string; props: Record<string, unknown> };
  /** A section the PRD needs on a page whose composition an approved design sets: kept, after the hero. */
  required?: true;
}
export interface ScreenBrief {
  screen: string;
  /** The kind of job the page does (pageTypes.ts): decides what it must contain and what it must not. */
  pageType?: PageType;
  who: string;
  goal: string;
  workflow: string[];
  firstView: string;
  primaryAction: string;
  sections: ScreenBriefSection[];
  /** The page plan around the layout: how people get here and leave, its states, how it fits a phone, what proves it. */
  navIn?: string[];
  navOut?: string[];
  states?: { loading: string; empty: string; error: string; success: string };
  responsive?: string;
  accessibility?: string;
  /** Requirement IDs this page must satisfy (from the PRD). */
  acceptance?: string[];
}

export const screenBriefKey = (runId: string) => `screenBrief:${runId}`;

export const SCREEN_BRIEF_SYSTEM: string = `You plan the screens of a clickable prototype the way a product designer does, from the person's side.
For each screen you are given, decide:
- its page type, from the person's job on it:
${pageTypeGuide().replace(/^/gm, "  ")}
- who arrives there, in the PRD's words, and the goal they came with;
- their workflow on the screen: 2 to 5 short steps, in order;
- what they must see first, before scrolling, to know they are in the right place and can get going (this is what the
  top of the screen shows: not a generic page title, but the thing that answers why they came);
- the one main action;
- the screen as 3 to 6 sections, top to bottom, each with a short title, its purpose for that person, and the catalog
  part that builds it, chosen ONLY from that screen's list of parts (use "" when a section is plain content). No
  section the person doesn't need; no filler (no testimonials, stats or marketing on an app screen unless the PRD asks);
- choose parts by what they do, from their cards, not by their names: each section's part takes one responsibility on
  the page ("Gives a page"), and two sections never take the same one. A part's "Already contains" pieces are part of
  it: don't add them again as sections (a page template with its own navigation, form and footer needs no separate
  nav, form or footer). Pick a part only when the screen can supply what it "Needs", and never where its "Avoid when"
  applies; otherwise use a smaller part or "" and say what is built new;
- for each section, "use": "reuse" (the part as it is, filled with this product's content), "adapt" (reshaped: say how
  in "adapt", e.g. which fields map to which records, what is added or taken out), "compose" (built from the core
  components), or "create" (nothing in the list fits: plain content built for this screen);
- navIn / navOut: the screens people come from and go to (planned screens only), so every user journey can be clicked
  through;
- states: what the page shows while loading, when there is nothing yet (empty), when something fails (error), and after
  the main action succeeds;
- responsive: how it rearranges on a phone; accessibility: what must be reachable by keyboard and labelled;
- acceptance: the requirement IDs (R1, R2...) this page must satisfy, when the user journeys give them.
Use the PRD's real content and words. Answer with JSON only.`;

export const SCREEN_BRIEF_SCHEMA = {
  type: "object",
  properties: {
    screens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          screen: { type: "string" },
          pageType: { type: "string", enum: PAGE_TYPE_IDS },
          who: { type: "string" },
          goal: { type: "string" },
          workflow: { type: "array", items: { type: "string" } },
          firstView: { type: "string" },
          primaryAction: { type: "string" },
          sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, purpose: { type: "string" }, part: { type: "string" }, use: { type: "string", enum: ["reuse", "adapt", "compose", "create"] }, adapt: { type: "string" } }, required: ["title", "purpose", "part"] } },
          navIn: { type: "array", items: { type: "string" } },
          navOut: { type: "array", items: { type: "string" } },
          states: { type: "object", properties: { loading: { type: "string" }, empty: { type: "string" }, error: { type: "string" }, success: { type: "string" } } },
          responsive: { type: "string" },
          accessibility: { type: "string" },
          acceptance: { type: "array", items: { type: "string" } },
        },
        required: ["screen", "who", "goal", "workflow", "firstView", "primaryAction", "sections"],
      },
    },
  },
  required: ["screens"],
};

/** The components every screen may use, whatever matched. */
const CORE = ["c.button", "c.text-field", "c.select", "c.card", "c.badge", "c.alert", "c.empty-state", "c.list-row", "c.avatar", "c.tabs", "c.chip", "c.media-frame"];

/** Each screen's parts to choose from: its matched picks and next-best options, the IDs the PRD calls for, and the core. */
export function briefParts(manifest: CatalogManifest | undefined, screen: string): string[] {
  const s = manifest?.screens.find((x) => x.screen === screen);
  const ids = [...(s?.picks ?? []), ...(s?.alternates ?? []), ...(manifest?.shared ?? [])].map((m) => m.ref);
  return [...new Set([...ids, ...CORE])].filter((r) => LIBRARY_SECTIONS.some((p) => p.ref === r || (p.variants ?? []).some((v) => v.ref === r)));
}

/**
 * A candidate part as the brief's writer reads it: its catalog card - what it does, where it belongs, what it gives a
 * page, what it needs, when to avoid it and what it already contains - so parts are chosen by what they do, not by
 * their names. The catalog already records all of this (catalogContract); the brief used to get the name only.
 */
export function partCard(ref: string, variants: string[] = []): string {
  const c = catalogContract(ref);
  if (!c) return `- ${ref}: ${nameOf(ref)}`;
  const others = variants.filter((v) => v !== ref);
  const does = c.function.replace(/^[^:]{0,80}\([a-z]\.[^)]*\):\s*/i, "").split(/(?<=[.;])\s/)[0]!.slice(0, 180);
  const contains = c.builtFrom.filter((b) => !/^c\./.test(b) || /nav|footer|form|header/.test(b));
  return [
    `- ${ref} (${c.level}, ${c.name}): ${does}`,
    `Belongs on ${c.relations.contexts.map((x) => (x === "app" ? "app screens" : "marketing pages")).join(" and ")}`,
    c.relations.provides.length ? `Gives a page: ${c.relations.provides.join(", ")}` : "",
    c.relations.requires.length ? `Needs: ${c.relations.requires.join("; ")}` : "",
    c.relations.avoidWhen.length ? `Avoid when: ${c.relations.avoidWhen.join("; ")}` : "",
    contains.length ? `Already contains: ${contains.join(", ")}` : "",
    others.length ? `Also as: ${others.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

/** Candidate IDs grouped by the piece that implements them: [first ID, all its IDs]. */
function groupByPiece(refs: string[]): Array<[string, string[]]> {
  const groups = new Map<string, string[]>();
  for (const r of refs) {
    const key = resolveCatalogId(r)?.piece.id ?? r;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map((ids) => [ids[0]!, ids]);
}

/**
 * Sections whose part another section's part already contains (a template's own footer added again as a footer): the
 * same thing twice on one page. Reported, not removed: the writer may have meant a second one.
 */
export function duplicateParts(page: string, sections: Array<{ title: string; part: string }>): CompositionIssue[] {
  const out: CompositionIssue[] = [];
  for (const a of sections) {
    if (!a.part) continue;
    const inside = new Set(catalogContract(a.part)?.builtFrom ?? []);
    for (const b of sections) {
      if (b === a || !b.part) continue;
      const base = b.part.split(/[.@]/).slice(0, 2).join(".");
      if (inside.has(b.part) || inside.has(base)) out.push({ page, section: b.title, part: b.part, reason: `"${a.title}" (${a.part}) already contains ${b.part}: this section repeats it` });
    }
  }
  // The same part for two sections: one of them is that part stretched to a job it doesn't do.
  sections.forEach((b, i) => {
    const first = sections.findIndex((a) => a.part && a.part === b.part);
    if (b.part && first < i) out.push({ page, section: b.title, part: b.part, reason: `${b.part} already builds "${sections[first]!.title}": a second section from the same part repeats it` });
  });
  const templates = sections.filter((x) => x.part.startsWith("t."));
  if (templates.length && sections.filter((x) => x.part).length > 1)
    for (const t of templates) out.push({ page, section: t.title, part: t.part, reason: `${t.part} is a whole screen, used here as one section among others: use it as the page, or a smaller part for this section` });
  return out;
}

const nameOf = (ref: string) => LIBRARY_SECTIONS.find((p) => p.ref === ref)?.name ?? LIBRARY_SECTIONS.find((p) => (p.variants ?? []).some((v) => v.ref === ref))?.name ?? ref;

/** The PRD's sections about people, goals, journeys and screens, for the brief (the rest is features). */
export function prdForBrief(prd: string, max = 6000): string {
  const parts = prd.split(/\n(?=#{1,4}\s)/);
  const want = parts.filter((p) => /^#{1,4}\s.*\b(users?|personas?|audience|who|journeys?|workflows?|stor(y|ies)|problems?|goals?|jobs?|needs?|screens?|pages?|experience)\b/i.test(p));
  return (want.length ? want : parts).join("\n").slice(0, max);
}

/** The user message for the brief call. */
export function briefRequest(objective: string, prd: string, plan: ScreenPlan, manifest: CatalogManifest | undefined, journeys = ""): string {
  const screens = plan.screens
    .map((s) => {
      const parts = briefParts(manifest, s.label);
      const matched = parts.filter((r) => !CORE.includes(r));
      return [
        `## ${s.label}`,
        `Purpose: ${s.purpose}`,
        "Parts for this screen (what each does, in the catalog's words):",
        ...groupByPiece(matched).map(([ref, variants]) => partCard(ref, variants)),
        `Core components, for sections built from them: ${parts.filter((r) => CORE.includes(r)).join(", ")}`,
      ].join("\n");
    })
    .join("\n\n");
  return `Product: ${plan.product}\nRequest: ${objective.slice(0, 800)}\n\nPRD (people, goals, journeys, screens):\n${prd}${journeys ? `\n\n${journeys}` : ""}\n\nScreens:\n${screens}`;
}

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The model's answer, kept to the planned screens and to each screen's own parts (an ID it made up is dropped). */
/**
 * dropped (optional) collects the sections whose writer named a part that isn't in the catalog at all: those are
 * catalog gaps for the composition manifest, not silent omissions. A real part from outside the screen's list is
 * simply not used.
 */
export function parseScreenBriefs(raw: unknown, plan: ScreenPlan, manifest: CatalogManifest | undefined, dropped?: Array<{ page: string; section: string; part: string }>, issues?: CompositionIssue[], app = false): ScreenBrief[] {
  const list = Array.isArray((raw as { screens?: unknown })?.screens) ? ((raw as { screens: unknown[] }).screens as Array<Record<string, unknown>>) : [];
  const out: ScreenBrief[] = [];
  for (const s of plan.screens) {
    const r = list.find((x) => text(x.screen, 60).toLowerCase() === s.label.toLowerCase()) ?? list.find((x) => text(x.screen, 60).toLowerCase().includes(s.label.toLowerCase()));
    if (!r) continue;
    const allowed = new Set(briefParts(manifest, s.label));
    const sections = (Array.isArray(r.sections) ? (r.sections as Array<Record<string, unknown>>) : [])
      .slice(0, 6)
      .map((x) => {
        const part = text(x.part, 80);
        if (part && !allowed.has(part) && dropped && !resolveCatalogId(part)) dropped.push({ page: s.label, section: text(x.title, 60), part });
        const use = ["reuse", "adapt", "compose", "create"].includes(String(x.use)) ? (String(x.use) as ScreenBriefSection["use"]) : undefined;
        const adapt = text(x.adapt, 200);
        // Content mapping is what any reuse does; an adaptation that changes the part is "adapt".
        const changes = adapt && /\b(remove|drop|skip|add|replace|instead|without|only|change|rename|merge|split)\b/i.test(adapt);
        const used = use === "reuse" && changes ? "adapt" : use;
        return { title: text(x.title, 60), purpose: text(x.purpose, 200), part: allowed.has(part) ? part : "", ...(used ? { use: used } : {}), ...(adapt ? { adapt } : {}) };
      })
      .filter((x) => x.title);
    if (!sections.length) continue;
    // The page's type, then its parts checked against it: what doesn't belong comes out, a missing job is recorded.
    const pageType = pageTypeOf(r.pageType, s.label, s.purpose, plan.screens.indexOf(s) > 0 && /\bdetails?\b/i.test(s.label), app);
    const checked = checkComposition(s.label, pageType, sections);
    issues?.push(...checked.issues, ...duplicateParts(s.label, checked.sections));
    const screensOnly = (v: unknown) =>
      (Array.isArray(v) ? v : [])
        .map((n) => text(n, 60).toLowerCase().replace(/\s+(screen|page)$/, ""))
        .map((n) => plan.screens.find((p) => p.label.toLowerCase() === n)?.label)
        .filter((n): n is string => !!n && n !== s.label);
    const st = (r.states ?? {}) as Record<string, unknown>;
    out.push({
      screen: s.label,
      pageType,
      who: text(r.who, 160),
      goal: text(r.goal, 200),
      workflow: (Array.isArray(r.workflow) ? (r.workflow as unknown[]) : []).map((w) => text(w, 140)).filter(Boolean).slice(0, 5),
      firstView: text(r.firstView, 240),
      primaryAction: text(r.primaryAction, 100),
      sections: checked.sections,
      navIn: [...new Set(screensOnly(r.navIn))],
      navOut: [...new Set(screensOnly(r.navOut))],
      states: { loading: text(st.loading, 160), empty: text(st.empty, 160), error: text(st.error, 160), success: text(st.success, 160) },
      responsive: text(r.responsive, 200),
      accessibility: text(r.accessibility, 200),
      acceptance: [...new Set((Array.isArray(r.acceptance) ? r.acceptance : []).map((x) => text(x, 10).toUpperCase()).filter((x) => /^R\d+$/.test(x)))],
    });
  }
  return out;
}

/** The briefs as the design steps and the visual review read them. */
export function screenBriefNote(briefs: ScreenBrief[]): string {
  if (!briefs.length) return "";
  return [
    "Screen briefs (locked: build every section with its part; if one truly doesn't fit, record the change with propose_layout_change and its reason, never leave it out quietly): design each screen to its brief, from the person's side. The top of the screen shows what they must see first (not a generic title over a list); the sections come in this order, each built from its catalog part (add_library_piece with the ID when it isn't in the app yet), filled with the spec's real content.",
    ...briefs.map((b) =>
      [
        `## ${b.screen}`,
        b.pageType ? `Page type: ${PAGE_TYPES[b.pageType].label} (${PAGE_TYPES[b.pageType].job}). Not on this page: ${PAGE_TYPES[b.pageType].avoid.join("; ")}.` : "",
        `For: ${b.who}. Goal: ${b.goal}`,
        b.workflow.length ? `Workflow: ${b.workflow.map((w, i) => `${i + 1}. ${w}`).join(" ")}` : "",
        `First view (without scrolling): ${b.firstView}`,
        `Main action: ${b.primaryAction}`,
        "Sections, top to bottom:",
        ...b.sections.map((x, i) => `${i + 1}. ${x.title}: ${x.purpose}${x.part ? ` [${x.part}${x.use ? `, ${x.use}` : ""}]` : x.use === "create" ? " [built new]" : ""}${x.adapt ? ` Adapt: ${x.adapt}` : ""}`),
        b.navIn?.length || b.navOut?.length ? `Navigation: from ${b.navIn?.join(", ") || "the menu"}; links on to ${b.navOut?.join(", ") || "nothing else"}` : "",
        b.states && Object.values(b.states).some(Boolean) ? `States: ${(["loading", "empty", "error", "success"] as const).filter((k) => b.states![k]).map((k) => `${k}: ${b.states![k]}`).join("; ")}` : "",
        b.responsive || b.pageType ? `On a phone: ${[b.responsive, b.pageType ? PAGE_TYPES[b.pageType].phone : ""].filter(Boolean).join("; ")}` : "",
        b.accessibility ? `Accessibility: ${b.accessibility}` : "",
        b.acceptance?.length ? `Must satisfy: ${b.acceptance.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}
