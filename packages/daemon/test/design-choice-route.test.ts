/**
 * Picking a design style writes that style's own colours (Build test 3: Soft Neutral's cream background came out pink,
 * because rebuilding the colour ramps afterwards rewrote the role colours from the accent alone).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESIGN_TEMPLATES } from "@flowcode/contracts";
import { startServer } from "../src/api/server.js";
import { makeApp, makeProject } from "./helpers.js";

const STARTER_TOKENS = fs.readFileSync(path.resolve(__dirname, "../../../templates/react-vite-starter/src/styles/tokens.css"), "utf8");
const tokenOf = (css: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim().toLowerCase();

describe("design style choice", () => {
  it("leaves the app with the style's own background, text, border and accent", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "src/styles/tokens.css": STARTER_TOKENS });
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/projects/${project.id}/design/choice`, { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ id: "soft-neutral" }) });
      expect(res.status).toBe(200);
      const css = fs.readFileSync(path.join(app.projects.jail(project.id).root, "src/styles/tokens.css"), "utf8");
      const t = DESIGN_TEMPLATES.find((x) => x.id === "soft-neutral")!;
      expect(tokenOf(css, "--color-bg")).toBe(t.colors.bg.toLowerCase());
      expect(tokenOf(css, "--color-text")).toBe(t.colors.text.toLowerCase());
      expect(tokenOf(css, "--color-border")).toBe(t.colors.border.toLowerCase());
      expect(tokenOf(css, "--color-accent")).toBe(t.colors.accent.toLowerCase());
    } finally {
      await server.close();
    }
  });
});
