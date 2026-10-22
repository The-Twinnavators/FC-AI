# Third-party notices

FlowCode includes, or was informed by, the open-source work below. Each licence's full text ships with the files it
covers. Thank you to their authors.

## Fonts (included)

Files: `templates/fonts/` and `apps/ui/public/fonts/`, each with its `.LICENSE.txt`. Packaged by Fontsource.

| Font | Licence |
|---|---|
| Inter, Source Sans 3, Montserrat, Quicksand, DM Sans, Work Sans | SIL Open Font License 1.1 |
| Source Serif 4, Literata, Fraunces, Playfair Display, Oswald, JetBrains Mono | SIL Open Font License 1.1 |

The fonts may be bundled and redistributed with software. They may not be sold on their own.

## Section library (written for FlowCode)

`templates/library/` (its sections and `library.css`) is FlowCode's own code, written in FlowCode's React and
design-token CSS. Which sections and variants to include was informed by these MIT-licensed libraries. No code was
copied from them; if a future section adapts their code, its file will carry the original copyright notice:

- Open Props, © Adam Argyle (MIT)
- Meraki UI, © Khatab Wedaa (MIT)
- daisyUI, © Pouya Saadeghi (MIT)
- Tailblocks, © Mert Cukuren (MIT)
- AstroWind, © Arthelokyo and contributors (MIT)
- Landwind, © Themesberg (MIT)
- Creative Tim UI (free blocks), © Creative Tim (MIT)

## Templates

Industry templates based on HTML5 UP designs (Creative Commons Attribution 3.0) credit "HTML5 UP" (html5up.net) in
FlowCode and in each prototype built from them.
Layouts adapted (templates/library/sections): Arcana (site-cafe), Forty (site-agency), Big Picture
(site-photographer), Editorial (site-magazine), Dopetrope (site-real-estate), Escape Velocity (site-fitness), Alpha
(site-nonprofit), Fractal (site-event), Directive (site-clinic), Eventually (site-coming-soon). Each keeps the credit
in its header comment and a visible "Design: HTML5 UP" line in its footer.

See `docs/component-library-sources.md` for which sources may be used and on what conditions.

## HyperUI

