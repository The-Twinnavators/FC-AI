/** The Angular starter template: its files, the plan built on it, and the checks a build on it must pass. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEMPLATES, assembleTask, specFallbackTasks, specRequiredChecks, specRuntimeTasks, starterOf } from "../src/orchestrator/templates.js";
import { detectPreflight } from "../src/workspace/preflight.js";
import { findAngularComponents } from "../src/workspace/componentLibrary.js";

const ng = TEMPLATES["angular-starter"];

function files(dir: string, base = ""): string[] {
  return fs.readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    return e.isDirectory() ? files(dir, rel) : [rel];
  });
}

describe("Angular starter template", () => {
  it("ships the files a build needs, all plain text (the scaffold copies them as text)", () => {
    const list = files(ng.dir);
    for (const f of ["package.json", "angular.json", "tsconfig.json", "tsconfig.app.json", "src/main.ts", "src/app/app.ts", "src/app/app.html", "src/app/app.spec.ts", "src/styles/tokens.css", "src/styles/app.css", "public/favicon.svg"]) expect(list).toContain(f);
    for (const f of list) {
      const buf = fs.readFileSync(path.join(ng.dir, f));
      expect(Buffer.from(buf.toString("utf8"), "utf8").equals(buf), `${f} is not plain text`).toBe(true);
      expect(buf.length, `${f} is empty`).toBeGreaterThan(0);
    }
    expect(list.some((f) => f.startsWith("node_modules/") || f.startsWith("dist/"))).toBe(false);
  });

  it("uses FlowCode's design tokens and runs every check without asking", () => {
    expect(fs.readFileSync(path.join(ng.dir, "src/styles/tokens.css"), "utf8")).toBe(fs.readFileSync(path.join(TEMPLATES["react-vite-scheduler"].dir, "src/styles/tokens.css"), "utf8"));
    const angularJson = JSON.parse(fs.readFileSync(path.join(ng.dir, "angular.json"), "utf8"));
    expect(angularJson.projects.app.architect.build.options.styles).toEqual(["src/styles/tokens.css", "src/styles/app.css"]);
    expect(angularJson.projects.app.architect.test.builder).toBe("@angular/build:unit-test");
    const pf = detectPreflight("p", ng.dir);
    expect(pf.projectType).toBe("angular");
    const by = Object.fromEntries(pf.scripts.map((s) => [s.name, s]));
    expect(Object.keys(by).sort()).toEqual(["build", "start", "test", "typecheck"]);
    for (const s of Object.values(by)) expect(s.policy, `${s.name}: ${s.reasons.join(", ")}`).toBe("auto");
  });

  it("is read by the component list (its root component)", () => {
    const root = findAngularComponents([{ rel: "src/app/app.ts", text: fs.readFileSync(path.join(ng.dir, "src/app/app.ts"), "utf8") }]);
    expect(root).toMatchObject([{ name: "App", selector: "app-root" }]);
  });
});

describe("builds planned on the Angular starter", () => {
  it("install, then wire into the root component, checked by type check, tests and build instead of the React wiring check", () => {
    const runtime = specRuntimeTasks([], "angular-starter");
    expect(runtime[0].objective).toMatch(/Angular starter/);
    expect(runtime[1].acceptanceCriteria[0].check).toEqual({ type: "file_exists", path: "node_modules/@angular/core/package.json" });
    const checks = specRequiredChecks([], "angular-starter");
    expect(checks).not.toContain("app_wiring");
    expect(checks).not.toContain("lint");
    expect(checks).toEqual(expect.arrayContaining(["typecheck", "tests", "build", "preview_health", "accessibility"]));
    const asm = assembleTask(["m_a"], "angular-starter");
    expect(asm.expectedPaths).toEqual(["src/app/", "src/styles/app.css"]);
    expect(asm.acceptanceCriteria.map((c) => c.check)).toEqual(
      expect.arrayContaining([{ type: "file_not_contains", path: "src/app/app.html", text: "Start building here." }, { type: "verification", kind: "build" }]),
    );
    expect(fs.readFileSync(path.join(ng.dir, "src/app/app.html"), "utf8")).toContain("Start building here.");
  });

  it("fall back to building the request itself when there's no PRD, and never ask for lint the starter can't run", () => {
    const tasks = specFallbackTasks([], "angular-starter", "A reading list app with tags");
    expect(tasks.map((t) => t.title)).toEqual(["Build the requested features", "Designed states, responsiveness and accessibility"]);
    expect(tasks[0].objective).toContain("A reading list app with tags");
    expect(tasks.flatMap((t) => t.verification)).not.toContain("lint");
  });

  it("leave React builds as they were", () => {
    expect(starterOf(undefined).id).toBe("react-vite-scheduler");
    expect(starterOf("nope").id).toBe("react-vite-scheduler");
    expect(specRequiredChecks([])).toContain("app_wiring");
    expect(assembleTask([]).title).toMatch(/App\.tsx/);
    expect(specRuntimeTasks([])[1].acceptanceCriteria[0].check).toEqual({ type: "file_exists", path: "node_modules/react/package.json" });
  });
});
