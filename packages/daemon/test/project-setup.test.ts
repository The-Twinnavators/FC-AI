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

      // No build before the design is approved, and approval asks how closely to follow it.
      expect((await call(`/projects/${id}/setup/start`, {})).status).toBe(409);
      expect((await call(`/projects/${id}/setup/approve-design`, {})).status).toBe(409);
      await call(`/projects/${id}/setup`, { fidelity: "close", designNotes: "Keep the KPI row." });
      const approved = await call<{ design: { approved: boolean } }>(`/projects/${id}/setup/approve-design`, {});
      expect(approved.status).toBe(200);
      expect(approved.body.design.approved).toBe(true);

      const started = await call<{ run: { id: string; objective: string } }>(`/projects/${id}/setup/start`, {});
      expect(started.status).toBe(200);
      expect(started.body.run.objective).toContain("Product type: SaaS");
      expect(started.body.run.objective).toContain('library page template "Analytics dashboard" (t.');
      expect(started.body.run.objective).toContain("Follow it closely");
      expect(started.body.run.objective).toContain("Keep the KPI row.");
      expect(app.store.getSetting<unknown[]>(`runRefs:${started.body.run.id}`, [])).toHaveLength(1);
      expect(app.store.getSetting(`runLook:${started.body.run.id}`, null)).toMatchObject({ extras: ["toasts", "installable"], template: "app-analytics", fidelity: "close", notes: "Keep the KPI row." });
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

  it("proposes drafts, revises them from feedback, and needs the design approved again after a change", async () => {
    const { app } = makeApp();
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    const headers = { authorization: "Bearer t", "content-type": "application/json" };
    const call = async <T>(p: string, body?: unknown) => {
      const res = await fetch(`http://127.0.0.1:${server.port}${p}`, body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
      return { status: res.status, body: (await res.json()) as T };
    };
    type Reply = { setup: ProjectSetup; design: { approved: boolean; questions: string[] } };
    try {
      const made = await call<Reply & { project: { id: string } }>("/setups", { name: "Sprout", description: "A shop for indoor plants with a cart and checkout", productType: "online-store" });
      const id = made.body.project.id;
      await call(`/projects/${id}/setup`, { designMode: "agents", threeDrafts: true });

      // Three drafts: different templates and different treatments.
      const first = await call<Reply>(`/projects/${id}/setup/drafts`, {});
      expect(first.status).toBe(200);
      const set = first.body.setup.draftSets[0]!;
      expect(set.drafts).toHaveLength(3);
      expect(new Set(set.drafts.map((d) => d.template)).size).toBe(3);
      expect(new Set(set.drafts.map((d) => d.appearance.fonts.display)).size).toBeGreaterThan(1);
      // Nothing is chosen for the person: approval asks which draft.
      expect(first.body.design.questions.join(" ")).toContain("Which draft");
      expect((await call(`/projects/${id}/setup/approve-design`, {})).status).toBe(409);

      // None fit: a new set needs words on what to change, and keeps the earlier set to go back to.
      expect((await call(`/projects/${id}/setup/drafts`, {})).status).toBe(400);
      const second = await call<Reply>(`/projects/${id}/setup/drafts`, { feedback: "darker and calmer" });
      expect(second.body.setup.draftSets).toHaveLength(2);
      expect(second.body.setup.draftSets[1]!.feedback).toBe("darker and calmer");
      expect(second.body.setup.draftSets[1]!.drafts.every((d) => d.appearance.mode === "dark")).toBe(true);

      // Choose one from the first set, say how closely to follow it, approve.
      const pick = set.drafts[1]!;
      const chosen = await call<Reply>(`/projects/${id}/setup/choose-draft`, { draft: pick.id });
      expect(chosen.body.setup).toMatchObject({ template: pick.template, chosenDraft: pick.id });
      await call(`/projects/${id}/setup`, { fidelity: "inspiration" });
      // Inspiration without saying what to change is a question, not a default.
      expect((await call(`/projects/${id}/setup/approve-design`, {})).status).toBe(409);
      await call(`/projects/${id}/setup`, { designNotes: "Add a plant care section." });
      const ok = await call<Reply>(`/projects/${id}/setup/approve-design`, {});
      expect(ok.status).toBe(200);
      expect(ok.body.setup.designApproval).toMatchObject({ template: pick.template, fidelity: "inspiration", draft: { id: pick.id } });

      // A material change after approval: approve again before the build.
      await call(`/projects/${id}/setup`, { designNotes: "Add a plant care section and a blog." });
      const after = await call<Reply>(`/projects/${id}/setup`);
      expect(after.body.design.approved).toBe(false);
      expect((await call(`/projects/${id}/setup/start`, {})).status).toBe(409);
      await call(`/projects/${id}/setup/approve-design`, {});
      expect((await call(`/projects/${id}/setup/start`, {})).status).toBe(200);
    } finally {
      await server.close();
    }
  });
});
