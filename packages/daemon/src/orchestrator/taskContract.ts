/**
 * A step's contract, checked before it runs (reliability phase 2): one coherent deliverable that can be verified on its
 * own. Clean Cart's step 14 asked for all 24 acceptance tests AND two stylesheet rules, said "the only test this step
 * makes pass is the stylesheet-rule check", and was checked by "the test file mentions these words". It ran 692 model
 * calls and never finished.
 *
 * - Writing tests and changing a stylesheet are separate deliverables: such a step is separated into two, in order,
 *   with every check going to exactly one of them (the type check to both).
 * - A test-writing step is done when its tests run (tests-run:<file>): every test loads and runs and each one checks
 *   the app. Most fail until later steps build what they check; that is expected and not weakened.
 * - A step whose checks require every test to pass while its brief says most won't is contradictory: it stops before
 *   any model work, as a task_contract problem, without using an attempt.
 */
import type { Task } from "@flowcode/contracts";

export const TEST_FILE = /(^|\/)(acceptance|__tests__|tests?)\/[^]*\.(test|spec)\.[jt]sx?$|\.(test|spec)\.[jt]sx?$/;
export const STYLE_FILE = /\.(css|scss|sass|less|pcss)$/i;

type Criterion = Task["acceptanceCriteria"][number];
const pathOf = (c: Criterion) => (c.check as { path?: string }).path?.replace(/\\/g, "/");
const kindOf = (c: Criterion) => (c.check as { kind?: string }).kind ?? "";

export interface ContractProblem {
  kind: "mixed_work" | "contradiction";
  detail: string;
}

/** The step's acceptance test file, from its checks or its files. */
export function testFileOf(task: Pick<Task, "expectedPaths" | "acceptanceCriteria">): string | undefined {
  for (const c of task.acceptanceCriteria) {
    const p = pathOf(c);
    if (p && TEST_FILE.test(p)) return p;
    const k = kindOf(c);
    if (k.startsWith("tests:") || k.startsWith("tests-run:")) return k.replace(/^tests(-run)?:/, "").split("::")[0];
  }
  return task.expectedPaths.map((p) => p.replace(/\\/g, "/")).find((p) => TEST_FILE.test(p));
}

/** Writes tests: the step creates or fills a test file (not only runs one). */
const writesTests = (task: Pick<Task, "expectedPaths" | "acceptanceCriteria">) => task.expectedPaths.some((p) => TEST_FILE.test(p.replace(/\\/g, "/"))) || task.acceptanceCriteria.some((c) => !!pathOf(c) && TEST_FILE.test(pathOf(c)!));
const styleFilesOf = (task: Pick<Task, "expectedPaths" | "acceptanceCriteria">) => [...new Set([...task.expectedPaths.map((p) => p.replace(/\\/g, "/")), ...task.acceptanceCriteria.map(pathOf).filter((p): p is string => !!p)].filter((p) => STYLE_FILE.test(p)))];

