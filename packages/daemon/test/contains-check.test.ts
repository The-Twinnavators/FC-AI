import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { sameScreenFiles, usesKitClass } from "../src/quality/verification.js";

const ws = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-contains-"));
  const w = (rel: string, text: string) => (fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }), fs.writeFileSync(path.join(root, rel), text));
  w("src/components/ui/index.tsx", `export function Skeleton() {\n  return <div className="ui-skeleton" />;\n}\nexport function EmptyState() {\n  return <div className="ui-empty" />;\n}\n`);
  w("src/screens/learn-coins.tsx", "export default function Old() { return null; }\n");
  w("src/screens/LearnCoinsScreen.tsx", `import { Skeleton, EmptyState } from "../components/ui";\nexport default function LearnCoinsScreen() { return <><Skeleton /><EmptyState /></>; }\n`);
  w("src/screens/GamesScreen.tsx", "export default function GamesScreen() { return null; }\n");
  return root;
};

describe("contains checks find the work where it really is (Kids cash app)", () => {
  it("treats learn-coins.tsx and LearnCoinsScreen.tsx as the same screen, and nothing else", () => {
    const root = ws();
    const same = sameScreenFiles(path.join(root, "src/screens/learn-coins.tsx")).map((f) => path.basename(f));
    expect(same).toEqual(["LearnCoinsScreen.tsx"]);
  });

  it("counts a building-block class as present when the screen uses the component that draws it", () => {
    const root = ws();
    const screen = fs.readFileSync(path.join(root, "src/screens/LearnCoinsScreen.tsx"), "utf8");
    expect(usesKitClass(screen, "ui-skeleton", root)).toBe(true);
    expect(usesKitClass(screen, "ui-pop", root)).toBe(false);
    expect(usesKitClass("export const x = 1;", "ui-skeleton", root)).toBe(false);
    expect(usesKitClass(screen, "Skeleton", root)).toBe(false);
  });
});
