// Reading a schema out of its migrations.
//
// Every case in the first block is a shape taken from a real migration
// directory that an earlier version of this parser got wrong. They matter more
// than the ones it got right: a section that reports a composite-keyed join
// table as having no primary key is one a reader disproves in thirty seconds,
// and they discount everything else in it afterwards.

import { describe, it, expect } from 'vitest'
import {
  readDataModel, foreignKeys, sensitiveColumns, unreferencedTables,
} from '../../../src/flowReport/analyzers/dataModel.js'

const sql = (text: string, path = 'supabase/migrations/001_test.sql') => [{ path, text }]

describe('shapes an earlier parser got wrong', () => {
  // `PRIMARY KEY (service_id, staff_id)` sits at the table level, and skipping
  // table-level clauses reported the table as having no key at all.
  it('finds a composite primary key declared at table level', () => {
    const m = readDataModel(sql(`
      create table public.service_staff (
        service_id uuid not null references public.services(id) on delete cascade,
        staff_id uuid not null references public.staff_members(id) on delete cascade,
        primary key (service_id, staff_id)
      );
    `))
    expect(m.tables[0]!.hasPrimaryKey).toBe(true)
  })

  // A comment carrying a comma split the column list mid-comment, and the
  // column after it was lost along with its primary key.
  it('is not confused by a comma inside a comment', () => {
    const m = readDataModel(sql(`
      create table public.platform_event_registry (
        -- e.g. 'clicked_upgrade_button', 'opened_lookbook'.
        name text primary key,
        label text not null default ''
      );
    `))
    const t = m.tables[0]!
    expect(t.columns.map((c) => c.name)).toEqual(['name', 'label'])
    expect(t.hasPrimaryKey).toBe(true)
  })

  // A primary key is indexed in Postgres. Counting only CREATE INDEX called
  // `id uuid primary key references auth.users(id)` an unindexed join.
  it('does not call a primary key an unindexed foreign key', () => {
    const m = readDataModel(sql(`
      create table public.profiles (
        id uuid primary key references auth.users(id) on delete cascade,
        email text not null
      );
    `))
    expect(foreignKeys(m)[0]!.indexed).toBe(true)
  })

  it('treats a unique column as indexed too', () => {
    const m = readDataModel(sql(`
      create table public.a (
        id uuid primary key,
        owner_id uuid unique references public.b(id) on delete cascade
      );
    `))
    expect(foreignKeys(m).find((f) => f.from.column === 'owner_id')!.indexed).toBe(true)
  })
})

describe('what it reads', () => {
  const m = readDataModel(sql(`
    create table if not exists public.orders (
      id uuid primary key,
      customer_id uuid not null references public.customers(id) on delete cascade,
      reviewer_id uuid references public.customers(id),
      total numeric(10,2) not null default 0,
      status text check (status in ('new','paid','void'))
    );
    create index idx_orders_customer on public.orders (customer_id);
  `))

  it('reads the columns without tripping on a type that contains a comma', () => {
    expect(m.tables[0]!.columns.map((c) => c.name))
      .toEqual(['id', 'customer_id', 'reviewer_id', 'total', 'status'])
  })

  it('does not treat a check constraint as a column', () => {
    expect(m.tables[0]!.columns.some((c) => c.name.toLowerCase() === 'check')).toBe(false)
  })

  it('reads the delete behaviour where it is stated', () => {
    const fk = foreignKeys(m).find((f) => f.from.column === 'customer_id')!
    expect(fk.onDelete).toBe('cascade')
    expect(fk.to.table).toBe('customers')
  })

  // The absence is the finding: Postgres defaults to NO ACTION, and a
  // reference that never chose is different from one that chose that.
  it('reports a missing delete behaviour as null, not as a default', () => {
    expect(foreignKeys(m).find((f) => f.from.column === 'reviewer_id')!.onDelete).toBeNull()
  })

  it('matches an index to the column it leads with', () => {
    expect(foreignKeys(m).find((f) => f.from.column === 'customer_id')!.indexed).toBe(true)
    expect(foreignKeys(m).find((f) => f.from.column === 'reviewer_id')!.indexed).toBe(false)
  })
})

describe('sensitive columns are named, not guessed at', () => {
  const m = readDataModel(sql(`
    create table public.people (
      id uuid primary key,
      email text,
      name text,
      display_name text,
      phone text
    );
  `))

  it('finds the ones that carry personal data', () => {
    expect(sensitiveColumns(m).map((s) => s.column).sort()).toEqual(['email', 'phone'])
  })

  // `name` is on every table in every database and means nothing by itself.
  it('does not treat a name column as personal data', () => {
    expect(sensitiveColumns(m).some((s) => s.column.includes('name'))).toBe(false)
  })
})

describe('tables the code never names', () => {
  const m = readDataModel(sql(`
    create table public.used_table (id uuid primary key);
    create table public.quiet_table (id uuid primary key);
  `))

  it('lists only the ones absent from the source', () => {
    const files = [
      { path: 'supabase/migrations/001_test.sql', text: '' },
      { path: 'src/app.ts', text: "const rows = await db.from('used_table').select()" },
    ]
    expect(unreferencedTables(m, files)).toEqual(['quiet_table'])
  })
})

describe('no schema at all', () => {
  it('reports that nothing was read rather than that nothing exists', () => {
    const m = readDataModel([{ path: 'src/app.ts', text: 'export const x = 1' }])
    expect(m.unverified).toBe(true)
    expect(m.tables).toEqual([])
  })

  // A .sql file outside a migrations directory is as likely to be a seed, a
  // fixture or a one-off query as it is to be the schema.
  it('only reads sql from a migrations-shaped directory', () => {
    const m = readDataModel([
      { path: 'scratch/query.sql', text: 'create table public.nope (id uuid primary key);' },
    ])
    expect(m.tables).toEqual([])
  })
})
