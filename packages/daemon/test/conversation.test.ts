/**
 * The conversation-led builder: a description becomes a project, FlowCode says what it will build and asks quick-choice
 * questions in the chat, answers (or "Choose for me") start the build with no Look step, design concepts or plan
 * approval, and a message during the build is queued (said so) and becomes a change when the build ends.
 */
import { describe, expect, it } from "vitest";
import { ScriptedProvider } from "../src/models/scripted.js";
import { startServer } from "../src/api/server.js";
import { buildBrief, type Conversation } from "../src/api/conversation.js";
import { getDesignState } from "../src/workspace/designState.js";
import { makeApp } from "./helpers.js";

describe("the conversation-led builder", () => {
  it("clarifies in the chat, then builds without a design or plan approval, and queues a change sent mid-build", async () => {
    const { app } = makeApp();
    app.router.register(
      new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async () => ({
        content: JSON.stringify({
          interpretation: "I'll start with booking a class for members, then the schedule and the studio's admin.",
          assumptions: ["Members book on their phones"],
          questions: [
            { question: "Who books most often?", why: "It sets what the first screen shows.", options: ["Members", "Front desk staff"] },
            { question: "Can members cancel?", why: "It adds a cancel flow.", options: ["Yes, up to 2 hours before", "No"] },
          ],
        }),
      })),
    );
    app.router.setRoleAssignment("planner", { providerId: "scripted", model: "planner" });
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    const headers = { authorization: "Bearer t", "content-type": "application/json" };
    const call = async <T>(p: string, body?: unknown) => {
      const res = await fetch(`http://127.0.0.1:${server.port}${p}`, body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
      return { status: res.status, body: (await res.json()) as T };
    };
    try {
      const made = await call<{ project: { id: string }; conversation: Conversation }>("/conversations", { description: "A booking app for a small yoga studio, warm and calm" });
      expect(made.status).toBe(200);
      const id = made.body.project.id;
      expect(made.body.conversation.messages[0]).toMatchObject({ role: "user", text: "A booking app for a small yoga studio, warm and calm" });

      // FlowCode's first reply: what it will build, its assumption, and the quick choices.
      const asked = await call<Conversation>(`/projects/${id}/conversation/clarify`, {});
      const interpretation = asked.body.messages.find((m) => m.kind === "interpretation")!;
      expect(interpretation.text).toContain("booking a class");
      expect(interpretation.text).toContain("Members book on their phones");
      const qs = asked.body.messages.flatMap((m) => m.questions ?? []);
      expect(qs.map((q) => q.options.length)).toEqual([2, 2]);

      // An answer, "Choose for me" and extra detail all go into what gets built.
      await call(`/projects/${id}/conversation/answer`, { questionId: qs[0]!.id, answer: "Members" });
      await call(`/projects/${id}/conversation/answer`, { questionId: qs[1]!.id, answer: null });
      await call(`/projects/${id}/conversation/message`, { text: "Show the teacher on each class" });
      const before = (await call<Conversation>(`/projects/${id}/conversation`)).body;
      const brief = buildBrief(before);
      expect(brief).toContain("Who books most often? Members");
      expect(brief).toContain("Can members cancel? (FlowCode chooses");
      expect(brief).toContain("Show the teacher on each class");

      // The build starts straight away: no Look approval, design concepts or plan approval.
      const built = await call<Conversation>(`/projects/${id}/conversation/build`, {});
      expect(built.status).toBe(200);
      expect(built.body.stage).toBe("building");
      const runId = built.body.messages.find((m) => m.kind === "build")!.runId!;
      expect(app.store.getSetting(`runLook:${runId}`, {})).toMatchObject({ conversation: true });
      expect(app.store.getSetting(`runProofs:${runId}`, null)).toBeNull();
      // The Look is read from the description (warm) and chosen, so the style step has one to apply.
      expect(getDesignState(app.store, id).selected).toBeTruthy();

      // A message while it builds is queued, and the chat says so.
      const queued = await call<Conversation>(`/projects/${id}/conversation/message`, { text: "Make the buttons rounder" });
      if (queued.body.queue.length) expect(queued.body.messages.at(-1)).toMatchObject({ state: "queued" });
      else expect(queued.body.messages.at(-1)).toMatchObject({ kind: "build", state: "started" });
    } finally {
      await server.close();
    }
  });
});
