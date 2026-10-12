/**
 * Screen briefs: before any screen is designed, one short planner call turns the PRD into what each screen is for in
 * the person's terms - who arrives, what they came to do, the steps they take, what they must see first and the one
 * main action - and lays the screen out as a few sections in order, each built from a catalog part matched to that
 * screen. Without it the design step started from "a page header and the matched pieces" and produced the same page
 * every time (Build test 4: a brand guide for busy parents opened on a bare list of names). The brief is the design
 * steps' target and the visual review's yardstick.
 */
import { LIBRARY_SECTIONS } from "@flowcode/contracts";
import type { CatalogManifest } from "./catalogMatch.js";
import type { ScreenPlan } from "./screenPlan.js";

export interface ScreenBriefSection {
  title: string;
  purpose: string;
  /** A catalog ID from the screen's matched list, or "" for plain content. */
  part: string;
}
export interface ScreenBrief {
  screen: string;
  who: string;
  goal: string;
  workflow: string[];
  firstView: string;
  primaryAction: string;
  sections: ScreenBriefSection[];
}

export const screenBriefKey = (runId: string) => `screenBrief:${runId}`;

export const SCREEN_BRIEF_SYSTEM = `You plan the screens of a clickable prototype the way a product designer does, from the person's side.
For each screen you are given, decide:
- who arrives there, in the PRD's words, and the goal they came with;
- their workflow on the screen: 2 to 5 short steps, in order;
- what they must see first, before scrolling, to know they are in the right place and can get going (this is what the
  top of the screen shows: not a generic page title, but the thing that answers why they came);
- the one main action;
- the screen as 3 to 6 sections, top to bottom, each with a short title, its purpose for that person, and the catalog
  part that builds it, chosen ONLY from that screen's list of parts (use "" when a section is plain content). No
  section the person doesn't need; no filler (no testimonials, stats or marketing on an app screen unless the PRD asks).
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
          who: { type: "string" },
          goal: { type: "string" },
          workflow: { type: "array", items: { type: "string" } },
          firstView: { type: "string" },
          primaryAction: { type: "string" },
          sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, purpose: { type: "string" }, part: { type: "string" } }, required: ["title", "purpose", "part"] } },
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
export function briefRequest(objective: string, prd: string, plan: ScreenPlan, manifest: CatalogManifest | undefined): string {
  const screens = plan.screens
    .map((s) => `## ${s.label}\nPurpose: ${s.purpose}\nParts for this screen:\n${briefParts(manifest, s.label).map((r) => `- ${r}: ${nameOf(r)}`).join("\n")}`)
    .join("\n\n");
  return `Product: ${plan.product}\nRequest: ${objective.slice(0, 800)}\n\nPRD (people, goals, journeys, screens):\n${prd}\n\nScreens:\n${screens}`;
}

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The model's answer, kept to the planned screens and to each screen's own parts (an ID it made up is dropped). */
export function parseScreenBriefs(raw: unknown, plan: ScreenPlan, manifest: CatalogManifest | undefined): ScreenBrief[] {
  const list = Array.isArray((raw as { screens?: unknown })?.screens) ? ((raw as { screens: unknown[] }).screens as Array<Record<string, unknown>>) : [];
  const out: ScreenBrief[] = [];
  for (const s of plan.screens) {
    const r = list.find((x) => text(x.screen, 60).toLowerCase() === s.label.toLowerCase()) ?? list.find((x) => text(x.screen, 60).toLowerCase().includes(s.label.toLowerCase()));
    if (!r) continue;
    const allowed = new Set(briefParts(manifest, s.label));
    const sections = (Array.isArray(r.sections) ? (r.sections as Array<Record<string, unknown>>) : [])
      .slice(0, 6)
      .map((x) => ({ title: text(x.title, 60), purpose: text(x.purpose, 200), part: allowed.has(text(x.part, 80)) ? text(x.part, 80) : "" }))
      .filter((x) => x.title);
    if (!sections.length) continue;
    out.push({
      screen: s.label,
      who: text(r.who, 160),
      goal: text(r.goal, 200),
      workflow: (Array.isArray(r.workflow) ? (r.workflow as unknown[]) : []).map((w) => text(w, 140)).filter(Boolean).slice(0, 5),
      firstView: text(r.firstView, 240),
      primaryAction: text(r.primaryAction, 100),
      sections,
    });
  }
  return out;
}

/** The briefs as the design steps and the visual review read them. */
export function screenBriefNote(briefs: ScreenBrief[]): string {
  if (!briefs.length) return "";
  return [
    "Screen briefs: design each screen to its brief, from the person's side. The top of the screen shows what they must see first (not a generic title over a list); the sections come in this order, each built from its catalog part (add_library_piece with the ID when it isn't in the app yet), filled with the spec's real content.",
    ...briefs.map((b) =>
      [
        `## ${b.screen}`,
        `For: ${b.who}. Goal: ${b.goal}`,
        b.workflow.length ? `Workflow: ${b.workflow.map((w, i) => `${i + 1}. ${w}`).join(" ")}` : "",
        `First view (without scrolling): ${b.firstView}`,
        `Main action: ${b.primaryAction}`,
        "Sections, top to bottom:",
        ...b.sections.map((x, i) => `${i + 1}. ${x.title}: ${x.purpose}${x.part ? ` [${x.part}]` : ""}`),
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}
