/**
 * Layout: About, "story" version. Why the product exists, what it believes and how it started, with one next step.
 * Good for small products and personal projects.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the spec's real mission, values and story. Remove the "flowcode:sample"
 *     comment when nothing sample is left. Never invent facts, quotes or numbers.
 *  2. Delete sections the spec doesn't need.
 *  3. Keep the building blocks and tokens. Change spacing or colors in src/styles/tokens.css, not here.
 */
import { Button, Card, Grid, Hero, Section } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  eyebrow: "About us",
  title: "We make planning feel lighter",
  description: "A small tool for people who want to stay on top of things without another complicated app.",
  values: [
    { title: "Simple first", text: "Every screen does one job, and says plainly what it does." },
    { title: "Yours to keep", text: "Your data stays on your device. Export it any time." },
    { title: "Kind by default", text: "Clear words, gentle reminders, no guilt." },
  ],
  story: [
    "It started as a list on the fridge that kept getting lost.",
    "The first version was built in a weekend for one family. Friends asked for a copy, and it grew from there.",
  ],
  cta: { label: "Get started", screen: "home" },
};

export default function AboutScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const data = SAMPLE;
  return (
    <>
      <Hero eyebrow={data.eyebrow} title={data.title} description={data.description} actions={<Button variant="primary" onClick={() => onNavigate?.(data.cta.screen)}>{data.cta.label}</Button>} />
      <Section title="What we believe">
        <Grid kind="cards" as="ul" label="What we believe">
          {data.values.map((v) => (
            <Card key={v.title} as="li" title={v.title}>
              <p>{v.text}</p>
            </Card>
          ))}
        </Grid>
      </Section>
      <Section title="How it started">
        <Card>
          {data.story.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Card>
      </Section>
    </>
  );
}
