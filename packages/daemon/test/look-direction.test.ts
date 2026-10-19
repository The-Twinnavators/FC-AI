/**
 * The design direction: words read into the Look (with what each phrase changed, and what wasn't read), locks that
 * hold on the server, every chosen direction kept to compare and restore, the live-preview bridge added to an app's
 * preview listener, and the rendered page checked against the applied tokens.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { BASE_APPEARANCE, appearanceTokens, interpretDirection, shapeTokens, withLocks } from "@flowcode/contracts";
import { describeState, getDesignState, restoreVersion, saveDraft, selectDraft, setLocks } from "../src/workspace/designState.js";
import { BRIDGE_MARK, withBridge } from "../src/workspace/previewBridge.js";
import { lookReached } from "../src/quality/lookReached.js";
import { makeApp, makeProject } from "./helpers.js";

// Frameproof's PRD, section 7 (Visual direction), as written there.
const FRAMEPROOF = "Editorial contact sheet. Warm off-white background. Near-black text. Muted cobalt accent for primary actions and selected states. Fine borders and restrained corner rounding. Generous whitespace and clear typographic hierarchy. Minimal chrome around photography. Balanced motion, expressive effects off.";

describe("reading a direction", () => {
  it("reads Frameproof's visual direction into the Look, saying what each phrase changed", () => {
    const r = interpretDirection(FRAMEPROOF);
    expect(r.appearance).toMatchObject({ mode: "light", neutral: "warm", primary: "#3d5a99", fonts: { display: "Playfair Display", body: "Source Sans 3" }, shape: { radius: 6, density: "spacious", borders: "fine" }, typeScale: { ratio: 1.25 }, motion: { level: "balanced" } });
    expect(r.understood.map((u) => u.change)).toEqual(expect.arrayContaining(["primary colour muted cobalt (#3d5a99)", "restrained corners (6px)", "fine 1px borders", "spacious density", "expressive effects stay off"]));
    // Composition isn't a token: it is marked as the design build step's work, not dropped.
    expect(r.understood.some((u) => u.group === "build" && /contact sheet/i.test(u.words))).toBe(true);
    expect(r.unread).toEqual(["Minimal chrome around photography"].filter((x) => !r.understood.some((u) => u.words === x)));
  });

  it("reads the PRD's whole visual-direction section: section order and 'Avoid' lines are build notes, not words to match", () => {
    const prd = fs.readFileSync(path.resolve(import.meta.dirname, "../../../docs/reliability/frameproof-eval/Frameproof-PRD.md"), "utf8");
    const section = prd.slice(prd.indexOf("## 7. Visual direction") + 22, prd.indexOf("## 8.")).replace(/^#+\s*/gm, "").replace(/^\s*[-*]\s+/gm, "").replace(/\n{2,}/g, "\n").trim();
    const r = interpretDirection(section);
    // "1. Compact product header…" is a section of the screen, not a density: the whitespace asked for stays.
    expect(r.appearance.shape).toEqual({ radius: 6, density: "spacious", borders: "fine" });
    expect(r.understood.find((u) => u.words.startsWith("Compact product header"))).toMatchObject({ group: "build" });
    expect(r.understood.find((u) => u.words.startsWith("Avoid dashboard KPI cards"))).toMatchObject({ group: "build" });
    expect(r.unread).toEqual(["keep submission easy to find without obscuring content"]);
  });

  it("never changes a locked group, and says so", () => {
    const from = { ...BASE_APPEARANCE, primary: "#070817" };
    const r = interpretDirection("Muted cobalt accent. Square corners.", from, ["colors"]);
    expect(r.appearance.primary).toBe("#070817");
    expect(r.appearance.shape?.radius).toBe(0);
    expect(r.understood.find((u) => u.group === "colors")).toMatchObject({ locked: true });
  });

  it("lists back what it couldn't read", () => {
    expect(interpretDirection("Feels like a quiet museum at dusk").unread).toEqual(["Feels like a quiet museum at dusk"]);
  });

  it("shape and density become the app's own token names", () => {
    expect(shapeTokens({ radius: 10, density: "compact", borders: "strong" })).toMatchObject({ "--radius-xl": "10px", "--radius-sm": "4px", "--space-4": "0.75rem", "--control-md": "2.25rem", "--border-width": "2px" });
  });
});

