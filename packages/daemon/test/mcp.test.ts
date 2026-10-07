/** MCP servers as governed agent tools: config, masking, connecting, calling, approvals and per-step limits. */
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { McpManager, mcpToolName, parseMcpJson, publicServer, MAX_MCP_TOOLS_PER_STEP, type McpServerConfig } from "../src/mcp/manager.js";
import { mcpStepTools } from "../src/mcp/stepTools.js";
import { makeApp, makeProject } from "./helpers.js";

const FAKE = path.resolve(__dirname, "fixtures/mcp/fake-server.mjs");
const fake = (over: Partial<McpServerConfig> = {}): McpServerConfig => ({ id: "fake", name: "Fake", transport: "stdio", command: process.execPath, args: [FAKE], enabled: true, roles: ["coder"], approval: "allow", disabledTools: [], ...over });

const managers: McpManager[] = [];
afterEach(async () => {
  await Promise.all(managers.splice(0).map((m) => m.closeAll()));
});

describe("MCP config", () => {
  it("reads an mcp.json and starts every server switched off", () => {
    const got = parseMcpJson(JSON.stringify({ mcpServers: { Context7: { command: "npx", args: ["-y", "@upstash/context7-mcp"] }, Stripe: { url: "https://mcp.stripe.com", headers: { Authorization: "Bearer sk_live_123456789" } } } }));
    expect(got.map((s) => [s.id, s.transport, s.enabled])).toEqual([["context7", "stdio", false], ["stripe", "http", false]]);
  });

  it("never shows a stored key back, and keeps it when the masked value is saved again", () => {
    const { app } = makeApp();
    const m = new McpManager(app.store);
    m.save(fake({ id: "gh", transport: "http", command: undefined, url: "https://example.com/mcp", headers: { Authorization: "Bearer ghp_abcdefghijklmnop1234" }, env: { API_KEY: "secret-value-9876", MODE: "fast" } }));
    const shown = publicServer(m.get("gh")!);
    expect(JSON.stringify(shown)).not.toContain("ghp_abcdefghijklmnop");
    expect(JSON.stringify(shown)).not.toContain("secret-value");
    expect(shown.env!.MODE).toBe("fast");
    m.save(shown);
    expect(m.get("gh")!.headers!.Authorization).toBe("Bearer ghp_abcdefghijklmnop1234");
    expect(m.get("gh")!.env!.API_KEY).toBe("secret-value-9876");
  });

  it("names tools so any model can call them", () => {
    expect(mcpToolName("context7", "get-library-docs")).toBe("mcp_context7_get_library_docs");
    expect(mcpToolName("x", "a".repeat(100)).length).toBeLessThanOrEqual(64);
  });
});

