/**
 * Reports (FR-O1–O3). Reports are generated from normalized records (never from model prose),
 * use repository-relative paths, and are redacted again before export (Markdown and PDF).
 */
import fs from "node:fs";
import path from "node:path";
import { checkCouldNotRun, runStatusLabel } from "@flowcode/contracts";
import { getReview, needsHumanReview } from "../quality/humanReview.js";
import { compositionKey, type CompositionManifest } from "../orchestrator/compositionManifest.js";
import { coverageKey, type CoverageRow } from "../orchestrator/experienceMap.js";
import { definitionOfDone, renderDefinitionOfDone, type DoneItem } from "./definitionOfDone.js";
import type { Finding, ReferenceFile, Run } from "@flowcode/contracts";
import { extractRequirements, referencePath, summarizeReference } from "../quality/spec.js";
import type { Store, ArtifactRecord } from "../db/store.js";
import type { ArtifactService } from "../db/artifacts.js";
import type { ProjectService } from "../workspace/projects.js";
import type { ProcessManager } from "../commands/processManager.js";
import type { GateResult } from "../orchestrator/completionGate.js";
import { redact, redactValue } from "../security/redaction.js";
import { MANUAL_A11Y_CHECKLIST } from "../quality/a11yStatic.js";
import { COMPLIANCE_DISCLAIMER } from "../quality/staticTriage.js";
import { BrowserSession, htmlToPdf } from "../quality/preview.js";
import { repositoryMap, renderRepositoryMap } from "../knowledge/skills.js";
import { staticAccessibility } from "../quality/a11yStatic.js";
import { designQa } from "../quality/designQa.js";
import { complianceTriage, securityTriage, seoTriage } from "../quality/staticTriage.js";

export interface RunReportData {
  generatedAt: string;
  run: { id: string; objective: string; status: string; startedAt?: string; completedAt?: string; strategy?: string; template?: string };
  project: { name: string; type?: string };
  verdict?: { status: string; unmet: string[]; warnings: string[] };
  plan?: { goal: string; risk: string; assumptions: string[]; rollback: string; approved: boolean };
  agents: Array<{ role: string; provider: string; model: string; version?: string; toolCalls: number }>;
  tasks: Array<{ title: string; status: string; attempts: number; paths: string[]; blocker?: string; criteria: Array<{ description: string; met?: boolean; evidence: string[] }> }>;
  filesChanged: Array<{ path: string; operations: string[]; restored: boolean }>;
  approvals: Array<{ action: string; kind: string; risk: string; status: string; scope?: string }>;
  commands: Array<{ argv: string; status: string; exitCode?: number; durationMs?: number; policy: string; fingerprint?: string }>;
  verification: Array<{ kind: string; status: string; required: boolean; summary: string; evidence: string[] }>;
  screenshots: Array<{ label: string; artifactId: string }>;
  findings: { accessibility: number; design: number; security: number; compliance: number; seo: number };
  unresolvedRisks: string[];
  launch: string[];
  manualChecklist: string[];
  definitionOfDone: DoneItem[];
  spec?: { references: Array<{ name: string; role: string; path: string; summary: string }>; requirements: Array<{ id: string; text: string; section: string; tasks: string[] }> };
  /** A prototype build's review by the person: until it is signed off, the build is not complete. */
  humanReview?: { state: string; label: string; version: number; signedOff?: string };
  /** What is simulated, and what wasn't checked or built: said plainly, never left out. */
  limitations: string[];
}

export class ReportService {
  constructor(
    private store: Store,
    private artifacts: ArtifactService,
    private projects: ProjectService,
    private processes: ProcessManager,
  ) {}

