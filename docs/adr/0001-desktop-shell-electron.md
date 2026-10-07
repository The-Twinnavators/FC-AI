# ADR-0001 — Desktop shell: Electron + React/TypeScript UI

- Status: Accepted (2026-10-01)
- Context: PRD §8.1, §8.2, §16

## Decision
FlowCode v1 ships as an **Electron** desktop application whose renderer hosts a **React + TypeScript** UI
(`apps/ui`, built with Vite). The shell (`apps/desktop`) owns only window management, native folder selection
and the daemon lifecycle. All privileged work (filesystem, processes, models, browser automation) happens in
the separate local daemon (ADR-0003).

## Rationale
- Mature native dialogs, process control and a Chromium engine for previews (§16 recommends Electron; Tauri remains a future alternative).
- Electron 38 bundles Node 22.22 with `node:sqlite` + FTS5, so the daemon runs on Electron's own Node (`ELECTRON_RUN_AS_NODE=1`) and no separate Node install is needed to run FlowCode itself.

## Renderer hardening
`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; a two-function preload bridge (connection
details, folder picker); navigation is blocked; external links open in the system browser; only daemon
artifact URLs may open in child windows; a strict CSP limits network access to `127.0.0.1`.

## Consequences
- The renderer can be developed in a browser against a dev daemon (`scripts/dev-daemon.mjs`, `?port=&token=`).
- Packaging/signing and auto-update are deferred (see ADR-0006).
