/** Angular, Python and PostgreSQL: detection, the checks FlowCode adds, safe commands, errors, components, skills. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectPreflight, previewArgv, scriptArgv } from "../src/workspace/preflight.js";
import { classifyCommand } from "../src/commands/policy.js";
import { errorLines, errorSignatures, signature } from "../src/quality/verification.js";
import { findAngularComponents } from "../src/workspace/componentLibrary.js";
import { stackSkillIds, BUILTIN_SKILLS } from "../src/knowledge/skills.js";
import { PathJail } from "../src/security/pathJail.js";
import { tmpDir, write } from "./helpers.js";

const PY = process.platform === "win32" ? "python" : "python3";

function angularApp() {
  const root = tmpDir();
  write(root, "package.json", JSON.stringify({ name: "cal", version: "1.0.0", scripts: { ng: "ng", start: "ng serve", build: "ng build", test: "ng test", watch: "ng build --watch --configuration development" }, dependencies: { "@angular/core": "^19.0.0" }, devDependencies: { "@angular/cli": "^19.0.0", typescript: "~5.6.0" } }));
  write(root, "angular.json", "{}");
  write(root, "tsconfig.json", "{}");
  write(root, "tsconfig.app.json", "{}");
  fs.mkdirSync(path.join(root, "node_modules/typescript"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules/@angular/cli"), { recursive: true });
  return root;
}

describe("Angular projects", () => {
  it("are detected, get a type check, run tests once headless, and preview with ng serve", () => {
    const root = angularApp();
    const pf = detectPreflight("p", root);
    expect(pf.projectType).toBe("angular");
    expect(pf.previewStrategy).toBe("angular_dev");
    const by = (name: string) => pf.scripts.find((s) => s.name === name)!;
    expect(by("typecheck")).toMatchObject({ builtIn: true, policy: "auto", argv: ["npx", "tsc", "-p", "tsconfig.app.json", "--noEmit"] });
    expect(scriptArgv(pf, by("test"))).toEqual(["npx", "ng", "test", "--watch=false", "--browsers=ChromeHeadless"]);
    expect(by("build").policy).toBe("auto");
    expect(by("start").policy).toBe("auto");
    expect(scriptArgv(pf, by("build"))).toEqual(["npm", "run", "build"]);
    expect(previewArgv(pf, 4321)).toEqual(["npx", "ng", "serve", "--port", "4321", "--host", "127.0.0.1", "--open=false"]);
  });

  it("lets the Angular commands FlowCode runs through, and nothing broader", () => {
    const root = angularApp();
    const pf = detectPreflight("p", root);
    const jail = new PathJail(root);
    const tier = (...argv: string[]) => classifyCommand(argv, jail, pf).tier;
    expect(tier("npx", "ng", "test", "--watch=false", "--browsers=ChromeHeadless")).toBe("auto");
    expect(tier("npx", "ng", "serve", "--port", "4321", "--host", "127.0.0.1", "--open=false")).toBe("auto");
    expect(tier("npx", "tsc", "-p", "tsconfig.app.json", "--noEmit")).toBe("auto");
    expect(tier("npx", "ng", "serve", "--host", "0.0.0.0")).toBe("ask");
    expect(tier("npx", "ng", "add", "@angular/material")).toBe("ask");
    expect(tier("npx", "ng", "generate", "component", "x")).toBe("ask");
  });

  it("lists components with their selector, inputs and where their tag is used", () => {
    const card = [
      "import { Component, Input, input } from '@angular/core';",
      "/** One event in the month grid. */",
      "@Component({ selector: 'app-event-card', standalone: true, templateUrl: './event-card.component.html' })",
      "export class EventCardComponent {",
      "  @Input() title = '';",
      "  start = input.required<Date>();",
      "  private internal = 1;",
      "}",
    ].join("\n");
    const month = ["import { Component } from '@angular/core';", "@Component({ selector: 'app-month', template: `<app-event-card [title]=\"e.title\" [start]=\"e.start\" />` })", "export class MonthComponent {}"].join("\n");
    const list = findAngularComponents([
      { rel: "src/app/event-card/event-card.component.ts", text: card },
      { rel: "src/app/event-card/event-card.component.html", text: "<div>{{ title }}</div>" },
      { rel: "src/app/month/month.component.ts", text: month },
      { rel: "src/app/day/day.component.html", text: "<app-event-card [title]=\"x\" [start]=\"d\"></app-event-card>" },
    ]);
    const c = list.find((x) => x.name === "EventCardComponent")!;
    expect(c).toMatchObject({ selector: "app-event-card", summary: "One event in the month grid.", kind: "component" });
    expect(c.props).toEqual([
      { name: "title", optional: true, type: undefined },
      { name: "start", optional: false, type: "Date" },
    ]);
    expect(c.uses).toBe(2);
    expect(c.usedIn.sort()).toEqual(["src/app/day/day.component.html", "src/app/month/month.component.ts"]);
    expect(c.example).toMatch(/^<app-event-card/);
  });
});

