# ADR-0006 — Artifact paths, updater strategy and distribution

- Status: Accepted (2026-10-01) — distribution deferred
- Context: PRD Phase 0 ("choose … artifact paths, and updater strategy")

## Decision
- **Artifact paths**: see ADR-0004 (content-addressed under the data directory; exports are served by id).
- **Updater strategy**: v1 is run from source (`npm start`). When packaging is introduced, use
  `electron-builder` with a signed NSIS (Windows) / DMG (macOS) target and the built-in
  `electron-updater` against a static release feed. Database migrations are forward-only and run at daemon
  start, so an update never requires manual steps. Updates are user-initiated (no silent background install),
  consistent with "local by default".
- **No hosted services**: FlowCode requires no FlowCode-operated server. Only optional, consented external
  calls exist (npm registry for approved installs, search adapters for approved research, hosted model
  providers if a user configures one).

## Consequences
Code signing certificates and a release host have a cost and are intentionally not set up in this build.
