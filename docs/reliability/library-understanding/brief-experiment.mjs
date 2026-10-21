// Bounded experiment: the same PRD, screens and catalog through the screen-brief planner, once with the name-only part
// list (before) and once with the catalog cards (after). Same model, temperature and schema shape otherwise.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const D = "C:/Users/JenoU/Desktop/FlowCode/packages/daemon/dist/orchestrator/";
const imp = (f) => import(pathToFileURL(path.join(D, f)).href);
const { SCREEN_BRIEF_SYSTEM, SCREEN_BRIEF_SCHEMA, briefRequest, briefParts, parseScreenBriefs, duplicateParts } = await imp("screenBrief.js");
const { matchCatalog } = await imp("catalogMatch.js");
const { LIBRARY_SECTIONS, relationsOf } = await import(pathToFileURL("C:/Users/JenoU/Desktop/FlowCode/packages/contracts/dist/index.js").href);

const OUT = process.argv[2];
const RUNS = Number(process.argv[3] ?? 2);
const PRD = `# Studio Bookings PRD

## Users
- Visitors: people new to the studio deciding whether to try a class.
- Members: people with a pass who book and cancel classes each week.
- Staff: front-desk staff and teachers who see who is coming to each class.

## Goals
Members see the week's classes, book a spot and cancel up to two hours before class. Staff see who is coming to each
class and check people in. Visitors understand the studio, its passes and prices, and book a first class.

## Passes
Drop-in $22, 10-class pass $190, unlimited monthly $129. The first class is free.

## Screens
| Screen | Purpose |
| Home | Visitors learn what the studio offers, see this week's classes and the passes, and book a first class |
| Classes | Members see the week's schedule, filter by type and teacher, and book a spot (shows spots left; full classes offer the waitlist) |
| My bookings | Members see upcoming bookings and cancel up to two hours before class |
| Class roster | Staff see who is booked for a class and check them in |

## Requirements
- R1 Weekly schedule with class type, teacher, time and spots left.
- R2 Book a spot; a full class offers the waitlist.
- R3 Cancel up to two hours before class; later cancellation is refused with the reason.
- R4 Staff roster per class with check-in.
- R5 Passes and prices on the home page; first class free.
`;
const plan = {
  product: "Studio Bookings",
  screens: [
    { id: "home", label: "Home", component: "HomeScreen", file: "src/screens/HomeScreen.tsx", purpose: "Visitors learn what the studio offers, see this week's classes and the passes, and book a first class" },
    { id: "classes", label: "Classes", component: "ClassesScreen", file: "src/screens/ClassesScreen.tsx", purpose: "Members see the week's schedule, filter by type and teacher, and book a spot" },
    { id: "my-bookings", label: "My bookings", component: "MyBookingsScreen", file: "src/screens/MyBookingsScreen.tsx", purpose: "Members see upcoming bookings and cancel up to two hours before class" },
    { id: "class-roster", label: "Class roster", component: "ClassRosterScreen", file: "src/screens/ClassRosterScreen.tsx", purpose: "Staff see who is booked for a class and check them in" },
  ],
};
const manifest = matchCatalog(PRD, plan.screens);

// Before: the system prompt and schema as they were (without the card rules), and parts as names.
const nameOf = (ref) => LIBRARY_SECTIONS.find((p) => p.ref === ref)?.name ?? LIBRARY_SECTIONS.find((p) => (p.variants ?? []).some((v) => v.ref === ref))?.name ?? ref;
const oldSystem = SCREEN_BRIEF_SYSTEM.replace(/\n- choose parts by what they do[\s\S]*?built new;\n- for each section, "use"[\s\S]*?built for this screen\);/, "");
const oldSchema = JSON.parse(JSON.stringify(SCREEN_BRIEF_SCHEMA));
const sec = oldSchema.properties.screens.items.properties.sections.items.properties;
delete sec.use;
delete sec.adapt;
const oldRequest = () => {
  const screens = plan.screens.map((s) => `## ${s.label}\nPurpose: ${s.purpose}\nParts for this screen:\n${briefParts(manifest, s.label).map((r) => `- ${r}: ${nameOf(r)}`).join("\n")}`).join("\n\n");
  return `Product: ${plan.product}\nRequest: A booking app for a small yoga studio\n\nPRD (people, goals, journeys, screens):\n${PRD}\n\nScreens:\n${screens}`;
};
const newRequest = () => briefRequest("A booking app for a small yoga studio", PRD, plan, manifest);

async function ask(system, user, format) {
  const t0 = Date.now();
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "qwen3:8b", stream: false, think: false, format, options: { temperature: 0.2, num_ctx: 16384 }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  const j = await res.json();
  return { content: j.message?.content ?? "", ms: Date.now() - t0 };
}

function measure(briefs, issues) {
  const sections = briefs.flatMap((b) => b.sections.map((x) => ({ ...x, screen: b.screen, pageType: b.pageType })));
  const parts = sections.filter((x) => x.part);
  const dup = briefs.flatMap((b) => duplicateParts(b.screen, b.sections));
  // A part used where its own "Avoid when" or context rule says no is counted by checkComposition (issues), already.
  const sameJob = briefs.flatMap((b) => {
    const seen = new Map();
    const out = [];
    for (const x of b.sections.filter((y) => y.part)) {
      for (const p of relationsOf(x.part).provides.filter((p) => !["empty state", "loading state", "error state", "primary action", "navigation"].includes(p))) {
        if (seen.has(p) && seen.get(p) !== x.part) out.push(`${b.screen}: "${x.title}" and "${seen.get(p)}" both give ${p}`);
        else seen.set(p, x.part);
      }
    }
    return out;
  });
  return {
    screens: briefs.length,
    sections: sections.length,
    withPart: parts.length,
    distinctParts: new Set(parts.map((x) => x.part)).size,
    useRecorded: sections.filter((x) => x.use).length,
    adaptNotes: sections.filter((x) => x.adapt).length,
    removedByPageRules: issues.filter((i) => i.part).length,
    repeats: dup.map((d) => d.reason),
    sameResponsibilityTwice: sameJob,
    perScreen: briefs.map((b) => ({ screen: b.screen, pageType: b.pageType, sections: b.sections.map((x) => `${x.title} → ${x.part || "(plain)"}${x.use ? ` [${x.use}]` : ""}${x.adapt ? ` adapt: ${x.adapt}` : ""}`) })),
  };
}

const results = { manifest: manifest.screens.map((s) => ({ screen: s.screen, candidates: briefParts(manifest, s.screen).length })), before: [], after: [], promptChars: { before: oldRequest().length, after: newRequest().length } };
for (let i = 0; i < RUNS; i++) {
  for (const [label, system, user, format] of [
    ["before", oldSystem, oldRequest(), oldSchema],
    ["after", SCREEN_BRIEF_SYSTEM, newRequest(), SCREEN_BRIEF_SCHEMA],
  ]) {
    const r = await ask(system, user, format);
    let parsed = [];
    const issues = [];
    try {
      parsed = parseScreenBriefs(JSON.parse(r.content), plan, manifest, [], issues, true);
    } catch (e) {
      parsed = [];
    }
    results[label].push({ ms: r.ms, ...measure(parsed, issues) });
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(label, i, r.ms, parsed.length);
  }
}
fs.writeFileSync(path.join(path.dirname(OUT), "brief-request-after.txt"), newRequest());
fs.writeFileSync(path.join(path.dirname(OUT), "brief-request-before.txt"), oldRequest());
console.log("done");
