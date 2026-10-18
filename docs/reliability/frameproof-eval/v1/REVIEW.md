# Frameproof plan version 1: evidence for the owner's review

**State:** run `run_ffaf429822914271b675`, plan version 1, waiting for review since 13:02:04Z.

**Planning:**
- Took 8 minutes (12:54:04 to 13:02:04).
- 13 planner replies were recorded in `raw/planningReplies.json`.
- Two normal recoveries happened:
  - a GPU out-of-memory error on the first call was retried once after 3 s (FlowCode's model retry);
  - checklist part 4 was cut off at its size limit (104 s), was unparseable, and was asked again in two halves.
- FlowCode placed 6 requirements the planner left out (R49, R76, R77, R81, R82, R102).

Nothing has been approved.

## The points the owner asked about

| Asked to preserve | In plan version 1 | Guaranteed or unverified |
|---|---|---|
| The 12 exact photo records, in order | **Missing.** The app model has 14 invented photos ("Mountain Sunrise", "Urban Street Art"…, ids `photo_001`…`photo-14`, remote `https://example.com/…` images). None of the PRD's 12 is there. | The records are written deterministically by "Write the complete app" (step 7), so the wrong records are guaranteed. |
| Seven Outdoor, five Studio | **Missing.** The categories in the records are landscape, urban, still-life and portrait. The category options show as `[object Object]`. A test filters by "Indoor". | Guaranteed wrong (step 7). |
| One gallery (Autumn Portrait Session, Rowan Studio, Maya Chen, 5 required) | **Missing.** There are 14 invented galleries ("Spring Blossom Collection"…; required counts 7–16; Maya Chen as a photographer). The Gallery page is a list of galleries. | Guaranteed wrong (step 7). |
| Gallery and My Selection as the only primary navigation | **Missing.** "Primary navigation: Gallery [list], My Selection [list], New gallery [create], New photo [create]." Gallery detail and Photo detail are opened from other pages. | Guaranteed: the frame is written from this list. |
| No upload or create-photo workflow | **Missing.** There are "New photo" and "New gallery" create pages. My Selection is a plain list of photo records. | Guaranteed (step 7). |
| Shared selection state | Partly. "Data owners: … what the person saved is owned by src/app/store.ts". The app model has no selection record: no shortlist, status or timestamp fields. An `editingNote` field sits on each photo record. | The owner is guaranteed in the plan text. The selection state itself is unverified, left to feature steps 10–13. |
| Five-photo limit | Described in the requirement quotes and in tests ("try to select a sixth photo → no change in selection or error message"; "attempt to add a sixth → error message explaining the limit"). | Unverified until generation. The tests are loose. |
| Notes (300 characters, character count, kept on removal) | A character count is mentioned once (step 10). The 300-character limit appears in no test. "Note kept after removal" is in Journey C. | Unverified. |
| Submission locking | In the PRD quotes, and in Journey D and a test ("Submitted status, timestamp, and correct five photos"). | Unverified. |
| Persistence | In Journeys B, D and E (reload). The namespaced storage key and recovery from unreadable data appear nowhere in the plan's steps. | Unverified. Two R11 details are not planned. |
| Reset (Start over) | In Journey E and a step 11 test ("start over and cancel → all submitted data remains"). | Unverified. |
| Photo detail: Previous/Next with no wrap; not-found route | Previous/Next is in no step or test. The not-found state is in no step or test. Direct route, Back and no carried-over note are tested in step 10. | **Missing** from tests. Unverified. |
| Editorial Look, Balanced motion, expressive off | **Missing.** "Look: no direction is selected; the build keeps the base styling." No direction is proposed: Home directions are offered only for look-up apps. Motion isn't stated. Step 10 tests invented colours (`#f5f5f5`, `#1a1a1a`, `#3a6ea5`) as "outcomes". | Not set. The Look must be made on the Styles page before approval if it is to be bound. |

**Also in the plan:**
- **"Add library sections" adds `pricing-tiers`.** The PRD only says no pricing page.
- **Wrong tests:**
  - "search for 'Window Light' → Window Light and Last Light shown" (wrong; R2's case is `light`);
  - "type 'Outdoor' in search bar";
  - "14 gallery records displayed";
  - "remove → confirmation dialog appears" (not in the PRD).
- **Journeys:** the five PRD journeys (A–E) are in the assembly step, with the right steps.
- **Decisions:** 38 requirements are left as "decisions for you": supporting requirements that no journey covers.
- **FlowCode's own six plan checks all pass.** They don't cover data fidelity, navigation in a non-look-up app or create pages. That shows the structural checks aren't enough.

## Why the data is wrong (from the recorded replies)

These causes are in FlowCode, not the model's structure:

1. **The model got the structure right, and FlowCode garbled its options.**
   - The structure reply (reply 0) has Photo.category options `{key: "outdoor", label: "Outdoor"}, {key: "studio", label: "Studio"}`, and the request contained the PRD table.
   - FlowCode's `parseAppModel` expects options as strings and turned them into `[object Object]`.
2. **FlowCode didn't recognise the PRD's sample data** (the known limitation): the heading is "Data model and sample content".
   - The sample-record requests (replies 1–4) never received the 12 records.
   - FlowCode asked for 14 records of each kind (its default for an app of records), in batches of 10 and 4.
   - The model invented them, guided by the garbled options.
3. **An app of records gets list, create and detail pages for every kind of record** (the known limitation), so "New photo" and "New gallery" appear in the navigation.
4. **The library picks match the word "pricing"** even inside "Do not add … pricing page".

**What Request changes can and can't fix:** a revision request reaches the app-model structure request. But causes 1, 2 and 3 are in FlowCode's handling after the model replies. A revision is unlikely to produce the 12 records, the Outdoor/Studio options or a navigation without create pages.

**Links:**
- Review the plan: http://localhost:5199/?port=7463&token=frameproof-token&temp=1#/projects/prj_8da8edeb5b494b06bd33/runs/run_ffaf429822914271b675

## Recorded outcome (owner's decision, 2026-10-18)

**Result:** Frameproof plan version 1 is a **planning-stage PRD-compliance failure**.

**Not done, on the owner's instruction:**
- the plan was not approved;
- nothing was generated;
- the install permission was not answered.

The run stays at its plan review, unchanged. The PRD, plan, model requests and replies, parsed outputs, recovery events, timing and usage are kept here and in `raw/`.
