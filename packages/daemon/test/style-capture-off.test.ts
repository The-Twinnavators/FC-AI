/**
 * Style capture is deferred until it has consent and address/destination protections: the Styles action is disabled in
 * the UI, and the API and build entry points refuse before anything is opened, read or written. Captures already made
 * are kept and still readable.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STYLE_CAPTURE_OFF } from "@flowcode/contracts";
import { startServer } from "../src/api/server.js";
import { hasStyleSources } from "../src/orchestrator/templates.js";
import { makeApp, makeProject } from "./helpers.js";

const STARTER_TOKENS = fs.readFileSync(path.resolve(__dirname, "../../../templates/react-vite-starter/src/styles/tokens.css"), "utf8");

describe("style capture is off", () => {
  it("refuses capture and a build's website address; keeps the existing capture", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "src/styles/tokens.css": STARTER_TOKENS });
    const earlier = { at: "2026-10-01T00:00:00.000Z", sources: ["https://example.com"], applied: ["--color-accent"], notes: [] };
    app.store.setSetting(`styleCapture:${project.id}`, earlier);
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    const url = (p: string) => `http://127.0.0.1:${server.port}${p}`;
    const headers = { authorization: "Bearer t", "content-type": "application/json" };
    try {
      for (const body of [{ url: "http://127.0.0.1:7457/" }, { url: "https://example.com" }, { files: [{ name: "a.css", role: "css", content: ":root{--color-accent:#be123c}" }] }]) {
        const res = await fetch(url(`/projects/${project.id}/design/capture`), { method: "POST", headers, body: JSON.stringify(body) });
        expect(res.status).toBe(403);
        expect(((await res.json()) as { error: string }).error).toBe(STYLE_CAPTURE_OFF);
      }
      expect(fs.readFileSync(path.join(app.projects.jail(project.id).root, "src/styles/tokens.css"), "utf8")).toBe(STARTER_TOKENS);
      expect(await (await fetch(url(`/projects/${project.id}/design/capture`), { headers })).json()).toEqual({ last: earlier });

      const projects = app.store.projects.where("1 = 1").length;
      const build = await fetch(url("/builds"), { method: "POST", headers, body: JSON.stringify({ description: "A shop", look: { styleUrl: "https://example.com" } }) });
      expect(build.status).toBe(403);
      expect(app.store.projects.where("1 = 1").length).toBe(projects);

      // A build recorded with a website before capture was turned off doesn't treat it as a source.
      expect(hasStyleSources([], { styleUrl: "https://example.com", extras: [] } as never)).toBe(false);
    } finally {
      await server.close();
    }
  });
});
