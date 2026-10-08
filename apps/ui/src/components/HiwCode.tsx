/**
 * How FlowCode works: faint code being written on the left of each stage's illustration, with editor line numbers.
 * Each stage types its own short snippet, line by line, then starts again. Decoration only (hidden from screen
 * readers); with reduced motion the lines simply show.
 */
const SNIPPETS: Record<string, string[]> = {
  prd: ["# Booking calendar", "", "## Who it's for", "Studio owners taking", "  class bookings", "", "## Must have", "- Week view", "- Book and cancel"],
  start: ["$ flowcode new", "  ? Local or cloud: Local", "  ? Autonomy: Ask first", "✓ project created", "✓ PRD attached", "✓ models ready"],
  plan: ['{ "tasks": [', '  { "id": "t1",', '    "title": "Seed data" },', '  { "id": "t2",', '    "dependsOn": ["t1"] }', "] }"],
  build: ['import { createCollection }', '  from "./sim";', "", "export const bookings =", '  createCollection("bookings",', "    seedBookings);", "", "export function WeekView() {"],
  check: ["$ npm run build", "✓ typecheck passed", "✓ 4 screens captured", "✓ look check passed", "✓ links all work", "  done in 38s"],
  launch: ["## Launch readiness", "✓ States for every screen", "✓ Accessible names", "□ Real sign-in", "□ Real database", "□ Payments"],
};

export function HiwCode({ id }: { id: string }) {
  const lines = SNIPPETS[id] ?? SNIPPETS.build!;
  return (
    <div className="hiw-code" aria-hidden="true" style={{ ["--n" as string]: lines.length }}>
      {lines.map((l, i) => (
        <div key={`${id}-${i}`} className="hiw-code__line" style={{ ["--i" as string]: i }}>
          <span className="hiw-code__num">{i + 1}</span>
          <span className="hiw-code__text">{l || " "}</span>
        </div>
      ))}
    </div>
  );
}
