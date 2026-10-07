/** Refuses an edit that adds a second top-level declaration of the same name (seen in the Calendar CSSVibes test). */
import { describe, expect, it } from "vitest";
import { editGuard } from "../src/orchestrator/guards.js";

const APP = 'import { AppShell } from "./components/ui";\n\nconst screens = {\n  calendar: { title: "Calendar" },\n};\n\nexport default function App() {\n  return <AppShell name="Calendar" screens={[]} current="calendar" onNavigate={() => {}}>{null}</AppShell>;\n}\n';

describe("duplicate declaration guard", () => {
  it("refuses a patch that adds a second const screens", () => {
    const msg = editGuard("apply_patch", "src/App.tsx", APP, { edits: [{ find: "export default function App() {", replace: "// Define screens\nconst screens = {\n  calendar: { title: 'Calendar' },\n};\n\nexport default function App() {" }] }, { patchMisses: 0 });
    expect(msg).toMatch(/declare `screens` 2 times/);
  });

  it("allows changing the existing declaration", () => {
    expect(editGuard("apply_patch", "src/App.tsx", APP, { edits: [{ find: '  calendar: { title: "Calendar" },', replace: '  calendar: { title: "Calendar" },\n  settings: { title: "Settings" },' }] }, { patchMisses: 0 })).toBeUndefined();
  });
});
