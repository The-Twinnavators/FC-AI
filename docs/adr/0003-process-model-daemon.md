# ADR-0003 — Process model: separate local daemon

- Status: Accepted (2026-10-01)
- Context: PRD §8, §8.2, FR-C3, §7.3

## Decision
The **daemon** (`packages/daemon`) is a Node + TypeScript process separate from the renderer. The desktop shell
spawns it with a random token and reads a one-line JSON handshake (`{"flowcode":"ready","port":…}`) from stdout.
The UI talks to it over loopback HTTP (commands) and SSE (events with `Last-Event-ID` resume).

- **Process ownership**: every child (commands, dev servers, Playwright Chromium) is registered by run id, PID,
  port and argv. Cancel and shutdown kill whole process trees (`taskkill /T /F` on Windows, process groups on
  POSIX) and record the cleanup result as an event.
- **Shutdown**: closing the daemon's stdin (shell exit), SIGINT/SIGTERM all trigger cleanup. On startup the
  daemon reconciles orphans left by a crash and marks interrupted runs resumable.
- **One orchestrator owns run state** (§10.2); agents never transition phases.

## Consequences
- The UI stays responsive during long runs; daemon crashes are surfaced and recoverable.
- The same daemon can serve a browser-hosted UI during development.
