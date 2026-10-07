/**
 * Golden-path benchmark (Phase 5, §19 "MVP proof build"). Runs the personal-scheduler request end to end
 * from clean, empty workspaces with the configured local Coder model, then records evidence.
 *
 * The harness stands in for the user at approval points and logs every decision it makes:
 *   - approves the plan and the dependency install (the plan's declared consequential operations),
 *   - approves verified-script commands,
 *   - approves out-of-scope file edits only inside src/,
 *   - denies deletes and anything else.
 *
 * Usage: node packages/daemon/dist/bench/goldenPath.js [runs=2] [model=qwen3:14b]
 */
import fs from "node:fs";
import path from "node:path";
import { createApp } from "../app.js";
import { TERMINAL_RUN_STATUSES, type Approval, type ModelAssignment } from "@flowcode/contracts";
import { evaluateCompletionGate } from "../orchestrator/completionGate.js";
import { defaultDataDir } from "../util/paths.js";

const OBJECTIVE =
  "Build a local-first personal scheduler with create, edit, delete, list view, local persistence, responsive mobile/desktop layouts, and designed empty/loading/error states.";

async function main() {
  const runs = Number(process.argv[2] ?? 2);
  const model = process.argv[3] ?? "qwen3:14b";
  const root = path.resolve(process.cwd(), "benchmarks");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(root, "runs", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  // Uses the normal FlowCode data directory so results are visible in the desktop app afterwards.
  const app = createApp({ dataDir: process.env.FLOWCODE_DATA_DIR ?? defaultDataDir() });
  const decisions: string[] = [];
  const log = (s: string) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${s}`;
    console.log(line);
    fs.appendFileSync(path.join(outDir, "harness.log"), line + "\n");
  };

  // Model preflight: the Coder must pass the capability lab for this exact configuration.
  const coder: ModelAssignment = { providerId: "ollama", model, temperature: 0.1 };
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, { ...coder, temperature: role === "planner" ? 0.2 : 0.1 });
  let elig = app.lab.coderEligibility(coder);
  if (!elig.eligible) {
    log(`Coder preflight: ${elig.reason} — running capability lab for ${model}`);
    const rec = await app.lab.probe(coder);
    log(`Capability lab: ${rec.passed ? "PASSED" : "FAILED"} ${rec.results.filter((r) => r.passed).length}/${rec.results.length}`);
    for (const r of rec.results) log(`  ${r.passed ? "PASS" : "FAIL"} ${r.probe}: ${r.detail}`);
    elig = app.lab.coderEligibility(coder);
  }
  if (!elig.eligible) {
    log(`Benchmark aborted: Coder not eligible (${elig.reason})`);
    process.exit(2);
  }

  // Harness approval policy (acting as the user; every decision is recorded).
  app.bus.subscribe((e) => {
    if (e.type !== "approval.requested") return;
    const a = app.store.approvals.get(String(e.data.approvalId));
    if (!a || a.status !== "pending") return;
    const decide = (d: "once" | "deny", why: string) => {
      decisions.push(`${d === "once" ? "APPROVED" : "DENIED"} ${a.kind} (${a.risk}): ${a.action} — ${why}`);
      log(`harness ${d === "once" ? "approves" : "denies"} ${a.kind}: ${a.action}`);
      setTimeout(() => {
        if (a.kind === "plan") app.orchestrator.approvePlan(a.runId!, "benchmark harness (acting as user)");
        else app.approvals.decide(a.id, d, "benchmark harness");
      }, 50);
    };
    const policy = (x: Approval): ["once" | "deny", string] => {
      if (x.kind === "plan") return ["once", "plan reviewed: template golden path"];
      if (x.kind === "dependency_install" && /npm install/.test(x.action)) return ["once", "install declared in the approved plan"];
      if (x.kind === "command" && /npm run (typecheck|lint|test|build)/.test(x.action)) return ["once", "verified check script"];
      if (x.kind === "file_operation" && !/^Delete|delete_file|replace_file/i.test(x.action) && x.affected.every((p) => p.startsWith("src/"))) return ["once", "edit inside src/"];
      return ["deny", "outside harness policy"];
    };
    const [d, why] = policy(a);
    decide(d, why);
  });

  const summaries: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= runs; i++) {
    const wsDir = path.join(outDir, `run-${i}`, "workspace");
    fs.mkdirSync(wsDir, { recursive: true });
    const project = app.projects.create({ name: `Golden path ${stamp} #${i}`, workspacePath: wsDir });
    const started = Date.now();
    log(`── Run ${i}/${runs}: clean workspace ${path.relative(process.cwd(), wsDir)}`);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: OBJECTIVE, kind: "template_build", templateId: "react-vite-scheduler", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    // Plan approval arrives via the harness subscriber; wait until approved, then start.
    await waitUntil(() => app.store.runs.require(run.id).planApproved || TERMINAL_RUN_STATUSES.includes(app.store.runs.require(run.id).status), 60_000);
    app.orchestrator.start(run.id);
    const unsub = app.bus.subscribe((e) => {
      if (e.runId === run.id && /^(task\.(started|verified|blocked|invalidated)|run\.(status_changed|done)|verification\.completed)$/.test(e.type)) log(`  ${e.type}: ${e.message.slice(0, 200)}`);
    });
    await waitUntil(() => {
      const r = app.store.runs.require(run.id);
      return TERMINAL_RUN_STATUSES.includes(r.status) || (r.status === "blocked" && !app.orchestrator.isActive(run.id));
    }, 3 * 3600_000);
    unsub();
    const final = app.store.runs.require(run.id);
    const tasks = app.orchestrator.graph.tasks(run.id);
    const checks = app.store.checks.where("run_id = ?", run.id).filter((c) => !c.taskId);
    const gate = evaluateCompletionGate({ tasks, checks, requiredChecks: final.strategy?.requiredChecks ?? [], hasFinalReport: app.verifier.hasFinalReport(run.id), planApproved: final.planApproved });
    const runOut = path.join(outDir, `run-${i}`);
    const report = app.verifier.reports.latestReport(run.id);
    if (report) fs.writeFileSync(path.join(runOut, "report.md"), report.markdown);
    for (const a of app.artifacts.forRun(run.id).filter((x) => x.kind === "screenshot")) {
      fs.mkdirSync(path.join(runOut, "screenshots"), { recursive: true });
      fs.writeFileSync(path.join(runOut, "screenshots", `${a.label.replace(/[^\w.-]+/g, "_")}.png`), app.artifacts.read(a.id).content);
    }
    const toolCalls = app.store.toolCalls.where("run_id = ?", run.id);
    const summary = {
      run: i,
      runId: run.id,
      status: final.status,
      minutes: ((Date.now() - started) / 60000).toFixed(1),
      tasks: tasks.map((t) => `${t.title}: ${t.status} (attempts ${t.attempts})`),
      checks: Object.fromEntries(checks.map((c) => [c.kind, c.status])),
      gate: { status: gate.status, unmet: gate.unmet, warnings: gate.warnings.length },
      toolCalls: toolCalls.length,
      rejectedToolCalls: toolCalls.filter((t) => t.status === "rejected").length,
      commands: app.store.commands.where("run_id = ?", run.id).length,
      snapshots: app.snapshots.forRun(run.id).length,
    };
    summaries.push(summary);
    fs.writeFileSync(path.join(runOut, "summary.json"), JSON.stringify(summary, null, 2));
    log(`Run ${i} finished: ${final.status} in ${summary.minutes} min`);
  }

  const md = [
    `# Golden-path benchmark — ${stamp}`,
    "",
    `Objective: ${OBJECTIVE}`,
    `Coder/Planner/Debugger: \`${model}\` via local Ollama (capability: ${elig.reason})`,
    "",
    "| Run | Status | Minutes | Tool calls (rejected) | Commands | Snapshots | Gate |",
    "|---|---|---|---|---|---|---|",
    ...summaries.map((s) => `| ${s.run} | ${s.status} | ${s.minutes} | ${s.toolCalls} (${s.rejectedToolCalls}) | ${s.commands} | ${s.snapshots} | ${(s.gate as { status: string }).status} |`),
    "",
    ...summaries.flatMap((s) => [
      `## Run ${s.run}`,
      "",
      ...(s.tasks as string[]).map((t) => `- ${t}`),
      "",
      "Checks: " + Object.entries(s.checks as Record<string, string>).map(([k, v]) => `${k}=${v}`).join(", "),
      ...((s.gate as { unmet: string[] }).unmet.length ? ["", "Unmet:", ...(s.gate as { unmet: string[] }).unmet.map((u) => `- ${u}`)] : []),
      "",
    ]),
    "## Harness approval decisions (acting as the user)",
    "",
    ...decisions.map((d) => `- ${d}`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "RESULTS.md"), md);
  log(`Results written to ${path.relative(process.cwd(), path.join(outDir, "RESULTS.md"))}`);
  await app.processes.cleanupAll("benchmark finished");
  process.exit(0);
}

function waitUntil(fn: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (fn()) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error("timeout"));
      }
    }, 500);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
