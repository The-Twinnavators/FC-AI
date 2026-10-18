# Design tab: initial state and project design setup (investigation and plan)

**Status:** plan only. Nothing is implemented, and no build or run configuration has changed.

## 1. Root cause of the repeated green and serif

This was traced from the cancelled eval 4 project (prj_2f083343…), not assumed.

| Source examined | Finding |
|---|---|
| **Category defaults (the cause)** | The **"Capture the style"** build step (`orchestrator/templates.ts`, `captureStyleStep`) runs right after the plan is approved. When no website, images or CSS were given, no style was chosen in New build, and the PRD lists no colours, it **applies FlowCode's industry design direction** to the app's `src/styles/tokens.css`. It picks the direction by keyword (`knowledge/designDirection.ts`). "grocery" in the Clean Cart PRD matches the Food row, which gives the eco palette (#15803d, #166534, #d9f99d) and the humanist pair (Fraunces / Work Sans). The project's own record says so: `styleCapture.sources = ["the food / grocery / restaurant design direction"]`, applied "colors #15803d, #166534, #d9f99d; fonts Fraunces and Work Sans". **Every Clean Cart project gets the same look.** A product that matches no row gets the fallback instead (charcoal and red, Playfair Display / Source Sans 3). |
| **Starter template (second layer)** | The scaffolded starter is green and serif too: `--color-accent: #24423a`, `--font-display: "Source Serif 4"`. A project that skipped the capture step would still open green and serif. |
| **The label** | The scaffold step records `designChoice = { id: "custom", by: "flowcode" }`. The tab then shows **"Custom · Set by FlowCode"**, which reads as a direction someone chose. |
| Design tab sample | **Not the cause.** The tab (`StylesPanel`) scans the project's real CSS (`GET /projects/:id/styles`). The sample text is fixed, but its look comes entirely from those tokens. |
| Selected concept | **Not the cause.** No concept was selected (direction recorded as `none`). A concept is applied later, when the app is written, and replaces these tokens. |
| Saved style | **Not the cause.** No saved-style mechanism exists, and `designCustom` was unset. |
| Persisted project state | **The carrier, not the origin.** The look lives in each project's `tokens.css` plus the `designChoice` and `styleCapture` records, so reopening the tab shows it again. It isn't a global value: each new project is given the same one. |
| Generated app styles | The same files: the app renders the tokens the capture step wrote. |
| Stale preview or storage | **Ruled out.** The values are written fresh for each project, and their source is recorded. |

**Timing makes it worse.** The default is applied right after plan approval, so at the review step ("Approve the prototype plan and the design") the tab shows FlowCode's industry default as the look to approve.

## 2. User flow

```
Design tab, new project
 ├─ No direction yet (neutral empty state)
 │    [Choose a FlowCode theme] [Capture a website style] [Create a custom style]
 │    Suggest a direction (secondary)
 │        → a draft in the editor drawer; sample shown; nothing applied
 │        → "Use this direction" → recorded as the project's direction (version, sources)
 ├─ Direction chosen, no app yet → labelled "Style sample" (tokens in a sample page, no build)
 ├─ App built → the app's actual look ("Your app"), with the direction named
 └─ Editing after the app exists → draft beside the applied look
        → "Use this direction" → governed, reversible update (snapshots), checks rerun
At plan approval: the chosen direction is on the plan card (as concepts are now). No new stop.
```

## 3. Mapping to existing state and components (no parallel system)

| Need | Reuse |
|---|---|
| Themes | `DESIGN_TEMPLATES` (contracts), `POST /projects/:id/design/choice`, `templateTokens` |
| Surface styles | `STYLE_VIBES`, `setSurfaceStyle` |
| Website and file capture | `captureStyle`, `POST /projects/:id/design/capture`, `style.origins` (already records where each value came from) |
| Suggest a direction | `designDirection()` (deterministic, from keywords). It becomes a **draft** labelled with its source, never applied on its own |
| PRD branding | `starterIdentity` → `prdColors` (colours with names and uses). Fonts and other values from the same PRD section |
| Approved specification | `DesignSpec` (`workspace/designSpec.ts`: version, sources, checks, tokens), stored per project |
| Composition concepts | `HOME_CONCEPTS`, `conceptOffer` on the plan card, `applyDesignSpec` for the Home layout |
| Token writes | `applyDesign`, `applyCapturedStyle`, `setSurfaceStyle`: governed writes with snapshots ("Undo it in Changes") |
| Sample without an app | The concept preview approach: library CSS, starter tokens and the draft's tokens in a sample page |
| Contrast | `contrastRatio`, `specProblems` |
| Rerunning checks | `POST /runs/:id/checks/:kind/rerun` |
| Network safety | `allowExternalResearch` (project consent) and `isPrivateHost` (`web/webSearch.ts`). **Gap: style capture currently uses neither.** |

## 4. Smallest implementation plan

1. **Stop applying an unchosen default.**
   - In `captureStyleStep`: with nothing captured, no theme and no PRD colours, record the industry direction as **advice only** (as is already done when a theme was chosen) and write no tokens.
   - In the scaffold step: record `designChoice` only for a real source (a chosen theme, or PRD colours with `by: "prd"`). Otherwise record `{ status: "none" }`.
   - The starter's own tokens stay as they are, because the Component library previews use them. The tab names them "Starter default, not a chosen direction".
2. **One record per project:** `designDirection:<project>` = `{ status: none | selected, spec: DesignSpec, version, sources[], approvedAt, by }`, plus `designDraft:<project>` for the editor's unapplied draft. This replaces the ad hoc `designChoice` meaning; the existing endpoints read and write it.
3. **Design tab states:**
   - none: the neutral empty state with the three setup actions and the secondary "Suggest a direction";
   - selected, no app: a labelled style sample;
   - app built: the current scan, labelled with the direction;
   - draft: draft and applied side by side, with "Use this direction".
   - Detailed settings live in a drawer. The draft is kept in `designDraft` and survives closing it.
4. **Editor controls:**
   - **Default:** primary colour; neutral family (brand-tinted, warm, cool or pure grey); typography pair from the bundled fonts; representative sample.
   - **Advanced:** optional secondary and tertiary colours; optional gradients; status colours; surfaces, text and borders; radius and density.
   - All of it maps onto `DesignSpec` and `specTokens`, which are already deterministic.
5. **Status colours:**
   - Derive success, warning, error and info from fixed hue ranges, tuned to the palette's lightness and saturation.
   - Validate the real pairs: text on each status surface, the status colour on the background, and on-accent.
   - Show each check's ratio.
   - Every suggestion can be edited, or put back.
6. **PRD branding:**
   - Keep each value the PRD gives (`prdColors`, plus named fonts).
   - Suggest only what's missing, labelled "suggested (from …)".
   - Report conflicts, such as a PRD colour failing contrast as text, rather than replacing it.
7. **Capture review:**
   - `POST /design/capture` returns a **draft**, with each value marked observed, inferred, unavailable or substituted (from `origins`), and applies nothing.
   - Applying is the separate "Use this direction" action.
   - A gallery page (Dribbble, Behance, Pinterest and the like) is refused as a CSS source ("a gallery's own styling isn't the shot's design"). Its images go through the image path.
   - Capture requires `allowExternalResearch` and refuses private addresses with `isPrivateHost`. This adds the missing controls; it doesn't relax any existing ones.
8. **Theme and concepts are kept apart:**
   - A concept is composition (the Home page). Applying it with a selected direction writes only its layout, not its palette or fonts.
   - With no direction, a concept may supply a look, labelled as the concept's.
   - Changing concepts never overwrites a chosen brand.
9. **Builds:**
   - The selected direction is passed into the existing pipeline: the capture step uses it instead of the industry default.
   - It's shown on the plan card beside the concepts. No new stop.
   - After the app exists, "Use this direction" is a governed, snapshotted write, followed by the affected checks (typecheck, build, preview, screenshots) through the existing rerun.

## 4a. Themes from open-design (`plugins/_official/design-systems/`)

**Suggested:** feed the theme selector from the open-design design systems, for example `…/design-systems/ollama`. This is the "styles in FlowCode's memory" option (option 2) from earlier, now with a home in the selector.

- **Local snapshot, not a live dependency.**
  - Each system's `DESIGN.md` and `open-design.json` are copied into FlowCode once, with the repository, path, commit and licence recorded.
  - The selector reads the local copy, so a private, moved or changed repository leaves the themes working. Refreshing is a separate, explicit import.
  - **This is a download, so it waits for your approval.**
- **One theme mechanism.**
  - An imported system becomes an entry beside `DESIGN_TEMPLATES`, with a source label ("open-design: Ollama").
  - Its colours, type, radius and surfaces map onto the same `DesignSpec` / `templateTokens` fields.
  - Values it doesn't give are marked "not in the source" and filled only by suggestion, never silently.
  - Choosing one goes through the same path as any theme: a draft, then "Use this direction", recorded with its source.
- **Fonts.**
  - A system's font is used only if it's among FlowCode's bundled, licensed fonts.
  - Otherwise the nearest bundled pairing is offered, marked **substituted**, with the original named.
- **Brand-named systems** (Ollama and other product brands) are still your open decision from earlier. The plan assumes they would be:
  - labelled as inspired by that brand, not as the brand;
  - not offered for building an app that impersonates it;
  - imported only if you include them.
- **Still to check against the actual files:** the exact schema of `open-design.json`, and each system's licence. GitHub was refused to the browser just now, so I couldn't read them. This happens at import, before anything is offered.

## 5. Acceptance tests

1. A new grocery PRD with no theme, URL or PRD colours: no tokens written by the capture step, the direction recorded as `none`, and the Design tab shows the neutral empty state (no green, no "Set by FlowCode").
2. The same with a theme chosen: its tokens are applied, and the direction is `selected` with source "theme".
3. A PRD with only a primary colour: the primary is kept with source "PRD"; other values are suggested and labelled; nothing else is set silently.
4. A PRD colour that fails contrast as text: the conflict is reported, and the value isn't replaced.
5. Capture from a live site: a draft whose values are each marked observed, inferred, unavailable or substituted; `tokens.css` is unchanged until "Use this direction".
6. Capture of a gallery URL is refused as a CSS source; a private address is refused; capture is refused without the project's network consent.
7. Status colours: every generated pair meets its contrast target or is flagged; editing and putting back work; the alerts show labels and icons.
8. Drafts: closing and reopening the drawer keeps the draft; the applied tokens are untouched; reopening the tab restores this project's direction, not another project's.
9. After the app exists: "Use this direction" creates snapshots, can be undone, and reruns typecheck, build and preview; previewing writes no file.
10. Selecting a different concept with a chosen direction changes the Home layout only; the brand tokens are unchanged.
11. Plan approval shows the chosen direction and concepts on the one card; no extra approval request is created.
12. Theme browsing, manual palette edits and "Suggest a direction" make no model calls.

## 6. Expected cost (estimates, not measurements)

| Action | Model calls | Processing |
|---|---|---|
| Browse themes, edit the palette, Suggest a direction | 0 | Deterministic token generation, under 50 ms; sample render in the UI, under 200 ms |
| Capture a live website (CSS) | 0 | Browser load and style read, about 5 to 15 s |
| Capture from images | 1 vision call per image (qwen2.5vl:3b, existing) | About 5 to 20 s each |
| Preview a direction before an app exists | 0 | In-UI sample; no build |
| Apply after the app exists | 0 | Writes under 1 s; reruns: typecheck about 2 to 3 s, build about 5 to 10 s, preview and screenshots about 20 to 40 s |
| At plan approval | 0 extra | The existing card; no new stop |

**Added for open-design themes:**

13. An imported system appears in the theme selector with its source (repository, path, commit, licence). It works with the network off. A value it doesn't give is marked "not in the source"; a font it names that isn't bundled is marked "substituted".
14. Re-importing is explicit, and shows what changed before anything is replaced.
