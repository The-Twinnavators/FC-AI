/**
 * Acceptance tests FlowCode writes itself for an app whose screens it composed (screenComposer.ts,
 * selectionComposer.ts). Each behaviour a functional step covers is checked through the running app the way a person
 * uses it. The tests come from the PRD's own concrete examples ("`light` returns Window Light and Last Light, not
 * Golden Hour", the sample data's count per category, "exactly five", the journeys' example note) and from the labels
 * FlowCode gave the controls. In a composed app, a functional step is verified by these tests instead of tests the
 * model planned.
 *
 * Frameproof main build: the planner's tests for the functional steps contradicted the PRD. They had "selection
 * progress 30%" where the PRD counts "N of 5", a "Portrait" category that doesn't exist, "note cleared" on removal where
 * notes stay, and "off-white background" as on-screen text. Each step's brief also ran to 37,000–66,000 characters,
 * past what the local model can take.
 */
import type { AppModel, ModelEntity, ModelField } from "./appModel.js";
import { builtViews } from "./appFiles.js";
import type { SelectionSpec } from "./selectionComposer.js";
import { imageFieldOf } from "./selectionComposer.js";

export type Family = "overview" | "search" | "filter" | "detail" | "navigation" | "shortlist" | "notes" | "selection-page" | "submission" | "submitted" | "start-over" | "persistence" | "access";

/** Which families check a requirement (its section and title, as the PRD and the plan name them). */
export function familiesFor(section: string): Family[] {
  const s = section.toLowerCase();
  const out: Family[] = [];
  if (/user and context|gallery overview|\br1\b|overview|journey a|composition/.test(s)) out.push("overview");
  if (/search|journey a/.test(s)) out.push("search");
  if (/categor|filter|journey a/.test(s)) out.push("filter");
  if (/photo detail|\br4\b|record page|detail/.test(s)) out.push("detail");
  if (/navigation and identity|\br12\b|navigat|not.found|error handling/.test(s)) out.push("navigation");
  if (/shortlist|selection state|selection management|\br5\b|journey b|journey c|replace/.test(s)) out.push("shortlist");
  if (/note|\br6\b|journey b/.test(s)) out.push("notes");
  if (/my selection|\br7\b|empty state/.test(s)) out.push("selection-page");
  if (/submission|submit|eligib|\br8\b|journey d/.test(s)) out.push("submission");
  if (/submitted|\br9\b|journey d|lock/.test(s)) out.push("submitted");
  if (/start over|\br10\b|journey e|reset/.test(s)) out.push("start-over");
  if (/persist|\br11\b|reload|storage|boundar/.test(s)) out.push("persistence");
  if (/accessib|motion|responsive|concept|visual|dialog/.test(s)) out.push("access");
  return [...new Set(out)];
}

interface Ctx {
  m: AppModel;
  s?: SelectionSpec;
  e: ModelEntity;
  ids: string[];
  list: string;
  listLabel: string;
  detail?: string;
  titles: string[];
  facet?: { field: ModelField; counts: Array<[string, number]> };
  context?: { title: string; facts: string[] };
  examples: Array<{ term: string; shows: string[]; hides: string[] }>;
  noResults: string[];
  note: string;
}

const js = (v: unknown) => JSON.stringify(v);
/** A regular expression literal matching names that start with s (a control's name also holds its value). */
const startsWith = (s: string) => `/^${s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/`;

