/**
 * Layout: Pricing, "cards" version. Two to four plans side by side with a monthly/yearly switch and one recommended
 * plan. Good when plans differ in a few clear ways.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the spec's real plans, prices and features. Remove the "flowcode:sample"
 *     comment when nothing sample is left.
 *  2. Delete sections the spec doesn't need. Payment itself is out of scope: buttons go to the next real step.
 *  3. Keep the building blocks and tokens. Change spacing or colours in src/styles/tokens.css, not here.
 */
import { useState } from "react";
import { Badge, Button, Card, Checklist, Grid, PageHeader, Section, SettingRow, Switch } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  title: "Choose a plan",
  description: "Start free and upgrade when you need more. Change or cancel any time.",
  yearlyNote: "Save 2 months with yearly billing",
  plans: [
    { id: "free", name: "Free", monthly: 0, yearly: 0, for: "For trying it out", features: ["Up to 3 projects", "Basic reports", "Email support"], recommended: false, cta: "Start free" },
    { id: "plus", name: "Plus", monthly: 12, yearly: 120, for: "For regular use", features: ["Unlimited projects", "Full reports", "Priority support", "Export your data"], recommended: true, cta: "Choose Plus" },
    { id: "team", name: "Team", monthly: 29, yearly: 290, for: "For small groups", features: ["Everything in Plus", "Up to 10 people", "Shared workspaces"], recommended: false, cta: "Choose Team" },
  ],
};

export default function PricingScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const data = SAMPLE;
  const [yearly, setYearly] = useState(false);
  return (
    <>
      <PageHeader title={data.title} description={data.description} />
      <SettingRow label="Pay yearly" description={data.yearlyNote}>
        {(p) => <Switch {...p} checked={yearly} onChange={setYearly} />}
      </SettingRow>
      <Section title="Plans">
        <Grid kind="cards" as="ul" label="Plans">
          {data.plans.map((plan) => (
            <Card
              key={plan.id}
              as="li"
              title={plan.name}
              footer={
                <Button variant={plan.recommended ? "primary" : "secondary"} onClick={() => onNavigate?.(`plan-${plan.id}`)}>
                  {plan.cta}
                </Button>
              }
            >
              {plan.recommended ? <Badge tone="accent">Most popular</Badge> : null}
              <strong>{plan.monthly === 0 ? "Free" : yearly ? `$${plan.yearly} / year` : `$${plan.monthly} / month`}</strong>
              <p>{plan.for}</p>
              <Checklist label={`${plan.name} includes`} items={plan.features.map((f) => ({ id: f, title: f, done: true }))} />
            </Card>
          ))}
        </Grid>
      </Section>
    </>
  );
}
