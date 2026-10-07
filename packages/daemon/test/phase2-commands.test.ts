/**
 * Phase 2 acceptance: commands run only within the workspace, installs await approval, cancellation
 * kills child processes, repeated failures block, output is redacted.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyCommand } from "../src/commands/policy.js";
import { redact, redactValue, StreamingRedactor, REDACTED } from "../src/security/redaction.js";
import { isAlive } from "../src/commands/processManager.js";
import { errorFingerprint } from "../src/commands/fingerprint.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const PKG = JSON.stringify({ name: "demo", version: "1.0.0", scripts: { test: "vitest run", deploy: "vercel deploy" }, dependencies: { "left-pad": "^1.3.0" } }, null, 2);

describe("command policy tiers", () => {
  it("classifies auto / ask / never", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "package.json": PKG });
    const pf = app.projects.preflight(project.id);
    expect(classifyCommand(["git", "status"], jail, pf).tier).toBe("auto");
    expect(classifyCommand(["npm", "run", "test"], jail, pf).tier).toBe("auto");
    expect(classifyCommand(["npm", "install"], jail, pf).tier).toBe("ask");
    expect(classifyCommand(["npm", "install"], jail, pf).category).toBe("install");
    expect(classifyCommand(["npm", "run", "deploy"], jail, pf).tier).toBe("never");
    expect(classifyCommand(["npm", "run", "missing"], jail, pf).tier).toBe("never");
    expect(classifyCommand(["git", "push"], jail, pf).tier).toBe("never");
    expect(classifyCommand(["cmd", "/c", "dir"], jail, pf).tier).toBe("never");
    expect(classifyCommand(["bash", "-c", "ls && rm -rf ."], jail, pf).tier).toBe("never");
    expect(classifyCommand(["node", "../../outside.js"], jail, pf).tier).toBe("never");
    expect(classifyCommand(["node", "C:\\Windows\\x.js"], jail, pf).tier).toBe("never");
    expect(classifyCommand(["node", ".env"], jail, pf).tier).toBe("never");
    expect(classifyCommand(["curl", "https://example.com"], jail, pf).tier).toBe("ask");
    expect(classifyCommand(["rm", "-rf", "src"], jail, pf).category).toBe("delete");
    expect(classifyCommand(["npm", "publish"], jail, pf).tier).toBe("never");
    expect(classifyCommand(["npm", "install"], jail, undefined).tier).toBe("never");
  });
});

describe("redaction", () => {
  it("redacts common secret formats", () => {
    const text = [
      "API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456",
      "Authorization: Bearer abc.def.ghi1234567",
      "postgres://admin:hunter2@db.local/app",
      '{"client_secret": "shh-very-secret"}',
      "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      "aws AKIAABCDEFGHIJKLMNOP",
      "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const out = redact(text);
    for (const s of ["sk-proj-abc", "abc.def.ghi1234567", "hunter2", "shh-very-secret", "ghp_ABC", "AKIAABCDEFGHIJKLMNOP", "MIIabc"]) expect(out).not.toContain(s);
    expect(out).toContain(REDACTED);
    expect(out).toContain("postgres://admin:");
    expect(redactValue({ password: "p@ss", nested: { apiKey: "zzz" }, maxTokens: 5 })).toEqual({ password: REDACTED, nested: { apiKey: REDACTED }, maxTokens: 5 });
  });

  it("redacts secrets split across stream chunks", () => {
    const r = new StreamingRedactor([], 64);
    const secret = "sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123";
    const full = `log line one\nkey: ${secret}\n` + "padding line\n".repeat(20);
    let out = "";
    for (let i = 0; i < full.length; i += 7) out += r.push(full.slice(i, i + 7));
    out += r.flush();
    expect(out).not.toContain(secret);
    expect(out).not.toContain("ABCDEFGHIJ");
    const key = new StreamingRedactor();
    const k = "-----BEGIN PRIVATE KEY-----\nAAAA\nBBBB\n-----END PRIVATE KEY-----\n";
    let ko = "";
    for (const ch of k.match(/.{1,5}/gs)!) ko += key.push(ch);
    ko += key.flush();
    expect(ko).not.toContain("AAAA");
  });
});

describe("governed runner", () => {
  it("runs within the workspace with scrubbed env and redacted output", async () => {
    const { app } = makeApp();
    const { project, jail, ws } = makeProject(app, { "print.js": "console.log('cwd=' + process.cwd()); console.log('SECRET_TOKEN=abcdef1234567890'); console.log('home-env=' + (process.env.FLOWCODE_TEST_LEAK ?? 'none'));" });
    process.env.FLOWCODE_TEST_LEAK = "leaked";
    const res = await app.runner.run({ jail, projectId: project.id, runId: "run_c1", argv: ["node", "print.js"], reason: "test", preApproved: true });
    delete process.env.FLOWCODE_TEST_LEAK;
    expect(res.record.status).toBe("succeeded");
    expect(res.output).toContain(`cwd=${fs.realpathSync.native(ws)}`);
    expect(res.output).not.toContain("abcdef1234567890");
    expect(res.output).toContain("home-env=none");
    const stored = app.store.commands.require(res.record.id);
    expect(stored.outputPreview).not.toContain("abcdef1234567890");
    expect(stored.cwdRelativePath).toBe(".");
    expect(stored.outputHash).toMatch(/^[a-f0-9]{64}$/);
    const events = app.bus.list({ runId: "run_c1", types: ["command.output"] });
    expect(events.map((e) => e.message).join("")).not.toContain("abcdef1234567890");
  });

  it("blocks never-tier commands and waits for approval on installs", async () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "package.json": PKG });
    const pf = app.projects.preflight(project.id);
    const blocked = await app.runner.run({ jail, projectId: project.id, runId: "run_c2", argv: ["git", "push"], reason: "x", preflight: pf });
    expect(blocked.record.status).toBe("blocked");
    const pending = await app.runner.run({ jail, projectId: project.id, runId: "run_c2", argv: ["npm", "install"], reason: "deps", preflight: pf, waitForApproval: false });
    expect(pending.record.status).toBe("awaiting_approval");
    const approval = app.store.approvals.require(pending.record.approvalId!);
    expect(approval.kind).toBe("dependency_install");
    expect(approval.status).toBe("pending");
    // Denial resolves the waiting command as blocked.
    const waiting = app.runner.run({ jail, projectId: project.id, runId: "run_c2", argv: ["npm", "install", "left-pad"], reason: "deps", preflight: pf });
    const ap = await waitFor(() => app.approvals.pending(project.id).find((a) => a.action.includes("left-pad")));
    app.approvals.decide(ap.id, "deny");
    expect((await waiting).record.status).toBe("blocked");
  });

  it("cancellation kills the child process tree", async () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, {
      "spawner.js": "const { spawn } = require('node:child_process'); const c = spawn(process.execPath, ['-e', 'setInterval(()=>{}, 1000)'], { stdio: 'ignore' }); console.log('child=' + c.pid); setInterval(() => {}, 1000);",
    });
    const ctrl = new AbortController();
    const p = app.runner.run({ jail, projectId: project.id, runId: "run_c3", argv: ["node", "spawner.js"], reason: "long", preApproved: true, signal: ctrl.signal });
    const childPid = await waitFor(() => {
      const ev = app.bus.list({ runId: "run_c3", types: ["command.output"] }).map((e) => e.message).join("");
      const m = /child=(\d+)/.exec(ev);
      return m ? Number(m[1]) : undefined;
    });
    const live = app.processes.liveForRun("run_c3");
    expect(live).toHaveLength(1);
    const parentPid = live[0].pid;
    ctrl.abort();
    const res = await p;
    expect(res.record.status).toBe("cancelled");
    await waitFor(() => !isAlive(parentPid) && !isAlive(childPid), 10_000);
    expect(app.store.processes.where("run_id = ?", "run_c3")[0].state).toBe("killed");
  });

  it("blocks repeated identical failures until a material change", async () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "fail.js": "console.error('Error: widget at line ' + Date.now() % 1000 + ' is broken'); process.exit(2);" });
    const run = () => app.runner.run({ jail, projectId: project.id, runId: "run_c4", argv: ["node", "fail.js"], reason: "x", preApproved: true, maxSameFingerprint: 3 });
    const r1 = await run();
    const r2 = await run();
    const r3 = await run();
    expect([r1, r2, r3].map((r) => r.record.status)).toEqual(["failed", "failed", "failed"]);
    expect(r1.record.errorFingerprint).toBe(r3.record.errorFingerprint);
    const r4 = await run();
    expect(r4.record.status).toBe("blocked");
    expect(app.bus.list({ runId: "run_c4", types: ["command.failed"] }).at(-1)!.message).toMatch(/No progress/);
    // A material change (governed edit in this run) resets the streak.
    app.ops.create_file({ jail, projectId: project.id, runId: "run_c4" }, { path: "note.txt", content: "changed" });
    await new Promise((r) => setTimeout(r, 5));
    const r5 = await run();
    expect(r5.record.status).toBe("failed");
    // An explicit user override also allows a retry.
    await run();
    await run();
    const r8 = await app.runner.run({ jail, projectId: project.id, runId: "run_c4", argv: ["node", "fail.js"], reason: "x", preApproved: true, overrideNoProgress: true });
    expect(r8.record.status).toBe("failed");
  });

  it("normalizes fingerprints across paths, numbers and timings", () => {
    const a = errorFingerprint(["npm", "run", "build"], 1, "Error: C:\\Users\\a\\proj\\src\\x.ts:12:4 TS2322 failed in 120ms", "failed");
    const b = errorFingerprint(["npm", "run", "build"], 1, "Error: C:\\Users\\b\\other\\src\\x.ts:99:1 TS2322 failed in 980ms", "failed");
    expect(a).toBe(b);
  });

  it("app shutdown cleanup terminates owned processes", async () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "long.js": "setInterval(() => console.log('tick'), 200);" });
    const p = app.runner.run({ jail, projectId: project.id, runId: "run_c5", argv: ["node", "long.js"], reason: "server", preApproved: true, server: { readyPattern: /tick/, readyTimeoutMs: 10_000 } });
    const res = await p;
    expect(res.serverProcId).toBeDefined();
    const pid = app.processes.liveForRun("run_c5")[0].pid;
    expect(isAlive(pid)).toBe(true);
    await app.processes.cleanupAll("test shutdown");
    await waitFor(() => !isAlive(pid), 10_000);
    const cleanup = app.bus.list({ runId: "run_c5", types: ["process.cleanup"] });
    expect(cleanup.at(-1)!.data).toMatchObject({ killed: 1, failed: 0 });
    void path;
  });
});
