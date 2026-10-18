# Frameproof evaluation 3, plan version 1: review summary

**Run:** `run_05368827afde426eac8b` on candidate `491422c` (`dist-v5`, port 7465), with the unchanged PRD and the recorded configuration.

**Planning:**
- 9.4 minutes (15:27:24 to 15:36:37Z).
- 14 planner calls, none failed, no retries.
- 38,339 prompt and 17,618 output tokens.
- FlowCode placed 9 requirements the planner left out.

**FlowCode's own checks:** all 13 pass (6 structural, 7 compliance), with 0 decisions and medium risk. The card therefore shows it as approval-ready.

**Not approved.** The owner decides.

## Records, navigation, core behaviour

**Exact records: preserved (written by FlowCode in step 7, so guaranteed).**
- The 12 photos, `photo-01`…`photo-12`, with the PRD's titles, categories and orientations, in order: 7 Outdoor, 5 Studio.
- One gallery, `gallery-autumn`.
- `imageSource` values are local paths (`/images/golden-hour.jpg`…). The files must be bundled during generation: unverified.

**Navigation: preserved (guaranteed).** Gallery (the photo grid) and My Selection (the Client selection state page) are the only primary destinations. Photo detail opens from the grid. There are no create pages.

**Core behaviour: carried into build steps with tests** (unverified until generation). The source coverage maps 118 passages to steps and 0 unmapped. The steps' tests cover:
- search;
- the Outdoor count;
- the five-photo limit;
- the character count;
- notes kept on removal;
- disabled submission under five;
- the confirmation dialog and its Cancel;
- submit, with status and timestamp;
- locking after reload;
- Start over with cancel and confirm;
- direct photo routes and the not-found state;
- Back;
- notes not carried between photos;
- Previous disabled on photo-01;
- the empty state;
- the 390 px layout.

The five PRD journeys (A–E) are in the assembly step.

## Material contradictions (found by reading; no check caught them)

1. **Selection state is also modelled on the photo records.**
   - The app model gives each photo a status field, with statuses Draft, Selected and Submitted.
   - The sample photos arrive with statuses already set ("selected", "draft", "submitted").
   - FlowCode writes these records, and their status chips, in step 7.
   - This contradicts:
     - the PRD's one shared selection state, with status on the selection, not per photo;
     - "Begin in an empty Draft state" (Journey B, and Journey D's starting point).
2. **Tests for screens and filters that don't exist** (step 11, then step 13):
   - "view the gallery list screen → a grid of galleries with titles, photographers, clients…";
   - "click on a gallery item → navigation to the gallery detail page";
   - "type 'Smith' in the gallery search field…";
   - "select 'John Doe' from the photographer filter dropdown…".

   These contradict the single gallery and the declared navigation. A coder making them pass would have to build a gallery list and a photographer filter.
3. **A wrong search expectation** (step 11): "search for 'Light' → only one photo appears". The PRD says `light` returns Window Light and Last Light. Step 9 has the correct version of the same test.

**Why the checks missed these:**
- Check 11 compares tests against quoted record values and counts. It doesn't recognise:
  - tests about pages or filters the plan doesn't have;
  - a result count after a search.
- No check inspects the statuses on a record kind.

## Nonblocking (wording and polish)

- **Treated as exact on-screen text,** because the words appear in the PRD's journey steps: "seven photos appear" and "Previously saved note remains". The tests may look for these literally; they're unlikely to block.
- **"enter 'Outdoor' in search field → seven photos appear"** treats a category as a search term. Check 11 should have flagged this, as it did in evaluation 2, but didn't this time; the cause wasn't investigated.
- **Some PRD lines are marked "for a person to check" though tests cover them:** R1's overview and R8's "Cancel returns to editable selection".
- **Repetition:** some tests appear twice, in different wordings.

## Look

**The PRD's own direction is proposed, not selected:**
- "Editorial contact sheet";
- warm off-white background, near-black text, muted cobalt accent;
- fine borders, restrained corners, generous whitespace, minimal chrome;
- Balanced motion, expressive effects off.

No exact colours are invented. To bind a Look, set and select it on the Styles page before approving; otherwise the build uses base styling with the direction passed to the design steps.

## Review link

http://localhost:5199/?port=7465&token=frameproof-token-3&temp=1#/projects/prj_cb315e70e0b74335ada7/runs/run_05368827afde426eac8b