  collect(run: Run, gate?: GateResult): RunReportData {
    const project = this.store.projects.require(run.projectId);
    const tasks = this.store.tasks.where("run_id = ? ORDER BY ordinal ASC", run.id);
    const toolCalls = this.store.toolCalls.where("run_id = ?", run.id);
    const commands = this.store.commands.where("run_id = ? ORDER BY created_at ASC", run.id);
    const approvals = this.store.approvals.where("run_id = ? ORDER BY created_at ASC", run.id);
    const checks = this.store.checks.where("run_id = ? ORDER BY updated_at ASC", run.id).filter((c) => !c.taskId);
    const snaps = this.store.snapshots.where("run_id = ? ORDER BY seq ASC", run.id);
    const arts = this.artifacts.forRun(run.id);
    const files = new Map<string, { ops: Set<string>; restored: boolean }>();
    for (const s of snaps) {
      const e = files.get(s.relativePath) ?? { ops: new Set<string>(), restored: false };
      e.ops.add(s.operation);
      if (s.restoredAt) e.restored = true;
      files.set(s.relativePath, e);
    }
    const byRole = new Map<string, { a: (typeof toolCalls)[number]["modelAssignment"]; n: number }>();
    for (const t of toolCalls) {
      const e = byRole.get(t.agentRole) ?? { a: t.modelAssignment, n: 0 };
      e.n++;
      byRole.set(t.agentRole, e);
    }
    const countFindings = (label: string) => {
      const a = arts.find((x) => x.label.toLowerCase().startsWith(label));
      return Number((a?.meta as { findings?: number } | undefined)?.findings ?? 0);
    };
    const a11yArt = arts.find((x) => x.kind === "axe");
    const pf = this.projects.latestPreflight(project.id);
    const devScript = pf?.scripts.find((s) => s.classification === "dev");
    const risks: string[] = [];
    for (const t of tasks) if (t.blocker) risks.push(`${t.title}: ${t.blocker.reason}`);
    for (const c of checks) if (c.status === "failed" || c.status === "blocked") risks.push(`${c.kind} ${c.status}: ${c.summary}`);
    if (gate) risks.push(...gate.unmet.filter((u) => !risks.some((r) => r.includes(u))));
    // Skills actually given to the agents, from the run's skill.applied events.
    const skillsApplied = [
      ...new Set(
        this.store.db
          .all<{ data: string }>("SELECT data FROM events WHERE run_id = ? AND type = 'skill.applied'", run.id)
          .flatMap((r) => ((JSON.parse(r.data) as { data?: { skills?: string[] } }).data?.skills ?? []).map((id) => String(id).split("@")[0])),
      ),
    ];
    const report: RunReportData = {
      generatedAt: new Date().toISOString(),
      run: { id: run.id, objective: run.objective, status: run.status, startedAt: run.startedAt, completedAt: run.completedAt, strategy: run.strategy?.kind, template: run.strategy?.templateId },
      project: { name: project.name, type: project.projectType },
      verdict: gate ? { status: gate.status, unmet: gate.unmet, warnings: gate.warnings } : undefined,
      plan: run.plan ? { goal: run.plan.goal, risk: run.plan.risk, assumptions: run.plan.assumptions, rollback: run.plan.rollbackStrategy, approved: run.planApproved } : undefined,
      agents: [...byRole.entries()].map(([role, e]) => ({ role, provider: e.a.providerId, model: e.a.model, version: e.a.version, toolCalls: e.n })),
      tasks: tasks.map((t) => ({ title: t.title, status: t.status, attempts: t.attempts, paths: t.actualPaths, blocker: t.blocker?.reason, criteria: t.acceptanceCriteria.map((c) => ({ description: c.description, met: c.met, evidence: c.evidenceRefs })) })),
      filesChanged: [...files.entries()].map(([p, e]) => ({ path: p, operations: [...e.ops], restored: e.restored })),
      approvals: approvals.map((a) => ({ action: a.action, kind: a.kind, risk: a.risk, status: a.status, scope: a.decisionScope })),
      commands: commands.map((c) => ({ argv: c.argv.join(" "), status: c.status, exitCode: c.exitCode, durationMs: c.durationMs, policy: c.policyTier, fingerprint: c.errorFingerprint })),
      verification: checks.map((c) => ({ kind: c.kind, status: c.status, required: c.required, summary: c.summary, evidence: c.evidenceRefs })),
      definitionOfDone: definitionOfDone({
        classification: run.plan?.classification,
        planApproved: run.planApproved,
        skillsApplied,
        approvals: approvals.map((a) => ({ action: a.action, status: a.status })),
        verification: checks.map((c) => ({ kind: c.kind, status: c.status, required: c.required })),
        filesChanged: [...files.keys()],
        hasPreview: (pf?.previewStrategy ?? "none") !== "none",
      }),
      screenshots: arts.filter((a) => a.kind === "screenshot").map((a) => ({ label: a.label, artifactId: a.id })),
      findings: {
        accessibility: Number((a11yArt?.meta as { static?: number; axe?: number } | undefined)?.static ?? 0) + Number((a11yArt?.meta as { axe?: number } | undefined)?.axe ?? 0),
        design: countFindings("design qa"),
        security: countFindings("security"),
        compliance: countFindings("compliance"),
        seo: countFindings("seo"),
      },
      unresolvedRisks: risks,
      launch: pf?.packageManager && pf.packageManager !== "none" ? [`cd <your workspace>`, ...(pf.hasNodeModules ? [] : [`${pf.packageManager} install`]), devScript ? `${pf.packageManager} run ${devScript.name}` : `${pf.packageManager} start`] : ["Open index.html in a browser"],
      manualChecklist: MANUAL_A11Y_CHECKLIST,
      spec: this.specSection(run.id, tasks),
      humanReview: this.reviewSection(run, !!gate && ["done", "done_with_warnings", "done_unverified"].includes(gate.status)),
      limitations: this.limitations(run, this.projects.jail(project).root),
    };
    return redactValue(report);
  }

