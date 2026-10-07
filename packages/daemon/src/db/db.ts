import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { MIGRATIONS } from "./migrations.js";
import { nowIso } from "../util/ids.js";
import { ensureDir } from "../util/paths.js";

export type Row = Record<string, unknown>;

/**
 * Thin wrapper around node:sqlite. Uses the built-in driver so the daemon needs no native compilation
 * on Windows/macOS/Linux (ADR-0004).
 */
export class Db {
  readonly raw: DatabaseSync;

  constructor(file: string) {
    if (file !== ":memory:") ensureDir(path.dirname(file));
    this.raw = new DatabaseSync(file);
    this.raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.migrate();
  }

  migrate(): number[] {
    this.raw.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
    const applied = new Set((this.raw.prepare("SELECT id FROM schema_migrations").all() as Row[]).map((r) => Number(r.id)));
    const ran: number[] = [];
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue;
      this.tx(() => {
        this.raw.exec(m.sql);
        this.raw.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)").run(m.id, m.name, nowIso());
      });
      ran.push(m.id);
    }
    return ran;
  }

  appliedMigrations(): Row[] {
    return this.raw.prepare("SELECT * FROM schema_migrations ORDER BY id").all() as Row[];
  }

  tx<T>(fn: () => T): T {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.raw.exec("COMMIT");
      return out;
    } catch (err) {
      this.raw.exec("ROLLBACK");
      throw err;
    }
  }

  all<T = Row>(sql: string, ...params: unknown[]): T[] {
    return this.raw.prepare(sql).all(...(params as never[])) as T[];
  }

  get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
    return this.raw.prepare(sql).get(...(params as never[])) as T | undefined;
  }

  run(sql: string, ...params: unknown[]) {
    return this.raw.prepare(sql).run(...(params as never[]));
  }

  close() {
    this.raw.close();
  }
}

/**
 * Document repository: validated JSON in `data`, plus selected indexed columns.
 * `columns` maps column name → extractor from the entity.
 */
export class DocRepo<T extends { id: string }> {
  constructor(
    private db: Db,
    readonly table: string,
    private parse: (v: unknown) => T,
    private columns: Record<string, (e: T) => unknown> = {},
  ) {}

  upsert(entity: T): T {
    const valid = this.parse(entity);
    const cols = Object.keys(this.columns);
    const now = nowIso();
    const existing = this.db.get<Row>(`SELECT created_at FROM ${this.table} WHERE id = ?`, valid.id);
    const values = cols.map((c) => normalize(this.columns[c](valid)));
    if (existing) {
      const sets = [...cols.map((c) => `${c} = ?`), "data = ?", "updated_at = ?"].join(", ");
      this.db.run(`UPDATE ${this.table} SET ${sets} WHERE id = ?`, ...values, JSON.stringify(valid), now, valid.id);
    } else {
      const names = ["id", ...cols, "data", "created_at", "updated_at"];
      this.db.run(
        `INSERT INTO ${this.table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
        valid.id,
        ...values,
        JSON.stringify(valid),
        now,
        now,
      );
    }
    return valid;
  }

  get(id: string): T | undefined {
    const row = this.db.get<Row>(`SELECT data FROM ${this.table} WHERE id = ?`, id);
    return row ? this.parse(JSON.parse(String(row.data))) : undefined;
  }

  require(id: string): T {
    const v = this.get(id);
    if (!v) throw new NotFoundError(`${this.table} ${id} not found`);
    return v;
  }

  where(clause: string, ...params: unknown[]): T[] {
    return this.db.all<Row>(`SELECT data FROM ${this.table} WHERE ${clause}`, ...params).map((r) => this.parse(JSON.parse(String(r.data))));
  }

  list(orderBy = "created_at DESC", limit = 500): T[] {
    return this.db.all<Row>(`SELECT data FROM ${this.table} ORDER BY ${orderBy} LIMIT ?`, limit).map((r) => this.parse(JSON.parse(String(r.data))));
  }

  delete(id: string) {
    this.db.run(`DELETE FROM ${this.table} WHERE id = ?`, id);
  }
}

function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

export class NotFoundError extends Error {
  readonly status = 404;
}
