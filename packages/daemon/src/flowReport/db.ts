// packages/daemon/src/flowReport/db.ts
//
// Repo Report's schema, as one of FlowCode's migrations.
//
// ── In FlowCode's database, not a file of its own ────────────────────────────
//
// FlowAgent kept one SQLite file per domain (`flow-reports.db` beside
// `flowtask.db`) and ran its own idempotent ALTERs on every boot. FlowCode has
// one database (`flowcode.sqlite`) with ordered, append-only migrations that
// run once inside a transaction and are recorded in `schema_migrations`
// (ADR-0004). Repo Report joins that: its tables are created by migration 4 in
// `db/migrations.ts`, which reads the SQL below. One file means one backup,
// one retention story, and the Settings page's migration list says Repo Report
// is installed.
//
// This SQL is a shipped migration. Never edit it; a later change to the schema
// is a new migration in `db/migrations.ts`.
//
// ── The table shape is Repo Report's latest ───────────────────────────────────
//
// FlowAgent's file reached this shape through an ALTER (the comprehension
// column) and three one-off data migrations: documentation stopped being read
// by default, resolutions moved from the run to the project, and reasons
// became responses. All three rewrote data that only exists in a FlowAgent
// database. A FlowCode database starts at the final shape with nothing to
// carry across, so the ALTER is folded into the CREATE and the data migrations
// are not ported — running them here would have nothing to do.
//
// ── Two columns carry the design ─────────────────────────────────────────────
//
// `flow_report_sections.score` is nullable and NULL means "not enough evidence
// to score". It is not zero. A section that could not be assessed and one that
// was assessed and scored badly are different facts about a project, and the
// column keeps them apart so no layer above has to remember to.
//
// `flow_report_projects.repository_path` is the only place a local filesystem
// path is stored. It exists because a run needs to find the folder again. It is
// deliberately absent from the list projection in `store.ts`, and nothing that
// renders a report may read it.

export const FLOW_REPORT_SCHEMA = `
CREATE TABLE IF NOT EXISTS flow_report_projects (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  repository_display_name TEXT NOT NULL,
  repository_path         TEXT NOT NULL,
  settings_json           TEXT NOT NULL,
  latest_run_id           TEXT,
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS flow_report_runs (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL,
  status             TEXT NOT NULL,
  progress           REAL NOT NULL DEFAULT 0,
  current_stage      TEXT,
  started_at         INTEGER,
  completed_at       INTEGER,
  duration_ms        INTEGER,
  analysis_version   TEXT NOT NULL,
  summary_json       TEXT,
  warnings_json      TEXT,
  errors_json        TEXT,
  comprehension_json TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
-- One row per category per run. Replaced in place as a section progresses
-- from pending to completed, so a run never carries two versions of the same
-- section and the UI can read the table directly for live status.
CREATE TABLE IF NOT EXISTS flow_report_sections (
  run_id           TEXT NOT NULL,
  category         TEXT NOT NULL,
  status           TEXT NOT NULL,
  score            INTEGER,
  summary          TEXT NOT NULL DEFAULT '',
  findings_json    TEXT NOT NULL DEFAULT '[]',
  limitations_json TEXT NOT NULL DEFAULT '[]',
  reason           TEXT,
  started_at       INTEGER,
  completed_at     INTEGER,
  PRIMARY KEY (run_id, category)
);
CREATE TABLE IF NOT EXISTS flow_report_artifacts (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL,
  format            TEXT NOT NULL,
  filename          TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  bytes             INTEGER NOT NULL,
  sha256            TEXT NOT NULL,
  created_at        INTEGER NOT NULL
);
-- The developer-facing log behind the run drawer's diagnostic panel.
CREATE TABLE IF NOT EXISTS flow_report_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id     TEXT NOT NULL,
  level      TEXT NOT NULL,
  stage      TEXT,
  message    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
-- What a person decided about a finding, and why. An overlay rather than a
-- column on the analysis: the findings blob is what the run measured, and a
-- decision made afterwards is a different kind of fact. Keyed by PROJECT, not
-- by run, so the next scan of the same repository inherits it. Matched on the
-- analyser's own finding id, which survives the finding's wording changing;
-- title_when_resolved keeps the old wording so a reader can be told it moved.
CREATE TABLE IF NOT EXISTS flow_report_resolutions (
  project_id            TEXT NOT NULL,
  category              TEXT NOT NULL,
  finding_id            TEXT NOT NULL,
  status                TEXT NOT NULL,
  reason                TEXT NOT NULL,
  title_when_resolved   TEXT NOT NULL,
  resolved_at           INTEGER NOT NULL,
  resolved_by           TEXT,
  last_edited_at        INTEGER,
  last_edited_by        TEXT,
  PRIMARY KEY (project_id, category, finding_id)
);
-- One row per response, rather than text appended into the resolution, so
-- every response is readable, editable and deletable on its own. source
-- records whether an account was typed or arrived in a file, and an edit never
-- converts one into the other.
CREATE TABLE IF NOT EXISTS flow_report_responses (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  category     TEXT NOT NULL,
  finding_id   TEXT NOT NULL,
  body         TEXT NOT NULL,
  source       TEXT NOT NULL,
  source_name  TEXT,
  created_at   INTEGER NOT NULL,
  created_by   TEXT,
  edited_at    INTEGER,
  edited_by    TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_frp_name        ON flow_report_projects(name);
CREATE INDEX IF NOT EXISTS idx_frp_created_at         ON flow_report_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frr_project_created    ON flow_report_runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frr_status             ON flow_report_runs(status);
CREATE INDEX IF NOT EXISTS idx_frs_run_id             ON flow_report_sections(run_id);
CREATE INDEX IF NOT EXISTS idx_fra_run_id             ON flow_report_artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_fre_run_id_id          ON flow_report_events(run_id, id);
CREATE INDEX IF NOT EXISTS idx_frsp_finding           ON flow_report_responses(project_id, category, finding_id);
`
