/**
 * Faint code behind a call-to-action banner: decoration only (hidden from screen readers), the kind of code a
 * FlowCode prototype is made of, fading out towards the middle so the heading and buttons stay clear.
 */
const LEFT = `import { createCollection } from "./sim";
import { useSavedState } from "./sim/state";

export const tasks = createCollection("tasks", [
  { id: "t1", title: "Sketch the flow", done: true },
  { id: "t2", title: "Build the first screen", done: false },
]);

export function TaskList() {
  const [filter, setFilter] = useSavedState("filter", "all");
  const items = tasks.useAll().filter((t) =>
    filter === "all" ? true : t.done === (filter === "done"));
  return (
    <ul className="task-list">
      {items.map((t) => <TaskRow key={t.id} task={t} />)}
    </ul>
  );
}`;

const RIGHT = `// plan.json: checked step by step
{
  "objective": "A calendar people can book from",
  "tasks": [
    { "id": "t1", "title": "Data and seed bookings",
      "acceptance": [{ "type": "file_exists",
        "path": "src/sim/bookings.ts" }] },
    { "id": "t2", "title": "Week view",
      "dependsOn": ["t1"] },
    { "id": "t3", "title": "Booking form and states",
      "dependsOn": ["t2"] }
  ]
}

$ npm run build
✓ 42 modules transformed
✓ typecheck passed · look check passed`;

const NL = String.fromCharCode(10);

/** A block of code with editor-style line numbers down its left side. */
function Numbered({ code, right }: { code: string; right?: boolean }) {
  const lines = code.split(NL);
  return (
    <div className={`code-backdrop__col${right ? " code-backdrop__col--right" : ""}`}>
      <pre className="code-backdrop__nums">{lines.map((_, i) => i + 1).join(NL)}</pre>
      <pre className="code-backdrop__code">{code}</pre>
    </div>
  );
}

export function CodeBackdrop() {
  return (
    <div className="code-backdrop" aria-hidden="true">
      <Numbered code={LEFT} />
      <Numbered code={RIGHT} right />
    </div>
  );
}