  /** Where the person's review stands (prototype builds). A build whose checks just passed is waiting for it. */
  private reviewSection(run: Run, checksPassed: boolean): RunReportData["humanReview"] {
    if (!needsHumanReview({ store: this.store }, run)) return undefined;
    const r = getReview({ store: this.store }, run.id);
    const state = r?.state ?? (checksPassed ? "ready_for_review" : undefined);
    if (!state) return undefined;
    return { state, label: runStatusLabel({ status: run.status, review: state }), version: r?.version ?? 1, signedOff: r?.signedOff ? `version ${r.signedOff.version} on ${r.signedOff.at}` : undefined };
  }

  /** The report's "Simulated and limitations": what the prototype only pretends to do, and what wasn't checked or built. */
  private limitations(run: Run, root: string): string[] {
    const out: string[] = [];
    if (fs.existsSync(path.join(root, "src/sim"))) out.push("Data, sign-in and saving are simulated in the browser with sample data (src/sim); nothing reaches a server or a real account.");
    if (needsHumanReview({ store: this.store }, run)) out.push("Accessibility: a visual audit and a contrast check only (a prototype); not a WCAG conformance claim.");
    const all = this.store.checks.where("run_id = ? ORDER BY updated_at ASC", run.id);
    const latest = new Map<string, (typeof all)[number]>();
    for (const c of all) latest.set(`${c.taskId ?? ""}|${c.kind}`, c);
    for (const c of latest.values()) {
      if (checkCouldNotRun(c.status, c.summary) || (c.status === "skipped" && /unavailable/i.test(c.summary))) out.push(`Not checked: ${c.summary.slice(0, 240)}`);
    }
    const coverage = this.store.getSetting<CoverageRow[]>(coverageKey(run.id), []);
    const later = coverage.filter((r) => r.status === "not in this release");
    const person = coverage.filter((r) => r.status === "for a person to check");
    const gaps = coverage.filter((r) => r.status === "no workflow" || r.status === "unplaced");
    if (later.length) out.push(`Not in this release: ${later.map((r) => r.requirement).join(", ")}.`);
    if (person.length) out.push(`For a person to check (not tested by FlowCode): ${person.map((r) => r.requirement).join(", ")}.`);
    if (gaps.length) out.push(`Requirements without a user journey or a place in the plan: ${gaps.map((r) => r.requirement).join(", ")} (see the scope decisions on the plan).`);
    const comp = this.store.getSetting<CompositionManifest | null>(compositionKey(run.id), null);
    if (comp?.gaps.length) out.push(`Built by hand because no catalog part fits: ${comp.gaps.map((g) => `${g.page}: ${g.section}`).join("; ")}.`);
    const unused = (comp?.entries ?? []).filter((e) => e.verification && !e.verification.usedBy.length);
    if (unused.length) out.push(`Catalog parts planned but not used on a page: ${[...new Set(unused.map((e) => e.ref))].join(", ")}.`);
    return out;
  }

