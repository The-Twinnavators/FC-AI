# Frameproof: request measurements for the remaining build (read-only)

## How it was measured
- **Code path:** `Orchestrator.measureRequest` runs the attempt's own assembly in `agentAttempt`: the system prompt and skills, the tools shown, `fitHandoff`, and the later-turn check. It stops before the request artifact and the model call. Design research is read from its cache.
- **Where:** offline, on isolated copies: the main database via SQLite online backup, and the workspace without node_modules. The live daemon was not restarted, and the live run was not touched (blocked, no tool call since 22:55:22Z).
- **Model calls:** none. The provider was asked only for the model's description, as every attempt does.
- **Budget:** qwen3:8b, a 24,576-token coding window, replies capped at 4,096 tokens. The opening request may use 14,336 tokens, at about 3.8 characters per token.
- **Results:** `measure-results.json`.
- **Caveat:** the original step measures 3,233 tokens over, against the live block's 2,836. The store has changed since that attempt; it is the same order.

## Results (tokens)
| Request | Opening total / budget | Over | Later turn (needs ≤ 24,576) | Objective chars | System (skills) chars | Tools chars | Brief chars |
|---|---|---|---|---|---|---|---|
| Design the main screens (original) | 17,569 / 14,336 | 3,233 | 183,517, no (largest own file read is library.css) | 4,989 | 17,519 (7,113) | 9,551 | 40,472 |
| Part 1: frame and shared styles | 14,141 / 14,336 | 0 (195 left) | 26,967, no | 2,286 + brief | 17,607 (7,201) | 9,551 | 27,206 |
| Part 2: Gallery grid | 14,068 / 14,336 | 0 (268 left) | 25,980, no | 2,972 + brief | 18,688 (8,282) | 9,551 | 25,846 |
| Part 3: Photo detail | 14,007 / 14,336 | 0 (329 left) | 25,903, no | 2,281 + brief | 18,688 (8,282) | 9,551 | 25,610 |
| Part 4: My Selection | 13,585 / 14,336 | 0 (751 left) | 25,376, no | 2,140 + brief | 18,688 (8,282) | 9,551 | 23,988 |
| Part 5: cross-screen review | 14,270 / 14,336 | 0 (66 left) | 27,129, no | 2,212 + brief | 17,607 (7,201) | 9,551 | 27,704 |
| Task 9: User and context | 23,182 / 14,336 | 8,846 | 35,479, no | 37,700 | 21,638 (7,615) | 11,621 | 55,862 |
| Task 10: R2 Search | 25,789 / 14,336 | 11,453 | 38,739, no | 50,278 | 21,638 (7,615) | 11,621 | 65,887 |
| Task 11: R12 Navigation | 26,079 / 14,336 | 11,743 | 39,101, no | 48,033 | 21,638 (7,615) | 11,621 | 67,001 |
| Task 12: Responsive | 30,442 / 14,336 | 16,106 | 44,554, no | 66,324 | 21,638 (7,615) | 11,621 | 83,773 |
| Task 13: My Selection screens | 23,841 / 14,336 | 9,506 | 36,304, no | 40,373 | 21,638 (7,615) | 11,621 | 58,399 |

"+ brief" means the shared design brief, about 1,000 characters, was appended to the part's objective.

## What the numbers show
- **The parts' openings fit only by leaving material out.** Every part's brief dropped the PRD ("Spec: Frameproof-PRD.md") and shortened the design guidance to fit.
- **The parts' headroom is 66 to 751 tokens,** measured on the current small screen files (11 to 18 lines). Parts 2 to 5 and tasks 9 to 13 attach the screens, and parts 1 and 5 attach components.css, so all of them grow once earlier parts write those files. Part 5, at 66 tokens, will overflow then.
- **No part's later turn fits the window.** A later turn is the opening plus a full read of the part's largest file plus a check result. FlowCode sends split parts anyway, so later turns rely on trimming.
- **Tasks 9 to 13 are over by 8,846 to 16,106 tokens each, mostly their objectives** (37,700 to 66,324 characters). The objectives quote each requirement twice: once as "R87: …" and again as "R87 is implemented: …". To fit, each would need about 3 to 4 parts, roughly 15 to 20 parts in total, with their acceptance tests divided between them.
- **A check-placement problem.** The split machinery gives parts 3 and 4 their own deliverable checks, including `images-used`. Part 4 (My Selection with no selection state yet) has no photo to show, so its check can't pass as proposed.
- **The four acceptance-test corrections are still needed.** They are recorded in RECOVERY-ACCEPTANCE.md and SPLIT-PROPOSAL.md, and are not authorized by this step.

Fit only shows that a request can be submitted. It does not show that the work will succeed.
