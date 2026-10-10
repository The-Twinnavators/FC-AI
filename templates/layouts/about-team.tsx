/**
 * Layout: About, "team" version. The mission in two sentences, the people behind it and how to get in touch. Good
 * for organizations, clubs and services where people matter.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the spec's real mission, people and contact details. Remove the
 *     "flowcode:sample" comment when nothing sample is left. Never invent people or quotes.
 *  2. Delete sections the spec doesn't need.
 *  3. Keep the building blocks and tokens. Change spacing or colors in src/styles/tokens.css, not here.
 */
import { Avatar, Card, Grid, PageHeader, Section, SettingRow, SettingsList, Stat } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  title: "About us",
  description: "We help neighbours share tools and skills, so less gets bought and more gets fixed.",
  numbers: [
    { label: "Members", value: "1,240" },
    { label: "Items shared", value: "3,800" },
    { label: "Years running", value: "4" },
  ],
  team: [
    { name: "Ada Brooks", role: "Founder", bio: "Started the first tool library in her garage." },
    { name: "Ravi Patel", role: "Community lead", bio: "Runs the monthly repair cafe." },
    { name: "Mei Tanaka", role: "Volunteer coordinator", bio: "Matches new members with helpers." },
  ],
  contact: [
    { label: "Email", value: "hello@example.org" },
    { label: "Opening hours", value: "Saturdays, 10am to 2pm" },
  ],
};

export default function AboutScreen() {
  const data = SAMPLE;
  return (
    <>
      <PageHeader title={data.title} description={data.description} />
      <Grid kind="stats" as="ul" label="In numbers">
        {data.numbers.map((n) => (
          <li key={n.label}>
            <Stat label={n.label} value={n.value} />
          </li>
        ))}
      </Grid>
      <Section title="The team">
        <Grid kind="cards" as="ul" label="The team">
          {data.team.map((p) => (
            <Card key={p.name} as="li" title={p.name}>
              <Avatar name={p.name} size="lg" />
              <strong>{p.role}</strong>
              <p>{p.bio}</p>
            </Card>
          ))}
        </Grid>
      </Section>
      <Section title="Get in touch">
        <SettingsList>
          {data.contact.map((c) => (
            <SettingRow key={c.label} label={c.label}>
              {(p) => (
                <output {...p} className="ui-setting__desc">
                  {c.value}
                </output>
              )}
            </SettingRow>
          ))}
        </SettingsList>
      </Section>
    </>
  );
}
