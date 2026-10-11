/**
 * Layout: List, "rows" version. Many records compared field by field: orders, entries, requests, logs. The table
 * carries the detail, search and filters narrow it, and the count says what is showing. Good when people scan down
 * a column rather than judge each item on its own.
 *
 * To make it this app's own:
 *  1. Replace SAMPLE with the app's real records (from its state, storage or src/content/) and change COLUMNS to the
 *     fields the spec names. Remove the "flowcode:sample" comment when nothing sample is left.
 *  2. Keep search, filters and the count working together: the count follows what is showing, and clearing a filter
 *     brings rows back. A column nobody reads is better removed than kept.
 *  3. Keep the building blocks and tokens. Change spacing or colors in src/styles/tokens.css, not here.
 */
import { useMemo, useState } from "react";
import { Badge, Button, DataTable, EmptyState, Field, PageHeader, Section, type Column } from "../components/ui";

// flowcode:sample
interface Row extends Record<string, unknown> {
  id: string;
  name: string;
  status: "open" | "done" | "waiting";
  owner: string;
  updated: string;
}

// flowcode:sample
const SAMPLE = {
  title: "Requests",
  description: "Everything in progress, most recently updated first.",
  statuses: [
    { id: "open", label: "Open" },
    { id: "waiting", label: "Waiting" },
    { id: "done", label: "Done" },
  ],
  rows: [
    { id: "1", name: "Replace the back gate", status: "open", owner: "Sam", updated: "2 hours ago" },
    { id: "2", name: "Quarterly supplier review", status: "waiting", owner: "Priya", updated: "Yesterday" },
    { id: "3", name: "Fix the loading dock light", status: "done", owner: "Alex", updated: "3 days ago" },
    { id: "4", name: "Order new safety signage", status: "open", owner: "Sam", updated: "Last week" },
  ] as Row[],
};

const TONE: Record<Row["status"], "neutral" | "accent" | "success"> = { open: "accent", waiting: "neutral", done: "success" };

export default function ListScreen() {
  const data = SAMPLE;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string[]>([]);

  const toggle = (id: string) => setStatus((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const clear = () => (setQuery(""), setStatus([]));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.rows.filter(
      (row) => (!q || `${row.name} ${row.owner}`.toLowerCase().includes(q)) && (status.length === 0 || status.includes(row.status)),
    );
  }, [data.rows, query, status]);

  const narrowed = query.trim().length > 0 || status.length > 0;

  const columns: Column<Row>[] = [
    { key: "name", label: "What" },
    { key: "status", label: "Status", render: (row) => <Badge tone={TONE[row.status]}>{data.statuses.find((s) => s.id === row.status)?.label ?? row.status}</Badge> },
    { key: "owner", label: "Who" },
    { key: "updated", label: "Updated", align: "end" },
  ];

  return (
    <>
      <PageHeader title={data.title} description={data.description} />

      <Section
        title="Narrow it down"
        description="Search and filters work together; the count below follows what is showing."
        action={narrowed ? <Button onClick={clear}>Clear all</Button> : undefined}
      >
        <Field label={`Search ${data.title.toLowerCase()}`} hint="Matches what it is and who it is for.">
          {(p) => (
            <input {...p} type="search" value={query} placeholder="Start typing…" onChange={(e) => setQuery(e.target.value)} />
          )}
        </Field>

        <div className="ui-row" role="group" aria-label="Status">
          {data.statuses.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={status.includes(s.id) ? "primary" : "secondary"}
              aria-pressed={status.includes(s.id)}
              onClick={() => toggle(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <p className="ui-muted" aria-live="polite">
          {shown.length} of {data.rows.length} showing
        </p>
      </Section>

      <Section title={`All ${data.title.toLowerCase()}`}>
        <DataTable
          caption={`${data.title}, ${shown.length} showing`}
          columns={columns}
          rows={shown}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              title={narrowed ? "Nothing matches those filters" : `No ${data.title.toLowerCase()} yet`}
              message={
                narrowed
                  ? "Try a different search, or clear the filters to see everything again."
                  : "When something is added it will show up here."
              }
              action={narrowed ? <Button variant="primary" onClick={clear}>Clear all</Button> : undefined}
            />
          }
        />
      </Section>
    </>
  );
}
