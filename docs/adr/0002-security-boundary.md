# ADR-0002 — Security boundary

- Status: Accepted (2026-10-01)
- Context: PRD §7.1, §17, FR-W2, FR-C1, FR-F3

## Decision
1. **Workspace path jail** (`security/pathJail.ts`): every path is workspace-relative, canonicalized, resolved
   against the realpath of its deepest existing ancestor (defeats symlink/junction escapes), and rejected on
   traversal, absolute paths or NUL bytes.
2. **Secret files denied by default** (`.env*`, keys, certificates, credential stores, `.git` internals,
   plus per-project patterns). They appear in listings marked "secret" but are never read or passed to models.
3. **Redaction everywhere** (`security/redaction.ts`): before persistence, events, model context, reports and
   exports. A line-oriented streaming redactor covers command output; private-key blocks are held until closed.
4. **Governed tools only**: agents act through zod-validated tool calls dispatched by the runtime. Typed file
   operations snapshot first, validate protected files before *and* after, and write atomically.
5. **Command policy tiers** (`commands/policy.ts`): argv-only, `shell:false`, cwd locked, scrubbed env,
   timeout + output cap. `never` = shells, system tools, outside-workspace/secret arguments, git push,
   publish/deploy, disabled hooks. `ask` = installs, network, migrations, unknown scripts/programs, deletes.
   `auto` = read-only queries and script bodies verified by content (not by name).
6. **Untrusted content** (§12.3): file contents, command output, web results and knowledge are wrapped in
   `<untrusted>` blocks; instruction-like lines are flagged; only the orchestrator chooses tools.
7. **Local API auth boundary**: the daemon listens on `127.0.0.1` only, requires a per-launch bearer token
   (constant-time compare), restricts CORS to the app origin, and strips absolute paths from errors.
8. **External transfer requires consent**: hosted providers are disabled until configured *and* enabled per
   project; external research sends only the shown queries after an approval.

## Hardening from the independent review (2026-10-01)
An adversarial review found 22 issues; all actionable ones are fixed with regression tests in
`test/review-regressions.test.ts`:
- Programs must be bare names (no planted `./git`); package-manager redirect flags (`--prefix`, `-w`, `--cwd`,
  `--registry`, `--script-shell`, …) are `never`; `npm run x` is auto only with no extra arguments.
- git global options (`-c`, `-C`, `--git-dir`, `--work-tree`) are `never`; read-only git subcommands are auto
  only with an exact flag allowlist (no `--output`, no `rev:path`, no `branch -D` / `remote add`).
- npx is auto only as `npx <local tool> <allowlisted args>`; `vite --host` must be bound to 127.0.0.1.
- Persistent ("allow for project") approvals are keyed by the full argv.
- Path jail rejects `:` (alternate data streams), trailing dots/spaces, device names (CON, NUL, AUX, COM1…),
  and paths through dangling links; `.git/hooks`, `.git/info`, `.husky` are protected.
- Scope checks use canonical jail paths and the task's own declared paths only.
- Adding a package script whose body is not on the verified-safe list requires approval.
- Tasks verify only after an explicit completion claim **and** at least one machine-checkable criterion.
- Planning failures block the run visibly; the planner cannot self-declare low risk for plans touching
  protected files or dependencies.
- Command completion waits for stream close (no lost trailing output); stale PIDs are only killed if the image
  still matches a FlowCode-spawned program; malformed requests cannot crash the daemon.

## Residual risk (accepted, documented)
Running a project's tests or build executes code in the workspace — including code the agent wrote and config
files such as `vite.config.ts`. FlowCode contains this with the workspace cwd lock, a scrubbed environment, no
inherited secrets, output caps, timeouts and process-tree ownership, but it is not an OS-level sandbox. An OS
sandbox (Windows AppContainer / macOS sandbox-exec / Linux namespaces) is the recommended next step.

## Consequences
Agents cannot grant themselves permissions; approvals are resolved only through the API by the user.
