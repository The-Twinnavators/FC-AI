# Frameproof evaluation 3: outcome

**Planning-stage PRD-compliance failure after one requested revision. No generated-app result.**

Stopped on the owner's instruction at plan version 2, unapproved. The evidence is unchanged:
- `v1/`, `v2/` and their `REVIEW.md`;
- the request recording and feedback;
- the recorded planner replies.

Further repair work is separate and not authorized.

## What improved

These are compared with Frameproof v1 and evaluation 2, on the same PRD and configuration:
- **Records:** the exact 12 photos and the one gallery are preserved, in order, with 7 Outdoor and 5 Studio.
- **Navigation:** Gallery and My Selection only. Photo detail is opened from the grid. There are no create, gallery-list or pricing pages.
- **Coverage:** every substantive PRD passage maps into the plan, including the 300-character limit, no wrapping, the namespaced key, recovery, the dialogs and the Start over rules.
- **Revision:** the one revision applied the shared selection state (no per-photo status, empty initial state), removed the gallery-management tests, and corrected the search results.

## Material contradictions remaining (version 2)

1. A test requires a successful submission with 7 photos; the PRD allows exactly five.
2. A test expects nonexistent photo ID 123 to display; the PRD requires a not-found state.
3. Descriptions are required as on-screen text, against correction 4:
   - "Window Light and Last Light", in three tests;
   - "saved note remains";
   - "Submitted status".

## Time

| Measure | Value |
|---|---|
| Elapsed, run created to version 2 ready | 26.5 min (15:27:24 to 15:53:55Z) |
| Active planning | 21.3 min (version 1: 9.0 min; version 2: 12.3 min) |

The rest of the elapsed time was review.

## Model usage and cost

| Measure | Value |
|---|---|
| Model | qwen3-coder:30b, local Ollama, planner only |
| Planner calls | 30, none failed, no retries |
| Model time | 1,277 s (1,199 s generating) |
| Prompt tokens | 85,487 |
| Output tokens | 44,369 |
| Hosted models | none |
| API cost | $0 (local hardware only) |

## Never tested, because generation did not start

- dependency installation;
- code generation, and whether the coder resolves or reproduces the contradicting tests;
- typecheck, lint, tests and production build;
- the five acceptance journeys in a running app;
- bundled images (local paths only exist in the plan);
- persistence and recovery in a real browser;
- dialogs, focus and keyboard access;
- reduced motion and animation-off;
- desktop and 390 px layouts;
- console errors;
- applying the Look.
