/**
 * The app-model stage's request in validation 2, rebuilt offline from the a2b1bfa build (packages/daemon/dist-v2) with
 * the run's own PRD and constraints: what the planner was told when it returned an unusable model. No model call.
 */
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../..");
import { pathToFileURL } from "node:url";
const d = (m) => import(pathToFileURL(path.join(root, "packages/daemon/dist-v2", m)).href);
const { planScope, planDirectives } = await d("orchestrator/planScope.js");
const { appModelRequest, APP_PARTS_NOTE } = await d("orchestrator/appModel.js");
const { extractRequirements } = await d("quality/spec.js");
const { placeBySection } = await d("quality/lrcPlan.js");
const { releaseBoundary } = await d("orchestrator/experienceMap.js");
const { promptConfigFor } = await d("quality/taskPrompt.js");
const prd = fs.readFileSync(path.join(root, "docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
const reqs = extractRequirements(prd, 600);
const scope = planScope(prd, []);
const by = placeBySection(reqs, promptConfigFor({ stack: "React", scripts: ["typecheck", "build", "test"] }));
const features = by.features.filter((r) => !scope.dataSections.includes(r.section.replace(/^\d+(\.\d+)*[.)]?\s*/, "").trim().toLowerCase()));
const boundary = [releaseBoundary(by.items), planDirectives(scope, features)].filter(Boolean).join("\n\n");
const req = appModelRequest("Clean Cart: build the slice in the attached PRD as a complete working prototype: Home, search, a product's page, save it, and see it on Saved.", prd, reqs, boundary, "");
fs.writeFileSync(path.join(root, "docs/reliability/planning-validation-2/v1-blocked/app-model-request.txt"), `${APP_PARTS_NOTE}\n\n---\n\n${req}`);
console.log(req.length, "chars\n", boundary);