describe("Python projects", () => {
  function pyApp(requirements: string) {
    const root = tmpDir();
    write(root, "requirements.txt", requirements);
    write(root, "app.py", "def add(a: int, b: int) -> int:\n    return a + b\n");
    write(root, "tests/test_app.py", "from app import add\n\ndef test_add():\n    assert add(1, 2) == 3\n");
    return root;
  }

  it("get pytest, ruff and mypy when the project uses them, run directly through Python", () => {
    const pf = detectPreflight("p", pyApp("flask==3.0\npytest>=8\nruff\nmypy\n"));
    expect(pf.projectType).toBe("python");
    const checks = Object.fromEntries(pf.scripts.map((s) => [s.classification, s.argv]));
    expect(checks.test).toEqual([PY, "-m", "pytest", "-q"]);
    expect(checks.lint).toEqual([PY, "-m", "ruff", "check", "."]);
    expect(checks.typecheck).toEqual([PY, "-m", "mypy", "."]);
    expect(pf.scripts.every((s) => s.builtIn && s.policy === "auto")).toBe(true);
  });

  it("falls back to flake8, still runs tests when only a tests folder exists, and adds nothing it can't run", () => {
    const pf = detectPreflight("p", pyApp("flake8\n"));
    expect(pf.scripts.map((s) => s.name).sort()).toEqual(["flake8", "pytest"]);
    const bare = tmpDir();
    write(bare, "requirements.txt", "requests\n");
    expect(detectPreflight("p", bare).scripts).toEqual([]);
  });

  it("runs Python checks without asking, but not ruff --fix or arbitrary Python", () => {
    const root = pyApp("pytest\n");
    const pf = detectPreflight("p", root);
    const jail = new PathJail(root);
    const tier = (...argv: string[]) => classifyCommand(argv, jail, pf).tier;
    expect(tier(PY, "-m", "pytest", "-q")).toBe("auto");
    expect(tier(PY, "-m", "flake8")).toBe("auto");
    expect(tier(PY, "-m", "py_compile", "app.py")).toBe("auto");
    expect(tier(PY, "-m", "ruff", "check", ".", "--fix")).toBe("ask");
    expect(tier(PY, "app.py")).toBe("ask");
  });

  it("reads errors from ruff, mypy, pytest and the compiler, ignoring line numbers when comparing", () => {
    const out = [
      "app.py:1:8: F401 [*] `os` imported but unused",
      "app.py:12: error: Incompatible return value type (got \"str\", expected \"int\")  [return-value]",
      "Found 1 error in 1 file (checked 2 source files)",
      "FAILED tests/test_app.py::test_add - assert 4 == 3",
      "SyntaxError: invalid syntax",
      "1 failed, 3 passed in 0.12s",
    ].join("\n");
    expect(errorLines(out)).toEqual([
      "app.py:1:8: F401 [*] `os` imported but unused",
      "app.py:12: error: Incompatible return value type (got \"str\", expected \"int\")  [return-value]",
      "FAILED tests/test_app.py::test_add - assert 4 == 3",
      "SyntaxError: invalid syntax",
    ]);
    expect(signature("app.py:14: error: Incompatible return value type")).toBe(signature("app.py:12: error: Incompatible return value type"));
    expect(errorSignatures("app.py:3:1: E302 expected 2 blank lines")).toEqual(errorSignatures("app.py:9:1: E302 expected 2 blank lines"));
  });
});

