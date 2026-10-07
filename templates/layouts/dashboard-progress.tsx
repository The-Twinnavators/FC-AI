/**
 * Layout: Dashboard, "progress" version. Where the user stands, their goals, what to do next and recent wins.
 * Good for learning, habit, fitness, savings and other goal-based apps.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the app's real data (from its state, storage or src/content/), using the
 *     spec's words for titles and labels. Remove the "flowcode:sample" comment when nothing sample is left.
 *  2. Delete any section the spec doesn't need. Keep the order: what matters most comes first.
 *  3. Keep the building blocks and tokens. Change spacing or colours in src/styles/tokens.css, not here.
 */
import { ActivityList, Badge, Button, Card, EmptyState, Grid, PageHeader, Progress, Section, Stat, Trend } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  title: "Your progress",
  description: "See how far you've come and pick what to do next.",
  stats: [
    { label: "Current streak", value: "6 days", trend: 2, unit: " days" },
    { label: "Completed", value: "14", trend: 3, unit: "" },
    { label: "Points earned", value: "1,240", trend: 15, unit: "%" },
  ],
  goals: [
    { id: "g1", label: "Weekly goal", value: 4, max: 5, text: "4 of 5 done" },
    { id: "g2", label: "Level 2", value: 65, max: 100, text: "65%" },
    { id: "g3", label: "Savings target", value: 120, max: 200, text: "$120 of $200" },
  ],
  next: { title: "Up next: Budget basics", detail: "About 5 minutes. Builds on what you finished yesterday.", tag: "Recommended" },
  wins: [
    { id: "w1", who: "You", what: "finished a lesson", when: "Today" },
    { id: "w2", who: "You", what: "reached a 5-day streak", when: "Yesterday" },
    { id: "w3", who: "You", what: "earned a new badge", when: "2 days ago" },
  ],
};

export default function DashboardScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const data = SAMPLE;
  return (
    <>
      <PageHeader title={data.title} description={data.description} action={<Button variant="primary" onClick={() => onNavigate?.("next")}>Continue</Button>} />

      <Grid kind="stats" as="ul" label="Key numbers">
        {data.stats.map((s) => (
          <li key={s.label}>
            <Stat label={s.label} value={s.value} note={<Trend value={s.trend} unit={s.unit} label="this week" />} />
          </li>
        ))}
      </Grid>

      <Grid kind="split">
        <Section title="Goals" description="Your targets and how close you are.">
          <Card>
            {data.goals.map((g) => (
              <Progress key={g.id} label={g.label} value={g.value} max={g.max} valueText={g.text} />
            ))}
          </Card>
        </Section>
        <Section title="Next step">
          <Card footer={<Button variant="primary" onClick={() => onNavigate?.("next")}>Start</Button>}>
            <Badge tone="accent">{data.next.tag}</Badge>
            <strong>{data.next.title}</strong>
            <p>{data.next.detail}</p>
          </Card>
        </Section>
      </Grid>

      <Section title="Recent wins">
        <Card>{data.wins.length ? <ActivityList items={data.wins} label="Recent wins" /> : <EmptyState title="No wins yet" message="Finish your first step and it will show here." />}</Card>
      </Section>
    </>
  );
}
