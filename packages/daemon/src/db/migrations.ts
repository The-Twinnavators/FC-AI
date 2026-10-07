import { FLOW_REPORT_SCHEMA } from "../flowReport/db.js";

/**
 * Ordered, append-only SQLite migrations (ADR-0004). Each migration runs once inside a transaction
 * and is recorded in schema_migrations. Never edit a shipped migration; add a new one.
 */
export interface Migration {
  id: number;
  name: string;
  sql: string;
}

/** Entities are stored as validated JSON documents plus indexed columns used for queries. */
const doc = (table: string, extraCols = "", extraIdx: string[] = []) => `
CREATE TABLE ${table} (
  id TEXT PRIMARY KEY,
  ${extraCols}
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
${extraIdx.map((c) => `CREATE INDEX idx_${table}_${c} ON ${table}(${c});`).join("\n")}
`;

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "core_entities",
    sql: [
      doc("projects"),
      doc("preflights", "project_id TEXT NOT NULL,", ["project_id"]),
      doc("runs", "project_id TEXT NOT NULL, status TEXT NOT NULL,", ["project_id", "status"]),
      doc("tasks", "run_id TEXT NOT NULL, status TEXT NOT NULL, ordinal INTEGER NOT NULL DEFAULT 0,", ["run_id"]),
      doc("commands", "run_id TEXT NOT NULL, task_id TEXT, status TEXT NOT NULL, fingerprint TEXT,", ["run_id", "fingerprint"]),
      doc("tool_calls", "run_id TEXT NOT NULL, task_id TEXT, idempotency_key TEXT,", ["run_id", "idempotency_key"]),
      doc("approvals", "project_id TEXT NOT NULL, run_id TEXT, status TEXT NOT NULL,", ["project_id", "run_id", "status"]),
      doc("verification_checks", "run_id TEXT NOT NULL, kind TEXT NOT NULL,", ["run_id"]),
      doc("snapshots", "run_id TEXT NOT NULL, task_id TEXT, project_id TEXT NOT NULL, seq INTEGER NOT NULL,", ["run_id", "project_id"]),
      doc("checkpoints", "run_id TEXT NOT NULL,", ["run_id"]),
      doc("processes", "run_id TEXT NOT NULL, state TEXT NOT NULL,", ["run_id", "state"]),
      doc("capabilities", "provider_id TEXT NOT NULL, model TEXT NOT NULL, config_hash TEXT NOT NULL,", ["provider_id"]),
      doc("providers"),
      doc("artifacts", "run_id TEXT, kind TEXT NOT NULL,", ["run_id"]),
      `CREATE TABLE events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        project_id TEXT,
        run_id TEXT,
        task_id TEXT,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_events_run ON events(run_id, seq);`,
      `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
    ].join("\n"),
  },
  {
    id: 2,
    name: "knowledge_prompts_skills_search",
    sql: [
      doc("knowledge", "scope TEXT NOT NULL, project_id TEXT, kind TEXT NOT NULL,", ["project_id", "kind"]),
      doc("prompts", "version TEXT NOT NULL,", []),
      doc("prompt_versions", "prompt_id TEXT NOT NULL, version TEXT NOT NULL,", ["prompt_id"]),
      doc("skills", "version TEXT NOT NULL,", []),
      doc("skill_versions", "skill_id TEXT NOT NULL, version TEXT NOT NULL,", ["skill_id"]),
      doc("research_jobs", "project_id TEXT NOT NULL,", ["project_id"]),
      `CREATE TABLE research_cache (
        key TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        data TEXT NOT NULL,
        source_date TEXT,
        fetched_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );`,
      // Unified local full-text index across files, notes, prompts, skills, run history, knowledge (FR-K4).
      `CREATE VIRTUAL TABLE search_index USING fts5(
        entity_kind UNINDEXED,
        entity_id UNINDEXED,
        project_id UNINDEXED,
        title,
        body,
        provenance UNINDEXED,
        tokenize = 'porter unicode61'
      );`,
      `CREATE TABLE file_index_state (
        project_id TEXT NOT NULL,
        rel_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        mtime_ms REAL NOT NULL,
        PRIMARY KEY (project_id, rel_path)
      );`,
      `CREATE TABLE embeddings (
        entity_kind TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        model TEXT NOT NULL,
        dims INTEGER NOT NULL,
        vector BLOB NOT NULL,
        content_hash TEXT NOT NULL,
        PRIMARY KEY (entity_kind, entity_id, model)
      );`,
      doc("prompt_cache", "cache_key TEXT NOT NULL,", ["cache_key"]),
    ].join("\n"),
  },
  {
    id: 3,
    name: "task_dag_edges",
    sql: `CREATE TABLE task_edges (
      run_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      depends_on TEXT NOT NULL,
      PRIMARY KEY (task_id, depends_on)
    );
    CREATE INDEX idx_task_edges_run ON task_edges(run_id);`,
  },
  {
    id: 4,
    // FlowReport (ported from FlowAgent): report projects, runs, sections, artifacts, the run log, and the
    // resolutions and responses people record against findings. See flowReport/db.ts.
    name: "flow_report",
    sql: FLOW_REPORT_SCHEMA,
  },
];