describe("PostgreSQL projects", () => {
  it("are recognised from Node and Python drivers, Prisma, and Docker Compose", () => {
    const node = tmpDir();
    write(node, "package.json", JSON.stringify({ name: "a", version: "1.0.0", dependencies: { pg: "^8.11.0" } }));
    expect(detectPreflight("p", node).detectedTypes).toContain("postgres");
    const prisma = tmpDir();
    write(prisma, "package.json", JSON.stringify({ name: "a", version: "1.0.0" }));
    write(prisma, "prisma/schema.prisma", 'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\n');
    expect(detectPreflight("p", prisma).detectedTypes).toContain("postgres");
    const compose = tmpDir();
    write(compose, "docker-compose.yml", "services:\n  db:\n    image: postgres:16\n");
    expect(detectPreflight("p", compose).detectedTypes).toContain("postgres");
    const sqlite = tmpDir();
    write(sqlite, "package.json", JSON.stringify({ name: "a", version: "1.0.0", dependencies: { "better-sqlite3": "^9.0.0" } }));
    expect(detectPreflight("p", sqlite).detectedTypes).not.toContain("postgres");
  });

  it("checks SQL files against the Postgres dialect when the project uses sqlfluff", () => {
    const root = tmpDir();
    write(root, "requirements.txt", "psycopg[binary]\nsqlfluff\n");
    write(root, "migrations/001_init.sql", "create table events (id bigint primary key);\n");
    const pf = detectPreflight("p", root);
    expect(pf.detectedTypes).toEqual(expect.arrayContaining(["python", "postgres"]));
    expect(pf.scripts.find((s) => s.name === "sqlfluff")?.argv).toEqual([PY, "-m", "sqlfluff", "lint", "--dialect", "postgres", "migrations"]);
    expect(classifyCommand([PY, "-m", "sqlfluff", "lint", "--dialect", "postgres", "migrations"], new PathJail(root), pf).tier).toBe("auto");
    expect(classifyCommand([PY, "-m", "sqlfluff", "fix", "migrations"], new PathJail(root), pf).tier).toBe("ask");
    expect(errorLines("L:   3 | P:   1 | LT01 | Expected only single space before 'primary'.")).toHaveLength(1);
  });
});

describe("stack skills", () => {
  it("come with the project's stack, whatever the task says", () => {
    expect(stackSkillIds(["angular", "node_package"])).toEqual(["skill.angular"]);
    expect(stackSkillIds(["python", "postgres"])).toEqual(["skill.python", "skill.postgres"]);
    // React apps get the inspect-first TypeScript rules on every step.
    expect(stackSkillIds(["vite", "react"])).toEqual(["skill.fix-typescript-error"]);
    expect(BUILTIN_SKILLS.find((x) => x.id === "skill.fix-typescript-error")!.instructions).toContain("useState<CalendarEvent[]>([])");
    for (const id of ["skill.angular", "skill.python", "skill.postgres"]) {
      const s = BUILTIN_SKILLS.find((x) => x.id === id)!;
      expect(s.enabled).toBe(true);
      expect(s.instructions).not.toMatch(/\b(ensure|enable|foster|comprehensive)\b|—/i);
    }
  });
});
