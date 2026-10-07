// daemon/src/flow-reports/analyzers/dataArchitecture.ts
//
// What the data model is, and where its structure invites trouble.
//
// ── Every finding here is structural ─────────────────────────────────────────
//
// Row-level security belongs to Security QA. Consent, retention and the rights
// a regulation grants belong to Compliance. This reports the shape: tables,
// keys, references, indexes, and which of them the application never names.
// Where the two would overlap the other section wins, because a reader who
// meets the same finding twice trusts both of them less.
//
// ── The model is published as a finding, not only used ───────────────────────
//
// The brief asks for a data model and a data flow map. Emitting the inventory
// as an informational finding with one evidence line per table is the version
// that survives both renderers — a markdown table inside a finding field
// reaches the markdown export and arrives in the PDF as escaped text.

import type { Evidence, Finding, ReportSectionResult } from '../types.js'
import type { SectionAnalyzer } from '../jobManager.js'
import {
  readDataModel, foreignKeys, sensitiveColumns, unreferencedTables,
  type DataModel,
} from './dataModel.js'

const CATEGORY = 'data_architecture' as const

/** Evidence rows for the model itself, largest tables first — a reader
 *  scanning an inventory of 158 wants the ones carrying the product. */
function modelRows(m: DataModel): Evidence[] {
  return [...m.tables]
    .sort((a, b) => b.columns.length - a.columns.length)
    .slice(0, 40)
    .map((t) => ({
      kind: 'file' as const,
      path: t.file,
      description: `${t.name} — ${t.columns.length} columns, `
        + `${t.columns.filter((c) => c.references).length} reference(s) out`
        + `${t.hasPrimaryKey ? '' : ', no primary key'}`,
    }))
}

