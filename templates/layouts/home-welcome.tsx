/**
 * Layout: Home, "welcome" version. A clear welcome with one main action, a side panel showing what the app does,
 * then the main tasks as large tiles and a short "how it works". Good as the first screen of most apps.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the spec's real product name, promise, tasks and steps. Point each tile at a
 *     real screen id. Remove the "flowcode:sample" comment when nothing sample is left.
 *  2. Delete any section the spec doesn't need. This screen uses <Hero> for its one h1 instead of <PageHeader>.
 *  3. Keep the building blocks and tokens. Change spacing or colours in src/styles/tokens.css, not here.
 */
import { ActionTile, Button, Card, Grid, Hero, Progress, Section } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Welcome",
  title: "Plan your week in minutes",
  description: "Add what's coming up, see it all in one place and get a nudge before it's due.",
  primary: { label: "Get started", screen: "add" },
  secondary: { label: "See how it works", screen: "help" },
  preview: { title: "This week", items: [{ label: "Tasks done", value: 3, max: 5, text: "3 of 5" }, { label: "On track", value: 80, max: 100, text: "80%" }] },
  tasks: [
    { title: "Add something", description: "Create a new entry in a few taps.", screen: "add", icon: "+" },
    { title: "See your week", description: "Everything coming up, by day.", screen: "week", icon: "▦" },
    { title: "Check progress", description: "What you've finished so far.", screen: "progress", icon: "✓" },
  ],
  steps: [
    { title: "Add", text: "Tell the app what's coming up." },
    { title: "Plan", text: "See it laid out by day and week." },
    { title: "Finish", text: "Tick things off and watch your progress grow." },
  ],
};

export default function HomeScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const data = SAMPLE;
  const go = (screen: string) => onNavigate?.(screen);
  return (
    <>
      <Hero
        eyebrow={data.eyebrow}
        title={data.title}
        description={data.description}
        actions={
          <>
            <Button variant="primary" size="lg" onClick={() => go(data.primary.screen)}>
              {data.primary.label}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => go(data.secondary.screen)}>
              {data.secondary.label}
            </Button>
          </>
        }
        aside={
          <Card title={data.preview.title}>
            {data.preview.items.map((i) => (
              <Progress key={i.label} label={i.label} value={i.value} max={i.max} valueText={i.text} />
            ))}
          </Card>
        }
      />

      <Section title="What would you like to do?">
        <Grid kind="cards">
          {data.tasks.map((t) => (
            <ActionTile key={t.title} title={t.title} description={t.description} icon={t.icon} onClick={() => go(t.screen)} />
          ))}
        </Grid>
      </Section>

      <Section title="How it works">
        <Grid kind="cards" as="ul" label="How it works">
          {data.steps.map((s, i) => (
            <li key={s.title}>
              <Card title={`${i + 1}. ${s.title}`}>
                <p>{s.text}</p>
              </Card>
            </li>
          ))}
        </Grid>
      </Section>
    </>
  );
}
