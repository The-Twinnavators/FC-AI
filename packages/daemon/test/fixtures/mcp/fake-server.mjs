// A tiny MCP server over stdio for tests: an "echo" tool, an "add" tool and a tool that always errors.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "fake", version: "1.0.0" });
server.tool("echo", "Repeat the text back", { text: z.string() }, async ({ text }) => ({ content: [{ type: "text", text: `echo: ${text}` }] }));
server.tool("add", "Add two numbers", { a: z.number(), b: z.number() }, async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }));
server.tool("fail", "Always fails", {}, async () => ({ isError: true, content: [{ type: "text", text: "it broke" }] }));
server.tool("secret", "Shows the environment variable it was given", {}, async () => ({ content: [{ type: "text", text: `token=${process.env.FAKE_TOKEN ?? "none"} hosted=${process.env.FLOWCODE_HOSTED_API_KEY ?? "none"}` }] }));
await server.connect(new StdioServerTransport());
