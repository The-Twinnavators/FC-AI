/**
 * A built-in prompt or skill whose text changes must get a new version: installs only take a newer version, and the
 * library refuses one version with two texts (Coder and Planner were once improved without a bump: installs kept the
 * old text, and the fix crashed startup). After changing one, bump its version and run scripts/update-builtin-hashes.mjs.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PROMPTS } from "../src/orchestrator/prompts.js";
import { BUILTIN_SKILLS } from "../src/knowledge/skills.js";
import { DEFAULT_SKILLS } from "../src/knowledge/defaultSkills.js";

const known = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/builtin-hashes.json"), "utf8")) as Record<string, string>;
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex").slice(0, 16);

describe("built-in versions", () => {
  it("never changes a built-in's text without a new version", () => {
    const changed: string[] = [];
    for (const p of ROLE_PROMPTS) if (known[`${p.id}@${p.version}`] && known[`${p.id}@${p.version}`] !== hash(p.template)) changed.push(`${p.id}@${p.version}`);
    for (const s of [...BUILTIN_SKILLS, ...DEFAULT_SKILLS]) if (known[`${s.id}@${s.version}`] && known[`${s.id}@${s.version}`] !== hash(s.instructions)) changed.push(`${s.id}@${s.version}`);
    expect(changed, "Bump the version of each, then run scripts/update-builtin-hashes.mjs").toEqual([]);
  });
});
