# Motion foundation: plan and library assessment

Status: phases 1–2 implemented (native only) and stopped for review; see section 8. Phases 3–4 not started. No dependencies.

Live harness: `motion-lab.html` in this folder, also published privately as "FlowCode Motion Lab". Every pattern runs there with the three motion levels, Flat/Tactile and reduced motion, and has its use/avoid/native/library/reduced/tests spec. Its in-page checks exercise rapid input, focus, history and "animation off".

The harness reviews the *patterns*. It isn't the builder, and it doesn't show that generated apps do any of this yet.

## 1. What exists today

- **Starter tokens** (`templates/react-vite-starter/src/styles/tokens.css`):
  - `--duration-instant/fast/base/slow`;
  - `--ease-out`, `--ease-spring`;
  - `--enter-distance`, `--stagger`.

  They are used in about 160 places.
- **Reduced motion:** one blanket rule (`transition-duration: 0.01ms !important` on `*`), and a static a11y finding when an app animates without a reduced-motion override.
- **Dependencies:**
  - Generated apps ship `react`, `react-dom` and `lucide-react`; there is no animation library.
  - FlowCode's own UI has `three` only through `3d-force-graph`. That isn't available to generated apps.
- **Not there yet:**
  - motion levels;
  - per-project expressive opt-ins;
  - native dialog/drawer motion;
  - page transitions;
  - entrance-once rules;
  - motion tests.

## 2. The model

- **Two layers.**
  - *Functional:* feedback, continuity, hierarchy. Always on, sized by the level.
  - *Expressive:* hero, section choreography, product demo, smooth scroll, ambient background. Opt-in per project, and only on page types that suit it (business homepage, marketing, portfolio), never on app screens or dashboards.
