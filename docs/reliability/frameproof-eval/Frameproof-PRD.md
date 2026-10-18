# Frameproof — Client Photo Proofing Prototype

## 1. Product goal
Build a complete working prototype that lets a photography client review a gallery, shortlist photos, leave notes, and submit a final selection.

The app should feel like a polished photography product, not an admin dashboard or marketing website.

Primary journey: Gallery → photo detail → shortlist → review selection → submit.

## 2. Prototype boundaries
- Responsive, local-first web app.
- Bundled sample data and browser storage.
- No backend, authentication provider, external API, or real submission.
- Client is already signed in as a demo user.
- Changes persist after page reload in the same browser.
- Use the existing starter, component library, and dependencies. Add no packages.
- No network connection necessary for the core workflow after the app and bundled assets have loaded.

## 3. User and context
- Demo client: Maya Chen.
- Gallery: Autumn Portrait Session.
- Photographer: Rowan Studio.
- Gallery contains 12 photos.
- Client must choose exactly five photos before submitting.
- One user role: client.

User need: “I want to compare my photos, choose my five favorites, leave any editing notes, and confidently send my selection to the photographer.”

## 4. Screens and navigation
Primary navigation has exactly two destinations:
1. Gallery.
2. My Selection, with the current shortlist count.

Photo detail opens from a photo card; it is not a primary navigation destination.
Submission confirmation is a state of My Selection, not another navigation link.
Initial screen: Gallery.
Do not add a marketing landing page, pricing page, photographer dashboard, or account settings.

## 5. Data model and sample content
### Gallery
| Field | Value |
|---|---|
| ID | gallery-autumn |
| Title | Autumn Portrait Session |
| Photographer | Rowan Studio |
| Client | Maya Chen |
| Required selection count | 5 |

### Photo records
Each photo has a stable ID, title, category, orientation, image source, and descriptive alt text.

Use these exact records:

| ID | Title | Category | Orientation |
|---|---|---|---|
| photo-01 | Golden Hour | Outdoor | Portrait |
| photo-02 | Window Light | Studio | Portrait |
| photo-03 | Walking Together | Outdoor | Landscape |
| photo-04 | Quiet Smile | Studio | Portrait |
| photo-05 | Garden Steps | Outdoor | Landscape |
| photo-06 | Soft Shadows | Studio | Portrait |
| photo-07 | Autumn Path | Outdoor | Portrait |
| photo-08 | Looking Back | Outdoor | Landscape |
| photo-09 | Linen Backdrop | Studio | Portrait |
| photo-10 | Under the Oak | Outdoor | Landscape |
| photo-11 | Candid Laugh | Studio | Landscape |
| photo-12 | Last Light | Outdoor | Portrait |

Use distinct, appropriate bundled photographs when available. Do not rely on remote image URLs at runtime. If suitable assets are unavailable, use distinct local placeholder images with clear photo titles. Do not use broken images or add dependencies to obtain imagery.

### Client selection state
Keep one shared source of truth for:
- Shortlisted photo IDs.
- Editing note per photo.
- Selection status: Draft or Submitted.
- Submission timestamp, when submitted.

Do not create separate copies of selection state in different screens.

## 6. Functional requirements
### R1 — Gallery overview
Display gallery title, photographer, a concise instruction to choose five photos, current selection count, and all 12 photos initially in a responsive grid.
The main content is the photography, not statistics or explanatory cards.

### R2 — Search
Search matches photo titles case-insensitively.
- `light` returns Window Light and Last Light, not Golden Hour.
- `WINDOW` returns Window Light.
- `mountain` produces no results.
- No-results state offers a clear way to clear search.
- Search and category filtering work together.

### R3 — Category filters
Provide All, Outdoor, and Studio filters.
Outdoor contains seven records; Studio contains five.
Changing search or category does not alter shortlist or notes.

### R4 — Photo detail
Display selected image, title, category, Add to selection / Remove from selection control, editing-notes field, Previous and Next controls, and a way back to Gallery.
Previous and Next follow the full 12-photo sample-data order regardless of Gallery filters.
Do not wrap: disable Previous on photo-01 and Next on photo-12.
Returning to Gallery preserves search and category state.

### R5 — Shortlist behavior
Client can add and remove photos from Gallery, photo detail, and My Selection.
- No duplicate selections.
- Count updates everywhere.
- Maximum five selected photos.
- Attempting to add a sixth does not remove or replace an existing selection.
- Explain the limit through accessible feedback.
- Removing a photo permits another to be added.
- Selection status must not rely on color alone.

### R6 — Editing notes
Each photo can have an optional editing note of up to 300 characters.
- Save locally without a separate Save button.
- Show a character count.
- Notes remain attached when a photo is removed from the shortlist.
- Reopening a photo restores its note.
- Submission includes notes for selected photos only.

### R7 — My Selection
Before submission, display selected photos in original sample-data order, their titles and notes, controls to open or remove a photo, selection progress, and Submit selection action.
When empty, show an empty state with a return-to-Gallery action.

### R8 — Submission eligibility
Submission is available only with exactly five selected photos.
With fewer than five, explain how many more are needed. Mouse or keyboard interaction must not submit.
At five, Submit selection opens a confirmation dialog summarizing the five photos, their notes, and that submission will lock the selection.
Cancel returns to editable selection without losing changes.

