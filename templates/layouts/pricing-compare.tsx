/**
 * Layout: Pricing, "compare" version. Plan summaries on top and a full feature comparison table below. Good when
 * plans differ in many details people want to check.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the spec's real plans and features. Remove the "flowcode:sample" comment
 *     when nothing sample is left.
 *  2. Delete sections the spec doesn't need. Payment itself is out of scope: buttons go to the next real step.
 *  3. Keep the building blocks and tokens. Change spacing or colours in src/styles/tokens.css, not here.
 */
import { Badge, Button, DataTable, Grid, PageHeader, Section, Stat } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  title: "Compare plans",
  description: "Every plan includes the core features. Here is exactly what each one adds.",
  plans: [
    { id: "basic", name: "Basic", price: "$0", note: "Free forever", recommended: false },
    { id: "pro", name: "Pro", price: "$12", note: "per month", recommended: true },
    { id: "business", name: "Business", price: "$29", note: "per month", recommended: false },
  ],
  features: [
    { id: "f1", feature: "Projects", basic: "3", pro: "Unlimited", business: "Unlimited" },
    { id: "f2", feature: "Reports", basic: "Basic", pro: "Full", business: "Full" },
    { id: "f3", feature: "Data export", basic: "No", pro: "Yes", business: "Yes" },
    { id: "f4", feature: "People", basic: "1", pro: "1", business: "Up to 10" },
    { id: "f5", feature: "Support", basic: "Email", pro: "Priority", business: "Priority" },
  ],
};

type Row = (typeof SAMPLE.features)[number];

export default function PricingScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const data = SAMPLE;
  return (
    <>
      <PageHeader title={data.title} description={data.description} />
      <Grid kind="stats" as="ul" label="Plans">
        {data.plans.map((p) => (
          <li key={p.id}>
            <Stat label={p.name} value={p.price} note={p.recommended ? <Badge tone="accent">Recommended</Badge> : p.note} />
          </li>
        ))}
      </Grid>
      <Section title="What each plan includes">
        <DataTable<Row>
          caption="Plan comparison"
          showCaption={false}
          rowKey={(r) => r.id}
          rows={data.features}
          columns={[
            { key: "feature", label: "Feature" },
            ...data.plans.map((p) => ({ key: p.id, label: p.name })),
          ]}
        />
      </Section>
      <Section title="Ready to choose?">
        <div>
          {data.plans
            .filter((p) => p.recommended)
            .map((p) => (
              <Button key={p.id} variant="primary" onClick={() => onNavigate?.(`plan-${p.id}`)}>
                Choose {p.name}
              </Button>
            ))}
        </div>
      </Section>
    </>
  );
}
