import { describe, expect, it } from "vitest";
import { relevantContext, type ContextEntry, type CopilotProfile } from "../src/api/copilotProfile.js";

const e = (category: ContextEntry["category"], text: string): ContextEntry => ({ id: text.slice(0, 8), text, category, createdAt: "", updatedAt: "" });

describe("copilot personal context", () => {
  it("sends every note when there is little context", () => {
    const p: CopilotProfile = { address: "Sir", entries: [e("Goals", "Launch the calendar app"), e("Personal", "I like hiking")] };
    expect(relevantContext(p, "hi")).toHaveLength(2);
  });
  it("with a lot of context, always sends identity and preferences plus related notes only", () => {
    const filler = "x".repeat(900);
    const p: CopilotProfile = {
      address: "Sir",
      entries: [e("Identity", `I'm a product designer ${filler}`), e("Preferences", `Keep answers short ${filler}`), e("Goals", `Launch the calendar app this quarter ${filler}`), e("Personal", `I like hiking on weekends ${filler}`)],
    };
    const picked = relevantContext(p, "what should I focus on next for the calendar?").map((x) => x.category);
    expect(picked).toEqual(expect.arrayContaining(["Identity", "Preferences", "Goals"]));
    expect(picked).not.toContain("Personal");
  });
});
