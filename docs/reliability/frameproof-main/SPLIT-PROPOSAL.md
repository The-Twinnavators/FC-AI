# Proposed split of "Design the main screens" (Claude-proposed, for the owner's approval)

- **Run:** run_b789650d36dd4323aa4b.
- **Step:** task_809f74d05cc449f0b3f0. Blocked as task_contract: 2,836 tokens over qwen3:8b's coding context. FlowCode's automatic split was rejected ("more than one long file").
- **Step's scope:** `src/screens/`, `src/styles/`.
- **Step's checks:** typecheck, `frame-designed`, `data-source`, `images-used:src`.

Nothing here is applied. These are implementation slices of the same step, not reduced scope.

## Shared design brief (attached to every part)

> Frameproof design (all five parts): editorial contact sheet; warm off-white, near-black, muted cobalt for primary actions and selected states; fine borders; restrained corners; photography-led composition with generous whitespace, clear typographic hierarchy and minimal chrome. Balanced functional motion; expressive effects off. Colour values, fonts and sizes come only from the selected Look (src/styles/tokens.css): use its tokens, never invent or change token values. No KPI cards, gradient identity, marketing heroes, testimonials, pricing, promotional banners or badge clutter. Every page reads the one store (src/app/store.ts) and keeps no copy of the data. Don't change src/app/store.ts or the client selection state: later steps own them. Read long files by section (read_file with a line range) instead of whole.

## Part 1: Frame and shared Frameproof styles

**Files:** `src/styles/components.css`. **Checks:** frame-designed, typecheck.

