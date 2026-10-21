/**
 * A project's setup before its first build (Home → Look and Feel → Build levels → Start Build): Home creates a draft
 * project with the description, product type and attachments; later steps add to it; a reload reads it back; Start
 * Build makes the first run once, with the chosen level and Extras, and a second press returns that same run.
 */
import { describe, expect, it } from "vitest";
import type { DesignProofs, ProjectSetup } from "@flowcode/contracts";
import { ScriptedProvider } from "../src/models/scripted.js";
import { designPending } from "../src/orchestrator/designProofs.js";
import { startServer } from "../src/api/server.js";
import { makeApp } from "./helpers.js";

/** Polls an async check until it returns something (the proofs are made in the background). */
async function waitFor<T>(fn: () => Promise<T | undefined | false>, timeoutMs = 20_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 50));
  }
}

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

  it("in agents mode, starts without a design approval, makes three proofs while planning, and holds the plan for the design", async () => {
    const { app } = makeApp();
    // A scripted designer: a valid proof each time, different per call; "fail" in the feedback makes it answer nonsense.
    let n = 0;
    const FONTS = [["Inter", "Inter"], ["Playfair Display", "Source Sans 3"], ["DM Sans", "DM Sans"]];
    app.router.register(
      new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (req) => {
        const user = req.messages.find((m) => m.role === "user")?.content ?? "";
        if (/feedback: fail/.test(user)) return { content: "not json" };
        const i = n++ % 3;
        const answer = {
          name: ["Quiet studio", "Editorial week", "Front desk"][i],
          rationale: "Members check the week's classes and book quickly, so the schedule leads.",
          typography: { display: FONTS[i]![0], body: FONTS[i]![1], scale: ["regular", "expressive", "compact"][i], headingWeight: 600, headingCase: "normal" },
          palette: { bg: "#ffffff", surface: "#f7f7f8", surfaceSunken: "#efeff1", text: "#16161a", textMuted: "#55555f", border: "#d9d9de", borderStrong: "#9a9aa5", accent: ["#1d4ed8", "#f9a8d4", "#166534"][i], accentHover: "#1e3a8a", onAccent: "#ffffff", secondary: "#7c3aed" },
          density: "regular",
          surface: { vibe: "flat", radii: [2, 4, 8, 8], borderWidth: 1 },
          contentWidth: "regular",
          signature: "",
          page: {
            sections: [
              { block: "top-nav-variants", props: { brand: "Studio", links: [{ label: "Classes" }, { label: "Pricing" }], actions: [{ label: "Book a class" }] } },
              { block: ["hero-centered", "hero-split", "hero-stats"][i], props: { title: "Find your calm this week", lede: "Book a spot in any class in two taps.", primary: { label: "See this week's classes", href: "#" }, stats: [{ value: "24", label: "classes a week" }] } },
              { block: "features-grid", props: { title: "How it works", items: [{ icon: "calendar", title: "Pick a class", text: "See the week at a glance." }] } },
              { block: "testimonials-cards", props: { title: "Members say", quotes: [{ quote: "Booking is so easy.", name: "Ana", role: "Member" }] } },
              { block: "cta-banner", props: { title: "Your mat is waiting", primary: { label: "Book now", href: "#" } } },
              { block: "footer-simple", props: { brand: "Studio", links: [{ label: "Privacy", href: "#" }] } },
            ],
          },
        };
        return { content: JSON.stringify(answer) };
      }),
    );
    app.router.setRoleAssignment("designer", { providerId: "scripted", model: "designer" });
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    const headers = { authorization: "Bearer t", "content-type": "application/json" };
    const call = async <T>(p: string, body?: unknown) => {
      const res = await fetch(`http://127.0.0.1:${server.port}${p}`, body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
      return { status: res.status, body: (await res.json()) as T };
    };
    try {
      const made = await call<{ project: { id: string } }>("/setups", { name: "Studio", description: "A booking app for a small yoga studio", productType: "saas" });
      const id = made.body.project.id;
      await call(`/projects/${id}/setup`, { designMode: "agents", designNotes: "calm, lots of air", designAvoid: "stock photos" });
      // No Look and Feel approval needed: the design is approved with the plan.
      const started = await call<{ run: { id: string; objective: string } }>(`/projects/${id}/setup/start`, {});
      expect(started.status).toBe(200);
      const runId = started.body.run.id;
      expect(started.body.run.objective).toContain("avoid stock photos");

      // Three proofs, made in the background, each saved as it is ready.
      const proofs = await waitFor(async () => {
        const r = (await call<DesignProofs>(`/runs/${runId}/proofs`)).body;
        return r.rounds[0]?.proofs.every((p) => p.status === "ready") ? r : undefined;
      });
      const ready = proofs.rounds[0]!.proofs;
      expect(ready).toHaveLength(3);
      expect(new Set(ready.map((p) => p.name)).size).toBe(3);
      // A home page from library sections in every proof, each with a different hero; FlowCode fills ids and the year.
      expect(new Set(ready.map((p) => p.page!.sections[1]!.block)).size).toBe(3);
      expect(ready[0]!.page!.sections.at(-1)!.props.year).toBe(new Date().getFullYear());
      expect(ready[0]!.skills!.length).toBeGreaterThan(0);
      expect(ready[0]!.tokens!["--color-accent"]).toBe("#1d4ed8");
      // A too-light accent (local models' usual miss) is fixed by FlowCode, not failed, and the proof says so.
      expect(ready[1]!.tokens!["--color-accent"]).not.toBe("#f9a8d4");
      expect(ready[1]!.settings!.find((x) => x.label === "Contrast")?.value).toContain("the accent");

      // The plan waits for the design whatever happens; nothing is chosen for the person.
      expect(designPending(app.store, runId)).toBe(true);
      expect((await call(`/runs/${runId}/proofs/approve`, {})).status).toBe(409);

      // None of these fit: a revised proof from the feedback, the earlier ones kept. A failed one can be retried.
      const bad = await call<DesignProofs>(`/runs/${runId}/proofs/revise`, { feedback: "fail" });
      expect(bad.body.rounds).toHaveLength(2);
      const failed = await waitFor(async () => (await call<DesignProofs>(`/runs/${runId}/proofs`)).body.rounds[1]?.proofs.find((p) => p.status === "failed"));
      expect(failed.error).toContain("checks");
      const refined = await call<DesignProofs>(`/runs/${runId}/proofs/revise`, { feedback: "warmer", from: ready[1]!.id });
      expect(refined.body.rounds).toHaveLength(3);
      await waitFor(async () => (await call<DesignProofs>(`/runs/${runId}/proofs`)).body.rounds[2]?.proofs[0]?.status === "ready");

      // Choose, approve: the proof's specification is the build's design reference, and the plan can go ahead.
      await call(`/runs/${runId}/proofs/choose`, { proof: ready[2]!.id });
      const approved = await call<DesignProofs>(`/runs/${runId}/proofs/approve`, {});
      expect(approved.body.approved?.proofId).toBe(ready[2]!.id);
      expect(designPending(app.store, runId)).toBe(false);
      expect(app.store.getSetting<{ name: string } | null>(`runDesignSpec:${runId}`, null)?.name).toBe("Front desk");
    } finally {
      await server.close();
    }
  });
});