  /** Spec references and PRD requirement → task traceability (keyword overlap heuristic, labelled as such). */
  private specSection(runId: string, tasks: Array<{ title: string; objective: string; acceptanceCriteria: Array<{ description: string }> }>): RunReportData["spec"] {
    const refs = this.store.getSetting<ReferenceFile[]>(`runRefs:${runId}`, []);
    if (!refs.length) return undefined;
    const prd = refs.find((r) => r.role === "prd") ?? refs.find((r) => r.role === "text");
    const stop = new Set(["the", "and", "for", "with", "that", "this", "must", "should", "shall", "will", "can", "are", "from", "into", "each", "when", "user", "users", "have", "has", "not", "all", "any", "able"]);
    const terms = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stop.has(w)));
    const taskTerms = tasks.map((t) => ({ title: t.title, terms: terms(`${t.title} ${t.objective} ${t.acceptanceCriteria.map((c) => c.description).join(" ")}`) }));
    const requirements = prd
      ? extractRequirements(prd.content).map((r) => {
          const rt = terms(r.text);
          const hits = taskTerms.filter((t) => [...rt].filter((w) => t.terms.has(w)).length >= Math.min(2, rt.size)).map((t) => t.title);
          return { ...r, tasks: hits.slice(0, 3) };
        })
      : [];
    return { references: refs.map((r) => ({ name: r.name, role: r.role, path: referencePath(r), summary: summarizeReference(r) })), requirements };
  }

  buildRunReport(run: Run, gate?: GateResult): ArtifactRecord {
    const data = this.collect(run, gate);
    this.artifacts.save({ runId: run.id, kind: "report_json", label: "Run report data", mime: "application/json", content: JSON.stringify(data, null, 2) });
    return this.artifacts.save({ runId: run.id, kind: "report_md", label: gate ? `Final report (${gate.status})` : "Report (pre-gate)", mime: "text/markdown", content: renderRunMarkdown(data) });
  }

  latestReport(runId: string): { record: ArtifactRecord; markdown: string; data?: RunReportData } | undefined {
    const md = this.store.artifacts.where("run_id = ? AND kind = 'report_md' ORDER BY created_at DESC LIMIT 1", runId)[0];
    if (!md) return undefined;
    const json = this.store.artifacts.where("run_id = ? AND kind = 'report_json' ORDER BY created_at DESC LIMIT 1", runId)[0];
    return { record: md, markdown: this.artifacts.objects.get(md.contentRef).toString("utf8"), data: json ? (JSON.parse(this.artifacts.objects.get(json.contentRef).toString("utf8")) as RunReportData) : undefined };
  }

  async exportPdf(runId: string, markdown: string): Promise<ArtifactRecord> {
    const session = await BrowserSession.launch(runId, this.processes);
    try {
      const pdf = await htmlToPdf(session, markdownToHtml(redact(markdown)));
      return this.artifacts.save({ runId, kind: "report_pdf", label: "Report (PDF)", mime: "application/pdf", content: pdf });
    } finally {
      await session.close();
    }
  }

  /** FR-O2 repository intelligence report from deterministic analysis. */
  repositoryIntelligence(projectId: string): string {
    const jail = this.projects.jail(projectId);
    const project = this.store.projects.require(projectId);
    const map = repositoryMap(jail);
    const a11y = staticAccessibility(jail);
    const design = designQa(jail);
    const sec = securityTriage(jail);
    const comp = complianceTriage(jail);
    const seo = seoTriage(jail);
    const section = (title: string, findings: Finding[], note?: string) =>
      [`## ${title}`, note ? `> ${note}` : "", findings.length ? findings.slice(0, 25).map((f) => `- **${f.severity}** \`${f.rule}\` ${f.message}${f.path ? ` — \`${f.path}${f.line ? `:${f.line}` : ""}\`` : ""}${f.manualValidationRequired ? " _(manual validation required)_" : ""}`).join("\n") : "- No findings"].filter(Boolean).join("\n");
    return redact(
      [
        `# Repository intelligence — ${project.name}`,
        `_Generated ${new Date().toISOString()} from local static analysis. Paths are repository-relative._`,
        renderRepositoryMap(map).replace(/^# Repository map/, "## Architecture"),
        `## Product intelligence`,
        `- Entry points: ${map.entryPoints.join(", ") || "none detected"}`,
        `- Role journeys, monetization and competitive research require enabled research and are not inferred from code.`,
        `## Engineering quality`,
        `- Tests: ${map.tests.length} file(s)`,
        `- Scripts: ${map.scripts.map((s) => `${s.name} (${s.policy})`).join(", ") || "none"}`,
        section("Security (static triage)", sec, "Static inspection only; no exploitation or network scanning was performed."),
        section("Compliance triage", comp, COMPLIANCE_DISCLAIMER),
        section("Accessibility (static)", a11y, "Automated static checks only; not a WCAG conformance claim."),
        section("Design system", design),
        section("SEO & metadata", seo),
      ].join("\n\n"),
    );
  }
}

