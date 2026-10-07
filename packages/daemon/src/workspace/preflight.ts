/**
 * Project preflight (FR-W1, FR-W4). Detects project type, validates the manifest, classifies scripts
 * by inspecting their command content (§17.1 "malicious package script"), and records which checks
 * may run. Nothing runs before this record exists.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { PackageManager, PreflightRecord, PreviewStrategy, ProjectType, ScriptClass, ScriptRecord } from "@flowcode/contracts";
import { validatePackageManifest } from "./protectedFiles.js";
import { newId, nowIso } from "../util/ids.js";

const NAME_CLASS: Array<[RegExp, ScriptClass]> = [
  [/^(typecheck|type-check|tsc|check-types|types)$/, "typecheck"],
  [/^(lint|eslint|lint:.*)$/, "lint"],
  [/^(test|tests|test:unit|vitest|jest|test:ci)$/, "test"],
  [/^(build|build:.*)$/, "build"],
  [/^(dev|develop|serve)$/, "dev"],
  [/^start$/, "start"],
  [/^preview$/, "preview"],
  [/^(format|fmt|prettier)$/, "format"],
  [/^(pre|post)?(install|prepare|prepublish|prepublishOnly|prepack|postpack)$/, "install_hook"],
];

/** Command bodies considered verified-safe for each class (exact tool + benign flags). */
const SAFE_BODIES: Partial<Record<ScriptClass, RegExp>> = {
  typecheck: /^(tsc|vue-tsc)(\s+(-b|--build|--noEmit|-p\s+[\w./-]+|--project\s+[\w./-]+|--pretty(\s+false)?|--incremental))*\s*$/,
  lint: /^(ng lint|eslint|next lint|biome (check|lint)|oxlint|stylelint)(\s+("[^"]*"|'[^']*'|[\w./*{},:=@-]+))*\s*$/,
  test: /^(ng test(\s+(--watch=false|--no-watch|--browsers[= ]ChromeHeadless|--code-coverage))*|vitest(\s+run)?|jest|node --test|mocha|playwright test|ava)(\s+(--run|--reporter[= ][\w-]+|--passWithNoTests|--ci|--coverage|--silent|-u|[\w./*-]+))*\s*$/,
  build: /^((tsc(\s+(-b|--build|--noEmit|-p\s+[\w./-]+))*\s*&&\s*)?(ng build(\s+(--configuration[= ][\w-]+|-c\s+[\w-]+))*|vite build|next build|tsc(\s+(-b|--build|-p\s+[\w./-]+))*|astro build|react-scripts build|webpack(\s+--mode[= ]production)?|rollup -c|tsup(\s+[\w./-]+)*))\s*$/,
  dev: /^(ng serve(\s+(--port\s+\d+|--host\s+127\.0\.0\.1|--open=false))*|vite(\s+(dev|--host|--port\s+\d+|--strictPort))*|next dev(\s+(-p\s+\d+|--turbo(pack)?))*|astro dev|react-scripts start)\s*$/,
  start: /^(ng serve(\s+(--port\s+\d+|--host\s+127\.0\.0\.1|--open=false))*|vite(\s+--port\s+\d+)?|next start|react-scripts start)\s*$/,
  preview: /^(vite preview(\s+(--port\s+\d+|--strictPort))*|next start)\s*$/,
  format: /^prettier\s+(--check|-c)\b.*$/,
};

const DANGEROUS: Array<[RegExp, string, "ask" | "never"]> = [
  [/\b(sudo|su|doas|runas)\b/, "privilege escalation", "never"],
  [/\bgit\s+push\b/, "git push", "never"],
  [/\b(curl|wget|Invoke-WebRequest|iwr|nc|ncat|scp|ssh|ftp)\b/i, "network access", "ask"],
  [/\brm\s+-[a-z]*r[a-z]*f|\brmdir\s+\/s|\bdel\s+\/[sq]|Remove-Item.*-Recurse/i, "broad delete", "ask"],
  [/(^|[^&])&&|\|\||;|\|(?!\|)|`|\$\(|>\s*\S/, "shell chaining or redirection", "ask"],
  [/\b(npm|pnpm|yarn|bun)\s+(i|install|add|update|upgrade|remove|publish)\b|\bpip\s+install\b/, "package install/publish", "ask"],
  [/\b(prisma\s+migrate|knex\s+migrate|sequelize\s+db:migrate|alembic\s+upgrade|drizzle-kit\s+push)\b/, "database migration", "ask"],
  [/\b(vercel|netlify|firebase|wrangler|fly|heroku|aws|gcloud|az)\b\s+(deploy|publish|up)/, "deployment", "never"],
  [/\b(chmod|chown|reg\s+add|setx|launchctl|systemctl|schtasks)\b/i, "system change", "never"],
  [/\bnode\s+-e\b|\beval\b|\bpython\s+-c\b/, "inline code execution", "ask"],
  [/\.\.[\\/]/, "parent-directory reference", "ask"],
];

export function classifyScript(name: string, command: string): ScriptRecord {
  const reasons: string[] = [];
  let classification: ScriptClass = "unknown";
  for (const [re, cls] of NAME_CLASS) if (re.test(name)) classification = cls;
  const body = command.trim();
  let policy: "auto" | "ask" | "never" = "ask";
  for (const [re, label, tier] of DANGEROUS) {
    // "&&" between known-safe build steps is allowed by SAFE_BODIES.build; check it after.
    if (re.test(body)) {
      reasons.push(`contains ${label}`);
      if (tier === "never") policy = "never";
    }
  }
  const safe = SAFE_BODIES[classification];
  if (policy !== "never") {
    if (safe && safe.test(body)) {
      const onlyChaining = reasons.every((r) => r === "contains shell chaining or redirection");
      if (reasons.length === 0 || (classification === "build" && onlyChaining && /^tsc[^|;`$>]*&&\s*(vite|next) build\s*$/.test(body))) {
        policy = "auto";
        reasons.length = 0;
        reasons.push(`verified safe ${classification} command`);
      }
    } else if (classification === "install_hook") {
      reasons.push("lifecycle hook runs during installs");
    } else if (classification === "unknown") {
      reasons.push("unrecognized script");
    } else {
      reasons.push(`command body not in verified-safe list for ${classification}`);
    }
  }
  return { name, command, classification, policy, reasons };
}

const PY = process.platform === "win32" ? "python" : "python3";

/**
 * Checks FlowCode adds when the project doesn't have a script for them, so Angular and Python projects get the same
 * type check, lint and tests as a React one:
 * - any TypeScript project without a type-check script: the TypeScript compiler on its app tsconfig (Angular apps
 *   don't ship one; `ng build` was the only thing that caught type errors);
 * - Angular's `ng test`: run once, headless (by default it watches and opens a browser, so it never finishes);
 * - Python: pytest, ruff or flake8, and mypy, when the project uses them (declared in its requirements or config).
 *   They run as `python -m <tool>`, so a tool that isn't installed reports that instead of failing obscurely.
 */
export function builtInChecks(root: string, scripts: ScriptRecord[], p: { angular: boolean; python: boolean; postgres?: boolean; hasNodeModules: boolean }): ScriptRecord[] {
  const exists = (rel: string) => fs.existsSync(path.join(root, rel));
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      return "";
    }
  };
  const has = (c: ScriptClass) => scripts.some((s) => s.classification === c);
  const out: ScriptRecord[] = [];
  const add = (name: string, classification: ScriptClass, argv: string[], why: string) => out.push({ name, command: argv.join(" "), classification, policy: "auto", reasons: [`added by FlowCode: ${why}`], argv, builtIn: true });

  if (!has("typecheck") && p.hasNodeModules && exists("node_modules/typescript")) {
    const tsconfig = ["tsconfig.app.json", "tsconfig.json"].find(exists);
    if (tsconfig) add("typecheck", "typecheck", ["npx", "tsc", "-p", tsconfig, "--noEmit"], "the project has no type-check script");
  }
  if (p.angular) {
    const test = scripts.find((s) => s.classification === "test");
    if (test && /^ng test\s*$/.test(test.command.trim())) {
      test.argv = ["npx", "ng", "test", "--watch=false", "--browsers=ChromeHeadless"];
      test.policy = "auto";
      test.reasons = ["Angular tests run once, headless (ng test would otherwise watch and never finish)"];
    }
  }
  if (p.python) {
    const declared = ["requirements.txt", "requirements-dev.txt", "dev-requirements.txt", "pyproject.toml", "setup.cfg", "Pipfile", "tox.ini"].map(read).join("\n").toLowerCase();
    const uses = (tool: string, ...configs: string[]) => new RegExp(`(^|[\\s"'\\[,])${tool}\\b`, "m").test(declared) || configs.some(exists);
    const testsExist = exists("tests") || exists("test") || fs.readdirSync(root).some((f) => /^test_.*\.py$|_test\.py$/.test(f));
    if (!has("test") && (uses("pytest", "pytest.ini", "conftest.py") || testsExist)) add("pytest", "test", [PY, "-m", "pytest", "-q"], "the project's Python tests");
    if (!has("lint")) {
      if (uses("ruff", "ruff.toml", ".ruff.toml")) add("ruff", "lint", [PY, "-m", "ruff", "check", "."], "the project uses ruff");
      else if (uses("flake8", ".flake8")) add("flake8", "lint", [PY, "-m", "flake8"], "the project uses flake8");
    }
    if (!has("typecheck") && uses("mypy", "mypy.ini", ".mypy.ini")) add("mypy", "typecheck", [PY, "-m", "mypy", "."], "the project uses mypy");
    // Postgres SQL files (migrations, queries) checked against the Postgres dialect, when the project uses sqlfluff.
    if (p.postgres && uses("sqlfluff", ".sqlfluff")) {
      const dir = SQL_DIRS.find(exists) ?? ".";
      add("sqlfluff", "lint", [PY, "-m", "sqlfluff", "lint", "--dialect", "postgres", dir], "Postgres SQL files, checked with sqlfluff");
    }
  }
  return out;
}

const SQL_DIRS = ["migrations", "db/migrations", "database/migrations", "supabase/migrations", "prisma/migrations", "sql", "db"];

/** PostgreSQL in use: a Node or Python driver or ORM pointed at Postgres, or a Postgres service in Docker Compose. */
export function usesPostgres(root: string, deps: Record<string, string>): boolean {
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      return "";
    }
  };
  if (["pg", "postgres", "pg-promise", "slonik", "@neondatabase/serverless", "@vercel/postgres", "postgres-migrations"].some((d) => deps[d])) return true;
  if (/provider\s*=\s*"postgres(ql)?"/.test(read("prisma/schema.prisma"))) return true;
  if (/dialect:\s*["']postgresql["']|driver:\s*["']pg["']/.test(read("drizzle.config.ts") + read("drizzle.config.js"))) return true;
  if (/client:\s*["'](pg|postgres|postgresql)["']/.test(read("knexfile.js") + read("knexfile.ts"))) return true;
  const py = ["requirements.txt", "pyproject.toml", "Pipfile", "setup.cfg"].map(read).join("\n").toLowerCase();
  if (/(^|[\s"'[,])(psycopg2?(-binary)?|psycopg\[|asyncpg|pg8000)\b/m.test(py)) return true;
  return /image:\s*["']?postgres(:|\s|$|["'])/m.test(read("docker-compose.yml") + read("docker-compose.yaml") + read("compose.yaml") + read("compose.yml"));
}

/** The command that runs a script: its own argv when FlowCode set one, otherwise `<package manager> run <name>`. */
export function scriptArgv(pf: Pick<PreflightRecord, "packageManager">, script: ScriptRecord): string[] {
  if (script.argv?.length) return script.argv;
  const pm = pf.packageManager === "pnpm" || pf.packageManager === "yarn" || pf.packageManager === "bun" ? pf.packageManager : "npm";
  return [pm, "run", script.name];
}

/** The command that serves the app for the live preview and browser checks, on `port` and 127.0.0.1 only. */
export function previewArgv(pf: Pick<PreflightRecord, "previewStrategy" | "scripts" | "packageManager">, port: number): string[] {
  if (pf.previewStrategy === "vite_dev") return ["npx", "vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"];
  if (pf.previewStrategy === "angular_dev") return ["npx", "ng", "serve", "--port", String(port), "--host", "127.0.0.1", "--open=false"];
  const dev = pf.scripts.find((s) => s.classification === "dev" && !s.builtIn) ?? pf.scripts.find((s) => s.classification === "start" && !s.builtIn);
  return scriptArgv(pf, dev ?? { name: "dev", command: "", classification: "dev", policy: "ask", reasons: [] });
}

/** Checks that run through Python don't need node_modules or a valid package.json. */
export const runsWithoutNode = (script: ScriptRecord) => !!script.argv && /^python3?$|^py$/.test(script.argv[0]);

export function detectPreflight(projectId: string, root: string): PreflightRecord {
  const exists = (p: string) => fs.existsSync(path.join(root, p));
  const detected = new Set<ProjectType>();
  const manifestErrors: string[] = [];
  const missing: string[] = [];
  let pkg: Record<string, unknown> | undefined;
  let manifestValid = false;

  if (exists("package.json")) {
    const content = fs.readFileSync(path.join(root, "package.json"), "utf8");
    const errs = validatePackageManifest(content);
    manifestErrors.push(...errs);
    manifestValid = errs.length === 0;
    if (manifestValid) pkg = JSON.parse(content) as Record<string, unknown>;
    detected.add("node_package");
  }
  const deps = { ...((pkg?.dependencies as Record<string, string>) ?? {}), ...((pkg?.devDependencies as Record<string, string>) ?? {}) };
  if (pkg?.workspaces || exists("pnpm-workspace.yaml") || exists("lerna.json") || exists("turbo.json") || exists("nx.json")) detected.add("monorepo");
  if (deps.vite || exists("vite.config.ts") || exists("vite.config.js")) detected.add("vite");
  if (deps.react) detected.add("react");
  if (deps.next || exists("next.config.js") || exists("next.config.mjs") || exists("next.config.ts")) detected.add("nextjs");
  if (deps.electron) detected.add("electron");
  if (exists("src-tauri/tauri.conf.json") || deps["@tauri-apps/api"]) detected.add("tauri");
  if (deps["@angular/core"] || exists("angular.json")) detected.add("angular");
  if (exists("pyproject.toml") || exists("requirements.txt") || exists("setup.py") || exists("Pipfile")) detected.add("python");
  if (usesPostgres(root, deps)) detected.add("postgres");
  if (!pkg && !detected.has("python") && fs.readdirSync(root).some((f) => /\.html?$/i.test(f))) detected.add("static_html");

  let projectType: ProjectType;
  const order: ProjectType[] = ["monorepo", "tauri", "electron", "nextjs", "angular", "vite", "react", "python", "node_package", "static_html"];
  projectType = order.find((t) => detected.has(t)) ?? "unknown";
  if (exists("package.json") && !manifestValid) projectType = "incomplete";
  if (projectType === "unknown" && fs.readdirSync(root).length === 0) projectType = "incomplete";

  let packageManager: PackageManager = "none";
  if (exists("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (exists("yarn.lock")) packageManager = "yarn";
  else if (exists("bun.lockb") || exists("bun.lock")) packageManager = "bun";
  else if (pkg) packageManager = "npm";
  else if (detected.has("python")) packageManager = "pip";

  const scripts = Object.entries((pkg?.scripts as Record<string, string>) ?? {}).map(([n, c]) => classifyScript(n, c));
  const hasNodeModules = exists("node_modules");
  scripts.push(...builtInChecks(root, scripts, { angular: detected.has("angular"), python: detected.has("python"), postgres: detected.has("postgres"), hasNodeModules }));
  const byClass = (c: ScriptClass) => scripts.find((s) => s.classification === c);

  let previewStrategy: PreviewStrategy = "none";
  if (detected.has("nextjs") && byClass("dev")) previewStrategy = "next_dev";
  else if (detected.has("angular") && (deps["@angular/cli"] || exists("node_modules/@angular/cli"))) previewStrategy = "angular_dev";
  else if (detected.has("vite") && byClass("dev")) previewStrategy = "vite_dev";
  else if (byClass("start") && pkg) previewStrategy = "npm_start";
  else if (detected.has("static_html")) previewStrategy = "static_server";

  if (pkg && !hasNodeModules && Object.keys(deps).length > 0) missing.push("dependencies not installed (install requires approval)");
  if (exists("package.json") && !manifestValid) missing.push("package.json is invalid; Node package-manager commands are blocked");
  if (packageManager !== "none" && packageManager !== "npm" && packageManager !== "pip" && !commandExists(packageManager)) missing.push(`${packageManager} is not installed`);
  if (detected.has("python") && !commandExists(process.platform === "win32" ? "python" : "python3")) missing.push("python is not installed");

  const allowedChecks = scripts.filter((s) => s.policy === "auto" && ["typecheck", "lint", "test", "build"].includes(s.classification)).map((s) => s.name);

  return {
    id: newId("pf"),
    projectId,
    projectType,
    detectedTypes: [...detected],
    manifestValid,
    manifestErrors,
    packageManager,
    scripts,
    previewStrategy,
    allowedChecks,
    missingPrerequisites: missing,
    hasNodeModules,
    gitAvailable: exists(".git") && commandExists("git"),
    createdAt: nowIso(),
  };
}

const commandCache = new Map<string, boolean>();
export function commandExists(cmd: string): boolean {
  if (commandCache.has(cmd)) return commandCache.get(cmd)!;
  let ok = false;
  try {
    execFileSync(process.platform === "win32" ? "where.exe" : "which", [cmd], { stdio: "ignore", shell: false, timeout: 5000 });
    ok = true;
  } catch {
    ok = false;
  }
  commandCache.set(cmd, ok);
  return ok;
}
