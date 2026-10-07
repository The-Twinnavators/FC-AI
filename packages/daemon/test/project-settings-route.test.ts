/** Updating one project setting leaves the others as they were (No BIO & GMO build: one change reset three). */
import { describe, expect, it } from "vitest";
import { startServer } from "../src/api/server.js";
import { makeApp, makeProject } from "./helpers.js";

describe("project settings route", () => {
  it("changes only the settings sent", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "a.txt": "x" });
    app.projects.updateSettings(project.id, { allowHostedModels: true, autonomy: "autonomous", allowExternalResearch: false });
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/projects/${project.id}/settings`, { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ allowExternalResearch: true }) });
      expect(res.status).toBe(200);
      const s = app.store.projects.require(project.id).settings;
      expect(s.allowExternalResearch).toBe(true);
      expect(s.allowHostedModels).toBe(true);
      expect(s.autonomy).toBe("autonomous");
    } finally {
      await server.close();
    }
  });
});
