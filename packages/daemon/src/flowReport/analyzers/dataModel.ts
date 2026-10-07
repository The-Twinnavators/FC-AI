// daemon/src/flow-reports/analyzers/dataModel.ts
//
// The data model, read from the migrations that built it.
//
// ── Why this is its own reading ──────────────────────────────────────────────
//
// Several analysers already touch the database and each sees a sliver: Security
// QA looks for tables with row-level security enabled and no policy, Compliance
// looks for the columns a regulation attaches to, Marketplace Health looks for
// the primitives a two-sided product needs. None of them knows the shape of the
// data itself — how many tables there are, what points at what, which joins are
// indexed, what happens to a child row when its parent is deleted.
//
// That shape is also the input several of those analysers should be reading
// instead of re-deriving. This produces it once.
//
// ── What it deliberately does not report ─────────────────────────────────────
//
// Row-level security and policies belong to Security QA and stay there. Consent,
// retention and the rights a regulation grants belong to Compliance. This
// reports structure: tables, keys, references, indexes and what the application
// actually reads and writes. Where the two would overlap, the other section
// wins and this one stays quiet — a reader who meets the same finding twice
// trusts both less.
//
// ── Migrations are cumulative and this reads them as a sequence ──────────────
//
// A table created in migration 001 may be altered in 300. This parses CREATE
// TABLE, CREATE INDEX and the inline column references that Postgres migrations
// mostly use, in filename order, and applies ALTER TABLE ... ADD COLUMN and ADD
// CONSTRAINT on top. What it does not model is a column dropped, renamed or
// retyped later — so a table's column list is the union of everything ever
// added to it, which is stated as a limitation rather than left for a reader to
// discover.

export interface SourceFile { path: string; text: string }

export interface ColumnRef {
  /** `schema.table`, as written. */
  table: string
  column: string
  /** `cascade`, `set null`, `restrict`, `no action` — or null where the
   *  migration did not say, which is the finding rather than a default. */
  onDelete: string | null
}

export interface Column {
  name: string
  type: string
  notNull: boolean
  primaryKey: boolean
  /** A unique constraint creates an index in Postgres, so a unique column is
   *  already served for lookup even with no CREATE INDEX naming it. */
  unique: boolean
  references: ColumnRef | null
}

export interface Table {
  /** Without the schema prefix. */
  name: string
  schema: string
  /** The migration that created it. */
  file: string
  columns: Column[]
  get hasPrimaryKey(): boolean
}

export interface IndexDef {
  table: string
  columns: string[]
  unique: boolean
  file: string
}

export interface DataModel {
  tables: Table[]
  indexes: IndexDef[]
  /** Every migration read, in order. */
  migrations: string[]
  /** True when no migration or schema file was found at all, which is not the
   *  same as a product with no database. */
  unverified: boolean
}

// ── Parsing ─────────────────────────────────────────────────────────────────

const MIGRATION = /(^|\/)(migrations?|db|database|sql|schema)\//i
const SQL = /\.sql$/i

/** `create table [if not exists] [schema.]name (` — the body is matched
 *  separately because a column list nests parentheses and a single regex that
 *  tries to capture it either stops at the first `)` or runs to the file end. */
const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?["`]?(\w+)["`]?\s*\(/gi

const CREATE_INDEX = /create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?\w+\s+on\s+(?:\w+\.)?["`]?(\w+)["`]?\s*(?:using\s+\w+\s*)?\(([^)]*)\)/gi

/** `alter table x add column y type ...` */
const ADD_COLUMN = /alter\s+table\s+(?:if\s+exists\s+)?(?:(\w+)\.)?["`]?(\w+)["`]?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?["`]?(\w+)["`]?\s+([\w\s()]+?)(?:,|;|$)/gi

/** Inline on a column: `references auth.users(id) on delete cascade`. This is
 *  the dominant form in practice — measured on a real checkout, 59 migrations
 *  used it against 7 using a table-level FOREIGN KEY clause. */
const INLINE_REF = /references\s+(?:(\w+)\.)?["`]?(\w+)["`]?\s*\(\s*["`]?(\w+)["`]?\s*\)(\s+on\s+delete\s+(cascade|set\s+null|restrict|no\s+action|set\s+default))?/i

/** The balanced body of a `create table ... (` starting just after the paren. */
function tableBody(text: string, from: number): string {
  let depth = 1
  let i = from
  while (i < text.length && depth > 0) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    i++
  }
  return text.slice(from, i - 1)
}

/**
 * Comments out, before anything counts commas or quotes.
 *
 * This used to happen per clause, after the split, and the order was wrong.
 * A real migration opens with:
 *
 *   -- e.g. 'clicked_upgrade_button', 'opened_lookbook'.
 *   name text primary key,
 *
 * The comment carries a comma, so the split cut through it and left `name text
 * primary key` in a fragment beginning with a stray quote — which matched no
 * column pattern, so the column vanished and the table was reported as having
 * no primary key. Stripping first makes the rest of the parsing honest.
 */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, '')
}

