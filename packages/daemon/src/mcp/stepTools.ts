/**
 * The MCP tools one step gets: from the servers enabled for the step's role, at most MAX_MCP_TOOLS_PER_STEP, each run
 * with FlowCode's governance. A server you haven't trusted asks once per project ("Allow for project" remembers it);
 * its output is wrapped as untrusted data, so text in it can't pass for instructions.
 */
import type { Project, Run, Task } from "@flowcode/contracts";
import type { ApprovalService } from "../approvals/service.js";
import type { EventBus } from "../events/bus.js";
import type { ExtraTool } from "../orchestrator/agentLoop.js";
import { untrusted } from "../orchestrator/prompts.js";
import { MAX_MCP_TOOLS_PER_STEP, mcpToolName, type McpManager } from "./manager.js";
import { FIGMA_TOOL_ORDER } from "./figma.js";

export interface StepToolContext {
  mcp: McpManager;
  approvals: ApprovalService;
  bus: EventBus;
  project: Project;
  run: Run;
  task: Task;
  role: string;
  onAwaitingApproval?: (waiting: boolean) => void;
  /** Servers this step needs most (Figma when the build links Figma frames): their tools come first. */
  prefer?: string[];
}

export async function mcpStepTools(ctx: StepToolContext): Promise<ExtraTool[]> {
  const rank = (id: string) => {
    const i = (ctx.prefer ?? []).indexOf(id);
    return i < 0 ? 99 : i;
  };
  const servers = ctx.mcp.forRole(ctx.role).sort((a, b) => rank(a.id) - rank(b.id));
  if (!servers.length) return [];
  const ev = { projectId: ctx.project.id, runId: ctx.run.id, taskId: ctx.task.id };
  const out: ExtraTool[] = [];
  for (const s of servers) {
    if (out.length >= MAX_MCP_TOOLS_PER_STEP) break;
    const st = await ctx.mcp.connect(s.id);
    if (st.state !== "ready") {
      ctx.bus.emit({ ...ev, type: "recovery.action", message: `MCP server ${s.name} isn't available for this step: ${st.error ?? st.state}`, level: "warning", data: { mcp: s.id } });
      continue;
    }
    const order = (n: string) => (s.preset === "figma" ? (FIGMA_TOOL_ORDER.indexOf(n) + 1 || 99) : 0);
    for (const t of st.tools.filter((x) => !s.disabledTools.includes(x.name)).sort((a, b) => order(a.name) - order(b.name))) {
      if (out.length >= MAX_MCP_TOOLS_PER_STEP) break;
      const name = mcpToolName(s.id, t.name);
      out.push({
        def: { name, description: `[${s.name} MCP] ${t.description || t.name}`.slice(0, 500), parameters: t.inputSchema },
        run: async (args, signal) => {
          const persistKey = `mcp:${s.id}`;
          if (s.approval !== "allow" && !ctx.approvals.isPersistentlyApproved(ctx.project.id, persistKey)) {
            const a = ctx.approvals.request({
              projectId: ctx.project.id,
              runId: ctx.run.id,
              taskId: ctx.task.id,
              kind: "command",
              action: `Use the ${s.name} MCP server: ${t.name}`,
              reason: `Step "${ctx.task.title}" wants to call ${t.name} on ${s.name} (${s.transport === "http" ? s.url : `${s.command} ${(s.args ?? []).join(" ")}`}). "Allow for project" lets this server's tools run without asking again in this project.`,
              affected: [],
              risk: "medium",
              persistKey,
              consequencesOfDenial: "The tool isn't called; the agent carries on without it.",
            });
            let decided = a;
            if (a.status === "pending") {
              ctx.onAwaitingApproval?.(true);
              try {
                decided = await ctx.approvals.wait(a.id, signal);
              } finally {
                ctx.onAwaitingApproval?.(false);
              }
            }
            if (decided.status !== "approved") return { ok: false, content: `Not run: you didn't allow ${s.name}'s ${t.name}. Carry on without it.` };
          }
          const res = await ctx.mcp.call(s.id, t.name, args, signal);
          return { ok: res.ok, content: untrusted(`mcp:${s.id}:${t.name}`, res.content) };
        },
      });
    }
  }
  if (out.length) ctx.bus.emit({ ...ev, type: "agent.message", message: `MCP tools for this step: ${out.map((x) => x.def.name).join(", ")}`, data: { mcp: true } });
  return out;
}