export function dataArchitectureFindings(m: DataModel, files: Array<{ path: string; text: string }>): Finding[] {
  const out: Finding[] = []
  const fks = foreignKeys(m)

  // ── Everything here is computed, not matched ──────────────────────────────
  //
  // Each finding below compares two complete sets derived from parsing every
  // migration — the references against the indexes, the columns against the
  // primary keys. The files a finding cites are examples of a fact established
  // from the whole corpus, not the evidence the fact rests on.
  //
  // That distinction decides whether a downstream check can refute it from a
  // sample. It could not, and tried: "24 foreign key(s) have no index on the
  // referencing column" was withdrawn from the report because "the evidence
  // provided does not clearly indicate that the foreign keys lack indexes, as
  // some of the excerpts are incomplete". The excerpts were three of twelve,
  // and the count came from neither.
  const computed = { computedFromFullParse: true } as const

  // ── The model itself ──
  out.push({
    id: 'DATA-MAP',
    category: CATEGORY,
    ...computed,
    title: `${m.tables.length} tables, ${fks.length} references between them`,
    summary: `Read from ${m.migrations.length} migration file(s). `
      + `${m.tables.reduce((n, t) => n + t.columns.length, 0)} columns and `
      + `${m.indexes.length} index(es) are defined across them.`,
    severity: 'info',
    confidence: 'high',
    confidenceScore: 0.9,
    type: 'observation',
    status: 'open',
    impact: 'This is the shape the rest of the report describes. Nothing here is a problem.',
    recommendation: 'No action. The inventory is here so a finding elsewhere can be placed in it.',
    rationale: 'Parsed from the migrations in filename order, which is how they are applied.',
    evidence: modelRows(m),
    claudeCodePrompts: [],
  })

  // ── Joins with no index ──
  const unindexed = fks.filter((f) => !f.indexed)
  if (unindexed.length > 0) {
    out.push({
      id: 'DATA-001',
      category: CATEGORY,
      ...computed,
      title: `${unindexed.length} foreign key(s) have no index on the referencing column`,
      summary: 'A column that points at another table and carries no index of its own '
        + 'makes every lookup through it a scan of the whole table.',
      severity: unindexed.length > 15 ? 'medium' : 'low',
      confidence: 'high',
      confidenceScore: 0.85,
      type: 'risk',
      status: 'open',
      impact: 'Reads that join through these columns get slower as the table grows, and a '
        + 'cascading delete has to find the children the same way.',
      implication: 'Nothing is incorrect today. The cost arrives with row count, which is why '
        + 'it is easy to ship and hard to notice until it matters.',
      recommendation: 'Add an index on the referencing column for the joins that are actually '
        + 'made. Not all of them need one — a table that is only ever read by its own primary '
        + 'key does not.',
      rationale: 'A primary key and a unique constraint both create an index in Postgres, so '
        + 'those are not counted here. Only the leading column of a composite index counts, '
        + 'because an index on (a, b) does not serve a lookup by b.',
      evidence: unindexed.slice(0, 12).map((f) => ({
        kind: 'file' as const,
        path: f.file,
        description: `${f.from.table}.${f.from.column} references ${f.to.table}.${f.to.column} `
          + 'and no index starts with that column.',
      })),
      claudeCodePrompts: [],
    })
  }

  // ── References with no delete behaviour ──
  const noDelete = fks.filter((f) => !f.onDelete)
  if (noDelete.length > 0) {
    out.push({
      id: 'DATA-002',
      category: CATEGORY,
      ...computed,
      title: `${noDelete.length} reference(s) do not say what happens when the parent row is deleted`,
      summary: 'Without an ON DELETE clause the database refuses the delete rather than '
        + 'cascading or nulling, which is a safe default and rarely the intended one.',
      severity: 'low',
      confidence: 'high',
      confidenceScore: 0.85,
      type: 'gap',
      status: 'open',
      impact: 'Deleting a parent row fails while a child still points at it. Whether that is '
        + 'correct depends on what the rows mean, which the schema does not say.',
      implication: 'The behaviour is decided by omission rather than by choice. Somewhere a '
        + 'delete either fails unexpectedly or is worked around in application code.',
      recommendation: 'State the behaviour for each one — cascade where the child cannot exist '
        + 'without the parent, set null where it can, restrict where the delete should be '
        + 'refused on purpose.',
      rationale: 'Postgres defaults to NO ACTION. That is a real choice and these references '
        + 'do not appear to have made it deliberately.',
      evidence: noDelete.slice(0, 10).map((f) => ({
        kind: 'file' as const,
        path: f.file,
        description: `${f.from.table}.${f.from.column} references ${f.to.table}.${f.to.column} `
          + 'with no ON DELETE clause.',
      })),
      claudeCodePrompts: [],
    })
  }

  // ── Tables with no primary key ──
  const noPk = m.tables.filter((t) => !t.hasPrimaryKey)
  if (noPk.length > 0) {
    out.push({
      id: 'DATA-003',
      category: CATEGORY,
      ...computed,
      title: `${noPk.length} table(s) define no primary key`,
      summary: 'A table with no primary key has no guaranteed way to address one row.',
      severity: 'medium',
      confidence: 'medium',
      // Deliberately not high: a unique index can do the same job, and at least
      // one table here uses a PARTIAL unique index on purpose — a shape this
      // parser sees as "no primary key" and which is a legitimate design.
      confidenceScore: 0.65,
      type: 'risk',
      status: 'open',
      impact: 'Row-level operations, replication and some client libraries rely on a stable '
        + 'row identity.',
      implication: 'Sometimes deliberate. A partial unique index is a real alternative where '
        + 'the uniqueness only holds for some rows, and this cannot tell the two apart.',
      recommendation: 'Check each one. Where the absence is deliberate, the reason belongs in '
        + 'a comment beside the table so the next reader does not re-litigate it.',
      rationale: 'Both inline `primary key` and a table-level `primary key (a, b)` are counted, '
        + 'so a composite key on a join table is not reported here.',
      requiresManualValidation: true,
      evidence: noPk.map((t) => ({
        kind: 'file' as const,
        path: t.file,
        description: `${t.name} has ${t.columns.length} columns and no primary key clause.`,
      })),
      claudeCodePrompts: [],
    })
  }

  // ── Tables the code never names ──
  const unreferenced = unreferencedTables(m, files)
  if (unreferenced.length > 0) {
    out.push({
      id: 'DATA-004',
      category: CATEGORY,
      ...computed,
      title: `${unreferenced.length} table(s) are never named in the application code`,
      summary: 'These tables exist in the migrations and no source file mentions them by name.',
      severity: 'info',
      confidence: 'low',
      // Low on purpose. A table reached through a view, a database function, a
      // generated client or a string built at runtime is invisible to a search
      // for its name, and calling one of those dead would be wrong.
      confidenceScore: 0.45,
      type: 'observation',
      status: 'open',
      impact: 'Possibly unused, possibly reached a way this cannot see.',
      implication: 'Not evidence that the table is dead. It is a list worth walking, not a '
        + 'list to act on.',
      recommendation: 'Check whether each is reached through a view, a function, or a query '
        + 'built at runtime before concluding anything.',
      rationale: 'Searched the source for each table name. A match anywhere counts, so this '
        + 'errs towards saying a table IS used.',
      requiresManualValidation: true,
      evidence: [{
        kind: 'static_analysis' as const,
        description: `Not found in source: ${unreferenced.slice(0, 20).join(', ')}`
          + (unreferenced.length > 20 ? ` and ${unreferenced.length - 20} more.` : '.'),
      }],
      claudeCodePrompts: [],
    })
  }

  // ── Sensitive columns, as an inventory for the sections that own them ──
  const sensitive = sensitiveColumns(m)
  if (sensitive.length > 0) {
    out.push({
      id: 'DATA-005',
      category: CATEGORY,
      ...computed,
      title: `${sensitive.length} column(s) hold personal or credential-shaped data`,
      summary: 'Named so the sections that carry the obligations can be read against the '
        + 'schema they apply to.',
      severity: 'info',
      confidence: 'high',
      confidenceScore: 0.8,
      type: 'observation',
      status: 'open',
      impact: 'None on its own. What must be done about these columns is Compliance\'s '
        + 'question and how they are protected is Security QA\'s.',
      implication: 'This section states where the data is. It does not judge the handling of '
        + 'it, and a reader should not take the absence of a finding here as approval.',
      recommendation: 'Read alongside Compliance and Security QA rather than on its own.',
      rationale: 'Column names matched against a fixed list of the ones that carry personal or '
        + 'credential data. A column called `name` is not on that list, because it appears on '
        + 'every table in every database and means nothing by itself.',
      evidence: sensitive.slice(0, 15).map((s) => ({
        kind: 'file' as const,
        path: s.file,
        description: `${s.table}.${s.column}`,
      })),
      claudeCodePrompts: [],
    })
  }

  return out
}

