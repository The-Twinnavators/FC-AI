# Motion foundation: plan and library assessment

Status: **proposal for review**. Nothing is installed or integrated.

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
  | Minimal | 100/140/180ms | 0 | none | none; demos become click-through steps |
  | Balanced (default) | 140/220/340ms | 10px | 40ms, capped at 6 | short hero rise only |
  | Expressive | 160/280/460ms, hero 760ms | 22px | 60ms | hero choreography, demo, and opted-in parallax, smooth scroll, ambient |

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
| Filter/sort continuity | View Transitions with a name per item; FLIP via Web Animations as fallback | Small: Motion's `layout` is convenient in React |
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

## 4. Library assessment (read-only; versions from the npm registry, 2026-10-18)

| Library | Version, licence | Inside FlowCode's own UI | Bundled into generated apps | In templates / the component catalog | Suitability |
|---|---|---|---|---|---|
| **Lenis** | 1.3.27, MIT; no runtime deps | OK | OK (keep the MIT notice) | OK (MIT notice) | Good for opt-in smooth scroll. Respects reduced motion by default. Caveats: iframes; Safari capped at 60fps; nested scroll needs config; `syncTouch` unstable on iOS < 16. |
| **GSAP** | 3.15.0, GSAP Standard "no charge" licence (Webflow; effective 2025-04-30, modified 2025-05-30). Not open source. | Allowed for websites and apps, but see the restriction | **Risk**: see below | Not addressed by the licence | Best-in-class timelines. The licence is the problem. |
| **Vanta** | 0.5.24 (last npm publish appears to be 2022), MIT; needs three.js (MIT), about 120 KB gzipped | OK | OK (notices) | OK (notices) | Poor fit: heavy, WebGL battery cost on phones, no reduced-motion support, maintenance unclear. |
| **React Bits** | No npm package (copied via shadcn/jsrepo); MIT + Commons Clause | Using it in an app is allowed | **Not OK** to have FlowCode supply it automatically: the clause forbids redistributing "the components themselves", alone or in a bundle | **Not OK** | Can't be bundled under FlowCode's licensing rule (MIT/CC BY only). Its ideas can be reimplemented independently; its code can't be copied. |
| *Motion (for comparison)* | 14.3.0, MIT | OK | OK | OK | The one package that would add real value in React (springs, `layout`, exit animations). Not needed for this plan. |

**GSAP in detail:** the licence prohibits, without Webflow's written consent, using GSAP in a tool that lets users build visual animations without code and that competes with Webflow's animation features.

FlowCode picking a motion level and generating animated sites is close enough to that description that I'd treat it as **not usable without written confirmation from Webflow**. Webflow can also revise or terminate the licence.

This is my reading of the licence, not legal advice.

**Recommendation:**

- No package for the foundation: native CSS and browser APIs cover every functional pattern and Balanced.
- Lenis is the one candidate worth approving later, for the opt-in smooth-scroll feature only, if native `scroll-behavior` proves too plain.
- No GSAP without Webflow's confirmation.
- No Vanta.
- No React Bits code.

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
