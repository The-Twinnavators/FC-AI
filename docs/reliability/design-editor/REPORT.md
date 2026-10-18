# Change the look without denying the plan: steps 1–4

| | |
|---|---|
| **Final commit** | 6251df3 (on 007074b…; the steps are eb81044, 08745bd and 6251df3) |
| **Status** | Implemented and tested. No build or evaluation was run. Waiting for your approval before another measured run |

## What changed

1. **Approval accessibility (eb81044).**
   - In the build's pop-up, the approval card is now a column: its body scrolls, and Approve and Deny stay in view.
   - Checked at 1024×560 and 640×400 (a 200%-zoom equivalent): the actions are visible, and a choice deep in the body scrolls into view when it gets keyboard focus.
   - Closing the pop-up only hides it; the approval stays pending.
   - The look editor sits inline in the card. No style pop-up opens inside the approval pop-up.
2. **Design state and provenance (08745bd).**
   - One record per project, `designState:<project>`, holding:
     - the base, read from evidence: starter base styling, a legacy FlowCode default, or "source not recorded";
     - the draft;
     - the selected direction (versioned);
     - the applied direction;
     - the last failure.
   - Selecting never claims the app changed. "Applied" is set only after every write succeeded.
   - A failed update restores its snapshots, records the failure, and keeps the previous applied look and the draft.
   - The build's "Capture the style" step applies a selected direction. With none selected, it writes nothing: the industry direction is advice only, so no more automatic green and serif.
   - The scaffold no longer records an unchosen base as "Custom, set by FlowCode".
3. **Shared look editor (6251df3).**
   - One component (`DirectionEditor`) on the plan card, in the design review ("Approve the prototype plan and the design") and on the Design tab.
   - **Default controls:** theme, Flat or Tactile surface, primary colour, neutral family (brand-tinted, warm, cool or pure grey), and a bundled typography pair.
   - **More:** optional secondary and tertiary colours, an optional gradient, and the four status colours, each suggested from the palette with Restore.
   - **Contrast:** every colour pair the app draws, with its ratio and target. Statuses also carry an icon and a word (✓ Saved, ! Low stock, ✕ Couldn't save).
   - Edits are a draft saved as you go, kept when the editor closes. "Use this direction" selects the draft. "Apply changes" appears only where an app exists: it writes with snapshots, then reruns the latest build's typecheck and build.
4. **Concepts and appearance (08745bd, 6251df3).**
   - A concept is a layout. With a look selected, a concept brings only its Home page: colours, fonts and surface are untouched.
   - Without a selected look, a concept brings its own look, which is now Flat. Bold aisle became Flat: fine borders, 4–8px corners, no offset shadows. It was rendered and checked: the composition holds and the condensed headings still read well.
   - The plan card shows the look above the layouts, and the layout previews are drawn in the look being edited.
   - The editor exposes cosmetic controls only, so it can't change navigation, functionality, dependencies or component structure, and needs no plan revision.

**Your style rule:** FlowCode suggests and starts from Flat or Tactile only. That covers the template defaults (which previously suggested glass, liquid glass, clay, neo-brutalist, brutalist and neumorphic), the concepts and new looks. Another style is accepted only when you ask for it in a project; it's recorded as that project's exception and never inferred. Existing projects are not restyled. Tactile is described as "restrained depth and material cues … never inflated or clay-like"; its values were already restrained (shadows of at most 6px, a 1px highlight).

## Acceptance tests

| Requirement | Test | Result |
|---|---|---|
| Changing the look preserves the plan | `plan-pause-policy`: draft and select while the plan waits; the plan JSON, approval and status are unchanged | Pass |
| Approval settles the confirmed direction | Same: the settled look is version 1; an unconfirmed draft is flagged and not used | Pass |
| Flat/Tactile defaults, explicit exceptions | `design-state`: Neo-brutalist refused until the project allows it; a theme starts Flat. `style-vibes`, `design-spec`: template defaults Flat/Tactile; a named style still wins | Pass |
| Branding survives concept changes | `design-state`, `direction-apply`: a concept with a selected look leaves `tokens.css` byte-identical and puts in the listings Home | Pass |
| Closing and reopening keeps drafts | Browser (Design tab): draft saved, closed, reopened, same values | Pass |
| Cancelling leaves applied settings unchanged | `design-state`: a draft writes nothing. Browser: Discard returns to the settled look; the server holds no draft | Pass, after fixing a stale-display bug found here |
| Post-build apply keeps data and behaviour | `direction-apply`: data, store, look-up layer, routes, App and pages byte-identical; the 16-step journey passes; the headings render in the applied font | Pass |
| A failed apply doesn't claim success | `design-state`: broken tokens: applied stays version 1, the failure is recorded as version 2, the draft is kept, the label isn't "Applied" | Pass |
| No-selection behaviour stays explicit | `design-state`: the base label is "Base styling — no brand direction selected" (no app: "No brand direction selected"); legacy defaults are labelled from evidence, without writing | Pass |
| Long approval content: keyboard, small windows, zoom | Browser, pop-up structure with the app's styles at 1024×560 and 640×400 | Pass |

**Suites:**
- full daemon suite: 1,603 passed;
- browser files, run one at a time: 47 passed across 11 files;
- typechecks: contracts, daemon, UI and the library's 206 pieces.

## Screenshots (this folder)

- `approval-popup-1024x560.png`: a long plan card at a short window; Approve and Deny in view.
- `editor-design-tab.png`: the editor in the Design tab's column (sample on top, controls, More, contrast).
- `bold-aisle-flat-home-desktop.png`, `-mobile.png`: Bold aisle in its new Flat look.
- `bold-aisle-in-your-look-home-desktop.png`, `-mobile.png`: Bold aisle's layout in a person's look (Fraunces / Work Sans, Tactile, green).
- `look-applied-default-home-*.png`: a look applied to an existing app.

## Remaining limitations

- **The plan card and review card weren't seen with a live approval.** No build was allowed, so no real plan or review approval existed. The cards use the same editor checked on the Design tab, and the pop-up fix was checked with the card's structure and the app's styles.
- **Post-build checks:** "Apply changes" reruns typecheck and build. Preview, screenshots and the journey after a look change are covered by tests here, but the editor doesn't rerun them yet.
- **Bold aisle's palette:** its crimson secondary drives the pink diagonal and pink tiles on the yellow ground, which clashes. Reported, not changed; changing the secondary in the editor fixes it for a project.
- **Existing per-token editors:** the Design tab's colour, typography and surface editors still write straight to the app. Edits there are reported as "differs from the applied direction", not merged into it.
- **Partial PRD branding:** shown as the PRD's first colour (pre-filled with its source, and a "use the PRD's colour" option when changed). Fonts named in a PRD aren't read yet.
- **Deferred as agreed:** website capture (its consent and private-address gap is still open on the existing "Capture a style" button) and external themes.
- **Scratch project:** a test project, "Design editor test (scratch)", now exists in your project list, with its files in `.flowcode-data/workspaces/design-editor-test-scratch`. It can be deleted when you like.
