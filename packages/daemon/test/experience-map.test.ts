import { describe, expect, it } from "vitest";
import { coverageMatrix, experienceNote, parseExperienceMap, scopeDecisions } from "../src/orchestrator/experienceMap.js";
import { parseScreenBriefs, screenBriefNote } from "../src/orchestrator/screenBrief.js";
import type { PlanItem } from "../src/quality/lrcPlan.js";
import type { ScreenPlan } from "../src/orchestrator/screenPlan.js";

const plan = { product: "Bookings", screens: [{ label: "Classes", purpose: "Browse classes" }, { label: "Class detail", purpose: "One class and booking" }] } as unknown as ScreenPlan;
const reqs = [
  { id: "R1", section: "Booking", text: "Members book a class." },
  { id: "R2", section: "Booking", text: "Members cancel a booking." },
  { id: "R3", section: "Goals", text: "Grow attendance." },
  { id: "R4", section: "Later", text: "Payments." },
] as never[];
const item = (id: string, covers: string[], extra: Partial<PlanItem> = {}) => ({ id, title: id, executionType: "code", covers, ...extra }) as unknown as PlanItem;

describe("the experience map", () => {
  it("keeps journeys to planned screens and real requirement IDs", () => {
    const map = parseExperienceMap(
      {
        roles: [{ name: "Member", goals: ["Book a class"] }],
        workflows: [
          { name: "Book a class", role: "Member", entry: "Classes screen", steps: [{ screen: "Classes", action: "Pick a class", result: "Sees its detail" }, { screen: "Class detail", action: "Book", result: "Booked" }, { screen: "Checkout", action: "Pay", result: "Paid" }], success: "Booked", failure: "Class full", recovery: "Join the waitlist", requirementIds: ["r1", "R9"] },
          { name: "Nowhere", role: "x", entry: "Settings", steps: [{ screen: "Settings", action: "a", result: "b" }], success: "", requirementIds: [] },
        ],
        data: [{ entity: "Class", fields: ["name", "time"], screens: ["Classes", "Mars"] }],
        permissions: [],
      },
      plan,
      ["R1", "R2", "R3", "R4"],
    );
    expect(map.workflows).toHaveLength(1);
    expect(map.workflows[0]).toEqual(expect.objectContaining({ entry: "Classes", requirementIds: ["R1"] }));
    expect(map.workflows[0]!.steps.map((s) => s.screen)).toEqual(["Classes", "Class detail"]);
    expect(map.data[0]!.screens).toEqual(["Classes"]);
    expect(experienceNote(map)).toContain("If it goes wrong: Class full → Join the waitlist");
  });

  it("builds the coverage matrix and turns the gaps into decisions for the person", () => {
    const map = parseExperienceMap({ workflows: [{ name: "Book", role: "Member", entry: "Classes", steps: [{ screen: "Classes", action: "Book", result: "Booked" }], success: "Booked", requirementIds: ["R1"] }] }, plan, ["R1", "R2", "R3", "R4"]);
    const rows = coverageMatrix(reqs, [item("a", ["R1"], { tests: [{ behaviour: "press Book", expect: "Booked" }] } as Partial<PlanItem>), item("b", ["R2"]), item("c", ["R3"], { executionType: "review" } as Partial<PlanItem>)], map);
    expect(rows.map((r) => [r.requirement, r.status])).toEqual([["R1", "planned"], ["R2", "no workflow"], ["R3", "for a person to check"], ["R4", "unplaced"]]);
    expect(rows[0]!.verification).toContain('journey test for "Book"');
    expect(rows[0]!.pages).toEqual(["Classes"]);
    const d = scopeDecisions(rows);
    expect(d).toHaveLength(2);
    expect(d[0]).toMatch(/^R2 is in the plan but no user journey covers it/);
    expect(d[1]).toMatch(/^R4 isn't placed in the plan/);
  });
});

describe("page plans", () => {
  it("carry navigation in and out (planned screens only), states, phone layout and acceptance IDs", () => {
    const [b] = parseScreenBriefs(
      { screens: [{ screen: "Classes", who: "Members", goal: "Book", workflow: ["Browse"], firstView: "Today's classes", primaryAction: "Book", sections: [{ title: "Today", purpose: "Classes today", part: "" }], navIn: ["Home"], navOut: ["Class detail page", "Classes"], states: { loading: "Skeleton rows", empty: "No classes today", error: "Couldn't load", success: "Booked badge" }, responsive: "One column", accessibility: "Rows reachable by Tab", acceptance: ["r1", "x"] }] },
      plan,
      undefined,
    );
    expect(b).toEqual(expect.objectContaining({ navIn: [], navOut: ["Class detail"], acceptance: ["R1"], responsive: "One column" }));
    const note = screenBriefNote([b!]);
    expect(note).toContain("Navigation: from the menu; links on to Class detail");
    expect(note).toContain("States: loading: Skeleton rows; empty: No classes today; error: Couldn't load; success: Booked badge");
    expect(note).toContain("Must satisfy: R1");
  });
});
