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
FlowCode's own React and design-token CSS.

## TailAdmin

The bar chart, eCommerce dashboard, calendar, profile screen, upcoming schedule, stock watchlist and video grid pieces
(`chart-bar`, `app-ecommerce-dashboard`, `app-calendar`, `app-profile`, `upcoming-schedule`, `stock-watchlist`,
`video-grid`) follow the structure of TailAdmin's free community edition
(https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template), MIT License, Copyright (c) 2023 TailAdmin.
They were rewritten in FlowCode's own React and design-token CSS, without its dependencies (no FullCalendar, no maps).
TailAdmin Pro components are not used.

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
