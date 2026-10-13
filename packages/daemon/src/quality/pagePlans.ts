/**
 * A project's page plans as one view (GET /projects/:id/pages): for the latest build that planned pages, each page's
 * type and job, its sections in order with their catalog parts and whether the app uses each part yet, the states it
 * must design, its phone rule, what doesn't belong on it, the page-type checks' findings and the layout changes made
 * during the build with their reasons. Read from the build's records; "used" is checked against the app's files now.
 */
import type { App } from "../app.js";
import { compositionKey, verifyManifest, type CompositionManifest } from "../orchestrator/compositionManifest.js";
import { PAGE_TYPES } from "../orchestrator/pageTypes.js";
import { screenBriefKey, type ScreenBrief } from "../orchestrator/screenBrief.js";
import { screenPlanKey, type ScreenPlan } from "../orchestrator/screenPlan.js";

export interface PagePlanView {
  page: string;
  route: string;
  file: string;
  type?: { id: string; label: string; job: string };
  who: string;
  goal: string;
  firstView: string;
  primaryAction: string;
  sections: Array<{ title: string; purpose: string; part: string; status: "used" | "not used yet" | "changed" | "no part" }>;
  states: string[];
  phone: string;
  avoid: string[];
  navIn: string[];
  navOut: string[];
  acceptance: string[];
  findings: string[];
  changes: Array<{ section: string; change: string; ref?: string; why: string; by: string }>;
}

export function projectPages(app: App, projectId: string): { runId?: string; pages: PagePlanView[] } {
  const project = app.store.projects.require(projectId);
  const run = app.store.runs.where("project_id = ? ORDER BY created_at DESC", projectId).find((r) => app.store.getSetting<ScreenBrief[]>(screenBriefKey(r.id), []).length > 0);
  if (!run) return { pages: [] };
  const briefs = app.store.getSetting<ScreenBrief[]>(screenBriefKey(run.id), []);
  const plan = app.store.getSetting<ScreenPlan | null>(screenPlanKey(run.id), null);
  let comp = app.store.getSetting<CompositionManifest | null>(compositionKey(run.id), null) ?? { entries: [], gaps: [], changes: [] };
  try {
    comp = verifyManifest(app.projects.jail(project).root, comp);
  } catch {
    /* the workspace is gone: keep the last recorded check */
  }
  const pages = briefs.map((b): PagePlanView => {
    const screen = plan?.screens.find((s) => s.label === b.screen);
    const rule = b.pageType ? PAGE_TYPES[b.pageType] : undefined;
    const changes = (comp.changes ?? []).filter((c) => c.page === b.screen);
    return {
      page: b.screen,
      route: screen ? `#/${screen.id}` : "",
      file: screen?.file ?? "",
      type: rule && b.pageType ? { id: b.pageType, label: rule.label, job: rule.job } : undefined,
      who: b.who,
      goal: b.goal,
      firstView: b.firstView,
      primaryAction: b.primaryAction,
      sections: b.sections.map((x) => {
        const entries = comp.entries.filter((e) => e.page === b.screen && e.section === x.title);
        const status = changes.some((c) => c.section === x.title) ? "changed" : !x.part ? "no part" : entries.some((e) => e.verification?.usedBy.length) ? "used" : "not used yet";
        return { title: x.title, purpose: x.purpose, part: x.part, status };
      }),
      states: [...new Set([...(rule?.states ?? []), ...Object.entries(b.states ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)])],
      phone: [b.responsive, rule?.phone].filter(Boolean).join("; "),
      avoid: rule?.avoid ?? [],
      navIn: b.navIn ?? [],
      navOut: b.navOut ?? [],
      acceptance: b.acceptance ?? [],
      findings: comp.gaps.filter((g) => g.page === b.screen).map((g) => (g.section.startsWith("(") ? g.reason : `${g.section}: ${g.reason}`)),
      changes: changes.map((c) => ({ section: c.section, change: c.change, ref: c.ref, why: c.why, by: c.by })),
    };
  });
  return { runId: run.id, pages };
}
