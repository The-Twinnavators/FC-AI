/**
 * Structured handoff packets (FR-A3). Agents receive a compact evidence packet — objective, accepted
 * decisions, current state, relevant artifacts, findings and blockers — never raw chat history.
 */
import type { KnowledgeItem, Run, Task } from "@flowcode/contracts";
import { untrusted } from "./prompts.js";

export interface HandoffPacket {
  runObjective: string;
  task: { title: string; objective: string; expectedPaths: string[]; acceptanceCriteria: string[] };
  acceptedDecisions: string[];
  constraints: string[];
  completedTasks: Array<{ title: string; changedPaths: string[] }>;
  relevantFiles: Array<{ path: string; excerpt: string }>;
  findings: string[];
  openBlockers: string[];
  knowledge: Array<{ title: string; content: string; provenance: string }>;
}

/** What the runtime will actually test for a criterion, in words the coder can act on. */
export function checkHint(check: Task["acceptanceCriteria"][number]["check"]): string {
  switch (check.type) {
    case "file_contains":
      return ` [checked: ${check.path} must contain the exact text \`${check.text}\`; if that is a name the file doesn't use yet, introduce it and use it for this behaviour]`;
    case "file_not_contains":
      return ` [checked: ${check.path} must no longer contain \`${check.text}\`]`;
    case "file_exists":
      return ` [checked: ${check.path} must exist]`;
    case "verification":
      return ` [checked: the ${check.kind} check must pass]`;
    case "manual":
      return " [reviewed by FlowCode after this task; there is nothing to run for it]";
  }
}

export function buildHandoff(args: {
  run: Run;
  task: Task;
  allTasks: Task[];
  files: Array<{ path: string; content: string }>;
  findings?: string[];
  knowledge?: KnowledgeItem[];
  workspaceSummary?: string;
}): HandoffPacket {
  const { run, task, allTasks } = args;
  return {
    runObjective: run.objective,
    task: {
      title: task.title,
      objective: task.objective,
      expectedPaths: task.expectedPaths,
      // Manual items (mostly from skills) are reviewed by FlowCode afterwards; say so, or models try to "run" them.
      // The exact test, not just the description: a check for a name the file doesn't use yet can only pass if the
      // coder knows that name ("does not contain selectedMonth" when the file calls it cursor blocked a whole run).
      acceptanceCriteria: task.acceptanceCriteria.map((c) => `${c.description}${checkHint(c.check)}`),
    },
    acceptedDecisions: [
      ...(run.plan ? [`Approved plan goal: ${run.plan.goal}`, ...run.plan.assumptions.map((a) => `Assumption: ${a}`)] : []),
      ...(run.strategy?.templateId ? [`Starter template: ${run.strategy.templateId}`] : []),
    ],
    constraints: run.constraints,
    completedTasks: allTasks.filter((t) => t.status === "verified").map((t) => ({ title: t.title, changedPaths: t.actualPaths })),
    relevantFiles: args.files.map((f) => ({ path: f.path, excerpt: f.content.slice(0, 6000) })),
    findings: args.findings ?? [],
    openBlockers: allTasks.filter((t) => t.blocker && t.id !== task.id).map((t) => `${t.title}: ${t.blocker!.reason}`),
    knowledge: (args.knowledge ?? []).filter((k) => !k.excluded).map((k) => ({ title: k.title, content: k.content.slice(0, 1500), provenance: k.provenance.map((p) => `${p.kind}:${p.ref}`).join(", ") })),
  };
}

/** Renders a packet as the agent's user message, delimiting file contents and knowledge as untrusted data. */
export function renderHandoff(p: HandoffPacket, workspaceTree: string, scripts?: string[]): string {
  const lines: string[] = [];
  lines.push(`# Task: ${p.task.title}`, "", p.task.objective, "");
  lines.push(`Run objective: ${p.runObjective}`);
  // Without this list models invent scripts ("check-footer", "test:search"); to check file content, read the file.
  if (scripts) lines.push(scripts.length ? `Scripts run_script can run (no others exist): ${scripts.join(", ")}. To check what a file contains, use read_file or search_files.` : "This project has no package.json scripts; don't call run_script. To check what a file contains, use read_file or search_files.");
  if (p.constraints.length) lines.push(`Constraints:\n${p.constraints.map((c) => `- ${c}`).join("\n")}`);
  if (p.acceptedDecisions.length) lines.push(`Accepted decisions:\n${p.acceptedDecisions.map((c) => `- ${c}`).join("\n")}`);
  lines.push(`Expected paths (approved scope): ${p.task.expectedPaths.join(", ") || "(none specified)"}`);
  lines.push(`Acceptance criteria (verified by the runtime):\n${p.task.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`);
  if (p.completedTasks.length) lines.push(`Completed tasks:\n${p.completedTasks.map((t) => `- ${t.title} (${t.changedPaths.join(", ") || "no files"})`).join("\n")}`);
  if (p.findings.length) lines.push(`Findings from previous attempts:\n${p.findings.map((f) => `- ${f}`).join("\n")}`);
  if (p.openBlockers.length) lines.push(`Open blockers elsewhere:\n${p.openBlockers.map((f) => `- ${f}`).join("\n")}`);
  lines.push("", "Workspace tree:", untrusted("workspace-tree", workspaceTree));
  for (const f of p.relevantFiles) lines.push("", `File ${f.path}:`, untrusted(f.path, f.excerpt));
  for (const k of p.knowledge) lines.push("", `Knowledge "${k.title}" (provenance: ${k.provenance}):`, untrusted("knowledge", k.content));
  lines.push("", "Start by inspecting what you need, then make the changes with tools, then call task_complete.");
  return lines.join("\n");
}