> Restyle the app frame and define the shared Frameproof classes in src/styles/components.css, using only the existing tokens. Frame (AppFrame's fl-af-* rules): quiet chrome around the photography: a thin rail and top bar, fine borders, restrained corners, no tinted blocks. Shared classes the screens and later steps use: photo grid and photo card (image, title, category line); selected state (cobalt outline plus a visible "Selected" text label, never colour alone); detail layout (image column and a side column); note field with a character count; Previous/Next pair; status label (Draft or Submitted); confirmation summary list; empty state. Keyboard focus visible on every control. Change no other file.

## Part 2: Gallery photo grid, title search and category filter

**Files:** `src/screens/GalleryScreen.tsx`, `src/app/schema.ts`, `public/images/` (12 new files). **Checks:** data-source, typecheck.

> Make the 12 PRD photos visible and compose the Gallery as a photo grid.
> (a) Add 12 distinct local placeholder images, public/images/photo-01.svg to public/images/photo-12.svg: no network, no dependency. Each is a simple SVG in the Look's neutrals showing the photo's title, shaped to its orientation (portrait 4:5, landscape 3:2).
> (b) In src/app/schema.ts set each photo record's imageSource to "/images/<id>.svg". Change nothing else in the records.
> (c) In src/screens/GalleryScreen.tsx replace the generic table with: the gallery title "Autumn Portrait Session", the photographer, a one-line instruction to choose five photos, a search box, All/Outdoor/Studio filters, and the grid of photo cards (image with its alt text, title, category) in sample-data order. Search matches titles only, case-insensitively ("light" gives Window Light and Last Light; "mountain" gives nothing). Search and filter combine. A no-results state offers a clear-search action. Keep the search text and filter in the address with update() from src/app/routes, so returning to the Gallery restores them. A card opens the photo with go("photo-detail", id). Read the records through the store (useRecords from src/sections/AppData).
> The selection count and selected-state feedback need the shared selection state that later steps add. Show no count or selection until it exists: no fake data, no dead controls.

## Part 3: Photo detail composition

**Files:** `src/screens/PhotoDetailScreen.tsx`. **Checks:** typecheck.

> Compose the photo detail page in src/screens/PhotoDetailScreen.tsx in place of the generic record view (no Edit action, no record-fields table, no generated note). Show the photo large, fitting the viewport without hiding navigation or actions, with its alt text, title, category and orientation; a Back to Gallery link; and Previous and Next in the full 12-photo sample-data order whatever the Gallery's filters, disabled on photo-01 and photo-12 (no wrap). An unknown photo ID shows a not-found message with a Gallery link. Keep the side column for the Add/Remove selection control and the editing-notes field, which later steps add on the shared selection state. Render no dead controls now.

## Part 4: My Selection page composition

**Files:** `src/screens/MySelectionScreen.tsx`. **Checks:** typecheck.

> Replace the placeholder in src/screens/MySelectionScreen.tsx with a finished page structure: the title "My Selection", a status label and progress line, and the empty state ("No photos selected yet", one short instruction, and a Back to Gallery action). The selected-photo list (original order, titles, notes, open/remove), Submit selection with its confirmation dialog, the submitted state with its timestamp, and Start over all need the shared selection state that later steps add. Lay the page out so they slot in, with no fake data or dead controls.

## Part 5: Cross-screen responsive, accessibility and consistency review

**Files:** `src/styles/components.css`, `src/screens/GalleryScreen.tsx`, `src/screens/PhotoDetailScreen.tsx`, `src/screens/MySelectionScreen.tsx`. **Checks:** images-used, typecheck.

> Run the app and look at the Gallery, a photo detail and My Selection at desktop width and at 390px. Fix what you see in src/styles/components.css and the three screens:
> - no horizontal page overflow; adaptive grid columns; usable search and filters on a phone;
> - detail images that fit without hiding navigation or actions; every action available without hover;
> - visible keyboard focus, labelled controls, image alt text, reduced motion honoured;
> - the three screens consistent with the shared classes.
> Don't change behaviour, records or the selection state.

## What each part carries, and who owns the rest

| Part | Carries from the step |
|---|---|
| 1 | frame-designed; the shared visual classes |
| 2 | data-source (records unchanged except imageSource); the 12 local images; Gallery presentation; title-only search and filters (the PRD's R2/R3 behaviour the replaced table provided, fixing manual check 3); search/filter kept in the address (manual check 6) |
| 3 | detail presentation; Previous/Next and not-found (R4/R12 routing, no new state) |
| 4 | My Selection structure and empty state |
| 5 | images-used; responsive and accessibility review; the step's "look at each page at desktop and phone width" |

**Owned by later steps, unchanged (none becomes ownerless):**
- **Selection state in src/app/store.ts:** shortlist, notes, status, timestamp (R5/R6, "Client Selection State Management"). Task 9 owns it; tasks 10, 11 and 13 also have src/app/store.ts in scope.
- **Shortlist behaviour, selection count everywhere, the 5-photo limit message (R1 count, R5):** task 9 and task 10.
- **Notes and character count (R6):** task 10.
- **Eligibility, confirmation, submit lock, Start over, persistence and recovery (R8 to R11):** task 10 and task 13.
- **Navigation identity and note isolation (R12):** task 11.
- **Responsive and accessibility acceptance tests:** task 12.
- **My Selection composition tests:** task 13.
- **The remaining steps:** Design polish, Clean up, Assemble.
- **R2/R3 acceptance tests:** task 10 still owns them. Part 2 provides the behaviour; task 10 verifies it.
- **Manual checks 3 and 6:** stay recorded for re-verification, not assumed fixed.

**Already-known plan defects remain in those later steps' tests:** "30%" progress, a gallery-list search, selecting 5 means Submitted, and note cleared on removal (plan v1 review).

## Decisions for the owner (not made here)

- **The Look.** The design state is "Base styling", with version 2 (near-black #070817, Roboto) selected but not applied. The parts use the Look's tokens and invent none. The editorial palette appears only if you choose or apply a matching Look.
- **Images.** No bundled photographs exist in the workspace. Part 2 uses the PRD's sanctioned fallback ("distinct local placeholder images with clear photo titles"). Real photographs would need your decision.

## Fit preflight

FlowCode measures a step's request inside its attempt preparation: the system prompt and skills, the tools shown to the coder, `fitHandoff` with room = input budget − system − tools, and then the later-turn check. That is inline in the attempt method, not a standalone function, so no part can be measured through the real path without a small hook. Proposed: a measure-only option on that same path (it returns the measured sizes and overflow, and stops before any model call or file change), exposed as `dryRun: true` on the split endpoint. Each of the five parts gets measured that way and the numbers reported before the run is touched. If any part overflows, nothing is applied.
