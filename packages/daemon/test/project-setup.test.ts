/**
 * A project's setup before its first build (Home → Look and Feel → Build levels → Start Build): Home creates a draft
 * project with the description, product type and attachments; later steps add to it; a reload reads it back; Start
 * Build makes the first run once, with the chosen level and Extras, and a second press returns that same run.
 */
import { describe, expect, it } from "vitest";
import type { ProjectSetup } from "@flowcode/contracts";
import { startServer } from "../src/api/server.js";
import { makeApp } from "./helpers.js";

describe("project setup", () => {
  it("keeps the setup across steps and reloads, and starts the build once", async () => {
    const { app } = makeApp();
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    const url = (p: string) => `http://127.0.0.1:${server.port}${p}`;
    const headers = { authorization: "Bearer t", "content-type": "application/json" };
    const call = async <T>(p: string, body?: unknown) => {
      const res = await fetch(url(p), body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
      return { status: res.status, body: (await res.json()) as T };
    };
    try {
      const prd = { name: "prd.md", role: "prd", content: "# Climb\n\nF1 Book a first lesson." };
      const made = await call<{ project: { id: string; name: string }; setup: ProjectSetup }>("/setups", { name: "Climb", description: "A booking app for a climbing gym", productType: "saas", references: [prd] });
      expect(made.status).toBe(200);
      const id = made.body.project.id;
      expect(made.body.setup).toMatchObject({ status: "draft", productType: "saas", extras: [], autonomy: "supervised" });

      // Later steps add to it; several Extras at once, one taken out again without touching the others.
      await call(`/projects/${id}/setup`, { extras: ["toasts", "sticky-header", "installable"], autonomy: "assisted" });
      await call(`/projects/${id}/setup`, { extras: ["toasts", "installable"] });
      // Look and Feel's page template: a library template only.
      await call(`/projects/${id}/setup`, { template: "app-analytics" });
      expect((await call(`/projects/${id}/setup`, { template: "nope" })).status).toBe(400);
      expect((await call(`/projects/${id}/setup`, { extras: ["not-an-extra"] })).status).toBe(400);

      // A reload reads it all back, the PRD included as it was attached.
      const back = await call<{ project: { name: string }; setup: ProjectSetup }>(`/projects/${id}/setup`);
      expect(back.body.project.name).toBe("Climb");
      expect(back.body.setup).toMatchObject({ extras: ["toasts", "installable"], autonomy: "assisted", references: [prd] });

      const started = await call<{ run: { id: string; objective: string } }>(`/projects/${id}/setup/start`, {});
      expect(started.status).toBe(200);
      expect(started.body.run.objective).toContain("Product type: SaaS");
      expect(started.body.run.objective).toContain('library page template "Analytics dashboard" (t.');
      expect(app.store.getSetting<unknown[]>(`runRefs:${started.body.run.id}`, [])).toHaveLength(1);
      expect(app.store.getSetting(`runLook:${started.body.run.id}`, null)).toEqual({ extras: ["toasts", "installable"] });
      expect(app.store.projects.require(id).settings.autonomy).toBe("assisted");

      // A second press doesn't start a second build; the setup can no longer be edited.
      const again = await call<{ run: { id: string } }>(`/projects/${id}/setup/start`, {});
      expect(again.body.run.id).toBe(started.body.run.id);
      expect(app.store.runs.where("project_id = ?", id)).toHaveLength(1);
      expect((await call(`/projects/${id}/setup`, { extras: [] })).status).toBe(409);
    } finally {
      await server.close();
    }
  });
});
