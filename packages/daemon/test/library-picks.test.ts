/**
 * Library pieces matched to the planned screens (NOBIO: an app spec got nothing but a sidebar from the keyword rules,
 * and page templates were never picked), and a record of which pieces a build used and who chose them.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { screenPicks } from "../src/orchestrator/screenPicks.js";
import { picksIn, sectionsObjective } from "../src/orchestrator/sectionRecipes.js";
import { libraryReport, pieceOf, recordUse } from "../src/orchestrator/libraryUse.js";
import { PathJail } from "../src/security/pathJail.js";
import { makeApp } from "./helpers.js";

const S = (label: string, purpose: string) => ({ label, purpose, id: "", component: "", file: "" });

describe("library pieces matched to the planned screens", () => {
  it("gives a list screen a list and a filter bar, and an app screen its whole-screen template", () => {
    const nobio = screenPicks([S("Brands List", "Show a list of trusted non-GMO brands that users can search, filter by category and open for details.")]);
    expect(nobio.map((p) => p.id).sort()).toEqual(["form-filters", "list-stacked"]);
    const app = screenPicks([S("Assistant", "Chat with an AI assistant about your account"), S("Settings", "Change your profile, notifications and password")]);
    expect(app.map((p) => p.id)).toEqual(["app-ai-chat", "app-settings"]);
  });

  it("picks one sign-in form for a sign-in screen, and nothing for a screen no piece fits", () => {
    expect(screenPicks([S("Sign In", "Authenticate user to access their private calendar")]).map((p) => p.id)).toEqual(["auth-sign-in"]);
    expect(screenPicks([S("Calculator", "Perform basic arithmetic operations using a standard keypad")])).toEqual([]);
  });

  it("keeps the library step's picks and reasons readable back from its objective", () => {
    const picks = [
      { id: "hero-split", reason: "A website's opening: its promise and main action (variant fixed for this project)." },
      { id: "list-stacked", reason: "A starting point for the Brands List screen: Stacked list" },
    ];
    expect(picksIn(sectionsObjective(picks))).toEqual(picks);
    expect(picksIn(sectionsObjective([]))).toEqual([]);
  });
});

describe("which library pieces a build used", () => {
  it("records who chose each piece and whether it reached a screen", () => {
    const { app } = makeApp();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-libuse-"));
    const put = (rel: string, text: string) => (fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }), fs.writeFileSync(path.join(root, rel), text));
    put("src/sections/ListStacked.tsx", "export default function ListStacked() { return null; }");
    put("src/sections/Renamed.tsx", "export default function FormFilters() { return null; }");
    put("src/screens/BrandsListScreen.tsx", 'import ListStacked from "../sections/ListStacked";\nexport default function B() { return <ListStacked />; }');
    expect(pieceOf("src/sections/Renamed.tsx", "export default function FormFilters() {}")?.id).toBe("form-filters");
    recordUse(app.store, "run_x", { id: "list-stacked", by: "flowcode", step: "Add library sections", reason: "For the Brands List screen" });
    recordUse(app.store, "run_x", { id: "form-filters", by: "coder", step: "Design the main screens" });
    recordUse(app.store, "run_x", { id: "auth-sign-in", by: "flowcode", step: "Add library sections" });
    recordUse(app.store, "run_x", { id: "list-stacked", by: "flowcode", step: "again" });
    const rows = libraryReport(app.store, new PathJail(root), "run_x");
    expect(rows.map((r) => [r.id, r.by, r.inApp, r.inScreen])).toEqual([
      ["list-stacked", "flowcode", true, true],
      ["form-filters", "coder", true, false],
      ["auth-sign-in", "flowcode", false, false],
    ]);
  });
});

describe("library pieces placed in the screens", () => {
  it("renders a screen's components under its page header, controls first, and a whole-screen template on its own", async () => {
    const { layoutFiles, parseScreenPlan } = await import("../src/orchestrator/screenPlan.js");
    const plan = parseScreenPlan({ product: "NOBIO", screens: [{ name: "Brands List", purpose: "Browse brands." }, { name: "Settings", purpose: "Change your profile." }] })!;
    const files = layoutFiles(plan, [
      { screen: "Brands List", id: "list-stacked", component: "ListStacked", template: false },
      { screen: "Brands List", id: "form-filters", component: "FormFilters", template: false },
      { screen: "Settings", id: "app-settings", component: "AppSettings", template: true },
    ]);
    const list = files.find((f) => f.path === "src/screens/BrandsListScreen.tsx")!.content;
    expect(list).toContain('import ListStacked from "../sections/ListStacked";');
    expect(list.indexOf("<FormFilters />")).toBeGreaterThan(list.indexOf("<PageHeader"));
    expect(list.indexOf("<FormFilters />")).toBeLessThan(list.indexOf("<ListStacked />"));
    const settings = files.find((f) => f.path === "src/screens/SettingsScreen.tsx")!.content;
    expect(settings).toContain("return <AppSettings />;");
    expect(settings).not.toContain("PageHeader");
  });

  it("asks for a clearer match for a screen's second piece", () => {
    expect(screenPicks([S("Orders", "Review, search and refund customer orders in a table")])).toHaveLength(1);
  });
});

describe("a pattern's use cases", () => {
  it("match a PRD screen named in those words, whatever the pattern's sample shows", async () => {
    const { fit } = await import("../src/orchestrator/screenPicks.js");
    const piece = { id: "calendar-log", name: "Calendar log", category: "data" as const, description: "Dated records with a month calendar.", tags: ["calendar", "log"], useCases: ["attendance", "order history", "time off"] };
    const other = { id: "kpi", name: "KPI cards", category: "cards" as const, description: "Numbers at a glance.", tags: ["kpi", "numbers"] };
    const attendance = { label: "Attendance", purpose: "See which days each member came to class" };
    expect(fit(attendance, piece)).toBeGreaterThanOrEqual(7);
    expect(fit(attendance, other)).toBe(0);
    expect(fit({ label: "History", purpose: "Your order history and refunds" }, piece)).toBeGreaterThanOrEqual(7);
  });
});

describe("a screen's intent", () => {
  it("can use a piece from another shelf when its job matches, but never a whole website template", () => {
    expect(screenPicks([S("Contact", "Customers get in touch with the team")]).map((p) => p.id)).toEqual(["contact-split"]);
    expect(screenPicks([S("Plans", "Studio owners compare plans and pick one for their budget")]).map((p) => p.id)).toEqual(["pricing-tiers"]);
  });
});
