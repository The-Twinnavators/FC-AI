# PRD §20 open questions — implementation defaults

The PRD leaves these for product decision. The build uses the defaults below so the MVP is runnable; each is a
setting or a small code change, not an architectural commitment.

| # | Question | Default implemented | Where to change |
|---|---|---|---|
| 1 | Local-only or opt-in hosted at launch? | Local-only by default; an OpenAI-compatible hosted adapter exists but is disabled until configured **and** enabled per project. | Settings → project policy; `models/router.ts` |
| 2 | Initial OS target | Built and tested on Windows 11; code paths for macOS/Linux (process groups, paths) included but untested. | — |
| 3 | Templates beyond React/Vite | Only the verified React + Vite + TS starter. | `orchestrator/templates.ts` |
| 4 | Default retention | Snapshots/screenshots of finished runs 30 days, logs 90 days; enforced at daemon start and every 6 h; reports are kept; unreferenced objects are garbage-collected. | Settings → Retention |
| 5 | Which actions get project-level approval | Installs, specific scripts/programs, external research. Plans, deletes and whole-file replaces are always per-occurrence. | `commands/policy.ts` persistKey |
| 6 | Research consent representation | Per project (setting) or per job (approval card listing the exact queries). | Settings / approvals |
| 7 | Editor capability in v1 | File tree, read-only file view, snapshot diffs and restore. No Monaco/LSP yet (Phase 8). | — |
| 8 | Import VS Code settings | Not implemented. | — |
