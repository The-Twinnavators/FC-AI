# ADR-0004 — Persistence: SQLite (node:sqlite) + content-addressed artifact store

- Status: Accepted (2026-10-01)
- Context: PRD §8.1, §9, §16, §7.3

## Decision
- **Metadata**: SQLite via Node's built-in `node:sqlite` (no native module compilation), WAL mode.
  Entities are stored as zod-validated JSON documents with indexed query columns (`db/db.ts` `DocRepo`).
- **Migrations**: ordered, append-only, transactional, recorded in `schema_migrations` (`db/migrations.ts`).
  Shipped migrations are never edited.
- **Events**: append-only table with a monotonic `seq` used for SSE resume.
- **Search**: one FTS5 index (`search_index`) across files, knowledge, prompts, skills and run history, with an
  incremental file index (`file_index_state`, mtime+hash). Local embeddings (Ollama `nomic-embed-text`) are cached
  per content hash in `embeddings`.
- **Artifacts & snapshots**: content-addressed object store (`<data>/objects/<sha[0:2]>/<sha256>`), atomic
  writes. Snapshots reference prior content by hash.

## Paths
Data lives in `%APPDATA%/FlowCode` (Windows) or `~/.local/share/FlowCode`, overridable with
`FLOWCODE_DATA_DIR`. Managed workspaces: `<data>/workspaces/`. Capability-lab sandboxes: `<data>/capability-lab/`
(deleted after each probe). Reports never contain absolute paths.

## Consequences
Durable run/task/event state supports restart and resume; any record in a report links to stored evidence.
