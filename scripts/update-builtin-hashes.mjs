// Records a fingerprint of every built-in prompt and skill at its current version, for test/builtin-versions.test.ts.
// Run after changing a built-in's text AND bumping its version:  npx tsc -b packages/daemon && node scripts/update-builtin-hashes.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = (p) => pathToFileURL(path.join(root, "packages/daemon/dist", p)).href;
const { ROLE_PROMPTS } = await import(dist("orchestrator/prompts.js"));
const { BUILTIN_SKILLS } = await import(dist("knowledge/skills.js"));
const { DEFAULT_SKILLS } = await import(dist("knowledge/defaultSkills.js"));
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex").slice(0, 16);
const file = path.join(root, "packages/daemon/test/fixtures/builtin-hashes.json");
const known = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
for (const p of ROLE_PROMPTS) known[`${p.id}@${p.version}`] = hash(p.template);
for (const s of [...BUILTIN_SKILLS, ...DEFAULT_SKILLS]) known[`${s.id}@${s.version}`] = hash(s.instructions);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.entries(known).sort()), null, 2)}\n`);
console.log(`Recorded ${Object.keys(known).length} built-in fingerprints.`);
