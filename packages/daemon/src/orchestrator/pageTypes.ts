/**
 * Page types: what kind of job a page does decides what it must contain and what it must not. A page plan names its
 * type first (the planner picks it from the person's job, not from what a template looks like); FlowCode then checks
 * the plan's parts against the type before anything is built:
 *  - a part that doesn't belong on this kind of page (a marketing hero, pricing or a newsletter on an app screen) is
 *    taken out and recorded, so the design step builds that section from core parts instead;
 *  - a page with nothing that does its job (a list page with no part that shows the results) is recorded as a gap,
 *    naming the catalog parts that would do it.
 * The states each type must design and its phone rule go into the page plan the design steps read.
 */
import { providersOf, relationsOf, type Capability, type PieceContext } from "@flowcode/contracts";

export type PageType = "home" | "list" | "detail" | "form" | "dashboard" | "review" | "settings" | "flow" | "conversation" | "booking" | "marketing" | "other";

export interface PageTypeRule {
  label: string;
  /** The person's job on it, for the planner choosing a type. */
  job: string;
  context: PieceContext;
  /** Each group: at least one of these capabilities must be provided by the page's parts. */
  needs: Capability[][];
  states: string[];
  phone: string;
  /** What doesn't belong on it. */
  avoid: string[];
}

const APP_AVOID = ["marketing heroes, pricing, testimonials, logo clouds or newsletter sign-ups", "a second search bar when the app already has one"];

export const PAGE_TYPES: Record<PageType, PageTypeRule> = {
  // An app's own front page (Clean Cart planning validation: a product-discovery Home typed "marketing" got a hero, a
  // call-to-action banner and a footer, and lost its storefront part as "not for a marketing page").
  home: { label: "App home", job: "start using the product: what it is in a line, search, featured things to open, and the way back to what they saved", context: "app", needs: [["results"]], states: ["loading", "nothing featured yet", "error"], phone: "the search first, featured items as cards below", avoid: ["a marketing funnel: hero banner with sign-up actions, call-to-action banner, pricing, testimonials, logo clouds, newsletter sign-up or a marketing footer", "a second search bar when the app already has one"] },
  list: { label: "List", job: "find, compare and open one of many things", context: "app", needs: [["results"]], states: ["loading", "nothing yet (first use)", "no matches for the search or filters", "error"], phone: "filters fold into a sheet or a disclosure; rows become cards, no sideways scrolling", avoid: APP_AVOID },
  detail: { label: "Detail", job: "understand one thing and act on it", context: "app", needs: [["detail", "history", "media", "compare"]], states: ["loading", "not found", "error"], phone: "one column; the main action stays in reach", avoid: APP_AVOID },
  form: { label: "Form", job: "create or change structured information", context: "app", needs: [["form", "upload", "date entry", "time entry"]], states: ["empty", "invalid field", "saving", "saved", "error"], phone: "one column; labels above fields; the submit button stays visible", avoid: APP_AVOID },
  dashboard: { label: "Dashboard", job: "watch how things stand and decide what needs attention", context: "app", needs: [["metrics", "chart"]], states: ["loading", "no data yet", "error"], phone: "the few most important numbers first, charts stacked below", avoid: APP_AVOID },
  review: { label: "Review", job: "check something and decide on it (approve, compare, accept)", context: "app", needs: [["review", "compare"]], states: ["loading", "nothing waiting", "decided", "error"], phone: "one item at a time; the decision buttons stay in reach", avoid: APP_AVOID },
  settings: { label: "Settings", job: "change how something works for them", context: "app", needs: [["settings", "form"]], states: ["saving", "saved", "error"], phone: "grouped rows; each setting's control on its row", avoid: APP_AVOID },
  flow: { label: "Guided flow", job: "complete a sequence of steps (onboarding, checkout, a wizard)", context: "app", needs: [["steps", "form"]], states: ["each step's error", "finished"], phone: "one step per screen with Back and Next", avoid: APP_AVOID },
  conversation: { label: "Conversation", job: "talk with people or an assistant", context: "app", needs: [["conversation"]], states: ["no messages yet", "sending", "failed to send"], phone: "the message box stays above the keyboard", avoid: APP_AVOID },
  booking: { label: "Booking", job: "pick a day and a time and book it", context: "app", needs: [["booking", "date entry"]], states: ["nothing free", "booked", "error"], phone: "the day first, then its times, then the button", avoid: APP_AVOID },
  marketing: { label: "Marketing page", job: "inform and persuade someone who isn't using the product yet", context: "marketing", needs: [], states: [], phone: "one column; the main call to action near the top", avoid: ["app data tables or admin controls"] },
  other: { label: "Other", job: "a job none of the types above describes", context: "app", needs: [], states: ["loading", "error"], phone: "one column at phone width", avoid: APP_AVOID },
};