describe("locks and versions on the server", () => {
  const setup = () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "README.md": "# demo\n" });
    return { app, id: project.id, jail };
  };

  it("a draft can't change a locked group: the chosen direction's value is kept", () => {
    const s = setup();
    saveDraft(s.app.store, s.id, { ...BASE_APPEARANCE, primary: "#3d5a99" }, { primary: "you" });
    selectDraft(s.app.store, s.id);
    setLocks(s.app.store, s.id, ["colors", "not-a-group"]);
    saveDraft(s.app.store, s.id, { ...BASE_APPEARANCE, primary: "#c0392b", shape: { radius: 4, density: "comfortable", borders: "fine" } }, {});
    const st = getDesignState(s.app.store, s.id);
    expect(st.locks).toEqual(["colors"]);
    expect(st.draft!.appearance.primary).toBe("#3d5a99");
    expect(st.draft!.appearance.shape?.radius).toBe(4);
  });

  it("a lock freezes what is on screen (the unsaved draft), not an older saved version", () => {
    const s = setup();
    saveDraft(s.app.store, s.id, { ...BASE_APPEARANCE, primary: "#070817" }, {});
    selectDraft(s.app.store, s.id);
    saveDraft(s.app.store, s.id, { ...BASE_APPEARANCE, primary: "#7a2338" }, {});
    setLocks(s.app.store, s.id, ["colors"]);
    saveDraft(s.app.store, s.id, { ...BASE_APPEARANCE, primary: "#3d5a99", shape: { radius: 0, density: "compact", borders: "fine" } }, {});
    const st = getDesignState(s.app.store, s.id);
    expect(st.draft!.appearance.primary).toBe("#7a2338");
    expect(st.draft!.appearance.shape?.radius).toBe(0);
  });

  it("keeps every chosen direction and brings one back as a draft", () => {
    const s = setup();
    saveDraft(s.app.store, s.id, { ...BASE_APPEARANCE, primary: "#3d5a99" }, {});
    selectDraft(s.app.store, s.id);
    saveDraft(s.app.store, s.id, { ...BASE_APPEARANCE, primary: "#c0392b" }, {});
    selectDraft(s.app.store, s.id);
    expect(describeState(s.app.store, s.id).versions.map((v) => [v.version, v.appearance.primary])).toEqual([[1, "#3d5a99"], [2, "#c0392b"]]);
    restoreVersion(s.app.store, s.id, 1);
    const st = getDesignState(s.app.store, s.id);
    expect(st.draft!.appearance.primary).toBe("#3d5a99");
    expect(st.selected!.version).toBe(2);
    expect(() => restoreVersion(s.app.store, s.id, 9)).toThrow(/isn't in this project's saved directions/);
  });

  it("a direction chosen before the history existed isn't lost when a new one is saved", () => {
    const s = setup();
    // As an older project has it: a selected version 2 and no history.
    s.app.store.setSetting(`designState:${s.id}`, { surfaceExceptions: [], selected: { appearance: { ...BASE_APPEARANCE, primary: "#070817" }, sources: {}, version: 2, selectedAt: "2026-10-18T16:55:58.880Z", by: "you" } });
    saveDraft(s.app.store, s.id, { ...BASE_APPEARANCE, primary: "#7a2338" }, {});
    selectDraft(s.app.store, s.id);
    expect(describeState(s.app.store, s.id).versions.map((v) => [v.version, v.appearance.primary])).toEqual([[2, "#070817"], [3, "#7a2338"]]);
    restoreVersion(s.app.store, s.id, 2);
    expect(getDesignState(s.app.store, s.id).draft!.appearance.primary).toBe("#070817");
  });

  it("withLocks copies only the locked groups", () => {
    const keep = { ...BASE_APPEARANCE, primary: "#111111", fonts: { display: "Fraunces", body: "Work Sans" } };
    const next = withLocks({ ...BASE_APPEARANCE, primary: "#222222", fonts: { display: "Inter", body: "Inter" } }, keep, ["type"]);
    expect(next.primary).toBe("#222222");
    expect(next.fonts.display).toBe("Fraunces");
  });
});

describe("the live preview bridge", () => {
  it("is added to the starter's preview listener, once, and the starter already has it", () => {
    const starter = fs.readFileSync(path.resolve(import.meta.dirname, "../../../templates/react-vite-starter/src/main.tsx"), "utf8");
    expect(starter).toContain(BRIDGE_MARK);
    const before = starter.replace(/\/\/ FlowCode's design preview[\s\S]*?\n};\n(?=window\.addEventListener)/, "").replace(/  if \(d && d\.type === "flowcode:(tokens|fonts|hello)"\)[^\n]*\n/g, "");
    expect(before).not.toContain(BRIDGE_MARK);
    const after = withBridge(before)!;
    expect(after).toContain(BRIDGE_MARK);
    expect(after).toContain('if (d && d.type === "flowcode:theme") setTheme(d.theme);');
    expect(withBridge(after)).toBe(after);
    expect(withBridge("export {};\n")).toBeUndefined();
  });
});

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1")("the applied direction on the rendered page", () => {
  const serve = (css: string) =>
    new Promise<{ url: string; close: () => void }>((resolve) => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(`<!doctype html><html><head><style>${css}</style></head><body><h1>Gallery</h1><p>Photos</p></body></html>`);
      });
      server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, close: () => server.close() }));
    });
  const look = { ...BASE_APPEARANCE, primary: "#3d5a99", neutral: "warm" as const, fonts: { display: "Georgia", body: "Arial" } };
  const tokens = appearanceTokens(look);
  const rootCss = `:root{${Object.entries(tokens).map(([k, v]) => `${k}:${v}`).join(";")}}`;

  it("passes when the page uses the tokens", async () => {
    const s = await serve(`${rootCss} body{background:var(--color-bg);color:var(--color-text);font-family:var(--font-sans)} h1{font-family:var(--font-display)}`);
    try {
      const r = await lookReached(s.url, tokens);
      expect(r.mismatched).toEqual([]);
      expect(r.ok).toBe(true);
    } finally {
      s.close();
    }
  }, 60_000);

  it("fails when the tokens are written but a screen draws its own colours and fonts", async () => {
    const s = await serve(`${rootCss} body{background:#ffffff;color:#333333;font-family:Courier} h1{font-family:Courier}`);
    try {
      const r = await lookReached(s.url, tokens);
      expect(r.ok).toBe(false);
      expect(r.mismatched.map((m) => m.what)).toEqual(expect.arrayContaining(["the page background", "the body text colour", "the body font", "the heading font"]));
    } finally {
      s.close();
    }
  }, 60_000);
});
