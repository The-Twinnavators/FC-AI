/**
 * Layout: Dashboard, "overview" version. Key numbers with trends, a weekly chart beside recent activity, then a table.
 * Good for apps that track amounts, items or orders over time.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the app's real data (from its state, storage or src/content/), using the
 *     spec's words for titles and labels. Remove the "flowcode:sample" comment when nothing sample is left.
 *  2. Delete any section the spec doesn't need. Keep the order: what matters most comes first.
 *  3. Keep the building blocks and tokens. Change spacing or colours in src/styles/tokens.css, not here.
 */
import { ActivityList, BarChart, Badge, Button, Card, DataTable, EmptyState, Grid, PageHeader, Section, Stat, Trend } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  title: "Overview",
  description: "How things are going this week, and what changed recently.",
  stats: [
    { label: "Total this week", value: "$1,284", trend: 12.5 },
    { label: "Items added", value: "48", trend: 8.2 },
    { label: "Completed", value: "92%", trend: -2.4 },
    { label: "Open items", value: "7", trend: 0 },
  ],
  week: [
    { label: "Mon", value: 120 },
    { label: "Tue", value: 180 },
    { label: "Wed", value: 150 },
    { label: "Thu", value: 240 },
    { label: "Fri", value: 210 },
    { label: "Sat", value: 90 },
    { label: "Sun", value: 130 },
  ],
  activity: [
    { id: "a1", who: "Sam Rivera", what: "added a new item", when: "2 minutes ago" },
    { id: "a2", who: "Priya Shah", what: "finished a task", when: "45 minutes ago" },
    { id: "a3", who: "Alex Kim", what: "updated a record", when: "3 hours ago" },
  ],
  rows: [
    { id: "r1", name: "First item", status: "Done", date: "12 May", amount: "$450.00" },
    { id: "r2", name: "Second item", status: "In progress", date: "11 May", amount: "$1,200.00" },
    { id: "r3", name: "Third item", status: "Done", date: "10 May", amount: "$85.00" },
  ],
};

type Row = (typeof SAMPLE.rows)[number];

export default function DashboardScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const data = SAMPLE;
  return (
    <>
      <PageHeader title={data.title} description={data.description} action={<Button variant="primary" onClick={() => onNavigate?.("add")}>Add item</Button>} />

      <Grid kind="stats" as="ul" label="Key numbers">
        {data.stats.map((s) => (
          <li key={s.label}>
            <Stat label={s.label} value={s.value} note={<Trend value={s.trend} label="vs last week" />} />
          </li>
        ))}
      </Grid>

      <Grid kind="split">
        <Card title="This week">
          <BarChart title="Total per day" data={data.week} format={(n) => `$${n}`} />
        </Card>
        <Card title="Recent activity">
          {data.activity.length ? <ActivityList items={data.activity} /> : <EmptyState title="Nothing yet" message="Activity shows here as soon as something changes." />}
        </Card>
      </Grid>

      <Section title="Latest items" description="The most recent entries, newest first.">
        <DataTable<Row>
          caption="Latest items"
          showCaption={false}
          rowKey={(r) => r.id}
          rows={data.rows}
          columns={[
            { key: "name", label: "Name" },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Done" ? "success" : "neutral"}>{r.status}</Badge> },
            { key: "date", label: "Date" },
            { key: "amount", label: "Amount", align: "end" },
          ]}
          empty={<EmptyState title="No items yet" message="Add your first item to see it here." />}
        />
      </Section>
    </>
  );
}