export const dataArchitectureAnalyzer = (): SectionAnalyzer => ({
  category: CATEGORY,
  async run(ctx): Promise<ReportSectionResult> {
    const model = readDataModel(ctx.files)

    if (model.unverified) {
      return {
        category: CATEGORY,
        status: 'not_applicable',
        score: null,
        summary: 'No migration or schema file was found, so the data model could not be read.',
        // Not "this product has no database": a schema managed by an ORM at
        // runtime, or held outside the repository, leaves nothing here to read
        // and is not the same as having no data.
        reason: 'No .sql file under a migrations, db, database, sql or schema directory. '
          + 'A schema defined by an ORM at runtime or held outside this repository would '
          + 'look the same, so this is "not read" rather than "not present".',
        findings: [],
        limitations: [],
      }
    }

    const findings = dataArchitectureFindings(model, ctx.files)

    return {
      category: CATEGORY,
      status: 'completed',
      score: null,
      summary: `${model.tables.length} tables across ${model.migrations.length} migrations, `
        + `with ${foreignKeys(model).length} references between them.`,
      findings,
      limitations: [
        'Migrations are read in filename order and applied cumulatively, so a table\'s column '
        + 'list is the union of everything ever added to it. A column dropped, renamed or '
        + 'retyped by a later migration still appears here.',
        'Views, functions, triggers and policies are not parsed. A table reached only through '
        + 'one of those looks unused to this section.',
        'Row-level security and policies are Security QA\'s; consent, retention and data rights '
        + 'are Compliance\'s. Neither is reported here, so the absence of a finding in this '
        + 'section says nothing about either.',
        'Nothing was executed and no database was connected to. This is the schema as the '
        + 'migrations describe it, not as any deployed database actually stands.',
      ],
    }
  },
})