/** The PRD's search examples: "`light` returns Window Light and Last Light, not Golden Hour", "`mountain` produces no results". */
export function searchExamples(prd: string): { examples: Ctx["examples"]; noResults: string[] } {
  const examples: Ctx["examples"] = [];
  const noResults: string[] = [];
  for (const line of prd.split(/\r?\n/)) {
    const none = /`([^`]+)`\s+(?:produces|returns|shows|gives|finds)\s+no results/i.exec(line);
    if (none) {
      noResults.push(none[1]!);
      continue;
    }
    const m = /`([^`]+)`\s+(?:returns|shows|finds)\s+(.+?)(?:,\s*(?:but\s+)?not\s+(.+?))?\.?\s*$/i.exec(line);
    if (!m) continue;
    const split = (x?: string) => (x ?? "").split(/,\s*|\s+and\s+|\s+or\s+/).map((t) => t.trim().replace(/^the\s+/i, "")).filter(Boolean);
    examples.push({ term: m[1]!, shows: split(m[2]), hides: split(m[3]) });
  }
  return { examples, noResults };
}

/** A note the PRD's journeys use as an example ('Add note: "Please soften the background."'). */
export function exampleNote(prd: string, max: number): string {
  const m = /\bnote\b[^"“\n]{0,20}["“]([^"”\n]{3,120})["”]/i.exec(prd);
  const note = m?.[1]?.trim();
  return note && note.length <= max ? note : "Warmer tones, please";
}

function contextOf(m: AppModel, entity: string): Ctx["context"] {
  const others = m.entities.filter((x) => x.key !== entity && (m.seed[x.key] ?? []).length === 1);
  if (others.length !== 1) return undefined;
  const o = others[0]!;
  const rec = m.seed[o.key]![0]!;
  return { title: String(rec[o.titleField] ?? ""), facts: o.fields.filter((f) => f.key !== "id" && f.key !== o.titleField && f.type === "text" && rec[f.key]).map((f) => String(rec[f.key])) };
}

function ctxOf(m: AppModel, s: SelectionSpec | undefined, prd: string): Ctx | undefined {
  const listView = builtViews(m).find((v) => {
    const e = m.entities.find((x) => x.key === v.entity);
    return v.kind === "list" && !!e && !!imageFieldOf(e);
  });
  if (!listView) return undefined;
  const e = m.entities.find((x) => x.key === listView.entity)!;
  const rows = m.seed[e.key] ?? [];
  if (rows.length < 3) return undefined;
  const facetField = (e.filters ?? []).map((k) => e.fields.find((f) => f.key === k)).find((f): f is ModelField => !!f && (f.options ?? []).length > 1);
  const counts = facetField ? (facetField.options ?? []).filter((o) => !/^(all|any|none)$/i.test(o)).map((o) => [o, rows.filter((r) => r[facetField.key] === o).length] as [string, number]).filter(([, n]) => n > 0) : [];
  const { examples, noResults } = searchExamples(prd);
  const titles = rows.map((r) => String(r[e.titleField] ?? r.id));
  return {
    m,
    s,
    e,
    ids: rows.map((r) => String(r.id)),
    list: listView.id,
    listLabel: listView.label,
    detail: builtViews(m).find((v) => v.kind === "detail" && v.entity === e.key)?.id,
    titles,
    facet: facetField && counts.length ? { field: facetField, counts } : undefined,
    context: contextOf(m, e.key),
    // Only examples about the records' titles: terms the sample data can answer.
    examples: examples.filter((x) => x.shows.length && [...x.shows, ...x.hides].every((t) => titles.includes(t))),
    noResults: noResults.filter((t) => !titles.some((x) => x.toLowerCase().includes(t.toLowerCase()))),
    note: exampleNote(prd, s?.noteMax ?? 300),
  };
}

const tests: Record<Family, (c: Ctx) => string[]> = {
  overview: (c) => [
    `  it(${js(`shows the ${c.listLabel.toLowerCase()}${c.context ? " with its heading and facts" : ""} and every ${c.e.label.toLowerCase()} from the sample data`)}, async () => {
    await open("#/${c.list}");
${c.context ? `    expect(screen.getByRole("heading", { level: 1, name: ${js(c.context.title)} })).toBeInTheDocument();\n${c.context.facts.map((v) => `    expect(screen.getByText(${js(v)})).toBeInTheDocument();\n`).join("")}` : ""}    expect(cards()).toHaveLength(${c.titles.length});
    expect(screen.getByText("Showing ${c.titles.length} of ${c.titles.length} ${c.e.plural.toLowerCase()}")).toBeInTheDocument();${c.s ? `\n    expect(screen.getByText("Choose ${c.s.count} ${c.s.nouns} for your selection.")).toBeInTheDocument();\n    expect(screen.getByText("0 of ${c.s.count} selected")).toBeInTheDocument();` : ""}
  });`,
  ],
  search: (c) => [
    ...c.examples.map(
      (x) => `  it(${js(`search "${x.term}" shows ${x.shows.join(" and ")}${x.hides.length ? `, not ${x.hides.join(" or ")}` : ""}`)}, async () => {
    await open("#/${c.list}");
    await search(${js(x.term)});
    expect(cards()).toHaveLength(${x.shows.length});
${x.shows.map((t) => `    expect(screen.getByRole("button", { name: ${js(`Open ${t}`)} })).toBeInTheDocument();\n`).join("")}${x.hides.map((t) => `    expect(screen.queryByRole("button", { name: ${js(`Open ${t}`)} })).not.toBeInTheDocument();\n`).join("")}  });`,
    ),
    ...c.noResults.map(
      (t) => `  it(${js(`search "${t}" finds nothing and offers a way to clear it`)}, async () => {
    await open("#/${c.list}");
    await search(${js(t)});
    expect(cards()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: /^Clear search/ }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(cards()).toHaveLength(${c.titles.length});
  });`,
    ),
  ],
  filter: (c) =>
    c.facet
      ? [
          `  it(${js(`filters by ${c.facet.field.label.toLowerCase()}: ${c.facet.counts.map(([o, n]) => `${o} has ${n}`).join(", ")}${c.s ? ", without changing the selection" : ""}`)}, async () => {
${c.s ? "    pickFirst(1);\n" : ""}    await open("#/${c.list}");
    const pick = screen.getByRole("combobox", { name: ${startsWith(c.facet.field.label)} });
${c.facet.counts.map(([o, n]) => `    await user.selectOptions(pick, ${js(o)});\n    expect(cards()).toHaveLength(${n});\n`).join("")}    await user.selectOptions(pick, "");
    expect(cards()).toHaveLength(${c.titles.length});${c.s ? `\n    expect(screen.getByText("1 of ${c.s.count} selected")).toBeInTheDocument();` : ""}
  });`,
          ...(c.examples[0]
            ? [
                `  it("search and the ${c.facet.field.label.toLowerCase()} filter work together", async () => {
    await open("#/${c.list}");
    await search(${js(c.examples[0].term)});
    const before = cards().length;
    await user.selectOptions(screen.getByRole("combobox", { name: ${startsWith(c.facet.field.label)} }), ${js(c.facet.counts[0]![0])});
    expect(cards().length).toBeLessThanOrEqual(before);
    expect(screen.getByRole("searchbox")).toHaveValue(${js(c.examples[0].term)});
  });`,
              ]
            : []),
        ]
      : [],
  detail: (c) =>
    c.detail
      ? [
          `  it(${js(`a ${c.e.label.toLowerCase()} opened from the ${c.listLabel.toLowerCase()} is the same record, with previous and next that don't wrap`)}, async () => {
    await open("#/${c.list}");
    await user.click(screen.getByRole("button", { name: ${js(`Open ${c.titles[1]}`)} }));
    expect(await screen.findByRole("heading", { level: 1, name: ${js(c.titles[1])} })).toBeInTheDocument();
    await open("#/${c.detail}/${c.ids[0]}");
    expect(screen.getByRole("heading", { level: 1, name: ${js(c.titles[0])} })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { level: 1, name: ${js(c.titles[1])} })).toBeInTheDocument();
    await open("#/${c.detail}/${c.ids.at(-1)}");
    expect(screen.getByRole("heading", { level: 1, name: ${js(c.titles.at(-1))} })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });`,
        ]
      : [],
  navigation: (c) => {
    if (!c.detail) return [];
    const term = c.examples[0]?.term ?? c.titles[0]!.split(/\s+/)[0]!;
    return [
      `  it(${js(`an unknown ${c.e.label.toLowerCase()} shows a not-found state with a way back`)}, async () => {
    await open("#/${c.detail}/no-such-${c.e.key}");
    expect(screen.getByRole("heading", { level: 1, name: ${js(`${c.e.label} not found`)} })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: ${js(`Back to ${c.listLabel}`)} }));
    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
  });`,
      `  it(${js(`coming back to the ${c.listLabel.toLowerCase()} from a ${c.e.label.toLowerCase()} keeps its search`)}, async () => {
    await open("#/${c.list}");
    await search(${js(term)});
    await open("#/${c.detail}/${c.ids[0]}");
    await open("#/${c.list}");
    expect(screen.getByRole("searchbox")).toHaveValue(${js(term)});
  });`,
    ];
  },
  shortlist: (c) =>
    c.s && c.titles.length > c.s.count
      ? [
          `  it(${js(`holds at most ${c.s.count} ${c.s.nouns}: one more is refused and explained, nothing is replaced, and removing one makes room`)}, async () => {
    await open("#/${c.list}");
    for (const t of ${js(c.titles.slice(0, c.s.count))}) await user.click(screen.getByRole("button", { name: \`Add \${t} to your selection\` }));
    expect(screen.getByText("${c.s.count} of ${c.s.count} selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: ${js(`Add ${c.titles[c.s.count]} to your selection`)} }));
    expect(screen.getByText(/already has ${c.s.count} ${c.s.nouns}/)).toBeInTheDocument();
    expect(screen.getByText("${c.s.count} of ${c.s.count} selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ${js(`Remove ${c.titles[0]} from your selection`)} })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: ${js(`Remove ${c.titles[0]} from your selection`)} }));
    await user.click(screen.getByRole("button", { name: ${js(`Add ${c.titles[c.s.count]} to your selection`)} }));
    expect(screen.getByText("${c.s.count} of ${c.s.count} selected")).toBeInTheDocument();
    expect(selection.get().ids).not.toContain(${js(c.ids[0])});
  });`,
        ]
      : [],
  notes: (c) =>
    c.s && c.detail
      ? [
          `  it(${js(`a note saves as it is typed with its character count, stays with its own ${c.s.noun}, and stays when the ${c.s.noun} is removed`)}, async () => {
    await open("#/${c.detail}/${c.ids[0]}");
    await user.click(screen.getByRole("textbox", { name: /^Editing note/ }));
    await user.paste(${js(c.note)});
    expect(screen.getByText("${c.note.length} / ${c.s.noteMax} characters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add to selection" }));
    await user.click(screen.getByRole("button", { name: "Remove from selection" }));
    await open("#/${c.detail}/${c.ids[1]}");
    expect(screen.getByRole("textbox", { name: /^Editing note/ })).toHaveValue("");
    await open("#/${c.detail}/${c.ids[0]}");
    expect(screen.getByRole("textbox", { name: /^Editing note/ })).toHaveValue(${js(c.note)});
  });`,
        ]
      : [],
  "selection-page": (c) =>
    c.s
      ? [
          `  it(${js(`${c.s.page.replace(/-/g, " ")} shows the chosen ${c.s.nouns} in the sample data's order, or an empty state with a way back`)}, async () => {
    await open("#/${c.s.page}");
    expect(screen.getByText(/No ${c.s.nouns} selected yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ${js(`Return to ${c.listLabel}`)} })).toBeInTheDocument();
    act(() => {
      selection.toggle(${js(c.ids[2])});
      selection.toggle(${js(c.ids[0])});
    });
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(${js([c.titles[0], c.titles[2]])});
  });`,
        ]
      : [],
  submission: (c) =>
    c.s
      ? [
          `  it(${js(`submits only with exactly ${c.s.count}, after a confirmation that lists them; Cancel keeps everything`)}, async () => {
    pickFirst(${c.s.count - 1});
    await open("#/${c.s.page}");
    expect(screen.getByText("Select 1 more ${c.s.noun} to submit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit selection" })).toBeDisabled();
    pickFirst(${c.s.count});
    await user.click(screen.getByRole("button", { name: "Submit selection" }));
    const dialog = screen.getByRole("dialog", { name: "Submit your selection?" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(${c.s.count});
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(selection.get().ids).toHaveLength(${c.s.count});
  });`,
        ]
      : [],
  submitted: (c) =>
    c.s
      ? [
          `  it(${js(`once submitted, it records the time and locks the selection${c.detail ? " and notes" : ""} across the app`)}, async () => {
    pickFirst(${c.s.count});
    await open("#/${c.s.page}");
    await user.click(screen.getByRole("button", { name: "Submit selection" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Submit selection" }));
    expect(screen.getByRole("heading", { name: "Selection submitted" })).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(selection.get().submittedAt).toBeTruthy();
    await open("#/${c.list}");
    for (const b of screen.getAllByRole("button", { name: / your selection$/ })) expect(b).toBeDisabled();${c.detail ? `\n    await open("#/${c.detail}/${c.ids[0]}");\n    expect(screen.getByRole("textbox", { name: /^Editing note/ })).toBeDisabled();` : ""}
  });`,
        ]
      : [],
  "start-over": (c) =>
    c.s
      ? [
          `  it("start over asks first: Cancel keeps the submission, confirming clears it to an empty draft", async () => {
    pickFirst(${c.s.count});
    act(() => {
      selection.setNote(${js(c.ids[0])}, ${js(c.note)});
      selection.submit();
    });
    await open("#/${c.s.page}");
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(within(screen.getByRole("dialog", { name: "Start over?" })).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Selection submitted" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(within(screen.getByRole("dialog", { name: "Start over?" })).getByRole("button", { name: "Start over" }));
    expect(screen.getByText(/No ${c.s.nouns} selected yet/)).toBeInTheDocument();
    expect(selection.get()).toMatchObject({ ids: [], notes: {}, status: "draft" });
  });`,
        ]
      : [],
  persistence: (c) =>
    c.s
      ? [
          `  it("keeps a submitted selection locked after a reload, under its own key", async () => {
    pickFirst(${c.s.count});
    act(() => {
      selection.submit();
    });
    expect(JSON.parse(localStorage.getItem(${js(c.s.storageKey)}) ?? "{}").ids).toHaveLength(${c.s.count});
    await reload("#/${c.s.page}");
    expect(screen.getByRole("heading", { name: "Selection submitted" })).toBeInTheDocument();
    expect(selection.get().status).toBe("submitted");
  });`,
          `  it("starts empty with a notice when the saved selection can't be read", async () => {
    localStorage.setItem(${js(c.s.storageKey)}, "{not json");
    await reload("#/${c.s.page}");
    expect(screen.getByText(/couldn.t be read, so it starts empty/)).toBeInTheDocument();
    expect(selection.get().ids).toEqual([]);
  });`,
        ]
      : [],
  access: (c) => [
    `  it(${js(`names every control on the ${c.listLabel.toLowerCase()}${c.s ? " and says a pick's state in words, not colour alone" : ""}`)}, async () => {
    await open("#/${c.list}");
    expect(screen.getByRole("searchbox", { name: /^Search / })).toBeInTheDocument();${c.facet ? `\n    expect(screen.getByRole("combobox", { name: ${startsWith(c.facet.field.label)} })).toBeInTheDocument();` : ""}${c.s ? `\n    await user.click(screen.getByRole("button", { name: ${js(`Add ${c.titles[0]} to your selection`)} }));\n    expect(screen.getByRole("button", { name: ${js(`Remove ${c.titles[0]} from your selection`)} })).toHaveTextContent(/Selected/);` : ""}
  });`,
  ],
};

/**
 * The acceptance test file for a functional step of a composed app: the tests its requirements ask for (their sections
 * and titles). Undefined when the app has no composed list to test or nothing applies.
 */
export function composeAcceptanceFile(m: AppModel, s: SelectionSpec | undefined, prd: string, sections: string[], title: string): { content: string; families: Family[]; count: number } | undefined {
  const c = ctxOf(m, s, prd);
  if (!c) return undefined;
  const families = [...new Set(sections.flatMap(familiesFor))];
  const blocks = families.flatMap((f) => tests[f](c));
  if (!blocks.length) return undefined;
  const body = blocks.join("\n\n");
  const reloads = /\breload\(/.test(body);
  const rtl = ["act", ...(reloads ? ["cleanup"] : []), "render", "screen", ...(/\bwithin\(/.test(body) ? ["within"] : [])];
  // After a reload the test works with the reloaded app's selection; each test starts with the first one again.
  const selectionImport = !c.s ? "" : reloads ? `import { selection as initial } from "../app/selection";\n\n/** The app's selection (after a reload, the reloaded app's). */\nlet selection = initial;\n` : `import { selection } from "../app/selection";\n`;
  const content = `/**
 * Acceptance tests for "${title.replace(/\*\//g, "* /")}", written by FlowCode (acceptanceComposer.ts) for the screens it
 * composed: each behaviour is checked through the running app as a person uses it, from the PRD's own examples and the
 * sample data. When one fails, fix the app, not the test.
 */
import { ${rtl.join(", ")} } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it${reloads ? ", vi" : ""} } from "vitest";
import App from "../App";
${selectionImport}
const user = userEvent.setup();

/** Goes to a screen the way a link does. */
async function open(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** The sample data's ${c.e.plural.toLowerCase()}, in order. */
const TITLES = ${js(c.titles)};

/** The ${c.e.plural.toLowerCase()} the ${c.listLabel.toLowerCase()} shows (the frame's own "Open …" buttons aren't records). */
const cards = () => screen.queryAllByRole("button", { name: (name) => name.startsWith("Open ") && TITLES.includes(name.slice(5)) });

async function search(term: string) {
  const box = screen.getByRole("searchbox");
  await user.clear(box);
  if (term) await user.type(box, term);
}
${
  c.s
    ? `
/** A fresh selection of the first n ${c.s.nouns} in the sample data's order. */
function pickFirst(n: number) {
  act(() => {
    selection.startOver();
    for (const id of ${js(c.ids)}.slice(0, n)) selection.toggle(id);
  });
}
`
    : ""
}${
  reloads
    ? `
/** A full reload at a screen: the app's modules start again from what the browser saved. */
async function reload(hash: string) {
  cleanup();
  vi.resetModules();
  window.location.hash = hash;
${c.s ? `  selection = (await import("../app/selection")).selection;\n` : ""}  const Reloaded = (await import("../App")).default;
  render(<Reloaded />);
  await open(hash);
}
`
    : ""
}
beforeEach(async () => {
  localStorage.clear();${c.s ? `${reloads ? "\n  selection = initial;" : ""}\n  act(() => {\n    selection.startOver();\n  });` : ""}
  window.location.hash = "#/${c.list}";
  render(<App />);
  await open("#/${c.list}");
  const box = screen.queryByRole("searchbox");
  if (box) await user.clear(box);${c.facet ? `\n  const pick = screen.queryByRole("combobox", { name: ${startsWith(c.facet.field.label)} });\n  if (pick) await user.selectOptions(pick, "");` : ""}
});

describe(${js(title)}, () => {
${body}
});
`;
  return { content, families, count: blocks.length };
}
