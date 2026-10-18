/**
 * One governed path for the look: colours, fonts and the surface style change only through the project's design state
 * (draft → "Use this direction" → "Apply changes"). The older direct writers - a design style, the palette, the surface
 * style, and colour/font tokens in a design write - are refused with a pointer to the Look and leave the app untouched.
 * Corners, spacing and sizes may still be set directly; the Tokens tab's single-token edit stays as the advanced path.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { startServer } from "../src/api/server.js";
import { makeApp, makeProject } from "./helpers.js";

const STARTER_TOKENS = fs.readFileSync(path.resolve(__dirname, "../../../templates/react-vite-starter/src/styles/tokens.css"), "utf8");

describe("one governed appearance path", () => {
  it("refuses the older colour, font and surface writers; corners and the advanced token edit still work", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "src/styles/tokens.css": STARTER_TOKENS });
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    const file = path.join(app.projects.jail(project.id).root, "src/styles/tokens.css");
    const call = (p: string, body: unknown) => fetch(`http://127.0.0.1:${server.port}/projects/${project.id}${p}`, { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(body) });
    try {
      for (const [p, body] of [
        ["/design/choice", { id: "soft-neutral" }],
        ["/design/palette", { brand: [{ hex: "#be123c", role: "primary" }] }],
        ["/styles/surface", { vibe: "neo-brutalism" }],
        ["/design", { theme: "default", values: { "--color-accent": "#be123c" } }],
        ["/design", { theme: "default", values: { "--font-display": "Oswald, sans-serif" } }],
        ["/design", { theme: "default", values: { "--radius-md": "6px" }, googleFonts: ["Oswald"] }],
      ] as const) {
        const res = await call(p, body);
        expect(res.status, p).toBe(409);
        expect(((await res.json()) as { error?: string; message?: string }).error ?? "").toMatch(/changed in Look/);
      }
      expect(fs.readFileSync(file, "utf8")).toBe(STARTER_TOKENS);
      expect(app.store.getSetting(`designChoice:${project.id}`, null)).toBeNull();

      // Corners stay a direct edit.
      const corners = await call("/design", { theme: "default", values: { "--radius-md": "6px" } });
      expect(corners.status).toBe(200);
      expect(fs.readFileSync(file, "utf8")).toMatch(/--radius-md:\s*6px/);

      // The advanced single-token edit (Tokens tab) is kept, separate from the Look.
      const styles = (await (await fetch(`http://127.0.0.1:${server.port}/projects/${project.id}/styles`, { headers: { authorization: "Bearer t" } })).json()) as { tokens: Array<{ file: string; name: string; selector: string; value: string; theme: string }> };
      const accent = styles.tokens.find((t) => t.name === "--color-accent" && t.theme === "default")!;
      const raw = await call("/styles", { file: accent.file, name: accent.name, selector: accent.selector, expected: accent.value, value: "#123456" });
      expect(raw.status).toBe(200);
    } finally {
      await server.close();
    }
  });
});
