/**
 * The catalog matched to a PRD (catalogMatch.ts): one deterministic list of catalog IDs per run, per screen with the
 * next-best options, that the builders read and the visual review draws its next option from.
 */
import { describe, expect, it } from "vitest";
import { LIBRARY_SECTIONS, SECTION_CATEGORIES } from "@flowcode/contracts";
import { manifestBrief, matchCatalog, nextBest } from "../src/orchestrator/catalogMatch.js";

const PRD =
  "Studio booking app for a pottery studio. Members sign in, browse classes and book one. A pricing page lets people compare plans. Admins manage bookings in a table with search, edit and delete.";
const SCREENS = [
  { label: "Sign in", purpose: "Members sign in with email and password" },
  { label: "Plans", purpose: "Compare plans and pick one for their budget" },
  { label: "Bookings", purpose: "Admins manage all bookings: search, edit or cancel a booking" },
];
const groupOf = new Map(SECTION_CATEGORIES.map((c) => [c.id, c.group]));
const pieceOf = (ref: string) => LIBRARY_SECTIONS.find((s) => s.ref === ref) ?? LIBRARY_SECTIONS.find((s) => (s.variants ?? []).some((v) => v.ref === ref));

describe("the catalog matched to a PRD", () => {
  const m = matchCatalog(PRD, SCREENS);
  const screen = (n: string) => m.screens.find((s) => s.screen === n)!;

  it("puts the part a screen's job calls for first", () => {
    expect(screen("Sign in").picks[0]!.ref).toBe("p.auth-form");
    expect(screen("Plans").picks.map((p) => p.ref)).toEqual(expect.arrayContaining(["p.plan-comparison", "b.pricing-tiers"]));
    expect(screen("Bookings").picks[0]!.ref).toBe("p.resource-table");
  });

  it("says what each part matched, in the catalog's words", () => {
    expect(screen("Sign in").picks[0]!.why).toMatch(/use case|job|tags/);
  });

  it("is the same list every time for the same PRD", () => {
    expect(matchCatalog(PRD, SCREENS)).toEqual(m);
  });

  it("never offers a whole website to an app screen, and at most one page template per screen", () => {
    for (const s of m.screens) {
      const refs = [...s.picks, ...s.alternates].map((p) => p.ref);
      for (const r of refs) {
        const p = pieceOf(r)!;
        expect(groupOf.get(p.category) === "template" && p.category !== "apptemplates").toBe(false);
      }
      expect(s.picks.filter((p) => p.ref.startsWith("t.")).length).toBeLessThanOrEqual(1);
    }
  });

  it("every ID on the list is a real catalog ID with a piece to copy", () => {
    for (const r of [...m.screens.flatMap((s) => [...s.picks, ...s.alternates]), ...m.shared]) expect(pieceOf(r.ref) ?? LIBRARY_SECTIONS.find((s) => s.id === r.id)).toBeTruthy();
  });

  it("the builders' brief lists the step's screens' IDs with their next-best options, within a local model's budget", () => {
    const brief = manifestBrief(m, "Design the Plans screen");
    expect(brief).toContain("matched to this PRD");
    expect(brief).toContain("### Plans");
    expect(brief).toContain("p.plan-comparison");
    expect(brief).not.toContain("### Sign in");
    expect(brief).toContain("c.button"); // the core components stay
    expect(brief.length).toBeLessThanOrEqual(3800);
    // A step that names no screen gets them all.
    expect(manifestBrief(m, "Polish the design")).toContain("### Sign in");
  });

  it("the visual review's next option is the best untried alternate, then nothing (its own words are the prompt)", () => {
    const s = screen("Plans");
    const first = nextBest(m, "Plans", []);
    expect(first?.ref).toBe(s.alternates.find((a) => !s.picks.some((p) => p.ref === a.ref))!.ref);
    const tried = s.alternates.map((a) => a.ref);
    expect(nextBest(m, "Plans", tried)).toBeUndefined();
    expect(nextBest(m, "No such screen", [])).toBeUndefined();
  });
});
