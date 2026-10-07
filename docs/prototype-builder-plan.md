# FlowCode as a design-first prototype builder

Decided 2026-10-05. FlowCode builds **clickable prototypes**: simulated data, no backend, real navigation and in-app
search, best-in-class UX and visual design. The PRD describes the real product; the build is its prototype. When the
user is ready to build the real application, the **Launch readiness checklist** (downloadable as Markdown) is the
hand-off. **Build analysis** and the **Compliance report** are separate tools that scan a real repo on disk.

Status: `[ ]` to do · `[~]` in progress · `[x]` done.

## 1. Prototype-only builds
- [x] Remove the Compliance build stage (stages, start endpoint, strip control, checklist bands).
- [x] Build checks are design checks only: code, tests, package, preview, screenshots, Design QA (Styles palette,
      contrast, touch targets), visual review. No security, privacy or SEO scans and no full accessibility audit.
- [x] Prototype rules for the planner, every step brief and the PRD-to-plan step: no backend, no real sign-in,
      payments or external APIs; everything that would call a server is simulated in the app.
- [x] Starter kit for simulation (`src/sim/`): seeded collections and saved values kept in local storage, "Reset demo data", simulated
      latency for loading states, and a search helper; deep links to screens and records (`#/screen/id`).
- [x] Content comes from the PRD or an attached JSON file first; generated sample data only fills gaps (realistic,
      never lorem ipsum).
- [x] Retire backend skills and features for builds: local SQLite database, database-backed feature, Postgres,
      Python; AI features are simulated. The builder's SQLite Data tab is removed.

## 2. Prototype plan and the Launch readiness checklist
- [x] The build runs from a **Prototype plan** made from the PRD (screens, flows, simulated data, look). The review
      step becomes "Review the prototype plan and the design".
- [x] The **Launch readiness checklist** becomes the real-app tool: the PRD's features to build for real, plus backend,
      data, accounts, security, privacy, accessibility, SEO and deployment, each item with a ready prompt.
- [x] Download the checklist as `.md`.

## 3. Design first: CSSVibes style capture
- [x] Capture a style from uploaded images (colours from the pixels; fonts, corners and surface from a vision model
      when one is set up), attached HTML/CSS, a website URL (computed styles) and the PRD's design section. A build
      runs it as the "Capture the style" step; the Styles page has "Capture a style" any time.
- [x] The captured style lands on the Styles page (palette, type, corners, surface) to configure
      before the build; the review step says where it came from.
- [x] Micro-animations by default: motion tokens (durations, easings, enter and exit), press, hover and enter
      feedback in the building blocks, screen transitions; motion skills go to every interface step.

## 4. Starting a build
- [x] New build accepts images and a website URL for the style, next to the PRD and support files.
- [x] New build and Discover say plainly: the PRD is real, the build is a prototype, and the Launch readiness
      checklist is for building the real app.

## 5. Repo tools
- [x] **Build analysis** gets its own page: choose a repo folder first, then scan; report as PDF or Markdown.
- [x] **Compliance report** gets its own page the same way (security, privacy, accessibility, SEO), PDF or Markdown.
- [x] Both leave the project's Quality area.

## 6. Clean-up
- [x] Remove code and screens nothing uses any more; update the Feature guide and Copilot's knowledge.
- [ ] Rebuild the Calculator as a prototype under the new rules.
