/**
 * Screen briefs: before any screen is designed, one short planner call turns the PRD into what each screen is for in
 * the person's terms - who arrives, what they came to do, the steps they take, what they must see first and the one
 * main action - and lays the screen out as a few sections in order, each built from a catalog part matched to that
 * screen. Without it the design step started from "a page header and the matched pieces" and produced the same page
 * every time (Build test 4: a brand guide for busy parents opened on a bare list of names). The brief is the design
 * steps' target and the visual review's yardstick.
 */
import { LIBRARY_SECTIONS } from "@flowcode/contracts";
import { resolveCatalogId } from "./catalogContract.js";
import type { CatalogManifest } from "./catalogMatch.js";
import type { ScreenPlan } from "./screenPlan.js";
import { PAGE_TYPE_IDS, PAGE_TYPES, checkComposition, pageTypeGuide, pageTypeOf, type CompositionIssue, type PageType } from "./pageTypes.js";

export interface ScreenBriefSection {
  title: string;
  purpose: string;
  /** A catalog ID from the screen's matched list, or "" for plain content. */
  part: string;
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
          sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, purpose: { type: "string" }, part: { type: "string" } }, required: ["title", "purpose", "part"] } },
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
    .map((s) => `## ${s.label}\nPurpose: ${s.purpose}\nParts for this screen:\n${briefParts(manifest, s.label).map((r) => `- ${r}: ${nameOf(r)}`).join("\n")}`)
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
        return { title: text(x.title, 60), purpose: text(x.purpose, 200), part: allowed.has(part) ? part : "" };
      })
      .filter((x) => x.title);
    if (!sections.length) continue;
    // The page's type, then its parts checked against it: what doesn't belong comes out, a missing job is recorded.
    const pageType = pageTypeOf(r.pageType, s.label, s.purpose, plan.screens.indexOf(s) > 0 && /\bdetails?\b/i.test(s.label), app);
    const checked = checkComposition(s.label, pageType, sections);
    issues?.push(...checked.issues);
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
        ...b.sections.map((x, i) => `${i + 1}. ${x.title}: ${x.purpose}${x.part ? ` [${x.part}]` : ""}`),
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
