/** The Copilot recognises "help me write…" for each form it can draft, and keeps "how do I…" as a plain walkthrough. */
import { it, expect } from "vitest";
import { matchDraft } from "../../../apps/ui/src/components/copilotJourneys";
it("matches drafting asks", () => {
  const cases: Array<[string, string | undefined, boolean]> = [
    ["Help me write a skill for making tables readable on phones", "skill", true],
    ["help me write my about statement: I'm a product designer who builds tools for cleaners", "about", true],
    ["Help me write a PRD about tracking dog walks for busy owners", "prd", true],
    ["write a note about why we chose React over Angular", "note", true],
    ["help me draft a prompt for a landing page copywriter", "prompt", true],
    ["help me write a description for an app where customers book cleaning slots", "build", true],
    ["help me write a research topic on local AI coding agents", "topic", true],
    ["help me write a skill", "skill", false],
    ["how do I create a skill?", undefined, false],
  ];
  for (const [q, kind, hasIdea] of cases) {
    const m = matchDraft(q);
    expect(m?.kind, q).toBe(kind);
    if (m) expect(!!m.idea, q).toBe(hasIdea);
  }
});
