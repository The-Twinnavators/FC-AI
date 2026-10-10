/**
 * Layout: Home, "returning" version. Greets the user, puts "continue where you left off" first, then today's list
 * and shortcuts. Good for apps people open every day (habits, lessons, journals, to-do lists).
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the app's real data and the spec's words. Point each shortcut at a real
 *     screen id. Remove the "flowcode:sample" comment when nothing sample is left.
 *  2. Delete any section the spec doesn't need. Show the EmptyState for a brand-new user with nothing to continue.
 *  3. Keep the building blocks and tokens. Change spacing or colors in src/styles/tokens.css, not here.
 */
import { ActionTile, Button, Card, Checklist, EmptyState, Grid, PageHeader, Progress, Section } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  greeting: "Welcome back",
  description: "Pick up where you left off, or choose something new.",
  current: { title: "Saving for a goal", detail: "Lesson 3 of 5", value: 60, text: "60% done", screen: "lesson" },
  today: [
    { id: "t1", title: "Finish today's lesson", meta: "5 minutes", done: false },
    { id: "t2", title: "Check your weekly goal", meta: "1 minute", done: true },
    { id: "t3", title: "Try a quick quiz", meta: "3 minutes", done: false },
  ],
  shortcuts: [
    { title: "Browse lessons", description: "See everything you can learn.", screen: "lessons", icon: "▤" },
    { title: "Your progress", description: "Streaks, points and badges.", screen: "progress", icon: "↗" },
  ],
};

export default function HomeScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const data = SAMPLE;
  const go = (screen: string) => onNavigate?.(screen);
  return (
    <>
      <PageHeader title={data.greeting} description={data.description} />

      <Section title="Continue">
        {data.current ? (
          <Card
            footer={
              <Button variant="primary" onClick={() => go(data.current.screen)}>
                Continue
              </Button>
            }
          >
            <strong>{data.current.title}</strong>
            <Progress label={data.current.detail} value={data.current.value} valueText={data.current.text} />
          </Card>
        ) : (
          <EmptyState title="Nothing in progress" message="Choose something to start. Your place is saved automatically." action={<Button variant="primary" onClick={() => go("lessons")}>Choose one</Button>} />
        )}
      </Section>

      <Grid kind="split">
        <Section title="Today">
          <Card>
            <Checklist label="Today" items={data.today} />
          </Card>
        </Section>
        <Section title="Shortcuts">
          <Grid kind="cards">
            {data.shortcuts.map((s) => (
              <ActionTile key={s.title} title={s.title} description={s.description} icon={s.icon} onClick={() => go(s.screen)} />
            ))}
          </Grid>
        </Section>
      </Grid>
    </>
  );
}
