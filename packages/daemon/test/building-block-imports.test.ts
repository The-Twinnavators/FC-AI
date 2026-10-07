/** Building-block imports must point at the one index file, from the importing file's folder. */
import { describe, expect, it } from "vitest";
import { buildingBlockImports } from "../src/orchestrator/guards.js";

describe("building-block import guard", () => {
  it("refuses guessed per-component files and gives the exact import (seen in the Calendar follow-up)", () => {
    const text = 'import { useState } from "react";\nimport AppShell from "../components/ui/AppShell";\nimport { Button } from "../components/ui/Button";\n';
    const msg = buildingBlockImports("src/components/Calendar/Calendar.tsx", text)!;
    expect(msg).toMatch(/Not applied/);
    expect(msg).toContain('import { AppShell, Button } from "../ui";');
  });

  it("refuses a path that doesn't resolve from the file's folder", () => {
    const msg = buildingBlockImports("src/components/Calendar/Calendar.tsx", 'import { Card } from "../components/ui";\n')!;
    expect(msg).toContain('import { Card } from "../ui";');
  });

  it("refuses a made-up package for the building blocks (Calendar test 4: 45 minutes on `@flowcode/ui`)", () => {
    const msg = buildingBlockImports("src/App.tsx", 'import { AppShell, PageHeader, Section, Card } from "@flowcode/ui";\nimport { useScreen } from "./lib/screens";\n')!;
    expect(msg).toContain('import { AppShell, PageHeader, Section, Card } from "./components/ui";');
    expect(buildingBlockImports("src/screens/Home.tsx", 'import { Button } from "@/components/ui";')).toContain('from "../components/ui"');
    expect(buildingBlockImports("src/screens/Home.tsx", 'import { Button } from "components/ui";')).toContain('from "../components/ui"');
    // Real packages that happen to end in "ui" are left alone when they don't import building blocks.
    expect(buildingBlockImports("src/App.tsx", 'import { Popover } from "@headlessui/react";\nimport { Slot } from "@radix-ui";')).toBeUndefined();
  });

  it("accepts the right imports from anywhere in src", () => {
    expect(buildingBlockImports("src/App.tsx", 'import { AppShell } from "./components/ui";')).toBeUndefined();
    expect(buildingBlockImports("src/screens/Home.tsx", 'import { Hero } from "../components/ui";')).toBeUndefined();
    expect(buildingBlockImports("src/components/Calendar/Calendar.tsx", 'import { Card } from "../ui";')).toBeUndefined();
    expect(buildingBlockImports("src/screens/Home.tsx", 'import { Grid } from "../components/ui/screen-parts";')).toBeUndefined();
    expect(buildingBlockImports("src/components/ui/screen-parts.tsx", 'import x from "./Nope";')).toBeUndefined();
    expect(buildingBlockImports("src/App.tsx", 'import { useScreen } from "./lib/screens";')).toBeUndefined();
  });
});