const icon = (s?: string) => (s === "passed" || s === "verified" || s === "done" ? "PASS" : s === "passed_with_warnings" || s === "done_with_warnings" || s === "done_unverified" ? "WARN" : s === "skipped" || s === "not_run" ? "SKIP" : s === "pending" || s === "running" ? "…" : "FAIL");

export function renderRunMarkdown(d: RunReportData): string {
  const L: string[] = [];
  L.push(`# FlowCode run report`, "");
  L.push(`**Objective:** ${d.run.objective}`, "");
  L.push(`| | |`, `|---|---|`, `| Project | ${d.project.name} (${d.project.type ?? "unknown"}) |`, `| Run | \`${d.run.id}\` |`, `| Status | **${d.humanReview && d.humanReview.state !== "signed_off" ? `${d.humanReview.label} (checks: ${d.verdict?.status ?? d.run.status})` : (d.verdict?.status ?? d.run.status)}** |`, `| Strategy | ${d.run.strategy ?? "-"}${d.run.template ? ` · template \`${d.run.template}\`` : ""} |`, `| Started | ${d.run.startedAt ?? "-"} |`, `| Completed | ${d.run.completedAt ?? "-"} |`, `| Generated | ${d.generatedAt} |`, "");
  if (d.verdict) {
    L.push(`## Completion gate`, "", `Computed deterministically from records — not from model output.`, "");
    if (d.verdict.unmet.length) L.push(`**Unmet requirements**`, ...d.verdict.unmet.map((u) => `- ${u}`), "");
    if (d.verdict.warnings.length) L.push(`**Warnings**`, ...d.verdict.warnings.map((u) => `- ${u}`), "");
    if (!d.verdict.unmet.length && !d.verdict.warnings.length) L.push(d.humanReview && d.humanReview.state !== "signed_off" ? `Every required check has its evidence. The prototype is not complete until you review every page and user journey and sign off.` : `All required evidence present.`, "");
  }
  if (d.humanReview) L.push(`## Your review`, "", d.humanReview.signedOff ? `Signed off: ${d.humanReview.signedOff}.` : `${d.humanReview.label} (version ${d.humanReview.version}). Open the build's Details to approve each page and user journey or request changes, then sign off.`, "");
  if (d.limitations?.length) L.push(`## Simulated and limitations`, "", ...d.limitations.map((l) => `- ${l}`), "");
  if (d.plan) L.push(`## Plan`, "", `- Goal: ${d.plan.goal}`, `- Risk: ${d.plan.risk}`, `- Approved: ${d.plan.approved ? "yes" : "no"}`, `- Rollback: ${d.plan.rollback}`, ...d.plan.assumptions.map((a) => `- Assumption: ${a}`), "");
  L.push(`## Agents and models`, "", d.agents.length ? `| Role | Provider | Model | Tool calls |\n|---|---|---|---|\n${d.agents.map((a) => `| ${a.role} | ${a.provider} | ${a.model}${a.version ? ` (${a.version})` : ""} | ${a.toolCalls} |`).join("\n")}` : "Runtime-only steps (no model tool calls).", "");
  if (d.definitionOfDone?.length) L.push(...renderDefinitionOfDone(d.definitionOfDone));
  L.push(`## Tasks`, "");
  for (const t of d.tasks) {
    L.push(`### ${icon(t.status)} ${t.title}`, `Status: \`${t.status}\` · attempts: ${t.attempts}${t.paths.length ? ` · files: ${t.paths.map((p) => `\`${p}\``).join(", ")}` : ""}`);
    if (t.blocker) L.push(`> Blocker: ${t.blocker}`);
    for (const c of t.criteria) L.push(`- [${c.met ? "x" : " "}] ${c.description}${c.evidence.length ? ` — evidence: ${c.evidence.join(", ")}` : ""}`);
    L.push("");
  }
  L.push(`## Verification matrix`, "", `| Check | Required | Status | Summary | Evidence |`, `|---|---|---|---|---|`, ...d.verification.map((v) => `| ${v.kind} | ${v.required ? "yes" : "no"} | ${icon(v.status)} \`${v.status}\` | ${v.summary.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 220)} | ${v.evidence.join(", ")} |`), "");
  L.push(`## Files changed`, "", d.filesChanged.length ? d.filesChanged.map((f) => `- \`${f.path}\` — ${f.operations.join(", ")}${f.restored ? " (restored)" : ""}`).join("\n") : "- none", "");
  L.push(`## Approvals`, "", d.approvals.length ? d.approvals.map((a) => `- ${a.status.toUpperCase()}${a.scope ? ` (${a.scope})` : ""} · ${a.kind} · ${a.risk} risk — ${a.action}`).join("\n") : "- none", "");
  L.push(`## Commands`, "", d.commands.length ? `| Command | Policy | Status | Exit | Duration |\n|---|---|---|---|---|\n${d.commands.map((c) => `| \`${c.argv.replace(/\|/g, "\\|")}\` | ${c.policy} | ${c.status} | ${c.exitCode ?? "-"} | ${c.durationMs ? `${(c.durationMs / 1000).toFixed(1)}s` : "-"} |`).join("\n")}` : "- none", "");
  L.push(`## Screenshots`, "", d.screenshots.length ? d.screenshots.map((s) => `- ${s.label} (artifact \`${s.artifactId}\`)`).join("\n") : "- none captured", "");
  L.push(`## Quality findings`, "", `- Accessibility: ${d.findings.accessibility} (automated; not a conformance claim)`, `- Design QA: ${d.findings.design}`, `- Security (static triage, manual validation required): ${d.findings.security}`, `- Compliance triage: ${d.findings.compliance} — ${COMPLIANCE_DISCLAIMER}`, `- SEO/metadata: ${d.findings.seo}`, "");
  if (d.spec) {
    L.push(`## Spec references`, "", ...d.spec.references.map((r) => `- \`${r.path}\` (${r.role}) — ${r.summary}`), "");
    if (d.spec.requirements.length) {
      const mapped = d.spec.requirements.filter((r) => r.tasks.length).length;
      L.push(
        `## PRD traceability`,
        "",
        `${mapped}/${d.spec.requirements.length} requirement lines map to at least one task (keyword match — a heuristic; unmapped lines need human review).`,
        "",
        `| ID | Requirement | Section | Tasks |`,
        `|---|---|---|---|`,
        ...d.spec.requirements.map((r) => `| ${r.id} | ${r.text.replace(/\|/g, "\\|").slice(0, 160)} | ${r.section.replace(/\|/g, "\\|")} | ${r.tasks.join("; ") || "**unmapped**"} |`),
        "",
      );
    }
  }
  L.push(`## Unresolved risks`, "", d.unresolvedRisks.length ? d.unresolvedRisks.map((r) => `- ${r}`).join("\n") : "- none recorded", "");
  L.push(`## Manual review checklist (accessibility)`, "", ...d.manualChecklist.map((m) => `- [ ] ${m}`), "");
  L.push(`## How to run`, "", "```bash", ...d.launch, "```", "");
  return L.join("\n");
}

