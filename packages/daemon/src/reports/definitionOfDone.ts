/**
 * The definition of done (from the agent prompt, skill and specification system), filled in from what the run
 * recorded rather than from what an agent said. Each item is met, not met, not checked (needs a person), or not
 * applicable to this run.
 */
import type { PlanClassification } from "@flowcode/contracts";

export type DoneStatus = "met" | "not_met" | "not_checked" | "not_applicable";
export interface DoneItem {
  item: string;
  status: DoneStatus;
  detail: string;
}

export interface DoneInput {
  classification?: PlanClassification;
  planApproved: boolean;
  /** Skill ids applied to any step of the run. */
  skillsApplied: string[];
  approvals: Array<{ action: string; status: string }>;
  verification: Array<{ kind: string; status: string; required: boolean }>;
  filesChanged: string[];
  /** The project has a live preview (so visual checks apply). */
  hasPreview: boolean;
}

const passed = (s?: string) => s === "passed" || s === "passed_with_warnings";
const ran = (s?: string) => !!s && s !== "not_run" && s !== "pending" && s !== "running";

export function definitionOfDone(d: DoneInput): DoneItem[] {
  const check = (kind: string) => d.verification.find((v) => v.kind === kind);
  const items: DoneItem[] = [];

  items.push(
    d.classification
      ? { item: "The request was classified", status: "met", detail: `${d.classification.label}${d.classification.concepts.length ? ` (${d.classification.concepts.join(", ")})` : ""}` }
      : { item: "The request was classified", status: "not_checked", detail: "This run was planned before classification existed." },
  );

  const wanted = d.classification?.skills ?? [];
  const missing = wanted.filter((s) => !d.skillsApplied.includes(s));
  items.push({
    item: "Relevant skills and specs were used",
    status: missing.length ? "not_met" : "met",
    detail: [
      d.skillsApplied.length ? `Skills applied: ${d.skillsApplied.map((s) => s.replace(/^skill\./, "")).join(", ")}.` : "No skills applied.",
      missing.length ? `Not applied: ${missing.map((s) => s.replace(/^skill\./, "")).join(", ")}.` : "",
      d.classification?.specNeeded ? (d.classification.specAttached ? "Built to the attached spec." : "A spec was recommended but none was attached.") : "",
    ]
      .filter(Boolean)
      .join(" "),
  });

  const outside = d.approvals.filter((a) => /outside the approved plan scope/.test(a.action));
  const outsideOk = outside.filter((a) => a.status === "approved").length;
  items.push({
    item: "The work stayed within the approved plan",
    status: !d.planApproved ? "not_met" : "met",
    detail: !d.planApproved ? "The plan was never approved." : outside.length ? `${outsideOk} edit${outsideOk === 1 ? "" : "s"} outside the plan approved by you, ${outside.length - outsideOk} refused.` : "No edits outside the planned files.",
  });

  const a11y = check("accessibility");
  items.push(
    !d.hasPreview && !a11y
      ? { item: "Accessibility, keyboard, small screens and reduced motion", status: "not_applicable", detail: "No screens to check in this project." }
      : passed(a11y?.status)
        ? { item: "Accessibility, keyboard, small screens and reduced motion", status: "not_checked", detail: "Automated accessibility checks passed. Keyboard use, small screens and reduced motion still need a look by a person." }
        : { item: "Accessibility, keyboard, small screens and reduced motion", status: ran(a11y?.status) ? "not_met" : "not_checked", detail: ran(a11y?.status) ? "The accessibility check found problems." : "The accessibility check didn't run." },
  );

  const design = check("design_qa");
  items.push(
    !d.hasPreview && !design
      ? { item: "Loading, empty, error and success states", status: "not_applicable", detail: "No screens to check in this project." }
      : { item: "Loading, empty, error and success states", status: passed(design?.status) ? "met" : ran(design?.status) ? "not_met" : "not_checked", detail: passed(design?.status) ? "The design check found the required states." : ran(design?.status) ? "The design check reported missing states or other problems." : "The design check didn't run; check the states by hand." },
  );

  const deps = d.filesChanged.filter((p) => /(^|\/)(package\.json|requirements[\w-]*\.txt|pyproject\.toml|Pipfile)$/.test(p));
  const schema = d.filesChanged.filter((p) => /(^|\/)(migrations?|prisma)\/|schema\.(prisma|sql)$|\.sql$/.test(p));
  items.push({
    item: "No unrequested dependencies, schema or API changes",
    status: deps.length || schema.length ? "not_checked" : "met",
    detail: deps.length || schema.length ? `Changed and worth a review: ${[...deps, ...schema].join(", ")}.` : "No dependency files, migrations or schema files changed.",
  });

  const kinds = ["typecheck", "lint", "tests", "build"].map((k) => [k, check(k)] as const).filter(([, c]) => c);
  const failed = kinds.filter(([, c]) => ran(c!.status) && !passed(c!.status)).map(([k]) => k);
  const skipped = kinds.filter(([, c]) => !ran(c!.status)).map(([k]) => k);
  items.push({
    item: "Type check, lint, tests and build were run",
    status: !kinds.length ? "not_applicable" : failed.length ? "not_met" : skipped.length ? "not_checked" : "met",
    detail: !kinds.length ? "The project has none of these checks." : [failed.length ? `Failed: ${failed.join(", ")}.` : "", skipped.length ? `Didn't run: ${skipped.join(", ")}.` : "", !failed.length && !skipped.length ? `Passed: ${kinds.map(([k]) => k).join(", ")}.` : ""].filter(Boolean).join(" "),
  });

  const preview = check("preview_health");
  const shots = check("screenshots");
  items.push(
    !d.hasPreview
      ? { item: "The changed screens were reviewed in a preview", status: "not_applicable", detail: "This project has no live preview." }
      : { item: "The changed screens were reviewed in a preview", status: passed(preview?.status) && passed(shots?.status) ? "met" : ran(preview?.status) && !passed(preview?.status) ? "not_met" : "not_checked", detail: passed(preview?.status) && passed(shots?.status) ? "The preview loaded and screenshots were taken." : ran(preview?.status) && !passed(preview?.status) ? "The preview didn't load." : "No preview or screenshots in this run." },
  );

  items.push({ item: "This report lists files changed, checks, limitations and open risks", status: "met", detail: "See the sections below." });
  return items;
}

export function renderDefinitionOfDone(items: DoneItem[]): string[] {
  const mark: Record<DoneStatus, string> = { met: "Met", not_met: "Not met", not_checked: "Needs a person", not_applicable: "Doesn't apply" };
  return ["## Definition of done", "", "Filled in from what this run recorded, not from what the agents said.", "", "| Item | Status | Detail |", "|---|---|---|", ...items.map((i) => `| ${i.item} | ${mark[i.status]} | ${i.detail.replace(/\|/g, "\\|")} |`), ""];
}
