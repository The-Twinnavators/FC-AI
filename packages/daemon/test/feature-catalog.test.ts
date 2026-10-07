import { describe, expect, it } from "vitest";
import { APP_GUIDE, FEATURE_CATALOG, featureFamily, searchFeatures } from "@flowcode/contracts";

describe("feature catalog", () => {
  const ids = new Set(FEATURE_CATALOG.map((f) => f.id));
  const anchors = new Set(APP_GUIDE.map((a) => a.id));
  it("has unique ids and only valid links, parents and UI anchors", () => {
    expect(ids.size).toBe(FEATURE_CATALOG.length);
    for (const f of FEATURE_CATALOG) {
      if (f.parent) expect(ids, `${f.id} parent`).toContain(f.parent);
      for (const r of f.related ?? []) expect(ids, `${f.id} related ${r}`).toContain(r);
      for (const a of f.anchors ?? []) expect(anchors, `${f.id} anchor ${a}`).toContain(a);
    }
  });
  it("explains a page with all of its parts", () => {
    const fam = featureFamily("page.builder").map((f) => f.id);
    expect(fam).toEqual(expect.arrayContaining(["builder.chat", "builder.tab.preview", "builder.strip"]));
    expect(featureFamily("ws.strip")[0]?.id).toBe("builder.strip");
  });
  it("finds features from plain questions", () => {
    expect(searchFeatures("how do I upload a pdf").map((f) => f.id)).toContain("library.upload");
    expect(searchFeatures("what does autonomy mean").map((f) => f.id)).toContain("concept.autonomy");
  });
});

describe("explanations", () => {
  it("lists a feature's parts from sub-entries or its parts list", async () => {
    const { explainParts } = await import("@flowcode/contracts");
    expect(explainParts("ws.strip").parts.map((p) => p.name)).toContain("Typecheck");
    expect(explainParts("page.builder").parts.map((p) => p.name)).toContain("Preview tab");
    expect(explainParts("dash.newbuild").howTo.length).toBeGreaterThan(0);
  });
});

describe("catalog completeness", () => {
  it("gives every feature a parts list (its own, or its sub-entries)", () => {
    const parents = new Set(FEATURE_CATALOG.map((f) => f.parent).filter(Boolean));
    const missing = FEATURE_CATALOG.filter((f) => !f.parts?.length && !parents.has(f.id)).map((f) => f.id);
    expect(missing).toEqual([]);
  });
});

describe("guided steps", () => {
  it("resolves a step to its page, tab and highlight", async () => {
    const { stepTarget } = await import("@flowcode/contracts");
    expect(stepTarget("builder.tab.styles", "prj_1")).toMatchObject({ route: "/projects/prj_1", tab: "styles", needsProject: true });
    expect(stepTarget("builder.tab.styles").route).toBeUndefined();
    expect(stepTarget("settings.speed")).toMatchObject({ route: "/settings/speed" });
    expect(stepTarget("ws.strip").feature?.id).toBe("builder.strip");
  });
});

/**
 * The Copilot answers from the catalog, so the catalog (and the UI copy) must only name controls that exist today.
 * VUS-05/12: retired tab names and invented shortcuts sent people looking for things that aren't there.
 */
describe("no retired names or invented shortcuts", () => {
  const RETIRED = [/\bApprovals tab\b/, /\bChanges tab\b/, /\bTerminal tab\b/, /\bReports tab\b/, /\bImprovements page\b/, /\bPlain\/Technical\b/];
  const SHORTCUT = /\bCtrl\s*\+\s*([A-Z0-9])\b/g;
  const ALLOWED_SHORTCUTS = new Set(["K", "B"]);
  it("the feature catalog names only current tabs and real shortcuts", () => {
    for (const f of FEATURE_CATALOG) {
      const text = JSON.stringify(f);
      for (const re of RETIRED) expect(re.test(text), `${f.id} mentions ${re}`).toBe(false);
      for (const m of text.matchAll(SHORTCUT)) expect(ALLOWED_SHORTCUTS.has(m[1]!), `${f.id} names Ctrl+${m[1]}`).toBe(true);
    }
  });
  it("UI copy names only current tabs", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "../../../apps/ui/src");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk(root);
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      for (const re of RETIRED) expect(re.test(text), `${path.relative(root, f)} mentions ${re}`).toBe(false);
    }
  });
});

describe("new features", () => {
  it("marks a feature new for NEW_FOR_DAYS days after it was added, then not", async () => {
    const { isNewFeature, NEW_FOR_DAYS } = await import("@flowcode/contracts");
    const added = Date.parse("2026-10-07T00:00:00");
    expect(isNewFeature({ added: "2026-10-07" }, added + 86_400_000)).toBe(true);
    expect(isNewFeature({ added: "2026-10-07" }, added + (NEW_FOR_DAYS + 1) * 86_400_000)).toBe(false);
    expect(isNewFeature({}, added)).toBe(false);
  });
  it("gives every new feature a real date", () => {
    for (const f of FEATURE_CATALOG.filter((x) => x.added)) expect(Number.isFinite(Date.parse(`${f.added}T00:00:00`)), f.id).toBe(true);
  });
});