/** Minimal, dependency-free Markdown → HTML for PDF export (headings, tables, lists, code, emphasis). */
export function markdownToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      i++;
      continue;
    }
    if (/^\|.*\|$/.test(l) && /^\|[-| ]+\|$/.test(lines[i + 1] ?? "")) {
      const cells = (r: string) => r.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (/^\s*- /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*- /.test(lines[i])) items.push(lines[i++].replace(/^\s*- (\[[ x]\] )?/, (_m, box) => (box ? (box.includes("x") ? "☑ " : "☐ ") : "")));
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    } else if (l.startsWith("> ")) out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`);
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    i++;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FlowCode report</title><style>
  body{font:12px/1.5 "Segoe UI",system-ui,sans-serif;color:#16181d;margin:0}
  h1{font-size:22px;margin:0 0 8px;border-bottom:2px solid #6d4aff;padding-bottom:6px}
  h2{font-size:15px;margin:18px 0 6px;color:#2a2d35}h3{font-size:13px;margin:12px 0 4px}
  table{border-collapse:collapse;width:100%;margin:6px 0;font-size:10.5px}th,td{border:1px solid #d8dbe2;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f2f3f6}code{font-family:Consolas,monospace;background:#f2f3f6;padding:0 3px;border-radius:3px}
  pre{background:#16181d;color:#e7e4de;padding:8px;border-radius:6px}pre code{background:none;color:inherit}
  blockquote{border-left:3px solid #e3a008;margin:6px 0;padding:2px 8px;background:#fff8e6}ul{margin:4px 0 8px 18px;padding:0}
  </style></head><body>${out.join("\n")}</body></html>`;
}
