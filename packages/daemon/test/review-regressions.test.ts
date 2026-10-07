/** Regression tests for findings from the independent security/orchestration review. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyCommand } from "../src/commands/policy.js";
import { PathJail } from "../src/security/pathJail.js";
import { redact } from "../src/security/redaction.js";
import { inScope } from "../src/orchestrator/tools.js";
import { makeApp, makeProject, tmpDir } from "./helpers.js";

const PKG = JSON.stringify({ name: "demo", version: "1.0.0", scripts: { test: "vitest run", build: "vite build" }, devDependencies: { vitest: "^3.0.0" } });

describe("command policy hardening", () => {
  const { app } = makeApp();
  const { project, jail } = makeProject(app, { "package.json": PKG });
  const pf = { ...app.projects.preflight(project.id), hasNodeModules: true };
  const tier = (argv: string[]) => classifyCommand(argv, jail, pf).tier;

  it("blocks package-manager redirection flags", () => {
    expect(tier(["npm", "run", "test", "--prefix", "sub"])).toBe("never");
    expect(tier(["npm", "run", "test", "-w", "sub"])).toBe("never");
    expect(tier(["npm", "install", "--registry=http://evil.example"])).toBe("never");
    expect(tier(["npm", "run", "test", "--", "--reporter=dot"])).toBe("ask");
    expect(tier(["npm", "run", "test"])).toBe("auto");
    expect(tier(["npm", "config", "get", "//registry.npmjs.org/:_authToken"])).not.toBe("auto");
    expect(tier(["npm", "config", "get", "registry"])).toBe("ask");
  });

  it("blocks git global options and constrains read-only subcommands", () => {
    expect(tier(["git", "--git-dir=evil", "--work-tree=.", "status"])).toBe("never");
    expect(tier(["git", "-c", "core.fsmonitor=calc", "status"])).toBe("never");
    expect(tier(["git", "-c", "x=y", "push"])).toBe("never");
    expect(tier(["git", "show", "HEAD:.env"])).not.toBe("auto");
    expect(tier(["git", "diff", "--output=package.json"])).not.toBe("auto");
    expect(tier(["git", "branch", "-D", "main"])).toBe("ask");
    expect(tier(["git", "remote", "add", "x", "https://evil"])).toBe("ask");
    expect(tier(["git", "status", "--porcelain"])).toBe("auto");
    expect(tier(["git", "diff", "--stat"])).toBe("auto");
  });

  it("requires bare program names and allowlisted npx arguments", () => {
    expect(tier(["./sub/git", "status"])).toBe("never");
    expect(tier(["C:\\tools\\npm.cmd", "run", "test"])).toBe("never");
    expect(tier(["npx", "--package=evil", "tsc"])).toBe("ask");
    expect(tier(["npx", "eslint", "-o", "package.json", "."])).toBe("ask");
    expect(tier(["npx", "eslint", "--init"])).toBe("ask");
    expect(tier(["npx", "prettier", "--check", "--write", "."])).toBe("ask");
    expect(tier(["npx", "vite", "--host"])).toBe("ask");
    expect(tier(["npx", "vite", "--port", "5173", "--host", "127.0.0.1"])).toBe("auto");
    expect(tier(["npx", "tsc", "--noEmit"])).toBe("auto");
  });

  it("persistent approval keys include every argument", () => {
    const a = classifyCommand(["npm", "install", "lodash"], jail, pf).persistKey;
    const b = classifyCommand(["npm", "install", "lodash", "--ignore-scripts"], jail, pf).persistKey;
    expect(a).not.toBe(b);
  });
});

describe("path jail hardening", () => {
  it("rejects Windows aliasing: streams, trailing dots/spaces, device names", () => {
    const jail = new PathJail(tmpDir());
    for (const p of [".env:x", ".env::$DATA", ".env ", ".env.", "CON", "aux.txt", "src/nul", "a<b.txt"]) expect(() => jail.resolve(p), p).toThrow();
    expect(jail.resolve("src/config.ts").rel).toBe("src/config.ts");
  });

  it("treats git hooks and husky as protected secret-like paths", () => {
    const jail = new PathJail(tmpDir());
    expect(jail.isSecretPath(".git/hooks/pre-commit")).toBe(true);
    expect(jail.isSecretPath(".husky/pre-commit")).toBe(true);
  });

  it("rejects writes through dangling links", () => {
    const root = tmpDir();
    const target = path.join(tmpDir("fc-gone-"), "missing-dir");
    try {
      fs.symlinkSync(target, path.join(root, "link"), process.platform === "win32" ? "junction" : "dir");
    } catch {
      return; // platform refuses dangling links: nothing to test
    }
    const jail = new PathJail(root);
    expect(() => jail.resolve("link/x.txt")).toThrow();
  });
});

describe("scope and manifest hardening", () => {
  it("normalizes paths before scope checks", () => {
    const task = { expectedPaths: ["src/"] } as never;
    expect(inScope(task, "src/../package.json")).toBe(false);
    expect(inScope(task, "src/a.ts")).toBe(true);
    expect(inScope({ expectedPaths: [] } as never, "src/a.ts")).toBe(false);
  });

  it("requires approval to add a script that is not verified-safe", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "package.json": PKG, "evil.js": "1" });
    const ctx = { jail, projectId: project.id, runId: "r" };
    expect(app.ops.edit_package_manifest(ctx, { operations: [{ op: "set_script", name: "start", command: "node evil.js" }] }).status).toBe("needs_approval");
    expect(app.ops.edit_package_manifest(ctx, { operations: [{ op: "set_script", name: "typecheck", command: "tsc --noEmit" }] }).status).toBe("applied");
  });

  it("redacts quoted secret values containing spaces or separators", () => {
    const out = redact('password="correct horse; battery" token=\'x,y,z\'');
    expect(out).not.toContain("correct horse");
    expect(out).not.toContain("x,y,z");
  });
});

describe("agent loop no-progress control", () => {
  it("ends the attempt after the identical tool call fails three times", async () => {
    const { runAgentLoop } = await import("../src/orchestrator/agentLoop.js");
    const { ScriptedProvider, call } = await import("../src/models/scripted.js");
    const { app } = makeApp();
    app.router.register(new ScriptedProvider({ id: "rep", kind: "scripted", label: "rep", enabled: true, hosted: false }, () => ({ toolCalls: [call("read_file", { path: "missing.txt" })] })));
    let executed = 0;
    const res = await runAgentLoop({
      router: app.router,
      store: app.store,
      bus: app.bus,
      role: "coder",
      assignment: { providerId: "rep", model: "m" },
      system: "s",
      user: "u",
      runId: "run_rep",
      executor: async () => {
        executed++;
        return { ok: false, content: "ERROR: not found" };
      },
    });
    expect(res.outcome.kind).toBe("no_action");
    expect(executed).toBe(3);
    expect(res.transcript.some((m) => m.content.includes("you repeated the exact same"))).toBe(true);
  });
});

describe("reading without doing", () => {
  it("doesn't count different searches as rereading one file", async () => {
    const { runAgentLoop } = await import("../src/orchestrator/agentLoop.js");
    const { ScriptedProvider, call } = await import("../src/models/scripted.js");
    const { app } = makeApp();
    let n = 0;
    // A cloud coder: ten different searches, then an edit. Exploring a PRD is not looping (Calendar prototype layout step).
    app.router.register(
      new ScriptedProvider({ id: "hosted-searcher", kind: "scripted", label: "searcher", enabled: true, hosted: false }, () =>
        n++ < 10 ? { toolCalls: [call("search_code", { query: `term ${n}` })] } : n === 11 ? { toolCalls: [call("create_file", { path: "src/A.tsx", content: "x" })] } : { toolCalls: [call("task_complete", { summary: "done", changedPaths: ["src/A.tsx"] })] },
      ),
    );
    const res = await runAgentLoop({ router: app.router, store: app.store, bus: app.bus, role: "coder", assignment: { providerId: "hosted-searcher", model: "m" }, system: "s", user: "u", runId: "run_searcher", maxTurns: 40, executor: async () => ({ ok: true, content: "results" }) });
    // The guard against reading without doing must not end it: all ten searches and the edit ran.
    expect(res.outcome.kind).not.toBe("no_action");
    expect(n).toBeGreaterThan(11);
  });


  it("nudges on the third read of an unchanged file and ends the attempt after 15 reads with no change", async () => {
    const { runAgentLoop } = await import("../src/orchestrator/agentLoop.js");
    const { ScriptedProvider, call } = await import("../src/models/scripted.js");
    const { app } = makeApp();
    const files = ["src/styles/tokens.css", "src/styles/components.css", "src/components/ui/index.tsx"];
    let n = 0;
    app.router.register(new ScriptedProvider({ id: "reader", kind: "scripted", label: "reader", enabled: true, hosted: false }, () => ({ toolCalls: [call("read_file", { path: files[n++ % files.length] })] })));
    const res = await runAgentLoop({
      router: app.router,
      store: app.store,
      bus: app.bus,
      role: "coder",
      assignment: { providerId: "reader", model: "m" },
      system: "s",
      user: "u",
      runId: "run_reader",
      maxTurns: 40,
      executor: async () => ({ ok: true, content: "file contents" }),
    });
    // Three files over and over: the sixth re-read of an unchanged file ends it (read 9).
    expect(res.outcome).toMatchObject({ kind: "no_action", reason: expect.stringMatching(/9 reads in a row/) });
    expect(res.turns).toBe(9);
    expect(res.transcript.some((m) => /read src\/styles\/tokens\.css 3 times/.test(m.content))).toBe(true);
  });

  it("lets a model read many different files to orient itself (Calculator app: gpt-5.6-sol was stopped after 15 first reads)", async () => {
    const { runAgentLoop } = await import("../src/orchestrator/agentLoop.js");
    const { ScriptedProvider, call } = await import("../src/models/scripted.js");
    const { app } = makeApp();
    // Six files per turn, as a cloud model reads, for four turns (some of them files that don't exist yet).
    let turn = 0;
    app.router.register(new ScriptedProvider({ id: "explorer", kind: "scripted", label: "explorer", enabled: true, hosted: false }, () => (turn++ < 4 ? { toolCalls: Array.from({ length: 6 }, (_, i) => call("read_file", { path: `src/file${turn}-${i}.ts` })) } : { toolCalls: [call("task_complete", { summary: "done", changedPaths: [] })] })));
    const res = await runAgentLoop({
      router: app.router,
      store: app.store,
      bus: app.bus,
      role: "coder",
      assignment: { providerId: "explorer", model: "m" },
      system: "s",
      user: "u",
      runId: "run_explorer",
      maxTurns: 40,
      executor: async (name) => (name === "task_complete" ? { ok: true, content: "ok", terminal: { kind: "complete", summary: "done", changedPaths: [] } } : { ok: true, content: "file contents" }),
    });
    expect(res.outcome.kind).toBe("complete");
  });
});

describe("unreadable tool calls", () => {
  it("on Ollama's XML parse error, switches to tools described as text and reads the calls itself (JSX content included)", async () => {
    const { runAgentLoop } = await import("../src/orchestrator/agentLoop.js");
    const { ScriptedProvider } = await import("../src/models/scripted.js");
    const { classifyError } = await import("../src/models/errors.js");
    const { ProviderError } = await import("../src/models/types.js");
    expect(classifyError(new Error('Ollama /api/chat HTTP 500: {"error":"XML syntax error on line 13: element <parameter> closed by </div>"}')).kind).toBe("tool_call_invalid");
    const { app } = makeApp();
    let turn = 0;
    const sawTools: boolean[] = [];
    app.router.register(
      new ScriptedProvider({ id: "xml", kind: "scripted", label: "xml", enabled: true, hosted: false }, (req) => {
        turn++;
        sawTools.push(!!req.tools?.length);
        if (turn === 1) throw new ProviderError("tool_call_invalid", "XML syntax error on line 13: element <parameter> closed by </div>");
        if (turn === 2) return { content: "<function=create_file>\n<parameter=path>\nsrc/A.tsx\n</parameter>\n<parameter=content>\nexport const A = () => <div><b>hi</b></div>;\n</parameter>\n</function>" };
        return { content: "<function=task_complete>\n<parameter=summary>\ndone\n</parameter>\n</function>" };
      }),
    );
    const written: Array<{ name: string; args: unknown }> = [];
    const res = await runAgentLoop({
      router: app.router,
      store: app.store,
      bus: app.bus,
      role: "coder",
      assignment: { providerId: "xml", model: "m" },
      system: "s",
      user: "u",
      runId: "run_xml",
      executor: async (name, args) => {
        written.push({ name, args });
        return { ok: true, content: "ok", terminal: name === "task_complete" ? { kind: "completed", summary: "done" } : undefined };
      },
    });
    expect(res.outcome.kind).toBe("completed");
    // Native tools on the first try; described as text after the XML error.
    expect(sawTools).toEqual([true, false, false]);
    expect(written[0]).toEqual({ name: "create_file", args: { path: "src/A.tsx", content: "export const A = () => <div><b>hi</b></div>;" } });
  });
});

describe("autonomy levels", () => {
  const req = (projectId: string, kind: "dependency_install" | "external_research" | "file_operation" | "command", action: string, affected: string[] = []) => ({
    projectId,
    kind,
    action,
    reason: "test",
    affected,
    risk: "medium" as const,
    consequencesOfDenial: "x",
  });

  it("supervised asks; assisted auto-approves declared installs and src/ edits; data-leaving actions always ask", () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    expect(app.approvals.request(req(project.id, "dependency_install", "Run `npm install --no-fund` in .")).status).toBe("pending");
    app.projects.updateSettings(project.id, { autonomy: "assisted" });
    const install = app.approvals.request(req(project.id, "dependency_install", "Run `npm install --no-fund --no-audit` in ."));
    expect(install.status).toBe("approved");
    expect(app.bus.list({ types: ["approval.resolved"] }).at(-1)!.message).toMatch(/auto-approved by assisted policy/);
    expect(app.approvals.request(req(project.id, "dependency_install", "Run `npm install left-pad` in .")).status).toBe("pending");
    expect(app.approvals.request(req(project.id, "file_operation", "apply_patch on src/a.ts", ["src/a.ts"])).status).toBe("approved");
    expect(app.approvals.request(req(project.id, "file_operation", "apply_patch on vite.config.ts", ["vite.config.ts"])).status).toBe("pending");
    app.projects.updateSettings(project.id, { autonomy: "autonomous" });
    expect(app.approvals.request(req(project.id, "command", "Run `node build.js` in .")).status).toBe("approved");
    expect(app.approvals.request(req(project.id, "external_research", "External research: x")).status).toBe("pending");
  });
});

describe("ollama transport errors", () => {
  it("treats an Ollama runner crash (HTTP 500, connection forcibly closed) as a retryable reset", async () => {
    const { classifyError } = await import("../src/models/errors.js");
    const body = '{"error":"read tcp 127.0.0.1:51434->127.0.0.1:55851: wsarecv: An existing connection was forcibly closed by the remote host."}';
    const e = classifyError(new Error(`Ollama /api/chat HTTP 500: ${body}`), undefined, 500, body);
    expect(e.kind).toBe("connection_reset");
    expect(e.retryable).toBe(true);
  });
});

describe("project administration", () => {
  it("deletes every record for a project but never a folder the user selected", async () => {
    const fs = await import("node:fs");
    const { makeApp, makeProject } = await import("./helpers.js");
    const { deleteProject, isManagedWorkspace } = await import("../src/workspace/projectAdmin.js");
    const { app } = makeApp();
    const { project, ws } = makeProject(app, { "README.md": "# x\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "x", constraints: [], attachedKnowledgeIds: [] });
    app.store.checks.upsert({ id: "chk_del", runId: run.id, kind: "lint", required: false, status: "passed", evidenceRefs: [], summary: "", updatedAt: new Date().toISOString() });
    expect(isManagedWorkspace(app, project.id)).toBe(false);
    const res = deleteProject(app, project.id, { deleteFiles: true });
    expect(res.filesDeleted).toBe(false); // user-selected folder is never removed
    expect(fs.existsSync(ws)).toBe(true);
    expect(app.store.projects.get(project.id)).toBeUndefined();
    expect(app.store.runs.get(run.id)).toBeUndefined();
    expect(app.store.checks.get("chk_del")).toBeUndefined();
  });

  it("removes a FlowCode-managed workspace only when asked", async () => {
    const fs = await import("node:fs");
    const { makeApp } = await import("./helpers.js");
    const { deleteProject, isManagedWorkspace } = await import("../src/workspace/projectAdmin.js");
    const { app } = makeApp();
    const p = app.projects.create({ name: "Managed one" });
    const dir = app.projects.workspacePath(p);
    expect(isManagedWorkspace(app, p.id)).toBe(true);
    expect(deleteProject(app, p.id, { deleteFiles: true }).filesDeleted).toBe(true);
    expect(fs.existsSync(dir)).toBe(false);
  });
});

describe("restart while a task waits on a step approval", () => {
  it("does not leave the run stuck at awaiting approval when its plan was already approved", async () => {
    const { makeApp, makeProject } = await import("./helpers.js");
    const { app } = makeApp();
    const { project } = makeProject(app, {});
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "x", constraints: [], attachedKnowledgeIds: [] });
    app.store.runs.upsert({ ...app.store.runs.require(run.id), status: "awaiting_approval", planApproved: true });
    app.store.tasks.upsert({ id: "tsk_wait", runId: run.id, title: "Add plugin", objective: "Add plugin", status: "awaiting_approval", dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 0, attempts: 1 });
    app.orchestrator.setPaused(true); // observe the reconciled state without executing
    await app.orchestrator.reconcileOnStartup();
    expect(app.store.runs.require(run.id).status).toBe("running");
    expect(app.store.tasks.require("tsk_wait").status).toBe("attempted");
    expect(app.bus.list({ runId: run.id, types: ["run.status_changed"] }).some((e) => /step approval/.test(e.message))).toBe(true);
  });
});

describe("files attached to a follow-up request", () => {
  it("are copied into spec/attachments and named in every task's handoff", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { makeApp, makeProject } = await import("./helpers.js");
    const { app } = makeApp();
    const { project, ws } = makeProject(app, { "package.json": '{"name":"x"}', "src/app.css": "body{}" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Apply the brand colours", kind: "iterate", references: [{ name: "brand.css", role: "css", content: ":root{--ac:#5b3cc4}" }, { name: "..\..\evil.json", role: "json", content: "{}" }] });
    const out = (app.orchestrator as unknown as { attachReferences(r: typeof run): Array<{ path: string }> }).attachReferences(run);
    expect(out.map((o) => o.path)).toEqual(["spec/attachments/brand.css", "spec/attachments/evil.json"]);
    expect(fs.readFileSync(path.join(ws, "spec/attachments/brand.css"), "utf8")).toContain("--ac");
    expect(fs.existsSync(path.join(ws, "..", "evil.json"))).toBe(false); // names cannot escape the workspace
    expect(app.store.runs.require(run.id).referencePaths).toEqual(out.map((o) => o.path));
  });
});
