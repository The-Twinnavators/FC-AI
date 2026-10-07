/**
 * Command policy engine (FR-C1). Classifies an argv into auto / ask / never with reasons.
 * Commands are always spawned with shell:false and a workspace-locked cwd; this module decides
 * whether they may run at all.
 */
import path from "node:path";
import type { PolicyTier, PreflightRecord } from "@flowcode/contracts";
import { isWithin, type PathJail } from "../security/pathJail.js";

export interface PolicyDecision {
  tier: PolicyTier;
  reasons: string[];
  /** Key used for persistent project-level approvals ("allow for project"). Undefined when not persistable. */
  persistKey?: string;
  category: "read_only" | "verified_script" | "install" | "network" | "migration" | "unknown_script" | "delete" | "unknown_program" | "forbidden";
}

const SHELLS = /^(cmd|cmd\.exe|powershell|powershell\.exe|pwsh|pwsh\.exe|bash|bash\.exe|sh|zsh|fish|wsl|wsl\.exe)$/i;
const SYSTEM = /^(sudo|su|doas|runas|reg|regedit|format|diskpart|shutdown|reboot|chmod|chown|chgrp|icacls|takeown|setx|netsh|sc|schtasks|launchctl|systemctl|bcdedit|mkfs|mount|umount|kill|taskkill|net)(\.exe)?$/i;
const NETWORK_PROGRAMS = /^(curl|wget|nc|ncat|ssh|scp|sftp|ftp|telnet|rsync)(\.exe)?$/i;
const READ_ONLY_GIT = new Set(["status", "diff", "log", "show", "branch", "rev-parse", "ls-files", "blame", "remote"]);
const SHELL_META = /[;&|`$<>]|\r|\n/;

export function classifyCommand(argv: string[], jail: PathJail, preflight?: PreflightRecord): PolicyDecision {
  if (argv.length === 0) return { tier: "never", reasons: ["empty argv"], category: "forbidden" };
  // The program must be a bare name resolved from PATH (or a local package bin); a path could point at a
  // planted binary named like a trusted tool.
  if (/[\\/]/.test(argv[0]) || /^[a-zA-Z]:/.test(argv[0])) return { tier: "never", reasons: ["program must be a bare command name, not a path"], category: "forbidden" };
  const prog = path.basename(argv[0]).toLowerCase();
  const fullKey = argv.join("\u0001");
  const args = argv.slice(1);
  const reasons: string[] = [];

  // ── Never ──────────────────────────────────────────────
  if (SHELLS.test(prog)) return never("arbitrary shell execution is not allowed; pass a program and argv");
  if (SYSTEM.test(prog)) return never(`system-level command "${prog}" is not allowed`);
  if (argv.some((a) => a.includes("\0"))) return never("NUL byte in argument");
  for (const a of args) {
    const outside = referencesOutsideWorkspace(a, jail);
    if (outside) return never(`argument references a path outside the workspace: ${outside}`);
    if (looksLikeSecretPath(a, jail)) return never(`argument references a secret file: ${a}`);
  }
  if (args.some((a) => /^--no-verify$|^--no-gpg-sign$|^--ignore-scripts=false$/.test(a))) return never("disabling checks/hooks is not allowed");
  if (prog === "git") {
    // Global options before the subcommand can redirect the repository or inject config (core.fsmonitor,
    // core.sshCommand, --git-dir to a planted directory). Never allowed.
    const subIdx = args.findIndex((a) => !a.startsWith("-"));
    if (subIdx !== 0) return never("git global options (-c, -C, --git-dir, --work-tree, --exec-path, …) are not allowed");
    const sub = args[0];
    const rest = args.slice(1);
    if (sub === "push") return never("git push is disabled by default");
    if (sub === "config") return rest.length === 1 || rest[0] === "--get" || rest[0] === "--list" ? ask("unknown_program", "git config read") : never("git config changes are not allowed");
    if (rest.some((a) => /^--(output|exec|upload-pack|receive-pack|ext-diff|textconv)/.test(a) || a.includes(":"))) return ask("unknown_program", `git ${sub} with output/exec options or rev:path arguments`, `git:${fullKey}`);
    const autoOk =
      (sub === "status" && rest.every((a) => /^(--porcelain(=v[12])?|-b|--branch|-s|--short|--untracked-files(=\w+)?)$/.test(a))) ||
      (sub === "diff" && rest.every((a) => /^(--stat|--name-only|--name-status|--cached|--staged|--no-color|--)$/.test(a))) ||
      (sub === "log" && rest.every((a) => /^(--oneline|--stat|--no-color|-n|-\d+|\d+|--max-count=\d+)$/.test(a))) ||
      (sub === "branch" && rest.every((a) => /^(-a|-v|-vv|--list|--show-current)$/.test(a))) ||
      (sub === "remote" && rest.every((a) => /^(-v)$/.test(a))) ||
      (sub === "rev-parse" && rest.every((a) => /^(HEAD|--abbrev-ref|--short|--show-toplevel|--is-inside-work-tree)$/.test(a))) ||
      (sub === "ls-files" && rest.every((a) => /^(-m|-o|--modified|--others|--exclude-standard|--cached)$/.test(a)));
    if (autoOk) return { tier: "auto", reasons: [`read-only git ${sub}`], category: "read_only" };
    if (sub === "clone" || sub === "fetch" || sub === "pull") return ask("network", `git ${sub} accesses the network`, `git:${fullKey}`);
    return ask("unknown_program", `git ${sub} ${READ_ONLY_GIT.has(sub) ? "with non-allowlisted arguments" : "modifies repository state"}`, `git:${fullKey}`);
  }
  if (/^(npm|pnpm|yarn|bun)(\.cmd)?$/.test(prog)) {
    const pm = prog.replace(/\.cmd$/, "");
    const sub = args[0];
    if (sub === "publish" || sub === "unpublish" || sub === "deprecate" || sub === "owner" || sub === "token" || sub === "login" || sub === "adduser")
      return never(`${pm} ${sub} is not allowed`);
    // Flags that redirect which package/config is used would let a "verified" script name run something else.
    const REDIRECT = /^(--prefix|-C|--cwd|--dir|-w|--workspace|--workspaces|--script-shell|--userconfig|--globalconfig|--registry|--filter|-F|--node-options|--call|-c)(=|$)/;
    if (args.some((a) => REDIRECT.test(a))) return never("package-manager flags that redirect the package, config, registry or shell are not allowed");
    if (preflight && !preflight.manifestValid) return never("package-manager commands are blocked: no valid recognized manifest (run preflight / repair package.json)");
    if (!preflight) return never("package-manager commands require a completed project preflight");
    if (["install", "i", "ci", "add", "update", "upgrade", "up", "remove", "rm", "uninstall", "dedupe", "audit"].includes(sub ?? "") || (pm === "yarn" && args.length === 0)) {
      return ask("install", `${pm} ${sub ?? "install"} installs or changes dependencies (runs lifecycle scripts, uses network)`, `${pm}:${fullKey}`);
    }
    if (sub === "run" || sub === "test" || sub === "start" || (pm !== "npm" && sub && preflight.scripts.some((s) => s.name === sub))) {
      const scriptName = sub === "run" ? args[1] : sub === "test" ? "test" : sub === "start" ? "start" : sub!;
      const script = preflight.scripts.find((s) => s.name === scriptName);
      if (!script) return never(`script "${scriptName}" is not present in package.json`);
      if (script.policy === "never") return never(`script "${scriptName}" is forbidden: ${script.reasons.join(", ")}`);
      const exact = sub === "run" ? args.length === 2 : args.length === 1;
      // The verified test script run on one of the project's test files (a step's acceptance tests): `npm run test --
      // src/acceptance/engine.test.ts`. Only a plain relative path to a *.test.ts(x) file under src/ is allowed.
      const extra = args.slice(sub === "run" ? 2 : 1);
      const oneTestFile = script.classification === "test" && extra.length === 2 && extra[0] === "--" && (/^src\/(?!.*\.\.)[\w./-]+\.test\.tsx?$/.test(extra[1]) || /^src\/(?!.*\.\.)[\w/-]+\/$/.test(extra[1]));
      if (script.policy === "auto" && oneTestFile) return { tier: "auto", reasons: [`verified ${script.classification} script on one test file`, ...script.reasons], category: "verified_script" };
      if (script.policy === "auto" && exact) return { tier: "auto", reasons: [`verified ${script.classification} script`, ...script.reasons], category: "verified_script" };
      return ask("unknown_script", `script "${scriptName}" (${script.command})${exact ? "" : " with extra arguments"} needs approval: ${script.reasons.join(", ")}`, `script:${fullKey}:${script.command}`);
    }
    if (["ls", "list", "outdated", "why", "explain"].includes(sub ?? "") && args.slice(1).every((a) => /^[@\w./-]+$/.test(a) && !a.startsWith("--"))) {
      return { tier: "auto", reasons: [`read-only ${pm} ${sub}`], category: "read_only" };
    }
    if (["-v", "--version", "version"].includes(sub ?? "") && args.length === 1) return { tier: "auto", reasons: ["version query"], category: "read_only" };
    if (sub === "exec" || sub === "x" || sub === "dlx" || sub === "view") return ask("network", `${pm} ${sub} uses the network or executes packages`, `${pm}:${fullKey}`);
    return ask("unknown_program", `${pm} ${sub ?? ""} is not a recognized safe operation`, `${pm}:${fullKey}`);
  }
  if (prog === "npx" || prog === "npx.cmd") {
    // Only `npx <local-tool> <allowlisted args>` is auto; any npx flag (e.g. --package) asks.
    const tool = args[0];
    if (tool && !tool.startsWith("-") && /^(tsc|eslint|vitest|prettier|vite|ng)$/.test(tool) && preflight?.hasNodeModules) {
      const rest = args.slice(1);
      const pathArg = /^(?!-)(?!.*\.\.)[\w./*-]+$/;
      // Angular CLI: one headless test run, a build, lint, or a dev server bound to 127.0.0.1.
      if (tool === "ng") {
        const [cmd, ...flags] = rest;
        if (cmd === "test" && flags.every((a) => /^(--watch=false|--no-watch|--browsers=ChromeHeadless|--code-coverage)$/.test(a))) return { tier: "auto", reasons: ["Angular tests, run once headless"], category: "verified_script" };
        if (cmd === "build" && flags.every((a) => /^(--configuration=[\w-]+)$/.test(a))) return { tier: "auto", reasons: ["Angular build"], category: "verified_script" };
        if (cmd === "lint" && flags.length === 0) return { tier: "auto", reasons: ["Angular lint"], category: "read_only" };
        if (cmd === "serve" && flags.join(" ").includes("--host 127.0.0.1") && flags.every((a, i) => /^(--port|\d{2,5}|--host|--open=false)$/.test(a) || (a === "127.0.0.1" && flags[i - 1] === "--host")))
          return { tier: "auto", reasons: ["Angular dev server bound to 127.0.0.1"], category: "verified_script" };
      }
      if (tool === "tsc" && rest.every((a) => /^(--noEmit|-b|--build|-p|--project|--pretty|false|[\w./-]+\.json)$/.test(a))) return { tier: "auto", reasons: ["local typecheck"], category: "read_only" };
      if (tool === "vitest" && rest.every((a) => /^(run|--run|--reporter=\w+)$/.test(a) || pathArg.test(a))) return { tier: "auto", reasons: ["local tests"], category: "verified_script" };
      if (tool === "prettier" && rest.includes("--check") && rest.every((a) => a === "--check" || pathArg.test(a))) return { tier: "auto", reasons: ["format check"], category: "read_only" };
      if (tool === "eslint" && rest.every((a) => /^(--max-warnings=?\d*|\d+|--no-color)$/.test(a) || pathArg.test(a))) return { tier: "auto", reasons: ["lint check"], category: "read_only" };
      if (tool === "vite" && /--host/.test(rest.join(" ")) === rest.join(" ").includes("--host 127.0.0.1") && rest.every((a, i) => /^(dev|preview|--port|\d{2,5}|--strictPort|--host)$/.test(a) || (a === "127.0.0.1" && rest[i - 1] === "--host")))
        return { tier: "auto", reasons: ["verified local dev/preview server bound to 127.0.0.1"], category: "verified_script" };
    }
    return ask("network", "npx with these arguments may download or execute packages", `npx:${fullKey}`);
  }
  if (NETWORK_PROGRAMS.test(prog)) return ask("network", `${prog} accesses the network`, undefined);
  if (/^(pip|pip3|uv|poetry|pipenv)(\.exe)?$/.test(prog)) {
    if (["install", "add", "sync", "update", "lock", "uninstall", "remove"].includes(args[0] ?? "")) return ask("install", `${prog} ${args[0]} changes Python dependencies`, `${prog}:${fullKey}`);
    if (["list", "show", "freeze", "--version"].includes(args[0] ?? "")) return { tier: "auto", reasons: ["read-only python package query"], category: "read_only" };
    return ask("unknown_program", `${prog} ${args[0] ?? ""} is not recognized`);
  }
  if (/^(rm|rmdir|del|erase|rd)(\.exe)?$/.test(prog)) {
    const broad = args.some((a) => /^-[a-z]*r/i.test(a) || /^\/s$/i.test(a) || a === "." || a === "*" || a.includes("*"));
    return ask("delete", broad ? "broad/recursive delete" : "file deletion outside governed tools", undefined);
  }
  if (/^(prisma|knex|sequelize|alembic|drizzle-kit)$/.test(prog)) return ask("migration", `${prog} may run database migrations`);
  if (/^(node|node\.exe)$/.test(prog)) {
    if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) return { tier: "auto", reasons: ["version query"], category: "read_only" };
    if (args.some((a) => a === "-e" || a === "--eval" || a === "-p" || a === "--print")) return ask("unknown_program", "inline code evaluation");
    return ask("unknown_program", "running a node script requires approval", `node:${fullKey}`);
  }
  if (/^(python|python3|py)(\.exe)?$/.test(prog)) {
    if (args.length === 1 && args[0] === "--version") return { tier: "auto", reasons: ["version query"], category: "read_only" };
    if (args[0] === "-m" && /^(pytest|mypy|ruff|flake8|py_compile|sqlfluff)$/.test(args[1] ?? "") && !(args[1] === "ruff" && args.includes("--fix")) && !(args[1] === "sqlfluff" && args[2] === "fix"))
      return { tier: "auto", reasons: [`python ${args[1]} check`], category: "verified_script" };
    return ask("unknown_program", "running python requires approval");
  }
  if (args.some((a) => SHELL_META.test(a)) && /^(echo|cat|type)$/.test(prog)) reasons.push("shell metacharacters are passed literally (no shell)");
  return ask("unknown_program", `unrecognized program "${prog}"`, `prog:${fullKey}`);

  function never(reason: string): PolicyDecision {
    return { tier: "never", reasons: [reason], category: "forbidden" };
  }
  function ask(category: PolicyDecision["category"], reason: string, persistKey?: string): PolicyDecision {
    return { tier: "ask", reasons: [reason, ...reasons], category, persistKey };
  }
}

function referencesOutsideWorkspace(arg: string, jail: PathJail): string | undefined {
  // Check values like --out=/x, -p ../x, C:\x, \\server\share.
  const candidates = [arg, ...(arg.includes("=") ? [arg.slice(arg.indexOf("=") + 1)] : [])];
  for (const c of candidates) {
    if (!c) continue;
    if (/^(https?|git|ssh):\/\//i.test(c) || /^[\w.-]+@[\w.-]+:/.test(c)) continue; // URLs are judged by program policy
    const looksAbs = path.isAbsolute(c) || /^[a-zA-Z]:[\\/]/.test(c) || c.startsWith("\\\\") || c.startsWith("~");
    if (looksAbs) {
      if (c.startsWith("~")) return c;
      const abs = path.resolve(c);
      if (!isWithin(jail.root, abs)) return c;
      continue;
    }
    if (/(^|[\\/])\.\.([\\/]|$)/.test(c)) {
      const abs = path.resolve(jail.root, c);
      if (!isWithin(jail.root, abs)) return c;
    }
  }
  return undefined;
}

function looksLikeSecretPath(arg: string, jail: PathJail): boolean {
  const v = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : arg;
  if (!v || v.startsWith("-") || /^(https?|git|ssh):/.test(v)) return false;
  const rel = path.isAbsolute(v) ? jail.relative(path.resolve(v)) : v.replace(/\\/g, "/").replace(/^\.\//, "");
  return jail.isSecretPath(rel);
}