### R9 — Submitted state
Confirming submission sets Submitted status, records a timestamp, shows confirmation and the five submitted photos, and locks shortlist changes and editing notes across the app.
Client may still browse Gallery and photo detail.
Do not send email, make external requests, or imply a real photographer received the submission.

### R10 — Start over
After submission, provide Start over with a confirmation dialog explaining that it clears selected photos, all notes, submission status, and timestamp.
Cancel preserves everything. Confirm returns to empty Draft state.
Do not clear unrelated browser storage.

### R11 — Persistence
Shortlist, notes, status, and timestamp survive a full reload.
Reloading after submission must not unlock selection.
Use a namespaced storage key.
If saved data cannot be read, recover to a usable Draft state and show a concise notice instead of crashing.

### R12 — Navigation and identity
- Directly opening a valid photo route displays that record.
- Unknown photo ID shows a useful not-found state with a Gallery link.
- Browser Back and Forward work.
- Photo opened from grid is the same record displayed in detail.
- Switching photos must not carry one photo’s note into another.

## 7. Visual direction
### Concept: Editorial contact sheet
- Warm off-white background.
- Near-black text.
- Muted cobalt accent for primary actions and selected states.
- Fine borders and restrained corner rounding.
- Generous whitespace and clear typographic hierarchy.
- Minimal chrome around photography.

Use available fonts and assets. Add no font package.
Avoid dashboard KPI cards, gradients as the main identity, marketing heroes, testimonials, pricing, promotional CTA banners, and excessive badges or repeated instructions.

### Gallery composition
1. Compact product header and primary navigation.
2. Gallery title, photographer, and selection progress.
3. Search and category controls.
4. Photo grid.

### My Selection composition
1. Title and selection status.
2. Selected photos and notes, or empty state.
3. Selection progress and submission action.

At phone width, keep submission easy to find without obscuring content.

## 8. Motion and accessibility
Use Balanced functional motion through the existing motion foundation.
Appropriate uses: selection feedback, confirmation dialogs, restrained photo-detail transitions, and filter-result continuity.

Expressive features are off: no parallax, ambient backgrounds, autoplay, smooth-scroll package, or long/blocking entrance sequence.
Respect reduced-motion preferences. Animation-off must leave all content and controls usable.

Accessibility:
- Keyboard access to every action.
- Visible focus indicators and descriptive control names.
- Modal confirmation dialogs prevent interaction with background page content.
- Closing dialogs returns focus to the trigger when it still exists.
- Selection feedback available to assistive technology.
- Appropriate image alt text.
- No hover-only controls or information.

## 9. Responsive behavior
Test desktop and a 390px-wide phone viewport.
- No horizontal page overflow.
- Adaptive grid columns.
- Usable search and filters.
- Detail images fit without hiding navigation or actions.
- Accessible dialog content on small screens.
- All actions available without hover.

## 10. Acceptance journeys
### Journey A — Find and inspect
1. Open Gallery.
2. Search `WINDOW`.
3. Confirm Window Light is the only result.
4. Open it and confirm title, category, and image match.
5. Return to Gallery and confirm search remains.
6. Clear search and select Outdoor.
7. Confirm seven photos appear.

### Journey B — Select, annotate, and persist
1. Begin in an empty Draft state.
2. Open Golden Hour and add it.
3. Add note: “Please soften the background.”
4. Add four other photos.
5. Attempt to add a sixth.
6. Confirm original five remain and limit is explained.
7. Open My Selection and confirm the same five records and note.
8. Reload and confirm selection and note persist.

### Journey C — Remove and replace
1. Begin with five selected photos.
2. Remove one from My Selection.
3. Confirm count changes everywhere.
4. Add a different photo.
5. Confirm correct five in sample-data order.
6. Reopen removed photo and confirm any previously saved note remains.

### Journey D — Submit and lock
1. With fewer than five, confirm submission cannot proceed.
2. Select exactly five.
3. Open submission dialog, cancel, and confirm nothing changes.
4. Open it again and confirm.
5. Verify Submitted status, timestamp, and correct five photos.
6. Verify shortlist and note editing are locked across screens.
7. Reload and confirm submitted state remains locked.

### Journey E — Start over
1. Begin in Submitted state.
2. Open Start over and cancel; confirm all submitted data remains.
3. Open Start over again and confirm.
4. Verify empty Draft selection and cleared notes.
5. Reload and confirm reset persists.

## 11. Verification and completion criteria
- All five journeys work through the actual app.
- Typecheck, lint, tests, and production build pass.
- Desktop and phone layouts reviewed.
- No broken images, dead controls, or uncaught console errors.
- Reduced motion and animation-off checked.
- Tests verify behavior and real sample records, not internal component names or invented status text.
- Explicitly report unmet requirements and untested platforms.

## 12. Out of scope
Do not implement:
- Photographer or administrator roles.
- Multiple galleries.
- Photo upload or download.
- Image editing, cropping, or zoom tools.
- Payments or real authentication.
- Email or notifications.
- Public sharing.
- Ratings or social comments.
- AI features.
- Backend services or cloud synchronization.
- Marketing pages.
- Additional navigation destinations.