/** Split a column list on commas that are not inside parentheses — `check (x in
 *  ('a','b'))` and `numeric(10,2)` both contain commas that are not separators. */
function splitColumns(body: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  let quote: string | null = null
  for (const c of body) {
    if (quote) {
      current += c
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"') { quote = c; current += c; continue }
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) { out.push(current); current = ''; continue }
    current += c
  }
  if (current.trim()) out.push(current)
  return out
}

/** Clauses that are table constraints rather than columns. */
const CONSTRAINT = /^\s*(primary\s+key|foreign\s+key|unique|check|constraint|exclude|like)\b/i

/**
 * The table-level constraints, which carry what the column-level ones do not.
 *
 * Skipping these reported `service_staff` — a join table whose whole key is
 * `PRIMARY KEY (service_id, staff_id)` — as a table with no primary key. That
 * is the first claim a reader would have disproved, and it would have taken the
 * rest of the section's credibility with it.
 *
 * It also picks up the table-level `FOREIGN KEY (x) REFERENCES y(z)` form,
 * which is rarer than the inline one but not absent: measured on a real
 * checkout, 7 migrations use it.
 */
const PK_CONSTRAINT = /^\s*(?:constraint\s+\w+\s+)?primary\s+key\s*\(([^)]*)\)/i
const UNIQUE_CONSTRAINT = /^\s*(?:constraint\s+\w+\s+)?unique\s*\(([^)]*)\)/i
const FK_CONSTRAINT = /^\s*(?:constraint\s+\w+\s+)?foreign\s+key\s*\(([^)]*)\)\s*references\s+(?:(\w+)\.)?["`]?(\w+)["`]?\s*\(\s*["`]?(\w+)["`]?\s*\)(\s+on\s+delete\s+(cascade|set\s+null|restrict|no\s+action|set\s+default))?/i

const namesIn = (list: string): string[] =>
  list.split(',').map((c) => c.trim().replace(/["`]/g, '')).filter(Boolean)

/** Applies the table-level constraints onto the columns they name. */
function applyConstraints(clauses: string[], columns: Column[]): void {
  const find = (n: string) => columns.find((c) => c.name.toLowerCase() === n.toLowerCase())

  for (const raw of clauses) {
    const clause = raw.trim()

    const pk = PK_CONSTRAINT.exec(clause)
    if (pk) {
      for (const n of namesIn(pk[1]!)) {
        const c = find(n)
        if (c) c.primaryKey = true
      }
      continue
    }

    const uq = UNIQUE_CONSTRAINT.exec(clause)
    if (uq) {
      // The leading column only: a unique index on (a, b) serves a lookup by
      // `a`, the same rule the CREATE INDEX path uses.
      const first = namesIn(uq[1]!)[0]
      const c = first ? find(first) : undefined
      if (c) c.unique = true
      continue
    }

    const fk = FK_CONSTRAINT.exec(clause)
    if (fk) {
      const first = namesIn(fk[1]!)[0]
      const c = first ? find(first) : undefined
      if (c && !c.references) {
        c.references = {
          table: fk[3]!,
          column: fk[4]!,
          onDelete: fk[6] ? fk[6].replace(/\s+/g, ' ').toLowerCase() : null,
        }
      }
    }
  }
}

function parseColumn(clause: string): Column | null {
  const line = clause.trim()
  if (!line || CONSTRAINT.test(line)) return null

  const m = /^["`]?(\w+)["`]?\s+([\w"]+(?:\s*\([^)]*\))?(?:\[\])?)/.exec(line)
  if (!m) return null

  const refMatch = INLINE_REF.exec(line)
  return {
    name: m[1]!,
    type: m[2]!.trim(),
    notNull: /\bnot\s+null\b/i.test(line),
    primaryKey: /\bprimary\s+key\b/i.test(line),
    unique: /\bunique\b/i.test(line),
    references: refMatch
      ? {
        table: refMatch[2]!,
        column: refMatch[3]!,
        onDelete: refMatch[5] ? refMatch[5].replace(/\s+/g, ' ').toLowerCase() : null,
      }
      : null,
  }
}

/**
 * Every table, index and reference the migrations define.
 *
 * Files are read in filename order, which is how a migration directory is meant
 * to be applied and how the numbering in practice encodes it.
 */
export function readDataModel(files: SourceFile[]): DataModel {
  const sql = files
    .filter((f) => SQL.test(f.path) && MIGRATION.test(f.path))
    .sort((a, b) => a.path.localeCompare(b.path))

  const byName = new Map<string, { schema: string; file: string; columns: Column[] }>()
  const indexes: IndexDef[] = []

  for (const f of sql) {
    CREATE_TABLE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = CREATE_TABLE.exec(f.text)) !== null) {
      const schema = m[1] ?? 'public'
      const name = m[2]!
      const body = stripComments(tableBody(f.text, m.index + m[0].length))
      const clauses = splitColumns(body)
      const columns = clauses
        .map(parseColumn)
        .filter((c): c is Column => c !== null)
      // After the columns exist, because a constraint names them.
      applyConstraints(clauses.filter((c) => CONSTRAINT.test(c)), columns)

      const existing = byName.get(name)
      if (existing) {
        // A later `create table if not exists` for the same name adds nothing;
        // keep the first definition and its file.
        for (const c of columns) {
          if (!existing.columns.some((e) => e.name === c.name)) existing.columns.push(c)
        }
      } else {
        byName.set(name, { schema, file: f.path, columns })
      }
    }

    ADD_COLUMN.lastIndex = 0
    while ((m = ADD_COLUMN.exec(f.text)) !== null) {
      const t = byName.get(m[2]!)
      if (t && !t.columns.some((c) => c.name === m![3])) {
        t.columns.push({
          name: m[3]!, type: (m[4] ?? '').trim(), notNull: false,
          primaryKey: false, unique: false, references: null,
        })
      }
    }

    CREATE_INDEX.lastIndex = 0
    while ((m = CREATE_INDEX.exec(f.text)) !== null) {
      indexes.push({
        table: m[2]!,
        columns: m[3]!.split(',').map((c) => c.trim().replace(/["`]/g, '').split(/\s+/)[0]!)
          .filter(Boolean),
        unique: Boolean(m[1]),
        file: f.path,
      })
    }
  }

  const tables: Table[] = [...byName].map(([name, t]) => ({
    name,
    schema: t.schema,
    file: t.file,
    columns: t.columns,
    get hasPrimaryKey() { return this.columns.some((c: Column) => c.primaryKey) },
  }))

  return { tables, indexes, migrations: sql.map((f) => f.path), unverified: sql.length === 0 }
}