describe("MCP servers", () => {
  it("connects over stdio, lists tools, calls them, and passes only safe environment variables", async () => {
    const { app } = makeApp();
    const m = new McpManager(app.store);
    managers.push(m);
    process.env.FLOWCODE_HOSTED_API_KEY = "should-not-leak";
    try {
      m.save(fake({ env: { FAKE_TOKEN: "t1" } }));
      const st = await m.connect("fake");
      expect(st.state).toBe("ready");
      expect(st.tools.map((t) => t.name).sort()).toEqual(["add", "echo", "fail", "secret"]);
      expect(await m.call("fake", "add", { a: 2, b: 3 })).toEqual({ ok: true, content: "5" });
      expect(await m.call("fake", "fail", {})).toMatchObject({ ok: false, content: "it broke" });
      expect((await m.call("fake", "secret", {})).content).toBe("token=t1 hosted=none");
    } finally {
      delete process.env.FLOWCODE_HOSTED_API_KEY;
    }
  }, 30_000);

  it("explains a server that isn't installed", async () => {
    const { app } = makeApp();
    const m = new McpManager(app.store);
    managers.push(m);
    m.save(fake({ id: "missing", command: "definitely-not-a-real-command-xyz", args: [] }));
    const st = await m.connect("missing");
    expect(st.state).toBe("error");
    expect(st.error).toMatch(/isn't installed|ENOENT|not found/i);
  }, 30_000);

  it("gives a step only enabled servers for its role, asks before an untrusted call, and wraps output as untrusted", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "a.txt": "x" });
    const m = new McpManager(app.store);
    managers.push(m);
    m.save(fake({ approval: "ask", disabledTools: ["secret"] }));
    m.save(fake({ id: "other", name: "Other", roles: ["planner"] }));
    const run = { id: "run_x", projectId: project.id } as never;
    const task = { id: "task_x", title: "Build it" } as never;
    const tools = await mcpStepTools({ mcp: m, approvals: app.approvals, bus: app.bus, project, run, task, role: "coder" });
    expect(tools.map((t) => t.def.name).sort()).toEqual(["mcp_fake_add", "mcp_fake_echo", "mcp_fake_fail"]);
    expect(tools.length).toBeLessThanOrEqual(MAX_MCP_TOOLS_PER_STEP);
    const echo = tools.find((t) => t.def.name === "mcp_fake_echo")!;
    // The call waits for an OK; allowing it for the project lets later calls through without asking.
    const pending = echo.run({ text: "hi" });
    await new Promise((r) => setTimeout(r, 50));
    const ask = app.store.approvals.list().find((a) => a.status === "pending" && /Fake/.test(a.action))!;
    expect(ask).toBeDefined();
    app.approvals.decide(ask.id, "project");
    const res = await pending;
    expect(res.ok).toBe(true);
    expect(res.content).toContain("echo: hi");
    expect(res.content).toMatch(/untrusted|<data|BEGIN/i);
    const again = await echo.run({ text: "again" });
    expect(again.content).toContain("echo: again");
    expect(app.store.approvals.list().filter((a) => /Fake/.test(a.action))).toHaveLength(1);
  }, 30_000);
});

describe("Figma links", () => {
  it("finds design, file and prototype links with their frames, once each", async () => {
    const { figmaLinks } = await import("../src/mcp/figma.js");
    const text = [
      "Home: https://www.figma.com/design/AbCdEf1234567890/Grocery-App?node-id=12-345&t=x",
      "Same frame again https://figma.com/design/AbCdEf1234567890/Grocery-App?node-id=12-345.",
      "Whole file: https://www.figma.com/file/ZZZZZZZZZZZZ/Old",
      "Prototype https://www.figma.com/proto/QQQQQQQQQQQQ/Flow?node-id=1%3A2",
      "Not Figma: https://example.com/design/AbCdEf1234567890",
    ].join("\n");
    expect(figmaLinks(text).map((l) => [l.fileKey, l.nodeId, l.name])).toEqual([
      ["AbCdEf1234567890", "12:345", "Grocery App"],
      ["ZZZZZZZZZZZZ", undefined, "Old"],
      ["QQQQQQQQQQQQ", "1:2", "Flow"],
    ]);
  });

  it("tells a design step how to use the frames, or that Figma isn't connected", async () => {
    const { figmaBrief, figmaLinks } = await import("../src/mcp/figma.js");
    const frames = figmaLinks("https://www.figma.com/design/AbCdEf1234567890/App?node-id=1-2");
    const on = figmaBrief(frames, { ready: true, tools: ["get_design_context", "get_variable_defs", "get_screenshot"] });
    expect(on).toContain("get_design_context");
    expect(on).toContain("tokens.css");
    expect(on).toContain('"12:345"');
    const off = figmaBrief(frames, { ready: false, error: "Figma isn't answering" });
    expect(off).toMatch(/isn't connected/);
    expect(off).not.toContain("get_design_context");
  });

  it("offers a step Figma's tools first, in the order a design step needs them", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "a.txt": "x" });
    const m = new McpManager(app.store);
    managers.push(m);
    m.save(fake({ id: "first", name: "First" }));
    m.save(fake({ id: "second", name: "Second" }));
    const tools = await mcpStepTools({ mcp: m, approvals: app.approvals, bus: app.bus, project, run: { id: "r", projectId: project.id } as never, task: { id: "t", title: "Design the main screens" } as never, role: "coder", prefer: ["second"] });
    expect(tools[0].def.name.startsWith("mcp_second_")).toBe(true);
    expect(tools).toHaveLength(MAX_MCP_TOOLS_PER_STEP);
  }, 30_000);
});
