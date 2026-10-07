/** The launch checklist's keyword categories come from what the PRD asks for, not from what it rules out. */
import { describe, expect, it } from "vitest";
import { affirmedText } from "../src/quality/launchReadiness.js";

const PRD = `# Basic Calculator
## 1. Product
A fast calculator. It opens instantly, works offline, requires no account, and collects no personal data.
- Be usable with zero setup: no login, no onboarding.
- [ ] No login screen, account, or onboarding anywhere
### 1.4 Non-Goals (v1)
- Accounts, cloud sync, or sharing
- A backend server
### 1.6 Functional Requirements
| F8 | Display shows current input | Should |
- Users sign in with email to see saved history
### 4.6 Future Considerations (v2+)
Tape-style history export.
## 5. Open Questions
Should we add payments?
`;

describe("affirmed spec text", () => {
  const t = affirmedText(PRD).toLowerCase();
  it("drops negated clauses and out-of-scope, future and open-question sections", () => {
    expect(t).not.toMatch(/account|login|backend|server|export|payments/);
    expect(t).toMatch(/works offline/);
  });
  it("keeps what the PRD asks for", () => {
    expect(t).toMatch(/sign in with email/);
    expect(t).toMatch(/display shows current input/);
  });
});