// ── Derived views other analysers can use ───────────────────────────────────

export interface ForeignKey {
  from: { table: string; column: string }
  to: { table: string; column: string }
  onDelete: string | null
  file: string
  /** True when an index starts with this column, which is what a join needs. */
  indexed: boolean
}

export function foreignKeys(m: DataModel): ForeignKey[] {
  const out: ForeignKey[] = []
  for (const t of m.tables) {
    for (const c of t.columns) {
      if (!c.references) continue
      out.push({
        from: { table: t.name, column: c.name },
        to: { table: c.references.table, column: c.references.column },
        onDelete: c.references.onDelete,
        file: t.file,
        // A primary key and a unique constraint both create an index in
        // Postgres. Counting only CREATE INDEX called `profiles.id` — which is
        // `id uuid primary key references auth.users(id)` — an unindexed join,
        // which would have been the first thing a reader checked and the first
        // thing that made them stop trusting the section.
        //
        // Leading column only for the rest: an index on (a, b) serves a lookup
        // by `a` and not one by `b`.
        indexed: c.primaryKey || c.unique
          || m.indexes.some((i) => i.table === t.name && i.columns[0] === c.name),
      })
    }
  }
  return out
}

/** Column names that carry personal or otherwise sensitive data. Named for what
 *  they are rather than matched loosely: `name` alone appears on every table in
 *  a database and means nothing. */
const SENSITIVE = /^(email|phone|phone_number|ssn|national_id|passport|dob|date_of_birth|birth_?date|address|street|postcode|zip_code|ip_address|password|password_hash|token|secret|api_key|card_last4|bank_account|iban|tax_id)$/i

export interface SensitiveColumn { table: string; column: string; file: string }

export function sensitiveColumns(m: DataModel): SensitiveColumn[] {
  return m.tables.flatMap((t) =>
    t.columns.filter((c) => SENSITIVE.test(c.name))
      .map((c) => ({ table: t.name, column: c.name, file: t.file })))
}

/**
 * Tables the application code never names.
 *
 * A table nothing reads is worth knowing about and is NOT called dead: a table
 * reached through a view, a function, a generated client or a string built at
 * runtime is invisible to this. The finding says "not referenced by name",
 * which is what was actually established.
 */
export function unreferencedTables(m: DataModel, files: SourceFile[]): string[] {
  const code = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|java|cs|php)$/i.test(f.path))
  const haystack = code.map((f) => f.text).join('\n')
  return m.tables
    .filter((t) => !new RegExp(`['"\`]${t.name}['"\`]|\\b${t.name}\\b`, 'i').test(haystack))
    .map((t) => t.name)
}