export const PAGE_TYPE_IDS = Object.keys(PAGE_TYPES) as PageType[];

/**
 * The planner's choice when it gave one, else a guess from the page's name and purpose. In an app (`app`), a page is never
 * a marketing page: its front page is the app home, whatever the planner called it.
 */
export function pageTypeOf(given: unknown, name: string, purpose: string, detail = false, app = false): PageType {
  const g = String(given ?? "").toLowerCase().trim();
  if (app && (g === "marketing" || (!(PAGE_TYPE_IDS as string[]).includes(g) && /\b(home|landing|start)\b/i.test(name)))) return "home";
  if ((PAGE_TYPE_IDS as string[]).includes(g) && !(g === "home" && !app)) return g as PageType;
  if (detail) return "detail";
  const t = `${name} ${purpose}`.toLowerCase();
  if (/\b(book|booking|appointment|reserve|reservation)\b/.test(t)) return "booking";
  if (/\b(dashboard|overview|insights?|analytics|reports?)\b/.test(t)) return "dashboard";
  if (/\b(settings?|preferences|account)\b/.test(t)) return "settings";
  if (/\b(approv\w*|review|compare|decide)\b/.test(t)) return "review";
  if (/\b(chat|messages?|inbox|conversation)\b/.test(t)) return "conversation";
  if (/\b(onboarding|checkout|wizard|set ?up)\b/.test(t)) return "flow";
  if (/\b(new|create|add|edit|form|submit)\b/.test(t)) return "form";
  if (/\b(home|landing|about|pricing|marketing)\b/.test(t) && !/\b(app|dashboard)\b/.test(t)) return "marketing";
  if (/\b(list|browse|find|search|directory|catalog|library|all)\b/.test(t)) return "list";
  return "other";
}

export interface CompositionIssue {
  page: string;
  section: string;
  /** The part taken out, when the issue is a part that doesn't belong. */
  part?: string;
  reason: string;
}

/**
 * Checks one page plan's parts against its type. Returns the sections with parts that don't belong taken out, and the
 * issues: those removals, and the jobs nothing on the page does.
 */
export function checkComposition<S extends { title: string; part: string }>(page: string, type: PageType, sections: S[]): { sections: S[]; issues: CompositionIssue[] } {
  const rule = PAGE_TYPES[type];
  const issues: CompositionIssue[] = [];
  const kept = sections.map((s) => {
    if (!s.part) return s;
    const rel = relationsOf(s.part);
    if (!rel.contexts.includes(rule.context)) {
      issues.push({ page, section: s.title, part: s.part, reason: `${s.part} belongs on ${rel.contexts.map((c) => (c === "app" ? "app screens" : "marketing pages")).join(" and ")}, not on a ${rule.label.toLowerCase()} ${rule.context === "app" ? "app screen" : "page"}: build this section from core parts instead` });
      return { ...s, part: "" };
    }
    return s;
  });
  const provided = new Set(kept.flatMap((s) => (s.part ? relationsOf(s.part).provides : [])));
  for (const group of rule.needs) {
    if (group.some((c) => provided.has(c))) continue;
    const options = [...new Set(group.flatMap((c) => providersOf(c, rule.context)))].slice(0, 4);
    issues.push({ page, section: "(the page's main job)", reason: `A ${rule.label.toLowerCase()} page needs a part that gives it ${group.join(" or ")}; none was chosen${options.length ? `. Catalog parts that do: ${options.join(", ")}` : ""}` });
  }
  return { sections: kept, issues };
}

/** The decision tree the planner reads when it plans pages: one type per page, from the person's job. */
export function pageTypeGuide(): string {
  return [
    "Pick each page's type from the person's job on it (not from what a template looks like):",
    ...PAGE_TYPE_IDS.map((id) => `- ${id}: ${PAGE_TYPES[id].job}`),
    "If none fits, use other and say why in the purpose; never force a page into a type.",
    "App pages (every type but marketing) never get marketing heroes, pricing, testimonials, logo clouds or newsletter sign-ups.",
  ].join("\n");
}