- **Three settings** control the *amount* of motion:

  | Level | Durations | Travel | Stagger | Expressive patterns |
  |---|---|---|---|---|
  | Minimal | 100/140/180ms | 0 | none | none, even if approved; demos become click-through steps |
  | Balanced (default) | 120/200/320ms (the starter's previous timing defaults) | 8px | 40ms, max 5 steps / 200ms | none by itself; an approved hero on an eligible page plays as a short rise |
  | Expressive | 160/260/420ms | 16px | 50ms, max 6 steps / 300ms | none by itself; approved capabilities on eligible pages play in full |

- **Reduced motion wins at every level** (OS setting): no travel, scale, parallax, autoplay or ambient movement; only fades of 90–120ms.
- **"Animation off"** must leave the app fully working; this is tested.
- **Motion is part of the Look.** The level and the expressive opt-ins become fields of the appearance, so they go through the same draft → select → apply path, with the same verification. There is no second system.
- **Character comes from the direction, not one universal style.**
  - Flat: crisp ease-out, colour and border feedback, no spring.
  - Tactile: 1px press travel, shadow change, a light spring on toggles.
  - Page purpose decides whether expressive patterns are offered at all.

## 3. Patterns: native or library

| Pattern | Native implementation | Does a library add value? |
|---|---|---|
| Button/control feedback | CSS transitions on `scale`/`translate`/colour; `linear()` spring | No |
| Save/selection state | CSS + a small state machine (delayed spinner, coalesced clicks) | No |
| Dialogs and drawers | `<dialog>` + `@starting-style` + `transition-behavior: allow-discrete` | No |
| Expand/collapse | `grid-template-rows: 0fr→1fr`, content `inert` while closed | No |
| Tabs/nav indicator | One indicator moved by CSS transition | No |
| Page transitions | `document.startViewTransition` (same-document); instant fallback | No (React Router supports it) |
| Card entrance/interaction | IntersectionObserver + keyframes, once per card, capped stagger | No |
| Filter/sort continuity | FLIP with Web Animations (the new results paint first). A view transition per press was measured too slow on a slowed phone (section 8) | Small: Motion's `layout` is convenient in React |
| Hero/section choreography | Keyframes; `animation-timeline: view()` where supported | Only for long timelines or pinned scroll scenes (GSAP) |
| Product demonstration | Step script + CSS; IntersectionObserver/`visibilitychange` to pause | Optional for long, precisely timed demos (GSAP) |
| Smooth scrolling | `scroll-behavior: smooth` for anchors | Lenis adds inertial wheel smoothing (opt-in only) |
| Animated background | Animated `@property` gradient; canvas if needed | Vanta adds WebGL scenes (heavy; opt-in only) |

**Browser support** (my reading as of mid-2026; re-check when implementing):

- **View Transitions (same-document):** Chromium 111+, Safari 18+, Firefox 144+.
- **`@starting-style` and `allow-discrete`:** current Chromium, Safari and Firefox.
- **Scroll-driven animations:** Chromium and Safari 26; Firefox is static.
- **`interpolate-size`:** Chromium only. That's why the harness uses grid rows instead.

Every pattern degrades to instant and correct behaviour.

**Conclusion:** all functional patterns, and the Balanced level of the expressive ones, need no new package.

## 4. Library assessment: evidence (read-only; fetched 2026-10-18)

These redistribution conclusions are my assessment of the licence texts, not legal clearance. No third-party animation code is in FlowCode, its templates or its component catalog. Adding any needs separate approval.

| Library | Version (npm "latest", publish date, tarball shasum) | Licence evidence (source, revision, SHA-256 of the file as fetched) |
|---|---|---|
| Lenis | 1.3.27, published 2026-10-15, gitHead `1f60fb9`, shasum `9c714ca3…805b3` | npm `license: "MIT"`. [LICENSE](https://github.com/darkroomengineering/lenis/blob/main/LICENSE) last changed in commit `8c1b302ab0ab86ce0c50a25ccbfaca69908bd907` (2024-04-22); sha256 `7d1896b31f2eed9f286b05faca067c4e35b2f109ae7c4ed5105220e2d2820228` (1,088 bytes): "The MIT License … Copyright (c) 2024 darkroom.engineering". |
| GSAP | 3.15.0, published 2026-04-13, shasum `7851baaf…d14` | npm `license: "Standard 'no charge' license: https://gsap.com/standard-license."` [README](https://github.com/greensock/GSAP/blob/master/README.md) at commit `13e2b790546426a1a2e0e9b409f3f8dc6d6611f2` points to the same page. The [licence page](https://gsap.com/standard-license) is Webflow's: effective 2025-04-30, last modified 2025-05-30 (as the page states). |
| Vanta | 0.5.24, published 2022-09-16, gitHead `b09bdb4`, shasum `46ec96b0…fb3` | npm `license: "MIT"`. [LICENSE.md](https://github.com/tengbao/vanta/blob/master/LICENSE.md) last changed in commit `bc0baf88c126c228db06dd3a2504c19594ef532f` (2020-04-03); sha256 `65df69dccc2a06fcf307e81da62c0f64b4abc03fe64a23944427a69642edadcb` (1,048 bytes): MIT, "Copyright 2020 Teng Bao". Needs three.js (MIT), loaded separately. |
| React Bits | No npm package (copied in via shadcn/jsrepo) | [LICENSE.md](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md) last changed in commit `ecdd797468fc87f7b463157627d1174b0c36fdf5` (2026-01-01); sha256 `f4c33af6739191537738662d223b68d77bc226f4b57ea883e16481d8cc5c73c9` (1,303 bytes); titled "MIT + Commons Clause License Condition v1.0". |
| Motion (comparison only) | 14.3.0, published 2026-10-15, gitHead `52dfb32`, shasum `76c2395a…6c2` | npm `license: "MIT"`. Not needed for phases 1–2. |

**What each licence means for the three uses** (my assessment):

| | Inside FlowCode's own UI | Bundled into generated apps | Redistributed in templates / the component catalog |
|---|---|---|---|
| Lenis (MIT) | Allowed | Allowed, with the MIT notice | Allowed, with the MIT notice |
| GSAP (Webflow Standard) | Allowed for a website or app in general | **Risk**: see below | Not addressed by the licence; treat as not allowed without Webflow's written consent |
| Vanta (MIT) | Allowed | Allowed, with notices (Vanta and three.js) | Allowed, with notices. Not recommended (weight, battery, no reduced-motion handling, unmaintained since 2022) |
| React Bits | Allowed only "as part of an application, website, or product" | **Not allowed** for FlowCode to supply automatically | **Not allowed** |

**GSAP, specifically:** the licence forbids "Prohibited Uses" without Webflow's prior written consent. That includes a tool that lets users build visual animations without code and competes with Webflow's animation features. FlowCode choosing a motion level and generating animated pages fits that description closely enough that I wouldn't adopt GSAP without Webflow's confirmation.

**React Bits, specifically:** this is a project-specific restriction, not the generic Commons Clause.
- **The standard Commons Clause v1.0** withholds the right to "Sell", meaning offering for a fee a product or service whose value comes substantially from the software.
- **React Bits' own text** does two different things:
  - it narrows the MIT grant to use "as part of an application, website, or product";
  - it adds that you may use it commercially only if you do not "sell, sublicense, or redistribute the components themselves", whether alone, in a bundle or as a ported version.

  That second condition covers free redistribution of the components too, which a catalog or template would be. It's broader than the generic clause.

**Decision for phases 1–2:** native browser features only. Lenis is held for a later, specific smooth-scrolling requirement.

## 5. Implementation plan (after your approval; no dependencies)

Each phase is self-contained, tested, and followed by a stop for review.

1. **Tokens and settings.**
   - Add `motion: { level, expressive: { hero, demo, parallax, smoothScroll, ambient } }` to the appearance (contracts), defaulting to Balanced with all expressive features off.
   - `appearanceTokens` emits the level's tokens.
   - The starter's reduced-motion rule becomes token overrides, keeping the blanket rule as a safety net.
   - The Look editor gets the three-way control and the opt-ins. Opt-ins are shown only where the page purpose allows them.
2. **Functional patterns in the starter and library.**
   - Button/switch/checkbox states;
   - a `useSaveState` hook (delayed spinner, coalescing);
   - native dialog/drawer;
   - disclosure;
   - tab indicator;
   - a router wrapper for View Transitions (focus to heading, history intact);
   - `useEnterOnce` for entrances;
   - item naming for filter continuity.
3. **Expressive pieces, opt-in.**
   - Hero choreography;
   - section reveal;
   - product-demo component with Pause/off-screen pause, a 3-loop limit and a reduced-motion step mode;
   - ambient background.

   These are offered only for homepage, marketing and portfolio pages, chosen from the page purpose and approved direction.
4. **Selection.** The builder picks the treatment from the product, page purpose and approved direction, and records why. It never applies one style everywhere.

## 6. Testing plan

- **Unit:**
  - tokens per level;
  - reduced motion overrides every level;
  - appearance round-trip;
  - opt-ins refused on app screens.
- **Behaviour (Playwright, on a generated fixture app):** the harness's 12 checks ported to the real components, at Minimal, Balanced and Expressive, with reduced motion and with animation off:
  - rapid toggles;
  - coalesced saves;
  - dialog focus return;
  - inert collapsed content;
  - keyboard tabs;
  - Back/Forward and focus after a page transition;
  - rapid filters;
  - no entrance replay;
  - hero CTA usable at 0ms;
  - demo pause;
  - nothing hidden with animation off.
- **Static checks** (added to the existing a11y scan):
  - animations without a reduced-motion path;
  - autoplay over 5s without a pause control;
  - content at `opacity: 0` at rest;
  - animated layout properties (except the disclosure's grid rows).
- **Performance:**
  - Chrome trace at 4× CPU throttle and mobile emulation: no long tasks over 50ms during interactions;
  - only transform/opacity animate;
  - expressive effects pause when off-screen.
- **Review recordings:** short Playwright videos (`recordVideo`) of each pattern at each level, for you to judge motion quality, alongside the live harness.

## 7. Verified in the harness (2026-10-18, Chromium in the app's browser pane)

- **Checks:** 12 of 12 passed at Minimal, Balanced and Expressive, with Flat and Tactile, reduced motion and animation off. Two early runs failed while someone was clicking in the pane mid-run; clean reruns passed.
- **Not verified:**
  - Safari and Firefox;
  - real phones;
  - frame rate under load;
  - visual taste, which is yours to judge.

## 8. Phases 1–2: implemented (native only), for review

Phases 3–4 (optional expressive pieces, automatic motion selection) are not started. No dependency was added and no builder evaluation was run.

### Contracts, defaults and migration

- **`packages/contracts/src/motion.ts`** (new):
  - `MotionLevel` (minimal, balanced, expressive) and `MotionSetting { level, expressive? }`;
  - `ExpressiveFeature` (hero, sectionReveal, productDemo, parallax, smoothScroll, ambient);
  - `PagePurpose` (app, homepage, marketing, portfolio);
  - `motionTokens(level)`, `staggerDelay(level, i)`, `expressiveAllowed(motion, feature, page)`, `motionProblems`.
- **`Appearance.motion?`:** motion is part of the Look, using the same draft → select → apply path and the same verification. There is no new configuration system.
  - New directions (`BASE_APPEARANCE`, themes) start **Balanced** with no expressive capability.
  - A direction made before motion existed has no `motion`. Applying it leaves the app's motion untouched.
- **Scope:** the Look holds the level and any approved expressive capabilities, and the page purpose decides eligibility.
  - `expressiveAllowed` is false for a level alone (Balanced or Expressive), for an app screen even when the project opted in, and for everything at Minimal.
  - A short hero rise therefore needs the hero opt-in *and* an eligible page.
  - The Look editor shows the three levels. It has no expressive opt-in controls yet, because there are no expressive pieces until phase 3.
- **Tokens:**
  - Balanced preserves the starter's previous **timing defaults**. That is a claim about the timings only: applying the motion foundation to an app does change behaviour (reduced motion keeps short fades instead of erasing every transition; `motion.css` styles every native `<dialog>` and names `<main>` for page transitions; new apps get the router's page transitions and focus policy).
  - Added: `--stagger-steps`, `--stagger-max`, `--motion-level`.
  - Stagger is capped twice at every level, by steps and by total delay: Minimal 0, Balanced 5 steps / 200ms, Expressive 6 steps / 300ms.
  - `--press-scale` stays the surface style's, not motion's.
- **Existing projects are preserved:**
  - nothing changes until a Look *with a level* is applied;
  - then `workspace/motionStyle.ts` adds the missing motion tokens, `src/styles/motion.css` and its import, and removes the old blanket rule, all snapshotted;
  - changing only the level afterwards writes only motion tokens, so colours, fonts, surface, layout and later advanced token edits stay.
  - Router and helper code reaches *new* apps (the starter); an existing app's code isn't rewritten.
  - A rebuild that regenerates an older app's `routes.ts` stays compatible: its `update()` falls back to an ordinary navigation when the app's router predates same-page updates. The first full browser run caught this: 6 files failed on the recorded app until it was fixed.

### Precedence

Animation off > reduced motion > level. In `src/styles/motion.css`:

- **The old blanket rule is removed.** `0.01ms !important` on everything erased the 90–120ms fades. Reduced motion now overrides the motion tokens with higher specificity (`:root:root:root`, loaded last), and that holds at every level.
- **Each animation kind under reduced motion:**
  - **CSS transitions and keyframes:** follow the tokens; library pieces also keep their own reduced rules (46 of 48 stylesheets).
  - **Web Animations:** `moveItems` reads the mode live and only fades.
  - **View Transitions:** keep running, but their tokens become a short crossfade with no travel.
  - **Scrolling:** `scroll-behavior: auto`.
  - **Preference changes while the app is open:** media queries apply live, and `motionMode()` is read on every call. Tested by switching the emulated setting mid-session.
- **Animation off** (`?motion=off`, or FlowCode's preview message): no transitions, keyframes or view transitions, applied at once. The helpers update without animating, and no state waits for an animation to finish.

### Patterns (native)

| Pattern | Implementation | In the fixture app |
|---|---|---|
| Control feedback | The library pieces' existing token-driven presses and transitions, sized by the level | Yes (save toggle, links, filters) |
| Save and selection | `useSaveState` (immediate acknowledgement, spinner after 150ms, coalesced clicks, cleanup on unmount) | Hook unit-tested; the fixture's save is an instant toggle |
| Dialogs and drawers | `NativeDialog` / `Drawer` (starter `components/ui/motion-parts.tsx`): native `<dialog>` with `@starting-style` and `allow-discrete` exit | Yes, on the fixture's motion-parts page (closeout) |
| Expand and collapse | `Disclosure` (starter): `.fc-collapse` grid rows, content inert while closed | Yes, on the fixture's motion-parts page (closeout) |
| Tabs | `TabStrip` (starter): one moving `.fc-tab-indicator`, ARIA keyboard | Yes, on the fixture's motion-parts page (closeout) |
| Page transitions | `lib/screens.ts`: one router listener, View Transition where supported, `::view-transition { pointer-events: none }` so presses during a transition reach the new page at once | Yes |
| Results moving | `moveItems` / the catalog's `continuity`: FLIP with Web Animations (the new results paint first), interrupted from where items are | Yes (category, near me, sort) |

### Focus and scrolling, by kind of navigation (`lib/screens.ts`)

| Kind | Animation | Scroll | Focus |
|---|---|---|---|
| **New page** (a link, a button, `go()`) | Page transition | To the top | The page's `h1`, else `<main>` |
| **Back / Forward** | Page transition, reversed | Back to where that page was | Moves only if it was lost (to `<main>`, without scrolling); the page's name is announced politely |
| **Same-page update** (only the query changed, or the page called `updateRoute`: a filter, a search; Back/Forward across such steps too) | None as a page | Unchanged | Unchanged |
| **Going where you already are, or overtaken by a newer navigation** | — | Nothing of its own | Nothing of its own; the newest navigation always renders, whichever callback runs |

**Bug fixed along the way:** the generated catalog screen remounted the whole catalog on every category change (`key={arg}`), so focus fell to the page. It now keeps one catalog and declares the filter as a same-page update (`update()` in the generated `routes.ts`).

### Tests

- **Contract** (`motion-contract.test.ts`, 9): Balanced preserves the previous timing defaults; level token keys; stagger caps at every level; eligibility (level alone, app screen, Minimal); old directions carry no motion tokens; a level-only change touches only motion tokens.
- **Existing apps** (`motion-apply.test.ts`, 2, on the recorded Clean Cart app):
  - nothing changes without a level;
  - applying adds motion and removes the blanket rule, with only the Look's files changed;
  - a level-only change writes only motion tokens and keeps an advanced colour edit.
- **Template unit tests** (shipped inside every new app; 15 in the fixture: `lib/motion.test.ts`, `lib/screens.test.ts`):
  - transitions fall back, are skipped by a newer one and still update;
  - a browser refusing to start one still updates;
  - the mode is read live;
  - saves coalesce, and unmounting leaves no timers or warnings;
  - `useEnterOnce` disconnects;
  - `moveItems` applies first and animates after;
  - navigation kinds: new, same-page, Back, overtaken.
- **Generated fixture app in Chromium** (`motion-fixture-app.test.ts`, 15; run 3 times, 15/15 each):
  - **Interrupted input, at each level:** rapid navigation, and a raw press 30ms into a transition (took effect in under 150ms); filter changes during movement match the animation-off result.
  - **Navigation and focus:** Back/Forward scroll restoration and focus; same-page updates don't scroll or move focus; rapid save toggles; popover focus return ×5.
  - **Reduced motion:** quick fades with no travel, followed live when the setting changes.
  - **Animation off:** no transition starts, nothing animates, nothing hidden.
  - **Unsupported View Transitions:** navigation, Back and filters behave the same.
  - **Cleanup:** leaving mid-move leaves nothing behind.
  - **Screenshots:** with animation off they are byte-identical.
- **The early harness failures** (`motion-lab-harness.test.ts` → `harness-analysis-2026-10-18.json`):
  - **Clean runs:** 15 of 15 runs pass 12/12, across Minimal, Balanced, Expressive, Expressive with reduced motion, and animation off.
  - **With real presses landing elsewhere on the page mid-run:** 3 of 3 runs fail one check. The detail is always "last page ok; focus elsewhere: BODY; Back ok", so the press moved focus. Navigation state and Back were never wrong. The tabs failure from the first session is the same kind: the check sends synthetic keys to whatever has focus, so they missed the tabs once focus moved.
  - **The three flows that failed, with real input only** (real presses, the real Escape and arrow keys, the browser's own Back): 60/60 at Balanced and Expressive.
  - **Conclusion:** test interference, not a defect reproducible with real use. The checks assert focus, which any press legitimately moves.

**Full suites:**
- daemon: 1,616 passed, 44 skipped;
- browser files, one at a time: 67 passed across 14 files;
- typechecks: contracts, daemon, UI and the library's 206 pieces;
- the fixture app: its own typecheck, lint and 19 tests.

### Measured performance

Chromium 153.0.8010.12, generated fixture app (`perf-2026-10-18.json`), against a baseline with animation off.

**Responsiveness** is the browser's Event Timing (input delay + handling + next paint, rounded to 8ms; presses n=10 per condition, keyboard n=3–4):

| Condition | Presses p75 / max | Keyboard (category change) p75 / max |
|---|---|---|
| Desktop, off (baseline) | 16 / 16ms | 16 / 16ms |
| Desktop, Balanced | 16 / 16ms | 24 / 24ms |
| Desktop, Expressive | 16 / 16ms | 16 / 16ms |
| Desktop, reduced | 16 / 16ms | 16 / 16ms |
| Phone emulation (390×844, CPU ÷4), off | 48 / 56ms | 40 / 40ms |
| Phone, Balanced | 48 / 56ms | 48 / 56ms |
| Phone, Expressive | 48 / 56ms | 72 / 72ms |
| Phone, reduced | 40 / 48ms | 48 / 56ms |

**Frame timing** is separate: main-thread animation-frame intervals during a page transition and during a results move. View Transitions animate on the compositor, so this describes the main thread only.

| Condition | Page transition: p95 / max, frames > 25ms | Results move: p95 / max, frames > 25ms |
|---|---|---|
| Desktop, off | 16.7 / 16.8ms, 0 of 220 | 16.7 / 16.8ms, 0 of 171 |
| Desktop, Balanced | 16.7 / 33.3ms, 1 of 219 | 16.8 / 16.8ms, 0 of 170 |
| Desktop, Expressive | 16.7 / 33.4ms, 1 of 219 | 16.7 / 16.8ms, 0 of 170 |
| Phone ÷4, off | 16.8 / 150ms, 4 of 202 | 16.8 / 50ms, 5 of 165 |
| Phone ÷4, Balanced | 16.8 / 167ms, 4 of 195 | 16.8 / 50ms, 7 of 158 |
| Phone ÷4, Expressive | 16.7 / 167ms, 4 of 195 | 33.3 / 83ms, 8 of 152 |
| Phone ÷4, reduced | 16.7 / 150ms, 4 of 197 | 16.8 / 50ms, 7 of 159 |

**Not phone validation:** every "phone" figure is Chromium's mobile emulation (touch, 390×844) with the CPU slowed 4×, not a real device.

In that emulation the long page-transition frames (about 150–170ms, 4 long animation frames) are present with animation off too. They come from rendering the next page, not from motion.

**One finding changed the design.** A View Transition for every filter press held the next paint for its snapshot: on the slowed phone, keyboard response was p75 120–144ms and frames reached 183ms, against 40ms with animation off. Results now move with FLIP (Web Animations), and page changes keep View Transitions. Expressive is still the heaviest on the slowed phone (72ms keyboard p75, results-move p95 33ms).

**Exceptions to transform/opacity, measured:**
- **Disclosure grid rows** (layout per frame): harness, phone ÷4, 6 open/close cycles: p95 16.7ms, 0 of 221 frames over 25ms.
- **Colour, border and shadow transitions** of library controls (paint only): included in the press measurements above.
- `interpolate-size` / `details` height: Chromium only; not measured separately.

### Browser coverage and known gaps

- **Tested:**
  - Chromium 153 through Playwright: desktop, plus a phone emulation (touch, 390×844, CPU ÷4);
  - jsdom for the unit tests;
  - unsupported View Transitions simulated by removing the API.
- **Not tested:** Safari, Firefox, a real phone or tablet, and assistive technology (the announcer and focus moves were checked in the DOM, not with a screen reader).
- **Gaps:**
  - **Angular has none of the React motion foundation.** Its `tokens.css` carries the motion token names only because it must equal the React starter's; it keeps the old blanket reduced-motion rule and has no `motion.css`, router or motion parts. See the framework boundary below.
  - **The fixture app doesn't exercise** tabs, the native `<dialog>` pattern or `.fc-collapse`; they're covered in the harness and by unit tests only.
  - **Same-screen record changes** (product A → B): an intentional instant change (closeout), not an unfinished transition. The screen reads its record from the address itself (`useHashId`), outside a transition's snapshot, so the router doesn't animate it; focus and scrolling behave as for a new page. A slide could come later, cosmetic only.
  - **Screenshots in FlowCode's verifier:** done in the closeout (below).
  - **The static accessibility scan** still accepts any `prefers-reduced-motion` rule. With `motion.css` present, it no longer finds model-written CSS that moves without a reduced-motion path.
  - **Expressive opt-ins** exist as data and eligibility only, with no editor controls (phase 3).

### Review recordings (`recordings/`)

1. `1-balanced-product-journey-desktop.webm`: catalog, filters, sort, save, a product, Back, Lists.
2. `2-expressive-marketing-harness-desktop.webm` and `-phone.webm`: hero, card entrances, filtering, sort and the product demo. The harness only; expressive pieces aren't in the builder.
3. `3-reduced-product-journey-phone.webm` and `3-reduced-marketing-harness-desktop.webm`: the same, with reduced motion.

## 9. Phase 2 closeout

### 1. Generated-fixture coverage of tabs, native dialog/drawer and disclosure

**These weren't complete in `2985b62`.** They shipped only as CSS (`dialog`/`.fc-drawer`, `.fc-collapse`, `.fc-tab-indicator`) and hooks (`useCollapse`, `useTabIndicator`). No shipped component used them: the starter's `Dialog` and `Tabs` wrap library pieces with their own motion, and there was no disclosure component.

They now exist as starter components in `components/ui/motion-parts.tsx`:
- `Disclosure`: content inert while closed;
- `NativeDialog` and `Drawer`: the browser's modal `<dialog>`, with focus given back to the opener, including when the dialog goes away mid-animation;
- `TabStrip`: ARIA keyboard and one moving indicator; the panel fades only when it changes.

Their look is in `components.css` and their motion is in `motion.css`. The existing `Dialog` and `Tabs` are unchanged.

The generated fixture app gets a page that uses these exact files (`test/fixtures/motion-check`, with the starter's components copied in, not the demo's). `motion-parts-fixture.test.ts` (17 tests) covers it at Minimal, Balanced and Expressive, with reduced motion and with animation off:
- tabs with rapid arrow keys and Home/End, focus following, and the indicator on the selected tab;
- disclosure: closed content unreachable by Tab, open content reachable, 7 rapid toggles ending consistent;
- dialog and drawer: the field usable on the first frame, Tab never reaching the page behind, Escape closing and giving focus back, and Escape 20ms into the entry ×4;
- reduced motion: 120ms fades with no travel;
- animation off: nothing animating;
- leaving the page mid-drawer, mid-dialog, mid-disclosure and mid-tab move: no dialog left, no modal, no animation, the page focusable.

**Defect found:** animation off didn't cover a dialog's `::backdrop`, which kept fading. It's fixed in `motion.css`.

**Note:** a native modal `<dialog>` lets Tab move to the browser's own controls (by design), never to the page behind. The test asserts exactly that, not a full trap.

### 2. Deterministic screenshots in FlowCode's real screenshot path

`quality/preview.ts` now has:
- `stillContext`: marks `<html data-motion="off">` before any app script runs;
- `waitForStill`: fonts loaded, no finite animation running, two frames painted;
- `STILL`: Playwright's own animation stop and a hidden caret at capture.

They're used by the screenshots check (`captureScreenshots`), the look check's pictures, and the smoke test's pictures. The smoke test's interactions keep the app's motion, and motion-enabled behaviour stays in its own tests.

`motion-screenshots.test.ts` covers it: on the Expressive fixture, a picture taken right after starting a results move equals one taken after waiting, and two runs are byte-identical at all three viewports.

**Defect found:** the first version set the attribute before the page's `<html>` existed, so it never took effect. It now marks it as soon as it appears.

### 3. Framework boundary (Angular)

**Can the Motion control be applied to Angular today? No.**
- A Look apply on the Angular starter fails at the surface step ("doesn't use FlowCode's building blocks"), as before.
- In `2985b62` the motion writer ran *before* that step, so a failed apply relied on snapshot restore to remove `motion.css` and to put back the blanket rule it had taken out.

**Now:**
- the surface runs first;
- `setMotionStyle` refuses any app without `src/main.tsx`;
- `applySelected` leaves the motion tokens out for such an app, and its result says so;
- the editor states that the level is kept in the Look but not applied, because the foundation is React only;
- the design state reports `motionSupported: false`.

Two tests in `motion-apply.test.ts` check that an Angular apply writes no motion even with a restore that does nothing.

**An Angular motion foundation would be a separately bounded patch:** `motion.css` in `angular.json` styles, the blanket rule replaced, and the router and parts as Angular equivalents. Not started.

### 4. Claims, corrected

- **Balanced:** preserves the previous timing defaults; applying the foundation changes behaviour (section 8).
- **Phone figures:** Chromium mobile emulation with the CPU slowed 4×, not validated on phones.
- **Still documented:** the Expressive filtering overhead (72ms keyboard p75 against a 40ms baseline in that emulation) and the page-rendering frame stalls.

**Tracked separately:** the ~150ms page-rendering frames in the emulated slow phone are present with animation off too, so this work didn't introduce them.

### 5. Same-screen product navigation

**An intentional instant fallback, not an unfinished transition.**
- The router skips the page transition when only the record on the same screen changes, and still applies new-page focus (the heading) and scrolling (top).
- Tested in `motion-fixture-app.test.ts`: no view transition starts, the new product's heading is shown and focused, and the page scrolls to the top.

### FlowCode's Motion Lab page

The Motion Lab is now a page of FlowCode itself, under Intelligence, below Component library. It's built with FlowCode's own controls and tokens, with no frame and one header, and its 12 checks run there:
- 12/12 at Minimal, Balanced and Expressive;
- 12/12 with reduced motion;
- 12/12 with animation off.

**Defect found:** my React port's save state stopped after React's development double-mount; the shipped `useSaveState` already handled it.

The published single-file review page is unchanged and separate.

### Remaining gaps

- **Browsers and devices:** Safari, Firefox and real phones or tablets aren't tested; all browser results are Chromium 153.
- **Assistive technology:** focus moves and the polite route announcer were checked in the DOM only, not with NVDA, VoiceOver or JAWS.
- **Native dialog Tab order** depends on the browser (Tab reaching the browser's own controls); untested outside Chromium.
- **Angular** has no motion foundation (above).
- **Recordings:** visual approval is separate from functional acceptance. The Expressive marketing recording shows the harness only; it isn't evidence of builder integration.
