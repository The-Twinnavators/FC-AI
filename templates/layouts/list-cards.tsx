/**
 * Layout: List, "cards" version. A browsable set of things someone chooses between: brands, products, places,
 * people. Search and filters narrow it, the count says what is showing, and the empty state offers a way back.
 * Good when each item is judged on its own and a picture or a few facts help the choice.
 *
 * To make it this app's own:
 *  1. Replace SAMPLE with the app's real records (from its state, storage or src/content/), using the spec's words
 *     for the title, the filters and each field. Remove the "flowcode:sample" comment when nothing sample is left.
 *  2. Keep search, filters and the count working together: the count follows what is showing, and clearing a filter
 *     brings items back. A filter that does nothing must not be shown.
 *  3. Keep the building blocks and tokens. Change spacing or colors in src/styles/tokens.css, not here.
 */
import { useMemo, useState } from "react";
import { Badge, Button, Card, DataState, EmptyState, Field, Grid, PageHeader, Section } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  title: "Brands",
  description: "Everything we have checked, newest first. Search by name or filter by what matters to you.",
  filters: [
    { id: "verified", label: "Verified" },
    { id: "local", label: "Local" },
    { id: "budget", label: "Budget friendly" },
  ],
  items: [
    { id: "1", name: "Meadow & Co", summary: "Family run, sells through independent shops.", tags: ["verified", "local"], note: "Checked this month" },
    { id: "2", name: "Harvest Lane", summary: "Pantry staples with published sourcing.", tags: ["verified", "budget"], note: "Checked this month" },
    { id: "3", name: "Fern Street Foods", summary: "Small batches, seasonal ranges.", tags: ["local"], note: "Checked last month" },
    { id: "4", name: "Oakfield Kitchen", summary: "Ready meals without additives.", tags: ["verified"], note: "Checked last month" },
  ],
};

export default function ListScreen() {
  const data = SAMPLE;
  const [query, setQuery] = useState("");
  const [on, setOn] = useState<string[]>([]);

  const toggle = (id: string) => setOn((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const clear = () => (setQuery(""), setOn([]));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter(
      (item) =>
        (!q || `${item.name} ${item.summary}`.toLowerCase().includes(q)) && on.every((f) => item.tags.includes(f)),
    );
  }, [data.items, query, on]);

  const narrowed = query.trim().length > 0 || on.length > 0;

  return (
    <>
      <PageHeader title={data.title} description={data.description} />

      <Section
        title="Find one"
        description="Search and filters work together; the count below follows what is showing."
        action={narrowed ? <Button onClick={clear}>Clear all</Button> : undefined}
      >
        <Field label={`Search ${data.title.toLowerCase()}`} hint="Matches the name and the summary.">
          {(p) => (
            <input
              {...p}
              type="search"
              value={query}
              placeholder="Start typing…"
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </Field>

        <div className="ui-row" role="group" aria-label="Filters">
          {data.filters.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={on.includes(f.id) ? "primary" : "secondary"}
              aria-pressed={on.includes(f.id)}
              onClick={() => toggle(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <p className="ui-muted" aria-live="polite">
          {shown.length} of {data.items.length} showing
        </p>
      </Section>

      <Section title={`All ${data.title.toLowerCase()}`}>
        <DataState
          empty={
            shown.length === 0 ? (
              <EmptyState
                title={narrowed ? "Nothing matches those filters" : `No ${data.title.toLowerCase()} yet`}
                message={
                  narrowed
                    ? "Try a different search, or clear the filters to see everything again."
                    : "When something is added it will show up here."
                }
                action={narrowed ? <Button variant="primary" onClick={clear}>Clear all</Button> : undefined}
              />
            ) : undefined
          }
        >
          {shown.length > 0 ? (
            <Grid kind="cards" as="ul" label={data.title}>
              {shown.map((item) => (
                <Card key={item.id} as="li" title={item.name} interactive footer={<span className="ui-muted">{item.note}</span>}>
                  <p>{item.summary}</p>
                  {item.tags.length > 0 ? (
                    <p>
                      {item.tags.map((t) => (
                        <Badge key={t} tone="accent">
                          {data.filters.find((f) => f.id === t)?.label ?? t}
                        </Badge>
                      ))}
                    </p>
                  ) : null}
                </Card>
              ))}
            </Grid>
          ) : null}
        </DataState>
      </Section>
    </>
  );
}
