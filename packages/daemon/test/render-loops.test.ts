/** Endless re-render loops are named before a test run hangs on them (No BIO & GMO build). */
import { describe, expect, it } from "vitest";
import { renderLoopNote, renderLoops } from "../src/orchestrator/renderLoops.js";

const screen = (effects: string, extra = "") => `import { useEffect, useMemo, useState } from "react";
export default function Screen({ items }: { items: string[] }) {
  const [filtered, setFiltered] = useState(items);
  const [sort, setSort] = useState("name");
  const [count, setCount] = useState(0);
  ${extra}
  ${effects}
  return <ul>{filtered.map((x) => <li key={x}>{x}</li>)}</ul>;
}`;

describe("render loops", () => {
  it("finds an effect that sets state its own dependencies include (the No BIO & GMO sort effect)", () => {
    const src = screen(`useEffect(() => {
    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => a.localeCompare(b));
    }
    setFiltered(sorted);
  }, [sort, filtered]);`);
    const loops = renderLoops(src);
    expect(loops).toHaveLength(1);
    expect(loops[0].message).toMatch(/sets filtered .* lists filtered/);
    expect(loops[0].message).toContain("useMemo");
  });

  it("finds an effect that depends on a value rebuilt every render and sets state", () => {
    const src = screen(`useEffect(() => {
    setFiltered(visible);
  }, [visible]);`, `const visible = items.filter((x) => x.length > 2);`);
    expect(renderLoops(src)[0].message).toMatch(/visible, which is rebuilt on every render/);
  });

  it("leaves alone effects that are guarded, one-time, timer-based or that set other state", () => {
    const ok = [
      `useEffect(() => {
    if (count > 10) setCount(10);
  }, [count]);`,
      `useEffect(() => {
    setFiltered(items);
  }, []);`,
      `useEffect(() => {
    const t = setTimeout(() => {
      setCount(count + 1);
    }, 500);
    return () => clearTimeout(t);
  }, [count]);`,
      `useEffect(() => {
    setFiltered(items.filter((x) => x.includes(sort)));
  }, [items, sort]);`,
    ];
    for (const e of ok) expect(renderLoops(screen(e)), e).toEqual([]);
  });

  it("puts the file and line in one note, and says nothing when there's no loop", () => {
    const bad = screen(`useEffect(() => {
    setFiltered([...filtered]);
  }, [filtered]);`);
    const note = renderLoopNote([{ path: "src/screens/A.tsx", text: bad }, { path: "src/screens/B.tsx", text: screen("") }]);
    expect(note).toContain("src/screens/A.tsx line");
    expect(note).not.toContain("B.tsx");
    expect(renderLoopNote([{ path: "src/screens/B.tsx", text: screen("") }])).toBe("");
  });
});

describe("tool argument repair", () => {
  it("decodes lists sent as JSON text and wraps a lone edit in a list", async () => {
    const { repairArgs } = await import("../src/orchestrator/agentLoop.js");
    const { ToolArgs } = await import("@flowcode/contracts");
    const asText = { path: "src/a.tsx", edits: JSON.stringify([{ find: "a", replace: "b" }]) };
    expect(ToolArgs.apply_patch.safeParse(asText).success).toBe(false);
    expect(ToolArgs.apply_patch.safeParse(repairArgs(asText)).success).toBe(true);
    expect(ToolArgs.apply_patch.safeParse(repairArgs({ path: "src/a.tsx", edits: { find: "a", replace: "b" } })).success).toBe(true);
    expect(repairArgs({ path: "src/a.tsx", content: "plain text" })).toBeUndefined();
  });
});

describe("a corrected file written as a code block", () => {
  const file = ["import { useMemo, useState } from \"react\";", "", "export default function Screen() {", ...Array.from({ length: 12 }, (_, i) => `  const v${i} = ${i};`), "  return null;", "}"].join("\n");
  const allowed = new Set(["replace_file", "read_file"]);
  it("becomes a replace_file call when the reply names one file and has one complete block", async () => {
    const { codeBlockEdit } = await import("../src/orchestrator/agentLoop.js");
    const call = codeBlockEdit(`The loop is in src/screens/NonGMOBrandsScreen.tsx. Here is the fixed file:\n\n\`\`\`tsx\n${file}\n\`\`\`\n`, allowed);
    expect(call).toMatchObject({ name: "replace_file", arguments: { path: "src/screens/NonGMOBrandsScreen.tsx", content: file } });
  });
  it("is left alone for fragments, several files, several blocks, or a role that can't replace files", async () => {
    const { codeBlockEdit } = await import("../src/orchestrator/agentLoop.js");
    const fragment = file.replace("  return null;", "  // ... rest unchanged\n  return null;");
    expect(codeBlockEdit(`Fix src/screens/A.tsx:\n\`\`\`tsx\n${fragment}\n\`\`\``, allowed)).toBeUndefined();
    expect(codeBlockEdit(`src/screens/A.tsx and src/screens/B.tsx:\n\`\`\`tsx\n${file}\n\`\`\``, allowed)).toBeUndefined();
    expect(codeBlockEdit(`src/screens/A.tsx:\n\`\`\`tsx\n${file}\n\`\`\`\n\`\`\`tsx\n${file}\n\`\`\``, allowed)).toBeUndefined();
    expect(codeBlockEdit(`src/screens/A.tsx:\n\`\`\`tsx\n${file}\n\`\`\``, new Set(["read_file"]))).toBeUndefined();
  });
});