// "The only test this step makes pass is…", "the others pass in the later steps".
const NOT_ALL_PASS = /\bonly (?:test|one)\b[^.]*\bmakes? pass\b|\bothers? (?:will )?pass in (?:the )?later\b|\bpass(?:es)? in a later step\b|\b(?:don't|do not) (?:need to )?make (?:the|these|its) tests pass\b/i;

export function contractProblems(task: Pick<Task, "objective" | "expectedPaths" | "acceptanceCriteria">): ContractProblem[] {
  const out: ContractProblem[] = [];
  const styles = styleFilesOf(task);
  // Only a step made of nothing but tests and stylesheets: a feature step that builds screens and proves them with its
  // own tests is one deliverable (FIRST write the tests, then build until they pass).
  const onlyTestsAndStyles = task.expectedPaths.every((p) => TEST_FILE.test(p.replace(/\\/g, "/")) || STYLE_FILE.test(p));
  if (writesTests(task) && styles.length && onlyTestsAndStyles) out.push({ kind: "mixed_work", detail: `It both writes the acceptance tests (${testFileOf(task)}) and changes the stylesheet (${styles.join(", ")}): two deliverables, each checked on its own.` });
  const file = testFileOf(task);
  const wholeFile = task.acceptanceCriteria.some((c) => kindOf(c) === `tests:${file}`);
  if (file && wholeFile && !styles.length && NOT_ALL_PASS.test(task.objective)) out.push({ kind: "contradiction", detail: `Its checks require every test in ${file} to pass, but its brief says most of them pass only in later steps.` });
  return out;
}

const STYLE_SENTENCE = /\b(css|stylesheet|style rules?|media query|max-width|min-width|display: ?grid|grid columns?|columns? at|tokens?)\b|\.css\b/i;

/**
 * A step that writes tests and changes a stylesheet, as two steps: the tests first (done when they run), then the
 * stylesheet (done when its tests pass). Every check goes to exactly one of them; the type check to both.
 */
export function separateMixed(task: Task, newId: () => string): [Task, Task] {
  const file = testFileOf(task)!;
  const styles = styleFilesOf(task);
  const [head = "", ...rest] = task.objective.split(/\n\n/);
  const context = rest.join("\n\n");
  const sentences = head.split(/(?<=[.;:])\s+(?=[A-Z`"'])/).filter((s) => s.trim());
  const styleText = sentences.filter((s) => STYLE_SENTENCE.test(s)).join(" ");
  const testText = sentences.filter((s) => !STYLE_SENTENCE.test(s)).join(" ");
  const typecheck = task.acceptanceCriteria.filter((c) => kindOf(c) === "typecheck");
  const forTests = task.acceptanceCriteria.filter((c) => !!pathOf(c) && pathOf(c) === file);
  const forStyles = task.acceptanceCriteria.filter((c) => !forTests.includes(c) && !typecheck.includes(c));
  const [testsId, stylesId] = [newId(), newId()];
  const base = { runId: task.runId, status: "pending" as const, actualPaths: [], validationPlan: task.validationPlan, role: task.role, specSections: task.specSections, attempts: 0 };
  const tests: Task = {
    ...base,
    id: testsId,
    title: `Write the acceptance tests in ${file.split("/").pop()}`,
    objective: [
      testText || `Write the acceptance tests in ${file}.`,
      `Write the tests only: don't change the app or the stylesheet in this step. A test of something a later step builds fails for now; that is expected, so don't weaken it to pass. This step is done when ${file} runs: every test loads and runs, and each one checks the app.`,
      context,
    ].filter(Boolean).join("\n\n"),
    dependsOn: task.dependsOn,
    expectedPaths: [file],
    acceptanceCriteria: [
      ...forTests.map((c) => ({ ...c, id: `${c.id}-t`, evidenceRefs: [] })),
      { id: `${task.id}-run`, description: `The tests in ${file} load and run, and each one checks the app`, check: { type: "verification" as const, kind: `tests-run:${file}` }, evidenceRefs: [] },
      ...typecheck.map((c) => ({ ...c, id: `${c.id}-t`, evidenceRefs: [] })),
    ],
    ordinal: task.ordinal + 1,
  } as Task;
  const styled: Task = {
    ...base,
    id: stylesId,
    title: `Add the stylesheet rules in ${styles.map((s) => s.split("/").pop()).join(" and ")}`,
    objective: [
      styleText || `Add the stylesheet rules this step asks for in ${styles.join(" and ")}.`,
      `Change only ${styles.join(" and ")}. The acceptance tests are already written in ${file} by the step before; don't change them.`,
      context,
    ].filter(Boolean).join("\n\n"),
    dependsOn: [testsId],
    expectedPaths: styles,
    acceptanceCriteria: [...forStyles, ...typecheck].map((c) => ({ ...c, id: `${c.id}-s`, evidenceRefs: [] })),
    ordinal: task.ordinal + 2,
  } as Task;
  return [tests, styled];
}

/** Tests with no expect(…): they pass whatever the app does. */
export function assertionlessTests(src: string): string[] {
  const starts = [...src.matchAll(/\b(?:it|test)\(\s*(["'`])((?:\\.|(?!\1).)+?)\1/g)];
  const out: string[] = [];
  starts.forEach((m, i) => {
    const body = src.slice(m.index!, starts[i + 1]?.index ?? src.length);
    if (!/\bexpect(?:\.\w+)?\(|\bassert\w*\(/.test(body)) out.push(m[2]!);
  });
  return out;
}

/**
 * Whether a test run shows the file runs: tests were collected and ran, and nothing stopped the file from loading (an
 * import that doesn't exist, a syntax error, a name the test never defined). Failing assertions are fine here.
 */
export function runnableVerdict(output: string): { runs: boolean; failed: number; passed: number; why?: string } {
  const out = output.replace(/\x1b\[[0-9;]*m/g, "");
  const failed = Number(/Tests?\s+(\d+)\s+failed/i.exec(out)?.[1] ?? 0);
  // From the "Tests  20 failed | 4 passed (24)" line, not "Test Files  1 passed (1)".
  const passed = Number(/(\d+)\s+passed/i.exec(/(?:^|\n)\s*Tests\s+[^\n]*/i.exec(out)?.[0] ?? "")?.[1] ?? 0);
  // The most specific reason first (vitest prints "Failed Suites 1" before the import that broke it).
  const reasons = [/Failed to resolve import "[^"]+"/i, /Cannot find (?:module|package) '[^']+'/i, /SyntaxError: [^\n]+/i, /ReferenceError: [^\n]+/i, /Transform failed[^\n]*/i, /Failed Suites \d+/i];
  const broken = reasons.map((r) => r.exec(out)?.[0]).find(Boolean) ?? (/no test files found|Tests\s+no tests/i.test(out) ? "no tests ran" : undefined);
  if (broken) return { runs: false, failed, passed, why: broken.slice(0, 200) };
  if (failed + passed === 0) return { runs: false, failed, passed, why: "no tests ran" };
  return { runs: true, failed, passed };
}

/**
 * Checks that say nothing about a step's own deliverable: the project type-checks, lints, builds, or its whole test
 * suite passes. A step judged only by these passes whether or not it did its work (Clean Cart controlled build: "Implement
 * Real Imagery" saved 15 photos, put none on a screen, and passed on the type check; "Design App Frame and Navigation"
 * changed two background lines and passed the same way).
 */
const GENERIC_KINDS = new Set(["typecheck", "lint", "build", "tests"]);

export function isTaskSpecific(c: Criterion): boolean {
  if (c.check.type === "manual") return false;
  if (c.check.type !== "verification") return true;
  return !GENERIC_KINDS.has(kindOf(c));
}

/** A coder step whose machine checks are all generic. */
export function genericOnly(task: Pick<Task, "acceptanceCriteria">): boolean {
  return !task.acceptanceCriteria.some(isTaskSpecific);
}

// The starter kit's building blocks aren't edited by steps, so they never count as a step's own file.
const KIT = /^src\/components\/ui\//;

/**
 * Checks tied to a step's own deliverable, for a step that has only generic ones. Always: the step changed at least
 * one of its own files. From what the step is for: its screens show the photos it saved; its sample data is seeded;
 * its app frame is restyled or replaced. Added openly (the caller records and announces them), never silently.
 */
export function deliverableChecks(task: Pick<Task, "id" | "title" | "objective" | "expectedPaths">): Criterion[] {
  const own = task.expectedPaths.map((p) => p.replace(/\\/g, "/")).filter((p) => /\.[a-z0-9]+$/i.test(p) && !KIT.test(p));
  const text = `${task.title}\n${task.objective.split(/\n\n/)[0]}`;
  const out: Criterion[] = [];
  const add = (key: string, description: string, kind: string) => out.push({ id: `${task.id}-d-${key}`, description, check: { type: "verification", kind }, evidenceRefs: [] } as unknown as Criterion);
  if (own.length) add("changed", `This step changes its own files (${own.join(" or ")})`, `changed:${own.join("|")}`);
  if (/\b(imagery|images?|photos?|pictures?)\b/i.test(text)) add("images", "The step's screens show the photos in public/images (an image or background pointing at them)", `images-used:${(own.filter((p) => /\.(tsx|jsx|css)$/.test(p)).join("|")) || "src"}`);
  if (/\b(seed|sample data|sample records|collections?)\b/i.test(text) && /\b(createCollection|sim|records?)\b/i.test(text)) add("data", "Sample data is seeded: a collection created with createCollection holds at least 8 records", "data-seeded:8");
  // Screens the step owns don't still show a library piece's demo content (a pottery studio on a grocery app's Home).
  const screens = own.filter((p) => /^src\/screens\/[\w-]+\.(tsx|jsx)$/.test(p));
  if (screens.length) add("pieces", "The library pieces these screens render show this product's content, not their demo", `piece-content:${screens.join("|")}`);
  if (/\b(app )?frame\b|\bnavigation\b|\bAppShell\b/i.test(text)) add("frame", "The app frame is designed: the ui-shell__* rules are restyled or the frame is replaced by the app's own component", "frame-designed");
  return out;
}

/**
 * The most records any createCollection(…) call is seeded with, in the given sources: an array written in the call, or
 * a named array (const PRODUCTS = [ … ]) defined in any of them.
 */
export function seededRecords(source: string): number {
  const count = (from: number) => {
    let depth = 0;
    let records = 0;
    for (let i = from; i < source.length; i++) {
      const ch = source[i];
      if (ch === "[" || ch === "{") {
        if (ch === "{" && depth === 1) records++;
        depth++;
      } else if (ch === "]" || ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    return records;
  };
  let best = 0;
  for (const m of source.matchAll(/createCollection(?:<[^>]*>)?\(\s*["'`][^"'`]+["'`]\s*,\s*(\[|[A-Za-z_$][\w$]*)/g)) {
    if (m[1] === "[") best = Math.max(best, count(m.index! + m[0].length - 1));
    else {
      const def = new RegExp(`\\b${m[1].replace(/\$/g, "\\$")}\\s*(?::[^=;]+)?=\\s*\\[`).exec(source);
      if (def) best = Math.max(best, count(def.index + def[0].length - 1));
    }
  }
  return best;
}

/**
 * A step that writes tests (its own files include a test file, or a check needs one to exist), as opposed to a step
 * whose check runs tests someone else wrote. Only the first gets the testing guide, the test scaffold and the
 * test-first skill (bench: a one-line change checked by an existing test got all three, 7,000 characters of guide).
 */
export function writesTestsStep(task: Pick<Task, "expectedPaths" | "acceptanceCriteria">): boolean {
  return task.expectedPaths.some((p) => TEST_FILE.test(p.replace(/\\/g, "/"))) || task.acceptanceCriteria.some((c) => c.check.type === "file_exists" && TEST_FILE.test(pathOf(c) ?? ""));
}