Some library sections (shop, inputs, display pieces, app screens and the neobrutalism kit) follow the structure of
HyperUI components (https://github.com/markmead/hyperui), MIT License, Copyright (c) Mark Mead. They were rewritten in
FlowCode's own React and design-token CSS. The team members table, wide table with a sticky header and first column,
skip links and setup checklist (`table-members`, `table-sticky-grid`, `skip-links`, `setup-checklist`) follow its
tables, skip links, steps and accordion components the same way, and the API keys, audit log, invoice, task drawer and
CSV import pieces (`api-keys`, `audit-log`, `invoice-view`, `task-drawer`, `csv-import`) follow its application
components, and the checkout, wishlist, compare, order confirmation and bundle builder pieces (`shop-checkout`,
`shop-wishlist`, `shop-compare`, `shop-order-confirmation`, `shop-bundle-builder`) its ecommerce components.

## TailAdmin

The bar chart, eCommerce dashboard, calendar, profile screen, upcoming schedule, stock watchlist, multi-select with chips,
phone field, card fields and language switcher pieces (`chart-bar`, `app-ecommerce-dashboard`, `app-calendar`,
`app-profile`, `upcoming-schedule`, `stock-watchlist`, `select-multi-chips`, `input-phone`, `input-card-number`,
`language-switcher`), and the funnel chart, leaderboard and goal targets (`chart-funnel`, `leaderboard`, `goal-targets`)
follow the structure of TailAdmin's free community edition
(https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template), MIT License, Copyright (c) 2023 TailAdmin.
They were rewritten in FlowCode's own React and design-token CSS, without its dependencies (no FullCalendar, no maps).
TailAdmin Pro components are not used.

## Meraki UI

The notifications menu, team directory, files table and blog post pieces (`notification-menu`, `team-directory`,
`table-files`, `blog-article`), and the careers, changelog, contact offices, pricing calculator and reviews pieces
(`careers-openings`, `changelog-releases`, `contact-offices`, `pricing-calculator`, `reviews-summary`), and the video
hero, integrations grid, case studies and newsletter footer (`hero-video`, `integrations-grid`, `case-studies`,
`footer-newsletter`) follow the structure of Meraki UI components (https://github.com/merakiuilabs/merakiui),
MIT License, Copyright (c) 2021 Khatab Wedaa. They were rewritten in FlowCode's own React and design-token CSS. Meraki UI
site templates are not used.

## Tailblocks

The how-it-works steps, filtered gallery and testimonial wall, roadmap and integrations grid (`how-it-works`, `gallery-filter`, `testimonials-wall`,
`roadmap-board`, `integrations-grid`) follow the structure of Tailblocks
(https://github.com/mertJF/tailblocks), MIT License, Copyright (c) 2020 Mert Cukuren, rewritten in FlowCode's own React
and design-token CSS.

## AstroWind and Landwind

The sign-up hero, bento features, use cases in tabs, "the old way" comparison and testimonial wall (`hero-signup`,
`features-bento`, `use-cases-tabs`, `compare-old-way`, `testimonials-wall`) follow the structure of AstroWind
(https://github.com/onwidget/astrowind), MIT License, Copyright (c) 2023 onWidget; the sign-up hero also follows Landwind
(https://github.com/themesberg/landwind), MIT License, Copyright (c) 2022 Themesberg. Rewritten in FlowCode's own React
and design-token CSS (no Astro or Tailwind).

## Creative Tim UI

The order history, signed-in devices, two-factor, connected apps, notification preferences, payment methods and
change password pieces (`order-history`, `account-sessions`, `account-two-factor`, `connected-apps`,
`notification-matrix`, `billing-payment-methods`, `account-password`) follow the structure of Creative
Tim UI blocks (https://github.com/creativetimofficial/ui), MIT License, Copyright (c) 2025 Creative Tim, rewritten in
FlowCode's own React and design-token CSS (no Tailwind or shadcn/ui).

## TailGrids

The one-time code, number field, input group, social sign-in, context menu, menu bar, split panes, mega menu and
scroll area pieces (`otp-input`, `number-field`, `input-group`, `social-button`, `context-menu`, `menubar`, `resizable`,
`navigation-menu`, `scroll-area`), and the date field, collapsible group, zoomable chart, scrolling dialog and time
zone field (`date-field`, `collapsible-group`, `chart-zoom`, `dialog-scroll`, `time-zone-field`), and the donut chart
and activity heatmap (`chart-donut`, `activity-heatmap`) follow the structure of TailGrids' open-source components (https://github.com/TailGrids/tailgrids),
MIT License, Copyright (c) 2025 Tailgrids, rewritten in FlowCode's own React and design-token CSS (no Tailwind or
Radix). Provider names and marks in `social-button` are their owners' trademarks. tailgrids.com premium blocks and
templates are not used.

## More pieces from the same MIT sources

Each was read for structure and rewritten in FlowCode's own React and design-token CSS, with nothing copied or fetched:

- HyperUI (MIT, Copyright (c) Mark Mead): team chat, mail client and announcement composer (`app-team-chat`, `app-mail`,
  `announcement-composer`).
- Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): call lobby and away message (`call-lobby`, `away-message`).
- Tailblocks (MIT, Copyright (c) 2020 Mert Cukuren): event listing, appointment booking flow and rental listing detail
  (`event-listing`, `booking-flow`, `rental-detail`).
- Meraki UI (MIT, Copyright (c) 2021 Khatab Wedaa): opening hours and guest check-in (`store-hours`, `guest-checkin`).
- AstroWind (MIT, Copyright (c) 2023 onWidget): about story, story in numbers, plan comparison, press kit and partner
  application (`about-story`, `numbers-story`, `plans-accordion`, `press-kit`, `partner-apply`); the last two also follow
  Landwind (MIT, Copyright (c) 2022 Themesberg).
- Learning: lesson player, quiz and learner progress follow HyperUI; flashcards Meraki UI; the course certificate Creative
  Tim UI (`lesson-player`, `quiz-runner`, `learner-progress`, `flashcards-deck`, `course-certificate`).
- Money and time: budget categories and habit tracker follow TailAdmin; transactions list and timesheet HyperUI; bill
  splitter TailGrids (`budget-categories`, `habit-tracker`, `transactions-list`, `timesheet-week`, `bill-splitter`).
- Operations: time off follows Creative Tim UI; shift schedule and inventory TailAdmin; shipment tracking and expense report
  HyperUI (`time-off-request`, `shift-schedule`, `inventory-stock`, `shipment-tracking`, `expense-report`).
- Content: media library, document review, version history, content approval and short links follow Meraki UI, TailGrids
  and Tailblocks (`media-library`, `document-review`, `version-history`, `content-approval`, `short-links`).
- Health: workout logger and medication schedule follow HyperUI; meal log TailAdmin; symptom check-in TailAdmin and
  HyperUI; patient portal Creative Tim UI (`workout-logger`, `medication-schedule`, `meal-log`, `symptom-checkin`,
  `patient-portal`).
- Onboarding: product tour, what's new, usage limits, shortcuts sheet and feedback widget follow TailGrids, HyperUI and
  Meraki UI (`product-tour`, `whats-new`, `usage-limits`, `shortcuts-sheet`, `feedback-widget`).
- Community: forum threads, forum thread, public profile, community group and connection requests follow Meraki UI,
  Tailblocks and Creative Tim UI (`forum-threads`, `forum-thread`, `public-profile`, `community-group`,
  `connection-requests`).
- Causes and travel: donation form and destination cards follow Tailblocks; fundraising progress and travel deals AstroWind;
  volunteer sign-up Landwind (`donation-form`, `destination-cards`, `fundraising-progress`, `travel-deals`,
  `volunteer-signup`).
- TailGrids (MIT, Copyright (c) 2025 Tailgrids) and TailAdmin free edition (MIT, Copyright (c) 2023 TailAdmin): profile
  photo, tags manager, address form, survey builder and business details (`profile-photo`, `tags-manager`,
  `address-form`, `survey-builder`, `business-details`).

## liquid-glass-js

The liquid glass piece (`templates/library/sections/liquid-glass.tsx`) adapts the WebGL refraction, blur and masking
approach of liquid-glass-js (https://github.com/dashersw/liquid-glass-js), MIT License, Copyright (c) 2025 Armagan
Amcalar. It was rewritten in FlowCode's React and design-token CSS and samples a backdrop the piece is given instead of
capturing the page with html2canvas, so nothing is loaded from the internet.

MIT License: Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction, including without
limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above
copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
